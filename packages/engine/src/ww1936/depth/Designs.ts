// P6 lane E (plan Task 3): designs on equipment slots, their costs, lines
// and stats (spec §5; plan decisions 5–11). A design is a saved DesignDef
// in a country's slot; its numbers come from engine-lib designStats (the
// WwDepth cache). Tank and plane designs are P1 equipment keys
// (tank_design / plane_design, the "generation" being the slot), so the
// stock, lines, divisions and deployments carry them with P1–P4's code; a
// ship design is a ShipTable / NavalLine column.
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import {
  AIR_TYPES,
  AirType,
  PlaneStats,
} from "@openfront/engine-api/ww1936/AirTypes";
import {
  DESIGN_NAME_MAX,
  DESIGN_SLOTS,
  DesignDef,
  DesignKind,
  DesignOrigin,
  KeyStatsTable,
  KS,
  KS_FIELDS,
  MIO_FAMILIES,
  PlaneDesignStats,
  ShipDesignMods,
  TankDesignStats,
  WW_PLANE_DESIGN_SLOTS,
  WW_TANK_DESIGN_SLOTS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  equipKey as designEquipKey,
  EQUIP_KEY_COUNT,
  EQUIP_KEYS,
  EquipmentType,
  WW_TECH_IDS,
  WwOrderBlock,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { GROUND_STATIC_SLOTS } from "@openfront/engine-api/ww1936/LandTypes";
import {
  SHIP_CLASSES,
  SHIP_GENS,
} from "@openfront/engine-api/ww1936/NavyTypes";
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import type {
  WwStatKey,
  WwStats,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  convertCost,
  designBlock,
  designRetentionBp,
  designXpCost,
  licenceCostPct,
  PLANE_BASE_DEFS,
  planeType,
  reliabilityLossBp,
  shipBase,
  shipYear,
  TANK_BASE_DEFS,
  tankRole,
} from "@openfront/engine-lib/ww1936/DesignRules";
import {
  EQUIPMENT,
  unitCostMilli,
} from "@openfront/engine-lib/ww1936/Equipment";
import { mioFamilyOf } from "@openfront/engine-lib/ww1936/MioRules";
import {
  lineCostMilli,
  NavalLineLike,
} from "@openfront/engine-lib/ww1936/NavalLineRules";
import { PLANE_BASE } from "@openfront/engine-lib/ww1936/PlaneStats";
import type { EffectCtx } from "../politics/Dispatch";
import { licenceCostPctFor } from "./Licences";
import { treatyEscalated, treatyMember } from "./NavalTreaty";
import { dailyRefits, startRefit } from "./Refit";
import type { DesignSlot, Domain, WwDepth } from "./WwDepth";

/** Spec §5.1: the experience domain of each design kind (army, navy, air). */
export const DESIGN_DOMAIN: Readonly<Record<DesignKind, Domain>> = {
  tank: 0,
  ship: 1,
  plane: 2,
};

/**
 * Spec §5.5: the airframe size a static P4 type flies on (line conversion).
 * Owner: spec §5.4.2's role table read backwards (lane E's own table; it
 * moves if P4's types or the airframes change).
 */
const PLANE_TYPE_SIZE: Readonly<Record<string, string>> = {
  fighter: "small",
  cv_fighter: "small",
  cas: "small",
  cv_cas: "small",
  naval_bomber: "small",
  cv_naval_bomber: "small",
  heavy_fighter: "medium",
  bomber: "medium",
  transport_plane: "medium",
  strat_bomber: "large",
};

const ALL_TECHS: ReadonlySet<WwTechId> = new Set(WW_TECH_IDS);

/** The design kind of an equipment type (tank_design, plane_design); null for a static type. */
export function designKindOf(type: EquipmentType): "tank" | "plane" | null {
  return type === "tank_design"
    ? "tank"
    : type === "plane_design"
      ? "plane"
      : null;
}

/** The design behind an EQUIP_KEYS index of `id` (null: a static key or an empty slot). */
export function designOfKey(
  d: WwDepth,
  id: number,
  key: number,
): DesignDef | null {
  const k = EQUIP_KEYS[key];
  if (k === undefined) return null;
  const kind = designKindOf(k[0]);
  return kind === null ? null : (d.designSlot(id, kind, k[1])?.def ?? null);
}

/** design_save, design_copy, design_obsolete, design_rename, ship_refit, line_convert. */
export function issueDesign(
  d: WwDepth,
  id: number,
  o: DepthOrder,
  tick: number,
): WwOrderBlock | null {
  const day = d.ww.day(tick);
  switch (o.kind) {
    case "design_save":
      return saveOrder(d, id, o.def, o.slot ?? 0, null, day);
    case "design_copy": {
      if (o.from > DESIGN_SLOTS[o.def.kind]) return "bad_index";
      const from = d.designSlot(id, o.def.kind, o.from);
      if (from === null) return "bad_slot";
      // Spec §5.6: a captured or received design is never reworked.
      if (from.origin === "captured" || from.origin === "received") {
        return "bad_base";
      }
      return saveOrder(d, id, o.def, 0, from.def, day);
    }
    case "design_obsolete": {
      if (o.slot > DESIGN_SLOTS[o.design]) return "bad_index";
      const s = d.designSlot(id, o.design, o.slot);
      if (s === null) return "bad_slot";
      if (!s.obsolete) {
        // Spec §5.1: the flag only; the day's check frees the slot.
        s.obsolete = true;
        d.markDesign(id, o.design, o.slot);
      }
      return null;
    }
    case "design_rename": {
      if (o.slot > DESIGN_SLOTS[o.design]) return "bad_index";
      const s = d.designSlot(id, o.design, o.slot);
      if (s === null) return "bad_slot";
      s.def.name = o.name;
      d.markDesign(id, o.design, o.slot);
      return null;
    }
    case "ship_refit":
      return startRefit(d, id, o.ship, o.slot, tick);
    case "line_convert":
      return convertOrder(d, id, o.line, o.from);
    default:
      return "bad_index";
  }
}

/** design_save / design_copy: spec §5.1's checks in a fixed order, then the save. */
function saveOrder(
  d: WwDepth,
  id: number,
  def: DesignDef,
  slot: number,
  before: DesignDef | null,
  day: number,
): WwOrderBlock | null {
  const ce = d.ww.economy.country(id);
  const c = d.country(id);
  if (ce === null || c === null) return "dead";
  const block = designBlock(def, {
    techs: ce.researched,
    projects: c.proj.done,
    treatyMember: treatyMember(d, id),
    treatyEscalated: treatyEscalated(d),
  });
  if (block !== null) return block;
  const kind = def.kind;
  if (slot !== 0) {
    // (Review E7: "design_in_use" here reads "the slot is taken".)
    if (slot > DESIGN_SLOTS[kind]) return "bad_index";
    if (c.des[kind][slot - 1] !== null) return "design_in_use";
  } else if (freeSlot(d, id, kind) === 0) {
    return "design_slots_full";
  }
  const cost = designXpCost(before, def);
  if (d.xpOf(id, DESIGN_DOMAIN[kind]) < cost) return "no_xp";
  // Review E5: the save first, the experience once it stands.
  const got = saveDesign(d, id, def, slot, "own", 0, 0, day);
  if (typeof got !== "number") return got;
  d.spendXp(id, DESIGN_DOMAIN[kind], cost);
  d.message(id, "ww1936_design_saved", { name: def.name });
  return null;
}

/** The first empty slot (1-based) of a kind; 0 when every slot holds a design (obsolete ones too, as the designer counts). */
export function freeSlot(d: WwDepth, id: number, kind: DesignKind): number {
  const c = d.country(id);
  if (c === null) return 0;
  const i = c.des[kind].indexOf(null);
  return i < 0 ? 0 : i + 1;
}

export function dailyDesigns(d: WwDepth, id: number, day: number): void {
  dailyRefits(d, id, day);
  // Spec §5.1: an obsolete slot nothing holds any more is freed (every 10 days).
  if (day % 10 !== id % 10) return;
  const c = d.country(id);
  if (c === null) return;
  for (const kind of ["tank", "plane", "ship"] as const) {
    const slots = c.des[kind];
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (s === null || !s.obsolete) continue;
      if (designHeld(d, id, kind, i + 1)) continue;
      slots[i] = null;
      d.markDesign(id, kind, i + 1);
    }
  }
}

