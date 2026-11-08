// Great War 1914: the house and its factions, running (brief ww158, S1). A seat
// whose country has a house row and factions keeps them in `seat.house`. A bill
// with a row in the house's bills (GwBillRow) is argued faction by faction:
// drafted with a minister, lobbied with the leaders, counted by a whip who can
// be wrong, voted by the true count (nothing rolled on the day), or carried
// round the house where the constitution allows. A bill without a row runs as
// before (Laws.ts). Plots, files and asks are the S2 files'.
import type {
  GwNationState,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GW_FACTION_STEP_MAX,
  GW_FACTION_STRENGTH_MAX,
  GW_WHIP_WORDS,
  GwBillFactionView,
  GwChamber,
  GwFactionState,
  gwHouseStart,
  GwHouseState,
  GwHouseView,
  GwLawOrigin,
  GwVoteBand,
  GwWhipWord,
} from "@openfront/engine-api/ww1914/GwHouse";
import type { GwLawState } from "@openfront/engine-api/ww1914/GwLaw";
import type { GwCond } from "@openfront/engine-api/ww1914/SceneDsl";
import type {
  GwWorldCond,
  GwWorldEffect,
} from "@openfront/engine-api/ww1914/WorldDsl";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { GW_LAWS } from "@openfront/engine-lib/ww1914/content/scenes/laws";
import {
  GW_ASK_GAP,
  GW_ASK_STRENGTH,
  GW_BRING_STRENGTH,
  GW_HOUSE_CALLS,
  GW_IGNORED_FADE,
  GW_IGNORED_LIMIT,
  GW_LORDS_DELAY,
  GW_REFUSED_HEAT,
  GW_SPONSOR_ODDS,
  GW_WHIP_SPREAD,
  GwBillRow,
  GwChamberRow,
  GwFactionRow,
  GwHouseRow,
  GwSide,
  houseIds,
} from "@openfront/engine-lib/ww1914/HouseRows";
import type { GwLawRow } from "@openfront/engine-lib/ww1914/LawRows";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { blocNow } from "./Blocs";
import { makeCard, placeCard } from "./Desk";
import type { GreatWar } from "./GreatWar";
import { castOf, holds, runEffects, SceneCtx, sceneOf } from "./SceneRun";
import {
  clampTo,
  everyMonths,
  isLongChapter,
  monthsOf,
  news,
  reason,
} from "./World";

const P_WHIP = idHash("gw_whip");
const P_SPONSOR = idHash("gw_sponsor");
/**
 * A whip's unconfirmed word waits to be put right until the vote: Intel's
 * GW_CHECK_LATER (S2), the same value. A null checkDay reads as checked.
 */
const CHECK_LATER = 2_000_000_000;
/** A chamber that doesn't sit can't pass anything. */
const CLOSED = -9;
/** Heat with no step rows. */
const PLAIN_MAX = 3;

// ---- Rows ----

export function houseRow(tag: string): GwHouseRow | null {
  return gwContent().houses?.find((h) => h.tag === tag) ?? null;
}

function factionRows(tag: string): GwFactionRow[] {
  return (gwContent().factions ?? []).filter((f) => f.tag === tag);
}

export function factionRow(id: string): GwFactionRow | null {
  return (gwContent().factions ?? []).find((f) => f.id === id) ?? null;
}

const lawRow = (id: string): GwLawRow | null =>
  GW_LAWS.find((r) => r.id === id) ?? null;

/** The house's row for a bill, if this seat's house runs it. */
export function billRow(seat: GwSeatState, law: string): GwBillRow | null {
  if (houseRow(seat.tag) === null) return null;
  const b = (gwContent().bills ?? []).find((x) => x.law === law) ?? null;
  return b !== null && lawRow(law)?.tag === seat.tag ? b : null;
}

/** The house state, if the seat has one yet. */
export function houseOf(seat: GwSeatState): GwHouseState | null {
  return seat.house ?? null;
}

export function factionOf(
  seat: GwSeatState,
  id: string,
): GwFactionState | null {
  return seat.house?.factions.find((f) => f.id === id) ?? null;
}

type Seats = Partial<Record<GwChamber, number>>;

/** A faction's seats now: moved by splits and joins, else its row's. */
export function seatsNow(seat: GwSeatState, row: GwFactionRow): Seats {
  return (
    (factionOf(seat, row.id)?.seats as Seats | null | undefined) ?? row.seats
  );
}

/** `take` seats from each chamber of `from`, at most what it has. */
function moveSeats(from: Seats, take: number): { left: Seats; moved: Seats } {
  const left: Seats = {};
  const moved: Seats = {};
  for (const [c, k] of Object.entries(from) as [GwChamber, number][]) {
    const m = Math.min(take, k ?? 0);
    left[c] = (k ?? 0) - m;
    if (m > 0) moved[c] = m;
  }
  return { left, moved };
}

function poolSeats(list: readonly Seats[]): Seats {
  const out: Seats = {};
  for (const s of list) {
    for (const [c, k] of Object.entries(s) as [GwChamber, number][]) {
      out[c] = (out[c] ?? 0) + (k ?? 0);
    }
  }
  return out;
}

const ctxOf = (gw: GreatWar, seat: GwSeatState): SceneCtx => ({
  gw,
  seat,
  cast: {},
});

// ---- The moving bill ----

const MOVING: readonly GwLawState["stage"][] = [
  "draft",
  "persuade",
  "vote",
  "sign",
];

function movingBill(
  gw: GreatWar,
  seat: GwSeatState,
): { st: GwLawState; bill: GwBillRow; row: GwLawRow } | null {
  const n = gw.nation(seat.tag);
  if (n === null) return null;
  const st = n.laws.find((x) => MOVING.includes(x.stage));
  if (st === undefined) return null;
  const bill = billRow(seat, st.id);
  const row = lawRow(st.id);
  return bill === null || row === null ? null : { st, bill, row };
}

/** The chambers a bill meets, in order. */
export function chambersOf(house: GwHouseRow, bill: GwBillRow): GwChamberRow[] {
  return house.chambers.filter((c) =>
    bill.houses === undefined
      ? c.optional !== true
      : bill.houses.includes(c.id),
  );
}

function sits(ctx: SceneCtx, c: GwChamberRow): boolean {
  return c.sits === undefined || holds(ctx, c.sits);
}

