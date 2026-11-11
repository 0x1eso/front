// ww177 (Imjin design §2): the scenario profile seam of the 1936 engine.
// `GameConfig.ww1936Scenario` names the profile; absent means "ww1936", and
// then every answer here is 1936's, so the 1936 game and its digests stay as
// they are. The Imjin War ("imjin1590") swaps the calendar epoch, the seats
// and the starts, and switches whole systems off.
import type { GameConfig } from "@openfront/engine-api/Schemas";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type { BuildingId } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { BattalionId } from "@openfront/engine-api/ww1936/LandTypes";
import {
  IMJIN_CALENDAR_IDS,
  type ImjinCalendarId,
  type WwScenarioIdKey,
} from "@openfront/engine-api/ww1936/ScenarioIds";
import { epochDaysOf } from "../Calendar";

export type WwScenarioId = WwScenarioIdKey;

type ScenarioCfg = { ww1936Scenario?: string };

/** The config's profile; absent (or unknown) means "ww1936". */
export function scenarioOf(cfg: ScenarioCfg): WwScenarioId {
  return cfg.ww1936Scenario === "imjin1590" ? "imjin1590" : "ww1936";
}

export function isImjin(cfg: ScenarioCfg): boolean {
  return scenarioOf(cfg) === "imjin1590";
}

/**
 * Systems a profile can switch off (design §2). The designer and the atomic
 * bomb also have their own config keys (ww1936Designer, ww1936Nukes), which
 * the Imjin rules clear (ModeConfig); this list is the engine's gate.
 */
export const WW_SYSTEMS = [
  "air",
  "atomic",
  "rockets",
  "rail",
  "designer",
  "market",
  "intel",
  "energy",
  "dams",
] as const;
export type WwSystem = (typeof WW_SYSTEMS)[number];

/** Design §2: everything above is off in the Imjin War. */
export const IMJIN_OFF_SYSTEMS: readonly WwSystem[] = WW_SYSTEMS;

/**
 * ww184: the buildings of the systems the Imjin War switches off (rail,
 * air, energy, dams, the special projects, the 1936 resources), which the
 * construction screen hides and the engine refuses there.
 */
export const IMJIN_OFF_BUILDINGS: readonly BuildingId[] = [
  "rail",
  "air_base",
  "anti_air",
  "radar",
  "synthetic_refinery",
  "fuel_silo",
  "facility_nuclear",
  "facility_rocket",
  "facility_science",
  "rocket_site",
  "power_plant",
  "dam",
  "alloy_plant",
  "smelter",
  "mine",
];

/** ww184: whether the profile builds `building` (1936: every one). */
export function buildingOn(cfg: ScenarioCfg, building: BuildingId): boolean {
  return !isImjin(cfg) || !IMJIN_OFF_BUILDINGS.includes(building);
}

/** ww184: the battalions a 1590s army has (no motor, armour or 1936 guns). */
export const IMJIN_BATTALIONS: readonly BattalionId[] = [
  "infantry",
  "cavalry",
  "mountain",
  "artillery",
];

/** ww184: whether a start template fits the profile (1936: every one). */
export function templateOn(
  cfg: ScenarioCfg,
  battalions: readonly BattalionId[],
): boolean {
  return !isImjin(cfg) || battalions.every((b) => IMJIN_BATTALIONS.includes(b));
}

/** Whether the profile runs `system` (1936: always). */
export function wwSystemOn(cfg: ScenarioCfg, system: WwSystem): boolean {
  return !isImjin(cfg) || !IMJIN_OFF_SYSTEMS.includes(system);
}

// ---- The Imjin War ----

/** Design §1, §10: the two human seats; a seat nobody takes is the AI's. */
export const IMJIN_SEATS: readonly CountryTag[] = ["JOS", "JPN"];
/** Design §1, owner decision (§15): Ming and the Jurchen are AI only. */
export const IMJIN_AI_ONLY: readonly CountryTag[] = ["MIN", "JUR"];
/** Design §1: the war's powers (Joseon, Japan, Ming); the Jurchen are a minor. */
export const IMJIN_POWERS = ["JOS", "JPN", "MIN"] as const;
export type ImjinPower = (typeof IMJIN_POWERS)[number];
/** Every country the Imjin map holds, in seat order then the AI's. */
export const IMJIN_COUNTRIES: readonly CountryTag[] = [
  ...IMJIN_SEATS,
  ...IMJIN_AI_ONLY,
];

export interface ImjinCalendar {
  readonly id: ImjinCalendarId;
  /** Day 0 of the game (the calendar epoch), ISO. */
  readonly startIso: string;
  /** The timer in minutes; null: no timer. */
  readonly minutes: number | null;
  /** How many times longer a tick lasts (Pace.wwTempo). */
  readonly tempo: number;
  /** Which start the countries take (Starts.ts). */
  readonly start: "y1590" | "y1592";
  /** ww177 P7a: the calendar's last day, ISO (null: no end by date). */
  readonly endIso: string | null;
}

/**
 * Design §10, decision 7B. A day is 0.75 s at tempo 1, so the 1590 row's 45
 * minutes run to about 1600, the 1592 row's 30 minutes to about 1598, and
 * the long row the same years at half speed. ww177 P7a: the game ends on
 * the row's last day (endIso), by default December 1599.
 */
export const IMJIN_CALENDARS: Readonly<Record<ImjinCalendarId, ImjinCalendar>> =
  {
    y1592: {
      id: "y1592",
      startIso: "1592-04-01",
      minutes: 30,
      tempo: 1,
      start: "y1592",
      endIso: "1598-12-31",
    },
    y1590: {
      id: "y1590",
      startIso: "1590-04-01",
      minutes: 45,
      tempo: 1,
      start: "y1590",
      endIso: "1599-12-31",
    },
    long: {
      id: "long",
      startIso: "1590-04-01",
      minutes: 90,
      tempo: 2,
      start: "y1590",
      endIso: "1599-12-31",
    },
    unlimited: {
      id: "unlimited",
      startIso: "1590-04-01",
      minutes: null,
      tempo: 2,
      start: "y1590",
      endIso: null,
    },
  };

export const IMJIN_DEFAULT_CALENDAR: ImjinCalendarId = "y1590";
/** The lobby's rows, in the order it lists them. */
export const IMJIN_LOBBY_CALENDARS: readonly ImjinCalendarId[] =
  IMJIN_CALENDAR_IDS;

export function imjinCalendarOf(
  cfg: Pick<GameConfig, "imjinCalendar">,
): ImjinCalendar {
  return IMJIN_CALENDARS[cfg.imjinCalendar ?? IMJIN_DEFAULT_CALENDAR];
}

/** The calendar epoch of the 1936 game: day 0 is 1 January 1936. */
export const WW1936_EPOCH_ISO = "1936-01-01";

/** Days since 1970-01-01 of the game's day 0 (Calendar.dateOfDay's epoch). */
export function wwEpochDays(
  cfg: ScenarioCfg & Pick<GameConfig, "imjinCalendar">,
): number {
  return epochDaysOf(
    isImjin(cfg) ? imjinCalendarOf(cfg).startIso : WW1936_EPOCH_ISO,
  );
}

/** The seats a human can take in this profile (null: every scenario country). */
export function humanSeatsOf(cfg: ScenarioCfg): readonly CountryTag[] | null {
  return isImjin(cfg) ? IMJIN_SEATS : null;
}
