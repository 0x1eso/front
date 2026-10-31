// World War 1936 P3 (spec §10): conditions and effects are data, checked by
// these schemas; the engine runs one fixed function per kind. Append only:
// P5/P6 add kinds after the P3 lists.
import { z } from "zod";
import { COUNTRY_TAGS, CountryTag } from "./Countries";
import {
  AGENCY_UPGRADES,
  AgencyUpgrade,
  BOP_TAGS,
  DOCTRINE_DOMAINS,
  DOCTRINE_TRACKS,
  DoctrineDomain,
  DoctrineTrack,
  GRAND_DOCTRINES,
  GrandDoctrine,
  INTEL_DOMAINS,
  IntelDomain,
  SPECIAL_PROJECTS,
  SpecialProject,
  Subdoctrine,
  SUBDOCTRINES,
} from "./DepthTypes";
import {
  BUILDING_IDS,
  BuildingId,
  EQUIPMENT_TYPES,
  EquipmentType,
  LAW_KINDS,
  LAW_VALUES,
  LawKind,
  LawValue,
  RESOURCE_IDS,
  ResourceId,
  TECH_BRANCHES,
  TechBranch,
  WW_MAX_SLOTS,
  WW_TECH_IDS,
  WwTechId,
} from "./EconomyTypes";
import {
  COUNTRY_STATES,
  CountryState,
  LendLeaseItem,
  SUBJECT_LEVELS,
  SubjectLevel,
} from "./EndgameTypes";
import { SHIP_CLASSES, ShipClass } from "./NavyTypes";
import {
  IDEOLOGIES,
  Ideology,
  RESERVE_KEYS,
  ReserveKey,
  TRAIT_IDS,
  TraitId,
  WAR_GOAL_TYPES,
  WarGoalType,
} from "./PoliticsTypes";
import { SEA_ZONE_BASE } from "./WorldWarTypes";

export type Selector =
  | "self"
  | "from"
  | "target"
  | { tag: CountryTag }
  | { factionLeaderOf: Selector }
  | { ownerOf: string }
  // P5 (plan decision 26): the country's overlord (0 when it is no subject).
  | { overlordOf: Selector };

/**
 * Spec §10.4 RegionPick, plus two picks the controller added for the
 * content lanes: `withResources` (the n regions with the most resources)
 * and `regions` (these land region ids, in order — region names on the
 * world map are not unique).
 */
export type RegionPick =
  | "capital"
  | { group: string }
  | { best: number; of?: string }
  | { coreBest: number }
  | { borderWith: Selector | "threat"; n: number }
  | { acquired: true; n: number }
  | { coastal: true; n: number }
  | { withResources: number }
  | { regions: readonly number[] };

export const CONDITION_KINDS = [
  "always",
  "date_ge",
  "date_lt",
  "days_since_flag_ge",
  "tag",
  "exists",
  "is_major",
  "is_ai",
  "is_human",
  "capitulated",
  "historical_ai",
  "ruling",
  "pop_ge",
  "stability_ge",
  "ws_ge",
  "pp_ge",
  "has_spirit",
  "has_advisor",
  "leader",
  "focus_done",
  "focus_in_progress",
  "flag",
  "gflag",
  "law",
  "law_ge",
  "has_tech",
  "factories_ge",
  "divisions_ge",
  "strength_ratio_ge",
  "army_xp_ge",
  "owns_group",
  "controls_group",
  "controls_capital_of",
  "neighbor_of",
  "lost_vp_ge",
  "at_war",
  "at_war_with",
  "war_days_ge",
  "in_faction",
  "faction_leader",
  "same_faction",
  "faction_ideology",
  "has_war_goal_on",
  "justifying_on",
  "justified_against",
  "nap_with",
  "guarantees",
  "guaranteed_by",
  "has_access_from",
  "wt_ge",
  "threat_ge",
  "opinion_ge",
  "decision_taken",
  // Controller rulings for the content lanes (K1, K3).
  "coastal",
  "landlocked",
  "declared_by",
  // P4 (P4 spec §16.3, plan decision 24), appended.
  "navy_size",
  "fuel_ratio_below",
  // P5 (P5 spec §16.4, plan decision 26), appended.
  "is_exile",
  "exile_host",
  "is_subject",
  "subject_of",
  "subject_level_ge",
  "autonomy_ge",
  "country_state",
  "occupied_by",
  "resistance_ge",
  "compliance_ge",
  "war_score_share_ge",
  "in_conference",
  "legitimacy_ge",
  // P5 lane E (the content lanes' "next to a group" gap, spec §17.6's
  // Warsaw and Paris uprisings): holds land bordering the group.
  "borders_group",
  // P6 (P6 spec §18.3, plan decision 27), appended; nukes_on: the lobby key
  // (pre-flight §0-11), so data gates its atomic lines.
  "has_doctrine",
  "mastery_level",
  "has_agency",
  "intel_level",
  "project_done",
  "has_atomic",
  "congress_above",
  "bop_range",
  "energy_below",
  "nukes_on",
  // Research overhaul (changes §1.3), appended: the research slots it has.
  "research_slots_ge",
] as const;
export type ConditionKind = (typeof CONDITION_KINDS)[number];

