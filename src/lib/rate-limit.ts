/**
 * Minimal fixed-window rate limiter for authentication endpoints.
 *
 * Only *failed* attempts are counted. Everyone at the partner institution
 * shares one public IP, so counting successes would let a class of children
 * signing in one after another lock each other out.
 *
 * In-memory by design: LEXORA runs as a single small instance for one
 * institution, so a shared store would be more moving parts than the threat
 * warrants. A multi-instance deployment would need Redis or a database table,
 * since each instance would otherwise keep its own counter.
 */

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();
const MAX_ENTRIES = 5000; // bound memory against spoofed-IP floods

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

/** Read-only check: is this key currently locked out? */
export function checkLimit(key: string, limit: number): RateLimitResult {
  const now = Date.now();
  const existing = windows.get(key);
  if (!existing || now >= existing.resetAt) return { allowed: true, retryAfterSeconds: 0 };
  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Record one failed attempt against a key. */
export function recordFailure(key: string, windowMs: number): void {
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || now >= existing.resetAt) {
    if (windows.size >= MAX_ENTRIES) {
      // Cheap eviction: drop anything already expired, else clear the map.
      for (const [k, w] of windows) if (now >= w.resetAt) windows.delete(k);
      if (windows.size >= MAX_ENTRIES) windows.clear();
    }
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  existing.count += 1;
}

/** Clear a key's failures after a success, so legitimate use is never punished. */
export function clearFailures(key: string): void {
  windows.delete(key);
}

/** Best-effort client identity behind Vercel's proxy. */
export function clientKey(req: Request, scope: string): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || req.headers.get("x-real-ip") || "unknown";
  return `${scope}:${ip}`;
}
