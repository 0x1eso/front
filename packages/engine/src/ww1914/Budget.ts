// Great War 1914: the yearly budget, running (brief ww140). The rule itself is
// engine-lib/ww1914/BudgetRules; this file holds what touches the state: the
// meeting, the signature, the money flowing a little every chapter, what debt
// and prices bring back. AI countries go through the same functions. No money
// never stops a country: what the treasury can't pay is printed, and a
// bankruptcy is a card with choices, never an ending.
import {
  GW_GAUGE_MAX,
  GW_INST_MAX,
  GW_INST_MIN,
  GW_SEA_MAX,
  GwNationState,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GW_BUDGET_DRIFTS,
  GW_BUDGET_LINES,
  GW_BUDGET_SOURCES,
  GW_MONEY_DEADLINE,
  GW_RAISE_MAX,
  GW_TAX_MAX,
  GW_TAX_MIN,
  GwBudgetBasis,
  GwBudgetDrift,
  GwBudgetHow,
  GwBudgetItem,
  GwBudgetPlan,
  GwBudgetSource,
  GwBudgetView,
  GwLenderView,
} from "@openfront/engine-api/ww1914/GwBudget";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwOrderBlock } from "@openfront/engine-api/ww1914/GwOrders";
import {
  budgetBody,
  budgetDraft,
  budgetNorm,
  budgetRow,
  budgetValid,
  budgetVote,
  budgetYear,
  GW_BUDGET_DECREE,
  GW_DRIFT_STEP,
  GW_LOAD_CRUSHING,
  GW_PRICES_CRISIS,
  GW_PRICES_MAX,
  GwBudgetBody,
  GwBudgetVote,
  GwLender,
  loadOf,
  moneyStep,
  moneyWord,
  printedPrices,
  tilted,
} from "@openfront/engine-lib/ww1914/BudgetRules";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import {
  GW_ARMY_OFF,
  GW_OWNER_OFF,
  GW_PURSE_IDEALS,
  GW_TAX_AXIS,
  moneyIds,
  moneyRowOf,
  type GwLineOwner,
} from "@openfront/engine-lib/ww1914/MoneyRows";
import {
  civilFromDays,
  formatIsoDate,
} from "@openfront/engine-lib/ww1936/Calendar";
import { dissolvedNow, GW_ELECTION_DAYS } from "./Assumes";
import { econCrisis, econRecord, econTerms, sumOf, whyOf } from "./Economy";
import type { GreatWar } from "./GreatWar";
import { chamberSits, houseRow } from "./House";
import { officeHolder, trustBy } from "./People";
import { moveAxis, societyDo } from "./Society";
import {
  chapterOf,
  clampTo,
  fights,
  moveGauge,
  reason,
  ruledBySeat,
  seatsOf,
} from "./World";

/** Chapters between two bankruptcy crises. */
const CRISIS_GAP = 10;
/** How far back the news counts for the bond market, chapters. */
const NEWS_CHAPTERS = 6;
/** The meeting's card: gone once the budget is signed from the panel. */
const MEETING = /^gw_bm_/;

const known = (scene: string) => gwContent().scenes.some((x) => x.id === scene);

const flagsOf = (gw: GreatWar, n: GwNationState): string[] =>
  seatsOf(gw, n.tag).flatMap((x) => x.flags);

/** The regime's body, unless a decree carries the budget past it (ww171). */
const bodyOf = (gw: GreatWar, n: GwNationState): GwBudgetBody | null =>
  budgetBody(n.regime, flagsOf(gw, n));

/** ww209: who votes the budget now; null when a decree carries it. */
export const budgetBodyOf = bodyOf;

/**
 * ww209: the country's money goes through its house as bills (MoneyBills):
 * a seat's country with a house and a money row. Others keep the old way.
 */
export function moneyRuns(gw: GreatWar, n: GwNationState): boolean {
  return (
    seatsOf(gw, n.tag).length > 0 &&
    houseRow(n.tag) !== null &&
    moneyRowOf(gwContent().money, n.tag) !== null
  );
}

/** ww209: the budget is a bill in the house now (not by decree). */
export const moneyVoted = (gw: GreatWar, n: GwNationState): boolean =>
  moneyRuns(gw, n) && bodyOf(gw, n) !== null;

/** A decree that stands while the house is gone or sent home (not a once). */
const shutByDecree = (gw: GreatWar, n: GwNationState): boolean => {
  const flags = flagsOf(gw, n);
  return GW_BUDGET_DECREE.some(
    (d) => d.once !== true && flags.includes(d.flag),
  );
};

/**
 * ww190: the chamber that votes the budget doesn't sit (dissolved till its
 * election): no bill passes through it. It waits, or is forced past it.
 */
