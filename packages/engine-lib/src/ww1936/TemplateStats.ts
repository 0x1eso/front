// World War 1936 P2: a template's and a division's numbers (P2 spec §4.3,
// §4.4). Pure integer functions: the engine, the AI and the template
// designer call the same ones.
import {
  DS_AMPHIBIOUS,
  DS_FLAIL,
  DS_FLAME,
  DS_TD_DEFEND,
  KeyStatsTable,
  KS,
  KS_FIELDS,
  WW_TANK_DESIGN_SLOTS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  EQUIP_KEYS,
  EQUIPMENT_TYPES,
  WwOrderBlock,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  BattalionId,
  DivisionStats,
  GROUND_EQUIP_KEYS,
  GROUND_SLOTS,
  GROUND_STATIC_SLOTS,
  NEED_GROUP_COUNT,
  NEED_GROUPS,
  NeedGroup,
  NG_HEAVY,
  NG_SPA,
  NG_SPAA,
  NG_TD,
  TemplateDef,
  TPL_AMPHIBIOUS,
  TPL_ARMOR_ANY,
  TPL_ARMOR_MAJOR,
  TPL_CAVALRY_MAJOR,
  TPL_FLAIL,
  TPL_FLAME,
  TPL_INFANTRY_DIV,
  TPL_MARINE_ANY,
  TPL_MARINE_MAJOR,
  TPL_MOTOR_ANY,
  TPL_MOUNTAIN_ANY,
  TPL_MOUNTAIN_MAJOR,
  TPL_PARA_ANY,
  TPL_TD_DEFEND,
  WW_MAX_BATTALIONS,
  WW_MAX_SUPPORT,
  WW_MAX_WIDTH,
  WW_MIN_BATTALIONS,
  WW_TEMPLATE_NAME_MAX,
} from "@openfront/engine-api/ww1936/LandTypes";
import type { WwStatKey } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { BATTALIONS, SUPPORTS } from "./Battalions";
import { battalionStatPct, pctOf } from "./DoctrineRules";
import { EQUIPMENT, unitCostMilli } from "./Equipment";
import { LAND_FUEL_PER_HOUR_MILLI } from "./FuelRules";
import { TechTotals, WW_TECHS } from "./WwTechs";

/** P6 plan decision 6: NEED_GROUPS index of an equipment type or design-only group. */
const TYPE_INDEX: ReadonlyMap<NeedGroup, number> = new Map(
  NEED_GROUPS.map((t, i) => [t, i]),
);
/** Need groups (P6: EQUIPMENT_TYPES, then the four design-only groups). */
const T = NEED_GROUP_COUNT;
/** NEED_GROUPS index of each static division slot; -1 for a tank design slot (its group is the country's). */
const SLOT_TYPE: readonly number[] = GROUND_EQUIP_KEYS.map((k, j) =>
  j < GROUND_STATIC_SLOTS ? TYPE_INDEX.get(EQUIP_KEYS[k][0])! : -1,
);
/** Generation of each division slot (a design slot: its slot number). */
const SLOT_GEN: readonly number[] = GROUND_EQUIP_KEYS.map(
  (k) => EQUIP_KEYS[k][1],
);
/** Where a mix's design units start (GenMix). */
const D0 = T;
/** Where a mix's static units of the groups holding designs start. */
const S0 = T + WW_TANK_DESIGN_SLOTS;

/**
 * Average generation ×100 per NEED_GROUPS index (100 when none), then (P6,
 * pre-flight §0-3b) the units of each tank design slot the division holds
 * (WW_TANK_DESIGN_SLOTS) and, for a group that holds designs, its static
 * units (NEED_GROUPS order, 0 elsewhere): the division's holding vector.
 * A division with static equipment only has zeros past the generations
 * and reads exactly P2's numbers.
 */
export type GenMix = readonly number[];
/** The mix's length. */
export const GEN_MIX_LENGTH = 2 * T + WW_TANK_DESIGN_SLOTS;
export const GEN1: GenMix = [
  ...NEED_GROUPS.map(() => 100),
  ...new Array<number>(GEN_MIX_LENGTH - T).fill(0),
];

/** The mix is GEN1 (every group at generation 1, no design unit). */
export function isGen1Mix(mix: GenMix): boolean {
  for (let i = 0; i < T; i++) if (mix[i] !== 100) return false;
  for (let i = T; i < mix.length; i++) if (mix[i] !== 0) return false;
  return true;
}

/** The draw-order year of a static slot: its generation's tech year (1936 without one). */
function staticYear(j: number): number {
  const [type, gen] = EQUIP_KEYS[GROUND_EQUIP_KEYS[j]];
  const tech = EQUIPMENT[type].techs[gen - 1];
  return tech === undefined ? 1936 : WW_TECHS[tech].year;
}

