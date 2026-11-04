// Ship designs as cells, like the tank cells: a cell is a ship class x a
// generation (shipBase of the design's base), and a human's save keeps one
// current own design in it. A save never changes a ship that is already
// in service: the cell's design is overwritten in place only when no ship
// (or refit, or licence, or line with progress) holds it; otherwise the
// new design takes a free slot and the old one goes obsolete, still held
// by its ships and freed by the daily check once none holds it. The
// human's running lines of the cell follow the new design. The AI saves
// through saveDesign directly (AiDesigns.aiSave) and never comes here.
import type { DesignDef } from "@openfront/engine-api/ww1936/DepthTypes";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import { SHIP_CLASSES } from "@openfront/engine-api/ww1936/NavyTypes";
import { shipBase } from "@openfront/engine-lib/ww1936/DesignRules";
import { copyDef, freeSlot, navalLineDesignBlock, saveDesign } from "./Designs";
import type { DesignSlot, WwDepth } from "./WwDepth";

/** The own, not obsolete ship design slots (1-based) in the cell of `def`, ascending. */
export function currentShipSlots(
  d: WwDepth,
  id: number,
  def: DesignDef,
): number[] {
  const want = shipBase(def.base);
  const out: number[] = [];
  if (want === null) return out;
  d.country(id)?.des.ship.forEach((s: DesignSlot | null, i: number) => {
    if (s === null || s.obsolete || s.origin !== "own") return;
    const b = shipBase(s.def.base);
    if (b !== null && b.cls === want.cls && b.gen === want.gen) out.push(i + 1);
  });
  return out;
}

/** The cell's current design: the newest save, the lower slot on a tie; 0: none. */
export function currentShipSlot(
  d: WwDepth,
  id: number,
  def: DesignDef,
): number {
  const slots = currentShipSlots(d, id, def);
  let best = 0;
  for (const s of slots) {
    if (
      best === 0 ||
      d.country(id)!.des.ship[s - 1]!.savedDay >
        d.country(id)!.des.ship[best - 1]!.savedDay
    ) {
      best = s;
    }
  }
  return best;
}

/**
 * Whether slot `slot` can be rewritten in place: no ship has it (or is
 * being refitted to it), no licence of it was granted, and no line that
 * makes it has progress in hand.
 */
export function shipSlotRewritable(
  d: WwDepth,
  id: number,
  slot: number,
): boolean {
  const ce = d.ww.economy.country(id);
  if (ce === null) return false;
  const t = d.ww.navy.ships;
  for (let r = 0; r < t.rows; r++) {
    if (
      t.id[r] !== 0 &&
      t.owner[r] === id &&
      (t.design[r] === slot || t.refitTo[r] === slot)
    ) {
      return false;
    }
  }
  if (ce.navalLines.some((l) => l.design === slot && l.progress > 0)) {
    return false;
  }
  return !d.market.licences.some((l) => l.from === id && l.ship === slot);
}

/**
 * Saves a ship design into its cell (design_save / design_copy of a
 * human). The slot, or the refusal ("design_slots_full": the new design
 * needs a free slot and there is none; nothing changes then).
 */
export function saveShipCell(
  d: WwDepth,
  id: number,
  def: DesignDef,
  day: number,
): number | WwOrderBlock {
  const c = d.country(id);
  const ce = d.ww.economy.country(id);
  const sb = shipBase(def.base);
  if (c === null || ce === null) return "dead";
  if (sb === null) return "bad_base";
  const prev = currentShipSlot(d, id, def);
  let slot: number;
  if (prev > 0 && shipSlotRewritable(d, id, prev)) {
    slot = prev;
    const s = c.des.ship[slot - 1]!;
    s.def = copyDef(def) as typeof s.def;
    s.savedDay = day;
    s.obsolete = false;
    d.markDesign(id, "ship", slot);
  } else {
    if (freeSlot(d, id, "ship") === 0) return "design_slots_full";
    const got = saveDesign(d, id, def, 0, "own", 0, 0, day);
    if (typeof got !== "number") return got;
    slot = got;
    if (prev > 0) {
      c.des.ship[prev - 1]!.obsolete = true;
      d.markDesignView(id, "ship", prev);
    }
  }
  // The human's running lines of the cell make the new design from the
  // next ship on (progress is kept): those on no design or on the cell's
  // previous one. Convoys, floating harbours and other designs are left.
  const ci = SHIP_CLASSES.indexOf(sb.cls);
  for (const l of ce.navalLines) {
    if (l.cls !== ci || l.gen !== sb.gen) continue;
    if (l.design !== 0 && l.design !== prev) continue;
    if (navalLineDesignBlock(d, id, ci, sb.gen, slot) !== null) continue;
    l.design = slot;
  }
  return slot;
}
