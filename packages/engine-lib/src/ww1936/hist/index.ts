// World War 1936 historical catalogue (owner-approved 2026-11-04): the
// registry. One file per country; add entries there, never here.
import { NATION_CORES } from "../content/nations/cores";
import { DEU_HIST } from "./deu";
import { FRA_HIST } from "./fra";
import { GBR_HIST } from "./gbr";
import { ITA_HIST } from "./ita";
import { JPN_HIST } from "./jpn";
import { SUN_HIST } from "./sun";
import { HistCountry, HistEntry, HistMajor } from "./Types";
import { USA_HIST } from "./usa";

/** The seven majors' catalogues (WeakGeneric and the minors' clamp read only these). */
export const HIST_MAJOR_CATALOGUE: Readonly<
  Record<HistMajor, readonly HistEntry[]>
> = {
  DEU: DEU_HIST,
  ITA: ITA_HIST,
  JPN: JPN_HIST,
  USA: USA_HIST,
  GBR: GBR_HIST,
  FRA: FRA_HIST,
  SUN: SUN_HIST,
};

/**
 * ww229 (design ww227 §6): the majors' catalogues, then each minor's that
 * has entries (content/nations/<tag>/core.ts, NATION_TAGS order). A key
 * here is a catalogue country.
 */
export const HIST_CATALOGUE: Readonly<
  Partial<Record<HistCountry, readonly HistEntry[]>>
> = {
  ...HIST_MAJOR_CATALOGUE,
  ...Object.fromEntries(
    NATION_CORES.filter((c) => c.equipment.length > 0).map((c) => [
      c.tag,
      c.equipment,
    ]),
  ),
};

/** Every entry, in country order then file order. Append only within a file once a game may depend on it. */
export const HIST_ALL: readonly HistEntry[] = Object.values(HIST_CATALOGUE)
  .filter((l): l is readonly HistEntry[] => l !== undefined)
  .flat();

/** ww229: the majors' entries only. */
export const HIST_MAJOR_ALL: readonly HistEntry[] = Object.values(
  HIST_MAJOR_CATALOGUE,
).flat();

/** ww229: the tag has a catalogue (a major, or a minor with entries). */
export function isHistCountry(
  tag: string | null | undefined,
): tag is HistCountry {
  return (
    tag !== null &&
    tag !== undefined &&
    Object.prototype.hasOwnProperty.call(HIST_CATALOGUE, tag)
  );
}

/** ww229: a catalogue's entries ([] for a minor without one). */
export function histList(country: HistCountry): readonly HistEntry[] {
  return HIST_CATALOGUE[country] ?? [];
}

const BY_ID: ReadonlyMap<string, HistEntry> = new Map(
  HIST_ALL.map((e) => [e.id, e]),
);
/** The entry with this id (undefined: none). */
export function histEntry(id: string): HistEntry | undefined {
  return BY_ID.get(id);
}
export { histStatsOf, histTableLines } from "./Convert";
export type { HistEntry } from "./Types";