/**
 * Spec §5.1 / plan Step 6: anything of the country still holds the slot's
 * equipment — the stock, divisions and trainees, deployments and decks
 * (and the deployed ledger), shipments in transit, market listings and
 * open deals, licences it granted, P1 lines; for a ship design its ships
 * (a refit to it too) and naval lines.
 */
export function designHeld(
  d: WwDepth,
  id: number,
  kind: DesignKind,
  slot: number,
): boolean {
  const ce = d.ww.economy.country(id);
  if (ce === null) return false;
  const m = d.market;
  if (kind === "ship") {
    const t = d.ww.navy.ships;
    for (let r = 0; r < t.rows; r++) {
      if (
        t.id[r] !== 0 &&
        t.owner[r] === id &&
        (t.design[r] === slot || t.refitTo[r] === slot)
      ) {
        return true;
      }
    }
    if (ce.navalLines.some((l) => l.design === slot)) return true;
    // Lane M's licence record names the licensor's ship slot in `ship`.
    return m.licences.some((l) => l.from === id && l.ship === slot);
  }
  const type = kind === "tank" ? "tank_design" : "plane_design";
  const key = designEquipKey(type, slot);
  if (ce.stock[key] > 0 || ce.planesDeployed[key] > 0) return true;
  if (ce.lines.some((l) => l.key === key || l.convertFrom === key)) {
    return true;
  }
  if (kind === "tank") {
    const land = d.ww.land;
    const j = GROUND_STATIC_SLOTS + slot - 1;
    for (const r of land.rowsOf(id)) {
      if ((land.divisions.equipOf(r)[j] ?? 0) > 0) return true;
    }
    for (const x of land.country(id)?.trainees ?? []) {
      if ((x.equip[j] ?? 0) > 0) return true;
    }
  } else {
    for (const dep of d.ww.air.deployments.values()) {
      if (dep.owner === id && (dep.dcounts[slot - 1] ?? 0) > 0) return true;
    }
    const t = d.ww.navy.ships;
    for (const f of d.ww.navy.fleetsOf(id)) {
      for (const sid of f.ships) {
        const r = t.rowOf(sid);
        if (r >= 0 && (t.deckDOf(r)[slot - 1] ?? 0) > 0) return true;
      }
    }
  }
  for (const x of d.ww.endgame.inTransit) {
    if ((x.from === id || x.to === id) && x.item === type && x.gen === slot) {
      return true;
    }
  }
  if (m.listings.some((l) => l.seller === id && l.key === key && l.count > 0)) {
    return true;
  }
  // Lane M: a deal's deliveredMilli is the value delivered (of priceMilli).
  if (
    m.deals.some(
      (x) =>
        x.seller === id && x.key === key && x.deliveredMilli < x.priceMilli,
    )
  ) {
    return true;
  }
  return m.licences.some((l) => l.from === id && l.key === key);
}

