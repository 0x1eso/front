import { GameMap, TileRef } from "@openfront/engine-api/game/GameMap";
import {
  COUNTRY_TAGS,
  CountryTag,
} from "@openfront/engine-api/ww1936/Countries";
import {
  ReadonlyScenarioData,
  ReadonlyScenarioRegion,
  ReadonlyScenarioSeaZone,
} from "@openfront/engine-api/ww1936/ScenarioTypes";
import { SEA_ZONE_BASE } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { decodeRegions } from "./Regions";

/**
 * The static World War 1936 scenario: a region id per tile and what
 * scenario.json says about regions, sea zones and countries. Built once from
 * the map files, by the engine and by the screens alike.
 *
 * Read-only: it is not part of a snapshot (a restore rebuilds it from the
 * map files), so a write here would be state that neither snapshots nor
 * hashes see. The types say so everywhere they can.
 */
export class ScenarioIndex {
  readonly width: number;
  readonly height: number;
  /** scenario.json, validated. */
  readonly data: ReadonlyScenarioData;
  /**
   * The region id of every tile, in map.bin order. Never write it. It stays
   * a Uint16Array because the renderer uploads it as a texture.
   */
  readonly regionIds: Uint16Array;
  /** Countries in the scenario, in COUNTRY_TAGS order: smallID = index + 1. */
  readonly countries: readonly CountryTag[];
  /** Land regions sorted by id. */
  readonly landRegions: readonly ReadonlyScenarioRegion[];
  private readonly regionById = new Map<number, ReadonlyScenarioRegion>();
  private readonly seaById = new Map<number, ReadonlyScenarioSeaZone>();
  private readonly capitals = new Map<CountryTag, readonly [number, number]>();
  private readonly owners: Uint16Array;
  private readonly _totalVp: number;

  constructor(data: ReadonlyScenarioData, regionIds: Uint16Array) {
    this.data = data;
    this.regionIds = regionIds;
    this.width = data.width;
    this.height = data.height;
    if (regionIds.length !== data.width * data.height) {
      throw new Error(
        `scenario: ${regionIds.length} region ids for ${data.width}x${data.height}`,
      );
    }
    const present = new Set(data.countries.map((c) => c.tag));
    this.countries = COUNTRY_TAGS.filter((t) => present.has(t));
    for (const c of data.countries) this.capitals.set(c.tag, c.capital);
    for (const s of data.seaZones) this.seaById.set(s.id, s);
    let maxId = 0;
    let vp = 0;
    for (const r of data.regions) {
      this.regionById.set(r.id, r);
      if (r.id > maxId) maxId = r.id;
      vp += r.vp;
    }
    this._totalVp = vp;
    this.landRegions = [...data.regions].sort((a, b) => a.id - b.id);
    this.owners = new Uint16Array(maxId + 1);
    for (const r of data.regions) {
      const owner = this.smallIdOf(r.owner);
      if (owner === 0) {
        throw new Error(
          `scenario: region ${r.id} belongs to ${r.owner}, which is missing`,
        );
      }
      this.owners[r.id] = owner;
    }
  }

  static fromFiles(
    data: ReadonlyScenarioData,
    regionsBin: Uint8Array,
  ): ScenarioIndex {
    return new ScenarioIndex(
      data,
      decodeRegions(regionsBin, data.width, data.height),
    );
  }

  /** The country's smallID, or 0 when it is not in this scenario. */
  smallIdOf(tag: CountryTag): number {
    return this.countries.indexOf(tag) + 1;
  }

  tagOfSmallId(smallID: number): CountryTag | undefined {
    return smallID >= 1 ? this.countries[smallID - 1] : undefined;
  }

  regionAt(tile: TileRef): number {
    return this.regionIds[tile];
  }

  /** A land region; undefined for sea zones, 0 and unknown ids. */
  region(id: number): ReadonlyScenarioRegion | undefined {
    return id >= 1 && id < SEA_ZONE_BASE ? this.regionById.get(id) : undefined;
  }

  seaZone(id: number): ReadonlyScenarioSeaZone | undefined {
    return this.seaById.get(id);
  }

  capitalXY(tag: CountryTag): readonly [number, number] {
    const xy = this.capitals.get(tag);
    if (xy === undefined) throw new Error(`scenario: no capital for ${tag}`);
    return xy;
  }

  capitalTile(tag: CountryTag): TileRef {
    const [x, y] = this.capitalXY(tag);
    return y * this.width + x;
  }

  vpTile(region: ReadonlyScenarioRegion): TileRef {
    return region.vpTile[1] * this.width + region.vpTile[0];
  }

  /** smallID of each land region's 1936 owner, indexed by region id (read-only). */
  ownerByRegion(): ArrayLike<number> {
    return this.owners;
  }

  totalVp(): number {
    return this._totalVp;
  }

  /** Victory points each country starts with, indexed by smallID (a fresh array). */
  startVpBySmallId(): number[] {
    const out = new Array<number>(this.countries.length + 1).fill(0);
    for (const r of this.landRegions) out[this.owners[r.id]] += r.vp;
    return out;
  }
}

/**
 * Gives every land tile its 1936 owner (spec §5.3). The engine runs it once
 * at the start (without tile updates) and every screen runs it on its own
 * copy of the map, so both start from the same owners.
 */
export function fillScenarioOwners(map: GameMap, index: ScenarioIndex): void {
  if (map.width() !== index.width || map.height() !== index.height) {
    throw new Error(
      `scenario is ${index.width}x${index.height}, the map ${map.width()}x${map.height()}`,
    );
  }
  const owners = index.ownerByRegion();
  const ids = index.regionIds;
  for (let t = 0; t < ids.length; t++) {
    const id = ids[t];
    if (id === 0 || id >= SEA_ZONE_BASE || id >= owners.length) continue;
    if (!map.isLand(t) || map.isImpassable(t)) continue;
    const owner = owners[id];
    if (owner !== 0) map.setOwnerID(t, owner);
  }
}
