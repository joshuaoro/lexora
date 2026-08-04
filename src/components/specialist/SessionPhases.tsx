"use client";

import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { tryFetch } from "@/lib/net";

export type PhaseSession = {
  id: string;
  date: string;
  type: string;
  total: number;
  correct: number;
  phase: string;
};

const PHASES = ["BASELINE", "REGULAR", "ENDLINE"] as const;

const LABEL: Record<string, string> = {
  BASELINE: "Baseline",
  REGULAR: "Regular",
  ENDLINE: "Endline",
};

const TONE: Record<string, string> = {
  BASELINE: "bg-orange-soft text-orange",
  REGULAR: "bg-cream text-ink-muted",
  ENDLINE: "bg-green-soft text-green",
};

/**
 * Marks where each session sits in the study timeline.
 *
 * The pre/post comparison the paper reports needs to name which sessions are
 * the "before" and which are the "after". Reading that off timestamps means
 * guessing — the first session might be a false start, the child might have
 * been unwell. Tagging makes the choice explicit, reviewable, and exportable,
 * so the analysis rests on a decision the researcher can defend rather than on
 * an arbitrary cut-off.
 */
export default function SessionPhases({ sessions }: { sessions: PhaseSession[] }) {
  const [rows, setRows] = useState(sessions);
  const [busy, setBusy] = useState<string | null>(null);

  async function setPhase(id: string, phase: string) {
    setBusy(id);
    const previous = rows;
    // Optimistic: tagging a dozen sessions in a row shouldn't feel like waiting.
    setRows((r) => r.map((s) => (s.id === id ? { ...s, phase } : s)));
    const res = await tryFetch(`/api/sessions/${id}/phase`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase }),
    });
    if (!res?.ok) setRows(previous);
    setBusy(null);
  }

  const counts = PHASES.map((p) => ({ p, n: rows.filter((s) => s.phase === p).length }));

  return (
    <section className="no-print mt-5 rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-ink">
            <CalendarRange size={20} className="text-primary" /> Study timeline
          </h2>
          <p className="mt-1 max-w-2xl text-sm font-semibold text-ink-muted">
            Mark which sessions form the baseline and which form the endline. The tag is included
            in the CSV export as <code className="font-mono text-xs">study_phase</code>, so the
            pre/post comparison uses sessions you chose rather than a cut-off inferred from dates.
          </p>
        </div>
        <div className="flex gap-2">
          {counts.map(({ p, n }) => (
            <div key={p} className={`rounded-xl px-3 py-2 text-center ${TONE[p]}`}>
              <p className="text-lg font-extrabold">{n}</p>
              <p className="text-xs font-bold">{LABEL[p]}</p>
            </div>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">
          No completed sessions yet. They appear here once the learner finishes an activity.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {rows.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-40">
                <p className="font-extrabold text-ink">{s.date}</p>
                <p className="text-xs font-semibold text-ink-muted">
                  {s.type} · {s.correct}/{s.total}
                </p>
              </div>
              <div
                className="ml-auto flex gap-1.5"
                role="group"
                aria-label={`Study phase for the ${s.date} session`}
              >
                {PHASES.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPhase(s.id, p)}
                    disabled={busy === s.id}
                    aria-pressed={s.phase === p}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
                      s.phase === p
                        ? TONE[p] + " ring-2 ring-primary"
                        : "bg-cream text-ink-soft hover:bg-cream-dark"
                    }`}
                  >
                    {LABEL[p]}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
