// Great War 1914: bills and laws, running (brief ww142, lane L; ww203 the law
// book). A law row is an article of the book; its texts are its bills. A bill
// is drafted (제출), joins the agenda (at most GW_AGENDA_MAX, faction bills
// included), is lobbied, and comes to the vote when the seat calls it (a
// faction's own after GW_HOUSE_AUTO chapters by itself), or goes round the
// house. Passed it is in force, replacing another bill of its article; failed
// it locks the article and costs authority. In force it works on its months
// until repealed. Who can stop it is the form of government's (AuthorityTable
// `law`) or the house's (House.ts). AI countries pass one now and then by the
// same count, with a news line (§9). Nothing is rolled on the day.
import {
  GW_GAUGE_MAX,
  GW_GAUGES,
  GW_INST_MAX,
  GW_INST_MIN,
  GwCard,
  GwGauge,
  GwInstitution,
  GwNationState,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwVoteBand } from "@openfront/engine-api/ww1914/GwHouse";
import {
  gwLawStart,
  type GwAgendaView,
  type GwArticleView,
  type GwBillAct,
  type GwBookChapter,
  type GwBookView,
  type GwBookWhy,
  type GwCallWhy,
  type GwLawOutlook,
  type GwLawState,
  type GwLawView,
} from "@openfront/engine-api/ww1914/GwLaw";
import type { GwOrderBlock } from "@openfront/engine-api/ww1914/GwOrders";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { GW_LAWS } from "@openfront/engine-lib/ww1914/content/scenes/laws";
import {
  GW_AGENDA_MAX,
  GW_AI_LAW_EVERY,
  GW_DECREE_FACE,
  GW_FALL_HEAT,
  GW_HOUSE_AUTO,
  GW_LOCK_NARROW,
  GW_LOCK_WIDE,
  GW_LOST_NARROW,
  GW_LOST_WIDE,
  houseIds,
} from "@openfront/engine-lib/ww1914/HouseRows";
import type { GwLawBody, GwLawRow } from "@openfront/engine-lib/ww1914/LawRows";
import { authorityRow, holdVote, voteCount } from "./Authority";
import { deptHead } from "./Departments";
import { makeCard, placeCard } from "./Desk";
import { govHeat } from "./Government";
import { GW_GOV } from "./GovTable";
import type { GreatWar } from "./GreatWar";
import {
  billRow,
  houseBack,
  houseBring,
  houseCanRound,
  houseChambers,
  houseCounter,
  houseCounts,
  houseDraft,
  houseFall,
  houseOpened,
  housePut,
  houseRefused,
  houseRound,
  houseRoundFaces,
  houseSat,
  houseSignCard,
  houseSits,
  houseTally,
  houseWork,
  lobbyViews,
  OUTLOOK_OF_WHIP,
  rowCount,
} from "./House";
import {
  isMoneyBill,
  moneyLawRow,
  moneyLost,
  moneyMayWithdraw,
  moneyPassed,
  moneyWithdrawn,
} from "./MoneyBills";
import { summonable } from "./Orders";
import { trustBy } from "./People";
import { heatThreat } from "./Powers";
import { moveCensor } from "./Press";
import { castOf, holds, runEffects, SceneCtx, sceneOf } from "./SceneRun";
import { blankSeat } from "./SeatStart";
import { lawAxes } from "./Society";
import { exclusiveShut, utopiaLawPassed } from "./Utopia";
import {
  clampTo,
  everyMonths,
  moveGauge,
  news,
  reason,
  seatsOf,
} from "./World";

/** Chapters a bill taken back or repealed stays off the table. */
const SHELF = 4;
/** The count a bill with no body to pass it has. */
const NOBODY = 9;
/** What an AI country's weakest gauge asks of the book (§9). */
const AI_NEEDS: Readonly<Record<GwGauge, readonly GwBookChapter[]>> = {
  bread: ["food"],
  shells: ["labour", "conscription"],
  order: ["censorship", "siege"],
  money: ["war_finance"],
  morale: ["censorship", "war_aims"],
};

const MOVING: readonly GwLawState["stage"][] = [
  "draft",
  "persuade",
  "vote",
  "sign",
];

// ww209: a money bill's row is made from its money row (MoneyBills).
const rowOf = (id: string): GwLawRow | null =>
  GW_LAWS.find((r) => r.id === id) ?? moneyLawRow(id);

export function lawStage(n: GwNationState, id: string): GwLawState | null {
  return n.laws.find((x) => x.id === id) ?? null;
}

/**
 * The bills on the agenda, in the order they joined it. ww209: the money
 * bills sit in their own pinned place (`moneyAgenda`), not counted.
 */
export function lawAgenda(n: GwNationState): GwLawState[] {
  return n.laws.filter((x) => MOVING.includes(x.stage) && !isMoneyBill(x.id));
}

/** ww209: the money bills on their pinned place. */
export function moneyAgenda(n: GwNationState): GwLawState[] {
  return n.laws.filter((x) => MOVING.includes(x.stage) && isMoneyBill(x.id));
}

const agendaFull = (n: GwNationState): boolean =>
  lawAgenda(n).length >= GW_AGENDA_MAX;

function bodyOf(n: GwNationState, row: GwLawRow): GwLawBody | null {
  const law = authorityRow(n).law;
  if (law === undefined) return null;
  if (row.body === undefined) return law;
  return { kind: law.kind, inst: row.body, need: 0, decree: law.decree };
}

/** What the cabinet's camps make of it: a door the whole table stands in. */
function tableOf(gw: GreatWar, seat: GwSeatState, row: GwLawRow): number {
  if (row.issue === undefined) return 0;
  return voteCount(gw, seat, row.issue) >= 0 ? 1 : -1;
}

