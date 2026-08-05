-- Decoding probe non-words, and words whose meaning turns on unwritten stress.
--
-- Both are additive and defaulted, so existing rows keep their current
-- behaviour: every word already in the bank stays a real word (isPseudo false)
-- with no stress caveat (stressNote null).

ALTER TABLE "Word" ADD COLUMN "isPseudo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Word" ADD COLUMN "stressNote" TEXT;

-- Every ordinary word query filters on isPseudo, and the probe selects on it
-- together with the staging columns the word pool already uses.
CREATE INDEX "Word_isPseudo_level_stage_idx" ON "Word"("isPseudo", "level", "stage");
