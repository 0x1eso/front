// World War 1936 P4: naval line judgements the industry drawer and the
// engine share (P4 spec §5.2–§5.3). Lane E fills the bodies; the
// foundation fixes the names and shapes (pre-flight A21).
import { SHIP_CLASSES } from "@openfront/engine-api/ww1936/NavyTypes";
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
 * Days until the line's next launch at `outputMilli` a day (yesterday's
 * output); -1 when it makes nothing (no dock, no resources, no port).
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
