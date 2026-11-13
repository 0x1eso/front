// Great War 1914 (ww209/ww210, lane S1): the money bills. The yearly budget
// and the war credits as special articles with their own pinned place on the
// agenda, counted by faction from each one's purse, voted with the full vote
// scene, and each country's rule when they fail (design §2). The money
// itself still runs in Budget.ts. See /home/eser/dev/ww209-format.md.
//
// - A money bill has no GW_LAWS row: its law row and its house row are made
//   here from the country's money row (`moneyLawRow`, `moneyBillRow`), so the
//   house counts, lobbies and votes it as any bill (House.ts, Laws.ts).
// - The budget: the meeting opens as before; the seat puts its plan
//   (`budget_put`) or the meeting card puts the draft; it must pass within
//   GW_MONEY_DEADLINE chapters of the meeting. Lost, it goes back to the
//   lobby once; lost again, or at the deadline, the country's rule runs.
// - The credits: on each country's rhythm while at war; voted (a bill), by
//   command (RUS: granted; the seat may put them to the Duma), or by decree
//   (AUH §14 while the Reichsrat is shut). Refused: no borrowing until the
//   next credits, the gap printed (Budget.flow).
// - Each faction's side is its purse: its ideals (MoneyRows GW_PURSE_IDEALS)
//   over its `purse` rows, against the plan. Its wing may defy the line
//   openly (beat `defy`), which builds split pressure (Society's split check).
import {
  GW_INST_MAX,
  GW_INST_MIN,
  type GwNationState,
  type GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GW_BUDGET_LINES,
  GW_MONEY_DEADLINE,
  GW_MONEY_TRIES,
  GW_TAX_KINDS,
  type GwBudgetLine,
  type GwBudgetPlan,
  type GwBudgetView,
  type GwCreditsBy,
  type GwMoneyBill,
  type GwTaxKind,
} from "@openfront/engine-api/ww1914/GwBudget";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwVoteBand } from "@openfront/engine-api/ww1914/GwHouse";
import {
  gwLawStart,
  type GwBookView,
  type GwLawState,
} from "@openfront/engine-api/ww1914/GwLaw";
import type { GwOrderBlock } from "@openfront/engine-api/ww1914/GwOrders";
import type {
  GwAxis,
  GwIdeals,
  GwSocietyView,
} from "@openfront/engine-api/ww1914/GwSociety";
import type { GwCond } from "@openfront/engine-api/ww1914/SceneDsl";
import type {
  GwWorldCond,
  GwWorldEffect,
} from "@openfront/engine-api/ww1914/WorldDsl";
import {
  budgetValid,
  budgetVote,
  GW_LOAD_HEAVY,
  loadOf,
} from "@openfront/engine-lib/ww1914/BudgetRules";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import {
  GW_LOST_NARROW,
  GW_LOST_WIDE,
  type GwBillRow,
  type GwPurseRow,
  type GwSide,
} from "@openfront/engine-lib/ww1914/HouseRows";
import type { GwLawRow } from "@openfront/engine-lib/ww1914/LawRows";
import {
  GW_DEFY_TENTHS,
  GW_PURSE_IDEALS,
  GW_PURSE_OFF,
  moneyBillOf,
  moneyIds,
  moneyRowOf,
  type GwCreditsRow,
  type GwMoneyRow,
} from "@openfront/engine-lib/ww1914/MoneyRows";
import { civilFromDays } from "@openfront/engine-lib/ww1936/Calendar";
import type { BallotApart } from "./Ballot";
import {
  adopt,
  basisOf,
  budgetBodyOf,
  budgetOrder,
  closeMeeting,
  draftOf,
  lineOff,
  moneyRuns,
  moneyVoted,
  tellSeats,
} from "./Budget";
import { giveCount } from "./Departments";
import type { GreatWar } from "./GreatWar";
import {
  chambersOf,
  factionOf,
  factionRow,
  factionRows,
  houseFall,
  houseOpened,
  houseRow,
  seatsNow,
} from "./House";
import { agendaView, fallBy, lawCall, lawStage, moneyAgenda } from "./Laws";
import { officeHolder } from "./People";
import { heatThreat } from "./Powers";
import { moveOpinion } from "./Press";
import { holds, type SceneCtx } from "./SceneRun";
import { factionTrust as trustNow } from "./Society";
import { factionTrust, idealsOf } from "./Utopia";
import { clampTo, reason, seatsOf } from "./World";

export type MoneyCond = Extract<
  GwWorldCond,
  { is: "money" | "tax_kind" | "earmark" | "defy" | "split_pressure" }
>;
export type MoneyEffect = Extract<
  GwWorldEffect,
  { do: "earmark" | "split_pressure" }
>;

/** The meeting's card: gone once the budget is put. */
const MEETING = /^gw_bm_/;
const MOVING: readonly GwLawState["stage"][] = [
  "draft",
  "persuade",
  "vote",
  "sign",
];
const ALWAYS: GwCond = { kind: "all", of: [] };
/** The first credits' rally in the chamber's score, as the old first budget. */
const RALLY = 3;

