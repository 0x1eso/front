// Great War 1914 (ww221 §2, §4, §5): fleets as light state. Battle fleets,
// cruisers and boats as counts in seven sea areas. The sea front reads them
// (its band, the sortie and the battle), the blockade and the U-boats lean on
// them, they hold the seas, support the straits, build slowly and repair in
// port. The AI moves its own on what it believes, never on the truth.
import {
  GW_FRONT_START,
  GW_LINE_STEP,
  type GwNationState,
  type GwSide,
  type GwTheatreState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GW_TAGS, type GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  GW_SEA_AREAS,
  type GwFleet,
  type GwFleetBlock,
  type GwFleetKind,
  type GwFleetMission,
  type GwFleetMove,
  type GwSeaArea,
  type GwSeaFight,
  type GwSortieWay,
  type GwYard,
} from "@openfront/engine-api/ww1914/GwFleets";
import type { GwPlace } from "@openfront/engine-api/ww1914/GwPlaces";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { lineOff } from "./Budget";
import { warMonths } from "./Eras";
import {
  attacks,
  commandOf,
  move,
  orderBias,
  resultOf,
  ROLL_LOW,
  ROLL_SPAN,
  settle,
} from "./Fronts";
import type { GreatWar } from "./GreatWar";
import { hearsPutOut, listenedTo, sortieWarning } from "./NavalIntel";
import { membersOf } from "./Wars";
import {
  chapterOf,
  clampTo,
  fights,
  monthsFrom,
  monthsOf,
  news,
  other,
  ruledBySeat,
  seatsOf,
} from "./World";

const P_MEET = idHash("gw_fleet_meet");
const P_FIGHT = idHash("gw_fleet_fight");
const P_LOSS = idHash("gw_fleet_loss");
const P_WEAR = idHash("gw_fleet_wear");
const P_SORTIE = idHash("gw_fleet_sortie");
const P_MINES = idHash("gw_fleet_mines");

type Pt = readonly [number, number];

/** Where an area's tokens stand, GW_PLACES `center` units (M checks on the map). */
export const GW_SEA_ANCHORS: Readonly<Record<GwSeaArea, Pt>> = {
  north: [2015, 585],
  channel: [1985, 662],
  atlantic: [1890, 660],
  baltic: [2195, 570],
  med: [2120, 840],
  adriatic: [2190, 765],
  black: [2370, 760],
};

/** Home ports by country and area: the place a fleet in port lies at. */
export const GW_HOME_PORTS: Readonly<
  Partial<Record<GwTag, Partial<Record<GwSeaArea, GwPlace>>>>
> = {
  GBR: { north: "scapa_flow", channel: "portsmouth", atlantic: "glasgow" },
  DEU: { north: "hamburg", baltic: "danzig" },
  FRA: { channel: "calais", atlantic: "brest", med: "marseille" },
  RUS: { baltic: "petrograd", black: "sevastopol" },
  AUH: { adriatic: "pola" },
  ITA: { med: "rome", adriatic: "venice" },
  OTT: { black: "constantinople", med: "smyrna" },
  USA: { atlantic: "new_york" },
};

interface StartRow {
  tag: GwTag;
  kind: GwFleetKind;
  ships: number;
  area: GwSeaArea;
  port: boolean;
  mission: GwFleetMission;
}
const row = (
  tag: GwTag,
  kind: GwFleetKind,
  ships: number,
  area: GwSeaArea,
  port: boolean,
  mission: GwFleetMission = "patrol",
): StartRow => ({ tag, kind, ships, area, port, mission });

/** The fleets of June 1914 (lane M tunes; history is flavour). */
export const GW_FLEETS: readonly StartRow[] = [
  row("GBR", "battle", 22, "north", false),
  row("GBR", "cruisers", 6, "north", false),
  row("GBR", "cruisers", 6, "atlantic", false),
  row("GBR", "subs", 4, "channel", false),
  row("DEU", "battle", 15, "north", true),
  row("DEU", "cruisers", 3, "north", true),
  row("DEU", "cruisers", 5, "atlantic", false, "raid"),
  row("DEU", "cruisers", 2, "med", false, "raid"),
  row("DEU", "subs", 12, "north", false),
  row("FRA", "battle", 6, "med", false),
  row("AUH", "battle", 4, "adriatic", true),
  row("AUH", "subs", 4, "adriatic", false),
  row("ITA", "battle", 4, "med", true),
  row("RUS", "battle", 0, "baltic", true),
  row("RUS", "battle", 0, "black", true),
  row("OTT", "battle", 0, "black", true),
  row("USA", "battle", 10, "atlantic", true),
];

/**
 * Months between capital ships (and boats) at the norm (null: none built).
 * ww222 M: about history's pace, each ship two or three years on the slip:
 * Britain some ten more by 1916, America a few.
 */
export const GW_FLEET_ROWS: Readonly<
  Partial<
    Record<
      GwTag,
      { capMonths: number; subMonths: number | null; capTo: readonly string[] }
    >
  >
> = {
  GBR: { capMonths: 4, subMonths: 4, capTo: ["gbr_battle_north"] },
  DEU: { capMonths: 4, subMonths: 2, capTo: ["deu_battle_north"] },
  FRA: { capMonths: 8, subMonths: null, capTo: ["fra_battle_med"] },
  RUS: {
    capMonths: 6,
    subMonths: null,
    capTo: [
      "rus_battle_black",
      "rus_battle_baltic",
      "rus_battle_baltic",
      "rus_battle_black",
      "rus_battle_baltic",
      "rus_battle_baltic",
    ],
  },
  AUH: { capMonths: 9, subMonths: 6, capTo: ["auh_battle_adriatic"] },
  USA: { capMonths: 8, subMonths: null, capTo: ["usa_battle_atlantic"] },
};

