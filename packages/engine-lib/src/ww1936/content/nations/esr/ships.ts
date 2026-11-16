// ww229 (design ww227 §6): Republican Spain's warship classes, the fleet
// that stayed with the Republic in 1936 and the classes built at Cartagena.
// Real figures from memory of the Wikipedia class articles. Data only.
import type { HistEntry } from "../../../hist/Types";

const SRC_SHIP =
  "Wikipedia ship class articles (en/es), from memory; cost scaled from comparable Italian and US ships by displacement";

export const ESR_SHIPS: readonly HistEntry[] = [
  {
    id: "esr_churruca",
    country: "ESR",
    family: "ship",
    cls: "dd",
    techs: [],
    year: 1930,
    // Churruca class (British Scott-type leaders built at Cartagena, most
    // with the Republic, the last completed there in the war): about
    // 1,540 t, 5 x 120 mm, 1 x 76 mm AA, 6 x 533 mm tubes, 36 kn.
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
    id: "esr_mendez_nunez",
    country: "ESR",
    family: "ship",
    cls: "cl",
    techs: [],
    year: 1924,
    // Blas de Lezo class (the Republic's Méndez Núñez): about 4,700 t,
    // 6 x 152 mm, 76 mm belt, 12 x 533 mm tubes, 29 kn.
    source: SRC_SHIP,
    spec: {
      dispT: 4700,
      main: { count: 6, mm: 152 },
      secondary: { count: 4, mm: 47 },
      beltMm: 76,
      speedKn: 29,
      rangeNm: 5000,
      torpTubes: 12,
      torpWarheadKg: 250,
      asw: 0,
      aaLight: [],
      aaHeavy: 0,
      aircraft: 0,
      costM: 8,
    },
  },
  {
    id: "esr_libertad",
    country: "ESR",
    family: "ship",
    cls: "cl",
    techs: [],
    year: 1925,
    // Almirante Cervera class (Libertad, ex-Príncipe Alfonso, and Miguel
    // de Cervantes): about 7,500 t, 8 x 152 mm, 4 x 102 mm AA, 76 mm belt,
    // 12 x 533 mm tubes, 33 kn.
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
    id: "esr_jaime_i",
    country: "ESR",
    family: "ship",
    cls: "bb",
    techs: [],
    year: 1921,
    // España class dreadnought (the Republic's Jaime I): about 15,700 t,
    // 8 x 305 mm, 20 x 102 mm, 203 mm belt, 19.5 kn.
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
    id: "esr_clase_c",
    country: "ESR",
    family: "ship",
    cls: "ss",
    techs: [],
    year: 1928,
    // C class (Electric Boat design built at Cartagena, all six with the
    // Republic): about 915 t surfaced, 6 x 533 mm tubes, one 76 mm gun,
    // 16.5 kn.
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
];
