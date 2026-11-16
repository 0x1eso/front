// ww229 (design ww227 §5-§6): YUG's generals, balance of power, own
// equipment and start arms, read before the content. Data only.
//
// Balance of power: Serb centralism (−) against Croat autonomy (+). It starts
// on Belgrade's side; the Sporazum road moves it right, the iron hand left.
// The catalogue is what Yugoslavia built itself or under licence at
// Kragujevac, Kraljevo, Zemun (Ikarus, Rogožarski, Zmaj) and Split, plus the
// ships built for it abroad. Figures from the standard references; where they
// disagree a middle value.
import type { NationCore } from "../types";

const SRC_AIR =
  "en.wikipedia (aircraft article); Green and Swanborough, The Complete Book of Fighters (1994); cost scaled from the ww66 table";
const SRC_SHIP =
  "en.wikipedia (ship or class article); Conway's All the World's Fighting Ships 1922-1946; cost scaled from the ww66 table";

export const CORE_YUG: NationCore = {
  tag: "YUG",
  generals: [
    {
      id: "yug_nedic",
      tag: "YUG",
      att: 2,
      def: 3,
      plan: 3,
      log: 2,
      traits: ["defensive_doctrine"],
      source:
        "en.wikipedia Milan Nedić: army general, Chief of the General Staff 1934-1935, Minister of the Army and Navy 1939-1940",
    },
    {
      id: "yug_pesic",
      tag: "YUG",
      att: 2,
      def: 2,
      plan: 3,
      log: 3,
      traits: ["organizer"],
      source:
        "en.wikipedia Petar Pešić: army general, Chief of the General Staff, Minister of the Army and Navy 1940-1941",
    },
    {
      id: "yug_kalafatovic",
      tag: "YUG",
      att: 2,
      def: 3,
      plan: 2,
      log: 2,
      traits: [],
      source:
        "en.wikipedia Danilo Kalafatović: army general, Chief of the General Staff 1940-1941 (April War)",
    },
    {
      id: "yug_maric",
      tag: "YUG",
      att: 2,
      def: 2,
      plan: 2,
      log: 3,
      traits: ["infantry_officer"],
      source:
        "en.wikipedia Ljubomir Marić: army general, Minister of the Army and Navy in the Stojadinović cabinets",
    },
    {
      id: "yug_mihailovic",
      tag: "YUG",
      att: 3,
      def: 3,
      plan: 2,
      log: 2,
      traits: ["guerrilla_fighter"],
      from: "1942-01-01",
      source:
        "en.wikipedia Draža Mihailović: colonel in April 1941, made brigadier general by the government in exile in January 1942",
    },
  ],
  bop: [
    {
      tag: "YUG",
      startPm: -400,
      spirits: [
        "bop_yug_serb_hegemony",
        "bop_yug_centralism",
        null,
        "bop_yug_concessions",
        "bop_yug_federal_kingdom",
      ],
      endsOnRulingChange: true,
    },
  ],
  equipment: [
    // ------------------------------------------------------------ infantry
    {
      id: "yug_m24",
      country: "YUG",
      family: "infantry",
      techs: ["inf_eq_1"],
      year: 1924,
      // Mauser M24, 7.92 mm, built by FN and from 1928 at Kragujevac; the
      // standard Yugoslav rifle.
      source:
        "en.wikipedia Mauser Model 1924 (Yugoslav M24, Kragujevac); cost scaled from the Kar98k",
      spec: { mm: 7.92, aimedRpm: 12, rangeM: 500, autoPct: 0, costUsd: 24 },
    },
    {
      id: "yug_zb30j",
      country: "YUG",
      family: "infantry",
      techs: ["inf_eq_2"],
      year: 1937,
      // Puškomitraljez M37 (ZB vz. 30J), the Czech light machine gun built
      // under licence at Kragujevac; about one man in ten carries one.
      source:
        "en.wikipedia ZB vz. 30 (Yugoslav M37, Kragujevac licence); cost scaled from the Bren",
      spec: { mm: 7.92, aimedRpm: 16, rangeM: 600, autoPct: 10, costUsd: 38 },
    },
    // ------------------------------------------------------------ planes
    {
      id: "yug_fury_ii",
      country: "YUG",
      family: "plane",
      type: "fighter",
      techs: ["fighter_1"],
      year: 1937,
      // Hawker Fury II, bought and then built under licence by Ikarus and
      // Zmaj; biplane, about 360 km/h, two Vickers guns.
      source: SRC_AIR,
      spec: {
        maxKmh: 360,
        rangeKm: 430,
        emptyKg: 1245,
        wingLoad: 75,
        guns: [{ mm: 7.7, count: 2, rpm: 850 }],
        defGuns: 0,
        bombKg: 0,
        torpedoKg: 0,
        reliability: 4,
        costK: 16,
      },
    },
    {
      id: "yug_ik2",
      country: "YUG",
      family: "plane",
      type: "fighter",
      techs: ["fighter_1"],
      year: 1939,
      // Ikarus IK-2: gull-wing monoplane, Hispano-Suiza 12Y, 435 km/h, one
      // 20 mm engine cannon and two machine guns; twelve built.
      source: SRC_AIR,
      spec: {
        maxKmh: 435,
        rangeKm: 700,
        emptyKg: 1500,
        wingLoad: 103,
        guns: [
          { mm: 20, count: 1, rpm: 600 },
          { mm: 7.92, count: 2, rpm: 900 },
        ],
        defGuns: 0,
        bombKg: 0,
        torpedoKg: 0,
        reliability: 3,
        costK: 26,
      },
    },
    {
      id: "yug_ik3",
      country: "YUG",
      family: "plane",
      type: "fighter",
      techs: ["fighter_2"],
      year: 1940,
      // Rogožarski IK-3: low-wing monoplane, Hispano-Suiza 12Y29, about
      // 527 km/h, one 20 mm cannon and two Browning guns; twelve built.
      source: SRC_AIR,
      spec: {
        maxKmh: 527,
        rangeKm: 785,
        emptyKg: 2068,
        wingLoad: 159,
        guns: [
          { mm: 20, count: 1, rpm: 600 },
          { mm: 7.92, count: 2, rpm: 1100 },
        ],
        defGuns: 0,
        bombKg: 0,
        torpedoKg: 0,
        reliability: 3,
        costK: 38,
      },
    },
    {
      id: "yug_potez25",
      country: "YUG",
      family: "plane",
      type: "cas",
      techs: ["cas_1"],
      year: 1932,
      // Potez 25 built under licence by Ikarus: two-seat biplane for
      // reconnaissance and light bombing, about 215 km/h.
      source: SRC_AIR,
      spec: {
        maxKmh: 215,
        rangeKm: 600,
        emptyKg: 1510,
        wingLoad: 54,
        guns: [{ mm: 7.7, count: 1, rpm: 800 }],
        defGuns: 2,
        bombKg: 200,
        torpedoKg: 0,
        reliability: 4,
        costK: 12,
      },
    },
    {
      id: "yug_do17k",
      country: "YUG",
      family: "plane",
      type: "bomber",
      techs: ["bomber_1"],
      year: 1938,
      // Dornier Do 17K, the export model with Gnome-Rhône 14N engines,
      // bought and built under licence at Kraljevo; about 415 km/h, 1,000 kg.
      source: SRC_AIR,
      spec: {
        maxKmh: 415,
        rangeKm: 1200,
        emptyKg: 5000,
        wingLoad: 145,
        guns: [{ mm: 20, count: 1, rpm: 600 }],
        defGuns: 3,
        bombKg: 1000,
        torpedoKg: 0,
        reliability: 4,
        costK: 62,
      },
    },
    {
      id: "yug_blenheim_i",
      country: "YUG",
      family: "plane",
      type: "bomber",
      techs: ["bomber_1"],
      year: 1940,
      // Bristol Blenheim I built under licence by Ikarus at Zemun; about
      // 450 km/h, 454 kg of bombs.
      source: SRC_AIR,
      spec: {
        maxKmh: 450,
        rangeKm: 1800,
        emptyKg: 3675,
        wingLoad: 130,
        guns: [{ mm: 7.7, count: 1, rpm: 1100 }],
        defGuns: 1,
        bombKg: 454,
        torpedoKg: 0,
        reliability: 4,
        costK: 52,
      },
    },
    // ------------------------------------------------------------ ships
    {
      id: "yug_dubrovnik",
      country: "YUG",
      family: "ship",
      cls: "dd",
      techs: [],
      year: 1932,
      // Dubrovnik, a large destroyer built by Yarrow: 1,880 t, four 140 mm
      // Škoda guns, two 83.5 mm AA, six 40 mm, six 533 mm tubes, 37 kn.
      source: SRC_SHIP,
      spec: {
        dispT: 1880,
        main: { count: 4, mm: 140 },
        beltMm: 0,
        speedKn: 37,
        rangeNm: 7000,
        torpTubes: 6,
        torpWarheadKg: 250,
        asw: 1,
        aaLight: [{ count: 6, mm: 40 }],
        aaHeavy: 2,
        aircraft: 0,
        costM: 4.5,
      },
    },
    {
      id: "yug_beograd",
      country: "YUG",
      family: "ship",
      cls: "dd",
      techs: ["dd_2"],
      year: 1939,
      // Beograd class (one built at Nantes, two at Split): 1,210 t, four
      // 120 mm Škoda, four 40 mm, six 550 mm tubes, about 38 kn.
      source: SRC_SHIP,
      spec: {
        dispT: 1210,
        main: { count: 4, mm: 120 },
        beltMm: 0,
        speedKn: 38,
        rangeNm: 1000,
        torpTubes: 6,
        torpWarheadKg: 300,
        asw: 1,
        aaLight: [{ count: 4, mm: 40 }],
        aaHeavy: 0,
        aircraft: 0,
        costM: 3.2,
      },
    },
    {
      id: "yug_hrabri",
      country: "YUG",
      family: "ship",
      cls: "ss",
      techs: [],
      year: 1928,
      // Hrabri class, built by Vickers-Armstrongs on the British L-class
      // design: 975 t surfaced, six 533 mm tubes, one 102 mm gun, 15.7 kn.
      source: SRC_SHIP,
      spec: {
        dispT: 975,
        main: { count: 1, mm: 102 },
        beltMm: 0,
        speedKn: 15.7,
        rangeNm: 5000,
        torpTubes: 6,
        torpWarheadKg: 230,
        asw: 0,
        aaLight: [],
        aaHeavy: 0,
        aircraft: 0,
        costM: 2.6,
      },
    },
    {
      id: "yug_osvetnik",
      country: "YUG",
      family: "ship",
      cls: "ss",
      techs: [],
      year: 1929,
      // Osvetnik class, built at Nantes: about 630 t surfaced, six 550 mm
      // tubes, one 100 mm gun, 14.5 kn.
      source: SRC_SHIP,
      spec: {
        dispT: 630,
        main: { count: 1, mm: 100 },
        beltMm: 0,
        speedKn: 14.5,
        rangeNm: 3500,
        torpTubes: 6,
        torpWarheadKg: 300,
        asw: 0,
        aaLight: [],
        aaHeavy: 0,
        aircraft: 0,
        costM: 2.1,
      },
    },
  ],
  startArms: [
    {
      entry: "fra_ft17",
      origin: "received",
      count: 40,
      source:
        "en.wikipedia Renault FT, operators: Yugoslavia received FTs from France after 1919 and still used them in 1941",
    },
    {
      entry: "gbr_hurricane_i",
      origin: "licensed",
      count: 0,
      source:
        "en.wikipedia Hawker Hurricane, operators: Yugoslavia bought Hurricanes and a licence; Zmaj and Rogožarski built them",
    },
  ],
};
