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
 * Common scenes: the conference and after (ww190 §10, `gw_aft_`), and after a
 * separate peace (§11, `gw_sep_`). Data only; the text is in
 * resources/ww1914/ko/common.after.json.
 */

const SEATS: readonly GwTag[] = ["DEU", "GBR", "AUH", "RUS", "FRA"];
const POWERS: readonly GwTag[] = [...SEATS, "ITA", "OTT", "USA", "JPN"];

const after = (min: number): GwCond => world({ is: "after_months", min });
/** Months since the seat's own peace, while it plays on. */
const leftWar = (min: number, max?: number): GwCond =>
  world({ is: "left_war", min, max });

const opt = (scene: string, id: string, effects: GwEffect[]): GwOption => ({
  id,
  tell: [],
  effects: [...effects, reason(`${scene}_${id}`)],
});

/** A paper of the aftermath, read once. */
function aftReport(
  id: string,
  when: GwCond,
  variants: GwScene["variants"],
): GwScene {
  return {
    id,
    nation: [...SEATS],
    kind: "report",
    stage: ["aftermath"],
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

export const GW_AFTER_SCENES: readonly GwScene[] = [
  // ---- §10 the conference and after ----
  aftReport("gw_aft_map", after(0), [
    { id: "won", when: world({ is: "peace_side", of: ["won"] }) },
    { id: "lost", when: world({ is: "peace_side", of: ["lost"] }) },
    { id: "base" },
  ]),
  aftReport("gw_aft_ratify_abroad", after(1), [
    {
      id: "refused",
      when: any(
        ...POWERS.map((tag) => world({ is: "ratified", tag, no: true })),
      ),
    },
    { id: "base" },
  ]),
  aftReport("gw_aft_revolutions", after(1), [
    {
      id: "central",
      when: any(
        world({ is: "beaten", tag: "DEU" }),
        world({ is: "beaten", tag: "AUH" }),
      ),
    },
    { id: "east", when: world({ is: "beaten", tag: "RUS" }) },
    { id: "base" },
  ]),
  aftReport("gw_aft_soldiers", after(2), [
    { id: "ours", when: world({ is: "demob", min: 1 }) },
    { id: "base" },
  ]),
  aftReport("gw_aft_winter", after(3), [
    { id: "flu", when: world({ is: "flu", min: 1 }) },
    { id: "base" },
  ]),
  // ---- §11 after a separate peace, playing on ----
  {
    id: "gw_sep_ally",
    nation: [...SEATS],
    kind: "proposal",
    when: leftWar(0, 2),
    cast: {},
    salience: 6,
    tags: ["foreign"],
    once: true,
    variants: [{ id: "base" }],
    fallback: "silence",
    options: [
      opt("gw_sep_ally", "explain", [
        { kind: "opinion", bloc: "press", delta: -1 },
        { kind: "temp", delta: -1 },
      ]),
      opt("gw_sep_ally", "silence", [
        { kind: "opinion", bloc: "army", delta: 1 },
      ]),
    ],
  },
  {
    id: "gw_sep_courted",
    nation: [...SEATS],
    kind: "report",
    when: all(leftWar(1), world({ is: "courted", min: 1 })),
    cast: {},
    salience: 4,
    tags: ["foreign"],
    stamp: "confirmed",
    source: "press",
    cooldown: 4,
    max: 2,
    variants: [
      { id: "high", when: world({ is: "courted", min: 3 }) },
      { id: "base" },
    ],
  },
  {
    id: "gw_sep_price",
    nation: [...SEATS],
    kind: "proposal",
    when: leftWar(2),
    cast: {},
    salience: 4,
    tags: ["home"],
    once: true,
    variants: [
      { id: "land", when: world({ is: "land_lost" }) },
      { id: "base" },
    ],
    fallback: "quiet",
    options: [
      opt("gw_sep_price", "tell", [
        { kind: "gauge", gauge: "morale", delta: -1 },
        { kind: "opinion", bloc: "press", delta: 1 },
      ]),
      opt("gw_sep_price", "quiet", [{ kind: "rumour", delta: 1 }]),
    ],
  },
  {
    id: "gw_sep_new_war",
    nation: [...SEATS],
    kind: "proposal",
    when: all(leftWar(3), { kind: "temp", min: 5 }),
    cast: {},
    salience: 5,
    tags: ["foreign", "tension_up"],
    once: true,
    variants: [{ id: "base" }],
    fallback: "out",
    options: [
      opt("gw_sep_new_war", "guard", [
        doWorld({ do: "arms", line: "army", delta: 5 }),
        { kind: "opinion", bloc: "army", delta: 1 },
      ]),
      opt("gw_sep_new_war", "out", [
        { kind: "opinion", bloc: "workers", delta: 1 },
        { kind: "opinion", bloc: "army", delta: -1 },
      ]),
    ],
  },
  {
    id: "gw_sep_world_ends",
    nation: [...SEATS],
    kind: "report",
    when: all(leftWar(2), world({ is: "war_months", min: 36 })),
    cast: {},
    salience: 5,
    tags: ["foreign"],
    stamp: "confirmed",
    source: "press",
    once: true,
    variants: [
      { id: "america", when: world({ is: "entered", tag: "USA" }) },
      { id: "base" },
    ],
  },
];
