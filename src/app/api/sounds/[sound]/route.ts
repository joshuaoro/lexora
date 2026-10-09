import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isLetterSound } from "@/lib/letter-sounds";

/**
 * A specialist's recording of one letter sound — /m/, /a/, /ng/.
 *   GET    /api/sounds/<sound>   any signed-in user; the recording
 *   PATCH  /api/sounds/<sound>   a specialist saves or replaces it
 *   DELETE /api/sounds/<sound>   a specialist removes it
 *
 * There is no generated fallback, by design: the neural voice says a lone
 * letter by its name, so a sound nobody has recorded is a sound the app does
 * not play, and the activities that need it wait (see src/lib/letter-sounds.ts).
 */

// A trimmed sound is well under a second of 16 kHz mono WAV — about 30 KB as
// base64. The ceiling is generous and still stops a stray minute-long take.
const MAX_AUDIO_CHARS = 300_000;

const schema = z.object({
  audio: z
    .string()
    .startsWith("data:audio/", "Expected an audio recording")
    .max(MAX_AUDIO_CHARS, "That recording is too long — record just the sound"),
});

async function soundParam(params: Promise<{ sound: string }>) {
  const { sound } = await params;
  const s = decodeURIComponent(sound).toLowerCase();
  return isLetterSound(s) ? s : null;
}

export async function GET(req: Request, { params }: { params: Promise<{ sound: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sound = await soundParam(params);
  if (!sound) return NextResponse.json({ error: "Unknown sound" }, { status: 404 });

  const row = await prisma.letterSound.findUnique({ where: { sound }, select: { audio: true } });
  if (!row) return NextResponse.json({ error: "Not recorded yet" }, { status: 404 });

  const [header, base64] = row.audio.split(",");
  if (!base64) return NextResponse.json({ error: "Bad audio" }, { status: 500 });
  const mime = header.match(/^data:([\w/.+-]+)/)?.[1] ?? "audio/wav";

  // Clients ask for ?v=<version>, so a re-record is a new URL; the ETag still
  // lets a revalidating cache skip the bytes.
  const etag = `"${createHash("sha1").update(base64).digest("hex").slice(0, 16)}"`;
  const headers = { ETag: etag, "Cache-Control": "private, no-cache, must-revalidate" };
  if (req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers });
  }
  return new NextResponse(Buffer.from(base64, "base64"), {
    headers: { ...headers, "Content-Type": mime },
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ sound: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "SPECIALIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sound = await soundParam(params);
  if (!sound) return NextResponse.json({ error: "Unknown sound" }, { status: 404 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid recording" },
      { status: 400 }
    );
  }

  const row = await prisma.letterSound.upsert({
    where: { sound },
    create: { sound, audio: parsed.data.audio },
    update: { audio: parsed.data.audio, version: { increment: 1 } },
    select: { version: true },
  });
  return NextResponse.json({ ok: true, version: row.version });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ sound: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "SPECIALIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sound = await soundParam(params);
  if (!sound) return NextResponse.json({ error: "Unknown sound" }, { status: 404 });

  await prisma.letterSound.deleteMany({ where: { sound } });
  return NextResponse.json({ ok: true });
}
