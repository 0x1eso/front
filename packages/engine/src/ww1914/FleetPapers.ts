// Great War 1914 (ww221 §4, lane A): the Admiralty's papers. A seat's fleet
// moves or sorties only when the ruler signs one. The ruler asks (orders
// move_fleet, sortie_fleet); the Admiralty brings papers of its own (the 해군
// department's course, shipping losses, a lost home sea, the straits). The
// navy office holder speaks for each paper in words, by his temperament; for
// Britain the First Sea Lord's word comes first. Signing a paper he is against
// overrules him. Nothing moves by itself: an unsigned paper lapses.
// Fleet state and the moves themselves are Fleets.ts (lane F).
import {
  GW_SEA_ZONES,
  type GwSeaZone,
  type GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwFleetMoment,
  GwFleetPaperKind,
  GwFleetPaperView,
  GwFleetPaperWhy,
  GwFleetVoice,
  GwSortiePick,
} from "@openfront/engine-api/ww1914/GwFleetPapers";
import { GW_SORTIE_PICKS } from "@openfront/engine-api/ww1914/GwFleetPapers";
import {
  GW_SEA_AREAS,
  type GwFleet,
  type GwFleetMission,
  type GwSeaArea,
  type GwSeaFight,
} from "@openfront/engine-api/ww1914/GwFleets";
import type { GwOrderBlock } from "@openfront/engine-api/ww1914/GwOrders";
import type { GwWorldCond } from "@openfront/engine-api/ww1914/WorldDsl";
import {
  detachSquadron,
  fleetMoveBlock,
  fleetMoves,
  fleetOf,
  fleetsOf,
  idleMonths,
  orderSortie,
  sendFleet,
  setMission,
  sortieWarned,
} from "./Fleets";
import type { GreatWar } from "./GreatWar";
import { officeHolder } from "./People";
import { seaHold } from "./Seas";
import { defOf, fights, monthsOf, reason } from "./World";

/** Chapters the ruler's ask stands (as the chief's move_band). */
const ASK_CHAPTERS = 1;
/** Chapters a 해군 department course still brings its paper. */
const DEPT_CHAPTERS = 2;
/** Shipping lost from which the Admiralty wants cruisers in the Atlantic. */
const SHIPPING_AT = 6;
/** Believed ratio below which a sortie looks too dangerous to him. */
const SORTIE_RATIO = 0.8;
/** Months in port that make the diary's "six months in port". */
const IDLE_MONTHS = 6;

type FleetCond<K extends string> = Extract<GwWorldCond, { is: K }>;

// ---- Who speaks ----

interface Admiral {
  who: string | null;
  bold: boolean;
  stubborn: boolean;
  anxious: boolean;
}

/** The navy office holder; for Britain the First Sea Lord first. */
function admiralOf(gw: GreatWar, seat: GwSeatState): Admiral {
  const p =
    (seat.tag === "GBR" ? officeHolder(gw, seat, "sea_lord") : null) ??
    officeHolder(gw, seat, "navy");
  const camps = p === null ? [] : (defOf(p.id)?.camps ?? []);
  return {
    who: p?.id ?? null,
    bold:
      p !== null && (p.temperament === "arrogant" || camps.includes("hard")),
    stubborn:
      p !== null && (p.temperament === "stubborn" || p.temperament === "cold"),
    anxious:
      p !== null && (p.temperament === "anxious" || p.temperament === "weary"),
  };
}

// ---- The sea as the Admiralty reads it ----

/** A fleet's home sea, from its id `<tag>_<kind>_<home area>`. */
export function homeOf(f: GwFleet): GwSeaArea {
  const home = f.id.split("_").slice(2).join("_");
  return (GW_SEA_AREAS as readonly string[]).includes(home)
    ? (home as GwSeaArea)
    : f.area;
}

function sideOfTag(gw: GreatWar, tag: GwTag) {
  const n = gw.nation(tag);
  return fights(n) ? (n?.side ?? null) : null;
}

