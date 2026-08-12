/**
 * Is a value readable anywhere in this repository — including its history?
 *
 * Shared by `check-secrets.ts`, which asks it of the credentials currently in
 * use, and `set-password.ts`, which refuses to install a password it finds.
 *
 * The history pass is the whole point. A secret deleted in the latest commit is
 * still readable in the one before it, and this repository is public and may
 * already be cloned or forked, so "removed from the working tree" is not a
 * remedy for anything. Rotation is the remedy; this is how a rotation is checked
 * for having actually rotated somewhere safe.
 */
import { execFileSync } from "node:child_process";

/**
 * Run git and return its stdout, treating "found nothing" as a result.
 *
 * `git grep` exits 1 when it matches nothing, which execFileSync raises as an
 * exception. That has to be handled per call rather than around the whole
 * search: letting it propagate past the *first* grep skips the second one
 * entirely and reports a value as clean because it was absent from the working
 * tree — while it sat in history, which is the only case this module exists
 * for. That was a real bug here before the handling moved inside.
 */
function git(args: string[]): string {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 32 * 1024 * 1024,
    }).trim();
  } catch (err) {
    if ((err as { status?: number }).status === 1) return ""; // matched nothing
    throw err;
  }
}

export type RepoHit = "tree" | "history" | null;

/**
 * Search the working tree, then every commit.
 *
 * All three outcomes were checked against known values rather than assumed: a
 * string still in the checkout returns "tree", a string deleted by commit
 * d60d070 returns "history", and an invented one returns null.
 */
export function appearsInRepo(value: string): RepoHit {
  if (git(["grep", "-I", "-l", "-F", value])) return "tree";

  const revs = git(["rev-list", "--all"]).split("\n").filter(Boolean);
  if (revs.length === 0) return null;

  return git(["grep", "-I", "-l", "-F", value, ...revs]) ? "history" : null;
}

/** Human-readable reason, for a message that must not quote the value itself. */
export function describeHit(where: RepoHit): string {
  if (where === "tree") return "it is in a tracked file in this repository";
  if (where === "history") return "it is readable in this repository's git history";
  return "";
}
