// Great War 1914: the rule of the yearly budget, as pure functions over plain
// numbers, so that the engine runs it and the screen forecasts with the same
// arithmetic. Who pays, who votes and who lends are rows: a later country adds
// a row and nothing else. Whole numbers only: the simulation folds these.
import type {
  GwGauge,
  GwInstitution,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GW_BUDGET_DRIFTS,
  GW_BUDGET_LINES,
  GW_RAISE_MAX,
  GW_TAX_MAX,
  GW_TAX_MIN,
  GwBudgetBasis,
  GwBudgetDrift,
  GwBudgetLine,
  GwBudgetPlan,
  GwBudgetState,
} from "@openfront/engine-api/ww1914/GwBudget";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";

/** One who lends: `tag`'s government or its market. Text gw.budget.lender.<id>. */
export interface GwLender {
  readonly id: string;
  readonly tag: GwTag;
  /** The most it gives, percent of the year's outlay. */
  readonly cap: number;
  /** What borrowing binds the seat to: see `bindOf` in engine/ww1914/Budget. */
  readonly bind:
    | { readonly kind: "america"; readonly per10: number }
    | { readonly kind: "inst"; readonly inst: GwInstitution }
    | { readonly kind: "gold"; readonly pct: number };
  /** It comes to collect each time it is owed this percent of a year's revenue. */
  readonly demandAt: number;
}

export interface GwBudgetRow {
  /** Millions a year, in June 1914's prices; `outlay` is before interest. */
  readonly revenue: number;
  readonly outlay: number;
  /** The first year of war; `growth` is percent more each year after. */
  readonly warOutlay: number;
  readonly growth: number;
  readonly debt: number;
  /** Percent a year on the debt. */
  readonly interest: number;
  /** One step of the money gauge, in June 1914's prices. */
  readonly step: number;
  /** Per mille a year prices rise from the war alone. */
  readonly warPrices: number;
  /** Shares a country runs on: `army`, `navy`, `relief`, `works`, `national`. */
  readonly peace: readonly number[];
  readonly war: readonly number[];
  /** The tax rate the draft asks in war. */
  readonly warTax: number;
  /** What the draft leaves unfunded a year, in gauge steps. */
  readonly slack: number;
  /** Percent of the outlay the draft takes from lenders, if they are open. */
  readonly loanDraft: number;
  /** Percent of what is left after taxes and loans the draft asks of bonds. */
  readonly bondShare: number;
  /** What the national line feeds. */
  readonly national: {
    readonly inst?: GwInstitution;
    readonly drift?: GwBudgetDrift;
    readonly trust?: readonly GwTag[];
  };
  /** What the navy line repairs. */
  readonly navy: "shipping" | "blockade" | null;
  readonly lenders: readonly GwLender[];
}

const morgan = (cap: number): GwLender => ({
  id: "morgan",
  tag: "USA",
  cap,
  bind: { kind: "america", per10: 2 },
  demandAt: 150,
});
const london = (cap: number, pct: number): GwLender => ({
  id: "london",
  tag: "GBR",
  cap,
  bind: { kind: "gold", pct },
  demandAt: 80,
});
const paris = (cap: number): GwLender => ({
  id: "paris",
  tag: "FRA",
  cap,
  bind: { kind: "gold", pct: 0 },
  demandAt: 200,
});
const berlin = (cap: number): GwLender => ({
  id: "berlin",
  tag: "DEU",
  cap,
  bind: { kind: "inst", inst: "berlin" },
  demandAt: 60,
});

const OTHER: GwBudgetRow = {
  revenue: 1000,
  outlay: 925,
  warOutlay: 3000,
  growth: 20,
  debt: 1500,
  interest: 5,
  step: 350,
  warPrices: 80,
  peace: [35, 10, 15, 30, 10],
  war: [68, 6, 10, 8, 8],
  warTax: 100,
  slack: 1,
  loanDraft: 0,
  bondShare: 60,
  national: {},
  navy: null,
  lenders: [],
};

/**
 * Every country's money, June 1914 (ww140 report: sources and what is rounded).
 * A country with no row keeps the plain one.
 */
