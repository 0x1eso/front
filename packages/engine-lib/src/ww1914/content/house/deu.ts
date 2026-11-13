import type {
  GwCond,
  GwEffect,
  GwNode,
  GwOption,
  GwReply,
  GwScene,
  GwVariant,
} from "@openfront/engine-api/ww1914/SceneDsl";
import {
  all,
  any,
  assuming,
  flag,
  not,
  reason,
  role,
  setFlag,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import type {
  GwAskRow,
  GwBillRow,
  GwFactionRow,
  GwPlotRow,
  GwWant,
  GwWeakRow,
} from "../../HouseRows";
import type { GwLawRow } from "../../LawRows";
import { withAxes } from "../laws/deu";
import { either, gauge, held, inst, office, person } from "../laws/kit";
import {
  answerAsk,
  aroundUsed,
  beatPlot,
  cool,
  coolPlot,
  faction,
  heat,
  heatPlot,
  isLaw,
  leaderOf,
  low,
  plotConfirmed,
  plotHot,
  temper,
  under,
  warAge,
} from "./kit";

// DEU's house: factions, what they make of each bill, their own bills, and
// (S2) plots, weaknesses and allies' asks (ww158-format.md). Text in
// resources/ww1914/ko/DEU.house.json. The house itself (chambers, whip, way
// round) is in ./houses.ts and comes into play once this file has factions.

// ---- Words used only here ----
const war: GwCond = world({ is: "war" });
const until = (to: string): GwCond => world({ is: "date", to });
/** The bill is in the house now, with this text if one is named. */
const moving = (law: string, text?: string): GwCond =>
  world(
    text === undefined
      ? { is: "law", id: law, of: ["persuade", "vote"] }
      : { is: "law", id: law, of: ["persuade", "vote"], text },
  );
/** A desk decision taken within so many chapters. */
const lately = (scene: string, pick: string, within: number): GwCond => ({
  kind: "chose",
  scene,
  pick,
  within,
});
const seen = (scene: string): GwCond => ({ kind: "seen", scene });
const bloc = (b: GwFactionRow["bloc"], max: number): GwCond => ({
  kind: "bloc",
  bloc: b,
  max,
});
const atLeast = (g: "bread" | "order", min: number): GwCond => ({
  kind: "gauge",
  gauge: g,
  min,
});
const score = (o: { min?: number; max?: number }): GwCond =>
  world({ is: "score", ...o });
const uboats = (min: number): GwCond => world({ is: "uboat", min });
const unrest = (min: number): GwCond => world({ is: "unrest", min });
const holds = (
  o: "chief_of_staff" | "chancellor" | "navy" | "war",
  p: string,
): GwCond => ({
  kind: "holder",
  office: o,
  person: p,
});
/** ww203: a post for his man, named while the man is about and out of it. */
const postFor = (
  o: "chancellor" | "navy" | "war",
  p: string,
): Pick<GwWant, "kind" | "when" | "keep"> => ({
  kind: "post",
  when: all({ kind: "person_active", person: p }, not(holds(o, p))),
  keep: holds(o, p),
});
/** ww203: his amendment for the bill before the house (his `amends`). */
const amendOn = (...laws: string[]): GwCond =>
  any(...laws.map((l) => moving(l)));
/** ww203: his own bill joins the agenda, and stays there or passes. */
const nextOf = (law: string): Pick<GwWant, "kind" | "when" | "keep"> => ({
  kind: "next",
  when: all(not(isLaw(law)), not(moving(law))),
  keep: any(moving(law), isLaw(law)),
});
/** A price paid on the spot: the promise is kept the next chapter. */
const paid: GwCond = { kind: "chapter", min: 0 };
/** ww207: that node of the faction's tree is open (its exclusive law). */
const nodeOpen = (faction: string, node: string): GwCond =>
  world({ is: "node", id: faction, node });
const peaceTaken: GwCond = any(
  flag("f_resolution_taken"),
  isLaw("deu_peace_res"),
);
// ---- ww209 (W-DEU): money bills ----
const peace: GwCond = not(war);
/** The year's budget is on the agenda. */
const budgetOpen: GwCond = world({ is: "money", bill: "budget", now: "open" });
/** The SPD has split: the minority sits as its own party. */
const uspdIn: GwCond = world({ is: "faction", id: "deu_uspd", of: ["in"] });
/**
 * ww209: a line for his people in the budget (지역에 돈을 준다): named while
 * the budget is before the house and the earmark isn't in it; kept once the
 * budget running carries it.
 */
const markFor = (
  id: string,
  when?: GwCond,
): Pick<GwWant, "kind" | "when" | "keep" | "earmark" | "chapters"> => {
  const on = world({ is: "earmark", id });
  return {
    kind: "money",
    earmark: id,
    when:
      when === undefined
        ? all(budgetOpen, not(on))
        : all(budgetOpen, not(on), when),
    keep: on,
    chapters: 6,
  };
};

// ---- Factions ----

export const DEU_FACTIONS: readonly GwFactionRow[] = [
  {
    id: "deu_cons",
    tag: "DEU",
    // ww207: its Cornerstones (rule 왕권/의회, class 재산/노동, force 무력/협조).
    ideals: { rule: -1, class: -1, force: -1 },
    trust: 1,
    ability: "deu_pw_ab_cons",
    bloc: "court",
    start: "in",
    strength: 2,
    // ww203: the 1912 Reichstag: Conservatives 41, Reich Party 14, the
    // agrarian and anti-Semitic groups and independents 20 (Wikipedia, 1912).
    seats: { reichstag: 75 },
    leaders: [{ person: "deu_i_westarp" }],
    radical: "deu_i_heydebrand",
    grows: [
      { when: score({ min: 20 }), by: 1, every: 6, key: "cons_winning" },
      { when: uboats(2), by: 1, every: 8, key: "cons_uboat" },
      { when: low("morale", 1), by: -1, every: 8, key: "cons_weary" },
    ],
    feeds: [
      { when: moving("deu_three_class"), key: "franchise_moving" },
      { when: moving("deu_parl_gov"), key: "reform_moving" },
      {
        when: lately("deu_k_peace_resolution", "accept_text", 6),
        key: "peace_text",
        by: 2,
      },
      { when: bloc("court", -3), key: "court_turned" },
    ],
    cools: [{ when: score({ min: 30 }), key: "victories" }],
    camps: ["hard"],
    steps: [
      { at: 4, scene: "deu_f_cons_2" },
      { at: 8, scene: "deu_f_cons_3" },
    ],
    bills: ["deu_war_aims"],
    amends: {
      deu_three_class: "plural_vote",
      deu_aux: "army_text",
      deu_censor: "generals_keep",
      deu_war_aims: "east_and_west",
    },
    // ww209: every war credit; a tax on estates and inheritance, never (they
    // brought Bülow down over the inheritance tax in 1909).
    purse: [
      { when: war, bill: "credits", side: 1 },
      { taxes: { property: -1 } },
    ],
    wants: [
      { id: "east_prussia", ...markFor("deu_east_prussia", war) },
      { id: "aims_next", ...nextOf("deu_war_aims"), chapters: 10 },
      {
        id: "cons_text",
        kind: "concession",
        when: amendOn("deu_three_class", "deu_aux", "deu_censor"),
      },
      {
        id: "grain_price",
        kind: "money",
        effects: [gauge("bread", -1), heat("deu_spd", 1)],
        keep: paid,
      },
      // The Conservatives stood by Tirpitz after March 1916 (memory, check).
      { id: "tirpitz_back", ...postFor("navy", "deu_tirpitz"), chapters: 6 },
    ],
    // The Fatherland Party is the desk's (deu_h_fatherland_party); here the
    // conservative benches go over to it.
    joins: {
      with: [],
      when: all(warAge(18), any(peaceTaken, seen("deu_h_fatherland_party"))),
      into: "deu_fatherland",
      parts: world({ is: "armistice" }),
      scene: "deu_f_fatherland",
    },
  },
  {
    id: "deu_natlib",
    tag: "DEU",
    ideals: { rule: 0, class: -1, force: -1 },
    trust: 1,
    ability: "deu_pw_ab_natlib",
    bloc: "business",
    start: "in",
    strength: 2,
    seats: { reichstag: 45 },
    leaders: [
      { person: "deu_i_bassermann", when: until("1917-07") },
      { person: "deu_stresemann" },
    ],
    grows: [
      { when: uboats(2), by: 1, every: 8, key: "natlib_uboat" },
      {
        when: flag("f_programme_full"),
        by: 1,
        every: 12,
        key: "natlib_programme",
      },
      { when: low("money", 0), by: -1, every: 8, key: "natlib_money" },
    ],
    feeds: [
      { when: bloc("business", -3), key: "business_turned" },
      { when: low("money", 0), key: "loans_fail" },
      { when: moving("deu_strike_ban", "arbitration"), key: "arbitration" },
    ],
    cools: [{ when: uboats(2), key: "uboat_on" }],
    steps: [
      { at: 4, scene: "deu_f_natlib_2" },
      { at: 8, scene: "deu_f_natlib_3" },
    ],
    amends: {
      deu_strike_ban: "courts_only",
      deu_three_class: "plural_vote",
      deu_take_back: "committee",
    },
    // ww209: every war credit; the navy over the norm (the Navy Laws' party).
    purse: [
      { when: war, bill: "credits", side: 1, lines: { navy: 1 } },
      { lines: { navy: 1 } },
    ],
    wants: [
      { id: "uboat_yards", ...markFor("deu_uboat_yards", war) },
      {
        id: "industry_heard",
        kind: "promise",
        when: any(moving("deu_aux"), moving("deu_strike_ban")),
        effects: [heat("deu_spd", 1)],
        keep: paid,
      },
      {
        id: "natlib_text",
        kind: "concession",
        when: amendOn("deu_strike_ban", "deu_three_class", "deu_take_back"),
      },
      // Stresemann worked for Bülow's return in July 1917 (memory, check).
      {
        id: "buelow_chancellor",
        ...postFor("chancellor", "deu_buelow"),
        chapters: 8,
      },
      {
        id: "aims_word",
        kind: "promise",
        when: not(isLaw("deu_war_aims")),
        keep: isLaw("deu_war_aims"),
        chapters: 10,
        // ww209: the aims now, not after the war.
        terms: ["session", "half"],
      },
      {
        id: "loan_terms",
        kind: "money",
        effects: [gauge("money", -1)],
        keep: paid,
      },
      // ww209: Stresemann's vote now, his bill to be named later.
      { id: "natlib_favour", kind: "favour" },
    ],
  },
  {
    id: "deu_centre",
    tag: "DEU",
    ideals: { rule: 1, class: 0, force: 1 },
    ability: "deu_pw_ab_centre",
    bloc: "parliament",
    start: "in",
    strength: 3,
    seats: { reichstag: 90 },
    leaders: [
      { person: "deu_erzberger" },
      { person: "deu_i_spahn", when: until("1917-06") },
      { person: "deu_i_fehrenbach" },
    ],
    grows: [
      { when: peaceTaken, by: 1, every: 12, key: "centre_peace" },
      { when: low("bread", 0), by: -1, every: 8, key: "centre_bread" },
    ],
    feeds: [
      { when: bloc("parliament", -3), key: "parliament_turned" },
      {
        when: all(low("bread", 0), not(isLaw("deu_food_office"))),
        key: "bavaria_hungry",
      },
      {
        when: lately("deu_k_peace_resolution", "dissolve", 8),
        key: "house_dissolved",
        by: 2,
      },
    ],
    cools: [
      {
        when: lately("deu_k_interparty", "receive_them", 6),
        key: "majority_received",
      },
      {
        when: lately("deu_k_interparty", "send_chancellor", 4),
        key: "chancellor_came",
      },
    ],
    camps: ["moderate"],
    steps: [
      { at: 4, scene: "deu_f_centre_2" },
      { at: 8, scene: "deu_f_centre_3" },
    ],
    bills: ["deu_peace_res", "deu_take_back", "deu_jesuits"],
    amends: {
      deu_aux: "unions_text",
      deu_strike_ban: "arbitration",
      deu_food_office: "food_dictator",
      deu_jesuits: "whole_law",
    },
    // ww209: not fixed on the money: the house's swing. Its works line (the
    // towns, the farm credit); a war profits tax (the majority's 1916 tax).
    purse: [{ lines: { works: 1 }, taxes: { profits: 1 } }],
    wants: [
      { id: "farm_credit", ...markFor("deu_farm_credit") },
      {
        id: "centre_text",
        kind: "concession",
        when: amendOn("deu_aux", "deu_strike_ban", "deu_food_office"),
      },
      {
        id: "peace_word",
        kind: "promise",
        when: not(peaceTaken),
        keep: peaceTaken,
        chapters: 8,
        terms: ["session", "half"],
      },
      { id: "jesuits_next", ...nextOf("deu_jesuits"), chapters: 10 },
      // The majority took Hertling, a Centre man, in November 1917.
      {
        id: "hertling_chancellor",
        ...postFor("chancellor", "deu_hertling"),
        chapters: 8,
      },
      {
        id: "catholic_bread",
        kind: "money",
        effects: [gauge("money", -1)],
        keep: paid,
      },
      // ww209: Erzberger trades: his votes now, a favour owed him later.
      { id: "erzberger_favour", kind: "favour" },
    ],
  },
  {
    id: "deu_progress",
    tag: "DEU",
    ideals: { rule: 1, class: -1, force: 1 },
    ability: "deu_pw_ab_progress",
    bloc: "parliament",
    start: "in",
    strength: 2,
    seats: { reichstag: 41 },
    leaders: [{ person: "deu_i_payer" }],
    grows: [
      {
        when: flag("f_franchise_word"),
        by: 1,
        every: 12,
        key: "progress_franchise",
      },
      { when: low("morale", 1), by: 1, every: 12, key: "progress_weary" },
    ],
    feeds: [
      { when: bloc("parliament", -3), key: "parliament_turned" },
      {
        when: lately("deu_k_peace_resolution", "dissolve", 8),
        key: "house_dissolved",
        by: 2,
      },
      { when: { kind: "censor", min: 2 }, key: "censor_strict" },
    ],
    cools: [
      {
        when: lately("deu_k_interparty", "receive_them", 6),
        key: "majority_received",
      },
    ],
    camps: ["moderate"],
    steps: [
      { at: 4, scene: "deu_f_progress_2" },
      { at: 8, scene: "deu_f_progress_3" },
    ],
    bills: ["deu_parl_gov", "deu_three_class"],
    amends: {
      deu_three_class: "equal_vote",
      deu_censor: "reichstag_reads",
      deu_parl_gov: "answer",
    },
    // ww209: every war credit; a direct tax on property (with the 1913
    // Wehrbeitrag's majority).
    purse: [
      { when: war, bill: "credits", side: 1 },
      { taxes: { property: 1 } },
    ],
    wants: [
      {
        id: "franchise_word",
        kind: "promise",
        when: not(isLaw("deu_three_class")),
        keep: any(flag("f_franchise_word"), isLaw("deu_three_class")),
        chapters: 8,
      },
      {
        id: "progress_text",
        kind: "concession",
        when: amendOn("deu_three_class", "deu_censor", "deu_parl_gov"),
      },
      { id: "committee_seat", ...nextOf("deu_parl_gov"), chapters: 10 },
      // Haußmann and Payer's man in October 1918.
      {
        id: "max_chancellor",
        ...postFor("chancellor", "deu_max_baden"),
        chapters: 8,
      },
      {
        id: "liberal_press",
        kind: "promise",
        effects: [{ kind: "censor", delta: -1 }],
        keep: paid,
      },
    ],
  },
  {
    id: "deu_spd",
    tag: "DEU",
    ideals: { rule: 1, class: 1, force: 0 },
    trust: -1,
    ability: "deu_pw_ab_spd",
    bloc: "workers",
    start: "in",
    strength: 3,
    seats: { reichstag: 110 },
    leaders: [{ person: "deu_ebert" }, { person: "deu_scheidemann" }],
    grows: [
      {
        when: all(low("bread", 0), warAge(24)),
        by: -1,
        every: 6,
        key: "spd_bread",
      },
      { when: isLaw("deu_unions"), by: 1, every: 12, key: "spd_unions" },
    ],
    feeds: [
      { when: bloc("workers", -3), key: "workers_turned" },
      {
        when: lately("deu_p_arrest_list", "enforce", 8),
        key: "comrades_held",
        by: 2,
      },
      {
        when: all(low("bread", 0), not(isLaw("deu_bread_cards"))),
        key: "bread_gone",
      },
      {
        when: moving("deu_strike_ban", "corps_commanders"),
        key: "strike_ban_army",
      },
    ],
    cools: [
      { when: atLeast("bread", 2), key: "bread_enough" },
      {
        when: lately("deu_k_interparty", "receive_them", 6),
        key: "majority_received",
      },
    ],
    steps: [
      { at: 4, scene: "deu_f_spd_2" },
      { at: 8, scene: "deu_f_spd_3" },
    ],
    bills: ["deu_unions", "deu_three_class"],
    amends: {
      deu_aux: "unions_text",
      deu_strike_ban: "arbitration",
      deu_three_class: "equal_vote",
      deu_censor: "reichstag_reads",
    },
    // ww209: "Diesem System keinen Mann und keinen Groschen" (Wilhelm
    // Liebknecht, 1887): no Reich budget in peace. From 4 Aug 1914 the
    // majority voted every credit (78:14 in the caucus); its left is the wing.
    purse: [
      { when: peace, bill: "budget", side: -1 },
      { when: war, bill: "credits", side: 1 },
    ],
    // ww209: the minority, Haase's. It read the party's yes on 4 Aug 1914
    // against its own vote in the caucus; on 21 Dec 1915 about 20 voted no in
    // the house (the FES chronicle: 19 of the caucus's 45 noes); Haase and 17
    // more voted against the emergency budget on 24 Mar 1916 and were put out
    // of the group (the Arbeitsgemeinschaft, later the USPD).
    wing: {
      person: "deu_haase",
      ideals: { rule: 1, class: 1, force: 1 },
      share: 2,
      when: not(uspdIn),
      into: "deu_uspd",
      wants: [
        {
          id: "haase_peace",
          kind: "promise",
          when: not(peaceTaken),
          keep: peaceTaken,
          chapters: 8,
          terms: ["session", "half"],
        },
        {
          id: "haase_meetings",
          kind: "promise",
          effects: [{ kind: "censor", delta: -1 }, heat("deu_ohl", 1)],
          keep: paid,
        },
      ],
    },
    wants: [
      { id: "war_families", ...markFor("deu_war_families", war) },
      {
        id: "spd_text",
        kind: "concession",
        when: amendOn("deu_aux", "deu_strike_ban", "deu_three_class"),
      },
      { id: "unions_next", ...nextOf("deu_unions"), chapters: 8 },
      {
        id: "franchise_word",
        kind: "promise",
        when: not(isLaw("deu_three_class")),
        keep: any(flag("f_franchise_word"), isLaw("deu_three_class")),
        chapters: 10,
        // ww209: the Easter Message's "after the war" (Apr 1917) was not
        // enough for the party.
        terms: ["session", "half"],
      },
      // The unions trusted Groener at the War Office, 1916-17 (memory).
      { id: "groener_war", ...postFor("war", "deu_groener"), chapters: 6 },
      {
        id: "war_aid",
        kind: "money",
        effects: [gauge("money", -1)],
        keep: paid,
      },
      {
        id: "amnesty",
        kind: "promise",
        effects: [heat("deu_ohl", 1)],
        keep: paid,
      },
    ],
    // The desk's report of the twenty votes (deu_h_spd_split) is the first
    // crack; the new party comes when the state says so.
    splits: {
      when: any(
        all(seen("deu_h_spd_split"), warAge(24)),
        all(warAge(18), temper("deu_spd", 2)),
      ),
      into: "deu_uspd",
      takes: 1,
      seats: { reichstag: 18 },
      scene: "deu_f_uspd",
    },
  },
  {
    id: "deu_uspd",
    tag: "DEU",
    ideals: { rule: 1, class: 1, force: 1 },
    trust: -2,
    bloc: "workers",
    start: "out",
    strength: 1,
    // ww203: the eighteen of the Arbeitsgemeinschaft, March 1916.
    seats: { reichstag: 18 },
    leaders: [{ person: "deu_haase" }, { person: "deu_i_ledebour" }],
    radical: "deu_i_ledebour",
    grows: [
      { when: low("bread", 0), by: 1, every: 6, key: "uspd_bread" },
      { when: unrest(1), by: 1, every: 6, key: "uspd_unrest" },
      { when: atLeast("bread", 2), by: -1, every: 8, key: "uspd_fed" },
    ],
    feeds: [
      { when: bloc("workers", -3), key: "workers_turned" },
      {
        when: lately("deu_p_arrest_list", "enforce", 8),
        key: "comrades_held",
        by: 2,
      },
      {
        when: lately("deu_h_liebknecht_may", "court_martial", 6),
        key: "liebknecht_court",
      },
      { when: uboats(2), key: "uboat_war" },
    ],
    cools: [
      {
        when: lately("deu_k_peace_resolution", "accept_text", 6),
        key: "peace_heard",
      },
    ],
    steps: [
      { at: 4, scene: "deu_f_uspd_2" },
      { at: 8, scene: "deu_f_uspd_3" },
    ],
    bills: ["deu_peace_res"],
    amends: { deu_peace_res: "no_annex" },
    // ww209: no credit and no war budget, ever (from the Notetat of 1916).
    purse: [
      { bill: "credits", side: -1 },
      { when: war, bill: "budget", side: -1 },
    ],
    wants: [
      { id: "peace_text", ...nextOf("deu_peace_res"), chapters: 8 },
      {
        id: "uspd_text",
        kind: "concession",
        when: amendOn("deu_peace_res"),
      },
      {
        id: "amnesty",
        kind: "promise",
        effects: [heat("deu_ohl", 1)],
        keep: paid,
      },
      {
        id: "meetings_free",
        kind: "promise",
        effects: [{ kind: "censor", delta: -1 }, heat("deu_ohl", 1)],
        keep: paid,
      },
    ],
    splits: {
      when: all(temper("deu_uspd", 2), any(unrest(1), low("order", 1))),
      into: "deu_spartacus",
      takes: 1,
      scene: "deu_f_spartacus",
    },
  },
  {
    id: "deu_spartacus",
    tag: "DEU",
    ideals: { rule: 0, class: 1, force: 1 },
    trust: -3,
    bloc: "workers",
    start: "out",
    strength: 1,
    seats: {},
    leaders: [{ person: "deu_liebknecht" }, { person: "deu_i_jogiches" }],
    grows: [
      { when: low("order", 1), by: 1, every: 6, key: "sparta_order" },
      { when: unrest(2), by: 1, every: 6, key: "sparta_unrest" },
    ],
    feeds: [
      { when: low("bread", 0), key: "bread_gone" },
      {
        when: lately("deu_h_liebknecht_may", "court_martial", 8),
        key: "liebknecht_court",
        by: 2,
      },
    ],
    cools: [{ when: atLeast("order", 3), key: "order_holds" }],
    steps: [
      { at: 4, scene: "deu_f_spartacus_2" },
      { at: 8, scene: "deu_f_spartacus_3" },
      { at: 12, scene: "deu_f_spartacus_4" },
    ],
    plot: "deu_pl_red",
  },
  {
    id: "deu_minor",
    tag: "DEU",
    ideals: { rule: 1, class: 0, force: 1 },
    trust: -1,
    bloc: "parliament",
    start: "in",
    strength: 1,
    // ww203: Poles 18, Alsace-Lorraine 9, Guelphs 5, the Dane 1.
    seats: { reichstag: 33 },
    leaders: [{ person: "deu_i_seyda" }],
    grows: [
      { when: flag("f_poland_kingdom"), by: 1, every: 12, key: "minor_poland" },
    ],
    feeds: [
      {
        when: { kind: "pressure", topic: "alsace", min: 3 },
        key: "alsace_pressed",
      },
      {
        when: moving("deu_alsace", "to_prussia"),
        key: "alsace_to_prussia",
        by: 2,
      },
    ],
    cools: [
      { when: moving("deu_alsace", "federal_state"), key: "alsace_hope" },
    ],
    steps: [
      { at: 4, scene: "deu_f_minor_2" },
      { at: 8, scene: "deu_f_minor_3" },
    ],
    bills: ["deu_alsace"],
    amends: { deu_alsace: "federal_state" },
    wants: [
      { id: "alsace_front", ...markFor("deu_alsace_front", war) },
      { id: "alsace_next", ...nextOf("deu_alsace"), chapters: 10 },
      {
        id: "minor_text",
        kind: "concession",
        when: amendOn("deu_alsace"),
      },
      {
        id: "polish_schools",
        kind: "promise",
        effects: [heat("deu_cons", 1)],
        keep: paid,
      },
      {
        id: "polish_kingdom",
        kind: "promise",
        when: not(flag("f_poland_kingdom")),
        keep: flag("f_poland_kingdom"),
        chapters: 12,
        terms: ["half", "war_end"],
      },
    ],
  },
  {
    id: "deu_ohl",
    tag: "DEU",
    ideals: { rule: -1, class: 0, force: -1 },
    trust: 2,
    bloc: "army",
    start: "in",
    strength: 2,
    seats: {},
    leaders: [
      {
        person: "deu_hindenburg",
        when: holds("chief_of_staff", "deu_hindenburg"),
      },
      {
        person: "deu_falkenhayn",
        when: holds("chief_of_staff", "deu_falkenhayn"),
      },
      { person: "deu_moltke", when: holds("chief_of_staff", "deu_moltke") },
      { person: "deu_ludendorff" },
      { person: "deu_hindenburg" },
    ],
    radical: "deu_bauer",
    grows: [
      { when: flag("f_third_ohl"), by: 1, every: 6, key: "ohl_pair" },
      {
        when: flag("f_programme_full"),
        by: 1,
        every: 12,
        key: "ohl_programme",
      },
      { when: score({ max: -20 }), by: -1, every: 8, key: "ohl_defeats" },
    ],
    feeds: [
      {
        when: lately("deu_k_peace_resolution", "accept_text", 8),
        key: "peace_text",
        by: 2,
      },
      { when: bloc("army", -3), key: "army_turned" },
      { when: moving("deu_peace_res"), key: "peace_moving" },
      { when: moving("deu_parl_gov"), key: "reform_moving" },
    ],
    cools: [
      { when: score({ min: 20 }), key: "victories" },
      { when: uboats(2), key: "uboat_on" },
    ],
    steps: [
      { at: 4, scene: "deu_f_ohl_2" },
      { at: 8, scene: "deu_f_ohl_3" },
      { at: 12, scene: "deu_f_ohl_4" },
    ],
    plot: "deu_pl_army",
    camps: ["military"],
    bills: ["deu_aux", "deu_strike_ban"],
  },
  {
    id: "deu_south",
    tag: "DEU",
    ideals: { rule: -1, class: -1, force: 0 },
    trust: 1,
    bloc: "court",
    start: "in",
    strength: 2,
    // ww203: Bavaria 6, Saxony 4, Württemberg 4, Baden 3 of the 61.
    seats: { bundesrat: 17 },
    leaders: [
      {
        person: "deu_hertling",
        when: not(holds("chancellor", "deu_hertling")),
      },
      { person: "deu_i_dandl" },
    ],
    grows: [
      {
        when: isLaw("deu_food_office"),
        by: 1,
        every: 12,
        key: "south_food_office",
      },
      { when: low("bread", 0), by: 1, every: 8, key: "south_hungry" },
    ],
    feeds: [
      {
        when: moving("deu_food_office", "food_dictator"),
        key: "food_to_berlin",
      },
      { when: moving("deu_alsace", "to_prussia"), key: "alsace_to_prussia" },
      { when: bloc("court", -3), key: "princes_turned" },
    ],
    cools: [
      {
        when: moving("deu_food_office", "states_keep"),
        key: "states_keep_food",
      },
    ],
    steps: [
      { at: 4, scene: "deu_f_south_2" },
      { at: 8, scene: "deu_f_south_3" },
    ],
    amends: {
      deu_food_office: "states_keep",
      deu_alsace: "share_out",
      deu_bread_cards: "city_cards",
    },
    // ww209: the states' share over the norm; the Bundesrat gave every war
    // credit with the chancellor.
    purse: [
      { when: war, bill: "credits", side: 1, lines: { national: 1 } },
      { lines: { national: 1 } },
    ],
    wants: [
      { id: "states_share", ...markFor("deu_states_share") },
      {
        id: "south_text",
        kind: "concession",
        when: amendOn("deu_food_office", "deu_alsace", "deu_bread_cards"),
      },
      {
        id: "bavaria_grain",
        kind: "money",
        effects: [gauge("bread", -1)],
        keep: paid,
      },
      // Hertling himself, Bavaria's premier, took the chancellery in 1917.
      {
        id: "hertling_chancellor",
        ...postFor("chancellor", "deu_hertling"),
        chapters: 8,
      },
      {
        id: "peace_seat",
        kind: "promise",
        keep: world({ is: "armistice" }),
        chapters: 24,
        terms: ["war_end"],
      },
    ],
  },
  {
    id: "deu_fatherland",
    tag: "DEU",
    ideals: { rule: -1, class: 0, force: -1 },
    trust: 1,
    ability: "deu_pw_ab_fatherland",
    bloc: "court",
    start: "out",
    strength: 2,
    // ww203: the conservative benches it pools (the join takes theirs).
    seats: { reichstag: 75 },
    leaders: [{ person: "deu_tirpitz" }, { person: "deu_i_kapp" }],
    radical: "deu_i_kapp",
    grows: [
      { when: uboats(2), by: 1, every: 6, key: "fp_uboat" },
      { when: peaceTaken, by: 1, every: 8, key: "fp_resolution" },
      { when: low("morale", 1), by: -1, every: 8, key: "fp_weary" },
    ],
    feeds: [
      { when: moving("deu_peace_res"), key: "peace_moving" },
      { when: moving("deu_three_class"), key: "franchise_moving" },
      { when: moving("deu_parl_gov"), key: "reform_moving" },
      {
        when: lately("deu_h_fatherland_party", "ban_in_army", 8),
        key: "banned_in_army",
        by: 2,
      },
    ],
    cools: [
      {
        when: lately("deu_h_fatherland_party", "bless_it", 8),
        key: "blessed",
      },
      { when: score({ min: 30 }), key: "victories" },
    ],
    steps: [
      { at: 4, scene: "deu_f_fatherland_2" },
      { at: 8, scene: "deu_f_fatherland_3" },
      { at: 12, scene: "deu_f_fatherland_4" },
    ],
    plot: "deu_pl_right",
    camps: ["hard"],
    bills: ["deu_war_aims"],
    amends: { deu_war_aims: "east_and_west", deu_three_class: "plural_vote" },
    // ww209: every war credit, the navy over the norm (Tirpitz's party).
    purse: [
      { bill: "credits", side: 1, lines: { navy: 1 } },
      { lines: { navy: 1 } },
    ],
    wants: [
      { id: "aims_next", ...nextOf("deu_war_aims"), chapters: 8 },
      {
        id: "fatherland_text",
        kind: "concession",
        when: amendOn("deu_war_aims", "deu_three_class"),
      },
      // The Fatherland Party wanted Tirpitz at the head of the government.
      {
        id: "tirpitz_chancellor",
        ...postFor("chancellor", "deu_tirpitz"),
        chapters: 8,
      },
      {
        id: "no_reform",
        kind: "promise",
        effects: [heat("deu_progress", 1), heat("deu_spd", 1)],
        keep: paid,
      },
    ],
  },
];

// ---- Bills ----

const home = either(office("interior"), office("chancellor"));
const chan = either(office("chancellor"), office("interior"));

/** Stances on the bills, by law id: existing bills and the factions' own. */
export const DEU_BILLS: readonly GwBillRow[] = [
  {
    law: "deu_censor",
    stance: {
      deu_cons: 1,
      deu_natlib: 1,
      deu_centre: 0,
      deu_progress: -1,
      deu_spd: -1,
      deu_uspd: -1,
      deu_minor: -1,
      deu_fatherland: 1,
    },
    texts: {
      one_office: { deu_centre: 1 },
      reichstag_reads: { deu_centre: 1, deu_progress: 1, deu_spd: 0 },
    },
    sponsor: home,
  },
  {
    law: "deu_bread_cards",
    stance: {
      deu_cons: -1,
      deu_centre: 1,
      deu_progress: 1,
      deu_spd: 1,
      deu_uspd: 1,
      deu_south: 1,
      deu_fatherland: -1,
    },
    texts: {
      reich_grain: { deu_south: -1, deu_natlib: -1 },
      war_bread: { deu_spd: 0, deu_uspd: -1 },
    },
    houses: ["reichstag", "bundesrat"],
    around: true,
    sponsor: home,
  },
  {
    law: "deu_food_office",
    stance: {
      deu_cons: -1,
      deu_centre: 1,
      deu_progress: 1,
      deu_spd: 1,
      deu_south: -1,
      deu_fatherland: -1,
    },
    texts: {
      states_keep: { deu_south: 1, deu_spd: 0 },
      army_seat: {
        deu_cons: 1,
        deu_centre: 0,
        deu_progress: -1,
        deu_spd: -1,
      },
    },
    houses: ["reichstag", "bundesrat"],
    around: true,
    sponsor: either(person("deu_batocki"), office("interior")),
  },
  {
    law: "deu_strike_ban",
    stance: {
      deu_cons: 1,
      deu_natlib: 1,
      deu_progress: -1,
      deu_spd: -1,
      deu_uspd: -1,
      deu_fatherland: 1,
    },
    texts: {
      corps_commanders: { deu_centre: -1 },
      arbitration: { deu_centre: 1, deu_progress: 1, deu_spd: 0 },
      courts_only: { deu_centre: 1 },
    },
    // ww203: the Independents won't bargain over a ban on strikes.
    creed: ["deu_uspd"],
    sponsor: either(office("war"), office("chancellor")),
  },
  {
    law: "deu_aux",
    stance: {
      deu_cons: 1,
      deu_natlib: 1,
      deu_centre: 1,
      deu_progress: 1,
      deu_spd: -1,
      deu_uspd: -1,
      deu_fatherland: 1,
    },
    texts: {
      army_text: { deu_centre: 0, deu_progress: 0 },
      unions_text: {
        deu_spd: 1,
        deu_cons: -1,
        deu_fatherland: -1,
        deu_natlib: 0,
      },
    },
    sponsor: either(
      person("deu_groener"),
      person("deu_helfferich"),
      office("war"),
    ),
  },
  {
    law: "deu_unions",
    stance: {
      deu_cons: -1,
      deu_centre: 1,
      deu_progress: 1,
      deu_spd: 1,
      deu_uspd: 1,
      deu_minor: 1,
      deu_fatherland: -1,
    },
    texts: {
      paragraph_153: { deu_natlib: -1 },
      words_only: { deu_spd: 0, deu_uspd: -1 },
    },
    sponsor: home,
  },
  {
    law: "deu_jesuits",
    stance: {
      deu_cons: -1,
      deu_natlib: -1,
      deu_centre: 1,
      deu_spd: 1,
      deu_uspd: 1,
      deu_minor: 1,
      deu_south: 0,
      deu_fatherland: -1,
    },
    texts: { houses_only: { deu_natlib: 0, deu_south: 1 } },
    houses: ["reichstag", "bundesrat"],
    sponsor: chan,
  },
  {
    // A Prussian law: the Prussian house has no chamber here, so the
    // Reichstag's factions stand for their Prussian benches.
    law: "deu_three_class",
    stance: {
      deu_cons: -1,
      deu_natlib: 0,
      deu_centre: 0,
      deu_progress: 1,
      deu_spd: 1,
      deu_uspd: 1,
      deu_minor: 1,
      deu_fatherland: -1,
    },
    texts: {
      equal_vote: { deu_natlib: -1 },
      plural_vote: {
        deu_natlib: 1,
        deu_centre: 1,
        deu_spd: 0,
        deu_uspd: -1,
      },
      after_the_peace: {
        deu_cons: 0,
        deu_natlib: 1,
        deu_centre: 1,
        deu_progress: 0,
        deu_spd: -1,
        deu_uspd: -1,
      },
    },
    // ww203: the three-class vote is the Conservatives' bedrock.
    creed: ["deu_cons", "deu_fatherland"],
    sponsor: chan,
  },
  {
    law: "deu_alsace",
    stance: {
      deu_cons: -1,
      deu_centre: 1,
      deu_progress: 1,
      deu_spd: 1,
      deu_uspd: 1,
      deu_minor: 1,
      deu_south: 0,
      deu_fatherland: -1,
    },
    texts: {
      federal_state: { deu_south: -1 },
      share_out: {
        deu_south: 1,
        deu_minor: -1,
        deu_progress: 0,
        deu_spd: 0,
      },
      to_prussia: {
        deu_cons: 1,
        deu_centre: -1,
        deu_progress: -1,
        deu_spd: -1,
        deu_minor: -1,
        deu_south: -1,
      },
    },
    houses: ["reichstag", "bundesrat"],
    // ww203: a Reichsland made a state changes the constitution.
    constitution: true,
    sponsor: chan,
  },
  // The factions' own.
  {
    law: "deu_peace_res",
    by: "deu_centre",
    resolution: true,
    // ww204 (T): 19 July 1917, 216 to 126 (de.wikipedia; Britannica 212):
    // SPD, Centre and Progressives for; Conservatives and National Liberals
    // against; the USPD abstained (FES chronicle). The small groups' votes
    // are not recorded in the sources found: they stay away (approximate).
    abstain: true,
    stance: {
      deu_cons: -1,
      deu_natlib: -1,
      deu_centre: 1,
      deu_progress: 1,
      deu_spd: 1,
      deu_uspd: 0,
      deu_minor: 0,
      deu_fatherland: -1,
    },
    texts: {
      no_annex: { deu_uspd: 1, deu_centre: 0 },
      secured: { deu_natlib: 0, deu_spd: 0, deu_uspd: -1 },
    },
    creed: ["deu_fatherland"],
    sponsor: either(office("chancellor"), office("foreign")),
  },
  {
    law: "deu_take_back",
    by: "deu_centre",
    stance: {
      deu_cons: -1,
      deu_natlib: 0,
      deu_centre: 1,
      deu_progress: 1,
      deu_spd: 1,
      deu_uspd: 1,
      deu_minor: 1,
      deu_south: -1,
      deu_fatherland: -1,
    },
    texts: {
      committee: { deu_natlib: 1, deu_south: 0 },
      end_powers: { deu_centre: 0 },
    },
    houses: ["reichstag", "bundesrat"],
    sponsor: chan,
  },
  {
    law: "deu_parl_gov",
    by: "deu_progress",
    stance: {
      deu_cons: -1,
      deu_natlib: 1,
      deu_centre: 0,
      deu_progress: 1,
      deu_spd: 1,
      deu_uspd: 1,
      deu_minor: 1,
      deu_south: -1,
      deu_fatherland: -1,
    },
    texts: {
      study: { deu_centre: 1, deu_south: 0 },
      answer: { deu_natlib: 0 },
    },
    houses: ["reichstag", "bundesrat"],
    // ww203: a chancellor answerable to the house: the October 1918 change.
    constitution: true,
    creed: ["deu_cons", "deu_fatherland"],
    sponsor: chan,
  },
  {
    law: "deu_war_aims",
    by: "deu_cons",
    resolution: true,
    stance: {
      deu_cons: 1,
      deu_natlib: 1,
      deu_centre: 0,
      deu_progress: -1,
      deu_spd: -1,
      deu_uspd: -1,
      deu_minor: -1,
      deu_fatherland: 1,
    },
    texts: {
      east_and_west: { deu_centre: -1 },
      guarantees: { deu_centre: 1, deu_progress: 0 },
    },
    creed: ["deu_uspd"],
    sponsor: either(office("foreign"), office("chancellor")),
  },
  // ww203 + check: the new articles, and the peace years' army bill.
  {
    law: "deu_war_tax",
    stance: {
      deu_cons: 0,
      deu_natlib: 1,
      deu_centre: 1,
      deu_progress: 1,
      deu_spd: 1,
      deu_uspd: 0,
      deu_minor: 1,
      deu_south: 1,
      deu_fatherland: 0,
    },
    texts: {
      loans_only: {
        deu_cons: 1,
        deu_fatherland: 1,
        deu_centre: 0,
        deu_progress: 0,
        deu_spd: -1,
        deu_uspd: -1,
      },
      property_tax: {
        deu_cons: -1,
        deu_fatherland: -1,
        deu_natlib: -1,
        deu_centre: 0,
        deu_uspd: 1,
        deu_south: -1,
      },
    },
    houses: ["reichstag", "bundesrat"],
    money: true,
    sponsor: either(person("deu_helfferich"), office("finance")),
  },
  {
    law: "deu_siege",
    stance: {
      deu_cons: 1,
      deu_natlib: 1,
      deu_centre: 0,
      deu_progress: -1,
      deu_spd: -1,
      deu_uspd: -1,
      deu_minor: -1,
      deu_fatherland: 1,
    },
    texts: {
      civil_review: {
        deu_cons: 0,
        deu_natlib: 0,
        deu_centre: 1,
        deu_progress: 1,
        deu_spd: 1,
        deu_uspd: 0,
        deu_minor: 1,
        deu_fatherland: -1,
      },
    },
    sponsor: home,
  },
  {
    law: "deu_army_bill",
    stance: {
      deu_cons: 1,
      deu_natlib: 1,
      deu_centre: 1,
      deu_progress: 0,
      deu_spd: -1,
      deu_minor: -1,
    },
    texts: {
      cadres: { deu_progress: 1, deu_spd: 0 },
      full_service: { deu_centre: 0, deu_progress: -1 },
    },
    sponsor: either(office("war"), office("chancellor")),
  },
  // ---- ww207: the peace articles, the postponement, the trees' own laws ----
  {
    // 30 June 1913: the SPD group's majority voted for the levy on
    // property; the Conservatives fought a Reich tax on wealth.
    law: "deu_defence_levy",
    stance: {
      deu_cons: -1,
      deu_natlib: 1,
      deu_centre: 1,
      deu_progress: 1,
      deu_spd: 0,
      deu_uspd: -1,
      deu_minor: 0,
      deu_south: 0,
      deu_fatherland: 0,
    },
    texts: {
      property_levy: { deu_spd: 1, deu_cons: -1, deu_fatherland: -1 },
      consumption: {
        deu_cons: 1,
        deu_fatherland: 1,
        deu_progress: 0,
        deu_spd: -1,
        deu_uspd: -1,
      },
      states_pay: { deu_south: -1, deu_cons: 1, deu_centre: 0 },
    },
    houses: ["reichstag", "bundesrat"],
    money: true,
    sponsor: either(office("finance"), office("chancellor")),
  },
  {
    law: "deu_grain_tariff",
    stance: {
      deu_cons: 1,
      deu_natlib: 0,
      deu_centre: 1,
      deu_progress: -1,
      deu_spd: -1,
      deu_uspd: -1,
      deu_minor: 0,
      deu_south: 1,
      deu_fatherland: 1,
    },
    texts: {
      raise_duties: { deu_natlib: -1, deu_centre: 0 },
      cut_duties: {
        deu_cons: -1,
        deu_centre: -1,
        deu_south: -1,
        deu_fatherland: -1,
        deu_natlib: 1,
        deu_progress: 1,
        deu_spd: 1,
        deu_uspd: 1,
      },
    },
    houses: ["reichstag", "bundesrat"],
    sponsor: home,
  },
  {
    law: "deu_pickets",
    stance: {
      deu_cons: 1,
      deu_natlib: 1,
      deu_centre: 0,
      deu_progress: -1,
      deu_spd: -1,
      deu_uspd: -1,
      deu_minor: 0,
      deu_fatherland: 1,
    },
    texts: {
      ban_pickets: { deu_centre: -1 },
      joint_chambers: {
        deu_centre: 1,
        deu_progress: 1,
        deu_natlib: 0,
        deu_spd: 0,
      },
      labour_chambers: {
        deu_cons: -1,
        deu_natlib: -1,
        deu_fatherland: -1,
        deu_centre: 1,
        deu_progress: 1,
        deu_spd: 1,
        deu_uspd: 0,
      },
    },
    houses: ["reichstag", "bundesrat"],
    sponsor: home,
  },
  {
    // 4 December 1913: no confidence, 293 to 54; the Conservatives alone
    // stood by the army.
    law: "deu_zabern",
    stance: {
      deu_cons: -1,
      deu_natlib: 0,
      deu_centre: 1,
      deu_progress: 1,
      deu_spd: 1,
      deu_uspd: 1,
      deu_minor: 1,
      deu_south: 0,
      deu_fatherland: -1,
    },
    texts: {
      crown_command: {
        deu_cons: 1,
        deu_fatherland: 1,
        deu_natlib: 1,
        deu_centre: -1,
        deu_progress: -1,
        deu_spd: -1,
        deu_uspd: -1,
        deu_minor: -1,
      },
      reichsland_rights: { deu_natlib: -1, deu_south: -1 },
    },
    sponsor: chan,
  },
  {
    // The Reichstag of 1912 stretched its own term in the war (laws of 16
    // October 1916, 23 July 1917, 18 July 1918); the far left said no.
    law: "deu_postpone",
    stance: {
      deu_cons: 1,
      deu_natlib: 1,
      deu_centre: 1,
      deu_progress: 1,
      deu_spd: 1,
      deu_uspd: -1,
      deu_minor: 0,
      deu_south: 1,
      deu_fatherland: 1,
    },
    texts: { till_peace: { deu_progress: 0, deu_spd: 0 } },
    houses: ["reichstag", "bundesrat"],
    sponsor: chan,
  },
  {
    law: "deu_x_eight_hours",
    by: "deu_spd",
    stance: {
      deu_cons: -1,
      deu_natlib: -1,
      deu_centre: 0,
      deu_progress: 0,
      deu_spd: 1,
      deu_uspd: 1,
      deu_minor: 0,
      deu_south: -1,
      deu_fatherland: -1,
    },
    texts: {
      works_councils: { deu_centre: 1, deu_progress: 1, deu_natlib: 0 },
    },
    houses: ["reichstag", "bundesrat"],
    sponsor: home,
  },
  {
    law: "deu_x_proportional",
    by: "deu_progress",
    stance: {
      deu_cons: -1,
      deu_natlib: 0,
      deu_centre: 0,
      deu_progress: 1,
      deu_spd: 1,
      deu_uspd: 1,
      deu_minor: 1,
      deu_south: -1,
      deu_fatherland: -1,
    },
    texts: { big_cities: { deu_centre: 1, deu_natlib: 1 } },
    houses: ["reichstag", "bundesrat"],
    sponsor: chan,
  },
  {
    law: "deu_x_army_fixed",
    by: "deu_cons",
    stance: {
      deu_cons: 1,
      deu_natlib: 1,
      deu_centre: -1,
      deu_progress: -1,
      deu_spd: -1,
      deu_uspd: -1,
      deu_minor: -1,
      deu_south: 0,
      deu_fatherland: 1,
    },
    texts: { seven_years: { deu_centre: 0 } },
    houses: ["reichstag", "bundesrat"],
    // The army's money out of the yearly budget: the constitution's budget right.
    constitution: true,
    creed: ["deu_spd", "deu_uspd"],
    sponsor: either(office("war"), office("chancellor")),
  },
];

// ---- The factions' own bills ----

const who = role("who");
const reply = (
  id: string,
  stance: GwReply["stance"],
  kind: GwReply["kind"],
  next: string | null,
  rest: Partial<GwReply> = {},
): GwReply => ({ id, stance, kind, tell: [], effects: [], next, ...rest });

/** The talk around a faction's bill: as content/laws/kit's, no price shown. */
function quietTalk(law: string, w: GwLawRow["talk"]["who"]): GwLawRow["talk"] {
  const nodes: Record<string, GwNode> = {
    open: {
      says: [{ id: "base" }],
      replies: [
        reply("ask", "frank", "ask", "find", {
          reacts: [
            {
              when: { kind: "person_trust", who, max: -2 },
              next: "shut",
              effects: [],
            },
          ],
        }),
        reply("push", "cold", "push", "terms", {
          effects: [trustOf(who, -1)],
          miss: "shut",
        }),
        reply("leave", "warm", "leave", null),
      ],
    },
    find: {
      says: [
        { id: "straight", when: { kind: "candid", who } },
        { id: "far", when: world({ is: "law_count", id: law, max: -2 }) },
        { id: "base" },
      ],
      replies: [
        reply("trade", "frank", "deal", "terms"),
        reply("enough", "cold", "leave", null),
      ],
    },
    terms: {
      says: [{ id: "base" }],
      replies: [
        reply("take", "warm", "deal", null, {
          effects: [
            { kind: "remember", key: `law_talk_${law}` },
            doWorld({ do: "law_support", law, delta: 1 }),
          ],
        }),
        reply("no", "cold", "leave", null),
      ],
    },
    shut: {
      says: [{ id: "base" }],
      replies: [reply("end", "cold", "leave", null)],
    },
  };
  return { who: w, start: "open", nodes };
}

const text = (id: string, support: number, effects: GwEffect[] = []) => ({
  id,
  support,
  tell: [],
  effects,
});
const own = (r: Omit<GwLawRow, "tag">): GwLawRow => ({ ...r, tag: "DEU" });
const chose = (scene: string, pick: string): GwCond => ({
  kind: "chose",
  scene,
  pick,
});

/** The factions' own bills: rows like content/laws/deu.ts. */
const DEU_HOUSE_LAW_ROWS: readonly GwLawRow[] = [
  own({
    // The peace resolution: the desk's crisis card is the same vote, so the
    // bill stands aside once that card was answered with the text taken.
    id: "deu_peace_res",
    chapter: "war_aims",
    opens: all(
      war,
      warAge(24),
      any(low("morale", 2), uboats(2), score({ max: 0 })),
      not(chose("deu_k_peace_resolution", "dissolve")),
    ),
    lean: 0,
    decree: false,
    cast: { chancellor: held("chancellor") },
    draft: [
      text("understanding", 1),
      text("no_annex", -1),
      text("secured", 1, [inst("army", 1)]),
    ],
    passed: [
      setFlag("f_resolution_taken"),
      inst("reichstag", 1),
      inst("army", -1),
      { kind: "opinion", bloc: "workers", delta: 1 },
    ],
    passedTell: [],
    term: [],
    settled: any(
      chose("deu_k_peace_resolution", "accept_text"),
      chose("deu_k_peace_resolution", "interpret"),
    ),
    replaces: ["deu_k_peace_resolution"],
    repeal: {
      authority: 20,
      tell: [],
      effects: [inst("reichstag", -2), inst("army", 1)],
    },
    talk: quietTalk(
      "deu_peace_res",
      either(person("deu_erzberger"), person("deu_scheidemann")),
    ),
  }),
  own({
    // The Reichstag may ask for the Bundesrat's wartime decrees to be lifted
    // (the 4 August 1914 law): the majority's answer to the way round.
    id: "deu_take_back",
    chapter: "franchise",
    opens: all(war, aroundUsed(2)),
    lean: 0,
    decree: false,
    cast: { chancellor: held("chancellor") },
    draft: [
      text("repeal_on_demand", 1),
      text("committee", 1),
      text("end_powers", -1, [inst("reichstag", 1)]),
    ],
    passed: [setFlag("f_powers_back"), inst("reichstag", 1)],
    passedTell: [],
    term: [],
    repeal: { authority: 20, tell: [], effects: [inst("reichstag", -1)] },
    talk: quietTalk(
      "deu_take_back",
      either(person("deu_erzberger"), held("interior")),
    ),
  }),
  own({
    id: "deu_parl_gov",
    chapter: "franchise",
    opens: all(
      war,
      any(warAge(30), low("morale", 1), flag("f_interparty_heard")),
    ),
    lean: -1,
    decree: false,
    cast: { chancellor: held("chancellor") },
    draft: [
      text("study", 1),
      text("answer", -1, [inst("countersign", -1)]),
      text("members", 0),
    ],
    passed: [inst("reichstag", 2), inst("army", -1)],
    passedTell: [],
    term: [{ gauge: "order", delta: 1, every: 12 }],
    repeal: {
      authority: 30,
      tell: [],
      effects: [inst("reichstag", -2), gauge("order", -1)],
    },
    talk: quietTalk(
      "deu_parl_gov",
      either(person("deu_stresemann"), held("chancellor")),
    ),
  }),
  own({
    id: "deu_war_aims",
    chapter: "war_aims",
    opens: all(war, any(flag("f_aims_ban_lifted"), warAge(24))),
    lean: 0,
    decree: false,
    cast: { chancellor: held("chancellor") },
    draft: [
      text("guarantees", 1),
      text("east_and_west", -1, [inst("army", 1)]),
      text("east_only", 0),
    ],
    passed: [
      setFlag("f_aims_resolution"),
      inst("army", 1),
      { kind: "opinion", bloc: "workers", delta: -1 },
    ],
    passedTell: [],
    term: [],
    repeal: { authority: 15, tell: [], effects: [inst("army", -1)] },
    talk: quietTalk(
      "deu_war_aims",
      either(person("deu_stresemann"), held("foreign")),
    ),
  }),
  // ---- ww207 ----
  own({
    // The Reichstag's term stretched in war (see the bill row).
    id: "deu_postpone",
    chapter: "franchise",
    opens: all(
      war,
      world({ is: "election_due", chamber: "reichstag", max: 6 }),
    ),
    lean: 1,
    decree: false,
    cast: { chancellor: held("chancellor") },
    draft: [
      text("one_year", 1),
      text("till_peace", 0, [inst("reichstag", -1)]),
    ],
    passed: [gauge("order", 1)],
    passedTell: [],
    term: [],
    repeal: { authority: 10, tell: [], effects: [gauge("order", -1)] },
    talk: quietTalk(
      "deu_postpone",
      either(person("deu_erzberger"), held("chancellor")),
    ),
  }),
  own({
    // The SPD tree's law (node m2): the eight-hour day, the Erfurt
    // programme's old demand, and works councils.
    id: "deu_x_eight_hours",
    chapter: "social",
    opens: nodeOpen("deu_spd", "m2"),
    exclusive: { faction: "deu_spd", node: "m2" },
    peace: true,
    lean: -1,
    decree: false,
    cast: { chancellor: held("chancellor") },
    draft: [
      text("eight_hours", 0),
      text("works_councils", 1, [inst("reichstag", 1)]),
    ],
    passed: [
      { kind: "opinion", bloc: "workers", delta: 2 },
      { kind: "opinion", bloc: "business", delta: -1 },
    ],
    passedTell: [],
    term: [{ gauge: "order", delta: 1, every: 12 }],
    repeal: {
      authority: 25,
      tell: [],
      effects: [{ kind: "opinion", bloc: "workers", delta: -2 }],
    },
    talk: quietTalk(
      "deu_x_eight_hours",
      either(person("deu_ebert"), held("interior")),
    ),
  }),
  own({
    // The Progressives' tree law (node m2): the seats redrawn. The 1871
    // constituencies were never redrawn; proportional voting in the big
    // towns came only with the law of 24 August 1918 (not checked).
    id: "deu_x_proportional",
    chapter: "franchise",
    opens: nodeOpen("deu_progress", "m2"),
    exclusive: { faction: "deu_progress", node: "m2" },
    peace: true,
    lean: -1,
    decree: false,
    cast: { chancellor: held("chancellor") },
    draft: [text("big_cities", 1), text("redraw", -1)],
    passed: [
      inst("reichstag", 1),
      { kind: "opinion", bloc: "court", delta: -1 },
    ],
    passedTell: [],
    term: [],
    repeal: { authority: 25, tell: [], effects: [inst("reichstag", -1)] },
    talk: quietTalk(
      "deu_x_proportional",
      either(person("deu_stresemann"), held("interior")),
    ),
  }),
  own({
    // The Conservatives' tree law (node b1): the army's money fixed for
    // good, out of the Reichstag's yearly hands (Bismarck's Äternat, lost
    // in 1874 for the seven-year Septennat).
    id: "deu_x_army_fixed",
    chapter: "arms",
    opens: nodeOpen("deu_cons", "b1"),
    exclusive: { faction: "deu_cons", node: "b1" },
    peace: true,
    lean: -2,
    decree: false,
    cast: { chancellor: held("chancellor") },
    draft: [
      text("eternal", -1, [inst("reichstag", -1)]),
      text("seven_years", 1),
    ],
    passed: [inst("army", 1), inst("reichstag", -1)],
    passedTell: [],
    term: [],
    repeal: { authority: 30, tell: [], effects: [inst("army", -1)] },
    talk: quietTalk(
      "deu_x_army_fixed",
      either(held("war"), held("chancellor")),
    ),
  }),
];

/** ww207: what each text of the house's own bills moves, in notches. */
const DEU_HOUSE_LAW_AXES = {
  deu_peace_res: {
    understanding: { force: 1, rule: 1 },
    no_annex: { force: 1, class: 1 },
    secured: { force: 1 },
  },
  deu_take_back: {
    repeal_on_demand: { rule: 1 },
    committee: { rule: 1 },
    end_powers: { rule: 1, force: 1 },
  },
  deu_parl_gov: {
    study: { rule: 1 },
    answer: { rule: 1, force: 1 },
    members: { rule: 1 },
  },
  deu_war_aims: {
    guarantees: { force: -1 },
    east_and_west: { force: -1, rule: -1 },
    east_only: { force: -1 },
  },
  deu_postpone: {
    one_year: { rule: -1 },
    till_peace: { rule: -1, force: -1 },
  },
  deu_x_eight_hours: {
    eight_hours: { class: 1 },
    works_councils: { class: 1, rule: 1 },
  },
  deu_x_proportional: {
    big_cities: { rule: 1 },
    redraw: { rule: 1, class: 1 },
  },
  deu_x_army_fixed: {
    eternal: { rule: -1, force: -1 },
    seven_years: { rule: -1 },
  },
} as const;

/** The factions' own bills, each text with its axis push. */
export const DEU_HOUSE_LAWS: readonly GwLawRow[] = withAxes(
  DEU_HOUSE_LAW_ROWS,
  DEU_HOUSE_LAW_AXES,
);

// ---- Step, split and join scenes ----

const opt = (id: string, effects: GwEffect[]): GwOption => ({
  id,
  tell: [],
  effects,
});

/** A faction's temper rising: its leader (or the radical, at 3) comes. */
function step(
  id: string,
  faction: string,
  options: GwOption[],
  variants: GwVariant[] = [{ id: "base" }],
): GwScene {
  return {
    id,
    nation: ["DEU"],
    kind: "audience",
    scheduledOnly: true,
    cooldown: 4,
    cast: { who: leaderOf(faction) },
    salience: 7,
    tags: ["home", "people", "tension_up"],
    variants,
    fallback: options[0].id,
    options,
  };
}

const r = (key: string) => reason(key, who);
const money = (delta: number) => gauge("money", delta);
const censor = (delta: number): GwEffect => ({ kind: "censor", delta });

/** Step, split and join scenes written by hand. */
export const DEU_HOUSE_SCENES: readonly GwScene[] = [
  // Conservatives: the benches turn their backs, then the old guard leads.
  step("deu_f_cons_2", "deu_cons", [
    opt("hear_out", [
      cool("deu_cons", 2),
      heat("deu_progress", 1),
      r("hf_cons_heard"),
    ]),
    opt("stand_firm", [inst("countersign", 1), r("hf_cons_firm")]),
    opt("east_word", [
      cool("deu_cons", 3),
      heat("deu_spd", 1),
      heat("deu_centre", 1),
      r("hf_cons_east"),
    ]),
  ]),
  step(
    "deu_f_cons_3",
    "deu_cons",
    [
      opt("court_dinner", [
        cool("deu_cons", 2),
        inst("reichstag", -1),
        r("hf_cons_dinner"),
      ]),
      opt("let_them_walk", [
        heat("deu_cons", 1),
        inst("countersign", 1),
        r("hf_cons_walk"),
      ]),
      opt("land_offer", [
        cool("deu_cons", 3),
        gauge("bread", -1),
        r("hf_cons_land"),
      ]),
    ],
    [{ id: "franchise", when: moving("deu_three_class") }, { id: "base" }],
  ),
  // National Liberals: money first.
  step("deu_f_natlib_2", "deu_natlib", [
    opt("industry_table", [
      cool("deu_natlib", 2),
      heat("deu_spd", 1),
      r("hf_natlib_table"),
    ]),
    opt("bank_pressure", [money(-1), r("hf_natlib_bank")]),
    opt("reform_hint", [
      cool("deu_natlib", 1),
      heat("deu_cons", 1),
      r("hf_natlib_reform"),
    ]),
  ]),
  step("deu_f_natlib_3", "deu_natlib", [
    opt("give_seat", [
      cool("deu_natlib", 3),
      inst("countersign", -1),
      r("hf_natlib_seat"),
    ]),
    opt("loan_elsewhere", [
      money(-1),
      heat("deu_natlib", 1),
      r("hf_natlib_elsewhere"),
    ]),
  ]),
  // Centre: the votes withheld, then the motion.
  step(
    "deu_f_centre_2",
    "deu_centre",
    [
      opt("hear_terms", [
        cool("deu_centre", 2),
        inst("army", -1),
        r("hf_centre_terms"),
      ]),
      opt("rome_word", [
        cool("deu_centre", 1),
        heat("deu_cons", 1),
        r("hf_centre_rome"),
      ]),
      opt("wait_out", [inst("reichstag", -1), r("hf_centre_wait")]),
    ],
    [{ id: "hungry", when: low("bread", 0) }, { id: "base" }],
  ),
  // ww187: a motion in the Reichstag: it sits.
  assuming(
    step("deu_f_centre_3", "deu_centre", [
      opt("majority_room", [
        cool("deu_centre", 3),
        inst("countersign", -1),
        inst("army", -1),
        r("hf_centre_room"),
      ]),
      opt("split_centre", [
        heat("deu_centre", 1),
        cool("deu_cons", 1),
        r("hf_centre_split"),
      ]),
      opt("let_motion", [inst("reichstag", -1), r("hf_centre_motion")]),
    ]),
    { sits: ["reichstag"] },
  ),
  // Progressives.
  step("deu_f_progress_2", "deu_progress", [
    opt("franchise_hint", [
      cool("deu_progress", 2),
      heat("deu_cons", 1),
      r("hf_progress_hint"),
    ]),
    opt("press_relief", [
      cool("deu_progress", 1),
      censor(-1),
      r("hf_progress_press"),
    ]),
    opt("ignore_them", [inst("reichstag", -1), r("hf_progress_ignored")]),
  ]),
  step("deu_f_progress_3", "deu_progress", [
    opt("deputy_office", [
      cool("deu_progress", 3),
      inst("countersign", -1),
      r("hf_progress_office"),
    ]),
    opt("leave_room", [heat("deu_progress", 1), r("hf_progress_left")]),
  ]),
  // SPD: the shop floor, then the benches.
  step(
    "deu_f_spd_2",
    "deu_spd",
    [
      opt("bread_first", [cool("deu_spd", 2), money(-1), r("hf_spd_bread")]),
      opt("unions_word", [
        cool("deu_spd", 2),
        heat("deu_ohl", 1),
        r("hf_spd_unions"),
      ]),
      opt("leave_strike", [gauge("order", -1), r("hf_spd_strike")]),
    ],
    [{ id: "hungry", when: low("bread", 0) }, { id: "base" }],
  ),
  step("deu_f_spd_3", "deu_spd", [
    opt("palace_door", [
      cool("deu_spd", 3),
      heat("deu_cons", 1),
      heat("deu_ohl", 1),
      r("hf_spd_palace"),
    ]),
    opt("franchise_word", [
      cool("deu_spd", 2),
      setFlag("f_franchise_word"),
      heat("deu_cons", 2),
      r("hf_spd_franchise"),
    ]),
    opt("no_answer", [
      gauge("order", -1),
      heat("deu_uspd", 1),
      r("hf_spd_none"),
    ]),
  ]),
  // The new party.
  step(
    "deu_f_uspd",
    "deu_uspd",
    [
      opt("seat_them", [
        cool("deu_uspd", 1),
        heat("deu_cons", 1),
        r("hf_uspd_seat"),
      ]),
      opt("watch_them", [heat("deu_uspd", 1), r("hf_uspd_watch")]),
      opt("let_be", [r("hf_uspd_let")]),
    ],
    [{ id: "after", when: seen("deu_h_spd_split") }, { id: "base" }],
  ),
  step("deu_f_uspd_2", "deu_uspd", [
    opt("hear_peace", [
      cool("deu_uspd", 2),
      heat("deu_ohl", 1),
      r("hf_uspd_peace"),
    ]),
    opt("ration_talk", [cool("deu_uspd", 1), money(-1), r("hf_uspd_ration")]),
    opt("send_police", [
      heat("deu_uspd", 2),
      gauge("order", 1),
      r("hf_uspd_police"),
    ]),
  ]),
  step("deu_f_uspd_3", "deu_uspd", [
    opt("stockholm_line", [
      cool("deu_uspd", 3),
      heat("deu_ohl", 2),
      heat("deu_cons", 1),
      r("hf_uspd_stockholm"),
    ]),
    opt("hold_line", [gauge("order", -1), r("hf_uspd_hold")]),
  ]),
  // Spartacus: never in the house. The police's word of the group.
  {
    id: "deu_f_spartacus",
    nation: ["DEU"],
    kind: "report",
    scheduledOnly: true,
    cast: {},
    salience: 6,
    tags: ["home", "tension_up"],
    stamp: "unconfirmed",
    source: "police",
    variants: [{ id: "base" }],
  },
  step("deu_f_spartacus_2", "deu_spartacus", [
    opt("bread_lines", [
      cool("deu_spartacus", 2),
      money(-1),
      r("hf_sparta_bread"),
    ]),
    opt("factory_talks", [
      cool("deu_spartacus", 1),
      cool("deu_uspd", 1),
      heat("deu_ohl", 1),
      r("hf_sparta_talks"),
    ]),
    opt("watch_close", [
      gauge("order", 1),
      heat("deu_spartacus", 1),
      r("hf_sparta_watch"),
    ]),
  ]),
  step("deu_f_spartacus_3", "deu_spartacus", [
    opt("bread_and_wait", [
      cool("deu_spartacus", 2),
      money(-1),
      r("hf_sparta_wait"),
    ]),
    opt("strike_talks", [
      cool("deu_spartacus", 2),
      heat("deu_ohl", 2),
      inst("army", -1),
      r("hf_sparta_strike"),
    ]),
    opt("siege_law", [
      under("deu_spartacus"),
      heat("deu_uspd", 2),
      heat("deu_spd", 1),
      gauge("order", -1),
      r("hf_sparta_under"),
    ]),
  ]),
  // The national minorities.
  step("deu_f_minor_2", "deu_minor", [
    opt("schools_word", [
      cool("deu_minor", 2),
      heat("deu_cons", 1),
      r("hf_minor_schools"),
    ]),
    opt("alsace_sound", [
      cool("deu_minor", 1),
      inst("army", -1),
      r("hf_minor_alsace"),
    ]),
    opt("refer_army", [inst("army", 1), r("hf_minor_army")]),
  ]),
  step("deu_f_minor_3", "deu_minor", [
    opt("poland_word", [
      cool("deu_minor", 3),
      heat("deu_cons", 1),
      heat("deu_ohl", 1),
      r("hf_minor_poland"),
    ]),
    opt("let_silent", [r("hf_minor_silent")]),
  ]),
  // The Supreme Command: resignations on the table, then the colonel.
  step(
    "deu_f_ohl_2",
    "deu_ohl",
    [
      opt("give_way", [
        cool("deu_ohl", 2),
        inst("army", 1),
        inst("countersign", -1),
        r("hf_ohl_give"),
      ]),
      opt("refuse_letters", [
        inst("countersign", 1),
        inst("army", -1),
        r("hf_ohl_refuse"),
      ]),
      opt("send_chancellor", [
        cool("deu_ohl", 1),
        inst("reichstag", -1),
        r("hf_ohl_chancellor"),
      ]),
    ],
    [
      { id: "peace", when: moving("deu_peace_res") },
      { id: "reform", when: moving("deu_parl_gov") },
      { id: "base" },
    ],
  ),
  step("deu_f_ohl_3", "deu_ohl", [
    opt("orders_signed", [
      cool("deu_ohl", 3),
      inst("army", 1),
      inst("reichstag", -1),
      r("hf_ohl_signed"),
    ]),
    opt("post_away", [
      heat("deu_ohl", 1),
      inst("countersign", 1),
      r("hf_ohl_post"),
    ]),
    opt("hear_colonel", [cool("deu_ohl", 1), r("hf_ohl_colonel")]),
  ]),
  // The federal states.
  step(
    "deu_f_south_2",
    "deu_south",
    [
      opt("munich_share", [
        cool("deu_south", 2),
        gauge("bread", -1),
        r("hf_south_share"),
      ]),
      opt("prussia_votes", [
        inst("countersign", 1),
        heat("deu_centre", 1),
        r("hf_south_prussia"),
      ]),
      opt("visit_munich", [cool("deu_south", 1), r("hf_south_visit")]),
    ],
    [{ id: "food", when: moving("deu_food_office") }, { id: "base" }],
  ),
  step("deu_f_south_3", "deu_south", [
    opt("reserve_rights", [
      cool("deu_south", 3),
      inst("countersign", -1),
      r("hf_south_rights"),
    ]),
    opt("princes_letter", [
      cool("deu_south", 1),
      heat("deu_cons", 1),
      r("hf_south_princes"),
    ]),
  ]),
  // The Fatherland Party: the conservatives go over to it in the house.
  step(
    "deu_f_fatherland",
    "deu_fatherland",
    [
      opt("cold_shoulder", [
        heat("deu_fatherland", 1),
        cool("deu_centre", 1),
        r("hf_fp_cold"),
      ]),
      opt("receive_admiral", [
        cool("deu_fatherland", 2),
        heat("deu_centre", 1),
        heat("deu_spd", 1),
        r("hf_fp_receive"),
      ]),
      opt("say_nothing", [r("hf_fp_nothing")]),
    ],
    [{ id: "founded", when: seen("deu_h_fatherland_party") }, { id: "base" }],
  ),
  step("deu_f_fatherland_2", "deu_fatherland", [
    opt("aims_hint", [
      cool("deu_fatherland", 2),
      heat("deu_progress", 1),
      heat("deu_spd", 1),
      r("hf_fp_aims"),
    ]),
    opt("press_order", [
      censor(1),
      heat("deu_fatherland", 1),
      r("hf_fp_press"),
    ]),
    opt("let_shout", [inst("reichstag", -1), r("hf_fp_shout")]),
  ]),
  step("deu_f_fatherland_3", "deu_fatherland", [
    opt("hall_ban", [
      cool("deu_fatherland", 2),
      inst("army", -1),
      r("hf_fp_hall"),
    ]),
    opt("public_word", [
      heat("deu_fatherland", 1),
      cool("deu_centre", 1),
      cool("deu_progress", 1),
      r("hf_fp_word"),
    ]),
    opt("bless_rally", [
      cool("deu_fatherland", 3),
      heat("deu_spd", 2),
      inst("reichstag", -1),
      r("hf_fp_rally"),
    ]),
  ]),
];

// ---- S2: plots, the dossier, allies ----

const quietFeed = (when: GwCond, key: string, by?: number) =>
  by === undefined
    ? { when, key, quiet: true }
    : { when, key, by, quiet: true };

export const DEU_PLOTS: readonly GwPlotRow[] = [
  {
    // The colonel and the quartermaster: the Supreme Command takes the
    // government, and the signature it asks for at Spa is the last step.
    id: "deu_pl_army",
    tag: "DEU",
    regimes: ["empire"],
    from: "1916-08",
    rest: 12,
    fatal: true,
    feeds: [
      quietFeed(temper("deu_ohl", 3), "ohl_silent"),
      quietFeed(isLaw("deu_peace_res"), "peace_resolution"),
      quietFeed(isLaw("deu_parl_gov"), "reform_law"),
      quietFeed(score({ max: -20 }), "defeats"),
      quietFeed(lately("deu_f_ohl_3", "post_away", 6), "colonel_posted", 2),
    ],
    steps: [
      { at: 6, scene: "deu_pl_army_1" },
      { at: 12, scene: "deu_pl_army_2" },
    ],
    plot: {
      by: ["deu_ohl"],
      warn: "deu_pl_army_w",
      end: "removed",
      signs: [
        { at: 2, scene: "deu_pl_army_s1", via: "paper" },
        { at: 4, scene: "deu_pl_army_s2", via: "talk" },
        { at: 8, scene: "deu_pl_army_s3", via: "report" },
      ],
    },
  },
  {
    // The Pan-Germans and the Fatherland Party call for a man above the
    // Kaiser's government: a dictatorship in the Supreme Command's name.
    id: "deu_pl_right",
    tag: "DEU",
    regimes: ["empire"],
    from: "1917-06",
    rest: 12,
    fatal: true,
    feeds: [
      quietFeed(temper("deu_fatherland", 3), "fatherland_silent"),
      quietFeed(temper("deu_cons", 3), "cons_silent"),
      quietFeed(peaceTaken, "peace_taken"),
      quietFeed(moving("deu_three_class"), "franchise_moving"),
      quietFeed(isLaw("deu_parl_gov"), "reform_law"),
    ],
    steps: [
      { at: 6, scene: "deu_pl_right_1" },
      { at: 12, scene: "deu_pl_right_2" },
    ],
    plot: {
      by: ["deu_fatherland", "deu_cons"],
      warn: "deu_pl_right_w",
      end: "removed",
      signs: [
        { at: 2, scene: "deu_pl_right_s1", via: "paper" },
        { at: 4, scene: "deu_pl_right_s2", via: "talk" },
        { at: 8, scene: "deu_pl_right_s3", via: "report" },
      ],
    },
  },
  {
    // The shop stewards and the sailors: it feeds the unrest ladder.
    id: "deu_pl_red",
    tag: "DEU",
    regimes: ["empire"],
    from: "1916-06",
    rest: 8,
    fatal: false,
    feeds: [
      quietFeed(temper("deu_spartacus", 3), "sparta_silent"),
      quietFeed(temper("deu_uspd", 3), "uspd_silent"),
      quietFeed(low("bread", 0), "bread_gone"),
      quietFeed(faction("deu_spartacus", { of: ["under"] }), "driven_under"),
      quietFeed(unrest(1), "unrest"),
    ],
    steps: [
      { at: 6, scene: "deu_pl_red_1" },
      { at: 12, scene: "deu_pl_red_2" },
    ],
    plot: {
      by: ["deu_spartacus", "deu_uspd"],
      warn: "deu_pl_red_w",
      end: "unrest",
      signs: [
        { at: 2, scene: "deu_pl_red_s1", via: "paper" },
        { at: 4, scene: "deu_pl_red_s2", via: "talk" },
        { at: 8, scene: "deu_pl_red_s3", via: "report" },
      ],
    },
  },
];

/** Our people's possible weaknesses; the seed decides which are true. */
export const DEU_WEAK: readonly GwWeakRow[] = [
  {
    person: "deu_erzberger",
    weak: [
      { id: "industry_money", odds: 40 },
      { id: "foreign_ties", odds: 20 },
    ],
  },
  {
    person: "deu_helfferich",
    weak: [
      { id: "industry_money", odds: 35 },
      { id: "letters", odds: 20 },
    ],
  },
  {
    person: "deu_stresemann",
    weak: [
      { id: "industry_money", odds: 45 },
      { id: "debts", odds: 20 },
    ],
  },
  {
    person: "deu_bauer",
    weak: [
      { id: "industry_money", odds: 40 },
      { id: "letters", odds: 30 },
    ],
  },
  {
    person: "deu_ludendorff",
    weak: [
      { id: "health", odds: 35 },
      { id: "letters", odds: 15 },
    ],
  },
  {
    person: "deu_tirpitz",
    weak: [
      { id: "letters", odds: 35 },
      { id: "old_scandal", odds: 15 },
    ],
  },
  {
    person: "deu_scheidemann",
    weak: [
      { id: "letters", odds: 25 },
      { id: "foreign_ties", odds: 20 },
    ],
  },
  {
    person: "deu_ebert",
    weak: [
      { id: "letters", odds: 20 },
      { id: "debts", odds: 15 },
    ],
  },
  {
    person: "deu_haase",
    weak: [
      { id: "foreign_ties", odds: 35 },
      { id: "letters", odds: 20 },
    ],
  },
  { person: "deu_hertling", weak: [{ id: "health", odds: 50 }] },
  {
    person: "deu_michaelis",
    weak: [
      { id: "letters", odds: 25 },
      { id: "old_scandal", odds: 10 },
    ],
  },
  {
    person: "deu_rathenau",
    weak: [
      { id: "industry_money", odds: 30 },
      { id: "foreign_ties", odds: 15 },
    ],
  },
  { person: "deu_valentini", weak: [{ id: "letters", odds: 30 }] },
  {
    person: "deu_liebknecht",
    weak: [
      { id: "foreign_ties", odds: 30 },
      { id: "letters", odds: 20 },
    ],
  },
];

const trust = (tag: "AUH" | "OTT", delta: number): GwEffect => ({
  kind: "trust",
  tag,
  delta,
});
const main = (t: "east" | "italy"): GwCond => world({ is: "main", of: [t] });

/** What Vienna and Constantinople ask of Berlin. */
export const DEU_ASKS: readonly GwAskRow[] = [
  {
    id: "deu_ask_east",
    tag: "DEU",
    from: "AUH",
    kind: "offensive",
    when: all(war, warAge(5), not(main("east"))),
    scene: "deu_ask_east",
    keep: main("east"),
    chapters: 2,
    kept: [trust("AUH", 1)],
    broken: [trust("AUH", -1)],
  },
  {
    id: "deu_ask_loan",
    tag: "DEU",
    from: "AUH",
    kind: "loan",
    when: all(war, warAge(12)),
    scene: "deu_ask_loan",
    keep: paid,
    chapters: 1,
    kept: [trust("AUH", 1)],
    broken: [trust("AUH", -1)],
  },
  {
    id: "deu_ask_italy",
    tag: "DEU",
    from: "AUH",
    kind: "front",
    // ww187: "the Isonzo held, again and again": the line still on it.
    when: all(
      war,
      warAge(20),
      world({ is: "open", theatre: "italy" }),
      world({ is: "front", theatre: "italy", from: "isonzo", to: "isonzo" }),
    ),
    scene: "deu_ask_italy",
    keep: main("italy"),
    chapters: 2,
    kept: [trust("AUH", 1)],
    broken: [trust("AUH", -1)],
  },
  {
    id: "deu_ask_gold",
    tag: "DEU",
    from: "OTT",
    kind: "loan",
    when: all(war, warAge(4)),
    scene: "deu_ask_gold",
    keep: paid,
    chapters: 1,
    kept: [trust("OTT", 1)],
    broken: [trust("OTT", -1)],
  },
  {
    // Pless: one command for the Central Powers, face to face.
    id: "deu_conf_pless",
    tag: "DEU",
    from: "AUH",
    kind: "front",
    conference: true,
    when: all(
      war,
      warAge(18),
      any({ kind: "trust", tag: "AUH", max: 0 }, warAge(24)),
    ),
    scene: "deu_conf_pless",
    keep: flag("f_pless_command"),
    chapters: 2,
    kept: [trust("AUH", 1)],
    broken: [trust("AUH", -2)],
  },
];

// ---- Plot, ask and step-four scenes ----

const sign = (
  id: string,
  kind: "wire" | "report",
  rest: Partial<GwScene> = {},
): GwScene => ({
  id,
  nation: ["DEU"],
  kind,
  scheduledOnly: true,
  cast: {},
  salience: 6,
  tags: ["home"],
  variants: [{ id: "base" }],
  ...(kind === "report" ? { stamp: "unconfirmed", source: "police" } : {}),
  ...rest,
});

/** Someone says too much: a short talk that ends when it is heard. */
function slip(id: string, w: GwScene["cast"][string]): GwScene {
  return {
    id,
    nation: ["DEU"],
    kind: "talk",
    scheduledOnly: true,
    cast: { who: w },
    salience: 6,
    tags: ["home", "people"],
    who: "who",
    variants: [{ id: "base" }],
    start: "open",
    nodes: {
      open: {
        says: [{ id: "base" }],
        replies: [
          reply("more", "frank", "ask", "more"),
          reply("leave", "cold", "leave", null),
        ],
      },
      more: {
        says: [{ id: "base" }],
        replies: [reply("end", "warm", "leave", null)],
      },
    },
  };
}

/** A plot's warning or step: a decision of the seat. */
function plotPaper(
  id: string,
  w: GwScene["cast"][string],
  options: GwOption[],
): GwScene {
  return {
    id,
    nation: ["DEU"],
    kind: "audience",
    scheduledOnly: true,
    cast: { who: w },
    salience: 8,
    tags: ["home", "tension_up"],
    variants: [{ id: "base" }],
    fallback: options[options.length - 1].id,
    options,
  };
}

const chancellor = either(office("chancellor"), office("interior"));
const police = either(office("interior"), office("chancellor"));
const publicly = (plot: string, effects: GwEffect[]): GwOption => ({
  id: "make_public",
  when: plotConfirmed(plot),
  tell: [],
  effects,
});
/** An arrest on a cold plot: its faction takes it as the wrong it is. */
const wrongly = (plot: string, f: string): GwEffect => ({
  kind: "maybe",
  when: plotHot(plot, 0, 0),
  then: [heat(f, 2)],
});
const silence = (id: string): GwScene => ({
  id,
  nation: ["DEU"],
  kind: "wire",
  scheduledOnly: true,
  cast: {},
  salience: 5,
  tags: ["home", "tension_up"],
  variants: [{ id: "base" }],
});

const head = role("head");
const letterTo = (tone: "warm" | "cold"): GwEffect => ({
  kind: "letter",
  who: head,
  tone,
});
function askLetter(
  id: string,
  from: "AUH" | "OTT",
  yes: GwEffect[],
  variants: GwVariant[] = [{ id: "base" }],
): GwScene {
  return {
    id,
    nation: ["DEU"],
    kind: "letter",
    who: "head",
    scheduledOnly: true,
    once: true,
    cast: { head: { ruler_of: from } },
    salience: 7,
    tags: ["foreign"],
    variants,
    fallback: "yes",
    options: [
      opt("yes", [answerAsk(id, true), letterTo("warm"), ...yes]),
      opt("no", [answerAsk(id, false), letterTo("cold")]),
    ],
  };
}

/** Plot signs, warnings, steps; step-four silences; asks and Pless. */
export const DEU_PLOT_SCENES: readonly GwScene[] = [
  // The army plot.
  sign("deu_pl_army_s1", "wire"),
  slip("deu_pl_army_s2", either(person("deu_groener"), office("war"))),
  sign("deu_pl_army_s3", "report"),
  plotPaper("deu_pl_army_w", chancellor, [
    opt("post_colonel", [
      coolPlot("deu_pl_army", 3),
      heat("deu_ohl", 1),
      r("pl_army_posted"),
    ]),
    opt("give_office", [
      coolPlot("deu_pl_army", 2),
      cool("deu_ohl", 2),
      inst("countersign", -1),
      r("pl_army_office"),
    ]),
    publicly("deu_pl_army", [
      coolPlot("deu_pl_army", 4),
      inst("army", -1),
      inst("reichstag", 1),
      r("pl_army_public"),
    ]),
    opt("wait", [r("pl_army_wait")]),
  ]),
  plotPaper("deu_pl_army_1", leaderOf("deu_ohl"), [
    opt("give_way", [
      coolPlot("deu_pl_army", 3),
      inst("army", 1),
      inst("countersign", -2),
      r("pl_army_gave"),
    ]),
    opt("relieve_quartermaster", [
      beatPlot("deu_pl_army"),
      heatPlot("deu_pl_right", 3),
      inst("army", -2),
      wrongly("deu_pl_army", "deu_ohl"),
      r("pl_army_relieved"),
    ]),
    publicly("deu_pl_army", [
      coolPlot("deu_pl_army", 4),
      inst("army", -1),
      r("pl_army_public"),
    ]),
    opt("wait", [r("pl_army_wait")]),
  ]),
  plotPaper("deu_pl_army_2", leaderOf("deu_ohl"), [
    opt("relieve_both", [
      beatPlot("deu_pl_army"),
      heatPlot("deu_pl_right", 3),
      inst("army", -3),
      gauge("morale", -1),
      r("pl_army_beaten"),
    ]),
    opt("hand_war", [
      coolPlot("deu_pl_army", 8),
      inst("army", 2),
      inst("countersign", -3),
      inst("reichstag", -1),
      r("pl_army_handed"),
    ]),
    opt("wait", [r("pl_army_wait")]),
  ]),
  // The Pan-German plot.
  sign("deu_pl_right_s1", "wire"),
  slip("deu_pl_right_s2", either(office("court"), office("interior"))),
  sign("deu_pl_right_s3", "report"),
  plotPaper("deu_pl_right_w", chancellor, [
    opt("aims_talk", [
      coolPlot("deu_pl_right", 2),
      cool("deu_fatherland", 2),
      heat("deu_spd", 1),
      r("pl_right_aims"),
    ]),
    opt("press_close", [
      coolPlot("deu_pl_right", 2),
      censor(1),
      heat("deu_fatherland", 1),
      r("pl_right_press"),
    ]),
    publicly("deu_pl_right", [
      coolPlot("deu_pl_right", 4),
      cool("deu_centre", 1),
      cool("deu_progress", 1),
      r("pl_right_public"),
    ]),
    opt("wait", [r("pl_right_wait")]),
  ]),
  plotPaper("deu_pl_right_1", leaderOf("deu_fatherland"), [
    opt("officers_out", [
      coolPlot("deu_pl_right", 3),
      inst("army", -1),
      r("pl_right_officers"),
    ]),
    opt("arrest_circle", [
      beatPlot("deu_pl_right"),
      heatPlot("deu_pl_army", 3),
      heat("deu_cons", 1),
      wrongly("deu_pl_right", "deu_fatherland"),
      r("pl_right_arrest"),
    ]),
    publicly("deu_pl_right", [
      coolPlot("deu_pl_right", 4),
      heat("deu_fatherland", 1),
      r("pl_right_public"),
    ]),
    opt("wait", [r("pl_right_wait")]),
  ]),
  plotPaper("deu_pl_right_2", leaderOf("deu_fatherland"), [
    opt("refuse_proclamation", [
      beatPlot("deu_pl_right"),
      heatPlot("deu_pl_army", 3),
      inst("army", -1),
      r("pl_right_beaten"),
    ]),
    opt("their_chancellor", [
      coolPlot("deu_pl_right", 8),
      inst("reichstag", -2),
      inst("countersign", -2),
      heat("deu_centre", 2),
      heat("deu_spd", 2),
      r("pl_right_handed"),
    ]),
    opt("wait", [r("pl_right_wait")]),
  ]),
  // The red plot.
  sign("deu_pl_red_s1", "wire"),
  slip("deu_pl_red_s2", either(person("deu_ebert"), office("interior"))),
  sign("deu_pl_red_s3", "report"),
  plotPaper("deu_pl_red_w", police, [
    opt("bread_now", [coolPlot("deu_pl_red", 3), money(-1), r("pl_red_bread")]),
    opt("stewards_talk", [
      coolPlot("deu_pl_red", 2),
      cool("deu_uspd", 1),
      heat("deu_ohl", 1),
      r("pl_red_talk"),
    ]),
    publicly("deu_pl_red", [
      coolPlot("deu_pl_red", 3),
      gauge("order", 1),
      r("pl_red_public"),
    ]),
    opt("wait", [r("pl_red_wait")]),
  ]),
  plotPaper("deu_pl_red_1", police, [
    opt("meet_strikers", [
      coolPlot("deu_pl_red", 3),
      heat("deu_ohl", 2),
      inst("army", -1),
      r("pl_red_met"),
    ]),
    opt("arrest_stewards", [
      beatPlot("deu_pl_red"),
      heatPlot("deu_pl_army", 3),
      heat("deu_uspd", 2),
      wrongly("deu_pl_red", "deu_uspd"),
      r("pl_red_arrest"),
    ]),
    opt("wait", [r("pl_red_wait")]),
  ]),
  plotPaper("deu_pl_red_2", police, [
    opt("peace_note", [
      coolPlot("deu_pl_red", 8),
      heat("deu_ohl", 2),
      heat("deu_fatherland", 2),
      r("pl_red_peace"),
    ]),
    opt("sailors_ashore", [
      beatPlot("deu_pl_red"),
      heatPlot("deu_pl_army", 3),
      gauge("order", -1),
      r("pl_red_beaten"),
    ]),
    opt("wait", [r("pl_red_wait")]),
  ]),
  // Temper four: the faction stops asking.
  silence("deu_f_ohl_4"),
  silence("deu_f_fatherland_4"),
  silence("deu_f_spartacus_4"),
  // Allies' asks.
  askLetter("deu_ask_east", "AUH", []),
  askLetter("deu_ask_loan", "AUH", [money(-1)]),
  {
    ...askLetter("deu_ask_italy", "AUH", []),
    assumes: { line: { italy: ["isonzo", "isonzo"] } },
  },
  askLetter("deu_ask_gold", "OTT", [money(-1)]),
  {
    id: "deu_conf_pless",
    nation: ["DEU"],
    kind: "talk",
    big: true,
    scheduledOnly: true,
    salience: 9,
    tags: ["foreign", "war"],
    cast: {
      head: { ruler_of: "AUH" },
      cos: either(office("chief_of_staff"), office("war")),
    },
    who: "head",
    variants: [{ id: "base" }],
    start: "n1",
    nodes: {
      n1: {
        says: [{ id: "base" }],
        replies: [reply("hear", "warm", "ask", "n2")],
      },
      n2: {
        who: "cos",
        says: [{ id: "base" }],
        replies: [reply("go_on", "frank", "ask", "n3")],
      },
      n3: {
        fallback: "two_commands",
        says: [{ id: "base" }],
        replies: [
          {
            ...reply("one_command", "frank", "decide", null),
            effects: [
              answerAsk("deu_conf_pless", true),
              setFlag("f_pless_command"),
              inst("army", 1),
            ],
          },
          {
            ...reply("two_commands", "frank", "decide", null),
            effects: [answerAsk("deu_conf_pless", false)],
          },
        ],
      },
    },
  },
];
