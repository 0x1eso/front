// Great War 1914 (ww200/ww201): the production step. Shells, bread and money
// come from what a country makes and holds, not from flat ticks. Each chapter
// it gives a list of terms, [key, points a year] (100 = a gauge step a year),
// for each of the three; the budget's flow adds the shells and bread terms to
// the budget drift it already runs and the money terms to the treasury, so
// one accumulator moves the gauges and says why (Budget.flow, applyDrift).
//
// At war: the land held, by worth (EconRows), own land in full, annexed land
// at three quarters, occupied land by how hard it is ruled, land on a live
// front at half again, less a quarter for each step of resistance; the
// seasons and the year's harvest; grain by sea against the blockade and the
// U-boats; men drawn from the farms; the fronts' consumption; the shell
// crisis, after which industry mobilises; tribute from vassals and new
// states. In peace (and under an armistice) the stores refill to the
// country's usual level and stop there; tribute and the taxes of land gained
// or lost go on.
import type {
  GwNationState,
  GwSide,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GW_GAUGE_MAX,
  GW_LINES,
  GW_SEA_MAX,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GW_BUDGET_LINES,
  type GwBudgetLine,
} from "@openfront/engine-api/ww1914/GwBudget";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  GW_ECON_GAUGES,
  type GwEconGauge,
  type GwEconState,
} from "@openfront/engine-api/ww1914/GwEcon";
import {
  GW_PLACE_KEYS,
  GW_PLACES,
  type GwPlace,
} from "@openfront/engine-api/ww1914/GwPlaces";
import { budgetNorm } from "@openfront/engine-lib/ww1914/BudgetRules";
import {
  econPerUnit,
  econRow,
  GW_ECON,
  GW_HUNGARIAN_GRAIN,
  placeWorth,
} from "@openfront/engine-lib/ww1914/EconRows";
import { GW_FRONT_LAND } from "@openfront/engine-lib/ww1914/FrontLand";
import {
  GW_ARMY_ORDERS,
  GW_OWNER_OFF,
} from "@openfront/engine-lib/ww1914/MoneyRows";
import { civilFromDays } from "@openfront/engine-lib/ww1936/Calendar";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { warMonths } from "./Eras";
import type { GreatWar } from "./GreatWar";
import { holderOf } from "./Land";
import { officeHolder } from "./People";
import { endStrain } from "./Strain";
import { GW_GAUGES_1914 } from "./Tables";
import { memberEnd } from "./Wars";
import { chapterOf, monthsFrom, news, seatsOf } from "./World";

/** One cause: a reason key (gw.line.<key>) and its points a year. */
export type GwEconTerm = readonly [key: string, points: number];
export type GwEconTerms = Record<GwEconGauge, GwEconTerm[]>;

const P_HARVEST = idHash("gw_harvest");

const trunc = Math.trunc;

/** A country that fights now: the war's terms run for it. */
export function econAtWar(gw: GreatWar, n: GwNationState): boolean {
  return !n.out && n.atWar.length > 0 && gw.s.armistice === null;
}

/** The level a gauge refills to in peace: June 1914's, never above 2. */
export function peaceLevel(tag: GwTag, g: "shells" | "bread"): number {
  return Math.min(2, GW_GAUGES_1914[tag]?.[g] ?? 2);
}

// ---- The land ----

interface Holding {
  /** Works and fields of its own land (and its annexed land), in per-cent worth. */
  ind: number;
  grain: number;
  /** Hungary's share of `grain`. */
  hungary: number;
  /** Of occupied land. */
  heldInd: number;
  heldGrain: number;
  /** Money worth (ind + grain) of land gained: annexed, occupied. */
  gained: number;
  levied: number;
  /** Money worth of its own 1914 land someone else holds. */
  lost: number;
}

const blank = (): Holding => ({
  ind: 0,
  grain: 0,
  hungary: 0,
  heldInd: 0,
  heldGrain: 0,
  gained: 0,
  levied: 0,
  lost: 0,
});

/** Places on a live front: the line's land and the next line's. */
function frontPlaces(gw: GreatWar): Set<GwPlace> {
  const out = new Set<GwPlace>();
  if (gw.s.armistice !== null) return out;
  for (const t of gw.s.theatres) {
    if (!t.open || t.id === "sea") continue;
    const lines = GW_LINES[t.id];
    for (const i of [t.line, t.line + 1]) {
      const land = GW_FRONT_LAND[t.id][lines[i] ?? ""];
      for (const p of land?.central ?? []) out.add(p);
      for (const p of land?.entente ?? []) out.add(p);
    }
  }
  return out;
}