type W = { who?: Selector };
export type LeafCondition = W &
  (
    | { kind: "always"; value: boolean }
    | { kind: "date_ge" | "date_lt"; date: string }
    | { kind: "days_since_flag_ge"; flag: string; days: number }
    | { kind: "tag"; tag: CountryTag }
    | {
        kind:
          | "exists"
          | "is_major"
          | "is_ai"
          | "is_human"
          | "capitulated"
          | "historical_ai";
      }
    | { kind: "ruling"; ideology: Ideology }
    | { kind: "pop_ge"; ideology: Ideology; pct: number }
    | { kind: "stability_ge" | "ws_ge" | "lost_vp_ge" | "wt_ge"; pct: number }
    | { kind: "pp_ge" | "army_xp_ge"; amount: number }
    | {
        kind:
          | "has_spirit"
          | "focus_done"
          | "focus_in_progress"
          | "decision_taken";
        id: string;
      }
    | { kind: "has_advisor" | "leader"; person: string }
    | { kind: "flag" | "gflag"; flag: string }
    | { kind: "law" | "law_ge"; law: LawKind; value: LawValue }
    | { kind: "has_tech"; tech: WwTechId }
    | { kind: "factories_ge" | "divisions_ge"; count: number }
    | { kind: "strength_ratio_ge"; vs: Selector; permille: number }
    | { kind: "owns_group" | "controls_group"; group: string }
    | {
        kind:
          | "controls_capital_of"
          | "neighbor_of"
          | "at_war_with"
          | "same_faction"
          | "has_war_goal_on"
          | "justifying_on"
          | "nap_with"
          | "guarantees"
          | "guaranteed_by"
          | "has_access_from"
          | "declared_by";
        of: Selector;
      }
    | {
        kind:
          | "at_war"
          | "in_faction"
          | "faction_leader"
          | "justified_against"
          | "coastal"
          | "landlocked";
      }
    | { kind: "war_days_ge"; days: number }
    | { kind: "faction_ideology"; ideology: Ideology }
    | { kind: "threat_ge"; of: Selector; pct: number }
    | { kind: "opinion_ge"; of: Selector; value: number }
    // P4 (plan decision 24)
    | { kind: "navy_size"; min: number; cls?: ShipClass }
    | { kind: "fuel_ratio_below"; pct: number }
    // P5 (plan decision 26)
    | { kind: "is_exile" | "is_subject" | "in_conference" }
    | { kind: "exile_host" | "subject_of"; of: Selector }
    | { kind: "subject_level_ge"; level: SubjectLevel }
    | { kind: "autonomy_ge" | "legitimacy_ge"; pct: number }
    | { kind: "country_state"; tag: CountryTag; state: CountryState }
    | { kind: "occupied_by"; group: string; of: Selector }
    | { kind: "resistance_ge" | "compliance_ge"; group: string; pct: number }
    | { kind: "war_score_share_ge"; of: Selector; pct: number }
    | { kind: "borders_group"; group: string }
    // P6 (plan decision 27)
    | { kind: "has_doctrine"; doctrine: GrandDoctrine | Subdoctrine }
    | { kind: "mastery_level"; track: DoctrineTrack; level: number }
    | { kind: "has_agency" | "nukes_on" }
    | { kind: "intel_level"; of: Selector; domain: IntelDomain; pct: number }
    | { kind: "project_done"; project: SpecialProject }
    | { kind: "has_atomic"; count?: number }
    | { kind: "congress_above" | "energy_below"; pct: number }
    | { kind: "bop_range"; tag: "CHN" | "JPN" | "FRA"; band: number }
    // Research overhaul (changes §1.3)
    | { kind: "research_slots_ge"; count: number }
  );
export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | LeafCondition;

