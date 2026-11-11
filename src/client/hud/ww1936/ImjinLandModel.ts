// ww177 I3b (Imjin design §5): what the battle card, the siege panel, the
// news line and the map read of an Imjin land battle. The engine sends the
// order pair, the crossing edge, the ambush and the sieges (ImjinData); the
// phase clock runs from the tick the client first saw the battle's orders
// (ImjinBattleClock, kept by WwNavyView). Pure: the tests drive it alone.
import type { ImjinData } from "@openfront/engine-api/imjin/ImjinTypes";
import {
  ARMY_RETREAT,
  type ArmySummary,
  type BattleSummary,
} from "@openfront/engine-api/ww1936/LandTypes";
import { ROW_MIX_OF, rowMixOf } from "@openfront/engine-lib/imjin/LandRound";
import {
  ATTACK_ORDERS,
  type AttackOrder,
  battleStep,
  type BattleStep,
  breachDaysFor,
  crossingOf,
  DEFENCE_STANCES,
  type DefenceStance,
  MASSED_CYCLE,
  PHASE_ROUNDS,
  phaseOf,
  riverFrozen,
  ROUND_TICKS,
  seesRhythm,
  terrainRow,
  volleyBeat,
  type VolleyBeat,
  type VolleyMode,
  volleyModeOf,
} from "@openfront/engine-lib/imjin/LandRules";
import {
  type ImjinEdge,
  type ImjinMapLike,
  regionTerrain,
} from "@openfront/engine-lib/imjin/Terrain";

/** WwImjin.EDGE_KINDS, in order (ImjinData.orders[].edge). */
export const IMJIN_EDGE_KINDS: readonly ImjinEdge[] = [
  "none",
  "small_river",
  "great_river",
  "ford",
];

/** An ambushed attacker gives no orders for two phases (ImjinBattle.stepPhase). */
export const AMBUSH_LOCK_ROUNDS = 2 * PHASE_ROUNDS;

/**
 * The tick each battle's orders first reached the client: the engine makes
 * them on the battle's first round, so that tick is round 1. A battle the
 * client joined late counts from when it saw it.
 */
export class ImjinBattleClock {
  private readonly seen = new Map<number, number>();

  note(d: Pick<ImjinData, "orders">, tick: number): void {
    const now = new Set(d.orders.map((o) => o.region));
    for (const r of [...this.seen.keys()]) {
      if (!now.has(r)) this.seen.delete(r);
    }
    for (const r of now) if (!this.seen.has(r)) this.seen.set(r, tick);
  }

  /** The tick of the battle's round 1; undefined: no Imjin battle there. */
  firstRound(region: number): number | undefined {
    return this.seen.get(region);
  }
}

export interface PhaseClock {
  /** The round fought last (1-based). */
  round: number;
  /** The phase (1-based). */
  phase: number;
  /** Ticks until the next phase, when given orders take effect. */
  ticksLeft: number;
  step: BattleStep;
}

/** The battle's phase and the countdown to the next one at `tick`. */
export function phaseClock(
  firstRound: number,
  tick: number,
  broken = false,
): PhaseClock {
  const elapsed = Math.max(0, tick - firstRound);
  const round = Math.floor(elapsed / ROUND_TICKS) + 1;
  const phaseTicks = PHASE_ROUNDS * ROUND_TICKS;
  return {
    round,
    phase: phaseOf(round) + 1,
    ticksLeft: phaseTicks - (elapsed % phaseTicks),
    step: battleStep(round, broken),
  };
}

/** Ticks an ambushed attacker still waits before its orders count (0: free). */
export function ambushLockTicks(
  ambushed: boolean,
  firstRound: number,
  tick: number,
): number {
  if (!ambushed) return 0;
  return Math.max(0, firstRound + AMBUSH_LOCK_ROUNDS * ROUND_TICKS - tick);
}

export interface VolleyLine {
  mode: Exclude<VolleyMode, "none">;
  beat: VolleyBeat;
  /** Massed fire: rounds until the next volley (0: it fires this round). */
  nextFire: number;
}

function volleyLine(
  tag: string,
  order: AttackOrder | DefenceStance,
  round: number,
): VolleyLine | null {
  const mode = volleyModeOf(order, rowMixOf(tag).arquebus ?? 0);
  if (mode === "none") return null;
  const k = (Math.max(1, round) - 1) % MASSED_CYCLE;
  return {
    mode,
    beat: volleyBeat(mode, round),
    nextFire: mode === "massed" && k !== 0 ? MASSED_CYCLE - k : 0,
  };
}

export interface VolleyView {
  /** My side's guns (null: none). */
  mine: VolleyLine | null;
  /** The enemy's: "hidden" unless my scouts or commander read it (design §5). */
  foe: VolleyLine | "hidden" | null;
}

/** Both sides' volley clocks as I may see them this round. */
export function volleyView(
  myTag: string,
  myOrder: AttackOrder | DefenceStance,
  foeTag: string,
  foeOrder: AttackOrder | DefenceStance,
  round: number,
  commanderSkill = 0,
): VolleyView {
  const foe = volleyLine(foeTag, foeOrder, round);
  const scouts = (rowMixOf(myTag).scout ?? 0) > 0;
  return {
    mine: volleyLine(myTag, myOrder, round),
    foe: foe === null || seesRhythm(scouts, commanderSkill) ? foe : "hidden",
  };
}

