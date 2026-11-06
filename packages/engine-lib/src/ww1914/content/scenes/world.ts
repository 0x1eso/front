import { GW_TAGS } from "@openfront/engine-api/ww1914/GwCountries";
import {
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
    fallback: "plain",
    options: [
      {
        id: "plain",
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
        id: "listen",
        tell: ["ends_game"],
        effects: [{ kind: "end", ending: "compromise_peace" }],
      },
      {
        id: "refuse",
        tell: [],
        effects: [{ kind: "reason", key: "peace_refused" }],
      },
    ],
  },
];
