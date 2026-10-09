-- ============================================================================
-- Migration 00017: Comprehensive Attendance History, Student Status & School Calendar
-- Idempotent and safe to run multiple times.
-- ============================================================================

-- 1. Extend students table with student status (active, transferred, graduated, inactive)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'students' and column_name = 'status'
  ) then
    alter table public.students add column status text not null default 'active'
      check (status in ('active', 'transferred', 'graduated', 'inactive'));
  end if;
end;
$$;

-- 2. Extend attendance table with historical class context, notes, and correction tracking
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'attendance' and column_name = 'grade'
  ) then
    alter table public.attendance add column grade text not null default '';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'attendance' and column_name = 'section'
  ) then
    alter table public.attendance add column section text not null default '';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'attendance' and column_name = 'correction_reason'
  ) then
    alter table public.attendance add column correction_reason text not null default '';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'attendance' and column_name = 'corrected_by'
  ) then
    alter table public.attendance add column corrected_by uuid references auth.users (id) on delete set null;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'attendance' and column_name = 'corrected_at'
  ) then
    alter table public.attendance add column corrected_at timestamptz;
  end if;
end;
$$;

-- Backfill any existing attendance records with their student's current grade and section
update public.attendance a
set
  grade = coalesce(nullif(a.grade, ''), s.grade, ''),
  section = coalesce(nullif(a.section, ''), s.section, '')
from public.students s
where a.student_id = s.id
  and (a.grade = '' or a.section = '');

-- 3. School Calendar table (Instructional days, holidays, term dates)
create table if not exists public.school_calendar (
  date date primary key,
  is_school_day boolean not null default true,
  term text not null default '',
  holiday_name text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.school_calendar enable row level security;

-- Calendar RLS: Staff can view, admins can manage
drop policy if exists "school_calendar_select" on public.school_calendar;
create policy "school_calendar_select" on public.school_calendar
  for select using (true);

drop policy if exists "school_calendar_insert_admin" on public.school_calendar;
create policy "school_calendar_insert_admin" on public.school_calendar
  for insert with check (public.is_staff());

drop policy if exists "school_calendar_update_admin" on public.school_calendar;
create policy "school_calendar_update_admin" on public.school_calendar
  for update using (public.is_staff());

drop policy if exists "school_calendar_delete_admin" on public.school_calendar;
create policy "school_calendar_delete_admin" on public.school_calendar
  for delete using (public.is_admin());

-- 4. Trigger to auto-fill grade/section and track corrections
create or replace function public.fn_handle_attendance_mutation()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_student_grade text;
  v_student_section text;
begin
  -- Auto-populate grade & section from student record if not provided
  if new.grade is null or new.grade = '' or new.section is null or new.section = '' then
    select grade, section into v_student_grade, v_student_section
    from public.students
    where id = new.student_id;

    if new.grade is null or new.grade = '' then
      new.grade := coalesce(v_student_grade, '');
    end if;
    if new.section is null or new.section = '' then
      new.section := coalesce(v_student_section, '');
    end if;
  end if;

  -- On update, if status or note changes, update timestamps and correction tracking
  if TG_OP = 'UPDATE' then
    new.updated_at := now();
    if old.status <> new.status or old.note <> new.note then
      new.corrected_at := now();
      if new.corrected_by is null then
        new.corrected_by := auth.uid();
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists attendance_before_mutation on public.attendance;
create trigger attendance_before_mutation
  before insert or update on public.attendance
  for each row execute function public.fn_handle_attendance_mutation();

-- 5. Additional index for fast date-range and class filtering
create index if not exists attendance_date_grade_section_idx on public.attendance (date desc, grade, section);
create index if not exists attendance_student_date_idx on public.attendance (student_id, date desc);
create index if not exists students_grade_section_idx on public.students (grade, section);
