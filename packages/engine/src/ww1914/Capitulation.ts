// Great War 1914 (ww188): a beaten country leaves the war, and the fronts
// follow the land.
//
// - A capital in an enemy's hands is a great blow, not the end: the
//   government moves to a city it still holds (Bordeaux 1914, Niš 1914,
//   Iași 1916), or abroad once there is none (Corfu 1916, Le Havre 1914).
//   Morale and order fall. A seat is asked: sue for peace, or move the
//   government and fight on; a government nobody plays weighs the same
//   question by its state.
// - Each month a country at war may give up, by its state: the share of its
//   home places it still holds, its capital, morale and order, the army it
//   has left, and allies fighting on its own soil (longer, not for ever).
//   With almost nothing left and the capital gone it is certain. A seat gets
//   it as an ultimatum with no "fight on"; refusing it brings the government
//   down and the next one signs.
// - Giving up goes the old ways: a coalition member leaves the war (Peace.sue:
//   its last leader brings the armistice), a war of a pair's own ends in a
//   peace of the two with its table. Partners on its fronts hold there only
//   where they hold places; the rest go home and the front closes.
// - A front's line follows a capital the enemy holds past it: with Paris
//   held, the west stands at Paris.
import {
  GW_FRONT_UP,
  GW_LINES,
  GwGovSeat,
  GwSide,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  GW_PLACE_KEYS,
  GW_PLACES,
  GwPlace,
} from "@openfront/engine-api/ww1914/GwPlaces";
import {
  GW_CAP_FIGHT as CAP_FIGHT,
  GW_CAP_REFUSE as CAP_REFUSE,
  GW_CAP_SIGN as CAP_SIGN,
  GW_CAP_SUE as CAP_SUE,
  GW_CAPITAL_FELL,
  GW_CAPITAL_TAKEN,
  GW_CAPITULATION,
} from "@openfront/engine-lib/ww1914/content/capital";
import { frontPlaces } from "@openfront/engine-lib/ww1914/FrontLand";
import { GW_CAPITALS } from "@openfront/engine-lib/ww1914/PlaceRules";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import type { GreatWar } from "./GreatWar";
import { holderOf, reachedLine } from "./Land";
import {
  capitalHolder,
  hasLandGraph,
  landGraph,
  landLine,
  standsAgainst,
} from "./Occupation";
import { pairPeace } from "./PairWar";
import { sue } from "./Peace";
import { GW_MANPOWER } from "./Tables";
import { membersOf, refreshTheatres, sideIn } from "./Wars";
import {
  fights,
  isLongChapter,
  monthsFrom,
  moveGauge,
  news,
  ruledBySeat,
  seatsOf,
} from "./World";

const P_CAPITULATE = idHash("gw_capitulate");

/**
 * Where a government goes from its fallen capital, in order: the first it
 * still holds. The rest go to their largest home place still held.
 * Bordeaux (Sep 1914), Niš (Serbia's war capital 1914-15), Iași (Nov 1916),
 * Antwerp then Ostend (Belgium, Aug-Oct 1914), Moscow (Mar 1918) and
 * Salonika (Venizelos, 1916) are history; the rest are where it would go.
 */
const GOV_FLEES: Readonly<Partial<Record<GwTag, readonly GwPlace[]>>> = {
  FRA: ["bordeaux", "lyon", "marseille", "brest"],
  SRB: ["nis", "kragujevac", "skopje"],
  ROU: ["iasi"],
  BEL: ["antwerp", "ostend"],
  MNE: ["pec"],
  RUS: ["moscow", "kazan"],
  DEU: ["dresden", "munich"],
  AUH: ["budapest", "prague"],
  GBR: ["manchester", "glasgow"],
  OTT: ["ankara", "konya"],
  BGR: ["plovdiv"],
  GRC: ["salonika"],
};

/**
 * Where a government with nothing left at home goes: Serbia's to Corfu
 * (Jan 1916), Belgium's to Sainte-Adresse by Le Havre (Oct 1914),
 * Montenegro's to France (1916). Their own news line names the place.
 */
const GOV_EXILE: Readonly<Partial<Record<GwTag, GwTag>>> = {
  SRB: "GRC",
  BEL: "FRA",
  MNE: "FRA",
};

