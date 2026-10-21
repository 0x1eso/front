// World War 1936 P4: naval line judgements the industry drawer and the
// engine share (P4 spec §5.2–§5.3). Lane E fills the bodies; the
// foundation fixes the names and shapes (pre-flight A21).
import {
  SHIP_CLASSES,
  WW_DOCK_OUTPUT_MILLI,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { RES_FLOOR_PERMILLE } from "./EconomyRules";
import { lineUnitCost } from "./ShipStats";

/** What a naval line looks like to the pure rules (engine NavalLine, the screens' NavalLineData). */
export interface NavalLineLike {
  /** SHIP_CLASSES index, or SHIP_CLASSES.length for a convoy line. */
  cls: number;
  gen: number;
  /** Industry milli done on the next unit. */
  progress: number;
}

/** A line's unit cost, industry milli. */
export function lineCostMilli(line: NavalLineLike): number {
  const cls =
    line.cls >= SHIP_CLASSES.length ? "convoy" : SHIP_CLASSES[line.cls];
  return lineUnitCost(cls, line.gen) * 1000;
}

/**
 * Spec §5.2: a naval line's day, industry milli = dockyards × 2,500 ×
 * (100 + output%) / 100 × the resource factor / 1000. The resource factor
 * is P1's (20% with nothing, 100% with everything: lineOutputMilli); there
 * is no efficiency (HOI4's naval production). `outputPct` is
 * stats.dockOutputPct + the laws' and the stats' outputPct.
 */
export function navalLineOutputMilli(
  docks: number,
  outputPct: number,
  fillPermille: number,
): number {
  if (docks <= 0) return 0;
  const resFactor =
    RES_FLOOR_PERMILLE +
    Math.floor(((1000 - RES_FLOOR_PERMILLE) * fillPermille) / 1000);
  const base = docks * WW_DOCK_OUTPUT_MILLI;
  const withBonus = Math.floor((base * Math.max(0, 100 + outputPct)) / 100);
  return Math.floor((withBonus * resFactor) / 1000);
}

/**
 * Days until the line's next launch at `outputMilli` a day (yesterday's
 * output); -1 when it makes nothing (no dock, no resources, no port).
 * Read after day D's output: the launch comes on day D + this.
 */
export function nextLaunchDays(
  line: NavalLineLike,
  outputMilli: number,
): number {
  if (outputMilli <= 0) return -1;
  return Math.max(
    0,
    Math.ceil((lineCostMilli(line) - line.progress) / outputMilli),
  );
}
