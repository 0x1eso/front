import { GameMap, TileRef } from "@openfront/engine-api/game/GameMap";
import {
  COUNTRIES,
  COUNTRY_TAGS,
  CountryTag,
} from "@openfront/engine-api/ww1936/Countries";
import { CATEGORY_SLOTS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { LandTerrain } from "@openfront/engine-api/ww1936/LandTypes";
import { SEA_SR_BASE } from "@openfront/engine-api/ww1936/NavyTypes";
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

/** P4: one neighbour of a sea zone: the zone and the sea edge to it. */
export interface SeaEdgeRef {
  to: number;
  edge: number;
}

/** P4 spec §3.3: a sea edge; `strait` indexes the strait table, −1 for none. */
export interface SeaEdge {
  a: number;
  b: number;
  km: number;
  /** SEA_EDGE_KINDS index. */
  kind: number;
  strait: number;
}

/** P4 spec §3.4: a strategic region (an air zone; at sea a naval mission area). */
export interface StrategicRegion {
  id: number;
  /** Its place in strategicList (srIdx, plan decision 19). */
  idx: number;
  kind: "land" | "sea";
  name: string;
  nameKo: string;
  /** Tile. */
  center: number;
  latC: number;
  /** Land: region ids; sea: sea zone ids. Ascending. */
  members: readonly number[];
  /** Sea: max(3, water tiles / 1000) (spec §3.4); land: 0. */
  area: number;
}

/** P4 spec §12.1: starting air bases of the preserved and stamped islands. */
export const ISLAND_AIRBASE: Readonly<Record<string, number>> = {
  malta: 2,
  oahu: 4,
  singapore: 3,
  okinawa: 2,
  truk: 2,
  guam: 1,
  midway: 1,
  wake: 1,
  saipan: 1,
  palau: 1,
  kwajalein: 1,
  iwo_jima: 1,
  rhodes: 1,
  pantelleria: 1,
  azores: 1,
  bermuda: 1,
  canaries: 1,
};

interface SeaGraphData {
  /** Sea zones that are not lakes, ascending. */
  zones: number[];
  edges: SeaEdge[];
  byZone: Map<number, SeaEdgeRef[]>;
  straits: { id: string; kind: "strait" | "canal"; shore: number[] }[];
  /** Tile of each sea zone's center (v4 `center`, or the water tile nearest the centroid). */
  centers: Map<number, number>;
}

interface StrategicData {
  list: StrategicRegion[];
  byId: Map<number, StrategicRegion>;
  zoneSr: Map<number, number>;
  regionSr: Map<number, number>;
  seaCount: number;
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
  // P4 (plan decision 6): the v4 readers' tables, built on first use
  // (static, never in a snapshot; DERIVED_FIELDS).
  private seaGraphData: SeaGraphData | null = null;
  private strategicData: StrategicData | null = null;
  /** Harbor zone of each land region (index region id), and the start air bases. */
  private harborData: {
    harbor: Int32Array;
    airBase: Int8Array;
    aa: Int8Array;
  } | null = null;
  /** srKm by region × 2000 + strategic id. */
  private srKmMemo = new Map<number, number>();

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

  // ---- P4: the sea graph, strategic regions, harbors, bases (spec §3.3–§3.7) ----

  /** Sea zones that are not lakes, ascending. */
  navalZones(): readonly number[] {
    return this.seaGraph().zones;
  }

  isLake(zone: number): boolean {
    return this.seaZone(zone)?.lake === true;
  }

  /** (neighbour, sea edge) of a sea zone, neighbour ascending. */
  seaEdgesOf(zone: number): readonly SeaEdgeRef[] {
    return this.seaGraph().byZone.get(zone) ?? [];
  }

  seaEdge(i: number): SeaEdge {
    return this.seaGraph().edges[i];
  }

  seaEdgeCount(): number {
    return this.seaGraph().edges.length;
  }

  /** The strait or canal of sea edge `i`, null for open water and the date line. */
  straitOf(
    i: number,
  ): { id: string; kind: "strait" | "canal"; shore: readonly number[] } | null {
    const g = this.seaGraph();
    const e = g.edges[i];
    return e === undefined || e.strait < 0 ? null : g.straits[e.strait];
  }

  /** A sea zone's center tile (v4 `center`; else the water tile nearest the centroid). */
  zoneCenter(zone: number): number {
    return this.seaGraph().centers.get(zone) ?? 0;
  }

  /** Hundredths of a degree; fallback: equirectangular from the center row (as P2 latC). */
  zoneLatC(zone: number): number {
    const z = this.seaZone(zone);
    if (z?.latC !== undefined) return z.latC;
    const y = Math.floor(this.zoneCenter(zone) / this.width);
    return Math.floor(9000 - (18000 * y) / this.height);
  }

  zoneWcell(zone: number): number {
    const z = this.seaZone(zone);
    if (z?.wcell !== undefined) return z.wcell;
    const x = this.zoneCenter(zone) % this.width;
    const lonC = Math.floor((36000 * x) / this.width) - 18000;
    return weatherCell(lonC, this.zoneLatC(zone));
  }

  /** The sea strategic region of a zone; 0 for a lake or an unknown zone. */
  zoneSr(zone: number): number {
    if (this.isLake(zone)) return 0;
    const z = this.seaZone(zone);
    if (z?.sr !== undefined) return z.sr;
    return this.strategic().zoneSr.get(zone) ?? 0;
  }

  /** Spec §3.5: the harbor zone of a land region, 0 when it touches no sea. */
  harborOf(region: number): number {
    const r = this.region(region);
    if (r === undefined) return 0;
    if (r.harbor !== undefined) return r.harbor;
    return this.harbors().harbor[region] ?? 0;
  }

  /** The land strategic region of a region; 0 when unknown. */
  regionSr(region: number): number {
    const r = this.region(region);
    if (r === undefined) return 0;
    if (r.sr !== undefined) return r.sr;
    return this.strategic().regionSr.get(region) ?? 0;
  }

  /** Land ids ascending, then sea ids ascending (plan decision 19): srIdx order. */
  strategicList(): readonly StrategicRegion[] {
    return this.strategic().list;
  }

  sr(id: number): StrategicRegion | undefined {
    return this.strategic().byId.get(id);
  }

  /** The srIdx of a strategic region; −1 when unknown. */
  srIdxOf(id: number): number {
    return this.strategic().byId.get(id)?.idx ?? -1;
  }

  /** A sea zone → zoneSr, a land region → regionSr; 0 otherwise. */
  srOfZoneOrRegion(id: number): number {
    return id > SEA_ZONE_BASE ? this.zoneSr(id) : this.regionSr(id);
  }

  seaSrCount(): number {
    return this.strategic().seaCount;
  }

  /** Spec §6.4, §7.1: v4 navalBase; else a P2 port with a harbor: min(3, 1 + dockyards). */
  startNavalBase(region: number): number {
    const r = this.region(region);
    if (r === undefined) return 0;
    if (r.navalBase !== undefined) return r.navalBase;
    return this.isPort(region) && this.harborOf(region) !== 0
      ? Math.min(3, 1 + r.dock)
      : 0;
  }

  /** Spec §12.1: v4 airBase; else the capital / victory-point / island formula. */
  startAirBase(region: number): number {
    const r = this.region(region);
    if (r === undefined) return 0;
    if (r.airBase !== undefined) return r.airBase;
    return this.harbors().airBase[region] ?? 0;
  }

  /** Spec §12.1: v4 aa; else the capital / victory-point formula. */
  startAa(region: number): number {
    const r = this.region(region);
    if (r === undefined) return 0;
    if (r.aa !== undefined) return r.aa;
    return this.harbors().aa[region] ?? 0;
  }

  /** Spec §12.1: v4 coastalFort; else 0. */
  startCoastalFort(region: number): number {
    return this.region(region)?.coastalFort ?? 0;
  }

  /**
   * Plan decision 9: km between two tiles. With the v4 row table: the
   * row's east-west km a tile and 111.32 km a degree of latitude; without
   * it (v3, test maps): kmPerTile (default 40075 / width) both ways. The
   * east-west distance wraps at the date line, as the sea graph does.
   */
  kmBetween(a: number, b: number): number {
    const W = this.width;
    const xa = a % W;
    const ya = Math.floor(a / W);
    const xb = b % W;
    const yb = Math.floor(b / W);
    const adx = Math.abs(xa - xb);
    const dxTiles = Math.min(adx, W - adx);
    const rows = this.data.rows;
    let dx: number;
    let dy: number;
    if (rows !== undefined) {
      dx = (dxTiles * rows.kmxMilli[(ya + yb) >> 1]) / 1000;
      dy = (Math.abs(rows.latC[ya] - rows.latC[yb]) * 11132) / 10000;
    } else {
      const scale = this.data.kmPerTile ?? 40075 / W;
      dx = dxTiles * scale;
      dy = Math.abs(ya - yb) * scale;
    }
    return Math.round(Math.sqrt(dx * dx + dy * dy));
  }

  /** Spec §3.7: km from a region's center to a strategic region's center (memoised). */
  srKm(region: number, sr: number): number {
    const key = region * 2000 + sr;
    let km = this.srKmMemo.get(key);
    if (km === undefined) {
      const s = this.sr(sr);
      km =
        s === undefined || this.region(region) === undefined
          ? 0
          : this.kmBetween(this.centerTile(region), s.center);
      this.srKmMemo.set(key, km);
    }
    return km;
  }

  private seaGraph(): SeaGraphData {
    if (this.seaGraphData !== null) return this.seaGraphData;
    const zones = this.data.seaZones
      .filter((z) => z.lake !== true)
      .map((z) => z.id)
      .sort((a, b) => a - b);
    const straits = (this.data.straits ?? []).map((s) => ({
      id: s.id,
      kind: s.kind,
      shore: [...s.shore],
      a: s.a,
      b: s.b,
    }));
    const centers = this.zoneCenters();
    let raw: (readonly [number, number, number, number])[];
    if (this.data.seaEdges !== undefined) {
      raw = this.data.seaEdges.map((e) => [e[0], e[1], e[2], e[3]] as const);
    } else {
      // v1/v2 (spec §3.6): zones meeting over 3 or more tile pairs, km between the centers.
      raw = [...this.zonePairs()]
        .filter(([, n]) => n >= 3)
        .map(([k]) => {
          const a = Math.floor(k / 65536);
          const b = k % 65536;
          const km = Math.max(
            1,
            this.kmBetween(centers.get(a) ?? 0, centers.get(b) ?? 0),
          );
          return [a, b, km, 0] as const;
        });
    }
    const edges: SeaEdge[] = raw.map(([a, b, km, kind]) => ({
      a,
      b,
      km,
      kind,
      strait:
        kind === 1 || kind === 2
          ? straits.findIndex(
              (s) => (s.a === a && s.b === b) || (s.a === b && s.b === a),
            )
          : -1,
    }));
    const byZone = new Map<number, SeaEdgeRef[]>();
    const add = (from: number, to: number, edge: number) => {
      let l = byZone.get(from);
      if (l === undefined) byZone.set(from, (l = []));
      l.push({ to, edge });
    };
    edges.forEach((e, i) => {
      add(e.a, e.b, i);
      add(e.b, e.a, i);
    });
    for (const l of byZone.values())
      l.sort((x, y) => x.to - y.to || x.edge - y.edge);
    this.seaGraphData = {
      zones,
      edges,
      byZone,
      straits: straits.map((s) => ({ id: s.id, kind: s.kind, shore: s.shore })),
      centers,
    };
    return this.seaGraphData;
  }

  /** Sea zone → center tile: v4 `center`, else the water tile nearest the centroid (ties: smaller tile). */
  private zoneCenters(): Map<number, number> {
    const out = new Map<number, number>();
    const missing = new Set<number>();
    for (const z of this.data.seaZones) {
      if (z.center !== undefined) {
        out.set(z.id, z.center[1] * this.width + z.center[0]);
      } else {
        missing.add(z.id);
      }
    }
    if (missing.size === 0) return out;
    const ids = this.regionIds;
    const W = this.width;
    const sx = new Map<number, number>();
    const sy = new Map<number, number>();
    const n = new Map<number, number>();
    for (let t = 0; t < ids.length; t++) {
      const z = ids[t];
      if (!missing.has(z)) continue;
      sx.set(z, (sx.get(z) ?? 0) + (t % W));
      sy.set(z, (sy.get(z) ?? 0) + Math.floor(t / W));
      n.set(z, (n.get(z) ?? 0) + 1);
    }
    const best = new Map<number, [number, number]>();
    for (let t = 0; t < ids.length; t++) {
      const z = ids[t];
      const k = n.get(z);
      if (k === undefined) continue;
      // Squared distance to the centroid (IEEE doubles: the same everywhere).
      const dx = (t % W) - sx.get(z)! / k;
      const dy = Math.floor(t / W) - sy.get(z)! / k;
      const d = dx * dx + dy * dy;
      const b = best.get(z);
      if (b === undefined || d < b[1]) best.set(z, [t, d]);
    }
    for (const [z, [t]] of best) out.set(z, t);
    return out;
  }

  /** 4-neighbour tile pairs of two different sea zones (a < b), key a * 65536 + b, ascending. */
  private zonePairs(): Map<number, number> {
    const out = new Map<number, number>();
    const ids = this.regionIds;
    const w = this.width;
    const count = (p: number, q: number) => {
      if (p === q || p <= SEA_ZONE_BASE || q <= SEA_ZONE_BASE) return;
      if (this.isLake(p) || this.isLake(q)) return;
      const k = Math.min(p, q) * 65536 + Math.max(p, q);
      out.set(k, (out.get(k) ?? 0) + 1);
    };
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < w; x++) {
        const t = y * w + x;
        if (x + 1 < w) count(ids[t], ids[t + 1]);
        if (y + 1 < this.height) count(ids[t], ids[t + w]);
      }
    }
    return new Map([...out].sort((x, y) => x[0] - y[0]));
  }

  private strategic(): StrategicData {
    if (this.strategicData !== null) return this.strategicData;
    const list = this.buildStrategic();
    const byId = new Map<number, StrategicRegion>();
    const zoneSr = new Map<number, number>();
    const regionSr = new Map<number, number>();
    let seaCount = 0;
    for (const s of list) {
      byId.set(s.id, s);
      if (s.kind === "sea") {
        seaCount++;
        for (const z of s.members) zoneSr.set(z, s.id);
      } else {
        for (const r of s.members) regionSr.set(r, s.id);
      }
    }
    this.strategicData = { list, byId, zoneSr, regionSr, seaCount };
    return this.strategicData;
  }

  private buildStrategic(): StrategicRegion[] {
    if (this.data.strategic !== undefined) {
      return this.data.strategic
        .slice()
        .sort((a, b) =>
          a.kind === b.kind ? a.id - b.id : a.kind === "land" ? -1 : 1,
        )
        .map((s, idx) => ({
          id: s.id,
          idx,
          kind: s.kind,
          name: s.name,
          nameKo: s.nameKo,
          center: s.center[1] * this.width + s.center[0],
          latC: s.latC,
          members: s.members,
          area: s.kind === "sea" ? this.seaArea(s.members) : 0,
        }));
    }
    // Plan decision 6 fallback: land = (1936 owner, landmass without strait
    // edges), sea = each non-lake zone.
    const out: StrategicRegion[] = [];
    const seen = new Set<number>();
    const owners = this.ownerByRegion();
    for (const r of this.landRegions) {
      if (seen.has(r.id)) continue;
      const members: number[] = [];
      const stack = [r.id];
      seen.add(r.id);
      while (stack.length > 0) {
        const id = stack.pop()!;
        members.push(id);
        for (const e of this.edgesOf(id)) {
          const edge = this.edge(e.edge);
          if (
            edge.strait === 1 ||
            seen.has(e.to) ||
            owners[e.to] !== owners[r.id]
          ) {
            continue;
          }
          seen.add(e.to);
          stack.push(e.to);
        }
      }
      members.sort((a, b) => a - b);
      const first = this.region(members[0])!;
      out.push({
        id: out.length + 1,
        idx: out.length,
        kind: "land",
        name: first.name,
        nameKo: first.nameKo,
        center: this.centerTile(members[0]),
        latC: this.latC(members[0]),
        members,
        area: 0,
      });
    }
    const landCount = out.length;
    for (const z of this.navalZones()) {
      const sz = this.seaZone(z)!;
      out.push({
        id: SEA_SR_BASE + 1 + (out.length - landCount),
        idx: out.length,
        kind: "sea",
        name: sz.name,
        nameKo: sz.nameKo,
        center: this.zoneCenter(z),
        latC: this.zoneLatC(z),
        members: [z],
        area: this.seaArea([z]),
      });
    }
    return out;
  }

  /** Spec §3.4: max(3, water tiles / 1000). */
  private seaArea(zones: readonly number[]): number {
    let tiles = 0;
    for (const z of zones) tiles += this.seaZone(z)?.tiles ?? 0;
    return Math.max(3, Math.floor(tiles / 1000));
  }

  /** The v3 fallbacks of harborOf, startAirBase and startAa, one pass. */
  private harbors(): { harbor: Int32Array; airBase: Int8Array; aa: Int8Array } {
    if (this.harborData !== null) return this.harborData;
    const n = this.maxId + 1;
    const harbor = new Int32Array(n);
    // Spec §3.5: the zone with the most 4-neighbour tile pairs (ties: smaller id), lakes never.
    const counts = new Map<number, Map<number, number>>();
    const ids = this.regionIds;
    const W = this.width;
    const H = this.height;
    const note = (r: number, z: number) => {
      if (z <= SEA_ZONE_BASE || this.isLake(z)) return;
      let m = counts.get(r);
      if (m === undefined) counts.set(r, (m = new Map()));
      m.set(z, (m.get(z) ?? 0) + 1);
    };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = y * W + x;
        const r = ids[t];
        if (r === 0 || r >= SEA_ZONE_BASE || r > this.maxId) continue;
        if (x > 0) note(r, ids[t - 1]);
        if (x + 1 < W) note(r, ids[t + 1]);
        if (y > 0) note(r, ids[t - W]);
        if (y + 1 < H) note(r, ids[t + W]);
      }
    }
    for (const [r, m] of counts) {
      let best = 0;
      let bestN = 0;
      for (const [z, k] of m) {
        if (k > bestN || (k === bestN && z < best)) {
          best = z;
          bestN = k;
        }
      }
      harbor[r] = best;
    }
    // Spec §12.1 start air bases and anti-air.
    const airBase = new Int8Array(n);
    const aa = new Int8Array(n);
    const civ = new Map<CountryTag, number>();
    for (const r of this.landRegions) {
      civ.set(r.owner, (civ.get(r.owner) ?? 0) + r.civ);
    }
    for (const r of this.landRegions) {
      const major = COUNTRIES[r.owner].major;
      const dev = this.devOf(r.owner, civ.get(r.owner) ?? 0);
      const capital = this.capitalRegionOf(r.owner) === r.id;
      const island =
        r.island === undefined ? undefined : ISLAND_AIRBASE[r.island];
      if (island !== undefined) airBase[r.id] = island;
      else if (major)
        airBase[r.id] = capital ? 5 : r.vp >= 10 ? 3 : r.vp >= 5 ? 1 : 0;
      else airBase[r.id] = capital ? (dev >= 3 ? 3 : 1) : r.vp >= 10 ? 1 : 0;
      if (major) aa[r.id] = capital ? 3 : r.vp >= 10 ? 1 : 0;
      else aa[r.id] = capital && dev >= 3 ? 1 : 0;
    }
    this.harborData = { harbor, airBase, aa };
    return this.harborData;
  }

  /** The region holding a country's capital tile. */
  private capitalRegionOf(tag: CountryTag): number {
    return this.regionAt(this.capitalTile(tag));
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
