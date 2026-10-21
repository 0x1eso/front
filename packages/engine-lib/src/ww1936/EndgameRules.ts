// World War 1936 P5 (spec §6.2–§6.3, §8.3–§8.6, §9.1–§9.2, §12.1,
// §13.2–§13.3, §15.2, §3.5, §25.3): the endgame's pure rules. The engine and
// the screens call the same functions (Global Constraints: package
// boundaries). Integers only.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  OccupationLaw,
  SubjectLevel,
  WW_CIVIL_SHARE_MAX_BP,
  WW_CIVIL_SHARE_MIN_BP,
  WW_INTEGRATE_COMP_BP,
  WW_INTEGRATE_DAYS,
  WW_LL_MAX_CONTRACTS,
  WW_LL_TENSION_DEMOCRACY_PCT,
  WW_LL_TENSION_RECEIVER_PCT,
  WW_OCC_COMP_BASE_BP,
  WW_OCC_COMP_CAP_FIGHTING_BP,
  WW_OCC_LAW_COST_PP,
  WW_OCC_RES_BASE_BP,
  WW_OCC_RES_BASE_FIGHTING_BP,
  WW_OCC_RES_DOWN_MAX_BP,
  WW_OCC_RES_UP_MAX_BP,
  WW_PEACE_POOL_PCT,
  WW_VOLUNTEER_MAX_DIV,
  WW_VOLUNTEER_MIN_DIV,
  WW_VOLUNTEER_TENSION_PCT,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import type {
  BattalionId,
  SupportId,
  TemplateDef,
} from "@openfront/engine-api/ww1936/LandTypes";
import type { Ideology } from "@openfront/engine-api/ww1936/PoliticsTypes";

// ---- Peace conference (spec §6.2, §6.3) ----

export function regionBaseValue(
  vp: number,
  factories: number,
  tiles: number,
): number {
  return 4 + 2 * vp + 2 * factories + Math.floor(tiles / 2000);
}

export interface CostMods {
  controls: boolean;
  core: boolean;
  claim: boolean;
  conquerGoal: boolean;
  otherControls: boolean;
}
export const COST_FACTORS: readonly (readonly [keyof CostMods, number])[] = [
  ["controls", 50],
  ["core", 50],
  ["claim", 75],
  ["conquerGoal", 90],
  ["otherControls", 200],
];
/** Plan decision 13: multiply every factor, divide once; at least 1. */
export function demandCost(base: number, m: CostMods): number {
  let num = base;
  let den = 1;
  for (const [k, f] of COST_FACTORS) {
    if (!m[k]) continue;
    num *= f;
    den *= 100;
  }
  return Math.max(1, Math.floor(num / den));
}

/** Country-wide and grouped demands: a percent of the summed region costs (spec §6.4). */
export const AGG_PCT = {
  annex_rest: 90,
  occupation_zone: 30,
  puppet: 50,
  release: 60,
  liberate: 30,
  change_government: 30,
  change_government_topple: 15,
  demilitarise: 20,
  disarm: 15,
} as const;
export function aggregateCost(costs: readonly number[], pct: number): number {
  let s = 0;
  for (const c of costs) s += c;
  return Math.max(1, Math.floor((s * pct) / 100));
}
export function dismantleCost(members: number): number {
  return Math.max(1, members * 20);
}
export function reparationsCost(k: number): number {
  return 12 * k;
}
export function takeNavyCost(weight: number): number {
  return Math.max(1, 2 * weight);
}
/** Spec §6.4: at most a quarter of the loser's civilian factories. */
export function maxReparations(lossCivs: number): number {
  return Math.floor(lossCivs / 4);
}

