-- ============================================================================
-- Zereyakob Elementary School Digital Learning Platform
-- Supabase / PostgreSQL schema with Row Level Security
-- Run this in the Supabase SQL Editor (or apply via migration).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles (one row per auth user)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  role text not null default 'student'
    check (role in ('student', 'teacher', 'engineer', 'admin')),
  first_name text not null default '',
  last_name text not null default '',
  phone text not null default '',
  title text not null default '',
  bio text not null default '',
  avatar_url text not null default '',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Students (school records; not necessarily auth users)
-- ---------------------------------------------------------------------------
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  student_code text not null unique default '',
  first_name text not null default '',
  last_name text not null default '',
  gender text not null default 'male' check (gender in ('male', 'female', 'other')),
  grade text not null default '',
  section text not null default '',
  guardian_name text not null default '',
  guardian_phone text not null default '',
  address text not null default '',
  birth_date date,
  enrolled_at date not null default current_date,
  math_score numeric(5,2) not null default 0,
  logic_score numeric(5,2) not null default 0,
  language_score numeric(5,2) not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Attendance (unique per student per day -> duplicate prevention in the DB)
-- ---------------------------------------------------------------------------
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  date date not null,
  status text not null check (status in ('present', 'absent', 'excused', 'late')),
  note text not null default '',
  recorded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_student_date_unique unique (student_id, date)
);

create index if not exists attendance_date_idx on public.attendance (date desc);
create index if not exists attendance_student_idx on public.attendance (student_id);

-- ---------------------------------------------------------------------------
-- Contact / outreach messages from international supporters
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  email text not null default '',
  country text not null default '',
  role text not null default 'supporter' check (role in ('supporter', 'partner', 'media', 'government', 'other')),
  subject text not null default '',
  message text not null default '',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS enablement
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.attendance enable row level security;
alter table public.messages enable row level security;

-- ---------------------------------------------------------------------------
-- Security definer helpers (bypass RLS via definer ownership)
-- ---------------------------------------------------------------------------
create or replace function public.current_role()
returns text
language sql stable security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('teacher', 'engineer', 'admin')
  )
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('engineer', 'admin')
  )
$$;

create or replace function public.manage_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles policies
-- ---------------------------------------------------------------------------
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

create policy "profiles_select_staff" on public.profiles
  for select using (public.is_staff());

create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());

create policy "profiles_update_admin" on public.profiles
  for update using (public.is_admin());

create trigger profiles_set_updated before update on public.profiles
  for each row execute function public.manage_user();

-- ---------------------------------------------------------------------------
-- Students policies
-- ---------------------------------------------------------------------------
create policy "students_select_staff" on public.students
  for select using (public.is_staff());

create policy "students_select_own_record" on public.students
  for select using (user_id = auth.uid());

create policy "students_insert_staff" on public.students
  for insert with check (public.is_staff());

create policy "students_update_staff" on public.students
  for update using (public.is_staff());

create policy "students_delete_admin" on public.students
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Attendance policies
-- ---------------------------------------------------------------------------
create policy "attendance_select_staff" on public.attendance
  for select using (public.is_staff());

create policy "attendance_select_own_record" on public.attendance
  for select using (
    exists (
      select 1 from public.students s
      where s.id = attendance.student_id and s.user_id = auth.uid()
    )
  );

create policy "attendance_insert_staff" on public.attendance
  for insert with check (public.is_staff());

create policy "attendance_update_staff" on public.attendance
  for update using (public.is_staff()) with check (public.is_staff());

create policy "attendance_delete_admin" on public.attendance
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Messages policies (public can submit; staff can read/update)
-- ---------------------------------------------------------------------------
create policy "messages_insert_public" on public.messages
  for insert with check (true);

create policy "messages_select_staff" on public.messages
  for select using (public.is_staff());

create policy "messages_update_staff" on public.messages
  for update using (public.is_staff());

-- ---------------------------------------------------------------------------
-- Auto-create a default Admin from signup metadata when the first user signs up
-- ---------------------------------------------------------------------------
-- The bootstrap admin is provided via SUPABASE_BOOTSTRAP_ADMIN_EMAIL. When that
-- exact email signs in, a profile hold is created. If profiles is empty before
-- the insert, the account automatically receives the `admin` role.
create or replace function public.handle_new_profile()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  boot_admin text := current_setting('app.bootstrap_admin', true);
  proposed_role text;
  total int;
begin
  select count(*) into total from public.profiles;

  if boot_admin is not null and boot_admin = new.email then
    proposed_role := 'admin';
  elsif total = 0 then
    -- very first account in the system becomes Super Admin
    proposed_role := 'admin';
  else
    proposed_role := 'student';
  end if;

  insert into public.profiles (id, email, role, first_name, last_name)
  values (new.id, new.email, proposed_role, coalesce(new.raw_user_meta_data->>'first_name', ''), coalesce(new.raw_user_meta_data->>'last_name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_profile();

-- ---------------------------------------------------------------------------
-- Student code auto generation
-- ---------------------------------------------------------------------------
create sequence if not exists public.student_code_seq start 1000;

create or replace function public.assign_student_code()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.student_code is null or new.student_code = '' then
    new.student_code := 'ZKR-' || to_char(new.enrolled_at, 'YYYY') || '-' || nextval('public.student_code_seq')::text;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists students_set_codes on public.students;
create trigger students_set_codes
  before insert or update on public.students
  for each row execute function public.assign_student_code();