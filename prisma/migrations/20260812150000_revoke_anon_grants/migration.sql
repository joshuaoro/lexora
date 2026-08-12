-- Take the Data API's roles off the schema entirely.
--
-- Why, on top of the RLS added in 20260812010000
-- --------------------------------------------
-- That migration stopped `anon` reading any rows. It did not stop `anon` from
-- having been *granted* SELECT/INSERT/UPDATE/DELETE on all 11 tables, which
-- Supabase does by default — measured before this: 77 table grants each to
-- `anon` and `authenticated`, plus USAGE on schema public.
--
-- Two things that leaves open while the Data API endpoint is still answering:
--
--   * PostgREST builds its OpenAPI description from what the requesting role
--     can see. With the grants in place, an anon request can still enumerate
--     table and column names — the shape of a study database, if not its rows.
--
--   * The grants are the only thing between "RLS is on" and full read/write. A
--     single table created without RLS, or one ALTER ... DISABLE, and `anon` has
--     it. Defence that depends on exactly one setting staying correct forever is
--     thinner than it looks, and this one is set per table.
--
-- Revoking makes the two independent: a future mistake has to undo a grant *and*
-- a row policy before anything is reachable.
--
-- Why this is safe here
-- ---------------------
-- LEXORA never speaks PostgREST. There is no @supabase/supabase-js in the tree,
-- no anon key in any environment, and every query goes through Prisma over the
-- Postgres wire protocol as `postgres`. `service_role` keeps its grants, so the
-- Supabase dashboard's own table editor is unaffected.
--
-- ALTER DEFAULT PRIVILEGES is the part that makes it stick. Without it, the next
-- migration that creates a table hands `anon` a fresh set of grants on it, and
-- this file becomes a one-off tidy-up that quietly stops being true.
--
-- Reversing it, should Supabase's client libraries ever be adopted here:
--   GRANT USAGE ON SCHEMA public TO anon, authenticated;
--   GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
-- ...and then RLS policies would have to be written, because at that point RLS
-- would be the only thing left holding the door.

-- Existing objects.
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- Anything created later, by whichever role runs migrations.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- The schema itself. Without USAGE, the roles cannot even name an object inside
-- it, which is what removes the tables from PostgREST's introspection output
-- rather than merely emptying them.
REVOKE USAGE ON SCHEMA public FROM anon, authenticated;