/** Odds the government nobody plays sues the day its capital falls. */
const SUES_AT_FALL = 50;
/** The blow of the fall itself, on the odds, for that first choice. */
const FALL_SHOCK = 15;
/** Below this share of its home places with the capital gone, it is over. */
const CERTAIN_SHARE = 15;
/** Land lost counts on the odds below this share held. */
const SAFE_SHARE = 60;
/** With its capital its own, a country gives up only below this share. */
const HELD_CAPITAL_SHARE = 40;
/** With partners fighting on its soil it is certain only this long after. */
const ALLIES_HOLD_MONTHS = 6;
/** Each month fighting on with the capital lost, on the odds. */
const PRESSURE_PER_MONTH = 4;

const gov = (gw: GreatWar, tag: GwTag): GwGovSeat | null =>
  gw.s.govSeats?.find((g) => g.tag === tag) ?? null;

/** `tag`'s home places on this map: joined by land to its capital. */
export function homePlaces(gw: GreatWar, tag: GwTag): GwPlace[] {
  const home = landGraph(gw).home;
  return GW_PLACE_KEYS.filter(
    (p) => GW_PLACES[p].owner === tag && home.has(p) && gw.world.places.has(p),
  );
}

/** Percent of its home places `tag` still holds; 100 with none on the map. */
export function homeShare(gw: GreatWar, tag: GwTag): number {
  const home = homePlaces(gw, tag);
  if (home.length === 0) return 100;
  const held = home.filter((p) => holderOf(gw, p) === tag).length;
  return Math.floor((held * 100) / home.length);
}

/**
 * Partners fighting on `tag`'s soil: a country on its side at war holds a
 * place of its home, or stands with it on an open front over its home.
 */
function alliesOnSoil(gw: GreatWar, tag: GwTag): boolean {
  const n = gw.nation(tag);
  if (n === null || n.side === null) return false;
  const home = new Set(homePlaces(gw, tag));
  const partner = (x: GwTag) =>
    x !== tag && gw.nation(x)?.side === n.side && fights(gw.nation(x));
  if ([...home].some((p) => partner(holderOf(gw, p)))) return true;
  return gw.s.theatres.some((t) => {
    if (!t.open) return false;
    const end = sideIn(gw, t.id, tag);
    if (end === null) return false;
    const mine = membersOf(gw, t.id, end);
    if (!mine.includes(tag) || !mine.some(partner)) return false;
    return frontPlaces(t.id).some((p) => home.has(p));
  });
}

/**
 * Odds in 100 that `tag` gives up this month, read off the state: land
 * held, the capital, morale and order, the army left, partners on its soil.
 * 100 once it holds almost nothing and its capital is gone.
 */
export function capitulationOdds(gw: GreatWar, tag: GwTag): number {
  const n = gw.nation(tag);
  if (n === null || !fights(n) || n.atWar.length === 0) return 0;
  const share = homeShare(gw, tag);
  const capital = capitalHolder(gw, tag) !== null;
  if (!capital && share >= HELD_CAPITAL_SHARE) return 0;
  const g = gov(gw, tag);
  const months = g === null ? 0 : Math.max(0, monthsFrom(gw, g.fell));
  const allies = alliesOnSoil(gw, tag);
  if (capital && share < CERTAIN_SHARE) {
    if (!allies || months >= ALLIES_HOLD_MONTHS) return 100;
  }
  let odds = Math.max(0, SAFE_SHARE - share);
  // The army left: men to send, and a field army still in the way.
  const field = n.atWar.some((foe) => standsAgainst(gw, tag, foe));
  if (capital) {
    // Each month fighting on from a refuge presses harder.
    odds += months * PRESSURE_PER_MONTH;
  }
  const { morale, order } = n.gauges;
  odds += morale <= 1 ? 15 : morale <= 2 ? 5 : 0;
  odds += order <= 1 ? 10 : order <= 2 ? 5 : 0;
  const men = (n.manpower * 100) / (GW_MANPOWER[tag] ?? 50);
  odds += men >= 50 ? -15 : men < 20 ? 10 : 0;
  if (!field) odds += 15;
  if (allies) odds = Math.floor(odds / 2);
  return Math.max(0, Math.min(100, odds));
}

/** Where the government goes now: a place it holds, or null abroad. */
function refuge(gw: GreatWar, tag: GwTag): GwPlace | null {
  const cap = GW_CAPITALS[tag];
  const ours = (p: GwPlace) =>
    p !== cap && gw.world.places.has(p) && holderOf(gw, p) === tag;
  const listed = (GOV_FLEES[tag] ?? []).find(ours);
  if (listed !== undefined) return listed;
  const tiles = landGraph(gw).tiles;
  let best: GwPlace | null = null;
  for (const p of homePlaces(gw, tag)) {
    if (!ours(p)) continue;
    const k = tiles.get(p) ?? 0;
    if (best === null || k > (tiles.get(best) ?? 0)) best = p;
  }
  return best;
}