export const GW_BUDGET: Readonly<Partial<Record<GwTag, GwBudgetRow>>> = {
  DEU: {
    ...OTHER,
    revenue: 3500,
    outlay: 3250,
    warOutlay: 22000,
    growth: 25,
    debt: 5000,
    interest: 5,
    step: 1200,
    warPrices: 90,
    peace: [40, 13, 12, 22, 13],
    war: [72, 8, 8, 6, 6],
    warTax: 100,
    slack: 2,
    loanDraft: 2,
    bondShare: 78,
    national: { inst: "reichstag", drift: "morale" },
    navy: "blockade",
    lenders: [
      {
        id: "neutrals",
        tag: "USA",
        cap: 3,
        bind: { kind: "america", per10: 0 },
        demandAt: 400,
      },
    ],
  },
  GBR: {
    ...OTHER,
    revenue: 200,
    outlay: 174,
    warOutlay: 1100,
    growth: 35,
    debt: 650,
    interest: 4,
    step: 70,
    warPrices: 70,
    peace: [22, 25, 13, 32, 8],
    war: [50, 22, 6, 6, 16],
    warTax: 130,
    slack: 0,
    loanDraft: 12,
    bondShare: 85,
    national: { trust: ["FRA", "RUS"], drift: "morale" },
    navy: "shipping",
    lenders: [morgan(22)],
  },
  AUH: {
    ...OTHER,
    revenue: 3000,
    outlay: 2280,
    warOutlay: 11000,
    growth: 20,
    debt: 18000,
    interest: 4,
    step: 1000,
    warPrices: 120,
    peace: [24, 6, 14, 34, 22],
    war: [68, 3, 9, 6, 14],
    warTax: 100,
    slack: 0,
    loanDraft: 6,
    bondShare: 60,
    national: { inst: "hungary", drift: "bread" },
    navy: null,
    lenders: [berlin(12)],
  },
  RUS: {
    ...OTHER,
    revenue: 3400,
    outlay: 3050,
    warOutlay: 9000,
    growth: 40,
    debt: 8800,
    interest: 4,
    step: 1100,
    warPrices: 130,
    peace: [30, 8, 10, 30, 22],
    war: [68, 4, 8, 6, 14],
    warTax: 85,
    slack: 0,
    loanDraft: 20,
    bondShare: 45,
    national: { inst: "court", drift: "bread" },
    navy: null,
    lenders: [london(30, 8), paris(8)],
  },
  FRA: {
    ...OTHER,
    revenue: 5000,
    outlay: 4000,
    warOutlay: 20000,
    growth: 25,
    debt: 33000,
    interest: 3,
    step: 1700,
    warPrices: 100,
    // The seat's own fields (ww166, lane W5): the Republic spent heavily on
    // the army and its forts, and paid for the war with bonds, not taxes.
    peace: [32, 12, 12, 26, 18],
    war: [70, 6, 10, 6, 8],
    warTax: 95,
    loanDraft: 12,
    bondShare: 75,
    national: { inst: "chamber", drift: "morale" },
    navy: "shipping",
    lenders: [london(15, 0), morgan(12)],
  },
  ITA: {
    ...OTHER,
    revenue: 2500,
    outlay: 1900,
    warOutlay: 7000,
    debt: 15000,
    interest: 4,
    step: 800,
    loanDraft: 15,
    lenders: [london(20, 0)],
  },
  USA: {
    ...OTHER,
    revenue: 750,
    outlay: 710,
    warOutlay: 9000,
    debt: 1200,
    interest: 3,
    step: 250,
    warPrices: 60,
  },
  OTT: { ...OTHER, loanDraft: 15, lenders: [berlin(25)] },
  BGR: { ...OTHER, loanDraft: 15, lenders: [berlin(25)] },
  SRB: { ...OTHER, loanDraft: 20, lenders: [paris(30)] },
};

export const budgetRow = (tag: string): GwBudgetRow =>
  GW_BUDGET[tag as GwTag] ?? OTHER;

/**
 * Who passes a budget, by form of government (engine/ww1914/Regimes). A form
 * with no row signs for itself. France and later countries add a row.
 */
