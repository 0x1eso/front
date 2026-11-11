// ww177 P7b (doctrine, /home/eser/dev/ww177-doctrine.md §1-§6): each
// country fights the way it really fought. Divisions carry no unit rows, so
// doctrine lives per country and changes by state: Joseon's 제승방략 army,
// its captured arquebuses and the 훈련도감's 삼수병; Japan's guns after it
// met Ming's; Ming's guns, shields and mandarin duck squads. Pure integer
// code; the engine glue (ImjinBattle, Sieges) builds the state.
import {
  aiAttackOrder,
  aiDefenceStance,
  type AiOrderCtx,
  type RowMix,
  rowMixOf,
} from "./LandRound";
import {
  type AttackOrder,
  COUNTER_OF_ORDER,
  type DefenceStance,
  orderCountered,
  terrainRow,
} from "./LandRules";
import type { ImjinTerrain } from "./Terrain";

/** The flags the doctrine reads and the engine or a decision sets. */
export const DOCTRINE_FLAGS = {
  /** JOS: an army of 2 or more divisions routed (진관 can be restored). */
  josRouted: "imjin_jos_routed",
  /** JOS: 진관 restored (decision): the muster penalty lifts, garrisons hold at home. */
  josJingwan: "imjin_jos_jingwan",
  /** JOS: Ming's drill instructors are in the country (the 훈련도감 can be founded). */
  josDrill: "imjin_jos_drill",
  /** JOS: the 훈련도감 founded (decision); its day is the flag's day. */
  josHullyeon: "imjin_jos_hullyeon",
  /** JOS: 청야입보 (decision, 120 days). */
  josCheongya: "imjin_jos_cheongya",
  /** JPN: Japan has lost a region it held (the wajō can be built). */
  jpnLostRegion: "imjin_jpn_lost_region",
  /** JPN: the wajō (decision); its day is the flag's day. */
  jpnWaeseong: "imjin_jpn_waeseong",
  /** Global: Japan lost 40 ships in 30 days and keeps to its harbours. */
  jpnSeaCaution: "imjin_jpn_sea_caution",
} as const;

/** What the doctrine reads of the game (all already in the hashed state). */
export interface DoctrineState {
  /** Japanese divisions Joseon has routed (each leaves arquebuses behind). */
  josArqPts: number;
  /** Days since the 훈련도감 was founded (-1: not). */
  hullyeonDays: number;
  /** 진관 restored. */
  jingwan: boolean;
  /** Japan has lost a battle to Ming, or invades a second time. */
  jpnLearned: boolean;
  /** Ming's relief army is in Korea (the southern troops). */
  mingRelief: boolean;
}

export const NO_DOCTRINE: DoctrineState = {
  josArqPts: 0,
  hullyeonDays: -1,
  jingwan: false,
  jpnLearned: false,
  mingRelief: false,
};

/** Captured arquebuses Joseon needs before its own gunners show (§4 stage B). */
export const JOS_ARQ_POINTS = 6;
/** Days after the 훈련도감's founding that its first and its full drill take. */
export const HULLYEON_FIRST_DAYS = 180;
export const HULLYEON_FULL_DAYS = 360;

/** Each country's army by its doctrine's state (§2, §4, §6). */
export function rowMixFor(tag: string, d: DoctrineState): RowMix {
  if (tag === "JOS") {
    if (d.hullyeonDays >= HULLYEON_FULL_DAYS)
      return {
        arquebus: 30,
        archer: 25,
        spear: 25,
        cavalry: 10,
        cannon: 5,
        hwacha: 5,
      };
    if (d.hullyeonDays >= HULLYEON_FIRST_DAYS)
      return {
        arquebus: 25,
        archer: 30,
        spear: 25,
        cavalry: 10,
        cannon: 5,
        hwacha: 5,
      };
    if (d.josArqPts >= JOS_ARQ_POINTS)
      return {
        arquebus: 5,
        spear: 20,
        archer: 40,
        cavalry: 20,
        cannon: 10,
        hwacha: 5,
      };
  }
  if (tag === "JPN" && d.jpnLearned)
    return { spear: 35, arquebus: 35, samurai: 20, archer: 5, cavalry: 5 };
  return rowMixOf(tag);
}

