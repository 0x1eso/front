// World War 1936 P3: advisors (spec §8.1, §8.4; plan decision 19). Eight
// seats (ADVISOR_SLOTS). A seat changed by a hire or a dismissal stays as
// it is for 30 days; a person serves in one seat at a time; a dismissed
// person costs again when hired back.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  ADVISOR_COST,
  ADVISOR_SLOTS,
  IDEOLOGIES,
  PersonDef,
  SLOT_BRANCHES,
  TraitId,
  WW_ADVISOR_LOCK_DAYS,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import { GENERALS } from "@openfront/engine-lib/ww1936/Generals";
import { costWith } from "@openfront/engine-lib/ww1936/PoliticsRules";
import { payPp } from "./PayPp";
import type { CountryPol, WwPolitics } from "./WwPolitics";

/** ISO date → day number, parsed once per string. */
const DAYS = new Map<string, number>();
function dayOf(iso: string): number {
  let d = DAYS.get(iso);
  if (d === undefined) {
    d = dayOfDate(iso);
    DAYS.set(iso, d);
  }
  return d;
}

/** Plan decision 19: the person's P2 general leads one of `id`'s armies now. */
function leadsArmy(pol: WwPolitics, id: number, p: PersonDef): boolean {
  if (p.alsoGeneral === undefined) return false;
  const roster = GENERALS.findIndex((g) => g.id === p.alsoGeneral);
  if (roster < 0) return false;
  const g = pol.land.country(id)?.generals.find((x) => x.roster === roster);
  return g !== undefined && g.army !== 0;
}

/**
 * Spec §5.6-5, §8.3: the advisor fits a government of `ideology` (an
 * IDEOLOGIES index) — a person's own ideology and every trait's (e.g. the
 * communist `planner`, a titled card too) are none or that one.
 */
export function advisorFitsIdeology(
  pol: WwPolitics,
  c: CountryPol,
  a: string,
  ideology: number,
): boolean {
  const name = IDEOLOGIES[ideology];
  if (!a.startsWith("title:")) {
    const p = pol.content.personIdx.get(a);
    if (p?.ideology !== undefined && p.ideology !== name) return false;
  }
  return pol
    .traitsOf(c, a)
    .every((t) => t.ideology === undefined || t.ideology === name);
}

/**
 * Spec §8.1 (controller ruling R9): a person may be hired by `id` today —
 * an advisor of that country, within their dates (or opened by
 * add_advisor_candidate, which overrides both dates; a `locked` person
 * only so), of the ruling ideology or none, not the leader, not
 * dismissed, not leading an army.
 */
function personOpen(
  pol: WwPolitics,
  c: CountryPol,
  p: PersonDef,
  day: number,
): boolean {
  if (!p.roles.includes("advisor") || p.advisor === undefined) return false;
  if (c.dismissed.includes(p.id) || c.leader === p.id) return false;
  if (!advisorFitsIdeology(pol, c, p.id, c.ruling)) return false;
  if (!c.candidates.includes(p.id)) {
    if (p.locked === true) return false;
    if (p.from !== undefined && day < dayOf(p.from)) return false;
    if (p.until !== undefined && day >= dayOf(p.until)) return false;
  }
  return !leadsArmy(pol, c.smallID, p);
}

/**
 * The person ids (and titled cards) `id` may hire today, not seated yet:
 * persons in content order, then a "title:<trait>" card for every generic
 * trait in trait order.
 */
export function candidatesFor(
  pol: WwPolitics,
  id: number,
  day: number,
): string[] {
  const c = pol.country(id);
  if (c === null) return [];
  const out: string[] = [];
  for (const p of pol.content.personsOf.get(c.tag) ?? []) {
    if (!c.advisors.includes(p.id) && personOpen(pol, c, p, day)) {
      out.push(p.id);
    }
  }
  for (const t of pol.content.traits) {
    const a = `title:${t.id}`;
    if (!t.generic || c.advisors.includes(a)) continue;
    if (t.ideology === undefined || t.ideology === IDEOLOGIES[c.ruling]) {
      out.push(a);
    }
  }
  return out;
}

