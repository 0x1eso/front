// World War 1936 P3 (spec §10): conditions and effects are data, checked by
// these schemas; the engine runs one fixed function per kind. Append only:
// P5/P6 add kinds after the P3 lists.
import { z } from "zod";
import { COUNTRY_TAGS, CountryTag } from "./Countries";
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
  WW_TECH_IDS,
  WwTechId,
} from "./EconomyTypes";
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
  | { ownerOf: string };

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
] as const;
export type EffectKind = (typeof EFFECT_KINDS)[number];
export type EffectGroup =
  | "event"
  | "political"
  | "econ"
  | "diplo"
  | "territory";

const FIRST_ECON = EFFECT_KINDS.indexOf("build");
const FIRST_EVENT = EFFECT_KINDS.indexOf("fire_event");
const FIRST_DIPLO = EFFECT_KINDS.indexOf("war_goal");
const FIRST_TERRITORY = EFFECT_KINDS.indexOf("annex");

/** Plan decision 12: who runs each kind. */
export function effectGroup(k: EffectKind): EffectGroup {
  const i = EFFECT_KINDS.indexOf(k);
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
  ] as unknown as AnyUnion),
) as z.ZodType<Effect>;