function houseShut(gw: GreatWar, n: GwNationState): boolean {
  const body = bodyOf(gw, n);
  if (body === null) return false;
  const row = houseRow(n.tag);
  const chamber = row?.chambers.find((c) => c.inst === body.inst);
  return seatsOf(gw, n.tag).some((seat) =>
    chamber === undefined
      ? dissolvedNow(gw, seat)
      : !chamberSits({ gw, seat, cast: {} }, chamber),
  );
}

/** A decree that carries one budget is spent by the budget it carried. */
function spendDecree(gw: GreatWar, n: GwNationState): void {
  const flags = flagsOf(gw, n);
  const used = GW_BUDGET_DECREE.filter(
    (d) => d.once === true && flags.includes(d.flag),
  );
  if (used.length === 0) return;
  for (const seat of seatsOf(gw, n.tag)) {
    seat.flags = seat.flags.filter((f) => !used.some((d) => d.flag === f));
  }
  tellSeats(gw, n, "budget_by_decree");
}

function note(
  n: GwNationState,
  item: GwBudgetItem,
  key: string,
  delta: number,
): void {
  if (delta === 0) return;
  const row = n.budget.notes.find((x) => x.item === item && x.key === key);
  if (row !== undefined) row.delta += delta;
  else n.budget.notes.push({ item, key, delta });
}

function shiftInst(
  n: GwNationState,
  inst: keyof GwNationState["inst"],
  delta: number,
): void {
  const v = n.inst[inst];
  if (v === undefined) return;
  n.inst[inst] = clampTo(v + delta, GW_INST_MIN, GW_INST_MAX);
}

/** A run of news from the front for this country's bond market, -2..2. */
function newsOf(gw: GreatWar, n: GwNationState): number {
  const s = gw.s;
  let run = 0;
  for (const b of s.battles) {
    if (b.chapter < s.chapter - NEWS_CHAPTERS || b.by === null) continue;
    if (b.result !== "advance" && b.result !== "break") continue;
    run += b.by === n.side ? 1 : -1;
  }
  return clampTo(run, -2, 2);
}

function warYears(gw: GreatWar, n: GwNationState): number {
  if (n.entered === null) return 0;
  const chapters = gwChapters(gw.s.calendar);
  const from = chapters[Math.min(n.entered, chapters.length - 1)].day;
  return Math.max(0, Math.floor((gw.s.day - from) / 360));
}

function lenderOpen(gw: GreatWar, n: GwNationState, l: GwLender): boolean {
  if (n.budget.shutUntil > gw.s.chapter) return false;
  const who = gw.nation(l.tag);
  if (who === null || who.out || who.tag === n.tag) return false;
  if (n.atWar.includes(who.tag)) return false;
  if (who.side !== null && who.side !== n.side) return false;
  return (n.trust[who.tag] ?? 0) >= -2;
}

function lenders(gw: GreatWar, n: GwNationState): GwLenderView[] {
  return budgetRow(n.tag).lenders.map((l) => {
    const open = lenderOpen(gw, n, l);
    // New York's credit runs out in a game where the cliff is there.
    const cliff =
      l.id === "morgan" && gw.s.secrets.includes("usa_credit_cliff") ? 2 : 1;
    return {
      id: l.id,
      open,
      cap: open ? Math.floor(l.cap / cliff) : 0,
      owed: n.budget.lent[l.id] ?? 0,
    };
  });
}

export function basisOf(gw: GreatWar, n: GwNationState): GwBudgetBasis {
  const b = n.budget;
  return {
    tag: n.tag,
    war: n.atWar.length > 0,
    warYears: warYears(gw, n),
    treasury: b.treasury,
    debt: b.debt,
    prices: b.prices,
    rate: b.rate,
    morale: n.gauges.morale,
    news: newsOf(gw, n),
    loanCap: lenders(gw, n).reduce((a, l) => a + l.cap, 0),
    rally: n.atWar.length > 0 && !b.warPlan,
  };
}

/** The money gauge follows the numbers; `key` says why when it moves. */
function syncMoney(gw: GreatWar, n: GwNationState, key: string): void {
  const was = n.gauges.money;
  const now = moneyWord(basisOf(gw, n));
  if (now === was) return;
  n.gauges.money = now;
  for (const seat of seatsOf(gw, n.tag)) {
    seat.lines.push({
      gauge: "money",
      key,
      delta: now - was,
      chapter: gw.s.chapter,
    });
  }
}

/**
 * A scene or a strain moves the money gauge: a step of the treasury, at today's
 * prices. What the treasury hasn't got is printed.
 */
export function moveMoney(
  gw: GreatWar,
  n: GwNationState,
  delta: number,
  key: string,
): void {
  const b = n.budget;
  const sum = delta * moneyStep(n.tag, b.prices);
  const left = b.treasury + sum;
  note(n, "treasury", "scenes", Math.max(left, 0) - b.treasury);
  b.treasury = Math.max(0, left);
  if (left < 0) {
    const up = printedPrices(n.tag, -left);
    b.prices = Math.min(GW_PRICES_MAX, b.prices + up);
    note(n, "prices", "shortfall", up);
  }
  syncMoney(gw, n, key);
}