/** Yard points a month at the norm; a ship takes its months x this. */
const PTS = 4;
/** A fleet at this wear can't sortie and repairs in port. */
export const REPAIR_AT = 4;
const WEAR_MAX = 8;
/** Capital ships a band of the sea front stands for. */
const SHIPS_PER_BAND = 5;
/** Fights kept for scenes. */
const FIGHTS_KEPT = 12;
/** Chapters until the world finds out what a fleet really lost. */
const LOSSES_FOUND = 6;
/** Percent a chapter that patrols out in one area meet. */
const MEET_BATTLE = 6;
const MEET_CRUISERS = 20;
/** Gunnery and shells by country, percent (the rest 95). */
const GUNNERY: Readonly<Partial<Record<GwTag, number>>> = {
  DEU: 108,
  GBR: 100,
  USA: 100,
  FRA: 97,
};
/** The sea front's areas: the North Sea and its ways out. */
const NORTH_GROUP: readonly GwSeaArea[] = ["north", "channel", "atlantic"];
/** Areas next door (1 chapter); every other move takes 2. */
const NEAR: Readonly<Record<GwSeaArea, readonly GwSeaArea[]>> = {
  north: ["channel", "baltic", "atlantic"],
  channel: ["north", "atlantic"],
  atlantic: ["channel", "north", "med"],
  baltic: ["north"],
  med: ["atlantic", "adriatic", "black"],
  adriatic: ["med"],
  black: ["med"],
};
/** The straits line at the Narrows (GW_LINES.straits): the way is open. */
const NARROWS = 2;

// ---- Reading the fleets ----

export const fleetsOn = (gw: GreatWar): boolean => gw.s.fleets !== undefined;

export function fleetOf(gw: GreatWar, id: string): GwFleet | null {
  return gw.s.fleets?.find((f) => f.id === id) ?? null;
}

export function fleetsOf(gw: GreatWar, tag: GwTag): GwFleet[] {
  return (gw.s.fleets ?? []).filter((f) => f.tag === tag);
}

const homeArea = (f: GwFleet): GwSeaArea =>
  f.id.slice(f.id.lastIndexOf("_") + 1) as GwSeaArea;

/** The home port a fleet lies at in its area, or null if it has none there. */
export function portOf(f: GwFleet): GwPlace | null {
  return GW_HOME_PORTS[f.tag]?.[f.area] ?? null;
}

/** The port it belongs to: in its area if it has one, else its home area's. */
export function homePortOf(f: GwFleet): GwPlace | null {
  return portOf(f) ?? GW_HOME_PORTS[f.tag]?.[homeArea(f)] ?? null;
}

/** At war with each other. */
export function foes(gw: GreatWar, a: GwTag, b: GwTag): boolean {
  return gw.nation(a)?.atWar.includes(b) === true;
}

const sideOf = (gw: GreatWar, tag: GwTag): GwSide | null => {
  const n = gw.nation(tag);
  return n === null || n.out ? null : n.side;
};

const settled = (f: GwFleet) => f.to === undefined;
const out = (f: GwFleet) => settled(f) && !f.port;

/** Capital ships of `side` in an area, out or in port (settled only). */
function battleIn(
  gw: GreatWar,
  area: GwSeaArea,
  side: GwSide,
  port: boolean,
): number {
  let k = 0;
  for (const f of gw.s.fleets ?? []) {
    if (f.kind !== "battle" || f.area !== area || !settled(f)) continue;
    if (f.port !== port || sideOf(gw, f.tag) !== side) continue;
    if (!fights(gw.nation(f.tag))) continue;
    k += f.ships;
  }
  return k;
}

/**
 * Who holds an area by its fleets (§2): the side with more capital ships out;
 * a fleet in port denies it to a weaker foe (nobody then). Undefined when no
 * side has a capital ship there, out or in port: the caller's old rule holds.
 */
export function fleetHold(
  gw: GreatWar,
  area: GwSeaArea,
): GwSide | null | undefined {
  if (!fleetsOn(gw)) return undefined;
  const c = battleIn(gw, area, "central", false);
  const e = battleIn(gw, area, "entente", false);
  const cp = battleIn(gw, area, "central", true);
  const ep = battleIn(gw, area, "entente", true);
  if (c + e + cp + ep === 0) return undefined;
  if (c > e) return ep > c ? null : "central";
  if (e > c) return cp > e ? null : "entente";
  if (c > 0) {
    // Equal out: in the Mediterranean the shipping decides (Seas.ts).
    if (area === "med") return gw.s.shipping >= 6 ? "central" : "entente";
    return null;
  }
  // Nobody out: home waters to the side whose fleet lies there alone.
  if (cp > 0 && ep === 0) return "central";
  if (ep > 0 && cp === 0) return "entente";
  return null;
}

/** Beyond this many map tiles from every anchor a zone is the open ocean. */
const OCEAN_PAST = 160;
/**
 * ww222 M: zones the nearest anchor puts in the wrong sea, by the map's name
 * (checked on the World1936 map): Biscay and the Irish Sea are the Atlantic,
 * the Ionian, the Aegean and the eastern basin the Mediterranean, and the
 * Skagerrak (where Jutland was fought) the North Sea.
 */
const ZONE_SEA: Readonly<Record<string, GwSeaArea>> = {
  "Bay of Biscay": "atlantic",
  "Irish Sea": "atlantic",
  "Ionian Sea": "med",
  "Aegean Sea": "med",
  "Eastern Mediterranean": "med",
  Skagerrak: "north",
};
const ZONE_AREAS = new WeakMap<object, Map<number, GwSeaArea>>();

/** The sea area a map sea zone belongs to: its nearest anchor, derived once. */
export function zoneArea(gw: GreatWar, z: number): GwSeaArea {
  let map = ZONE_AREAS.get(gw.scenario);
  if (map === undefined) {
    map = new Map();
    for (const zone of gw.scenario.data.seaZones) {
      const c = zone.center;
      let best: GwSeaArea = "atlantic";
      let bestD = OCEAN_PAST * OCEAN_PAST;
      if (c !== undefined) {
        for (const a of GW_SEA_AREAS) {
          const [x, y] = GW_SEA_ANCHORS[a];
          const d = (c[0] - x) * (c[0] - x) + (c[1] - y) * (c[1] - y);
          if (d < bestD) {
            bestD = d;
            best = a;
          }
        }
      }
      map.set(zone.id, ZONE_SEA[zone.name] ?? best);
    }
    ZONE_AREAS.set(gw.scenario, map);
  }
  return map.get(z) ?? "atlantic";
}

