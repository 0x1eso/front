// World War 1936 P6 (P6 spec §7): the arms market and licences. Prices are
// final (plan Task 1 Step 8); lane M fills the …Block bodies (Task 4).
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

/** Refusal of market_buy (plan decision 40). M fills. */
export function marketBuyBlock(
  i: MarketBuyInput,
): "listing_bad" | "embargoed" | "no_partner" | "no_civs" | null {
  return "listing_bad";
}

export interface LicenceInput {
  atWar: boolean;
  embargoed: boolean;
  senderHas: boolean;
  exists: boolean;
  count: number;
  obsolete: boolean;
  transferable: boolean;
}

/** Refusal of licence_request (plan decision 40). M fills. */
export function licenceBlock(
  i: LicenceInput,
): "licence_exists" | "embargoed" | "no_partner" | "lines_full" | null {
  return "no_partner";
}