/**
 * P6 plan decision 7: the static slots' rows (a country without designs,
 * the screens before the first depth update): each static slot's group,
 * year and the main battalion's numbers at that generation; the design
 * slots empty (group -1).
 */

function staticKeyStats(): KeyStatsTable {
  const group = new Int8Array(GROUND_SLOTS).fill(-1);
  const year = new Int16Array(GROUND_SLOTS);
  const score = new Int32Array(GROUND_SLOTS);
  const stats = new Int32Array(GROUND_SLOTS * KS_FIELDS);
  for (let j = 0; j < GROUND_STATIC_SLOTS; j++) {
    group[j] = SLOT_TYPE[j];
    year[j] = staticYear(j);
    fillStaticRow(stats, j);
    score[j] = rowScore(stats, j, group[j], year[j]);
  }
  return { group, year, score, stats };
}

/** The need groups whose slots are ranked by performance score (the tanks). */
const LIGHT_G = TYPE_INDEX.get("light_tank")!;
const MEDIUM_G = TYPE_INDEX.get("medium_tank")!;

/** A need group of tanks (light, medium, heavy, tank destroyer, SP artillery, SP anti-air). */
export function isTankGroup(g: number): boolean {
  return (
    g === LIGHT_G ||
    g === MEDIUM_G ||
    g === NG_HEAVY ||
    g === NG_TD ||
    g === NG_SPA ||
    g === NG_SPAA
  );
}

/**
 * Score weights, percent, in KS order (soft, hard, def, brk, pierce, armor,
 * aa). The score reads a KeyStatsTable row, the very numbers a battalion
 * blends in (templateStats), so a static tank (the battalion's numbers at
 * its generation) and a design stand on one scale. Cost is not in it.
 */
const W_TANK = [20, 25, 10, 15, 15, 15, 0];
const W_TD = [0, 30, 10, 0, 50, 10, 0];
const W_SPA = [60, 10, 10, 20, 0, 0, 0];
const W_SPAA = [10, 0, 10, 10, 0, 0, 70];
const W_FIELDS = [KS.soft, KS.hard, KS.def, KS.brk, KS.pierce, KS.armor, KS.aa];

/**
 * The performance score of a KeyStatsTable row (integers only): weighted by
 * the group's role — tank: soft, hard, breakthrough, defence, armour,
 * pierce; tank destroyer: mainly pierce and hard; SP artillery: mainly
 * soft; SP anti-air: mainly anti-air. Groups that are no tanks rank by
 * `year` (their generation), as before.
 */
export function rowScore(
  stats: ArrayLike<number>,
  j: number,
  group: number,
  year: number,
): number {
  if (!isTankGroup(group)) return year;
  const w =
    group === NG_TD
      ? W_TD
      : group === NG_SPA
        ? W_SPA
        : group === NG_SPAA
          ? W_SPAA
          : W_TANK;
  const o = j * KS_FIELDS;
  let sum = 0;
  for (let i = 0; i < W_FIELDS.length; i++) {
    if (w[i] !== 0) sum += stats[o + W_FIELDS[i]] * w[i];
  }
  return Math.floor(sum / 100);
}

/** Percent below the group's best score from which a key is old (Rule 5). */
export const TANK_OLD_PCT = 15;

/** `score` is old against `best` (more than TANK_OLD_PCT below it), integers only. */
export function isOldScore(score: number, best: number): boolean {
  return score * 100 < best * (100 - TANK_OLD_PCT);
}

/** The tech a static slot's equipment needs (undefined: none). */
function staticTech(j: number): WwTechId | undefined {
  const [type, gen] = EQUIP_KEYS[GROUND_EQUIP_KEYS[j]];
  return EQUIPMENT[type].techs[gen - 1];
}

/** Which division slots are old, and the best score per need group. */
export interface OldInfo {
  /** Best score among the keys the country can field, per NEED_GROUPS index (0: none). */
  best: Int32Array;
  /** 1 for an old slot (a tank group's slot more than TANK_OLD_PCT below its group's best). */
  old: Uint8Array;
}

/**
 * The screens' KeyStatsTable: the static rows with the given tank designs
 * (slot is 1-based) written into the design rows, scores included — the
 * engine's own table (WwDepth.fillDesignRows) holds the same numbers.
 */
