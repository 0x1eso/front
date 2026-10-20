// World War 1936 P5 — French decisions (spec §19.3). Data only.
//
// fra_dissolve_vichy: opened by the focus fra_liberation_government. Inside
// a decision self is the decider (France); `who: VIC` makes Vichy the one
// that hands its regions over, while `to: "self"` still means France. The
// seven groups are the ones deu_compiegne_armistice created Vichy with; the
// annex comes last and sweeps whatever Vichy still holds, leaving the slot
// gone.
import type { DecisionDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { T, all } from "../helpers";

export const FRA_DECISIONS: DecisionDef[] = [
  {
    id: "fra_dissolve_vichy",
    category: "national",
    for: ["FRA"],
    locked: true,
    available: all(
      { kind: "controls_capital_of", of: "self" },
      { kind: "country_state", tag: "VIC", state: "active" },
    ),
    cost: { pp: 50 },
    effects: [
      { kind: "news", id: "news_fra_vichy_dissolved" },
      {
        kind: "transfer_regions",
        who: T("VIC"),
        group: "france_free_zone",
        to: "self",
      },
      {
        kind: "transfer_regions",
        who: T("VIC"),
        group: "french_north_africa",
        to: "self",
      },
      {
        kind: "transfer_regions",
        who: T("VIC"),
        group: "french_west_africa",
        to: "self",
      },
      {
        kind: "transfer_regions",
        who: T("VIC"),
        group: "french_equatorial_africa",
        to: "self",
      },
      { kind: "transfer_regions", who: T("VIC"), group: "levant", to: "self" },
      {
        kind: "transfer_regions",
        who: T("VIC"),
        group: "indochina",
        to: "self",
      },
      {
        kind: "transfer_regions",
        who: T("VIC"),
        group: "madagascar",
        to: "self",
      },
      { kind: "annex", target: T("VIC"), units: "transfer" },
    ],
    ai: { base: 10 },
  },
];
