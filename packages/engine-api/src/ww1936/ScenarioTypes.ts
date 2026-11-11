import { z } from "zod";
import { GW_TAGS } from "../ww1914/GwCountries";
import { COUNTRY_TAGS } from "./Countries";
import { DAMS, LANDMARKS } from "./DepthTypes";
import { REGION_CATEGORIES } from "./EconomyTypes";
import { LAND_TERRAINS } from "./LandTypes";
import { SEA_ZONE_BASE } from "./WorldWarTypes";

/** A tile as map coordinates [x, y]. */
const XY = z.tuple([
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
]);

export const REGION_TERRAINS = ["plains", "highland", "mountain"] as const;

/**
 * The Imjin map's region classes (ww175 design §4; engine-lib
 * imjin/Terrain.ts reads them).
 */
export const IMJIN_TERRAINS = [
  "plain",
  "paddy",
  "hills",
  "forest",
  "mountain",
  "pass",
  "marsh",
  "walled",
  "fortress",
] as const;

/** A building count a region starts with (spec §3.1). */
const Count = z.number().int().min(0).max(12);
const Amount = z.number().int().min(0);
/** A level building's start level (P2 spec §3.1). */
const Level = z.number().int().min(0).max(5);
const RegionId = z
  .number()
  .int()
  .min(1)
  .max(SEA_ZONE_BASE - 1);
const ZoneId = z
  .number()
  .int()
  .min(SEA_ZONE_BASE + 1)
  .max(65535);

export const ScenarioCountrySchema = z.object({
  tag: z.enum(COUNTRY_TAGS),
  capital: XY,
  /** P2 (v3): industrialisation 1..5 from economy1936.json (P2 spec §6.4). */
  dev: z.number().int().min(1).max(5).optional(),
});

export const ScenarioRegionSchema = z.object({
  id: z
    .number()
    .int()
    .min(1)
    .max(SEA_ZONE_BASE - 1),
  name: z.string().min(1),
  nameKo: z.string().min(1),
  owner: z.enum(COUNTRY_TAGS),
  /** The 1914 set: the name content knows it by (ww1914/GwPlaces.gen.ts). */
  place: z.string().min(1).optional(),
  /** The 1914 set: its owner in June 1914. */
  gwOwner: z.enum(GW_TAGS).optional(),
  // 0 for a region without a city (spec §7.5).
  vp: z.number().int().min(0),
  vpTile: XY,
  tiles: z.number().int().min(1),
  terrain: z.enum(REGION_TERRAINS),
  // P1 (spec §3.1). The defaults only fill version 1 files (plan decision 8).
  cat: z.enum(REGION_CATEGORIES).default("rural"),
  /** 1936 population, thousands. */
  pop: z.number().int().min(0).default(0),
  infra: z.number().int().min(1).max(5).default(1),
  /** Part of its 1936 owner's homeland (not a colony or mandate). */
  core: z.boolean().default(true),
  /** A land tile of it touches a sea-zone tile (4-neighbour). */
  coastal: z.boolean().default(false),
  civ: Count.default(0),
  mil: Count.default(0),
  dock: Count.default(0),
  /**
   * Daily output at infrastructure 5, RESOURCE_IDS order: the six P1
   * resources in a file (P6: ScenarioIndex appends uranium and coal from
   * the v5 fields, so a region it hands out holds RESOURCE_COUNT).
   */
  // P1's six, or P6's eight (uranium, coal): never seven (review L9).
  res: z
    .array(Amount)
    .refine((a) => a.length === 6 || a.length === 8)
    .default([0, 0, 0, 0, 0, 0]),
  // P2 (P2 spec §3.1, version 3). Optional: the ScenarioIndex readers fill
  // a missing one from the other fields (plan decision 5).
  land: z.enum(LAND_TERRAINS).optional(),
  center: XY.optional(),
  /** Latitude of the center, hundredths of a degree. */
  latC: z.number().int().min(-9000).max(9000).optional(),
  /** 10°×10° weather cell (Weather.weatherCell). */
  wcell: z.number().int().min(0).max(647).optional(),
  rail: Level.optional(),
  fort: Level.optional(),
  port: z.boolean().optional(),
  /** P4 spec §3.2: key of a preserved or stamped island (islands1936.json). */
  island: z.string().min(1).optional(),
  // P4 (v4, P4 spec §3.6). Optional: the ScenarioIndex readers fill a
  // missing one (plan decision 6).
  /** Land strategic region. */
  sr: z.number().int().min(1).max(999).optional(),
  /** Harbor sea zone (spec §3.5); 0: not coastal. */
  harbor: z.number().int().min(0).max(65535).optional(),
  navalBase: z.number().int().min(0).max(10).optional(),
  airBase: z.number().int().min(0).max(10).optional(),
  aa: z.number().int().min(0).max(5).optional(),
  coastalFort: z.number().int().min(0).max(5).optional(),
  // P6 (v5, P6 spec §16.1–§16.4). Optional: a v4 file reads none
  // (ScenarioIndex's readers give 0, no landmark, no dam).
  coal: z.number().int().min(0).max(8).optional(),
  uranium: z.number().int().min(0).max(6).optional(),
  hydro: z.number().int().min(0).max(6).optional(),
  /** At most two (New York holds two, spec §16.3). */
  landmarks: z.array(z.enum(LANDMARKS)).max(2).optional(),
  dam: z
    .object({ id: z.enum(DAMS), downstream: z.array(RegionId).max(3) })
    .optional(),
  /** The Imjin map: the region's class (ww175 design §4). */
  imjinTerrain: z.enum(IMJIN_TERRAINS).optional(),
});

