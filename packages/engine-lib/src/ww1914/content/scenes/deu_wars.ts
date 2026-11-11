// Great War 1914 (ww171 phase 4): DEU's state-event scenes for war between
// any pair: a war with a country begins, a front opens, a neutral comes in,
// a peace of two. Owned by the DEU writer lane; shapes and conditions in
// /home/eser/dev/ww171-format4.md, conditions from ./war_events. Text in
// resources/ww1914/ko/DEU.wars.json.
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
  trustOf,
  type GwCond,
  type GwEffect,
  type GwOption,
  type GwScene,
  type GwVariant,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";
import {
  frontOpened,
  joined,
  offered,
  peaceBetween,
  peaceWith,
  warBetween,
  warWith,
} from "./war_events";

/**
 * Germany is the seat: Wilhelm II reads these. A war comes as the state made
 * it (our note, theirs, a treaty, a country joining a coalition), never on a
 * date; the text names how. Options carry small prices and say what was done;
 * what it cost comes after, as the reason line `deu_wv_<key>`.
 */

// ---- The state ----

/** At war with `tag` now, however long. */
const atWar = (tag: GwTag): GwCond => ({ kind: "at_war", tag });
/** The war with `tag`, on now, came this way. */
const came = (tag: GwTag, cause: string[]): GwCond =>
  world({ is: "pair_war", with: tag, cause });
/** A war with `tag` that began as one of the two joined a coalition. */
const byEntry = (tag: GwTag): GwCond => came(tag, ["entered"]);
/** Germany's note to `tag` ended in this war. */
const ourNote = (tag: GwTag): GwCond =>
  all(
    came(tag, ["ladder", "declared"]),
    world({ is: "ladder", role: "from", tag, of: ["war"] }),
  );
/** `tag`'s note to Germany ended in this war. */
const theirNote = (tag: GwTag): GwCond =>
  all(
    came(tag, ["ladder", "declared"]),
    world({ is: "ladder", role: "to", tag, of: ["war"] }),
  );
/** A treaty pulled one of the two in. */
const byTreaty = (tag: GwTag): GwCond => came(tag, ["treaty", "july"]);
/** Neither stands in a coalition against the other. */
const ownWar = (tag: GwTag): GwCond =>
  world({ is: "pair_war", with: tag, outside: true });
const sideIs = (...of: (GwSide | "neutral")[]): GwCond =>
  world({ is: "side", of });
const stands = (tag: GwTag, side: GwSide): GwCond =>
  world({ is: "entered", tag, side });
const out = (tag: GwTag): GwCond => world({ is: "out", tag });
/** Germany itself is still in the war: its own fall is not a peace of two. */
const still: GwCond = not(out("DEU"));

// ---- Prices ----

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
/** An option and its line after the pick: reason `deu_wv_<key>`. */
const opt = (id: string, key: string, ...effects: GwEffect[]): GwOption => ({
  id,
  tell: [],
  effects: [...effects, reason(`deu_wv_${key}`)],
});

const NATION: GwScene["nation"] = ["DEU"];
const TAGS: GwScene["tags"] = ["foreign", "war"];

function wire(
  id: string,
  when: GwCond,
  cast: GwScene["cast"],
  salience: number,
  variants: GwVariant[],
): GwScene {
  return {
    id,
    nation: NATION,
    kind: "wire",
    once: true,
    salience,
    tags: TAGS,
    cast,
    when,
    variants,
  };
}

function paper(
  id: string,
  when: GwCond,
  cast: GwScene["cast"],
  salience: number,
  variants: GwVariant[],
  options: GwOption[],
): GwScene {
  return {
    id,
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
  };
}

/** How a war with `tag` came: our note, theirs, then `more`, then the base. */
const how = (tag: GwTag, ...more: GwVariant[]): GwVariant[] => [
  v("our_note", ourNote(tag)),
  v("their_note", theirNote(tag)),
  ...more,
  v("base"),
];

/** A war with `tag` begun this month or last, not by a coalition's joining. */
const direct = (tag: GwTag): GwCond => all(warWith(tag, 1), not(byEntry(tag)));

/** A neutral came in: against us, with us, or with Germany outside. */
const joinVariants = (tag: GwTag): GwVariant[] => [
  v("against", all(stands(tag, "entente"), atWar(tag))),
  v("with", all(stands(tag, "central"), sideIs("central"))),
  v("apart", sideIs("neutral")),
  v("base"),
];