// ---- Factions ----

function factionStart(gw: GreatWar, row: GwFactionRow): GwFactionState {
  return {
    id: row.id,
    status: row.start,
    strength: clampTo(row.strength ?? 2, 0, GW_FACTION_STRENGTH_MAX),
    heat: 0,
    step: 0,
    ignored: 0,
    held: -1,
    leader: null,
    since: gw.s.chapter,
    trend: 0,
    why: null,
    asking: null,
    asked: -9,
    deals: [],
    seats: null,
  };
}

/** The leader now: the radical once the moderates have given way. */
function leaderNow(
  gw: GreatWar,
  seat: GwSeatState,
  row: GwFactionRow,
  st: GwFactionState,
): string | null {
  const fit = (id: string) => {
    const p = gw.person(id);
    // Pack-only outsiders (`<tag>_i_<name>`) have no state: always at hand.
    return p === null || p.status === "active";
  };
  if (st.step >= 3 && row.radical !== undefined && fit(row.radical)) {
    return row.radical;
  }
  const ctx = ctxOf(gw, seat);
  for (const l of row.leaders) {
    if (!fit(l.person)) continue;
    if (l.when === undefined || holds(ctx, l.when)) return l.person;
  }
  return null;
}

/** The cast rule `{ faction_leader }`: its leader, if it sits or stirs. */
export function factionLeader(
  gw: GreatWar,
  seat: GwSeatState,
  id: string,
): string | null {
  const st = factionOf(seat, id);
  const row = factionRow(id);
  if (st === null || row === null || st.status === "merged") return null;
  return leaderNow(gw, seat, row, st);
}

function heatCap(row: GwFactionRow): number {
  const steps = stepsOf(row);
  return steps.length === 0 ? PLAIN_MAX : steps[steps.length - 1].at;
}

/** Step rows that count: temper 4 only behind a plot. */
function stepsOf(row: GwFactionRow) {
  const steps = row.steps ?? [];
  return row.plot === undefined ? steps.slice(0, 2) : steps.slice(0, 3);
}

function stepOf(row: GwFactionRow, heat: number): number {
  if (heat <= 0) return 0;
  const passed = stepsOf(row).filter((s) => heat >= s.at).length;
  return Math.min(GW_FACTION_STEP_MAX, 1 + passed);
}

function call(seat: GwSeatState, scene: string, chapter: number): void {
  if (sceneOf(scene) === null) return;
  const waits =
    seat.scheduled.some((q) => q.scene === scene) ||
    seat.desk.some((c) => c.scene === scene);
  if (!waits) seat.scheduled.push({ scene, chapter });
}

/** A new temper: its scene comes when it rises to 2 or more. */
function settleStep(
  gw: GreatWar,
  seat: GwSeatState,
  row: GwFactionRow,
  st: GwFactionState,
): void {
  const was = st.step;
  st.step = stepOf(row, st.heat);
  if (st.step === was) return;
  st.leader = leaderNow(gw, seat, row, st);
  if (st.step > was && st.step >= 2) {
    const s = stepsOf(row)[st.step - 2];
    if (s !== undefined) call(seat, s.scene, gw.s.chapter + 1);
    reason(gw, seat, `house_temper_${st.step}`, st.leader ?? undefined);
  }
  if (st.step < was && st.step <= 1 && was >= 2) {
    reason(gw, seat, "house_temper_down", st.leader ?? undefined);
  }
}

function heatBy(
  gw: GreatWar,
  seat: GwSeatState,
  id: string,
  delta: number,
): void {
  const st = factionOf(seat, id);
  const row = factionRow(id);
  if (st === null || row === null) return;
  st.heat = clampTo(st.heat + delta, 0, heatCap(row));
  settleStep(gw, seat, row, st);
}

function growBy(st: GwFactionState, delta: number, key: string | null): void {
  const was = st.strength;
  st.strength = clampTo(st.strength + delta, 0, GW_FACTION_STRENGTH_MAX);
  if (st.strength === was) return;
  st.trend = st.strength > was ? 1 : -1;
  if (key !== null) st.why = key;
}

/** One faction's months: strength, temper, faded slights, settled deals. */
function factionMonths(
  gw: GreatWar,
  seat: GwSeatState,
  row: GwFactionRow,
  st: GwFactionState,
): void {
  const ctx = ctxOf(gw, seat);
  let moved = false;
  for (const g of row.grows ?? []) {
    if (!everyMonths(gw, g.every) || !holds(ctx, g.when)) continue;
    growBy(st, g.by, g.key);
    moved = true;
  }
  if (!moved && everyMonths(gw, 3)) st.trend = 0;
  if (st.ignored > 0 && everyMonths(gw, GW_IGNORED_FADE)) st.ignored--;
  if (isLongChapter(gw)) {
    const months = monthsOf(gw);
    const fed = (row.feeds ?? []).filter((f) => holds(ctx, f.when));
    const cooled = (row.cools ?? []).filter((f) => holds(ctx, f.when));
    const by = fed.reduce((n, f) => n + (f.by ?? 1), 0);
    const off = cooled.reduce((n, f) => n + (f.by ?? 1), 0);
    const delta = (by > 0 ? by : -1) * months - off * months;
    if (fed.length > 0) st.why = fed[0].key;
    else if (cooled.length > 0) st.why = cooled[0].key;
    st.heat = clampTo(st.heat + delta, 0, heatCap(row));
  }
  settleDeals(gw, seat, st);
  settleStep(gw, seat, row, st);
  if (st.held !== -1 && st.held < gw.s.chapter) st.held = -1;
}

/** Deals that fell due: kept ones cool the faction, broken ones heat it. */
function settleDeals(gw: GreatWar, seat: GwSeatState, st: GwFactionState) {
  st.deals = st.deals.filter((key) => {
    const p = seat.promises.find((x) => x.key === key);
    if (p === undefined) return false;
    if (p.kept) {
      st.heat = Math.max(0, st.heat - 2);
      reason(gw, seat, "house_deal_kept", st.leader ?? undefined);
      return false;
    }
    if (p.broken) {
      st.heat += 2;
      return false;
    }
    return true;
  });
}

