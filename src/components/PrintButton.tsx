"use client";

import { Printer } from "lucide-react";

export default function PrintButton({ label = "Print report" }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="no-print flex items-center gap-2 rounded-xl border border-line bg-card px-5 py-2.5 font-bold text-ink transition hover:bg-cream-dark"
    >
      <Printer size={18} /> {label}
    </button>
  );
}
