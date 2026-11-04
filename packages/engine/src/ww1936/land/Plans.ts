// World War 1936 P2: battle plans and planning (P2 spec §8.2, §8.3).
// ww7: an Attack (a plan order) attacks from the axis of its zone.
import {
  DIRECT_ADVANCE,
  DIRECT_ALL_IN,
  DIRECT_FAVORABLE,
  idleOrder,
  MOVE_ADVANCE,
  MOVE_NONE,
  MOVE_RETREAT,
  MOVE_WALK,
  ROLE_ATTACK,
  TPL_SIGNAL,
  traitBit,
  WW_PLAN_DAY_BP,
  WW_PLAN_FIGHT_BP,
  type BattleCtx,
  type BattlePrediction,
  type BattleRange,
  type CombatMods,
  type DirectView,
  type SideSum,
  type Stance,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  addToSide,
  casCutHits,
  emptySide,
  planMaxBp,
  predictBattle,
  predictBattleRange,
} from "@openfront/engine-lib/ww1936/CombatRules";
import { landOrderBlockOf } from "@openfront/engine-lib/ww1936/LandOrderChecks";
import { effectiveLevel } from "../economy/Buildings";
import { joinBattle, modsOf } from "./Battles";
import { generalOf } from "./GeneralsRun";
import { enemyDivisionsIn, startHopInto } from "./Movement";
import { leaveAttack, orderCheckWorld } from "./Orders";
import type { Army, WwLand } from "./WwLand";

/**
 * ww7 §1-5: the range a stance attacks at, ‰ of the org-removal ratio the
 * preview must clear (careful on bad luck, balanced on the average,
 * aggressive on good luck); and the org it attacks with (% of max).
 */
const STANCE_MIN_PM = 1000;
const STANCE_ORG_PCT: Readonly<Record<Stance, number>> = {
  careful: 80,
  balanced: 60,
  aggressive: 30,
};
/** ww7 §1-4: an attacker below this org (% of max) leaves the attack. */
const ATTACK_LEAVE_PCT = 30;

/**
 * The preview figure a stance judges by. Aggressive attacks at any odds
 * (as before ww7): it is the player's own [공격] (army_attack) and the
 * 과감 switch, an order to go in whatever the preview says.
 */
function stancePm(range: BattleRange, stance: Stance): number {
  return stance === "careful"
    ? range.lowPm
    : stance === "balanced"
      ? range.midPm
      : STANCE_MIN_PM;
}

/** Live rows of an army's divisions, in row (= id) order. */
export function armyRows(land: WwLand, army: Army): number[] {
  const out: number[] = [];
  for (const id of army.divisions) {
    const r = land.divisions.rowOf(id);
    if (r >= 0) out.push(r);
  }
  return out;
}

/** Edges no region is from the plan's targets. */
export const FAR = 1 << 30;

/**
 * Spec §8.2-1: edges from the plan's targets to every region the army's
 * country may enter (ours, our side's, an enemy's), by BFS; FAR where
 * none reaches. No targets: 0 everywhere (an advance on the whole front).
 */
export function targetDistances(
  land: WwLand,
  army: Army,
  /** ww7 lane D: hypothetical targets (the AI's gate), default the order's. */
  targets: readonly number[] = army.order.direct === true
    ? army.order.targets.slice(0, 1)
    : army.order.targets,
): Int32Array {
  const sc = land.scenario;
  const dist = new Int32Array(sc.maxRegionId() + 1).fill(
    targets.length === 0 ? 0 : FAR,
  );
  if (targets.length === 0) return dist;
  const queue: number[] = [];
  for (const r of [...targets].sort((a, b) => a - b)) {
    if (dist[r] === 0) continue;
    dist[r] = 0;
    queue.push(r);
  }
  for (let i = 0; i < queue.length; i++) {
    const u = queue[i];
    for (const e of sc.edgesOf(u)) {
      // P5 (pre-flight §A A × T1): a volunteer army by P5's rule.
      if (dist[e.to] !== FAR || !land.canArmyEnter(army, e.to)) continue;
      dist[e.to] = dist[u] + 1;
      queue.push(e.to);
    }
  }
  return dist;
}

