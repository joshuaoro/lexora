-- ActivitySession is queried by learner on every dashboard, report and
-- exercises page load, and had no index but its primary key — Postgres does not
-- create one for a foreign key. Every such query was a sequential scan.
--
-- Additive and concurrent-safe to apply: creating an index takes a brief lock
-- on a table this small, and adds no new constraint that existing rows could
-- violate.

CREATE INDEX "ActivitySession_learnerId_createdAt_idx"
  ON "ActivitySession"("learnerId", "createdAt");

CREATE INDEX "ActivitySession_learnerId_type_idx"
  ON "ActivitySession"("learnerId", "type");