/** Spec §6.2, plan decision 12. */
export function participantPoints(
  totalBase: number,
  wsMilli: readonly number[],
): number[] {
  const pool = Math.floor((totalBase * WW_PEACE_POOL_PCT) / 100);
  const n = wsMilli.length;
  if (n === 0) return [];
  let sum = 0;
  for (const w of wsMilli) sum += Math.max(0, w);
  if (sum === 0) return wsMilli.map(() => Math.floor(pool / n));
  return wsMilli.map((w) =>
    Math.floor((pool * Math.floor((Math.max(0, w) * 1000) / sum)) / 1000),
  );
}
export function sharePm(part: number, all: readonly number[]): number {
  let sum = 0;
  for (const w of all) sum += Math.max(0, w);
  return sum === 0
    ? Math.floor(1000 / Math.max(1, all.length))
    : Math.floor((Math.max(0, part) * 1000) / sum);
}

/** Spec §6.2: war score descending (ties: smaller smallID); rounds 2 and 4 reversed (snake). */
export function turnOrder(
  wsMilli: readonly number[],
  ids: readonly number[],
  round: number,
): number[] {
  const idx = ids.map((_, i) => i);
  idx.sort((a, b) => wsMilli[b] - wsMilli[a] || ids[a] - ids[b]);
  const out = idx.map((i) => ids[i]);
  return round % 2 === 0 ? out.reverse() : out;
}

// ---- Occupation (spec §8) ----

export const OCC_LAW = {
  occ_civil: {
    resPct: 70,
    compPct: 150,
    garrisonPct: 60,
    outputPp: -10,
    manpowerPp: 5,
  },
  occ_military: {
    resPct: 100,
    compPct: 100,
    garrisonPct: 100,
    outputPp: 0,
    manpowerPp: 0,
  },
  occ_martial: {
    resPct: 140,
    compPct: 30,
    garrisonPct: 150,
    outputPp: 15,
    manpowerPp: -5,
  },
} as const satisfies Record<OccupationLaw, object>;

export function coveragePct(supDeci: number, needDeci: number): number {
  if (needDeci <= 0) return 100;
  return Math.min(100, Math.floor((supDeci * 100) / needDeci));
}

