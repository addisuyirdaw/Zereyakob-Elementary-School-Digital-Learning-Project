-- ============================================================================
-- Zereyakob Elementary School Digital Learning Platform
-- Migration 00002: Partners registry, profile avatars, avatars storage bucket
-- Run this in the Supabase SQL Editor (after 00001_init.sql).
-- Idempotent: safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles.avatar_url
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists avatar_url text not null default '';

-- ---------------------------------------------------------------------------
-- Partners (publicly displayed on the hero / landing page)
-- ---------------------------------------------------------------------------
create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  slug text not null unique default '',
  website text not null default '',
  logo_url text not null default '',
  description_en text not null default '',
  description_am text not null default '',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.partners enable row level security;

-- Public read: anyone (visitors on the hero page) can see active partners.
create policy "partners_select_public" on public.partners
  for select using (true);

-- Staff can add and edit; only admins can delete.
create policy "partners_insert_staff" on public.partners
  for insert with check (public.is_staff());

create policy "partners_update_staff" on public.partners
  for update using (public.is_staff()) with check (public.is_staff());

create policy "partners_delete_admin" on public.partners
  for delete using (public.is_admin());

-- Seed: Debre Berhan University, our founding academic partner.
insert into public.partners (name, slug, website, description_en, description_am, sort_order)
values (
  'Debre Berhan University',
  'debre-berhan-university',
  'https://www.dbu.edu.et',
  'Research, technology and teacher training — ensuring every Zereyakob child learns on world-class tools.',
  'ምርምር፣ ቴክኖሎጂ እና የመምህራን ስልጠና — እያንዳንዱ የዘረያቆብ ልጅ በዓለም ደረጃ በታወቁ መሳሪያዎች መማሩን ማረጋገጥ።',
  0
)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Storage: "avatars" bucket (public read, owner-only writes)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_authenticated_insert" on storage.objects;
create policy "avatars_authenticated_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars');

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (select auth.uid()::text) = (select owner::text));

drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (select auth.uid()::text) = (select owner::text));