// World War 1936 P1: the AI economy (spec §12, pre-flight §8.1). An AI
// country decides every WW_AI_PERIOD_DAYS days, inside its own daily step
// (WwEconomy.stepCountry, so on its smallID % 7 tick): laws, construction,
// lines, research, trade, always in that order. Between those turns it
// reacts on the day something falls free (Task 9 balance ruling): an empty
// research slot, idle military factories, civilian factories the queue
// cannot take. aiPlan and aiReactPlan are pure functions of plain data;
// aiEconomyTick gathers that data and runs the orders through the functions
// a human's orders use (a refused order is skipped). No randomness: every
// tie goes to the lower id or the earlier list entry.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { AIR_TYPES } from "@openfront/engine-api/ww1936/AirTypes";
import { COUNTRIES, CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  BuildingId,
  CONSCRIPTION_LAWS,
  CountryLaws,
  DOCTRINE_DOMAIN,
  DoctrineSchool,
  EQUIP_KEYS,
  equipKey,
  EQUIPMENT_GENS,
  EQUIPMENT_TYPES,
  EquipmentType,
  LAW_LADDERS,
  LawKind,
  LawValue,
  MAX_INFRA,
  RESOURCE_COUNT,
  RESOURCE_IDS,
  ResourceId,
  WW_AI_PERIOD_DAYS,
  WW_MAX_CIVS_PER_PROJECT,
  WW_MAX_LINE_FACTORIES,
  WW_MAX_LINES,
  WW_MAX_QUEUE,
  WW_MAX_TRADE_CIVS,
  WW_MAX_TRADES,
  WW_TECH_IDS,
  WW_TRADE_UNITS_PER_CIV,
  WwOrderBlock,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  NavalLineOrder,
  SHIP_CLASSES,
  SHIP_GENS,
  ShipClass,
  WW_MAX_DOCKS_PER_LINE,
  WW_MAX_NAVAL_LINES,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import {
  dealUnitsOf,
  exportRoomOf,
  freeResearchSlot,
  lawBlockOf,
  payableCivs,
  QueuedBuild,
  queuedInRegion,
  researchBlockOf,
} from "@openfront/engine-lib/ww1936/EconomyChecks";
import {
  aheadPct,
  effCapBp,
  extraction,
} from "@openfront/engine-lib/ww1936/EconomyRules";
import { EQUIPMENT, genTech } from "@openfront/engine-lib/ww1936/Equipment";
import { fuelGain } from "@openfront/engine-lib/ww1936/FuelRules";
import { navalLineClass } from "@openfront/engine-lib/ww1936/NavalLineRules";
import { isNoStrike } from "@openfront/engine-lib/ww1936/NoStrike";
import { lawCost, LawCtx } from "@openfront/engine-lib/ww1936/PoliticsRules";
import { shipGenTech } from "@openfront/engine-lib/ww1936/ShipStats";
import { isRetiredTech, WW_TECHS } from "@openfront/engine-lib/ww1936/WwTechs";
import type { Player } from "../../game/Game";
import type { WwDepth } from "../depth/WwDepth";
import { capitalRegion } from "../land/LandStartRun";
import {
  aiMainBase,
  capitalsOf,
  fleetCounts,
  invasionRouteSrs,
} from "../navy/AiNavy";
import { navalPort, navalPortsOf } from "../navy/Ports";
import { convoysOf } from "./Buildings";
import { moveBuild, queueBuild, usedSlots } from "./Construction";
import { fuelCapOf } from "./Fuel";
import { lawCtxOf, setLaw } from "./LawsRun";
import { addLine, changeLine, moveLine, setLineFactories } from "./Production";
import { startResearch } from "./ResearchRun";
import { closeTrade, openTrade, tradePartners } from "./Trade";
import type { CountryEconomy, WwEconomy } from "./WwEconomy";

// ---- Personalities and targets (spec §12.1–§12.2) ----

export type AiPersonality = "aggressor" | "democracy" | "minor";

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

export function aiPersonality(tag: CountryTag): AiPersonality {
  if (AGGRESSORS.includes(tag)) return "aggressor";
  if (DEMOCRACIES.includes(tag)) return "democracy";
  return "minor";
}

/**
 * Spec §12.1: from this day an AI builds military factories. The
 * aggressors' moved from 1937-07 to 1936-07 (Task 9 balance: Germany's
 * Four Year Plan and the Soviet five-year plans rearmed from 1936; the
 * later date left Germany at 28 military factories in 1939-09, §16 wants 35).
 */
export const AI_SWITCH_DAY: Readonly<Record<AiPersonality, number>> = {
  aggressor: dayOfDate("1936-07-01"),
  democracy: dayOfDate("1939-01-01"),
  minor: dayOfDate("1938-01-01"),
};

/** After its switch and at peace, an AI queues this many military factories to one civilian (R6.2). */
export const AI_MIL_PER_CIV: Readonly<Record<AiPersonality, number>> = {
  aggressor: 3,
  democracy: 3,
  minor: 3,
};

/** P4 spec §17.5: military factories queued to one dockyard while short of the target. */
export const AI_MIL_PER_DOCK = 4;
/**
 * P4 spec §17.5: dockyard targets (the United States' only at war; any
 * other country builds none beyond its own).
 */
export function aiDockTarget(tag: CountryTag, atWar: boolean): number {
  switch (tag) {
    case "GBR":
      return 30;
    case "USA":
      return atWar ? 40 : 0;
    case "JPN":
      return 25;
    case "DEU":
      return 15;
    case "ITA":
      return 12;
    case "FRA":
      return 14;
    case "SUN":
      return 12;
    default:
      return 0;
  }
}

const DAY_1938 = dayOfDate("1938-01-01");
const DAY_1939 = dayOfDate("1939-01-01");

/** A line target: an equipment, or `tank` (medium once researched, else light). */
export type AiLineSlot = EquipmentType | "tank";

/**
 * Spec §12.2: line targets, percent of the working military factories.
 * P2 Task 11 (controller ruling 3): a major's support share is 10 (from
 * 5, out of the rifles): every 1936 major template has engineers or
 * recon, 35 support equipment a German division against 900 rifles, so
 * 5% left the support stock at 0 and the 50% fill gate shut training.
 * P4 lane AI: a major's planes come from aiAirShares instead of its
 * fighter and bomber rows (spec §17.5); the ground rows share the rest.
 */
export const AI_LINE_SHARES: Readonly<
  Record<"major" | "minor", Readonly<Partial<Record<AiLineSlot, number>>>>
> = {
  major: {
    infantry_equipment: 35,
    support_equipment: 10,
    artillery: 15,
    anti_tank: 5,
    anti_air: 5,
    motorized: 5,
    tank: 15,
    fighter: 5,
    bomber: 5,
  },
  minor: {
    infantry_equipment: 60,
    support_equipment: 10,
    artillery: 20,
    anti_tank: 10,
  },
};

/**
 * P2 Task 11 (controller ruling 3): a major whose support equipment stock
 * is under this many (about ten divisions' engineers and recon) moves this
 * many points from rifles to support until it recovers: the war's
 * reinforcement eats the support line, and a template whose lowest fill
 * is under 50% stops all training.
 */
export const AI_SUPPORT_RESERVE = 400;
export const AI_SUPPORT_SHORT_PTS = 5;

/**
 * A major's lines lean towards its doctrine (percentage points on top of
 * AI_LINE_SHARES.major; each row sums to 0): mobile warfare builds tanks
 * and trucks, mass assault rifles and guns, superior firepower guns and
 * support, the grand battleplan anti-tank guns and artillery. Mobile
 * warfare's vehicles come out of guns and bombers, not rifles (Task 9: the
 * 1939 Wehrmacht was an infantry army; §16 wants 1.2M men).
 */
export const AI_SCHOOL_TILT: Readonly<
  // P4: the sea and air schools tilt nothing here (Task 10's).
  Partial<Record<DoctrineSchool, Readonly<Partial<Record<AiLineSlot, number>>>>>
> = {
  mobile: { tank: 5, motorized: 5, artillery: -5, bomber: -5 },
  mass: {
    infantry_equipment: 10,
    artillery: 5,
    motorized: -5,
    tank: -5,
    bomber: -5,
  },
  firepower: {
    artillery: 5,
    support_equipment: 5,
    infantry_equipment: -5,
    tank: -5,
  },
  battleplan: { anti_tank: 5, artillery: 5, tank: -5, bomber: -5 },
};

const SCHOOL_OF: Readonly<Partial<Record<CountryTag, DoctrineSchool>>> = {
  DEU: "mobile",
  SUN: "mass",
  ITA: "firepower",
  JPN: "mass",
  GBR: "firepower",
  USA: "firepower",
  FRA: "battleplan",
};

/** The land doctrine an AI opens (pre-flight R6.8). */
export function aiSchool(tag: CountryTag): DoctrineSchool {
  const s = SCHOOL_OF[tag];
  if (s !== undefined) return s;
  // The Commonwealth follows Britain; everyone else plans a defence.
  return aiPersonality(tag) === "democracy" ? "firepower" : "battleplan";
}

/** What the aircraft shares look at (spec §17.5): the war, world tension. */
export interface AiAirShareCtx {
  atWar: boolean;
  wtBp: number;
}

/**
 * P4 spec §17.5: a major's aircraft lines, percent (they replace P1's
 * fighter 5 and bomber 5; the ground lines give up the difference):
 * fighters 8, heavy fighters 1, close support 3 (Germany, the Soviet Union
 * and Japan 5), tactical bombers 3, naval bombers 2 (Japan, Britain, the
 * United States and Italy 4), transports 1 (Germany, the Soviet Union),
 * carrier wings 2 (Japan, the United States, Britain: fighters and torpedo
 * bombers). Strategic bombers (Task 10, no dates: the situation): Britain
 * 3 once at war or world tension reaches 50%, the United States 4 at war.
 */
export function aiAirShares(
  tag: CountryTag,
  ctx: AiAirShareCtx,
): Partial<Record<EquipmentType, number>> {
  const carrier = CARRIER_NAVIES.includes(tag) ? 1 : 0;
  let strat = 0;
  if (tag === "GBR" && (ctx.atWar || ctx.wtBp >= 5000)) strat = 3;
  if (tag === "USA" && ctx.atWar) strat = 4;
  return {
    fighter: AI_FIGHTER_SHARE[tag] ?? 8,
    heavy_fighter: 1,
    cas: ["DEU", "SUN", "JPN"].includes(tag) ? 5 : 3,
    bomber: 3,
    naval_bomber: ["JPN", "GBR", "USA", "ITA"].includes(tag) ? 4 : 2,
    strat_bomber: strat,
    transport_plane: tag === "DEU" || tag === "SUN" ? 1 : 0,
    cv_fighter: carrier,
    cv_naval_bomber: carrier,
  };
}

/**
 * Task 15 (내 판단): fighter shares off the 8 — Germany's rearmament put
 * the Luftwaffe first (it outbuilt the RAF 1936–39; at 8 its fighters were
 * 1,340 to the Allies' 2,400 in 1939 and gone in a month), France's
 * aircraft industry lagged (the Armée de l'Air had some 600 modern fighters
 * in 1940).
 */
export const AI_FIGHTER_SHARE: Readonly<Partial<Record<CountryTag, number>>> = {
  DEU: 12,
  FRA: 6,
};

const AIR_EQUIPMENT: ReadonlySet<EquipmentType> = new Set(AIR_TYPES);

/** `n` over the weights: floors, then one each to the biggest remainders (ties: list order). */
function shareOut(n: number, weights: readonly number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0 || n <= 0) return weights.map(() => 0);
  const out = weights.map((w) => Math.floor((n * w) / total));
  let left = n - out.reduce((a, b) => a + b, 0);
  const order = weights
    .map((w, k) => ({ k, r: (n * w) % total }))
    .sort((a, b) => b.r - a.r || a.k - b.k);
  for (const { k } of order) {
    if (left <= 0) break;
    out[k]++;
    left--;
  }
  return out;
}