/** Text a seat is shown: `budget_<how>` in the why-log. */
export function tellSeats(gw: GreatWar, n: GwNationState, key: string): void {
  for (const seat of seatsOf(gw, n.tag)) reason(gw, seat, key);
}

/** What borrowing this year ties the country to. */
function bindLenders(gw: GreatWar, n: GwNationState, plan: GwBudgetPlan): void {
  const asked = plan.mix[2];
  if (asked === 0) return;
  for (const l of budgetRow(n.tag).lenders) {
    if (!lenderOpen(gw, n, l)) continue;
    const bind = l.bind;
    if (bind.kind === "america") {
      const usa = gw.nation("USA");
      if (usa !== null && usa.side === null) {
        const up = Math.floor((asked * bind.per10) / 10);
        usa.readiness = clampTo(usa.readiness + up, 0, 100);
      }
    } else if (bind.kind === "inst") {
      shiftInst(n, bind.inst, asked >= 10 ? 1 : 0);
    } else if (bind.pct > 0) {
      // Gold goes to the lender's vaults as security.
      const gold = Math.floor((n.budget.treasury * bind.pct) / 100);
      n.budget.treasury -= gold;
      note(n, "treasury", "gold", -gold);
    }
  }
}

/** What a signature does at once: the bodies and the allies read the bill. */
function signEffects(
  gw: GreatWar,
  n: GwNationState,
  plan: GwBudgetPlan,
  war: boolean,
): void {
  const row = budgetRow(n.tag);
  const body = bodyOf(gw, n);
  const national = GW_BUDGET_LINES.indexOf("national");
  const off = plan.shares[national] - budgetNorm(n.tag, war)[national];
  if (off >= 3 || off <= -3) {
    const d = off > 0 ? 1 : -1;
    if (row.national.inst !== undefined) shiftInst(n, row.national.inst, d);
    for (const t of row.national.trust ?? []) {
      const ally = gw.nation(t);
      if (ally?.side === n.side && ally !== null) {
        ally.trust[n.tag] = clampTo((ally.trust[n.tag] ?? 0) + d, -3, 3);
      }
    }
  }
  if (body !== null) {
    const tax = plan.mix[0];
    if (tax >= 170) shiftInst(n, body.inst, -2);
    else if (tax >= 130 && tax > row.warTax) shiftInst(n, body.inst, -1);
    if (loadOf(basisOf(gw, n)) >= GW_LOAD_CRUSHING) shiftInst(n, body.inst, -1);
  }
  bindLenders(gw, n, plan);
  lineOwners(gw, n, plan, war);
  whoPays(gw, n, plan);
}

/** ww209: how far a line of the plan stands off the country's norm. */
export function lineOff(
  n: GwNationState,
  plan: GwBudgetPlan,
  line: (typeof GW_BUDGET_LINES)[number],
  war: boolean = n.atWar.length > 0,
): number {
  const i = GW_BUDGET_LINES.indexOf(line);
  return plan.shares[i] - budgetNorm(n.tag, war)[i];
}

/** ww209: the running plan's line off the norm (Home, Economy read it). */
export const runningOff = (
  n: GwNationState,
  line: (typeof GW_BUDGET_LINES)[number],
): number => lineOff(n, n.budget.plan, line);

/** ww209: a line's political owner gains or loses by the plan (§1, 5B). */
function moveOwner(
  gw: GreatWar,
  n: GwNationState,
  owner: GwLineOwner,
  d: number,
): void {
  if (owner.inst !== undefined) shiftInst(n, owner.inst, d);
  for (const seat of seatsOf(gw, n.tag)) {
    const ctx = { gw, seat, cast: {} };
    if (owner.faction !== undefined) {
      societyDo(ctx, { do: "faction_trust", id: owner.faction, delta: d });
    }
    if (owner.community !== undefined) {
      societyDo(ctx, { do: "community_trust", id: owner.community, delta: d });
    }
    const man =
      owner.office === undefined ? null : officeHolder(gw, seat, owner.office);
    if (man !== null) trustBy(man, d);
  }
}

/**
 * ww209 (§1): each line far enough off the norm moves its owner; the army
 * line its weight too; a navy with no repair moves the fleet's mood.
 */
