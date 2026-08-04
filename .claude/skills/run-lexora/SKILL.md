---
name: run-lexora
description: Build, run, screenshot and drive LEXORA, the Filipino dyslexia reading app (Next.js 16 + Prisma + Supabase Postgres). Use when asked to run, start, serve, build, test, screenshot, or interact with LEXORA, or to verify a change end to end in the running app rather than in tests.
---

# Running LEXORA

Next.js 16 App Router, Prisma 7 on Supabase Postgres, driven headlessly through
Microsoft Edge via `playwright-core`. Paths below are relative to the repo root.

**The agent path is `driver.mjs`** — it builds if needed, starts the server,
signs in, walks the real screens, and writes screenshots. Reach for that before
`npm run start`, which just opens a port and leaves you nothing to click with.

Verified on Windows 11, PowerShell 5.1 + Git Bash, Node v24.11.1, npm 11.6.2,
`playwright-core` 1.62.1. Not verified on Linux or macOS.

## Prerequisites

- **Node 24** (`node -v` → `v24.11.1` here).
- **Microsoft Edge**, already installed at the default Windows location.
  `playwright-core` ships no browser; every harness here uses
  `channel: "msedge"`. There is no `chromium-cli` in this environment.
- **A Postgres connection string.** LEXORA has no local database — `src/lib/db.ts`
  throws `DATABASE_URL is not set` at import. Copy `.env.example` to `.env` and
  fill in `DATABASE_URL` (Supabase transaction pooler, 6543) and `DIRECT_URL`
  (session pooler, 5432). Without them nothing runs; there is no offline mode.
- `GROQ_API_KEY` is optional — scoring falls back to the browser recognizer, and
  the driver's flows work without it.

```bash
npm install
npx prisma generate
```

## Run: the driver (agent path)

```bash
node .claude/skills/run-lexora/driver.mjs
```

Builds if `.next/BUILD_ID` is absent, serves on **:3100** (not 3000, so it never
fights a dev server), runs every flow, stops the server, exits non-zero if a
check fails. Took ~4 minutes here with a warm build.

```
17/17 checks passed · 10 screenshots in screenshots/
```

| Flag | Effect |
|---|---|
| `--flow <name>` | One flow: `dashboard`, `exercise`, `reader`, `specialist`, `offline` |
| `--url <origin>` | Drive something already running; skips build and server |
| `--headed` | Watch it in a real window |

```bash
node .claude/skills/run-lexora/driver.mjs --flow specialist
node .claude/skills/run-lexora/driver.mjs --url https://lexora-snowy-six.vercel.app
```

Screenshots land in `screenshots/` (gitignored — they show learner names and
reading records). **Open them.** A green run with a blank PNG is a failed run.

The `offline` flow is the one worth knowing about: it drops the connection
mid-word with `context.setOffline(true)` and asserts the child is told, the
controls stay live, and the exercise resumes on reconnect. That path had a bug
that froze the app permanently, and nothing in the unit tests could see it.

## Run: a plain server (human path)

```bash
$env:PORT=3100; npm run start     # PowerShell; needs an existing build
```

Sign in at `/login` with `learner1@lexora.ph` / `lexora123` (specialist:
`specialist@lexora.ph`). Useless without a browser to click in — prefer the
driver.

## Test

```bash
npm run audit                                     # 8 suites against localhost:3000
npm run audit -- https://lexora-snowy-six.vercel.app
npm run audit:prod -- <url>                       # post-deploy smoke
```

**The audits write to the database in `.env`.** They register and delete
`@lexora.test` accounts. Against a study database that is real traffic — point
them at a scratch database if that matters.

Individual suites: `audit:api`, `audit:logic`, `audit:ui`, `audit:links`,
`audit:stale`, `audit:reporting`, `audit:integrity`, `audit:a11y`, `audit:perf`.

## Gotchas

- **`spawn EINVAL` when launching npm.** Node 20+ refuses to spawn `.cmd`
  without `shell: true` (CVE-2024-27980). On Windows the shell is mandatory,
  which causes the next one:
- **A killed server keeps the port.** `npm run start` spawns `next start` as a
  grandchild behind `cmd.exe`; `child.kill()` signals only the shim. The symptom
  is nasty — the next run silently drives the *previous* build and reports
  success for code that was never loaded. `driver.mjs` uses
  `taskkill /pid <pid> /T /F`. If a run dies hard:
  `Get-Process node | Stop-Process -Force`.
- **`| Select-Object -Last N` in PowerShell buffers everything** until the
  command exits, so a long run looks hung and you lose the output if it is
  killed. Use `... *>&1 | Tee-Object -FilePath "$env:TEMP\log.txt"` and tail it.
- **Playwright strict mode.** `text=Scoring reliability check` matches both the
  heading and the data-protection paragraph that mentions it. Use
  `getByRole("heading", { name: … })`.
- **Guard redirects arrive inside an HTTP 200.** The app layout is async, so
  Next.js has begun streaming before a guard redirects and emits a client-side
  redirect instead of a 3xx. Asserting on status codes passes a broken app —
  assert on `page.url()` in a browser.
- **Never assert after a fixed sleep.** A sleep tuned on localhost expires
  before the deployment has responded, and an assertion that runs early can pass
  for the wrong reason. Wait for the condition. `tests/helpers.mjs` exports
  `until()` for state with no on-screen signal, such as a keepalive flush.
- **The microphone is faked.** The driver passes
  `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream` and grants
  the permission. The device emits silence, which scores as "no response" — a
  miss, which is enough to reach the feedback and corrective re-read.
- **`/.claude/skills/` is gitignored** (Prisma drops vendored skills there). The
  pattern is `/*` plus a negation for `run-lexora/`, because git cannot
  re-include anything inside a directory excluded outright.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `DATABASE_URL is not set` | No `.env`. There is no local fallback — fill in the Supabase URLs, or use `--url` against a deployment. |
| `Could not sign in as learner1@lexora.ph (HTTP 401)` | Database not seeded: `npx prisma db seed`. |
| `Server never came up on http://localhost:3100` | Usually a bad `DATABASE_URL`; the driver prints the server's last output. |
| `EADDRINUSE :::3100` | Orphaned server from a hard-killed run. `Get-Process node \| Stop-Process -Force`. |
| `spawn EINVAL` | Spawning `npm.cmd` without `shell: true` on Windows. |
| `strict mode violation: resolved to 2 elements` | Text selector matched twice; switch to a role selector. |
| Prisma types missing after a schema change | `npx prisma generate` — `migrate dev` does not always refresh the client. |
