// World War 1936 P6 (spec §5.2.3, §19.3): the designs the AI saves when a
// chassis, hull or airframe opens, and what design_grant effects hand out
// (into a free slot, origin "own"). Every preset passes designBlock for a
// country that has every technology and no naval treaty (DepthData test):
// a module the country has not researched yet is the design lane's to wait
// for or leave at "" (the base fitting).
//
// Tank modules are in slot order: gun, turret, suspension, armour, engine,
// then one special (light I) or two; "" leaves a special slot empty. Ship
// modules follow SHIP_CLASS_SLOTS, plane modules planeSlots (weapon, aux…,
// defence…, special). `tags` limits a preset to those countries, `from` to
// that date (spec §19.3: British and American radar from 1940, Japan's heavy
// torpedo destroyer, Germany's snorkel submarine in 1944).
import type { AiDesignPreset } from "@openfront/engine-api/ww1936/DepthTypes";

export const AI_DESIGN_PRESETS: readonly AiDesignPreset[] = [
  // ---- tanks (spec §5.2.3) ----
  {
    id: "preset_light_1",
    def: {
      kind: "tank",
      base: "light_1",
      modules: ["auto20", "turret_1", "bogie", "riveted", "petrol", ""],
      armorLevel: 0,
      engineLevel: 0,
    },
  },
  {
    id: "preset_light_2",
    def: {
      kind: "tank",
      base: "light_2",
      modules: [
        "gun_small",
        "turret_2",
        "christie",
        "welded",
        "petrol",
        "radio",
        "aux_mg",
      ],
      armorLevel: 1,
      engineLevel: 2,
    },
  },
  {
    id: "preset_medium_1",
    def: {
      kind: "tank",
      base: "medium_1",
      modules: [
        "gun_cs",
        "turret_3",
        "torsion",
        "welded",
        "petrol",
        "radio",
        "smoke",
      ],
      armorLevel: 2,
      engineLevel: 2,
    },
  },
  {
    id: "preset_medium_2",
    def: {
      kind: "tank",
      base: "medium_2",
      modules: [
        "gun_hv",
        "turret_3",
        "torsion",
        "welded",
        "diesel",
        "radio",
        "sloped",
      ],
      armorLevel: 3,
      engineLevel: 3,
    },
  },
  {
    id: "preset_medium_3",
    def: {
      kind: "tank",
      base: "medium_3",
      modules: [
        "gun_hv",
        "turret_3",
        "torsion",
        "cast",
        "diesel",
        "radio",
        "sloped",
      ],
      armorLevel: 3,
      engineLevel: 4,
    },
  },
  {
    id: "preset_heavy_1",
    def: {
      kind: "tank",
      base: "heavy_1",
      modules: [
        "gun_hv",
        "turret_3",
        "interleaved",
        "cast",
        "petrol",
        "radio",
        "sloped",
      ],
      armorLevel: 4,
      engineLevel: 1,
    },
  },
  {
    id: "preset_heavy_2",
    def: {
      kind: "tank",
      base: "heavy_2",
      modules: [
        "gun_heavy",
        "turret_3",
        "interleaved",
        "cast",
        "petrol",
        "radio",
        "sloped",
      ],
      armorLevel: 4,
      engineLevel: 1,
    },
  },
  {
    id: "preset_heavy_3",
    def: {
      kind: "tank",
      base: "heavy_3",
      modules: [
        "gun_heavy",
        "turret_3",
        "torsion",
        "cast",
        "petrol",
        "radio",
        "sloped",
      ],
      armorLevel: 4,
      engineLevel: 1,
    },
  },
  {
    id: "preset_td_medium",
    def: {
      kind: "tank",
      base: "medium_2",
      modules: [
        "gun_hv",
        "turret_none",
        "torsion",
        "welded",
        "diesel",
        "sloped",
        "smoke",
      ],
      armorLevel: 4,
      engineLevel: 2,
    },
  },
  {
    id: "preset_spa_medium",
    def: {
      kind: "tank",
      base: "medium_1",
      modules: [
        "howitzer",
        "turret_open",
        "bogie",
        "welded",
        "petrol",
        "aux_mg",
        "",
      ],
      armorLevel: 0,
      engineLevel: 2,
    },
  },
  {
    id: "preset_spaa_medium",
    def: {
      kind: "tank",
      base: "medium_1",
      modules: [
        "aa_auto",
        "turret_open",
        "bogie",
        "welded",
        "petrol",
        "radio",
        "",
      ],
      armorLevel: 0,
      engineLevel: 2,
    },
  },
  // ---- ships (spec §19.3): a standard fit for every hull, radar and dual-purpose guns for Britain and the United States from 1940 ----
  {
    id: "preset_dd_1_std",
    def: { kind: "ship", base: "dd_1", modules: ["", "", "sec_aa", ""] },
  },
  {
    id: "preset_dd_2_std",
    def: { kind: "ship", base: "dd_2", modules: ["", "", "sec_aa", ""] },
  },
  {
    id: "preset_dd_3_std",
    def: { kind: "ship", base: "dd_3", modules: ["", "", "sec_aa", ""] },
  },
  {
    id: "preset_dd_4_std",
    def: { kind: "ship", base: "dd_4", modules: ["", "", "sec_aa", ""] },
  },
  {
    id: "preset_cl_1_std",
    def: {
      kind: "ship",
      base: "cl_1",
      modules: ["", "sec_aa", "", "", "floatplane"],
    },
  },
  {
    id: "preset_cl_1_radar",
    def: {
      kind: "ship",
      base: "cl_1",
      modules: ["", "sec_dp", "", "radar_surface", "floatplane"],
    },
    from: "1940-01-01",
    tags: ["GBR", "USA"],
  },
  {
    id: "preset_cl_2_std",
    def: {
      kind: "ship",
      base: "cl_2",
      modules: ["", "sec_aa", "", "", "floatplane"],
    },
  },
  {
    id: "preset_cl_2_radar",
    def: {
      kind: "ship",
      base: "cl_2",
      modules: ["", "sec_dp", "", "radar_surface", "floatplane"],
    },
    from: "1940-01-01",
    tags: ["GBR", "USA"],
  },
  {
    id: "preset_cl_3_std",
    def: {
      kind: "ship",
      base: "cl_3",
      modules: ["", "sec_aa", "", "", "floatplane"],
    },
  },
  {
    id: "preset_cl_3_radar",
    def: {
      kind: "ship",
      base: "cl_3",
      modules: ["", "sec_dp", "", "radar_surface", "floatplane"],
    },
    from: "1940-01-01",
    tags: ["GBR", "USA"],
  },
  {
    id: "preset_cl_4_std",
    def: {
      kind: "ship",
      base: "cl_4",
      modules: ["", "sec_aa", "", "", "floatplane"],
    },
  },
  {
    id: "preset_cl_4_radar",
    def: {
      kind: "ship",
      base: "cl_4",
      modules: ["", "sec_dp", "", "radar_surface", "floatplane"],
    },
    from: "1940-01-01",
    tags: ["GBR", "USA"],
  },
  {
    id: "preset_ca_1_std",
    def: {
      kind: "ship",
      base: "ca_1",
      modules: ["", "sec_aa", "", "", "", ""],
    },
  },
  {
    id: "preset_ca_1_radar",
    def: {
      kind: "ship",
      base: "ca_1",
      modules: ["", "sec_dp", "", "radar_surface", "", ""],
    },
    from: "1940-01-01",
    tags: ["GBR", "USA"],
  },
  {
    id: "preset_ca_2_std",
    def: {
      kind: "ship",
      base: "ca_2",
      modules: ["", "sec_aa", "", "", "", ""],
    },
  },
  {
    id: "preset_ca_2_radar",
    def: {
      kind: "ship",
      base: "ca_2",
      modules: ["", "sec_dp", "", "radar_surface", "", ""],
    },
    from: "1940-01-01",
    tags: ["GBR", "USA"],
  },
  {
    id: "preset_ca_3_std",
    def: {
      kind: "ship",
      base: "ca_3",
      modules: ["", "sec_aa", "", "", "", ""],
    },
  },
  {
    id: "preset_ca_3_radar",
    def: {
      kind: "ship",
      base: "ca_3",
      modules: ["", "sec_dp", "", "radar_surface", "", ""],
    },
    from: "1940-01-01",
    tags: ["GBR", "USA"],
  },
  {
    id: "preset_bc_1_std",
    def: {
      kind: "ship",
      base: "bc_1",
      modules: ["", "sec_aa", "", "", "", "floatplane"],
    },
  },
  {
    id: "preset_bc_1_radar",
    def: {
      kind: "ship",
      base: "bc_1",
      modules: ["", "sec_dp", "radar_surface", "", "", "floatplane"],
    },
    from: "1940-01-01",
    tags: ["GBR", "USA"],
  },
  {
    id: "preset_bc_2_std",
    def: {
      kind: "ship",
      base: "bc_2",
      modules: ["", "sec_aa", "", "", "", "floatplane"],
    },
  },
  {
    id: "preset_bc_2_radar",
    def: {
      kind: "ship",
      base: "bc_2",
      modules: ["", "sec_dp", "radar_surface", "", "", "floatplane"],
    },
    from: "1940-01-01",
    tags: ["GBR", "USA"],
  },
  {
    id: "preset_bc_3_std",
    def: {
      kind: "ship",
      base: "bc_3",
      modules: ["", "sec_aa", "", "", "", "floatplane"],
    },
  },
  {
    id: "preset_bc_3_radar",
    def: {
      kind: "ship",
      base: "bc_3",
      modules: ["", "sec_dp", "radar_surface", "", "", "floatplane"],
    },
    from: "1940-01-01",
    tags: ["GBR", "USA"],
  },
  {
    id: "preset_bb_1_std",
    def: {
      kind: "ship",
      base: "bb_1",
      modules: ["", "sec_aa", "", "", "", "floatplane"],
    },
  },
  {
    id: "preset_bb_1_radar",
    def: {
      kind: "ship",
      base: "bb_1",
      modules: ["", "sec_dp", "radar_surface", "", "", "floatplane"],
    },
    from: "1940-01-01",
    tags: ["GBR", "USA"],
  },
  {
    id: "preset_bb_2_std",
    def: {
      kind: "ship",
      base: "bb_2",
      modules: ["", "sec_aa", "", "", "", "floatplane"],
    },
  },
  {
    id: "preset_bb_2_radar",
    def: {
      kind: "ship",
      base: "bb_2",
      modules: ["", "sec_dp", "radar_surface", "", "", "floatplane"],
    },
    from: "1940-01-01",
    tags: ["GBR", "USA"],
  },
  {
    id: "preset_bb_3_std",
    def: {
      kind: "ship",
      base: "bb_3",
      modules: ["", "sec_aa", "", "", "", "floatplane"],
    },
  },
  {
    id: "preset_bb_3_radar",
    def: {
      kind: "ship",
      base: "bb_3",
      modules: ["", "sec_dp", "radar_surface", "", "", "floatplane"],
    },
    from: "1940-01-01",
    tags: ["GBR", "USA"],
  },
  {
    id: "preset_bb_4_std",
    def: {
      kind: "ship",
      base: "bb_4",
      modules: ["", "sec_aa", "", "", "", "floatplane"],
    },
  },
  {
    id: "preset_bb_4_radar",
    def: {
      kind: "ship",
      base: "bb_4",
      modules: ["", "sec_dp", "radar_surface", "", "", "floatplane"],
    },
    from: "1940-01-01",
    tags: ["GBR", "USA"],
  },
  {
    id: "preset_cv_1_std",
    def: {
      kind: "ship",
      base: "cv_1",
      modules: ["hangar_large", "sec_aa", "", "", ""],
    },
  },
  {
    id: "preset_cv_1_radar",
    def: {
      kind: "ship",
      base: "cv_1",
      modules: ["hangar_large", "sec_dp", "", "radar_surface", ""],
    },
    from: "1940-01-01",
    tags: ["GBR", "USA"],
  },
  {
    id: "preset_cv_2_std",
    def: {
      kind: "ship",
      base: "cv_2",
      modules: ["hangar_large", "sec_aa", "", "", ""],
    },
  },
  {
    id: "preset_cv_2_radar",
    def: {
      kind: "ship",
      base: "cv_2",
      modules: ["hangar_large", "sec_dp", "", "radar_surface", ""],
    },
    from: "1940-01-01",
    tags: ["GBR", "USA"],
  },
  {
    id: "preset_cv_3_std",
    def: {
      kind: "ship",
      base: "cv_3",
      modules: ["hangar_large", "sec_aa", "", "", ""],
    },
  },
  {
    id: "preset_cv_3_radar",
    def: {
      kind: "ship",
      base: "cv_3",
      modules: ["hangar_large", "sec_dp", "", "radar_surface", ""],
    },
    from: "1940-01-01",
    tags: ["GBR", "USA"],
  },
  {
    id: "preset_cv_4_std",
    def: {
      kind: "ship",
      base: "cv_4",
      modules: ["hangar_large", "sec_aa", "", "", ""],
    },
  },
  {
    id: "preset_cv_4_radar",
    def: {
      kind: "ship",
      base: "cv_4",
      modules: ["hangar_large", "sec_dp", "", "radar_surface", ""],
    },
    from: "1940-01-01",
    tags: ["GBR", "USA"],
  },
  {
    id: "preset_ss_1_std",
    def: { kind: "ship", base: "ss_1", modules: ["", "engine_long", ""] },
  },
  {
    id: "preset_ss_2_std",
    def: { kind: "ship", base: "ss_2", modules: ["", "engine_long", ""] },
  },
  {
    id: "preset_ss_3_std",
    def: { kind: "ship", base: "ss_3", modules: ["", "engine_long", ""] },
  },
  {
    id: "preset_ss_4_std",
    def: { kind: "ship", base: "ss_4", modules: ["", "engine_long", ""] },
  },
  {
    id: "preset_dd_2_torp",
    def: {
      kind: "ship",
      base: "dd_2",
      modules: ["torp_heavy", "", "sec_aa", ""],
    },
    tags: ["JPN"],
  },
  {
    id: "preset_ss_4_snorkel",
    def: {
      kind: "ship",
      base: "ss_4",
      modules: ["torp_heavy", "engine_long", "snorkel"],
    },
    from: "1944-01-01",
    tags: ["DEU"],
  },
  // ---- aircraft (spec §5.4, the P4 type each one flies as in the comment) ----
  // fighter
  {
    id: "preset_fighter_1",
    def: {
      kind: "plane",
      base: "small_1",
      modules: ["w_mg4", "w_mg2", "", ""],
    },
  },
  // fighter
  {
    id: "preset_fighter_2",
    def: {
      kind: "plane",
      base: "small_2",
      modules: ["w_hmg", "w_cannon20", "m_self_sealing", "m_drop_tank"],
    },
  },
  // fighter
  {
    id: "preset_fighter_3",
    def: {
      kind: "plane",
      base: "small_3",
      modules: ["w_cannon30", "w_hmg", "m_self_sealing", "m_drop_tank"],
    },
  },
  // cas
  {
    id: "preset_cas_1",
    def: {
      kind: "plane",
      base: "small_1",
      modules: ["w_bombs_s", "w_mg2", "m_armor", "m_dive_brakes"],
    },
  },
  // cas
  {
    id: "preset_cas_2",
    def: {
      kind: "plane",
      base: "small_2",
      modules: ["w_bombs_s", "w_cannon20", "m_armor", "m_dive_brakes"],
    },
  },
  // cas
  {
    id: "preset_cas_3",
    def: {
      kind: "plane",
      base: "small_3",
      modules: ["w_rockets", "w_cannon20", "m_armor", "m_self_sealing"],
    },
  },
  // naval_bomber
  {
    id: "preset_nav_1",
    def: {
      kind: "plane",
      base: "medium_1",
      modules: ["w_torpedo", "w_mg2", "", "m_def_turret", ""],
    },
  },
  // naval_bomber
  {
    id: "preset_nav_2",
    def: {
      kind: "plane",
      base: "medium_2",
      modules: [
        "w_torpedo",
        "w_mg4",
        "m_self_sealing",
        "m_def_turret",
        "m_drop_tank",
      ],
    },
  },
  // naval_bomber
  {
    id: "preset_nav_3",
    def: {
      kind: "plane",
      base: "medium_3",
      modules: [
        "w_torpedo",
        "w_rockets",
        "m_self_sealing",
        "m_def_turret",
        "m_radar",
      ],
    },
  },
  // bomber
  {
    id: "preset_tac_1",
    def: {
      kind: "plane",
      base: "medium_1",
      modules: ["w_bombs_m", "w_mg2", "", "m_def_turret", ""],
    },
  },
  // bomber
  {
    id: "preset_tac_2",
    def: {
      kind: "plane",
      base: "medium_2",
      modules: [
        "w_bombs_m",
        "w_mg4",
        "m_self_sealing",
        "m_def_turret",
        "m_bomb_sight",
      ],
    },
  },
  // bomber
  {
    id: "preset_tac_3",
    def: {
      kind: "plane",
      base: "medium_3",
      modules: [
        "w_bombs_m",
        "w_cannon20",
        "m_self_sealing",
        "m_def_turret",
        "m_bomb_sight",
      ],
    },
  },
  // heavy_fighter
  {
    id: "preset_heavyf_3",
    def: {
      kind: "plane",
      base: "medium_3",
      modules: [
        "w_cannon30",
        "w_cannon20",
        "m_self_sealing",
        "m_armor",
        "m_drop_tank",
      ],
    },
  },
  // strat_bomber
  {
    id: "preset_strat_1",
    def: {
      kind: "plane",
      base: "large_1",
      modules: ["w_bombs_l", "w_mg2", "", "m_def_turret", "", ""],
    },
  },
  // strat_bomber
  {
    id: "preset_strat_2",
    def: {
      kind: "plane",
      base: "large_2",
      modules: [
        "w_bombs_l",
        "w_bombs_m",
        "m_self_sealing",
        "m_def_turret",
        "m_def_turret",
        "m_bomb_sight",
      ],
    },
  },
  // strat_bomber
  {
    id: "preset_strat_3",
    def: {
      kind: "plane",
      base: "large_3",
      modules: [
        "w_bombs_l",
        "w_bombs_l",
        "m_self_sealing",
        "m_def_turret",
        "m_def_turret",
        "m_bomb_sight",
      ],
    },
  },
  // transport_plane
  {
    id: "preset_transport_2",
    def: {
      kind: "plane",
      base: "medium_2",
      modules: ["w_cargo", "", "", "", ""],
    },
  },
  // fighter
  {
    id: "preset_jet_fighter",
    def: {
      kind: "plane",
      base: "jet_1",
      modules: ["w_cannon30", "w_cannon30", "", ""],
    },
  },
];
