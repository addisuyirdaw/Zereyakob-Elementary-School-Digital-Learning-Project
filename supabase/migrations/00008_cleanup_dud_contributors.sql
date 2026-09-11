-- ============================================================================
-- Zereyakob Elementary School Digital Learning Platform
-- Migration 00008: Remove half-formed contributor auth rows
--
-- The original 00007 inserted rows into auth.users directly. On a hosted
-- Supabase project those rows are invisible to GoTrue (no auth.identities row,
-- no way to sign in), so dashboard edits returned "User not found". Deleting
-- them cascades to public.profiles (FK on delete cascade). Contributors are
-- re-seeded with the admin API via scripts/seed-contributors.mjs.
-- Idempotent. Safe to re-run.
-- ============================================================================

delete from auth.users u
where u.email like 'contributor.%@zereyakob.edu.et'
  and not exists (
    select 1 from auth.identities i where i.user_id = u.id
  );