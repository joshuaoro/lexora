"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AudioLines, Mic, Square, Play, Check, X, Trash2 } from "lucide-react";
import { LETTER_SOUNDS, isLoneVowel, letterSoundUrl } from "@/lib/letter-sounds";
import { trimToWav } from "@/lib/trim-sound";
import { playAudioUrl, stopSpeaking } from "@/lib/tts";
import { tryFetch } from "@/lib/net";
import { getDict, type Lang } from "@/lib/i18n";

/** A take this long is plenty for one sound, and stops a forgotten recorder. */
const MAX_TAKE_MS = 3000;

type Recorded = { sound: string; version: number };

/**
 * The specialist records each letter sound once, in their own voice.
 *
 * Nothing else in the app can say these. The neural voice reads a lone letter
 * by its name, so until a sound is recorded, the activities that need it wait:
 * Change the sound draws only pairs whose two first sounds are both here, and a
 * word with a lone-vowel syllable stays out of Blend and Count the syllables
 * until its vowel is.
 */
export default function LetterSoundsPanel({
  recorded,
  lang = "en",
}: {
  recorded: Recorded[];
  lang?: Lang;
}) {
  const t = getDict(lang).wordBankPage;
  const router = useRouter();
  const versions = new Map(recorded.map((r) => [r.sound, r.version]));
  const [recording, setRecording] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ sound: string; audio: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  async function toggleRecord(sound: string) {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    setMessage(null);
    setDraft(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMessage(t.micBlocked);
      return;
    }
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;
    recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      recorderRef.current = null;
      setRecording(null);
      const audio = await trimToWav(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
      if (!audio) {
        setMessage(t.soundNotHeard);
        return;
      }
      setDraft({ sound, audio });
      void playAudioUrl(audio); // hear the take straight away
    };
    setRecording(sound);
    recorder.start();
    setTimeout(() => recorder.state !== "inactive" && recorder.stop(), MAX_TAKE_MS);
  }

  async function save() {
    if (!draft) return;
    setBusy(draft.sound);
    const res = await tryFetch(`/api/sounds/${encodeURIComponent(draft.sound)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio: draft.audio }),
    });
    const data = (await res?.json().catch(() => ({}))) ?? {};
    setBusy(null);
    if (!res?.ok) {
      setMessage(res ? (data.error ?? t.soundSaveFailed) : t.offlineRetry);
      return;
    }
    setMessage(t.soundSaved(draft.sound));
    setDraft(null);
    router.refresh();
  }

  async function remove(sound: string) {
    setBusy(sound);
    const res = await tryFetch(`/api/sounds/${encodeURIComponent(sound)}`, { method: "DELETE" });
    setBusy(null);
    if (!res?.ok) {
      setMessage(res ? t.soundSaveFailed : t.offlineRetry);
      return;
    }
    setMessage(t.soundRemoved(sound));
    router.refresh();
  }

  const iconBtn =
    "flex h-7 w-7 items-center justify-center rounded-lg transition disabled:opacity-40";

  return (
    <section className="mt-5 rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-extrabold text-ink">
        <AudioLines size={20} className="text-primary" /> {t.soundsTitle}
      </h2>
      <p className="mt-1 max-w-3xl text-sm font-semibold text-ink-muted">{t.soundsSub}</p>
      <p className="mt-1 text-sm font-bold text-ink-soft">
        {t.soundsCount(recorded.length, LETTER_SOUNDS.length)}
      </p>

      {message && (
        <p role="status" className="mt-3 rounded-xl bg-primary-soft px-4 py-2 text-sm font-bold text-ink">
          {message}
        </p>
      )}

      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
        {LETTER_SOUNDS.map((sound) => {
          const version = versions.get(sound);
          const isRecording = recording === sound;
          const hasDraft = draft?.sound === sound;
          return (
            <li
              key={sound}
              className={`flex items-center justify-between gap-1 rounded-xl border px-2.5 py-2 ${
                version ? "border-green/40 bg-green-soft" : "border-line bg-cream/60"
              }`}
            >
              <span className="font-mono text-base font-extrabold text-ink">
                /{sound}/
                {isLoneVowel(sound) && (
                  <span className="sr-only"> {t.soundVowel}</span>
                )}
              </span>
              <span className="flex items-center gap-0.5">
                {hasDraft ? (
                  <>
                    <button
                      onClick={() => void playAudioUrl(draft.audio)}
                      aria-label={t.playTake}
                      className={`${iconBtn} bg-white text-primary`}
                    >
                      <Play size={13} />
                    </button>
                    <button
                      onClick={save}
                      disabled={busy === sound}
                      aria-label={t.useThis}
                      title={t.useThis}
                      className={`${iconBtn} bg-green text-white`}
                    >
                      <Check size={13} />
                    </button>
                    <button
                      onClick={() => {
                        stopSpeaking();
                        setDraft(null);
                      }}
                      aria-label={t.discardTake}
                      className={`${iconBtn} text-ink-muted hover:bg-white`}
                    >
                      <X size={13} />
                    </button>
                  </>
                ) : (
                  <>
                    {version && (
                      <button
                        onClick={() => void playAudioUrl(letterSoundUrl(sound, version))}
                        aria-label={t.playSoundAria(sound)}
                        className={`${iconBtn} text-primary hover:bg-white`}
                      >
                        <Play size={13} />
                      </button>
                    )}
                    <button
                      onClick={() => toggleRecord(sound)}
                      disabled={busy !== null || (recording !== null && !isRecording)}
                      aria-label={t.recordSoundAria(sound, isRecording)}
                      title={t.recordSoundAria(sound, isRecording)}
                      className={`${iconBtn} ${
                        isRecording
                          ? "animate-pulse bg-red text-white"
                          : "text-ink-muted hover:bg-white hover:text-ink"
                      }`}
                    >
                      {isRecording ? <Square size={12} /> : <Mic size={13} />}
                    </button>
                    {version && (
                      <button
                        onClick={() => remove(sound)}
                        disabled={busy !== null}
                        aria-label={t.removeSoundAria(sound)}
                        className={`${iconBtn} text-ink-muted hover:bg-red-soft hover:text-red`}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
