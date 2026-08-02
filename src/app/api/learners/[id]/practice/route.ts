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

  await prisma.practiceItem.upsert({
    where: { learnerId_wordId: { learnerId, wordId: word.id } },
    create: { learnerId, wordId: word.id, source: "SPECIALIST", missCount: 0 },
    update: { source: "SPECIALIST", mastered: false, streak: 0 },
  });

  return NextResponse.json({ ok: true });
}