/**
 * ww7 §1-3: the zone regions nearest the plan's targets, where the spare
 * divisions gather and the attack goes in. Without target distances (a plan
 * with no targets, the whole front advancing) every zone region.
 */
export function axisOf(
  zone: readonly number[],
  dist: Int32Array | null,
): Set<number> {
  const out = new Set<number>();
  if (dist === null) {
    for (const f of zone) out.add(f);
    return out;
  }
  let min = Infinity;
  for (const f of zone) min = Math.min(min, dist[f]);
  for (const f of zone) if (dist[f] === min) out.add(f);
  return out;
}

/**
 * ww7 §1-5: a plan whose targets are all ours is done: the army turns to
 * Defend (a front order, automatic zone, anchored on its token region, not
 * executing; its readiness stays) and leaves the attacks. True when it did.
 */
export function finishPlan(land: WwLand, army: Army): boolean {
  const o = army.order;
  if (o.kind === "plan" && o.direct === true) return finishDirect(land, army);
  if (o.kind !== "plan" || o.targets.length === 0) return false;
  // P5 lane A: a volunteer army judges by its host's side.
  const me = land.ownerForSides(army);
  if (!o.targets.every((r) => land.sameSide(me, land.controller[r]))) {
    return false;
  }
  for (const r of armyRows(land, army)) leaveAttack(land, r);
  army.order = {
    ...idleOrder(),
    kind: "front",
    anchor: land.armyRegion(army),
    enemy: o.enemy,
  };
  army.odds = undefined;
  land.markArmy(army.id);
  return true;
}

/** ww42: the notice key for the block that stopped a direct attack. */
const STOP_KEYS = {
  not_at_war: "events_display.ww1936_direct_stop_war",
  no_path: "events_display.ww1936_direct_stop_path",
  not_adjacent: "events_display.ww1936_direct_stop_far",
} as const;

/**
 * ww42: a direct attack ends: the army turns to Defend where it stands (as
 * finishPlan does) and its player is told why.
 */
function endDirect(
  land: WwLand,
  army: Army,
  key:
    | (typeof STOP_KEYS)[keyof typeof STOP_KEYS]
    | "events_display.ww1936_direct_stop_gone"
    | "events_display.ww1936_direct_done"
    | "events_display.ww1936_direct_over",
): true {
  const o = army.order;
  for (const r of armyRows(land, army)) leaveAttack(land, r);
  army.order = {
    ...idleOrder(),
    kind: "front",
    anchor: land.armyRegion(army),
    enemy: o.enemy,
  };
  army.odds = undefined;
  land.message(army.owner, key, { army: army.nameNo });
  land.markArmy(army.id);
  return true;
}

/** ww42: the order checks' verdict on the direct attack's remaining targets, now. */
function directBlockNow(land: WwLand, army: Army): string | null {
  return landOrderBlockOf(orderCheckWorld(land, army.owner), {
    kind: "army_direct",
    army: army.id,
    targets: army.order.targets,
  });
}

/**
 * ww42: the nearest enemy region next to ground our side holds, by walking
 * out from the army's divisions over our side's land (the smaller id among
 * those next to the same layer); 0 when none is reachable.
 */
function nearestEnemyRegion(land: WwLand, army: Army, me: number): number {
  const sc = land.scenario;
  const ours = (r: number) => land.sameSide(me, land.controller[r]);
  const seen = new Set<number>();
  let layer: number[] = [];
  for (const r of armyRows(land, army)) {
    const at = land.divisions.region[r];
    if (!seen.has(at) && ours(at)) {
      seen.add(at);
      layer.push(at);
    }
  }
  layer.sort((x, y) => x - y);
  while (layer.length > 0) {
    let best = 0;
    for (const u of layer) {
      for (const e of sc.edgesOf(u)) {
        if (
          land.isEnemy(me, land.controller[e.to]) &&
          (best === 0 || e.to < best)
        ) {
          best = e.to;
        }
      }
    }
    if (best !== 0) return best;
    const next: number[] = [];
    for (const u of layer) {
      for (const e of sc.edgesOf(u)) {
        if (seen.has(e.to) || !ours(e.to)) continue;
        seen.add(e.to);
        next.push(e.to);
      }
    }
    layer = next.sort((x, y) => x - y);
  }
  return 0;
}

