import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSessionCookie } from "@/lib/auth";
import { rateLimit, clientKey } from "@/lib/rate-limit";

// Specialist accounts require the partner-institution access code so that
// learner data is only visible to authorized reading specialists. There is no
// default: an unset code disables specialist registration entirely, rather
// than falling back to a value published in the repository.
const SPECIALIST_CODE = process.env.SPECIALIST_CODE ?? "";

const schema = z.object({
  name: z.string().min(1).max(60),
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters."),
  role: z.enum(["LEARNER", "SPECIALIST"]),
  code: z.string().optional(),
});

export async function POST(req: Request) {
  // Also throttled: registration is where the specialist code could be guessed.
  const limit = rateLimit(clientKey(req, "register"), 10, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a few minutes and try again." },
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
      return NextResponse.json(
        { error: "Specialist registration is disabled. Contact the system administrator." },
        { status: 403 }
      );
    }
    if (code !== SPECIALIST_CODE) {
      return NextResponse.json(
        { error: "Invalid specialist access code. Ask your institution administrator." },
        { status: 403 }
      );
    }
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
