// ww229 (design ww227 §5-§6): Argentina's generals, the Concordancia-officers
// balance of power, its own equipment catalogue and the arms it holds at the
// start. Figures are real specifications from the cited references (from
// memory where the source says so); hist/MinorClamp.ts holds the fight
// numbers between the generic key and the majors' median.
import type { NationCore } from "../types";

const SRC_SHIP =
  "en.wikipedia ship class articles (Conway's All the World's Fighting Ships 1922-1946), from memory; cost scaled from British and Italian ships by displacement";

export const CORE_ARG: NationCore = {
  tag: "ARG",
  // Generals: the officers of the 1943 revolution and the arsenal builder.
  // No exact day is kept (none is gated).
  generals: [
    {
      id: "arg_rawson",
      tag: "ARG",
      att: 3,
      def: 2,
      plan: 2,
      log: 2,
      traits: ["cavalry_officer"],
      source:
        "en.wikipedia Arturo Rawson: cavalry general, led the Campo de Mayo columns into Buenos Aires in the 1943 revolution",
    },
    {
      id: "arg_ramirez",
      tag: "ARG",
      att: 2,
      def: 3,
      plan: 2,
      log: 2,
      traits: ["infantry_officer"],
      source:
        "en.wikipedia Pedro Pablo Ramírez: general, Minister of War 1942-1943, head of the military government 1943-1944",
    },
    {
      id: "arg_farrell",
      tag: "ARG",
      att: 2,
      def: 3,
      plan: 3,
      log: 2,
      traits: ["organizer"],
      source:
        "en.wikipedia Edelmiro Julián Farrell: general, commanded the mountain troops, Minister of War 1943, President 1944-1946",
    },
    {
      id: "arg_savio",
      tag: "ARG",
      att: 1,
      def: 2,
      plan: 3,
      log: 3,
      traits: ["engineer_officer"],
      source:
        "en.wikipedia Manuel Savio: general of engineers, founded Fabricaciones Militares in 1941 and planned the national steel industry",
    },
    {
      id: "arg_peron",
      tag: "ARG",
      att: 2,
      def: 2,
      plan: 3,
      log: 3,
      traits: ["organizer"],
      source:
        "en.wikipedia Juan Perón: staff officer and teacher of military history, mountain-troop instructor, a leader of the GOU lodge",
    },
  ],
  // Negative: the Concordancia (conservative landowners, managed elections);
  // positive: the officers' lodges (the GOU and the nationalist colonels).
  // The lodges grow by themselves (+1 ‰ a day) unless the government acts;
  // the balance ends with the government that started it.
  bop: [
    {
      tag: "ARG",
      startPm: -300,
      spirits: [
        "arg_bop_concordancia_rules",
        "arg_bop_conservatives_hold",
        "arg_bop_uneasy_barracks",
        "arg_bop_lodge_stirs",
        "arg_bop_officers_rule",
      ],
      driftPm: 1,
      endsOnRulingChange: true,
    },
  ],
  equipment: [
    // ------------------------------------------------------------ tanks
    {
      id: "arg_nahuel_dl43",
      country: "ARG",
      family: "tank",
      role: "medium",
      techs: ["medium_tank_1"],
      year: 1943,
      // Sixteen built at the Arsenal Esteban de Luca when no one would sell tanks.
      source:
        "en.wikipedia Nahuel DL 43: 35 t, 80 mm front, 75 mm Krupp M1909 gun, three 7.65 mm MGs, 500 hp Lorraine-Dietrich, 16 built; penetration, cross-country speed and cost estimates",
      spec: {
        massT: 35,
        hullFrontMm: 80,
        hullSlopeDeg: 20,
        turretFrontMm: 60,
        gunMm: 75,
        penMm500: 45,
        heFillerG: 500,
        mgs: 3,
        offroadKmh: 22,
        roadKmh: 45,
        reliability: 2,
        costK: 60,
      },
    },
    // ------------------------------------------------------------ planes
    {
      id: "arg_dewoitine_d21",
      country: "ARG",
      family: "plane",
      type: "fighter",
      techs: ["fighter_1"],
      year: 1930,
      // Parasol fighter built under licence at the Córdoba aircraft factory.
      source:
        "en.wikipedia Dewoitine D.21 (Argentina: licence-built at the Fábrica Militar de Aviones, Hispano-Suiza 12Gb, about 260 km/h, two MGs); other figures from memory",
      spec: {
        maxKmh: 260,
        rangeKm: 450,
        emptyKg: 1050,
        wingLoad: 70,
        guns: [{ mm: 7.65, count: 2, rpm: 750 }],
        defGuns: 0,
        bombKg: 0,
        torpedoKg: 0,
        reliability: 3,
        costK: 10,
      },
    },
    {
      id: "arg_hawk_75o",
      country: "ARG",
      family: "plane",
      type: "fighter",
      techs: ["fighter_1"],
      staticFor: "fighter:1",
      year: 1940,
      // The fixed-gear export Hawk 75: 30 from Curtiss, 20 built at Córdoba.
      source:
        "en.wikipedia Curtiss P-36 Hawk (Hawk 75O: fixed undercarriage, Wright R-1820-G5, 30 delivered and 20 licence-built by FMA); speed, range and armament from memory",
      spec: {
        maxKmh: 450,
        rangeKm: 880,
        emptyKg: 1810,
        wingLoad: 123,
        guns: [{ mm: 7.65, count: 4, rpm: 800 }],
        defGuns: 0,
        bombKg: 100,
        torpedoKg: 0,
        reliability: 4,
        costK: 30,
      },
    },
    {
      id: "arg_ae_mb2",
      country: "ARG",
      family: "plane",
      type: "bomber",
      techs: ["bomber_1"],
      year: 1936,
      // The "Bombi", a single-engine light bomber designed and built at Córdoba.
      source:
        "en.wikipedia FMA AeMB.2 Bombi: 14 built at Córdoba from 1936, Wright Cyclone, one fixed and two flexible MGs, 400 kg bombs; speed and range from memory",
      spec: {
        maxKmh: 315,
        rangeKm: 1000,
        emptyKg: 2350,
        wingLoad: 130,
        guns: [{ mm: 7.65, count: 1, rpm: 750 }],
        defGuns: 2,
        bombKg: 400,
        torpedoKg: 0,
        reliability: 3,
        costK: 25,
      },
    },
    {
      id: "arg_iae22",
      country: "ARG",
      family: "plane",
      type: "cas",
      techs: ["cas_1"],
      year: 1944,
      // Advanced trainer and light attack plane of wood, built in the war's shortages.
      source:
        "en.wikipedia I.Ae. 22 DL: about 200 built at Córdoba from 1944, I.Ae. 16 El Gaucho radial engine, about 290 km/h, one MG and light bombs; other figures from memory",
      spec: {
        maxKmh: 290,
        rangeKm: 1000,
        emptyKg: 1500,
        wingLoad: 100,
        guns: [{ mm: 7.65, count: 1, rpm: 750 }],
        defGuns: 1,
        bombKg: 100,
        torpedoKg: 0,
        reliability: 3,
        costK: 12,
      },
    },
    // ------------------------------------------------------------ gear
    {
      id: "arg_mauser_1909",
      country: "ARG",
      family: "infantry",
      techs: ["inf_eq_1"],
      staticFor: "infantry_equipment:1",
      year: 1909,
      source:
        "en.wikipedia Mauser Model 1909 (Argentine 7.65x53 mm rifle, made by DWM and later at the Rosario arms factory); figures from memory; cost near the German Kar98k",
      spec: { mm: 7.65, aimedRpm: 12, rangeM: 550, autoPct: 0, costUsd: 25 },
    },
    {
      id: "arg_halcon_m1943",
      country: "ARG",
      family: "infantry",
      techs: ["inf_eq_2"],
      year: 1943,
      source:
        "en.wikipedia Halcón M-1943: .45 ACP submachine gun made by Metalúrgica Centro in Buenos Aires; figures from memory; cost scaled from the Thompson",
      spec: { mm: 11.43, aimedRpm: 25, rangeM: 150, autoPct: 10, costUsd: 45 },
    },
    // ------------------------------------------------------------ ships
    {
      id: "arg_rivadavia",
      country: "ARG",
      family: "ship",
      cls: "bb",
      techs: [],
      year: 1914,
      // Rivadavia and Moreno, built in the United States, refitted 1924-1926.
      source: SRC_SHIP,
      spec: {
        dispT: 27940,
        main: { count: 12, mm: 305 },
        secondary: { count: 12, mm: 152 },
        beltMm: 279,
        speedKn: 22,
        rangeNm: 11000,
        torpTubes: 2,
        torpWarheadKg: 150,
        asw: 0,
        aaLight: [{ count: 4, mm: 40 }],
        aaHeavy: 4,
        aircraft: 0,
        costM: 25,
      },
    },
    {
      id: "arg_veinticinco_de_mayo",
      country: "ARG",
      family: "ship",
      cls: "ca",
      techs: [],
      year: 1931,
      // Two built at Livorno, a smaller Trento with 190 mm guns.
      source: SRC_SHIP,
      spec: {
        dispT: 6800,
        main: { count: 6, mm: 190 },
        secondary: { count: 12, mm: 102 },
        beltMm: 70,
        speedKn: 32,
        rangeNm: 8000,
        torpTubes: 6,
        torpWarheadKg: 250,
        asw: 0,
        aaLight: [{ count: 6, mm: 40 }],
        aaHeavy: 12,
        aircraft: 2,
        costM: 14,
      },
    },
    {
      id: "arg_la_argentina",
      country: "ARG",
      family: "ship",
      cls: "cl",
      techs: ["cl_2"],
      year: 1939,
      // A training cruiser from Vickers-Armstrongs, Barrow.
      source: SRC_SHIP,
      spec: {
        dispT: 6500,
        main: { count: 9, mm: 152 },
        secondary: { count: 4, mm: 102 },
        beltMm: 76,
        speedKn: 30,
        rangeNm: 10000,
        torpTubes: 6,
        torpWarheadKg: 250,
        asw: 1,
        aaLight: [{ count: 8, mm: 40 }],
        aaHeavy: 4,
        aircraft: 1,
        costM: 12,
      },
    },
    {
      id: "arg_mendoza",
      country: "ARG",
      family: "ship",
      cls: "dd",
      techs: [],
      year: 1929,
      // Three built by Thornycroft, enlarged British flotilla leaders.
      source: SRC_SHIP,
      spec: {
        dispT: 1570,
        main: { count: 5, mm: 120 },
        beltMm: 0,
        speedKn: 36,
        rangeNm: 4500,
        torpTubes: 6,
        torpWarheadKg: 250,
        asw: 1,
        aaLight: [{ count: 2, mm: 40 }],
        aaHeavy: 1,
        aircraft: 0,
        costM: 3.2,
      },
    },
    {
      id: "arg_buenos_aires",
      country: "ARG",
      family: "ship",
      cls: "dd",
      techs: ["dd_2"],
      year: 1938,
      // Seven British-built destroyers on the lines of the G class.
      source: SRC_SHIP,
      spec: {
        dispT: 1375,
        main: { count: 4, mm: 120 },
        beltMm: 0,
        speedKn: 35.5,
        rangeNm: 5000,
        torpTubes: 8,
        torpWarheadKg: 320,
        asw: 2,
        aaLight: [],
        aaHeavy: 0,
        aircraft: 0,
        costM: 3,
      },
    },
    {
      id: "arg_santa_fe",
      country: "ARG",
      family: "ship",
      cls: "ss",
      techs: [],
      year: 1933,
      // Santa Fe, Santiago del Estero and Salta, built at Taranto.
      source: SRC_SHIP,
      spec: {
        dispT: 775,
        main: { count: 1, mm: 102 },
        beltMm: 0,
        speedKn: 17,
        rangeNm: 7000,
        torpTubes: 8,
        torpWarheadKg: 270,
        asw: 0,
        aaLight: [],
        aaHeavy: 0,
        aircraft: 0,
        costM: 2.6,
      },
    },
  ],
  // Bought abroad in the late 1930s: received (used, not produced).
  startArms: [
    {
      entry: "usa_a17",
      origin: "received",
      count: 30,
      source:
        "en.wikipedia Northrop A-17 (Northrop 8A-2: 30 delivered to Argentina 1937-1938)",
    },
  ],
};