export interface ResTargetIn {
  /** A core holder is active or an exile (spec §8.3 base 3,500). */
  coreHolderFighting: boolean;
  law: OccupationLaw;
  compBp: number;
  coveragePct: number;
  /** The best exile legitimacy among the core holders, bp. */
  exileLegitBp: number;
  /** Percentage points added (controller's resistanceTargetPct + core holders' support spirits). */
  statPct: number;
}
export function resistanceTarget(i: ResTargetIn): number {
  let t = i.coreHolderFighting
    ? WW_OCC_RES_BASE_FIGHTING_BP
    : WW_OCC_RES_BASE_BP;
  t = Math.floor((t * OCC_LAW[i.law].resPct) / 100);
  t = Math.floor((t * (10000 - Math.floor(i.compBp / 2))) / 10000);
  t = Math.floor((t * (200 - i.coveragePct)) / 100);
  t += Math.min(1000, Math.floor(i.exileLegitBp / 10));
  t += i.statPct * 100;
  return Math.max(0, Math.min(10000, t));
}
/** Daily change (spec §8.3): up at most 15 bp (upMax), down at most 30 bp × coverage. */
export function resistanceStep(
  resBp: number,
  targetBp: number,
  coverage: number,
  upMaxBp = WW_OCC_RES_UP_MAX_BP,
): number {
  if (targetBp > resBp) {
    return Math.min(upMaxBp, Math.max(1, Math.ceil((targetBp - resBp) / 30)));
  }
  if (targetBp < resBp) {
    const down = Math.min(
      WW_OCC_RES_DOWN_MAX_BP,
      Math.max(1, Math.ceil((resBp - targetBp) / 30)),
    );
    return -Math.floor((down * coverage) / 100);
  }
  return 0;
}
export interface CompStepIn {
  compBp: number;
  resBp: number;
  law: OccupationLaw;
  statPct: number;
  capBp: number;
}
/** Daily change (spec §8.4); the caller clamps to 0..capBp. */
export function complianceStep(i: CompStepIn): number {
  const g = Math.floor(
    (WW_OCC_COMP_BASE_BP *
      OCC_LAW[i.law].compPct *
      (10000 - i.resBp) *
      (100 + i.statPct)) /
      (100 * 10000 * 100),
  );
  const d = g - (i.resBp >= 5000 ? 5 : 0);
  return Math.max(-i.compBp, Math.min(i.capBp - i.compBp, d));
}
export function complianceCap(coreHolderFighting: boolean): number {
  return coreHolderFighting ? WW_OCC_COMP_CAP_FIGHTING_BP : 10000;
}
/** Spec §8.6: (가) occupied = control ≠ legal owner; (나) annexed = someone else's core taken. */
export function occupationShare(
  kind: "occupied" | "annexed",
  compBp: number,
  law: OccupationLaw,
  statPp = 0,
): { factoryPct: number; manpowerPct: number } {
  const L = OCC_LAW[law];
  if (kind === "occupied") {
    return {
      factoryPct: Math.max(
        10,
        Math.min(
          90,
          20 + Math.floor((compBp * 60) / 10000) + L.outputPp + statPp,
        ),
      ),
      manpowerPct: Math.max(0, Math.floor((compBp * 5) / 10000) + L.manpowerPp),
    };
  }
  return {
    factoryPct: Math.max(
      30,
      Math.min(
        100,
        50 + Math.floor((compBp * 50) / 10000) + L.outputPp + statPp,
      ),
    ),
    manpowerPct: Math.max(0, Math.floor((compBp * 10) / 10000) + L.manpowerPp),
  };
}
/** Spec §8.5, in tenths: ⌈(10 + tiles/400) × (1 + res×2/10000) × law × (100 + stat)/100⌉. */
export function garrisonNeed(
  tiles: number,
  resBp: number,
  law: OccupationLaw,
  statPct: number,
): number {
  const num =
    (4000 + tiles) *
    (10000 + resBp * 2) *
    OCC_LAW[law].garrisonPct *
    (100 + statPct);
  return Math.ceil(num / (400 * 10000 * 100 * 100));
}
/** Spec §8.5, tenths per battalion / support company. */
export const BATTALION_SUPPRESS: Partial<Record<BattalionId, number>> = {
  cavalry: 20,
  infantry: 10,
  mountain: 10,
  motorized: 10,
  marine: 5,
  paratrooper: 5,
  light_armor: 5,
};
export const SUPPORT_SUPPRESS: Partial<Record<SupportId, number>> = {
  military_police: 30,
};
export function divisionSuppression(
  t: TemplateDef,
  strengthPm: number,
): number {
  let s = 0;
  for (const b of t.battalions) s += BATTALION_SUPPRESS[b] ?? 0;
  for (const c of t.support) s += SUPPORT_SUPPRESS[c] ?? 0;
  return Math.floor((s * Math.max(0, Math.min(1000, strengthPm))) / 1000);
}
/** Spec §8.6: one milli of damage per day on the most numerous building. */
export function resistanceDamageMilli(resBp: number, coverage: number): number {
  if (resBp < 2500) return 0;
  return Math.floor(((resBp - 2500) * (100 - coverage)) / 100 / 50);
}
export function garrisonLossMen(men: number, resBp: number): number {
  if (resBp < 2500) return 0;
  return Math.floor((men * (resBp - 2500)) / 10000 / 400);
}
export function occLawBlock(
  lockUntilDay: number,
  day: number,
  ppMilli: number,
): WwOrderBlock | null {
  if (day < lockUntilDay) return "law_locked";
  if (ppMilli < WW_OCC_LAW_COST_PP * 1000) return "no_pp";
  return null;
}
export interface IntegrateIn {
  legalOwner: boolean;
  controls: boolean;
  hasCore: boolean;
  compBp: number;
  compHighDays: number;
  enemyHoldsCore: boolean;
  ppMilli: number;
  vp: number;
}
export function integrateCostPp(vp: number): number {
  return 25 + vp;
}
export function integrateBlock(i: IntegrateIn): WwOrderBlock | null {
  if (!i.legalOwner || !i.controls || i.hasCore || i.enemyHoldsCore) {
    return "not_integrable";
  }
  if (i.compBp < WW_INTEGRATE_COMP_BP || i.compHighDays < WW_INTEGRATE_DAYS) {
    return "not_integrable";
  }
  if (i.ppMilli < integrateCostPp(i.vp) * 1000) return "no_pp";
  return null;
}