/** The count, and the body it fails at first. */
function tally(
  gw: GreatWar,
  seat: GwSeatState,
  n: GwNationState,
  row: GwLawRow,
): { count: number; stops: string | null } {
  // A bill the house runs (ww158): faction by faction, chamber by chamber.
  if (billRow(seat, row.id) !== null) {
    const t = houseTally(houseCounts(gw, seat, row.id, tableOf(gw, seat, row)));
    return { count: t.count, stops: t.stops };
  }
  const body = bodyOf(n, row);
  if (body === null) return { count: NOBODY, stops: null };
  const won = row.lean + (lawStage(n, row.id)?.support ?? 0);
  const table = tableOf(gw, seat, row);
  const first = (n.inst[body.inst] ?? 0) + won + table - body.need;
  const second =
    body.second === undefined
      ? first
      : (n.inst[body.second.inst] ?? 0) + won + table - body.second.need;
  if (first <= second) {
    return { count: first, stops: first < 0 ? body.inst : null };
  }
  return { count: second, stops: second < 0 ? body.second!.inst : null };
}

/** The count of this bill today; a bill that isn't this seat's has none. */
export function lawCount(gw: GreatWar, seat: GwSeatState, id: string): number {
  const n = gw.nation(seat.tag);
  const row = rowOf(id);
  if (n === null || row === null) return -NOBODY;
  return tally(gw, seat, n, row).count;
}

export function lawCanDecree(
  gw: GreatWar,
  seat: GwSeatState,
  id: string,
): boolean {
  const house = houseCanRound(gw, seat, id);
  if (house !== null) return house;
  const n = gw.nation(seat.tag);
  const row = rowOf(id);
  if (n === null || row === null || !row.decree) return false;
  const price = bodyOf(n, row)?.decree?.price;
  return price !== undefined && n.authority >= price;
}

function shiftInst(n: GwNationState, inst: GwInstitution, delta: number): void {
  const v = n.inst[inst];
  if (v === undefined) return;
  n.inst[inst] = clampTo(v + delta, GW_INST_MIN, GW_INST_MAX);
}

function setFlags(gw: GreatWar, row: GwLawRow, on: boolean): void {
  const f = row.flag;
  if (f === undefined) return;
  for (const seat of seatsOf(gw, row.tag)) {
    const was = seat.flags.includes(f);
    seat.flags = seat.flags.filter((x) => x !== f);
    if (on) seat.flags.push(f);
    if (row.censor !== undefined && was !== on) {
      moveCensor(gw, seat, on ? row.censor : -row.censor);
    }
  }
}

/** The row for a bill, made if nobody has touched it. */
function touchRow(n: GwNationState, id: string): GwLawState {
  const had = lawStage(n, id);
  if (had !== null) return had;
  const st: GwLawState = gwLawStart(id);
  n.laws.push(st);
  return st;
}

function toStage(
  gw: GreatWar,
  st: GwLawState,
  stage: GwLawState["stage"],
): void {
  st.stage = stage;
  st.since = gw.s.chapter;
}

function enact(
  ctx: SceneCtx,
  st: GwLawState,
  row: GwLawRow,
  how: "voted" | "decreed",
) {
  const { gw, seat } = ctx;
  // A decree the house now confirms: the law stands, with no second round of
  // its passing. ww204: a bill replacing the law in force passes as itself:
  // its passing effects run again, on its own text.
  const confirmed = st.kept !== null && st.faces >= 0;
  st.kept = null;
  // ww209: a money bill is spent by passing: the budget or credits run.
  if (isMoneyBill(row.id)) {
    st.faces = -1;
    st.how = how;
    toStage(gw, st, "idle");
    moneyPassed(ctx, st, how);
    return;
  }
  st.faces = how === "decreed" && houseRoundFaces(gw, seat) ? -2 : -1;
  toStage(gw, st, "force");
  st.how = how;
  if (confirmed) {
    reason(gw, seat, `law_in_${row.id}`);
    news(gw, "law_passed", row.tag);
    return;
  }
  st.after = false;
  setFlags(gw, row, true);
  runEffects(ctx, row.passed);
  // ww208: the text's push on the country's axes; its own factions gain.
  lawAxes(gw, seat, row, st.text);
  // ww207: the factions' trust and affinity (Utopia.ts).
  utopiaLawPassed(ctx, row, st.text, st.by);
  reason(gw, seat, `law_in_${row.id}`);
  seat.memory.push({
    key: `law_${row.id}`,
    who: null,
    chapter: gw.s.chapter,
    weight: 0,
  });
  news(gw, how === "voted" ? "law_passed" : "law_decreed", row.tag);
}

/** The draft's choice: this text goes out to be argued. */
export function lawText(
  gw: GreatWar,
  seat: GwSeatState,
  id: string,
  text: string,
  support: number,
): void {
  const n = gw.nation(seat.tag);
  const st = n === null ? null : lawStage(n, id);
  if (st?.stage !== "draft") return;
  // The text already in force: there is nothing to replace.
  if (st.kept === text) {
    backToForce(gw, st);
    return;
  }
  st.text = text;
  st.support += support;
  toStage(gw, st, "persuade");
  houseOpened(gw, seat, id);
}

/** A replacement or a confirmation that didn't happen: the old law stands. */
function backToForce(gw: GreatWar, st: GwLawState): void {
  st.text = st.kept;
  st.kept = null;
  st.support = 0;
  st.deals = [];
  st.whip = -1;
  st.warm = [];
  st.paper = [];
  st.paperAt = -1;
  st.delayTo = -1;
  toStage(gw, st, "force");
}

export function lawSupport(
  gw: GreatWar,
  seat: GwSeatState,
  id: string,
  delta: number,
): void {
  const n = gw.nation(seat.tag);
  const st = n === null ? null : lawStage(n, id);
  if (st === null || !MOVING.includes(st.stage)) return;
  st.support += delta;
}

