import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const schema = z.object({ wordId: z.string() });

/** Specialist pins a word onto a learner's practice list. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "SPECIALIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: learnerId } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid word" }, { status: 400 });

  const [profile, word] = await Promise.all([
    prisma.learnerProfile.findUnique({ where: { id: learnerId } }),
    prisma.word.findUnique({ where: { id: parsed.data.wordId } }),
  ]);
  if (!profile || !word) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The practice list teaches its words, and a probe non-word that has been
  // taught measures recall, not decoding. Refused rather than silently dropped,
  // so the specialist knows why it did not appear.
  if (word.isPseudo) {
    return NextResponse.json(
      { error: `“${word.text}” is a decoding-probe word and cannot be practised.` },
      { status: 409 }
    );
  }

  await prisma.practiceItem.upsert({
    where: { learnerId_wordId: { learnerId, wordId: word.id } },
    create: { learnerId, wordId: word.id, source: "SPECIALIST", missCount: 0 },
    update: { source: "SPECIALIST", mastered: false, streak: 0 },
  });

  return NextResponse.json({ ok: true });
}

/**
 * Specialist unpins a word they pinned.
 *
 * Only a pinned word comes off. The generated words are the list the
 * specialist verifies against the child's frequent misreads (Objective 3,
 * instrument 06 Part B); removing them would change the thing being verified.
 * A generated word that was later pinned keeps its misses, so unpinning puts
 * it back on the generated list rather than off the list.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "SPECIALIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: learnerId } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid word" }, { status: 400 });

  const item = await prisma.practiceItem.findUnique({
    where: { learnerId_wordId: { learnerId, wordId: parsed.data.wordId } },
    select: { id: true, source: true, missCount: true },
  });
  if (!item) return NextResponse.json({ error: "Not on the list" }, { status: 404 });
  if (item.source !== "SPECIALIST") {
    return NextResponse.json(
      { error: "Only a pinned word can be unpinned; generated words stay for verification." },
      { status: 409 }
    );
  }

  // The *Many forms, so a second click that arrives after the first has landed
  // does nothing rather than throw.
  if (item.missCount > 0) {
    await prisma.practiceItem.updateMany({ where: { id: item.id }, data: { source: "AUTO" } });
  } else {
    await prisma.practiceItem.deleteMany({ where: { id: item.id } });
  }
  return NextResponse.json({ ok: true });
}
