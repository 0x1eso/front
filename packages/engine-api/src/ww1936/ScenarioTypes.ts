import { z } from "zod";
import { COUNTRY_TAGS } from "./Countries";
import { SEA_ZONE_BASE } from "./WorldWarTypes";

/** A tile as map coordinates [x, y]. */
const XY = z.tuple([
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
]);

export const REGION_TERRAINS = ["plains", "highland", "mountain"] as const;

export const ScenarioCountrySchema = z.object({
  tag: z.enum(COUNTRY_TAGS),
  capital: XY,
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
  vp: z.number().int().min(1),
  vpTile: XY,
  tiles: z.number().int().min(1),
  terrain: z.enum(REGION_TERRAINS),
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
});

/** scenario.json next to regions.bin (spec §4.7). */
export const ScenarioDataSchema = z.object({
  version: z.literal(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  countries: z.array(ScenarioCountrySchema).min(2),
  regions: z.array(ScenarioRegionSchema).min(1),
  seaZones: z.array(ScenarioSeaZoneSchema),
});

export type ScenarioData = z.infer<typeof ScenarioDataSchema>;
export type ScenarioCountry = z.infer<typeof ScenarioCountrySchema>;
export type ScenarioRegion = z.infer<typeof ScenarioRegionSchema>;
export type ScenarioSeaZone = z.infer<typeof ScenarioSeaZoneSchema>;

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
