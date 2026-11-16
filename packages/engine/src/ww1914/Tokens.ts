// Great War 1914 (ww218 §5): the army tokens a seat sees on the map. Ours
// exact; allies' and foes' as the seat believes them (Transfers.beliefOf),
// so the truth of another's army never reaches the client.
import {
  GW_SIDES,
  type GwSeatState,
  type GwSide,
  type GwTheatre,
  type GwTheatreState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  GW_PLACE_KEYS,
  GW_PLACES,
  type GwPlace,
  type GwPlaceGroup,
} from "@openfront/engine-api/ww1914/GwPlaces";
import type {
  GwTokenMove,
  GwTokenView,
} from "@openfront/engine-api/ww1914/GwTokens";
import { frontPlaces } from "@openfront/engine-lib/ww1914/FrontLand";
import { GW_CAPITALS } from "@openfront/engine-lib/ww1914/PlaceRules";
import type { GreatWar } from "./GreatWar";
import { holderOf } from "./Land";
import { endStrain } from "./Strain";
import {
  bandTenths,
  BELIEF_RANGE,
  beliefOf,
  etaOf,
  frontsOf,
  moveBlock,
  reserveBands,
} from "./Transfers";
import { memberEnd, membersOf, sideIn } from "./Wars";
import { clampTo, fights } from "./World";

/** Divisions a band stands for, by country (ww218 §5; lane M tunes). */
const DIVS_PER_BAND: Readonly<Partial<Record<GwTag, number>>> = {
  DEU: 14,
  FRA: 13,
  RUS: 18,
  AUH: 10,
  GBR: 8,
  ITA: 11,
  OTT: 8,
};
const DIVS_OTHER = 5;
/** Places of our end nearest the foe that set a token's anchor. */
const FRONTIER = 3;
const WEAR_PER_BAND = 8;

type Pt = readonly [number, number];

export function divsOf(tag: GwTag, tenths: number): number {
  const k = DIVS_PER_BAND[tag] ?? DIVS_OTHER;
  return Math.max(1, Math.floor((k * tenths + 5) / 10));
}

function centre(places: readonly GwPlace[]): Pt | null {
  if (places.length === 0) return null;
  let x = 0;
  let y = 0;
  for (const p of places) {
    x += GW_PLACES[p].center[0];
    y += GW_PLACES[p].center[1];
  }
  return [Math.round(x / places.length), Math.round(y / places.length)];
}

