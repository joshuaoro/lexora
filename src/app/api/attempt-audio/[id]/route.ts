import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

/**
 * Streams one recorded reading, for a specialist replaying it.
 *
 * The learner page used to carry these inside the page itself. A recording is
 * around 60KB of base64 and the page shows up to sixty-five of them, so opening
 * a learner meant waiting on several megabytes before anything appeared — and
 * the great majority were never played. They are fetched on demand instead, the
 * way word clips always have been.
 *
 * Specialist-only: these are children's voices.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (session?.role !== "SPECIALIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const attempt = await prisma.attempt.findUnique({
    where: { id },
    select: { audio: true },
  });
  if (!attempt?.audio) return NextResponse.json({ error: "No recording" }, { status: 404 });

  const [header, base64] = attempt.audio.split(",");
  if (!base64) return NextResponse.json({ error: "Bad audio" }, { status: 500 });
  const mime = header.match(/^data:([\w/.+-]+)/)?.[1] ?? "audio/webm";

  const etag = `"${createHash("sha1").update(base64).digest("hex").slice(0, 16)}"`;
  const headers = {
    ETag: etag,
    // A recording never changes once made, but it can be erased for data
    // protection — so revalidate rather than cache outright.
    "Cache-Control": "private, no-cache, must-revalidate",
  };

  if (req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers });
  }

  return new NextResponse(Buffer.from(base64, "base64"), {
    headers: { ...headers, "Content-Type": mime },
  });
}
