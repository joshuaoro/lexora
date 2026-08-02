import type { LucideIcon } from "lucide-react";

const TONES = {
  blue: "bg-primary-soft text-primary",
  peach: "bg-peach-soft text-peach-deep",
  orange: "bg-orange-soft text-orange",
  green: "bg-green-soft text-green",
} as const;

export default function StatCard({
  icon: Icon,
  tone,
  value,
  label,
}: {
  icon: LucideIcon;
  tone: keyof typeof TONES;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-line bg-card px-5 py-5 shadow-sm">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${TONES[tone]}`}>
        <Icon size={20} strokeWidth={2.2} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-extrabold leading-tight text-ink">{value}</p>
        <p className="truncate text-sm font-semibold text-ink-muted">{label}</p>
      </div>
    </div>
  );
}
