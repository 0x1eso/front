// ww226 (1936 mode): the routes to an ideology a country does not hold.
// Every country that plays can reach every ideology through focuses: the
// generic tree's four branches under its ideology focuses (any country of
// the generic tree or a regional pack), and the great powers' own routes in
// their own voice. Each branch raises the ideology, builds its party and
// ends in a civil war for it. The AI walks one only when the movement is
// strong (and the last step only when the country is unstable), so history
// stays the usual course. Data only (ContentPurity).
import type { Condition } from "@openfront/engine-api/ww1936/PoliticsDsl";
import type {
  AiWeight,
  FocusDef,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, not } from "../helpers";

/** The movement's popularity (percent) the civil war focus needs. */
export const ROUTE_READY_PCT = 25;
/** The AI starts a great power's route only with the movement at this share or more ... */
export const ROUTE_AI_START_PCT = 20;
/** ... a generic branch at this share (its ideology focus already gave the movement a lot) ... */
export const ROUTE_AI_START_PCT_GENERIC = 30;
/** ... and takes the last step only below this stability (percent). */
export const ROUTE_AI_STABILITY = 40;

const NOT_DEM: Condition = not({ kind: "ruling", ideology: "democratic" });
const READY_DEM: Condition = all(NOT_DEM, {
  kind: "pop_ge",
  ideology: "democratic",
  pct: ROUTE_READY_PCT,
});
const AI_START_DEM: AiWeight = {
  base: 2,
  mods: [
    {
      if: not({
        kind: "pop_ge",
        ideology: "democratic",
        pct: ROUTE_AI_START_PCT,
      }),
      factor: 0,
    },
  ],
};
const AI_START_GEN_DEM: AiWeight = {
  base: 2,
  mods: [
    {
      if: not({
        kind: "pop_ge",
        ideology: "democratic",
        pct: ROUTE_AI_START_PCT_GENERIC,
      }),
      factor: 0,
    },
  ],
};
const NOT_COM: Condition = not({ kind: "ruling", ideology: "communist" });
const READY_COM: Condition = all(NOT_COM, {
  kind: "pop_ge",
  ideology: "communist",
  pct: ROUTE_READY_PCT,
});
const AI_START_COM: AiWeight = {
  base: 2,
  mods: [
    {
      if: not({
        kind: "pop_ge",
        ideology: "communist",
        pct: ROUTE_AI_START_PCT,
      }),
      factor: 0,
    },
  ],
};
const AI_START_GEN_COM: AiWeight = {
  base: 2,
  mods: [
    {
      if: not({
        kind: "pop_ge",
        ideology: "communist",
        pct: ROUTE_AI_START_PCT_GENERIC,
      }),
      factor: 0,
    },
  ],
};
const NOT_FAS: Condition = not({ kind: "ruling", ideology: "fascist" });
const READY_FAS: Condition = all(NOT_FAS, {
  kind: "pop_ge",
  ideology: "fascist",
  pct: ROUTE_READY_PCT,
});
const AI_START_FAS: AiWeight = {
  base: 2,
  mods: [
    {
      if: not({ kind: "pop_ge", ideology: "fascist", pct: ROUTE_AI_START_PCT }),
      factor: 0,
    },
  ],
};
const AI_START_GEN_FAS: AiWeight = {
  base: 2,
  mods: [
    {
      if: not({
        kind: "pop_ge",
        ideology: "fascist",
        pct: ROUTE_AI_START_PCT_GENERIC,
      }),
      factor: 0,
    },
  ],
};
const NOT_NEU: Condition = not({ kind: "ruling", ideology: "neutral" });
const READY_NEU: Condition = all(NOT_NEU, {
  kind: "pop_ge",
  ideology: "neutral",
  pct: ROUTE_READY_PCT,
});
const AI_START_NEU: AiWeight = {
  base: 2,
  mods: [
    {
      if: not({ kind: "pop_ge", ideology: "neutral", pct: ROUTE_AI_START_PCT }),
      factor: 0,
    },
  ],
};
const AI_START_GEN_NEU: AiWeight = {
  base: 2,
  mods: [
    {
      if: not({
        kind: "pop_ge",
        ideology: "neutral",
        pct: ROUTE_AI_START_PCT_GENERIC,
      }),
      factor: 0,
    },
  ],
};
/** The route's middle steps: once started, the AI carries on. */
const AI_ON: AiWeight = { base: 5 };
/** The civil war itself: only a shaken country. */
const AI_RISE: AiWeight = {
  base: 2,
  mods: [{ if: { kind: "stability_ge", pct: ROUTE_AI_STABILITY }, factor: 0 }],
};

