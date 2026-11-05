// World War 1936 historical catalogue: USA. The data lane for this country
// writes ONLY this file (and its text keys in its own scratch file).
// Entry format: see Types.ts and the worked example in deu.ts.
//
// Figures are from memory of the usual references and Wikipedia articles, none
// re-read unless the entry's source says it was checked. Where references
// differ a middle value is used and noted.
// Unit costs are wartime contract prices in then-current US dollars, which
// were already dollars of 1940-45 (mid values of the quoted ranges; the
// US cut prices as output rose, so these are indicative). Penetration is
// at 500 m / 30 degrees with the normal AP round.
import type { HistEntry } from "./Types";

const SRC_TANK =
  "From memory of the usual tank references and Wikipedia; not re-read";
const SRC_AIR =
  "From memory of the usual aircraft references and Wikipedia; not re-read";
const SRC_SHIP =
  "From memory of the usual warship references and Wikipedia; not re-read";
const SRC_GEAR =
  "From memory of the usual weapon references and Wikipedia; not re-read";

export const USA_HIST: readonly HistEntry[] = [
  // ------------------------------------------------------------- tanks
  {
    id: "usa_m2a4",
    country: "USA",
    family: "tank",
    role: "light",
    techs: ["light_tank_1"],
    year: 1935,
    // 37 mm M5 gun, 25 mm front, four MGs, 11.5 t; about 375 built.
    // Cost about $25k (estimate; sources thin).
    // Audit w66: 37 mm M5, about 3 mm below the M6 (Wikipedia, 37 mm gun M3).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_TANK,
    spec: {
      massT: 11.5,
      hullFrontMm: 25,
      hullSlopeDeg: 0,
      turretFrontMm: 25,
      gunMm: 37,
      penMm500: 47,
      heFillerG: 20,
      mgs: 4,
      offroadKmh: 25,
      roadKmh: 58,
      reliability: 3,
      costK: 28,
    },
  },
  {
    id: "usa_m3_stuart",
    country: "USA",
    family: "tank",
    role: "light",
    techs: ["light_tank_2", "tank_gun_2"],
    year: 1941,
    // 37 mm M6 gun, 38 mm hull front, 5 MGs, 12.7 t; 13,859 built. Hunnicutt
    // cost about $33.5k. Reliable but short-ranged.
    // Audit w66: 37 mm M6 with APC M51: 53 mm at 500 yd, 30 deg, homogeneous plate (Wikipedia); 50 at 500 m.
    source:
      "Checked 2026-11-04 on Wikipedia: M3 Stuart ($32,915 for the M3A1, 37 mm M6), 37 mm gun M3 (53 mm at 500 yd, 30 deg). Cost is that price.",
    spec: {
      massT: 12.7,
      hullFrontMm: 38,
      hullSlopeDeg: 15,
      turretFrontMm: 38,
      gunMm: 37,
      penMm500: 50,
      heFillerG: 20,
      mgs: 4,
      offroadKmh: 30,
      roadKmh: 58,
      reliability: 4,
      costK: 33.5,
    },
  },
  {
    id: "usa_m5a1_stuart",
    country: "USA",
    family: "tank",
    role: "light",
    techs: ["light_tank_2", "tank_gun_2"],
    year: 1942,
    // Twin Cadillac engines, 64 mm sloped front, 37 mm M6; 6,800 built.
    // Audit w66: Same 37 mm M6.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source:
      "Checked 2026-11-04 on Wikipedia: M3 Stuart page ($27,057 for the M5). Cost is about that price. Other figures from memory; cost an estimate unless stated.",
    spec: {
      massT: 15.4,
      hullFrontMm: 64,
      hullSlopeDeg: 20,
      turretFrontMm: 51,
      gunMm: 37,
      penMm500: 50,
      heFillerG: 20,
      mgs: 3,
      offroadKmh: 32,
      roadKmh: 58,
      reliability: 4,
      costK: 28,
    },
  },
  {
    id: "usa_m24_chaffee",
    country: "USA",
    family: "tank",
    role: "light",
    techs: ["light_tank_2", "tank_gun_2", "tank_drive_2"],
    year: 1944,
    // 75 mm M6 (lightened tank gun, about 70 mm at 500 m), 25 mm front at
    // 60 degrees, 38 mm turret; 4,731 built. Cost about $55k (sources 50-60).
    // Audit w66: 75 mm M6 has the M3's ballistics: 68.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source:
      "Checked 2026-11-04 on Wikipedia: M24 Chaffee ($39,653, 18.37 t, 35 mph, 75 mm M6). Cost is that price.",
    spec: {
      massT: 18.4,
      hullFrontMm: 25,
      hullSlopeDeg: 60,
      turretFrontMm: 38,
      gunMm: 75,
      penMm500: 68,
      heFillerG: 680,
      mgs: 2,
      offroadKmh: 35,
      roadKmh: 55,
      reliability: 4,
      costK: 40,
    },
  },
  {
    id: "usa_m8_greyhound",
    country: "USA",
    family: "tank",
    role: "light",
    techs: ["light_tank_2", "tank_gun_2", "tank_drive_2"],
    year: 1943,
    // Six-wheeled armoured car, 37 mm M6, 19 mm front, 89 km/h; 8,523 built.
    // Cost about $20k (estimate).
    // Audit w66: Same 37 mm family.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_TANK,
    spec: {
      massT: 7.8,
      hullFrontMm: 19,
      hullSlopeDeg: 45,
      turretFrontMm: 19,
      gunMm: 37,
      penMm500: 50,
      heFillerG: 20,
      mgs: 1,
      offroadKmh: 45,
      roadKmh: 89,
      wheeled: true,
      reliability: 4,
      costK: 22,
    },
  },
  {
    id: "usa_m3_lee",
    country: "USA",
    family: "tank",
    role: "medium",
    techs: ["medium_tank_1", "tank_gun_2"],
    year: 1941,
    // 75 mm M2 L/31 in a sponson (about 60 mm at 500 m), 37 mm turret gun,
    // 51 mm front, tall and riveted; 6,258 built. Cost about $50k.
    source: SRC_TANK,
    spec: {
      massT: 27.2,
      hullFrontMm: 51,
      hullSlopeDeg: 0,
      turretFrontMm: 51,
      gunMm: 75,
      penMm500: 60,
      heFillerG: 680,
      mgs: 4,
      offroadKmh: 24,
      roadKmh: 34,
      reliability: 4,
      costK: 50,
    },
  },
  {
    id: "usa_m4a1_sherman",
    country: "USA",
    family: "tank",
    role: "medium",
    techs: ["medium_tank_2", "tank_gun_2"],
    year: 1942,
    // 75 mm M3 L/40 (M61 APC about 68-76 mm at 500 m, mid 70), 51 mm hull
    // front at 56 degrees, 76 mm turret; very reliable, easy to repair.
    // Cost $33-50k depending on year and builder, mid 42.
    // Audit w66: 75 mm M3: M61 APC about 66, M72 AP about 76 mm at 500 yd, from memory; one figure, 68, for the whole M3 family.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source:
      "Checked 2026-11-04 on Wikipedia: M4 Sherman ($44,556-64,455 in 1945 dollars, 30.3 t, 66,800 lb, 75 mm M3). Cost: bottom of that range. Other figures from memory; cost an estimate unless stated.",
    spec: {
      massT: 30.3,
      hullFrontMm: 51,
      hullSlopeDeg: 56,
      turretFrontMm: 76,
      gunMm: 75,
      penMm500: 68,
      heFillerG: 680,
      mgs: 2,
      offroadKmh: 25,
      roadKmh: 38,
      reliability: 5,
      costK: 44,
    },
  },
  {
    id: "usa_m4a3_76",
    country: "USA",
    family: "tank",
    role: "medium",
    techs: ["medium_tank_2", "tank_gun_3"],
    year: 1944,
    // 76 mm M1A1 (M62 APC about 109 mm at 500 m), 64 mm front at 47 degrees,
    // 76 mm turret, Ford GAA V8. HE filler of the M42A1 shell about 330 g
    // (estimate). Cost about $45k.
    // Audit w66: 76 mm M1 APC M62 is 93-94 mm at 500 yd, 30 deg (Wikipedia); the M79 solid shot, 109 mm, was the substitute and shatters on hard plate.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_TANK,
    spec: {
      massT: 32,
      hullFrontMm: 64,
      hullSlopeDeg: 47,
      turretFrontMm: 76,
      gunMm: 76,
      penMm500: 93,
      heFillerG: 330,
      mgs: 2,
      offroadKmh: 26,
      roadKmh: 42,
      reliability: 5,
      costK: 50,
    },
  },
  {
    id: "usa_m4a3e8",
    country: "USA",
    family: "tank",
    role: "medium",
    techs: ["medium_tank_3", "tank_gun_3"],
    year: 1944,
    // "Easy Eight": 76 mm M1A2, wide HVSS tracks for lower ground pressure.
    // Audit w66: Same 76 mm M1 as the M4A3(76).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_TANK,
    spec: {
      massT: 33.6,
      hullFrontMm: 64,
      hullSlopeDeg: 47,
      turretFrontMm: 76,
      gunMm: 76,
      penMm500: 93,
      heFillerG: 330,
      mgs: 2,
      offroadKmh: 30,
      roadKmh: 42,
      reliability: 5,
      costK: 54,
    },
  },
  {
    id: "usa_m26_pershing",
    country: "USA",
    family: "tank",
    role: "heavy",
    techs: ["heavy_tank_3", "tank_gun_3"],
    year: 1945,
    // Classed a heavy tank in 1945. 90 mm M3 (M82 APC about 112-143 mm at
    // 500 m, mid 125), 102 mm front at 46 degrees, 102 mm turret; 2,000
    // built, 20 in Europe. Cost about $75k (estimate). Underpowered.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source:
      "Checked 2026-11-04 on Wikipedia: M26 Pershing ($83,273.89, 92,355 lb, 90 mm M3). Cost is about that price. Other figures from memory; cost an estimate unless stated.",
    spec: {
      massT: 41.7,
      hullFrontMm: 102,
      hullSlopeDeg: 46,
      turretFrontMm: 102,
      gunMm: 90,
      penMm500: 125,
      heFillerG: 1000,
      mgs: 3,
      offroadKmh: 24,
      roadKmh: 40,
      reliability: 3,
      costK: 80,
    },
  },
  {
    id: "usa_m10",
    country: "USA",
    family: "tank",
    role: "td",
    techs: ["medium_tank_2", "tank_gun_3"],
    year: 1942,
    // Tank destroyer on the Sherman chassis, 3-inch M7 (about 98 mm at
    // 500 m), 57 mm sloped front, open-topped turret; 6,700 built.
    // Audit w66: 3-inch M7 fires the same M62 APC as the 76 mm M1.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source:
      "Checked 2026-11-04 on Wikipedia: M10 tank destroyer ($47,900 in 1942, 65,200 lb, 3-inch M7). Cost is about that price. Other figures from memory; cost an estimate unless stated.",
    spec: {
      massT: 29,
      hullFrontMm: 57,
      hullSlopeDeg: 55,
      turretFrontMm: 19,
      gunMm: 76,
      penMm500: 93,
      heFillerG: 330,
      mgs: 1,
      offroadKmh: 25,
      roadKmh: 51,
      openTop: true,
      reliability: 4,
      costK: 46,
    },
  },
  {
    id: "usa_m18_hellcat",
    country: "USA",
    family: "tank",
    role: "td",
    techs: ["light_tank_2", "tank_gun_3"],
    year: 1943,
    // Very fast, 12.7 mm armour, 76 mm M1A1 (about 105 mm at 500 m);
    // 2,507 built. Cost about $55k (references differ).
    // Audit w66: Same 76 mm M1.
    source:
      "Checked 2026-11-04 on Wikipedia: M18 Hellcat ($55,230 in 1944, 37,557 lb), 76 mm gun M1 (93-94 mm at 500 yd, 30 deg). Cost is that price.",
    spec: {
      massT: 17,
      hullFrontMm: 12.7,
      hullSlopeDeg: 45,
      turretFrontMm: 19,
      gunMm: 76,
      penMm500: 93,
      heFillerG: 330,
      mgs: 1,
      offroadKmh: 40,
      roadKmh: 89,
      openTop: true,
      reliability: 4,
      costK: 55,
    },
  },
  {
    id: "usa_m36",
    country: "USA",
    family: "tank",
    role: "td",
    techs: ["medium_tank_3", "tank_gun_3"],
    year: 1944,
    // M10 hull with the 90 mm M3 (about 125 mm at 500 m), 57 mm sloped
    // front, open turret; 1,772 built. Cost about $60k (estimate).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_TANK,
    spec: {
      massT: 28,
      hullFrontMm: 57,
      hullSlopeDeg: 55,
      turretFrontMm: 76,
      gunMm: 90,
      penMm500: 125,
      heFillerG: 1000,
      mgs: 1,
      offroadKmh: 25,
      roadKmh: 42,
      openTop: true,
      reliability: 4,
      costK: 62,
    },
  },
  {
    id: "usa_m7_priest",
    country: "USA",
    family: "tank",
    role: "spa",
    techs: ["medium_tank_2", "artillery_2"],
    year: 1942,
    // 105 mm M2A1 howitzer on the M3 chassis (HE filler about 2.1 kg),
    // open-topped, 51 mm front; 4,316 built. Cost about $40k (estimate).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_TANK,
    spec: {
      massT: 22.9,
      hullFrontMm: 51,
      hullSlopeDeg: 0,
      gunMm: 105,
      penMm500: 0,
      heFillerG: 2100,
      mgs: 1,
      offroadKmh: 25,
      roadKmh: 38,
      openTop: true,
      reliability: 4,
      costK: 42,
    },
  },
  {
    id: "usa_m16_mgmc",
    country: "USA",
    family: "tank",
    role: "spaa",
    techs: ["motorized_3", "anti_air_1"],
    year: 1943,
    // Half-track M3 with the M45 quad .50 in (M2HB, 450-575 rounds per
    // minute each, 500 used), 12 mm armour; 2,877 built. Cost about $10k
    // (estimate). The AP round pierces about 10 mm at 500 m.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_TANK,
    spec: {
      massT: 9,
      hullFrontMm: 12,
      hullSlopeDeg: 0,
      turretFrontMm: 6,
      gunMm: 12.7,
      penMm500: 10,
      heFillerG: 0,
      mgs: 0,
      offroadKmh: 30,
      roadKmh: 65,
      openTop: true,
      reliability: 4,
      costK: 12,
      aa: { barrels: 4, rpm: 500, mm: 12.7 },
    },
  },
  {
    id: "usa_m19_gmc",
    country: "USA",
    family: "tank",
    role: "spaa",
    techs: ["light_tank_2", "anti_air_2", "tank_drive_2"],
    year: 1945,
    // Twin 40 mm Bofors (about 120 rounds per minute each, pierces about
    // 42 mm at 500 m) on the Chaffee chassis, open turret; 285 built.
    // Cost about $60k (estimate).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_TANK,
    spec: {
      massT: 17.4,
      hullFrontMm: 25,
      hullSlopeDeg: 60,
      turretFrontMm: 12,
      gunMm: 40,
      penMm500: 42,
      heFillerG: 60,
      mgs: 1,
      offroadKmh: 35,
      roadKmh: 55,
      openTop: true,
      reliability: 4,
      costK: 45,
      aa: { barrels: 2, rpm: 120, mm: 40 },
    },
  },

  // ------------------------------------------------------------ planes
  {
    id: "usa_p26a",
    country: "USA",
    family: "plane",
    type: "fighter",
    techs: [],
    year: 1934,
    // Boeing P-26A Peashooter: two .30 in MGs, open cockpit, fixed gear.
    // Cost about $11k (estimate).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 377,
      rangeKm: 580,
      emptyKg: 996,
      wingLoad: 96,
      guns: [{ mm: 7.62, count: 2, rpm: 1100 }],
      defGuns: 0,
      bombKg: 90,
      torpedoKg: 0,
      reliability: 4,
      costK: 16,
    },
  },
  {
    id: "usa_p36a",
    country: "USA",
    family: "plane",
    type: "fighter",
    techs: ["fighter_1"],
    year: 1938,
    // Curtiss P-36A Hawk: one .50 and one .30 in the nose.
    source: SRC_AIR,
    spec: {
      maxKmh: 500,
      rangeKm: 1005,
      emptyKg: 2090,
      wingLoad: 116,
      guns: [
        { mm: 12.7, count: 1, rpm: 800 },
        { mm: 7.62, count: 1, rpm: 1100 },
      ],
      defGuns: 0,
      bombKg: 0,
      torpedoKg: 0,
      reliability: 4,
      costK: 23,
    },
  },
  {
    id: "usa_p40e",
    country: "USA",
    family: "plane",
    type: "fighter",
    techs: ["fighter_2"],
    year: 1941,
    // Curtiss P-40E Warhawk: six .50 in MGs, Allison V-1710; rugged, only
    // fair at altitude. Cost about $45k.
    source: SRC_AIR,
    spec: {
      maxKmh: 580,
      rangeKm: 1100,
      emptyKg: 2880,
      wingLoad: 176,
      guns: [{ mm: 12.7, count: 6, rpm: 800 }],
      defGuns: 0,
      bombKg: 450,
      torpedoKg: 0,
      reliability: 4,
      costK: 45,
    },
  },
  {
    id: "usa_p47d",
    country: "USA",
    family: "plane",
    type: "fighter",
    techs: ["fighter_3", "aero_engine_3"],
    year: 1943,
    // Republic P-47D Thunderbolt: eight .50 in MGs, turbosupercharged R-2800;
    // up to 1,130 kg of bombs. Cost about $83k.
    // Audit w66: 13,230 lb on 300 sq ft (Wikipedia): normal weight.
    source:
      "Checked 2026-11-04 on Wikipedia: P-47 Thunderbolt (10,000 / 13,230 lb on 300 sq ft, 444 mph; entry keeps a D's 690 km/h). Other figures from memory; cost an estimate unless stated.",
    spec: {
      maxKmh: 690,
      rangeKm: 1260,
      emptyKg: 4490,
      wingLoad: 215,
      guns: [{ mm: 12.7, count: 8, rpm: 800 }],
      defGuns: 0,
      bombKg: 1130,
      torpedoKg: 0,
      reliability: 5,
      costK: 83,
    },
  },
  {
    id: "usa_p51d",
    country: "USA",
    family: "plane",
    type: "fighter",
    techs: ["fighter_3", "air_range"],
    year: 1944,
    // North American P-51D Mustang: six .50 in MGs, Packard Merlin, long
    // range with drop tanks (1,650 km internal). Cost about $51k.
    // Audit w66: 7,635 lb empty, 9,200 lb on 235 sq ft (Wikipedia); 252 was the overload figure, Types.ts asks for normal weight.
    source:
      "Checked 2026-11-04 on Wikipedia: P-51 Mustang (7,635 / 9,200 lb on 235 sq ft, 440 mph, 6 x .50, about $51,000). Cost is that price.",
    spec: {
      maxKmh: 703,
      rangeKm: 1650,
      emptyKg: 3463,
      wingLoad: 191,
      guns: [{ mm: 12.7, count: 6, rpm: 800 }],
      defGuns: 0,
      bombKg: 910,
      torpedoKg: 0,
      reliability: 4,
      costK: 51,
    },
  },
  {
    id: "usa_f3f",
    country: "USA",
    family: "plane",
    type: "cv_fighter",
    techs: ["fighter_1", "carrier_aviation"],
    year: 1936,
    // The Navy's carrier fighter of 1936: the US starts with 200 and no monoplane until the F4F.
    source:
      "From memory of the Wikipedia article (F3F-2: about 1,490 kg empty, 2,060 kg on 24.2 m2, 418 km/h, 1,580 km, one .50 and one .30); cost an estimate",
    spec: {
      maxKmh: 418,
      rangeKm: 1580,
      emptyKg: 1490,
      wingLoad: 85,
      guns: [
        { mm: 12.7, count: 1, rpm: 800 },
        { mm: 7.62, count: 1, rpm: 1100 },
      ],
      defGuns: 0,
      bombKg: 0,
      torpedoKg: 0,
      reliability: 4,
      costK: 14,
    },
  },
  {
    id: "usa_f4f4",
    country: "USA",
    family: "plane",
    type: "cv_fighter",
    techs: ["fighter_2", "carrier_aviation"],
    year: 1942,
    // Grumman F4F-4 Wildcat: six .50 in MGs, folding wings; sturdy.
    // Cost about $20k.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 512,
      rangeKm: 1360,
      emptyKg: 2675,
      wingLoad: 139,
      guns: [{ mm: 12.7, count: 6, rpm: 800 }],
      defGuns: 0,
      bombKg: 90,
      torpedoKg: 0,
      reliability: 5,
      costK: 30,
    },
  },
  {
    id: "usa_f6f5",
    country: "USA",
    family: "plane",
    type: "cv_fighter",
    techs: ["fighter_3", "carrier_aviation"],
    year: 1943,
    // Grumman F6F-5 Hellcat: six .50 in MGs, R-2800; about 12,000 built.
    // Cost about $35k.
    source:
      "Checked 2026-11-04 on Wikipedia: F6F Hellcat (9,238 / 12,598 lb on 334 sq ft, 391 mph). Other figures from memory; cost an estimate unless stated.",
    spec: {
      maxKmh: 612,
      rangeKm: 1520,
      emptyKg: 4190,
      wingLoad: 181,
      guns: [{ mm: 12.7, count: 6, rpm: 800 }],
      defGuns: 0,
      bombKg: 900,
      torpedoKg: 0,
      reliability: 5,
      costK: 35,
    },
  },
  {
    id: "usa_f4u1d",
    country: "USA",
    family: "plane",
    type: "cv_fighter",
    techs: ["fighter_3", "carrier_aviation", "aero_engine_3"],
    year: 1944,
    // Vought F4U-1D Corsair: six .50 in MGs, fastest US naval fighter of
    // the war; difficult deck landings early. Cost about $52k.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 671,
      rangeKm: 1620,
      emptyKg: 4175,
      wingLoad: 217,
      guns: [{ mm: 12.7, count: 6, rpm: 800 }],
      defGuns: 0,
      bombKg: 900,
      torpedoKg: 0,
      reliability: 4,
      costK: 60,
    },
  },
  {
    id: "usa_p38j",
    country: "USA",
    family: "plane",
    type: "heavy_fighter",
    techs: ["heavy_fighter_1", "aero_engine_3"],
    year: 1943,
    // Lockheed P-38J Lightning: one 20 mm and four .50 in the nose, twin
    // Allisons, 1,450 kg of bombs. Cost $97-134k, mid 115.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 666,
      rangeKm: 1770,
      emptyKg: 5800,
      wingLoad: 261,
      guns: [
        { mm: 20, count: 1, rpm: 650 },
        { mm: 12.7, count: 4, rpm: 800 },
      ],
      defGuns: 0,
      bombKg: 1450,
      torpedoKg: 0,
      reliability: 3,
      costK: 105,
    },
  },
  {
    id: "usa_a17",
    country: "USA",
    family: "plane",
    type: "cas",
    techs: ["cas_1"],
    year: 1935,
    // The Air Corps attack plane of 1936: the US starts with 100 of this type and its next entry was the A-20G.
    source:
      "From memory of the Wikipedia article (Northrop A-17A: about 2,320 kg empty, 3,430 kg on 33.6 m2, 354 km/h, 1,170 km, four .30 fixed, one .30 flexible, 540 kg); cost an estimate",
    spec: {
      maxKmh: 354,
      rangeKm: 1170,
      emptyKg: 2320,
      wingLoad: 102,
      guns: [{ mm: 7.62, count: 4, rpm: 1100 }],
      defGuns: 1,
      bombKg: 540,
      torpedoKg: 0,
      reliability: 4,
      costK: 28,
    },
  },
  {
    id: "usa_a20g",
    country: "USA",
    family: "plane",
    type: "cas",
    techs: ["cas_1", "aero_engine_3"],
    year: 1943,
    // Douglas A-20G Havoc: six .50 in nose guns, three more defensive,
    // 1,800 kg of bombs. Cost about $100k (estimate).
    source: SRC_AIR,
    spec: {
      maxKmh: 510,
      rangeKm: 1650,
      emptyKg: 7700,
      wingLoad: 236,
      guns: [{ mm: 12.7, count: 6, rpm: 800 }],
      defGuns: 3,
      bombKg: 1800,
      torpedoKg: 0,
      reliability: 4,
      costK: 100,
    },
  },
  {
    id: "usa_sbd3",
    country: "USA",
    family: "plane",
    type: "cv_cas",
    techs: ["cas_2", "carrier_aviation"],
    year: 1941,
    // Douglas SBD-3 Dauntless: two .50 forward, twin .30 flexible, one
    // 450 kg and two 45 kg bombs; sank four Japanese carriers at Midway.
    // Cost about $38k.
    source: SRC_AIR,
    spec: {
      maxKmh: 410,
      rangeKm: 1770,
      emptyKg: 2905,
      wingLoad: 139,
      guns: [{ mm: 12.7, count: 2, rpm: 800 }],
      defGuns: 2,
      bombKg: 600,
      torpedoKg: 0,
      dive: true,
      reliability: 5,
      costK: 38,
    },
  },
  {
    id: "usa_sb2c",
    country: "USA",
    family: "plane",
    type: "cv_cas",
    techs: ["cas_3", "carrier_aviation"],
    year: 1944,
    // Curtiss SB2C-3 Helldiver: two 20 mm forward, twin .30 flexible, 1,800
    // kg of bombs; troubled development ("Beast"). Cost about $70k
    // (estimate).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 452,
      rangeKm: 1800,
      emptyKg: 4784,
      wingLoad: 181,
      guns: [{ mm: 20, count: 2, rpm: 650 }],
      defGuns: 2,
      bombKg: 1800,
      torpedoKg: 0,
      dive: true,
      reliability: 3,
      costK: 60,
    },
  },
  {
    id: "usa_b18",
    country: "USA",
    family: "plane",
    type: "bomber",
    techs: ["bomber_1"],
    year: 1937,
    // Douglas B-18 Bolo, the 1936-40 mainstay of the Air Corps: three .30
    // MGs, 2,950 kg of bombs, obsolete by 1941. Cost about $64k.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 346,
      rangeKm: 1900,
      emptyKg: 7400,
      wingLoad: 142,
      guns: [],
      defGuns: 3,
      bombKg: 2950,
      torpedoKg: 0,
      reliability: 4,
      costK: 70,
    },
  },
  {
    id: "usa_b25j",
    country: "USA",
    family: "plane",
    type: "bomber",
    techs: ["bomber_1", "aero_engine_3"],
    year: 1943,
    // North American B-25J Mitchell: four fixed .50, six more defensive,
    // 1,360 kg of bombs. Cost $120-142k, mid 130.
    source: SRC_AIR,
    spec: {
      maxKmh: 438,
      rangeKm: 2170,
      emptyKg: 9580,
      wingLoad: 275,
      guns: [{ mm: 12.7, count: 4, rpm: 800 }],
      defGuns: 6,
      bombKg: 1360,
      torpedoKg: 0,
      reliability: 5,
      costK: 130,
    },
  },
  {
    id: "usa_pby5a",
    country: "USA",
    family: "plane",
    type: "naval_bomber",
    techs: ["naval_bomber_2"],
    year: 1941,
    // Consolidated PBY-5A Catalina: amphibious flying boat, two .50 and
    // three .30 defensive, 1,800 kg of bombs or depth charges, a torpedo
    // (Mk 13 about 970 kg); range 4,000 km. Cost about $90k (estimate).
    source: SRC_AIR,
    spec: {
      maxKmh: 288,
      rangeKm: 4000,
      emptyKg: 9500,
      wingLoad: 118,
      guns: [],
      defGuns: 5,
      bombKg: 1800,
      torpedoKg: 970,
      reliability: 5,
      costK: 90,
    },
  },
  {
    id: "usa_tbd1",
    country: "USA",
    family: "plane",
    type: "cv_naval_bomber",
    techs: ["naval_bomber_1", "carrier_aviation"],
    year: 1937,
    // Douglas TBD-1 Devastator: first carrier monoplane torpedo bomber, one
    // fixed .30 and one flexible; Mk 13 torpedo; slow, shot down at Midway.
    // Cost about $46k (estimate).
    source: SRC_AIR,
    spec: {
      maxKmh: 322,
      rangeKm: 700,
      emptyKg: 2540,
      wingLoad: 112,
      guns: [{ mm: 7.62, count: 1, rpm: 1100 }],
      defGuns: 1,
      bombKg: 450,
      torpedoKg: 970,
      reliability: 3,
      costK: 46,
    },
  },
  {
    id: "usa_tbf1",
    country: "USA",
    family: "plane",
    type: "cv_naval_bomber",
    techs: ["naval_bomber_2", "carrier_aviation"],
    year: 1942,
    // Grumman TBF-1 Avenger: Mk 13 torpedo or 900 kg of bombs, one fixed and
    // two flexible MGs; 9,837 built. Cost about $55k.
    source: SRC_AIR,
    spec: {
      maxKmh: 436,
      rangeKm: 1610,
      emptyKg: 4787,
      wingLoad: 158,
      guns: [{ mm: 12.7, count: 1, rpm: 800 }],
      defGuns: 2,
      bombKg: 900,
      torpedoKg: 970,
      reliability: 5,
      costK: 55,
    },
  },
  {
    id: "usa_b17e",
    country: "USA",
    family: "plane",
    type: "strat_bomber",
    techs: ["strat_bomber_2"],
    year: 1941,
    // First B-17 with a tail gun: the strat_bomber_1 step, gated like the Wellington and the TB-3.
    source:
      "From memory of the Wikipedia article (B-17E: about 14,850 kg empty, 510 km/h, 3,200 km, 11 guns); cost an estimate near the B-17G's",
    spec: {
      maxKmh: 510,
      rangeKm: 3200,
      emptyKg: 14850,
      wingLoad: 170,
      guns: [],
      defGuns: 11,
      bombKg: 3600,
      torpedoKg: 0,
      reliability: 5,
      costK: 220,
    },
  },
  {
    id: "usa_b17g",
    country: "USA",
    family: "plane",
    type: "strat_bomber",
    techs: ["strat_bomber_1", "aero_engine_3"],
    year: 1943,
    // Boeing B-17G Flying Fortress: thirteen .50 in MGs, 3,600 kg normal
    // load on a short mission (2,000 kg long range, 7,800 maximum). Cost
    // $204-238k, mid 210.
    // Audit w66: Late 1943 model, gated with the B-24J and Pe-8; the B-17E is the strat_bomber_1 entry.
    source:
      "Checked 2026-11-04 on Wikipedia: B-17 Flying Fortress (16,391 / 24,500 kg on 131.92 m2, 472 km/h, 3,219 km; entry keeps 462 km/h). Other figures from memory; cost an estimate unless stated.",
    spec: {
      maxKmh: 462,
      rangeKm: 3220,
      emptyKg: 16400,
      wingLoad: 190,
      guns: [],
      defGuns: 13,
      bombKg: 3600,
      torpedoKg: 0,
      reliability: 5,
      costK: 210,
    },
  },
  {
    id: "usa_b24j",
    country: "USA",
    family: "plane",
    type: "strat_bomber",
    techs: ["strat_bomber_1", "aero_engine_3"],
    year: 1943,
    // Consolidated B-24J Liberator: ten .50 in MGs, 3,600 kg of bombs, long
    // range; most built US aircraft (18,000). Cost about $215k.
    source: SRC_AIR,
    spec: {
      maxKmh: 467,
      rangeKm: 3300,
      emptyKg: 16800,
      wingLoad: 257,
      guns: [],
      defGuns: 10,
      bombKg: 3600,
      torpedoKg: 0,
      reliability: 4,
      costK: 215,
    },
  },
  {
    id: "usa_b29",
    country: "USA",
    family: "plane",
    type: "strat_bomber",
    techs: ["strat_bomber_3", "aero_engine_4"],
    year: 1944,
    // Boeing B-29 Superfortress: pressurised, remote-controlled turrets
    // (ten .50 and a 20 mm tail), 9,000 kg of bombs, 5,230 km. Cost about
    // $639k; engine fires early.
    source: SRC_AIR,
    spec: {
      maxKmh: 574,
      rangeKm: 5230,
      emptyKg: 33800,
      wingLoad: 339,
      guns: [],
      defGuns: 11,
      bombKg: 9000,
      torpedoKg: 0,
      reliability: 3,
      costK: 639,
    },
  },
  {
    id: "usa_c47",
    country: "USA",
    family: "plane",
    type: "transport_plane",
    techs: ["transport_plane_2"],
    year: 1941,
    // Douglas C-47 Skytrain (DC-3): 28 troops or 2,700 kg, 10,000 built, very
    // reliable. Cost $100-138k, mid 120.
    source: SRC_AIR,
    spec: {
      maxKmh: 365,
      rangeKm: 2600,
      emptyKg: 8200,
      wingLoad: 124,
      guns: [],
      defGuns: 0,
      bombKg: 0,
      torpedoKg: 0,
      reliability: 5,
      costK: 120,
    },
  },

  // ------------------------------------------------------------- ships
  {
    id: "usa_clemson",
    country: "USA",
    family: "ship",
    cls: "dd",
    techs: [],
    year: 1919,
    // Clemson class flush-decker (156 built): 4 x 4 in/50, one 3 in AA, 12
    // tubes (Mk 8 warhead about 210 kg), 35 kn, 1,190 t. Cost about $1.2M.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_SHIP,
    spec: {
      dispT: 1210,
      main: { count: 4, mm: 102 },
      beltMm: 0,
      speedKn: 35,
      rangeNm: 2500,
      torpTubes: 12,
      torpWarheadKg: 210,
      asw: 1,
      aaLight: [],
      aaHeavy: 1,
      aircraft: 0,
      costM: 3.5,
    },
  },
  {
    id: "usa_mahan",
    country: "USA",
    family: "ship",
    cls: "dd",
    techs: ["dd_2"],
    year: 1936,
    // Mahan class: 5 x 5 in/38 dual-purpose, 12 tubes (Mk 15 about 224 kg),
    // 36.5 kn, 1,500 t, sonar. Cost about $5M (estimate).
    source: SRC_SHIP,
    spec: {
      dispT: 1520,
      main: { count: 5, mm: 127 },
      beltMm: 0,
      speedKn: 36.5,
      rangeNm: 6500,
      torpTubes: 12,
      torpWarheadKg: 224,
      asw: 2,
      aaLight: [],
      aaHeavy: 5,
      aircraft: 0,
      costM: 5,
    },
  },
  {
    id: "usa_fletcher",
    country: "USA",
    family: "ship",
    cls: "dd",
    techs: ["dd_3"],
    year: 1942,
    // Fletcher class (175 built): 5 x 5 in/38, 10 tubes (Mk 15), 36.5 kn,
    // 2,050 t, 10 x 40 mm and 7 x 20 mm as completed in 1943. Cost about
    // $10M.
    // Audit w66: 5,500 nm at 15 kn (Wikipedia).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source:
      "Checked 2026-11-04 on Wikipedia: Fletcher class ($6M, 2,050 tons, 36.5 kn, 5,500 nm). Cost is near that price. Other figures from memory; cost an estimate unless stated.",
    spec: {
      dispT: 2083,
      main: { count: 5, mm: 127 },
      beltMm: 0,
      speedKn: 36.5,
      rangeNm: 5500,
      torpTubes: 10,
      torpWarheadKg: 224,
      asw: 2,
      aaLight: [
        { count: 10, mm: 40 },
        { count: 7, mm: 20 },
      ],
      aaHeavy: 5,
      aircraft: 0,
      costM: 6.5,
    },
  },
  {
    id: "usa_omaha",
    country: "USA",
    family: "ship",
    cls: "cl",
    techs: [],
    year: 1923,
    // Omaha class: 12 x 6 in/53 (two twin, eight single), 10 tubes, 76 mm
    // belt, 34 kn, 7,050 long tons standard. Cost about $9M (estimate).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_SHIP,
    spec: {
      dispT: 7163,
      main: { count: 12, mm: 152 },
      beltMm: 76,
      speedKn: 34,
      rangeNm: 8460,
      torpTubes: 10,
      torpWarheadKg: 210,
      asw: 0,
      aaLight: [],
      aaHeavy: 2,
      aircraft: 0,
      costM: 15,
    },
  },
  {
    id: "usa_brooklyn",
    country: "USA",
    family: "ship",
    cls: "cl",
    techs: ["cl_2"],
    year: 1937,
    // Brooklyn class: 15 x 6 in/47 in five turrets, 8 x 5 in/25 AA, 127 mm
    // belt, 32.5 kn, 9,475 long tons, no torpedoes. Cost about $18M
    // (estimate).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_SHIP,
    spec: {
      dispT: 9627,
      main: { count: 15, mm: 152 },
      beltMm: 127,
      speedKn: 32.5,
      rangeNm: 10000,
      torpTubes: 0,
      torpWarheadKg: 0,
      asw: 0,
      aaLight: [],
      aaHeavy: 8,
      aircraft: 4,
      costM: 25,
    },
  },
  {
    id: "usa_cleveland",
    country: "USA",
    family: "ship",
    cls: "cl",
    techs: ["cl_3", "dual_purpose_guns"],
    year: 1942,
    // Cleveland class (27 built): 12 x 6 in/47, 12 x 5 in/38 DP in six
    // twins, 127 mm belt, 32.5 kn, 11,744 long tons; 28 x 40 mm and 10 x
    // 20 mm. Cost about $32M (estimate).
    source: SRC_SHIP,
    spec: {
      dispT: 11932,
      main: { count: 12, mm: 152 },
      secondary: { count: 12, mm: 127 },
      beltMm: 127,
      speedKn: 32.5,
      rangeNm: 11000,
      torpTubes: 0,
      torpWarheadKg: 0,
      asw: 0,
      aaLight: [
        { count: 28, mm: 40 },
        { count: 10, mm: 20 },
      ],
      aaHeavy: 12,
      aircraft: 4,
      costM: 32,
    },
  },
  {
    id: "usa_northampton",
    country: "USA",
    family: "ship",
    cls: "ca",
    techs: [],
    year: 1930,
    // Northampton class: 9 x 8 in/55, 76 mm belt, 32.5 kn, 9,050 long tons,
    // 6 tubes, 4 x 5 in/25 AA. Cost about $16M (estimate).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_SHIP,
    spec: {
      dispT: 9195,
      main: { count: 9, mm: 203 },
      beltMm: 76,
      speedKn: 32.5,
      rangeNm: 6000,
      torpTubes: 6,
      torpWarheadKg: 224,
      asw: 0,
      aaLight: [],
      aaHeavy: 4,
      aircraft: 4,
      costM: 22,
    },
  },
  {
    id: "usa_baltimore",
    country: "USA",
    family: "ship",
    cls: "ca",
    techs: ["ca_3", "dual_purpose_guns"],
    year: 1943,
    // Baltimore class: 9 x 8 in/55, 12 x 5 in/38 DP, 152 mm belt, 33 kn,
    // 13,600 long tons; 48 x 40 mm and 22 x 20 mm in listed fits. Cost
    // about $35M (estimate).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_SHIP,
    spec: {
      dispT: 13818,
      main: { count: 9, mm: 203 },
      secondary: { count: 12, mm: 127 },
      beltMm: 152,
      speedKn: 33,
      rangeNm: 10000,
      torpTubes: 0,
      torpWarheadKg: 0,
      asw: 0,
      aaLight: [
        { count: 48, mm: 40 },
        { count: 22, mm: 20 },
      ],
      aaHeavy: 12,
      aircraft: 4,
      costM: 40,
    },
  },
  {
    id: "usa_colorado",
    country: "USA",
    family: "ship",
    cls: "bb",
    techs: [],
    year: 1923,
    // Colorado class: 8 x 16 in/45, 12 x 5 in/51, 343 mm belt, 21 kn,
    // 32,600 long tons, 8 x 3 in AA. Cost about $41M (estimate).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_SHIP,
    spec: {
      dispT: 33122,
      main: { count: 8, mm: 406 },
      secondary: { count: 12, mm: 127 },
      beltMm: 343,
      speedKn: 21,
      rangeNm: 8000,
      torpTubes: 0,
      torpWarheadKg: 0,
      asw: 0,
      aaLight: [],
      aaHeavy: 8,
      aircraft: 3,
      costM: 55,
    },
  },
  {
    id: "usa_north_carolina",
    country: "USA",
    family: "ship",
    cls: "bb",
    techs: ["bb_3"],
    year: 1941,
    // North Carolina class: 9 x 16 in/45 Mk 6, 20 x 5 in/38 DP, 305 mm
    // belt, 28 kn, 35,000 long tons; 16 x 28 mm as completed. Cost about
    // $76M.
    // Audit w66: A fast treaty battleship of 1941: bb_3, like the King George V, Bismarck, Littorio, Richelieu.
    source: SRC_SHIP,
    spec: {
      dispT: 35560,
      main: { count: 9, mm: 406 },
      secondary: { count: 20, mm: 127 },
      beltMm: 305,
      speedKn: 28,
      rangeNm: 16300,
      torpTubes: 0,
      torpWarheadKg: 0,
      asw: 0,
      aaLight: [{ count: 16, mm: 28 }],
      aaHeavy: 20,
      aircraft: 3,
      costM: 76,
    },
  },
  {
    id: "usa_iowa",
    country: "USA",
    family: "ship",
    cls: "bb",
    techs: ["bb_4", "dual_purpose_guns"],
    year: 1943,
    // Iowa class: 9 x 16 in/50 Mk 7, 20 x 5 in/38 DP, 307 mm belt, 33 kn,
    // 48,110 long tons; 80 x 40 mm and 49 x 20 mm by 1945. Cost about $100M.
    source:
      "Checked 2026-11-04 on Wikipedia: Iowa class ($100M, 48,110 LT, 33 kn, 14,890 nm, 12.1 in belt, 9 x 16 in, 20 x 5 in, 80 x 40, 49 x 20). Cost is that price.",
    spec: {
      dispT: 48880,
      main: { count: 9, mm: 406 },
      secondary: { count: 20, mm: 127 },
      beltMm: 307,
      speedKn: 33,
      rangeNm: 15000,
      torpTubes: 0,
      torpWarheadKg: 0,
      asw: 0,
      aaLight: [
        { count: 80, mm: 40 },
        { count: 49, mm: 20 },
      ],
      aaHeavy: 20,
      aircraft: 3,
      costM: 100,
    },
  },
  {
    id: "usa_lexington",
    country: "USA",
    family: "ship",
    cls: "cv",
    techs: [],
    year: 1927,
    // Lexington class (built on a battlecruiser hull): 8 x 8 in, 12 x 5 in/25
    // AA, 178 mm belt, 33 kn, 36,000 long tons, 78 aircraft. Cost about $44M
    // (estimate).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_SHIP,
    spec: {
      dispT: 36576,
      main: { count: 8, mm: 203 },
      beltMm: 178,
      speedKn: 33,
      rangeNm: 10000,
      torpTubes: 0,
      torpWarheadKg: 0,
      asw: 0,
      aaLight: [],
      aaHeavy: 12,
      aircraft: 78,
      costM: 65,
    },
  },
  {
    id: "usa_yorktown",
    country: "USA",
    family: "ship",
    cls: "cv",
    techs: ["cv_2"],
    year: 1937,
    // Yorktown class: 19,800 long tons, 8 x 5 in/38, 16 x 28 mm, 102 mm
    // belt, 32.5 kn, 90 aircraft. Cost about $33M (estimate).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_SHIP,
    spec: {
      dispT: 20117,
      main: { count: 0, mm: 127 },
      secondary: { count: 8, mm: 127 },
      beltMm: 102,
      speedKn: 32.5,
      rangeNm: 12500,
      torpTubes: 0,
      torpWarheadKg: 0,
      asw: 0,
      aaLight: [{ count: 16, mm: 28 }],
      aaHeavy: 8,
      aircraft: 90,
      costM: 45,
    },
  },
  {
    id: "usa_essex",
    country: "USA",
    family: "ship",
    cls: "cv",
    techs: ["cv_3", "carrier_deck_2"],
    year: 1943,
    // Essex class (24 built): 27,100 long tons, 12 x 5 in/38 (four twin, four
    // single), 32 x 40 mm and 46 x 20 mm, 102 mm belt, 32.7 kn, 90-100
    // aircraft. Cost about $68M.
    source:
      "Checked 2026-11-04 on Wikipedia: Essex class ($68-78M in 1942, 27,066 LT and up, 33 kn, 90-100 aircraft). Cost is the low end.",
    spec: {
      dispT: 27534,
      main: { count: 0, mm: 127 },
      secondary: { count: 12, mm: 127 },
      beltMm: 102,
      speedKn: 32.7,
      rangeNm: 15000,
      torpTubes: 0,
      torpWarheadKg: 0,
      asw: 0,
      aaLight: [
        { count: 32, mm: 40 },
        { count: 46, mm: 20 },
      ],
      aaHeavy: 12,
      aircraft: 95,
      costM: 68,
    },
  },
  {
    id: "usa_salmon",
    country: "USA",
    family: "ship",
    cls: "ss",
    techs: ["ss_2"],
    year: 1938,
    // The start boat: the US starts with ss_2 and its only other boat is the Gato at ss_3.
    source:
      "From memory of the Wikipedia article (Salmon class: 1,450 t surfaced, 21 kn, 11,000 nm, eight tubes); cost an estimate below the Gato's",
    spec: {
      dispT: 1450,
      main: { count: 1, mm: 76 },
      beltMm: 0,
      speedKn: 21,
      rangeNm: 11000,
      torpTubes: 8,
      torpWarheadKg: 290,
      asw: 0,
      aaLight: [],
      aaHeavy: 0,
      aircraft: 0,
      costM: 4.5,
    },
  },
  {
    id: "usa_gato",
    country: "USA",
    family: "ship",
    cls: "ss",
    techs: ["ss_3"],
    year: 1941,
    // Gato class fleet submarine (77 built): 1,525 long tons, 10 tubes (Mk
    // 14, warhead about 290 kg), 20.25 kn, 11,000 nm, one 3 in gun. Cost
    // about $6M (estimate).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_SHIP,
    spec: {
      dispT: 1550,
      main: { count: 1, mm: 76 },
      beltMm: 0,
      speedKn: 20.3,
      rangeNm: 11000,
      torpTubes: 10,
      torpWarheadKg: 290,
      asw: 0,
      aaLight: [{ count: 2, mm: 20 }],
      aaHeavy: 0,
      aircraft: 0,
      costM: 5.5,
    },
  },

  // -------------------------------------------------------------- gear
  {
    id: "usa_m1903a3",
    country: "USA",
    family: "infantry",
    techs: ["inf_eq_1"],
    year: 1936,
    // Springfield M1903A3 bolt-action, .30-06 (7.62 mm), 15 rounds per
    // minute aimed, 500 m. Cost about $40.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    // Audit w66: As above: the rifle of 1936 under inf_eq_1.
    source: SRC_GEAR,
    spec: { mm: 7.62, aimedRpm: 15, rangeM: 500, autoPct: 0, costUsd: 35 },
  },
  {
    id: "usa_m1_garand",
    country: "USA",
    family: "infantry",
    techs: ["inf_eq_2"],
    year: 1937,
    // M1 Garand, the first self-loading rifle to be general issue: 8-round
    // clip, .30-06, about 25 aimed rounds per minute, 500 m. Cost $85 in
    // 1937, $40 by 1944; mid 60.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    // Audit w66: A self-loader, gated like the SVT-40, the G43 and the MAS 49.
    source: SRC_GEAR,
    spec: { mm: 7.62, aimedRpm: 25, rangeM: 500, autoPct: 0, costUsd: 80 },
  },
  {
    id: "usa_jeep",
    country: "USA",
    family: "support",
    techs: ["support_eq_1"],
    year: 1941,
    // Willys MB / Ford GPW quarter-ton 4x4 (640,000 built): range about 480
    // km, cost about $900.
    source: SRC_GEAR,
    spec: { kind: "recon", rangeKm: 480, costUsd: 900 },
  },
  {
    id: "usa_scr300",
    country: "USA",
    family: "support",
    techs: ["support_eq_1"],
    year: 1943,
    // SCR-300 FM backpack radio (the "walkie-talkie"), about 5 km. Cost
    // about $400 (estimate).
    source: SRC_GEAR,
    spec: { kind: "signal", rangeKm: 5, costUsd: 400 },
  },
  {
    id: "usa_cckw",
    country: "USA",
    family: "support",
    techs: ["motorized_2"],
    year: 1941,
    // GMC CCKW 2.5-ton 6x6 truck ("Jimmy", 562,000 built), range about 400
    // km. Cost about $4,000 (estimate).
    source: SRC_GEAR,
    spec: { kind: "transport", rangeKm: 400, costUsd: 4000 },
  },
  {
    id: "usa_m1897",
    country: "USA",
    family: "gun",
    role: "artillery",
    techs: ["artillery_1"],
    year: 1897,
    // French-pattern 75 mm field gun M1897 as the 1936 divisional gun:
    // about 15 rounds per minute, 8,500 m, 6.2 kg shell. Cost about $5k
    // (estimate).
    // Audit w66: The gun of 1936 under artillery_1, so the static key finds it.
    source: SRC_GEAR,
    spec: {
      mm: 75,
      rpm: 10,
      rangeM: 8500,
      shellKg: 6.2,
      penMm500: 0,
      massKg: 1160,
      barrels: 1,
      costK: 5,
    },
  },
  {
    id: "usa_m2a1_105",
    country: "USA",
    family: "gun",
    role: "artillery",
    techs: ["artillery_2"],
    year: 1941,
    // 105 mm howitzer M2A1: sustained 3 rounds per minute (burst 10), 11,160
    // m, 15 kg shell, 2,260 kg. Cost about $8k (estimate).
    // Audit w66: Better than the M1897: artillery_2, like the 25-pounder.
    source: SRC_GEAR,
    spec: {
      mm: 105,
      rpm: 3,
      rangeM: 11160,
      shellKg: 15,
      penMm500: 0,
      massKg: 2260,
      barrels: 1,
      costK: 8,
    },
  },
  {
    id: "usa_m1_155",
    country: "USA",
    family: "gun",
    role: "artillery",
    techs: ["artillery_3"],
    year: 1942,
    // 155 mm howitzer M1 (M114): 1-2 rounds per minute sustained, 14,600 m,
    // 43 kg shell, 5,760 kg. Cost about $20k (estimate).
    // Audit w66: Medium piece: artillery_3, like the British 5.5 in and the Japanese 150 mm.
    source: SRC_GEAR,
    spec: {
      mm: 155,
      rpm: 1.5,
      rangeM: 14600,
      shellKg: 43,
      penMm500: 0,
      massKg: 5760,
      barrels: 1,
      costK: 20,
    },
  },
  {
    id: "usa_m3_37at",
    country: "USA",
    family: "gun",
    role: "anti_tank",
    techs: ["anti_tank_1"],
    year: 1940,
    // 37 mm gun M3: 15 rounds per minute, 0.87 kg APC, about 40 mm at 500 m
    // (sources 35-50), 414 kg. Cost about $2k (estimate).
    // Audit w66: Same 37 mm M3/M6 figure as the Stuart's: 50.
    source: SRC_GEAR,
    spec: {
      mm: 37,
      rpm: 15,
      rangeM: 5000,
      shellKg: 0.87,
      penMm500: 50,
      massKg: 414,
      barrels: 1,
      costK: 2,
    },
  },
  {
    id: "usa_m1_57at",
    country: "USA",
    family: "gun",
    role: "anti_tank",
    techs: ["anti_tank_2"],
    year: 1943,
    // 57 mm gun M1 (the British 6-pounder): 15 rounds per minute, 2.8 kg
    // APCBC, about 75 mm at 500 m, 1,215 kg. Cost about $3.5k (estimate).
    source: SRC_GEAR,
    spec: {
      mm: 57,
      rpm: 15,
      rangeM: 5400,
      shellKg: 2.84,
      penMm500: 75,
      massKg: 1215,
      barrels: 1,
      costK: 3.5,
    },
  },
  {
    id: "usa_m5_76at",
    country: "USA",
    family: "gun",
    role: "anti_tank",
    techs: ["anti_tank_2"],
    year: 1943,
    // 3-inch gun M5 (towed M7): 12 rounds per minute, 6.8 kg APC, about 98
    // mm at 500 m, 2,540 kg. Cost about $6k (estimate).
    // Audit w66: Same 3-inch M62 as the M10: 93.
    source: SRC_GEAR,
    spec: {
      mm: 76,
      rpm: 12,
      rangeM: 14000,
      shellKg: 6.8,
      penMm500: 93,
      massKg: 2540,
      barrels: 1,
      costK: 6,
    },
  },
  {
    id: "usa_m1_40aa",
    country: "USA",
    family: "gun",
    role: "anti_air",
    techs: ["anti_air_1"],
    year: 1941,
    // 40 mm Bofors M1: 120 rounds per minute, 0.9 kg shell, effective
    // ceiling 3,800 m, about 2,400 kg. Cost about $7k (estimate).
    source: SRC_GEAR,
    spec: {
      mm: 40,
      rpm: 120,
      rangeM: 3800,
      shellKg: 0.9,
      penMm500: 0,
      massKg: 2400,
      barrels: 1,
      costK: 7,
    },
  },
  {
    id: "usa_m1_90aa",
    country: "USA",
    family: "gun",
    role: "anti_air",
    techs: ["anti_air_2"],
    year: 1940,
    // 90 mm AA gun M1: 25 rounds per minute, 10.6 kg shell, effective
    // ceiling 8,500 m, 14,500 kg. Cost about $40k (estimate).
    source: SRC_GEAR,
    spec: {
      mm: 90,
      rpm: 25,
      rangeM: 8500,
      shellKg: 10.6,
      penMm500: 0,
      massKg: 14500,
      barrels: 1,
      costK: 40,
    },
  },
  {
    id: "usa_t28",
    country: "USA",
    family: "tank",
    role: "td",
    techs: ["super_heavy_tank", "tank_gun_4"],
    year: 1945,
    // ww85: Casemate 105 mm assault gun, two prototypes built 1945, trials to 1947, never in service. No price found: estimate at the Pershing's 1.9 per tonne. Off-road speed estimated at the Black Prince's ratio to road speed. Slope left at 0: no source gives one.
    source:
      "Checked 2026-11-05 on Wikipedia: T28 Super Heavy Tank (2 built, 86 t, up to 305 mm front, 105 mm T5E1, one .50, 13 km/h, no turret). 105 mm gun T5: 177 mm at 914 m, 30 deg, so about 190 at 500 m. HE filler as the 105 mm on usa_m7_priest.",
    spec: {
      massT: 86,
      hullFrontMm: 305,
      hullSlopeDeg: 0,
      gunMm: 105,
      penMm500: 190,
      heFillerG: 2100,
      mgs: 1,
      offroadKmh: 9,
      roadKmh: 13,
      reliability: 2,
      costK: 165,
    },
  },
  {
    id: "usa_t26e4",
    country: "USA",
    family: "tank",
    role: "heavy",
    techs: ["heavy_tank_3", "tank_gun_4"],
    year: 1945,
    // ww85: Pershing with the long 90 mm T15: 25 built, one fought in Germany in 1945. Armour and speed as usa_m26_pershing without the field add-on plates. Mass is the middle of the M26's 41.9 t and the pilot's added 5 t. Cost is an estimate above the Pershing's 80.
    source:
      "Checked 2026-11-05 on Wikipedia: Super Pershing (25 T26E4, one in action April 1945). LOW CONFIDENCE on penetration: no 30 deg table found. T43 APBC is 193 mm at 500 m, 0 deg on a game wiki, about 155 at 30 deg; period comparisons put it near the 88 mm KwK 43's 185; 170 is the middle.",
    spec: {
      massT: 44,
      hullFrontMm: 102,
      hullSlopeDeg: 46,
      turretFrontMm: 102,
      gunMm: 90,
      penMm500: 170,
      heFillerG: 1000,
      mgs: 3,
      offroadKmh: 22,
      roadKmh: 40,
      reliability: 3,
      costK: 90,
    },
  },
  {
    id: "usa_p80a",
    country: "USA",
    family: "plane",
    type: "fighter",
    techs: ["fighter_3", "jet_airframe_2"],
    year: 1945,
    // ww85: YP-80As reached Italy in early 1945 but it saw no combat in the war. Price a little under $100,000 after the war, so 90.
    source:
      "Checked 2026-11-05: Dave's Warbirds (558 mph, 540 miles, 7,920 lb empty, 14,500 lb maximum, 238 sq ft, six .50), Wikipedia Lockheed P-80 (dates, price). Normal weight 11,700 lb is from memory; the 14,500 lb maximum gives an overload wing loading. Weak source: Wikipedia's specification block is the later P-80C.",
    spec: {
      maxKmh: 898,
      rangeKm: 869,
      emptyKg: 3592,
      wingLoad: 240,
      guns: [{ mm: 12.7, count: 6, rpm: 800 }],
      defGuns: 0,
      bombKg: 907,
      torpedoKg: 0,
      jet: true,
      reliability: 3,
      costK: 90,
    },
  },
  {
    id: "usa_p59b",
    country: "USA",
    family: "plane",
    type: "fighter",
    techs: ["fighter_3", "jet_airframe_2"],
    year: 1944,
    // ww85: America's first jet, delivered from autumn 1944, 66-68 built, slower than good piston fighters and never in combat. No price found: estimate near the P-47's 83. M10 rate from memory.
    source:
      "Checked 2026-11-05 on Wikipedia: Bell P-59 Airacomet (P-59B: 3,704 kg empty, 5,008 kg gross, 35.9 m2, 665 km/h, 604 km, 1 x 37 mm M10, 3 x .50, 2 x 1,000 lb bombs).",
    spec: {
      maxKmh: 665,
      rangeKm: 604,
      emptyKg: 3704,
      wingLoad: 139,
      guns: [
        { mm: 37, count: 1, rpm: 140 },
        { mm: 12.7, count: 3, rpm: 800 },
      ],
      defGuns: 0,
      bombKg: 907,
      torpedoKg: 0,
      jet: true,
      reliability: 2,
      costK: 85,
    },
  },
  {
    id: "usa_p82b",
    country: "USA",
    family: "plane",
    type: "heavy_fighter",
    techs: ["heavy_fighter_3"],
    year: 1946,
    // ww85: Two Merlin Mustangs on one wing: 20 P-82Bs delivered from January 1946. No price found for the Merlin model: estimate near two P-51Ds, not the later F-82's figures.
    source:
      "Checked 2026-11-05: aero-web.org P-82B (776 km/h, 3,542 km, 11,247 kg maximum), Wikipedia North American F-82 (dates, 37.9 m2, 6 x .50, 4 x 450 kg). UNCHECKED: empty weight 6,080 kg and normal weight (wing loading 229) are from memory; no source gives them for the P-82B, the F-82G is 7,256 kg empty.",
    spec: {
      maxKmh: 776,
      rangeKm: 3542,
      emptyKg: 6080,
      wingLoad: 229,
      guns: [{ mm: 12.7, count: 6, rpm: 800 }],
      defGuns: 0,
      bombKg: 1800,
      torpedoKg: 0,
      reliability: 4,
      costK: 110,
    },
  },
  {
    id: "usa_ad1",
    country: "USA",
    family: "plane",
    type: "cv_cas",
    techs: ["cas_3", "carrier_aviation"],
    year: 1946,
    // ww85: First flew March 1945, reached the fleet December 1946, 242 AD-1s. Two 20 mm until the AD-4. No price found: estimate above the SB2C's 60.
    source:
      "Checked 2026-11-05: Military Factory (AD-1: 2 x 20 mm, 8,000 lb, 4,749 kg empty, 8,178 kg maximum, 517 km/h, 2,500 km), Wikipedia Douglas A-1 Skyraider (dates, 37.19 m2). Speed 500-590 km/h by source; empty 4,577-5,585 kg, mostly later marks. Wing loading from a normal weight near 7,250 kg, an estimate.",
    spec: {
      maxKmh: 517,
      rangeKm: 2500,
      emptyKg: 4749,
      wingLoad: 195,
      guns: [{ mm: 20, count: 2, rpm: 650 }],
      defGuns: 0,
      bombKg: 3600,
      torpedoKg: 970,
      dive: true,
      reliability: 4,
      costK: 70,
    },
  },
  {
    id: "usa_c54",
    country: "USA",
    family: "plane",
    type: "transport_plane",
    techs: ["transport_plane_2"],
    year: 1942,
    // ww85: Four-engined long-range transport, 1,170 built. No price found: estimate just above the B-24J's 215.
    source:
      "Checked 2026-11-05 on Wikipedia: Douglas C-54 Skymaster (C-54G: 17,658 kg empty, 28,123 kg gross, 136 m2, 443 km/h, 6,400 km with 4,000 lb, service 1942).",
    spec: {
      maxKmh: 443,
      rangeKm: 6400,
      emptyKg: 17658,
      wingLoad: 207,
      guns: [],
      defGuns: 0,
      bombKg: 0,
      torpedoKg: 0,
      reliability: 5,
      costK: 230,
    },
  },
  {
    id: "usa_pb4y2",
    country: "USA",
    family: "plane",
    type: "naval_bomber",
    techs: ["naval_bomber_3"],
    year: 1944,
    // ww85: Single-fin Navy patrol Liberator, squadrons from early 1944, 739 built. Wing loading and price as usa_b24j; the 65,000 lb weight is an overload one. Radar on patrol sets.
    source:
      "Checked 2026-11-05 on Wikipedia: Consolidated PB4Y-2 Privateer (12,467 kg empty, 97.4 m2, 398 km/h, 4,230 km with 910 kg, 12 x .50, 3,600 kg of bombs, mines or torpedoes, AN/APS-2).",
    spec: {
      maxKmh: 398,
      rangeKm: 4230,
      emptyKg: 12467,
      wingLoad: 257,
      guns: [],
      defGuns: 12,
      bombKg: 3600,
      torpedoKg: 0,
      radar: true,
      reliability: 4,
      costK: 215,
    },
  },
  {
    id: "usa_alaska",
    country: "USA",
    family: "ship",
    cls: "bc",
    techs: ["bc_3", "dual_purpose_guns"],
    year: 1944,
    // ww85: Two completed, June and September 1944. No class price found: cost at the North Carolina's rate per tonne. No battlecruiser hull after bc_3, so the gate opens early, like Baltimore's.
    source:
      "Checked 2026-11-05 on Wikipedia: Alaska-class cruiser (29,771 LT standard, 9 x 12 in, 12 x 5 in, 9 in belt, 33 kn, 12,000 nm, 56 x 40 mm, 34 x 20 mm, 4 aircraft).",
    spec: {
      dispT: 30249,
      main: { count: 9, mm: 305 },
      secondary: { count: 12, mm: 127 },
      beltMm: 229,
      speedKn: 33,
      rangeNm: 12000,
      torpTubes: 0,
      torpWarheadKg: 0,
      asw: 0,
      aaLight: [
        { count: 56, mm: 40 },
        { count: 34, mm: 20 },
      ],
      aaHeavy: 12,
      aircraft: 4,
      costM: 65,
    },
  },
  {
    id: "usa_midway",
    country: "USA",
    family: "ship",
    cls: "cv",
    techs: ["cv_4", "carrier_deck_2"],
    year: 1945,
    // ww85: USS Midway commissioned 10 September 1945. No build price found: cost at about $2,200 a tonne, the low end of the US carrier band. Range is Essex's, the article gives none.
    source:
      "Checked 2026-11-05 on Wikipedia: Midway-class aircraft carrier (45,000 LT standard, 18 x 5 in/54, 21 quad 40 mm, 28 twin 20 mm, 7.6 in belt, 33 kn, up to 130 aircraft).",
    spec: {
      dispT: 45722,
      main: { count: 0, mm: 127 },
      secondary: { count: 18, mm: 127 },
      beltMm: 193,
      speedKn: 33,
      rangeNm: 15000,
      torpTubes: 0,
      torpWarheadKg: 0,
      asw: 0,
      aaLight: [
        { count: 84, mm: 40 },
        { count: 56, mm: 20 },
      ],
      aaHeavy: 18,
      aircraft: 130,
      costM: 100,
    },
  },
  {
    id: "usa_gearing",
    country: "USA",
    family: "ship",
    cls: "dd",
    techs: ["dd_4"],
    year: 1945,
    // ww85: USS Gearing commissioned 3 May 1945. No price found: cost at the Fletcher's rate per tonne. Torpedo warhead as usa_fletcher.
    source:
      "Checked 2026-11-05 on Wikipedia: Gearing-class destroyer (2,616 LT standard, 6 x 5 in, 12 x 40 mm, 11 x 20 mm, 10 tubes, 36.8 kn, 4,500 nm at 20 kn).",
    spec: {
      dispT: 2658,
      main: { count: 6, mm: 127 },
      beltMm: 0,
      speedKn: 36.8,
      rangeNm: 4500,
      torpTubes: 10,
      torpWarheadKg: 224,
      asw: 2,
      aaLight: [
        { count: 12, mm: 40 },
        { count: 11, mm: 20 },
      ],
      aaHeavy: 6,
      aircraft: 0,
      costM: 8.3,
    },
  },
  {
    id: "usa_tench",
    country: "USA",
    family: "ship",
    cls: "ss",
    techs: ["ss_4"],
    year: 1944,
    // ww85: USS Tench commissioned October 1944. No price found: cost at the Gato's rate per tonne. Warhead as usa_gato.
    source:
      "Checked 2026-11-05 on Wikipedia: Tench-class submarine (1,570 LT surfaced, 10 tubes, 5 in/25, one 40 mm, twin 20 mm, 20.25 kn, 11,000 nm at 10 kn).",
    spec: {
      dispT: 1595,
      main: { count: 1, mm: 127 },
      beltMm: 0,
      speedKn: 20.25,
      rangeNm: 11000,
      torpTubes: 10,
      torpWarheadKg: 290,
      asw: 0,
      aaLight: [
        { count: 1, mm: 40 },
        { count: 2, mm: 20 },
      ],
      aaHeavy: 0,
      aircraft: 0,
      costM: 5.7,
    },
  },
  {
    id: "usa_fargo",
    country: "USA",
    family: "ship",
    cls: "cl",
    techs: ["cl_4", "dual_purpose_guns"],
    year: 1945,
    // ww85: USS Fargo commissioned 9 December 1945. A single-funnel Cleveland, so cost and aircraft as usa_cleveland.
    source:
      "Checked 2026-11-05 on Wikipedia: Fargo-class cruiser (11,744 LT standard, 12 x 6 in, 12 x 5 in, 4 quad and 6 twin 40 mm, 20 x 20 mm, 127 mm belt, 32.5 kn, 20,000 km at 15 kn).",
    spec: {
      dispT: 11932,
      main: { count: 12, mm: 152 },
      secondary: { count: 12, mm: 127 },
      beltMm: 127,
      speedKn: 32.5,
      rangeNm: 10800,
      torpTubes: 0,
      torpWarheadKg: 0,
      asw: 0,
      aaLight: [
        { count: 28, mm: 40 },
        { count: 20, mm: 20 },
      ],
      aaHeavy: 12,
      aircraft: 4,
      costM: 32,
    },
  },
];