/**
 * Plan decision 7: the design slots' rows of the country's KeyStatsTable —
 * each tank design's need group, year and battalion-level numbers in KS
 * order; an empty slot keeps group −1.
 */
export function fillDesignRows(d: WwDepth, id: number, t: KeyStatsTable): void {
  for (let s = 1; s <= WW_TANK_DESIGN_SLOTS; s++) {
    const ds = d.designStatsOf(id, "tank", s) as TankDesignStats | null;
    if (ds === null) continue;
    const j = GROUND_STATIC_SLOTS + s - 1;
    const o = j * KS_FIELDS;
    t.group[j] = ds.group;
    t.year[j] = ds.year;
    t.stats[o + KS.soft] = ds.soft;
    t.stats[o + KS.hard] = ds.hard;
    t.stats[o + KS.def] = ds.def;
    t.stats[o + KS.brk] = ds.brk;
    t.stats[o + KS.pierce] = ds.pierce;
    t.stats[o + KS.armor] = ds.armor;
    t.stats[o + KS.hardnessPm] = ds.hardnessPm;
    t.stats[o + KS.speedCenti] = ds.speedCenti;
    t.stats[o + KS.aa] = ds.aa;
    t.stats[o + KS.relPm] = ds.relPm;
    t.stats[o + KS.fuelPct] = ds.fuelPct;
    t.stats[o + KS.orgAdd] = ds.orgAdd;
    t.stats[o + KS.flags] = ds.flags;
  }
}

/** Saves a design into `slot` (1-based; 0: the first free); the slot, or the refusal. */
export function saveDesign(
  d: WwDepth,
  id: number,
  def: DesignDef,
  slot: number,
  origin: DesignOrigin,
  from: number,
  fromSlot: number,
  day: number,
): number | WwOrderBlock {
  const c = d.country(id);
  if (c === null) return "dead";
  const kind = def.kind;
  const s = slot === 0 ? freeSlot(d, id, kind) : slot;
  if (s === 0) return "design_slots_full";
  if (s < 1 || s > DESIGN_SLOTS[kind]) return "bad_index";
  if (c.des[kind][s - 1] !== null) return "design_in_use";
  c.des[kind][s - 1] = {
    def: copyDef(def) as DesignSlot["def"],
    origin,
    from,
    fromSlot,
    obsolete: false,
    savedDay: day,
  };
  d.markDesign(id, kind, s);
  return s;
}

/** A copy of a def (state never shares one with an order or another country). */
export function copyDef(def: DesignDef): DesignDef {
  return { ...def, modules: [...def.modules] };
}