export interface GwBudgetBody {
  readonly kind: "vote" | "consent" | "alone";
  readonly inst: GwInstitution;
  /** Their standing plus what the bill does for them must reach this. */
  readonly need: number;
  readonly second?: { readonly inst: GwInstitution; readonly need: number };
  /** Authority to force it past them; `alone` pays this to sign over them. */
  readonly forcePrice: number;
  /** What being passed over costs the body. */
  readonly fallout: number;
}

const commons: GwBudgetBody = {
  kind: "vote",
  inst: "commons",
  need: -4,
  second: { inst: "cabinet", need: -4 },
  forcePrice: 35,
  fallout: 2,
};
const hungary: GwBudgetBody = {
  kind: "consent",
  inst: "hungary",
  need: -3,
  forcePrice: 25,
  fallout: 2,
};

const chambre: GwBudgetBody = {
  kind: "vote",
  inst: "chamber",
  need: -2,
  second: { inst: "senate", need: -3 },
  forcePrice: 25,
  fallout: 2,
};

export const GW_BUDGET_BODIES: Readonly<Record<string, GwBudgetBody>> = {
  empire: {
    kind: "vote",
    inst: "reichstag",
    need: -4,
    forcePrice: 30,
    fallout: 2,
  },
  republic: {
    kind: "vote",
    inst: "reichstag",
    need: -2,
    forcePrice: 30,
    fallout: 2,
  },
  liberal: commons,
  coalition: commons,
  war_cabinet: commons,
  national: commons,
  dual_monarchy: hungary,
  ff_throne: hungary,
  karl: hungary,
  federation: hungary,
  tsar: { kind: "alone", inst: "duma", need: -1, forcePrice: 10, fallout: 1 },
  crown: { kind: "vote", inst: "duma", need: -2, forcePrice: 25, fallout: 2 },
  regency: { kind: "vote", inst: "duma", need: -2, forcePrice: 25, fallout: 2 },
  provisional: {
    kind: "vote",
    inst: "duma",
    need: -2,
    forcePrice: 20,
    fallout: 1,
  },
  rep: { kind: "vote", inst: "duma", need: -2, forcePrice: 20, fallout: 1 },
  // France: the Chamber votes the credits, the provisional twelfths.
  fra_republic: chambre,
  fra_union: chambre,
  fra_tiger: chambre,
  fra_defeat: chambre,
};

/**
 * Seat flags under which the budget goes by decree (ww171): nobody votes it
 * and nobody can refuse it. `once`: it carries one budget, then lapses.
 */
export const GW_BUDGET_DECREE: readonly {
  readonly flag: string;
  readonly once?: boolean;
}[] = [
  // The Duma abolished: the Tsar's budget is his own.
  { flag: "f_rus_duma_abolished" },
  // Parliament prorogued: supply by Order in Council.
  { flag: "f_gbr_prorogued" },
  // The Prussian conflict's way: this year's budget spent without a vote.
  { flag: "f_deu_no_budget", once: true },
];

/** Who votes the budget now: the regime's body, or nobody by decree. */
export function budgetBody(
  regime: string,
  flags: readonly string[],
): GwBudgetBody | null {
  if (GW_BUDGET_DECREE.some((d) => flags.includes(d.flag))) return null;
  return GW_BUDGET_BODIES[regime] ?? null;
}

/** A gauge step is this many point-days: 100 points held for a 360-day year. */
export const GW_DRIFT_STEP = 36000;

/** Points a year for each share point off the norm. */
const ARMY_SHELLS = 20;
const NAVY_SEA = 20;
const RELIEF_BREAD = 20;
const RELIEF_ORDER = 8;
const WORKS_ORDER = 15;
const WORKS_MORALE = 10;
const NATIONAL_DRIFT = 15;
/** Points of order a year for each percent of tax over or under June 1914's. */
const TAX_ORDER = 1;
/** Prices over this (per mille) cost order, a point a year per this many more. */
const PRICES_BITE = 1500;
const PRICES_PER_POINT = 10;

/** The first war budget: nobody refuses a country its first credits. */
const RALLY = 3;

/** Interest as a percent of taxes at which the country is carrying too much. */
export const GW_LOAD_HEAVY = 50;
export const GW_LOAD_CRUSHING = 100;
/** Prices (per mille) that, with an empty treasury, bring the crisis. */
export const GW_PRICES_CRISIS = 3000;

