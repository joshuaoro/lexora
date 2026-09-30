DO $$
DECLARE t text;
BEGIN
FOR t IN
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity
AND NOT EXISTS (
SELECT 1 FROM pg_policies p
WHERE p.schemaname = 'public' AND p.tablename = pg_tables.tablename
)
LOOP
EXECUTE format('CREATE POLICY "No client access" ON public.%I FOR ALL TO anon, authenticated USING (false)', t);
END LOOP;
END $$;