/** Today's line targets in percent, by equipment (spec §12.2; P4 spec §17.5 for a major's planes). */
export function aiLineShares(
  tag: CountryTag,
  major: boolean,
  researched: ReadonlySet<WwTechId>,
  infSurplus: boolean,
  supportShort = false,
  ctx: AiAirShareCtx = { atWar: false, wtBp: 0 },
): Record<EquipmentType, number> {
  const out = Object.fromEntries(EQUIPMENT_TYPES.map((t) => [t, 0])) as Record<
    EquipmentType,
    number
  >;
  const base = AI_LINE_SHARES[major ? "major" : "minor"];
  const tilt: Readonly<Partial<Record<AiLineSlot, number>>> = major
    ? (AI_SCHOOL_TILT[aiSchool(tag)] ?? {})
    : {};
  const tank: EquipmentType = researched.has("medium_tank_1")
    ? "medium_tank"
    : "light_tank";
  const air = major ? aiAirShares(tag, ctx) : {};
  for (const slot of [...EQUIPMENT_TYPES, "tank"] as const) {
    const t = slot === "tank" ? tank : slot;
    const own =
      major && AIR_EQUIPMENT.has(t) ? (air[t] ?? 0) : (base[slot] ?? 0);
    out[t] += own + (tilt[slot] ?? 0);
  }
  for (const t of EQUIPMENT_TYPES) out[t] = Math.max(0, out[t]);
  if (major) {
    // P4: the planes take their points; the ground lines share the rest
    // as they shared theirs (largest remainders, EQUIPMENT_TYPES order).
    let planes = 0;
    for (const t of EQUIPMENT_TYPES) if (AIR_EQUIPMENT.has(t)) planes += out[t];
    const ground = EQUIPMENT_TYPES.filter((t) => !AIR_EQUIPMENT.has(t));
    const scaled = shareOut(
      Math.max(0, 100 - planes),
      ground.map((t) => out[t]),
    );
    ground.forEach((t, k) => (out[t] = scaled[k]));
  }
  // Spec §12.2: rifles pile up, so five points go to the guns (R6.6).
  if (infSurplus) {
    out.infantry_equipment -= 5;
    out.artillery += 5;
  }
  // P2 Task 11: support runs short (a major's templates all need it).
  if (major && supportShort) {
    const pts = Math.min(AI_SUPPORT_SHORT_PTS, out.infantry_equipment);
    out.infantry_equipment -= pts;
    out.support_equipment += pts;
  }
  for (const t of EQUIPMENT_TYPES) out[t] = Math.max(0, out[t]);
  return out;
}

// ---- Research priorities (spec §12.2, pre-flight R6.8) ----

type TechGroup =
  | "tools"
  | "infantry"
  | "guns"
  | "armour"
  | "construction"
  | "industry"
  | "electronics"
  | "air"
  | "school";

const GROUP_TECHS: Readonly<
  Record<Exclude<TechGroup, "school">, readonly WwTechId[]>
> = {
  tools: ["tools_1", "tools_2", "tools_3", "tools_4"],
  infantry: [
    "inf_eq_1",
    "inf_eq_2",
    "inf_eq_3",
    "support_eq_1",
    "support_eq_2",
    // P2 land techs (Task 6, pre-flight A1): the support companies.
    "engineer_company",
    "recon_company",
    "field_hospital",
    "logistics_company",
  ],
  guns: [
    "artillery_1",
    "artillery_2",
    "artillery_3",
    "anti_tank_1",
    "anti_tank_2",
    "anti_air_1",
    "anti_air_2",
  ],
  armour: [
    "motorized_1",
    "light_tank_1",
    "light_tank_2",
    "medium_tank_1",
    "medium_tank_2",
    "medium_tank_3",
  ],
  construction: [
    "construction_1",
    "construction_2",
    "construction_3",
    "fortification_1",
    "rail_1",
  ],
  industry: [
    "output_1",
    "output_2",
    "excavation_1",
    "excavation_2",
    "flexible_line",
  ],
  electronics: [
    "electronics_1",
    "computing_1",
    "computing_2",
    "signal_company",
  ],
  air: ["fighter_1", "fighter_2", "fighter_3", "bomber_1", "bomber_2"],
};

const PERSONALITY_ORDER: Readonly<Record<AiPersonality, readonly TechGroup[]>> =
  {
    aggressor: [
      "tools",
      "infantry",
      "guns",
      "armour",
      "construction",
      "school",
    ],
    democracy: [
      "construction",
      "tools",
      "infantry",
      "guns",
      "electronics",
      "school",
    ],
    minor: ["construction", "infantry", "guns", "school"],
  };

/**
 * The majors' own leanings (controller guidance): Germany armour and air,
 * the Soviet Union mass infantry and guns, Britain air and industry (no
 * navy in P1), the United States industry, France its battleplan and
 * infantry. Italy and Japan keep the aggressor list.
 */
const COUNTRY_ORDER: Readonly<
  Partial<Record<CountryTag, readonly TechGroup[]>>
> = {
  // Task 15: the air group second (the Bf 109E): fifth, Germany flew 1936
  // fighters against Britain's 1940 ones over France in 1939–40 and lost
  // them at ten to one.
  DEU: ["tools", "air", "armour", "school", "infantry", "guns", "construction"],
  SUN: ["infantry", "guns", "school", "tools", "construction", "armour"],
  GBR: [
    "construction",
    "tools",
    "air",
    "electronics",
    "infantry",
    "guns",
    "school",
  ],
  USA: [
    "construction",
    "tools",
    "industry",
    "electronics",
    "infantry",
    "guns",
    "school",
  ],
  FRA: ["school", "infantry", "guns", "construction", "tools", "electronics"],
};

/** Every list ends so that no slot idles while anything is left (R6.8). */
const TAIL: readonly TechGroup[] = ["industry", "electronics", "air"];

/** P2 special troops (Task 6 brief): marines for these, paratroopers for the aggressors. */
const MARINE_COUNTRIES: readonly CountryTag[] = ["GBR", "USA", "JPN"];

/** Whether `tag`'s AI fields this special troop type at all (no marines for Germany). */
function wantsTech(tag: CountryTag, t: WwTechId): boolean {
  if (t === "marines") return MARINE_COUNTRIES.includes(tag);
  if (t === "paratroopers") return aiPersonality(tag) === "aggressor";
  return true;
}

/**
 * A group's techs for `tag` (P2 Task 6, pre-flight A1): the aggressors'
 * infantry adds mountain troops and paratroopers, Britain's, the United
 * States' and Japan's marines.
 */
function groupTechs(
  tag: CountryTag,
  g: Exclude<TechGroup, "school">,
): readonly WwTechId[] {
  if (g !== "infantry") return GROUP_TECHS[g];
  const extra: WwTechId[] = [];
  if (aiPersonality(tag) === "aggressor") {
    extra.push("mountaineers", "paratroopers");
  }
  if (MARINE_COUNTRIES.includes(tag)) extra.push("marines");
  return [...GROUP_TECHS[g], ...extra];
}

const TECH_INDEX: ReadonlyMap<WwTechId, number> = new Map(
  WW_TECH_IDS.map((t, i) => [t, i]),
);
const researchOrders = new Map<string, readonly WwTechId[]>();

// ---- P4 research (Task 10): the sea and air techs by the country's role ----

/** Where a tech's slot counts: land (P1, P2, synthetic oil), sea or air (P4). */
export type AiTechDomain = "land" | "sea" | "air";
const LAST_LAND_TECH = WW_TECH_IDS.indexOf("rail_1");

export function aiTechDomain(t: WwTechId): AiTechDomain {
  if (TECH_INDEX.get(t)! <= LAST_LAND_TECH) return "land";
  const d = WW_TECHS[t];
  const school = d.school === undefined ? null : DOCTRINE_DOMAIN[d.school];
  if (d.branch === "naval" || school === "sea") return "sea";
  // Radar is the air war's (detection, the radar station).
  if (d.branch === "air" || school === "air" || t.startsWith("radar")) {
    return "air";
  }
  return "land";
}

/** Spec §17.5 (내 판단): the sea doctrine each opens (Battle line, Commerce warfare, Carrier striking force). */
const SEA_SCHOOL_OF: Readonly<Partial<Record<CountryTag, DoctrineSchool>>> = {
  GBR: "fleet_in_being",
  USA: "base_strike",
  JPN: "base_strike",
  DEU: "trade_interdiction",
  ITA: "fleet_in_being",
  FRA: "fleet_in_being",
  SUN: "trade_interdiction",
};
/** Spec §17.5 (내 판단): the air doctrine (Bomber offensive, Army cooperation, Unified air command). */
const AIR_SCHOOL_OF: Readonly<Partial<Record<CountryTag, DoctrineSchool>>> = {
  GBR: "strategic_destruction",
  USA: "strategic_destruction",
  DEU: "battlefield_support",
  SUN: "battlefield_support",
  JPN: "operational_integrity",
  ITA: "operational_integrity",
  FRA: "operational_integrity",
};

/** The sea doctrine an AI follows; a minor none (its navy is destroyers and submarines). */
export function aiSeaSchool(tag: CountryTag): DoctrineSchool | null {
  return SEA_SCHOOL_OF[tag] ?? null;
}
/** The air doctrine an AI follows; a minor supports its army. */
export function aiAirSchool(tag: CountryTag): DoctrineSchool {
  return AIR_SCHOOL_OF[tag] ?? "battlefield_support";
}

/**
 * Research slots by domain, percent [land, sea, air] (내 판단, spec §17.5:
 * the naval powers in proportion to their fleets): Britain and Japan lean
 * to the sea, Germany to the air, the Soviet Union stays an army; a minor
 * with a navy (a harbor and dockyards) spares a little for destroyers
 * and submarines, nothing for planes (it builds none); a landlocked
 * country no sea techs.
 */
export const AI_RESEARCH_MIX: Readonly<
  Partial<Record<CountryTag, readonly [number, number, number]>>
> = {
  GBR: [50, 30, 20],
  USA: [50, 25, 25],
  JPN: [45, 35, 20],
  DEU: [60, 15, 25],
  ITA: [60, 20, 20],
  FRA: [65, 15, 20],
  SUN: [75, 5, 20],
};

