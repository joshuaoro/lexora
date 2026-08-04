"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, X, AlertTriangle, Mic, Loader2 } from "lucide-react";
import { tryFetch } from "@/lib/net";

type Verdict = "pass" | "warn" | "fail" | "pending";

type Row = { label: string; verdict: Verdict; detail: string };

const ICON: Record<Verdict, React.ReactNode> = {
  pass: <Check size={18} className="text-green" />,
  warn: <AlertTriangle size={18} className="text-orange" />,
  fail: <X size={18} className="text-red" />,
  pending: <Loader2 size={18} className="animate-spin text-ink-muted" />,
};

const TONE: Record<Verdict, string> = {
  pass: "bg-green-soft",
  warn: "bg-orange-soft",
  fail: "bg-red-soft",
  pending: "bg-cream",
};

const RECORD_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

/**
 * Everything the page reports about this device, as one JSON string.
 *
 * A string rather than an object because useSyncExternalStore compares
 * snapshots by identity — returning a fresh object each read would spin. Voices
 * arrive asynchronously on most browsers, which is what the subscription is
 * for: on a tablet the list is usually empty on first read and fills in a
 * moment later, and "no Filipino voice" is precisely the wrong thing to report
 * early.
 */
function envSnapshot(): string {
  if (typeof window === "undefined") return "";
  const tts = "speechSynthesis" in window;
  const hasRec = typeof MediaRecorder !== "undefined";
  return JSON.stringify({
    ua: navigator.userAgent,
    secure: window.isSecureContext,
    origin: location.origin,
    gum: Boolean(navigator.mediaDevices?.getUserMedia),
    rec: hasRec,
    types: hasRec ? RECORD_TYPES.filter((t) => MediaRecorder.isTypeSupported(t)) : [],
    tts,
    speechRec: "SpeechRecognition" in window || "webkitSpeechRecognition" in window,
    voices: tts
      ? window.speechSynthesis.getVoices().map((v) => ({ name: v.name, lang: v.lang }))
      : [],
  });
}

function subscribeEnv(onChange: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return () => {};
  window.speechSynthesis.addEventListener("voiceschanged", onChange);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", onChange);
}

/**
 * Checks the things that differ between a developer's laptop and a school
 * tablet, in the order they would break a session.
 */