const trunc = Math.trunc;
const clampTo = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

export const budgetNorm = (tag: string, war: boolean): readonly number[] =>
  war ? budgetRow(tag).war : budgetRow(tag).peace;

/** Half of a rise in prices reaches wages, contracts and taxes within the year. */
const halfLift = (prices: number) => 1000 + trunc((prices - 1000) / 2);

/** The year's outlay at today's prices. */
export function outlayOf(b: GwBudgetBasis): number {
  const row = budgetRow(b.tag);
  const real = b.war
    ? trunc((row.warOutlay * (100 + row.growth * b.warYears)) / 100)
    : row.outlay;
  return trunc((real * halfLift(b.prices)) / 1000);
}

export function interestOf(b: GwBudgetBasis): number {
  const row = budgetRow(b.tag);
  return trunc((b.debt * row.interest * b.rate) / 10000);
}

/** Taxes at this rate: half of a rise in prices comes in with them. */
export function taxesOf(b: GwBudgetBasis, rate: number): number {
  const lift = halfLift(b.prices);
  return trunc((budgetRow(b.tag).revenue * rate * lift) / 100000);
}

/** Interest as a percent of what taxes bring at the rate of June 1914. */
export function loadOf(b: GwBudgetBasis): number {
  return trunc((interestOf(b) * 100) / Math.max(1, taxesOf(b, 100)));
}

/**
 * Of 100 asked, what the public takes up: bonds need morale and a run of good
 * news, and a country that owes too much sells fewer.
 */
export function appetiteOf(b: GwBudgetBasis): number {
  const heavy = loadOf(b) >= GW_LOAD_HEAVY ? 10 : 0;
  return clampTo(40 + b.morale * 10 + b.news * 12 - heavy, 25, 110);
}

export interface GwBudgetYear {
  outlay: number;
  interest: number;
  taxes: number;
  bonds: number;
  loans: number;
  print: number;
  /** All that comes in less all that goes out; below 0 the treasury pays. */
  balance: number;
  /** Bonds: percent of what is asked that the public takes up. */
  appetite: number;
  /** What the treasury can't cover, printed on top. */
  shortfall: number;
  treasury: number;
  debt: number;
  prices: number;
  /** Points a year each gauge moves. 100 is a step. */
  drift: Record<GwBudgetDrift, number>;
  /** The largest cause of each drift; text gw.line.<key>. */
  why: Record<GwBudgetDrift, string>;
}

/** The notes and deposits a country has, as years of revenue. */
const SUPPLY_YEARS = 8;
/** The most prices can reach: paper still buys something. */
export const GW_PRICES_MAX = 12000;

/** Prices (per mille) that this much printing adds. */
export const printedPrices = (tag: string, printed: number): number =>
  trunc((printed * 1000) / (budgetRow(tag).revenue * SUPPLY_YEARS));

function driftOf(
  b: GwBudgetBasis,
  plan: GwBudgetPlan,
): Pick<GwBudgetYear, "drift" | "why"> {
  const row = budgetRow(b.tag);
  const norm = budgetNorm(b.tag, b.war);
  const off = (l: GwBudgetLine) => {
    const i = GW_BUDGET_LINES.indexOf(l);
    return plan.shares[i] - norm[i];
  };
  const parts: [GwBudgetDrift, number, string][] = [
    ["shells", off("army") * ARMY_SHELLS, "budget_army"],
    ["sea", off("navy") * NAVY_SEA, "budget_navy"],
    ["bread", off("relief") * RELIEF_BREAD, "budget_relief"],
    ["order", off("relief") * RELIEF_ORDER, "budget_relief"],
    ["order", off("works") * WORKS_ORDER, "budget_works"],
    ["morale", off("works") * WORKS_MORALE, "budget_works"],
    ["order", (100 - plan.mix[0]) * TAX_ORDER, "budget_taxes"],
    [
      "order",
      -trunc(Math.max(0, b.prices - PRICES_BITE) / PRICES_PER_POINT),
      "order_prices",
    ],
  ];
  if (row.national.drift !== undefined) {
    parts.push([
      row.national.drift,
      off("national") * NATIONAL_DRIFT,
      "budget_national",
    ]);
  }
  const drift = Object.fromEntries(
    GW_BUDGET_DRIFTS.map((d) => [d, 0]),
  ) as Record<GwBudgetDrift, number>;
  const why = Object.fromEntries(
    GW_BUDGET_DRIFTS.map((d) => [d, ""]),
  ) as Record<GwBudgetDrift, string>;
  for (const [d, pts] of parts) drift[d] += pts;
  for (const d of GW_BUDGET_DRIFTS) {
    let best = 0;
    for (const [x, pts, key] of parts) {
      if (x === d && pts * drift[d] > 0 && Math.abs(pts) > best) {
        best = Math.abs(pts);
        why[d] = key;
      }
    }
  }
  return { drift, why };
}

