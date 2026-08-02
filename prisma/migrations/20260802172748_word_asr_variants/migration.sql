-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Word" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "syllables" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "stage" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "meaningEn" TEXT,
    "variants" TEXT NOT NULL DEFAULT '',
    "audioWord" TEXT,
    "audioSyll" TEXT,
    "audioSource" TEXT NOT NULL DEFAULT 'NONE'
);
INSERT INTO "new_Word" ("audioSource", "audioSyll", "audioWord", "id", "level", "meaningEn", "pattern", "stage", "syllables", "text") SELECT "audioSource", "audioSyll", "audioWord", "id", "level", "meaningEn", "pattern", "stage", "syllables", "text" FROM "Word";
DROP TABLE "Word";
ALTER TABLE "new_Word" RENAME TO "Word";
CREATE UNIQUE INDEX "Word_text_key" ON "Word"("text");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
