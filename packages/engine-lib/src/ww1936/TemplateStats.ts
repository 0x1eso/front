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
  TPL_BARE_ARMOR,
  TPL_CAVALRY_MAJOR,
  TPL_EXPLOIT,
  TPL_FLAIL,
  TPL_FLAME,
  TPL_FOOT_MAJOR,
  TPL_HEAVY_LEAD,
  TPL_INFANTRY_DIV,
  TPL_LIGHT_MAJOR,
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
  const gp = d.kind === "armor" ? genStatPct(g) : gearStatPct(g);
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
/**
 * ww67: everything but tanks (rifles, guns, trucks): 100 / 105 / 110 % a
 * generation, for majors and minors alike; a tank's numbers are its own.
 */
export function gearStatPct(g: number): number {
  return 100 + Math.floor(((clampGen(g) - 100) * 5) / 100);
}
/** Armour and pierce: 100 / 140 / 180 %. */
export function genArmorPct(g: number): number {
  return 100 + Math.floor(((clampGen(g) - 100) * 40) / 100);
}

export const STATIC_KEY_STATS: KeyStatsTable = staticKeyStats();

let ACTIVE_KS: KeyStatsTable | null = null;
let ACTIVE_SLOTS: Int16Array = new Int16Array(0);
const ACTIVE_MEMO = new WeakMap<KeyStatsTable, Int16Array>();

/**
 * The design slots (division slot indices) of a table that fill a need
 * group, ascending. Only those count in a division's mix and holdings, so
 * the hot loops visit them instead of every one of the (many) design
 * slots. A table is never written in place, so the list is made once.
 */
export function activeDesignSlots(ks: KeyStatsTable): Int16Array {
  if (ks === ACTIVE_KS) return ACTIVE_SLOTS;
  let a = ACTIVE_MEMO.get(ks);
  if (a === undefined) {
    const out: number[] = [];
    for (let j = GROUND_STATIC_SLOTS; j < GROUND_SLOTS; j++) {
      if (ks.group[j] >= 0) out.push(j);
    }
    a = Int16Array.from(out);
    ACTIVE_MEMO.set(ks, a);
  }
  ACTIVE_KS = ks;
  ACTIVE_SLOTS = a;
  return a;
}

/**
 * Whether two ground equipment vectors agree in every slot that counts for
 * `ks`: the static slots and the design slots that fill a group.
 */
export function sameCountedEquip(
  a: ArrayLike<number>,
  aBase: number,
  b: ArrayLike<number>,
  bBase: number,
  ks: KeyStatsTable,
): boolean {
  for (let j = 0; j < GROUND_STATIC_SLOTS; j++) {
    if (a[aBase + j] !== b[bBase + j]) return false;
  }
  const act = activeDesignSlots(ks);
  for (let i = 0; i < act.length; i++) {
    const j = act[i];
    if (a[aBase + j] !== b[bBase + j]) return false;
  }
  return true;
}

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
  // Only the slots that fill a group are held: units in an empty design
  // slot (group -1) count for nothing and read as zero.
  out.fill(0, D0, D0 + WW_TANK_DESIGN_SLOTS);
  const act = activeDesignSlots(ks);
  for (let a = 0; a < act.length; a++) {
    const j = act[a];
    const n = equip[j] ?? 0;
    out[D0 + j - GROUND_STATIC_SLOTS] = n;
    if (n > 0) {
      const g = ks.group[j];
      out[S0 + g] = units[g];
    }
  }
  return out;
}

