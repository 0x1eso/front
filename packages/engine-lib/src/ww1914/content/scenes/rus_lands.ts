// Great War 1914 (ww172 phase 5): RUS's scenes of occupation and the
// bilateral tables: land taken or lost, a capital falling, a country knocked
// out, a table of two sitting or signed. Owned by the RUS writer lane;
// shapes and conditions in /home/eser/dev/ww172-format5.md, conditions from
// ./land_events. Text, and the memoir lines on the new endings, in
// resources/ww1914/ko/RUS.lands.json.
import type { GwSide } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
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
  capitalFell,
  knockedOut,
  lostCapital,
  lostLand,
  tableSigned,
  tableSits,
  tookCapital,
  tookLand,
} from "./land_events";

// ---- Conditions ----

/** The seat's country stands on this side. */
const ourSide = (s: GwSide): GwCond => world({ is: "side", of: [s] });
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
/** At war with `tag` now. */
const atWar = (tag: GwTag): GwCond => world({ is: "pair_war", with: tag });
/** A war of ours with `tag` ended (it fell, or a peace). */
const fought = (tag: GwTag): GwCond => world({ is: "pair_peace", with: tag });
/** We hold land of `tag`'s, however long. */
const holdOf = (tag: GwTag): GwCond => world({ is: "land_taken", from: tag });
/** `tag` holds land of ours, however long. */
const heldBy = (tag: GwTag): GwCond => world({ is: "land_lost", to: tag });
/** We took land of `from`'s between `min` and `max` months ago. */
const tookSince = (from: GwTag, min: number, max: number): GwCond =>
  world({ is: "land_taken", from, min, max });
/** `to` took land of ours between `min` and `max` months ago. */
const lostTo = (to: GwTag, min: number, max: number): GwCond =>
  world({ is: "land_lost", to, min, max });
/** Land of ours lost from one to `max` months ago (not this month). */
const lostSince = (max: number, capital?: boolean): GwCond =>
  capital === true
    ? world({ is: "land_lost", capital: true, min: 1, max })
    : world({ is: "land_lost", min: 1, max });

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
const opt = (id: string, effects: GwEffect[]): GwOption => ({
  id,
  tell: [],
  effects,
});

const FOREIGN: Record<string, GwCastRule> = { foreign: { office: "foreign" } };
const COS: Record<string, GwCastRule> = {
  cos: { office: "chief_of_staff" },
};
const WAR: Record<string, GwCastRule> = { war: { office: "war" } };
const NAVY: Record<string, GwCastRule> = { navy: { office: "navy" } };
const PM: Record<string, GwCastRule> = { pm: { office: "chancellor" } };
const INTERIOR: Record<string, GwCastRule> = {
  interior: { office: "interior" },
};
const COURT: Record<string, GwCastRule> = { court: { office: "court" } };

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

// ---- Occupation, ours ----

