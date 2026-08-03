import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getLearnerContext, sessionExpired } from "@/lib/guards";
import { scoreReading, activeScoreThreshold } from "@/lib/scoring";
import { transcribeAudio } from "@/lib/asr";
import { updateAdaptiveLevel, recordMiss, recordPracticeResult } from "@/lib/adaptive";

const MAX_AUDIO_BYTES = 600_000; // ~600 KB base64 cap per recording

const schema = z.object({
  sessionId: z.string().optional(),
  wordId: z.string().nullable().optional(),
  activityType: z.enum(["READ_ALOUD", "LISTEN_CHOOSE", "SYLLABLES", "RHYME", "FIRST_SOUND", "PRACTICE"]),
  target: z.string().min(1),
  transcript: z.string().nullable().optional(), // choice made (choice types) / legacy oral transcript
  browserTranscript: z.string().nullable().optional(), // Web Speech fallback for oral types
  // For choice-based activities the client reports the outcome directly.
  choiceCorrect: z.boolean().optional(),
  responseMs: z.number().int().min(0).max(600_000).default(0),
  audio: z.string().optional(), // base64 data URL of the oral reading
  // A second reading taken after the word was modelled. Recorded, but kept out
  // of every measure — see the note on Attempt.isRetry.
  isRetry: z.boolean().optional(),
});

const ASR_TYPES = ["READ_ALOUD", "PRACTICE"];

export async function POST(req: Request) {
  const ctx = await getLearnerContext();
  if (!ctx) return sessionExpired();
  const { learnerId, profile } = ctx;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid attempt" }, { status: 400 });
  const data = parsed.data;
  const isRetry = data.isRetry === true;

  const wordRow = data.wordId
    ? await prisma.word.findUnique({ where: { id: data.wordId }, select: { variants: true } })
    : null;
  const variants = (wordRow?.variants ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  const audio =
    data.audio && data.audio.length <= MAX_AUDIO_BYTES && data.audio.startsWith("data:audio")
      ? data.audio
      : null;

  // Server-authoritative scoring for oral readings; client-reported for choices.
  let correct: boolean;
  let score = 0;
  let errorType: string;
  let transcript = data.transcript ?? null;
  let heard = "";
  let engine: string | null = null;
  let altTranscript: string | null = null;

  if (ASR_TYPES.includes(data.activityType)) {
    const browserText = data.browserTranscript ?? data.transcript ?? null;

    if (audio) {
      // Primary: pre-trained Whisper via API. Fallback: the browser recognizer.
      const serverText = await transcribeAudio(audio);
      if (serverText !== null) {
        transcript = serverText;
        engine = "server";
        altTranscript = browserText;
      } else if (browserText !== null) {
        transcript = browserText;
        engine = "browser";
      } else {
        // Audio was captured but no recognizer could score it — don't record
        // a misleading attempt; let the learner retry.
        return NextResponse.json({ error: "scoring_unavailable" }, { status: 503 });
      }
    } else {
      // No recording (skipped, or mic produced nothing): score whatever text
      // the browser recognizer heard, else it counts as no response.
      transcript = browserText;
      engine = browserText !== null ? "browser" : null;
    }

    const result = scoreReading(data.target, transcript, activeScoreThreshold(), variants);
    correct = result.correct;
    score = result.score;
    errorType = result.errorType;
    heard = result.heard;
  } else {
    correct = data.choiceCorrect ?? false;
    score = correct ? 1 : 0;
    errorType = correct ? "correct" : "substitution";
  }

  const attempt = await prisma.attempt.create({
    data: {
      learnerId,
      wordId: data.wordId ?? null,
      sessionId: data.sessionId ?? null,
      activityType: data.activityType,
      target: data.target,
      transcript,
      engine,
      altTranscript,
      correct,
      score,
      errorType,
      responseMs: data.responseMs,
      audio,
      levelAtTime: profile.level,
      isRetry,
    },
  });

  // Practice-list and difficulty bookkeeping run on first readings only. A
  // retry says whether the child could repeat a word just modelled for them,
  // which is worth recording but is not evidence that they can decode it — so
  // it must not master a practice word or move them up a level.
  if (data.wordId && !isRetry) {
    if (data.activityType === "PRACTICE") {
      await recordPracticeResult(learnerId, data.wordId, correct);
    } else if (!correct && ASR_TYPES.includes(data.activityType)) {
      await recordMiss(learnerId, data.wordId);
    }
  }

  let level = profile.level;
  let levelChanged: "up" | "down" | null = null;
  if (ASR_TYPES.includes(data.activityType) && !isRetry) {
    const res = await updateAdaptiveLevel(learnerId);
    level = res.level;
    levelChanged = res.changed;
  }

  return NextResponse.json({
    id: attempt.id,
    correct,
    score,
    errorType,
    heard,
    engine,
    level,
    levelChanged,
  });
}
