// The static equipment a saved design's cell stands in for. Shared by the
// engine (which moves the static's holdings into the design on a save) and
// the client (whose line pickers show the design where the static was).
import type { DesignDef } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  equipKey,
  type EquipmentType,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { planeType, tankRole } from "./DesignRules";
import { staticPartnerOfCell } from "./PlaneScore";

/**
 * The static tank each chassis cell of the plain "tank" role stands in for
 * (their techs are the same: TANK_BASE_DEFS.tech === EQUIPMENT.techs[gen-1]).
 */
const STATIC_OF_BASE: Readonly<
  Record<string, readonly [EquipmentType, number]>
> = {
  light_1: ["light_tank", 1],
  light_2: ["light_tank", 2],
  medium_1: ["medium_tank", 1],
  medium_2: ["medium_tank", 2],
  medium_3: ["medium_tank", 3],
};

/** The EQUIP_KEYS index of the static tank a design's cell absorbs; -1: none. */
export function staticKeyOfCell(def: DesignDef): number {
  if (def.kind !== "tank" || tankRole(def) !== "tank") return -1;
  const s = STATIC_OF_BASE[def.base];
  return s === undefined ? -1 : equipKey(s[0], s[1]);
}

/** The EQUIP_KEYS index of the static plane a design's cell absorbs; -1: none. */
export function staticKeyOfPlaneCell(def: DesignDef): number {
  if (def.kind !== "plane") return -1;
  const p = staticPartnerOfCell(planeType(def), def.base);
  return p === null ? -1 : equipKey(p.type, p.gen);
}
