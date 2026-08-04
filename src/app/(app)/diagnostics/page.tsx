import { requireLearner } from "@/lib/guards";
import DiagnosticsClient from "@/components/DiagnosticsClient";

/**
 * Device check, run on the device.
 *
 * Everything measurable from a developer machine has been measured. What cannot
 * be is whether *this* tablet, in *this* room, can do the one thing the study
 * depends on: capture a child's voice and get it scored. Microphone permission,
 * the recorder's codec, whether a Filipino voice is installed, and whether the
 * clip survives the round trip to Whisper all vary by device and by browser,
 * and every one of them fails quietly.
 *
 * Open this on each tablet before the first session rather than discovering it
 * with a child sitting there.
 */
export default async function DiagnosticsPage() {
  await requireLearner();
  return <DiagnosticsClient />;
}
