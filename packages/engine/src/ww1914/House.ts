// Great War 1914: the house and its factions, running (brief ww158, S1). A seat
// whose country has a house row and factions keeps them in `seat.house`. A bill
// with a row in the house's bills (GwBillRow) is argued faction by faction:
// drafted with a minister, lobbied with the leaders, counted by a whip who can
// be wrong, voted by the true count (nothing rolled on the day), or carried
// round the house where the constitution allows. A bill without a row runs as
// before (Laws.ts). Plots, files and asks are the S2 files'.
import type {
  GwCard,
  GwNationState,
  GwOffice,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwSlots } from "@openfront/engine-api/ww1914/GwDepts";
import {
  GW_FACTION_STEP_MAX,
  GW_FACTION_STRENGTH_MAX,
  GW_FEED_WEARS,
  GW_WHIP_WORDS,
  GwBallot,
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
import {
  gwLawStart,
  type GwCountWord,
  type GwLawState,
  type GwLobbyView,
  type GwPressHow,
  type GwPriceKind,
} from "@openfront/engine-api/ww1914/GwLaw";
import type { GwOrderBlock } from "@openfront/engine-api/ww1914/GwOrders";
import type { GwCond } from "@openfront/engine-api/ww1914/SceneDsl";
import type {
  GwWorldCond,
  GwWorldEffect,
} from "@openfront/engine-api/ww1914/WorldDsl";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { GW_LAWS } from "@openfront/engine-lib/ww1914/content/scenes/laws";
import { genericFactionRows } from "@openfront/engine-lib/ww1914/GenericParties";
import {
  GW_AGENDA_MAX,
  GW_ASK_GAP,
  GW_ASK_STRENGTH,
  GW_BRING_STRENGTH,
  GW_BROKEN_SHUT,
  GW_DEAL_STEP,
  GW_HOUSE_CALLS,
  GW_IGNORED_FADE,
  GW_IGNORED_LIMIT,
  GW_LORDS_DELAY,
  GW_PRICES_MAX,
  GW_REBEL_TENTHS,
  GW_REFUSED_HEAT,
  GW_SPONSOR_ODDS,
  GW_WHIP_SPREAD,
  GwBillRow,
  GwChamberRow,
  GwFactionRow,
  GwHouseRow,
  GwSide,
  GwWant,
  houseIds,
  wantKind,
} from "@openfront/engine-lib/ww1914/HouseRows";
import type { GwLawRow } from "@openfront/engine-lib/ww1914/LawRows";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { BallotFaction, BallotResult, castChamber } from "./Ballot";
import { blocNow } from "./Blocs";
import { makeCard, placeCard } from "./Desk";
import { hasFile, pressWithFile } from "./Dossier";
import type { GreatWar } from "./GreatWar";
import { moveOpinion } from "./Press";
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

/** ww208: the content's faction rows, and the generic parties' (S1). */
const ALL_ROWS = new WeakMap<object, readonly GwFactionRow[]>();
function allFactionRows(): readonly GwFactionRow[] {
  const c = gwContent();
  const hit = ALL_ROWS.get(c);
  if (hit !== undefined) return hit;
  const generic = genericFactionRows(c);
  const all =
    generic.length === 0
      ? (c.factions ?? [])
      : [...(c.factions ?? []), ...generic];
  ALL_ROWS.set(c, all);
  return all;
}

export function factionRows(tag: string): GwFactionRow[] {
  return allFactionRows().filter((f) => f.tag === tag);
}

export function factionRow(id: string): GwFactionRow | null {
  return allFactionRows().find((f) => f.id === id) ?? null;
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

/** Whether a faction's row gives it seats at all (else it never sits). */
function sitsIn(id: string): boolean {
  return Object.values(factionRow(id)?.seats ?? {}).some((n) => (n ?? 0) > 0);
}

/**
 * Who a reason line names for a faction: its leader, else the man its row
 * names first (the party is still his while he waits or is out of office).
 */
function whoOf(st: GwFactionState | null): string | undefined {
  if (st === null) return undefined;
  return st.leader ?? factionRow(st.id)?.leaders[0]?.person ?? undefined;
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

/** ww208: the row's named seats per chamber, at most what it has (splits `seats`). */
function takeSeats(from: Seats, take: Seats): { left: Seats; moved: Seats } {
  const left: Seats = { ...from };
  const moved: Seats = {};
  for (const [c, k] of Object.entries(take) as [GwChamber, number][]) {
    const m = Math.min(k ?? 0, from[c] ?? 0);
    left[c] = (from[c] ?? 0) - m;
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

interface Moving {
  st: GwLawState;
  bill: GwBillRow;
  row: GwLawRow;
}

/** ww203: the house bills on the agenda, in the order they joined it. */
export function agendaBills(gw: GreatWar, seat: GwSeatState): Moving[] {
  const n = gw.nation(seat.tag);
  if (n === null) return [];
  return n.laws.flatMap((st) => {
    if (!MOVING.includes(st.stage)) return [];
    const bill = billRow(seat, st.id);
    const row = lawRow(st.id);
    return bill === null || row === null ? [] : [{ st, bill, row }];
  });
}

/**
 * The bill the house's talks are about: the lobbied one (`focus`) while it
 * is on the agenda, else the first. The scenes' "moving bill".
 */
function movingBill(gw: GreatWar, seat: GwSeatState): Moving | null {
  const all = agendaBills(gw, seat);
  const focus = seat.house?.focus ?? null;
  return all.find((m) => m.st.id === focus) ?? all[0] ?? null;
}

/** ww203: the lobby talks are about this bill now. */
export function houseFocus(seat: GwSeatState, law: string | null): void {
  if (seat.house !== undefined) seat.house.focus = law;
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

/** ww187: the chamber sits now (its row's `sits`). */
export const chamberSits = sits;

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
    called: 0,
    fed: 0,
    fedKeys: [],
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

/** ww208: the least heat that makes temper `t` for this row. */
export function heatForTemper(row: GwFactionRow, t: number): number {
  if (t <= 0) return 0;
  if (t === 1) return 1;
  const s = stepsOf(row)[t - 2];
  return s === undefined ? heatCap(row) : s.at;
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
  // Fallen two steps under the last scene's temper: the next climb is new.
  if (st.step <= st.called - 2) st.called = st.step;
  if (st.step > was && st.step >= 2 && st.step > st.called) {
    st.called = st.step;
    const s = stepsOf(row)[st.step - 2];
    if (s !== undefined) call(seat, s.scene, gw.s.chapter + 1);
    reason(gw, seat, `house_temper_${st.step}`, whoOf(st));
  }
  if (st.step < was && st.step <= 1 && was >= 2) {
    reason(gw, seat, "house_temper_down", whoOf(st));
  }
}

export function heatBy(
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
    const holding = (row.feeds ?? []).filter((f) => holds(ctx, f.when));
    // The same grievances wear out after a year of feeding it; a new one
    // starts the year again, and so does a faction that has cooled to calm.
    const keys = holding.map((f) => f.key);
    if (keys.length === 0 && st.heat === 0) {
      st.fed = 0;
      st.fedKeys = [];
    }
    const fresh = keys.filter((k) => !st.fedKeys.includes(k));
    if (fresh.length > 0) {
      st.fed = 0;
      st.fedKeys = [...st.fedKeys, ...fresh];
    }
    if (keys.length > 0) st.fed += months;
    const fed = st.fed > GW_FEED_WEARS ? [] : holding;
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
      reason(gw, seat, "house_deal_kept", whoOf(st));
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
  for (const row of factionRows(seat.tag)) {
    const st = factionOf(seat, row.id);
    if (st === null) continue;
    const sp = row.splits;
    if (sp !== undefined && st.status === "in" && holds(ctx, sp.when)) {
      splitFaction(gw, seat, row);
    }
    const jn = row.joins;
    if (jn === undefined) continue;
    const into = factionOf(seat, jn.into);
    if (into === null) continue;
    if (into.status === "out" && st.status === "in" && holds(ctx, jn.when)) {
      joinFactions(gw, seat, row);
    } else if (
      into.status === "in" &&
      jn.parts !== undefined &&
      holds(ctx, jn.parts)
    ) {
      into.status = "out";
      into.since = gw.s.chapter;
      into.seats = null;
      for (const id of [row.id, ...jn.with]) {
        const m = factionOf(seat, id);
        if (m?.status !== "merged") continue;
        m.status = "in";
        m.since = gw.s.chapter;
      }
      reason(gw, seat, "house_parted");
    }
  }
}

/**
 * The row's split now (ww208: the society calls it by state too): its new
 * faction goes `in` with its leader, taking strength and seats. False when
 * the row has no split or its new faction isn't waiting.
 */
export function splitFaction(
  gw: GreatWar,
  seat: GwSeatState,
  row: GwFactionRow,
): boolean {
  const st = factionOf(seat, row.id);
  const sp = row.splits;
  if (st?.status !== "in" || sp === undefined) return false;
  const into = factionOf(seat, sp.into);
  if (into?.status !== "out") return false;
  into.status = "in";
  into.since = gw.s.chapter;
  into.strength = clampTo(sp.takes, 1, GW_FACTION_STRENGTH_MAX);
  growBy(st, -sp.takes, "split");
  // The seats go with them: the house gains no voice by a split. A
  // faction whose row has no seats sits out (Sinn Féin, Spartacus): it
  // takes none, and the parent keeps its voice.
  if (sitsIn(sp.into)) {
    const { left, moved } =
      sp.seats === undefined
        ? moveSeats(seatsNow(seat, row), sp.takes)
        : takeSeats(seatsNow(seat, row), sp.seats);
    st.seats = left;
    into.seats = moved;
  }
  into.leader = factionLeader(gw, seat, sp.into);
  if (sp.scene !== undefined) call(seat, sp.scene, gw.s.chapter + 1);
  reason(gw, seat, "house_split", whoOf(into));
  seat.house!.story = {
    kind: "split",
    faction: sp.into,
    chapter: gw.s.chapter,
  };
  news(gw, "house_split", seat.tag);
  return true;
}

/**
 * The row's join now (ww208: the society calls it by state too): the sitting
 * members pool their seats into the new faction. False when it can't.
 */
export function joinFactions(
  gw: GreatWar,
  seat: GwSeatState,
  row: GwFactionRow,
): boolean {
  const st = factionOf(seat, row.id);
  const jn = row.joins;
  if (st?.status !== "in" || jn === undefined) return false;
  const into = factionOf(seat, jn.into);
  if (into?.status !== "out") return false;
  const members = [row.id, ...jn.with]
    .map((id) => factionOf(seat, id))
    .filter((x): x is GwFactionState => x !== null);
  const sitting = members.filter((m) => m.status === "in");
  const sum = sitting.reduce((n, m) => n + m.strength, 0);
  // Their seats are pooled; each keeps its own to take back if they part.
  into.seats = poolSeats(sitting.map((m) => seatsNow(seat, factionRow(m.id)!)));
  for (const m of sitting) {
    m.status = "merged";
    m.since = gw.s.chapter;
  }
  into.status = "in";
  into.since = gw.s.chapter;
  into.strength = clampTo(sum, 1, GW_FACTION_STRENGTH_MAX);
  into.leader = factionLeader(gw, seat, jn.into);
  if (jn.scene !== undefined) call(seat, jn.scene, gw.s.chapter + 1);
  reason(gw, seat, "house_joined", whoOf(into));
  seat.house!.story = {
    kind: "joined",
    faction: jn.into,
    chapter: gw.s.chapter,
  };
  news(gw, "house_joined", seat.tag);
  return true;
}

// ---- The count ----

/** A promise of the house to this faction broken and not yet past. */
function brokenTo(gw: GreatWar, seat: GwSeatState, id: string): boolean {
  const pre = `house_${id}_`;
  return seat.promises.some(
    (p) =>
      p.key.startsWith(pre) &&
      p.broken &&
      gw.s.chapter - p.due < GW_BROKEN_SHUT,
  );
}

/**
 * A faction's side on the moving bill, and whether a deal was broken. ww203:
 * `away` for a held leader or a boycott (its seats don't count); a faction
 * the seat broke a promise to betrays the deal on this bill.
 */
function sideOf(
  gw: GreatWar,
  seat: GwSeatState,
  bill: GwBillRow,
  st: GwLawState,
  id: string,
): { side: GwSide; broke: boolean; away?: true } {
  const f = factionOf(seat, id);
  const row = factionRow(id);
  if (f === null || row === null || f.status !== "in") {
    return { side: 0, broke: false, away: true };
  }
  const deal = st.deals.includes(id);
  // A file holds its leader: the faction stays away (S2 sets `held`).
  if (f.held >= gw.s.chapter) return { side: 0, broke: false, away: true };
  // A boycott, or the silence before a plot.
  if (f.step >= 3) return { side: 0, broke: deal, away: true };
  const turned = f.step === 2 || blocNow(gw, seat, row.bloc) <= -3;
  if (turned) return { side: -1, broke: deal };
  if (deal && brokenTo(gw, seat, id)) return { side: -1, broke: true };
  const text = st.text === null ? undefined : bill.texts?.[st.text]?.[id];
  const base = text ?? bill.stance[id] ?? 0;
  // ww204 (T): a price brings a faction GW_DEAL_STEP sides over: one against
  // wavers, one wavering is for.
  if (deal) {
    return { side: Math.min(1, base + GW_DEAL_STEP) as GwSide, broke: false };
  }
  const side = base;
  // The sponsor's camp: a faction that would stay away comes in for him.
  if (side === 0 && st.warm.includes(id)) return { side: 1, broke: false };
  // ww204: on some bills the undecided don't waver, they stay away.
  if (side === 0 && bill.abstain === true) {
    return { side: 0, broke: false, away: true };
  }
  return { side, broke: false };
}

interface ChamberCount {
  id: GwChamber;
  /** The margin in tenths of the votes cast (Ballot.marginTenths); < 0 fails. */
  count: number;
  /** ww203: the seats cast; absent for a shut chamber. */
  cast?: BallotResult;
  /** Fails whatever the count: a consent faction against, a closed chamber. */
  blocked: boolean;
  kind: GwChamberRow["kind"];
  /** ww187: it doesn't sit and the way round doesn't carry the bill past it. */
  shut?: true;
}

/** What each faction of the seat's house does in chamber `c`. */
function ballotFactions(
  gw: GreatWar,
  seat: GwSeatState,
  bill: GwBillRow,
  st: GwLawState,
  c: GwChamber,
  confidence: boolean,
): BallotFaction[] {
  return factionRows(seat.tag).flatMap((f) => {
    const seats = seatsNow(seat, f)[c] ?? 0;
    const fs = factionOf(seat, f.id);
    if (seats <= 0 || fs?.status !== "in") return [];
    const s = sideOf(gw, seat, bill, st, f.id);
    const deal = st.deals.includes(f.id);
    // A kept deal holds the whole faction; a question of confidence holds
    // the government's side.
    const holds = (deal && !s.broke) || (confidence && s.side > 0);
    const tenths = holds ? 0 : (GW_REBEL_TENTHS[fs.step] ?? 0);
    return [
      {
        id: f.id,
        seats,
        side: s.side,
        away: s.away === true,
        rebels: Math.floor((seats * tenths) / 10),
        beat: s.broke ? "betray" : deal ? "swing" : "firm",
      },
    ];
  });
}

function countIn(
  gw: GreatWar,
  seat: GwSeatState,
  n: GwNationState,
  bill: GwBillRow,
  lean: number,
  st: GwLawState,
  c: GwChamberRow,
  table: number,
  confidence = false,
): ChamberCount {
  const ctx = ctxOf(gw, seat);
  if (!sits(ctx, c)) {
    return { id: c.id, count: CLOSED, blocked: true, kind: c.kind, shut: true };
  }
  const score =
    (c.inst === undefined ? 0 : (n.inst[c.inst] ?? 0)) +
    lean +
    st.support +
    table;
  const refused =
    c.kind === "consent" &&
    c.consent !== undefined &&
    sideOf(gw, seat, bill, st, c.consent).side <= 0;
  const need = c.need;
  const block =
    bill.constitution === true && need !== undefined && need !== "half"
      ? need.block
      : 0;
  const cast = castChamber(
    {
      id: c.id,
      size: c.size ?? null,
      rest: c.rest ?? "away",
      block,
      score,
      refused,
      ...(c.states === undefined ? {} : { states: c.states }),
    },
    ballotFactions(gw, seat, bill, st, c.id, confidence),
  );
  const blocked = refused || (block > 0 && cast.against >= block);
  return { id: c.id, count: cast.count, cast, blocked, kind: c.kind };
}

/** Each chamber's count of the moving bill; `skip`: chambers gone round. */
export function houseCounts(
  gw: GreatWar,
  seat: GwSeatState,
  law: string,
  table: number,
  skip: readonly GwChamber[] = [],
  confidence = false,
): ChamberCount[] {
  const n = gw.nation(seat.tag);
  const house = houseRow(seat.tag);
  const bill = billRow(seat, law);
  const row = lawRow(law);
  const st = n?.laws.find((x) => x.id === law) ?? null;
  if (n === null || house === null || bill === null || row === null) return [];
  const live: GwLawState = st ?? gwLawStart(law);
  const gone = [...skip, ...closedRound(gw, seat, house, bill)];
  return chambersOf(house, bill)
    .filter((c) => !gone.includes(c.id))
    .map((c) =>
      countIn(gw, seat, n, bill, row.lean, live, c, table, confidence),
    );
}

/** A law state for a count with no bill moving (a power's question). */
function idleLaw(id: string): GwLawState {
  return gwLawStart(id);
}

/**
 * A power put to the house (ww169): each chamber counted as for a bill, by
 * the factions' `stance`, nothing rolled. Null when the seat has no house.
 */
export function questionCount(
  gw: GreatWar,
  seat: GwSeatState,
  id: string,
  stance: Readonly<Record<string, -1 | 0 | 1>>,
  houses: readonly GwChamber[] | undefined,
  lean: number,
): { count: number; stops: GwChamber | null } | null {
  const n = gw.nation(seat.tag);
  const house = houseRow(seat.tag);
  if (n === null || house === null) return null;
  const bill: GwBillRow = {
    law: id,
    stance,
    ...(houses === undefined ? {} : { houses }),
  };
  const counts = chambersOf(house, bill)
    .filter((c) => c.kind !== "lords")
    .map((c) => countIn(gw, seat, n, bill, lean, idleLaw(id), c, 0));
  const t = houseTally(counts);
  return { count: t.count, stops: t.stops };
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
  if (around === undefined || !aroundOpen(gw, seat, around, bill)) return [];
  const ctx = ctxOf(gw, seat);
  return chambersOf(house, bill)
    .filter((c) => !sits(ctx, c) && around.skips.includes(c.id))
    .map((c) => c.id);
}

/** The house is gone or sent home: every bill may go round (ww171). */
export function houseGone(
  gw: GreatWar,
  seat: GwSeatState,
  around: GwHouseRow["around"],
): boolean {
  return around?.all !== undefined && holds(ctxOf(gw, seat), around.all);
}

/** The way round is open for this bill now. */
function aroundOpen(
  gw: GreatWar,
  seat: GwSeatState,
  around: NonNullable<GwHouseRow["around"]>,
  bill: GwBillRow,
): boolean {
  if (houseGone(gw, seat, around)) return true;
  if (bill.around !== true) return false;
  return around.when === undefined || holds(ctxOf(gw, seat), around.when);
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

/**
 * ww203: the count is the margin in tenths of the votes cast; a margin of a
 * fifth (GW_WIDE_SHARE) or more is wide.
 */
export function bandOf(count: number): GwVoteBand {
  if (count >= 2) return "wide";
  if (count >= 0) return "narrow";
  return count >= -1 ? "lost_narrow" : "lost_wide";
}

export function wordOf(count: number): GwWhipWord {
  if (count >= 2) return "wide";
  if (count >= 1) return "likely";
  if (count === 0) return "even";
  return count >= -1 ? "short" : "hopeless";
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

/** A faction's true word on a bill: how the bulk of its seats will go. */
function trueWord(
  gw: GreatWar,
  seat: GwSeatState,
  bill: GwBillRow,
  st: GwLawState,
  id: string,
): GwCountWord {
  const s = sideOf(gw, seat, bill, st, id);
  if (s.away === true) return "unknown";
  if (s.side === 0) return "waver";
  // Temper 1: a tenth wavers; the bulk still goes with the faction.
  return s.side > 0 ? "for" : "against";
}

/** One step off: what a weak head gets wrong about a faction. */
function offWord(w: GwCountWord, r: number): GwCountWord {
  if (w !== "waver") return "waver";
  return r % 2 === 0 ? "for" : "against";
}

/**
 * ww203: the counting office's paper on a bill on the agenda, faction by
 * faction, written at the head's band: band 3 sure and right; below, his
 * confidence word drops and, by his spread (the old whip's), one faction's
 * word is off. The overall word is the true count shifted by the same error,
 * kept as the bill's `whip` and as a report the vote puts right.
 */
export function countPaper(
  gw: GreatWar,
  seat: GwSeatState,
  law: string,
  band: number,
  head: string | null,
): void {
  const n = gw.nation(seat.tag);
  const st = n?.laws.find((x) => x.id === law) ?? null;
  const bill = billRow(seat, law);
  if (st === null || bill === null || !MOVING.includes(st.stage)) return;
  const counts = houseCounts(gw, seat, law, 0);
  const ids = lobbyRows(gw, seat, bill).map((r) => r.id);
  const spread = GW_WHIP_SPREAD[Math.max(1, Math.min(3, band)) - 1] ?? 1;
  const r = wwRoll(gw.s.seed, P_WHIP, idHash(law), gw.s.chapter);
  const off = spread === 0 || ids.length === 0 ? -1 : r % ids.length;
  const conf = band >= 3 ? "sure" : band === 2 ? "mostly" : "heard";
  st.paper = ids.map((id, i) => {
    const word = trueWord(gw, seat, bill, st, id);
    return {
      faction: id,
      word: i === off ? offWord(word, r >> 3) : word,
      conf,
    };
  });
  st.paperAt = gw.s.chapter;
  // No chamber sits to vote on it: nothing to count overall.
  if (counts.length === 0 || counts.some((c) => c.shut === true)) {
    st.whip = -1;
    return;
  }
  const truth = houseTally(counts).count;
  const p = head === null ? null : gw.person(head);
  let err = spread === 0 ? 0 : ((r >> 5) % (2 * spread + 1)) - spread;
  const t = p?.temperament ?? null;
  if (t === "anxious") err -= 1;
  if (t === "arrogant") err += 1;
  const word = GW_WHIP_WORDS.indexOf(wordOf(truth + err));
  const sure = spread === 0 && t !== "anxious" && t !== "arrogant";
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

/** The paper's overall word as the agenda reads it (GwLawOutlook). */
export const OUTLOOK_OF_WHIP = [
  "easy",
  "tight",
  "tight",
  "short",
  "blocked",
] as const;

/** ww203: a count answer's slots: the bill, the paper's word, the waverers. */
export function countSlots(
  gw: GreatWar,
  seat: GwSeatState,
  law: string,
): GwSlots {
  const st = gw.nation(seat.tag)?.laws.find((x) => x.id === law);
  if (st === undefined) return {};
  const out: GwSlots = { bill: { kind: "word", value: law } };
  const tally = st.whip < 0 ? undefined : OUTLOOK_OF_WHIP[st.whip];
  if (tally !== undefined) out.tally = { kind: "word", value: tally };
  const swing = st.paper
    .filter((p) => p.word === "waver")
    .map((p) => p.faction);
  if (swing.length > 0) out.swing = { kind: "word", value: swing.join(",") };
  return out;
}

/** The factions sitting in a bill's chambers, in row order. */
function lobbyRows(
  gw: GreatWar,
  seat: GwSeatState,
  bill: GwBillRow,
): GwFactionRow[] {
  const house = houseRow(seat.tag);
  if (house === null) return [];
  const ids = new Set(chambersOf(house, bill).map((c) => c.id));
  return factionRows(seat.tag).filter(
    (f) =>
      factionOf(seat, f.id)?.status === "in" &&
      Object.entries(seatsNow(seat, f)).some(
        ([c, k]) => (k ?? 0) > 0 && ids.has(c as GwChamber),
      ),
  );
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

/**
 * A chamber sits to vote on the bill: false when every chamber it meets is
 * closed and gone round (Vienna's bills under §14). Not a house bill: true.
 */
export function houseSits(
  gw: GreatWar,
  seat: GwSeatState,
  law: string,
): boolean {
  if (billRow(seat, law) === null) return true;
  const counts = houseCounts(gw, seat, law, 0);
  return counts.length > 0 && !counts.some((c) => c.shut === true);
}

/**
 * The day: the count is the count. Null: not a house bill. ww203: called
 * from the agenda; `confidence`: the premier made it a question of
 * confidence (his side's rebels hold). The ballot is kept for the scene.
 */
export function housePut(
  gw: GreatWar,
  seat: GwSeatState,
  st: GwLawState,
  table: number,
  confidence = false,
): {
  pass: boolean;
  stops: string | null;
  sign: boolean;
  band: GwVoteBand | null;
} | null {
  const bill = billRow(seat, st.id);
  if (bill === null) return null;
  const counts = houseCounts(gw, seat, st.id, table, [], confidence);
  // No chamber sits to vote on it: no vote, no card, no word judged. It waits;
  // the way round is the only door. ww187: so with one it needs shut.
  if (counts.length === 0 || counts.some((c) => c.shut === true)) {
    reason(gw, seat, "house_no_sitting");
    return { pass: false, stops: "no_sitting", sign: false, band: null };
  }
  const t = houseTally(counts);
  const how = confidence ? "confidence" : "vote";
  // The Lords below zero put it off once; past the delay they can't.
  if (t.count >= 0 && t.lords && bill.money !== true && st.delayTo === -1) {
    st.delayTo = gw.s.chapter + GW_LORDS_DELAY;
    record(gw, seat, st, counts, how, false, bandOf(t.count), true);
    reason(gw, seat, "house_lords_delay");
    return { pass: false, stops: "lords_delay", sign: false, band: null };
  }
  vote(gw, seat, bill, st, t.count, counts, how);
  // A closed chamber went by the way round: its factions take that ill.
  const house = houseRow(seat.tag)!;
  const closed = closedRound(gw, seat, house, bill);
  if (t.count >= 0 && closed.length > 0 && house.around !== undefined) {
    for (const h of house.around.heats) heatBy(gw, seat, h.faction, h.by);
    if (seat.house !== undefined) seat.house.around++;
    reason(gw, seat, `house_round_${house.around.id}`);
  }
  const sign = t.count >= 0 && house.signs === true;
  return { pass: t.count >= 0, stops: t.stops, sign, band: bandOf(t.count) };
}

/** The vote as the scene plays it: kept on the house, once per uid. */
function record(
  gw: GreatWar,
  seat: GwSeatState,
  st: GwLawState,
  counts: readonly ChamberCount[],
  how: GwBallot["how"],
  pass: boolean,
  band: GwVoteBand,
  lordsDelay = false,
): void {
  const h = seat.house;
  if (h === undefined) return;
  const chambers = counts.flatMap((c) => {
    if (c.cast === undefined) return [];
    h.sat[c.id] = gw.s.chapter;
    const delay = lordsDelay && c.kind === "lords" && !c.cast.chamber.pass;
    return [{ ...c.cast.chamber, delay }];
  });
  h.last = {
    law: st.id,
    band,
    chapter: gw.s.chapter,
    ballot: {
      uid: ++h.ballots,
      law: st.id,
      text: st.text,
      chapter: gw.s.chapter,
      how,
      chambers,
      pass,
      band,
    },
  };
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
    reason(gw, seat, "house_refused_by", whoOf(factionOf(seat, row.id)));
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
  counts: readonly ChamberCount[],
  how: GwBallot["how"],
): void {
  const band = bandOf(count);
  const pass = count >= 0;
  record(gw, seat, st, counts, how, pass, band);
  judgeWhip(gw, seat, st, count);
  const chambers = new Set(
    chambersOf(houseRow(seat.tag)!, bill).map((c) => c.id),
  );
  // ww203 §6: passed, the blocs of those for and against move a step.
  const blocs = new Map<GwFactionRow["bloc"], number>();
  for (const row of factionRows(seat.tag)) {
    const sitsHere = Object.entries(seatsNow(seat, row)).some(
      ([c, k]) => (k ?? 0) > 0 && chambers.has(c as GwChamber),
    );
    if (!sitsHere) continue;
    const f = factionOf(seat, row.id);
    if (f?.status !== "in") continue;
    const { side, broke } = sideOf(gw, seat, bill, st, row.id);
    if (pass && side !== 0) {
      blocs.set(row.bloc, (blocs.get(row.bloc) ?? 0) + side);
    }
    const who = whoOf(f);
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
    // ww203 §6: passed, those for cool a step, those against heat (two if
    // it goes against their creed).
    if (pass && side > 0) f.heat = Math.max(0, f.heat - 1);
    if (pass && side < 0) {
      heatBy(gw, seat, row.id, bill.creed?.includes(row.id) ? 2 : 1);
    }
    if (broke) {
      // He broke his word first: the seat may drop its own to him.
      const k = `house_${row.id}_${st.id}`;
      seat.promises = seat.promises.filter((p) => p.key !== k);
      f.deals = f.deals.filter((d) => d !== k);
      reason(gw, seat, "house_broke_word", who);
    }
  }
  for (const [bloc, sum] of blocs) {
    if (sum !== 0) moveOpinion(seat, bloc, Math.sign(sum));
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
  if (around === undefined || n === null) return false;
  if (!aroundOpen(gw, seat, around, bill)) return false;
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
  if (around.bloc !== undefined) moveOpinion(seat, around.bloc, -1);
  if (seat.house !== undefined) seat.house.around++;
  reason(gw, seat, `house_round_${around.id}`);
  const left = houseCounts(gw, seat, st.id, table, around.skips);
  const t = houseTally(left);
  if (left.length > 0) vote(gw, seat, bill, st, t.count, left, "round");
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
  place: (card: GwCard) => void = (card) => placeCard(gw, seat, card),
): boolean {
  if (billRow(seat, st.id) === null) return false;
  const scene = sceneOf(houseIds.draft(st.id));
  const card =
    scene === null ? null : makeCard(gw, seat, scene, "scheduled", sponsor);
  if (card === null) return false;
  st.sponsor = card.cast.who ?? null;
  place(card);
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
  const on = n.laws.filter((x) => MOVING.includes(x.stage)).length;
  if (on >= GW_AGENDA_MAX) return false;
  let st = n.laws.find((x) => x.id === law);
  if (st !== undefined && st.stage !== "idle") return false;
  if (st !== undefined && st.lockTo > gw.s.chapter) return false;
  if (st === undefined) {
    st = gwLawStart(law);
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
  // ww208: a peace row opens only while the country is not at war.
  if (row.peace === true && n.atWar.length > 0) return false;
  return holds(ctxOf(gw, seat), row.opens);
}

function canStart(gw: GreatWar, seat: GwSeatState, row: GwFactionRow): boolean {
  const house = houseRow(seat.tag);
  if (house === null) return false;
  // A chamber that doesn't sit brings no bill (the abolished Duma, ww171).
  const ctx = ctxOf(gw, seat);
  return house.chambers.some(
    (c) =>
      c.starts === true && sits(ctx, c) && (seatsNow(seat, row)[c.id] ?? 0) > 0,
  );
}

/** Papers that closed unanswered: a draft takes its first text, an ask lies. */
function unanswered(gw: GreatWar, seat: GwSeatState): void {
  // ww193 merge: a draft a department holds (tray or work) is not closed.
  const there = (scene: string) =>
    seat.desk.some((c) => c.scene === scene) ||
    seat.scheduled.some((q) => q.scene === scene) ||
    (seat.depts?.tray ?? []).some((c) => c.scene === scene) ||
    (seat.depts?.tasks ?? []).some((t) => t.scene === scene);
  for (const m of agendaBills(gw, seat)) {
    if (m.st.stage !== "draft" || there(houseIds.draft(m.st.id))) continue;
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
  if (n === null) return;
  const on = n.laws.filter((x) => MOVING.includes(x.stage)).length;
  if (on >= GW_AGENDA_MAX) return;
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
      canStart(gw, seat, row)
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
  for (const m of agendaBills(gw, seat)) sponsorWorksOn(gw, seat, m);
}

function sponsorWorksOn(gw: GreatWar, seat: GwSeatState, m: Moving): void {
  if (m.st.stage !== "persuade" || m.st.sponsor === null) return;
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
  // ww208: a generic party has no state until it is born (ensureFaction).
  const generic = genericFactionRows(gwContent());
  for (const row of rows) {
    if (generic.includes(row)) continue;
    if (h.factions.some((f) => f.id === row.id)) continue;
    const st = factionStart(gw, row);
    h.factions.push(st);
    st.leader = leaderNow(gw, seat, row, st);
  }
  return h;
}

/** ww208: a faction's state, made as its row starts if it has none (a generic party's birth). */
export function ensureFaction(
  gw: GreatWar,
  seat: GwSeatState,
  id: string,
): GwFactionState | null {
  const had = factionOf(seat, id);
  if (had !== null) return had;
  const row = factionRow(id);
  if (row === null || row.tag !== seat.tag || seat.house === undefined) {
    return null;
  }
  const st = factionStart(gw, row);
  seat.house.factions.push(st);
  return st;
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
    // ww203: the free calls are the agenda's; the count is a department's
    // paper now (`count` task), not the whip's word each chapter.
    const inHouse = agendaBills(gw, seat).some(
      (m) => m.st.stage === "persuade" || m.st.stage === "vote",
    );
    h.calls = inHouse ? GW_HOUSE_CALLS : 0;
    if (
      h.focus !== null &&
      !agendaBills(gw, seat).some((m) => m.st.id === h.focus)
    ) {
      h.focus = null;
    }
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
      | "around"
      | "house_sits"
      | "confidence";
  }
>;

/**
 * ww203: the prices the leader names now for the moving bill, up to three.
 * ww204: a concession needs his own text for this bill (`amendable`), whatever
 * the row's `when` says.
 */
function wantsNow(ctx: SceneCtx, id: string): GwWant[] {
  const m = movingBill(ctx.gw, ctx.seat);
  const row = factionRow(id);
  if (m === null || row === null || m.st.deals.includes(id)) return [];
  const free = { ...ctx, cast: {} };
  return (row.wants ?? [])
    .filter((w) => w.when === undefined || holds(free, w.when))
    .filter(
      (w) =>
        wantKind(w) !== "concession" ||
        houseHolds(free, { is: "amendable", id }),
    )
    .slice(0, GW_PRICES_MAX);
}

/** ww204: `fn` with the talks about `law` (the lobbied bill), focus restored. */
function withFocus<T>(seat: GwSeatState, law: string, fn: () => T): T {
  const h = seat.house;
  if (h === undefined) return fn();
  const was = h.focus;
  h.focus = law;
  try {
    return fn();
  } finally {
    h.focus = was;
  }
}

/** The price named `want` (absent: his first) for the moving bill, if any. */
function wantNow(ctx: SceneCtx, id: string, want?: string): GwWant | null {
  const all = wantsNow(ctx, id);
  if (want === undefined) return all[0] ?? null;
  return all.find((w) => w.id === want) ?? null;
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
      const all = wantsNow(ctx, c.id);
      return c.want === "any"
        ? all.length > 0
        : all.some((w) => w.id === c.want);
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
    case "house_sits":
      return houseSits(gw, seat, c.id);
    case "confidence":
      return confidence(gw, seat, c.stance) >= (c.min ?? 0);
  }
}

/**
 * A confidence vote's count in the house's first chamber, as `countIn` counts
 * a bill: the body's weight, then seats on each faction's side. A boycott,
 * a held leader or a faction turned (temper 2, its bloc at -3) counts as
 * the bill's rules say. No house yet: nobody to refuse.
 */
function confidence(
  gw: GreatWar,
  seat: GwSeatState,
  stance: Readonly<Record<string, number>>,
): number {
  const house = houseRow(seat.tag);
  const n = gw.nation(seat.tag);
  const c = house?.chambers[0];
  if (house === null || n === null || c === undefined || houseOf(seat) === null)
    return 0;
  let count = c.inst === undefined ? 0 : (n.inst[c.inst] ?? 0);
  for (const row of factionRows(seat.tag)) {
    const seats = seatsNow(seat, row)[c.id] ?? 0;
    const f = factionOf(seat, row.id);
    if (seats === 0 || f === null || f.status !== "in") continue;
    if (f.held >= gw.s.chapter || f.step >= 3) continue;
    const turned = f.step === 2 || blocNow(gw, seat, row.bloc) <= -3;
    count += seats * (turned ? -1 : (stance[row.id] ?? 0));
  }
  return count;
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
      reason(gw, seat, "house_under", whoOf(f));
      return;
    }
    case "deal":
      takeDeal(ctx, e.id, e.want);
      return;
    case "amend": {
      if (!houseHolds(ctx, { is: "amendable", id: e.id })) return;
      const m = movingBill(gw, seat)!;
      m.st.text = factionRow(e.id)!.amends![m.st.id];
      reason(gw, seat, "house_amended", whoOf(factionOf(seat, e.id)));
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
function takeDeal(ctx: SceneCtx, id: string, want?: string): void {
  const { gw, seat } = ctx;
  const w = wantNow(ctx, id, want);
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
  const kind = wantKind(w);
  // ww204: a concession is his text for the bill; his bill next joins the
  // agenda now if there is room (else the promise waits on it).
  if (kind === "concession") houseEffect(ctx, { do: "amend", id });
  if (kind === "next") bringNext(gw, seat, id, w);
  runEffects(ctx, w.effects ?? []);
  reason(gw, seat, "house_deal", who ?? undefined);
}

/** ww204: the faction's own bill the `next` price names, onto the agenda. */
function bringNext(
  gw: GreatWar,
  seat: GwSeatState,
  id: string,
  w: GwWant,
): void {
  const bills = factionRow(id)?.bills ?? [];
  const keep = w.keep === undefined ? "" : JSON.stringify(w.keep);
  const named = bills.filter((b) => keep.includes(`"${b}"`));
  const law = (named.length > 0 ? named : bills).find((b) =>
    opensNow(gw, seat, b),
  );
  if (law !== undefined) houseBring(gw, seat, law, "faction", id);
}

// ---- ww203: lobbying ----

/** Why a leader won't talk about this bill; null: he talks. */
function shutOf(
  gw: GreatWar,
  seat: GwSeatState,
  bill: GwBillRow,
  id: string,
): GwLobbyView["shut"] {
  const f = factionOf(seat, id);
  if (f !== null && f.held >= gw.s.chapter) return "held";
  if (brokenTo(gw, seat, id)) return "broken";
  if (bill.creed?.includes(id) === true) return "creed";
  return null;
}

function agendaBill(gw: GreatWar, seat: GwSeatState, law: string) {
  return agendaBills(gw, seat).find((m) => m.st.id === law) ?? null;
}

/** The ways the ruler can press this faction's leader now. */
function pressHows(
  seat: GwSeatState,
  m: Moving,
  id: string,
  leader: string | null,
): GwPressHow[] {
  if (m.st.stage !== "persuade" && m.st.stage !== "vote") return [];
  const out: GwPressHow[] = [];
  if (leader !== null && hasFile(seat, leader)) out.push("file");
  if (!m.st.warm.includes(id)) out.push("word", "threat");
  return out;
}

/** The lobby list of an agenda bill: every faction in its chambers. */
export function lobbyViews(
  gw: GreatWar,
  seat: GwSeatState,
  law: string,
): GwLobbyView[] {
  const m = agendaBill(gw, seat, law);
  const house = houseRow(seat.tag);
  if (m === null || house === null) return [];
  const chambers = chambersOf(house, m.bill).map((c) => c.id);
  const open = m.st.stage === "persuade" || m.st.stage === "vote";
  return lobbyRows(gw, seat, m.bill).map((row) => {
    const f = factionOf(seat, row.id)!;
    const now = seatsNow(seat, row);
    const seats: Partial<Record<GwChamber, number>> = {};
    for (const c of chambers) if ((now[c] ?? 0) > 0) seats[c] = now[c];
    const paper = m.st.paper.find((x) => x.faction === row.id);
    const shut = shutOf(gw, seat, m.bill, row.id);
    const topic = houseIds.lobby(row.id);
    return {
      faction: row.id,
      seats,
      leader: f.leader,
      word: paper?.word ?? "unknown",
      conf: paper?.conf ?? null,
      deal: m.st.deals.includes(row.id),
      shut,
      call:
        open &&
        shut === null &&
        f.leader !== null &&
        !m.st.deals.includes(row.id) &&
        sceneOf(topic) !== null &&
        !seat.desk.some((c) => c.scene === topic),
      press: pressHows(seat, m, row.id, f.leader),
      prices: pricesOf(gw, seat, law, row.id),
    };
  });
}

/** ww204: summoned on this bill (his talk on the desk, the talks about it). */
function summoned(seat: GwSeatState, law: string, faction: string): boolean {
  const topic = houseIds.lobby(faction);
  return seat.house?.focus === law && seat.desk.some((c) => c.scene === topic);
}

/** ww204: the prices the summoned leader names on this bill; null: not summoned. */
function pricesOf(
  gw: GreatWar,
  seat: GwSeatState,
  law: string,
  faction: string,
): { id: string; kind: GwPriceKind }[] | null {
  if (!summoned(seat, law, faction)) return null;
  return withFocus(seat, law, () =>
    wantsNow(ctxOf(gw, seat), faction).map((w) => ({
      id: w.id,
      kind: wantKind(w),
    })),
  );
}

/**
 * ww204: 들어준다 / 그냥 돌려보낸다 from the lobby list: the summoned leader's
 * price `want` taken (null: none), and his talk ends.
 */
export function housePrice(
  gw: GreatWar,
  seat: GwSeatState,
  law: string,
  faction: string,
  want: string | null,
): GwOrderBlock | null {
  const m = agendaBill(gw, seat, law);
  if (m === null) return "no_law";
  if (!summoned(seat, law, faction)) return "no_topic";
  const ctx = ctxOf(gw, seat);
  if (want !== null) {
    const ok = wantsNow(ctx, faction).some((w) => w.id === want);
    if (!ok) return "no_topic";
    takeDeal(ctx, faction, want);
  }
  const topic = houseIds.lobby(faction);
  seat.desk = seat.desk.filter((c) => c.scene !== topic);
  return null;
}

/**
 * 부른다: the leader's lobby talk on this bill, if he talks. The talks are
 * about this bill from now (`focus`). The caller summons him.
 */
export function lobbyCall(
  gw: GreatWar,
  seat: GwSeatState,
  law: string,
  faction: string,
): { person: string; topic: string } | GwOrderBlock {
  const m = agendaBill(gw, seat, law);
  if (m === null) return "no_law";
  const v = lobbyViews(gw, seat, law).find((x) => x.faction === faction);
  if (v === undefined) return "no_topic";
  if (v.shut !== null) return "no_talk";
  if (!v.call || v.leader === null) return "no_topic";
  houseFocus(seat, law);
  return { person: v.leader, topic: houseIds.lobby(faction) };
}

/**
 * 압박: no deal, only absence or fear, and heat. A file holds him away; the
 * ruler's word brings court and army factions in (others it only angers);
 * a dissolution threat brings his waverers in and
 * heats every faction of the bill's house.
 */
export function housePress(
  gw: GreatWar,
  seat: GwSeatState,
  law: string,
  faction: string,
  how: GwPressHow,
): GwOrderBlock | null {
  const m = agendaBill(gw, seat, law);
  if (m === null) return "no_law";
  const v = lobbyViews(gw, seat, law).find((x) => x.faction === faction);
  if (v === undefined) return "no_topic";
  if (!v.press.includes(how)) return "no_press";
  const row = factionRow(faction)!;
  const ctx = ctxOf(gw, seat);
  const who = v.leader ?? undefined;
  houseFocus(seat, law);
  if (how === "file") {
    pressWithFile(ctx, v.leader!);
    reason(gw, seat, "house_press_file", who);
    return null;
  }
  if (how === "word") {
    const heeds = row.bloc === "court" || row.bloc === "army";
    if (heeds) m.st.warm.push(faction);
    heatBy(gw, seat, faction, heeds ? 1 : 2);
    reason(gw, seat, heeds ? "house_press_word" : "house_press_word_no", who);
    return null;
  }
  m.st.warm.push(faction);
  for (const r of lobbyRows(gw, seat, m.bill)) heatBy(gw, seat, r.id, 1);
  reason(gw, seat, "house_press_threat", who);
  return null;
}

/**
 * ww203: a law carried round now must face the house when it is back (the
 * way round has `faces` and its door is open only while the house is away).
 */
export function houseRoundFaces(gw: GreatWar, seat: GwSeatState): boolean {
  const around = houseRow(seat.tag)?.around;
  if (around?.faces !== true || around.when === undefined) return false;
  return !houseGone(gw, seat, around);
}

/** ww203: the house a decree must face is back: the way round's door shut. */
export function houseBack(gw: GreatWar, seat: GwSeatState): boolean {
  const around = houseRow(seat.tag)?.around;
  if (around?.faces !== true || around.when === undefined) return false;
  if (houseGone(gw, seat, around)) return false;
  return !holds(ctxOf(gw, seat), around.when);
}

/**
 * ww203 §9: a house nobody plays counts a bill by its rows: each faction
 * that starts in the house at its row's seats and side on `text`, no temper,
 * no deals; waverers by the chamber's mood and the bill's lean. Only the
 * chambers that sit count. Null: no house, or none sits.
 */
export function rowCount(
  gw: GreatWar,
  seat: GwSeatState,
  law: string,
  text: string,
): { pass: boolean; count: number } | null {
  const n = gw.nation(seat.tag);
  const house = houseRow(seat.tag);
  const bill = (gwContent().bills ?? []).find((x) => x.law === law) ?? null;
  const row = lawRow(law);
  if (n === null || house === null || bill === null || row === null) {
    return null;
  }
  const ctx = ctxOf(gw, seat);
  const sideIn = (id: string): GwSide =>
    bill.texts?.[text]?.[id] ?? bill.stance[id] ?? 0;
  const cast = chambersOf(house, bill)
    .filter((c) => c.kind !== "lords" && sits(ctx, c))
    .map((c) => {
      const need = c.need;
      return castChamber(
        {
          id: c.id,
          size: c.size ?? null,
          rest: c.rest ?? "away",
          block:
            bill.constitution === true && need !== undefined && need !== "half"
              ? need.block
              : 0,
          score: (c.inst === undefined ? 0 : (n.inst[c.inst] ?? 0)) + row.lean,
          refused:
            c.kind === "consent" &&
            c.consent !== undefined &&
            sideIn(c.consent) <= 0,
          ...(c.states === undefined ? {} : { states: c.states }),
        },
        factionRows(seat.tag)
          .filter((f) => f.start === "in")
          .map((f) => ({
            id: f.id,
            seats: f.seats[c.id] ?? 0,
            side: sideIn(f.id),
            away: false,
            rebels: 0,
            beat: "firm" as const,
          })),
      );
    });
  if (cast.length === 0) return null;
  return {
    pass: cast.every((x) => x.chamber.pass),
    count: Math.min(...cast.map((x) => x.count)),
  };
}

/** ww203: the chambers a house bill meets, in order. */
export function houseChambers(seat: GwSeatState, law: string): GwChamber[] {
  const house = houseRow(seat.tag);
  const bill = billRow(seat, law);
  if (house === null || bill === null) return [];
  return chambersOf(house, bill).map((c) => c.id);
}

/**
 * ww203: a count answer's course. `work`: the sponsor brings the biggest
 * wavering faction in (warm: it comes in for him); `amend`: the first
 * faction with its own text for the bill has it taken.
 */
export function houseWork(
  ctx: SceneCtx,
  law: string,
  act: "work" | "amend",
): void {
  const { gw, seat } = ctx;
  const m = agendaBill(gw, seat, law);
  if (m === null) return;
  houseFocus(seat, law);
  const rows = lobbyRows(gw, seat, m.bill);
  if (act === "amend") {
    const f = rows.find((r) => houseHolds(ctx, { is: "amendable", id: r.id }));
    if (f !== undefined) houseEffect(ctx, { do: "amend", id: f.id });
    return;
  }
  const target = rows
    .filter((r) => !m.st.deals.includes(r.id) && !m.st.warm.includes(r.id))
    .filter((r) => sideOf(gw, seat, m.bill, m.st, r.id).side === 0)
    .sort(
      (a, b) => seatsSum(seat, b) - seatsSum(seat, a) || (a.id < b.id ? -1 : 1),
    )[0];
  if (target === undefined) return;
  m.st.warm.push(target.id);
  reason(gw, seat, "house_sponsor_won", m.st.sponsor ?? undefined);
}

/** ww203: the house's fall row, if a lost government bill shakes it. */
export function houseFall(seat: GwSeatState): string | null {
  return houseRow(seat.tag)?.fall ?? null;
}

/** ww203: the office that counts a bill now, if any head is there. */
export function houseCounter(
  seat: GwSeatState,
  hasHead: (o: GwOffice) => boolean,
): GwOffice | null {
  return (houseRow(seat.tag)?.counter ?? []).find(hasHead) ?? null;
}

/** ww203: chambers the bill meets that have voted this chapter. */
export function houseSat(
  gw: GreatWar,
  seat: GwSeatState,
  law: string,
): boolean {
  const house = houseRow(seat.tag);
  const bill = billRow(seat, law);
  const sat = seat.house?.sat ?? {};
  if (house === null || bill === null) return false;
  return chambersOf(house, bill).some((c) => sat[c.id] === gw.s.chapter);
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
    // ww207: a gone party shows only on the strip (GwSocietyView).
    if (f.status === "gone") return [];
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
    closed: house.chambers
      .filter((c) => c.sits !== undefined && !sits(ctxOf(gw, seat), c))
      .map((c) => c.id),
    gone: houseGone(gw, seat, house.around),
    ballot: h.last?.ballot ?? null,
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