const sign = (v: number): GwSide => (v > 0 ? 1 : v < 0 ? -1 : 0);
const ctxOf = (gw: GreatWar, seat: GwSeatState): SceneCtx => ({
  gw,
  seat,
  cast: {},
});

// ---- Rows ----

export const isMoneyBill = (law: string): boolean => moneyBillOf(law) !== null;

export function moneyRow(tag: string): GwMoneyRow | null {
  return moneyRowOf(gwContent().money, tag);
}

/** A money bill's law row, made from its country's money row. */
export function moneyLawRow(id: string): GwLawRow | null {
  const m = moneyBillOf(id);
  const row = m === null ? null : moneyRow(m.tag);
  if (m === null || row === null) return null;
  return {
    id,
    tag: row.tag,
    chapter: "war_finance",
    opens: ALWAYS,
    lean: 0,
    decree: row.round?.around !== undefined,
    cast: {},
    draft: [{ id: m.kind, tell: [], effects: [], support: 0 }],
    passed: [],
    passedTell: [],
    term: [],
    repeal: { authority: 0, tell: [], effects: [] },
    talk: { who: { office: "finance" }, start: "", nodes: {} },
  };
}

/** A money bill's house row: its chambers, money (no Lords), its way round. */
export function moneyBillRow(seat: GwSeatState, law: string): GwBillRow | null {
  const m = moneyBillOf(law);
  if (m === null || m.tag !== seat.tag) return null;
  const row = moneyRow(m.tag);
  const house = houseRow(seat.tag);
  if (row === null || house === null) return null;
  const around = row.round?.around;
  return {
    law,
    stance: {},
    houses: row.houses.filter((c) => house.chambers.some((x) => x.id === c)),
    money: true,
    around: around !== undefined && house.around?.id === around,
  };
}

/** The credits' rhythm in force now: the first row that holds. */
function creditsRow(gw: GreatWar, seat: GwSeatState): GwCreditsRow | null {
  const row = moneyRow(seat.tag);
  const ctx = ctxOf(gw, seat);
  return (
    row?.credits.find((c) => c.when === undefined || holds(ctx, c.when)) ?? null
  );
}

// ---- The purse ----

interface Wants {
  lines: Partial<Record<GwBudgetLine, number>>;
  taxes: Partial<Record<GwTaxKind, number>>;
}

/** What ideals want of a budget, the purse row's own words over them. */
function wantsOf(ideals: GwIdeals, purse: GwPurseRow | null): Wants {
  const lines: Wants["lines"] = {};
  const taxes: Wants["taxes"] = {};
  for (const [axis, side] of Object.entries(ideals) as [GwAxis, number][]) {
    if (side === 0 || side === undefined) continue;
    const e = GW_PURSE_IDEALS[axis]?.[side > 0 ? "1" : "-1"];
    for (const [l, w] of Object.entries(e?.lines ?? {})) {
      const k = l as GwBudgetLine;
      lines[k] = (lines[k] ?? 0) + (w ?? 0);
    }
    for (const [t, w] of Object.entries(e?.taxes ?? {})) {
      const k = t as GwTaxKind;
      taxes[k] = (taxes[k] ?? 0) + (w ?? 0);
    }
  }
  for (const k of Object.keys(lines) as GwBudgetLine[]) {
    lines[k] = sign(lines[k] ?? 0);
  }
  for (const k of Object.keys(taxes) as GwTaxKind[]) {
    taxes[k] = sign(taxes[k] ?? 0);
  }
  return {
    lines: { ...lines, ...(purse?.lines ?? {}) },
    taxes: { ...taxes, ...(purse?.taxes ?? {}) },
  };
}

/** The faction's purse row in force for this bill: the first that holds. */
function purseRowOf(
  ctx: SceneCtx,
  id: string,
  kind: GwMoneyBill,
): GwPurseRow | null {
  const rows = factionRow(id)?.purse ?? [];
  return (
    rows.find(
      (p) =>
        (p.bill === undefined || p.bill === kind) &&
        (p.when === undefined || holds(ctx, p.when)),
    ) ?? null
  );
}

/** The plan the budget bill stands for: put, else drafted, else running. */
function planOf(n: GwNationState): GwBudgetPlan {
  return n.budget.put ?? draftOf(n);
}

/** The first credits, or the first war budget: the country rallies. */
function rallied(
  n: GwNationState,
  m: { kind: GwMoneyBill; n: number },
): boolean {
  if (m.kind === "credits") return m.n <= 1;
  return n.atWar.length > 0 && !n.budget.warPlan;
}

/**
 * What the bill does for what the purse wants: each line it minds off the
 * norm by GW_PURSE_OFF or more, the tax kind if taxes rise, its earmarks.
 * The credits: the army line's want (borrowing for the war).
 */