/** The band of the sea front a country's fleets make (§2). */
function seaBand(gw: GreatWar, tag: GwTag): number | null {
  const list = fleetsOf(gw, tag).filter((f) => f.kind === "battle");
  if (list.length === 0) return null;
  let home = 0;
  let far = 0;
  for (const f of list) {
    if (!settled(f)) continue;
    if (NORTH_GROUP.includes(f.area)) home += f.ships;
    else if ((f.area === "med" || f.area === "black") && f.ships > 0) far++;
  }
  const band = Math.ceil(home / SHIPS_PER_BAND);
  // Holding a far sea costs a band at home while the ships are away (§5.4).
  return clampTo(band - (far > 0 ? 1 : 0), 1, 5);
}

/** strength.sea follows the fleets: each sea front country's band. */
export function deriveSea(gw: GreatWar): void {
  if (!fleetsOn(gw)) return;
  for (const n of gw.s.nations) {
    if (n.strength.sea === undefined) continue;
    const band = seaBand(gw, n.tag);
    if (band === null) continue;
    n.strength.sea = band;
    n.base.sea = band;
  }
}

/** The entente's battle fleet lies in the North Sea (port or out). */
function grandFleetHome(gw: GreatWar): boolean {
  return (gw.s.fleets ?? []).some(
    (f) =>
      f.kind === "battle" &&
      f.ships > 0 &&
      f.area === "north" &&
      settled(f) &&
      sideOf(gw, f.tag) === "entente" &&
      fights(gw.nation(f.tag)),
  );
}

/** The entente's cruisers are out on their stations, north or atlantic. */
function cruisersOnStation(gw: GreatWar): boolean {
  return (gw.s.fleets ?? []).some(
    (f) =>
      f.kind === "cruisers" &&
      f.ships > 0 &&
      out(f) &&
      (f.area === "north" || f.area === "atlantic") &&
      sideOf(gw, f.tag) === "entente" &&
      fights(gw.nation(f.tag)),
  );
}

/**
 * Sea.blockadeStep (§2): whether the blockade can tighten (the battle fleet
 * in the north, cruisers on station) and whether it slips with no cruisers.
 * Without fleets in state: today's sea, tighten and never slip for want.
 */
export function blockadeHolds(gw: GreatWar): {
  tighten: boolean;
  slips: boolean;
} {
  if (!fleetsOn(gw)) return { tighten: true, slips: false };
  const cruisers = cruisersOnStation(gw);
  return { tighten: grandFleetHome(gw) && cruisers, slips: !cruisers };
}

/** Germany's boats at sea: 0 none, 1 few, 2 some, 3 many (§2). */
export function uboatScale(gw: GreatWar): number {
  if (!fleetsOn(gw)) return 2;
  let k = 0;
  for (const f of gw.s.fleets!) {
    if (f.kind === "subs" && f.tag === "DEU" && out(f)) k += f.ships;
  }
  if (k === 0) return 0;
  return k < 10 ? 1 : k < 25 ? 2 : 3;
}

/** Entente cruisers on escort in the atlantic save a sinking every 2 chapters. */
export function escortSaves(gw: GreatWar): number {
  if (gw.s.chapter % 2 !== 0) return 0;
  const on = (gw.s.fleets ?? []).some(
    (f) =>
      f.kind === "cruisers" &&
      f.ships > 0 &&
      out(f) &&
      f.area === "atlantic" &&
      f.mission === "escort" &&
      sideOf(gw, f.tag) === "entente",
  );
  return on ? 1 : 0;
}

/** Odds the entente's ships in the med add to an attack on the straits (§2). */
export function straitsSupport(gw: GreatWar, by: GwSide): number {
  if (by !== "entente") return 0;
  let k = 0;
  for (const f of supportFleets(gw)) k += f.ships;
  return Math.min(12, Math.floor(k / 3) * 4);
}

function supportFleets(gw: GreatWar): GwFleet[] {
  return (gw.s.fleets ?? []).filter(
    (f) =>
      f.kind === "battle" &&
      f.ships > 0 &&
      out(f) &&
      f.area === "med" &&
      f.mission === "invasion_support" &&
      sideOf(gw, f.tag) === "entente",
  );
}

/**
 * Fronts.judge, after an entente attack on the straits: the Narrows' mines.
 * One time in three a supporting fleet runs on them: old ships lost (wear 3),
 * and one time in four of those a capital ship too.
 */
export function straitsMines(gw: GreatWar, t: GwTheatreState): void {
  if (t.id !== "straits") return;
  const list = supportFleets(gw);
  if (list.length === 0) return;
  const s = gw.s;
  const r = wwRoll(s.seed, P_MINES, s.chapter) % 100;
  if (r >= 33) return;
  const f = list[0];
  f.wear = Math.min(WEAR_MAX, f.wear + 3);
  if (wwRoll(s.seed, P_MINES, s.chapter, 1) % 4 === 0) f.ships -= 1;
  news(gw, "straits_mines", f.tag);
}

/** Months the country's biggest battle fleet has lain in port (0 if out). */
export function idleMonths(gw: GreatWar, tag: GwTag): number {
  const list = fleetsOf(gw, tag).filter((f) => f.kind === "battle");
  if (list.length === 0) return 0;
  const f = list.reduce((a, b) => (b.ships > a.ships ? b : a));
  if (!f.port || !settled(f)) return 0;
  return Math.max(0, monthsFrom(gw, f.portSince ?? 0));
}

/** The latest fight in an area within `within` chapters, or null. */
export function lastFight(
  gw: GreatWar,
  area: GwSeaArea,
  within: number,
): GwSeaFight | null {
  const list = (gw.s.seaFights ?? []).filter(
    (x) => x.area === area && gw.s.chapter - x.chapter <= within,
  );
  return list[list.length - 1] ?? null;
}

/** The foe's chain or codes reach `tag`'s fleet: the admiral warns in words. */
export function sortieWarned(gw: GreatWar, tag: GwTag): boolean {
  const n = gw.nation(tag);
  if (n === null) return false;
  return n.atWar.some((foe) => listenedTo(gw, tag, foe));
}

