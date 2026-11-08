import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import type {
  GwAskRow,
  GwBillRow,
  GwFactionRow,
  GwPlotRow,
  GwWeakRow,
} from "../../HouseRows";
import type { GwLawRow } from "../../LawRows";

// GBR's house: factions, what they make of each bill, their own bills, and
// (S2) plots, weaknesses and allies' asks (ww158-format.md). Text in
// resources/ww1914/ko/GBR.house.json. The house itself (chambers, whip, way
// round) is in ./houses.ts and comes into play once this file has factions.
export const GBR_FACTIONS: readonly GwFactionRow[] = [];
/** Stances on the bills, by law id: existing bills and the factions' own. */
export const GBR_BILLS: readonly GwBillRow[] = [];
/** The factions' own bills: rows like content/laws/gbr.ts. */
export const GBR_HOUSE_LAWS: readonly GwLawRow[] = [];
/** Step scenes, split and join scenes, demand and bill scenes written by hand. */
export const GBR_HOUSE_SCENES: readonly GwScene[] = [];
// ---- S2 ----
export const GBR_PLOTS: readonly GwPlotRow[] = [];
export const GBR_WEAK: readonly GwWeakRow[] = [];
export const GBR_ASKS: readonly GwAskRow[] = [];
/** Plot signs, warnings, steps and ends; dossier scenes; asks; conferences. */
export const GBR_PLOT_SCENES: readonly GwScene[] = [];