const cos = { office: "chief_of_staff" } as const;
const pm = { office: "chancellor" } as const;
const fm = { office: "foreign" } as const;
const navy = { office: "navy" } as const;
const court = { office: "court" } as const;
const finance = { office: "finance" } as const;

// ---- War begins ----

const WAR_BEGINS: GwScene[] = [
  paper(
    "deu_wv_war_fra",
    warWith("FRA", 1),
    { cos, pm },
    8,
    how("FRA", v("treaty", byTreaty("FRA")), v("own", ownWar("FRA"))),
    [
      opt("defence", "fra_defence", opinion("workers", 1), opinion("army", -1)),
      opt("staff", "fra_staff", inst("army", 1), trustOf(pm, -1)),
      opt("lands", "fra_lands", opinion("press", 1), trust("FRA", -1)),
    ],
  ),
  paper(
    "deu_wv_war_rus",
    warWith("RUS", 1),
    { cos, pm },
    8,
    how("RUS", v("treaty", byTreaty("RUS")), v("own", ownWar("RUS"))),
    [
      opt(
        "tsarism",
        "rus_tsarism",
        opinion("workers", 1),
        inst("reichstag", 1),
        opinion("court", -1),
      ),
      opt(
        "cousin",
        "rus_cousin",
        remember("k_wv_tsar_line"),
        opinion("army", -1),
      ),
      opt("east_first", "rus_east", inst("army", 1), trustOf(cos, -1)),
    ],
  ),
  paper(
    "deu_wv_war_gbr",
    warWith("GBR", 1),
    { navy, fm },
    8,
    how(
      "GBR",
      v("belgium", all(byEntry("GBR"), atWar("BEL"))),
      v("own", ownWar("GBR")),
    ),
    [
      opt("hate", "gbr_hate", opinion("press", 1), trust("GBR", -1)),
      opt("fleet", "gbr_fleet", trustOf(navy, 1), gauge("money", -1)),
      opt(
        "channel",
        "gbr_channel",
        remember("k_wv_london_door"),
        opinion("army", -1),
      ),
    ],
  ),
  paper(
    "deu_wv_war_bel",
    direct("BEL"),
    { pm, cos },
    7,
    how("BEL", v("plan", came("BEL", ["plan_west"]))),
    [
      opt("wrong", "bel_wrong", inst("reichstag", 1), opinion("army", -1)),
      opt("hard", "bel_hard", inst("army", 1), trust("BEL", -1)),
      opt("pay", "bel_pay", gauge("money", -1), trust("BEL", 1)),
    ],
  ),
  paper("deu_wv_war_usa", direct("USA"), { fm, navy }, 7, how("USA"), [
    opt("pass", "usa_pass", trust("USA", 1), trustOf(navy, -1)),
    opt("boats", "usa_boats", trustOf(navy, 1), opinion("business", -1)),
    opt("mexico", "usa_mexico", remember("k_wv_mexico_word"), trust("USA", -1)),
  ]),
  paper("deu_wv_war_ita", direct("ITA"), { fm, cos }, 7, how("ITA"), [
    opt("alps", "ita_alps", inst("army", 1), gauge("shells", -1)),
    opt("vienna", "ita_vienna", trust("AUH", 1), trustOf(cos, -1)),
    opt("door", "ita_door", trust("ITA", 1), opinion("press", -1)),
  ]),
  paper("deu_wv_war_rou", direct("ROU"), { cos, finance }, 7, how("ROU"), [
    opt("oil", "rou_oil", inst("army", 1), gauge("money", -1)),
    opt("king", "rou_king", trust("ROU", 1), opinion("army", -1)),
    opt("grain", "rou_grain", gauge("bread", 1), trustOf(cos, -1)),
  ]),
  wire(
    "deu_wv_war_srb",
    warWith("SRB", 1),
    { cos },
    6,
    how("SRB", v("entered", byEntry("SRB")), v("own", ownWar("SRB"))),
  ),
  wire("deu_wv_war_mne", warWith("MNE", 1), {}, 6, [
    v("entered", byEntry("MNE")),
    v("base"),
  ]),
  paper("deu_wv_war_grc", direct("GRC"), { fm, court }, 6, how("GRC"), [
    opt(
      "sister",
      "grc_sister",
      remember("k_wv_athens_letter"),
      opinion("press", -1),
    ),
    opt("press", "grc_press", opinion("press", 1), trust("GRC", -1)),
    opt("quiet", "grc_quiet", trust("GRC", 1), inst("army", -1)),
  ]),
  wire("deu_wv_war_jpn", direct("JPN"), { navy }, 7, how("JPN")),
  paper("deu_wv_war_nld", direct("NLD"), { cos, finance }, 7, how("NLD"), [
    opt("swift", "nld_swift", inst("army", 1), opinion("business", -1)),
    opt("ports", "nld_ports", gauge("bread", -1), trust("NLD", 1)),
    opt("say", "nld_say", inst("reichstag", 1), trustOf(cos, -1)),
  ]),
  // Vienna's own wars near Germany, outside the July chain.
  wire(
    "deu_wv_war_auh_srb",
    all(
      warBetween("AUH", "SRB", 1),
      not(world({ is: "pair_war", tag: "AUH", with: "SRB", cause: ["july"] })),
    ),
    { fm },
    6,
    [v("apart", sideIs("neutral")), v("base")],
  ),
  paper(
    "deu_wv_war_auh_rus",
    all(warBetween("AUH", "RUS", 1), not(atWar("RUS"))),
    { pm, cos },
    8,
    [
      v(
        "notes",
        world({
          is: "pair_war",
          tag: "AUH",
          with: "RUS",
          cause: ["ladder", "declared"],
        }),
      ),
      v("base"),
    ],
    [
      opt("assure", "auh_assure", trust("AUH", 1), trust("RUS", -1)),
      opt("wait", "auh_wait", trust("AUH", -1), opinion("workers", 1)),
      opt("mediate", "auh_mediate", trust("RUS", 1), trust("AUH", -1)),
    ],
  ),
  wire(
    "deu_wv_war_auh_ita",
    all(warBetween("AUH", "ITA", 1), not(atWar("ITA"))),
    { fm },
    6,
    [v("apart", sideIs("neutral")), v("base")],
  ),
];

