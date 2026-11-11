// Great War 1914 (ww173 phase A): FRA's scenes of a front that breaks from
// strain: its own end's collapse (`fra_w_collapse`, the four options
// `sack`, `river`, `allies`, `peace`), and the enemy's. Owned by the FRA
// writer lane; shapes and conditions in /home/eser/dev/ww173-format7a.md,
// conditions from ./stall_events. Text in resources/ww1914/ko/FRA.stall.json.
import type {
  GwGauge,
  GwInstitution,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  type GwCond,
  type GwEffect,
  type GwScene,
  reason,
  role,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld } from "@openfront/engine-api/ww1914/WorldDsl";
import { collapsed, foeCollapsed } from "./stall_events";

const cmd = role("cmd");
const inst = (i: GwInstitution, delta: number): GwEffect => ({
  kind: "inst",
  inst: i,
  delta,
});
const gauge = (g: GwGauge, delta: number): GwEffect => ({
  kind: "gauge",
  gauge: g,
  delta,
});
const gaugeAt = (g: GwGauge, max: number): GwCond => ({
  kind: "gauge",
  gauge: g,
  max,
});
const all = (...of: GwCond[]): GwCond => ({ kind: "all", of });

const WEST = ["west", "low_countries"] as const;

export const FRA_STALL_EVENTS: readonly GwScene[] = [
  {
    id: "fra_w_collapse",
    nation: ["FRA"],
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
        id: "west_mutiny",
        when: all(collapsed([...WEST]), gaugeAt("morale", 1)),
      },
      { id: "west", when: collapsed([...WEST]) },
      { id: "italy", when: collapsed(["italy", "alps"]) },
      {
        id: "balkan",
        when: collapsed(["balkan", "straits", "palestine", "mesopotamia"]),
      },
      { id: "base" },
    ],
    fallback: "river",
    options: [
      {
        id: "sack",
        tell: [],
        effects: [
          doWorld({ do: "leave", who: cmd }),
          inst("chamber", 1),
          reason("fra_w_collapse_sack"),
        ],
      },
      {
        id: "river",
        tell: [],
        effects: [inst("army", 1), reason("fra_w_collapse_river")],
      },
      {
        id: "allies",
        tell: [],
        effects: [inst("chamber", -1), reason("fra_w_collapse_allies")],
      },
      {
        id: "peace",
        tell: [],
        effects: [
          doWorld({ do: "talks" }),
          gauge("morale", -1),
          reason("fra_w_collapse_peace"),
        ],
      },
    ],
  },
  {
    id: "fra_w_foe_west",
    nation: ["FRA"],
    kind: "wire",
    when: foeCollapsed([...WEST], 0),
    once: false,
    cooldown: 6,
    cast: {},
    salience: 6,
    tags: ["war", "tension_up"],
    variants: [{ id: "mutiny", when: gaugeAt("morale", 2) }, { id: "base" }],
  },
  {
    id: "fra_w_foe_east",
    nation: ["FRA"],
    kind: "wire",
    when: foeCollapsed(["east", "danube", "dobruja", "italy", "alps"], 0),
    once: false,
    cooldown: 6,
    cast: {},
    salience: 6,
    tags: ["war", "tension_up"],
    variants: [{ id: "base" }],
  },
  {
    id: "fra_w_foe_far",
    nation: ["FRA"],
    kind: "wire",
    when: foeCollapsed(["balkan", "straits", "palestine", "mesopotamia"], 0),
    once: false,
    cooldown: 6,
    cast: {},
    salience: 6,
    tags: ["war", "tension_up"],
    variants: [{ id: "base" }],
  },
];
