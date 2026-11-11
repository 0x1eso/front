// Great War 1914 (ww171 phase 4): FRA's state-event scenes for war between
// any pair: a war with a country begins, a front opens, a neutral comes in,
// a peace of two. Owned by the FRA writer lane; shapes and conditions in
// /home/eser/dev/ww171-format4.md, conditions from ./war_events. Text in
// resources/ww1914/ko/FRA.wars.json.
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
  flag,
  memory,
  not,
  reason,
  type GwCond,
  type GwEffect,
  type GwScene,
  type GwVariant,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";
import {
  frontOpened,
  joined,
  offered,
  ownWarWith,
  peaceBetween,
  peaceWith,
  warBetween,
  warWith,
} from "./war_events";

/**
 * Poincaré's desk when France's wars change: who it fights, where, who came
 * in, who made peace. The state calls every card; a variant reads how the war
 * came and who stands where. No option shows its result before the pick, and
 * each leaves a record line (`reasons` in the pack) for after it.
 */

// ---- Conditions ----

/** France is at war with `tag`, however long. */
const fighting = (tag: GwTag): GwCond => world({ is: "pair_war", with: tag });
/** France's war with `tag` came one of these ways. */
const cameBy = (tag: GwTag, ...cause: string[]): GwCond =>
  world({ is: "pair_war", with: tag, cause });
/** Two others are at war, however long. */
const between = (a: GwTag, b: GwTag): GwCond =>
  world({ is: "pair_war", tag: a, with: b });
const sideIs = (side: GwSide): GwCond => world({ is: "side", of: [side] });
const entered = (tag: GwTag, side: GwSide): GwCond =>
  world({ is: "entered", tag, side });
/** `tag` fights on France's side of the coalition war. */
const withUs = (tag: GwTag): GwCond =>
  any(
    all(sideIs("entente"), entered(tag, "entente")),
    all(sideIs("central"), entered(tag, "central")),
  );
/** `tag` fights on the other side of the coalition war. */
const againstUs = (tag: GwTag): GwCond =>
  any(
    all(sideIs("entente"), entered(tag, "central")),
    all(sideIs("central"), entered(tag, "entente")),
  );
/** A war France fights in its coalition, not one of the two's own. */
const coalitionWar = (tag: GwTag): GwCond =>
  all(warWith(tag), not(ownWarWith(tag)));
/** A neutral came in, and not against France (that is a war-begins card). */
const cameIn = (tag: GwTag): GwCond => all(joined(tag), not(fighting(tag)));
const belgiumHit = between("DEU", "BEL");
const britainIn = entered("GBR", "entente");
const armistice = world({ is: "armistice" });
const russiaChanged = world({
  is: "regime",
  tag: "RUS",
  of: ["provisional", "rep", "soviet"],
});

// ---- Effects ----