/** Percent a held place of another country counts for its holder. */
function heldPct(
  gw: GreatWar,
  by: GwTag,
  p: GwPlace,
): { pct: number; annexed: boolean } {
  const of = GW_PLACES[p].owner;
  const rec = (gw.s.fates ?? []).find((r) => r.place === p);
  const row = (gw.s.rule ?? []).find((r) => r.by === by && r.of === of);
  const resist = row?.resist ?? 0;
  const annexed =
    rec !== undefined &&
    rec.to === by &&
    (rec.fate === "annex" || rec.fate === "ally");
  if (annexed) {
    return { pct: Math.max(0, GW_ECON.annexPct - 25 * resist), annexed };
  }
  const hard = Math.max(0, Math.min(3, row?.hard ?? 1));
  return { pct: Math.max(0, GW_ECON.occupyPct[hard] - 25 * resist), annexed };
}

/** What every country holds this chapter, by worth. */
function holdings(gw: GreatWar): Map<GwTag, Holding> {
  const out = new Map<GwTag, Holding>();
  const get = (t: GwTag) => {
    let h = out.get(t);
    if (h === undefined) out.set(t, (h = blank()));
    return h;
  };
  const front = frontPlaces(gw);
  // A new state's and a vassal's land is its own.
  const ownAll = new Set(
    gw.s.nations
      .filter((n) => n.client !== undefined || n.vassal !== undefined)
      .map((n) => n.tag),
  );
  for (const p of GW_PLACE_KEYS) {
    const worth = placeWorth(p);
    const owner = GW_PLACES[p].owner;
    const holder = holderOf(gw, p);
    const f = front.has(p) ? GW_ECON.frontPct : 100;
    const h = get(holder);
    if (holder === owner || ownAll.has(holder)) {
      h.ind += worth.ind * f;
      h.grain += worth.grain * f;
      if (GW_HUNGARIAN_GRAIN.includes(GW_PLACES[p].group)) {
        h.hungary += worth.grain * f;
      }
    } else {
      const { pct, annexed } = heldPct(gw, holder, p);
      const k = trunc((pct * f) / 100);
      const money = (worth.ind + worth.grain) * k;
      if (annexed) {
        h.ind += worth.ind * k;
        h.grain += worth.grain * k;
        h.gained += money;
      } else {
        h.heldInd += worth.ind * k;
        h.heldGrain += worth.grain * k;
        h.levied += money;
      }
    }
    if (holder !== owner) get(owner).lost += (worth.ind + worth.grain) * 100;
  }
  return out;
}

let cache: { gw: GreatWar; chapter: number; map: Map<GwTag, Holding> } | null =
  null;

function holdingOf(gw: GreatWar, tag: GwTag): Holding {
  if (cache?.gw !== gw || cache.chapter !== gw.s.chapter) {
    cache = { gw, chapter: gw.s.chapter, map: holdings(gw) };
  }
  return cache.map.get(tag) ?? blank();
}

/** Drops the chapter's holdings (a test that moves land mid-chapter). */
export function econForget(): void {
  cache = null;
}

// ---- The seasons ----

/** Percent of the fields' yield this chapter brings: the harvest, then spring. */
function seasonPct(gw: GreatWar): number {
  const mid = gw.s.day + (chapterOf(gw).spanDays >> 1);
  const m = civilFromDays(mid).month;
  if (m >= 8 && m <= 10) return GW_ECON.seasonPct[0];
  if (m >= 11 || m === 1) return GW_ECON.seasonPct[1];
  return GW_ECON.seasonPct[2];
}

/** The harvest year's luck for a side: bad, 125 good, else 100 (percent). */
function harvestPct(gw: GreatWar, side: GwSide | null): number {
  const d = civilFromDays(gw.s.day + (chapterOf(gw).spanDays >> 1));
  const year = d.month >= 8 ? d.year : d.year - 1;
  const roll =
    wwRoll(gw.s.seed, P_HARVEST, year, side === "central" ? 1 : 0) % 100;
  if (roll < GW_ECON.badPct) return GW_ECON.badYield;
  return roll >= GW_ECON.goodFrom ? 125 : 100;
}

