// P6 lane E fills this file (plan Task 3): designs on equipment slots, their costs, lines and stats (spec §5).
// The foundation's stub: final signatures, neutral answers.
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import type { PlaneStats } from "@openfront/engine-api/ww1936/AirTypes";
import type {
  DesignDef,
  DesignOrigin,
  KeyStatsTable,
  PlaneDesignStats,
  ShipDesignMods,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  equipKey as designEquipKey,
  EQUIP_KEYS,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { GROUND_STATIC_SLOTS } from "@openfront/engine-api/ww1936/LandTypes";
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import {
  EQUIPMENT,
  isDesignType,
  unitCostMilli,
} from "@openfront/engine-lib/ww1936/Equipment";
import { planeStats } from "@openfront/engine-lib/ww1936/PlaneStats";
import { emptyStats } from "@openfront/engine-lib/ww1936/Stats";
import type { EffectCtx } from "../politics/Dispatch";
import type { WwDepth } from "./WwDepth";

/** design_save, design_copy, design_obsolete, design_rename, ship_refit, line_convert. */
export function issueDesign(
  d: WwDepth,
  id: number,
  o: DepthOrder,
  tick: number,
): WwOrderBlock | null {
  return "design_slots_full";
}

export function dailyDesigns(d: WwDepth, id: number, day: number): void {}

/** Plan decision 7: the design slots' rows of the country's KeyStatsTable. Stub: none (group −1). */
export function fillDesignRows(
  d: WwDepth,
  id: number,
  t: KeyStatsTable,
): void {}

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
  return "design_slots_full";
}

/** A unit's industry cost, milli, of an EQUIP_KEYS index. Stub: P1's table (design slots 0). */
export function equipCostMilli(d: WwDepth, id: number, key: number): number {
  const [type, gen] = EQUIP_KEYS[key];
  return isDesignType(type) ? 0 : unitCostMilli(type, gen);
}

/** Resources per factory (RESOURCE_IDS order) of an EQUIP_KEYS index. Stub: P1's table (design slots none). */
export function equipResources(d: WwDepth, id: number, key: number): number[] {
  const [type] = EQUIP_KEYS[key];
  return isDesignType(type) ? [] : [...EQUIPMENT[type].resources];
}

/** Spec §5.5: the efficiency a line keeps switching keys, bp; −1: P1's rule. */
export function lineRetentionBp(
  d: WwDepth,
  id: number,
  fromKey: number,
  toKey: number,
): number {
  return -1;
}

/** Spec §5.5: a converted unit's cost on a converting line, milli; null: the full cost. */
export function conversionCostMilli(
  d: WwDepth,
  id: number,
  lineId: number,
  newKey: number,
): number | null {
  return null;
}

/** Plan decision 8: a ship design's modifiers (design 0: none). */
export function shipDesignOf(
  d: WwDepth,
  owner: number,
  design: number,
): ShipDesignMods | null {
  return null;
}

/** Plan decision 9: a plane design key's numbers (static keys: null). */
export function planeStatsOfKey(
  d: WwDepth,
  id: number,
  key: number,
): PlaneDesignStats | null {
  return null;
}

/** Plan decision 9: a plane design as the P4 type it flies as. Stub: that type's generation 1. */
export function designPlaneAsP4(s: PlaneDesignStats, type: string): PlaneStats {
  return planeStats(
    type as Parameters<typeof planeStats>[0],
    1,
    emptyStats(),
    new Set(),
  );
}

/** naval_line_add with a design (spec §5.3). */
export function navalLineDesignBlock(
  d: WwDepth,
  id: number,
  cls: number,
  gen: number,
  design: number,
): WwOrderBlock | null {
  return null;
}

/** The design_grant effect (spec §18.3). */
export function grantDesign(
  ctx: EffectCtx,
  e: Extract<Effect, { kind: "design_grant" }>,
  actor: number,
): void {}

/**
 * Review E6: units of a design in use (the designer's "in use"): a tank
 * design's units in the country's divisions and stock, a plane design's
 * in the stock, a ship design's ships. The foundation's body; lane E may
 * add the deployed planes.
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
      if (t.id[r] !== 0 && t.owner[r] === id && t.design[r] === slot) n++;
    }
    return n;
  }
  if (kind === "plane") {
    return ce?.stock[designEquipKey("plane_design", slot)] ?? 0;
  }
  const land = d.ww.land;
  const j = GROUND_STATIC_SLOTS + slot - 1;
  let n = ce?.stock[designEquipKey("tank_design", slot)] ?? 0;
  for (const r of land.rowsOf(id)) n += land.divisions.equipOf(r)[j] ?? 0;
  return n;
}
