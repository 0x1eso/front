import { any, flag, not } from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";
import type { GwHouseRow } from "../../HouseRows";
import { either, office, person } from "../laws/kit";

// The four houses as the constitutions made them (ww158 design §3). A house
// comes into play only once its country's file has factions (GW_HOUSES in
// scenes/house.ts). The faction ids named here are the format's canonical ids.

/**
 * ww187: the house was dissolved and its election hasn't come (about two
 * months, engine/ww1914/Assumes GW_ELECTION_DAYS): the elected chamber is shut.
 */
export const DISSOLVED = world({ is: "dissolved" });

export const DEU_HOUSE: GwHouseRow = {
  tag: "DEU",
  chambers: [
    {
      id: "reichstag",
      inst: "reichstag",
      kind: "vote",
      starts: true,
      sits: not(DISSOLVED),
      // ww203: 397 seats (the 1912 election).
      size: 397,
    },
    // The states' door: only bills that name it (Reich food, the states' rights).
    // ww203: 61 votes; Prussia's 17 and the small states' vote as the
    // chancellor tells them (`rest`); 14 against stop a constitutional change.
    {
      id: "bundesrat",
      kind: "vote",
      optional: true,
      size: 61,
      need: { block: 14 },
      rest: "for",
    },
  ],
  whip: either(
    person("deu_helfferich"),
    office("finance"),
    office("interior"),
    office("chancellor"),
  ),
  // The powers the Reichstag gave the Bundesrat on 4 August 1914: bread, food,
  // prices only (bills marked `around`). The majority can take them back.
  around: {
    id: "bundesrat",
    // The majority's bill takes the powers back (`deu_take_back`).
    when: not(flag("f_powers_back")),
    price: 20,
    inst: "reichstag",
    delta: -1,
    skips: ["reichstag"],
    heats: [
      { faction: "deu_centre", by: 1 },
      { faction: "deu_progress", by: 1 },
      { faction: "deu_spd", by: 1 },
    ],
  },
  police: either(office("interior"), office("chancellor")),
  // ww203: Helfferich's Treasury counts the Reichstag, else the Interior.
  counter: ["finance", "interior"],
};

/** Parliament prorogued past the motion (gbr_pw_prorogue): neither House sits. */
export const GBR_PROROGUED = flag("f_gbr_prorogued");

export const GBR_HOUSE: GwHouseRow = {
  tag: "GBR",
  chambers: [
    {
      id: "commons",
      inst: "commons",
      kind: "vote",
      starts: true,
      sits: not(any(GBR_PROROGUED, DISSOLVED)),
      // ww203: 670 seats (December 1910).
      size: 670,
    },
    // ww203: the Lords' size is W-GBR's to check; absent, its factions' seats.
    { id: "lords", kind: "lords", sits: not(GBR_PROROGUED) },
  ],
  // Gulland, the chief whip: pack-only, `GBR.house.json` people.
  whip: { past: "gbr_i_gulland" },
  // A regulation under the Defence of the Realm Act: drink, munitions works,
  // the press, rents (bills marked `around`).
  around: {
    id: "dora",
    price: 15,
    inst: "commons",
    delta: -1,
    skips: ["commons", "lords"],
    heats: [{ faction: "gbr_rebels", by: 2 }],
    // Prorogued, the country is governed by Orders in Council alone.
    all: GBR_PROROGUED,
  },
  police: either(person("gbr_hall"), office("interior"), office("chancellor")),
  // ww203: a government bill lost wide shakes the cabinet (ww169 2B: behind
  // its warnings). The chief whip sits at the Treasury.
  fall: "gbr_table",
  counter: ["finance", "interior"],
};

/**
 * Vienna's Reichsrat sits once it has been called back: by the realm's paper
 * (f_auh_reichsrat_open), by Karl's opening (f_auh_house_open), or by the
 * `auh_reichsrat` bill in force.
 */
export const REICHSRAT_OPEN = any(
  flag("f_auh_reichsrat_open"),
  flag("f_auh_house_open"),
  world({ is: "law", id: "auh_reichsrat", of: ["force"] }),
);

