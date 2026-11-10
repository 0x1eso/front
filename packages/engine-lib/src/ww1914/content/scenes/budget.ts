import type {
  GwGauge,
  GwOffice,
  GwSecret,
  GwTemperament,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type {
  GwBudgetLine,
  GwBudgetSource,
} from "@openfront/engine-api/ww1914/GwBudget";
import { GW_TAGS, GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  all,
  any,
  candid,
  flag,
  GwCastRule,
  GwCond,
  GwEffect,
  GwNode,
  GwOption,
  GwReply,
  GwScene,
  memory,
  moody,
  not,
  reason,
  remember,
  role,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";

/**
 * The yearly budget (brief ww140). Meetings `gw_bm_<tag>_<year>`, called by
 * engine/ww1914/Budget.ts; one body per state of the country. The finance
 * holder's draft is on the table: an option signs it, or a line of it changed,
 * or opens the ledger. `gw_bt_` are talks about money, each opening an option of
 * a later meeting; `gw_bl_` a lender come to collect; `gw_bc_` the bankruptcy,
 * which is a crisis with choices and never an ending. Text is in
 * resources/ww1914/ko/<TAG>.budget.json and common.budget.json.
 */
const onlyCalled = flag("gw_world_called_only");

const sign = doWorld({ do: "budget_sign" });
const tilt = (line: GwBudgetLine, delta: number) =>
  doWorld({ do: "budget_tilt", line, delta });
const mix = (source: GwBudgetSource, delta: number) =>
  doWorld({ do: "budget_mix", source, delta });
const treasury = (pct: number) =>
  doWorld({ do: "budget_item", item: "treasury", pct });
const prices = (pct: number) =>
  doWorld({ do: "budget_item", item: "prices", pct });
const gauge = (g: GwGauge, delta: number): GwEffect => ({
  kind: "gauge",
  gauge: g,
  delta,
});
const inst = (i: Extract<GwEffect, { kind: "inst" }>["inst"], delta: number) =>
  ({ kind: "inst", inst: i, delta }) as GwEffect;

const fin = role("fin");
const heavy: GwCond = world({ is: "budget", what: "load", min: 35 });
const lost: GwCond = world({ is: "score", max: -15 });
const hungry: GwCond = { kind: "gauge", gauge: "bread", max: 1 };
const good: GwCond = world({ is: "score", min: 12 });
const dear: GwCond = world({ is: "budget", what: "prices", min: 160 });

/** Five bodies: the four states the brief names and the plain year. */
const STATES = [
  { id: "debt", when: heavy },
  { id: "lost", when: lost },
  { id: "bread", when: hungry },
  { id: "good", when: good },
  { id: "base" },
];

const opt = (
  id: string,
  tell: string[],
  effects: GwEffect[],
  when?: GwCond,
): GwOption =>
  when === undefined ? { id, tell, effects } : { id, tell, effects, when };

/** Signs the draft as it stands. Always first: the proxy takes it too. */
const draft = opt("draft", [], [sign]);
/** The work goes on in the panel; the card stays until it is signed. */
const ledger: GwOption = {
  id: "ledger",
  tell: [],
  effects: [],
  screen: "budget",
};
/** The army's man has his way against the holder of the purse. */
const guns = (n: number) =>
  opt(
    "guns",
    [`army_line:+${n}`, "fin:-1"],
    [tilt("army", n), trustOf(fin, -1), sign],
  );
/** The home front has its way. */
const relief = (n: number) =>
  opt(
    "relief",
    [`relief_line:+${n}`, "war:-1"],
    [tilt("relief", n), trustOf(role("war"), -1), sign],
  );

const anyOf = (...rules: GwCastRule[]): GwCastRule => ({
  any_of: rules as Extract<GwCastRule, { any_of: unknown }>["any_of"],
});
const office = (o: GwOffice): { office: GwOffice } => ({ office: o });
const CAST = {
  fin: anyOf(office("finance"), office("chancellor"), { favourite: true }),
  war: anyOf(office("war"), office("chief_of_staff"), { favourite: true }),
  home: anyOf(office("interior"), { favourite: true }),
};

function meeting(
  tag: GwTag,
  year: number | "peace",
  options: GwOption[],
  variants: GwScene["variants"] = STATES,
): GwScene {
  return {
    id: `gw_bm_${tag.toLowerCase()}_${year}`,
    nation: [tag],
    kind: "ledger",
    when: onlyCalled,
    cast: CAST,
    salience: 9,
    tags: ["home"],
    variants,
    fallback: "draft",
    options: [draft, ...options, ledger],
  };
}

const FIRST = [{ id: "good", when: good }, { id: "base" }];
const LAST = [
  { id: "debt", when: heavy },
  { id: "lost", when: lost },
  { id: "bread", when: hungry },
  { id: "base" },
];
const AFTER_FALL = (forms: string[]) => [
  { id: "new", when: world({ is: "regime", of: forms }) },
  ...STATES,
];
const PEACE = [{ id: "base" }];

/**
 * What a money talk holds besides its deal: a thing to find out and a thing to
 * trade. Asked further, they say what they know, straight only if they will;
 * what was heard straight buys the trade cheaper.
 */
interface MoneyTalk {
  /** The temper with a first line of its own. */
  temper: GwTemperament;
  /** The world's fact this talk can turn up. */
  secret?: GwSecret;
  /** The trade at its full price, and with what was found. */
  full: { tell: string[]; effects: GwEffect[] };
  sharp: { tell: string[]; effects: GwEffect[] };
}

/** A talk with whoever holds the purse, or a banker. */
function talk(
  id: string,
  tag: GwTag,
  who: GwCastRule,
  when: GwCond,
  key: string,
  deal: { tell: string[]; effects: GwEffect[] },
  deep: MoneyTalk,
  opts: { summon?: boolean; push?: GwEffect[] } = {},
): GwScene {
  const person = role("who");
  const found = `b_found_${id.slice(6)}`;
  const reply = (
    r: Omit<GwReply, "next"> & { next?: string | null },
  ): GwReply => ({ ...r, next: r.next ?? null });
  const sour = { kind: "person_trust", who: person, max: -2 } as const;
  const learn: GwEffect[] = [
    remember(found),
    reason(`budget_found_${id.slice(6)}`),
    ...(deep.secret === undefined
      ? []
      : [
          {
            kind: "maybe",
            when: { kind: "secret", id: deep.secret },
            then: [doWorld({ do: "reveal", id: deep.secret })],
          } as GwEffect,
        ]),
  ];
  const nodes: Record<string, GwNode> = {
    open: {
      says: [
        { id: "straight", when: candid(person) },
        { id: deep.temper, when: moody(person, deep.temper) },
        { id: "base" },
      ],
      replies: [
        reply({
          id: "ask",
          stance: "frank",
          kind: "ask",
          tell: [],
          effects: [],
          next: "hear",
          reacts: [{ when: sour, next: "shut", effects: [] }],
        }),
        reply({
          id: "push",
          stance: "cold",
          kind: "push",
          tell: ["trust:-1"],
          effects: [trustOf(person, -1), ...(opts.push ?? [])],
          next: "hear",
          miss: "shut",
        }),
        reply({
          id: "leave",
          stance: "warm",
          kind: "leave",
          tell: [],
          effects: [],
        }),
      ],
    },
    hear: {
      says: [{ id: "base" }],
      replies: [
        reply({
          id: "take",
          stance: "warm",
          kind: "deal",
          tell: deal.tell,
          effects: [remember(key), ...deal.effects],
        }),
        reply({
          id: "dig",
          stance: "frank",
          kind: "ask",
          tell: [],
          effects: [{ kind: "maybe", when: candid(person), then: learn }],
          next: "find",
        }),
        reply({
          id: "enough",
          stance: "cold",
          kind: "leave",
          tell: [],
          effects: [],
        }),
      ],
    },
    find: {
      says: [{ id: "straight", when: candid(person) }, { id: "base" }],
      replies: [
        reply({
          id: "deal",
          stance: "frank",
          kind: "deal",
          tell: [],
          effects: [],
          next: "barter",
        }),
        reply({
          id: "back",
          stance: "warm",
          kind: "leave",
          tell: [],
          effects: [remember(key)],
        }),
      ],
    },
    barter: {
      says: [{ id: "base" }],
      replies: [
        reply({
          id: "give",
          stance: "warm",
          kind: "deal",
          tell: deep.full.tell,
          effects: [remember(key), ...deep.full.effects],
        }),
        reply({
          id: "sharp",
          stance: "cold",
          kind: "deal",
          when: memory(found),
          tell: deep.sharp.tell,
          effects: [remember(key), ...deep.sharp.effects],
        }),
        reply({
          id: "refuse",
          stance: "cold",
          kind: "leave",
          tell: [],
          effects: [remember(key)],
        }),
      ],
    },
    shut: {
      says: [{ id: "base" }],
      replies: [
        reply({
          id: "end",
          stance: "cold",
          kind: "leave",
          tell: [],
          effects: [],
        }),
      ],
    },
  };
  return {
    id,
    nation: [tag],
    kind: "talk",
    stage: ["y1914", "war"],
    when,
    cast: { who },
    salience: 1,
    tags: ["people", "home"],
    who: "who",
    variants: [{ id: "base" }],
    start: "open",
    nodes,
    once: true,
    ...(opts.summon === false ? { when: onlyCalled } : { summon: true }),
  };
}

/** A trade: `gain` for `price`, or for nothing with what was found. */
const trade = (
  temper: GwTemperament,
  gain: { tell: string; effect: GwEffect },
  price: { tell: string; effect: GwEffect },
  secret?: GwSecret,
): MoneyTalk => ({
  temper,
  ...(secret === undefined ? {} : { secret }),
  full: { tell: [gain.tell, price.tell], effects: [gain.effect, price.effect] },
  sharp: { tell: [gain.tell], effects: [gain.effect] },
});
const coin = { tell: "money:+1", effect: treasury(10) };
const cost = (i: Extract<GwEffect, { kind: "inst" }>["inst"], d = -1) => ({
  tell: `${i}:${d > 0 ? "+" : ""}${d}`,
  effect: inst(i, d),
});
const gain = (i: Extract<GwEffect, { kind: "inst" }>["inst"]) => cost(i, 1);
const cheaper = { tell: "prices_down", effect: prices(-4) };
const loaf = { tell: "bread:+1", effect: gauge("bread", 1) };

const atWar = world({ is: "war" });
const since = (from: string) => all(atWar, world({ is: "date", from }));
const financeHolder = office("finance");

/** A card with four ways through a bankruptcy; the last asks nothing. */
function bankruptcy(id: string, nation: GwTag[], body: GwEffect[]): GwScene {
  return {
    id,
    nation,
    kind: "crisis",
    when: onlyCalled,
    cast: { fin: CAST.fin },
    salience: 9,
    tags: ["home", "tension_up"],
    variants: [{ id: "base" }],
    fallback: "print_on",
    options: [
      opt(
        "moratorium",
        ["interest_half", "lenders_shut", "order:-1"],
        [
          doWorld({ do: "budget_rate", pct: 50, shut: 12 }),
          gauge("order", -1),
          reason("budget_moratorium"),
        ],
      ),
      opt(
        "levy",
        ["money:+2", "order:-1", ...body.flatMap(tellOf)],
        [treasury(60), gauge("order", -1), ...body, reason("budget_levy")],
      ),
      opt(
        "new_note",
        ["prices_down", "morale:-1"],
        [prices(-20), gauge("morale", -1), reason("budget_new_note")],
      ),
      opt(
        "print_on",
        ["money:+1", "prices_up"],
        [treasury(30), prices(15), reason("budget_print_on")],
      ),
    ],
  };
}

function tellOf(e: GwEffect): string[] {
  return e.kind === "inst" ? [`${e.inst}:${e.delta}`] : [];
}

export const BUDGET_SCENES: readonly GwScene[] = [
  {
    id: "gw_bm_common",
    nation: [...GW_TAGS],
    kind: "ledger",
    when: onlyCalled,
    cast: { fin: CAST.fin },
    salience: 9,
    tags: ["home"],
    variants: [{ id: "base" }],
    fallback: "draft",
    options: [draft, ledger],
  },
  bankruptcy("gw_bc_common", [...GW_TAGS], []),

  // ---- Germany ----
  meeting(
    "DEU",
    "peace",
    [
      opt(
        "defence",
        ["army_line:+5", "reichstag:-1"],
        [tilt("army", 5), inst("reichstag", -1), sign],
      ),
    ],
    PEACE,
  ),
  meeting(
    "DEU",
    1914,
    [
      guns(4),
      opt(
        "loan_offices",
        ["print_ask:+8", "prices_up"],
        [mix("print", 8), remember("b_loan_offices"), sign],
      ),
    ],
    FIRST,
  ),
  meeting("DEU", 1915, [
    guns(5),
    relief(5),
    opt(
      "no_taxes",
      ["bonds_ask:+8", "reichstag:+1"],
      [mix("bonds", 8), inst("reichstag", 1), sign],
    ),
  ]),
  meeting("DEU", 1916, [
    guns(5),
    relief(6),
    opt(
      "profits_tax",
      ["tax_rate:+15", "reichstag:+1", "army:-1"],
      [mix("taxes", 15), inst("reichstag", 1), inst("army", -1), sign],
      memory("b_deu_profits"),
    ),
  ]),
  meeting("DEU", 1917, [
    opt(
      "programme",
      ["army_line:+10", "print_ask:+10", "army:+1"],
      [tilt("army", 10), mix("print", 10), inst("army", 1), sign],
    ),
    relief(7),
    opt(
      "reichsbank",
      ["print_ask:-8", "bonds_ask:+6"],
      [mix("print", -8), mix("bonds", 6), sign],
      memory("b_deu_notes"),
    ),
  ]),
  meeting(
    "DEU",
    1918,
    [
      guns(5),
      relief(8),
      opt(
        "who_pays",
        ["tax_rate:+20", "reichstag:+1", "order:-1"],
        [mix("taxes", 20), inst("reichstag", 1), gauge("order", -1), sign],
        memory("b_deu_after"),
      ),
    ],
    AFTER_FALL(["republic"]).filter((v) => v.id !== "good"),
  ),
  talk(
    "gw_bt_deu_profits",
    "DEU",
    financeHolder,
    all(world({ is: "war" }), world({ is: "war_months", own: true, min: 7 })),
    "b_deu_profits",
    { tell: [], effects: [reason("budget_heard_profits")] },
    trade("cold", coin, cost("army")),
  ),
  talk(
    "gw_bt_deu_chest",
    "DEU",
    financeHolder,
    atWar,
    "b_deu_chest",
    {
      tell: ["money:+1", "army:-1"],
      effects: [treasury(10), inst("army", -1)],
    },
    trade("cunning", coin, cost("reichstag")),
  ),
  talk(
    "gw_bt_deu_after",
    "DEU",
    financeHolder,
    all(
      all(
        world({ is: "war" }),
        world({ is: "war_months", own: true, min: 17 }),
      ),
      heavy,
    ),
    "b_deu_after",
    { tell: [], effects: [reason("budget_heard_after")] },
    trade("weary", gain("reichstag"), {
      tell: "money:-1",
      effect: treasury(-10),
    }),
  ),
  talk(
    "gw_bt_deu_notes",
    "DEU",
    { person: "deu_havenstein" },
    all(world({ is: "war" }), world({ is: "war_months", own: true, min: 10 })),
    "b_deu_notes",
    { tell: [], effects: [reason("budget_heard_notes")] },
    trade("stubborn", cheaper, cost("reichstag")),
  ),
  bankruptcy("gw_bc_deu", ["DEU"], [inst("reichstag", -1)]),

  // ---- Britain ----
  meeting(
    "GBR",
    "peace",
    [
      opt(
        "ships",
        ["navy_line:+5", "cabinet:-1"],
        [tilt("navy", 5), inst("cabinet", -1), sign],
      ),
    ],
    PEACE,
  ),
  meeting(
    "GBR",
    1914,
    [
      guns(4),
      opt(
        "double_tax",
        ["tax_rate:+25", "commons:-1"],
        [mix("taxes", 25), inst("commons", -1), sign],
      ),
    ],
    FIRST,
  ),
  meeting("GBR", 1915, [
    guns(5),
    opt("new_york", ["loans_ask:+8", "america:+1"], [mix("loans", 8), sign]),
    opt(
      "duties",
      ["tax_rate:+15", "cabinet:-1", "commons:+1"],
      [mix("taxes", 15), inst("cabinet", -1), inst("commons", 1), sign],
      memory("b_gbr_duties"),
    ),
  ]),
  meeting("GBR", 1916, [
    guns(5),
    relief(5),
    opt(
      "excess_profits",
      ["tax_rate:+20", "opposition:-1"],
      [mix("taxes", 20), inst("opposition", -1), sign],
    ),
    opt(
      "allies_pay",
      ["national_line:-5", "ally:-1"],
      [tilt("national", -5), sign],
      memory("b_gbr_allies"),
    ),
  ]),
  meeting("GBR", 1917, [
    opt(
      "great_loan",
      ["bonds_ask:+12", "commons:+1"],
      [mix("bonds", 12), inst("commons", 1), sign],
      memory("b_gbr_loan"),
    ),
    guns(5),
    opt(
      "ration",
      ["relief_line:+6", "navy_line:+2"],
      [tilt("relief", 6), tilt("navy", 2), sign],
    ),
  ]),
  meeting(
    "GBR",
    1918,
    [
      guns(5),
      relief(6),
      opt(
        "pay_as_we_go",
        ["tax_rate:+20", "commons:-1"],
        [mix("taxes", 20), inst("commons", -1), sign],
      ),
    ],
    LAST,
  ),
  talk(
    "gw_bt_gbr_duties",
    "GBR",
    financeHolder,
    atWar,
    "b_gbr_duties",
    {
      tell: [],
      effects: [reason("budget_heard_duties")],
    },
    trade("cunning", coin, cost("cabinet")),
  ),
  talk(
    "gw_bt_gbr_allies",
    "GBR",
    financeHolder,
    all(world({ is: "war" }), world({ is: "war_months", own: true, min: 10 })),
    "b_gbr_allies",
    { tell: [], effects: [reason("budget_heard_allies")] },
    trade("cold", coin, {
      tell: "ally:-1",
      effect: { kind: "trust", tag: "FRA", delta: -1 },
    }),
  ),
  talk(
    "gw_bt_gbr_loan",
    "GBR",
    financeHolder,
    all(world({ is: "war" }), world({ is: "war_months", own: true, min: 17 })),
    "b_gbr_loan",
    {
      tell: [],
      effects: [reason("budget_heard_loan")],
    },
    trade(
      "anxious",
      coin,
      {
        tell: "america:+1",
        effect: doWorld({ do: "readiness", tag: "USA", delta: 2 }),
      },
      "usa_credit_cliff",
    ),
  ),
  talk(
    "gw_bl_gbr",
    "GBR",
    { person: "usa_morgan" },
    atWar,
    "b_gbr_pledged",
    {
      tell: ["money:+2", "america:+1"],
      effects: [
        treasury(40),
        doWorld({ do: "readiness", tag: "USA", delta: 4 }),
      ],
    },
    trade(
      "cold",
      coin,
      {
        tell: "america:+1",
        effect: doWorld({ do: "readiness", tag: "USA", delta: 2 }),
      },
      "usa_credit_cliff",
    ),
    { summon: false },
  ),
  bankruptcy("gw_bc_gbr", ["GBR"], [inst("commons", -1)]),

  // ---- Austria-Hungary ----
  meeting(
    "AUH",
    "peace",
    [
      opt(
        "army_bill",
        ["army_line:+5", "hungary:-1"],
        [tilt("army", 5), inst("hungary", -1), sign],
      ),
    ],
    PEACE,
  ),
  meeting(
    "AUH",
    1914,
    [
      guns(4),
      opt(
        "bank_advance",
        ["print_ask:+10", "prices_up"],
        [mix("print", 10), sign],
      ),
    ],
    FIRST,
  ),
  meeting("AUH", 1915, [
    guns(5),
    opt(
      "quota",
      ["national_line:+5", "hungary:+1", "council:-1"],
      [tilt("national", 5), inst("hungary", 1), inst("council", -1), sign],
    ),
    opt(
      "first_loan",
      ["bonds_ask:+8"],
      [mix("bonds", 8), sign],
      memory("b_auh_loan"),
    ),
  ]),
  meeting("AUH", 1916, [
    guns(5),
    relief(6),
    opt(
      "grain_price",
      ["relief_line:+4", "national_line:+4", "hungary:+1"],
      [tilt("relief", 4), tilt("national", 4), inst("hungary", 1), sign],
      memory("b_auh_grain"),
    ),
  ]),
  meeting("AUH", 1917, [
    relief(7),
    opt(
      "berlin_credit",
      ["loans_ask:+8", "berlin:+1"],
      [mix("loans", 8), inst("berlin", 1), sign],
    ),
    opt(
      "halves",
      ["national_line:-5", "hungary:-1", "bread:+1"],
      [tilt("national", -5), inst("hungary", -1), gauge("bread", 1), sign],
      memory("b_auh_halves"),
    ),
  ]),
  meeting(
    "AUH",
    1918,
    [
      relief(8),
      opt("press", ["print_ask:+15", "prices_up"], [mix("print", 15), sign]),
    ],
    LAST,
  ),
  talk(
    "gw_bt_auh_loan",
    "AUH",
    financeHolder,
    atWar,
    "b_auh_loan",
    {
      tell: [],
      effects: [reason("budget_heard_loan_auh")],
    },
    trade("cunning", coin, cost("hungary")),
  ),
  talk(
    "gw_bt_auh_grain",
    "AUH",
    { person: "auh_teleszky" },
    all(world({ is: "war" }), world({ is: "war_months", own: true, min: 7 })),
    "b_auh_grain",
    { tell: ["hungary:+1"], effects: [inst("hungary", 1)] },
    trade("stubborn", loaf, cost("hungary"), "auh_hun_grain_hidden"),
  ),
  talk(
    "gw_bt_auh_halves",
    "AUH",
    financeHolder,
    all(
      all(
        world({ is: "war" }),
        world({ is: "war_months", own: true, min: 17 }),
      ),
      any(dear, hungry),
    ),
    "b_auh_halves",
    { tell: [], effects: [reason("budget_heard_halves")] },
    trade("weary", loaf, cost("council")),
  ),
  talk(
    "gw_bl_auh",
    "AUH",
    anyOf({ office: "finance", tag: "DEU" }, { favourite: true }),
    atWar,
    "b_auh_bound",
    {
      tell: ["money:+2", "berlin:+1"],
      effects: [treasury(40), inst("berlin", 1)],
    },
    trade("cold", coin, cost("berlin", 1)),
    { summon: false },
  ),
  bankruptcy("gw_bc_auh", ["AUH"], [inst("hungary", -1)]),

  // ---- Russia ----
  meeting(
    "RUS",
    "peace",
    [
      opt(
        "rails",
        ["national_line:+5", "duma:-1"],
        [tilt("national", 5), inst("duma", -1), sign],
      ),
    ],
    PEACE,
  ),
  meeting(
    "RUS",
    1914,
    [
      guns(4),
      opt(
        "dry_law",
        ["tax_rate:-15", "order:+1", "court:+1"],
        [mix("taxes", -15), gauge("order", 1), inst("court", 1), sign],
      ),
    ],
    FIRST,
  ),
  meeting("RUS", 1915, [
    guns(6),
    opt(
      "gold_north",
      ["loans_ask:+10", "money:-1"],
      [mix("loans", 10), gauge("money", -1), sign],
    ),
    opt(
      "income_tax",
      ["tax_rate:+15", "duma:+1", "court:-1"],
      [mix("taxes", 15), inst("duma", 1), inst("court", -1), sign],
      memory("b_rus_income"),
    ),
  ]),
  meeting("RUS", 1916, [
    guns(5),
    opt(
      "railways",
      ["national_line:+6", "bread:+1"],
      [tilt("national", 6), gauge("bread", 1), sign],
    ),
    opt(
      "duma_committee",
      ["duma:+2", "court:-1"],
      [inst("duma", 2), inst("court", -1), sign],
      memory("b_rus_committee"),
    ),
  ]),
  meeting(
    "RUS",
    1917,
    [
      relief(8),
      opt("press", ["print_ask:+15", "prices_up"], [mix("print", 15), sign]),
      opt(
        "liberty_loan",
        ["bonds_ask:+10", "morale:+1"],
        [mix("bonds", 10), gauge("morale", 1), sign],
        world({ is: "regime", of: ["provisional", "rep"] }),
      ),
    ],
    AFTER_FALL(["provisional", "rep"]),
  ),
  meeting(
    "RUS",
    1918,
    [
      relief(8),
      opt("press", ["print_ask:+15", "prices_up"], [mix("print", 15), sign]),
    ],
    [
      { id: "new", when: world({ is: "regime", of: ["provisional", "rep"] }) },
      ...LAST,
    ],
  ),
  talk(
    "gw_bt_rus_vodka",
    "RUS",
    financeHolder,
    atWar,
    "b_rus_income",
    {
      tell: [],
      effects: [reason("budget_heard_income")],
    },
    trade("weary", coin, cost("court")),
  ),
  talk(
    "gw_bt_rus_gold",
    "RUS",
    financeHolder,
    all(world({ is: "war" }), world({ is: "war_months", own: true, min: 5 })),
    "b_rus_gold",
    {
      tell: ["money:+1"],
      effects: [treasury(15)],
    },
    trade("anxious", coin, {
      tell: "gbr:-1",
      effect: { kind: "trust", tag: "GBR", delta: -1 },
    }),
  ),
  talk(
    "gw_bt_rus_paper",
    "RUS",
    financeHolder,
    all(
      all(
        world({ is: "war" }),
        world({ is: "war_months", own: true, min: 10 }),
      ),
      dear,
    ),
    "b_rus_paper",
    { tell: [], effects: [reason("budget_heard_paper")] },
    trade("weary", cheaper, { tell: "shells:-1", effect: gauge("shells", -1) }),
  ),
  talk(
    "gw_bt_rus_committee",
    "RUS",
    { person: "rus_shingarev" },
    all(
      all(
        world({ is: "war" }),
        world({ is: "war_months", own: true, min: 10 }),
      ),
      not(world({ is: "regime", of: ["provisional", "rep"] })),
    ),
    "b_rus_committee",
    { tell: ["duma:+1"], effects: [inst("duma", 1)] },
    trade("stubborn", gain("duma"), cost("court")),
  ),
  talk(
    "gw_bl_rus",
    "RUS",
    anyOf({ office: "finance", tag: "GBR" }, { favourite: true }),
    atWar,
    "b_rus_bound",
    {
      tell: ["money:+2", "gbr:+1"],
      effects: [treasury(40), { kind: "trust", tag: "GBR", delta: 1 }],
    },
    trade("cold", coin, {
      tell: "gbr:-1",
      effect: { kind: "trust", tag: "GBR", delta: -1 },
    }),
    { summon: false },
  ),
  bankruptcy("gw_bc_rus", ["RUS"], [inst("duma", -1)]),

  // ---- France (ww166, lane W5). No `tell` on the meetings: results come after. ----
  meeting(
    "FRA",
    "peace",
    [
      opt(
        "fortresses",
        [],
        [
          tilt("army", 5),
          inst("chamber", -1),
          reason("budget_fra_forts"),
          sign,
        ],
      ),
    ],
    PEACE,
  ),
  meeting(
    "FRA",
    1914,
    [
      opt("guns", [], [tilt("army", 4), trustOf(fin, -1), sign]),
      opt(
        "defence_bonds",
        [],
        [mix("bonds", 10), reason("budget_fra_bonds"), sign],
      ),
    ],
    FIRST,
  ),
  meeting("FRA", 1915, [
    opt("guns", [], [tilt("army", 5), trustOf(fin, -1), sign]),
    opt(
      "first_loan",
      [],
      [mix("bonds", 12), gauge("morale", 1), sign],
      memory("b_fra_bonds"),
    ),
    opt(
      "new_york",
      [],
      [mix("loans", 8), { kind: "trust", tag: "USA", delta: 1 }, sign],
      memory("b_fra_morgan"),
    ),
  ]),
  meeting("FRA", 1916, [
    opt("guns", [], [tilt("army", 5), trustOf(fin, -1), sign]),
    opt("relief", [], [tilt("relief", 5), trustOf(role("war"), -1), sign]),
    opt(
      "income_tax",
      [],
      [mix("taxes", 15), inst("senate", -1), inst("chamber", 1), sign],
      any(
        memory("b_fra_income"),
        world({ is: "law", id: "fra_law_income_tax", of: ["force"] }),
      ),
    ),
  ]),
  meeting("FRA", 1917, [
    opt("relief", [], [tilt("relief", 6), trustOf(role("war"), -1), sign]),
    opt("second_loan", [], [mix("bonds", 12), inst("chamber", 1), sign]),
    opt(
      "gold_to_london",
      [],
      [
        mix("loans", 10),
        treasury(15),
        { kind: "trust", tag: "GBR", delta: 1 },
        sign,
      ],
      memory("b_fra_gold"),
    ),
  ]),
  meeting(
    "FRA",
    1918,
    [
      opt("guns", [], [tilt("army", 5), trustOf(fin, -1), sign]),
      opt("relief", [], [tilt("relief", 6), trustOf(role("war"), -1), sign]),
      opt(
        "bread_price",
        [],
        [tilt("relief", 4), prices(-4), gauge("money", -1), sign],
      ),
    ],
    LAST,
  ),
  talk(
    "gw_bt_fra_bonds",
    "FRA",
    financeHolder,
    atWar,
    "b_fra_bonds",
    { tell: [], effects: [reason("budget_heard_fra_bonds")] },
    trade("weary", coin, cost("chamber")),
  ),
  talk(
    "gw_bt_fra_morgan",
    "FRA",
    financeHolder,
    all(world({ is: "war" }), world({ is: "war_months", own: true, min: 7 })),
    "b_fra_morgan",
    { tell: [], effects: [reason("budget_heard_fra_morgan")] },
    trade(
      "cold",
      coin,
      {
        tell: "america:+1",
        effect: doWorld({ do: "readiness", tag: "USA", delta: 2 }),
      },
      "usa_credit_cliff",
    ),
  ),
  talk(
    "gw_bt_fra_income",
    "FRA",
    financeHolder,
    all(world({ is: "war" }), world({ is: "war_months", own: true, min: 10 })),
    "b_fra_income",
    { tell: [], effects: [reason("budget_heard_fra_income")] },
    trade("stubborn", coin, cost("senate")),
  ),
  talk(
    "gw_bt_fra_gold",
    "FRA",
    financeHolder,
    all(world({ is: "war" }), world({ is: "war_months", own: true, min: 19 })),
    "b_fra_gold",
    { tell: [], effects: [reason("budget_heard_fra_gold")] },
    trade("anxious", coin, {
      tell: "gbr:-1",
      effect: { kind: "trust", tag: "GBR", delta: -1 },
    }),
  ),
  talk(
    "gw_bl_fra",
    "FRA",
    anyOf({ office: "finance", tag: "GBR" }, { favourite: true }),
    atWar,
    "b_fra_bound",
    {
      tell: ["money:+2", "gbr:+1"],
      effects: [treasury(40), { kind: "trust", tag: "GBR", delta: 1 }],
    },
    trade("cold", coin, {
      tell: "gbr:-1",
      effect: { kind: "trust", tag: "GBR", delta: -1 },
    }),
    { summon: false },
  ),
  bankruptcy("gw_bc_fra", ["FRA"], [inst("chamber", -1)]),
];
