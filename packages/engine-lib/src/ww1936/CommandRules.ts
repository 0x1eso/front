// World War 1936 P6 (P6 spec §4): general and admiral traits, field
// marshals, medals. The tables are the foundation's (plan Task 1 Step 6);
// lane D (Task 2) fills traitAssignBlock and adds the shared judges the
// screens and the engine both call (promoteFmBlock) and the army group
// front split. ww15: traits and the officer corps are no longer bought.
import {
  FM_PROMOTE_PP,
  FM_TRAITS,
  WW_GROUP_ARMIES,
  WW_MAX_FIELD_MARSHALS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { GeneralTrait } from "@openfront/engine-api/ww1936/LandTypes";
import { TRAIT_SLOTS } from "@openfront/engine-api/ww1936/LandTypes";
import {
  AdmiralTrait,
  WW_ADMIRAL_TRAIT_MAX,
} from "@openfront/engine-api/ww1936/NavyTypes";
import type { FrontWorld } from "./FrontRules";
import type { OrderCheckWorld } from "./LandOrderChecks";

/** Spec §4.2 table: the new general traits (ww84: the three terrain ones are gone). */
export interface GeneralTraitDef {
  kind: "assign";
  level: number;
  needs?: GeneralTrait;
  /** Tier (the old command-power value); only 0 (not assignable) matters now. */
  cp: number;
}

export const NEW_GENERAL_TRAITS: Readonly<
  Partial<Record<GeneralTrait, GeneralTraitDef>>
> = {
  infantry_expert: {
    kind: "assign",
    level: 2,
    needs: "infantry_officer",
    cp: 15,
  },
  armor_expert: { kind: "assign", level: 2, needs: "panzer_leader", cp: 20 },
  artillery_officer: { kind: "assign", level: 1, cp: 15 },
  engineer_officer: { kind: "assign", level: 2, cp: 15 },
  trickster: { kind: "assign", level: 3, cp: 20 },
  commando: { kind: "assign", level: 2, cp: 15 },
  guerrilla_fighter: { kind: "assign", level: 2, cp: 15 },
  skirmisher: { kind: "assign", level: 1, cp: 15 },
  ambusher: {
    kind: "assign",
    level: 3,
    needs: "defensive_doctrine",
    cp: 25,
  },
};

// ---- ww15: traits come by themselves (nothing is bought).
/** Free automatic trait: battle days per trait already held, plus one (generals); usage days likewise (admirals). */
export const AUTO_TRAIT_BATTLE_DAYS = 20;
export const AUTO_ADMIRAL_DAYS = 20;
/** Automatic medals: days between awards, and the most held at once. */
export const MEDAL_AUTO_EVERY_DAYS = 30;
export const MEDAL_MAX_ACTIVE = 6;
const FM_EXTRA_TRAIT_CP = 20;
export const FM_TRAIT_LEVELS: readonly number[] = [3, 5];
const ADMIRAL_ASSIGN_CP = 15;
export const ADMIRAL_ASSIGN_LEVEL = 2;

export function traitSlots(level: number): number {
  return TRAIT_SLOTS[Math.max(1, Math.min(5, level))];
}

/** Spec §4.3: field marshals a country may have. */
export function fieldMarshalCap(divisions: number): number {
  return Math.min(WW_MAX_FIELD_MARSHALS, 1 + Math.floor(divisions / 72));
}

/** Spec §4.3 / plan decision 14: a field marshal's share in bp of a division modifier. */
export function fieldMarshalBp(
  att: number,
  dfn: number,
): { attackBp: number; defenseBp: number } {
  return { attackBp: att * 250, defenseBp: dfn * 250 };
}

export interface FmTraitStats {
  attackBp?: number;
  defenseBp?: number;
  planSpeedPct?: number;
  planMaxBp?: number;
  entrenchSpeedPct?: number;
  supplyUsePct?: number;
  recoveryPct?: number;
  org?: number;
  groupArmies?: number;
}

/** Spec §4.2 FM traits (whole army group). planMaxBp etc. use the P2 stat names. */
export const FM_TRAIT_STATS: Readonly<
  Record<(typeof FM_TRAITS)[number], FmTraitStats>
> = {
  fm_offensive: { attackBp: 500, planSpeedPct: 10 },
  fm_defensive: { defenseBp: 500, entrenchSpeedPct: 25 },
  fm_logistics: { supplyUsePct: -10 },
  fm_thorough: { planMaxBp: 1_000 },
  fm_fast_planner: { planSpeedPct: 20 },
  fm_inspiring: { recoveryPct: 10, org: 3 },
  fm_strategist: { attackBp: 300, defenseBp: 300, groupArmies: 1 },
};

export interface TraitAssignInput {
  admiral: boolean;
  level: number;
  traits: readonly string[];
  slots: number;
  trait: string;
  isFm: boolean;
  fmTraits: readonly string[];
}

/** Spec §4.2: the assignable admiral traits (P4's six come from data). */
export const ASSIGNABLE_ADMIRAL_TRAITS: readonly AdmiralTrait[] = [
  "night_fighter",
  "convoy_master",
  "fleet_tactician",
  "blockade_runner",
];

/** Spec §4.2: field marshal traits a marshal may hold — one at promotion, one more at levels 3 and 5. */
export function fmTraitAllowance(level: number): number {
  return 1 + FM_TRAIT_LEVELS.filter((l) => level >= l).length;
}

/** The tier of a trait that an officer can take (the old command-power value); 0: not an assignable trait. */
export function traitCost(trait: string, admiral: boolean): number {
  if (admiral) {
    return (ASSIGNABLE_ADMIRAL_TRAITS as readonly string[]).includes(trait)
      ? ADMIRAL_ASSIGN_CP
      : 0;
  }
  if ((FM_TRAITS as readonly string[]).includes(trait)) {
    return FM_EXTRA_TRAIT_CP;
  }
  const def = NEW_GENERAL_TRAITS[trait as GeneralTrait];
  return def?.kind === "assign" ? def.cp : 0;
}

/**
 * Refusal of trait_assign (plan decision 40, spec §4.2). A general's trait:
 * an assigned one of NEW_GENERAL_TRAITS, its level and prerequisite, a free
 * slot (every trait held counts, traitSlots); never a field marshal (his
 * general traits would lead no army). A field marshal's: one more at
 * levels 3 and 5 (fmTraitAllowance). An admiral's: one of the four, level
 * 2, at most WW_ADMIRAL_TRAIT_MAX held. The automatic traits ask it which
 * traits are open (nothing is bought any more).
 */
export function traitAssignBlock(
  i: TraitAssignInput,
): "trait_unavailable" | null {
  if (i.traits.includes(i.trait) || i.fmTraits.includes(i.trait)) {
    return "trait_unavailable";
  }
  const cp = traitCost(i.trait, i.admiral);
  if (cp === 0) return "trait_unavailable";
  if (i.admiral) {
    if (
      i.level < ADMIRAL_ASSIGN_LEVEL ||
      i.traits.length >= WW_ADMIRAL_TRAIT_MAX
    ) {
      return "trait_unavailable";
    }
  } else if ((FM_TRAITS as readonly string[]).includes(i.trait)) {
    if (!i.isFm || i.fmTraits.length >= fmTraitAllowance(i.level)) {
      return "trait_unavailable";
    }
  } else {
    const def = NEW_GENERAL_TRAITS[i.trait as GeneralTrait]!;
    if (
      i.isFm ||
      i.level < def.level ||
      (def.needs !== undefined && !i.traits.includes(def.needs)) ||
      i.traits.length >= i.slots
    ) {
      return "trait_unavailable";
    }
  }
  return null;
}

/** Spec §4.3: a general a field marshal may be made of — level 3, or skills summing to 12, or a K5 marshal row. */
export function fmEligible(
  level: number,
  skillSum: number,
  listed: boolean,
): boolean {
  return listed || level >= 3 || skillSum >= 12;
}

export interface PromoteInput {
  /** Already a field marshal. */
  isFm: boolean;
  /** Serves today (roster dates, purges, advisors). */
  serves: boolean;
  level: number;
  skillSum: number;
  /** A START_FIELD_MARSHALS row names him now. */
  listed: boolean;
  fieldMarshals: number;
  divisions: number;
  /** Whole political power. */
  pp: number;
}

/** Refusal of promote_fm (spec §4.3): who, the marshal cap, the condition and 25 PP (no command power since ww9). */
export function promoteFmBlock(
  i: PromoteInput,
): "general_unavailable" | "fm_limit" | "trait_unavailable" | "no_pp" | null {
  if (i.isFm || !i.serves) return "general_unavailable";
  if (i.fieldMarshals >= fieldMarshalCap(i.divisions)) return "fm_limit";
  if (!fmEligible(i.level, i.skillSum, i.listed)) return "trait_unavailable";
  return i.pp < FM_PROMOTE_PP ? "no_pp" : null;
}

/** Spec §4.3: the armies an army group may hold (fm_strategist +1). */
export function groupArmyCap(fmTraits: number): number {
  let n = WW_GROUP_ARMIES;
  for (let b = 0; b < FM_TRAITS.length; b++) {
    if ((fmTraits & (1 << b)) !== 0) {
      n += FM_TRAIT_STATS[FM_TRAITS[b]].groupArmies ?? 0;
    }
  }
  return n;
}

/** The non-combat FM_TRAIT_STATS of a trait mask, summed (attack and defence: CombatRules.fmTraitBp). */
export function fmArmyStats(
  fmTraits: number,
): Required<Omit<FmTraitStats, "attackBp" | "defenseBp" | "groupArmies">> {
  const out = {
    planSpeedPct: 0,
    planMaxBp: 0,
    entrenchSpeedPct: 0,
    supplyUsePct: 0,
    recoveryPct: 0,
    org: 0,
  };
  for (let b = 0; b < FM_TRAITS.length; b++) {
    if ((fmTraits & (1 << b)) === 0) continue;
    const s = FM_TRAIT_STATS[FM_TRAITS[b]];
    out.planSpeedPct += s.planSpeedPct ?? 0;
    out.planMaxBp += s.planMaxBp ?? 0;
    out.entrenchSpeedPct += s.entrenchSpeedPct ?? 0;
    out.supplyUsePct += s.supplyUsePct ?? 0;
    out.recoveryPct += s.recoveryPct ?? 0;
    out.org += s.org ?? 0;
  }
  return out;
}

/**
 * Spec §4.3 ag_front (deterministic): the front regions in the order given
 * (ww7: along the border, FrontRules.borderChain — not by id), cut from the
 * front into one stretch per army — army i (in the group's army order)
 * gets floor(n × div_i / Σdiv) regions, the remainder one each from the
 * first army on. Every stretch is a run of the chain. An army may get an
 * empty stretch.
 */
export function splitFront(
  front: readonly number[],
  divisions: readonly number[],
): number[][] {
  const regions = [...new Set(front)];
  const n = regions.length;
  const k = divisions.length;
  if (k === 0) return [];
  const total = divisions.reduce((a, b) => a + Math.max(0, b), 0);
  const share = divisions.map((x) =>
    total <= 0 ? 0 : Math.floor((n * Math.max(0, x)) / total),
  );
  let rest = n - share.reduce((a, b) => a + b, 0);
  for (let i = 0; rest > 0; i = (i + 1) % k, rest--) share[i]++;
  const out: number[][] = [];
  let at = 0;
  for (const s of share) {
    out.push(regions.slice(at, at + s));
    at += s;
  }
  return out;
}

/**
 * ww162 §1.4: why divisions standing in `from` cannot be pinned to `region`
 * now. A region of our side must be reached from each of them over our
 * side's land (no_path). An enemy region must be one we are at war with
 * (not_at_war), next to a region
 * of ours (not_adjacent), and that region reached from each of them over
 * our land (no_path): they walk there and attack. Null when they may go.
 */
export function divisionMoveBlock(
  w: OrderCheckWorld,
  from: readonly number[],
  region: number,
): WwOrderBlock | null {
  const sc = w.scenario;
  if (sc.region(region) === undefined) return "bad_region";
  const ours = (r: number) => w.sameSide(w.me, w.controller[r]);
  let goals: number[];
  if (ours(region)) {
    goals = [region];
  } else {
    const c = w.controller[region];
    if (!w.isEnemy(w.me, c)) return "not_at_war";
    goals = sc
      .edgesOf(region)
      .map((e) => e.to)
      .filter(ours);
    if (goals.length === 0) return "not_adjacent";
  }
  const want = new Set(goals);
  for (const start of new Set(from)) {
    if (!reaches(w, start, want, ours)) return "no_path";
  }
  return null;
}

/** Whether a region of `goals` is reached from `start` (always a source) over regions `pass` accepts. */
function reaches(
  w: Pick<FrontWorld, "scenario">,
  start: number,
  goals: ReadonlySet<number>,
  pass: (region: number) => boolean,
): boolean {
  if (goals.has(start)) return true;
  const seen = new Set<number>([start]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    for (const e of w.scenario.edgesOf(queue[i])) {
      if (seen.has(e.to) || !pass(e.to)) continue;
      if (goals.has(e.to)) return true;
      seen.add(e.to);
      queue.push(e.to);
    }
  }
  return false;
}

/**
 * ww162 §1.2 group_goal with `split` (Design A §1.4): each region of the
 * offensive line goes to the army whose sector is nearest it, in edges over
 * any land (a multi-source BFS from each sector; ties: the earlier army).
 * Each army's share keeps the line's order. An army with an empty sector
 * gets nothing; with no sector reaching a region, it goes to the first
 * army that has a sector (or the first army).
 */
export function splitGoal(
  w: Pick<FrontWorld, "scenario">,
  goal: readonly number[],
  sectors: readonly (readonly number[])[],
): number[][] {
  const out = sectors.map((): number[] => []);
  if (sectors.length === 0) return out;
  const dists = sectors.map((s) => landDistances(w, s));
  const first = Math.max(
    0,
    sectors.findIndex((s) => s.length > 0),
  );
  for (const r of goal) {
    let best = -1;
    let bestD = Infinity;
    dists.forEach((d, i) => {
      const x = d.get(r);
      if (x !== undefined && x < bestD) {
        best = i;
        bestD = x;
      }
    });
    out[best < 0 ? first : best].push(r);
  }
  return out;
}

/** Edges from `from` to every land region (BFS over the scenario's land edges). */
function landDistances(
  w: Pick<FrontWorld, "scenario">,
  from: readonly number[],
): Map<number, number> {
  const dist = new Map<number, number>();
  const queue: number[] = [];
  for (const r of [...from].sort((a, b) => a - b)) {
    if (dist.has(r)) continue;
    dist.set(r, 0);
    queue.push(r);
  }
  for (let i = 0; i < queue.length; i++) {
    const u = queue[i];
    for (const e of w.scenario.edgesOf(u)) {
      if (dist.has(e.to)) continue;
      dist.set(e.to, dist.get(u)! + 1);
      queue.push(e.to);
    }
  }
  return dist;
}

/** ww162 §1.1: a sector's front-line ends (its first and last region); null when empty. */
export function sectorEnds(part: readonly number[]): [number, number] | null {
  return part.length === 0 ? null : [part[0], part[part.length - 1]];
}

export const MEDAL_STATS = {
  medal_valor: { attackBp: 300 },
  medal_defense: { defenseBp: 300 },
  medal_service: { recoveryPct: 10 },
} as const;

/**
 * Spec §4.2 (plan Task 1 Step 15): the four P6 admiral traits as P4
 * admiral modifiers, percent. torpedoPct: torpedo attack; escortPct: convoy
 * escort; positioningPct: positioning; raidLossPct: convoy-raid losses
 * taken; visibilityPct: the fleet's visibility.
 */
export interface AdmiralTraitStats {
  torpedoPct?: number;
  escortPct?: number;
  positioningPct?: number;
  raidLossPct?: number;
  visibilityPct?: number;
}
export const ADMIRAL_TRAIT_STATS: Readonly<
  Partial<Record<AdmiralTrait, AdmiralTraitStats>>
> = {
  night_fighter: { torpedoPct: 15 },
  convoy_master: { escortPct: 20 },
  fleet_tactician: { positioningPct: 10 },
  blockade_runner: { raidLossPct: -15, visibilityPct: -10 },
};
