// ww207 (W-FRA): where each French bill text moves the country (design §2):
// notches on 권위 (-) ↔ 공화 (+) `rule`, 재산 (-) ↔ 노동 (+) `class`, 교회 (-)
// ↔ 세속 (+) `church`, one a bill (GW_AXIS_NOTCHES to a step). Every text of
// every FRA bill has a line here; `withAxes` puts it on the draft, and a text
// with none is a load-time error, so a new bill can't come in without one.
import type { GwAxisPush } from "@openfront/engine-api/ww1914/GwSociety";
import type { GwLawRow } from "../../LawRows";

export const FRA_AXES: Readonly<
  Record<string, Readonly<Record<string, GwAxisPush>>>
> = {
  // The state of siege: the army's reach is the authority side's.
  fra_law_siege: {
    war_zone: { rule: -1 },
    whole_country: { rule: -1, class: -1 },
    civil_courts: { rule: 1 },
  },
  // The three years were the nationalist revival's law (1913).
  fra_law_three_years: {
    keep_three: { rule: -1, church: -1 },
    thirty_months: { rule: -1 },
    two_years: { rule: 1, class: 1 },
  },
  fra_law_income_tax: {
    as_voted: { class: 1 },
    higher_bands: { class: 1, rule: 1 },
    caillaux_scale: { class: 1 },
  },
  fra_law_dalbiez: {
    review_boards: { rule: 1 },
    young_first: { rule: -1 },
    factory_lists: { class: -1 },
  },
  fra_law_labour: {
    strike_ban: { class: -1, rule: -1 },
    wage_boards: { class: 1 },
    shop_delegates: { class: 1, rule: 1 },
  },
  fra_law_war_profits: {
    half_excess: { class: 1 },
    full_excess: { class: 1, rule: 1 },
    contracts_only: { class: -1 },
  },
  fra_law_rents: {
    soldiers_families: { class: 1 },
    all_small_rents: { class: 1 },
    rent_boards: { class: 1, rule: 1 },
  },
  // Family allowances by children: the Catholic natalists' cause.
  fra_law_allowances: {
    needy_only: { class: -1 },
    every_family: { class: 1 },
    with_children: { church: -1 },
  },
  fra_law_censorship: {
    military_only: { rule: -1 },
    political_too: { rule: -1, class: -1 },
    white_spaces: { rule: 1 },
  },
  fra_law_supply_decrees: {
    penalties_only: { class: -1 },
    bread_cards: { class: 1, rule: -1 },
    chamber_reviews: { rule: 1 },
  },
  fra_law_navy: {
    full_programme: { rule: -1 },
    with_levy: { class: 1 },
    slower: { rule: 1 },
  },
  // Proportional representation: the right's and the socialists' cause
  // against the Radicals' arrondissements.
  fra_law_proportional: {
    list_vote: { rule: 1, church: -1 },
    majority_bonus: { rule: 1 },
    after_war: { rule: -1 },
  },
  fra_law_army_commission: {
    visit_front: { rule: 1 },
    papers_only: { rule: -1 },
    with_gqg_leave: { rule: -1 },
  },
  fra_law_amnesty: {
    strikers: { class: 1, rule: 1 },
    press_only: { rule: 1 },
    after_victory: { rule: -1 },
  },
  fra_war_aims: {
    alsace_back: { rule: -1 },
    rhine_guard: { rule: -1, class: -1 },
    no_annexation: { rule: 1, class: 1 },
  },
};

/** The row with each text's axis push from FRA_AXES (throws on a missing one). */
export function withAxes(row: GwLawRow): GwLawRow {
  const by = FRA_AXES[row.id] ?? {};
  return {
    ...row,
    draft: row.draft.map((d) => {
      const axes = d.axes ?? by[d.id];
      if (axes === undefined) {
        throw new Error(`FRA bill ${row.id} text ${d.id} has no axis push`);
      }
      return { ...d, axes };
    }),
  };
}
