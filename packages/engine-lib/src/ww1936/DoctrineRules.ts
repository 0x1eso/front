// World War 1936 P6 (P6 spec §3): doctrine mastery, grand doctrines and
// sub-doctrines. Mastery growth, levels, the grand-doctrine table and the
// sum are the foundation's (plan Task 1 Step 6); lane D fills
// SUBDOCTRINE_REWARDS from the spec tables (Task 2).
import {
  DOCTRINE_TRACKS,
  GD_COMPLETE_LEVELS,
  GD_DOMAIN,
  GD_SWITCH_XP,
  GRAND_DOCTRINES,
  GrandDoctrine,
  MASTERY_BASE_DAY_MILLI,
  MASTERY_CAP_DAY_MILLI,
  MASTERY_LEVELS_MILLI,
  MASTERY_MAX_MILLI,
  SUB_SWITCH_XP,
  SUB_TRACK,
  Subdoctrine,
  SUBDOCTRINES,
} from "@openfront/engine-api/ww1936/DepthTypes";
import type {
  BattalionId,
  SupportId,
} from "@openfront/engine-api/ww1936/LandTypes";
import type {
  WwStatKey,
  WwStats,
} from "@openfront/engine-api/ww1936/PoliticsTypes";

export function masteryLevel(milli: number): 0 | 1 | 2 | 3 | 4 | 5 {
  let l = 0;
  while (l < 5 && milli >= MASTERY_LEVELS_MILLI[l]) l++;
  return l as 0 | 1 | 2 | 3 | 4 | 5;
}

/** Spec §3.4: combat share per track that day, micro-mastery (plan decision 12). */
export type TrackTally = readonly [number, number, number];

/** Spec §3.4: today's gain for the domain's three tracks, milli. */
export function masteryGain(
  tally: TrackTally,
  speedPct: number,
): [number, number, number] {
  const g = (t: number) =>
    Math.floor(
      (Math.min(
        MASTERY_CAP_DAY_MILLI,
        MASTERY_BASE_DAY_MILLI + Math.floor(t / 1000),
      ) *
        (100 + speedPct)) /
        100,
    );
  return [g(tally[0]), g(tally[1]), g(tally[2])];
}

export function addMastery(milli: number, gain: number): number {
  return Math.min(MASTERY_MAX_MILLI, Math.max(0, milli + gain));
}

/** Land combat share of one division (spec §3.4 row 1), micro-mastery per track. Weights in half battalions. */
export function landCombatShare(
  infHalf: number,
  armorHalf: number,
  supportHalf: number,
): TrackTally {
  const total = infHalf + armorHalf + supportHalf;
  if (total <= 0) return [0, 0, 0];
  return [
    Math.floor((20_000 * infHalf) / total),
    Math.floor((20_000 * armorHalf) / total),
    Math.floor((20_000 * supportHalf) / total),
  ];
}

/** Spec §3.4 rows 2–3, micro-mastery. */
export const NAVAL_SHARE_MICRO = {
  surfaceBattle: 30_000,
  surfaceMission: 2_000,
  escortBattle: 20_000,
  escortMission: 1_000,
  carrierBattle: 50_000,
  carrierMission: 4_000,
} as const;
export const AIR_SHARE_MICRO_PER_SORTIE = 500;

export interface DoctrineChoice {
  /** GRAND_DOCTRINES index per domain, -1 none. */
  gd: readonly number[];
  /** SUBDOCTRINES index per track (9), -1 none. */
  sub: readonly number[];
}

/** Spec §3.2: base and completion stats of each grand doctrine (the old doctrine techs' tier 1 / tier 2 values). */
export const GRAND_DOCTRINE_STATS: Readonly<
  Record<GrandDoctrine, readonly [Partial<WwStats>, Partial<WwStats>]>
