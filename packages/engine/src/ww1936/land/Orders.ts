// World War 1936 P2: army orders (P2 spec §7, §8.2–§8.5, §16.3). An order
// changes the army's standing order and marks it pending; applyArmyOrders
// turns it into the divisions' destinations in the same tick (spec §2.2-3).
import type { LandOrder } from "@openfront/engine-api/Schemas";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  type ArmyOrder,
  DIRECT_ADVANCE,
  DIRECT_ALL_IN,
  DIRECT_FAVORABLE,
  DIRECT_MERGE,
  idleOrder,
  type LandOrderSource,
  MOVE_ADVANCE,
  MOVE_NONE,
  MOVE_RAIL,
  MOVE_RETREAT,
  MOVE_SEA,
  MOVE_WALK,
  ROLE_ATTACK,
  ROLE_NONE,
  type Stance,
  TPL_PARA_ANY,
  WW_GOAL_MAX,
  WW_PARA_PREP_DAYS,
  WW_ZONE_MAX,
} from "@openfront/engine-api/ww1936/LandTypes";
import { divisionMoveBlock } from "@openfront/engine-lib/ww1936/CommandRules";
import { borderRegionsOf } from "@openfront/engine-lib/ww1936/FrontRules";
import {
  landOrderBlockOf,
  type OrderCheckArmy,
  type OrderCheckWorld,
} from "@openfront/engine-lib/ww1936/LandOrderChecks";
import { resolveParadrop } from "../air/Paradrop";
import { cancelInvasion } from "../navy/Invasions";
import { navalPort } from "../navy/Ports";
import { joinBattle } from "./Battles";
import { applyFront, fallBack, nearestBorder } from "./Fronts";
import {
  enemyDivisionsIn,
  findPath,
  railPath,
  startNextHop,
  stepPins,
  stopDivision,
} from "./Movement";
import { capture } from "./Occupation";
import { armyRows, fallbackOf, freeRows } from "./Plans";
import { disbandDivision } from "./Sustain";
import type { Army, CountryLand, WwLand } from "./WwLand";

/** Spec §7.6: a dropped division lands with this share of its max org. */
const PARA_ORG_PCT = 40;

/**
 * Spec §16.3: one army order (army_* and paradrop). `by` (pre-flight U2):
 * a "player" order of any kind but army_auto and army_auto_level turns the
 * army's auto off (spec §8.5; autoLevel 0 with it), army_general included;
 * an "ai" order does not.
 */
