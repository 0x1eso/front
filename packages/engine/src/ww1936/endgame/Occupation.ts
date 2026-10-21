// World War 1936 P5 lane O (plan Task 3): occupation — resistance,
// compliance, laws, integration, the region shares, resistance's damage and
// uprisings (spec §7.3, §8). Every number is an integer (bp, %, tenths,
// milli); regions go in id order, countries by smallID.
import {
  BUILDING_IDS,
  type BuildingId,
  equipKey,
  EQUIPMENT_TYPES,
  type WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  OCCUPATION_LAWS,
  type OccupationLaw,
  WW_INTEGRATE_COMP_BP,
  WW_OCC_DAMAGE_RES_BP,
  WW_OCC_LAW_COST_PP,
  WW_OCC_LAW_LOCK_DAYS,
  WW_OCC_RES_UP_MAX_BP,
  WW_UPRISING_COVER_PCT,
  WW_UPRISING_DAYS,
  WW_UPRISING_DIVISIONS,
  WW_UPRISING_RES_BP,
  type WwOccView,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import {
  GROUND_SLOTS,
  groundSlotOf,
  MOVE_RETREAT,
  MOVE_SEA,
  WW_MAX_ARMY_DIVISIONS,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  complianceCap,
  complianceStep,
  coveragePct,
  garrisonLossMen,
  integrateBlock,
  integrateCostPp,
  occLawBlock,
  occupationShare,
  resistanceDamageMilli,
  resistanceStep,
  resistanceTarget,
} from "@openfront/engine-lib/ww1936/EndgameRules";
import {
  genMixOf,
  templateStats,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import { damageBuilding, effectiveBuildings } from "../economy/Buildings";
import { retreatDivision } from "../land/Battles";
import { setGarrison } from "../land/Orders";
import { evictDivisions, transferRegionPeaceful } from "../land/PoliticsBridge";
import type { WwLand } from "../land/WwLand";
import { payPp } from "../politics/PayPp";
import { landRegained } from "./Activate";
import { inGarrison, needOf, supplyOf } from "./Garrison";
import type { WwEndgame } from "./WwEndgame";

export { needOf } from "./Garrison";

/** Spec §8.3: an exile core holder with this spirit makes resistance climb faster. */
export const RESISTANCE_SUPPORT_SPIRIT = "gen_resistance_support";
/** …by this much a day, bp. */
export const RESISTANCE_SUPPORT_UP_BP = 5;
/** Spec §8.6: an uprising with nobody to take the region over: this damage, milli. */
export const UPRISING_FAILED_DAMAGE_MILLI = 2000;
/** …and resistance falls back to this, bp. */
export const UPRISING_FAILED_RES_BP = 5000;
/** Spec §8.6: an uprising division's equipment, % of its template's need. */
export const UPRISING_EQUIP_PCT = 30;
/** Spec §8.6: the building resistance damages first among the most numerous. */
const DAMAGE_ORDER: readonly BuildingId[] = [
  "mil",
  "civ",
  "dock",
  "rail",
  ...BUILDING_IDS.filter(
    (b) => b !== "mil" && b !== "civ" && b !== "dock" && b !== "rail",
  ),
];
const COMPLIANCE_HIGH_MAX = 65535;
const UPRISING_DAYS_MAX = 255;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** The core holders other than the controller; the strongest exile legitimacy; the spirit and stat lines (spec §8.3). */
interface Holders {
  holders: number[];
  fighting: boolean;
  legitBp: number;
  holderPct: number;
  upMax: number;
}

function holdersOf(eg: WwEndgame, c: number, region: number): Holders {
  const pol = eg.ww.politics;
  const holders = eg.coreHolders(region).filter((h) => h !== c);
  let fighting = false;
  let legitBp = 0;
  let holderPct = 0;
  let upMax = WW_OCC_RES_UP_MAX_BP;
  for (const h of holders) {
    if (eg.isActor(h)) fighting = true;
    const ex = eg.exileIdx.get(h);
    if (ex !== undefined) legitBp = Math.max(legitBp, eg.exiles[ex].legitBp);
    // "The same stat on both sides" (plan decision): the controller's
    // (usually negative) and the strongest core holder's (support spirits).
    holderPct = Math.max(holderPct, pol.stats(h).resistanceTargetPct);
    if (pol.country(h)?.hasSpirit(RESISTANCE_SUPPORT_SPIRIT) === true) {
      upMax = WW_OCC_RES_UP_MAX_BP + RESISTANCE_SUPPORT_UP_BP;
    }
  }
  return { holders, fighting, legitBp, holderPct, upMax };
}

function targetOf(
  eg: WwEndgame,
  c: number,
  region: number,
  h: Holders,
  law: OccupationLaw,
  cov: number,
): number {
  return resistanceTarget({
    coreHolderFighting: h.fighting,
    law,
    compBp: eg.compBp[region],
    coveragePct: cov,
    exileLegitBp: h.legitBp,
    statPct: eg.ww.politics.stats(c).resistanceTargetPct + h.holderPct,
  });
}

/**
 * Spec §8.3–§8.6: the day of `controller`'s administered regions, in
 * region order: the garrison's supply, resistance toward its target,
 * compliance, resistance's damage and losses, the uprising count. One
 * "garrison short" notice for the day (spec §20.8).
 */
export function stepOccupation(
  eg: WwEndgame,
  controller: number,
  day: number,
): void {
  const c = controller;
  const admin = eg.administeredOf(c);
  if (admin.length === 0) return;
  const pol = eg.ww.politics;
  const st = pol.stats(c);
  let short = 0;
  // A copy: an uprising takes a region off the list.
  for (const r of [...admin]) {
    if (eg.occSince[r] === 0) eg.occSince[r] = day + 1;
    const h = holdersOf(eg, c, r);
    const law = eg.occupationLawOf(c, pol.legalOwner[r] ?? 0);
    const need = needOf(eg, c, r);
    const sup = supplyOf(eg, r);
    eg.supDeci[r] = sup;
    const cov = coveragePct(sup, need);
    if (cov < 100) short++;
    const target = targetOf(eg, c, r, h, law, cov);
    eg.resBp[r] = clamp(
      eg.resBp[r] + resistanceStep(eg.resBp[r], target, cov, h.upMax),
      0,
      10000,
    );
    eg.compBp[r] = clamp(
      eg.compBp[r] +
        complianceStep({
          compBp: eg.compBp[r],
          resBp: eg.resBp[r],
          law,
          statPct: st.complianceGainPct,
          capBp: complianceCap(h.fighting),
        }),
      0,
      10000,
    );
    eg.compHigh[r] =
      eg.compBp[r] >= WW_INTEGRATE_COMP_BP
        ? Math.min(COMPLIANCE_HIGH_MAX, eg.compHigh[r] + 1)
        : 0;
    resistanceEffects(eg, c, r, cov);
    eg.uprDays[r] =
      eg.resBp[r] >= WW_UPRISING_RES_BP && cov < WW_UPRISING_COVER_PCT
        ? Math.min(UPRISING_DAYS_MAX, eg.uprDays[r] + 1)
        : 0;
    eg.dirtyOcc.add(r);
    if (eg.uprDays[r] >= WW_UPRISING_DAYS) uprisingNow(eg, r, eg.mg.ticks());
  }
  // Spec §20.8: one line a day, "Garrison shortage: n regions" (lane T's
  // key takes {n}; the day-note batch would send {items}).
  if (short > 0) eg.message(c, "ww1936_garrison_short", { n: short });
}

/**
 * Spec §8.6: resistance at 25% and over damages the region's most
 * numerous working building and wears down the controller's garrison
 * divisions there (men and, at the same rate, equipment: P2's losses).
 */
function resistanceEffects(
  eg: WwEndgame,
  c: number,
  region: number,
  cov: number,
): void {
  const res = eg.resBp[region];
  if (res < WW_OCC_DAMAGE_RES_BP) return;
  const d = resistanceDamageMilli(res, cov);
  if (d > 0) damageMostNumerous(eg, region, d);
  const land = eg.ww.land;
  const t = land.divisions;
  for (const row of [...land.rowsIn(region)]) {
    if (t.id[row] === 0 || t.owner[row] !== c || !inGarrison(land, row)) {
      continue;
    }
    loseMen(land, row, garrisonLossMen(t.men[row], res));
  }
}

/** P2 §5.5's loss: men (dead) and the same share of every equipment slot. */
function loseMen(land: WwLand, row: number, lost: number): void {
  const t = land.divisions;
  const men = t.men[row];
  if (lost <= 0 || men <= 0) return;
  const n = Math.min(men, lost);
  const base = row * GROUND_SLOTS;
  for (let j = 0; j < GROUND_SLOTS; j++) {
    const have = t.equip[base + j];
    if (have <= 0) continue;
    const eq = Math.floor((have * n) / men);
    if (eq > 0) land.addEquip(row, j, -eq);
  }
  land.setMen(row, men - n);
  land.noteCasualties(t.owner[row], n, n);
}

/** Spec §8.6: `milli` of damage on the region's most numerous working building (ties: DAMAGE_ORDER). */
function damageMostNumerous(
  eg: WwEndgame,
  region: number,
  milli: number,
): void {
  const econ = eg.ww.economy;
  let best: BuildingId | null = null;
  let most = 0;
  for (const b of DAMAGE_ORDER) {
    const n = effectiveBuildings(econ, region, b);
    if (n > most) {
      best = b;
      most = n;
    }
  }
  if (best !== null) damageBuilding(econ, region, best, milli);
}

/**
 * Spec §8.6: what an administered region gives its controller — occupied
 * (control ≠ legal owner) or taken (someone else's core): its compliance,
 * the law and the controller's occupationOutputPp.
 */
export function regionShareOf(
  eg: WwEndgame,
  region: number,
): { factoryPct: number; resourcePct: number; manpowerPct: number } {
  const c = eg.ww.land.controller[region] ?? 0;
  const owner = eg.ww.politics.legalOwner[region] ?? 0;
  const sh = occupationShare(
    owner !== c ? "occupied" : "annexed",
    eg.compBp[region],
    eg.occupationLawOf(c, owner),
    eg.ww.politics.stats(c).occupationOutputPp,
  );
  return {
    factoryPct: sh.factoryPct,
    resourcePct: sh.factoryPct,
    manpowerPct: sh.manpowerPct,
  };
}

/** Spec §8.6: the supply of an administered region, permille (at most −50%). */
export function supplyFactorOf(eg: WwEndgame, region: number): number {
  return Math.floor((1000 * (20000 - eg.resBp[region])) / 20000);
}

/**
 * occupation_law (spec §8.2): `by`'s law for the regions of legal owner
 * `of` (0: its default). 25 political power; the same target is locked
 * for 30 days after. The law it already has costs nothing.
 */
export function setOccupationLaw(
  eg: WwEndgame,
  by: number,
  of: number,
  law: OccupationLaw,
  day: number,
): WwOrderBlock | null {
  if (of !== 0 && (of < 1 || of >= eg.size)) return "bad_target";
  const pol = eg.ww.politics;
  const c = pol.country(by);
  if (c === null) return "dead";
  const row = eg.occLaw.find((x) => x.by === by && x.of === of);
  if (row !== undefined && OCCUPATION_LAWS[row.law] === law) return null;
  if (row === undefined && of === 0 && law === "occ_military") return null;
  const block = occLawBlock(row?.lockUntilDay ?? -1, day, c.ppMilli);
  if (block !== null) return block;
  if (!payPp(pol, by, WW_OCC_LAW_COST_PP)) return "no_pp";
  pol.markCountry(by);
  const lockUntilDay = day + WW_OCC_LAW_LOCK_DAYS;
  const idx = OCCUPATION_LAWS.indexOf(law);
  if (row !== undefined) {
    row.law = idx;
    row.lockUntilDay = lockUntilDay;
  } else {
    eg.occLaw.push({ by, of, law: idx, lockUntilDay });
    eg.occLaw.sort((a, b) => a.by - b.by || a.of - b.of);
  }
  const legal = pol.legalOwner;
  for (const r of eg.administeredOf(by)) {
    if (of === 0 || legal[r] === of) eg.dirtyOcc.add(r);
  }
  // The law rows go out with the occupation rows (region 0 is never one).
  eg.dirtyOcc.add(0);
  eg.message(by, "ww1936_occ_law", { law });
  return null;
}

/** What integrate_region checks (spec §7.3); the screens grey the button with the same. */
export function integrateBlockOf(
  eg: WwEndgame,
  smallID: number,
  region: number,
): WwOrderBlock | null {
  const sc = eg.ww.scenario;
  const reg = sc.region(region);
  if (reg === undefined) return "not_integrable";
  return integrateBlock({
    legalOwner: eg.ww.politics.legalOwner[region] === smallID,
    controls: eg.ww.land.controller[region] === smallID,
    hasCore: eg.hasCore(smallID, region),
    compBp: eg.compBp[region],
    compHighDays: eg.compHigh[region],
    enemyHoldsCore: eg
      .coreHolders(region)
      .some((h) => h !== smallID && eg.ww.isAtWar(smallID, h)),
    ppMilli: eg.ww.politics.country(smallID)?.ppMilli ?? 0,
    vp: reg.vp,
  });
}

/**
 * integrate_region (spec §7.3): 25 + victory points of political power
 * and the region becomes `smallID`'s core (its occupation ends with the
 * administered list).
 */
export function integrateRegion(
  eg: WwEndgame,
  smallID: number,
  region: number,
  day: number,
): WwOrderBlock | null {
  void day;
  const block = integrateBlockOf(eg, smallID, region);
  if (block !== null) return block;
  const pol = eg.ww.politics;
  const vp = eg.ww.scenario.region(region)?.vp ?? 0;
  if (!payPp(pol, smallID, integrateCostPp(vp))) return "no_pp";
  pol.markCountry(smallID);
  eg.addCore(smallID, region);
  return null;
}

/**
 * army_garrison (spec §8.5): the army garrisons the administered regions
 * of legal owner `scope` (0: all); Garrison.assignGarrisons walks its
 * divisions there each day. A volunteer army serves elsewhere.
 */
export function garrisonOrder(
  eg: WwEndgame,
  smallID: number,
  army: number,
  scope: number,
): WwOrderBlock | null {
  const a = eg.ww.land.armies.get(army);
  if (a === undefined || a.owner !== smallID) return "no_army";
  if (scope !== 0 && (scope < 1 || scope >= eg.size)) return "bad_target";
  if (a.volunteerFor > 0) return "army_busy";
  setGarrison(eg.ww.land, a, scope);
  return null;
}

/**
 * Spec §8.6 uprising: a core holder at war with the controller and still
 * fighting (the most legitimate — an active country counts 10,000 — then
 * the smaller smallID) takes the region back with two uprising divisions;
 * with none, the region's buildings take 2,000 milli and resistance drops
 * to 50%. Lane E's `uprising` effect calls it too.
 */
export function uprisingNow(eg: WwEndgame, region: number, tick: number): void {
  const land = eg.ww.land;
  const c = land.controller[region] ?? 0;
  if (c === 0 || eg.ww.scenario.region(region) === undefined) return;
  const holders = eg.coreHolders(region).filter((h) => h !== c);
  const legit = (h: number) => {
    const ex = eg.exileIdx.get(h);
    return ex === undefined ? 10000 : eg.exiles[ex].legitBp;
  };
  const k =
    holders
      .filter((h) => eg.isActor(h) && eg.ww.isAtWar(h, c))
      .sort((a, b) => legit(b) - legit(a) || a - b)[0] ?? 0;
  if (k !== 0) {
    transferRegionPeaceful(land, region, k, tick);
    driveOut(land, region, k);
    landRegained(eg, k, tick);
    spawnUprising(eg, k, region);
  } else {
    damageMostNumerous(eg, region, UPRISING_FAILED_DAMAGE_MILLI);
    eg.resBp[region] = UPRISING_FAILED_RES_BP;
  }
  eg.uprDays[region] = 0;
  eg.dirtyOcc.add(region);
  eg.news("news_uprising", { region });
  eg.message(c, "ww1936_uprising", { region });
  for (const h of holders) eg.message(h, "ww1936_uprising", { region });
}

/**
 * The region is `k`'s now: its enemies' divisions there retreat (P2: or
 * are lost with no way out); a neutral's go to their nearest own region.
 */
function driveOut(land: WwLand, region: number, k: number): void {
  const t = land.divisions;
  const neutral = new Set<number>();
  for (const row of [...land.rowsIn(region)]) {
    if (t.id[row] === 0 || t.mode[row] === MOVE_SEA) continue;
    const fo = land.fightOwner(row);
    if (land.sameSide(fo, k)) continue;
    if (land.isEnemy(fo, k)) {
      if (t.mode[row] !== MOVE_RETREAT) retreatDivision(land, row);
    } else {
      neutral.add(t.owner[row]);
    }
  }
  for (const o of [...neutral].sort((a, b) => a - b)) {
    evictDivisions(land, region, o);
  }
}

/**
 * Spec §8.6: two divisions of `k`'s first (infantry) template in the
 * region, as one army, with the template's men (raised there, not drawn
 * from k's pool) and 30% of its equipment (first generation).
 */
function spawnUprising(eg: WwEndgame, k: number, region: number): void {
  const land = eg.ww.land;
  const cl = land.country(k);
  const ce = land.econ.country(k);
  const tpl = cl?.templates[0];
  if (cl === null || ce === null || tpl === undefined) return;
  const s = templateStats(
    tpl.def,
    ce.stats,
    genMixOf(new Array<number>(GROUND_SLOTS).fill(0)),
  );
  const slots = new Array<number>(GROUND_SLOTS).fill(0);
  EQUIPMENT_TYPES.forEach((type, i) => {
    const j = groundSlotOf(equipKey(type, 1));
    if (j >= 0 && s.need[i] > 0) {
      slots[j] = Math.floor((s.need[i] * UPRISING_EQUIP_PCT) / 100);
    }
  });
  const org = templateStats(tpl.def, ce.stats, genMixOf(slots)).orgMilli;
  const army =
    land.newArmy(k) ??
    land
      .armiesOf(k)
      .sort((a, b) => a.id - b.id)
      .find(
        (a) =>
          a.divisions.length + WW_UPRISING_DIVISIONS <= WW_MAX_ARMY_DIVISIONS,
      ) ??
    null;
  if (army === null) return;
  for (let i = 0; i < WW_UPRISING_DIVISIONS; i++) {
    land.spawnDivision(k, tpl.id, region, army, s.men, slots, org);
  }
}

/** The occupation tab's row (spec §21.4): the numbers and today's target. */
export function occView(eg: WwEndgame, region: number): WwOccView {
  const c = eg.ww.land.controller[region] ?? 0;
  const owner = eg.ww.politics.legalOwner[region] ?? 0;
  const law = eg.occupationLawOf(c, owner);
  const need = needOf(eg, c, region);
  const cov = coveragePct(eg.supDeci[region], need);
  return {
    region,
    controller: c,
    resBp: eg.resBp[region],
    targetBp: targetOf(eg, c, region, holdersOf(eg, c, region), law, cov),
    compBp: eg.compBp[region],
    needDeci: need,
    supDeci: eg.supDeci[region],
    factoryPct: regionShareOf(eg, region).factoryPct,
    law,
    uprisingDays: eg.uprDays[region],
  };
}
