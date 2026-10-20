// World War 1936 P6 — the new-state pack event (spec §11.13): every dormant
// slot gets it once, on its first country turn after P5 wakes it (a dormant
// slot has no country turn, so `exists` holds from the wake on). The text is
// the same neutral wording for every slot and names no one (spec §24-7).
// Data only (ContentPurity).
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const NEW_EVENTS: EventDef[] = [
  {
    id: "new_state_proclaimed",
    kind: "country",
    picture: "document",
    receivers: [
      "SVK",
      "HRV",
      "VIC",
      "RSI",
      "RNG",
      "MEN",
      "BRM",
      "PHL",
      "CW1",
      "CW2",
      "CW3",
      "CW4",
      "CW5",
      "CW6",
    ],
    trigger: { kind: "exists" },
    once: "country",
    options: [
      {
        id: "a",
        ai: { base: 60 },
        effects: [
          { kind: "stability", pct: 5 },
          { kind: "pp", amount: 50 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "unlock_template", template: "new_infantry_division" },
          { kind: "manpower", recruitablePct: 1 },
        ],
      },
    ],
  },
];
