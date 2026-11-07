// Great War 1914: mobilisation by rail (ww155 lane C). In July's crisis each
// power's timetable runs as trains along the rail network, from its depots to
// its frontier, with the days counted. Display only: it reads the public
// mobilisation level of each country (`world.countries[].mob`), the war plan
// once it is signed, and the chapter's date. Nothing here is a rule.
import type { GwPlan } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { GW_PLACES, type GwPlace } from "@openfront/engine-api/ww1914/GwPlaces";
import type {
  GreatWarData,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import type { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";

/** A stop of a route: a named place, or a region by id (London has no place). */
export type Stop =
  | { readonly place: GwPlace }
  | { readonly region: number; readonly sea?: boolean };

/** How strongly a route runs under each plan: none signed, west, east, wait. */
export type PlanWeights = readonly [number, number, number, number];

export interface RailRoute {
  readonly id: string;
  /** From the depot, by the stops, to the frontier. */
  readonly stops: readonly Stop[];
  /** 0 hidden, 1 thin and dotted (a question), 2 running. */
  readonly w: PlanWeights;
}

export interface RailRow {
  readonly tag: GwTag;
  /** Days from the order to the last train at the frontier. */
  readonly days: number;
  readonly routes: readonly RailRoute[];
}

const p = (place: GwPlace): Stop => ({ place });
const ALWAYS: PlanWeights = [2, 2, 2, 2];

/**
 * The timetables. The days are the order of the thing, not a date: Russia is
 * slow to gather (few rails for so much land), France quick, Britain's small
 * army only has the Channel to cross. Germany is the one with a choice: the
 * road through Belgium opens or closes with the plan that gets signed.
 */
export const GW_RAILS: readonly RailRow[] = [
  {
    tag: "DEU",
    days: 17,
    routes: [
      {
        id: "deu_north",
        stops: [p("berlin"), p("cologne"), p("aachen")],
        w: [2, 2, 1, 2],
      },
      // The question of the whole crisis: past Aachen is Liège.
      {
        id: "deu_belgium",
        stops: [p("aachen"), p("liege"), p("namur")],
        w: [1, 2, 0, 0],
      },
      {
        id: "deu_lorraine",
        stops: [p("cologne"), p("saarbrucken"), p("metz")],
        w: [2, 2, 1, 2],
      },
      {
        id: "deu_south",
        stops: [p("munich"), p("strasbourg"), p("mulhouse")],
        w: [2, 2, 1, 2],
      },
      {
        id: "deu_east",
        stops: [p("berlin"), p("posen"), p("thorn")],
        w: [1, 1, 2, 1],
      },
      {
        id: "deu_silesia",
        stops: [p("berlin"), p("breslau"), p("kattowitz")],
        w: [1, 1, 2, 1],
      },
      {
        id: "deu_prussia",
        stops: [p("berlin"), p("konigsberg")],
        w: [1, 1, 2, 1],
      },
    ],
  },
  {
    tag: "FRA",
    days: 13,
    routes: [
      { id: "fra_lorraine", stops: [p("paris"), p("nancy")], w: ALWAYS },
      {
        id: "fra_epinal",
        stops: [p("paris"), p("epinal"), p("belfort")],
        w: ALWAYS,
      },
      {
        id: "fra_ardennes",
        stops: [p("paris"), p("reims"), p("verdun")],
        w: ALWAYS,
      },
      {
        id: "fra_north",
        stops: [p("paris"), p("lille"), p("maubeuge")],
        w: ALWAYS,
      },
    ],
  },
  {
    tag: "RUS",
    days: 21,
    routes: [
      {
        id: "rus_baltic",
        stops: [p("petrograd"), p("dvinsk"), p("kovno")],
        w: ALWAYS,
      },
      {
        id: "rus_poland",
        stops: [p("moscow"), p("minsk"), p("grodno"), p("bialystok")],
        w: ALWAYS,
      },
      { id: "rus_brest", stops: [p("moscow"), p("brest_litovsk")], w: ALWAYS },
      {
        id: "rus_galicia",
        stops: [p("kiev"), p("rovno"), p("lutsk")],
        w: ALWAYS,
      },
    ],
  },
  {
    tag: "AUH",
    days: 16,
    routes: [
      {
        id: "auh_galicia",
        stops: [p("vienna"), p("krakow"), p("lemberg")],
        w: ALWAYS,
      },
      {
        id: "auh_carpathians",
        stops: [p("budapest"), p("przemysl")],
        w: ALWAYS,
      },
      {
        id: "auh_serbia",
        stops: [p("budapest"), p("novi_sad"), p("belgrade")],
        w: ALWAYS,
      },
      { id: "auh_bosnia", stops: [p("vienna"), p("sarajevo")], w: ALWAYS },
    ],
  },
  {
    tag: "GBR",
    days: 12,
    routes: [
      // London, Hampshire, the Channel, Seine-Maritime, Maubeuge.
      {
        id: "gbr_bef",
        stops: [
          { region: 329 },
          { region: 337 },
          { region: 378, sea: true },
          p("amiens"),
          p("maubeuge"),
        ],
        w: ALWAYS,
      },
    ],
  },
  {
    tag: "BEL",
    days: 7,
    routes: [
      {
        id: "bel_liege",
        stops: [p("brussels"), p("namur"), p("liege")],
        w: ALWAYS,
      },
      { id: "bel_antwerp", stops: [p("brussels"), p("antwerp")], w: ALWAYS },
    ],
  },
  {
    tag: "SRB",
    days: 8,
    routes: [
      {
        id: "srb_drina",
        stops: [p("belgrade"), p("kragujevac"), p("uzice")],
        w: ALWAYS,
      },
    ],
  },
];

// ---- What runs now ----

/** The plan every seat may rely on: a foreign seat sees Germany's only once it is mobilised. */
export function planSeen(data: GreatWarData, seat: GwSeatView): GwPlan | null {
  const plan = seat.world.plan;
  if (plan === null) return null;
  if (seat.tag === "DEU") return plan;
  const deu = seat.world.countries.find((c) => c.tag === "DEU");
  return (deu?.mob ?? 0) >= 2 && data.stage !== "crisis" ? plan : null;
}

const PLAN_INDEX: Readonly<Record<GwPlan | "none", number>> = {
  none: 0,
  west: 1,
  east: 2,
  wait: 3,
};

export function weightOf(route: RailRoute, plan: GwPlan | null): number {
  return route.w[PLAN_INDEX[plan ?? "none"]];
}

/** Who has the trains running: public mobilisation 1 or 2, in order. */
export function running(
  seat: GwSeatView,
): { row: RailRow; mob: number; from: string | null; full: string | null }[] {
  const out = [];
  for (const row of GW_RAILS) {
    const c = seat.world.countries.find((x) => x.tag === row.tag);
    const mob = c?.mob ?? 0;
    if (mob > 0) {
      out.push({
        row,
        mob,
        from: c?.mobFrom ?? null,
        full: c?.mobFull ?? null,
      });
    }
  }
  return out;
}

// ---- The days ----

/** Whole days from one ISO date to another (b minus a). */
export function daysBetween(a: string, b: string): number {
  const t = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d) / 86400000;
  };
  return Math.round(t(b) - t(a));
}