export function aiResearchMix(
  tag: CountryTag,
  coastal: boolean,
): readonly [number, number, number] {
  const mix = AI_RESEARCH_MIX[tag];
  if (mix !== undefined) return coastal ? mix : [mix[0] + mix[1], 0, mix[2]];
  // A minor builds no planes (spec §12.2 lines): its slots are the army's,
  // and a little for destroyers and submarines when it has a navy.
  return coastal ? [95, 5, 0] : [100, 0, 0];
}

/** Spec §17.5: the navies that build carriers, and those that build capital ships too. */
const CARRIER_NAVIES: readonly CountryTag[] = ["GBR", "USA", "JPN"];
const BATTLE_NAVIES: readonly CountryTag[] = [
  "GBR",
  "USA",
  "JPN",
  "DEU",
  "ITA",
  "FRA",
];

/**
 * Spec §17.5: each one's sea and air techs first (Germany submarines and
 * close support, Britain radar and escorts, Japan carriers and torpedoes,
 * the United States carriers and bombers …); the rest of the domain
 * follows in WW_TECH_IDS order.
 */
const SEA_FOCUS: Readonly<Partial<Record<CountryTag, readonly WwTechId[]>>> = {
  DEU: ["ss_3", "torpedo_1", "dd_3", "ss_4"],
  GBR: [
    "sonar_1",
    "dd_3",
    "sonar_2",
    "naval_radar_1",
    "cv_3",
    "landing_craft_1",
  ],
  JPN: ["cv_3", "torpedo_1", "dd_3", "landing_craft_1", "cv_4"],
  USA: ["cv_3", "dd_3", "sonar_1", "landing_craft_1", "naval_radar_1", "cv_4"],
  ITA: ["bb_3", "cl_3", "ss_3", "torpedo_1"],
  FRA: ["bb_3", "dd_3", "ss_3"],
  SUN: ["ss_3", "dd_3"],
};
const AIR_FOCUS: Readonly<Partial<Record<CountryTag, readonly WwTechId[]>>> = {
  DEU: ["cas_2", "heavy_fighter_2", "radar_1", "cas_3"],
  GBR: [
    "radar_1",
    "naval_bomber_2",
    "strat_bomber_2",
    "radar_2",
    "strat_bomber_3",
  ],
  JPN: ["naval_bomber_2", "naval_bomber_3"],
  USA: [
    "strat_bomber_1",
    "naval_bomber_2",
    "strat_bomber_2",
    "radar_1",
    "strat_bomber_3",
  ],
  SUN: ["cas_2", "cas_3"],
  ITA: ["naval_bomber_2", "heavy_fighter_2"],
  FRA: ["heavy_fighter_2", "cas_2"],
};

/** Whether `tag`'s AI researches P4 tech `t` at all (its navy, its air force, its coast). */
function wantsP4(tag: CountryTag, t: WwTechId, coastal: boolean): boolean {
  const def = WW_TECHS[t];
  const major = COUNTRIES[tag].major;
  const dom = aiTechDomain(t);
  if (dom === "sea" && !coastal) return false;
  if (def.school !== undefined) {
    return def.school === aiSeaSchool(tag) || def.school === aiAirSchool(tag);
  }
  if (dom === "sea") {
    if (t.startsWith("landing_craft")) return MARINE_COUNTRIES.includes(tag);
    if (t.startsWith("cv_")) return CARRIER_NAVIES.includes(tag);
    if (t.startsWith("dd_") || t.startsWith("ss_") || t.startsWith("sonar")) {
      return true;
    }
    if (t === "torpedo_1") return true;
    return BATTLE_NAVIES.includes(tag);
  }
  if (dom === "air") {
    if (t === "carrier_aviation") return CARRIER_NAVIES.includes(tag);
    if (t.startsWith("naval_bomber")) return coastal;
    if (t.startsWith("cas_")) return true;
    return major;
  }
  return true;
}

/** A P4 domain's list: the country's focus, then the rest in WW_TECH_IDS order. */
function p4Order(
  tag: CountryTag,
  dom: "sea" | "air",
  coastal: boolean,
): WwTechId[] {
  const focus = (dom === "sea" ? SEA_FOCUS : AIR_FOCUS)[tag] ?? [];
  const out: WwTechId[] = [];
  const add = (t: WwTechId) => {
    if (
      !out.includes(t) &&
      !isRetiredTech(t) &&
      aiTechDomain(t) === dom &&
      wantsP4(tag, t, coastal)
    ) {
      out.push(t);
    }
  };
  focus.forEach(add);
  WW_TECH_IDS.slice(LAST_LAND_TECH + 1).forEach(add);
  return out;
}

/**
 * Weighted interleave (a domain is taken when it is furthest behind its
 * share; ties: land, sea, air): a naval power's list mixes its ship and
 * plane techs in among the land ones instead of after them.
 */
function interleave(
  lists: readonly (readonly WwTechId[])[],
  weights: readonly number[],
): WwTechId[] {
  const taken = lists.map(() => 0);
  const out: WwTechId[] = [];
  for (;;) {
    let best = -1;
    for (let d = 0; d < lists.length; d++) {
      if (weights[d] <= 0 || taken[d] >= lists[d].length) continue;
      if (
        best < 0 ||
        (taken[d] + 1) * weights[best] < (taken[best] + 1) * weights[d]
      ) {
        best = d;
      }
    }
    if (best < 0) return out;
    out.push(lists[best][taken[best]++]);
  }
}

/**
 * The most slots the sea and air techs may hold at once (Task 10: no
 * starving the land war): the land keeps its share rounded up, the rest
 * goes one slot at a time to the domain furthest behind its share.
 */
export function aiResearchCaps(
  mix: readonly [number, number, number],
  slotCount: number,
): { sea: number; air: number } {
  const landMin = Math.ceil((slotCount * mix[0]) / 100);
  let left = Math.max(0, slotCount - landMin);
  const caps = [0, 0];
  const w = [mix[1], mix[2]];
  while (left > 0 && (w[0] > 0 || w[1] > 0)) {
    const d =
      w[1] <= 0 || (w[0] > 0 && (caps[0] + 1) * w[1] <= (caps[1] + 1) * w[0])
        ? 0
        : 1;
    caps[d]++;
    left--;
  }
  return { sea: caps[0], air: caps[1] };
}

/**
 * The tech priority list of `tag`: the land list (its groups, the tail,
 * then every other land tech; each group in WW_TECH_IDS order; other land
 * schools and special troops it does not field left out) interleaved
 * with its sea and air lists by AI_RESEARCH_MIX. P4 Task 10: replaces the
 * foundation's interim filter (no tech after rail_1).
 */
export function aiResearchOrder(
  tag: CountryTag,
  coastal = true,
): readonly WwTechId[] {
  const key = `${tag}:${coastal ? 1 : 0}`;
  const cached = researchOrders.get(key);
  if (cached !== undefined) return cached;
  const school = aiSchool(tag);
  const groups = [
    ...(COUNTRY_ORDER[tag] ?? PERSONALITY_ORDER[aiPersonality(tag)]),
    ...TAIL,
  ];
  const seen = new Set<WwTechId>();
  const land: WwTechId[] = [];
  const add = (techs: readonly WwTechId[]) => {
    const sorted = [...techs].sort(
      (a, b) => TECH_INDEX.get(a)! - TECH_INDEX.get(b)!,
    );
    for (const t of sorted) {
      if (seen.has(t) || isRetiredTech(t) || aiTechDomain(t) !== "land") {
        continue;
      }
      seen.add(t);
      land.push(t);
    }
  };
  const schoolTechs = WW_TECH_IDS.filter((t) => WW_TECHS[t].school === school);
  for (const g of groups) {
    add(g === "school" ? schoolTechs : groupTechs(tag, g));
  }
  add(
    WW_TECH_IDS.filter((t) => {
      const s = WW_TECHS[t].school;
      return (s === undefined || s === school) && wantsTech(tag, t);
    }),
  );
  const mix = aiResearchMix(tag, coastal);
  const out = interleave(
    [land, p4Order(tag, "sea", coastal), p4Order(tag, "air", coastal)],
    mix,
  );
  researchOrders.set(key, out);
  return out;
}

/** Spec §12.2: an AI starts a tech at most this far ahead of its year. */
export const AI_MAX_AHEAD_PCT = 50;
/**
 * When nothing is that close, a slot takes a tech up to nine months early
 * rather than idle (Task 9; a full year early nearly doubles its time).
 */
export const AI_FALLBACK_AHEAD_PCT = 75;

// ---- The plan (pure) ----

export interface AiLine {
  id: number;
  /** EQUIP_KEYS index. */
  key: number;
  factories: number;
  active: number;
  effBp: number;
  /** Resources it got on the last day, per mille of its need. */
  fill: number;
}

export interface AiRegion {
  region: number;
  infra: number;
  /** Factory slots left after the built and the queued ones. */
  free: number;
  /** Infrastructure levels left after the queued ones. */
  infraRoom: number;
  occupied: boolean;
  /** Deposits, RESOURCE_IDS order. */
  res: readonly number[];
  /** P4: on a coast (a dockyard may go there). */
  coastal?: boolean;
}

export interface AiPartner {
  smallID: number;
  sameFaction: boolean;
  /** Units a day still for sale (exportRoom), RESOURCE_IDS order. */
  room: readonly number[];
}

export interface AiDeal {
  id: number;
  seller: number;
  /** RESOURCE_IDS index. */
  res: number;
  civs: number;
  /** Units a day it moves (Trade.units). */
  units: number;
}

/** Everything an AI turn looks at (pre-flight R6.13), as plain data. */
export interface AiInput {
  tag: CountryTag;
  personality: AiPersonality;
  major: boolean;
  day: number;
  /** Days of the longest running war; -1 at peace. */
  warDays: number;
  laws: CountryLaws;
  lawCooldownUntil: Readonly<Record<LawKind, number>>;
  /**
   * P3 spec §7.2 (controller ruling R10): what the law conditions read —
   * war support, world tension, the government (IDEOLOGIES index), PP.
   */
  wsBp: number;
  wtBp: number;
  ruling: number;
  ppMilli: number;
  manpower: number;
  recruitable: number;
  /** Infantry equipment in stock, every generation. */
  infStock: number;
  /** Support equipment in stock, every generation (P2 Task 11; none: plenty). */
  supStock?: number;
  freeCivMilli: number;
  /** Working military factories. */
  mil: number;
  /** Working military factories no line uses. */
  idleMil: number;
  effCapBp: number;
  lines: readonly AiLine[];
  queue: readonly QueuedBuild[];
  slots: readonly (WwTechId | null)[];
  slotCount: number;
  researched: readonly WwTechId[];
  /** RESOURCE_IDS order. */
  produced: readonly number[];
  exported: readonly number[];
  imported: readonly number[];
  /** Civilian factories it may pay for deals (payableCivs). */
  payableCivs: number;
  /** Civilian factories its open deals pay. */
  paidCivs: number;
  /** The deals it buys through, id order. */
  buying: readonly AiDeal[];
  /**
   * The countries it may buy from now (tradePartners), by smallID. Read
   * only when a resource is missing (aiInput builds it on first read).
   */
  readonly partners: readonly AiPartner[];
  /** The land regions it controls, by id. */
  regions: readonly AiRegion[];
  /** P4: it fields a navy — a harbor (a minor: and dockyards); its research takes sea techs. Default true. */
  coastal?: boolean;
  /** P4 spec §17.5: its working dockyards and their target (none or 0: it builds none). */
  docks?: number;
  dockTarget?: number;
  /**
   * P4 Task 15: oil a day its fuel wants — yesterday's use in oil, while
   * the stock is under half the capacity (0 or none: nothing).
   */
  fuelOil?: number;
  /**
   * P6 glue (W1, S): RESOURCE_IDS-ordered units the economy takes before
   * the lines (WwDepth.priorityDemand: the power plants' coal, the atomic
   * project's uranium). None: nothing.
   */
  priorityDemand?: readonly number[];
}