function purseScore(
  n: GwNationState,
  m: { kind: GwMoneyBill; n: number },
  w: Wants,
  faction: string | null,
): number {
  if (m.kind === "credits") return w.lines.army ?? 0;
  const plan = planOf(n);
  let score = 0;
  for (const line of GW_BUDGET_LINES) {
    const off = lineOff(n, plan, line);
    if (Math.abs(off) >= GW_PURSE_OFF) {
      score += (w.lines[line] ?? 0) * sign(off);
    }
  }
  if (plan.mix[0] > 100) score += w.taxes[plan.tax ?? "consumption"] ?? 0;
  if (faction !== null) {
    for (const id of plan.marks ?? []) {
      const mark = gwContent().money?.earmarks.find((e) => e.id === id);
      if (mark?.faction === faction) score++;
    }
  }
  return score;
}

/** A faction's trust in the seat leans its purse: ±1 at ±2 or past. */
function trustLean(seat: GwSeatState, id: string): number {
  const f = factionOf(seat, id);
  if (f === null) return 0;
  const t = trustNow(f);
  return t >= 2 ? 1 : t <= -2 ? -1 : 0;
}

/** What the faction's purse wants of this bill, before its trust. */
function wantScore(
  gw: GreatWar,
  seat: GwSeatState,
  st: GwLawState,
  id: string,
): number {
  const m = moneyBillOf(st.id);
  const n = gw.nation(seat.tag);
  if (m === null || n === null) return 0;
  const purse = purseRowOf(ctxOf(gw, seat), id, m.kind);
  return purseScore(n, m, wantsOf(idealsOf(id), purse), id);
}

/** A faction's side on a money bill: its purse against the plan (§2.1). */
export function moneySide(
  gw: GreatWar,
  seat: GwSeatState,
  st: GwLawState,
  id: string,
): GwSide {
  const m = moneyBillOf(st.id);
  const n = gw.nation(seat.tag);
  if (m === null || n === null) return 0;
  const purse = purseRowOf(ctxOf(gw, seat), id, m.kind);
  if (purse?.side !== undefined) return purse.side;
  const rally = rallied(n, m) ? 1 : 0;
  return sign(trustLean(seat, id) + rally + wantScore(gw, seat, st, id));
}

/** A peel sealed on this bill (S2's ledger): the wing votes for apart. */
export function wingPeeled(
  seat: GwSeatState,
  faction: string,
  law: string,
): boolean {
  return (seat.house?.deals2 ?? []).some(
    (d) =>
      d.kind === "peel" &&
      d.faction === faction &&
      d.law === law &&
      // Met apart is not enough: his price taken (S2 sets `side`).
      d.side === 1 &&
      (d.fate === "open" || d.fate === "kept"),
  );
}

/**
 * The faction's wing voting apart in a chamber where it holds `seats`: a
 * peeled wing for, or (money bills, not the rally's) a wing whose own purse
 * is against while its party isn't, once the party is hot: GW_DEFY_TENTHS of
 * its seats by temper defy openly. `held`: a kept deal or a question of
 * confidence holds the party, wing and all.
 */
export function wingApart(
  gw: GreatWar,
  seat: GwSeatState,
  st: GwLawState,
  id: string,
  seats: number,
  side: GwSide,
  held: boolean,
): BallotApart | undefined {
  const wing = factionRow(id)?.wing;
  if (wing === undefined) return undefined;
  if (wing.when !== undefined && !holds(ctxOf(gw, seat), wing.when)) {
    return undefined;
  }
  const k = Math.floor((seats * clampTo(wing.share, 1, 9)) / 10);
  if (k <= 0) return undefined;
  if (wing.peels !== false && wingPeeled(seat, id, st.id)) {
    return { seats: k, cast: "for", beat: "swing", person: wing.person };
  }
  if (wing.defies === false || held || side < 0) return undefined;
  const m = moneyBillOf(st.id);
  const n = gw.nation(seat.tag);
  if (m === null || n === null || rallied(n, m)) return undefined;
  const tenths = GW_DEFY_TENTHS[factionOf(seat, id)?.step ?? 0] ?? 0;
  if (tenths <= 0) return undefined;
  if (purseScore(n, m, wantsOf(wing.ideals, null), null) >= 0) {
    return undefined;
  }
  // Its first defies are a few men alone, before the wing stands up.
  const lone = wing.lone?.[factionOf(seat, id)?.defied ?? 0];
  if (lone !== undefined) {
    return {
      seats: clampTo(lone.seats, 1, seats),
      cast: "against",
      beat: "defy",
      person: lone.person,
      ...(lone.with === undefined ? {} : { with: lone.with }),
    };
  }
  return {
    seats: Math.max(1, Math.floor((k * tenths) / 10)),
    cast: "against",
    beat: "defy",
    person: wing.person,
  };
}

/** The wing defied its line in a vote: counted, and split pressure. */
export function wingDefied(gw: GreatWar, seat: GwSeatState, id: string): void {
  const f = factionOf(seat, id);
  if (f === null) return;
  const wing = factionRow(id)?.wing;
  const lone = wing?.lone?.[f.defied ?? 0];
  f.defied = (f.defied ?? 0) + 1;
  // A few men alone don't split a party; the wing standing up does.
  if (lone === undefined) f.split = (f.split ?? 0) + 1;
  if (lone === undefined) reason(gw, seat, "house_defied", wing?.person);
  else reason(gw, seat, "house_defied_lone", lone.person);
}

// ---- The bills ----

