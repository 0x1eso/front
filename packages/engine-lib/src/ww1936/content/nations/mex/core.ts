// ww229 (design ww227 §5-§6): Mexico's generals, its own equipment and the
// arms it holds at the start. Mexico has no balance of power (its
// mechanism, the oil, is in decisions.ts and spirits.ts). Figures are real
// specifications from the cited references (from memory where the source
// says so); hist/MinorClamp.ts holds the fight numbers between the generic
// key and the majors' median.
import type { NationCore } from "../types";

const SRC_INF =
  "en.wikipedia and es.wikipedia articles on the Fábrica Nacional de Armas' small arms (7x57 mm Mauser cartridge), from memory; cost near the Spanish Mauser";
const SRC_SHIP =
  "en.wikipedia and es.wikipedia (Armada de México ship lists; Conway's All the World's Fighting Ships 1922-1946), from memory; cost scaled from Spanish-built sloops by displacement";

export const CORE_MEX: NationCore = {
  tag: "MEX",
  // Generals of the Revolution who held the military zones of the 1930s and
  // 1940s. No exact day is kept (none is gated).
  generals: [
    {
      id: "mex_almazan",
      tag: "MEX",
      att: 3,
      def: 3,
      plan: 3,
      log: 2,
      traits: ["organizer"],
      source:
        "en.wikipedia Juan Andreu Almazán: divisional general, commanded the military zone at Monterrey through the 1930s, opposition candidate 1940",
    },
    {
      id: "mex_cedillo",
      tag: "MEX",
      att: 2,
      def: 3,
      plan: 2,
      log: 1,
      traits: ["guerrilla_fighter"],
      source:
        "en.wikipedia Saturnino Cedillo: agrarian caudillo of San Luis Potosí, Secretary of Agriculture 1935-1937, rose in revolt 1938 and was killed 1939",
    },
    {
      id: "mex_henriquez_guzman",
      tag: "MEX",
      att: 3,
      def: 2,
      plan: 3,
      log: 2,
      traits: ["cavalry_officer"],
      source:
        "en.wikipedia Miguel Henríquez Guzmán: divisional general, led the field operations against Cedillo 1938, held several military zones",
    },
    {
      id: "mex_macias_valenzuela",
      tag: "MEX",
      att: 2,
      def: 3,
      plan: 3,
      log: 3,
      traits: ["defensive_doctrine"],
      source:
        "en.wikipedia Pablo Macías Valenzuela: Secretary of National Defence 1940-1942, then commander of the Pacific Military Region",
    },
    {
      id: "mex_amaro",
      tag: "MEX",
      att: 2,
      def: 3,
      plan: 3,
      log: 3,
      traits: ["infantry_officer"],
      source:
        "en.wikipedia Joaquín Amaro Domínguez: Secretary of War 1925-1931, reformer of the federal army and director of the Colegio Militar",
    },
  ],
  bop: [],
  equipment: [
    // ------------------------------------------------------------ gear
    {
      id: "mex_mauser_m1910",
      country: "MEX",
      family: "infantry",
      techs: ["inf_eq_1"],
      staticFor: "infantry_equipment:1",
      year: 1910,
      // Mauser Modelo 1910: the army's rifle, made at the national arms
      // factory in Mexico City, 7x57 mm.
      source: SRC_INF,
      spec: { mm: 7, aimedRpm: 14, rangeM: 500, autoPct: 0, costUsd: 25 },
    },
    {
      id: "mex_mendoza_c1934",
      country: "MEX",
      family: "infantry",
      techs: ["inf_eq_1"],
      year: 1934,
      // Rafael Mendoza's C-1934: a light 7 mm squad machine gun, about 8 kg,
      // 20-round box, roughly 450 rounds a minute cyclic.
      source:
        "en.wikipedia Mendoza C-1934 (Rafael Mendoza, 7x57 mm, made at the national arms factory), from memory; squad cost an estimate",
      spec: { mm: 7, aimedRpm: 30, rangeM: 600, autoPct: 10, costUsd: 75 },
    },
    {
      id: "mex_mauser_m1936",
      country: "MEX",
      family: "infantry",
      techs: ["inf_eq_2"],
      staticFor: "infantry_equipment:2",
      year: 1936,
      // Mosquetón Modelo 1936: the national factory's short Mauser, issued
      // with the Mendoza in every squad.
      source: SRC_INF,
      spec: { mm: 7, aimedRpm: 15, rangeM: 550, autoPct: 7, costUsd: 27 },
    },
    // ------------------------------------------------------------ planes
    {
      id: "mex_corsario",
      country: "MEX",
      family: "plane",
      type: "cas",
      techs: ["cas_1"],
      year: 1937,
      // The Vought Corsair two-seat scout biplane built under licence at
      // the national aircraft works (TNCA) as the Corsario Azcárate.
      source:
        "en.wikipedia Vought O2U Corsair and TNCA (Mexican licence-built Corsairs, Pratt & Whitney Hornet), from memory; cost an estimate",
      spec: {
        maxKmh: 270,
        rangeKm: 1000,
        emptyKg: 1250,
        wingLoad: 63,
        guns: [{ mm: 7.62, count: 1, rpm: 600 }],
        defGuns: 2,
        bombKg: 230,
        torpedoKg: 0,
        reliability: 3,
        costK: 30,
      },
    },
    // ------------------------------------------------------------ ships
    {
      id: "mex_guanajuato",
      country: "MEX",
      family: "ship",
      cls: "dd",
      techs: [],
      year: 1936,
      // Guanajuato, Querétaro and Potosí: transport gunboats built in Spain,
      // the navy's largest ships of the period.
      source: SRC_SHIP,
      spec: {
        dispT: 1300,
        main: { count: 3, mm: 102 },
        beltMm: 0,
        speedKn: 20,
        rangeNm: 3500,
        torpTubes: 0,
        torpWarheadKg: 0,
        asw: 1,
        aaLight: [{ count: 4, mm: 20 }],
        aaHeavy: 0,
        aircraft: 0,
        costM: 2.2,
      },
    },
    {
      id: "mex_durango",
      country: "MEX",
      family: "ship",
      cls: "dd",
      techs: [],
      year: 1936,
      // Durango: an armed transport built in Spain beside the Guanajuato
      // class, able to carry a battalion along the coast.
      source: SRC_SHIP,
      spec: {
        dispT: 1600,
        main: { count: 2, mm: 102 },
        beltMm: 0,
        speedKn: 20,
        rangeNm: 3000,
        torpTubes: 0,
        torpWarheadKg: 0,
        asw: 0,
        aaLight: [{ count: 2, mm: 20 }],
        aaHeavy: 0,
        aircraft: 0,
        costM: 2.4,
      },
    },
  ],
  // Mexico's foreign aircraft of 1936 (Vought and Douglas biplanes bought
  // in the United States) have no catalogue entry; the lend-lease gear of
  // the war years comes by focus.
  startArms: [],
};
