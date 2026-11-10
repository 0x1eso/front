// France: the world: allies, neutrals, Russia, Italy, the US. Text in resources/ww1914/ko/FRA.world.json.
// Lane W4 (ww166-format.md).
import type {
  GwGauge,
  GwInstitution,
  GwOffice,
  GwStage,
  GwTemperament,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  all,
  any,
  byName,
  candid,
  chose,
  decide,
  flag,
  GwCond,
  GwEffect,
  GwNode,
  GwOption,
  GwReply,
  GwScene,
  GwVariant,
  keepPromise,
  memory,
  moody,
  not,
  promise,
  reason,
  remember,
  role,
  setFlag,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";

/**
 * France, the world share (plan ww166-plan-fra-scenes.md §8, §9 W4, §10 W4):
 * the 25 `fra_f_` scenes, the big scene of the armistice, the summoned talks of
 * Paul Cambon, Delcassé, Ribot and Paléologue, and four visits (Barrère,
 * Jusserand, Doumergue, Lyautey). The player is Poincaré throughout; scenes
 * that name the premier cast him as `pm`. No option shows its price: `tell`
 * stays empty (the owner's rule).
 */

const NATION: GwScene["nation"] = ["FRA"];
const who = role("who");

const CRISIS: GwStage[] = ["crisis"];
const LATE: GwStage[] = ["crisis", "y1914", "war"];
const Y14_ON: GwStage[] = ["y1914", "war"];
const END: GwStage[] = ["war", "conference", "closing"];

const ch = (min: number, max: number): GwCond => ({
  kind: "chapter",
  min,
  max,
});

// ---- The state of the world ----

const warOn: GwCond = { kind: "at_war", tag: "DEU" };
const atWar = (tag: GwTag): GwCond => ({ kind: "at_war", tag });
const fighting = (tag: GwTag): GwCond =>
  world({ is: "entered", tag, side: "entente" });
const neutralOf = (tag: GwTag): GwCond => world({ is: "neutral", tag });
const isOut = (tag: GwTag): GwCond => world({ is: "out", tag });
const crisis: GwCond = { kind: "crisis", topic: "balkan" };
const temp = (min: number): GwCond => ({ kind: "temp", min });
const belg = world({ is: "plan", of: ["west"] });
const atSea = flag("f_at_sea");
const bdx = flag("f_gov_bordeaux");
const tiger = flag("f_pm_clemenceau");
const alone = flag("f_alliance_broken");
const peace = all(
  not(world({ is: "war" })),
  world({ is: "chain_end", of: ["compromise", "humiliation", "fizzled"] }),
);
const russiaBroke = world({
  is: "regime",
  tag: "RUS",
  of: ["provisional", "rep", "soviet"],
});
const karl = world({ is: "regime", tag: "AUH", of: ["karl"] });
const askedPeace = any(isOut("DEU"), world({ is: "armistice" }));
const open = (theatre: GwTheatre): GwCond => world({ is: "open", theatre });
const seen = (scene: string): GwCond => ({ kind: "seen", scene });
const gaugeAt = (g: GwGauge, max: number): GwCond => ({
  kind: "gauge",
  gauge: g,
  max,
});
const low = (tag: GwTag, g: GwGauge): GwCond => ({
  kind: "nation_gauge",
  tag,
  gauge: g,
  max: 2,
});
const holds = (office: GwOffice, person: string): GwCond => ({
  kind: "holder",
  office,
  person,
});
/** Whole months of war: since it began, or with `own` since France came in. */
const months = (range: { min?: number; max?: number }, own = true): GwCond =>
  world({ is: "war_months", ...(own ? { own } : {}), ...range });
/** The crisis has reached this link: July's chain, or a later spark's. */
const link = (min: number): GwCond => world({ is: "chain", min });

/** The country's promises to other countries (plan §13), read at the table. */
const PLEDGES = [
  "m_russia_straits",
  "m_italy_price",
  "m_levant",
  "m_rhine_tsar",
  "m_romania",
];
const pledges = (n: number): GwCond => {
  const pick = (from: number, left: number): GwCond[] =>
    left === 0
      ? [all()]
      : PLEDGES.slice(from).flatMap((k, i) =>
          pick(from + i + 1, left - 1).map((rest) => all(memory(k), rest)),
        );
  return any(...pick(0, n));
};

// ---- Prices ----

const nation = (tag: GwTag, delta: number): GwEffect => ({
  kind: "trust",
  tag,
  delta,
});
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
const tempBy = (delta: number): GwEffect => ({ kind: "temp", delta });
const delay = (days: number): GwEffect => ({ kind: "delay", days });
const readiness = (tag: GwTag, delta: number): GwEffect =>
  doWorld({ do: "readiness", tag, delta });
const men = (delta: number): GwEffect => doWorld({ do: "manpower", delta });
const talks: GwEffect = doWorld({ do: "talks" });

// ---- Builders ----

const v = (id: string, when?: GwCond): GwVariant =>
  when === undefined ? { id } : { id, when };
const opt = (id: string, effects: GwEffect[], when?: GwCond): GwOption =>
  when === undefined
    ? { id, tell: [], effects }
    : { id, tell: [], effects, when };

function paper(
  id: string,
  kind: "crisis" | "proposal" | "ledger",
  stage: GwStage[],
  when: GwCond,
  cast: GwScene["cast"],
  salience: number,
  tags: GwScene["tags"],
  variants: GwVariant[],
  options: GwOption[],
): GwScene {
  return {
    id,
    nation: NATION,
    kind,
    stage,
    when,
    cast,
    salience,
    tags,
    once: true,
    variants,
    fallback: options[0].id,
    options,
  };
}

function reading(
  id: string,
  kind: "wire" | "report",
  stage: GwStage[],
  when: GwCond,
  salience: number,
  tags: GwScene["tags"],
  variants: GwVariant[],
  more: Partial<GwScene> = {},
): GwScene {
  return {
    id,
    nation: NATION,
    kind,
    stage,
    when,
    cast: {},
    salience,
    tags,
    once: true,
    variants,
    ...more,
  };
}

const fm = { office: "foreign" } as const;
const pm = { office: "chancellor" } as const;
const cos = { office: "chief_of_staff" } as const;

// ---- Talks ----

const shut: GwCond = { kind: "person_trust", who, max: -2 };
const r = (
  id: string,
  stance: GwReply["stance"],
  kind: GwReply["kind"],
  effects: GwEffect[],
  next: string | null,
  more: Partial<Pick<GwReply, "reacts" | "when" | "gain" | "miss">> = {},
): GwReply => ({ id, stance, kind, tell: [], effects, next, ...more });
const bye = (id = "end", stance: GwReply["stance"] = "cold"): GwReply =>
  r(id, stance, "leave", [], null);
const node = (says: GwVariant[], ...replies: GwReply[]): GwNode => ({
  says,
  replies,
});
const mood = (t: GwTemperament): GwVariant => v(t, moody(who, t));
const frank: GwVariant = v("candid", candid(who));
const cold: GwVariant = v("shut", shut);

interface TalkMore {
  stage: GwStage[];
  when: GwCond;
  summon?: boolean;
  cooldown?: number;
}

function talk(
  id: string,
  person: string,
  more: TalkMore,
  nodes: Record<string, GwNode>,
): GwScene {
  const summon = more.summon ?? true;
  return {
    id,
    nation: NATION,
    kind: "talk",
    stage: more.stage,
    when: more.when,
    cast: { who: { person } },
    salience: summon ? 3 : 6,
    tags: ["people"],
    ...(more.cooldown === undefined
      ? { once: true }
      : { once: false, cooldown: more.cooldown }),
    variants: [v("base")],
    ...(summon ? { summon: true } : {}),
    who: "who",
    start: "open",
    nodes,
  };
}

/** A warm word that costs the President something: the talk's deal. */
const deal = (
  id: string,
  next: string,
  effects: GwEffect[],
  stance: GwReply["stance"] = "warm",
): GwReply => r(id, stance, "deal", [trustOf(who, 1), ...effects], next);
/** Pressing costs trust, unless he already trusts the President. */
const press = (id: string, to: string, gain: GwEffect[] = []): GwReply =>
  r(id, "threat", "push", [trustOf(who, -1)], "wall", {
    reacts: [
      { when: { kind: "person_trust", who, min: 2 }, next: to, effects: gain },
    ],
  });
const ask = (
  id: string,
  next: string,
  stance: GwReply["stance"],
  gain: GwEffect[] = [],
  more: Partial<Pick<GwReply, "reacts" | "when" | "miss">> = {},
): GwReply => r(id, stance, "ask", [], next, { gain, ...more });
const wall = node([v("base")], bye());

// ---- The scenes ----

const SCENES: GwScene[] = [
  paper(
    "fra_f_london_word",
    "crisis",
    CRISIS,
    all(crisis, temp(5), world({ is: "chain", short: false, min: 4, max: 5 })),
    { amb: { office: "ambassador_london" } },
    9,
    ["foreign", "tension_up"],
    [
      v("belg", all(belg, temp(7))),
      v("letters", memory("k_cam_letters")),
      v("sea", atSea),
      v("base"),
    ],
    [
      opt("press_honour", [
        trustOf(role("amb"), 1),
        readiness("GBR", 5),
        setFlag("f_london_pressed"),
      ]),
      opt(
        "show_letters",
        [
          readiness("GBR", 15),
          nation("GBR", 1),
          setFlag("f_london_pressed"),
          reason("fra_f_letters_shown"),
        ],
        memory("k_cam_letters"),
      ),
      opt("king_letter", [
        readiness("GBR", 10),
        setFlag("f_king_letter_asked"),
        reason("fra_f_king_letter"),
      ]),
    ],
  ),
  reading(
    "fra_f_belgium_call",
    "wire",
    LATE,
    // Germany's road through Belgium: the crisis at its last link, or the
    // war's first weeks.
    all(belg, any(link(5), months({ max: 0 }, false))),
    6,
    ["foreign", "tension_up"],
    [v("war", warOn), v("base")],
  ),
  paper(
    "fra_f_bef",
    "proposal",
    Y14_ON,
    all(warOn, fighting("GBR"), world({ is: "war_months", own: true, max: 1 })),
    { cos },
    7,
    ["war"],
    [v("known", memory("k_cam_bef")), v("base")],
    [
      opt("left_flank", [
        trustOf(role("cos"), 1),
        setFlag("f_bef_left"),
        reason("fra_f_bef_left"),
      ]),
      opt("behind_us", [
        trustOf(role("cos"), -1),
        nation("GBR", 1),
        setFlag("f_bef_behind"),
      ]),
    ],
  ),
  paper(
    "fra_f_london_pact",
    "proposal",
    Y14_ON,
    all(
      warOn,
      fighting("GBR"),
      fighting("RUS"),
      world({ is: "war_months", own: true, max: 1 }),
    ),
    { fm },
    7,
    ["foreign"],
    [v("bdx", bdx), v("base")],
    [
      opt("sign", [
        nation("GBR", 1),
        nation("RUS", 1),
        setFlag("f_london_pact"),
        reason("fra_f_pact_signed"),
      ]),
      opt("add_terms", [
        nation("GBR", -1),
        trustOf(role("fm"), 1),
        setFlag("f_london_pact"),
        setFlag("f_pact_terms"),
      ]),
    ],
  ),
  reading(
    "fra_f_ottoman",
    "wire",
    Y14_ON,
    // The news of the Ottoman entry, while it is news.
    all(
      world({ is: "entered", tag: "OTT", side: "central" }),
      world({ is: "in_war", tag: "OTT", max: 2 }),
    ),
    5,
    ["foreign"],
    [v("war", atWar("OTT")), v("base")],
  ),
  paper(
    "fra_f_morocco",
    "proposal",
    Y14_ON,
    all(warOn, world({ is: "war_months", own: true, max: 11 })),
    { war: { office: "war" } },
    5,
    ["war"],
    [v("bdx", bdx), v("base")],
    [
      opt("bring", [men(2), trustOf(byName("fra_lyautey"), -1)]),
      opt("keep", [
        trustOf(byName("fra_lyautey"), 1),
        setFlag("f_morocco_kept"),
        reason("fra_f_morocco_kept"),
      ]),
    ],
  ),
  paper(
    "fra_f_italy_price",
    "crisis",
    Y14_ON,
    all(
      warOn,
      neutralOf("ITA"),
      world({ is: "war_months", own: true, min: 5, max: 11 }),
    ),
    { fm },
    8,
    ["foreign"],
    [
      v("barr", memory("k_barr_rome")),
      v("del", memory("k_del_italy")),
      v("base"),
    ],
    [
      opt("pay", [
        readiness("ITA", 25),
        nation("ITA", 1),
        nation("RUS", -1),
        remember("m_italy_price"),
        reason("fra_f_italy_paid"),
      ]),
      opt(
        "haggle",
        [
          readiness("ITA", 15),
          nation("ITA", 1),
          remember("m_italy_price"),
          reason("fra_f_italy_haggled"),
        ],
        any(memory("k_barr_rome"), memory("k_del_italy")),
      ),
      opt("refuse", [
        readiness("ITA", -10),
        nation("ITA", -1),
        nation("RUS", 1),
        reason("fra_f_italy_refused"),
      ]),
    ],
  ),
  paper(
    "fra_f_straits_deal",
    "crisis",
    Y14_ON,
    all(
      warOn,
      atWar("OTT"),
      fighting("RUS"),
      world({ is: "war_months", own: true, min: 5, max: 11 }),
    ),
    { fm },
    8,
    ["foreign"],
    [
      v("open", open("straits")),
      v("cold", { kind: "trust", tag: "RUS", max: 0 }),
      v("base"),
    ],
    [
      opt("agree_for_rhine", [
        nation("RUS", 1),
        remember("m_russia_straits"),
        setFlag("f_straits_for_rhine"),
        reason("fra_f_straits_rhine"),
      ]),
      opt("agree", [
        nation("RUS", 2),
        nation("GBR", -1),
        remember("m_russia_straits"),
      ]),
      opt("refuse", [
        nation("RUS", -2),
        trustOf(role("fm"), -1),
        reason("fra_f_straits_refused"),
      ]),
    ],
  ),
  paper(
    "fra_f_usa_loans",
    "proposal",
    Y14_ON,
    all(
      warOn,
      world({ is: "war_months", own: true, min: 11, max: 17 }),
      gaugeAt("money", 2),
    ),
    { fin: { office: "finance" } },
    7,
    ["home"],
    [v("ribot", memory("k_rib_loans")), v("base")],
    [
      opt("morgan", [
        gauge("money", 1),
        nation("USA", 1),
        setFlag("f_morgan_loan"),
        reason("fra_f_morgan"),
      ]),
      opt(
        "own_agents",
        [gauge("money", 1), trustOf(role("fin"), 1), setFlag("f_own_agents")],
        memory("k_rib_loans"),
      ),
      opt("gold", [
        gauge("money", 1),
        trustOf(role("fin"), -1),
        setFlag("f_gold_sent"),
        reason("fra_f_gold"),
      ]),
    ],
  ),
  paper(
    "fra_f_greece",
    "crisis",
    Y14_ON,
    all(
      warOn,
      neutralOf("GRC"),
      world({ is: "war_months", own: true, min: 11, max: 29 }),
      any(open("balkan"), world({ is: "entered", tag: "BGR" })),
    ),
    { fm },
    7,
    ["foreign"],
    [
      v("schism", months({ min: 25 })),
      v("landed", chose("fra_w_salonika")),
      v("base"),
    ],
    [
      opt("back_venizelos", [
        readiness("GRC", 15),
        setFlag("f_back_venizelos"),
        reason("fra_f_venizelos"),
      ]),
      opt("wait", [nation("GBR", 1)]),
      opt("press_king", [
        readiness("GRC", 25),
        nation("GRC", -1),
        nation("RUS", -1),
        setFlag("f_press_king"),
        reason("fra_f_press_king"),
      ]),
    ],
  ),
  paper(
    "fra_f_sykes_picot",
    "proposal",
    Y14_ON,
    all(atWar("OTT"), world({ is: "war_months", own: true, min: 17, max: 23 })),
    { fm },
    7,
    ["foreign"],
    [
      v("levant", memory("k_cam_levant")),
      v("straits", memory("m_russia_straits")),
      v("base"),
    ],
    [
      opt("sign", [
        nation("GBR", 1),
        remember("m_levant"),
        reason("fra_f_levant_signed"),
      ]),
      opt(
        "more_syria",
        [
          nation("GBR", -1),
          remember("m_levant"),
          setFlag("f_more_syria"),
          reason("fra_f_more_syria"),
        ],
        memory("k_cam_levant"),
      ),
      opt("delay", [nation("GBR", -1), delay(30)]),
    ],
  ),
  paper(
    "fra_f_romania",
    "proposal",
    Y14_ON,
    all(
      warOn,
      neutralOf("ROU"),
      world({ is: "war_months", own: true, min: 23, max: 29 }),
    ),
    { fm },
    6,
    ["foreign"],
    [v("verdun", seen("fra_big_verdun")), v("base")],
    [
      opt("pay", [
        readiness("ROU", 25),
        nation("ROU", 1),
        remember("m_romania"),
        reason("fra_f_romania_paid"),
      ]),
      opt("haggle", [readiness("ROU", 5), trustOf(role("fm"), 1)]),
    ],
  ),
  paper(
    "fra_f_rhine_russia",
    "crisis",
    Y14_ON,
    all(
      warOn,
      fighting("RUS"),
      not(russiaBroke),
      world({ is: "war_months", own: true, min: 29, max: 35 }),
    ),
    { fm },
    7,
    ["foreign"],
    [
      v("mission", flag("f_dou_mission")),
      v("straits", memory("m_russia_straits")),
      v("base"),
    ],
    [
      opt("sign", [
        nation("RUS", 1),
        remember("m_rhine_tsar"),
        setFlag("f_rhine_tsar"),
        reason("fra_f_rhine_tsar"),
      ]),
      opt("words_only", [setFlag("f_rhine_words")]),
      opt("refuse", [nation("RUS", -1), reason("fra_f_rhine_refused")]),
    ],
  ),
  paper(
    "fra_f_russia_revolution",
    "crisis",
    Y14_ON,
    all(
      warOn,
      russiaBroke,
      world({ is: "war_months", own: true, min: 29, max: 35 }),
    ),
    { fm },
    8,
    ["foreign", "tension_up"],
    [
      v("fall", memory("k_pal_fall")),
      v("late", months({ min: 32 })),
      v("base"),
    ],
    [
      opt("recognise", [
        nation("RUS", 1),
        keepPromise(byName("fra_paleologue"), "p_pal_home"),
        setFlag("f_recognised_provisional"),
      ]),
      opt("wait", [nation("RUS", -1), nation("GBR", 1)]),
      opt(
        "send_thomas",
        [nation("RUS", 1), setFlag("f_thomas_mission"), reason("fra_f_thomas")],
        memory("k_tho_russia"),
      ),
    ],
  ),
  reading(
    "fra_f_usa_entry",
    "wire",
    Y14_ON,
    all(fighting("USA"), world({ is: "war_months", min: 29 })),
    8,
    ["foreign", "tension_down"],
    [v("loans", chose("fra_f_usa_loans")), v("base")],
  ),
  paper(
    "fra_f_sixtus",
    "crisis",
    Y14_ON,
    all(warOn, world({ is: "war_months", own: true, min: 29, max: 35 }), karl),
    { fm },
    8,
    ["foreign", "tension_down"],
    [
      v("hungry", all(karl, low("AUH", "order"))),
      v("ribot", flag("f_pm_ribot")),
      v("base"),
    ],
    [
      opt("listen", [
        nation("AUH", 1),
        setFlag("f_sixtus_heard"),
        reason("fra_f_sixtus_heard"),
      ]),
      opt("refuse", [setFlag("f_sixtus_refused")]),
      opt("tell_london", [
        nation("GBR", 1),
        nation("ITA", -1),
        setFlag("f_sixtus_told"),
        reason("fra_f_sixtus_told"),
      ]),
    ],
  ),
  paper(
    "fra_f_lancken",
    "proposal",
    Y14_ON,
    all(warOn, world({ is: "war_months", own: true, min: 35, max: 41 })),
    { fm },
    7,
    ["foreign", "tension_down"],
    [v("known", memory("k_bri_lancken")), v("base")],
    [
      opt("forbid", [
        trustOf(byName("fra_briand"), -1),
        setFlag("f_lancken_forbidden"),
      ]),
      opt(
        "let_briand",
        [
          talks,
          nation("GBR", -1),
          setFlag("f_lancken_go"),
          reason("fra_f_lancken_go"),
        ],
        memory("k_bri_lancken"),
      ),
      opt("tell_allies", [
        nation("GBR", 1),
        nation("USA", 1),
        setFlag("f_lancken_told"),
      ]),
    ],
  ),
  paper(
    "fra_f_japan",
    "proposal",
    Y14_ON,
    all(
      warOn,
      world({ is: "war_months", own: true, min: 29, max: 35 }),
      world({ is: "uboat", min: 2 }),
    ),
    { navy: { office: "navy" } },
    5,
    ["war"],
    [v("base")],
    [
      opt("ask", [
        nation("JPN", 1),
        setFlag("f_japan_ships"),
        reason("fra_f_japan_ships"),
      ]),
      opt("no", [trustOf(role("navy"), -1)]),
    ],
  ),
  paper(
    "fra_f_wilson_points",
    "proposal",
    Y14_ON,
    all(fighting("USA"), world({ is: "war_months", min: 41, max: 47 })),
    { fm },
    7,
    ["foreign"],
    [v("tiger", tiger), v("base")],
    [
      opt("accept_words", [nation("USA", 1)]),
      opt("insist_alsace", [
        nation("USA", -1),
        keepPromise(byName("fra_ribot"), "p_rib_publish"),
        setFlag("f_insist_alsace"),
        reason("fra_f_insist_alsace"),
      ]),
      opt("quiet", []),
    ],
  ),
  paper(
    "fra_f_sixtus_letter",
    "crisis",
    Y14_ON,
    all(
      tiger,
      seen("fra_f_sixtus"),
      world({ is: "war_months", min: 41, max: 47 }),
    ),
    { pm },
    8,
    ["foreign", "tension_up"],
    [v("listened", chose("fra_f_sixtus", "listen")), v("base")],
    [
      opt("let_it_out", [
        nation("AUH", -2),
        trustOf(role("pm"), 1),
        setFlag("f_sixtus_published"),
        reason("fra_f_sixtus_out"),
      ]),
      opt("ask_restraint", [
        trustOf(role("pm"), -1),
        inst("countersign", -1),
        setFlag("f_sixtus_kept"),
      ]),
    ],
  ),
  reading(
    "fra_f_russia_out",
    "report",
    Y14_ON,
    all(isOut("RUS"), world({ is: "war_months", min: 39 })),
    7,
    ["foreign", "tension_up"],
    [v("tsar_deal", memory("m_rhine_tsar")), v("base")],
    { stamp: "confirmed", source: "embassy_petersburg" },
  ),
  {
    id: "fra_big_armistice",
    nation: NATION,
    kind: "talk",
    big: true,
    once: true,
    salience: 9,
    stage: END,
    tags: ["foreign", "tension_down"],
    when: all(warOn, askedPeace),
    cast: { pm, cos },
    who: "cos",
    start: "n1",
    variants: [v("tiger", tiger), v("base")],
    nodes: {
      n1: {
        says: [v("rhine", memory("k_foc_rhine")), v("base")],
        replies: [decide("hear", "n2")],
      },
      n2: {
        who: "pm",
        says: [v("tiger", tiger), v("base")],
        replies: [decide("hear", "n3")],
      },
      n3: {
        alone: true,
        fallback: "armistice",
        says: [v("tiger", tiger), v("base")],
        replies: [
          decide("armistice", null, [
            nation("GBR", 1),
            nation("USA", 1),
            tempBy(-1),
            setFlag("f_armistice_taken"),
            reason("fra_big_armistice_taken"),
          ]),
          decide("march_on", null, [
            nation("GBR", -1),
            nation("USA", -1),
            men(-3),
            trustOf(role("cos"), 1),
            setFlag("f_march_on"),
            reason("fra_big_march_on"),
          ]),
          {
            ...decide("harder_terms", null, [
              nation("USA", -1),
              trustOf(role("cos"), 1),
              setFlag("f_harder_terms"),
              reason("fra_big_harder_terms"),
            ]),
            when: memory("k_foc_rhine"),
          },
        ],
      },
    },
  },
  paper(
    "fra_f_rhine_aim",
    "proposal",
    END,
    any(seen("fra_big_armistice"), world({ is: "armistice" })),
    { pm, cos },
    8,
    ["foreign"],
    [
      v("march", chose("fra_big_armistice", "march_on")),
      v("tsar", memory("m_rhine_tsar")),
      v("base"),
    ],
    [
      opt("occupation", [
        nation("GBR", 1),
        setFlag("f_rhine_occupation"),
        reason("fra_f_rhine_occupation"),
      ]),
      opt("buffer_state", [
        nation("GBR", -1),
        nation("USA", -1),
        trustOf(role("cos"), 1),
        setFlag("f_rhine_buffer"),
      ]),
      opt("annex", [
        nation("GBR", -2),
        nation("USA", -2),
        trustOf(role("cos"), 1),
        setFlag("f_rhine_annex"),
        reason("fra_f_rhine_annex"),
      ]),
    ],
  ),
  paper(
    "fra_f_conference",
    "ledger",
    END,
    seen("fra_f_rhine_aim"),
    { pm },
    9,
    ["foreign"],
    [
      v("crowded", pledges(3)),
      v("two", pledges(2)),
      v("one", pledges(1)),
      v("base"),
    ],
    [
      opt("sign_all", [
        nation("GBR", 1),
        nation("ITA", 1),
        gauge("money", -1),
        setFlag("f_signed_all"),
        reason("fra_f_signed_all"),
      ]),
      opt("drop_one", [
        nation("ITA", -1),
        trustOf(role("pm"), 1),
        setFlag("f_dropped_one"),
        reason("fra_f_dropped_one"),
      ]),
      opt("keep_mine", [
        nation("GBR", -1),
        nation("USA", -2),
        setFlag("f_kept_mine"),
      ]),
    ],
  ),
  paper(
    "fra_f_alone",
    "crisis",
    LATE,
    // Germany's war on Russia, France standing aside, in its first months.
    all(alone, months({ min: 1, max: 4 }, false)),
    { fm },
    8,
    ["foreign", "tension_up"],
    [
      v("britain", fighting("GBR")),
      v("russia_down", low("RUS", "morale")),
      v("base"),
    ],
    [
      opt("hold", [nation("RUS", -1), setFlag("f_alone_held")]),
      opt("join_late", [
        doWorld({ do: "declare", tag: "DEU" }),
        nation("RUS", 1),
        reason("fra_f_join_late"),
      ]),
      opt("mediate", [
        talks,
        nation("RUS", -1),
        nation("USA", 1),
        reason("fra_f_mediate"),
      ]),
    ],
  ),
  paper(
    "fra_f_peace_summer",
    "crisis",
    LATE,
    // The first months after a crisis closed without a war.
    all(peace, world({ is: "peace_months", max: 4 })),
    { pm },
    8,
    ["home", "tension_down"],
    [
      v("caillaux", { kind: "person_active", person: "fra_caillaux" }),
      v("base"),
    ],
    [
      opt("keep_law", [
        inst("chamber", -1),
        trustOf(role("pm"), -1),
        setFlag("f_three_years_kept"),
      ]),
      opt("cut_law", [
        inst("chamber", 1),
        trustOf(role("pm"), 1),
        setFlag("f_three_years_cut"),
        reason("fra_f_law_cut"),
      ]),
      opt("caillaux_in", [
        inst("chamber", 1),
        inst("senate", -1),
        setFlag("f_caillaux_in"),
        reason("fra_f_caillaux_in"),
      ]),
    ],
  ),
];

const stayDel = () =>
  promise(who, "p_del_stay", 4, { keep: holds("foreign", "fra_delcasse") });

const TALKS: GwScene[] = [
  // ---- Paul Cambon, ambassador in London ----
  talk(
    "fra_t_cambon_letters",
    "fra_paul_cambon",
    { stage: CRISIS, when: ch(0, 5) },
    {
      open: node(
        [cold, mood("stubborn"), v("base")],
        ask("read", "letters", "cold", [remember("k_cam_letters")], {
          miss: "wall",
        }),
        ask("doubt", "doubt", "frank"),
        deal("copy", "letters", [remember("k_cam_letters")]),
        press("order", "letters", [remember("k_cam_letters")]),
        bye("leave", "warm"),
      ),
      letters: node([frank, v("base")], bye()),
      doubt: node(
        [v("base")],
        ask("read", "letters", "cold", [remember("k_cam_letters")]),
        bye(),
      ),
      wall,
    },
  ),
  talk(
    "fra_t_cambon_honour",
    "fra_paul_cambon",
    { stage: CRISIS, when: all(crisis, ch(4, 5)) },
    {
      open: node(
        [v("sea", atSea), mood("cold"), v("base")],
        ask("cabinet", "count", "frank", [], { miss: "wall" }),
        ask("grey", "grey", "cold"),
        deal("stand", "count", [readiness("GBR", 3)]),
        press("now", "count"),
        bye("leave", "warm"),
      ),
      count: node([frank, v("base")], bye()),
      grey: node([v("base")], ask("cabinet", "count", "frank"), bye()),
      wall,
    },
  ),
  talk(
    "fra_t_cambon_bef",
    "fra_paul_cambon",
    { stage: Y14_ON, when: all(warOn, months({ max: 1 })) },
    {
      open: node(
        [mood("anxious"), v("base")],
        ask("numbers", "numbers", "cold", [remember("k_cam_bef")], {
          miss: "wall",
        }),
        ask("kitchener", "kitchener", "frank"),
        deal("thanks", "numbers", [remember("k_cam_bef")]),
        press("more", "numbers", [remember("k_cam_bef")]),
        bye("leave", "warm"),
      ),
      numbers: node([frank, v("base")], bye()),
      kitchener: node(
        [v("base")],
        ask("numbers", "numbers", "cold", [remember("k_cam_bef")]),
        bye(),
      ),
      wall,
    },
  ),
  talk(
    "fra_t_cambon_old",
    "fra_paul_cambon",
    { stage: Y14_ON, when: warOn, cooldown: 8 },
    {
      open: node(
        [v("tiger", tiger), mood("weary"), v("base")],
        ask("ministers", "inside", "frank", [], { miss: "wall" }),
        ask("town", "town", "warm"),
        deal("stay", "inside", []),
        press("hurry", "inside"),
        bye("leave", "warm"),
      ),
      inside: node([frank, v("base")], bye()),
      town: node([v("base")], bye("end", "warm")),
      wall,
    },
  ),
  talk(
    "fra_t_cambon_levant",
    "fra_paul_cambon",
    {
      stage: Y14_ON,
      when: all(atWar("OTT"), months({ min: 11, max: 23 })),
    },
    {
      open: node(
        [mood("stubborn"), v("base")],
        ask("lines", "lines", "cold", [remember("k_cam_levant")], {
          miss: "wall",
        }),
        ask("picot", "picot", "frank"),
        deal("trust", "lines", [remember("k_cam_levant")]),
        press("claim", "lines", [remember("k_cam_levant")]),
        bye("leave", "warm"),
      ),
      lines: node([v("base")], bye()),
      picot: node(
        [frank, v("base")],
        ask("lines", "lines", "cold", [remember("k_cam_levant")]),
        bye(),
      ),
      wall,
    },
  ),
  talk(
    "fra_t_cambon_brother",
    "fra_paul_cambon",
    { stage: Y14_ON, when: all(warOn, months({ max: 2 })) },
    {
      open: node(
        [mood("cold"), v("base")],
        ask("days", "days", "frank", [], { miss: "wall" }),
        ask("health", "health", "warm"),
        deal("dinner", "days", []),
        press("blame", "days"),
        bye("leave", "warm"),
      ),
      days: node([frank, v("base")], bye()),
      health: node([v("base")], ask("days", "days", "frank"), bye()),
      wall,
    },
  ),

  // ---- Delcassé ----
  talk(
    "fra_t_delcasse_entente",
    "fra_delcasse",
    { stage: CRISIS, when: ch(0, 5) },
    {
      open: node(
        [mood("arrogant"), v("base")],
        ask("generals", "generals", "frank", [], { miss: "wall" }),
        ask("past", "past", "flatter"),
        deal("council", "generals", []),
        press("enough", "generals"),
        bye("leave", "warm"),
      ),
      generals: node([frank, v("base")], bye()),
      past: node([v("base")], ask("generals", "generals", "frank"), bye()),
      wall,
    },
  ),
  talk(
    "fra_t_delcasse_italy",
    "fra_delcasse",
    {
      stage: Y14_ON,
      when: all(warOn, neutralOf("ITA"), months({ min: 3 })),
    },
    {
      open: node(
        [mood("stubborn"), v("base")],
        ask("price", "price", "cold", [remember("k_del_italy")], {
          miss: "wall",
        }),
        ask("serbs", "serbs", "frank"),
        deal("free", "price", [remember("k_del_italy")]),
        press("limit", "price", [remember("k_del_italy")]),
        bye("leave", "warm"),
      ),
      price: node([v("base")], bye()),
      serbs: node(
        [frank, v("base")],
        ask("price", "price", "cold", [remember("k_del_italy")]),
        bye(),
      ),
      wall,
    },
  ),
  talk(
    "fra_t_delcasse_balkans",
    "fra_delcasse",
    {
      stage: Y14_ON,
      when: all(warOn, neutralOf("BGR"), months({ min: 9 })),
    },
    {
      open: node(
        [mood("anxious"), v("base")],
        ask("sofia", "sofia", "frank", [], { miss: "wall" }),
        ask("blame", "blame", "cold"),
        deal("cover", "sofia", []),
        press("why", "sofia"),
        bye("leave", "warm"),
      ),
      sofia: node([frank, v("base")], bye()),
      blame: node([v("base")], bye()),
      wall,
    },
  ),
  talk(
    "fra_t_delcasse_tired",
    "fra_delcasse",
    {
      stage: Y14_ON,
      // He goes when Sofia is lost, or worn out after a long year.
      when: all(
        holds("foreign", "fra_delcasse"),
        warOn,
        any(
          world({ is: "entered", tag: "BGR", side: "central" }),
          months({ min: 14 }),
        ),
      ),
    },
    {
      open: node(
        [mood("weary"), v("base")],
        ask("why", "why", "frank", [], { miss: "wall" }),
        deal("stay", "stay", [stayDel()]),
        r("accept", "cold", "ask", [trustOf(who, -1)], "accept"),
        press("duty", "stay"),
        bye("leave", "warm"),
      ),
      why: node([frank, v("base")], deal("stay", "stay", [stayDel()]), bye()),
      stay: node([v("base")], bye("end", "warm")),
      accept: node([v("base")], bye()),
      wall,
    },
  ),
  talk(
    "fra_t_delcasse_navy",
    "fra_delcasse",
    {
      stage: Y14_ON,
      when: all(warOn, holds("foreign", "fra_delcasse")),
      cooldown: 8,
    },
    {
      open: node(
        [mood("arrogant"), v("base")],
        ask("fleet", "fleet", "frank", [], { miss: "wall" }),
        ask("british", "british", "cold"),
        deal("praise", "fleet", [], "flatter"),
        press("mind", "fleet"),
        bye("leave", "warm"),
      ),
      fleet: node([frank, v("base")], bye()),
      british: node([v("base")], bye()),
      wall,
    },
  ),
  talk(
    "fra_t_delcasse_after",
    "fra_delcasse",
    {
      stage: Y14_ON,
      when: all(
        not(holds("foreign", "fra_delcasse")),
        seen("fra_t_delcasse_tired"),
      ),
    },
    {
      open: node(
        [mood("stubborn"), v("base")],
        ask("advice", "advice", "frank", [remember("k_del_after")], {
          miss: "wall",
        }),
        ask("health", "health", "warm"),
        deal("honour", "advice", [remember("k_del_after")]),
        press("back", "advice", [remember("k_del_after")]),
        bye("leave", "warm"),
      ),
      advice: node([frank, v("base")], bye()),
      health: node([v("base")], bye("end", "warm")),
      wall,
    },
  ),

  // ---- Ribot ----
  talk(
    "fra_t_ribot_loans",
    "fra_ribot",
    {
      stage: Y14_ON,
      when: all(warOn, holds("finance", "fra_ribot")),
    },
    {
      open: node(
        [mood("weary"), v("base")],
        ask("london", "london", "cold", [remember("k_rib_loans")], {
          miss: "wall",
        }),
        ask("newyork", "newyork", "frank"),
        deal("trust", "london", [remember("k_rib_loans")]),
        press("faster", "london", [remember("k_rib_loans")]),
        bye("leave", "warm"),
      ),
      london: node([v("base")], bye()),
      newyork: node(
        [frank, v("base")],
        ask("london", "london", "cold", [remember("k_rib_loans")]),
        bye(),
      ),
      wall,
    },
  ),
  talk(
    "fra_t_ribot_gold",
    "fra_ribot",
    {
      stage: Y14_ON,
      // Gold still crossing to New York: America lends but hasn't come in.
      when: all(
        warOn,
        holds("finance", "fra_ribot"),
        months({ min: 6 }),
        not(fighting("USA")),
      ),
      cooldown: 8,
    },
    {
      open: node(
        [v("low", gaugeAt("money", 1)), mood("stubborn"), v("base")],
        ask("real", "real", "frank", [], { miss: "wall" }),
        ask("loan", "loan", "cold"),
        deal("keep", "real", []),
        press("truth", "real"),
        bye("leave", "warm"),
      ),
      real: node([frank, v("base")], bye()),
      loan: node([v("base")], bye()),
      wall,
    },
  ),
  talk(
    "fra_t_ribot_stockholm",
    "fra_ribot",
    // Petrograd's soviet calls the socialists to Stockholm: a Russia that has
    // lost its Tsar but still fights.
    {
      stage: Y14_ON,
      when: all(russiaBroke, warOn, fighting("RUS"), not(isOut("RUS"))),
    },
    {
      open: node(
        [mood("weary"), v("base")],
        ask("passports", "passports", "cold", [remember("k_rib_stockholm")], {
          miss: "wall",
        }),
        ask("london", "london", "frank"),
        deal("together", "passports", [remember("k_rib_stockholm")]),
        press("decide", "passports", [remember("k_rib_stockholm")]),
        bye("leave", "warm"),
      ),
      passports: node([v("base")], bye()),
      london: node(
        [frank, v("base")],
        ask("passports", "passports", "cold", [remember("k_rib_stockholm")]),
        bye(),
      ),
      wall,
    },
  ),
  talk(
    "fra_t_ribot_rhine",
    "fra_ribot",
    {
      stage: Y14_ON,
      // The Tsar's note outlives the Tsar.
      when: all(seen("fra_f_rhine_russia"), russiaBroke),
    },
    {
      open: node(
        [mood("anxious"), v("base")],
        ask("paper", "paper", "frank", [], { miss: "wall" }),
        deal("publish", "paper", [promise(who, "p_rib_publish", 12)]),
        ask("bury", "bury", "cold"),
        press("tell", "paper"),
        bye("leave", "warm"),
      ),
      paper: node([frank, v("base")], bye()),
      bury: node([v("base")], bye()),
      wall,
    },
  ),
  talk(
    "fra_t_ribot_premier",
    "fra_ribot",
    {
      stage: Y14_ON,
      when: all(not(holds("chancellor", "fra_ribot")), {
        kind: "inst",
        inst: "chamber",
        max: 0,
      }),
    },
    {
      open: node(
        [mood("weary"), v("base")],
        ask("terms", "terms", "frank", [], { miss: "wall" }),
        deal("ready", "terms", []),
        ask("age", "age", "cold"),
        press("now", "terms"),
        bye("leave", "warm"),
      ),
      terms: node([frank, v("base")], bye()),
      age: node([v("base")], bye()),
      wall,
    },
  ),
  talk(
    "fra_t_ribot_old",
    "fra_ribot",
    { stage: CRISIS, when: ch(0, 5) },
    {
      open: node(
        [mood("stubborn"), v("base")],
        ask("clauses", "clauses", "frank", [], { miss: "wall" }),
        ask("past", "past", "warm"),
        deal("counsel", "clauses", []),
        press("plain", "clauses"),
        bye("leave", "warm"),
      ),
      clauses: node([frank, v("base")], bye()),
      past: node([v("base")], ask("clauses", "clauses", "frank"), bye()),
      wall,
    },
  ),

  // ---- Paléologue ----
  talk(
    "fra_t_paleologue_tsar",
    "fra_paleologue",
    { stage: CRISIS, when: ch(1, 3) },
    {
      open: node(
        [mood("cunning"), v("base")],
        ask("table", "table", "frank", [remember("k_pal_tsar")], {
          miss: "wall",
        }),
        ask("empress", "empress", "cold"),
        deal("rely", "table", [remember("k_pal_tsar")]),
        press("short", "table", [remember("k_pal_tsar")]),
        bye("leave", "warm"),
      ),
      table: node([v("base")], bye()),
      empress: node(
        [frank, v("base")],
        ask("table", "table", "frank", [remember("k_pal_tsar")]),
        bye(),
      ),
      wall,
    },
  ),
  talk(
    "fra_t_paleologue_sazonov",
    "fra_paleologue",
    { stage: CRISIS, when: all(crisis, ch(3, 5)) },
    {
      open: node(
        [v("sea", atSea), mood("anxious"), v("base")],
        ask("mob", "mob", "cold", [], { miss: "wall" }),
        ask("words", "words", "frank"),
        deal("calm", "mob", []),
        press("exact", "mob"),
        bye("leave", "warm"),
      ),
      mob: node([frank, v("base")], bye()),
      words: node([v("base")], ask("mob", "mob", "cold"), bye()),
      wall,
    },
  ),
  talk(
    "fra_t_paleologue_court",
    "fra_paleologue",
    {
      stage: Y14_ON,
      when: all(warOn, fighting("RUS"), not(russiaBroke)),
      cooldown: 8,
    },
    {
      open: node(
        [v("broke", russiaBroke), mood("cunning"), v("base")],
        ask("rumour", "rumour", "frank", [], { miss: "wall" }),
        ask("army", "army", "cold"),
        deal("wit", "rumour", [], "flatter"),
        press("facts", "rumour"),
        bye("leave", "warm"),
      ),
      rumour: node([frank, v("base")], bye()),
      army: node([v("base")], bye()),
      wall,
    },
  ),
  talk(
    "fra_t_paleologue_rasputin",
    "fra_paleologue",
    {
      stage: Y14_ON,
      when: all(warOn, fighting("RUS"), not(russiaBroke), {
        kind: "person_active",
        person: "rus_rasputin",
      }),
    },
    {
      open: node(
        [mood("cunning"), v("base")],
        ask("monk", "monk", "frank", [], { miss: "wall" }),
        ask("ministers", "ministers", "cold"),
        deal("discreet", "monk", []),
        press("gossip", "monk"),
        bye("leave", "warm"),
      ),
      monk: node([frank, v("base")], bye()),
      ministers: node([v("base")], bye()),
      wall,
    },
  ),
  talk(
    "fra_t_paleologue_fall",
    "fra_paleologue",
    {
      stage: Y14_ON,
      when: all(
        warOn,
        fighting("RUS"),
        not(russiaBroke),
        low("RUS", "order"),
        // Petrograd's long winter.
        world({ is: "month", of: [11, 12, 1, 2, 3] }),
      ),
    },
    {
      open: node(
        [mood("anxious"), v("base")],
        ask("palace", "palace", "frank", [remember("k_pal_fall")], {
          miss: "wall",
        }),
        ask("duma", "duma", "cold"),
        deal("plain", "palace", [remember("k_pal_fall")]),
        press("say", "palace", [remember("k_pal_fall")]),
        bye("leave", "warm"),
      ),
      palace: node([frank, v("base")], bye()),
      duma: node(
        [v("base")],
        ask("palace", "palace", "frank", [remember("k_pal_fall")]),
        bye(),
      ),
      wall,
    },
  ),
  talk(
    "fra_t_paleologue_recall",
    "fra_paleologue",
    // The Tsar's friend, once the Tsar has gone.
    { stage: Y14_ON, when: russiaBroke },
    {
      open: node(
        [mood("weary"), v("base")],
        ask("why", "why", "frank", [], { miss: "wall" }),
        deal("home", "home", [
          promise(who, "p_pal_home", 3, {
            keep: chose("fra_f_russia_revolution", "recognise"),
          }),
        ]),
        ask("stay", "stay", "cold"),
        press("now", "home"),
        bye("leave", "warm"),
      ),
      why: node([frank, v("base")], bye()),
      home: node([v("base")], bye("end", "warm")),
      stay: node([v("base")], bye()),
      wall,
    },
  ),

  // ---- Visits ----
  talk(
    "fra_v_barrere_rome",
    "fra_barrere",
    {
      stage: Y14_ON,
      when: all(warOn, neutralOf("ITA")),
      summon: false,
    },
    {
      open: node(
        [mood("arrogant"), v("base")],
        ask("names", "names", "frank", [remember("k_barr_rome")], {
          miss: "wall",
        }),
        ask("king", "king", "cold"),
        deal("free", "names", [remember("k_barr_rome")]),
        press("sure", "names", [remember("k_barr_rome")]),
        bye("leave", "warm"),
      ),
      names: node([frank, v("base")], bye()),
      king: node(
        [v("base")],
        ask("names", "names", "frank", [remember("k_barr_rome")]),
        bye(),
      ),
      wall,
    },
  ),
  talk(
    "fra_v_jusserand_wash",
    "fra_jusserand",
    {
      stage: Y14_ON,
      when: all(warOn, not(fighting("USA")), months({ min: 2 })),
      summon: false,
      cooldown: 10,
    },
    {
      open: node(
        [v("loans", chose("fra_f_usa_loans")), mood("cunning"), v("base")],
        ask("clock", "clock", "frank", [], { miss: "wall" }),
        ask("colonel", "colonel", "warm"),
        deal("patience", "clock", []),
        press("when", "clock"),
        bye("leave", "warm"),
      ),
      clock: node([frank, v("base")], bye()),
      colonel: node([v("base")], bye("end", "warm")),
      wall,
    },
  ),
  talk(
    "fra_v_doumergue_mission",
    "fra_doumergue",
    {
      stage: Y14_ON,
      // Russia tiring: an allied mission to keep it in the war.
      when: all(
        warOn,
        fighting("RUS"),
        not(russiaBroke),
        any(low("RUS", "morale"), low("RUS", "order")),
      ),
      summon: false,
    },
    {
      open: node(
        [mood("cunning"), v("base")],
        deal("go", "go", [setFlag("f_dou_mission")]),
        ask("tsar", "tsar", "frank"),
        ask("stay", "stay", "cold"),
        press("orders", "go", [setFlag("f_dou_mission")]),
        bye("leave", "warm"),
      ),
      go: node([v("base")], bye("end", "warm")),
      tsar: node(
        [frank, v("base")],
        deal("go", "go", [setFlag("f_dou_mission")]),
        bye(),
      ),
      stay: node([v("base")], bye()),
      wall,
    },
  ),
  talk(
    "fra_v_lyautey_morocco",
    "fra_lyautey",
    {
      stage: Y14_ON,
      // The governor in Paris, while Morocco still has him.
      when: all(warOn, not(holds("war", "fra_lyautey"))),
      summon: false,
      cooldown: 12,
    },
    {
      open: node(
        [v("kept", flag("f_morocco_kept")), mood("arrogant"), v("base")],
        ask("country", "country", "frank", [], { miss: "wall" }),
        ask("paris", "paris", "flatter"),
        deal("minister", "paris", []),
        press("chamber", "country"),
        bye("leave", "warm"),
      ),
      country: node([frank, v("base")], bye()),
      paris: node([v("base")], bye("end", "warm")),
      wall,
    },
  ),
];

export const FRA_WORLD_SCENES: readonly GwScene[] = [...SCENES, ...TALKS];