interface Seen {
  mob: number;
  /** First date seen at level one, and at level two. */
  one: string;
  two: string | null;
}

/**
 * On which date each country began mobilising: the engine's stamp, or the
 * date in view while that is still to come, as it is in the chapter of the
 * order itself. A partial mobilisation counts as half-speed days, the general
 * order as whole days, so the clock a player reads is the one the order
 * started, and a resumed game reads the same clock.
 */
export class RailClock {
  private seen = new Map<GwTag, Seen>();
  private lastChapter = -1;

  /** Feed the newest view. */
  observe(data: GreatWarData, seat: GwSeatView): void {
    if (data.chapter < this.lastChapter) this.seen.clear();
    this.lastChapter = data.chapter;
    for (const { row, mob, from, full } of running(seat)) {
      const two = mob >= 2 ? (full ?? data.date) : null;
      let s = this.seen.get(row.tag);
      if (s === undefined) {
        s = { mob, one: from ?? data.date, two };
        this.seen.set(row.tag, s);
      } else {
        s.two ??= two;
      }
      s.mob = mob;
    }
  }

  /** Days of the timetable run so far, at `date` (fractions allowed). */
  elapsed(tag: GwTag, date: string): number {
    const s = this.seen.get(tag);
    if (s === undefined) return 0;
    if (s.two === null) return daysBetween(s.one, date) / 2;
    return daysBetween(s.one, s.two) / 2 + daysBetween(s.two, date);
  }
}

/** Days past the last train after which the roads and the card leave the map. */
export const RAIL_LINGER_DAYS = 14;

/** The one clock the map's trains and the card beside them both read. */
export const railClock = new RailClock();

/** The days a country's timetable has run, as a share of its whole: 0..1. */
export function share(elapsed: number, row: RailRow): number {
  return Math.max(0, Math.min(1, elapsed / row.days));
}

