import { redirect } from "next/navigation";
import { getSession, type SessionUser } from "./auth";

export async function requireLearner(): Promise<SessionUser & { learnerId: string }> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "LEARNER" || !session.learnerId) redirect("/specialist");
  return session as SessionUser & { learnerId: string };
}

export async function requireSpecialist(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "SPECIALIST") redirect("/dashboard");
  return session;
}
