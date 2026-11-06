import {
  GW_FRONT_START,
  GW_FRONT_UP,
  GW_LINE_STEP,
  GW_LINES,
  GW_SIDES,
  GwAlloc,
  GwResearch,
  GwResult,
  GwSeatState,
  GwSide,
  GwTheatre,
  GwTheatreState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwProposal } from "@openfront/engine-api/ww1914/GwWorldView";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { civilFromDays } from "@openfront/engine-lib/ww1936/Calendar";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { paperClosed } from "./Authority";
import {
  eraOf,
  GW_SEASON,
  posOf,
  researchStep,
  techEdge,
  techShield,
  warMonths,
} from "./Eras";
import type { GreatWar } from "./GreatWar";
import { officeHolder, recordResult } from "./People";
import {
  GW_AI_RESEARCH,
  GW_ARMY_QUALITY,
  GW_NEW_ARMIES,
  GW_THEATRE_SIDES,
  theatresOf,
} from "./Tables";
import { membersOf, refreshTheatres } from "./Wars";
import {
  clampTo,
  defOf,
  fights,
  isLongChapter,
  monthsOf,
  moveGauge,
  news,
  other,
  reason,
  seatsOf,
} from "./World";

const P_BATTLE = idHash("gw_battle");
const P_ESTIMATE = idHash("gw_estimate");
const P_LOCAL = idHash("gw_local");

/** Ratio of attack to defence, percent, for each result (design §4.2). */
/** Percent an attack loses for each line past its own frontier. */
const REACH_COST = 9;
/** Percent an attack loses going over the other's own frontier. */
const HOME_SOIL = 55;
const BREAK_AT = 175;
const ADVANCE_AT = 112;
const STALEMATE_AT = 78;

/** Shells: what a side's fire is worth at 0..3. */
const SHELL_FIRE = [55, 80, 100, 110];
/** Thousands a local action is worth next to a limited or major one. */
const SCALE_LOCAL = 40;
const SCALE_LIMITED = 90;
const SCALE_MAJOR = 200;
/** Band lost for so much wear; a wear is MEN_PER_POINT thousand men. */
const WEAR_PER_BAND = 8;
/** Thousands lost in a chapter for one point of manpower. */
const MEN_PER_POINT = 60;
/** Below this a side has nobody to send. */
const MEN_LOW = 12;
/** A side won't try a local action on worse odds than this. */
const LOCAL_FLOOR = 58;
/** A chief won't press a theatre on odds worse than these, unless he's bold. */
const PRESS_FLOOR = 90;
const BOLD_FLOOR = 75;
/** Chapters of the opening, when plans run on what was drawn up in peace. */
const OPENING_CHAPTERS = 3;
/** The narrow roll: it sways a result, never reverses a plain one. */
const ROLL_SPAN = 31;
const ROLL_LOW = 85;

/** A chapter's chance to dig in further, by theatre. */
const TRENCH_EVERY: Readonly<Partial<Record<GwTheatre, number>>> = {
  west: 2,
  east: 4,
  italy: 3,
  straits: 3,
  balkan: 5,
  caucasus: 6,
  mesopotamia: 6,
  palestine: 5,
};

/** How deep a theatre ever digs: there is too much ground in the east. */
const TRENCH_MAX: Readonly<Partial<Record<GwTheatre, number>>> = {
  west: 5,
  italy: 4,
  straits: 4,
  east: 3,
  balkan: 1,
  caucasus: 2,
  mesopotamia: 2,
  palestine: 2,
};

/**
 * What the ground adds to a defence where it stands, percent: forts, ridges,
 * rivers and the fortified lines an army falls back on.
 */
