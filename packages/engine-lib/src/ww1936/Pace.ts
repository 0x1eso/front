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

/** How many times longer a tick lasts: WW_UNLIMITED_TEMPO unlimited, else 1. */
export function wwTempo(gc: GameConfig): number {
  return wwUnlimited(gc) ? WW_UNLIMITED_TEMPO : 1;
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
