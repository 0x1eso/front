// World War 1936 research overhaul (changes §5, design §3.2 "AI와 자동
// 연구"): one integer score for every tech a country may start. The AI's
// research turn and a human's auto-research both rank by it; the engine's
// planResearch keeps the ahead-of-time tiers and the land/sea/air caps.
//
//   score = area weight (personality, country, a human's lines and leaning)
//         + role + need + bonus + catch-up + favoured + catalogue value
//           + situation − ahead ÷ 2 + jitter
//
// Integers only, no state: the jitter is wwRoll(seed, P_RESEARCH, country,
// tech index) and the either/or line wwRoll(seed, P_RESEARCH_EXCL, …), so
// a restored game scores the same and every game differs.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  EquipmentType,
  RESEARCH_LEANS,
  TECH_TABS,
  TechTab,
  WW_TECH_IDS,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { aheadPct, yearStartDay } from "./EconomyRules";
import { HIST_CATALOGUE } from "./hist/index";
import { catalogueTechValues } from "./hist/TechValue";
import { idHash, wwRoll } from "./Roll";
import { INDUSTRY_ORG, TechRole, WW_TECHS } from "./WwTechs";

export const P_RESEARCH = idHash("research");
export const P_RESEARCH_EXCL = idHash("research_excl");
/** ww81: the seeded lean of an AI's catalogue programme (one of three, +20 on its groups). */
export const P_RESEARCH_PROG = idHash("research_prog");

/** The AI personalities (AiEconomy.aiPersonality). */
export type ResearchPersona = "aggressor" | "democracy" | "minor";

const AGGRESSORS: readonly CountryTag[] = ["DEU", "ITA", "JPN", "SUN"];
const DEMOCRACIES: readonly CountryTag[] = [
  "GBR",
  "FRA",
  "USA",
  "CAN",
  "AUS",
  "NZL",
  "ZAF",
  "RAJ",
];

/** The AI personality of a country (one source for the engine and the research card). */
export function researchPersonaOf(tag: CountryTag): ResearchPersona {
  if (AGGRESSORS.includes(tag)) return "aggressor";
  if (DEMOCRACIES.includes(tag)) return "democracy";
  return "minor";
}

/** What the score reads of a country (built by the engine from its state). */
export interface ResearchScoreInput {
  /** The game's seed (WwPolitics.seed). */
  seed: number;
  smallID: number;
  tag: CountryTag;
  persona: ResearchPersona;
  day: number;
  /** A human's auto-research (true): nothing is left out, unbuilt kinds go back. */
  human: boolean;
  /** RESEARCH_LEANS index (a human's leaning; an AI's is ignored). */
  lean: number;
  /** It fields a navy (a harbor; a minor: dockyards too). */
  coastal: boolean;
  /** Factories on the lines of each equipment type (a design line as the type it counts as). */
  lineFactories: Readonly<Partial<Record<EquipmentType, number>>>;
  /** Naval lines it runs (ships and convoys). */
  navalLines: number;
  /** The research_bonus keys it holds (a tech id or a branch). */
  bonusKeys: readonly string[];
  /** Faction shared research % of techs, only non-zero ones. */
  shared: readonly (readonly [WwTechId, number])[];
  /** Techs researched (the either/or choice reads them, with `running`). */
  researched: ReadonlySet<WwTechId>;
  running: readonly (WwTechId | null)[];
  /**
   * ww81: what the war asks for now (read only when a slot is free); none:
   * nothing. `antiTank` 1: our best anti-tank pierce is under the enemy's
   * best armour (anti-tank techs +25), -1: the reverse (tank guns +25).
   * `airLosses`: heavy wing losses lately (fighter techs +20).
   * `shortResource`: a resource covers under half its need (synthetic and
   * substitute techs +25).
   */
  situation?: {
    antiTank?: -1 | 0 | 1;
    airLosses?: boolean;
    shortResource?: boolean;
  };
}

// ---- The kinds of equipment a tech serves ----