function shiftInst(n: GwNationState, inst: string, delta: number): void {
  const k = inst as keyof GwNationState["inst"];
  const v = n.inst[k];
  if (v === undefined) return;
  n.inst[k] = clampTo(v + delta, GW_INST_MIN, GW_INST_MAX);
}

/** The chamber's mood on the budget: the old vote's reasons, its weight apart. */
function budgetMood(
  gw: GreatWar,
  n: GwNationState,
  plan: GwBudgetPlan,
): number {
  const body = budgetBodyOf(gw, n);
  if (body === null) return 0;
  const v = budgetVote(body, n.inst, basisOf(gw, n), plan);
  return v.score - (n.inst[body.inst] ?? 0);
}

/** The chamber's mood on credits: the rally, a crushing load, dear money. */
function creditsMood(gw: GreatWar, n: GwNationState, k: number): number {
  const basis = basisOf(gw, n);
  let mood = k <= 1 ? RALLY : 0;
  if (loadOf(basis) >= GW_LOAD_HEAVY) mood--;
  if (basis.prices >= 2000) mood--;
  return mood;
}

/** A money bill onto its pinned place: counted for free, lobbied, called. */
function openBill(
  gw: GreatWar,
  seat: GwSeatState,
  n: GwNationState,
  id: string,
  support: number,
): GwLawState {
  const m = moneyBillOf(id)!;
  let st = lawStage(n, id);
  if (st === null) {
    st = gwLawStart(id);
    n.laws.push(st);
  }
  Object.assign(st, gwLawStart(id));
  if (m.kind === "budget") delete n.budget.tilt;
  st.stage = "persuade";
  st.since = gw.s.chapter;
  st.support = support;
  st.text = m.kind;
  st.sponsor = officeHolder(gw, seat, "finance")?.id ?? null;
  houseOpened(gw, seat, id);
  // The count office counts it with no task of the seat's (§2.1 3).
  giveCount(gw, seat, id);
  reason(gw, seat, `money_put_${m.kind}`);
  return st;
}

function cleanPlan(plan: GwBudgetPlan): GwBudgetPlan {
  return {
    shares: [...plan.shares],
    mix: [...plan.mix],
    ...(plan.tax === undefined ? {} : { tax: plan.tax }),
    ...(plan.marks === undefined || plan.marks.length === 0
      ? {}
      : { marks: [...new Set(plan.marks)] }),
  };
}

/** The plan's earmarks are this country's, each giveable now. */
function marksValid(
  gw: GreatWar,
  seat: GwSeatState,
  plan: GwBudgetPlan,
): boolean {
  const ctx = ctxOf(gw, seat);
  const running = gw.nation(seat.tag)?.budget.plan.marks ?? [];
  return (plan.marks ?? []).every((id) => {
    const row = gwContent().money?.earmarks.find((e) => e.id === id);
    if (row === undefined || row.tag !== seat.tag) return false;
    // One already running stays, whatever its `when` says now.
    return (
      running.includes(id) || row.when === undefined || holds(ctx, row.when)
    );
  });
}

/** Order `budget_put`: the plan (or the credits) onto the pinned place. */
export function budgetPut(
  gw: GreatWar,
  seat: GwSeatState,
  plan: GwBudgetPlan,
  credits: boolean,
): GwOrderBlock | null {
  const n = gw.nation(seat.tag);
  if (n === null) return "no_meeting";
  if (credits) return putCredits(gw, seat, n);
  const b = n.budget;
  if (b.meeting === null) return "no_meeting";
  if (!budgetValid(plan) || !marksValid(gw, seat, plan)) return "bad_budget";
  const clean = cleanPlan(plan);
  // By decree, or with no house to vote it: signed as before.
  if (!moneyVoted(gw, n)) return budgetOrder(gw, seat, clean, false);
  b.put = clean;
  const id = moneyIds.budget(n.tag as GwTag);
  const st = lawStage(n, id);
  if (st !== null && MOVING.includes(st.stage)) {
    // Amended on the agenda: the house reads the new plan.
    st.support = budgetMood(gw, n, clean);
  } else {
    openBill(gw, seat, n, id, budgetMood(gw, n, clean));
  }
  seat.desk = seat.desk.filter((c) => !MEETING.test(c.scene));
  return null;
}

/**
 * The meeting card's `budget_sign` where the house votes the budget: the
 * draft goes onto the pinned place (the cabinet's amendments in it). False:
 * not such a country; the old signature runs.
 */
export function budgetSign(gw: GreatWar, n: GwNationState): boolean {
  if (n.budget.meeting === null || !moneyVoted(gw, n)) return false;
  const seat = seatsOf(gw, n.tag)[0];
  if (seat === undefined) return false;
  const id = moneyIds.budget(n.tag as GwTag);
  const st = lawStage(n, id);
  if (st === null || !MOVING.includes(st.stage)) {
    const plan = cleanPlan(n.budget.put ?? draftOf(n));
    n.budget.put = plan;
    openBill(gw, seat, n, id, budgetMood(gw, n, plan));
  }
  return true;
}