const OURS: GwScene[] = [
  proposal(
    "rus_ld_ours_galicia",
    8,
    tookLand("AUH", 1),
    WAR,
    [v("out", isOut("AUH")), v("base")],
    [
      opt("russian", [
        opinion("court", 1),
        opinion("press", 1),
        gauge("order", -1),
        reason("rus_ld_galicia_russian"),
      ]),
      opt("local", [
        inst_("duma", 1),
        opinion("court", -1),
        reason("rus_ld_galicia_local"),
      ]),
      opt("army", [
        inst_("stavka", 1),
        inst_("ministers", -1),
        reason("rus_ld_galicia_army"),
      ]),
    ],
  ),
  proposal(
    "rus_ld_ours_galicia_church",
    7,
    tookSince("AUH", 1, 4),
    INTERIOR,
    [v("out", isOut("AUH")), v("base")],
    [
      opt("arrest", [
        opinion("court", 1),
        opinion("press", -1),
        gauge("order", -1),
        reason("rus_ld_church_arrest"),
      ]),
      opt("mission", [
        opinion("court", 1),
        inst_("ministers", -1),
        reason("rus_ld_church_mission"),
      ]),
      opt("watch", [inst_("duma", 1), reason("rus_ld_church_watch")]),
    ],
  ),
  wire(
    "rus_ld_ours_carpathians",
    6,
    all(tookLand("AUH", 2), isOut("AUH")),
    COS,
    [v("romania", withUs("ROU")), v("base")],
  ),
  proposal(
    "rus_ld_ours_bukovina",
    7,
    all(tookSince("AUH", 2, 8), not(againstUs("ROU")), not(isOut("ROU"))),
    FOREIGN,
    [v("with", withUs("ROU")), v("base")],
    [
      opt("promise", [
        trust("ROU", 1),
        opinion("court", -1),
        reason("rus_ld_bukovina_promise"),
      ]),
      opt("ours", [
        opinion("press", 1),
        trust("ROU", -1),
        reason("rus_ld_bukovina_ours"),
      ]),
      opt("later", [inst_("ministers", 1), reason("rus_ld_bukovina_later")]),
    ],
  ),
  proposal(
    "rus_ld_ours_prussia",
    8,
    tookLand("DEU", 1),
    COS,
    [v("out", isOut("DEU")), v("base")],
    [
      opt("discipline", [
        trust("FRA", 1),
        trust("GBR", 1),
        opinion("army", -1),
        reason("rus_ld_prussia_discipline"),
      ]),
      opt("hostages", [
        inst_("stavka", 1),
        trust("GBR", -1),
        reason("rus_ld_prussia_hostages"),
      ]),
      opt("deport", [
        inst_("stavka", 1),
        opinion("press", -1),
        gauge("bread", -1),
        reason("rus_ld_prussia_deport"),
      ]),
    ],
  ),
  proposal(
    "rus_ld_ours_poles",
    7,
    tookSince("DEU", 2, 6),
    FOREIGN,
    [v("both", holdOf("AUH")), v("base")],
    [
      opt("unite", [
        inst_("duma", 1),
        opinion("court", -1),
        reason("rus_ld_poles_unite"),
      ]),
      opt("crown", [
        opinion("court", 1),
        inst_("duma", -1),
        reason("rus_ld_poles_crown"),
      ]),
      opt("silent", [inst_("ministers", 1), reason("rus_ld_poles_silent")]),
    ],
  ),
  proposal(
    "rus_ld_ours_armenia",
    8,
    tookLand("OTT", 1),
    WAR,
    [v("out", isOut("OTT")), v("base")],
    [
      opt("return", [
        opinion("press", 1),
        inst_("ministers", -1),
        reason("rus_ld_armenia_return"),
      ]),
      opt("military", [
        inst_("stavka", 1),
        opinion("press", -1),
        reason("rus_ld_armenia_military"),
      ]),
      opt("settle", [
        opinion("court", 1),
        gauge("money", -1),
        reason("rus_ld_armenia_settle"),
      ]),
    ],
  ),
  proposal(
    "rus_ld_ours_tsargrad",
    8,
    tookCapital("OTT", 1),
    FOREIGN,
    [v("out", isOut("OTT")), v("allies", withUs("GBR")), v("base")],
    [
      opt("cross", [
        opinion("court", 1),
        opinion("press", 1),
        trust("GBR", -1),
        reason("rus_ld_tsargrad_cross"),
      ]),
      opt("allies", [
        trust("GBR", 1),
        trust("FRA", 1),
        opinion("court", -1),
        reason("rus_ld_tsargrad_allies"),
      ]),
      opt("governor", [inst_("stavka", 1), reason("rus_ld_tsargrad_governor")]),
    ],
  ),
];

// ---- Occupation, theirs ----

