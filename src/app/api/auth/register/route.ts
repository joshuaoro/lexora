import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSessionCookie } from "@/lib/auth";
import { checkLimit, recordFailure, clientKey } from "@/lib/rate-limit";

// Failures only: the risk is someone guessing the specialist access code, not
// a school legitimately enrolling several learners in one sitting.
const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;

// Specialist accounts require the partner-institution access code so that
// learner data is only visible to authorized reading specialists. There is no
// default: an unset code disables specialist registration entirely, rather
// than falling back to a value published in the repository.
const SPECIALIST_CODE = process.env.SPECIALIST_CODE ?? "";

/**
 * Optional: the code the reading centre gives out to enrol a child.
 *
 * Learner registration was open to anyone with the URL, and the study runs on a
 * public deployment. A stranger's account is not a demo account, so it would
 * sit in the specialists' list, the cohort view and every export as if it were
 * a participant. Worse, the speech-synthesis ceiling is per account, and
 * accounts were free — so the ceiling that keeps a script from filling the
 * database could be stepped around by registering again.
 *
 * Unset, registration stays open, which keeps a local setup and the audit suite
 * working with no configuration. Set it on the deployment before enrolment.
 */
const ENROLMENT_CODE = process.env.ENROLMENT_CODE ?? "";

const schema = z.object({
  name: z.string().min(1).max(60),
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters."),
  role: z.enum(["LEARNER", "SPECIALIST"]),
  code: z.string().optional(),
});

export async function POST(req: Request) {
  const limitKey = clientKey(req, "register");
  const limit = checkLimit(limitKey, MAX_FAILURES);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many failed attempts. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Please check the form.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { name, email, password, role, code } = parsed.data;

  if (role === "SPECIALIST") {
    // An unset server code must never match a blank submitted code.
    if (!SPECIALIST_CODE) {
      recordFailure(limitKey, WINDOW_MS);
      return NextResponse.json(
        { error: "Specialist registration is disabled. Contact the system administrator." },
        { status: 403 }
      );
    }
    if (code !== SPECIALIST_CODE) {
      recordFailure(limitKey, WINDOW_MS);
      return NextResponse.json(
        { error: "Invalid specialist access code. Ask your institution administrator." },
        { status: 403 }
      );
    }
  }

  if (role === "LEARNER" && ENROLMENT_CODE && code !== ENROLMENT_CODE) {
    recordFailure(limitKey, WINDOW_MS);
    return NextResponse.json(
      { error: "An enrolment code from the reading centre is needed to create a learner account." },
      { status: 403 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return NextResponse.json({ error: "That email is already registered." }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      password: await bcrypt.hash(password, 10),
      role,
      ...(role === "LEARNER" ? { learnerProfile: { create: {} } } : {}),
    },
    include: { learnerProfile: true },
  });

  await createSessionCookie({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as "LEARNER" | "SPECIALIST",
    learnerId: user.learnerProfile?.id ?? null,
  });

  return NextResponse.json({ role: user.role }, { status: 201 });
}
