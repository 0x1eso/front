// Great War 1914: the unrest lens (ww155 lane C). Strikes, bread, nationalities
// and rumour painted on the map's regions. It reads what the seat already sees:
// the order and bread gauges and the rung of unrest of its own country, the
// news of the others. Place-level detail comes from the region's own kind (a
// city strikes and goes hungry first, a farm district last) and, for the
// nationalities, from a small table of lands a country has trouble holding.
// Nothing is read that the seat may not know: a foreign country shows only
// what the papers printed, and shows it hatched, as a rumour.
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { GW_PLACES } from "@openfront/engine-api/ww1914/GwPlaces";
import type {
  GreatWarData,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import type { ReadonlyScenarioRegion } from "@openfront/engine-api/ww1936/ScenarioTypes";
import type { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import {
  OCC_HATCH,
  type OccupationCell,
} from "../../render/gl/passes/OccupationPass";

export const GW_LENSES = ["strikes", "bread", "nations", "rumour"] as const;
export type GwLens = (typeof GW_LENSES)[number];

export type Rgb = readonly [number, number, number];

/** Calm to open revolt: five steps, the same for every lens. */
export const RAMP: readonly Rgb[] = [
  [96, 196, 124],
  [238, 214, 92],
  [244, 150, 56],
  [228, 66, 56],
  [206, 64, 206],
];
/** How strongly each step is painted: calm barely tints the map. */
const RAMP_LEVEL: readonly number[] = [8, 24, 34, 44, 54];

/** What the map's buttons have set; the renderer and the panel share it. */
export interface GwMapState {
  lens: GwLens | null;
  /** The mobilisation trains show (GwRailModel). */
  rail: boolean;
  /** War aims or the table have the map: no lens, and their column steps aside. */
  busy: boolean;
  /**
   * ww194: a talk, a reader or a briefing covers the screen. The lens keeps
   * its pick but its buttons step away: on a phone they sat over the talk's
   * nameplate.
   */
  covered?: boolean;
  /** Bumped on every change. */
  version: number;
}

export const gwMapState: GwMapState = {
  lens: null,
  rail: true,
  busy: false,
  version: 0,
};

export function setLens(lens: GwLens | null): void {
  gwMapState.lens = gwMapState.lens === lens ? null : lens;
  gwMapState.version++;
}

export function setMapBusy(busy: boolean): void {
  if (gwMapState.busy === busy) return;
  gwMapState.busy = busy;
  if (busy) gwMapState.lens = null;
  gwMapState.version++;
}

export function setMapCovered(covered: boolean): void {
  if ((gwMapState.covered ?? false) === covered) return;
  gwMapState.covered = covered;
  gwMapState.version++;
}

export function setRail(on: boolean): void {
  gwMapState.rail = on;
  gwMapState.version++;
}

// ---- Regions ----

/** Only these parts of the world are painted for a country (its home front). */
const HOME_WINDOW = { x0: 1700, x1: 2700, y0: 350, y1: 950 };

export type RegionKind = "city" | "town" | "country";

export function kindOf(r: ReadonlyScenarioRegion): RegionKind {
  switch (r.cat) {
    case "city":
    case "large_city":
    case "metropolis":
    case "megalopolis":
    case "large_town":
      return "city";
    case "town":
      return "town";
    default:
      return "country";
  }
}

/** A factory district: it strikes first. */
export function industrial(r: ReadonlyScenarioRegion): boolean {
  return r.civ + r.mil >= 3 || kindOf(r) === "city";
}

function atHome(tag: GwTag, r: ReadonlyScenarioRegion): boolean {
  if (tag === "RUS") return true;
  if (r.center === undefined) return false;
  const [x, y] = r.center;
  return (
    x >= HOME_WINDOW.x0 &&
    x <= HOME_WINDOW.x1 &&
    y >= HOME_WINDOW.y0 &&
    y <= HOME_WINDOW.y1
  );
}

/** A land's trouble: how restive it is, 1 quiet .. 3 hot. By the place groups. */
export const GW_RESTIVE: Readonly<
  Partial<Record<GwTag, Readonly<Record<string, number>>>>
> = {
  AUH: {
    bosnia: 3,
    transylvania: 3,
    croatia: 2,
    dalmatia: 2,
    bohemia: 2,
    moravia: 2,
    galicia: 2,
    bukovina: 2,
    banat: 2,
    upper_hungary: 2,
    trentino: 2,
    trieste: 2,
  },
  RUS: {
    russian_poland: 3,
    baltic: 2,
    bessarabia: 2,
    ukraine: 2,
    west_russia: 1,
    caucasus: 2,
  },
  DEU: {
    alsace_lorraine: 3,
    posen: 3,
    west_prussia: 2,
    schleswig: 2,
    silesia: 1,
  },
  OTT: { caucasus: 3, syria: 2, palestine: 2, mesopotamia: 2 },
};

/** Britain's Irish counties (Dublin, Donegal, Fermanagh, Galway, Clare, Cork). */
export const IRISH_REGIONS: readonly number[] = [260, 264, 286, 288, 310, 317];

interface Cached {
  /** Region id -> its 1914 owner and what kind of ground it is. */
  readonly rows: readonly {
    readonly r: ReadonlyScenarioRegion;
    readonly owner: GwTag;
  }[];
}

const cache = new WeakMap<ScenarioIndex, Cached>();

function rowsOf(s: ScenarioIndex): Cached {
  let hit = cache.get(s);
  if (hit === undefined) {
    hit = {
      rows: s.data.regions.flatMap((r) =>
        r.gwOwner === undefined || r.gwOwner === null
          ? []
          : [{ r, owner: r.gwOwner as GwTag }],
      ),
    };
    cache.set(s, hit);
  }
  return hit;
}

// ---- Severity ----

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/** Order gauge (0 bottom .. 5) to a step: 4 and 5 are calm. */
export function orderStep(order: number): number {
  return clamp(4 - order, 0, 4);
}

/** Bread gauge (0 empty .. 3) to a step. */
export function breadStep(bread: number): number {
  return [4, 3, 1, 0][clamp(bread, 0, 3)];
}

/** The country's own strikes, riots, army unrest and revolution: rung 0..4. */
function ownStep(seat: GwSeatView, gauge: "order" | "bread"): number {
  const g = seat.gauges[gauge] ?? (gauge === "order" ? 5 : 3);
  return gauge === "order" ? orderStep(g) : breadStep(g);
}

/** A district's step from the country's, by what kind of ground it is. */
export function localStep(
  base: number,
  r: ReadonlyScenarioRegion,
  lens: "strikes" | "bread",
): number {
  if (base === 0) return 0;
  const k = kindOf(r);
  if (lens === "strikes") {
    const up = industrial(r) ? 1 : 0;
    const down = k === "country" && r.civ + r.mil === 0 ? 1 : 0;
    return clamp(base + up - down, 0, 4);
  }
  // Bread: the cities go hungry first; the farm country feeds itself longer.
  const up = k === "city" ? 1 : 0;
  const down = k === "country" && base < 4 ? 1 : 0;
  return clamp(base + up - down, 0, 4);
}

/** Heat of a restive land on top of the country's trouble. */
export function nationStep(stress: number, restive: number): number {
  return clamp(stress + restive - 1, 0, 4);
}

function cell(region: number, step: number, flags = 0): OccupationCell {
  return {
    region,
    rgb: RAMP[step],
    level: RAMP_LEVEL[step],
    flags,
  };
}

/** The rung of unrest the papers have printed for another country, 0 if none. */
export function rumouredRung(
  data: GreatWarData,
  seat: GwSeatView,
  tag: GwTag,
  window = 6,
): number {
  let rung = 0;
  for (const n of seat.world.news) {
    if (n.a !== tag || n.chapter < data.chapter - window) continue;
    const m = /^unrest_(\d)$/.exec(n.key);
    if (m !== null) rung = Math.max(rung, Number(m[1]));
  }
  return rung;
}

/** Who holds a region now: a place held by another country shows that country's. */
function holderOf(
  data: GreatWarData,
  r: ReadonlyScenarioRegion,
  owner: GwTag,
): GwTag {
  const place = r.place;
  if (place === undefined || !(place in GW_PLACES)) return owner;
  return data.held[place as keyof typeof GW_PLACES] ?? owner;
}

/** The cells of one lens for the seat now. */
export function lensCells(
  lens: GwLens,
  data: GreatWarData,
  seat: GwSeatView,
  scenario: ScenarioIndex,
): OccupationCell[] {
  const out: OccupationCell[] = [];
  const rung = seat.world.unrest;
  const irish = seat.world.threads.includes("ireland");
  const order = ownStep(seat, "order");
  const stress = clamp(order + rung, 0, 4);
  const foreign = new Map<GwTag, number>();
  for (const { r, owner } of rowsOf(scenario).rows) {
    const holder = holderOf(data, r, owner);
    const mine = holder === seat.tag;
    if (lens === "rumour") {
      if (mine) continue;
      let rg = foreign.get(holder);
      if (rg === undefined) {
        rg = rumouredRung(data, seat, holder);
        foreign.set(holder, rg);
      }
      if (rg > 0 && atHome(holder, r)) out.push(cell(r.id, rg, OCC_HATCH));
      continue;
    }
    if (!mine || !atHome(seat.tag, r)) continue;
    if (lens === "strikes") {
      const base = clamp(Math.max(order, rung), 0, 4);
      out.push(cell(r.id, localStep(base, r, "strikes")));
    } else if (lens === "bread") {
      const base = Math.max(ownStep(seat, "bread"), 0);
      out.push(cell(r.id, localStep(base, r, "bread")));
    } else {
      const group = r.place === undefined ? undefined : placeGroup(r.place);
      let restive =
        group === undefined ? 0 : (GW_RESTIVE[seat.tag]?.[group] ?? 0);
      if (seat.tag === "GBR" && IRISH_REGIONS.includes(r.id)) {
        restive = irish ? 3 : 2;
      }
      if (restive > 0) out.push(cell(r.id, nationStep(stress, restive)));
    }
  }
  return out;
}

function placeGroup(place: string): string | undefined {
  return (GW_PLACES as Record<string, { group: string } | undefined>)[place]
    ?.group;
}

// ---- Legend and readout ----

/** The steps a lens uses, for its legend (text: gw.lens.step.<lens>.<n>). */
export function lensSteps(lens: GwLens): readonly number[] {
  return lens === "rumour" ? [1, 2, 3, 4] : [0, 1, 2, 3, 4];
}

/** The seat's own step for a lens: the headline of the readout. */
export function ownHeadline(
  lens: GwLens,
  seat: GwSeatView,
): { step: number; hasOwn: boolean } {
  const rung = seat.world.unrest;
  switch (lens) {
    case "strikes":
      return {
        step: clamp(Math.max(ownStep(seat, "order"), rung), 0, 4),
        hasOwn: true,
      };
    case "bread":
      return { step: ownStep(seat, "bread"), hasOwn: true };
    case "nations": {
      const table = GW_RESTIVE[seat.tag];
      const has = table !== undefined || seat.tag === "GBR";
      const stress = clamp(ownStep(seat, "order") + rung, 0, 4);
      return { step: has ? nationStep(stress, 2) : 0, hasOwn: has };
    }
    case "rumour":
      return { step: 0, hasOwn: false };
  }
}

/** Foreign countries the papers have printed unrest for: tag and rung. */
export function rumourList(
  data: GreatWarData,
  seat: GwSeatView,
): { tag: GwTag; rung: number }[] {
  const tags = new Set<GwTag>();
  for (const n of seat.world.news)
    if (n.a !== null && n.a !== seat.tag) tags.add(n.a);
  return [...tags]
    .map((tag) => ({ tag, rung: rumouredRung(data, seat, tag) }))
    .filter((x) => x.rung > 0)
    .sort((a, b) => b.rung - a.rung);
}
