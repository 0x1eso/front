// Schedule entries every seat has. Text in resources/ww1914/ko/common.acts.json.
import type { GwAct, GwActOption } from "@openfront/engine-api/ww1914/GwActs";
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
];