function lineOwners(
  gw: GreatWar,
  n: GwNationState,
  plan: GwBudgetPlan,
  war: boolean,
): void {
  const row = moneyRowOf(gwContent().money, n.tag);
  for (const line of GW_BUDGET_LINES) {
    const off = lineOff(n, plan, line, war);
    const at = line === "army" ? GW_ARMY_OFF : GW_OWNER_OFF;
    if (Math.abs(off) < at) continue;
    const d = off > 0 ? 1 : -1;
    if (line === "army") shiftInst(n, "army", d);
    const owner = row?.owners?.[line];
    if (owner !== undefined) moveOwner(gw, n, owner, d);
  }
  const fleet = row?.fleet;
  const navy = lineOff(n, plan, "navy", war);
  if (fleet === undefined || budgetRow(n.tag).navy !== null) return;
  const scene =
    navy <= -GW_OWNER_OFF
      ? fleet.low
      : navy >= GW_OWNER_OFF
        ? fleet.high
        : null;
  if (scene === undefined || scene === null || !known(scene)) return;
  for (const seat of seatsOf(gw, n.tag)) {
    if (seat.scheduled.some((q) => q.scene === scene)) continue;
    seat.scheduled.push({ scene, chapter: gw.s.chapter + 1 });
  }
}

/** Prices past this (per mille) cost the workers a step of trust a year. */
const PRICES_WORKERS = 1500;

/**
 * ww209 (§1): who pays. The tax kind moves the factions and communities its
 * purse touches and the class axis a notch; dear bread (printing, prices)
 * costs the workers; an earmark pays its community.
 */
function whoPays(gw: GreatWar, n: GwNationState, plan: GwBudgetPlan): void {
  const tax = plan.tax ?? "consumption";
  const raised = plan.mix[0] > 100;
  // A country nobody plays keeps its axes: its budgets are the plain rule.
  if (seatsOf(gw, n.tag).length === 0) return;
  if (raised) moveAxis(n, "class", GW_TAX_AXIS[tax]);
  const content = gwContent();
  for (const seat of seatsOf(gw, n.tag)) {
    const ctx = { gw, seat, cast: {} };
    for (const c of content.society?.communities ?? []) {
      if (c.tag !== n.tag || c.ideal.axis !== "class") continue;
      const side = c.ideal.side > 0 ? "1" : "-1";
      const want = raised
        ? (GW_PURSE_IDEALS.class?.[side].taxes?.[tax] ?? 0)
        : 0;
      const dear = c.ideal.side > 0 && n.budget.prices > PRICES_WORKERS;
      const d = want - (dear ? 1 : 0);
      if (d !== 0)
        societyDo(ctx, { do: "community_trust", id: c.id, delta: d });
    }
    for (const id of plan.marks ?? []) {
      const mark = content.money?.earmarks.find((e) => e.id === id);
      if (mark?.community !== undefined) {
        societyDo(ctx, { do: "community_trust", id: mark.community, delta: 1 });
      }
      if (mark?.faction !== undefined) {
        societyDo(ctx, { do: "support", id: mark.faction, delta: 1 });
      }
    }
  }
}

export function adopt(
  gw: GreatWar,
  n: GwNationState,
  plan: GwBudgetPlan,
  how: GwBudgetHow,
): void {
  const b = n.budget;
  const war = n.atWar.length > 0;
  b.plan = {
    shares: [...plan.shares],
    mix: [...plan.mix],
    ...(plan.tax === undefined ? {} : { tax: plan.tax }),
    ...(plan.marks === undefined ? {} : { marks: [...plan.marks] }),
  };
  b.warPlan = b.warPlan || war;
  closeMeeting(gw, n, how);
  signEffects(gw, n, b.plan, war);
  b.notes = [];
  // ww190: by decree nothing "passed": the line says how it went out.
  const decreed =
    (how === "signed" || how === "proxy") &&
    bodyOf(gw, n) === null &&
    GW_BUDGET_DECREE.some((d) => flagsOf(gw, n).includes(d.flag));
  tellSeats(gw, n, decreed ? "budget_by_decree" : `budget_${how}`);
  spendDecree(gw, n);
}

export function closeMeeting(
  gw: GreatWar,
  n: GwNationState,
  how: GwBudgetHow,
): void {
  const b = n.budget;
  b.draft = null;
  b.meeting = null;
  b.refused = false;
  b.put = null;
  b.tries = 0;
  b.last = how;
  // ww209: the budget's bill leaves its pinned place, however it closed.
  const bill = n.laws.find((x) => x.id === moneyIds.budget(n.tag as GwTag));
  if (bill !== undefined && bill.stage !== "force") bill.stage = "idle";
  b.lastChapter = gw.s.chapter;
}

function voteOn(gw: GreatWar, n: GwNationState, plan: GwBudgetPlan) {
  return budgetVote(bodyOf(gw, n), n.inst, basisOf(gw, n), plan);
}

