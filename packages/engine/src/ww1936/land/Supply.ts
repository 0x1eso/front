// World War 1936 P2: supply hubs, the side's supply and encirclement (P2
// spec §11). Once a day on the side's turn (its smallest member's tick).
//
// Cost (pre-flight S1): each hub runs one bounded Dijkstra on the
// engine-lib RegionHeap. A hub's run is kept between days and run again
// only when its capacity changed or a region it read changed hands, rail
// or infrastructure. A run reads nothing else (the graph and the terrain
// are static), so a kept run equals a new one: the cache never changes a
// number. A side none of whose regions changed hands, rail,
// infrastructure or built hub, and whose members' capitals are the same,
// keeps its hubs, its reach and every region's best hub share too (P2
// Task 11): they read nothing else. It lives beside the land (a WeakMap,
// not a field): a restored game builds its own on its first day and gets
// the same values.
import {
  MOVE_NONE,
  TPL_LOGISTICS,
  traitBit,
  WW_SUPPLY_RANGE,
} from "@openfront/engine-api/ww1936/LandTypes";
import { RegionHeap } from "@openfront/engine-lib/ww1936/RegionHeap";
import {
  HUB_BUILT,
  HUB_CAPITAL,
  HUB_CITY,
  HUB_CITY_VP,
  HUB_SEA,
  hubCapacityMilli,
  localSupplyMilli,
  regionSupplyMilli,
  supplyEdgeCost,
  supplyFrom,
  supplyRatePm,
  supplyUseMilli,
} from "@openfront/engine-lib/ww1936/SupplyRules";
import { navalPort } from "../navy/Ports";
import { generalOf } from "./GeneralsRun";
import { capitalRegion } from "./LandStartRun";
import type { WwLand } from "./WwLand";

/** A live hub of a side (spec §11.1). */
export interface SupplyHub {
  region: number;
  /** HUB_CAPITAL, HUB_CITY, HUB_BUILT or HUB_SEA. */
  kind: number;
  /** Supply milli a day. */
  cap: number;
}

/** One hub's bounded Dijkstra: what it gives where, and every region it read. */
interface HubRun {
  cap: number;
  /** Regions it reaches with something to give, and how much (milli). */
  regions: number[];
  values: number[];
  /** Regions whose control, rail or infrastructure the run read. */
  touched: number[];
}

/** A side's inputs at its last day, its hubs' runs by region, and what they gave. */
interface SideCache {
  members: number[];
  ours: Uint8Array;
  rail: Uint8Array;
  infra: Uint8Array;
  hub: Uint8Array;
  /** capitalRegion of each member. */
  capitals: number[];
  runs: Map<number, HubRun>;
  /** False until the first day filled `reached` and `best`. */
  warm: boolean;
  /** 1: some hub of the side reaches the region over the side's regions. */
  reached: Uint8Array;
  /** The best hub share of each side region, milli. */
  best: Int32Array;
  /** P4: the hub region the best share comes from (ties: the smaller), 0 none. */
  bestHub: Int32Array;
  /** P4: 1 where the region's hub capacity is its sea hub's (pre-flight A16). */
  seaHub: Uint8Array;
  /**
   * P4 (pre-flight §0-4): each region's sea-hub capacity at the last day
   * (lane C's convoys and blockades, a beachhead): a change re-runs that hub.
   */
  seaCap: Int32Array;
  /** memberMask of `members`. */
  member: Uint8Array;
  /** sideRegions at WwLand.controlChanges / derivedEpoch `changes` / `epoch` (-1: none yet). */
  changes: number;
  epoch: number;
  regionsView: { ours: Uint8Array; regions: number[] } | null;
}

/** Scratch arrays (stamped, never cleared) and the side caches of one land. */
interface SupplyState {
  sides: Map<number, SideCache>;
  heap: RegionHeap;
  dist: Int32Array;
  seen: Int32Array;
  done: Int32Array;
  changed: Int32Array;
  use: Int32Array;
  stamp: number;
}

const states = new WeakMap<WwLand, SupplyState>();

