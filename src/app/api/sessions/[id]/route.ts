import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const schema = z.object({
  total: z.number().int().min(0),
  correct: z.number().int().min(0),
  durationMs: z.number().int().min(0),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.learnerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const existing = await prisma.activitySession.findUnique({ where: { id } });
  if (!existing || existing.learnerId !== session.learnerId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.activitySession.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ ok: true, id: updated.id });
}
