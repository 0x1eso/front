// STUB: owner I0b
import type { GameMap } from "@openfront/engine-api/game/GameMap";

export type ImjinTerrain =
  | "plain"
  | "paddy"
  | "hills"
  | "forest"
  | "mountain"
  | "pass"
  | "marsh"
  | "walled"
  | "fortress";

export function regionTerrain(_map: GameMap, _region: number): ImjinTerrain {
  return "plain";
}

export type ImjinEdge = "none" | "small_river" | "great_river" | "ford";

export function edgeBetween(_map: GameMap, _a: number, _b: number): ImjinEdge {
  return "none";
}

export interface SeaFlags {
  coastal: boolean;
  lee: boolean;
  channel: boolean;
  shoal: boolean;
  current: number;
}

export function seaFlagsAt(_map: GameMap, _tile: number): SeaFlags {
  return {
    coastal: false,
    lee: false,
    channel: false,
    shoal: false,
    current: 0,
  };
}
