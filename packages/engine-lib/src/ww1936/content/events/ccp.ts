// World War 1936 P6 (spec §11.13): the Communist pack events. Factual
// accounts only: the end of the Long March and the clash in southern Anhui
// in January 1941 (spec §24-7: no glorification of either side).
// Data only (tests/ww1936/ContentPurity): the helpers come from ../helpers.
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { T } from "../helpers";

export const CCP_EVENTS: EventDef[] = [
  {
    // The Red Army columns were united in Gansu and northern Shaanxi in
    // October 1936 (Huining 9 Oct, Jiangtaibao/Bao'an 22 Oct).
    id: "ccp_long_march_end",
    kind: "country",
    picture: "column",
    date: { on: "1936-10-22", to: ["CCP"] },
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 1 },
        effects: [
          { kind: "stability", pct: 5 },
          { kind: "war_support", pct: 5 },
        ],
      },
    ],
  },
  {
    // The New Fourth Army incident, 7-13 January 1941 (Maolin, southern
    // Anhui): the Communists' answer. ww229 MA3: no longer dated; the
    // Nationalists' side of the same incident (chn_ev_south_anhui, option
    // a) fires it, so the clash happens once and only when Chongqing
    // ordered it. It needs the pact and the New Fourth Army.
    id: "ccp_new_fourth_clash",
    kind: "country",
    picture: "border",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 85 },
        effects: [
          { kind: "opinion", of: T("CHN"), value: -30, days: 730 },
          { kind: "opinion", who: T("CHN"), of: "self", value: -30, days: 730 },
          { kind: "war_support", pct: 5 },
          { kind: "army_xp", amount: 10 },
        ],
      },
      {
        id: "b",
        ai: { base: 15 },
        effects: [
          { kind: "break_nap", of: T("CHN") },
          { kind: "remove_spirit", id: "ccp_anti_japan_front" },
          { kind: "opinion", of: T("CHN"), value: -50, days: 730 },
          { kind: "opinion", who: T("CHN"), of: "self", value: -50, days: 730 },
        ],
      },
    ],
  },
];
