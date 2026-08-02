import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const schema = z.object({
  attemptId: z.string(),
  agrees: z.boolean(),
  note: z.string().max(300).optional(),
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

  const review = await prisma.attemptReview.upsert({
    where: { attemptId: attempt.id },
    create: {
      attemptId: attempt.id,
      specialistId: session.id,
      agrees: parsed.data.agrees,
      note: parsed.data.note ?? null,
    },
    update: {
      specialistId: session.id,
      agrees: parsed.data.agrees,
      note: parsed.data.note ?? null,
    },
  });

  return NextResponse.json({ id: review.id, agrees: review.agrees });
}
