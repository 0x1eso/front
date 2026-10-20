// World War 1936 P6 — Nordic pack events (spec §11.13; content lane K3).
// Texts are ww1936.event_title.<id>, ww1936.event_desc.<id> and
// ww1936.event_opt.<id>.<option>.
//
// Not here because P3 already holds the same history (spec §11.13): the
// Winter War peace terms (P3 fin_moscow_peace).
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { gflag, T } from "../helpers";

export const NOR_EVENTS: readonly EventDef[] = [
  {
    // June 1940: with Norway occupied and Narvik closed, Germany presses
    // Sweden to keep its northern iron ore coming through the Baltic ports
    // (the transit agreement followed on 1940-07-08).
    id: "swe_iron_pressure",
    kind: "country",
    picture: "factory",
    date: { on: "1940-06-18", to: ["SWE"] },
    trigger: { kind: "controls_capital_of", who: T("DEU"), of: T("NOR") },
    timeoutSec: 30,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          { kind: "opinion", who: T("DEU"), of: "self", value: 25, days: 365 },
          { kind: "stability", pct: -5 },
          { kind: "pp", amount: 25 },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          {
            kind: "opinion",
            who: T("DEU"),
            of: "self",
            value: -40,
            days: 730,
          },
          { kind: "war_support", pct: 10 },
        ],
      },
    ],
  },
  {
    // A raid (P6 §10) has wrecked the heavy-water plant at the Vemork dam:
    // lane W1's destroyDam sets the world flag dam_vemork_destroyed. Norway
    // and Britain each read the report once. Facts only.
    id: "nor_heavy_water_raid",
    kind: "country",
    picture: "factory",
    receivers: ["NOR", "GBR"],
    trigger: gflag("dam_vemork_destroyed"),
    options: [
      {
        id: "a",
        ai: { base: 1 },
        effects: [
          {
            kind: "if",
            cond: { kind: "tag", tag: "NOR" },
            then: [{ kind: "war_support", pct: 5 }],
            else: [{ kind: "war_support", pct: 2 }],
          },
        ],
      },
    ],
  },
];