function foes(gw: GreatWar, a: GwTag, b: GwTag): boolean {
  const sa = sideOfTag(gw, a);
  const sb = sideOfTag(gw, b);
  return sa !== null && sb !== null && sa !== sb;
}

/**
 * The foe's battle ships in an area as the world believes them (`known`: the
 * building programmes are public, losses hide). Never the truth.
 */
function foeKnown(gw: GreatWar, tag: GwTag, area: GwSeaArea): number {
  return (gw.s.fleets ?? [])
    .filter(
      (f) => f.kind === "battle" && f.area === area && foes(gw, tag, f.tag),
    )
    .reduce((a, f) => a + f.known, 0);
}

/** The seat's biggest battle fleet with ships, or null. */
function mainFleet(gw: GreatWar, tag: GwTag): GwFleet | null {
  return (
    fleetsOf(gw, tag)
      .filter((f) => f.kind === "battle" && f.ships > 0)
      .sort((a, b) => b.ships - a.ships || a.id.localeCompare(b.id))[0] ?? null
  );
}

/** Whether another battle fleet of ours still lies in `home`. */
function homeKeptBy(gw: GreatWar, f: GwFleet, home: GwSeaArea): boolean {
  return fleetsOf(gw, f.tag).some(
    (x) =>
      x.id !== f.id &&
      x.kind === "battle" &&
      x.ships > 0 &&
      x.area === home &&
      x.to === undefined,
  );
}

function asZone(a: GwSeaArea): GwSeaZone | null {
  return (GW_SEA_ZONES as readonly string[]).includes(a)
    ? (a as GwSeaZone)
    : null;
}

/** The home sea is held against the fleet's side. */
function homeLost(gw: GreatWar, f: GwFleet): boolean {
  const z = asZone(homeOf(f));
  if (z === null) return false;
  const hold = seaHold(gw, z);
  const mine = sideOfTag(gw, f.tag);
  return hold !== null && mine !== null && hold !== mine;
}

function straitsOpen(gw: GreatWar): boolean {
  return gw.s.theatres.some((t) => t.id === "straits" && t.open);
}

function remembers(gw: GreatWar, seat: GwSeatState, key: string): boolean {
  const c = gw.s.chapter;
  return seat.memory.some(
    (m) => m.key === key && c - m.chapter < DEPT_CHAPTERS,
  );
}

// ---- The papers ----

interface Draft {
  kind: GwFleetPaperKind;
  fleet: GwFleet;
  why: GwFleetPaperWhy;
  to?: GwSeaArea;
  mission?: GwFleetMission;
  /** ww222 HM: a squadron of this many older battleships, not the fleet. */
  squadron?: number;
}

/**
 * ww222 HM: the squadron of older battleships the Admiralty would send to the
 * straits from a battle fleet that holds a home sea: a fifth of it, 2 to 4
 * ships; 0 when it is too small to spare any.
 */
const SQUADRON_MAX = 4;
const SQUADRON_FROM = 8;
function squadronOf(f: GwFleet): number {
  if (f.ships < SQUADRON_FROM) return 0;
  return Math.min(SQUADRON_MAX, Math.max(2, Math.floor(f.ships / 5)));
}

/** A battle fleet in its own northern home sea holds it: it never goes. */
function holdsHome(f: GwFleet): boolean {
  return f.area === homeOf(f) && f.area !== "med" && f.area !== "black";
}

/** The straits draft for fleet `f`: the fleet, or a squadron from it. */
function straitsDraft(f: GwFleet, why: GwFleetPaperWhy): Draft | null {
  if (!holdsHome(f)) {
    return { kind: "move", fleet: f, why, to: "med", mission: "invasion_support" };
  }
  const n = squadronOf(f);
  if (n === 0) return null;
  return {
    kind: "move",
    fleet: f,
    why,
    to: "med",
    mission: "invasion_support",
    squadron: n,
  };
}

