// Great War 1914 (ww172 phase 5, design ww168 B6 and 9A; ww179 reach):
// land beyond the fronts. An enemy at war with a country takes its places a
// group a chapter, from the groups it already holds, by adjacency on the
// map, once nothing defends them against it: the country is out of the war
// (beaten, collapsed, sued), an enemy holds its capital, or every front it
// stood on against that enemy's side has been won through to its last line,
// so the front runs on into the interior. Land over the water needs a fleet
// whose side rules the sea; a colony or island cut off from home falls to it
// once no front of its own holds there. A country that stands again takes
// its land back the same way. The table asks within the old reach: a place
// one holds, or one in a group next to it whose owner is beaten.
//
// Region adjacency is derived from the map files the first time it is asked
// for and never stored: each place's cell is its region and the nearest
// regions of its own country that are no place, so the interior links up.
// A map without the 1914 places has none: there nothing is occupied and the
// table's reach stays as it was.
import {
  GW_FRONT_START,
  GW_LINE_STEP,
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
import {
  frontLandAt,
  frontPlaces,
} from "@openfront/engine-lib/ww1914/FrontLand";
import { GW_CAPITALS } from "@openfront/engine-lib/ww1914/PlaceRules";
import type { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { detachedRegions, placeCells } from "./Cells";
import { posOf } from "./Eras";
import type { GreatWar } from "./GreatWar";
import {
  farPos,
  holderOf,
  lineStep,
  moveLand,
  ranOn,
  reachedLine,
} from "./Land";
import { atWarWith, memberEnd, sideIn } from "./Wars";
import {
  fights,
  isLongChapter,
  monthsFrom,
  news,
  other,
  seatsOf,
} from "./World";

/**
 * Places occupation may move in a chapter, with the fronts' small bites
 * (ww179: counted in places, since a place carries its whole cell); the
 * first group always goes.
 */
export const GW_OCC_PLACES = 8;
/** Rank of a group reached only over the water: after every land route. */
const BY_SEA = 1_000_000;
/** The sea line a side must hold for land over the water: `channel`. */
const SEA_CHANNEL = 2;

/** What the map says of the places: derived, never in a snapshot. */
export interface GwLandGraph {
  /** Group -> groups sharing a land border, sorted. */
  readonly near: ReadonlyMap<string, readonly string[]>;
  /** Group -> sea zones its places touch, sorted. */
  readonly sea: ReadonlyMap<string, readonly number[]>;
  /** Place -> the land tiles of its cell. */
  readonly tiles: ReadonlyMap<GwPlace, number>;
  /** Group -> the open seas its cells' coasts reach (ww179), sorted. */
  readonly oceans: ReadonlyMap<string, readonly number[]>;
  /** Places joined by land to their owner's capital through its own land. */
  readonly home: ReadonlySet<GwPlace>;
}

const EMPTY: GwLandGraph = {
  near: new Map(),
  sea: new Map(),
  tiles: new Map(),
  oceans: new Map(),
  home: new Set(),
};
const GRAPHS = new WeakMap<ScenarioIndex, GwLandGraph>();

const groupOf = (p: GwPlace) => GW_PLACES[p].group;

/** Sea zone -> the lowest zone of the waters it joins (seas by their edges). */
function seaRoots(idx: ScenarioIndex): Map<number, number> {
  const up = new Map<number, number>();
  const find = (z: number): number => {
    let r = z;
    while ((up.get(r) ?? r) !== r) r = up.get(r)!;
    up.set(z, r);
    return r;
  };
  for (const z of idx.data.seaZones) up.set(z.id, z.id);
  for (const e of idx.data.seaEdges ?? []) {
    const a = find(e[0]);
    const b = find(e[1]);
    if (a !== b) up.set(Math.max(a, b), Math.min(a, b));
  }
  const out = new Map<number, number>();
  for (const z of idx.data.seaZones) out.set(z.id, find(z.id));
  return out;
}

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
  const oceans = new Map<string, Set<number>>();
  const add = <T>(m: Map<string, Set<T>>, k: string, v: T) => {
    let s = m.get(k);
    if (s === undefined) m.set(k, (s = new Set()));
    s.add(v);
  };
  // Each place's cell (ww179, Cells.ts): its region and its country's
  // nearest regions that are no place.
  const cell = new Map<number, GwPlace>();
  for (const [p, ids] of placeCells(gw)) for (const id of ids) cell.set(id, p);
  const placeNear = new Map<GwPlace, Set<GwPlace>>();
  const zoneRoot = seaRoots(idx);
  const detached = detachedRegions(gw);
  for (const [id, p] of cell) {
    const g = groupOf(p);
    for (const n of idx.regionNeighbours(id)) {
      const q = cell.get(n);
      if (q === undefined || q === p) continue;
      if (detached.has(id) || detached.has(n)) continue;
      let s = placeNear.get(p);
      if (s === undefined) placeNear.set(p, (s = new Set()));
      s.add(q);
      if (groupOf(q) !== g) add(near, g, groupOf(q));
    }
    for (const z of idx.regionSeaZones(id)) {
      if (placeOf.has(id)) add(sea, g, z);
      add(oceans, g, zoneRoot.get(z) ?? z);
    }
  }
  const home = new Set<GwPlace>();
  for (const [tag, cap] of Object.entries(GW_CAPITALS)) {
    if (cap === undefined || !gw.world.places.has(cap)) continue;
    const q = [cap];
    home.add(cap);
    while (q.length > 0) {
      for (const n of placeNear.get(q.pop()!) ?? []) {
        if (GW_PLACES[n].owner !== tag || home.has(n)) continue;
        home.add(n);
        q.push(n);
      }
    }
  }
  for (const p of placeOf.values()) {
    if (GW_CAPITALS[GW_PLACES[p].owner] === undefined) home.add(p);
  }
  const tilesById = new Map<number, number>();
  for (const r of idx.data.regions) tilesById.set(r.id, r.tiles);
  const tiles = new Map<GwPlace, number>();
  for (const [p, ids] of placeCells(gw)) {
    tiles.set(
      p,
      ids.reduce((k, id) => k + (tilesById.get(id) ?? 0), 0),
    );
  }
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
    oceans: sorted(oceans, (a, b) => a - b),
    home,
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

// ---- Who still stands (ww179) ----

/**
 * Whether `owner` still has an army in the way of `foe`: on an open front it
 * fights on, whose other end can still go forward, and has not yet reached
 * its last line. Fronts where it faces `foe`'s side decide; with none, any
 * front it holds does (a country with no front left is open to all). Where
 * the other end could never go forward (its line starts at its last), the
 * front holds nothing of the owner's and is left out.
 */
export function standsAgainst(gw: GreatWar, owner: GwTag, foe: GwTag): boolean {
  let faced = false;
  let field = false;
  for (const t of gw.s.theatres) {
    if (t.since === null || !t.open) continue;
    const end = memberEnd(gw, t.id, owner);
    if (end === null) continue;
    const far = farPos(t.id, other(end));
    if (far === GW_FRONT_START[t.id] * GW_LINE_STEP) continue;
    const holding = posOf(t) !== far;
    if (holding) field = true;
    if (sideIn(gw, t.id, foe) !== other(end)) continue;
    if (holding) return true;
    faced = true;
  }
  return !faced && field;
}

/**
 * Places of every theatre that has opened: the fronts move those. Past the
 * owner's last line, those the line no longer names are occupation's (ww179).
 */
function frontLand(gw: GreatWar): Set<GwPlace> {
  const out = new Set<GwPlace>();
  for (const t of gw.s.theatres) {
    if (t.since === null) continue;
    const named = frontLandAt(
      t.id,
      reachedLine(t),
      lineStep(t),
      t.salient ?? 0,
    );
    for (const p of frontPlaces(t.id)) {
      if (!named.has(p) && ranOn(gw, t, GW_PLACES[p].owner)) continue;
      out.add(p);
    }
  }
  return out;
}

/**
 * Whether `owner`'s land in `group` is open to `to`, at war with it: the
 * owner is out of the war `to` fought it in, its capital is held, or it no
 * longer stands against `to`. Over the water only, a colony or island cut off
 * from the owner's capital is open once no front's place there is the
 * owner's own any more.
 */
function openTo(
  gw: GreatWar,
  owner: GwTag,
  to: GwTag,
  group: string,
  byLand: boolean,
  fronts: Set<GwPlace>,
): boolean {
  const n = gw.nation(to);
  if (n === null || n.out) return false;
  const at = beatenAt(gw, owner);
  if (at !== null && gw.nation(owner)?.out === true) {
    return gw.s.wars.some(
      (w) =>
        w.ended === at &&
        ((w.a === owner && w.b === to) || (w.a === to && w.b === owner)),
    );
  }
  if (!atWarWith(gw, owner, to)) return false;
  if (capitalHolder(gw, owner) !== null) return true;
  if (!standsAgainst(gw, owner, to)) return true;
  if (byLand) return false;
  const graph = landGraph(gw);
  return GW_PLACE_KEYS.every(
    (p) =>
      groupOf(p) !== group ||
      GW_PLACES[p].owner !== owner ||
      !gw.world.places.has(p) ||
      (!graph.home.has(p) && !(fronts.has(p) && holderOf(gw, p) === owner)),
  );
}

/** Countries that could take `owner`'s land: at war with it, or its victors. */
function foesOf(gw: GreatWar, owner: GwTag): GwTag[] {
  const at = beatenAt(gw, owner);
  const foes = new Set<GwTag>(gw.nation(owner)?.atWar ?? []);
  if (at !== null) {
    for (const w of gw.s.wars) {
      if (w.ended === at && w.a === owner) foes.add(w.b);
      if (w.ended === at && w.b === owner) foes.add(w.a);
    }
  }
  return gw.s.nations
    .filter((n) => !n.out && foes.has(n.tag))
    .map((n) => n.tag);
}

/** Groups from the taker's own 1914 land, by land: how many steps away. */
function hopsFrom(gw: GreatWar, tag: GwTag): Map<string, number> {
  const graph = landGraph(gw);
  const out = new Map<string, number>();
  let edge: string[] = [];
  for (const p of GW_PLACE_KEYS) {
    if (GW_PLACES[p].owner !== tag || out.has(groupOf(p))) continue;
    out.set(groupOf(p), 0);
    edge.push(groupOf(p));
  }
  for (let d = 1; edge.length > 0; d++) {
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

/**
 * How `tag` reaches group `g` for occupation: 0 by land from a group it
 * holds in, 1 over the water (its fleet rules the sea, and the open sea
 * joins a coast it holds to one of the group's), or null.
 */
function occupationReach(
  gw: GreatWar,
  tag: GwTag,
  g: string,
  held: Set<string>,
): 0 | 1 | null {
  const graph = landGraph(gw);
  if ((graph.near.get(g) ?? []).some((x) => held.has(x))) return 0;
  const seas = graph.oceans.get(g) ?? [];
  if (seas.length === 0 || !hasSea(gw, tag)) return null;
  for (const h of held) {
    if ((graph.oceans.get(h) ?? []).some((z) => seas.includes(z))) return 1;
  }
  return null;
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
 * The next group an enemy takes from `owner`: from a group it holds in, by
 * land the nearest to its own land first, then by name; over the sea last.
 */
function nextTaken(
  gw: GreatWar,
  owner: GwTag,
  fronts: Set<GwPlace>,
): Pick | null {
  const graph = landGraph(gw);
  let best: (Pick & { hops: number; group: string }) | null = null;
  for (const to of foesOf(gw, owner)) {
    const held = heldGroups(gw, to);
    let hops: Map<string, number> | null = null;
    for (const group of groupsOf(owner)) {
      const how = occupationReach(gw, to, group, held);
      if (how === null) continue;
      hops ??= hopsFrom(gw, to);
      const d = how === 0 ? (hops.get(group) ?? BY_SEA - 1) : BY_SEA;
      if (
        best !== null &&
        (best.hops < d || (best.hops === d && best.group <= group))
      ) {
        continue;
      }
      if (!openTo(gw, owner, to, group, how === 0, fronts)) continue;
      const places = movable(gw, group, owner, owner, fronts);
      if (places.length === 0) continue;
      const tiles = places.reduce((n, p) => n + (graph.tiles.get(p) ?? 0), 0);
      best = { to, places, tiles, hops: d, group };
    }
  }
  return best;
}

/**
 * A country that stands again takes back its land from an enemy its land is
 * no longer open to, a group a chapter, from what it holds.
 */
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
      const byLand = occupationReach(gw, foe, group, heldGroups(gw, foe));
      if (openTo(gw, owner, foe, group, byLand !== 1, fronts)) continue;
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
  let spent = s.news.filter(
    (x) =>
      x.chapter === s.chapter &&
      x.place !== undefined &&
      (x.key === "front_salient" || x.key === "front_salient_back"),
  ).length;
  let groups = 0;
  for (const n of [...s.nations]) {
    const owner = n.tag;
    const taken = nextTaken(gw, owner, fronts);
    const pick = taken ?? nextFreed(gw, owner, fronts);
    if (pick === null) continue;
    if (groups > 0 && spent + pick.places.length > GW_OCC_PLACES) continue;
    const from = holderOf(gw, pick.places[0]);
    for (const p of pick.places) moveLand(gw, p, pick.to, null, "occupation");
    spent += pick.places.length;
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