/** The vote (a scene's `law_put`): as the call, with no question of confidence. */
export function lawPut(ctx: SceneCtx, id: string): void {
  const n = ctx.gw.nation(ctx.seat.tag);
  const row = rowOf(id);
  const st = n === null ? null : lawStage(n, id);
  if (n === null || row === null || st === null) return;
  if (st.stage !== "persuade" && st.stage !== "vote") return;
  put(ctx, n, st, row, false);
}

/** The count is the count: passed, sent to be signed, put off or failed. */
function put(
  ctx: SceneCtx,
  n: GwNationState,
  st: GwLawState,
  row: GwLawRow,
  confidence: boolean,
): void {
  const { gw, seat } = ctx;
  // ww210 merge: a bill whose body is the council of ministers (Vienna's own
  // business) goes to the council while the Reichsrat is shut.
  const council = row.body !== undefined && !houseSits(gw, seat, st.id);
  const house = council
    ? null
    : housePut(gw, seat, st, tableOf(gw, seat, row), confidence);
  if (house !== null) {
    // No chamber sits to vote on it: it waits on the agenda.
    if (house.stops === "no_sitting") {
      if (st.stage === "vote") toStage(gw, st, "persuade");
      return;
    }
    if (house.stops === "lords_delay") return;
    if (row.issue !== undefined) holdVote(gw, seat, row.issue);
    // ww209: the sovereign signs his own budget and credits.
    if (house.sign && !isMoneyBill(row.id)) {
      toStage(gw, st, "sign");
      houseSignCard(gw, seat);
    } else if (house.pass) enact(ctx, st, row, "voted");
    else {
      const band = house.band ?? "lost_narrow";
      lose(
        gw,
        seat,
        n,
        st,
        `house_no_${house.stops ?? "round"}`,
        band,
        confidence,
      );
    }
    return;
  }
  const { count, stops } = tally(gw, seat, n, row);
  if (row.issue !== undefined) holdVote(gw, seat, row.issue);
  if (count >= 0) {
    enact(ctx, st, row, "voted");
    return;
  }
  const band = count >= -1 ? "lost_narrow" : "lost_wide";
  lose(gw, seat, n, st, `law_no_${stops ?? "body"}`, band, confidence);
}

export function lawDecree(ctx: SceneCtx, id: string): void {
  const { gw, seat } = ctx;
  const n = gw.nation(seat.tag);
  const row = rowOf(id);
  const st = n === null ? null : lawStage(n, id);
  if (n === null || row === null || st === null) return;
  if (st.stage !== "persuade" && st.stage !== "vote") return;
  const house = houseRound(gw, seat, st, tableOf(gw, seat, row));
  if (house !== null) {
    if (house.pass) enact(ctx, st, row, "decreed");
    else lose(gw, seat, n, st, "house_no_round", "lost_narrow", false);
    return;
  }
  const d = bodyOf(n, row)?.decree ?? null;
  if (d === null || !lawCanDecree(gw, seat, id)) return;
  n.authority = clampTo(n.authority - d.price, 0, 100);
  shiftInst(n, d.inst, d.delta);
  enact(ctx, st, row, "decreed");
}

/** The sovereign's word on the bill the house passed (RUS, AUH). */
export function lawSign(ctx: SceneCtx, yes: boolean): void {
  const { gw, seat } = ctx;
  const n = gw.nation(seat.tag);
  const st = n?.laws.find((x) => x.stage === "sign") ?? null;
  const row = st === null ? null : rowOf(st.id);
  if (n === null || st === null || row === null) return;
  if (yes) {
    enact(ctx, st, row, "voted");
    return;
  }
  houseRefused(gw, seat, st);
  if (st.kept !== null) {
    backToForce(gw, st);
    return;
  }
  toStage(gw, st, "idle");
  st.support = 0;
  st.text = null;
  st.deals = [];
  st.whip = -1;
  st.warm = [];
}

/**
 * Thrown out (ww203 §6): the article locks (narrow 3, wide 6 chapters),
 * authority falls (5, 10), a wide defeat costs the sponsor a step of trust.
 * Where the house has a fall row a government bill lost wide heats it, and
 * one made a question of confidence takes it a whole step. A replacement or
 * a decree facing the house falls back to the law as it stood, or lapses.
 */
function lose(
  gw: GreatWar,
  seat: GwSeatState,
  n: GwNationState,
  st: GwLawState,
  key: string,
  band: GwVoteBand,
  confidence: boolean,
): void {
  // ww209: a money bill lost goes back to the lobby once, or fails for good.
  if (isMoneyBill(st.id)) {
    moneyLost({ gw, seat, cast: {} }, st, key, band, confidence);
    return;
  }
  const wide = band === "lost_wide";
  st.lost++;
  st.lockTo = gw.s.chapter + (wide ? GW_LOCK_WIDE : GW_LOCK_NARROW);
  n.authority = clampTo(
    n.authority - (wide ? GW_LOST_WIDE : GW_LOST_NARROW),
    0,
    100,
  );
  reason(gw, seat, key);
  const sponsor = st.sponsor === null ? null : gw.person(st.sponsor);
  if (wide && sponsor !== null) trustBy(sponsor, -1);
  const fall = houseFall(seat);
  if (fall !== null && st.origin === "seat" && (wide || confidence)) {
    heatThreat(gw, seat, { id: fall, by: fallBy(seat, fall, confidence) });
    reason(gw, seat, confidence ? "law_confidence_lost" : "law_lost_wide");
  }
  if (st.faces !== -1) {
    lapse(gw, seat, st);
    return;
  }
  if (st.kept !== null) {
    const lock = st.lockTo;
    backToForce(gw, st);
    st.lockTo = lock;
    return;
  }
  toStage(gw, st, "idle");
  st.support = 0;
  st.text = null;
  st.deals = [];
  st.whip = -1;
  st.warm = [];
  st.delayTo = -1;
  st.paper = [];
  st.paperAt = -1;
}

