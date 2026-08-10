"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  BookOpen,
  Mic,
  ListChecks,
  FileText,
  Settings,
  Users,
  Library,
  LogOut,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import Logo from "./Logo";
import LangToggle from "./LangToggle";
import { getDict, type Lang } from "@/lib/i18n";
import { tryFetch } from "@/lib/net";

type NavItem = { href: string; key: "dashboard" | "reader" | "exercises" | "practice" | "reports" | "settings" | "learners" | "cohort" | "wordBank"; icon: LucideIcon };

const LEARNER_NAV: NavItem[] = [
  { href: "/dashboard", key: "dashboard", icon: LayoutGrid },
  { href: "/reader", key: "reader", icon: BookOpen },
  { href: "/exercises", key: "exercises", icon: Mic },
  { href: "/practice", key: "practice", icon: ListChecks },
  { href: "/reports", key: "reports", icon: FileText },
  { href: "/settings", key: "settings", icon: Settings },
];

const SPECIALIST_NAV: NavItem[] = [
  { href: "/specialist", key: "learners", icon: Users },
  { href: "/specialist/cohort", key: "cohort", icon: LayoutGrid },
  { href: "/specialist/words", key: "wordBank", icon: Library },
];

export default function Sidebar({ role, lang }: { role: "LEARNER" | "SPECIALIST"; lang: Lang }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const dict = getDict(lang);
  const nav = role === "SPECIALIST" ? SPECIALIST_NAV : LEARNER_NAV;

  function isActive(href: string) {
    if (href === "/specialist") {
      return pathname === "/specialist" || pathname.startsWith("/specialist/learner");
    }
    return pathname === href || pathname.startsWith(href + "/");
  }

  /**
   * Sign out, and only claim to have done so if it worked.
   *
   * The session cookie is httpOnly, so only the server can clear it — the
   * browser cannot tidy up on its own if the request fails. This used to
   * navigate to /login regardless, and /login does not check for an existing
   * session, so a failed sign-out left a child looking at a login form while
   * still signed in. On a tablet shared by five children in the same room, the
   * next one to open the app would have been in the previous child's account,
   * reading their progress and playing back their recordings.
   */
  async function signOut() {
    setSigningOut(true);
    const res = await tryFetch("/api/auth/logout", { method: "POST" });
    setSigningOut(false);
    if (!res?.ok) {
      setSignOutError(dict.common.signOutFailed);
      return;
    }
    setSignOutError(null);
    router.push("/login");
    router.refresh();
  }

  const navLinks = (onNavigate?: () => void) => (
    <nav className="flex flex-1 flex-col gap-1.5" aria-label="Main navigation">
      {nav.map(({ href, key, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-[15px] font-bold transition ${
              active
                ? "bg-primary text-white shadow-sm"
                : "text-ink-soft hover:bg-cream hover:text-ink"
            }`}
          >
            <Icon size={19} strokeWidth={2.2} />
            {dict.nav[key]}
          </Link>
        );
      })}
    </nav>
  );

  const signOutButton = (
    <div>
      <button
        onClick={signOut}
        disabled={signingOut}
        className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-[15px] font-bold text-ink-soft transition hover:bg-cream hover:text-ink disabled:opacity-60"
      >
        <LogOut size={19} strokeWidth={2.2} />
        {dict.common.signOut}
      </button>
      {signOutError && (
        <p role="alert" className="mt-1 px-4 text-xs font-bold text-orange">
          {signOutError}
        </p>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile / tablet top bar */}
      <header className="no-print sticky top-0 z-40 flex items-center justify-between border-b border-line bg-cream-dark px-4 py-3 lg:hidden">
        <Logo />
        <div className="flex items-center gap-2">
          <LangToggle lang={lang} />
          <button
            onClick={() => setOpen(true)}
            aria-label={dict.common.menu}
            aria-expanded={open}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-card text-ink transition hover:bg-cream"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            aria-label={dict.common.close}
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full bg-ink/40"
          />
          <div className="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col bg-cream-dark px-4 py-5 shadow-xl">
            <div className="mb-6 flex items-center justify-between px-2">
              <Logo />
              <button
                onClick={() => setOpen(false)}
                aria-label={dict.common.close}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition hover:bg-cream hover:text-ink"
              >
                <X size={20} />
              </button>
            </div>
            {navLinks(() => setOpen(false))}
            {signOutButton}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-cream-dark px-4 py-6 lg:flex">
        <div className="px-2">
          <Logo />
        </div>
        <div className="mt-8 flex flex-1 flex-col">{navLinks()}</div>
        <div className="mb-3 px-2">
          <LangToggle lang={lang} stretch />
        </div>
        {signOutButton}
      </aside>
    </>
  );
}
