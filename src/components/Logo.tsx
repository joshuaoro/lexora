import { Sparkles } from "lucide-react";

export default function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const box = size === "lg" ? "h-12 w-12" : "h-9 w-9";
  const icon = size === "lg" ? 24 : 18;
  const text = size === "lg" ? "text-2xl" : "text-lg";
  return (
    <div className="flex items-center gap-2.5">
      <div className={`${box} flex items-center justify-center rounded-full bg-ink text-cream`}>
        <Sparkles size={icon} strokeWidth={2.2} />
      </div>
      <span className={`${text} font-extrabold tracking-wide text-ink`}>LEXORA</span>
    </div>
  );
}