const PLANES_FIGHTER: readonly EquipmentType[] = [
  "fighter",
  "heavy_fighter",
  "cv_fighter",
];
const PLANES_BOMBER: readonly EquipmentType[] = ["bomber", "strat_bomber"];
const PLANES_CAS: readonly EquipmentType[] = ["cas", "cv_cas"];
const PLANES_NAVAL: readonly EquipmentType[] = [
  "naval_bomber",
  "cv_naval_bomber",
];
const PLANES_ALL: readonly EquipmentType[] = [
  ...PLANES_FIGHTER,
  "bomber",
  "strat_bomber",
  "cas",
  "cv_cas",
  "naval_bomber",
  "cv_naval_bomber",
];
const TANKS: readonly EquipmentType[] = ["light_tank", "medium_tank"];

/** "ship": a naval line's; a list: those equipment lines'; null: no equipment (always wanted). */
export type TechUse = readonly EquipmentType[] | "ship" | null;

function useOf(id: WwTechId): TechUse {
  const d = WW_TECHS[id];
  if (d.tab === "naval") return "ship";
  if (d.tab === "armour") {
    return TANKS;
  }
  if (d.tab === "air") {
    if (/^(fighter|aircraft_cannon|aero_engine|jet_airframe)/.test(id)) {
      return PLANES_FIGHTER;
    }
    if (id === "air_protection" || id === "air_range") return PLANES_ALL;
    if (id.startsWith("heavy_fighter")) return ["heavy_fighter"];
    if (/^(bomber|strat_bomber|bomb_sight|jet_bomber)/.test(id)) {
      return PLANES_BOMBER;
    }
    if (/^(cas|air_rockets)/.test(id)) return PLANES_CAS;
    if (/^(naval_bomber|naval_strike)/.test(id)) return PLANES_NAVAL;
    if (id.startsWith("transport_plane")) return ["transport_plane"];
    if (id.startsWith("carrier_aviation")) {
      return ["cv_fighter", "cv_cas", "cv_naval_bomber"];
    }
    if (id.startsWith("air_radar") || id === "air_ground_control") {
      return PLANES_ALL;
    }
    return PLANES_ALL;
  }
  if (d.tab === "artillery") {
    if (/^(anti_tank|at_imp)/.test(id)) return ["anti_tank"];
    if (/^(anti_air|aa_imp)/.test(id)) return ["anti_air"];
    if (id === "railway_gun_1") return ["railway_gun"];
    return ["artillery"];
  }
  if (d.tab === "infantry") {
    if (/^(inf_eq|inf_imp|inf_at|winter_gear|desert_gear)/.test(id)) {
      return ["infantry_equipment"];
    }
    if (/^support_(eq|imp)/.test(id)) return ["support_equipment"];
    if (id.startsWith("motorized")) return ["motorized"];
  }
  return null;
}

/** By WW_TECH_IDS index: the equipment a tech serves (TechUse). */
export const TECH_USE: readonly TechUse[] = WW_TECH_IDS.map(useOf);

/** Where a tech's slot counts for the AI's caps: the sea, the air (radar too), else the land. */
export function techDomain(id: WwTechId): "land" | "sea" | "air" {
  const d = WW_TECHS[id];
  if (d.branch === "naval") return "sea";
  if (d.branch === "air" || id.startsWith("radar")) return "air";
  return "land";
}

// ---- Weights (내 판단, changes §5) ----

const RESEARCH_TABS = TECH_TABS.length;
const tabIx = (t: TechTab) => TECH_TABS.indexOf(t);

/** Area weight by TECH_TABS (0..100), per AI personality. */
const PERSONA_AREA: Readonly<
  Record<ResearchPersona, Partial<Record<TechTab, number>>>
> = {
  aggressor: {
    infantry: 60,
    support: 40,
    armour: 65,
    artillery: 60,
    naval: 30,
    air: 50,
    electronics: 35,
    industry: 65,
  },
  democracy: {
    infantry: 55,
    support: 40,
    armour: 40,
    artillery: 50,
    naval: 45,
    air: 55,
    electronics: 55,
    industry: 70,
  },
  minor: {
    infantry: 70,
    support: 40,
    armour: 30,
    artillery: 60,
    naval: 20,
    air: 15,
    electronics: 30,
    industry: 65,
  },
};

/** The majors' own leanings (the old COUNTRY_ORDER's meaning) over their personality's. */
const COUNTRY_AREA: Readonly<
  Partial<Record<CountryTag, Partial<Record<TechTab, number>>>>
