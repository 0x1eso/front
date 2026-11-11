// Great War 1914 (ww172 phase 5): GBR's scenes of occupation and the
// bilateral tables: land taken or lost, a capital falling, a country knocked
// out, a table of two sitting or signed. Owned by the GBR writer lane;
// shapes and conditions in /home/eser/dev/ww172-format5.md, conditions from
// ./land_events. Text, and the memoir lines on the new endings, in
// resources/ww1914/ko/GBR.lands.json.
//
// Britain takes land by land only from Turkey (Mesopotamia, Palestine,
// Syria; Constantinople by the Straits front). Its own land falls only at a
// lost table or over the water. Each scene says what happened, never when.
import type {
  GwGauge,
  GwInstitution,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwBloc } from "@openfront/engine-api/ww1914/GwPress";
import {
  all,
  any,
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
  capitalFell,
  heldLand,
  knockedOut,
  lostCapital,
  lostLand,
  tableSigned,
  tableSits,
  tableSitsAs,
  tookCapital,
  tookLand,
  tookPlace,
} from "./land_events";

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

const entente = world({ is: "side", of: ["entente"] });
const central = world({ is: "side", of: ["central"] });
/** `tag` stands on Britain's side of the war. */
const withUs = (tag: GwTag): GwCond =>
  any(
    all(entente, world({ is: "entered", tag, side: "entente" })),
    all(central, world({ is: "entered", tag, side: "central" })),
  );
/** Britain's war with `tag` ended within `months`. */
const fought = (tag: GwTag, months = 1): GwCond =>
  world({ is: "pair_peace", with: tag, max: months });

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
const o = (id: string, effects: GwEffect[], when?: GwCond): GwOption => ({
  id,
  ...(when === undefined ? {} : { when }),
  tell: [],
  effects: [...effects, reason(`gbr_ldr_${id}`)],
});