/**
 * ww42: a direct attack's day check. Targets our side holds drop out of the
 * list; with some left the order must still be possible (war, reach, a way
 * over our land), else it stops with a notice. With none left the army
 * defends and is told, or with [계속 진격] takes the nearest enemy region.
 * True when the attack ended.
 */
function finishDirect(land: WwLand, army: Army): boolean {
  const o = army.order;
  const me = land.ownerForSides(army);
  const left = o.targets.filter((r) => !land.sameSide(me, land.controller[r]));
  if (left.length !== o.targets.length) {
    o.targets = left;
    land.markArmy(army.id);
  }
  if (left.length > 0) {
    const block = directBlockNow(land, army);
    if (block === null) return false;
    return endDirect(
      land,
      army,
      STOP_KEYS[block as keyof typeof STOP_KEYS] ??
        "events_display.ww1936_direct_stop_gone",
    );
  }
  if ((army.dflags & DIRECT_ADVANCE) !== 0) {
    const next = nearestEnemyRegion(land, army, me);
    if (next !== 0) {
      o.targets = [next];
      if (directBlockNow(land, army) === null) {
        land.markArmy(army.id);
        return false;
      }
    }
    return endDirect(land, army, "events_display.ww1936_direct_over");
  }
  return endDirect(land, army, "events_display.ww1936_direct_done");
}

/** Enemy divisions' defence in `region` (the plan's "weaker first"). */
function enemyStrength(land: WwLand, me: number, region: number): number {
  const t = land.divisions;
  let s = 0;
  for (const r of land.rowsIn(region)) {
    const m = t.mode[r];
    if (m === MOVE_ADVANCE || m === MOVE_RETREAT) continue;
    if (land.isEnemy(me, land.fightOwner(r))) s += land.statsOf(r).def;
  }
  return s;
}

/**
 * Spec §8.2: the enemy region next to `f` no farther from the targets
 * (nearest the targets, then the weaker, then the smaller id); -1 when
 * none. `emptyOnly`: among the regions nobody defends.
 */
export function attackTarget(
  land: WwLand,
  army: Army,
  me: number,
  f: number,
  dist: Int32Array,
  emptyOnly: boolean,
  /** ww7 lane D: hypothetical enemy and targets (the AI's gate). */
  o: { enemy: number; targets: readonly number[] } = army.order,
): number {
  let best = -1;
  let bestD = 0;
  let bestS = 0;
  for (const e of land.scenario.edgesOf(f)) {
    const c = land.controller[e.to];
    if (!land.isEnemy(me, c)) continue;
    // A front against one country attacks it (and the plan's targets).
    if (o.enemy !== 0 && c !== o.enemy && !o.targets.includes(e.to)) continue;
    const d = dist[e.to];
    if (d > dist[f]) continue;
    if (emptyOnly && enemyDivisionsIn(land, me, e.to) !== 0) continue;
    const s = enemyStrength(land, me, e.to);
    if (
      best < 0 ||
      d < bestD ||
      (d === bestD && (s < bestS || (s === bestS && e.to < best)))
    ) {
      best = e.to;
      bestD = d;
      bestS = s;
    }
  }
  return best;
}

/**
 * Spec §8.2, ww7 §1-5: one day of an executing plan, zone region by zone
 * region (front order). Attackers below 30 % org leave their attack (a
 * fresher division of the axis joins below). The axis regions: the enemy
 * region next to it no farther from the targets (nearest the targets, then
 * the weaker, then the smaller id) is walked into when empty, or attacked
 * when the preview's range clears the stance (careful low, balanced
 * average, aggressive high ≥ 1000). The other zone regions hold, but walk
 * into an empty enemy region no farther from the targets, and only with a
 * division to spare. The plan ends (Defend) when our side holds every target.
 */