/** Splits and joins, by state, never by date. */
function splitsAndJoins(gw: GreatWar, seat: GwSeatState): void {
  const ctx = ctxOf(gw, seat);
  const house = seat.house!;
  for (const row of factionRows(seat.tag)) {
    const st = factionOf(seat, row.id);
    if (st === null) continue;
    const sp = row.splits;
    if (sp !== undefined && st.status === "in") {
      const into = factionOf(seat, sp.into);
      if (into?.status === "out" && holds(ctx, sp.when)) {
        into.status = "in";
        into.since = gw.s.chapter;
        into.strength = clampTo(sp.takes, 1, GW_FACTION_STRENGTH_MAX);
        growBy(st, -sp.takes, "split");
        // The seats go with them: the house gains no voice by a split.
        const { left, moved } = moveSeats(seatsNow(seat, row), sp.takes);
        st.seats = left;
        into.seats = moved;
        into.leader = factionLeader(gw, seat, sp.into);
        if (sp.scene !== undefined) call(seat, sp.scene, gw.s.chapter + 1);
        reason(gw, seat, "house_split", into.leader ?? undefined);
        house.story = {
          kind: "split",
          faction: sp.into,
          chapter: gw.s.chapter,
        };
        news(gw, "house_split", seat.tag);
      }
    }
    const jn = row.joins;
    if (jn === undefined) continue;
    const into = factionOf(seat, jn.into);
    if (into === null) continue;
    const members = [row.id, ...jn.with]
      .map((id) => factionOf(seat, id))
      .filter((x): x is GwFactionState => x !== null);
    if (into.status === "out" && st.status === "in" && holds(ctx, jn.when)) {
      const sitting = members.filter((m) => m.status === "in");
      const sum = sitting.reduce((n, m) => n + m.strength, 0);
      // Their seats are pooled; each keeps its own to take back if they part.
      into.seats = poolSeats(
        sitting.map((m) => seatsNow(seat, factionRow(m.id)!)),
      );
      for (const m of members) {
        if (m.status !== "in") continue;
        m.status = "merged";
        m.since = gw.s.chapter;
      }
      into.status = "in";
      into.since = gw.s.chapter;
      into.strength = clampTo(sum, 1, GW_FACTION_STRENGTH_MAX);
      into.leader = factionLeader(gw, seat, jn.into);
      if (jn.scene !== undefined) call(seat, jn.scene, gw.s.chapter + 1);
      reason(gw, seat, "house_joined", into.leader ?? undefined);
      house.story = { kind: "joined", faction: jn.into, chapter: gw.s.chapter };
      news(gw, "house_joined", seat.tag);
    } else if (
      into.status === "in" &&
      jn.parts !== undefined &&
      holds(ctx, jn.parts)
    ) {
      into.status = "out";
      into.since = gw.s.chapter;
      into.seats = null;
      for (const m of members) {
        if (m.status !== "merged") continue;
        m.status = "in";
        m.since = gw.s.chapter;
      }
      reason(gw, seat, "house_parted");
    }
  }
}

// ---- The count ----

/** A faction's side on the moving bill, and whether a deal was broken. */
function sideOf(
  gw: GreatWar,
  seat: GwSeatState,
  bill: GwBillRow,
  st: GwLawState,
  id: string,
): { side: GwSide; broke: boolean } {
  const f = factionOf(seat, id);
  const row = factionRow(id);
  if (f === null || row === null || f.status !== "in") {
    return { side: 0, broke: false };
  }
  const deal = st.deals.includes(id);
  // A file holds its leader: the faction stays away (S2 sets `held`).
  if (f.held >= gw.s.chapter) return { side: 0, broke: false };
  // A boycott, or the silence before a plot.
  if (f.step >= 3) return { side: 0, broke: deal };
  const turned = f.step === 2 || blocNow(gw, seat, row.bloc) <= -3;
  if (turned) return { side: -1, broke: deal };
  if (deal) return { side: 1, broke: false };
  const text = st.text === null ? undefined : bill.texts?.[st.text]?.[id];
  const side = text ?? bill.stance[id] ?? 0;
  // The sponsor's camp: a faction that would stay away comes in for him.
  if (side === 0 && st.warm.includes(id)) return { side: 1, broke: false };
  return { side, broke: false };
}

interface ChamberCount {
  id: GwChamber;
  count: number;
  /** Fails whatever the count: a consent faction against, a closed chamber. */
  blocked: boolean;
  kind: GwChamberRow["kind"];
}

function countIn(
  gw: GreatWar,
  seat: GwSeatState,
  n: GwNationState,
  bill: GwBillRow,
  row: GwLawRow,
  st: GwLawState,
  c: GwChamberRow,
  table: number,
): ChamberCount {
  const ctx = ctxOf(gw, seat);
  if (!sits(ctx, c)) {
    return { id: c.id, count: CLOSED, blocked: true, kind: c.kind };
  }
  let count =
    (c.inst === undefined ? 0 : (n.inst[c.inst] ?? 0)) +
    row.lean +
    st.support +
    table;
  for (const f of factionRows(seat.tag)) {
    const seats = seatsNow(seat, f)[c.id] ?? 0;
    if (seats === 0) continue;
    count += seats * sideOf(gw, seat, bill, st, f.id).side;
  }
  const blocked =
    c.kind === "consent" &&
    c.consent !== undefined &&
    sideOf(gw, seat, bill, st, c.consent).side <= 0;
  return { id: c.id, count, blocked, kind: c.kind };
}

/** Each chamber's count of the moving bill; `skip`: chambers gone round. */
export function houseCounts(
  gw: GreatWar,
  seat: GwSeatState,
  law: string,
  table: number,
  skip: readonly GwChamber[] = [],
): ChamberCount[] {
  const n = gw.nation(seat.tag);
  const house = houseRow(seat.tag);
  const bill = billRow(seat, law);
  const row = lawRow(law);
  const st = n?.laws.find((x) => x.id === law) ?? null;
  if (n === null || house === null || bill === null || row === null) return [];
  const live: GwLawState = st ?? {
    id: law,
    stage: "idle",
    since: -99,
    support: 0,
    how: "none",
    text: null,
    lost: 0,
    after: false,
    origin: "seat",
    by: null,
    sponsor: null,
    deals: [],
    whip: -1,
    delayTo: -1,
    warm: [],
  };
  const gone = [...skip, ...closedRound(gw, seat, house, bill)];
  return chambersOf(house, bill)
    .filter((c) => !gone.includes(c.id))
    .map((c) => countIn(gw, seat, n, bill, row, live, c, table));
}

