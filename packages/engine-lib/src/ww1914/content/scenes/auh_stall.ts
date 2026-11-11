// Great War 1914 (ww173 phase A): AUH's scenes of a front that breaks from
// strain: its own end's collapse (`auh_w_collapse`, the four options
// `sack`, `river`, `allies`, `peace`), and the enemy's. Owned by the AUH
// writer lane; shapes and conditions in /home/eser/dev/ww173-format7a.md,
// conditions from ./stall_events. Text in resources/ww1914/ko/AUH.stall.json.
import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import {
  holder,
  inst_,
  reason,
  remember,
  role,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import { collapsed, foeCollapsed } from "./stall_events";

const cmd = role("cmd");

/** The Emperor-King Karl holds the throne (the regime `karl`). */
const karlRegime = world({ is: "regime", tag: "AUH", of: ["karl"] });

export const AUH_STALL_EVENTS: readonly GwScene[] = [
  {
    id: "auh_w_collapse",
    nation: ["AUH"],
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
      { id: "east", when: collapsed(["east", "danube", "dobruja"]) },
      { id: "italy", when: collapsed(["italy", "alps"]) },
      { id: "balkan", when: collapsed(["balkan"]) },
      { id: "karl", when: karlRegime },
      { id: "base" },
    ],
    fallback: "river",
    options: [
      {
        id: "sack",
        tell: [],
        effects: [
          doWorld({ do: "leave", who: cmd }),
          remember("k_auh_collapse_sacked"),
          reason("auh_w_collapse_sack"),
        ],
      },
      {
        id: "river",
        tell: [],
        effects: [
          remember("k_auh_collapse_stood"),
          reason("auh_w_collapse_river"),
        ],
      },
      {
        id: "allies",
        tell: [],
        effects: [
          inst_("berlin", 1),
          remember("k_auh_collapse_berlin"),
          reason("auh_w_collapse_allies"),
        ],
      },
      {
        id: "peace",
        tell: [],
        effects: [
          doWorld({ do: "talks" }),
          { kind: "opinion", bloc: "army", delta: -1 },
          remember("k_auh_collapse_peace"),
          reason("auh_w_collapse_peace"),
        ],
      },
    ],
  },
  // ---- The enemy's front broke in front of us ----
  {
    id: "auh_w_foe_east",
    nation: ["AUH"],
    kind: "wire",
    once: false,
    cooldown: 6,
    salience: 6,
    tags: ["war"],
    when: foeCollapsed(["east", "danube", "dobruja"]),
    cast: { cos: holder("chief_of_staff") },
    variants: [{ id: "base" }],
  },
  {
    id: "auh_w_foe_south",
    nation: ["AUH"],
    kind: "wire",
    once: false,
    cooldown: 6,
    salience: 6,
    tags: ["war"],
    when: foeCollapsed(["balkan", "thrace", "dobruja"]),
    cast: { cos: holder("chief_of_staff") },
    variants: [{ id: "base" }],
  },
  {
    id: "auh_w_foe_italy",
    nation: ["AUH"],
    kind: "wire",
    once: false,
    cooldown: 6,
    salience: 6,
    tags: ["war"],
    when: foeCollapsed(["italy", "alps"]),
    cast: { cos: holder("chief_of_staff") },
    variants: [{ id: "base" }],
  },
];