export const ScenarioSeaZoneSchema = z.object({
  id: z
    .number()
    .int()
    .min(SEA_ZONE_BASE + 1)
    .max(65535),
  name: z.string().min(1),
  nameKo: z.string().min(1),
  tiles: z.number().int().min(1),
  /** P4 spec §3.1 (folded into P2's rebuild): a lake, not a sea. */
  lake: z.boolean().optional(),
  // P4 (v4, P4 spec §3.6).
  /** The water tile nearest the zone's centroid. */
  center: XY.optional(),
  latC: z.number().int().min(-9000).max(9000).optional(),
  wcell: z.number().int().min(0).max(647).optional(),
  /** Sea strategic region (0 for a lake). */
  sr: z.number().int().min(0).max(1999).optional(),
});

/** P4 spec §3.4: a land or sea strategic region (an air zone, a naval mission area). */
const StrategicSchema = z.object({
  id: z.number().int().min(1).max(1999),
  kind: z.enum(["land", "sea"]),
  name: z.string().min(1),
  nameKo: z.string().min(1),
  center: XY,
  latC: z.number().int().min(-9000).max(9000),
  /** Land: region ids; sea: sea zone ids. Ascending. */
  members: z.array(z.number().int().min(1).max(65535)).min(1),
});
/** Plan decision 9: per map row, the center latitude ×100 and one tile's east-west km ×1000. */
const RowsSchema = z.object({
  latC: z.array(z.number().int().min(-9000).max(9000)),
  kmxMilli: z.array(z.number().int().min(0)),
});

/** [a, b, border, km, river 0..2, strait 0..1], a < b, sorted (P2 spec §3.1). */
const EdgeSchema = z.tuple([
  RegionId,
  RegionId,
  z.number().int().min(0),
  z.number().int().min(1),
  z.number().int().min(0).max(2),
  z.number().int().min(0).max(1),
]);
/** [a, b, km, kind 0 water / 1 strait / 2 canal / 3 date line] (P4 spec §3.3). */
const SeaEdgeSchema = z.tuple([
  ZoneId,
  ZoneId,
  z.number().int().min(1),
  z.number().int().min(0).max(3),
]);
/** A named place of the Imjin map: a pass, a ford or a channel. */
const ImjinLabelSchema = z.object({
  kind: z.enum(["pass", "ford", "channel"]),
  /** A channel's current heading, 0..63 (0 north, 16 east): its axis. */
  dir: z.number().int().min(0).max(63).optional(),
  name: z.string().min(1),
  nameKo: z.string().min(1),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
});

