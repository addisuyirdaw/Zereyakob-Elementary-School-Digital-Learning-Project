-- ============================================================================
-- Phase 6: Khan Academy Kids Integration
-- Adds imports tracking, student mapping, and granular learning records
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Khan Imports (Batch / File tracking)
-- ---------------------------------------------------------------------------
create table if not exists public.khan_imports (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid references auth.users (id) on delete set null,
  original_filename text not null,
  file_hash text not null unique, -- Prevents exact duplicate file uploads
  storage_path text not null,     -- Path in the khan_exports bucket
  report_date date not null,
  grade text not null,
  subject text not null,
  school_class_name text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Khan Student Mappings
-- ---------------------------------------------------------------------------
-- Scoped by school_class_name so students with the same name in different 
-- classes don't collide globally.
create table if not exists public.khan_student_mappings (
  id uuid primary key default gen_random_uuid(),
  khan_student_name text not null,
  school_class_name text not null,
  student_id uuid references public.students (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint khan_mapping_unique unique (khan_student_name, school_class_name)
);

create trigger khan_mappings_set_updated 
  before update on public.khan_student_mappings
  for each row execute function public.manage_user();

-- ---------------------------------------------------------------------------
-- 3. Khan Learning Records
-- ---------------------------------------------------------------------------
create table if not exists public.khan_learning_records (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.khan_imports (id) on delete cascade,
  khan_student_name text not null,
  category_level text not null,
  activity_skill text not null,
  progress_current integer,
  progress_total integer,
  score_percentage integer,
  status text not null check (status in ('viewed', 'attempted', 'unattempted')),
  created_at timestamptz not null default now()
);

create index if not exists khan_records_import_idx on public.khan_learning_records (import_id);
create index if not exists khan_records_student_idx on public.khan_learning_records (khan_student_name);

-- ---------------------------------------------------------------------------
-- RLS Enablement & Policies
-- ---------------------------------------------------------------------------
alter table public.khan_imports enable row level security;
alter table public.khan_student_mappings enable row level security;
alter table public.khan_learning_records enable row level security;

-- SELECT: Staff (Teachers, Engineers, Admins) can read
create policy "khan_imports_select" on public.khan_imports for select using (public.is_staff());
create policy "khan_student_mappings_select" on public.khan_student_mappings for select using (public.is_staff());
create policy "khan_learning_records_select" on public.khan_learning_records for select using (public.is_staff());

-- INSERT: Staff can insert through the workflow
create policy "khan_imports_insert" on public.khan_imports for insert with check (public.is_staff());
create policy "khan_student_mappings_insert" on public.khan_student_mappings for insert with check (public.is_staff());
create policy "khan_learning_records_insert" on public.khan_learning_records for insert with check (public.is_staff());

-- UPDATE: Staff can update mappings (needed for manual reconciliation)
create policy "khan_student_mappings_update" on public.khan_student_mappings for update using (public.is_staff());

-- DELETE: Only Admins can delete historical imports and learning records
create policy "khan_imports_delete" on public.khan_imports for delete using (public.current_role() = 'admin');
create policy "khan_student_mappings_delete" on public.khan_student_mappings for delete using (public.current_role() = 'admin');
create policy "khan_learning_records_delete" on public.khan_learning_records for delete using (public.current_role() = 'admin');

-- ---------------------------------------------------------------------------
-- Storage Bucket for Raw HTML Files
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'khan_exports', 
  'khan_exports', 
  false, 
  5242880, -- 5MB limit
  '{text/html}'
) on conflict (id) do nothing;

-- Storage Policies for khan_exports
create policy "khan_exports_select_staff" on storage.objects
  for select using (bucket_id = 'khan_exports' and public.is_staff());

create policy "khan_exports_insert_staff" on storage.objects
  for insert with check (bucket_id = 'khan_exports' and public.is_staff());

create policy "khan_exports_delete_admin" on storage.objects
  for delete using (bucket_id = 'khan_exports' and public.current_role() = 'admin');
