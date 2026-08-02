import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const MAX_AUDIO_BYTES = 600_000;

const schema = z.object({
  kind: z.enum(["word", "syll"]).default("word"),
  audio: z
    .string()
    .startsWith("data:audio", "Expected an audio recording")
    .max(MAX_AUDIO_BYTES, "Recording is too long"),
});

/**
 * A reading specialist saves their own voice for a word. Stored separately
 * from the generated clip, so it takes priority for every learner and can be
 * removed later without losing the synthesized pronunciation.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "SPECIALIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid recording" },
      { status: 400 }
    );
  }

  const word = await prisma.word.findUnique({ where: { id }, select: { id: true } });
  if (!word) return NextResponse.json({ error: "Word not found" }, { status: 404 });

  await prisma.word.update({
    where: { id },
    data: {
      ...(parsed.data.kind === "syll"
        ? { audioSyllHuman: parsed.data.audio }
        : { audioWordHuman: parsed.data.audio }),
      audioVersion: { increment: 1 },
    },
  });

  return NextResponse.json({ ok: true });
}

/** Remove the specialist recording; the generated clip takes over again. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "SPECIALIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const kindParam = new URL(req.url).searchParams.get("kind");

  const data =
    kindParam === "syll"
      ? { audioSyllHuman: null }
      : kindParam === "word"
        ? { audioWordHuman: null }
        : { audioWordHuman: null, audioSyllHuman: null }; // no kind = clear both

  const word = await prisma.word.findUnique({ where: { id }, select: { id: true } });
  if (!word) return NextResponse.json({ error: "Word not found" }, { status: 404 });

  await prisma.word.update({
    where: { id },
    data: { ...data, audioVersion: { increment: 1 } },
  });
  return NextResponse.json({ ok: true });
}