// ---- Tribute ----

/** What a vassal or a new state sends its overlord, points a year. */
function tributeOut(
  gw: GreatWar,
  k: GwNationState,
): { by: GwTag; bread: number; money: number } | null {
  const tie = k.vassal ?? k.client;
  if (tie === undefined || k.out) return null;
  const resist = k.vassal?.resist ?? 0;
  const base =
    k.vassal !== undefined ? GW_ECON.vassalTribute : GW_ECON.clientTribute;
  const pct = trunc(
    (base * Math.max(0, Math.min(3, tie.loyalty)) * (100 - 25 * resist)) / 300,
  );
  if (pct <= 0) return null;
  const h = holdingOf(gw, k.tag);
  const unit = econPerUnit(k.tag);
  return {
    by: tie.by,
    bread: trunc((h.grain * unit.grain * pct) / 10000),
    money: trunc(((h.ind + h.grain) * GW_ECON.landMoney * pct) / 10000),
  };
}

// ---- The terms ----

const push = (out: GwEconTerm[], key: string, v: number) => {
  const pts = trunc(v);
  if (pts !== 0) out.push([key, pts]);
};

/** Shells burnt on the fronts it holds, and on a strained end more. */
function frontsUse(gw: GreatWar, n: GwNationState): number {
  let use = 0;
  for (const t of gw.s.theatres) {
    if (!t.open || t.id === "sea") continue;
    const end = memberEnd(gw, t.id, n.tag);
    if (end === null) continue;
    use += GW_ECON.frontPerBand * (n.strength[t.id] ?? 1);
    if (endStrain(t, end) >= GW_ECON.strainHigh) use += GW_ECON.frontStrained;
  }
  return (use * econRow(n.tag).guns) / 100;
}

/** ww209: the running budget's line off the country's war norm. */
function offOf(n: GwNationState, line: GwBudgetLine): number {
  const i = GW_BUDGET_LINES.indexOf(line);
  return n.budget.plan.shares[i] - budgetNorm(n.tag, true)[i];
}

/** ww209 (§1): Britain's national share pays the allies' subsidies, a year. */
const SUBSIDY_SHELLS = 30;
/** ww209 (§1): Russia's national share mends the railways, a year a point. */
const RAIL_MENDS = 10;