export const EFFECT_KINDS = [
  // political (P)
  "pp",
  "stability",
  "war_support",
  "add_spirit",
  "remove_spirit",
  "swap_spirit",
  "popularity",
  "set_government",
  "set_leader",
  "civil_war",
  "set_law",
  "law_step",
  "add_advisor_candidate",
  "remove_advisor",
  "person_trait",
  "set_flag",
  "clear_flag",
  "set_gflag",
  "clear_gflag",
  "elections",
  // economy (P)
  "build",
  "infra",
  "rail",
  "fort",
  "resource",
  "move_buildings",
  "manpower",
  "equipment",
  "send_equipment",
  "research_bonus",
  "add_tech",
  "research_slot",
  "reserve",
  // military (P)
  "army_xp",
  "unlock_template",
  "add_general",
  "remove_general",
  "restore_general",
  "divisions",
  // events (E)
  "fire_event",
  "news",
  "unlock_decision",
  "lock_decision",
  "take_decision",
  "if",
  "random_list",
  "tension",
  // diplomacy (D)
  "war_goal",
  "remove_war_goal",
  "declare_war",
  "join_war",
  "end_war",
  "create_faction",
  "join_faction",
  "invite",
  "leave_faction",
  "kick",
  "dissolve_faction",
  "guarantee",
  "end_guarantee",
  "nap",
  "break_nap",
  "access",
  "end_access",
  "opinion",
  // territory (D)
  "annex",
  "transfer_regions",
  // navy (P4 spec §16.3, plan decision 24)
  "ships",
  "convoys",
  "fuel",
  // endgame (P5 spec §16.4 order, plan decision 26), appended.
  "release",
  "create_state",
  "make_subject",
  "end_subject",
  "autonomy",
  "occupation_zone",
  "annex_occupied",
  "separate_peace",
  "switch_sides",
  "set_name",
  "transfer_ships",
  "scuttle_fleet",
  "lend_lease",
  "volunteers",
  "exile_legitimacy",
  "embargo",
  "end_embargo",
  "reparations",
  "surrender",
  "uprising",
  "resistance",
  "compliance",
  "restore_country",
  // P5 pre-flight §A E × T1: navy experience (K4's focus rewards).
  "navy_xp",
  // P6 (P6 spec §18.3 order, then plan decision 27's three), appended.
  "doctrine_mastery",
  "congress",
  "bop",
  "cp",
  "intel_network",
  "decrypt",
  "project_progress",
  "design_grant",
  "energy",
  "agency",
  "cfocus_unlock",
  "start_project",
] as const;
export type EffectKind = (typeof EFFECT_KINDS)[number];
export type EffectGroup =
  | "event"
  | "political"
  | "econ"
  | "diplo"
  | "territory"
  | "navy"
  | "endgame"
  | "depth";

const FIRST_ECON = EFFECT_KINDS.indexOf("build");
const FIRST_EVENT = EFFECT_KINDS.indexOf("fire_event");
const FIRST_DIPLO = EFFECT_KINDS.indexOf("war_goal");
const FIRST_TERRITORY = EFFECT_KINDS.indexOf("annex");
const FIRST_NAVY = EFFECT_KINDS.indexOf("ships");
const FIRST_ENDGAME = EFFECT_KINDS.indexOf("release");
const FIRST_DEPTH = EFFECT_KINDS.indexOf("doctrine_mastery");

/** Plan decision 12: who runs each kind. */
export function effectGroup(k: EffectKind): EffectGroup {
  const i = EFFECT_KINDS.indexOf(k);
  // P6 plan decision 27: first (the P6 kinds follow the P5 ones).
  if (i >= FIRST_DEPTH) return "depth";
  // P5 plan decision 26: first (the P5 kinds follow the P4 ones).
  if (i >= FIRST_ENDGAME) return "endgame";
  // P4 plan decision 24: before the ranges below (the P4 kinds follow annex).
  if (i >= FIRST_NAVY) return "navy";
  if (i < FIRST_ECON) return "political";
  if (i < FIRST_EVENT) return "econ";
  if (i < FIRST_DIPLO) return "event";
  if (i < FIRST_TERRITORY) return "diplo";
  return "territory";
}

