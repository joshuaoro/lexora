-- Split specialist recordings from generated TTS clips.
-- Keeping them in separate columns means a specialist recording always takes
-- priority, and removing it restores the generated clip instead of leaving the
-- word silent. `audioVersion` busts cached audio URLs when a clip changes.
ALTER TABLE "Word" ADD COLUMN "audioWordHuman" TEXT;
ALTER TABLE "Word" ADD COLUMN "audioSyllHuman" TEXT;
ALTER TABLE "Word" ADD COLUMN "audioVersion" INTEGER NOT NULL DEFAULT 1;

-- Move any existing specialist recording into the new column so it is not lost.
UPDATE "Word" SET "audioWordHuman" = "audioWord" WHERE "audioSource" = 'SPECIALIST';
UPDATE "Word" SET "audioSyllHuman" = "audioSyll" WHERE "audioSource" = 'SPECIALIST';
UPDATE "Word" SET "audioWord" = NULL, "audioSyll" = NULL WHERE "audioSource" = 'SPECIALIST';

-- audioSource is now derived from which columns are populated.
ALTER TABLE "Word" DROP COLUMN "audioSource";