/** The year this plan makes, on these numbers. */
export function budgetYear(b: GwBudgetBasis, plan: GwBudgetPlan): GwBudgetYear {
  const row = budgetRow(b.tag);
  const outlay = outlayOf(b);
  const interest = interestOf(b);
  const taxes = taxesOf(b, plan.mix[0]);
  const appetite = appetiteOf(b);
  const bonds = trunc((outlay * plan.mix[1] * appetite) / 10000);
  const loans = trunc((outlay * Math.min(plan.mix[2], b.loanCap)) / 100);
  const print = trunc((outlay * plan.mix[3]) / 100);
  const balance = taxes + bonds + loans + print - outlay - interest;
  const left = b.treasury + balance;
  const shortfall = Math.max(0, -left);
  const printed = print + shortfall;
  const base = b.war ? trunc((b.prices * row.warPrices) / 1000) : 0;
  return {
    outlay,
    interest,
    taxes,
    bonds,
    loans,
    print,
    balance,
    appetite,
    shortfall,
    treasury: Math.max(0, left),
    debt: b.debt + bonds + loans,
    prices: Math.min(
      GW_PRICES_MAX,
      b.prices + base + printedPrices(b.tag, printed),
    ),
    ...driftOf(b, plan),
  };
}

/** What `gauges.money` reads: room to borrow, from the numbers behind it. */
export function moneyWord(b: GwBudgetBasis): number {
  const step = moneyStep(b.tag, b.prices);
  const load = loadOf(b);
  const heavy =
    (load >= GW_LOAD_HEAVY ? 1 : 0) + (load >= GW_LOAD_CRUSHING ? 1 : 0);
  return clampTo(trunc(b.treasury / step) - heavy, 0, 3);
}

/** One step of the gauge at today's prices. */
export function moneyStep(tag: string, prices: number): number {
  return Math.max(1, trunc((budgetRow(tag).step * prices) / 1000));
}

function moveShare(s: number[], to: number, n: number): void {
  let left = n;
  while (left > 0) {
    let from = -1;
    for (let i = 0; i < s.length; i++) {
      if (i !== to && s[i] > 0 && (from < 0 || s[i] > s[from])) from = i;
    }
    if (from < 0) return;
    s[from]--;
    s[to]++;
    left--;
  }
}

/** A line gets `delta` points out of the fattest others; never a line below 0. */
export function tilted(
  shares: readonly number[],
  line: GwBudgetLine,
  delta: number,
): number[] {
  const out = [...shares];
  const i = GW_BUDGET_LINES.indexOf(line);
  if (delta >= 0) {
    moveShare(out, i, delta);
    return out;
  }
  const give = Math.min(-delta, out[i]);
  const others = out.flatMap((_, x) => (x === i ? [] : [x]));
  for (let k = 0; k < give; k++) {
    out[i]--;
    out[others[k % others.length]]++;
  }
  return out;
}

