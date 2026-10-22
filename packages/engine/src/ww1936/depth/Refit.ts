// P6 lane E (plan Task 3): ship refits (spec §5.3.4; plan decision 8). A
// docked ship takes another design of its class and generation in one of
// its country's naval bases of level 3 or more; the dockyards are
// borrowed the way P4's repairs borrow them, and the fleet waits in port
// in P4's repair state.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  FLEET_STATES,
  SHIP_CLASSES,
} from "@openfront/engine-api/ww1936/NavyTypes";
import {
  SHIP_MODULE_DEFS,
  shipBase,
} from "@openfront/engine-lib/ww1936/DesignRules";
import { navalLineOutputMilli } from "@openfront/engine-lib/ww1936/NavalLineRules";
import { lineUnitCost } from "@openfront/engine-lib/ww1936/ShipStats";
import { effectiveLevel } from "../economy/Buildings";
import { lendDocks } from "../economy/NavalLines";
import type { CountryEconomy } from "../economy/WwEconomy";
import type { Fleet, WwNavy } from "../navy/WwNavy";
import { shipTreatyBlock } from "./Designs";
import type { WwDepth } from "./WwDepth";

/** Spec §5.3.4: a naval base of this level or more refits. */
export const REFIT_BASE_LEVEL = 3;
/** Spec §5.3.4: dockyards a refit borrows, at most (P4 repairs' rule). */
export const REFIT_MAX_DOCKS = 5;
/** Spec §5.3.4: the hull's share every refit costs, percent. */
export const REFIT_BASE_PCT = 10;
const ST_DOCKED = FLEET_STATES.indexOf("docked");
const ST_REPAIRING = FLEET_STATES.indexOf("repairing");

/**
 * Spec §5.3.4: the refit's cost, naval industry milli — (the changed
 * slots' module cost percents + 10%) × the hull's cost. A slot fitted with
 * a cheaper module (a negative cost percent) or back to the base fitting
 * still costs nothing extra, never less.
 */
export function refitCostMilli(
  cls: Parameters<typeof lineUnitCost>[0],
  gen: number,
  from: readonly string[] | null,
  to: readonly string[],
): number {
  let pct = REFIT_BASE_PCT;
  to.forEach((m, i) => {
    if (m === (from?.[i] ?? "")) return;
    pct += Math.max(0, SHIP_MODULE_DEFS[m]?.costPct ?? 0);
  });
  return Math.floor((lineUnitCost(cls, gen) * 1000 * pct) / 100);
}

/** A naval base of the country (its own region) of level ≥ 3 where the fleet lies. */
function refitPort(d: WwDepth, id: number, f: Fleet | undefined): boolean {
  if (f === undefined || f.docked === 0) return false;
  return (
    d.ww.land.controller[f.docked] === id &&
    effectiveLevel(d.ww.economy, f.docked, "naval_base") >= REFIT_BASE_LEVEL
  );
}

/** One dockyard's day of naval output, milli (P4's naval line formula at full resources). */
function dockDayMilli(ce: CountryEconomy): number {
  const pct = ce.stats.dockOutputPct + ce.law().outputPct + ce.stats.outputPct;
  return Math.max(1, navalLineOutputMilli(1, pct, 1000));
}

/**
 * ship_refit (spec §5.3.4): a design the naval treaty allows (§13.3,
 * "treaty_limit"), of the ship's class and generation,
 * the country's own or licensed and not obsolete, another than the one it
 * has; the ship docked in its country's naval base of level ≥ 3, not
 * refitting already, with a dockyard to borrow. The days are the cost
 * over the dockyards it can borrow now (at most 5); the fleet waits in
 * port (holdInPort).
 */
