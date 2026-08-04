/**
 * The LEXORA mark: two eyes above an open book that curves into a smile.
 *
 * A face rather than an object, because the people who see it most are children
 * of seven to twelve who find reading hard, and the app should look like
 * something that is pleased to see them. The book is the mouth, so the thing
 * doing the smiling is the reading itself.
 *
 * Drawn as inline SVG rather than an icon-font glyph so it stays crisp at any
 * size and needs no network request — the same reasoning as the rest of the
 * app's audio and imagery. The shapes are deliberately few and heavy: at the
 * sixteen pixels of a browser tab, detail turns to mush and only the silhouette
 * survives.
 */
export function LogoMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="LEXORA"
    >
      <rect width="64" height="64" rx="16" fill="var(--color-primary, #3d5a80)" />
      <circle cx="24" cy="23" r="4" fill="var(--color-cream, #faf6ef)" />
      <circle cx="40" cy="23" r="4" fill="var(--color-cream, #faf6ef)" />
      <path
        d="M13 34c6.5-3 12.5-3 19 2 6.5-5 12.5-5 19-2v12c-6.5-3-12.5-3-19 2-6.5-5-12.5-5-19-2V34Z"
        fill="var(--color-peach, #f3d2b8)"
      />
      <path
        d="M32 36v12"
        stroke="var(--color-primary, #3d5a80)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const mark = size === "lg" ? 48 : 36;
  const text = size === "lg" ? "text-2xl" : "text-lg";
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={mark} />
      <span className={`${text} font-extrabold tracking-wide text-ink`}>LEXORA</span>
    </div>
  );
}