export function planDay(
  land: WwLand,
  army: Army,
  day: number,
  /** targetDistances(land, army) when the caller has it (this tick, nothing moved since). */
  targetDist?: Int32Array,
  /** The zone's axis (axisOf) when the caller has it. */
  axis?: ReadonlySet<number>,
): void {
  const o = army.order;
  if (o.kind !== "plan" || !o.executing) return;
  if (finishPlan(land, army)) return;
  // P5 lane A: a volunteer army attacks its host's enemies.
  const me = land.ownerForSides(army);
  const direct = o.direct === true;
  const favorable = direct && (army.dflags & DIRECT_FAVORABLE) !== 0;
  // ww42: a direct attack's other zone regions next to the same enemy region.
  const others: [number, number[]][] = [];
  const t = land.divisions;
  const dist = targetDist ?? targetDistances(land, army);
  const rows = armyRows(land, army);
  const ax = axis ?? axisOf(army.front, o.targets.length > 0 ? dist : null);
  // Enemy region -> the divisions of the axis regions that go for it.
  const strikes = new Map<number, number[]>();
  for (const f of army.front) {
    const here = rows.filter(
      (r) => t.region[r] === f && t.mode[r] === MOVE_NONE,
    );
    if (here.length === 0) continue;
    for (const r of here) {
      if (
        t.role[r] === ROLE_ATTACK &&
        t.org[r] * 100 < land.orgMaxOf(r) * ATTACK_LEAVE_PCT
      ) {
        leaveAttack(land, r);
      }
    }
    const onAxis = ax.has(f);
    const best = attackTarget(land, army, me, f, dist, !onAxis);
    if (best < 0) {
      // ww42: a holder off the axis joins an attack on an enemy region next to it that the axis attacks.
      if (direct && !onAxis) {
        const any = attackTarget(land, army, me, f, dist, false);
        if (any >= 0) {
          others.push([
            any,
            here.filter((r) => t.battle[r] === 0 || t.battle[r] === any),
          ]);
        }
      }
      continue;
    }
    if (enemyDivisionsIn(land, me, best) === 0) {
      // ww46: a direct attack sends every free division of the region the
      // same day, without waiting for the one ahead to arrive. A division
      // below 30 % org stays to recover; an off-axis region keeps its last
      // division unless [전부 공격] is on; one in a battle stays in it.
      if (direct) {
        const go = here
          .filter(
            (r) =>
              t.battle[r] === 0 &&
              t.org[r] * 100 >= land.orgMaxOf(r) * ATTACK_LEAVE_PCT,
          )
          .sort(
            (x, y) =>
              land.baseStatsOf(y).speedCenti - land.baseStatsOf(x).speedCenti ||
              t.id[x] - t.id[y],
          );
        const allIn = (army.dflags & DIRECT_ALL_IN) !== 0;
        if (!onAxis && !allIn && go.length === here.length) go.pop();
        for (const r of go) startHopInto(land, r, best, MOVE_WALK);
        continue;
      }
      // Spec §7.7: walk into an empty enemy region, one division (the
      // fastest, then the smaller id), unless one is on its way already. A
      // region off the axis keeps its last division.
      if (!onAxis && here.length < 2) continue;
      if (rows.some((r) => t.mode[r] === MOVE_WALK && t.next[r] === best)) {
        continue;
      }
      let pick = -1;
      let speed = -1;
      for (const r of here) {
        if (t.battle[r] !== 0) continue;
        const s = land.baseStatsOf(r).speedCenti;
        if (s > speed) {
          pick = r;
          speed = s;
        }
      }
      if (pick >= 0) startHopInto(land, pick, best, MOVE_WALK);
      continue;
    }
    if (!onAxis) continue;
    // The divisions free to attack it or attacking it already.
    const side = here.filter((r) => t.battle[r] === 0 || t.battle[r] === best);
    if (side.length === 0) continue;
    const known = strikes.get(best);
    if (known === undefined) strikes.set(best, side);
    else known.push(...side);
  }
  for (const [best, side] of others) {
    const known = strikes.get(best);
    if (known !== undefined) known.push(...side);
  }
  // The preview, per enemy region: every axis region that goes for it
  // attacks together (one direction each).
  // ww42: a direct attack goes at any odds (average ratio at 1.00 only when
  // [유리할 때만 공격] is on) and joins at 30 % org, as ATTACK_LEAVE_PCT.
  const pct = direct ? ATTACK_LEAVE_PCT : STANCE_ORG_PCT[o.stance];
  for (const [best, side] of strikes) {
    const p = predictAttackRange(land, side, best);
    if (direct) {
      if (favorable && p.midPm < STANCE_MIN_PM) continue;
    } else if (stancePm(p, o.stance) < STANCE_MIN_PM) continue;
    const ids: number[] = [];
    for (const r of side) {
      if (t.battle[r] !== 0) continue;
      if (t.org[r] * 100 >= land.orgMaxOf(r) * pct) ids.push(t.id[r]);
    }
    for (const id of ids) joinBattle(land, id, best);
  }
}