/** The bill goes up: passed, signed alone, or turned down. */
export function submitBudget(
  gw: GreatWar,
  n: GwNationState,
  plan: GwBudgetPlan,
  how: GwBudgetHow = "signed",
): "passed" | "refused" | "waits" {
  if (houseShut(gw, n)) {
    tellSeats(gw, n, "budget_waits");
    return "waits";
  }
  const body = bodyOf(gw, n);
  const vote: GwBudgetVote = voteOn(gw, n, plan);
  if (vote.pass) {
    adopt(gw, n, plan, how);
    return "passed";
  }
  if (body?.kind === "alone") {
    shiftInst(n, body.inst, -body.fallout);
    n.authority = clampTo(n.authority - body.forcePrice, 0, 100);
    adopt(gw, n, plan, "alone");
    return "passed";
  }
  n.budget.refused = true;
  tellSeats(gw, n, "budget_refused");
  return "refused";
}

function forceBudget(
  gw: GreatWar,
  n: GwNationState,
  plan: GwBudgetPlan,
  body: GwBudgetBody,
): void {
  n.authority = clampTo(n.authority - body.forcePrice, 0, 100);
  shiftInst(n, body.inst, -body.fallout);
  if (body.second !== undefined) shiftInst(n, body.second.inst, -1);
  adopt(gw, n, plan, "forced");
}

/** The order from the budget panel. */
export function budgetOrder(
  gw: GreatWar,
  seat: GwSeatState,
  plan: GwBudgetPlan,
  force: boolean,
): GwOrderBlock | null {
  const n = gw.nation(seat.tag);
  if (n === null || n.budget.meeting === null) return "no_meeting";
  if (!budgetValid(plan)) return "bad_budget";
  const body = bodyOf(gw, n);
  if (force && body !== null) {
    if (n.authority < body.forcePrice) return "no_authority";
    forceBudget(gw, n, plan, body);
  } else if (submitBudget(gw, n, plan) !== "passed") {
    return null;
  }
  seat.desk = seat.desk.filter((c) => !MEETING.test(c.scene));
  return null;
}

/** The year the writers gave a country's first war budget. */
const GW_FIRST_WAR_YEAR = 1914;

/** A meeting's scene for this country; a country with none writes the common. */
function meetingScene(n: GwNationState, year: number, war: boolean): string {
  const own = `gw_bm_${n.tag.toLowerCase()}_${war ? year : "peace"}`;
  return known(own) ? own : "gw_bm_common";
}

/**
 * ww190: in the peace years a new year's draft keeps the arms the running
 * plan was raised to (PeaceYears' `arms`), not the June 1914 shares: an arms
 * race lasts until a budget turns it down.
 */
function keepArms(
  n: GwNationState,
  war: boolean,
  draft: GwBudgetPlan,
): GwBudgetPlan {
  if (war || n.budget.warPlan) return draft;
  let shares = draft.shares;
  for (const line of ["army", "navy"] as const) {
    const i = GW_BUDGET_LINES.indexOf(line);
    const d = n.budget.plan.shares[i] - shares[i];
    if (d > 0) shares = tilted(shares, line, d);
  }
  return { shares, mix: draft.mix };
}

function openMeeting(gw: GreatWar, n: GwNationState, year: number): void {
  const s = gw.s;
  const b = n.budget;
  const basis = basisOf(gw, n);
  const draft = keepArms(n, basis.war, budgetDraft(basis, n.gauges));
  const seats = seatsOf(gw, n.tag);
  if (seats.length === 0) {
    aiBudget(gw, n, draft);
    return;
  }
  const keep = b.plan;
  b.draft = {
    ...draft,
    ...(keep.tax === undefined ? {} : { tax: keep.tax }),
    ...(keep.marks === undefined ? {} : { marks: [...keep.marks] }),
  };
  // ww209: a budget voted as a bill has GW_MONEY_DEADLINE chapters past its
  // meeting to pass (MoneyBills).
  b.meeting = s.chapter + 1 + (moneyVoted(gw, n) ? GW_MONEY_DEADLINE : 0);
  b.refused = false;
  b.put = null;
  b.tries = 0;
  b.year = year;
  if (b.voted !== undefined) delete b.voted.budget;
  // A war that starts late still has its first budget, not the second year's.
  const outbreak = s.warChapter !== null && s.chapter - s.warChapter <= 1;
  const scene = meetingScene(n, outbreak ? GW_FIRST_WAR_YEAR : year, basis.war);
  for (const seat of seats) {
    if (!known(scene)) continue;
    seat.scheduled.push({ scene, chapter: s.chapter + 1 });
  }
}

/** The same rule with plain thresholds: the draft, forced if it can afford it. */
function aiBudget(gw: GreatWar, n: GwNationState, draft: GwBudgetPlan): void {
  if (submitBudget(gw, n, draft) === "passed") return;
  const body = bodyOf(gw, n);
  if (body !== null && n.authority >= body.forcePrice + 20) {
    forceBudget(gw, n, draft, body);
    return;
  }
  closeMeeting(gw, n, "refused");
}

