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
import { COUNTRIES, CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  CONSCRIPTION_LAWS,
  CountryLaws,
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
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import {
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
import { WW_TECHS } from "@openfront/engine-lib/ww1936/WwTechs";
import type { Player } from "../../game/Game";
import { moveBuild, queueBuild, usedSlots } from "./Construction";
import { setLaw } from "./LawsRun";
import { addLine, changeLine, setLineFactories } from "./Production";
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
  Record<DoctrineSchool, Readonly<Partial<Record<AiLineSlot, number>>>>
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

/** Today's line targets in percent, by equipment (spec §12.2). */
export function aiLineShares(
  tag: CountryTag,
  major: boolean,
  researched: ReadonlySet<WwTechId>,
  infSurplus: boolean,
  supportShort = false,
): Record<EquipmentType, number> {
  const out = Object.fromEntries(EQUIPMENT_TYPES.map((t) => [t, 0])) as Record<
    EquipmentType,
    number
  >;
  const base = AI_LINE_SHARES[major ? "major" : "minor"];
  const tilt: Readonly<Partial<Record<AiLineSlot, number>>> = major
    ? AI_SCHOOL_TILT[aiSchool(tag)]
    : {};
  const tank: EquipmentType = researched.has("medium_tank_1")
    ? "medium_tank"
    : "light_tank";
  for (const slot of [...EQUIPMENT_TYPES, "tank"] as const) {
    const t = slot === "tank" ? tank : slot;
    out[t] += (base[slot] ?? 0) + (tilt[slot] ?? 0);
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
  DEU: ["tools", "armour", "school", "infantry", "air", "guns", "construction"],
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
const researchOrders = new Map<CountryTag, readonly WwTechId[]>();

/**
 * The tech priority list of `tag`: its groups, the tail, then everything
 * else; each group in WW_TECH_IDS order. Other schools' doctrines are left
 * out (one school only, spec §9.3), and so are the special troops it does
 * not field (wantsTech).
 */
export function aiResearchOrder(tag: CountryTag): readonly WwTechId[] {
  const cached = researchOrders.get(tag);
  if (cached !== undefined) return cached;
  const school = aiSchool(tag);
  const groups = [
    ...(COUNTRY_ORDER[tag] ?? PERSONALITY_ORDER[aiPersonality(tag)]),
    ...TAIL,
  ];
  const seen = new Set<WwTechId>();
  const out: WwTechId[] = [];
  const add = (techs: readonly WwTechId[]) => {
    const sorted = [...techs].sort(
      (a, b) => TECH_INDEX.get(a)! - TECH_INDEX.get(b)!,
    );
    for (const t of sorted) {
      if (seen.has(t)) continue;
      seen.add(t);
      out.push(t);
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
  researchOrders.set(tag, out);
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
  planTrade(input, need, orders);
  return orders;
}

// ---- 1. Laws ----

function economyTarget(i: AiInput): LawValue {
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

function planLaws(i: AiInput, orders: AiOrder[]): void {
  const laws: CountryLaws = { ...i.laws };
  const ctx = { day: i.day, warDays: i.warDays };
  const allowed = (kind: LawKind, v: LawValue) =>
    lawBlockOf(laws, i.lawCooldownUntil, kind, v, ctx) === null;
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
  let infraQueued = false;
  for (const q of i.queue) {
    if (q.building === "civ") civEntries++;
    if (q.building === "mil") milEntries++;
    if (q.building === "infra") infraQueued = true;
  }
  const build = (
    r: AiRegion,
    building: "civ" | "mil" | "infra",
    count: number,
  ) => {
    orders.push({ kind: "build", region: r.region, building, count });
    length++;
    if (building === "infra") r.infraRoom -= count;
    else r.free -= count;
    if (building === "civ") civEntries++;
    if (building === "mil") milEntries++;
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
  const list = aiResearchOrder(i.tag);
  const ahead = new Map<number, number>();
  const aheadOf = (year: number) => {
    let a = ahead.get(year);
    if (a === undefined) {
      a = aheadPct(year, i.day);
      ahead.set(year, a);
    }
    return a;
  };
  const pick = (maxAhead: number) =>
    list.find(
      (t) =>
        !researched.has(t) &&
        aheadOf(WW_TECHS[t].year) <= maxAhead &&
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
    const tech =
      pick(AI_MAX_AHEAD_PCT) ??
      pick(AI_FALLBACK_AHEAD_PCT) ??
      (fill ? leastAhead() : undefined);
    if (tech === undefined) return;
    slots[slot] = tech;
    orders.push({ kind: "research", tech });
  }
}

// ---- 5. Trade ----

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
    const missing = need[k] - available(i, k);
    if (missing <= 0 || budget <= 0 || payable <= 0) continue;
    rooms ??= new Map(i.partners.map((p) => [p.smallID, [...p.room]]));
    let want = Math.ceil(missing / WW_TRADE_UNITS_PER_CIV);
    // Same faction first, then the most room, then the lower smallID.
    const ranked = [...i.partners].sort(
      (a, b) =>
        Number(b.sameFaction) - Number(a.sameFaction) ||
        b.room[k] - a.room[k] ||
        a.smallID - b.smallID,
    );
    for (const p of ranked) {
      if (want <= 0 || budget <= 0 || payable <= 0) break;
      const room = rooms.get(p.smallID)!;
      const deal = p.smallID * RESOURCE_COUNT + k;
      const grows = open.has(deal);
      if (!grows && deals >= WW_MAX_TRADES) continue;
      const civs = Math.min(
        want,
        Math.floor(room[k] / WW_TRADE_UNITS_PER_CIV),
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
      want -= civs;
      budget -= civs;
      payable -= civs;
      room[k] -= civs * WW_TRADE_UNITS_PER_CIV;
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
      if (d.res !== k || d.civs * WW_TRADE_UNITS_PER_CIV > surplus) continue;
      if (newest === null || d.id > newest.id) newest = d;
    }
    if (newest !== null) orders.push({ kind: "close_trade", trade: newest.id });
  }
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
    sold.set(k, (sold.get(k) ?? 0) + tr.civs * WW_TRADE_UNITS_PER_CIV);
    if (tr.buyer === me) {
      paidCivs += tr.civs;
      buying.push({ id: tr.id, seller: tr.seller, res: tr.res, civs: tr.civs });
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
      const slots = econ.regionSlots(id, ce.tech.slotPct);
      const queuedInfra = queuedInRegion(ce.queue, id).infra;
      return {
        region: id,
        infra: econ.infra[id],
        free: Math.max(0, slots - usedSlots(econ, id)),
        infraRoom: Math.max(0, MAX_INFRA - econ.infra[id] - queuedInfra),
        occupied: econ.isOccupied(id),
        res: econ.scenario.region(id)!.res,
      };
    });
  return {
    tag: ce.tag,
    personality: aiPersonality(ce.tag),
    major: COUNTRIES[ce.tag].major,
    day,
    warDays: econ.warDays(me, tick),
    laws: { ...ce.laws },
    lawCooldownUntil: { ...ce.lawCooldownUntil },
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
    effCapBp: effCapBp(ce.tech),
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
  };
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
    for (const alt of aiRetools(lines, ce.researched, effCapBp(ce.tech))) {
      if (alt.line === o.line) continue;
      if (applyAiOrder(econ, ce, alt, day) === null) break;
    }
  }
}