/** Same base, modules and levels (the name aside). */
export function sameDesign(a: DesignDef, b: DesignDef): boolean {
  return (
    a.kind === b.kind &&
    a.base === b.base &&
    (a.armorLevel ?? 0) === (b.armorLevel ?? 0) &&
    (a.engineLevel ?? 0) === (b.engineLevel ?? 0) &&
    a.modules.length === b.modules.length &&
    a.modules.every((x, i) => x === b.modules[i])
  );
}

/**
 * A unit's industry cost, milli, of an EQUIP_KEYS index: a design slot's
 * designStats cost (its MIO cost is inside, plan decision 11), a static
 * key P1's table × its family's MIO cost; a licence adds its surcharge
 * (lane M's licenceCostPctFor, pre-flight A8: 0 without a licence).
 */
export function equipCostMilli(d: WwDepth, id: number, key: number): number {
  const [type, gen] = EQUIP_KEYS[key];
  const kind = designKindOf(type);
  let cost: number;
  if (kind !== null) {
    const s = d.designStatsOf(id, kind, gen) as
      | TankDesignStats
      | PlaneDesignStats
      | null;
    cost = s?.costMilli ?? 0;
  } else {
    cost = unitCostMilli(type, gen);
    const f = mioFamilyOf(type);
    const pct =
      f < 0
        ? 0
        : (statsOf(d, id)[
            `mioCostPct_${MIO_FAMILIES[f].slice(4)}` as WwStatKey
          ] ?? 0);
    if (pct !== 0) cost = Math.floor((cost * Math.max(10, 100 + pct)) / 100);
  }
  // Lane M (pre-flight A8): the licence surcharge, percent.
  const lic = licenceCostPctFor(d, id, key);
  return lic === 0 ? cost : Math.floor((cost * (100 + lic)) / 100);
}

/**
 * Spec §5.3.4, §6, §7.1 — a naval line's unit cost, naval industry milli:
 * P4's (lineCostMilli) × (100 + the line's ship design's module cost
 * percent) / 100 × the naval MIO cost, and for a licensed ship design the
 * licence surcharge (shipLicenceCostPct). P4's NavalLines.stepNavalLines
 * and the naval line view read it (review E3).
 */
export function navalLineCostMilli(
  d: WwDepth,
  id: number,
  line: NavalLineLike & { design: number },
): number {
  let cost = lineCostMilli(line);
  const mods =
    line.cls < SHIP_CLASSES.length ? shipDesignOf(d, id, line.design) : null;
  if (mods !== null && mods.costPct !== 0) {
    cost = Math.floor((cost * Math.max(10, 100 + mods.costPct)) / 100);
  }
  const mio = statsOf(d, id)["mioCostPct_naval" as WwStatKey] ?? 0;
  if (mio !== 0) cost = Math.floor((cost * Math.max(10, 100 + mio)) / 100);
  const lic =
    line.cls < SHIP_CLASSES.length ? shipLicenceCostPct(d, id, line.design) : 0;
  return lic === 0 ? cost : Math.floor((cost * (100 + lic)) / 100);
}

/**
 * Lane M's licence rule (licenceCostPct of the item's year over the
 * newest year of the licensee's own line, 1936 at least) for a ship
 * design, which has no EQUIP_KEYS key. Owner: lane M's
 * Licences.licenceCostPctFor / lineNewestYear (a copy for ships; change
 * both together, review E12): a "licensed" slot only; its hull
 * year over the newest generation of the class the licensee researched
 * or designed itself.
 */
export function shipLicenceCostPct(
  d: WwDepth,
  id: number,
  design: number,
): number {
  const s = design > 0 ? d.designSlot(id, "ship", design) : null;
  if (s === null || s.origin !== "licensed") return 0;
  const sb = shipBase(s.def.base);
  if (sb === null) return 0;
  const done = d.ww.economy.country(id)?.researched;
  let own = 1936;
  for (let g = 1; g <= SHIP_GENS[sb.cls]; g++) {
    if (g === 1 || done?.has(`${sb.cls}_${g}` as WwTechId) === true) {
      own = Math.max(own, shipYear(sb.cls, g));
    }
  }
  d.country(id)?.des.ship.forEach((x) => {
    const b = x !== null && x.origin === "own" ? shipBase(x.def.base) : null;
    if (b !== null && b.cls === sb.cls)
      own = Math.max(own, shipYear(b.cls, b.gen));
  });
  return licenceCostPct(shipYear(sb.cls, sb.gen) - own);
}

function statsOf(d: WwDepth, id: number): Partial<Record<WwStatKey, number>> {
  return (d.ww.economy.country(id)?.stats ?? {}) as Partial<
    Record<WwStatKey, number>
  >;
}

