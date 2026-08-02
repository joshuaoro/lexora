import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const schema = z.object({
  // Comma-separated spellings the ASR may return for a correct reading.
  variants: z.string().max(200).regex(/^[a-zA-Z\s,ñÑ-]*$/, "Letters and commas only"),
});

/** Specialist edits a word's accepted ASR spellings. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "SPECIALIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  // Normalize to "a, b, c"
  const variants = parsed.data.variants
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
    .join(", ");

  const word = await prisma.word.findUnique({ where: { id }, select: { id: true } });
  if (!word) return NextResponse.json({ error: "Word not found" }, { status: 404 });

  await prisma.word.update({ where: { id }, data: { variants } });
  return NextResponse.json({ ok: true, variants });
}
