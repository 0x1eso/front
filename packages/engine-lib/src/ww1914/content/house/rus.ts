import type {
  GwCond,
  GwEffect,
  GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";
import {
  all,
  any,
  chose,
  decide,
  flag,
  not,
  reason,
  remember,
  role,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import type {
  GwAskRow,
  GwBillRow,
  GwFactionRow,
  GwPlotRow,
  GwWeakRow,
} from "../../HouseRows";
import type { GwLawRow } from "../../LawRows";
import {
  draft,
  either,
  gauge,
  held,
  inst,
  isText,
  lawTalk,
  office,
  person,
  since,
  war,
} from "../laws/kit";
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

// RUS's house: factions, what they make of each bill, their own bills, and
// (S2) plots, weaknesses and allies' asks (ww158-format.md). Text in
// resources/ww1914/ko/RUS.house.json. The house itself (chambers, whip, way
// round) is in ./houses.ts and comes into play once this file has factions.
//
// ww203: real seats. The Fourth Duma (1912) has 442: Rights 65,
// Nationalists and moderate right 88 and the Centre 32 (all three
// `rus_rights`; the Centre and Shulgin's Progressive Nationalists, about 38,
// leave as `rus_pnat` in 1915), Octobrists 98, Kadets 59, Progressists 48,
// Trudoviks 10, Social Democrats 14 (Chkheidze's 8 Mensheviks, and the
// Bolsheviks' 5 once Malinovsky resigned in May 1914), and 29 no faction holds
// here (non-party 7, the Polish Kolo 9, the Muslim group 6, the
// Belarusian-Lithuanian-Polish group 6, Malinovsky's empty seat): they stay
// away. The State Council (196: 98 appointed, 98 elected) has the Right
// group 70 (Durnovo's, the United Nobility's men: `rus_nobles`), the Right
// Centre 20 (`rus_rights`), the Centre about 50 (`rus_octob`) and the Left,
// the academic group, 19 (`rus_kadets`); the non-party circle and the
// unattached stay away. A bill the nobles and the Rights hate dies in the
// Council unless someone pays Durnovo's price, or the Duma is not sitting and
// Article 87 carries it (houses.ts). Sources: ru.wikipedia (the Fourth Duma;
// the State Council's groups, 1915 and 1917); the Progressive Nationalists'
// size and the Centre's in 1915 are not checked.

/** While there is a sovereign to sign. */
const crowned = world({ is: "regime", of: ["tsar", "crown", "regency"] });
/** A ministry the Duma trusts (the bloc's demand). */
const trusted = world({ is: "regime", of: ["crown"] });
/** The Duma sits (gov.ts sets it). */
const sitting = flag("f_gov_rus_session");
/** The east has fallen back from the Vistula. */
const retreat = world({
  is: "front",
  theatre: "east",
  from: "vistula",
  to: "kiev",
});
const blocAt = (
  bloc: "army" | "court" | "parliament" | "business" | "workers",
  o: { min?: number; max?: number },
): GwCond => ({ kind: "bloc", bloc, ...o });
const morale = (min: number): GwCond => ({
  kind: "gauge",
  gauge: "morale",
  min,
});
const inOffice = (p: string): GwCond => ({
  kind: "in_office",
  who: { person: p },
});
const steps = (id: string, a = 3, b = 7) => [
  { at: a, scene: `rus_f_${id}_2` },
  { at: b, scene: `rus_f_${id}_3` },
];
const leader = (id: string) => ({ leader: leaderOf(id) });
const why = (key: string): GwEffect => reason(key);

export const RUS_FACTIONS: readonly GwFactionRow[] = [
  {
    id: "rus_rights",
    tag: "RUS",
    camps: ["court"],
    bloc: "court",
    start: "in",
    strength: 3,
    // Rights 65, Nationalists 88, the Centre 32; the Council's Right Centre.
    seats: { duma: 185, council: 20 },
    // Khvostov chairs the Right faction until he takes a ministry; Markov
    // after him. Purishkevich is the one who breaks ranks.
    leaders: [
      { person: "rus_khvostov", when: not(inOffice("rus_khvostov")) },
      { person: "rus_i_markov" },
    ],
    radical: "rus_i_purishkevich",
    grows: [
      { when: all(war, morale(3)), by: 1, every: 6, key: "rights_flags" },
      {
        when: all(low("shells", 0), retreat),
        by: -1,
        every: 6,
        key: "rights_retreat",
      },
    ],
    feeds: [
      { when: blocAt("court", { max: -3 }), key: "court_turned" },
      { when: isLaw("rus_amnesty"), key: "amnesty_law" },
      { when: isLaw("rus_pale"), key: "pale_law" },
      { when: isLaw("rus_poland"), key: "poland_law" },
    ],
    cools: [
      { when: isLaw("rus_victory"), key: "victory_law" },
      { when: isLaw("rus_press"), key: "censor_law" },
    ],
    steps: steps("rights"),
    bills: ["rus_victory", "rus_press"],
    wants: [
      {
        id: "rights_text",
        kind: "concession",
        when: world({ is: "amendable", id: "rus_rights" }),
      },
      {
        id: "victory_next",
        kind: "next",
        when: not(isLaw("rus_victory")),
        keep: isLaw("rus_victory"),
        chapters: 10,
      },
      {
        id: "khvostov_post",
        kind: "post",
        when: all(
          not(inOffice("rus_khvostov")),
          world({ is: "date", from: "1915-06" }),
        ),
        keep: inOffice("rus_khvostov"),
        chapters: 6,
      },
      { id: "train_money", kind: "money", effects: [gauge("money", -1)] },
    ],
    amends: {
      rus_councils: "defence_alone",
      rus_grain: "trains_first",
      rus_war_tax: "war_profits",
    },
    splits: {
      when: all(
        faction("rus_bloc", { of: ["in"] }),
        not(chose("rus_h_bloc", "prorogue")),
      ),
      into: "rus_pnat",
      takes: 1,
      // The Centre 32 and the Progressive Nationalists about 38: approximate
      // (ww204 M: the bloc's 236 is checked, the group's own size is not).
      seats: { duma: 70 },
      scene: "rus_f_pnat",
    },
  },
  {
    id: "rus_pnat",
    tag: "RUS",
    camps: ["duma"],
    bloc: "parliament",
    start: "out",
    strength: 1,
    seats: { duma: 70 },
    leaders: [{ person: "rus_i_shulgin" }],
    feeds: [
      { when: blocAt("parliament", { max: -3 }), key: "duma_turned" },
      { when: isLaw("rus_pale"), key: "pale_law" },
    ],
    cools: [{ when: isLaw("rus_volost"), key: "volost_law" }],
    steps: steps("pnat"),
    bills: ["rus_volost"],
    wants: [
      {
        id: "pnat_text",
        kind: "concession",
        when: world({ is: "amendable", id: "rus_pnat" }),
      },
      {
        id: "zemstvo_west",
        kind: "next",
        when: not(isLaw("rus_volost")),
        keep: isLaw("rus_volost"),
        chapters: 10,
      },
      { id: "front_aid", kind: "money", effects: [gauge("money", -1)] },
    ],
    amends: { rus_poland: "autonomy_word" },
  },
  {
    id: "rus_octob",
    tag: "RUS",
    plot: "rus_pl_palace",
    camps: ["duma"],
    bloc: "business",
    start: "in",
    strength: 2,
    // The Duma's 98; the Council's Centre about 50: approximate (ww204 M:
    // the 1917 figure; 1915 not found).
    seats: { duma: 98, council: 50 },
    leaders: [{ person: "rus_guchkov" }, { person: "rus_rodzianko" }],
    grows: [
      {
        when: all(war, low("shells", 0)),
        by: 1,
        every: 6,
        key: "shells_short",
      },
    ],
    feeds: [
      { when: blocAt("business", { max: -3 }), key: "business_turned" },
      {
        when: all(low("shells", 0), not(isLaw("rus_councils")), warAge(9)),
        key: "councils_wait",
      },
    ],
    cools: [
      { when: isLaw("rus_councils"), key: "councils_law" },
      { when: isLaw("rus_volost"), key: "volost_law" },
    ],
    steps: steps("octob"),
    bills: ["rus_volost", "rus_councils"],
    wants: [
      {
        id: "octob_text",
        kind: "concession",
        when: world({ is: "amendable", id: "rus_octob" }),
      },
      // Guchkov's old feud: the war minister who had no shells.
      {
        id: "sukhomlinov_out",
        kind: "promise",
        when: inOffice("rus_sukhomlinov"),
        keep: not(inOffice("rus_sukhomlinov")),
        chapters: 4,
      },
      // Polivanov, Guchkov's man at the War Ministry (minister June 1915).
      {
        id: "polivanov_post",
        kind: "post",
        when: all(
          not(inOffice("rus_polivanov")),
          not(inOffice("rus_sukhomlinov")),
        ),
        keep: inOffice("rus_polivanov"),
        chapters: 4,
      },
      {
        id: "volost_next",
        kind: "next",
        when: not(isLaw("rus_volost")),
        keep: isLaw("rus_volost"),
        chapters: 10,
      },
      {
        id: "committee_orders",
        kind: "money",
        effects: [gauge("money", -1), heat("rus_circle", 1)],
      },
    ],
    amends: {
      rus_councils: "with_zemgor",
      rus_finland: "quiet_governor",
      rus_pale: "refugees_only",
      rus_amnesty: "no_bombs",
      rus_army_zone: "civil_governors",
    },
  },
  {
    id: "rus_kadets",
    tag: "RUS",
    camps: ["liberal"],
    bloc: "parliament",
    start: "in",
    strength: 2,
    // The Duma's 59; the Council's academic group, the Left (19).
    seats: { duma: 59, council: 19 },
    leaders: [{ person: "rus_milyukov" }, { person: "rus_shingarev" }],
    radical: "rus_i_nekrasov",
    grows: [
      {
        when: all(low("shells", 0), retreat),
        by: 1,
        every: 6,
        key: "kadets_retreat",
      },
      { when: morale(4), by: -1, every: 6, key: "kadets_quiet" },
    ],
    feeds: [
      { when: blocAt("parliament", { max: -3 }), key: "duma_turned" },
      { when: all(not(sitting), warAge(12)), key: "duma_shut" },
      { when: chose("rus_h_bloc", "prorogue"), key: "bloc_prorogued", by: 2 },
      { when: isText("rus_press", "stavka_reads"), key: "censor_hard" },
    ],
    cools: [
      { when: isLaw("rus_amnesty"), key: "amnesty_law" },
      { when: trusted, key: "confidence", by: 2 },
      { when: sitting, key: "duma_sits" },
    ],
    steps: steps("kadets"),
    bills: ["rus_amnesty", "rus_poland"],
    wants: [
      {
        id: "kadets_text",
        kind: "concession",
        when: world({ is: "amendable", id: "rus_kadets" }),
      },
      {
        id: "confidence",
        kind: "promise",
        when: all(warAge(10), not(trusted)),
        keep: trusted,
        chapters: 10,
      },
      {
        id: "amnesty_next",
        kind: "next",
        when: not(isLaw("rus_amnesty")),
        keep: isLaw("rus_amnesty"),
        chapters: 10,
      },
      {
        id: "session",
        kind: "promise",
        when: not(sitting),
        keep: sitting,
        chapters: 4,
      },
    ],
    amends: {
      rus_press: "duma_speeches_free",
      rus_ratniki: "not_only_sons",
      rus_poland: "charter",
      rus_victory: "with_allies",
      rus_army_zone: "no_expulsions",
      rus_great_programme: "guns_first",
    },
    // The Progressive Bloc: rus_h_bloc's talks (or its ministry), else the
    // same state by another road. It falls apart once it is a handful again.
    joins: {
      with: ["rus_octob", "rus_progress"],
      when: any(
        flag("f_bloc_talks"),
        chose("rus_h_bloc", "confidence"),
        all(low("shells", 0), retreat, sitting, warAge(9)),
      ),
      into: "rus_bloc",
      parts: all(faction("rus_bloc", { max: 1 }), warAge(24)),
      scene: "rus_f_bloc",
    },
  },
  {
    id: "rus_progress",
    tag: "RUS",
    camps: ["duma"],
    bloc: "business",
    start: "in",
    strength: 1,
    seats: { duma: 48 },
    leaders: [{ person: "rus_i_konovalov" }],
    grows: [
      {
        when: all(war, low("shells", 0)),
        by: 1,
        every: 6,
        key: "progress_shells",
      },
    ],
    feeds: [
      { when: blocAt("business", { max: -3 }), key: "business_turned" },
      {
        when: all(not(isLaw("rus_councils")), warAge(12)),
        key: "committees_out",
      },
    ],
    cools: [{ when: isLaw("rus_councils"), key: "councils_law" }],
    steps: steps("progress"),
    bills: ["rus_councils", "rus_volost"],
    wants: [
      {
        id: "progress_text",
        kind: "concession",
        when: world({ is: "amendable", id: "rus_progress" }),
      },
      {
        id: "committees_in",
        kind: "next",
        when: not(isLaw("rus_councils")),
        keep: isLaw("rus_councils"),
        chapters: 8,
      },
      { id: "moscow_orders", kind: "money", effects: [gauge("money", -1)] },
    ],
    amends: {
      rus_dry: "wine_and_beer",
      rus_factories: "workers_group",
      rus_councils: "with_zemgor",
      rus_war_tax: "loans_only",
    },
  },
  {
    id: "rus_bloc",
    tag: "RUS",
    camps: ["duma"],
    bloc: "parliament",
    start: "out",
    strength: 3,
    // Pooled from its parties when it forms (the Duma's 236 by the bloc's
    // own count, with Shulgin's men); these are the three parties' seats.
    seats: { duma: 205, council: 69 },
    leaders: [{ person: "rus_milyukov" }, { person: "rus_i_shidlovsky" }],
    radical: "rus_i_nekrasov",
    grows: [
      {
        when: all(war, low("shells", 0)),
        by: 1,
        every: 6,
        key: "bloc_shells",
      },
    ],
    feeds: [
      { when: all(not(sitting), warAge(12)), key: "duma_shut" },
      { when: blocAt("parliament", { max: -3 }), key: "duma_turned" },
    ],
    cools: [
      { when: trusted, key: "confidence", by: 2 },
      { when: isLaw("rus_amnesty"), key: "amnesty_law" },
      { when: sitting, key: "duma_sits" },
    ],
    steps: steps("bloc"),
    bills: ["rus_amnesty", "rus_volost", "rus_poland", "rus_pale"],
    wants: [
      {
        id: "bloc_text",
        kind: "concession",
        when: world({ is: "amendable", id: "rus_bloc" }),
      },
      {
        id: "confidence",
        kind: "promise",
        when: not(trusted),
        keep: trusted,
        chapters: 10,
      },
      {
        id: "amnesty_next",
        kind: "next",
        when: not(isLaw("rus_amnesty")),
        keep: isLaw("rus_amnesty"),
        chapters: 10,
      },
      // Zemgor (the zemstvo and town unions) ran on the treasury's money.
      { id: "zemgor_money", kind: "money", effects: [gauge("money", -1)] },
    ],
    amends: {
      rus_press: "duma_speeches_free",
      rus_councils: "with_zemgor",
      rus_factories: "workers_group",
    },
  },
  {
    id: "rus_trud",
    tag: "RUS",
    bloc: "workers",
    start: "in",
    strength: 1,
    seats: { duma: 10 },
    leaders: [{ person: "rus_kerensky" }],
    grows: [
      {
        when: all(low("bread", 0), warAge(12)),
        by: 1,
        every: 6,
        key: "trud_bread",
      },
    ],
    feeds: [
      { when: blocAt("workers", { max: -3 }), key: "workers_turned" },
      { when: isLaw("rus_factories"), key: "strike_law" },
      { when: faction("rus_bolsh", { of: ["under"] }), key: "deputies_taken" },
    ],
    cools: [
      { when: isLaw("rus_peasants"), key: "peasants_law" },
      { when: isLaw("rus_amnesty"), key: "amnesty_law" },
    ],
    steps: steps("trud"),
    bills: ["rus_peasants", "rus_amnesty"],
    wants: [
      {
        id: "trud_text",
        kind: "concession",
        when: world({ is: "amendable", id: "rus_trud" }),
      },
      {
        id: "peasants_next",
        kind: "next",
        when: not(isLaw("rus_peasants")),
        keep: isLaw("rus_peasants"),
        chapters: 10,
      },
      // A word said in public: kept the moment it is said.
      {
        id: "land_word",
        kind: "promise",
        keep: crowned,
        effects: [heat("rus_nobles", 1)],
      },
      { id: "soldier_wives", kind: "money", effects: [gauge("money", -1)] },
    ],
    amends: { rus_ratniki: "land_after", rus_peasants: "captains_go" },
  },
  {
    id: "rus_sd",
    tag: "RUS",
    bloc: "workers",
    start: "in",
    strength: 1,
    // Chkheidze's Mensheviks (with Jagiełło) after the 1913 split.
    seats: { duma: 8 },
    leaders: [{ person: "rus_chkheidze" }],
    grows: [
      {
        when: all(low("bread", 0), warAge(18)),
        by: 1,
        every: 6,
        key: "sd_bread",
      },
    ],
    feeds: [
      { when: blocAt("workers", { max: -3 }), key: "workers_turned" },
      { when: isLaw("rus_factories"), key: "strike_law" },
      { when: faction("rus_bolsh", { of: ["under"] }), key: "deputies_taken" },
    ],
    cools: [{ when: isLaw("rus_amnesty"), key: "amnesty_law" }],
    steps: steps("sd"),
    bills: ["rus_amnesty", "rus_peasants"],
    wants: [
      {
        id: "amnesty_next",
        kind: "next",
        when: not(isLaw("rus_amnesty")),
        keep: isLaw("rus_amnesty"),
        chapters: 10,
      },
      // The 1912 insurance funds left to meet: kept while the crown stands.
      {
        id: "sick_funds",
        kind: "promise",
        keep: crowned,
        effects: [heat("rus_rights", 1)],
      },
    ],
  },
  {
    // The five Bolshevik deputies (six until Malinovsky resigned in May 1914;
    // Petrovsky chairs them); Lenin once he is back. They vote no on every war
    // bill and nobody can buy them; held ("under"), they sit no more.
    id: "rus_bolsh",
    tag: "RUS",
    plot: "rus_pl_red",
    bloc: "workers",
    start: "in",
    strength: 1,
    seats: { duma: 5 },
    leaders: [{ person: "rus_lenin" }, { person: "rus_i_petrovsky" }],
    grows: [
      {
        when: all(low("bread", 0), warAge(24)),
        by: 1,
        every: 4,
        key: "bolsh_bread",
      },
      {
        when: { kind: "gauge", gauge: "order", max: 1 },
        by: 1,
        every: 6,
        key: "bolsh_order",
      },
    ],
    feeds: [
      { when: blocAt("workers", { max: -3 }), key: "workers_turned" },
      { when: isLaw("rus_factories"), key: "strike_law" },
      { when: low("bread", 0), key: "bread_gone" },
    ],
    cools: [{ when: morale(4), key: "war_popular" }],
    steps: steps("bolsh"),
  },
  {
    id: "rus_nobles",
    tag: "RUS",
    camps: ["court"],
    bloc: "court",
    start: "in",
    strength: 2,
    // The State Council's Right group (70 in 1915), Durnovo's.
    seats: { council: 70 },
    leaders: [{ person: "rus_durnovo" }, { person: "rus_i_shcheglovitov" }],
    feeds: [
      { when: isLaw("rus_volost"), key: "volost_law" },
      { when: isLaw("rus_peasants"), key: "peasants_law" },
      { when: isText("rus_grain", "quota_levy"), key: "levy" },
    ],
    cools: [
      { when: blocAt("court", { min: 2 }), key: "court_strong" },
      { when: isLaw("rus_victory"), key: "victory_law" },
    ],
    steps: steps("nobles"),
    wants: [
      {
        id: "nobles_text",
        kind: "concession",
        when: world({ is: "amendable", id: "rus_nobles" }),
      },
      // Words to the Council's Right: kept while they hold.
      {
        id: "volost_shelved",
        kind: "promise",
        when: not(isLaw("rus_volost")),
        keep: not(isLaw("rus_volost")),
        chapters: 10,
        effects: [heat("rus_octob", 1)],
      },
      {
        id: "governors_kept",
        kind: "promise",
        keep: not(trusted),
        chapters: 10,
        effects: [heat("rus_kadets", 1)],
      },
    ],
    amends: {
      rus_grain: "trains_first",
      rus_poland: "autonomy_word",
      rus_volost: "land_curia",
      rus_peasants: "after_war",
      rus_war_tax: "loans_only",
    },
  },
  {
    id: "rus_stavka",
    tag: "RUS",
    plot: "rus_pl_generals",
    bloc: "army",
    start: "in",
    strength: 3,
    seats: {},
    leaders: [
      {
        person: "rus_yanushkevich",
        when: {
          kind: "holder",
          office: "chief_of_staff",
          person: "rus_yanushkevich",
        },
      },
      { person: "rus_alekseev" },
    ],
    feeds: [
      { when: all(war, low("shells", 0)), key: "shells_out" },
      { when: blocAt("army", { max: -3 }), key: "army_turned" },
      { when: { kind: "inst", inst: "stavka", max: -3 }, key: "unheard" },
    ],
    cools: [
      { when: isLaw("rus_ratniki"), key: "ratniki_law" },
      { when: isLaw("rus_factories"), key: "factories_law" },
    ],
    steps: steps("stavka", 4, 8),
    bills: ["rus_ratniki", "rus_factories"],
  },
  {
    id: "rus_circle",
    tag: "RUS",
    bloc: "court",
    start: "in",
    strength: 2,
    seats: {},
    leaders: [{ person: "rus_rasputin" }, { person: "rus_protopopov" }],
    feeds: [
      { when: isLaw("rus_councils"), key: "councils_law" },
      { when: sitting, key: "duma_sits" },
      { when: trusted, key: "confidence", by: 2 },
    ],
    cools: [
      { when: chose("rus_h_bloc", "prorogue"), key: "bloc_prorogued" },
      { when: blocAt("court", { min: 2 }), key: "court_strong" },
    ],
    steps: steps("circle", 4, 8),
  },
];

/** Stances on the bills, by law id: existing bills and the factions' own. */
export const RUS_BILLS: readonly GwBillRow[] = [
  {
    law: "rus_press",
    around: true,
    creed: ["rus_sd", "rus_bolsh"],
    stance: {
      rus_rights: 1,
      rus_nobles: 1,
      rus_kadets: -1,
      rus_progress: -1,
      rus_trud: -1,
      rus_sd: -1,
      rus_bloc: -1,
      rus_bolsh: -1,
    },
    texts: {
      duma_speeches_free: {
        rus_octob: 1,
        rus_kadets: 0,
        rus_progress: 0,
        rus_bloc: 0,
        rus_pnat: 1,
        rus_rights: 0,
      },
      stavka_reads: { rus_octob: -1, rus_pnat: -1 },
    },
  },
  {
    law: "rus_dry",
    around: true,
    stance: {
      rus_rights: 1,
      rus_octob: 1,
      rus_kadets: 1,
      rus_trud: 1,
      rus_bloc: 1,
      rus_pnat: 1,
      rus_bolsh: -1,
    },
    texts: {
      for_ever: { rus_progress: -1, rus_nobles: -1 },
      wine_and_beer: { rus_trud: 0, rus_rights: 0, rus_progress: 1 },
    },
  },
  {
    law: "rus_ratniki",
    around: true,
    creed: ["rus_bolsh"],
    stance: {
      rus_rights: 1,
      rus_octob: 1,
      rus_nobles: 1,
      rus_pnat: 1,
      rus_trud: -1,
      rus_sd: -1,
      rus_bolsh: -1,
    },
    texts: {
      land_after: {
        rus_trud: 1,
        rus_kadets: 1,
        rus_nobles: -1,
        rus_rights: -1,
      },
      not_only_sons: { rus_kadets: 1, rus_trud: 0, rus_bloc: 1 },
    },
  },
  {
    law: "rus_councils",
    around: true,
    sponsor: either(person("rus_polivanov"), office("war")),
    stance: {
      rus_octob: 1,
      rus_kadets: 1,
      rus_progress: 1,
      rus_trud: 1,
      rus_bloc: 1,
      rus_pnat: 1,
      rus_nobles: -1,
      rus_bolsh: -1,
    },
    texts: {
      with_zemgor: { rus_rights: -1, rus_nobles: -1 },
      defence_alone: {
        rus_kadets: 0,
        rus_progress: 0,
        rus_bloc: 0,
        rus_octob: 0,
        rus_rights: 1,
      },
    },
  },
  {
    law: "rus_factories",
    around: true,
    creed: ["rus_sd", "rus_bolsh"],
    stance: {
      rus_rights: 1,
      rus_octob: 1,
      rus_nobles: 1,
      rus_pnat: 1,
      rus_kadets: -1,
      rus_trud: -1,
      rus_sd: -1,
      rus_bolsh: -1,
    },
    texts: {
      workers_group: {
        rus_kadets: 1,
        rus_progress: 1,
        rus_bloc: 1,
        rus_trud: 0,
        rus_sd: 0,
        rus_rights: -1,
        rus_nobles: 0,
      },
      under_arms: { rus_octob: 0, rus_progress: -1, rus_bloc: -1 },
    },
  },
  {
    law: "rus_grain",
    around: true,
    stance: {
      rus_kadets: 1,
      rus_trud: 1,
      rus_sd: 1,
      rus_rights: -1,
      rus_nobles: -1,
      rus_bolsh: -1,
    },
    texts: {
      quota_levy: { rus_trud: -1, rus_rights: -1, rus_kadets: 0, rus_sd: 0 },
      trains_first: {
        rus_rights: 0,
        rus_nobles: 0,
        rus_progress: 1,
        rus_octob: 1,
      },
    },
  },
  {
    law: "rus_poland",
    around: true,
    creed: ["rus_rights"],
    stance: {
      rus_octob: 1,
      rus_kadets: 1,
      rus_progress: 1,
      rus_trud: 1,
      rus_sd: 1,
      rus_bloc: 1,
      rus_rights: -1,
      rus_nobles: -1,
      rus_bolsh: 1,
    },
    texts: {
      crown_of_poland: { rus_octob: 0, rus_pnat: -1 },
      autonomy_word: {
        rus_kadets: 0,
        rus_rights: 0,
        rus_nobles: 0,
        rus_pnat: 1,
      },
    },
  },
  {
    law: "rus_finland",
    around: true,
    creed: ["rus_rights"],
    stance: {
      rus_kadets: 1,
      rus_progress: 1,
      rus_trud: 1,
      rus_sd: 1,
      rus_bloc: 1,
      rus_rights: -1,
      rus_nobles: -1,
      rus_pnat: -1,
      rus_bolsh: 1,
    },
    texts: {
      diet_recalled: { rus_octob: -1, rus_bloc: 0 },
      quiet_governor: {
        rus_rights: 0,
        rus_nobles: 0,
        rus_octob: 1,
        rus_kadets: 0,
      },
    },
  },
  {
    law: "rus_pale",
    around: true,
    creed: ["rus_rights"],
    stance: {
      rus_kadets: 1,
      rus_progress: 1,
      rus_trud: 1,
      rus_sd: 1,
      rus_bloc: 1,
      rus_rights: -1,
      rus_nobles: -1,
      rus_pnat: -1,
      rus_bolsh: 1,
    },
    texts: {
      whole_pale: { rus_octob: -1, rus_bloc: 0 },
      refugees_only: {
        rus_rights: 0,
        rus_nobles: 0,
        rus_octob: 1,
        rus_pnat: 0,
      },
    },
  },
  {
    law: "rus_amnesty",
    by: "rus_kadets",
    around: true,
    creed: ["rus_rights"],
    stance: {
      rus_kadets: 1,
      rus_progress: 1,
      rus_trud: 1,
      rus_sd: 1,
      rus_bloc: 1,
      rus_rights: -1,
      rus_nobles: -1,
      rus_bolsh: 1,
    },
    texts: {
      faith_only: {
        rus_octob: 1,
        rus_pnat: 1,
        rus_rights: 0,
        rus_sd: 0,
        rus_trud: 0,
      },
      no_bombs: { rus_octob: 1, rus_sd: 0 },
    },
  },
  {
    law: "rus_volost",
    by: "rus_octob",
    around: true,
    stance: {
      rus_octob: 1,
      rus_kadets: 1,
      rus_progress: 1,
      rus_trud: 1,
      rus_bloc: 1,
      rus_pnat: 1,
      rus_rights: -1,
      rus_nobles: -1,
      rus_bolsh: 1,
    },
    texts: {
      land_curia: {
        rus_nobles: 0,
        rus_rights: 0,
        rus_trud: 0,
        rus_kadets: 0,
      },
      west_too: { rus_pnat: -1 },
    },
  },
  {
    law: "rus_peasants",
    by: "rus_trud",
    around: true,
    stance: {
      rus_octob: 1,
      rus_kadets: 1,
      rus_progress: 1,
      rus_trud: 1,
      rus_sd: 1,
      rus_bloc: 1,
      rus_rights: -1,
      rus_nobles: -1,
      rus_bolsh: 1,
    },
    texts: {
      captains_go: { rus_octob: 0, rus_pnat: -1 },
      after_war: { rus_trud: 0, rus_sd: -1, rus_nobles: 0, rus_rights: 0 },
    },
  },
  {
    law: "rus_victory",
    by: "rus_rights",
    resolution: true,
    creed: ["rus_sd", "rus_bolsh"],
    stance: {
      rus_rights: 1,
      rus_octob: 1,
      rus_nobles: 1,
      rus_pnat: 1,
      rus_trud: -1,
      rus_sd: -1,
      rus_bolsh: -1,
    },
    texts: {
      with_allies: { rus_kadets: 1, rus_progress: 1, rus_bloc: 1 },
      tsar_and_army: { rus_octob: 0, rus_kadets: -1, rus_bloc: -1 },
    },
  },
  // + check (ww203): the government's bills that had no house row.
  {
    // The Great Programme passed the Duma in June 1914; the Social Democrats
    // and the Trudoviks voted no.
    law: "rus_great_programme",
    around: true,
    money: true,
    creed: ["rus_bolsh"],
    stance: {
      rus_rights: 1,
      rus_octob: 1,
      rus_pnat: 1,
      rus_progress: 1,
      rus_nobles: 1,
      rus_trud: -1,
      rus_sd: -1,
      rus_bolsh: -1,
    },
    texts: {
      whole_by_taxes: { rus_progress: 0, rus_nobles: 0, rus_kadets: -1 },
      guns_first: { rus_kadets: 1 },
    },
  },
  {
    // Bark's income tax: the Duma passed it, the State Council took it in
    // March 1916, signed 6 April 1916 (from 1917). The war-profits tax came
    // on 13 May 1916.
    law: "rus_war_tax",
    around: true,
    money: true,
    stance: {
      rus_octob: 1,
      rus_kadets: 1,
      rus_pnat: 1,
      rus_bloc: 1,
      rus_trud: 1,
      rus_sd: 1,
      rus_nobles: -1,
      rus_bolsh: -1,
    },
    texts: {
      loans_only: {
        rus_rights: 1,
        rus_nobles: 1,
        rus_progress: 1,
        rus_octob: 0,
        rus_kadets: -1,
        rus_bloc: 0,
        rus_trud: -1,
        rus_sd: -1,
      },
      war_profits: {
        rus_rights: 1,
        rus_nobles: 0,
        rus_octob: -1,
        rus_progress: -1,
        rus_bloc: 0,
      },
    },
  },
  {
    // Who rules the army's zone: the Field Regulations of July 1914 gave it
    // to the generals; the Council of Ministers fought Stavka over it in 1915.
    law: "rus_army_zone",
    around: true,
    stance: {
      rus_rights: 1,
      rus_nobles: 1,
      rus_kadets: -1,
      rus_progress: -1,
      rus_bloc: -1,
      rus_trud: -1,
      rus_sd: -1,
      rus_bolsh: -1,
    },
    texts: {
      civil_governors: {
        rus_octob: 1,
        rus_pnat: 1,
        rus_kadets: 1,
        rus_progress: 1,
        rus_bloc: 1,
        rus_rights: 0,
        rus_trud: 0,
        rus_sd: 0,
      },
      no_expulsions: {
        rus_octob: 1,
        rus_kadets: 1,
        rus_progress: 1,
        rus_bloc: 1,
        rus_trud: 1,
        rus_sd: 0,
        rus_rights: -1,
      },
    },
  },
];

const row = (r: Omit<GwLawRow, "tag">): GwLawRow => ({ ...r, tag: "RUS" });
const opens = (...of: GwCond[]): GwCond => all(...of);

/** The factions' own bills: rows like content/laws/rus.ts. */
export const RUS_HOUSE_LAWS: readonly GwLawRow[] = [
  // The Kadets': the bloc's amnesty, political and religious.
  row({
    id: "rus_amnesty",
    chapter: "franchise",
    opens: opens(war, crowned, since("1915-07")),
    lean: -1,
    decree: true,
    cast: { interior: held("interior") },
    draft: [
      draft("full_amnesty", 0, [], [inst("court", -1)]),
      draft("faith_only", 1, []),
      draft("no_bombs", 1, []),
    ],
    passed: [inst("duma", 1), gauge("morale", 1)],
    passedTell: [],
    term: [{ gauge: "order", delta: -1, every: 12, text: ["full_amnesty"] }],
    flag: "f_law_amnesty",
    repeal: { authority: 20, tell: [], effects: [inst("duma", -2)] },
    talk: lawTalk("rus_amnesty", {
      who: person("rus_milyukov"),
      ask: "frank",
      push: "cold",
      tell: [],
      price: [inst("court", -1)],
      wins: 1,
      tempers: ["stubborn"],
    }),
  }),
  // The Octobrists': a zemstvo in every volost, all estates in it.
  row({
    id: "rus_volost",
    chapter: "franchise",
    opens: opens(war, crowned, since("1915-07")),
    lean: 0,
    decree: true,
    cast: { interior: held("interior") },
    draft: [
      draft("all_estates", 0, []),
      draft("land_curia", 1, []),
      draft("west_too", 0, [], [inst("court", -1)]),
    ],
    passed: [inst("duma", 1)],
    passedTell: [],
    term: [{ gauge: "bread", delta: 1, every: 10 }],
    flag: "f_law_volost",
    repeal: { authority: 15, tell: [], effects: [inst("duma", -1)] },
    talk: lawTalk("rus_volost", {
      who: either(person("rus_lvov"), person("rus_guchkov")),
      ask: "warm",
      push: "cold",
      tell: [],
      price: [inst("court", -1)],
      wins: 1,
    }),
  }),
  // The Trudoviks': the peasant the equal of anyone before the law.
  row({
    id: "rus_peasants",
    chapter: "franchise",
    opens: opens(war, crowned, since("1916-01")),
    lean: -1,
    decree: true,
    cast: { interior: held("interior"), agri: held("agriculture") },
    draft: [
      draft("rights_only", 1, []),
      draft("captains_go", 0, [], [inst("court", -1)]),
      draft("after_war", 1, []),
    ],
    passed: [gauge("morale", 1)],
    passedTell: [],
    term: [{ gauge: "order", delta: 1, every: 12 }],
    flag: "f_law_peasants",
    repeal: { authority: 20, tell: [], effects: [gauge("morale", -1)] },
    talk: lawTalk("rus_peasants", {
      who: person("rus_kerensky"),
      ask: "frank",
      push: "cold",
      tell: [],
      price: [inst("court", -1)],
      wins: 1,
      tempers: ["anxious"],
    }),
  }),
  // The Rights': the Duma's word that there is no peace before victory. A
  // resolution: no term, and no way round (it is the Duma's own voice).
  row({
    id: "rus_victory",
    chapter: "war_aims",
    opens: opens(war, crowned),
    lean: 1,
    decree: false,
    cast: { chancellor: held("chancellor") },
    draft: [
      draft("no_peace", 0, []),
      draft("with_allies", 1, []),
      draft("tsar_and_army", 0, [], [inst("court", 1)]),
    ],
    passed: [
      { kind: "trust", tag: "FRA", delta: 1 },
      { kind: "trust", tag: "GBR", delta: 1 },
      inst("stavka", 1),
    ],
    passedTell: [],
    term: [],
    repeal: { authority: 5, tell: [], effects: [] },
    talk: lawTalk("rus_victory", {
      who: either(person("rus_khvostov"), held("chancellor")),
      ask: "warm",
      push: "cold",
      tell: [],
      price: [inst("duma", -1)],
      wins: 1,
    }),
  }),
];

// ---- Scenes written by hand: steps, the split, the join ----

const audience = (
  id: string,
  cast: GwScene["cast"],
  options: GwScene["options"],
  extra: Partial<GwScene> = {},
): GwScene => ({
  id,
  nation: ["RUS"],
  kind: "audience",
  scheduledOnly: true,
  cast,
  salience: 6,
  tags: ["home", "people"],
  variants: [{ id: "base" }],
  fallback: options![options!.length - 1].id,
  options,
  ...extra,
});
const opt = (id: string, effects: GwEffect[], when?: GwCond) =>
  when === undefined
    ? { id, tell: [], effects }
    : { id, tell: [], effects, when };
const trustIn = (role: string, delta: number): GwEffect =>
  trustOf({ role }, delta);

/** Step, split and join scenes. */
export const RUS_HOUSE_SCENES: readonly GwScene[] = [
  // The Rights and Nationalists.
  audience("rus_f_rights_2", leader("rus_rights"), [
    opt("recess", [
      cool("rus_rights", 2),
      heat("rus_kadets", 1),
      heat("rus_bloc", 1),
      why("rus_f_rights_recess"),
    ]),
    opt("rebuke", [
      heat("rus_rights", 1),
      cool("rus_kadets", 1),
      why("rus_f_rights_rebuke"),
    ]),
    opt("hear", [trustIn("leader", 1), why("rus_f_rights_hear")]),
  ]),
  audience("rus_f_rights_3", leader("rus_rights"), [
    opt("train", [
      cool("rus_rights", 1),
      remember("k_purish_train"),
      why("rus_f_rights_train"),
    ]),
    opt("receive", [
      cool("rus_rights", 2),
      heat("rus_circle", 2),
      why("rus_f_rights_receive"),
    ]),
    opt("cut", [
      { kind: "censor", delta: 1 },
      heat("rus_kadets", 1),
      why("rus_f_rights_cut"),
    ]),
  ]),
  // The split: Shulgin's progressive nationalists leave for the bloc.
  {
    id: "rus_f_pnat",
    nation: ["RUS"],
    kind: "wire",
    scheduledOnly: true,
    once: true,
    cast: { leader: leaderOf("rus_pnat") },
    salience: 5,
    tags: ["home"],
    variants: [{ id: "base" }],
  },
  audience("rus_f_pnat_2", leader("rus_pnat"), [
    opt("aid", [
      gauge("money", -1),
      cool("rus_pnat", 2),
      why("rus_f_pnat_aid"),
    ]),
    opt("hear", [cool("rus_pnat", 1), why("rus_f_pnat_hear")]),
    opt("send_back", [heat("rus_pnat", 1), why("rus_f_pnat_back")]),
  ]),
  audience("rus_f_pnat_3", leader("rus_pnat"), [
    opt("kiev", [
      cool("rus_pnat", 2),
      heat("rus_rights", 1),
      why("rus_f_pnat_kiev"),
    ]),
    opt("let_go", [why("rus_f_pnat_let_go")]),
  ]),
  // The Octobrists.
  audience("rus_f_octob_2", leader("rus_octob"), [
    opt("orders", [
      gauge("money", -1),
      cool("rus_octob", 2),
      heat("rus_circle", 1),
      why("rus_f_octob_orders"),
    ]),
    opt("summon", [
      cool("rus_octob", 1),
      trustIn("leader", 1),
      why("rus_f_octob_summon"),
    ]),
    opt("ministry", [
      heat("rus_octob", 1),
      inst("ministers", 1),
      why("rus_f_octob_ministry"),
    ]),
  ]),
  audience("rus_f_octob_3", leader("rus_octob"), [
    opt("office", [
      cool("rus_octob", 2),
      heat("rus_circle", 2),
      why("rus_f_octob_office"),
    ]),
    opt("court_side", [
      heat("rus_octob", 1),
      cool("rus_circle", 1),
      why("rus_f_octob_court"),
    ]),
    opt("wait", [why("rus_f_octob_wait")]),
  ]),
  // The Kadets.
  audience("rus_f_kadets_2", leader("rus_kadets"), [
    opt("receive", [
      cool("rus_kadets", 2),
      heat("rus_circle", 1),
      why("rus_f_kadets_receive"),
    ]),
    opt("cut", [
      { kind: "censor", delta: 1 },
      heat("rus_kadets", 1),
      heat("rus_progress", 1),
      why("rus_f_kadets_cut"),
    ]),
    opt("let_speak", [
      cool("rus_kadets", 1),
      heat("rus_rights", 1),
      why("rus_f_kadets_let"),
    ]),
  ]),
  audience("rus_f_kadets_3", leader("rus_kadets"), [
    opt("milyukov", [
      cool("rus_kadets", 1),
      { kind: "person_trust", who: { person: "rus_milyukov" }, delta: 1 },
      why("rus_f_kadets_milyukov"),
    ]),
    opt("word", [
      cool("rus_kadets", 2),
      heat("rus_circle", 2),
      why("rus_f_kadets_word"),
    ]),
    opt("watch", [
      heat("rus_kadets", 1),
      heat("rus_progress", 1),
      why("rus_f_kadets_watch"),
    ]),
  ]),
  // The Progressists.
  audience("rus_f_progress_2", leader("rus_progress"), [
    opt("orders", [
      gauge("money", -1),
      cool("rus_progress", 2),
      why("rus_f_progress_orders"),
    ]),
    opt("summon", [cool("rus_progress", 1), why("rus_f_progress_summon")]),
    opt("let_be", [heat("rus_progress", 1), why("rus_f_progress_let")]),
  ]),
  audience(
    "rus_f_progress_3",
    leader("rus_progress"),
    [
      opt("workers", [
        cool("rus_progress", 2),
        heat("rus_rights", 1),
        why("rus_f_progress_workers"),
      ]),
      opt("bank", [
        gauge("money", -1),
        cool("rus_progress", 1),
        why("rus_f_progress_bank"),
      ]),
      opt("let_go", [why("rus_f_progress_go")]),
    ],
    // ww187: the walk-out from the Duma's votes: the Duma is there.
    { assumes: { sits: ["duma"] } },
  ),
  // The Progressive Bloc: its programme comes to the desk after the join.
  audience(
    "rus_f_bloc",
    leader("rus_bloc"),
    [
      opt("read", [
        cool("rus_bloc", 2),
        heat("rus_circle", 1),
        heat("rus_nobles", 1),
        why("rus_f_bloc_read"),
      ]),
      opt("study", [cool("rus_bloc", 1), why("rus_f_bloc_study")]),
      opt("return", [
        heat("rus_bloc", 2),
        cool("rus_circle", 1),
        why("rus_f_bloc_return"),
      ]),
    ],
    { once: true },
  ),
  audience("rus_f_bloc_2", leader("rus_bloc"), [
    opt("sit", [
      cool("rus_bloc", 2),
      heat("rus_circle", 2),
      why("rus_f_bloc_sit"),
    ]),
    opt("one_man", [
      cool("rus_bloc", 1),
      heat("rus_circle", 1),
      why("rus_f_bloc_one"),
    ]),
    opt("no", [heat("rus_bloc", 1), why("rus_f_bloc_no")]),
  ]),
  audience("rus_f_bloc_3", leader("rus_bloc"), [
    opt("rodzianko", [
      cool("rus_bloc", 1),
      { kind: "person_trust", who: { person: "rus_rodzianko" }, delta: 1 },
      why("rus_f_bloc_rodz"),
    ]),
    opt("ministry_word", [
      cool("rus_bloc", 2),
      heat("rus_circle", 2),
      heat("rus_nobles", 1),
      why("rus_f_bloc_word"),
    ]),
    opt("wait", [why("rus_f_bloc_wait")]),
  ]),
  // The Trudoviks.
  audience("rus_f_trud_2", leader("rus_trud"), [
    opt("meet", [cool("rus_trud", 1), why("rus_f_trud_meet")]),
    opt("bread", [
      gauge("money", -1),
      cool("rus_trud", 2),
      why("rus_f_trud_bread"),
    ]),
    opt("cut", [
      { kind: "censor", delta: 1 },
      heat("rus_trud", 1),
      why("rus_f_trud_cut"),
    ]),
  ]),
  audience("rus_f_trud_3", leader("rus_trud"), [
    opt("hear", [cool("rus_trud", 1), why("rus_f_trud_hear")]),
    opt("land", [
      cool("rus_trud", 2),
      heat("rus_nobles", 2),
      why("rus_f_trud_land"),
    ]),
    opt("let_go", [why("rus_f_trud_go")]),
  ]),
  // The Social Democrats.
  audience("rus_f_sd_2", leader("rus_sd"), [
    opt("inspectors", [cool("rus_sd", 1), why("rus_f_sd_inspectors")]),
    opt("wages", [
      gauge("money", -1),
      cool("rus_sd", 2),
      why("rus_f_sd_wages"),
    ]),
    opt("let_be", [heat("rus_sd", 1), why("rus_f_sd_let")]),
  ]),
  audience("rus_f_sd_3", leader("rus_sd"), [
    opt("hear", [cool("rus_sd", 1), why("rus_f_sd_hear")]),
    opt("funds", [
      cool("rus_sd", 2),
      heat("rus_rights", 1),
      why("rus_f_sd_funds"),
    ]),
    opt("let_go", [why("rus_f_sd_go")]),
  ]),
  // The Bolsheviks: the police bring their papers.
  audience(
    "rus_f_bolsh_2",
    { interior: held("interior") },
    [
      opt(
        "arrest",
        [
          under("rus_bolsh"),
          heat("rus_sd", 2),
          heat("rus_trud", 1),
          remember("k_bolsh_arrest"),
          why("rus_f_bolsh_arrest"),
        ],
        faction("rus_bolsh", { of: ["in"] }),
      ),
      opt("watch", [why("rus_f_bolsh_watch")]),
      opt("duma", [
        cool("rus_sd", 1),
        heat("rus_rights", 1),
        why("rus_f_bolsh_duma"),
      ]),
    ],
    {
      kind: "proposal",
      tags: ["home"],
      once: true,
      // ww187: deputies of a Duma that is there, in recess.
      assumes: { sits: ["duma"] },
      variants: [
        { id: "under", when: faction("rus_bolsh", { of: ["under"] }) },
        { id: "base" },
      ],
    },
  ),
  audience(
    "rus_f_bolsh_3",
    { interior: held("interior") },
    [
      opt("grain", [
        gauge("shells", -1),
        cool("rus_bolsh", 2),
        cool("rus_sd", 1),
        why("rus_f_bolsh_grain"),
      ]),
      opt("inspectors", [cool("rus_bolsh", 1), why("rus_f_bolsh_inspect")]),
      opt("search", [
        heat("rus_sd", 1),
        heat("rus_trud", 1),
        why("rus_f_bolsh_search"),
      ]),
    ],
    { kind: "proposal", tags: ["home"] },
  ),
  // The United Nobility, in the State Council.
  audience(
    "rus_f_nobles_2",
    leader("rus_nobles"),
    [
      opt("receive", [
        cool("rus_nobles", 2),
        heat("rus_kadets", 1),
        why("rus_f_nobles_receive"),
      ]),
      opt("no_land", [
        cool("rus_nobles", 1),
        heat("rus_trud", 1),
        why("rus_f_nobles_land"),
      ]),
      opt("send_back", [heat("rus_nobles", 1), why("rus_f_nobles_back")]),
    ],
    // ww187: "the Council's business is the vote": the Council is there.
    { assumes: { sits: ["council"] } },
  ),
  audience(
    "rus_f_nobles_3",
    leader("rus_nobles"),
    [
      opt("hear", [
        cool("rus_nobles", 1),
        heat("rus_circle", 1),
        why("rus_f_nobles_hear"),
      ]),
      opt("council", [
        cool("rus_nobles", 2),
        inst("court", 1),
        heat("rus_bloc", 1),
        why("rus_f_nobles_council"),
      ]),
      opt("wait", [why("rus_f_nobles_wait")]),
    ],
    // ww187: they stay away from the Council's votes: the Council is there.
    { assumes: { sits: ["council"] } },
  ),
  // The Stavka.
  audience(
    "rus_f_stavka_2",
    leader("rus_stavka"),
    [
      opt("front_first", [
        gauge("money", -1),
        cool("rus_stavka", 2),
        why("rus_f_stavka_front"),
      ]),
      opt("go", [
        cool("rus_stavka", 1),
        trustIn("leader", 1),
        why("rus_f_stavka_go"),
      ]),
      opt("ministers", [
        heat("rus_stavka", 1),
        inst("ministers", 1),
        why("rus_f_stavka_ministers"),
      ]),
    ],
    { tags: ["war", "people"] },
  ),
  audience(
    "rus_f_stavka_3",
    leader("rus_stavka"),
    [
      opt("call", [
        cool("rus_stavka", 2),
        inst("stavka", 1),
        why("rus_f_stavka_call"),
      ]),
      opt("letters", [
        heat("rus_stavka", 1),
        trustIn("leader", -1),
        why("rus_f_stavka_letters"),
      ]),
      opt("wait", [why("rus_f_stavka_wait")]),
    ],
    { tags: ["war", "people"] },
  ),
  // The Empress's circle.
  audience("rus_f_circle_2", leader("rus_circle"), [
    opt("receive", [
      cool("rus_circle", 2),
      heat("rus_kadets", 1),
      heat("rus_rights", 1),
      why("rus_f_circle_receive"),
    ]),
    opt("later", [cool("rus_circle", 1), why("rus_f_circle_later")]),
    opt("away", [heat("rus_circle", 2), why("rus_f_circle_away")]),
  ]),
  audience("rus_f_circle_3", leader("rus_circle"), [
    opt("their_man", [
      cool("rus_circle", 2),
      heat("rus_bloc", 1),
      heat("rus_kadets", 1),
      inst("duma", -1),
      why("rus_f_circle_man"),
    ]),
    opt("own_man", [
      heat("rus_circle", 1),
      inst("ministers", 1),
      why("rus_f_circle_own"),
    ]),
    opt("wait", [why("rus_f_circle_wait")]),
  ]),
];

// ---- S2: plots, weaknesses, allies' asks ----

const plotSteps = (id: string) => [
  { at: 6, scene: `${id}_1` },
  { at: 12, scene: `${id}_2` },
];
const plotSigns = (id: string) => [
  { at: 2, scene: `${id}_s1`, via: "paper" as const },
  { at: 4, scene: `${id}_s2`, via: "talk" as const },
  { at: 8, scene: `${id}_s3`, via: "report" as const },
];
const quiet = (when: GwCond, key: string, by?: number) =>
  by === undefined
    ? { when, key, quiet: true }
    : { when, key, by, quiet: true };

/**
 * Three plots. The palace (Guchkov and some guards officers: stop the train,
 * ask for the abdication) and the generals (the front commanders' telegrams)
 * remove the ruler; the red one (the garrison and the Bolsheviks) feeds the
 * unrest ladder. The favourite's death stays the news it is in rus_fall: a
 * plot row ends only in removed, the fall track or unrest, none of which it is.
 */
export const RUS_PLOTS: readonly GwPlotRow[] = [
  {
    id: "rus_pl_palace",
    tag: "RUS",
    regimes: ["tsar"],
    from: "1916-03",
    rest: 12,
    fatal: true,
    feeds: [
      quiet(temper("rus_octob", 3), "octob_silent"),
      quiet(temper("rus_bloc", 3), "bloc_silent"),
      quiet(aroundUsed(3), "round"),
      quiet(all(retreat, low("shells", 0)), "defeats"),
      quiet({ kind: "inst", inst: "court", max: -3 }, "court_low"),
    ],
    steps: plotSteps("rus_pl_palace"),
    plot: {
      by: ["rus_octob", "rus_bloc"],
      signs: plotSigns("rus_pl_palace"),
      warn: "rus_pl_palace_w",
      end: "removed",
    },
  },
  {
    id: "rus_pl_generals",
    tag: "RUS",
    regimes: ["tsar"],
    from: "1916-06",
    rest: 12,
    fatal: true,
    feeds: [
      quiet(temper("rus_stavka", 3), "stavka_silent", 2),
      quiet(all(retreat, low("shells", 0)), "defeats"),
      quiet({ kind: "inst", inst: "stavka", max: -3 }, "unheard"),
      quiet({ kind: "gauge", gauge: "order", max: 1 }, "rear_shaking"),
    ],
    steps: plotSteps("rus_pl_generals"),
    plot: {
      by: ["rus_stavka"],
      signs: plotSigns("rus_pl_generals"),
      warn: "rus_pl_generals_w",
      end: "removed",
    },
  },
  {
    id: "rus_pl_red",
    tag: "RUS",
    regimes: ["tsar", "crown", "regency"],
    from: "1916-01",
    rest: 12,
    fatal: false,
    feeds: [
      quiet(temper("rus_bolsh", 2), "bolsh_astir"),
      quiet(low("bread", 0), "bread_gone"),
      quiet({ kind: "gauge", gauge: "order", max: 1 }, "streets"),
      quiet(faction("rus_bolsh", { of: ["under"] }), "underground"),
    ],
    steps: plotSteps("rus_pl_red"),
    plot: {
      by: ["rus_bolsh"],
      signs: plotSigns("rus_pl_red"),
      warn: "rus_pl_red_w",
      end: "unrest",
    },
  },
];

/** Our people the Okhrana can open a file on. */
export const RUS_WEAK: readonly GwWeakRow[] = [
  {
    person: "rus_guchkov",
    weak: [
      { id: "foreign_ties", odds: 30 },
      { id: "old_scandal", odds: 40 },
    ],
  },
  {
    person: "rus_milyukov",
    weak: [
      { id: "foreign_ties", odds: 35 },
      { id: "letters", odds: 20 },
    ],
  },
  {
    person: "rus_rodzianko",
    weak: [
      { id: "industry_money", odds: 30 },
      { id: "letters", odds: 25 },
    ],
  },
  {
    person: "rus_kerensky",
    weak: [
      { id: "health", odds: 50 },
      { id: "letters", odds: 30 },
    ],
  },
  {
    person: "rus_protopopov",
    weak: [
      { id: "foreign_ties", odds: 45 },
      { id: "health", odds: 40 },
    ],
  },
  {
    person: "rus_sukhomlinov",
    weak: [
      { id: "debts", odds: 50 },
      { id: "old_scandal", odds: 45 },
    ],
  },
  {
    person: "rus_khvostov",
    weak: [
      { id: "old_scandal", odds: 40 },
      { id: "debts", odds: 30 },
    ],
  },
  {
    person: "rus_rasputin",
    weak: [
      { id: "old_scandal", odds: 60 },
      { id: "industry_money", odds: 35 },
    ],
  },
  {
    person: "rus_sturmer",
    weak: [
      { id: "industry_money", odds: 40 },
      { id: "foreign_ties", odds: 20 },
    ],
  },
  {
    person: "rus_alekseev",
    weak: [
      { id: "letters", odds: 40 },
      { id: "health", odds: 35 },
    ],
  },
  {
    person: "rus_chkheidze",
    weak: [{ id: "foreign_ties", odds: 30 }],
  },
  {
    person: "rus_lvov",
    weak: [{ id: "industry_money", odds: 25 }],
  },
];

const head = (tag: "FRA" | "GBR") => ({ head: { ruler_of: tag } });
const letterTo = (tone: "warm" | "cold"): GwEffect => ({
  kind: "letter",
  who: role("head"),
  tone,
});

/** What the Entente asks of Russia: four letters and the Petrograd conference. */
export const RUS_ASKS: readonly GwAskRow[] = [
  {
    id: "rus_ask_relief",
    tag: "RUS",
    from: "FRA",
    kind: "offensive",
    when: all(warAge(17), world({ is: "date", from: "1916-02" })),
    scene: "rus_ask_relief",
    keep: world({ is: "main", of: ["east"] }),
    chapters: 2,
    kept: [gauge("shells", 1)],
  },
  {
    id: "rus_ask_councils",
    tag: "RUS",
    from: "GBR",
    kind: "law",
    law: "rus_councils",
    when: all(warAge(9), not(isLaw("rus_councils")), low("shells", 1)),
    scene: "rus_ask_councils",
    keep: isLaw("rus_councils"),
    chapters: 6,
    kept: [gauge("money", 1)],
  },
  {
    id: "rus_ask_poland",
    tag: "RUS",
    from: "FRA",
    kind: "law",
    law: "rus_poland",
    when: all(world({ is: "date", from: "1916-11" }), not(isLaw("rus_poland"))),
    scene: "rus_ask_poland",
    keep: isLaw("rus_poland"),
    chapters: 6,
    kept: [gauge("morale", 1)],
  },
  {
    id: "rus_ask_romania",
    tag: "RUS",
    from: "FRA",
    kind: "front",
    when: world({ is: "entered", tag: "ROU" }),
    scene: "rus_ask_romania",
    keep: world({ is: "main", of: ["balkan"] }),
    chapters: 3,
    kept: [{ kind: "trust", tag: "GBR", delta: 1 }],
  },
  {
    id: "rus_conf_petrograd",
    tag: "RUS",
    from: "GBR",
    kind: "offensive",
    conference: true,
    when: all(
      warAge(20),
      any(
        { kind: "trust", tag: "GBR", max: 0 },
        { kind: "trust", tag: "FRA", max: 0 },
        all(retreat, low("shells", 0)),
      ),
    ),
    scene: "rus_conf_petrograd",
    keep: world({ is: "main", of: ["east"] }),
    chapters: 3,
    kept: [gauge("shells", 1)],
  },
];

const plotScene = (
  id: string,
  kind: GwScene["kind"],
  cast: GwScene["cast"],
  options?: GwScene["options"],
  extra: Partial<GwScene> = {},
): GwScene => ({
  id,
  nation: ["RUS"],
  kind,
  scheduledOnly: true,
  cast,
  salience: 7,
  tags: ["home"],
  variants: [{ id: "base" }],
  ...(options === undefined ? {} : { options, fallback: options[0].id }),
  ...extra,
});
const police = { police: either(office("interior"), office("chancellor")) };
const report = { stamp: "unconfirmed" as const, source: "police" as const };
/** An arrest on a sign that may be false: a cold plot makes it a wrong. */
const onFalseSign = (id: string, f: string): GwEffect => ({
  kind: "maybe",
  when: plotHot(id, 0, 0),
  then: [heat(f, 2), trustOf({ role: "police" }, -1)],
});
const trustMinistry = doWorld({ do: "regime", to: "crown" });

/** Plot signs, warnings, steps; the asks' letters and the conference. */
export const RUS_PLOT_SCENES: readonly GwScene[] = [
  // ---- The palace ----
  plotScene("rus_pl_palace_s1", "wire", {}),
  plotScene(
    "rus_pl_palace_s2",
    "audience",
    { who: either(person("rus_rodzianko"), office("chancellor")) },
    [
      opt("more", [remember("k_palace_heard"), why("rus_pl_palace_more")]),
      opt("quiet", [why("rus_pl_palace_quiet")]),
    ],
  ),
  plotScene("rus_pl_palace_s3", "report", police, undefined, report),
  plotScene("rus_pl_palace_w", "audience", police, [
    opt("guard", [coolPlot("rus_pl_palace", 3), why("rus_pl_palace_guard")]),
    opt("word", [
      coolPlot("rus_pl_palace", 3),
      cool("rus_bloc", 1),
      cool("rus_octob", 1),
      heat("rus_circle", 2),
      why("rus_pl_palace_word"),
    ]),
    opt(
      "public",
      [
        coolPlot("rus_pl_palace", 4),
        heat("rus_octob", 1),
        why("rus_pl_palace_public"),
      ],
      plotConfirmed("rus_pl_palace"),
    ),
    opt("arrest", [
      beatPlot("rus_pl_palace"),
      heatPlot("rus_pl_generals", 3),
      heat("rus_octob", 2),
      heat("rus_kadets", 1),
      onFalseSign("rus_pl_palace", "rus_octob"),
      why("rus_pl_palace_arrest"),
    ]),
    opt("wait", [why("rus_pl_palace_wait")]),
  ]),
  plotScene(
    "rus_pl_palace_1",
    "audience",
    { who: either(person("rus_guchkov"), office("chancellor")) },
    [
      opt("summon", [
        coolPlot("rus_pl_palace", 2),
        cool("rus_octob", 1),
        why("rus_pl_palace_summon"),
      ]),
      opt("orders", [
        coolPlot("rus_pl_palace", 3),
        gauge("money", -1),
        heat("rus_circle", 1),
        why("rus_pl_palace_orders"),
      ]),
      opt("wait", [why("rus_pl_palace_wait")]),
    ],
  ),
  plotScene(
    "rus_pl_palace_2",
    "proposal",
    police,
    [
      opt("route", [coolPlot("rus_pl_palace", 5), why("rus_pl_palace_route")]),
      opt("ministry", [
        trustMinistry,
        coolPlot("rus_pl_palace", 12),
        heat("rus_circle", 2),
        why("rus_pl_palace_ministry"),
      ]),
      opt("arrest", [
        beatPlot("rus_pl_palace"),
        heatPlot("rus_pl_generals", 3),
        heat("rus_bloc", 2),
        heat("rus_octob", 2),
        why("rus_pl_palace_arrest"),
      ]),
      opt("wait", [why("rus_pl_palace_wait")]),
    ],
    { salience: 9, essential: true },
  ),
  // ---- The generals ----
  plotScene("rus_pl_generals_s1", "wire", {}),
  plotScene(
    "rus_pl_generals_s2",
    "audience",
    { who: either(person("rus_fredericks"), office("court")) },
    [
      opt("more", [remember("k_generals_heard"), why("rus_pl_generals_more")]),
      opt("quiet", [why("rus_pl_generals_quiet")]),
    ],
  ),
  plotScene("rus_pl_generals_s3", "report", police, undefined, report),
  plotScene(
    "rus_pl_generals_w",
    "audience",
    { who: either(person("rus_ivanov"), office("war")) },
    [
      opt("go", [
        coolPlot("rus_pl_generals", 3),
        cool("rus_stavka", 1),
        why("rus_pl_generals_go"),
      ]),
      opt("shells", [
        coolPlot("rus_pl_generals", 2),
        gauge("money", -1),
        cool("rus_stavka", 2),
        why("rus_pl_generals_shells"),
      ]),
      opt(
        "public",
        [
          coolPlot("rus_pl_generals", 4),
          heat("rus_stavka", 1),
          why("rus_pl_generals_public"),
        ],
        plotConfirmed("rus_pl_generals"),
      ),
      opt("relieve", [
        beatPlot("rus_pl_generals"),
        heatPlot("rus_pl_palace", 3),
        heat("rus_stavka", 2),
        inst("stavka", -1),
        why("rus_pl_generals_relieve"),
      ]),
      opt("wait", [why("rus_pl_generals_wait")]),
    ],
    { tags: ["war", "home"] },
  ),
  plotScene(
    "rus_pl_generals_1",
    "audience",
    { who: leaderOf("rus_stavka") },
    [
      opt("minister", [
        coolPlot("rus_pl_generals", 3),
        inst("ministers", -1),
        cool("rus_stavka", 1),
        why("rus_pl_generals_minister"),
      ]),
      opt("call", [
        coolPlot("rus_pl_generals", 2),
        why("rus_pl_generals_call"),
      ]),
      opt("refuse", [heat("rus_stavka", 1), why("rus_pl_generals_refuse")]),
    ],
    { tags: ["war", "home"] },
  ),
  plotScene(
    "rus_pl_generals_2",
    "proposal",
    { who: leaderOf("rus_stavka") },
    [
      opt("front", [
        coolPlot("rus_pl_generals", 5),
        why("rus_pl_generals_front"),
      ]),
      opt("ministry", [
        trustMinistry,
        coolPlot("rus_pl_generals", 12),
        heat("rus_circle", 2),
        why("rus_pl_generals_ministry"),
      ]),
      opt("relieve", [
        beatPlot("rus_pl_generals"),
        heatPlot("rus_pl_palace", 3),
        heat("rus_stavka", 2),
        inst("stavka", -1),
        why("rus_pl_generals_relieve"),
      ]),
      opt("wait", [why("rus_pl_generals_wait")]),
    ],
    { salience: 9, essential: true, tags: ["war", "home"] },
  ),
  // ---- The red plot ----
  plotScene("rus_pl_red_s1", "wire", {}),
  plotScene(
    "rus_pl_red_s2",
    "audience",
    { who: either(office("war"), office("interior")) },
    [
      opt("more", [remember("k_red_heard"), why("rus_pl_red_more")]),
      opt("quiet", [why("rus_pl_red_quiet")]),
    ],
  ),
  plotScene("rus_pl_red_s3", "report", police, undefined, report),
  plotScene("rus_pl_red_w", "audience", police, [
    opt("grain", [
      coolPlot("rus_pl_red", 3),
      gauge("shells", -1),
      why("rus_pl_red_grain"),
    ]),
    opt("battalions", [
      coolPlot("rus_pl_red", 2),
      heat("rus_stavka", 1),
      why("rus_pl_red_battalions"),
    ]),
    opt(
      "public",
      [coolPlot("rus_pl_red", 3), heat("rus_sd", 1), why("rus_pl_red_public")],
      plotConfirmed("rus_pl_red"),
    ),
    opt("arrest", [
      beatPlot("rus_pl_red"),
      heatPlot("rus_pl_palace", 3),
      heat("rus_sd", 1),
      heat("rus_trud", 1),
      onFalseSign("rus_pl_red", "rus_bolsh"),
      why("rus_pl_red_arrest"),
    ]),
    opt("wait", [why("rus_pl_red_wait")]),
  ]),
  plotScene("rus_pl_red_1", "proposal", police, [
    opt("bread", [
      coolPlot("rus_pl_red", 2),
      gauge("shells", -1),
      why("rus_pl_red_bread"),
    ]),
    opt("wages", [
      coolPlot("rus_pl_red", 2),
      gauge("money", -1),
      why("rus_pl_red_wages"),
    ]),
    opt("search", [
      coolPlot("rus_pl_red", 1),
      heat("rus_sd", 1),
      why("rus_pl_red_search"),
    ]),
    opt("wait", [why("rus_pl_red_wait")]),
  ]),
  plotScene(
    "rus_pl_red_2",
    "proposal",
    police,
    [
      opt("stores", [
        coolPlot("rus_pl_red", 5),
        gauge("shells", -1),
        inst("stavka", -1),
        why("rus_pl_red_stores"),
      ]),
      opt("commission", [
        coolPlot("rus_pl_red", 4),
        cool("rus_sd", 1),
        cool("rus_trud", 1),
        heat("rus_rights", 1),
        why("rus_pl_red_commission"),
      ]),
      opt("arrest", [
        beatPlot("rus_pl_red"),
        heatPlot("rus_pl_palace", 3),
        heat("rus_sd", 2),
        why("rus_pl_red_arrest"),
      ]),
      opt("wait", [why("rus_pl_red_wait")]),
    ],
    { salience: 9, essential: true },
  ),
  // ---- The allies' asks ----
  {
    id: "rus_ask_relief",
    nation: ["RUS"],
    kind: "letter",
    who: "head",
    scheduledOnly: true,
    once: true,
    salience: 7,
    tags: ["foreign", "war"],
    cast: head("FRA"),
    variants: [{ id: "base" }],
    fallback: "yes",
    options: [
      opt("yes", [answerAsk("rus_ask_relief", true), letterTo("warm")]),
      opt("no", [answerAsk("rus_ask_relief", false), letterTo("cold")]),
    ],
  },
  {
    id: "rus_ask_councils",
    nation: ["RUS"],
    kind: "letter",
    who: "head",
    scheduledOnly: true,
    once: true,
    salience: 7,
    tags: ["foreign", "home"],
    cast: head("GBR"),
    variants: [{ id: "base" }],
    fallback: "yes",
    options: [
      opt("yes", [answerAsk("rus_ask_councils", true), letterTo("warm")]),
      opt("no", [answerAsk("rus_ask_councils", false), letterTo("cold")]),
    ],
  },
  {
    id: "rus_ask_poland",
    nation: ["RUS"],
    kind: "letter",
    who: "head",
    scheduledOnly: true,
    once: true,
    salience: 7,
    tags: ["foreign", "home"],
    cast: head("FRA"),
    variants: [{ id: "base" }],
    fallback: "no",
    options: [
      opt("yes", [answerAsk("rus_ask_poland", true), letterTo("warm")]),
      opt("no", [answerAsk("rus_ask_poland", false), letterTo("cold")]),
    ],
  },
  {
    id: "rus_ask_romania",
    nation: ["RUS"],
    kind: "letter",
    who: "head",
    scheduledOnly: true,
    once: true,
    salience: 7,
    tags: ["foreign", "war"],
    cast: head("FRA"),
    variants: [{ id: "base" }],
    fallback: "yes",
    options: [
      opt("yes", [answerAsk("rus_ask_romania", true), letterTo("warm")]),
      opt("no", [answerAsk("rus_ask_romania", false), letterTo("cold")]),
    ],
  },
  // The Petrograd conference: the Allied missions in the capital, face to face.
  {
    id: "rus_conf_petrograd",
    nation: ["RUS"],
    kind: "talk",
    big: true,
    once: true,
    scheduledOnly: true,
    salience: 9,
    tags: ["foreign", "war"],
    cast: {
      envoy: either({ office: "ambassador_petersburg", tag: "GBR" }),
      cos: held("chief_of_staff"),
    },
    who: "envoy",
    variants: [{ id: "base" }],
    start: "n1",
    nodes: {
      n1: {
        says: [{ id: "base" }],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "n2",
          },
        ],
      },
      n2: {
        who: "cos",
        says: [{ id: "base" }],
        replies: [decide("hear", "n3")],
      },
      n3: {
        who: "envoy",
        fallback: "pledge",
        says: [{ id: "base" }],
        replies: [
          decide("pledge", null, [
            answerAsk("rus_conf_petrograd", true),
            why("rus_conf_pledge"),
          ]),
          decide("own_time", null, [
            answerAsk("rus_conf_petrograd", false),
            why("rus_conf_own_time"),
          ]),
        ],
      },
    },
  },
];