/**
 * Task 15 (내 판단): at most this much oil a day is bought for fuel. The
 * lines alone asked for oil, so Britain (3 oil of its own), Italy, France
 * and Japan ran dry from their first sorties and stayed short all war.
 */
export const AI_FUEL_OIL_MAX = 30;
const OIL = RESOURCE_IDS.indexOf("oil");
const RUBBER = RESOURCE_IDS.indexOf("rubber");

/**
 * P6 glue (W1, S): the units taken before the lines come on top of the
 * lines' need — without them the coal deals for the power plants read as
 * surplus and closed the next turn.
 */
export function withPriorityDemand(
  need: readonly number[],
  priority: readonly number[] | undefined,
): number[] {
  const out = [...need];
  if (priority === undefined) return out;
  for (let k = 0; k < out.length; k++) out[k] += priority[k] ?? 0;
  return out;
}

/** The trade's needs: the lines' and the fuel's oil (one unit serves both: the larger). */
export function withFuelOil(
  need: readonly number[],
  fuelOil: number,
): number[] {
  const out = [...need];
  if (fuelOil > out[OIL]) out[OIL] = fuelOil;
  return out;
}

type AiPlainOrder = Extract<
  WwOrder,
  {
    kind:
      | "build"
      | "set_law"
      | "add_line"
      | "change_line"
      | "set_line_factories"
      | "research"
      | "close_trade";
  }
>;

/**
 * An AI order: a WwOrder, but a deal names its seller by smallID; and
 * `military_first`, which moves the queue's military factories ahead of
 * the rest (move_build orders on the queue as it is then).
 */
export type AiOrder =
  | AiPlainOrder
  | { kind: "open_trade"; seller: number; resource: ResourceId; civs: number }
  | { kind: "military_first" };

/** One AI turn: its orders, in the order they run. */
export type AiPlan = AiOrder[];

/** What an AI country reacts to between its turns (aiReactions). */
export interface AiReact {
  research: boolean;
  lines: boolean;
  construction: boolean;
}

/**
 * The orders of a reaction between turns: only the steps `react` names, as
 * the full turn would write them; no laws, no trade, no retooling.
 */
export function aiReactPlan(input: AiInput, react: AiReact): AiPlan {
  const orders: AiOrder[] = [];
  const lines = planLines(input, false);
  if (react.construction) planConstruction(input, needs(lines.working), orders);
  if (react.lines) orders.push(...lines.orders);
  if (react.research) planResearch(input, orders);
  return orders;
}

/**
 * Every country's starting lines and research (aiStartSetup): the lines
 * and research of the day-0 plan, and a slot that plan leaves empty (no
 * tech close enough to its year) takes the least early tech of the
 * priority list, as a HOI4 player fills every slot at the start.
 */
export function aiStartPlan(input: AiInput): AiPlan {
  const orders: AiOrder[] = [...planLines(input, false).orders];
  planResearch(input, orders, true);
  return orders;
}

/** The orders of one AI turn, in the order they run (spec §12.2). */
export function aiPlan(input: AiInput): AiPlan {
  const orders: AiOrder[] = [];
  planLaws(input, orders);
  // The lines are decided before the construction and trade orders are
  // written: both look at what the planned lines will need tomorrow.
  const lines = planLines(input);
  const need = needs(lines.working);
  planConstruction(input, need, orders);
  orders.push(...lines.orders);
  planResearch(input, orders);
  planTrade(
    input,
    withPriorityDemand(
      withFuelOil(need, input.fuelOil ?? 0),
      input.priorityDemand,
    ),
    orders,
  );
  return orders;
}

// ---- 1. Laws ----

function economyTarget(
  i: Pick<AiInput, "personality" | "day" | "warDays">,
): LawValue {
  const war = i.warDays >= 0;
  switch (i.personality) {
    case "aggressor":
      if (i.warDays >= 365) return "total_mobilization";
      return war ? "war_economy" : "partial_mobilization";
    case "democracy":
      if (i.warDays >= 180) return "war_economy";
      if (war || i.day >= DAY_1939) return "partial_mobilization";
      return i.day >= DAY_1938 ? "early_mobilization" : "civilian";
    case "minor":
      if (i.warDays >= 365) return "war_economy";
      if (war) return "partial_mobilization";
      return i.day >= DAY_1938 ? "early_mobilization" : "civilian";
  }
}

/** What the law step reads of an AI turn's input. */
type LawInput = Pick<
  AiInput,
  | "personality"
  | "day"
  | "warDays"
  | "laws"
  | "lawCooldownUntil"
  | "wsBp"
  | "wtBp"
  | "ruling"
  | "ppMilli"
  | "manpower"
  | "recruitable"
>;

function planLaws(i: LawInput, orders: AiOrder[]): void {
  const laws: CountryLaws = { ...i.laws };
  // The conditions only (costMilli 0): setLaw charges the cost;
  // aiEconomyTick defers a law the PP cannot pay (aiLawTarget).
  const ctx: LawCtx = {
    wsBp: i.wsBp,
    wtBp: i.wtBp,
    ruling: i.ruling,
    atWar: i.warDays >= 0,
    ppMilli: i.ppMilli,
    costMilli: 0,
  };
  const allowed = (kind: LawKind, v: LawValue) =>
    lawBlockOf(laws, i.lawCooldownUntil, kind, v, i.day, ctx) === null;
  const set = (kind: LawKind, v: LawValue) => {
    orders.push({ kind: "set_law", law: kind, value: v });
    (laws as unknown as Record<LawKind, LawValue>)[kind] = v;
  };
  /** Up to `target` at once, as high as the conditions allow (R6.10). */
  const raiseTo = (kind: LawKind, target: LawValue) => {
    const ladder = LAW_LADDERS[kind];
    const now = ladder.indexOf(laws[kind]);
    for (let v = ladder.indexOf(target); v > now; v--) {
      if (allowed(kind, ladder[v])) {
        set(kind, ladder[v]);
        return;
      }
    }
  };
  raiseTo("economy", economyTarget(i));

  const cons = CONSCRIPTION_LAWS.indexOf(laws.conscription);
  if (i.warDays >= 0) {
    if (cons < CONSCRIPTION_LAWS.indexOf("extensive")) {
      raiseTo("conscription", "extensive");
    } else if (i.manpower * 100 < i.recruitable * 20) {
      // Manpower is running dry: one step up, if its conditions hold (R6.11).
      const next = CONSCRIPTION_LAWS[cons + 1];
      if (next !== undefined && allowed("conscription", next)) {
        set("conscription", next);
      }
    }
  } else if (i.personality === "aggressor" && i.day >= DAY_1938) {
    raiseTo("conscription", "extensive");
  }
}

// ---- 3. Lines (decided before 2, written after it) ----

interface PlannedLines {
  orders: AiOrder[];
  /** Tomorrow's working factories per equipment key, old and new lines. */
  working: Map<number, number>;
}

function newestGen(
  type: EquipmentType,
  researched: ReadonlySet<WwTechId>,
): number {
  for (let g = EQUIPMENT_GENS[type]; g >= 1; g--) {
    if (researched.has(genTech(type, g))) return g;
  }
  return 0;
}

function typeOf(key: number): EquipmentType {
  return EQUIP_KEYS[key][0];
}

function planLines(i: AiInput, retool = true): PlannedLines {
  const researched = new Set(i.researched);
  const shares = aiLineShares(
    i.tag,
    i.major,
    researched,
    i.infStock * 10 > i.manpower,
    (i.supStock ?? AI_SUPPORT_RESERVE) < AI_SUPPORT_RESERVE,
    { atWar: i.warDays >= 0, wtBp: i.wtBp },
  );
  // Once medium tanks are researched the tank share is theirs, and the light
  // tank lines (which keep their factories, R6.5) count against it: else a
  // country would build a second tank park beside the first.
  const mediums = researched.has("medium_tank_1");
  const shareOf = (t: EquipmentType): EquipmentType =>
    mediums && t === "light_tank" ? "medium_tank" : t;
  const assigned = new Map<EquipmentType, number>();
  const hasLine = new Set<EquipmentType>();
  for (const l of i.lines) {
    const t = typeOf(l.key);
    const s = shareOf(t);
    assigned.set(s, (assigned.get(s) ?? 0) + l.factories);
    hasLine.add(t);
  }
  // A type whose working lines all got no resources at all yesterday
  // would run new factories at the 20% floor: none go there until a deal
  // or a mine brings some (the lines keep what they have).
  const starved = new Set<EquipmentType>();
  for (const t of hasLine) {
    const working = i.lines.filter((l) => typeOf(l.key) === t && l.active > 0);
    if (working.length > 0 && working.every((l) => l.fill === 0)) {
      starved.add(t);
    }
  }
  const added = new Map<EquipmentType, number>();
  let lineCount = i.lines.length;
  // R6.4: one factory at a time to the biggest gap between the target and
  // what the lines have (ties: EQUIPMENT_TYPES order).
  for (let n = 0; n < i.idleMil; n++) {
    let best: EquipmentType | null = null;
    let bestGap = 0;
    for (const t of EQUIPMENT_TYPES) {
      if (shares[t] <= 0 || starved.has(t)) continue;
      if (newestGen(t, researched) === 0) continue;
      const lined = hasLine.has(t) || added.has(t);
      if (!lined && lineCount >= WW_MAX_LINES) continue;
      const gap = shares[t] * i.mil - 100 * (assigned.get(t) ?? 0);
      if (best === null || gap > bestGap) {
        best = t;
        bestGap = gap;
      }
    }
    if (best === null) break;
    if (!hasLine.has(best) && !added.has(best)) lineCount++;
    assigned.set(best, (assigned.get(best) ?? 0) + 1);
    added.set(best, (added.get(best) ?? 0) + 1);
  }

  const orders: AiOrder[] = [];
  const working = new Map<number, number>();
  const work = (key: number, n: number) =>
    working.set(key, (working.get(key) ?? 0) + n);
  for (const l of i.lines) work(l.key, l.active);
  for (const t of EQUIPMENT_TYPES) {
    const n = added.get(t);
    if (n === undefined) continue;
    // The type's most efficient line takes them (ties: the higher one).
    let line: AiLine | null = null;
    for (const l of i.lines) {
      if (typeOf(l.key) !== t) continue;
      if (line === null || l.effBp > line.effBp) line = l;
    }
    if (line !== null) {
      const factories = Math.min(WW_MAX_LINE_FACTORIES, line.factories + n);
      orders.push({ kind: "set_line_factories", line: line.id, factories });
      work(line.key, factories - line.factories);
    } else {
      const gen = newestGen(t, researched);
      orders.push({ kind: "add_line", equipment: t, gen, factories: n });
      work(equipKey(t, gen), n);
    }
  }
  // R6.7: one line a turn moves to a newer generation once it is nearly
  // at its efficiency cap (aiEconomyTick tries the next one if refused).
  if (retool) {
    const [first] = aiRetools(i.lines, researched, i.effCapBp);
    if (first !== undefined) orders.push(first);
  }
  return { orders, working };
}

