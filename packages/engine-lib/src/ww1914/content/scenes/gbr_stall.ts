// Great War 1914 (ww173 phase A): GBR's scenes of a front that breaks from
// strain: its own end's collapse (`gbr_w_collapse`, the four options
// `sack`, `river`, `allies`, `peace`), and the enemy's. Owned by the GBR
// writer lane; shapes and conditions in /home/eser/dev/ww173-format7a.md,
// conditions from ./stall_events. Text in resources/ww1914/ko/GBR.stall.json.
import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import {
  all,
  inst_,
  reason,
  remember,
  role,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import { collapsed, foeCollapsed } from "./stall_events";

const cmd = role("cmd");

export const GBR_STALL_EVENTS: readonly GwScene[] = [
  // The seat's own end broke. Variants, most specific first: the west under
  // a war cabinet; the west; Kut's country; the Straits; any other.
  {
    id: "gbr_w_collapse",
    nation: ["GBR"],
    kind: "proposal",
    scheduledOnly: true,
    cast: {
      cmd: {
        any_of: [
          { called: true },
          { office: "chief_of_staff" },
          { office: "war" },
        ],
      },
    },
    salience: 9,
    tags: ["war", "tension_up"],
    variants: [
      {
        id: "west_cabinet",
        when: all(
          collapsed(["west", "low_countries"]),
          world({
            is: "regime",
            tag: "GBR",
            of: ["war_cabinet", "national"],
          }),
        ),
      },
      { id: "west", when: collapsed(["west", "low_countries"]) },
      { id: "kut", when: collapsed(["mesopotamia", "persia"]) },
      { id: "straits", when: collapsed(["straits", "thrace"]) },
      { id: "base" },
    ],
    fallback: "river",
    options: [
      {
        id: "sack",
        tell: [],
        effects: [
          doWorld({ do: "leave", who: cmd }),
          { kind: "opinion", bloc: "press", delta: 1 },
          reason("gbr_w_collapse_sack"),
        ],
      },
      {
        id: "river",
        tell: [],
        effects: [
          trustOf(cmd, 1),
          { kind: "opinion", bloc: "army", delta: 1 },
          reason("gbr_w_collapse_river"),
        ],
      },
      {
        id: "allies",
        tell: [],
        effects: [
          inst_("cabinet", -1),
          remember("m_asked_allies_men"),
          reason("gbr_w_collapse_allies"),
        ],
      },
      {
        id: "peace",
        tell: [],
        effects: [
          doWorld({ do: "talks" }),
          { kind: "opinion", bloc: "parliament", delta: -1 },
          reason("gbr_w_collapse_peace"),
        ],
      },
    ],
  },

  // The foe's end broke in front of us: a paper to read, nothing to pick.
  {
    id: "gbr_w_foe_west",
    nation: ["GBR"],
    kind: "wire",
    when: foeCollapsed(["west", "low_countries"], 0),
    once: false,
    cooldown: 6,
    salience: 6,
    tags: ["war"],
    cast: {},
    variants: [{ id: "base" }],
  },
  {
    id: "gbr_w_foe_turk",
    nation: ["GBR"],
    kind: "wire",
    when: foeCollapsed(
      ["mesopotamia", "palestine", "caucasus", "straits", "persia"],
      0,
    ),
    once: false,
    cooldown: 6,
    salience: 6,
    tags: ["war"],
    cast: {},
    variants: [{ id: "base" }],
  },
  {
    id: "gbr_w_foe_south",
    nation: ["GBR"],
    kind: "wire",
    when: foeCollapsed(["italy", "alps", "balkan", "danube", "dobruja"], 0),
    once: false,
    cooldown: 6,
    salience: 6,
    tags: ["war"],
    cast: {},
    variants: [{ id: "base" }],
  },
];