/** The generic tree (and every pack tree that keeps its ideology focuses). */
export const ROUTES_GENERIC: FocusDef[] = [
  // ---- democratic (rows 3-6) ----
  {
    id: "gen_dem_opposition_front",
    tree: "generic",
    x: 16,
    y: 3,
    days: 35,
    branch: "politics",
    icon: "ballot",
    prereq: [["gen_pol_dem"]],
    available: NOT_DEM,
    effects: [{ kind: "popularity", ideology: "democratic", pp: 4 }],
    ai: AI_START_GEN_DEM,
  },
  {
    id: "gen_dem_citizens_committees",
    tree: "generic",
    x: 16,
    y: 4,
    days: 35,
    branch: "politics",
    icon: "document",
    prereq: [["gen_dem_opposition_front"]],
    effects: [
      { kind: "popularity", ideology: "democratic", pp: 4 },
      { kind: "stability", pct: -1 },
    ],
    ai: AI_ON,
  },
  {
    id: "gen_dem_defence_leagues",
    tree: "generic",
    x: 16,
    y: 5,
    days: 35,
    branch: "politics",
    icon: "shield",
    prereq: [["gen_dem_citizens_committees"]],
    effects: [
      { kind: "popularity", ideology: "democratic", pp: 3 },
      { kind: "stability", pct: -2 },
    ],
    ai: AI_ON,
  },
  {
    id: "gen_dem_uprising",
    tree: "generic",
    x: 16,
    y: 6,
    days: 70,
    branch: "politics",
    icon: "flag",
    prereq: [["gen_dem_defence_leagues"]],
    available: READY_DEM,
    effects: [
      { kind: "popularity", ideology: "democratic", pp: 3 },
      { kind: "civil_war", ideology: "democratic" },
    ],
    ai: AI_RISE,
  },
  // ---- communist (rows 3-6) ----
  {
    id: "gen_com_party_cells",
    tree: "generic",
    x: 17,
    y: 3,
    days: 35,
    branch: "politics",
    icon: "fist",
    prereq: [["gen_pol_com"]],
    available: NOT_COM,
    effects: [{ kind: "popularity", ideology: "communist", pp: 4 }],
    ai: AI_START_GEN_COM,
  },
  {
    id: "gen_com_workers_councils",
    tree: "generic",
    x: 17,
    y: 4,
    days: 35,
    branch: "politics",
    icon: "factory",
    prereq: [["gen_com_party_cells"]],
    effects: [
      { kind: "popularity", ideology: "communist", pp: 4 },
      { kind: "stability", pct: -1 },
    ],
    ai: AI_ON,
  },
  {
    id: "gen_com_red_guards",
    tree: "generic",
    x: 17,
    y: 5,
    days: 35,
    branch: "politics",
    icon: "sword",
    prereq: [["gen_com_workers_councils"]],
    effects: [
      { kind: "popularity", ideology: "communist", pp: 3 },
      { kind: "stability", pct: -2 },
    ],
    ai: AI_ON,
  },
  {
    id: "gen_com_revolution",
    tree: "generic",
    x: 17,
    y: 6,
    days: 70,
    branch: "politics",
    icon: "star_plain",
    prereq: [["gen_com_red_guards"]],
    available: READY_COM,
    effects: [
      { kind: "popularity", ideology: "communist", pp: 3 },
      { kind: "civil_war", ideology: "communist" },
    ],
    ai: AI_RISE,
  },
  // ---- fascist (rows 3-6) ----
  {
    id: "gen_fas_national_party",
    tree: "generic",
    x: 18,
    y: 3,
    days: 35,
    branch: "politics",
    icon: "eagle_plain",
    prereq: [["gen_pol_fas"]],
    available: NOT_FAS,
    effects: [{ kind: "popularity", ideology: "fascist", pp: 4 }],
    ai: AI_START_GEN_FAS,
  },
  {
    id: "gen_fas_street_squads",
    tree: "generic",
    x: 18,
    y: 4,
    days: 35,
    branch: "politics",
    icon: "megaphone",
    prereq: [["gen_fas_national_party"]],
    effects: [
      { kind: "popularity", ideology: "fascist", pp: 4 },
      { kind: "stability", pct: -1 },
    ],
    ai: AI_ON,
  },
  {
    id: "gen_fas_officer_backers",
    tree: "generic",
    x: 18,
    y: 5,
    days: 35,
    branch: "politics",
    icon: "medal",
    prereq: [["gen_fas_street_squads"]],
    effects: [
      { kind: "popularity", ideology: "fascist", pp: 3 },
      { kind: "stability", pct: -2 },
    ],
    ai: AI_ON,
  },
  {
    id: "gen_fas_march",
    tree: "generic",
    x: 18,
    y: 6,
    days: 70,
    branch: "politics",
    icon: "sword",
    prereq: [["gen_fas_officer_backers"]],
    available: READY_FAS,
    effects: [
      { kind: "popularity", ideology: "fascist", pp: 3 },
      { kind: "civil_war", ideology: "fascist" },
    ],
    ai: AI_RISE,
  },
  // ---- neutral (rows 3-6) ----
  {
    id: "gen_neu_order_party",
    tree: "generic",
    x: 19,
    y: 3,
    days: 35,
    branch: "politics",
    icon: "crown",
    prereq: [["gen_pol_neu"]],
    available: NOT_NEU,
    effects: [{ kind: "popularity", ideology: "neutral", pp: 4 }],
    ai: AI_START_GEN_NEU,
  },
  {
    id: "gen_neu_officers_circle",
    tree: "generic",
    x: 19,
    y: 4,
    days: 35,
    branch: "politics",
    icon: "compass",
    prereq: [["gen_neu_order_party"]],
    effects: [
      { kind: "popularity", ideology: "neutral", pp: 4 },
      { kind: "stability", pct: -1 },
    ],
    ai: AI_ON,
  },
  {
    id: "gen_neu_loyal_regiments",
    tree: "generic",
    x: 19,
    y: 5,
    days: 35,
    branch: "politics",
    icon: "shield",
    prereq: [["gen_neu_officers_circle"]],
    effects: [
      { kind: "popularity", ideology: "neutral", pp: 3 },
      { kind: "stability", pct: -2 },
    ],
    ai: AI_ON,
  },
  {
    id: "gen_neu_coup",
    tree: "generic",
    x: 19,
    y: 6,
    days: 70,
    branch: "politics",
    icon: "tower",
    prereq: [["gen_neu_loyal_regiments"]],
    available: READY_NEU,
    effects: [
      { kind: "popularity", ideology: "neutral", pp: 3 },
      { kind: "civil_war", ideology: "neutral" },
    ],
    ai: AI_RISE,
  },
];