/**
 * Every line that may move to a newer generation of its equipment, in line
 * order: one within 5 points of the efficiency cap (R6.7).
 */
export function aiRetools(
  lines: readonly AiLine[],
  researched: ReadonlySet<WwTechId>,
  effCapBp: number,
): Extract<AiOrder, { kind: "change_line" }>[] {
  const out: Extract<AiOrder, { kind: "change_line" }>[] = [];
  for (const l of lines) {
    const [t, gen] = EQUIP_KEYS[l.key];
    const newest = newestGen(t, researched);
    if (newest > gen && l.effBp >= effCapBp - 500) {
      out.push({ kind: "change_line", line: l.id, equipment: t, gen: newest });
    }
  }
  return out;
}

/** Resources a day the lines need, RESOURCE_IDS order. */
function needs(working: ReadonlyMap<number, number>): number[] {
  const need = new Array<number>(RESOURCE_COUNT).fill(0);
  for (const [key, n] of working) {
    const per = EQUIPMENT[typeOf(key)].resources;
    for (let r = 0; r < RESOURCE_COUNT; r++) need[r] += per[r] * n;
  }
  return need;
}

/** What it has of each resource: output less exports plus imports. */
function available(i: AiInput, r: number): number {
  return i.produced[r] - i.exported[r] + i.imported[r];
}

// ---- 2. Construction ----

/** Infrastructure desc, free slots desc, id asc (spec §12.2, R6.3). */
function betterRegion(a: AiRegion, b: AiRegion): boolean {
  if (a.infra !== b.infra) return a.infra > b.infra;
  if (a.free !== b.free) return a.free > b.free;
  return a.region < b.region;
}

function bestRegion(
  regions: readonly AiRegion[],
  ok: (r: AiRegion) => boolean,
): AiRegion | null {
  let best: AiRegion | null = null;
  for (const r of regions) {
    if (ok(r) && (best === null || betterRegion(r, best))) best = r;
  }
  return best;
}

/** Units a day one more infrastructure level would add to a deposit. */
function infraGain(deposit: number, infraRoom: number): number {
  const infra = MAX_INFRA - infraRoom;
  return (
    extraction(deposit, infra + 1, 100, 0) - extraction(deposit, infra, 100, 0)
  );
}

function planConstruction(
  i: AiInput,
  need: readonly number[],
  orders: AiOrder[],
): void {
  const switched = i.day >= AI_SWITCH_DAY[i.personality];
  const atWar = i.warDays >= 0;
  const target = Math.min(
    WW_MAX_QUEUE,
    Math.ceil(i.freeCivMilli / (WW_MAX_CIVS_PER_PROJECT * 1000)) + 1,
  );
  const regions = i.regions.map((r) => ({ ...r }));
  let length = i.queue.length;
  let civEntries = 0;
  let milEntries = 0;
  let dockEntries = 0;
  let docksQueued = 0;
  let infraQueued = false;
  for (const q of i.queue) {
    if (q.building === "civ") civEntries++;
    if (q.building === "mil") milEntries++;
    if (q.building === "dock") {
      dockEntries++;
      docksQueued += q.count;
    }
    if (q.building === "infra") infraQueued = true;
  }
  const build = (
    r: AiRegion,
    building: "civ" | "mil" | "infra" | "dock",
    count: number,
  ) => {
    orders.push({ kind: "build", region: r.region, building, count });
    length++;
    if (building === "infra") r.infraRoom -= count;
    else r.free -= count;
    if (building === "civ") civEntries++;
    if (building === "mil") milEntries++;
    if (building === "dock") {
      dockEntries++;
      docksQueued += count;
    }
  };

  // Controller guidance: a resource the lines lack gets one infrastructure
  // level where it is mined, if that level adds a unit a day.
  if (!infraQueued && length < target) {
    for (let k = 0; k < RESOURCE_COUNT; k++) {
      if (need[k] <= available(i, k)) continue;
      let best: AiRegion | null = null;
      let bestGain = 0;
      for (const r of regions) {
        if (r.infraRoom <= 0) continue;
        const gain = infraGain(r.res[k], r.infraRoom);
        if (gain > bestGain) {
          best = r;
          bestGain = gain;
        }
      }
      if (best !== null) {
        build(best, "infra", 1);
        break;
      }
    }
  }

  while (length < target) {
    // P4 spec §17.5: after the switch, dockyards short of the target take
    // one entry in AI_MIL_PER_DOCK + 1 (four military to one dockyard).
    if (
      switched &&
      (i.docks ?? 0) + docksQueued < (i.dockTarget ?? 0) &&
      milEntries >= AI_MIL_PER_DOCK * (dockEntries + 1)
    ) {
      const r = bestRegion(
        regions,
        (x) => !x.occupied && x.free > 0 && x.coastal === true,
      );
      if (r !== null) {
        const room = (i.dockTarget ?? 0) - (i.docks ?? 0) - docksQueued;
        build(r, "dock", Math.min(3, r.free, room));
        continue;
      }
    }
    // R6.2: before the switch civilian, after it AI_MIL_PER_CIV military
    // to 1 civilian (military only at war).
    const ratio = AI_MIL_PER_CIV[i.personality];
    const building =
      !switched || (!atWar && milEntries >= ratio * (civEntries + 1))
        ? "civ"
        : "mil";
    const r = bestRegion(regions, (x) => !x.occupied && x.free > 0);
    if (r !== null) {
      build(r, building, Math.min(3, r.free));
      continue;
    }
    // No slot left anywhere: infrastructure where something is mined.
    const inf = bestRegion(
      regions,
      (x) => x.infraRoom > 0 && x.res.some((v) => v > 0),
    );
    if (inf === null) break;
    build(inf, "infra", 1);
  }
  // Task 9: from the switch the military factories go first, ahead of the
  // civilian ones still queued from before it (else those took a year or
  // more to finish first); HOI4's AI reorders its queue the same way.
  if (switched || atWar) {
    const rank = (b: string) => (b === "mil" ? 0 : b === "infra" ? 1 : 2);
    let sorted = true;
    let worst = 0;
    for (const q of [...i.queue, ...orders.filter((o) => o.kind === "build")]) {
      const r = rank(q.building);
      if (r < worst) sorted = false;
      worst = Math.max(worst, r);
    }
    if (!sorted) orders.push({ kind: "military_first" });
  }
}

// ---- 4. Research ----

function planResearch(i: AiInput, orders: AiOrder[], fill = false): void {
  const researched = new Set(i.researched);
  const slots: (WwTechId | null)[] = [...i.slots];
  while (slots.length < i.slotCount) slots.push(null);
  const coastal = i.coastal ?? true;
  const list = aiResearchOrder(i.tag, coastal);
  // P4 Task 10: the sea and air techs hold at most their share of the slots.
  const caps = aiResearchCaps(aiResearchMix(i.tag, coastal), i.slotCount);
  const running = { land: 0, sea: 0, air: 0 };
  for (const t of slots) if (t !== null) running[aiTechDomain(t)]++;
  const capped = (t: WwTechId) => {
    const d = aiTechDomain(t);
    return d !== "land" && running[d] >= caps[d];
  };
  const ahead = new Map<number, number>();
  const aheadOf = (year: number) => {
    let a = ahead.get(year);
    if (a === undefined) {
      a = aheadPct(year, i.day);
      ahead.set(year, a);
    }
    return a;
  };
  const pick = (maxAhead: number, withCaps = true) =>
    list.find(
      (t) =>
        !researched.has(t) &&
        aheadOf(WW_TECHS[t].year) <= maxAhead &&
        !(withCaps && capped(t)) &&
        researchBlockOf({ researched, slots, slotCount: i.slotCount }, t) ===
          null,
    );
  /** The least early one, ties by the list (aiStartPlan's last resort). */
  const leastAhead = () => {
    let best: WwTechId | undefined;
    for (const t of list) {
      if (researched.has(t)) continue;
      if (
        best !== undefined &&
        aheadOf(WW_TECHS[t].year) >= aheadOf(WW_TECHS[best].year)
      ) {
        continue;
      }
      const block = researchBlockOf(
        { researched, slots, slotCount: i.slotCount },
        t,
      );
      if (block === null) best = t;
    }
    return best;
  };
  for (;;) {
    const slot = freeResearchSlot(slots, i.slotCount);
    if (slot < 0) return;
    // The shares first; a slot with nothing else close takes any (R6.8).
    const tech =
      pick(AI_MAX_AHEAD_PCT) ??
      pick(AI_FALLBACK_AHEAD_PCT) ??
      pick(AI_MAX_AHEAD_PCT, false) ??
      (fill ? leastAhead() : undefined);
    if (tech === undefined) return;
    slots[slot] = tech;
    running[aiTechDomain(tech)]++;
    orders.push({ kind: "research", tech });
  }
}

// ---- 5. Trade ----

/**
 * P4 Task 15 (내 판단): the fewest units a part-factory deal must bring the
 * AI — a whole civilian factory for 1 unit is not worth it unless the
 * lines lack only that.
 */
export const AI_MIN_PART_UNITS = 2;

