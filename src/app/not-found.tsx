import Link from "next/link";
import { Home } from "lucide-react";
import Logo from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-cream p-6 text-center">
      <Logo size="lg" />
      <span className="mt-8 text-5xl" aria-hidden>
        🔎
      </span>
      <h1 className="mt-4 text-2xl font-extrabold text-ink">We couldn&apos;t find that page</h1>
      <p className="mt-2 max-w-sm font-semibold text-ink-soft">
        The link may be out of date. Let&apos;s get you back to your reading.
      </p>
      <Link
        href="/"
        className="mt-7 flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-white transition hover:bg-primary-dark"
      >
        <Home size={18} /> Go to the start
      </Link>
    </main>
  );
}