export function issueArmyOrder(
  land: WwLand,
  cl: CountryLand,
  order: LandOrder,
  by: LandOrderSource,
): WwOrderBlock | null {
  const block = armyOrderBlock(land, cl, order);
  if (block !== null) return block;
  if (!("army" in order) || order.kind === "divisions_convert") return null;
  const a = land.armies.get(order.army)!;
  // ww42: a direct attack's settings alone leave auto and the invasion be.
  const settingsOnly =
    order.kind === "army_direct" && order.targets === undefined;
  if (
    by === "player" &&
    !settingsOnly &&
    order.kind !== "army_auto" &&
    order.kind !== "army_auto_level"
  ) {
    a.auto = false;
    a.autoLevel = 0;
  }
  // P4 spec §11.1 (pre-flight A11): another standing order drops the
  // army's invasion (lane I); the general and auto keep it.
  if (
    !settingsOnly &&
    order.kind !== "army_auto" &&
    order.kind !== "army_auto_level" &&
    order.kind !== "army_zone" &&
    order.kind !== "army_general" &&
    order.kind !== "army_execute" &&
    order.kind !== "army_fallback" &&
    order.kind !== "division_release"
  ) {
    cancelInvasion(land.ww.navy, a.id);
  }
  switch (order.kind) {
    case "army_move":
      // ww162 §1.4: an army-wide move takes every division (pins go).
      releasePins(land, a, []);
      // Spec §7.3: a move onto an enemy region is a one-target attack.
      // P5 lane A: a volunteer army's side is its host's (ownerForSides).
      if (
        !land.sameSide(land.ownerForSides(a), land.controller[order.region])
      ) {
        setPlan(land, a, [order.region], "aggressive", true);
      } else {
        setMove(land, a, order.region, MOVE_WALK);
      }
      break;
    case "army_rail":
      setMove(land, a, order.region, MOVE_RAIL);
      break;
    case "army_sea":
      setMove(land, a, order.region, MOVE_SEA);
      break;
    case "army_attack":
      // Spec §8.2: a one-region plan, aggressive, executing at once.
      setPlan(land, a, [order.region], "aggressive", true);
      break;
    case "army_front":
      setFront(land, a, order.anchor, order.enemy);
      break;
    case "army_direct":
      setDirect(land, a, order);
      break;
    case "army_plan":
      setPlan(land, a, order.targets, order.stance, false);
      break;
    case "army_execute":
      if (a.order.kind === "front" && order.on) {
        // A plan with no targets: the whole front advances.
        a.order = { ...a.order, kind: "plan", targets: [] };
      }
      if (a.order.kind === "plan") a.order.executing = order.on;
      a.pending = true;
      break;
    case "army_halt":
      setOrder(a, idleOrder());
      break;
    case "army_split":
      split(land, a, order.count, order.template);
      break;
    case "army_merge":
      merge(land, a, order.into);
      break;
    case "army_disband":
      for (const id of [...a.divisions]) {
        const r = land.divisions.rowOf(id);
        if (r >= 0) disbandDivision(land, r);
      }
      break;
    case "army_auto":
      setAutoLevel(land, a, order.on ? 2 : 0);
      break;
    case "army_auto_level":
      setAutoLevel(land, a, order.level);
      break;
    case "army_zone":
      setZone(a, order.regions);
      break;
    // ww162 (battle planner, design ww162 §1.1-§1.3): the three lines.
    case "army_front_line":
      setFrontLine(a, order.ends, order.enemy);
      break;
    case "army_goal":
      setGoal(land, a, order.regions, order.spear, order.stance);
      break;
    case "army_fallback":
      setFallback(a, order.regions, order.manual);
      break;
    case "army_fall_back":
      fallBack(land, a);
      a.pending = true;
      break;
    // ww162 §1.4 (lane L2): per-division pins.
    case "division_move":
      pinDivisions(land, a, order.divisions, order.region);
      break;
    case "division_release":
      releasePins(land, a, order.divisions);
      break;
    case "paradrop": {
      // P4 (spec §14.10, pre-flight A12): paradropPrepPct shortens it.
      const pct =
        100 + (land.econ.country(a.owner)?.stats.paradropPrepPct ?? 0);
      setOrder(a, {
        ...idleOrder(),
        kind: "paradrop",
        to: order.region,
        readyDay:
          land.day() +
          Math.max(1, Math.ceil((WW_PARA_PREP_DAYS * Math.max(10, pct)) / 100)),
      });
      break;
    }
    default:
      // army_general: Task 5's assignGeneral (WwLand.issue routes it).
      break;
  }
  if (land.armies.has(a.id)) land.markArmy(a.id);
  return null;
}

/**
 * ww7: the army's auto level (0 off, 1 defend only, 2 full); `auto` follows.
 * ww162 §1.4: the AI takes the whole army, so its pins go.
 */
function setAutoLevel(land: WwLand, a: Army, level: number): void {
  a.autoLevel = level;
  a.auto = level > 0;
  if (level > 0) releasePins(land, a, []);
}

/**
 * ww162 §1.4: `ids` (repeats dropped) are pinned to `region`, a pin already
 * there moved. An attack on another region is left at once (a defence goes
 * on until its battle ends). The army goes pending: its layout no longer
 * counts them, and the pin step sends them now.
 */
function pinDivisions(
  land: WwLand,
  a: Army,
  ids: readonly number[],
  region: number,
): void {
  const t = land.divisions;
  const pins = new Map(a.pins.map((p) => [p[0], p[1]]));
  for (const id of ids) {
    pins.set(id, region);
    const r = t.rowOf(id);
    if (r >= 0 && t.battle[r] !== region) leaveAttack(land, r);
  }
  a.pins = [...pins]
    .sort((x, y) => x[0] - y[0])
    .map(([id, to]): [number, number] => [id, to]);
  a.pending = true;
}