function planTrade(
  i: AiInput,
  need: readonly number[],
  orders: AiOrder[],
): void {
  // Spec §12.2: at most 30% of the free civilian factories a turn; and at
  // least one, when its lines lack something and one is free (Task 9: a
  // small economy's 30% rounds to nothing, and its lines starve for good).
  let budget = Math.floor((i.freeCivMilli * 30) / 100_000);
  if (
    budget === 0 &&
    i.freeCivMilli >= 1000 &&
    need.some((n, k) => n > available(i, k))
  ) {
    budget = 1;
  }
  let payable = i.payableCivs - i.paidCivs;
  let deals = i.buying.length;
  const open = new Set(i.buying.map((d) => d.seller * RESOURCE_COUNT + d.res));
  let rooms: Map<number, number[]> | null = null;
  for (let k = 0; k < RESOURCE_COUNT; k++) {
    let missing = need[k] - available(i, k);
    if (missing <= 0 || budget <= 0 || payable <= 0) continue;
    rooms ??= new Map(i.partners.map((p) => [p.smallID, [...p.room]]));
    // Same faction first, then the most room, then the lower smallID.
    const ranked = [...i.partners].sort(
      (a, b) =>
        Number(b.sameFaction) - Number(a.sameFaction) ||
        b.room[k] - a.room[k] ||
        a.smallID - b.smallID,
    );
    for (const p of ranked) {
      if (missing <= 0 || budget <= 0 || payable <= 0) break;
      const room = rooms.get(p.smallID)!;
      // P4 Task 15: the last factory buys what is left (dealUnitsOf), but
      // not a crumb of it unless that is all the lines lack.
      if (room[k] < Math.min(missing, AI_MIN_PART_UNITS)) continue;
      const deal = p.smallID * RESOURCE_COUNT + k;
      const grows = open.has(deal);
      if (!grows && deals >= WW_MAX_TRADES) continue;
      const civs = Math.min(
        Math.ceil(missing / WW_TRADE_UNITS_PER_CIV),
        Math.ceil(room[k] / WW_TRADE_UNITS_PER_CIV),
        budget,
        payable,
        WW_MAX_TRADE_CIVS,
      );
      if (civs < 1) continue;
      orders.push({
        kind: "open_trade",
        seller: p.smallID,
        resource: RESOURCE_IDS[k],
        civs,
      });
      const units = dealUnitsOf(civs, room[k]);
      missing -= units;
      budget -= civs;
      payable -= civs;
      room[k] -= units;
      if (!grows) {
        deals++;
        open.add(deal);
      }
    }
  }
  // Imports 8 or more past the need: the newest deal that fits in the
  // surplus closes (one a resource a turn; a bigger one would only be
  // bought again on the next turn).
  for (let k = 0; k < RESOURCE_COUNT; k++) {
    const deficit = Math.max(0, need[k] - (i.produced[k] - i.exported[k]));
    const surplus = i.imported[k] - deficit;
    if (surplus < WW_TRADE_UNITS_PER_CIV) continue;
    let newest: AiDeal | null = null;
    for (const d of i.buying) {
      if (d.res !== k || d.units > surplus) continue;
      if (newest === null || d.id > newest.id) newest = d;
    }
    if (newest !== null) orders.push({ kind: "close_trade", trade: newest.id });
  }
}

// ---- 6. Naval lines (P4 spec §17.5) ----

/** A naval line's build: a ship class, or convoys. */
export type AiNavalSlot = ShipClass | "convoy";
const NAVAL_SLOTS: readonly AiNavalSlot[] = [...SHIP_CLASSES, "convoy"];

/**
 * P4 spec §17.5 (내 판단, 1936–1945 building in proportion): dockyard
 * shares in percent; the BC·BB column builds battleships.
 */
export const AI_NAVAL_SHARES: Readonly<
  Partial<Record<CountryTag, Readonly<Partial<Record<AiNavalSlot, number>>>>>
> = {
  GBR: { dd: 35, cl: 15, bb: 10, cv: 15, ss: 5, convoy: 20 },
  USA: { dd: 35, cl: 10, bb: 10, cv: 25, ss: 10, convoy: 10 },
  JPN: { dd: 30, cl: 10, ca: 5, bb: 10, cv: 25, ss: 15, convoy: 5 },
  DEU: { dd: 15, ca: 5, bb: 15, ss: 60, convoy: 5 },
  ITA: { dd: 30, cl: 15, bb: 15, ss: 30, convoy: 10 },
  FRA: { dd: 30, cl: 20, bb: 15, ss: 25, convoy: 10 },
  SUN: { dd: 30, cl: 15, ss: 50, convoy: 5 },
};
/** Spec §17.5: any other country with dockyards. */
export const AI_NAVAL_SHARES_OTHER: Readonly<
  Partial<Record<AiNavalSlot, number>>
> = { dd: 50, ss: 40, convoy: 10 };
/** Spec §17.5: convoys short (need > 90% of the stock) take this share of the dockyards. */
export const AI_CONVOY_RUSH_PCT = 30;
/** 내 판단: units a new line orders (convoys keep going). */
export const AI_NAVAL_BATCH: Readonly<Record<AiNavalSlot, number>> = {
  dd: 6,
  cl: 3,
  ca: 2,
  bc: 1,
  bb: 1,
  cv: 1,
  ss: 8,
  convoy: 0,
};

/** Whether the convoys run short: the routes need more than 90% of the stock. */
export function aiConvoyShort(need: number, stock: number): boolean {
  return need * 10 > stock * 9;
}

/** Spec §17.5: today's dockyard shares, percent (convoys short: 30%, the ships the rest in proportion). */
export function aiNavalShares(
  tag: CountryTag,
  convoyShort: boolean,
): Record<AiNavalSlot, number> {
  const base = AI_NAVAL_SHARES[tag] ?? AI_NAVAL_SHARES_OTHER;
  const out = Object.fromEntries(
    NAVAL_SLOTS.map((k) => [k, base[k] ?? 0]),
  ) as Record<AiNavalSlot, number>;
  if (!convoyShort || out.convoy >= AI_CONVOY_RUSH_PCT) return out;
  const ships = NAVAL_SLOTS.filter((k) => k !== "convoy");
  const scaled = shareOut(
    100 - AI_CONVOY_RUSH_PCT,
    ships.map((k) => out[k]),
  );
  ships.forEach((k, j) => (out[k] = scaled[j]));
  out.convoy = AI_CONVOY_RUSH_PCT;
  return out;
}

/** One naval line, as the plan reads it. */
export interface AiNavalLineView {
  id: number;
  slot: AiNavalSlot;
  gen: number;
  docks: number;
}

export interface AiNavalLineInput {
  tag: CountryTag;
  /** Working dockyards. */
  docks: number;
  lines: readonly AiNavalLineView[];
  researched: ReadonlySet<WwTechId>;
  convoyStock: number;
  /** Convoys the routes ask for. */
  convoyNeed: number;
  /** The launch port of a new line (the best naval base); 0: none, no new line. */
  port: number;
}

/** The newest generation `tag` may build of a class (gen 1 is always open). */
export function newestShipGen(
  slot: AiNavalSlot,
  researched: ReadonlySet<WwTechId>,
): number {
  if (slot === "convoy") return 1;
  for (let g = SHIP_GENS[slot]; g > 1; g--) {
    const t = shipGenTech(slot, g);
    if (t !== null && researched.has(t)) return g;
  }
  return 1;
}

/**
 * Pure (spec §17.5): idle dockyards one at a time to the class furthest
 * under its share (ties: SHIP_CLASSES order, convoys last); a class's
 * newest-generation line takes them (up to 15), else a new line of the
 * newest generation. Once convoys are no longer short, a convoy line
 * over its share gives the extra dockyards back.
 */
export function aiNavalLinePlan(i: AiNavalLineInput): NavalLineOrder[] {
  const orders: NavalLineOrder[] = [];
  const short = aiConvoyShort(i.convoyNeed, i.convoyStock);
  const shares = aiNavalShares(i.tag, short);
  const assigned = new Map<AiNavalSlot, number>();
  let used = 0;
  for (const l of i.lines) {
    assigned.set(l.slot, (assigned.get(l.slot) ?? 0) + l.docks);
    used += l.docks;
  }
  if (!short) {
    const cap = Math.ceil((shares.convoy * i.docks) / 100);
    let over = (assigned.get("convoy") ?? 0) - cap;
    for (const l of [...i.lines].reverse()) {
      if (over <= 0 || l.slot !== "convoy" || l.docks <= 1) continue;
      const cut = Math.min(over, l.docks - 1);
      orders.push({
        kind: "naval_line_docks",
        line: l.id,
        docks: l.docks - cut,
      });
      over -= cut;
      used -= cut;
      assigned.set("convoy", (assigned.get("convoy") ?? 0) - cut);
    }
  }
  const added = new Map<AiNavalSlot, number>();
  for (let n = Math.max(0, i.docks - used); n > 0; n--) {
    let best: AiNavalSlot | null = null;
    let bestGap = 0;
    for (const k of NAVAL_SLOTS) {
      if (shares[k] <= 0) continue;
      const gap = shares[k] * i.docks - 100 * (assigned.get(k) ?? 0);
      if (best === null || gap > bestGap) {
        best = k;
        bestGap = gap;
      }
    }
    if (best === null) break;
    assigned.set(best, (assigned.get(best) ?? 0) + 1);
    added.set(best, (added.get(best) ?? 0) + 1);
  }
  let lineCount = i.lines.length;
  for (const k of NAVAL_SLOTS) {
    let n = added.get(k) ?? 0;
    if (n === 0) continue;
    const gen = newestShipGen(k, i.researched);
    const line = i.lines.find(
      (l) => l.slot === k && l.gen === gen && l.docks < WW_MAX_DOCKS_PER_LINE,
    );
    if (line !== undefined) {
      const docks = Math.min(WW_MAX_DOCKS_PER_LINE, line.docks + n);
      orders.push({ kind: "naval_line_docks", line: line.id, docks });
      n -= docks - line.docks;
    }
    while (n > 0 && i.port !== 0 && lineCount < WW_MAX_NAVAL_LINES) {
      const docks = Math.min(WW_MAX_DOCKS_PER_LINE, n);
      orders.push({
        kind: "naval_line_add",
        cls: k,
        gen,
        docks,
        count: AI_NAVAL_BATCH[k],
        port: i.port,
      });
      lineCount++;
      n -= docks;
    }
  }
  return orders;
}

// ---- The engine side ----

