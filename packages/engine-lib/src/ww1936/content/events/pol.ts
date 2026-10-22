// World War 1936 P6 — the Polish pack events (spec §11.13): the foreign
// minister's answer to Berlin, the Pyry meeting where the Cipher Bureau shares
// its work on the German cipher machine with Britain and France, and the
// crossing of the army to Britain in 1940. People appear by office only. A
// date event keeps its conditions on the options, with a last option for the
// rest. self = Poland.
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { T, all, any, not } from "../helpers";

export const POL_EVENTS: EventDef[] = [
  {
    // 1939-05-05: the foreign minister answers the German demands in the Sejm.
    id: "pol_beck_speech",
    kind: "country",
    picture: "crowd",
    date: { on: "1939-05-05", to: ["POL"] },
    options: [
      {
        id: "a",
        history: true,
        available: all(
          { kind: "exists", who: T("DEU") },
          not({ kind: "at_war_with", of: T("DEU") }),
        ),
        ai: { base: 80 },
        effects: [
          { kind: "war_support", pct: 10 },
          { kind: "opinion", who: T("DEU"), of: "self", value: -15, days: 365 },
        ],
      },
      {
        id: "b",
        available: all(
          { kind: "exists", who: T("DEU") },
          not({ kind: "at_war_with", of: T("DEU") }),
        ),
        ai: { base: 20 },
        effects: [
          { kind: "war_support", pct: -5 },
          { kind: "opinion", who: T("DEU"), of: "self", value: 10, days: 365 },
        ],
      },
      {
        id: "c",
        available: any(not({ kind: "exists", who: T("DEU") }), {
          kind: "at_war_with",
          of: T("DEU"),
        }),
        ai: { base: 1 },
        effects: [],
      },
    ],
  },
  {
    // 1939-07-26: the Pyry meeting. The hidden spirit pol_enigma_shared marks
    // the sharing, so pol_share_enigma and this event never give it twice.
    id: "pol_pyry_meeting",
    kind: "country",
    picture: "table",
    date: { on: "1939-07-26", to: ["POL"] },
    options: [
      {
        id: "a",
        history: true,
        available: all(
          not({ kind: "has_spirit", id: "pol_enigma_shared" }),
          any(
            { kind: "guaranteed_by", of: T("GBR") },
            { kind: "guaranteed_by", of: T("FRA") },
          ),
        ),
        ai: { base: 80 },
        effects: [
          { kind: "add_spirit", id: "pol_enigma_shared" },
          { kind: "decrypt", who: T("GBR"), on: T("DEU"), pm: 300 },
          { kind: "decrypt", who: T("FRA"), on: T("DEU"), pm: 300 },
          { kind: "opinion", who: T("GBR"), of: "self", value: 30, days: 365 },
          { kind: "opinion", who: T("FRA"), of: "self", value: 30, days: 365 },
        ],
      },
      {
        id: "b",
        available: not({ kind: "has_spirit", id: "pol_enigma_shared" }),
        ai: { base: 20 },
        effects: [{ kind: "decrypt", on: T("DEU"), pm: 100 }],
      },
      {
        id: "c",
        available: { kind: "has_spirit", id: "pol_enigma_shared" },
        ai: { base: 10 },
        effects: [
          { kind: "opinion", who: T("GBR"), of: "self", value: 10, days: 365 },
          { kind: "opinion", who: T("FRA"), of: "self", value: 10, days: 365 },
        ],
      },
    ],
  },
  {
    // 1940-06-20: after the fall of France the government and the soldiers
    // who can be taken off reach Britain.
    id: "pol_exile_forces",
    kind: "country",
    picture: "column",
    date: { on: "1940-06-20", to: ["POL"] },
    options: [
      {
        id: "a",
        history: true,
        available: { kind: "is_exile" },
        ai: { base: 10 },
        effects: [
          { kind: "exile_legitimacy", pct: 10 },
          { kind: "manpower", amount: 15000 },
          { kind: "opinion", who: T("GBR"), of: "self", value: 20, days: 365 },
        ],
      },
      {
        id: "b",
        available: not({ kind: "is_exile" }),
        ai: { base: 1 },
        effects: [],
      },
    ],
  },
];
