// World War 1936 diplomacy D2 (ww161 Design B §2; lane L5): collaboration
// governments on a capitulated country's occupied land — the order, the
// country it wakes, the neutral collaborator subject, its end when the
// exile comes home, and the AI's monthly check.
//
// The country used, in order:
//  1. the capitulated tag itself, when it is gone (not an exile) and the
//     pick is all of its legal land. With legal land left over, the woken
//     country would get all of it back the next day (Liberation: land a
//     country at peace holds goes back to a living legal owner), whatever
//     was picked;
//  2. the named dormant tag content maps to it (DiploTypes.COLLAB_TAGS);
//  3. the first dormant civil-war slot, named "<country> 국가".
// The collaborator gets no cores (as the scripted Vichy): its land stays
// administered by it, and the creator's garrison duty there ends.
import {
  CIVIL_WAR_SLOTS,
  COUNTRIES,
  type CountryTag,
} from "@openfront/engine-api/ww1936/Countries";
import {
  COLLAB_TAGS,
  DIPLO_NOTICES,
  noticeId,
  WW_COLLAB_AI_COVER_PCT,
  WW_COLLAB_AI_HOLD_DAYS,
  WW_COLLAB_AI_HOLD_PCT,
  WW_COLLAB_AI_RES_BP,
  WW_COLLAB_EXILE_LEGIT_LOSS_BP,
  WW_COLLAB_HOLD_DAYS,
  WW_COLLAB_MIN_VP_PCT,
  WW_COLLAB_PP,
  WW_COLLAB_TENSION_PCT,
} from "@openfront/engine-api/ww1936/DiploTypes";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import { CS_DORMANT, CS_GONE } from "@openfront/engine-api/ww1936/EndgameTypes";
import {
  IDEO_DEM,
  IDEOLOGIES,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  civilWarColor,
  coveragePct,
  packRgb,
} from "@openfront/engine-lib/ww1936/EndgameRules";
import { evictDivisions, transferRegionPeaceful } from "../land/PoliticsBridge";
import { leaveFaction } from "../politics/Factions";
import { payPp } from "../politics/PayPp";
import { addTension, scaledTension } from "../politics/Tension";
import { activateCountry } from "./Activate";
import type { StoredCollab } from "./DiploState";
import { needOf } from "./Garrison";
import { endSubject } from "./Subjects";
import { countryParams } from "./Wars";
import type { WwEndgame } from "./WwEndgame";

/** A civil-war slot used as a collaborator: "<country> 국가" ({country}: the origin). */
export const COLLAB_NAME_KEY = "ww1936.cw_name.collab";
/** The AI looks every this many days (day % 30 === smallID % 30). */
const AI_DAYS = 30;

/** Days `region` has been administered by its controller (0: not counted). */
function heldDays(eg: WwEndgame, region: number, day: number): number {
  const s = eg.occSince[region];
  return s > 0 ? day + 1 - s : 0;
}

/** Capitulated: gone (not dormant) or a government in exile. */
function capitulated(eg: WwEndgame, id: number): boolean {
  return eg.isExile(id) || eg.countryStateArr[id] === CS_GONE;
}

/** The regions of `id`'s claim groups (content claims). */
function claimRegions(eg: WwEndgame, id: number): Set<number> {
  const pol = eg.ww.politics;
  const tag = eg.ww.tagOf(id);
  const out = new Set<number>();
  for (const row of pol.content.claims) {
    if (row.tag !== tag) continue;
    for (const g of row.groups) {
      for (const r of pol.content.groupIdx.get(g)?.regions ?? []) out.add(r);
    }
  }
  return out;
}

/** In the stake of a conference still to settle (its result decides). */
function inOpenStake(eg: WwEndgame, region: number): boolean {
  return eg.conferences.some((c) => c.status !== 2 && c.stake.includes(region));
}

/** The named collaboration tag content maps `origin` to (null: none). */
function mappedTag(eg: WwEndgame, origin: number): CountryTag | null {
  const tag = eg.ww.tagOf(origin);
  return COLLAB_TAGS.find(([o]) => o === tag)?.[1] ?? null;
}

