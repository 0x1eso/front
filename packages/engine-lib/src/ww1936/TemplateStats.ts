// World War 1936 P2: a template's and a division's numbers (P2 spec §4.3,
// §4.4). Pure integer functions: the engine, the AI and the template
// designer call the same ones.
import {
  EQUIP_KEYS,
  EQUIPMENT_TYPES,
  EquipmentType,
  WwOrderBlock,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  BattalionId,
  DivisionStats,
  GROUND_EQUIP_KEYS,
  GROUND_SLOTS,
  TemplateDef,
  TPL_ARMOR_ANY,
  TPL_ARMOR_MAJOR,
  TPL_CAVALRY_MAJOR,
  TPL_INFANTRY_DIV,
  TPL_MARINE_ANY,
  TPL_MARINE_MAJOR,
  TPL_MOTOR_ANY,
  TPL_MOUNTAIN_ANY,
  TPL_MOUNTAIN_MAJOR,
  TPL_PARA_ANY,
  WW_MAX_BATTALIONS,
  WW_MAX_SUPPORT,
  WW_MAX_WIDTH,
  WW_TEMPLATE_NAME_MAX,
} from "@openfront/engine-api/ww1936/LandTypes";
import { BATTALIONS, SUPPORTS } from "./Battalions";
import { unitCostMilli } from "./Equipment";
import { TechTotals } from "./WwTechs";

const TYPE_INDEX: ReadonlyMap<EquipmentType, number> = new Map(
  EQUIPMENT_TYPES.map((t, i) => [t, i]),
);
const T = EQUIPMENT_TYPES.length;
/** EQUIPMENT_TYPES index of each division slot. */
const SLOT_TYPE: readonly number[] = GROUND_EQUIP_KEYS.map(
  (k) => TYPE_INDEX.get(EQUIP_KEYS[k][0])!,
);
/** Generation of each division slot. */
const SLOT_GEN: readonly number[] = GROUND_EQUIP_KEYS.map(
  (k) => EQUIP_KEYS[k][1],
);

/** Average generation ×100 per EQUIPMENT_TYPES index (100 when none). */
export type GenMix = readonly number[];
export const GEN1: GenMix = EQUIPMENT_TYPES.map(() => 100);

const clampGen = (g: number) => Math.max(100, Math.min(300, g));
/** Attack, defence, breakthrough and HP: 100 / 125 / 150 % at gen 1 / 2 / 3. */
export function genStatPct(g: number): number {
  return 100 + Math.floor((clampGen(g) - 100) / 4);
}
/** Armour and pierce: 100 / 140 / 180 %. */
export function genArmorPct(g: number): number {
  return 100 + Math.floor(((clampGen(g) - 100) * 40) / 100);
}

/** A division's generation mix from its 18 slots. */
export function genMixOf(equip: ArrayLike<number>): number[] {
  return genMixInto(new Array<number>(T), equip);
}

const MIX_UNITS: number[] = new Array<number>(T).fill(0);
const MIX_SUM: number[] = new Array<number>(T).fill(0);

