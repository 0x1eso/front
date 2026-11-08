import { flag, not } from "@openfront/engine-api/ww1914/SceneDsl";
import type { GwHouseRow } from "../../HouseRows";
import { either, office, person } from "../laws/kit";

// The four houses as the constitutions made them (ww158 design §3). A house
// comes into play only once its country's file has factions (GW_HOUSES in
// scenes/house.ts). The faction ids named here are the format's canonical ids.

export const DEU_HOUSE: GwHouseRow = {
  tag: "DEU",
  chambers: [
    { id: "reichstag", inst: "reichstag", kind: "vote", starts: true },
    // The states' door: only bills that name it (Reich food, the states' rights).
    { id: "bundesrat", kind: "vote", optional: true },
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
};

export const GBR_HOUSE: GwHouseRow = {
  tag: "GBR",
  chambers: [
    { id: "commons", inst: "commons", kind: "vote", starts: true },
    { id: "lords", kind: "lords" },
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
  },
  police: either(person("gbr_hall"), office("interior"), office("chancellor")),
};

export const AUH_HOUSE: GwHouseRow = {
  tag: "AUH",
  chambers: [
    {
      id: "reichsrat",
      inst: "nations",
      kind: "vote",
      sits: flag("f_auh_reichsrat_open"),
    },
    {
      id: "budapest",
      inst: "hungary",
      kind: "consent",
      consent: "auh_work",
      starts: true,
    },
  ],
  // Tisza counts for himself, and says so.
  whip: either(person("auh_tisza"), office("hun_pm")),
  // Paragraph 14: Vienna's half only, while the Reichsrat is closed. There is
  // no way round Budapest.
  around: {
    id: "par14",
    when: not(flag("f_auh_reichsrat_open")),
    price: 15,
    inst: "nations",
    delta: -1,
    skips: ["reichsrat"],
    heats: [
      { faction: "auh_czech", by: 1 },
      { faction: "auh_slavs", by: 1 },
      { faction: "auh_sd", by: 1 },
    ],
  },
  police: either(office("interior"), office("chancellor")),
  // What the Reichsrat or the Diet passes goes to the Emperor-King to sign.
  signs: true,
};

export const RUS_HOUSE: GwHouseRow = {
  tag: "RUS",
  chambers: [
    { id: "duma", inst: "duma", kind: "vote", starts: true },
    { id: "council", inst: "ministers", kind: "vote" },
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
    heats: [
      { faction: "rus_nobles", by: 1 },
      { faction: "rus_kadets", by: 1 },
    ],
  },
  police: either(office("interior"), office("chancellor")),
  // What the Duma and the State Council pass goes to the Tsar to sign.
  signs: true,
};

export const GW_HOUSE_ROWS: readonly GwHouseRow[] = [
  DEU_HOUSE,
  GBR_HOUSE,
  AUH_HOUSE,
  RUS_HOUSE,
];