/**
 * P1's AI shares (review E4): the static type a design key counts as — a
 * light-chassis tank: light tanks, any other tank (heavy ones too):
 * medium tanks (as light lines count as medium once mediums exist); a
 * tank destroyer, self-propelled gun or anti-air its role's own share
 * (anti-tank, artillery, anti-air: the static equipment it stands for,
 * spec §5.6's nearest static); a plane design: the P4 type it flies as;
 * null for a static key or an empty slot.
 */
export function designShareType(
  d: WwDepth,
  id: number,
  key: number,
): EquipmentType | null {
  const def = designOfKey(d, id, key);
  if (def === null) return null;
  if (def.kind === "plane") {
    const t = planeType(def);
    return (AIR_TYPES as readonly string[]).includes(t)
      ? (t as AirType)
      : "fighter";
  }
  switch (tankRole(def)) {
    case "tank_destroyer":
      return "anti_tank";
    case "sp_artillery":
      return "artillery";
    case "sp_anti_air":
      return "anti_air";
    default:
      return TANK_BASE_DEFS[def.base]?.weight === "light"
        ? "light_tank"
        : "medium_tank";
  }
}

/** Resources per factory (RESOURCE_IDS order) of an EQUIP_KEYS index: a design's, else P1's table. */
export function equipResources(d: WwDepth, id: number, key: number): number[] {
  const [type, gen] = EQUIP_KEYS[key];
  const kind = designKindOf(type);
  if (kind === null) return [...EQUIPMENT[type].resources];
  const s = d.designStatsOf(id, kind, gen) as
    | TankDesignStats
    | PlaneDesignStats
    | null;
  return s === null ? [...EQUIPMENT[type].resources] : [...s.resources];
}

/**
 * Spec §5.5: the efficiency a line keeps switching keys, bp — two designs
 * by designRetentionBp (same base 90%, same role 60%); a static light or
 * medium tank and a tank design on a chassis of that weight 60%; plus the
 * country's retentionBp as P1 adds it (at most 100%); −1: P1's rule.
 */
export function lineRetentionBp(
  d: WwDepth,
  id: number,
  fromKey: number,
  toKey: number,
): number {
  const a = designOfKey(d, id, fromKey);
  const b = designOfKey(d, id, toKey);
  let base: number;
  if (a !== null && b !== null) {
    base = designRetentionBp(a, b);
  } else {
    const des = a ?? b;
    if (des === null || des.kind !== "tank") return -1;
    const st = EQUIP_KEYS[a === null ? fromKey : toKey][0];
    const w = TANK_BASE_DEFS[des.base]?.weight;
    const same =
      (st === "light_tank" && w === "light") ||
      (st === "medium_tank" && w === "medium");
    base = same && tankRole(des) === "tank" ? 6_000 : -1;
  }
  if (base < 0) return -1;
  // Review E13: P1's retention techs add to every switch (effAfterSwitch).
  const bonus = d.ww.economy.country(id)?.stats.retentionBp ?? 0;
  return Math.min(10_000, base + bonus);
}

/**
 * Spec §5.5: a converted unit's cost on a converting line, milli —
 * convertCost(new, old) while the stock holds the line's `convertFrom`;
 * null: the full cost (P1's production).
 */
export function conversionCostMilli(
  d: WwDepth,
  id: number,
  lineId: number,
  newKey: number,
): number | null {
  const ce = d.ww.economy.country(id);
  const line = ce?.lines.find((l) => l.id === lineId);
  if (ce === null || line === undefined || line.convertFrom < 0) return null;
  if ((ce.stock[line.convertFrom] ?? 0) <= 0) return null;
  return convertCost(
    equipCostMilli(d, id, newKey),
    equipCostMilli(d, id, line.convertFrom),
  );
}

/**
 * line_convert (spec §5.5): the line makes its design out of `from` units
 * taken from the stock — a tank design from a tank design or a static
 * light or medium tank, a plane design from a design or a static type of
 * the same airframe size; null stops converting.
 */
function convertOrder(
  d: WwDepth,
  id: number,
  lineId: number,
  from: number | null,
): WwOrderBlock | null {
  const ce = d.ww.economy.country(id);
  if (ce === null) return "dead";
  const line = ce.lines.find((l) => l.id === lineId);
  if (line === undefined) return "bad_line";
  if (from === null) {
    line.convertFrom = -1;
    return null;
  }
  if (!(from >= 0 && from < EQUIP_KEY_COUNT)) return "bad_index";
  if (from === line.key || !convertible(d, id, line.key, from)) {
    return "bad_line";
  }
  line.convertFrom = from;
  return null;
}

