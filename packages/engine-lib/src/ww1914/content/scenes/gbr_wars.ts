// Great War 1914 (ww171 phase 4): GBR's state-event scenes for war between
// any pair: a war with a country begins, a front opens, a neutral comes in,
// a peace of two. Owned by the GBR writer lane; shapes and conditions in
// /home/eser/dev/ww171-format4.md, conditions from ./war_events. Text in
// resources/ww1914/ko/GBR.wars.json.
//
// Britain can fight Germany, Austria-Hungary, Bulgaria, Turkey and Persia.
// Each scene says what happened, never when: the state calls it.
import type {
  GwGauge,
  GwInstitution,
  GwSide,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwBloc } from "@openfront/engine-api/ww1914/GwPress";
import {
  all,
  any,
  not,
  reason,
  remember,
  type GwCastRule,
  type GwCond,
  type GwEffect,
  type GwOption,
  type GwScene,
  type GwVariant,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";
import {
  declaredBy,
  frontOn,
  frontOpened,
  joined,
  offered,
  ownWarWith,
  peaceMade,
  warBetween,
  warWith,
} from "./war_events";

const NATION: GwScene["nation"] = ["GBR"];
const TAGS: GwScene["tags"] = ["foreign", "war"];

// ---- Cast ----

const FM: GwCastRule = { office: "foreign" };
const ADM: GwCastRule = {
  any_of: [{ office: "navy" }, { office: "sea_lord" }],
};
const MIL: GwCastRule = {
  any_of: [{ office: "war" }, { office: "chief_of_staff" }],
};
const FIN: GwCastRule = { office: "finance" };

// ---- Conditions ----

/** Britain is at war with `tag` now, however long. */
const atWar = (tag: GwTag): GwCond => world({ is: "pair_war", with: tag });
/** Britain's war with `tag` is the two's own, however long. */
const ownWar = (tag: GwTag): GwCond =>
  world({ is: "pair_war", with: tag, outside: true });
/** Two others fight each other now, however long. */
const fight = (a: GwTag, b: GwTag): GwCond =>
  world({ is: "pair_war", tag: a, with: b });
/** Britain's war with `tag` came this way. */
const came = (tag: GwTag, ...cause: string[]): GwCond =>
  world({ is: "pair_war", with: tag, cause });
const fights = (tag: GwTag, side?: GwSide): GwCond =>
  world(
    side === undefined ? { is: "entered", tag } : { is: "entered", tag, side },
  );
/** Britain stands in the Entente's coalition. */
const entente = world({ is: "side", of: ["entente"] });
const ahead = world({ is: "score", min: 15 });
const behind = world({ is: "score", max: -15 });

// ---- Effects ----

const gauge = (g: GwGauge, delta: number): GwEffect => ({
  kind: "gauge",
  gauge: g,
  delta,
});
const inst = (i: GwInstitution, delta: number): GwEffect => ({
  kind: "inst",
  inst: i,
  delta,
});
const trust = (tag: GwTag, delta: number): GwEffect => ({
  kind: "trust",
  tag,
  delta,
});
const opinion = (bloc: GwBloc, delta: number): GwEffect => ({
  kind: "opinion",
  bloc,
  delta,
});

// ---- Builders ----

const v = (id: string, when?: GwCond): GwVariant =>
  when === undefined ? { id } : { id, when };

/** An option: no tell (results show after the pick), a reason line last. */
const o = (id: string, effects: GwEffect[]): GwOption => ({
  id,
  tell: [],
  effects: [...effects, reason(`gbr_wvr_${id}`)],
});

const wire = (
  id: string,
  when: GwCond,
  cast: Record<string, GwCastRule>,
  variants: GwVariant[],
  salience = 6,
): GwScene => ({
  id: `gbr_wv_${id}`,
  nation: NATION,
  kind: "wire",
  once: true,
  salience,
  tags: TAGS,
  cast,
  when,
  variants,
});

const proposal = (
  id: string,
  when: GwCond,
  cast: Record<string, GwCastRule>,
  variants: GwVariant[],
  options: GwOption[],
  salience = 7,
): GwScene => ({
  id: `gbr_wv_${id}`,
  nation: NATION,
  kind: "proposal",
  once: true,
  salience,
  tags: TAGS,
  cast,
  when,
  variants,
  fallback: options[0].id,
  options,
});

// ---- War begins (14) ----

const WAR_BEGINS: GwScene[] = [
  wire(
    "war_deu",
    warWith("DEU", 2),
    { fm: FM, adm: ADM },
    [
      v("ladder", came("DEU", "ladder")),
      v("entered", came("DEU", "entered", "treaty")),
      v("we_declared", all(came("DEU", "declared"), declaredBy("GBR", "DEU"))),
      v(
        "they_declared",
        all(came("DEU", "declared"), declaredBy("DEU", "GBR")),
      ),
      v("base"),
    ],
    8,
  ),
  proposal(
    "war_deu_alone",
    all(warWith("DEU", 3), not(fight("FRA", "DEU"))),
    { fm: FM, mil: MIL },
    [v("russia", fight("RUS", "DEU")), v("base")],
    [
      o("alone_sea", [opinion("army", -1), inst("cabinet", 1)]),
      o("alone_bef", [opinion("army", 1), gauge("shells", -1)]),
      o("alone_paris", [
        trust("FRA", 1),
        inst("cabinet", -1),
        remember("m_gbr_wv_asked_paris"),
      ]),
    ],
    8,
  ),
  proposal(
    "war_deu_commons",
    all(
      warWith("DEU", 3),
      came("DEU", "ladder", "declared"),
      not(fight("DEU", "BEL")),
    ),
    { fm: FM },
    [v("ladder", came("DEU", "ladder")), v("base")],
    [
      o("commons_balance", [inst("opposition", 1), inst("cabinet", -1)]),
      o("commons_fleet", [opinion("press", 1), opinion("workers", -1)]),
      o("commons_word", [inst("cabinet", 1), inst("commons", -1)]),
    ],
  ),
  wire(
    "war_auh",
    warWith("AUH", 2),
    { fm: FM, adm: ADM },
    [v("with_deu", atWar("DEU")), v("base")],
    7,
  ),
  proposal(
    "war_auh_only",
    all(warWith("AUH", 3), not(atWar("DEU"))),
    { fm: FM, adm: ADM },
    [v("serbia", fight("AUH", "SRB")), v("base")],
    [
      o("auh_otranto", [gauge("money", -1), opinion("press", 1)]),
      o("auh_berlin", [trust("DEU", 1), inst("opposition", -1)]),
      o("auh_salonika", [
        trust("SRB", 1),
        opinion("army", 1),
        gauge("shells", -1),
      ]),
    ],
    8,
  ),
  wire(
    "war_ott",
    all(warWith("OTT", 2), not(ownWarWith("OTT", 2))),
    { fm: FM, mil: MIL },
    [
      v("entered", came("OTT", "entered", "treaty")),
      v("ladder", came("OTT", "ladder")),
      v("base"),
    ],
    7,
  ),
  proposal(
    "war_ott_egypt",
    warWith("OTT", 4),
    { fm: FM, mil: MIL },
    [v("suez", frontOpened("palestine", 4)), v("base")],
    [
      o("egypt_protect", [
        gauge("order", 1),
        trust("OTT", -1),
        remember("m_gbr_wv_egypt"),
      ]),
      o("egypt_annex", [
        opinion("press", 1),
        gauge("order", -1),
        trust("FRA", -1),
        remember("m_gbr_wv_egypt"),
      ]),
      o("egypt_khedive", [gauge("order", -1), inst("cabinet", 1)]),
    ],
  ),
  proposal(
    "own_ott",
    ownWarWith("OTT", 3),
    { fm: FM, adm: ADM },
    [v("russia", fight("RUS", "OTT")), v("base")],
    [
      o("ott_basra", [gauge("money", -1), opinion("business", 1)]),
      o("ott_dardanelles", [
        opinion("press", 1),
        gauge("shells", -1),
        trust("RUS", -1),
      ]),
      o("ott_suez", [inst("cabinet", 1), opinion("press", -1)]),
    ],
    8,
  ),
  wire(
    "war_bgr",
    all(warWith("BGR", 2), not(ownWarWith("BGR", 2))),
    { fm: FM },
    [v("greece", fights("GRC", "entente")), v("base")],
  ),
  proposal(
    "own_bgr",
    ownWarWith("BGR", 3),
    { fm: FM, adm: ADM },
    [v("serbia", fight("BGR", "SRB")), v("base")],
    [
      o("bgr_coast", [trust("GRC", 1), gauge("money", -1)]),
      o("bgr_athens", [trust("GRC", 1), trust("BGR", -1), inst("cabinet", -1)]),
      o("bgr_terms", [trust("BGR", 1), opinion("press", -1)]),
    ],
  ),
  proposal(
    "own_irn",
    warWith("IRN", 3),
    { fm: FM, fin: FIN },
    [v("russia", fight("RUS", "IRN")), v("coalition", entente), v("base")],
    [
      o("irn_oil", [gauge("money", -1), opinion("business", 1)]),
      o("irn_sheikhs", [gauge("money", -1), remember("m_gbr_wv_sheikhs")]),
      o("irn_tehran", [trust("IRN", 1), inst("opposition", -1)]),
    ],
  ),
  proposal(
    "between_deu_bel",
    all(warBetween("DEU", "BEL", 2), not(atWar("DEU"))),
    { fm: FM },
    [v("france", fight("DEU", "FRA")), v("base")],
    [
      o("bel_note", [trust("DEU", -1), trust("BEL", 1), inst("cabinet", -1)]),
      o("bel_house", [inst("commons", 1), opinion("press", 1)]),
      o("bel_quiet", [inst("cabinet", 1), trust("BEL", -1)]),
    ],
    8,
  ),
  proposal(
    "between_deu_nld",
    warBetween("DEU", "NLD", 2),
    { fm: FM, adm: ADM },
    [v("at_war", atWar("DEU")), v("base")],
    [
      o("nld_scheldt", [trust("NLD", 1), trust("DEU", -1)]),
      o("nld_arms", [trust("NLD", 1), gauge("shells", -1)]),
      o("nld_watch", [inst("cabinet", 1), trust("NLD", -1)]),
    ],
  ),
  wire(
    "between_rus_ott",
    all(warBetween("RUS", "OTT", 2), not(atWar("OTT"))),
    { fm: FM },
    [v("allies", all(entente, fights("RUS", "entente"))), v("base")],
  ),
];

// ---- Fronts open (8) ----

/** Britain fights someone at the other end of the front. */
const foesOn = (...tags: GwTag[]): GwCond => any(...tags.map(atWar));

const FRONTS: GwScene[] = [
  wire(
    "front_west",
    frontOpened("west", 1),
    { mil: MIL },
    [v("in", atWar("DEU")), v("base")],
    7,
  ),
  proposal(
    "front_sea",
    frontOn("sea", "GBR", 2),
    { adm: ADM, fm: FM },
    [v("america", fights("USA", "entente")), v("base")],
    [
      o("sea_distant", [trust("USA", -1), opinion("business", -1)]),
      o("sea_close", [opinion("press", 1), gauge("shells", -1)]),
      o("sea_narrow", [trust("USA", 1), opinion("business", 1)]),
    ],
  ),
  proposal(
    "front_colonies",
    frontOn("colonies", "GBR", 2),
    { mil: MIL },
    [v("japan", fights("JPN", "entente")), v("base")],
    [
      o("col_dominions", [inst("cabinet", 1), opinion("press", 1)]),
      o("col_india", [gauge("money", -1), opinion("army", 1)]),
      o("col_wireless", [inst("cabinet", -1), remember("m_gbr_wv_wireless")]),
    ],
    6,
  ),
  proposal(
    "front_balkan",
    all(frontOpened("balkan", 2), foesOn("AUH", "BGR")),
    { fm: FM, mil: MIL },
    [v("greece", fights("GRC", "entente")), v("base")],
    [
      o("balk_army", [
        opinion("army", -1),
        gauge("shells", -1),
        trust("SRB", 1),
      ]),
      o("balk_ships", [trust("SRB", -1), inst("cabinet", 1)]),
    ],
    6,
  ),
  proposal(
    "front_straits",
    frontOn("straits", "GBR", 2),
    { adm: ADM, mil: MIL },
    [v("russia", all(fights("RUS", "entente"), entente)), v("base")],
    [
      o("str_ships", [opinion("press", 1), gauge("shells", -1)]),
      o("str_army", [
        opinion("army", -1),
        gauge("shells", -1),
        trust("RUS", 1),
      ]),
      o("str_wait", [inst("cabinet", 1), trust("RUS", -1)]),
    ],
  ),
  wire("front_mesopotamia", frontOn("mesopotamia", "GBR", 2), { mil: MIL }, [
    v("own", ownWar("OTT")),
    v("base"),
  ]),
  wire("front_palestine", frontOn("palestine", "GBR", 2), { mil: MIL }, [
    v("own", ownWar("OTT")),
    v("base"),
  ]),
  wire("front_persia", frontOn("persia", "GBR", 2), { fm: FM }, [
    v("russia", any(fight("RUS", "OTT"), fight("RUS", "IRN"))),
    v("base"),
  ]),
];

// ---- Neutrals come in (9) ----

/** With us, against us, or a war Britain watches from outside its coalition. */
const sides = (tag: GwTag): GwVariant[] => [
  v("with", all(entente, fights(tag, "entente"))),
  v("against", all(entente, fights(tag, "central"))),
  v("base"),
];

const JOINS: GwScene[] = [
  wire("join_ita", joined("ITA", undefined, 2), { fm: FM }, sides("ITA"), 7),
  wire("join_ott", joined("OTT", undefined, 2), { fm: FM }, sides("OTT"), 7),
  wire("join_bgr", joined("BGR", undefined, 2), { fm: FM }, sides("BGR")),
  wire("join_rou", joined("ROU", undefined, 2), { fm: FM }, sides("ROU")),
  wire("join_grc", joined("GRC", undefined, 2), { fm: FM }, sides("GRC")),
  proposal(
    "join_usa",
    all(joined("USA", "entente", 2), entente),
    { fm: FM, fin: FIN },
    [v("ahead", ahead), v("behind", behind), v("base")],
    [
      o("usa_ships", [trust("USA", 1), gauge("bread", 1), opinion("army", -1)]),
      o("usa_men", [trust("USA", -1), opinion("army", 1)]),
      o("usa_money", [gauge("money", 1), inst("opposition", -1)]),
    ],
    8,
  ),
  wire("join_jpn", joined("JPN", undefined, 2), { fm: FM }, sides("JPN")),
  wire("join_nld", joined("NLD", undefined, 2), { adm: ADM }, sides("NLD")),
  wire("join_bel", joined("BEL", undefined, 2), { fm: FM }, sides("BEL"), 7),
];

// ---- Peace of two (9) ----

const PEACES: GwScene[] = [
  wire(
    "peace_deu",
    peaceMade("GBR", "DEU", undefined, 2),
    { fm: FM, adm: ADM },
    [v("france_fights", fight("FRA", "DEU")), v("base")],
    8,
  ),
  wire(
    "peace_auh",
    peaceMade("GBR", "AUH", undefined, 2),
    { fm: FM },
    [v("deu_fights", atWar("DEU")), v("base")],
    7,
  ),
  wire(
    "peace_ott",
    peaceMade("GBR", "OTT", undefined, 2),
    { fm: FM, mil: MIL },
    [v("deu_fights", atWar("DEU")), v("base")],
    7,
  ),
  wire("peace_bgr", peaceMade("GBR", "BGR", undefined, 2), { fm: FM }, [
    v("deu_fights", atWar("DEU")),
    v("base"),
  ]),
  wire("peace_irn", peaceMade("GBR", "IRN", undefined, 2), { fm: FM }, [
    v("ott_fights", atWar("OTT")),
    v("base"),
  ]),
  proposal(
    "peace_fra_deu",
    all(peaceMade("FRA", "DEU", undefined, 2), atWar("DEU")),
    { fm: FM, adm: ADM },
    [v("russia", fight("RUS", "DEU")), v("base")],
    [
      o("fra_fight_on", [gauge("morale", -1), opinion("press", 1)]),
      o("fra_sound", [inst("opposition", -1), opinion("workers", 1)]),
      o("fra_bring_home", [opinion("army", -1), gauge("morale", 1)]),
    ],
    8,
  ),
  wire(
    "peace_rus_deu",
    all(peaceMade("RUS", "DEU", undefined, 2), atWar("DEU")),
    { fm: FM, mil: MIL },
    [v("france", fight("FRA", "DEU")), v("base")],
    7,
  ),
  wire(
    "offer_deu",
    all(offered("DEU"), atWar("DEU")),
    { fm: FM },
    [v("ahead", ahead), v("behind", behind), v("base")],
    8,
  ),
  wire(
    "offer_ott",
    all(offered("OTT"), atWar("OTT")),
    { fm: FM },
    [v("own", ownWar("OTT")), v("base")],
    7,
  ),
];

export const GBR_WAR_EVENTS: readonly GwScene[] = [
  ...WAR_BEGINS,
  ...FRONTS,
  ...JOINS,
  ...PEACES,
];