/**
 * Chambers that don't sit and that the way round carries for this bill now
 * (Vienna's half under §14): they don't block; the others count alone.
 */
export function closedRound(
  gw: GreatWar,
  seat: GwSeatState,
  house: GwHouseRow,
  bill: GwBillRow,
): GwChamber[] {
  const around = house.around;
  if (around === undefined || bill.around !== true) return [];
  const ctx = ctxOf(gw, seat);
  if (around.when !== undefined && !holds(ctx, around.when)) return [];
  return chambersOf(house, bill)
    .filter((c) => !sits(ctx, c) && around.skips.includes(c.id))
    .map((c) => c.id);
}

/** The count the bill stands at: the worst chamber that can stop it. */
export function houseTally(counts: readonly ChamberCount[]): {
  count: number;
  stops: GwChamber | null;
  lords: boolean;
} {
  let worst: ChamberCount | null = null;
  let lords = false;
  for (const c of counts) {
    if (c.kind === "lords") {
      if (c.count < 0) lords = true;
      continue;
    }
    const v = c.blocked ? Math.min(c.count, -3) : c.count;
    if (
      worst === null ||
      v < (worst.blocked ? Math.min(worst.count, -3) : worst.count)
    ) {
      worst = c;
    }
  }
  if (worst === null) return { count: 9, stops: null, lords };
  const v = worst.blocked ? Math.min(worst.count, -3) : worst.count;
  return { count: v, stops: v < 0 ? worst.id : null, lords };
}

export function bandOf(count: number): GwVoteBand {
  if (count >= 3) return "wide";
  if (count >= 0) return "narrow";
  return count >= -2 ? "lost_narrow" : "lost_wide";
}

export function wordOf(count: number): GwWhipWord {
  if (count >= 3) return "wide";
  if (count >= 1) return "likely";
  if (count === 0) return "even";
  return count >= -2 ? "short" : "hopeless";
}

// ---- The whip ----

/** The house's counter now: a person id, or a pack-only outsider. */
export function whipOf(gw: GreatWar, seat: GwSeatState): string | null {
  const house = houseRow(seat.tag);
  if (house === null) return null;
  const rules = "any_of" in house.whip ? house.whip.any_of : [house.whip];
  for (const r of rules) {
    if ("past" in r) return r.past;
    const scene = {
      id: "gw_house_whip",
      nation: [seat.tag],
      kind: "wire" as const,
      cast: { whip: r },
      salience: 0,
      tags: [],
      variants: [{ id: "base" }],
    };
    const id = castOf(gw, seat, scene)?.whip ?? null;
    if (id !== null) return id;
  }
  return null;
}

/** His word on the moving bill this chapter: the true count and his error. */
function whipWord(
  gw: GreatWar,
  seat: GwSeatState,
  law: string,
  truth: number,
): { word: number; sure: boolean } {
  const id = whipOf(gw, seat);
  const p = id === null ? null : gw.person(id);
  const band =
    p?.competence[1] ?? gw.s.sources.find((x) => x.id === "whip")?.band ?? 2;
  const spread = GW_WHIP_SPREAD[band - 1] ?? 1;
  const r = wwRoll(gw.s.seed, P_WHIP, idHash(law), gw.s.chapter);
  let err = spread === 0 ? 0 : (r % (2 * spread + 1)) - spread;
  const t = p?.temperament ?? null;
  if (t === "anxious") err -= 1;
  if (t === "arrogant") err += 1;
  const word = GW_WHIP_WORDS.indexOf(wordOf(truth + err));
  return { word, sure: spread === 0 && t !== "anxious" && t !== "arrogant" };
}

/** The whip speaks: filed as a report that may be wrong. */
function whipReport(gw: GreatWar, seat: GwSeatState, st: GwLawState): void {
  const table = 0;
  const truth = houseTally(houseCounts(gw, seat, st.id, table)).count;
  const { word, sure } = whipWord(gw, seat, st.id, truth);
  st.whip = word;
  const s = gw.s;
  s.reports.push({
    uid: s.nextReport++,
    fact: "count",
    tag: seat.tag,
    theatre: null,
    source: "whip",
    stamp: sure ? "confirmed" : "unconfirmed",
    claim: word,
    truth: GW_WHIP_WORDS.indexOf(wordOf(truth)),
    smallID: seat.smallID,
    chapter: s.chapter,
    checkDay: sure ? null : CHECK_LATER,
    about: st.id,
  });
}

/** After the vote: was the whip right, and his reports are put right now. */
function judgeWhip(
  gw: GreatWar,
  seat: GwSeatState,
  st: GwLawState,
  count: number,
): void {
  const house = seat.house;
  if (house === undefined || st.whip < 0) return;
  const right = GW_WHIP_WORDS[st.whip] === wordOf(count);
  if (right) house.right++;
  else house.wrong++;
  reason(gw, seat, right ? "house_whip_right" : "house_whip_wrong");
  for (const r of gw.s.reports) {
    if (r.smallID !== seat.smallID || r.fact !== "count") continue;
    if (r.about === st.id && r.checkDay === CHECK_LATER) {
      r.checkDay = gw.s.day;
    }
  }
}

// ---- What the engine (Laws.ts) asks of a house bill ----

/** The day: the count is the count. Null: not a house bill. */
export function housePut(
  gw: GreatWar,
  seat: GwSeatState,
  st: GwLawState,
  table: number,
): { pass: boolean; stops: string | null; sign: boolean } | null {
  const bill = billRow(seat, st.id);
  if (bill === null) return null;
  const counts = houseCounts(gw, seat, st.id, table);
  const t = houseTally(counts);
  // The Lords below zero put it off once; past the delay they can't.
  if (t.count >= 0 && t.lords && bill.money !== true && st.delayTo === -1) {
    st.delayTo = gw.s.chapter + GW_LORDS_DELAY;
    reason(gw, seat, "house_lords_delay");
    return { pass: false, stops: "lords_delay", sign: false };
  }
  vote(gw, seat, bill, st, t.count);
  // A closed chamber went by the way round: its factions take that ill.
  const house = houseRow(seat.tag)!;
  const closed = closedRound(gw, seat, house, bill);
  if (t.count >= 0 && closed.length > 0 && house.around !== undefined) {
    for (const h of house.around.heats) heatBy(gw, seat, h.faction, h.by);
    if (seat.house !== undefined) seat.house.around++;
    reason(gw, seat, `house_round_${house.around.id}`);
  }
  const sign = t.count >= 0 && house.signs === true;
  return { pass: t.count >= 0, stops: t.stops, sign };
}