// ---- Moves ----

/** Chapters to go from one area to another. */
export function etaBetween(tag: GwTag, from: GwSeaArea, to: GwSeaArea): number {
  if (from === to) return 0;
  // The Kiel canal: Germany's fleet passes north <-> baltic in one chapter;
  // anyone else goes round by the Sound.
  if (
    (from === "baltic" || to === "baltic") &&
    from !== "north" &&
    to !== "north"
  ) {
    return 2;
  }
  if (from === "baltic" || to === "baltic") return tag === "DEU" ? 1 : 2;
  return NEAR[from].includes(to) ? 1 : 2;
}

function straitsOpen(gw: GreatWar, tag: GwTag): boolean {
  const ott = gw.nation("OTT");
  if (ott === null || ott.out || tag === "OTT") return true;
  if (ott.side !== null && ott.side === sideOf(gw, tag)) return true;
  const t = gw.s.theatres.find((x) => x.id === "straits");
  const line =
    t === undefined || t.since === null ? GW_FRONT_START.straits : t.line;
  return line >= NARROWS;
}

/** A passage held against the fleet on the way (§2), or null. */
function passageShut(gw: GreatWar, f: GwFleet, to: GwSeaArea): boolean {
  const from = f.area;
  const side = sideOf(gw, f.tag);
  const foeSide = side === null ? null : other(side);
  const via = (a: GwSeaArea) => from === a || to === a;
  // The straits, both ways, unless held open or Turkey is a friend.
  if (via("black") && from !== to && !straitsOpen(gw, f.tag)) return true;
  // The Sound: Russia's Baltic fleet stays in while Germany fights it.
  if (f.tag === "RUS" && from === "baltic") {
    const deu = gw.nation("DEU");
    if (deu !== null && fights(deu) && foes(gw, "RUS", "DEU")) return true;
  }
  if (foeSide === null) return false;
  // Germany's surface ships can't pass to the ocean while the entente holds
  // the North Sea or the Channel; its boats always can.
  if (
    f.kind !== "subs" &&
    NORTH_GROUP.includes(from) &&
    from !== "atlantic" &&
    (to === "atlantic" || to === "med") &&
    side === "central"
  ) {
    const n = fleetHold(gw, "north");
    const c = fleetHold(gw, "channel");
    if (n === foeSide || c === foeSide) return true;
  }
  // Otranto: Austria stays in the Adriatic while the entente holds the med.
  if (from === "adriatic" && to !== "adriatic" && f.kind !== "subs") {
    if (fleetHold(gw, "med") === foeSide) return true;
  }
  return false;
}

/** Why a fleet can't go to `to` now, or null. */
export function fleetMoveBlock(
  gw: GreatWar,
  f: GwFleet,
  to: GwSeaArea,
): GwFleetBlock | null {
  if (!settled(f)) return "fleet_moving";
  if (f.wear >= REPAIR_AT) return "fleet_repair";
  if (passageShut(gw, f, to)) return "sea_shut";
  return null;
}

/** The other areas one of our fleets could go to. */
export function fleetMoves(gw: GreatWar, f: GwFleet): GwFleetMove[] {
  return GW_SEA_AREAS.filter((a) => a !== f.area).map((to) => {
    const why = fleetMoveBlock(gw, f, to);
    return { to, eta: etaBetween(f.tag, f.area, to), open: why === null, why };
  });
}

/** Leave port: the foe's chains may hear it go (port hides, §3). */
function putOut(gw: GreatWar, f: GwFleet): void {
  delete f.station;
  if (!f.port) return;
  f.port = false;
  f.outAt = gw.s.chapter;
  const i = gw.s.fleets!.indexOf(f);
  const n = gw.nation(f.tag);
  f.heardBy = (n?.atWar ?? []).filter((foe) => hearsPutOut(gw, foe, f.tag, i));
}

function toPort(gw: GreatWar, f: GwFleet): boolean {
  if (portOf(f) === null) return false;
  delete f.station;
  if (!f.port) f.portSince = gw.s.chapter;
  f.port = true;
  f.sortie = undefined;
  if (f.mission === "strike") f.mission = "patrol";
  return true;
}

/** A move ordered (a paper signed, or the AI): it leaves now. */
export function sendFleet(gw: GreatWar, id: string, to: GwSeaArea): boolean {
  const f = fleetOf(gw, id);
  if (f === null || to === f.area || fleetMoveBlock(gw, f, to) !== null) {
    return false;
  }
  putOut(gw, f);
  f.to = to;
  f.eta = gw.s.chapter + etaBetween(f.tag, f.area, to);
  f.sortie = undefined;
  if (f.mission === "strike" || f.mission === "invasion_support") {
    f.mission = "patrol";
  }
  return true;
}

/** Set a mission; a fleet in port puts out for it. */
export function setMission(
  gw: GreatWar,
  id: string,
  mission: GwFleetMission,
): boolean {
  const f = fleetOf(gw, id);
  if (f === null || !settled(f)) return false;
  if (mission === "strike") return orderSortie(gw, id, "full");
  putOut(gw, f);
  f.mission = mission;
  f.sortie = undefined;
  return true;
}

/** A sortie for this chapter's close (the fight shows next chapter), or "stay": into port. */
export function orderSortie(
  gw: GreatWar,
  id: string,
  way: GwSortieWay | "stay",
): boolean {
  const f = fleetOf(gw, id);
  if (f === null || !settled(f)) return false;
  if (way === "stay") return toPort(gw, f);
  if (f.kind === "subs" || f.wear >= REPAIR_AT || f.ships === 0) return false;
  putOut(gw, f);
  f.mission = "strike";
  f.sortie = way;
  return true;
}

// ---- Battles ----

interface Force {
  fleets: GwFleet[];
  tag: GwTag;
  side: GwSide | null;
}

/** Quarter ships: a capital ship 4, a cruiser 1. */
const weight = (f: GwFleet) =>
  f.kind === "battle" ? f.ships * 4 : f.kind === "cruisers" ? f.ships : 0;