/** Past its chapter a meeting closes: proxy for the draft, or last year's. */
function closeDue(gw: GreatWar, n: GwNationState): void {
  const b = n.budget;
  if (b.meeting === null || b.meeting > gw.s.chapter) return;
  // ww209: a budget voted as a bill meets its deadline in MoneyBills.
  if (moneyVoted(gw, n)) return;
  if (b.refused || b.draft === null) {
    closeMeeting(gw, n, "refused");
    tellSeats(gw, n, "budget_runs_on");
    return;
  }
  const vote = submitBudget(gw, n, b.draft, "proxy");
  if (vote === "waits" && seatsOf(gw, n.tag).some((x) => dissolvedNow(gw, x))) {
    // The house comes back with its election: the meeting waits for it.
    b.meeting = gw.s.chapter + 1;
    return;
  }
  if (vote !== "passed") {
    closeMeeting(gw, n, "refused");
    tellSeats(gw, n, "budget_runs_on");
  }
}

/** A card the timer signed for the seat is stamped as a proxy here too. */
function stampProxy(gw: GreatWar, n: GwNationState): void {
  const c = gw.s.chapter;
  const proxied = seatsOf(gw, n.tag).some((seat) =>
    seat.choices.some(
      (x) => x.chapter === c && x.proxy && MEETING.test(x.scene),
    ),
  );
  if (proxied && n.budget.lastChapter === c && n.budget.last === "signed") {
    n.budget.last = "proxy";
  }
}

function applyDrift(
  gw: GreatWar,
  n: GwNationState,
  d: GwBudgetDrift,
  why: string,
) {
  const b = n.budget;
  while (Math.abs(b.drift[d]) >= GW_DRIFT_STEP) {
    const dir = b.drift[d] > 0 ? 1 : -1;
    b.drift[d] -= dir * GW_DRIFT_STEP;
    if (d === "sea") seaRepair(gw, n, dir);
    else moveGauge(gw, n.tag, d, dir, why === "" ? "budget_works" : why);
  }
  // Nothing piles up against a gauge at its end.
  if (d !== "sea") {
    const v = n.gauges[d];
    if (v === GW_GAUGE_MAX[d] && b.drift[d] > 0) b.drift[d] = 0;
    if (v === 0 && b.drift[d] < 0) b.drift[d] = 0;
  }
}

/** The navy line: Britain's ships built, or Germany's way out kept open. */
function seaRepair(gw: GreatWar, n: GwNationState, dir: number): void {
  const s = gw.s;
  const navy = budgetRow(n.tag).navy;
  if (navy === "shipping") {
    s.shipping = clampTo(s.shipping - dir, 0, GW_SEA_MAX);
  } else if (navy === "blockade") {
    s.blockade = clampTo(s.blockade - dir, 0, GW_SEA_MAX);
  }
  if (navy !== null)
    tellSeats(gw, n, dir > 0 ? "budget_navy_up" : "budget_navy_down");
}

/** One chapter's slice of the year. */
function flow(gw: GreatWar, n: GwNationState): void {
  const b = n.budget;
  econCrisis(gw, n);
  const econ = econTerms(gw, n);
  const days = chapterOf(gw).spanDays;
  const basis = basisOf(gw, n);
  // ww209: credits refused: no bonds and no loans this period; the gap is
  // printed by the bank (the shortfall below).
  const stopped = (b.credits?.stopTo ?? -1) > gw.s.chapter;
  const running = stopped
    ? { ...b.plan, mix: [b.plan.mix[0], 0, 0, b.plan.mix[3]] }
    : b.plan;
  const y = budgetYear(basis, running);
  const part = (v: number) => Math.trunc((v * days) / 360);
  const taxes = part(y.taxes);
  const bonds = part(y.bonds);
  const loans = part(y.loans);
  const print = part(y.print);
  const out = part(y.outlay);
  const interest = part(y.interest);
  note(n, "treasury", "taxes", taxes);
  note(n, "treasury", "bonds", bonds);
  note(n, "treasury", "loans", loans);
  note(n, "treasury", "print", print);
  note(n, "treasury", "outlay", -out);
  note(n, "treasury", "interest", -interest);
  note(n, "debt", "bonds", bonds);
  note(n, "debt", "loans", loans);
  const left = b.treasury + taxes + bonds + loans + print - out - interest;
  b.treasury = Math.max(0, left);
  b.debt += bonds + loans;
  if (loans > 0) lend(gw, n, loans);
  const shortfall = Math.max(0, -left);
  if (shortfall > 0) tellSeats(gw, n, "budget_shortfall");
  note(n, "treasury", "shortfall", shortfall);
  const fromPrint = printedPrices(n.tag, print);
  const fromShort = printedPrices(n.tag, shortfall);
  const fromWar = basis.war
    ? part(Math.trunc((b.prices * budgetRow(n.tag).warPrices) / 1000))
    : 0;
  b.prices = Math.min(
    GW_PRICES_MAX,
    b.prices + fromPrint + fromShort + fromWar,
  );
  note(n, "prices", "print", fromPrint);
  note(n, "prices", "shortfall", fromShort);
  note(n, "prices", "war", fromWar);
  // ww201: the production step's money goes into the treasury.
  const step = moneyStep(n.tag, b.prices);
  const made = Math.trunc((sumOf(econ.money) * step * days) / 36000);
  const kept = b.treasury;
  b.treasury = Math.max(0, kept + made);
  note(n, "treasury", "econ", b.treasury - kept);
  for (const d of GW_BUDGET_DRIFTS) {
    const g = d === "shells" || d === "bread" ? d : null;
    const terms = g === null ? [] : econ[g];
    const net = y.drift[d] + sumOf(terms);
    const why =
      g === null
        ? y.why[d]
        : whyOf(terms, net, [y.why[d] || "budget_works", y.drift[d]]);
    b.drift[d] += net * days;
    const was = g === null ? 0 : n.gauges[g];
    applyDrift(gw, n, d, why);
    if (g !== null) {
      const key = why === "" ? "budget_works" : why;
      econRecord(gw, n, g, net, why, n.gauges[g] - was, key);
    }
  }
  const balance = Math.trunc((y.balance * 100) / step);
  const net = balance + sumOf(econ.money);
  const budgetKey = y.balance < 0 ? "money_war_costs" : "money_budget_up";
  const why = whyOf(econ.money, net, [budgetKey, balance]);
  const was = n.gauges.money;
  const key = why === "" ? budgetKey : why;
  syncMoney(gw, n, key);
  econRecord(gw, n, "money", net, why, n.gauges.money - was, key);
}

