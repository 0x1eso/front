// Great War 1914 (ww200/ww201): shells, bread and money from what a country
// makes and holds. The engine's production step (engine/ww1914/Economy.ts)
// adds its terms to the budget's drift each chapter; this file is the shape
// it keeps on the country and the words the screen and the departments read.
import { z } from "zod";

/** The gauges the production step feeds. */
export const GW_ECON_GAUGES = ["shells", "bread", "money"] as const;
export type GwEconGauge = (typeof GW_ECON_GAUGES)[number];

/**
 * A gauge's trend in words, from the net points a year (100 = a step a year).
 * Text: `gw.ui.trend.<word>`, and `depts.words.<word>` in the answers' slots
 * `shells_trend`, `bread_trend`, `money_trend`. `full`: at its top and still
 * rising ("더 쌓을 곳이 없다").
 */
export const GW_TREND_WORDS = [
  "falling_fast",
  "falling",
  "steady",
  "rising",
  "rising_fast",
  "full",
] as const;
export type GwTrendWord = (typeof GW_TREND_WORDS)[number];

/** Net points a year at which a trend is "rising" / "rising_fast" (and down). */
export const GW_TREND_SLOW = 50;
export const GW_TREND_FAST = 300;

/** -2..2 from net points a year. */
export function gwTrendOf(points: number): number {
  const a = Math.abs(points);
  const band = a >= GW_TREND_FAST ? 2 : a >= GW_TREND_SLOW ? 1 : 0;
  return points < 0 ? -band : band;
}

/** The word for a trend -2..2 on a gauge at `value` of `max`. */
export function gwTrendWord(
  trend: number,
  value: number,
  max: number,
): GwTrendWord {
  if (trend > 0 && value >= max) return "full";
  return GW_TREND_WORDS[Math.max(-2, Math.min(2, trend)) + 2];
}

/**
 * The reason keys the production step writes (text `gw.line.<key>`): its own
 * terms, and the old keys a term took over from a flat tick (ww200 §1).
 */
export const GW_ECON_KEYS = [
  // Shells.
  "econ_industry", // own and annexed land's works
  "econ_held", // occupied land's works and mines
  "econ_mobilised", // industry mobilised after the first shell crisis
  "econ_fronts", // the fronts burn shells
  "shells_blockade", // copper and nitrates cut
  // Bread.
  "econ_farms", // own and annexed land's harvest, by the season
  "bread_bad_harvest", // the same in a bad year
  "rule_requisition", // grain taken from occupied land
  "econ_imports", // grain by sea
  "bread_blockade", // the blockade cuts the grain ships
  "bread_uboats", // U-boats sink them
  "econ_labour", // farmhands gone to the army
  "bread_rail", // the railways lose it on the way
  "bread_two_halves", // Hungary holds its grain back
  "econ_eaters", // the towns and the army eat
  // Money.
  "econ_land", // taxes of land gained
  "econ_land_lost", // taxes of land lost
  "rule_levy", // levies on occupied land
  "econ_trade", // customs, shipping and the City
  "econ_tribute", // a vassal's or a new state's tribute (bread and money)
  "econ_tribute_paid", // what a vassal pays its overlord
  // Peace.
  "econ_peace", // the stores refill to their usual level
] as const;
export type GwEconKey = (typeof GW_ECON_KEYS)[number];

const int = z.number().int();

/**
 * What the production step keeps on a country (absent until it first runs).
 * `rate`: net points a year of the last chapter, budget, plan and terms
 * together; `why`: the largest term in that direction ("" none);
 * `moved`: what the step moved at the last chapter's turn (the "지금" line).
 */
export const GwEconStateSchema = z.object({
  rate: z.record(z.enum(GW_ECON_GAUGES), int),
  why: z.record(z.enum(GW_ECON_GAUGES), z.string()),
  moved: z.array(
    z.object({
      gauge: z.enum(GW_ECON_GAUGES),
      delta: int,
      key: z.string(),
      chapter: int,
    }),
  ),
  /** Chapter its shells first ran dry at war; null never. */
  dry: int.nullable(),
  /** Chapter its industry mobilised (the shell crisis); null not yet. */
  mobilised: int.nullable(),
  /** Chapter its bread last fell to 1 or less at war; absent while above. */
  lean: int.optional(),
});
export type GwEconState = z.infer<typeof GwEconStateSchema>;
