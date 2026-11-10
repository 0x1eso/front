import type {
  GwSecret,
  GwSide,
  GwSource,
  GwStamp,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GW_TAGS, GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  all,
  any,
  chose,
  flag,
  GwCastRule,
  GwCond,
  GwEffect,
  GwOption,
  GwScene,
  GwVariant,
  memory,
  not,
  setFlag,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";

/**
 * Common scenes, the neutrals' share (plan: ww135-plan-common.md §6): the
 * gw_o_ scenes any seat meets. Data only; the text is in
 * resources/ww1914/ko/common.neutral.json, written without a form of address
 * and with the seat's own people only as {fm}, {fin}, {cos}.
 */
const w = world;
const act = doWorld;

const everyone = [...GW_TAGS];
/** Plan §0: the seats of a side, with the countries that come later. */
const CENTRAL: GwTag[] = ["DEU", "AUH", "OTT", "BGR"];
const ENTENTE: GwTag[] = ["GBR", "RUS", "FRA", "ITA", "SRB", "USA"];

/** Forms of government of the four seats: nothing else names the seat. */
const REGIMES: Readonly<Partial<Record<GwTag, readonly string[]>>> = {
  DEU: ["empire", "republic"],
  GBR: ["liberal", "coalition", "war_cabinet", "national"],
  AUH: [
    "dual_monarchy",
    "karl",
    "ff_throne",
    "federation",
    "austria_republic",
    "crown_remnant",
  ],
  RUS: ["tsar", "crown", "regency", "rep", "provisional"],
  FRA: ["fra_republic", "fra_union", "fra_tiger", "fra_defeat"],
};
/** Scenes France's own seat writes for itself (lane ww166 W4): not for FRA. */
const noFra = (tags: GwTag[]): GwTag[] => tags.filter((t) => t !== "FRA");
const seatIs = (tag: GwTag) =>
  w({ is: "regime", of: [...(REGIMES[tag] ?? [])] });

/** Calendar only: a fixed day of the year (the US election). */
const dated = (from: string, to: string) => w({ is: "date", from, to });
/** Whole months of war; `own`: since the seat's country came in (ww170). */
const months = (min?: number, max?: number) =>
  w({ is: "war_months", min, max });
const ownMonths = (min?: number, max?: number) =>
  w({ is: "war_months", own: true, min, max });
/** Chapters since a country came in: news of an entry is fresh. */
const inWar = (tag: GwTag, min?: number, max?: number) =>
  w({ is: "in_war", tag, min, max });
const neutral = (tag: GwTag) => w({ is: "neutral", tag });
const entered = (tag: GwTag, side?: GwSide) =>
  w(side === undefined ? { is: "entered", tag } : { is: "entered", tag, side });
const side = (...of: (GwSide | "neutral")[]) => w({ is: "side", of });
const known = (id: GwSecret) => w({ is: "known", id });
const exists = (id: string): GwCond => ({ kind: "secret", id });
const central = side("central");
const entente = side("entente");
const fighting = side("central", "entente");
const war = w({ is: "war" });
const atGbr: GwCond = { kind: "at_war", tag: "GBR" };

const why = (key: string): GwEffect => ({ kind: "reason", key });
const trust = (tag: GwTag, delta: number): GwEffect => ({
  kind: "trust",
  tag,
  delta,
});
const money = (delta: number): GwEffect => ({
  kind: "gauge",
  gauge: "money",
  delta,
});
const shells = (delta: number): GwEffect => ({
  kind: "gauge",
  gauge: "shells",
  delta,
});
const authority = (delta: number) => act({ do: "authority", delta });
const manpower = (delta: number) => act({ do: "manpower", delta });
const shipping = (delta: number) => act({ do: "shipping", delta });
const reveal = (id: GwSecret): GwEffect => ({
  kind: "maybe",
  when: exists(id),
  then: [act({ do: "reveal", id })],
});

/** The same act, seen from each side; a neutral seat does neither. */
function bySide(forCentral: GwEffect[], forEntente: GwEffect[]): GwEffect[] {
  return [
    { kind: "maybe", when: central, then: forCentral },
    { kind: "maybe", when: entente, then: forEntente },
  ];
}
/** A price in the seat's side's name, kept under GW_ENTRIES' honest best. */
function price(tag: GwTag, c: number, e: number): GwEffect[] {
  const offer = (value: number) =>
    value === 0 ? [] : [act({ do: "offer", tag, value })];
  return bySide(offer(c), offer(e));
}
/** Readiness: the side that wants the neutral in pushes, the other holds. */
function sway(tag: GwTag, c: number, e: number): GwEffect[] {
  const move = (delta: number) =>
    delta === 0 ? [] : [act({ do: "readiness", tag, delta })];
  return bySide(move(c), move(e));
}
/** Trust with the seat's own side (its own row is never read). */
function allies(delta: number): GwEffect[] {
  return bySide(
    [trust("DEU", delta), trust("AUH", delta)],
    [trust("FRA", delta), trust("GBR", delta), trust("RUS", delta)],
  );
}
/** The net tightens for the Entente's seat and loosens for the Central's. */
function net(delta: number): GwEffect[] {
  return bySide(
    [act({ do: "blockade", delta: -delta })],
    [act({ do: "blockade", delta })],
  );
}

const fm: GwCastRule = { any_of: [{ office: "foreign" }, { favourite: true }] };
const cos: GwCastRule = {
  any_of: [{ office: "chief_of_staff" }, { favourite: true }],
};
const fin: GwCastRule = {
  any_of: [{ office: "finance" }, { favourite: true }],
};

const opt = (
  id: string,
  tell: string[],
  effects: GwEffect[],
  when?: GwCond,
): GwOption =>
  when === undefined ? { id, tell, effects } : { id, tell, effects, when };

const v = (id: string, when?: GwCond): GwVariant =>
  when === undefined ? { id } : { id, when };

/** A decision: once a game, when its state holds, the first option by default. */
function decision(
  id: string,
  nation: GwTag[],
  when: GwCond[],
  cast: GwScene["cast"],
  salience: number,
  tags: GwScene["tags"],
  variants: GwVariant[],
  options: GwOption[],
): GwScene {
  return {
    id,
    nation,
    kind: "proposal",
    when: all(...when),
    cast,
    salience,
    tags,
    once: true,
    variants,
    fallback: options[0].id,
    options,
  };
}

/** Comes again, `cooldown` chapters on, only when `fresh` has a body to show. */
function again(scene: GwScene, fresh: GwCond, cooldown: number): GwScene {
  const seen: GwCond = { kind: "seen", scene: scene.id };
  return {
    ...scene,
    once: false,
    cooldown,
    when: all(scene.when!, any(not(seen), fresh)),
  };
}

/** Read only: what reached every desk, stamped. */
function report(
  id: string,
  when: GwCond[],
  salience: number,
  tags: GwScene["tags"],
  stamp: GwStamp,
  source: GwSource,
  variants: GwVariant[],
): GwScene {
  return {
    id,
    nation: everyone,
    kind: "report",
    when: all(...when),
    cast: {},
    salience,
    tags,
    once: true,
    stamp,
    source,
    variants,
  };
}

const ITALY: GwScene[] = [
  decision(
    "gw_o_ita_asks",
    everyone,
    [months(3), neutral("ITA"), war],
    { fm },
    8,
    ["foreign"],
    [
      v("price_list", all(known("ita_price_list"), war)),
      v("understanding", all(known("ita_fra_understanding"), war)),
      v("central", central),
      v("base"),
    ],
    [
      opt("wait", [], [why("o_ita_waited")]),
      opt(
        "low_price",
        ["price_modest", "entry"],
        [...price("ITA", 1, 2), ...sway("ITA", -3, 5)],
      ),
      opt(
        "high_price",
        ["price_full", "ally:-1", "entry"],
        [...price("ITA", 2, 3), ...sway("ITA", -5, 8), ...allies(-1)],
        memory("k_sonnino_bill"),
      ),
      opt(
        "ask_giolitti",
        ["entry"],
        [
          ...sway("ITA", -5, -3),
          reveal("ita_price_list"),
          why("o_ita_giolitti"),
        ],
        memory("k_giolitti_word"),
      ),
    ],
  ),
  again(
    decision(
      "gw_o_ita_trentino",
      CENTRAL,
      [ownMonths(5), neutral("ITA"), central],
      { fm },
      8,
      ["foreign"],
      [
        v("vienna_seat", all(seatIs("AUH"), neutral("ITA"))),
        v("late", ownMonths(8)),
        v("base"),
      ],
      [
        opt(
          "press_vienna",
          ["price_full", "ally:-1", "entry"],
          [
            ...price("ITA", 2, 0),
            ...sway("ITA", -10, 0),
            ...allies(-1),
            why("o_trentino_pressed"),
          ],
        ),
        opt(
          "half_trentino",
          ["price_modest", "entry"],
          [...price("ITA", 1, 0), ...sway("ITA", -3, 0)],
        ),
        opt(
          "refuse",
          ["ally:+1", "entry"],
          [...allies(1), ...sway("ITA", 5, 0), why("o_trentino_refused")],
        ),
      ],
    ),
    all(ownMonths(8), not(chose("gw_o_ita_trentino", "press_vienna"))),
    3,
  ),
  decision(
    "gw_o_ita_london",
    noFra(ENTENTE),
    [months(6), neutral("ITA"), entente],
    { fm },
    8,
    ["foreign"],
    [
      v("heard", memory("k_sonnino_bill")),
      v("russia", seatIs("RUS")),
      v("base"),
    ],
    [
      opt(
        "sign_all",
        ["price_full", "entry", "trust:-1"],
        [
          ...price("ITA", 0, 4),
          ...sway("ITA", 0, 10),
          trust("SRB", -1),
          why("o_london_signed"),
        ],
      ),
      opt(
        "cut_dalmatia",
        ["price_modest", "entry"],
        [...price("ITA", 0, 3), ...sway("ITA", 0, 5), why("o_london_cut")],
        memory("k_sonnino_bill"),
      ),
      opt(
        "refuse",
        ["ally:-1", "entry"],
        [...allies(-1), ...sway("ITA", 0, -5), why("o_london_refused")],
      ),
    ],
  ),
  report(
    "gw_o_ita_square",
    [months(7, 12), neutral("ITA")],
    6,
    ["foreign", "tension_up"],
    "unconfirmed",
    "press",
    [v("central", central), v("base")],
  ),
  report(
    "gw_o_ita_in",
    [inWar("ITA", 0, 3), entered("ITA")],
    8,
    ["foreign", "tension_up"],
    "confirmed",
    "press",
    [
      v(
        "bought",
        all(
          entered("ITA", "entente"),
          entente,
          chose("gw_o_ita_london", "sign_all"),
        ),
      ),
      v("triple", entered("ITA", "central")),
      v("ally_in", all(entered("ITA", "entente"), entente)),
      v("turned", all(entered("ITA", "entente"), central)),
      v("base"),
    ],
  ),
  report(
    "gw_o_ita_stays",
    [months(13), neutral("ITA"), w({ is: "offered", tag: "ITA", max: 2 })],
    6,
    ["foreign", "tension_down"],
    "confirmed",
    "press",
    [v("central", central), v("base")],
  ),
];

const OTTOMAN: GwScene[] = [
  decision(
    "gw_o_ott_ships",
    ["GBR", "DEU"],
    [neutral("OTT"), any(months(undefined, 3), { kind: "temp", min: 5 })],
    { fm },
    8,
    ["foreign", "tension_up"],
    [
      v("gbr_war", all(seatIs("GBR"), entente)),
      v("gbr", seatIs("GBR")),
      v("base"),
    ],
    [
      opt(
        "keep_ships",
        ["entry"],
        [
          {
            kind: "maybe",
            when: seatIs("GBR"),
            then: [act({ do: "readiness", tag: "OTT", delta: 10 })],
          },
          {
            kind: "maybe",
            when: seatIs("DEU"),
            then: [act({ do: "readiness", tag: "OTT", delta: -5 })],
          },
          why("o_ships_kept"),
        ],
      ),
      opt(
        "pay_back",
        ["money:-1", "entry"],
        [
          money(-1),
          act({ do: "readiness", tag: "OTT", delta: -3 }),
          why("o_ships_paid"),
        ],
      ),
      opt(
        "give_ships",
        ["trust:+1", "entry"],
        [
          trust("OTT", 1),
          {
            kind: "maybe",
            when: seatIs("GBR"),
            then: [act({ do: "readiness", tag: "OTT", delta: -10 })],
          },
          {
            kind: "maybe",
            when: seatIs("DEU"),
            then: [act({ do: "readiness", tag: "OTT", delta: 10 })],
          },
          why("o_ships_given"),
        ],
      ),
    ],
  ),
  decision(
    "gw_o_ott_price",
    everyone,
    [months(undefined, 5), neutral("OTT"), any(fighting, months(2))],
    { fm },
    7,
    ["foreign"],
    [
      v("fra", all(seatIs("FRA"), entente)),
      v("central", central),
      v("entente", entente),
      v("base"),
    ],
    [
      opt("wait", [], [why("o_ott_waited")]),
      opt(
        "loan",
        ["money:-1", "price_modest", "entry"],
        [money(-1), ...price("OTT", 2, 1), ...sway("OTT", 5, -5)],
        fighting,
      ),
      opt(
        "territory",
        ["price_full", "ally:-1", "entry"],
        [
          ...price("OTT", 3, 2),
          ...sway("OTT", 8, -8),
          ...allies(-1),
          why("o_ott_land"),
        ],
        all(fighting, memory("k_talat_hedge")),
      ),
    ],
  ),
  report(
    "gw_o_ott_in",
    [inWar("OTT", 0, 3), entered("OTT", "central")],
    7,
    ["foreign", "tension_up"],
    "confirmed",
    "press",
    [
      v("ships", all(seatIs("GBR"), chose("gw_o_ott_ships", "keep_ships"))),
      v("central", central),
      v("base"),
    ],
  ),
  decision(
    "gw_o_ott_peace",
    ENTENTE,
    [
      months(30),
      exists("ott_peace_feelers"),
      memory("k_talat_feelers"),
      entered("OTT", "central"),
      entente,
    ],
    { fm },
    6,
    ["foreign", "tension_down"],
    [v("ahead", w({ is: "score", min: 15 })), v("base")],
    [
      opt("decline", ["ally:+1"], [...allies(1), why("o_ott_declined")]),
      opt(
        "listen",
        [],
        [act({ do: "reveal", id: "ott_peace_feelers" }), why("o_ott_listen")],
      ),
      opt(
        "offer_straits_neutral",
        ["ally:-1"],
        [...allies(-1), why("o_ott_straits")],
      ),
    ],
  ),
];

const BULGARIA: GwScene[] = [
  decision(
    "gw_o_bgr_macedonia",
    everyone,
    [ownMonths(5), neutral("BGR"), fighting],
    { fm },
    7,
    ["foreign"],
    [
      v("signed", all(known("bgr_macedonia_signed"), fighting)),
      v("central", central),
      v("base"),
    ],
    [
      opt("wait", [], [why("o_bgr_waited")]),
      opt(
        "press_serbia",
        ["price_modest", "trust:-1", "entry"],
        [
          ...price("BGR", 2, 1),
          ...sway("BGR", 5, -5),
          trust("SRB", -1),
          why("o_bgr_serbia"),
        ],
      ),
      opt(
        "promise_all",
        ["price_full", "ally:-1", "entry"],
        [
          ...price("BGR", 4, 2),
          ...sway("BGR", 8, -8),
          ...allies(-1),
          trust("SRB", -1),
          why("o_bgr_all"),
        ],
        memory("k_ferdinand_bargain"),
      ),
    ],
  ),
  report(
    "gw_o_bgr_loan",
    [months(5, 13), neutral("BGR")],
    4,
    ["foreign"],
    "unconfirmed",
    "agents",
    [v("berlin", exists("bgr_loan_berlin")), v("base")],
  ),
  report(
    "gw_o_bgr_in",
    [inWar("BGR", 0, 3), entered("BGR")],
    7,
    ["foreign", "tension_up"],
    "confirmed",
    "press",
    [
      v(
        "after_serbia",
        all(entered("BGR", "central"), w({ is: "out", tag: "SRB" })),
      ),
      v("with_entente", entered("BGR", "entente")),
      v("central", all(entered("BGR", "central"), central)),
      v("base"),
    ],
  ),
];

const shellsPromise = {
  who: { person: "rou_bratianu" },
  key: "p_rou_shells",
} as const;

const ROMANIA: GwScene[] = [
  decision(
    "gw_o_rou_transylvania",
    everyone,
    [ownMonths(5), neutral("ROU"), fighting],
    { fm },
    7,
    ["foreign"],
    [
      v("treaty_dead", all(known("rou_treaty_dead"), fighting)),
      v("central", central),
      v("base"),
    ],
    [
      opt("wait", [], [why("o_rou_waited")]),
      opt(
        "promise_land",
        ["price_full", "ally:-1", "entry"],
        [
          ...price("ROU", 2, 3),
          ...sway("ROU", -5, 8),
          ...allies(-1),
          why("o_rou_land"),
        ],
        memory("k_bratianu_maps"),
      ),
      opt(
        "press_vienna",
        ["price_modest", "entry"],
        [...price("ROU", 1, 1), ...sway("ROU", -3, 3), why("o_rou_budapest")],
      ),
    ],
  ),
  decision(
    "gw_o_rou_grain",
    everyone,
    [
      ownMonths(5),
      neutral("ROU"),
      fighting,
      any({ kind: "gauge", gauge: "bread", max: 2 }, entente),
    ],
    { fm, fin },
    6,
    ["home"],
    [
      v("hungry", all(central, { kind: "gauge", gauge: "bread", max: 1 })),
      v("central", central),
      v("base"),
    ],
    [
      opt(
        "buy_some",
        ["money:-1", "blockade"],
        [money(-1), ...net(1), trust("ROU", 1)],
      ),
      opt(
        "buy_all",
        ["money:-2", "blockade", "trust:+1"],
        [money(-2), ...net(2), trust("ROU", 1), why("o_rou_grain_all")],
      ),
      opt("leave", [], [why("o_rou_grain_left")]),
    ],
  ),
  decision(
    "gw_o_rou_moment",
    everyone,
    [
      ownMonths(12),
      neutral("ROU"),
      fighting,
      w({ is: "battle", theatre: "east", of: ["advance", "break"] }),
    ],
    { fm, cos },
    8,
    ["foreign", "tension_up"],
    [
      v("shell_gap", all(known("rou_shell_gap"), entente)),
      v("central", central),
      v("base"),
    ],
    [
      opt("wait", [], [why("o_rou_moment_waited")]),
      opt(
        "press_now",
        ["entry"],
        [...sway("ROU", -5, 10), reveal("rou_shell_gap"), why("o_rou_pressed")],
      ),
      opt(
        "supply_promise",
        ["shells:-1", "price_full", "entry"],
        [
          shells(-1),
          ...price("ROU", 0, 4),
          ...sway("ROU", 0, 12),
          { kind: "keep_promise", ...shellsPromise },
          why("o_rou_supply"),
        ],
        memory("k_marie_letter"),
      ),
    ],
  ),
  report(
    "gw_o_rou_in",
    [inWar("ROU", 0, 3), entered("ROU")],
    8,
    ["foreign", "tension_up"],
    "confirmed",
    "press",
    [
      v("with_central", entered("ROU", "central")),
      v("foe", all(entered("ROU", "entente"), central)),
      v("friend", all(entered("ROU", "entente"), entente)),
      v("base"),
    ],
  ),
  report(
    "gw_o_rou_falls",
    [entered("ROU", "entente"), w({ is: "out", tag: "ROU" })],
    6,
    ["foreign"],
    "confirmed",
    "press",
    [
      v(
        "broken",
        all(
          { kind: "promise", ...shellsPromise, broken: true },
          entered("ROU", "entente"),
        ),
      ),
      v("central", central),
      v("base"),
    ],
  ),
];

const GREECE: GwScene[] = [
  decision(
    "gw_o_grc_salonika",
    noFra(ENTENTE),
    [
      neutral("GRC"),
      entente,
      any(flag("w_serbia_fallen"), entered("BGR", "central")),
    ],
    { fm, cos },
    7,
    ["foreign", "tension_up"],
    [
      v("king_heard", memory("k_constantine_no")),
      v("serbia_gone", flag("w_serbia_fallen")),
      v("base"),
    ],
    [
      opt(
        "small_landing",
        ["manpower:-1", "entry"],
        [
          manpower(-1),
          act({ do: "readiness", tag: "GRC", delta: 3 }),
          why("o_grc_small"),
        ],
      ),
      opt(
        "full_landing",
        ["manpower:-3", "ally:+1", "trust:-1"],
        [
          manpower(-3),
          ...allies(1),
          trust("GRC", -1),
          setFlag("f_o_salonika_full"),
          why("o_grc_full"),
        ],
      ),
      opt(
        "ask_king",
        ["trust:+1", "ally:-1"],
        [trust("GRC", 1), ...allies(-1), why("o_grc_king_asked")],
        memory("k_constantine_no"),
      ),
    ],
  ),
  decision(
    "gw_o_grc_king",
    everyone,
    [ownMonths(7), neutral("GRC"), fighting],
    { fm },
    6,
    ["foreign"],
    [
      v("letters", all(known("grc_king_letters"), fighting)),
      v("central", central),
      v("base"),
    ],
    [
      opt("wait", [], [why("o_grc_waited")]),
      opt(
        "back_venizelos",
        ["price_modest", "entry"],
        [
          ...price("GRC", 0, 2),
          ...sway("GRC", -3, 8),
          setFlag("f_o_backed_venizelos"),
          why("o_grc_venizelos"),
        ],
        memory("k_venizelos_call"),
      ),
      opt(
        "back_king",
        ["trust:+1", "entry"],
        [
          trust("GRC", 1),
          ...price("GRC", 1, 0),
          ...sway("GRC", -5, -5),
          reveal("grc_king_letters"),
          why("o_grc_king_backed"),
        ],
        memory("k_constantine_no"),
      ),
    ],
  ),
  report(
    "gw_o_grc_schism",
    [
      months(20),
      any(flag("w_serbia_fallen"), entered("BGR", "central")),
      neutral("GRC"),
    ],
    5,
    ["foreign"],
    "unconfirmed",
    "press",
    [
      v("backed", all(flag("f_o_backed_venizelos"), neutral("GRC"))),
      v("central", central),
      v("base"),
    ],
  ),
  report(
    "gw_o_grc_in",
    [inWar("GRC", 0, 3), entered("GRC", "entente")],
    5,
    ["foreign", "tension_up"],
    "confirmed",
    "press",
    [
      v("landed", all(flag("f_o_salonika_full"), entente)),
      v("central", central),
      v("base"),
    ],
  ),
];

const JAPAN: GwScene[] = [
  report(
    "gw_o_jpn_tsingtao",
    [inWar("JPN", 0, 4), entered("JPN")],
    6,
    ["foreign", "tension_up"],
    "confirmed",
    "press",
    [v("central", central), v("base")],
  ),
  decision(
    "gw_o_jpn_list",
    everyone,
    [inWar("JPN", 3), entered("JPN", "entente"), fighting],
    { fm },
    5,
    ["foreign"],
    [
      v("seven", all(known("jpn_china_list"), fighting)),
      v("central", central),
      v("base"),
    ],
    [
      opt("silence", [], [why("o_jpn_silent")]),
      opt(
        "protest",
        ["trust:-1", "america"],
        [
          trust("JPN", -1),
          ...bySide(
            [act({ do: "readiness", tag: "USA", delta: -2 })],
            [act({ do: "readiness", tag: "USA", delta: 2 })],
          ),
          why("o_jpn_protest"),
        ],
      ),
      opt(
        "ask_ships",
        ["trust:+1"],
        [trust("JPN", 1), setFlag("f_o_jpn_ships_asked"), why("o_jpn_asked")],
        all(entente, memory("k_kato_bill")),
      ),
    ],
  ),
  decision(
    "gw_o_jpn_ships",
    ENTENTE,
    [entered("JPN", "entente"), entente, w({ is: "uboat", min: 2 })],
    { fm },
    5,
    ["foreign"],
    [v("asked", flag("f_o_jpn_ships_asked")), v("base")],
    [
      opt("decline", ["trust:-1"], [trust("JPN", -1), why("o_shandong_kept")]),
      opt(
        "pay_shandong",
        ["trust:+1", "america", "shipping:-2"],
        [
          trust("JPN", 1),
          trust("USA", -1),
          shipping(-2),
          why("o_shandong_paid"),
        ],
        memory("k_kato_bill"),
      ),
      opt(
        "partial",
        ["shipping:-1", "money:-1"],
        [shipping(-1), money(-1), why("o_jpn_partial")],
      ),
    ],
  ),
];

const AMERICA: GwScene[] = [
  again(
    decision(
      "gw_o_usa_loans",
      everyone,
      [
        ownMonths(5),
        neutral("USA"),
        fighting,
        { kind: "gauge", gauge: "money", max: 2 },
      ],
      { fin, fm },
      8,
      ["foreign"],
      [
        v("cliff", all(known("usa_credit_cliff"), entente, neutral("USA"))),
        v("deep", all(entente, ownMonths(23))),
        v("central", central),
        v("base"),
      ],
      [
        opt("small_loan", ["money:+1"], [money(1)]),
        opt(
          "big_loan",
          ["money:+2", "america"],
          [
            money(2),
            act({ do: "readiness", tag: "USA", delta: 4 }),
            setFlag("f_o_usa_big_loan"),
            why("o_usa_big"),
          ],
          entente,
        ),
        opt(
          "refuse_terms",
          ["authority:+5"],
          [authority(5), why("o_usa_refused")],
        ),
      ],
    ),
    all(entente, ownMonths(23)),
    12,
  ),
  again(
    decision(
      "gw_o_usa_arms",
      CENTRAL,
      [ownMonths(5), neutral("USA"), central],
      { fm },
      6,
      ["foreign", "tension_up"],
      [v("liner", flag("w_liner_sunk")), v("second", ownMonths(11)), v("base")],
      [
        opt(
          "protest",
          ["america"],
          [
            act({ do: "readiness", tag: "USA", delta: 2 }),
            why("o_arms_protest"),
          ],
        ),
        opt(
          "buy_up_plants",
          ["money:-1", "shells:+1"],
          [money(-1), shells(1), why("o_arms_plants")],
        ),
        opt(
          "sabotage_no",
          ["america"],
          [
            act({ do: "readiness", tag: "USA", delta: -3 }),
            why("o_arms_no_sabotage"),
          ],
        ),
      ],
    ),
    ownMonths(11),
    12,
  ),
  report(
    "gw_o_usa_election",
    [dated("1916-11", "1917-01"), war, neutral("USA")],
    5,
    ["foreign"],
    "confirmed",
    "press",
    [
      v("creditor", all(flag("f_o_usa_big_loan"), entente)),
      v("central", central),
      v("base"),
    ],
  ),
];

const SMALL: GwScene[] = [
  again(
    decision(
      "gw_o_nld_food",
      everyone,
      [ownMonths(5), fighting, w({ is: "blockade", min: 2 })],
      { fm, fin },
      5,
      ["foreign"],
      [
        v("unrestricted", all(flag("w_unrestricted"), fighting)),
        v("central", central),
        v("base"),
      ],
      [
        opt("quota", ["blockade"], [...net(1), trust("NLD", 1)]),
        opt(
          "cut_off",
          ["blockade", "trust:-1"],
          [...net(2), trust("NLD", -1), why("o_nld_cut")],
        ),
        opt(
          "buy_through",
          ["money:-1", "blockade"],
          [money(-1), ...net(1), why("o_nld_through")],
        ),
      ],
    ),
    flag("w_unrestricted"),
    12,
  ),
  decision(
    "gw_o_swe_iron",
    everyone,
    [ownMonths(5), war, fighting],
    { fm },
    5,
    ["foreign"],
    [v("russia_road", seatIs("RUS")), v("central", central), v("base")],
    [
      opt(
        "quiet_deal",
        ["money:-1", "trust:+1"],
        [money(-1), trust("SWE", 1), why("o_swe_deal")],
      ),
      opt(
        "press_stockholm",
        ["blockade", "trust:-1"],
        [...net(1), trust("SWE", -1), why("o_swe_press")],
      ),
      opt("leave", [], [why("o_swe_left")]),
    ],
  ),
  decision(
    "gw_o_che_coal",
    everyone,
    [ownMonths(14), war, fighting],
    { fm, fin },
    4,
    ["foreign"],
    [v("central", central), v("base")],
    [
      opt("supply", ["money:-1", "trust:+1"], [money(-1), trust("CHE", 1)]),
      opt(
        "squeeze",
        ["money:+1", "trust:-1"],
        [money(1), trust("CHE", -1), why("o_che_squeeze")],
      ),
      opt(
        "trade_channel",
        ["trust:+1"],
        [trust("CHE", 1), why("o_che_channel")],
        memory("k_ador_lists"),
      ),
    ],
  ),
  decision(
    "gw_o_dnk_belt",
    everyone,
    [months(undefined, 11), any(atGbr, seatIs("GBR"))],
    { fm },
    5,
    ["foreign"],
    [v("central", central), v("base")],
    [
      opt("accept", [], [why("o_belt_accepted")]),
      opt("protest", ["trust:-1"], [trust("DNK", -1), why("o_belt_protest")]),
      opt(
        "quiet_word",
        ["trust:+1"],
        [trust("DNK", 1), why("o_belt_word")],
        memory("k_andersen_cousins"),
      ),
    ],
  ),
  again(
    decision(
      "gw_o_nor_tonnage",
      everyone,
      [ownMonths(12), fighting, w({ is: "shipping", min: 3 })],
      { fm },
      5,
      ["foreign"],
      [
        v("sunk", all(entente, w({ is: "shipping", min: 5 }))),
        v("central", central),
        v("base"),
      ],
      [
        opt(
          "charter",
          ["money:-1", "trust:+1"],
          [money(-1), trust("NOR", 1), ...bySide([], [shipping(-1)])],
        ),
        opt("warn_off", ["trust:-1"], [trust("NOR", -1), why("o_nor_warned")]),
        opt(
          "buy_ships",
          ["money:-2", "shipping:-2"],
          [money(-2), shipping(-2), why("o_nor_bought")],
          entente,
        ),
      ],
    ),
    all(entente, w({ is: "shipping", min: 5 })),
    12,
  ),
  decision(
    "gw_o_per_oil",
    everyone,
    [
      ownMonths(5),
      fighting,
      any(
        w({ is: "open", theatre: "mesopotamia" }),
        w({ is: "open", theatre: "caucasus" }),
      ),
    ],
    { fm },
    4,
    ["foreign"],
    [v("central", central), v("base")],
    [
      opt("ignore", [], [why("o_per_ignored")]),
      opt(
        "guard_oil",
        ["manpower:-1", "trust:-1"],
        [manpower(-1), trust("IRN", -1), why("o_per_guard")],
      ),
      opt("pay_khans", ["money:-1"], [money(-1), why("o_per_khans")]),
    ],
  ),
];

/** The neutrals' bargains are the war's: a ceasefire closes them all. */
const untilTheGuns = (s: GwScene): GwScene => {
  const quiet = not(w({ is: "armistice" }));
  return {
    ...s,
    stage: s.stage ?? ["crisis", "y1914", "war"],
    when: s.when === undefined ? quiet : all(s.when, quiet),
  };
};

export const GW_NEUTRAL_SCENES: readonly GwScene[] = [
  ...ITALY,
  ...OTTOMAN,
  ...BULGARIA,
  ...ROMANIA,
  ...GREECE,
  ...JAPAN,
  ...AMERICA,
  ...SMALL,
].map(untilTheGuns);