/** The house passed it: the sovereign's paper to sign or refuse. */
export function houseSignCard(gw: GreatWar, seat: GwSeatState): void {
  const scene = sceneOf(houseIds.sign(seat.tag));
  const card = scene === null ? null : makeCard(gw, seat, scene, "scheduled");
  if (card !== null) placeCard(gw, seat, card);
}

/** Refused: those who carried it take it ill, and the house's weight falls. */
export function houseRefused(
  gw: GreatWar,
  seat: GwSeatState,
  st: GwLawState,
): void {
  const bill = billRow(seat, st.id);
  const house = houseRow(seat.tag);
  const n = gw.nation(seat.tag);
  if (bill === null || house === null || n === null) return;
  const first = chambersOf(house, bill).find((c) => c.inst !== undefined);
  if (first?.inst !== undefined && n.inst[first.inst] !== undefined) {
    n.inst[first.inst] = clampTo(n.inst[first.inst]! - 1, -5, 5);
  }
  for (const row of factionRows(seat.tag)) {
    if (sideOf(gw, seat, bill, st, row.id).side <= 0) continue;
    heatBy(gw, seat, row.id, 2);
    reason(
      gw,
      seat,
      "house_refused_by",
      factionOf(seat, row.id)?.leader ?? undefined,
    );
  }
  reason(gw, seat, "house_refused");
}

/** Who voted how, which deal held, the result card. */
function vote(
  gw: GreatWar,
  seat: GwSeatState,
  bill: GwBillRow,
  st: GwLawState,
  count: number,
): void {
  const house = seat.house;
  const band = bandOf(count);
  if (house !== undefined) {
    house.last = { law: st.id, band, chapter: gw.s.chapter };
  }
  judgeWhip(gw, seat, st, count);
  const chambers = new Set(
    chambersOf(houseRow(seat.tag)!, bill).map((c) => c.id),
  );
  for (const row of factionRows(seat.tag)) {
    const sitsHere = Object.entries(seatsNow(seat, row)).some(
      ([c, k]) => (k ?? 0) > 0 && chambers.has(c as GwChamber),
    );
    if (!sitsHere) continue;
    const f = factionOf(seat, row.id);
    if (f?.status !== "in") continue;
    const { side, broke } = sideOf(gw, seat, bill, st, row.id);
    const who = f.leader ?? undefined;
    if (st.warm.includes(row.id) && side > 0) {
      reason(gw, seat, "house_warmed", who);
    }
    const key =
      side > 0
        ? "house_voted_for"
        : side < 0
          ? "house_voted_against"
          : "house_stayed_away";
    reason(gw, seat, key, who);
    if (broke) {
      // He broke his word first: the seat may drop its own to him.
      const k = `house_${row.id}_${st.id}`;
      seat.promises = seat.promises.filter((p) => p.key !== k);
      f.deals = f.deals.filter((d) => d !== k);
      reason(gw, seat, "house_broke_word", who);
    }
  }
  const scene = sceneOf(houseIds.result(seat.tag));
  const card = scene === null ? null : makeCard(gw, seat, scene, "scheduled");
  if (card !== null) placeCard(gw, seat, card);
}

/** The way round, if this house bill can take it now. */
export function houseCanRound(
  gw: GreatWar,
  seat: GwSeatState,
  law: string,
): boolean | null {
  const bill = billRow(seat, law);
  if (bill === null) return null;
  const around = houseRow(seat.tag)?.around;
  const n = gw.nation(seat.tag);
  if (around === undefined || n === null || bill.around !== true) return false;
  if (around.when !== undefined && !holds(ctxOf(gw, seat), around.when)) {
    return false;
  }
  return n.authority >= around.price;
}

/** Round the house: the price comes after; chambers it can't pass still vote. */
export function houseRound(
  gw: GreatWar,
  seat: GwSeatState,
  st: GwLawState,
  table: number,
): { pass: boolean } | null {
  const can = houseCanRound(gw, seat, st.id);
  if (can === null) return null;
  if (!can) return { pass: false };
  const around = houseRow(seat.tag)!.around!;
  const n = gw.nation(seat.tag)!;
  const bill = billRow(seat, st.id)!;
  n.authority = clampTo(n.authority - around.price, 0, 100);
  if (around.inst !== undefined && n.inst[around.inst] !== undefined) {
    n.inst[around.inst] = clampTo(
      n.inst[around.inst]! + (around.delta ?? 0),
      -5,
      5,
    );
  }
  for (const h of around.heats) heatBy(gw, seat, h.faction, h.by);
  if (seat.house !== undefined) seat.house.around++;
  reason(gw, seat, `house_round_${around.id}`);
  const left = houseCounts(gw, seat, st.id, table, around.skips);
  const t = houseTally(left);
  if (left.length > 0) vote(gw, seat, bill, st, t.count);
  if (t.count < 0) reason(gw, seat, "house_round_blocked");
  return { pass: t.count >= 0 };
}

/** Chapters a house bill is argued before its day. */
export function persuadeChapters(seat: GwSeatState, law: string): number {
  const bill = billRow(seat, law);
  const house = houseRow(seat.tag);
  if (bill === null || house === null) return 1;
  return Math.min(2, Math.max(1, chambersOf(house, bill).length));
}

/** A house bill taken up: the sponsor's draft talk, with who drafts it. */
export function houseDraft(
  gw: GreatWar,
  seat: GwSeatState,
  st: GwLawState,
  sponsor: string | null,
): boolean {
  if (billRow(seat, st.id) === null) return false;
  const scene = sceneOf(houseIds.draft(st.id));
  const card =
    scene === null ? null : makeCard(gw, seat, scene, "scheduled", sponsor);
  if (card === null) return false;
  st.sponsor = card.cast.who ?? null;
  placeCard(gw, seat, card);
  return true;
}

