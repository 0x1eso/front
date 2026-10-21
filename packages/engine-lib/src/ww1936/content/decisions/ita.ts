// World War 1936 P5 — the Italian decision (spec §19.3): the volunteer corps
// for Nationalist Spain, opened by the focus ita_spain_expedition and taken
// by the 1936-12-15 history beat (K5). The engine picks the divisions
// (spec §12, §17.4).
// Data only (tests/ww1936/ContentPurity): the helpers come from ../helpers.
import type { DecisionDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, not, T } from "../helpers";

export const ITA_DECISIONS: DecisionDef[] = [
  {
    id: "ita_send_ctv",
    category: "military",
    for: ["ITA"],
    locked: true,
    available: all(
      { kind: "at_war", who: T("ESN") },
      not({ kind: "at_war_with", of: T("ESN") }),
    ),
    cost: { pp: 25 },
    effects: [{ kind: "volunteers", to: T("ESN"), divisions: 4 }],
    ai: { base: 10 },
  },
];
