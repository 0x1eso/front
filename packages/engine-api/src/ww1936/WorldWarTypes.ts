/** World War 1936 (spec §3.1): ticks of the opening preparation minute. */
export const WW_PREP_TICKS = 600;
/** Game length in minutes (spec §2.2). */
export const WW_GAME_MINUTES = 45;
/** First sea-zone id: land regions are 1..SEA_ZONE_BASE-1 (spec §4.7). */
export const SEA_ZONE_BASE = 40000;
/** Tiles handed over per tick after a capitulation (spec §7.5). */
export const WW_TRANSFER_TILES_PER_TICK = 20_000;
/** Starting troops as a percent of max troops (spec §5.3). */
export const WW_START_TROOPS_PCT = 50;
/**
 * Daily checks a country must stay at or past its surrender line before it
 * capitulates: the full capitulation gauge (spec §7.5).
 */
export const WW_CAPITULATION_DAYS = 30;
/** Victory points a capital adds to its region (spec §7.5). */
export const WW_CAPITAL_VP = 15;

/** Why a declaration of war is refused (`declareWarBlock`, UI reason text). */
export const DECLARE_WAR_BLOCKS = [
  "prep",
  "self",
  "dead",
  "capitulated",
  "faction",
  "at_war",
  // P3 (P3 spec §14.5), appended.
  "nap",
  "guarantor",
  "democracy_no_goal",
  "isolation",
] as const;
export type DeclareWarBlock = (typeof DECLARE_WAR_BLOCKS)[number];

/** One war, by smallIDs (a < b), in the order the wars began. */
export interface WarData {
  a: number;
  b: number;
  sinceTick: number;
}

export interface CapitulationData {
  smallID: number;
  /** smallID of the country that took the rest of its land; 0 if none. */
  victor: number;
  tick: number;
}

/** A country on its way to capitulating (spec §7.5). */
export interface CapitulationGaugeData {
  smallID: number;
  /** 1..WW_CAPITULATION_DAYS - 1: daily checks at or past its surrender line, less recoveries. */
  days: number;
}

/** What the screens read (GameUpdateType.WorldWar), sent when it changed. */
export interface WorldWarData {
  prepEndTick: number;
  wars: WarData[];
  capitulated: CapitulationData[];
  /** Only countries whose gauge is above 0, by smallID. */
  gauges: CapitulationGaugeData[];
}
