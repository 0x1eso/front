// Great War 1914 (ww172 phase 5, design ww168 B6 and 9A): land beyond the
// fronts. When a country is out of the war (beaten, collapsed, sued), or an
// enemy at war with it holds its capital, its enemies take its remaining
// places a group a chapter, from the groups they already hold, by adjacency
// on the map; a country with its capital back takes its own land back the
// same way. Islands and land over the water need the sea. The same reach
// decides what can be asked for at a table: a place one holds, or a place in
// a group next to one held whose owner is beaten.
//
// Region adjacency is derived from the map files the first time it is asked
// for and never stored. A map without the 1914 places has none: there nothing
// is occupied and the table's reach stays as it was.
import {
  GW_FRONT_START,
  GwSeatState,
  GwSide,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  GW_PLACE_KEYS,
  GW_PLACES,
  GwPlace,
} from "@openfront/engine-api/ww1914/GwPlaces";
import type { GwWorldCond } from "@openfront/engine-api/ww1914/WorldDsl";
import { frontPlaces } from "@openfront/engine-lib/ww1914/FrontLand";
import { GW_CAPITALS } from "@openfront/engine-lib/ww1914/PlaceRules";
import type { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import type { GreatWar } from "./GreatWar";
import { holderOf, moveLand } from "./Land";
import { atWarWith } from "./Wars";
import { fights, isLongChapter, monthsFrom, news, seatsOf } from "./World";

/** Tiles occupation may move in a chapter; the first group always goes. */
export const GW_OCC_TILES = 2500;
/** Groups away from the taker's own 1914 land it reaches by occupation. */
const OCC_HOPS = 2;
/** The sea line a side must hold for land over the water: `channel`. */
const SEA_CHANNEL = 2;

/** What the map says of the places: derived, never in a snapshot. */
export interface GwLandGraph {
  /** Group -> groups sharing a land border, sorted. */
  readonly near: ReadonlyMap<string, readonly string[]>;
  /** Group -> sea zones its places touch, sorted. */
  readonly sea: ReadonlyMap<string, readonly number[]>;
  /** Place -> its land tiles. */
  readonly tiles: ReadonlyMap<GwPlace, number>;
}

const EMPTY: GwLandGraph = {
  near: new Map(),
  sea: new Map(),
  tiles: new Map(),
};
const GRAPHS = new WeakMap<ScenarioIndex, GwLandGraph>();

const groupOf = (p: GwPlace) => GW_PLACES[p].group;

/** The places' land and sea neighbours, from the region files, once. */
export function landGraph(gw: GreatWar): GwLandGraph {
  if (gw.world.places.size === 0) return EMPTY;
  const known = GRAPHS.get(gw.scenario);
  if (known !== undefined) return known;
  const idx = gw.scenario;
  const placeOf = new Map<number, GwPlace>();
  for (const p of GW_PLACE_KEYS) {
    const id = gw.world.places.get(p);
    if (id !== undefined) placeOf.set(id, p);
  }
  const near = new Map<string, Set<string>>();
  const sea = new Map<string, Set<number>>();
  const add = <T>(m: Map<string, Set<T>>, k: string, v: T) => {
    let s = m.get(k);
    if (s === undefined) m.set(k, (s = new Set()));
    s.add(v);
  };
  for (const [id, p] of placeOf) {
    const g = groupOf(p);
    for (const n of idx.regionNeighbours(id)) {
      const q = placeOf.get(n);
      if (q !== undefined && groupOf(q) !== g) add(near, g, groupOf(q));
    }
    for (const z of idx.regionSeaZones(id)) add(sea, g, z);
  }
  const tilesById = new Map<number, number>();
  for (const r of idx.data.regions) tilesById.set(r.id, r.tiles);
  const tiles = new Map<GwPlace, number>();
  for (const [id, p] of placeOf) tiles.set(p, tilesById.get(id) ?? 0);
  const sorted = <T>(m: Map<string, Set<T>>, cmp: (a: T, b: T) => number) =>
    new Map(
      [...m]
        .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
        .map(([k, s]) => [k, [...s].sort(cmp)] as const),
    );
  const graph: GwLandGraph = {
    near: sorted(near, (a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    sea: sorted(sea, (a, b) => a - b),
    tiles,
  };
  GRAPHS.set(idx, graph);
  return graph;
}

/** Whether the map has the 1914 places: without them reach is not checked. */
export const hasLandGraph = (gw: GreatWar) => landGraph(gw).near.size > 0;

/** Groups where `tag` holds a place now (its own land included). */
function heldGroups(gw: GreatWar, tag: GwTag): Set<string> {
  const out = new Set<string>();
  for (const p of GW_PLACE_KEYS)
    if (holderOf(gw, p) === tag) out.add(groupOf(p));
  return out;
}

/**
 * The side that rules the narrow seas: the central powers with the sea line
 * at the Channel or beyond, the entente while Britain fights on its side and
 * the line is no further; null when nobody does.
 */
export function seaSide(gw: GreatWar): GwSide | null {
  const t = gw.s.theatres.find((x) => x.id === "sea");
  const line =
    t?.since === null || t === undefined ? GW_FRONT_START.sea : t.line;
  if (t?.since !== null && line >= SEA_CHANNEL) return "central";
  const gbr = gw.nation("GBR");
  if (gbr?.side === "entente" && fights(gbr) && line < SEA_CHANNEL) {
    return "entente";
  }
  return null;
}

/** Countries with a fleet that can carry an army over the water. */
const SEA_POWERS: readonly GwTag[] = [
  "GBR",
  "DEU",
  "FRA",
  "ITA",
  "RUS",
  "AUH",
  "USA",
  "JPN",
];

/**
 * Whether `tag` can carry an army over the water: a fleet of its own, and
 * its side rules the sea.
 */
export function hasSea(gw: GreatWar, tag: GwTag): boolean {
  const n = gw.nation(tag);
  if (n === null || !SEA_POWERS.includes(tag)) return false;
  if (n.side === null) return tag === "GBR";
  return seaSide(gw) === n.side;
}

/**
 * Whether `tag` reaches group `g` from what it holds: a land border with a
 * group it holds in, or a shared sea zone with one while it has the sea.
 * `held`: the groups it holds in, if already known.
 */
export function reachesGroup(
  gw: GreatWar,
  tag: GwTag,
  g: string,
  held: Set<string> = heldGroups(gw, tag),
): boolean {
  const graph = landGraph(gw);
  if (held.has(g)) return true;
  if ((graph.near.get(g) ?? []).some((x) => held.has(x))) return true;
  const zones = graph.sea.get(g) ?? [];
  if (zones.length === 0 || !hasSea(gw, tag)) return false;
  for (const h of held) {
    if ((graph.sea.get(h) ?? []).some((z) => zones.includes(z))) return true;
  }
  return false;
}

/**
 * 9A at a table: a place `by` holds, or one in a group next to what it holds
 * whose owner is `beaten`. True everywhere on a map without the places.
 */
export function canAskFor(
  gw: GreatWar,
  by: GwTag,
  place: GwPlace,
  beaten: (owner: GwTag) => boolean,
): boolean {
  if (holderOf(gw, place) === by) return true;
  if (!hasLandGraph(gw)) return true;
  if (!beaten(GW_PLACES[place].owner)) return false;
  return reachesGroup(gw, by, groupOf(place));
}

/** Months the holder has had the place; 0 for its owner's own or unknown. */
export function monthsHeld(gw: GreatWar, place: GwPlace): number {
  const since = gw.s.heldSince?.[place];
  return since === undefined ? 0 : Math.max(0, monthsFrom(gw, since));
}

// ---- Who is out ----

/** The chapter `tag` was knocked out of the war (Wars.leaveWar), or null. */
export function beatenAt(gw: GreatWar, tag: GwTag): number | null {
  return gw.s.beaten?.find((b) => b.tag === tag)?.chapter ?? null;
}

/** The capital of `tag` is in an enemy's hands: that enemy, or null. */
export function capitalHolder(gw: GreatWar, tag: GwTag): GwTag | null {
  const cap = GW_CAPITALS[tag];
  if (cap === undefined || !gw.world.places.has(cap)) return null;
  const h = holderOf(gw, cap);
  return h !== tag && atWarWith(gw, h, tag) ? h : null;
}

/**
 * Who takes `owner`'s land now: the enemies it fought to the end if it is
 * out, or its enemies while one of them holds its capital. Those still in
 * the game, the nations' order.
 */
function takersOf(gw: GreatWar, owner: GwTag): GwTag[] {
  const s = gw.s;
  const at = beatenAt(gw, owner);
  let foes: GwTag[] = [];
  if (at !== null && gw.nation(owner)?.out === true) {
    for (const w of s.wars) {
      if (w.ended !== at || (w.a !== owner && w.b !== owner)) continue;
      foes.push(w.a === owner ? w.b : w.a);
    }
  } else if (capitalHolder(gw, owner) !== null) {
    foes = [...(gw.nation(owner)?.atWar ?? [])];
  }
  return s.nations
    .filter((n) => !n.out && foes.includes(n.tag))
    .map((n) => n.tag);
}

/** Groups from the taker's own 1914 land, by land, up to OCC_HOPS. */
function hopsFrom(gw: GreatWar, tag: GwTag): Map<string, number> {
  const graph = landGraph(gw);
  const out = new Map<string, number>();
  let edge: string[] = [];
  for (const p of GW_PLACE_KEYS) {
    if (GW_PLACES[p].owner !== tag || out.has(groupOf(p))) continue;
    out.set(groupOf(p), 0);
    edge.push(groupOf(p));
  }
  for (let d = 1; d <= OCC_HOPS; d++) {
    const next: string[] = [];
    for (const g of edge) {
      for (const n of graph.near.get(g) ?? []) {
        if (out.has(n)) continue;
        out.set(n, d);
        next.push(n);
      }
    }
    edge = next;
  }
  return out;
}

/** Places of every theatre that has opened: the fronts move those. */
function frontLand(gw: GreatWar): Set<GwPlace> {
  const out = new Set<GwPlace>();
  for (const t of gw.s.theatres) {
    if (t.since === null) continue;
    for (const p of frontPlaces(t.id)) out.add(p);
  }
  return out;
}

interface Pick {
  to: GwTag;
  places: GwPlace[];
  tiles: number;
}

/** Places of `group` held by `from` that occupation may move. */
function movable(
  gw: GreatWar,
  group: string,
  owner: GwTag,
  from: GwTag,
  fronts: Set<GwPlace>,
): GwPlace[] {
  const settled = gw.s.settled ?? [];
  return GW_PLACE_KEYS.filter(
    (p) =>
      groupOf(p) === group &&
      GW_PLACES[p].owner === owner &&
      gw.world.places.has(p) &&
      holderOf(gw, p) === from &&
      !fronts.has(p) &&
      !settled.includes(p),
  );
}

/** `owner`'s groups, by name. */
function groupsOf(owner: GwTag): string[] {
  const out = new Set<string>();
  for (const p of GW_PLACE_KEYS) {
    if (GW_PLACES[p].owner === owner) out.add(groupOf(p));
  }
  return [...out].sort();
}

/**
 * The next group an enemy takes from `owner`: by land within OCC_HOPS of the
 * taker's own land, the nearest first, then by name; over the sea last.
 */
function nextTaken(
  gw: GreatWar,
  owner: GwTag,
  fronts: Set<GwPlace>,
): Pick | null {
  const graph = landGraph(gw);
  let best: (Pick & { hops: number; group: string }) | null = null;
  for (const to of takersOf(gw, owner)) {
    const held = heldGroups(gw, to);
    const hops = hopsFrom(gw, to);
    for (const group of groupsOf(owner)) {
      if (!reachesGroup(gw, to, group, held)) continue;
      const byLand = (graph.near.get(group) ?? []).some((x) => held.has(x));
      const h = hops.get(group);
      if (byLand && h === undefined) continue;
      const d = byLand ? h! : OCC_HOPS + 1;
      if (
        best !== null &&
        (best.hops < d || (best.hops === d && best.group <= group))
      ) {
        continue;
      }
      const places = movable(gw, group, owner, owner, fronts);
      if (places.length === 0) continue;
      const tiles = places.reduce((n, p) => n + (graph.tiles.get(p) ?? 0), 0);
      best = { to, places, tiles, hops: d, group };
    }
  }
  return best;
}

/** A country with its capital its own takes back its land from an enemy. */
function nextFreed(
  gw: GreatWar,
  owner: GwTag,
  fronts: Set<GwPlace>,
): Pick | null {
  const graph = landGraph(gw);
  const n = gw.nation(owner);
  if (n === null || n.out || n.atWar.length === 0) return null;
  if (beatenAt(gw, owner) !== null) return null;
  if (capitalHolder(gw, owner) !== null) return null;
  const held = heldGroups(gw, owner);
  for (const group of groupsOf(owner)) {
    if (!reachesGroup(gw, owner, group, held)) continue;
    for (const foe of n.atWar) {
      const places = movable(gw, group, owner, foe, fronts);
      if (places.length === 0) continue;
      const tiles = places.reduce((k, p) => k + (graph.tiles.get(p) ?? 0), 0);
      return { to: owner, places, tiles };
    }
  }
  return null;
}

/** A why-line on `tag`'s seats: {country} is `about`, {what} the place. */
export function landLine(
  gw: GreatWar,
  tag: GwTag,
  key: string,
  about: GwTag,
  place: GwPlace,
): void {
  const c = gw.s.chapter;
  for (const seat of seatsOf(gw, tag)) {
    const same = seat.log.some(
      (l) => l.key === key && l.chapter === c && l.what === place,
    );
    if (!same) seat.log.push({ key, chapter: c, tag: about, what: place });
  }
}

/**
 * Chapter step, after the fronts: each country under occupation loses a
 * group to an enemy, or takes one back; tiles budgeted so the map doesn't
 * churn. Never after the armistice (the table moves land then), never in a
 * crisis week.
 */
export function occupationStep(gw: GreatWar): void {
  const s = gw.s;
  if (s.armistice !== null || !isLongChapter(gw) || !hasLandGraph(gw)) return;
  const fronts = frontLand(gw);
  // One budget with the fronts' small moves this chapter (ww173 §5): what
  // they bit is spent already; the first group still always goes.
  const graph = landGraph(gw);
  let tiles = s.news
    .filter(
      (x) =>
        x.chapter === s.chapter &&
        x.place !== undefined &&
        (x.key === "front_salient" || x.key === "front_salient_back"),
    )
    .reduce((k, x) => k + (graph.tiles.get(x.place!) ?? 0), 0);
  let groups = 0;
  for (const n of [...s.nations]) {
    const owner = n.tag;
    const taken = nextTaken(gw, owner, fronts);
    const pick = taken ?? nextFreed(gw, owner, fronts);
    if (pick === null) continue;
    if (groups > 0 && tiles + pick.tiles > GW_OCC_TILES) continue;
    const from = holderOf(gw, pick.places[0]);
    for (const p of pick.places) moveLand(gw, p, pick.to, null, "occupation");
    tiles += pick.tiles;
    groups++;
    const first = pick.places[0];
    if (taken !== null) {
      news(gw, "land_occupied", pick.to, owner, null, first);
      landLine(gw, pick.to, "land_we_occupied", owner, first);
      landLine(gw, owner, "land_occupied_from_us", pick.to, first);
    } else {
      news(gw, "land_freed", owner, from, null, first);
      landLine(gw, owner, "land_we_freed", from, first);
      landLine(gw, from, "land_freed_from_us", owner, first);
    }
  }
}

// ---- Conditions for the scenes of occupation and the tables ----

/** `tag` fell out of the war in `chapter` while at war with `by`. */
function fellTo(gw: GreatWar, tag: GwTag, by: GwTag, chapter: number): boolean {
  return gw.s.wars.some(
    (w) =>
      w.how === "fell" &&
      w.ended === chapter &&
      ((w.a === tag && w.b === by) || (w.a === by && w.b === tag)),
  );
}

const inRange = (v: number, c: { min?: number; max?: number }) =>
  v >= (c.min ?? -Infinity) && v <= (c.max ?? Infinity);

export function landHolds(
  gw: GreatWar,
  seat: GwSeatState,
  c: Extract<
    GwWorldCond,
    { is: "land_taken" | "land_lost" | "beaten" | "pair_table" }
  >,
): boolean {
  const s = gw.s;
  switch (c.is) {
    case "land_taken":
    case "land_lost":
      return GW_PLACE_KEYS.some((p) => {
        const owner = GW_PLACES[p].owner;
        const holder = holderOf(gw, p);
        if (owner === holder) return false;
        if (c.capital === true && GW_CAPITALS[owner] !== p) return false;
        if (c.group !== undefined && !c.group.includes(groupOf(p))) {
          return false;
        }
        if (c.place !== undefined && !c.place.includes(p)) return false;
        if (c.is === "land_taken") {
          if (holder !== (c.tag ?? seat.tag)) return false;
          if (c.from !== undefined && owner !== c.from) return false;
        } else {
          if (owner !== seat.tag) return false;
          if (c.to !== undefined && holder !== c.to) return false;
        }
        return inRange(monthsHeld(gw, p), c);
      });
    case "beaten":
      return (s.beaten ?? []).some(
        (b) =>
          (c.tag === undefined || b.tag === c.tag) &&
          (c.by === undefined || fellTo(gw, b.tag, c.by, b.chapter)) &&
          inRange(monthsFrom(gw, b.chapter), c),
      );
    case "pair_table":
      return (s.pairTables ?? []).some((r) => {
        if (r.a !== seat.tag && r.b !== seat.tag) return false;
        const them = r.a === seat.tag ? r.b : r.a;
        if (c.with !== undefined && them !== c.with) return false;
        if (r.opened === null) return false;
        const open = r.signed === null;
        if (c.open !== undefined && c.open !== open) return false;
        const result =
          r.winner === null ? "even" : r.winner === seat.tag ? "won" : "lost";
        if (c.result !== undefined && !c.result.includes(result)) return false;
        return inRange(monthsFrom(gw, r.signed ?? r.chapter), c);
      });
  }
}