/** His word on a move: thinning the home sea, leaving port, or gladly. */
function moveVoice(
  gw: GreatWar,
  ad: Admiral,
  d: Draft,
): { voice: GwFleetVoice; objects: boolean } {
  const f = d.fleet;
  const home = homeOf(f);
  const to = d.to!;
  if (f.kind === "battle" && to !== home) {
    const thins = f.area === home && !homeKeptBy(gw, f, home);
    if (ad.bold && (to === "med" || to === "black" || d.why === "straits")) {
      return { voice: "eager", objects: false };
    }
    if (ad.anxious && f.port) return { voice: "keep_port", objects: true };
    if (thins && (ad.stubborn || !ad.bold)) {
      return { voice: "thin_home", objects: true };
    }
  }
  return { voice: "agrees", objects: false };
}

/** His word on a sortie: the yards, port, a stronger foe, or gladly. */
function sortieVoice(
  gw: GreatWar,
  ad: Admiral,
  f: GwFleet,
): { voice: GwFleetVoice; objects: boolean } {
  if (f.wear >= 4) return { voice: "repair", objects: true };
  const foe = foeKnown(gw, f.tag, f.area);
  const ratio = foe === 0 ? 9 : f.ships / foe;
  if (ad.anxious) return { voice: "keep_port", objects: true };
  if (ratio < SORTIE_RATIO && !ad.bold) {
    return { voice: "too_strong", objects: true };
  }
  if (ad.bold) return { voice: "eager", objects: false };
  return { voice: "agrees", objects: false };
}

function paperOf(
  gw: GreatWar,
  seat: GwSeatState,
  ad: Admiral,
  d: Draft,
): GwFleetPaperView {
  const f = d.fleet;
  const sq = d.squadron !== undefined;
  const base = {
    id: sq ? `squadron_${f.id}` : `${d.kind}_${f.id}`,
    kind: d.kind,
    fleet: f.id,
    fleetKind: f.kind,
    ships: d.squadron ?? f.ships,
    ...(sq ? { squadron: true } : {}),
    area: f.area,
    why: d.why,
    by: ad.who,
    ...(d.mission === undefined ? {} : { mission: d.mission }),
  };
  if (d.kind === "move") {
    const move = fleetMoves(gw, f).find((m) => m.to === d.to);
    const block = fleetMoveBlock(gw, f, d.to!);
    // A squadron of old ships leaves the home sea held: he only says so.
    const v: { voice: GwFleetVoice; objects: boolean } = sq
      ? { voice: ad.bold ? "eager" : "agrees", objects: false }
      : moveVoice(gw, ad, d);
    return {
      ...base,
      to: d.to,
      eta: move?.eta ?? 1,
      ...v,
      warned: false,
      open: block === null,
      block,
    };
  }
  if (d.kind === "sortie") {
    const v = sortieVoice(gw, ad, f);
    const block = f.to !== undefined ? "fleet_moving" : null;
    const repair = f.wear >= 4 ? "fleet_repair" : null;
    return {
      ...base,
      picks: GW_SORTIE_PICKS,
      ...v,
      warned: sortieWarned(gw, seat.tag),
      open: (block ?? repair) === null,
      block: block ?? repair,
    };
  }
  return {
    ...base,
    voice: "agrees",
    objects: false,
    warned: false,
    open: f.to === undefined,
    block: f.to === undefined ? null : "fleet_moving",
  };
}

/** The asks still standing. */
function asksOf(gw: GreatWar, seat: GwSeatState) {
  return (seat.fleetAsks ?? []).filter(
    (a) => gw.s.chapter - a.chapter <= ASK_CHAPTERS,
  );
}

