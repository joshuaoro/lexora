-- Deny the Supabase Data API access to every table.
--
-- Why this exists
-- ---------------
-- Supabase exposes a PostgREST endpoint at https://<ref>.supabase.co/rest/v1/
-- and grants the `anon` and `authenticated` roles full DML on everything in the
-- public schema by default. Row Level Security is what is supposed to hold that
-- back, and it was never enabled here — Prisma does not create policies and
-- nothing else did either. Measured before this migration:
--
--   * the endpoint was live (it answered "No API key found", not 404)
--   * rowsecurity was false on all 11 public tables
--   * `anon` held SELECT, INSERT, UPDATE, DELETE *and TRUNCATE* on every one
--
-- So anyone holding the project's anon key — which is public by design in
-- Supabase's model, because RLS is meant to be the protection — could read every
-- child's transcript and voice recording, every email and password hash, and
-- could delete the study outright. None of it would pass through LEXORA, so none
-- of the authorization the app enforces and the audit suite proves would apply.
--
-- Why RLS with no policies, rather than policies
-- ----------------------------------------------
-- LEXORA does not use PostgREST at all: no @supabase/supabase-js, no anon key,
-- no NEXT_PUBLIC_SUPABASE_* anywhere in the tree. There is no client to grant
-- access to, so there is nothing for a policy to express. RLS with zero policies
-- is deny-by-default, which is exactly the intent, and it cannot rot the way a
-- policy set can.
--
-- The Data API is also switched off in the dashboard. This migration is the
-- second layer: if the endpoint is ever re-enabled — by a person, or by a change
-- in Supabase's defaults — the tables still refuse.
--
-- Why this does not break the application
-- ---------------------------------------
-- Verified rather than assumed. Prisma connects as `postgres`, and
-- `SELECT rolbypassrls FROM pg_roles WHERE rolname = 'postgres'` returns true,
-- so RLS does not apply to it. The tables are also owned by `postgres`, and an
-- owner is exempt unless FORCE ROW LEVEL SECURITY is set, which it is not here.
--
-- The failure mode to know about: RLS denies SELECT *silently*. It returns zero
-- rows, it does not raise. If the connection role ever changed to one without
-- BYPASSRLS the app would not crash — every child's data would simply appear to
-- have vanished. tests/api-audit.mjs asserts against that directly by comparing
-- what the app reads over HTTP against what the database actually holds.
--
-- BYPASSRLS is what protects the app here, not ownership, and it is stronger
-- than it looks: FORCE ROW LEVEL SECURITY does not override it. Measured on
-- this database — 76 PhonItem rows read as `postgres` both before and during
-- FORCE. So FORCE is not a way to rehearse the failure above; only running as a
-- role without BYPASSRLS is.
--
-- _prisma_migrations is included so the schema history is not readable either,
-- and so the advisor shows nothing rather than one lonely finding somebody later
-- "fixes" without checking. Note the bootstrapping hazard if you ever move
-- migrations to a role without BYPASSRLS: that role could no longer read the
-- migration table to work out what to apply.
--
-- Rollback: ALTER TABLE "<name>" DISABLE ROW LEVEL SECURITY; per table.

ALTER TABLE "User"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LearnerProfile"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Word"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PhonItem"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SpeechClip"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ActivitySession"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Attempt"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AttemptReview"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReviewErrorTag"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PracticeItem"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