/** Spec §5.5: `from` units may be rebuilt into the design of `key` (same family; planes: same airframe size). */
export function convertible(
  d: WwDepth,
  id: number,
  key: number,
  from: number,
): boolean {
  const to = designOfKey(d, id, key);
  if (to === null) return false;
  const ft = EQUIP_KEYS[from][0];
  const fd = designOfKey(d, id, from);
  if (designKindOf(ft) !== null && fd === null) return false;
  if (to.kind === "tank") {
    return fd !== null
      ? fd.kind === "tank"
      : ft === "light_tank" || ft === "medium_tank";
  }
  const size = PLANE_BASE_DEFS[to.base]?.size;
  if (fd !== null) {
    return fd.kind === "plane" && PLANE_BASE_DEFS[fd.base]?.size === size;
  }
  return PLANE_TYPE_SIZE[ft] === size;
}

/** Plan decision 8: a ship design's modifiers (design 0: none). */
export function shipDesignOf(
  d: WwDepth,
  owner: number,
  design: number,
): ShipDesignMods | null {
  if (design <= 0) return null;
  return d.designStatsOf(owner, "ship", design) as ShipDesignMods | null;
}

/** Per WwDepth (derived): owner × 32 + slot → the plane design numbers with the country's stats. */
const PLANE_MEMO = new WeakMap<
  WwDepth,
  Map<number, { base: PlaneDesignStats; statsVer: number; s: PlaneDesignStats }>
>();

/**
 * Plan decision 9: a plane design key's numbers (static keys: null), with
 * the country's air percentages applied the way P4's planeStats applies
 * them to a static type (plan decision 11: the country's modifiers enter
 * once, at the deployment's stage) — air attack, air defence, agility and
 * naval attack. Memoised on the design cache entry and the stats version.
 */
export function planeStatsOfKey(
  d: WwDepth,
  id: number,
  key: number,
): PlaneDesignStats | null {
  const k = EQUIP_KEYS[key];
  if (k === undefined || k[0] !== "plane_design") return null;
  const base = d.designStatsOf(id, "plane", k[1]) as PlaneDesignStats | null;
  if (base === null) return null;
  const ce = d.ww.economy.country(id);
  if (ce === null) return base;
  let memo = PLANE_MEMO.get(d);
  if (memo === undefined) PLANE_MEMO.set(d, (memo = new Map()));
  const mk = id * 32 + k[1];
  const hit = memo.get(mk);
  if (hit !== undefined && hit.base === base && hit.statsVer === ce.statsVer) {
    return hit.s;
  }
  const s = withAirStats(base, ce.stats);
  memo.set(mk, { base, statsVer: ce.statsVer, s });
  return s;
}

/**
 * PlaneStats.planeStats's percent lines on a design's numbers (no
 * generation: the design is the model). Owner: P4's planeStats — a copy
 * of its atk/def/agi/naval percent lines; change both together (review E12).
 */
function withAirStats(b: PlaneDesignStats, st: WwStats): PlaneDesignStats {
  const t = b.type as AirType;
  const fighterLike = t === "fighter" || t === "cv_fighter";
  const atk = 100 + st.airAttackPct + (fighterLike ? st.fighterAttackPct : 0);
  const def =
    100 +
    st.airDefensePct +
    (t === "heavy_fighter" || t === "strat_bomber" ? st.heavyDefensePct : 0);
  const agi =
    100 +
    st.airAgilityPct +
    (PLANE_BASE[t]?.fighter === true ? st.fighterAgilityPct : 0);
  const nav =
    100 +
    st.airNavalPct +
    (t === "naval_bomber" || t === "cv_naval_bomber" ? st.navalBomberPct : 0);
  if (atk === 100 && def === 100 && agi === 100 && nav === 100) return b;
  const pct = (v: number, x: number) => Math.floor((v * Math.max(10, x)) / 100);
  return {
    ...b,
    airAttack: pct(b.airAttack, atk),
    airDefense: pct(b.airDefense, def),
    agility: Math.max(1, pct(b.agility, agi)),
    naval: pct(b.naval, nav),
  };
}

/**
 * Plan decision 9 / spec §5.4.2: a plane design as the P4 type it flies
 * as. Air attack and defence, agility, speed, range and the ground,
 * strategic and naval attacks are the design's; the superiority weight
 * follows the type's P4 rule on them ((attack + defence) / 3 for a fighter
 * type, else 100); fuel a sortie is the type's generation-1 fuel × the
 * design's cost / the type's cost (a jet × 1.6). Reliability is no P4
 * number: the loss reads take PlaneDesignStats.relPm (reliabilityLossBp).
 */
