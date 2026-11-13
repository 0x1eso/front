// One place for the look of the Great War screens: the same dark glass the
// 1936 drawers use, no new visual style.
export const GLASS = "bg-slate-900/90 border border-white/15 backdrop-blur-sm";
export const BTN =
  "rounded border border-white/25 bg-white/10 px-3 py-1.5 text-left text-sm text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40";
export const BTN_ON =
  "rounded border border-amber-300/70 bg-amber-300/20 px-3 py-1.5 text-left text-sm text-white";
export const CHIP =
  "inline-block rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/80";
export const MUTED = "text-xs text-white/55";
export const HEAD = "text-sm font-bold text-white";

/** A gauge or standing as a colour: 0 bad .. 1 good. */
export function fillColor(f: number): string {
  if (f <= 0.25) return "bg-red-400";
  if (f <= 0.5) return "bg-orange-300";
  if (f <= 0.75) return "bg-yellow-200";
  return "bg-emerald-300";
}

/**
 * ww203: a bloc's seats in the vote scene, one fixed tint each (no new look:
 * the HUD's own light shades).
 */
export const BLOC_COLOR: Readonly<Record<string, string>> = {
  workers: "#fca5a5",
  press: "#fdba74",
  parliament: "#fde68a",
  business: "#93c5fd",
  court: "#c4b5fd",
  army: "#6ee7b7",
};
/** Seats no faction holds (independents, the states' votes). */
export const NO_BLOC_COLOR = "#e2e8f0";
/** A house seats its blocs left to right. */
export const BLOC_SEATING: readonly string[] = [
  "workers",
  "press",
  "parliament",
  "business",
  "court",
  "army",
];
/** The tally's colours: for (the amber accent), against, away. */
export const CAST_COLOR = {
  for: "#fcd34d",
  against: "#f87171",
  away: "#64748b",
} as const;