/**
 * ww162 §1.4: the pins of `ids` go (empty: every pin); the army takes the
 * divisions back on its next apply (it goes pending when one went).
 */
export function releasePins(
  land: WwLand,
  a: Army,
  ids: readonly number[],
): void {
  if (a.pins.length === 0) return;
  const drop = new Set(ids);
  const keep = ids.length === 0 ? [] : a.pins.filter((p) => !drop.has(p[0]));
  if (keep.length === a.pins.length) return;
  a.pins = keep;
  a.pending = true;
  land.markArmy(a.id);
}

/**
 * ww7: the player's explicit zone (tap order kept, repeats dropped); the
 * order block lets only a front or plan army through. Empty: automatic.
 * The day's zone is recomputed at once (the army is pending).
 */
function setZone(a: Army, regions: readonly number[]): void {
  a.order = { ...a.order, zone: [...new Set(regions)] };
  // ww162 §5: an old order clears the line fields.
  clearLines(a.order);
  if (a.order.kind === "front" || a.order.kind === "plan") a.pending = true;
}

/** ww162 §5: the battle planner's front and offensive lines go (the fallback line stays). */
function clearLines(o: ArmyOrder): void {
  delete o.ends;
  delete o.goal;
  delete o.spear;
}

/**
 * ww162 §1.1: the front line between two ends against `enemy`. It clears
 * the zone, the goal and the targets (the fallback line stays). The
 * readiness stays when it is the same front (setFront's rule: the same
 * enemy and an end on the army's front), else it starts at 0.
 */
function setFrontLine(a: Army, ends: [number, number], enemy: number): void {
  const o = a.order;
  const same =
    (o.kind === "front" || o.kind === "plan") &&
    o.enemy === enemy &&
    (a.front.includes(ends[0]) || a.front.includes(ends[1]));
  a.order = {
    ...idleOrder(),
    kind: "front",
    anchor: ends[0],
    enemy,
    ends: [ends[0], ends[1]],
    ...fallbackOf(o),
  };
  a.path = [];
  if (!same) a.planBp = 0;
  a.pending = true;
}

/**
 * ww162 §1.2: the offensive line. Empty: the line goes and the army keeps
 * its front (not attacking). Else the regions (drawn order, repeats
 * dropped, at most WW_GOAL_MAX) become a plan's goal with the stance; an
 * executing plan keeps executing (army_execute starts and halts it), and the
 * readiness stays. An army with no front, or whose front faces another
 * country than every goal region's, gets one toward them (setPlan's rule).
 */
function setGoal(
  land: WwLand,
  a: Army,
  regions: readonly number[],
  spear: boolean,
  stance: Stance,
): void {
  const goal = [...new Set(regions)].slice(0, WW_GOAL_MAX);
  const o = a.order;
  if (goal.length === 0) {
    if (o.kind !== "front" && o.kind !== "plan") return;
    const next: ArmyOrder = {
      ...o,
      kind: "front",
      targets: [],
      executing: false,
    };
    delete next.goal;
    delete next.spear;
    delete next.direct;
    a.order = next;
    a.pending = true;
    return;
  }
  const executing = o.kind === "plan" && o.executing;
  aimFront(land, a, goal);
  const next: ArmyOrder = {
    ...a.order,
    kind: "plan",
    targets: [],
    stance,
    executing,
    goal,
  };
  if (spear) next.spear = true;
  else delete next.spear;
  delete next.direct;
  a.order = next;
  a.pending = true;
}

/**
 * ww162 §1.3: the fallback line (our side's regions, repeats dropped, at
 * most WW_ZONE_MAX; empty clears it), and whether the army falls back only
 * on army_fall_back. The count of the rule's days starts over.
 */
function setFallback(
  a: Army,
  regions: readonly number[],
  manual: boolean,
): void {
  const line = [...new Set(regions)].slice(0, WW_ZONE_MAX);
  const o = a.order;
  if (line.length === 0) {
    delete o.fallback;
    delete o.fbManual;
  } else {
    o.fallback = line;
    if (manual) o.fbManual = true;
    else delete o.fbManual;
  }
  a.fbDays = 0;
}