// ---- Fronts open ----

const FRONTS: GwScene[] = [
  wire("deu_wv_front_west", frontOpened("west"), { cos }, 7, [
    v("belgium_only", all(atWar("BEL"), not(atWar("FRA")))),
    v("no_belgium", all(atWar("FRA"), not(atWar("BEL")))),
    v("base"),
  ]),
  wire("deu_wv_front_east", frontOpened("east"), { cos }, 7, [
    v("romania", all(atWar("ROU"), not(atWar("RUS")))),
    v("vienna", not(atWar("RUS"))),
    v("base"),
  ]),
  wire("deu_wv_front_balkan", frontOpened("balkan"), { cos }, 6, [
    v("ours", any(atWar("SRB"), atWar("GRC"), atWar("MNE"))),
    v("base"),
  ]),
  wire("deu_wv_front_italy", frontOpened("italy"), { cos }, 6, [
    v("ours", atWar("ITA")),
    v("base"),
  ]),
  paper(
    "deu_wv_front_sea",
    frontOpened("sea"),
    { navy },
    7,
    [v("america", all(atWar("USA"), not(atWar("GBR")))), v("base")],
    [
      opt("harbour", "sea_harbour", gauge("morale", -1), trustOf(navy, -1)),
      opt("sortie", "sea_sortie", trustOf(navy, 1), gauge("money", -1)),
      opt("cruisers", "sea_cruisers", opinion("press", 1), gauge("shells", -1)),
    ],
  ),
  wire("deu_wv_front_colonies", frontOpened("colonies"), {}, 6, [
    v("japan", atWar("JPN")),
    v("base"),
  ]),
  wire("deu_wv_front_danube", frontOpened("danube"), { cos }, 6, [
    v("ours", atWar("ROU")),
    v("base"),
  ]),
  wire("deu_wv_front_low", frontOpened("low_countries"), { cos }, 7, [
    v("two_fronts", world({ is: "open", theatre: "west" })),
    v("base"),
  ]),
];

// ---- Neutrals come in ----