export function keyStatsWithDesigns(
  designs: ReadonlyArray<{
    slot: number;
    stats: {
      group: number;
      year: number;
      soft: number;
      hard: number;
      def: number;
      brk: number;
      pierce: number;
      armor: number;
      aa: number;
    };
  }>,
): KeyStatsTable {
  const t: KeyStatsTable = {
    group: STATIC_KEY_STATS.group.slice(),
    year: STATIC_KEY_STATS.year.slice(),
    score: STATIC_KEY_STATS.score.slice(),
    stats: STATIC_KEY_STATS.stats.slice(),
  };
  for (const { slot, stats: s } of designs) {
    const j = GROUND_STATIC_SLOTS + slot - 1;
    if (j < GROUND_STATIC_SLOTS || j >= GROUND_SLOTS) continue;
    const o = j * KS_FIELDS;
    t.group[j] = s.group;
    t.year[j] = s.year;
    t.stats[o + KS.soft] = s.soft;
    t.stats[o + KS.hard] = s.hard;
    t.stats[o + KS.def] = s.def;
    t.stats[o + KS.brk] = s.brk;
    t.stats[o + KS.pierce] = s.pierce;
    t.stats[o + KS.armor] = s.armor;
    t.stats[o + KS.aa] = s.aa;
    t.score[j] = rowScore(t.stats, j, s.group, s.year);
  }
  return t;
}

const OLD_MEMO = new WeakMap<
  KeyStatsTable,
  { res: ReadonlySet<WwTechId>; size: number; info: OldInfo }
>();

/**
 * Rule 5: a slot is old when its score is more than TANK_OLD_PCT below the
 * best score of its need group among the keys the country can field — its
 * designs and the static tanks whose tech it has. Only the tank groups
 * have old slots. Memoised per table and tech set (a table is replaced
 * whenever a design changes).
 */
export function oldInfoOf(
  ks: KeyStatsTable,
  researched: ReadonlySet<WwTechId>,
): OldInfo {
  const hit = OLD_MEMO.get(ks);
  if (
    hit !== undefined &&
    hit.res === researched &&
    hit.size === researched.size
  ) {
    return hit.info;
  }
  const best = new Int32Array(NEED_GROUP_COUNT);
  const old = new Uint8Array(GROUND_SLOTS);
  for (let j = 0; j < GROUND_SLOTS; j++) {
    const g = slotGroup(ks, j);
    if (g < 0 || !isTankGroup(g)) continue;
    if (j < GROUND_STATIC_SLOTS) {
      const tech = staticTech(j);
      if (tech !== undefined && !researched.has(tech)) continue;
    }
    if (ks.score[j] > best[g]) best[g] = ks.score[j];
  }
  for (let j = 0; j < GROUND_SLOTS; j++) {
    const g = slotGroup(ks, j);
    if (g < 0 || !isTankGroup(g)) continue;
    if (isOldScore(ks.score[j], best[g])) old[j] = 1;
  }
  const info = { best, old };
  OLD_MEMO.set(ks, { res: researched, size: researched.size, info });
  return info;
}

/** The numbers of the first battalion whose main equipment is the slot's type, at its generation. */
function fillStaticRow(stats: Int32Array, j: number): void {
  const [type, gen] = EQUIP_KEYS[GROUND_EQUIP_KEYS[j]];
  const id = (Object.keys(BATTALIONS) as BattalionId[]).find(
    (b) => BATTALIONS[b].equip[0][0] === type,
  );
  const o = j * KS_FIELDS;
  stats[o + KS.relPm] = 1000;
  if (id === undefined) return;
  const d = BATTALIONS[id];
  const g = gen * 100;
  const gp = genStatPct(g);
  const ga = genArmorPct(g);
  stats[o + KS.soft] = Math.floor((d.soft * gp) / 100);
  stats[o + KS.hard] = Math.floor((d.hard * gp) / 100);
  stats[o + KS.def] = Math.floor((d.def * gp) / 100);
  stats[o + KS.brk] = Math.floor((d.brk * gp) / 100);
  stats[o + KS.pierce] = Math.floor((d.pierce * ga) / 100);
  stats[o + KS.armor] = Math.floor((d.armor * ga) / 100);
  stats[o + KS.hardnessPm] = d.hardnessPm;
  stats[o + KS.speedCenti] =
    d.speedCenti + (d.kind === "armor" ? (gen - 1) * 100 : 0);
  stats[o + KS.aa] = d.airAtk * 100;
}

/** The NEED_GROUPS index a division slot fills for a country (-1: none). */
export function slotGroup(ks: KeyStatsTable, j: number): number {
  return j < GROUND_STATIC_SLOTS ? SLOT_TYPE[j] : ks.group[j];
}

/**
 * The division slots of a need group in draw order — the highest score
 * first (tanks: the performance score; elsewhere the year, so P2's newest
 * generation first), then the smaller key.
 */
export function groupDrawSlots(ks: KeyStatsTable, g: number): number[] {
  const out: number[] = [];
  for (let j = 0; j < GROUND_SLOTS; j++)
    if (slotGroup(ks, j) === g) out.push(j);
  return out.sort((a, b) => ks.score[b] - ks.score[a] || a - b);
}