/** A memory on every seat of `tag`: a card's variant reads it. */
function remember(gw: GreatWar, tag: GwTag, key: string): void {
  for (const seat of seatsOf(gw, tag)) {
    seat.memory.push({ key, who: null, chapter: gw.s.chapter, weight: 0 });
  }
}

function schedule(gw: GreatWar, tag: GwTag, scene: string): void {
  for (const seat of seatsOf(gw, tag)) {
    const due = seat.scheduled.some((q) => q.scene === scene);
    const open = seat.desk.some((c) => c.scene === scene);
    if (due || open) continue;
    seat.scheduled.push({ scene, chapter: gw.s.chapter + 1 });
  }
}

/** The government moves: to `place`, or abroad. */
function moveGov(gw: GreatWar, tag: GwTag): GwPlace | null {
  const place = refuge(gw, tag);
  if (place !== null) {
    news(gw, "gov_moved", tag, null, null, place);
    landLine(gw, tag, "gov_we_moved", tag, place);
    remember(gw, tag, `gov_to_${place}`);
  } else {
    const host = GOV_EXILE[tag] ?? null;
    news(
      gw,
      host === null ? "gov_exile" : `gov_exile_${tag.toLowerCase()}`,
      tag,
      host,
    );
  }
  return place;
}

/** The capital is lost: the government goes, and the country reels. */
function capitalFalls(gw: GreatWar, tag: GwTag, taker: GwTag): void {
  const s = gw.s;
  const cap = GW_CAPITALS[tag]!;
  news(gw, "capital_fell", tag, taker, null, cap);
  landLine(gw, tag, "capital_we_lost", taker, cap);
  moveGauge(gw, tag, "morale", -2, "capital_fell");
  moveGauge(gw, tag, "order", -2, "capital_fell");
  const place = moveGov(gw, tag);
  const row: GwGovSeat = { tag, place, fell: s.chapter, fightOn: false };
  s.govSeats = [...(s.govSeats ?? []).filter((g) => g.tag !== tag), row];
  remember(gw, taker, `took_${cap}`);
  schedule(gw, taker, GW_CAPITAL_TAKEN);
  if (ruledBySeat(gw, tag)) {
    schedule(gw, tag, GW_CAPITAL_FELL);
    return;
  }
  if (capitulationOdds(gw, tag) + FALL_SHOCK >= SUES_AT_FALL) {
    capitulate(gw, tag);
  } else {
    row.fightOn = true;
  }
}

/**
 * `tag` gives up. A coalition member leaves the war (its last leader asks
 * for the armistice); a war of a pair's own ends in a peace of the two.
 * Partners on its fronts that hold nothing there go home.
 */
export function capitulate(
  gw: GreatWar,
  tag: GwTag,
  why = "nation_capitulated",
): void {
  const n = gw.nation(tag);
  if (n === null || n.out || n.atWar.length === 0) return;
  // Its partners on each front over its own soil, before it goes.
  const mates = new Map<GwTheatre, { end: GwSide; tags: GwTag[] }>();
  for (const t of gw.s.theatres) {
    if (!t.open) continue;
    const soil = frontPlaces(t.id).some((p) => GW_PLACES[p].owner === tag);
    if (!soil) continue;
    for (const end of ["central", "entente"] as const) {
      const m = membersOf(gw, t.id, end);
      if (m.includes(tag)) {
        mates.set(t.id, { end, tags: m.filter((x) => x !== tag) });
      }
    }
  }
  if (n.side !== null) {
    sue(gw, tag, why);
  } else {
    for (const foe of [...n.atWar]) pairPeace(gw, tag, foe, tag, why);
    n.out = true;
  }
  if (gw.s.armistice !== null) return;
  // A partner holds the front on with ground of its own there; with none
  // holding any, they all go home and the front closes.
  for (const [theatre, { end, tags }] of mates) {
    const places = frontPlaces(theatre);
    const left = membersOf(gw, theatre, end).filter((x) => tags.includes(x));
    if (left.some((x) => places.some((p) => holderOf(gw, p) === x))) continue;
    for (const ally of left) {
      gw.s.withdrawn ??= [];
      gw.s.withdrawn.push({ theatre, tag: ally, chapter: gw.s.chapter });
      news(gw, "front_withdrawn", ally, tag, theatre);
    }
  }
  refreshTheatres(gw);
}

