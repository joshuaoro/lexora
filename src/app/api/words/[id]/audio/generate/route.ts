import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { synthesizeWord } from "@/lib/word-tts";

// Synthesis streams over a WebSocket to Microsoft's voice service, making this
// the slowest route. 60s is the Vercel Hobby ceiling.
export const maxDuration = 60;

/**
 * Generate the neural Filipino pronunciation clips for one word on demand,
 * so a specialist who adds a word to the bank can give it audio immediately
 * instead of running the bulk script from a terminal.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "SPECIALIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const word = await prisma.word.findUnique({
    where: { id },
    select: { id: true, text: true, syllables: true },
  });
  if (!word) return NextResponse.json({ error: "Word not found" }, { status: 404 });

  try {
    const { audioWord, audioSyll } = await synthesizeWord(word.text, word.syllables);
    await prisma.word.update({
      where: { id },
      data: { audioWord, audioSyll, audioVersion: { increment: 1 } },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Word audio generation failed:", err);
    return NextResponse.json(
      { error: "Could not generate audio. Check the internet connection and try again." },
      { status: 502 }
    );
  }
}
