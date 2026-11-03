// Plane design reform: one design per cell, a cell being a plane type
// (planeType) x an airframe (def.base). Saving a plane design into a cell
// makes everything the country holds in that cell that design at once and
// free (stock, wings, carrier decks, lines); the first save also absorbs
// the matching static planes (staticPartnerOfCell). Ship designs are not
// cells. The tank version is DesignCells.ts.
import {
  AIR_TYPES,
  CARRIER_AIR_TYPES,
} from "@openfront/engine-api/ww1936/AirTypes";
import type { DesignDef } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  equipKey,
  type EquipmentType,
  type WwOrderBlock,
  type WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  PLANE_BASE_DEFS,
  planeType,
} from "@openfront/engine-lib/ww1936/DesignRules";
import { staticPartnerOfCell } from "@openfront/engine-lib/ww1936/PlaneScore";
import { planeDesignIsOld } from "../air/DesignPlanes";
import { changeLine } from "../economy/Production";
import { copyDef, designHeld, freeSlot, saveDesign } from "./Designs";
import type { WwDepth } from "./WwDepth";

/** Two plane designs fill the same cell: the same plane type on the same airframe. */
export function sameCell(a: DesignDef, b: DesignDef): boolean {
  return a.base === b.base && planeType(a) === planeType(b);
}

/** The country's own-origin plane design slots (1-based) in the cell of `def`, ascending. */
export function ownPlaneCellSlots(
  d: WwDepth,
  id: number,
  def: DesignDef,
): number[] {
  const out: number[] = [];
  d.country(id)?.des.plane.forEach((s, i) => {
    if (s !== null && s.origin === "own" && sameCell(s.def, def)) {
      out.push(i + 1);
    }
  });
  return out;
}

/** The EQUIP_KEYS index of the static plane a design's cell absorbs; -1: none. */
export function staticKeyOfPlaneCell(def: DesignDef): number {
  if (def.kind !== "plane") return -1;
  const p = staticPartnerOfCell(planeType(def), def.base);
  return p === null ? -1 : equipKey(p.type, p.gen);
}

/** What moves into design slot `slot`: a static generation, or another design slot (a legacy duplicate). */
type From = { type: EquipmentType; gen: number } | { slot: number };

/**
 * Moves everything the country holds of `from` to design slot `slot`, count
 * for count: the stock and the deployed ledger (planes out on a mission are
 * in a wing's counts and on the ledger, so they move with it), the wings'
 * and carrier decks' planes (a carrier wing's record mirrors its deck and
 * moves with it), and the lines making it (changeLine: the existing
 * retention rule).
 */
function movePlanes(d: WwDepth, id: number, from: From, slot: number): void {
  const ce = d.ww.economy.country(id);
  if (ce === null) return;
  const isStatic = "type" in from;
  const fk = isStatic
    ? equipKey(from.type, from.gen)
    : equipKey("plane_design", from.slot);
  const tk = equipKey("plane_design", slot);
  if (fk === tk) return;
  ce.stock[tk] += ce.stock[fk];
  ce.stock[fk] = 0;
  ce.planesDeployed[tk] += ce.planesDeployed[fk];
  ce.planesDeployed[fk] = 0;
  const air = d.ww.air;
  const ti = isStatic
    ? AIR_TYPES.indexOf(from.type as (typeof AIR_TYPES)[number])
    : -1;
  for (const w of air.wings.values()) {
    if (w.owner !== id) continue;
    if (isStatic) {
      if (w.type !== ti) continue;
      const n = w.counts[from.gen - 1] ?? 0;
      if (n === 0) continue;
      w.counts[from.gen - 1] -= n;
      w.dcounts[slot - 1] += n;
    } else {
      const n = w.dcounts[from.slot - 1] ?? 0;
      if (n === 0) continue;
      w.dcounts[from.slot - 1] -= n;
      w.dcounts[slot - 1] += n;
    }
    air.markWing(w.id);
  }
  const navy = d.ww.navy;
  const t = navy.ships;
  const ty = isStatic
    ? CARRIER_AIR_TYPES.indexOf(from.type as (typeof CARRIER_AIR_TYPES)[number])
    : -1;
  for (const f of navy.fleetsOf(id)) {
    for (const sid of f.ships) {
      const r = t.rowOf(sid);
      if (r < 0) continue;
      const dd = t.deckDOf(r);
      let n = 0;
      if (isStatic) {
        if (ty < 0) continue;
        const deck = t.deckOf(r);
        n = deck[ty * 3 + from.gen - 1];
        deck[ty * 3 + from.gen - 1] = 0;
      } else {
        n = dd[from.slot - 1];
        dd[from.slot - 1] = 0;
      }
      if (n === 0) continue;
      dd[slot - 1] += n;
      navy.markFleet(f.id);
    }
  }
  const [type, gen] = [EQUIPMENT_DESIGN, slot] as const;
  for (const l of ce.lines) {
    if (l.key === fk) changeLine(d.ww.economy, ce, l.id, type, gen);
  }
  for (const l of ce.lines) {
    if (l.convertFrom === fk) l.convertFrom = l.key === tk ? -1 : tk;
  }
}
const EQUIPMENT_DESIGN: EquipmentType = "plane_design";

