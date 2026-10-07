-- Make a learner's recorded Marungko stage the stage they are actually taught.
--
-- Every activity draws words at max(stage, min(7, level + 2)) — the stage widens
-- with the level, by design (src/lib/marungko.ts, effectiveStage). The stored
-- column only caught up at the first level change, so a learner who had never
-- changed level was recorded at stage 1 (m, s, a) while being shown stage-3
-- words with b, e and u in them. That stored 1 is what the specialist pages,
-- the summary export and the IEP draft all report as the child's placement.
--
-- Nothing a child sees changes: the words drawn were already at the wider stage.
-- Only the record is brought into line with it, and the default for new
-- learners moves to match level 1.
--
-- Never lowers a stage — the column records the furthest a learner has reached,
-- and a learner demoted after being promoted keeps it.

UPDATE "LearnerProfile"
   SET "stage" = LEAST(7, "level" + 2)
 WHERE "stage" < LEAST(7, "level" + 2);

ALTER TABLE "LearnerProfile" ALTER COLUMN "stage" SET DEFAULT 3;
