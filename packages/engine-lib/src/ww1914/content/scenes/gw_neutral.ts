import type {
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

/**
 * Common scenes, the neutrals' share (plan: ww135-plan-common.md §6): the
 * gw_o_ scenes any seat meets. Data only; the text is in
 * resources/ww1914/ko/common.neutral.json, written without a form of address
 * and with the seat's own people only as {fm}, {fin}, {cos}.
 *
 * Lane Y's words (world date, neutral, side, offered; offer by side, blockade,
 * shipping; the new secrets) are on w135-world, not on this file's base, so
 * they pass through `w` and `act`, the only casts here. Type those two after
 * the merge.
 */
const w = (of: unknown) => ({ kind: "world", of }) as unknown as GwCond;
const act = (of: unknown) => ({ kind: "world", of }) as unknown as GwEffect;

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
};
const seatIs = (tag: GwTag) => w({ is: "regime", of: REGIMES[tag] });

const dated = (from: string, to: string) => w({ is: "date", from, to });
const neutral = (tag: GwTag) => w({ is: "neutral", tag });
const entered = (tag: GwTag, side?: GwSide) =>
  w(side === undefined ? { is: "entered", tag } : { is: "entered", tag, side });
const side = (...of: (GwSide | "neutral")[]) => w({ is: "side", of });
const known = (id: string) => w({ is: "known", id });
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
const reveal = (id: string): GwEffect => ({
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

/** A decision: once a game, inside its dates, the first option by default. */
function decision(
  id: string,
  nation: GwTag[],
  from: string,
  to: string,
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
    when: all(dated(from, to), ...when),
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
  from: string,
  to: string,
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
    when: all(dated(from, to), ...when),
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
    "1914-11",
    "1915-05",
    [neutral("ITA"), war],
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
      "1915-01",
      "1915-05",
      [neutral("ITA"), central],
      { fm },
      8,
      ["foreign"],
      [
        v("vienna_seat", all(seatIs("AUH"), neutral("ITA"))),
        v("late", dated("1915-04", "1915-05")),
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
    all(
      dated("1915-04", "1915-05"),
      not(chose("gw_o_ita_trentino", "press_vienna")),
    ),
    3,
  ),
  decision(
    "gw_o_ita_london",
    ENTENTE,
    "1915-02",
    "1915-05",
    [neutral("ITA"), entente],
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
    "1915-04",
    "1915-06",
    [neutral("ITA")],
    6,
    ["foreign", "tension_up"],
    "unconfirmed",
    "press",
    [v("central", central), v("base")],
  ),
  report(
    "gw_o_ita_in",
    "1915-01",
    "1915-12",
    [entered("ITA")],
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
    "1915-09",
    "1916-06",
    [neutral("ITA"), w({ is: "offered", tag: "ITA", max: 2 })],
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
    "1914-07",
    "1914-10",
    [neutral("OTT"), any(war, { kind: "temp", min: 5 })],
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
    "1914-08",
    "1914-12",
    [neutral("OTT"), any(fighting, dated("1914-10", "1914-12"))],
    { fm },
    7,
    ["foreign"],
    [v("central", central), v("entente", entente), v("base")],
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
    "1914-10",
    "1915-06",
    [entered("OTT", "central")],
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
    "1917-07",
    "1918-12",
    [
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
    "1915-01",
    "1915-10",
    [neutral("BGR"), fighting],
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
    "1915-01",
    "1915-08",
    [neutral("BGR")],
    4,
    ["foreign"],
    "unconfirmed",
    "agents",
    [v("berlin", exists("bgr_loan_berlin")), v("base")],
  ),
  report(
    "gw_o_bgr_in",
    "1915-08",
    "1916-06",
    [entered("BGR")],
    7,
    ["foreign", "tension_up"],
    "confirmed",
    "press",
    [
      v(
        "after_serbia",
        all(
          entered("BGR", "central"),
          w({ is: "out", tag: "SRB" }),
          dated("1915-08", "1916-06"),
        ),
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
    "1915-01",
    "1916-06",
    [neutral("ROU"), fighting],
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
    "1915-01",
    "1916-06",
    [
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
    "1916-03",
    "1916-10",
    [
      neutral("ROU"),
      fighting,
      any(
        w({ is: "battle", theatre: "east", of: ["advance", "break"] }),
        dated("1916-06", "1916-10"),
      ),
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
    "1916-05",
    "1917-03",
    [entered("ROU")],
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
    "1916-09",
    "1917-08",
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
    ENTENTE,
    "1915-08",
    "1916-03",
    [entente, any(flag("w_serbia_fallen"), entered("BGR", "central"))],
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
    "1915-03",
    "1916-10",
    [neutral("GRC"), fighting],
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
    "1916-08",
    "1917-03",
    [neutral("GRC")],
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
    "1917-03",
    "1917-12",
    [entered("GRC", "entente")],
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
    "1914-08",
    "1914-12",
    [entered("JPN")],
    6,
    ["foreign", "tension_up"],
    "confirmed",
    "press",
    [v("central", central), v("base")],
  ),
  decision(
    "gw_o_jpn_list",
    everyone,
    "1915-01",
    "1915-06",
    [entered("JPN", "entente"), fighting],
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
    "1917-01",
    "1917-06",
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
      "1915-01",
      "1917-03",
      [neutral("USA"), fighting, { kind: "gauge", gauge: "money", max: 2 }],
      { fin, fm },
      8,
      ["foreign"],
      [
        v("cliff", all(known("usa_credit_cliff"), entente, neutral("USA"))),
        v("deep", all(entente, dated("1916-07", "1917-03"))),
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
    all(entente, dated("1916-07", "1917-03")),
    12,
  ),
  again(
    decision(
      "gw_o_usa_arms",
      CENTRAL,
      "1915-01",
      "1916-06",
      [neutral("USA"), central],
      { fm },
      6,
      ["foreign", "tension_up"],
      [
        v("liner", flag("w_liner_sunk")),
        v("second", dated("1915-07", "1916-06")),
        v("base"),
      ],
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
    dated("1915-07", "1916-06"),
    12,
  ),
  report(
    "gw_o_usa_election",
    "1916-11",
    "1917-01",
    [neutral("USA")],
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
      "1915-01",
      "1917-12",
      [fighting, w({ is: "blockade", min: 2 })],
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
    "1915-01",
    "1917-12",
    [war, fighting],
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
    "1915-10",
    "1918-06",
    [war, fighting],
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
    "1914-08",
    "1915-06",
    [any(atGbr, seatIs("GBR"))],
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
      "1916-07",
      "1917-12",
      [fighting, w({ is: "shipping", min: 3 })],
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
    "1915-01",
    "1916-12",
    [
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
  report(
    "gw_o_prt_ships",
    "1916-02",
    "1916-06",
    [war],
    3,
    ["foreign"],
    "confirmed",
    "press",
    [v("central", central), v("base")],
  ),
];

export const GW_NEUTRAL_SCENES: readonly GwScene[] = [
  ...ITALY,
  ...OTTOMAN,
  ...BULGARIA,
  ...ROMANIA,
  ...GREECE,
  ...JAPAN,
  ...AMERICA,
  ...SMALL,
];