/** A bill comes into the house from someone else: no draft, their text. */
export function houseBring(
  gw: GreatWar,
  seat: GwSeatState,
  law: string,
  origin: GwLawOrigin,
  by: string | null,
): boolean {
  const n = gw.nation(seat.tag);
  const row = lawRow(law);
  if (n === null || row === null || row.tag !== seat.tag) return false;
  if (n.laws.some((x) => MOVING.includes(x.stage))) return false;
  let st = n.laws.find((x) => x.id === law);
  if (st !== undefined && st.stage === "force") return false;
  if (st === undefined) {
    st = {
      id: law,
      stage: "idle",
      since: -99,
      support: 0,
      how: "none",
      text: null,
      lost: 0,
      after: false,
      origin: "seat",
      by: null,
      sponsor: null,
      deals: [],
      whip: -1,
      delayTo: -1,
      warm: [],
    };
    n.laws.push(st);
  }
  const amend = by === null ? undefined : factionRow(by)?.amends?.[law];
  st.stage = "persuade";
  st.since = gw.s.chapter;
  st.support = 0;
  st.how = "none";
  st.text = amend ?? row.draft[0].id;
  st.origin = origin;
  st.by = by;
  st.deals = [];
  st.whip = -1;
  st.delayTo = -1;
  st.warm = [];
  if (seat.house !== undefined) seat.house.calls = GW_HOUSE_CALLS;
  reason(gw, seat, `house_brought_${origin}`);
  return true;
}

/**
 * The bill moved into the house (a draft decided): the extra calls open, and
 * the factions of the sponsor's camp warm to it, quietly; the reason lines
 * say so after the vote.
 */
export function houseOpened(
  gw: GreatWar,
  seat: GwSeatState,
  law: string,
): void {
  if (billRow(seat, law) === null || seat.house === undefined) return;
  seat.house.calls = GW_HOUSE_CALLS;
  const st = gw.nation(seat.tag)?.laws.find((x) => x.id === law);
  if (st === undefined || st.sponsor === null) return;
  const camps =
    gwContent().people.find((p) => p.id === st.sponsor)?.camps ?? [];
  st.warm = factionRows(seat.tag)
    .filter((f) => (f.camps ?? []).some((c) => camps.includes(c)))
    .map((f) => f.id);
  for (const id of st.warm) {
    const f = factionOf(seat, id);
    if (f !== null) f.heat = Math.max(0, f.heat - 1);
  }
}

/** A lobby talk spends an extra call while any are left. */
export function spendHouseCall(seat: GwSeatState, topic: string): boolean {
  const h = seat.house;
  if (h === undefined || h.calls <= 0 || !topic.startsWith("gw_lb_")) {
    return false;
  }
  h.calls--;
  return true;
}

// ---- Asks and bills of the factions ----

function opensNow(gw: GreatWar, seat: GwSeatState, law: string): boolean {
  const row = lawRow(law);
  const n = gw.nation(seat.tag);
  if (row === null || n === null) return false;
  const st = n.laws.find((x) => x.id === law);
  if (st !== undefined && st.stage !== "idle") return false;
  if (st !== undefined && gw.s.chapter - st.since < 4) return false;
  return holds(ctxOf(gw, seat), row.opens);
}

function canStart(seat: GwSeatState, row: GwFactionRow): boolean {
  const house = houseRow(seat.tag);
  if (house === null) return false;
  return house.chambers.some(
    (c) => c.starts === true && (seatsNow(seat, row)[c.id] ?? 0) > 0,
  );
}

/** Papers that closed unanswered: a draft takes its first text, an ask lies. */
function unanswered(gw: GreatWar, seat: GwSeatState): void {
  const there = (scene: string) =>
    seat.desk.some((c) => c.scene === scene) ||
    seat.scheduled.some((q) => q.scene === scene);
  const m = movingBill(gw, seat);
  if (m !== null && m.st.stage === "draft" && !there(houseIds.draft(m.st.id))) {
    m.st.text = m.row.draft[0].id;
    m.st.support += m.row.draft[0].support;
    m.st.stage = "persuade";
    m.st.since = gw.s.chapter;
  }
  for (const f of seat.house?.factions ?? []) {
    if (f.asking === null || there(houseIds.visit(f.id))) continue;
    if (gw.s.chapter <= f.asked + 1) continue;
    f.asking = null;
    f.ignored++;
  }
}

function asksStep(gw: GreatWar, seat: GwSeatState): void {
  const n = gw.nation(seat.tag);
  if (n === null || n.laws.some((x) => MOVING.includes(x.stage))) return;
  let visited = false;
  for (const row of factionRows(seat.tag)) {
    const st = factionOf(seat, row.id);
    if (st === null || st.status !== "in" || st.step >= 4) continue;
    const bill = (row.bills ?? []).find((b) => opensNow(gw, seat, b));
    if (bill === undefined) continue;
    // Ignored twice, strong: it comes in by itself.
    if (
      st.ignored >= GW_IGNORED_LIMIT &&
      st.strength >= GW_BRING_STRENGTH &&
      canStart(seat, row)
    ) {
      if (houseBring(gw, seat, bill, "house", row.id)) {
        st.ignored = 0;
        st.asking = null;
        news(gw, "house_brought", seat.tag);
        return;
      }
    }
    if (visited || st.asking !== null) continue;
    if (st.strength < GW_ASK_STRENGTH) continue;
    if (gw.s.chapter - st.asked < GW_ASK_GAP) continue;
    if (sceneOf(houseIds.visit(row.id)) === null) continue;
    st.asking = bill;
    st.asked = gw.s.chapter;
    call(seat, houseIds.visit(row.id), gw.s.chapter + 1);
    visited = true;
  }
}

