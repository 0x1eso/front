// ww91 (lane N0): the national units of the seven majors. No new battalion
// ids: a focus gives the country the `natUnit` stat (1-7, a hidden line), and
// from then on its base battalion carries the row's numbers. Percent changes
// (org in whole points), read by DoctrineRules.battalionStatPct. The extra
// rules (landing cut, raid bonus, fort share) and the names are lane N2's.
import type { BattalionId } from "@openfront/engine-api/ww1936/LandTypes";

export interface NatUnitRow {
  /** Country tag the unit belongs to (display, tests). */
  tag: string;
  /** The base battalion that becomes the national unit. */
  bat: BattalionId;
  soft: number;
  hard: number;
  brk: number;
  /** Organisation, whole points. */
  org: number;
  hp: number;
  supply: number;
  train: number;
}

const row = (
  tag: string,
  bat: BattalionId,
  p: Partial<Omit<NatUnitRow, "tag" | "bat">>,
): NatUnitRow => ({
  tag,
  bat,
  soft: 0,
  hard: 0,
  brk: 0,
  org: 0,
  hp: 0,
  supply: 0,
  train: 0,
  ...p,
});

/** Indexed by `natUnit` - 1: DEU, SUN, USA, GBR, FRA, JPN, ITA. */
export const NATIONAL_UNITS: readonly NatUnitRow[] = [
  row("DEU", "motorized", { brk: 10, org: 5, supply: 15, train: 15 }),
  row("SUN", "mountain", { soft: 10, hard: 10, org: 5, supply: 10, train: 25 }),
  row("USA", "marine", { soft: 10, hard: 10, hp: 15, supply: 15, train: 15 }),
  row("GBR", "marine", { brk: 10, org: 5, hp: -10, train: 25 }),
  row("FRA", "mountain", { org: 10, supply: 15, train: 25 }),
  row("JPN", "marine", { soft: 10, hard: 10, hp: -10, supply: -15 }),
  row("ITA", "mountain", { brk: 10, org: 5, hp: -10, supply: 10 }),
];

/** `natUnit` values that carry an extra rule (the index in NATIONAL_UNITS + 1). */
export const NAT_UNIT_USA = 3;
export const NAT_UNIT_GBR = 4;
export const NAT_UNIT_ITA = 7;
/** American Marines: their landing cut falls by this many bp (35 -> 25 %). */
export const NAT_MARINE_LANDING_EASE_BP = 1000;
/** Italian Alpini pay this percent of the river and fort penalties (assault infantry: 85). */
export const NAT_ALPINI_OBSTACLE_PCT = 70;
/** British Commandos: raid success added, per mille. */
export const NAT_COMMANDO_RAID_PM = 100;

/** The unit row of `natUnit` when `bat` is its base battalion, else null. */
export function natUnitRow(natUnit: number, bat: string): NatUnitRow | null {
  if (natUnit < 1 || natUnit > NATIONAL_UNITS.length) return null;
  const r = NATIONAL_UNITS[natUnit - 1];
  return r.bat === bat ? r : null;
}