const JOINS: GwScene[] = [
  paper(
    "deu_wv_join_ita_with",
    joined("ITA", "central"),
    { fm, cos },
    7,
    [v("apart", sideIs("neutral")), v("base")],
    [
      opt("coal", "ita_coal", gauge("money", -1), trust("ITA", 1)),
      opt("staff", "ita_staff", inst("army", 1), trust("AUH", -1)),
      opt("vienna", "ita_vienna_first", trust("AUH", 1), trust("ITA", -1)),
    ],
  ),
  wire("deu_wv_join_ita_against", joined("ITA", "entente"), { fm }, 7, [
    v("against", atWar("ITA")),
    v("base"),
  ]),
  wire("deu_wv_join_ott", joined("OTT"), { fm }, 7, joinVariants("OTT")),
  wire("deu_wv_join_bgr", joined("BGR"), { fm }, 6, joinVariants("BGR")),
  wire("deu_wv_join_rou", joined("ROU"), { cos }, 7, joinVariants("ROU")),
  wire("deu_wv_join_grc", joined("GRC"), { court }, 6, joinVariants("GRC")),
  wire("deu_wv_join_usa", joined("USA"), { navy }, 8, joinVariants("USA")),
  wire("deu_wv_join_jpn", joined("JPN"), { fm }, 6, joinVariants("JPN")),
  wire("deu_wv_join_nld", joined("NLD"), { cos }, 7, joinVariants("NLD")),
  wire("deu_wv_join_bel", joined("BEL"), { pm }, 6, joinVariants("BEL")),
];

// ---- Peace of two ----

const PEACES: GwScene[] = [
  paper(
    "deu_wv_peace_rus",
    all(peaceWith("RUS"), still),
    { cos, pm },
    8,
    [v("fell", out("RUS")), v("base")],
    [
      opt("west", "prus_west", inst("army", 1), gauge("order", -1)),
      opt("bread", "prus_bread", gauge("bread", 1), opinion("army", -1)),
      opt("guard", "prus_guard", gauge("order", 1), trustOf(cos, -1)),
    ],
  ),
  paper(
    "deu_wv_peace_fra",
    all(peaceWith("FRA"), still),
    { cos, pm },
    8,
    [v("fell", out("FRA")), v("base")],
    [
      opt("home", "pfra_home", gauge("morale", 1), inst("army", -1)),
      opt("east", "pfra_east", inst("army", 1), opinion("workers", -1)),
      opt("parade", "pfra_parade", opinion("press", 1), gauge("money", -1)),
    ],
  ),
  paper(
    "deu_wv_peace_gbr",
    all(peaceWith("GBR"), still),
    { navy, fm },
    7,
    [v("fell", out("GBR")), v("base")],
    [
      opt("ships", "pgbr_ships", gauge("bread", 1), trustOf(navy, -1)),
      opt("yards", "pgbr_yards", trustOf(navy, 1), gauge("money", -1)),
      opt("word", "pgbr_word", trust("GBR", 1), opinion("press", -1)),
    ],
  ),
  paper(
    "deu_wv_peace_bel",
    all(peaceWith("BEL"), still),
    { pm, cos },
    7,
    [v("fell", out("BEL")), v("base")],
    [
      opt("restore", "pbel_restore", trust("BEL", 1), opinion("army", -1)),
      opt("hold", "pbel_hold", inst("army", 1), inst("reichstag", -1)),
      opt("later", "pbel_later", remember("k_wv_belgium_open")),
    ],
  ),
  paper(
    "deu_wv_peace_auh_rus",
    all(peaceBetween("AUH", "RUS"), still),
    { fm, cos },
    8,
    [
      v("alone", all(atWar("RUS"), not(out("AUH")))),
      v("fell", out("AUH")),
      v("base"),
    ],
    [
      opt("accept", "pauh_accept", trust("AUH", 1), trustOf(cos, -1)),
      opt("reproach", "pauh_reproach", trust("AUH", -1), opinion("press", 1)),
      opt("ask", "pauh_ask", trustOf(fm, 1), trust("RUS", 1)),
    ],
  ),
  wire(
    "deu_wv_peace_auh_srb",
    all(peaceBetween("AUH", "SRB"), still),
    { fm },
    6,
    [v("fell", out("SRB")), v("base")],
  ),
  wire(
    "deu_wv_peace_auh_ita",
    all(peaceBetween("AUH", "ITA"), still),
    { cos },
    6,
    [v("alone", atWar("ITA")), v("base")],
  ),
  // The system's card answers the offer; this only frames it.
  wire("deu_wv_peace_offer", all(offered(), still), { fm }, 7, [
    v("fra", offered("FRA")),
    v("rus", offered("RUS")),
    v("gbr", offered("GBR")),
    v("base"),
  ]),
];

export const DEU_WAR_EVENTS: readonly GwScene[] = [
  ...WAR_BEGINS,
  ...FRONTS,
  ...JOINS,
  ...PEACES,
];
