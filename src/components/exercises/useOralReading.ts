"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { similarity, normalizeWord } from "@/lib/scoring";

/* Minimal typings for the Web Speech API (used only as a fallback recognizer). */
type SpeechRecognitionResultLike = { transcript: string };
type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>>;
};
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

export type OralReadingResult = {
  audio: string | null; // base64 data URL of the recording (null if no speech)
  browserTranscript: string | null; // Web Speech fallback transcript, when available
};

export type RecognitionState = "idle" | "listening" | "processing";

const MAX_RECORD_MS = 7000; // hard cap per word
const NO_SPEECH_TIMEOUT_MS = 5000; // stop early if the child never spoke
const MIN_SPEECH_MS = 250; // accumulated voiced time to count as speech
const TRAILING_SILENCE_MS = 1200; // silence after speech that ends the take
const SPEECH_RMS = 0.02;
const SILENCE_RMS = 0.012;
const BROWSER_ASR_GRACE_MS = 1000; // wait for Web Speech result after stop
const MAX_AUDIO_BLOB_BYTES = 400_000;

const MIC_BLOCKED_MESSAGE =
  "Microphone access was blocked. Please allow the microphone and try again.";

export function micSupported() {
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined"
  );
}

const emptySubscribe = () => () => {};

type ActiveCapture = {
  stream: MediaStream;
  recorder: MediaRecorder;
  audioCtx: AudioContext;
  rec: SpeechRecognitionLike | null;
  timers: ReturnType<typeof setTimeout>[];
  raf: number;
};

function teardown(active: ActiveCapture | null) {
  if (!active) return;
  cancelAnimationFrame(active.raf);
  active.timers.forEach(clearTimeout);
  try {
    active.rec?.abort();
  } catch {}
  if (active.recorder.state !== "inactive") {
    try {
      active.recorder.stop();
    } catch {}
  }
  active.stream.getTracks().forEach((t) => t.stop());
  active.audioCtx.close().catch(() => {});
}

function blobToDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

/**
 * Captures one oral reading. The microphone recording is the primary signal —
 * it is sent to the server, where a pre-trained Whisper model transcribes and
 * scores it. When the browser also has a Web Speech recognizer, it runs in
 * parallel purely to provide a fallback transcript for when the server ASR is
 * unreachable. Recording stops automatically after trailing silence.
 */
export function useOralReading() {
  const [state, setState] = useState<RecognitionState>("idle");
  const [micError, setMicError] = useState<string | null>(null);
  const activeRef = useRef<ActiveCapture | null>(null);

  // SSR assumes support; the client value takes over after hydration.
  const supported = useSyncExternalStore(emptySubscribe, micSupported, () => true);

  useEffect(() => {
    const ref = activeRef;
    return () => {
      teardown(ref.current);
      ref.current = null;
    };
  }, []);

  /** Manually end the current take (tapping the mic while listening). */
  function stopListening() {
    const active = activeRef.current;
    if (active && active.recorder.state !== "inactive") {
      try {
        active.recorder.stop();
      } catch {}
    }
  }

  async function start(target: string): Promise<OralReadingResult> {
    setMicError(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMicError(MIC_BLOCKED_MESSAGE);
      return { audio: null, browserTranscript: null };
    }

    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);

    // Silence detection via RMS of the time-domain signal
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const samples = new Float32Array(analyser.fftSize);

    // Optional parallel Web Speech recognition (fallback transcript)
    let browserTranscript: string | null = null;
    let browserDone = false;
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    let rec: SpeechRecognitionLike | null = null;
    if (Ctor) {
      rec = new Ctor();
      rec.lang = "fil-PH";
      rec.interimResults = false;
      rec.maxAlternatives = 5;
      rec.continuous = false;
      rec.onresult = (e) => {
        const alternatives: string[] = [];
        const result = e.results[0];
        for (let i = 0; i < result.length; i++) alternatives.push(result[i].transcript);
        const t = normalizeWord(target);
        alternatives.sort(
          (a, b) => similarity(t, normalizeWord(b)) - similarity(t, normalizeWord(a))
        );
        browserTranscript = alternatives[0] ?? null;
        browserDone = true;
      };
      rec.onerror = () => {
        browserDone = true;
      };
      rec.onend = () => {
        browserDone = true;
      };
      try {
        rec.start();
      } catch {
        browserDone = true;
        rec = null;
      }
    } else {
      browserDone = true;
    }

    const active: ActiveCapture = { stream, recorder, audioCtx, rec, timers: [], raf: 0 };
    activeRef.current = active;
    setState("listening");

    let speechMs = 0;
    let silenceMs = 0;
    let speechDetected = false;
    let lastTick = performance.now();

    const stopRecorder = () => {
      if (recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {}
      }
    };

    const tick = () => {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
      const rms = Math.sqrt(sum / samples.length);

      const nowTs = performance.now();
      const dt = nowTs - lastTick;
      lastTick = nowTs;

      if (rms >= SPEECH_RMS) {
        speechMs += dt;
        silenceMs = 0;
        if (speechMs >= MIN_SPEECH_MS) speechDetected = true;
      } else if (rms < SILENCE_RMS && speechDetected) {
        silenceMs += dt;
        if (silenceMs >= TRAILING_SILENCE_MS) {
          stopRecorder();
          return;
        }
      }
      active.raf = requestAnimationFrame(tick);
    };

    active.timers.push(setTimeout(stopRecorder, MAX_RECORD_MS));
    active.timers.push(
      setTimeout(() => {
        if (!speechDetected) stopRecorder();
      }, NO_SPEECH_TIMEOUT_MS)
    );

    recorder.start();
    active.raf = requestAnimationFrame(tick);

    return new Promise<OralReadingResult>((resolve) => {
      recorder.onstop = async () => {
        setState("processing");
        cancelAnimationFrame(active.raf);
        active.timers.forEach(clearTimeout);
        try {
          rec?.stop();
        } catch {}

        // Give the browser recognizer a moment to deliver its result
        const waitStart = performance.now();
        while (!browserDone && performance.now() - waitStart < BROWSER_ASR_GRACE_MS) {
          await new Promise((r) => setTimeout(r, 100));
        }
        try {
          rec?.abort();
        } catch {}

        stream.getTracks().forEach((t) => t.stop());
        audioCtx.close().catch(() => {});

        let audio: string | null = null;
        if (speechDetected) {
          const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
          if (blob.size > 0 && blob.size <= MAX_AUDIO_BLOB_BYTES) {
            audio = await blobToDataUrl(blob);
          }
        }

        activeRef.current = null;
        setState("idle");
        resolve({ audio, browserTranscript });
      };
    });
  }

  return { state, supported, micError, start, stopListening };
}