/** Owner, 2026-11-03: training takes half the time of the battalion tables. */
export const WW_TRAIN_TIME_PCT = 50;

const clampGen = (g: number) => Math.max(100, Math.min(300, g));
/** Attack, defence, breakthrough and HP: 100 / 125 / 150 % at gen 1 / 2 / 3. */
export function genStatPct(g: number): number {
  return 100 + Math.floor((clampGen(g) - 100) / 4);
}
/** Armour and pierce: 100 / 140 / 180 %. */
export function genArmorPct(g: number): number {
  return 100 + Math.floor(((clampGen(g) - 100) * 40) / 100);
}

export const STATIC_KEY_STATS: KeyStatsTable = staticKeyStats();

/** A division's generation mix (and P6 design units) from its slots. */
export function genMixOf(
  equip: ArrayLike<number>,
  ks: KeyStatsTable = STATIC_KEY_STATS,
): number[] {
  return genMixInto(new Array<number>(GEN_MIX_LENGTH), equip, ks);
}

const MIX_UNITS: number[] = new Array<number>(T).fill(0);
const MIX_SUM: number[] = new Array<number>(T).fill(0);

/** genMixOf written into `out` (GEN_MIX_LENGTH long), without allocating; returns `out`. */
export function genMixInto(
  out: number[],
  equip: ArrayLike<number>,
  ks: KeyStatsTable = STATIC_KEY_STATS,
): number[] {
  const units = MIX_UNITS;
  const sum = MIX_SUM;
  units.fill(0);
  sum.fill(0);
  for (let j = 0; j < GROUND_STATIC_SLOTS; j++) {
    const i = SLOT_TYPE[j];
    units[i] += equip[j];
    sum[i] += equip[j] * SLOT_GEN[j];
  }
  for (let i = 0; i < T; i++) {
    out[i] = units[i] === 0 ? 100 : Math.floor((sum[i] * 100) / units[i]);
  }
  for (let i = 0; i < T; i++) out[S0 + i] = 0;
  for (let d = 0; d < WW_TANK_DESIGN_SLOTS; d++) {
    const n = equip[GROUND_STATIC_SLOTS + d] ?? 0;
    out[D0 + d] = n;
    const g = ks.group[GROUND_STATIC_SLOTS + d];
    if (n > 0 && g >= 0) out[S0 + g] = units[g];
  }
  return out;
}

/** The mix holds no design unit (P2's numbers). */
function staticOnly(gens: GenMix): boolean {
  for (let d = 0; d < WW_TANK_DESIGN_SLOTS; d++) {
    if ((gens[D0 + d] ?? 0) !== 0) return false;
  }
  return true;
}

/**
 * P6 (plan decision 6, spec §5.2.4): a tank battalion's numbers when its
 * division holds designs of its group: the hold-weighted average of the
 * static part (P2's numbers, `stat`) and each design slot's row.
 */
interface Blend {
  units: number;
  sums: number[];
  flags: number;
}

function blendOf(
  gens: GenMix,
  ks: KeyStatsTable,
  g: number,
  staticUnits: number,
): Blend | null {
  let units = 0;
  const sums = new Array<number>(KS_FIELDS).fill(0);
  let flags = 0;
  for (let d = 0; d < WW_TANK_DESIGN_SLOTS; d++) {
    const n = gens[D0 + d] ?? 0;
    const j = GROUND_STATIC_SLOTS + d;
    if (n <= 0 || ks.group[j] !== g) continue;
    units += n;
    const o = j * KS_FIELDS;
    for (let f = 0; f < KS_FIELDS; f++) {
      if (f !== KS.flags) sums[f] += ks.stats[o + f] * n;
    }
    flags |= ks.stats[o + KS.flags];
  }
  if (units === 0) return null;
  return { units: units + staticUnits, sums, flags };
}

/** (static × staticUnits + design sums) / all units. */
function blend(b: Blend, staticVal: number, staticUnits: number, f: number) {
  return Math.floor((staticVal * staticUnits + b.sums[f]) / b.units);
}

/** Design flags (DS_*) as division flags (TPL_*). */
function designTplFlags(ds: number): number {
  return (
    ((ds & DS_FLAME) !== 0 ? TPL_FLAME : 0) |
    ((ds & DS_AMPHIBIOUS) !== 0 ? TPL_AMPHIBIOUS : 0) |
    ((ds & DS_FLAIL) !== 0 ? TPL_FLAIL : 0) |
    ((ds & DS_TD_DEFEND) !== 0 ? TPL_TD_DEFEND : 0)
  );
}

/** ww67: a battalion's weight in a division's pierce, a support company's being 1. */
const BATTALION_PIERCE_WEIGHT = 3;

