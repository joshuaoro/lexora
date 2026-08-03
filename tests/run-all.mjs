/**
 * Runs every LEXORA audit suite in order and reports a combined result.
 *
 *   npm run audit                        # against http://localhost:3000
 *   npm run audit -- https://app.url     # against a deployment
 *
 * The target must be running and its database seeded.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const base = process.argv[2] ?? "http://localhost:3000";

const SUITES = [
  ["API (authorization, validation, erasure)", "api-audit.mjs"],
  ["Logic (scoring, adaptive, mastery, review)", "logic-audit.mjs"],
  ["UI (journeys, specialist, responsive)", "ui-audit.mjs"],
  ["Links (every route reachable from the navigation)", "links-audit.mjs"],
  ["Stale sessions (a record erased mid-session)", "stale-session-audit.mjs"],
  ["Reporting (decoding time, calibration, cleanup)", "reporting-audit.mjs"],
  ["Accessibility (WCAG 2.1 AA, keyboard, reduced motion)", "a11y-audit.mjs"],
];

function run(file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(here, file), base], {
      stdio: "inherit",
      env: { ...process.env, AUDIT_BASE_URL: base },
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

const failures = [];
for (const [label, file] of SUITES) {
  console.log(`\n${"=".repeat(70)}\n${label}\n${"=".repeat(70)}`);
  const code = await run(file);
  if (code !== 0) failures.push(label);
}

console.log(`\n${"=".repeat(70)}`);
if (failures.length === 0) {
  console.log(`All ${SUITES.length} audit suites passed against ${base}.`);
} else {
  console.log(`FAILED suites against ${base}:\n` + failures.map((f) => "  - " + f).join("\n"));
  process.exitCode = 1;
}