> = {
  DEU: { armour: 85, air: 70, industry: 70 },
  SUN: { infantry: 80, artillery: 80, armour: 70, naval: 15, air: 40 },
  GBR: { naval: 70, air: 70, electronics: 70, armour: 35 },
  USA: {
    industry: 85,
    naval: 60,
    air: 70,
    electronics: 65,
    infantry: 60,
    armour: 55,
  },
  JPN: { naval: 80, air: 70, armour: 40 },
  ITA: { naval: 50, air: 55 },
  FRA: { infantry: 65, artillery: 70, support: 55, industry: 60 },
};

/**
 * ww81: techs valued for their effect, not for gear (+20): what a country
 * is known for beyond its catalogue. Gear techs are valued by
 * catalogueTechValues instead (TechValue.ts), shaped by PROGRAMME.
 */
const FAVOURED_STAT: Readonly<
  Partial<Record<CountryTag, readonly WwTechId[]>>
> = {
  DEU: ["radar_1"],
  GBR: [
    "sonar_2",
    "radar_1",
    "radar_2",
    "radar_3",
    "naval_radar_2",
    "convoy_escort_2",
    "hedgehog",
  ],
  USA: ["tools_2", "construction_2"],
  FRA: ["fortification_2", "art_imp_1"],
  SUN: ["inf_imp_1", "inf_imp_2", "art_imp_1", "art_imp_2", "at_imp_1"],
};

/**
 * ww81: percent on the catalogue gain of a group (others 100): national
 * character. Keys: tanks (all tank groups), light, medium, heavy, cas,
 * fighter, strat, carrier (cv_ planes), naval_bomber, artillery, anti_tank.
 */
const PROGRAMME: Readonly<
  Partial<Record<CountryTag, Readonly<Record<string, number>>>>
> = {
  DEU: { medium: 130, cas: 130, fighter: 120, strat: 50 },
  SUN: { medium: 140, artillery: 130, cas: 130 },
  USA: { strat: 130, carrier: 130, medium: 110 },
  GBR: { fighter: 130, strat: 120, medium: 90 },
  JPN: { carrier: 140, naval_bomber: 130, tanks: 70 },
  ITA: { light: 110, naval_bomber: 110 },
  FRA: { heavy: 120, anti_tank: 120, artillery: 120 },
};

/** The programme keys a catalogue group answers to. */
function programmeKeys(group: string): string[] {
  const [kind, sub] = group.split(":");
  if (kind === "tank") return ["tanks", sub];
  if (kind === "gun") return [sub];
  if (kind !== "plane") return [];
  const out: string[] = [];
  if (sub.startsWith("cv_")) out.push("carrier");
  if (sub === "fighter" || sub === "heavy_fighter" || sub === "cv_fighter") {
    out.push("fighter");
  } else if (sub === "cas" || sub === "cv_cas") out.push("cas");
  else if (sub === "strat_bomber") out.push("strat");
  else if (sub === "naval_bomber" || sub === "cv_naval_bomber") {
    out.push("naval_bomber");
  }
  return out;
}

/**
 * The three leans an AI rolls one of per game (+20 on the programme of the
 * groups): a predicate on the catalogue group.
 */
const LEANS_DEFAULT: readonly ((g: string) => boolean)[] = [
  (g) => g.startsWith("tank:"),
  (g) => g.startsWith("plane:"),
  (g) => g.startsWith("ship:"),
];
const LEANS_BY_TAG: Readonly<
  Partial<Record<CountryTag, readonly ((g: string) => boolean)[]>>
> = {
  DEU: [
    (g) => g.startsWith("tank:"),
    (g) => g.startsWith("plane:"),
    (g) => g === "ship:ss",
  ],
  SUN: [
    (g) => g.startsWith("tank:"),
    (g) => g.startsWith("gun:"),
    (g) => g.startsWith("plane:"),
  ],
};

const DESIGN_TYPES: ReadonlySet<EquipmentType> = new Set<EquipmentType>([
  "plane_design",
  "tank_design",
]);