/** The sponsor works one faction on his own; his politics decide how well. */
function sponsorWorks(gw: GreatWar, seat: GwSeatState): void {
  const m = movingBill(gw, seat);
  if (m === null || m.st.stage !== "persuade" || m.st.sponsor === null) return;
  const p = gw.person(m.st.sponsor);
  const band = p?.competence[1] ?? 2;
  const chambers = new Set(
    chambersOf(houseRow(seat.tag)!, m.bill).map((c) => c.id),
  );
  const target = factionRows(seat.tag)
    .filter((f) =>
      Object.entries(seatsNow(seat, f)).some(
        ([c, k]) => (k ?? 0) > 0 && chambers.has(c as GwChamber),
      ),
    )
    .filter((f) => !m.st.deals.includes(f.id))
    .filter((f) => sideOf(gw, seat, m.bill, m.st, f.id).side <= 0)
    .filter((f) => (factionOf(seat, f.id)?.step ?? 0) < 2)
    .sort((a, b) => seatsSum(seat, b) - seatsSum(seat, a))[0];
  if (target === undefined) return;
  const r = wwRoll(gw.s.seed, P_SPONSOR, idHash(m.st.id), gw.s.chapter) % 100;
  if (r < (GW_SPONSOR_ODDS[band - 1] ?? 50)) {
    m.st.support += 1;
    reason(gw, seat, "house_sponsor_won", m.st.sponsor);
  } else {
    reason(gw, seat, "house_sponsor_failed", m.st.sponsor);
  }
}

// ---- Chapter step ----

function ensureHouse(gw: GreatWar, seat: GwSeatState): GwHouseState | null {
  if (houseRow(seat.tag) === null) return null;
  const rows = factionRows(seat.tag);
  if (rows.length === 0) return null;
  seat.house ??= gwHouseStart();
  const h = seat.house;
  for (const row of rows) {
    if (h.factions.some((f) => f.id === row.id)) continue;
    const st = factionStart(gw, row);
    h.factions.push(st);
    st.leader = leaderNow(gw, seat, row, st);
  }
  return h;
}

/** Chapter step, after the laws: factions move, the whip speaks, leaders ask. */
export function houseStep(gw: GreatWar): void {
  for (const seat of gw.s.seats) {
    if (seat.memoir !== null) continue;
    const h = ensureHouse(gw, seat);
    if (h === null) continue;
    for (const row of factionRows(seat.tag)) {
      const st = factionOf(seat, row.id);
      if (st === null || st.status === "merged" || st.status === "out") {
        continue;
      }
      factionMonths(gw, seat, row, st);
      st.leader = leaderNow(gw, seat, row, st);
    }
    splitsAndJoins(gw, seat);
    unanswered(gw, seat);
    sponsorWorks(gw, seat);
    const m = movingBill(gw, seat);
    const inHouse =
      m !== null && (m.st.stage === "persuade" || m.st.stage === "vote");
    h.calls = inHouse ? GW_HOUSE_CALLS : 0;
    if (inHouse) whipReport(gw, seat, m.st);
    asksStep(gw, seat);
  }
}

// ---- Scenes read and act ----

const inRange = (v: number, r: { min?: number; max?: number }) =>
  (r.min === undefined || v >= r.min) && (r.max === undefined || v <= r.max);

type HouseCond = Extract<
  GwWorldCond,
  {
    is:
      | "faction"
      | "faction_temper"
      | "faction_asks"
      | "faction_want"
      | "deal"
      | "amendable"
      | "lobby"
      | "vote_band"
      | "law_origin"
      | "whip_said"
      | "around";
  }
>;

/** The price the leader names now for the moving bill, if any. */
function wantNow(ctx: SceneCtx, id: string) {
  const m = movingBill(ctx.gw, ctx.seat);
  const row = factionRow(id);
  if (m === null || row === null || m.st.deals.includes(id)) return null;
  const free = { ...ctx, cast: {} };
  return (
    (row.wants ?? []).find(
      (w) => w.when === undefined || holds(free, w.when),
    ) ?? null
  );
}

export function houseHolds(ctx: SceneCtx, c: HouseCond): boolean {
  const { gw, seat } = ctx;
  switch (c.is) {
    case "faction": {
      const f = factionOf(seat, c.id);
      if (f === null) return false;
      if (c.of !== undefined && !c.of.includes(f.status)) return false;
      return inRange(f.strength, c);
    }
    case "faction_temper": {
      const f = factionOf(seat, c.id);
      return f !== null && inRange(f.step, c);
    }
    case "faction_asks":
      return factionOf(seat, c.id)?.asking === c.law;
    case "faction_want": {
      const w = wantNow(ctx, c.id);
      return w !== null && (c.want === "any" || w.id === c.want);
    }
    case "deal":
      return movingBill(gw, seat)?.st.deals.includes(c.id) === true;
    case "amendable": {
      const m = movingBill(gw, seat);
      const text = m === null ? undefined : factionRow(c.id)?.amends?.[m.st.id];
      return (
        m !== null &&
        text !== undefined &&
        m.st.text !== text &&
        m.row.draft.some((d) => d.id === text)
      );
    }
    case "lobby": {
      const m = movingBill(gw, seat);
      const f = factionOf(seat, c.id);
      const row = factionRow(c.id);
      const open = m?.st.stage === "persuade" || m?.st.stage === "vote";
      if (m === null || !open || f?.status !== "in") return false;
      const chambers = chambersOf(houseRow(seat.tag)!, m.bill);
      return (
        row !== null &&
        chambers.some((ch) => (seatsNow(seat, row)[ch.id] ?? 0) > 0)
      );
    }
    case "vote_band": {
      const last = seat.house?.last ?? null;
      if (last === null) return false;
      if (c.law !== undefined && last.law !== c.law) return false;
      return c.of.includes(last.band);
    }
    case "law_origin": {
      const st = gw.nation(seat.tag)?.laws.find((x) => x.id === c.id);
      return st !== undefined && c.of.includes(st.origin);
    }
    case "whip_said": {
      const m = movingBill(gw, seat);
      if (m === null || m.st.whip < 0) return false;
      return c.of.includes(GW_WHIP_WORDS[m.st.whip]);
    }
    case "around":
      return inRange(seat.house?.around ?? 0, c);
  }
}

type HouseEffect = Extract<
  GwWorldEffect,
  {
    do:
      | "faction"
      | "faction_grow"
      | "faction_under"
      | "deal"
      | "amend"
      | "bill_answer"
      | "law_start";
  }
>;

