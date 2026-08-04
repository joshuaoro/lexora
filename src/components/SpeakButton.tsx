"use client";

import { useState } from "react";
import { Volume2 } from "lucide-react";
import { speakUi, stopSpeaking, ttsSupported } from "@/lib/tts";
import type { Lang } from "@/lib/i18n";

/**
 * Reads an on-screen instruction aloud.
 *
 * LEXORA's users are children with dyslexia aged 7–12, and every instruction in
 * the interface was written as text for them to decode — which is the one thing
 * they are here because they cannot reliably do. A child who cannot read
 * "Press the microphone, then say the word clearly" cannot start the exercise,
 * and will not say so; they will sit and wait, and the session records nothing.
 *
 * The button is the affordance, not an autoplay: browsers block speech that no
 * gesture asked for, and a page that talks unprompted is its own problem in a
 * room with several children. The one place instructions are spoken
 * automatically is immediately after the child presses Start, which is a
 * gesture and therefore allowed.
 */
export default function SpeakButton({
  text,
  lang,
  rate,
  label,
  size = "md",
  className = "",
}: {
  text: string;
  lang: Lang;
  rate?: number;
  /** Visible label. Omit for an icon-only button; the aria-label still describes it. */
  label?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const [speaking, setSpeaking] = useState(false);

  // Rendering nothing is better than a dead control the child keeps pressing.
  if (typeof window !== "undefined" && !ttsSupported()) return null;

  async function speak() {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    await speakUi(text, lang, rate);
    setSpeaking(false);
  }

  const pad = size === "sm" ? "h-9 w-9" : "px-4 py-2.5";

  return (
    <button
      type="button"
      onClick={speak}
      aria-label={lang === "fil" ? "Pakinggan ang panuto" : "Listen to the instruction"}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-bold transition ${pad} ${
        speaking ? "bg-primary text-white" : "bg-peach text-peach-deep hover:opacity-90"
      } ${className}`}
    >
      <Volume2 size={size === "sm" ? 18 : 20} className={speaking ? "animate-pulse" : ""} />
      {label && <span className="text-sm">{label}</span>}
    </button>
  );
}