function warTerms(gw: GreatWar, n: GwNationState, out: GwEconTerms): void {
  const s = gw.s;
  const row = econRow(n.tag);
  const unit = econPerUnit(n.tag);
  const h = holdingOf(gw, n.tag);
  const e = n.econ;
  // Shells: the works, less with strikes; held works; mobilised; fronts.
  const unrest = 100 - GW_ECON.unrestPct * Math.min(4, n.unrest);
  const works = (h.ind * unit.ind * unrest) / 10000;
  push(out.shells, "econ_industry", works);
  push(out.shells, "econ_held", (h.heldInd * unit.ind) / 100);
  // ww209 (§1): the army line's war orders: the works run to what is bought.
  push(
    out.shells,
    "budget_orders",
    (works * offOf(n, "army") * GW_ARMY_ORDERS) / 1000,
  );
  // ww209 (§1): Britain's subsidies put shells in the allies' hands.
  const gbr = gw.nation("GBR");
  if (
    n.tag !== "GBR" &&
    gbr !== null &&
    n.side === "entente" &&
    n.side === gbr.side
  ) {
    const pay = offOf(gbr, "national");
    if (pay > 0) push(out.shells, "budget_subsidy", pay * SUBSIDY_SHELLS);
  }
  if (e?.mobilised !== null && e?.mobilised !== undefined) {
    push(out.shells, "econ_mobilised", (works * row.mob) / 100);
  }
  // Guns fire freely from full stores and are rationed from empty ones.
  const fire = GW_ECON.fireAt[Math.min(3, n.gauges.shells)];
  push(out.shells, "econ_fronts", -(frontsUse(gw, n) * fire) / 100);
  const blockaded =
    n.side === "central" && gw.nation("GBR")?.side === "entente";
  if (blockaded && s.blockade >= GW_ECON.blockadeShells) {
    push(out.shells, "shells_blockade", -GW_ECON.blockadeShellsLoss);
  }
  // Bread: the fields by the season and the year, Hungary's half, held land.
  const season = seasonPct(gw);
  const year = harvestPct(gw, n.side);
  const fields = (h.grain * unit.grain * season) / 10000;
  push(out.bread, "econ_farms", (fields * Math.max(100, year)) / 100);
  if (year < 100) {
    push(out.bread, "bread_bad_harvest", -(fields * (100 - year)) / 100);
  }
  // ww209 (§1): Hungary's quota cut, Budapest holds its grain back too.
  const cut =
    n.tag === "AUH" &&
    ((n.inst.hungary ?? 0) < 2 || offOf(n, "national") <= -GW_OWNER_OFF);
  if (cut) {
    const held = h.hungary * unit.grain * season * year * GW_ECON.hungaryHeld;
    push(out.bread, "bread_two_halves", -held / 100000000);
  }
  push(
    out.bread,
    "rule_requisition",
    (h.heldGrain * unit.grain * season) / 10000,
  );
  // Grain by sea, against the blockade (the central side) or the U-boats.
  push(out.bread, "econ_imports", row.imports);
  if (blockaded) {
    push(out.bread, "bread_blockade", -(row.imports * s.blockade) / GW_SEA_MAX);
  }
  if (n.side === "entente" && (n.tag === "GBR" || row.imports >= 100)) {
    const share = n.tag === "GBR" ? 100 : 50;
    const sunk = (row.imports * s.shipping * share) / (GW_SEA_MAX * 100);
    push(out.bread, "bread_uboats", -sunk);
  }
  push(out.bread, "econ_labour", -(row.labour * (100 - n.manpower)) / 100);
  if (row.rail !== undefined && warMonths(gw) >= row.rail.from) {
    const hot = s.threads.includes("rus_rail") && n.tag === "RUS";
    // ww209 (§1): Russia's national share goes on the railways.
    const mend =
      n.tag === "RUS" ? Math.max(0, offOf(n, "national")) * RAIL_MENDS : 0;
    const loss = Math.max(0, row.rail.loss + (hot ? 100 : 0) - mend);
    push(out.bread, "bread_rail", -loss);
  }
  // Full stores are eaten freely, empty ones rationed.
  const ration = GW_ECON.eatAt[Math.min(3, n.gauges.bread)];
  push(out.bread, "econ_eaters", -(row.eaters * ration) / 100);
  const trade = blockaded ? s.blockade : n.side === "entente" ? s.shipping : 0;
  // Money: trade, cut by the blockade or the U-boats, and the works' taxes.
  const taxed = (works * GW_ECON.worksMoney) / 100;
  push(
    out.money,
    "econ_trade",
    (row.trade * (GW_SEA_MAX - trade)) / GW_SEA_MAX + taxed,
  );
  // A full treasury goes on war orders: the ministries spend what they have.
  if (n.gauges.money >= GW_GAUGE_MAX.money) {
    push(out.money, "money_war_costs", -GW_ECON.fullSpend);
  }
}

function peaceTerms(gw: GreatWar, n: GwNationState, out: GwEconTerms): void {
  for (const g of ["shells", "bread"] as const) {
    if (n.gauges[g] < peaceLevel(n.tag, g)) {
      push(out[g], "econ_peace", GW_ECON.peaceRefill);
    }
  }
  // A table's term of military government keeps its requisition (ww198).
  const h = holdingOf(gw, n.tag);
  const term = (gw.s.rule ?? []).some(
    (r) => r.by === n.tag && r.until !== undefined,
  );
  if (term) {
    const unit = econPerUnit(n.tag);
    push(out.bread, "rule_requisition", (h.heldGrain * unit.grain) / 100);
  }
}

/** The chapter's terms for a country, points a year, each with its key. */
export function econTerms(gw: GreatWar, n: GwNationState): GwEconTerms {
  const out: GwEconTerms = { shells: [], bread: [], money: [] };
  if (econAtWar(gw, n)) warTerms(gw, n, out);
  else peaceTerms(gw, n, out);
  // Land gained and lost: taxes, in peace too.
  const h = holdingOf(gw, n.tag);
  push(out.money, "econ_land", (h.gained * GW_ECON.landMoney) / 100);
  push(out.money, "rule_levy", (h.levied * GW_ECON.landMoney) / 100);
  push(out.money, "econ_land_lost", -(h.lost * GW_ECON.landLost) / 100);
  // Tribute, both ways.
  for (const k of gw.s.nations) {
    const t = tributeOut(gw, k);
    if (t === null) continue;
    if (t.by === n.tag) {
      push(out.bread, "econ_tribute", t.bread);
      push(out.money, "econ_tribute", t.money);
    }
    if (k === n) {
      push(out.bread, "econ_tribute_paid", -t.bread);
      push(out.money, "econ_tribute_paid", -t.money);
    }
  }
  return out;
}