/** The equipment lines a catalogue group is built on ("ship": a naval line). */
function groupTypes(group: string): readonly EquipmentType[] | "ship" {
  const [kind, sub] = group.split(":");
  switch (kind) {
    case "tank":
      return [sub === "light" ? "light_tank" : "medium_tank"];
    case "plane":
      return [sub as EquipmentType];
    case "gun":
      return [sub as EquipmentType];
    case "ship":
      return "ship";
    case "sup":
      return [sub === "transport" ? "motorized" : "support_equipment"];
    default:
      return ["infantry_equipment"];
  }
}

/** Percent of its lines' factories on `types` (design lines count as the type they stand for). */
function lineSharePct(
  i: ResearchScoreInput,
  types: readonly EquipmentType[],
): number {
  let total = 0;
  let on = 0;
  for (const [t, n] of Object.entries(i.lineFactories)) {
    if (n === undefined || n <= 0 || DESIGN_TYPES.has(t as EquipmentType)) {
      continue;
    }
    total += n;
    if (types.includes(t as EquipmentType)) on += n;
  }
  return total > 0 ? Math.floor((on * 100) / total) : 0;
}

/** weight × programme ÷ 100, in percent, of a catalogue group for this input. */
function groupMult(i: ResearchScoreInput): (group: string) => number {
  const prog = i.human ? undefined : PROGRAMME[i.tag];
  const leans = LEANS_BY_TAG[i.tag] ?? LEANS_DEFAULT;
  const lean = i.human
    ? undefined
    : leans[wwRoll(i.seed, P_RESEARCH_PROG, i.smallID) % leans.length];
  return (group) => {
    const types = groupTypes(group);
    const weight =
      types === "ship"
        ? i.navalLines > 0
          ? 60
          : 30
        : 30 + Math.min(70, 3 * lineSharePct(i, types));
    let pct = 100;
    if (prog !== undefined) {
      for (const key of programmeKeys(group)) {
        const v = prog[key];
        if (v !== undefined) pct = pct === 100 ? v : Math.max(pct, v);
      }
    }
    if (lean?.(group) === true) pct += 20;
    return Math.floor((weight * pct) / 100);
  };
}

/** The role's weight (an AI's; a 1945 tech waits for the unlimited game). */
const ROLE_WEIGHT: Readonly<Record<TechRole, number>> = {
  gen: 20,
  imp: 10,
  module: 8,
  chassis: 5,
  unit: 5,
  eco: 12,
  post: -20,
};

/** A human's leaning (RESEARCH_LEANS order): what it adds to each tab. */
const LEAN_AREA: readonly Partial<Record<TechTab, number>>[] = [
  {},
  { infantry: 35, support: 30, armour: 35, artillery: 35 },
  { naval: 50, air: 10 },
  { air: 50, electronics: 15 },
  { industry: 50, electronics: 25 },
];

/**
 * The tabs a strict slot of each leaning takes techs from (RESEARCH_LEANS
 * order); balanced: none, the slot is not strict.
 */
const LEAN_TABS: readonly (readonly TechTab[])[] = [
  [],
  ["infantry", "support", "armour", "artillery"],
  ["naval"],
  ["air"],
  ["industry", "electronics"],
];

/** Whether `tab` is in the area of leaning `lean` (a RESEARCH_LEANS index). */
export function leanHasTab(lean: number, tab: TechTab): boolean {
  return (LEAN_TABS[lean] ?? []).includes(tab);
}

/** Special troops an AI fields (the old wantsTech / wantsP4): the rest it never researches. */
const MARINE_COUNTRIES: readonly CountryTag[] = ["GBR", "USA", "JPN"];
const CARRIER_NAVIES: readonly CountryTag[] = ["GBR", "USA", "JPN"];

function aiWants(i: ResearchScoreInput, id: WwTechId): boolean {
  if (
    id === "marines" ||
    id === "marines_2" ||
    id.startsWith("landing_craft")
  ) {
    return MARINE_COUNTRIES.includes(i.tag);
  }
  if (id === "paratroopers" || id === "para_2") {
    return i.persona === "aggressor";
  }
  if (
    id.startsWith("cv_") ||
    id === "carrier_deck_2" ||
    id.startsWith("carrier_aviation")
  ) {
    return CARRIER_NAVIES.includes(i.tag);
  }
  return true;
}