/**
 * The Imjin map's terrain data (ww175 design §3-4, map-generator
 * cmd/ww1936build imjin.go): the fords, every tile's sea flag byte as
 * run-length pairs [count, byte, …] in tile order (bit 0 coastal, 1 lee,
 * 2 channel, 3 shoal, high nibble the current id), the currents by id
 * (id = index + 1) and the named places.
 */
export const ImjinMapSchema = z.object({
  fords: z.array(z.tuple([RegionId, RegionId])),
  seaFlags: z.array(z.number().int().min(0)),
  currents: z.array(ImjinLabelSchema),
  labels: z.array(ImjinLabelSchema),
});
export type ImjinMapData = z.infer<typeof ImjinMapSchema>;

const StraitSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["strait", "canal"]),
  a: ZoneId,
  b: ZoneId,
  shore: z.array(RegionId).min(1),
});

/**
 * scenario.json next to regions.bin (spec §4.7; version 2: P1 spec §3.1;
 * version 3: P2 spec §3.1, the land graph; version 4: P4 spec §3.6, the
 * strategic regions, harbors, bases and the row table; version 5: P6 spec
 * §16, coal, uranium, hydro, landmarks and dams).
 */
export const ScenarioDataSchema = z.object({
  version: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  countries: z.array(ScenarioCountrySchema).min(2),
  regions: z.array(ScenarioRegionSchema).min(1),
  seaZones: z.array(ScenarioSeaZoneSchema),
  edges: z.array(EdgeSchema).optional(),
  seaEdges: z.array(SeaEdgeSchema).optional(),
  straits: z.array(StraitSchema).optional(),
  /** World 1936 only: the hand order of battle applies (plan decision 14). */
  historicalOob: z.boolean().optional(),
  /** Map km per tile for straight-line distances (regionKm); default 40075 / width. The test map says 4. */
  kmPerTile: z.number().positive().optional(),
  /** P4 (v4): strategic regions, land ids ascending then sea ids ascending in the file. */
  strategic: z.array(StrategicSchema).optional(),
  /** P4 (v4, plan decision 9): the row table of kmBetween. */
  rows: RowsSchema.optional(),
  /** false: the map is a window of the globe (the Imjin map), so east-west distances do not wrap at its edges. */
  wrapX: z.boolean().optional(),
  /** The Imjin map's terrain data. */
  imjin: ImjinMapSchema.optional(),
});

export type ScenarioData = z.infer<typeof ScenarioDataSchema>;
export type ScenarioCountry = z.infer<typeof ScenarioCountrySchema>;
export type ScenarioRegion = z.infer<typeof ScenarioRegionSchema>;
export type ScenarioSeaZone = z.infer<typeof ScenarioSeaZoneSchema>;
export type ScenarioStrategic = z.infer<typeof StrategicSchema>;

/** Plain data with every property, array and tuple read-only, all the way down. */
export type DeepReadonly<T> = T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;

// The static scenario as ScenarioIndex hands it out. It is not part of a
// snapshot (a restore rebuilds it from the map files), so nothing may write it.
export type ReadonlyScenarioData = DeepReadonly<ScenarioData>;
export type ReadonlyScenarioCountry = DeepReadonly<ScenarioCountry>;
export type ReadonlyScenarioRegion = DeepReadonly<ScenarioRegion>;
export type ReadonlyScenarioSeaZone = DeepReadonly<ScenarioSeaZone>;
