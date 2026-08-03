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
