// ww229 (design ww227 §5-§6): Romania's generals, the Crown-Iron Guard
// balance of power, its own equipment catalogue and the arms it holds at the
// start. Figures are real specifications from the cited references (from
// memory where the source says so); hist/MinorClamp.ts holds the fight
// numbers between the generic key and the majors' median.
import type { NationCore } from "../types";

const SRC_SHIP =
  "en.wikipedia ship class articles (Conway's All the World's Fighting Ships 1922-1946), from memory; cost scaled from Italian ships by displacement";
const SRC_GUN =
  "en.wikipedia gun articles, from memory; cost scaled from comparable German and Italian guns";

export const CORE_ROU: NationCore = {
  tag: "ROU",
  // Generals: field commands of 1941-1944. Their first general's rank fell
  // in or before the period; no exact day is kept (none is gated).
  generals: [
    {
      id: "rou_dumitrescu",
      tag: "ROU",
      att: 3,
      def: 3,
      plan: 3,
      log: 2,
      traits: ["infantry_officer"],
      source:
        "en.wikipedia Petre Dumitrescu (general): commanded the Romanian Third Army 1941-1944 (Odessa, the Don bend); never tried",
    },
    {
      id: "rou_constantinescu_claps",
      tag: "ROU",
      att: 2,
      def: 3,
      plan: 3,
      log: 2,
      traits: ["defensive_doctrine"],
      source:
        "en.wikipedia Constantin Constantinescu-Claps: commanded the Romanian Fourth Army 1942-1943 south of Stalingrad",
    },
    {
      id: "rou_dumitrache",
      tag: "ROU",
      att: 3,
      def: 3,
      plan: 2,
      log: 2,
      traits: ["offensive_doctrine"],
      source:
        "en.wikipedia Ioan Dumitrache: commanded the 2nd Mountain Division, took Nalchik in 1942; Knight's Cross",
    },
    {
      id: "rou_racovita",
      tag: "ROU",
      att: 3,
      def: 2,
      plan: 2,
      log: 2,
      traits: ["cavalry_officer"],
      source:
        "en.wikipedia Mihail Racoviță: commanded the Cavalry Corps 1941-1943, Minister of War after the 1944 turn",
    },
    {
      id: "rou_lascar",
      tag: "ROU",
      att: 3,
      def: 3,
      plan: 2,
      log: 2,
      traits: ["infantry_officer"],
      source:
        "en.wikipedia Mihail Lascăr: commanded the 6th Infantry Division and the Lascăr group at Stalingrad; Knight's Cross",
    },
  ],
  // Negative: the Crown (Carol II's camarilla, the royal dictatorship);
  // positive: the Legion of the Archangel Michael (Iron Guard). The Legion
  // grows by itself (+1 ‰ a day) unless the crown acts; the balance ends
  // with the government that started it.
  bop: [
    {
      tag: "ROU",
      startPm: 0,
      spirits: [
        "rou_bop_royal_dictatorship",
        "rou_bop_crown_holds",
        "rou_bop_uneasy_balance",
        "rou_bop_legion_streets",
        "rou_bop_legion_terror",
      ],
      driftPm: 1,
      endsOnRulingChange: true,
    },
  ],
  equipment: [
    // ------------------------------------------------------------ tanks
    {
      id: "rou_r1",
      country: "ROU",
      family: "tank",
      role: "light",
      techs: ["light_tank_1"],
      year: 1937,
      // ČKD AH-IV-R tankette, 35 bought, two machine guns.
      source:
        "en.wikipedia AH-IV (Romanian R-1: 35 bought from ČKD, 3.9 t, 12 mm, two 7.92 mm MGs, 45 km/h); cost an estimate",
      spec: {
        massT: 3.9,
        hullFrontMm: 12,
        hullSlopeDeg: 0,
        turretFrontMm: 12,
        gunMm: 8,
        penMm500: 0,
        heFillerG: 0,
        mgs: 2,
        offroadKmh: 25,
        roadKmh: 45,
        reliability: 3,
        costK: 9,
      },
    },
    {
      id: "rou_r2",
      country: "ROU",
      family: "tank",
      role: "light",
      techs: ["light_tank_1"],
      staticFor: "light_tank:1",
      year: 1938,
      // Škoda LT vz. 35, 126 bought as the R-2; 37 mm A3 gun.
      source:
        "en.wikipedia Panzer 35(t) / R-2 (Romania): 10.5 t, 25 mm, 37 mm Škoda A3, 34 km/h; penetration from memory; cost an estimate",
      spec: {
        massT: 10.5,
        hullFrontMm: 25,
        hullSlopeDeg: 0,
        turretFrontMm: 25,
        gunMm: 37,
        penMm500: 31,
        heFillerG: 20,
        mgs: 2,
        offroadKmh: 15,
        roadKmh: 34,
        reliability: 3,
        costK: 25,
      },
    },
    {
      id: "rou_tacam_t60",
      country: "ROU",
      family: "tank",
      role: "td",
      techs: ["light_tank_2", "tank_gun_2"],
      year: 1943,
      // A captured T-60 chassis with a 76.2 mm F-22 field gun in an open casemate.
      source:
        "en.wikipedia TACAM T-60: 34 converted at Leonida, 76.2 mm F-22, 35 mm front plus shield; figures from memory",
      spec: {
        massT: 9,
        hullFrontMm: 35,
        hullSlopeDeg: 20,
        gunMm: 76.2,
        penMm500: 55,
        heFillerG: 710,
        mgs: 0,
        offroadKmh: 20,
        roadKmh: 42,
        openTop: true,
        reliability: 3,
        costK: 18,
      },
    },
    {
      id: "rou_tacam_r2",
      country: "ROU",
      family: "tank",
      role: "td",
      techs: ["light_tank_2", "tank_gun_2"],
      year: 1944,
      // The R-2 chassis with a captured 76.2 mm ZiS-3 gun.
      source:
        "en.wikipedia TACAM R-2: 20 converted, 76.2 mm ZiS-3 on the R-2 chassis, open casemate; figures from memory",
      spec: {
        massT: 12,
        hullFrontMm: 25,
        hullSlopeDeg: 0,
        gunMm: 76.2,
        penMm500: 60,
        heFillerG: 710,
        mgs: 1,
        offroadKmh: 15,
        roadKmh: 30,
        openTop: true,
        reliability: 3,
        costK: 25,
      },
    },
    {
      id: "rou_maresal",
      country: "ROU",
      family: "tank",
      role: "td",
      techs: ["light_tank_2", "tank_gun_3", "sloped_armor"],
      year: 1944,
      // M-05/M-06 prototypes: low, steeply sloped, the 75 mm Reșița gun.
      source:
        "en.wikipedia Mareșal tank destroyer: M-05/M-06 prototypes, 10 t, 10-20 mm sloped plates, 75 mm Reșița M1943; figures from memory",
      spec: {
        massT: 10,
        hullFrontMm: 20,
        hullSlopeDeg: 60,
        gunMm: 75,
        penMm500: 90,
        heFillerG: 680,
        mgs: 1,
        offroadKmh: 30,
        roadKmh: 45,
        reliability: 3,
        costK: 20,
      },
    },
    // ------------------------------------------------------------ planes
    {
      id: "rou_pzl_p11f",
      country: "ROU",
      family: "plane",
      type: "fighter",
      techs: ["fighter_1"],
      year: 1937,
      // PZL P.11f built under licence at IAR Brașov.
      source:
        "en.wikipedia PZL P.11 (P.11f: IAR licence, Gnome-Rhône 9K, 390 km/h, two 7.92 mm MGs); other figures from memory",
      spec: {
        maxKmh: 390,
        rangeKm: 700,
        emptyKg: 1150,
        wingLoad: 92,
        guns: [{ mm: 7.92, count: 2, rpm: 750 }],
        defGuns: 0,
        bombKg: 0,
        torpedoKg: 0,
        reliability: 4,
        costK: 15,
      },
    },
    {
      id: "rou_pzl_p24e",
      country: "ROU",
      family: "plane",
      type: "fighter",
      techs: ["fighter_1"],
      year: 1937,
      // PZL P.24E built under licence at IAR Brașov.
      source:
        "en.wikipedia PZL P.24 (P.24E: IAR licence, Gnome-Rhône 14N, 430 km/h, four 7.92 mm MGs); other figures from memory",
      spec: {
        maxKmh: 430,
        rangeKm: 700,
        emptyKg: 1330,
        wingLoad: 107,
        guns: [{ mm: 7.92, count: 4, rpm: 750 }],
        defGuns: 0,
        bombKg: 40,
        torpedoKg: 0,
        reliability: 4,
        costK: 18,
      },
    },
    {
      id: "rou_iar80",
      country: "ROU",
      family: "plane",
      type: "fighter",
      techs: ["fighter_2"],
      year: 1941,
      source:
        "en.wikipedia IAR 80: 510 km/h, 730 km, empty 1,780 kg, wing 15.97 m², four 7.92 mm FN MGs; cost an estimate",
      spec: {
        maxKmh: 510,
        rangeKm: 730,
        emptyKg: 1780,
        wingLoad: 143,
        guns: [{ mm: 7.92, count: 4, rpm: 750 }],
        defGuns: 0,
        bombKg: 0,
        torpedoKg: 0,
        reliability: 3,
        costK: 32,
      },
    },
    {
      id: "rou_iar81c",
      country: "ROU",
      family: "plane",
      type: "fighter",
      techs: ["fighter_2", "aircraft_cannon_1"],
      year: 1943,
      source:
        "en.wikipedia IAR 80 (IAR 81C: two 20 mm MG 151/20 and two 7.92 mm MGs, about 515 km/h); other figures from memory",
      spec: {
        maxKmh: 515,
        rangeKm: 730,
        emptyKg: 2100,
        wingLoad: 160,
        guns: [
          { mm: 20, count: 2, rpm: 700 },
          { mm: 7.92, count: 2, rpm: 750 },
        ],
        defGuns: 0,
        bombKg: 0,
        torpedoKg: 0,
        reliability: 3,
        costK: 38,
      },
    },
    {
      id: "rou_iar81",
      country: "ROU",
      family: "plane",
      type: "cas",
      techs: ["cas_1"],
      year: 1941,
      // The dive-bombing IAR 81 with a 225 kg bomb under the fuselage.
      source:
        "en.wikipedia IAR 80 (IAR 81 dive bomber: six 7.92 mm MGs, 225 kg centre bomb plus two 50 kg); other figures from memory",
      spec: {
        maxKmh: 500,
        rangeKm: 940,
        emptyKg: 1960,
        wingLoad: 155,
        guns: [{ mm: 7.92, count: 6, rpm: 750 }],
        defGuns: 0,
        bombKg: 325,
        torpedoKg: 0,
        dive: true,
        reliability: 3,
        costK: 34,
      },
    },
    {
      id: "rou_iar37",
      country: "ROU",
      family: "plane",
      type: "bomber",
      techs: ["bomber_1"],
      year: 1938,
      // Three-seat biplane reconnaissance bomber.
      source:
        "en.wikipedia IAR 37: three-seat biplane, 335 km/h, IAR K14 engine, one fixed and three flexible 7.92 mm MGs; other figures from memory",
      spec: {
        maxKmh: 335,
        rangeKm: 1000,
        emptyKg: 2280,
        wingLoad: 73,
        guns: [{ mm: 7.92, count: 1, rpm: 750 }],
        defGuns: 3,
        bombKg: 300,
        torpedoKg: 0,
        reliability: 3,
        costK: 20,
      },
    },
    {
      id: "rou_jrs79b",
      country: "ROU",
      family: "plane",
      type: "bomber",
      techs: ["bomber_2"],
      year: 1941,
      // Savoia-Marchetti SM.79B twin with Jumo 211 engines, built at IAR.
      source:
        "en.wikipedia Savoia-Marchetti SM.79 (JRS-79B: IAR licence, two Jumo 211D, about 445 km/h, 1,200 kg bombs); other figures from memory",
      spec: {
        maxKmh: 445,
        rangeKm: 1650,
        emptyKg: 7200,
        wingLoad: 178,
        guns: [{ mm: 7.92, count: 1, rpm: 750 }],
        defGuns: 4,
        bombKg: 1200,
        torpedoKg: 0,
        reliability: 3,
        costK: 75,
      },
    },
    // ------------------------------------------------------------ gear
    {
      id: "rou_mannlicher_m1893",
      country: "ROU",
      family: "infantry",
      techs: ["inf_eq_1"],
      staticFor: "infantry_equipment:1",
      year: 1893,
      source:
        "en.wikipedia Mannlicher M1893 (Romanian 6.5 mm rifle, Steyr-made); figures from memory; cost near the Italian Carcano",
      spec: { mm: 6.5, aimedRpm: 12, rangeM: 500, autoPct: 0, costUsd: 22 },
    },
    {
      id: "rou_orita_m1941",
      country: "ROU",
      family: "infantry",
      techs: ["inf_eq_2"],
      year: 1941,
      source:
        "en.wikipedia Orița M1941: 9 mm submachine gun made at Cugir, about 600 rounds a minute; cost scaled from the Beretta M38",
      spec: { mm: 9, aimedRpm: 25, rangeM: 200, autoPct: 10, costUsd: 50 },
    },
    {
      id: "rou_malaxa_ue",
      country: "ROU",
      family: "support",
      techs: ["support_eq_1"],
      year: 1939,
      // Renault UE carrier built under licence by Malaxa, towing anti-tank guns.
      source:
        "en.wikipedia Renault UE (Malaxa Tip UE: about 300 licence-built in Romania); figures from memory; cost an estimate",
      spec: { kind: "transport", rangeKm: 140, costUsd: 3000, reliability: 3 },
    },
    {
      id: "rou_resita_m1943",
      country: "ROU",
      family: "gun",
      role: "anti_tank",
      techs: ["anti_tank_2"],
      year: 1943,
      source:
        "en.wikipedia 75 mm Reșița Model 1943: 1,430 kg, AP near the German PaK 40 at combat ranges; figures from memory",
      spec: {
        mm: 75,
        rpm: 15,
        rangeM: 11000,
        shellKg: 6.6,
        penMm500: 95,
        massKg: 1430,
        barrels: 1,
        costK: 9,
      },
    },
    {
      id: "rou_vickers_75_aa",
      country: "ROU",
      family: "gun",
      role: "anti_air",
      techs: ["anti_air_1"],
      year: 1939,
      // Vickers 75 mm Model 1936/1939 anti-aircraft gun, licence-built at Reșița.
      source: SRC_GUN,
      spec: {
        mm: 75,
        rpm: 15,
        rangeM: 9000,
        shellKg: 6.5,
        penMm500: 0,
        massKg: 3500,
        barrels: 1,
        costK: 14,
      },
    },
    // ------------------------------------------------------------ ships
    {
      id: "rou_marasti",
      country: "ROU",
      family: "ship",
      cls: "dd",
      techs: [],
      year: 1917,
      // Ex-Italian Vifor class, rearmed in the 1920s; 450 mm tubes (warhead noted).
      source: SRC_SHIP,
      spec: {
        dispT: 1400,
        main: { count: 5, mm: 120 },
        beltMm: 0,
        speedKn: 34,
        rangeNm: 1700,
        torpTubes: 4,
        torpWarheadKg: 110,
        asw: 1,
        aaLight: [{ count: 2, mm: 40 }],
        aaHeavy: 2,
        aircraft: 0,
        costM: 3.2,
      },
    },
    {
      id: "rou_regele_ferdinand",
      country: "ROU",
      family: "ship",
      cls: "dd",
      techs: [],
      year: 1930,
      // Two built at Naples to a Thornycroft design.
      source: SRC_SHIP,
      spec: {
        dispT: 1400,
        main: { count: 5, mm: 120 },
        beltMm: 0,
        speedKn: 35,
        rangeNm: 3000,
        torpTubes: 6,
        torpWarheadKg: 250,
        asw: 1,
        aaLight: [{ count: 2, mm: 40 }],
        aaHeavy: 1,
        aircraft: 0,
        costM: 3.8,
      },
    },
    {
      id: "rou_delfinul",
      country: "ROU",
      family: "ship",
      cls: "ss",
      techs: [],
      year: 1936,
      // Built at Fiume; Romania's only submarine until 1943.
      source: SRC_SHIP,
      spec: {
        dispT: 650,
        main: { count: 1, mm: 102 },
        beltMm: 0,
        speedKn: 14,
        rangeNm: 2000,
        torpTubes: 8,
        torpWarheadKg: 270,
        asw: 0,
        aaLight: [],
        aaHeavy: 0,
        aircraft: 0,
        costM: 2.5,
      },
    },
    {
      id: "rou_rechinul",
      country: "ROU",
      family: "ship",
      cls: "ss",
      techs: ["ss_3"],
      year: 1943,
      // Rechinul and Marsuinul, built at Galați to a German design.
      source: SRC_SHIP,
      spec: {
        dispT: 585,
        main: { count: 0, mm: 0 },
        beltMm: 0,
        speedKn: 13,
        rangeNm: 4000,
        torpTubes: 4,
        torpWarheadKg: 280,
        asw: 0,
        aaLight: [{ count: 1, mm: 20 }],
        aaHeavy: 0,
        aircraft: 0,
        costM: 2.6,
      },
    },
  ],
  // Bought abroad in the late 1930s: received (used, not produced).
  startArms: [
    {
      entry: "fra_r35",
      origin: "received",
      count: 41,
      source:
        "en.wikipedia Renault R35 (Romania: 41 delivered 1939 of an order for 200; more came with the interned Polish R35s)",
    },
    {
      entry: "ita_sm79",
      origin: "received",
      count: 24,
      source:
        "en.wikipedia Savoia-Marchetti SM.79 (24 SM.79B with Gnome-Rhône engines bought by Romania 1937-1938)",
    },
    {
      entry: "gbr_hurricane_i",
      origin: "received",
      count: 12,
      source:
        "en.wikipedia Hawker Hurricane (12 Hurricane Mk I delivered to Romania in 1939)",
    },
  ],
};
