import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  all,
  any,
  GwCond,
  GwEffect,
  GwOption,
  GwScene,
  reason,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";

/**
 * Common scenes: the home front (ww190 §5). Data only; the text is in
 * resources/ww1914/ko/common.homefront.json.
 *
 * The flu's three wires, the Red Cross's card index, the camps (one card per
 * enemy, since an exchange or a reprisal names a country), and the refugees.
 */

const SEATS: readonly GwTag[] = ["DEU", "GBR", "AUH", "RUS", "FRA"];
const WAR: GwCond = world({ is: "war" });

const opt = (scene: string, id: string, effects: GwEffect[]): GwOption => ({
  id,
  tell: [],
  effects: [...effects, reason(`${scene}_${id}`)],
});

/** A flu wave's wire: once, the chapter its wave is on. */
function flu(n: 1 | 2 | 3): GwScene {
  return {
    id: `gw_hf_flu_${n}`,
    nation: [...SEATS],
    kind: "wire",
    when: world({ is: "flu", min: n, max: n }),
    cast: {},
    salience: 5,
    tags: ["home"],
    once: true,
    variants: [{ id: "war", when: WAR }, { id: "base" }],
  };
}

/** The enemies whose camps hold the most men, and who hold the most of ours. */
const CAMP_FOES: readonly GwTag[] = ["DEU", "AUH", "RUS", "FRA", "GBR", "ITA"];

/** The camps on both sides of one war: an exchange, a reprisal, or nothing. */
function camps(foe: GwTag): GwScene {
  const id = `gw_hf_camps_${foe.toLowerCase()}`;
  return {
    id,
    nation: SEATS.filter((t) => t !== foe),
    kind: "proposal",
    stage: ["war"],
    when: all(
      { kind: "at_war", tag: foe },
      any(
        world({ is: "prisoners", held: "ours", tag: foe, min: 20 }),
        world({ is: "prisoners", held: "theirs", tag: foe, min: 20 }),
      ),
    ),
    cast: {},
    salience: 4,
    tags: ["war", "foreign"],
    cooldown: 6,
    max: 3,
    variants: [
      {
        id: "many",
        when: world({ is: "prisoners", held: "theirs", tag: foe, min: 100 }),
      },
      { id: "base" },
    ],
    fallback: "none",
    options: [
      opt(id, "exchange", [doWorld({ do: "exchange", tag: foe })]),
      opt(id, "reprisal", [
        doWorld({ do: "reprisal", tag: foe }),
        { kind: "opinion", bloc: "army", delta: 1 },
      ]),
      opt(id, "none", []),
    ],
  };
}

export const GW_HOMEFRONT_SCENES: readonly GwScene[] = [
  flu(1),
  flu(2),
  flu(3),
  {
    id: "gw_hf_red_cross",
    nation: [...SEATS],
    kind: "report",
    stage: ["war"],
    when: world({ is: "prisoners", held: "theirs", min: 20 }),
    cast: {},
    salience: 3,
    tags: ["war", "foreign", "tension_down"],
    stamp: "confirmed",
    source: "press",
    once: true,
    variants: [
      {
        id: "many",
        when: world({ is: "prisoners", held: "theirs", min: 200 }),
      },
      { id: "base" },
    ],
  },
  ...CAMP_FOES.map(camps),
  {
    id: "gw_hf_refugees",
    nation: [...SEATS],
    kind: "proposal",
    when: world({ is: "refugees", min: 1 }),
    cast: {},
    salience: 4,
    tags: ["home"],
    cooldown: 6,
    max: 2,
    variants: [
      { id: "ally", when: { kind: "not", of: world({ is: "land_lost" }) } },
      { id: "base" },
    ],
    fallback: "camps",
    options: [
      opt("gw_hf_refugees", "homes", [
        { kind: "gauge", gauge: "money", delta: -1 },
        { kind: "gauge", gauge: "morale", delta: 1 },
      ]),
      opt("gw_hf_refugees", "camps", [
        { kind: "gauge", gauge: "order", delta: 1 },
        { kind: "opinion", bloc: "press", delta: -1 },
      ]),
    ],
  },
  {
    id: "gw_hf_refugees_city",
    nation: [...SEATS],
    kind: "report",
    when: world({ is: "refugees", min: 2 }),
    cast: {},
    salience: 3,
    tags: ["home"],
    stamp: "confirmed",
    source: "press",
    cooldown: 8,
    max: 2,
    variants: [
      { id: "worst", when: world({ is: "refugees", min: 3 }) },
      { id: "base" },
    ],
  },
];