const GROUND: Readonly<Partial<Record<GwTheatre, Record<string, number>>>> = {
  west: { liege: 25, somme: 12, aisne: 20, marne: 30 },
  east: { east_prussia: 15, warsaw: 15, riga: 15 },
  italy: { isonzo: 30, piave: 25, trentino: 30 },
  caucasus: { erzurum: 25 },
  straits: { gallipoli: 40, narrows: 50 },
  mesopotamia: { kut: 15 },
  palestine: { gaza: 25 },
  balkan: { salonika: 20, belgrade: 15 },
};

/** Percent chance a theatre nobody's main effort sees a local action. */
const LOCAL_PCT: Readonly<Record<GwTheatre, number>> = {
  west: 25,
  east: 45,
  balkan: 40,
  italy: 45,
  caucasus: 45,
  straits: 40,
  mesopotamia: 50,
  palestine: 50,
  sea: 6,
  colonies: 15,
};

/** Percent an attack loses for each line past its frontier, where that's hard. */
const REACH_BY: Readonly<Partial<Record<GwTheatre, number>>> = {
  west: 14,
  east: 16,
  mesopotamia: 22,
  palestine: 20,
  caucasus: 16,
  colonies: 16,
  italy: 15,
  balkan: 12,
};

/** How much war a theatre holds next to the west: casualties, percent. */
const SCALE_OF: Readonly<Partial<Record<GwTheatre, number>>> = {
  west: 100,
  east: 90,
  italy: 60,
  balkan: 40,
  straits: 40,
  caucasus: 30,
  mesopotamia: 15,
  palestine: 15,
  sea: 3,
  colonies: 3,
};

export function allocOf(gw: GreatWar, tag: GwTag): GwAlloc | null {
  const seat = seatsOf(gw, tag)[0];
  if (seat !== undefined) return seat.alloc;
  return gw.nation(tag)?.alloc ?? null;
}

function bandOf(gw: GreatWar, t: GwTheatre, side: GwSide): number {
  const bands = membersOf(gw, t, side).map(
    (tag) => gw.nation(tag)!.strength[t] ?? 1,
  );
  if (bands.length === 0) return 0;
  const best = Math.max(...bands);
  const rest = bands.reduce((a, b) => a + b, 0) - best;
  return best * 20 + rest * 8;
}

/** The effort put in this theatre, by everyone on the side. */
function effortOf(gw: GreatWar, t: GwTheatre, side: GwSide): number {
  let out = 0;
  const here = membersOf(gw, t, side);
  for (const n of gw.s.nations) {
    if (!fights(n) || n.side !== side) continue;
    const a = allocOf(gw, n.tag);
    if (a === null) continue;
    if (here.includes(n.tag) && a.main === t) {
      out += a.scale === "major" ? 25 : 10;
      out -= a.allyShare * 3;
    } else if (!here.includes(n.tag) && a.allyShare > 0) {
      // Men sent to a friend's front.
      if (theatresOf(n.tag).includes(a.main) && a.main !== t) {
        out += a.allyShare * 2;
      }
    }
  }
  return out;
}

/** What a side keeps behind the line: a theatre it put its men in holds better. */
function reservesOf(gw: GreatWar, t: GwTheatre, side: GwSide): number {
  const s = gw.s;
  // In the first weeks everyone is on the march: nothing stands behind yet.
  if (s.warChapter === null || s.chapter <= s.warChapter + OPENING_CHAPTERS) {
    return 0;
  }
  let out = 0;
  for (const tag of membersOf(gw, t, side)) {
    const a = allocOf(gw, tag);
    if (a?.main !== t) continue;
    out += a.posture === "hold" ? 18 : 6;
  }
  return out;
}

/** The lead's worth multipliers, percent, attack or defence. */
function fireOf(gw: GreatWar, t: GwTheatre, side: GwSide): number {
  const lead = membersOf(gw, t, side)[0];
  if (lead === undefined) return 100;
  const n = gw.nation(lead)!;
  const shells = SHELL_FIRE[n.gauges.shells];
  const morale = 80 + n.gauges.morale * 8;
  const men =
    (n.manpower < MEN_LOW ? 75 : 100) * ((GW_ARMY_QUALITY[lead] ?? 90) / 100);
  return Math.floor((shells * morale * men) / 10000);
}

