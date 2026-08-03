import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSessionCookie } from "@/lib/auth";
import { checkLimit, recordFailure, clearFailures, clientKey } from "@/lib/rate-limit";

// Two tiers, both counting failures only:
//  - per account: stops someone guessing one child's password
//  - per address: stops spraying across many accounts, but set high enough
//    that a whole class behind one router is never affected
const PER_ACCOUNT_LIMIT = 8;
const PER_IP_LIMIT = 40;
const WINDOW_MS = 15 * 60 * 1000;

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please enter your email and password." }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();
  const ipKey = clientKey(req, "login-ip");
  const accountKey = `login-acct:${normalizedEmail}`;

  const tooManyForAccount = checkLimit(accountKey, PER_ACCOUNT_LIMIT);
  const tooManyForIp = checkLimit(ipKey, PER_IP_LIMIT);
  const blocked = !tooManyForAccount.allowed ? tooManyForAccount : !tooManyForIp.allowed ? tooManyForIp : null;
  if (blocked) {
    return NextResponse.json(
      { error: "Too many failed sign-in attempts. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(blocked.retryAfterSeconds) } }
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { learnerProfile: true },
  });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    recordFailure(accountKey, WINDOW_MS);
    recordFailure(ipKey, WINDOW_MS);
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  // A correct password clears the account's failures so one mistyped attempt
  // never counts against the next person to sign in.
  clearFailures(accountKey);

  await createSessionCookie({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as "LEARNER" | "SPECIALIST",
    learnerId: user.learnerProfile?.id ?? null,
  });

  return NextResponse.json({ role: user.role });
}