export interface CrossingView {
  edge: Exclude<ImjinEdge, "none">;
  /** The great river is frozen: it is crossed as a ford. */
  frozen: boolean;
  phases: number;
  /** Crossing phases still ahead (0: across). */
  phasesLeft: number;
  attackerPct: number;
  widthNum: number;
  widthDen: number;
}

/** The attack's river crossing in `month` (1-12), as the engine fights it. */
export function crossingView(
  edgeIndex: number,
  month: number,
  round: number,
): CrossingView | null {
  const edge = IMJIN_EDGE_KINDS[edgeIndex] ?? "none";
  if (edge === "none") return null;
  const frozen = edge === "great_river" && riverFrozen(month);
  const c = crossingOf(edge, riverFrozen(month), true, false);
  if (c.phases === 0) return null;
  return {
    edge,
    frozen,
    phases: c.phases,
    phasesLeft: Math.max(0, c.phases - phaseOf(round)),
    attackerPct: c.attackerPct,
    widthNum: c.widthNum,
    widthDen: c.widthDen,
  };
}

export type SiegeRole = "defender" | "besieger" | "watcher";

export interface SiegePanel {
  region: number;
  grainDays: number;
  fort: number;
  morale: number;
  /** What the besiegers do each day: cannon breach the walls, else they starve them. */
  method: "breach" | "starve";
  /** Days the guns take to cut one wall level (0: no breach). */
  breachEvery: number;
  /** The grain is gone: the garrison loses morale each day. */
  starving: boolean;
  role: SiegeRole;
}

export interface SiegeMap extends ImjinMapLike {
  regionNeighbours(id: number): readonly number[];
  tagOfSmallId(id: number): string | undefined;
}

/** A siege as its panel shows it to `me` (Sieges.siegeDays' rules). */
export function siegePanel(
  s: ImjinData["sieges"][number],
  map: SiegeMap,
  controller: ArrayLike<number>,
  me: number,
  isEnemy: (a: number, b: number) => boolean,
): SiegePanel {
  const owner = controller[s.region] ?? 0;
  let guns = false;
  for (const n of map.regionNeighbours(s.region)) {
    const c = controller[n] ?? 0;
    if (c === 0 || !isEnemy(owner, c)) continue;
    const tag = map.tagOfSmallId(c);
    if (tag !== undefined && (ROW_MIX_OF[tag]?.cannon ?? 0) > 0) guns = true;
  }
  const breachEvery = guns
    ? breachDaysFor(s.fort, terrainRow(regionTerrain(map, s.region)), false)
    : 0;
  return {
    region: s.region,
    grainDays: s.grainDays,
    fort: s.fort,
    morale: s.morale,
    method: breachEvery > 0 ? "breach" : "starve",
    breachEvery,
    starving: s.grainDays <= 0,
    role:
      me !== 0 && me === owner
        ? "defender"
        : me !== 0 && owner !== 0 && isEnemy(owner, me)
          ? "besieger"
          : "watcher",
  };
}

/** The battle order that carries a siege action (storm the walls; the sally). */
export function siegeOrderIndex(action: "assault" | "sortie"): number {
  return action === "assault"
    ? ATTACK_ORDERS.indexOf("storm")
    : DEFENCE_STANCES.indexOf("counter_charge");
}

export interface RoutEvent {
  army: number;
  owner: number;
  /** Where it broke (its region before it ran). */
  region: number;
  /** The other side of the battle there (0: none seen). */
  foe: number;
}

/**
 * Routs (design §5 "A rout shows as tokens running back along their path,
 * with a news line"): an army whose retreat began since the last look. The
 * first look only learns the armies.
 */
export class RoutWatch {
  private readonly last = new Map<number, number>();
  private battles = new Map<number, [number, number]>();
  private started = false;

  update(
    armies: Iterable<ArmySummary>,
    battles: Iterable<BattleSummary>,
  ): RoutEvent[] {
    const out: RoutEvent[] = [];
    const seen = new Set<number>();
    for (const a of armies) {
      seen.add(a.id);
      const now = a.region * 2 + ((a.state & ARMY_RETREAT) !== 0 ? 1 : 0);
      const before = this.last.get(a.id);
      this.last.set(a.id, now);
      if (!this.started || before === undefined) continue;
      if (before % 2 === 1 || now % 2 === 0) continue;
      const region = Math.floor(before / 2);
      const b = this.battles.get(region) ?? this.battles.get(a.region);
      const foe =
        b === undefined
          ? 0
          : b[0] === a.owner
            ? b[1]
            : b[1] === a.owner
              ? b[0]
              : 0;
      out.push({ army: a.id, owner: a.owner, region, foe });
    }
    for (const id of [...this.last.keys()]) {
      if (!seen.has(id)) this.last.delete(id);
    }
    const next = new Map<number, [number, number]>();
    for (const b of battles) next.set(b.region, [b.attacker, b.defender]);
    this.battles = next;
    this.started = true;
    return out;
  }
}
