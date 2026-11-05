// World War 1936 historical catalogue: Italy. Written to the format of
// deu.ts (see Types.ts).
//
// Conventions: armour in mm, slope from the vertical, penetration at 500 m /
// 30 degrees with the normal AP round. Reliability 1..5 from the history.
// Italy's weak tanks stay weak: thin armour, small guns.
//
// Costs (rebased in the ww66 audit) are 1940 US dollars of industrial effort, NOT lire at an exchange
// rate. Each is scaled by weight, complexity and materials from a comparable
// American item, with Italian small-batch, labour-heavy production adding to
// it. The American reference prices are FROM MEMORY and approximate: M3 Stuart
// about $33k (12.5 t), M4 about $45k, M8 armoured car about $20k, P-40 about
// $45k, B-25 about $140k, B-17 about $205-240k, C-47 about $90k, Fletcher
// destroyer about $6.5M, Brooklyn cruiser about $20M, New Orleans cruiser
// about $21M, North Carolina about $76M, Wasp carrier about $36M, Gato
// submarine about $4.5M, 105 mm M2 howitzer about $8k, Bofors 40 mm about
// $10k. Lire figures found by web search, used only as a cross-check:
// MC.202 525,000 lire and Re.2001 600,000 lire, with 22,000 man-hours per
// MC.202 against 4,500-6,000 for a Bf 109E/F (encyclopedia.pub, a
// Wikipedia-derived entry; it gives no primary source); SM.79 about
// 1.7 million lire (a photo caption on ww2incolor.com, weak); Littorio class
// about 850 million lire a ship (warhistory.org, "Italian Navy 1940"). No
// price was found for the M13/40.
//
// Specifications are from memory of the Wikipedia articles on each vehicle,
// aircraft, gun and ship class; nothing here was checked against a printed
// reference. Where recalled figures differ a middle value is used and noted.
// Heavy-fighter and carrier-aircraft roles are empty: Italy had no such
// types in service.
import type { HistEntry } from "./Types";

const SRC_TANK =
  "Wikipedia vehicle articles, from memory; cost scaled from US tanks";
const SRC_AIR =
  "Wikipedia aircraft articles, from memory; cost scaled from US aircraft, lire cross-check in the file header";
const SRC_SHIP =
  "Wikipedia ship class articles, from memory; cost scaled from US ships by displacement";
const SRC_GUN = "Wikipedia gun articles, from memory; cost scaled from US guns";

