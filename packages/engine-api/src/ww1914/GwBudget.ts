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

/**
 * ww209: who the taxes fall on, the plan's `tax` (absent: consumption, the
 * old indirect duties). Text gw.budget.tax.<id>.
 */
export const GW_TAX_KINDS = [
  "consumption", // 소비세: everyone, the poor most
  "income", // 소득세
  "property", // 재산세·상속세 (the 1913 Wehrbeitrag's kind)
  "profits", // 전시 이득세
] as const;
export type GwTaxKind = (typeof GW_TAX_KINDS)[number];

/**
 * ww209: the money bills, each a special article of the war_finance chapter
 * with its own pinned place on the agenda (not counted in GW_AGENDA_MAX):
 * the yearly budget (`<tag>_budget`) and the war credits (`<tag>_credits_<n>`,
 * engine-lib MoneyRows `moneyIds`). Text gw.money.bill.<id>.
 */
export const GW_MONEY_BILLS = ["budget", "credits"] as const;
export type GwMoneyBill = (typeof GW_MONEY_BILLS)[number];

/**
 * ww209: how a country's war credits come: voted by the house; by supreme
 * command, nothing to vote (RUS); by provisional decree while the house is
 * shut (AUH §14). Text gw.money.by.<id>.
 */
export const GW_CREDITS_BY = ["vote", "command", "decree"] as const;
export type GwCreditsBy = (typeof GW_CREDITS_BY)[number];

/**
 * ww209: what a money bill lost twice (or past its deadline) does. `runs_on`:
 * last year's budget runs on (DEU, RUS). `confidence`: the government's fall
 * row takes a step at once (GBR, FRA). `unpaid`: the consenting half pays
 * nothing in, its share's effect fails (Budapest). Failed credits always stop
 * borrowing for their period, the gap printed. Text gw.money.fail.<id>.
 */
export const GW_MONEY_FAILS = ["runs_on", "confidence", "unpaid"] as const;
export type GwMoneyFail = (typeof GW_MONEY_FAILS)[number];

/** ww209: chapters from the meeting by which the budget must pass. */
export const GW_MONEY_DEADLINE = 2;
/** ww209: a money bill goes back to the lobby once; the next loss is final. */
export const GW_MONEY_TRIES = 2;

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
  /** ww209: who the taxes fall on; absent: consumption. */
  tax: z.enum(GW_TAX_KINDS).optional(),
  /**
   * ww209: earmarks in it (engine-lib MoneyRows `GwEarmarkRow` ids): points
   * of a line set aside for a community or region. Absent: none.
   */
  marks: z.array(z.string()).optional(),
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
  // ---- ww209 (S1); absent: none yet ----
  /** The plan put to the house (`budget_put`), while its bill is on the agenda. */
  put: GwBudgetPlanSchema.nullable().optional(),
  /** Votes the budget has lost this meeting (GW_MONEY_TRIES). */
  tries: int.optional(),
  /**
   * ww210 merge: the faction whose own tilt amended the budget put this year
   * (a strong faction against it); absent none yet.
   */
  tilt: z.string().optional(),
  /** The war credits: absent until the first are due. */
  credits: z
    .object({
      /** Credits voted or granted so far: the next bill is `n + 1`. */
      n: int,
      /** The chapter the next credits come due. */
      due: int,
      /** Borrowing (bonds and loans) stopped until this chapter; -1 not. */
      stopTo: int,
      /** Credits refused so far. */
      lost: int,
    })
    .optional(),
  /** The year the open meeting's budget is for (1916년 예산). */
  year: int.optional(),
  /** How each money bill's last vote went (this meeting, these credits). */
  voted: z
    .object({
      budget: z.enum(["passed", "failed"]).optional(),
      credits: z.enum(["passed", "failed"]).optional(),
    })
    .optional(),
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
  /**
   * ww190: the house doesn't sit: `until` the election's date (dissolved),
   * or null when it was sent home or abolished. Absent or null: it sits.
   */
  shut?: { until: string | null } | null;
  // ---- ww209 (S1 fills; absent: before) ----
  /** The tax kind of the plan, and those the seat may pick now. */
  tax?: GwTaxKind;
  taxes?: readonly GwTaxKind[];
  /** Earmarks in the draft (small lines under their line). */
  marks?: readonly GwEarmarkView[];
  /** The budget's bill on the agenda (the pinned row), if put. */
  bill?: { law: string; stage: "persuade" | "vote" | "sign" } | null;
  /** The war credits; null with none (peace, or a country with no rhythm). */
  credits?: GwCreditsView | null;
  /**
   * ww213: the year the latest meeting's budget is for (1916년도 예산안), so
   * its name holds after its pinned row is gone (the vote scene, reports).
   */
  year?: number;
  /** ww214: the plan before the house now (amended on its paper); absent: none. */
  put?: GwBudgetPlan | null;
}

/** ww209: an earmark under its line: text pack money.mark.<id>. */
export interface GwEarmarkView {
  id: string;
  line: GwBudgetLine;
  /** Points of the line (information; the line chip shows words). */
  points: number;
  /** Whose: the faction it was promised to, the community it feeds. */
  faction: string | null;
  community: string | null;
}

/** ww209: the war credits as the ledger and the pinned row read them. */
export interface GwCreditsView {
  /** The next credits' number (제n차 전쟁 공채). */
  n: number;
  by: GwCreditsBy;
  /** The chapter they come due. */
  due: number;
  /** Their bill on the agenda; null not yet. */
  law: string | null;
  /** Borrowing is stopped now (credits refused): until this chapter. */
  stopTo: number | null;
}