function stateOf(land: WwLand): SupplyState {
  let s = states.get(land);
  if (s === undefined) {
    const n = land.controller.length;
    s = {
      sides: new Map(),
      heap: new RegionHeap(),
      dist: new Int32Array(n),
      seen: new Int32Array(n),
      done: new Int32Array(n),
      changed: new Int32Array(n),
      use: new Int32Array(n),
      stamp: 0,
    };
    states.set(land, s);
  }
  return s;
}

/** The side's members as a mask by smallID. */
function memberMask(land: WwLand, members: readonly number[]): Uint8Array {
  const mask = new Uint8Array(land.countries().length + 1);
  for (const m of members) if (m < mask.length) mask[m] = 1;
  return mask;
}

/** The side's regions as a mask (1: a member controls it) and in id order. */
function sideRegions(
  land: WwLand,
  member: Uint8Array,
): { ours: Uint8Array; regions: number[] } {
  const ours = new Uint8Array(land.controller.length);
  for (const r of land.scenario.landRegions) {
    if (member[land.controller[r.id]] === 1) ours[r.id] = 1;
  }
  const regions: number[] = [];
  for (let r = 1; r < ours.length; r++) if (ours[r] === 1) regions.push(r);
  return { ours, regions };
}

/**
 * Spec §11.1: the side's live hubs in region order (a port can also be a
 * land hub). Capitals always; cities (vp ≥ 10) and built hubs only while
 * a railway through the side's regions joins them to a capital; every
 * port of the side.
 */
export function liveHubs(land: WwLand, side: number): SupplyHub[] {
  const members = land.sideMembers(side);
  const { ours, regions } = sideRegions(land, memberMask(land, members));
  return hubsOf(land, members, ours, regions, seaCapsOf(land, side, ours));
}

/**
 * P4: the sea-hub capacity of each side region, milli (pre-flight §0-4): a
 * working port's from the hooks (lane C: convoys, the route's enemy
 * supremacy), a beachhead's (lane I); 0 for any other region.
 */
function seaCapsOf(land: WwLand, side: number, ours: Uint8Array): Int32Array {
  const caps = new Int32Array(ours.length);
  for (let r = 1; r < ours.length; r++) {
    if (ours[r] === 1) caps[r] = seaCapOf(land, side, r);
  }
  return caps;
}

function seaCapOf(land: WwLand, side: number, r: number): number {
  return navalPort(land.ww, r)
    ? land.hooks.seaHubCapacity(r, side)
    : land.hooks.beachheadCapacity(r, side);
}

function hubsOf(
  land: WwLand,
  members: readonly number[],
  ours: Uint8Array,
  regions: readonly number[],
  seaCaps: Int32Array,
  capitals: readonly number[] = members.map((m) => capitalRegion(land, m)),
): SupplyHub[] {
  const sc = land.scenario;
  const rail = land.econ.rail;
  // The rail net from the capitals (spec §11.1).
  const isCapital = new Uint8Array(ours.length);
  const railNet = new Uint8Array(ours.length);
  const q: number[] = [];
  for (const c of capitals) {
    if (c === 0 || isCapital[c] === 1) continue;
    isCapital[c] = 1;
    railNet[c] = 1;
    q.push(c);
  }
  for (let i = 0; i < q.length; i++) {
    const u = q[i];
    if (rail[u] < 1) continue;
    for (const e of sc.edgesOf(u)) {
      if (railNet[e.to] === 0 && ours[e.to] === 1 && rail[e.to] >= 1) {
        railNet[e.to] = 1;
        q.push(e.to);
      }
    }
  }
  const hubs: SupplyHub[] = [];
  for (const r of regions) {
    const reg = sc.region(r)!;
    const kind =
      isCapital[r] === 1
        ? HUB_CAPITAL
        : railNet[r] === 1 && reg.vp >= HUB_CITY_VP
          ? HUB_CITY
          : railNet[r] === 1 && land.econ.hub[r] >= 1
            ? HUB_BUILT
            : -1;
    if (kind >= 0) {
      hubs.push({ region: r, kind, cap: hubCapacityMilli(kind, rail[r]) });
    }
    // P4 plan decision 11 and pre-flight §0-4: a working port (or a
    // beachhead) with its sea-hub capacity now.
    if (seaCaps[r] > 0) {
      hubs.push({ region: r, kind: HUB_SEA, cap: seaCaps[r] });
    }
  }
  return hubs;
}

