import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getLearnerContext, sessionExpired } from "@/lib/guards";
import { parseSettings } from "@/lib/settings";

const schema = z.object({
  font: z.enum(["lexend", "atkinson", "comic", "system"]).optional(),
  fontSize: z.number().min(18).max(56).optional(),
  letterSpacing: z.number().min(0).max(0.35).optional(),
  wordSpacing: z.number().min(0).max(0.6).optional(),
  lineHeight: z.number().min(1.2).max(2.6).optional(),
  overlay: z.enum(["none", "cream", "yellow", "blue", "green", "pink"]).optional(),
  ruler: z.boolean().optional(),
  ttsRate: z.number().min(0.5).max(1.2).optional(),
});

export async function GET() {
  const ctx = await getLearnerContext();
  if (!ctx) return sessionExpired();
  return NextResponse.json(parseSettings(ctx.profile.settings));
}

export async function PATCH(req: Request) {
  const ctx = await getLearnerContext();
  if (!ctx) return sessionExpired();

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid settings" }, { status: 400 });

  const merged = { ...parseSettings(ctx.profile.settings), ...parsed.data };
  await prisma.learnerProfile.update({
    where: { id: ctx.learnerId },
    data: { settings: JSON.stringify(merged) },
  });
  return NextResponse.json(merged);
}
