// World War 1936 P2: battle plans and planning (P2 spec §8.2, §8.3).
import {
  MOVE_ADVANCE,
  MOVE_NONE,
  MOVE_RETREAT,
  MOVE_WALK,
  TPL_SIGNAL,
  traitBit,
  WW_PLAN_DAY_BP,
  WW_PLAN_FIGHT_BP,
  type BattlePrediction,
  type Stance,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  addToSide,
  emptySide,
  planMaxBp,
  predictBattle,
} from "@openfront/engine-lib/ww1936/CombatRules";
import { joinBattle, modsOf } from "./Battles";
import { generalOf } from "./GeneralsRun";
import { enemyDivisionsIn, startHopInto } from "./Movement";
import { leaveAttack } from "./Orders";
import type { Army, WwLand } from "./WwLand";

/** Spec §8.2: the ratio a stance attacks at (‰) and the org it attacks with (% of max). */
const STANCE_RATIO_PM: Readonly<Record<Stance, number>> = {
  careful: 1500,
  balanced: 1000,
  aggressive: 0,
};
const STANCE_ORG_PCT: Readonly<Record<Stance, number>> = {
  careful: 80,
  balanced: 60,
  aggressive: 30,
};

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
export function targetDistances(land: WwLand, army: Army): Int32Array {
  const sc = land.scenario;
  const targets = army.order.targets;
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
      if (dist[e.to] !== FAR || !land.canEnter(army.owner, e.to)) continue;
      dist[e.to] = dist[u] + 1;
      queue.push(e.to);
    }
  }
  return dist;
}

/** Enemy divisions' defence in `region` (the plan's "weaker first"). */
function enemyStrength(land: WwLand, me: number, region: number): number {
  const t = land.divisions;
  let s = 0;
  for (const r of land.rowsIn(region)) {
    const m = t.mode[r];
    if (m === MOVE_ADVANCE || m === MOVE_RETREAT) continue;
    if (land.isEnemy(me, t.owner[r])) s += land.statsOf(r).def;
  }
  return s;
}

/**
 * Spec §8.2: one day of an executing plan, front region by front region
 * (front order): the enemy region next to it no farther from the targets
 * (nearest the targets, then the weaker, then the smaller id) is walked
 * into when empty, or attacked when the preview clears the stance's ratio.
 * The plan ends when our side holds every target.
 */
export function planDay(
  land: WwLand,
  army: Army,
  day: number,
  /** targetDistances(land, army) when the caller has it (this tick, nothing moved since). */
  targetDist?: Int32Array,
): void {
  const o = army.order;
  if (o.kind !== "plan" || !o.executing) return;
  const me = army.owner;
  if (
    o.targets.length > 0 &&
    o.targets.every((r) => land.sameSide(me, land.controller[r]))
  ) {
    // Done: the army holds its front, out of any attack.
    o.executing = false;
    for (const r of armyRows(land, army)) leaveAttack(land, r);
    land.markArmy(army.id);
    return;
  }
  const sc = land.scenario;
  const t = land.divisions;
  const dist = targetDist ?? targetDistances(land, army);
  const rows = armyRows(land, army);
  for (const f of army.front) {
    const here = rows.filter(
      (r) => t.region[r] === f && t.mode[r] === MOVE_NONE,
    );
    if (here.length === 0) continue;
    let best = -1;
    let bestD = 0;
    let bestS = 0;
    for (const e of sc.edgesOf(f)) {
      const c = land.controller[e.to];
      if (!land.isEnemy(me, c)) continue;
      // A front against one country attacks it (and the plan's targets).
      if (o.enemy !== 0 && c !== o.enemy && !o.targets.includes(e.to)) {
        continue;
      }
      const d = dist[e.to];
      if (d > dist[f]) continue;
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
    if (best < 0) continue;
    if (enemyDivisionsIn(land, me, best) === 0) {
      // Spec §7.7: walk into an empty enemy region, one division (the
      // fastest, then the smaller id), unless one is on its way already.
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
    // The preview: the divisions free to attack or attacking it already.
    const side = here.filter((r) => t.battle[r] === 0 || t.battle[r] === best);
    if (side.length === 0) continue;
    const p = predictAttack(land, side, best);
    if (p.ratioPm < STANCE_RATIO_PM[o.stance]) continue;
    const pct = STANCE_ORG_PCT[o.stance];
    const ids: number[] = [];
    for (const r of here) {
      if (t.battle[r] !== 0) continue;
      if (t.org[r] * 100 >= land.orgMaxOf(r) * pct) ids.push(t.id[r]);
    }
    for (const id of ids) joinBattle(land, id, best);
  }
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
  const plan = g === null ? 0 : g.plan;
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
      ce.stats.planSpeedPct;
    bp += Math.floor((WW_PLAN_DAY_BP * pct) / 100);
  } else if (rows.some((r) => t.battle[r] !== 0)) {
    bp -= Math.floor((WW_PLAN_FIGHT_BP * Math.max(0, 100 - plan * 10)) / 100);
  }
  bp = Math.max(0, Math.min(planMaxBp(ce.stats), bp));
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
  const t = land.divisions;
  const att = emptySide();
  const owners: number[] = [];
  const from = new Set<number>();
  for (const r of attackers) {
    addToSide(att, land.statsOf(r), t.org[r]);
    if (!owners.includes(t.owner[r])) owners.push(t.owner[r]);
    from.add(t.region[r]);
  }
  const def = emptySide();
  let firstDef = -1;
  for (const r of land.rowsIn(region)) {
    const m = t.mode[r];
    if (m === MOVE_ADVANCE || m === MOVE_RETREAT) continue;
    if (
      owners.length === 0 ||
      !owners.every((o) => land.isEnemy(o, t.owner[r]))
    ) {
      continue;
    }
    if (firstDef < 0) firstDef = r;
    addToSide(def, land.statsOf(r), t.org[r]);
  }
  const neutral = { attackBp: 10_000, defenseBp: 10_000 };
  const am =
    attackers.length === 0 ? neutral : modsOf(land, attackers[0], region, true);
  const dm = firstDef < 0 ? neutral : modsOf(land, firstDef, region, false);
  return predictBattle(att, def, {
    land: land.scenario.landOf(region),
    directions: Math.max(1, Math.min(4, from.size)),
    attackerAttackBp: am.attackBp,
    attackerBlockBp: am.defenseBp,
    defenderAttackBp: dm.attackBp,
    defenderBlockBp: dm.defenseBp,
  });
}