/**
 * ww42: a human's direct attack. The settings set first; a list of targets
 * becomes a plan that runs at once (taken in order), an empty list stops a
 * direct attack. A field left out stays.
 */
function setDirect(
  land: WwLand,
  a: Army,
  order: Extract<LandOrder, { kind: "army_direct" }>,
): void {
  const bit = (flag: number, on: boolean | undefined) => {
    if (on === undefined) return;
    a.dflags = on ? a.dflags | flag : a.dflags & ~flag;
  };
  bit(DIRECT_FAVORABLE, order.favorable);
  bit(DIRECT_ALL_IN, order.allIn);
  bit(DIRECT_ADVANCE, order.advance);
  bit(DIRECT_MERGE, order.merge);
  if (order.targets === undefined) {
    // The next day's layout reads the settings; a running attack is redrawn now.
    if (a.order.direct === true) a.pending = true;
    return;
  }
  if (order.targets.length === 0) {
    if (a.order.direct === true) setOrder(a, idleOrder());
    return;
  }
  setPlan(land, a, order.targets, "aggressive", true);
  a.order.direct = true;
}

/**
 * A new standing order that is no front: the front and the readiness go.
 * ww162 §1.4: so do the pins (a halt, move, rail, paradrop or garrison
 * takes the whole army).
 */
function setOrder(a: Army, order: ArmyOrder): void {
  a.order = order;
  a.pins = [];
  a.front = [];
  a.path = [];
  a.planBp = 0;
  a.pending = true;
}

/**
 * P5 (plan decision 10, spec §8.5): the army garrisons the administered
 * regions of legal owner `scope` (0: all). Lane O's Garrison picks the
 * regions each day; fronts, plans and the AI's grouping leave it be.
 */
export function setGarrison(land: WwLand, a: Army, scope: number): void {
  cancelInvasion(land.ww.navy, a.id);
  setOrder(a, { ...idleOrder(), kind: "garrison", enemy: scope });
  a.path = [];
  land.markArmy(a.id);
}

function setMove(land: WwLand, a: Army, to: number, mode: number): void {
  const from = land.armyRegion(a);
  setOrder(a, { ...idleOrder(), kind: "move", to, mode });
  const me = land.ownerForSides(a);
  const ours = (r: number) => land.sameSide(me, land.controller[r]);
  a.path =
    mode === MOVE_SEA
      ? [from, to]
      : mode === MOVE_RAIL
        ? railPath(land, me, from, to)
        : findPath(land, a, from, to, ours);
}

/**
 * Spec §8.3: a front order. The readiness stays only when it is the same
 * front (same enemy, the anchor on the army's front); else it starts at 0.
 */
function setFront(land: WwLand, a: Army, anchor: number, enemy: number): void {
  const o = a.order;
  const same =
    (o.kind === "front" || o.kind === "plan") &&
    o.enemy === enemy &&
    a.front.includes(anchor);
  // ww162: the fallback line stays on a front order.
  a.order = { ...idleOrder(), kind: "front", anchor, enemy, ...fallbackOf(o) };
  a.path = [];
  if (!same) a.planBp = 0;
  a.pending = true;
}

/**
 * Spec §8.2: targets and stance on the army's front. An army with no front
 * gets one toward its targets (anchor = the border region nearest them;
 * with no targets the one nearest the army), against the targets' country
 * when they share one, else every enemy. So does an army whose front
 * faces another country than every target's.
 */
function setPlan(
  land: WwLand,
  a: Army,
  targets: readonly number[],
  stance: Stance,
  executing: boolean,
): void {
  aimFront(land, a, targets);
  const next: ArmyOrder = {
    ...a.order,
    kind: "plan",
    targets: [...targets],
    stance,
    executing,
  };
  // ww42: any other plan order ends a direct attack.
  delete next.direct;
  // ww162 §5: an old order clears the line fields.
  clearLines(next);
  a.order = next;
  a.pending = true;
}

/**
 * Spec §8.2: an army with no front gets one toward `targets` (anchor = the
 * border region nearest them; with no targets the one nearest the army),
 * against the targets' country when they share one, else every enemy. So
 * does an army whose front faces another country than every target's.
 * ww162: the fallback line stays.
 */
