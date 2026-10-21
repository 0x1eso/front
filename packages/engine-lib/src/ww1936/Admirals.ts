// World War 1936 P4 — the admirals (spec §7.4). The type and
// admiralAvailable are the foundation's (plan Task 1 Step 15); lane G
// (Task 13) fills the table. Japanese admirals are titles only (ruling).
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type { AdmiralTrait } from "@openfront/engine-api/ww1936/NavyTypes";

export interface AdmiralDef {
  id: string;
  tag: CountryTag;
  atk: number;
  def: number;
  man: number;
  coord: number;
  traits: AdmiralTrait[];
  /** First day it serves (inclusive) and the day it leaves (exclusive), YYYY-MM-DD. */
  from?: string;
  until?: string;
  source: string;
  /** P4_PERSONS id of the same person (Task 13 Step 5): the two are never held at once. */
  alsoPerson?: string;
}

export const ADMIRALS: readonly AdmiralDef[] = [];

/** from ≤ date < until (dates as YYYY-MM-DD compare as strings). */
export function admiralAvailable(def: AdmiralDef, date: string): boolean {
  if (def.from !== undefined && date < def.from) return false;
  if (def.until !== undefined && date >= def.until) return false;
  return true;
}
