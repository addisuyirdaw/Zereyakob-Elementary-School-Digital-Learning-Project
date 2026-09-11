-- ============================================================================
-- Zereyakob Elementary School Digital Learning Platform
-- Migration 00006: Staff public directory profiles
-- Adds rich staff bio data + a publish-to-public toggle on profiles.
-- Run after 00005. Idempotent.
-- ============================================================================

alter table public.profiles add column if not exists profession text not null default '';
alter table public.profiles add column if not exists is_public boolean not null default false;

comment on column public.profiles.profession is 'Profession / title shown on the public Core Team directory';
comment on column public.profiles.is_public is 'When true, this staff member appears on the public Core Team section';

-- Visitors (no login) may view published staff profile snapshots.
-- Staff/authenticated users keep their existing, broader read policies.
drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public" on public.profiles
  for select using (is_public = true);