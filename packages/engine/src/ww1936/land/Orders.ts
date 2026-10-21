// World War 1936 P2: army orders (P2 spec §7, §8.2–§8.5, §16.3). An order
// changes the army's standing order and marks it pending; applyArmyOrders
// turns it into the divisions' destinations in the same tick (spec §2.2-3).
import type { LandOrder } from "@openfront/engine-api/Schemas";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  type ArmyOrder,
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
  WW_PARA_PREP_DAYS,
} from "@openfront/engine-api/ww1936/LandTypes";
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
import { assignFront, nearestBorder, type TargetDist } from "./Fronts";
import {
  enemyDivisionsIn,
  findPath,
  railPath,
  startNextHop,
  stopDivision,
} from "./Movement";
import { capture } from "./Occupation";
import { armyRows, planDay } from "./Plans";
import { disbandDivision } from "./Sustain";
import type { Army, CountryLand, WwLand } from "./WwLand";

/** Spec §7.6: a dropped division lands with this share of its max org. */
const PARA_ORG_PCT = 40;

/**
 * Spec §16.3: one army order (army_* and paradrop). `by` (pre-flight U2):
 * a "player" order of any kind but army_auto turns the army's auto off
 * (spec §8.5), army_general included; an "ai" order does not.
 */
export function issueArmyOrder(
  land: WwLand,
  cl: CountryLand,
  order: LandOrder,
  by: LandOrderSource,
): WwOrderBlock | null {
  const block = armyOrderBlock(land, cl, order);
  if (block !== null) return block;
  if (!("army" in order)) return null;
  const a = land.armies.get(order.army)!;
  if (by === "player" && order.kind !== "army_auto") a.auto = false;
  // P4 spec §11.1 (pre-flight A11): another standing order drops the
  // army's invasion (lane I); the general and auto keep it.
  if (
    order.kind !== "army_auto" &&
    order.kind !== "army_general" &&
    order.kind !== "army_execute"
  ) {
    cancelInvasion(land.ww.navy, a.id);
  }
  switch (order.kind) {
    case "army_move":
      // Spec §7.3: a move onto an enemy region is a one-target attack.
      if (!land.sameSide(a.owner, land.controller[order.region])) {
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
      a.auto = order.on;
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

/** A new standing order that is no front: the front and the readiness go. */
function setOrder(a: Army, order: ArmyOrder): void {
  a.order = order;
  a.front = [];
  a.path = [];
  a.planBp = 0;
  a.pending = true;
}

function setMove(land: WwLand, a: Army, to: number, mode: number): void {
  const from = land.armyRegion(a);
  setOrder(a, { ...idleOrder(), kind: "move", to, mode });
  const ours = (r: number) => land.sameSide(a.owner, land.controller[r]);
  a.path =
    mode === MOVE_SEA
      ? [from, to]
      : mode === MOVE_RAIL
        ? railPath(land, a.owner, from, to)
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
  a.order = { ...idleOrder(), kind: "front", anchor, enemy };
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
    a.order = { ...idleOrder(), kind: "front", anchor, enemy };
    a.path = [];
    a.planBp = 0;
  }
  a.order = {
    ...a.order,
    kind: "plan",
    targets: [...targets],
    stance,
    executing,
  };
  a.pending = true;
}

function autoAnchor(
  land: WwLand,
  a: Army,
  enemy: number,
  targets: readonly number[],
): number {
  const border = new Set(borderRegionsOf(land, a.owner, enemy));
  if (targets.length > 0) {
    return nearestBorder(land, border, targets, () => true);
  }
  return nearestBorder(land, border, [land.armyRegion(a)], (r) =>
    land.sameSide(a.owner, land.controller[r]),
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
    !land.sameSide(t.owner[r], land.controller[t.next[r]])
  ) {
    stopDivision(land, r);
  } else if (m === MOVE_WALK || m === MOVE_RAIL || m === MOVE_SEA) {
    t.dest[r] = t.next[r];
  }
}

function applyOrder(land: WwLand, a: Army, tick: number, day: number): void {
  const t = land.divisions;
  const o = a.order;
  const rows = armyRows(land, a);
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
        if (
          m === MOVE_WALK &&
          !land.sameSide(a.owner, land.controller[t.next[r]])
        ) {
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
            !land.sameSide(a.owner, land.controller[t.next[r]])
          ) {
            stopDivision(land, r);
          }
        }
      }
      {
        const dist: TargetDist = { value: null };
        if (assignFront(land, a, tick, undefined, dist) && day >= 0) {
          planDay(land, a, day, dist.value ?? undefined);
        }
      }
      break;
    case "paradrop":
      // Spec §7.6: ten days of preparation where they stand.
      for (const r of rows) {
        leaveAttack(land, r);
        if (t.mode[r] !== MOVE_RETREAT) stopDivision(land, r);
      }
      break;
  }
  land.markArmy(a.id);
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
  return landOrderBlockOf(orderCheckWorld(land, cl.smallID), order);
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
    divisions: templates.length,
    regions: [...regions].sort((x, y) => x - y),
    fighting,
    allPara: templates.length > 0 && allPara,
    paraLastDay: a.paraLastDay,
    templates,
    front: a.order.kind === "front" || a.order.kind === "plan",
  };
}
