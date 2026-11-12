import type {
  GwGauge,
  GwInstitution,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GW_TAGS, GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  dropCard,
  flag,
  GwCond,
  GwEffect,
  GwScene,
  inst_,
  not,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";

/**
 * Scenes the war itself calls past 1914: the rungs of each country's ladder,
 * the sittings of the bodies that can say no, the prices of neutrals, the end.
 * Like world.ts they reach the desk only through `seat.scheduled`. Text is in
 * resources/ww1914/ko/common.war.json.
 */
const onlyCalled = flag("gw_world_called_only");
const everyone = [...GW_TAGS];

const gauge = (g: GwGauge, delta: number): GwEffect => ({
  kind: "gauge",
  gauge: g,
  delta,
});
const why = (key: string): GwEffect => ({ kind: "reason", key });
const calm = doWorld({ do: "calm" });
const authority = (delta: number) => doWorld({ do: "authority", delta });
const money: GwCond = { kind: "gauge", gauge: "money", min: 1 };

interface Opt {
  id: string;
  tell: string[];
  effects: GwEffect[];
  when?: GwCond;
}

const opt = (
  id: string,
  tell: string[],
  effects: GwEffect[],
  when?: GwCond,
): Opt =>
  when === undefined ? { id, tell, effects } : { id, tell, effects, when };

function called(
  id: string,
  nation: GwTag[],
  tags: GwScene["tags"],
  options: Opt[],
  over: Partial<GwScene> = {},
): GwScene {
  return {
    id,
    nation,
    kind: "proposal",
    when: onlyCalled,
    cast: {},
    salience: 8,
    tags,
    variants: [{ id: "base" }],
    fallback: options[options.length - 1].id,
    options,
    ...over,
  };
}

/** A rung of the ladder: the last option is always there and asks nothing. */
function rung(id: string, nation: GwTag, options: Opt[]): GwScene {
  return called(id, [nation], ["home", "tension_down"], options, {
    salience: 9,
    fallback: options[0].id,
  });
}

/**
 * The top of the ladder: the next form of government, or the memoir. `ends`:
 * the next form has no place for the person, so handing over ends his game
 * too (ww197, owner's A).
 */
function top(
  id: string,
  nation: GwTag,
  next: string[],
  price: string[],
  ends = false,
): GwScene {
  return called(
    id,
    [nation],
    ["home", "tension_up"],
    [
      opt(
        "go_on",
        ["regime_change", ...price, ...(ends ? ["ends_game"] : [])],
        [doWorld({ do: "next_regime" })],
        world({ is: "regime", of: next }),
      ),
      opt("memoir", ["ends_game"], [doWorld({ do: "close_seat" })]),
    ],
    { salience: 9, fallback: "go_on" },
  );
}

const inst = (i: GwInstitution, d: number) => inst_(i, d);

const DEU_HOME: GwScene[] = [
  rung("gw_home_deu_1", "DEU", [
    opt("ration", ["order:+1", "money:-1"], [calm, gauge("money", -1)], money),
    opt(
      "unions",
      ["order:+1", "reichstag:+1", "army:-1"],
      [calm, inst("reichstag", 1), inst("army", -1)],
    ),
    opt("firm", ["army:+1"], [inst("army", 1), why("held_firm")]),
  ]),
  rung("gw_home_deu_2", "DEU", [
    opt(
      "kitchens",
      ["order:+1", "money:-1", "authority:-5"],
      [calm, gauge("money", -1), authority(-5)],
      money,
    ),
    opt(
      "suffrage",
      ["order:+1", "reichstag:+2", "army:-1", "authority:-10"],
      [calm, inst("reichstag", 2), inst("army", -1), authority(-10)],
    ),
    opt("firm", ["army:+1"], [inst("army", 1), why("held_firm")]),
  ]),
  rung("gw_home_deu_3", "DEU", [
    opt(
      "amnesty",
      ["order:+1", "army:-2"],
      [calm, inst("army", -2), why("amnesty_granted")],
    ),
    opt(
      "parliament",
      ["order:+1", "reichstag:+2", "army:-2", "authority:-15"],
      [calm, inst("reichstag", 2), inst("army", -2), authority(-15)],
    ),
    opt(
      "firm",
      ["army:+1", "morale:-1"],
      [inst("army", 1), gauge("morale", -1), why("held_firm")],
    ),
  ]),
  top("gw_home_deu_4", "DEU", ["empire"], ["army:-2"], true),
];

const GBR_HOME: GwScene[] = [
  rung("gw_home_gbr_1", "GBR", [
    opt(
      "arbitrate",
      ["order:+1", "money:-1"],
      [calm, gauge("money", -1)],
      money,
    ),
    opt(
      "dilution",
      ["order:+1", "commons:+1", "shells:-1"],
      [calm, inst("commons", 1), gauge("shells", -1)],
    ),
    opt("firm", ["commons:-1"], [inst("commons", -1), why("held_firm")]),
  ]),
  rung("gw_home_gbr_2", "GBR", [
    opt(
      "home_rule",
      ["order:+1", "opposition:-2", "vote"],
      [
        calm,
        inst("opposition", -2),
        doWorld({ do: "vote", issue: "home_rule" }),
      ],
    ),
    opt(
      "rent_act",
      ["order:+1", "money:-1", "cabinet:-1"],
      [calm, gauge("money", -1), inst("cabinet", -1)],
      money,
    ),
    opt(
      "firm",
      ["opposition:+1", "commons:-1"],
      [inst("opposition", 1), inst("commons", -1), why("held_firm")],
    ),
  ]),
  rung("gw_home_gbr_3", "GBR", [
    opt(
      "leave_rota",
      ["order:+1", "manpower:-3"],
      [calm, doWorld({ do: "manpower", delta: -3 })],
    ),
    opt(
      "ministry",
      ["order:+1", "cabinet:-1", "authority:-10"],
      [calm, inst("cabinet", -1), authority(-10)],
    ),
    opt("firm", ["morale:-1"], [gauge("morale", -1), why("held_firm")]),
  ]),
  {
    ...top(
      "gw_home_gbr_4",
      "GBR",
      ["liberal", "coalition", "war_cabinet"],
      ["authority:-10"],
    ),
    // ww187: the government falls in a vote while the Commons sits; with it
    // prorogued or dissolved, it falls in the cabinet room.
    variants: [
      {
        id: "shut",
        when: not(world({ is: "sits", id: "commons" })),
        assumes: { shut: ["commons"] },
      },
      { id: "base" },
    ],
  },
];

const AUH_HOME: GwScene[] = [
  rung("gw_home_auh_1", "AUH", [
    opt("zones", ["order:+1", "hungary:-1"], [calm, inst("hungary", -1)]),
    opt(
      "reichsrat",
      ["order:+1", "nations:+1", "council:-1"],
      [calm, inst("nations", 1), inst("council", -1)],
    ),
    opt(
      "firm",
      ["council:+1", "nations:-1"],
      [inst("council", 1), inst("nations", -1), why("held_firm")],
    ),
  ]),
  rung("gw_home_auh_2", "AUH", [
    opt(
      "grain_army",
      ["order:+1", "hungary:-2"],
      [calm, inst("hungary", -2), gauge("bread", 1)],
    ),
    opt(
      "amnesty",
      ["order:+1", "nations:+1", "authority:-10"],
      [calm, inst("nations", 1), authority(-10)],
    ),
    opt(
      "firm",
      ["nations:-1", "hungary:+1"],
      [inst("nations", -1), inst("hungary", 1), why("held_firm")],
    ),
  ]),
  rung("gw_home_auh_3", "AUH", [
    opt(
      "autonomy",
      ["order:+1", "nations:+2", "hungary:-2"],
      [calm, inst("nations", 2), inst("hungary", -2)],
    ),
    opt(
      "german_help",
      ["order:+1", "ally:+1", "council:-1"],
      [calm, inst("council", -1), { kind: "trust", tag: "DEU", delta: 1 }],
    ),
    opt("firm", ["morale:-1"], [gauge("morale", -1), why("held_firm")]),
  ]),
  top("gw_home_auh_4", "AUH", ["dual_monarchy", "karl"], ["hungary:-2"], true),
];

const RUS_HOME: GwScene[] = [
  rung("gw_home_rus_1", "RUS", [
    opt("wages", ["order:+1", "money:-1"], [calm, gauge("money", -1)], money),
    opt(
      "committees",
      ["order:+1", "duma:+1", "court:-1"],
      [calm, inst("duma", 1), inst("court", -1)],
    ),
    opt(
      "firm",
      ["court:+1", "duma:-1"],
      [inst("court", 1), inst("duma", -1), why("held_firm")],
    ),
  ]),
  rung("gw_home_rus_2", "RUS", [
    opt(
      "bread_trains",
      ["order:+1", "shells:-1"],
      [calm, gauge("shells", -1), gauge("bread", 1)],
    ),
    opt(
      "duma_ministry",
      ["order:+1", "duma:+2", "court:-2"],
      [calm, inst("duma", 2), inst("court", -2)],
    ),
    opt(
      "firm",
      ["court:+1", "ministers:-1"],
      [inst("court", 1), inst("ministers", -1), why("held_firm")],
    ),
  ]),
  rung("gw_home_rus_3", "RUS", [
    opt(
      "front_units",
      ["order:+1", "stavka:-1", "manpower:-3"],
      [calm, inst("stavka", -1), doWorld({ do: "manpower", delta: -3 })],
    ),
    opt(
      "responsible",
      ["order:+1", "duma:+2", "court:-3", "authority:-15"],
      [calm, inst("duma", 2), inst("court", -3), authority(-15)],
    ),
    opt("firm", ["morale:-1"], [gauge("morale", -1), why("held_firm")]),
  ]),
  top("gw_home_rus_4", "RUS", ["tsar"], ["court:-3"], true),
];

/** Britain is in: the papers still asking whether it should be go. */
const ENTRY_OVERTAKES = [
  dropCard("gbr_c_ultimatum"),
  dropCard("gbr_f_neutral_line"),
];

const BODIES: GwScene[] = [
  called(
    "gw_gbr_entry",
    ["GBR"],
    ["foreign", "tension_up"],
    [
      opt(
        "enter",
        ["vote", "ally:+1", "cabinet:-1"],
        [
          doWorld({ do: "vote", issue: "entry" }),
          doWorld({ do: "join", side: "entente" }),
          ...ENTRY_OVERTAKES,
        ],
        world({ is: "votes", issue: "entry", min: 0 }),
      ),
      opt(
        "force_it",
        ["cabinet:-3", "authority:-20"],
        [
          inst("cabinet", -3),
          authority(-20),
          doWorld({ do: "vote", issue: "entry" }),
          doWorld({ do: "join", side: "entente" }),
          ...ENTRY_OVERTAKES,
        ],
      ),
      opt(
        "wait",
        ["ally:-1"],
        [{ kind: "trust", tag: "FRA", delta: -1 }, why("entry_put_off")],
      ),
    ],
    {
      variants: [
        { id: "belgium", when: world({ is: "entered", tag: "BEL" }) },
        { id: "base" },
      ],
      fallback: "enter",
    },
  ),
  called(
    "gw_gbr_conscription",
    ["GBR"],
    ["home", "tension_up"],
    [
      opt(
        "conscript",
        ["vote", "manpower:+15", "order:-1"],
        [
          doWorld({ do: "vote", issue: "conscription" }),
          doWorld({ do: "manpower", delta: 15 }),
          gauge("order", -1),
          { kind: "flag", flag: "f_gbr_conscript" },
        ],
        world({ is: "votes", issue: "conscription", min: 0 }),
      ),
      opt(
        "derby",
        ["manpower:+6", "opposition:-1"],
        [doWorld({ do: "manpower", delta: 6 }), inst("opposition", -1)],
      ),
      opt(
        "volunteers",
        ["opposition:-2"],
        [inst("opposition", -2), why("kept_volunteers")],
      ),
    ],
  ),
  called(
    "gw_gbr_coalition",
    ["GBR"],
    ["home", "tension_up"],
    [
      opt(
        "coalition",
        ["regime_change", "opposition:+2"],
        [doWorld({ do: "regime", to: "coalition" })],
      ),
      opt(
        "alone",
        ["opposition:-2", "commons:-1"],
        [inst("opposition", -2), inst("commons", -1), why("kept_liberal")],
      ),
    ],
  ),
  called(
    "gw_gbr_war_cabinet",
    ["GBR"],
    ["home", "tension_up"],
    [
      opt(
        "small_cabinet",
        ["regime_change", "cabinet:+2"],
        [doWorld({ do: "regime", to: "war_cabinet" })],
      ),
      opt(
        "committees",
        ["cabinet:-1"],
        [inst("cabinet", -1), why("kept_committees")],
      ),
    ],
  ),
  called(
    "gw_blockade_paper",
    ["GBR"],
    ["war"],
    [
      opt(
        "tighten",
        ["blockade:+2", "america:-1"],
        [
          doWorld({ do: "blockade", delta: 2 }),
          doWorld({ do: "readiness", tag: "USA", delta: -4 }),
        ],
      ),
      opt(
        "neutrals",
        ["blockade:+1", "money:-1"],
        [doWorld({ do: "blockade", delta: 1 }), gauge("money", -1)],
        money,
      ),
      opt("as_it_is", [], [why("blockade_kept")]),
    ],
  ),
  called(
    "gw_uboat_first",
    ["DEU"],
    ["war", "tension_up"],
    [
      opt(
        "declare_zone",
        ["uboat:+1", "america:+1"],
        [doWorld({ do: "uboat", level: 1 })],
      ),
      opt("cruiser_rules", ["army:-1"], [inst("army", -1), why("uboats_held")]),
    ],
    { fallback: "declare_zone" },
  ),
  called(
    "gw_uboat_second",
    ["DEU"],
    ["war", "tension_up"],
    [
      opt(
        "unrestricted",
        ["uboat:+1", "america:+3", "reichstag:-1"],
        [doWorld({ do: "uboat", level: 2 }), inst("reichstag", -1)],
      ),
      opt("not_yet", ["army:-1"], [inst("army", -1), why("uboats_held")]),
    ],
  ),
  called(
    "gw_auh_quota",
    ["AUH"],
    ["home"],
    [
      opt(
        "pay_budapest",
        ["bread:+1", "money:-1", "hungary:+1"],
        [gauge("bread", 1), gauge("money", -1), inst("hungary", 1)],
        money,
      ),
      opt(
        "common_council",
        ["bread:+1", "hungary:-1", "council:+1"],
        [gauge("bread", 1), inst("hungary", -1), inst("council", 1)],
      ),
      opt("leave_it", ["bread:-1"], [gauge("bread", -1), why("quota_left")]),
    ],
  ),
  called(
    "gw_succession_auh",
    ["AUH"],
    ["home", "people"],
    [
      opt("oath", ["hungary:+1"], [inst("hungary", 1), why("karl_crowned")]),
      opt(
        "amnesty",
        ["nations:+1", "council:-1"],
        [inst("nations", 1), inst("council", -1), why("karl_amnesty")],
      ),
      opt(
        "army_first",
        ["council:+1"],
        [inst("council", 1), why("karl_takes_army")],
      ),
    ],
    { salience: 9 },
  ),
  called(
    "gw_auh_feeler",
    ["AUH"],
    ["foreign", "tension_down"],
    [
      opt(
        "write_paris",
        ["ally:-1", "talks"],
        [{ kind: "trust", tag: "DEU", delta: -1 }, doWorld({ do: "talks" })],
      ),
      opt(
        "tell_berlin",
        ["council:+1"],
        [inst("council", 1), { kind: "trust", tag: "DEU", delta: 1 }],
      ),
      opt("burn_it", [], [why("feeler_burned")]),
    ],
  ),
  called(
    "gw_rus_session",
    ["RUS"],
    ["home"],
    [
      opt(
        "open_session",
        ["money:+1", "duma:+1", "court:-1"],
        [gauge("money", 1), inst("duma", 1), inst("court", -1)],
      ),
      opt(
        "war_industry",
        ["shells:+1", "duma:+1", "ministers:-1"],
        [gauge("shells", 1), inst("duma", 1), inst("ministers", -1)],
      ),
      opt(
        "prorogue",
        ["duma:-2", "court:+1"],
        [inst("duma", -2), inst("court", 1)],
      ),
    ],
  ),
  called(
    "gw_rus_command",
    ["RUS"],
    ["war", "tension_up"],
    [
      opt(
        "take_command",
        ["court:+2", "ministers:-3", "duma:-1", "morale:+1"],
        [
          doWorld({ do: "personal_command", on: true }),
          inst("court", 2),
          inst("ministers", -3),
          inst("duma", -1),
          gauge("morale", 1),
        ],
      ),
      opt(
        "keep_grand_duke",
        ["court:-2", "ministers:+1"],
        [inst("court", -2), inst("ministers", 1)],
      ),
      opt(
        "new_commander",
        ["morale:-1", "court:+1", "ministers:+1"],
        [gauge("morale", -1), inst("court", 1), inst("ministers", 1)],
      ),
    ],
    {
      // ww187: called as the east line reaches Warsaw; the city's fall is
      // told only once it is the enemy's.
      variants: [
        {
          id: "fell",
          when: world({ is: "held", place: "warsaw", by: "foe" }),
          assumes: { held: { warsaw: "foe" } },
        },
        { id: "base" },
      ],
    },
  ),
  called(
    "gw_rus_court",
    ["RUS"],
    ["people", "home"],
    [
      opt(
        "hear_empress",
        ["court:+2", "ministers:-1", "duma:-1"],
        [inst("court", 2), inst("ministers", -1), inst("duma", -1)],
      ),
      opt(
        "hear_ministers",
        ["ministers:+1", "court:-1"],
        [inst("ministers", 1), inst("court", -1)],
      ),
      opt(
        "hear_stavka",
        ["stavka:+1", "court:-1"],
        [inst("stavka", 1), inst("court", -1)],
      ),
    ],
  ),
];

/** The neutral's price: the best a side can give differs, so `full` asks. */
function price(tag: GwTag, central: number, entente: number): GwScene {
  const side = (s: "central" | "entente") => world({ is: "side", of: [s] });
  const offer = (value: number): GwEffect =>
    doWorld({ do: "offer", tag, value });
  return called(
    `gw_price_${tag.toLowerCase()}`,
    ["DEU", "GBR", "AUH", "RUS"],
    ["foreign"],
    [
      opt(
        "full",
        ["price_full", "trust:-1", "authority:-10"],
        [
          { kind: "maybe", when: side("central"), then: [offer(central)] },
          { kind: "maybe", when: side("entente"), then: [offer(entente)] },
          authority(-10),
        ],
      ),
      opt("modest", ["price_modest"], [offer(1)]),
      opt("nothing", [], [why("price_refused")]),
    ],
    {
      variants: [{ id: "central", when: side("central") }, { id: "base" }],
    },
  );
}

const NEUTRALS: GwScene[] = [
  price("JPN", 1, 3),
  price("OTT", 4, 2),
  price("ITA", 2, 4),
  price("BGR", 4, 2),
  price("ROU", 2, 4),
  price("GRC", 1, 3),
];

const ENDGAME: GwScene[] = [
  called(
    "gw_sue",
    everyone,
    ["foreign", "tension_up"],
    [
      opt("ask", ["ends_war"], [doWorld({ do: "sue" })]),
      opt("fight_on", ["morale:-1"], [gauge("morale", -1), why("fought_on")]),
    ],
    { salience: 9, fallback: "ask" },
  ),
  called(
    "gw_peace_offer",
    everyone,
    ["foreign", "tension_down"],
    [
      opt(
        "accept",
        ["ends_war"],
        [doWorld({ do: "armistice", kind: "compromise" })],
      ),
      opt("refuse", [], [why("peace_refused")]),
    ],
  ),
];

export const WARTIME_SCENES: readonly GwScene[] = [
  ...DEU_HOME,
  ...GBR_HOME,
  ...AUH_HOME,
  ...RUS_HOME,
  ...BODIES,
  ...NEUTRALS,
  ...ENDGAME,
];