/** The lead on a side of a theatre, or null. */
function leadOf(gw: GreatWar, t: GwTheatre, side: GwSide) {
  const tag = membersOf(gw, t, side)[0];
  return tag === undefined ? null : gw.nation(tag);
}

/** Lines built in the war: they count from their period, for their builders. */
const BUILT: readonly {
  readonly theatre: GwTheatre;
  readonly line: string;
  readonly by: GwSide;
  readonly from: number;
  readonly pct: number;
}[] = [
  { theatre: "west", line: "hindenburg", by: "central", from: 30, pct: 50 },
];

function groundOf(gw: GreatWar, t: GwTheatreState, foe: GwSide): number {
  const line = GW_LINES[t.id][t.line];
  const built = BUILT.find(
    (b) =>
      b.theatre === t.id &&
      b.line === line &&
      b.by === foe &&
      warMonths(gw) >= b.from,
  );
  return (GROUND[t.id]?.[line] ?? 0) + (built?.pct ?? 0);
}

function seasonOf(gw: GreatWar, t: GwTheatre): number {
  return GW_SEASON[t]?.[civilFromDays(gw.s.day).month] ?? 0;
}

function commandOf(gw: GreatWar, t: GwTheatreState, side: GwSide): number {
  if (t.commander === null) return 100;
  const p = gw.person(t.commander);
  const def = defOf(t.commander);
  if (p === null || def === null) return 100;
  if (gw.nation(def.tag)?.side !== side) return 100;
  return [90, 100, 112][p.competence[0] - 1];
}

/** The first weeks' plan and the world's secrets, percent. */
function openingBias(gw: GreatWar, t: GwTheatre, by: GwSide): number {
  const s = gw.s;
  const first =
    s.warChapter !== null && s.chapter <= s.warChapter + OPENING_CHAPTERS;
  if (first && by === "central" && t === s.plan) return 25;
  if (t === "west" && by === "central" && first) {
    if (s.secrets.includes("bel_forts_strong")) return -12;
  }
  if (t === "east" && by === "entente" && first) {
    if (s.secrets.includes("rus_rail_ahead")) return 12;
  }
  return 0;
}

/**
 * Attack against defence, percent, before the roll. `planned`: what the effort
 * signed this chapter adds; without it, what the theatre would do if pressed.
 */
function oddsOf(
  gw: GreatWar,
  t: GwTheatreState,
  by: GwSide,
  planned = true,
): number {
  const foe = other(by);
  const effort = planned ? effortOf(gw, t.id, by) : 25;
  const a = leadOf(gw, t.id, by);
  const d = leadOf(gw, t.id, foe);
  const edge = a === null || d === null ? 0 : techEdge(a, d);
  const shield = d === null ? 0 : techShield(d);
  const att =
    ((bandOf(gw, t.id, by) + effort) *
      fireOf(gw, t.id, by) *
      commandOf(gw, t, by)) /
    10000;
  const def =
    ((bandOf(gw, t.id, foe) + 12 + reservesOf(gw, t.id, foe)) *
      (100 + t.trench * 24 + groundOf(gw, t, foe) + eraOf(gw).defence + shield) *
      (50 + fireOf(gw, t.id, foe) / 2) *
      commandOf(gw, t, foe)) /
    1000000;
  const home = t.line <= GW_FRONT_START[t.id] && by !== GW_FRONT_UP[t.id];
  const bias =
    openingBias(gw, t.id, by) +
    edge -
    seasonOf(gw, t.id) -
    reachOf(t, by) * (REACH_BY[t.id] ?? REACH_COST) -
    (home && t.id !== "sea" ? HOME_SOIL : 0);
  return Math.floor((att * 100) / Math.max(1, def)) + bias;
}