/** The area weights by TECH_TABS index of the input (AI: persona and country; human: its lines and leaning). */
export function researchAreaWeights(i: ResearchScoreInput): number[] {
  const out = new Array<number>(RESEARCH_TABS).fill(0);
  if (!i.human) {
    const base = PERSONA_AREA[i.persona];
    const own = COUNTRY_AREA[i.tag] ?? {};
    for (let t = 0; t < RESEARCH_TABS; t++) {
      const tab = TECH_TABS[t];
      out[t] = own[tab] ?? base[tab] ?? 0;
    }
    return out;
  }
  // A human has no personality: its lines say what it builds.
  let total = 0;
  const byTab = new Array<number>(RESEARCH_TABS).fill(0);
  for (const [type, n] of Object.entries(i.lineFactories)) {
    if (n === undefined || n <= 0) continue;
    total += n;
    const tab = tabOfEquipment(type as EquipmentType);
    if (tab !== null) byTab[tabIx(tab)] += n;
  }
  const lean = LEAN_AREA[i.lean] ?? {};
  for (let t = 0; t < RESEARCH_TABS; t++) {
    const tab = TECH_TABS[t];
    let w = tab === "industry" ? 55 : tab === "electronics" ? 45 : 40;
    if (total > 0) w += Math.floor((byTab[t] * 40) / total);
    if (tab === "naval" && i.navalLines > 0) w += 20;
    out[t] = Math.min(100, w + (lean[tab] ?? 0));
  }
  return out;
}

function tabOfEquipment(t: EquipmentType): TechTab | null {
  switch (t) {
    case "infantry_equipment":
    case "support_equipment":
    case "motorized":
      return "infantry";
    case "artillery":
    case "anti_tank":
    case "anti_air":
    case "railway_gun":
      return "artillery";
    case "light_tank":
    case "medium_tank":
    case "tank_design":
      return "armour";
    case "convoy":
    case "floating_harbor":
      return "naval";
    case "flying_bomb":
    case "ballistic_rocket":
    case "atomic_bomb":
      return null;
    default:
      return "air";
  }
}

/**
 * The either/or line (changes §2.4) a country takes: the one it has taken,
 * else one rolled once a game (seeded) — concentrated : dispersed 70:30 for
 * an aggressor, 80:20 the United States, 40:60 Britain, 30:70 the Soviet
 * Union, 50:50 anyone else.
 */
export function preferredExclusiveLine(i: ResearchScoreInput): number {
  for (const id of WW_TECH_IDS) {
    const x = WW_TECHS[id].exclusive;
    if (x === undefined || x.group !== INDUSTRY_ORG) continue;
    if (i.researched.has(id) || i.running.includes(id)) return x.line;
  }
  const concentratedPct =
    i.tag === "USA"
      ? 80
      : i.tag === "GBR"
        ? 40
        : i.tag === "SUN"
          ? 30
          : i.persona === "aggressor"
            ? 70
            : 50;
  return wwRoll(i.seed, P_RESEARCH_EXCL, i.smallID) % 100 < concentratedPct
    ? 0
    : 1;
}

/** Whether the country builds something of `use` (a line of those types, or a naval line). */
function builds(i: ResearchScoreInput, use: TechUse): boolean {
  if (use === null) return true;
  if (use === "ship") return i.navalLines > 0;
  return use.some((t) => (i.lineFactories[t] ?? 0) > 0);
}

/**
 * The score of every tech by WW_TECH_IDS index for this input: null for a
 * tech it never researches (an AI: a sea tech without a navy, a plane tech
 * without planes, a special troop it does not field; anyone: the other line
 * of the either/or pair), else an integer — higher first, ties by
 * WW_TECH_IDS order. A human's tech for a kind it builds none of is pushed
 * back (−40), not left out, so a late air force is not far behind.
 */