export const AUH_HOUSE: GwHouseRow = {
  tag: "AUH",
  chambers: [
    {
      id: "reichsrat",
      inst: "nations",
      kind: "vote",
      sits: REICHSRAT_OPEN,
      // ww203: 516 seats (1911).
      size: 516,
    },
    {
      id: "budapest",
      inst: "hungary",
      kind: "consent",
      consent: "auh_work",
      starts: true,
      // ww203: 413 seats (1910).
      size: 413,
    },
  ],
  // Tisza counts for himself, and says so.
  whip: either(person("auh_tisza"), office("hun_pm")),
  // Paragraph 14: Vienna's half only, while the Reichsrat is closed. There is
  // no way round Budapest.
  around: {
    id: "par14",
    when: not(REICHSRAT_OPEN),
    price: 15,
    inst: "nations",
    delta: -1,
    skips: ["reichsrat"],
    // ww203: the decree faces the house when it sits again.
    faces: true,
    heats: [
      { faction: "auh_czech", by: 1 },
      { faction: "auh_slavs", by: 1 },
      { faction: "auh_sd", by: 1 },
    ],
  },
  police: either(office("interior"), office("chancellor")),
  // What the Reichsrat or the Diet passes goes to the Emperor-King to sign.
  signs: true,
  // ww203: Tisza counts for himself.
  counter: ["hun_pm", "chancellor"],
};

/**
 * The Duma abolished (rus_pw_abolish_duma): autocracy as before 1906. Neither
 * the Duma nor the State Council votes a law; the Tsar's decree is the law.
 */
export const RUS_DUMA_GONE = flag("f_rus_duma_abolished");

export const RUS_HOUSE: GwHouseRow = {
  tag: "RUS",
  chambers: [
    {
      id: "duma",
      inst: "duma",
      kind: "vote",
      starts: true,
      sits: not(RUS_DUMA_GONE),
      // ww203: 442 seats (the Fourth Duma).
      size: 442,
    },
    {
      id: "council",
      inst: "ministers",
      kind: "vote",
      sits: not(RUS_DUMA_GONE),
    },
  ],
  whip: either(person("rus_rodzianko"), office("interior")),
  // Article 87, only while the Duma is not sitting: cheap in authority, dear
  // in the nobles and the liberals.
  around: {
    id: "art87",
    when: not(flag("f_gov_rus_session")),
    price: 8,
    inst: "duma",
    delta: -1,
    skips: ["duma", "council"],
    // ww203: the decree faces the house when it sits again.
    faces: true,
    heats: [
      { faction: "rus_nobles", by: 1 },
      { faction: "rus_kadets", by: 1 },
    ],
    all: RUS_DUMA_GONE,
  },
  police: either(office("interior"), office("chancellor")),
  // What the Duma and the State Council pass goes to the Tsar to sign.
  signs: true,
  counter: ["interior", "chancellor"],
};

/**
 * France (ww166): the Chamber, then the Senate with an equal vote (not the
 * Lords' delay). The way round is a decree under the state of siege, declared
 * on 2 August 1914: the left resents it. Canonical factions (plan §2 House):
 * fra_radicals fra_caillaux fra_repsoc fra_sfio fra_minority fra_left_rep
 * fra_fed_rep fra_catholics fra_af fra_tiger fra_gqg.
 */
export const FRA_HOUSE: GwHouseRow = {
  tag: "FRA",
  chambers: [
    {
      id: "chambre",
      inst: "chamber",
      kind: "vote",
      starts: true,
      sits: not(DISSOLVED),
      // ww203: 592 elected in 1914 (W-FRA checks the groups).
      size: 592,
    },
    // ww203: 300 seats; its groups are W-FRA's to check.
    { id: "senat", inst: "senate", kind: "vote", size: 300 },
  ],
  // The Interior counts the majority for the premier.
  whip: either(office("interior"), office("chancellor")),
  around: {
    id: "siege",
    when: world({ is: "war" }),
    price: 15,
    inst: "chamber",
    delta: -1,
    skips: ["chambre", "senat"],
    heats: [
      { faction: "fra_radicals", by: 1 },
      { faction: "fra_sfio", by: 1 },
    ],
  },
  police: either(office("interior"), office("chancellor")),
  // ww203: a government bill lost wide brings the cabinet down the
  // consultations' way; the Interior counts the majority.
  fall: "fra_chamber",
  counter: ["interior", "chancellor"],
};

export const GW_HOUSE_ROWS: readonly GwHouseRow[] = [
  DEU_HOUSE,
  GBR_HOUSE,
  AUH_HOUSE,
  RUS_HOUSE,
  FRA_HOUSE,
];
