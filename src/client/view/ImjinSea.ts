// ww177 P3 (Imjin design §6.2, "what the player sees"): the sea by hand, as
// the fleet card and the map read it. Pure: the battle circle's two sides
// (morale and hull), the wind over a fleet's sea zone, the channel current's
// time left when my side holds both shores, and a drag's heading as a target
// tile. The wind and the current are the engine's (ImjinData, merge 3).
import type { ImjinData } from "@openfront/engine-api/imjin/ImjinTypes";
import { IMJIN_SHIP_KINDS } from "@openfront/engine-api/imjin/ImjinTypes";
import {
  SEA_TICKS_PER_SECOND,
  type Wind,
} from "@openfront/engine-lib/imjin/SeaRules";
import type { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";

/** The atlas cell (ship-atlas-meta.json) each era hull is drawn with. */
const CELL_OF_KIND: Readonly<
  Record<(typeof IMJIN_SHIP_KINDS)[number], ImjinShipCell>
> = {
  panokseon: "imjin_panokseon",
  turtle: "imjin_turtle",
  hyeopseon: "imjin_small",
  atakebune: "imjin_atakebune",
  sekibune: "imjin_sekibune",
  kobaya: "imjin_small",
  fuchuan: "imjin_atakebune",
  shachuan: "imjin_sekibune",
  transport: "imjin_sekibune",
};
export type ImjinShipCell =
  | "imjin_panokseon"
  | "imjin_turtle"
  | "imjin_small"
  | "imjin_atakebune"
  | "imjin_sekibune";

export function imjinShipCell(kind: number): ImjinShipCell {
  return (
    CELL_OF_KIND[IMJIN_SHIP_KINDS[kind] ?? "transport"] ?? "imjin_sekibune"
  );
}

/** A fleet's ships by era kind, [kind name, count] in the kinds' order (none left out). */
export function shipsByKind(
  d: ImjinData,
  fleet: number,
): [(typeof IMJIN_SHIP_KINDS)[number], number][] {
  const n = IMJIN_SHIP_KINDS.map(() => 0);
  for (const s of d.ships) if (s[1] === fleet) n[s[6]] = (n[s[6]] ?? 0) + 1;
  const out: [(typeof IMJIN_SHIP_KINDS)[number], number][] = [];
  IMJIN_SHIP_KINDS.forEach((k, i) => {
    if (n[i] > 0) out.push([k, n[i]]);
  });
  return out;
}

/** Ships burning in a fleet. */
export function burningShips(d: ImjinData, fleet: number): number {
  let n = 0;
  for (const s of d.ships) if (s[1] === fleet && s[7] !== 0) n++;
  return n;
}

// ---------------------------------------------------------------------------
// The battle circle.

export interface ImjinBattleSide {
  owners: number[];
  fleets: number[];
  ships: number;
  /** Hull left ‰ and morale ‰, weighted by ships. */
  hullPm: number;
  morale: number;
}

export interface ImjinBattleView {
  id: number;
  /** Centre, tiles. */
  x: number;
  y: number;
  /** Side 0 is `me`'s when I fight in it, else the first fleet's. */
  sides: [ImjinBattleSide, ImjinBattleSide];
}

function emptySide(): ImjinBattleSide {
  return { owners: [], fleets: [], ships: 0, hullPm: 0, morale: 0 };
}

/**
 * Each battle circle's two sides. `friends(a, b)`: a and b fight on the
 * same side (one country with itself at least).
 */
export function imjinBattleViews(
  d: ImjinData,
  me: number,
  friends: (a: number, b: number) => boolean = (a, b) => a === b,
): ImjinBattleView[] {
  const out: ImjinBattleView[] = [];
  for (const b of d.battles) {
    const members = d.fleets.filter((f) => f.battle === b.id);
    if (members.length === 0) continue;
    const anchor = members.some((f) => friends(f.owner, me))
      ? me
      : members[0].owner;
    const sides: [ImjinBattleSide, ImjinBattleSide] = [
      emptySide(),
      emptySide(),
    ];
    const hull = [0, 0];
    const mor = [0, 0];
    for (const f of members) {
      const k = friends(f.owner, anchor) ? 0 : 1;
      const s = sides[k];
      if (!s.owners.includes(f.owner)) s.owners.push(f.owner);
      s.fleets.push(f.id);
      s.ships += f.ships;
      hull[k] += f.hullPm * f.ships;
      mor[k] += f.morale * f.ships;
    }
    for (const k of [0, 1]) {
      const s = sides[k];
      s.hullPm = s.ships > 0 ? Math.round(hull[k] / s.ships) : 0;
      s.morale = s.ships > 0 ? Math.round(mor[k] / s.ships) : 0;
    }
    out.push({ id: b.id, x: b.cx / 1000, y: b.cy / 1000, sides });
  }
  return out;
}

/** Side 0's share of what both sides have left (ships × hull and morale), 0..1. */
export function imjinBattleShare(v: ImjinBattleView): number {
  const [a, b] = v.sides;
  const x = a.ships * (a.hullPm + a.morale);
  const y = b.ships * (b.hullPm + b.morale);
  return x + y > 0 ? x / (x + y) : 0.5;
}

// ---------------------------------------------------------------------------
// The wind.

/**
 * The wind over the zone at milli-tile (x, y), as the engine sends it
 * (ImjinData.winds, merge 3); calm where it sent none.
 */
export function imjinWindOver(
  d: Pick<ImjinData, "winds">,
  sc: Pick<ScenarioIndex, "width" | "height" | "regionAt">,
  x: number,
  y: number,
): Wind {
  const tx = Math.floor(x / 1000);
  const ty = Math.floor(y / 1000);
  if (tx < 0 || ty < 0 || tx >= sc.width || ty >= sc.height) {
    return { to: 0, strength: 0 };
  }
  const zone = sc.regionAt(ty * sc.width + tx);
  const w = d.winds.find((r) => r[0] === zone);
  return w === undefined
    ? { to: 0, strength: 0 }
    : { to: w[1], strength: w[2] };
}

const ARROWS = ["→", "↘", "↓", "↙", "←", "↖", "↑", "↗"] as const;
/** Compass point names by sector (0 east, then clockwise on the screen). */
export const COMPASS = ["e", "se", "s", "sw", "w", "nw", "n", "ne"] as const;

/** The eighth of the circle a binary angle (0 east, 256 south) falls in. */
export function sectorOf(angle: number): number {
  return Math.round((angle & 1023) / 128) & 7;
}

/** The wind's arrow (where it blows to), the point it comes from, its strength. */
export function windShown(w: Wind): {
  arrow: string;
  from: (typeof COMPASS)[number];
  strength: number;
} {
  return {
    arrow: w.strength === 0 ? "·" : ARROWS[sectorOf(w.to)],
    from: COMPASS[sectorOf(w.to + 512)],
    strength: w.strength,
  };
}

// ---------------------------------------------------------------------------
// The channel current.

/**
 * Design §6.2: the side holding both shores sees the current's countdown
 * (the engine sends who holds them, merge 3). Null when there is no current
 * or my side does not hold both shores. `mine(owner)`: on my side.
 */
export function currentCountdown(
  b: Pick<
    ImjinData["battles"][number],
    "current" | "turnIn" | "flow" | "shores"
  >,
  mine: (owner: number) => boolean,
): { seconds: number; with: boolean } | null {
  if (b.current === 0 || b.shores === 0 || !mine(b.shores)) return null;
  return {
    seconds: Math.ceil(b.turnIn / SEA_TICKS_PER_SECOND),
    with: b.flow > 0,
  };
}

// ---------------------------------------------------------------------------
// Steering.

/**
 * A drag from the fleet at (fx, fy) to (px, py) tiles, as the sea tile the
 * fleet heads for: along the ray, at least `minTiles` out, the last water
 * tile before land or the map's edge. -1 when the drag is too short or no
 * water lies that way.
 */
export function headingTarget(
  fx: number,
  fy: number,
  px: number,
  py: number,
  width: number,
  height: number,
  isSea: (tile: number) => boolean,
  minTiles = 8,
): number {
  const dx = px - fx;
  const dy = py - fy;
  const len = Math.hypot(dx, dy);
  if (len < 1) return -1;
  const reach = Math.max(minTiles, len);
  let best = -1;
  for (let r = 1; r <= reach; r += 0.5) {
    const tx = Math.floor(fx + (dx / len) * r);
    const ty = Math.floor(fy + (dy / len) * r);
    if (tx < 0 || ty < 0 || tx >= width || ty >= height) break;
    const t = ty * width + tx;
    if (!isSea(t)) break;
    best = t;
  }
  return best;
}