/** Heat a lost bill puts on the fall row: GW_FALL_HEAT, or the next step. */
export function fallBy(
  seat: GwSeatState,
  fall: string,
  confidence: boolean,
): number {
  if (!confidence) return GW_FALL_HEAT;
  const row = GW_GOV.find((r) => r.id === fall && r.tag === seat.tag);
  const heat = govHeat(seat, fall);
  const next = row?.steps.find((x) => x.at > heat)?.at ?? heat;
  return Math.max(GW_FALL_HEAT, next - heat);
}

/** A decree the house didn't confirm in time, or voted down: it lapses. */
function lapse(gw: GreatWar, seat: GwSeatState, st: GwLawState): void {
  const row = rowOf(st.id);
  st.kept = null;
  st.faces = -1;
  toStage(gw, st, "idle");
  st.how = "repealed";
  st.text = null;
  st.support = 0;
  st.deals = [];
  st.whip = -1;
  st.warm = [];
  st.paper = [];
  st.paperAt = -1;
  if (row !== null) setFlags(gw, row, false);
  reason(gw, seat, "law_lapsed");
  news(gw, "law_repealed", seat.tag);
}

export function lawHold(gw: GreatWar, seat: GwSeatState, id: string): void {
  const n = gw.nation(seat.tag);
  const st = n === null ? null : lawStage(n, id);
  if (st?.stage === "vote") toStage(gw, st, "persuade");
}

export function lawWithdraw(gw: GreatWar, seat: GwSeatState, id: string): void {
  const n = gw.nation(seat.tag);
  const st = n === null ? null : lawStage(n, id);
  if (st === null || !MOVING.includes(st.stage)) return;
  // The house brought it itself: the seat can only oppose it.
  if (st.origin === "house") return;
  // A decree facing the house can't be taken back: it is voted or lapses.
  if (st.faces !== -1) return;
  // ww213: the budget and voted credits are voted, never withdrawn; credits
  // by command put to the house anyway may be (no credits this period).
  if (isMoneyBill(st.id)) {
    if (moneyMayWithdraw(gw, seat, st.id)) moneyWithdrawn(gw, seat, st);
    return;
  }
  reason(gw, seat, "law_withdrawn");
  if (st.kept !== null) {
    backToForce(gw, st);
    return;
  }
  toStage(gw, st, "idle");
  st.support = 0;
  st.text = null;
  st.deals = [];
  st.whip = -1;
  st.delayTo = -1;
  st.lockTo = -1;
  st.paper = [];
  st.paperAt = -1;
}

function openNow(gw: GreatWar, seat: GwSeatState, row: GwLawRow): boolean {
  if (row.peace === true && !inPeace(gw, row.tag)) return false;
  // ww207: a faction's exclusive law waits for its node (Utopia.ts).
  if (exclusiveShut(seat, row)) return false;
  return holds({ gw, seat, cast: {} }, row.opens);
}

/**
 * ww208: peace is not being at war: the crisis weeks, the peace years,
 * neutrality, after the armistice. A `peace` row opens only then.
 */
function inPeace(gw: GreatWar, tag: string): boolean {
  return (gw.s.nations.find((n) => n.tag === tag)?.atWar.length ?? 0) === 0;
}

/** Withdrawn or repealed lately (a failed bill locks instead). */
function shelved(gw: GreatWar, st: GwLawState | null): boolean {
  return (
    st?.stage === "idle" && st.lockTo < 0 && gw.s.chapter - st.since < SHELF
  );
}

const locked = (gw: GreatWar, st: GwLawState | null): boolean =>
  st !== null && st.lockTo > gw.s.chapter;

function takeUp(
  gw: GreatWar,
  seat: GwSeatState,
  n: GwNationState,
  row: GwLawRow,
  sponsor: string | null,
  place: (card: GwCard) => void = (card) => placeCard(gw, seat, card),
): GwOrderBlock | null {
  const block = submitBlock(gw, seat, n, row);
  if (block !== null) return block;
  const had = lawStage(n, row.id);
  // A bill of an article in force replaces it: the law stands meanwhile.
  const kept = had?.stage === "force" ? (had.text ?? row.draft[0].id) : null;
  const how = had?.how ?? "none";
  if (billRow(seat, row.id) !== null) {
    const st = touchRow(n, row.id);
    const was = { ...st };
    resetHouse(st);
    st.support = 0;
    st.text = null;
    st.how = kept === null ? "none" : how;
    st.kept = kept;
    toStage(gw, st, "draft");
    if (houseDraft(gw, seat, st, sponsor, place)) return null;
    Object.assign(st, was);
    return "no_law";
  }
  const scene = sceneOf(`gw_law_${row.id}`);
  const card = scene === null ? null : makeCard(gw, seat, scene, "scheduled");
  if (card === null) return "no_law";
  const st = touchRow(n, row.id);
  st.support = 0;
  st.text = null;
  st.how = kept === null ? "none" : how;
  st.kept = kept;
  toStage(gw, st, "draft");
  place(card);
  return null;
}

/** Why the article's bill can't be submitted now; null: it can. */
function submitBlock(
  gw: GreatWar,
  seat: GwSeatState,
  n: GwNationState,
  row: GwLawRow,
): GwOrderBlock | null {
  if (row.tag !== seat.tag || !openNow(gw, seat, row)) return "no_law";
  const had = lawStage(n, row.id);
  if (had !== null && MOVING.includes(had.stage)) return "law_busy";
  // Only another bill of the article can replace the law in force.
  if (had?.stage === "force" && (row.draft.length < 2 || had.faces !== -1)) {
    return "no_law";
  }
  if (locked(gw, had)) return "law_locked";
  if (shelved(gw, had)) return "law_busy";
  if (agendaFull(n)) return "agenda_full";
  return null;
}

