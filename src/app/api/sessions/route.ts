import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const schema = z.object({
  type: z.enum(["READ_ALOUD", "LISTEN_CHOOSE", "SYLLABLES", "RHYME", "PRACTICE", "READER"]),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.learnerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid type" }, { status: 400 });

  const profile = await prisma.learnerProfile.findUniqueOrThrow({
    where: { id: session.learnerId },
  });

  const activity = await prisma.activitySession.create({
    data: {
      learnerId: session.learnerId,
      type: parsed.data.type,
      levelAtTime: profile.level,
    },
  });

  return NextResponse.json({ id: activity.id }, { status: 201 });
}
