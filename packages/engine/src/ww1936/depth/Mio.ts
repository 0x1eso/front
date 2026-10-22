// P6 lane M (plan Task 4): military industrial organisations (spec §6).
// Each family has one archetype at a time; every archetype keeps its own
// funds and traits (state `mio`: arch[f], fundsMilli[f * 3 + a],
// traits[f * 3 + a], investReady[f] = the first day of the next invest,
// sizeSeen[f] = the current archetype's size last announced). Funds come
// from yesterday's line output of the family (P1 lines; the dockyards for
// the naval family). The traits are country-wide stats (spec §6.3 "효과의
// 자리"). Names are titles only (decisions.md: no company names).
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import {
  MIO_ARCHETYPES,
  MIO_FAMILIES,
  MIO_FREE_TRAIT,
  MIO_INVEST_COOLDOWN_DAYS,
  MIO_INVEST_MILLI,
  MIO_INVEST_PP,
  MIO_MAX_SIZE,
  MIO_SWITCH_PP,
  MIO_TRAITS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  EQUIP_KEYS,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WwStats } from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  mioFamilyOf,
  mioPoints,
  mioSize,
  mioStats,
  mioTraitBlock,
} from "@openfront/engine-lib/ww1936/MioRules";
import { payPp } from "../politics/PayPp";
import type { CountryDepth, WwDepth } from "./WwDepth";

/** Spec §6.2: the funds of the largest size (size 10 at 33,000 industry); no more is kept. */
export const MIO_FUNDS_CAP_MILLI = 300_000 * MIO_MAX_SIZE * (MIO_MAX_SIZE + 1);

const NAVAL = MIO_FAMILIES.indexOf("mio_naval");

/** Spec §6.1: the family of a line's EQUIP_KEYS index (a plane design by its airframe), -1 none. */
export function mioFamilyOfKey(d: WwDepth, id: number, key: number): number {
  const k = EQUIP_KEYS[key];
  if (k === undefined) return -1;
  const [type, gen] = k;
  if (type === "plane_design") {
    return mioFamilyOf(type, d.designSlot(id, "plane", gen)?.def.base);
  }
  return mioFamilyOf(type);
}

/** Spec §6.2: yesterday's industry (milli) of each family's lines; the naval family the dockyards'. */
export function mioOutputMilli(d: WwDepth, id: number): number[] {
  const out = new Array<number>(MIO_FAMILIES.length).fill(0);
  const ce = d.ww.economy.country(id);
  if (ce === null) return out;
  for (const line of ce.lines) {
    if (line.lastOutput <= 0) continue;
    const f = mioFamilyOfKey(d, id, line.key);
    if (f >= 0) out[f] += line.lastOutput;
  }
  for (const nl of ce.navalLines) {
    if (nl.lastOutput > 0) out[NAVAL] += nl.lastOutput;
  }
  return out;
}

/** The current archetype's funds of a family (0 without one). */
export function mioFundsOf(c: CountryDepth, f: number): number {
  const a = c.mio.arch[f];
  return a < 0 ? 0 : c.mio.fundsMilli[f * 3 + a];
}

/** The current archetype's trait bits of a family (0 without one). */
export function mioTraitsOf(c: CountryDepth, f: number): number {
  const a = c.mio.arch[f];
  return a < 0 ? 0 : c.mio.traits[f * 3 + a];
}

/** Spec §6.2: trait points left on a family's current archetype. */
export function mioPointsOf(c: CountryDepth, f: number): number {
  const a = c.mio.arch[f];
  if (a < 0) return 0;
  return mioPoints(
    mioSize(c.mio.fundsMilli[f * 3 + a]),
    c.mio.traits[f * 3 + a],
    a,
  );
}

/** Adds funds to a family's current archetype; a new size is announced (spec §20.11). */
function addFunds(
  d: WwDepth,
  c: CountryDepth,
  id: number,
  f: number,
  milli: number,
): void {
  const a = c.mio.arch[f];
  if (a < 0 || milli <= 0) return;
  const i = f * 3 + a;
  c.mio.fundsMilli[i] = Math.min(
    MIO_FUNDS_CAP_MILLI,
    c.mio.fundsMilli[i] + milli,
  );
  const size = mioSize(c.mio.fundsMilli[i]);
  if (size > c.mio.sizeSeen[f]) {
    c.mio.sizeSeen[f] = size;
    d.message(id, "ww1936_mio_size", { mio: MIO_FAMILIES[f], size });
    d.markStats(id);
    d.markCountry(id);
  }
}

/** The country turn (spec §6.2): each family with an archetype gains yesterday's output of its lines. */
export function dailyMio(d: WwDepth, id: number, day: number): void {
  void day;
  const c = d.country(id);
  if (c === null) return;
  if (c.mio.arch.every((a) => a < 0)) return;
  const out = mioOutputMilli(d, id);
  for (let f = 0; f < MIO_FAMILIES.length; f++) {
    if (out[f] > 0) addFunds(d, c, id, f, out[f]);
  }
}

/**
 * mio_pick (spec §6.1): the first archetype of a family is free, a switch
 * costs MIO_SWITCH_PP; the archetype's free trait is always held; the
 * other archetypes keep their funds and traits.
 */