export function researchScores(i: ResearchScoreInput): (number | null)[] {
  const area = researchAreaWeights(i);
  const favoured = new Set(FAVOURED_STAT[i.tag] ?? []);
  const catalogue = hasCatalogue(i.tag);
  const value = catalogue
    ? catalogueTechValues(i.tag, i.researched, groupMult(i))
    : null;
  const sit = i.situation;
  const total = totalFactories(i);
  const line = preferredExclusiveLine(i);
  const planes = PLANES_ALL.some((t) => (i.lineFactories[t] ?? 0) > 0);
  const airShare = area[tabIx("air")];
  const bonus = new Set(i.bonusKeys);
  const shared = new Map(i.shared);
  return WW_TECH_IDS.map((id, k) => {
    const d = WW_TECHS[id];
    if (d.retired === true) return null;
    if (d.exclusive !== undefined && d.exclusive.line !== line) return null;
    const use = TECH_USE[k];
    const built = builds(i, use);
    if (!i.human) {
      if (use === "ship" && !i.coastal) return null;
      // An AI without planes (a minor) leaves the air war out.
      if (d.tab === "air" && !planes && airShare < 20) return null;
      if (!aiWants(i, id)) return null;
      // A minor leaves out the tanks it has no line for.
      if (!catalogue && d.tab === "armour" && use === TANKS && !built) {
        return null;
      }
    }
    // A catalogue country's modules and chassis are gates (ww81): full weight.
    const role =
      catalogue && (d.role === "module" || d.role === "chassis")
        ? ROLE_WEIGHT.eco
        : ROLE_WEIGHT[d.role];
    let s = area[tabIx(d.tab)] + role;
    // Need: its share of the lines that use the tech, at most 25 (ww81; B7).
    if (use !== null) {
      if (built) {
        const share =
          use === "ship"
            ? 25
            : total > 0
              ? Math.min(25, lineSharePct(i, use))
              : 0;
        s += d.role === "gen" || d.role === "imp" ? share : share >> 1;
        // At least a little: a line it runs is a line it should keep current.
        if (share > 0) s += 2;
      } else if (i.human) s -= 40;
    }
    if (bonus.has(id) || bonus.has(d.branch)) s += 25;
    s += Math.floor((shared.get(id) ?? 0) / 2);
    // Catch-up: 5 a year behind its year, at most 15.
    const behind = Math.floor((i.day - yearStartDay(d.year)) / 365);
    if (behind > 0) s += Math.min(15, behind * 5);
    if (favoured.has(id)) s += 20;
    if (value !== null) s += value[k];
    if (sit !== undefined) s += situationBonus(sit, id);
    s -= Math.floor(aheadPct(d.year, i.day) / 2);
    return s + (wwRoll(i.seed, P_RESEARCH, i.smallID, k) % 11);
  });
}

function hasCatalogue(tag: CountryTag): boolean {
  return (HIST_CATALOGUE as Record<string, unknown>)[tag] !== undefined;
}

function totalFactories(i: ResearchScoreInput): number {
  let n = 0;
  for (const [t, f] of Object.entries(i.lineFactories)) {
    if (f !== undefined && f > 0 && !DESIGN_TYPES.has(t as EquipmentType))
      n += f;
  }
  return n;
}

/** What the war asks for now (ResearchScoreInput.situation). */
function situationBonus(
  sit: NonNullable<ResearchScoreInput["situation"]>,
  id: WwTechId,
): number {
  let b = 0;
  if (sit.antiTank === 1 && /^(anti_tank|at_imp)/.test(id)) b += 25;
  if (sit.antiTank === -1 && /^tank_gun/.test(id)) b += 25;
  if (
    sit.airLosses === true &&
    /^(fighter|aircraft_cannon|aero_engine|air_protection)/.test(id)
  ) {
    b += 20;
  }
  if (
    sit.shortResource === true &&
    /^(synthetic_|metal_substitute|rubber_)/.test(id)
  ) {
    b += 25;
  }
  return b;
}

/** One tech's score (researchScores' value; the screens' "next pick" and tests). */
export function researchScore(
  i: ResearchScoreInput,
  tech: WwTechId,
): number | null {
  return researchScores(i)[WW_TECH_IDS.indexOf(tech)];
}

/** The leaning id of a RESEARCH_LEANS index (balanced when out of range). */
export function researchLeanOf(index: number): (typeof RESEARCH_LEANS)[number] {
  return RESEARCH_LEANS[index] ?? "balanced";
}