function aimFront(land: WwLand, a: Army, targets: readonly number[]): void {
  const o = a.order;
  const elsewhere =
    o.enemy !== 0 &&
    targets.length > 0 &&
    targets.every((r) => land.controller[r] !== o.enemy);
  if ((o.kind !== "front" && o.kind !== "plan") || elsewhere) {
    const owners = new Set(targets.map((r) => land.controller[r]));
    let enemy = owners.size === 1 ? [...owners][0] : 0;
    let anchor = autoAnchor(land, a, enemy, targets);
    if (anchor === 0 && enemy !== 0) {
      enemy = 0;
      anchor = autoAnchor(land, a, 0, targets);
    }
    a.order = {
      ...idleOrder(),
      kind: "front",
      anchor,
      enemy,
      ...fallbackOf(o),
    };
    a.path = [];
    a.planBp = 0;
  }
}

function autoAnchor(
  land: WwLand,
  a: Army,
  enemy: number,
  targets: readonly number[],
): number {
  const me = land.ownerForSides(a);
  const border = new Set(borderRegionsOf(land, me, enemy));
  if (targets.length > 0) {
    return nearestBorder(land, border, targets, () => true);
  }
  return nearestBorder(land, border, [land.armyRegion(a)], (r) =>
    land.sameSide(me, land.controller[r]),
  );
}

/** Spec §8.4: the `count` highest-id divisions (of `template`, 0: any) as a new waiting army. */
function split(land: WwLand, a: Army, count: number, template: number): void {
  const t = land.divisions;
  const ids = a.divisions.filter(
    (id) => template === 0 || t.template[t.rowOf(id)] === template,
  );
  const b = land.newArmy(a.owner);
  if (b === null) return;
  // P5 lane A: a volunteer army's part stays a volunteer of the same host.
  if (a.volunteerFor > 0) land.setVolunteerFor(b, a.volunteerFor);
  for (const id of ids.slice(ids.length - count)) land.moveToArmy(id, b);
  b.pending = true;
}

/** Spec §8.4: every division into `into`, which keeps its general and its order. */
function merge(land: WwLand, a: Army, into: number): void {
  const b = land.armies.get(into)!;
  for (const id of [...a.divisions]) land.moveToArmy(id, b);
  b.pending = true;
}

/**
 * Turns the pending orders into destinations, this tick (spec §2.2-3), in
 * army id order, and drops the paratroopers whose preparation is over.
 */
export function applyArmyOrders(land: WwLand, tick: number): void {
  const work: Army[] = [];
  for (const a of land.armies.values()) {
    if (a.pending || a.order.kind === "paradrop") work.push(a);
  }
  if (work.length === 0) return;
  const prep = land.ww.inPrep(tick);
  const day = land.ww.day(tick);
  for (const a of work) {
    if (!land.armies.has(a.id)) continue;
    if (a.pending) {
      a.pending = false;
      applyOrder(land, a, tick, prep ? -1 : day);
    }
    if (a.order.kind === "paradrop" && !prep && day >= a.order.readyDay) {
      drop(land, a, tick, day);
    }
  }
}

/** A division attacking from its region leaves that battle (Task 4 drops it next round). */
export function leaveAttack(land: WwLand, r: number): void {
  const t = land.divisions;
  if (t.role[r] !== ROLE_ATTACK) return;
  t.role[r] = ROLE_NONE;
  land.markArmy(t.army[r]);
}

/**
 * Spec §8.4 halt: a walk, train or ship finishes the edge it is on and
 * stops there; walking into an enemy region (an attack) stops at once.
 * Retreats and advances (the battles') go on.
 */
export function stopOrFinishEdge(land: WwLand, r: number): void {
  const t = land.divisions;
  const m = t.mode[r];
  if (m === MOVE_NONE) {
    t.dest[r] = t.region[r];
  } else if (
    m === MOVE_WALK &&
    !land.sameSide(land.fightOwner(r), land.controller[t.next[r]])
  ) {
    stopDivision(land, r);
  } else if (m === MOVE_WALK || m === MOVE_RAIL || m === MOVE_SEA) {
    t.dest[r] = t.next[r];
  }
}

