// ww229 (design ww227 §5-§6): Bulgaria's generals, its own equipment
// catalogue and the arms it holds at the start. Bulgaria builds little of
// its own: the catalogue is the kingdom's service rifle and field gun, the
// vehicles and aircraft bought for it alone (or built under licence), the
// Kazanlak and Bozhurishte designs and the Black Sea torpedo boats.
// Figures are real specifications from the cited references (from memory
// where the source says so); hist/MinorClamp.ts holds the fight numbers
// between the generic key and the majors' median. No balance of power:
// BGR is not in BOP_TAGS; its mechanisms are decisions and spirits.
import type { NationCore } from "../types";

export const CORE_BGR: NationCore = {
  tag: "BGR",
  // Generals: the war ministers and army commanders of 1936-1945. No first
  // general's rank day is kept (none is gated); `until` only for a death
  // and the People's Court sentences of 1945-02-01.
  generals: [
    {
      id: "bgr_stoychev",
      tag: "BGR",
      att: 3,
      def: 3,
      plan: 3,
      log: 2,
      traits: ["infantry_officer"],
      source:
        "en.wikipedia Vladimir Stoychev: Zveno officer, commanded the Bulgarian First Army in Hungary and Austria 1944-1945",
    },
    {
      id: "bgr_mihov",
      tag: "BGR",
      att: 2,
      def: 3,
      plan: 3,
      log: 2,
      traits: ["defensive_doctrine"],
      until: "1945-02-01",
      source:
        "en.wikipedia Nikola Mihov: lieutenant general, Minister of War 1942-1943, regent 1943-1944; sentenced by the People's Court 1945-02-01",
    },
    {
      id: "bgr_gen_lukov",
      tag: "BGR",
      att: 2,
      def: 2,
      plan: 3,
      log: 2,
      traits: ["organizer"],
      until: "1943-02-13",
      source:
        "en.wikipedia Hristo Lukov: lieutenant general, Minister of War 1935-1938, leader of the Union of Bulgarian National Legions; shot 1943-02-13",
    },
    {
      id: "bgr_gen_daskalov",
      tag: "BGR",
      att: 2,
      def: 3,
      plan: 2,
      log: 3,
      traits: ["logistics_wizard"],
      source:
        "en.wikipedia Teodosi Daskalov: lieutenant general, Minister of War 1938-1941 during the rearmament after the Salonika agreement; from memory",
    },
    {
      id: "bgr_stanchev",
      tag: "BGR",
      att: 3,
      def: 2,
      plan: 2,
      log: 2,
      traits: ["mountaineer"],
      source:
        "en.wikipedia Kiril Stanchev: Zveno officer, commanded the Bulgarian Second Army in the autumn 1944 campaign through Niš and Kosovo; from memory",
    },
  ],
  bop: [],
  equipment: [
    // ----------------------------------------------------------- infantry
    {
      id: "bgr_mannlicher_m95",
      country: "BGR",
      family: "infantry",
      techs: ["inf_eq_1"],
      staticFor: "infantry_equipment:1",
      year: 1903,
      // Steyr straight-pull rifle, bought for Bulgaria from 1903 and
      // rechambered for the 8x56R round in the 1930s.
      source:
        "en.wikipedia Mannlicher M1895 (Bulgarian contracts, 8x50R then 8x56R); rate of fire from memory; cost near the Italian Carcano",
      spec: { mm: 8, aimedRpm: 14, rangeM: 500, autoPct: 0, costUsd: 22 },
    },
    // --------------------------------------------------------------- guns
    {
      id: "bgr_schneider_75_m1904",
      country: "BGR",
      family: "gun",
      role: "artillery",
      techs: ["artillery_1"],
      year: 1904,
      // The quick-firing field gun Bulgaria chose from Schneider in 1904
      // over Krupp's offer; still the divisional gun of the 1930s.
      source:
        "en.wikipedia Schneider-Canet 75 mm M1904 in Bulgarian service; range, shell and weight from memory; cost scaled from the Italian 75/27",
      spec: {
        mm: 75,
        rpm: 6,
        rangeM: 8500,
        shellKg: 6.5,
        penMm500: 0,
        massKg: 1050,
        barrels: 1,
        costK: 6,
      },
    },
    // -------------------------------------------------------------- tanks
    {
      id: "bgr_vickers_mk_e",
      country: "BGR",
      family: "tank",
      role: "light",
      techs: ["light_tank_1"],
      staticFor: "light_tank:1",
      year: 1938,
      // Vickers 6-ton Type B, eight bought: the first real tanks of the
      // Bulgarian army, with the low-velocity 47 mm 3-pounder.
      source:
        "en.wikipedia Vickers 6-ton (Type B: 7.3 t, 13 mm, 47 mm OQF 3-pdr, 35 km/h; 8 to Bulgaria 1938); penetration and cost from memory",
      spec: {
        massT: 7.3,
        hullFrontMm: 13,
        hullSlopeDeg: 0,
        turretFrontMm: 13,
        gunMm: 47,
        penMm500: 20,
        heFillerG: 90,
        mgs: 1,
        offroadKmh: 20,
        roadKmh: 35,
        reliability: 4,
        costK: 15,
      },
    },
    // ------------------------------------------------------------- planes
    {
      id: "bgr_pzl_p24b",
      country: "BGR",
      family: "plane",
      type: "fighter",
      techs: ["fighter_1"],
      year: 1937,
      // The Bulgarian export model of the P.24, fourteen bought.
      source:
        "en.wikipedia PZL P.24 (P.24B for Bulgaria, 14 delivered 1937; Gnome-Rhône 14K, about 430 km/h); armament and weights from memory",
      spec: {
        maxKmh: 430,
        rangeKm: 700,
        emptyKg: 1330,
        wingLoad: 107,
        guns: [
          { mm: 20, count: 2, rpm: 520 },
          { mm: 7.92, count: 2, rpm: 1000 },
        ],
        defGuns: 0,
        bombKg: 0,
        torpedoKg: 0,
        reliability: 4,
        costK: 22,
      },
    },
    {
      id: "bgr_avia_b135",
      country: "BGR",
      family: "plane",
      type: "fighter",
      techs: ["fighter_2"],
      year: 1940,
      // Avia's low-wing fighter, built for Bulgaria only: twelve delivered
      // and a licence for the Lovech works.
      source:
        "en.wikipedia Avia B-135 (Hispano-Suiza 12Y, about 535 km/h, 20 mm motor cannon and two 7.92 mm MGs; 12 to Bulgaria, licence for Lovech); weights from memory",
      spec: {
        maxKmh: 535,
        rangeKm: 550,
        emptyKg: 1630,
        wingLoad: 140,
        guns: [
          { mm: 20, count: 1, rpm: 520 },
          { mm: 7.92, count: 2, rpm: 1000 },
        ],
        defGuns: 0,
        bombKg: 0,
        torpedoKg: 0,
        reliability: 3,
        costK: 30,
      },
    },
    {
      id: "bgr_dar3_garvan",
      country: "BGR",
      family: "plane",
      type: "cas",
      techs: [],
      year: 1930,
      // Bozhurishte's reconnaissance and light-bomber biplane, the staple of
      // the hidden air arm before 1937.
      source:
        "en.wikipedia DAR 3 Garvan (Bulgarian two-seat reconnaissance biplane, about 40 built); all figures from memory, mid values",
      spec: {
        maxKmh: 230,
        rangeKm: 700,
        emptyKg: 1100,
        wingLoad: 55,
        guns: [{ mm: 7.7, count: 1, rpm: 600 }],
        defGuns: 1,
        bombKg: 150,
        torpedoKg: 0,
        reliability: 3,
        costK: 10,
      },
    },
    {
      id: "bgr_pzl43_chaika",
      country: "BGR",
      family: "plane",
      type: "cas",
      techs: ["cas_1"],
      staticFor: "cas:1",
      year: 1937,
      // The PZL.23 Karaś rebuilt for Bulgaria with a bigger radial engine.
      source:
        "en.wikipedia PZL.23 Karaś (PZL.43A Čajka: Gnome-Rhône 14N, about 365 km/h, 700 kg of bombs; about 50 for Bulgaria); weights from memory",
      spec: {
        maxKmh: 365,
        rangeKm: 1250,
        emptyKg: 2050,
        wingLoad: 130,
        guns: [{ mm: 7.92, count: 2, rpm: 1000 }],
        defGuns: 2,
        bombKg: 700,
        torpedoKg: 0,
        reliability: 3,
        costK: 32,
      },
    },
    {
      id: "bgr_kb11_fazan",
      country: "BGR",
      family: "plane",
      type: "cas",
      techs: ["cas_2"],
      year: 1941,
      // Kazanlak's own reconnaissance and light bomber.
      source:
        "en.wikipedia Kaproni-Bulgarski KB-11 Fazan (Kazanlak, reconnaissance and light bomber of the early 1940s); all figures from memory, uncertain",
      spec: {
        maxKmh: 330,
        rangeKm: 1000,
        emptyKg: 1900,
        wingLoad: 110,
        guns: [{ mm: 7.92, count: 2, rpm: 1000 }],
        defGuns: 1,
        bombKg: 300,
        torpedoKg: 0,
        reliability: 3,
        costK: 28,
      },
    },
    // -------------------------------------------------------------- ships
    {
      id: "bgr_drazki",
      country: "BGR",
      family: "ship",
      cls: "dd",
      techs: [],
      year: 1908,
      // The French-built torpedo boats Neuilly let Bulgaria keep.
      source:
        "en.wikipedia Bulgarian torpedo boat Drazki (Drazki class, about 100 t, 26 kn, three 450 mm tubes); armament and cost from memory",
      spec: {
        dispT: 97,
        main: { count: 2, mm: 47 },
        beltMm: 0,
        speedKn: 26,
        rangeNm: 500,
        torpTubes: 3,
        torpWarheadKg: 100,
        asw: 0,
        aaLight: [],
        aaHeavy: 0,
        aircraft: 0,
        costM: 0.3,
      },
    },
  ],
  startArms: [
    {
      entry: "ita_cv33",
      origin: "received",
      count: 14,
      source:
        "en.wikipedia L3/33: Bulgaria bought 14 in 1934-1935, its first armoured unit",
    },
    {
      entry: "deu_he51",
      origin: "received",
      count: 12,
      source:
        "en.wikipedia Heinkel He 51: twelve delivered to Bulgaria in 1936, from memory",
    },
  ],
};