const forceOf = (x: Force) => x.fleets.reduce((k, f) => k + weight(f), 0);
const capitals = (x: Force) =>
  x.fleets.reduce((k, f) => k + (f.kind === "battle" ? f.ships : 0), 0);

function leadOf(fleets: GwFleet[]): GwTag {
  return fleets.reduce((a, b) => (weight(b) > weight(a) ? b : a)).tag;
}

function seaTheatre(gw: GreatWar): GwTheatreState | null {
  const t = gw.s.theatres.find((x) => x.id === "sea");
  return t !== undefined && t.open ? t : null;
}

/** Ships lost, percent of a side's ships between lo and hi. */
function lossOf(
  gw: GreatWar,
  x: Force,
  lo: number,
  hi: number,
  min: number,
  key: number,
): number {
  const ships = x.fleets.reduce((k, f) => k + f.ships, 0);
  const pct =
    lo + (wwRoll(gw.s.seed, P_LOSS, gw.s.chapter, key) % (hi - lo + 1));
  return Math.min(ships, Math.max(min, Math.floor((ships * pct) / 100)));
}

/** A side's losses fall on its fleets by weight, capital ships first. */
function takeLosses(x: Force, lost: number): void {
  let left = lost;
  const list = [...x.fleets].sort(
    (a, b) => (a.kind === "battle" ? 0 : 1) - (b.kind === "battle" ? 0 : 1),
  );
  const all = list.reduce((k, f) => k + f.ships, 0);
  for (const f of list) {
    if (left <= 0) break;
    const share = Math.min(
      f.ships,
      left,
      Math.max(1, Math.round((lost * f.ships) / Math.max(1, all))),
    );
    f.ships -= share;
    left -= share;
  }
}

/**
 * A fight between two forces in an area (§4): odds from the truth, ships x
 * gunnery x the commander, less a warning; the roll; losses in ships; wear;
 * the loser to port. `part`: only a part drawn out, half losses.
 */
export function seaBattle(
  gw: GreatWar,
  area: GwSeaArea,
  a: Force,
  d: Force,
  part: boolean,
  bias = 0,
): "won" | "lost" | "even" {
  const s = gw.s;
  const t = seaTheatre(gw);
  const north = NORTH_GROUP.includes(area);
  const cmd = (x: Force) =>
    t !== null && north && x.side !== null ? commandOf(gw, t, x.side) : 100;
  const gun = (x: Force) => GUNNERY[x.tag] ?? 95;
  const warned =
    t !== null && north && a.side !== null ? sortieWarning(gw, t, a.side) : 0;
  const odds =
    Math.floor(
      (100 * forceOf(a) * gun(a) * cmd(a)) /
        Math.max(1, forceOf(d) * gun(d) * cmd(d)),
    ) -
    warned +
    bias;
  const key = GW_SEA_AREAS.indexOf(area);
  const roll = ROLL_LOW + (wwRoll(s.seed, P_FIGHT, s.chapter, key) % ROLL_SPAN);
  const r = resultOf(Math.floor((odds * roll) / 100), 0);
  const result: "won" | "lost" | "even" =
    r === "break" || r === "advance"
      ? "won"
      : r === "repelled"
        ? "lost"
        : "even";
  const [aLo, aHi, dLo, dHi] =
    result === "won"
      ? [5, 12, 10, 25]
      : result === "lost"
        ? [10, 25, 5, 12]
        : [8, 15, 8, 15];
  // The loser loses one at least; a full fight costs the winner one too.
  let lostA = lossOf(
    gw,
    a,
    aLo,
    aHi,
    result === "lost" || !part ? 1 : 0,
    key * 2,
  );
  let lostD = lossOf(
    gw,
    d,
    dLo,
    dHi,
    result === "won" || !part ? 1 : 0,
    key * 2 + 1,
  );
  if (part) {
    lostA = Math.floor(lostA / 2);
    lostD = Math.floor(lostD / 2);
  }
  const big =
    capitals(a) > 0 && capitals(d) > 0 && capitals(a) + capitals(d) >= 10;
  takeLosses(a, lostA);
  takeLosses(d, lostD);
  const loser = result === "won" ? d : result === "lost" ? a : null;
  for (const x of [a, d]) {
    const lose = loser === null || x === loser;
    for (const f of x.fleets) {
      const w =
        wwRoll(s.seed, P_WEAR, s.chapter, key, s.fleets!.indexOf(f)) % 3;
      f.wear = Math.min(WEAR_MAX, f.wear + (lose ? 3 : 2) + w);
      f.fought = s.chapter;
      // Seen by everyone now: a fight gives a fleet away.
      f.heardBy = [...GW_TAGS.filter((g) => foes(gw, g, f.tag))];
      const struck = f.mission === "strike";
      f.sortie = undefined;
      if (struck) f.mission = "patrol";
      if ((lose || f.wear >= REPAIR_AT) && toPort(gw, f) && !struck) {
        f.station = true;
      }
    }
  }
  s.seaFights ??= [];
  s.seaFights.push({
    chapter: s.chapter,
    area,
    by: a.tag,
    foe: d.tag,
    size: big ? "big" : "small",
    result,
    part,
    warned: warned > 0,
    lost: [lostA, lostD],
  });
  if (s.seaFights.length > FIGHTS_KEPT) {
    s.seaFights.splice(0, s.seaFights.length - FIGHTS_KEPT);
  }
  news(gw, `fleet_battle_${result}`, a.tag, d.tag);
  return result;
}

const fighting = (gw: GreatWar, f: GwFleet) =>
  f.ships > 0 && fights(gw.nation(f.tag)) && settled(f);

/** Everyone of `tag`'s side out in an area with surface ships. */
function forceIn(
  gw: GreatWar,
  area: GwSeaArea,
  side: GwSide | null,
  tag: GwTag,
  kinds: readonly GwFleetKind[],
  inPort = false,
): Force {
  const fleets = (gw.s.fleets ?? []).filter(
    (f) =>
      f.area === area &&
      fighting(gw, f) &&
      kinds.includes(f.kind) &&
      (inPort || !f.port) &&
      (f.tag === tag || (side !== null && sideOf(gw, f.tag) === side)),
  );
  return { fleets, tag: fleets.length > 0 ? leadOf(fleets) : tag, side };
}

