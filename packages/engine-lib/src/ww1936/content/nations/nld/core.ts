// ww229 (design ww227 §5-§6): the Netherlands' generals, own equipment and
// start arms, read before the content. No balance of power (NLD is not in
// BOP_TAGS); its mechanism (the water line and the Indies oil) is spirits and
// decisions in index.ts.
//
// Equipment: real specifications, from memory of the en.wikipedia articles
// named in each `source`; nothing here was checked against a printed
// reference, and a middle value is used where recalled figures differ.
// Costs are scaled from the comparable American item the way the majors'
// catalogues do it (P-36A about $23k, M3 Stuart about $33k for 12.5 t,
// Fletcher about $6.5M). MinorClamp holds every fight number between the
// generic key's and the majors' median.
import type { NationCore } from "../types";

const SRC_SHIP = "Conway's All the World's Fighting Ships 1922-1946";

export const CORE_NLD: NationCore = {
  tag: "NLD",
  // Skills [att, def, plan, log] judged from the careers.
  generals: [
    {
      id: "nld_winkelman",
      tag: "NLD",
      att: 2,
      def: 4,
      plan: 3,
      log: 3,
      traits: ["defensive_doctrine"],
      source:
        "en.wikipedia Henri Winkelman: Commander-in-Chief of the Dutch armed forces in 1940",
    },
    {
      id: "nld_van_voorst_tot_voorst",
      tag: "NLD",
      att: 2,
      def: 3,
      plan: 3,
      log: 2,
      traits: ["organizer"],
      source:
        "en.wikipedia Jan Joseph Godfried van Voorst tot Voorst: commander of the Field Army in 1940",
    },
    {
      id: "nld_harberts",
      tag: "NLD",
      att: 2,
      def: 2,
      plan: 2,
      log: 2,
      traits: ["infantry_officer"],
      source:
        "en.wikipedia Battle of the Grebbeberg: Major General Jan Harberts commanded II Army Corps on the Grebbe Line in 1940",
    },
    {
      id: "nld_berenschot",
      tag: "NLD",
      att: 2,
      def: 3,
      plan: 3,
      log: 3,
      traits: ["logistics_wizard"],
      source:
        "en.wikipedia Gerardus Johan Berenschot: commander of the Royal Netherlands East Indies Army (KNIL) 1939-1941",
    },
    {
      id: "nld_ter_poorten",
      tag: "NLD",
      att: 2,
      def: 3,
      plan: 2,
      log: 3,
      traits: ["swamp_expert"],
      source:
        "en.wikipedia Hein ter Poorten: commander of the KNIL 1941-1942 and of ABDA's land forces",
    },
  ],
  bop: [],
  equipment: [
    // ------------------------------------------------------------ tanks
    {
      id: "nld_daf_m39",
      country: "NLD",
      family: "tank",
      role: "light",
      techs: ["light_tank_1"],
      year: 1939,
      // DAF Pantserwagen M39: 6 t, six wheels (6x4), about 12 mm of plate,
      // a 37 mm Bofors gun and three 7.9 mm machine guns, 60 km/h, driven
      // from either end; only a dozen were built.
      source:
        "en.wikipedia DAF Pantserwagen M39, from memory; cost scaled from the M8 armoured car",
      spec: {
        massT: 6,
        hullFrontMm: 12,
        hullSlopeDeg: 30,
        turretFrontMm: 12,
        gunMm: 37,
        penMm500: 30,
        heFillerG: 25,
        mgs: 3,
        offroadKmh: 25,
        roadKmh: 60,
        wheeled: true,
        reliability: 3,
        costK: 15,
      },
    },
    // ------------------------------------------------------------ planes
    {
      id: "nld_fokker_dxxi",
      country: "NLD",
      family: "plane",
      type: "fighter",
      techs: ["fighter_1"],
      year: 1937,
      // Fokker D.XXI: fixed undercarriage monoplane, 460 km/h, 930 km,
      // 1,450 kg empty, 2,050 kg on 16.2 m2, four 7.9 mm FN-Browning.
      source:
        "en.wikipedia Fokker D.XXI, from memory; cost scaled from the P-36A",
      spec: {
        maxKmh: 460,
        rangeKm: 930,
        emptyKg: 1450,
        wingLoad: 127,
        guns: [{ mm: 7.92, count: 4, rpm: 1100 }],
        defGuns: 0,
        bombKg: 0,
        torpedoKg: 0,
        reliability: 4,
        costK: 18,
      },
    },
    {
      id: "nld_koolhoven_fk58",
      country: "NLD",
      family: "plane",
      type: "fighter",
      techs: ["fighter_1"],
      year: 1939,
      // Koolhoven F.K.58: 506 km/h, 750 km, 1,930 kg empty, 2,750 kg on
      // 17.3 m2, four 7.5 mm machine guns; built for France, few delivered.
      source:
        "en.wikipedia Koolhoven F.K.58, from memory; cost scaled from the P-36A",
      spec: {
        maxKmh: 506,
        rangeKm: 750,
        emptyKg: 1930,
        wingLoad: 159,
        guns: [{ mm: 7.5, count: 4, rpm: 1100 }],
        defGuns: 0,
        bombKg: 0,
        torpedoKg: 0,
        reliability: 3,
        costK: 22,
      },
    },
    {
      id: "nld_fokker_gi",
      country: "NLD",
      family: "plane",
      type: "heavy_fighter",
      techs: ["heavy_fighter_1"],
      year: 1938,
      // Fokker G.I: twin-boom "air cruiser", 475 km/h, 1,410 km, 3,325 kg
      // empty, 4,800 kg on 38.3 m2, eight 7.9 mm guns in the nose, one in
      // the tail, 400 kg of bombs.
      source:
        "en.wikipedia Fokker G.I, from memory; cost scaled from US twin-engine types",
      spec: {
        maxKmh: 475,
        rangeKm: 1410,
        emptyKg: 3325,
        wingLoad: 125,
        guns: [{ mm: 7.92, count: 8, rpm: 1100 }],
        defGuns: 1,
        bombKg: 400,
        torpedoKg: 0,
        reliability: 3,
        costK: 60,
      },
    },
    {
      id: "nld_fokker_tv",
      country: "NLD",
      family: "plane",
      type: "bomber",
      techs: ["bomber_1"],
      year: 1938,
      // Fokker T.V: twin-engine bomber, 417 km/h, 1,550 km, 4,650 kg empty,
      // 7,250 kg on 66.2 m2, a 20 mm gun in the nose and four 7.9 mm guns,
      // 1,000 kg of bombs.
      source:
        "en.wikipedia Fokker T.V, from memory; cost scaled from the B-18 by weight",
      spec: {
        maxKmh: 417,
        rangeKm: 1550,
        emptyKg: 4650,
        wingLoad: 110,
        guns: [],
        defGuns: 5,
        bombKg: 1000,
        torpedoKg: 0,
        reliability: 3,
        costK: 90,
      },
    },
    {
      id: "nld_fokker_cx",
      country: "NLD",
      family: "plane",
      type: "cas",
      techs: ["cas_1"],
      year: 1934,
      // Fokker C.X: biplane scout and light bomber, 320 km/h, 830 km,
      // 2,250 kg on 31.6 m2, two fixed and one flexible 7.9 mm gun, 400 kg.
      source:
        "en.wikipedia Fokker C.X, from memory; cost scaled from US single-engine types",
      spec: {
        maxKmh: 320,
        rangeKm: 830,
        emptyKg: 1400,
        wingLoad: 71,
        guns: [{ mm: 7.92, count: 2, rpm: 1100 }],
        defGuns: 1,
        bombKg: 400,
        torpedoKg: 0,
        reliability: 4,
        costK: 15,
      },
    },
    {
      id: "nld_fokker_tviii",
      country: "NLD",
      family: "plane",
      type: "naval_bomber",
      techs: ["naval_bomber_1"],
      year: 1939,
      // Fokker T.VIII: twin-engine floatplane, 285 km/h, 2,750 km, about
      // 5,000 kg on 44 m2, one fixed and one flexible 7.9 mm gun, one
      // torpedo or 600 kg of bombs.
      source:
        "en.wikipedia Fokker T.VIII, from memory; cost scaled from the TBD-1",
      spec: {
        maxKmh: 285,
        rangeKm: 2750,
        emptyKg: 2900,
        wingLoad: 114,
        guns: [{ mm: 7.92, count: 1, rpm: 1100 }],
        defGuns: 1,
        bombKg: 600,
        torpedoKg: 800,
        reliability: 3,
        costK: 50,
      },
    },
    // ------------------------------------------------------------ ships
    {
      id: "nld_java_class",
      country: "NLD",
      family: "ship",
      cls: "cl",
      techs: [],
      year: 1925,
      // Java and Sumatra: 6,670 t, ten 150 mm guns in single mounts, 75 mm
      // belt, 31 kn, two seaplanes.
      source: `en.wikipedia Java-class cruiser, from memory; ${SRC_SHIP}; cost scaled from US cruisers`,
      spec: {
        dispT: 6670,
        main: { count: 10, mm: 150 },
        beltMm: 75,
        speedKn: 31,
        rangeNm: 3600,
        torpTubes: 0,
        torpWarheadKg: 0,
        asw: 0,
        aaLight: [{ count: 4, mm: 40 }],
        aaHeavy: 0,
        aircraft: 2,
        costM: 8,
      },
    },
    {
      id: "nld_de_ruyter",
      country: "NLD",
      family: "ship",
      cls: "cl",
      techs: ["cl_2"],
      year: 1936,
      // De Ruyter: 6,450 t, seven 150 mm guns, 50 mm belt, 32 kn, ten 40 mm
      // Bofors in Hazemeyer stabilised twin mounts, two seaplanes.
      source: `en.wikipedia HNLMS De Ruyter (1935), from memory; ${SRC_SHIP}; cost scaled from US cruisers`,
      spec: {
        dispT: 6450,
        main: { count: 7, mm: 150 },
        beltMm: 50,
        speedKn: 32,
        rangeNm: 6800,
        torpTubes: 0,
        torpWarheadKg: 0,
        asw: 0,
        aaLight: [{ count: 10, mm: 40 }],
        aaHeavy: 0,
        aircraft: 2,
        costM: 9,
      },
    },
    {
      id: "nld_tromp_class",
      country: "NLD",
      family: "ship",
      cls: "cl",
      techs: ["cl_2"],
      year: 1938,
      // Tromp and Jacob van Heemskerck: flotilla leaders of 3,450 t, six
      // 150 mm guns in twin turrets, six 533 mm tubes, 33.5 kn.
      source: `en.wikipedia Tromp-class cruiser, from memory; ${SRC_SHIP}; cost scaled from US cruisers`,
      spec: {
        dispT: 3450,
        main: { count: 6, mm: 150 },
        beltMm: 16,
        speedKn: 33.5,
        rangeNm: 4800,
        torpTubes: 6,
        torpWarheadKg: 250,
        asw: 1,
        aaLight: [{ count: 4, mm: 40 }],
        aaHeavy: 0,
        aircraft: 1,
        costM: 5,
      },
    },
    {
      id: "nld_admiralen_class",
      country: "NLD",
      family: "ship",
      cls: "dd",
      techs: [],
      year: 1928,
      // Van Ghent and her sisters: 1,316 t, four 120 mm guns, one 75 mm AA
      // gun, six 533 mm tubes, 36 kn, a seaplane aboard.
      source: `en.wikipedia Admiralen-class destroyer, from memory; ${SRC_SHIP}; cost scaled from the Fletcher by displacement`,
      spec: {
        dispT: 1316,
        main: { count: 4, mm: 120 },
        beltMm: 0,
        speedKn: 36,
        rangeNm: 3200,
        torpTubes: 6,
        torpWarheadKg: 250,
        asw: 1,
        aaLight: [{ count: 4, mm: 12.7 }],
        aaHeavy: 1,
        aircraft: 1,
        costM: 2.8,
      },
    },
    {
      id: "nld_callenburgh_class",
      country: "NLD",
      family: "ship",
      cls: "dd",
      techs: ["dd_2"],
      year: 1939,
      // Gerard Callenburgh class: 1,604 t, five 120 mm guns, four 40 mm in
      // Hazemeyer mounts, eight 533 mm tubes, 37.5 kn.
      source: `en.wikipedia Gerard Callenburgh-class destroyer, from memory; ${SRC_SHIP}; cost scaled from the Fletcher by displacement`,
      spec: {
        dispT: 1604,
        main: { count: 5, mm: 120 },
        beltMm: 0,
        speedKn: 37.5,
        rangeNm: 3500,
        torpTubes: 8,
        torpWarheadKg: 250,
        asw: 1,
        aaLight: [
          { count: 4, mm: 40 },
          { count: 4, mm: 12.7 },
        ],
        aaHeavy: 0,
        aircraft: 0,
        costM: 3.5,
      },
    },
    {
      id: "nld_k_xiv_class",
      country: "NLD",
      family: "ship",
      cls: "ss",
      techs: [],
      year: 1933,
      // K XIV class: colonial submarines of 865 t, one 88 mm gun, eight
      // 533 mm tubes, 17 kn, long range for the Indies.
      source: `en.wikipedia K XIV-class submarine, from memory; ${SRC_SHIP}; cost scaled from the Gato by displacement`,
      spec: {
        dispT: 865,
        main: { count: 1, mm: 88 },
        beltMm: 0,
        speedKn: 17,
        rangeNm: 10000,
        torpTubes: 8,
        torpWarheadKg: 250,
        asw: 0,
        aaLight: [{ count: 2, mm: 40 }],
        aaHeavy: 0,
        aircraft: 0,
        costM: 2,
      },
    },
    {
      id: "nld_o21_class",
      country: "NLD",
      family: "ship",
      cls: "ss",
      techs: ["ss_2"],
      year: 1940,
      // O 21 class: 990 t, one 88 mm gun, eight 533 mm tubes, 19.5 kn, the
      // first boats with the Dutch snorkel.
      source: `en.wikipedia O 21-class submarine, from memory; ${SRC_SHIP}; cost scaled from the Gato by displacement`,
      spec: {
        dispT: 990,
        main: { count: 1, mm: 88 },
        beltMm: 0,
        speedKn: 19.5,
        rangeNm: 10000,
        torpTubes: 8,
        torpWarheadKg: 250,
        asw: 0,
        aaLight: [{ count: 2, mm: 40 }],
        aaHeavy: 0,
        aircraft: 0,
        costM: 2.3,
      },
    },
    // ------------------------------------------------------------ infantry
    {
      id: "nld_m95",
      country: "NLD",
      family: "infantry",
      techs: ["inf_eq_1"],
      year: 1895,
      staticFor: "infantry_equipment:1",
      // Geweer M.95: the Dutch Mannlicher in 6.5x53 mmR.
      source:
        "en.wikipedia Mannlicher M1895 (Dutch Geweer M.95), from memory; cost a guess near the US 1903 rifle",
      spec: { mm: 6.5, aimedRpm: 12, rangeM: 600, autoPct: 0, costUsd: 25 },
    },
    {
      id: "nld_lewis_m20",
      country: "NLD",
      family: "infantry",
      techs: ["inf_eq_2"],
      year: 1920,
      staticFor: "infantry_equipment:2",
      // The Lewis gun in 6.5 mm (Lewis M.20), the section's light machine
      // gun, made under licence at Hembrug.
      source:
        "en.wikipedia Lewis gun (Dutch M.20 in 6.5 mm), from memory; cost scaled from the BAR",
      spec: { mm: 6.5, aimedRpm: 22, rangeM: 600, autoPct: 10, costUsd: 45 },
    },
  ],
  startArms: [
    {
      entry: "usa_a17",
      origin: "received",
      count: 18,
      source:
        "en.wikipedia Northrop A-17: 18 Douglas DB-8A-3N bought by the Netherlands",
    },
    {
      entry: "usa_p36a",
      origin: "received",
      count: 24,
      source:
        "en.wikipedia Curtiss P-36 Hawk: 24 Hawk 75A-7 delivered to the Netherlands East Indies",
    },
  ],
};