const AT_TYPE = TYPE_INDEX.get("anti_tank")!;
/** The anti-tank key's slot of generation 1, 2, … */
const AT_SLOTS: readonly number[] = SLOT_TYPE.flatMap((ty, j) =>
  ty === AT_TYPE && j < GROUND_STATIC_SLOTS ? [j] : [],
);

/** The anti-tank key's pierce in a table at a generation mix `g` (100 = generation 1). */
function atRowPierce(ks: KeyStatsTable, g: number): number {
  const row = (i: number) =>
    ks.stats[
      AT_SLOTS[Math.max(0, Math.min(AT_SLOTS.length - 1, i))] * KS_FIELDS +
        KS.pierce
    ];
  const i = Math.floor(g / 100) - 1;
  const f = g % 100;
  return Math.floor((row(i) * (100 - f) + row(i + 1) * f) / 100);
}

/**
 * ww67: a gun's pierce with its country's anti-tank key (catalogue majors'
 * real penetration, rule 7): `generic`, the table's number for this battalion
 * or company, scaled by that key against the generic one. Other types, and
 * the generic table, keep `generic`.
 */
function atKeyPierce(
  ks: KeyStatsTable,
  type: number,
  g: number,
  generic: number,
): number {
  if (type !== AT_TYPE || ks === STATIC_KEY_STATS) return generic;
  const base = atRowPierce(STATIC_KEY_STATS, g);
  return base <= 0
    ? generic
    : Math.floor((generic * atRowPierce(ks, g)) / base);
}

/**
 * Spec §4.3: sums, averages and the HOI4 armour / pierce formulas of a
 * template at full strength. Generations and the doctrines that change a
 * battalion (firepower_1, mass_1, mass_2, mobile_2's org) are baked in;
 * country-wide percentages are combat modifiers (CombatRules).
 */