/** genMixOf written into `out` (EQUIPMENT_TYPES.length long), without allocating; returns `out`. */
export function genMixInto(out: number[], equip: ArrayLike<number>): number[] {
  const units = MIX_UNITS;
  const sum = MIX_SUM;
  units.fill(0);
  sum.fill(0);
  for (let j = 0; j < GROUND_SLOTS; j++) {
    const i = SLOT_TYPE[j];
    units[i] += equip[j];
    sum[i] += equip[j] * SLOT_GEN[j];
  }
  for (let i = 0; i < T; i++) {
    out[i] = units[i] === 0 ? 100 : Math.floor((sum[i] * 100) / units[i]);
  }
  return out;
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
): DivisionStats {
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
  for (const id of def.battalions) {
    const d = BATTALIONS[id];
    const main = TYPE_INDEX.get(d.equip[0][0])!;
    const g = gens[main];
    const gp = genStatPct(g);
    const ga = genArmorPct(g);
    width += d.width;
    men += d.men;
    hp += Math.floor((d.hpMilli * gp) / 100);
    orgSum += d.orgMilli + (d.kind === "infantry" ? tech.infOrg * 1000 : 0);
    n++;
    hardSum += d.hardnessPm;
    const armor = Math.floor((d.armor * ga) / 100);
    const pierce = Math.floor((d.pierce * ga) / 100);
    armorMax = Math.max(armorMax, armor);
    armorSum += armor;
    pierceMax = Math.max(pierceMax, pierce);
    pierceSum += pierce;
    pierceN++;
    let soft = Math.floor((d.soft * gp) / 100);
    if (d.artillery) {
      soft = Math.floor((soft * (100 + tech.artillerySoftPct)) / 100);
    }
    parts[main * 4] += soft;
    parts[main * 4 + 1] += Math.floor((d.hard * gp) / 100);
    parts[main * 4 + 2] += Math.floor((d.def * gp) / 100);
    parts[main * 4 + 3] += Math.floor((d.brk * gp) / 100);
    // Tanks gain 1 km/h a generation (spec §4.1).
    const sp =
      d.speedCenti +
      (d.kind === "armor" ? Math.floor((clampGen(g) - 100) / 100) * 100 : 0);
    speed = Math.min(speed, sp);
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
  for (const id of def.support) {
    const d = SUPPORTS[id];
    const main = TYPE_INDEX.get(d.equip[0][0])!;
    const gp = genStatPct(gens[main]);
    men += d.men;
    hp += Math.floor((d.hpMilli * gp) / 100);
    let soft = Math.floor((d.soft * gp) / 100);
    if (d.artillery) {
      soft = Math.floor((soft * (100 + tech.artillerySoftPct)) / 100);
    }
    parts[main * 4] += soft;
    parts[main * 4 + 1] += Math.floor((d.hard * gp) / 100);
    parts[main * 4 + 2] += Math.floor((d.def * gp) / 100);
    parts[main * 4 + 3] += Math.floor((d.brk * gp) / 100);
    if (d.pierce > 0) {
      const p = Math.floor((d.pierce * genArmorPct(gens[main])) / 100);
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
    // HOI4: 30% max + 70% average armour, 40% max + 60% average pierce.
    armor:
      n === 0 ? 0 : Math.floor((30 * armorMax * n + 70 * armorSum) / (100 * n)),
    pierce:
      pierceN === 0
        ? 0
        : Math.floor(
            (40 * pierceMax * pierceN + 60 * pierceSum) / (100 * pierceN),
          ),
    hardnessPm: n === 0 ? 0 : Math.floor(hardSum / n),
    speedCenti: n === 0 ? 0 : speed,
    supplyMilli: supply,
    trainDays: train,
    need,
    parts,
    flags,
    special,
    battalions: n,
  };
}

/** Units of each equipment type in a division's 18 slots, EQUIPMENT_TYPES order. */
export function equipByType(equip: ArrayLike<number>): number[] {
  const have = new Array<number>(T).fill(0);
  for (let j = 0; j < GROUND_SLOTS; j++) have[SLOT_TYPE[j]] += equip[j];
  return have;
}

/** Fill of each equipment type, ‰ (1000 when the template needs none). */
export function equipFill(
  s: DivisionStats,
  equip: ArrayLike<number>,
): number[] {
  const have = equipByType(equip);
  return s.need.map((nd, i) =>
    nd === 0 ? 1000 : Math.min(1000, Math.floor((have[i] * 1000) / nd)),
  );
}

/** Spec §4.3: attack and defence values by their equipment's fill, HP by men. */
export function divisionStats(
  s: DivisionStats,
  equip: ArrayLike<number>,
  men: number,
): DivisionStats {
  const fill = equipFill(s, equip);
  const part = (k: number) => {
    let x = 0;
    for (let i = 0; i < T; i++) {
      x += Math.floor((s.parts[i * 4 + k] * fill[i]) / 1000);
    }
    return x;
  };
  const menPm =
    s.men === 0 ? 1000 : Math.min(1000, Math.floor((men * 1000) / s.men));
  return {
    ...s,
    soft: part(0),
    hard: part(1),
    def: part(2),
    brk: part(3),
    hpMilli: Math.floor((s.hpMilli * menPm) / 1000),
  };
}

/** Cost-weighted equipment fill of a division, ‰ (spec §4.3's strength bar, equipment half). */
export function equipFillPm(
  s: DivisionStats,
  equip: ArrayLike<number>,
): number {
  const fill = equipFill(s, equip);
  let w = 0;
  let got = 0;
  EQUIPMENT_TYPES.forEach((t, i) => {
    const c = s.need[i] * unitCostMilli(t, 1);
    w += c;
    got += Math.floor((c * fill[i]) / 1000);
  });
  return w === 0 ? 1000 : Math.floor((got * 1000) / w);
}

/** The strength bar (spec §4.3): min(cost-weighted equipment fill, men fill), ‰. */
export function strengthPm(
  s: DivisionStats,
  equip: ArrayLike<number>,
  men: number,
): number {
  const eq = equipFillPm(s, equip);
  const mp =
    s.men === 0 ? 1000 : Math.min(1000, Math.floor((men * 1000) / s.men));
  return Math.min(eq, mp);
}

function multisetChanges<K extends string>(
  a: readonly K[],
  b: readonly K[],
): number {
  const count = new Map<K, number>();
  for (const x of a) count.set(x, (count.get(x) ?? 0) + 1);
  let added = 0;
  for (const x of b) {
    const c = count.get(x) ?? 0;
    if (c > 0) count.set(x, c - 1);
    else added++;
  }
  let removed = 0;
  for (const c of count.values()) removed += c;
  return Math.max(added, removed);
}

/** Spec §4.4: 5 per battalion added, removed or swapped, 10 per company; the name is free. Army XP milli. */
export function templateXpCost(
  before: TemplateDef | null,
  after: TemplateDef,
): number {
  const b = before ?? { name: "", battalions: [], support: [] };
  return (
    5_000 * multisetChanges(b.battalions, after.battalions) +
    10_000 * multisetChanges(b.support, after.support)
  );
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
