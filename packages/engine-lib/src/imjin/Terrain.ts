// STUB: owner I0b
// The Imjin map's terrain classes, region edges and per-tile sea flags
// (design ww175 §3-§4). Lane I0b owns the real file; this stub lets I1 and I2
// build against the same names until the P0-P2 merge.

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

export type ImjinEdge = "none" | "small_river" | "great_river" | "ford";

export interface SeaFlags {
  coastal: boolean;
  lee: boolean;
  channel: boolean;
  shoal: boolean;
  current: number;
}

export function regionTerrain(_map: unknown, _region: number): ImjinTerrain {
  return "plain";
}

export function edgeBetween(_map: unknown, _a: number, _b: number): ImjinEdge {
  return "none";
}

export function seaFlagsAt(_map: unknown, _tile: number): SeaFlags {
  return {
    coastal: false,
    lee: false,
    channel: false,
    shoal: false,
    current: 0,
  };
}
