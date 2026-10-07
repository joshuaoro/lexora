import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const lang = await getLang();

  // The root <html> says "en", which is right for the public pages but not for
  // a learner who has switched to Filipino: a screen reader would read the
  // Filipino instructions with English pronunciation. Declaring the language
  // here covers every signed-in page without making the static ones dynamic.
  return (
    <div lang={lang === "fil" ? "fil" : "en"} className="flex min-h-screen flex-col bg-cream lg:flex-row">
      <Sidebar role={session.role} lang={lang} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
    </div>
  );
}
