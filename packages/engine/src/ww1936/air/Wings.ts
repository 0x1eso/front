// World War 1936 air overhaul (ww8), lane A: forming wings, refills, bases,
// field strips (design §3.1, §3.2). Stubs from W0; WwAir's tickWings and
// issueWingOrder call them in the wing model only.
import type {
  AirBaseUse,
  Wing,
  WingOrder,
} from "@openfront/engine-api/ww1936/AirTypes";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import { fillDecks } from "../navy/Carriers";
import type { WwAir } from "./WwAir";

/**
 * The country's turn (WwAir calls it on its id's day tick, for a country
 * that plays): the 30-day tally slots, then lane A's forming, idle refills,
 * re-basing, carrier wings and the wings' "yesterday" counters (dayKills and
 * dayLost move to prevKills and prevLost). W0 keeps only the tally slots and
 * the decks.
 */
export function dailyWingCountry(
  air: WwAir,
  smallID: number,
  day: number,
): void {
  const c = air.country(smallID);
  if (c === null) return;
  const next = (((day + 1) % 30) + 30) % 30;
  c.tally[0][next] = 0;
  c.tally[1][next] = 0;
  fillDecks(air.navy, smallID);
}

/** The start of the game (WwAir.start): every country forms its wings. Lane A. */
export function formStartWings(air: WwAir): void {
  void air;
}

/** A wing entering `rearm` (lane B calls it): refill and swap for newer planes. Lane A. */
export function rearmWing(air: WwAir, w: Wing, tick: number): void {
  void air;
  void w;
  void tick;
}

/**
 * The base's share of a take-off's efficiency, ‰: min(1, capacity ÷ use) ×
 * WW_FIELD_STRIP_EFF_PM on a strip (the bomb damage is sortieEffPm's own
 * argument, WwAir.baseDamagePm). Lane A; 1000 until then.
 */
export function wingBaseEffPm(air: WwAir, w: Wing): number {
  void air;
  void w;
  return 1000;
}

/** wing_base. Lane A. */
export function issueWingBase(
  air: WwAir,
  smallID: number,
  wings: readonly Wing[],
  order: Extract<WingOrder, { kind: "wing_base" }>,
  tick: number,
): WwOrderBlock | null {
  void air;
  void smallID;
  void wings;
  void order;
  void tick;
  return "bad_index";
}

/** wing_disband. Lane A. */
export function issueWingDisband(
  air: WwAir,
  smallID: number,
  wing: Wing,
  tick: number,
): WwOrderBlock | null {
  void air;
  void smallID;
  void wing;
  void tick;
  return "bad_index";
}

/** air_field. Lane A. */
export function issueAirField(
  air: WwAir,
  smallID: number,
  region: number,
  tick: number,
): WwOrderBlock | null {
  void air;
  void smallID;
  void region;
  void tick;
  return "bad_index";
}

/** A base's region changed hands (design §3.2). Lane A. */
export function onBaseControlChanged(
  air: WwAir,
  region: number,
  from: number,
  to: number,
  tick: number,
): void {
  void air;
  void region;
  void from;
  void to;
  void tick;
}

/**
 * The bases the country's screen lists: every base its side may use, with
 * or without its planes, and its field strips. Lane A; empty until then.
 */
export function baseUsesOf(air: WwAir, smallID: number): AirBaseUse[] {
  void air;
  void smallID;
  return [];
}
