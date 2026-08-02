import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

/**
 * Serves the stored Filipino pronunciation clip for a word.
 *   /api/word-audio/<wordId>?kind=word   → the whole word
 *   /api/word-audio/<wordId>?kind=syll   → syllable by syllable
 *
 * A reading specialist's own recording always wins over the generated clip.
 *
 * Caching: the URL is stable, so a plain long max-age would keep serving an
 * old clip after a specialist re-records. The response is therefore tagged
 * with a content ETag and marked `no-cache`, which lets the browser reuse the
 * bytes but forces a (cheap) revalidation that returns the new clip the moment
 * it changes.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const kind = new URL(req.url).searchParams.get("kind") === "syll" ? "syll" : "word";

  const word = await prisma.word.findUnique({
    where: { id },
    select: {
      audioWord: true,
      audioSyll: true,
      audioWordHuman: true,
      audioSyllHuman: true,
      audioVersion: true,
    },
  });
  if (!word) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const dataUrl =
    kind === "syll"
      ? (word.audioSyllHuman ?? word.audioSyll)
      : (word.audioWordHuman ?? word.audioWord);
  if (!dataUrl) return NextResponse.json({ error: "No audio" }, { status: 404 });

  const [header, base64] = dataUrl.split(",");
  if (!base64) return NextResponse.json({ error: "Bad audio" }, { status: 500 });
  const mime = header.match(/^data:([\w/.+-]+)/)?.[1] ?? "audio/mpeg";

  const etag = `"${createHash("sha1").update(base64).digest("hex").slice(0, 16)}"`;
  const cacheHeaders = {
    ETag: etag,
    // "no-cache" = may store, must revalidate before reuse.
    "Cache-Control": "private, no-cache, must-revalidate",
  };

  if (req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: cacheHeaders });
  }

  return new NextResponse(Buffer.from(base64, "base64"), {
    headers: { ...cacheHeaders, "Content-Type": mime },
  });
}
