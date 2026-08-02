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
  const existing = await prisma.word.findUnique({ where: { text } });
  if (existing) return NextResponse.json({ error: "That word already exists." }, { status: 409 });

  const word = await prisma.word.create({
    data: { ...parsed.data, text, meaningEn: parsed.data.meaningEn || null },
  });

  return NextResponse.json(word, { status: 201 });
}
