// ww229 (design ww227 §5-§6): Brazil's generals, the Vargas-Integralist
// balance of power, its own equipment catalogue and the arms it holds at the
// start. Figures are real specifications from the cited references (from
// memory where the source says so); hist/MinorClamp.ts holds the fight
// numbers between the generic key and the majors' median.
import type { NationCore } from "../types";

const SRC_SHIP =
  "en.wikipedia ship and class articles (Conway's All the World's Fighting Ships 1906-1921 and 1922-1946), from memory; cost scaled from Italian and US ships by displacement";

export const CORE_BRA: NationCore = {
  tag: "BRA",
  // Generals: the army's chiefs of the Vargas years and the FEB's commanders
  // in Italy. No first-rank day is kept (none is gated).
  generals: [
    {
      id: "bra_gen_mascarenhas",
      tag: "BRA",
      att: 3,
      def: 3,
      plan: 3,
      log: 3,
      traits: ["infantry_officer"],
      source:
        "en.wikipedia João Batista Mascarenhas de Morais: commanded the Brazilian Expeditionary Force in Italy 1944-1945 (Monte Castello, Montese)",
    },
    {
      id: "bra_gen_zenobio",
      tag: "BRA",
      att: 3,
      def: 2,
      plan: 2,
      log: 2,
      traits: ["offensive_doctrine"],
      source:
        "en.wikipedia Euclides Zenóbio da Costa: commanded the FEB's infantry in Italy 1944-1945, later Minister of War",
    },
    {
      id: "bra_gen_cordeiro",
      tag: "BRA",
      att: 2,
      def: 3,
      plan: 3,
      log: 2,
      traits: ["artillery_officer"],
      source:
        "en.wikipedia Osvaldo Cordeiro de Farias: a tenente of the 1920s, commanded the FEB's divisional artillery in Italy 1944-1945",
    },
    {
      id: "bra_gen_dutra",
      tag: "BRA",
      att: 2,
      def: 3,
      plan: 3,
      log: 3,
      traits: ["organizer"],
      source:
        "en.wikipedia Eurico Gaspar Dutra: Minister of War 1936-1945, put down the 1935 rising in Rio, President 1946-1951",
    },
    {
      id: "bra_gen_goes_monteiro",
      tag: "BRA",
      att: 3,
      def: 3,
      plan: 4,
      log: 2,
      traits: ["defensive_doctrine"],
      source:
        "en.wikipedia Pedro Aurélio de Góis Monteiro: military chief of the 1930 revolution, commanded against São Paulo in 1932, Chief of the Army Staff 1937-1943",
    },
  ],
  // Negative: Vargas and the Estado Novo; positive: Integralist Action
  // (Plínio Salgado's green shirts). No drift: the movement grows through
  // its parades, the palace's favours and the routes, and falls with the
  // bans; the balance ends with the government that started it.
  bop: [
    {
      tag: "BRA",
      startPm: 0,
      spirits: [
        "bra_bop_estado_novo_firm",
        "bra_bop_getulio_holds",
        "bra_bop_uneasy_truce",
        "bra_bop_green_tide",
        "bra_bop_integralist_surge",
      ],
      endsOnRulingChange: true,
    },
  ],
  equipment: [
    // ------------------------------------------------------------ planes
    {
      id: "bra_fw58",
      country: "BRA",
      family: "plane",
      type: "bomber",
      techs: ["bomber_1"],
      year: 1940,
      // Focke-Wulf Fw 58 Weihe built under licence at the Fábrica do
      // Galeão; the navy and the air force flew it on coastal patrol.
      source:
        "en.wikipedia Focke-Wulf Fw 58 (licence-built at Galeão, Brazil): about 270 km/h, 800 km, two Argus As 10C; bomb load and empty weight from memory; cost an estimate",
      spec: {
        maxKmh: 270,
        rangeKm: 800,
        emptyKg: 2400,
        wingLoad: 77,
        guns: [{ mm: 7.92, count: 1, rpm: 750 }],
        defGuns: 2,
        bombKg: 100,
        torpedoKg: 0,
        reliability: 3,
        costK: 24,
      },
    },
    // ------------------------------------------------------------ ships
    {
      id: "bra_minas_geraes",
      country: "BRA",
      family: "ship",
      cls: "bb",
      techs: [],
      year: 1910,
      // The first of the South American dreadnoughts, rebuilt at Rio in the
      // 1930s with oil-fired boilers.
      source: SRC_SHIP,
      spec: {
        dispT: 19281,
        main: { count: 12, mm: 305 },
        secondary: { count: 14, mm: 120 },
        beltMm: 229,
        speedKn: 21,
        rangeNm: 10000,
        torpTubes: 0,
        torpWarheadKg: 0,
        asw: 0,
        aaLight: [],
        aaHeavy: 4,
        aircraft: 0,
        costM: 26,
      },
    },
    {
      id: "bra_bahia",
      country: "BRA",
      family: "ship",
      cls: "cl",
      techs: [],
      year: 1910,
      // Bahia-class scout cruiser, re-engined in the 1920s.
      source: SRC_SHIP,
      spec: {
        dispT: 3150,
        main: { count: 10, mm: 120 },
        beltMm: 0,
        speedKn: 27,
        rangeNm: 1400,
        torpTubes: 2,
        torpWarheadKg: 100,
        asw: 1,
        aaLight: [],
        aaHeavy: 1,
        aircraft: 0,
        costM: 5,
      },
    },
    {
      id: "bra_para",
      country: "BRA",
      family: "ship",
      cls: "dd",
      techs: [],
      year: 1909,
      // Pará class: ten Yarrow destroyers of 1909-1910.
      source: SRC_SHIP,
      spec: {
        dispT: 560,
        main: { count: 2, mm: 102 },
        secondary: { count: 4, mm: 47 },
        beltMm: 0,
        speedKn: 27,
        rangeNm: 1600,
        torpTubes: 2,
        torpWarheadKg: 100,
        asw: 0,
        aaLight: [],
        aaHeavy: 0,
        aircraft: 0,
        costM: 1.6,
      },
    },
    {
      id: "bra_maranhao",
      country: "BRA",
      family: "ship",
      cls: "dd",
      techs: [],
      year: 1913,
      // The former HMS Porpoise (Acasta class), bought in 1920.
      source: SRC_SHIP,
      spec: {
        dispT: 950,
        main: { count: 3, mm: 102 },
        beltMm: 0,
        speedKn: 29,
        rangeNm: 1500,
        torpTubes: 2,
        torpWarheadKg: 130,
        asw: 1,
        aaLight: [],
        aaHeavy: 0,
        aircraft: 0,
        costM: 2.2,
      },
    },
    {
      id: "bra_marcilio_dias",
      country: "BRA",
      family: "ship",
      cls: "dd",
      techs: ["dd_2"],
      year: 1943,
      // Three destroyers on the US Mahan design, built at the Ilha das Cobras
      // navy yard in Rio.
      source: SRC_SHIP,
      spec: {
        dispT: 1500,
        main: { count: 5, mm: 127 },
        beltMm: 0,
        speedKn: 36.5,
        rangeNm: 6000,
        torpTubes: 8,
        torpWarheadKg: 224,
        asw: 2,
        aaLight: [{ count: 4, mm: 20 }],
        aaHeavy: 4,
        aircraft: 0,
        costM: 5,
      },
    },
    {
      id: "bra_humayta",
      country: "BRA",
      family: "ship",
      cls: "ss",
      techs: [],
      year: 1929,
      // An ocean-going submarine built by OTO at La Spezia on the Balilla
      // design.
      source: SRC_SHIP,
      spec: {
        dispT: 1390,
        main: { count: 1, mm: 120 },
        beltMm: 0,
        speedKn: 18.5,
        rangeNm: 10000,
        torpTubes: 6,
        torpWarheadKg: 250,
        asw: 0,
        aaLight: [{ count: 2, mm: 13.2 }],
        aaHeavy: 0,
        aircraft: 0,
        costM: 3.5,
      },
    },
    {
      id: "bra_tupy",
      country: "BRA",
      family: "ship",
      cls: "ss",
      techs: [],
      year: 1937,
      // Tupy class: three Perla-type coastal submarines from Italy.
      source: SRC_SHIP,
      spec: {
        dispT: 620,
        main: { count: 1, mm: 100 },
        beltMm: 0,
        speedKn: 14,
        rangeNm: 3500,
        torpTubes: 6,
        torpWarheadKg: 250,
        asw: 0,
        aaLight: [{ count: 2, mm: 13.2 }],
        aaHeavy: 0,
        aircraft: 0,
        costM: 2.5,
      },
    },
    // ------------------------------------------------------------ infantry
    {
      id: "bra_mauser_1908",
      country: "BRA",
      family: "infantry",
      techs: ["inf_eq_1"],
      staticFor: "infantry_equipment:1",
      year: 1908,
      source:
        "en.wikipedia Mauser Model 1908 (Brazilian 7×57 mm rifle, DWM-made; later the Itajubá M1908/34 short rifle); figures from memory; cost near the Kar98k",
      spec: { mm: 7, aimedRpm: 15, rangeM: 500, autoPct: 0, costUsd: 25 },
    },
    // ------------------------------------------------------------ guns
    {
      id: "bra_krupp_75_m1908",
      country: "BRA",
      family: "gun",
      role: "artillery",
      techs: ["artillery_1"],
      year: 1908,
      source:
        "en.wikipedia Krupp 7.5 cm field guns (Brazil's Model 1908, bought before 1914, fought in 1930 and 1932); figures from memory; cost scaled from the leFH 18",
      spec: {
        mm: 75,
        rpm: 10,
        rangeM: 6500,
        shellKg: 6.5,
        penMm500: 0,
        massKg: 1000,
        barrels: 1,
        costK: 5,
      },
    },
    {
      id: "bra_krupp_88_aa",
      country: "BRA",
      family: "gun",
      role: "anti_air",
      techs: ["anti_air_1"],
      year: 1939,
      source:
        "en.wikipedia 8.8 cm Flak 18/36/37 (export guns bought by Brazil under the 1938 Krupp contract); figures from memory; cost near the Flak 36",
      spec: {
        mm: 88,
        rpm: 15,
        rangeM: 10600,
        shellKg: 9.4,
        penMm500: 0,
        massKg: 5000,
        barrels: 1,
        costK: 13,
      },
    },
  ],
  startArms: [
    {
      entry: "ita_cv33",
      origin: "received",
      count: 23,
      source:
        "en.wikipedia L3/35 (Brazil: 23 CV-35 tankettes bought from Italy in 1938, the army's first armour after the Renault FTs)",
    },
  ],
};