/**
 * ww193 merge: a department's bill task lays the law's draft as the country
 * tab's order would, into the head's tray instead of onto the desk: the
 * draft's card, or null when the law can't be taken up now.
 */
export function lawDraftCard(
  gw: GreatWar,
  seat: GwSeatState,
  id: string,
  sponsor: string | null,
): GwCard | null {
  const n = gw.nation(seat.tag);
  const row = rowOf(id);
  if (n === null || row === null || row.tag !== seat.tag) return null;
  let card: GwCard | null = null;
  const block = takeUp(gw, seat, n, row, sponsor, (c) => (card = c));
  return block === null ? card : null;
}

/** ww193 merge: whether the law could be taken up now (takeUp's checks). */
export function lawDraftable(
  gw: GreatWar,
  seat: GwSeatState,
  id: string,
): boolean {
  const n = gw.nation(seat.tag);
  const row = rowOf(id);
  if (n === null || row === null || row.tag !== seat.tag) return false;
  return submitBlock(gw, seat, n, row) === null;
}

/** The law whose draft `scene` is: `gw_law_<id>` or the house's draft. */
export function lawOfDraft(scene: string): string | null {
  if (scene.startsWith("gw_law_")) return scene.slice("gw_law_".length);
  const row = GW_LAWS.find((r) => houseIds.draft(r.id) === scene);
  return row?.id ?? null;
}

/** ww193 merge: a draft set aside unread (shelved): the bill goes back idle. */
export function lawDropDraft(
  gw: GreatWar,
  seat: GwSeatState,
  scene: string,
): void {
  const id = lawOfDraft(scene);
  const n = gw.nation(seat.tag);
  const st = id === null || n === null ? null : lawStage(n, id);
  if (st?.stage !== "draft") return;
  if (st.kept !== null) {
    resetHouse(st);
    backToForce(gw, st);
    return;
  }
  toStage(gw, st, "idle");
  st.support = 0;
  st.text = null;
  resetHouse(st);
}

function repeal(
  gw: GreatWar,
  seat: GwSeatState,
  n: GwNationState,
  row: GwLawRow,
): GwOrderBlock | null {
  const st = lawStage(n, row.id);
  if (st?.stage !== "force") return "no_law";
  if (st.faces !== -1) return "no_law";
  if (n.authority < row.repeal.authority) return "no_authority";
  n.authority -= row.repeal.authority;
  toStage(gw, st, "idle");
  st.how = "repealed";
  st.support = 0;
  st.text = null;
  st.lockTo = -1;
  setFlags(gw, row, false);
  runEffects({ gw, seat, cast: {} }, row.repeal.effects);
  reason(gw, seat, `law_out_${row.id}`);
  news(gw, "law_repealed", row.tag);
  return null;
}

/** The order from the country tab. */
export function lawOrder(
  gw: GreatWar,
  seat: GwSeatState,
  id: string,
  act: "draft" | "repeal",
  sponsor: string | null = null,
): GwOrderBlock | null {
  const n = gw.nation(seat.tag);
  const row = rowOf(id);
  if (n === null || row === null || row.tag !== seat.tag) return "no_law";
  return act === "draft"
    ? takeUp(gw, seat, n, row, sponsor)
    : repeal(gw, seat, n, row);
}

function resetHouse(st: GwLawState): void {
  st.origin = "seat";
  st.by = null;
  st.sponsor = null;
  st.deals = [];
  st.whip = -1;
  st.delayTo = -1;
  st.warm = [];
  st.paper = [];
  st.paperAt = -1;
  st.lockTo = -1;
}

/** A bill brought by a faction, an ally or the house (S2 and House.ts). */
export function lawBring(
  gw: GreatWar,
  seat: GwSeatState,
  id: string,
  origin: GwLawState["origin"],
): boolean {
  return houseBring(gw, seat, id, origin, null);
}

/** A decision of the desk already made it law: it stands, and is listed. */
function settle(gw: GreatWar, seat: GwSeatState, n: GwNationState): void {
  for (const row of GW_LAWS) {
    if (row.tag !== n.tag || row.settled === undefined) continue;
    const had = lawStage(n, row.id);
    if (had?.stage === "force" || had?.how === "repealed") continue;
    if (!openSettled(gw, seat, row)) continue;
    const st = touchRow(n, row.id);
    toStage(gw, st, "force");
    st.how = "scene";
    setFlags(gw, row, true);
  }
}

function openSettled(gw: GreatWar, seat: GwSeatState, row: GwLawRow): boolean {
  return holds({ gw, seat, cast: {} }, row.settled!);
}

/** What a law does on its months. */
function work(gw: GreatWar, n: GwNationState, st: GwLawState, row: GwLawRow) {
  // ww208: a peace row's terms work after the armistice too.
  if (gw.s.armistice !== null && row.peace !== true) return;
  for (const t of row.term) {
    if (t.text !== undefined && !t.text.includes(st.text ?? "")) continue;
    if (!everyMonths(gw, t.every, t.offset ?? 0)) continue;
    if (t.gauge === "manpower") {
      n.manpower = clampTo(n.manpower + t.delta, 0, 100);
    } else {
      moveGauge(gw, n.tag, t.gauge, t.delta, `law_line_${row.id}`);
    }
  }
}

function aftermath(
  gw: GreatWar,
  seat: GwSeatState,
  st: GwLawState,
  row: GwLawRow,
): void {
  if (row.after === undefined || st.after) return;
  if (gw.s.chapter - st.since < row.after.chapters) return;
  st.after = true;
  const scene = `gw_lf_${row.id}`;
  if (sceneOf(scene) === null) return;
  seat.scheduled.push({ scene, chapter: gw.s.chapter + 1 });
}