export const sumOf = (terms: readonly GwEconTerm[]): number =>
  terms.reduce((a, [, v]) => a + v, 0);

/**
 * The largest term in the direction of `net`, the budget's drift counted as
 * one term under its own key. "" when nothing moves it.
 */
export function whyOf(
  terms: readonly GwEconTerm[],
  net: number,
  budget: GwEconTerm | null,
): string {
  let best = 0;
  let key = "";
  for (const [k, v] of budget === null ? terms : [...terms, budget]) {
    if (k !== "" && v * net > 0 && Math.abs(v) > best) {
      best = Math.abs(v);
      key = k;
    }
  }
  return key;
}

// ---- The state it keeps ----

export function econState(n: GwNationState): GwEconState {
  n.econ ??= {
    rate: { shells: 0, bread: 0, money: 0 },
    why: { shells: "", bread: "", money: "" },
    moved: [],
    dry: null,
    mobilised: null,
  };
  return n.econ;
}

/** Months from the first shell crisis to mobilised industry, 4..8. */
function mobDelay(gw: GreatWar, n: GwNationState): number {
  let m = GW_ECON.mobMonths;
  if (n.ai === "hardline") m--;
  if (n.ai === "cautious" || n.ai === "principled") m++;
  for (const seat of seatsOf(gw, n.tag)) {
    const skill = officeHolder(gw, seat, "war")?.competence[2] ?? 2;
    m += skill === 3 ? -2 : skill === 1 ? 2 : 0;
    break;
  }
  return Math.max(4, Math.min(8, m));
}

/** Months bread must stay at 1 or less before a country counts as hungry. */
export const HUNGRY_MONTHS = 6;

/**
 * Hunger that makes a war's lead think of stopping (ww201 merge): bread gone,
 * or bread low for half a year. A lean month or two after a bad harvest is not
 * enough. By state: how long it has been short, never the date.
 */
export function hungry(gw: GreatWar, n: GwNationState): boolean {
  if (n.gauges.bread === 0) return true;
  const lean = n.econ?.lean;
  return (
    n.gauges.bread <= 1 &&
    lean !== undefined &&
    monthsFrom(gw, lean) >= HUNGRY_MONTHS
  );
}

/** The shell crisis by state (decision 3): dry once, mobilised months later. */
export function econCrisis(gw: GreatWar, n: GwNationState): void {
  if (!econAtWar(gw, n)) {
    if (n.econ?.lean !== undefined) delete n.econ.lean;
    return;
  }
  const e = econState(n);
  if (n.gauges.bread > 1) delete e.lean;
  else e.lean ??= gw.s.chapter;
  if (e.dry === null && n.gauges.shells === 0) e.dry = gw.s.chapter;
  if (
    e.dry !== null &&
    e.mobilised === null &&
    monthsFrom(gw, e.dry) >= mobDelay(gw, n)
  ) {
    e.mobilised = gw.s.chapter;
    news(gw, "econ_mobilised", n.tag);
  }
}

/**
 * What the step did this chapter: its rates, causes and moves (`movedKey`:
 * the reason line the move was written with).
 */
export function econRecord(
  gw: GreatWar,
  n: GwNationState,
  g: GwEconGauge,
  rate: number,
  why: string,
  moved: number,
  movedKey: string,
): void {
  const e = econState(n);
  e.rate[g] = trunc(rate);
  e.why[g] = why;
  const from = gw.s.chapter - 2;
  e.moved = e.moved.filter((m) => m.chapter >= from);
  if (moved !== 0) {
    const m = { gauge: g, delta: moved, key: movedKey, chapter: gw.s.chapter };
    e.moved.push(m);
  }
}

/** For tests and the tune lane: the gauges the step feeds, their max. */
export const GW_ECON_MAX: Readonly<Record<GwEconGauge, number>> =
  Object.fromEntries(GW_ECON_GAUGES.map((g) => [g, GW_GAUGE_MAX[g]])) as Record<
    GwEconGauge,
    number
  >;
