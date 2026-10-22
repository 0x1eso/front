// P6 lane E (plan Task 3): designs crossing between countries (spec §5.6,
// §26: the one path). The same slot number names another design in every
// country, so capture (P5), lend-lease (P5), the arms market and licences
// (M) and stolen blueprints (I) all carry a design key through
// receiveKey: the design is copied into the receiver's slots (once per
// original design), or, with no slot free, the nearest static equipment
// stands in.
import type { AirType } from "@openfront/engine-api/ww1936/AirTypes";
import { AIR_TYPES } from "@openfront/engine-api/ww1936/AirTypes";
import type {
  DesignDef,
  DesignKind,
  DesignOrigin,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  EQUIP_KEYS,
  equipKey,
  EQUIPMENT_GENS,
  EquipmentType,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_EQUIP_KEYS,
  GROUND_SLOTS,
  GROUND_STATIC_SLOTS,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  planeType,
  TANK_BASE_DEFS,
  tankRole,
} from "@openfront/engine-lib/ww1936/DesignRules";
import { EQUIPMENT } from "@openfront/engine-lib/ww1936/Equipment";
import { planeGenTechs } from "@openfront/engine-lib/ww1936/PlaneStats";
import { designKindOf, sameDesign, saveDesign } from "./Designs";
import type { WwDepth } from "./WwDepth";

/** A copy's standing: a licence may be produced, a received design sold on, a captured one only used. */
const ORIGIN_RANK: Readonly<Record<DesignOrigin, number>> = {
  captured: 0,
  received: 1,
  licensed: 2,
  own: 3,
};

/**
 * Copies `from`'s design in `slot` into `to` (spec §5.6): the slot of `to`
 * that already holds the same original design (same original country and
 * slot, same fitting) — its origin raised to `origin` when that allows
 * more (a licence over a captured copy) — or the design itself when `to`
 * is its designer; else the first free slot, the name kept, `origin`, the
 * original (country, slot) as its source, not obsolete. Null: no design
 * there, or no free slot.
 */
export function copyDesignTo(
  d: WwDepth,
  from: number,
  slot: number,
  kind: DesignKind,
  to: number,
  origin: DesignOrigin,
): number | null {
  const src = d.designSlot(from, kind, slot);
  const dst = d.country(to);
  if (src === null || dst === null) return null;
  // The original design: a copy points at its designer's slot.
  const own = src.origin === "own";
  const orig = own ? from : src.from;
  const origSlot = own ? slot : src.fromSlot;
  if (to === orig) {
    const mine = d.designSlot(to, kind, origSlot);
    if (mine !== null && mine.origin === "own" && sameDesign(mine.def, src.def))
      return origSlot;
  }
  const slots = dst.des[kind];
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (
      s === null ||
      s.origin === "own" ||
      s.from !== orig ||
      s.fromSlot !== origSlot ||
      !sameDesign(s.def, src.def)
    ) {
      continue;
    }
    if (ORIGIN_RANK[origin] > ORIGIN_RANK[s.origin]) {
      s.origin = origin;
      d.markDesign(to, kind, i + 1);
    }
    return i + 1;
  }
  const got = saveDesign(
    d,
    to,
    src.def,
    0,
    origin,
    orig,
    origSlot,
    Math.max(0, d.lastCommonDay),
  );
  return typeof got === "number" ? got : null;
}

/**
 * The key `to` receives equipment of `from`'s `key` as (capture,
 * lend-lease, the market, a licence); −1: lost (an empty design slot). A
 * static key stays; a design key becomes `to`'s copy of the design, or,
 * with no slot free, the nearest static equipment (spec §5.6): a tank its
 * weight's static tank (a heavy one the medium tank), a tank destroyer
 * the anti-tank gun, self-propelled guns the artillery or anti-air gun, a
 * plane its P4 type — each at the newest generation `to` has researched
 * (generation 1 without one).
 */
export function receiveKey(
  d: WwDepth,
  from: number,
  key: number,
  to: number,
  origin: DesignOrigin,
): number {
  const k = EQUIP_KEYS[key];
  if (k === undefined) return -1;
  const [type, slot] = k;
  const kind = designKindOf(type);
  if (kind === null) return key;
  const def = d.designSlot(from, kind, slot)?.def ?? null;
  if (def === null) return -1;
  const s = copyDesignTo(d, from, slot, kind, to, origin);
  if (s !== null) return equipKey(type, s);
  const st = nearestStatic(def);
  return equipKey(st, newestGen(d, to, st));
}

