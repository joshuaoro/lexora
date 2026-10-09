-- Letter sounds recorded by the reading specialists (see LetterSound in
-- schema.prisma). Additive: one new table, nothing else touched.

-- CreateTable
CREATE TABLE "LetterSound" (
    "sound" TEXT NOT NULL,
    "audio" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LetterSound_pkey" PRIMARY KEY ("sound")
);

-- The same two layers as every other table (20260812010000, 20260930120000):
-- row level security with no way in for the Data API's roles. Grants are not
-- needed — 20260812150000 removed the default privileges that would have
-- handed them out — and the policy is created here rather than left to a
-- sweep, so the table is never open between this migration and the next.
ALTER TABLE "LetterSound" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No client access" ON public."LetterSound" FOR ALL TO anon, authenticated USING (false);
