import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const schema = z.object({
  text: z.string().min(1).max(30).regex(/^[a-zA-ZñÑ-]+$/, "Letters only, no spaces."),
  syllables: z.string().min(1).max(40),
  pattern: z.string().min(1).max(20),
  stage: z.number().int().min(1).max(7),
  level: z.number().int().min(1).max(5),
  meaningEn: z.string().max(60).optional(),
  /** Add this as a decoding-probe non-word rather than an instructional word. */
  isPseudo: z.boolean().optional(),
});

/** Specialists curate the instructional word bank. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "SPECIALIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid word" },
      { status: 400 }
    );
  }

  const text = parsed.data.text.toLowerCase();
  const isPseudo = parsed.data.isPseudo === true;

  const existing = await prisma.word.findUnique({
    where: { text },
    select: { isPseudo: true },
  });
  if (existing) {
    // Worth distinguishing. Adding a probe word that already exists as a real
    // one is not a duplicate-entry annoyance — it is the mistake that makes the
    // probe measure recall instead of decoding, and it would be invisible
    // afterwards, so it is named plainly here rather than at the seam.
    return NextResponse.json(
      {
        error:
          isPseudo && !existing.isPseudo
            ? `“${text}” is already a real word in the bank, so it cannot be used as a probe non-word.`
            : "That word already exists.",
      },
      { status: 409 }
    );
  }

  const word = await prisma.word.create({
    data: {
      ...parsed.data,
      text,
      isPseudo,
      // A probe word has no meaning to gloss, and giving it one would invite
      // someone to teach it.
      meaningEn: isPseudo ? null : parsed.data.meaningEn || null,
    },
  });

  return NextResponse.json(word, { status: 201 });
}
