import { GameConfig } from "@openfront/engine-api/Schemas";
import type { Config } from "../configuration/Config";
import { dayOfDate } from "./Calendar";

/**
 * World War 1936, the unlimited game: each tick lasts this many times the
 * usual 100 ms, so the war plays this much slower in real time.
 */
export const WW_UNLIMITED_TEMPO = 4;

/** V-J Day: the historical AI follows the calendar until this date. */
export const WW_HISTORY_END_ISO = "1945-09-02";

/** The unlimited game: the mode with its key. The key alone does nothing. */
export function wwUnlimited(gc: GameConfig): boolean {
  return gc.worldWar1936 === true && gc.ww1936Unlimited === true;
}

/**
 * The unlimited game at the timed game's tempo: no timer (wwUnlimited
 * stays true) but ticks of 100 ms. Needs the unlimited key; alone it does
 * nothing.
 */
export function wwFastTempo(gc: GameConfig): boolean {
  return wwUnlimited(gc) && gc.ww1936FastTempo === true;
}

/**
 * How many times longer a tick lasts: WW_UNLIMITED_TEMPO in the slow
 * unlimited game, else 1 (the timed game and the fast unlimited one).
 */
export function wwTempo(gc: GameConfig): number {
  return wwUnlimited(gc) && !wwFastTempo(gc) ? WW_UNLIMITED_TEMPO : 1;
}

/** The lobby's three game lengths: 50 minutes, unlimited slow, unlimited fast. */
export const WW_LENGTHS = ["timed", "slow", "fast"] as const;
export type WwLength = (typeof WW_LENGTHS)[number];

export function wwLengthOf(gc: GameConfig): WwLength {
  if (!wwUnlimited(gc)) return "timed";
  return wwFastTempo(gc) ? "fast" : "slow";
}

/** The config keys a lobby sends for a length (fast key only when fast). */
export function wwLengthKeys(
  length: WwLength,
): Pick<GameConfig, "ww1936Unlimited" | "ww1936FastTempo"> {
  return length === "fast"
    ? { ww1936Unlimited: true, ww1936FastTempo: true }
    : { ww1936Unlimited: length === "slow" };
}

/** One tick's wall length in milliseconds. */
export function msPerTickOf(gc: GameConfig): number {
  return 100 * wwTempo(gc);
}

/**
 * A span written in 100 ms ticks, in this game's ticks: the same real
 * seconds, rounded up.
 */
export function wwRealTicks(gc: GameConfig, ticks: number): number {
  return Math.ceil(ticks / wwTempo(gc));
}

/** The historical AI steers a nation on this game day (before V-J Day). */
export function historicalAiActive(config: Config, day: number): boolean {
  return config.historicalAi() && day < dayOfDate(WW_HISTORY_END_ISO);
}
