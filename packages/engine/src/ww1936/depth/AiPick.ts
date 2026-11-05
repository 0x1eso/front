// ww81 lane P (ww78 P1, ww80 C5): the AI's pick of an entry within a group
// (tank, plane, ship). One pure value rule, so the three groups agree:
//  1. nothing old: a candidate must pass isOldScore against the group's best
//     (the AI never builds what its own swap rule rejects);
//  2. wear: the cost grows by the breakdown the unit's reliability costs;
//  3. resources: a needed resource under half covered makes cost x1.5, none
//     at all x2.5 (stateless; the market's imports count in what is held);
//  4. a national quality lean Q (0..100, seeded +-10 a game): the score
//     counts more the closer it is to the top, the more Q;
//  5. C5: a tank that out-armours the enemy's pierce counts up to x3/2, one
//     that cannot pierce the enemy's armour down to x4/5, each on the
//     armour curve (ww90).
//     Speed is in the score itself (TemplateStats.tankSpeedPm).
// All integers; the lists are append-only and nothing here is stored.
import { KS, KS_FIELDS } from "@openfront/engine-api/ww1936/DepthTypes";
import { EQUIP_KEYS } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_EQUIP_KEYS,
  GROUND_SLOTS,
  GROUND_STATIC_SLOTS,
} from "@openfront/engine-api/ww1936/LandTypes";
import { agilityFactorPm } from "@openfront/engine-lib/ww1936/AirRules";
import {
  ARMOR_PROTECT_MAX_PM,
  armorProtectPm,
} from "@openfront/engine-lib/ww1936/CombatRules";
import { EQUIPMENT } from "@openfront/engine-lib/ww1936/Equipment";
import { breakdownPpm } from "@openfront/engine-lib/ww1936/hist/Wear";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import {
  isOldScore,
  isTankGroup,
  oldInfoOf,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import type { CountryEconomy } from "../economy/WwEconomy";
import { equipResources } from "./Designs";
import type { WwDepth } from "./WwDepth";

/** A line keeps its key when its value is at least this share of the best's. */
export const PICK_KEEP_PCT = 85;

/** National quality lean (ww80 section 1): DEU 60, GBR/JPN/FRA 50, USA 40, ITA 30, SUN 15, the rest 20. */
const QUALITY: Readonly<Record<string, number>> = {
  DEU: 60,
  GBR: 50,
  JPN: 50,
  FRA: 50,
  USA: 40,
  ITA: 30,
  SUN: 15,
};
const P_AI_QUALITY = idHash("ai_quality");

/** The country's lean, 0..100: its table value and a seeded +-10 per game. */
export function qualityLean(d: WwDepth, id: number): number {
  const base = QUALITY[d.ww.tagOf(id)] ?? 20;
  const jitter = (wwRoll(d.ww.politics.seed, P_AI_QUALITY, id) % 21) - 10;
  return Math.max(0, Math.min(100, base + jitter));
}

export interface PickCand {
  key: number;
  /** The engine's score (what "old" is judged on). */
  score: number;
  cost: number;
  /** Reliability, per mille (1000 when unknown). */
  relPm: number;
  /** Cost multiplier for resources, per mille (default 1000). */
  resPm?: number;
  /** Score multiplier, per mille (C5; default 1000). */
  scorePm?: number;
}

/** Integer value of each non-old candidate (0 for an old one), in list order. */
function valuesOf(list: readonly PickCand[], q: number): number[] {
  let topRaw = 0;
  for (const c of list) topRaw = Math.max(topRaw, c.score);
  const adj = list.map((c) =>
    Math.floor((Math.max(0, c.score) * (c.scorePm ?? 1000)) / 1000),
  );
  let top = 1;
  list.forEach((c, i) => {
    if (!isOldScore(c.score, topRaw)) top = Math.max(top, adj[i]);
  });
  return list.map((c, i) => {
    if (isOldScore(c.score, topRaw)) return 0;
    const lean = Math.floor(
      (adj[i] * (100 * top - q * top + q * adj[i])) / (100 * top),
    );
    const wear = 100 + Math.floor(breakdownPpm(c.relPm) / 250);
    const cost = Math.max(
      1,
      Math.floor((c.cost * wear * (c.resPm ?? 1000)) / 100_000),
    );
    return Math.floor((lean * 1_000_000) / cost);
  });
}

/** The key with the best value (ties: the smaller key). */
export function aiPickEntry(list: readonly PickCand[], q: number): number {
  const v = valuesOf(list, q);
  let best = 0;
  for (let i = 1; i < list.length; i++) {
    if (v[i] > v[best] || (v[i] === v[best] && list[i].key < list[best].key)) {
      best = i;
    }
  }
  return list[best].key;
}

/** Whether `key` stays: in the list, not old, and at least PICK_KEEP_PCT of the best's value. */
export function aiKeeps(
  list: readonly PickCand[],
  q: number,
  key: number,
): boolean {
  const v = valuesOf(list, q);
  const at = list.findIndex((c) => c.key === key);
  if (at < 0 || v[at] === 0) return false;
  return v[at] * 100 >= Math.max(...v) * PICK_KEEP_PCT;
}

// ---- resources ----

/** Cost multiplier (per mille) from what the key's resources cover of the lines' draw. */
export function resourceMultPm(
  d: WwDepth,
  id: number,
  ce: CountryEconomy,
  key: number,
  draw: readonly number[],
): number {
  const t = ce.totals;
  const per = equipResources(d, id, key);
  let mult = 1000;
  for (let r = 0; r < per.length; r++) {
    if (per[r] <= 0) continue;
    const have = t.produced[r] - t.exported[r] + t.imported[r];
    if (have <= 0) return 2500;
    if (have * 2 < draw[r]) mult = Math.max(mult, 1500);
  }
  return mult;
}

/** What the working lines draw of each resource a day. */
export function lineDraw(d: WwDepth, id: number, ce: CountryEconomy): number[] {
  const out = new Array<number>(ce.totals.produced.length).fill(0);
  for (const l of ce.lines) {
    if (l.active <= 0) continue;
    const per = equipResources(d, id, l.key);
    for (let r = 0; r < out.length; r++) out[r] += per[r] * l.active;
  }
  return out;
}

// ---- C5: tank score sees the threshold ----

export interface Threshold {
  /** Best armour among the enemies' fielded tanks (0: none known). */
  armor: number;
  /** Best pierce among their fielded tanks and guns. */
  pierce: number;
}

/** The enemies' (at war, else the top threats') best armour and pierce. */
export function enemyThreshold(
  d: WwDepth,
  id: number,
  enemies: readonly number[],
): Threshold {
  const out: Threshold = { armor: 0, pierce: 0 };
  for (const e of enemies) {
    const ce = d.ww.economy.country(e);
    if (ce === null || e === id) continue;
    const ks = d.keyStats(e);
    const info = oldInfoOf(ks, ce.researched);
    for (let j = 0; j < GROUND_SLOTS; j++) {
      const g = ks.group[j];
      if (g < 0 || info.old[j] === 1) continue;
      if (j < GROUND_STATIC_SLOTS) {
        const [type, gen] = EQUIP_KEYS[GROUND_EQUIP_KEYS[j]];
        const tech = EQUIPMENT[type].techs[gen - 1];
        if (tech !== undefined && !ce.researched.has(tech)) continue;
      }
      const o = j * KS_FIELDS;
      out.pierce = Math.max(out.pierce, ks.stats[o + KS.pierce]);
      if (isTankGroup(g)) {
        out.armor = Math.max(out.armor, ks.stats[o + KS.armor]);
      }
    }
  }
  return out;
}

/** C5 at its fullest: what armour nothing pierces adds, and what a gun that pierces nothing takes, ‰. */
const ARMOR_WORTH_PM = 500;
const PIERCE_WORTH_PM = 200;

/**
 * C5's multiplier (per mille) for a tank slot's armour and pierce against the
 * threshold. ww90: on the armour curve, which is what a hit reads: armour just
 * over the enemy's pierce stops next to nothing, and a light vehicle stops half
 * at best, so ×3/2 and ×4/5 are the far ends, not a step at the line.
 */
export function thresholdPm(
  armor: number,
  pierce: number,
  t: Threshold,
): number {
  const up =
    t.pierce > 0
      ? Math.floor(
          (ARMOR_WORTH_PM * armorProtectPm(armor, t.pierce)) /
            ARMOR_PROTECT_MAX_PM,
        )
      : 0;
  const down =
    t.armor > 0
      ? Math.floor(
          (PIERCE_WORTH_PM * armorProtectPm(t.armor, pierce)) /
            ARMOR_PROTECT_MAX_PM,
        )
      : 0;
  return Math.floor(((1000 + up) * (1000 - down)) / 1000);
}

// ---- planes (P1b): the fighter score the duel reads ----

/** AI-only fighter score: air attack x the agility factor against an average, plus defence. */
export function fighterScore(
  airAtk: number,
  airDef: number,
  agility: number,
): number {
  return (
    Math.floor((2 * airAtk * agilityFactorPm(agility, 10)) / 1000) + airDef
  );
}