const THEIRS: GwScene[] = [
  proposal(
    "rus_ld_theirs_poland",
    8,
    lostLand("DEU", 1),
    COS,
    [v("both", heldBy("AUH")), v("base")],
    [
      opt("scorch", [
        inst_("stavka", 1),
        gauge("bread", -1),
        gauge("order", -1),
        reason("rus_ld_poland_scorch"),
      ]),
      opt("factories", [
        gauge("shells", 1),
        gauge("money", -1),
        reason("rus_ld_poland_factories"),
      ]),
      opt("leave", [
        inst_("duma", 1),
        inst_("stavka", -1),
        reason("rus_ld_poland_leave"),
      ]),
    ],
  ),
  proposal(
    "rus_ld_theirs_refugees",
    7,
    all(lostSince(3), not(lostLand(undefined, 0))),
    COURT,
    [v("capital", lostCapital(6)), v("base")],
    [
      opt("tatiana", [
        opinion("court", 1),
        gauge("money", -1),
        reason("rus_ld_refugees_tatiana"),
      ]),
      opt("zemstvo", [
        inst_("duma", 1),
        opinion("court", -1),
        reason("rus_ld_refugees_zemstvo"),
      ]),
      opt("state", [
        inst_("ministers", 1),
        gauge("bread", -1),
        reason("rus_ld_refugees_state"),
      ]),
    ],
  ),
  proposal(
    "rus_ld_theirs_jews",
    7,
    lostTo("DEU", 1, 4),
    COS,
    [v("both", heldBy("AUH")), v("base")],
    [
      opt("expel", [
        inst_("stavka", 1),
        opinion("press", -1),
        trust("GBR", -1),
        gauge("order", -1),
        reason("rus_ld_jews_expel"),
      ]),
      opt("hostages", [
        inst_("stavka", 1),
        inst_("duma", -1),
        reason("rus_ld_jews_hostages"),
      ]),
      opt("refuse", [
        inst_("stavka", -1),
        inst_("duma", 1),
        reason("rus_ld_jews_refuse"),
      ]),
    ],
  ),
  proposal(
    "rus_ld_theirs_ukraine",
    7,
    lostLand("AUH", 1),
    INTERIOR,
    [v("both", heldBy("DEU")), v("base")],
    [
      opt("press", [
        inst_("duma", 1),
        opinion("court", -1),
        reason("rus_ld_ukraine_press"),
      ]),
      opt("arrest", [
        gauge("order", 1),
        opinion("press", -1),
        reason("rus_ld_ukraine_arrest"),
      ]),
      opt("ignore", [reason("rus_ld_ukraine_ignore")]),
    ],
  ),
  wire("rus_ld_theirs_kars", 7, lostLand("OTT", 1), WAR, [
    v("west", atWar("DEU")),
    v("base"),
  ]),
  proposal(
    "rus_ld_theirs_capital",
    8,
    lostCapital(0),
    PM,
    [v("deu", heldBy("DEU")), v("base")],
    [
      opt("moscow", [
        inst_("ministers", 1),
        gauge("morale", -1),
        reason("rus_ld_capital_moscow"),
      ]),
      opt("stavka", [
        inst_("stavka", 1),
        inst_("duma", -1),
        reason("rus_ld_capital_stavka"),
      ]),
      opt("kremlin", [
        gauge("morale", 1),
        opinion("court", 1),
        gauge("money", -1),
        reason("rus_ld_capital_kremlin"),
      ]),
    ],
  ),
  wire("rus_ld_theirs_capital_after", 7, lostSince(3, true), NAVY, [v("base")]),
  wire("rus_ld_theirs_belgrade", 6, capitalFell("AUH", "SRB", 1), FOREIGN, [
    v("at_war", atWar("AUH")),
    v("base"),
  ]),
  wire("rus_ld_theirs_bucharest", 6, capitalFell("AUH", "ROU", 1), COS, [
    v("ally", withUs("ROU")),
    v("base"),
  ]),
  proposal(
    "rus_ld_theirs_tsargrad_gbr",
    7,
    capitalFell("GBR", "OTT", 1),
    FOREIGN,
    [v("out", isOut("OTT")), v("base")],
    [
      opt("ask", [
        opinion("court", 1),
        trust("GBR", -1),
        reason("rus_ld_tsargrad_gbr_ask"),
      ]),
      opt("thank", [
        trust("GBR", 1),
        opinion("press", -1),
        reason("rus_ld_tsargrad_gbr_thank"),
      ]),
      opt("fleet", [
        opinion("press", 1),
        gauge("money", -1),
        reason("rus_ld_tsargrad_gbr_fleet"),
      ]),
    ],
  ),
];

