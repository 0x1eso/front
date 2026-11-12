// Great War 1914 (ww188): the cards of a fallen capital and of giving up.
// The engine lays them (engine/ww1914/Capitulation); the options only set a
// flag it reads as the chapter closes. Text in
// resources/ww1914/ko/common.capital.json.
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";

const SEATS: readonly GwTag[] = ["DEU", "GBR", "AUH", "RUS", "FRA"];

/** The seat's card when its capital falls: move and fight on, or sue. */
export const GW_CAPITAL_FELL = "gw_capital_fell";
/** The seat's last card: the terms, with no fighting on left. */
export const GW_CAPITULATION = "gw_capitulation";
/** The card of a seat whose army took an enemy capital. */
export const GW_CAPITAL_TAKEN = "gw_capital_taken";
/** Seat flags the cards' options set; the engine reads and clears them. */
export const GW_CAP_FIGHT = "gw_cap_fight";
export const GW_CAP_SUE = "gw_cap_sue";
export const GW_CAP_SIGN = "gw_cap_sign";
export const GW_CAP_REFUSE = "gw_cap_refuse";

/** Where a seat's government can go, with a body of its own. */
const REFUGES = ["bordeaux", "moscow", "budapest", "dresden", "manchester"];
/** Capitals a seat's army can take, with a body of their own. */
const TAKEN = [
  "paris",
  "petrograd",
  "berlin",
  "vienna",
  "london",
  "belgrade",
  "bucharest",
  "brussels",
  "rome",
  "constantinople",
];

const mem = (key: string) => ({ kind: "memory", key, within: 1 }) as const;

/** Memories the engine writes that the variants read. */
export const GW_CAPITAL_MEMORIES: readonly string[] = [
  ...REFUGES.map((p) => `gov_to_${p}`),
  ...TAKEN.map((p) => `took_${p}`),
];

/** Laid by the engine, set by it or read by it: for the content checks. */
export const GW_CAPITAL_CALLED: readonly string[] = [
  GW_CAPITAL_FELL,
  GW_CAPITULATION,
  GW_CAPITAL_TAKEN,
  GW_CAP_FIGHT,
  GW_CAP_SUE,
  GW_CAP_SIGN,
  GW_CAP_REFUSE,
  ...GW_CAPITAL_MEMORIES,
];

const flag = (f: string) => [{ kind: "flag" as const, flag: f }];

export const GW_CAPITAL_SCENES: readonly GwScene[] = [
  {
    // To the seat whose capital is in enemy hands.
    id: GW_CAPITAL_FELL,
    nation: [...SEATS],
    kind: "crisis",
    scheduledOnly: true,
    noBack: true,
    cast: {},
    salience: 9,
    tags: ["war"],
    variants: [
      ...REFUGES.map((p) => ({ id: p, when: mem(`gov_to_${p}`) })),
      { id: "base" },
    ],
    fallback: "fight_on",
    options: [
      { id: "fight_on", tell: [], effects: flag(GW_CAP_FIGHT) },
      { id: "sue", tell: [], effects: flag(GW_CAP_SUE) },
    ],
  },
  {
    // The terms: no fighting on is left.
    id: GW_CAPITULATION,
    nation: [...SEATS],
    kind: "crisis",
    scheduledOnly: true,
    noBack: true,
    cast: {},
    salience: 9,
    tags: ["war"],
    variants: [{ id: "base" }],
    fallback: "sign",
    options: [
      { id: "sign", tell: [], effects: flag(GW_CAP_SIGN) },
      { id: "refuse", tell: [], effects: flag(GW_CAP_REFUSE) },
    ],
  },
  {
    // To the seat whose army took an enemy capital.
    id: GW_CAPITAL_TAKEN,
    nation: [...SEATS],
    kind: "wire",
    scheduledOnly: true,
    cast: {},
    salience: 9,
    tags: ["war"],
    variants: [
      ...TAKEN.map((p) => ({ id: p, when: mem(`took_${p}`) })),
      { id: "base" },
    ],
  },
];
