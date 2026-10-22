// World War 1936 P6 (spec §11.13): the regional cliques' pack events.
// Who is who inside an event: self = the receiver, from = the sender.
// Effects that can make a country vanish (annex) come last.
// Data only (tests/ww1936/ContentPurity): the helpers come from ../helpers.
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, exists, not, T } from "../helpers";

export const CHW_EVENTS: EventDef[] = [
  {
    // Fired by chw_join_center (from = the clique) to China: a peaceful
    // annexation offer. Several cliques may send it, so it can repeat.
    id: "chw_join_offer",
    kind: "country",
    picture: "document",
    once: "never",
    options: [
      {
        id: "a",
        ai: { base: 80 },
        effects: [{ kind: "annex", target: "from", units: "transfer" }],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "opinion", who: "from", of: "self", value: -10, days: 365 },
        ],
      },
    ],
  },
  {
    // Xinjiang turned from the Soviet Union to the National Government in
    // the summer of 1942 (Chongqing delegations in July and August).
    id: "chw_sheng_turn",
    kind: "country",
    picture: "document",
    date: { on: "1942-07-01", to: ["SIK"] },
    trigger: all(exists("CHN"), not({ kind: "at_war_with", of: T("CHN") })),
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 80 },
        effects: [
          { kind: "opinion", of: T("CHN"), value: 50, days: 730 },
          { kind: "opinion", who: T("CHN"), of: "self", value: 30, days: 730 },
          { kind: "opinion", of: T("SUN"), value: -40, days: 730 },
          { kind: "stability", pct: -5 },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "opinion", of: T("SUN"), value: 20, days: 365 },
          { kind: "opinion", of: T("CHN"), value: -20, days: 365 },
        ],
      },
    ],
  },
];