const wire = (
  id: string,
  when: GwCond,
  cast: Record<string, GwCastRule>,
  variants: GwVariant[],
  salience = 6,
): GwScene => ({
  id: `gbr_ld_${id}`,
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
  id: `gbr_ld_${id}`,
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

// ---- Occupation, ours (9) ----

const OURS: GwScene[] = [
  wire("ours_basra", tookPlace(["basra"], 1), { fm: FM, mil: MIL }, [
    v("out", knockedOut("OTT", 6)),
    v("base"),
  ]),
  proposal(
    "ours_baghdad",
    tookPlace(["baghdad"], 2),
    { fm: FM, mil: MIL },
    [v("out", knockedOut("OTT", 6)), v("base")],
    [
      o("bag_india", [opinion("business", 1), gauge("order", -1)]),
      o("bag_notables", [inst("cabinet", -1), gauge("order", 1)]),
      o("bag_army", [opinion("army", 1), opinion("press", -1)]),
    ],
    8,
  ),
  proposal(
    "ours_jerusalem",
    tookPlace(["jerusalem"], 2),
    { fm: FM, mil: MIL },
    [v("out", knockedOut("OTT", 6)), v("base")],
    [
      o("jer_status", [gauge("order", 1), opinion("press", -1)]),
      o("jer_flag", [opinion("press", 1), trust("FRA", -1)]),
      o("jer_joint", [trust("FRA", 1), inst("cabinet", -1)], withUs("FRA")),
    ],
    8,
  ),
  proposal(
    "ours_damascus",
    tookPlace(["damascus"], 2),
    { fm: FM, mil: MIL },
    [v("france", withUs("FRA")), v("base")],
    [
      o("dam_arab", [trust("FRA", -1), gauge("order", 1)]),
      o("dam_french", [trust("FRA", 1), opinion("press", -1)]),
      o("dam_military", [gauge("money", -1), opinion("army", 1)]),
    ],
    8,
  ),
  wire(
    "ours_capital",
    tookCapital("OTT"),
    { fm: FM, adm: ADM },
    [v("out", knockedOut("OTT", 3)), v("russia", withUs("RUS")), v("base")],
    8,
  ),
  proposal(
    "ours_sultan",
    tookCapital("OTT", 3),
    { fm: FM, adm: ADM },
    [v("out", knockedOut("OTT", 6)), v("base")],
    [
      o("sul_keep", [gauge("order", 1), opinion("press", -1)]),
      o("sul_fleet", [opinion("press", 1), gauge("money", -1)]),
      o(
        "sul_straits",
        [trust("RUS", 1), trust("FRA", 1), inst("cabinet", -1)],
        any(withUs("RUS"), withUs("FRA")),
      ),
    ],
    8,
  ),
  wire(
    "ours_after_out",
    all(tookLand("OTT", 1), knockedOut("OTT", 6)),
    { fm: FM, mil: MIL },
    [v("capital", tookCapital("OTT", 12)), v("base")],
    7,
  ),
  proposal(
    "ours_people",
    heldLand("OTT", 3),
    { mil: MIL, fin: FIN },
    [v("out", knockedOut("OTT", 12)), v("base")],
    [
      o("ppl_grain", [gauge("money", -1), gauge("order", 1)]),
      o("ppl_levy", [opinion("army", 1), opinion("press", -1)]),
      o("ppl_notables", [gauge("money", -1), inst("cabinet", 1)]),
    ],
  ),
  proposal(
    "ours_allies",
    all(heldLand("OTT", 2), withUs("FRA")),
    { fm: FM },
    [v("russia", withUs("RUS")), v("base")],
    [
      o("al_paper", [
        trust("FRA", 1),
        opinion("press", -1),
        remember("m_gbr_ld_spheres"),
      ]),
      o("al_later", [trust("FRA", -1), inst("cabinet", 1)]),
      o(
        "al_three",
        [trust("RUS", 1), trust("FRA", 1), inst("commons", -1)],
        withUs("RUS"),
      ),
    ],
  ),
];

// ---- Occupation, theirs (8) ----

const THEIRS: GwScene[] = [
  wire(
    "theirs_egypt",
    lostLand("OTT", 1),
    { fm: FM, mil: MIL },
    [v("table", tableSigned("lost", "OTT", 2)), v("base")],
    8,
  ),
  proposal(
    "theirs_canal",
    lostLand("OTT", 3),
    { adm: ADM, fin: FIN },
    [v("table", tableSigned("lost", "OTT", 4)), v("base")],
    [
      o("cnl_cape", [gauge("money", -1), opinion("business", 1)]),
      o("cnl_sudan", [opinion("army", 1), gauge("shells", -1)]),
      o("cnl_bear", [inst("cabinet", 1), opinion("press", -1)]),
    ],
  ),
  wire(
    "theirs_isles",
    lostLand("DEU", 1),
    { adm: ADM, mil: MIL },
    [v("table", tableSigned("lost", "DEU", 2)), v("base")],
    8,
  ),
  wire(
    "theirs_london",
    lostCapital(),
    { fm: FM, mil: MIL },
    [v("deu", world({ is: "land_lost", to: "DEU", capital: true })), v("base")],
    8,
  ),
  proposal(
    "fell_paris",
    capitalFell("DEU", "FRA", 1),
    { fm: FM, mil: MIL },
    [v("ally", withUs("FRA")), v("base")],
    [
      o("par_ports", [opinion("army", 1), gauge("shells", -1)]),
      o("par_refuge", [trust("FRA", 1), gauge("money", -1)]),
      o("par_terms", [trust("FRA", -1), inst("opposition", 1)]),
    ],
    8,
  ),
  wire(
    "fell_brussels",
    capitalFell("DEU", "BEL", 1),
    { fm: FM, adm: ADM },
    [v("ally", withUs("BEL")), v("base")],
    7,
  ),
  proposal(
    "fell_straits",
    capitalFell("RUS", "OTT", 1),
    { fm: FM, adm: ADM },
    [v("ally", withUs("RUS")), v("base")],
    [
      o("str_welcome", [trust("RUS", 1), opinion("press", -1)]),
      o("str_squadron", [gauge("money", -1), trust("RUS", -1)]),
      o("str_india", [gauge("order", 1), inst("cabinet", -1)]),
    ],
  ),
  wire(
    "fell_petrograd",
    capitalFell("DEU", "RUS", 1),
    { fm: FM, adm: ADM },
    [v("ally", withUs("RUS")), v("base")],
    7,
  ),
];

// ---- Knocked out (6) ----

const OUT: GwScene[] = [
  proposal(
    "out_ott",
    all(knockedOut("OTT", 1), any(fought("OTT"), withUs("OTT"))),
    { fm: FM, mil: MIL },
    [v("ally", withUs("OTT")), v("base")],
    [
      o("oo_straits", [opinion("business", 1), trust("RUS", 1)]),
      o("oo_divisions", [opinion("army", 1), gauge("order", -1)]),
      o("oo_promises", [gauge("order", 1), trust("FRA", -1)]),
    ],
    8,
  ),
  wire(
    "out_deu",
    all(knockedOut("DEU", 1), any(fought("DEU"), withUs("DEU"))),
    { fm: FM, adm: ADM },
    [v("ally", withUs("DEU")), v("base")],
    8,
  ),
  wire(
    "out_auh",
    all(knockedOut("AUH", 1), any(fought("AUH"), withUs("AUH"))),
    { fm: FM },
    [v("ally", withUs("AUH")), v("base")],
    7,
  ),
  wire(
    "out_bgr",
    all(knockedOut("BGR", 1), any(fought("BGR"), withUs("BGR"))),
    { fm: FM, mil: MIL },
    [v("ally", withUs("BGR")), v("base")],
  ),
  proposal(
    "out_fra",
    all(knockedOut("FRA", 1), withUs("FRA")),
    { fm: FM, mil: MIL },
    [v("paris", capitalFell("DEU", "FRA", 6)), v("base")],
    [
      o("of_home", [opinion("army", -1), gauge("morale", 1)]),
      o("of_flanders", [opinion("army", 1), gauge("shells", -1)]),
      o("of_sound", [inst("opposition", 1), inst("cabinet", -1)]),
    ],
    8,
  ),
  proposal(
    "out_rus",
    all(knockedOut("RUS", 1), withUs("RUS")),
    { fm: FM, fin: FIN },
    [v("capital", capitalFell("DEU", "RUS", 6)), v("base")],
    [
      o("or_ports", [gauge("money", -1), opinion("army", 1)]),
      o("or_west", [opinion("army", 1), opinion("press", -1)]),
      o("or_loans", [opinion("business", -1), inst("cabinet", 1)]),
    ],
  ),
];

// ---- The bilateral table (8) ----

const TABLE: GwScene[] = [
  proposal(
    "table_ott",
    tableSits("OTT"),
    { fm: FM, fin: FIN },
    [
      v("won", tableSitsAs("won", "OTT")),
      v("lost", tableSitsAs("lost", "OTT")),
      v("base"),
    ],
    [
      o("to_oil", [opinion("business", 1), inst("opposition", 1)]),
      o("to_holy", [opinion("press", 1), trust("FRA", -1)]),
      o("to_quick", [inst("cabinet", 1), opinion("army", -1)]),
    ],
    8,
  ),
  proposal(
    "table_deu",
    tableSits("DEU"),
    { fm: FM, adm: ADM },
    [
      v("won", tableSitsAs("won", "DEU")),
      v("lost", tableSitsAs("lost", "DEU")),
      v("base"),
    ],
    [
      o("td_fleet", [opinion("press", 1), trust("DEU", -1)]),
      o("td_belgium", [trust("BEL", 1), inst("commons", 1)]),
      o("td_trade", [opinion("business", 1), opinion("army", -1)]),
    ],
    8,
  ),
  wire(
    "table_auh",
    tableSits("AUH"),
    { fm: FM },
    [v("won", tableSitsAs("won", "AUH")), v("base")],
    7,
  ),
  wire("table_bgr", tableSits("BGR"), { fm: FM }, [
    v("won", tableSitsAs("won", "BGR")),
    v("base"),
  ]),
  proposal(
    "signed_won_ott",
    tableSigned("won", "OTT"),
    { fm: FM, mil: MIL },
    [v("capital", tookCapital("OTT", 24)), v("base")],
    [
      o("swo_house", [inst("commons", 1), inst("opposition", -1)]),
      o("swo_india", [opinion("army", 1), gauge("money", -1)]),
      o("swo_quiet", [inst("cabinet", 1), opinion("press", -1)]),
    ],
  ),
  wire(
    "signed_won_deu",
    tableSigned("won", "DEU"),
    { fm: FM, adm: ADM },
    [v("base")],
    8,
  ),
  proposal(
    "signed_lost",
    tableSigned("lost"),
    { fm: FM, mil: MIL },
    [
      v("deu", tableSigned("lost", "DEU")),
      v("ott", tableSigned("lost", "OTT")),
      v("base"),
    ],
    [
      o("sl_own", [inst("commons", 1), inst("cabinet", -1)]),
      o("sl_generals", [opinion("army", -1), opinion("press", 1)]),
      o("sl_few", [inst("opposition", 1), gauge("morale", -1)]),
    ],
    8,
  ),
  wire("signed_even", tableSigned("even"), { fm: FM }, [
    v("deu", tableSigned("even", "DEU")),
    v("ott", tableSigned("even", "OTT")),
    v("base"),
  ]),
];

export const GBR_LAND_EVENTS: readonly GwScene[] = [
  ...OURS,
  ...THEIRS,
  ...OUT,
  ...TABLE,
];