export type Effect = W &
  (
    | { kind: "pp"; amount: number }
    | { kind: "stability" | "war_support"; pct: number }
    | { kind: "add_spirit"; id: string; days?: number }
    | { kind: "remove_spirit"; id: string }
    | { kind: "swap_spirit"; from: string; to: string }
    | {
        kind: "popularity";
        ideology: Ideology | "ruling" | "largest_other";
        pp: number;
      }
    | { kind: "set_government"; ideology: Ideology | "largest_other" }
    | { kind: "set_leader"; person: string }
    | { kind: "civil_war"; ideology: Ideology | "largest_other" }
    | { kind: "set_law"; law: LawKind; value: LawValue; free?: boolean }
    | { kind: "law_step"; law: LawKind; steps: number }
    | { kind: "add_advisor_candidate" | "remove_advisor"; person: string }
    | { kind: "person_trait"; person: string; trait: TraitId }
    | { kind: "set_flag"; flag: string; days?: number }
    | { kind: "clear_flag" | "set_gflag" | "clear_gflag"; flag: string }
    | { kind: "elections"; suspend?: boolean; postponeDays?: number }
    | { kind: "build"; where: RegionPick; building: BuildingId; count: number }
    | { kind: "infra" | "rail" | "fort"; where: RegionPick; amount: number }
    | { kind: "resource"; where: RegionPick; res: ResourceId; amount: number }
    | {
        kind: "move_buildings";
        from: RegionPick;
        to: RegionPick;
        building: BuildingId;
        count: number;
      }
    | { kind: "manpower"; amount?: number; recruitablePct?: number }
    | { kind: "equipment"; type: EquipmentType; gen: number; count: number }
    | {
        kind: "send_equipment";
        to: Selector;
        type: EquipmentType;
        count: number;
      }
    | {
        kind: "research_bonus";
        branch?: TechBranch;
        tech?: WwTechId;
        pct: number;
        uses: number;
      }
    | { kind: "add_tech"; tech: WwTechId }
    | { kind: "research_slot"; amount: number }
    | { kind: "reserve"; key: ReserveKey; amount: number }
    | { kind: "army_xp"; amount: number }
    | { kind: "unlock_template"; template: string }
    | { kind: "add_general"; general?: string }
    | { kind: "remove_general" | "restore_general"; general: string }
    | { kind: "divisions"; template: string; count: number; where: RegionPick }
    | { kind: "fire_event"; id: string; to?: Selector; days?: number }
    | { kind: "news"; id: string }
    | {
        kind: "unlock_decision" | "lock_decision" | "take_decision";
        id: string;
      }
    | { kind: "if"; cond: Condition; then: Effect[]; else?: Effect[] }
    | {
        kind: "random_list";
        options: { weight: number; effects: Effect[] }[];
      }
    | { kind: "tension"; pct: number }
    | { kind: "war_goal"; on: Selector; type: WarGoalType; group?: string }
    | { kind: "remove_war_goal"; on: Selector }
    | { kind: "declare_war"; on: Selector; goal?: WarGoalType }
    | {
        kind:
          | "join_war"
          | "end_war"
          | "join_faction"
          | "invite"
          | "kick"
          | "guarantee"
          | "end_guarantee"
          | "nap"
          | "break_nap"
          | "access"
          | "end_access";
        of: Selector;
      }
    | { kind: "create_faction"; name?: string }
    | { kind: "leave_faction" | "dissolve_faction" }
    | { kind: "opinion"; of: Selector | "all"; value: number; days: number }
    | {
        kind: "annex";
        target: Selector;
        units?: "transfer" | "disband";
        core?: boolean;
      }
    | { kind: "transfer_regions"; group: string; to: Selector; core?: boolean }
    // P4 (plan decision 24)
    | {
        kind: "ships";
        cls: ShipClass;
        gen: number;
        count: number;
        port?: number;
      }
    | { kind: "convoys"; amount: number }
    | { kind: "fuel"; amount: number }
    // P5 (plan decision 26)
    | {
        kind: "release";
        tag: CountryTag;
        as: "puppet" | "free";
        regions?: string;
        overlord?: Selector;
      }
    | {
        kind: "create_state";
        tag: CountryTag;
        regions: string[];
        from: Selector;
        overlord: Selector;
        level: SubjectLevel;
        neutral?: boolean;
        ideology: Ideology;
        leader?: string;
      }
    | {
        kind: "make_subject";
        target: Selector;
        level: SubjectLevel | "up" | "down";
        neutral?: boolean;
      }
    | { kind: "end_subject"; target: Selector }
    | { kind: "autonomy"; pct: number }
    | {
        kind: "occupation_zone";
        group: string;
        holder?: Selector;
        days?: number;
        seize?: boolean;
      }
    | { kind: "annex_occupied"; group: string; to?: Selector }
    | { kind: "separate_peace"; with: "all" | Selector }
    | { kind: "switch_sides"; to: Selector }
    | { kind: "set_name"; key: string }
    | { kind: "transfer_ships"; to: Selector; pct: number }
    | { kind: "scuttle_fleet"; pct: number }
    | {
        kind: "lend_lease";
        to: Selector;
        item: LendLeaseItem;
        perMonth: number;
        gen?: number;
      }
    | { kind: "volunteers"; to: Selector; divisions?: number; planes?: number }
    | {
        kind: "exile_legitimacy";
        pct: number;
        scope?: "self" | "faction_exiles";
      }
    | { kind: "embargo" | "end_embargo"; on: Selector }
    | { kind: "reparations"; to: Selector; k: number; days: number }
    | { kind: "surrender"; to?: Selector }
    | { kind: "uprising"; group: string }
    | { kind: "resistance" | "compliance"; group: string; pct: number }
    | { kind: "restore_country"; tag: CountryTag | "target" }
    | { kind: "navy_xp"; amount: number }
    // P6 (plan decision 27)
    | {
        kind: "doctrine_mastery";
        domain: DoctrineDomain;
        track?: DoctrineTrack;
        amount: number;
      }
    | { kind: "congress"; pp: number }
    /** ‰ toward the right (+) or left (−). */
    | { kind: "bop"; amount: number }
    | { kind: "cp"; amount: number }
    /** ‰ of network (or decryption) on that country. */
    | { kind: "intel_network" | "decrypt"; on: Selector; pm: number }
    | { kind: "project_progress"; project: SpecialProject; pct: number }
    /** Starts the project at one of our free facilities of its kind (techs waived; no-op if running/done/no facility). */
    | { kind: "start_project"; project: SpecialProject }
    /** AI_DESIGN_PRESETS id into a free slot, origin "own". */
    | { kind: "design_grant"; preset: string }
    /** Permanent energy supply (pack hydro), stored per country. */
    | { kind: "energy"; amount: number }
    /** Found the agency free (if none), then the upgrade free. */
    | { kind: "agency"; upgrade?: AgencyUpgrade }
    /** Continuous focuses open now. */
    | { kind: "cfocus_unlock" }
  );

