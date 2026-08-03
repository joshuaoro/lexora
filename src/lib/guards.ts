import { redirect } from "next/navigation";
import { prisma } from "./db";
import { getSession, type SessionUser } from "./auth";
import type { LearnerProfileModel } from "@/generated/prisma/models";

/**
 * Guards for signed-in pages.
 *
 * A session cookie can outlive the record it points at: a specialist erases a
 * learner at the family's request, or the database is reseeded, while that
 * learner still has the app open. The cookie is valid and correctly signed —
 * the row is simply gone. Looking the profile up with findUniqueOrThrow would
 * then throw on every page and the learner would be stuck behind an error
 * screen until they cleared their cookies.
 *
 * So the profile is loaded here, once, and a missing one is treated as a
 * signed-out session. Returning it also spares each page its own lookup.
 */

export type LearnerContext = SessionUser & {
  learnerId: string;
  profile: LearnerProfileModel;
};

export async function requireLearner(): Promise<LearnerContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "LEARNER" || !session.learnerId) redirect("/specialist");

  const profile = await prisma.learnerProfile.findUnique({
    where: { id: session.learnerId },
  });
  // Stale cookie: signing in again issues a fresh one.
  if (!profile) redirect("/login?expired=1");

  return { ...session, learnerId: session.learnerId, profile };
}

/**
 * API counterpart of requireLearner. Routes cannot redirect, so a stale session
 * is reported as 401 and the client sends the visitor to sign in — the same
 * outcome, reached differently. Without this a stale cookie reached
 * findUniqueOrThrow and the route answered 500, which the exercise screen shows
 * as "we couldn't hear that clearly": a child mid-activity would keep retrying
 * a microphone that was never the problem.
 */
export async function getLearnerContext(): Promise<LearnerContext | null> {
  const session = await getSession();
  if (!session || session.role !== "LEARNER" || !session.learnerId) return null;

  const profile = await prisma.learnerProfile.findUnique({
    where: { id: session.learnerId },
  });
  if (!profile) return null;

  return { ...session, learnerId: session.learnerId, profile };
}

/** 401 body shared by the API routes, so the client can detect a dead session. */
export function sessionExpired() {
  return Response.json({ error: "session_expired" }, { status: 401 });
}

export async function requireSpecialist(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "SPECIALIST") redirect("/dashboard");

  // Same reasoning: the account may have been removed since sign-in.
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true },
  });
  if (!user) redirect("/login?expired=1");

  return session;
}