// ---- Knocked out ----

const OUT: GwScene[] = [
  proposal(
    "rus_ld_out_srb",
    7,
    knockedOut("SRB", 1),
    FOREIGN,
    [v("friend", withUs("SRB")), v("base")],
    [
      opt("odessa", [
        opinion("press", 1),
        gauge("money", -1),
        reason("rus_ld_out_srb_odessa"),
      ]),
      opt("allies", [trust("FRA", 1), reason("rus_ld_out_srb_allies")]),
    ],
  ),
  proposal(
    "rus_ld_out_fra",
    8,
    knockedOut("FRA", 1),
    PM,
    [v("friend", withUs("FRA")), v("base")],
    [
      opt("hold", [
        inst_("stavka", 1),
        gauge("morale", -1),
        reason("rus_ld_out_fra_hold"),
      ]),
      opt("sound", [
        inst_("ministers", 1),
        trust("GBR", -1),
        reason("rus_ld_out_fra_sound"),
      ]),
      opt("london", [trust("GBR", 1), reason("rus_ld_out_fra_london")]),
    ],
  ),
  wire("rus_ld_out_rou", 7, knockedOut("ROU", 1), COS, [
    v("friend", withUs("ROU")),
    v("base"),
  ]),
  proposal(
    "rus_ld_out_auh",
    8,
    all(knockedOut("AUH", 1), any(fought("AUH"), againstUs("AUH"))),
    FOREIGN,
    [v("held", holdOf("AUH")), v("base")],
    [
      opt("czechs", [
        inst_("duma", 1),
        opinion("court", -1),
        reason("rus_ld_out_auh_czechs"),
      ]),
      opt("galicia", [
        opinion("court", 1),
        opinion("press", 1),
        trust("ROU", -1),
        reason("rus_ld_out_auh_galicia"),
      ]),
      opt("germany", [inst_("stavka", 1), reason("rus_ld_out_auh_germany")]),
    ],
  ),
  proposal(
    "rus_ld_out_ott",
    8,
    all(knockedOut("OTT", 1), any(fought("OTT"), againstUs("OTT"))),
    NAVY,
    [v("british", withUs("GBR")), v("base")],
    [
      opt("straits", [
        opinion("court", 1),
        trust("GBR", -1),
        reason("rus_ld_out_ott_straits"),
      ]),
      opt("grain", [
        gauge("money", 1),
        gauge("bread", -1),
        reason("rus_ld_out_ott_grain"),
      ]),
      opt("guns", [gauge("shells", 1), reason("rus_ld_out_ott_guns")]),
    ],
  ),
  wire(
    "rus_ld_out_bgr",
    6,
    all(knockedOut("BGR", 1), any(fought("BGR"), againstUs("BGR"))),
    FOREIGN,
    [v("foe", fought("BGR")), v("base")],
  ),
  proposal(
    "rus_ld_out_deu",
    8,
    all(knockedOut("DEU", 1), any(fought("DEU"), againstUs("DEU"))),
    PM,
    [v("held", holdOf("DEU")), v("base")],
    [
      opt("poland", [
        inst_("duma", 1),
        opinion("court", -1),
        reason("rus_ld_out_deu_poland"),
      ]),
      opt("home", [
        gauge("morale", 1),
        inst_("stavka", -1),
        reason("rus_ld_out_deu_home"),
      ]),
      opt("allies", [
        trust("GBR", 1),
        trust("FRA", 1),
        reason("rus_ld_out_deu_allies"),
      ]),
    ],
  ),
];

// ---- The bilateral table ----