/** What a theatre would do if pressed: the AI's and the chief's eye. */
export function pressOdds(gw: GreatWar, t: GwTheatre, by: GwSide): number {
  return oddsOf(gw, gw.s.theatres.find((x) => x.id === t)!, by, false);
}

/** Lines past the frontier: an advance outruns its railheads and stops. */
function reachOf(t: GwTheatreState, by: GwSide): number {
  const past = t.line - GW_FRONT_START[t.id];
  return Math.max(0, by === GW_FRONT_UP[t.id] ? past : -past);
}

/** Nothing left to take: the far end of the theatre's lines. */
function atEnd(t: GwTheatreState, by: GwSide): boolean {
  const up = by === GW_FRONT_UP[t.id];
  return up
    ? posOf(t) >= (GW_LINES[t.id].length - 1) * GW_LINE_STEP
    : posOf(t) <= 0;
}

function attacks(gw: GreatWar, t: GwTheatreState, side: GwSide): boolean {
  if (atEnd(t, side)) return false;
  return membersOf(gw, t.id, side).some((tag) => {
    const a = allocOf(gw, tag);
    return a !== null && a.main === t.id && a.posture === "offensive";
  });
}

/** The trench an attack really meets: the storm looks past some of it. */
function trenchFaced(gw: GreatWar, t: GwTheatreState): number {
  return Math.max(0, t.trench - eraOf(gw).open);
}

function resultOf(ratio: number, trench: number): GwResult {
  if (ratio >= BREAK_AT && trench < 4) return "break";
  if (ratio >= ADVANCE_AT) return "advance";
  if (ratio >= STALEMATE_AT) return "stalemate";
  return "repelled";
}

/** Steps gained: an open front moves far, a dug-in one barely. */
function gainOf(result: GwResult, trench: number): number {
  if (result === "break") return trench === 0 ? 4 : 3;
  if (result !== "advance") return 0;
  return [3, 2, 2, 1, 1, 1][trench];
}

function move(gw: GreatWar, t: GwTheatreState, by: GwSide, gain: number): void {
  const dir = by === GW_FRONT_UP[t.id] ? 1 : -1;
  const top = GW_LINES[t.id].length - 1;
  const pos = clampTo(posOf(t) + dir * gain, 0, top * GW_LINE_STEP);
  t.line = Math.floor(pos / GW_LINE_STEP);
  t.progress = pos - t.line * GW_LINE_STEP;
  // Ground lost to a break is ground the new line has not been dug on.
  if (gain >= GW_LINE_STEP) t.trench = Math.max(0, t.trench - 1);
}

/** Thousands lost by attacker and defender. */
function lossesOf(
  gw: GreatWar,
  t: GwTheatre,
  by: GwSide,
  result: GwResult,
  local: boolean,
): [number, number] {
  const major = membersOf(gw, t, by).some((tag) => {
    const a = allocOf(gw, tag);
    return a?.scale === "major" && a.main === t;
  });
  const scale = local
    ? SCALE_LOCAL
    : major
      ? SCALE_MAJOR
      : SCALE_LIMITED;
  const size = ((SCALE_OF[t] ?? 20) * scale) / 100;
  const lead = gw.nation(membersOf(gw, t, by)[0])!;
  const dry = lead.gauges.shells === 0 ? 140 : 100;
  const a = { break: 70, advance: 100, stalemate: 110, repelled: 150 };
  const d = { break: 170, advance: 90, stalemate: 60, repelled: 40 };
  const k = result === "quiet" ? "stalemate" : result;
  return [
    Math.floor((size * a[k] * dry) / 10000),
    Math.floor((size * d[k]) / 100),
  ];
}