function applyOrder(land: WwLand, a: Army, tick: number, day: number): void {
  const t = land.divisions;
  const o = a.order;
  // ww162 §1.4: a voyage or an invasion takes the whole army (pins go);
  // otherwise the order moves the free divisions and the pins their own.
  if (a.pins.length > 0 && busyAtSea(land, a)) a.pins = [];
  const rows = freeRows(land, a);
  const me = land.ownerForSides(a);
  if (o.kind !== "front" && o.kind !== "plan") a.odds = undefined;
  switch (o.kind) {
    case "idle":
      for (const r of rows) {
        leaveAttack(land, r);
        stopOrFinishEdge(land, r);
      }
      break;
    case "move":
      for (const r of rows) {
        leaveAttack(land, r);
        const m = t.mode[r];
        if (m === MOVE_RETREAT) continue;
        if (o.mode === MOVE_RAIL || o.mode === MOVE_SEA) {
          // Spec §7.4, §7.5: on the train or the ship with org 0.
          if (m === MOVE_ADVANCE) continue;
          stopDivision(land, r);
          t.dest[r] = o.to;
          startNextHop(land, r, tick);
          if (t.mode[r] !== MOVE_NONE) t.org[r] = 0;
          continue;
        }
        if (m === MOVE_WALK && !land.sameSide(me, land.controller[t.next[r]])) {
          stopDivision(land, r);
        }
        t.dest[r] = o.to;
        if (t.mode[r] === MOVE_NONE) startNextHop(land, r, tick);
      }
      break;
    case "front":
    case "plan":
      if (!(o.kind === "plan" && o.executing)) {
        // Not attacking: out of the attacks, the walks into enemy land stop.
        for (const r of rows) {
          leaveAttack(land, r);
          if (
            t.mode[r] === MOVE_WALK &&
            !land.sameSide(me, land.controller[t.next[r]])
          ) {
            stopDivision(land, r);
          }
        }
      }
      // ww7: the zone, the gaps, the divisions and (executing) the attack,
      // now: the screen sees the new order within a tick.
      applyFront(land, a, tick, day);
      break;
    case "paradrop":
      // Spec §7.6: ten days of preparation where they stand.
      for (const r of rows) {
        leaveAttack(land, r);
        if (t.mode[r] !== MOVE_RETREAT) stopDivision(land, r);
      }
      break;
  }
  stepPins(land, a, tick);
  land.markArmy(a.id);
}

/** ww162 §1.4: the army sails, invades or drops as a whole (no division may be pinned out). */
function busyAtSea(land: WwLand, a: Army): boolean {
  const o = a.order;
  return (
    o.kind === "invade" ||
    o.kind === "paradrop" ||
    (o.kind === "move" && o.mode === MOVE_SEA) ||
    land.ww.navy.invasions.has(a.id)
  );
}

/**
 * Spec §7.6 (plan decision 19): the drop. Every division lands in the
 * target with 40% of its max org; an empty enemy region is taken, an
 * occupied one is attacked from inside. A target no longer enemy or ours,
 * or a division without paratroopers (merged in), calls it off.
 */
function drop(land: WwLand, a: Army, tick: number, day: number): void {
  const t = land.divisions;
  const to = a.order.to;
  const me = a.owner;
  // ww162 §1.4: the whole army drops.
  a.pins = [];
  const rows = armyRows(land, a);
  const c = land.controller[to];
  const enemy = land.isEnemy(me, c);
  a.order = idleOrder();
  land.markArmy(a.id);
  const para = rows.every(
    (r) => (land.baseStatsOf(r).flags & TPL_PARA_ANY) !== 0,
  );
  if (rows.length === 0 || !para || (!enemy && !land.sameSide(me, c))) return;
  const ids: number[] = [];
  for (const r of rows) {
    stopDivision(land, r);
    land.setDivisionRegion(r, to);
    t.dest[r] = to;
    t.stillDays[r] = 0;
    t.entrench[r] = 0;
    t.org[r] = Math.floor((land.orgMaxOf(r) * PARA_ORG_PCT) / 100);
    ids.push(t.id[r]);
  }
  a.paraLastDay = day;
  // P4 plan decision 35: the transports' losses (lane A2).
  resolveParadrop(land.ww.air, a.id, tick);
  if (!enemy) return;
  if (enemyDivisionsIn(land, me, to) === 0) {
    capture(land, to, me, tick);
  } else {
    for (const id of ids) joinBattle(land, id, to);
  }
}