const inst = (i: GwInstitution, delta: number): GwEffect => ({
  kind: "inst",
  inst: i,
  delta,
});
const gauge = (g: GwGauge, delta: number): GwEffect => ({
  kind: "gauge",
  gauge: g,
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

// ---- Shapes ----

type Option = NonNullable<GwScene["options"]>[number];

const v = (id: string, when?: GwCond): GwVariant =>
  when === undefined ? { id } : { id, when };

/** An option whose record line is `<scene>_<option>`. */
const o = (scene: string, id: string, effects: GwEffect[]): Option => ({
  id,
  tell: [],
  effects: [...effects, reason(`${scene}_${id}`)],
});

const wire = (
  id: string,
  when: GwCond,
  variants: GwVariant[],
  cast: GwScene["cast"] = {},
  salience = 6,
): GwScene => ({
  id,
  nation: ["FRA"],
  kind: "wire",
  once: true,
  salience,
  tags: ["foreign", "war"],
  cast,
  when,
  variants,
});

/** A paper to sign; a timer takes the last option. */
const proposal = (
  id: string,
  when: GwCond,
  variants: GwVariant[],
  options: [string, GwEffect[]][],
  cast: GwScene["cast"] = {},
  salience = 7,
): GwScene => ({
  id,
  nation: ["FRA"],
  kind: "proposal",
  once: true,
  salience,
  tags: ["foreign", "war"],
  cast,
  when,
  variants,
  options: options.map(([oid, fx]) => o(id, oid, fx)),
  fallback: options[options.length - 1][0],
});

const pm = { office: "chancellor" } as const;
const fm = { office: "foreign" } as const;
const cos = { office: "chief_of_staff" } as const;
const war = { office: "war" } as const;
const navy = { office: "navy" } as const;

// ---- A war begins ----

const WAR_BEGINS: GwScene[] = [
  proposal(
    "fra_wv_war_deu",
    coalitionWar("DEU"),
    [
      v("belgium", belgiumHit),
      v("ladder", cameBy("DEU", "ladder")),
      v("declared", cameBy("DEU", "declared")),
      v("base"),
    ],
    [
      ["union", [inst("chamber", 1), opinion("workers", 1)]],
      ["blame", [gauge("morale", 1), opinion("workers", -1)]],
      ["brief", [inst("countersign", 1)]],
    ],
    { pm },
    8,
  ),
  wire(
    "fra_wv_war_deu_note",
    warWith("DEU"),
    [v("alone", ownWarWith("DEU")), v("belgium", belgiumHit), v("base")],
    {},
    7,
  ),
  proposal(
    "fra_wv_war_deu_own",
    ownWarWith("DEU"),
    [
      v("ladder", cameBy("DEU", "ladder")),
      v("declared", cameBy("DEU", "declared")),
      v("base"),
    ],
    [
      ["petersburg", [trust("RUS", -1), opinion("press", 1)]],
      ["london", [trust("GBR", 1)]],
      [
        "alone",
        [gauge("morale", 1), inst("chamber", 1), opinion("business", -1)],
      ],
    ],
    { fm },
    8,
  ),
  proposal(
    "fra_wv_war_auh",
    coalitionWar("AUH"),
    [
      v("entered", cameBy("AUH", "entered", "treaty")),
      v("ladder", cameBy("AUH", "ladder", "declared")),
      v("base"),
    ],
    [
      ["otranto", [trust("SRB", 1), trust("ITA", 1)]],
      ["convoys", [inst("army", 1)]],
    ],
    { navy },
  ),
  proposal(
    "fra_wv_war_auh_own",
    ownWarWith("AUH"),
    [v("ladder", cameBy("AUH", "ladder")), v("base")],
    [
      ["berlin", [trust("DEU", 1), opinion("press", -1)]],
      ["salonika", [trust("SRB", 1), gauge("money", -1)]],
      ["sea", [inst("chamber", 1)]],
    ],
    { fm },
    8,
  ),
  proposal(
    "fra_wv_war_ita",
    coalitionWar("ITA"),
    [
      v("entered", cameBy("ITA", "entered", "treaty")),
      v("ladder", cameBy("ITA", "ladder", "declared")),
      v("base"),
    ],
    [
      ["alps", [inst("army", 1)]],
      ["tunisia", [gauge("money", -1), opinion("press", 1)]],
      ["giolitti", [trust("ITA", 1), opinion("press", -1)]],
    ],
    { fm },
    8,
  ),
  proposal(
    "fra_wv_war_ita_own",
    ownWarWith("ITA"),
    [
      v("ladder", cameBy("ITA", "ladder")),
      v("declared", cameBy("ITA", "declared")),
      v("base"),
    ],
    [
      ["london", [trust("GBR", 1)]],
      ["coast", [gauge("morale", 1), trust("ITA", -1)]],
      ["bern", [inst("chamber", 1), opinion("workers", 1)]],
    ],
    { fm },
    8,
  ),
  proposal(
    "fra_wv_war_ott",
    coalitionWar("OTT"),
    [
      v("entered", cameBy("OTT", "entered", "treaty")),
      v("ladder", cameBy("OTT", "ladder", "declared")),
      v("base"),
    ],
    [
      ["syria", [opinion("parliament", 1), trust("GBR", -1)]],
      ["straits", [trust("GBR", 1), inst("army", -1)]],
      ["quiet", [inst("countersign", 1)]],
    ],
    { fm },
  ),
  proposal(
    "fra_wv_war_ott_own",
    ownWarWith("OTT"),
    [v("ladder", cameBy("OTT", "ladder", "declared")), v("base")],
    [
      ["blockade", [gauge("morale", 1), trust("OTT", -1)]],
      ["london", [trust("GBR", 1)]],
      ["debt", [opinion("business", 1)]],
    ],
    { navy },
    8,
  ),
  wire("fra_wv_war_bgr", coalitionWar("BGR"), [
    v("entered", cameBy("BGR", "entered", "treaty")),
    v("base"),
  ]),
  wire("fra_wv_war_bgr_own", ownWarWith("BGR"), [
    v("ladder", cameBy("BGR", "ladder")),
    v("base"),
  ]),
  proposal(
    "fra_wv_war_pair_deu_rus",
    all(warBetween("DEU", "RUS"), not(fighting("DEU"))),
    [v("changed", russiaChanged), v("base")],
    [
      ["march", [trust("RUS", 1), opinion("workers", -1)]],
      ["time", [trust("RUS", -1), inst("chamber", 1)]],
      ["mediate", [trust("GBR", 1), trust("RUS", -1)]],
    ],
    { fm },
    8,
  ),
  wire(
    "fra_wv_war_pair_auh_srb",
    all(warBetween("AUH", "SRB"), not(fighting("AUH"))),
    [v("russia", between("RUS", "AUH")), v("base")],
  ),
  proposal(
    "fra_wv_war_pair_deu_bel",
    all(warBetween("DEU", "BEL"), not(fighting("DEU"))),
    [v("britain", between("GBR", "DEU")), v("base")],
    [
      ["border", [inst("army", 1), opinion("press", 1)]],
      ["london", [trust("GBR", 1)]],
      ["protest", [inst("chamber", 1), trust("BEL", -1)]],
    ],
    { pm },
    8,
  ),
];

// ---- A front opens ----

const FRONTS: GwScene[] = [
  proposal(
    "fra_wv_front_west",
    frontOpened("west"),
    [v("belgium", belgiumHit), v("britain", britainIn), v("base")],
    [
      ["attack", [inst("army", 1), gauge("morale", 1)]],
      ["wait", [inst("army", -1), gauge("shells", 1)]],
    ],
    { cos },
  ),
  proposal(
    "fra_wv_front_alps",
    frontOpened("alps"),
    [v("own", ownWarWith("ITA")), v("both", fighting("AUH")), v("base")],
    [
      ["hold", [inst("army", 1)]],
      ["north", [inst("army", -1), gauge("morale", 1)]],
    ],
    { war },
  ),
  proposal(
    "fra_wv_front_balkan",
    frontOpened("balkan"),
    [v("greece", withUs("GRC")), v("bulgaria", againstUs("BGR")), v("base")],
    [
      ["division", [trust("SRB", 1), inst("army", -1)]],
      ["britain", [trust("GBR", -1), inst("army", 1)]],
      ["money", [gauge("money", -1), trust("SRB", 1)]],
    ],
    { war },
  ),
  proposal(
    "fra_wv_front_straits",
    frontOpened("straits"),
    [v("britain", britainIn), v("base")],
    [
      ["ships", [trust("GBR", 1)]],
      ["troops", [trust("GBR", 1), inst("army", -1)]],
      ["few", [inst("army", 1), trust("GBR", -1)]],
    ],
    { navy },
  ),
  wire("fra_wv_front_colonies", frontOpened("colonies"), [
    v("japan", withUs("JPN")),
    v("britain", britainIn),
    v("base"),
  ]),
  wire("fra_wv_front_italy", frontOpened("italy"), [
    v("ally", withUs("ITA")),
    v("base"),
  ]),
  wire("fra_wv_front_low_countries", frontOpened("low_countries"), [
    v("ally", withUs("NLD")),
    v("base"),
  ]),
  wire("fra_wv_front_danube", frontOpened("danube"), [
    v("ally", withUs("ROU")),
    v("base"),
  ]),
];

// ---- A neutral comes in ----

const JOINS: GwScene[] = [
  proposal(
    "fra_wv_join_ita",
    cameIn("ITA"),
    [
      v("price", all(withUs("ITA"), memory("m_italy_price"))),
      v("ally", withUs("ITA")),
      v("base"),
    ],
    [
      ["thank", [trust("ITA", 1)]],
      ["alps_north", [inst("army", 1)]],
    ],
    { fm },
    8,
  ),
  wire("fra_wv_join_ott", cameIn("OTT"), [v("ally", withUs("OTT")), v("base")]),
  wire("fra_wv_join_bgr", cameIn("BGR"), [v("ally", withUs("BGR")), v("base")]),
  proposal(
    "fra_wv_join_rou",
    all(joined("ROU"), withUs("ROU")),
    [v("bulgaria", againstUs("BGR")), v("base")],
    [
      ["mission", [trust("ROU", 1), inst("army", -1)]],
      ["shells", [trust("ROU", 1), gauge("shells", -1)]],
      ["words", [inst("army", 1)]],
    ],
    { war },
  ),
  proposal(
    "fra_wv_join_grc",
    all(joined("GRC"), withUs("GRC")),
    [v("bulgaria", againstUs("BGR")), v("base")],
    [
      ["venizelos", [trust("GRC", 1), opinion("court", -1)]],
      ["fleet", [gauge("morale", 1), trust("GRC", -1)]],
      ["wait", [inst("countersign", 1)]],
    ],
    { fm },
  ),
  proposal(
    "fra_wv_join_usa",
    all(joined("USA"), withUs("USA")),
    [v("changed", russiaChanged), v("base")],
    [
      ["men", [inst("army", 1), trust("USA", -1)]],
      ["money", [gauge("money", 1), opinion("business", 1)]],
      ["welcome", [gauge("morale", 1), trust("USA", 1)]],
    ],
    { amb: { office: "ambassador_washington" } },
    8,
  ),
  wire("fra_wv_join_jpn", joined("JPN"), [
    v("ally", withUs("JPN")),
    v("foe", againstUs("JPN")),
    v("base"),
  ]),
  wire("fra_wv_join_nld", joined("NLD"), [
    v("ally", withUs("NLD")),
    v("foe", againstUs("NLD")),
    v("base"),
  ]),
  wire("fra_wv_join_bel", joined("BEL"), [
    v("ally", withUs("BEL")),
    v("foe", againstUs("BEL")),
    v("base"),
  ]),
];

// ---- A peace of two ----

const PEACES: GwScene[] = [
  proposal(
    "fra_wv_peace_deu",
    peaceWith("DEU"),
    [v("armistice", armistice), v("pact", flag("f_london_pact")), v("base")],
    [
      ["chambers", [inst("chamber", 1), inst("senate", 1)]],
      ["provinces", [opinion("press", 1), opinion("workers", -1)]],
      ["quiet", [gauge("order", 1), opinion("court", -1)]],
    ],
    { pm },
    8,
  ),
  wire("fra_wv_peace_auh", peaceWith("AUH"), [
    v("germany", fighting("DEU")),
    v("base"),
  ]),
  proposal(
    "fra_wv_peace_ita",
    peaceWith("ITA"),
    [v("austria", fighting("AUH")), v("base")],
    [
      ["barrere", [trust("ITA", 1)]],
      ["garrison", [inst("army", 1), trust("ITA", -1)]],
    ],
    { fm },
  ),
  proposal(
    "fra_wv_peace_ott",
    peaceWith("OTT"),
    [v("britain", between("GBR", "OTT")), v("base")],
    [
      ["debt", [opinion("business", 1)]],
      ["schools", [opinion("court", 1), trust("OTT", 1)]],
    ],
    { fm },
  ),
  wire("fra_wv_peace_bgr", peaceWith("BGR"), [
    v("serbia", between("SRB", "BGR")),
    v("base"),
  ]),
  proposal(
    "fra_wv_peace_rus_deu",
    all(peaceBetween("RUS", "DEU"), fighting("DEU")),
    [v("changed", russiaChanged), v("base")],
    [
      ["protest", [trust("RUS", -1), opinion("press", 1)]],
      ["loans", [opinion("business", 1), trust("RUS", -1)]],
      ["calm", [gauge("order", 1), gauge("morale", -1)]],
    ],
    { fm },
    8,
  ),
  wire(
    "fra_wv_peace_gbr_deu",
    all(peaceBetween("GBR", "DEU"), fighting("DEU")),
    [v("pact", flag("f_london_pact")), v("base")],
    {},
    8,
  ),
  wire(
    "fra_wv_peace_offer_deu",
    offered("DEU"),
    [
      v("ahead", world({ is: "score", min: 20 })),
      v("behind", world({ is: "score", max: -20 })),
      v("base"),
    ],
    {},
    8,
  ),
  wire("fra_wv_peace_offer_any", all(offered(), not(offered("DEU"))), [
    v("austria", offered("AUH")),
    v("italy", offered("ITA")),
    v("turkey", offered("OTT")),
    v("base"),
  ]),
];

export const FRA_WAR_EVENTS: readonly GwScene[] = [
  ...WAR_BEGINS,
  ...FRONTS,
  ...JOINS,
  ...PEACES,
];
