// P5 lane W (plan Task 2): wars ending (spec §4.4), war score (spec §4.5),
// reparations and disarmament (spec §6.4). Integers only; wars by id,
// regions by id.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  WW_DISARM_MAX_DIVISIONS,
  WwWar,
  WwWarSummary,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { sharePm } from "@openfront/engine-lib/ww1936/EndgameRules";
import { endCivilWar } from "./CivilWar";
import { openConference } from "./Conference";
import { endIndependenceWar } from "./Subjects";
import type { EconAdjust, WwEndgame } from "./WwEndgame";

/** Spec §4.5: war score milli per kill (a ship per supremacy weight). */
export const KILL_MILLI = { ship: 10_000, convoy: 2_000, plane: 500 } as const;

/**
 * Spec §4.5: the smallest ongoing war in which `a` and `b` stand on
 * opposite sides, neither of them gone out of it by a peace (left); null
 * when none.
 */
export function warBetween(eg: WwEndgame, a: number, b: number): WwWar | null {
  if (a <= 0 || b <= 0 || a === b) return null;
  for (const id of eg.warsOf(a)) {
    const w = eg.war(id);
    if (w === null || w.ended !== null) continue;
    const sa = eg.sideIndex(w, a);
    const sb = eg.sideIndex(w, b);
    if (sa < 0 || sb < 0 || sa === sb) continue;
    if (eg.member(w, a)!.state === "left") continue;
    if (eg.member(w, b)!.state === "left") continue;
    return w;
  }
  return null;
}

/** The capitulated and exiled members of a war's losing side (ascending). */
export function loserIds(w: WwWar): number[] {
  if (w.ended === null || w.ended.winner === -1) return [];
  return w.sides[1 - w.ended.winner].members
    .filter((m) => m.state === "capitulated" || m.state === "exiled")
    .map((m) => m.id)
    .sort((a, b) => a - b);
}

/**
 * Spec §4.4 (after the day's common step and after a capitulation): a war
 * ends when a side has no active member. Civil and independence wars end
 * by their own rules, a side that only left ends without a winner, an
 * exile-only losing side passes into its host's war; the rest open
 * conferences — same-tick ends sharing a loser as one.
 */
export function checkWarEnds(eg: WwEndgame, day: number, tick: number): void {
  const ended: WwWar[] = [];
  let changed = false;
  for (const w of eg.wars) {
    if (w.ended !== null) continue;
    const dead = ([0, 1] as const).filter(
      (s) => !w.sides[s].members.some((m) => m.state === "active"),
    );
    if (dead.length === 0) continue;
    changed = true;
    if (dead.length === 2) {
      w.ended = { day, winner: -1 };
      continue;
    }
    const loser = dead[0];
    const winner = (1 - loser) as 0 | 1;
    const lm = w.sides[loser].members;
    if (w.kind === "civil") {
      w.ended = { day, winner };
      endCivilWar(eg, w.id, winner, tick);
      continue;
    }
    if (w.kind === "independence" && loser === 0) {
      w.ended = { day, winner };
      endIndependenceWar(eg, w.id, winner, tick);
      continue;
    }
    if (lm.every((m) => m.state === "left")) {
      w.ended = { day, winner: -1 };
      continue;
    }
    const losers = lm.filter(
      (m) => m.state === "capitulated" || m.state === "exiled",
    );
    const passes =
      losers.length > 0 &&
      losers.every(
        (m) =>
          m.state === "exiled" &&
          eg.warsOf(m.id).some((x) => x !== w.id && eg.war(x)?.ended === null),
      );
    if (passes) {
      w.ended = { day, winner: -1 };
      passIntoExileWar(eg, w, loser, day);
      continue;
    }
    w.ended = { day, winner };
    ended.push(w);
  }
  // Same-tick ends sharing a loser become one conference (spec §4.4):
  // grouped by loser, in war order; each group's wars ascending.
  const groups: WwWar[][] = [];
  for (const w of ended) {
    const ls = loserIds(w);
    const hit = groups.filter((g) =>
      g.some((y) => loserIds(y).some((id) => ls.includes(id))),
    );
    if (hit.length === 0) {
      groups.push([w]);
      continue;
    }
    // A war that links two groups merges them.
    const merged = [...hit.flat(), w];
    for (const g of hit) groups.splice(groups.indexOf(g), 1);
    groups.push(merged);
  }
  groups.sort(
    (a, b) => Math.min(...a.map((w) => w.id)) - Math.min(...b.map((w) => w.id)),
  );
  for (const g of groups) {
    openConference(
      eg,
      g.map((w) => w.id).sort((a, b) => a - b),
      tick,
    );
  }
  if (changed) eg.dirtyWars = true;
}

