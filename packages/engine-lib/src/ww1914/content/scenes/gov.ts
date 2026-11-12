import type {
  GwInstitution,
  GwOffice,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwChamber } from "@openfront/engine-api/ww1914/GwHouse";
import {
  all,
  any,
  assuming,
  candid,
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
  promise,
  reason,
  remember,
  role,
  setFlag,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import { GOV_FRA_SCENES } from "./gov_fra";

/**
 * The threats to a government (brief ww142, engine GovTable). `gov_<row>_<n>`
 * are called by the row's heat and never drawn; a row's first scene is a talk,
 * where the seat finds out who stands where and what they would take. Its
 * `k_gov_*` memory opens an option in the row's later scenes. The last scene of
 * a fatal row can end the game: nobody takes the seat's place. Text is in
 * resources/ww1914/ko/<TAG>.gov.json.
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
const gauge = (
  g: Extract<GwEffect, { kind: "gauge" }>["gauge"],
  delta: number,
): GwEffect => ({ kind: "gauge", gauge: g, delta });
const heat = (id: string, delta: number) =>
  doWorld({ do: "gov_heat", id, delta });
const beat = (id: string) => doWorld({ do: "gov_beaten", id });
const authority = (delta: number) => doWorld({ do: "authority", delta });
const hasAuthority = (min: number) => world({ is: "authority", min });
const end = (ending: string): GwEffect => ({ kind: "end", ending });
const maybe = (when: GwCond, ...then: GwEffect[]): GwEffect => ({
  kind: "maybe",
  when,
  then,
});
/** A deal is kept where its row's paper comes: it comes, whatever the heat. */
const soon = (row: string) => doWorld({ do: "gov_soon", id: row });
const unflag = (f: string): GwEffect => ({ kind: "unflag", flag: f });
const dismissChancellor: GwEffect = {
  kind: "dismiss",
  who: { office: "chancellor" },
};
const again = (id: string) => memory(`gov_held_${id}`);
const atWar = world({ is: "war" });
const regime = (...of: string[]) => world({ is: "regime", of });
const known = (id: "rus_palace_plot") => world({ is: "known", id });

const v = (id: string, when?: GwCond): GwVariant =>
  when === undefined ? { id } : { id, when };
const opt = (
  id: string,
  tell: string[],
  effects: GwEffect[],
  when?: GwCond,
): GwOption =>
  when === undefined ? { id, tell, effects } : { id, tell, effects, when };

const anyOf = (...rules: GwCastRule[]): GwCastRule => ({
  any_of: rules as Extract<GwCastRule, { any_of: unknown }>["any_of"],
});
const office = (o: GwOffice): { office: GwOffice } => ({ office: o });
const named = (person: string): { person: string } => ({ person });
const trusted: GwCastRule = { favourite: true };
const orTrusted = (...rules: GwCastRule[]) => anyOf(...rules, trusted);
/** Who speaks for the Unionists: with Law gone, the next of them, not a friend. */
const unionist = orTrusted(
  named("gbr_bonar_law"),
  named("gbr_balfour"),
  named("gbr_milner"),
);

function paper(
  id: string,
  tag: GwTag,
  kind: "proposal" | "crisis" | "dispute",
  cast: GwScene["cast"],
  variants: GwVariant[],
  fallback: string,
  options: GwOption[],
): GwScene {
  return {
    id,
    nation: [tag],
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

function talk(
  id: string,
  tag: GwTag,
  who: GwCastRule,
  variants: GwVariant[],
  nodes: Record<string, GwNode>,
): GwScene {
  return {
    id,
    nation: [tag],
    kind: "talk",
    cast: { who },
    salience: 7,
    tags: ["people", "tension_up"],
    when: onlyCalled,
    variants,
    who: "who",
    start: "open",
    nodes,
  };
}

const p = role("who");
type ReplyOpts = Partial<Pick<GwReply, "reacts" | "gain" | "miss" | "when">>;
const r = (
  id: string,
  stance: GwReply["stance"],
  kind: GwReply["kind"],
  tell: string[],
  effects: GwEffect[],
  next: string | null,
  more: ReplyOpts = {},
): GwReply => ({ id, stance, kind, tell, effects, next, ...more });
const bye = (id = "leave", stance: GwReply["stance"] = "cold"): GwReply =>
  r(id, stance, "leave", [], [], null);
const node = (says: GwVariant[], ...replies: GwReply[]): GwNode => ({
  says,
  replies,
});
const base = [v("base")];
const straight = [v("straight", candid(p)), v("base")];

const GBR_SCENES: GwScene[] = [
  talk(
    "gov_gbr_table_1",
    "GBR",
    orTrusted(named("gbr_lloyd_george"), office("finance")),
    [v("base")],
    {
      open: node(
        [v("hot", at("commons", { max: -2 })), v("base")],
        r("who", "frank", "ask", [], [], "count"),
        r("loyal", "cold", "push", ["trust:-1"], [trustOf(p, -1)], "count", {
          reacts: [
            {
              when: moody(p, "arrogant", "stubborn"),
              next: "price",
              effects: [heat("gbr_table", 1), reason("gov_gbr_t_pushed")],
            },
          ],
        }),
        bye(),
      ),
      count: node(
        straight,
        r("price", "frank", "ask", [], [], "price"),
        r("you", "warm", "ask", [], [], "self"),
        bye("enough"),
      ),
      self: node(
        [v("wants", moody(p, "cunning", "arrogant")), v("base")],
        r("price", "cold", "ask", [], [], "price"),
        bye("enough"),
      ),
      price: node(
        base,
        r(
          "deal",
          "frank",
          "deal",
          ["promise", "gov_down"],
          [
            remember("k_gov_gbr_lg", p),
            heat("gbr_table", -2),
            soon("gbr_table"),
            promise(p, "p_gov_gbr_committee", 6, {
              keep: flag("f_gov_gbr_committee"),
            }),
          ],
          null,
        ),
        r(
          "no",
          "cold",
          "push",
          ["trust:-1"],
          [trustOf(p, -1), reason("gov_gbr_t_refused")],
          null,
        ),
        bye("think", "warm"),
      ),
    },
  ),
  paper(
    "gov_gbr_table_2",
    "GBR",
    "proposal",
    { fm: orTrusted(office("foreign")) },
    [
      v("again", again("gbr_table")),
      v("coalition", regime("coalition", "war_cabinet", "national")),
      v("base"),
    ],
    "wait",
    [
      opt("wait", ["gov_up"], [heat("gbr_table", 1)]),
      opt(
        "reshuffle",
        ["authority:-10", "cabinet:+1", "gov_down"],
        [authority(-10), inst("cabinet", 1), heat("gbr_table", -3)],
        hasAuthority(10),
      ),
      opt(
        "party_meeting",
        ["commons:+1", "opposition:-1", "gov_down"],
        [inst("commons", 1), inst("opposition", -1), heat("gbr_table", -2)],
      ),
      opt(
        "committee",
        ["cabinet:+2", "authority:-5", "gov_down"],
        [
          inst("cabinet", 2),
          authority(-5),
          setFlag("f_gov_gbr_committee"),
          heat("gbr_table", -4),
        ],
        memory("k_gov_gbr_lg"),
      ),
    ],
  ),
  paper(
    "gov_gbr_table_3",
    "GBR",
    "crisis",
    {
      law: unionist,
      rival: { rival: true },
    },
    [
      v("again", again("gbr_table")),
      v("war", all(atWar, world({ is: "score", max: -15 }))),
      v("base"),
    ],
    "give_way",
    [
      opt(
        "give_way",
        ["authority:-15", "cabinet:+1", "commons:+1", "gov_down"],
        [
          authority(-15),
          inst("cabinet", 1),
          inst("commons", 1),
          heat("gbr_table", -5),
        ],
        hasAuthority(15),
      ),
      opt(
        "rebuild",
        ["cabinet:+2", "authority:-5"],
        [
          inst("cabinet", 2),
          authority(-5),
          setFlag("f_gov_gbr_committee"),
          beat("gbr_table"),
        ],
        memory("k_gov_gbr_lg"),
      ),
      opt(
        "coalition",
        ["regime_change", "opposition:+2"],
        [doWorld({ do: "regime", to: "coalition" }), beat("gbr_table")],
        all(regime("liberal"), at("opposition", { min: -2 })),
      ),
      opt(
        "dissolve",
        ["gov_election"],
        [
          setFlag("f_gov_writ"),
          doWorld({ do: "dissolve" }),
          heat("gbr_election", 1),
          beat("gbr_table"),
        ],
        all(
          not(flag("f_gov_writ")),
          not(flag("f_gov_new_parliament")),
          not(flag("f_gbr_parliament_extended")),
        ),
      ),
      opt(
        "divide",
        ["may_fall"],
        [
          maybe(
            at("commons", { max: -3 }),
            reason("gov_gbr_table_lost"),
            end("gbr_end_turned_out"),
          ),
          maybe(
            at("commons", { min: -2 }),
            inst("commons", -1),
            reason("gov_gbr_table_carried"),
            beat("gbr_table"),
          ),
        ],
      ),
      opt("resign", ["ends_game"], [end("gbr_end_turned_out")]),
    ],
  ),
  talk(
    "gov_gbr_unionists_1",
    "GBR",
    orTrusted(named("gbr_bonar_law"), named("gbr_balfour")),
    [v("base")],
    {
      open: node(
        straight,
        r("what", "frank", "ask", [], [], "what"),
        r("carson", "cold", "ask", [], [], "carson"),
        bye(),
      ),
      carson: node(
        [v("candid", candid(p)), v("base")],
        r("what", "frank", "ask", [], [], "what"),
        r(
          "split",
          "cold",
          "push",
          ["trust:-1"],
          [trustOf(p, -1), remember("k_gov_gbr_split", p)],
          null,
        ),
        bye("enough"),
      ),
      what: node(
        [v("men", not(flag("f_gbr_conscript"))), v("base")],
        r(
          "deal",
          "frank",
          "deal",
          ["promise", "gov_down"],
          [
            remember("k_gov_gbr_law", p),
            heat("gbr_unionists", -2),
            soon("gbr_unionists"),
            promise(p, "p_gov_gbr_unionists", 5, {
              keep: flag("f_gov_gbr_unionists_met"),
            }),
          ],
          null,
        ),
        r("flatter", "flatter", "push", [], [], null, {
          gain: [inst("opposition", 1)],
          reacts: [
            {
              when: moody(p, "cold", "stubborn"),
              next: null,
              effects: [reason("gov_gbr_u_flat")],
            },
          ],
        }),
        bye("think", "warm"),
      ),
    },
  ),
  paper(
    "gov_gbr_unionists_2",
    "GBR",
    "crisis",
    { law: unionist },
    [v("again", again("gbr_unionists")), v("base")],
    "meet_them",
    [
      opt(
        "meet_them",
        ["opposition:+2", "cabinet:-1"],
        [
          inst("opposition", 2),
          inst("cabinet", -1),
          setFlag("f_gov_gbr_unionists_met"),
          beat("gbr_unionists"),
        ],
      ),
      opt(
        "bargain",
        ["opposition:+3", "commons:-1"],
        [
          inst("opposition", 3),
          inst("commons", -1),
          setFlag("f_gov_gbr_unionists_met"),
          beat("gbr_unionists"),
        ],
        memory("k_gov_gbr_law"),
      ),
      opt(
        "split_them",
        ["authority:-10", "opposition:+1"],
        [authority(-10), inst("opposition", 1), beat("gbr_unionists")],
        memory("k_gov_gbr_split"),
      ),
      opt(
        "let_them_go",
        ["opposition:-3", "cabinet:-2", "gov_up"],
        [
          inst("opposition", -3),
          inst("cabinet", -2),
          heat("gbr_table", 4),
          beat("gbr_unionists"),
        ],
      ),
    ],
  ),
  paper(
    "gov_gbr_writ",
    "GBR",
    "proposal",
    { fm: orTrusted(office("foreign")) },
    [
      v("dissolving", any(flag("f_gov_writ"), flag("f_gbr_war_election"))),
      v("war", atWar),
      v("base"),
    ],
    "extend",
    [
      opt(
        "extend",
        ["opposition:-1"],
        [
          inst("opposition", -1),
          setFlag("f_gbr_parliament_extended"),
          beat("gbr_election"),
        ],
        all(
          atWar,
          not(flag("f_gov_writ")),
          not(flag("f_gbr_war_election")),
          any(
            at("opposition", { min: -1 }),
            regime("coalition", "war_cabinet", "national"),
          ),
        ),
      ),
      opt(
        "go",
        ["gov_election"],
        [setFlag("f_gov_writ"), doWorld({ do: "dissolve" })],
      ),
    ],
  ),
  talk("gov_gbr_pact", "GBR", orTrusted(named("gbr_henderson")), [v("base")], {
    open: node(
      base,
      r("how_many", "frank", "ask", [], [], "seats"),
      r("old_pact", "warm", "ask", [], [], "pact"),
      bye(),
    ),
    seats: node(
      straight,
      r("old_pact", "warm", "ask", [], [], "pact"),
      bye("enough"),
    ),
    pact: node(
      base,
      r(
        "deal",
        "frank",
        "deal",
        ["promise"],
        [
          setFlag("f_gov_lib_lab"),
          promise(p, "p_gov_gbr_labour", 8, {
            keep: flag("f_gov_new_parliament"),
          }),
        ],
        null,
      ),
      r(
        "seats_only",
        "cold",
        "deal",
        ["cabinet:-1"],
        [setFlag("f_gov_lib_lab"), inst("cabinet", -1)],
        null,
        {
          reacts: [
            {
              when: moody(p, "stubborn", "arrogant"),
              next: null,
              effects: [
                { kind: "unflag", flag: "f_gov_lib_lab" },
                reason("gov_gbr_pact_failed"),
              ],
            },
          ],
        },
      ),
      bye("no_pact"),
    ),
  }),
  paper(
    "gov_gbr_cry",
    "GBR",
    "dispute",
    { fm: orTrusted(office("foreign")), fin: orTrusted(office("finance")) },
    [v("war", atWar), v("base")],
    "cry_home",
    [
      opt(
        "cry_home",
        ["irish:+1"],
        [setFlag("f_gov_cry_home"), inst("irish", 1)],
      ),
      opt(
        "cry_war",
        ["opposition:-1"],
        [setFlag("f_gov_cry_war"), inst("opposition", -1)],
        atWar,
      ),
      opt(
        "cry_peace",
        ["cabinet:+1"],
        [setFlag("f_gov_cry_peace"), inst("cabinet", 1)],
        not(atWar),
      ),
    ],
  ),
  paper(
    "gov_gbr_poll",
    "GBR",
    "crisis",
    { fm: orTrusted(office("foreign")) },
    [
      v("alone", world({ is: "poll_own", id: "gbr_election", min: 0 })),
      v("friends", world({ is: "poll", id: "gbr_election", min: 0 })),
      v("short"),
    ],
    "count",
    [
      opt(
        "count",
        ["may_fall"],
        [
          maybe(
            world({ is: "poll", id: "gbr_election", max: -1 }),
            reason("gov_gbr_poll_lost"),
            end("gbr_end_polls"),
          ),
          maybe(
            world({ is: "poll", id: "gbr_election", min: 0 }),
            inst("commons", 2),
            setFlag("f_gov_new_parliament"),
            unflag("f_gov_writ"),
            unflag("f_gbr_war_election"),
            reason("gov_gbr_poll_won"),
            beat("gbr_election"),
          ),
        ],
      ),
      opt(
        "buy_irish",
        ["irish:+3", "opposition:-3"],
        [
          inst("irish", 3),
          inst("opposition", -3),
          setFlag("f_home_rule_lives"),
          setFlag("f_gov_new_parliament"),
          unflag("f_gov_writ"),
          unflag("f_gbr_war_election"),
          reason("gov_gbr_poll_irish"),
          beat("gbr_election"),
        ],
        all(
          world({ is: "poll", id: "gbr_election", max: -1, min: -84 }),
          at("irish", { max: -1 }),
        ),
      ),
    ],
  ),
];

const DEU_SCENES: GwScene[] = [
  talk(
    "gov_deu_chancellor_1",
    "DEU",
    orTrusted(office("chancellor")),
    [v("base")],
    {
      open: node(
        [v("reichstag", at("reichstag", { max: -1 })), v("base")],
        r("who", "frank", "ask", [], [], "who"),
        r("hold", "cold", "push", ["trust:-1"], [trustOf(p, -1)], "who", {
          reacts: [
            {
              when: moody(p, "weary", "anxious"),
              next: "price",
              effects: [reason("gov_deu_c_pushed")],
            },
          ],
        }),
        bye(),
      ),
      who: node(
        [v("army", at("army", { min: 2 })), v("base")],
        r("price", "frank", "ask", [], [], "price"),
        r("heir", "warm", "ask", [], [], "after"),
        bye("enough"),
      ),
      after: node(
        straight,
        r("price", "frank", "ask", [], [], "price"),
        bye("enough"),
      ),
      price: node(
        base,
        r(
          "deal",
          "warm",
          "deal",
          ["promise", "gov_down"],
          [
            remember("k_gov_deu_chancellor", p),
            heat("deu_chancellor", -2),
            soon("deu_chancellor"),
            promise(p, "p_gov_deu_cover", 5, {
              keep: flag("f_gov_deu_cover"),
            }),
          ],
          null,
        ),
        r(
          "no",
          "cold",
          "push",
          ["trust:-1"],
          [trustOf(p, -1), inst("countersign", -1)],
          null,
        ),
        bye("think", "warm"),
      ),
    },
  ),
  paper(
    "gov_deu_chancellor_2",
    "DEU",
    "proposal",
    { ch: orTrusted(office("chancellor")) },
    [v("again", again("deu_chancellor")), v("base")],
    "as_1913",
    [
      opt(
        "as_1913",
        ["reichstag:-1", "gov_up"],
        [inst("reichstag", -1), heat("deu_chancellor", 1)],
      ),
      opt(
        "let_him_speak",
        ["reichstag:+1", "army:-1", "gov_down"],
        [inst("reichstag", 1), inst("army", -1), heat("deu_chancellor", -3)],
      ),
      opt(
        "close_session",
        ["reichstag:-2", "army:+1", "gov_down"],
        [inst("reichstag", -2), inst("army", 1), heat("deu_chancellor", -2)],
        at("army", { min: 1 }),
      ),
      opt(
        "receive_leaders",
        ["reichstag:+2", "army:-1", "authority:-5", "gov_down"],
        [
          inst("reichstag", 2),
          inst("army", -1),
          authority(-5),
          setFlag("f_gov_deu_cover"),
          heat("deu_chancellor", -5),
        ],
        memory("k_gov_deu_chancellor"),
      ),
    ],
  ),
  paper(
    "gov_deu_chancellor_3",
    "DEU",
    "crisis",
    {
      ch: orTrusted(office("chancellor")),
      cos: orTrusted(office("chief_of_staff")),
    },
    [
      v("again", again("deu_chancellor")),
      v("army", at("army", { min: 3 })),
      v("base"),
    ],
    "keep",
    [
      opt(
        "keep",
        ["authority:-15", "reichstag:-1", "army:-1"],
        [
          authority(-15),
          inst("reichstag", -1),
          inst("army", -1),
          beat("deu_chancellor"),
        ],
        hasAuthority(15),
      ),
      opt(
        "let_go",
        ["leaves", "gov_up"],
        [
          dismissChancellor,
          heat("deu_parliament", 2),
          reason("gov_deu_chancellor_gone"),
          beat("deu_chancellor"),
        ],
      ),
      opt(
        "new_terms",
        ["countersign:+2", "reichstag:+1", "army:-2"],
        [
          inst("countersign", 2),
          inst("reichstag", 1),
          inst("army", -2),
          setFlag("f_gov_deu_cover"),
          beat("deu_chancellor"),
        ],
        memory("k_gov_deu_chancellor"),
      ),
    ],
  ),
  talk(
    "gov_deu_parliament_1",
    "DEU",
    orTrusted(
      named("deu_erzberger"),
      named("deu_ebert"),
      named("deu_haase"),
      office("interior"),
    ),
    [v("base")],
    {
      open: node(
        base,
        r("what", "frank", "ask", [], [], "what"),
        r("with_whom", "cold", "ask", [], [], "whom"),
        bye(),
      ),
      whom: node(
        straight,
        r("what", "frank", "ask", [], [], "what"),
        r("note", "cold", "ask", [], [remember("k_gov_deu_split", p)], "what", {
          when: candid(p),
        }),
        bye("enough"),
      ),
      what: node(
        [v("hungry", { kind: "gauge", gauge: "bread", max: 1 }), v("base")],
        r("price", "frank", "ask", [], [], "price"),
        r(
          "threat",
          "threat",
          "push",
          ["trust:-1", "gov_up"],
          [trustOf(p, -1), heat("deu_parliament", 1)],
          "price",
          {
            reacts: [
              {
                when: moody(p, "cunning", "stubborn"),
                next: null,
                effects: [reason("gov_deu_p_threat")],
              },
            ],
          },
        ),
        bye("enough"),
      ),
      price: node(
        base,
        r(
          "deal",
          "frank",
          "deal",
          ["promise", "gov_down"],
          [
            remember("k_gov_deu_majority", p),
            heat("deu_parliament", -3),
            soon("deu_parliament"),
            promise(p, "p_gov_deu_word", 6, {
              keep: any(flag("f_franchise_word"), flag("f_gov_deu_majority")),
            }),
          ],
          null,
        ),
        bye("think", "warm"),
      ),
    },
  ),
  paper(
    "gov_deu_parliament_2",
    "DEU",
    "proposal",
    {
      ch: orTrusted(office("chancellor")),
      cos: orTrusted(office("chief_of_staff")),
    },
    [
      v("again", again("deu_parliament")),
      v("hungry", { kind: "gauge", gauge: "bread", max: 1 }),
      v("base"),
    ],
    "words",
    [
      opt("words", ["gov_down"], [heat("deu_parliament", -1)]),
      opt(
        "franchise",
        ["reichstag:+2", "army:-1", "gov_down"],
        [
          inst("reichstag", 2),
          inst("army", -1),
          setFlag("f_franchise_word"),
          heat("deu_parliament", -4),
        ],
      ),
      opt(
        "committee",
        ["reichstag:+1", "countersign:-1", "gov_down"],
        [
          inst("reichstag", 1),
          inst("countersign", -1),
          heat("deu_parliament", -2),
        ],
      ),
      opt(
        "refuse",
        ["army:+1", "reichstag:-2", "gov_up"],
        [inst("army", 1), inst("reichstag", -2), heat("deu_parliament", 2)],
      ),
      opt(
        "majority",
        ["reichstag:+2", "authority:-10", "gov_down"],
        [
          inst("reichstag", 2),
          authority(-10),
          setFlag("f_gov_deu_majority"),
          heat("deu_parliament", -6),
        ],
        memory("k_gov_deu_majority"),
      ),
    ],
  ),
  paper(
    "gov_deu_parliament_3",
    "DEU",
    "crisis",
    {
      ch: orTrusted(office("chancellor")),
      cos: orTrusted(office("chief_of_staff")),
    },
    [
      v("again", again("deu_parliament")),
      v("lost", world({ is: "score", max: -15 })),
      v("base"),
    ],
    "concede",
    [
      opt(
        "concede",
        ["reichstag:+3", "army:-2", "authority:-15"],
        [
          inst("reichstag", 3),
          inst("army", -2),
          authority(-15),
          setFlag("f_gov_deu_majority"),
          beat("deu_parliament"),
        ],
        hasAuthority(15),
      ),
      opt(
        "state_of_siege",
        ["army:+1", "reichstag:-3", "order:+1", "gov_down"],
        [
          inst("army", 1),
          inst("reichstag", -3),
          gauge("order", 1),
          heat("deu_parliament", -6),
        ],
        at("army", { min: 2 }),
      ),
      opt(
        "split_majority",
        ["authority:-10", "reichstag:+1"],
        [authority(-10), inst("reichstag", 1), beat("deu_parliament")],
        memory("k_gov_deu_split"),
      ),
      opt(
        "face_them",
        ["may_fall"],
        [
          maybe(
            at("reichstag", { max: -4 }),
            reason("gov_deu_parliament_lost"),
            end("deu_end_set_aside"),
          ),
          maybe(
            at("reichstag", { min: -3 }),
            inst("reichstag", 1),
            reason("gov_deu_parliament_held"),
            beat("deu_parliament"),
          ),
        ],
      ),
      opt("step_aside", ["ends_game"], [end("deu_end_set_aside")]),
    ],
  ),
];

const karl = flag("w_auh_karl");

const AUH_SCENES: GwScene[] = [
  talk(
    "gov_auh_cabinet_1",
    "AUH",
    orTrusted(office("chancellor")),
    [v("base")],
    {
      open: node(
        [v("hungary", at("hungary", { max: -1 })), v("base")],
        r("who", "frank", "ask", [], [], "who"),
        r("hold", "cold", "push", ["trust:-1"], [trustOf(p, -1)], "who"),
        bye(),
      ),
      who: node(
        straight,
        r("price", "frank", "ask", [], [], "price"),
        r("pest", "warm", "ask", [], [], "pest"),
        bye("enough"),
      ),
      pest: node(
        [v("candid", candid(p)), v("base")],
        r("price", "frank", "ask", [], [], "price"),
        bye("enough"),
      ),
      price: node(
        base,
        r(
          "deal",
          "warm",
          "deal",
          ["promise", "gov_down"],
          [
            remember("k_gov_auh_cabinet", p),
            heat("auh_cabinet", -2),
            soon("auh_cabinet"),
            promise(p, "p_gov_auh_grain", 5, {
              keep: flag("f_gov_auh_both"),
            }),
          ],
          null,
        ),
        r(
          "no",
          "cold",
          "push",
          ["trust:-1"],
          [trustOf(p, -1), inst("council", -1)],
          null,
        ),
        bye("think", "warm"),
      ),
    },
  ),
  paper(
    "gov_auh_cabinet_2",
    "AUH",
    "proposal",
    { ch: orTrusted(office("chancellor")), hun: orTrusted(office("hun_pm")) },
    [v("again", again("auh_cabinet")), v("base")],
    "patch",
    [
      opt(
        "patch",
        ["hungary:-1", "gov_down"],
        [inst("hungary", -1), heat("auh_cabinet", -2)],
      ),
      opt(
        "side_vienna",
        ["council:+1", "hungary:-2", "gov_down"],
        [inst("council", 1), inst("hungary", -2), heat("auh_cabinet", -3)],
      ),
      opt(
        "side_pest",
        ["hungary:+1", "council:-1", "bread:-1"],
        [
          inst("hungary", 1),
          inst("council", -1),
          gauge("bread", -1),
          heat("auh_cabinet", -2),
        ],
      ),
      opt(
        "call_both",
        ["council:+1", "hungary:+1", "authority:-10", "gov_down"],
        [
          inst("council", 1),
          inst("hungary", 1),
          authority(-10),
          setFlag("f_gov_auh_both"),
          heat("auh_cabinet", -5),
        ],
        memory("k_gov_auh_cabinet"),
      ),
    ],
  ),
  paper(
    "gov_auh_cabinet_3",
    "AUH",
    "crisis",
    { ch: orTrusted(office("chancellor")), hun: orTrusted(office("hun_pm")) },
    [v("again", again("auh_cabinet")), v("karl", karl), v("base")],
    "refuse",
    [
      opt(
        "refuse",
        ["authority:-15", "council:+1"],
        [authority(-15), inst("council", 1), beat("auh_cabinet")],
        hasAuthority(15),
      ),
      opt(
        "accept",
        ["leaves", "council:+1", "gov_up"],
        [
          dismissChancellor,
          inst("council", 1),
          heat("auh_court", 2),
          reason("gov_auh_cabinet_gone"),
          beat("auh_cabinet"),
        ],
      ),
      opt(
        "officials",
        ["nations:-1", "council:+2"],
        [inst("nations", -1), inst("council", 2), beat("auh_cabinet")],
        memory("k_gov_auh_cabinet"),
      ),
    ],
  ),
  talk(
    "gov_auh_court_1",
    "AUH",
    orTrusted(office("court"), named("auh_montenuovo")),
    [v("karl", karl), v("base")],
    {
      open: node(
        [v("karl", karl), v("base")],
        r("who", "frank", "ask", [], [], "who"),
        r("berlin", "cold", "ask", [], [], "berlin"),
        bye(),
      ),
      who: node(
        straight,
        r("berlin", "cold", "ask", [], [], "berlin"),
        r("what", "frank", "ask", [], [], "what"),
        bye("enough"),
      ),
      berlin: node(
        [v("debt", at("berlin", { min: 3 })), v("base")],
        r("what", "frank", "ask", [], [], "what"),
        bye("enough"),
      ),
      what: node(
        base,
        r(
          "deal",
          "warm",
          "deal",
          ["promise", "gov_down"],
          [
            remember("k_gov_auh_court", p),
            heat("auh_court", -3),
            soon("auh_court"),
            promise(p, "p_gov_auh_seal", 6, {
              keep: flag("f_gov_auh_seal"),
            }),
          ],
          null,
        ),
        r(
          "silence",
          "threat",
          "push",
          ["trust:-1"],
          [trustOf(p, -1), heat("auh_court", -1)],
          null,
        ),
        bye("think", "warm"),
      ),
    },
  ),
  paper(
    "gov_auh_court_2",
    "AUH",
    "proposal",
    {
      cos: orTrusted(office("chief_of_staff")),
      ch: orTrusted(office("chancellor")),
    },
    [v("again", again("auh_court")), v("karl", karl), v("base")],
    "half",
    [
      opt(
        "half",
        ["nations:-1", "gov_down"],
        [inst("nations", -1), heat("auh_court", -2)],
      ),
      opt(
        "refuse",
        ["council:+1", "army:-1", "gov_up"],
        [inst("council", 1), inst("army", -1), heat("auh_court", 1)],
      ),
      opt(
        "give_in",
        ["army:+1", "council:-2", "nations:-2", "gov_down"],
        [
          inst("army", 1),
          inst("council", -2),
          inst("nations", -2),
          heat("auh_court", -4),
        ],
      ),
      opt(
        "take_seal",
        ["authority:-10", "army:-1", "gov_down"],
        [
          authority(-10),
          inst("army", -1),
          setFlag("f_gov_auh_seal"),
          heat("auh_court", -5),
        ],
        memory("k_gov_auh_court"),
      ),
    ],
  ),
  paper(
    "gov_auh_court_3",
    "AUH",
    "crisis",
    {
      court: orTrusted(office("court"), named("auh_montenuovo")),
      arch: orTrusted(named("auh_friedrich"), office("chief_of_staff")),
    },
    [v("again", again("auh_court")), v("karl", karl), v("base")],
    "buy_time",
    [
      opt(
        "buy_time",
        ["authority:-15", "gov_down"],
        [authority(-15), heat("auh_court", -5)],
        hasAuthority(15),
      ),
      opt(
        "send_away",
        ["army:-2", "council:+1"],
        [inst("army", -2), inst("council", 1), beat("auh_court")],
        at("council", { min: -1 }),
      ),
      opt(
        "hungary_oath",
        ["hungary:-1", "authority:-5"],
        [inst("hungary", -1), authority(-5), beat("auh_court")],
        all(at("hungary", { min: -2 }), memory("k_gov_auh_court")),
      ),
      opt(
        "stand",
        ["may_fall"],
        [
          maybe(
            all(at("council", { max: -3 }), at("hungary", { max: -3 })),
            reason("gov_auh_court_lost"),
            end("auh_e_regency"),
          ),
          maybe(
            any(at("council", { min: -2 }), at("hungary", { min: -2 })),
            reason("gov_auh_court_held"),
            beat("auh_court"),
          ),
        ],
      ),
      opt("sign", ["ends_game"], [end("auh_e_regency")]),
    ],
  ),
];

const RUS_SCENES: GwScene[] = [
  talk(
    "gov_rus_cabinet_1",
    "RUS",
    orTrusted(office("chancellor")),
    [v("base")],
    {
      open: node(
        straight,
        r("who", "frank", "ask", [], [], "who"),
        r("hold", "cold", "push", ["trust:-1"], [trustOf(p, -1)], "who"),
        bye(),
      ),
      who: node(
        [v("duma", at("duma", { max: -2 })), v("base")],
        r("price", "frank", "ask", [], [], "price"),
        r("her", "warm", "ask", [], [], "her"),
        bye("enough"),
      ),
      her: node(
        [v("candid", candid(p)), v("base")],
        r("price", "frank", "ask", [], [], "price"),
        bye("enough"),
      ),
      price: node(
        base,
        r(
          "deal",
          "warm",
          "deal",
          ["promise", "gov_down"],
          [
            remember("k_gov_rus_cabinet", p),
            heat("rus_cabinet", -2),
            soon("rus_cabinet"),
            promise(p, "p_gov_rus_list", 5, {
              keep: flag("f_gov_rus_list"),
            }),
          ],
          null,
        ),
        r(
          "no",
          "cold",
          "push",
          ["trust:-1"],
          [trustOf(p, -1), inst("ministers", -1)],
          null,
        ),
        bye("think", "warm"),
      ),
    },
  ),
  paper(
    "gov_rus_cabinet_2",
    "RUS",
    "proposal",
    { ch: orTrusted(office("chancellor")), fm: orTrusted(office("foreign")) },
    [v("again", again("rus_cabinet")), v("base")],
    "hear_nobody",
    [
      opt(
        "hear_nobody",
        ["ministers:-1", "gov_up"],
        [inst("ministers", -1), heat("rus_cabinet", 1)],
      ),
      opt(
        "one_head",
        ["ministers:+1", "court:-1", "gov_down"],
        [inst("ministers", 1), inst("court", -1), heat("rus_cabinet", -3)],
      ),
      opt(
        "court_man",
        ["court:+1", "duma:-1", "gov_down"],
        [inst("court", 1), inst("duma", -1), heat("rus_cabinet", -2)],
      ),
      opt(
        "shut_the_list",
        ["ministers:+2", "court:-2", "gov_down"],
        [
          inst("ministers", 2),
          inst("court", -2),
          setFlag("f_gov_rus_list"),
          heat("rus_cabinet", -5),
        ],
        memory("k_gov_rus_cabinet"),
      ),
    ],
  ),
  paper(
    "gov_rus_cabinet_3",
    "RUS",
    "crisis",
    { ch: orTrusted(office("chancellor")), fm: orTrusted(office("foreign")) },
    [v("again", again("rus_cabinet")), v("base")],
    "refuse",
    [
      opt(
        "refuse",
        ["authority:-15", "ministers:-1"],
        [authority(-15), inst("ministers", -1), beat("rus_cabinet")],
        hasAuthority(15),
      ),
      opt(
        "accept_head",
        ["leaves", "ministers:+2", "court:-1"],
        [
          dismissChancellor,
          inst("ministers", 2),
          inst("court", -1),
          reason("gov_rus_cabinet_gone"),
          beat("rus_cabinet"),
        ],
      ),
      opt(
        "dismiss_signers",
        ["ministers:-2", "court:+2", "duma:-1", "gov_up"],
        [
          inst("ministers", -2),
          inst("court", 2),
          inst("duma", -1),
          heat("rus_court", 2),
          beat("rus_cabinet"),
        ],
      ),
    ],
  ),
  talk(
    "gov_rus_duma_1",
    "RUS",
    orTrusted(named("rus_rodzianko"), office("interior")),
    [v("base")],
    {
      open: node(
        [v("shells", { kind: "gauge", gauge: "shells", max: 1 }), v("base")],
        r("what", "frank", "ask", [], [], "what"),
        r("sit", "cold", "push", ["trust:-1"], [trustOf(p, -1)], "what", {
          reacts: [
            {
              when: moody(p, "stubborn", "arrogant"),
              next: "warn",
              effects: [inst("duma", -1), reason("gov_rus_d_pushed")],
            },
          ],
        }),
        bye(),
      ),
      what: node(
        straight,
        r("who", "frank", "ask", [], [], "bloc"),
        r("price", "warm", "ask", [], [], "price"),
        bye("enough"),
      ),
      bloc: node(
        [v("candid", candid(p)), v("base")],
        r("price", "warm", "ask", [], [], "price"),
        bye("enough"),
      ),
      warn: node(base, bye("enough")),
      price: node(
        base,
        r(
          "deal",
          "frank",
          "deal",
          ["promise", "gov_down"],
          [
            remember("k_gov_rus_duma", p),
            heat("rus_duma", -2),
            soon("rus_duma"),
            promise(p, "p_gov_rus_session", 4, {
              keep: flag("f_gov_rus_session"),
            }),
          ],
          null,
        ),
        bye("think", "warm"),
      ),
    },
  ),
  paper(
    "gov_rus_duma_2",
    "RUS",
    "proposal",
    { ch: orTrusted(office("chancellor")), int: orTrusted(office("interior")) },
    [v("again", again("rus_duma")), v("base")],
    "recess",
    [
      opt(
        "recess",
        ["duma:-1", "court:+1", "gov_down"],
        [inst("duma", -1), inst("court", 1), heat("rus_duma", -2)],
      ),
      opt(
        "session",
        ["duma:+2", "court:-1", "gov_down"],
        [
          inst("duma", 2),
          inst("court", -1),
          setFlag("f_gov_rus_session"),
          heat("rus_duma", -4),
        ],
      ),
      opt(
        "blank_decree",
        ["court:+1", "gov_up"],
        [inst("court", 1), setFlag("f_gov_rus_blank"), heat("rus_duma", 1)],
      ),
      opt(
        "session_with_word",
        ["duma:+3", "court:-2", "authority:-5", "gov_down"],
        [
          inst("duma", 3),
          inst("court", -2),
          authority(-5),
          setFlag("f_gov_rus_session"),
          heat("rus_duma", -6),
        ],
        memory("k_gov_rus_duma"),
      ),
    ],
  ),
  paper(
    "gov_rus_duma_3",
    "RUS",
    "crisis",
    { ch: orTrusted(office("chancellor")), int: orTrusted(office("interior")) },
    [
      v("blank", flag("f_gov_rus_blank")),
      v("again", again("rus_duma")),
      v("base"),
    ],
    "prorogue",
    [
      opt(
        "prorogue",
        ["duma:-2", "court:+1", "authority:-10"],
        [inst("duma", -2), inst("court", 1), authority(-10), beat("rus_duma")],
      ),
      opt(
        "dissolve",
        ["duma:-4", "court:+2", "order:-1", "gov_up"],
        [
          inst("duma", -4),
          inst("court", 2),
          gauge("order", -1),
          heat("rus_court", 4),
          reason("gov_rus_duma_dissolved"),
          beat("rus_duma"),
        ],
      ),
      opt(
        "recall",
        ["duma:+2", "court:-2"],
        [
          inst("duma", 2),
          inst("court", -2),
          setFlag("f_gov_rus_session"),
          beat("rus_duma"),
        ],
      ),
      opt(
        "trust_ministry",
        ["regime_change", "court:-2"],
        [doWorld({ do: "regime", to: "crown" }), beat("rus_duma")],
        memory("k_gov_rus_duma"),
      ),
    ],
  ),
  talk(
    "gov_rus_court_1",
    "RUS",
    orTrusted(named("rus_maria"), named("rus_michael"), office("court")),
    [v("base")],
    {
      open: node(
        base,
        r("who", "frank", "ask", [], [], "who"),
        r("her", "warm", "ask", [], [], "her"),
        bye(),
      ),
      who: node(
        [
          v("real", all({ kind: "secret", id: "rus_palace_plot" }, candid(p))),
          v("talk"),
        ],
        r(
          "names",
          "frank",
          "ask",
          [],
          [
            maybe(
              { kind: "secret", id: "rus_palace_plot" },
              doWorld({ do: "reveal", id: "rus_palace_plot" }),
            ),
          ],
          "her",
        ),
        bye("enough"),
      ),
      her: node(
        base,
        r(
          "deal",
          "warm",
          "deal",
          ["promise", "gov_down"],
          [
            remember("k_gov_rus_court", p),
            heat("rus_court", -3),
            soon("rus_court"),
            promise(p, "p_gov_rus_crimea", 6, {
              keep: flag("f_gov_rus_crimea"),
            }),
          ],
          null,
        ),
        r(
          "defend",
          "cold",
          "push",
          ["trust:-1", "court:+1"],
          [trustOf(p, -1), inst("court", 1)],
          null,
        ),
        bye("think", "warm"),
      ),
    },
  ),
  paper(
    "gov_rus_court_2",
    "RUS",
    "proposal",
    { ch: orTrusted(office("chancellor")), court: orTrusted(office("court")) },
    [
      v("known", known("rus_palace_plot")),
      v("again", again("rus_court")),
      v("base"),
    ],
    "answer",
    [
      opt("answer", ["gov_down"], [heat("rus_court", -2)]),
      opt(
        "send_off",
        ["court:+1", "duma:-1", "gov_up"],
        [inst("court", 1), inst("duma", -1), heat("rus_court", 1)],
      ),
      opt(
        "watch_them",
        ["authority:-10", "gov_down"],
        [authority(-10), heat("rus_court", -4)],
        known("rus_palace_plot"),
      ),
      opt(
        "empress_crimea",
        ["court:-3", "duma:+2", "gov_down"],
        [
          inst("court", -3),
          inst("duma", 2),
          setFlag("f_gov_rus_crimea"),
          heat("rus_court", -7),
        ],
        memory("k_gov_rus_court"),
      ),
    ],
  ),
  paper(
    "gov_rus_court_3",
    "RUS",
    "crisis",
    {
      aide: orTrusted(office("court")),
      cos: orTrusted(office("chief_of_staff")),
    },
    [
      v("real", { kind: "secret", id: "rus_palace_plot" }),
      v("again", again("rus_court")),
      v("base"),
    ],
    "guards",
    [
      opt(
        "guards",
        ["stavka:-1", "gov_down"],
        [inst("stavka", -1), heat("rus_court", -5)],
        at("stavka", { min: 1 }),
      ),
      opt(
        "grant",
        ["regime_change", "court:-2"],
        [doWorld({ do: "regime", to: "crown" }), beat("rus_court")],
        at("duma", { min: -3 }),
      ),
      opt(
        "go_on",
        ["may_fall"],
        [
          maybe(
            at("stavka", { max: -1 }),
            reason("gov_rus_court_lost"),
            end("rus_palace_coup"),
          ),
          maybe(
            at("stavka", { min: 0 }),
            reason("gov_rus_court_held"),
            beat("rus_court"),
          ),
        ],
      ),
      opt("sign", ["ends_game"], [end("rus_palace_coup")]),
    ],
  ),
];

/**
 * ww187: the papers of a threat made in a chamber assume it sits (GovTable
 * `sits` rests the row itself); one called before a dissolution doesn't come.
 */
const SITS_FOR: readonly [string, GwChamber][] = [
  ["gov_gbr_table_", "commons"],
  ["gov_deu_chancellor_", "reichstag"],
  ["gov_deu_parliament_", "reichstag"],
  ["gov_rus_duma_", "duma"],
  ["gov_fra_chamber_", "chambre"],
];
const sitting = (x: GwScene): GwScene => {
  const hit = SITS_FOR.find(([pre]) => x.id.startsWith(pre));
  return hit === undefined ? x : assuming(x, { sits: [hit[1]] });
};

export const GOV_SCENES: GwScene[] = [
  ...GBR_SCENES,
  ...DEU_SCENES,
  ...AUH_SCENES,
  ...RUS_SCENES,
  ...GOV_FRA_SCENES,
].map(sitting);