export function templateStats(
  def: TemplateDef,
  tech: TechTotals,
  gens: GenMix,
  ks: KeyStatsTable = STATIC_KEY_STATS,
): DivisionStats {
  // P6: the designs a division holds blend into its tank battalions.
  const withDesigns = !staticOnly(gens);
  let designFlags = 0;
  const need = new Array<number>(T).fill(0);
  const parts = new Array<number>(T * 4).fill(0);
  let width = 0;
  let men = 0;
  let hp = 0;
  let orgSum = 0;
  let n = 0;
  let hardSum = 0;
  let armorMax = 0;
  let armorSum = 0;
  let armoured = 0;
  let pierceMax = 0;
  let pierceSum = 0;
  let pierceN = 0;
  let speed = Number.MAX_SAFE_INTEGER;
  let supply = 0;
  let train = 0;
  let flags = 0;
  let special = 0;
  let armorN = 0;
  let motorN = 0;
  let mountainN = 0;
  let marineN = 0;
  let cavalryN = 0;
  let paraN = 0;
  // P4 (spec §10.5, §14.6, §15.3).
  let weight = 0;
  let airAtk = 0;
  let fuelWidth = 0;
  let fuelHour = 0;
  const st = tech as unknown as Partial<Record<WwStatKey, number>>;
  for (const id of def.battalions) {
    const d = BATTALIONS[id];
    const main = TYPE_INDEX.get(d.equip[0][0])!;
    const g = gens[main];
    // P6 (plan Task 1 Step 13): the battalion's own P6 stats (all 0 without them).
    const bp = battalionStatPct(st, id);
    const gp = genStatPct(g);
    const ga = genArmorPct(g);
    // P6: the designs of its group, blended with the static part by units.
    const su = gens[S0 + main] ?? 0;
    const bl =
      withDesigns && d.kind === "armor" ? blendOf(gens, ks, main, su) : null;
    if (bl !== null) designFlags |= designTplFlags(bl.flags);
    const mix = (staticVal: number, f: number) =>
      bl === null ? staticVal : blend(bl, staticVal, su, f);
    width += d.width;
    weight += d.weightCenti;
    const aaStatic = Math.floor((d.airAtk * gp) / 100);
    airAtk +=
      bl === null
        ? aaStatic
        : Math.floor(blend(bl, aaStatic * 100, su, KS.aa) / 100);
    const fuel = LAND_FUEL_PER_HOUR_MILLI[id];
    if (fuel !== undefined) {
      fuelWidth += d.width;
      fuelHour += fuel;
    }
    men += d.men;
    hp += Math.floor((d.hpMilli * gp) / 100);
    orgSum +=
      d.orgMilli +
      bp.org * 1000 +
      (d.kind === "infantry" ? tech.infOrg * 1000 : 0) +
      (bl === null ? 0 : Math.floor((bl.sums[KS.orgAdd] * 1000) / bl.units));
    n++;
    hardSum += mix(d.hardnessPm, KS.hardnessPm);
    const armor = pctOf(
      mix(Math.floor((d.armor * ga) / 100), KS.armor),
      bp.armor,
    );
    const pierce = pctOf(
      mix(atKeyPierce(ks, main, g, Math.floor((d.pierce * ga) / 100)), KS.pierce),
      bp.pierce,
    );
    armorMax = Math.max(armorMax, armor);
    armorSum += armor;
    if (armor > 0) armoured++;
    pierceMax = Math.max(pierceMax, pierce);
    pierceSum += pierce * BATTALION_PIERCE_WEIGHT;
    pierceN += BATTALION_PIERCE_WEIGHT;
    let soft = mix(Math.floor((d.soft * gp) / 100), KS.soft);
    if (d.artillery) {
      soft = Math.floor((soft * (100 + tech.artillerySoftPct)) / 100);
    }
    parts[main * 4] += pctOf(soft, bp.soft);
    parts[main * 4 + 1] += pctOf(
      mix(Math.floor((d.hard * gp) / 100), KS.hard),
      bp.hard,
    );
    parts[main * 4 + 2] += pctOf(
      mix(Math.floor((d.def * gp) / 100), KS.def),
      bp.def,
    );
    parts[main * 4 + 3] += pctOf(
      mix(Math.floor((d.brk * gp) / 100), KS.brk),
      bp.brk,
    );
    // Tanks gain 1 km/h a generation (spec §4.1).
    const sp = mix(
      d.speedCenti +
        (d.kind === "armor" ? Math.floor((clampGen(g) - 100) / 100) * 100 : 0),
      KS.speedCenti,
    );
    speed = Math.min(speed, pctOf(sp, bp.speed));
    supply += d.supplyMilli;
    const days =
      d.kind === "infantry"
        ? Math.floor((d.trainDays * (100 - tech.infTrainCutPct)) / 100)
        : d.trainDays;
    train = Math.max(train, days);
    for (const [t, k] of d.equip) need[TYPE_INDEX.get(t)!] += k;
    if (d.special) special++;
    if (d.kind === "armor") armorN++;
    if (d.kind === "motor" || id === "mot_artillery") motorN++;
    if (id === "mountain") mountainN++;
    if (id === "marine") marineN++;
    if (id === "cavalry") cavalryN++;
    if (id === "paratrooper") paraN++;
  }
  // P6 (spec §21.2): supportCompanyPct scales every support company.
  const supPct = st.supportCompanyPct ?? 0;
  for (const id of def.support) {
    const d = SUPPORTS[id];
    const main = TYPE_INDEX.get(d.equip[0][0])!;
    const gp = genStatPct(gens[main]);
    const sbp = battalionStatPct(st, id);
    men += d.men;
    weight += d.weightCenti;
    airAtk += Math.floor((d.airAtk * gp) / 100);
    hp += Math.floor((d.hpMilli * gp) / 100);
    let soft = Math.floor((d.soft * gp) / 100);
    if (d.artillery) {
      soft = Math.floor((soft * (100 + tech.artillerySoftPct)) / 100);
    }
    parts[main * 4] += pctOf(soft, supPct + sbp.soft);
    parts[main * 4 + 1] += pctOf(
      Math.floor((d.hard * gp) / 100),
      supPct + sbp.hard,
    );
    parts[main * 4 + 2] += pctOf(
      Math.floor((d.def * gp) / 100),
      supPct + sbp.def,
    );
    parts[main * 4 + 3] += pctOf(
      Math.floor((d.brk * gp) / 100),
      supPct + sbp.brk,
    );
    if (d.pierce > 0) {
      const p = pctOf(
        atKeyPierce(
          ks,
          main,
          gens[main],
          Math.floor((d.pierce * genArmorPct(gens[main])) / 100),
        ),
        sbp.pierce,
      );
      pierceMax = Math.max(pierceMax, p);
      pierceSum += p;
      pierceN++;
    }
    for (const [t, k] of d.equip) need[TYPE_INDEX.get(t)!] += k;
    flags |= d.flag;
  }
  if (armorN > 0) flags |= TPL_ARMOR_ANY;
  if (armorN * 2 >= n && n > 0) flags |= TPL_ARMOR_MAJOR;
  if (motorN > 0) flags |= TPL_MOTOR_ANY;
  if (mountainN > 0) flags |= TPL_MOUNTAIN_ANY;
  if (marineN > 0) flags |= TPL_MARINE_ANY;
  if (mountainN * 2 >= n && n > 0) flags |= TPL_MOUNTAIN_MAJOR;
  if (marineN * 2 >= n && n > 0) flags |= TPL_MARINE_MAJOR;
  if (cavalryN * 2 >= n && n > 0) flags |= TPL_CAVALRY_MAJOR;
  if (paraN > 0) flags |= TPL_PARA_ANY;
  if (armorN === 0 && motorN === 0 && cavalryN === 0) flags |= TPL_INFANTRY_DIV;
  const sum = (k: number) => {
    let x = 0;
    for (let i = 0; i < T; i++) x += parts[i * 4 + k];
    return x;
  };
  let orgMilli = n === 0 ? 0 : Math.floor(orgSum / n);
  if (flags & (TPL_ARMOR_ANY | TPL_MOTOR_ANY)) orgMilli += tech.mechOrg * 1000;
  return {
    width,
    men,
    hpMilli: hp,
    orgMilli,
    soft: sum(0),
    hard: sum(1),
    def: sum(2),
    brk: sum(3),
    // HOI4: 30% max + 70% average armour, ww67: of the armoured battalions
    // alone (how much of the division they are is its hardness, armorProtectPm).
    // Pierce is what the division can actually bring to bear, 1.5 times its
    // weighted average up to its best gun: two thirds of it able to hit is the
    // gun's whole number, and a support company counts a third of a battalion,
    // so it adds a little.
    armor:
      armoured === 0
        ? 0
        : Math.floor(
            (30 * armorMax * armoured + 70 * armorSum) / (100 * armoured),
          ),
    pierce:
      pierceN === 0
        ? 0
        : Math.min(pierceMax, Math.floor((3 * pierceSum) / (2 * pierceN))),
    hardnessPm: n === 0 ? 0 : Math.floor(hardSum / n),
    speedCenti: n === 0 ? 0 : speed,
    supplyMilli: supply,
    trainDays: Math.floor((train * WW_TRAIN_TIME_PCT) / 100),
    need,
    parts,
    flags,
    special,
    battalions: n,
    weightCenti: weight,
    airAtk,
    fuelWidthPm: width === 0 ? 0 : Math.floor((fuelWidth * 1000) / width),
    fuelHourMilli: fuelHour,
    designFlags,
  };
}

