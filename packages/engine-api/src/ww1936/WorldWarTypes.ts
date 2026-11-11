/** World War 1936 (spec §3.1): ticks of the opening preparation minute. */
export const WW_PREP_TICKS = 600;
/** Game length in minutes (spec §2.2; 45 until 2026-11, now 50: a day is unchanged, the game ends 1946-09-25). */
export const WW_GAME_MINUTES = 50;
/** First sea-zone id: land regions are 1..SEA_ZONE_BASE-1 (spec §4.7). */
export const SEA_ZONE_BASE = 40000;
/** Tiles handed over per tick after a capitulation (spec §7.5). */
export const WW_TRANSFER_TILES_PER_TICK = 20_000;
/** Starting troops as a percent of max troops (spec §5.3). */
export const WW_START_TROOPS_PCT = 50;
/**
 * The full capitulation gauge (spec §7.5; ww7: 45, was 30 daily checks): at
 * or past its surrender line the gauge rises each day by
 * 1 + ⌊(points over the line) ÷ WW_CAPITULATION_OVER_PP⌋, below the line it
 * falls WW_CAPITULATION_RECOVERY a day; a country capitulates when it fills.
 */
export const WW_CAPITULATION_DAYS = 45;
/** ww7: percentage points over the surrender line that add one more gauge point a day. */
export const WW_CAPITULATION_OVER_PP = 5;
/** ww7: gauge points a day below the surrender line. */
export const WW_CAPITULATION_RECOVERY = 2;
/** ww7: points holding its capital adds to a country's surrender line, and the highest the capital may take it to. */
export const WW_CAPITAL_LINE_PP = 15;
export const WW_CAPITAL_LINE_MAX = 95;
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
  // P5 (P5 spec §9.1, §10; plan decision 38), appended.
  "subject_restricted",
  "exile",
  // P6 (P6 spec §13.1): the United States while Congress backs it under 60%.
  "congress",
  // White peace: the two signed one less than WW_TRUCE_DAYS ago.
  "truce_active",
  // ww177 I4b: the Imjin War: Japan's muster is not ready to strike Joseon.
  "not_ready",
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

/**
 * Automation for a human's country (owner brief 2026-10-30): the domains a
 * human may hand to the AI, each its own switch (bit i of the mask is
 * WW_AUTO_DOMAINS[i]). Production: the AI's line planner (lines, their
 * factories, retooling, the naval lines); research: the next tech in every
 * slot; training: the AI's division training; air: the AI's air wings and
 * their missions in every zone; navy (appended): the AI's fleets — their sea
 * regions, missions and rules, the mine fleets, home when damaged — never an
 * invasion or the fleets supporting one under way; thought (appended, default
 * off): the AI's judgement of the nine military thought sliders; intel
 * (appended, default off): the AI's intelligence agency — founding (at
 * AI_MINOR_FOUND_PP), upgrades, operatives, operations and cryptology — never
 * a coup; diplomacy (appended, default off; ww161 Design B): every offer to
 * the country (peace, deal, ultimatum) is answered at once by its AI, no card.
 */
export const WW_AUTO_DOMAINS = [
  "production",
  "research",
  "training",
  "air",
  "navy",
  "thought",
  "intel",
  "diplomacy",
] as const;
export type WwAutoDomain = (typeof WW_AUTO_DOMAINS)[number];

/** The domain's bit in an automation mask. */
export function wwAutoBit(domain: WwAutoDomain): number {
  return 1 << WW_AUTO_DOMAINS.indexOf(domain);
}

/** A human country's automation switches (only countries with one on). */
export interface WwAutoData {
  smallID: number;
  /** WW_AUTO_DOMAINS bits (wwAutoBit). */
  mask: number;
}

/** What the screens read (GameUpdateType.WorldWar), sent when it changed. */
export interface WorldWarData {
  prepEndTick: number;
  wars: WarData[];
  capitulated: CapitulationData[];
  /** Only countries whose gauge is above 0, by smallID. */
  gauges: CapitulationGaugeData[];
  /** Automation: the countries with a switch on, by smallID (none: absent). */
  auto?: WwAutoData[];
}
