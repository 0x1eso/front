import type {
  GwInstitution,
  GwOffice,
  GwOpening,
  GwTemperament,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  all,
  any,
  candid,
  chose,
  decide,
  flag,
  GwCond,
  GwEffect,
  GwNode,
  GwReply,
  GwScene,
  GwStance,
  GwVariant,
  memory,
  moody,
  not,
  promise,
  reason,
  remember,
  role,
  schedule,
  setFlag,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import type { GwWorldEffect } from "@openfront/engine-api/ww1914/WorldDsl";
import { period, sinceChapter } from "./period";

/**
 * 「프랑스」, the crisis and 1914 share (lane W1 of ww166): the fra_c_ scenes,
 * the big scenes at sea, Bordeaux and the Marne, the talks of Viviani,
 * Messimy, Jaurès and Caillaux, and six visits. Data only; the text is in
 * resources/ww1914/ko/FRA.crisis.json. Plan: ww166-plan-fra-scenes.md §5,
 * §9 (W1), §10.
 *
 * The President is the seat for the whole game. Options show no result
 * before the pick (`tell` stays empty); what a pick did is said afterwards
 * with `reason` lines.
 *
 * July's papers wait on the state, not on the calendar: a crisis that comes
 * late brings them late, up to about 1916, as in the British share.
 */

const NATION: GwScene["nation"] = ["FRA"];
const LATE: GwScene["stage"] = ["crisis", "y1914", "war"];
const WAR: GwScene["stage"] = ["y1914", "war"];

const p = role("p");
const pm = role("pm");
const fm = role("fm");
const war = role("war");
const cos = role("cos");
const home = role("home");
const jaures = { person: "fra_jaures" };

const body = (inst: GwInstitution, delta: number): GwEffect => ({
  kind: "inst",
  inst,
  delta,
});
const chamber = (d: number) => body("chamber", d);
const senate = (d: number) => body("senate", d);
const sign = (d: number) => body("countersign", d);
const army = (d: number) => body("army", d);

const act = (of: GwWorldEffect): GwEffect => ({ kind: "world", of });
const temp = (delta: number): GwEffect => ({ kind: "temp", delta });
const trust = (tag: GwTag, delta: number): GwEffect => ({
  kind: "trust",
  tag,
  delta,
});
const gauge = (
  g: "money" | "order" | "morale" | "shells",
  delta: number,
): GwEffect => ({ kind: "gauge", gauge: g, delta });
const delay = (days: number): GwEffect => ({ kind: "delay", days });
const unflag = (f: string): GwEffect => ({ kind: "unflag", flag: f });
const maybe = (when: GwCond, ...then: GwEffect[]): GwEffect => ({
  kind: "maybe",
  when,
  then,
});
const roll = (key: string, pct: number, ...then: GwEffect[]): GwEffect => ({
  kind: "roll",
  key,
  pct,
  then,
});
const appoint = (person: string, office: GwOffice): GwEffect => ({
  kind: "appoint",
  who: { person },
  office,
});
const heat = (faction: string, delta: number): GwEffect =>
  act({ do: "faction", id: faction, delta });
const reveal = (id: "fra_toul_verdun" | "fra_offensive_doctrine"): GwEffect =>
  act({ do: "reveal", id });

const chapters = (min: number, max: number): GwCond => ({
  kind: "chapter",
  min,
  max,
});
const from = (min: number): GwCond => ({ kind: "chapter", min });
/** July's state, up to about 1916. */
const late = (min: number): GwCond => sinceChapter(min, "15b");
const tempMin = (min: number): GwCond => ({ kind: "temp", min });
const seen = (scene: string): GwCond => ({ kind: "seen", scene });
const opening = (...of: GwOpening[]): GwCond => ({ kind: "opening", of });
const holds = (office: GwOffice, person: string): GwCond => ({
  kind: "holder",
  office,
  person,
});
const active = (person: string): GwCond => ({ kind: "person_active", person });
const secret = (id: string): GwCond => ({ kind: "secret", id });
const known = (id: "fra_toul_verdun"): GwCond => ({
  kind: "world",
  of: { is: "known", id },
});
const mob = (tag: GwTag, min: number): GwCond => ({
  kind: "world",
  of: { is: "mob", tag, min },
});
const westFrom = (line: string): GwCond => ({
  kind: "world",
  of: { is: "front", theatre: "west", from: line },
});
const heard = (key: string): GwCond => memory(key);

const crisis: GwCond = { kind: "crisis", topic: "balkan" };
const inWar: GwCond = { kind: "at_war", tag: "DEU" };
const hot = any(crisis, inWar);
const sea = flag("f_at_sea");
const jl = flag("f_jaures_lives");
const us = flag("f_union_sacree");
const bdx = flag("f_gov_bordeaux");
const east1: GwCond = { kind: "world", of: { is: "plan", of: ["east"] } };
const belg: GwCond = { kind: "world", of: { is: "plan", of: ["west"] } };
const viviani = holds("chancellor", "fra_viviani");

const v = (id: string, when: GwCond): GwVariant => ({ id, when });
const base: GwVariant = { id: "base" };

/**
 * Jaurès falls on 31 July unless the night went otherwise (`f_jaures_lives`,
 * the guard and the seed). The first paper of August that is decided closes
 * his file: a neutral line in the record, no more.
 */
const jauresFate: GwEffect = maybe(
  all(not(jl), active("fra_jaures"), hot),
  act({ do: "passes", who: jaures }),
);
/** On 3 August the Quai passes to Doumergue (Viviani kept it until then). */
const quaiToDoumergue: GwEffect = maybe(
  all(holds("foreign", "fra_bienvenu_martin"), active("fra_doumergue")),
  appoint("fra_doumergue", "foreign"),
);

function scene(
  id: string,
  kind: GwScene["kind"],
  salience: number,
  tags: GwScene["tags"],
  cast: GwScene["cast"],
  when: GwCond,
  variants: GwVariant[],
  more: Partial<GwScene> = {},
): GwScene {
  return {
    id,
    nation: NATION,
    kind,
    stage: ["crisis", "y1914"],
    when,
    cast,
    salience,
    tags,
    once: true,
    variants,
    ...more,
  };
}

const opt = (
  id: string,
  effects: GwEffect[],
  when?: GwCond,
): NonNullable<GwScene["options"]>[number] =>
  when === undefined
    ? { id, tell: [], effects }
    : { id, when, tell: [], effects };

const r = (
  id: string,
  stance: GwStance,
  kind: GwReply["kind"],
  effects: GwEffect[],
  next: string | null,
  more: Partial<GwReply> = {},
): GwReply => ({ id, stance, kind, tell: [], effects, next, ...more });

const node = (says: GwVariant[], ...replies: GwReply[]): GwNode => ({
  says,
  replies,
});
const plain = (...replies: GwReply[]): GwNode => node([base], ...replies);
const close = (id: string, stance: GwStance): GwReply =>
  r(id, stance, "leave", [], null);
const moods = (...of: GwTemperament[]): GwVariant[] => [
  ...of.map((t) => v(t, moody(p, t))),
  base,
];

interface Chat {
  /** Temperaments with their own opening line. */
  moods?: GwTemperament[];
  /** What the deal gives. */
  deal: GwEffect[];
  /** What a straight answer to the question gives, if anything. */
  ask?: GwEffect[];
  /** What pressing gives if it lands; the deal's gift when absent. */
  press?: GwEffect[];
}

/**
 * The share's talk: a question (a candid man answers straight), a deal, a
 * push that can sour, and a way out. Each node has its own line in the pack.
 */
function chatNodes(c: Chat): Record<string, GwNode> {
  return {
    open: node(
      moods(...(c.moods ?? [])),
      r("ask", "frank", "ask", [], "said", {
        reacts: [{ when: candid(p), next: "deeper", effects: c.ask ?? [] }],
      }),
      r("deal", "warm", "deal", c.deal, "dealt"),
      r("press", "cold", "push", [trustOf(p, -1)], "pressed", {
        gain: c.press ?? c.deal,
        miss: "sour",
      }),
      close("leave", "cold"),
    ),
    said: plain(
      r("more", "frank", "ask", c.ask ?? [], "deeper"),
      close("end", "warm"),
    ),
    deeper: plain(close("end", "frank")),
    dealt: plain(close("end", "warm")),
    pressed: plain(close("end", "frank")),
    sour: plain(close("end", "cold")),
  };
}

/** Called from the people screen. */
function talk(
  id: string,
  person: string,
  when: GwCond,
  c: Chat,
  more: Partial<GwScene> = {},
): GwScene {
  return {
    id,
    nation: NATION,
    kind: "talk",
    stage: ["crisis", "y1914"],
    when,
    cast: { p: { person } },
    salience: 2,
    tags: ["people"],
    once: true,
    summon: true,
    who: "p",
    variants: [base],
    start: "open",
    nodes: chatNodes(c),
    ...more,
  };
}

/** The desk brings them: they come with something of their own. */
function visit(
  id: string,
  person: string,
  when: GwCond,
  salience: number,
  tags: GwScene["tags"],
  bring: GwEffect[],
  ask: GwEffect[] = [],
  more: Partial<GwScene> = {},
): GwScene {
  return {
    id,
    nation: NATION,
    kind: "talk",
    stage: ["crisis", "y1914"],
    when,
    cast: { p: { person } },
    salience,
    tags,
    once: true,
    who: "p",
    variants: [base],
    start: "open",
    nodes: {
      open: node(
        [base],
        r("ask", "frank", "ask", ask, "said"),
        r("deal", "warm", "deal", bring, "dealt"),
        close("leave", "cold"),
      ),
      said: plain(
        r("take", "warm", "deal", bring, "dealt"),
        close("end", "frank"),
      ),
      dealt: plain(close("end", "warm")),
    },
    ...more,
  };
}

// ---- Big scenes ----

/** At sea, 23-29 July: half the wires, no summons, one order to Paris. */
const BIG_SEA: GwScene = {
  id: "fra_big_sea",
  nation: NATION,
  kind: "talk",
  big: true,
  once: true,
  scheduledOnly: true,
  salience: 9,
  tags: ["foreign", "tension_up"],
  stage: LATE,
  cast: { pm: { office: "chancellor" } },
  who: "pm",
  start: "n1",
  variants: [v("calm", not(crisis)), base],
  nodes: {
    n1: {
      alone: true,
      says: [v("calm", not(crisis)), v("short", flag("f_trip_short")), base],
      replies: [decide("listen", "n2"), decide("sleep", "n2")],
    },
    n2: {
      says: [
        v("calm", not(crisis)),
        v("anxious", moody(pm, "anxious")),
        v("weary", moody(pm, "weary")),
        base,
      ],
      replies: [
        r("ask_pm", "frank", "ask", [], "n3"),
        r("calm_pm", "warm", "deal", [trustOf(pm, 1)], "n3"),
      ],
    },
    n3: {
      fallback: "turn_home",
      says: [
        v("calm", not(crisis)),
        v("berthelot", flag("f_berthelot_desk")),
        base,
      ],
      replies: [
        decide("turn_home", null, [
          unflag("f_at_sea"),
          chamber(1),
          remember("m_fra_sea_home"),
          reason("fra_c_sea_home"),
        ]),
        decide("keep_schedule", null, [
          unflag("f_at_sea"),
          delay(2),
          chamber(-1),
          trust("GBR", 1),
          remember("m_fra_sea_kept"),
          reason("fra_c_sea_kept"),
        ]),
        {
          ...decide("wire_firm", null, [
            unflag("f_at_sea"),
            trust("RUS", 1),
            temp(1),
            remember("m_fra_sea_firm"),
            reason("fra_c_sea_firm"),
          ]),
          when: heard("k_berth_desk"),
        },
        decide("wire_calm", null, [
          unflag("f_at_sea"),
          temp(-1),
          trust("RUS", -1),
          remember("m_fra_sea_calm"),
          reason("fra_c_sea_calm"),
        ]),
      ],
    },
  },
};

/** Early September: the government leaves Paris, or doesn't. */
const BIG_BORDEAUX: GwScene = {
  id: "fra_big_bordeaux",
  nation: NATION,
  kind: "talk",
  big: true,
  once: true,
  salience: 9,
  tags: ["home", "war", "tension_up"],
  stage: WAR,
  place: "bordeaux",
  when: all(late(6), inWar, westFrom("aisne")),
  cast: {
    pm: { office: "chancellor" },
    war: { office: "war" },
    gov: { person: "fra_gallieni" },
  },
  who: "pm",
  start: "n1",
  variants: [v("held", heard("k_gal_paris")), base],
  nodes: {
    n1: {
      says: [v("anxious", moody(pm, "anxious")), base],
      replies: [
        r("ask_pm", "frank", "ask", [], "n2"),
        r("ask_war", "cold", "ask", [], "n2"),
      ],
    },
    n2: {
      who: "gov",
      says: [v("held", heard("k_gal_paris")), base],
      replies: [
        r("trust_gov", "warm", "deal", [trustOf(role("gov"), 1)], "n3"),
        r("doubt_gov", "cold", "push", [], "n3"),
      ],
    },
    n3: {
      alone: true,
      fallback: "go_bordeaux",
      says: [v("held", heard("k_gal_paris")), base],
      replies: [
        decide("go_bordeaux", null, [
          setFlag("f_gov_bordeaux"),
          chamber(1),
          army(1),
          reason("fra_c_bordeaux_went"),
        ]),
        decide("stay_paris", null, [
          setFlag("f_president_paris"),
          chamber(-1),
          gauge("morale", 1),
          trustOf(pm, -1),
          reason("fra_c_bordeaux_stayed"),
        ]),
        decide("split_government", null, [
          setFlag("f_gov_bordeaux"),
          setFlag("f_gov_split"),
          sign(-1),
          gauge("order", 1),
          reason("fra_c_bordeaux_split"),
        ]),
      ],
    },
  },
};

/** After the Marne: the commander in chief asks for the front to himself. */
const BIG_MARNE: GwScene = {
  id: "fra_big_marne",
  nation: NATION,
  kind: "talk",
  big: true,
  once: true,
  salience: 9,
  tags: ["war", "people", "tension_up"],
  stage: WAR,
  place: "meaux",
  when: all(
    late(7),
    inWar,
    any(seen("fra_big_bordeaux"), flag("w_marne_stopped")),
  ),
  cast: { cos: { office: "chief_of_staff" }, war: { office: "war" } },
  who: "cos",
  start: "n1",
  variants: [v("bdx", bdx), base],
  nodes: {
    n1: {
      says: [v("stubborn", moody(cos, "stubborn")), base],
      replies: [
        r("ask_why", "frank", "ask", [], "n2"),
        r("praise", "flatter", "deal", [trustOf(cos, 1)], "n2"),
      ],
    },
    n2: {
      who: "war",
      says: [v("bdx", bdx), base],
      replies: [
        r("ask_war", "frank", "ask", [], "n3"),
        r("hear_out", "warm", "deal", [], "n3"),
      ],
    },
    n3: {
      alone: true,
      fallback: "give_free_hand",
      says: [base],
      replies: [
        decide("give_free_hand", null, [
          setFlag("f_joffre_free"),
          army(2),
          chamber(-1),
          trustOf(cos, 1),
          reason("fra_c_marne_free"),
        ]),
        decide("keep_watch", null, [
          army(-1),
          chamber(1),
          trustOf(cos, -1),
          reason("fra_c_marne_watch"),
        ]),
        {
          ...decide("send_minister", null, [
            chamber(1),
            senate(1),
            army(-1),
            trustOf(cos, -1),
            remember("m_fra_minister_front"),
            reason("fra_c_marne_minister"),
          ]),
          when: heard("k_fer_front"),
        },
      ],
    },
  },
};

export const FRA_CRISIS_SCENES: readonly GwScene[] = [
  // ---- The first desk: the races, the cabinet, the trial ----
  scene(
    "fra_c_roster",
    "report",
    9,
    ["people", "home"],
    { pm: { office: "chancellor" } },
    chapters(0, 1),
    [
      v("first", { kind: "first_game" }),
      v("quiet", opening("no_sarajevo")),
      base,
    ],
    { stamp: "confirmed", source: "staff" },
  ),
  scene(
    "fra_c_longchamp",
    "crisis",
    9,
    ["foreign", "tension_up"],
    { pm: { office: "chancellor" } },
    chapters(0, 0),
    [
      v("survived", opening("sarajevo_survived")),
      v("failed", opening("sarajevo_failed", "sarajevo_delayed")),
      v("none", opening("no_sarajevo")),
      base,
    ],
    {
      place: "paris",
      fallback: "stay_race",
      options: [
        opt("stay_race", [setFlag("f_longchamp_stayed"), chamber(1)]),
        opt("leave_now", [
          trustOf(pm, 1),
          trust("AUH", 1),
          setFlag("f_longchamp_left"),
        ]),
        opt("wire_vienna", [
          trust("AUH", 1),
          temp(-1),
          remember("m_fra_vienna_wire"),
        ]),
      ],
    },
  ),
  scene(
    "fra_c_three_years",
    "proposal",
    7,
    ["home"],
    { pm: { office: "chancellor" }, war: { office: "war" } },
    chapters(0, 2),
    [
      v("anxious", moody(pm, "anxious")),
      v("arrogant", moody(war, "arrogant")),
      base,
    ],
    {
      fallback: "keep_law",
      options: [
        opt("keep_law", [
          army(1),
          chamber(-1),
          trust("RUS", 1),
          heat("fra_sfio", 1),
        ]),
        opt(
          "review_later",
          [chamber(1), trustOf(pm, 1), remember("m_fra_three_review")],
          heard("k_viv_bargain"),
        ),
        opt("two_years_plan", [
          act({ do: "law_start", law: "fra_law_three_years", origin: "seat" }),
          army(-2),
          chamber(1),
          trust("RUS", -1),
          reason("fra_c_two_years"),
        ]),
      ],
    },
  ),
  scene(
    "fra_c_caillaux_trial",
    "crisis",
    8,
    ["home", "tension_up"],
    { home: { office: "interior" } },
    chapters(1, 4),
    [
      v("sea", sea),
      v("crisis", all(crisis, from(3))),
      v("cunning", moody(home, "cunning")),
      base,
    ],
    {
      fallback: "stay_silent",
      options: [
        opt("stay_silent", [chamber(-1), setFlag("f_trial_silent")]),
        opt(
          "word_to_pm",
          [sign(1), trustOf({ person: "fra_caillaux" }, 1)],
          heard("k_cai_letters"),
        ),
        opt(
          "ask_malvy",
          [trustOf(home, 1), gauge("order", 1), setFlag("f_trial_police")],
          heard("k_mal_police"),
        ),
      ],
    },
  ),
  scene(
    "fra_c_trip",
    "proposal",
    7,
    ["foreign"],
    { pm: { office: "chancellor" } },
    chapters(2, 2),
    [v("crisis", crisis), v("none", opening("no_sarajevo")), base],
    {
      essential: true,
      fallback: "go_as_planned",
      options: [
        opt("go_as_planned", [
          setFlag("f_at_sea"),
          schedule("fra_big_sea", 2),
          maybe(heard("k_viv_quai"), appoint("fra_doumergue", "foreign")),
          trust("RUS", 1),
        ]),
        opt("shorten", [
          setFlag("f_at_sea"),
          setFlag("f_trip_short"),
          schedule("fra_big_sea", 2),
          maybe(heard("k_viv_quai"), appoint("fra_doumergue", "foreign")),
        ]),
        opt(
          "leave_berthelot",
          [
            setFlag("f_at_sea"),
            setFlag("f_berthelot_desk"),
            schedule("fra_big_sea", 2),
            maybe(heard("k_viv_quai"), appoint("fra_doumergue", "foreign")),
            trust("RUS", 1),
          ],
          heard("k_berth_desk"),
        ),
      ],
    },
  ),
  scene("fra_c_paris_papers", "wire", 3, ["home"], {}, chapters(0, 2), [
    v("early", chapters(0, 0)),
    base,
  ]),
  scene(
    "fra_c_army_report",
    "report",
    6,
    ["war", "home"],
    { war: { office: "war" } },
    chapters(1, 3),
    [
      v("anxious", moody(war, "anxious")),
      v("arrogant", moody(war, "arrogant")),
      base,
    ],
    { stamp: "unconfirmed", source: "staff" },
  ),
  // ---- Petersburg and the sea ----
  scene(
    "fra_c_petersburg",
    "crisis",
    9,
    ["foreign", "tension_up"],
    { pm: { office: "chancellor" }, amb: { office: "ambassador_petersburg" } },
    all(chapters(3, 3), crisis, seen("fra_c_trip")),
    [
      v("ultimatum", flag("w_ultimatum_out")),
      v("short", flag("f_trip_short")),
      v("anxious", moody(pm, "anxious")),
      base,
    ],
    {
      place: "petrograd",
      fallback: "firm_words",
      options: [
        opt("firm_words", [
          trust("RUS", 2),
          trust("AUH", -1),
          temp(1),
          setFlag("f_firm_petersburg"),
        ]),
        opt("soft_words", [trust("RUS", -1), temp(-1)]),
        opt(
          "warn_austrian",
          [trust("AUH", -2), trust("RUS", 1), remember("m_fra_warned_vienna")],
          heard("k_pal_tsar"),
        ),
        opt("promise_nothing", [trust("RUS", -1), chamber(1)]),
      ],
    },
  ),
  scene(
    "fra_c_at_sea_wire",
    "wire",
    8,
    ["foreign"],
    {},
    all(chapters(4, 4), sea),
    [v("ultimatum", flag("w_ultimatum_out")), v("crisis", crisis), base],
    { essential: true, stage: LATE },
  ),
  BIG_SEA,
  scene(
    "fra_c_schoen",
    "crisis",
    8,
    ["foreign", "tension_up"],
    { fm: { office: "foreign" } },
    all(late(3), crisis),
    [v("sea", sea), v("weary", moody(fm, "weary")), base],
    {
      stage: LATE,
      fallback: "hear_and_wait",
      options: [
        opt("hear_and_wait", [temp(-1), trust("RUS", -1)]),
        opt("answer_firm", [temp(1), trust("RUS", 1), trust("DEU", -1)]),
        opt(
          "ask_london",
          [trust("GBR", 1), remember("m_fra_asked_london")],
          heard("k_cam_letters"),
        ),
      ],
    },
  ),
  scene(
    "fra_c_ten_km",
    "crisis",
    9,
    ["war", "tension_up"],
    { war: { office: "war" }, cos: { office: "chief_of_staff" } },
    all(late(4), crisis, tempMin(6), not(sea)),
    [
      v("germans", mob("DEU", 1)),
      v("russians", mob("RUS", 1)),
      v("stubborn", moody(cos, "stubborn")),
      base,
    ],
    {
      stage: LATE,
      fallback: "pull_back",
      options: [
        opt("pull_back", [
          trust("GBR", 1),
          army(-1),
          temp(-1),
          setFlag("f_ten_km"),
          reason("fra_c_ten_km_back"),
        ]),
        opt(
          "cover_only",
          [
            act({ do: "mobilize", tag: "FRA", level: 1 }),
            army(1),
            trustOf(cos, 1),
          ],
          heard("k_jof_cover"),
        ),
        opt("hold_line", [army(2), trust("GBR", -1), temp(1), trustOf(cos, 1)]),
      ],
    },
  ),
  // ---- The last days of July ----
  scene(
    "fra_c_jaures_guard",
    "proposal",
    6,
    ["home"],
    { home: { office: "interior" } },
    all(chapters(3, 4), crisis, active("fra_jaures")),
    [v("cunning", moody(home, "cunning")), base],
    {
      fallback: "usual_watch",
      options: [
        opt("usual_watch", [
          roll("fra_jaures_night_watch", 4, setFlag("f_jaures_lives")),
        ]),
        opt(
          "guard_him",
          [
            heat("fra_af", 1),
            roll("fra_jaures_night_guard", 40, setFlag("f_jaures_lives")),
          ],
          heard("k_mal_police"),
        ),
        opt(
          "warn_him",
          [
            trustOf(jaures, 1),
            roll("fra_jaures_night_warned", 25, setFlag("f_jaures_lives")),
          ],
          heard("k_jau_brussels"),
        ),
      ],
    },
  ),
  scene(
    "fra_c_jaures_wire",
    "wire",
    9,
    ["home", "tension_up"],
    {},
    all(chapters(5, 5), hot),
    [
      v("lives", jl),
      v("guarded", chose("fra_c_jaures_guard", "guard_him")),
      base,
    ],
    { essential: true, stage: LATE, place: "paris" },
  ),
  scene(
    "fra_c_toul_verdun",
    "crisis",
    9,
    ["foreign", "tension_up"],
    { fm: { office: "foreign" } },
    all(late(5), crisis, not(inWar)),
    [v("known", known("fra_toul_verdun")), v("east", east1), base],
    {
      stage: LATE,
      fallback: "france_interests",
      options: [
        opt("france_interests", [jauresFate, quaiToDoumergue, temp(1)]),
        opt("ask_time", [jauresFate, quaiToDoumergue, delay(1), temp(-1)]),
        opt(
          "publish_clause",
          [
            jauresFate,
            quaiToDoumergue,
            chamber(2),
            trust("GBR", 1),
            trust("DEU", -2),
            reason("fra_c_clause_out"),
          ],
          known("fra_toul_verdun"),
        ),
      ],
    },
  ),
  scene(
    "fra_c_mobilise",
    "crisis",
    9,
    ["war", "tension_up"],
    {
      pm: { office: "chancellor" },
      war: { office: "war" },
      cos: { office: "chief_of_staff" },
    },
    all(late(4), crisis, tempMin(7), not(sea), not(mob("FRA", 2))),
    [
      v("waited", chose("fra_c_mobilise", "wait_day")),
      v("germans", mob("DEU", 1)),
      v("russians", mob("RUS", 2)),
      base,
    ],
    {
      stage: LATE,
      fallback: "sign_mobilise",
      options: [
        opt("sign_mobilise", [
          jauresFate,
          act({ do: "mobilize", tag: "FRA", level: 2 }),
          temp(1),
          army(1),
          trust("RUS", 1),
          setFlag("f_fra_mobilised"),
        ]),
        opt("wait_day", [
          jauresFate,
          delay(1),
          army(-1),
          maybe(chapters(0, 6), schedule("fra_c_mobilise", 1)),
          reason("fra_c_mob_wait"),
        ]),
        opt("cover_only", [
          jauresFate,
          act({ do: "mobilize", tag: "FRA", level: 1 }),
          trust("GBR", 1),
          army(-1),
        ]),
      ],
    },
  ),
  scene(
    "fra_c_carnet_b",
    "crisis",
    8,
    ["home"],
    { home: { office: "interior" } },
    all(late(4), hot, tempMin(7), not(sea)),
    [v("soft", heard("k_carnet_soft")), v("cgt", heard("k_jou_cgt")), base],
    {
      stage: LATE,
      fallback: "not_apply",
      options: [
        opt("not_apply", [
          jauresFate,
          heat("fra_sfio", -1),
          trustOf(home, 1),
          setFlag("f_carnet_b_spared"),
        ]),
        opt("spies_only", [jauresFate, gauge("order", 1)]),
        opt("apply_all", [
          jauresFate,
          setFlag("f_carnet_b_used"),
          heat("fra_sfio", 2),
          gauge("morale", -1),
          chamber(-1),
          reason("fra_c_carnet_all"),
        ]),
      ],
    },
  ),
  scene(
    "fra_c_union",
    "crisis",
    9,
    ["home", "tension_down"],
    { pm: { office: "chancellor" } },
    all(late(5), any(inWar, tempMin(8))),
    [v("lives", jl), v("east", east1), v("war", inWar), base],
    {
      stage: LATE,
      place: "paris",
      fallback: "union_message",
      options: [
        opt("union_message", [
          jauresFate,
          quaiToDoumergue,
          act({ do: "regime", to: "fra_union" }),
          setFlag("f_union_sacree"),
          chamber(1),
          reason("fra_c_union_message"),
        ]),
        opt("plain_message", [jauresFate, quaiToDoumergue, sign(1)]),
        opt(
          "socialists_in",
          [
            jauresFate,
            quaiToDoumergue,
            act({ do: "regime", to: "fra_union" }),
            setFlag("f_union_sacree"),
            heat("fra_sfio", -2),
            chamber(2),
            remember("m_fra_socialists_in"),
            reason("fra_c_union_socialists"),
          ],
          heard("k_jau_party"),
        ),
      ],
    },
  ),
  scene(
    "fra_c_east_only",
    "crisis",
    8,
    ["foreign", "war"],
    { pm: { office: "chancellor" }, fm: { office: "foreign" } },
    all(late(5), east1, not(inWar)),
    [
      v("russians", mob("RUS", 2)),
      v("britain", { kind: "world", of: { is: "neutral", tag: "GBR" } }),
      base,
    ],
    {
      stage: LATE,
      fallback: "honour_alliance",
      options: [
        opt("honour_alliance", [
          jauresFate,
          act({ do: "declare", tag: "DEU" }),
          trust("RUS", 2),
          reason("fra_c_east_declared"),
        ]),
        opt("mobilise_wait", [
          jauresFate,
          act({ do: "mobilize", tag: "FRA", level: 2 }),
          delay(1),
          trust("RUS", 1),
        ]),
        opt("stay_out", [
          jauresFate,
          act({ do: "aside" }),
          setFlag("f_alliance_broken"),
          trust("RUS", -3),
          trust("GBR", -1),
          reason("fra_c_east_aside"),
        ]),
      ],
    },
  ),
  // ---- August ----
  scene(
    "fra_c_frontiers",
    "report",
    8,
    ["war"],
    {},
    all(chapters(6, 7), inWar),
    [v("doctrine", secret("fra_offensive_doctrine")), v("belg", belg), base],
    { stamp: "unconfirmed", source: "staff" },
  ),
  scene(
    "fra_c_war_cabinet",
    "crisis",
    8,
    ["people", "home"],
    { pm: { office: "chancellor" } },
    all(chapters(6, 7), inWar, holds("war", "fra_messimy")),
    [v("lives", jl), v("union", us), base],
    {
      fallback: "union_cabinet",
      options: [
        opt("union_cabinet", [
          jauresFate,
          appoint("fra_millerand", "war"),
          appoint("fra_delcasse", "foreign"),
          appoint("fra_ribot", "finance"),
          heat("fra_sfio", -1),
          chamber(1),
          reason("fra_c_cabinet_union"),
        ]),
        opt("small_change", [
          jauresFate,
          appoint("fra_millerand", "war"),
          chamber(-1),
        ]),
        opt(
          "keep_messimy",
          [
            jauresFate,
            appoint("fra_delcasse", "foreign"),
            appoint("fra_ribot", "finance"),
            trustOf({ person: "fra_messimy" }, 1),
            army(-1),
          ],
          heard("k_mes_stay"),
        ),
      ],
    },
  ),
  scene(
    "fra_c_gallieni_paris",
    "proposal",
    7,
    ["war"],
    { war: { office: "war" } },
    all(chapters(6, 7), inWar, westFrom("somme"), active("fra_gallieni")),
    [v("messimy", holds("war", "fra_messimy")), base],
    {
      fallback: "name_gallieni",
      options: [
        opt("name_gallieni", [
          setFlag("f_gallieni_paris"),
          trustOf({ person: "fra_gallieni" }, 1),
          remember("k_gal_paris"),
        ]),
        opt("name_other", [trustOf({ person: "fra_joffre" }, 1)]),
      ],
    },
  ),
  BIG_BORDEAUX,
  BIG_MARNE,
  scene(
    "fra_c_generals",
    "audience",
    7,
    ["people", "war"],
    { cos: { office: "chief_of_staff" } },
    all(chapters(7, 8), inWar),
    [
      v("free", flag("f_joffre_free")),
      v("stubborn", moody(cos, "stubborn")),
      base,
    ],
    {
      fallback: "accept",
      options: [
        opt("accept", [trustOf(cos, 1), army(1)]),
        opt(
          "ask_reasons",
          [army(-1), chamber(1), remember("m_fra_generals_asked")],
          heard("k_lan_warn"),
        ),
        opt("save_one", [
          trustOf(cos, -1),
          army(-1),
          trustOf({ person: "fra_lanrezac" }, 1),
          reason("fra_c_general_saved"),
        ]),
      ],
    },
  ),
  scene(
    "fra_c_censorship",
    "proposal",
    7,
    ["home"],
    { home: { office: "interior" } },
    all(chapters(6, 8), inWar),
    [v("union", us), v("cunning", moody(home, "cunning")), base],
    {
      fallback: "censor_wide",
      options: [
        opt("censor_wide", [
          gauge("order", 1),
          trustOf({ person: "fra_clemenceau" }, -1),
          setFlag("f_censor_wide"),
        ]),
        opt("military_only", [chamber(1), army(-1)]),
        opt(
          "spare_clemenceau",
          [trustOf({ person: "fra_clemenceau" }, 1), senate(1)],
          heard("k_cle_paper"),
        ),
      ],
    },
  ),
  scene(
    "fra_c_occupied",
    "report",
    7,
    ["home", "war"],
    {},
    all(chapters(7, 9), inWar, westFrom("somme")),
    [v("bdx", bdx), base],
    { stamp: "estimate", source: "staff", place: "lille" },
  ),
  scene(
    "fra_c_back_to_paris",
    "proposal",
    6,
    ["home"],
    { pm: { office: "chancellor" } },
    all(chapters(9, 10), bdx),
    [v("held", flag("w_marne_stopped")), base],
    {
      place: "bordeaux",
      fallback: "return_now",
      options: [
        opt("return_now", [unflag("f_gov_bordeaux"), gauge("morale", 1)]),
        opt("wait_spring", [chamber(-1), trustOf(pm, 1)]),
        opt("chambers_first", [
          unflag("f_gov_bordeaux"),
          chamber(1),
          senate(1),
          reason("fra_c_chambers_back"),
        ]),
      ],
    },
  ),
  scene(
    "fra_c_closing",
    "ledger",
    9,
    ["home", "foreign"],
    { pm: { office: "chancellor" } },
    chapters(11, 11),
    [
      v("alone", flag("f_alliance_broken")),
      v("bdx", all(inWar, bdx)),
      v("war", inWar),
      v("peace", not(inWar)),
      base,
    ],
    {
      stage: ["closing"],
      fallback: "close_year",
      options: [opt("close_year", [reason("fra_c_year_closed")])],
    },
  ),

  // ---- Viviani ----
  talk("fra_t_viviani_bargain", "fra_viviani", chapters(0, 2), {
    moods: ["anxious", "weary"],
    deal: [remember("k_viv_bargain"), trustOf(p, 1)],
    ask: [remember("k_viv_bargain")],
  }),
  talk(
    "fra_t_viviani_nerves",
    "fra_viviani",
    all(chapters(3, 5), crisis, not(sea)),
    {
      moods: ["anxious"],
      deal: [
        promise(p, "p_viv_rest", 24, {
          keep: chose("fra_h_viviani_tired", "let_him_rest"),
        }),
      ],
      ask: [remember("m_fra_viv_health")],
      press: [remember("m_fra_viv_health")],
    },
  ),
  talk("fra_t_viviani_quai", "fra_viviani", chapters(0, 5), {
    moods: ["weary"],
    deal: [remember("k_viv_quai")],
  }),
  talk("fra_t_viviani_union", "fra_viviani", all(chapters(5, 6), tempMin(7)), {
    moods: ["anxious"],
    deal: [remember("k_jau_party"), remember("m_fra_sembat_guesde")],
    ask: [remember("m_fra_sembat_guesde")],
  }),
  talk(
    "fra_t_viviani_chamber",
    "fra_viviani",
    all(sinceChapter(10, "15b"), viviani),
    {
      moods: ["weary"],
      deal: [trustOf(p, 1), chamber(1)],
      ask: [remember("m_fra_next_premier")],
    },
    { stage: WAR, once: false, cooldown: 6 },
  ),
  talk(
    "fra_t_viviani_after",
    "fra_viviani",
    all(period("15b", "18b"), not(viviani)),
    {
      moods: ["weary"],
      deal: [remember("k_viv_after")],
    },
    { stage: ["war"] },
  ),
  // ---- Messimy ----
  talk("fra_t_messimy_trains", "fra_messimy", chapters(0, 5), {
    moods: ["arrogant"],
    deal: [trustOf(p, 1), remember("m_fra_mob_days")],
    ask: [remember("m_fra_mob_days")],
  }),
  talk("fra_t_messimy_trousers", "fra_messimy", chapters(0, 3), {
    moods: ["anxious"],
    deal: [remember("k_mes_uniform")],
  }),
  talk("fra_t_messimy_joffre", "fra_messimy", chapters(3, 6), {
    moods: ["arrogant"],
    deal: [remember("k_jof_cover")],
  }),
  talk("fra_t_messimy_paris", "fra_messimy", all(chapters(6, 7), inWar), {
    moods: ["anxious"],
    deal: [remember("k_mes_stay")],
    ask: [remember("m_fra_gallieni_named")],
  }),
  talk(
    "fra_t_messimy_front",
    "fra_messimy",
    all(sinceChapter(8, "18b"), not(holds("war", "fra_messimy"))),
    {
      deal: [trustOf(p, 1)],
      ask: [remember("m_fra_division_morale")],
    },
    { stage: WAR, once: false, cooldown: 10 },
  ),
  talk(
    "fra_t_messimy_regret",
    "fra_messimy",
    all(
      chapters(7, 8),
      seen("fra_c_war_cabinet"),
      not(holds("war", "fra_messimy")),
    ),
    {
      moods: ["arrogant"],
      deal: [
        promise(p, "p_mes_return", 30, {
          keep: chose("fra_h_vacant", "press_own"),
        }),
      ],
      press: [trustOf(p, 1)],
    },
  ),
  // ---- Jaurès ----
  talk(
    "fra_t_jaures_peace",
    "fra_jaures",
    all(chapters(0, 5), any(chapters(0, 4), jl)),
    {
      moods: ["stubborn"],
      deal: [remember("k_jau_brussels")],
    },
  ),
  talk("fra_t_jaures_three", "fra_jaures", chapters(0, 2), {
    moods: ["anxious"],
    deal: [trustOf(p, 1), heat("fra_sfio", -1)],
    ask: [remember("m_fra_sfio_votes")],
  }),
  talk("fra_t_jaures_russia", "fra_jaures", chapters(1, 3), {
    moods: ["stubborn"],
    deal: [
      promise(p, "p_jau_no_promise", 3, {
        keep: any(
          chose("fra_c_petersburg", "soft_words"),
          chose("fra_c_petersburg", "promise_nothing"),
          chose("fra_c_petersburg", "warn_austrian"),
        ),
      }),
    ],
    ask: [remember("m_fra_jau_russia")],
    press: [trustOf(p, 1)],
  }),
  talk(
    "fra_t_jaures_party",
    "fra_jaures",
    all(chapters(4, 5), crisis, any(chapters(4, 4), jl)),
    {
      moods: ["anxious"],
      deal: [remember("k_jau_party")],
    },
  ),
  talk(
    "fra_t_jaures_threat",
    "fra_jaures",
    all(chapters(4, 5), crisis, any(chapters(4, 4), jl)),
    {
      moods: ["stubborn"],
      deal: [remember("k_mal_police")],
      press: [remember("k_mal_police")],
    },
  ),
  talk(
    "fra_t_jaures_after",
    "fra_jaures",
    all(sinceChapter(6, "18b"), jl),
    {
      moods: ["stubborn"],
      deal: [trustOf(p, 1), heat("fra_sfio", -1)],
      ask: [remember("m_fra_sfio_split")],
    },
    { stage: WAR, once: false, cooldown: 8 },
  ),
  // ---- Caillaux ----
  talk("fra_t_caillaux_trial", "fra_caillaux", chapters(1, 4), {
    moods: ["arrogant"],
    deal: [remember("k_cai_letters")],
  }),
  talk("fra_t_caillaux_berlin", "fra_caillaux", all(chapters(3, 5), crisis), {
    moods: ["cunning"],
    deal: [trustOf(p, 1), remember("m_fra_rubicon_hint")],
    ask: [remember("m_fra_rubicon_hint")],
  }),
  talk("fra_t_caillaux_tax", "fra_caillaux", chapters(0, 10), {
    moods: ["arrogant"],
    deal: [remember("k_cai_tax")],
  }),
  talk(
    "fra_t_caillaux_exile",
    "fra_caillaux",
    all(sinceChapter(7, "15b"), inWar),
    {
      moods: ["cunning"],
      deal: [
        promise(p, "p_cai_away", 20, {
          keep: { kind: "world", of: { is: "date", from: "1916-01" } },
        }),
      ],
      press: [trustOf(p, -1)],
    },
    { stage: WAR },
  ),
  talk(
    "fra_t_caillaux_peace",
    "fra_caillaux",
    all(period("16a", "17b"), inWar),
    {
      moods: ["cunning"],
      deal: [remember("k_cai_peace")],
      ask: [remember("m_fra_cai_terms")],
    },
    { stage: ["war"], once: false, cooldown: 8 },
  ),
  talk(
    "fra_t_caillaux_warn",
    "fra_caillaux",
    all(period("17b", "18a"), seen("fra_h_bolo")),
    {
      moods: ["arrogant"],
      deal: [remember("k_cai_warned")],
    },
    { stage: ["war"] },
  ),

  // ---- Visits ----
  visit(
    "fra_v_berthelot_desk",
    "fra_berthelot",
    chapters(1, 4),
    5,
    ["people", "foreign"],
    [remember("k_berth_desk")],
    [
      maybe(
        all(from(4), secret("fra_toul_verdun"), crisis),
        reveal("fra_toul_verdun"),
      ),
    ],
  ),
  visit(
    "fra_v_bienvenu_schoen",
    "fra_bienvenu_martin",
    all(chapters(3, 5), any(sea, crisis)),
    6,
    ["people", "foreign"],
    [remember("m_fra_schoen_words"), trustOf(p, 1)],
    [
      maybe(
        all(from(4), secret("fra_toul_verdun"), crisis),
        reveal("fra_toul_verdun"),
      ),
    ],
  ),
  visit(
    "fra_v_lanrezac_warn",
    "fra_lanrezac",
    all(chapters(4, 7), hot),
    5,
    ["people", "war"],
    [remember("k_lan_warn")],
    [maybe(secret("fra_offensive_doctrine"), reveal("fra_offensive_doctrine"))],
  ),
  visit(
    "fra_v_jouhaux_cgt",
    "fra_jouhaux",
    all(chapters(4, 6), crisis),
    5,
    ["people", "home"],
    [remember("k_jou_cgt")],
  ),
  visit(
    "fra_v_ferry_notebook",
    "fra_ferry",
    all(sinceChapter(8, "18a"), inWar),
    5,
    ["people", "war"],
    [remember("k_fer_front")],
    [remember("m_fra_ferry_notes")],
    { stage: WAR, once: false, cooldown: 8 },
  ),
  visit(
    "fra_v_sembat_book",
    "fra_sembat",
    chapters(0, 6),
    4,
    ["people", "home"],
    [trustOf(p, 1)],
    [remember("m_fra_sfio_majority")],
  ),
];