/** Where the department's "send" course would have the main fleet go. */
function sendTarget(gw: GreatWar, f: GwFleet): Draft | null {
  const home = homeOf(f);
  const side = sideOfTag(gw, f.tag);
  if (side === "entente" && straitsOpen(gw) && f.area !== "med") {
    const d = straitsDraft(f, "dept");
    if (d !== null) return d;
  }
  if (f.area !== home) return { kind: "move", fleet: f, why: "dept", to: home };
  const away = GW_SEA_AREAS.find(
    (a) =>
      a !== f.area &&
      foeKnown(gw, f.tag, a) > 0 &&
      foeKnown(gw, f.tag, a) < f.ships,
  );
  return away === undefined
    ? null
    : { kind: "move", fleet: f, why: "dept", to: away };
}

/** The Admiralty's own papers this chapter. */
function ownDrafts(gw: GreatWar, seat: GwSeatState): Draft[] {
  const out: Draft[] = [];
  const main = mainFleet(gw, seat.tag);
  const side = sideOfTag(gw, seat.tag);
  if (main !== null && remembers(gw, seat, "c_fleet_send")) {
    const d = sendTarget(gw, main);
    if (d !== null) out.push(d);
  }
  if (main !== null && remembers(gw, seat, "c_fleet_sortie")) {
    out.push({ kind: "sortie", fleet: main, why: "dept" });
  }
  // Cruisers to the Atlantic, on escort, when the boats sink too much.
  if (side === "entente" && gw.s.shipping >= SHIPPING_AT) {
    const cr = fleetsOf(gw, seat.tag)
      .filter(
        (f) =>
          f.kind === "cruisers" &&
          f.ships > 0 &&
          f.area !== "atlantic" &&
          f.to !== "atlantic",
      )
      .sort((a, b) => b.ships - a.ships)[0];
    if (cr !== undefined) {
      out.push({
        kind: "move",
        fleet: cr,
        why: "shipping",
        to: "atlantic",
        mission: "escort",
      });
    }
  }
  // A battle fleet away while its home sea is lost: home.
  for (const f of fleetsOf(gw, seat.tag)) {
    if (f.kind !== "battle" || f.ships === 0 || f.to !== undefined) continue;
    const home = homeOf(f);
    if (f.area !== home && homeLost(gw, f)) {
      out.push({ kind: "move", fleet: f, why: "home_lost", to: home });
    }
  }
  // The straits front open: support for the landing.
  if (side === "entente" && straitsOpen(gw) && main !== null) {
    if (main.area === "med") {
      if (main.mission !== "invasion_support") {
        out.push({
          kind: "mission",
          fleet: main,
          why: "straits",
          mission: "invasion_support",
        });
      }
    } else {
      // ww222 HM: the battle fleet that holds the North Sea stays; the
      // paper sends a squadron of older battleships from it.
      const d = straitsDraft(main, "straits");
      if (d !== null) out.push(d);
    }
  }
  return out;
}

/**
 * The Admiralty's papers for this chapter (ww221 §4): the ruler's asks first,
 * then its own; one paper per id, none already signed this chapter.
 */
export function fleetPapersFor(
  gw: GreatWar,
  seat: GwSeatState,
): GwFleetPaperView[] {
  if ((gw.s.fleets ?? []).length === 0) return [];
  if (!fights(gw.nation(seat.tag))) return [];
  const done =
    seat.fleetDone?.chapter === gw.s.chapter ? seat.fleetDone.ids : [];
  const drafts: Draft[] = [];
  for (const a of asksOf(gw, seat)) {
    const f = fleetOf(gw, a.fleet);
    if (f === null || f.tag !== seat.tag) continue;
    drafts.push(
      a.to === undefined
        ? { kind: "sortie", fleet: f, why: "asked" }
        : { kind: "move", fleet: f, why: "asked", to: a.to },
    );
  }
  drafts.push(...ownDrafts(gw, seat));
  const ad = admiralOf(gw, seat);
  const out: GwFleetPaperView[] = [];
  for (const d of drafts) {
    const p = paperOf(gw, seat, ad, d);
    if (done.includes(p.id) || out.some((x) => x.id === p.id)) continue;
    // A fleet already out on a sortie needs no second paper for it.
    if (d.kind === "sortie" && d.fleet.mission === "strike") continue;
    if (d.kind === "move" && d.fleet.area === d.to && !d.fleet.port) continue;
    out.push(p);
  }
  return out;
}

