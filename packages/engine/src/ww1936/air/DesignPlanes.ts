// World War 1936 P6 T1b (lane E's deferred sites): plane designs in P4's
// air war. A deployment record (and a carrier deck) holds its static planes
// per generation (`counts`, `deckOf`) and its design planes per plane
// design slot (`dcounts`, `deckDOf`); a design slot's planes fly as the P4
// type its design is judged to be (DesignRules.planeType). These helpers
// give the one order every draw, return and loss follows (spec §5.2.4: the
// newest year first; P4 spec §13.2 and §14.3: losses and returns the
// oldest first), so a country without plane designs keeps P4's behaviour.
import {
  type PlaneDesignStats,
  WW_PLANE_DESIGN_SLOTS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  EQUIPMENT_GENS,
  type EquipmentType,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { genTech } from "@openfront/engine-lib/ww1936/Equipment";
import { WW_TECHS } from "@openfront/engine-lib/ww1936/WwTechs";
import { planeDesignSlotsOf } from "../depth/Designs";
import type { WwDepth } from "../depth/WwDepth";

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

/** The year of a static generation of a P4 type (its tech's; 1936 without one). */
function genYear(type: string, gen: number): number {
  const tech = genTech(type as EquipmentType, gen);
  return tech === undefined ? 1936 : (WW_TECHS[tech]?.year ?? 1936);
}

/**
 * The sources of `owner`'s planes of P4 type `type` (an AIR_TYPES name),
 * newest year first (spec §5.2.4's draw order): the static generations
 * and the design slots flying as the type; ties: the static generation
 * first (the smaller key), the newer generation, the designs in lane E's
 * draw order (planeDesignSlotsOf). Without a plane design: the static
 * generations, newest first — P4's order.
 */
export function planeSources(
  depth: WwDepth,
  owner: number,
  type: string,
): PlaneSource[] {
  const gens = EQUIPMENT_GENS[type as EquipmentType] ?? 0;
  const rows: [number, number, number, PlaneSource][] = [];
  for (let g = gens; g >= 1; g--) {
    rows.push([genYear(type, g), 0, gens - g, { gen: g, slot: 0 }]);
  }
  const slots = designSlotsFor(depth, owner, type);
  for (let i = 0; i < slots.length; i++) {
    const st = depth.designStatsOf(
      owner,
      "plane",
      slots[i],
    ) as PlaneDesignStats | null;
    if (st !== null) rows.push([st.year, 1, i, { gen: 0, slot: slots[i] }]);
  }
  if (slots.length === 0) return rows.map((r) => r[3]);
  rows.sort((a, b) => b[0] - a[0] || a[1] - b[1] || a[2] - b[2]);
  return rows.map((r) => r[3]);
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