/** Integer switches the battle round reads (§2, §4, §6). */
export interface DoctrinePerks {
  /** Ladders under covering fire: +25 at a fort ≤ 2 with 3× the garrison. */
  escalade: boolean;
  /** Storms by moonlight (lunar days 13-17): the defender's missiles −30. */
  nightStorm: boolean;
  /** At a fort the hwacha fires in the first round of every phase (Haengju). */
  hwachaReload: boolean;
  /** The bigyeokjincheonroe: a barrage costs the garrison 100 morale a phase. */
  bigyeok: boolean;
  /** The heavy guns breach twice as fast and blow the gates on a storm. */
  bigGuns: boolean;
  /** Arquebus fire against this side ×85 (the iron shields). */
  ironShields: boolean;
  /** The enemy's samurai shock halves (the mandarin duck squads; the 살수). */
  halvesShock: boolean;
  /** Spearmen count against a charge whatever their share (the 살수 guard the guns). */
  spearGuard: boolean;
}

export const NO_PERKS: DoctrinePerks = {
  escalade: false,
  nightStorm: false,
  hwachaReload: false,
  bigyeok: false,
  bigGuns: false,
  ironShields: false,
  halvesShock: false,
  spearGuard: false,
};

/**
 * A country's perks in this state. `bigyeok` comes from the battle (a
 * Joseon siege of 10 days or more there), so the glue sets it.
 */
export function perksOf(tag: string, d: DoctrineState): DoctrinePerks {
  const stageC = d.hullyeonDays >= HULLYEON_FIRST_DAYS;
  switch (tag) {
    case "JPN":
      return { ...NO_PERKS, escalade: true, nightStorm: true };
    case "JOS":
      return {
        ...NO_PERKS,
        hwachaReload: true,
        halvesShock: stageC,
        spearGuard: stageC,
      };
    case "MIN":
      return {
        ...NO_PERKS,
        escalade: true,
        bigGuns: true,
        ironShields: true,
        halvesShock: d.mingRelief,
      };
    default:
      return NO_PERKS;
  }
}

/** Joseon's new divisions start at this share of their organisation until 진관 (§4 stage A). */
export const MUSTER_ORG_PCT = 50;
/** Joseon's garrisons at home under 진관: + to their block. */
export const JINGWAN_HOME_BLOCK_PCT = 20;
/** Days a Joseon siege must have run before the bigyeok is brought up. */
export const BIGYEOK_SIEGE_DAYS = 10;
/** The bigyeok's morale a siege day and a barrage phase. */
export const BIGYEOK_SIEGE_MORALE = 40;

/** What the AI reads beyond AiOrderCtx (§2, §4, §6 "AI"). */
export interface DoctrineCtx extends AiOrderCtx {
  /** The battle's phase, from 1. */
  phase?: number;
  /** Its side's strength over the other's, %. */
  ratioPct?: number;
  /** The enemy's tag. */
  enemy?: string;
}

const HIDING: ReadonlySet<ImjinTerrain> = new Set([
  "pass",
  "forest",
  "mountain",
  "hills",
]);

function pick<T>(
  opts: readonly T[],
  roll: number,
  countered: (o: T) => boolean,
): T {
  const ok = opts.filter((o) => !countered(o));
  const list = ok.length > 0 ? ok : opts;
  return list[roll % list.length];
}

/**
 * The AI's attack order by its country's doctrine:
 * - Japan: at walls only the ladders; on open or dry ground volley
 *   advances and flanks (the Chungju arc); its 5 % horse never charges.
 * - Joseon: the guns and bows' barrage at walls; on open ground it
 *   advances or flanks, and charges only at the gap with a commander who
 *   reads the reload.
 * - Ming: two phases of guns at walls, then the storm; it charges in the open.
 * Others keep the shared AI.
 */
