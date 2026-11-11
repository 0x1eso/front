// Great War 1914 (ww172 phase 5): DEU's scenes of occupation and the
// bilateral tables: land taken or lost, a capital falling, a country knocked
// out, a table of two sitting or signed. Owned by the DEU writer lane;
// shapes and conditions in /home/eser/dev/ww172-format5.md, conditions from
// ./land_events. Text, and the memoir lines on the new endings, in
// resources/ww1914/ko/DEU.lands.json.
import type {
  GwGauge,
  GwInstitution,
  GwSide,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwBloc } from "@openfront/engine-api/ww1914/GwPress";
import {
  reason,
  trustOf,
  type GwCond,
  type GwEffect,
  type GwOption,
  type GwScene,
  type GwVariant,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";
import {
  capitalFell,
  knockedOut,
  lostCapital,
  lostGroup,
  lostLand,
  tableSigned,
  tableSits,
  tableSitsAs,
  tookCapital,
  tookLand,
} from "./land_events";

/**
 * Germany is the seat: Wilhelm II reads these. Land changes hands as the
 * fronts and the occupation move it; a table of two sits as the system calls
 * it. A scene frames what that is for Berlin; its options carry small prices
 * and never move land. What a pick cost comes after, as the reason line
 * `deu_ld_<key>`.
 */

// ---- The state ----

/** `tag` has been knocked out of the war, at any time. */
const isOut = (tag: GwTag): GwCond => knockedOut(tag, 600);
/** Germany holds `tag`'s capital, however long. */
const holdsCapital = (tag: GwTag): GwCond =>
  world({ is: "land_taken", from: tag, capital: true });
/** Germany has held land of `tag` for at least `months`. */
const heldSince = (tag: GwTag, months: number): GwCond =>
  world({ is: "land_taken", from: tag, min: months });
/** `tag` has held German land for at least `months`. */
const lostSince = (tag: GwTag, months: number): GwCond =>
  world({ is: "land_lost", to: tag, min: months });
const atWar = (tag: GwTag): GwCond => ({ kind: "at_war", tag });
const stands = (tag: GwTag, side: GwSide): GwCond =>
  world({ is: "entered", tag, side });
const sideIs = (...of: (GwSide | "neutral")[]): GwCond =>
  world({ is: "side", of });
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
/** An option and its line after the pick: reason `deu_ld_<key>`. */
const opt = (id: string, key: string, ...effects: GwEffect[]): GwOption => ({
  id,
  tell: [],
  effects: [...effects, reason(`deu_ld_${key}`)],
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

/** Land of `tag` taken: it is out, its capital is ours, or only the front. */
const byFall = (tag: GwTag): GwVariant[] => [
  v("out", isOut(tag)),
  v("capital", holdsCapital(tag)),
  v("base"),
];
/** A capital or a long hold: the country is out, or the war goes on. */
const outOrOn = (tag: GwTag): GwVariant[] => [v("out", isOut(tag)), v("base")];
/** A table with `tag` sits: Germany came ahead, behind, or level. */
const seated = (tag: GwTag): GwVariant[] => [
  v("won", tableSitsAs("won", tag)),
  v("lost", tableSitsAs("lost", tag)),
  v("base"),
];

const cos = { office: "chief_of_staff" } as const;
const pm = { office: "chancellor" } as const;
const fm = { office: "foreign" } as const;
const navy = { office: "navy" } as const;
const court = { office: "court" } as const;
const finance = { office: "finance" } as const;
const interior = { office: "interior" } as const;

// ---- Occupation, ours ----

const OURS: GwScene[] = [
  paper("deu_ld_occ_bel", tookLand("BEL"), { pm, cos }, 7, byFall("BEL"), [
    opt("army", "bel_army", inst("army", 1), trust("BEL", -1)),
    opt("civil", "bel_civil", inst("reichstag", 1), opinion("army", -1)),
    opt("relief", "bel_relief", trust("USA", 1), trustOf(cos, -1)),
  ]),
  paper(
    "deu_ld_occ_bel_capital",
    tookCapital("BEL"),
    { cos, finance },
    7,
    outOrOn("BEL"),
    [
      opt("council", "brx_council", trust("BEL", 1), opinion("army", -1)),
      opt("levy", "brx_levy", gauge("money", 1), trust("BEL", -1)),
      opt("march", "brx_march", opinion("press", 1), trust("USA", -1)),
    ],
  ),
  paper(
    "deu_ld_occ_bel_long",
    heldSince("BEL", 6),
    { pm, interior },
    7,
    outOrOn("BEL"),
    [
      opt("flemish", "bel_flemish", trust("NLD", 1), trust("BEL", -1)),
      opt(
        "labour",
        "bel_labour",
        gauge("shells", 1),
        trust("USA", -1),
        inst("reichstag", -1),
      ),
      opt("leave", "bel_leave", trust("BEL", 1), opinion("business", -1)),
    ],
  ),
  paper("deu_ld_occ_fra", tookLand("FRA"), { cos, finance }, 7, byFall("FRA"), [
    opt("mines", "fra_mines", gauge("shells", 1), trust("FRA", -1)),
    opt("requisition", "fra_requisition", gauge("bread", 1), trust("USA", -1)),
    opt("mayors", "fra_mayors", trust("FRA", 1), opinion("army", -1)),
  ]),
  paper(
    "deu_ld_occ_fra_capital",
    tookCapital("FRA"),
    { cos, court },
    8,
    outOrOn("FRA"),
    [
      opt("parade", "paris_parade", opinion("press", 1), trust("FRA", -1)),
      opt("outside", "paris_outside", trust("FRA", 1), opinion("army", -1)),
      opt(
        "versailles",
        "paris_versailles",
        opinion("court", 1),
        trust("USA", -1),
      ),
    ],
  ),
  paper("deu_ld_occ_rus", tookLand("RUS"), { cos, pm }, 7, byFall("RUS"), [
    opt("poles", "rus_poles", opinion("parliament", 1), trust("AUH", -1)),
    opt("army", "rus_army", inst("army", 1), trustOf(pm, -1)),
    opt("grain", "rus_grain", gauge("bread", 1), trust("RUS", -1)),
  ]),
  paper(
    "deu_ld_occ_rus_capital",
    tookCapital("RUS"),
    { navy, fm },
    8,
    outOrOn("RUS"),
    [
      opt("letter", "ptg_letter", trust("RUS", 1), opinion("army", -1)),
      opt("fleet", "ptg_fleet", trustOf(navy, 1), opinion("workers", -1)),
      opt("garrison", "ptg_garrison", inst("army", 1), gauge("bread", -1)),
    ],
  ),
  paper(
    "deu_ld_occ_rus_long",
    world({ is: "land_taken", from: "RUS", group: ["russian_poland"], min: 6 }),
    { pm, fm },
    7,
    outOrOn("RUS"),
    [
      opt("kingdom", "pol_kingdom", trust("AUH", 1), trust("RUS", -1)),
      opt("strip", "pol_strip", opinion("army", 1), opinion("workers", -1)),
      opt("wait", "pol_wait", trust("RUS", 1), opinion("press", -1)),
    ],
  ),
  paper("deu_ld_occ_nld", tookLand("NLD"), { fm, finance }, 7, outOrOn("NLD"), [
    opt("queen", "nld_queen", trust("NLD", 1), opinion("army", -1)),
    opt("ports", "nld_ports", opinion("business", 1), trust("GBR", -1)),
    opt("strict", "nld_strict", inst("army", 1), trust("NLD", -1)),
  ]),
];

// ---- Occupation, theirs ----

const THEIRS: GwScene[] = [
  paper(
    "deu_ld_lost_fra",
    lostGroup(["alsace_lorraine", "rhineland"], 0, "FRA"),
    { cos, interior },
    8,
    [v("east", atWar("RUS")), v("base")],
    [
      opt("retake", "lfra_retake", inst("army", 1), gauge("shells", -1)),
      opt("refugees", "lfra_refugees", gauge("morale", 1), gauge("bread", -1)),
      opt("truth", "lfra_truth", inst("reichstag", 1), opinion("press", -1)),
    ],
  ),
  wire("deu_ld_lost_fra_long", lostSince("FRA", 4), { interior }, 6, [
    v("long", lostSince("FRA", 12)),
    v("base"),
  ]),
  paper(
    "deu_ld_lost_rus",
    lostGroup(["east_prussia"], 0, "RUS"),
    { cos, pm },
    8,
    [v("west", atWar("FRA")), v("base")],
    [
      opt("east", "lrus_east", opinion("court", 1), trustOf(cos, -1)),
      opt("refugees", "lrus_refugees", gauge("morale", 1), gauge("bread", -1)),
      opt("hold", "lrus_hold", opinion("army", 1), opinion("court", -1)),
    ],
  ),
  wire("deu_ld_lost_gbr", lostLand("GBR"), { navy }, 6, [v("base")]),
  paper(
    "deu_ld_lost_capital",
    lostCapital(),
    { pm, court },
    8,
    [
      v("rus", world({ is: "land_lost", to: "RUS", capital: true })),
      v("fra", world({ is: "land_lost", to: "FRA", capital: true })),
      v("base"),
    ],
    [
      opt("kassel", "cap_kassel", opinion("court", 1), gauge("morale", -1)),
      opt(
        "munich",
        "cap_munich",
        opinion("parliament", 1),
        opinion("court", -1),
      ),
      opt("field", "cap_field", inst("army", 1), inst("reichstag", -1)),
    ],
  ),
  wire("deu_ld_fell_belgrade", capitalFell("AUH", "SRB"), { fm }, 6, [
    v("with", sideIs("central")),
    v("base"),
  ]),
  paper(
    "deu_ld_fell_bucharest",
    capitalFell("AUH", "ROU"),
    { finance, fm },
    7,
    [v("with", sideIs("central")), v("base")],
    [
      opt("oil", "buc_oil", gauge("shells", 1), trust("AUH", -1)),
      opt("grain", "buc_grain", gauge("bread", 1), trust("ROU", -1)),
      opt("vienna", "buc_vienna", trust("AUH", 1), opinion("business", -1)),
    ],
  ),
  wire("deu_ld_fell_const", capitalFell("RUS", "OTT"), { fm, navy }, 7, [
    v("ally", stands("OTT", "central")),
    v("base"),
  ]),
];

// ---- Knocked out ----

const FALLEN: GwScene[] = [
  paper(
    "deu_ld_ko_fra",
    knockedOut("FRA"),
    { cos, pm },
    8,
    [v("paris", holdsCapital("FRA")), v("war", sideIs("central")), v("base")],
    [
      opt("east", "kfra_east", inst("army", 1), gauge("morale", -1)),
      opt("mercy", "kfra_mercy", trust("FRA", 1), opinion("press", -1)),
      opt("bill", "kfra_bill", opinion("business", 1), trust("FRA", -1)),
    ],
  ),
  paper(
    "deu_ld_ko_rus",
    knockedOut("RUS"),
    { cos, fm },
    8,
    [v("held", tookLand("RUS", 600)), v("base")],
    [
      opt("west", "krus_west", inst("army", 1), gauge("bread", -1)),
      opt("grain", "krus_grain", gauge("bread", 1), trust("AUH", -1)),
      opt("watch", "krus_watch", gauge("order", 1), opinion("workers", -1)),
    ],
  ),
  wire("deu_ld_ko_bel", knockedOut("BEL"), { fm }, 6, [
    v("held", tookLand("BEL", 600)),
    v("base"),
  ]),
  paper(
    "deu_ld_ko_auh",
    knockedOut("AUH"),
    { cos, fm },
    8,
    [v("ally", stands("AUH", "central")), v("base")],
    [
      opt("south", "kauh_south", trust("AUH", 1), gauge("shells", -1)),
      opt("alone", "kauh_alone", inst("reichstag", 1), gauge("morale", -1)),
      opt("blame", "kauh_blame", opinion("press", 1), trust("AUH", -1)),
    ],
  ),
  wire("deu_ld_ko_ott", knockedOut("OTT"), { navy }, 6, [
    v("ally", stands("OTT", "central")),
    v("base"),
  ]),
  wire("deu_ld_ko_ita", knockedOut("ITA"), { fm }, 6, [
    v("foe", stands("ITA", "entente")),
    v("friend", stands("ITA", "central")),
    v("base"),
  ]),
];

// ---- The bilateral table ----

const TABLES: GwScene[] = [
  paper("deu_ld_table_fra", tableSits("FRA"), { pm, fm }, 8, seated("FRA"), [
    opt("hard", "tfra_hard", opinion("army", 1), trust("FRA", -1)),
    opt("short", "tfra_short", gauge("morale", 1), opinion("army", -1)),
    opt("house", "tfra_house", inst("reichstag", 1), trustOf(fm, -1)),
  ]),
  paper("deu_ld_table_rus", tableSits("RUS"), { pm, fm }, 8, seated("RUS"), [
    opt("border", "trus_border", opinion("army", 1), trust("RUS", -1)),
    opt("letter", "trus_letter", trust("RUS", 1), opinion("press", -1)),
    opt("vienna", "trus_vienna", trust("AUH", 1), trustOf(pm, -1)),
  ]),
  paper("deu_ld_table_bel", tableSits("BEL"), { pm, fm }, 8, seated("BEL"), [
    opt("restore", "tbel_restore", trust("GBR", 1), opinion("army", -1)),
    opt("liege", "tbel_liege", opinion("press", 1), trust("BEL", -1)),
    opt("pay", "tbel_pay", trust("BEL", 1), gauge("money", -1)),
  ]),
  wire("deu_ld_table_nld", tableSits("NLD"), { fm }, 7, seated("NLD")),
  paper("deu_ld_table_gbr", tableSits("GBR"), { navy, fm }, 8, seated("GBR"), [
    opt("colonies", "tgbr_colonies", opinion("business", 1), trustOf(navy, -1)),
    opt("fleet", "tgbr_fleet", trustOf(navy, 1), trust("GBR", -1)),
    opt("quick", "tgbr_quick", trust("GBR", 1), opinion("press", -1)),
  ]),
  paper(
    "deu_ld_table_won",
    tableSigned("won"),
    { pm, court },
    8,
    [
      v("fra", tableSigned("won", "FRA")),
      v("rus", tableSigned("won", "RUS")),
      v("bel", tableSigned("won", "BEL")),
      v("base"),
    ],
    [
      opt("parade", "twon_parade", gauge("morale", 1), opinion("workers", -1)),
      opt("house", "twon_house", inst("reichstag", 1), opinion("army", -1)),
      opt("quiet", "twon_quiet", inst("army", 1), opinion("press", -1)),
    ],
  ),
  paper(
    "deu_ld_table_lost",
    tableSigned("lost"),
    { pm, cos },
    8,
    [
      v("fra", tableSigned("lost", "FRA")),
      v("rus", tableSigned("lost", "RUS")),
      v("base"),
    ],
    [
      opt("own", "tlost_own", inst("reichstag", 1), opinion("court", -1)),
      opt("staff", "tlost_staff", opinion("parliament", 1), trustOf(cos, -1)),
      opt("pens", "tlost_pens", opinion("army", 1), trustOf(pm, -1)),
    ],
  ),
  wire("deu_ld_table_even", tableSigned("even"), { pm }, 7, [
    v("fra", tableSigned("even", "FRA")),
    v("rus", tableSigned("even", "RUS")),
    v("base"),
  ]),
];

export const DEU_LAND_EVENTS: readonly GwScene[] = [
  ...OURS,
  ...THEIRS,
  ...FALLEN,
  ...TABLES,
];
