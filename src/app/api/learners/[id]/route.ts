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

/**
 * Right to erasure (RA 10173 / Data Privacy Act): permanently remove a learner
 * and everything recorded about them. Deleting the user cascades to the
 * profile, attempts (and their audio), sessions, practice items and reviews.
 *
 * Requires the learner's name as confirmation so a mis-click cannot destroy a
 * participant's data mid-study.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "SPECIALIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const confirm = typeof body?.confirmName === "string" ? body.confirmName.trim() : "";

  const profile = await prisma.learnerProfile.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!profile) return NextResponse.json({ error: "Learner not found" }, { status: 404 });

  if (confirm.toLowerCase() !== profile.user.name.trim().toLowerCase()) {
    return NextResponse.json(
      { error: `Type the learner's name (${profile.user.name}) to confirm deletion.` },
      { status: 400 }
    );
  }

  await prisma.user.delete({ where: { id: profile.user.id } });
  return NextResponse.json({ ok: true, deleted: profile.user.name });
}