/** The DEU tree. */
export const ROUTES_DEU: FocusDef[] = [
  // ---- communist (rows 13-16) ----
  {
    id: "deu_red_underground",
    tree: "DEU",
    x: 13,
    y: 13,
    days: 35,
    branch: "politics",
    icon: "fist",
    group: "deu_red_route",
    available: NOT_COM,
    effects: [
      { kind: "popularity", ideology: "communist", pp: 4 },
      { kind: "add_spirit", id: "gen_labour_movement" },
    ],
    ai: AI_START_COM,
  },
  {
    id: "deu_factory_cells",
    tree: "DEU",
    x: 13,
    y: 14,
    days: 35,
    branch: "politics",
    icon: "factory",
    group: "deu_red_route",
    prereq: [["deu_red_underground"]],
    effects: [
      { kind: "popularity", ideology: "communist", pp: 4 },
      { kind: "stability", pct: -1 },
    ],
    ai: AI_ON,
  },
  {
    id: "deu_red_front",
    tree: "DEU",
    x: 13,
    y: 15,
    days: 35,
    branch: "politics",
    icon: "sword",
    group: "deu_red_route",
    prereq: [["deu_factory_cells"]],
    effects: [
      { kind: "popularity", ideology: "communist", pp: 3 },
      { kind: "stability", pct: -2 },
    ],
    ai: AI_ON,
  },
  {
    id: "deu_german_october",
    tree: "DEU",
    x: 13,
    y: 16,
    days: 70,
    branch: "politics",
    icon: "star_plain",
    group: "deu_red_route",
    prereq: [["deu_red_front"]],
    available: READY_COM,
    effects: [
      { kind: "popularity", ideology: "communist", pp: 3 },
      { kind: "civil_war", ideology: "communist" },
    ],
    ai: AI_RISE,
  },
];