/** The credits bill on the pinned place, if any. */
function creditsBill(n: GwNationState): GwLawState | null {
  return (
    moneyAgenda(n).find((x) => moneyBillOf(x.id)?.kind === "credits") ?? null
  );
}

const atWar = (gw: GreatWar, n: GwNationState): boolean =>
  n.atWar.length > 0 && gw.s.armistice === null;

/** `budget_put` with credits: the period's credits to the house now. */
function putCredits(
  gw: GreatWar,
  seat: GwSeatState,
  n: GwNationState,
): GwOrderBlock | null {
  const cr = n.budget.credits;
  const rhythm = creditsRow(gw, seat);
  if (cr === undefined || rhythm === null || !atWar(gw, n)) {
    return "no_credits";
  }
  if (rhythm.by === "decree" || !moneyVoted(gw, n)) return "no_credits";
  if (creditsBill(n) !== null) return "law_busy";
  openCredits(gw, seat, n, rhythm);
  return null;
}

function openCredits(
  gw: GreatWar,
  seat: GwSeatState,
  n: GwNationState,
  rhythm: GwCreditsRow,
): void {
  const cr = n.budget.credits!;
  cr.due = gw.s.chapter + Math.max(1, rhythm.every);
  const k = cr.n + 1;
  openBill(
    gw,
    seat,
    n,
    moneyIds.credits(n.tag as GwTag, k),
    creditsMood(gw, n, k),
  );
}

/** The factions that had what they asked of a budget: trust +1 (§2.1 7). */
function thank(gw: GreatWar, seat: GwSeatState, st: GwLawState): void {
  for (const row of factionRows(seat.tag)) {
    const f = factionOf(seat, row.id);
    if (f?.status !== "in") continue;
    if (wantScore(gw, seat, st, row.id) > 0) factionTrust(seat, row.id, 1);
  }
}

function settle(
  n: GwNationState,
  st: GwLawState,
  how: GwLawState["how"],
): void {
  st.stage = "idle";
  st.how = how;
  st.faces = -1;
  // A credits bill is spent: the next has its own number.
  if (moneyBillOf(st.id)?.kind === "credits") {
    n.laws = n.laws.filter((x) => x !== st);
  }
}

function voted(
  n: GwNationState,
  kind: GwMoneyBill,
  how: "passed" | "failed",
): void {
  n.budget.voted = { ...(n.budget.voted ?? {}), [kind]: how };
}

/** Passed (Laws.enact): the budget runs, the credits are granted. */
export function moneyPassed(
  ctx: SceneCtx,
  st: GwLawState,
  how: "voted" | "decreed",
): void {
  const { gw, seat } = ctx;
  const m = moneyBillOf(st.id);
  const n = gw.nation(seat.tag);
  if (m === null || n === null) return;
  voted(n, m.kind, "passed");
  if (m.kind === "budget") {
    const plan = planOf(n);
    if (how === "voted") thank(gw, seat, st);
    // At the deadline the house voted it by itself: a proxy's budget.
    const b = n.budget;
    const late = b.meeting !== null && gw.s.chapter >= b.meeting;
    adopt(
      gw,
      n,
      plan,
      how === "decreed" ? "forced" : late ? "proxy" : "signed",
    );
    seat.desk = seat.desk.filter((c) => !MEETING.test(c.scene));
  } else {
    const cr = n.budget.credits;
    if (cr !== undefined) {
      cr.n = Math.max(cr.n, m.n);
      cr.stopTo = -1;
    }
    // Russia's credits put to the Duma anyway: the public lends gladly.
    if (creditsRow(gw, seat)?.by === "command") {
      moveOpinion(seat, "parliament", 1);
    }
    reason(gw, seat, "money_credits_passed");
  }
  settle(n, st, how);
}

/**
 * Lost (Laws.lose): authority as a law; where supply is confidence, a fall
 * step at once. Back to the lobby once; lost again, the country's rule.
 */
export function moneyLost(
  ctx: SceneCtx,
  st: GwLawState,
  key: string,
  band: GwVoteBand,
  confidence: boolean,
): void {
  const { gw, seat } = ctx;
  const m = moneyBillOf(st.id);
  const n = gw.nation(seat.tag);
  const row = m === null ? null : moneyRow(m.tag);
  if (m === null || n === null || row === null) return;
  const wide = band === "lost_wide";
  n.authority = clampTo(
    n.authority - (wide ? GW_LOST_WIDE : GW_LOST_NARROW),
    0,
    100,
  );
  reason(gw, seat, key);
  const stops = key.startsWith("house_no_")
    ? key.slice("house_no_".length)
    : "";
  const fail =
    row.failBy?.[stops as keyof NonNullable<GwMoneyRow["failBy"]>] ?? row.fail;
  const fall = houseFall(seat);
  if (fall !== null && (fail === "confidence" || confidence)) {
    heatThreat(gw, seat, { id: fall, by: fallBy(seat, fall, true) });
    reason(gw, seat, "money_confidence_lost");
  }
  st.lost++;
  let tries = st.lost;
  if (m.kind === "budget") {
    n.budget.tries = (n.budget.tries ?? 0) + 1;
    n.budget.refused = true;
    tries = n.budget.tries;
  }
  if (tries < GW_MONEY_TRIES) {
    st.stage = "persuade";
    st.since = gw.s.chapter;
    st.whip = -1;
    st.paper = [];
    st.paperAt = -1;
    reason(gw, seat, "money_back");
    return;
  }
  failed(gw, seat, n, st, fail);
}

