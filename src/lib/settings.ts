/** Dyslexia-friendly display customization settings, stored per learner. */

export type ReaderSettings = {
  font: "lexend" | "atkinson" | "comic" | "system";
  fontSize: number; // px, reading surfaces only
  letterSpacing: number; // em
  wordSpacing: number; // em
  lineHeight: number;
  overlay: "none" | "cream" | "yellow" | "blue" | "green" | "pink";
  ruler: boolean; // reading focus ruler
  ttsRate: number; // 0.5 – 1.2
};

export const DEFAULT_SETTINGS: ReaderSettings = {
  font: "lexend",
  fontSize: 32,
  letterSpacing: 0.08,
  wordSpacing: 0.25,
  lineHeight: 2,
  overlay: "none",
  ruler: false,
  ttsRate: 0.85,
};

export const FONT_STACKS: Record<ReaderSettings["font"], string> = {
  lexend: "var(--font-lexend), sans-serif",
  atkinson: "var(--font-atkinson), sans-serif",
  comic: "var(--font-comic), cursive",
  system: "ui-rounded, system-ui, sans-serif",
};

export const OVERLAY_COLORS: Record<ReaderSettings["overlay"], string> = {
  none: "#FFFFFF",
  cream: "#FBF3E0",
  yellow: "#FDF6C9",
  blue: "#E3EEF9",
  green: "#E4F2E4",
  pink: "#FAE7EC",
};

export function parseSettings(json: string | null | undefined): ReaderSettings {
  if (!json) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(json) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
