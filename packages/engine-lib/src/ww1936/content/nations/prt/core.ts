// ww229 (design ww227 §5-§6): Portugal's generals, own equipment and start
// arms, read before the content. Portugal has no balance of power (not in
// BOP_TAGS); its mechanism (the wolfram trade and the Azores) is spirits,
// decisions and events in its folder.
//
// Equipment: Portugal built little of its own. Its catalogue is what it
// ordered to its own specification or adopted under its own designation:
// the 1930s naval programme (Vouga destroyers, Delfim submarines, the two
// classes of colonial sloops, built by Yarrow, Vickers, Hawthorn Leslie and
// the Lisbon arsenal), the Mauser-Vergueiro and m/937 rifles, the Dreyse
// m/938 machine gun and the field guns. Figures are from memory of the
// en.wikipedia articles named in each `source`, middle values where recalled
// figures differ; nothing here was checked against a printed reference.
// Costs are 1940 US dollars scaled from the comparable item the way the
// majors' catalogues do it. MinorClamp holds every fight number between the
// generic key's and the majors' median. Its aircraft were bought abroad:
// they are start arms below, and the wartime Hurricanes and Spitfires come
// through the Azores events as stock.
import type { NationCore } from "../types";

const SRC_GUN =
  "en.wikipedia gun articles and the Portuguese designations, from memory; cost scaled from US and British guns";