/** Spec §11.2: one hub's bounded Dijkstra over the side's regions. */
function runHub(
  land: WwLand,
  st: SupplyState,
  ours: Uint8Array,
  hub: number,
  cap: number,
): HubRun {
  const sc = land.scenario;
  const rail = land.econ.rail;
  // P4 (pre-flight D): bombed infrastructure counts as the lower level.
  const infra = land.econ.infraEff;
  const range = WW_SUPPLY_RANGE * 100;
  const stamp = ++st.stamp;
  const { dist, seen, done, heap } = st;
  const run: HubRun = { cap, regions: [], values: [], touched: [hub] };
  seen[hub] = stamp;
  dist[hub] = 0;
  heap.clear();
  heap.push(0, hub);
  while (heap.size > 0) {
    const u = heap.pop();
    const du = heap.lastDist;
    if (done[u] === stamp || du !== dist[u]) continue;
    done[u] = stamp;
    const v = supplyFrom(cap, du);
    if (v > 0) {
      run.regions.push(u);
      run.values.push(v);
    }
    for (const e of sc.edgesOf(u)) {
      const to = e.to;
      if (done[to] === stamp) continue;
      if (seen[to] !== stamp) {
        seen[to] = stamp;
        // At the range a hub gives nothing (supplyFrom is 0): never pushed.
        dist[to] = range;
        run.touched.push(to);
      }
      if (ours[to] === 0) continue;
      const nd =
        du +
        supplyEdgeCost(
          sc.edge(e.edge).km,
          rail[u],
          rail[to],
          sc.landOf(to),
          infra[to],
        );
      if (nd < dist[to]) {
        dist[to] = nd;
        heap.push(nd, to);
      }
    }
  }
  return run;
}

/**
 * Spec §11.2–§11.5: once a day on the side's turn, `supplyMilli`,
 * `useMilli` and `encircled` of the side's regions and its divisions'
 * supply rates and encirclement flags.
 */
export function dailySupply(land: WwLand, side: number): void {
  const sc = land.scenario;
  const st = stateOf(land);
  const members = land.sideMembers(side);
  const cache = sideCache(land, st, side, members, land.controller.length);
  // The side's regions read only the controllers (setController counts
  // every change in controlChanges).
  if (
    cache.regionsView === null ||
    cache.changes !== land.controlChanges ||
    cache.epoch !== land.derivedEpoch
  ) {
    cache.regionsView = sideRegions(land, cache.member);
    cache.changes = land.controlChanges;
    cache.epoch = land.derivedEpoch;
  }
  const { ours, regions } = cache.regionsView;
  const day = land.day();
  // What the hubs, the reach and the runs read: the side's regions, their
  // rail, infrastructure and built hubs, the members' capitals.
  const rail = land.econ.rail;
  const infra = land.econ.infraEff;
  const hub = land.econ.hub;
  const mark = ++st.stamp;
  let anyChange = false;
  let hubChange = false;
  for (let r = 1; r < ours.length; r++) {
    // P4 (pre-flight §0-4): a sea hub's capacity (convoys, blockades,
    // the naval base working) re-runs that hub.
    const sea = ours[r] === 1 ? seaCapOf(land, side, r) : 0;
    if (cache.seaCap[r] !== sea) {
      cache.seaCap[r] = sea;
      hubChange = true;
    }
    if (
      cache.ours[r] !== ours[r] ||
      cache.rail[r] !== rail[r] ||
      cache.infra[r] !== infra[r]
    ) {
      st.changed[r] = mark;
      cache.ours[r] = ours[r];
      cache.rail[r] = rail[r];
      cache.infra[r] = infra[r];
      anyChange = true;
    }
    if (cache.hub[r] !== hub[r]) {
      cache.hub[r] = hub[r];
      hubChange = true;
    }
  }
  const capitals = members.map((m) => capitalRegion(land, m));
  if (
    capitals.length !== cache.capitals.length ||
    capitals.some((c, i) => c !== cache.capitals[i])
  ) {
    cache.capitals = capitals;
    hubChange = true;
  }
  if (anyChange || hubChange || !cache.warm) {
    warmSide(
      land,
      st,
      cache,
      members,
      ours,
      regions,
      capitals,
      anyChange,
      mark,
    );
  }
  const reached = cache.reached;
  const best = cache.best;
  // 5. Region supply and encirclement.
  const owners = sc.ownerByRegion();
  for (const r of regions) {
    const cut = reached[r] === 0;
    let s = 0;
    if (!cut) {
      const core =
        sc.region(r)!.core && land.sameSide(owners[r], land.controller[r]);
      const w = land.weatherOn(r, day);
      s = regionSupplyMilli(best[r], localSupplyMilli(core, infra[r]), w);
    }
    // P4 spec §14.10: air supply, encircled regions too.
    s += land.hooks.airSupply(r, side);
    if (land.supplyMilli[r] !== s || land.encircled[r] !== (cut ? 1 : 0)) {
      land.supplyMilli[r] = s;
      land.encircled[r] = cut ? 1 : 0;
      land.markRegion(r);
    }
  }
  divisionRates(land, st, members, ours, reached, regions);
  // P4 (pre-flight A16): the use each sea hub feeds (its best share's regions).
  for (const r of regions) land.seaHubUse[r] = 0;
  for (const r of regions) {
    const h = cache.bestHub[r];
    if (reached[r] === 1 && h > 0 && cache.seaHub[h] === 1) {
      land.seaHubUse[h] += st.use[r];
    }
  }
}