export function mioPick(
  d: WwDepth,
  id: number,
  f: number,
  a: number,
): WwOrderBlock | null {
  const c = d.country(id);
  if (c === null) return "dead";
  if (!(f >= 0 && f < MIO_FAMILIES.length)) return "bad_index";
  if (!(a >= 0 && a < MIO_ARCHETYPES.length)) return "bad_index";
  const cur = c.mio.arch[f];
  if (cur === a) return "bad_index";
  if (cur >= 0) {
    if (!payPp(d.ww.politics, id, MIO_SWITCH_PP)) return "no_pp";
    d.ww.politics.markCountry(id);
  }
  c.mio.arch[f] = a;
  const i = f * 3 + a;
  c.mio.traits[i] |= 1 << MIO_FREE_TRAIT[a];
  // The archetype's own size is where it stands (no notice for a switch).
  c.mio.sizeSeen[f] = mioSize(c.mio.fundsMilli[i]);
  d.markStats(id);
  d.markCountry(id);
  return null;
}

/** mio_trait (spec §6.3): a point left, the row above held, p3 and q3 apart. */
export function mioTrait(
  d: WwDepth,
  id: number,
  f: number,
  t: number,
): WwOrderBlock | null {
  const c = d.country(id);
  if (c === null) return "dead";
  if (!(f >= 0 && f < MIO_FAMILIES.length)) return "bad_index";
  if (!(t >= 0 && t < MIO_TRAITS.length)) return "bad_index";
  const a = c.mio.arch[f];
  if (a < 0) return "prereq";
  const i = f * 3 + a;
  const block = mioTraitBlock(c.mio.traits[i], t, mioPointsOf(c, f));
  if (block !== null) return block;
  c.mio.traits[i] |= 1 << t;
  d.markStats(id);
  d.markCountry(id);
  return null;
}

/** mio_invest (spec §6.2): MIO_INVEST_PP for MIO_INVEST_MILLI of funds, once every 180 days a family. */
export function mioInvest(
  d: WwDepth,
  id: number,
  f: number,
  day: number,
): WwOrderBlock | null {
  const c = d.country(id);
  if (c === null) return "dead";
  if (!(f >= 0 && f < MIO_FAMILIES.length)) return "bad_index";
  const a = c.mio.arch[f];
  if (a < 0) return "prereq";
  if (day < c.mio.investReady[f]) return "decision_cooldown";
  // At the largest size the funds would be lost.
  if (c.mio.fundsMilli[f * 3 + a] >= MIO_FUNDS_CAP_MILLI) return "bad_index";
  if (!payPp(d.ww.politics, id, MIO_INVEST_PP)) return "no_pp";
  d.ww.politics.markCountry(id);
  c.mio.investReady[f] = day + MIO_INVEST_COOLDOWN_DAYS;
  addFunds(d, c, id, f, MIO_INVEST_MILLI);
  d.markCountry(id);
  return null;
}

/** mio_pick, mio_trait, mio_invest. */
export function issueMio(
  d: WwDepth,
  id: number,
  o: DepthOrder,
  tick: number,
): WwOrderBlock | null {
  switch (o.kind) {
    case "mio_pick":
      return mioPick(
        d,
        id,
        MIO_FAMILIES.indexOf(o.family),
        MIO_ARCHETYPES.indexOf(o.archetype),
      );
    case "mio_trait":
      return mioTrait(
        d,
        id,
        MIO_FAMILIES.indexOf(o.family),
        MIO_TRAITS.indexOf(o.trait),
      );
    case "mio_invest":
      return mioInvest(d, id, MIO_FAMILIES.indexOf(o.family), d.ww.day(tick));
    default:
      return "bad_index";
  }
}

/** Plan decision 24: every family's current archetype's traits as stats (spec §6.3). */
export function mioStatsOf(d: WwDepth, id: number): Partial<WwStats> {
  const c = d.country(id);
  if (c === null) return {};
  const out: Record<string, number> = {};
  for (let f = 0; f < MIO_FAMILIES.length; f++) {
    const a = c.mio.arch[f];
    if (a < 0) continue;
    const s = mioStats(f, c.mio.traits[f * 3 + a]) as Record<string, number>;
    for (const k of Object.keys(s)) out[k] = (out[k] ?? 0) + s[k];
  }
  return out as Partial<WwStats>;
}

/**
 * The screens' `mio` (WwDepth.detailOf; lane U4's DepthIndustryModel reads
 * one value per family): the current archetype's funds and traits per
 * family, and `investReady` 1 when an invest may be made on `day` (0 while
 * it cools down, at the largest size or without an archetype).
 */
export function mioDetailOf(
  d: WwDepth,
  id: number,
  day: number,
): {
  arch: number[];
  fundsMilli: number[];
  traits: number[];
  size: number[];
  points: number[];
  investReady: number[];
} {
  const c = d.country(id);
  const fam = MIO_FAMILIES.map((_, f) => f);
  if (c === null) {
    return {
      arch: fam.map(() => -1),
      fundsMilli: fam.map(() => 0),
      traits: fam.map(() => 0),
      size: fam.map(() => 0),
      points: fam.map(() => 0),
      investReady: fam.map(() => 0),
    };
  }
  return {
    arch: [...c.mio.arch],
    fundsMilli: fam.map((f) => mioFundsOf(c, f)),
    traits: fam.map((f) => mioTraitsOf(c, f)),
    size: fam.map((f) => (c.mio.arch[f] < 0 ? 0 : mioSize(mioFundsOf(c, f)))),
    points: fam.map((f) => mioPointsOf(c, f)),
    investReady: fam.map((f) =>
      c.mio.arch[f] >= 0 &&
      day >= c.mio.investReady[f] &&
      mioFundsOf(c, f) < MIO_FUNDS_CAP_MILLI
        ? 1
        : 0,
    ),
  };
}
