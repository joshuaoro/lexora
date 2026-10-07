-- Give the switched-off Data API an empty schema, so it stops failing every 30s.
--
-- What the logs showed
-- --------------------
-- From the moment the Data API was disabled in the dashboard (7 October, 10:53
-- UTC), the database logged
--
--     ERROR: schema "pg_pgrst_no_exposed_schemas" does not exist
--
-- from PostgREST, as role `authenticator`, about every 32 seconds — 445 times
-- in the first four hours. Supabase does not stop PostgREST when the Data API
-- is disabled; it points PostgREST at a placeholder schema that does not exist,
-- and PostgREST's schema-cache load fails and retries forever. The same failure
-- is what a client sees as `503 PGRST002`.
--
-- Supabase documents this as a known issue that does not affect the project
-- beyond the log noise, with this as the workaround:
-- https://supabase.com/docs/guides/troubleshooting/schema-pg_pgrst_no_exposed_schemas-does-not-exist
--
-- Why it is worth doing anyway
-- ----------------------------
-- An ERROR every half-minute buries every real one. The audit's own attempt to
-- read a table with the anon key — which logs a deliberate `permission denied`,
-- the evidence that the door is shut — was two lines among hundreds.
--
-- Why this exposes nothing
-- ------------------------
-- The schema is empty, and stays that way: nothing in this project creates
-- objects outside `public`. A new schema grants USAGE to no one, and `anon` and
-- `authenticated` hold no privileges anywhere (20260812150000). So PostgREST
-- now has a schema to load and nothing in it to serve.
--
-- The role setting means the dashboard's Data API toggle no longer controls
-- which schemas PostgREST exposes. That is the intent here — LEXORA never uses
-- PostgREST — but to re-enable the Data API one day, first run:
--
--     ALTER ROLE authenticator RESET pgrst.db_schemas;
--     NOTIFY pgrst, 'reload config';
--
-- Guarded on the role existing, so the migration still applies to a plain
-- Postgres that has no Supabase roles.

CREATE SCHEMA IF NOT EXISTS pgrst_no_exposed_schemas;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    ALTER ROLE authenticator SET pgrst.db_schemas = 'pgrst_no_exposed_schemas';
  END IF;
END
$$;

-- Delivered at commit. One reloads the role setting, the other the schema cache.
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
