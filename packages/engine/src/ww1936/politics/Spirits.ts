// World War 1936 P3: national spirits (spec §9). A spirit is on a country
// at most once; `untilDay` -1 is for good. Every change re-sums the
// country's stats (spec §3.3).
import type {
  SpiritDef,
  SpiritId,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import type { CountryPol, WwPolitics } from "./WwPolitics";

/** dmzRegions' answer while no rule is on (callers only read it). */
const NONE: number[] = [];

/**
 * dmzRegions' answer per country, kept until its spirits change (P2's
 * canEnter asks for every edge). Valid while the list is the same array of
 * the same length; the functions below that change a spirit in place drop
 * it. Never state (derived from the spirits).
 */
const DMZ = new WeakMap<
  CountryPol,
  { spirits: unknown[]; length: number; regions: number[] }
>();

function changed(c: CountryPol): void {
  DMZ.delete(c);
}

/**
 * Spec §9.1: adds `spirit` (for `days`, or for good); a spirit already on
 * keeps the longer of its two terms.
 */
export function addSpirit(
  pol: WwPolitics,
  id: number,
  spirit: SpiritId,
  days: number | undefined,
  day: number,
): void {
  const c = pol.country(id);
  if (c === null) return;
  const until = days === undefined ? -1 : day + days;
  const s = c.spirits.find((x) => x.id === spirit);
  if (s === undefined) {
    c.spirits.push({ id: spirit, untilDay: until, addedDay: day });
    changed(c);
  } else if (s.untilDay >= 0 && (until < 0 || until > s.untilDay)) {
    s.untilDay = until;
  }
  pol.recomputeStats(id);
}

export function removeSpirit(
  pol: WwPolitics,
  id: number,
  spirit: SpiritId,
): void {
  const c = pol.country(id);
  if (c === null) return;
  c.spirits = c.spirits.filter((s) => s.id !== spirit);
  changed(c);
  pol.recomputeStats(id);
}

/**
 * Spec §9.1: `to` takes `from`'s place in the list (the screens' order
 * holds), for good; without `from` it is an add_spirit, for good — or
 * nothing when `to` is on already (its term stays). When `to` is on
 * already, `from` just goes.
 */
export function swapSpirit(
  pol: WwPolitics,
  id: number,
  from: SpiritId,
  to: SpiritId,
  day: number,
): void {
  const c = pol.country(id);
  if (c === null) return;
  const i = c.spirits.findIndex((s) => s.id === from);
  if (i < 0) {
    if (!c.hasSpirit(to)) addSpirit(pol, id, to, undefined, day);
    return;
  }
  if (from !== to && c.hasSpirit(to)) c.spirits.splice(i, 1);
  else c.spirits[i] = { id: to, untilDay: -1, addedDay: day };
  changed(c);
  pol.recomputeStats(id);
}

/** Spec §9.1: timed spirits whose day has come go, on the country's own day. */
export function expireSpirits(
  pol: WwPolitics,
  c: CountryPol,
  day: number,
): void {
  if (!c.spirits.some((s) => s.untilDay >= 0 && s.untilDay <= day)) return;
  c.spirits = c.spirits.filter((s) => s.untilDay < 0 || s.untilDay > day);
  changed(c);
  pol.recomputeStats(c.smallID);
}

/** The definitions of `id`'s spirits that carry rules. */
function ruled(pol: WwPolitics, id: number): SpiritDef[] {
  const c = pol.country(id);
  if (c === null) return [];
  const out: SpiritDef[] = [];
  for (const s of c.spirits) {
    const d = pol.content.spiritIdx.get(s.id);
    if (d?.rules !== undefined) out.push(d);
  }
  return out;
}

export function hasRule(
  pol: WwPolitics,
  id: number,
  rule: "no_faction" | "no_justify" | "no_elections" | "free_guarantees",
): boolean {
  return ruled(pol, id).some((d) => d.rules!.includes(rule));
}

/**
 * The value of a numeric spirit rule in force for `id` (the smallest
 * guaranteeGatePct, the largest factionGateMinusPp); null when none
 * (controller ruling R2).
 */
export function ruleValue(
  pol: WwPolitics,
  id: number,
  rule: "guaranteeGatePct" | "factionGateMinusPp",
): number | null {
  let v: number | null = null;
  for (const d of ruled(pol, id)) {
    for (const r of d.rules!) {
      if (typeof r !== "object") continue;
      if (rule === "guaranteeGatePct" && "guaranteeGatePct" in r) {
        v = v === null ? r.guaranteeGatePct : Math.min(v, r.guaranteeGatePct);
      } else if (rule === "factionGateMinusPp" && "factionGateMinusPp" in r) {
        v =
          v === null ? r.factionGateMinusPp : Math.max(v, r.factionGateMinusPp);
      }
    }
  }
  return v;
}

/**
 * {dmz} groups in force for `id`, ascending region ids; P2 movement and P1
 * construction read it, often: cached per country until its spirits
 * change (DMZ above).
 */
export function dmzRegions(pol: WwPolitics, id: number): number[] {
  const c = pol.country(id);
  if (c === null) return NONE;
  const hit = DMZ.get(c);
  if (
    hit !== undefined &&
    hit.spirits === c.spirits &&
    hit.length === c.spirits.length
  ) {
    return hit.regions;
  }
  const regions = dmzOf(pol, c);
  DMZ.set(c, { spirits: c.spirits, length: c.spirits.length, regions });
  return regions;
}

function dmzOf(pol: WwPolitics, c: CountryPol): number[] {
  let out: number[] | null = null;
  for (const s of c.spirits) {
    const rules = pol.content.spiritIdx.get(s.id)?.rules;
    if (rules === undefined) continue;
    for (const r of rules) {
      if (typeof r !== "object" || !("dmz" in r)) continue;
      for (const region of pol.content.groupIdx.get(r.dmz)?.regions ?? []) {
        out ??= [];
        if (!out.includes(region)) out.push(region);
      }
    }
  }
  return out === null ? NONE : out.sort((a, b) => a - b);
}