/**
 * Spec §4.4 (Norway 1940): the losing side of `w` is exiles only, each
 * still in another war. Every pair left in `w` (occupier and exile) moves
 * to the exile's smallest other ongoing war; an occupier not yet in that
 * war joins it on the exile's opposite side.
 */
function passIntoExileWar(
  eg: WwEndgame,
  w: WwWar,
  loserSide: 0 | 1,
  day: number,
): void {
  const size = eg.size;
  const pairs: [number, number, number][] = [];
  for (const [k, v] of eg.pairWar) {
    if (v === w.id) pairs.push([k, Math.floor(k / size), k % size]);
  }
  let joined = false;
  for (const [key, a, b] of pairs) {
    const x = eg.sideIndex(w, a) === loserSide ? a : b;
    const y = x === a ? b : a;
    const v = eg
      .warsOf(x)
      .find((id) => id !== w.id && eg.war(id)?.ended === null);
    if (v === undefined) continue;
    const vw = eg.war(v)!;
    eg.pairWar.set(key, v);
    const sx = eg.sideIndex(vw, x);
    if (sx < 0 || eg.sideIndex(vw, y) >= 0) continue;
    vw.sides[1 - sx].members.push({
      id: y,
      state: eg.isExile(y) ? "exiled" : "active",
      joinedDay: day,
      wsMilli: 0,
    });
    joined = true;
  }
  // The war index is derived (one rebuild for every newcomer).
  if (joined) eg.rebuildDerived();
}

/** Adds `milli` war score to `smallID`'s membership of war `warId`. */
export function addWarScore(
  eg: WwEndgame,
  warId: number,
  smallID: number,
  milli: number,
): void {
  const w = eg.war(warId);
  const m = w === null ? null : eg.member(w, smallID);
  if (m === null) return;
  m.wsMilli += milli;
  eg.dirtyWars = true;
}

/**
 * P2 battle casualties: `by` killed `men` of `against` (spec §4.5: 1,000
 * men = 1 point = 1,000 milli), in their smallest shared war. A
 * volunteer's damage arrives here as its receiver's (P2 fightOwner).
 */
export function noteDamage(
  eg: WwEndgame,
  by: number,
  against: number,
  men: number,
): void {
  if (men <= 0) return;
  const w = warBetween(eg, by, against);
  if (w !== null) addWarScore(eg, w.id, by, men);
}

/** P4 kills (spec §4.5): ships by supremacy weight ×10 points, convoys ×2, planes ×0.5. */
export function noteKills(
  eg: WwEndgame,
  by: number,
  against: number,
  kind: "ship" | "convoy" | "plane",
  amount: number,
): void {
  if (amount <= 0) return;
  const w = warBetween(eg, by, against);
  if (w !== null) addWarScore(eg, w.id, by, KILL_MILLI[kind] * amount);
}

/**
 * Spec §4.5: a day of occupation — every region (by id) whose controller
 * is at war with its legal owner gives the controller its victory points.
 */
