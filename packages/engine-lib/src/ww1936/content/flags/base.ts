// World War 1936 P3 (spec §20.1, plan decision 31): the flags the spec
// already names (the foundation's); each content lane adds its own file.
import type { FlagId } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const FLAGS_BASE: readonly FlagId[] = [
  "munich_done",
  "mr_secret_protocol",
  "pact_of_steel",
  "tripartite",
  "abdication_resolved",
  "edward_viii",
  "kings_party",
  "purge_path",
  "winter_war_fought",
  "coup_failed",
  "can_create_faction",
  "lend_lease_ready",
  "lend_lease",
  "northern_road_closed",
  "sudeten_transferred",
  "anschluss_done",
  "prague_done",
  "memel_done",
  "baltics_annexed",
  "bessarabia_lost",
  "elections_suspended",
];

/**
 * P5 (P5 spec §9–§19, plan Task 1 Step 6): the flags the P5 spec names
 * (lend_lease is P3's, above). Each P5 lane declares its own others.
 */
export const FLAGS_P5_BASE: readonly FlagId[] = [
  "independence_denied",
  "control_tightened",
  "autonomy_full",
  "unconditional_surrender",
  "second_front_agreed",
  "yalta_zones",
  "potsdam_lines",
  "pledged_vs_japan",
  "ita_july_25",
  "talks_continue",
  "heavy_water",
  "radar_lab",
];

/**
 * P6 (pre-flight §C5, review L3): W1's destroyDam sets the world flag
 * `<damId>_destroyed`; all nine are declared here (K3 drops its own line).
 */
export const FLAGS_P6_BASE: readonly FlagId[] = [
  // DAMS order (DepthTypes).
  "dam_hoover_destroyed",
  "dam_grand_coulee_destroyed",
  "dam_norris_destroyed",
  "dam_dnipro_destroyed",
  "dam_mohne_destroyed",
  "dam_eder_destroyed",
  "dam_kembs_destroyed",
  "dam_galloway_destroyed",
  "dam_vemork_destroyed",
];
