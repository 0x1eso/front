import type { GwAxisPush } from "@openfront/engine-api/ww1914/GwSociety";
import {
  any,
  byName,
  chose,
  flag,
  keepPromise,
  memory,
  setFlag,
  type GwCond,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import type { GwLawDraft, GwLawRow } from "../../LawRows";
import { leaderOf } from "../house/kit";
import {
  draft,
  either,
  gauge,
  held,
  inst,
  lawTalk,
  low,
  men,
  person,
  since,
  until,
  war,
} from "./kit";

const row = (r: Omit<GwLawRow, "tag">): GwLawRow => ({ ...r, tag: "AUH" });
const vienna = { chancellor: held("chancellor") };
const both = { chancellor: held("chancellor"), hun: held("hun_pm") };
const allOf = (...of: GwLawRow["opens"][]): GwLawRow["opens"] => ({
  kind: "all",
  of,
});

/**
 * Austria-Hungary's bills. What touches both halves needs Hungary's consent and
 * no paragraph replaces it. What touches Austria alone sits with the council of
 * ministers (`body`): the Reichsrat is shut, and paragraph 14 goes past anyone.
 */
const AUH_WAR_LAWS: readonly GwLawRow[] = [
  row({
    id: "auh_press",
    chapter: "censorship",
    opens: war,
    lean: 1,
    decree: true,
    body: "council",
    cast: { chancellor: held("chancellor"), war: held("war") },
    draft: [
      draft(
        "surveillance_office",
        1,
        ["army:+1", "nations:-1"],
        [inst("army", 1), inst("nations", -1)],
      ),
      draft("front_zone", 0, []),
      draft("civil_censors", -1, ["nations:+1"], [inst("nations", 1)]),
    ],
    passed: [gauge("order", 1)],
    passedTell: ["order:+1", "censor:+1"],
    term: [
      { gauge: "order", delta: 1, every: 10 },
      { gauge: "morale", delta: -1, every: 14, offset: 3 },
    ],
    flag: "f_law_censor",
    censor: 1,
    settled: any(
      flag("f_auh_decree_full"),
      flag("f_auh_decree_narrow"),
      flag("f_auh_decree_reichsrat"),
    ),
    replaces: ["auh_c_decree"],
    repeal: {
      authority: 15,
      tell: ["nations:+1", "army:-1"],
      effects: [inst("nations", 1), inst("army", -1)],
    },
    talk: lawTalk("auh_press", {
      who: person("auh_adler"),
      ask: "frank",
      push: "cold",
      tell: ["army:-1"],
      price: [inst("army", -1)],
      wins: 1,
    }),
  }),
  row({
    id: "auh_landsturm",
    chapter: "conscription",
    opens: allOf(war, since("1915-02")),
    lean: 0,
    decree: false,
    cast: both,
    draft: [
      draft("to_fifty", 0, ["manpower:+4"], [men(4)]),
      draft("to_forty_five", 1, []),
      draft(
        "harvest_leave",
        1,
        ["bread:+1", "manpower:-2"],
        [gauge("bread", 1), men(-2)],
      ),
    ],
    passed: [men(8)],
    passedTell: ["manpower:+8"],
    term: [
      { gauge: "manpower", delta: 1, every: 5 },
      { gauge: "bread", delta: -1, every: 12, offset: 4 },
    ],
    repeal: {
      authority: 20,
      tell: ["manpower:-8", "bread:+1"],
      effects: [men(-8), gauge("bread", 1)],
    },
    talk: lawTalk("auh_landsturm", {
      who: held("hun_pm"),
      ask: "frank",
      push: "cold",
      tell: ["hungary:+1", "council:-1"],
      price: [inst("hungary", 1), inst("council", -1)],
      wins: 1,
      tempers: ["stubborn"],
    }),
  }),
  row({
    id: "auh_factories",
    chapter: "labour",
    opens: allOf(war, since("1915-01")),
    lean: 1,
    decree: true,
    body: "council",
    cast: { war: held("war"), chancellor: held("chancellor") },
    draft: [
      draft("military_direction", 0, ["army:+1"], [inst("army", 1)]),
      draft("complaint_boards", 1, ["shells:-1"], [gauge("shells", -1)]),
      draft(
        "wage_floor",
        -1,
        ["money:-1", "order:+1"],
        [gauge("money", -1), gauge("order", 1)],
      ),
    ],
    passed: [gauge("shells", 1)],
    passedTell: ["shells:+1"],
    term: [
      { gauge: "shells", delta: 1, every: 7 },
      {
        gauge: "order",
        delta: -1,
        every: 9,
        offset: 3,
        text: ["military_direction"],
      },
      {
        gauge: "order",
        delta: -1,
        every: 14,
        offset: 3,
        text: ["complaint_boards", "wage_floor"],
      },
    ],
    flag: "f_law_strike_ban",
    repeal: {
      authority: 15,
      tell: ["order:+1", "shells:-1"],
      effects: [gauge("order", 1), gauge("shells", -1)],
    },
    talk: lawTalk("auh_factories", {
      who: person("auh_adler"),
      ask: "warm",
      push: "frank",
      tell: ["army:-1"],
      price: [inst("army", -1)],
      wins: 1,
      tempers: ["weary"],
    }),
    after: {
      chapters: 8,
      options: [
        {
          id: "officers_stay",
          tell: ["shells:+1", "order:-1"],
          effects: [gauge("shells", 1), gauge("order", -1)],
        },
        {
          id: "boards_sit",
          tell: ["order:+1", "army:-1"],
          effects: [gauge("order", 1), inst("army", -1)],
        },
      ],
    },
  }),
  row({
    id: "auh_food",
    chapter: "food",
    opens: allOf(war, since("1916-02"), low("bread", 2)),
    lean: -2,
    decree: false,
    cast: both,
    draft: [
      draft("common_committee", 1, ["council:-1"], [inst("council", -1)]),
      draft(
        "army_first",
        0,
        ["army:+1", "nations:-1"],
        [inst("army", 1), inst("nations", -1)],
      ),
      draft("hungarian_price", 2, ["money:-1"], [gauge("money", -1)]),
    ],
    passed: [gauge("bread", 1), inst("hungary", -1)],
    passedTell: ["bread:+1", "hungary:-1"],
    term: [{ gauge: "bread", delta: 1, every: 6 }],
    repeal: {
      authority: 10,
      tell: ["hungary:+1", "bread:-1"],
      effects: [inst("hungary", 1), gauge("bread", -1)],
    },
    talk: lawTalk("auh_food", {
      who: held("hun_pm"),
      ask: "cold",
      push: "threat",
      tell: ["hungary:+1", "money:-1"],
      price: [inst("hungary", 1), gauge("money", -1)],
      wins: 2,
    }),
    after: {
      chapters: 7,
      options: [
        {
          id: "grain_by_rail",
          tell: ["bread:+1", "hungary:-1"],
          effects: [gauge("bread", 1), inst("hungary", -1)],
        },
        {
          id: "vienna_waits",
          tell: ["hungary:+1", "order:-1"],
          effects: [inst("hungary", 1), gauge("order", -1)],
        },
      ],
    },
  }),
  row({
    id: "auh_galicia",
    chapter: "nations",
    opens: allOf(war, since("1916-06")),
    lean: 0,
    decree: true,
    body: "council",
    cast: vienna,
    draft: [
      draft("special_status", 0, ["nations:+1"], [inst("nations", 1)]),
      draft("after_the_war", 1, []),
      draft(
        "east_divided",
        -1,
        ["nations:+1", "berlin:+1"],
        [inst("nations", 1), inst("berlin", 1)],
      ),
    ],
    passed: [
      inst("nations", 1),
      keepPromise(byName("auh_bilinski"), "bil_galicia"),
    ],
    passedTell: ["nations:+1"],
    term: [{ gauge: "morale", delta: 1, every: 12 }],
    repeal: {
      authority: 25,
      tell: ["nations:-2"],
      effects: [inst("nations", -2)],
    },
    talk: lawTalk("auh_galicia", {
      who: held("finance"),
      ask: "warm",
      push: "cold",
      tell: ["council:-1"],
      price: [inst("council", -1)],
      wins: 2,
      tempers: ["cunning"],
    }),
  }),
  row({
    id: "auh_transylvania",
    chapter: "nations",
    opens: allOf(war, until("1916-08"), world({ is: "neutral", tag: "ROU" })),
    lean: -2,
    decree: false,
    cast: both,
    draft: [
      draft("schools", 1, []),
      draft("language_and_seats", -1, ["nations:+1"], [inst("nations", 1)]),
      draft("words_to_bucharest", 2, ["nations:-1"], [inst("nations", -1)]),
    ],
    passed: [
      doWorld({ do: "readiness", tag: "ROU", delta: -10 }),
      inst("nations", 1),
      inst("hungary", -1),
    ],
    passedTell: ["rou:+1", "nations:+1", "hungary:-1"],
    term: [],
    repeal: {
      authority: 20,
      tell: ["hungary:+1", "nations:-2"],
      effects: [inst("hungary", 1), inst("nations", -2)],
    },
    talk: lawTalk("auh_transylvania", {
      who: person("auh_czernin"),
      ask: "frank",
      push: "flatter",
      tell: ["hungary:-1"],
      price: [inst("hungary", -1)],
      wins: 2,
      tempers: ["arrogant"],
    }),
  }),
  row({
    id: "auh_oktroi",
    chapter: "franchise",
    opens: allOf(war, since("1916-11"), until("1917-12")),
    lean: 1,
    decree: true,
    body: "council",
    cast: vienna,
    draft: [
      draft("bohemia_split", 1, ["nations:-1"], [inst("nations", -1)]),
      draft(
        "state_language",
        0,
        ["berlin:-1", "nations:-2"],
        [inst("berlin", -1), inst("nations", -2)],
      ),
    ],
    passed: [inst("army", 1), inst("nations", -1)],
    passedTell: ["army:+1", "nations:-1"],
    term: [{ gauge: "order", delta: -1, every: 10 }],
    repeal: {
      authority: 5,
      tell: ["nations:+1", "army:-1"],
      effects: [inst("nations", 1), inst("army", -1)],
    },
    talk: lawTalk("auh_oktroi", {
      who: held("chancellor"),
      ask: "cold",
      push: "frank",
      tell: ["nations:-1"],
      price: [inst("nations", -1)],
      wins: 1,
    }),
  }),
  row({
    id: "auh_reichsrat",
    chapter: "franchise",
    opens: allOf(war, since("1916-11")),
    lean: -1,
    decree: false,
    body: "council",
    cast: vienna,
    draft: [
      draft("open_with_oath", 1, ["nations:-1"], [inst("nations", -1)]),
      draft(
        "open_plainly",
        0,
        ["nations:+1", "army:-1"],
        [inst("nations", 1), inst("army", -1)],
      ),
      draft(
        "with_amnesty",
        -1,
        ["nations:+2", "army:-2"],
        [inst("nations", 2), inst("army", -2), setFlag("f_auh_amnesty")],
      ),
    ],
    passed: [
      inst("nations", 1),
      gauge("order", 1),
      inst("council", -1),
      setFlag("f_auh_sign_austria"),
    ],
    passedTell: ["nations:+1", "order:+1", "council:-1"],
    term: [],
    settled: any(chose("auh_h_reichsrat_call", "open_it"), {
      kind: "seen",
      scene: "auh_k_reichsrat_opens",
    }),
    replaces: ["auh_h_reichsrat_call"],
    repeal: {
      authority: 30,
      tell: ["nations:-2", "order:-1"],
      effects: [inst("nations", -2), gauge("order", -1)],
    },
    talk: lawTalk("auh_reichsrat", {
      who: either(person("auh_koerber"), held("chancellor")),
      ask: "frank",
      push: "warm",
      tell: ["army:-1"],
      price: [inst("army", -1)],
      wins: 2,
      tempers: ["weary"],
    }),
  }),
  row({
    id: "auh_franchise",
    chapter: "franchise",
    opens: allOf(
      war,
      since("1917-01"),
      any(memory("k_tisza_franchise"), memory("k_kar_vote"), {
        kind: "gauge",
        gauge: "morale",
        max: 2,
      }),
    ),
    lean: -3,
    decree: false,
    cast: both,
    draft: [
      draft("soldiers_vote", 2, ["hungary:-1"], [inst("hungary", -1)]),
      draft("literate_vote", 1, ["nations:-1"], [inst("nations", -1)]),
      draft(
        "universal",
        -1,
        ["nations:+2", "hungary:-2"],
        [inst("nations", 2), inst("hungary", -2)],
      ),
    ],
    passed: [
      gauge("morale", 1),
      inst("nations", 1),
      setFlag("f_auh_soldiers_vote"),
    ],
    passedTell: ["morale:+1", "nations:+1"],
    term: [],
    settled: flag("f_auh_soldiers_vote"),
    repeal: {
      authority: 35,
      tell: ["morale:-1", "nations:-1"],
      effects: [gauge("morale", -1), inst("nations", -1)],
    },
    talk: lawTalk("auh_franchise", {
      who: person("auh_karolyi"),
      ask: "frank",
      push: "flatter",
      tell: ["hungary:-1"],
      price: [inst("hungary", -1)],
      wins: 2,
      tempers: ["arrogant"],
    }),
  }),
  // + check. ww203: how the war is paid, Austria's half (its taxes are
  // Vienna's; Budapest taxes its own). Eight war loans were raised. The war
  // surcharge on the direct taxes came by imperial decree, 28 August 1916
  // (RGBl. 280, a parliament.gv.at paper); a war-profits tax was argued in
  // the Vienna press in 1916 (Wienbibliothek clippings); its date and
  // paragraph not checked.
  row({
    id: "auh_war_tax",
    chapter: "war_finance",
    opens: allOf(war, since("1915-06")),
    lean: 0,
    decree: true,
    body: "council",
    cast: { chancellor: held("chancellor"), finance: held("finance") },
    draft: [
      draft("loans_only", 1, []),
      draft(
        "profits_tax",
        0,
        ["order:+1", "council:-1"],
        [gauge("order", 1), inst("council", -1)],
      ),
      draft(
        "surcharge",
        -1,
        ["money:+1", "morale:-1"],
        [gauge("money", 1), gauge("morale", -1)],
      ),
    ],
    passed: [gauge("money", 1)],
    passedTell: ["money:+1"],
    term: [
      { gauge: "money", delta: 1, every: 10 },
      {
        gauge: "money",
        delta: -1,
        every: 14,
        offset: 7,
        text: ["loans_only"],
      },
    ],
    repeal: {
      authority: 15,
      tell: ["money:-1"],
      effects: [gauge("money", -1)],
    },
    talk: lawTalk("auh_war_tax", {
      who: either(person("auh_bilinski"), held("finance")),
      ask: "frank",
      push: "cold",
      tell: ["council:-1"],
      price: [inst("council", -1)],
      wins: 1,
    }),
  }),
  // + check. ww203: who tries civilians in the war. The AOK asked from late
  // November 1914 to put all Bohemia and the rest of Moravia and Silesia
  // under the emergency decrees and its courts; Stürgkh refused at once, as
  // did every civil minister. By the end of 1914, 950 arrested in Bohemia,
  // 704 handed to the military courts (Rauchensteiner, The First World War
  // and the End of the Habsburg Monarchy, austria-forum pp. 268-269).
  row({
    id: "auh_war_zone",
    chapter: "siege",
    opens: allOf(war, since("1914-11")),
    lean: 0,
    decree: true,
    body: "council",
    cast: { chancellor: held("chancellor"), war: held("war") },
    draft: [
      draft(
        "army_courts",
        0,
        ["army:+1", "nations:-1", "order:+1"],
        [inst("army", 1), inst("nations", -1), gauge("order", 1)],
      ),
      draft("war_zone_only", 1, ["order:+1"], [gauge("order", 1)]),
      draft(
        "civil_courts",
        -1,
        ["nations:+1", "army:-1"],
        [inst("nations", 1), inst("army", -1)],
      ),
    ],
    passed: [],
    passedTell: [],
    term: [
      {
        gauge: "morale",
        delta: -1,
        every: 12,
        offset: 4,
        text: ["army_courts"],
      },
    ],
    repeal: {
      authority: 10,
      tell: ["army:-1"],
      effects: [inst("army", -1)],
    },
    talk: lawTalk("auh_war_zone", {
      who: either(person("auh_conrad"), held("war")),
      ask: "cold",
      push: "frank",
      tell: ["army:+1"],
      price: [inst("army", 1)],
      wins: 1,
    }),
  }),
  // ww190: the peace years' army bill. The recruits' quota is joint: Budapest
  // passes it or nobody does, and it asks its price in words of command.
  row({
    id: "auh_army_bill",
    chapter: "arms",
    opens: allOf(
      { kind: "not", of: world({ is: "war_months", min: 0 }) },
      world({ is: "peace_months", min: 3 }),
    ),
    lean: -1,
    decree: false,
    cast: both,
    draft: [
      draft(
        "full_quota",
        0,
        ["hungary:-1"],
        [doWorld({ do: "arms", line: "army", delta: 5 }), inst("hungary", -1)],
      ),
      draft(
        "magyar_words",
        1,
        ["army:-1", "hungary:+1"],
        [
          doWorld({ do: "arms", line: "army", delta: 5 }),
          inst("army", -1),
          inst("hungary", 1),
        ],
      ),
      draft(
        "with_levy",
        -1,
        ["order:-1"],
        [
          doWorld({ do: "arms", line: "army", delta: 3 }),
          doWorld({ do: "budget_item", item: "treasury", pct: 5 }),
          gauge("order", -1),
        ],
      ),
    ],
    passed: [men(4), inst("army", 1)],
    passedTell: ["manpower:+4", "army:+1"],
    term: [],
    repeal: {
      authority: 15,
      tell: ["army:-1"],
      effects: [inst("army", -1)],
    },
    talk: lawTalk("auh_army_bill", {
      who: held("hun_pm"),
      ask: "frank",
      push: "cold",
      tell: ["hungary:+1", "army:-1"],
      price: [inst("hungary", 1), inst("army", -1)],
      wins: 2,
      tempers: ["stubborn"],
    }),
  }),
];

// ---- ww207 (W-AUH): the peace years' bills, the war's postponement ----
// Peace rows (`peace: true`) open while the monarchy is not at war: the
// crisis weeks, the peace years, after the armistice. Facts (checked
// 2026-11-13 unless marked F):
// - Bohemia: the 1913 patent put the land's affairs under an administrative
//   commission whose chairman and members the Emperor named (psp.cz, the
//   Czechoslovak assembly's debate of 16 Apr 1919, which compares it); the
//   Czech-German talks on the land's languages failed early in 1914 (F).
// - Croatia: royal commissioner Cuvaj from 1912 to July 1913, the Sabor and
//   the constitution suspended (design ww207 §6, F here); Hungarian on the
//   Croatian railways since 1907 (F: memory).
// - Bosnia: the law on the voluntary buying-out of kmet holdings with
//   state loans, voted in the Bosnian Sabor on 5 April 1911 (hrcak.srce.hr;
//   ceeol.com, Savić).
// - Austria's social insurance bill (old age and invalidity, 1908) lay in
//   committee until the war (F: memory). The personal income tax of 1896
//   (F: memory).
// - Hungary's schools: the Apponyi school laws of 1907 (F: memory).
// - Postponement: the Hungarian Diet elected in 1910 had its mandate
//   extended in 1915 (1914-1918-online, "Governments, Parliaments and
//   Parties (Hungary)"); the Reichsrat elected in 1911 for six years sat
//   unelected again until 1918 (parlament.gv.at; how its term was carried
//   past 1917 not found, F).
const peaceTime: GwCond = { kind: "not", of: war };
const anyTime: GwCond = since("1900-01");
const hun = { hun: held("hun_pm") };

const AUH_PEACE_LAWS: readonly GwLawRow[] = [
  row({
    id: "auh_postpone",
    chapter: "franchise",
    opens: allOf(war, since("1915-01")),
    lean: 1,
    decree: false,
    cast: both,
    draft: [
      draft("until_peace", 1, ["order:+1"], [gauge("order", 1)]),
      draft("year_by_year", 0, []),
      draft(
        "with_soldiers_vote",
        -1,
        ["morale:+1", "hungary:-1"],
        [gauge("morale", 1), inst("hungary", -1)],
      ),
    ],
    passed: [setFlag("f_auh_elections_postponed")],
    passedTell: [],
    term: [{ gauge: "morale", delta: -1, every: 16, offset: 8 }],
    repeal: {
      authority: 10,
      tell: ["order:-1"],
      effects: [gauge("order", -1)],
    },
    talk: lawTalk("auh_postpone", {
      who: held("hun_pm"),
      ask: "frank",
      push: "cold",
      tell: ["hungary:+1"],
      price: [inst("hungary", 1)],
      wins: 1,
    }),
  }),
  row({
    id: "auh_bohemia",
    chapter: "local",
    peace: true,
    opens: peaceTime,
    lean: 0,
    decree: true,
    body: "council",
    cast: vienna,
    draft: [
      draft("commission", 1, ["order:+1"], [gauge("order", 1)]),
      draft(
        "compromise",
        0,
        ["nations:+1", "order:+1"],
        [inst("nations", 1), gauge("order", 1)],
      ),
      draft("german_districts", 0, ["nations:-1"], [inst("nations", -1)]),
    ],
    passed: [],
    passedTell: [],
    term: [{ gauge: "order", delta: 1, every: 12, offset: 6 }],
    repeal: {
      authority: 10,
      tell: ["order:-1"],
      effects: [gauge("order", -1)],
    },
    talk: lawTalk("auh_bohemia", {
      who: either(person("auh_kramar"), leaderOf("auh_czech")),
      ask: "frank",
      push: "cold",
      tell: ["nations:+1"],
      price: [inst("nations", 1)],
      wins: 1,
      tempers: ["arrogant"],
    }),
  }),
  row({
    id: "auh_croatia",
    chapter: "local",
    peace: true,
    opens: peaceTime,
    lean: -1,
    decree: false,
    cast: hun,
    draft: [
      draft(
        "bans_hand",
        1,
        ["hungary:+1", "nations:-1"],
        [inst("hungary", 1), inst("nations", -1)],
      ),
      draft(
        "railway_croatian",
        0,
        ["nations:+1", "hungary:-1"],
        [inst("nations", 1), inst("hungary", -1)],
      ),
      draft(
        "dalmatia_joined",
        -2,
        ["nations:+2", "hungary:-1"],
        [inst("nations", 2), inst("hungary", -1)],
      ),
    ],
    passed: [],
    passedTell: [],
    term: [{ gauge: "order", delta: 1, every: 14, offset: 7 }],
    repeal: {
      authority: 15,
      tell: ["nations:-1"],
      effects: [inst("nations", -1)],
    },
    talk: lawTalk("auh_croatia", {
      who: held("hun_pm"),
      ask: "frank",
      push: "cold",
      tell: ["hungary:+1"],
      price: [inst("hungary", 1)],
      wins: 1,
      tempers: ["stubborn"],
    }),
  }),
  row({
    id: "auh_kmet",
    chapter: "land",
    peace: true,
    opens: peaceTime,
    lean: 0,
    decree: true,
    body: "council",
    cast: { finance: either(person("auh_bilinski"), held("finance")) },
    draft: [
      draft("voluntary", 1, []),
      draft(
        "obligatory",
        -1,
        ["money:-1", "order:+1"],
        [gauge("money", -1), gauge("order", 1)],
      ),
      draft("colonists", 0, ["nations:-1"], [inst("nations", -1)]),
    ],
    passed: [],
    passedTell: [],
    term: [{ gauge: "bread", delta: 1, every: 16, offset: 8 }],
    repeal: {
      authority: 10,
      tell: ["order:-1"],
      effects: [gauge("order", -1)],
    },
    talk: lawTalk("auh_kmet", {
      who: either(person("auh_bilinski"), held("finance")),
      ask: "warm",
      push: "frank",
      tell: ["money:-1"],
      price: [gauge("money", -1)],
      wins: 1,
    }),
  }),
  row({
    id: "auh_insurance",
    chapter: "social",
    peace: true,
    opens: peaceTime,
    lean: 0,
    decree: true,
    body: "council",
    cast: vienna,
    draft: [
      draft(
        "old_age",
        0,
        ["money:-1", "order:+1"],
        [gauge("money", -1), gauge("order", 1)],
      ),
      draft("small_masters", 1, ["money:-1"], [gauge("money", -1)]),
      draft("sickness_only", 1, []),
    ],
    passed: [],
    passedTell: [],
    term: [
      { gauge: "order", delta: 1, every: 12, offset: 4 },
      { gauge: "money", delta: -1, every: 16, offset: 10 },
    ],
    repeal: {
      authority: 20,
      tell: ["order:-1"],
      effects: [gauge("order", -1)],
    },
    talk: lawTalk("auh_insurance", {
      who: leaderOf("auh_sd"),
      ask: "warm",
      push: "frank",
      tell: ["money:-1"],
      price: [gauge("money", -1)],
      wins: 1,
      tempers: ["weary"],
    }),
  }),
  row({
    id: "auh_income_tax",
    chapter: "tax",
    peace: true,
    opens: peaceTime,
    lean: -1,
    decree: true,
    body: "council",
    cast: { chancellor: held("chancellor"), finance: held("finance") },
    draft: [
      draft(
        "progressive",
        -1,
        ["money:+1", "council:-1"],
        [gauge("money", 1), inst("council", -1)],
      ),
      draft("consumption", 1, ["money:+1"], [gauge("money", 1)]),
      draft("estates", 0, ["money:+1"], [gauge("money", 1)]),
    ],
    passed: [],
    passedTell: [],
    term: [{ gauge: "money", delta: 1, every: 12, offset: 6 }],
    repeal: {
      authority: 10,
      tell: ["money:-1"],
      effects: [gauge("money", -1)],
    },
    talk: lawTalk("auh_income_tax", {
      who: held("finance"),
      ask: "frank",
      push: "cold",
      tell: ["council:-1"],
      price: [inst("council", -1)],
      wins: 1,
    }),
  }),
  row({
    id: "auh_schools",
    chapter: "schools",
    peace: true,
    opens: peaceTime,
    lean: 0,
    decree: false,
    cast: hun,
    draft: [
      draft(
        "magyar_hours",
        1,
        ["hungary:+1", "nations:-1"],
        [inst("hungary", 1), inst("nations", -1)],
      ),
      draft(
        "mother_tongue",
        -1,
        ["nations:+1", "hungary:-1"],
        [inst("nations", 1), inst("hungary", -1)],
      ),
      draft("state_schools", 0, ["money:-1"], [gauge("money", -1)]),
    ],
    passed: [],
    passedTell: [],
    term: [],
    repeal: {
      authority: 15,
      tell: ["hungary:-1"],
      effects: [inst("hungary", -1)],
    },
    talk: lawTalk("auh_schools", {
      who: held("hun_pm"),
      ask: "frank",
      push: "cold",
      tell: ["hungary:+1"],
      price: [inst("hungary", 1)],
      wins: 1,
      tempers: ["stubborn"],
    }),
  }),
];

// ---- ww207 (W-AUH): the factions' exclusive laws (their trees' nodes) ----
// In the book only once the node is open (content/utopia/auh.ts). Facts:
// Naumann's "Mitteleuropa" (1915) and the customs talks with Berlin; the
// Belvedere circle and Popovici's "United States of Greater Austria" (1906);
// the May Declaration of 30 May 1917 (a South Slav state under the Habsburg
// sceptre); Renner's national autonomy by persons (1899-1918 writings); the
// Bohemian state right and a Prague coronation Franz Joseph promised in 1871
// and never held; the Magyar language of command, the Independence Party's
// old demand (all F: memory).
const own = (faction: string, node: string) => ({ faction, node });

const AUH_EXCLUSIVE_LAWS: readonly GwLawRow[] = [
  row({
    id: "auh_x_magyar_army",
    chapter: "arms",
    exclusive: own("auh_work", "b1"),
    opens: anyTime,
    lean: 0,
    decree: false,
    cast: both,
    draft: [
      draft(
        "magyar_command",
        1,
        ["hungary:+1", "army:-1"],
        [inst("hungary", 1), inst("army", -1)],
      ),
      draft(
        "honved_grows",
        0,
        ["hungary:+1", "manpower:+2"],
        [inst("hungary", 1), men(2)],
      ),
      draft(
        "own_army",
        -2,
        ["hungary:+2", "army:-2"],
        [inst("hungary", 2), inst("army", -2)],
      ),
    ],
    passed: [],
    passedTell: [],
    term: [],
    repeal: {
      authority: 25,
      tell: ["hungary:-2"],
      effects: [inst("hungary", -2)],
    },
    talk: lawTalk("auh_x_magyar_army", {
      who: either(person("auh_conrad"), held("war")),
      ask: "frank",
      push: "cold",
      tell: ["army:+1"],
      price: [inst("army", 1)],
      wins: 1,
    }),
  }),
  row({
    id: "auh_x_mitteleuropa",
    chapter: "war_aims",
    exclusive: own("auh_germans", "b1"),
    opens: anyTime,
    lean: 0,
    decree: true,
    body: "council",
    cast: vienna,
    draft: [
      draft(
        "customs_union",
        0,
        ["berlin:+1", "money:+1"],
        [inst("berlin", 1), gauge("money", 1)],
      ),
      draft("slow_steps", 1, []),
      draft(
        "army_union",
        -1,
        ["berlin:+2", "army:+1"],
        [inst("berlin", 2), inst("army", 1)],
      ),
    ],
    passed: [inst("nations", -1)],
    passedTell: ["nations:-1"],
    term: [],
    repeal: {
      authority: 20,
      tell: ["berlin:-1"],
      effects: [inst("berlin", -1)],
    },
    talk: lawTalk("auh_x_mitteleuropa", {
      who: held("hun_pm"),
      ask: "frank",
      push: "cold",
      tell: ["hungary:+1"],
      price: [inst("hungary", 1)],
      wins: 1,
      tempers: ["stubborn"],
    }),
  }),
  row({
    id: "auh_x_federal",
    chapter: "nations",
    exclusive: own("auh_csoc", "x1"),
    opens: anyTime,
    lean: -1,
    decree: true,
    body: "council",
    cast: vienna,
    draft: [
      draft("historic_lands", 1, ["nations:+1"], [inst("nations", 1)]),
      draft(
        "national_lands",
        -1,
        ["nations:+2", "hungary:-1"],
        [inst("nations", 2), inst("hungary", -1)],
      ),
      draft(
        "crown_council",
        0,
        ["nations:+1", "council:-1"],
        [inst("nations", 1), inst("council", -1)],
      ),
    ],
    passed: [inst("hungary", -1)],
    passedTell: ["hungary:-1"],
    term: [{ gauge: "order", delta: 1, every: 12, offset: 6 }],
    repeal: {
      authority: 30,
      tell: ["nations:-2"],
      effects: [inst("nations", -2)],
    },
    talk: lawTalk("auh_x_federal", {
      who: held("hun_pm"),
      ask: "frank",
      push: "cold",
      tell: ["hungary:+1"],
      price: [inst("hungary", 1)],
      wins: 1,
      tempers: ["stubborn"],
    }),
  }),
  row({
    id: "auh_x_trial",
    chapter: "nations",
    exclusive: own("auh_slavs", "x1"),
    opens: anyTime,
    lean: -2,
    decree: false,
    cast: both,
    draft: [
      draft(
        "three_lands",
        0,
        ["nations:+2", "hungary:-1"],
        [inst("nations", 2), inst("hungary", -1)],
      ),
      draft(
        "with_bosnia",
        -1,
        ["nations:+2", "hungary:-2"],
        [inst("nations", 2), inst("hungary", -2)],
      ),
      draft("under_saint_stephen", 1, ["nations:+1"], [inst("nations", 1)]),
    ],
    passed: [setFlag("f_auh_trial_law")],
    passedTell: [],
    term: [],
    repeal: {
      authority: 30,
      tell: ["nations:-2"],
      effects: [inst("nations", -2)],
    },
    talk: lawTalk("auh_x_trial", {
      who: held("hun_pm"),
      ask: "frank",
      push: "cold",
      tell: ["hungary:+1"],
      price: [inst("hungary", 1)],
      wins: 1,
      tempers: ["stubborn"],
    }),
  }),
  row({
    id: "auh_x_autonomy",
    chapter: "nations",
    exclusive: own("auh_sd", "b1"),
    opens: anyTime,
    lean: -1,
    decree: true,
    body: "council",
    cast: vienna,
    draft: [
      draft("national_registers", 0, ["nations:+1"], [inst("nations", 1)]),
      draft(
        "national_councils",
        -1,
        ["nations:+2", "council:-1"],
        [inst("nations", 2), inst("council", -1)],
      ),
      draft("school_peace", 1, ["nations:+1"], [inst("nations", 1)]),
    ],
    passed: [gauge("order", 1)],
    passedTell: ["order:+1"],
    term: [],
    repeal: {
      authority: 20,
      tell: ["nations:-1"],
      effects: [inst("nations", -1)],
    },
    talk: lawTalk("auh_x_autonomy", {
      who: leaderOf("auh_germans"),
      ask: "frank",
      push: "cold",
      tell: ["nations:-1"],
      price: [inst("nations", -1)],
      wins: 1,
    }),
  }),
  row({
    id: "auh_x_bohemian_crown",
    chapter: "nations",
    exclusive: own("auh_czech", "x1"),
    opens: anyTime,
    lean: -2,
    decree: true,
    body: "council",
    cast: vienna,
    draft: [
      draft(
        "coronation",
        0,
        ["nations:+1", "morale:+1"],
        [inst("nations", 1), gauge("morale", 1)],
      ),
      draft(
        "chancellery",
        -1,
        ["nations:+2", "council:-1"],
        [inst("nations", 2), inst("council", -1)],
      ),
      draft("czech_first", -2, ["nations:+2"], [inst("nations", 2)]),
    ],
    passed: [inst("hungary", -1)],
    passedTell: ["hungary:-1"],
    term: [],
    repeal: {
      authority: 30,
      tell: ["nations:-2"],
      effects: [inst("nations", -2)],
    },
    talk: lawTalk("auh_x_bohemian_crown", {
      who: leaderOf("auh_germans"),
      ask: "frank",
      push: "cold",
      tell: ["nations:-1"],
      price: [inst("nations", -1)],
      wins: 1,
    }),
  }),
];

// ---- ww207 (W-AUH): what each bill text does to the axes ----
// Notches by axis (one a bill): rule 칙령 -1 / 의회 +1, class 재산 -1 / 노동
// +1, dual 이원 체제 -1 / 민족들 +1. Every text of every AUH bill has one.
export const AUH_LAW_AXES: Readonly<
  Record<string, Readonly<Record<string, GwAxisPush>>>
> = {
  auh_press: {
    surveillance_office: { rule: -1, dual: -1 },
    front_zone: { rule: -1 },
    civil_censors: { rule: 1 },
  },
  auh_landsturm: {
    to_fifty: { rule: -1 },
    to_forty_five: { rule: -1 },
    harvest_leave: { class: 1 },
  },
  auh_factories: {
    military_direction: { rule: -1, class: -1 },
    complaint_boards: { class: 1 },
    wage_floor: { class: 1, rule: 1 },
  },
  auh_food: {
    common_committee: { dual: 1 },
    army_first: { rule: -1 },
    hungarian_price: { dual: -1, class: -1 },
  },
  auh_galicia: {
    special_status: { dual: 1 },
    after_the_war: { dual: -1 },
    east_divided: { dual: 1, class: 1 },
  },
  auh_transylvania: {
    schools: { dual: 1 },
    language_and_seats: { dual: 1, rule: 1 },
    words_to_bucharest: { dual: -1 },
  },
  auh_oktroi: {
    bohemia_split: { rule: -1, dual: -1 },
    state_language: { rule: -1, dual: -1 },
  },
  auh_reichsrat: {
    open_with_oath: { rule: 1, dual: -1 },
    open_plainly: { rule: 1 },
    with_amnesty: { rule: 1, dual: 1 },
  },
  auh_franchise: {
    soldiers_vote: { rule: 1 },
    literate_vote: { rule: 1, dual: -1 },
    universal: { rule: 1, class: 1 },
  },
  auh_war_tax: {
    loans_only: { class: -1 },
    profits_tax: { class: 1 },
    surcharge: { rule: -1 },
  },
  auh_war_zone: {
    army_courts: { rule: -1, dual: -1 },
    war_zone_only: { rule: -1 },
    civil_courts: { rule: 1 },
  },
  auh_army_bill: {
    full_quota: { rule: -1 },
    magyar_words: { dual: -1 },
    with_levy: { rule: -1, class: 1 },
  },
  auh_postpone: {
    until_peace: { rule: -1 },
    year_by_year: { rule: 1 },
    with_soldiers_vote: { rule: 1, class: 1 },
  },
  auh_bohemia: {
    commission: { rule: -1 },
    compromise: { rule: 1, dual: 1 },
    german_districts: { dual: -1 },
  },
  auh_croatia: {
    bans_hand: { rule: -1, dual: -1 },
    railway_croatian: { dual: 1 },
    dalmatia_joined: { dual: 1, rule: 1 },
  },
  auh_kmet: {
    voluntary: { class: -1 },
    obligatory: { class: 1 },
    colonists: { dual: -1 },
  },
  auh_insurance: {
    old_age: { class: 1 },
    small_masters: { class: -1 },
    sickness_only: { rule: -1 },
  },
  auh_income_tax: {
    progressive: { class: 1 },
    consumption: { class: -1 },
    estates: { class: 1, dual: 1 },
  },
  auh_schools: {
    magyar_hours: { dual: -1 },
    mother_tongue: { dual: 1 },
    state_schools: { rule: 1 },
  },
  auh_x_magyar_army: {
    magyar_command: { dual: -1 },
    honved_grows: { dual: -1, rule: -1 },
    own_army: { dual: -1, rule: 1 },
  },
  auh_x_mitteleuropa: {
    customs_union: { dual: -1 },
    slow_steps: { dual: -1 },
    army_union: { dual: -1, rule: -1 },
  },
  auh_x_federal: {
    historic_lands: { dual: 1, rule: -1 },
    national_lands: { dual: 1 },
    crown_council: { dual: 1, rule: -1 },
  },
  auh_x_trial: {
    three_lands: { dual: 1 },
    with_bosnia: { dual: 1, rule: -1 },
    under_saint_stephen: { dual: 1 },
  },
  auh_x_autonomy: {
    national_registers: { dual: 1, rule: 1 },
    national_councils: { dual: 1 },
    school_peace: { dual: 1, class: 1 },
  },
  auh_x_bohemian_crown: {
    coronation: { dual: 1, rule: -1 },
    chancellery: { dual: 1 },
    czech_first: { dual: 1, rule: 1 },
  },
  // The house's own bills (content/house/auh.ts).
  auh_rents: {
    small_flats: { class: 1 },
    all_flats: { class: 1, rule: 1 },
    soldiers_families: { class: 1 },
  },
  auh_war_aid: {
    per_child: { class: 1 },
    flat_raise: { class: 1 },
    in_kind: { rule: -1 },
  },
  auh_peace_motion: {
    no_annexations: { rule: 1 },
    talks_now: { rule: 1, class: 1 },
    with_allies: { dual: -1 },
  },
};

/**
 * The Diet's franchise each text of the franchise bill sets (the census
 * broken by degrees: the soldiers' vote, the literate vote, every man).
 */
const AUH_FRANCHISE: Readonly<Record<string, GwLawDraft["franchise"]>> = {
  soldiers_vote: { chamber: "budapest", to: "curia" },
  literate_vote: { chamber: "budapest", to: "wide" },
  universal: { chamber: "budapest", to: "equal" },
};

/** The rows with their axis pushes (and the franchise texts) laid on. */
export function withAuhAxes(rows: readonly GwLawRow[]): GwLawRow[] {
  return rows.map((r) => ({
    ...r,
    draft: r.draft.map((d) => {
      const axes = AUH_LAW_AXES[r.id]?.[d.id];
      const franchise =
        r.id === "auh_franchise" ? AUH_FRANCHISE[d.id] : undefined;
      return {
        ...d,
        ...(axes === undefined ? {} : { axes }),
        ...(franchise === undefined ? {} : { franchise }),
      };
    }),
  }));
}

export const AUH_LAWS: readonly GwLawRow[] = withAuhAxes([
  ...AUH_WAR_LAWS,
  ...AUH_PEACE_LAWS,
  ...AUH_EXCLUSIVE_LAWS,
]);
