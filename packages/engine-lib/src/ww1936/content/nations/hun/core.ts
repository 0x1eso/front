// ww229 (design ww227 §5-§6): HUN's generals, balance of power, own
// equipment and start arms, read before the content.
//
// Equipment: real specifications, from memory of the Wikipedia articles on
// each vehicle, aircraft and gun (nothing checked against a printed
// reference; where recalled figures differ a middle value is used). Costs
// are 1940 US dollars of industrial effort scaled from comparable items of
// the majors' catalogues, as in hist/ita.ts. The game's numbers come from the
// conversions and are clamped between the generic key and the majors' median
// (hist/MinorClamp.ts).
import type { NationCore } from "../types";

const SRC_TANK =
  "Wikipedia vehicle articles (and hu.wikipedia), from memory; cost scaled from the Italian and US tanks of the catalogue";
const SRC_AIR =
  "Wikipedia aircraft articles, from memory; cost scaled from the Italian and German aircraft of the catalogue";

export const CORE_HUN: NationCore = {
  tag: "HUN",
  // No dates: the roster's dates are arrests, and none of these men was
  // arrested before the end of the war.
  generals: [
    {
      id: "hun_werth",
      tag: "HUN",
      att: 3,
      def: 2,
      plan: 3,
      log: 2,
      traits: ["offensive_doctrine"],
      source:
        "en.wikipedia Henrik Werth: Chief of the General Staff 1938-1941, urged the war on the Soviet Union; died in Soviet captivity 1952",
    },
    {
      id: "hun_szombathelyi",
      tag: "HUN",
      att: 2,
      def: 3,
      plan: 4,
      log: 3,
      traits: ["defensive_doctrine"],
      source:
        "en.wikipedia Ferenc Szombathelyi: corps and occupation commands in the east 1941, Chief of the General Staff 1941-1944",
    },
    {
      id: "hun_jany",
      tag: "HUN",
      att: 2,
      def: 3,
      plan: 2,
      log: 2,
      traits: ["infantry_officer"],
      source:
        "en.wikipedia Gusztáv Jány: commander of the Second Army on the Don 1942-1943",
    },
    {
      id: "hun_miklos",
      tag: "HUN",
      att: 3,
      def: 2,
      plan: 3,
      log: 3,
      traits: ["cavalry_officer"],
      source:
        "en.wikipedia Béla Miklós: commander of the Rapid Corps 1941, the First Army 1944; head of the provisional government 1944-1945",
    },
    {
      id: "hun_lakatos",
      tag: "HUN",
      att: 2,
      def: 4,
      plan: 3,
      log: 3,
      traits: ["defensive_doctrine", "mountaineer"],
      source:
        "en.wikipedia Géza Lakatos: commanded the First Army in the Carpathians 1944, Prime Minister 1944-08 to 1944-10",
    },
    {
      id: "hun_veress",
      tag: "HUN",
      att: 3,
      def: 3,
      plan: 2,
      log: 3,
      traits: ["cavalry_officer"],
      source:
        "en.wikipedia Lajos Dálnoki Veress: led the 1st Cavalry Division, then the Second Army in Transylvania 1944",
    },
  ],
  bop: [],
  equipment: [
    // ------------------------------------------------------------ tanks
    {
      id: "hun_csaba",
      country: "HUN",
      family: "tank",
      role: "light",
      techs: ["light_tank_1"],
      year: 1940,
      // 39M Csaba armoured car (Weiss Manfréd, Straussler design): 5.95 t,
      // 9-13 mm plate, 20 mm 36M anti-tank rifle and an 8 mm machine gun,
      // 65 km/h on the road.
      source: SRC_TANK,
      spec: {
        massT: 5.95,
        hullFrontMm: 13,
        hullSlopeDeg: 20,
        turretFrontMm: 9,
        gunMm: 20,
        penMm500: 14,
        heFillerG: 0,
        mgs: 1,
        offroadKmh: 35,
        roadKmh: 65,
        wheeled: true,
        reliability: 3,
        costK: 15,
      },
    },
    {
      id: "hun_toldi_i",
      country: "HUN",
      family: "tank",
      role: "light",
      techs: ["light_tank_1"],
      staticFor: "light_tank:1",
      year: 1940,
      // 38M Toldi I (Landsverk L-60 licence, MÁVAG and Ganz): 8.5 t, 13 mm
      // front, 20 mm 36M anti-tank rifle and an 8 mm machine gun, 50 km/h.
      source: SRC_TANK,
      spec: {
        massT: 8.5,
        hullFrontMm: 13,
        hullSlopeDeg: 0,
        turretFrontMm: 13,
        gunMm: 20,
        penMm500: 14,
        heFillerG: 0,
        mgs: 1,
        offroadKmh: 25,
        roadKmh: 50,
        reliability: 3,
        costK: 20,
      },
    },
    {
      id: "hun_toldi_iia",
      country: "HUN",
      family: "tank",
      role: "light",
      techs: ["light_tank_2"],
      year: 1942,
      // 38M Toldi IIa: rebuilt with the 40 mm 42M gun and added plate,
      // 9.35 t, 23 mm front, 35 mm turret; about 47 km/h.
      source: SRC_TANK,
      spec: {
        massT: 9.35,
        hullFrontMm: 23,
        hullSlopeDeg: 0,
        turretFrontMm: 35,
        gunMm: 40,
        penMm500: 36,
        heFillerG: 60,
        mgs: 1,
        offroadKmh: 25,
        roadKmh: 47,
        reliability: 3,
        costK: 24,
      },
    },
    {
      id: "hun_turan_i",
      country: "HUN",
      family: "tank",
      role: "medium",
      techs: ["medium_tank_1"],
      year: 1942,
      // 40M Turán I (Škoda T-21 licence): 18.2 t, 50 mm riveted front, 40 mm
      // 41M gun, two 8 mm machine guns, 47 km/h; engine and gearbox trouble.
      source: SRC_TANK,
      spec: {
        massT: 18.2,
        hullFrontMm: 50,
        hullSlopeDeg: 10,
        turretFrontMm: 50,
        gunMm: 40,
        penMm500: 40,
        heFillerG: 60,
        mgs: 2,
        offroadKmh: 25,
        roadKmh: 47,
        reliability: 2,
        costK: 40,
      },
    },
    {
      id: "hun_turan_ii",
      country: "HUN",
      family: "tank",
      role: "medium",
      techs: ["medium_tank_2"],
      year: 1943,
      // 41M Turán II: the same hull with a short 75 mm 41M gun (L/25) in a
      // larger turret, 19.2 t, 43 km/h.
      source: SRC_TANK,
      spec: {
        massT: 19.2,
        hullFrontMm: 50,
        hullSlopeDeg: 10,
        turretFrontMm: 50,
        gunMm: 75,
        penMm500: 35,
        heFillerG: 600,
        mgs: 2,
        offroadKmh: 22,
        roadKmh: 43,
        reliability: 2,
        costK: 45,
      },
    },
    {
      id: "hun_nimrod",
      country: "HUN",
      family: "tank",
      role: "spaa",
      techs: ["light_tank_2", "anti_air_1"],
      year: 1940,
      // 40M Nimród (Landsverk L-62 licence): 10.5 t, 13 mm front, open turret
      // with the 40 mm 36M Bofors gun (about 120 rounds a minute), 60 km/h;
      // used against tanks as well as aircraft.
      source: SRC_TANK,
      spec: {
        massT: 10.5,
        hullFrontMm: 13,
        hullSlopeDeg: 0,
        turretFrontMm: 10,
        gunMm: 40,
        penMm500: 40,
        heFillerG: 90,
        mgs: 0,
        offroadKmh: 35,
        roadKmh: 60,
        openTop: true,
        reliability: 3,
        costK: 28,
        aa: { barrels: 1, rpm: 120, mm: 40 },
      },
    },
    {
      id: "hun_zrinyi_ii",
      country: "HUN",
      family: "tank",
      role: "spa",
      techs: ["medium_tank_2", "artillery_2"],
      year: 1943,
      // 43M Zrínyi II assault howitzer on the Turán hull: 21.5 t, 75 mm
      // front, 105 mm 40/43M howitzer (L/20.5) in a casemate, no machine
      // gun, 40 km/h.
      source: SRC_TANK,
      spec: {
        massT: 21.5,
        hullFrontMm: 75,
        hullSlopeDeg: 15,
        gunMm: 105,
        penMm500: 0,
        heFillerG: 1500,
        mgs: 0,
        offroadKmh: 22,
        roadKmh: 40,
        reliability: 3,
        costK: 50,
      },
    },
    // ------------------------------------------------------------ planes
    {
      id: "hun_wm21",
      country: "HUN",
      family: "plane",
      type: "cas",
      techs: ["cas_1"],
      year: 1938,
      // Weiss Manfréd WM-21 Sólyom: two-seat reconnaissance and light bomber
      // biplane, about 320 km/h, two fixed 8 mm and one flexible gun,
      // light bombs.
      source: SRC_AIR,
      spec: {
        maxKmh: 320,
        rangeKm: 900,
        emptyKg: 1650,
        wingLoad: 80,
        guns: [{ mm: 8, count: 2, rpm: 900 }],
        defGuns: 1,
        bombKg: 300,
        torpedoKg: 0,
        reliability: 3,
        costK: 16,
      },
    },
    {
      id: "hun_heja",
      country: "HUN",
      family: "plane",
      type: "fighter",
      techs: ["fighter_1"],
      year: 1940,
      // MÁVAG Héja (Reggiane Re.2000 licence, WM K-14 engine): about
      // 520 km/h, two 12.7 mm Gebauer guns; the Re.2000's long range.
      source: SRC_AIR,
      spec: {
        maxKmh: 520,
        rangeKm: 1100,
        emptyKg: 2090,
        wingLoad: 141,
        guns: [{ mm: 12.7, count: 2, rpm: 800 }],
        defGuns: 0,
        bombKg: 0,
        torpedoKg: 0,
        reliability: 3,
        costK: 38,
      },
    },
    {
      id: "hun_me210ca",
      country: "HUN",
      family: "plane",
      type: "heavy_fighter",
      techs: ["heavy_fighter_1"],
      year: 1943,
      // Me 210 Ca-1 built by Danubius under licence (DB 605 engines): about
      // 560 km/h, two 20 mm and two 7.92 mm forward guns, two remote 13 mm
      // barbettes, up to 1,000 kg of bombs; a troubled design.
      source: SRC_AIR,
      spec: {
        maxKmh: 560,
        rangeKm: 1800,
        emptyKg: 7000,
        wingLoad: 250,
        guns: [
          { mm: 20, count: 2, rpm: 700 },
          { mm: 7.92, count: 2, rpm: 1100 },
        ],
        defGuns: 2,
        bombKg: 1000,
        torpedoKg: 0,
        reliability: 2,
        costK: 110,
      },
    },
    // ------------------------------------------------------------ gear
    {
      id: "hun_35m_rifle",
      country: "HUN",
      family: "infantry",
      techs: ["inf_eq_1"],
      year: 1935,
      // 35M rifle (FÉG Budapest): Mannlicher-type turnbolt in 8x56R, about
      // 12 aimed rounds a minute.
      source:
        "Wikipedia, 35M rifle, from memory; cost a guess near the Carcano and the US 1903 rifle",
      spec: { mm: 8, aimedRpm: 12, rangeM: 550, autoPct: 0, costUsd: 22 },
    },
    {
      id: "hun_39m_kiraly",
      country: "HUN",
      family: "infantry",
      techs: ["inf_eq_2"],
      year: 1939,
      // Danuvia 39M (Király): 9x25 mm Mauser submachine gun with a long
      // barrel, about 750 rounds a minute cyclic; issued to about one man
      // in ten.
      source:
        "Wikipedia, Danuvia 39M, from memory; cost scaled from the Beretta M38 of the catalogue",
      spec: { mm: 9, aimedRpm: 25, rangeM: 250, autoPct: 10, costUsd: 58 },
    },
    {
      id: "hun_botond",
      country: "HUN",
      family: "support",
      techs: ["motorized_1"],
      staticFor: "motorized:1",
      year: 1938,
      // Weiss Manfréd 38M Botond: three-axle cross-country lorry of about
      // 1.5 t payload, range about 400 km; robust.
      source:
        "Wikipedia, 38M Botond, from memory; cost scaled from US 1.5-ton trucks",
      spec: { kind: "transport", rangeKm: 400, costUsd: 1600, reliability: 4 },
    },
    {
      id: "hun_36m_40mm",
      country: "HUN",
      family: "gun",
      role: "anti_air",
      techs: ["anti_air_1"],
      year: 1938,
      // 40 mm 36M (Bofors L/60 licence, MÁVAG): about 120 rounds a minute,
      // effective ceiling about 3,800 m, 0.9 kg shell, about 2,000 kg.
      source:
        "Wikipedia, Bofors 40 mm L/60 (Hungarian licence 36M), from memory; cost from the Bofors 40 mm of the US catalogue",
      spec: {
        mm: 40,
        rpm: 120,
        rangeM: 3800,
        shellKg: 0.9,
        penMm500: 0,
        massKg: 2000,
        barrels: 1,
        costK: 10,
      },
    },
  ],
  startArms: [
    {
      entry: "ita_cv33",
      origin: "received",
      count: 110,
      source:
        "en.wikipedia L3/35 operators: Hungary bought the Italian tankettes 1934-1936 (sources give 65 to about 150; a middle value)",
    },
    {
      entry: "ita_cr32",
      origin: "received",
      count: 52,
      source:
        "en.wikipedia Fiat CR.32 operators: Hungary received 52 in 1936, more followed",
    },
  ],
};
