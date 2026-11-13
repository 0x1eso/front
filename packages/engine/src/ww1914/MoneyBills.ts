// Great War 1914 (ww209/ww210, lane S1): the money bills. The yearly budget
// and the war credits as special articles with their own pinned place on the
// agenda, counted by faction from each one's purse, voted with the full vote
// scene, and each country's rule when they fail (design §2). The money
// itself still runs in Budget.ts. S0 left stubs that change nothing: the
// orders refuse, the conds read false, the effects do nothing, the views pass
// through. See /home/eser/dev/ww209-format.md.
import type { GwSeatState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type {
  GwBudgetPlan,
  GwBudgetView,
} from "@openfront/engine-api/ww1914/GwBudget";
import type { GwBookView } from "@openfront/engine-api/ww1914/GwLaw";
import type { GwOrderBlock } from "@openfront/engine-api/ww1914/GwOrders";
import type { GwSocietyView } from "@openfront/engine-api/ww1914/GwSociety";
import type {
  GwWorldCond,
  GwWorldEffect,
} from "@openfront/engine-api/ww1914/WorldDsl";
import type { GreatWar } from "./GreatWar";
import type { SceneCtx } from "./SceneRun";

export type MoneyCond = Extract<
  GwWorldCond,
  { is: "money" | "tax_kind" | "earmark" | "defy" | "split_pressure" }
>;
export type MoneyEffect = Extract<
  GwWorldEffect,
  { do: "earmark" | "split_pressure" }
>;

/** Each chapter, after the budget: credits come due, deadlines, the AI's. */
export function moneyStep(_gw: GreatWar): void {}

/** Order `budget_put`: the plan (or the credits) onto the pinned place. */
export function budgetPut(
  _gw: GreatWar,
  _seat: GwSeatState,
  _plan: GwBudgetPlan,
  _credits: boolean,
): GwOrderBlock | null {
  return "no_meeting";
}

export function moneyHolds(_ctx: SceneCtx, _c: MoneyCond): boolean {
  return false;
}

export function moneyDo(_ctx: SceneCtx, _e: MoneyEffect): void {}

/** The ledger's extras: tax kinds, earmarks, the bill, the credits. */
export function moneyBudgetView(
  _gw: GreatWar,
  _seat: GwSeatState,
  v: GwBudgetView,
): GwBudgetView {
  return v;
}

/** The pinned money rows above the agenda (`book.pinned`). */
export function moneyBookView(
  _gw: GreatWar,
  _seat: GwSeatState,
  v: GwBookView | undefined,
): GwBookView | undefined {
  return v;
}

/** The strip's purse words while a money bill is on the agenda. */
export function moneyStripView(
  _gw: GreatWar,
  _seat: GwSeatState,
  v: GwSocietyView | undefined,
): GwSocietyView | undefined {
  return v;
}
