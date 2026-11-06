import {
  GW_FRONT_START,
  GW_FRONT_UP,
  GW_LINE_STEP,
  GW_LINES,
  GW_SIDES,
  GwAlloc,
  GwResult,
  GwSeatState,
  GwSide,
  GwTheatre,
  GwTheatreState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwProposal } from "@openfront/engine-api/ww1914/GwWorldView";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import type { GreatWar } from "./GreatWar";
import { officeHolder, recordResult } from "./People";
import {
  GW_ARMY_QUALITY,
  GW_THEATRE_SIDES,
  GW_WAR_ORDERS,
  GwWarOrder,
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

/** Ratio of attack to defence, percent, for each result (design §4.2). */
/** Percent an attack loses for each line past its own frontier. */
const REACH_COST = 9;
/** Percent an attack loses going over the other's own frontier. */
const HOME_SOIL = 40;
const BREAK_AT = 175;
const ADVANCE_AT = 112;
const STALEMATE_AT = 78;

/** Shells: what a side's fire is worth at 0..3. */
const SHELL_FIRE = [55, 80, 100, 110];
/** The narrow roll: it sways a result, never reverses a plain one. */
const ROLL_SPAN = 31;
const ROLL_LOW = 85;

/** A chapter's chance to dig in further, by theatre. */
const TRENCH_EVERY: Readonly<Partial<Record<GwTheatre, number>>> = {
  west: 1,
  east: 3,
  italy: 2,
  straits: 2,
  balkan: 3,
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

/** The lead's worth multipliers, percent, attack or defence. */
function fireOf(gw: GreatWar, t: GwTheatre, side: GwSide): number {
  const lead = membersOf(gw, t, side)[0];
  if (lead === undefined) return 100;
  const n = gw.nation(lead)!;
  const shells = SHELL_FIRE[n.gauges.shells];
  const morale = 80 + n.gauges.morale * 8;
  const men =
    (n.manpower < 20 ? 80 : 100) * ((GW_ARMY_QUALITY[lead] ?? 90) / 100);
  const art = Math.floor((n.tech.artillery ?? 0) / 6) * 4;
  const inf = Math.floor((n.tech.infantry ?? 0) / 6) * 4;
  return Math.floor(((shells + art + inf) * morale * men) / 10000);
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
  const first = s.warChapter !== null && s.chapter <= s.warChapter + 2;
  if (first && by === "central" && t === s.plan) return 25;
  if (t === "west" && by === "central" && first) {
    if (s.secrets.includes("bel_forts_strong")) return -12;
  }
  if (t === "east" && by === "entente" && first) {
    if (s.secrets.includes("rus_rail_ahead")) return 12;
  }
  return 0;
}

/** The war decisions signed lately that weigh on `t` (Tables.GW_WAR_ORDERS). */
function ordersOn(
  gw: GreatWar,
  t: GwTheatre,
): { o: GwWarOrder; side: GwSide }[] {
  const out: { o: GwWarOrder; side: GwSide }[] = [];
  for (const seat of gw.s.seats) {
    const side = gw.nation(seat.tag)?.side ?? null;
    if (side === null) continue;
    for (const o of GW_WAR_ORDERS) {
      if (o.theatre !== t) continue;
      const taken = seat.choices.some(
        (c) =>
          c.scene === o.scene &&
          c.pick === o.pick &&
          gw.s.chapter - c.chapter < o.lasts,
      );
      if (taken) out.push({ o, side });
    }
  }
  return out;
}

/** What those decisions add to an attack by `by`, percent. */
function orderBias(gw: GreatWar, t: GwTheatre, by: GwSide): number {
  return ordersOn(gw, t).reduce(
    (sum, { o, side }) => sum + (side === by ? o.odds : -o.odds),
    0,
  );
}

/** Attack against defence, percent, before the roll. */
function oddsOf(gw: GreatWar, t: GwTheatreState, by: GwSide): number {
  const foe = other(by);
  const att =
    ((bandOf(gw, t.id, by) + effortOf(gw, t.id, by)) *
      fireOf(gw, t.id, by) *
      commandOf(gw, t, by)) /
    10000;
  const def =
    ((bandOf(gw, t.id, foe) + 12) *
      (100 + t.trench * 24) *
      (50 + fireOf(gw, t.id, foe) / 2) *
      commandOf(gw, t, foe)) /
    1000000;
  const home = t.line <= GW_FRONT_START[t.id] && by !== GW_FRONT_UP[t.id];
  const bias =
    openingBias(gw, t.id, by) +
    orderBias(gw, t.id, by) -
    reachOf(t, by) * REACH_COST -
    (home && t.id !== "sea" ? HOME_SOIL : 0);
  return Math.floor((att * 100) / Math.max(1, def)) + bias;
}

/** Lines past the frontier: an advance outruns its railheads and stops. */
function reachOf(t: GwTheatreState, by: GwSide): number {
  const past = t.line - GW_FRONT_START[t.id];
  return Math.max(0, by === GW_FRONT_UP[t.id] ? past : -past);
}

function attacks(gw: GreatWar, t: GwTheatre, side: GwSide): boolean {
  return membersOf(gw, t, side).some((tag) => {
    const a = allocOf(gw, tag);
    return a !== null && a.main === t && a.posture === "offensive";
  });
}

function resultOf(ratio: number, trench: number): GwResult {
  if (ratio >= BREAK_AT && trench < 4) return "break";
  if (ratio >= ADVANCE_AT) return "advance";
  if (ratio >= STALEMATE_AT) return "stalemate";
  return "repelled";
}

/** Steps gained: an open front moves far, a dug-in one barely. */
function gainOf(result: GwResult, trench: number): number {
  if (result === "break") return trench === 0 ? 7 : 4;
  if (result !== "advance") return 0;
  return [5, 3, 2, 1, 1, 1][trench];
}

function move(gw: GreatWar, t: GwTheatreState, by: GwSide, gain: number): void {
  const dir = by === GW_FRONT_UP[t.id] ? 1 : -1;
  const top = GW_LINES[t.id].length - 1;
  // The rail: the Rhine falls to a Germany breaking at home, not to a push.
  const rhine = t.id === "west" && (gw.nation("DEU")?.unrest ?? 0) < 2;
  const floor = rhine ? GW_FRONT_START.west : 0;
  let pos = t.line * GW_LINE_STEP + t.progress + dir * gain;
  pos = clampTo(
    pos,
    Math.min(floor * GW_LINE_STEP, t.line * GW_LINE_STEP + t.progress),
    top * GW_LINE_STEP,
  );
  t.line = Math.floor(pos / GW_LINE_STEP);
  t.progress = pos - t.line * GW_LINE_STEP;
}

/** Thousands lost by attacker and defender. */
function lossesOf(
  gw: GreatWar,
  t: GwTheatre,
  by: GwSide,
  result: GwResult,
): [number, number] {
  const scale = membersOf(gw, t, by).some(
    (tag) => allocOf(gw, tag)?.scale === "major",
  )
    ? 140
    : 60;
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

function bleed(gw: GreatWar, t: GwTheatre, side: GwSide, lost: number): void {
  const members = membersOf(gw, t, side);
  const lead = gw.nation(members[0]);
  if (lead === null) return;
  lead.casualties += lost;
  lead.lostNow += lost;
  lead.manpower = Math.max(0, lead.manpower - Math.floor(lost / 12));
  lead.wear[t] = (lead.wear[t] ?? 0) + Math.floor(lost / 40);
  if ((lead.wear[t] ?? 0) >= 5) {
    lead.wear[t] = 0;
    lead.strength[t] = Math.max(1, (lead.strength[t] ?? 1) - 1);
  }
  if (lost >= 150) {
    moveGauge(gw, lead.tag, "morale", -1, "casualty_lists");
  }
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
    }
  }
}

/** A retreat or a stand signed this chapter moves the line before the guns. */
function orderSteps(gw: GreatWar, t: GwTheatreState): void {
  for (const { o, side } of ordersOn(gw, t.id)) {
    if (o.steps !== undefined) move(gw, t, side, o.steps);
  }
}

/** Percent of the usual losses the seat's decisions cost on `t`. */
function lossShare(gw: GreatWar, t: GwTheatre, side: GwSide): number {
  return ordersOn(gw, t).reduce(
    (pct, x) => (x.side === side ? (pct * (x.o.losses ?? 100)) / 100 : pct),
    100,
  );
}

function judge(gw: GreatWar, t: GwTheatreState): void {
  const s = gw.s;
  orderSteps(gw, t);
  const ups = GW_FRONT_UP[t.id];
  const aUp = attacks(gw, t.id, ups);
  const aDown = attacks(gw, t.id, other(ups));
  if (!aUp && !aDown) {
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
    aUp && aDown
      ? oddsOf(gw, t, ups) >= oddsOf(gw, t, other(ups))
        ? ups
        : other(ups)
      : aUp
        ? ups
        : other(ups);
  const i = gw.s.theatres.indexOf(t);
  const roll = ROLL_LOW + (wwRoll(s.seed, P_BATTLE, s.chapter, i) % ROLL_SPAN);
  const ratio = Math.floor((oddsOf(gw, t, by) * roll) / 100);
  const result = resultOf(ratio, t.trench);
  move(gw, t, by, gainOf(result, t.trench));
  const [rawA, rawD] = lossesOf(gw, t.id, by, result);
  const lostA = Math.floor((rawA * lossShare(gw, t.id, by)) / 100);
  const lostD = Math.floor((rawD * lossShare(gw, t.id, other(by))) / 100);
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
  if (result === "break") news(gw, "front_break", lead, null, t.id);
  if (result === "advance") news(gw, "front_advance", lead, null, t.id);
  if (result === "repelled") news(gw, "front_repelled", lead, null, t.id);
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
    t.trench = Math.min(5, t.trench + months);
  }
}

/** Armies refill towards what they were, while there are men to send. */
function refill(gw: GreatWar): void {
  const c = gw.s.chapter;
  for (const n of gw.s.nations) {
    if (!fights(n) || c % 3 !== 0 || n.manpower < 15) continue;
    for (const [t, base] of Object.entries(n.base)) {
      const id = t as GwTheatre;
      if ((n.strength[id] ?? 0) < (base ?? 0)) {
        n.strength[id] = (n.strength[id] ?? 0) + 1;
        n.manpower -= 2;
      }
    }
  }
}

function research(gw: GreatWar): void {
  for (const n of gw.s.nations) {
    if (!fights(n)) continue;
    const a = allocOf(gw, n.tag);
    if (a === null) continue;
    n.tech[a.research] = (n.tech[a.research] ?? 0) + monthsOf(gw);
  }
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

/** The chief's first open paper, signed; a paper already signed stands. */
export function signChief(gw: GreatWar, seat: GwSeatState): void {
  if (seat.signed === gw.s.chapter) return;
  const first = proposalsFor(gw, seat).find((p) => p.open);
  if (first === undefined) return;
  seat.alloc = { ...seat.alloc, ...planOf(first) };
  seat.signed = gw.s.chapter;
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
  research(gw);
  refreshTheatres(gw);
}

/** The side's standing in the war, about -100..100, up for `side`. */
export function warScore(gw: GreatWar, side: GwSide): number {
  let up = 0;
  for (const t of gw.s.theatres) {
    if (t.since === null) continue;
    const start = GW_FRONT_START[t.id];
    const gained = t.line * GW_LINE_STEP + t.progress - start * GW_LINE_STEP;
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
  const alt = mine.map((t) => t.id).find((t) => t !== wants) ?? null;
  const bold =
    cos !== null &&
    (cos.temperament === "arrogant" ||
      cos.temperament === "stubborn" ||
      camps.includes("hard"));
  const dry = n.gauges.shells === 0;
  const army = n.inst.army ?? 0;
  const by = cos?.id ?? null;
  const scale = bold && !dry ? "major" : "limited";
  const out: GwProposal[] = [];
  const add = (
    id: string,
    main: GwTheatre,
    posture: GwAlloc["posture"],
    sc: GwAlloc["scale"],
    allyShare: number,
    why: string | null,
  ) =>
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
  if (alt !== null) {
    add(
      "other_front",
      alt,
      "offensive",
      "limited",
      0,
      army >= 3 ? "army" : null,
    );
  }
  add("hold_all", wants, "hold", "limited", 0, army >= 2 ? "army" : null);
  if (
    gw.s.nations.some((x) => x.side === n.side && x.tag !== n.tag && fights(x))
  ) {
    add("help_ally", wants, "hold", "limited", 2, army >= 3 ? "army" : null);
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
