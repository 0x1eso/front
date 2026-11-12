import type { GwSide } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwClient, GwSignHow } from "@openfront/engine-api/ww1914/GwFate";
import {
  all,
  any,
  GwCond,
  GwEffect,
  GwOption,
  GwScene,
  not,
  reason,
  remember,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import { GW_CLIENT_ROWS, GW_REGENCY } from "../../FateRows";

/**
 * Common scenes of a beaten country's fate (ww199, W-C). Data only; the text
 * is in resources/ww1914/ko/common.settle.json.
 *
 * - `gw_settle_sign`: the treaty card, laid when the seat's table opens (a
 *   seat's own `<seat>_settle_sign` comes first). Options `treaty_sign`.
 * - `gw_settle_crown_<client>`: who sits on a new state's throne, laid the
 *   chapter after the seat founds it. One option per real candidate of
 *   GW_CLIENT_ROWS plus the regency council. Serbia has no candidate: its
 *   throne goes to the regency without a paper.
 * - The years after (`gw_st_`): the ledger of the military government, a
 *   vassal's unrest, a state wavering, each state's ruler writing, the
 *   neutral papers, the beaten country's revanche press, the overlord's
 *   commissioner, land given back. Gated on the world conditions `fate`,
 *   `client_state`, `vassal`, `revanche`, `rule`.
 */

const SEATS: readonly GwTag[] = ["DEU", "GBR", "AUH", "RUS", "FRA"];
const SIDE_SEATS: Readonly<Record<GwSide, readonly GwTag[]>> = {
  central: ["DEU", "AUH"],
  entente: ["GBR", "FRA", "RUS"],
};

const opt = (scene: string, id: string, effects: GwEffect[]): GwOption => ({
  id,
  tell: [],
  effects: [...effects, reason(`${scene}_${id}`)],
});
const gauge = (
  g: "money" | "bread" | "morale" | "order",
  delta: number,
): GwEffect => ({ kind: "gauge", gauge: g, delta });
const opinion = (
  bloc: "army" | "court" | "parliament" | "business" | "workers" | "press",
  delta: number,
): GwEffect => ({ kind: "opinion", bloc, delta });
const manpower = (delta: number): GwEffect =>
  doWorld({ do: "manpower", delta });

// ---- the treaty card ----

const open = (...of: GwTag[]): GwCond =>
  any(...of.map((t) => world({ is: "settle_open", of: t })));

/** Press and reserve carry no reason here: the engine gives theirs (fate_sign_*). */
const signOpt = (how: GwSignHow): GwOption =>
  how === "sign"
    ? opt("gw_settle_sign", how, [doWorld({ do: "treaty_sign", how })])
    : { id: how, tell: [], effects: [doWorld({ do: "treaty_sign", how })] };

const SIGN: GwScene = {
  id: "gw_settle_sign",
  nation: [...SEATS],
  kind: "proposal",
  scheduledOnly: true,
  essential: true,
  cast: {},
  salience: 8,
  tags: ["foreign"],
  variants: [
    { id: "rus", when: open("RUS") },
    { id: "rou", when: open("ROU") },
    { id: "small", when: open("SRB", "MNE", "BEL", "ALB", "GRC", "BGR") },
    { id: "power", when: open("DEU", "AUH", "FRA", "GBR", "ITA", "OTT") },
    { id: "base" },
  ],
  fallback: "sign",
  options: (["sign", "press", "reserve"] as const).map(signOpt),
};

// ---- the crown ----

/** The seats that may found a state: those of its sides. */
const founders = (sides: readonly GwSide[]): GwTag[] =>
  SEATS.filter((s) => sides.some((x) => SIDE_SEATS[x].includes(s)));

function crown(client: GwClient): GwScene | null {
  const row = GW_CLIENT_ROWS.find((r) => r.id === client)!;
  if (row.crowns.length === 0) return null;
  const id = `gw_settle_crown_${client}`;
  const picks = [...row.crowns.map((c) => c.id), GW_REGENCY];
  return {
    id,
    nation: founders(row.sides),
    kind: "proposal",
    scheduledOnly: true,
    cast: {},
    salience: 7,
    tags: ["foreign"],
    variants: [{ id: "base" }],
    fallback: GW_REGENCY,
    options: picks.map((pick) =>
      opt(id, pick, [doWorld({ do: "crown", client, pick })]),
    ),
  };
}

const CROWNS: readonly GwScene[] = GW_CLIENT_ROWS.map((r) =>
  crown(r.id),
).filter((s): s is GwScene => s !== null);

/** The scenes the engine lays (Fate.ts): no deal draws them. */
export const GW_SETTLE_CALLED: readonly string[] = [
  SIGN.id,
  ...CROWNS.map((s) => s.id),
];

// ---- the years after ----

/** Countries whose land a seat may rule after a table. */
const RULED: readonly GwTag[] = [
  "RUS",
  "ROU",
  "SRB",
  "MNE",
  "BEL",
  "ALB",
  "FRA",
  "DEU",
  "AUH",
  "OTT",
  "ITA",
  "GRC",
  "BGR",
];
/** The rule of every land the seat rules, made harder or softer. */
const everyRule = (hard: number): GwEffect[] =>
  RULED.map((of) => ({
    kind: "maybe" as const,
    when: world({ is: "rule", of }),
    then: [doWorld({ do: "rule", of, hard })],
  }));

/** A paper of the years after, with a decision. */
function paper(
  id: string,
  when: GwCond,
  variants: GwScene["variants"],
  options: GwOption[],
  more: Partial<GwScene> = {},
): GwScene {
  return {
    id,
    nation: [...SEATS],
    kind: "proposal",
    when,
    cast: {},
    salience: 5,
    tags: ["foreign", "home"],
    cooldown: 6,
    max: 2,
    variants,
    fallback: options[options.length - 1].id,
    options,
    ...more,
  };
}

/** Read once: what others make of the settlement. */
function report(
  id: string,
  when: GwCond,
  variants: GwScene["variants"],
): GwScene {
  return {
    id,
    nation: [...SEATS],
    kind: "report",
    when,
    cast: {},
    salience: 4,
    tags: ["foreign"],
    stamp: "confirmed",
    source: "press",
    once: true,
    variants,
  };
}

type FateWord = "annex" | "occupy" | "state" | "vassal" | "return";
const fate = (
  f: FateWord,
  more: {
    as?: "by" | "of" | "to";
    client?: GwClient;
    min?: number;
    max?: number;
  } = {},
): GwCond => world({ is: "fate", fate: f, ...more });
const usOut: GwCond = not(world({ is: "entered", tag: "USA" }));

/**
 * A state's ruler writes to its founder, once, some months after it stands.
 * `grant` and `refuse` are what the answer does.
 */
function letter(
  client: GwClient,
  grant: GwEffect[],
  refuse: GwEffect[],
): GwScene {
  const id = `gw_st_letter_${client}`;
  const row = GW_CLIENT_ROWS.find((r) => r.id === client)!;
  return {
    id,
    nation: founders(row.sides),
    kind: "proposal",
    when: all(
      fate("state", { client, min: 3 }),
      world({ is: "client_state", client }),
    ),
    cast: {},
    salience: 5,
    tags: ["foreign"],
    once: true,
    variants: [
      { id: "shaky", when: world({ is: "client_state", client, max: 1 }) },
      { id: "base" },
    ],
    fallback: "refuse",
    options: [opt(id, "grant", grant), opt(id, "refuse", refuse)],
  };
}

const YEARS: readonly GwScene[] = [
  // The military government's ledger: requisition, and what it costs.
  paper(
    "gw_st_ledger",
    fate("occupy", { min: 4 }),
    [{ id: "resist", when: world({ is: "resist", min: 2 }) }, { id: "base" }],
    [
      opt("gw_st_ledger", "more", [gauge("bread", 1), ...everyRule(1)]),
      opt("gw_st_ledger", "seed", [opinion("army", -1), ...everyRule(-1)]),
    ],
  ),
  // A vassal grows restless under the tribute.
  paper(
    "gw_st_vassal_unrest",
    world({ is: "vassal", max: 1 }),
    [{ id: "turning", when: world({ is: "vassal", max: 0 }) }, { id: "base" }],
    [
      opt("gw_st_vassal_unrest", "garrison", [
        manpower(-1),
        opinion("army", 1),
      ]),
      opt("gw_st_vassal_unrest", "ease", [
        gauge("money", -1),
        remember("gw_st_vassal_eased"),
      ]),
    ],
  ),
  // A state the seat founded wavers.
  paper(
    "gw_st_state_turning",
    world({ is: "client_state", max: 1 }),
    [
      { id: "turning", when: world({ is: "client_state", max: 0 }) },
      { id: "base" },
    ],
    [
      opt("gw_st_state_turning", "troops", [manpower(-1), opinion("army", 1)]),
      opt("gw_st_state_turning", "own_army", [
        opinion("army", -1),
        remember("gw_st_state_own_army"),
      ]),
    ],
  ),
  // The neutral papers on what the seat took.
  report(
    "gw_st_neutral",
    all(
      usOut,
      any(
        fate("annex", { max: 6 }),
        fate("state", { max: 6 }),
        fate("vassal", { max: 6 }),
      ),
    ),
    [
      { id: "vassal", when: fate("vassal", { max: 6 }) },
      { id: "state", when: fate("state", { max: 6 }) },
      { id: "base" },
    ],
  ),
  // The beaten country's press on the land it lost.
  paper(
    "gw_st_revanche",
    world({ is: "revanche", min: 1 }),
    [{ id: "many", when: world({ is: "revanche", min: 3 }) }, { id: "base" }],
    [
      opt("gw_st_revanche", "speak", [
        opinion("press", 1),
        { kind: "temp", delta: 1 },
      ]),
      opt("gw_st_revanche", "quiet", [
        opinion("press", -1),
        opinion("army", -1),
      ]),
    ],
    { cooldown: 8 },
  ),
  // The seat's own country is a vassal: the overlord's commissioner.
  paper(
    "gw_st_vassal_self",
    world({ is: "vassal", self: true }),
    [
      { id: "turning", when: world({ is: "vassal", self: true, max: 0 }) },
      { id: "base" },
    ],
    [
      opt("gw_st_vassal_self", "comply", [
        gauge("money", -1),
        opinion("army", -1),
      ]),
      opt("gw_st_vassal_self", "drag", [
        opinion("army", 1),
        opinion("press", 1),
        remember("gw_st_vassal_drag"),
      ]),
    ],
  ),
  // Land given back to the seat's country.
  report("gw_st_returned", fate("return", { as: "to", max: 3 }), [
    { id: "base" },
  ]),
  // ---- each state's ruler writes ----
  letter(
    "poland",
    [opinion("army", -1), remember("gw_st_poland_army")],
    [opinion("army", 1), remember("gw_st_poland_refused")],
  ),
  letter(
    "lithuania",
    [opinion("court", -1), remember("gw_st_lithuania_free")],
    [opinion("court", 1), remember("gw_st_lithuania_bound")],
  ),
  letter(
    "ukraine",
    [gauge("bread", 1), remember("gw_st_ukraine_chelm")],
    [remember("gw_st_ukraine_refused")],
  ),
  letter(
    "flanders",
    [opinion("press", -1), remember("gw_st_flanders_free")],
    [opinion("army", 1), remember("gw_st_flanders_bound")],
  ),
  letter(
    "albania",
    [gauge("money", -1), remember("gw_st_albania_paid")],
    [remember("gw_st_albania_refused")],
  ),
  letter(
    "baltic_duchy",
    [opinion("court", 1), remember("gw_st_baltic_union")],
    [opinion("press", 1), remember("gw_st_baltic_apart")],
  ),
  letter(
    "georgia",
    [manpower(-1), remember("gw_st_georgia_guard")],
    [remember("gw_st_georgia_refused")],
  ),
  letter(
    "hejaz",
    [opinion("press", 1), remember("gw_st_hejaz_promise")],
    [remember("gw_st_hejaz_refused")],
  ),
  letter(
    "bohemia",
    [opinion("press", 1), remember("gw_st_bohemia_slovaks")],
    [remember("gw_st_bohemia_refused")],
  ),
  letter(
    "rhineland",
    [manpower(-1), remember("gw_st_rhineland_guard")],
    [opinion("press", 1), remember("gw_st_rhineland_refused")],
  ),
];

export const SETTLE_SCENES: readonly GwScene[] = [SIGN, ...CROWNS, ...YEARS];
