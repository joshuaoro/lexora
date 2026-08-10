import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { TAG_IDS } from "@/lib/error-tags";

const schema = z.object({
  attemptId: z.string(),
  agrees: z.boolean(),
  note: z.string().max(300).optional(),
  /**
   * Was the machine's verdict hidden when this judgement was made?
   *
   * Sent by the client because only the client knows what was on screen. It is
   * a property of how the label was produced, not of the label, and it decides
   * whether this row can be used as independent evidence — so it is stored per
   * review rather than inferred later from a setting that may since have moved.
   */
  blind: z.boolean().optional(),
  /**
   * What the specialist heard, from the controlled vocabulary. Optional by
   * design: a blank is honest missing data, a forced choice is noise.
   */
  tags: z.array(z.string()).max(TAG_IDS.length).optional(),
});

/** A reading specialist confirms or disputes the system's scoring of an oral reading. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "SPECIALIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid review" }, { status: 400 });

  const attempt = await prisma.attempt.findUnique({ where: { id: parsed.data.attemptId } });
  if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });

  // Unknown tags are dropped rather than rejected: the vocabulary is a closed
  // set defined in one place, and a client sending something outside it is a
  // bug on our side, not a reason to lose the specialist's verdict.
  const tags = [...new Set((parsed.data.tags ?? []).filter((t) => TAG_IDS.includes(t)))];
  const blind = parsed.data.blind === true;

  const review = await prisma.attemptReview.upsert({
    where: { attemptId: attempt.id },
    create: {
      attemptId: attempt.id,
      specialistId: session.id,
      agrees: parsed.data.agrees,
      note: parsed.data.note ?? null,
      blind,
    },
    update: {
      specialistId: session.id,
      agrees: parsed.data.agrees,
      note: parsed.data.note ?? null,
      blind,
    },
  });

  // Tags are replaced wholesale so unticking a chip removes it. Only touched
  // when the client actually sent a `tags` field — a note-only save must not
  // wipe categories recorded a moment earlier.
  if (parsed.data.tags !== undefined) {
    await prisma.reviewErrorTag.deleteMany({ where: { reviewId: review.id } });
    if (tags.length) {
      await prisma.reviewErrorTag.createMany({
        data: tags.map((tag) => ({ reviewId: review.id, tag })),
      });
    }
  }

  return NextResponse.json({ id: review.id, agrees: review.agrees, blind: review.blind, tags });
}