/**
 * Spec §11.1–§11.5 steps 1–4 for a side whose inputs changed (or its first
 * day): the live hubs, one run per region at its largest capacity (a
 * larger capacity gives more at every distance), the reach (encirclement:
 * side regions no hub reaches at all) and each region's best hub share.
 */
function warmSide(
  land: WwLand,
  st: SupplyState,
  cache: SideCache,
  members: readonly number[],
  ours: Uint8Array,
  regions: readonly number[],
  capitals: readonly number[],
  anyChange: boolean,
  mark: number,
): void {
  const sc = land.scenario;
  const capAt = new Map<number, number>();
  const seaHub = cache.seaHub;
  seaHub.fill(0);
  for (const h of hubsOf(
    land,
    members,
    ours,
    regions,
    cache.seaCap,
    capitals,
  )) {
    const was = capAt.get(h.region) ?? 0;
    if (h.cap > was || !capAt.has(h.region)) {
      capAt.set(h.region, Math.max(was, h.cap));
      seaHub[h.region] = h.kind === HUB_SEA && h.cap > was ? 1 : 0;
    }
  }
  const reached = cache.reached;
  reached.fill(0);
  const bq: number[] = [];
  for (const r of capAt.keys()) {
    reached[r] = 1;
    bq.push(r);
  }
  for (let i = 0; i < bq.length; i++) {
    for (const e of sc.edgesOf(bq[i])) {
      if (reached[e.to] === 0 && ours[e.to] === 1) {
        reached[e.to] = 1;
        bq.push(e.to);
      }
    }
  }
  // The hubs' runs: kept unless a region one read changed (see the top).
  const runs = new Map<number, HubRun>();
  for (const [hub, cap] of capAt) {
    let run = cache.runs.get(hub);
    if (
      run === undefined ||
      run.cap !== cap ||
      (anyChange && run.touched.some((r) => st.changed[r] === mark))
    ) {
      run = runHub(land, st, ours, hub, cap);
    }
    runs.set(hub, run);
  }
  cache.runs = runs;
  // The best hub share of each region (a maximum: the run order is free)
  // and, P4, its hub (ties: the smaller hub region).
  const best = cache.best;
  const bestHub = cache.bestHub;
  best.fill(0);
  bestHub.fill(0);
  for (const [hub, run] of runs) {
    for (let i = 0; i < run.regions.length; i++) {
      const r = run.regions[i];
      const v = run.values[i];
      if (v > best[r] || (v === best[r] && v > 0 && hub < bestHub[r])) {
        best[r] = v;
        bestHub[r] = hub;
      }
    }
  }
  cache.warm = true;
}