/** The ITA tree. */
export const ROUTES_ITA: FocusDef[] = [
  // ---- communist (rows 14-17) ----
  {
    id: "ita_clandestine_party",
    tree: "ITA",
    x: 10,
    y: 14,
    days: 35,
    branch: "politics",
    icon: "fist",
    group: "ita_red_route",
    available: NOT_COM,
    effects: [
      { kind: "popularity", ideology: "communist", pp: 4 },
      { kind: "add_spirit", id: "gen_labour_movement" },
    ],
    ai: AI_START_COM,
  },
  {
    id: "ita_factory_councils",
    tree: "ITA",
    x: 10,
    y: 15,
    days: 35,
    branch: "politics",
    icon: "factory",
    group: "ita_red_route",
    prereq: [["ita_clandestine_party"]],
    effects: [
      { kind: "popularity", ideology: "communist", pp: 4 },
      { kind: "stability", pct: -1 },
    ],
    ai: AI_ON,
  },
  {
    id: "ita_garibaldi_brigades",
    tree: "ITA",
    x: 10,
    y: 16,
    days: 35,
    branch: "politics",
    icon: "sword",
    group: "ita_red_route",
    prereq: [["ita_factory_councils"]],
    effects: [
      { kind: "popularity", ideology: "communist", pp: 3 },
      { kind: "stability", pct: -2 },
    ],
    ai: AI_ON,
  },
  {
    id: "ita_red_insurrection",
    tree: "ITA",
    x: 10,
    y: 17,
    days: 70,
    branch: "politics",
    icon: "star_plain",
    group: "ita_red_route",
    prereq: [["ita_garibaldi_brigades"]],
    available: READY_COM,
    effects: [
      { kind: "popularity", ideology: "communist", pp: 3 },
      { kind: "civil_war", ideology: "communist" },
    ],
    ai: AI_RISE,
  },
];

/** The JPN tree. */
export const ROUTES_JPN: FocusDef[] = [
  // ---- communist (rows 10-13) ----
  {
    id: "jpn_communist_underground",
    tree: "JPN",
    x: 12,
    y: 10,
    days: 35,
    branch: "politics",
    icon: "fist",
    group: "jpn_red_route",
    available: NOT_COM,
    effects: [
      { kind: "popularity", ideology: "communist", pp: 4 },
      { kind: "add_spirit", id: "gen_labour_movement" },
    ],
    ai: AI_START_COM,
  },
  {
    id: "jpn_tenant_unions",
    tree: "JPN",
    x: 12,
    y: 11,
    days: 35,
    branch: "politics",
    icon: "factory",
    group: "jpn_red_route",
    prereq: [["jpn_communist_underground"]],
    effects: [
      { kind: "popularity", ideology: "communist", pp: 4 },
      { kind: "stability", pct: -1 },
    ],
    ai: AI_ON,
  },
  {
    id: "jpn_popular_front",
    tree: "JPN",
    x: 12,
    y: 12,
    days: 35,
    branch: "politics",
    icon: "sword",
    group: "jpn_red_route",
    prereq: [["jpn_tenant_unions"]],
    effects: [
      { kind: "popularity", ideology: "communist", pp: 3 },
      { kind: "stability", pct: -2 },
    ],
    ai: AI_ON,
  },
  {
    id: "jpn_red_rising",
    tree: "JPN",
    x: 12,
    y: 13,
    days: 70,
    branch: "politics",
    icon: "star_plain",
    group: "jpn_red_route",
    prereq: [["jpn_popular_front"]],
    available: READY_COM,
    effects: [
      { kind: "popularity", ideology: "communist", pp: 3 },
      { kind: "civil_war", ideology: "communist" },
    ],
    ai: AI_RISE,
  },
];