const d2 = (a: GwPlace, b: GwPlace) => {
  const [ax, ay] = GW_PLACES[a].center;
  const [bx, by] = GW_PLACES[b].center;
  return (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
};

/** Each end's anchor on a front: its places nearest the other end's. */
function anchorsOf(gw: GreatWar, t: GwTheatreState): Record<GwSide, Pt> | null {
  const all = frontPlaces(t.id);
  if (all.length === 0) return null;
  // ww219 M: who truly holds the place (the map), not the line's reading: a
  // place the line gives us but no one took (a neutral's) is nobody's here.
  const sideOf = (p: GwPlace): GwSide | null =>
    sideIn(gw, t.id, holderOf(gw, p));
  const by: Record<GwSide, GwPlace[]> = { central: [], entente: [] };
  for (const p of all) {
    const s = sideOf(p);
    if (s !== null) by[s].push(p);
  }
  const whole = centre(all)!;
  const out = {} as Record<GwSide, Pt>;
  for (const side of GW_SIDES) {
    let mine = by[side];
    const foe = by[side === "central" ? "entente" : "central"];
    // ww219 M: an end with no land listed on the front (Russia's in the
    // Caucasus) stands on its members' own land it still holds, nearest the
    // foe's; failing that, on any land its side holds.
    if (mine.length === 0 && foe.length > 0) {
      const members = membersOf(gw, t.id, side);
      const held = GW_PLACE_KEYS.filter(
        (p) => sideIn(gw, t.id, holderOf(gw, p)) === side,
      );
      const home = held.filter((p) => members.includes(GW_PLACES[p].owner));
      mine = home.length > 0 ? home : held;
    }
    if (mine.length === 0) {
      out[side] = whole;
      continue;
    }
    if (foe.length === 0) {
      out[side] = GW_PLACES[medoid(mine)].center;
      continue;
    }
    const near = mine
      .map((p) => ({ p, d: Math.min(...foe.map((f) => d2(p, f))) }))
      .sort((a, b) => a.d - b.d || (a.p < b.p ? -1 : 1))
      .slice(0, FRONTIER)
      .map((x) => x.p);
    // ww219 M: the near place whose centre is nearest their middle, so the
    // token stands on our own land, never behind the foe's line or at sea.
    out[side] = GW_PLACES[medoid(near)].center;
  }
  return out;
}

/** The place of `list` whose centre is nearest the list's middle. */
function medoid(list: readonly GwPlace[]): GwPlace {
  const [cx, cy] = centre(list)!;
  let best = list[0];
  let bestD = Infinity;
  for (const p of list) {
    const [x, y] = GW_PLACES[p].center;
    const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

const mid = (a: Pt, b: Pt): Pt => [
  Math.round((a[0] + b[0]) / 2),
  Math.round((a[1] + b[1]) / 2),
];

/** Where a band of ours on `from` (null: the reserve) could go. */
function movesFrom(
  gw: GreatWar,
  tag: GwTag,
  from: GwTheatre | null,
): GwTokenMove[] {
  return frontsOf(gw, tag)
    .filter((t) => t !== from)
    .map((to) => {
      const why = moveBlock(gw, tag, from, to);
      return { to, eta: etaOf(gw, tag, from), open: why === null, why };
    });
}

/** The seat's tokens; undefined while its country is not at war. */
export function tokensView(
  gw: GreatWar,
  seat: GwSeatState,
): GwTokenView[] | undefined {
  const n = gw.nation(seat.tag);
  if (n === null || !fights(n)) return undefined;
  const out: GwTokenView[] = [];
  const anchors = new Map<GwTheatre, Record<GwSide, Pt>>();
  const anchor = (t: GwTheatre, side: GwSide): Pt | null => {
    if (!anchors.has(t)) {
      const th = gw.s.theatres.find((x) => x.id === t)!;
      const a = anchorsOf(gw, th);
      if (a === null) return null;
      anchors.set(t, a);
    }
    return anchors.get(t)![side];
  };
  const capital = GW_CAPITALS[seat.tag];
  const home: Pt | null =
    capital === undefined ? null : GW_PLACES[capital].center;
  for (const t of gw.s.theatres) {
    if (!t.open || t.id === "sea") continue;
    const ends = GW_SIDES.map((e) => membersOf(gw, t.id, e));
    const friendly = ends.some((list) =>
      list.some(
        (tag) =>
          tag === seat.tag ||
          (n.side !== null && gw.nation(tag)?.side === n.side),
      ),
    );
    if (!friendly) continue;
    GW_SIDES.forEach((side, i) => {
      const at = anchor(t.id, side);
      if (at === null) return;
      for (const tag of ends[i]) {
        out.push(frontToken(gw, seat, t, side, tag, at));
      }
    });
  }
  if (home !== null && reserveBands(n) > 0) {
    const r = n.lift!.reserve[0];
    const divs = divsOf(seat.tag, reserveBands(n) * 10);
    out.push({
      ...ownNumbers(divs, 100),
      kind: "reserve",
      tag: seat.tag,
      rel: "own",
      theatre: null,
      side: null,
      at: home,
      order: null,
      eta: Math.max(1, r.since + 2 - gw.s.chapter),
      moves: movesFrom(gw, seat.tag, null),
    });
  }
  for (const f of n.lift?.fly ?? []) {
    const end = memberEnd(gw, f.to, seat.tag);
    const to = end === null ? null : anchor(f.to, end);
    const fromEnd = f.from === null ? null : memberEnd(gw, f.from, seat.tag);
    const from =
      f.from === null || fromEnd === null ? home : anchor(f.from, fromEnd);
    const at = to === null ? from : from === null ? to : mid(from, to);
    if (at === null) continue;
    out.push({
      ...ownNumbers(divsOf(seat.tag, 10), 100),
      kind: "moving",
      tag: seat.tag,
      rel: "own",
      theatre: f.from,
      side: null,
      at,
      order: null,
      to: f.to,
      eta: Math.max(1, f.at - gw.s.chapter),
    });
  }
  out.push(...garrisons(gw, seat));
  return out;
}

function ownNumbers(divs: number, fill: number) {
  return {
    divs,
    lo: divs,
    hi: divs,
    sure: 3,
    seen: "own" as const,
    fill,
  };
}

function frontToken(
  gw: GreatWar,
  seat: GwSeatState,
  t: GwTheatreState,
  side: GwSide,
  tag: GwTag,
  at: Pt,
): GwTokenView {
  const n = gw.nation(tag)!;
  const truth = bandTenths(n, t.id);
  const wear = clampTo(n.wear[t.id] ?? 0, 0, WEAR_PER_BAND);
  const fill = 100 - Math.floor((wear * 100) / WEAR_PER_BAND);
  if (tag === seat.tag) {
    return {
      ...ownNumbers(divsOf(tag, truth), fill),
      kind: "front",
      tag,
      rel: "own",
      theatre: t.id,
      side,
      at,
      order: 100 - endStrain(t, side),
      moves: movesFrom(gw, tag, t.id),
    };
  }
  const b = beliefOf(gw, seat.tag, t.id, tag);
  const rel = b.seen === "ally" ? "ally" : "foe";
  const base = {
    kind: "front" as const,
    tag,
    rel,
    theatre: t.id,
    side,
    at,
    sure: b.sure,
    seen: b.seen,
    fill: rel === "ally" ? fill : null,
    order: null,
  } satisfies Partial<GwTokenView>;
  if (b.sure === 0) return { ...base, divs: null, lo: 0, hi: 0 };
  let divs = divsOf(tag, b.tenths);
  // Below sure 3 the guess is never the count itself.
  if (b.sure < 3 && divs === divsOf(tag, truth)) {
    divs = Math.max(1, divs + (b.off < 0 ? -1 : 1));
    if (divs === divsOf(tag, truth)) divs += 1;
  }
  const r = BELIEF_RANGE[b.sure];
  return {
    ...base,
    divs,
    lo: Math.floor((divs * (100 - r)) / 100),
    hi: Math.floor((divs * (100 + r) + 99) / 100),
  };
}

/**
 * Our garrisons (lane W's effect, WarPower `garrison`): the bands occupied
 * land ties down, shared out over the groups we hold by how many places each
 * holds, a hard-held place counting double. A token per group with a share.
 */
function garrisons(gw: GreatWar, seat: GwSeatState): GwTokenView[] {
  const n = gw.nation(seat.tag);
  const bands = n?.warPower?.garrison ?? 0;
  if (n === null || bands <= 0) return [];
  const groups = new Map<GwPlaceGroup, { places: GwPlace[]; halves: number }>();
  let total = 0;
  for (const p of GW_PLACE_KEYS) {
    const owner = GW_PLACES[p].owner;
    if (owner === seat.tag || holderOf(gw, p) !== seat.tag) continue;
    const foe = gw.nation(owner);
    if (foe === null || (n.side !== null && foe.side === n.side)) continue;
    const r = (gw.s.rule ?? []).find(
      (x) => x.by === seat.tag && x.of === owner,
    );
    const halves = (r?.hard ?? 1) >= 2 ? 2 : 1;
    const g = GW_PLACES[p].group as GwPlaceGroup;
    const row = groups.get(g) ?? { places: [], halves: 0 };
    row.places.push(p);
    row.halves += halves;
    groups.set(g, row);
    total += halves;
  }
  const out: GwTokenView[] = [];
  if (total === 0) return out;
  for (const [group, row] of groups) {
    const tenths = Math.floor((bands * 10 * row.halves) / total);
    if (tenths === 0) continue;
    out.push({
      ...ownNumbers(divsOf(seat.tag, tenths), 100),
      kind: "garrison",
      tag: seat.tag,
      rel: "own",
      theatre: null,
      side: null,
      at: GW_PLACES[medoid(row.places)].center,
      order: null,
      group,
    });
  }
  return out;
}
