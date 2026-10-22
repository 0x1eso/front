// World War 1936 P6 lane W3 (plan Task 9): the US congress (spec §13.1).
// One value, WwDepth.mech.congressBp (0..10,000, start 3,000), drifts on
// the US turn 20 bp a day toward 20% + tension / 2 (+40% for 90 days
// after the US, a member of its faction or a country it guarantees is
// declared on); Japan declaring on the US holds it at 100% for a year.
// The US needs 60% to declare war, 50% for lend-lease and the high laws,
// 70% for a faction. The test map has no US: the tests call the *For
// functions with a stand-in smallID; the public ones pass the US's.
import {
  CONGRESS,
  congressNeedBp,
  congressStep,
  congressTargetBp,
} from "@openfront/engine-lib/ww1936/MechRules";
import { removeSpirit } from "../politics/Spirits";
import type { WwDepth } from "./WwDepth";

export type CongressAction = "declare" | "lend_lease" | "law" | "faction";

/** The thresholds that send ww1936_congress_threshold when crossed upward, bp. */
const THRESHOLDS = [CONGRESS.lendLease, CONGRESS.declare, CONGRESS.faction];

/** P3's start spirits of US isolationism (the focus tree's softer one too). */
const ISOLATION_SPIRITS = ["usa_isolation", "usa_isolation_cracked"];

export function usaIdOf(d: WwDepth): number {
  return d.ww.politics.idOfTag("USA");
}

/** The congress refuses the US action now. */
export function congressBlock(
  d: WwDepth,
  id: number,
  action: CongressAction,
  target?: number,
): boolean {
  return congressBlockFor(d, usaIdOf(d), id, action, target);
}

/**
 * Spec §13.1 thresholds, for the country `usaId`: a declaration on a
 * country that declared on the US, its faction or its guarantees passes;
 * lend-lease passes with the US flag `lend_lease` (the 1941 act).
 */
export function congressBlockFor(
  d: WwDepth,
  usaId: number,
  id: number,
  action: CongressAction,
  target?: number,
): boolean {
  if (usaId <= 0 || id !== usaId || d.countries.length === 0) return false;
  if (d.mech.congressBp >= congressNeedBp(action)) return false;
  if (action === "declare") {
    return !(
      target !== undefined &&
      target > 0 &&
      declaredOnProtected(d, usaId, target)
    );
  }
  if (action === "lend_lease") {
    const us = d.ww.politics.country(usaId);
    return !(us?.hasFlag("lend_lease", Math.max(0, d.lastCommonDay)) ?? false);
  }
  return true;
}

/** The US, a member of its faction, or a country it guarantees. */
export function congressProtects(
  d: WwDepth,
  usaId: number,
  p: number,
): boolean {
  const pol = d.ww.politics;
  return (
    p === usaId ||
    pol.sameFaction(p, usaId) ||
    pol.guarantorsOf(p).includes(usaId)
  );
}

/** `x` declared war on someone the US protects (P3 declaredOn: wars still running). */
function declaredOnProtected(d: WwDepth, usaId: number, x: number): boolean {
  const c = d.ww.politics.country(x);
  return (
    c !== null &&
    c.declaredOn.some(
      (p) => d.ww.isAtWar(x, p) && congressProtects(d, usaId, p),
    )
  );
}

/**
 * The day the pair went to war (P5's war record: the later joining day of
 * the two); -1 when no record holds it.
 */
function pairWarDay(d: WwDepth, a: number, b: number): number {
  const eg = d.ww.endgame;
  const w = eg.war(eg.warOfPair(a, b));
  if (w === null) return -1;
  const ma = eg.member(w, a);
  const mb = eg.member(w, b);
  return Math.max(ma?.joinedDay ?? w.startDay, mb?.joinedDay ?? w.startDay);
}

/**
 * The US turn (spec §13.1): declarations since its last turn (P3
 * declaredOn, the pair's day from P5's war record — the polled form of
 * P3's onWarDeclared), then the day's drift.
 */
export function congressDay(
  d: WwDepth,
  usaId: number,
  day: number,
  jpnId: number = d.ww.politics.idOfTag("JPN"),
): void {
  if (usaId <= 0 || d.countries[usaId] === null) return;
  const pol = d.ww.politics;
  const m = d.mech;
  for (let x = 1; x < d.cap; x++) {
    const cx = pol.country(x);
    if (x === usaId || cx === null || cx.declaredOn.length === 0) continue;
    for (const p of cx.declaredOn) {
      if (!d.ww.isAtWar(x, p) || !congressProtects(d, usaId, p)) continue;
      const formed = pairWarDay(d, x, p);
      if (formed < day - 1) continue;
      m.attackedUntil = Math.max(
        m.attackedUntil,
        formed + CONGRESS.attackedDays,
      );
      // Spec §13.1: Pearl Harbor — Japan declares on the US.
      if (x === jpnId && p === usaId) {
        m.congressFull = Math.max(m.congressFull, formed + CONGRESS.pearlDays);
      }
    }
  }
  const next =
    m.congressFull >= day
      ? 10_000
      : congressStep(
          m.congressBp,
          congressTargetBp(pol.wtBp, m.attackedUntil >= day),
        );
  setCongressBp(d, usaId, next);
  // T1b: the screens' congress-allows-lend-lease (the flag can change
  // with no move of support): the global data again when it differs.
  const ll = !congressBlockFor(d, usaId, usaId, "lend_lease");
  if (d.congressLlSent !== null && ll !== d.congressLlSent) d.markGlobal();
}

/** A `congress {pp}` effect on the US: ± percentage points. */
export function addCongressPp(d: WwDepth, usaId: number, pp: number): void {
  setCongressBp(d, usaId, d.mech.congressBp + pp * 100);
}

/**
 * The new value (clamped): the threshold messages, and the first time at
 * 50% or more the isolation spirit goes (spec §13.1).
 */
export function setCongressBp(d: WwDepth, usaId: number, bp: number): void {
  const m = d.mech;
  const prev = m.congressBp;
  const next = Math.max(0, Math.min(10_000, bp));
  if (next !== prev) {
    m.congressBp = next;
    d.markGlobal();
    d.markCountry(usaId);
    for (const t of THRESHOLDS) {
      if (prev < t && next >= t) {
        d.message(usaId, "ww1936_congress_threshold", {
          pct: Math.floor(t / 100),
        });
      }
    }
  }
  if (!m.isolationCleared && m.congressBp >= CONGRESS.lendLease) {
    m.isolationCleared = true;
    const pol = d.ww.politics;
    const c = pol.country(usaId);
    for (const s of ISOLATION_SPIRITS) {
      if (c?.hasSpirit(s) === true) removeSpirit(pol, usaId, s);
    }
    d.markGlobal();
  }
}