export function designPlaneAsP4(s: PlaneDesignStats, type: string): PlaneStats {
  const t = (AIR_TYPES as readonly string[]).includes(type)
    ? (type as AirType)
    : (s.type as AirType);
  const p = PLANE_BASE[t];
  const fuel0 = p.fuel * 100;
  const byCost = Math.floor(
    (fuel0 * Math.max(1, s.costMilli)) / Math.max(1, unitCostMilli(t, 1)),
  );
  return {
    airAtk: s.airAttack,
    airDef: s.airDefense,
    agility: s.agility,
    speedKmh: s.speed,
    rangeKm: s.range,
    ground: s.ground,
    strat: s.strategic,
    naval: s.naval,
    supWeightMilli: p.fighter
      ? Math.floor((s.airAttack + s.airDefense) / 3)
      : 100,
    fuelPerSortieMilli: Math.max(
      1,
      Math.floor((byCost * (100 + s.fuelPct)) / 100),
    ),
  };
}

/**
 * naval_line_add with a design (spec §5.3.4, §13.3): the slot holds a
 * design of that class and generation, the country's own or licensed and
 * not obsolete ("bad_line"); a treaty member's battleship or battlecruiser
 * design with the main battery upgrade (before the escalator) or the
 * super-heavy hull is "treaty_limit".
 */
export function navalLineDesignBlock(
  d: WwDepth,
  id: number,
  cls: number,
  gen: number,
  design: number,
): WwOrderBlock | null {
  if (design === 0) return null;
  const s = d.designSlot(id, "ship", design);
  if (s === null || s.obsolete) return "bad_line";
  if (s.origin !== "own" && s.origin !== "licensed") return "bad_line";
  const sb = shipBase(s.def.base);
  if (sb === null || sb.cls !== SHIP_CLASSES[cls] || sb.gen !== gen) {
    return "bad_line";
  }
  return shipTreatyBlock(d, id, s.def);
}

/**
 * Spec §13.3, the one treaty check of a ship design in use (a line, a
 * refit, the AI's line choice; designBlock holds it at the save): a
 * treaty member's battleship or battlecruiser design with the super-heavy
 * hull, or with the main battery upgrade before the escalator, is
 * "treaty_limit" — however the design came (saved, granted, licensed).
 */
export function shipTreatyBlock(
  d: WwDepth,
  id: number,
  def: { base: string; modules: readonly string[] },
): WwOrderBlock | null {
  const sb = shipBase(def.base);
  if (sb === null || (sb.cls !== "bb" && sb.cls !== "bc")) return null;
  if (!treatyMember(d, id)) return null;
  if (def.modules.includes("shbb_hull")) return "treaty_limit";
  if (!treatyEscalated(d) && def.modules.includes("main_heavy")) {
    return "treaty_limit";
  }
  return null;
}

/** "@" + a preset id, within the name's 24 characters (DesignNameSchema: the snapshot checks it). */
export function presetName(id: string): string {
  return `@${id}`.slice(0, DESIGN_NAME_MAX);
}

/**
 * The design_grant effect (spec §18.3): K5's AI_DESIGN_PRESETS[preset]
 * into the actor's first free slot, free of experience, origin "own",
 * named "@" + the preset id (the screen draws its automatic name). An
 * unknown or malformed preset, or full slots, give nothing.
 */
export function grantDesign(
  ctx: EffectCtx,
  e: Extract<Effect, { kind: "design_grant" }>,
  actor: number,
): void {
  const d = ctx.pol.ww.depth as WwDepth | undefined;
  if (d === undefined || d.country(actor) === null) return;
  const p = ctx.pol.content.aiDesignPresets.find((x) => x.id === e.preset);
  if (p === undefined) return;
  const def = { ...p.def, name: presetName(p.id) } as DesignDef;
  const bad = designBlock(def, {
    techs: ALL_TECHS,
    projects: -1,
    treatyMember: false,
    treatyEscalated: true,
  });
  if (bad !== null) return;
  saveDesign(d, actor, def, 0, "own", 0, 0, ctx.day);
}

/**
 * Review E6: units of a design in use (the designer's "in use"): a tank
 * design's units in the country's divisions, trainees and stock, a plane
 * design's in the stock and deployed (deployments and decks), a ship
 * design's ships (a refit to it counts).
 */
