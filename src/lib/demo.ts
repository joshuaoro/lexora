/**
 * Keeping demonstration accounts out of the study's numbers.
 *
 * The two seeded learners carry a fortnight of invented reading history —
 * `mutate()` in prisma/seed.ts fabricates misreadings by swapping b↔d, p→b,
 * m↔n, u→o and e→i, which is very nearly the canonical dyslexia error profile.
 * Aggregated together with real participants it does not look like noise. It
 * looks like a finding, and it would survive into a cohort chart, an error
 * distribution, and a CSV handed to a statistician.
 *
 * So exclusion is the default everywhere that sums across learners, and seeing
 * the demo data takes an explicit act: a query parameter on an export, a toggle
 * in the dashboard. Never a default, and never silent — anything that includes
 * them has to say so on screen.
 *
 * A learner's own dashboard and report are untouched. This is about
 * aggregation; the demo accounts are supposed to work when demonstrated.
 */

/** `where` fragment for querying LearnerProfile directly. */
export function learnerScope(includeDemo: boolean) {
  return includeDemo ? {} : { isDemo: false };
}

/**
 * `where` fragment for any table that belongs to a learner — Attempt,
 * ActivitySession, PracticeItem. They all name the relation `learner`.
 */
export function viaLearnerScope(includeDemo: boolean) {
  return includeDemo ? {} : { learner: { isDemo: false } };
}

/** Read the opt-in from a request URL. Anything but "true" means excluded. */
export function includeDemoFrom(url: URL): boolean {
  return url.searchParams.get("includeDemo") === "true";
}

/** Read the opt-in from a Next.js page searchParams bag. */
export function includeDemoFromParams(
  params: Record<string, string | string[] | undefined> | undefined
): boolean {
  const raw = params?.demo;
  return (Array.isArray(raw) ? raw[0] : raw) === "1";
}
