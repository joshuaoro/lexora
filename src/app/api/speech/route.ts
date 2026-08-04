import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getSession } from "@/lib/auth";
import { getOrCreateSpeech, MAX_SPEECH_CHARS } from "@/lib/speech";

/**
 * Speaks a line of interface text in the app's neural voice.
 *
 *   /api/speech?lang=fil&text=Pindutin%20ang%20mic
 *
 * A GET with the text in the query string on purpose: the URL is then stable
 * per phrase, so the browser caches the audio itself and a repeated
 * instruction never leaves the device. The database caches the synthesis, so
 * the first child to hear a phrase pays for it and nobody else does.
 *
 * Synthesis is a WebSocket round trip, so the first call for a new phrase is
 * slow enough to need more than the default budget.
 */
export const maxDuration = 30;

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const text = (url.searchParams.get("text") ?? "").trim();
  const lang = url.searchParams.get("lang") === "fil" ? "fil" : "en";

  if (!text) return NextResponse.json({ error: "No text" }, { status: 400 });
  if (text.length > MAX_SPEECH_CHARS) {
    return NextResponse.json({ error: "Text too long" }, { status: 413 });
  }

  // Budget keyed to the account, so one signed-in visitor cannot mint clips
  // until the database the study lives in is full.
  const clip = await getOrCreateSpeech(text, lang, session.id);
  if (clip === "quota") {
    return NextResponse.json(
      { error: "Too many new phrases; try again later" },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }
  // Not an error the caller should retry: the client falls back to the
  // browser's own voice, which is worse but better than silence.
  if (!clip) return NextResponse.json({ error: "Synthesis unavailable" }, { status: 503 });

  const [header, base64] = clip.audio.split(",");
  if (!base64) return NextResponse.json({ error: "Bad audio" }, { status: 500 });
  const mime = header.match(/^data:([\w/.+-]+)/)?.[1] ?? "audio/mpeg";

  const etag = `"${createHash("sha1").update(base64).digest("hex").slice(0, 16)}"`;
  const headers = {
    ETag: etag,
    // The clip for a given URL never changes — the voice is part of the cache
    // key, so a voice change produces a different URL rather than a stale hit.
    "Cache-Control": "private, max-age=604800, immutable",
  };

  if (req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers });
  }

  return new NextResponse(Buffer.from(base64, "base64"), {
    headers: { ...headers, "Content-Type": mime },
  });
}
