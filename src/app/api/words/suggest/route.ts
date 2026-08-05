import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { suggestPseudowords } from "@/lib/pseudoword-gen";

/**
 * Candidate non-words for the decoding probe, for a specialist to screen.
 *
 *   GET /api/words/suggest?stage=4[&count=12]
 *
 * Nothing here is saved. The specialist keeps the ones that are genuinely not
 * words — in Tagalog, in Cebuano, and as local names — and adds those through
 * the ordinary word route. That human pass is the point: a generator cannot
 * tell "bimo" from "bata", and the difference decides whether the probe is
 * measuring decoding or memory.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "SPECIALIST") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const stage = Math.min(7, Math.max(1, Number(url.searchParams.get("stage")) || 4));
  const count = Math.min(24, Math.max(1, Number(url.searchParams.get("count")) || 12));

  // Every existing word, real and probe alike, so a suggestion can never
  // duplicate something already in the bank.
  const taken = new Set(
    (await prisma.word.findMany({ select: { text: true } })).map((w) => w.text.toLowerCase())
  );

  return NextResponse.json({ stage, candidates: suggestPseudowords(stage, taken, count) });
}
