import type {
  GwInstitution,
  GwOffice,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  all,
  decide,
  flag,
  GwCastRule,
  GwCond,
  GwEffect,
  GwNode,
  GwOption,
  GwReply,
  GwScene,
  GwVariant,
  memory,
  moody,
  not,
  reason,
  remember,
  role,
  schedule,
  setFlag,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";

/**
 * France's threats (ww166 plan §1; rows in engine/ww1914/GovTable). The
 * Chamber's and the Senate's rows end in the consultations (gov_fra_consult),
 * a big talk that comes each time a cabinet falls: the President hears the
 * presidents of both chambers, then calls the next premier. A fall is never a
 * lost game, and nothing here changes who the seat is: Poincaré stays. Only
 * the Élysée row's last paper can end the game, and its first way is safe.
 *
 * Lane S wrote the skeleton; lane W5 wrote it out (ww166-format.md). Text in
 * resources/ww1914/ko/FRA.gov.json. Each premier carries his price (plan §1:
 * a law, an aim, less room for the President), and brings his list of
 * ministers to the Élysée the next chapter (gov_fra_cabinet).
 */

const onlyCalled = flag("gw_world_called_only");

const inst = (i: GwInstitution, delta: number): GwEffect => ({
  kind: "inst",
  inst: i,
  delta,
});
const at = (i: GwInstitution, r: { min?: number; max?: number }): GwCond => ({
  kind: "inst",
  inst: i,
  ...r,
});
const heat = (id: string, delta: number) =>
  doWorld({ do: "gov_heat", id, delta });
const beat = (id: string) => doWorld({ do: "gov_beaten", id });
const authority = (delta: number) => doWorld({ do: "authority", delta });
const hasAuthority = (min: number) => world({ is: "authority", min });
const soon = (row: string) => doWorld({ do: "gov_soon", id: row });
const end = (ending: string): GwEffect => ({ kind: "end", ending });
const unflag = (f: string): GwEffect => ({ kind: "unflag", flag: f });
const again = (id: string) => memory(`gov_held_${id}`);
const from = (date: string) => world({ is: "date", from: date });
const regime = (...of: string[]) => world({ is: "regime", of });

const v = (id: string, when?: GwCond): GwVariant =>
  when === undefined ? { id } : { id, when };
const opt = (id: string, effects: GwEffect[], when?: GwCond): GwOption =>
  when === undefined
    ? { id, tell: [], effects }
    : { id, tell: [], effects, when };

const anyOf = (...rules: GwCastRule[]): GwCastRule => ({
  any_of: rules as Extract<GwCastRule, { any_of: unknown }>["any_of"],
});
const office = (o: GwOffice): { office: GwOffice } => ({ office: o });
const named = (person: string): { person: string } => ({ person });
const trusted: GwCastRule = { favourite: true };
const orTrusted = (...rules: GwCastRule[]) => anyOf(...rules, trusted);

const p = role("who");
const r = (
  id: string,
  stance: GwReply["stance"],
  kind: GwReply["kind"],
  effects: GwEffect[],
  next: string | null,
  more: Partial<Pick<GwReply, "reacts" | "when">> = {},
): GwReply => ({ id, stance, kind, tell: [], effects, next, ...more });
const bye = (id = "leave", stance: GwReply["stance"] = "cold"): GwReply =>
  r(id, stance, "leave", [], null);
const node = (says: GwVariant[], ...replies: GwReply[]): GwNode => ({
  says,
  replies,
});

function talk(
  id: string,
  who: GwCastRule,
  nodes: Record<string, GwNode>,
): GwScene {
  return {
    id,
    nation: ["FRA"],
    kind: "talk",
    cast: { who },
    salience: 7,
    tags: ["people", "tension_up"],
    when: onlyCalled,
    variants: [v("base")],
    who: "who",
    start: "open",
    nodes,
  };
}

function paper(
  id: string,
  kind: "proposal" | "crisis",
  cast: GwScene["cast"],
  variants: GwVariant[],
  fallback: string,
  options: GwOption[],
): GwScene {
  return {
    id,
    nation: ["FRA"],
    kind,
    cast,
    salience: kind === "crisis" ? 9 : 8,
    tags: ["home", "tension_up"],
    when: onlyCalled,
    variants,
    fallback,
    options,
  };
}

// ---- The consultations ----

/** Every premier's flag: one stands at a time. */
export const FRA_PM_FLAGS = [
  "f_pm_viviani",
  "f_pm_briand",
  "f_pm_ribot",
  "f_pm_painleve",
  "f_pm_barthou",
  "f_pm_clemenceau",
  "f_pm_caillaux",
] as const;

/** Set by the home share (W3) when the SFIO leaves the government. */
export const SFIO_OUT = "f_sfio_out";

/** The rows a new cabinet puts out: the Chamber's and the Senate's. */
const CABINET_ROWS = ["fra_chamber", "fra_senate"];

/**
 * A premier the state allows (plan §1): who he is, when he can be called,
 * the ministers he brings, and how the factions of the Chamber stand on him
 * (the confidence vote, counted as a bill is; faction ids are the plan's
 * canonical ones, lane W6). The President names only him: the rest are his.
 */
interface FraPremier {
  readonly name: string;
  readonly person: string;
  readonly when: GwCond;
  readonly ministers: readonly (readonly [string, GwOffice])[];
  readonly stance: Readonly<Record<string, number>>;
  /** What calling him costs, paid the day he is called. */
  readonly price: readonly GwEffect[];
}

const PREMIERS: readonly FraPremier[] = [
  {
    name: "viviani",
    person: "fra_viviani",
    // June 1914's premier: callable again from the first day.
    when: from("1914-06"),
    ministers: [
      ["fra_delcasse", "foreign"],
      ["fra_millerand", "war"],
    ],
    stance: { fra_radicals: 1, fra_repsoc: 1, fra_sfio: 1, fra_left_rep: 1 },
    // Called back, he is a man the Chamber has already put out once; what
    // the President heard from him since makes that cheaper (k_viv_after).
    price: [
      {
        kind: "maybe",
        when: not(memory("k_viv_after")),
        then: [inst("chamber", -1)],
      },
    ],
  },
  {
    name: "briand",
    person: "fra_briand",
    when: from("1915-06"),
    ministers: [["fra_gallieni", "war"]],
    stance: {
      fra_radicals: 1,
      fra_repsoc: 1,
      fra_sfio: 1,
      fra_left_rep: 1,
      fra_fed_rep: 1,
    },
    // He governs by talk, and the talk is his: less room for the President.
    price: [authority(-5)],
  },
  {
    name: "ribot",
    person: "fra_ribot",
    when: from("1916-06"),
    ministers: [["fra_painleve", "war"]],
    stance: {
      fra_radicals: 1,
      fra_left_rep: 1,
      fra_fed_rep: 1,
      fra_catholics: 1,
    },
    // The Senate's man: the Senate sits easier, the Chamber's left does not.
    price: [inst("senate", 1), inst("chamber", -1)],
  },
  {
    name: "painleve",
    person: "fra_painleve",
    when: from("1917-01"),
    ministers: [],
    stance: { fra_radicals: 1, fra_repsoc: 1, fra_left_rep: 1 },
    // He asks the generals for their odds: the GQG resents it.
    price: [inst("army", -1)],
  },
  {
    name: "barthou",
    person: "fra_barthou",
    // Premier until December 1913: a name for July as for any month.
    when: from("1914-06"),
    ministers: [],
    stance: {
      fra_left_rep: 1,
      fra_fed_rep: 1,
      fra_catholics: 1,
      fra_sfio: -1,
    },
    // The three-year law's man: the left counts it against him.
    price: [inst("chamber", -1), inst("army", 1)],
  },
  {
    // The hardest call: the man who fought the President's election takes
    // the war out of his hands. Legal, and always optional.
    name: "clemenceau",
    person: "fra_clemenceau",
    when: from("1915-01"),
    ministers: [],
    stance: {
      fra_radicals: 1,
      fra_left_rep: 1,
      fra_fed_rep: 1,
      fra_catholics: 1,
      fra_tiger: 1,
      fra_sfio: -1,
      fra_minority: -1,
      fra_caillaux: -1,
    },
    // He takes the war out of the President's hands: the premier's signature
    // is his own now, and he asks nobody's leave.
    price: [inst("countersign", -2), authority(-10)],
  },
  {
    name: "caillaux",
    person: "fra_caillaux",
    when: all(
      world({ is: "war_age", min: 24 }),
      world({ is: "score", max: -10 }),
    ),
    ministers: [],
    stance: {
      fra_caillaux: 1,
      fra_minority: 1,
      fra_radicals: 1,
      fra_sfio: 1,
      fra_left_rep: -1,
      fra_fed_rep: -1,
      fra_catholics: -1,
      fra_af: -1,
      fra_tiger: -1,
    },
    // A cabinet that talks of peace: the GQG and London hear it at once.
    price: [inst("army", -2), { kind: "trust", tag: "GBR", delta: -1 }],
  },
];

/**
 * What calling a premier does: the old flags go, his comes, he and his
 * ministers are appointed, the cabinet's rows are put out. Clemenceau's
 * government is a form of its own (regime fra_tiger); leaving it goes back
 * to the sacred union, or to the plain Republic once the SFIO has left. Exported for scenes that call a premier elsewhere.
 */
export function callPremier(name: string): GwEffect[] {
  const row = PREMIERS.find((x) => x.name === name);
  if (row === undefined) throw new Error(`no premier ${name}`);
  const tiger = name === "clemenceau";
  return [
    ...FRA_PM_FLAGS.map(unflag),
    tiger
      ? doWorld({ do: "regime", to: "fra_tiger" })
      : {
          kind: "maybe",
          when: regime("fra_tiger"),
          // Once the Socialists have walked out (W3's f_sfio_out), the
          // sacred union doesn't come back: the plain Republic does.
          then: [
            {
              kind: "maybe",
              when: flag(SFIO_OUT),
              then: [doWorld({ do: "regime", to: "fra_republic" })],
            },
            {
              kind: "maybe",
              when: not(flag(SFIO_OUT)),
              then: [doWorld({ do: "regime", to: "fra_union" })],
            },
          ],
        },
    setFlag(`f_pm_${name}`),
    { kind: "appoint", who: { person: row.person }, office: "chancellor" },
    ...row.ministers.map(
      ([person, o]): GwEffect => ({
        kind: "appoint",
        who: { person },
        office: o,
      }),
    ),
    ...CABINET_ROWS.map(beat),
    ...row.price,
    remember("k_gov_fra_consulted"),
    reason(`gov_fra_called_${name}`),
    schedule(GOV_FRA_CABINET, 1),
  ];
}

/** The new premier brings his list to the Élysée (plan §4 ④). */
export const GOV_FRA_CABINET = "gov_fra_cabinet";

const callable = (x: FraPremier): GwCond =>
  all(
    { kind: "person_active", person: x.person },
    not({ kind: "holder", office: "chancellor", person: x.person }),
    x.when,
    world({ is: "confidence", stance: x.stance }),
  );

const vacant: GwCond = { kind: "office_empty", office: "chancellor" };
const maybe = (when: GwCond, then: GwEffect[]): GwEffect => ({
  kind: "maybe",
  when,
  then,
});

/**
 * The fallback: the same premier is asked to go on, and the rows go out.
 * After a resignation the office is empty: "the same premier" is the man who
 * resigned, asked to take his letter back (the Chamber never voted him out).
 * If he can't come back, the first man the Chamber would vote for is called,
 * so the office never goes to a name nobody counted.
 */
const renew: GwReply = {
  ...decide("renew", null, [
    maybe(not(vacant), [
      inst("chamber", -1),
      ...CABINET_ROWS.map(beat),
      remember("k_gov_fra_consulted"),
      reason("gov_fra_renewed"),
    ]),
    ...PREMIERS.map((x) =>
      maybe(
        all(
          vacant,
          { kind: "person_active", person: x.person },
          {
            kind: "memory",
            key: "premier_resigned",
            who: { person: x.person },
            within: 6,
          },
        ),
        [
          { kind: "appoint", who: { person: x.person }, office: "chancellor" },
          trustOf({ person: x.person }, 2),
          inst("chamber", -1),
          ...CABINET_ROWS.map(beat),
          remember("k_gov_fra_consulted"),
          reason("gov_fra_renewed"),
        ],
      ),
    ),
    ...PREMIERS.map((x) =>
      maybe(all(vacant, callable(x)), callPremier(x.name)),
    ),
  ]),
};

const CONSULT: GwScene = {
  id: "gov_fra_consult",
  nation: ["FRA"],
  kind: "talk",
  big: true,
  salience: 9,
  tags: ["home", "tension_up"],
  when: onlyCalled,
  cast: {
    chamber: orTrusted(named("fra_deschanel")),
    senate: orTrusted(named("fra_dubost")),
  },
  who: "chamber",
  start: "n1",
  variants: [v("again", memory("k_gov_fra_consulted")), v("base")],
  nodes: {
    n1: {
      says: [
        v("des", memory("k_des_chamber")),
        v("again", memory("k_gov_fra_consulted")),
        v("base"),
      ],
      replies: [decide("hear", "n2")],
    },
    n2: {
      who: "senate",
      says: [v("tiger", flag("f_pm_clemenceau")), v("base")],
      replies: [decide("hear", "n3")],
    },
    n3: {
      alone: true,
      fallback: "renew",
      says: [v("war", world({ is: "war" })), v("base")],
      replies: [
        renew,
        ...PREMIERS.map(
          (x): GwReply => ({
            ...decide(`call_${x.name}`, null, callPremier(x.name)),
            when: callable(x),
          }),
        ),
      ],
    },
  },
};

// ---- The rows ----

/**
 * The new premier's list, the chapter after he is called. The President can
 * take it, add a word, or press for a name: pressing costs the premier's
 * trust, as the plan has it, and the list is his to keep or not.
 */
const pmFlag = (name: string) => v(name, flag(`f_pm_${name}`));
const CABINET: GwScene = {
  id: GOV_FRA_CABINET,
  nation: ["FRA"],
  kind: "proposal",
  cast: { pm: orTrusted(office("chancellor")) },
  salience: 8,
  tags: ["home", "people"],
  scheduledOnly: true,
  variants: [
    pmFlag("clemenceau"),
    pmFlag("caillaux"),
    pmFlag("briand"),
    pmFlag("ribot"),
    pmFlag("painleve"),
    pmFlag("barthou"),
    v("base"),
  ],
  fallback: "take_list",
  options: [
    opt("take_list", [trustOf(role("pm"), 1), reason("gov_fra_list_taken")]),
    opt("message", [
      inst("chamber", 1),
      inst("countersign", -1),
      reason("gov_fra_list_message"),
    ]),
    opt("press_name", [
      trustOf(role("pm"), -1),
      inst("countersign", 1),
      authority(-5),
      reason("gov_fra_list_pressed"),
    ]),
    opt(
      "press_delcasse",
      [
        trustOf(role("pm"), -1),
        { kind: "appoint", who: { person: "fra_delcasse" }, office: "foreign" },
        reason("gov_fra_list_delcasse"),
      ],
      all(
        memory("k_del_after"),
        { kind: "person_active", person: "fra_delcasse" },
        not(flag("f_pm_clemenceau")),
      ),
    ),
  ],
};

export const GOV_FRA_SCENES: GwScene[] = [
  CABINET,
  talk("gov_fra_chamber_1", orTrusted(office("chancellor")), {
    open: node(
      [v("cold", at("chamber", { max: -2 })), v("base")],
      r("who", "frank", "ask", [], "price"),
      r("hold", "cold", "push", [trustOf(p, -1)], "price", {
        reacts: [
          {
            when: moody(p, "weary", "anxious"),
            next: "price",
            effects: [reason("gov_fra_c_pushed")],
          },
        ],
      }),
      bye(),
    ),
    price: node(
      [v("base")],
      r(
        "deal",
        "warm",
        "deal",
        [
          remember("k_gov_fra_chamber", p),
          heat("fra_chamber", -2),
          soon("fra_chamber"),
        ],
        null,
      ),
      r("no", "cold", "push", [trustOf(p, -1), inst("chamber", -1)], null),
      bye("think", "warm"),
    ),
  }),
  paper(
    "gov_fra_chamber_2",
    "proposal",
    { pm: orTrusted(office("chancellor")) },
    [v("again", again("fra_chamber")), v("secret", from("1916-06")), v("base")],
    "answer",
    [
      opt("answer", [inst("chamber", 1), heat("fra_chamber", -2)]),
      opt(
        "secret_session",
        [inst("chamber", 2), inst("army", -1), heat("fra_chamber", -4)],
        from("1916-06"),
      ),
      opt("adjourn", [inst("chamber", -1), heat("fra_chamber", 1)]),
      opt(
        "reshuffle",
        [inst("chamber", 1), authority(-5), heat("fra_chamber", -5)],
        memory("k_gov_fra_chamber"),
      ),
    ],
  ),
  talk("gov_fra_senate_1", orTrusted(named("fra_clemenceau"), office("war")), {
    open: node(
      [v("shells", { kind: "gauge", gauge: "shells", max: 1 }), v("base")],
      r("ask", "frank", "ask", [], "price"),
      bye(),
    ),
    price: node(
      [v("base")],
      r(
        "deal",
        "warm",
        "deal",
        [
          remember("k_gov_fra_senate", p),
          heat("fra_senate", -2),
          soon("fra_senate"),
        ],
        null,
      ),
      r("no", "cold", "push", [trustOf(p, -1), inst("senate", -1)], null),
      bye("think", "warm"),
    ),
  }),
  paper(
    "gov_fra_senate_2",
    "proposal",
    { pm: orTrusted(office("chancellor")) },
    [v("again", again("fra_senate")), v("base")],
    "receive",
    [
      opt("receive", [inst("senate", 1), heat("fra_senate", -2)]),
      opt("visits", [
        inst("senate", 2),
        inst("army", -1),
        heat("fra_senate", -4),
      ]),
      opt("refuse", [inst("senate", -1), inst("army", 1)]),
      opt(
        "commission",
        [inst("senate", 2), authority(-5), heat("fra_senate", -5)],
        memory("k_gov_fra_senate"),
      ),
    ],
  ),
  CONSULT,
  talk(
    "gov_fra_elysee_1",
    orTrusted(named("fra_deschanel"), office("chancellor")),
    {
      open: node([v("base")], r("ask", "frank", "ask", [], "price"), bye()),
      price: node(
        [v("base")],
        r(
          "deal",
          "warm",
          "deal",
          [remember("k_gov_fra_elysee", p), heat("fra_elysee", -3)],
          null,
        ),
        bye("think", "warm"),
      ),
    },
  ),
  paper(
    "gov_fra_elysee_2",
    "proposal",
    { pm: orTrusted(office("chancellor")) },
    [v("again", again("fra_elysee")), v("base")],
    "message",
    [
      opt("message", [inst("chamber", 1), heat("fra_elysee", -2)]),
      opt(
        "leaders",
        [inst("chamber", 1), inst("senate", 1), heat("fra_elysee", -4)],
        memory("k_gov_fra_elysee"),
      ),
      opt("silence", [heat("fra_elysee", 1)]),
    ],
  ),
  paper(
    "gov_fra_elysee_3",
    "crisis",
    { pm: orTrusted(office("chancellor")) },
    [v("again", again("fra_elysee")), v("base")],
    "message",
    [
      // The safe way first: a message to both chambers, read from the tribune.
      opt("message", [
        inst("chamber", 1),
        inst("senate", 1),
        authority(-10),
        reason("gov_fra_elysee_held"),
        beat("fra_elysee"),
      ]),
      opt(
        "leaders",
        [inst("chamber", 2), authority(-5), beat("fra_elysee")],
        all(memory("k_gov_fra_elysee"), hasAuthority(5)),
      ),
      // He goes to the chambers himself: a hostile Chamber takes his chair.
      opt("face", [
        {
          kind: "maybe",
          when: at("chamber", { max: -3 }),
          then: [reason("gov_fra_elysee_lost"), end("fra_end_resigned")],
        },
        {
          kind: "maybe",
          when: at("chamber", { min: -2 }),
          then: [
            inst("chamber", 1),
            reason("gov_fra_elysee_held"),
            beat("fra_elysee"),
          ],
        },
      ]),
      opt("resign", [reason("gov_fra_elysee_lost"), end("fra_end_resigned")]),
    ],
  ),
];
