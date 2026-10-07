import { requireSpecialist } from "@/lib/guards";
import { calibrationReport } from "@/lib/calibration";
import CalibrationReport from "@/components/specialist/CalibrationReport";
import { getLang } from "@/lib/lang";

/**
 * Cohort-wide, not per-learner: SCORE_THRESHOLD is one global setting, so
 * fitting it against a single child would fit it to that child.
 */
export default async function CalibrationPage() {
  await requireSpecialist();
  const [cal, lang] = await Promise.all([calibrationReport(), getLang()]);
  return <CalibrationReport cal={cal} lang={lang} />;
}
