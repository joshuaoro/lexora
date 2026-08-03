-- AlterTable
ALTER TABLE "ActivitySession" ADD COLUMN     "completedAt" TIMESTAMP(3);

-- Backfill. Before this column, a session only ever had totals written to it at
-- the moment the learner finished, so "total > 0" *was* "completed". Sessions
-- recorded under those rules must keep that meaning, or every activity already
-- completed would silently stop being counted on the dashboard.
UPDATE "ActivitySession"
   SET "completedAt" = "createdAt"
 WHERE "total" > 0;