/** A war order on the sea or a plan on it sends the side's fleet out. */
function ordered(gw: GreatWar, t: GwTheatreState, side: GwSide): boolean {
  return attacks(gw, t, side) || orderBias(gw, "sea", side) > 0;
}

/** The side's biggest battle fleet in the north group, ready to sortie. */
function mainFleet(gw: GreatWar, side: GwSide): GwFleet | null {
  let best: GwFleet | null = null;
  for (const f of gw.s.fleets ?? []) {
    if (
      f.kind !== "battle" ||
      !fighting(gw, f) ||
      !NORTH_GROUP.includes(f.area)
    ) {
      continue;
    }
    if (sideOf(gw, f.tag) !== side || f.wear >= REPAIR_AT) continue;
    if (best === null || f.ships > best.ships) best = f;
  }
  return best;
}

/**
 * Fronts.judge for the sea, with fleets in state (§4): a sortie (a fleet on
 * strike, a plan or a war order on the sea) meets the foe's battle fleet out
 * in its area; patrols out together now and then; else a quiet chapter. The
 * winner moves the sea line a step at most.
 */
export function seaJudge(gw: GreatWar, t: GwTheatreState): void {
  const s = gw.s;
  deriveSea(gw);
  let by: GwSide | null = null;
  let striker: GwFleet | null = null;
  for (const side of ["central", "entente"] as const) {
    let f =
      (s.fleets ?? []).find(
        (x) =>
          x.kind === "battle" &&
          x.mission === "strike" &&
          fighting(gw, x) &&
          NORTH_GROUP.includes(x.area) &&
          sideOf(gw, x.tag) === side,
      ) ?? null;
    if (f === null && ordered(gw, t, side)) {
      f = mainFleet(gw, side);
      if (f !== null) orderSortie(gw, f.id, "full");
    }
    if (f === null || f.mission !== "strike") continue;
    if (striker === null || f.ships > striker.ships) {
      striker = f;
      by = side;
    }
  }
  let part = striker?.sortie === "part";
  let area: GwSeaArea | null = striker?.area ?? null;
  if (striker === null) {
    // Patrols meet: both sides' battle fleets out in one area.
    for (const a of NORTH_GROUP) {
      const c = battleIn(gw, a, "central", false);
      const e = battleIn(gw, a, "entente", false);
      if (c === 0 || e === 0) continue;
      const r =
        wwRoll(s.seed, P_MEET, s.chapter, GW_SEA_AREAS.indexOf(a)) % 100;
      if (r >= MEET_BATTLE) continue;
      by = c >= e ? "central" : "entente";
      area = a;
      part = true;
      break;
    }
  }
  const lead = by === null ? undefined : membersOf(gw, "sea", by)[0];
  const atk =
    by === null || area === null || lead === undefined
      ? null
      : forceIn(gw, area, by, lead, ["battle", "cruisers"]);
  const foeLead = by === null ? undefined : membersOf(gw, "sea", other(by))[0];
  const def =
    by === null || area === null || foeLead === undefined
      ? null
      : forceIn(gw, area, other(by), foeLead, ["battle", "cruisers"]);
  if (
    by === null ||
    area === null ||
    atk === null ||
    def === null ||
    capitals(def) === 0 ||
    capitals(atk) === 0
  ) {
    // A sortie that finds nobody out: a raid on the coast, nothing more.
    clearStrikes(gw);
    s.battles.push({
      theatre: t.id,
      chapter: s.chapter,
      result: "quiet",
      by: null,
      lost: [0, 0],
      line: t.line,
      luck: 0,
    });
    return;
  }
  const result = seaBattle(gw, area, atk, def, part, orderBias(gw, "sea", by));
  const fight = s.seaFights![s.seaFights!.length - 1];
  const winner = result === "won" ? by : result === "lost" ? other(by) : null;
  const gain = part ? 1 : 2;
  if (winner !== null) move(gw, t, winner, Math.min(GW_LINE_STEP, gain));
  const grade =
    result === "won"
      ? part
        ? "advance"
        : "break"
      : result === "lost"
        ? "repelled"
        : "stalemate";
  const lost = by === "central" ? fight.lost : [fight.lost[1], fight.lost[0]];
  s.battles.push({
    theatre: t.id,
    chapter: s.chapter,
    result: grade,
    by,
    lost: [lost[0], lost[1]],
    line: t.line,
    luck: 0,
  });
  settle(gw, t, by, grade);
  clearStrikes(gw);
  deriveSea(gw);
}

function clearStrikes(gw: GreatWar): void {
  for (const f of gw.s.fleets ?? []) {
    if (f.mission !== "strike" || !NORTH_GROUP.includes(f.area)) continue;
    if (f.kind !== "battle") continue;
    f.mission = "patrol";
    f.sortie = undefined;
  }
}

/**
 * Fights outside the sea front's battle (§4): in every area, foes out
 * together, one on strike or patrols meeting now and then. In the North Sea
 * group, while the sea front is open, only cruisers meet here (Coronel, the
 * Falklands); its battle fleets are the front's.
 */
