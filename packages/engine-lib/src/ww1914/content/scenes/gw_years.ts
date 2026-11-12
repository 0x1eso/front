import type { GwAccordKind } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  all,
  any,
  GwCastRule,
  GwCond,
  GwEffect,
  GwOption,
  GwScene,
  GwVariant,
  not,
  reason,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";

/**
 * Common scenes: the peace years (ww190 §1) and the neutral great power
 * (§6). Data only; the text is in resources/ww1914/ko/common.years.json,
 * written without a form of address so one line serves every seat.
 *
 * The incident wires are the AI's own quarrels, ripening with pressure: at 7
 * and up the hotter body. A seat that is a party to a quarrel has its own
 * scenes, so its wire leaves it out.
 */

const SEATS: readonly GwTag[] = ["DEU", "GBR", "AUH", "RUS", "FRA"];
const except = (...tags: GwTag[]): GwTag[] =>
  SEATS.filter((t) => !tags.includes(t));

type Topic = "balkan" | "straits" | "colonial";

/** The seat's country has never fought and the last crisis is `min` months behind. */
const peace = (min: number): GwCond =>
  all(world({ is: "peace_months", min }), not(world({ is: "war" })));
/** The world is at war `min` months; the seat's country stands out of it. */
const neutralInWar = (min: number): GwCond =>
  all(world({ is: "war_months", min }), not(world({ is: "war" })));
const pressure = (topic: Topic, min: number): GwCond => ({
  kind: "pressure",
  topic,
  min,
});

const FM: GwCastRule = { any_of: [{ office: "foreign" }, { favourite: true }] };

/** An option with no price shown; its reason line is `<scene>_<pick>`. */
const opt = (scene: string, id: string, effects: GwEffect[]): GwOption => ({
  id,
  tell: [],
  effects: [...effects, reason(`${scene}_${id}`)],
});

/** A wire about others' quarrels, read and put down. */
function incident(
  id: string,
  nation: GwTag[],
  topic: Topic,
  // ww190 tune: they ripen in turn as pressure climbs (about a point a month
  // in peace), not all in the first autumn; was 4 for every one.
  at = 4,
): GwScene {
  return {
    id,
    nation,
    kind: "wire",
    when: all(peace(2), pressure(topic, at)),
    cast: {},
    salience: 3,
    tags: ["foreign", "tension_up"],
    cooldown: 6,
    max: 2,
    variants: [{ id: "hot", when: pressure(topic, at + 3) }, { id: "base" }],
  };
}

const offered = (kind: GwAccordKind): GwVariant => ({
  id: kind,
  when: world({ is: "accord_offered", kind }),
});
const brokenOf = (kind: GwAccordKind): GwVariant => ({
  id: kind,
  when: world({ is: "accord", kind, broken: true }),
});

