import { GW_TAGS, GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  all,
  any,
  candid,
  chose,
  GwCastRule,
  GwCond,
  GwEffect,
  GwNode,
  GwOption,
  GwReact,
  GwReply,
  GwReplyKind,
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
  setFlag,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";

/**
 * Common share `frame` (plan ww135-plan-common.md section 8): the `gw_f_`
 * foreign figures any seat can meet and the `gw_e_` frame around the end. Data
 * only; text is in resources/ww1914/ko/common.frame.json, which also holds the
 * six common ending paragraphs. No form of address, no `voice`, no `chancellor`:
 * one line serves four countries.
 *
 * The plan's `gw_f_small_kings` is five talks here, one a person: a talk has one
 * `who`, and `any_of` always takes the first. An enemy doesn't call on a seat,
 * so each of the five has its own sides.
 */
const w = (of: Record<string, unknown>) => world(of as never);
const act = (of: Record<string, unknown>) => doWorld(of as never);

const everyone = [...GW_TAGS];
/** Plan section 0: the seats of a side, with the countries that come later. */
const CENTRAL_SEATS: GwTag[] = ["DEU", "AUH", "OTT", "BGR"];
const ENTENTE_SEATS: GwTag[] = ["GBR", "RUS", "FRA", "ITA", "SRB", "USA"];
const NOT_CENTRAL = everyone.filter((t) => !CENTRAL_SEATS.includes(t));

const side = (...of: string[]) => w({ is: "side", of });
const central = side("central");
const entente = side("entente");
/** Whole months of war; `own`: since the seat's country came in (ww170). */
const months = (min?: number, max?: number) =>
  w({ is: "war_months", min, max });
const ownMonths = (min?: number, max?: number) =>
  w({ is: "war_months", own: true, min, max });
/** Chapters since a country came in. */
const inWar = (tag: GwTag, min?: number, max?: number) =>
  w({ is: "in_war", tag, min, max });
const neutral = (tag: GwTag) => w({ is: "neutral", tag });
const entered = (tag: GwTag) => w({ is: "entered", tag });
const out = (tag: GwTag) => w({ is: "out", tag });
const exists = (id: string): GwCond => ({ kind: "secret", id });
const flagged = (flag: string): GwCond => ({ kind: "flag", flag });
const seen = (scene: string): GwCond => ({ kind: "seen", scene });
const america = (min?: number, max?: number) => w({ is: "america", min, max });
const ai = (tag: GwTag, ...of: string[]) => w({ is: "ai", tag, of });
const score = (min?: number, max?: number) => w({ is: "score", min, max });
/** The great war has begun, whoever is in it. */
const BIG_WAR = w({ is: "war_age", min: 0 });
const USA_IN = flagged("w_america_in");
const atGbr: GwCond = { kind: "at_war", tag: "GBR" };

const GBR_REGIMES = ["liberal", "coalition", "war_cabinet", "national"];
const seatGbr = w({ is: "regime", of: GBR_REGIMES });
const seatDeu = w({ is: "regime", of: ["empire", "republic"] });

const ARMISTICE = w({ is: "armistice" });
const COMPROMISE = w({ is: "armistice", of: ["compromise"] });
const WON = w({ is: "peace_side", of: ["won"] });
const LOST = w({ is: "peace_side", of: ["lost"] });

const fm: GwCastRule = { any_of: [{ office: "foreign" }, { favourite: true }] };
const cos: GwCastRule = {
  any_of: [{ office: "chief_of_staff" }, { favourite: true }],
};
const fin: GwCastRule = {
  any_of: [{ office: "finance" }, { favourite: true }],
};

const v = (id: string, when?: GwCond): GwVariant =>
  when === undefined ? { id } : { id, when };

/** Most talks open three ways: the seat's side, and the outsider as base. */
const SIDES: GwVariant[] = [
  v("central", central),
  v("entente", entente),
  v("neutral"),
];

const who = role("who");
const trust = (tag: GwTag, delta: number): GwEffect => ({
  kind: "trust",
  tag,
  delta,
});
const gauge = (
  g: "morale" | "money" | "order" | "shells",
  delta: number,
): GwEffect => ({ kind: "gauge", gauge: g, delta });
const authority = (delta: number) => act({ do: "authority", delta });
const readiness = (tag: GwTag, delta: number) =>
  act({ do: "readiness", tag, delta });
const america5 = (delta: number) => readiness("USA", delta);
const key = (k: string) => remember(k, who);
const say = (k: string) => reason(k, who);
/** A secret found, if this game has it. */
const reveal = (id: string): GwEffect => ({
  kind: "maybe",
  when: exists(id),
  then: [act({ do: "reveal", id })],
});
/**
 * On the replies out of a node whose line gave the secret away: `reveal` with
 * the line's own condition, so the shelf finds what the seat was really told.
 */
const learn = (id: string, when: GwCond = exists(id)): GwEffect[] => [
  { kind: "maybe", when, then: [act({ do: "reveal", id })] },
];
/** Trust with the seat's own side. */
const allies = (delta: number): GwEffect[] => [
  {
    kind: "maybe",
    when: central,
    then: [trust("DEU", delta), trust("AUH", delta)],
  },
  {
    kind: "maybe",
    when: entente,
    then: [trust("FRA", delta), trust("GBR", delta), trust("RUS", delta)],
  },
];

type ReplyOpts = Partial<
  Pick<GwReply, "when" | "tell" | "effects" | "reacts" | "gain" | "miss">
>;

function r(
  id: string,
  stance: GwStance,
  kind: GwReplyKind,
  next: string | null,
  o: ReplyOpts = {},
): GwReply {
  return { id, stance, kind, tell: [], effects: [], next, ...o };
}
const ask = (id: string, s: GwStance, next: string | null, o?: ReplyOpts) =>
  r(id, s, "ask", next, o);
const push = (id: string, s: GwStance, next: string | null, o?: ReplyOpts) =>
  r(id, s, "push", next, o);
const deal = (id: string, s: GwStance, next: string | null, o?: ReplyOpts) =>
  r(id, s, "deal", next, o);
const bye = (id = "end", s: GwStance = "warm", effects: GwEffect[] = []) =>
  r(id, s, "leave", null, { effects });

/** A says list: [id, when] pairs, ending in the plain `base`. */
function n(says: ([string, GwCond] | string)[], ...replies: GwReply[]): GwNode {
  return {
    says: says.map((x) => (typeof x === "string" ? v(x) : v(x[0], x[1]))),
    replies,
  };
}
const mood = (
  ...t: Parameters<typeof moody> extends [unknown, ...infer R] ? R : never
) => moody(who, ...t);
const react = (
  when: GwCond,
  next: string | null,
  effects: GwEffect[] = [],
): GwReact => ({
  when,
  next,
  effects,
});
const STRAIGHT = candid(who);

interface TalkOpts {
  nation?: GwTag[];
  /** The state the visit needs; months of war stand for how far on it is. */
  when: GwCond[];
  salience: number;
  tags?: GwScene["tags"];
  variants?: GwVariant[];
  /** Comes again after this many chapters; else once a game. */
  cooldown?: number;
  nodes: Record<string, GwNode>;
}

/** A foreign figure's visit: the desk deals it, nobody can summon them. */
function talk(id: string, person: string, o: TalkOpts): GwScene {
  return {
    id,
    // A later seat's own people are its own: they don't call on it as foreigners.
    nation: (o.nation ?? everyone).filter(
      (t) => t !== person.slice(0, 3).toUpperCase(),
    ),
    kind: "talk",
    when: all(not(ARMISTICE), ...o.when),
    cast: { who: { person } },
    salience: o.salience,
    tags: o.tags ?? ["foreign"],
    ...(o.cooldown === undefined ? { once: true } : { cooldown: o.cooldown }),
    variants: o.variants ?? SIDES,
    who: "who",
    start: "open",
    nodes: o.nodes,
  };
}

/**
 * Kept by the deed in another share's decision, whichever comes first; past the
 * date the person comes back with the common card. The dates reach the first
 * chapters those decisions can come in.
 */
const houseWord = promise(who, "p_house_word", 14, {
  keep: any(
    chose("gw_d_aims_asked", "secret_answer"),
    chose("gw_d_peace_reply", "ask_terms"),
  ),
});
const alfonsoList = promise(who, "p_alfonso_list", 12, {
  keep: chose("gw_d_prisoner_swap", "accept"),
});
const rouShells = promise(who, "p_rou_shells", 20, {
  keep: any(
    chose("gw_o_rou_moment", "supply_promise"),
    chose("gw_d_ally_shells", "big_share"),
  ),
});
const pasicReturn = promise(who, "p_pasic_return", 14, {
  keep: chose("gw_d_ally_fallen", "promise_return"),
});

const houseCliff = learn(
  "usa_credit_cliff",
  all(STRAIGHT, exists("usa_credit_cliff")),
);

const AMERICA: readonly GwScene[] = [
  talk("gw_f_house_visit", "usa_house", {
    when: [neutral("USA"), BIG_WAR, months(5)],
    salience: 7,
    tags: ["foreign", "tension_down"],
    nodes: {
      open: n(
        [
          ["berlin_hard", all(entente, ai("DEU", "hardline"))],
          ["berlin_soft", all(entente, ai("DEU", "cautious", "principled"))],
          ["weary", mood("weary")],
          "base",
        ],
        ask("heat", "frank", "heat"),
        ask("money", "cold", "money", { miss: "smile" }),
        push("press", "threat", "smile", {
          effects: [trustOf(who, -1)],
          reacts: [react(mood("weary"), "heat", [say("fr_house_tired")])],
        }),
        deal("terms", "warm", "heat", {
          tell: ["usa:+1", "ally:-1"],
          effects: [trust("USA", 1), ...allies(-1), setFlag("f_f_house_told")],
        }),
        bye("tea"),
      ),
      heat: n(
        [["hot", america(60)], ["warm", america(30, 59)], "base"],
        ask("wish", "flatter", "wish", { miss: "smile" }),
        bye(),
      ),
      money: n(
        [
          ["cliff", all(STRAIGHT, exists("usa_credit_cliff"))],
          ["straight", STRAIGHT],
          "base",
        ],
        ask("wish", "frank", "wish", { effects: houseCliff }),
        bye("end", "cold", houseCliff),
      ),
      wish: n([["straight", STRAIGHT], "base"], bye("note", "cold")),
      smile: n(["base"], bye()),
    },
  }),
  talk("gw_f_house_second", "usa_house", {
    when: [seen("gw_f_house_visit"), neutral("USA"), BIG_WAR, months(14)],
    salience: 7,
    tags: ["foreign", "tension_down"],
    nodes: {
      open: n(
        [
          ["told", flagged("f_f_house_told")],
          ["cunning", mood("cunning")],
          "base",
        ],
        ask("other", "cold", "other", {
          reacts: [react(mood("weary"), "other", [say("fr_house_tired")])],
        }),
        push("both", "threat", "cool", { effects: [trustOf(who, -1)] }),
        deal("word", "warm", "word", {
          tell: ["promise", "usa:+1"],
          effects: [trust("USA", 1), key("k_house_second"), houseWord],
        }),
        bye("end", "cold"),
      ),
      other: n(
        [["straight", STRAIGHT], "base"],
        deal("word", "frank", "word", {
          tell: ["promise"],
          effects: [key("k_house_second"), houseWord],
        }),
        ask("paper", "flatter", "paper", {
          gain: [key("k_house_second")],
          miss: "cool",
        }),
        bye(),
      ),
      word: n([["hot", america(50)], "base"], bye()),
      paper: n(["base"], bye()),
      cool: n(["base"], bye("end", "cold")),
    },
  }),
  talk("gw_f_wilson_note", "usa_wilson", {
    when: [any(USA_IN, america(70)), months(36)],
    salience: 7,
    nodes: {
      open: n(
        [
          [
            "broken",
            {
              kind: "promise",
              who: { person: "usa_house" },
              key: "p_house_word",
              broken: true,
            },
          ],
          ["central", central],
          ["entente", entente],
          "base",
        ],
        ask("clause", "frank", "clause", { gain: [key("k_wilson_terms")] }),
        ask("colonel", "warm", "wall", {
          reacts: [react(mood("cold"), "clause", [key("k_wilson_terms")])],
        }),
        push("reserve", "cold", "wall", {
          effects: [trustOf(who, -1)],
          reacts: [react(mood("cold"), "clause", [])],
        }),
        deal("accept", "frank", "clause", {
          tell: ["usa:+1", "ally:-1"],
          effects: [trust("USA", 1), ...allies(-1), key("k_wilson_terms")],
        }),
        bye("end", "cold"),
      ),
      clause: n(
        [["central", central], "base"],
        ask("mean", "cold", "mean"),
        bye(),
      ),
      mean: n(["base"], bye("end", "frank")),
      wall: n(["base"], bye("end", "cold")),
    },
  }),
  talk("gw_f_lansing_law", "usa_lansing", {
    when: [neutral("USA"), BIG_WAR, any(atGbr, seatGbr), months(11)],
    salience: 4,
    variants: [v("seat", seatGbr), v("base")],
    nodes: {
      open: n(
        [
          ["bryan", seen("gw_f_bryan_goes")],
          ["seat", seatGbr],
          ["cunning", mood("cunning")],
          "base",
        ],
        ask("mean", "cold", "mean", { miss: "note" }),
        ask("loans", "frank", "loans", {
          reacts: [react(mood("cold"), "loans", [])],
          miss: "note",
        }),
        push("protest", "threat", "note", { effects: [trustOf(who, -1)] }),
        deal("case", "warm", "mean", {
          tell: ["usa:+1", "money:-1"],
          effects: [trust("USA", 1), gauge("money", -1)],
        }),
        bye("end", "cold"),
      ),
      mean: n(
        [["seat", seatGbr], "base"],
        ask("loans", "cold", "loans"),
        bye(),
      ),
      loans: n(
        [["cliff", exists("usa_credit_cliff")], "base"],
        bye("thanks", "frank", learn("usa_credit_cliff")),
      ),
      note: n(["base"], bye("end", "cold")),
    },
  }),
  talk("gw_f_bryan_goes", "usa_bryan", {
    when: [flagged("w_liner_sunk"), neutral("USA"), months(5, 17)],
    salience: 4,
    tags: ["foreign", "tension_down"],
    variants: [v("central", central), v("base")],
    nodes: {
      open: n(
        [["anxious", mood("anxious")], ["stubborn", mood("stubborn")], "base"],
        ask("cabinet", "warm", "cabinet", {
          gain: [say("fr_bryan_told")],
        }),
        ask("note", "cold", "note", { miss: "sermon" }),
        push("stay", "threat", "sermon", {
          effects: [trustOf(who, -1)],
        }),
        deal("arbitrate", "frank", "cabinet", {
          tell: ["usa:+1", "morale:-1"],
          effects: [trust("USA", 1), gauge("morale", -1), america5(-3)],
        }),
        bye(),
      ),
      cabinet: n(
        [["stubborn", mood("stubborn")], "base"],
        ask("note", "frank", "note"),
        bye(),
      ),
      note: n(["base"], bye("end", "frank")),
      sermon: n(["base"], bye("end", "cold")),
    },
  }),
  talk("gw_f_pershing_no", "usa_pershing", {
    nation: ENTENTE_SEATS,
    when: [USA_IN, entente, inWar("USA", 0, 12)],
    salience: 5,
    tags: ["war"],
    variants: [v("late", inWar("USA", 6)), v("base")],
    nodes: {
      open: n(
        [["stubborn", mood("stubborn")], "base"],
        ask("when", "cold", "when"),
        push("mix", "threat", "no2", {
          effects: [trustOf(who, -1)],
        }),
        deal("rails", "frank", "when", {
          tell: ["shells:-1", "usa:+1"],
          effects: [
            gauge("shells", -1),
            trust("USA", 1),
            setFlag("f_f_pershing_fed"),
          ],
        }),
        bye("end", "cold"),
      ),
      when: n(
        [["fed", flagged("f_f_pershing_fed")], "base"],
        push("mix2", "frank", "no2"),
        bye(),
      ),
      no2: n(
        ["base"],
        push("mix3", "flatter", "no3", { effects: [trustOf(who, -1)] }),
        bye("end", "cold"),
      ),
      no3: n(["base"], bye("end", "cold")),
    },
  }),
];

const GO_BETWEENS: readonly GwScene[] = [
  talk("gw_f_benedict_letter", "vat_benedict", {
    when: [BIG_WAR, months(5)],
    salience: 5,
    tags: ["foreign", "tension_down"],
    nodes: {
      open: n(
        [["late", months(24)], ["weary", mood("weary")], "base"],
        ask("line", "frank", "line", { gain: [key("k_benedict_line")] }),
        push("sides", "cold", "sides", {
          effects: [trustOf(who, -1)],
          reacts: [react(mood("stubborn"), "sides", [key("k_benedict_line")])],
        }),
        deal("lists", "warm", "lists", {
          tell: ["morale:+1", "trust:+1"],
          effects: [
            gauge("morale", 1),
            trustOf(who, 1),
            key("k_benedict_line"),
          ],
        }),
        bye("end", "cold"),
      ),
      line: n(
        [["central", central], ["entente", entente], "base"],
        ask("lists", "warm", "lists"),
        bye(),
      ),
      sides: n(["base"], bye("end", "frank")),
      lists: n(["base"], bye()),
    },
  }),
  talk("gw_f_alfonso_office", "esp_alfonso", {
    when: [BIG_WAR, months(5)],
    salience: 5,
    tags: ["foreign", "tension_down"],
    cooldown: 16,
    nodes: {
      open: n(
        [
          ["again", seen("gw_f_alfonso_office")],
          ["cunning", mood("cunning")],
          "base",
        ],
        ask("name", "warm", "name", { gain: [key("k_alfonso_office")] }),
        ask("wide", "cold", "wide", { miss: "name" }),
        push("press", "threat", "palace", { effects: [trustOf(who, -1)] }),
        deal("list", "frank", "name", {
          when: not({
            kind: "promise",
            who,
            key: "p_alfonso_list",
          }),
          tell: ["promise", "trust:+1"],
          effects: [trustOf(who, 1), key("k_alfonso_office"), alfonsoList],
        }),
        bye("end", "cold"),
      ),
      name: n(
        [["list", { kind: "promise", who, key: "p_alfonso_list" }], "base"],
        bye(),
      ),
      wide: n(["base"], ask("name", "warm", "name"), bye()),
      palace: n(["base"], bye("end", "cold")),
    },
  }),
  talk("gw_f_ador_lists", "che_ador", {
    when: [BIG_WAR, months(5)],
    salience: 5,
    tags: ["foreign", "tension_down"],
    cooldown: 16,
    nodes: {
      open: n(
        [
          ["again", seen("gw_f_ador_lists")],
          ["stubborn", mood("stubborn")],
          "base",
        ],
        ask("count", "frank", "count", { gain: [key("k_ador_lists")] }),
        push("camps", "cold", "same", {
          effects: [trustOf(who, -1)],
          reacts: [react(mood("stubborn"), "same", [])],
        }),
        deal("inspect", "frank", "count", {
          tell: ["morale:-1", "trust:+1"],
          effects: [gauge("morale", -1), trustOf(who, 1), key("k_ador_lists")],
        }),
        bye(),
      ),
      count: n(
        [["weary", mood("weary")], "base"],
        ask("other", "warm", "other"),
        bye(),
      ),
      other: n(["base"], bye("end", "frank")),
      same: n(["base"], bye("end", "cold")),
    },
  }),
  talk("gw_f_andersen_cousins", "dnk_andersen", {
    when: [BIG_WAR, not(seen("deu_v2_andersen_call")), months(5)],
    salience: 5,
    tags: ["foreign", "tension_down"],
    variants: [v("central", central), v("base")],
    nodes: {
      open: n(
        [["cunning", mood("cunning")], ["weary", mood("weary")], "base"],
        ask("cousin", "warm", "cousin", { gain: [key("k_andersen_cousins")] }),
        ask("freight", "cold", "freight", { miss: "cargo" }),
        push("whose", "threat", "cargo", { effects: [trustOf(who, -1)] }),
        deal("carry", "frank", "cousin", {
          tell: ["ally:-1", "trust:+1"],
          effects: [...allies(-1), trustOf(who, 1), key("k_andersen_cousins")],
        }),
        bye(),
      ),
      cousin: n(["base"], ask("freight", "frank", "freight"), bye()),
      freight: n(["base"], bye("end", "cold")),
      cargo: n(["base"], bye("end", "cold")),
    },
  }),
];

const FRANCE: readonly GwScene[] = [
  talk("gw_f_joffre_plan", "fra_joffre", {
    nation: ENTENTE_SEATS,
    when: [entente, not(out("FRA")), ownMonths(5, 29)],
    salience: 5,
    tags: ["war"],
    variants: [v("late", ownMonths(17)), v("base")],
    nodes: {
      open: n(
        [["cold", mood("cold")], "base"],
        ask("month", "cold", "month", { gain: [key("k_joffre_plan")] }),
        push("alone", "threat", "lunch", { effects: [trustOf(who, -1)] }),
        deal("share", "frank", "month", {
          tell: ["shells:-1", "fra:+1"],
          effects: [gauge("shells", -1), trust("FRA", 1), key("k_joffre_plan")],
        }),
        bye(),
      ),
      month: n(
        [["stubborn", mood("stubborn")], "base"],
        ask("ready", "frank", "ready"),
        bye(),
      ),
      ready: n(["base"], bye("end", "cold")),
      lunch: n(["base"], bye("end", "cold")),
    },
  }),
  talk("gw_f_foch_unity", "fra_foch", {
    nation: ENTENTE_SEATS,
    // One command comes out of a breach in the west, late in a long war.
    when: [
      entente,
      not(out("FRA")),
      months(30),
      w({
        is: "battle",
        theatre: "west",
        of: ["break", "advance"],
        by: "foe",
      }),
    ],
    salience: 6,
    tags: ["war"],
    variants: [
      v(
        "spring",
        w({ is: "battle", theatre: "west", of: ["break"], by: "foe" }),
      ),
      v("base"),
    ],
    nodes: {
      open: n(
        [
          ["pershing", seen("gw_f_pershing_no")],
          ["arrogant", mood("arrogant")],
          "base",
        ],
        ask("one", "flatter", "one", {
          gain: [key("k_foch_unity")],
          miss: "lecture",
        }),
        push("own", "cold", "lecture", {
          effects: [trustOf(who, -1)],
          reacts: [react(mood("stubborn"), "one", [])],
        }),
        deal("yield", "frank", "one", {
          tell: ["army:-1", "fra:+1"],
          effects: [
            { kind: "inst", inst: "army", delta: -1 },
            trust("FRA", 1),
            key("k_foch_unity"),
          ],
        }),
        bye("end", "cold"),
      ),
      one: n(["base"], ask("reserve", "frank", "reserve"), bye()),
      reserve: n(["base"], bye("end", "frank")),
      lecture: n(["base"], bye("end", "cold")),
    },
  }),
  talk("gw_f_clemenceau_tiger", "fra_clemenceau", {
    // The Tiger: France's morale at the bottom, or his cabinet already in.
    when: [
      not(out("FRA")),
      months(30),
      any(
        { kind: "nation_gauge", tag: "FRA", gauge: "morale", max: 2 },
        w({ is: "regime", tag: "FRA", of: ["fra_tiger"] }),
      ),
    ],
    salience: 6,
    tags: ["foreign", "tension_up"],
    nodes: {
      open: n(
        [["central", central], ["entente", entente], "base"],
        ask("hold", "frank", "hold", { miss: "bite" }),
        ask("deserters", "cold", "army", { miss: "bite" }),
        push("press", "threat", "bite", { effects: [trustOf(who, -1)] }),
        deal("all_in", "flatter", "hold", {
          when: entente,
          tell: ["fra:+1", "manpower:-1"],
          effects: [trust("FRA", 1), act({ do: "manpower", delta: -1 })],
        }),
        bye("end", "cold"),
      ),
      hold: n(
        [
          [
            "low",
            { kind: "nation_gauge", tag: "FRA", gauge: "morale", max: 2 },
          ],
          ["central", central],
          "base",
        ],
        ask("deserters", "cold", "army"),
        bye(),
      ),
      army: n(
        [
          ["rumour", all(central, exists("fra_army_refusals"))],
          ["refusals", exists("fra_army_refusals")],
          "base",
        ],
        bye("note", "cold", learn("fra_army_refusals")),
      ),
      bite: n([["central", central], "base"], bye("end", "cold")),
    },
  }),
];

const treatyDead = learn(
  "rou_treaty_dead",
  all(STRAIGHT, exists("rou_treaty_dead")),
);

const PRICES: readonly GwScene[] = [
  talk("gw_f_sonnino_bill", "ita_sonnino", {
    when: [neutral("ITA"), BIG_WAR, months(3)],
    salience: 6,
    nodes: {
      open: n(
        [
          ["giolitti", memory("k_giolitti_word")],
          ["hard_vienna", all(seatDeu, ai("AUH", "hardline"))],
          ["stubborn", mood("stubborn")],
          "base",
        ],
        ask("clause", "cold", "clause", { gain: [key("k_sonnino_bill")] }),
        ask("other", "frank", "other", { miss: "seven" }),
        push("lower", "threat", "seven", { effects: [trustOf(who, -1)] }),
        deal("paper", "cold", "clause", {
          tell: ["ita:+1", "money:-1"],
          effects: [trust("ITA", 1), gauge("money", -1), key("k_sonnino_bill")],
        }),
        bye("end", "cold"),
      ),
      clause: n(
        [["central", central], "base"],
        ask("other", "cold", "other"),
        bye(),
      ),
      other: n(
        [["two_prices", all(STRAIGHT, exists("ita_price_list"))], "base"],
        bye(
          "note",
          "cold",
          learn("ita_price_list", all(STRAIGHT, exists("ita_price_list"))),
        ),
      ),
      seven: n(["base"], bye("end", "cold")),
    },
  }),
  talk("gw_f_giolitti_word", "ita_giolitti", {
    when: [neutral("ITA"), BIG_WAR, months(2)],
    salience: 5,
    variants: [v("central", central), v("base")],
    nodes: {
      open: n(
        [
          ["heard", memory("k_sonnino_bill")],
          ["weary", mood("weary")],
          ["cunning", mood("cunning")],
          "base",
        ],
        ask("house", "frank", "house", { gain: [key("k_giolitti_word")] }),
        ask("old", "warm", "old", { miss: "house" }),
        push("promise", "threat", "cavour", { effects: [trustOf(who, -1)] }),
        deal("much", "warm", "house", {
          tell: ["ita:+1", "ally:-1"],
          effects: [trust("ITA", 1), ...allies(-1), key("k_giolitti_word")],
        }),
        bye(),
      ),
      house: n(
        [["straight", STRAIGHT], "base"],
        ask("old", "warm", "old"),
        bye(),
      ),
      old: n(
        [
          [
            "both",
            all(
              STRAIGHT,
              exists("ita_fra_understanding"),
              exists("ita_price_list"),
            ),
          ],
          ["letter", all(STRAIGHT, exists("ita_fra_understanding"))],
          ["straight", STRAIGHT],
          "base",
        ],
        bye("note", "frank", [
          ...learn(
            "ita_fra_understanding",
            all(STRAIGHT, exists("ita_fra_understanding")),
          ),
          ...learn(
            "ita_price_list",
            all(
              STRAIGHT,
              exists("ita_fra_understanding"),
              exists("ita_price_list"),
            ),
          ),
        ]),
      ),
      cavour: n(["base"], bye("end", "cold")),
    },
  }),
  talk("gw_f_talat_hedge", "ott_talat", {
    when: [neutral("OTT"), BIG_WAR],
    salience: 5,
    variants: [v("central", central), v("base")],
    nodes: {
      open: n(
        [["cold", mood("cold")], "base"],
        ask("who", "cold", "who", { gain: [key("k_talat_hedge")] }),
        push("straits", "threat", "smile", { effects: [trustOf(who, -1)] }),
        deal("loan", "frank", "who", {
          tell: ["money:-1", "trust:+1"],
          effects: [gauge("money", -1), trustOf(who, 1), key("k_talat_hedge")],
        }),
        bye("end", "cold"),
      ),
      who: n(
        [["straight", STRAIGHT], "base"],
        ask("wire", "frank", "wire"),
        bye(),
      ),
      wire: n(["base"], bye("end", "cold")),
      smile: n(["base"], bye("end", "cold")),
    },
  }),
  talk("gw_f_talat_late", "ott_talat", {
    when: [
      entered("OTT"),
      inWar("OTT", 24),
      not(out("OTT")),
      any(all(central, score(undefined, -15)), all(entente, score(15))),
    ],
    salience: 4,
    variants: [v("central", central), v("base")],
    nodes: {
      open: n(
        [["central", central], ["cunning", mood("cunning")], "base"],
        ask("swiss", "cold", "swiss", { gain: [key("k_talat_feelers")] }),
        push("sign", "threat", "wire", { effects: [trustOf(who, -1)] }),
        deal("hear", "frank", "swiss", {
          tell: ["ally:-1"],
          effects: [...allies(-1), key("k_talat_feelers")],
        }),
        bye("end", "cold"),
      ),
      swiss: n(
        [["feelers", exists("ott_peace_feelers")], "base"],
        bye("note", "cold", learn("ott_peace_feelers")),
      ),
      wire: n(["base"], bye("end", "cold")),
    },
  }),
  talk("gw_f_venizelos_call", "grc_venizelos", {
    when: [neutral("GRC"), BIG_WAR, months(5)],
    salience: 5,
    variants: [v("central", central), v("base")],
    nodes: {
      open: n(
        [
          ["heard_king", memory("k_constantine_no")],
          [
            "thessaloniki",
            all(
              months(24),
              any(seen("gw_o_grc_schism"), flagged("w_serbia_fallen")),
            ),
          ],
          ["stubborn", mood("stubborn")],
          "base",
        ],
        ask("map", "warm", "map", { gain: [key("k_venizelos_call")] }),
        push("king", "cold", "island", {
          reacts: [react(mood("cunning"), "map", [])],
        }),
        deal("smyrna", "flatter", "map", {
          tell: ["ally:-1", "trust:+1"],
          effects: [...allies(-1), trustOf(who, 1), key("k_venizelos_call")],
        }),
        bye(),
      ),
      map: n(["base"], ask("army", "frank", "army"), bye()),
      army: n(["base"], bye("end", "frank")),
      island: n(["base"], bye("end", "cold")),
    },
  }),
  talk("gw_f_constantine_no", "grc_constantine", {
    when: [neutral("GRC"), BIG_WAR, months(5)],
    salience: 5,
    variants: [v("central", central), v("base")],
    nodes: {
      open: n(
        [
          ["heard_cretan", memory("k_venizelos_call")],
          ["cold", mood("cold")],
          "base",
        ],
        ask("army", "frank", "army", { gain: [key("k_constantine_no")] }),
        push("fleet", "threat", "greek", {
          effects: [trustOf(who, -1)],
        }),
        deal("leave_be", "frank", "army", {
          tell: ["trust:+1", "ally:-1"],
          effects: [trustOf(who, 1), ...allies(-1), key("k_constantine_no")],
        }),
        bye("end", "cold"),
      ),
      army: n(
        [["straight", STRAIGHT], "base"],
        ask("sister", "cold", "sister", { miss: "greek" }),
        bye(),
      ),
      sister: n(
        [["letters", exists("grc_king_letters")], "base"],
        bye("note", "cold", learn("grc_king_letters")),
      ),
      greek: n(["base"], bye("end", "cold")),
    },
  }),
  talk("gw_f_ferdinand_bargain", "bgr_ferdinand", {
    when: [neutral("BGR"), BIG_WAR, months(5)],
    salience: 6,
    nodes: {
      open: n(
        [["arrogant", mood("arrogant")], ["cunning", mood("cunning")], "base"],
        ask("beetle", "flatter", "price", {
          gain: [key("k_ferdinand_bargain")],
        }),
        ask("signed", "cold", "signed", { miss: "pin" }),
        push("now", "threat", "pin", { effects: [trustOf(who, -1)] }),
        deal("all", "warm", "price", {
          tell: ["ally:-1", "trust:+1"],
          effects: [...allies(-1), trustOf(who, 1), key("k_ferdinand_bargain")],
        }),
        bye(),
      ),
      price: n(
        [["central", central], "base"],
        ask("signed", "frank", "signed", { miss: "pin" }),
        bye(),
      ),
      signed: n(
        [
          [
            "both",
            all(exists("bgr_macedonia_signed"), exists("bgr_loan_berlin")),
          ],
          ["ink", exists("bgr_macedonia_signed")],
          ["loan", exists("bgr_loan_berlin")],
          "base",
        ],
        bye("note", "cold", [
          ...learn("bgr_macedonia_signed"),
          ...learn("bgr_loan_berlin"),
        ]),
      ),
      pin: n(["base"], bye("end", "cold")),
    },
  }),
  talk("gw_f_bratianu_maps", "rou_bratianu", {
    when: [neutral("ROU"), BIG_WAR, months(5)],
    salience: 6,
    nodes: {
      open: n(
        [
          ["queen", memory("k_marie_letter")],
          ["cold", mood("cold")],
          ["cunning", mood("cunning")],
          "base",
        ],
        ask("map", "cold", "map", { gain: [key("k_bratianu_maps")] }),
        ask("shells", "frank", "shells", { miss: "salon" }),
        push("date", "threat", "salon", { effects: [trustOf(who, -1)] }),
        deal("supply", "warm", "shells", {
          when: entente,
          tell: ["promise", "trust:+1"],
          effects: [trustOf(who, 1), key("k_bratianu_maps"), rouShells],
        }),
        deal("grain", "warm", "map", {
          when: not(entente),
          tell: ["money:-1", "trust:+1"],
          effects: [
            gauge("money", -1),
            trustOf(who, 1),
            key("k_bratianu_maps"),
          ],
        }),
        bye(),
      ),
      map: n(
        [["dead", all(STRAIGHT, exists("rou_treaty_dead"))], "base"],
        ask("shells", "frank", "shells", { effects: treatyDead }),
        bye("end", "warm", treatyDead),
      ),
      shells: n(
        [["gap", all(STRAIGHT, exists("rou_shell_gap"))], "base"],
        bye(
          "note",
          "cold",
          learn("rou_shell_gap", all(STRAIGHT, exists("rou_shell_gap"))),
        ),
      ),
      salon: n(["base"], bye("end", "cold")),
    },
  }),
  talk("gw_f_marie_letter", "rou_marie", {
    nation: ENTENTE_SEATS,
    when: [neutral("ROU"), entente, ownMonths(11)],
    salience: 5,
    variants: [v("late", months(19)), v("base")],
    nodes: {
      open: n(
        [
          ["heard_maps", memory("k_bratianu_maps")],
          ["arrogant", mood("arrogant")],
          "base",
        ],
        ask("king", "flatter", "king", { gain: [key("k_marie_letter")] }),
        push("hurry", "cold", "proud", {
          reacts: [react(mood("stubborn"), "king", [])],
        }),
        deal("hospital", "warm", "king", {
          tell: ["money:-1", "trust:+1"],
          effects: [gauge("money", -1), trustOf(who, 1), key("k_marie_letter")],
        }),
        bye(),
      ),
      king: n(["base"], ask("shells", "frank", "shells"), bye()),
      shells: n(
        [["gap", exists("rou_shell_gap")], "base"],
        bye("note", "warm", learn("rou_shell_gap")),
      ),
      proud: n(["base"], bye("end", "cold")),
    },
  }),
];

const chinaList = learn(
  "jpn_china_list",
  all(STRAIGHT, exists("jpn_china_list")),
);

const SMALL_KINGS: readonly GwScene[] = [
  talk("gw_f_small_kings_albert", "bel_albert", {
    when: [BIG_WAR, entered("BEL"), not(out("DEU")), months(5)],
    salience: 5,
    nodes: {
      open: n(
        [["cold", mood("cold")], "base"],
        ask("hold", "frank", "hold"),
        push("promise", "cold", "fact", {
          effects: [trustOf(who, -1)],
          reacts: [react(mood("cold"), "hold", [])],
        }),
        deal("whole", "frank", "hold", {
          tell: ["ally:-1", "trust:+1"],
          effects: [...allies(-1), trustOf(who, 1), setFlag("f_f_albert_word")],
        }),
        bye("end", "cold"),
      ),
      hold: n(["base"], ask("after", "cold", "after"), bye()),
      after: n([["central", central], "base"], bye("end", "frank")),
      fact: n(["base"], bye("end", "cold")),
    },
  }),
  talk("gw_f_small_kings_pasic", "srb_pasic", {
    nation: NOT_CENTRAL,
    when: [not(central), BIG_WAR, months(5)],
    salience: 5,
    variants: [v("corfu", flagged("w_serbia_fallen")), v("base")],
    nodes: {
      open: n(
        [
          ["corfu", flagged("w_serbia_fallen")],
          ["stubborn", mood("stubborn")],
          "base",
        ],
        ask("tomorrow", "frank", "tomorrow", {
          gain: [key("k_pasic_tomorrow")],
        }),
        ask("knew", "cold", "knew", { miss: "beard" }),
        push("yield", "threat", "beard", { effects: [trustOf(who, -1)] }),
        deal("return", "warm", "tomorrow", {
          when: flagged("w_serbia_fallen"),
          tell: ["promise", "trust:+1"],
          effects: [trustOf(who, 1), key("k_pasic_tomorrow"), pasicReturn],
        }),
        deal("chair", "warm", "tomorrow", {
          when: not(flagged("w_serbia_fallen")),
          tell: ["trust:+1", "ally:-1"],
          effects: [trustOf(who, 1), ...allies(-1), key("k_pasic_tomorrow")],
        }),
        bye(),
      ),
      tomorrow: n(["base"], ask("knew", "cold", "knew"), bye()),
      knew: n(["base"], bye("end", "cold")),
      beard: n(["base"], bye("end", "cold")),
    },
  }),
  talk("gw_f_small_kings_kato", "jpn_kato", {
    nation: NOT_CENTRAL,
    when: [not(central), entered("JPN"), inWar("JPN", 2, 10)],
    salience: 5,
    variants: [v("entente", entente), v("base")],
    nodes: {
      open: n(
        [["stubborn", mood("stubborn")], "base"],
        ask("bill", "cold", "bill", { gain: [key("k_kato_bill")] }),
        push("china", "threat", "london", { effects: [trustOf(who, -1)] }),
        deal("ships", "frank", "bill", {
          tell: ["trust:+1", "ally:-1"],
          effects: [trustOf(who, 1), ...allies(-1), key("k_kato_bill")],
        }),
        bye("end", "cold"),
      ),
      bill: n(
        [["list", all(STRAIGHT, exists("jpn_china_list"))], "base"],
        ask("tsingtao", "frank", "tsingtao", { effects: chinaList }),
        bye("end", "warm", chinaList),
      ),
      tsingtao: n(
        [["plan", exists("jpn_tsingtao_plan")], "base"],
        bye("end", "cold", learn("jpn_tsingtao_plan")),
      ),
      london: n(["base"], bye("end", "cold")),
    },
  }),
  talk("gw_f_small_kings_hussein", "ott_hussein", {
    nation: ENTENTE_SEATS,
    when: [entente, { kind: "at_war", tag: "OTT" }, ownMonths(11)],
    salience: 5,
    variants: [v("risen", months(22)), v("base")],
    nodes: {
      open: n(
        [["stubborn", mood("stubborn")], ["cunning", mood("cunning")], "base"],
        ask("lines", "warm", "lines", { gain: [key("k_hussein_lines")] }),
        push("rise", "threat", "sons", { effects: [trustOf(who, -1)] }),
        deal("gold", "frank", "lines", {
          tell: ["money:-1", "ally:-1"],
          effects: [gauge("money", -1), ...allies(-1), key("k_hussein_lines")],
        }),
        bye(),
      ),
      lines: n(["base"], ask("sons", "cold", "sons"), bye()),
      sons: n(["base"], bye("end", "cold")),
    },
  }),
  talk("gw_f_small_kings_enver", "ott_enver", {
    nation: CENTRAL_SEATS,
    when: [central, entered("OTT"), not(out("OTT")), ownMonths(5)],
    salience: 5,
    variants: [
      v(
        "late",
        any(
          out("RUS"),
          w({ is: "regime", tag: "RUS", of: ["provisional", "rep", "soviet"] }),
        ),
      ),
      v("base"),
    ],
    nodes: {
      open: n(
        [
          ["talat", memory("k_talat_hedge")],
          ["arrogant", mood("arrogant")],
          "base",
        ],
        ask("map", "flatter", "map"),
        ask("forts", "cold", "forts", {
          miss: "wide",
          gain: [reveal("ott_forts_short")],
        }),
        push("count", "threat", "wide", { effects: [trustOf(who, -1)] }),
        deal("guns", "frank", "forts", {
          tell: ["shells:-1", "trust:+1"],
          effects: [
            gauge("shells", -1),
            trustOf(who, 1),
            reveal("ott_forts_short"),
          ],
        }),
        bye(),
      ),
      map: n(["base"], ask("forts", "frank", "forts"), bye()),
      forts: n(
        [["short", exists("ott_forts_short")], "base"],
        r("note", "cold", "leave", null),
      ),
      wide: n(["base"], bye("end", "cold")),
    },
  }),
];

/** The fighting stopped, seen from where the seat stands. */
const STOPPED: GwVariant[] = [
  v("compromise", COMPROMISE),
  v("won", WON),
  v("lost", LOST),
  v("base"),
];

/** After the conference opens: each of these waits for the seat at the table. */
const AT_THE_TABLE = all(
  ARMISTICE,
  any(seen("gw_e_conference_seat"), seen("gw_e_terms_read")),
);

const opt = (
  id: string,
  tell: string[],
  effects: GwEffect[],
  when?: GwCond,
): GwOption =>
  when === undefined ? { id, tell, effects } : { id, tell, effects, when };

type DecisionOpts = Pick<GwScene, "when" | "cast" | "salience" | "tags"> & {
  variants: GwVariant[];
};

/** Once a game; the first option is what a timer signs. */
function decision(id: string, o: DecisionOpts, options: GwOption[]): GwScene {
  return {
    id,
    nation: everyone,
    kind: "proposal",
    once: true,
    ...o,
    fallback: options[0].id,
    options,
  };
}

const wilsonRead = memory("k_wilson_terms");

/** Every form of government with another form after it. */
const HAS_NEXT = w({
  is: "regime",
  of: [
    "empire",
    "liberal",
    "coalition",
    "war_cabinet",
    "dual_monarchy",
    "karl",
    "ff_throne",
    "tsar",
    "crown",
    "regency",
  ],
});
/** The seat's own top of the ladder has been and gone, and it still stands there. */
const LADDER_ANSWERED = any(
  ...[
    "gw_home_deu_4",
    "gw_home_gbr_4",
    "gw_home_auh_4",
    "gw_home_rus_4",
    "deu_k_republic",
    "auh_k_new_form",
    "rus_r_abdication",
    "gw_unrest",
  ].map(seen),
);

const END: readonly GwScene[] = [
  {
    id: "gw_e_armistice_wire",
    nation: everyone,
    kind: "wire",
    when: ARMISTICE,
    cast: {},
    salience: 9,
    tags: ["foreign", "tension_down"],
    once: true,
    variants: STOPPED,
  },
  decision(
    "gw_e_terms_read",
    {
      when: ARMISTICE,
      cast: { fm },
      salience: 8,
      tags: ["foreign"],
      variants: [
        v(
          "carved",
          all(WON, {
            kind: "chose",
            scene: "gw_d_carve_ottoman",
            pick: "sign",
          }),
        ),
        v("treaty", all(any(WON, COMPROMISE), flagged("w_treaty_kept"))),
        ...STOPPED,
      ],
    },
    [
      opt("sign", [], [setFlag("f_e_signed"), reason("e_terms_signed")]),
      opt(
        "protest_and_sign",
        ["morale:+1", "usa:-1"],
        [
          gauge("morale", 1),
          trust("USA", -1),
          setFlag("f_e_protested"),
          reason("e_terms_protest"),
        ],
      ),
      opt(
        "ask_better",
        ["usa:+1", "ally:-1"],
        [
          trust("USA", 1),
          ...allies(-1),
          setFlag("f_e_asked_better"),
          reason("e_terms_better"),
        ],
        wilsonRead,
      ),
    ],
  ),
  decision(
    "gw_e_conference_seat",
    {
      when: ARMISTICE,
      cast: { fm },
      salience: 8,
      tags: ["foreign"],
      variants: STOPPED,
    },
    [
      opt("send_fm", ["fm:+1"], [trustOf(role("fm"), 1), reason("e_seat_fm")]),
      opt(
        "go_in_person",
        ["authority:+5", "fm:-1"],
        [
          authority(5),
          trustOf(role("fm"), -1),
          setFlag("f_e_in_person"),
          reason("e_seat_person"),
        ],
      ),
      opt(
        "send_expert",
        ["fm:-1", "usa:+1"],
        [
          trustOf(role("fm"), -1),
          trust("USA", 1),
          setFlag("f_e_experts"),
          reason("e_seat_expert"),
        ],
      ),
    ],
  ),
  decision(
    "gw_e_borders",
    {
      when: AT_THE_TABLE,
      cast: { fm },
      salience: 8,
      tags: ["foreign"],
      variants: STOPPED,
    },
    [
      opt(
        "hold_treaty",
        ["ally:+1", "usa:-1"],
        [
          ...allies(1),
          trust("USA", -1),
          setFlag("f_e_held_treaty"),
          reason("e_borders_held"),
        ],
      ),
      opt(
        "trade_land",
        ["ally:-1", "money:+1"],
        [
          ...allies(-1),
          gauge("money", 1),
          setFlag("f_e_traded_land"),
          reason("e_borders_traded"),
        ],
      ),
      opt(
        "follow_wilson",
        ["usa:+1", "ally:-1"],
        [
          trust("USA", 1),
          ...allies(-1),
          setFlag("f_e_followed_wilson"),
          reason("e_borders_wilson"),
        ],
        wilsonRead,
      ),
    ],
  ),
  decision(
    "gw_e_reparations",
    {
      when: AT_THE_TABLE,
      cast: { fin },
      salience: 7,
      tags: ["foreign"],
      variants: [
        v("compromise", COMPROMISE),
        v("won", WON),
        v("lost", LOST),
        v("base"),
      ],
    },
    [
      opt(
        "full_bill",
        ["usa:-1", "morale:+1"],
        [
          trust("USA", -1),
          gauge("morale", 1),
          setFlag("f_e_full_bill"),
          reason("e_bill_full"),
        ],
      ),
      opt(
        "moderate",
        ["finance:+1", "ally:-1"],
        [
          trustOf(role("fin"), 1),
          ...allies(-1),
          setFlag("f_e_moderate_bill"),
          reason("e_bill_moderate"),
        ],
      ),
      opt(
        "none",
        ["usa:+1", "morale:-1"],
        [
          trust("USA", 1),
          gauge("morale", -1),
          setFlag("f_e_no_bill"),
          reason("e_bill_none"),
        ],
      ),
    ],
  ),
  decision(
    "gw_e_league",
    {
      when: all(AT_THE_TABLE, any(wilsonRead, entered("USA"))),
      cast: { fm },
      salience: 6,
      tags: ["foreign", "tension_down"],
      variants: [
        v("compromise", COMPROMISE),
        v("won", WON),
        v("lost", LOST),
        v("base"),
      ],
    },
    [
      opt("join", ["usa:+1"], [trust("USA", 1), setFlag("f_e_league")]),
      opt(
        "stay_out",
        ["authority:+5", "usa:-1"],
        [
          authority(5),
          trust("USA", -1),
          setFlag("f_e_no_league"),
          reason("e_league_out"),
        ],
      ),
      opt(
        "join_with_reserve",
        ["fm:+1", "usa:-1"],
        [
          trustOf(role("fm"), 1),
          trust("USA", -1),
          setFlag("f_e_league_reserved"),
          reason("e_league_reserve"),
        ],
      ),
    ],
  ),
  {
    id: "gw_e_new_nations",
    nation: everyone,
    kind: "report",
    when: any(ARMISTICE, out("AUH"), out("RUS")),
    cast: {},
    salience: 6,
    tags: ["foreign"],
    once: true,
    stamp: "confirmed",
    source: "press",
    variants: [
      v("both", all(out("AUH"), out("RUS"))),
      v("danube", out("AUH")),
      v("east", out("RUS")),
      v("base"),
    ],
  },
  // A record card (plan section 13): no option, no price, no comment. The
  // armistice brings it, or the east's exchange where Russia left first.
  {
    id: "gw_e_prisoners_home",
    nation: everyone,
    kind: "report",
    when: any(ARMISTICE, out("RUS")),
    cast: {},
    salience: 5,
    tags: ["home", "tension_down"],
    once: true,
    stamp: "confirmed",
    source: "press",
    variants: [v("east", not(ARMISTICE)), v("long", months(35)), v("base")],
  },
  decision(
    "gw_e_demobilise",
    {
      when: ARMISTICE,
      cast: { cos },
      salience: 5,
      tags: ["home"],
      variants: [
        v("compromise", COMPROMISE),
        v("won", WON),
        v("lost", LOST),
        v("base"),
      ],
    },
    [
      opt(
        "fast",
        ["morale:+1", "order:-1"],
        [gauge("morale", 1), gauge("order", -1), reason("e_demob_fast")],
      ),
      opt(
        "slow",
        ["order:+1", "morale:-1"],
        [gauge("order", 1), gauge("morale", -1), reason("e_demob_slow")],
      ),
      opt(
        "keep_volunteers",
        ["cos:+1", "order:-1"],
        [
          trustOf(role("cos"), 1),
          gauge("order", -1),
          setFlag("f_e_volunteers"),
          reason("e_demob_volunteers"),
        ],
      ),
    ],
  ),
  // The last word at the top of the ladder: the seat's own scene came, the
  // ladder still stands there, and this form has another after it.
  decision(
    "gw_e_continue",
    {
      when: all(
        world({ is: "war_months", min: 5 }),
        w({ is: "unrest", min: 4 }),
        HAS_NEXT,
        LADDER_ANSWERED,
      ),
      cast: {},
      salience: 8,
      tags: ["home"],
      variants: [
        v("deu", w({ is: "regime", of: ["empire"] })),
        v(
          "gbr",
          w({ is: "regime", of: ["liberal", "coalition", "war_cabinet"] }),
        ),
        v(
          "auh",
          w({ is: "regime", of: ["dual_monarchy", "karl", "ff_throne"] }),
        ),
        v("base"),
      ],
    },
    [
      opt("close_seat", ["ends_game"], [act({ do: "close_seat" })]),
      opt("go_on", ["regime_change"], [act({ do: "next_regime" })]),
      opt(
        "hand_over_and_close",
        ["ends_game"],
        [setFlag("f_e_handed_over"), act({ do: "close_seat" })],
      ),
    ],
  ),
  {
    id: "gw_e_deadline",
    nation: everyone,
    kind: "wire",
    stage: ["closing"],
    when: all(world({ is: "war_months", min: 47 }), BIG_WAR, not(ARMISTICE)),
    cast: {},
    salience: 7,
    tags: ["war"],
    once: true,
    variants: [v("ahead", score(15)), v("base")],
  },
  {
    id: "gw_e_memoir_frame",
    nation: everyone,
    kind: "wire",
    stage: ["closing"],
    cast: {},
    salience: 9,
    tags: ["tension_down"],
    once: true,
    variants: [v("never", not(BIG_WAR)), ...STOPPED],
  },
];

export const GW_FRAME_SCENES: readonly GwScene[] = [
  ...AMERICA,
  ...GO_BETWEENS,
  ...FRANCE,
  ...PRICES,
  ...SMALL_KINGS,
  ...END,
];