/** Spec §8.1: the seat takes the advisor's (first) trait's branch. */
function fitsSlot(
  pol: WwPolitics,
  c: CountryPol,
  slot: number,
  a: string,
): boolean {
  const t = pol.traitsOf(c, a)[0];
  return (
    t !== undefined && SLOT_BRANCHES[ADVISOR_SLOTS[slot]].includes(t.branch)
  );
}

/** Whether `a` may be hired by `c` today (a title: any generic trait's card). */
function hireable(
  pol: WwPolitics,
  c: CountryPol,
  a: string,
  day: number,
): boolean {
  if (a.startsWith("title:")) {
    return (
      pol.content.traitIdx.get(a.slice(6) as TraitId)?.generic === true &&
      advisorFitsIdeology(pol, c, a, c.ruling)
    );
  }
  const p = pol.content.personIdx.get(a);
  return p !== undefined && p.country === c.tag && personOpen(pol, c, p, day);
}

/**
 * Spec §8.1: pays the seat's cost (advisorCostPct) and seats `advisor`. A
 * seated advisor in that seat is replaced (no refund). The seat stays for
 * 30 days.
 */
export function hireAdvisor(
  pol: WwPolitics,
  id: number,
  slot: number,
  advisor: string,
  day: number,
): WwOrderBlock | null {
  const c = pol.country(id);
  if (c === null) return "dead";
  if (!Number.isInteger(slot) || slot < 0 || slot >= ADVISOR_SLOTS.length) {
    return "bad_index";
  }
  if (c.advisorLockUntil[slot] > day) return "slot_locked";
  if (
    c.advisors.includes(advisor) ||
    !hireable(pol, c, advisor, day) ||
    !fitsSlot(pol, c, slot, advisor)
  ) {
    return "advisor_unavailable";
  }
  const cost = costWith(
    ADVISOR_COST[ADVISOR_SLOTS[slot]],
    c.stats.advisorCostPct,
  );
  if (!payPp(pol, id, cost)) return "no_pp";
  c.advisors[slot] = advisor;
  c.advisorLockUntil[slot] = day + WW_ADVISOR_LOCK_DAYS;
  pol.recomputeStats(id);
  pol.markCountry(id);
  return null;
}

/** Spec §8.1: dismissal is free; the seat then stays empty for 30 days. */
export function fireAdvisor(
  pol: WwPolitics,
  id: number,
  slot: number,
  day: number,
): WwOrderBlock | null {
  const c = pol.country(id);
  if (c === null) return "dead";
  if (!Number.isInteger(slot) || slot < 0 || slot >= ADVISOR_SLOTS.length) {
    return "bad_index";
  }
  if (c.advisors[slot] === null) return "advisor_unavailable";
  if (c.advisorLockUntil[slot] > day) return "slot_locked";
  c.advisors[slot] = null;
  c.advisorLockUntil[slot] = day + WW_ADVISOR_LOCK_DAYS;
  pol.recomputeStats(id);
  pol.markCountry(id);
  return null;
}

/**
 * Spec §8.1: a person whose `until` has come leaves their seat, unless an
 * add_advisor_candidate effect opened them (controller ruling R9). Their
 * country hears of it. Runs in the country's political day.
 */
export function dismissExpired(
  pol: WwPolitics,
  c: CountryPol,
  day: number,
): void {
  let changed = false;
  c.advisors.forEach((a, i) => {
    if (a === null || a.startsWith("title:")) return;
    const p = pol.content.personIdx.get(a);
    if (p?.until === undefined || day < dayOf(p.until)) return;
    if (c.candidates.includes(a)) return;
    c.advisors[i] = null;
    changed = true;
    pol.message(c.smallID, "ww1936_advisor_left", { person: a });
  });
  if (changed) pol.recomputeStats(c.smallID);
}