/**
 * ww7 §1-8: for a plan army, each zone region's enemy region it would
 * attack and the attacker's win % ([from, to, winPct]); 100 into an empty
 * region. The attackers are the army's divisions standing there, else the
 * ones headed there; the axis regions that go for the same enemy region
 * attack it together. A region with none, or with no enemy next to it, has
 * no entry.
 */
export function oddsOf(
  land: WwLand,
  army: Army,
  targetDist?: Int32Array,
): [number, number, number][] {
  const o = army.order;
  if (o.kind !== "plan") return [];
  const me = land.ownerForSides(army);
  const t = land.divisions;
  const dist = targetDist ?? targetDistances(land, army);
  const ax = axisOf(army.front, o.targets.length > 0 ? dist : null);
  const rows = armyRows(land, army);
  // Per zone region: where it would attack and with whom.
  const legs: { f: number; to: number; side: number[] }[] = [];
  // Enemy region -> the divisions of all the axis regions that go for it.
  const together = new Map<number, number[]>();
  for (const f of army.front) {
    const to = attackTarget(land, army, me, f, dist, false);
    if (to < 0) continue;
    let side = rows.filter(
      (r) =>
        t.region[r] === f &&
        t.mode[r] !== MOVE_ADVANCE &&
        t.mode[r] !== MOVE_RETREAT,
    );
    if (side.length === 0) side = rows.filter((r) => t.dest[r] === f);
    if (side.length === 0) continue;
    legs.push({ f, to, side });
    if (!ax.has(f)) continue;
    const known = together.get(to);
    if (known === undefined) together.set(to, [...side]);
    else known.push(...side);
  }
  return legs.map(({ f, to, side }) => [
    f,
    to,
    enemyDivisionsIn(land, me, to) === 0
      ? 100
      : predictAttackRange(land, ax.has(f) ? together.get(to)! : side, to)
          .winPct,
  ]);
}

/**
 * Spec §8.3: readiness for the day. A front or plan army that does not
 * execute plans (+100 bp × (100 + general's planning × 10 + signal company
 * 10 + offensive doctrine 10 + tech) / 100); an executing one with
 * divisions in battle loses (50 bp × (100 − planning × 10) / 100). Capped at
 * planMaxBp.
 */
export function readinessDay(land: WwLand, army: Army): void {
  const o = army.order;
  if (o.kind !== "front" && o.kind !== "plan") return;
  const ce = land.econ.country(army.owner);
  if (ce === null) return;
  const t = land.divisions;
  const g = generalOf(land, army);
  // Review L4 (spec §4.3): the field marshal's planning adds to the general's;
  // its traits speed the readiness and raise its cap (lane D).
  const am = land.depthHooks.armyMods(army.owner, army.id);
  const plan = (g === null ? 0 : g.plan) + am.fmPlan;
  const rows = armyRows(land, army);
  let bp = army.planBp;
  if (!(o.kind === "plan" && o.executing)) {
    const signal = rows.some((r) => (land.flagsOf(r) & TPL_SIGNAL) !== 0);
    const doctrine =
      g !== null && (g.traits & traitBit("offensive_doctrine")) !== 0;
    const pct =
      100 +
      plan * 10 +
      (signal ? 10 : 0) +
      (doctrine ? 10 : 0) +
      ce.stats.planSpeedPct +
      am.planSpeedPct;
    bp += Math.floor((WW_PLAN_DAY_BP * pct) / 100);
  } else if (rows.some((r) => t.battle[r] !== 0)) {
    bp -= Math.floor((WW_PLAN_FIGHT_BP * Math.max(0, 100 - plan * 10)) / 100);
  }
  bp = Math.max(0, Math.min(planMaxBp(ce.stats) + am.planMaxBp, bp));
  if (bp !== army.planBp) {
    army.planBp = bp;
    land.markArmy(army.id);
  }
}