// ---- zod (content checks; the engine trusts checked data) ----

const id = z
  .string()
  .regex(/^[a-z][a-z0-9_:]*$/)
  .max(48);
const date = z
  .string()
  .regex(/^19[34]\d-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
const int = z.number().int();
const pos = int.min(1);
const tag = z.enum(COUNTRY_TAGS);
const ideo = z.enum(IDEOLOGIES);
export const SelectorSchema: z.ZodType<Selector> = z.lazy(() =>
  z.union([
    z.enum(["self", "from", "target"]),
    z.object({ tag }).strict(),
    z.object({ factionLeaderOf: SelectorSchema }).strict(),
    z.object({ ownerOf: id }).strict(),
    // P5 (plan decision 26)
    z.object({ overlordOf: SelectorSchema }).strict(),
  ]),
);
const who = { who: SelectorSchema.optional() };
export const RegionPickSchema: z.ZodType<RegionPick> = z.union([
  z.literal("capital"),
  z.object({ group: id }).strict(),
  z.object({ best: pos, of: id.optional() }).strict(),
  z.object({ coreBest: pos }).strict(),
  z
    .object({
      borderWith: z.union([SelectorSchema, z.literal("threat")]),
      n: pos,
    })
    .strict(),
  z.object({ acquired: z.literal(true), n: pos }).strict(),
  z.object({ coastal: z.literal(true), n: pos }).strict(),
  z.object({ withResources: pos }).strict(),
  z
    .object({
      regions: z
        .array(pos.max(SEA_ZONE_BASE - 1))
        .min(1)
        .max(64),
    })
    .strict(),
]);
const leaf = <K extends string, S extends z.ZodRawShape>(
  kinds: readonly K[],
  shape: S,
) =>
  kinds.map((k) => z.object({ kind: z.literal(k), ...who, ...shape }).strict());
type AnyUnion = [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]];

