-- Three additions, all defaulted so existing rows keep their current meaning.
--
-- isDemo defaults false: the two seeded demo learners are flagged separately by
-- the seed and by `npm run words:sync`, because flagging them here would hard-code
-- study-specific email addresses into a migration.
--
-- blind defaults false, and that is the truthful value for every review already
-- recorded: the machine's verdict was on screen above the play button when each
-- of them was made.

ALTER TABLE "LearnerProfile" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AttemptReview" ADD COLUMN "blind" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ReviewErrorTag" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "ReviewErrorTag_pkey" PRIMARY KEY ("id")
);

-- One of each tag per review, so re-tagging is idempotent rather than additive.
CREATE UNIQUE INDEX "ReviewErrorTag_reviewId_tag_key" ON "ReviewErrorTag"("reviewId", "tag");

-- The distribution is read by tag across every review, so index the tag itself.
CREATE INDEX "ReviewErrorTag_tag_idx" ON "ReviewErrorTag"("tag");

ALTER TABLE "ReviewErrorTag" ADD CONSTRAINT "ReviewErrorTag_reviewId_fkey"
    FOREIGN KEY ("reviewId") REFERENCES "AttemptReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
