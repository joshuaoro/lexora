import { Timer, TrendingDown } from "lucide-react";
import { decodingTime } from "@/lib/stats";
import { getDict, type Lang } from "@/lib/i18n";

const seconds = (ms: number) => (ms / 1000).toFixed(1);

/**
 * Decoding latency on single words — how long a correct reading takes.
 *
 * Deliberately framed as decoding effort rather than fluency: the study
 * excludes connected-text and words-per-minute measures, and this is neither.
 * It answers a question accuracy cannot — whether the child is recognising
 * words or still working them out.
 */
export default async function DecodingTime({
  learnerId,
  lang = "en",
}: {
  learnerId: string;
  lang?: Lang;
}) {
  const t = getDict(lang).reports;
  const { medianMs, earlierMs, laterMs, slowWords, sampleSize } = await decodingTime(learnerId);

  if (medianMs === null) {
    return (
      <section className="rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-ink">
          <Timer size={20} className="text-primary" /> {t.decodingTime}
        </h2>
        <p className="mt-2 text-sm font-semibold text-ink-muted">
          {t.decodingTimeEmpty(sampleSize)}
        </p>
      </section>
    );
  }

  // A meaningful change only; small wobbles are noise.
  const change =
    earlierMs !== null && laterMs !== null && earlierMs > 0
      ? Math.round(((earlierMs - laterMs) / earlierMs) * 100)
      : 0;
  const faster = change >= 10;
  const slower = change <= -10;

  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-extrabold text-ink">
        <Timer size={20} className="text-primary" /> {t.decodingTime}
      </h2>
      <p className="mb-4 text-sm font-semibold text-ink-muted">{t.decodingTimeSub}</p>

      <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
        <div>
          <p className="text-3xl font-extrabold text-ink">
            {seconds(medianMs)}
            <span className="ml-1 text-lg font-bold text-ink-muted">s</span>
          </p>
          <p className="text-sm font-semibold text-ink-muted">{t.decodingMedian(sampleSize)}</p>
        </div>

        {(faster || slower) && (
          <div
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ${
              faster ? "bg-green-soft text-green" : "bg-orange-soft text-orange"
            }`}
          >
            <TrendingDown size={16} className={slower ? "rotate-180" : ""} />
            {faster ? t.decodingFaster(Math.abs(change)) : t.decodingSlower(Math.abs(change))}
          </div>
        )}
      </div>

      {slowWords.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-sm font-bold text-ink">{t.effortfulWords}</p>
          <p className="mt-0.5 text-xs font-semibold text-ink-muted">{t.effortfulWordsSub}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {slowWords.map((w) => (
              <li
                key={w.word}
                className="flex items-center gap-2 rounded-full bg-cream px-3 py-1.5 text-sm font-bold text-ink"
              >
                {w.word}
                <span className="text-xs font-semibold text-ink-muted">{seconds(w.ms)}s</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
