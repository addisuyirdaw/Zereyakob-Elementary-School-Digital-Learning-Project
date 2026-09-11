-- ============================================================================
-- Zereyakob Elementary School Digital Learning Platform
-- Migration 00007: Core project contributors (SUPERSEDED — no-op kept for history)
--
-- NOTE: The original version of this migration seeded contributors with raw
-- INSERTs into auth.users. On a hosted Supabase project those rows are never
-- registered with GoTrue (no companion auth.identities row), so the admin auth
-- API cannot see or update them ("User not found" on dashboard edits).
--
-- Contributors are instead created through the supported auth admin API via:
--   node --env-file=.env.local scripts/seed-contributors.mjs
--
-- Migration 00008 removes any half-formed auth.users rows this file may have
-- created before it was rewritten.
-- ============================================================================

select 1;