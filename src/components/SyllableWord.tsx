/**
 * A Filipino word split into syllables — `ba·hay`.
 *
 * The most distinctive thing LEXORA has, and for a long time it appeared once,
 * small, inside a mock card. It is worth more than that: the split is the
 * teaching method made visible, so a reading specialist reading the page sees
 * the approach before they read a word of prose, and a child sees the shape
 * they will meet in the app.
 *
 * Set in Lexend rather than the interface face. Lexend was designed to reduce
 * visual crowding for developing readers, and the wide tracking here is the
 * same idea — the letters are given room so the syllables read as units.
 *
 * The interpunct is tinted rather than inheriting the text colour: it is a
 * separator, not a letter, and a child should not read it as one.
 */
export default function SyllableWord({
  syllables,
  className = "",
  dotClassName = "text-peach-deep/50",
}: {
  /** Hyphenated, as it is stored in the word bank: "ba-hay". */
  syllables: string;
  className?: string;
  dotClassName?: string;
}) {
  const parts = syllables.split("-");
  return (
    <span
      className={className}
      style={{ fontFamily: "var(--font-lexend)", letterSpacing: "0.06em" }}
      // Read as the whole word, not "ba dot hay".
      aria-label={parts.join("")}
    >
      {parts.map((part, i) => (
        <span key={`${part}-${i}`}>
          {i > 0 && (
            <span aria-hidden className={dotClassName}>
              ·
            </span>
          )}
          {part}
        </span>
      ))}
    </span>
  );
}
