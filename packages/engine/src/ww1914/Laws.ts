// Great War 1914: bills and laws, running (brief ww142, lane L). A bill goes
// draft, persuade, vote or decree, in force, one at a time, over a few chapters.
// In force it works on its months until it is repealed, at a price. Who can stop
// it is the form of government's (AuthorityTable `law`); what it is, a row of
// GW_LAWS. Only seats bring bills: an AI country runs on what it has. Nothing is
// rolled: a bill short of votes is short for reasons the seat can read, and
// it can always be argued again, put off or taken back.
import {
  GW_INST_MAX,
  GW_INST_MIN,
  GwInstitution,
  GwNationState,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type {
  GwLawOutlook,
  GwLawState,
  GwLawView,
} from "@openfront/engine-api/ww1914/GwLaw";
import type { GwOrderBlock } from "@openfront/engine-api/ww1914/GwOrders";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { GW_LAWS } from "@openfront/engine-lib/ww1914/content/scenes/laws";
import type { GwLawBody, GwLawRow } from "@openfront/engine-lib/ww1914/LawRows";
import { authorityRow, holdVote, voteCount } from "./Authority";
import { makeCard, placeCard } from "./Desk";
import type { GreatWar } from "./GreatWar";
import {
  billRow,
  houseBring,
  houseCanRound,
  houseCounts,
  houseDraft,
  houseOpened,
  housePut,
  houseRefused,
  houseRound,
  houseSignCard,
  houseTally,
  persuadeChapters,
} from "./House";
import { summonable } from "./Orders";
import { moveCensor } from "./Press";
import { castOf, holds, runEffects, SceneCtx, sceneOf } from "./SceneRun";
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
/** Authority a bill thrown out costs its sponsor. */
const LOST_PRICE = 5;
/** The count a bill with no body to pass it has. */
const NOBODY = 9;

const MOVING: readonly GwLawState["stage"][] = [
  "draft",
  "persuade",
  "vote",
  "sign",
];

const rowOf = (id: string): GwLawRow | null =>
  GW_LAWS.find((r) => r.id === id) ?? null;

export function lawStage(n: GwNationState, id: string): GwLawState | null {
  return n.laws.find((x) => x.id === id) ?? null;
}

const moving = (n: GwNationState): GwLawState | null =>
  n.laws.find((x) => MOVING.includes(x.stage)) ?? null;

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
  const st: GwLawState = {
    id,
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
  toStage(gw, st, "force");
  st.how = how;
  st.after = false;
  setFlags(gw, row, true);
  runEffects(ctx, row.passed);
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
  st.text = text;
  st.support += support;
  toStage(gw, st, "persuade");
  houseOpened(gw, seat, id);
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

/** The day of the vote. Thrown out, it goes back to be argued: never lost. */
export function lawPut(ctx: SceneCtx, id: string): void {
  const { gw, seat } = ctx;
  const n = gw.nation(seat.tag);
  const row = rowOf(id);
  const st = n === null ? null : lawStage(n, id);
  if (n === null || row === null || st?.stage !== "vote") return;
  const house = housePut(gw, seat, st, tableOf(gw, seat, row));
  if (house !== null) {
    if (row.issue !== undefined) holdVote(gw, seat, row.issue);
    if (house.sign) {
      toStage(gw, st, "sign");
      houseSignCard(gw, seat);
    } else if (house.pass) enact(ctx, st, row, "voted");
    else if (house.stops !== "lords_delay") lose(gw, seat, n, st, house.stops);
    return;
  }
  const { count, stops } = tally(gw, seat, n, row);
  if (row.issue !== undefined) holdVote(gw, seat, row.issue);
  if (count >= 0) {
    enact(ctx, st, row, "voted");
    return;
  }
  st.lost++;
  toStage(gw, st, "persuade");
  n.authority = clampTo(n.authority - LOST_PRICE, 0, 100);
  reason(gw, seat, `law_no_${stops ?? "body"}`);
}

export function lawDecree(ctx: SceneCtx, id: string): void {
  const { gw, seat } = ctx;
  const n = gw.nation(seat.tag);
  const row = rowOf(id);
  const st = n === null ? null : lawStage(n, id);
  if (n === null || row === null || st?.stage !== "vote") return;
  const house = houseRound(gw, seat, st, tableOf(gw, seat, row));
  if (house !== null) {
    if (house.pass) enact(ctx, st, row, "decreed");
    else lose(gw, seat, n, st, null);
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
  toStage(gw, st, "idle");
  st.support = 0;
  st.text = null;
  st.deals = [];
  st.whip = -1;
  st.warm = [];
}

/** Thrown out: back to the house, at its sponsor's cost. */
function lose(
  gw: GreatWar,
  seat: GwSeatState,
  n: GwNationState,
  st: GwLawState,
  stops: string | null,
): void {
  st.lost++;
  toStage(gw, st, "persuade");
  n.authority = clampTo(n.authority - LOST_PRICE, 0, 100);
  reason(gw, seat, `house_no_${stops ?? "round"}`);
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
  toStage(gw, st, "idle");
  st.support = 0;
  st.text = null;
  st.deals = [];
  st.whip = -1;
  st.delayTo = -1;
  reason(gw, seat, "law_withdrawn");
}

function openNow(gw: GreatWar, seat: GwSeatState, row: GwLawRow): boolean {
  return holds({ gw, seat, cast: {} }, row.opens);
}

function shelved(gw: GreatWar, st: GwLawState | null): boolean {
  return st?.stage === "idle" && gw.s.chapter - st.since < SHELF;
}

function takeUp(
  gw: GreatWar,
  seat: GwSeatState,
  n: GwNationState,
  row: GwLawRow,
  sponsor: string | null,
): GwOrderBlock | null {
  if (row.tag !== seat.tag || !openNow(gw, seat, row)) return "no_law";
  const had = lawStage(n, row.id);
  if (had !== null && had.stage !== "idle") return "no_law";
  if (moving(n) !== null || shelved(gw, had)) return "law_busy";
  if (billRow(seat, row.id) !== null) {
    const st = touchRow(n, row.id);
    const was = { ...st };
    resetHouse(st);
    st.support = 0;
    st.text = null;
    st.how = "none";
    toStage(gw, st, "draft");
    if (houseDraft(gw, seat, st, sponsor)) return null;
    Object.assign(st, was);
    return "no_law";
  }
  const scene = sceneOf(`gw_law_${row.id}`);
  const card = scene === null ? null : makeCard(gw, seat, scene, "scheduled");
  if (card === null) return "no_law";
  const st = touchRow(n, row.id);
  st.support = 0;
  st.text = null;
  st.how = "none";
  toStage(gw, st, "draft");
  placeCard(gw, seat, card);
  return null;
}

function repeal(
  gw: GreatWar,
  seat: GwSeatState,
  n: GwNationState,
  row: GwLawRow,
): GwOrderBlock | null {
  const st = lawStage(n, row.id);
  if (st?.stage !== "force") return "no_law";
  if (n.authority < row.repeal.authority) return "no_authority";
  n.authority -= row.repeal.authority;
  toStage(gw, st, "idle");
  st.how = "repealed";
  st.support = 0;
  st.text = null;
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

function waiting(seat: GwSeatState, scene: string): boolean {
  return (
    seat.scheduled.some((q) => q.scene === scene) ||
    seat.desk.some((c) => c.scene === scene)
  );
}

function callDay(gw: GreatWar, seat: GwSeatState, id: string): void {
  const scene = `gw_lv_${id}`;
  if (sceneOf(scene) === null || waiting(seat, scene)) return;
  seat.scheduled.push({ scene, chapter: gw.s.chapter + 1 });
}

/** What a law does on its months. */
function work(gw: GreatWar, n: GwNationState, st: GwLawState, row: GwLawRow) {
  if (gw.s.armistice !== null) return;
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
    if (seat === undefined) continue;
    settle(gw, seat, n);
    for (const st of n.laws) {
      const row = rowOf(st.id);
      if (row === null) continue;
      const argue = persuadeChapters(seat, st.id);
      if (st.stage === "persuade" && c - st.since >= argue) {
        toStage(gw, st, "vote");
      }
      // The Lords have put it off: the day waits for the delay to run out.
      const waits = st.delayTo !== -1 && c < st.delayTo;
      if (st.stage === "vote" && !waits) callDay(gw, seat, st.id);
      if (st.stage === "force") {
        work(gw, n, st, row);
        aftermath(gw, seat, st, row);
      }
    }
  }
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

/** A house bill's outlook is the whip's word, right or wrong. */
function whipOutlook(word: number): GwLawOutlook | null {
  if (word < 0) return null;
  return (
    (["easy", "tight", "tight", "short", "blocked"] as const)[word] ?? null
  );
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
  const go = moving(n);
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