// ---- Orders ----

function ownFleet(gw: GreatWar, seat: GwSeatState, id: string): GwFleet | null {
  const f = fleetOf(gw, id);
  return f !== null && f.tag === seat.tag ? f : null;
}

function putAsk(
  seat: GwSeatState,
  fleet: string,
  to: GwSeaArea | undefined,
  chapter: number,
): void {
  const list = (seat.fleetAsks ?? []).filter((a) => a.fleet !== fleet);
  list.push({ fleet, ...(to === undefined ? {} : { to }), chapter });
  seat.fleetAsks = list;
}

/** The order move_fleet: the ruler asks the Admiralty to send a fleet. */
export function moveFleetOrder(
  gw: GreatWar,
  seat: GwSeatState,
  fleet: string,
  to: GwSeaArea,
): GwOrderBlock | null {
  const f = ownFleet(gw, seat, fleet);
  if (f === null) return "no_fleet";
  const no = fleetMoveBlock(gw, f, to);
  if (no !== null) return no;
  if (f.area === to && !f.port) return "no_fleet";
  putAsk(seat, fleet, to, gw.s.chapter);
  return null;
}

/** The order sortie_fleet: the Admiralty draws up a sortie paper. */
export function sortieFleetOrder(
  gw: GreatWar,
  seat: GwSeatState,
  fleet: string,
): GwOrderBlock | null {
  const f = ownFleet(gw, seat, fleet);
  if (f === null || f.kind === "subs" || f.ships === 0) return "no_fleet";
  if (f.to !== undefined) return "fleet_moving";
  if (f.wear >= 4) return "fleet_repair";
  putAsk(seat, fleet, undefined, gw.s.chapter);
  return null;
}

/** The order fleet_paper: an Admiralty paper signed. */
export function signFleetPaper(
  gw: GreatWar,
  seat: GwSeatState,
  id: string,
  pick: GwSortiePick | undefined,
): GwOrderBlock | null {
  const p = fleetPapersFor(gw, seat).find((x) => x.id === id);
  if (p === undefined) return "not_proposed";
  if (!p.open) return p.block ?? "closed";
  if (p.kind === "sortie") {
    if (pick === undefined || !(p.picks ?? []).includes(pick))
      return "bad_pick";
    if (!orderSortie(gw, p.fleet, pick)) return "closed";
    reason(gw, seat, pick === "stay" ? "fleet_kept" : "fleet_sortie_signed");
  } else if (p.kind === "move") {
    const sent =
      p.squadron === true
        ? detachSquadron(gw, p.fleet, p.ships, p.to!)
        : sendFleet(gw, p.fleet, p.to!)
          ? p.fleet
          : null;
    if (sent === null) return "closed";
    // The duty it takes up on arrival (setMission refuses a fleet under way).
    const f = fleetOf(gw, sent);
    if (p.mission !== undefined && p.mission !== "strike" && f !== null) {
      f.mission = p.mission;
    }
    reason(gw, seat, "fleet_move_signed");
  } else {
    if (!setMission(gw, p.fleet, p.mission!)) return "closed";
    reason(gw, seat, "fleet_mission_signed");
  }
  seat.fleetAsks = (seat.fleetAsks ?? []).filter((a) => a.fleet !== p.fleet);
  if (seat.fleetAsks.length === 0) delete seat.fleetAsks;
  const c = gw.s.chapter;
  const ids = seat.fleetDone?.chapter === c ? seat.fleetDone.ids : [];
  seat.fleetDone = { chapter: c, ids: [...ids, p.id] };
  const overrules = p.objects && !(p.kind === "sortie" && pick === "stay");
  if (overrules && p.by !== null) {
    seat.memory.push({
      key: "dept_overruled",
      who: p.by,
      chapter: c,
      weight: -1,
    });
    reason(gw, seat, "fleet_overruled", p.by);
  }
  return null;
}

