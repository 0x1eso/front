// World War 1936 P2: why an army order cannot be given now (P2 spec §7,
// §8, §15.4), over plain data: the engine's armyOrderBlock and the army
// card's greyed buttons judge the same way.
import type { LandOrder } from "@openfront/engine-api/Schemas";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  WW_MAX_ARMIES,
  WW_MAX_ARMY_DIVISIONS,
  WW_PARA_COOLDOWN_DAYS,
  WW_PARA_RANGE_KM,
} from "@openfront/engine-api/ww1936/LandTypes";
import { borderRegionsOf, facesFront, type FrontWorld } from "./FrontRules";

export interface OrderCheckArmy {
  owner: number;
  divisions: number;
  /** Regions its divisions stand in, ascending. */
  regions: readonly number[];
  /** Some division is in a battle / moving by rail or sea. */
  fighting: boolean;
  /** Every division's template has a paratrooper battalion. */
  allPara: boolean;
  paraLastDay: number;
  /**
   * Each division's template id. Optional: without it a split by template
   * is judged on the division count alone (the engine always fills it).
   */
  templates?: readonly number[];
  /**
   * The army holds a front or plan order. Optional: without it army_execute
   * and a plan without targets are not judged on it (the engine fills it).
   */
  front?: boolean;
}

export interface OrderCheckWorld extends FrontWorld {
  me: number;
  day: number;
  rail(region: number): number;
  isPort(region: number): boolean;
  /** Victory points of the region (paradrop airfield stand-in). */
  vp(region: number): number;
  army(id: number): OrderCheckArmy | null;
  armyCount(): number;
  /**
   * P4 (pre-flight A20): the air war's conditions of a paradrop (an air
   * base, transport planes, superiority); null when they hold. Optional:
   * absent, only the P2 conditions apply.
   */
  paraBlock?: (army: number, target: number) => WwOrderBlock | null;
}

/** A plan's targets lie this many edges at most from our side (spec §14.4). */
export const WW_TARGET_REACH_EDGES = 6;
/** A paradrop leaves from cities of at least this many victory points (spec §7.6). */
export const WW_PARA_MIN_VP = 5;

/** Why the army order cannot be given now (army_* and paradrop kinds); null when it can. */
export function landOrderBlockOf(
  w: OrderCheckWorld,
  order: LandOrder,
): WwOrderBlock | null {
  if (!("army" in order)) return null;
  const a = w.army(order.army);
  if (a === null || a.owner !== w.me) return "no_army";
  switch (order.kind) {
    case "army_move":
      return moveBlock(w, a, order.region);
    case "army_rail":
      return railBlock(w, a, order.region);
    case "army_sea":
      return seaBlock(w, a, order.region);
    case "army_attack":
      return targetsBlock(w, [order.region]);
    case "army_front":
      if (!isLand(w, order.anchor)) return "bad_region";
      return isBorder(w, order.anchor, order.enemy) ? null : "not_adjacent";
    case "army_plan":
      if (order.targets.length > 0) return targetsBlock(w, order.targets);
      // A plan with no targets needs a front, or one it can take (spec §8.2).
      if (a.front === false && borderRegionsOf(w, w.me, 0).length === 0) {
        return "not_adjacent";
      }
      return null;
    case "army_execute":
      return order.on && a.front === false ? "not_adjacent" : null;
    case "army_split":
      return splitBlock(w, a, order.count, order.template);
    case "army_merge":
      return mergeBlock(w, a, order.army, order.into);
    case "paradrop":
      // P4 (spec §14.10, plan decision 35): the air war's conditions first.
      return (
        w.paraBlock?.(order.army, order.region) ??
        paradropBlock(w, a, order.region)
      );
    default:
      // army_halt, army_disband, army_auto, army_general (Task 5's check).
      return null;
  }
}

function isLand(w: FrontWorld, region: number): boolean {
  return w.scenario.region(region) !== undefined;
}

function isBorder(w: OrderCheckWorld, region: number, enemy: number): boolean {
  if (!w.sameSide(w.me, w.controller[region])) return false;
  for (const e of w.scenario.edgesOf(region)) {
    if (facesFront(w, w.me, enemy, w.controller[e.to])) return true;
  }
  return false;
}

/**
 * Regions reachable from `from` (all of them sources) over regions `pass`
 * accepts; `from` themselves are always in.
 */
function reach(
  w: FrontWorld,
  from: readonly number[],
  pass: (region: number) => boolean,
): Set<number> {
  const seen = new Set<number>(from);
  const queue = [...from];
  for (let i = 0; i < queue.length; i++) {
    for (const e of w.scenario.edgesOf(queue[i])) {
      if (seen.has(e.to) || !pass(e.to)) continue;
      seen.add(e.to);
      queue.push(e.to);
    }
  }
  return seen;
}

