/**
 * Recording-format check for the speech recognition path.
 *
 *   npm run asr:check
 *
 * A recording the server cannot parse is never sent to the recognizer, and
 * nothing on screen says why — the child is simply told they could not be
 * heard. Each browser writes the recording's media type its own way, so each
 * one the study supports is asserted here exactly as that browser writes it.
 * No network, no database: this runs anywhere.
 */
import { parseAudioDataUrl } from "../src/lib/asr";

let failures = 0;

function check(name: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failures++;
}

const body = Buffer.from("x".repeat(1200)).toString("base64");

console.log("Recording-format check\n");
console.log("[1] each supported browser's recording is understood");
for (const [browser, type, mime] of [
  ["Chrome / Edge", "audio/webm;codecs=opus", "audio/webm"],
  ["Safari (iPad)", "audio/mp4;codecs=mp4a.40.2", "audio/mp4"],
  ["Firefox", "audio/ogg; codecs=opus", "audio/ogg"],
  ["no parameters", "audio/webm", "audio/webm"],
] as const) {
  const parsed = parseAudioDataUrl(`data:${type};base64,${body}`);
  check(
    `${browser}: ${type}`,
    parsed?.mime === mime && parsed.bytes.length === 1200,
    parsed ? `${parsed.mime}, ${parsed.bytes.length} bytes` : "not parsed"
  );
}

console.log("\n[2] anything that is not a recording is refused");
for (const [what, url] of [
  ["an image", `data:image/png;base64,${body}`],
  ["no base64 marker", `data:audio/webm,${body}`],
  ["not a data URL", "https://example.com/reading.webm"],
] as const) {
  check(`${what} is refused`, parseAudioDataUrl(url) === null);
}

console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);
