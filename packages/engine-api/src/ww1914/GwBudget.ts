// Great War 1914: the yearly national budget. The words, the state a country
// keeps and what a seat reads. The rule is engine-lib/ww1914/BudgetRules (pure,
// so the screen can forecast with it), the running of it engine/ww1914/Budget.
// Sums are whole millions of the country's own money; prices are per mille,
// 1000 being June 1914. Lists are APPEND ONLY.
import { z } from "zod";

/** Where the money goes: `shares`, in this order, sums to 100. */
export const GW_BUDGET_LINES = [
  "army",
  "navy",
  "relief",
  "works",
  "national",
] as const;
export type GwBudgetLine = (typeof GW_BUDGET_LINES)[number];

/** Where it comes from: `mix`, in this order. */
export const GW_BUDGET_SOURCES = ["taxes", "bonds", "loans", "print"] as const;
export type GwBudgetSource = (typeof GW_BUDGET_SOURCES)[number];

/** The three numbers the seat reads, each with its reason lines. */
export const GW_BUDGET_ITEMS = ["treasury", "debt", "prices"] as const;
export type GwBudgetItem = (typeof GW_BUDGET_ITEMS)[number];

/** What the shares feed, a little every chapter. `sea` is the navy's repair. */
export const GW_BUDGET_DRIFTS = [
  "shells",
  "bread",
  "morale",
  "order",
  "sea",
] as const;
export type GwBudgetDrift = (typeof GW_BUDGET_DRIFTS)[number];

/** How the budget now running came to be. */
export const GW_BUDGET_HOWS = [
  "none",
  "signed",
  "proxy",
  "forced",
  "alone",
  "refused",
] as const;
export type GwBudgetHow = (typeof GW_BUDGET_HOWS)[number];

/** The tax rate, percent of June 1914's. */
export const GW_TAX_MIN = 70;
export const GW_TAX_MAX = 220;
/** Bonds, loans and printing are asked as percent of the year's outlay. */
export const GW_RAISE_MAX = 90;

const int = z.number().int();

export const GwBudgetPlanSchema = z.object({
  /** GW_BUDGET_LINES order; sums to 100. */
  shares: z.array(int),
  /** GW_BUDGET_SOURCES order: the tax rate, then percents of the outlay. */
  mix: z.array(int),
});
export type GwBudgetPlan = z.infer<typeof GwBudgetPlanSchema>;

/** Why a number moved since the last budget; text gw.budget.note.<key>. */
export const GwBudgetNoteSchema = z.object({
  item: z.enum(GW_BUDGET_ITEMS),
  key: z.string(),
  delta: int,
});
export type GwBudgetNote = z.infer<typeof GwBudgetNoteSchema>;

export const GwBudgetStateSchema = z.object({
  treasury: int,
  debt: int,
  /** Per mille, 1000 = June 1914. */
  prices: int,
  /** Percent of the row's interest rate: a moratorium lowers it. */
  rate: int,
  /** What runs now, until the next budget. */
  plan: GwBudgetPlanSchema,
  /** The finance holder's draft, while a meeting is open. */
  draft: GwBudgetPlanSchema.nullable(),
  /** The chapter of the open meeting; null with none. */
  meeting: int.nullable(),
  /** The body turned this meeting's bill down. */
  refused: z.boolean(),
  last: z.enum(GW_BUDGET_HOWS),
  /** Chapter the last budget closed; -9 none. */
  lastChapter: int,
  /** The meeting at the outbreak has been called. */
  outbreak: z.boolean(),
  /** A budget made for war has been adopted. */
  warPlan: z.boolean(),
  /** Points towards the next gauge step, in point-days (see BudgetRules). */
  drift: z.record(z.enum(GW_BUDGET_DRIFTS), int),
  /** Lender id -> what is owed to it. */
  lent: z.record(z.string(), int),
  /** Lender id -> how many times it has come to collect. */
  asked: z.record(z.string(), int),
  /** Lenders stay shut until this chapter: a moratorium's price. */
  shutUntil: int,
  /** Chapter of the last bankruptcy crisis; -99 none. */
  crisis: int,
  notes: z.array(GwBudgetNoteSchema),
});
export type GwBudgetState = z.infer<typeof GwBudgetStateSchema>;

/** Who says yes to a budget, as the seat can see it. */
export interface GwBudgetBodyView {
  /** vote: it can refuse. consent: the same, by another name. alone: the seat
   * can sign over it, at a price. */
  kind: "vote" | "consent" | "alone";
  inst: string;
  need: number;
  second: string | null;
  secondNeed: number;
  /** Their standing now, the second's too. */
  value: number;
  secondValue: number;
  /** Authority it takes to force the bill through. */
  forcePrice: number;
}

/** What the forecast needs: all of it the seat's to know. */
export interface GwBudgetBasis {
  tag: string;
  war: boolean;
  /** Whole years since the country came in. */
  warYears: number;
  treasury: number;
  debt: number;
  prices: number;
  rate: number;
  /** Today's gauge of morale, 0..5. */
  morale: number;
  /** A run of news from the front, -2..2. */
  news: number;
  /** The most the open lenders will give, percent of the outlay. */
  loanCap: number;
  /** The first budget of the war: the country rallies to it. */
  rally: boolean;
}

export interface GwLenderView {
  id: string;
  open: boolean;
  /** Percent of the outlay it would give. */
  cap: number;
  owed: number;
}

export interface GwBudgetView {
  basis: GwBudgetBasis;
  plan: GwBudgetPlan;
  draft: GwBudgetPlan | null;
  /** Shares the country runs on in this state of war or peace. */
  norm: readonly number[];
  meeting: boolean;
  refused: boolean;
  last: GwBudgetHow;
  /** YYYY-MM-DD of the next yearly meeting; null when none is left. */
  next: string | null;
  notes: readonly GwBudgetNote[];
  lenders: readonly GwLenderView[];
  body: GwBudgetBodyView | null;
  authority: number;
  /** The finance holder, or null if the office stands empty. */
  holder: string | null;
}
