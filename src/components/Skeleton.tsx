/**
 * Placeholder shapes shown while a page's data loads.
 *
 * Next.js only shows a loading boundary for a segment that is newly entered, so
 * the one at the (app) level never fired for navigation *within* the app — a
 * specialist opening a learner sat on the previous screen, fully interactive,
 * for several seconds with no sign anything was happening. That invites a
 * second click, which queues a second page load behind the first.
 *
 * These are deliberately shaped like the page that follows, so the layout does
 * not jump when the real content arrives.
 */
export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`rounded-full bg-cream-dark ${className}`} />;
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return <div className={`rounded-2xl border border-line bg-card ${className}`} />;
}

/** Wraps a skeleton so screen readers announce the wait rather than silence. */
export function SkeletonPage({
  children,
  className = "mx-auto max-w-6xl",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`${className} animate-pulse`} aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {children}
    </div>
  );
}
