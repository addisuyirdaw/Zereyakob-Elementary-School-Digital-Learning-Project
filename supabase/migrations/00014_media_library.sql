-- ============================================================================
-- Zereyakob Elementary School Digital Learning Platform
-- Migration 00014: Media Library (Storage bucket 'media' + 'media' table)
-- ============================================================================

-- 1. Storage bucket 'media' for photos and videos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  52428800, -- 50 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 52428800;

-- Storage RLS policies
drop policy if exists "media_public_read" on storage.objects;
create policy "media_public_read" on storage.objects
  for select using (bucket_id = 'media');

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

-- 2. 'media' database table
create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  url text not null default '',
  type text not null default 'image' check (type in ('image', 'video')),
  caption text not null default '',
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.media enable row level security;

-- Public can read media records
drop policy if exists "media_select_public" on public.media;
create policy "media_select_public" on public.media
  for select using (true);

-- Admins can insert, update, delete
drop policy if exists "media_insert_admin" on public.media;
create policy "media_insert_admin" on public.media
  for insert with check (public.is_admin());

drop policy if exists "media_update_admin" on public.media;
create policy "media_update_admin" on public.media
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "media_delete_admin" on public.media;
create policy "media_delete_admin" on public.media
  for delete using (public.is_admin());

-- Sync any existing items from media_showcase if present
do $$
begin
  if exists (select from information_schema.tables where table_schema = 'public' and table_name = 'media_showcase') then
    insert into public.media (id, title, url, type, caption, display_order, created_at)
    select
      id,
      title,
      media_url as url,
      case when media_type in ('video', 'interview') then 'video' else 'image' end as type,
      caption,
      display_order,
      created_at
    from public.media_showcase
    on conflict (id) do nothing;
  end if;
end $$;