export function houseEffect(ctx: SceneCtx, e: HouseEffect): void {
  const { gw, seat } = ctx;
  switch (e.do) {
    case "faction":
      heatBy(gw, seat, e.id, e.delta);
      return;
    case "faction_grow": {
      const f = factionOf(seat, e.id);
      if (f !== null) growBy(f, e.delta, null);
      return;
    }
    case "faction_under": {
      const f = factionOf(seat, e.id);
      if (f === null || f.status === "under") return;
      f.status = "under";
      f.since = gw.s.chapter;
      reason(gw, seat, "house_under", f.leader ?? undefined);
      return;
    }
    case "deal":
      takeDeal(ctx, e.id);
      return;
    case "amend": {
      if (!houseHolds(ctx, { is: "amendable", id: e.id })) return;
      const m = movingBill(gw, seat)!;
      m.st.text = factionRow(e.id)!.amends![m.st.id];
      reason(
        gw,
        seat,
        "house_amended",
        factionOf(seat, e.id)?.leader ?? undefined,
      );
      return;
    }
    case "bill_answer": {
      const f = factionOf(seat, e.id);
      if (f === null || f.asking === null) return;
      const law = f.asking;
      f.asking = null;
      if (e.yes && houseBring(gw, seat, law, "faction", e.id)) {
        f.heat = Math.max(0, f.heat - 1);
        return;
      }
      f.ignored++;
      heatBy(gw, seat, e.id, GW_REFUSED_HEAT);
      return;
    }
    case "law_start":
      houseBring(gw, seat, e.law, e.origin, null);
      return;
  }
}

/** The leader's price is taken: a promise to him, his faction for the bill. */
function takeDeal(ctx: SceneCtx, id: string): void {
  const { gw, seat } = ctx;
  const w = wantNow(ctx, id);
  const m = movingBill(gw, seat);
  const f = factionOf(seat, id);
  if (w === null || m === null || f === null) return;
  const key = `house_${id}_${m.st.id}`;
  const who = f.leader ?? factionLeader(gw, seat, id);
  // A price paid on the spot (no `keep`) leaves nothing owed: no promise.
  const owed = w.keep !== undefined;
  if (owed && who !== null && !seat.promises.some((p) => p.key === key)) {
    seat.promises.push({
      key,
      who,
      due: gw.s.chapter + (w.chapters ?? 6),
      kept: false,
      broken: false,
      keep: JSON.stringify(w.keep as GwCond),
      back: w.back ?? null,
    });
    f.deals.push(key);
  }
  m.st.deals.push(id);
  f.heat = Math.max(0, f.heat - 1);
  runEffects(ctx, w.effects ?? []);
  reason(gw, seat, "house_deal", who ?? undefined);
}

// ---- The view ----

function seatsSum(seat: GwSeatState, row: GwFactionRow): number {
  return Object.values(seatsNow(seat, row)).reduce<number>(
    (n, k) => n + (k ?? 0),
    0,
  );
}

export function houseView(
  gw: GreatWar,
  seat: GwSeatState,
): GwHouseView | undefined {
  const house = houseRow(seat.tag);
  const h = seat.house;
  if (house === null || h === undefined) return undefined;
  const rows = factionRows(seat.tag);
  const factions = rows.flatMap((row) => {
    const f = factionOf(seat, row.id);
    if (f === null || f.status === "out" || f.status === "merged") return [];
    return [
      {
        id: row.id,
        bloc: row.bloc,
        status: f.status,
        strength: f.strength,
        temper: f.step,
        trend: f.trend,
        why: f.why,
        leader: f.leader,
        chambers: house.chambers
          .filter((c) => (seatsNow(seat, row)[c.id] ?? 0) > 0)
          .map((c) => c.id),
      },
    ];
  });
  const out = factions.find((f) => f.status === "in" && f.temper === 2);
  return {
    bill: billView(gw, seat, house),
    calls: h.calls,
    record: { right: h.right, wrong: h.wrong },
    whipPerson: whipOf(gw, seat),
    factions,
    out: out === undefined ? null : { id: out.id, bloc: out.bloc },
    around: house.around?.id ?? null,
  };
}

function billView(
  gw: GreatWar,
  seat: GwSeatState,
  house: GwHouseRow,
): GwHouseView["bill"] {
  const m = movingBill(gw, seat);
  if (m === null) return null;
  const chambers = chambersOf(house, m.bill);
  const ids = new Set(chambers.map((c) => c.id));
  const rows = factionRows(seat.tag).filter((f) =>
    Object.entries(seatsNow(seat, f)).some(
      ([c, k]) => (k ?? 0) > 0 && ids.has(c as GwChamber),
    ),
  );
  // The whip names at most two factions: the two biggest that will move.
  const named = new Set(
    rows
      .filter((r) => factionOf(seat, r.id)?.status === "in")
      .filter((r) => sideOf(gw, seat, m.bill, m.st, r.id).side !== 0)
      .sort(
        (a, b) =>
          seatsSum(seat, b) - seatsSum(seat, a) || (a.id < b.id ? -1 : 1),
      )
      .slice(0, 2)
      .map((r) => r.id),
  );
  const factions: GwBillFactionView[] = rows.flatMap((r) => {
    const f = factionOf(seat, r.id);
    if (f === null || f.status !== "in") return [];
    const topic = houseIds.lobby(r.id);
    const ctx = ctxOf(gw, seat);
    const callable =
      m.st.whip >= 0 || m.st.stage !== "draft"
        ? f.leader !== null &&
          sceneOf(topic) !== null &&
          houseHolds(ctx, { is: "lobby", id: r.id }) &&
          !seat.desk.some((c) => c.scene === topic)
        : false;
    return [
      {
        id: r.id,
        leader: f.leader,
        said:
          m.st.whip >= 0 && named.has(r.id)
            ? sideOf(gw, seat, m.bill, m.st, r.id).side
            : null,
        deal: m.st.deals.includes(r.id),
        call: callable ? topic : null,
      },
    ];
  });
  return {
    law: m.st.id,
    stage: m.st.stage as "draft" | "persuade" | "vote" | "sign",
    origin: m.st.origin,
    sponsor: m.st.sponsor,
    chambers: chambers.map((c) => c.id),
    whip:
      m.st.whip < 0
        ? null
        : {
            person: whipOf(gw, seat),
            word: GW_WHIP_WORDS[m.st.whip],
            chapter: gw.s.chapter,
          },
    factions,
    delayTo: m.st.delayTo < 0 ? null : m.st.delayTo,
  };
}