/** A side's losses fall on who is there, by what each has there. */
function bleed(gw: GreatWar, t: GwTheatre, side: GwSide, lost: number): void {
  const members = membersOf(gw, t, side);
  const bands = members.map((tag) => gw.nation(tag)!.strength[t] ?? 1);
  const all = bands.reduce((a, b) => a + b, 0);
  members.forEach((tag, i) => {
    const n = gw.nation(tag)!;
    const share = Math.floor((lost * bands[i]) / Math.max(1, all));
    n.casualties += share;
    n.lostNow += share;
    n.manpower = Math.max(0, n.manpower - Math.floor(share / MEN_PER_POINT));
    n.wear[t] = (n.wear[t] ?? 0) + Math.floor(share / MEN_PER_POINT);
    if ((n.wear[t] ?? 0) >= WEAR_PER_BAND) {
      n.wear[t] = 0;
      n.strength[t] = Math.max(1, (n.strength[t] ?? 1) - 1);
    }
    if (share >= 250) moveGauge(gw, tag, "morale", -1, "casualty_lists");
  });
}

/** A theatre's effect on the people who lead it and the country's mood. */
function settle(
  gw: GreatWar,
  t: GwTheatreState,
  by: GwSide,
  result: GwResult,
): void {
  const won = result === "break" || result === "advance";
  const lost = result === "repelled";
  const winner = won ? by : lost ? other(by) : null;
  if (winner === null) return;
  for (const side of GW_SIDES) {
    for (const tag of membersOf(gw, t.id, side).slice(0, 1)) {
      const up = side === winner;
      if (result === "break" || !up) {
        moveGauge(
          gw,
          tag,
          "morale",
          up ? 1 : -1,
          up ? "front_won" : "front_lost",
        );
      } else if (t.id === "west" || t.id === "east") {
        moveGauge(gw, tag, "morale", 1, "front_won");
      }
      for (const seat of seatsOf(gw, tag)) {
        if (t.commander !== null) recordResult(gw, t.commander, up);
        if (up) reason(gw, seat, `front_${t.id}_won`);
        else reason(gw, seat, `front_${t.id}_lost`);
      }
      commandBlame(gw, tag, t.id, up);
    }
  }
}

/** A sovereign at the head of his army wears its results himself. */
function commandBlame(
  gw: GreatWar,
  tag: GwTag,
  t: GwTheatre,
  won: boolean,
): void {
  const n = gw.nation(tag);
  if (n === null || !n.command || allocOf(gw, tag)?.main !== t) return;
  n.authority = clampTo(n.authority + (won ? 4 : -8), 0, 100);
  if (won) return;
  moveGauge(gw, tag, "order", -1, "order_command");
  for (const seat of seatsOf(gw, tag)) reason(gw, seat, "command_blamed");
}

/**
 * A theatre nobody put his main effort in still has generals: now and then the
 * side with the better of it tries something, on its own scale.
 */
function localPush(gw: GreatWar, t: GwTheatreState): GwSide | null {
  const s = gw.s;
  const i = s.theatres.indexOf(t);
  if (wwRoll(s.seed, P_LOCAL, s.chapter, i) % 100 >= LOCAL_PCT[t.id]) {
    return null;
  }
  const ups = GW_FRONT_UP[t.id];
  const up = atEnd(t, ups) ? 0 : oddsOf(gw, t, ups, false);
  const down = atEnd(t, other(ups)) ? 0 : oddsOf(gw, t, other(ups), false);
  const best = Math.max(up, down);
  if (best < LOCAL_FLOOR) return null;
  return up >= down ? ups : other(ups);
}