/** The GBR tree. */
export const ROUTES_GBR: FocusDef[] = [
  // ---- communist (rows 11-14) ----
  {
    id: "gbr_hunger_marches",
    tree: "GBR",
    x: 12,
    y: 11,
    days: 35,
    branch: "politics",
    icon: "fist",
    group: "gbr_red_route",
    available: NOT_COM,
    effects: [
      { kind: "popularity", ideology: "communist", pp: 4 },
      { kind: "add_spirit", id: "gen_labour_movement" },
    ],
    ai: AI_START_COM,
  },
  {
    id: "gbr_red_clydeside",
    tree: "GBR",
    x: 12,
    y: 12,
    days: 35,
    branch: "politics",
    icon: "factory",
    group: "gbr_red_route",
    prereq: [["gbr_hunger_marches"]],
    effects: [
      { kind: "popularity", ideology: "communist", pp: 4 },
      { kind: "stability", pct: -1 },
    ],
    ai: AI_ON,
  },
  {
    id: "gbr_general_strike",
    tree: "GBR",
    x: 12,
    y: 13,
    days: 35,
    branch: "politics",
    icon: "sword",
    group: "gbr_red_route",
    prereq: [["gbr_red_clydeside"]],
    effects: [
      { kind: "popularity", ideology: "communist", pp: 3 },
      { kind: "stability", pct: -2 },
    ],
    ai: AI_ON,
  },
  {
    id: "gbr_british_soviet",
    tree: "GBR",
    x: 12,
    y: 14,
    days: 70,
    branch: "politics",
    icon: "star_plain",
    group: "gbr_red_route",
    prereq: [["gbr_general_strike"]],
    available: READY_COM,
    effects: [
      { kind: "popularity", ideology: "communist", pp: 3 },
      { kind: "civil_war", ideology: "communist" },
    ],
    ai: AI_RISE,
  },
  // ---- neutral (rows 11-14) ----
  {
    id: "gbr_crown_movement",
    tree: "GBR",
    x: 14,
    y: 11,
    days: 35,
    branch: "politics",
    icon: "crown",
    group: "gbr_crown_route",
    available: NOT_NEU,
    effects: [{ kind: "popularity", ideology: "neutral", pp: 4 }],
    ai: AI_START_NEU,
  },
  {
    id: "gbr_crown_loyalists",
    tree: "GBR",
    x: 14,
    y: 12,
    days: 35,
    branch: "politics",
    icon: "compass",
    group: "gbr_crown_route",
    prereq: [["gbr_crown_movement"]],
    effects: [
      { kind: "popularity", ideology: "neutral", pp: 4 },
      { kind: "stability", pct: -1 },
    ],
    ai: AI_ON,
  },
  {
    id: "gbr_guards_regiments",
    tree: "GBR",
    x: 14,
    y: 13,
    days: 35,
    branch: "politics",
    icon: "shield",
    group: "gbr_crown_route",
    prereq: [["gbr_crown_loyalists"]],
    effects: [
      { kind: "popularity", ideology: "neutral", pp: 3 },
      { kind: "stability", pct: -2 },
    ],
    ai: AI_ON,
  },
  {
    id: "gbr_royal_government",
    tree: "GBR",
    x: 14,
    y: 14,
    days: 70,
    branch: "politics",
    icon: "tower",
    group: "gbr_crown_route",
    prereq: [["gbr_guards_regiments"]],
    available: READY_NEU,
    effects: [
      { kind: "popularity", ideology: "neutral", pp: 3 },
      { kind: "civil_war", ideology: "neutral" },
    ],
    ai: AI_RISE,
  },
];