function moveBlock(
  w: OrderCheckWorld,
  a: OrderCheckArmy,
  to: number,
): WwOrderBlock | null {
  if (!isLand(w, to)) return "bad_region";
  const c = w.controller[to];
  // Spec §7.3: a move onto an enemy region is a one-target attack.
  if (!w.sameSide(w.me, c)) {
    return w.isEnemy(w.me, c) ? targetsBlock(w, [to]) : "no_path";
  }
  const ours = (r: number) => w.sameSide(w.me, w.controller[r]);
  return reach(w, a.regions, ours).has(to) ? null : "no_path";
}

function railBlock(
  w: OrderCheckWorld,
  a: OrderCheckArmy,
  to: number,
): WwOrderBlock | null {
  if (!isLand(w, to)) return "bad_region";
  // Spec §7.4: our side and a railway at the start, on the way and there.
  const railed = (r: number) =>
    w.sameSide(w.me, w.controller[r]) && w.rail(r) >= 1;
  if (a.regions.length === 0 || !railed(to)) return "no_rail";
  const from = reach(w, [to], railed);
  if (!a.regions.every((r) => railed(r) && from.has(r))) return "no_rail";
  return a.fighting ? "army_busy" : null;
}

function seaBlock(
  w: OrderCheckWorld,
  a: OrderCheckArmy,
  to: number,
): WwOrderBlock | null {
  if (!isLand(w, to)) return "bad_region";
  // Spec §7.5: from one port of our side to another.
  const port = (r: number) => w.isPort(r) && w.sameSide(w.me, w.controller[r]);
  if (a.regions.length !== 1 || a.regions[0] === to) return "no_port";
  if (!port(a.regions[0]) || !port(to)) return "no_port";
  return a.fighting ? "army_busy" : null;
}

/** Spec §8.2: 0–3 targets, each an enemy region within reach of our front. */
function targetsBlock(
  w: OrderCheckWorld,
  targets: readonly number[],
): WwOrderBlock | null {
  if (!targets.every((t) => isLand(w, t))) return "bad_region";
  if (!targets.every((t) => w.isEnemy(w.me, w.controller[t]))) {
    return "not_at_war";
  }
  return targets.every((t) => nearOurSide(w, t)) ? null : "not_adjacent";
}

/**
 * Whether `target` lies at most WW_TARGET_REACH_EDGES edges from a region
 * of our side, over enemy regions only (no way through neutral land).
 */
function nearOurSide(w: OrderCheckWorld, target: number): boolean {
  const seen = new Set<number>([target]);
  let frontier = [target];
  for (let d = 1; d <= WW_TARGET_REACH_EDGES && frontier.length > 0; d++) {
    const next: number[] = [];
    for (const u of frontier) {
      for (const e of w.scenario.edgesOf(u)) {
        if (seen.has(e.to)) continue;
        seen.add(e.to);
        const c = w.controller[e.to];
        if (w.sameSide(w.me, c)) return true;
        if (w.isEnemy(w.me, c)) next.push(e.to);
      }
    }
    frontier = next;
  }
  return false;
}

function splitBlock(
  w: OrderCheckWorld,
  a: OrderCheckArmy,
  count: number,
  template: number,
): WwOrderBlock | null {
  // Spec §8.4: at least one division stays.
  if (count >= a.divisions) return "bad_index";
  if (template !== 0 && a.templates !== undefined) {
    const n = a.templates.filter((t) => t === template).length;
    if (n < count) return "bad_index";
  }
  return w.armyCount() >= WW_MAX_ARMIES ? "too_many_armies" : null;
}

function mergeBlock(
  w: OrderCheckWorld,
  a: OrderCheckArmy,
  id: number,
  into: number,
): WwOrderBlock | null {
  const b = w.army(into);
  if (b === null || b.owner !== w.me) return "no_army";
  if (into === id) return "bad_index";
  if (!a.regions.some((r) => b.regions.includes(r))) return "not_adjacent";
  return a.divisions + b.divisions > WW_MAX_ARMY_DIVISIONS ? "army_full" : null;
}

function paradropBlock(
  w: OrderCheckWorld,
  a: OrderCheckArmy,
  to: number,
): WwOrderBlock | null {
  if (!isLand(w, to)) return "bad_region";
  if (a.divisions === 0 || !a.allPara) return "bad_template";
  // Spec §7.6: every division at a city of 5+ victory points (the airfield
  // stand-in), within 600 km of a target we are at war with. P4 spec
  // §14.10 replaces both with the air war's air base and transport range:
  // with paraBlock set (World War 1936's air war) they are its to judge.
  const p2 = w.paraBlock === undefined;
  if (p2 && !a.regions.every((r) => w.vp(r) >= WW_PARA_MIN_VP)) {
    return "para_range";
  }
  if (!w.isEnemy(w.me, w.controller[to])) return "not_at_war";
  if (
    p2 &&
    !a.regions.every((r) => w.scenario.regionKm(r, to) <= WW_PARA_RANGE_KM)
  ) {
    return "para_range";
  }
  if (a.paraLastDay >= 0 && w.day - a.paraLastDay < WW_PARA_COOLDOWN_DAYS) {
    return "para_cooldown";
  }
  return null;
}