function judge(gw: GreatWar, t: GwTheatreState): void {
  const s = gw.s;
  const ups = GW_FRONT_UP[t.id];
  const aUp = attacks(gw, t, ups);
  const aDown = attacks(gw, t, other(ups));
  const local = !aUp && !aDown ? localPush(gw, t) : null;
  if (!aUp && !aDown && local === null) {
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
  // Both attack: the stronger push is the one that counts.
  const by =
    local ??
    (aUp && aDown
      ? oddsOf(gw, t, ups) >= oddsOf(gw, t, other(ups))
        ? ups
        : other(ups)
      : aUp
        ? ups
        : other(ups));
  const i = gw.s.theatres.indexOf(t);
  const roll = ROLL_LOW + (wwRoll(s.seed, P_BATTLE, s.chapter, i) % ROLL_SPAN);
  const ratio = Math.floor((oddsOf(gw, t, by, local === null) * roll) / 100);
  const faced = trenchFaced(gw, t);
  const result = resultOf(ratio, faced);
  move(gw, t, by, gainOf(result, faced));
  const [lostA, lostD] = lossesOf(gw, t.id, by, result, local !== null);
  bleed(gw, t.id, by, lostA);
  bleed(gw, t.id, other(by), lostD);
  const lost = by === GW_SIDES[0] ? [lostA, lostD] : [lostD, lostA];
  s.battles.push({
    theatre: t.id,
    chapter: s.chapter,
    result,
    by,
    lost,
    line: t.line,
    luck: roll - 100,
  });
  settle(gw, t, by, result);
  const lead = membersOf(gw, t.id, by)[0];
  if (local === null) {
    for (const tag of membersOf(gw, t.id, by)) {
      if (allocOf(gw, tag)?.scale === "major") gw.nation(tag)!.spent = s.chapter;
    }
  }
  if (result === "break") news(gw, "front_break", lead, null, t.id);
  if (result === "advance") news(gw, "front_advance", lead, null, t.id);
  if (result === "repelled" && local === null) {
    news(gw, "front_repelled", lead, null, t.id);
  }
  if (roll <= ROLL_LOW + 3 && result === "repelled") {
    for (const seat of seatsOf(gw, lead)) reason(gw, seat, "bad_luck");
  }
}

function dig(gw: GreatWar, t: GwTheatreState): void {
  const every = TRENCH_EVERY[t.id];
  if (every === undefined || t.since === null) return;
  const age = gw.s.chapter - t.since;
  const months = monthsOf(gw);
  if (age >= 1 && age % every === 0) {
    t.trench = Math.min(TRENCH_MAX[t.id] ?? 5, t.trench + months);
  }
}

/** Armies refill towards what they were, while there are men to send. */
function refill(gw: GreatWar): void {
  const c = gw.s.chapter;
  for (const n of gw.s.nations) {
    if (!fights(n)) continue;
    // The year's class, and the wounded coming back.
    n.manpower = Math.min(100, n.manpower + monthsOf(gw));
    if (c % 2 !== 0 || n.manpower < MEN_LOW) continue;
    for (const [t, base] of Object.entries(n.base)) {
      const id = t as GwTheatre;
      if ((n.strength[id] ?? 0) < (base ?? 0)) {
        n.strength[id] = (n.strength[id] ?? 0) + 1;
        n.manpower -= 2;
      }
    }
  }
}

/** Months a country has been in, at this chapter and at the one before. */
function monthsIn(gw: GreatWar, entered: number): [number, number] {
  const days = gwChapters(gw.s.calendar);
  const now = days[gw.s.chapter].day - days[entered].day;
  const was = now - days[gw.s.chapter].spanDays;
  return [Math.floor(now / 30), Math.floor(was / 30)];
}

/** New armies reach the front on their time (Tables.GW_NEW_ARMIES). */
function newArmies(gw: GreatWar): void {
  for (const row of GW_NEW_ARMIES) {
    const n = gw.nation(row.tag);
    if (n === null || !fights(n) || n.entered === null) continue;
    const [now, was] = monthsIn(gw, n.entered);
    const steps = row.months.filter((m) => m > was && m <= now).length;
    if (steps === 0) continue;
    n.base[row.theatre] = clampTo((n.base[row.theatre] ?? 0) + steps, 1, 5);
    n.strength[row.theatre] = clampTo(
      (n.strength[row.theatre] ?? 0) + steps,
      1,
      5,
    );
    news(gw, "new_armies", row.tag, null, row.theatre);
  }
}

function research(gw: GreatWar): void {
  for (const n of gw.s.nations) {
    if (!fights(n)) continue;
    const a = allocOf(gw, n.tag);
    if (a === null) continue;
    n.tech[a.research] = (n.tech[a.research] ?? 0) + monthsOf(gw);
  }
  researchStep(gw, monthsOf(gw));
}

/** A country's research this year, when nobody signs for it. */
export function aiResearch(gw: GreatWar, tag: GwTag): GwResearch {
  const list = GW_AI_RESEARCH[tag] ?? ["artillery"];
  const year = Math.floor(gw.s.chapter / 12);
  return list[year % list.length];
}

/** The chief's plan stands when nobody signed. */
function signDefaults(gw: GreatWar): void {
  for (const seat of gw.s.seats) {
    if (seat.signed === gw.s.chapter) continue;
    const first = proposalsFor(gw, seat).find((p) => p.open);
    if (first === undefined) continue;
    seat.alloc = { ...seat.alloc, ...planOf(first) };
    reason(gw, seat, "plan_by_default");
  }
}

function planOf(p: GwProposal): Omit<GwAlloc, "research"> {
  return {
    main: p.main,
    posture: p.posture,
    scale: p.scale,
    allyShare: p.allyShare,
  };
}

/** Chapter step: every open theatre is judged, then the armies dig and refill. */
export function frontsStep(gw: GreatWar): void {
  const s = gw.s;
  // The war just opened: the first plans are signed next chapter.
  if (s.warChapter === null || s.warChapter === s.chapter) return;
  if (!isLongChapter(gw)) return;
  signDefaults(gw);
  for (const n of s.nations) n.lostNow = 0;
  for (const t of s.theatres) if (t.open) judge(gw, t);
  for (const t of s.theatres) if (t.open) dig(gw, t);
  refill(gw);
  newArmies(gw);
  research(gw);
  refreshTheatres(gw);
}

/** The side's standing in the war, about -100..100, up for `side`. */
export function warScore(gw: GreatWar, side: GwSide): number {
  let up = 0;
  for (const t of gw.s.theatres) {
    if (t.since === null) continue;
    const start = GW_FRONT_START[t.id];
    const gained = posOf(t) - start * GW_LINE_STEP;
    const weight = t.id === "west" || t.id === "east" ? 5 : 2;
    up += (GW_FRONT_UP[t.id] === "central" ? gained : -gained) * weight;
  }
  for (const n of gw.s.nations) {
    if (n.out && n.side !== null) up += n.side === "central" ? -25 : 25;
  }
  const central = clampTo(up, -100, 100);
  return side === "central" ? central : -central;
}

/** What the chief of staff says of the odds: 0 hopeless .. 4 sure. */
function estimate(gw: GreatWar, seat: GwSeatState, main: GwTheatre): number {
  const t = gw.s.theatres.find((x) => x.id === main)!;
  const side = gw.nation(seat.tag)?.side;
  if (side === null || side === undefined) return 2;
  const cos = officeHolder(gw, seat, "chief_of_staff");
  const bias =
    cos === null
      ? 0
      : {
          arrogant: 18,
          stubborn: 8,
          cold: 0,
          cunning: 4,
          weary: -6,
          anxious: -18,
        }[cos.temperament];
  const fog =
    (wwRoll(gw.s.seed, P_ESTIMATE, gw.s.chapter, gw.s.theatres.indexOf(t)) %
      41) -
    20;
  const said = oddsOf(gw, t, side) + bias + fog;
  if (said >= 150) return 4;
  if (said >= 112) return 3;
  if (said >= 90) return 2;
  if (said >= 70) return 1;
  return 0;
}

/**
 * The chief of staff's papers for this chapter: the one he wants first.
 * Derived from the state, never stored. The army's weight closes what he
 * doesn't want (design §6).
 */
export function proposalsFor(gw: GreatWar, seat: GwSeatState): GwProposal[] {
  const n = gw.nation(seat.tag);
  if (n === null || !fights(n) || n.side === null) return [];
  const mine = gw.s.theatres.filter(
    (t) => t.open && membersOf(gw, t.id, n.side!).includes(seat.tag),
  );
  if (mine.length === 0) return [];
  const cos = officeHolder(gw, seat, "chief_of_staff");
  const camps = cos === null ? [] : (defOf(cos.id)?.camps ?? []);
  const wants: GwTheatre = pickMain(
    mine.map((t) => t.id),
    gw.s.plan === "east" || camps.includes("east") ? "east" : "west",
  );
  const alts = mine.map((t) => t.id).filter((t) => t !== wants);
  const bold =
    cos !== null &&
    (cos.temperament === "arrogant" ||
      cos.temperament === "stubborn" ||
      camps.includes("hard"));
  const dry = n.gauges.shells === 0;
  const by = cos?.id ?? null;
  const scale = bold && !dry ? "major" : "limited";
  const out: GwProposal[] = [];
  const add = (
    id: string,
    main: GwTheatre,
    posture: GwAlloc["posture"],
    sc: GwAlloc["scale"],
    allyShare: number,
    no: string | null,
  ) => {
    const kind =
      posture === "hold" ? (allyShare > 0 ? "ally" : "hold") : id === "other_front" ? "other" : "attack";
    const why = no ?? paperClosed(gw, n, kind, sc);
    out.push({
      id,
      by,
      main,
      posture,
      scale: sc,
      allyShare,
      open: why === null,
      why,
      estimate: estimate(gw, seat, main),
      tell: tellOf(posture, sc, allyShare),
    });
  };
  // A chief who can read his own odds doesn't send a paper he doesn't believe.
  const floor = bold ? BOLD_FLOOR : PRESS_FLOOR;
  const age = gw.s.chapter - (gw.s.warChapter ?? gw.s.chapter);
  const believes =
    age <= OPENING_CHAPTERS ||
    (pressOdds(gw, wants, n.side) >= floor &&
      gw.s.chapter - n.spent > 1 &&
      n.manpower >= MEN_LOW);
  if (!believes) add("hold_all", wants, "hold", "limited", 0, null);
  add("cos_plan", wants, "offensive", scale, 0, null);
  const other2 = scale === "major" ? "limited" : "major";
  add(
    "cos_scale",
    wants,
    "offensive",
    other2,
    0,
    other2 === "major" && dry ? "no_shells" : null,
  );
  for (const alt of alts) {
    add("other_front", alt, "offensive", "limited", 0, null);
  }
  if (believes) add("hold_all", wants, "hold", "limited", 0, null);
  if (
    gw.s.nations.some((x) => x.side === n.side && x.tag !== n.tag && fights(x))
  ) {
    add("help_ally", wants, "hold", "limited", 2, null);
  }
  return out;
}

function pickMain(open: GwTheatre[], first: GwTheatre): GwTheatre {
  return open.includes(first) ? first : open[0];
}

function tellOf(
  posture: GwAlloc["posture"],
  scale: GwAlloc["scale"],
  allyShare: number,
): string[] {
  const out: string[] = [];
  if (posture === "offensive" && scale === "major") {
    out.push("shells:-1", "casualties_high");
  } else if (posture === "offensive") {
    out.push("casualties_low");
  }
  if (allyShare > 0) out.push("ally:+1");
  return out;
}

/** The theatres of `GW_THEATRE_SIDES` a seat's country fights in. */
export function ownFronts(gw: GreatWar, seat: GwSeatState): GwTheatreState[] {
  const side = gw.nation(seat.tag)?.side ?? null;
  if (side === null) return [];
  return gw.s.theatres.filter(
    (t) => t.open && GW_THEATRE_SIDES[t.id][side].includes(seat.tag),
  );
}