/** The FRA tree. */
export const ROUTES_FRA: FocusDef[] = [
  // ---- communist (rows 13-16) ----
  {
    id: "fra_red_belt",
    tree: "FRA",
    x: 1,
    y: 13,
    days: 35,
    branch: "politics",
    icon: "fist",
    group: "fra_red_route",
    prereq: [["fra_front_commune"]],
    available: NOT_COM,
    effects: [
      { kind: "popularity", ideology: "communist", pp: 4 },
      { kind: "add_spirit", id: "gen_labour_movement" },
    ],
    ai: AI_START_COM,
  },
  {
    id: "fra_factory_occupations",
    tree: "FRA",
    x: 1,
    y: 14,
    days: 35,
    branch: "politics",
    icon: "factory",
    group: "fra_red_route",
    prereq: [["fra_red_belt"]],
    effects: [
      { kind: "popularity", ideology: "communist", pp: 4 },
      { kind: "stability", pct: -1 },
    ],
    ai: AI_ON,
  },
  {
    id: "fra_workers_militia",
    tree: "FRA",
    x: 1,
    y: 15,
    days: 35,
    branch: "politics",
    icon: "sword",
    group: "fra_red_route",
    prereq: [["fra_factory_occupations"]],
    effects: [
      { kind: "popularity", ideology: "communist", pp: 3 },
      { kind: "stability", pct: -2 },
    ],
    ai: AI_ON,
  },
  {
    id: "fra_new_commune",
    tree: "FRA",
    x: 1,
    y: 16,
    days: 70,
    branch: "politics",
    icon: "star_plain",
    group: "fra_red_route",
    prereq: [["fra_workers_militia"]],
    available: READY_COM,
    effects: [
      { kind: "popularity", ideology: "communist", pp: 3 },
      { kind: "civil_war", ideology: "communist" },
    ],
    ai: AI_RISE,
  },
  // ---- fascist (rows 13-16) ----
  {
    id: "fra_leagues_united",
    tree: "FRA",
    x: 6,
    y: 13,
    days: 35,
    branch: "politics",
    icon: "eagle_plain",
    group: "fra_leagues_route",
    prereq: [["fra_leagues_in_government"]],
    available: NOT_FAS,
    effects: [
      { kind: "popularity", ideology: "fascist", pp: 4 },
      { kind: "add_spirit", id: "gen_renewal_movement" },
    ],
    ai: AI_START_FAS,
  },
  {
    id: "fra_cagoule",
    tree: "FRA",
    x: 6,
    y: 14,
    days: 35,
    branch: "politics",
    icon: "megaphone",
    group: "fra_leagues_route",
    prereq: [["fra_leagues_united"]],
    effects: [
      { kind: "popularity", ideology: "fascist", pp: 4 },
      { kind: "stability", pct: -1 },
    ],
    ai: AI_ON,
  },
  {
    id: "fra_veterans_columns",
    tree: "FRA",
    x: 6,
    y: 15,
    days: 35,
    branch: "politics",
    icon: "medal",
    group: "fra_leagues_route",
    prereq: [["fra_cagoule"]],
    effects: [
      { kind: "popularity", ideology: "fascist", pp: 3 },
      { kind: "stability", pct: -2 },
    ],
    ai: AI_ON,
  },
  {
    id: "fra_march_on_paris",
    tree: "FRA",
    x: 6,
    y: 16,
    days: 70,
    branch: "politics",
    icon: "sword",
    group: "fra_leagues_route",
    prereq: [["fra_veterans_columns"]],
    available: READY_FAS,
    effects: [
      { kind: "popularity", ideology: "fascist", pp: 3 },
      { kind: "civil_war", ideology: "fascist" },
    ],
    ai: AI_RISE,
  },
  // ---- monarchist (rows 13-16) ----
  {
    id: "fra_action_francaise",
    tree: "FRA",
    x: 9,
    y: 13,
    days: 35,
    branch: "politics",
    icon: "crown",
    group: "fra_crown_route",
    prereq: [["fra_strong_state_path"]],
    available: NOT_NEU,
    effects: [{ kind: "popularity", ideology: "neutral", pp: 4 }],
    ai: AI_START_NEU,
  },
  {
    id: "fra_count_of_paris",
    tree: "FRA",
    x: 9,
    y: 14,
    days: 35,
    branch: "politics",
    icon: "compass",
    group: "fra_crown_route",
    prereq: [["fra_action_francaise"]],
    effects: [
      { kind: "popularity", ideology: "neutral", pp: 4 },
      { kind: "stability", pct: -1 },
    ],
    ai: AI_ON,
  },
  {
    id: "fra_royalist_officers",
    tree: "FRA",
    x: 9,
    y: 15,
    days: 35,
    branch: "politics",
    icon: "shield",
    group: "fra_crown_route",
    prereq: [["fra_count_of_paris"]],
    effects: [
      { kind: "popularity", ideology: "neutral", pp: 3 },
      { kind: "stability", pct: -2 },
    ],
    ai: AI_ON,
  },
  {
    id: "fra_royal_restoration",
    tree: "FRA",
    x: 9,
    y: 16,
    days: 70,
    branch: "politics",
    icon: "tower",
    group: "fra_crown_route",
    prereq: [["fra_royalist_officers"]],
    available: READY_NEU,
    effects: [
      { kind: "popularity", ideology: "neutral", pp: 3 },
      { kind: "civil_war", ideology: "neutral" },
    ],
    ai: AI_RISE,
  },
];