/** The plain data an AI turn of `ce` looks at (aiPlan's input). */
export function aiInput(
  econ: WwEconomy,
  ce: CountryEconomy,
  day: number,
  tick: number,
): AiInput {
  const t = ce.totals;
  const me = ce.smallID;
  const sold = new Map<number, number>();
  const buying: AiDeal[] = [];
  let paidCivs = 0;
  for (const tr of econ.trades()) {
    const k = tr.seller * RESOURCE_COUNT + tr.res;
    sold.set(k, (sold.get(k) ?? 0) + tr.units);
    if (tr.buyer === me) {
      paidCivs += tr.civs;
      buying.push({
        id: tr.id,
        seller: tr.seller,
        res: tr.res,
        civs: tr.civs,
        units: tr.units,
      });
    }
  }
  // exportRoom of every partner, from one pass over the deals; built only
  // when the plan has something to buy.
  let partners: AiPartner[] | null = null;
  const findPartners = (): AiPartner[] =>
    tradePartners(econ, me).map((s) => {
      const sc = econ.country(s)!;
      const pct = sc.law().exportPct;
      return {
        smallID: s,
        sameFaction: econ.ww.sameFaction(me, s),
        room: RESOURCE_IDS.map((_, r) =>
          exportRoomOf(
            sc.totals.produced[r],
            pct,
            sold.get(s * RESOURCE_COUNT + r) ?? 0,
          ),
        ),
      };
    });
  // Built only when the plan builds something.
  let regions: AiRegion[] | null = null;
  const findRegions = (): AiRegion[] =>
    econ.regionsOf(me).map((id) => {
      const slots = econ.regionSlots(id, ce.stats.slotPct);
      const queuedInfra = queuedInRegion(ce.queue, id).infra;
      return {
        region: id,
        infra: econ.infra[id],
        free: Math.max(0, slots - usedSlots(econ, id)),
        infraRoom: Math.max(0, MAX_INFRA - econ.infra[id] - queuedInfra),
        occupied: econ.isOccupied(id),
        // P3's resource effect counts (WwEconomy.resBonus).
        res: econ.deposits(id),
        coastal: econ.scenario.region(id)?.coastal ?? false,
      };
    });
  const warDays = econ.warDays(me, tick);
  return {
    tag: ce.tag,
    personality: aiPersonality(ce.tag),
    major: COUNTRIES[ce.tag].major,
    day,
    warDays,
    laws: { ...ce.laws },
    lawCooldownUntil: { ...ce.lawCooldownUntil },
    ...politicsInput(econ, ce),
    manpower: ce.manpower,
    recruitable: t.recruitable,
    infStock: ce.infStock(),
    supStock: EQUIP_KEYS.reduce(
      (n, [t], k) => (t === "support_equipment" ? n + ce.stock[k] : n),
      0,
    ),
    freeCivMilli: t.freeCivMilli,
    mil: t.mil,
    idleMil: t.idleMil,
    effCapBp: effCapBp(ce.stats),
    lines: ce.lines.map((l) => ({
      id: l.id,
      key: l.key,
      factories: l.factories,
      active: l.active,
      effBp: l.effBp,
      fill: l.fill,
    })),
    queue: ce.queue.map((q) => ({
      region: q.region,
      building: q.building,
      count: q.count,
    })),
    slots: ce.slots.map((s) => s?.tech ?? null),
    slotCount: t.slotCount,
    researched: [...ce.researched],
    produced: [...t.produced],
    exported: [...t.exported],
    imported: [...t.imported],
    payableCivs: payableCivs(t.civ, t.cgMilli),
    paidCivs,
    buying,
    get partners() {
      return (partners ??= findPartners());
    },
    get regions() {
      return (regions ??= findRegions());
    },
    // A navy: a harbor (a minor: and dockyards to build in).
    coastal:
      (ce.major || t.dock > 0) &&
      econ.regionsOf(me).some((r) => econ.scenario.harborOf(r) !== 0),
    docks: t.dock,
    dockTarget: aiDockTarget(ce.tag, warDays >= 0),
    fuelOil: fuelOilOf(econ, ce),
    priorityDemand: (econ.ww.depth as WwDepth | undefined)?.priorityDemand(me),
  };
}

/** AiInput.fuelOil: yesterday's fuel use in oil while the stock is under half the capacity. */
function fuelOilOf(econ: WwEconomy, ce: CountryEconomy): number {
  if (ce.fuelMilli * 2 >= fuelCapOf(econ, ce)) return 0;
  const used = ce.fuelUseMilli[0] + ce.fuelUseMilli[1] + ce.fuelUseMilli[2];
  const perOil = fuelGain(1, ce.stats);
  if (used <= 0 || perOil <= 0) return 0;
  return Math.min(AI_FUEL_OIL_MAX, Math.ceil(used / perOil));
}

/** Runs one AI order through the functions a human's orders use. */
function applyAiOrder(
  econ: WwEconomy,
  ce: CountryEconomy,
  o: AiOrder,
  day: number,
): WwOrderBlock | null {
  switch (o.kind) {
    case "set_law":
      return setLaw(econ, ce, o.law, o.value, day);
    case "build":
      return queueBuild(econ, ce, o.region, o.building, o.count);
    case "add_line":
      return addLine(econ, ce, o.equipment, o.gen, o.factories);
    case "set_line_factories":
      return setLineFactories(econ, ce, o.line, o.factories);
    case "change_line":
      return changeLine(econ, ce, o.line, o.equipment, o.gen);
    case "research":
      return startResearch(econ, ce, o.tech);
    case "open_trade":
      return openTrade(
        econ,
        ce,
        o.seller,
        RESOURCE_IDS.indexOf(o.resource),
        o.civs,
      );
    case "close_trade":
      return closeTrade(econ, ce, o.trade);
    case "military_first":
      militaryFirst(econ, ce);
      return null;
  }
}

/**
 * P4 Task 15 (내 판단; the Luftwaffe's claim on aluminium and rubber in
 * 1939–45): an AI's lines in three groups, each in its own order
 * (move_line) — the infantry's kit (rifles, support equipment), then the
 * aircraft, then the rest — so the planes draw the aluminium and rubber
 * before the anti-air guns and the trucks; else those took them all and
 * the air lines ran at the 20% floor from 1939.
 */
export function aiPlanesFirst(econ: WwEconomy, ce: CountryEconomy): void {
  const rank = (key: number): number => {
    const t = EQUIP_KEYS[key][0];
    if (t === "infantry_equipment" || t === "support_equipment") return 0;
    return AIR_EQUIPMENT.has(t) ? 1 : 2;
  };
  let moved = false;
  // A stable selection sort by rank (move_line keeps the rest in order).
  for (let j = 0; j < ce.lines.length; j++) {
    let best = j;
    for (let i = j + 1; i < ce.lines.length; i++) {
      if (rank(ce.lines[i].key) < rank(ce.lines[best].key)) best = i;
    }
    if (best !== j) {
      moveLine(econ, ce, ce.lines[best].id, j);
      moved = true;
    }
  }
  if (moved) econ.markCountryDirty(ce.smallID);
}

/**
 * Moves the queue's military factories to the front, then infrastructure,
 * then civilian factories, each group in its order (move_build, so the
 * progress stays with each entry).
 */
function militaryFirst(econ: WwEconomy, ce: CountryEconomy): void {
  const rank = (b: string) => (b === "mil" ? 0 : b === "infra" ? 1 : 2);
  for (let j = 0; j < ce.queue.length; j++) {
    let best = j;
    for (let k = j + 1; k < ce.queue.length; k++) {
      if (rank(ce.queue[k].building) < rank(ce.queue[best].building)) best = k;
    }
    if (best !== j) moveBuild(econ, ce, best, j);
  }
}

/**
 * A country's starting lines and research (HOI4's 1936 start, a human
 * country's too): aiStartPlan, run once by WwEconomy.start before the
 * preparation minute, where a human may change any of it. No laws (the
 * 1936 ones stand) and no building: the queue is the player's first
 * choice. No deals: an AI buys only from day 0, after the humans had the
 * preparation minute to pick first.
 */
export function aiStartSetup(econ: WwEconomy, ce: CountryEconomy): void {
  for (const o of aiStartPlan(aiInput(econ, ce, 0, 0))) {
    applyAiOrder(econ, ce, o, 0);
  }
}

/**
 * Whether a country's turn falls on `day` (spec §12: every 10 days). Day 0
 * is also every major's first turn (Task 9): the great powers open their
 * deals before the minors' turns come round, as they led the 1936 markets.
 * A minor's lines, research and building start on day 0 too, by reacting
 * (aiReactions); its laws and deals wait for its turn.
 */
export function isAiTurn(
  smallID: number,
  day: number,
  major: boolean,
): boolean {
  return (day === 0 && major) || (day + smallID) % WW_AI_PERIOD_DAYS === 0;
}

/**
 * What fell free since the country's last decision: an empty research
 * slot, military factories no line uses, civilian factories the queue
 * cannot take (at most 15 an entry).
 */
export function aiReactions(ce: CountryEconomy): AiReact {
  const t = ce.totals;
  let emptySlot = ce.slots.length < t.slotCount;
  for (let s = 0; s < t.slotCount && !emptySlot; s++) {
    emptySlot = ce.slots[s] === null;
  }
  return {
    research: emptySlot,
    lines: t.idleMil > 0,
    construction:
      ce.queue.length < WW_MAX_QUEUE &&
      t.freeCivMilli > ce.queue.length * WW_MAX_CIVS_PER_PROJECT * 1000,
  };
}

/**
 * An AI country's economy decisions, after the rest of its daily step: its
 * whole turn every WW_AI_PERIOD_DAYS days (spec §12), and between turns
 * only what fell free (aiReactions; Task 9 balance ruling: a finished tech
 * or factory waited up to ten days). A refused order changes nothing and
 * the others still run; a refused retooling tries the next line.
 */
export function aiEconomyTick(
  econ: WwEconomy,
  ce: CountryEconomy,
  p: Player,
  day: number,
  tick: number,
): void {
  let plan: AiPlan;
  if (isAiTurn(ce.smallID, day, ce.major)) {
    plan = aiPlan(aiInput(econ, ce, day, tick));
    // P3 spec §7.3: the turn's law waits while the PP cannot pay it, and no
    // other law is looked at that day.
    const target = lawTargetAt(econ, ce, day, tick);
    if (target !== null && !canPayLaw(econ, ce, target.value)) {
      plan = plan.filter((o) => o.kind !== "set_law");
    }
  } else {
    const react = aiReactions(ce);
    if (!react.research && !react.lines && !react.construction) return;
    plan = aiReactPlan(aiInput(econ, ce, day, tick), react);
  }
  for (const o of plan) {
    if (applyAiOrder(econ, ce, o, day) === null || o.kind !== "change_line") {
      continue;
    }
    // R6.7: the retooling was refused; the next line nearly at its cap.
    const lines = ce.lines.map((l) => ({ ...l }));
    for (const alt of aiRetools(lines, ce.researched, effCapBp(ce.stats))) {
      if (alt.line === o.line) continue;
      if (applyAiOrder(econ, ce, alt, day) === null) break;
    }
  }
  // P4 spec §17.5: the naval lines and the sea and air buildings, on the turn.
  if (isAiTurn(ce.smallID, day, ce.major)) {
    aiPlanesFirst(econ, ce);
    aiNavalLinesTurn(econ, ce, tick);
    aiP4Builds(econ, ce, day);
  }
}

/** P4 spec §17.5: the turn's naval line orders, through navy.issue (a player's path). */
function aiNavalLinesTurn(
  econ: WwEconomy,
  ce: CountryEconomy,
  tick: number,
): void {
  const docks = ce.totals.dock;
  if (docks <= 0 && ce.navalLines.length === 0) return;
  const navy = econ.ww.navy;
  let need = 0;
  for (const r of navy.routes.values())
    if (r.owner === ce.smallID) need += r.need;
  const orders = aiNavalLinePlan({
    tag: ce.tag,
    docks,
    // (A floating-harbour line is never the AI's plan: left out.)
    lines: ce.navalLines
      .filter((l) => navalLineClass(l.cls) !== "floating_harbor")
      .map((l) => ({
        id: l.id,
        slot: navalLineClass(l.cls) as ShipClass | "convoy",
        gen: l.gen,
        docks: l.docks,
      })),
    researched: ce.researched,
    convoyStock: convoysOf(ce),
    convoyNeed: need,
    port: aiMainBase(econ.ww, ce.smallID),
  });
  for (const o of orders) navy.issue(ce.smallID, o, tick, "ai");
}

