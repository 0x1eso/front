// Tank design reform, phase 1: one design per cell, a cell being a role x a
// chassis. Saving a tank design into a cell makes everything the country
// holds in that cell that design at once and free (stock, divisions,
// trainees, lines); the first save into a light or medium cell also
// absorbs the matching static tanks. Ship and plane designs are not cells.
import type { DesignDef } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  EQUIP_KEYS,
  equipKey,
  WwOrderBlock,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_EQUIP_KEYS,
  GROUND_STATIC_SLOTS,
} from "@openfront/engine-api/ww1936/LandTypes";
import { staticKeyOfCell } from "@openfront/engine-lib/ww1936/DesignCellKeys";
import {
  TANK_BASE_DEFS,
  tankRole,
} from "@openfront/engine-lib/ww1936/DesignRules";
import { oldInfoOf } from "@openfront/engine-lib/ww1936/TemplateStats";
import { changeLine } from "../economy/Production";
import { copyDef, designHeld, freeSlot, saveDesign } from "./Designs";
import { designerOn } from "./Hist";
import type { WwDepth } from "./WwDepth";

/** Two tank designs fill the same cell: the same role on the same chassis. */
export function sameCell(a: DesignDef, b: DesignDef): boolean {
  return a.base === b.base && tankRole(a) === tankRole(b);
}

/** The country's own-origin tank design slots (1-based) in the cell of `def`, ascending. */
export function ownCellSlots(d: WwDepth, id: number, def: DesignDef): number[] {
  const out: number[] = [];
  d.country(id)?.des.tank.forEach((s, i) => {
    if (s !== null && s.origin === "own" && sameCell(s.def, def)) {
      out.push(i + 1);
    }
  });
  return out;
}

/**
 * Moves everything the country holds of `fromKey` to `toKey` (equal in
 * count): the stock, the divisions' and trainees' slots, and the lines
 * making it (through changeLine: the existing retention rule). Both keys
 * are in one need group, so no division's fill changes.
 */
function moveHoldings(
  d: WwDepth,
  id: number,
  fromKey: number,
  toKey: number,
): void {
  const ce = d.ww.economy.country(id);
  if (ce === null || fromKey === toKey) return;
  ce.stock[toKey] += ce.stock[fromKey];
  ce.stock[fromKey] = 0;
  const jf = GROUND_EQUIP_KEYS.indexOf(fromKey);
  const jt = GROUND_EQUIP_KEYS.indexOf(toKey);
  const land = d.ww.land;
  if (jf >= 0 && jt >= 0) {
    for (const r of land.rowsOf(id)) {
      const n = land.divisions.equipOf(r)[jf];
      if (n === 0) continue;
      land.addEquip(r, jf, -n);
      land.addEquip(r, jt, n);
    }
    for (const x of land.country(id)?.trainees ?? []) {
      x.equip[jt] += x.equip[jf];
      x.equip[jf] = 0;
    }
  }
  for (const l of ce.lines) {
    if (l.key === fromKey) {
      const [type, gen] = EQUIP_KEYS[toKey];
      changeLine(d.ww.economy, ce, l.id, type, gen);
    }
  }
  // A line converting from a key that is gone converts from its successor.
  for (const l of ce.lines) {
    if (l.convertFrom === fromKey) l.convertFrom = l.key === toKey ? -1 : toKey;
  }
}

/** The divisions holding design slot `slot` lose the org above their new maximum (as a template refit does). */
function cutOrg(d: WwDepth, id: number, slot: number): void {
  const land = d.ww.land;
  const t = land.divisions;
  const j = GROUND_STATIC_SLOTS + slot - 1;
  for (const r of land.rowsOf(id)) {
    if (t.equipOf(r)[j] === 0) continue;
    land.touchDivision(r);
    const max = land.orgMaxOf(r);
    if (t.org[r] > max) t.org[r] = max;
  }
}

/**
 * Saves a tank design into its cell (design_save / design_copy). The
 * country's own design in the cell is overwritten in place, so its key now
 * means the new design and everything holding the key follows; with none
 * the design takes the first free slot. A snapshot's several own designs
 * of one cell merge into the lowest slot. The first save into a light or
 * medium cell absorbs the matching static tank. The slot, or the refusal
 * ("design_slots_full": the pool of WW_TANK_DESIGN_SLOTS is taken).
 */
export function saveTankCell(
  d: WwDepth,
  id: number,
  def: DesignDef,
  day: number,
): number | WwOrderBlock {
  const c = d.country(id);
  if (c === null) return "dead";
  const slots = ownCellSlots(d, id, def);
  let slot: number;
  if (slots.length === 0) {
    const free = freeSlot(d, id, "tank");
    if (free === 0) return "design_slots_full";
    const got = saveDesign(d, id, def, free, "own", 0, 0, day);
    if (typeof got !== "number") return got;
    slot = got;
  } else {
    slot = slots[0];
    const s = c.des.tank[slot - 1]!;
    s.def = copyDef(def) as typeof s.def;
    s.savedDay = day;
    s.obsolete = false;
    d.markDesign(id, "tank", slot);
    const key = equipKey("tank_design", slot);
    for (const other of slots.slice(1)) {
      moveHoldings(d, id, equipKey("tank_design", other), key);
      if (!designHeld(d, id, "tank", other)) {
        c.des.tank[other - 1] = null;
        d.markDesign(id, "tank", other);
      }
    }
  }
  const st = staticKeyOfCell(def);
  if (st >= 0) moveHoldings(d, id, st, equipKey("tank_design", slot));
  cutOrg(d, id, slot);
  return slot;
}

/**
 * The daily sweep (only a country holding a design for a static-backed
 * cell): static tanks that arrived after the first save — bought, gifted,
 * captured, in transit — become the cell's design in the stock.
 */
export function sweepStaticStock(d: WwDepth, id: number): void {
  const ce = d.ww.economy.country(id);
  if (ce === null) return;
  d.country(id)?.des.tank.forEach((s, i) => {
    if (s === null || s.origin !== "own") return;
    const st = staticKeyOfCell(s.def);
    if (st < 0 || ce.stock[st] === 0) return;
    ce.stock[equipKey("tank_design", i + 1)] += ce.stock[st];
    ce.stock[st] = 0;
  });
}

/** Whether tank design slot `slot` (1-based) is old: more than TANK_OLD_PCT below its group's best. */
export function designIsOld(d: WwDepth, id: number, slot: number): boolean {
  const ce = d.ww.economy.country(id);
  if (ce === null) return false;
  return (
    oldInfoOf(d.keyStats(id), ce.researched).old[
      GROUND_STATIC_SLOTS + slot - 1
    ] === 1
  );
}

/**
 * Personal notice (rule 7): the country researched a tank chassis and has a
 * saved design of its own — a new chassis is available. Nothing changes by
 * itself; no world news.
 */
export function noteNewChassis(d: WwDepth, id: number, tech: WwTechId): void {
  // Designer off: the catalogue has no chassis to announce.
  if (!designerOn(d)) return;
  const base = Object.keys(TANK_BASE_DEFS).find(
    (b) => TANK_BASE_DEFS[b].tech === tech,
  );
  if (base === undefined) return;
  const mine = d
    .country(id)
    ?.des.tank.some((s) => s !== null && s.origin === "own");
  if (mine === true) d.message(id, "ww1936_new_chassis", { chassis: base });
}
