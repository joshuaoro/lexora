-- Practice lessons and checks (spec 2026-10-16). Additive: three nullable
-- columns on existing tables; row level security is per table and unchanged.
ALTER TABLE "PracticeItem" ADD COLUMN "lastTaughtOn" DATE;
ALTER TABLE "PracticeItem" ADD COLUMN "lastSeenOn" DATE;
ALTER TABLE "Attempt" ADD COLUMN "practiceMode" TEXT;