/** P4 spec §17.5: sea and air buildings a turn (the factories keep the rest of the queue). */
export const AI_P4_BUILDS_AT_WAR = 2;
export const AI_P4_BUILDS_AT_PEACE = 1;
/** Spec §17.5: naval bases at front and departure ports up to this level. */
export const AI_NAVAL_BASE_MAX = 6;
/** Spec §17.3-2: air bases at the fronts up to this level. */
export const AI_AIR_BASE_MAX = 5;
/** 내 판단: the AI's anti-air, coastal forts and radar stop here (the factories come first). */
export const AI_AA_MAX = 3;
export const AI_COASTAL_FORT_MAX = 3;
export const AI_RADAR_REGIONS = 4;
/** Spec §17.5: a fuel shortage below this ratio builds a synthetic refinery. */
export const AI_SYNTH_RATIO_PM = 800;
/** Spec §17.5: fuel at its cap this long builds a silo (no shortage since). */
export const AI_SILO_FULL_DAYS = 60;

/**
 * P4 spec §17.5 (the situation decides, no dates): naval bases at the
 * ports facing an enemy's coast or sailing an invasion (to 6); air bases
 * in the zones whose deployments find no room (to 5); anti-air at the
 * capital and the 10-point regions once an enemy has strategic bombers;
 * radar on the coast (radar_1) and coastal forts on the based islands
 * once an enemy flies bombers or sails capital ships; a synthetic
 * refinery when fuel runs short (synthetic_oil_1), a silo when it
 * overflows. At most two entries a turn at war, one at peace.
 */
function aiP4Builds(econ: WwEconomy, ce: CountryEconomy, day: number): void {
  const ww = econ.ww;
  const sc = econ.scenario;
  const land = ww.land;
  const me = ce.smallID;
  const enemies = ww.enemiesOf(me).filter((e) => land.isEnemy(me, e));
  const atWar = enemies.length > 0;
  let budget = atWar ? AI_P4_BUILDS_AT_WAR : AI_P4_BUILDS_AT_PEACE;
  // Never in a no-strike region (no bases placed in Korea or Taiwan).
  const regions = econ
    .regionsOf(me)
    .filter((r) => econ.controllerOf(r) === me && !isNoStrike(sc, r))
    .sort((a, b) => a - b);
  const vp = (r: number) => sc.region(r)?.vp ?? 0;
  const level = (r: number, b: BuildingId) => econ.buildingArray(b)[r] ?? 0;
  const queued = (r: number, b: BuildingId) =>
    ce.queue.some((q) => q.region === r && q.building === b);
  const build = (r: number, b: BuildingId): boolean => {
    if (budget <= 0 || ce.queue.length >= WW_MAX_QUEUE || queued(r, b)) {
      return false;
    }
    if (queueBuild(econ, ce, r, b, 1) !== null) return false;
    budget--;
    return true;
  };
  /** The first region of `list` (already in priority order) that builds `b`. */
  const first = (list: readonly number[], b: BuildingId) => {
    for (const r of list) if (build(r, b)) return true;
    return false;
  };
  if (atWar) {
    const navy = ww.navy;
    // Naval bases: our ports on a sea where an enemy holds a port, or on
    // an invasion's route, and our invasions' departure ports.
    const hostileSrs = new Set<number>();
    for (const e of enemies) {
      for (const r of navalPortsOf(ww, e)) {
        const z = sc.harborOf(r);
        if (z !== 0) hostileSrs.add(sc.zoneSr(z));
      }
    }
    for (const sr of invasionRouteSrs(navy, me)) hostileSrs.add(sr);
    const departures = new Set<number>();
    for (const inv of navy.invasions.values()) {
      if (inv.owner === me) departures.add(inv.from);
    }
    const ports = regions
      .filter((r) => {
        const z = sc.harborOf(r);
        if (z === 0 || !navalPort(ww, r)) return false;
        if (level(r, "naval_base") >= AI_NAVAL_BASE_MAX) return false;
        return departures.has(r) || hostileSrs.has(sc.zoneSr(z));
      })
      .sort(
        (a, b) =>
          Number(departures.has(b)) - Number(departures.has(a)) ||
          level(a, "naval_base") - level(b, "naval_base") ||
          vp(b) - vp(a) ||
          a - b,
      );
    first(ports, "naval_base");
    // Air bases where the deployments find no room.
    const air = ww.air;
    const short = new Set<number>();
    const groups = new Map<number, { target: number; have: number }>();
    for (const d of air.deploymentsOf(me)) {
      if (d.base < 0) continue;
      const k = d.sr * 1000 + d.type * 20 + d.mission;
      const g = groups.get(k) ?? { target: d.target, have: 0 };
      g.have += d.counts.reduce((x, y) => x + y, 0);
      groups.set(k, g);
    }
    for (const [k, g] of groups)
      if (g.have < g.target) short.add(Math.floor(k / 1000));
    const airBases = regions
      .filter(
        (r) =>
          short.has(sc.regionSr(r)) && level(r, "air_base") < AI_AIR_BASE_MAX,
      )
      .sort(
        (a, b) =>
          level(b, "air_base") - level(a, "air_base") || vp(b) - vp(a) || a - b,
      );
    first(airBases, "air_base");
    // What the enemy flies and sails.
    let stratBombers = false;
    let bombers = false;
    let bigShips = false;
    for (const e of enemies) {
      const ec = econ.country(e);
      if (ec !== null) {
        const has = (type: "strat_bomber" | "bomber") =>
          [1, 2, 3].some((g) => (ec.stock[equipKey(type, g)] ?? 0) > 0) ||
          (ec.planesDeployed[equipKey(type, 1)] ?? 0) > 0;
        if (has("strat_bomber")) stratBombers = true;
        if (has("bomber") || has("strat_bomber")) bombers = true;
      }
      for (const f of navy.fleetsOf(e)) {
        const c = fleetCounts(navy, f);
        if (capitalsOf(c) + c[SHIP_CLASSES.indexOf("cv")] > 0) bigShips = true;
      }
    }
    if (stratBombers) {
      const cap = capitalRegion(land, me);
      const aa = regions
        .filter(
          (r) =>
            (r === cap || vp(r) >= 10) &&
            level(r, "anti_air") < AI_AA_MAX &&
            ce.researched.has("anti_air_1"),
        )
        .sort(
          (a, b) =>
            Number(b === cap) - Number(a === cap) ||
            level(a, "anti_air") - level(b, "anti_air") ||
            vp(b) - vp(a) ||
            a - b,
        );
      first(aa, "anti_air");
    }
    if (bombers && ce.researched.has("radar_1")) {
      const top = ce.researched.has("radar_2") ? 3 : 2;
      const withRadar = regions.filter((r) => level(r, "radar") > 0).length;
      const radar = regions
        .filter(
          (r) =>
            sc.harborOf(r) !== 0 &&
            vp(r) > 0 &&
            level(r, "radar") < top &&
            (level(r, "radar") > 0 || withRadar < AI_RADAR_REGIONS),
        )
        .sort((a, b) => vp(b) - vp(a) || a - b);
      first(radar, "radar");
    }
    if (bigShips) {
      const forts = regions
        .filter(
          (r) =>
            sc.harborOf(r) !== 0 &&
            (sc.region(r)?.island !== undefined ||
              sc.edgesOf(r).length === 0) &&
            (level(r, "naval_base") > 0 || level(r, "air_base") > 0) &&
            level(r, "coastal_fort") < AI_COASTAL_FORT_MAX,
        )
        .sort(
          (a, b) =>
            level(a, "coastal_fort") - level(b, "coastal_fort") ||
            vp(b) - vp(a) ||
            a - b,
        );
      first(forts, "coastal_fort");
    }
  }
  // Fuel: a refinery when short, a silo when full for a while.
  const slotRegions = () =>
    regions
      .filter((r) => !econ.isOccupied(r))
      .map((r) => ({
        r,
        free:
          econ.regionSlots(r, ce.stats.slotPct) -
          usedSlots(econ, r) -
          queuedInRegion(ce.queue, r).factories,
      }))
      .filter((x) => x.free > 0)
      .sort(
        (a, b) =>
          (econ.infra[b.r] ?? 0) - (econ.infra[a.r] ?? 0) ||
          b.free - a.free ||
          a.r - b.r,
      )
      .map((x) => x.r);
  const anyQueued = (b: BuildingId) => ce.queue.some((q) => q.building === b);
  // Task 15: a refinery makes rubber too — built when the lines lack it.
  let rubberNeed = 0;
  for (const l of ce.lines) {
    rubberNeed += EQUIPMENT[typeOf(l.key)].resources[RUBBER] * l.active;
  }
  const t = ce.totals;
  const rubberShort =
    rubberNeed > t.produced[RUBBER] - t.exported[RUBBER] + t.imported[RUBBER];
  if (
    (ce.fuelRatioPm < AI_SYNTH_RATIO_PM || rubberShort) &&
    ce.researched.has("synthetic_oil_1") &&
    !anyQueued("synthetic_refinery")
  ) {
    first(slotRegions(), "synthetic_refinery");
  }
  if (
    ce.fuelMilli >= fuelCapOf(econ, ce) &&
    day - ce.fuelShortDay > AI_SILO_FULL_DAYS &&
    !anyQueued("fuel_silo")
  ) {
    first(slotRegions(), "fuel_silo");
  }
}

/**
 * P3 spec §7.3 (controller ruling R10): the law an AI turn of `ce` on
 * `day` would set first — P1's targets under P3's conditions, the PP left
 * aside — or null. aiEconomyTick defers it while the PP cannot pay it; the
 * AI politics keeps PP back for it.
 */
export function aiLawTarget(
  econ: WwEconomy,
  ce: CountryEconomy,
  day: number,
): { kind: LawKind; value: LawValue } | null {
  return lawTargetAt(econ, ce, day, econ.mg.ticks());
}

function lawTargetAt(
  econ: WwEconomy,
  ce: CountryEconomy,
  day: number,
  tick: number,
): { kind: LawKind; value: LawValue } | null {
  const orders: AiOrder[] = [];
  planLaws(
    {
      personality: aiPersonality(ce.tag),
      day,
      warDays: econ.warDays(ce.smallID, tick),
      laws: { ...ce.laws },
      lawCooldownUntil: { ...ce.lawCooldownUntil },
      ...politicsInput(econ, ce),
      manpower: ce.manpower,
      recruitable: ce.totals.recruitable,
    },
    orders,
  );
  const o = orders[0];
  return o?.kind === "set_law" ? { kind: o.law, value: o.value } : null;
}

/** The PP pays the target law's cost now (P3 spec §7.1; never below 0). */
function canPayLaw(
  econ: WwEconomy,
  ce: CountryEconomy,
  value: LawValue,
): boolean {
  const pp = econ.ww.politics.country(ce.smallID)?.ppMilli ?? 0;
  return pp >= 0 && lawCost(value, ce.stats) * 1000 <= pp;
}

/** R10: the AiInput fields the law conditions read, from politics. */
function politicsInput(
  econ: WwEconomy,
  ce: CountryEconomy,
): Pick<AiInput, "wsBp" | "wtBp" | "ruling" | "ppMilli"> {
  const c = lawCtxOf(econ, ce, "civilian");
  return { wsBp: c.wsBp, wtBp: c.wtBp, ruling: c.ruling, ppMilli: c.ppMilli };
}
