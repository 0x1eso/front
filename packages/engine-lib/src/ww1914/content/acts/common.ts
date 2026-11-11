// Schedule entries every seat has. Text in resources/ww1914/ko/common.acts.json.
import type { GwAct, GwActOption } from "@openfront/engine-api/ww1914/GwActs";
import {
  GW_AGENTS,
  type GwPropAct,
} from "@openfront/engine-api/ww1914/GwAgents";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwSpyAct } from "@openfront/engine-api/ww1914/GwSpies";
import type {
  GwEffect,
  GwScene,
  GwVariant,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";

// ---- ww173 C2: the secret war's rows, under 뒷공작 (engine/ww1914/Spies) ----

const SEATS: GwTag[] = ["DEU", "GBR", "AUH", "RUS", "FRA"];
/** Countries a net can be planted in or a depot burned. */
const ABROAD: GwTag[] = [
  "DEU",
  "AUH",
  "RUS",
  "FRA",
  "GBR",
  "ITA",
  "OTT",
  "USA",
  "ROU",
  "BGR",
  "GRC",
];
const NEUTRALS: GwTag[] = ["ITA", "USA", "ROU", "BGR", "GRC", "OTT"];
const money: GwEffect = { kind: "gauge", gauge: "money", delta: -1 };
const spy = (act: GwSpyAct, tag?: GwTag): GwEffect =>
  doWorld(tag === undefined ? { do: "spy", act } : { do: "spy", act, tag });

/** One option per country, each open while the act can be done there. */
function where(
  act: "net" | "sabotage" | "court",
  tags: GwTag[],
  first: string,
): GwActOption[] {
  return [
    // The row's own first pick: the main enemy, or the likeliest neutral.
    { id: first, effects: [spy(act)] },
    ...tags.map((t) => ({
      id: t.toLowerCase(),
      when: world({ is: "spy", can: act, tag: t }),
      effects: [spy(act, t)],
    })),
  ];
}

const sub = (
  id: string,
  nation: GwTag[],
  act: "lenin" | "ireland" | "arab" | "jihad",
): GwAct => ({
  id,
  nation,
  kind: "intrigue",
  stage: ["war"],
  when: world({ is: "spy", can: act }),
  once: true,
  scene: `gw_spy_${act}_r`,
  wait: 1,
  tell: ["money:-1"],
  effects: [money, spy(act)],
});

export const COMMON_ACTS: readonly GwAct[] = [
  {
    id: "gw_a_spy_net",
    nation: SEATS,
    kind: "intrigue",
    stage: ["war"],
    cooldown: 2,
    scene: "gw_spy_net_r",
    wait: 1,
    tell: ["money:-1"],
    effects: [money],
    fields: [{ id: "where", options: where("net", ABROAD, "main_foe") }],
  },
  {
    id: "gw_a_spy_sabotage",
    nation: SEATS,
    kind: "intrigue",
    stage: ["war"],
    cooldown: 4,
    scene: "gw_spy_sabotage_r",
    wait: 1,
    tell: ["money:-1"],
    effects: [money],
    fields: [{ id: "where", options: where("sabotage", ABROAD, "main_foe") }],
  },
  {
    id: "gw_a_spy_court",
    nation: SEATS,
    kind: "intrigue",
    stage: ["war"],
    cooldown: 3,
    scene: "gw_spy_court_r",
    wait: 1,
    tell: ["money:-1"],
    effects: [money],
    fields: [{ id: "where", options: where("court", NEUTRALS, "nearest") }],
  },
  sub("deu_a_spy_lenin", ["DEU"], "lenin"),
  sub("deu_a_spy_ireland", ["DEU"], "ireland"),
  sub("gbr_a_spy_arab", ["GBR"], "arab"),
  sub("deu_a_spy_jihad", ["DEU"], "jihad"),
  {
    id: "gw_a_spy_blame",
    nation: SEATS,
    kind: "intrigue",
    stage: ["war"],
    when: world({ is: "spy", can: "blame" }),
    cooldown: 8,
    scene: "gw_spy_blame_r",
    wait: 0,
    effects: [spy("blame")],
  },
];

const v = (id: string, can: "ok" | "out" | "ship"): GwVariant => ({
  id,
  when: world({ is: "spy", can }),
});
const base: GwVariant = { id: "base" };

/** The result card: a short wire with no chrome, laid by the schedule. */
const card = (id: string, variants: GwVariant[]): GwScene => ({
  id,
  nation: SEATS,
  kind: "wire",
  scheduledOnly: true,
  silent: true,
  cast: {},
  salience: 5,
  tags: ["foreign", "war"],
  variants,
});

export const COMMON_ACT_SCENES: readonly GwScene[] = [
  // Caught outranks worked: an exposed net is the news, whatever it did.
  card("gw_spy_net_r", [v("out", "out"), v("ok", "ok"), base]),
  card("gw_spy_sabotage_r", [v("out", "out"), v("ok", "ok"), base]),
  card("gw_spy_court_r", [v("out", "out"), v("ok", "ok"), base]),
  card("gw_spy_lenin_r", [base]),
  card("gw_spy_ireland_r", [v("ship", "ship"), base]),
  card("gw_spy_arab_r", [base]),
  card("gw_spy_jihad_r", [v("ok", "ok"), base]),
  card("gw_spy_blame_r", [base]),
];

const SENDERS: GwTag[] = ["DEU", "GBR", "AUH", "RUS", "FRA", "USA", "ITA"];
/** Whose diplomatic traffic the peace card names, in this order. */
const PEACE_READ: GwTag[] = ["DEU", "ITA", "RUS", "AUH", "FRA", "GBR"];

/**
 * A foreign agent taken by a service at counter 3 (Spies.agentsTaken): turn
 * him, or show him. The timer shows him. Laid by the engine, never drawn.
 */
export const SPY_SCENES: readonly GwScene[] = [
  {
    id: "gw_spy_caught",
    nation: SEATS,
    kind: "proposal",
    scheduledOnly: true,
    cast: {},
    salience: 7,
    tags: ["foreign", "war"],
    when: world({ is: "spy", can: "double" }),
    variants: [
      ...SENDERS.map((t) => ({
        id: t.toLowerCase(),
        when: world({ is: "spy", can: "from", tag: t }),
      })),
      base,
    ],
    fallback: "expose",
    options: [
      { id: "expose", tell: [], effects: [spy("expose")] },
      { id: "double", tell: [], effects: [spy("double")] },
    ],
  },
  // ww178: in peace the head of the service brings what the cipher room
  // reads of a rival's diplomatic traffic. The reports carry the words.
  {
    id: "gw_spy_peace_read",
    nation: SEATS,
    kind: "report",
    stamp: "estimate",
    source: "codes",
    when: world({ is: "spy", can: "reading", peace: true }),
    cooldown: 8,
    salience: 5,
    tags: ["foreign"],
    cast: { intel: { office: "intelligence" } },
    variants: [
      { id: "note", when: world({ is: "ladder" }) },
      ...PEACE_READ.map((t) => ({
        id: t.toLowerCase(),
        when: world({ is: "spy", can: "reading", tag: t, peace: true }),
      })),
      base,
    ],
  },
];

// ---- ww180: named agents and the war of words (Agents.ts, Propaganda.ts) ----

const prop = (act: GwPropAct, tag?: GwTag): GwEffect =>
  doWorld(tag === undefined ? { do: "prop", act } : { do: "prop", act, tag });
/** Countries whose home front leaflets can reach: any enemy. */
const ENEMIES: GwTag[] = ["DEU", "AUH", "RUS", "FRA", "GBR", "ITA", "OTT"];

function propWhere(
  act: "leaflets" | "papers",
  tags: GwTag[],
  first: string,
): GwActOption[] {
  return [
    { id: first, effects: [prop(act)] },
    ...tags.map((t) => ({
      id: t.toLowerCase(),
      when: world({ is: "prop", can: act, tag: t }),
      effects: [prop(act, t)],
    })),
  ];
}

export const AGENT_ACTS: readonly GwAct[] = [
  {
    id: "gw_a_agent_hire",
    nation: SEATS,
    kind: "intrigue",
    stage: ["war"],
    when: world({ is: "agent", can: "hire" }),
    cooldown: 2,
    scene: "gw_agent_hire_r",
    wait: 1,
    tell: ["money:-1"],
    effects: [money],
    fields: [
      {
        id: "who",
        options: [
          // The service's own pick: the surest hand it can get.
          { id: "best", effects: [doWorld({ do: "agent" })] },
          ...GW_AGENTS.map((d) => ({
            id: d.id,
            when: world({ is: "agent", can: "hire", id: d.id }),
            effects: [doWorld({ do: "agent", id: d.id })],
          })),
        ],
      },
    ],
  },
  {
    id: "gw_a_prop_home",
    nation: SEATS,
    kind: "intrigue",
    stage: ["war"],
    when: world({ is: "prop", can: "home" }),
    cooldown: 4,
    scene: "gw_prop_home_r",
    wait: 2,
    tell: ["money:-1"],
    effects: [money, prop("home")],
  },
  {
    id: "gw_a_prop_hush",
    nation: SEATS,
    kind: "intrigue",
    stage: ["war"],
    when: world({ is: "prop", can: "hush" }),
    cooldown: 4,
    scene: "gw_prop_hush_r",
    wait: 4,
    effects: [prop("hush")],
  },
  {
    id: "gw_a_prop_leaflets",
    nation: SEATS,
    kind: "intrigue",
    stage: ["war"],
    when: world({ is: "prop", can: "leaflets" }),
    cooldown: 6,
    scene: "gw_prop_leaflets_r",
    wait: 3,
    tell: ["money:-1"],
    effects: [money],
    fields: [
      { id: "where", options: propWhere("leaflets", ENEMIES, "weakest") },
    ],
  },
  {
    id: "gw_a_prop_papers",
    nation: SEATS,
    kind: "intrigue",
    stage: ["war"],
    when: world({ is: "prop", can: "papers" }),
    cooldown: 4,
    scene: "gw_prop_papers_r",
    wait: 2,
    tell: ["money:-1"],
    effects: [money],
    fields: [
      { id: "where", options: propWhere("papers", NEUTRALS, "nearest") },
    ],
  },
];

const pv = (id: string, act: GwPropAct, can: "ok" | "out"): GwVariant => ({
  id,
  when: world({ is: "prop", can, act }),
});

export const AGENT_SCENES: readonly GwScene[] = [
  card("gw_agent_hire_r", [
    { id: "out", when: world({ is: "agent", can: "lost" }) },
    { id: "ok", when: world({ is: "agent", can: "working" }) },
    base,
  ]),
  card("gw_prop_home_r", [pv("ok", "home", "ok"), base]),
  card("gw_prop_hush_r", [
    pv("out", "hush", "out"),
    pv("ok", "hush", "ok"),
    base,
  ]),
  card("gw_prop_leaflets_r", [pv("ok", "leaflets", "ok"), base]),
  card("gw_prop_papers_r", [
    pv("out", "papers", "out"),
    pv("ok", "papers", "ok"),
    base,
  ]),
];