/** Drops the records of collaborators that no longer play as their creator's subject. */
export function pruneCollabs(eg: WwEndgame): void {
  if (eg.collabs.length === 0) return;
  const kept = eg.collabs.filter(
    (c) =>
      eg.isActor(c.smallID) && eg.subjectOf(c.smallID)?.overlord === c.creator,
  );
  if (kept.length !== eg.collabs.length) {
    eg.collabs = kept;
    eg.dirtyDiplo = true;
  }
}

/**
 * Who may: `from` holds the most of `target`'s legal victory points,
 * counting for itself only what it has administered WW_COLLAB_HOLD_DAYS.
 */
function mainOccupier(
  eg: WwEndgame,
  from: number,
  target: number,
  day: number,
): boolean {
  const ww = eg.ww;
  const legal = ww.politics.legalOwner;
  const ctl = ww.land.controller;
  let mine = 0;
  const others = new Map<number, number>();
  for (const r of ww.scenario.landRegions) {
    if ((legal[r.id] ?? 0) !== target) continue;
    const c = ctl[r.id] ?? 0;
    if (c === from) {
      if (heldDays(eg, r.id, day) >= WW_COLLAB_HOLD_DAYS) mine += r.vp;
    } else if (c !== 0 && c !== target) {
      others.set(c, (others.get(c) ?? 0) + r.vp);
    }
  }
  if (mine <= 0) return false;
  for (const v of others.values()) if (v > mine) return false;
  return true;
}

/** The tag to wake (see the head comment); null: no country is free. */
export function collabTag(
  eg: WwEndgame,
  target: number,
  regions: readonly number[],
): CountryTag | null {
  const ww = eg.ww;
  const sc = ww.scenario;
  const legal = ww.politics.legalOwner;
  if (!eg.isExile(target) && eg.countryStateArr[target] === CS_GONE) {
    const pick = new Set(regions);
    const all = sc.landRegions.every(
      (r) => (legal[r.id] ?? 0) !== target || pick.has(r.id),
    );
    if (all) return ww.tagOf(target);
  }
  const named = mappedTag(eg, target);
  if (named !== null) {
    const id = sc.smallIdOf(named);
    if (id > 0 && eg.countryStateArr[id] === CS_DORMANT) return named;
  }
  return (
    CIVIL_WAR_SLOTS.find((t) => {
      const id = sc.smallIdOf(t);
      return id > 0 && eg.countryStateArr[id] === CS_DORMANT;
    }) ?? null
  );
}

/** Why `from` may not set up a collaborator on `target`'s `regions` (null: it may). */
export function collabBlock(
  eg: WwEndgame,
  from: number,
  target: number,
  regions: readonly number[],
  day: number,
): WwOrderBlock | null {
  if (target <= 0 || target >= eg.size || target === from) return "bad_target";
  if (!capitulated(eg, target)) return "bad_target";
  if (!eg.isActor(from) || eg.isExile(from)) return "collab_not_occupier";
  const ww = eg.ww;
  const pol = ww.politics;
  const c = pol.country(from);
  if (c === null) return "collab_not_occupier";
  if (c.ruling === IDEO_DEM) return "collab_democracy";
  // One government a country; a scripted one (Vichy) blocks the generic order.
  pruneCollabs(eg);
  if (eg.collabs.some((x) => x.origin === target)) return "collab_scripted";
  const named = mappedTag(eg, target);
  if (named !== null) {
    const id = ww.scenario.smallIdOf(named);
    if (id > 0 && eg.isActor(id)) return "collab_scripted";
  }
  if (!mainOccupier(eg, from, target, day)) return "collab_not_occupier";
  const legal = pol.legalOwner;
  const ctl = ww.land.controller;
  const claims = claimRegions(eg, from);
  const seen = new Set<number>();
  let vp = 0;
  for (const r of regions) {
    const reg = ww.scenario.region(r);
    if (
      reg === undefined ||
      seen.has(r) ||
      (legal[r] ?? 0) !== target ||
      ctl[r] !== from ||
      eg.hasCore(from, r) ||
      claims.has(r) ||
      inOpenStake(eg, r)
    ) {
      return "collab_bad_region";
    }
    seen.add(r);
    vp += reg.vp;
  }
  let total = 0;
  for (const r of ww.scenario.landRegions) {
    if ((legal[r.id] ?? 0) === target) total += r.vp;
  }
  if (vp <= 0 || vp * 100 < total * WW_COLLAB_MIN_VP_PCT) {
    return "collab_too_small";
  }
  if (collabTag(eg, target, regions) === null) return "collab_no_slot";
  if (c.ppMilli < WW_COLLAB_PP * 1000) return "no_pp";
  return null;
}

