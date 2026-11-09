// France's house (ww158 shapes, HouseRows.ts; words in ./kit.ts). The chambers,
// whip and way round are FRA_HOUSE in ./houses.ts; the house comes into play
// the moment FRA_FACTIONS has rows. Text in resources/ww1914/ko/FRA.house.json.
// Lane W6 (ww166-format.md).
import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import type {
  GwAskRow,
  GwBillRow,
  GwFactionRow,
  GwPlotRow,
  GwWeakRow,
} from "../../HouseRows";
import type { GwLawRow } from "../../LawRows";

export const FRA_FACTIONS: readonly GwFactionRow[] = [];

export const FRA_BILLS: readonly GwBillRow[] = [];

export const FRA_HOUSE_LAWS: readonly GwLawRow[] = [];

export const FRA_HOUSE_SCENES: readonly GwScene[] = [];

export const FRA_PLOTS: readonly GwPlotRow[] = [];

export const FRA_WEAK: readonly GwWeakRow[] = [];

export const FRA_ASKS: readonly GwAskRow[] = [];

export const FRA_PLOT_SCENES: readonly GwScene[] = [];