export function designInUse(
  d: WwDepth,
  id: number,
  kind: "tank" | "ship" | "plane",
  slot: number,
): number {
  const ce = d.ww.economy.country(id);
  if (kind === "ship") {
    const t = d.ww.navy.ships;
    let n = 0;
    for (let r = 0; r < t.rows; r++) {
      if (
        t.id[r] !== 0 &&
        t.owner[r] === id &&
        (t.design[r] === slot || t.refitTo[r] === slot)
      ) {
        n++;
      }
    }
    return n;
  }
  if (kind === "plane") {
    const k = designEquipKey("plane_design", slot);
    return (ce?.stock[k] ?? 0) + (ce?.planesDeployed[k] ?? 0);
  }
  const land = d.ww.land;
  const j = GROUND_STATIC_SLOTS + slot - 1;
  let n = ce?.stock[designEquipKey("tank_design", slot)] ?? 0;
  for (const r of land.rowsOf(id)) n += land.divisions.equipOf(r)[j] ?? 0;
  for (const x of land.country(id)?.trainees ?? []) n += x.equip[j] ?? 0;
  return n;
}

// ---- T1b's plane-design helpers (review E, deferred sites: P4 deploy, decks, losses) ----

/**
 * The plane design slots (1-based) whose design flies as P4 `type`, in
 * the draw order (spec §5.4.2: the newest year first, then the lower
 * slot). Captured and received designs fly too; obsolete ones still do.
 */
export function planeDesignSlotsOf(
  d: WwDepth,
  owner: number,
  type: string,
): number[] {
  const out: [number, number][] = [];
  for (let s = 1; s <= WW_PLANE_DESIGN_SLOTS; s++) {
    const st = d.designStatsOf(owner, "plane", s) as PlaneDesignStats | null;
    if (st !== null && st.type === type) out.push([s, st.year]);
  }
  return out.sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([s]) => s);
}

/**
 * Takes up to `n` design planes of P4 `type` from the stock onto the
 * deployed ledger (P1's drawPlanes for design slots), newest first;
 * returns the planes taken per design slot (WW_PLANE_DESIGN_SLOTS long,
 * a Deployment.dcounts / deckD shape).
 */
export function drawDesignPlanes(
  d: WwDepth,
  owner: number,
  type: string,
  n: number,
): number[] {
  const got = new Array<number>(WW_PLANE_DESIGN_SLOTS).fill(0);
  const ce = d.ww.economy.country(owner);
  if (ce === null) return got;
  let left = Math.max(0, Math.floor(n));
  for (const s of planeDesignSlotsOf(d, owner, type)) {
    if (left <= 0) break;
    const k = designEquipKey("plane_design", s);
    const take = Math.min(left, ce.stock[k]);
    if (take <= 0) continue;
    ce.stock[k] -= take;
    ce.planesDeployed[k] += take;
    got[s - 1] = take;
    left -= take;
  }
  return got;
}

/** Design planes back to the stock (a recall, a lost base, a deck's surplus): P1's returnPlanes for design slots. */
export function returnDesignPlanes(
  d: WwDepth,
  owner: number,
  counts: ArrayLike<number>,
): void {
  const ce = d.ww.economy.country(owner);
  if (ce === null) return;
  for (let s = 0; s < counts.length; s++) {
    const c = counts[s];
    if (c <= 0) continue;
    const k = designEquipKey("plane_design", s + 1);
    const back = Math.min(c, ce.planesDeployed[k]);
    ce.planesDeployed[k] -= back;
    ce.stock[k] += back;
  }
}

/** Design planes lost: off the deployed ledger only (P1's losePlanes for design slots). */
export function loseDesignPlanes(
  d: WwDepth,
  owner: number,
  counts: ArrayLike<number>,
): void {
  const ce = d.ww.economy.country(owner);
  if (ce === null) return;
  for (let s = 0; s < counts.length; s++) {
    const c = counts[s];
    if (c <= 0) continue;
    const k = designEquipKey("plane_design", s + 1);
    ce.planesDeployed[k] = Math.max(0, ce.planesDeployed[k] - c);
  }
}

/**
 * A design slot's planes as the deployment's P4 type flies them
 * (designPlaneAsP4 of planeStatsOfKey: the design's numbers with the
 * country's air percentages); null for an empty slot.
 */
export function designPlaneP4(
  d: WwDepth,
  owner: number,
  slot: number,
  type: string,
): PlaneStats | null {
  const s = planeStatsOfKey(d, owner, designEquipKey("plane_design", slot));
  return s === null ? null : designPlaneAsP4(s, type);
}

/** Spec §5.4.2: a design slot's planes' loss multiplier, bp (reliabilityLossBp; 10000 for an empty slot). */
export function designPlaneLossBp(
  d: WwDepth,
  owner: number,
  slot: number,
): number {
  const s = d.designStatsOf(owner, "plane", slot) as PlaneDesignStats | null;
  return s === null ? 10_000 : reliabilityLossBp(s.relPm);
}