/**
 * The line follows a capital the far end holds past it (the drift of
 * ww186): a line named after a capital that end's side now holds is
 * where the front stands.
 */
export function lineFollowsLand(gw: GreatWar): void {
  const capitals = new Set<string>(Object.values(GW_CAPITALS));
  for (const t of gw.s.theatres) {
    if (t.since === null || !t.open) continue;
    const lines = GW_LINES[t.id];
    for (const side of ["central", "entente"] as const) {
      const dir = side === GW_FRONT_UP[t.id] ? 1 : -1;
      let to: number | null = null;
      for (let i = reachedLine(t) + dir; i >= 0 && i < lines.length; i += dir) {
        const name = lines[i];
        if (!capitals.has(name) || !(name in GW_PLACES)) continue;
        const place = name as GwPlace;
        if (!gw.world.places.has(place)) continue;
        const holder = holderOf(gw, place);
        if (holder === GW_PLACES[place].owner) continue;
        if (sideIn(gw, t.id, holder) === side) to = i;
      }
      if (to === null) continue;
      t.line = to;
      t.progress = 0;
      t.salient = 0;
      news(gw, "front_follows", null, null, t.id);
    }
  }
}

/** Answers from the seats' cards, read as the chapter closes. */
function seatAnswers(gw: GreatWar): void {
  for (const seat of gw.s.seats) {
    const has = (f: string) => seat.flags.includes(f);
    if (![CAP_FIGHT, CAP_SUE, CAP_SIGN, CAP_REFUSE].some(has)) continue;
    const fight = has(CAP_FIGHT);
    const give = has(CAP_SUE) || has(CAP_SIGN) || has(CAP_REFUSE);
    const refused = has(CAP_REFUSE);
    seat.flags = seat.flags.filter(
      (f) => ![CAP_FIGHT, CAP_SUE, CAP_SIGN, CAP_REFUSE].includes(f),
    );
    const g = gov(gw, seat.tag);
    if (give) {
      if (refused) news(gw, "gov_fell_capitulation", seat.tag);
      capitulate(gw, seat.tag);
    } else if (fight && g !== null) {
      g.fightOn = true;
    }
  }
}

/**
 * Chapter step, after the fronts move land and before occupation spreads
 * (so a government leaves before the land around its capital goes): lines follow the capitals held past them,
 * the seats' answers are read, capitals that fell move their governments,
 * and once a month each country at war may give up. Only on a map with the
 * places; never after the armistice.
 */
export function capitulationStep(gw: GreatWar): void {
  const s = gw.s;
  if (s.armistice !== null || !hasLandGraph(gw)) return;
  lineFollowsLand(gw);
  seatAnswers(gw);
  for (const n of [...s.nations]) {
    if (s.armistice !== null) return;
    const tag = n.tag;
    if (!fights(n) || n.atWar.length === 0) continue;
    const cap = GW_CAPITALS[tag];
    if (cap === undefined || !gw.world.places.has(cap)) continue;
    const taker = capitalHolder(gw, tag);
    const g = gov(gw, tag);
    if (taker !== null && g === null) {
      capitalFalls(gw, tag, taker);
      continue;
    }
    if (g !== null && holderOf(gw, cap) === tag) {
      // The capital is free again: the government comes home.
      s.govSeats = s.govSeats!.filter((x) => x !== g);
      news(gw, "gov_returned", tag, null, null, cap);
      continue;
    }
    if (g !== null && g.place !== null && holderOf(gw, g.place) !== tag) {
      // Its refuge falls too: it moves on, or abroad.
      g.place = moveGov(gw, tag);
      moveGauge(gw, tag, "morale", -1, "capital_fell");
    }
    if (!isLongChapter(gw) || (g !== null && g.fell === s.chapter)) continue;
    const odds = capitulationOdds(gw, tag);
    if (odds <= 0) continue;
    const roll = wwRoll(s.seed, P_CAPITULATE, s.chapter, idHash(tag)) % 100;
    if (roll >= odds) continue;
    if (ruledBySeat(gw, tag)) schedule(gw, tag, GW_CAPITULATION);
    else capitulate(gw, tag);
  }
}