/** Shares what was borrowed among the open lenders, by what each will give. */
function lend(gw: GreatWar, n: GwNationState, sum: number): void {
  const open = lenders(gw, n).filter((l) => l.cap > 0);
  const all = open.reduce((a, l) => a + l.cap, 0);
  for (const l of open) {
    const share = Math.trunc((sum * l.cap) / Math.max(1, all));
    n.budget.lent[l.id] = (n.budget.lent[l.id] ?? 0) + share;
  }
}

/** A lender owed enough comes to say what it wants for it. */
function lenderDemands(gw: GreatWar, n: GwNationState): void {
  const b = n.budget;
  const row = budgetRow(n.tag);
  for (const l of row.lenders) {
    const owed = b.lent[l.id] ?? 0;
    const times = b.asked[l.id] ?? 0;
    const bar = Math.trunc((row.revenue * l.demandAt * (times + 1)) / 100);
    if (owed < bar) continue;
    b.asked[l.id] = times + 1;
    const scene = `gw_bl_${n.tag.toLowerCase()}`;
    if (!known(scene)) continue;
    for (const seat of seatsOf(gw, n.tag)) {
      seat.scheduled.push({ scene, chapter: gw.s.chapter + 1 });
    }
  }
}

/** Debt past carrying, or an empty treasury and worthless paper. */
function crisisDue(gw: GreatWar, n: GwNationState): boolean {
  const b = n.budget;
  if (gw.s.chapter - b.crisis < CRISIS_GAP) return false;
  const broke = b.treasury === 0 && b.prices >= GW_PRICES_CRISIS;
  return broke || loadOf(basisOf(gw, n)) >= GW_LOAD_CRUSHING;
}

function bankruptcy(gw: GreatWar, n: GwNationState): void {
  const b = n.budget;
  b.crisis = gw.s.chapter;
  const seats = seatsOf(gw, n.tag);
  // Nobody to ask, or a regent who answers nothing: the plain way, interest
  // halved and the market shut.
  if (!ruledBySeat(gw, n.tag)) {
    b.rate = 50;
    b.shutUntil = gw.s.chapter + 12;
    moveGauge(gw, n.tag, "order", -1, "order_prices");
    return;
  }
  const own = `gw_bc_${n.tag.toLowerCase()}`;
  const scene = known(own) ? own : "gw_bc_common";
  if (!known(scene)) return;
  for (const seat of seats) {
    seat.scheduled.push({ scene, chapter: gw.s.chapter + 1 });
  }
}

function yearlyDue(gw: GreatWar): number | null {
  const s = gw.s;
  const next = gwChapters(s.calendar)[s.chapter + 1];
  return next?.budget ?? null;
}

function openMeetings(gw: GreatWar): void {
  const s = gw.s;
  const chapters = gwChapters(s.calendar);
  const next = chapters[s.chapter + 1];
  if (next === undefined || next.stage === "closing") return;
  if (s.armistice !== null || s.conferenceLeft > 0) return;
  const year = yearlyDue(gw);
  const nextYear = civilFromDays(next.day).year;
  for (const n of s.nations) {
    if (n.out || n.budget.meeting !== null) continue;
    const b = n.budget;
    const outbreak =
      fights(n) &&
      !b.outbreak &&
      n.entered !== null &&
      n.entered >= s.chapter - 1;
    if (outbreak) {
      b.outbreak = true;
      openMeeting(gw, n, nextYear);
    } else if (year !== null && s.chapter - b.lastChapter > 1) {
      openMeeting(gw, n, year);
    }
  }
}