export function doctrineAttackOrder(
  tag: string,
  mix: RowMix,
  terrain: ImjinTerrain,
  fort: number,
  lastStance: DefenceStance | null,
  roll: number,
  ctx: DoctrineCtx = {},
): AttackOrder {
  const countered = (o: AttackOrder) =>
    lastStance !== null && orderCountered(o, lastStance);
  const t = terrainRow(terrain);
  const arq = mix.arquebus ?? 0;
  const guns = mix.cannon ?? 0;
  const bows = mix.archer ?? 0;
  const opts: AttackOrder[] = [];
  switch (tag) {
    case "JPN":
      if (fort > 0) return "storm";
      opts.push("advance", "flank", "flank");
      if (arq >= 30) opts.push("volley_advance", "volley_advance");
      if (lastStance === "counter_charge") opts.push("feigned_retreat");
      return pick(opts, roll, countered);
    case "JOS":
      if (fort > 0) {
        if (guns + bows >= 30) opts.push("barrage", "barrage");
        opts.push("storm");
        return pick(opts, roll, countered);
      }
      opts.push("advance", "flank");
      if (arq >= 30) opts.push("volley_advance");
      if (guns + bows >= 30) opts.push("barrage");
      if (
        (mix.cavalry ?? 0) >= 20 &&
        t.charge &&
        lastStance === "massed_volley" &&
        ctx.seesRhythm === true
      )
        opts.push("charge_gap", "charge_gap");
      return pick(opts, roll, countered);
    case "MIN":
      if (fort > 0) {
        if (guns >= 10 && (ctx.phase ?? 1) <= 2) return "barrage";
        return "storm";
      }
      if ((mix.cavalry ?? 0) >= 20 && t.charge && t.cavalryPct >= 0) {
        if (lastStance === "massed_volley") {
          if (ctx.seesRhythm === true) opts.push("charge_gap", "charge_gap");
          opts.push("barrage");
        } else opts.push("charge", "charge");
        if (lastStance === "counter_charge") opts.push("feigned_retreat");
      }
      opts.push("advance");
      if (guns + bows >= 30) opts.push("barrage");
      return pick(opts, roll, countered);
    default:
      return aiAttackOrder(mix, terrain, fort, lastStance, roll, ctx);
  }
}

/**
 * The AI's stance by its country's doctrine:
 * - Japan: rolling volleys in rough ground, massed in the open.
 * - Joseon: on walls the archers' screen and the hold, never a sally; in
 *   hiding ground the archers' screen; in the open against Japan the hold.
 * - Ming: the shared AI.
 * Every country strikes a crossing and answers the order it met (most phases).
 */
export function doctrineDefenceStance(
  tag: string,
  mix: RowMix,
  lastOrder: AttackOrder | null,
  roll: number,
  ctx: DoctrineCtx & { fort?: number } = {},
): DefenceStance {
  if (tag !== "JOS" && tag !== "JPN")
    return aiDefenceStance(mix, lastOrder, roll, ctx);
  if (ctx.crossing === true && roll % 4 !== 0) return "strike_crossing";
  const c = lastOrder === null ? null : COUNTER_OF_ORDER[lastOrder];
  const fort = ctx.fort ?? 0;
  if (
    c !== null &&
    roll % 4 !== 0 &&
    !(tag === "JOS" && c === "counter_charge")
  )
    return c;
  const rough = ctx.terrain !== undefined && HIDING.has(ctx.terrain);
  const arq = mix.arquebus ?? 0;
  const opts: DefenceStance[] = ["hold"];
  if (tag === "JPN") {
    if (rough) opts.push("rolling_volley", "rolling_volley");
    else opts.push("massed_volley", "massed_volley", "rolling_volley");
    return opts[roll % opts.length];
  }
  // Joseon.
  if (fort > 0 || rough) opts.push("archer_screen", "archer_screen");
  else if (ctx.enemy === "JPN") opts.push("hold");
  else opts.push("archer_screen");
  if (arq >= 30) opts.push(rough ? "rolling_volley" : "massed_volley");
  else if (arq >= 20) opts.push("rolling_volley");
  return opts[roll % opts.length];
}