/** Lost for good: the country's rule (design §2.3). */
function failed(
  gw: GreatWar,
  seat: GwSeatState,
  n: GwNationState,
  st: GwLawState,
  fail: GwMoneyRow["fail"],
): void {
  const m = moneyBillOf(st.id)!;
  const row = moneyRow(m.tag)!;
  voted(n, m.kind, "failed");
  if (m.kind === "budget") {
    if (fail === "unpaid") {
      // Budapest pays nothing in: the rest runs, Hungary's share does not.
      adopt(gw, n, planOf(n), "signed");
      const inst = row.owners?.national?.inst;
      if (inst !== undefined) shiftInst(n, inst, -1);
      reason(gw, seat, "money_unpaid");
    } else {
      runsOn(gw, seat, n);
    }
    seat.desk = seat.desk.filter((c) => !MEETING.test(c.scene));
  } else {
    lostCredits(gw, seat, n, m.n);
  }
  settle(n, st, "none");
}

/** Last year's budget runs on; the house that refused it is weaker for it. */
function runsOn(gw: GreatWar, seat: GwSeatState, n: GwNationState): void {
  closeMeeting(gw, n, "refused");
  tellSeats(gw, n, "budget_runs_on");
  const house = houseRow(n.tag);
  const bill = moneyBillRow(seat, moneyIds.budget(n.tag as GwTag));
  const first =
    house === null || bill === null
      ? undefined
      : chambersOf(house, bill).find((c) => c.inst !== undefined);
  if (first?.inst !== undefined) shiftInst(n, first.inst, -1);
  // The head of government may dissolve over it (the powers' dissolution).
  if (moneyRow(n.tag)?.dissolve === true) {
    reason(gw, seat, "money_dissolve_open");
  }
}

/**
 * Credits refused or withdrawn: no borrowing until the next credits come
 * due, the gap printed. By command they stand all the same.
 */
function lostCredits(
  gw: GreatWar,
  seat: GwSeatState,
  n: GwNationState,
  k: number,
): void {
  const cr = n.budget.credits;
  if (cr === undefined) return;
  if (creditsRow(gw, seat)?.by === "command") {
    // The Duma's no changes nothing legal; the bloc remembers it.
    cr.n = Math.max(cr.n, k);
    moveOpinion(seat, "parliament", -1);
    reason(gw, seat, "money_credits_command");
    return;
  }
  cr.lost++;
  cr.stopTo = Math.max(cr.due, gw.s.chapter + 1);
  reason(gw, seat, "money_credits_stopped");
}

/** 철회 (Laws.lawWithdraw): last year's runs on; no credits this period. */
export function moneyWithdrawn(
  gw: GreatWar,
  seat: GwSeatState,
  st: GwLawState,
): void {
  const m = moneyBillOf(st.id);
  const n = gw.nation(seat.tag);
  if (m === null || n === null) return;
  if (m.kind === "budget") runsOn(gw, seat, n);
  else lostCredits(gw, seat, n, m.n);
  settle(n, st, "none");
}

// ---- The chapter ----

/**
 * The deadline: the house votes the bill now, and a loss is the last. True
 * when it still waits (no chamber sits, or it voted this chapter).
 */
function callLast(
  gw: GreatWar,
  seat: GwSeatState,
  n: GwNationState,
  st: GwLawState,
): boolean {
  const m = moneyBillOf(st.id)!;
  if (m.kind === "budget") n.budget.tries = GW_MONEY_TRIES - 1;
  else st.lost = Math.max(st.lost, GW_MONEY_TRIES - 1);
  lawCall(gw, seat, st.id, false);
  return MOVING.includes(st.stage) && n.laws.includes(st);
}

function budgetDeadline(
  gw: GreatWar,
  seat: GwSeatState,
  n: GwNationState,
): void {
  const b = n.budget;
  const id = moneyIds.budget(n.tag as GwTag);
  const st = lawStage(n, id);
  // Settled another way (forced, signed by decree): off the pinned place.
  if (b.meeting === null) {
    if (st !== null && MOVING.includes(st.stage)) settle(n, st, "none");
    return;
  }
  if (gw.s.chapter < b.meeting || !moneyVoted(gw, n)) return;
  const bill =
    st !== null && MOVING.includes(st.stage)
      ? st
      : budgetSign(gw, n)
        ? lawStage(n, id)
        : null;
  if (bill === null) return;
  if (callLast(gw, seat, n, bill)) b.meeting = gw.s.chapter + 1;
}