function sideCache(
  land: WwLand,
  st: SupplyState,
  side: number,
  members: readonly number[],
  size: number,
): SideCache {
  const c = st.sides.get(side);
  if (
    c !== undefined &&
    c.members.length === members.length &&
    c.members.every((m, i) => m === members[i])
  ) {
    return c;
  }
  // New, or the side changed (P3 factions): every run again.
  const fresh: SideCache = {
    members: [...members],
    ours: new Uint8Array(size),
    rail: new Uint8Array(size),
    infra: new Uint8Array(size),
    hub: new Uint8Array(size),
    capitals: [],
    runs: new Map(),
    warm: false,
    reached: new Uint8Array(size),
    best: new Int32Array(size),
    bestHub: new Int32Array(size),
    seaHub: new Uint8Array(size),
    seaCap: new Int32Array(size),
    member: memberMask(land, members),
    changes: -1,
    epoch: -1,
    regionsView: null,
  };
  st.sides.set(side, fresh);
  return fresh;
}

/**
 * Spec §11.3 and pre-flight S2: a region's use is the sum over the side's
 * divisions standing there (not moving); every division of the side in
 * that region gets its rate, 0 when encircled, and 0 in a region the side
 * does not hold. An army none of whose divisions was encircled and one of
 * which is now hears it once.
 */
function divisionRates(
  land: WwLand,
  st: SupplyState,
  members: readonly number[],
  ours: Uint8Array,
  reached: Uint8Array,
  regions: readonly number[],
): void {
  const t = land.divisions;
  const use = st.use;
  for (const r of regions) use[r] = 0;
  const logOf = new Map<number, { log: number; wizard: boolean }>();
  const wizard = traitBit("logistics_wizard");
  // The side's divisions, member by member (sums and sets: the order is free).
  const rows: number[] = [];
  for (const m of members) {
    const usePct = land.econ.country(m)?.stats.supplyUsePct ?? 0;
    for (const row of land.rowsOf(m)) {
      rows.push(row);
      const r = t.region[row];
      if (ours[r] === 0 || t.mode[row] !== MOVE_NONE) continue;
      let g = logOf.get(t.army[row]);
      if (g === undefined) {
        const army = land.armies.get(t.army[row]);
        const gen = army === undefined ? null : generalOf(land, army);
        g = {
          log: gen?.log ?? 0,
          wizard: gen !== null && (gen.traits & wizard) !== 0,
        };
        logOf.set(t.army[row], g);
      }
      use[r] += supplyUseMilli(
        land.supplyBaseOf(row),
        g.log,
        (land.flagsOf(row) & TPL_LOGISTICS) !== 0,
        g.wizard,
        usePct,
      );
    }
  }
  for (const r of regions) {
    if (land.useMilli[r] !== use[r]) {
      land.useMilli[r] = use[r];
      land.markRegion(r);
    }
  }
  // Armies: was any division encircled before; did one become so today.
  const before = new Set<number>();
  const newly = new Set<number>();
  for (const row of rows) {
    const owner = t.owner[row];
    const r = t.region[row];
    const held = ours[r] === 1;
    const cut = held && reached[r] === 0;
    const rate = !held || cut ? 0 : supplyRatePm(land.supplyMilli[r], use[r]);
    const enc = cut ? 1 : 0;
    const army = t.army[row];
    if (t.encircled[row] === 1) before.add(army);
    else if (enc === 1) newly.add(army);
    if (t.supply[row] !== rate || t.encircled[row] !== enc) {
      if (t.encircled[row] !== enc) land.markCountry(owner);
      t.supply[row] = rate;
      t.encircled[row] = enc;
      land.markArmy(army);
    }
  }
  for (const id of [...newly].sort((a, b) => a - b)) {
    if (before.has(id)) continue;
    const a = land.armies.get(id);
    if (a === undefined) continue;
    land.message(a.owner, "events_display.ww1936_encircled", {
      army: a.nameNo,
    });
  }
}
