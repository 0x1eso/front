// World War 1936 P6 (P6 spec §3): doctrine mastery, grand doctrines and
// sub-doctrines. Mastery growth, levels, the grand-doctrine table and the
// sum are the foundation's (plan Task 1 Step 6); lane D fills
// SUBDOCTRINE_REWARDS from the spec tables (Task 2).
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type { StartDoctrineDef } from "@openfront/engine-api/ww1936/DepthTypes";
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
import type { WwTechId } from "@openfront/engine-api/ww1936/EconomyTypes";
import type {
  BattalionId,
  SupportId,
} from "@openfront/engine-api/ww1936/LandTypes";
import type {
  WwStatKey,
  WwStats,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { idHash, wwRoll } from "./Roll";
import { retiredTechEffects } from "./WwTechs";

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

/**
 * Spec §3.2: base and completion stats of each grand doctrine — the old
 * doctrine techs' tier 1 / tier 2 effects on the very keys the P2–P4
 * readers read (pre-flight §0-5; review L1: built from the retired techs,
 * one source). `gd_<school>` carries `<school>_1` and `<school>_2`.
 */
export const GRAND_DOCTRINE_STATS: Readonly<
  Record<GrandDoctrine, readonly [Partial<WwStats>, Partial<WwStats>]>
> = Object.fromEntries(
  GRAND_DOCTRINES.map((g) => {
    const school = g.slice("gd_".length);
    return [
      g,
      [
        retiredTechEffects(`${school}_1` as WwTechId) as Partial<WwStats>,
        retiredTechEffects(`${school}_2` as WwTechId) as Partial<WwStats>,
      ],
    ];
  }),
) as unknown as Record<
  GrandDoctrine,
  readonly [Partial<WwStats>, Partial<WwStats>]
>;

/**
 * Spec §3.3 L1..L5 of every sub-doctrine (rewards pile up: level 3 has
 * L1–L3). Keys per plan Task 2 Step 1, on the names the P2–P4 readers read;
 * the "(approx)" rows are recorded in lane D's report (the closest key a
 * reader has, e.g. "infantry division breakthrough" on every division's).
 * Omitted (no key): nav_cruiser L5 range +20% (its torpedoes ride on the
 * light-gun key) and nav_carrier_support L3 (carrier fighters × 1.5 in the
 * sea zone's superiority).
 */
export const SUBDOCTRINE_REWARDS: Readonly<
  Record<Subdoctrine, readonly Partial<WwStats>[]>
> = {
  // ---- Land: infantry ----
  inf_elastic: [
    { infDefensePct: 5 },
    { entrenchMax: 1 },
    { infDefensePct: 5 },
    { recoveryPct: 10 },
    { infDefensePct: 10, entrenchSpeedPct: 50 },
  ],
  inf_assault: [
    { infAttackPct: 5 },
    { riverPenaltyCutPct: 25 },
    { infAttackPct: 5 },
    // (approx) infantry divisions' breakthrough: every division's.
    { breakthroughPct: 10 },
    { infAttackPct: 10, fortPenaltyCutPct: 25 },
  ],
  inf_mass_mob: [
    { infTrainCutPct: 10 },
    { recruitablePct: 5 },
    { reinforcePct: 25 },
    { infOrg: 5 },
    // (approx) "infantry equipment needed −10%": supply use −10%.
    { manpowerGrowthPct: 10, supplyUsePct: -10 },
  ],
  // ---- Land: armour ----
  arm_breakthrough: [
    { armorBrkPct: 5 },
    // (approx) armoured divisions' speed: the motorized battalions'.
    { motSpeedPct: 5 },
    { armorBrkPct: 10 },
    { mechOrg: 5 },
    { armorAttackPct: 10, fuelUsePct: -10 },
  ],
  arm_inf_support: [
    { armorDefensePct: 10 },
    // (approx) "infantry divisions with 1–2 tanks attack +5%": infantry battalions'.
    { infAttackPct: 5 },
    { armorRelPp: 5 },
    { armorArmorPct: 5 },
    // (approx) "mixed infantry–tank divisions defence +10%": infantry battalions'.
    { infDefensePct: 10 },
  ],
  arm_mech: [
    { motSpeedPct: 5 },
    { motOrg: 5 },
    // (approx) armoured divisions' supply use: every division's.
    { supplyUsePct: -10 },
    // (approx) motorized battalions' attack: the infantry family's key.
    { infAttackPct: 10 },
    // (approx) armour and motor divisions' readiness speed: every army's;
    // their breakthrough is P2's mechBreakPct (armour and motor only).
    { planSpeedPct: 25, mechBreakPct: 5 },
  ],
  // ---- Land: support ----
  sup_artillery: [
    { artillerySoftPct: 5 },
    { artillerySoftPct: 5 },
    // (approx) support artillery's soft attack: every artillery's.
    { artillerySoftPct: 10 },
    { fortPenaltyCutPct: 15 },
    { artillerySoftPct: 10, atHardPct: 10 },
  ],
  sup_deep_ops: [
    { planSpeedPct: 10 },
    { planMaxBp: 500 },
    // (approx) attack +5% with a bold stance: every attack.
    { attackPct: 5 },
    { breakthroughPct: 5 },
    { advanceSpeedPct: 15 },
  ],
  sup_entrenched: [
    { entrenchMax: 1 },
    { engineerMulPct: 50 },
    { defensePct: 5 },
    { fortDefPerLevelBp: 300 },
    { entrenchMax: 1, defensePct: 5 },
  ],
  // ---- Naval: surface ----
  nav_battleline: [
    { capitalAttackPct: 5 },
    { positioningPct: 5 },
    // (approx) capital ships' armour: the fleet's defence.
    { navyDefensePct: 5 },
    { capitalAttackPct: 5 },
    { capitalHpPct: 10, navalDamageTakenPct: -10 },
  ],
  nav_cruiser: [
    { screenAttackPct: 10 },
    // (approx) cruisers +1 knot: the navy's speed +3% (1 of ~32 knots).
    { navalSpeedPct: 3 },
    { surfaceRaidPct: 10 },
    // (approx) cruisers' detection: the fleet's.
    { navalDetectPct: 10 },
    // (approx) light guns and torpedoes +10%: the light-gun key.
    { screenAttackPct: 10 },
  ],
  // ---- Naval: escort ----
  nav_wolfpack: [
    { subTorpedoPct: 5 },
    { subVisibilityPct: -5 },
    { convoyRaidPct: 10 },
    { subOrg: 10 },
    { subTorpedoPct: 10, subVisibilityPct: -10 },
  ],
  nav_convoy_escort: [
    { depthChargePct: 10 },
    { convoyEscortPct: 10 },
    // (approx) anti-submarine detection: the fleet's.
    { navalDetectPct: 10 },
    { convoyLossPct: -10 },
    { depthChargePct: 15, convoyEscortPct: 15 },
  ],
  // ---- Naval: carrier ----
  nav_carrier_force: [
    { carrierStrikePct: 5 },
    { deckPct: 5 },
    { navalStrikePct: 10 },
    { carrierRoundsCut: 1 },
    // (approx) carrier fighters' air attack: every fighter's.
    { carrierStrikePct: 10, fighterAttackPct: 10 },
  ],
  nav_carrier_support: [
    { aaPct: 10 },
    { navalDetectPct: 10 },
    // Carrier fighters × 1.5 in the sea zone's superiority: no key.
    {},
    { shoreBombardPct: 15 },
    // (approx) carriers' HP: the fleet's defence.
    { navyDefensePct: 10, airLossCutPct: 15 },
  ],
  // ---- Air: fighters ----
  air_interceptor: [
    // (approx) interception's air attack: every fighter's.
    { fighterAttackPct: 5 },
    { airDetectPct: 5 },
    { interceptShareBp: 2500 },
    { airDefensePct: 10 },
    // (approx) radar detection +50‰ as air detection +5%.
    { fighterAttackPct: 10, airDetectPct: 5 },
  ],
  air_escort: [
    { fighterAttackPct: 5 },
    { fighterAgilityPct: 5 },
    // (approx) the zone's bomber losses: air losses.
    { airLossCutPct: 10 },
    // (approx) heavy fighters' air attack: every plane's.
    { airAttackPct: 10 },
    { fighterAttackPct: 10, airRangePct: 15 },
  ],
  // ---- Air: bombers ----
  air_strategic_campaign: [
    { stratBombPct: 5 },
    { heavyDefensePct: 5 },
    { nightBombBp: 1500 },
    { stratBombPct: 10 },
    // (approx) bombing fatigue × 1.5 as strategic bombing +10%, plus its +10%.
    { stratBombPct: 20 },
  ],
  air_ground_attack: [
    { casPct: 5 },
    // (approx) close air support's AA losses: air losses.
    { airLossCutPct: 10 },
    { casPct: 10 },
    // (approx) tactical bombers' ground attack: close air support's.
    { casPct: 10 },
    { casPct: 10, supPenaltyPp: 5 },
  ],
  // ---- Air: naval air ----
  air_maritime_strike: [
    { navalStrikePct: 5 },
    // (approx) port strikes: naval strike.
    { navalStrikePct: 10 },
    { navalStrikePct: 10 },
    // (approx) naval bombers' air defence: the heavy planes'.
    { heavyDefensePct: 10 },
    // (approx) port-strike hits +20‰ as naval strike +2%, plus its +10%.
    { navalStrikePct: 12 },
  ],
  air_maritime_patrol: [
    { navalPatrolPct: 10 },
    { convoyEscortPct: 10 },
    { navalPatrolPct: 15 },
    { convoyLossPct: -5 },
    { navalPatrolPct: 15, navalDetectPct: 10 },
  ],
};

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

// ---- Start doctrines (spec §3.5, §19.2; pre-flight §0-9; review E3) ----

/** The AI start pick's roll purpose. */
export const P_START_DOCTRINE = idHash("start_doctrine");
/** Chance an AI picks another grand doctrine of the domain than its row's, percent (games differ). */
export const START_DOCTRINE_DEVIATION_PCT = 25;
/** Spec §3.5 "그 밖" when the content has no personality row. */
export const PERSONALITY_START_GD: Readonly<
  Record<
    "aggressor" | "democracy" | "minor",
    readonly [GrandDoctrine, null, GrandDoctrine]
  >
> = {
  aggressor: ["gd_mobile", null, "gd_battlefield_support"],
  democracy: ["gd_battleplan", null, "gd_battlefield_support"],
  minor: ["gd_mass", null, "gd_battlefield_support"],
};

export interface StartDoctrineInput {
  /** K5's START_DOCTRINES (majors, then the "@aggressor" / "@democracy" / "@minor" rows). */
  table: readonly StartDoctrineDef[];
  tag: CountryTag;
  personality: "aggressor" | "democracy" | "minor";
  /** The lobby's historical AI: the country's own row; else its personality's. */
  historical: boolean;
  /** Coastal with ≥ 3 dockyards: a personality row takes trade interdiction at sea, else none. */
  navy: boolean;
  seed: number;
  id: number;
  /** Default START_DOCTRINE_DEVIATION_PCT (tests: 0 for the row itself). */
  deviationPct?: number;
}

/**
 * Spec §3.5 / §19.2: an AI country's day-0 doctrines — its row (historical
 * AI) or its personality's (the naval rule applies), then per domain a
 * seeded START_DOCTRINE_DEVIATION_PCT chance of another grand doctrine of
 * that domain (sub-doctrines kept).
 */
export function startDoctrinePick(i: StartDoctrineInput): {
  gd: (GrandDoctrine | null)[];
  sub: (Subdoctrine | null)[];
} {
  const own = i.historical ? i.table.find((r) => r.tag === i.tag) : undefined;
  const pRow = i.table.find((r) => r.tag === `@${i.personality}`);
  let gd: (GrandDoctrine | null)[];
  let sub: (Subdoctrine | null)[];
  if (own !== undefined) {
    gd = [...own.gd];
    sub = [...own.sub];
  } else {
    gd = [...(pRow?.gd ?? PERSONALITY_START_GD[i.personality])];
    sub = [...(pRow?.sub ?? [])];
    gd[1] = i.navy ? "gd_trade_interdiction" : null;
  }
  for (let dom = 0; dom < 3; dom++) {
    const g = gd[dom];
    if (g === null) continue;
    if (
      wwRoll(i.seed, P_START_DOCTRINE, i.id, dom) % 100 >=
      (i.deviationPct ?? START_DOCTRINE_DEVIATION_PCT)
    ) {
      continue;
    }
    const others = GRAND_DOCTRINES.filter(
      (x, k) => GD_DOMAIN[k] === dom && x !== g,
    );
    gd[dom] =
      others[wwRoll(i.seed, P_START_DOCTRINE, i.id, dom + 3) % others.length];
  }
  return { gd, sub };
}