export const ITA_HIST: readonly HistEntry[] = [
  // ------------------------------------------------------------ tanks
  {
    id: "ita_cv33",
    country: "ITA",
    family: "tank",
    role: "light",
    techs: ["light_tank_1"],
    year: 1933,
    // CV.33 / L3/33 tankette: 3.2 t, 13.5 mm riveted plate, two 8 mm Fiat
    // machine guns, no turret; cost from the M3 Stuart by weight.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_TANK,
    spec: {
      massT: 3.2,
      hullFrontMm: 13.5,
      hullSlopeDeg: 0,
      gunMm: 8,
      penMm500: 0,
      heFillerG: 0,
      mgs: 2,
      offroadKmh: 20,
      roadKmh: 42,
      reliability: 3,
      costK: 9,
    },
  },
  {
    id: "ita_ab41",
    country: "ITA",
    family: "tank",
    role: "light",
    techs: ["light_tank_2", "tank_drive_2"],
    year: 1941,
    // Autoblindo AB 41: 7.4 t armoured car, 40 mm front plate, 20 mm Breda
    // 35 (about 20 mm at 500 m), two 8 mm machine guns, 78 km/h on the road.
    source: SRC_TANK,
    spec: {
      massT: 7.4,
      hullFrontMm: 40,
      hullSlopeDeg: 15,
      turretFrontMm: 30,
      gunMm: 20,
      penMm500: 20,
      heFillerG: 4,
      mgs: 2,
      offroadKmh: 30,
      roadKmh: 78,
      wheeled: true,
      reliability: 4,
      costK: 16,
    },
  },
  {
    id: "ita_l6_40",
    country: "ITA",
    family: "tank",
    role: "light",
    techs: ["light_tank_2"],
    year: 1940,
    // L6/40: 6.8 t, 30 mm front, 20 mm Breda 35 L/65 and one 8 mm.
    source: SRC_TANK,
    spec: {
      massT: 6.8,
      hullFrontMm: 30,
      hullSlopeDeg: 0,
      turretFrontMm: 30,
      gunMm: 20,
      penMm500: 20,
      heFillerG: 4,
      mgs: 1,
      offroadKmh: 25,
      roadKmh: 42,
      reliability: 3,
      costK: 19,
    },
  },
  {
    id: "ita_m11_39",
    country: "ITA",
    family: "tank",
    role: "medium",
    techs: ["medium_tank_1"],
    year: 1939,
    // M11/39: 11 t, 30 mm front, the 37 mm Vickers-Terni gun fixed in the
    // hull (about 24 mm at 500 m), turret with two 8 mm; diesel; poor.
    // Audit w66: Poor in the desert: reliability 2.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_TANK,
    spec: {
      massT: 11,
      hullFrontMm: 30,
      hullSlopeDeg: 0,
      turretFrontMm: 30,
      gunMm: 37,
      penMm500: 24,
      heFillerG: 20,
      mgs: 2,
      offroadKmh: 20,
      roadKmh: 32,
      diesel: true,
      reliability: 2,
      costK: 30,
    },
  },
  {
    id: "ita_m13_40",
    country: "ITA",
    family: "tank",
    role: "medium",
    techs: ["medium_tank_1"],
    year: 1940,
    // M13/40: 14 t, 30 mm hull and 40 mm turret front, 47/32 gun (sources
    // give 30-43 mm at 500 m, 38 used), four 8 mm; diesel, cramped, sound.
    // Audit w66: Weak engine, filter trouble in the desert: reliability 2; the M14/41 fixed part of it.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source:
      "Checked 2026-11-04 on Wikipedia: M13/40 (14 t, 31.8 km/h road, 47/32). Other figures from memory; cost an estimate unless stated.",
    spec: {
      massT: 14,
      hullFrontMm: 30,
      hullSlopeDeg: 0,
      turretFrontMm: 40,
      gunMm: 47,
      penMm500: 38,
      heFillerG: 60,
      mgs: 4,
      offroadKmh: 20,
      roadKmh: 32,
      diesel: true,
      reliability: 2,
      costK: 34,
    },
  },
  {
    id: "ita_m14_41",
    country: "ITA",
    family: "tank",
    role: "medium",
    techs: ["medium_tank_1"],
    year: 1941,
    // M14/41: the M13/40 with a 145 hp diesel and sand filters; same armour
    // and gun.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_TANK,
    spec: {
      massT: 14.5,
      hullFrontMm: 30,
      hullSlopeDeg: 0,
      turretFrontMm: 40,
      gunMm: 47,
      penMm500: 38,
      heFillerG: 60,
      mgs: 4,
      offroadKmh: 21,
      roadKmh: 33,
      diesel: true,
      reliability: 3,
      costK: 36,
    },
  },
  {
    id: "ita_m15_42",
    country: "ITA",
    family: "tank",
    role: "medium",
    techs: ["medium_tank_2", "tank_gun_2"],
    year: 1943,
    // M15/42: 15.5 t, 45 mm front, longer 47/40 gun (about 50 mm at 500 m),
    // 192 hp petrol engine; few were built before the armistice.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_TANK,
    spec: {
      massT: 15.5,
      hullFrontMm: 45,
      hullSlopeDeg: 0,
      turretFrontMm: 45,
      gunMm: 47,
      penMm500: 50,
      heFillerG: 60,
      mgs: 4,
      offroadKmh: 24,
      roadKmh: 40,
      reliability: 3,
      costK: 40,
    },
  },
  {
    id: "ita_p26_40",
    country: "ITA",
    family: "tank",
    role: "medium",
    techs: ["medium_tank_2", "tank_gun_2"],
    year: 1943,
    // P26/40 ("heavy" by name, 26 t in fact): 50 mm sloped hull front,
    // 60 mm turret, 75/34 gun (about 70 mm at 500 m); only a handful built
    // by the armistice; the price is an estimate.
    // Audit w66: 75/34 set to 65 mm beside the US 75 mm M3 at 68 (lower velocity); the P26/40 was a diesel.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source:
      "Checked 2026-11-04 on Wikipedia: P26/40 (26 t, hull 50, turret 60 mm, 40/25 km/h, 75/34). Other figures from memory; cost an estimate unless stated.",
    spec: {
      diesel: true,
      massT: 26,
      hullFrontMm: 50,
      hullSlopeDeg: 30,
      turretFrontMm: 60,
      gunMm: 75,
      penMm500: 65,
      heFillerG: 600,
      mgs: 2,
      offroadKmh: 25,
      roadKmh: 40,
      reliability: 3,
      costK: 62,
    },
  },
  {
    id: "ita_semovente_47_32",
    country: "ITA",
    family: "tank",
    role: "td",
    techs: ["light_tank_2", "tank_drive_2"],
    year: 1942,
    // Semovente L40 da 47/32: 6.5 t, the 47/32 in an open-topped casemate on
    // the L6/40 chassis, 30 mm front.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_TANK,
    spec: {
      massT: 6.5,
      hullFrontMm: 30,
      hullSlopeDeg: 0,
      gunMm: 47,
      penMm500: 38,
      heFillerG: 60,
      mgs: 0,
      offroadKmh: 25,
      roadKmh: 42,
      openTop: true,
      reliability: 3,
      costK: 16,
    },
  },
  {
    id: "ita_semovente_75_18",
    country: "ITA",
    family: "tank",
    role: "td",
    techs: ["medium_tank_1", "tank_gun_2"],
    year: 1941,
    // Semovente da 75/18 on the M40/M41 chassis: 13.8 t, 50 mm front, short
    // 75/18 howitzer; its HEAT round (1942) pierces about 70 mm at any range
    // but with low velocity, so 50 mm is used as a middle. Reliable.
    // Audit w66: 13.1 t (Wikipedia); on the diesel M14/41 chassis.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source:
      "Checked 2026-11-04 on Wikipedia: Semovente da 75/18 (13.1 t, 75/18). Other figures from memory; cost an estimate unless stated.",
    spec: {
      diesel: true,
      massT: 13.1,
      hullFrontMm: 50,
      hullSlopeDeg: 10,
      gunMm: 75,
      penMm500: 50,
      heFillerG: 650,
      mgs: 1,
      offroadKmh: 20,
      roadKmh: 32,
      reliability: 4,
      costK: 32,
    },
  },
  {
    id: "ita_semovente_75_34",
    country: "ITA",
    family: "tank",
    role: "td",
    techs: ["medium_tank_2", "tank_gun_2"],
    year: 1943,
    // Semovente da 75/34 on the M42M chassis: 15 t, 50 mm front, 75/34 gun
    // (about 70 mm at 500 m).
    // Audit w66: 75/34: same gun as the P26/40.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_TANK,
    spec: {
      massT: 15,
      hullFrontMm: 50,
      hullSlopeDeg: 10,
      gunMm: 75,
      penMm500: 65,
      heFillerG: 600,
      mgs: 1,
      offroadKmh: 22,
      roadKmh: 40,
      reliability: 4,
      costK: 36,
    },
  },
  {
    id: "ita_semovente_90_53",
    country: "ITA",
    family: "tank",
    role: "td",
    techs: ["medium_tank_2", "tank_gun_3"],
    year: 1942,
    // Semovente da 90/53: the AA gun in a thin open mount on the M41 chassis
    // (30 mm front); about 30 built. 90/53 AP: sources give 100-140 mm at
    // 500 m, 120 mm used.
    // Audit w66: 90/53 quoted at 140 mm at 500 m without an angle (Wikipedia); 112 at 30 deg by the same ratio as the D-25T's 150/120; between the 88 L/56 at 110 and the 90 mm M3 at 125.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source:
      "Checked 2026-11-04 on Wikipedia: Cannone da 90/53 (AP 140 mm at 500 m, 120 at 1,000 m, angle not given); 112 at 30 deg by ratio. Other figures from memory; cost an estimate unless stated.",
    spec: {
      diesel: true,
      massT: 16,
      hullFrontMm: 30,
      hullSlopeDeg: 0,
      gunMm: 90,
      penMm500: 112,
      heFillerG: 1000,
      mgs: 0,
      offroadKmh: 18,
      roadKmh: 30,
      openTop: true,
      reliability: 3,
      costK: 42,
    },
  },
  {
    id: "ita_semovente_105_25",
    country: "ITA",
    family: "tank",
    role: "spa",
    techs: ["medium_tank_2", "artillery_2"],
    year: 1943,
    // Semovente da 105/25 on the M43 chassis: 105 mm howitzer in a closed
    // casemate, 75 mm front. About 100 built before the armistice.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_TANK,
    spec: {
      massT: 16,
      hullFrontMm: 75,
      hullSlopeDeg: 10,
      gunMm: 105,
      penMm500: 0,
      heFillerG: 2000,
      mgs: 1,
      offroadKmh: 22,
      roadKmh: 35,
      reliability: 4,
      costK: 44,
    },
  },
  // ------------------------------------------------------------ planes
  {
    id: "ita_cr32",
    country: "ITA",
    family: "plane",
    type: "fighter",
    techs: ["fighter_1"],
    year: 1933,
    // Fiat CR.32 biplane: 375 km/h, 2 x 12.7 mm Breda-SAFAT; light bombs.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
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
  {
    id: "ita_cr42",
    country: "ITA",
    family: "plane",
    type: "fighter",
    techs: ["fighter_1", "aero_engine_2"],
    year: 1939,
    // Fiat CR.42 Falco: the last biplane fighter in production, 430 km/h,
    // 2 x 12.7 mm; very agile, outclassed by monoplanes.
    source: SRC_AIR,
    spec: {
      maxKmh: 430,
      rangeKm: 780,
      emptyKg: 1700,
      wingLoad: 102,
      guns: [{ mm: 12.7, count: 2, rpm: 700 }],
      defGuns: 0,
      bombKg: 100,
      torpedoKg: 0,
      reliability: 4,
      costK: 22,
    },
  },
  {
    id: "ita_g50",
    country: "ITA",
    family: "plane",
    type: "fighter",
    techs: ["fighter_1"],
    year: 1938,
    // Fiat G.50 Freccia: first Italian monoplane fighter, 470 km/h,
    // 2 x 12.7 mm; early gun and canopy faults.
    source: SRC_AIR,
    spec: {
      maxKmh: 470,
      rangeKm: 1000,
      emptyKg: 1975,
      wingLoad: 144,
      guns: [{ mm: 12.7, count: 2, rpm: 700 }],
      defGuns: 0,
      bombKg: 0,
      torpedoKg: 0,
      reliability: 3,
      costK: 30,
    },
  },
  {
    id: "ita_mc200",
    country: "ITA",
    family: "plane",
    type: "fighter",
    techs: ["fighter_1", "aero_engine_2"],
    year: 1939,
    // Macchi MC.200 Saetta: 503 km/h, 2 x 12.7 mm, good handling, weak
    // engine and guns. Range quoted 570-870 km, 600 used.
    source: SRC_AIR,
    spec: {
      maxKmh: 503,
      rangeKm: 600,
      emptyKg: 1880,
      wingLoad: 139,
      guns: [{ mm: 12.7, count: 2, rpm: 700 }],
      defGuns: 0,
      bombKg: 0,
      torpedoKg: 0,
      reliability: 4,
      costK: 34,
    },
  },
  {
    id: "ita_re2001",
    country: "ITA",
    family: "plane",
    type: "fighter",
    techs: ["fighter_2", "aero_engine_2"],
    year: 1941,
    // Reggiane Re.2001 Falco II: DB 601 licence engine, 542 km/h,
    // 2 x 12.7 mm and 2 x 7.7 mm.
    source: SRC_AIR,
    spec: {
      maxKmh: 542,
      rangeKm: 1100,
      emptyKg: 2300,
      wingLoad: 159,
      guns: [
        { mm: 12.7, count: 2, rpm: 700 },
        { mm: 7.7, count: 2, rpm: 900 },
      ],
      defGuns: 0,
      bombKg: 0,
      torpedoKg: 0,
      reliability: 3,
      costK: 45,
    },
  },
  {
    id: "ita_mc202",
    country: "ITA",
    family: "plane",
    type: "fighter",
    techs: ["fighter_2", "aero_engine_2"],
    year: 1941,
    // Macchi MC.202 Folgore: DB 601 licence engine, 600 km/h, 2 x 12.7 mm
    // and 2 x 7.7 mm; the best Italian fighter of its year.
    // Audit w66: 2,491 kg empty (Wikipedia).
    source:
      "Checked 2026-11-04 on Wikipedia: Macchi C.202 (2,491 kg, 16.82 m2, 600 km/h, 765 km). Other figures from memory; cost an estimate unless stated.",
    spec: {
      maxKmh: 600,
      rangeKm: 765,
      emptyKg: 2491,
      wingLoad: 174,
      guns: [
        { mm: 12.7, count: 2, rpm: 700 },
        { mm: 7.7, count: 2, rpm: 900 },
      ],
      defGuns: 0,
      bombKg: 0,
      torpedoKg: 0,
      reliability: 4,
      costK: 48,
    },
  },
  {
    id: "ita_mc205",
    country: "ITA",
    family: "plane",
    type: "fighter",
    techs: ["fighter_3", "aero_engine_2", "aircraft_cannon_1"],
    year: 1943,
    // Macchi MC.205 Veltro: DB 605 licence engine, 642 km/h, 2 x 12.7 mm
    // and 2 x 20 mm MG 151; built in small numbers.
    source:
      "Checked 2026-11-04 on Wikipedia: Macchi C.205 (2,581 / 3,408 kg on 16.8 m2, 642 km/h, 950 km). Other figures from memory; cost an estimate unless stated.",
    spec: {
      maxKmh: 642,
      rangeKm: 950,
      emptyKg: 2581,
      wingLoad: 203,
      guns: [
        { mm: 12.7, count: 2, rpm: 700 },
        { mm: 20, count: 2, rpm: 700 },
      ],
      defGuns: 0,
      bombKg: 0,
      torpedoKg: 0,
      reliability: 3,
      costK: 55,
    },
  },
  {
    id: "ita_g55",
    country: "ITA",
    family: "plane",
    type: "fighter",
    techs: ["fighter_3", "aero_engine_2", "aircraft_cannon_1"],
    year: 1943,
    // Fiat G.55 Centauro: DB 605 licence engine, 620 km/h, three MG 151
    // 20 mm and 2 x 12.7 mm; fewer than 300 built.
    source: SRC_AIR,
    spec: {
      maxKmh: 620,
      rangeKm: 1200,
      emptyKg: 2630,
      wingLoad: 176,
      guns: [
        { mm: 20, count: 3, rpm: 700 },
        { mm: 12.7, count: 2, rpm: 700 },
      ],
      defGuns: 0,
      bombKg: 0,
      torpedoKg: 0,
      reliability: 3,
      costK: 58,
    },
  },
  {
    id: "ita_ba65",
    country: "ITA",
    family: "plane",
    type: "cas",
    techs: ["cas_1"],
    year: 1937,
    // Breda Ba.65 ground attacker: 430 km/h, 2 x 12.7 and 2 x 7.7 mm in the
    // wings, one flexible 7.7 mm, up to 1,000 kg of bombs; its engine
    // overheated in the desert.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 430,
      rangeKm: 550,
      emptyKg: 2440,
      wingLoad: 145,
      guns: [
        { mm: 12.7, count: 2, rpm: 700 },
        { mm: 7.7, count: 2, rpm: 900 },
      ],
      defGuns: 1,
      bombKg: 1000,
      torpedoKg: 0,
      reliability: 2,
      costK: 32,
    },
  },
  {
    id: "ita_re2002",
    country: "ITA",
    family: "plane",
    type: "cas",
    techs: ["cas_1", "aero_engine_3"],
    year: 1943,
    // Reggiane Re.2002 Ariete: dive-capable fighter-bomber, 530 km/h,
    // 2 x 12.7 and 2 x 7.7 mm, one 630 kg bomb; about 150 built.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 530,
      rangeKm: 1000,
      emptyKg: 2500,
      wingLoad: 159,
      guns: [
        { mm: 12.7, count: 2, rpm: 700 },
        { mm: 7.7, count: 2, rpm: 900 },
      ],
      defGuns: 0,
      bombKg: 640,
      torpedoKg: 0,
      dive: true,
      reliability: 3,
      costK: 46,
    },
  },
  {
    id: "ita_sm81",
    country: "ITA",
    family: "plane",
    type: "bomber",
    techs: ["bomber_1"],
    year: 1935,
    // Savoia-Marchetti SM.81 Pipistrello: three-engine bomber/transport,
    // 340 km/h, 2,000 kg of bombs, six 7.7 mm.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 340,
      rangeKm: 2000,
      emptyKg: 6800,
      wingLoad: 94,
      guns: [],
      defGuns: 6,
      bombKg: 2000,
      torpedoKg: 0,
      reliability: 4,
      costK: 70,
    },
  },
  {
    id: "ita_br20",
    country: "ITA",
    family: "plane",
    type: "bomber",
    techs: ["bomber_1"],
    year: 1936,
    // Fiat BR.20 Cicogna: twin-engine, 440 km/h, 1,600 kg bombs, three or
    // four machine guns (one 12.7 mm); vulnerable and fragile in the cold.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 440,
      rangeKm: 2000,
      emptyKg: 6500,
      wingLoad: 135,
      guns: [],
      defGuns: 3,
      bombKg: 1600,
      torpedoKg: 0,
      reliability: 3,
      costK: 80,
    },
  },
  {
    id: "ita_sm79",
    country: "ITA",
    family: "plane",
    type: "bomber",
    techs: ["bomber_1"],
    year: 1936,
    // Savoia-Marchetti SM.79 Sparviero: three engines, 435 km/h, 1,250 kg of
    // bombs, five machine guns (12.7 and 7.7 mm); the best Italian bomber.
    // Audit w66: 460 km/h, 7,700 kg, 10,050 kg on 61.7 m2, 2,600 km (Wikipedia, Savoia-Marchetti SM.79).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source:
      "Checked 2026-11-04 on Wikipedia: SM.79 (7,700 / 10,050 kg on 61.7 m2, 460 km/h, 2,600 km, 1,200 kg). Other figures from memory; cost an estimate unless stated.",
    spec: {
      maxKmh: 460,
      rangeKm: 2600,
      emptyKg: 7700,
      wingLoad: 163,
      guns: [],
      defGuns: 5,
      bombKg: 1250,
      torpedoKg: 0,
      reliability: 4,
      costK: 85,
    },
  },
  {
    id: "ita_z1007",
    country: "ITA",
    family: "plane",
    type: "bomber",
    techs: ["bomber_2"],
    year: 1939,
    // CANT Z.1007bis Alcione: three engines, wooden, 450 km/h, 2,000 kg of
    // bombs, five machine guns. Empty mass quoted 8,300-9,000 kg, 8,700 used.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 450,
      rangeKm: 1250,
      emptyKg: 8700,
      wingLoad: 190,
      guns: [],
      defGuns: 5,
      bombKg: 2000,
      torpedoKg: 0,
      reliability: 3,
      costK: 95,
    },
  },
  {
    id: "ita_sm79_silurante",
    country: "ITA",
    family: "plane",
    type: "naval_bomber",
    techs: ["naval_bomber_2"],
    year: 1940,
    // SM.79 Sparviero torpedo-bomber (silurante): 450 mm aerial torpedo of
    // about 800 kg (two were carried on short missions, one used here).
    // Audit w66: Airframe as the bomber's; slower with the torpedo.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 430,
      rangeKm: 2600,
      emptyKg: 7700,
      wingLoad: 163,
      guns: [],
      defGuns: 5,
      bombKg: 0,
      torpedoKg: 800,
      reliability: 4,
      costK: 88,
    },
  },
  {
    id: "ita_sm84",
    country: "ITA",
    family: "plane",
    type: "naval_bomber",
    techs: ["naval_bomber_2"],
    year: 1941,
    // Savoia-Marchetti SM.84: improved SM.79, 475 km/h, torpedoes or 2,000 kg
    // of bombs; unreliable engines. Empty mass 7,400-7,900 kg, 7,750 used.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 475,
      rangeKm: 1750,
      emptyKg: 7750,
      wingLoad: 166,
      guns: [],
      defGuns: 5,
      bombKg: 0,
      torpedoKg: 800,
      reliability: 3,
      costK: 92,
    },
  },
  {
    id: "ita_p108b",
    country: "ITA",
    family: "plane",
    type: "strat_bomber",
    techs: ["strat_bomber_1", "aero_engine_3"],
    year: 1942,
    // Piaggio P.108B: the only Italian four-engine bomber in service, 430
    // km/h, 3,500 kg bombs, remote nacelle turrets and other guns (six
    // 12.7 mm); about 24 built, troubled engines.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 430,
      rangeKm: 3000,
      emptyKg: 16000,
      wingLoad: 221,
      guns: [],
      defGuns: 6,
      bombKg: 3500,
      torpedoKg: 0,
      reliability: 2,
      costK: 240,
    },
  },
  {
    id: "ita_sm82",
    country: "ITA",
    family: "plane",
    type: "transport_plane",
    techs: ["transport_plane_2"],
    year: 1940,
    // Savoia-Marchetti SM.82 Marsupiale: three-engine heavy transport,
    // 375 km/h, 4 t payload.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 375,
      rangeKm: 3000,
      emptyKg: 10000,
      wingLoad: 150,
      guns: [],
      defGuns: 3,
      bombKg: 0,
      torpedoKg: 0,
      reliability: 4,
      costK: 100,
    },
  },
  // ------------------------------------------------------------ ships
  {
    id: "ita_sauro",
    country: "ITA",
    family: "ship",
    cls: "dd",
    techs: [],
    year: 1926,
    // Sauro class: 1,058 t, 4 x 120 mm, 6 x 533 mm tubes, 35 kn.
    source: SRC_SHIP,
    spec: {
      dispT: 1058,
      main: { count: 4, mm: 120 },
      beltMm: 0,
      speedKn: 35,
      rangeNm: 3800,
      torpTubes: 6,
      torpWarheadKg: 270,
      asw: 1,
      aaLight: [{ count: 2, mm: 40 }],
      aaHeavy: 0,
      aircraft: 0,
      costM: 3.6,
    },
  },
  {
    id: "ita_navigatori",
    country: "ITA",
    family: "ship",
    cls: "dd",
    techs: [],
    year: 1930,
    // Navigatori class: about 1,900 t, 6 x 120 mm, 6 x 533 mm tubes,
    // 38 kn nominal; fast, lightly built.
    source: SRC_SHIP,
    spec: {
      dispT: 1900,
      main: { count: 6, mm: 120 },
      beltMm: 0,
      speedKn: 38,
      rangeNm: 3800,
      torpTubes: 6,
      torpWarheadKg: 270,
      asw: 1,
      aaLight: [{ count: 2, mm: 40 }],
      aaHeavy: 0,
      aircraft: 0,
      costM: 5.8,
    },
  },
  {
    id: "ita_maestrale",
    country: "ITA",
    family: "ship",
    cls: "dd",
    techs: ["dd_2"],
    year: 1934,
    // Maestrale class: about 1,450 t, 4 x 120 mm, 6 x 533 mm tubes, 38 kn
    // nominal, two 37 mm.
    source: SRC_SHIP,
    spec: {
      dispT: 1450,
      main: { count: 4, mm: 120 },
      beltMm: 0,
      speedKn: 38,
      rangeNm: 4000,
      torpTubes: 6,
      torpWarheadKg: 270,
      asw: 1,
      aaLight: [{ count: 2, mm: 37 }],
      aaHeavy: 0,
      aircraft: 0,
      costM: 4.8,
    },
  },
  {
    id: "ita_oriani",
    country: "ITA",
    family: "ship",
    cls: "dd",
    techs: ["dd_2"],
    year: 1937,
    // Oriani class: about 1,680 t, 4 x 120 mm, 6 x 533 mm tubes, 39 kn
    // nominal.
    source: SRC_SHIP,
    spec: {
      dispT: 1680,
      main: { count: 4, mm: 120 },
      beltMm: 0,
      speedKn: 39,
      rangeNm: 4000,
      torpTubes: 6,
      torpWarheadKg: 270,
      asw: 1,
      aaLight: [{ count: 4, mm: 37 }],
      aaHeavy: 0,
      aircraft: 0,
      costM: 5.4,
    },
  },
  {
    id: "ita_soldati",
    country: "ITA",
    family: "ship",
    cls: "dd",
    techs: ["dd_2"],
    year: 1938,
    // Soldati class: about 1,830 t, 4 x 120 mm, 6 x 533 mm tubes, 39 kn
    // nominal (34 in service), wartime AA 4 x 37 and 8 x 20 mm.
    source: SRC_SHIP,
    spec: {
      dispT: 1830,
      main: { count: 4, mm: 120 },
      beltMm: 0,
      speedKn: 34,
      rangeNm: 3500,
      torpTubes: 6,
      torpWarheadKg: 270,
      asw: 1,
      aaLight: [
        { count: 4, mm: 37 },
        { count: 8, mm: 20 },
      ],
      aaHeavy: 0,
      aircraft: 0,
      costM: 5.8,
    },
  },
  {
    id: "ita_di_giussano",
    country: "ITA",
    family: "ship",
    cls: "cl",
    techs: [],
    year: 1931,
    // Alberto di Giussano class: about 5,200 t, 8 x 152 mm, 6 x 100 mm
    // dual-purpose, 24 mm belt, 4 tubes, 37 kn on trials (about 32 in
    // service; 36 used).
    source: SRC_SHIP,
    spec: {
      dispT: 5200,
      main: { count: 8, mm: 152 },
      secondary: { count: 6, mm: 100 },
      beltMm: 24,
      speedKn: 36,
      rangeNm: 3800,
      torpTubes: 4,
      torpWarheadKg: 270,
      asw: 0,
      aaLight: [{ count: 8, mm: 37 }],
      aaHeavy: 6,
      aircraft: 0,
      costM: 13,
    },
  },
  {
    id: "ita_duca_d_aosta",
    country: "ITA",
    family: "ship",
    cls: "cl",
    techs: ["cl_2"],
    year: 1935,
    // Duca d'Aosta class (Condottieri C): about 8,450 t, 8 x 152 mm,
    // 6 x 100 mm, 70 mm belt, 6 tubes, 36 kn.
    source: SRC_SHIP,
    spec: {
      dispT: 8450,
      main: { count: 8, mm: 152 },
      secondary: { count: 6, mm: 100 },
      beltMm: 70,
      speedKn: 36,
      rangeNm: 3900,
      torpTubes: 6,
      torpWarheadKg: 270,
      asw: 0,
      aaLight: [
        { count: 8, mm: 37 },
        { count: 8, mm: 20 },
      ],
      aaHeavy: 6,
      aircraft: 0,
      costM: 19,
    },
  },
  {
    id: "ita_capitani_romani",
    country: "ITA",
    family: "ship",
    cls: "cl",
    techs: ["cl_3"],
    year: 1942,
    // Capitani Romani class (scout cruiser): about 3,750 t, 8 x 135 mm,
    // 6 tubes, 40 kn nominal, no belt (deck plating only); three completed
    // in 1942-43.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_SHIP,
    spec: {
      dispT: 3750,
      main: { count: 8, mm: 135 },
      beltMm: 0,
      speedKn: 40,
      rangeNm: 4250,
      torpTubes: 6,
      torpWarheadKg: 270,
      asw: 0,
      aaLight: [
        { count: 8, mm: 37 },
        { count: 12, mm: 20 },
      ],
      aaHeavy: 0,
      aircraft: 0,
      costM: 14,
    },
  },
  {
    id: "ita_trento",
    country: "ITA",
    family: "ship",
    cls: "ca",
    techs: [],
    year: 1929,
    // Trento class: about 10,000 t (Washington), 8 x 203 mm, 12 x 100 mm,
    // 70 mm belt, 8 tubes, 35 kn nominal; fast but weakly armoured.
    source: SRC_SHIP,
    spec: {
      dispT: 10000,
      main: { count: 8, mm: 203 },
      secondary: { count: 12, mm: 100 },
      beltMm: 70,
      speedKn: 35,
      rangeNm: 4160,
      torpTubes: 8,
      torpWarheadKg: 270,
      asw: 0,
      aaLight: [{ count: 8, mm: 37 }],
      aaHeavy: 12,
      aircraft: 0,
      costM: 22,
    },
  },
  {
    id: "ita_zara",
    country: "ITA",
    family: "ship",
    cls: "ca",
    techs: ["ca_2"],
    year: 1931,
    // Zara class: about 11,500 t standard, 8 x 203 mm, 12 x 100 mm, 150 mm
    // belt, 32 kn; the best-protected Italian heavy cruisers.
    source:
      "Checked 2026-11-04 on Wikipedia: Zara class (11,326 t, 32 kn, 150 mm belt, 8 x 203). Other figures from memory; cost an estimate unless stated.",
    spec: {
      dispT: 11500,
      main: { count: 8, mm: 203 },
      secondary: { count: 12, mm: 100 },
      beltMm: 150,
      speedKn: 32,
      rangeNm: 5400,
      torpTubes: 0,
      torpWarheadKg: 0,
      asw: 0,
      aaLight: [
        { count: 8, mm: 37 },
        { count: 8, mm: 20 },
      ],
      aaHeavy: 12,
      aircraft: 0,
      costM: 28,
    },
  },
  {
    id: "ita_cavour_rebuilt",
    country: "ITA",
    family: "ship",
    cls: "bb",
    techs: ["bb_2"],
    year: 1937,
    // Conte di Cavour and Giulio Cesare as rebuilt 1933-37: about 24,000 t,
    // 10 x 320 mm, 12 x 120 mm, 8 x 100 mm AA, 250 mm belt, 27 kn. The cost
    // of the rebuild is an estimate.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_SHIP,
    spec: {
      dispT: 24000,
      main: { count: 10, mm: 320 },
      secondary: { count: 12, mm: 120 },
      beltMm: 250,
      speedKn: 27,
      rangeNm: 6400,
      torpTubes: 0,
      torpWarheadKg: 0,
      asw: 0,
      aaLight: [
        { count: 12, mm: 37 },
        { count: 12, mm: 20 },
      ],
      aaHeavy: 8,
      aircraft: 0,
      costM: 34,
    },
  },
  {
    id: "ita_littorio",
    country: "ITA",
    family: "ship",
    cls: "bb",
    techs: ["bb_3"],
    year: 1940,
    // Littorio class (Vittorio Veneto, Roma): about 41,000 t actual standard
    // (35,000 Washington on paper), 9 x 381 mm, 12 x 152 mm, 12 x 90 mm AA,
    // 280 mm belt, 30 kn; about 850 million lire per ship (warhistory.org); cost set above the North Carolina.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source:
      "Checked 2026-11-04 on Wikipedia: Littorio class (40,724 t, 30 kn, 4,580 nm, 280 + 70 mm belt, 9 x 381, 12 x 152, 12 x 90, 20 x 37, 20 x 20). Other figures from memory; cost an estimate unless stated.",
    spec: {
      dispT: 41000,
      main: { count: 9, mm: 381 },
      secondary: { count: 12, mm: 152 },
      beltMm: 280,
      speedKn: 30,
      rangeNm: 4580,
      torpTubes: 0,
      torpWarheadKg: 0,
      asw: 0,
      aaLight: [
        { count: 20, mm: 37 },
        { count: 16, mm: 20 },
      ],
      aaHeavy: 12,
      aircraft: 0,
      costM: 84,
    },
  },
  {
    id: "ita_aquila",
    country: "ITA",
    family: "ship",
    cls: "cv",
    techs: ["cv_4", "carrier_aviation"],
    year: 1943,
    // Aquila: the liner Roma converted 1941-43, never finished: about
    // 23,500 t, 8 x 135 mm, 12 x 65 mm AA, 132 x 20 mm AA, 76 mm belt, 30 kn,
    // planned air group of about 51. Planned only; cost an estimate.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_SHIP,
    spec: {
      dispT: 23500,
      main: { count: 0, mm: 0 },
      secondary: { count: 8, mm: 135 },
      beltMm: 76,
      speedKn: 30,
      rangeNm: 5500,
      torpTubes: 0,
      torpWarheadKg: 0,
      asw: 0,
      aaLight: [{ count: 132, mm: 20 }],
      aaHeavy: 12,
      aircraft: 51,
      costM: 45,
    },
  },
  {
    id: "ita_settembrini",
    country: "ITA",
    family: "ship",
    cls: "ss",
    techs: [],
    year: 1931,
    // Settembrini class: about 900 t surfaced, 8 x 533 mm tubes, one 102 mm
    // deck gun, 17.5 kn.
    source: SRC_SHIP,
    spec: {
      dispT: 900,
      main: { count: 1, mm: 102 },
      beltMm: 0,
      speedKn: 17.5,
      rangeNm: 5000,
      torpTubes: 8,
      torpWarheadKg: 270,
      asw: 0,
      aaLight: [],
      aaHeavy: 0,
      aircraft: 0,
      costM: 3.2,
    },
  },
  {
    id: "ita_marcello",
    country: "ITA",
    family: "ship",
    cls: "ss",
    techs: ["ss_3"],
    year: 1939,
    // Marcello class: about 1,060 t surfaced, 8 x 533 mm tubes, one 100 mm
    // gun, 17.4 kn, long range (quoted 10,000-12,000 nm; 10,500 used).
    source: SRC_SHIP,
    spec: {
      dispT: 1060,
      main: { count: 1, mm: 100 },
      beltMm: 0,
      speedKn: 17.4,
      rangeNm: 10500,
      torpTubes: 8,
      torpWarheadKg: 270,
      asw: 0,
      aaLight: [],
      aaHeavy: 0,
      aircraft: 0,
      costM: 3.8,
    },
  },
  {
    id: "ita_acciaio",
    country: "ITA",
    family: "ship",
    cls: "ss",
    techs: ["ss_3"],
    year: 1941,
    // Acciaio class (medium coastal boat): about 715 t surfaced, 6 x 533 mm
    // tubes, one 100 mm gun, 14 kn.
    source: SRC_SHIP,
    spec: {
      dispT: 715,
      main: { count: 1, mm: 100 },
      beltMm: 0,
      speedKn: 14,
      rangeNm: 5000,
      torpTubes: 6,
      torpWarheadKg: 270,
      asw: 0,
      aaLight: [],
      aaHeavy: 0,
      aircraft: 0,
      costM: 2.6,
    },
  },
  // ------------------------------------------------------------ infantry
  {
    id: "ita_carcano_m91",
    country: "ITA",
    family: "infantry",
    techs: ["inf_eq_1"],
    year: 1891,
    // Carcano M91 / M91/38 bolt-action rifle, 6.5 mm, aimed fire about 12
    // rounds a minute; the standard Italian rifle throughout the war.
    source:
      "Wikipedia, Carcano, from memory; cost a guess near the US 1903 rifle",
    spec: { mm: 6.5, aimedRpm: 12, rangeM: 500, autoPct: 0, costUsd: 22 },
  },
  {
    id: "ita_beretta_m38",
    country: "ITA",
    family: "infantry",
    techs: ["inf_eq_2"],
    year: 1938,
    // Beretta Moschetto Automatico M1938A, 9 mm submachine gun, about 600
    // rounds per minute cyclic; aimed bursts about 25 a minute, short range.
    // Audit w66: Issued to about one man in ten.
    source:
      "Wikipedia, Beretta Model 38, from memory; cost scaled from the Thompson",
    spec: { mm: 9, aimedRpm: 25, rangeM: 200, autoPct: 10, costUsd: 55 },
  },
  // ------------------------------------------------------------ support
  {
    id: "ita_fiat626",
    country: "ITA",
    family: "support",
    techs: ["support_eq_1"],
    year: 1939,
    // Fiat 626 NL: 3-tonne army lorry, the common Italian truck; range of
    // about 450 km.
    source:
      "Wikipedia, Fiat 626, from memory; cost scaled from US 1.5-ton trucks",
    spec: { kind: "transport", rangeKm: 450, costUsd: 1400 },
  },
  {
    id: "ita_lancia_3ro",
    country: "ITA",
    family: "support",
    techs: ["support_eq_1"],
    year: 1938,
    // Lancia 3Ro: diesel heavy truck of 6 tonnes, range about 500 km;
    //
    source:
      "Wikipedia, Lancia 3Ro, from memory; cost scaled from US 2.5-ton trucks",
    spec: { kind: "transport", rangeKm: 500, costUsd: 3200 },
  },
  {
    id: "ita_alce",
    country: "ITA",
    family: "support",
    techs: ["support_eq_1"],
    year: 1939,
    // Moto Guzzi Alce: 500 cc army motorcycle for reconnaissance and
    // dispatch riders, range about 350 km;
    source:
      "Wikipedia, Moto Guzzi Alce, from memory; cost scaled from the Harley WLA",
    spec: { kind: "recon", rangeKm: 350, costUsd: 400 },
  },
  // ------------------------------------------------------------ guns
  {
    id: "ita_75_27",
    country: "ITA",
    family: "gun",
    role: "artillery",
    techs: ["artillery_1"],
    year: 1911,
    // Cannone da 75/27 Mod. 11: 6 rounds a minute, range 10,500 m, shell
    // 6.35 kg, 1,076 kg in action; the field gun of 1936.
    source: SRC_GUN,
    spec: {
      mm: 75,
      rpm: 6,
      rangeM: 10500,
      shellKg: 6.35,
      penMm500: 0,
      massKg: 1076,
      barrels: 1,
      costK: 6,
    },
  },
  {
    id: "ita_100_17",
    country: "ITA",
    family: "gun",
    role: "artillery",
    techs: ["artillery_1"],
    year: 1914,
    // Obice da 100/17 Mod. 14: howitzer, 4 rounds a minute, range 8,400 m,
    // shell 13.8 kg, 1,421 kg.
    source: SRC_GUN,
    spec: {
      mm: 100,
      rpm: 4,
      rangeM: 8400,
      shellKg: 13.8,
      penMm500: 0,
      massKg: 1421,
      barrels: 1,
      costK: 7,
    },
  },
  {
    id: "ita_75_18",
    country: "ITA",
    family: "gun",
    role: "artillery",
    techs: ["artillery_1"],
    year: 1935,
    // Obice da 75/18 Mod. 35: light howitzer, 6 rounds a minute, range
    // 9,500 m, shell 6.4 kg, 850-1,050 kg (900 used).
    source: SRC_GUN,
    spec: {
      mm: 75,
      rpm: 6,
      rangeM: 9500,
      shellKg: 6.4,
      penMm500: 0,
      massKg: 900,
      barrels: 1,
      costK: 6,
    },
  },
  {
    id: "ita_105_28",
    country: "ITA",
    family: "gun",
    role: "artillery",
    techs: ["artillery_1"],
    year: 1913,
    // Cannone da 105/28: 6 rounds a minute, range 13,000 m, shell 15.1 kg,
    // about 2,300 kg.
    source: SRC_GUN,
    spec: {
      mm: 105,
      rpm: 6,
      rangeM: 13000,
      shellKg: 15.1,
      penMm500: 0,
      massKg: 2300,
      barrels: 1,
      costK: 12,
    },
  },
  {
    id: "ita_75_32",
    country: "ITA",
    family: "gun",
    role: "artillery",
    techs: ["artillery_2"],
    year: 1937,
    // Cannone da 75/32 Mod. 37: modern field gun, 10 rounds a minute, range
    // 12,500 m, shell 6.4 kg, about 1,250 kg.
    source: SRC_GUN,
    spec: {
      mm: 75,
      rpm: 10,
      rangeM: 12500,
      shellKg: 6.4,
      penMm500: 0,
      massKg: 1250,
      barrels: 1,
      costK: 9,
    },
  },
  {
    id: "ita_149_40",
    country: "ITA",
    family: "gun",
    role: "artillery",
    techs: ["artillery_2"],
    year: 1935,
    // Cannone da 149/40 Mod. 35: heavy gun, 2 rounds a minute, range
    // 23,700 m, shell 46 kg, about 11,300 kg.
    source: SRC_GUN,
    spec: {
      mm: 149,
      rpm: 2,
      rangeM: 23700,
      shellKg: 46,
      penMm500: 0,
      massKg: 11300,
      barrels: 1,
      costK: 30,
    },
  },
  {
    id: "ita_47_32",
    country: "ITA",
    family: "gun",
    role: "anti_tank",
    techs: ["anti_tank_1"],
    year: 1935,
    // Cannone da 47/32 Mod. 35 (Bohler design): 12 rounds a minute, shell
    // 1.44 kg, 277 kg; penetration quoted 30-43 mm at 500 m, 38 mm used
    // (same value as the M13/40's gun).
    source:
      "Checked 2026-11-04 on Wikipedia: Cannone da 47/32 (43 mm at 500 m, angle not given; L/40 50 mm). Other figures from memory; cost an estimate unless stated.",
    spec: {
      mm: 47,
      rpm: 12,
      rangeM: 6000,
      shellKg: 1.44,
      penMm500: 38,
      massKg: 277,
      barrels: 1,
      costK: 2.2,
    },
  },
  {
    id: "ita_breda_20_65",
    country: "ITA",
    family: "gun",
    role: "anti_air",
    techs: ["anti_air_1"],
    year: 1935,
    // Cannone-mitragliera da 20/65 Mod. 35 (Breda): about 220 rounds a
    // minute, effective ceiling about 2,000 m, 0.12 kg shell, 307 kg.
    source: SRC_GUN,
    spec: {
      mm: 20,
      rpm: 220,
      rangeM: 2000,
      shellKg: 0.12,
      penMm500: 0,
      massKg: 307,
      barrels: 1,
      costK: 2.5,
    },
  },
  {
    id: "ita_breda_37_54",
    country: "ITA",
    family: "gun",
    role: "anti_air",
    techs: ["anti_air_1"],
    year: 1939,
    // Cannone-mitragliera da 37/54 (Breda): 120 rounds a minute, effective
    // ceiling about 3,000 m, 0.82 kg shell.
    source: SRC_GUN,
    spec: {
      mm: 37,
      rpm: 120,
      rangeM: 3000,
      shellKg: 0.82,
      penMm500: 0,
      massKg: 1000,
      barrels: 1,
      costK: 5,
    },
  },
  {
    id: "ita_75_46",
    country: "ITA",
    family: "gun",
    role: "anti_air",
    techs: ["anti_air_1"],
    year: 1934,
    // Cannone da 75/46 C.A. Mod. 34 (Ansaldo): 15 rounds a minute, ceiling
    // about 9,000 m, shell 6.5 kg, about 3,000 kg.
    source: SRC_GUN,
    spec: {
      mm: 75,
      rpm: 15,
      rangeM: 9000,
      shellKg: 6.5,
      penMm500: 0,
      massKg: 3000,
      barrels: 1,
      costK: 12,
    },
  },
  {
    id: "ita_90_53",
    country: "ITA",
    family: "gun",
    role: "anti_air",
    techs: ["anti_air_2"],
    year: 1939,
    // Cannone da 90/53: the best Italian AA gun, 12 rounds a minute, ceiling
    // about 12,000 m, shell 10.3 kg, about 8,000 kg on its mount.
    source: SRC_GUN,
    spec: {
      mm: 90,
      rpm: 12,
      rangeM: 12000,
      shellKg: 10.3,
      penMm500: 0,
      massKg: 8000,
      barrels: 1,
      costK: 28,
    },
  },
];
