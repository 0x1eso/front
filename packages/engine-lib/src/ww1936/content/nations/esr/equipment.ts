// ww229 (design ww227 §6): Republican Spain's own catalogue and start arms.
//
// What the Republic made or built under licence, real specifications from
// memory of the en/es.wikipedia articles (no printed reference checked);
// where recalled figures differ a middle value is used and noted. Costs are
// 1940 US dollars of effort, scaled from the majors' comparable items as in
// hist/ita.ts. The numbers are clamped between the generic key and the
// majors' median (hist/MinorClamp.ts).
//
// No own armour on purpose: the Republic's own armoured cars (Bilbao,
// UNL-35) and the Trubia-Naval would stand in for its light_tank:1 key,
// and the Soviet tanks the aid events deliver as that key would carry
// their names. Its tanks are the received Soviet designs. Data only.
import type { HistEntry } from "../../../hist/Types";
import type { StartArmsRow } from "../types";
import { ESR_PLANES } from "./planes";
import { ESR_SHIPS } from "./ships";

export const ESR_EQUIPMENT: readonly HistEntry[] = [
  // ------------------------------------------------------------ infantry
  {
    id: "esr_mauser_1893",
    country: "ESR",
    family: "infantry",
    techs: ["inf_eq_1"],
    year: 1893,
    staticFor: "infantry_equipment:1",
    // Spanish Mauser M1893 and its short rifle, 7x57 mm, the army's rifle
    // in both zones; no automatic share.
    source:
      "en.wikipedia Mauser Model 1893 (Spanish Mauser), from memory; cost a guess near the Italian Carcano",
    spec: { mm: 7, aimedRpm: 12, rangeM: 500, autoPct: 0, costUsd: 20 },
  },
  {
    id: "esr_naranjero",
    country: "ESR",
    family: "infantry",
    techs: ["inf_eq_2"],
    year: 1938,
    staticFor: "infantry_equipment:2",
    // The Mauser with the Naranjero, the Republic's copy of the MP 28/II in
    // 9 mm Largo, made in Levante workshops from 1937 (a few thousand): a
    // small automatic share.
    source:
      "es.wikipedia Subfusil Naranjero (MP 28/II copy in 9 mm Largo, Levante workshops 1937-39), from memory; rifle figures as the Spanish Mauser, cost plus the submachine guns",
    spec: { mm: 7, aimedRpm: 12, rangeM: 500, autoPct: 8, costUsd: 24 },
  },
  // ------------------------------------------------------------ guns
  {
    id: "esr_vickers_105_11",
    country: "ESR",
    family: "gun",
    role: "artillery",
    techs: ["artillery_1"],
    year: 1922,
    staticFor: "artillery:1",
    // Obús Vickers de 105/11 modelo 1919/1922, built under licence by the
    // Sociedad Española de Construcción Naval at Placencia de las Armas
    // (Republican Guipúzcoa until 1937); range given between 10 and 11 km,
    // a middle value used.
    source:
      "es.wikipedia Obús Vickers de 105/11 mm, from memory; range figures differ, middle value; cost scaled from the US 105 mm howitzer",
    spec: {
      mm: 105,
      rpm: 4,
      rangeM: 10500,
      shellKg: 15,
      penMm500: 0,
      massKg: 1850,
      barrels: 1,
      costK: 9,
    },
  },
  {
    id: "esr_schneider_155_13",
    country: "ESR",
    family: "gun",
    role: "artillery",
    techs: ["artillery_1", "art_imp_1"],
    year: 1917,
    // Schneider 155 mm howitzer modèle 1917, made in Spain at the Trubia
    // works (Republican Asturias until 1937) as the 155/13: about 11 km,
    // 43 kg shell, 3.3 t in action.
    source:
      "en.wikipedia Canon de 155 C modèle 1917 Schneider (Spanish production at Trubia), from memory; cost scaled from the US 155 mm howitzer",
    spec: {
      mm: 155,
      rpm: 2,
      rangeM: 11300,
      shellKg: 43,
      penMm500: 0,
      massKg: 3300,
      barrels: 1,
      costK: 16,
    },
  },
  ...ESR_PLANES,
  ...ESR_SHIPS,
];

// Owner D4: the designs the Republic received. The army's few Renault FTs
// were there at the start; the Soviet deliveries came from the autumn of
// 1936 on, paid with the gold, so they have no stock at the start: the
// events (esr_komsomol_arrives, esr_soviet_planes, esr_soviet_shipments,
// esr_bt_regiment) bring them as the light tank, fighter and bomber keys.
export const ESR_START_ARMS: readonly StartArmsRow[] = [
  {
    entry: "fra_ft17",
    origin: "received",
    count: 5,
    source:
      "en.wikipedia Renault FT: Spain had about ten in service in 1936, the Madrid regiment's with the Republic",
  },
  {
    entry: "sun_t26_33",
    origin: "received",
    count: 0,
    source:
      "en.wikipedia T-26 (Spanish Civil War): about 280 sent to the Republic from October 1936 to 1938, the first by the Komsomol to Cartagena",
  },
  {
    entry: "sun_bt5",
    origin: "received",
    count: 0,
    source:
      "en.wikipedia BT-5: 50 sent to the Republic in 1937, the International Tank Regiment (first used at Fuentes de Ebro)",
  },
  {
    entry: "sun_i16",
    origin: "received",
    count: 0,
    source:
      "en.wikipedia Polikarpov I-16 (Spain): about 275 Moscas sent from November 1936 to 1938",
  },
  {
    entry: "sun_sb2",
    origin: "received",
    count: 0,
    source:
      "en.wikipedia Tupolev SB (Spain): about 90 Katiuskas sent from October 1936",
  },
];