/** Chapter step, after the budget. */
export function lawStep(gw: GreatWar): void {
  const c = gw.s.chapter;
  for (const n of gw.s.nations) {
    const seat = seatsOf(gw, n.tag)[0];
    if (seat === undefined) {
      for (const st of n.laws) {
        const row = rowOf(st.id);
        if (row !== null && st.stage === "force") work(gw, n, st, row);
      }
      continue;
    }
    settle(gw, seat, n);
    for (const st of [...n.laws]) {
      const row = rowOf(st.id);
      if (row === null) continue;
      faceStep(gw, seat, n, st);
      // A faction's own bill comes to the vote by itself; a regent takes no
      // bill to the vote: it waits for the friend's return.
      const due = st.origin === "house" && c - st.since >= GW_HOUSE_AUTO;
      if (st.stage === "persuade" && due && !seat.regent) {
        lawCall(gw, seat, st.id, false);
      }
      // The law in force works on, also while a bill moves to replace it.
      if (st.stage === "force" || st.kept !== null) work(gw, n, st, row);
      if (st.stage === "force") aftermath(gw, seat, st, row);
    }
  }
  lawAiStep(gw);
}

/**
 * A decree made while the house was away (Art. 87, §14): when the house is
 * back it goes on the agenda to be confirmed, and lapses unless passed
 * within GW_DECREE_FACE chapters.
 */
function faceStep(
  gw: GreatWar,
  seat: GwSeatState,
  n: GwNationState,
  st: GwLawState,
): void {
  if (st.faces === -2 && st.stage === "force" && houseBack(gw, seat)) {
    if (agendaFull(n)) return;
    st.kept = st.text ?? rowOf(st.id)?.draft[0].id ?? null;
    st.text = st.kept;
    resetHouse(st);
    st.faces = gw.s.chapter + GW_DECREE_FACE;
    toStage(gw, st, "persuade");
    houseOpened(gw, seat, st.id);
    reason(gw, seat, "law_faces");
    return;
  }
  if (st.faces >= 0 && MOVING.includes(st.stage) && gw.s.chapter > st.faces) {
    lapse(gw, seat, st);
  }
}

// ---- ww203: the orders of the law book and the agenda ----

const ctxOf = (gw: GreatWar, seat: GwSeatState): SceneCtx => ({
  gw,
  seat,
  cast: {},
});

/** 제출 / 다른 안으로 바꾼다: the article's draft goes to the sponsor. */
export function lawSubmit(
  gw: GreatWar,
  seat: GwSeatState,
  id: string,
  sponsor: string | null,
): GwOrderBlock | null {
  return lawOrder(gw, seat, id, "draft", sponsor);
}

/** Why the call is shut on an agenda bill; null: it can be called now. */
function callWhy(
  gw: GreatWar,
  seat: GwSeatState,
  st: GwLawState,
): GwCallWhy | null {
  if (st.stage === "draft") return "draft";
  if (st.stage === "sign") return "sign";
  if (st.delayTo !== -1 && gw.s.chapter < st.delayTo) return "lords";
  if (billRow(seat, st.id) === null) return null;
  if (houseSat(gw, seat, st.id)) return "recess";
  // ww210 merge: with the house shut, a council bill goes to the council.
  if (!houseSits(gw, seat, st.id)) {
    return rowOf(st.id)?.body !== undefined ? null : "no_sitting";
  }
  return null;
}

const CALL_BLOCKS: Readonly<Record<GwCallWhy, GwOrderBlock>> = {
  draft: "no_law",
  sign: "no_law",
  lords: "lords_wait",
  recess: "recess",
  no_sitting: "no_law",
};

/** 표결에 부친다 (or 신임을 건다, where the house has a fall row). */
export function lawCall(
  gw: GreatWar,
  seat: GwSeatState,
  id: string,
  confidence: boolean,
): GwOrderBlock | null {
  const n = gw.nation(seat.tag);
  const row = rowOf(id);
  const st = n === null ? null : lawStage(n, id);
  if (n === null || row === null || st === null) return "no_law";
  if (!MOVING.includes(st.stage)) return "no_law";
  const why = callWhy(gw, seat, st);
  if (why !== null) return CALL_BLOCKS[why];
  if (confidence && (billRow(seat, id) === null || houseFall(seat) === null)) {
    return "no_law";
  }
  put(ctxOf(gw, seat), n, st, row, confidence);
  return null;
}

/** 돌아간다: the way round, where it is open and paid for. */
export function lawRound(
  gw: GreatWar,
  seat: GwSeatState,
  id: string,
): GwOrderBlock | null {
  const n = gw.nation(seat.tag);
  const st = n === null ? null : lawStage(n, id);
  if (st === null || (st.stage !== "persuade" && st.stage !== "vote")) {
    return "no_law";
  }
  if (st.faces !== -1) return "no_law";
  if (!lawCanDecree(gw, seat, id)) return "no_authority";
  lawDecree(ctxOf(gw, seat), id);
  return null;
}

/** 철회: off the agenda; a faction's own bill, or a decree facing the house, can't. */
export function lawWithdrawOrder(
  gw: GreatWar,
  seat: GwSeatState,
  id: string,
): GwOrderBlock | null {
  const n = gw.nation(seat.tag);
  const st = n === null ? null : lawStage(n, id);
  if (st === null || !MOVING.includes(st.stage)) return "no_law";
  if (st.origin === "house" || st.faces !== -1) return "no_law";
  if (!moneyMayWithdraw(gw, seat, id)) return "money_kept";
  lawWithdraw(gw, seat, id);
  return null;
}

