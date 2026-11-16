// ww229 (design ww227 §5-§6): Greece's generals, the Metaxas-Venizelist
// balance of power, its own equipment catalogue and the arms it holds at the
// start. Figures are real specifications from the cited references (from
// memory where the source says so); hist/MinorClamp.ts holds the fight
// numbers between the generic key and the majors' median.
import type { NationCore } from "../types";

const SRC_SHIP =
  "en.wikipedia ship and class articles (Conway's All the World's Fighting Ships 1906-1921 and 1922-1946), from memory; cost scaled from Italian and British ships by displacement";

export const CORE_GRC: NationCore = {
  tag: "GRC",
  // Generals: the field commands of 1940-1941 and the resistance. No exact
  // day is kept (none is gated).
  generals: [
    {
      id: "grc_katsimitros",
      tag: "GRC",
      att: 2,
      def: 4,
      plan: 3,
      log: 2,
      traits: ["defensive_doctrine"],
      source:
        "en.wikipedia Charalambos Katsimitros: commanded the 8th Infantry Division, which held the Italian offensive at Elaia-Kalamas in 1940",
    },
    {
      id: "grc_tsolakoglou",
      tag: "GRC",
      att: 3,
      def: 3,
      plan: 2,
      log: 2,
      traits: ["infantry_officer"],
      source:
        "en.wikipedia Georgios Tsolakoglou: commanded the III Army Corps in the Albanian counter-offensive 1940-1941, signed the surrender of the Epirus army in 1941",
    },
    {
      id: "grc_drakos",
      tag: "GRC",
      att: 2,
      def: 3,
      plan: 3,
      log: 2,
      traits: ["infantry_officer"],
      source:
        "en.wikipedia Markos Drakos: commanded the Epirus Army Section in the Greco-Italian War 1940-1941",
    },
    {
      id: "grc_bakopoulos",
      tag: "GRC",
      att: 2,
      def: 4,
      plan: 2,
      log: 2,
      traits: ["defensive_doctrine"],
      source:
        "en.wikipedia Konstantinos Bakopoulos: commanded the Eastern Macedonia Army Section on the Metaxas Line in 1941",
    },
    {
      id: "grc_napoleon_zervas",
      tag: "GRC",
      att: 3,
      def: 2,
      plan: 2,
      log: 1,
      traits: ["guerrilla_fighter"],
      source:
        "en.wikipedia Napoleon Zervas: Venizelist officer, founder and commander of EDES and its guerrilla army in Epirus 1941-1944",
    },
  ],
  // Negative: the Fourth of August regime (Metaxas, the court, the security
  // police); positive: the Venizelists (the Liberal Party, the purged
  // officers, Crete). The Venizelists gain by themselves (+1 ‰ a day) unless
  // the regime acts; the balance ends with the government that started it.
  bop: [
    {
      tag: "GRC",
      startPm: 100,
      spirits: [
        "grc_bop_new_state",
        "grc_bop_regime_holds",
        "grc_bop_uneasy_truce",
        "grc_bop_venizelist_officers",
        "grc_bop_schism_reopens",
      ],
      driftPm: 1,
      endsOnRulingChange: true,
    },
  ],
  equipment: [
    // ------------------------------------------------------------ planes
    {
      id: "grc_pzl_p24f",
      country: "GRC",
      family: "plane",
      type: "fighter",
      techs: ["fighter_1"],
      staticFor: "fighter:1",
      year: 1937,
      // The cannon-armed export P.24 built by PZL for the Greek order.
      source:
        "en.wikipedia PZL P.24 (Greece bought P.24F and P.24G: Gnome-Rhône 14N, about 430 km/h; P.24F two 20 mm Oerlikon and two 7.92 mm MGs); other figures from memory",
      spec: {
        maxKmh: 430,
        rangeKm: 700,
        emptyKg: 1330,
        wingLoad: 107,
        guns: [
          { mm: 20, count: 2, rpm: 450 },
          { mm: 7.92, count: 2, rpm: 750 },
        ],
        defGuns: 0,
        bombKg: 40,
        torpedoKg: 0,
        reliability: 3,
        costK: 22,
      },
    },
    {
      id: "grc_pzl_p24g",
      country: "GRC",
      family: "plane",
      type: "fighter",
      techs: ["fighter_1"],
      year: 1938,
      source:
        "en.wikipedia PZL P.24 (P.24G for Greece: four 7.92 mm MGs, the same airframe as the P.24F); other figures from memory",
      spec: {
        maxKmh: 430,
        rangeKm: 700,
        emptyKg: 1330,
        wingLoad: 106,
        guns: [{ mm: 7.92, count: 4, rpm: 750 }],
        defGuns: 0,
        bombKg: 40,
        torpedoKg: 0,
        reliability: 3,
        costK: 20,
      },
    },
    {
      id: "grc_bloch_mb151",
      country: "GRC",
      family: "plane",
      type: "fighter",
      techs: ["fighter_2"],
      year: 1940,
      // Nine delivered from France before its fall.
      source:
        "en.wikipedia Bloch MB.150 (MB.151: nine delivered to Greece in 1940; Gnome-Rhône 14N, about 470 km/h, four 7.5 mm MAC 1934 MGs); other figures from memory",
      spec: {
        maxKmh: 470,
        rangeKm: 600,
        emptyKg: 2050,
        wingLoad: 155,
        guns: [{ mm: 7.5, count: 4, rpm: 1200 }],
        defGuns: 0,
        bombKg: 0,
        torpedoKg: 0,
        reliability: 2,
        costK: 40,
      },
    },
    {
      id: "grc_potez_633",
      country: "GRC",
      family: "plane",
      type: "bomber",
      techs: ["bomber_1"],
      year: 1939,
      source:
        "en.wikipedia Potez 630 (Potez 633 B2 light bomber, a Greek order partly delivered 1939-1940: about 440 km/h, 400 kg of bombs); other figures from memory",
      spec: {
        maxKmh: 440,
        rangeKm: 1300,
        emptyKg: 2450,
        wingLoad: 130,
        guns: [{ mm: 7.5, count: 1, rpm: 1200 }],
        defGuns: 1,
        bombKg: 400,
        torpedoKg: 0,
        reliability: 3,
        costK: 45,
      },
    },
    {
      id: "grc_hs126",
      country: "GRC",
      family: "plane",
      type: "cas",
      techs: ["cas_1"],
      year: 1939,
      // Army cooperation and reconnaissance over the Albanian front.
      source:
        "en.wikipedia Henschel Hs 126 (Hs 126K-6 sold to Greece in 1939: about 355 km/h, one fixed and one flexible 7.92 mm MG, 150 kg of bombs); other figures from memory",
      spec: {
        maxKmh: 355,
        rangeKm: 720,
        emptyKg: 2030,
        wingLoad: 100,
        guns: [{ mm: 7.92, count: 1, rpm: 1100 }],
        defGuns: 1,
        bombKg: 150,
        torpedoKg: 0,
        reliability: 4,
        costK: 30,
      },
    },
    {
      id: "grc_do22",
      country: "GRC",
      family: "plane",
      type: "naval_bomber",
      techs: ["naval_bomber_1"],
      year: 1938,
      // Float-plane Do 22K of the naval cooperation squadrons.
      source:
        "en.wikipedia Dornier Do 22 (Greece the first customer, twelve Do 22K delivered 1938: about 350 km/h, one torpedo of about 800 kg, three MGs); other figures from memory",
      spec: {
        maxKmh: 350,
        rangeKm: 2300,
        emptyKg: 2600,
        wingLoad: 90,
        guns: [{ mm: 7.92, count: 1, rpm: 1100 }],
        defGuns: 2,
        bombKg: 400,
        torpedoKg: 800,
        reliability: 3,
        costK: 50,
      },
    },
    // ------------------------------------------------------------ gear
    {
      id: "grc_mannlicher_schonauer",
      country: "GRC",
      family: "infantry",
      techs: ["inf_eq_1"],
      staticFor: "infantry_equipment:1",
      year: 1903,
      // The Greek service rifle, made by Steyr to a Greek order; Hotchkiss
      // and Chauchat light machine guns were few.
      source:
        "en.wikipedia Mannlicher-Schönauer (M1903 and M1903/14, the Greek Army's 6.5 mm rifle with a rotary magazine); figures from memory; cost near the Italian Carcano",
      spec: { mm: 6.5, aimedRpm: 14, rangeM: 500, autoPct: 2, costUsd: 25 },
    },
    {
      id: "grc_schneider_danglis",
      country: "GRC",
      family: "gun",
      role: "artillery",
      techs: ["artillery_1"],
      year: 1909,
      // The mountain gun Colonel Danglis designed with Schneider.
      source:
        "en.wikipedia Schneider-Danglis 06/09 (75 mm mountain gun designed by Panagiotis Danglis with Schneider, carried by mules in loads); figures from memory; cost an estimate",
      spec: {
        mm: 75,
        rpm: 8,
        rangeM: 6500,
        shellKg: 6.5,
        penMm500: 0,
        massKg: 550,
        barrels: 1,
        costK: 5,
      },
    },
    {
      id: "grc_schneider_85",
      country: "GRC",
      family: "gun",
      role: "artillery",
      techs: ["artillery_1"],
      year: 1927,
      source:
        "en.wikipedia Canon de 85 modèle 1927 Schneider (85 mm field gun built for Greece); figures from memory (range and weights differ between sources, a mid value); cost an estimate",
      spec: {
        mm: 85,
        rpm: 6,
        rangeM: 15000,
        shellKg: 9.5,
        penMm500: 0,
        massKg: 2000,
        barrels: 1,
        costK: 8,
      },
    },
    {
      id: "grc_schneider_105",
      country: "GRC",
      family: "gun",
      role: "artillery",
      techs: ["artillery_2"],
      year: 1927,
      source:
        "en.wikipedia Canon de 105 modèle 1925/27 Schneider (105 mm field gun of the Greek medium battalions); figures from memory; cost an estimate",
      spec: {
        mm: 105,
        rpm: 5,
        rangeM: 15500,
        shellKg: 16,
        penMm500: 0,
        massKg: 3000,
        barrels: 1,
        costK: 12,
      },
    },
    {
      id: "grc_pak36",
      country: "GRC",
      family: "gun",
      role: "anti_tank",
      techs: ["anti_tank_1"],
      year: 1937,
      // A few batteries of the German 37 mm gun, about one per corps.
      source:
        "en.wikipedia 3.7 cm PaK 36 (exported to Greece among others: 37 mm, 432 kg, about 29 mm at 500 m); Greek corps anti-tank batteries in the 1940-1941 orders of battle",
      spec: {
        mm: 37,
        rpm: 13,
        rangeM: 5500,
        shellKg: 0.68,
        penMm500: 29,
        massKg: 432,
        barrels: 1,
        costK: 3.5,
      },
    },
    // ------------------------------------------------------------ ships
    {
      id: "grc_averof",
      country: "GRC",
      family: "ship",
      cls: "ca",
      techs: [],
      year: 1911,
      // Pisa-class armoured cruiser, the fleet's flagship; its three 450 mm
      // tubes are below the catalogue's torpedo class and are left out.
      source:
        "en.wikipedia Greek cruiser Georgios Averof (9,450 t, four 234 mm and eight 190 mm guns, 200 mm belt, about 22.5 knots); Conway's 1906-1921, from memory",
      spec: {
        dispT: 9450,
        main: { count: 4, mm: 234 },
        secondary: { count: 8, mm: 190 },
        beltMm: 200,
        speedKn: 22,
        rangeNm: 2800,
        torpTubes: 0,
        torpWarheadKg: 0,
        asw: 0,
        aaLight: [{ count: 4, mm: 40 }],
        aaHeavy: 0,
        aircraft: 0,
        costM: 9,
      },
    },
    {
      id: "grc_elli",
      country: "GRC",
      family: "ship",
      cls: "cl",
      techs: [],
      year: 1914,
      // Built in the United States for China, bought by Greece in 1914.
      source:
        "en.wikipedia Greek cruiser Elli (1912) (ex-Fei Hung: about 2,100 t, two 152 mm and four 102 mm guns, about 20 knots; torpedoed off Tinos in 1940)",
      spec: {
        dispT: 2100,
        main: { count: 2, mm: 152 },
        secondary: { count: 4, mm: 102 },
        beltMm: 50,
        speedKn: 20,
        rangeNm: 3000,
        torpTubes: 0,
        torpWarheadKg: 0,
        asw: 0,
        aaLight: [{ count: 2, mm: 40 }],
        aaHeavy: 0,
        aircraft: 0,
        costM: 3,
      },
    },
    {
      id: "grc_hydra",
      country: "GRC",
      family: "ship",
      cls: "dd",
      techs: [],
      year: 1933,
      // Hydra, Spetsai, Psara and Kountouriotis, built in Italy.
      source: SRC_SHIP,
      spec: {
        dispT: 1350,
        main: { count: 4, mm: 120 },
        beltMm: 0,
        speedKn: 38,
        rangeNm: 3000,
        torpTubes: 6,
        torpWarheadKg: 250,
        asw: 1,
        aaLight: [{ count: 2, mm: 40 }],
        aaHeavy: 0,
        aircraft: 0,
        costM: 3.6,
      },
    },
    {
      id: "grc_vasilefs_georgios",
      country: "GRC",
      family: "ship",
      cls: "dd",
      techs: ["dd_2"],
      year: 1939,
      // Vasilefs Georgios and Vasilissa Olga, built by Yarrow to a British
      // G-class pattern with German 127 mm guns.
      source: SRC_SHIP,
      spec: {
        dispT: 1350,
        main: { count: 4, mm: 127 },
        beltMm: 0,
        speedKn: 35,
        rangeNm: 4800,
        torpTubes: 8,
        torpWarheadKg: 300,
        asw: 2,
        aaLight: [{ count: 4, mm: 40 }],
        aaHeavy: 0,
        aircraft: 0,
        costM: 4.2,
      },
    },
    {
      id: "grc_aetos",
      country: "GRC",
      family: "ship",
      cls: "dd",
      techs: [],
      year: 1912,
      // Aetos, Ierax, Panthir and Leon, ordered in Britain for Argentina.
      source: SRC_SHIP,
      spec: {
        dispT: 980,
        main: { count: 4, mm: 102 },
        beltMm: 0,
        speedKn: 32,
        rangeNm: 1700,
        torpTubes: 4,
        torpWarheadKg: 100,
        asw: 1,
        aaLight: [],
        aaHeavy: 0,
        aircraft: 0,
        costM: 1.8,
      },
    },
    {
      id: "grc_katsonis",
      country: "GRC",
      family: "ship",
      cls: "ss",
      techs: [],
      year: 1927,
      // Katsonis and Papanikolis, built in France.
      source: SRC_SHIP,
      spec: {
        dispT: 576,
        main: { count: 1, mm: 100 },
        beltMm: 0,
        speedKn: 14,
        rangeNm: 3500,
        torpTubes: 6,
        torpWarheadKg: 200,
        asw: 0,
        aaLight: [],
        aaHeavy: 0,
        aircraft: 0,
        costM: 1.9,
      },
    },
    {
      id: "grc_proteus",
      country: "GRC",
      family: "ship",
      cls: "ss",
      techs: [],
      year: 1929,
      // Proteus, Nereus, Triton and Glafkos, built in France.
      source: SRC_SHIP,
      spec: {
        dispT: 730,
        main: { count: 1, mm: 100 },
        beltMm: 0,
        speedKn: 14,
        rangeNm: 4000,
        torpTubes: 8,
        torpWarheadKg: 200,
        asw: 0,
        aaLight: [],
        aaHeavy: 0,
        aircraft: 0,
        costM: 2.3,
      },
    },
  ],
  startArms: [
    {
      entry: "gbr_battle",
      origin: "received",
      count: 12,
      source:
        "en.wikipedia Fairey Battle (operators: Greece, twelve delivered 1939-1940 and flown against Italy)",
    },
    {
      entry: "gbr_blenheim_iv",
      origin: "received",
      count: 12,
      source:
        "en.wikipedia Bristol Blenheim (operators: Greece, a dozen Blenheim IV bought 1939-1940)",
    },
  ],
};
