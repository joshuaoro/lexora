"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { tryFetch } from "@/lib/net";
import { getDict, type Lang } from "@/lib/i18n";

/**
 * Take a pinned word off a learner's practice list. Shown only on words the
 * specialist pinned: the generated words are what the specialist verifies for
 * Objective 3, so they cannot be removed (the route refuses them too).
 */
export default function UnpinButton({
  learnerId,
  wordId,
  word,
  lang = "en",
}: {
  learnerId: string;
  wordId: string;
  word: string;
  lang?: Lang;
}) {
  const t = getDict(lang).specialist;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function unpin() {
    setBusy(true);
    setFailed(false);
    const res = await tryFetch(`/api/learners/${learnerId}/practice`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wordId }),
    });
    setBusy(false);
    if (res?.ok) router.refresh();
    else setFailed(true);
  }

  return (
    <button
      type="button"
      onClick={unpin}
      disabled={busy}
      aria-label={t.unpinAria(word)}
      title={failed ? t.unpinFailed : t.unpinAria(word)}
      className={`ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full align-middle transition hover:bg-cream-dark disabled:opacity-50 ${
        failed ? "text-red" : "text-ink-muted"
      }`}
    >
      <X size={13} />
    </button>
  );
}