> = {
  gd_mobile: [{ speedPct: 10 }, { mechBreakPct: 20, mechOrg: 5 }],
  gd_firepower: [{ artillerySoftPct: 20 }, { attackPct: 10 }],
  gd_battleplan: [
    { defensePct: 10, planMaxBp: 1_000 },
    { defensePct: 10, planSpeedPct: 50, entrenchMax: 2 },
  ],
  gd_mass: [
    { recruitablePct: 10, infTrainCutPct: 33 },
    { attackPct: 5, defensePct: 5, infOrg: 10 },
  ],
  gd_fleet_in_being: [
    { capitalAttackPct: 10, positioningPct: 5 },
    { screeningPct: 15, navyDefensePct: 10 },
  ],
  gd_trade_interdiction: [
    { subAttackPct: 15, subVisibilityPct: -10, convoyRaidPct: 15 },
    { convoyRaidPct: 15, navalOrg: 10 },
  ],
  gd_base_strike: [
    { carrierStrikePct: 20, carrierDeckPct: 10 },
    { navalStrikePct: 15, carrierCycleCut: 1 },
  ],
  gd_strategic_destruction: [
    { stratBombPct: 15, fighterAttackPct: 5 },
    { stratBombPct: 15, bomberDefensePct: 15 },
  ],
  gd_battlefield_support: [
    { casPct: 15, enemyAirPenaltyPp: 5 },
    { casPct: 15, paradropPrepPct: -50 },
  ],
  gd_operational_integrity: [
    { fighterAgilityPct: 10, airDetectPct: 10 },
    { airLossCutPct: 15, navalStrikePct: 10 },
  ],
};

/** Spec §3.3 L1..L5 of every sub-doctrine (D fills from the spec tables; key choice per Task 2 Step 1). */
export const SUBDOCTRINE_REWARDS: Readonly<
  Record<Subdoctrine, readonly Partial<WwStats>[]>
> = Object.fromEntries(
  SUBDOCTRINES.map((s) => [s, [{}, {}, {}, {}, {}]]),
) as Record<Subdoctrine, Partial<WwStats>[]>;

/** Spec §3.2–§3.3: the doctrine part of a country's stats. `levels`: mastery level per track (9). */
export function doctrineStats(
  choice: DoctrineChoice,
  levels: readonly number[],
): Partial<WwStats> {
  const out: Record<string, number> = {};
  const addIn = (s: Partial<WwStats>) => {
    for (const [k, v] of Object.entries(s)) {
      out[k] = (out[k] ?? 0) + (v as number);
    }
  };
  for (let dom = 0; dom < 3; dom++) {
    const g = choice.gd[dom];
    // Spec §3.2 last bullet: mastery grows but gives nothing without a grand doctrine.
    if (g === undefined || g < 0) continue;
    const [base, complete] = GRAND_DOCTRINE_STATS[GRAND_DOCTRINES[g]];
    addIn(base);
    if (
      levels[dom * 3] + levels[dom * 3 + 1] + levels[dom * 3 + 2] >=
      GD_COMPLETE_LEVELS
    ) {
      addIn(complete);
    }
    for (let t = dom * 3; t < dom * 3 + 3; t++) {
      const s = choice.sub[t];
      if (s === undefined || s < 0) continue;
      const rewards = SUBDOCTRINE_REWARDS[SUBDOCTRINES[s]];
      for (let l = 0; l < levels[t]; l++) addIn(rewards[l]);
    }
  }
  return out as Partial<WwStats>;
}

/** Refusal of doctrine_pick / subdoctrine_pick (plan decision 40). */
export interface DoctrinePickInput {
  domain: number;
  gd: number;
  current: number;
  lockUntil: number;
  day: number;
  /** Whole experience points of the domain. */
  xp: number;
  /** For a sub-doctrine: its track and the track's current pick. */
  track?: number;
  sub?: number;
  currentSub?: number;
}

export function doctrinePickBlock(
  i: DoctrinePickInput,
): "doctrine_locked" | "no_xp" | "bad_index" | null {
  if (i.track !== undefined) {
    if (i.sub === undefined || SUB_TRACK[i.sub] !== i.track) return "bad_index";
    if (i.currentSub === i.sub) return "bad_index";
    if (
      i.currentSub !== undefined &&
      i.currentSub >= 0 &&
      i.lockUntil > i.day
    ) {
      return "doctrine_locked";
    }
    return i.currentSub !== undefined &&
      i.currentSub >= 0 &&
      i.xp < SUB_SWITCH_XP
      ? "no_xp"
      : null;
  }
  if (GD_DOMAIN[i.gd] !== i.domain || i.current === i.gd) return "bad_index";
  if (i.current >= 0 && i.lockUntil > i.day) return "doctrine_locked";
  return i.current >= 0 && i.xp < GD_SWITCH_XP[i.domain] ? "no_xp" : null;
}

