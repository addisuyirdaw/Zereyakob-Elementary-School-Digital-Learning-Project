-- ============================================================================
-- Zereyakob Elementary School Digital Learning Platform
-- Migration 00003: Staff & Admins management — expanded roles, tightened RLS
-- Run this in the Supabase SQL Editor (after 00001 and 00002).
-- Idempotent: safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Remove the OLD role constraint FIRST — it only allowed
--    ('student','teacher','engineer','admin') and would reject 'super_admin'.
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;

-- ---------------------------------------------------------------------------
-- 2. Migrate legacy role values to the new hierarchy
--    engineer  -> admin            (maintenance/operations staff become admins)
--    admin     -> super_admin      (the original bootstrap admins are owners)
--    Guarded: legacy values only exist the first time this file runs.
-- ---------------------------------------------------------------------------
update public.profiles set role = 'admin'       where role = 'engineer';
update public.profiles set role = 'super_admin' where role = 'admin';

-- ---------------------------------------------------------------------------
-- 3. Add the new role constraint: student, teacher, staff, admin, super_admin
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and conname = 'profiles_role_check2'
  ) then
    raise notice 'constraint already exists';
  else
    alter table public.profiles
      add constraint profiles_role_check2
      check (role in ('student', 'teacher', 'staff', 'admin', 'super_admin'));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Role helper functions (recreate with the new hierarchy)
-- ---------------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('super_admin', 'admin', 'teacher', 'staff')
  )
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('super_admin', 'admin')
  )
$$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  )
$$;

-- ---------------------------------------------------------------------------
-- 4. Profiles RLS: only super admins may modify other accounts
--    (replaces the old broad "admin can update anyone" policy)
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_update_admin" on public.profiles;

drop policy if exists "profiles_update_super_admin" on public.profiles;
create policy "profiles_update_super_admin" on public.profiles
  for update using (public.is_super_admin());

drop policy if exists "profiles_delete_super_admin" on public.profiles;
create policy "profiles_delete_super_admin" on public.profiles
  for delete using (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- 5. Bootstrap / auto-role trigger: Super Admin rules
--    - SUPABASE_BOOTSTRAP_ADMIN_EMAIL or addisul@gmail.com -> super_admin
--    - first account in an empty profiles table            -> super_admin
--    - everyone else                                       -> student
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_profile()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  boot_admin text := current_setting('app.bootstrap_admin', true);
  total int;
begin
  select count(*) into total from public.profiles;

  if (boot_admin is not null and boot_admin = new.email)
     or lower(new.email) in ('addisul@gmail.com', 'addisulal@gmail.com')
     or total = 0 then
    insert into public.profiles (id, email, role, first_name, last_name)
    values (
      new.id,
      new.email,
      'super_admin',
      coalesce(new.raw_user_meta_data->>'first_name', ''),
      coalesce(new.raw_user_meta_data->>'last_name', '')
    );
  else
    insert into public.profiles (id, email, role, first_name, last_name)
    values (
      new.id,
      new.email,
      'student',
      coalesce(new.raw_user_meta_data->>'first_name', ''),
      coalesce(new.raw_user_meta_data->>'last_name', '')
    );
  end if;
  return new;
end;
$$;