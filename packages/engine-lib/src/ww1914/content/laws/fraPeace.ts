// ww207 (W-FRA): France's new bills: the peace years' debates (`peace: true`:
// they open while France is not at war, before the war, if she stays out, and
// after the armistice, and their terms keep working after it), the wartime
// postponement of the 1918 election, and the six factions' exclusive laws
// that a utopia tree's node brings into the book (`exclusive`,
// content/utopia/fra.ts). Rows join FRA_LAWS in ./fra.ts; the house's sides
// are in content/house/fra.ts; text in resources/ww1914/ko/FRA.laws.json.
//
// Checked (web, this lane): the Chamber voted women's suffrage on 20 May 1919
// (344 to 97; the Assemblée's own page gives 329 to 95) and the Senate refused
// to take up its articles on 21 November 1922 (156 to 134), the Radical
// senators fearing the clerical vote; the 1919 election (16 November) ran
// under the list law of 12 July 1919; the 1914 Chamber sat on to 1919. The
// Radicals pressed "défense laïque" bills up to 1914 after the bishops
// condemned some fifteen school books (September 1909).
// From memory (F): the eight-hour day law of 23 April 1919; the English week
// for the clothing trades (11 June 1917); Barrès's "suffrage des morts" for
// war widows and mothers (1916); the Méline tariff (1892); the 1886 law that
// exiled the heads of the former reigning families; Clémentel's economic
// regions (1919); the socialists' capital levy (1920s); the CGT's
// "nationalisation industrialisée" (1918-19); Sarraut's colonial plan (1921);
// the école unique (Compagnons de l'Université nouvelle, 1918); the decree
// powers the war cabinets asked for (Briand, 1916-17). How the 1914 Chamber's
// term was carried past 1918 is not found: `fra_law_postpone` is the game's.
import type { GwAxisPush } from "@openfront/engine-api/ww1914/GwSociety";
import type { GwEffect } from "@openfront/engine-api/ww1914/SceneDsl";
import { all, not } from "@openfront/engine-api/ww1914/SceneDsl";
import type { GwLawDraft, GwLawRow } from "../../LawRows";
import { leaderOf } from "../house/kit";
import { draft, gauge, held, inst, lawTalk, person, since, war } from "./kit";

const row = (r: Omit<GwLawRow, "tag">): GwLawRow => ({ ...r, tag: "FRA" });
/** A text with its axis push (design §2: every text moves the country). */
const t = (
  id: string,
  support: number,
  effects: GwEffect[],
  axes: GwAxisPush,
): GwLawDraft => ({ ...draft(id, support, [], effects), axes });
const peace = not(war);
const always = since("1914-06");
/** A faction's node law: in the book only once its tree's own node `law` is open (S2). */
const node = (faction: string, n: string) => ({ faction, node: n });