export const CORE_PRT: NationCore = {
  tag: "PRT",
  // Skills [att, def, plan, log] judged from the careers; no `from`: each
  // held a general's rank or a senior command in the years of the game, or
  // could have.
  generals: [
    {
      id: "prt_g_carmona",
      tag: "PRT",
      att: 2,
      def: 3,
      plan: 3,
      log: 3,
      traits: ["organizer"],
      source:
        "en.wikipedia Óscar Carmona: army general, leader of the 1926 military government, President 1926-1951, marshal 1947",
    },
    {
      id: "prt_g_norton_de_matos",
      tag: "PRT",
      att: 2,
      def: 3,
      plan: 4,
      log: 4,
      traits: ["logistics_wizard"],
      source:
        "en.wikipedia José Norton de Matos: general, as Minister of War raised and trained the expeditionary corps sent to France in 1917",
    },
    {
      id: "prt_craveiro_lopes",
      tag: "PRT",
      att: 3,
      def: 2,
      plan: 3,
      log: 2,
      traits: ["organizer"],
      source:
        "en.wikipedia Francisco Craveiro Lopes: army and air officer, general, President of the Republic 1951-1958",
    },
    {
      id: "prt_botelho_moniz",
      tag: "PRT",
      att: 2,
      def: 3,
      plan: 3,
      log: 3,
      traits: ["defensive_doctrine"],
      source:
        "en.wikipedia Júlio Botelho Moniz: army officer, Minister of the Interior 1944-1947, general and Minister of Defence 1958-1961",
    },
    {
      id: "prt_g_delgado",
      tag: "PRT",
      att: 3,
      def: 2,
      plan: 2,
      log: 2,
      traits: ["offensive_doctrine"],
      source:
        "en.wikipedia Humberto Delgado: army and air officer, general from 1953, the opposition's 'fearless general' of 1958",
    },
  ],
  bop: [],
  equipment: [
    // ------------------------------------------------------------ ships
    {
      id: "prt_vouga_class",
      country: "PRT",
      family: "ship",
      cls: "dd",
      techs: [],
      year: 1933,
      // Vouga class destroyers (Vouga, Lima by Yarrow; Dão, Tejo, Douro at
      // the Lisbon arsenal): about 1,230 t standard, 4 x 120 mm, 3 x 40 mm
      // AA, 8 x 533 mm tubes, 36 kn, about 5,400 nm at 15 kn.
      source:
        "en.wikipedia Vouga-class destroyer, from memory; Conway's 1922-46; cost scaled from the Fletcher by displacement",
      spec: {
        dispT: 1230,
        main: { count: 4, mm: 120 },
        beltMm: 0,
        speedKn: 36,
        rangeNm: 5400,
        torpTubes: 8,
        torpWarheadKg: 250,
        asw: 1,
        aaLight: [{ count: 3, mm: 40 }],
        aaHeavy: 0,
        aircraft: 0,
        costM: 3.6,
      },
    },
    {
      id: "prt_goncalo_velho_class",
      country: "PRT",
      family: "ship",
      cls: "dd",
      techs: [],
      year: 1932,
      // Gonçalo Velho class second-class sloops (Gonçalo Velho, Gonçalves
      // Zarco, Hawthorn Leslie): about 950 t, 3 x 120 mm, 2 x 40 mm AA,
      // depth charges, 16.5 kn, long-legged for the colonies. Escorts, slow
      // for a destroyer's slot.
      source:
        "en.wikipedia Portuguese Navy sloops of the 1930s (Gonçalo Velho class), from memory; cost scaled from US escorts",
      spec: {
        dispT: 950,
        main: { count: 3, mm: 120 },
        beltMm: 0,
        speedKn: 16.5,
        rangeNm: 6000,
        torpTubes: 0,
        torpWarheadKg: 0,
        asw: 1,
        aaLight: [{ count: 2, mm: 40 }],
        aaHeavy: 0,
        aircraft: 0,
        costM: 2,
      },
    },
    {
      id: "prt_afonso_de_albuquerque_class",
      country: "PRT",
      family: "ship",
      cls: "cl",
      techs: [],
      year: 1934,
      // Afonso de Albuquerque class first-class sloops (Afonso de
      // Albuquerque, Bartolomeu Dias, Hawthorn Leslie): about 1,780 t,
      // 4 x 120 mm, 2 x 76 mm AA, 4 x 40 mm, 21 kn, about 8,000 nm; a
      // seaplane carried for scouting (aircraft 0). Counted as light
      // cruisers, the role they filled in the colonies.
      source:
        "en.wikipedia NRP Afonso de Albuquerque (1934), from memory; Conway's 1922-46; cost scaled from US cruisers by displacement",
      spec: {
        dispT: 1780,
        main: { count: 4, mm: 120 },
        beltMm: 0,
        speedKn: 21,
        rangeNm: 8000,
        torpTubes: 0,
        torpWarheadKg: 0,
        asw: 1,
        aaLight: [{ count: 4, mm: 40 }],
        aaHeavy: 2,
        aircraft: 0,
        costM: 3.5,
      },
    },
    {
      id: "prt_delfim_class",
      country: "PRT",
      family: "ship",
      cls: "ss",
      techs: [],
      year: 1934,
      // Delfim class submarines (Delfim, Espadarte, Golfinho, Vickers-
      // Armstrongs): about 800 t surfaced, 6 x 533 mm tubes, one 102 mm gun,
      // 16.5 kn surfaced, about 5,000 nm.
      source:
        "en.wikipedia Delfim-class submarine (1934), from memory; cost scaled from the Gato by displacement",
      spec: {
        dispT: 800,
        main: { count: 1, mm: 102 },
        beltMm: 0,
        speedKn: 16.5,
        rangeNm: 5000,
        torpTubes: 6,
        torpWarheadKg: 250,
        asw: 0,
        aaLight: [],
        aaHeavy: 0,
        aircraft: 0,
        costM: 2.6,
      },
    },
    // ------------------------------------------------------------ infantry
    {
      id: "prt_m904_vergueiro",
      country: "PRT",
      family: "infantry",
      techs: [],
      year: 1904,
      // Espingarda 6.5 mm m/904, the Mauser-Vergueiro: a Mauser action with
      // José Vergueiro's bolt, built by DWM; 6.5 x 58 mm, about 12 aimed
      // rounds a minute.
      source:
        "en.wikipedia Mauser-Vergueiro, from memory; cost a guess near the US 1903 rifle",
      spec: { mm: 6.5, aimedRpm: 12, rangeM: 550, autoPct: 0, costUsd: 25 },
    },
    {
      id: "prt_m937_mauser",
      country: "PRT",
      family: "infantry",
      techs: ["inf_eq_1"],
      year: 1937,
      staticFor: "infantry_equipment:1",
      // Espingarda 7.92 mm m/937: the Mauser Kar 98k ordered from Germany for
      // the 1937 rearmament; about 15 aimed rounds a minute.
      source:
        "en.wikipedia Karabiner 98k (Portuguese m/937 contract), from memory; cost scaled from the Kar 98k",
      spec: { mm: 7.92, aimedRpm: 15, rangeM: 500, autoPct: 0, costUsd: 28 },
    },
    {
      id: "prt_m938_dreyse",
      country: "PRT",
      family: "infantry",
      techs: ["inf_eq_2"],
      year: 1938,
      staticFor: "infantry_equipment:2",
      // Metralhadora 7.92 mm m/938: the Dreyse MG 13 bought from Germany
      // when the Wehrmacht dropped it, one to a section beside the m/937
      // rifles.
      source:
        "en.wikipedia MG 13 (users: Portugal, m/938), from memory; cost scaled from the BAR",
      spec: { mm: 7.92, aimedRpm: 20, rangeM: 550, autoPct: 8, costUsd: 45 },
    },
    // ------------------------------------------------------------ guns
    {
      id: "prt_m917_schneider",
      country: "PRT",
      family: "gun",
      role: "artillery",
      techs: ["artillery_1"],
      year: 1917,
      staticFor: "artillery:1",
      // Peça 7.5 cm m/917: the Schneider 75 mm of 1914 taken into service
      // with the corps sent to France; about 10 rounds a minute, 11,000 m,
      // 6.5 kg shell, about 1,150 kg.
      source: SRC_GUN,
      spec: {
        mm: 75,
        rpm: 10,
        rangeM: 11000,
        shellKg: 6.5,
        penMm500: 0,
        massKg: 1150,
        barrels: 1,
        costK: 5,
      },
    },
    {
      id: "prt_m943_obus",
      country: "PRT",
      family: "gun",
      role: "artillery",
      techs: ["artillery_2"],
      year: 1943,
      staticFor: "artillery:2",
      // Obus 8.8 cm m/943: the British 25-pounder delivered with the Azores
      // agreement; 5 rounds a minute, 12,250 m, 11.3 kg shell, 1,800 kg.
      source: SRC_GUN,
      spec: {
        mm: 87.6,
        rpm: 5,
        rangeM: 12250,
        shellKg: 11.3,
        penMm500: 0,
        massKg: 1800,
        barrels: 1,
        costK: 7,
      },
    },
  ],
  // Bought abroad (owner D4: start purchases already paid). Received only:
  // Portugal held no aircraft or tank licence at the start.
  startArms: [
    {
      // Fifteen Gladiators bought from Britain in 1938 for the fighter
      // squadron at Ota (the Mk II; the closest entry is the Mk I).
      entry: "gbr_gladiator_i",
      origin: "received",
      count: 15,
      source:
        "en.wikipedia Gloster Gladiator, operators: Portuguese Army Aviation, 15 bought in 1938",
    },
    {
      // Junkers Ju 52/3m bought in 1937 and flown as bombers and transports.
      entry: "deu_ju52",
      origin: "received",
      count: 10,
      source:
        "en.wikipedia Junkers Ju 52, operators: Portuguese Army Aviation, about ten from 1937",
    },
    {
      // Breda Ba.65 attack aircraft bought from Italy in 1938.
      entry: "ita_ba65",
      origin: "received",
      count: 10,
      source:
        "en.wikipedia Breda Ba.65, operators: Portugal, about ten delivered in 1938",
    },
  ],
};
