// Great War 1914 (ww171 phase 4): RUS's state-event scenes for war between
// any pair: a war with a country begins, a front opens, a neutral comes in,
// a peace of two. Owned by the RUS writer lane; shapes and conditions in
// /home/eser/dev/ww171-format4.md, conditions from ./war_events. Text in
// resources/ww1914/ko/RUS.wars.json.
import type {
  GwSide,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwPlace } from "@openfront/engine-api/ww1914/GwPlaces";
import type {
  GwCastRule,
  GwCond,
  GwEffect,
  GwOption,
  GwScene,
  GwVariant,
} from "@openfront/engine-api/ww1914/SceneDsl";
import {
  all,
  any,
  inst_,
  not,
  reason,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";
import {
  declaredBy,
  fellOut,
  frontOpened,
  joined,
  offered,
  ownWarWith,
  peaceMade,
  peaceWith,
  warBetween,
  warWith,
} from "./war_events";

// ---- Conditions ----

/** The seat's country stands on this side. */
const ourSide = (s: GwSide): GwCond => world({ is: "side", of: [s] });
/** At war with `tag` now, however long. */
const atWar = (tag: GwTag): GwCond => world({ is: "pair_war", with: tag });
/** Our war with `tag` came this way. */
const cause = (tag: GwTag, ...c: string[]): GwCond =>
  world({ is: "pair_war", with: tag, cause: c });
/** We sent `tag` the note that ended in this war. */
const weSent = (tag: GwTag): GwCond =>
  all(
    cause(tag, "ladder"),
    world({ is: "ladder", role: "from", tag, of: ["war"] }),
  );
/** `tag` sent us the note that ended in this war. */
const theySent = (tag: GwTag): GwCond =>
  all(
    cause(tag, "ladder"),
    world({ is: "ladder", role: "to", tag, of: ["war"] }),
  );
/** `tag` fights on our side. */
const withUs = (tag: GwTag): GwCond =>
  any(
    all(ourSide("entente"), world({ is: "entered", tag, side: "entente" })),
    all(ourSide("central"), world({ is: "entered", tag, side: "central" })),
  );
/** `tag` fights on the other side. */
const againstUs = (tag: GwTag): GwCond =>
  any(
    all(ourSide("entente"), world({ is: "entered", tag, side: "central" })),
    all(ourSide("central"), world({ is: "entered", tag, side: "entente" })),
  );
const isOut = (tag: GwTag): GwCond => world({ is: "out", tag });
/** The war of `a` and `b` ended as `b` fell out of it, not in a peace. */
const felled = (a: GwTag, b: GwTag): GwCond => all(fellOut(a, b), isOut(b));
const open = (theatre: GwTheatre): GwCond => world({ is: "open", theatre });

// ---- Effects ----

const gauge = (
  g: "shells" | "bread" | "money" | "morale" | "order",
  delta: number,
): GwEffect => ({ kind: "gauge", gauge: g, delta });
const trust = (tag: GwTag, delta: number): GwEffect => ({
  kind: "trust",
  tag,
  delta,
});
const opinion = (
  bloc: "army" | "court" | "parliament" | "business" | "workers" | "press",
  delta: number,
): GwEffect => ({ kind: "opinion", bloc, delta });

// ---- Shapes ----

const v = (id: string, when?: GwCond): GwVariant =>
  when === undefined ? { id } : { id, when };
/** ww187: a body that marches on `place`: the enemy holds it now. */
const held = (x: GwVariant, place: GwPlace): GwVariant => ({
  ...x,
  assumes: { ...x.assumes, held: { [place]: "foe" } },
});
const opt = (id: string, effects: GwEffect[], when?: GwCond): GwOption =>
  when === undefined
    ? { id, tell: [], effects }
    : { id, when, tell: [], effects };

const FOREIGN: Record<string, GwCastRule> = { foreign: { office: "foreign" } };
const COS: Record<string, GwCastRule> = {
  cos: { office: "chief_of_staff" },
};
const WAR: Record<string, GwCastRule> = { war: { office: "war" } };
const NAVY: Record<string, GwCastRule> = { navy: { office: "navy" } };
const PM: Record<string, GwCastRule> = { pm: { office: "chancellor" } };

function wire(
  id: string,
  salience: number,
  when: GwCond,
  cast: Record<string, GwCastRule>,
  variants: GwVariant[],
): GwScene {
  return {
    id,
    nation: ["RUS"],
    kind: "wire",
    once: true,
    salience,
    tags: ["foreign", "war"],
    cast,
    when,
    variants,
  };
}

function proposal(
  id: string,
  salience: number,
  when: GwCond,
  cast: Record<string, GwCastRule>,
  variants: GwVariant[],
  options: GwOption[],
): GwScene {
  return {
    id,
    nation: ["RUS"],
    kind: "proposal",
    once: true,
    salience,
    tags: ["foreign", "war"],
    cast,
    when,
    variants,
    fallback: options[options.length - 1].id,
    options,
  };
}

// ---- War begins ----

const WAR_BEGINS: GwScene[] = [
  wire("rus_wv_war_deu", 8, warWith("DEU"), COS, [
    v("alone", ownWarWith("DEU")),
    v("we_sent", weSent("DEU")),
    v("they_sent", theySent("DEU")),
    v("treaty", cause("DEU", "treaty")),
    v("entered", cause("DEU", "entered")),
    v("we_declared", all(cause("DEU", "declared"), declaredBy("RUS", "DEU"))),
    v("they_declared", all(cause("DEU", "declared"), declaredBy("DEU", "RUS"))),
    v("declared", cause("DEU", "declared")),
    v("base"),
  ]),
  proposal(
    "rus_wv_war_deu_capital",
    7,
    warWith("DEU", 1),
    PM,
    [v("they_sent", theySent("DEU")), v("base")],
    [
      opt("rename", [
        opinion("press", 1),
        opinion("court", -1),
        reason("rus_wv_capital_renamed"),
      ]),
      opt("keep", [opinion("court", 1), reason("rus_wv_capital_kept")]),
    ],
  ),
  wire("rus_wv_war_auh", 8, warWith("AUH"), FOREIGN, [
    v("alone", ownWarWith("AUH")),
    // ww187: "a day by rail to Lemberg": Lemberg still Austrian.
    held(v("we_sent", weSent("AUH")), "lemberg"),
    v("they_sent", theySent("AUH")),
    v("treaty", cause("AUH", "treaty")),
    v("july", cause("AUH", "july")),
    v("entered", cause("AUH", "entered")),
    v("base"),
  ]),
  proposal(
    "rus_wv_war_auh_galicia",
    7,
    warWith("AUH", 1),
    FOREIGN,
    [v("both", atWar("DEU")), v("base")],
    [
      opt("poles", [
        inst_("duma", 1),
        opinion("court", -1),
        reason("rus_wv_galicia_poles"),
      ]),
      opt("rusyns", [
        opinion("court", 1),
        opinion("press", 1),
        reason("rus_wv_galicia_rusyns"),
      ]),
      opt("silent", [inst_("ministers", 1), reason("rus_wv_galicia_silent")]),
    ],
  ),
  wire("rus_wv_war_ott", 8, all(warWith("OTT"), not(ownWarWith("OTT"))), NAVY, [
    v("we_sent", weSent("OTT")),
    v("they_sent", theySent("OTT")),
    v("entered", cause("OTT", "entered")),
    v("base"),
  ]),
  proposal(
    "rus_wv_war_ott_straits",
    8,
    warWith("OTT", 1),
    FOREIGN,
    [v("allies_there", warBetween("GBR", "OTT", 6)), v("base")],
    [
      opt("say_it", [
        opinion("press", 1),
        opinion("parliament", 1),
        trust("GBR", -1),
        reason("rus_wv_straits_said"),
      ]),
      opt("passage", [trust("GBR", 1), reason("rus_wv_straits_passage")]),
      opt("drawer", [reason("rus_wv_straits_drawer")]),
    ],
  ),
  {
    ...proposal(
      "rus_wv_own_ott",
      7,
      ownWarWith("OTT"),
      COS,
      [v("we_sent", weSent("OTT")), v("they_sent", theySent("OTT")), v("base")],
      [
        opt("erzurum", [
          inst_("stavka", 1),
          gauge("shells", -1),
          reason("rus_wv_own_ott_erzurum"),
        ]),
        opt("armenians", [
          opinion("press", 1),
          inst_("ministers", -1),
          reason("rus_wv_own_ott_armenians"),
        ]),
        opt("border", [inst_("ministers", 1), reason("rus_wv_own_ott_border")]),
      ],
    ),
    // ww187: the lines "as far as Erzurum": Erzurum still Turkish.
    assumes: { held: { erzurum: "foe" } },
  },
  wire(
    "rus_wv_war_bgr",
    7,
    all(warWith("BGR"), not(ownWarWith("BGR"))),
    FOREIGN,
    [
      v("they_sent", theySent("BGR")),
      v("entered", cause("BGR", "entered")),
      v("base"),
    ],
  ),
  proposal(
    "rus_wv_own_bgr",
    7,
    ownWarWith("BGR"),
    FOREIGN,
    [v("we_sent", weSent("BGR")), v("base")],
    [
      opt("appeal", [opinion("press", 1), reason("rus_wv_own_bgr_appeal")]),
      opt("romania", [trust("ROU", 1), reason("rus_wv_own_bgr_romania")]),
      opt("hard", [
        inst_("stavka", 1),
        opinion("press", -1),
        reason("rus_wv_own_bgr_hard"),
      ]),
    ],
  ),
  wire("rus_wv_war_irn", 6, all(warWith("IRN"), not(ownWarWith("IRN"))), WAR, [
    v("entered", cause("IRN", "entered")),
    v("base"),
  ]),
  proposal(
    "rus_wv_own_irn",
    6,
    ownWarWith("IRN"),
    WAR,
    [v("we_sent", weSent("IRN")), v("base")],
    [
      opt("tehran", [
        inst_("stavka", 1),
        trust("GBR", -1),
        reason("rus_wv_own_irn_tehran"),
      ]),
      opt("london", [trust("GBR", 1), reason("rus_wv_own_irn_london")]),
    ],
  ),
  proposal(
    "rus_wv_between_auh_srb",
    8,
    all(
      warBetween("AUH", "SRB"),
      not(world({ is: "pair_war", tag: "AUH", with: "SRB", cause: ["july"] })),
      not(atWar("AUH")),
    ),
    FOREIGN,
    [
      v(
        "vienna_note",
        world({ is: "pair_war", tag: "AUH", with: "SRB", cause: ["ladder"] }),
      ),
      v("base"),
    ],
    [
      opt("arms", [
        trust("SRB", 1),
        gauge("money", -1),
        reason("rus_wv_srb_arms"),
      ]),
      opt("note", [
        trust("SRB", 1),
        opinion("press", 1),
        reason("rus_wv_srb_note"),
      ]),
      opt("yield", [
        trust("SRB", -1),
        opinion("press", -1),
        reason("rus_wv_srb_yield"),
      ]),
    ],
  ),
  wire("rus_wv_between_rou_auh", 7, warBetween("ROU", "AUH"), FOREIGN, [
    v("ours", atWar("AUH")),
    v("base"),
  ]),
  wire("rus_wv_between_bgr_rou", 7, warBetween("BGR", "ROU"), FOREIGN, [
    v("ours", atWar("BGR")),
    v("base"),
  ]),
];

// ---- A front opens ----

const FRONTS: GwScene[] = [
  wire("rus_wv_front_east", 7, frontOpened("east"), COS, [
    held(v("auh_only", all(atWar("AUH"), not(atWar("DEU")))), "lemberg"),
    v("deu_only", all(atWar("DEU"), not(atWar("AUH")))),
    v("base"),
  ]),
  proposal(
    "rus_wv_front_caucasus",
    7,
    frontOpened("caucasus"),
    COS,
    [held(v("east_too", open("east")), "erzurum"), v("base")],
    [
      opt("strike", [
        inst_("stavka", 1),
        gauge("shells", -1),
        reason("rus_wv_cau_strike"),
      ]),
      opt("volunteers", [opinion("press", 1), reason("rus_wv_cau_volunteers")]),
      opt("hold", [inst_("ministers", 1), reason("rus_wv_cau_hold")]),
    ],
  ),
  wire("rus_wv_front_dobruja", 7, frontOpened("dobruja"), NAVY, [
    v("with_rou", withUs("ROU")),
    v("base"),
  ]),
  proposal(
    "rus_wv_front_persia",
    6,
    frontOpened("persia"),
    WAR,
    [v("british", warBetween("GBR", "OTT", 12)), v("base")],
    [
      opt("corps", [
        inst_("stavka", -1),
        gauge("shells", -1),
        reason("rus_wv_persia_corps"),
      ]),
      opt("british", [trust("GBR", 1), reason("rus_wv_persia_british")]),
      opt("cossacks", [reason("rus_wv_persia_cossacks")]),
    ],
  ),
  wire("rus_wv_front_danube", 6, frontOpened("danube"), FOREIGN, [
    v("with_rou", withUs("ROU")),
    v("base"),
  ]),
  proposal(
    "rus_wv_front_thrace",
    6,
    frontOpened("thrace"),
    FOREIGN,
    [held(v("ours", atWar("OTT")), "constantinople"), v("base")],
    [
      opt("warn", [
        trust("BGR", -1),
        trust("GRC", -1),
        opinion("press", 1),
        reason("rus_wv_thrace_warn"),
      ]),
      opt("wait", [reason("rus_wv_thrace_wait")]),
    ],
  ),
  // ww187: "a front at the Dardanelles": the line where a new front starts.
  {
    ...wire("rus_wv_front_straits", 7, frontOpened("straits"), FOREIGN, [
      v("ours", atWar("OTT")),
      v("base"),
    ]),
    assumes: { line: { straits: ["dardanelles", "gallipoli"] } },
  },
  wire("rus_wv_front_balkan", 6, frontOpened("balkan"), FOREIGN, [
    v("bulgars", warBetween("BGR", "SRB")),
    v("base"),
  ]),
];

// ---- A neutral comes in ----

const JOINS: GwScene[] = [
  wire("rus_wv_join_ita", 7, joined("ITA"), FOREIGN, [
    v("with_us", withUs("ITA")),
    v("against", againstUs("ITA")),
    v("base"),
  ]),
  wire("rus_wv_join_ott", 7, all(joined("OTT"), not(atWar("OTT"))), NAVY, [
    v("with_us", withUs("OTT")),
    v("base"),
  ]),
  wire("rus_wv_join_bgr", 7, all(joined("BGR"), not(atWar("BGR"))), FOREIGN, [
    v("with_us", withUs("BGR")),
    v("base"),
  ]),
  wire("rus_wv_join_rou", 7, joined("ROU"), COS, [
    v("with_us", withUs("ROU")),
    v("against", againstUs("ROU")),
    v("base"),
  ]),
  proposal(
    "rus_wv_join_rou_claims",
    7,
    all(joined("ROU"), withUs("ROU")),
    FOREIGN,
    [v("base")],
    [
      opt("sign", [
        trust("ROU", 1),
        opinion("court", -1),
        reason("rus_wv_rou_signed"),
      ]),
      opt("haggle", [
        trust("ROU", -1),
        opinion("court", 1),
        reason("rus_wv_rou_haggled"),
      ]),
      opt("allies", [trust("FRA", 1), reason("rus_wv_rou_allies")]),
    ],
  ),
  wire("rus_wv_join_grc", 6, joined("GRC"), FOREIGN, [
    v("with_us", withUs("GRC")),
    v("against", againstUs("GRC")),
    v("base"),
  ]),
  wire("rus_wv_join_usa", 7, joined("USA"), FOREIGN, [
    v("with_us", withUs("USA")),
    v("against", againstUs("USA")),
    v("base"),
  ]),
  wire("rus_wv_join_jpn", 7, joined("JPN"), WAR, [
    v("with_us", withUs("JPN")),
    v("against", againstUs("JPN")),
    v("base"),
  ]),
  wire("rus_wv_join_nld", 6, joined("NLD"), FOREIGN, [
    v("with_us", withUs("NLD")),
    v("against", againstUs("NLD")),
    v("base"),
  ]),
  wire("rus_wv_join_bel", 6, joined("BEL"), PM, [
    v("with_us", withUs("BEL")),
    v("against", againstUs("BEL")),
    v("base"),
  ]),
];

// ---- A peace of two ----

const PEACES: GwScene[] = [
  wire("rus_wv_peace_deu", 8, peaceWith("DEU"), FOREIGN, [
    v("we_out", felled("DEU", "RUS")),
    v("they_out", felled("RUS", "DEU")),
    v("armistice", world({ is: "armistice" })),
    v("still_war", all(peaceMade("RUS", "DEU"), world({ is: "war" }))),
    v("base"),
  ]),
  wire("rus_wv_peace_auh", 7, peaceWith("AUH"), FOREIGN, [
    v("they_out", felled("RUS", "AUH")),
    v("armistice", world({ is: "armistice" })),
    v("deu_on", all(peaceMade("RUS", "AUH"), atWar("DEU"))),
    v("base"),
  ]),
  proposal(
    "rus_wv_peace_ott",
    7,
    peaceWith("OTT"),
    COS,
    [v("they_out", felled("RUS", "OTT")), v("base")],
    [
      opt(
        "west",
        [inst_("stavka", 1), gauge("morale", -1), reason("rus_wv_ott_west")],
        world({ is: "war" }),
      ),
      opt("home", [
        gauge("order", 1),
        opinion("workers", 1),
        reason("rus_wv_ott_home"),
      ]),
    ],
  ),
  wire("rus_wv_peace_bgr", 7, peaceWith("BGR"), FOREIGN, [
    v("they_out", felled("RUS", "BGR")),
    v("base"),
  ]),
  wire("rus_wv_peace_irn", 6, peaceWith("IRN"), WAR, [
    v("ott_on", all(peaceMade("RUS", "IRN"), atWar("OTT"))),
    v("base"),
  ]),
  wire(
    "rus_wv_peace_srb_auh",
    7,
    any(peaceMade("SRB", "AUH"), felled("AUH", "SRB")),
    FOREIGN,
    [v("srb_out", felled("AUH", "SRB")), v("ours", atWar("AUH")), v("base")],
  ),
  wire(
    "rus_wv_peace_rou",
    7,
    any(
      peaceMade("ROU", "DEU"),
      peaceMade("ROU", "AUH"),
      felled("DEU", "ROU"),
      felled("AUH", "ROU"),
    ),
    COS,
    [v("rou_out", isOut("ROU")), v("base")],
  ),
  proposal(
    "rus_wv_peace_offer_deu",
    8,
    offered("DEU"),
    FOREIGN,
    [v("allied", ourSide("entente")), v("base")],
    [
      opt("tell_allies", [
        trust("FRA", 1),
        trust("GBR", 1),
        opinion("court", -1),
        reason("rus_wv_offer_told"),
      ]),
      opt("duma", [
        inst_("duma", 1),
        inst_("court", -1),
        reason("rus_wv_offer_duma"),
      ]),
      opt("quiet", [inst_("court", 1), reason("rus_wv_offer_quiet")]),
    ],
  ),
  wire("rus_wv_peace_offer", 7, all(offered(), not(offered("DEU"))), FOREIGN, [
    v("auh", offered("AUH")),
    v("ott", offered("OTT")),
    v("bgr", offered("BGR")),
    v("irn", offered("IRN")),
    v("base"),
  ]),
];

export const RUS_WAR_EVENTS: readonly GwScene[] = [
  ...WAR_BEGINS,
  ...FRONTS,
  ...JOINS,
  ...PEACES,
];