/**
 * Spec §9.9 for the engine: `attackers` (rows) against `region`'s enemy
 * divisions, with their modifiers (plans, AI). Gathers each side's
 * modifiers with Battles.modInputOf (pre-flight U11), as the battles do:
 * each side's first division stands for its side. Defenders: the
 * divisions in the region at war with every attacking country (spec §9.1),
 * not advancing in or retreating.
 */
export function predictAttack(
  land: WwLand,
  attackers: readonly number[],
  region: number,
): BattlePrediction {
  const { att, def, ctx } = gatherAttack(land, attackers, region);
  return predictBattle(att, def, ctx);
}

/**
 * ww7: predictAttack with the luck range (low, average, high ratio and the
 * attacker's win %); the same gathering, then CombatRules.predictBattleRange.
 */
export function predictAttackRange(
  land: WwLand,
  attackers: readonly number[],
  region: number,
  /** ww7 lane D: the AI's gate counts divisions still on their way: the directions they will attack from. */
  directions?: number,
): BattleRange {
  const { att, def, ctx } = gatherAttack(land, attackers, region);
  if (directions !== undefined) {
    ctx.directions = Math.max(1, Math.min(4, directions));
  }
  return predictBattleRange(att, def, ctx);
}

/** The two sides' sums and the battle context predictAttack and predictAttackRange read. */
function gatherAttack(
  land: WwLand,
  attackers: readonly number[],
  region: number,
): { att: SideSum; def: SideSum; ctx: BattleCtx } {
  const t = land.divisions;
  const att = emptySide();
  const owners: number[] = [];
  const from = new Set<number>();
  for (const r of attackers) {
    addToSide(att, land.statsOf(r), t.org[r]);
    // P5 lane A: volunteers on either side count as the side they serve.
    const o = land.fightOwner(r);
    if (!owners.includes(o)) owners.push(o);
    from.add(t.region[r]);
  }
  const def = emptySide();
  let firstDef = -1;
  for (const r of land.rowsIn(region)) {
    const m = t.mode[r];
    if (m === MOVE_ADVANCE || m === MOVE_RETREAT) continue;
    if (
      owners.length === 0 ||
      !owners.every((o) => land.isEnemy(o, land.fightOwner(r)))
    ) {
      continue;
    }
    if (firstDef < 0) firstDef = r;
    addToSide(def, land.statsOf(r), t.org[r]);
  }
  const neutral: CombatMods = { attackBp: 10_000, defenseBp: 10_000 };
  const am =
    attackers.length === 0 ? neutral : modsOf(land, attackers[0], region, true);
  const dm = firstDef < 0 ? neutral : modsOf(land, firstDef, region, false);
  const ctx: BattleCtx = {
    land: land.scenario.landOf(region),
    directions: Math.max(1, Math.min(4, from.size)),
    // ww7: a fort of level 3+ halves the extra width of the directions.
    fort: effectiveLevel(land.econ, region, "fort"),
    attackerAttackBp: am.attackBp,
    attackerBlockBp: am.defenseBp,
    defenderAttackBp: dm.attackBp,
    defenderBlockBp: dm.defenseBp,
    defenderPrepBp: dm.prepBp ?? 0,
  };
  // ww8: the wings on station over a battle already there count in the odds.
  if (firstDef >= 0 && attackers.length > 0 && land.battles.has(region)) {
    const aa = effectiveLevel(land.econ, region, "anti_air");
    ctx.casAttCenti = casCutHits(
      land.hooks.casNowCenti(region, land.sideOf(owners[0])),
      land.statsOf(firstDef).airAtk,
      aa,
    );
    ctx.casDefCenti = casCutHits(
      land.hooks.casNowCenti(region, land.sideOf(land.controller[region] ?? 0)),
      land.statsOf(attackers[0]).airAtk,
      aa,
    );
  }
  return { att, def, ctx };
}

