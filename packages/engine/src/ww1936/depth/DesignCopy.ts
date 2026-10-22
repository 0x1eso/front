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