/**
 * Saves a plane design into its cell (design_save / design_copy). The
 * country's own design in the cell is overwritten in place, so its key now
 * means the new design and everything holding the key follows; with none
 * the design takes the first free slot. A snapshot's several own designs of
 * one cell merge into the lowest slot. The first save into a cell with a
 * static partner absorbs that static plane. The slot, or the refusal
 * ("design_slots_full": the pool of WW_PLANE_DESIGN_SLOTS is taken).
 */
export function savePlaneCell(
  d: WwDepth,
  id: number,
  def: DesignDef,
  day: number,
): number | WwOrderBlock {
  const c = d.country(id);
  if (c === null) return "dead";
  const slots = ownPlaneCellSlots(d, id, def);
  let slot: number;
  if (slots.length === 0) {
    const free = freeSlot(d, id, "plane");
    if (free === 0) return "design_slots_full";
    const got = saveDesign(d, id, def, free, "own", 0, 0, day);
    if (typeof got !== "number") return got;
    slot = got;
  } else {
    slot = slots[0];
    const s = c.des.plane[slot - 1]!;
    s.def = copyDef(def) as typeof s.def;
    s.savedDay = day;
    s.obsolete = false;
    d.markDesign(id, "plane", slot);
    for (const other of slots.slice(1)) {
      movePlanes(d, id, { slot: other }, slot);
      if (!designHeld(d, id, "plane", other)) {
        c.des.plane[other - 1] = null;
        d.markDesign(id, "plane", other);
      }
    }
  }
  const p = staticPartnerOfCell(planeType(def), def.base);
  if (p !== null) movePlanes(d, id, p, slot);
  return slot;
}

/**
 * The daily sweep (only a country holding a plane design): static planes
 * of an absorbed key that arrived after the first save — bought, gifted,
 * captured, in transit, or back from a wing — become the cell's design in
 * the stock.
 */
export function sweepStaticPlanes(d: WwDepth, id: number): void {
  const ce = d.ww.economy.country(id);
  if (ce === null) return;
  d.country(id)?.des.plane.forEach((s, i) => {
    if (s === null || s.origin !== "own") return;
    const st = staticKeyOfPlaneCell(s.def);
    if (st < 0 || ce.stock[st] === 0) return;
    ce.stock[equipKey("plane_design", i + 1)] += ce.stock[st];
    ce.stock[st] = 0;
  });
}

/** Whether plane design slot `slot` is old: more than TANK_OLD_PCT below the best of its plane type. */
export function planeDesignOld(d: WwDepth, id: number, slot: number): boolean {
  return planeDesignIsOld(d, id, slot);
}

/**
 * Personal notice: the country researched an airframe tech and has a saved
 * plane design of its own — a new airframe is available. No world news.
 */
export function noteNewAirframe(d: WwDepth, id: number, tech: WwTechId): void {
  const base = Object.keys(PLANE_BASE_DEFS).find(
    (b) => PLANE_BASE_DEFS[b].tech === tech,
  );
  if (base === undefined) return;
  const mine = d
    .country(id)
    ?.des.plane.some((s) => s !== null && s.origin === "own");
  if (mine === true) d.message(id, "ww1936_new_airframe", { airframe: base });
}