/**
 * ww42: how a human army's divisions stand now, by the rule the engine uses:
 * attacking (in a battle as attacker, by [our region, enemy region]), holding
 * the border (standing in a zone region off the axis, or defending), walking,
 * recovering (standing under 30 % org) and waiting (the rest). `why` says why
 * the waiting wait: 1 the odds gate ([유리할 때만 공격]), 2 org; `ratioPm`
 * is the average ratio of the axis region's attack.
 */
export function directView(land: WwLand, a: Army): DirectView {
  const t = land.divisions;
  const rows = armyRows(land, a);
  const axis = new Set<number>();
  if (a.order.kind === "plan" && a.front.length > 0) {
    const dist = a.order.targets.length > 0 ? targetDistances(land, a) : null;
    for (const f of axisOf(a.front, dist)) axis.add(f);
  }
  const zone = new Set(a.front);
  const atk = new Map<number, number>();
  const at = new Map<number, number>();
  let hold = 0;
  let wait = 0;
  let rec = 0;
  let walk = 0;
  const note = (region: number, kind: number) => {
    const k = region * 4 + kind;
    at.set(k, (at.get(k) ?? 0) + 1);
  };
  for (const r of rows) {
    const region = t.region[r];
    if (t.battle[r] !== 0 && t.role[r] === ROLE_ATTACK) {
      const k = region * 65536 + t.battle[r];
      atk.set(k, (atk.get(k) ?? 0) + 1);
    } else if (t.battle[r] !== 0) {
      hold++;
      note(region, 0);
    } else if (t.mode[r] !== MOVE_NONE) {
      walk++;
      note(region, 3);
    } else if (t.org[r] * 100 < land.orgMaxOf(r) * ATTACK_LEAVE_PCT) {
      rec++;
      note(region, 2);
    } else if (zone.has(region) && !axis.has(region)) {
      hold++;
      note(region, 0);
    } else {
      wait++;
      note(region, 1);
    }
  }
  // The odds of the first axis region's attack (the average ratio).
  let ratioPm = -1;
  if (a.order.kind === "plan" && a.order.targets.length > 0) {
    const me = land.ownerForSides(a);
    const dist = targetDistances(land, a);
    for (const f of [...axis].sort((x, y) => x - y)) {
      const to = attackTarget(land, a, me, f, dist, false);
      if (to < 0 || enemyDivisionsIn(land, me, to) === 0) continue;
      const side = rows.filter(
        (r) =>
          t.region[r] === f &&
          (t.battle[r] === to ||
            (t.battle[r] === 0 &&
              t.mode[r] === MOVE_NONE &&
              t.org[r] * 100 >= land.orgMaxOf(r) * ATTACK_LEAVE_PCT)),
      );
      if (side.length === 0) continue;
      ratioPm = predictAttackRange(land, side, to).midPm;
      break;
    }
  }
  const favorable = (a.dflags & DIRECT_FAVORABLE) !== 0;
  const why =
    favorable && wait > 0 && ratioPm >= 0 && ratioPm < STANCE_MIN_PM
      ? 1
      : atk.size === 0 && wait === 0 && rec > 0
        ? 2
        : 0;
  return {
    flags: a.dflags,
    atk: [...atk]
      .sort((x, y) => x[0] - y[0])
      .map(([k, n]) => [Math.floor(k / 65536), k % 65536, n]),
    hold,
    wait,
    rec,
    walk,
    why,
    ratioPm,
    at: [...at]
      .sort((x, y) => x[0] - y[0])
      .map(([k, n]) => [Math.floor(k / 4), k % 4, n]),
  };
}