/** The engine and the screens share it: why `order` cannot be given now. */
export function armyOrderBlock(
  land: WwLand,
  cl: CountryLand,
  order: LandOrder,
): WwOrderBlock | null {
  const w = orderCheckWorld(land, cl.smallID);
  const block = landOrderBlockOf(w, order);
  if (block !== null || order.kind !== "division_move") return block;
  return divisionOrderBlock(land, w, order);
}

/**
 * ww162 §1.4: division_move's own checks, after the army's: every division
 * is one of the army's (no repeat), the army is not sailing, invading or
 * dropping (army_busy), and the region is one they may go to
 * (CommandRules.divisionMoveBlock).
 */
function divisionOrderBlock(
  land: WwLand,
  w: OrderCheckWorld,
  order: Extract<LandOrder, { kind: "division_move" }>,
): WwOrderBlock | null {
  const a = land.armies.get(order.army)!;
  const t = land.divisions;
  const ids = new Set(order.divisions);
  if (ids.size !== order.divisions.length) return "bad_index";
  const from: number[] = [];
  for (const id of order.divisions) {
    const r = t.rowOf(id);
    if (r < 0 || !a.divisions.includes(id)) return "bad_index";
    from.push(t.region[r]);
  }
  if (busyAtSea(land, a)) return "army_busy";
  // P5 lane A: a volunteer army's side checks read its host's.
  return divisionMoveBlock(
    { ...w, me: land.ownerForSides(a) },
    from,
    order.region,
  );
}

/** The order checks' view of the land war for country `me`. */
export function orderCheckWorld(land: WwLand, me: number): OrderCheckWorld {
  const sc = land.scenario;
  return {
    scenario: sc,
    controller: land.controller,
    sameSide: (a, b) => land.sameSide(a, b),
    isEnemy: (a, b) => land.isEnemy(a, b),
    me,
    day: land.day(),
    rail: (r) => land.econ.rail[r] ?? 0,
    // P4 plan decision 11: a working naval base now.
    isPort: (r) => navalPort(land.ww, r),
    // P4 (pre-flight A20): the air war's paradrop conditions (lane A2).
    paraBlock: (army, target) => land.ww.air.paradropBlock(me, army, target),
    vp: (r) => sc.region(r)?.vp ?? 0,
    army: (id) => {
      const a = land.armies.get(id);
      return a === undefined ? null : orderCheckArmy(land, a);
    },
    armyCount: () => land.armiesOf(me).length,
  };
}

/** The order checks' view of one army. */
export function orderCheckArmy(land: WwLand, a: Army): OrderCheckArmy {
  const t = land.divisions;
  const regions = new Set<number>();
  const templates: number[] = [];
  let fighting = false;
  let allPara = true;
  for (const r of armyRows(land, a)) {
    regions.add(t.region[r]);
    templates.push(t.template[r]);
    const m = t.mode[r];
    if (
      t.battle[r] !== 0 ||
      m === MOVE_RAIL ||
      m === MOVE_SEA ||
      m === MOVE_RETREAT ||
      m === MOVE_ADVANCE
    ) {
      fighting = true;
    }
    if ((land.baseStatsOf(r).flags & TPL_PARA_ANY) === 0) allPara = false;
  }
  return {
    owner: a.owner,
    // P5 lane A: a volunteer army's side checks read its host.
    sides: land.ownerForSides(a),
    divisions: templates.length,
    regions: [...regions].sort((x, y) => x - y),
    fighting,
    allPara: templates.length > 0 && allPara,
    paraLastDay: a.paraLastDay,
    templates,
    front: a.order.kind === "front" || a.order.kind === "plan",
    // ww162: army_fall_back needs a line to fall back to.
    fallback: a.order.fallback ?? [],
  };
}
