import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const schema = z.object({
  level: z.number().int().min(1).max(5),
});

/** Specialist override of a learner's adaptive difficulty level. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "SPECIALIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid level" }, { status: 400 });

  const profile = await prisma.learnerProfile.findUnique({ where: { id } });
  if (!profile) return NextResponse.json({ error: "Learner not found" }, { status: 404 });

  const level = parsed.data.level;
  const stage = Math.max(profile.stage, Math.min(7, level + 2));
  await prisma.learnerProfile.update({ where: { id }, data: { level, stage } });

  return NextResponse.json({ ok: true, level, stage });
}
