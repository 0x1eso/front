import { TileRef } from "../game/GameMap";
import { UnitType } from "../game/GameTypes";

/**
 * Strategic weapons (GameConfig.strategicWeapons, spec
 * docs/superpowers/specs/2026-10-16-strategic-weapons-design.md): the
 * shapes the engine, the wire and the client share.
 */

/** Nukes made in factories and kept in a stockpile (spec §4). */
export const STOCKPILED_NUKES = [
  UnitType.AtomBomb,
  UnitType.HydrogenBomb,
  UnitType.MIRV,
] as const;
export type StockpiledNuke = (typeof STOCKPILED_NUKES)[number];

/** Stockpiled nukes that can be fired at a satellite, hydrogen first (spec §6.3). */
export const INTERCEPTOR_NUKES = [
  UnitType.HydrogenBomb,
  UnitType.AtomBomb,
] as const;
export type InterceptorNuke = (typeof INTERCEPTOR_NUKES)[number];

/** One nuke being made on one factory line. */
export interface NukeJobData {
  factoryId: number;
  type: StockpiledNuke;
  startTick: number;
  endTick: number;
}

/** A nuke fired at a satellite, judged at resolveTick. */
export interface InterceptorData {
  /** The firing player's smallID. */
  by: number;
  type: InterceptorNuke;
  resolveTick: number;
  /** The silo it was fired from (the client draws the climb from there). */
  from?: TileRef;
}

/** A nation's one satellite (spec §6). "spent": struck or shot down, never again. */
export type SatelliteData =
  | { phase: "none" }
  | { phase: "preparing"; siloId: number; startTick: number; readyTick: number }
  | { phase: "orbit" }
  | {
      phase: "targeted";
      /** The target's smallID. */
      target: number;
      strikeTick: number;
      interceptors: InterceptorData[];
    }
  | { phase: "spent" };

/** Strategic state as sent worker -> main thread on PlayerUpdate. Never mutated. */
export interface StrategicData {
  stock: Readonly<Record<StockpiledNuke, number>>;
  jobs: readonly NukeJobData[];
  satellite: SatelliteData;
}
