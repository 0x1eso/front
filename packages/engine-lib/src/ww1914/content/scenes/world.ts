import { GW_TAGS } from "@openfront/engine-api/ww1914/GwCountries";
import {
  all,
  any,
  flag,
  GwScene,
  inst_,
  role,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";

/**
 * Scenes the world itself calls (engine/ww1914: People, Home, Ai): the way
 * out it always owes the seat (design §4.6). They reach the desk only through
 * `seat.scheduled`, so the deal never draws them: nothing sets this flag.
 * Text is in resources/ww1914/ko/common.json.
 */
const onlyCalled = flag("gw_world_called_only");
const everyone = [...GW_TAGS];
const who = role("who");

export const WORLD_SCENES: readonly GwScene[] = [
  {
    id: "gw_letter",
    nation: everyone,
    kind: "audience",
    when: onlyCalled,
    cast: { who: { subject: true } },
    salience: 9,
    tags: ["people"],
    variants: [{ id: "base" }],
    fallback: "keep",
    options: [
      {
        id: "keep",
        tell: ["trust:+2", "authority:-5"],
        effects: [
          doWorld({ do: "keep", who }),
          doWorld({ do: "authority", delta: -5 }),
          { kind: "reason", key: "letter_refused" },
        ],
      },
      {
        id: "accept",
        tell: ["leaves"],
        effects: [doWorld({ do: "leave", who })],
      },
    ],
  },
  {
    id: "gw_ailing",
    nation: everyone,
    kind: "wire",
    when: onlyCalled,
    cast: { who: { subject: true } },
    salience: 7,
    tags: ["people"],
    variants: [{ id: "base" }],
  },
  {
    id: "gw_unrest",
    nation: everyone,
    kind: "proposal",
    when: onlyCalled,
    cast: {},
    salience: 9,
    tags: ["home", "tension_down"],
    variants: [
      { id: "mutiny", when: world({ is: "unrest", min: 3 }) },
      { id: "riots", when: world({ is: "unrest", min: 2 }) },
      { id: "base" },
    ],
    fallback: "bread",
    options: [
      {
        id: "bread",
        tell: ["order:+1", "money:-1"],
        effects: [
          doWorld({ do: "calm" }),
          { kind: "gauge", gauge: "money", delta: -1 },
        ],
      },
      {
        id: "promise",
        tell: ["order:+1", "reichstag:+1", "authority:-10"],
        effects: [
          doWorld({ do: "calm" }),
          inst_("reichstag", 1),
          doWorld({ do: "authority", delta: -10 }),
        ],
      },
      {
        id: "firm",
        tell: ["army:+1"],
        effects: [inst_("army", 1), { kind: "reason", key: "held_firm" }],
      },
    ],
  },
  {
    id: "gw_credits",
    nation: ["DEU"],
    kind: "proposal",
    when: onlyCalled,
    cast: {},
    salience: 8,
    tags: ["home"],
    variants: [
      { id: "cold", when: { kind: "inst", inst: "reichstag", max: -2 } },
      { id: "base" },
    ],
    fallback: "short",
    options: [
      {
        id: "plain",
        // Without a price the Reichstag says no.
        when: { kind: "inst", inst: "reichstag", min: -2 },
        tell: ["money:+2", "reichstag:-1"],
        effects: [
          { kind: "gauge", gauge: "money", delta: 2 },
          inst_("reichstag", -1),
        ],
      },
      {
        id: "reform",
        tell: ["money:+2", "reichstag:+1", "army:-1"],
        effects: [
          { kind: "gauge", gauge: "money", delta: 2 },
          inst_("reichstag", 1),
          inst_("army", -1),
          { kind: "reason", key: "credits_for_reform" },
        ],
      },
      {
        id: "short",
        tell: ["money:+1"],
        effects: [{ kind: "gauge", gauge: "money", delta: 1 }],
      },
    ],
  },
  {
    id: "gw_peace_feeler",
    nation: everyone,
    kind: "proposal",
    when: onlyCalled,
    cast: {},
    salience: 8,
    tags: ["foreign", "tension_down"],
    variants: [
      { id: "ahead", when: world({ is: "score", min: 15 }) },
      { id: "behind", when: world({ is: "score", max: -15 }) },
      { id: "base" },
    ],
    fallback: "refuse",
    options: [
      {
        id: "refuse",
        tell: [],
        effects: [{ kind: "reason", key: "peace_refused" }],
      },
      {
        id: "listen",
        tell: ["talks"],
        effects: [doWorld({ do: "talks" })],
      },
    ],
  },
  // ww173 phase B: the enemy is preparing a great offensive, and we know it
  // (Offensives.markSeen). Variants by what was seen; W7b writes the words.
  {
    id: "gw_offensive_seen",
    nation: everyone,
    kind: "proposal",
    when: all(onlyCalled, world({ is: "foe_offensive" })),
    cast: {},
    salience: 9,
    tags: ["war"],
    variants: [
      { id: "long", when: world({ is: "foe_offensive", method: ["long"] }) },
      { id: "broad", when: world({ is: "foe_offensive", method: ["broad"] }) },
      {
        id: "surprise",
        when: world({ is: "foe_offensive", method: ["surprise"] }),
      },
      { id: "base" },
    ],
    fallback: "reserves",
    options: [
      {
        id: "reserves",
        tell: [],
        effects: [doWorld({ do: "counter_offensive", pick: "reserves" })],
      },
      {
        id: "step_back",
        when: any(
          world({ is: "tech", id: "depth_defence" }),
          world({ is: "era", of: ["depth", "storm"] }),
        ),
        tell: [],
        effects: [doWorld({ do: "counter_offensive", pick: "step_back" })],
      },
      {
        id: "strike",
        tell: [],
        effects: [doWorld({ do: "counter_offensive", pick: "strike" })],
      },
      // "모르는 척한다": learned through his codes, we act as if we never
      // knew, so the read raises no suspicion (Spies "hide", ww173 formatc).
      {
        id: "dumb",
        when: world({ is: "foe_offensive", code: true }),
        tell: [],
        effects: [
          doWorld({ do: "counter_offensive", pick: "dumb" }),
          doWorld({ do: "spy", act: "hide" }),
        ],
      },
    ],
  },
];