function areaFights(gw: GreatWar): void {
  const s = gw.s;
  const front = seaTheatre(gw) !== null;
  GW_SEA_AREAS.forEach((area, ai) => {
    const north = NORTH_GROUP.includes(area);
    const kinds: readonly GwFleetKind[] =
      north && front ? ["cruisers"] : ["battle", "cruisers"];
    const here = (s.fleets ?? []).filter(
      (f) =>
        f.area === area &&
        out(f) &&
        fighting(gw, f) &&
        kinds.includes(f.kind) &&
        f.fought !== s.chapter,
    );
    if (here.length < 2) return;
    const striker = here.find((f) => f.mission === "strike");
    const a0 = striker ?? here[0];
    const foe = here.find((f) => foes(gw, f.tag, a0.tag));
    if (foe === undefined) return;
    if (striker === undefined) {
      const battle = here.some((f) => f.kind === "battle");
      const pct = battle ? MEET_BATTLE : MEET_CRUISERS;
      if (wwRoll(s.seed, P_MEET, s.chapter, 100 + ai) % 100 >= pct) return;
    }
    const key = (f: GwFleet) => sideOf(gw, f.tag) ?? f.tag;
    const pick = (lead: GwFleet): Force => ({
      fleets: here.filter((f) => key(f) === key(lead)),
      tag: lead.tag,
      side: sideOf(gw, lead.tag),
    });
    const a = pick(a0);
    const d = pick(foe);
    if (forceOf(a) === 0 || forceOf(d) === 0) return;
    // Without a striker the stronger side is the one that presses.
    const swap = striker === undefined && forceOf(d) > forceOf(a);
    const part = striker === undefined || striker.sortie === "part";
    seaBattle(gw, area, swap ? d : a, swap ? a : d, part);
  });
  for (const f of s.fleets ?? []) {
    if (f.mission === "strike") {
      f.mission = "patrol";
      f.sortie = undefined;
    }
  }
}

// ---- Laying down, building, repair ----

const fleetId = (r: StartRow) => `${r.tag}_${r.kind}_${r.area}`.toLowerCase();

/** The fleets of June 1914, laid down at the first chapter step. */
export function layFleets(gw: GreatWar): void {
  if (fleetsOn(gw)) return;
  gw.s.fleets = GW_FLEETS.filter((r) => gw.nation(r.tag) !== null).map((r) => ({
    id: fleetId(r),
    tag: r.tag,
    kind: r.kind,
    ships: r.ships,
    wear: 0,
    area: r.area,
    port: r.port,
    mission: r.mission,
    peak: r.ships,
    known: r.ships,
    ...(r.port ? { portSince: gw.s.chapter } : {}),
  }));
  gw.s.yards = (Object.keys(GW_FLEET_ROWS) as GwTag[])
    .filter((tag) => gw.nation(tag) !== null)
    .map((tag) => ({ tag, cap: 0, subs: 0, built: 0 }));
}

function navalAccord(gw: GreatWar, tag: GwTag): boolean {
  return (gw.s.accords ?? []).some(
    (x) =>
      x.kind === "naval" &&
      x.offered !== true &&
      x.broken === null &&
      (x.a === tag || x.b === tag),
  );
}

/** The navy line's weight on the yards, and "more" in the 해군 peace answer. */
function yardRate(gw: GreatWar, n: GwNationState): number {
  const off = lineOff(n, n.budget.plan, "navy");
  let rate = off > 0 ? PTS * 2 : off < 0 ? PTS / 2 : PTS;
  const more = seatsOf(gw, n.tag).some((seat) =>
    seat.memory.some(
      (m) => m.key === "c_build_more" && gw.s.chapter - m.chapter <= 12,
    ),
  );
  if (more) rate += PTS;
  return rate;
}

function addShip(gw: GreatWar, id: string, k: number): void {
  const f = fleetOf(gw, id);
  if (f === null) return;
  f.ships += k;
  f.known += k;
  f.peak = Math.max(f.peak, f.ships);
}

/** The yards work by the chapter's days (§2). */
function buildStep(gw: GreatWar): void {
  const days = chapterOf(gw).spanDays;
  for (const y of gw.s.yards ?? []) {
    const n = gw.nation(y.tag);
    const r = GW_FLEET_ROWS[y.tag];
    if (n === null || n.out || r === undefined) continue;
    const pts = Math.floor((yardRate(gw, n) * days) / 30);
    // At war Germany's yards turn to U-boats after a year.
    const war = gw.s.warChapter !== null && fights(n);
    const capMonths =
      r.capMonths * (y.tag === "DEU" && war && warMonths(gw) >= 12 ? 3 : 1);
    if (!navalAccord(gw, y.tag)) {
      y.cap += pts;
      while (y.cap >= capMonths * PTS) {
        y.cap -= capMonths * PTS;
        buildCapital(gw, y, r.capTo);
      }
    }
    if (r.subMonths !== null) {
      y.subs += pts;
      while (y.subs >= r.subMonths * PTS) {
        y.subs -= r.subMonths * PTS;
        const subs = fleetsOf(gw, y.tag).find((f) => f.kind === "subs");
        if (subs !== undefined) addShip(gw, subs.id, 1);
      }
    }
  }
}

/** A yard's capital ships the news reports: the first, then one in this many. */
const NEWS_EVERY = 3;

function buildCapital(gw: GreatWar, y: GwYard, capTo: readonly string[]): void {
  const id = capTo[y.built % capTo.length];
  y.built++;
  if (fleetOf(gw, id) === null) return;
  addShip(gw, id, 1);
  // ww222 M: the papers mark the first ship and every third after it.
  if (y.built % NEWS_EVERY === 1) news(gw, "fleet_built", y.tag);
}

/** Repair in port, losses found out, moves arriving. */
function upkeep(gw: GreatWar): void {
  const s = gw.s;
  for (const f of s.fleets ?? []) {
    if (f.to !== undefined && f.eta !== undefined && f.eta <= s.chapter) {
      f.area = f.to;
      delete f.to;
      delete f.eta;
    }
    if (f.port && f.wear > 0) {
      f.wear--;
      // Repaired after a fight: back on its station, as it was.
      if (f.wear === 0 && f.station === true) putOut(gw, f);
    }
    if (
      f.known > f.ships &&
      (f.fought === undefined || s.chapter - f.fought >= LOSSES_FOUND)
    ) {
      f.known = f.ships;
    }
    if (f.known < f.ships) f.known = f.ships;
  }
}

/** The Goeben: Germany's Mediterranean cruisers become Turkey's battle fleet. */
function goeben(gw: GreatWar): void {
  const ott = gw.nation("OTT");
  const med = fleetOf(gw, "deu_cruisers_med");
  if (ott === null || ott.side !== "central" || !fights(ott)) return;
  if (med === null || med.ships === 0) return;
  med.ships = 0;
  med.known = 0;
  let f = fleetOf(gw, "ott_battle_black");
  if (f === null) {
    f = {
      id: "ott_battle_black",
      tag: "OTT",
      kind: "battle",
      ships: 0,
      wear: 0,
      area: "black",
      port: false,
      mission: "patrol",
      peak: 0,
      known: 0,
    };
    gw.s.fleets!.push(f);
  }
  f.ships += 1;
  f.known += 1;
  f.peak = Math.max(f.peak, f.ships);
  if (f.to === undefined) f.area = "black";
  f.port = false;
  news(gw, "goeben", "OTT", "DEU");
}