/**
 * Units of each need group in a division's slots, NEED_GROUPS order (P6
 * plan decision 6: a design slot counts for its design's group).
 */
export function equipByType(
  equip: ArrayLike<number>,
  ks: KeyStatsTable = STATIC_KEY_STATS,
): number[] {
  const have = new Array<number>(T).fill(0);
  // (slotGroup inlined: the static slots' groups are fixed.)
  for (let j = 0; j < GROUND_STATIC_SLOTS; j++) {
    have[SLOT_TYPE[j]] += equip[j] ?? 0;
  }
  for (let j = GROUND_STATIC_SLOTS; j < GROUND_SLOTS; j++) {
    const n = equip[j] ?? 0;
    if (n === 0) continue;
    const g = ks.group[j];
    if (g >= 0) have[g] += n;
  }
  return have;
}

/** A need group's stock, every slot of it (the AI's planning). */
export function groupStock(
  stock: ArrayLike<number>,
  g: number,
  ks: KeyStatsTable = STATIC_KEY_STATS,
): number {
  let n = 0;
  for (let j = 0; j < GROUND_SLOTS; j++) {
    if (slotGroup(ks, j) === g) n += stock[GROUND_EQUIP_KEYS[j]] ?? 0;
  }
  return n;
}

/** Fill of each need group, ‰ (1000 when the template needs none). */
export function equipFill(
  s: DivisionStats,
  equip: ArrayLike<number>,
  ks: KeyStatsTable = STATIC_KEY_STATS,
): number[] {
  const have = equipByType(equip, ks);
  const need = s.need;
  const out = new Array<number>(need.length);
  for (let i = 0; i < need.length; i++) {
    const nd = need[i];
    out[i] =
      nd === 0 ? 1000 : Math.min(1000, Math.floor((have[i] * 1000) / nd));
  }
  return out;
}

/** Spec §4.3: attack and defence values by their equipment's fill, HP by men. */
export function divisionStats(
  s: DivisionStats,
  equip: ArrayLike<number>,
  men: number,
  ks: KeyStatsTable = STATIC_KEY_STATS,
): DivisionStats {
  return divisionStatsAt(s, equipFill(s, equip, ks), men);
}

/** divisionStats with the fill already computed (`fill` = equipFill(s, equip)). */
export function divisionStatsAt(
  s: DivisionStats,
  fill: readonly number[],
  men: number,
): DivisionStats {
  const parts = s.parts;
  let soft = 0;
  let hard = 0;
  let def = 0;
  let brk = 0;
  for (let i = 0; i < T; i++) {
    const f = fill[i];
    soft += Math.floor((parts[i * 4] * f) / 1000);
    hard += Math.floor((parts[i * 4 + 1] * f) / 1000);
    def += Math.floor((parts[i * 4 + 2] * f) / 1000);
    brk += Math.floor((parts[i * 4 + 3] * f) / 1000);
  }
  const menPm =
    s.men === 0 ? 1000 : Math.min(1000, Math.floor((men * 1000) / s.men));
  return {
    ...s,
    soft,
    hard,
    def,
    brk,
    hpMilli: Math.floor((s.hpMilli * menPm) / 1000),
  };
}

