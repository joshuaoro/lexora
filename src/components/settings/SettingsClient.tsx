"use client";

import { useState } from "react";
import { Volume2, Check } from "lucide-react";
import { FONT_STACKS, OVERLAY_COLORS, type ReaderSettings } from "@/lib/settings";
import { speakOnce } from "@/lib/tts";
import { getDict, type Lang } from "@/lib/i18n";
import { tryFetch } from "@/lib/net";

const FONT_LABELS: Record<ReaderSettings["font"], string> = {
  lexend: "Lexend",
  atkinson: "Atkinson Hyperlegible",
  comic: "Comic Neue",
  system: "System rounded",
};

const SAMPLE = "Ang bahay ay malaki. Ang aso ay tumatakbo sa ilalim ng araw.";

export default function SettingsClient({
  initial,
  lang,
}: {
  initial: ReaderSettings;
  lang: Lang;
}) {
  const dict = getDict(lang);
  const t = dict.settingsPage;
  const [s, setS] = useState<ReaderSettings>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);

  function set<K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setFailed(false);
    const res = await tryFetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });
    setSaving(false);
    // These settings are the accessibility accommodation, so claiming they were
    // saved when they were not is worse than saying nothing: the learner walks
    // away believing the display is set the way they need it.
    if (!res?.ok) {
      setFailed(true);
      return;
    }
    setSaved(true);
  }

  const slider = (
    label: string,
    key: "fontSize" | "letterSpacing" | "wordSpacing" | "lineHeight" | "ttsRate",
    min: number,
    max: number,
    step: number,
    format: (v: number) => string
  ) => (
    <label className="block">
      <span className="flex items-center justify-between text-sm font-bold text-ink-soft">
        {label}
        <span className="font-extrabold text-primary">{format(s[key])}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={s[key]}
        onChange={(e) => set(key, Number(e.target.value))}
        className="mt-1.5 w-full accent-primary"
      />
    </label>
  );

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-extrabold text-ink">{t.title}</h1>
      <p className="mt-1 text-sm font-semibold text-ink-muted">{t.sub}</p>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1fr]">
        {/* Controls */}
        <div className="space-y-5">
          <section className="rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-extrabold text-ink">{t.readingFont}</h2>
            <div className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
              {(Object.keys(FONT_LABELS) as ReaderSettings["font"][]).map((f) => (
                <button
                  key={f}
                  onClick={() => set("font", f)}
                  aria-pressed={s.font === f}
                  className={`rounded-xl border-2 px-4 py-3 text-left transition ${
                    s.font === f
                      ? "border-primary bg-primary-soft"
                      : "border-line bg-white hover:border-primary/40"
                  }`}
                >
                  <span className="block text-2xl text-ink" style={{ fontFamily: FONT_STACKS[f] }}>
                    Aa bahay
                  </span>
                  <span className="text-xs font-bold text-ink-muted">{FONT_LABELS[f]}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-extrabold text-ink">{t.text}</h2>
            {slider(t.textSize, "fontSize", 20, 56, 2, (v) => `${v}px`)}
            {slider(t.letterSpacing, "letterSpacing", 0, 0.3, 0.02, (v) => `${v.toFixed(2)}em`)}
            {slider(t.wordSpacing, "wordSpacing", 0, 0.6, 0.05, (v) => `${v.toFixed(2)}em`)}
            {slider(t.lineHeight, "lineHeight", 1.4, 2.6, 0.1, (v) => v.toFixed(1))}
          </section>

          <section className="rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-extrabold text-ink">{t.overlay}</h2>
            <p className="text-xs font-semibold text-ink-muted">{t.overlaySub}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(Object.keys(OVERLAY_COLORS) as ReaderSettings["overlay"][]).map((o) => (
                <button
                  key={o}
                  onClick={() => set("overlay", o)}
                  aria-pressed={s.overlay === o}
                  aria-label={o}
                  className={`flex h-12 w-12 items-center justify-center rounded-full border-2 transition ${
                    s.overlay === o ? "border-primary" : "border-line hover:border-primary/40"
                  }`}
                  style={{ backgroundColor: OVERLAY_COLORS[o] }}
                >
                  {s.overlay === o && <Check size={18} className="text-primary" />}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-extrabold text-ink">{t.aids}</h2>
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-ink-soft">{t.rulerLabel}</span>
              <input
                type="checkbox"
                checked={s.ruler}
                onChange={(e) => set("ruler", e.target.checked)}
                className="h-5 w-5 shrink-0 accent-primary"
              />
            </label>
            {slider(t.voiceSpeed, "ttsRate", 0.5, 1.2, 0.05, (v) => `${v.toFixed(2)}×`)}
            <button
              onClick={() => speakOnce("Kumusta! Ako si LEXORA. Sabay tayong magbasa.", s.ttsRate)}
              className="flex items-center gap-2 rounded-xl bg-peach px-4 py-2 text-sm font-bold text-peach-deep transition hover:opacity-90"
            >
              <Volume2 size={16} /> {t.testVoice}
            </button>
          </section>
        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-8 lg:self-start">
          <section
            className="rounded-3xl border border-line p-6 shadow-sm sm:p-8"
            style={{ backgroundColor: OVERLAY_COLORS[s.overlay] }}
          >
            <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">{t.preview}</p>
            <p
              className="wrap-break-word mt-4 text-ink"
              style={{
                fontFamily: FONT_STACKS[s.font],
                fontSize: `${s.fontSize}px`,
                letterSpacing: `${s.letterSpacing}em`,
                wordSpacing: `${s.wordSpacing}em`,
                lineHeight: s.lineHeight,
              }}
            >
              {SAMPLE}
            </p>
          </section>

          <button
            onClick={save}
            disabled={saving}
            className="mt-4 w-full rounded-xl bg-primary py-3.5 text-lg font-extrabold text-white shadow-sm transition hover:bg-primary-dark disabled:opacity-60"
          >
            {saving ? t.saving : saved ? t.saved : t.save}
          </button>
          {failed && (
            <p
              role="alert"
              className="mt-3 rounded-xl bg-orange-soft px-4 py-3 text-sm font-bold text-orange"
            >
              {t.saveFailed}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
