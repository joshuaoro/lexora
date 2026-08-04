"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, X, AlertTriangle, Mic, Loader2, Volume2 } from "lucide-react";
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
  const [speaking, setSpeaking] = useState(false);
  const [roundTrip, setRoundTrip] = useState<Row | null>(null);
  const [spoken, setSpoken] = useState<Row | null>(null);

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
          // Also fallback-only since instructions became recordings. Saying
          // "instructions cannot be read aloud" here would now be false.
          label: "Device speech engine (offline fallback only)",
          verdict: "pass",
          detail: env.tts
            ? "available"
            : "not present — no effect, since the app plays its own recordings",
        },
        {
          // Not load-bearing any more. Words and instructions are both served
          // as neural clips from the database, so a device with no Filipino
          // voice is entirely normal and nothing is degraded by it. The device
          // voice is only reached if the server cannot be, which is why this is
          // reported rather than warned about.
          label: "Device's own Filipino voice (offline fallback only)",
          verdict: "pass",
          detail: (() => {
            if (!env.tts) {
              return "This browser has no speech engine. That is fine — words and instructions are played as recordings from the app.";
            }
            const fil = env.voices.filter((v: { lang: string }) => /^(fil|tl)/i.test(v.lang));
            return fil.length
              ? `${fil.map((v: { name: string; lang: string }) => `${v.name} (${v.lang})`).join(", ")} — available if the app cannot reach the server.`
              : `None, out of ${env.voices.length} voices — normal, and not a problem. Words and instructions both play as recordings from the app. Only if the connection drops would the app fall back to this device's voice, which would read Filipino poorly.`;
          })(),
        },
        {
          label: "Browser speech recognition (fallback only)",
          verdict: env.speechRec ? "pass" : "warn",
          detail: env.speechRec
            ? "available as a fallback if Whisper cannot be reached"
            : "not available — scoring depends entirely on the server",
        },
      ];

  /**
   * The path a child actually hears an instruction through: fetch the neural
   * clip from the app and play it. This is what the old "Filipino voice" row
   * used to be a proxy for, badly — a device can have no Filipino voice of its
   * own and still speak perfectly, because the speaking is not done here.
   */
  async function testInstruction() {
    setSpeaking(true);
    setSpoken({ label: "Spoken instruction", verdict: "pending", detail: "fetching the clip…" });

    const line = "Pindutin ang mikropono, tapos sabihin nang malinaw ang salita.";
    const started = Date.now();
    const res = await tryFetch(`/api/speech?lang=fil&text=${encodeURIComponent(line)}`);
    const ms = Date.now() - started;

    if (!res?.ok) {
      setSpeaking(false);
      setSpoken({
        label: "Spoken instruction",
        verdict: "fail",
        detail: !res
          ? "no connection to the server — instructions would fall back to this device's voice"
          : `the app could not provide the clip (HTTP ${res.status})`,
      });
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);

    try {
      await audio.play();
      setSpoken({
        label: "Spoken instruction",
        verdict: "pass",
        detail: `${Math.round(blob.size / 1024)}KB in ${ms}ms — you should be hearing Filipino now. If you hear nothing, check the volume and the silent switch.`,
      });
    } catch {
      setSpoken({
        label: "Spoken instruction",
        verdict: "warn",
        detail: "the clip downloaded but the browser refused to play it without a tap — press the button again",
      });
    }
    setSpeaking(false);
  }

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

  const all = [...rows, spoken, roundTrip].filter(Boolean) as Row[];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-extrabold text-ink">Device check</h1>
      <p className="mt-1 max-w-2xl text-sm font-semibold text-ink-muted">
        Run this on each tablet before the first session. It checks what differs from one device to
        another — microphone permission and recording format — then plays a spoken instruction and
        records three seconds and scores it, which is the only way to know the whole chain works
        here. Rows marked <em>offline fallback only</em> describe what the app would resort to if it
        could not reach the server; they are not problems.
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

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={testInstruction}
          disabled={speaking}
          className="inline-flex items-center gap-2 rounded-2xl bg-peach px-6 py-3.5 text-lg font-extrabold text-peach-deep shadow-sm transition hover:opacity-90 disabled:opacity-60"
        >
          <Volume2 size={20} />
          {speaking ? "Playing…" : "Play a spoken instruction"}
        </button>

        <button
        onClick={testRoundTrip}
        disabled={recording}
        className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-lg font-extrabold text-white shadow-sm transition hover:bg-primary-dark disabled:opacity-60"
      >
        <Mic size={20} />
          {recording ? "Recording…" : "Record 3 seconds and score it"}
        </button>
      </div>
      <p className="mt-2 text-xs font-semibold text-ink-muted">
        Say <strong>bahay</strong>{" "}
        when it starts. This writes one practice attempt to the signed-in
        learner&apos;s record — use a test account rather than a participant.
      </p>
    </div>
  );
}
