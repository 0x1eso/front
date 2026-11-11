// Great War 1914 (ww171 phase 4): AUH's state-event scenes for war between
// any pair: a war with a country begins, a front opens, a neutral comes in,
// a peace of two. Owned by the AUH writer lane; shapes and conditions in
// /home/eser/dev/ww171-format4.md, conditions from ./war_events. Text in
// resources/ww1914/ko/AUH.wars.json.
import type {
  GwGauge,
  GwInstitution,
  GwSide,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwBloc } from "@openfront/engine-api/ww1914/GwPress";
import type {
  GwCastRule,
  GwCond,
  GwEffect,
  GwOption,
  GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { all, any, not } from "@openfront/engine-api/ww1914/SceneDsl";
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

// ---- People, by office: whoever holds it in this game ----

const FM: GwCastRule = { office: "foreign" };
const COS: GwCastRule = { office: "chief_of_staff" };
const HUN: GwCastRule = { office: "hun_pm" };

// ---- Conditions ----

/** At war with `tag` now, however it began. */
const atWar = (tag: GwTag): GwCond => ({ kind: "at_war", tag });
/** The seat's war with `tag` came this way. */
const cause = (tag: GwTag, ...of: string[]): GwCond =>
  world({ is: "pair_war", with: tag, cause: of });
/** The seat's war with `tag` is the two's own. */
const outside = (tag: GwTag): GwCond =>
  world({ is: "pair_war", with: tag, outside: true });
const sideIs = (side: GwSide): GwCond => world({ is: "side", of: [side] });
const entered = (tag: GwTag, side: GwSide): GwCond =>
  world({ is: "entered", tag, side });
/** `tag` came in on the seat's side. */
const withUs = (tag: GwTag): GwCond =>
  any(
    all(entered(tag, "central"), sideIs("central")),
    all(entered(tag, "entente"), sideIs("entente")),
  );
/** `tag` came in on the other side. */
const againstUs = (tag: GwTag): GwCond =>
  any(
    all(entered(tag, "central"), sideIs("entente")),
    all(entered(tag, "entente"), sideIs("central")),
  );
/** A front opened and the seat fights someone on its far end. */
const ourFront = (t: GwTheatre, ...foes: GwTag[]): GwCond =>
  all(frontOpened(t, 1), any(...foes.map(atWar)));

// ---- Effects ----

const reason = (key: string): GwEffect => ({ kind: "reason", key });
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
const opt = (id: string, ...effects: GwEffect[]): GwOption => ({
  id,
  tell: [],
  effects,
});

// ---- Shapes ----

type Variants = readonly (readonly [string, GwCond?])[];

const variantsOf = (vs: Variants): GwScene["variants"] =>
  vs.map(([id, when]) => (when === undefined ? { id } : { id, when }));

/** Read and laid aside. */
const wire = (
  id: string,
  salience: number,
  when: GwCond,
  cast: Record<string, GwCastRule>,
  vs: Variants,
): GwScene => ({
  id,
  nation: ["AUH"],
  kind: "wire",
  once: true,
  salience,
  tags: ["foreign", "war"],
  cast,
  when,
  variants: variantsOf(vs),
});

/** A paper with two answers; the first is what a timer takes. */
const proposal = (
  id: string,
  salience: number,
  when: GwCond,
  cast: Record<string, GwCastRule>,
  vs: Variants,
  options: GwOption[],
): GwScene => ({
  ...wire(id, salience, when, cast, vs),
  kind: "proposal",
  fallback: options[0].id,
  options,
});

// ---- War begins ----

const WAR_BEGINS: readonly GwScene[] = [
  proposal(
    "auh_wv_war_rus",
    8,
    warWith("RUS", 1),
    { fm: FM, cos: COS, hun: HUN },
    [
      ["treaty", cause("RUS", "treaty")],
      ["ladder", cause("RUS", "ladder")],
      ["entered", cause("RUS", "entered")],
      ["base"],
    ],
    [
      opt(
        "north_first",
        opinion("army", 1),
        gauge("shells", -1),
        reason("auhwv_rus_north"),
      ),
      opt(
        "hold_hills",
        inst("berlin", 1),
        trust("DEU", 1),
        reason("auhwv_rus_hold"),
      ),
    ],
  ),
  wire(
    "auh_wv_war_srb",
    8,
    all(warWith("SRB", 1), not(ownWarWith("SRB", 1))),
    { fm: FM },
    [
      ["july", cause("SRB", "july")],
      ["treaty", cause("SRB", "treaty")],
      ["ladder", cause("SRB", "ladder")],
      ["base"],
    ],
  ),
  proposal(
    "auh_wv_war_own_srb",
    8,
    ownWarWith("SRB", 1),
    { fm: FM, cos: COS },
    [["ladder", cause("SRB", "ladder")], ["base"]],
    [
      opt(
        "march_on",
        opinion("army", 1),
        trust("RUS", -1),
        reason("auhwv_srb_march"),
      ),
      opt(
        "halt_belgrade",
        opinion("army", -1),
        trust("RUS", 1),
        reason("auhwv_srb_halt"),
      ),
    ],
  ),
  wire("auh_wv_war_mne", 7, warWith("MNE", 1), {}, [
    ["outside", outside("MNE")],
    ["base"],
  ]),
  wire(
    "auh_wv_war_rou",
    8,
    all(warWith("ROU", 1), not(ownWarWith("ROU", 1))),
    { fm: FM },
    [
      ["entered", cause("ROU", "entered", "treaty")],
      ["ladder", cause("ROU", "ladder")],
      ["base"],
    ],
  ),
  proposal(
    "auh_wv_war_own_rou",
    8,
    ownWarWith("ROU", 1),
    { hun: HUN },
    [["ladder", cause("ROU", "ladder")], ["base"]],
    [
      opt(
        "gendarmes",
        gauge("order", 1),
        inst("nations", -1),
        reason("auhwv_rou_guard"),
      ),
      opt(
        "promise",
        inst("nations", 1),
        inst("hungary", -1),
        reason("auhwv_rou_promise"),
      ),
    ],
  ),
  wire(
    "auh_wv_war_ita",
    8,
    all(warWith("ITA", 1), not(ownWarWith("ITA", 1))),
    { fm: FM },
    [
      ["entered", cause("ITA", "entered", "treaty")],
      ["ladder", cause("ITA", "ladder")],
      ["base"],
    ],
  ),
  proposal(
    "auh_wv_war_own_ita",
    8,
    ownWarWith("ITA", 1),
    { fm: FM, cos: COS },
    [["base"]],
    [
      opt(
        "ask_berlin",
        inst("berlin", 1),
        trust("DEU", 1),
        reason("auhwv_ita_berlin"),
      ),
      opt(
        "alone",
        opinion("army", 1),
        gauge("shells", -1),
        reason("auhwv_ita_alone"),
      ),
    ],
  ),
  wire("auh_wv_war_grc", 7, warWith("GRC", 1), { fm: FM }, [
    ["outside", outside("GRC")],
    ["base"],
  ]),
  wire("auh_wv_war_fra", 7, warWith("FRA", 1), { fm: FM }, [
    ["treaty", cause("FRA", "treaty")],
    ["entered", cause("FRA", "entered")],
    ["base"],
  ]),
  proposal(
    "auh_wv_war_gbr",
    7,
    warWith("GBR", 1),
    { fm: FM },
    [
      ["treaty", cause("GBR", "treaty")],
      ["entered", cause("GBR", "entered")],
      ["base"],
    ],
    [
      opt(
        "letter_king",
        opinion("court", 1),
        opinion("press", -1),
        reason("auhwv_gbr_letter"),
      ),
      opt("plain_note", opinion("army", 1), reason("auhwv_gbr_plain")),
    ],
  ),
  proposal(
    "auh_wv_war_deu_rus",
    7,
    all(warBetween("DEU", "RUS", 1), not(atWar("RUS"))),
    { fm: FM, cos: COS, hun: HUN },
    [["base"]],
    [
      opt(
        "promise_berlin",
        trust("DEU", 1),
        opinion("army", 1),
        reason("auhwv_deu_promise"),
      ),
      opt(
        "wait",
        trust("DEU", -1),
        inst("hungary", 1),
        reason("auhwv_deu_wait"),
      ),
    ],
  ),
  wire(
    "auh_wv_war_bgr_srb",
    6,
    all(warBetween("BGR", "SRB", 1), not(atWar("SRB"))),
    { fm: FM },
    [["rus", atWar("RUS")], ["base"]],
  ),
  wire(
    "auh_wv_war_rou_bgr",
    6,
    warBetween("ROU", "BGR", 1),
    { fm: FM, cos: COS },
    [["ours", atWar("ROU")], ["base"]],
  ),
  wire("auh_wv_war_ita_fra", 6, warBetween("ITA", "FRA", 1), { fm: FM }, [
    ["with_us", withUs("ITA")],
    ["base"],
  ]),
];

// ---- Front opens ----

const FRONT_OPENS: readonly GwScene[] = [
  proposal(
    "auh_wv_front_east",
    7,
    ourFront("east", "RUS"),
    { cos: COS },
    [["rou", atWar("ROU")], ["base"]],
    [
      opt("fortress", gauge("bread", -1), reason("auhwv_east_fortress")),
      opt(
        "forward",
        opinion("army", 1),
        gauge("shells", -1),
        reason("auhwv_east_forward"),
      ),
    ],
  ),
  wire(
    "auh_wv_front_balkan",
    7,
    ourFront("balkan", "SRB", "MNE", "GRC", "FRA", "GBR"),
    { cos: COS },
    [["salonika", any(atWar("GRC"), atWar("FRA"), atWar("GBR"))], ["base"]],
  ),
  proposal(
    "auh_wv_front_italy",
    7,
    ourFront("italy", "ITA"),
    { cos: COS },
    [["own", outside("ITA")], ["base"]],
    [
      opt("isonzo", gauge("money", -1), reason("auhwv_italy_isonzo")),
      opt(
        "tyrol",
        opinion("army", 1),
        gauge("shells", -1),
        reason("auhwv_italy_tyrol"),
      ),
    ],
  ),
  wire("auh_wv_front_danube", 7, ourFront("danube", "ROU"), { cos: COS }, [
    ["bgr", withUs("BGR")],
    ["base"],
  ]),
  wire(
    "auh_wv_front_danube_far",
    6,
    all(frontOpened("danube", 1), not(atWar("ROU"))),
    {},
    [["base"]],
  ),
  wire("auh_wv_front_dobruja", 6, frontOpened("dobruja", 1), { fm: FM }, [
    ["ours", atWar("ROU")],
    ["base"],
  ]),
  wire("auh_wv_front_thrace", 6, frontOpened("thrace", 1), { fm: FM }, [
    ["grc", warBetween("OTT", "GRC", 6)],
    ["base"],
  ]),
  wire("auh_wv_front_alps", 6, frontOpened("alps", 1), { cos: COS }, [
    ["ita_foe", atWar("ITA")],
    ["base"],
  ]),
];

// ---- A neutral comes in ----

/** By side: with us, against us, or while the seat stands outside. */
const sides = (tag: GwTag): Variants => [
  ["with_us", withUs(tag)],
  ["against", againstUs(tag)],
  ["base"],
];

const NEUTRAL_JOINS: readonly GwScene[] = [
  proposal(
    "auh_wv_join_ita",
    7,
    joined("ITA"),
    { fm: FM, cos: COS },
    sides("ITA"),
    [
      opt(
        "border",
        opinion("army", 1),
        gauge("shells", -1),
        reason("auhwv_join_ita_border"),
      ),
      opt(
        "thin",
        opinion("army", -1),
        gauge("shells", 1),
        reason("auhwv_join_ita_thin"),
      ),
    ],
  ),
  proposal("auh_wv_join_rou", 7, joined("ROU"), { hun: HUN }, sides("ROU"), [
    opt(
      "gendarmes",
      gauge("order", 1),
      inst("nations", -1),
      reason("auhwv_rou_guard"),
    ),
    opt(
      "promise",
      inst("nations", 1),
      inst("hungary", -1),
      reason("auhwv_rou_promise"),
    ),
  ]),
  wire("auh_wv_join_bgr", 7, joined("BGR"), { fm: FM }, sides("BGR")),
  wire("auh_wv_join_ott", 7, joined("OTT"), { fm: FM }, sides("OTT")),
  wire("auh_wv_join_grc", 7, joined("GRC"), { fm: FM }, sides("GRC")),
  wire("auh_wv_join_usa", 7, joined("USA"), { fm: FM }, sides("USA")),
  wire("auh_wv_join_jpn", 6, joined("JPN"), { fm: FM }, sides("JPN")),
  wire("auh_wv_join_bel", 6, joined("BEL"), { fm: FM, cos: COS }, [
    ["against", againstUs("BEL")],
    ["base"],
  ]),
  wire("auh_wv_join_nld", 6, joined("NLD"), { fm: FM }, sides("NLD")),
];

// ---- Peace of two ----

const PEACE_OF_TWO: readonly GwScene[] = [
  proposal(
    "auh_wv_peace_rus",
    7,
    peaceWith("RUS"),
    { fm: FM, cos: COS },
    [
      ["deu_fights", world({ is: "pair_war", tag: "DEU", with: "RUS" })],
      ["base"],
    ],
    [
      opt(
        "send_south",
        opinion("army", 1),
        gauge("morale", -1),
        reason("auhwv_peace_rus_south"),
      ),
      opt(
        "send_home",
        gauge("bread", 1),
        opinion("army", -1),
        reason("auhwv_peace_rus_home"),
      ),
    ],
  ),
  wire("auh_wv_peace_srb", 7, peaceWith("SRB"), { fm: FM }, [
    ["rus", atWar("RUS")],
    ["base"],
  ]),
  proposal(
    "auh_wv_peace_ita",
    7,
    peaceWith("ITA"),
    { cos: COS },
    [["base"]],
    [
      opt(
        "move",
        opinion("army", -1),
        gauge("morale", 1),
        reason("auhwv_peace_ita_move"),
      ),
      opt(
        "watch",
        trust("ITA", -1),
        gauge("money", -1),
        reason("auhwv_peace_ita_watch"),
      ),
    ],
  ),
  wire("auh_wv_peace_rou", 7, peaceWith("ROU"), { hun: HUN, cos: COS }, [
    ["rus_on", atWar("RUS")],
    ["base"],
  ]),
  proposal(
    "auh_wv_peace_deu_rus",
    8,
    all(peaceBetween("DEU", "RUS"), atWar("RUS")),
    { fm: FM },
    [["base"]],
    [
      opt(
        "protest",
        trust("DEU", -1),
        opinion("army", 1),
        reason("auhwv_deu_rus_protest"),
      ),
      opt(
        "same_terms",
        trust("DEU", 1),
        inst("berlin", 1),
        reason("auhwv_deu_rus_terms"),
      ),
    ],
  ),
  wire(
    "auh_wv_peace_deu_fra",
    6,
    peaceBetween("DEU", "FRA"),
    { fm: FM, cos: COS },
    [["fra_on", atWar("FRA")], ["base"]],
  ),
  proposal(
    "auh_wv_peace_offer_rus",
    7,
    offered("RUS"),
    { fm: FM },
    [["base"]],
    [
      opt(
        "show_berlin",
        trust("DEU", 1),
        inst("berlin", 1),
        reason("auhwv_offer_rus_berlin"),
      ),
      opt("keep_close", inst("council", -1), reason("auhwv_offer_rus_close")),
    ],
  ),
  proposal(
    "auh_wv_peace_offer_ita",
    7,
    offered("ITA"),
    { hun: HUN, cos: COS },
    [["base"]],
    [
      opt(
        "council",
        inst("council", 1),
        inst("hungary", 1),
        reason("auhwv_offer_ita_council"),
      ),
      opt(
        "ask_army",
        opinion("army", 1),
        inst("hungary", -1),
        reason("auhwv_offer_ita_army"),
      ),
    ],
  ),
];

export const AUH_WAR_EVENTS: readonly GwScene[] = [
  ...WAR_BEGINS,
  ...FRONT_OPENS,
  ...NEUTRAL_JOINS,
  ...PEACE_OF_TWO,
];