/** The USA tree. */
export const ROUTES_USA: FocusDef[] = [
  // ---- communist (rows 9-12) ----
  {
    id: "usa_sit_down_strikes",
    tree: "USA",
    x: 14,
    y: 9,
    days: 35,
    branch: "politics",
    icon: "fist",
    group: "usa_red_route",
    available: NOT_COM,
    effects: [
      { kind: "popularity", ideology: "communist", pp: 4 },
      { kind: "add_spirit", id: "gen_labour_movement" },
    ],
    ai: AI_START_COM,
  },
  {
    id: "usa_unemployed_councils",
    tree: "USA",
    x: 14,
    y: 10,
    days: 35,
    branch: "politics",
    icon: "factory",
    group: "usa_red_route",
    prereq: [["usa_sit_down_strikes"]],
    effects: [
      { kind: "popularity", ideology: "communist", pp: 4 },
      { kind: "stability", pct: -1 },
    ],
    ai: AI_ON,
  },
  {
    id: "usa_workers_defence",
    tree: "USA",
    x: 14,
    y: 11,
    days: 35,
    branch: "politics",
    icon: "sword",
    group: "usa_red_route",
    prereq: [["usa_unemployed_councils"]],
    effects: [
      { kind: "popularity", ideology: "communist", pp: 3 },
      { kind: "stability", pct: -2 },
    ],
    ai: AI_ON,
  },
  {
    id: "usa_american_soviet",
    tree: "USA",
    x: 14,
    y: 12,
    days: 70,
    branch: "politics",
    icon: "star_plain",
    group: "usa_red_route",
    prereq: [["usa_workers_defence"]],
    available: READY_COM,
    effects: [
      { kind: "popularity", ideology: "communist", pp: 3 },
      { kind: "civil_war", ideology: "communist" },
    ],
    ai: AI_RISE,
  },
  // ---- neutral (a military government) (rows 9-12) ----
  {
    id: "usa_liberty_league",
    tree: "USA",
    x: 16,
    y: 9,
    days: 35,
    branch: "politics",
    icon: "crown",
    group: "usa_junta_route",
    available: NOT_NEU,
    effects: [{ kind: "popularity", ideology: "neutral", pp: 4 }],
    ai: AI_START_NEU,
  },
  {
    id: "usa_business_plot",
    tree: "USA",
    x: 16,
    y: 10,
    days: 35,
    branch: "politics",
    icon: "compass",
    group: "usa_junta_route",
    prereq: [["usa_liberty_league"]],
    effects: [
      { kind: "popularity", ideology: "neutral", pp: 4 },
      { kind: "stability", pct: -1 },
    ],
    ai: AI_ON,
  },
  {
    id: "usa_general_in_waiting",
    tree: "USA",
    x: 16,
    y: 11,
    days: 35,
    branch: "politics",
    icon: "shield",
    group: "usa_junta_route",
    prereq: [["usa_business_plot"]],
    effects: [
      { kind: "popularity", ideology: "neutral", pp: 3 },
      { kind: "stability", pct: -2 },
    ],
    ai: AI_ON,
  },
  {
    id: "usa_military_government",
    tree: "USA",
    x: 16,
    y: 12,
    days: 70,
    branch: "politics",
    icon: "tower",
    group: "usa_junta_route",
    prereq: [["usa_general_in_waiting"]],
    available: READY_NEU,
    effects: [
      { kind: "popularity", ideology: "neutral", pp: 3 },
      { kind: "civil_war", ideology: "neutral" },
    ],
    ai: AI_RISE,
  },
];

