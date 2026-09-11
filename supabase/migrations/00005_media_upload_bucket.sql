-- ============================================================================
-- Zereyakob Elementary School Digital Learning Platform
-- Migration 00005: "media" storage bucket for uploads from the Media & Gallery
-- Run after 00004 (in the Supabase SQL Editor or `supabase db push`).
-- Idempotent.
-- ============================================================================

-- Public "media" bucket: photos/videos uploaded from Media & Gallery.
-- 15 MB limit; images + MP4 video allowed (videos can also be pasted as URLs).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  15728640,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'video/mp4']
)
on conflict (id) do nothing;

-- Public read: gallery images are watched by visitors without logging in.
drop policy if exists "media_public_read" on storage.objects;
create policy "media_public_read" on storage.objects
  for select using (bucket_id = 'media');

-- Writes restricted to admins / super admins (matches media_showcase RLS).
drop policy if exists "media_admin_insert" on storage.objects;
create policy "media_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and public.is_admin());

drop policy if exists "media_admin_update" on storage.objects;
create policy "media_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and public.is_admin())
  with check (bucket_id = 'media' and public.is_admin());

drop policy if exists "media_admin_delete" on storage.objects;
create policy "media_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and public.is_admin());