// World War 1936 P2: the generals (P2 spec §6.2). The functions are the
// foundation's; Task 10 fills the roster.
import { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  GeneralTrait,
  traitBit,
  WW_TITLED_GENERAL_BASE,
} from "@openfront/engine-api/ww1936/LandTypes";
import { dayOfDate } from "./Calendar";

export interface GeneralDef {
  /** Translation key ww1936.general.<id>. */
  id: string;
  tag: CountryTag;
  att: number;
  def: number;
  plan: number;
  log: number;
  traits: readonly GeneralTrait[];
  /** ISO date it can first serve (spec §6.2); none: from the start. */
  from?: string;
  /** ISO date it leaves (arrest, dismissal). */
  until?: string;
  /** Spans it cannot serve, [from, until) ISO. */
  gaps?: readonly (readonly [string, string])[];
  /** Where the dates and the exclusion check come from (Task 10). */
  source: string;
}

// Append only: a general's id in a game is its index + 1 (plan decision 17).
// Task 10 fills the roster (spec §6.2); these two are the foundation's test seed.
export const GENERALS: readonly GeneralDef[] = [
  {
    id: "rundstedt",
    tag: "DEU",
    att: 4,
    def: 4,
    plan: 3,
    log: 3,
    traits: [],
    source: "seed",
  },
  {
    id: "bock",
    tag: "DEU",
    att: 4,
    def: 3,
    plan: 3,
    log: 3,
    traits: [],
    source: "seed",
  },
];

export function traitMask(traits: readonly GeneralTrait[]): number {
  let m = 0;
  for (const t of traits) m |= traitBit(t);
  return m;
}

/** GENERALS ids of a country, by skill sum descending then id. */
export function rosterOf(tag: CountryTag): number[] {
  const out: number[] = [];
  GENERALS.forEach((g, i) => {
    if (g.tag === tag) out.push(i + 1);
  });
  const sum = (id: number) => {
    const g = GENERALS[id - 1];
    return g.att + g.def + g.plan + g.log;
  };
  return out.sort((a, b) => sum(b) - sum(a) || a - b);
}

/** Spec §6.2: whether the general can serve on `day`. */
export function generalServes(g: GeneralDef, day: number): boolean {
  if (g.from !== undefined && day < dayOfDate(g.from)) return false;
  if (g.until !== undefined && day >= dayOfDate(g.until)) return false;
  for (const [a, b] of g.gaps ?? []) {
    if (day >= dayOfDate(a) && day < dayOfDate(b)) return false;
  }
  return true;
}

/**
 * A titled general's id (plan decision 17, pre-flight U21): the title
 * number in the thousands, the country below, so no count of titles makes
 * two countries' ids meet (smallIDs stay below 1000).
 */
export function titledGeneralId(smallID: number, titleNo: number): number {
  return WW_TITLED_GENERAL_BASE + titleNo * 1000 + smallID;
}

/** Whether a general id is a titled general's (not a GENERALS index + 1). */
export function isTitledGeneral(id: number): boolean {
  return id >= WW_TITLED_GENERAL_BASE;
}

/** The title number of a titled general's id ("Commander No. n"); 0 for a named one. */
export function titleNoOfGeneral(id: number): number {
  return isTitledGeneral(id)
    ? Math.floor((id - WW_TITLED_GENERAL_BASE) / 1000)
    : 0;
}
