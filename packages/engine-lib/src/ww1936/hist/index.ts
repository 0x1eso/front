// World War 1936 historical catalogue (owner-approved 2026-11-04): the
// registry. One file per country; add entries there, never here.
import { DEU_HIST } from "./deu";
import { FRA_HIST } from "./fra";
import { GBR_HIST } from "./gbr";
import { ITA_HIST } from "./ita";
import { JPN_HIST } from "./jpn";
import { SUN_HIST } from "./sun";
import { HistCountry, HistEntry } from "./Types";
import { USA_HIST } from "./usa";

export const HIST_CATALOGUE: Readonly<
  Record<HistCountry, readonly HistEntry[]>
> = {
  DEU: DEU_HIST,
  ITA: ITA_HIST,
  JPN: JPN_HIST,
  USA: USA_HIST,
  GBR: GBR_HIST,
  FRA: FRA_HIST,
  SUN: SUN_HIST,
};

/** Every entry, in country order then file order. Append only within a file once a game may depend on it. */
export const HIST_ALL: readonly HistEntry[] =
  Object.values(HIST_CATALOGUE).flat();

const BY_ID: ReadonlyMap<string, HistEntry> = new Map(
  HIST_ALL.map((e) => [e.id, e]),
);
/** The entry with this id (undefined: none). */
export function histEntry(id: string): HistEntry | undefined {
  return BY_ID.get(id);
}
export { histStatsOf, histTableLines } from "./Convert";
export type { HistEntry } from "./Types";