export const GW_YEARS_SCENES: readonly GwScene[] = [
  // ---- §1 incidents among the others ----
  incident("gw_y_albania", [...SEATS], "balkan"),
  incident("gw_y_dreadnoughts", [...SEATS], "straits", 8),
  incident("gw_y_liman", except("DEU"), "straits", 12),
  incident("gw_y_portugal", except("DEU", "GBR"), "colonial", 16),
  incident("gw_y_baghdad", except("DEU", "GBR"), "colonial", 20),
  {
    id: "gw_y_arms_abroad",
    nation: [...SEATS],
    kind: "report",
    when: all(
      peace(3),
      any(...SEATS.map((tag) => world({ is: "arming", tag, min: 2 }))),
    ),
    cast: {},
    salience: 3,
    tags: ["foreign", "tension_up"],
    stamp: "confirmed",
    source: "press",
    cooldown: 6,
    max: 2,
    variants: [
      {
        id: "navy",
        when: all(
          world({ is: "arming", tag: "DEU", min: 2 }),
          world({ is: "arming", tag: "GBR", min: 2 }),
        ),
      },
      { id: "base" },
    ],
  },
  // ---- §1 accords: the offer (S1 lays it), and one broken ----
  {
    id: "gw_y_accord_offer",
    scheduledOnly: true,
    nation: [...SEATS],
    kind: "proposal",
    when: world({ is: "accord_offered" }),
    cast: { fm: FM },
    salience: 6,
    tags: ["foreign", "tension_down"],
    cooldown: 6,
    max: 3,
    variants: [
      offered("naval"),
      offered("colonial"),
      offered("balkan"),
      offered("straits"),
      { id: "base" },
    ],
    fallback: "no",
    options: [
      opt("gw_y_accord_offer", "yes", [
        doWorld({ do: "accord_answer", yes: true }),
      ]),
      opt("gw_y_accord_offer", "no", [
        doWorld({ do: "accord_answer", yes: false }),
      ]),
    ],
  },
  {
    id: "gw_y_accord_broken",
    nation: [...SEATS],
    kind: "report",
    when: world({ is: "accord", broken: true }),
    cast: {},
    salience: 5,
    tags: ["foreign", "tension_up"],
    stamp: "confirmed",
    source: "press",
    once: true,
    variants: [
      brokenOf("naval"),
      brokenOf("colonial"),
      brokenOf("balkan"),
      brokenOf("straits"),
      { id: "base" },
    ],
  },
  // ---- §1 the second crisis lit, and the long peace ----
  {
    id: "gw_y_second_crisis",
    nation: [...SEATS],
    kind: "wire",
    when: all(
      // ww190 tune: a later spark opens at step 3 (GW_SHORT_START).
      world({ is: "chain", short: true, min: 3, max: 4 }),
      not(world({ is: "war" })),
    ),
    cast: {},
    salience: 5,
    tags: ["foreign", "tension_up"],
    cooldown: 10,
    max: 3,
    variants: [
      { id: "straits", when: { kind: "crisis", topic: "straits" } },
      { id: "colonial", when: { kind: "crisis", topic: "colonial" } },
      { id: "balkan", when: { kind: "crisis", topic: "balkan" } },
      { id: "base" },
    ],
  },
  {
    id: "gw_y_long_peace",
    nation: [...SEATS],
    kind: "report",
    // ww190 tune: peace_months counts from the last crisis, so 30 never came.
    // The home question climbs about a point a month in peace: the state, not
    // a date, says the peace has lasted.
    when: all(peace(2), { kind: "pressure", topic: "home", min: 21 }),
    cast: {},
    salience: 4,
    tags: ["home", "tension_down"],
    stamp: "confirmed",
    source: "press",
    once: true,
    variants: [
      {
        id: "games",
        when: world({ is: "date", from: "1916-01", to: "1916-09" }),
      },
      { id: "arming", when: world({ is: "arming", min: 2 }) },
      { id: "base" },
    ],
  },
  // ---- §6 the neutral great power ----
  {
    id: "gw_nt_bids",
    nation: [...SEATS],
    kind: "report",
    when: all(neutralInWar(2), world({ is: "courted", min: 1 })),
    cast: {},
    salience: 5,
    tags: ["foreign"],
    stamp: "confirmed",
    source: "press",
    cooldown: 4,
    max: 2,
    variants: [
      {
        id: "central",
        when: world({ is: "courted", side: "central", min: 2 }),
      },
      {
        id: "entente",
        when: world({ is: "courted", side: "entente", min: 2 }),
      },
      { id: "base" },
    ],
  },
  {
    id: "gw_nt_mediate",
    nation: [...SEATS],
    kind: "proposal",
    when: all(neutralInWar(6), not(world({ is: "mediating" }))),
    cast: { fm: FM },
    salience: 4,
    tags: ["foreign", "tension_down"],
    cooldown: 6,
    max: 2,
    variants: [
      { id: "long", when: world({ is: "war_months", min: 24 }) },
      { id: "base" },
    ],
    fallback: "wait",
    options: [
      opt("gw_nt_mediate", "offer", [
        doWorld({ do: "mediate" }),
        { kind: "opinion", bloc: "press", delta: 1 },
      ]),
      opt("gw_nt_mediate", "wait", []),
    ],
  },
  {
    id: "gw_nt_mediating",
    nation: [...SEATS],
    kind: "wire",
    when: world({ is: "mediating" }),
    cast: {},
    salience: 4,
    tags: ["foreign"],
    cooldown: 3,
    max: 2,
    variants: [{ id: "base" }],
  },
  {
    id: "gw_nt_loans",
    nation: [...SEATS],
    kind: "proposal",
    when: neutralInWar(4),
    cast: {},
    salience: 3,
    tags: ["home"],
    cooldown: 6,
    max: 2,
    variants: [
      { id: "courted", when: world({ is: "courted", min: 2 }) },
      { id: "base" },
    ],
    fallback: "both",
    options: [
      opt("gw_nt_loans", "both", [
        doWorld({ do: "budget_item", item: "treasury", pct: 15 }),
        { kind: "opinion", bloc: "business", delta: 1 },
      ]),
      opt("gw_nt_loans", "none", [
        { kind: "opinion", bloc: "press", delta: 1 },
        { kind: "opinion", bloc: "business", delta: -1 },
      ]),
    ],
  },
];