// ---- Subjects (spec §9) ----

export function subjectShares(level: SubjectLevel): {
  resourcePct: number;
  civPct: number;
  manpowerPct: number;
} {
  switch (level) {
    case "integrated":
      return { resourcePct: 50, civPct: 30, manpowerPct: 30 };
    case "puppet":
      return { resourcePct: 30, civPct: 15, manpowerPct: 15 };
    case "colony":
      return { resourcePct: 15, civPct: 5, manpowerPct: 5 };
    case "dominion":
      return { resourcePct: 0, civPct: 0, manpowerPct: 0 };
  }
}
export interface AutonomyIn {
  subjFactories: number;
  overlordFactories: number;
  ideologyDiffers: boolean;
  fightingDivs: number;
  overlordDivsInSubject: number;
  /** Production cost of equipment received from the overlord today. */
  llFromOverlord: number;
  tightening: boolean;
  statPct: number;
}
export function autonomyDelta(i: AutonomyIn): number {
  let d = Math.min(
    20,
    Math.floor((20 * i.subjFactories) / Math.max(1, i.overlordFactories)),
  );
  if (i.ideologyDiffers) d += 2;
  d += Math.min(5, Math.floor(i.fightingDivs / 5));
  if (i.overlordDivsInSubject >= 5) d -= 2;
  d -= Math.floor(i.llFromOverlord / 100);
  if (i.tightening) d -= 10;
  return Math.trunc((d * (100 + i.statPct)) / 100);
}

// ---- Aid (spec §12, §13) ----

export function volunteerCap(senderDivs: number, targetDivs: number): number {
  return Math.min(
    Math.ceil((senderDivs * 10) / 100),
    Math.max(2, Math.floor(targetDivs / 3)),
    WW_VOLUNTEER_MAX_DIV,
  );
}
export interface VolunteerIn {
  self: boolean;
  targetAtWar: boolean;
  atWarWithTargetEnemy: boolean;
  atWarWithTarget: boolean;
  senderDemocracy: boolean;
  tensionPct: number;
  senderDivs: number;
  targetDivs: number;
  alreadySent: number;
  armyDivs: number;
  /** A spirit rule forbids aid to this target (spec §19.1 non-intervention). */
  ruleBlocks: boolean;
}
export function volunteerBlock(i: VolunteerIn): WwOrderBlock | null {
  if (
    i.self ||
    !i.targetAtWar ||
    i.atWarWithTargetEnemy ||
    i.atWarWithTarget ||
    i.ruleBlocks
  ) {
    return "volunteer_conditions";
  }
  if (i.senderDemocracy && i.tensionPct < WW_VOLUNTEER_TENSION_PCT) {
    return "volunteer_conditions";
  }
  if (i.senderDivs < WW_VOLUNTEER_MIN_DIV) return "volunteer_conditions";
  if (i.alreadySent + i.armyDivs > volunteerCap(i.senderDivs, i.targetDivs)) {
    return "volunteer_limit";
  }
  return null;
}
export interface LlIn {
  self: boolean;
  atWarWithEachOther: boolean;
  bothActors: boolean;
  receiverAtWar: boolean;
  tensionPct: number;
  senderDemocracy: boolean;
  senderLendLeaseFlag: boolean;
  senderNoLendLeaseRule: boolean;
}
/** Spec §13.2: null when a contract may run today. */
export function llBlock(i: LlIn): WwOrderBlock | null {
  if (i.self || i.atWarWithEachOther || !i.bothActors) return "ll_conditions";
  if (!i.receiverAtWar && i.tensionPct < WW_LL_TENSION_RECEIVER_PCT) {
    return "ll_conditions";
  }
  if (i.senderNoLendLeaseRule) return "ll_conditions";
  if (
    i.senderDemocracy &&
    !i.senderLendLeaseFlag &&
    i.tensionPct < WW_LL_TENSION_DEMOCRACY_PCT
  ) {
    return "ll_conditions";
  }
  return null;
}
export function llLimitBlock(contracts: number): WwOrderBlock | null {
  return contracts >= WW_LL_MAX_CONTRACTS ? "ll_limit" : null;
}
/** Spec §13.3: industry 10 = one convoy over 5,000 km. */
export function lendLeaseConvoys(dailyCost: number, routeKm: number): number {
  return Math.ceil((dailyCost * routeKm) / 50000);
}
export function lendLeaseSeaDays(routeKm: number, kmPerDay: number): number {
  return Math.max(1, Math.ceil(routeKm / kmPerDay));
}
/** Spec §14: captured milli of `lostMilli`. */
export function captureMilli(lostMilli: number, captureBp: number): number {
  return Math.floor((lostMilli * captureBp) / 10000);
}
/**
 * Pre-flight §A A (P6 K1 ruling): the default contract a content-fired
 * gen_diplo_lend_lease opens — 10% of the giver's stock of its
 * oldest-generation infantry equipment a month (at least 1), capped.
 */