function creditsStep(gw: GreatWar, seat: GwSeatState, n: GwNationState) {
  const row = moneyRow(n.tag);
  const b = n.budget;
  const bill = creditsBill(n);
  if (!atWar(gw, n) || row === null || row.credits.length === 0) {
    // Peace: no credits; a bill still on the agenda lapses.
    if (bill !== null) settle(n, bill, "none");
    return;
  }
  b.credits ??= { n: 0, due: gw.s.chapter, stopTo: -1, lost: 0 };
  const cr = b.credits;
  if (bill !== null) {
    if (gw.s.chapter >= bill.since + GW_MONEY_DEADLINE) {
      callLast(gw, seat, n, bill);
    }
    return;
  }
  if (gw.s.chapter < cr.due) return;
  const rhythm = creditsRow(gw, seat);
  if (rhythm === null) return;
  if (rhythm.by === "vote" && moneyVoted(gw, n)) {
    openCredits(gw, seat, n, rhythm);
    return;
  }
  // By command or decree (or the house gone): granted, no vote.
  cr.n++;
  cr.due = gw.s.chapter + Math.max(1, rhythm.every);
  const by: GwCreditsBy = rhythm.by === "vote" ? "decree" : rhythm.by;
  reason(gw, seat, `money_credits_${by}`);
}

/** A faction with this many tenths of the first chamber brings its own tilt. */
const TILT_TENTHS = 2;

/** The faction's own tilt of a plan: its line up, another down, its tax. */
function tiltOf(
  gw: GreatWar,
  seat: GwSeatState,
  n: GwNationState,
  plan: GwBudgetPlan,
  id: string,
): GwBudgetPlan | null {
  const w = wantsOf(idealsOf(id), purseRowOf(ctxOf(gw, seat), id, "budget"));
  const want = (l: GwBudgetLine) => w.lines[l] ?? 0;
  const off = (l: GwBudgetLine) => lineOff(n, plan, l);
  const up = GW_BUDGET_LINES.filter((l) => want(l) > 0).sort(
    (a, b) => off(a) - off(b),
  )[0];
  const down = GW_BUDGET_LINES.filter((l) => l !== up && want(l) <= 0).sort(
    (a, b) => want(a) - want(b) || off(b) - off(a),
  )[0];
  const out = cleanPlan(plan);
  let moved = false;
  if (up !== undefined && down !== undefined) {
    const d = GW_BUDGET_LINES.indexOf(down);
    const give = Math.min(GW_PURSE_OFF, out.shares[d]);
    if (give > 0) {
      out.shares[d] -= give;
      out.shares[GW_BUDGET_LINES.indexOf(up)] += give;
      moved = true;
    }
  }
  const tax = out.tax ?? "consumption";
  if (out.mix[0] > 100 && (w.taxes[tax] ?? 0) < 0) {
    const best = [...GW_TAX_KINDS].sort(
      (a, b) => (w.taxes[b] ?? 0) - (w.taxes[a] ?? 0),
    )[0];
    if (best !== undefined && (w.taxes[best] ?? 0) > 0) {
      out.tax = best;
      moved = true;
    }
  }
  return moved && budgetValid(out) ? out : null;
}

/**
 * ww210 merge (design §2.4): a strong faction against the budget put brings
 * its own tilt as an amendment from the floor, once a year: the house then
 * reads the amended plan. The seat may put its own again.
 */
function factionTilt(gw: GreatWar, seat: GwSeatState, n: GwNationState): void {
  const b = n.budget;
  const id = moneyIds.budget(n.tag as GwTag);
  const st = lawStage(n, id);
  const put = b.put ?? null;
  if (st === null || st.stage !== "persuade" || put === null) return;
  if (b.tilt !== undefined || gw.s.chapter <= st.since) return;
  const house = houseRow(n.tag);
  const bill = moneyBillRow(seat, id);
  const first =
    house === null || bill === null ? undefined : chambersOf(house, bill)[0];
  if (first === undefined) return;
  const rows = factionRows(seat.tag).filter(
    (r) => factionOf(seat, r.id)?.status === "in",
  );
  const seatsIn = (r: (typeof rows)[number]) =>
    seatsNow(seat, r)[first.id] ?? 0;
  const size = first.size ?? rows.reduce((t, r) => t + seatsIn(r), 0);
  const strong = rows
    .filter(
      (r) =>
        !st.deals.includes(r.id) &&
        seatsIn(r) * 10 >= size * TILT_TENTHS &&
        moneySide(gw, seat, st, r.id) < 0,
    )
    .sort((a, c) => seatsIn(c) - seatsIn(a))[0];
  if (strong === undefined) return;
  b.tilt = strong.id;
  const plan = tiltOf(gw, seat, n, put, strong.id);
  if (plan === null) return;
  b.put = plan;
  st.support = budgetMood(gw, n, plan);
  const f = factionOf(seat, strong.id);
  reason(gw, seat, "money_tilt", f?.leader ?? strong.leaders[0]?.person);
}

/** Each chapter, after the budget: credits come due, deadlines. */
export function moneyStep(gw: GreatWar): void {
  for (const n of gw.s.nations) {
    if (n.out || !moneyRuns(gw, n)) continue;
    const seat = seatsOf(gw, n.tag)[0];
    if (seat === undefined) continue;
    budgetDeadline(gw, seat, n);
    factionTilt(gw, seat, n);
    creditsStep(gw, seat, n);
  }
}

// ---- Conds and effects ----