/** The effect fleet_sortie (a scene's order): the main battle fleet. */
export function sceneSortie(
  gw: GreatWar,
  seat: GwSeatState,
  way: GwSortiePick,
): void {
  const f = mainFleet(gw, seat.tag);
  if (f !== null) orderSortie(gw, f.id, way);
}

// ---- Conds and the diary ----

function mineOf(f: GwSeaFight, tag: GwTag): GwSeaFight["result"] {
  if (f.by === tag) return f.result;
  return f.result === "won" ? "lost" : f.result === "lost" ? "won" : "even";
}

/** The fights the seat's country was in, the last `within` chapters. */
function fightsOf(gw: GreatWar, tag: GwTag, within: number): GwSeaFight[] {
  const c = gw.s.chapter;
  return (gw.s.seaFights ?? []).filter(
    (f) => (f.by === tag || f.foe === tag) && c - f.chapter <= within,
  );
}

/** The cond fleet_battle. */
export function fleetBattleHolds(
  gw: GreatWar,
  seat: GwSeatState,
  c: FleetCond<"fleet_battle">,
): boolean {
  const within = c.within ?? 1;
  const list =
    c.any === true
      ? (gw.s.seaFights ?? []).filter((f) => gw.s.chapter - f.chapter <= within)
      : fightsOf(gw, seat.tag, within);
  return list.some(
    (f) =>
      (c.area === undefined || f.area === c.area) &&
      (c.min !== "big" || f.size === "big") &&
      (c.result === undefined || mineOf(f, seat.tag) === c.result) &&
      (c.warned === undefined || f.warned === c.warned),
  );
}

/** The cond fleet_idle. */
export function fleetIdleHolds(
  gw: GreatWar,
  seat: GwSeatState,
  c: FleetCond<"fleet_idle">,
): boolean {
  return idleMonths(gw, seat.tag) >= c.months;
}

/** What the seat's country's fleets did this chapter, heaviest first. */
export function fleetMoments(gw: GreatWar, tag: GwTag): GwFleetMoment[] {
  const out: GwFleetMoment[] = [];
  const now = fightsOf(gw, tag, 0);
  for (const f of now) {
    const r = mineOf(f, tag);
    if (!out.includes(r)) out.push(r);
  }
  const lost = now.reduce(
    (a, f) => a + (f.by === tag ? f.lost[0] : f.lost[1]),
    0,
  );
  const main = mainFleet(gw, tag);
  if (
    main !== null &&
    lost > 0 &&
    main.ships * 3 <= main.peak * 2 &&
    (main.ships + lost) * 3 > main.peak * 2
  ) {
    out.push("third_lost");
  }
  if (now.some((f) => f.foe === tag && !f.warned)) out.push("fooled");
  const idle = idleMonths(gw, tag);
  if (idle >= IDLE_MONTHS && idle - monthsOf(gw) < IDLE_MONTHS)
    out.push("idle");
  if (
    gw.s.news.some(
      (n) =>
        n.key === "fleet_built" && n.chapter === gw.s.chapter && n.a === tag,
    )
  ) {
    out.push("built");
  }
  const order: readonly GwFleetMoment[] = [
    "lost",
    "third_lost",
    "won",
    "fooled",
    "even",
    "built",
    "idle",
  ];
  return out.sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

/** The diary's weight of the heaviest fleet moment; 0 with none. */
export function fleetMomentWeight(gw: GreatWar, tag: GwTag): number {
  const first = fleetMoments(gw, tag)[0];
  if (first === undefined) return 0;
  const W: Readonly<Record<GwFleetMoment, number>> = {
    lost: 5,
    third_lost: 5,
    won: 5,
    fooled: 4,
    even: 4,
    built: 3,
    idle: 3,
  };
  return W[first];
}
