// Great War 1914 (ww173 phase A): RUS's scenes of a front that breaks from
// strain: its own end's collapse (`rus_w_collapse`, the four options
// `sack`, `river`, `allies`, `peace`), and the enemy's. Owned by the RUS
// writer lane; shapes and conditions in /home/eser/dev/ww173-format7a.md,
// conditions from ./stall_events. Text in resources/ww1914/ko/RUS.stall.json.
import {
  all,
  type GwScene,
  inst_,
  reason,
  remember,
  role,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import { collapsed, foeCollapsed } from "./stall_events";

const cmd = role("cmd");
const EAST = ["east", "danube", "dobruja"] as const;
const SOUTH = [
  "caucasus",
  "mesopotamia",
  "palestine",
  "straits",
  "persia",
] as const;
const rep = world({ is: "regime", tag: "RUS", of: ["provisional", "rep"] });
const tsar = world({
  is: "regime",
  tag: "RUS",
  of: ["tsar", "crown", "regency"],
});

export const RUS_STALL_EVENTS: readonly GwScene[] = [
  {
    id: "rus_w_collapse",
    nation: ["RUS"],
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
      { id: "east_rep", when: all(collapsed([...EAST]), rep) },
      { id: "east_tsar", when: all(collapsed([...EAST]), tsar) },
      { id: "south", when: collapsed([...SOUTH]) },
      {
        id: "west",
        when: collapsed(["west", "low_countries", "italy", "alps", "balkan"]),
      },
      { id: "rep", when: rep },
      { id: "base" },
    ],
    fallback: "river",
    options: [
      {
        id: "sack",
        tell: [],
        effects: [
          doWorld({ do: "leave", who: cmd }),
          inst_("stavka", -1),
          reason("rus_w_collapse_sack"),
        ],
      },
      {
        id: "river",
        tell: [],
        effects: [remember("rus_stood_river"), reason("rus_w_collapse_river")],
      },
      {
        id: "allies",
        tell: [],
        effects: [reason("rus_w_collapse_allies")],
      },
      {
        id: "peace",
        tell: [],
        effects: [
          doWorld({ do: "talks" }),
          inst_("duma", -1),
          reason("rus_w_collapse_peace"),
        ],
      },
    ],
  },
  {
    id: "rus_w_foe_east",
    nation: ["RUS"],
    kind: "wire",
    once: false,
    cooldown: 6,
    salience: 6,
    cast: {},
    when: foeCollapsed([...EAST], 0),
    tags: ["war"],
    variants: [{ id: "rep", when: rep }, { id: "base" }],
  },
  {
    id: "rus_w_foe_south",
    nation: ["RUS"],
    kind: "wire",
    once: false,
    cooldown: 6,
    salience: 6,
    cast: {},
    when: foeCollapsed([...SOUTH], 0),
    tags: ["war"],
    variants: [{ id: "base" }],
  },
  {
    id: "rus_w_foe_west",
    nation: ["RUS"],
    kind: "wire",
    once: false,
    cooldown: 6,
    salience: 6,
    cast: {},
    when: foeCollapsed(["west", "low_countries", "balkan", "italy", "alps"], 0),
    tags: ["war"],
    variants: [{ id: "base" }],
  },
];
