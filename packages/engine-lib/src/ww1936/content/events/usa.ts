// World War 1936 P5 — American events. Most are P3's (usa_lend_lease_act,
// usa_pearl_harbor, …) and K5's (isl_us_garrison); the focus tree fires those.
// The fascist path's usa_democratic_uprising is its own: the democrats rise
// while they still hold a following, replacing the generic regime crisis for
// the US while the regime holds (the engine does not queue that one for it).
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  NO_CIVIL_WAR,
  USA_UPRISING_COOLDOWN_DAYS,
  USA_UPRISING_MTTH_DAYS,
  USA_UPRISING_POP_PCT,
  USA_UPRISING_STABILITY,
} from "../focus/usa_fascist";
import { all, flag, not } from "../helpers";

const STABLE = { kind: "stability_ge", pct: USA_UPRISING_STABILITY } as const;

export const USA_EVENTS: EventDef[] = [
  {
    id: "usa_democratic_uprising",
    kind: "country",
    receivers: ["USA"],
    trigger: all(
      flag("usa_regime_seized"),
      { kind: "ruling", ideology: "fascist" },
      { kind: "pop_ge", ideology: "democratic", pct: USA_UPRISING_POP_PCT },
      NO_CIVIL_WAR,
    ),
    mtthDays: USA_UPRISING_MTTH_DAYS,
    once: "never",
    // A card waits for its answer for about 70 days: no second one meanwhile.
    cooldownDays: USA_UPRISING_COOLDOWN_DAYS,
    picture: "crowd",
    options: [
      {
        // Exactly one option stands at any time: this one while the regime
        // is steady, the other when it is not.
        id: "a",
        available: STABLE,
        effects: [
          { kind: "popularity", ideology: "democratic", pp: -15 },
          { kind: "stability", pct: -15 },
          { kind: "war_support", pct: -5 },
        ],
        ai: { base: 100 },
      },
      {
        id: "b",
        available: not(STABLE),
        effects: [
          { kind: "civil_war", ideology: "democratic" },
          // A failed split falls back to a democratic government: put
          // fascism back (a no-op when it already rules).
          {
            kind: "if",
            cond: not({ kind: "ruling", ideology: "fascist" }),
            then: [{ kind: "set_government", ideology: "fascist" }],
          },
        ],
        ai: { base: 100 },
      },
    ],
  },
];
