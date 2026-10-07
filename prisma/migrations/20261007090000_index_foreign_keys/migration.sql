-- Index the four foreign keys that had none, and drop the one index nothing reads.
--
-- What the advisor found
-- ----------------------
-- Supabase's performance advisor reported four foreign keys without a covering
-- index, measured with its own lint query against this database:
--
--   Attempt.sessionId        → ActivitySession   ON DELETE SET NULL
--   Attempt.wordId           → Word              ON DELETE SET NULL
--   AttemptReview.specialistId → User            ON DELETE CASCADE
--   PracticeItem.wordId      → Word              ON DELETE CASCADE
--
-- Postgres indexes the *referenced* side of a foreign key (a primary key) but
-- never the *referencing* column. So whenever a parent row goes, the cascade has
-- to find its children, and without an index that is a scan of the whole child
-- table. Two of these run in normal use, not just in maintenance:
--
--   * Starting any activity sweeps the learner's empty sessions older than an
--     hour (api/sessions). Each one deleted nulls Attempt.sessionId — a scan of
--     every attempt in the study, per session.
--   * Erasing a learner deletes a User row, and Postgres checks *every* foreign
--     key pointing at User, including AttemptReview.specialistId — a scan of
--     every review, on every erasure and on every audit-suite cleanup.
--
-- PracticeItem's unique (learnerId, wordId) index cannot serve a lookup by word,
-- because it leads with learnerId; hence its own index on wordId.
--
-- The unused index
-- ----------------
-- ReviewErrorTag_tag_idx had zero scans, and not by accident: no query filters
-- on tag alone. Every read goes through the review (served by the unique
-- (reviewId, tag) index), and the tag distribution is counted in code over rows
-- already loaded. An index nothing can read only costs a write on every tag.
--
-- Every other index reported as lightly used was checked against the queries
-- that issue it and kept: a table of a few hundred rows is often cheaper to scan
-- than to index, so a low scan count here says how small the study is today,
-- not that the index is dead. They are sized for the end of the study.
--
-- Expect the four new indexes to appear under "unused index" for a while: an
-- index starts at zero scans and these are used by cascades, which are rare by
-- design. That lint is informational. The two above that run in normal use will
-- register scans as soon as a stale session is swept or an account removed.
--
-- Safe to apply to the live study database: additive indexes on tables of a few
-- hundred rows, taken under a brief lock, and no constraint existing rows could
-- violate. Rollback: DROP INDEX for each of the four; recreate the tag index with
--   CREATE INDEX "ReviewErrorTag_tag_idx" ON "ReviewErrorTag"("tag");

CREATE INDEX "Attempt_sessionId_idx" ON "Attempt"("sessionId");

CREATE INDEX "Attempt_wordId_idx" ON "Attempt"("wordId");

CREATE INDEX "AttemptReview_specialistId_idx" ON "AttemptReview"("specialistId");

CREATE INDEX "PracticeItem_wordId_idx" ON "PracticeItem"("wordId");

DROP INDEX "ReviewErrorTag_tag_idx";
