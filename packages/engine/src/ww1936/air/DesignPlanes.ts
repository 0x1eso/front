// World War 1936 P6 T1b (lane E's deferred sites): plane designs in P4's
// air war. A deployment record (and a carrier deck) holds its static planes
// per generation (`counts`, `deckOf`) and its design planes per plane
// design slot (`dcounts`, `deckDOf`); a design slot's planes fly as the P4
// type its design is judged to be (DesignRules.planeType). These helpers
// give the one order every draw, return and loss follows (spec §5.2.4: the
// best score first; P4 spec §13.2 and §14.3: losses and returns the
// oldest first), so a country without plane designs keeps P4's behaviour.
import type { AirType } from "@openfront/engine-api/ww1936/AirTypes";
import {
  type PlaneDesignStats,
  WW_PLANE_DESIGN_SLOTS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  equipKey,
  EQUIPMENT_GENS,
  type EquipmentType,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { staticPlaneScore } from "@openfront/engine-lib/ww1936/PlaneScore";
import { planeGenTechs } from "@openfront/engine-lib/ww1936/PlaneStats";
import { isOldScore } from "@openfront/engine-lib/ww1936/TemplateStats";
import { planeDesignScore, planeDesignSlotsOf } from "../depth/Designs";
import type { WwDepth } from "../depth/WwDepth";
import type { CountryEconomy } from "../economy/WwEconomy";

/** One source of a type's planes: a static generation (slot 0) or a design slot (gen 0). */
export interface PlaneSource {
  gen: number;
  slot: number;
}

/**
 * The owner holds a plane design in some slot. Most countries hold none
 * (the AI designs no planes): their draws and returns skip the design
 * lookups and keep P4's order (perf: no per-slot design reads).
 */
export function anyPlaneDesign(depth: WwDepth, owner: number): boolean {
  const c = depth.country(owner);
  if (c === null) return false;
  for (const s of c.des.plane) if (s !== null) return true;
  return false;
}

/** The slots flying as `type` (planeDesignSlotsOf), none without a plane design. */
export function designSlotsFor(
  depth: WwDepth,
  owner: number,
  type: string,
): number[] {
  return anyPlaneDesign(depth, owner)
    ? planeDesignSlotsOf(depth, owner, type)
    : [];
}

/** The sources of one plane type, best score first, and which are old. */
export interface PlaneRank {
  sources: PlaneSource[];
  scores: number[];
  /** Aligned with `sources`: more than TANK_OLD_PCT below the best fieldable score of the type. */
  old: boolean[];
  anyOld: boolean;
}

interface RankStamp {
  seq: number;
  res: ReadonlySet<unknown>;
  size: number;
  types: Map<string, PlaneRank>;
}
const RANK_MEMO = new WeakMap<WwDepth, Map<number, RankStamp>>();

/**
 * The country's sources of P4 type `type` ranked by performance score
 * (best first; ties: a static before a design, the newer generation, the
 * lower design slot) with the old ones marked: a source is old when its
 * score is more than TANK_OLD_PCT below the best among what the country
 * can field (the static generations whose techs it holds, and its designs
 * flying as the type). Memoised until a design or the tech set changes.
 */
export function planeRankOf(
  depth: WwDepth,
  owner: number,
  type: string,
): PlaneRank {
  const ce = depth.ww.economy.country(owner);
  // (Reading a design refreshes the depth's caches when a tech landed.)
  depth.designStatsOf(owner, "plane", 1);
  let per = RANK_MEMO.get(depth);
  if (per === undefined) RANK_MEMO.set(depth, (per = new Map()));
  let st = per.get(owner);
  const res = ce?.researched ?? EMPTY_RES;
  if (
    st === undefined ||
    st.seq !== depth.keyStatsSeq ||
    st.res !== res ||
    st.size !== res.size
  ) {
    st = { seq: depth.keyStatsSeq, res, size: res.size, types: new Map() };
    per.set(owner, st);
  }
  const hit = st.types.get(type);
  if (hit !== undefined) return hit;
  const gens = EQUIPMENT_GENS[type as EquipmentType] ?? 0;
  const rows: {
    src: PlaneSource;
    score: number;
    kind: number;
    fieldable: boolean;
  }[] = [];
  for (let g = gens; g >= 1; g--) {
    rows.push({
      src: { gen: g, slot: 0 },
      score: staticPlaneScore(type as AirType, g),
      kind: 0,
      fieldable: planeGenTechs(type as AirType, g).every((t) => res.has(t)),
    });
  }
  if (anyPlaneDesign(depth, owner)) {
    for (let s = 1; s <= WW_PLANE_DESIGN_SLOTS; s++) {
      const ds = depth.designStatsOf(
        owner,
        "plane",
        s,
      ) as PlaneDesignStats | null;
      if (ds === null || ds.type !== type) continue;
      rows.push({
        src: { gen: 0, slot: s },
        score: planeDesignScore(ds),
        kind: 1,
        fieldable: true,
      });
    }
  }
  rows.sort(
    (a, b) =>
      b.score - a.score ||
      a.kind - b.kind ||
      b.src.gen - a.src.gen ||
      a.src.slot - b.src.slot,
  );
  let best = 0;
  for (const r of rows) if (r.fieldable && r.score > best) best = r.score;
  const old = rows.map((r) => best > 0 && isOldScore(r.score, best));
  const rank: PlaneRank = {
    sources: rows.map((r) => r.src),
    scores: rows.map((r) => r.score),
    old,
    anyOld: old.some((o) => o),
  };
  st.types.set(type, rank);
  return rank;
}

const EMPTY_RES: ReadonlySet<unknown> = new Set();

/** Whether plane design slot `slot` (1-based) is old against its type's best. */
export function planeDesignIsOld(
  depth: WwDepth,
  owner: number,
  slot: number,
): boolean {
  const ds = depth.designStatsOf(
    owner,
    "plane",
    slot,
  ) as PlaneDesignStats | null;
  if (ds === null) return false;
  const rank = planeRankOf(depth, owner, ds.type);
  const i = rank.sources.findIndex((x) => x.slot === slot);
  return i >= 0 && rank.old[i];
}

/**
 * The sources of `owner`'s planes of P4 type `type` (an AIR_TYPES name),
 * best performance score first (the draw order): the static generations
 * and the design slots flying as the type; ties: the static generation
 * first, the newer generation, the lower design slot. Without a plane
 * design: the static generations, newest first — P4's order. A fresh
 * array (callers reverse it).
 */
export function planeSources(
  depth: WwDepth,
  owner: number,
  type: string,
): PlaneSource[] {
  return planeRankOf(depth, owner, type).sources.slice();
}

/**
 * The generation swap on one holder of planes (a wing, a deck): up to `n`
 * planes of old sources (lowest score first) become planes of non-old
 * sources with stock (the best first), the old going back to the stock.
 * `held` reads how many the holder has of a source, `add` changes that by
 * `k` (the caller's arrays); the ledger moves here. Nothing happens, and
 * nothing is read from the holder, when the type has no old source.
 */
export function swapOldPlanes(
  depth: WwDepth,
  ce: CountryEconomy,
  owner: number,
  type: string,
  n: number,
  held: (x: PlaneSource) => number,
  add: (x: PlaneSource, k: number) => void,
): number {
  const rank = planeRankOf(depth, owner, type);
  if (!rank.anyOld) return 0;
  const src = rank.sources;
  const keyOf = (x: PlaneSource) =>
    x.slot === 0
      ? equipKey(type as EquipmentType, x.gen)
      : equipKey("plane_design", x.slot);
  let left = n;
  let swapped = 0;
  for (let o = src.length - 1; o >= 0 && left > 0; o--) {
    if (!rank.old[o]) continue;
    for (let a = 0; a < src.length && left > 0; a++) {
      if (rank.old[a]) continue;
      const have = held(src[o]);
      if (have <= 0) break;
      const ka = keyOf(src[a]);
      const take = Math.min(left, have, ce.stock[ka]);
      if (take <= 0) continue;
      const ko = keyOf(src[o]);
      ce.stock[ka] -= take;
      ce.planesDeployed[ka] += take;
      add(src[a], take);
      const back = Math.min(take, ce.planesDeployed[ko]);
      ce.planesDeployed[ko] -= back;
      ce.stock[ko] += back;
      add(src[o], -take);
      left -= take;
      swapped += take;
    }
  }
  return swapped;
}

/**
 * Up to `n` planes of a record (or a deck type), the oldest source first
 * (planeSources backwards: P4's oldest generation first, the designs at
 * their year): how many from each generation and, when the record holds
 * design planes, from each design slot (null otherwise). Design planes
 * of a slot no longer judged to fly as the type (none should be: lane E
 * holds a slot while planes of it are out) go last, slot order. Nothing
 * is taken off the record.
 */
export function oldestFirst(
  depth: WwDepth,
  owner: number,
  type: string,
  counts: ArrayLike<number>,
  dcounts: ArrayLike<number>,
  n: number,
): { gens: number[]; slots: number[] | null } {
  const gens = new Array<number>(counts.length).fill(0);
  let left = Math.max(0, Math.floor(n));
  let anyD = false;
  for (let s = 0; s < dcounts.length; s++) if (dcounts[s] > 0) anyD = true;
  if (!anyD) {
    for (let g = 0; g < counts.length && left > 0; g++) {
      const k = Math.min(left, counts[g]);
      gens[g] = k;
      left -= k;
    }
    return { gens, slots: null };
  }
  const slots = new Array<number>(WW_PLANE_DESIGN_SLOTS).fill(0);
  const src = planeSources(depth, owner, type);
  for (let i = src.length - 1; i >= 0 && left > 0; i--) {
    const x = src[i];
    if (x.slot === 0) {
      const k = Math.min(left, counts[x.gen - 1] ?? 0);
      gens[x.gen - 1] += k;
      left -= k;
    } else {
      const k = Math.min(left, dcounts[x.slot - 1] ?? 0);
      slots[x.slot - 1] += k;
      left -= k;
    }
  }
  for (let s = 0; s < dcounts.length && left > 0; s++) {
    const k = Math.min(left, dcounts[s] - slots[s]);
    if (k <= 0) continue;
    slots[s] += k;
    left -= k;
  }
  return { gens, slots };
}

/**
 * A carrier row's design planes that fly as deck type `type` (cv_fighter,
 * cv_cas, cv_naval_bomber), per design slot; null when it carries none.
 */
export function deckDesignCounts(
  depth: WwDepth,
  owner: number,
  row: number,
  type: string,
): number[] | null {
  const dd = depth.ww.navy.ships.deckDOf(row);
  let any = false;
  for (let s = 0; s < dd.length; s++) if (dd[s] > 0) any = true;
  if (!any) return null;
  let out: number[] | null = null;
  for (const s of designSlotsFor(depth, owner, type)) {
    const n = dd[s - 1] ?? 0;
    if (n <= 0) continue;
    out ??= new Array<number>(WW_PLANE_DESIGN_SLOTS).fill(0);
    out[s - 1] = n;
  }
  return out;
}