export function defaultLendLeasePerMonth(stock: number, cap: number): number {
  return Math.max(1, Math.min(cap, Math.floor(stock / 10)));
}

// ---- Civil war (spec §15) ----

export function civilWarShareBp(popBp: number): number {
  return Math.max(
    WW_CIVIL_SHARE_MIN_BP,
    Math.min(WW_CIVIL_SHARE_MAX_BP, popBp),
  );
}
export interface RegionGraphView {
  /** Land neighbours, ascending. */
  neighbours(region: number): readonly number[];
}
/**
 * Spec §15.2: the rebel regions. BFS from the seeds (content seeds, else the
 * candidate farthest from the capital, ties: smaller id) over candidates in
 * id order until the rebels' points reach ⌈total × share⌉; then unreached
 * candidates by points (desc, ties id) until the share is met; finally each
 * 0-point candidate joins the side with more neighbours (ties: the government).
 * The capital never joins. Sorted ascending.
 */
export function splitRegionsForCivilWar(
  graph: RegionGraphView,
  candidates: readonly number[],
  capital: number,
  seeds: readonly number[],
  vp: (r: number) => number,
  shareBp: number,
): number[] {
  const cand = [...new Set(candidates)].sort((a, b) => a - b);
  const isCand = new Set(cand);
  let total = 0;
  for (const r of cand) total += vp(r);
  const want = Math.ceil((total * shareBp) / 10000);
  const dist = new Map<number, number>();
  if (isCand.has(capital)) {
    dist.set(capital, 0);
    const q = [capital];
    for (let h = 0; h < q.length; h++) {
      for (const n of graph.neighbours(q[h])) {
        if (!isCand.has(n) || dist.has(n)) continue;
        dist.set(n, dist.get(q[h])! + 1);
        q.push(n);
      }
    }
  }
  let start = seeds
    .filter((r) => isCand.has(r) && r !== capital)
    .sort((a, b) => a - b);
  if (start.length === 0) {
    let best = 0;
    let bestD = 0;
    for (const r of cand) {
      const d = dist.get(r);
      if (r === capital || d === undefined) continue;
      if (d > bestD) {
        best = r;
        bestD = d;
      }
    }
    if (best !== 0) start = [best];
  }
  const rebel = new Set<number>();
  const seen = new Set<number>(start);
  let got = 0;
  const q = [...start];
  for (let h = 0; h < q.length && got < want; h++) {
    const r = q[h];
    rebel.add(r);
    got += vp(r);
    for (const n of graph.neighbours(r)) {
      if (!isCand.has(n) || n === capital || seen.has(n)) continue;
      seen.add(n);
      q.push(n);
    }
  }
  if (got < want) {
    const rest = cand
      .filter((r) => r !== capital && !seen.has(r))
      .sort((a, b) => vp(b) - vp(a) || a - b);
    for (const r of rest) {
      if (got >= want) break;
      rebel.add(r);
      got += vp(r);
    }
  }
  for (const r of cand) {
    if (r === capital || vp(r) !== 0) continue;
    let reb = 0;
    let gov = 0;
    for (const n of graph.neighbours(r)) {
      if (!isCand.has(n) || n === r) continue;
      if (rebel.has(n)) reb++;
      else gov++;
    }
    if (reb > gov) rebel.add(r);
    else rebel.delete(r);
  }
  return [...rebel].sort((a, b) => a - b);
}