/** The battle fleet left the North Sea: raids and mines push the line up. */
function northDrift(gw: GreatWar): void {
  const t = seaTheatre(gw);
  if (t === null || t.since === null || gw.s.chapter % 2 !== 0) return;
  const gbr = gw.nation("GBR");
  if (gbr === null || !fights(gbr) || gbr.side !== "entente") return;
  if (grandFleetHome(gw)) return;
  move(gw, t, "central", GW_LINE_STEP);
}

// ---- The AI ----

/** What `viewer` believes the foe's capital ships in an area are. */
function believedFoe(gw: GreatWar, viewer: GwTag, area: GwSeaArea): number {
  let k = 0;
  for (const f of gw.s.fleets ?? []) {
    if (f.kind !== "battle" || !foes(gw, viewer, f.tag) || !settled(f))
      continue;
    if (f.area !== area) continue;
    k += f.known;
  }
  return k;
}

const SORTIE_PCT: Record<string, number> = {
  hardline: 30,
  opportunist: 20,
  cautious: 5,
  principled: 8,
};
/**
 * ww222 M: a month's chance in a thousand to seek battle anyway while the odds
 * are near (a ratio of 0.5 and up, Jutland's): a big North Sea battle in about half the
 * wars, not in most-none. It still comes only if the foe's fleet is out.
 */
const SORTIE_LONG: Record<string, number> = {
  hardline: 60,
  opportunist: 45,
  cautious: 20,
  principled: 25,
};
const LONG_RATIO = 50;

/** A country nobody plays (or a regent's) moves its fleets (§5). */
function aiFleetsOf(gw: GreatWar, n: GwNationState): void {
  const s = gw.s;
  const list = fleetsOf(gw, n.tag).filter((f) => f.ships > 0 && settled(f));
  const straits = s.theatres.find((t) => t.id === "straits");
  for (const f of list) {
    const i = s.fleets!.indexOf(f);
    if (f.wear >= REPAIR_AT) {
      toPort(gw, f);
      continue;
    }
    if (f.kind === "subs") {
      if (f.port) setMission(gw, f.id, "patrol");
      continue;
    }
    if (n.tag === "GBR") {
      const home = homeArea(f);
      if (f.kind === "battle" && f.area !== "north") {
        sendFleet(gw, f.id, "north");
      } else if (f.kind === "battle") {
        setMission(gw, f.id, "patrol");
      } else if (f.area !== home) {
        sendFleet(gw, f.id, home);
      } else {
        setMission(
          gw,
          f.id,
          f.area === "atlantic" && s.uboat >= 1 ? "escort" : "patrol",
        );
      }
      continue;
    }
    if (f.kind === "cruisers" && f.mission === "raid") {
      if (f.port) setMission(gw, f.id, "raid");
      continue;
    }
    const mine = f.ships;
    const theirs = believedFoe(gw, n.tag, f.area);
    if (
      f.kind === "battle" &&
      f.area === "med" &&
      n.side === "entente" &&
      straits !== undefined &&
      straits.open &&
      membersOf(gw, "straits", "entente").some((tag) => {
        const a = gw.nation(tag)?.alloc;
        return a?.main === "straits" && a.posture === "offensive";
      })
    ) {
      setMission(gw, f.id, "invasion_support");
      continue;
    }
    if (theirs === 0 || mine > theirs) {
      // Stronger in its own sea: out on patrol.
      setMission(gw, f.id, "patrol");
      continue;
    }
    // A fleet in being, until the odds or hunger send it out.
    toPort(gw, f);
    if (f.kind !== "battle") continue;
    const ratio = Math.floor((mine * 100) / Math.max(1, theirs));
    const r = wwRoll(s.seed, P_SORTIE, s.chapter, i) % 100;
    const hungry = s.blockade >= 6 && n.gauges.bread <= 1;
    if (f.wear > 0) continue;
    const long = wwRoll(s.seed, P_SORTIE, s.chapter, 1000 + i) % 1000;
    const longPct = (SORTIE_LONG[n.ai] ?? 20) * monthsOf(gw);
    if (
      (ratio >= 80 && r < (SORTIE_PCT[n.ai] ?? 8)) ||
      (ratio >= LONG_RATIO && long < longPct) ||
      (hungry && r < 25)
    ) {
      orderSortie(gw, f.id, "full");
    }
  }
  // Cruisers in the North Sea keep with the battle fleet.
  const battle = list.find((f) => f.kind === "battle" && f.area === "north");
  if (n.tag !== "GBR" && battle !== undefined) {
    for (const f of list) {
      if (f.kind !== "cruisers" || f.area !== "north" || f.mission === "raid")
        continue;
      if (battle.port) toPort(gw, f);
      else setMission(gw, f.id, "patrol");
    }
  }
}

/** Ai.aiStep, after aiTransfer: every fleet nobody plays. */
export function aiFleets(gw: GreatWar): void {
  if (!fleetsOn(gw) || gw.s.warChapter === null) return;
  for (const n of gw.s.nations) {
    if (!fights(n) || ruledBySeat(gw, n.tag)) continue;
    aiFleetsOf(gw, n);
  }
}

/**
 * Chapter step, from Sea.seaStep before its war gate: lay the fleets down,
 * build, repair, arrive; at war the Goeben, the other seas' fights and the
 * drift of an empty North Sea; then the sea front's band.
 */
export function fleetStep(gw: GreatWar): void {
  layFleets(gw);
  buildStep(gw);
  upkeep(gw);
  if (gw.s.warChapter !== null && gw.s.armistice === null) {
    goeben(gw);
    areaFights(gw);
    northDrift(gw);
  }
  deriveSea(gw);
}