/** collab_create by `from` on capitulated `target`'s `regions`. */
export function createCollab(
  eg: WwEndgame,
  from: number,
  target: number,
  regions: readonly number[],
  tick: number,
): WwOrderBlock | null {
  const ww = eg.ww;
  const day = ww.day(tick);
  const block = collabBlock(eg, from, target, regions, day);
  if (block !== null) return block;
  const tag = collabTag(eg, target, regions)!;
  const pol = ww.politics;
  const ideology = IDEOLOGIES[pol.country(from)!.ruling];
  const originTag = ww.tagOf(target);
  const slot = (CIVIL_WAR_SLOTS as readonly string[]).includes(tag);
  const pick = [...regions].sort((a, b) => a - b);
  const id = activateCountry(
    eg,
    tag,
    {
      regions: pick,
      from: [target],
      overlord: { smallID: from, level: "puppet", neutral: true },
      government: { ideology },
      equipFrom: from,
      techFrom: from,
      faction: "none",
      ...(slot
        ? {
            nameKey: COLLAB_NAME_KEY,
            nameArg: originTag,
            color: packRgb(civilWarColor(COUNTRIES[originTag].color, ideology)),
          }
        : {}),
    },
    tick,
  );
  if (id === 0) return "collab_no_slot";
  payPp(pol, from, WW_COLLAB_PP);
  addTension(pol, from, scaledTension(pol, from, WW_COLLAB_TENSION_PCT * 100));
  pol.markCountry(from);
  // Its land is its own now: no hand-over land for a conference.
  const set = new Set(pick);
  eg.handedOver = eg.handedOver.filter(([r]) => !set.has(r));
  const ex = eg.exileIdx.get(target);
  if (ex !== undefined) {
    const x = eg.exiles[ex];
    x.legitBp = Math.max(0, x.legitBp - WW_COLLAB_EXILE_LEGIT_LOSS_BP);
    eg.dirtyExiles = true;
  }
  const rec: StoredCollab = {
    smallID: id,
    creator: from,
    origin: target,
    sinceDay: day,
  };
  eg.collabs = [...eg.collabs.filter((x) => x.smallID !== id), rec].sort(
    (a, b) => a.smallID - b.smallID,
  );
  eg.dirtyDiplo = true;
  eg.adminDirty = true;
  eg.messageAll(
    noticeId(DIPLO_NOTICES.collabCreated),
    countryParams(eg, { country: from, target }),
  );
  return null;
}

/**
 * Exile.endExile "returned" (its capital back, or "come home as my
 * subject"): a collaboration government standing for `origin` ends and
 * folds into it — its legal land and what it holds go to `origin`, other
 * countries' divisions leave that land, its own divisions disband, its
 * ships and planes go to `origin`, and it is gone.
 */
export function collabOriginReturned(
  eg: WwEndgame,
  origin: number,
  tick: number,
): void {
  const recs = eg.collabs.filter(
    (c) => c.origin === origin && c.smallID !== origin,
  );
  if (recs.length === 0) return;
  for (const rec of recs) foldCollab(eg, rec.smallID, origin, tick);
  eg.collabs = eg.collabs.filter((c) => c.origin !== origin);
  eg.dirtyDiplo = true;
  eg.adminDirty = true;
}