export default function DiagnosticsClient() {
  const [recording, setRecording] = useState(false);
  const [roundTrip, setRoundTrip] = useState<Row | null>(null);

  const raw = useSyncExternalStore(subscribeEnv, envSnapshot, () => "");
  const env = raw ? JSON.parse(raw) : null;

  const rows: Row[] = !env
    ? [{ label: "Reading this device…", verdict: "pending", detail: "" }]
    : [
        { label: "Browser", verdict: "pass", detail: String(env.ua).slice(0, 110) },
        {
          label: "Secure context (HTTPS or localhost)",
          verdict: env.secure ? "pass" : "fail",
          detail: env.secure
            ? env.origin
            : `${env.origin} — the microphone is unavailable outside HTTPS`,
        },
        {
          label: "Microphone API",
          verdict: env.gum && env.rec ? "pass" : "fail",
          detail: `getUserMedia ${env.gum ? "yes" : "no"} · MediaRecorder ${env.rec ? "yes" : "no"}`,
        },
        {
          label: "Recording formats",
          verdict: env.types.length ? "pass" : "warn",
          detail: env.types.join(", ") || "none advertised — the browser will pick its own",
        },
        {
          label: "Speech synthesis",
          verdict: env.tts ? "pass" : "warn",
          detail: env.tts ? "available" : "instructions cannot be read aloud on this browser",
        },
        {
          // How a child who cannot read gets the instruction. A device without
          // a Filipino voice still speaks, but with English phonics.
          label: "Filipino voice",
          verdict: !env.tts ? "fail" : env.voices.some((v: { lang: string }) => /^(fil|tl)/i.test(v.lang)) ? "pass" : "warn",
          detail: !env.tts
            ? "no speech synthesis on this browser"
            : env.voices.filter((v: { lang: string }) => /^(fil|tl)/i.test(v.lang)).length
              ? env.voices
                  .filter((v: { lang: string }) => /^(fil|tl)/i.test(v.lang))
                  .map((v: { name: string; lang: string }) => `${v.name} (${v.lang})`)
                  .join(", ")
              : `none installed — ${env.voices.length} other voices. Word audio still plays from the database; spoken instructions will use English phonics.`,
        },
        {
          label: "Browser speech recognition (fallback only)",
          verdict: env.speechRec ? "pass" : "warn",
          detail: env.speechRec
            ? "available as a fallback if Whisper cannot be reached"
            : "not available — scoring depends entirely on the server",
        },
      ];

  /** The whole chain: permission, capture, upload, Whisper, score. */
  async function testRoundTrip() {
    setRecording(true);
    setRoundTrip({ label: "End-to-end", verdict: "pending", detail: "asking for the microphone…" });

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setRecording(false);
      setRoundTrip({
        label: "End-to-end",
        verdict: "fail",
        detail: `microphone refused: ${err instanceof Error ? err.name : "unknown"}. Allow it in the browser's site settings.`,
      });
      return;
    }

    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

    setRoundTrip({
      label: "End-to-end",
      verdict: "pending",
      detail: "recording for 3 seconds — say “bahay” clearly…",
    });
    recorder.start();
    await new Promise((r) => setTimeout(r, 3000));
    recorder.stop();
    await new Promise((r) => (recorder.onstop = () => r(null)));
    stream.getTracks().forEach((t) => t.stop());

    const mime = recorder.mimeType || "audio/webm";
    const blob = new Blob(chunks, { type: mime });
    const dataUrl: string = await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onloadend = () => resolve(String(fr.result));
      fr.readAsDataURL(blob);
    });

    setRoundTrip({
      label: "End-to-end",
      verdict: "pending",
      detail: `captured ${Math.round(blob.size / 1024)}KB as ${mime} — scoring…`,
    });

    const started = Date.now();
    const res = await tryFetch("/api/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        activityType: "READ_ALOUD",
        target: "bahay",
        responseMs: 3000,
        audio: dataUrl,
      }),
    });
    const ms = Date.now() - started;
    setRecording(false);

    if (!res) {
      setRoundTrip({ label: "End-to-end", verdict: "fail", detail: "no connection to the server" });
      return;
    }
    const body = await res.json().catch(() => ({}));
    if (res.status === 503) {
      setRoundTrip({
        label: "End-to-end",
        verdict: "fail",
        detail: `nothing could score the recording (${mime}, ${Math.round(blob.size / 1024)}KB, ${ms}ms). Check GROQ_API_KEY and the connection.`,
      });
      return;
    }
    if (!res.ok) {
      setRoundTrip({ label: "End-to-end", verdict: "fail", detail: `HTTP ${res.status}` });
      return;
    }
    setRoundTrip({
      label: "End-to-end",
      verdict: body.engine === "server" ? "pass" : "warn",
      detail:
        `${mime}, ${Math.round(blob.size / 1024)}KB, ${ms}ms · scored by ` +
        `${body.engine === "server" ? "Whisper" : body.engine ?? "nothing"} · heard “${body.heard ?? ""}”`,
    });
  }

  const all = roundTrip ? [...rows, roundTrip] : rows;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-extrabold text-ink">Device check</h1>
      <p className="mt-1 max-w-2xl text-sm font-semibold text-ink-muted">
        Run this on each tablet before the first session. It checks the things that differ between
        one device and another — microphone permission, recording format, whether a Filipino voice
        is installed — and then records three seconds and scores it, which is the only way to know
        the whole chain works here.
      </p>

      <ul className="mt-6 space-y-2.5">
        {all.map((r) => (
          <li
            key={r.label}
            className={`flex items-start gap-3 rounded-2xl border border-line p-4 ${TONE[r.verdict]}`}
          >
            <span className="mt-0.5 shrink-0">{ICON[r.verdict]}</span>
            <div className="min-w-0">
              <p className="font-extrabold text-ink">{r.label}</p>
              <p className="wrap-break-word text-sm font-semibold text-ink-soft">{r.detail}</p>
            </div>
          </li>
        ))}
      </ul>

      <button
        onClick={testRoundTrip}
        disabled={recording}
        className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-lg font-extrabold text-white shadow-sm transition hover:bg-primary-dark disabled:opacity-60"
      >
        <Mic size={20} />
        {recording ? "Recording…" : "Record 3 seconds and score it"}
      </button>
      <p className="mt-2 text-xs font-semibold text-ink-muted">
        Say <strong>bahay</strong> when it starts. This writes one practice attempt to the signed-in
        learner&apos;s record — use a test account rather than a participant.
      </p>
    </div>
  );
}