export const WwConditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(WwConditionSchema).min(1) }).strict(),
    z.object({ any: z.array(WwConditionSchema).min(1) }).strict(),
    z.object({ not: WwConditionSchema }).strict(),
    ...leaf(["always"], { value: z.boolean() }),
    ...leaf(["date_ge", "date_lt"], { date }),
    ...leaf(["days_since_flag_ge"], { flag: id, days: int.min(0) }),
    ...leaf(["tag"], { tag }),
    ...leaf(
      [
        "exists",
        "is_major",
        "is_ai",
        "is_human",
        "capitulated",
        "historical_ai",
        "at_war",
        "in_faction",
        "faction_leader",
        "justified_against",
        "coastal",
        "landlocked",
      ],
      {},
    ),
    ...leaf(["ruling", "faction_ideology"], { ideology: ideo }),
    ...leaf(["pop_ge"], { ideology: ideo, pct: int.min(0).max(100) }),
    ...leaf(["stability_ge", "ws_ge", "lost_vp_ge", "wt_ge"], {
      pct: int.min(0).max(100),
    }),
    ...leaf(["pp_ge", "army_xp_ge"], { amount: int }),
    ...leaf(
      ["has_spirit", "focus_done", "focus_in_progress", "decision_taken"],
      {
        id,
      },
    ),
    ...leaf(["has_advisor", "leader"], { person: id }),
    ...leaf(["flag", "gflag"], { flag: id }),
    ...leaf(["law", "law_ge"], {
      law: z.enum(LAW_KINDS),
      value: z.enum(LAW_VALUES),
    }),
    ...leaf(["has_tech"], { tech: z.enum(WW_TECH_IDS) }),
    ...leaf(["factories_ge", "divisions_ge"], { count: int.min(0) }),
    ...leaf(["strength_ratio_ge"], {
      vs: SelectorSchema,
      permille: int.min(0),
    }),
    ...leaf(["owns_group", "controls_group"], { group: id }),
    ...leaf(
      [
        "controls_capital_of",
        "neighbor_of",
        "at_war_with",
        "same_faction",
        "has_war_goal_on",
        "justifying_on",
        "nap_with",
        "guarantees",
        "guaranteed_by",
        "has_access_from",
        "declared_by",
      ],
      { of: SelectorSchema },
    ),
    ...leaf(["war_days_ge"], { days: int.min(0) }),
    ...leaf(["threat_ge"], { of: SelectorSchema, pct: int.min(0).max(100) }),
    ...leaf(["opinion_ge"], {
      of: SelectorSchema,
      value: int.min(-100).max(100),
    }),
    // P4 (plan decision 24)
    ...leaf(["navy_size"], {
      min: int.min(0).max(5000),
      cls: z.enum(SHIP_CLASSES).optional(),
    }),
    ...leaf(["fuel_ratio_below"], { pct: pos.max(100) }),
    // P5 (plan decision 26)
    ...leaf(["is_exile", "is_subject", "in_conference"], {}),
    ...leaf(["exile_host", "subject_of"], { of: SelectorSchema }),
    ...leaf(["subject_level_ge"], { level: z.enum(SUBJECT_LEVELS) }),
    ...leaf(["autonomy_ge", "legitimacy_ge"], { pct: int.min(0).max(100) }),
    ...leaf(["country_state"], { tag, state: z.enum(COUNTRY_STATES) }),
    ...leaf(["occupied_by"], { group: id, of: SelectorSchema }),
    ...leaf(["resistance_ge", "compliance_ge"], {
      group: id,
      pct: int.min(0).max(100),
    }),
    ...leaf(["war_score_share_ge"], {
      of: SelectorSchema,
      pct: int.min(0).max(100),
    }),
    ...leaf(["borders_group"], { group: id }),
    // P6 (plan decision 27)
    ...leaf(["has_doctrine"], {
      doctrine: z.union([z.enum(GRAND_DOCTRINES), z.enum(SUBDOCTRINES)]),
    }),
    ...leaf(["mastery_level"], {
      track: z.enum(DOCTRINE_TRACKS),
      level: int.min(1).max(5),
    }),
    ...leaf(["has_agency", "nukes_on"], {}),
    ...leaf(["intel_level"], {
      of: SelectorSchema,
      domain: z.enum(INTEL_DOMAINS),
      pct: int.min(0).max(100),
    }),
    ...leaf(["project_done"], { project: z.enum(SPECIAL_PROJECTS) }),
    ...leaf(["has_atomic"], { count: int.min(1).max(10).optional() }),
    ...leaf(["congress_above", "energy_below"], { pct: int.min(0).max(100) }),
    ...leaf(["bop_range"], { tag: z.enum(BOP_TAGS), band: int.min(0).max(4) }),
    // Research overhaul (changes §1.3)
    ...leaf(["research_slots_ge"], { count: int.min(0).max(WW_MAX_SLOTS) }),
  ] as unknown as AnyUnion),
) as z.ZodType<Condition>;

