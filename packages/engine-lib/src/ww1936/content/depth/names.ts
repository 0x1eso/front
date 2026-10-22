// World War 1936 P6 (spec §5.1 "이름"): the pieces of a design's automatic
// name ("Medium Tank II Long Gun", "Small Airframe II Fighter"). Generic
// words only, never a real weapon's name (spec §23). The designer screen
// builds the name; this table is the list of its text keys
// (ww1936.design_name.<key>) so the content checks see them.
//
// - tank: the chassis piece (by base), then the role piece for a tank
//   destroyer or self-propelled gun, else the main-gun piece.
// - plane: the airframe's base name (ww1936.base.plane.<id>), then the P4
//   type it flies as.
// - ship: the P4 class and generation name, then the first module piece in
//   this order that the design carries, else "standard".
import type { DesignKind } from "@openfront/engine-api/ww1936/DepthTypes";

export interface DesignNamePart {
  kind: DesignKind;
  by: "base" | "role" | "module" | "type" | "default";
  /** The base, role, module or P4 type id ("" for the default). */
  id: string;
  /** Text key ww1936.design_name.<key>. */
  key: string;
}

export const DESIGN_NAME_KEYS: readonly DesignNamePart[] = [
  { kind: "tank", by: "base", id: "light_1", key: "tank_light_1" },
  { kind: "tank", by: "base", id: "light_2", key: "tank_light_2" },
  { kind: "tank", by: "base", id: "medium_1", key: "tank_medium_1" },
  { kind: "tank", by: "base", id: "medium_2", key: "tank_medium_2" },
  { kind: "tank", by: "base", id: "medium_3", key: "tank_medium_3" },
  { kind: "tank", by: "base", id: "heavy_1", key: "tank_heavy_1" },
  { kind: "tank", by: "base", id: "heavy_2", key: "tank_heavy_2" },
  { kind: "tank", by: "base", id: "heavy_3", key: "tank_heavy_3" },
  {
    kind: "tank",
    by: "role",
    id: "tank_destroyer",
    key: "role_tank_destroyer",
  },
  { kind: "tank", by: "role", id: "sp_artillery", key: "role_sp_artillery" },
  { kind: "tank", by: "role", id: "sp_anti_air", key: "role_sp_anti_air" },
  { kind: "tank", by: "module", id: "mg", key: "gun_mg" },
  { kind: "tank", by: "module", id: "auto20", key: "gun_auto20" },
  { kind: "tank", by: "module", id: "gun_small", key: "gun_gun_small" },
  { kind: "tank", by: "module", id: "gun_cs", key: "gun_gun_cs" },
  { kind: "tank", by: "module", id: "gun_hv", key: "gun_gun_hv" },
  { kind: "tank", by: "module", id: "gun_heavy", key: "gun_gun_heavy" },
  { kind: "tank", by: "module", id: "flame", key: "gun_flame" },
  { kind: "plane", by: "type", id: "fighter", key: "plane_fighter" },
  { kind: "plane", by: "type", id: "cv_fighter", key: "plane_cv_fighter" },
  { kind: "plane", by: "type", id: "cas", key: "plane_cas" },
  { kind: "plane", by: "type", id: "cv_cas", key: "plane_cv_cas" },
  { kind: "plane", by: "type", id: "naval_bomber", key: "plane_naval_bomber" },
  {
    kind: "plane",
    by: "type",
    id: "cv_naval_bomber",
    key: "plane_cv_naval_bomber",
  },
  {
    kind: "plane",
    by: "type",
    id: "heavy_fighter",
    key: "plane_heavy_fighter",
  },
  { kind: "plane", by: "type", id: "bomber", key: "plane_bomber" },
  { kind: "plane", by: "type", id: "strat_bomber", key: "plane_strat_bomber" },
  {
    kind: "plane",
    by: "type",
    id: "transport_plane",
    key: "plane_transport_plane",
  },
  { kind: "ship", by: "module", id: "shbb_hull", key: "ship_shbb_hull" },
  {
    kind: "ship",
    by: "module",
    id: "radar_microwave",
    key: "ship_radar_microwave",
  },
  { kind: "ship", by: "module", id: "radar_adv", key: "ship_radar_adv" },
  {
    kind: "ship",
    by: "module",
    id: "radar_surface",
    key: "ship_radar_surface",
  },
  { kind: "ship", by: "module", id: "snorkel", key: "ship_snorkel" },
  { kind: "ship", by: "module", id: "torp_heavy", key: "ship_torp_heavy" },
  { kind: "ship", by: "module", id: "sec_dp", key: "ship_sec_dp" },
  { kind: "ship", by: "module", id: "mine_layer", key: "ship_mine_layer" },
  { kind: "ship", by: "module", id: "minesweep", key: "ship_minesweep" },
  { kind: "ship", by: "module", id: "hangar_large", key: "ship_hangar_large" },
  { kind: "ship", by: "module", id: "armor_heavy", key: "ship_armor_heavy" },
  { kind: "ship", by: "module", id: "engine_fast", key: "ship_engine_fast" },
  { kind: "ship", by: "default", id: "", key: "ship_standard" },
];
