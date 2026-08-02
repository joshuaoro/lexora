import { requireLearner } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { getLang } from "@/lib/lang";
import { getDict } from "@/lib/i18n";
import LearnerReport from "@/components/LearnerReport";
import PrintButton from "@/components/PrintButton";

export default async function ReportsPage() {
  const session = await requireLearner();
  const lang = await getLang();
  const dict = getDict(lang);
  const profile = await prisma.learnerProfile.findUniqueOrThrow({
    where: { id: session.learnerId },
  });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-ink">{dict.reports.title}</h1>
          <p className="mt-1 text-sm font-semibold text-ink-muted">
            {session.name} · {dict.common.levelChip(profile.level, profile.stage)} ·{" "}
            {dict.reports.generated}{" "}
            {new Date().toLocaleDateString(lang === "fil" ? "fil-PH" : "en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <PrintButton label={dict.reports.print} />
      </div>

      <LearnerReport learnerId={session.learnerId} lang={lang} />
    </div>
  );
}