export const WwEffectSchema: z.ZodType<Effect> = z.lazy(() =>
  z.union([
    ...leaf(["pp"], { amount: int }),
    ...leaf(["stability", "war_support", "tension"], {
      pct: int.min(-100).max(100),
    }),
    ...leaf(["add_spirit"], { id, days: pos.optional() }),
    ...leaf(
      [
        "remove_spirit",
        "news",
        "unlock_decision",
        "lock_decision",
        "take_decision",
      ],
      { id },
    ),
    ...leaf(["swap_spirit"], { from: id, to: id }),
    ...leaf(["popularity"], {
      ideology: z.union([ideo, z.enum(["ruling", "largest_other"])]),
      pp: int.min(-100).max(100),
    }),
    ...leaf(["set_government"], {
      ideology: z.union([ideo, z.literal("largest_other")]),
    }),
    ...leaf(["set_leader", "add_advisor_candidate", "remove_advisor"], {
      person: id,
    }),
    ...leaf(["person_trait"], { person: id, trait: z.enum(TRAIT_IDS) }),
    ...leaf(["civil_war"], {
      ideology: z.union([ideo, z.literal("largest_other")]),
    }),
    ...leaf(["set_law"], {
      law: z.enum(LAW_KINDS),
      value: z.enum(LAW_VALUES),
      free: z.boolean().optional(),
    }),
    ...leaf(["law_step"], {
      law: z.enum(LAW_KINDS),
      steps: int.min(-6).max(6),
    }),
    ...leaf(["set_flag"], { flag: id, days: pos.optional() }),
    ...leaf(["clear_flag", "set_gflag", "clear_gflag"], { flag: id }),
    ...leaf(["elections"], {
      suspend: z.boolean().optional(),
      postponeDays: pos.max(1461).optional(),
    }),
    ...leaf(["build"], {
      where: RegionPickSchema,
      building: z.enum(BUILDING_IDS),
      count: pos.max(20),
    }),
    ...leaf(["infra", "rail", "fort"], {
      where: RegionPickSchema,
      amount: pos.max(5),
    }),
    ...leaf(["resource"], {
      where: RegionPickSchema,
      res: z.enum(RESOURCE_IDS),
      amount: int,
    }),
    ...leaf(["move_buildings"], {
      from: RegionPickSchema,
      to: RegionPickSchema,
      building: z.enum(BUILDING_IDS),
      count: pos,
    }),
    ...leaf(["manpower"], {
      amount: int.optional(),
      recruitablePct: int.min(0).max(100).optional(),
    }),
    ...leaf(["equipment"], {
      type: z.enum(EQUIPMENT_TYPES),
      gen: pos.max(3),
      count: pos,
    }),
    ...leaf(["send_equipment"], {
      to: SelectorSchema,
      type: z.enum(EQUIPMENT_TYPES),
      count: pos,
    }),
    ...leaf(["research_bonus"], {
      branch: z.enum(TECH_BRANCHES).optional(),
      tech: z.enum(WW_TECH_IDS).optional(),
      pct: pos.max(300),
      uses: pos.max(5),
    }),
    ...leaf(["add_tech"], { tech: z.enum(WW_TECH_IDS) }),
    ...leaf(["research_slot"], { amount: int.min(-1).max(1) }),
    ...leaf(["reserve"], { key: z.enum(RESERVE_KEYS), amount: int }),
    ...leaf(["army_xp"], { amount: int }),
    ...leaf(["unlock_template"], { template: id }),
    ...leaf(["add_general"], { general: id.optional() }),
    ...leaf(["remove_general", "restore_general"], { general: id }),
    ...leaf(["divisions"], {
      template: id,
      count: pos.max(24),
      where: RegionPickSchema,
    }),
    ...leaf(["fire_event"], {
      id,
      to: SelectorSchema.optional(),
      days: pos.optional(),
    }),
    ...leaf(["if"], {
      cond: WwConditionSchema,
      then: z.array(WwEffectSchema),
      else: z.array(WwEffectSchema).optional(),
    }),
    ...leaf(["random_list"], {
      options: z
        .array(
          z.object({ weight: pos, effects: z.array(WwEffectSchema) }).strict(),
        )
        .min(2),
    }),
    ...leaf(["war_goal"], {
      on: SelectorSchema,
      type: z.enum(WAR_GOAL_TYPES),
      group: id.optional(),
    }),
    ...leaf(["remove_war_goal"], { on: SelectorSchema }),
    ...leaf(["declare_war"], {
      on: SelectorSchema,
      goal: z.enum(WAR_GOAL_TYPES).optional(),
    }),
    ...leaf(
      [
        "join_war",
        "end_war",
        "join_faction",
        "invite",
        "kick",
        "guarantee",
        "end_guarantee",
        "nap",
        "break_nap",
        "access",
        "end_access",
      ],
      { of: SelectorSchema },
    ),
    ...leaf(["create_faction"], { name: id.optional() }),
    ...leaf(["leave_faction", "dissolve_faction"], {}),
    ...leaf(["opinion"], {
      of: z.union([SelectorSchema, z.literal("all")]),
      value: int.min(-100).max(100),
      days: pos,
    }),
    ...leaf(["annex"], {
      target: SelectorSchema,
      units: z.enum(["transfer", "disband"]).optional(),
      core: z.boolean().optional(),
    }),
    ...leaf(["transfer_regions"], {
      group: id,
      to: SelectorSchema,
      core: z.boolean().optional(),
    }),
    // P4 (plan decision 24)
    ...leaf(["ships"], {
      cls: z.enum(SHIP_CLASSES),
      gen: pos.max(4),
      count: pos.max(200),
      port: pos.max(SEA_ZONE_BASE - 1).optional(),
    }),
    ...leaf(["convoys", "fuel"], { amount: int.min(-100_000).max(100_000) }),
    // P5 (plan decision 26)
    ...leaf(["release"], {
      tag,
      as: z.enum(["puppet", "free"]),
      regions: id.optional(),
      overlord: SelectorSchema.optional(),
    }),
    ...leaf(["create_state"], {
      tag,
      regions: z.array(id).min(1),
      from: SelectorSchema,
      overlord: SelectorSchema,
      level: z.enum(SUBJECT_LEVELS),
      neutral: z.boolean().optional(),
      ideology: ideo,
      leader: id.optional(),
    }),
    ...leaf(["make_subject"], {
      target: SelectorSchema,
      level: z.union([z.enum(SUBJECT_LEVELS), z.enum(["up", "down"])]),
      neutral: z.boolean().optional(),
    }),
    ...leaf(["end_subject"], { target: SelectorSchema }),
    ...leaf(["autonomy"], { pct: int.min(-100).max(100) }),
    ...leaf(["exile_legitimacy"], {
      pct: int.min(-100).max(100),
      scope: z.enum(["self", "faction_exiles"]).optional(),
    }),
    ...leaf(["occupation_zone"], {
      group: id,
      holder: SelectorSchema.optional(),
      days: pos.optional(),
      seize: z.boolean().optional(),
    }),
    ...leaf(["annex_occupied"], { group: id, to: SelectorSchema.optional() }),
    ...leaf(["separate_peace"], {
      with: z.union([z.literal("all"), SelectorSchema]),
    }),
    ...leaf(["switch_sides"], { to: SelectorSchema }),
    ...leaf(["set_name"], {
      key: z
        .string()
        .regex(/^ww1936\.[a-z0-9_.]+$/)
        .max(64),
    }),
    ...leaf(["transfer_ships"], { to: SelectorSchema, pct: pos.max(100) }),
    ...leaf(["scuttle_fleet"], { pct: pos.max(100) }),
    ...leaf(["lend_lease"], {
      to: SelectorSchema,
      item: z.union([z.enum(EQUIPMENT_TYPES), z.literal("fuel")]),
      perMonth: pos.max(100_000),
      gen: int.min(0).max(4).optional(),
    }),
    ...leaf(["volunteers"], {
      to: SelectorSchema,
      divisions: int.min(0).max(12).optional(),
      planes: int.min(0).max(100).optional(),
    }),
    ...leaf(["embargo", "end_embargo"], { on: SelectorSchema }),
    ...leaf(["reparations"], {
      to: SelectorSchema,
      k: pos.max(20),
      days: pos.max(1461),
    }),
    ...leaf(["surrender"], { to: SelectorSchema.optional() }),
    ...leaf(["uprising"], { group: id }),
    ...leaf(["resistance", "compliance"], {
      group: id,
      pct: int.min(-100).max(100),
    }),
    ...leaf(["restore_country"], {
      tag: z.union([tag, z.literal("target")]),
    }),
    ...leaf(["navy_xp"], { amount: int.min(-1000).max(1000) }),
    // P6 (plan decision 27)
    ...leaf(["doctrine_mastery"], {
      domain: z.enum(DOCTRINE_DOMAINS),
      track: z.enum(DOCTRINE_TRACKS).optional(),
      amount: int.min(1).max(600),
    }),
    ...leaf(["congress"], { pp: int.min(-50).max(100) }),
    ...leaf(["bop"], { amount: int.min(-1000).max(1000) }),
    ...leaf(["cp"], { amount: int.min(-100).max(100) }),
    ...leaf(["intel_network", "decrypt"], {
      on: SelectorSchema,
      pm: int.min(-1000).max(1000),
    }),
    ...leaf(["project_progress"], {
      project: z.enum(SPECIAL_PROJECTS),
      pct: int.min(-100).max(100),
    }),
    ...leaf(["start_project"], { project: z.enum(SPECIAL_PROJECTS) }),
    ...leaf(["design_grant"], { preset: z.string().max(40) }),
    ...leaf(["energy"], { amount: int.min(-50).max(50) }),
    ...leaf(["agency"], { upgrade: z.enum(AGENCY_UPGRADES).optional() }),
    ...leaf(["cfocus_unlock"], {}),
  ] as unknown as AnyUnion),
) as z.ZodType<Effect>;
