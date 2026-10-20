import { GameMap, TileRef } from "@openfront/engine-api/game/GameMap";
import {
  COUNTRIES,
  COUNTRY_TAGS,
  CountryTag,
} from "@openfront/engine-api/ww1936/Countries";
import { CATEGORY_SLOTS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { LandTerrain } from "@openfront/engine-api/ww1936/LandTypes";
import {
  ReadonlyScenarioData,
  ReadonlyScenarioRegion,
  ReadonlyScenarioSeaZone,
} from "@openfront/engine-api/ww1936/ScenarioTypes";
import { SEA_ZONE_BASE } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { decodeRegions } from "./Regions";
import { weatherCell } from "./Weather";

/** A land edge between two regions (P2 spec §3.1). */
export interface Edge {
  a: number;
  b: number;
  /** 4-neighbour land tile pairs along it (0 across a strait). */
  border: number;
  km: number;
  /** 0 none, 1 small river, 2 big river. */
  river: 0 | 1 | 2;
  strait: 0 | 1;
}

/** One neighbour of a region: the region and the edge to it. */
export interface EdgeRef {
  to: number;
  edge: number;
}

/** v1/v2 `terrain` read as a P2 land terrain (plan decision 5). */
const TERRAIN_V1: Readonly<Record<string, LandTerrain>> = {
  plains: "plains",
  highland: "hills",
  mountain: "mountain",
};

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
  /** P2: the land graph, built on first use (static). */
  private landGraph: {
    edges: Edge[];
    byRegion: Map<number, EdgeRef[]>;
  } | null = null;
  /** P2: each region's land tiles (ensureRegionTiles; static). */
  private tileCsr: {
    offsets: Uint32Array;
    tiles: Uint32Array;
    bbox: Int32Array;
  } | null = null;
  /** The largest land region id. */
  private readonly maxId: number;

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
    this.maxId = maxId;
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

  // ---- P2: the land graph and the region tiles (P2 spec §3.3) ----

  /** The largest land region id: arrays indexed by region are this + 1 long. */
  maxRegionId(): number {
    return this.maxId;
  }

  edges(): readonly Edge[] {
    return this.graph().edges;
  }

  edge(i: number): Edge {
    return this.graph().edges[i];
  }

  /** (neighbour, edge index) of a region, neighbour ascending. */
  edgesOf(id: number): readonly EdgeRef[] {
    return this.graph().byRegion.get(id) ?? [];
  }

  /** The edge between two regions, or -1. */
  edgeBetween(a: number, b: number): number {
    for (const e of this.edgesOf(a)) if (e.to === b) return e.edge;
    return -1;
  }

  landOf(id: number): LandTerrain {
    const r = this.region(id);
    if (r === undefined) return "plains";
    return r.land ?? TERRAIN_V1[r.terrain] ?? "plains";
  }

  centerTile(id: number): number {
    const r = this.region(id)!;
    const [x, y] = r.center ?? r.vpTile;
    return y * this.width + x;
  }

  /** Hundredths of a degree; v2 fallback: equirectangular from the center row. */
  latC(id: number): number {
    const r = this.region(id)!;
    if (r.latC !== undefined) return r.latC;
    const y = (r.center ?? r.vpTile)[1];
    return Math.floor(9000 - (18000 * y) / this.height);
  }

  wcell(id: number): number {
    const r = this.region(id)!;
    if (r.wcell !== undefined) return r.wcell;
    const x = (r.center ?? r.vpTile)[0];
    const lonC = Math.floor((36000 * x) / this.width) - 18000;
    return weatherCell(lonC, this.latC(id));
  }

  /** P2 spec §3.2-6 fallback when scenario.json has no rail (v2). */
  startRail(id: number): number {
    const r = this.region(id)!;
    if (r.rail !== undefined) return r.rail;
    if (!r.core) return r.infra >= 4 ? 1 : 0;
    return COUNTRIES[r.owner].major
      ? Math.max(1, r.infra - 1)
      : Math.max(0, r.infra - 2);
  }

  startFort(id: number): number {
    return this.region(id)?.fort ?? 0;
  }

  isPort(id: number): boolean {
    const r = this.region(id);
    if (r === undefined) return false;
    return r.port ?? (r.coastal && (r.dock >= 1 || r.vp >= 5));
  }

  /** The country's industrialisation 1..5 (plan decision 14). */
  devOf(tag: CountryTag, civ: number): number {
    const c = this.data.countries.find((x) => x.tag === tag);
    if (c?.dev !== undefined) return c.dev;
    return civ >= 4 ? 3 : civ >= 1 ? 2 : 1;
  }

  /** Straight-line km between two region centers (plan decision 28). */
  regionKm(a: number, b: number): number {
    const ta = this.centerTile(a);
    const tb = this.centerTile(b);
    const dx = (ta % this.width) - (tb % this.width);
    const dy = Math.floor(ta / this.width) - Math.floor(tb / this.width);
    const scale = this.data.kmPerTile ?? 40075 / this.width;
    return Math.round(Math.sqrt(dx * dx + dy * dy) * scale);
  }

  /**
   * Builds the region tile lists once (P2 spec §3.3): one pass over the
   * map, land and passable tiles only, in tile order. The engine calls it
   * from WwLand's constructor; a screen calls it before regionTiles.
   */
  ensureRegionTiles(map: GameMap): void {
    if (this.tileCsr !== null) return;
    const n = this.maxId + 1;
    const ids = this.regionIds;
    const ok = (t: number) => {
      const id = ids[t];
      return (
        id !== 0 &&
        id < SEA_ZONE_BASE &&
        id <= this.maxId &&
        map.isLand(t) &&
        !map.isImpassable(t)
      );
    };
    const counts = new Uint32Array(n + 1);
    for (let t = 0; t < ids.length; t++) if (ok(t)) counts[ids[t] + 1]++;
    const offsets = new Uint32Array(n + 1);
    for (let i = 1; i <= n; i++) offsets[i] = offsets[i - 1] + counts[i];
    const tiles = new Uint32Array(offsets[n]);
    const fill = offsets.slice(0, n);
    const bbox = new Int32Array(n * 4).fill(-1);
    for (let t = 0; t < ids.length; t++) {
      if (!ok(t)) continue;
      const id = ids[t];
      tiles[fill[id]++] = t;
      const x = t % this.width;
      const y = Math.floor(t / this.width);
      const b = id * 4;
      if (bbox[b] < 0) {
        bbox[b] = x;
        bbox[b + 1] = y;
        bbox[b + 2] = x;
        bbox[b + 3] = y;
      } else {
        bbox[b] = Math.min(bbox[b], x);
        bbox[b + 1] = Math.min(bbox[b + 1], y);
        bbox[b + 2] = Math.max(bbox[b + 2], x);
        bbox[b + 3] = Math.max(bbox[b + 3], y);
      }
    }
    this.tileCsr = { offsets, tiles, bbox };
  }

  /** Land tiles of a region, ascending (a view: never write it). */
  regionTiles(id: number): Uint32Array {
    const c = this.tileCsr;
    if (c === null) throw new Error("scenario: ensureRegionTiles first");
    if (id < 1 || id > this.maxId) return new Uint32Array(0);
    return c.tiles.subarray(c.offsets[id], c.offsets[id + 1]);
  }

  /** [minX, minY, maxX, maxY] of a region's land tiles; all -1 when it has none. */
  bbox(id: number): readonly [number, number, number, number] {
    const c = this.tileCsr;
    if (c === null) throw new Error("scenario: ensureRegionTiles first");
    if (id < 1 || id > this.maxId) return [-1, -1, -1, -1];
    const b = id * 4;
    return [c.bbox[b], c.bbox[b + 1], c.bbox[b + 2], c.bbox[b + 3]];
  }

  private graph(): { edges: Edge[]; byRegion: Map<number, EdgeRef[]> } {
    if (this.landGraph !== null) return this.landGraph;
    let edges: Edge[];
    if (this.data.edges !== undefined) {
      edges = this.data.edges.map(([a, b, border, km, river, strait]) => ({
        a,
        b,
        border,
        km,
        river: river as 0 | 1 | 2,
        strait: strait as 0 | 1,
      }));
      for (let i = 0; i < edges.length; i++) {
        const e = edges[i];
        const prev = edges[i - 1];
        if (
          e.a >= e.b ||
          this.region(e.a) === undefined ||
          this.region(e.b) === undefined
        ) {
          throw new Error(`scenario: bad edge ${e.a}-${e.b}`);
        }
        if (
          prev !== undefined &&
          (prev.a > e.a || (prev.a === e.a && prev.b >= e.b))
        ) {
          throw new Error(`scenario: edges not sorted at ${e.a}-${e.b}`);
        }
      }
    } else {
      // v1/v2 (decision 5): the tile neighbours, km from the centers, no rivers.
      const border = this.borderCounts();
      edges = this.regionPairs().map(([a, b]) => ({
        a,
        b,
        border: border.get(a * 65536 + b) ?? 0,
        km: Math.max(1, this.regionKm(a, b)),
        river: 0,
        strait: 0,
      }));
    }
    const byRegion = new Map<number, EdgeRef[]>();
    const add = (from: number, to: number, edge: number) => {
      let l = byRegion.get(from);
      if (l === undefined) byRegion.set(from, (l = []));
      l.push({ to, edge });
    };
    edges.forEach((e, i) => {
      add(e.a, e.b, i);
      add(e.b, e.a, i);
    });
    for (const l of byRegion.values()) l.sort((x, y) => x.to - y.to);
    this.landGraph = { edges, byRegion };
    return this.landGraph;
  }

  /** 4-neighbour tile pairs of two different land regions (a < b), key a * 65536 + b. */
  private borderCounts(): Map<number, number> {
    const out = new Map<number, number>();
    const ids = this.regionIds;
    const w = this.width;
    const count = (p: number, q: number) => {
      if (p === q || p === 0 || q === 0) return;
      if (p >= SEA_ZONE_BASE || q >= SEA_ZONE_BASE) return;
      const a = Math.min(p, q);
      const b = Math.max(p, q);
      const k = a * 65536 + b;
      out.set(k, (out.get(k) ?? 0) + 1);
    };
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < w; x++) {
        const t = y * w + x;
        if (x + 1 < w) count(ids[t], ids[t + 1]);
        if (y + 1 < this.height) count(ids[t], ids[t + w]);
      }
    }
    return out;
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