// ---- The roads ----

export interface Path {
  /** World points along the road, tile coordinates. */
  readonly pts: readonly (readonly [number, number])[];
  /** Which segments are the sea (drawn dashed): index of the segment's end point. */
  readonly sea: ReadonlySet<number>;
  /** Total length, tiles. */
  readonly length: number;
  /** Length up to each point. */
  readonly at: readonly number[];
}

function centerOf(
  s: ScenarioIndex,
  stop: Stop,
): { id: number; xy: [number, number] } | null {
  const id = "place" in stop ? GW_PLACES[stop.place].id : stop.region;
  const r = s.region(id);
  if (r?.center !== undefined) return { id, xy: [r.center[0], r.center[1]] };
  if ("place" in stop) {
    const c = GW_PLACES[stop.place].center;
    return { id, xy: [c[0], c[1]] };
  }
  return null;
}

const dist = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1]);

/**
 * The cheapest way between two regions over the map's neighbours, a good rail
 * line (4) costing a fifth of a track (0). Null when there is no way (the sea).
 */
export function railWay(
  s: ScenarioIndex,
  from: number,
  to: number,
): number[] | null {
  if (from === to) return [from];
  const best = new Map<number, number>([[from, 0]]);
  const prev = new Map<number, number>();
  // A small open list is plenty: the ways are a few dozen regions.
  const open: [number, number][] = [[0, from]];
  const done = new Set<number>();
  while (open.length > 0) {
    let k = 0;
    for (let i = 1; i < open.length; i++) if (open[i][0] < open[k][0]) k = i;
    const [cost, id] = open.splice(k, 1)[0];
    if (done.has(id)) continue;
    done.add(id);
    if (id === to) break;
    const a = s.region(id);
    if (a === undefined) continue;
    for (const nb of s.regionNeighbours(id)) {
      if (done.has(nb)) continue;
      const b = s.region(nb);
      if (b === undefined) continue;
      if (a.center === undefined || b.center === undefined) continue;
      const step = dist(a.center, b.center) / (1 + Math.min(4, b.rail ?? 0));
      const c = cost + step;
      if (c < (best.get(nb) ?? Infinity)) {
        best.set(nb, c);
        prev.set(nb, id);
        open.push([c, nb]);
      }
    }
  }
  if (!done.has(to)) return null;
  const way: number[] = [to];
  while (way[0] !== from) way.unshift(prev.get(way[0])!);
  return way;
}

const pathCache = new WeakMap<ScenarioIndex, Map<string, Path>>();

/** A route as points on the map. */
export function pathOf(s: ScenarioIndex, route: RailRoute): Path {
  let m = pathCache.get(s);
  if (m === undefined) {
    m = new Map();
    pathCache.set(s, m);
  }
  const hit = m.get(route.id);
  if (hit !== undefined) return hit;
  const pts: [number, number][] = [];
  const sea = new Set<number>();
  let last: { id: number; xy: [number, number] } | null = null;
  for (const stop of route.stops) {
    const here = centerOf(s, stop);
    if (here === null) continue;
    if (last === null) {
      pts.push(here.xy);
    } else {
      const way =
        "sea" in stop && stop.sea === true
          ? null
          : railWay(s, last.id, here.id);
      if (way === null) {
        // No road: the sea, or a gap in the map. A straight dashed hop.
        sea.add(pts.length);
        pts.push(here.xy);
      } else {
        for (const id of way.slice(1)) {
          const r = s.region(id);
          if (r?.center !== undefined) pts.push([r.center[0], r.center[1]]);
        }
      }
    }
    last = here;
  }
  const at: number[] = [0];
  for (let i = 1; i < pts.length; i++)
    at.push(at[i - 1] + dist(pts[i - 1], pts[i]));
  const path: Path = { pts, sea, length: at[at.length - 1] ?? 0, at };
  m.set(route.id, path);
  return path;
}

/** The point `share` of the way along a path. */
export function pointAt(path: Path, t: number): [number, number] {
  const d = Math.max(0, Math.min(1, t)) * path.length;
  for (let i = 1; i < path.pts.length; i++) {
    if (d <= path.at[i]) {
      const seg = path.at[i] - path.at[i - 1] || 1;
      const f = (d - path.at[i - 1]) / seg;
      const a = path.pts[i - 1];
      const b = path.pts[i];
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    }
  }
  const e = path.pts[path.pts.length - 1];
  return [e[0], e[1]];
}
