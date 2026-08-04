/**
 * fetch that reports a dropped connection instead of throwing.
 *
 * A rejected fetch inside an async click handler is not merely an unhandled
 * error: the rest of the handler never runs, so whatever "busy" flag it set is
 * never cleared. In the exercise screen that left a child looking at
 * "Checking…" with every control disabled, no message, and no recovery when the
 * connection came back — the only way out was a page reload, which a seven-year
 * old will not think to do and which loses the session.
 *
 * The study runs on school wifi and tablets, so a dropped request is an
 * expected condition rather than an exceptional one. Callers get `null` and are
 * expected to say so and let the learner try again.
 */
export async function tryFetch(
  input: string,
  init?: RequestInit
): Promise<Response | null> {
  try {
    return await fetch(input, init);
  } catch {
    // Network unreachable, DNS failure, request aborted mid-flight.
    return null;
  }
}

/** True when the browser knows it is offline. Absence of proof, not proof of a link. */
export function looksOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}
