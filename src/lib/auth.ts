import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";

/**
 * Session signing key. There is deliberately no fallback value: a hardcoded
 * default shipped in the source would let anyone forge a session cookie and
 * read every learner's records. A misconfigured deployment must fail loudly
 * instead of silently accepting forged sessions.
 */
function sessionSecret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "AUTH_SECRET is missing or too short. Set a long random value before deploying."
      );
    }
    // Development convenience only — never reached in a production build.
    console.warn("AUTH_SECRET is not set; using an insecure development key.");
    return new TextEncoder().encode("lexora-insecure-development-key-only");
  }
  return new TextEncoder().encode(value);
}

const secret = sessionSecret();

const COOKIE_NAME = "lexora_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "LEARNER" | "SPECIALIST";
  learnerId: string | null; // LearnerProfile.id when role is LEARNER
};

export async function createSessionCookie(user: SessionUser) {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret);

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function destroySessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Read and verify the session JWT. Cached per request. */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      id: payload.id as string,
      email: payload.email as string,
      name: payload.name as string,
      role: payload.role as "LEARNER" | "SPECIALIST",
      learnerId: (payload.learnerId as string | null) ?? null,
    };
  } catch {
    return null;
  }
});