/** The mix holds no design unit (P2's numbers). */
function staticOnly(gens: GenMix, ks: KeyStatsTable): boolean {
  const act = activeDesignSlots(ks);
  for (let a = 0; a < act.length; a++) {
    if ((gens[D0 + act[a] - GROUND_STATIC_SLOTS] ?? 0) !== 0) return false;
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
  const act = activeDesignSlots(ks);
  for (let a = 0; a < act.length; a++) {
    const j = act[a];
    const n = gens[D0 + j - GROUND_STATIC_SLOTS] ?? 0;
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

/** ww84: the most pierce bands a division keeps. */
export const MAX_PIERCE_BANDS = 4;
/** ww84: anti-tank guns are ambushers: their pierce on the attack, percent. */
export const GUN_ATTACK_PIERCE_PCT = 50;
const AMBUSH_GUNS: ReadonlySet<string> = new Set([
  "anti_tank",
  "tank_destroyer",
  "support_anti_tank",
]);
const gunAttackPierce = (p: number) =>
  Math.floor((p * GUN_ATTACK_PIERCE_PCT) / 100);

/** ww84: the most an opening barrage adds, bp. */
export const PREP_FIRE_MAX_BP = 3000;

/** ww84: the battalions that run through a broken line. */
const FAST_BATTALIONS: ReadonlySet<string> = new Set([
  "light_armor",
  "medium_armor",
  "motorized",
  "mot_artillery",
  "sp_artillery",
  "sp_anti_air",
]);

/** ww84: foot battalions: what an infantry-line tech reaches. */
const FOOT_KINDS: ReadonlySet<string> = new Set([
  "infantry",
  "cavalry",
  "special",
  "motor",
]);

/** One carrier of hard attack: its need group, pierce (defending, attacking) and hard attack. */
interface HardCarrier {
  group: number;
  pierce: number;
  atk: number;
  hard: number;
}

/**
 * ww84: the division's carriers of hard attack as pierce bands: one band for
 * each pierce, then the two nearest bands merged (weighted by hard attack)
 * until at most MAX_PIERCE_BANDS are left.
 */
function pierceBands(
  carriers: readonly HardCarrier[],
): Pick<
  DivisionStats,
  "bandPierce" | "bandPierceAtk" | "bandHard" | "bandParts"
> {
  const bands: { pierce: number; atk: number; hard: number; of: number[] }[] =
    [];
  carriers.forEach((c, i) => {
    const b = bands.find((x) => x.pierce === c.pierce && x.atk === c.atk);
    if (b === undefined) {
      bands.push({ pierce: c.pierce, atk: c.atk, hard: c.hard, of: [i] });
    } else {
      b.hard += c.hard;
      b.of.push(i);
    }
  });
  bands.sort((a, b) => a.pierce - b.pierce || a.atk - b.atk);
  while (bands.length > MAX_PIERCE_BANDS) {
    let k = 0;
    for (let i = 1; i + 1 < bands.length; i++) {
      if (
        bands[i + 1].pierce - bands[i].pierce <
        bands[k + 1].pierce - bands[k].pierce
      ) {
        k = i;
      }
    }
    const [a, b] = [bands[k], bands[k + 1]];
    const hard = a.hard + b.hard;
    const mean = (x: number, y: number) =>
      hard === 0
        ? Math.max(x, y)
        : Math.floor((x * a.hard + y * b.hard) / hard);
    bands.splice(k, 2, {
      pierce: mean(a.pierce, b.pierce),
      atk: mean(a.atk, b.atk),
      hard,
      of: [...a.of, ...b.of],
    });
  }
  const bandParts: number[] = [];
  bands.forEach((b, i) => {
    for (const c of b.of) {
      bandParts.push(i, carriers[c].group, carriers[c].hard);
    }
  });
  return {
    bandPierce: bands.map((b) => b.pierce),
    bandPierceAtk: bands.map((b) => b.atk),
    bandHard: bands.map((b) => b.hard),
    bandParts,
  };
}

/** Each type's static slots, generation 1 first. */
const STATIC_SLOTS_OF: readonly (readonly number[])[] = Array.from(
  { length: T },
  (_, ty) =>
    SLOT_TYPE.flatMap((t, j) =>
      t === ty && j < GROUND_STATIC_SLOTS ? [j] : [],
    ).sort((x, y) => SLOT_GEN[x] - SLOT_GEN[y]),
);

/** A static key's field in a table at a generation mix `g` (100 = generation 1). */
function keyFieldAt(
  ks: KeyStatsTable,
  type: number,
  g: number,
  field: number,
): number {
  const slots = STATIC_SLOTS_OF[type];
  if (slots.length === 0) return 0;
  const row = (i: number) =>
    ks.stats[
      slots[Math.max(0, Math.min(slots.length - 1, i))] * KS_FIELDS + field
    ];
  const i = Math.floor(g / 100) - 1;
  const f = g % 100;
  return Math.floor((row(i) * (100 - f) + row(i + 1) * f) / 100);
}

/**
 * ww67: a static number with its country's key (design rule 7: a major's key
 * fights as the catalogue entry standing in for it, generation included):
 * `generic`, the table's number for this battalion or company at `g`, scaled by
 * the key against the generic key. The generic table keeps `generic`, and so
 * does a key with nothing to scale by (a field the type doesn't have).
 */
function keyed(
  ks: KeyStatsTable,
  type: number,
  g: number,
  field: number,
  generic: number,
): number {
  if (ks === STATIC_KEY_STATS) return generic;
  const base = keyFieldAt(STATIC_KEY_STATS, type, g, field);
  return base <= 0
    ? generic
    : Math.floor((generic * keyFieldAt(ks, type, g, field)) / base);
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
  const withDesigns = !staticOnly(gens, ks);
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
  const carriers: HardCarrier[] = [];
  let speed = Number.MAX_SAFE_INTEGER;
  let supply = 0;
  let train = 0;
  let flags = 0;
  let special = 0;
  let armorN = 0;
  let footN = 0;
  // Battalions of guns ×3 (a support company counts one), and heavy tanks.
  let gunN = 0;
  let heavyN = 0;
  let lightN = 0;
  let fastN = 0;
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
  // ww84: what the portable anti-tank line adds to a foot battalion, centi.
  const atPierce = st.infAtPierce ?? 0;
  const atHard = st.infAtHard ?? 0;
  for (const id of def.battalions) {
    const d = BATTALIONS[id];
    const main = TYPE_INDEX.get(d.equip[0][0])!;
    const g = gens[main];
    // P6 (plan Task 1 Step 13): the battalion's own P6 stats (all 0 without them).
    const bp = battalionStatPct(st, id);
    const gp = d.kind === "armor" ? genStatPct(g) : gearStatPct(g);
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
    hardSum += mix(
      keyed(ks, main, g, KS.hardnessPm, d.hardnessPm),
      KS.hardnessPm,
    );
    const armor = pctOf(
      mix(
        keyed(ks, main, g, KS.armor, Math.floor((d.armor * ga) / 100)),
        KS.armor,
      ),
      bp.armor,
    );
    const foot = FOOT_KINDS.has(d.kind);
    const pierce =
      pctOf(
        mix(
          keyed(ks, main, g, KS.pierce, Math.floor((d.pierce * ga) / 100)),
          KS.pierce,
        ),
        bp.pierce,
      ) + (foot ? atPierce : 0);
    armorMax = Math.max(armorMax, armor);
    armorSum += armor;
    if (armor > 0) armoured++;
    pierceMax = Math.max(pierceMax, pierce);
    let soft = mix(
      keyed(ks, main, g, KS.soft, Math.floor((d.soft * gp) / 100)),
      KS.soft,
    );
    if (d.artillery) {
      soft = Math.floor((soft * (100 + tech.artillerySoftPct)) / 100);
    }
    parts[main * 4] += pctOf(soft, bp.soft);
    const hard =
      pctOf(
        mix(
          keyed(ks, main, g, KS.hard, Math.floor((d.hard * gp) / 100)),
          KS.hard,
        ),
        bp.hard,
      ) + (foot ? atHard : 0);
    parts[main * 4 + 1] += hard;
    carriers.push({
      group: main,
      pierce,
      atk: AMBUSH_GUNS.has(id) ? gunAttackPierce(pierce) : pierce,
      hard,
    });
    parts[main * 4 + 2] += pctOf(
      mix(keyed(ks, main, g, KS.def, Math.floor((d.def * gp) / 100)), KS.def),
      bp.def,
    );
    parts[main * 4 + 3] += pctOf(
      mix(keyed(ks, main, g, KS.brk, Math.floor((d.brk * gp) / 100)), KS.brk),
      bp.brk,
    );
    // Tanks gain 1 km/h a generation (spec §4.1).
    const sp = mix(
      keyed(
        ks,
        main,
        g,
        KS.speedCenti,
        d.speedCenti +
          (d.kind === "armor"
            ? Math.floor((clampGen(g) - 100) / 100) * 100
            : 0),
      ),
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
    if (foot) footN++;
    if (d.artillery) gunN += 3;
    if (id === "heavy_armor") heavyN++;
    if (id === "light_armor") lightN++;
    if (FAST_BATTALIONS.has(id)) fastN++;
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
    const gp = gearStatPct(gens[main]);
    const sbp = battalionStatPct(st, id);
    men += d.men;
    weight += d.weightCenti;
    airAtk += Math.floor((d.airAtk * gp) / 100);
    hp += Math.floor((d.hpMilli * gp) / 100);
    const sg = gens[main];
    let soft = keyed(ks, main, sg, KS.soft, Math.floor((d.soft * gp) / 100));
    if (d.artillery) {
      soft = Math.floor((soft * (100 + tech.artillerySoftPct)) / 100);
    }
    parts[main * 4] += pctOf(soft, supPct + sbp.soft);
    const hard = pctOf(
      keyed(ks, main, sg, KS.hard, Math.floor((d.hard * gp) / 100)),
      supPct + sbp.hard,
    );
    parts[main * 4 + 1] += hard;
    parts[main * 4 + 2] += pctOf(
      keyed(ks, main, sg, KS.def, Math.floor((d.def * gp) / 100)),
      supPct + sbp.def,
    );
    parts[main * 4 + 3] += pctOf(
      keyed(ks, main, sg, KS.brk, Math.floor((d.brk * gp) / 100)),
      supPct + sbp.brk,
    );
    if (d.pierce > 0) {
      const p = pctOf(
        keyed(
          ks,
          main,
          gens[main],
          KS.pierce,
          Math.floor((d.pierce * genArmorPct(gens[main])) / 100),
        ),
        sbp.pierce,
      );
      pierceMax = Math.max(pierceMax, p);
      carriers.push({
        group: main,
        pierce: p,
        atk: AMBUSH_GUNS.has(id) ? gunAttackPierce(p) : p,
        hard,
      });
    }
    for (const [t, k] of d.equip) need[TYPE_INDEX.get(t)!] += k;
    if (d.artillery) gunN++;
    flags |= d.flag;
  }
  if (armorN > 0) flags |= TPL_ARMOR_ANY;
  if (armorN * 2 >= n && n > 0) flags |= TPL_ARMOR_MAJOR;
  if (footN * 2 >= n && n > 0) flags |= TPL_FOOT_MAJOR;
  const heavyLead = heavyN > 0 && heavyN * 2 >= armorN;
  if (heavyLead) flags |= TPL_HEAVY_LEAD;
  if (lightN * 2 >= n && n > 0) flags |= TPL_LIGHT_MAJOR;
  if (fastN * 2 >= n && n > 0 && !heavyLead) flags |= TPL_EXPLOIT;
  if (armorN * 2 >= n && n > 0 && footN * 3 < n) flags |= TPL_BARE_ARMOR;
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
    // alone (how much of the division they are is its hardness: what is soft
    // in a hit goes through it). Pierce is its best gun, ww84; what fights is
    // each band on its own (pierceBands).
    armor:
      armoured === 0
        ? 0
        : Math.floor(
            (30 * armorMax * armoured + 70 * armorSum) / (100 * armoured),
          ),
    pierce: pierceMax,
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
    ...pierceBands(carriers),
    prepFireBp:
      n === 0
        ? 0
        : Math.min(PREP_FIRE_MAX_BP, Math.floor((gunN * 10_000) / (3 * n))),
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
  const act = activeDesignSlots(ks);
  for (let a = 0; a < act.length; a++) {
    const j = act[a];
    have[ks.group[j]] += equip[j] ?? 0;
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
  // ww84: a gun without its crew and gun pierces nothing.
  const bandHard = new Array<number>(s.bandHard.length).fill(0);
  const bp = s.bandParts;
  for (let i = 0; i < bp.length; i += 3) {
    bandHard[bp[i]] += Math.floor((bp[i + 2] * fill[bp[i + 1]]) / 1000);
  }
  return {
    ...s,
    soft,
    hard,
    def,
    brk,
    bandHard,
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