/** What the plain gauges want, the same for the finance holder and the AI. */
export function budgetDraft(
  b: GwBudgetBasis,
  gauges: Readonly<Record<GwGauge, number>>,
): GwBudgetPlan {
  const row = budgetRow(b.tag);
  let shares = [...budgetNorm(b.tag, b.war)];
  if (b.war) {
    if (gauges.shells <= 1) shares = tilted(shares, "army", 4);
    if (gauges.bread <= 1) shares = tilted(shares, "relief", 4);
    if (gauges.order <= 1) shares = tilted(shares, "works", 3);
  }
  const rate = b.war ? row.warTax : 100;
  const blank = { shares, mix: [rate, 0, 0, 0] };
  const y = budgetYear(b, blank);
  const slack = b.war ? row.slack * moneyStep(b.tag, b.prices) : 0;
  const gap = y.outlay + y.interest - y.taxes - slack;
  if (gap <= 0 || y.outlay === 0) return blank;
  const loans = b.war ? Math.min(row.loanDraft, b.loanCap) : 0;
  const rest = gap - trunc((y.outlay * loans) / 100);
  const fromBonds = trunc((rest * row.bondShare) / 100);
  const bonds = clampTo(
    trunc((fromBonds * 10000) / (y.outlay * y.appetite)),
    0,
    GW_RAISE_MAX,
  );
  const sold = trunc((y.outlay * bonds * y.appetite) / 10000);
  const print = clampTo(
    trunc(((rest - sold) * 100) / y.outlay),
    0,
    GW_RAISE_MAX,
  );
  return { shares, mix: [rate, bonds, loans, print] };
}

/** Whole, in range and summing to 100. */
export function budgetValid(plan: GwBudgetPlan): boolean {
  return (
    plan.shares.length === GW_BUDGET_LINES.length &&
    plan.mix.length === 4 &&
    plan.shares.every((x) => x >= 0) &&
    plan.shares.reduce((a, x) => a + x, 0) === 100 &&
    plan.mix[0] >= GW_TAX_MIN &&
    plan.mix[0] <= GW_TAX_MAX &&
    plan.mix.slice(1).every((x) => x >= 0 && x <= GW_RAISE_MAX)
  );
}

export interface GwBudgetVote {
  /** What the bill does to their mood, added to their standing. */
  score: number;
  secondScore: number;
  pass: boolean;
  /** Why it went up or down; text gw.budget.vote.<key>. */
  why: readonly string[];
}

/** How this plan goes down with those who must pass it. No hidden term. */
export function budgetVote(
  body: GwBudgetBody | null,
  inst: Readonly<Partial<Record<GwInstitution, number>>>,
  b: GwBudgetBasis,
  plan: GwBudgetPlan,
): GwBudgetVote {
  if (body === null) return { score: 0, secondScore: 0, pass: true, why: [] };
  const norm = budgetNorm(b.tag, b.war);
  const off = (l: GwBudgetLine) => {
    const i = GW_BUDGET_LINES.indexOf(l);
    return plan.shares[i] - norm[i];
  };
  const why: string[] = [];
  let mood = 0;
  const say = (delta: number, key: string) => {
    mood += delta;
    why.push(key);
  };
  if (b.rally) say(RALLY, "rally");
  if (plan.mix[0] >= 170) say(-2, "taxes_heavy");
  else if (plan.mix[0] >= 130 && plan.mix[0] > budgetRow(b.tag).warTax) {
    say(-1, "taxes_up");
  }
  if (off("relief") + off("works") >= 5) say(1, "home_up");
  if (off("army") >= 8) say(-1, "army_up");
  if (off("national") >= 3) say(1, "national_up");
  if (off("national") <= -3) say(-1, "national_down");
  if (loadOf(b) >= GW_LOAD_HEAVY) say(-1, "load");
  if (b.prices >= 2000) say(-1, "prices");
  const score = (inst[body.inst] ?? 0) + mood;
  const second = body.second;
  const secondScore =
    second === undefined ? 0 : (inst[second.inst] ?? 0) + mood;
  const pass =
    score >= body.need && (second === undefined || secondScore >= second.need);
  return { score, secondScore, pass, why };
}

/** The numbers a country opens with, June 1914. */
export function budgetStart(tag: string, money: number): GwBudgetState {
  const row = budgetRow(tag);
  return {
    treasury: money * row.step + trunc(row.step / 2),
    debt: row.debt,
    prices: 1000,
    rate: 100,
    plan: { shares: [...row.peace], mix: [100, 0, 0, 0] },
    draft: null,
    meeting: null,
    refused: false,
    last: "none",
    lastChapter: -9,
    outbreak: false,
    warPlan: false,
    drift: { shells: 0, bread: 0, morale: 0, order: 0, sea: 0 },
    lent: {},
    asked: {},
    shutUntil: -1,
    crisis: -99,
    notes: [],
  };
}
