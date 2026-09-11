-- ============================================================================
-- Zereyakob Elementary School Digital Learning Platform
-- Migration 00004: Media Showcase — public photos & interviews
-- Run this in the Supabase SQL Editor (after 00001–00003).
-- Idempotent: safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Media showcase (public photos, screenshots, videos, interviews)
-- ---------------------------------------------------------------------------
create table if not exists public.media_showcase (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  caption text not null default '',
  media_url text not null default '',
  media_type text not null default 'image'
    check (media_type in ('image', 'video', 'interview')),
  is_featured_video boolean not null default false,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.media_showcase enable row level security;

-- Public read: anyone (visitors on the landing page) can view media.
create policy "media_select_public" on public.media_showcase
  for select using (true);

-- Only admins / super admins can manage records.
create policy "media_insert_admin" on public.media_showcase
  for insert with check (public.is_admin());

create policy "media_update_admin" on public.media_showcase
  for update using (public.is_admin()) with check (public.is_admin());

create policy "media_delete_admin" on public.media_showcase
  for delete using (public.is_admin());