export const TRACK_DOMAIN = (t: number) => Math.floor(t / 3);
export { DOCTRINE_TRACKS };

/** Percent changes of one battalion's numbers from the country's stats (plan Task 1 Step 13). */
export interface BattalionStatPct {
  soft: number;
  hard: number;
  def: number;
  brk: number;
  armor: number;
  pierce: number;
  speed: number;
  /** Organisation added, whole points. */
  org: number;
}

const INFANTRY_LIKE: ReadonlySet<string> = new Set([
  "infantry",
  "cavalry",
  "mountain",
  "marine",
  "paratrooper",
  "motorized",
]);
const TANKS: ReadonlySet<string> = new Set([
  "light_armor",
  "medium_armor",
  "heavy_armor",
]);
const AT_LIKE: ReadonlySet<string> = new Set([
  "anti_tank",
  "support_anti_tank",
  "tank_destroyer",
]);
const ART_LIKE: ReadonlySet<string> = new Set([
  "artillery",
  "mot_artillery",
  "support_artillery",
  "sp_artillery",
  "anti_air",
  "support_anti_air",
  "sp_anti_air",
]);

const ZERO_PCT: BattalionStatPct = {
  soft: 0,
  hard: 0,
  def: 0,
  brk: 0,
  armor: 0,
  pierce: 0,
  speed: 0,
  org: 0,
};

/**
 * Plan Task 1 Step 13: the P6 stat keys that change one battalion (or
 * support company) — infantry, armour, anti-tank and artillery families,
 * MIO stat traits. Keys P2 already reads (artillerySoftPct, infOrg,
 * mechBreakPct …) stay where P2 reads them. All zero without P6 stats.
 */
export function battalionStatPct(
  stats: Partial<Record<WwStatKey, number>>,
  bat: BattalionId | SupportId,
): BattalionStatPct {
  const s = (k: WwStatKey) => stats[k] ?? 0;
  if (INFANTRY_LIKE.has(bat)) {
    const mio = s("mioStatPct_infantry");
    return {
      ...ZERO_PCT,
      soft: s("infAttackPct") + mio,
      hard: s("infAttackPct") + mio,
      def: s("infDefensePct") + mio,
      speed: bat === "motorized" ? s("motSpeedPct") : 0,
      org: bat === "motorized" ? s("motOrg") : 0,
    };
  }
  if (TANKS.has(bat)) {
    const mio = s("mioStatPct_armor");
    return {
      ...ZERO_PCT,
      soft: s("armorAttackPct") + mio,
      hard: s("armorAttackPct") + mio,
      brk: s("armorBrkPct") + mio,
      def: s("armorDefensePct"),
      armor: s("armorArmorPct"),
      pierce: s("armorPiercePct"),
    };
  }
  if (AT_LIKE.has(bat)) {
    const mio = bat === "tank_destroyer" ? s("mioStatPct_armor") : 0;
    return {
      ...ZERO_PCT,
      hard: s("atHardPct") + mio,
      pierce: s("atPiercePct") + mio,
    };
  }
  if (ART_LIKE.has(bat)) {
    const mio = s("mioStatPct_artillery");
    return {
      ...ZERO_PCT,
      soft: mio,
      hard: mio,
      speed:
        bat === "mot_artillery" || bat === "sp_artillery"
          ? s("artSpeedPct")
          : 0,
    };
  }
  return ZERO_PCT;
}

/** x × (100 + pct) / 100, rounded down; x itself at 0 (static divisions keep P2's numbers). */
export function pctOf(x: number, pct: number): number {
  return pct === 0 ? x : Math.floor((x * (100 + Math.max(-90, pct))) / 100);
}