/** The SUN tree. */
export const ROUTES_SUN: FocusDef[] = [
  // ---- democratic (rows 10-13) ----
  {
    id: "sun_ryutin_platform",
    tree: "SUN",
    x: 12,
    y: 10,
    days: 35,
    branch: "politics",
    icon: "ballot",
    group: "sun_dem_route",
    available: NOT_DEM,
    effects: [
      { kind: "popularity", ideology: "democratic", pp: 4 },
      { kind: "add_spirit", id: "gen_democratic_movement" },
    ],
    ai: AI_START_DEM,
  },
  {
    id: "sun_free_soviets",
    tree: "SUN",
    x: 12,
    y: 11,
    days: 35,
    branch: "politics",
    icon: "document",
    group: "sun_dem_route",
    prereq: [["sun_ryutin_platform"]],
    effects: [
      { kind: "popularity", ideology: "democratic", pp: 4 },
      { kind: "stability", pct: -1 },
    ],
    ai: AI_ON,
  },
  {
    id: "sun_constituent_assembly",
    tree: "SUN",
    x: 12,
    y: 12,
    days: 35,
    branch: "politics",
    icon: "shield",
    group: "sun_dem_route",
    prereq: [["sun_free_soviets"]],
    effects: [
      { kind: "popularity", ideology: "democratic", pp: 3 },
      { kind: "stability", pct: -2 },
    ],
    ai: AI_ON,
  },
  {
    id: "sun_second_february",
    tree: "SUN",
    x: 12,
    y: 13,
    days: 70,
    branch: "politics",
    icon: "flag",
    group: "sun_dem_route",
    prereq: [["sun_constituent_assembly"]],
    available: READY_DEM,
    effects: [
      { kind: "popularity", ideology: "democratic", pp: 3 },
      { kind: "civil_war", ideology: "democratic" },
    ],
    ai: AI_RISE,
  },
  // ---- fascist (rows 10-13) ----
  {
    id: "sun_national_bolsheviks",
    tree: "SUN",
    x: 15,
    y: 10,
    days: 35,
    branch: "politics",
    icon: "eagle_plain",
    group: "sun_fas_route",
    available: NOT_FAS,
    effects: [
      { kind: "popularity", ideology: "fascist", pp: 4 },
      { kind: "add_spirit", id: "gen_renewal_movement" },
    ],
    ai: AI_START_FAS,
  },
  {
    id: "sun_harbin_emissaries",
    tree: "SUN",
    x: 15,
    y: 11,
    days: 35,
    branch: "politics",
    icon: "megaphone",
    group: "sun_fas_route",
    prereq: [["sun_national_bolsheviks"]],
    effects: [
      { kind: "popularity", ideology: "fascist", pp: 4 },
      { kind: "stability", pct: -1 },
    ],
    ai: AI_ON,
  },
  {
    id: "sun_russian_legion",
    tree: "SUN",
    x: 15,
    y: 12,
    days: 35,
    branch: "politics",
    icon: "medal",
    group: "sun_fas_route",
    prereq: [["sun_harbin_emissaries"]],
    effects: [
      { kind: "popularity", ideology: "fascist", pp: 3 },
      { kind: "stability", pct: -2 },
    ],
    ai: AI_ON,
  },
  {
    id: "sun_national_revolution",
    tree: "SUN",
    x: 15,
    y: 13,
    days: 70,
    branch: "politics",
    icon: "sword",
    group: "sun_fas_route",
    prereq: [["sun_russian_legion"]],
    available: READY_FAS,
    effects: [
      { kind: "popularity", ideology: "fascist", pp: 3 },
      { kind: "civil_war", ideology: "fascist" },
    ],
    ai: AI_RISE,
  },
];