/**
 * Spec §3.5: lightness ±18%, hue 20° toward the ideology's hue. Integer
 * HSL: hue in tenths of a degree (0..3599), saturation and lightness in
 * permille (the round trip is exact enough to keep the parent's colour).
 */
export const IDEOLOGY_HUE: Readonly<Record<Ideology, number>> = {
  democratic: 215,
  communist: 0,
  fascist: 30,
  neutral: 270,
};
export function civilWarColor(
  parent: readonly [number, number, number],
  ideology: Ideology,
): [number, number, number] {
  const [h, s, l] = rgbToHsl(parent);
  const diff = ((IDEOLOGY_HUE[ideology] * 10 - h + 5400) % 3600) - 1800;
  const step = diff === 0 ? 0 : Math.sign(diff) * Math.min(200, Math.abs(diff));
  return hslToRgb(
    (h + step + 3600) % 3600,
    s,
    l < 500 ? Math.min(1000, l + 180) : Math.max(0, l - 180),
  );
}
/** n / d rounded half up (d > 0). */
function rdiv(n: number, d: number): number {
  return Math.floor((2 * n + d) / (2 * d));
}
/** [hue in tenths of a degree, saturation ‰, lightness ‰]. */
export function rgbToHsl([r, g, b]: readonly [number, number, number]): [
  number,
  number,
  number,
] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = rdiv((max + min) * 1000, 510);
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s =
    max + min > 255
      ? rdiv(d * 1000, 510 - max - min)
      : rdiv(d * 1000, max + min);
  let h: number;
  if (max === r) h = rdiv(600 * (g - b), d);
  else if (max === g) h = rdiv(600 * (b - r), d) + 1200;
  else h = rdiv(600 * (r - g), d) + 2400;
  return [((h % 3600) + 3600) % 3600, Math.min(1000, s), l];
}
/** The inverse of rgbToHsl (hue in tenths of a degree, s and l in ‰). */
export function hslToRgb(
  h: number,
  s: number,
  l: number,
): [number, number, number] {
  // Chroma, the second component and the offset in millionths of full scale.
  const c = (1000 - Math.abs(2 * l - 1000)) * s;
  const hh = h % 1200;
  const x = Math.floor((c * (600 - Math.abs(hh - 600))) / 600);
  const m = l * 1000 - Math.floor(c / 2);
  const sectors: [number, number, number][] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ];
  const [r1, g1, b1] = sectors[Math.floor(h / 600) % 6];
  const to = (v: number) =>
    Math.max(0, Math.min(255, rdiv((v + m) * 255, 1_000_000)));
  return [to(r1), to(g1), to(b1)];
}
export function packRgb([r, g, b]: readonly [number, number, number]): number {
  return (r << 16) | (g << 8) | b;
}
/** Spec §3.5: ww1936.cw_name.<ideology> with {country}. */
export function civilWarNameKey(ideology: Ideology): string {
  return `ww1936.cw_name.${ideology}`;
}
export type { CountryTag };