/** A count answer's course on its bill (effect `bill_topic`). */
export function lawTopic(ctx: SceneCtx, act: GwBillAct): void {
  const { gw, seat } = ctx;
  const n = gw.nation(seat.tag);
  const id = ctx.topic ?? ctx.card?.dept?.topic ?? null;
  const st = id === null || n === null ? null : lawStage(n, id);
  if (st === null || !MOVING.includes(st.stage)) return;
  if (act === "vote") lawCall(gw, seat, st.id, false);
  else if (act === "withdraw") lawWithdrawOrder(gw, seat, st.id);
  else houseWork(ctx, st.id, act);
}

// ---- ww203 §9: AI countries ----

/**
 * Every GW_AI_LAW_EVERY chapters a country nobody plays takes the open
 * article that best answers its weakest gauge and passes its first bill by
 * its house's count (House.rowCount), or goes round when the count fails and
 * it has the authority: a news line, no scene, no passing effects.
 */
export function lawAiStep(gw: GreatWar): void {
  if (gw.s.chapter <= 0 || gw.s.chapter % GW_AI_LAW_EVERY !== 0) return;
  for (const n of gw.s.nations) {
    if (n.out || seatsOf(gw, n.tag).length > 0) continue;
    if (!GW_LAWS.some((r) => r.tag === n.tag)) continue;
    const ghost = blankSeat(-1, n.tag);
    const row = aiPick(gw, ghost, n);
    if (row === null) continue;
    const text = row.draft[0].id;
    const count = rowCount(gw, ghost, row.id, text);
    const price = bodyOf(n, row)?.decree?.price ?? null;
    let how: "voted" | "decreed" | null = null;
    if (count === null || count.pass) how = count === null ? null : "voted";
    if (how === null && row.decree && price !== null && n.authority >= price) {
      n.authority -= price;
      how = "decreed";
    }
    if (how === null) continue;
    const st = touchRow(n, row.id);
    st.text = text;
    st.how = how;
    st.after = true;
    toStage(gw, st, "force");
    aiPassed(gw, ghost, row);
    lawAxes(gw, null, row, text);
    news(gw, how === "voted" ? "law_passed" : "law_decreed", n.tag);
  }
}

/**
 * ww204: an AI country's law works on the country as the seat's would: the
 * passing effects that touch the nation (gauges, weights, manpower and
 * readiness); what only a seat keeps (flags, promises, people) has no one.
 */
const AI_EFFECTS: ReadonlySet<string> = new Set(["gauge", "inst"]);
const AI_WORLD: ReadonlySet<string> = new Set(["manpower", "readiness"]);

function aiPassed(gw: GreatWar, ghost: GwSeatState, row: GwLawRow): void {
  const effects = row.passed.filter(
    (e) =>
      AI_EFFECTS.has(e.kind) || (e.kind === "world" && AI_WORLD.has(e.of.do)),
  );
  runEffects({ gw, seat: ghost, cast: {} }, effects);
}

function aiPick(
  gw: GreatWar,
  ghost: GwSeatState,
  n: GwNationState,
): GwLawRow | null {
  const weakest = [...GW_GAUGES].sort(
    (a, b) =>
      n.gauges[a] * GW_GAUGE_MAX[b] - n.gauges[b] * GW_GAUGE_MAX[a] ||
      GW_GAUGES.indexOf(a) - GW_GAUGES.indexOf(b),
  )[0];
  const wants = AI_NEEDS[weakest];
  const open = GW_LAWS.filter((r) => {
    if (r.tag !== n.tag || r.chapter === undefined) return false;
    if (!wants.includes(r.chapter)) return false;
    const st = lawStage(n, r.id);
    if (st !== null && (st.stage !== "idle" || st.how === "repealed")) {
      return false;
    }
    if (r.peace === true && !inPeace(gw, r.tag)) return false;
    return holds({ gw, seat: ghost, cast: {} }, r.opens);
  });
  open.sort((a, b) => wants.indexOf(a.chapter!) - wants.indexOf(b.chapter!));
  return open[0] ?? null;
}

/** The bill has been taken up, so the desk's older paper on it stands aside. */
export function lawReplaces(
  gw: GreatWar,
  seat: GwSeatState,
  scene: string,
): boolean {
  const n = gw.nation(seat.tag);
  if (n === null) return false;
  return GW_LAWS.some(
    (r) =>
      r.tag === seat.tag &&
      r.replaces?.includes(scene) === true &&
      (lawStage(n, r.id)?.stage ?? "idle") !== "idle",
  );
}

function outlook(count: number): GwLawOutlook {
  if (count >= 2) return "easy";
  if (count >= 0) return "tight";
  return count === -1 ? "short" : "blocked";
}

/** A house bill's outlook is the count paper's word, right or wrong. */
function whipOutlook(word: number): GwLawOutlook | null {
  if (word < 0) return null;
  return OUTLOOK_OF_WHIP[word] ?? null;
}

function talkOf(
  gw: GreatWar,
  seat: GwSeatState,
  row: GwLawRow,
): GwLawView["talk"] {
  const topic = `gw_lt_${row.id}`;
  const scene = sceneOf(topic);
  if (scene === null) return null;
  const person = castOf(gw, seat, scene)?.who ?? null;
  if (person === null || !summonable(gw, seat, person, topic)) return null;
  return { person, topic };
}

