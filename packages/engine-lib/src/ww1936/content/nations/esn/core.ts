// ww229 (design ww227 §5-§6): ESN's generals, balance of power, own
// equipment and start arms, read before the content.
//
// Equipment: Spanish-built or Spanish-made-under-licence models of the
// period, real specifications from memory of the en/es.wikipedia articles
// (no printed reference checked); where recalled figures differ a middle
// value is used and noted. Costs are 1940 US dollars of effort, scaled from
// the majors' comparable items as in hist/ita.ts. The numbers are clamped
// between the generic key and the majors' median (hist/MinorClamp.ts).
import type { NationCore } from "../types";

const SRC_SHIP =
  "Wikipedia ship class articles (en/es), from memory; cost scaled from comparable Italian and US ships by displacement";

export const CORE_ESN: NationCore = {
  tag: "ESN",
  // Commanders of the Nationalist armies and corps (Franco, Mola and Varela
  // are in Generals.ts already). None needs a `from`: each led troops from
  // the rising on, whatever his rank that summer.
  generals: [
    {
      id: "esn_yague",
      tag: "ESN",
      att: 4,
      def: 2,
      plan: 2,
      log: 2,
      traits: ["infantry_officer"],
      source:
        "en.wikipedia Juan Yagüe: led the Army of Africa's columns from Seville to Madrid in 1936, the Moroccan Army Corps on the Ebro and in Catalonia 1938-39",
    },
    {
      id: "esn_queipo",
      tag: "ESN",
      att: 3,
      def: 3,
      plan: 2,
      log: 2,
      traits: ["trickster"],
      source:
        "en.wikipedia Gonzalo Queipo de Llano: general de división, took Seville in the rising, commanded the Army of the South 1936-39",
    },
    {
      id: "esn_davila",
      tag: "ESN",
      att: 2,
      def: 3,
      plan: 3,
      log: 3,
      traits: ["organizer"],
      source:
        "en.wikipedia Fidel Dávila Arrondo: head of the Junta Técnica 1936-37, commanded the Army of the North 1937-38 (Santander, Asturias, Aragon)",
    },
    {
      id: "esn_aranda",
      tag: "ESN",
      att: 3,
      def: 4,
      plan: 3,
      log: 2,
      traits: ["defensive_doctrine"],
      source:
        "en.wikipedia Antonio Aranda: held Oviedo through the siege of 1936, commanded the Galicia Army Corps 1937-39",
    },
    {
      id: "esn_solchaga",
      tag: "ESN",
      att: 3,
      def: 2,
      plan: 2,
      log: 2,
      traits: ["infantry_officer"],
      source:
        "es.wikipedia José Solchaga Zala: commanded the Navarre Brigades in the northern campaign of 1937 and the Navarre Army Corps 1938-39",
    },
    {
      id: "esn_munoz_grandes",
      tag: "ESN",
      att: 3,
      def: 3,
      plan: 3,
      log: 2,
      traits: ["infantry_expert"],
      source:
        "en.wikipedia Agustín Muñoz Grandes: commanded a corps in the civil war and the Spanish volunteer (250th) division in Russia 1941-42",
    },
  ],
  // Design ww227 §5: the Falange (−) against the Carlists and the other
  // Traditionalists (+), with the head of state in the middle. It ends when
  // another ideology rules.
  bop: [
    {
      tag: "ESN",
      startPm: -100,
      spirits: [
        "esn_bop_falange_state",
        "esn_bop_falange_lead",
        "esn_bop_arbiter",
        "esn_bop_tradition_lead",
        "esn_bop_carlist_strength",
      ],
      endsOnRulingChange: true,
    },
  ],
  equipment: [
    // ------------------------------------------------------------ infantry
    {
      id: "esn_mauser_1893",
      country: "ESN",
      family: "infantry",
      techs: ["inf_eq_1"],
      year: 1893,
      staticFor: "infantry_equipment:1",
      // Spanish Mauser M1893, 7x57 mm, the army's rifle and short rifle,
      // made at Oviedo and Toledo; no automatic share.
      source:
        "en.wikipedia Mauser Model 1893 (Spanish Mauser), from memory; cost a guess near the Italian Carcano",
      spec: { mm: 7, aimedRpm: 12, rangeM: 500, autoPct: 0, costUsd: 20 },
    },
    {
      id: "esn_mauser_1943",
      country: "ESN",
      family: "infantry",
      techs: ["inf_eq_2"],
      year: 1943,
      staticFor: "infantry_equipment:2",
      // Fusil Mauser modelo 1943, 7.92x57 mm (La Coruña and Oviedo), with
      // the Star Z-45 submachine gun from 1944 as a small automatic share.
      source:
        "es.wikipedia Fusil Mauser modelo 1943 and Star Z-45, from memory; cost as the 1893 rifle plus the submachine guns",
      spec: { mm: 7.92, aimedRpm: 13, rangeM: 500, autoPct: 8, costUsd: 24 },
    },
    // ------------------------------------------------------------ guns
    {
      id: "esn_vickers_105_11",
      country: "ESN",
      family: "gun",
      role: "artillery",
      techs: ["artillery_1"],
      year: 1922,
      staticFor: "artillery:1",
      // Obús Vickers de 105/11 modelo 1919/1922, built under licence by the
      // Sociedad Española de Construcción Naval at Placencia de las Armas;
      // range given between 10 and 11 km, a middle value used.
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
      id: "esn_schneider_155_13",
      country: "ESN",
      family: "gun",
      role: "artillery",
      techs: ["artillery_1", "art_imp_1"],
      year: 1917,
      // Schneider 155 mm howitzer modèle 1917, made in Spain at Trubia as
      // the 155/13: about 11 km, 43 kg shell, 3.3 t in action.
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
    {
      id: "esn_88_56_ft",
      country: "ESN",
      family: "gun",
      role: "anti_air",
      techs: ["anti_air_1", "aa_imp_1"],
      year: 1943,
      // Cañón 88/56 FT: the German 8.8 cm Flak 18/36 built at the Trubia
      // works (FT), same figures as the German gun.
      source:
        "es.wikipedia Cañón 88/56 FT (the Flak 18/36 built at Trubia), from memory; figures and cost as deu_flak36_88",
      spec: {
        mm: 88,
        rpm: 15,
        rangeM: 8000,
        shellKg: 9.4,
        penMm500: 0,
        massKg: 5000,
        barrels: 1,
        costK: 13,
      },
    },
    // ------------------------------------------------------------ tanks
    {
      id: "esn_verdeja_1",
      country: "ESN",
      family: "tank",
      role: "light",
      techs: ["light_tank_2"],
      year: 1939,
      // Verdeja No. 1 prototype: about 6.5 t, the Soviet 45 mm 20-K gun of
      // the T-26 (about 35 mm at 500 m), two 7.92 mm machine guns, a Ford V8
      // engine. Armour (16-25 mm front) and speed differ between sources;
      // middle values used.
      source:
        "en.wikipedia Verdeja (tank), from memory; armour and speed figures differ, middle values; cost scaled from ita_l6_40 by weight",
      spec: {
        massT: 6.5,
        hullFrontMm: 20,
        hullSlopeDeg: 20,
        turretFrontMm: 16,
        gunMm: 45,
        penMm500: 35,
        heFillerG: 118,
        mgs: 2,
        offroadKmh: 25,
        roadKmh: 45,
        reliability: 3,
        costK: 18,
      },
    },
    // ------------------------------------------------------------ planes
    {
      id: "esn_ha132l",
      country: "ESN",
      family: "plane",
      type: "fighter",
      techs: ["fighter_1"],
      year: 1939,
      // Hispano HA-132-L "Chirri": the Fiat CR.32 built under licence at
      // Seville (about 100), with the Italian figures.
      source:
        "en.wikipedia Fiat CR.32 (licence production by Hispano Aviación as the HA-132-L), from memory; figures and cost as ita_cr32",
      spec: {
        maxKmh: 375,
        rangeKm: 780,
        emptyKg: 1390,
        wingLoad: 84,
        guns: [{ mm: 12.7, count: 2, rpm: 700 }],
        defGuns: 0,
        bombKg: 100,
        torpedoKg: 0,
        reliability: 4,
        costK: 14,
      },
    },
    // ------------------------------------------------------------ ships
    {
      id: "esn_churruca",
      country: "ESN",
      family: "ship",
      cls: "dd",
      techs: [],
      year: 1930,
      // Churruca class (British Scott-type leaders built at Cartagena):
      // about 1,540 t, 5 x 120 mm, 1 x 76 mm AA, 6 x 533 mm tubes, 36 kn.
      source: SRC_SHIP,
      spec: {
        dispT: 1540,
        main: { count: 5, mm: 120 },
        secondary: { count: 1, mm: 76 },
        beltMm: 0,
        speedKn: 36,
        rangeNm: 4500,
        torpTubes: 6,
        torpWarheadKg: 250,
        asw: 1,
        aaLight: [],
        aaHeavy: 1,
        aircraft: 0,
        costM: 3.2,
      },
    },
    {
      id: "esn_almirante_cervera",
      country: "ESN",
      family: "ship",
      cls: "cl",
      techs: [],
      year: 1928,
      // Almirante Cervera class: about 7,500 t, 8 x 152 mm, 4 x 102 mm AA,
      // 76 mm belt, 12 x 533 mm tubes, 33 kn.
      source: SRC_SHIP,
      spec: {
        dispT: 7500,
        main: { count: 8, mm: 152 },
        secondary: { count: 4, mm: 102 },
        beltMm: 76,
        speedKn: 33,
        rangeNm: 5000,
        torpTubes: 12,
        torpWarheadKg: 250,
        asw: 0,
        aaLight: [],
        aaHeavy: 4,
        aircraft: 0,
        costM: 12,
      },
    },
    {
      id: "esn_canarias",
      country: "ESN",
      family: "ship",
      cls: "ca",
      techs: [],
      year: 1936,
      // Canarias class (British County-type design, built at Ferrol): about
      // 10,100 t, 8 x 203 mm, 8 x 120 mm, 50 mm belt, 12 x 533 mm tubes,
      // 33 kn, 8,700 nm at 15 kn.
      source: SRC_SHIP,
      spec: {
        dispT: 10100,
        main: { count: 8, mm: 203 },
        secondary: { count: 8, mm: 120 },
        beltMm: 50,
        speedKn: 33,
        rangeNm: 8700,
        torpTubes: 12,
        torpWarheadKg: 250,
        asw: 0,
        aaLight: [{ count: 8, mm: 40 }],
        aaHeavy: 8,
        aircraft: 0,
        costM: 20,
      },
    },
    {
      id: "esn_espana",
      country: "ESN",
      family: "ship",
      cls: "bb",
      techs: [],
      year: 1913,
      // España class dreadnought (the Nationalists' España, ex-Alfonso
      // XIII): about 15,700 t, 8 x 305 mm, 20 x 102 mm, 203 mm belt,
      // 19.5 kn.
      source: SRC_SHIP,
      spec: {
        dispT: 15700,
        main: { count: 8, mm: 305 },
        secondary: { count: 20, mm: 102 },
        beltMm: 203,
        speedKn: 19.5,
        rangeNm: 5000,
        torpTubes: 0,
        torpWarheadKg: 0,
        asw: 0,
        aaLight: [],
        aaHeavy: 0,
        aircraft: 0,
        costM: 30,
      },
    },
    {
      id: "esn_clase_c",
      country: "ESN",
      family: "ship",
      cls: "ss",
      techs: [],
      year: 1928,
      // C class (Electric Boat design built at Cartagena): about 915 t
      // surfaced, 6 x 533 mm tubes, one 76 mm gun, 16.5 kn.
      source: SRC_SHIP,
      spec: {
        dispT: 915,
        main: { count: 1, mm: 76 },
        beltMm: 0,
        speedKn: 16.5,
        rangeNm: 6800,
        torpTubes: 6,
        torpWarheadKg: 200,
        asw: 0,
        aaLight: [],
        aaHeavy: 0,
        aircraft: 0,
        costM: 3,
      },
    },
  ],
  // Owner D4: received from the start, used but not produced.
  startArms: [
    {
      entry: "deu_pz1_b",
      origin: "received",
      count: 40,
      source:
        "en.wikipedia Panzer I: about 120 sent to the Nationalists 1936-39 (Condor Legion's tank group)",
    },
    {
      entry: "ita_cv33",
      origin: "received",
      count: 40,
      source:
        "en.wikipedia L3/33: about 150 CV.33/35 sent to Spain with the Italian volunteer corps from 1936",
    },
    {
      entry: "ita_cr32",
      origin: "received",
      count: 40,
      source:
        "en.wikipedia Fiat CR.32: some 380 sent to Spain 1936-39, many flown by Spanish squadrons",
    },
    {
      entry: "deu_he51",
      origin: "received",
      count: 24,
      source:
        "en.wikipedia Heinkel He 51: about 135 sent to Spain 1936-38, passed to Spanish units as ground attackers",
    },
    {
      entry: "deu_ju52",
      origin: "received",
      count: 12,
      source:
        "en.wikipedia Junkers Ju 52: used for the airlift of the Army of Africa across the Strait in 1936",
    },
  ],
};