export function dailyWarScore(eg: WwEndgame, day: number): void {
  void day;
  if (eg.wars.length === 0) return;
  const ctrl = eg.ww.land.controller;
  const legal = eg.ww.politics.legalOwner;
  for (const r of eg.ww.scenario.landRegions) {
    if (r.vp <= 0) continue;
    const c = ctrl[r.id] ?? 0;
    const l = legal[r.id] ?? 0;
    if (c === l || c <= 0 || l <= 0) continue;
    const w = warBetween(eg, c, l);
    if (w !== null) addWarScore(eg, w.id, c, r.vp * 1000);
  }
}

/**
 * Spec §6.4 reparations (plan decision 19): while both still play, the
 * loser pays `k` civilian factories a day to the winner's construction.
 */
export function reparationsEconomy(
  eg: WwEndgame,
  id: number,
  out: EconAdjust,
): void {
  for (const x of eg.reparations) {
    if (x.from !== id && x.to !== id) continue;
    if (!eg.isActor(x.from) || !eg.isActor(x.to)) continue;
    if (x.from === id) out.civOut += x.k;
    if (x.to === id) out.civIn += x.k;
  }
}

/**
 * Spec §6.4 disarm: a disarmed country (the treaty's record, or a spirit
 * with the maxDivisions / no_naval_build rules) trains no division past
 * its limit and builds no naval line or dockyard.
 */
export function disarmBlockOf(
  eg: WwEndgame,
  id: number,
  what: "train" | "naval" | "dock",
): WwOrderBlock | null {
  const lim = disarmLimits(eg, id);
  if (what !== "train") return lim.noNaval ? "disarmed" : null;
  if (lim.maxDivisions === null) return null;
  return divisionCount(eg, id) >= lim.maxDivisions ? "disarmed" : null;
}

/** The disarmament in force for `id`: a division limit (null: none) and the naval ban. */
export function disarmLimits(
  eg: WwEndgame,
  id: number,
): { maxDivisions: number | null; noNaval: boolean } {
  let max: number | null = eg.disarm.some(([x]) => x === id)
    ? WW_DISARM_MAX_DIVISIONS
    : null;
  let noNaval = max !== null;
  const pol = eg.ww.politics;
  for (const s of pol.country(id)?.spirits ?? []) {
    for (const r of pol.content.spiritIdx.get(s.id)?.rules ?? []) {
      if (r === "no_naval_build") noNaval = true;
      else if (typeof r === "object" && "maxDivisions" in r) {
        max = max === null ? r.maxDivisions : Math.min(max, r.maxDivisions);
      }
    }
  }
  return { maxDivisions: max, noNaval };
}

/** Divisions in the field and in training. */
function divisionCount(eg: WwEndgame, id: number): number {
  const land = eg.ww.land;
  let n = land.rowsOf(id).length;
  const cl = land.country(id);
  if (cl !== null) {
    n += cl.trainees.length;
    for (const e of cl.training) n += e.remaining;
  }
  return n;
}

/** `smallID`'s share (‰) of its side's war score in its war against `ofSmallID` (0: no such war). */
export function warScoreShare(
  eg: WwEndgame,
  smallID: number,
  ofSmallID: number,
): number {
  const w = warBetween(eg, smallID, ofSmallID);
  if (w === null) return 0;
  const s = eg.sideIndex(w, smallID) as 0 | 1;
  return sharePm(
    eg.member(w, smallID)!.wsMilli,
    w.sides[s].members.map((m) => m.wsMilli),
  );
}

/** The screens' line of a war: its sides, each member's ‰ of its side's war score. */
export function warSummary(eg: WwEndgame, w: WwWar): WwWarSummary {
  void eg;
  return {
    id: w.id,
    kind: w.kind,
    startDay: w.startDay,
    sides: w.sides.map((s) => {
      const all = s.members.map((m) => m.wsMilli);
      return {
        leader: s.leader,
        members: s.members.map((m) => ({
          id: m.id,
          state: m.state,
          sharePm: sharePm(m.wsMilli, all),
        })),
      };
    }),
    ended: w.ended !== null,
  };
}
