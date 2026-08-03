import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

/**
 * Tag a completed session's place in the study timeline.
 *
 * Specialist-only, and deliberately retroactive: which sessions count as the
 * baseline is a decision made by the researcher, often after the fact once the
 * child has settled into the tool. Inferring it from timestamps instead would
 * bake an assumption into the data that the paper then has to defend.
 */
const schema = z.object({
  phase: z.enum(["BASELINE", "REGULAR", "ENDLINE"]),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (session?.role !== "SPECIALIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid phase" }, { status: 400 });

  const existing = await prisma.activitySession.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.activitySession.update({
    where: { id },
    data: { phase: parsed.data.phase },
  });
  return NextResponse.json({ ok: true, id: updated.id, phase: updated.phase });
}