const TABLE: GwScene[] = [
  proposal(
    "rus_ld_table_deu",
    8,
    tableSits("DEU"),
    FOREIGN,
    [v("ahead", holdOf("DEU")), v("behind", heldBy("DEU")), v("base")],
    [
      opt("minister", [
        inst_("ministers", 1),
        reason("rus_ld_table_deu_minister"),
      ]),
      opt("general", [
        inst_("stavka", 1),
        inst_("duma", -1),
        reason("rus_ld_table_deu_general"),
      ]),
      opt("duma", [
        inst_("duma", 1),
        opinion("court", -1),
        reason("rus_ld_table_deu_duma"),
      ]),
    ],
  ),
  proposal(
    "rus_ld_table_auh",
    8,
    tableSits("AUH"),
    FOREIGN,
    [v("ahead", holdOf("AUH")), v("behind", heldBy("AUH")), v("base")],
    [
      opt("rusyns", [
        opinion("court", 1),
        opinion("press", 1),
        inst_("duma", -1),
        reason("rus_ld_table_auh_rusyns"),
      ]),
      opt("poles", [
        inst_("duma", 1),
        opinion("court", -1),
        reason("rus_ld_table_auh_poles"),
      ]),
      opt("quiet", [inst_("ministers", 1), reason("rus_ld_table_auh_quiet")]),
    ],
  ),
  proposal(
    "rus_ld_table_ott",
    7,
    tableSits("OTT"),
    FOREIGN,
    [v("ahead", holdOf("OTT")), v("behind", heldBy("OTT")), v("base")],
    [
      opt("straits", [
        opinion("court", 1),
        trust("GBR", -1),
        reason("rus_ld_table_ott_straits"),
      ]),
      opt("armenians", [
        opinion("press", 1),
        inst_("ministers", -1),
        reason("rus_ld_table_ott_armenians"),
      ]),
      opt("grain", [
        gauge("money", 1),
        opinion("court", -1),
        reason("rus_ld_table_ott_grain"),
      ]),
    ],
  ),
  wire(
    "rus_ld_table_other",
    6,
    all(
      tableSits(),
      not(any(tableSits("DEU"), tableSits("AUH"), tableSits("OTT"))),
    ),
    FOREIGN,
    [v("bgr", tableSits("BGR")), v("irn", tableSits("IRN")), v("base")],
  ),
  wire("rus_ld_table_won", 7, tableSigned("won"), FOREIGN, [
    v("deu", tableSigned("won", "DEU")),
    v("auh", tableSigned("won", "AUH")),
    v("ott", tableSigned("won", "OTT")),
    v("base"),
  ]),
  proposal(
    "rus_ld_table_won_home",
    6,
    tableSigned("won"),
    COURT,
    [v("war_on", world({ is: "war" })), v("base")],
    [
      opt("te_deum", [
        opinion("court", 1),
        gauge("morale", 1),
        reason("rus_ld_won_te_deum"),
      ]),
      opt("amnesty", [
        inst_("duma", 1),
        opinion("court", -1),
        reason("rus_ld_won_amnesty"),
      ]),
      opt("quiet", [inst_("ministers", 1), reason("rus_ld_won_quiet")]),
    ],
  ),
  proposal(
    "rus_ld_table_lost",
    8,
    tableSigned("lost"),
    PM,
    [
      v("deu", tableSigned("lost", "DEU")),
      v("auh", tableSigned("lost", "AUH")),
      v("ott", tableSigned("lost", "OTT")),
      v("base"),
    ],
    [
      opt("generals", [
        inst_("stavka", -1),
        opinion("press", 1),
        reason("rus_ld_lost_generals"),
      ]),
      opt("ministers", [
        inst_("ministers", -1),
        opinion("court", 1),
        reason("rus_ld_lost_ministers"),
      ]),
      opt("crown", [
        opinion("court", -1),
        gauge("morale", 1),
        reason("rus_ld_lost_crown"),
      ]),
    ],
  ),
  wire("rus_ld_table_even", 6, tableSigned("even"), FOREIGN, [
    v("deu", tableSigned("even", "DEU")),
    v("auh", tableSigned("even", "AUH")),
    v("ott", tableSigned("even", "OTT")),
    v("base"),
  ]),
];

export const RUS_LAND_EVENTS: readonly GwScene[] = [
  ...OURS,
  ...THEIRS,
  ...OUT,
  ...TABLE,
];
