// ww229 (design ww227 §5-§6): Norway's generals, own equipment and start
// arms, read before the content. Norway has no balance of power (not in
// BOP_TAGS); its mechanism (the merchant fleet and heavy water) is spirits
// and decisions in index.ts.
//
// Equipment: real specifications, from memory of the en.wikipedia articles
// named in each `source`; nothing here was checked against a printed
// reference, and a middle value is used where recalled figures differ.
// Costs are scaled from the comparable American item the way the majors'
// catalogues do it. MinorClamp holds every fight number between the generic
// key's and the majors' median.
import type { NationCore } from "../types";

export const CORE_NOR: NationCore = {
  tag: "NOR",
  // Skills [att, def, plan, log] judged from the careers; no `from`: every
  // one held a general's rank or a division in the years of the game.
  generals: [
    {
      id: "nor_ruge",
      tag: "NOR",
      att: 2,
      def: 4,
      plan: 3,
      log: 3,
      traits: ["defensive_doctrine"],
      source:
        "en.wikipedia Otto Ruge: Commander-in-Chief of the Norwegian Army in the 1940 campaign",
    },
    {
      id: "nor_fleischer",
      tag: "NOR",
      att: 3,
      def: 3,
      plan: 2,
      log: 2,
      traits: ["winter_specialist"],
      source:
        "en.wikipedia Carl Gustav Fleischer: commander of the 6th Division in the Narvik campaign 1940",
    },
    {
      id: "nor_laake",
      tag: "NOR",
      att: 1,
      def: 2,
      plan: 2,
      log: 3,
      traits: ["organizer"],
      source:
        "en.wikipedia Kristian Laake: Commanding General of the Norwegian Army 1931-1940",
    },
    {
      id: "nor_hvinden_haug",
      tag: "NOR",
      att: 2,
      def: 3,
      plan: 2,
      log: 2,
      traits: ["mountaineer"],
      source:
        "en.wikipedia Jacob Hvinden Haug: commander of the 2nd Division in the valleys of eastern Norway 1940",
    },
    {
      id: "nor_hansteen",
      tag: "NOR",
      att: 2,
      def: 3,
      plan: 3,
      log: 3,
      traits: ["logistics_wizard"],
      source:
        "en.wikipedia Wilhelm von Tangen Hansteen: Commander-in-Chief of the Norwegian forces in exile from 1942",
    },
  ],
  bop: [],
  equipment: [
    // ------------------------------------------------------------ infantry
    {
      id: "nor_krag_m1894",
      country: "NOR",
      family: "infantry",
      techs: ["inf_eq_1"],
      year: 1894,
      staticFor: "infantry_equipment:1",
      // Krag-Jørgensen M/1894: 6.5 x 55 mm, side-loaded five-round magazine,
      // a little slower to fire than a Mauser; made at Kongsberg.
      source:
        "en.wikipedia Krag-Jørgensen (Norwegian M/1894), from memory; cost a guess near the US 1903 rifle",
      spec: { mm: 6.5, aimedRpm: 10, rangeM: 600, autoPct: 0, costUsd: 25 },
    },
    {
      id: "nor_madsen_lmg",
      country: "NOR",
      family: "infantry",
      techs: ["inf_eq_2"],
      year: 1922,
      staticFor: "infantry_equipment:2",
      // The Madsen light machine gun in 6.5 x 55 mm, one to a squad beside
      // the Krag rifles.
      source:
        "en.wikipedia Madsen machine gun, Norwegian service in 6.5 mm, from memory; cost scaled from the BAR",
      spec: { mm: 6.5, aimedRpm: 22, rangeM: 600, autoPct: 10, costUsd: 45 },
    },
    // ------------------------------------------------------------ guns
    {
      id: "nor_ehrhardt_m01",
      country: "NOR",
      family: "gun",
      role: "artillery",
      techs: ["artillery_1"],
      year: 1901,
      staticFor: "artillery:1",
      // 7.5 cm feltkanon M/01, the Ehrhardt quick-firing field gun: about
      // 8 rounds a minute, 6.5 kg shell, about 6,500 m, about 1,000 kg.
      source:
        "en.wikipedia Ehrhardt 7.5 cm Model 1901 (Norwegian feltkanon M/01), from memory; cost scaled from US guns",
      spec: {
        mm: 75,
        rpm: 8,
        rangeM: 6500,
        shellKg: 6.5,
        penMm500: 0,
        massKg: 1000,
        barrels: 1,
        costK: 5,
      },
    },
    // ------------------------------------------------------------ planes
    {
      id: "nor_fokker_cv_d",
      country: "NOR",
      family: "plane",
      type: "cas",
      techs: [],
      year: 1933,
      staticFor: "cas:1",
      // Fokker C.V-D built at Kjeller under licence: two-seat biplane for
      // scouting and light bombing, about 250 km/h, range about 770 km,
      // about 1,250 kg empty, 28.8 m2; one fixed and one rear gun, 200 kg.
      source:
        "en.wikipedia Fokker C.V (Norwegian Kjeller-built C.V-D), from memory; cost scaled from US single-engine biplanes",
      spec: {
        maxKmh: 250,
        rangeKm: 770,
        emptyKg: 1250,
        wingLoad: 66,
        guns: [{ mm: 7.9, count: 1, rpm: 1100 }],
        defGuns: 1,
        bombKg: 200,
        torpedoKg: 0,
        reliability: 3,
        costK: 25,
      },
    },
    {
      id: "nor_mf11",
      country: "NOR",
      family: "plane",
      type: "naval_bomber",
      techs: [],
      year: 1932,
      staticFor: "naval_bomber:1",
      // Marinens Flyvebaatfabrikk M.F.11 from Horten: three-seat biplane
      // floatplane, about 235 km/h, range about 1,000 km, about 1,700 kg
      // empty, about 46 m2; one fixed and two flexible guns, light bombs.
      source:
        "en.wikipedia Marinens Flyvebaatfabrikk M.F.11, from memory; cost scaled from US floatplanes",
      spec: {
        maxKmh: 235,
        rangeKm: 1000,
        emptyKg: 1700,
        wingLoad: 55,
        guns: [{ mm: 7.9, count: 1, rpm: 1100 }],
        defGuns: 2,
        bombKg: 150,
        torpedoKg: 0,
        reliability: 3,
        costK: 30,
      },
    },
    {
      id: "nor_n3pb",
      country: "NOR",
      family: "plane",
      type: "naval_bomber",
      techs: ["naval_bomber_1"],
      year: 1941,
      // Northrop N-3PB, built in California for the Norwegian naval air
      // service: 414 km/h, range about 1,600 km, about 2,800 kg empty,
      // 34.75 m2 at about 4,800 kg; four 12.7 mm guns forward, two
      // flexible 7.62 mm, about 900 kg of bombs or depth charges.
      source:
        "en.wikipedia Northrop N-3PB, from memory; cost scaled from US single-engine bombers",
      spec: {
        maxKmh: 414,
        rangeKm: 1600,
        emptyKg: 2800,
        wingLoad: 138,
        guns: [{ mm: 12.7, count: 4, rpm: 750 }],
        defGuns: 2,
        bombKg: 900,
        torpedoKg: 0,
        reliability: 3,
        costK: 65,
      },
    },
    // ------------------------------------------------------------ ships
    {
      id: "nor_norge_class",
      country: "NOR",
      family: "ship",
      cls: "ca",
      techs: [],
      year: 1900,
      // Norge class coastal defence ships (Norge, Eidsvold), Armstrong-built:
      // about 4,200 t, 2 x 210 mm, 6 x 150 mm, 152 mm belt, 17 kn. Counted
      // as heavy cruisers, like StartNavy.
      source:
        "en.wikipedia Norge-class coastal defence ship, from memory; Conway's; cost scaled from US ships by displacement",
      spec: {
        dispT: 4200,
        main: { count: 2, mm: 210 },
        secondary: { count: 6, mm: 150 },
        beltMm: 152,
        speedKn: 17,
        rangeNm: 2000,
        torpTubes: 2,
        torpWarheadKg: 100,
        asw: 0,
        aaLight: [],
        aaHeavy: 0,
        aircraft: 0,
        costM: 6,
      },
    },
    {
      id: "nor_tordenskjold_class",
      country: "NOR",
      family: "ship",
      cls: "ca",
      techs: [],
      year: 1897,
      // Tordenskjold class coastal defence ships (Tordenskjold, Harald
      // Haarfagre): about 3,900 t, 2 x 210 mm, 6 x 120 mm, 178 mm belt,
      // 17 kn.
      source:
        "en.wikipedia Tordenskjold-class coastal defence ship, from memory; Conway's; cost scaled from US ships by displacement",
      spec: {
        dispT: 3900,
        main: { count: 2, mm: 210 },
        secondary: { count: 6, mm: 120 },
        beltMm: 178,
        speedKn: 17,
        rangeNm: 1800,
        torpTubes: 2,
        torpWarheadKg: 100,
        asw: 0,
        aaLight: [],
        aaHeavy: 0,
        aircraft: 0,
        costM: 5.5,
      },
    },
    {
      id: "nor_olav_tryggvason",
      country: "NOR",
      family: "ship",
      cls: "cl",
      techs: [],
      year: 1934,
      // HNoMS Olav Tryggvason, minelayer built at Horten: about 1,600 t,
      // 4 x 120 mm, one 76 mm AA gun, about 20 kn, room for some 280 mines.
      source:
        "en.wikipedia HNoMS Olav Tryggvason, from memory; cost scaled from US ships by displacement",
      spec: {
        dispT: 1600,
        main: { count: 4, mm: 120 },
        beltMm: 0,
        speedKn: 20,
        rangeNm: 3000,
        torpTubes: 0,
        torpWarheadKg: 0,
        asw: 1,
        aaLight: [],
        aaHeavy: 1,
        aircraft: 0,
        costM: 3,
      },
    },
    {
      id: "nor_sleipner_class",
      country: "NOR",
      family: "ship",
      cls: "dd",
      techs: [],
      year: 1936,
      // Sleipner class destroyers, built at Horten: about 600 t, 3 x 100 mm,
      // one 40 mm Bofors, 2 x 533 mm tubes, 30 kn; small and short-legged.
      source:
        "en.wikipedia Sleipner-class destroyer, from memory; cost scaled from the Fletcher by displacement",
      spec: {
        dispT: 600,
        main: { count: 3, mm: 100 },
        beltMm: 0,
        speedKn: 30,
        rangeNm: 1500,
        torpTubes: 2,
        torpWarheadKg: 250,
        asw: 1,
        aaLight: [{ count: 1, mm: 40 }],
        aaHeavy: 0,
        aircraft: 0,
        costM: 2,
      },
    },
    {
      id: "nor_draug_class",
      country: "NOR",
      family: "ship",
      cls: "dd",
      techs: [],
      year: 1908,
      // Draug class destroyers: about 540 t, 6 x 76 mm, 3 x 457 mm tubes,
      // 27 kn; old by 1936 but still in service.
      source:
        "en.wikipedia Draug-class destroyer, from memory; cost scaled from the Fletcher by displacement",
      spec: {
        dispT: 540,
        main: { count: 6, mm: 76 },
        beltMm: 0,
        speedKn: 27,
        rangeNm: 1000,
        torpTubes: 3,
        torpWarheadKg: 100,
        asw: 0,
        aaLight: [],
        aaHeavy: 0,
        aircraft: 0,
        costM: 1.5,
      },
    },
    {
      id: "nor_b_class",
      country: "NOR",
      family: "ship",
      cls: "ss",
      techs: [],
      year: 1923,
      // B class submarines (B-1 to B-6), Holland type built at Horten:
      // about 420 t surfaced, 4 x 457 mm tubes, one 76 mm gun, about 14 kn.
      source:
        "en.wikipedia B-class submarine (Norway), from memory; cost scaled from the Gato by displacement",
      spec: {
        dispT: 420,
        main: { count: 1, mm: 76 },
        beltMm: 0,
        speedKn: 14,
        rangeNm: 2500,
        torpTubes: 4,
        torpWarheadKg: 100,
        asw: 0,
        aaLight: [],
        aaHeavy: 0,
        aircraft: 0,
        costM: 1.2,
      },
    },
  ],
  // Bought abroad (owner D4: start licences already paid).
  startArms: [
    {
      // The army's fighter flight at Fornebu: twelve Gloster Gladiators
      // bought from Britain in 1938-39.
      entry: "gbr_gladiator_i",
      origin: "received",
      count: 12,
      source:
        "en.wikipedia Gloster Gladiator, Norwegian service: 12 bought for the Army Air Service",
    },
    {
      // Six He 115 floatplanes bought for the naval air service in 1939.
      entry: "deu_he115_b",
      origin: "received",
      count: 6,
      source:
        "en.wikipedia Heinkel He 115, Norwegian service: 6 bought for the naval air service in 1939",
    },
  ],
};
