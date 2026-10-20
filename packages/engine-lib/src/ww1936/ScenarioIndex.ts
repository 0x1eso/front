import { GameMap, TileRef } from "@openfront/engine-api/game/GameMap";
import {
  COUNTRY_TAGS,
  CountryTag,
} from "@openfront/engine-api/ww1936/Countries";
import { CATEGORY_SLOTS } from "@openfront/engine-api/ww1936/EconomyTypes";
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
  /** Region neighbours, built on first use (static, never in a snapshot). */
  private adjacency: Adjacency | null = null;

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

  /** Land regions sharing a 4-neighbour edge with `id`, ascending (P1 spec §3.4). */
  regionNeighbours(id: number): readonly number[] {
    return this.adj().land.get(id) ?? [];
  }

  /** Sea zones a land region touches, ascending. */
  regionSeaZones(id: number): readonly number[] {
    return this.adj().sea.get(id) ?? [];
  }

  /** Base shared building slots of a land region (P1 spec §4.2). */
  baseSlots(id: number): number {
    const r = this.region(id);
    return r === undefined ? 0 : CATEGORY_SLOTS[r.cat];
  }

  /** Every land-land pair once (a < b), ascending, for the country graph. */
  regionPairs(): readonly (readonly [number, number])[] {
    return this.adj().pairs;
  }

  // One pass over the tiles (right and down neighbours), the first time an
  // economy asks. Static like regionIds, so never part of a snapshot.
  private adj(): Adjacency {
    if (this.adjacency !== null) return this.adjacency;
    const landSets = new Map<number, Set<number>>();
    const seaSets = new Map<number, Set<number>>();
    const add = (m: Map<number, Set<number>>, a: number, b: number) => {
      let s = m.get(a);
      if (s === undefined) m.set(a, (s = new Set()));
      s.add(b);
    };
    const link = (a: number, b: number) => {
      if (a === b || a === 0 || b === 0) return;
      const aLand = a < SEA_ZONE_BASE;
      const bLand = b < SEA_ZONE_BASE;
      if (aLand && bLand) {
        add(landSets, a, b);
        add(landSets, b, a);
      } else if (aLand && b > SEA_ZONE_BASE) add(seaSets, a, b);
      else if (bLand && a > SEA_ZONE_BASE) add(seaSets, b, a);
    };
    const ids = this.regionIds;
    const w = this.width;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < w; x++) {
        const t = y * w + x;
        if (x + 1 < w) link(ids[t], ids[t + 1]);
        if (y + 1 < this.height) link(ids[t], ids[t + w]);
      }
    }
    const sorted = (m: Map<number, Set<number>>) =>
      new Map(
        [...m]
          .sort((x, y) => x[0] - y[0])
          .map(([k, s]) => [k, [...s].sort((a, b) => a - b)] as const),
      );
    const land = sorted(landSets);
    const pairs: [number, number][] = [];
    for (const [a, list] of land) {
      for (const b of list) if (a < b) pairs.push([a, b]);
    }
    pairs.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    this.adjacency = { land, sea: sorted(seaSets), pairs };
    return this.adjacency;
  }
}

interface Adjacency {
  land: ReadonlyMap<number, readonly number[]>;
  sea: ReadonlyMap<number, readonly number[]>;
  pairs: readonly (readonly [number, number])[];
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