/** Spec §5.6: the static equipment nearest a design. */
export function nearestStatic(def: DesignDef): EquipmentType {
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

/** The newest generation of `type` the country has researched; 1 without one. */
export function newestGen(d: WwDepth, id: number, type: EquipmentType): number {
  const done = d.ww.economy.country(id)?.researched;
  if (done === undefined) return 1;
  const air = (AIR_TYPES as readonly string[]).includes(type);
  for (let g = EQUIPMENT_GENS[type]; g > 1; g--) {
    const techs: readonly WwTechId[] = air
      ? planeGenTechs(type as AirType, g)
      : [EQUIPMENT[type].techs[g - 1]];
    if (techs.every((t) => t !== undefined && done.has(t))) return g;
  }
  return 1;
}

// ---- Spec §26 risk 1: units changing owner carry their designs (review E1) ----

/**
 * A ground equipment vector (GROUND_SLOTS: a division's or a trainee's) of
 * `from`'s going to `to`: each tank design slot's units move to `to`'s
 * copy of the design (receiveKey), or to the nearest static slot; units
 * of a design `from` no longer has are lost. Static slots stay.
 */
export function remapGroundSlots(
  d: WwDepth,
  slots: number[] | Int32Array,
  from: number,
  to: number,
  origin: DesignOrigin,
): void {
  if (from === to) return;
  let moves: [number, number][] | null = null;
  for (let j = GROUND_STATIC_SLOTS; j < GROUND_SLOTS; j++) {
    const n = slots[j] ?? 0;
    if (n <= 0) continue;
    const k = receiveKey(d, from, GROUND_EQUIP_KEYS[j], to, origin);
    const j2 = k < 0 ? -1 : GROUND_EQUIP_KEYS.indexOf(k);
    (moves ??= []).push([j2, n]);
    slots[j] = 0;
  }
  // (After the whole pass: a slot may receive what another one gave up.)
  for (const [j2, n] of moves ?? []) if (j2 >= 0) slots[j2] += n;
}

/** A division of `from`'s about to become `to`'s (P3 annexation): its design slots remapped. */
export function receiveDivision(
  d: WwDepth,
  row: number,
  from: number,
  to: number,
  origin: DesignOrigin = "received",
): void {
  const land = d.ww.land;
  const equip = land.divisions.equipOf(row);
  let any = false;
  for (let j = GROUND_STATIC_SLOTS; j < GROUND_SLOTS && !any; j++) {
    any = equip[j] > 0;
  }
  if (!any) return;
  remapGroundSlots(d, equip, from, to, origin);
  land.touchDivision(row);
}

/**
 * P3's merge of an annexed country's stockpile: every key of `from`'s
 * stock into `to`'s, a design key through receiveKey (a copy of the
 * design, or the nearest static key; lost when `from` no longer has it).
 */
export function receiveStock(
  d: WwDepth,
  from: number,
  to: number,
  origin: DesignOrigin = "received",
): void {
  const src = d.ww.economy.country(from);
  const dst = d.ww.economy.country(to);
  if (src === null || dst === null || from === to) return;
  for (let i = 0; i < src.stock.length; i++) {
    const n = src.stock[i];
    if (n === 0) continue;
    src.stock[i] = 0;
    const k = n > 0 ? receiveKey(d, from, i, to, origin) : i;
    if (k >= 0) dst.stock[k] += n;
  }
}

/**
 * A ship row of `from`'s becoming `to`'s (P4 transferShip / transferUnits,
 * after its owner changed): its design becomes `to`'s copy of it (the
 * base class with no slot free); a refit in hand is dropped (`to` never
 * ordered it).
 */
export function receiveShip(
  d: WwDepth,
  row: number,
  from: number,
  to: number,
  origin: DesignOrigin = "received",
): void {
  const t = d.ww.navy.ships;
  if (from === to) return;
  const was = t.design[row];
  t.design[row] =
    was === 0 ? 0 : (copyDesignTo(d, from, was, "ship", to, origin) ?? 0);
  t.refitTo[row] = 0;
  t.refitLeft[row] = 0;
  if (t.design[row] !== was) {
    // A different hull's numbers: no more HP than the new maximum.
    const max = d.ww.navy.shipStatsOf(row).hpMilli;
    if (t.hp[row] > max) t.hp[row] = max;
  }
}

/**
 * A ship's deck design planes back to its owner's stock (P4's returnDeck
 * for the static deck slots): the deployed ledger and the stock, so the
 * planes follow the stock's own path (P3's merge remaps them).
 */
export function returnDeckDesigns(
  d: WwDepth,
  owner: number,
  row: number,
): void {
  const ce = d.ww.economy.country(owner);
  if (ce === null) return;
  const deck = d.ww.navy.ships.deckDOf(row);
  for (let s = 0; s < deck.length; s++) {
    const n = deck[s];
    if (n <= 0) continue;
    const k = equipKey("plane_design", s + 1);
    const back = Math.min(n, ce.planesDeployed[k]);
    ce.planesDeployed[k] -= back;
    ce.stock[k] += back;
    deck[s] = 0;
  }
}