function foldCollab(
  eg: WwEndgame,
  c: number,
  origin: number,
  tick: number,
): void {
  const ww = eg.ww;
  const pol = ww.politics;
  const land = ww.land;
  land.removeCountryForces(c);
  ww.navy.transferUnits(c, origin, "transfer");
  ww.air.transferUnits(c, origin, "transfer");
  const moved: number[] = [];
  for (const r of ww.scenario.landRegions) {
    if ((pol.legalOwner[r.id] ?? 0) === c) pol.setLegalOwner(r.id, origin);
    if (land.controller[r.id] !== c) continue;
    const owner = pol.legalOwner[r.id] ?? 0;
    const to = owner !== 0 && eg.isActor(owner) ? owner : origin;
    transferRegionPeaceful(land, r.id, to, tick);
    if (to === origin) moved.push(r.id);
  }
  const t = land.divisions;
  for (const r of moved) {
    const owners = [...new Set(land.rowsIn(r).map((row) => t.owner[row]))];
    owners.sort((a, b) => a - b);
    for (const o of owners) if (o !== origin) evictDivisions(land, r, o);
  }
  for (const w of eg.wars) {
    if (w.ended !== null) continue;
    if (eg.member(w, c)?.state === "active") {
      eg.setMemberState(w.id, c, "capitulated");
    }
  }
  ww.endWarsOf(c);
  endSubject(eg, c, tick);
  if (pol.factionIdx(c) >= 0) leaveFaction(pol, c, tick);
  eg.setCountryState(c, CS_GONE);
  pol.markCountry(c);
  pol.markCountry(origin);
  pol.factionsChanged();
  land.markCountry(c);
  land.markCountry(origin);
}

/**
 * Daily for an AI country (staggered by smallID; acts monthly): holding
 * 60% of a capitulated country's victory points for 60 days, with its
 * garrison coverage there under 80% or resistance over 30%, it sets up a
 * collaborator on every region it may pick (its cores and claims kept).
 */
export function aiCollabDay(
  eg: WwEndgame,
  id: number,
  day: number,
  tick: number,
): void {
  pruneCollabs(eg);
  if (day % AI_DAYS !== id % AI_DAYS) return;
  const ww = eg.ww;
  const pol = ww.politics;
  const c = pol.country(id);
  if (c === null || c.ruling === IDEO_DEM || eg.isExile(id)) return;
  if (c.ppMilli < WW_COLLAB_PP * 1000) return;
  const legal = pol.legalOwner;
  const ctl = ww.land.controller;
  // The capitulated countries whose land it has held 60 days.
  const held = new Map<number, number>();
  for (const r of ww.scenario.landRegions) {
    if (ctl[r.id] !== id) continue;
    const t = legal[r.id] ?? 0;
    if (t === 0 || t === id || !capitulated(eg, t)) continue;
    if (heldDays(eg, r.id, day) < WW_COLLAB_AI_HOLD_DAYS) continue;
    held.set(t, (held.get(t) ?? 0) + r.vp);
  }
  if (held.size === 0) return;
  const claims = claimRegions(eg, id);
  for (const t of [...held.keys()].sort((a, b) => a - b)) {
    let total = 0;
    const pick: number[] = [];
    let sup = 0;
    let need = 0;
    let res = 0;
    for (const r of ww.scenario.landRegions) {
      if ((legal[r.id] ?? 0) !== t) continue;
      total += r.vp;
      if (ctl[r.id] !== id || eg.hasCore(id, r.id) || claims.has(r.id)) {
        continue;
      }
      if (inOpenStake(eg, r.id)) continue;
      pick.push(r.id);
      const n = needOf(eg, id, r.id);
      sup += Math.min(eg.supDeci[r.id], n);
      need += n;
      res += eg.resBp[r.id];
    }
    if (pick.length === 0) continue;
    if (held.get(t)! * 100 < total * WW_COLLAB_AI_HOLD_PCT) continue;
    const quiet =
      coveragePct(sup, need) >= WW_COLLAB_AI_COVER_PCT &&
      Math.floor(res / pick.length) <= WW_COLLAB_AI_RES_BP;
    if (quiet) continue;
    if (createCollab(eg, id, t, pick, tick) === null) return;
  }
}