/** Chapter step, before the home front. */
export function budgetStep(gw: GreatWar): void {
  for (const n of gw.s.nations) {
    if (n.out) continue;
    stampProxy(gw, n);
    closeDue(gw, n);
    flow(gw, n);
    lenderDemands(gw, n);
    if (crisisDue(gw, n)) bankruptcy(gw, n);
  }
  openMeetings(gw);
}

function bodyView(gw: GreatWar, n: GwNationState): GwBudgetView["body"] {
  const body = bodyOf(gw, n);
  if (body === null) return null;
  return {
    kind: body.kind,
    inst: body.inst,
    need: body.need,
    second: body.second?.inst ?? null,
    secondNeed: body.second?.need ?? 0,
    value: n.inst[body.inst] ?? 0,
    secondValue:
      body.second === undefined ? 0 : (n.inst[body.second.inst] ?? 0),
    forcePrice: body.forcePrice,
  };
}

function nextMeeting(gw: GreatWar): string | null {
  const s = gw.s;
  const c = gwChapters(s.calendar).find(
    (x) => x.index > s.chapter && x.budget !== null,
  );
  return c === undefined
    ? null
    : formatIsoDate(civilFromDays(c.day + s.dayShift));
}

/** ww190: the house is shut: till its election, or sent home with no date. */
function shutView(
  gw: GreatWar,
  n: GwNationState,
  seat: GwSeatState,
): GwBudgetView["shut"] {
  if (dissolvedNow(gw, seat)) {
    const day = seat.dissolved! + GW_ELECTION_DAYS;
    return { until: formatIsoDate(civilFromDays(day)) };
  }
  return shutByDecree(gw, n) ? { until: null } : null;
}

/** What the seat reads: all of it its own country's and all of it true. */
export function budgetView(gw: GreatWar, seat: GwSeatState): GwBudgetView {
  const n = gw.nation(seat.tag)!;
  const b = n.budget;
  const basis = basisOf(gw, n);
  return {
    basis,
    plan: b.plan,
    draft: b.draft,
    norm: budgetNorm(n.tag, basis.war),
    meeting: b.meeting !== null,
    refused: b.refused,
    last: b.last,
    next: nextMeeting(gw),
    notes: b.notes,
    lenders: lenders(gw, n),
    body: bodyView(gw, n),
    authority: n.authority,
    holder: officeHolder(gw, seat, "finance")?.id ?? null,
    shut: shutView(gw, n, seat),
  };
}

/** What a scene's signature signs: the draft, or last year's. */
export function draftOf(n: GwNationState): GwBudgetPlan {
  return n.budget.draft ?? n.budget.plan;
}

/** A scene's sum: treasury in percent of a year's revenue, the rest of itself. */
export function budgetItem(
  gw: GreatWar,
  n: GwNationState,
  item: GwBudgetItem,
  pct: number,
): void {
  const b = n.budget;
  if (item === "treasury") {
    const sum = Math.trunc(
      (budgetRow(n.tag).revenue * b.prices * pct) / 100000,
    );
    b.treasury = Math.max(0, b.treasury + sum);
    note(n, "treasury", "scenes", sum);
  } else {
    const sum = Math.trunc((b[item] * pct) / 100);
    b[item] = Math.max(item === "prices" ? 1000 : 0, b[item] + sum);
    note(n, item, "scenes", sum);
  }
  syncMoney(gw, n, "money_budget_up");
}

/** The draft asks `delta` more of a source, inside what the rule allows. */
export function budgetRaise(
  plan: GwBudgetPlan,
  source: GwBudgetSource,
  delta: number,
): void {
  const i = GW_BUDGET_SOURCES.indexOf(source);
  const lo = i === 0 ? GW_TAX_MIN : 0;
  const hi = i === 0 ? GW_TAX_MAX : GW_RAISE_MAX;
  plan.mix[i] = clampTo(plan.mix[i] + delta, lo, hi);
}

/** The `budget` condition: see its words in WorldDsl. */
export function budgetFact(
  gw: GreatWar,
  n: GwNationState,
  what: "treasury" | "load" | "prices" | "lent",
): number {
  const b = n.budget;
  switch (what) {
    case "treasury":
      return Math.trunc(b.treasury / moneyStep(n.tag, b.prices));
    case "load":
      return loadOf(basisOf(gw, n));
    case "prices":
      return Math.trunc(b.prices / 10);
    case "lent": {
      const owed = Object.values(b.lent).reduce((a, v) => a + v, 0);
      return Math.trunc((owed * 100) / budgetRow(n.tag).revenue);
    }
  }
}