export const FRA_PEACE_LAWS: readonly GwLawRow[] = [
  // ---- The war's one: the 1918 election put off ----
  row({
    id: "fra_law_postpone",
    chapter: "franchise",
    opens: all(war, since("1917-06")),
    lean: 1,
    decree: false,
    cast: { int: held("interior") },
    draft: [
      t("whole_war", 1, [gauge("order", 1), inst("chamber", -1)], {
        rule: -1,
      }),
      t("one_year", 0, [gauge("order", 1)], { rule: -1 }),
      t("soldiers_vote", -1, [inst("chamber", 1), gauge("order", -1)], {
        rule: 1,
      }),
    ],
    passed: [],
    passedTell: [],
    term: [],
    flag: "f_fra_law_postpone",
    repeal: { authority: 10, tell: [], effects: [inst("chamber", 1)] },
    talk: lawTalk("fra_law_postpone", {
      who: person("fra_deschanel"),
      ask: "frank",
      push: "cold",
      tell: [],
      price: [inst("chamber", 1)],
      wins: 2,
    }),
  }),
  // ---- The peace years' debates ----
  row({
    id: "fra_law_eight_hours",
    chapter: "social",
    peace: true,
    opens: peace,
    lean: -1,
    decree: false,
    cast: { pm: held("chancellor") },
    draft: [
      t("eight_hours", -1, [gauge("order", 1), gauge("money", -1)], {
        class: 1,
      }),
      t("by_trade", 0, [gauge("order", 1)], { class: 1, rule: -1 }),
      t("english_week", 1, [], { class: 1, church: -1 }),
    ],
    passed: [gauge("morale", 1)],
    passedTell: [],
    term: [
      { gauge: "order", delta: 1, every: 12 },
      { gauge: "shells", delta: -1, every: 12, text: ["eight_hours"] },
    ],
    flag: "f_fra_law_eight_hours",
    repeal: { authority: 15, tell: [], effects: [gauge("order", -2)] },
    talk: lawTalk("fra_law_eight_hours", {
      who: person("fra_jouhaux"),
      ask: "frank",
      push: "cold",
      tell: [],
      price: [gauge("money", -1)],
      wins: 2,
    }),
  }),
  row({
    id: "fra_law_women_vote",
    chapter: "franchise",
    peace: true,
    opens: all(peace, since("1914-08")),
    lean: -1,
    decree: false,
    cast: { int: held("interior") },
    draft: [
      {
        ...t("full_vote", -1, [inst("chamber", 1)], { rule: 1, church: -1 }),
        franchise: { chamber: "chambre", to: "equal" },
      },
      t("local_only", 0, [], { rule: 1 }),
      t("war_widows", 1, [gauge("morale", 1)], { rule: -1, church: -1 }),
    ],
    passed: [],
    passedTell: [],
    term: [{ gauge: "morale", delta: 1, every: 14 }],
    flag: "f_fra_law_women_vote",
    repeal: { authority: 20, tell: [], effects: [gauge("order", -1)] },
    talk: lawTalk("fra_law_women_vote", {
      who: leaderOf("fra_catholics"),
      ask: "warm",
      push: "cold",
      tell: [],
      price: [inst("senate", -1)],
      wins: 2,
    }),
  }),
  row({
    id: "fra_law_lay_school",
    chapter: "schools",
    peace: true,
    opens: peace,
    lean: 0,
    decree: false,
    cast: { pm: held("chancellor") },
    draft: [
      t("defend_school", 0, [gauge("order", -1)], { church: 1 }),
      t("attendance", 1, [], { church: 1, rule: 1 }),
      t("school_truce", 0, [gauge("order", 1)], { church: -1 }),
    ],
    passed: [],
    passedTell: [],
    term: [
      {
        gauge: "order",
        delta: -1,
        every: 12,
        offset: 4,
        text: ["defend_school"],
      },
      { gauge: "morale", delta: 1, every: 12, text: ["school_truce"] },
    ],
    flag: "f_fra_law_lay_school",
    repeal: { authority: 10, tell: [], effects: [gauge("order", 1)] },
    talk: lawTalk("fra_law_lay_school", {
      who: person("fra_bourgeois"),
      ask: "frank",
      push: "cold",
      tell: [],
      price: [inst("senate", 1)],
      wins: 2,
    }),
  }),
  row({
    id: "fra_law_grain",
    chapter: "land",
    peace: true,
    opens: peace,
    lean: 0,
    decree: false,
    cast: { agr: held("agriculture") },
    draft: [
      t("wheat_duty", 1, [gauge("money", 1)], { class: -1 }),
      t("farm_credit", 0, [gauge("money", -1)], { class: 1 }),
      t("consolidation", 0, [], { class: -1, rule: 1 }),
    ],
    passed: [],
    passedTell: [],
    term: [
      { gauge: "bread", delta: 1, every: 12, text: ["farm_credit"] },
      { gauge: "bread", delta: 1, every: 18, text: ["consolidation"] },
      { gauge: "money", delta: 1, every: 12, text: ["wheat_duty"] },
    ],
    flag: "f_fra_law_grain",
    repeal: { authority: 10, tell: [], effects: [gauge("order", -1)] },
    talk: lawTalk("fra_law_grain", {
      who: leaderOf("fra_fed_rep"),
      ask: "warm",
      push: "cold",
      tell: [],
      price: [inst("senate", 1)],
      wins: 2,
    }),
  }),
  row({
    id: "fra_law_capital_levy",
    chapter: "tax",
    peace: true,
    opens: all(peace, since("1914-08")),
    lean: -2,
    decree: false,
    cast: { fin: held("finance") },
    draft: [
      t("levy", -1, [gauge("money", 2), inst("senate", -1)], { class: 1 }),
      t("inheritance", 0, [gauge("money", 1)], { class: 1 }),
      t("turnover", 1, [gauge("money", 1), gauge("morale", -1)], {
        class: -1,
      }),
    ],
    passed: [],
    passedTell: [],
    term: [
      { gauge: "money", delta: 1, every: 10 },
      { gauge: "order", delta: -1, every: 14, offset: 6, text: ["levy"] },
      { gauge: "morale", delta: -1, every: 14, text: ["turnover"] },
    ],
    flag: "f_fra_law_capital_levy",
    repeal: { authority: 15, tell: [], effects: [gauge("money", -1)] },
    talk: lawTalk("fra_law_capital_levy", {
      who: leaderOf("fra_sfio"),
      ask: "frank",
      push: "cold",
      tell: [],
      price: [inst("chamber", 1)],
      wins: 2,
    }),
  }),
  row({
    id: "fra_law_regions",
    chapter: "local",
    peace: true,
    opens: peace,
    lean: 0,
    decree: false,
    cast: { int: held("interior") },
    draft: [
      t("economic_regions", 1, [], { class: -1 }),
      t("elected_councils", -1, [inst("chamber", 1)], { rule: 1 }),
      t("prefects_stay", 1, [gauge("order", 1)], { rule: -1 }),
    ],
    passed: [],
    passedTell: [],
    term: [
      { gauge: "money", delta: 1, every: 16, text: ["economic_regions"] },
      { gauge: "order", delta: 1, every: 16, text: ["prefects_stay"] },
    ],
    flag: "f_fra_law_regions",
    repeal: { authority: 10, tell: [], effects: [] },
    talk: lawTalk("fra_law_regions", {
      who: person("fra_barres"),
      ask: "warm",
      push: "frank",
      tell: [],
      price: [inst("countersign", -1)],
      wins: 2,
    }),
  }),
  // ---- The factions' node laws (exclusive) ----
  row({
    id: "fra_law_free_school",
    chapter: "schools",
    exclusive: node("fra_radicals", "law"),
    opens: always,
    lean: 0,
    decree: false,
    cast: { pm: held("chancellor") },
    draft: [
      t("free_lycee", 0, [gauge("money", -1)], { church: 1, class: 1 }),
      t("scholarships", 1, [], { church: 1 }),
      t("one_school", -1, [gauge("order", -1)], { church: 1, rule: 1 }),
    ],
    passed: [gauge("morale", 1)],
    passedTell: [],
    term: [{ gauge: "money", delta: -1, every: 16 }],
    flag: "f_fra_law_free_school",
    repeal: { authority: 15, tell: [], effects: [gauge("morale", -1)] },
    talk: lawTalk("fra_law_free_school", {
      who: leaderOf("fra_radicals"),
      ask: "warm",
      push: "cold",
      tell: [],
      price: [inst("senate", -1)],
      wins: 2,
    }),
  }),
  row({
    id: "fra_law_nationalise",
    chapter: "labour",
    exclusive: node("fra_sfio", "law"),
    opens: always,
    lean: -2,
    decree: false,
    cast: { pm: held("chancellor") },
    draft: [
      t("railways", -1, [gauge("money", -1)], { class: 1 }),
      t("mines_and_rails", -2, [gauge("money", -2), inst("senate", -1)], {
        class: 1,
        rule: 1,
      }),
      t("mixed_boards", 0, [], { class: 1 }),
    ],
    passed: [],
    passedTell: [],
    term: [
      { gauge: "shells", delta: 1, every: 10 },
      { gauge: "order", delta: 1, every: 12, text: ["mixed_boards"] },
    ],
    flag: "f_fra_law_nationalise",
    repeal: { authority: 20, tell: [], effects: [gauge("order", -1)] },
    talk: lawTalk("fra_law_nationalise", {
      who: person("fra_thomas"),
      ask: "frank",
      push: "cold",
      tell: [],
      price: [inst("chamber", 1)],
      wins: 2,
    }),
  }),
  row({
    id: "fra_law_colonies",
    chapter: "tax",
    exclusive: node("fra_left_rep", "law"),
    opens: always,
    lean: 1,
    decree: false,
    cast: { fin: held("finance") },
    draft: [
      t("ports_and_rails", 1, [gauge("money", -1)], { class: -1 }),
      t("colonial_troops", 0, [], { class: -1, rule: -1 }),
      t("native_councils", -1, [], { rule: 1 }),
    ],
    passed: [],
    passedTell: [],
    term: [
      { gauge: "money", delta: 1, every: 12, text: ["ports_and_rails"] },
      { gauge: "manpower", delta: 1, every: 8, text: ["colonial_troops"] },
    ],
    flag: "f_fra_law_colonies",
    repeal: { authority: 10, tell: [], effects: [] },
    talk: lawTalk("fra_law_colonies", {
      who: person("fra_doumergue"),
      ask: "warm",
      push: "cold",
      tell: [],
      price: [inst("chamber", -1)],
      wins: 2,
    }),
  }),
  row({
    id: "fra_law_congregations",
    chapter: "schools",
    exclusive: node("fra_catholics", "law"),
    opens: always,
    lean: 1,
    decree: false,
    cast: { pm: held("chancellor") },
    draft: [
      t("orders_return", 0, [gauge("order", -1)], { church: -1 }),
      t("free_teaching", -1, [inst("chamber", -1)], {
        church: -1,
        rule: -1,
      }),
      t("veterans_monks", 1, [gauge("morale", 1)], { church: -1 }),
    ],
    passed: [],
    passedTell: [],
    term: [{ gauge: "morale", delta: 1, every: 14 }],
    flag: "f_fra_law_congregations",
    repeal: { authority: 15, tell: [], effects: [gauge("morale", -1)] },
    talk: lawTalk("fra_law_congregations", {
      who: person("fra_cochin"),
      ask: "warm",
      push: "cold",
      tell: [],
      price: [inst("senate", -1)],
      wins: 2,
    }),
  }),
  row({
    id: "fra_law_exile",
    chapter: "franchise",
    exclusive: node("fra_af", "law"),
    opens: always,
    lean: 2,
    decree: false,
    cast: { int: held("interior") },
    draft: [
      t("repeal_exile", 0, [gauge("order", -1)], { rule: -1 }),
      t("duke_returns", -1, [gauge("order", -2), inst("chamber", -1)], {
        rule: -1,
        church: -1,
      }),
      t("sons_serve", 1, [gauge("morale", 1)], { rule: -1 }),
    ],
    passed: [],
    passedTell: [],
    term: [{ gauge: "order", delta: -1, every: 12, offset: 3 }],
    flag: "f_fra_law_exile",
    repeal: { authority: 10, tell: [], effects: [gauge("order", 1)] },
    talk: lawTalk("fra_law_exile", {
      who: person("fra_daudet"),
      ask: "frank",
      push: "cold",
      tell: [],
      price: [gauge("order", -1)],
      wins: 2,
    }),
  }),
  row({
    id: "fra_law_full_powers",
    chapter: "siege",
    exclusive: node("fra_tiger", "law"),
    opens: always,
    lean: 1,
    decree: false,
    cast: { pm: held("chancellor") },
    draft: [
      t("decree_powers", 0, [inst("chamber", -1), gauge("order", 1)], {
        rule: -1,
      }),
      t("six_months", 1, [gauge("order", 1)], { rule: -1 }),
      t("with_commission", 0, [inst("senate", 1)], { rule: 1 }),
    ],
    passed: [],
    passedTell: [],
    term: [
      { gauge: "order", delta: 1, every: 10 },
      { gauge: "shells", delta: 1, every: 12, text: ["decree_powers"] },
    ],
    flag: "f_fra_law_full_powers",
    repeal: { authority: 15, tell: [], effects: [inst("chamber", 1)] },
    talk: lawTalk("fra_law_full_powers", {
      who: person("fra_mandel"),
      ask: "cold",
      push: "frank",
      tell: [],
      price: [inst("chamber", -1)],
      wins: 2,
    }),
  }),
];