const inRange = (v: number, r: { min?: number; max?: number }) =>
  (r.min === undefined || v >= r.min) && (r.max === undefined || v <= r.max);

export function moneyHolds(ctx: SceneCtx, c: MoneyCond): boolean {
  const { gw, seat } = ctx;
  const n = gw.nation(seat.tag);
  if (n === null) return false;
  switch (c.is) {
    case "money": {
      if (c.now === "open") {
        return moneyAgenda(n).some((x) => moneyBillOf(x.id)?.kind === c.bill);
      }
      if (c.now === "stopped") {
        return (n.budget.credits?.stopTo ?? -1) > gw.s.chapter;
      }
      return n.budget.voted?.[c.bill] === c.now;
    }
    case "tax_kind":
      return (n.budget.plan.tax ?? "consumption") === c.tax;
    case "earmark":
      return (n.budget.plan.marks ?? []).includes(c.id);
    case "defy":
      return inRange(factionOf(seat, c.id)?.defied ?? 0, c);
    case "split_pressure":
      return inRange(factionOf(seat, c.id)?.split ?? 0, c);
  }
}

function markIn(
  plan: GwBudgetPlan | null | undefined,
  id: string,
  on: boolean,
): void {
  if (plan === null || plan === undefined) return;
  const rest = (plan.marks ?? []).filter((x) => x !== id);
  const marks = on ? [...rest, id] : rest;
  if (marks.length === 0) delete plan.marks;
  else plan.marks = marks;
}

export function moneyDo(ctx: SceneCtx, e: MoneyEffect): void {
  const { gw, seat } = ctx;
  const n = gw.nation(seat.tag);
  if (n === null) return;
  switch (e.do) {
    case "earmark": {
      const b = n.budget;
      for (const plan of [b.plan, b.draft, b.put]) markIn(plan, e.id, e.on);
      return;
    }
    case "split_pressure": {
      const f = factionOf(seat, e.id);
      if (f !== null) f.split = Math.max(0, (f.split ?? 0) + e.delta);
      return;
    }
  }
}

// ---- Views ----

/** The ledger's extras: tax kinds, earmarks, the bill, the credits. */
export function moneyBudgetView(
  gw: GreatWar,
  seat: GwSeatState,
  v: GwBudgetView,
): GwBudgetView {
  const n = gw.nation(seat.tag);
  if (n === null || moneyRow(n.tag) === null) return v;
  const b = n.budget;
  const plan = b.put ?? b.draft ?? b.plan;
  const earmarks = gwContent().money?.earmarks ?? [];
  const id = moneyIds.budget(n.tag as GwTag);
  const st = lawStage(n, id);
  const cr = b.credits;
  const rhythm = creditsRow(gw, seat);
  const credits = creditsBill(n);
  const stage = st?.stage;
  return {
    ...v,
    tax: plan.tax ?? "consumption",
    taxes: [...GW_TAX_KINDS],
    marks: (plan.marks ?? []).flatMap((m) => {
      const row = earmarks.find((e) => e.id === m);
      return row === undefined
        ? []
        : [
            {
              id: row.id,
              line: row.line,
              points: row.points,
              faction: row.faction ?? null,
              community: row.community ?? null,
            },
          ];
    }),
    bill:
      stage === "persuade" || stage === "vote" || stage === "sign"
        ? { law: id, stage }
        : null,
    credits:
      cr === undefined || rhythm === null || !atWar(gw, n)
        ? null
        : {
            n: cr.n + 1,
            by: rhythm.by,
            due: cr.due,
            law: credits?.id ?? null,
            stopTo: cr.stopTo > gw.s.chapter ? cr.stopTo : null,
          },
  };
}

/** The pinned money rows above the agenda (`book.pinned`). */
export function moneyBookView(
  gw: GreatWar,
  seat: GwSeatState,
  v: GwBookView | undefined,
): GwBookView | undefined {
  const n = gw.nation(seat.tag);
  const row = n === null ? null : moneyRow(n.tag);
  if (v === undefined || n === null || row === null) return v;
  const year = civilFromDays(gw.s.day).year;
  const pinned = moneyAgenda(n).map((st) => {
    const m = moneyBillOf(st.id)!;
    return {
      ...agendaView(gw, seat, n, st),
      money: {
        kind: m.kind,
        n: m.n,
        year: m.kind === "budget" ? (n.budget.year ?? year) : year,
        fail: row.fail,
      },
    };
  });
  return pinned.length === 0 ? v : { ...v, pinned };
}

/** The strip's purse words while a money bill is on the agenda. */
export function moneyStripView(
  gw: GreatWar,
  seat: GwSeatState,
  v: GwSocietyView | undefined,
): GwSocietyView | undefined {
  const n = gw.nation(seat.tag);
  if (v === undefined || n === null) return v;
  const bills = moneyAgenda(n);
  if (bills.length === 0) return v;
  const st =
    bills.find((x) => moneyBillOf(x.id)?.kind === "budget") ?? bills[0];
  return {
    ...v,
    factions: v.factions.map((f) => ({
      ...f,
      purse: st.paper.find((p) => p.faction === f.id)?.word ?? "unknown",
    })),
  };
}
