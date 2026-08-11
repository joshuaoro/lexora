"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { getDict, type Lang } from "@/lib/i18n";

/**
 * "Show demo data" — off by default, and never quietly on.
 *
 * The seeded demo learners carry a fortnight of invented reading history, and
 * the invention is not random: it swaps b↔d, m↔n, u→o, which is close enough to
 * the textbook dyslexia profile that a cohort chart including it looks like a
 * result. Excluding it is therefore the default, and this control is the only
 * way to see it.
 *
 * State lives in the URL rather than in a cookie or a store. A specialist who
 * shares or bookmarks a page shares whether the fabricated data was in it, and
 * a screenshot taken with demo data on carries `?demo=1` in the address bar —
 * which is exactly the sort of thing that should be hard to lose track of.
 */
export default function DemoToggle({ count, lang = "en" }: { count: number; lang?: Lang }) {
  const t = getDict(lang).specialist;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const on = params.get("demo") === "1";

  function toggle() {
    const next = new URLSearchParams(params.toString());
    if (on) next.delete("demo");
    else next.set("demo", "1");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  if (count === 0 && !on) return null;

  return (
    <button
      onClick={toggle}
      aria-pressed={on}
      className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-bold transition ${
        on
          ? "border-orange bg-orange-soft text-orange"
          : "border-line bg-card text-ink-soft hover:bg-cream-dark"
      }`}
      title={
        on
          ? "Demo learners are included in these figures. Their reading history is fabricated."
          : "Demo learners are excluded, as they should be for any reported figure."
      }
    >
      <FlaskConical size={16} />
      {on ? t.hideDemo(count) : t.showDemo(count)}
    </button>
  );
}
