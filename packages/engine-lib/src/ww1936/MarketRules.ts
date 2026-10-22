// World War 1936 P6 (P6 spec §7): the arms market and licences. Prices are
// final (plan Task 1 Step 8); lane M filled the …Block bodies and the year
// helpers the licence surcharge and the market discount read (Task 4).
import { AIR_TYPES, AirType } from "@openfront/engine-api/ww1936/AirTypes";
import { WW_MAX_LICENCES } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  EQUIPMENT_GENS,
  EquipmentType,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { EQUIPMENT } from "./Equipment";
import { planeGenTechs } from "./PlaneStats";
import { WW_TECHS } from "./WwTechs";

export function marketDiscountPct(yearsOld: number): number {
  return yearsOld <= 1 ? 100 : yearsOld <= 3 ? 75 : 50;
}

export function marketPriceMilli(
  costMilli: number,
  yearsOld: number,
  count: number,
): number {
  return Math.floor((costMilli * count * marketDiscountPct(yearsOld)) / 100);
}

/** Spec §7.2: civilian factories handed over for 30 days (1 factory = 5 construction a day). */
export function marketCivs(priceMilli: number): number {
  return Math.max(1, Math.ceil(priceMilli / 150_000));
}

const AIR: ReadonlySet<string> = new Set<string>(AIR_TYPES);

/** The techs that open a static generation (an aircraft's pair, spec P4 §12.2). */
export function staticGenTechs(type: EquipmentType, gen: number): WwTechId[] {
  if (AIR.has(type)) return planeGenTechs(type as AirType, gen);
  const t = EQUIPMENT[type].techs[gen - 1];
  return t === undefined ? [] : [t];
}

/** Spec §7.1–§7.2: a static generation's year — its newest tech's (1936 without one). */
export function staticKeyYear(type: EquipmentType, gen: number): number {
  let y = 1936;
  for (const t of staticGenTechs(type, gen)) {
    y = Math.max(y, WW_TECHS[t]?.year ?? 1936);
  }
  return y;
}

/** A static generation its techs open (a type without techs: always). */
export function staticGenResearched(
  type: EquipmentType,
  gen: number,
  researched: ReadonlySet<WwTechId>,
): boolean {
  return staticGenTechs(type, gen).every((t) => researched.has(t));
}

/** The newest year of `type`'s generations the techs open; 0 when none. */
export function newestStaticYear(
  type: EquipmentType,
  researched: ReadonlySet<WwTechId>,
): number {
  let y = 0;
  for (let g = 1; g <= EQUIPMENT_GENS[type]; g++) {
    if (staticGenResearched(type, g, researched)) {
      y = Math.max(y, staticKeyYear(type, g));
    }
  }
  return y;
}

/** Spec §7.2: whole years an item is older than the newest of its line (never below 0). */
export function marketYearsOld(year: number, newest: number): number {
  return Math.max(0, newest - year);
}

export interface MarketBuyInput {
  listingExists: boolean;
  own: boolean;
  count: number;
  available: number;
  atWar: boolean;
  embargoed: boolean;
  route: boolean;
  freeCivs: number;
  civs: number;
}

/**
 * Refusal of market_buy (plan decision 40, spec §7.2): a live listing of
 * someone else with that many units; P5 lend-lease's conditions (not at
 * war, no embargo, a way for the goods); the buyer's free civilian
 * factories cover the payment.
 */
export function marketBuyBlock(
  i: MarketBuyInput,
): "listing_bad" | "embargoed" | "no_partner" | "no_civs" | null {
  if (!i.listingExists || i.own) return "listing_bad";
  if (!(i.count >= 1) || i.count > i.available) return "listing_bad";
  if (i.embargoed) return "embargoed";
  if (i.atWar || !i.route) return "no_partner";
  if (i.freeCivs < i.civs) return "no_civs";
  return null;
}

export interface LicenceInput {
  atWar: boolean;
  embargoed: boolean;
  senderHas: boolean;
  exists: boolean;
  count: number;
  obsolete: boolean;
  transferable: boolean;
  /**
   * Lane M (spec §7.1): the fee is a civilian factory outside the faction
   * and the requester has none free. Optional: a screen without the number
   * leaves it out.
   */
  civsShort?: boolean;
}

/**
 * Refusal of licence_request (plan decision 40, spec §7.1): one licence
 * (or request) per item and partner; no embargo; not at war; the sender
 * builds it itself (a static generation's techs, a design that is its own
 * and not obsolete) and it may cross borders; at most WW_MAX_LICENCES
 * received; the fee payable.
 */
export function licenceBlock(
  i: LicenceInput,
):
  | "licence_exists"
  | "embargoed"
  | "no_partner"
  | "lines_full"
  | "no_civs"
  | null {
  if (i.exists) return "licence_exists";
  if (i.embargoed) return "embargoed";
  if (i.atWar || !i.senderHas || i.obsolete || !i.transferable) {
    return "no_partner";
  }
  if (i.count >= WW_MAX_LICENCES) return "lines_full";
  if (i.civsShort === true) return "no_civs";
  return null;
}