function view(
  gw: GreatWar,
  seat: GwSeatState,
  n: GwNationState,
  row: GwLawRow,
): GwLawView | null {
  const st = lawStage(n, row.id);
  const live = st !== null && st.stage !== "idle";
  if (!live && !openNow(gw, seat, row)) return null;
  const go = agendaFull(n) ? n : null;
  const body = bodyOf(n, row);
  const force = st?.stage === "force";
  return {
    id: row.id,
    stage: live ? st.stage : "open",
    how: st?.how ?? "none",
    text: st?.text ?? null,
    outlook:
      st !== null && MOVING.includes(st.stage)
        ? billRow(seat, row.id) !== null
          ? whipOutlook(st.whip)
          : outlook(tally(gw, seat, n, row).count)
        : null,
    body: body?.inst ?? null,
    second: body?.second?.inst ?? null,
    decree: row.decree && (body?.decree ?? null) !== null,
    waits: live
      ? null
      : go !== null
        ? "busy"
        : shelved(gw, st)
          ? "shelved"
          : null,
    talk:
      st !== null && MOVING.includes(st.stage) ? talkOf(gw, seat, row) : null,
    ...(billRow(seat, row.id) === null ? {} : { house: true }),
    repeal: force
      ? {
          tell: [`authority:-${row.repeal.authority}`, ...row.repeal.tell],
          open: n.authority >= row.repeal.authority,
        }
      : null,
  };
}

/** The country tab's lines: what can be brought, what moves, what stands. */
export function lawViews(gw: GreatWar, seat: GwSeatState): GwLawView[] {
  const n = gw.nation(seat.tag);
  if (n === null) return [];
  if (gwContent().scenes.length === 0) return [];
  return GW_LAWS.flatMap((row) => {
    if (row.tag !== seat.tag) return [];
    return view(gw, seat, n, row) ?? [];
  });
}

/** The country has bills, so its box shows even before one opens (w159). */
export function lawsAhead(gw: GreatWar, seat: GwSeatState): boolean {
  if (gw.nation(seat.tag) === null) return false;
  if (gwContent().scenes.length === 0) return false;
  return GW_LAWS.some((row) => row.tag === seat.tag);
}

// ---- ww203: the 법전 and 의사일정 ----

function articleView(
  gw: GreatWar,
  seat: GwSeatState,
  n: GwNationState,
  row: GwLawRow,
): GwArticleView {
  const st = lawStage(n, row.id);
  const opens = openNow(gw, seat, row);
  const stage =
    st !== null && st.stage !== "idle" ? st.stage : opens ? "open" : "shut";
  const inForce = st?.stage === "force" ? (st.text ?? row.draft[0].id) : null;
  const force = st?.kept ?? inForce;
  const block = submitBlock(gw, seat, n, row);
  const why: GwBookWhy | null =
    block === null
      ? null
      : !opens
        ? "closed"
        : block === "agenda_full"
          ? "full"
          : block === "law_locked"
            ? "locked"
            : st !== null && MOVING.includes(st.stage)
              ? "moving"
              : shelved(gw, st)
                ? "shelved"
                : null;
  return {
    id: row.id,
    chapter: row.chapter ?? null,
    bills: row.draft.map((d) => d.id),
    force,
    how: st?.how ?? "none",
    stage,
    can: block !== null ? null : st?.stage === "force" ? "replace" : "submit",
    why,
    lockTo: locked(gw, st) ? st!.lockTo : null,
    house: billRow(seat, row.id) !== null,
    repeal:
      st?.stage === "force" && st.faces === -1
        ? {
            tell: [`authority:-${row.repeal.authority}`, ...row.repeal.tell],
            open: n.authority >= row.repeal.authority,
          }
        : null,
  };
}

export function agendaView(
  gw: GreatWar,
  seat: GwSeatState,
  n: GwNationState,
  st: GwLawState,
): GwAgendaView {
  const house = billRow(seat, st.id) !== null;
  const why = callWhy(gw, seat, st);
  const open = st.stage === "persuade" || st.stage === "vote";
  const counting = (seat.depts?.tasks ?? []).some(
    (t) => t.type === "count" && t.topic === st.id,
  );
  return {
    law: st.id,
    text: st.text,
    replaces: st.kept,
    stage: st.stage as GwAgendaView["stage"],
    origin: st.origin,
    by: st.by,
    sponsor: st.sponsor,
    age: gw.s.chapter - st.since,
    auto: st.origin === "house" ? st.since + GW_HOUSE_AUTO : null,
    chambers: house ? houseChambers(seat, st.id) : [],
    paper:
      st.paperAt < 0 || st.whip < 0
        ? null
        : {
            word: whipOutlook(st.whip) ?? "tight",
            conf: st.paper[0]?.conf ?? "heard",
            chapter: st.paperAt,
          },
    counting,
    counter: house && open ? countOffice(gw, seat) : null,
    call: open && why === null,
    callWhy: why,
    confidence: open && why === null && house && houseFall(seat) !== null,
    round: open && st.faces === -1 && lawCanDecree(gw, seat, st.id),
    withdraw:
      st.origin !== "house" &&
      st.faces === -1 &&
      moneyMayWithdraw(gw, seat, st.id),
    delayTo: st.delayTo < 0 ? null : st.delayTo,
    lobby: house ? lobbyViews(gw, seat, st.id) : [],
  };
}

/** The 통치 tab's 법전 and 의사일정; undefined for a country with no bills. */
export function lawBookView(
  gw: GreatWar,
  seat: GwSeatState,
): GwBookView | undefined {
  const n = gw.nation(seat.tag);
  if (n === null || gwContent().scenes.length === 0) return undefined;
  const rows = GW_LAWS.filter((r) => r.tag === seat.tag);
  if (rows.length === 0) return undefined;
  return {
    articles: rows.map((r) => articleView(gw, seat, n, r)),
    agenda: lawAgenda(n).map((st) => agendaView(gw, seat, n, st)),
    max: GW_AGENDA_MAX,
    calls: seat.house?.calls ?? 0,
  };
}

/** The office that would count a bill now (its house row's first with a head). */
function countOffice(gw: GreatWar, seat: GwSeatState): string | null {
  return houseCounter(seat, (o) => deptHead(gw, seat, o) !== null);
}
