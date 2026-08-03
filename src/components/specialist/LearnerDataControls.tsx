"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Trash2, MicOff } from "lucide-react";

/**
 * Data-protection actions for one learner (RA 10173): clear stored voice
 * recordings once the reliability check is finished, or erase the participant
 * entirely on request from a parent or guardian.
 */
export default function LearnerDataControls({
  learnerId,
  learnerName,
  recordingCount,
  retentionNote,
}: {
  learnerId: string;
  learnerName: string;
  recordingCount: number;
  /** Stated by the server so this matches the policy actually enforced. */
  retentionNote: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typedName, setTypedName] = useState("");

  async function clearRecordings() {
    if (!window.confirm(`Delete ${recordingCount} stored recording(s) for ${learnerName}? Scores and progress are kept.`)) {
      return;
    }
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/learners/${learnerId}/recordings`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setMessage(res.ok ? `Deleted ${data.cleared} recording(s). Scores kept.` : (data.error ?? "Could not clear recordings."));
    if (res.ok) router.refresh();
  }

  async function eraseLearner() {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/learners/${learnerId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmName: typedName }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error ?? "Could not delete this learner.");
      return;
    }
    router.push("/specialist");
    router.refresh();
  }

  return (
    <section className="no-print mt-5 rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-extrabold text-ink">
        <ShieldAlert size={20} className="text-orange" /> Data protection
      </h2>
      <p className="mt-1 text-sm font-semibold text-ink-muted">
        Voice recordings are kept only so you can replay a reading during the scoring
        reliability check. Clear them once you are done, and erase a participant entirely if
        their parent or guardian withdraws consent.
      </p>
      <p className="mt-1 text-sm font-semibold text-ink-muted">
        {retentionNote}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <button
          onClick={clearRecordings}
          disabled={busy || recordingCount === 0}
          className="flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-cream-dark disabled:opacity-40"
        >
          <MicOff size={16} />
          {recordingCount === 0
            ? "No stored recordings"
            : `Clear ${recordingCount} stored recording${recordingCount === 1 ? "" : "s"}`}
        </button>

        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={busy}
            className="flex items-center gap-2 rounded-xl border border-red/40 bg-red-soft px-4 py-2.5 text-sm font-bold text-red transition hover:bg-red hover:text-white disabled:opacity-40"
          >
            <Trash2 size={16} /> Erase learner and all data
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-red-soft p-2.5">
            <span className="text-sm font-bold text-red">
              Type “{learnerName}” to confirm permanent deletion:
            </span>
            <input
              autoFocus
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setConfirmDelete(false)}
              className="w-40 rounded-lg border border-red/40 bg-white px-3 py-1.5 text-sm font-semibold text-ink outline-none"
            />
            <button
              onClick={eraseLearner}
              disabled={busy || typedName.trim().toLowerCase() !== learnerName.trim().toLowerCase()}
              className="rounded-lg bg-red px-3 py-1.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
            >
              {busy ? "Deleting…" : "Delete permanently"}
            </button>
            <button
              onClick={() => {
                setConfirmDelete(false);
                setTypedName("");
              }}
              className="rounded-lg px-2 py-1.5 text-sm font-bold text-ink-soft hover:text-ink"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {message && <p className="mt-3 text-sm font-bold text-ink-soft">{message}</p>}
    </section>
  );
}