/**
 * Each need group's unit cost at generation 1 (the fill weights); P6: a
 * design-only group weighs as a medium tank (designs have no table cost).
 */
const GROUP_COST_MILLI: readonly number[] = NEED_GROUPS.map((_, i) =>
  unitCostMilli(
    i < EQUIPMENT_TYPES.length ? EQUIPMENT_TYPES[i] : "medium_tank",
    1,
  ),
);

/** Cost-weighted equipment fill of a division, ‰ (spec §4.3's strength bar, equipment half). */
export function equipFillPm(
  s: DivisionStats,
  equip: ArrayLike<number>,
  ks: KeyStatsTable = STATIC_KEY_STATS,
): number {
  return equipFillPmAt(s, equipFill(s, equip, ks));
}

/** equipFillPm with the fill already computed (`fill` = equipFill(s, equip)). */
export function equipFillPmAt(
  s: DivisionStats,
  fill: readonly number[],
): number {
  let w = 0;
  let got = 0;
  const need = s.need;
  for (let i = 0; i < T; i++) {
    const nd = need[i];
    if (nd === 0) continue;
    const c = nd * GROUP_COST_MILLI[i];
    w += c;
    got += Math.floor((c * fill[i]) / 1000);
  }
  return w === 0 ? 1000 : Math.floor((got * 1000) / w);
}

/** The strength bar (spec §4.3): min(cost-weighted equipment fill, men fill), ‰. */
export function strengthPm(
  s: DivisionStats,
  equip: ArrayLike<number>,
  men: number,
  ks: KeyStatsTable = STATIC_KEY_STATS,
): number {
  return strengthPmAt(s, equipFill(s, equip, ks), men);
}

/** strengthPm with the fill already computed (`fill` = equipFill(s, equip)). */
export function strengthPmAt(
  s: DivisionStats,
  fill: readonly number[],
  men: number,
): number {
  const eq = equipFillPmAt(s, fill);
  const mp =
    s.men === 0 ? 1000 : Math.min(1000, Math.floor((men * 1000) / s.men));
  return Math.min(eq, mp);
}

const NAME_RE = /^[^\s\p{Cc}](?:[^\p{Cc}]*[^\s\p{Cc}])?$/u;

/**
 * Spec §4.4: why a template cannot be saved (or trained when specialRoom
 * is finite: the special battalions the country may still add); null when
 * it can. The screens grey the save button with the same function.
 */
export function templateBlock(
  def: TemplateDef,
  researched: ReadonlySet<WwTechId>,
  specialRoom: number,
): WwOrderBlock | null {
  if (def.battalions.length < 1 || def.battalions.length > WW_MAX_BATTALIONS) {
    return "bad_template";
  }
  // Support companies take no width, so under a few battalions they beat
  // everything: a division with support needs WW_MIN_BATTALIONS.
  if (def.support.length > 0 && def.battalions.length < WW_MIN_BATTALIONS) {
    return "too_small";
  }
  if (def.support.length > WW_MAX_SUPPORT) return "bad_template";
  if (new Set(def.support).size !== def.support.length) return "bad_template";
  // "" = the automatic name (1936 defaults, the AI's edits); a player's
  // order always carries one (the zod schema requires it).
  if (
    def.name !== "" &&
    (def.name.length > WW_TEMPLATE_NAME_MAX || !NAME_RE.test(def.name))
  ) {
    return "bad_template";
  }
  let width = 0;
  let special = 0;
  for (const id of def.battalions) {
    const d = BATTALIONS[id];
    width += d.width;
    if (d.special) special++;
    if (d.techs.some((t) => !researched.has(t))) return "no_tech";
  }
  if (width > WW_MAX_WIDTH) return "bad_template";
  for (const id of def.support) {
    if (SUPPORTS[id].techs.some((t) => !researched.has(t))) return "no_tech";
  }
  if (special > specialRoom) return "special_cap";
  return null;
}

/** Spec §4.1: special battalions a country may field: max(24, 5% of all its battalions). */
export function specialCap(totalBattalions: number): number {
  return Math.max(24, Math.floor((totalBattalions * 5) / 100));
}

/** Battalion counts of a template, most first (stable): a player template's default name, the army symbol. */
export function templateCounts(def: TemplateDef): [BattalionId, number][] {
  const m = new Map<BattalionId, number>();
  for (const id of def.battalions) m.set(id, (m.get(id) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
}
