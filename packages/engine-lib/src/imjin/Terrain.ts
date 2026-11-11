// The Imjin map's terrain (ww175 design §3-4): each region's class, each
// land edge's river kind and each sea tile's flags, as the map builder
// wrote them into scenario.json (map-generator cmd/ww1936build imjin.go).
// Pure reads of the map data: the rules that use them live in LandRules
// and SeaRules.
import {
  IMJIN_TERRAINS,
  type DeepReadonly,
  type ImjinMapData,
  type ScenarioData,
} from "@openfront/engine-api/ww1936/ScenarioTypes";

export { IMJIN_TERRAINS };

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
  /** Within 3 tiles of land. */
  coastal: boolean;
  /** In an island's lee: a fleet holding still here hides. */
  lee: boolean;
  /** A narrow channel, 3 tiles across. */
  channel: boolean;
  /** Shallows: big ships cannot enter. */
  shoal: boolean;
  /** 0 for none, otherwise the current id (channels only). */
  current: number;
  /**
   * The current's axis as a heading, 0..63 (0 north, 16 east, 32 south):
   * the way it runs on the battle clock's first half; it flips with the
   * clock. 0 when there is no current.
   */
  currentDir: number;
}

/** Sea flag bits of the map data (imjin.go). */
export const SEA_FLAG_COASTAL = 1;
export const SEA_FLAG_LEE = 2;
export const SEA_FLAG_CHANNEL = 4;
export const SEA_FLAG_SHOAL = 8;
export const SEA_FLAG_CURRENT_SHIFT = 4;

/** What the readers need of the map: ScenarioIndex is one. */
export interface ImjinMapLike {
  readonly data: DeepReadonly<
    Pick<ScenarioData, "regions" | "width" | "height" | "imjin">
  >;
  region(
    id: number,
  ): DeepReadonly<{ imjinTerrain?: ImjinTerrain | undefined }> | undefined;
  edgeBetween(a: number, b: number): number;
  edge(i: number): { readonly river: 0 | 1 | 2 };
}

/** True on the Imjin map (its scenario carries the imjin block). */
export function hasImjinTerrain(map: Pick<ImjinMapLike, "data">): boolean {
  return map.data.imjin !== undefined;
}

/** A region's class; "plain" for a region the map gives none. */
export function regionTerrain(map: ImjinMapLike, region: number): ImjinTerrain {
  return map.region(region)?.imjinTerrain ?? "plain";
}

interface Decoded {
  imjin: DeepReadonly<ImjinMapData>;
  flags: Uint8Array;
  fords: Set<number>;
}
const decodedOf = new WeakMap<object, Decoded>();

const pairKey = (a: number, b: number): number =>
  Math.min(a, b) * 65536 + Math.max(a, b);

/** Decodes the run-length sea flags once per map data. */
function decoded(map: Pick<ImjinMapLike, "data">): Decoded | null {
  const imjin = map.data.imjin;
  if (imjin === undefined) return null;
  const hit = decodedOf.get(imjin);
  if (hit !== undefined) return hit;
  const flags = new Uint8Array(map.data.width * map.data.height);
  const runs = imjin.seaFlags;
  let at = 0;
  for (let k = 0; k + 1 < runs.length; k += 2) {
    const end = Math.min(flags.length, at + runs[k]);
    if (runs[k + 1] !== 0) flags.fill(runs[k + 1], at, end);
    at = end;
  }
  const fords = new Set<number>();
  for (const [a, b] of imjin.fords) fords.add(pairKey(a, b));
  const out = { imjin, flags, fords };
  decodedOf.set(imjin, out);
  return out;
}

/** The kind of the land edge between two regions ("none" without one). */
export function edgeBetween(
  map: ImjinMapLike,
  a: number,
  b: number,
): ImjinEdge {
  const i = map.edgeBetween(a, b);
  if (i < 0) return "none";
  const river = map.edge(i).river;
  if (river === 0) return "none";
  if (decoded(map)?.fords.has(pairKey(a, b)) === true) return "ford";
  return river === 2 ? "great_river" : "small_river";
}

const NO_FLAGS: SeaFlags = {
  coastal: false,
  lee: false,
  channel: false,
  shoal: false,
  current: 0,
  currentDir: 0,
};

/** The flag byte of a tile (0 on land, off the map or off the Imjin map). */
export function seaFlagByte(
  map: Pick<ImjinMapLike, "data">,
  tile: number,
): number {
  const d = decoded(map);
  if (d === null || tile < 0 || tile >= d.flags.length) return 0;
  return d.flags[tile];
}

/** A tile's sea flags (all false and 0 on land and off the Imjin map). */
export function seaFlagsAt(
  map: Pick<ImjinMapLike, "data">,
  tile: number,
): SeaFlags {
  const b = seaFlagByte(map, tile);
  if (b === 0) return NO_FLAGS;
  const current = b >> SEA_FLAG_CURRENT_SHIFT;
  return {
    coastal: (b & SEA_FLAG_COASTAL) !== 0,
    lee: (b & SEA_FLAG_LEE) !== 0,
    channel: (b & SEA_FLAG_CHANNEL) !== 0,
    shoal: (b & SEA_FLAG_SHOAL) !== 0,
    current,
    currentDir:
      current === 0 ? 0 : (map.data.imjin?.currents[current - 1]?.dir ?? 0),
  };
}