export function startRefit(
  d: WwDepth,
  id: number,
  ship: number,
  slot: number,
  tick: number,
): WwOrderBlock | null {
  const s = d.designSlot(id, "ship", slot);
  if (s === null) return "bad_slot";
  const navy = d.ww.navy;
  const t = navy.ships;
  const r = t.rowOf(ship);
  if (r < 0 || t.owner[r] !== id) return "bad_index";
  // Spec §13.3 (review E2): the treaty holds for a refit too.
  const treaty = shipTreatyBlock(d, id, s.def);
  if (treaty !== null) return treaty;
  const ce = d.ww.economy.country(id);
  const sb = shipBase(s.def.base);
  const cls = SHIP_CLASSES[t.cls[r]];
  if (
    ce === null ||
    sb === null ||
    sb.cls !== cls ||
    sb.gen !== t.gen[r] ||
    s.obsolete ||
    (s.origin !== "own" && s.origin !== "licensed") ||
    t.design[r] === slot ||
    t.refitLeft[r] > 0
  ) {
    return "not_refittable";
  }
  const f = navy.fleets.get(t.fleet[r]);
  if (!refitPort(d, id, f)) return "not_refittable";
  const docks = Math.min(REFIT_MAX_DOCKS, ce.totals.dock - ce.docksLent);
  if (docks < 1) return "not_refittable";
  const was = d.designSlot(id, "ship", t.design[r])?.def.modules ?? null;
  const cost = refitCostMilli(sb.cls, sb.gen, was, s.def.modules);
  const days = Math.ceil(cost / (docks * dockDayMilli(ce)));
  t.refitTo[r] = slot;
  t.refitLeft[r] = Math.max(1, Math.min(32_767, days));
  holdInPort(navy, f!, d.ww.day(tick));
  return null;
}

/**
 * The fleet waits in port: P4's repair state (decision 8: refits take the
 * repair path), and its mission resumes no earlier than the day after
 * next (P4's resumeDay, which N1's applyFleetOrders waits for), renewed
 * on every refit day — so neither the repair's end nor its mission sails
 * it while a ship refits. A player's order still does until T1b's port
 * lock (refitHolds).
 */
function holdInPort(navy: WwNavy, f: Fleet, day: number): void {
  if (f.docked === 0) return;
  if (f.state === ST_DOCKED) f.state = ST_REPAIRING;
  f.resumeDay = Math.max(f.resumeDay, day + 2);
  navy.markFleet(f.id);
}

/**
 * The fleet holds a refitting ship (T1b's port lock asks this before a
 * fleet order sails it; P4's repair end before it docks the fleet).
 */
export function refitHolds(navy: WwNavy, f: Fleet): boolean {
  const t = navy.ships;
  for (const sid of f.ships) {
    const r = t.rowOf(sid);
    if (r >= 0 && t.refitLeft[r] > 0) return true;
  }
  return false;
}

/**
 * The country's day of refits (before its naval lines and repairs): each
 * refitting ship in a refit port borrows up to 5 dockyards and, with one
 * at least, is a day nearer; at 0 it has its new design (HP no more than
 * the new maximum). A ship out of such a port waits. Its fleet stays in
 * port while a ship refits (holdInPort) and may go the day the last one
 * is done.
 */
export function dailyRefits(d: WwDepth, id: number, day: number): void {
  const navy = d.ww.navy;
  const ce = d.ww.economy.country(id);
  if (ce === null) return;
  const t = navy.ships;
  for (const f of navy.fleetsOf(id)) {
    let held = false;
    let done = false;
    for (const sid of f.ships) {
      const r = t.rowOf(sid);
      if (r < 0 || t.refitLeft[r] <= 0) continue;
      if (!refitPort(d, id, f)) continue;
      if (lendDocks(ce, REFIT_MAX_DOCKS) < 1) {
        held = true;
        continue;
      }
      t.refitLeft[r]--;
      if (t.refitLeft[r] > 0) {
        held = true;
        continue;
      }
      t.design[r] = t.refitTo[r];
      t.refitTo[r] = 0;
      const max = navy.shipStatsOf(r).hpMilli;
      if (t.hp[r] > max) t.hp[r] = max;
      navy.markFleet(f.id);
      done = true;
    }
    if (held) {
      holdInPort(navy, f, day);
    } else if (done && f.resumeDay === day + 1) {
      // The refit's own hold (yesterday's day + 2) ends with it; another
      // day (a battle's) stays. A refit done the day it began keeps its
      // first hold: the fleet waits a day more (review E14).
      f.resumeDay = -1;
    }
  }
}
