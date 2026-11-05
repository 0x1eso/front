// World War 1936 historical catalogue: Germany. The worked example of the
// entry format (tanks and tracked vehicles; the data lane adds planes,
// ships, infantry, support and guns here, in the same file).
//
// Conventions (see Types.ts): armour in mm, slope from the vertical,
// penetration at 500 m / 30 degrees with the normal AP round, cost in
// thousand 1940 US dollars as an industrial estimate (combat-ready RM prices at
// 2.5 per dollar for tanks, the ww66 report's table for the rest),
// reliability 1..5 from the history. Each entry cites its source; where the
// references disagree a middle value is used and the disagreement noted.
// Armour and penetration figures follow Jentz and Doyle, "Panzer Tracts"
// and the penetration tables in Wikipedia's gun articles; costs follow
// Spielberger, "Der Panzerkampfwagen" series (price in RM per vehicle); the
// sources named were not all re-read, see each `source` string.
import type { HistEntry } from "./Types";

const SRC_AIR =
  "From memory of Wikipedia aircraft articles (Green, Warplanes of the Third Reich is the usual print source); Bf 109 G-6 checked on Wikipedia; prices are estimates";
const SRC_SHIP =
  "From memory of Wikipedia class articles (Gröner is the print source); Bismarck checked on Wikipedia; costs are estimates in US dollars";
const SRC_GEAR =
  "From memory of Wikipedia weapon articles (Hogg for the artillery); costs are estimates in US dollars";
const SRC_PT =
  "Figures from memory of Panzer Tracts (Jentz, Doyle) and Wikipedia tank articles; Tiger I, Bismarck and Bf 109 G checked on Wikipedia 2026-11-04";

export const DEU_HIST: readonly HistEntry[] = [
  {
    id: "deu_pz1_b",
    country: "DEU",
    family: "tank",
    role: "light",
    techs: ["light_tank_1"],
    year: 1935,
    // 6 t, 13 mm all round, two MG 13/34; about RM 37,000 (Spielberger).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_PT,
    spec: {
      massT: 5.8,
      hullFrontMm: 13,
      hullSlopeDeg: 0,
      turretFrontMm: 13,
      gunMm: 8,
      penMm500: 0,
      heFillerG: 0,
      mgs: 2,
      offroadKmh: 20,
      roadKmh: 40,
      reliability: 3,
      costK: 15,
    },
  },
  {
    id: "deu_pz2_c",
    country: "DEU",
    family: "tank",
    role: "light",
    techs: ["light_tank_1"],
    year: 1938,
    // 20 mm KwK 30, 14.5 mm armour; 20 mm PzGr about 16 mm at 500 m
    // (references give 14-20 mm); RM 49,000.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_PT,
    spec: {
      massT: 9.5,
      hullFrontMm: 14.5,
      hullSlopeDeg: 0,
      turretFrontMm: 14.5,
      gunMm: 20,
      penMm500: 16,
      heFillerG: 4,
      mgs: 1,
      offroadKmh: 20,
      roadKmh: 40,
      reliability: 4,
      costK: 20,
    },
  },
  {
    id: "deu_pz38t_c",
    country: "DEU",
    family: "tank",
    role: "light",
    techs: ["light_tank_2"],
    year: 1939,
    // Czech Skoda design in German service; 25 mm front, 37 mm KwK 38(t),
    // very reliable. Price RM about 52,000 (references differ, mid value).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_PT,
    spec: {
      massT: 9.4,
      hullFrontMm: 25,
      hullSlopeDeg: 0,
      turretFrontMm: 25,
      gunMm: 37,
      penMm500: 29,
      heFillerG: 20,
      mgs: 2,
      offroadKmh: 22,
      roadKmh: 42,
      reliability: 5,
      costK: 22,
    },
  },
  {
    id: "deu_pz3_e",
    country: "DEU",
    family: "tank",
    role: "medium",
    techs: ["medium_tank_1"],
    year: 1939,
    // 37 mm KwK 36 (PzGr about 29 mm at 500 m), 30 mm armour, RM 96,163.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_PT,
    spec: {
      massT: 19.5,
      hullFrontMm: 30,
      hullSlopeDeg: 9,
      turretFrontMm: 30,
      gunMm: 37,
      penMm500: 29,
      heFillerG: 25,
      mgs: 3,
      offroadKmh: 20,
      roadKmh: 40,
      reliability: 4,
      costK: 40,
    },
  },
  {
    id: "deu_pz3_j",
    country: "DEU",
    family: "tank",
    role: "medium",
    techs: ["medium_tank_2"],
    year: 1941,
    // 50 mm KwK 38 L/42 (PzGr 39 about 50 mm at 500 m, sources 40-60),
    // 50 mm front (added plate on the hull); RM 96,000.
    // Audit w66: 5 cm KwK 38 L/42 PzGr 39 is 47 mm at 500 m, 30 deg (Wikipedia).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source:
      "Checked 2026-11-04 on Wikipedia: Panzer III (Ausf. J 50 mm front, 40/20 km/h, RM 103,163 for the Ausf. M), 5 cm KwK 38 (47 mm at 500 m, 30 deg). Other figures from memory; cost an estimate unless stated.",
    spec: {
      massT: 21.5,
      hullFrontMm: 50,
      hullSlopeDeg: 9,
      turretFrontMm: 50,
      gunMm: 50,
      penMm500: 47,
      heFillerG: 100,
      mgs: 2,
      offroadKmh: 20,
      roadKmh: 40,
      reliability: 4,
      costK: 42,
    },
  },
  {
    id: "deu_pz4_d",
    country: "DEU",
    family: "tank",
    role: "medium",
    techs: ["medium_tank_1", "artillery_1"],
    year: 1939,
    // Support tank with the short 75 mm KwK 37 L/24 (PzGr about 38 mm at
    // 500 m, HE shell 680 g filler), 30 mm armour. RM about 103,000.
    // Audit w66: 7.5 cm KwK 37 L/24 is 39 mm (Wikipedia).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_PT,
    spec: {
      massT: 20,
      hullFrontMm: 30,
      hullSlopeDeg: 9,
      turretFrontMm: 30,
      gunMm: 75,
      penMm500: 39,
      heFillerG: 680,
      mgs: 2,
      offroadKmh: 20,
      roadKmh: 40,
      reliability: 4,
      costK: 42,
    },
  },
  {
    id: "deu_pz4_h",
    country: "DEU",
    family: "tank",
    role: "medium",
    techs: ["medium_tank_2", "tank_gun_3"],
    year: 1943,
    // 75 mm KwK 40 L/48 (PzGr 39: 89 mm at 500 m), 80 mm hull front plate,
    // 50 mm turret front. RM 103,462.
    // Audit w66: 7.5 cm KwK 40 L/48 is 96 mm (Wikipedia).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source:
      "Checked 2026-11-04 on Wikipedia: Panzer IV (RM 103,462, 38-42 km/h road, 16 off-road; entry keeps 18), 7.5 cm KwK 40 (L/48 96 mm, L/43 91 mm at 500 m, 30 deg). Other figures from memory; cost an estimate unless stated.",
    spec: {
      massT: 25.7,
      hullFrontMm: 80,
      hullSlopeDeg: 10,
      turretFrontMm: 50,
      gunMm: 75,
      penMm500: 96,
      heFillerG: 680,
      mgs: 2,
      offroadKmh: 18,
      roadKmh: 38,
      reliability: 4,
      costK: 46,
    },
  },
  {
    id: "deu_panther_a",
    country: "DEU",
    family: "tank",
    role: "medium",
    techs: ["medium_tank_3", "tank_gun_4"],
    year: 1943,
    // 75 mm KwK 42 L/70 (PzGr 39/42 about 138 mm at 500 m), 80 mm glacis at
    // 55 degrees, 110 mm turret front; poor early reliability. RM 117,100.
    // Audit w66: 138 mm was the 100 m figure; KwK 42 is 124 mm at 500 m, 30 deg (Wikipedia).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source:
      "Checked 2026-11-04 on Wikipedia: Panther tank (44.8 t, 46 km/h, RM 117,100 without weapons, 143,912 combat ready), 7.5 cm KwK 42 (124 mm at 500 m, 30 deg). Cost: combat-ready RM at 2.5. Other figures from memory; cost an estimate unless stated.",
    spec: {
      massT: 44.8,
      hullFrontMm: 80,
      hullSlopeDeg: 55,
      turretFrontMm: 110,
      gunMm: 75,
      penMm500: 124,
      heFillerG: 680,
      mgs: 2,
      offroadKmh: 25,
      roadKmh: 46,
      reliability: 2,
      // Real price 58 (RM 143,912 at 2.5): the owner allows a step up to 2-3 times
      // a contemporary, so quantity counts against its front armour.
      costK: 180,
    },
  },
  {
    id: "deu_tiger1_e",
    country: "DEU",
    family: "tank",
    role: "heavy",
    techs: ["heavy_tank_1", "tank_gun_3"],
    year: 1942,
    // 88 mm KwK 36 L/56 (PzGr 39 about 110 mm at 500 m; sources 100-120),
    // 100 mm front, 100 mm turret; heavy and temperamental. RM 250,800.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source:
      "Checked 2026-11-04 on Wikipedia: Tiger I (57 t, 20-25 km/h off-road, RM 250,700 without weapons, 299,800 combat ready, 25-120 mm), 8.8 cm KwK 36 (110 mm at 500 m, 30 deg). Cost: combat-ready RM at 2.5. Other figures from memory; cost an estimate unless stated.",
    spec: {
      massT: 57,
      hullFrontMm: 100,
      hullSlopeDeg: 9,
      turretFrontMm: 100,
      gunMm: 88,
      penMm500: 110,
      heFillerG: 870,
      mgs: 2,
      offroadKmh: 20,
      roadKmh: 38,
      reliability: 2,
      costK: 120,
    },
  },
  {
    id: "deu_tiger2_b",
    country: "DEU",
    family: "tank",
    role: "heavy",
    techs: ["heavy_tank_3", "tank_gun_4"],
    year: 1944,
    // 88 mm KwK 43 L/71 (about 210 mm at 500 m; sources 190-220), 150 mm
    // glacis at 50 degrees, 185 mm turret front; the least reliable of them.
    // RM 321,500.
    // Audit w66: KwK 43 PzGr 39/43 is 185 mm at 500 m, 30 deg; 202 is at 100 m (Wikipedia, 8.8 cm Pak 43).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source:
      "Checked 2026-11-04 on Wikipedia: Tiger II (69.8 t, 25-185 mm, 41.5 km/h, RM 321,500), 8.8 cm Pak 43 (185 mm at 500 m, 30 deg). Other figures from memory; cost an estimate unless stated.",
    spec: {
      massT: 69.8,
      hullFrontMm: 150,
      hullSlopeDeg: 50,
      turretFrontMm: 185,
      gunMm: 88,
      penMm500: 185,
      heFillerG: 870,
      mgs: 2,
      offroadKmh: 17,
      roadKmh: 38,
      reliability: 1,
      costK: 150,
    },
  },
  {
    id: "deu_stug3_g",
    country: "DEU",
    family: "tank",
    role: "td",
    techs: ["medium_tank_2", "tank_gun_3"],
    year: 1942,
    // Assault gun, no turret: 75 mm StuK 40 L/48 (89 mm at 500 m), 80 mm
    // front (applique), cheap for what it does. RM 82,500.
    // Audit w66: 7.5 cm StuK 40 L/48 is 96 mm, as the KwK 40 L/48.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source:
      "Checked 2026-11-04 on Wikipedia: StuG III (23.9 t, 16-80 mm, 40 km/h, RM 82,500). Other figures from memory; cost an estimate unless stated.",
    spec: {
      massT: 23.9,
      hullFrontMm: 80,
      hullSlopeDeg: 10,
      gunMm: 75,
      penMm500: 96,
      heFillerG: 680,
      mgs: 1,
      offroadKmh: 20,
      roadKmh: 40,
      reliability: 4,
      costK: 36,
    },
  },
  {
    id: "deu_hummel",
    country: "DEU",
    family: "tank",
    role: "spa",
    techs: ["medium_tank_2", "artillery_2"],
    year: 1943,
    // 15 cm sFH 18 on a Pz III/IV chassis, open-topped, 30 mm hull front;
    // HE shell about 5 kg filler. RM about 115,000.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_PT,
    spec: {
      massT: 24,
      hullFrontMm: 30,
      hullSlopeDeg: 10,
      gunMm: 150,
      penMm500: 0,
      heFillerG: 5000,
      mgs: 1,
      offroadKmh: 20,
      roadKmh: 42,
      openTop: true,
      reliability: 3,
      costK: 44,
    },
  },
  {
    id: "deu_wirbelwind",
    country: "DEU",
    family: "tank",
    role: "spaa",
    techs: ["medium_tank_2", "anti_air_1"],
    year: 1944,
    // Quad 2 cm Flakvierling 38 in an open turret on a Pz IV chassis (about
    // 450 rounds per minute per barrel); RM about 80,000.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    // Audit w66: Quad 2 cm on a Pz IV chassis: same gate as the Crusader AA Mk II; medium_tank_3 was not this chassis's level.
    source: SRC_PT,
    spec: {
      massT: 22,
      hullFrontMm: 80,
      hullSlopeDeg: 10,
      turretFrontMm: 16,
      gunMm: 20,
      penMm500: 16,
      heFillerG: 4,
      mgs: 0,
      offroadKmh: 18,
      roadKmh: 38,
      openTop: true,
      reliability: 3,
      costK: 44,
      aa: { barrels: 4, rpm: 450, mm: 20 },
    },
  },

  // ---------------------------------------------------------------- more tanks
  {
    id: "deu_sdkfz222",
    country: "DEU",
    family: "tank",
    role: "light",
    techs: ["light_tank_1"],
    year: 1936,
    // Four-wheel armoured car, 20 mm KwK 30 and one MG 34; armour 8-14.5 mm.
    // Price about RM 23,000 (references differ; mid value).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_PT,
    spec: {
      massT: 4.8,
      hullFrontMm: 14.5,
      hullSlopeDeg: 0,
      turretFrontMm: 8,
      gunMm: 20,
      penMm500: 16,
      heFillerG: 4,
      mgs: 1,
      offroadKmh: 30,
      roadKmh: 80,
      wheeled: true,
      reliability: 3,
      costK: 12,
    },
  },
  {
    id: "deu_sdkfz231",
    country: "DEU",
    family: "tank",
    role: "light",
    techs: ["light_tank_1"],
    year: 1936,
    // Heavy eight-wheel armoured car (8-Rad), 20 mm KwK 30, 14.5 mm front;
    // price about RM 40,000 (estimate from Spielberger, mid value).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_PT,
    spec: {
      massT: 8.3,
      hullFrontMm: 14.5,
      hullSlopeDeg: 0,
      turretFrontMm: 14.5,
      gunMm: 20,
      penMm500: 16,
      heFillerG: 4,
      mgs: 1,
      offroadKmh: 30,
      roadKmh: 85,
      wheeled: true,
      reliability: 3,
      costK: 22,
    },
  },
  {
    id: "deu_puma",
    country: "DEU",
    family: "tank",
    role: "light",
    techs: ["light_tank_2", "tank_gun_2"],
    year: 1943,
    // Sd.Kfz. 234/2 eight-wheel armoured car, 50 mm KwK 39/1 L/60 (PzGr 39
    // 59-86 mm at 500 m by source, 75 used), 30 mm sloped front; complex and
    // only 101 built. Price estimated at RM 80,000.
    // Audit w66: 5 cm KwK 39/1 L/60 is 59 mm at 500 m, 30 deg (Wikipedia, 5 cm KwK 39); 75 was above the gun.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_PT,
    spec: {
      massT: 11.7,
      hullFrontMm: 30,
      hullSlopeDeg: 45,
      turretFrontMm: 30,
      gunMm: 50,
      penMm500: 59,
      heFillerG: 100,
      mgs: 1,
      offroadKmh: 30,
      roadKmh: 90,
      wheeled: true,
      reliability: 3,
      costK: 36,
    },
  },
  {
    id: "deu_pz4_f2",
    country: "DEU",
    family: "tank",
    role: "medium",
    techs: ["medium_tank_2", "tank_gun_2"],
    year: 1942,
    // First Pz IV with the long 75 mm KwK 40 L/43 (PzGr 39 about 82 mm at
    // 500 m; L/48 89 mm), 50 mm front and turret; price as the other Pz IV.
    // Audit w66: 7.5 cm L/43 is 91 mm at 500 m, 30 deg (Wikipedia, 7.5 cm KwK 40).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_PT,
    spec: {
      massT: 23.6,
      hullFrontMm: 50,
      hullSlopeDeg: 9,
      turretFrontMm: 50,
      gunMm: 75,
      penMm500: 91,
      heFillerG: 680,
      mgs: 2,
      offroadKmh: 20,
      roadKmh: 40,
      reliability: 4,
      costK: 44,
    },
  },
  {
    id: "deu_stug3_b",
    country: "DEU",
    family: "tank",
    role: "td",
    techs: ["medium_tank_1", "artillery_1"],
    year: 1940,
    // Early assault gun, short 75 mm StuK 37 L/24 (PzGr about 38 mm at 500 m,
    // 680 g HE filler), 50 mm front; RM about 80,000 (Spielberger, mid).
    // Audit w66: 7.5 cm StuK 37 L/24 is 39 mm, as the KwK 37.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_PT,
    spec: {
      massT: 20.2,
      hullFrontMm: 50,
      hullSlopeDeg: 9,
      gunMm: 75,
      penMm500: 39,
      heFillerG: 680,
      mgs: 0,
      offroadKmh: 20,
      roadKmh: 40,
      reliability: 4,
      costK: 33,
    },
  },
  {
    id: "deu_hetzer",
    country: "DEU",
    family: "tank",
    role: "td",
    techs: ["light_tank_2", "tank_gun_3"],
    year: 1944,
    // Jagdpanzer 38(t): 75 mm Pak 39 L/48 (89 mm at 500 m as the KwK 40
    // L/48), 60 mm front at 60 degrees, cheap and reliable. About RM 60,000.
    // Audit w66: PaK 39 L/48 is 96 mm; nose-heavy and overloaded, reliability 3. Armour stays 60 mm at 60 deg, the real plate: see the conversion report on casemates.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source:
      "Checked 2026-11-04 on Wikipedia: Jagdpanzer 38(t) (15.75 t, 8-60 mm). Slope and gun figure from memory; cost an estimate.",
    spec: {
      massT: 15.75,
      hullFrontMm: 60,
      hullSlopeDeg: 60,
      gunMm: 75,
      penMm500: 96,
      heFillerG: 680,
      mgs: 1,
      offroadKmh: 15,
      roadKmh: 39,
      reliability: 3,
      costK: 24,
    },
  },
  {
    id: "deu_jagdpz4_70",
    country: "DEU",
    family: "tank",
    role: "td",
    techs: ["medium_tank_3", "tank_gun_4"],
    year: 1944,
    // Jagdpanzer IV/70(V): 75 mm StuK 42 L/70 (as the Panther's, 138 mm at
    // 500 m), 80 mm front at about 50 degrees; front-heavy, wore its drive.
    // Price estimated at RM 90,000.
    // Audit w66: PaK 42 L/70 is the KwK 42's gun: 124 mm, not the 100 m figure.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_PT,
    spec: {
      massT: 25.8,
      hullFrontMm: 80,
      hullSlopeDeg: 50,
      gunMm: 75,
      penMm500: 124,
      heFillerG: 680,
      mgs: 1,
      offroadKmh: 20,
      roadKmh: 35,
      reliability: 3,
      costK: 44,
    },
  },
  {
    id: "deu_jagdpanther",
    country: "DEU",
    family: "tank",
    role: "td",
    techs: ["medium_tank_3", "tank_gun_4"],
    year: 1944,
    // Panther chassis with the 88 mm Pak 43/3 L/71 (about 210 mm at 500 m,
    // as the Tiger II gun), 80 mm glacis at 55 degrees. RM about 117,000
    // (the Panther's price; references differ).
    // Audit w66: PaK 43/3 is 185 mm at 500 m, 30 deg.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_PT,
    spec: {
      massT: 45.5,
      hullFrontMm: 80,
      hullSlopeDeg: 55,
      gunMm: 88,
      penMm500: 185,
      heFillerG: 870,
      mgs: 1,
      offroadKmh: 25,
      roadKmh: 46,
      reliability: 2,
      costK: 64,
    },
  },
  {
    id: "deu_wespe",
    country: "DEU",
    family: "tank",
    role: "spa",
    techs: ["light_tank_2", "artillery_1"],
    year: 1943,
    // 10.5 cm leFH 18/2 on a Pz II chassis, open-topped, about 20 mm front;
    // HE shell about 1.4 kg filler. Price about RM 52,000.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_PT,
    spec: {
      massT: 11,
      hullFrontMm: 20,
      hullSlopeDeg: 0,
      gunMm: 105,
      penMm500: 0,
      heFillerG: 1400,
      mgs: 0,
      offroadKmh: 20,
      roadKmh: 40,
      openTop: true,
      reliability: 3,
      costK: 24,
    },
  },
  {
    id: "deu_brummbaer",
    country: "DEU",
    family: "tank",
    role: "spa",
    techs: ["medium_tank_2", "artillery_2"],
    year: 1943,
    // Sturmpanzer IV: 15 cm StuH 43 L/12 assault howitzer on a Pz IV chassis,
    // 100 mm sloped casemate front (about 40 degrees), slow. Price estimated
    // at RM 100,000.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_PT,
    spec: {
      massT: 28.2,
      hullFrontMm: 100,
      hullSlopeDeg: 40,
      gunMm: 150,
      penMm500: 0,
      heFillerG: 4000,
      mgs: 1,
      offroadKmh: 20,
      roadKmh: 40,
      reliability: 3,
      costK: 46,
    },
  },
  {
    id: "deu_moebelwagen",
    country: "DEU",
    family: "tank",
    role: "spaa",
    techs: ["medium_tank_2", "anti_air_2"],
    year: 1944,
    // 3.7 cm Flak 43 (about 250 rounds per minute) in an open box on a Pz IV
    // chassis, 25 mm shield; price estimated at RM 90,000.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_PT,
    spec: {
      massT: 25,
      hullFrontMm: 80,
      hullSlopeDeg: 10,
      turretFrontMm: 25,
      gunMm: 37,
      penMm500: 30,
      heFillerG: 30,
      mgs: 0,
      offroadKmh: 18,
      roadKmh: 38,
      openTop: true,
      reliability: 3,
      costK: 42,
      aa: { barrels: 1, rpm: 250, mm: 37 },
    },
  },

  // ---------------------------------------------------------------- planes
  // Figures from Wikipedia aircraft articles and Green, "Warplanes of the
  // Third Reich"; prices (RM at 2.5 per dollar) from Griehl and the
  // Luftwaffe production tables, where references differ a mid value is used
  // and several are estimates (noted per entry).
  {
    id: "deu_he51",
    country: "DEU",
    family: "plane",
    type: "fighter",
    techs: [],
    year: 1935,
    // Biplane in squadron service in 1936; the 109 B only arrived in 1937. Stands for the start stock.
    source:
      "From memory of the Wikipedia article (He 51 B-1: about 1,460 kg empty, 1,900 kg on 27.2 m2, 330 km/h, 570 km, two MG 17); cost an estimate",
    spec: {
      maxKmh: 330,
      rangeKm: 570,
      emptyKg: 1460,
      wingLoad: 70,
      guns: [{ mm: 7.92, count: 2, rpm: 1100 }],
      defGuns: 0,
      bombKg: 0,
      torpedoKg: 0,
      reliability: 4,
      costK: 12,
    },
  },
  {
    id: "deu_bf109_e",
    country: "DEU",
    family: "plane",
    type: "fighter",
    techs: ["fighter_1"],
    year: 1939,
    // Bf 109 E-3: 2 x MG 17 + 2 x 20 mm MG FF/M; about RM 58,000 (estimate).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 570,
      rangeKm: 660,
      emptyKg: 2000,
      wingLoad: 172,
      guns: [
        { mm: 7.9, count: 2, rpm: 1100 },
        { mm: 20, count: 2, rpm: 520 },
      ],
      defGuns: 0,
      bombKg: 0,
      torpedoKg: 0,
      reliability: 4,
      costK: 30,
    },
  },
  {
    id: "deu_bf109_t",
    country: "DEU",
    family: "plane",
    type: "cv_fighter",
    techs: ["fighter_1", "carrier_aviation"],
    year: 1940,
    // Bf 109 T-1, the carrier version for the Graf Zeppelin (long wing, arrester
    // hook), same guns as the E; only land-based in the end. Range and weights
    // approximate.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 575,
      rangeKm: 660,
      emptyKg: 2000,
      wingLoad: 150,
      guns: [
        { mm: 7.9, count: 2, rpm: 1100 },
        { mm: 20, count: 2, rpm: 520 },
      ],
      defGuns: 0,
      bombKg: 0,
      torpedoKg: 0,
      reliability: 3,
      costK: 34,
    },
  },
  {
    id: "deu_bf109_f4",
    country: "DEU",
    family: "plane",
    type: "fighter",
    techs: ["fighter_2"],
    year: 1941,
    // Bf 109 F-4: 1 x 20 mm MG 151/20 in the nose + 2 x MG 17; the cleanest 109.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 635,
      rangeKm: 700,
      emptyKg: 2100,
      wingLoad: 185,
      guns: [
        { mm: 7.9, count: 2, rpm: 1100 },
        { mm: 20, count: 1, rpm: 700 },
      ],
      defGuns: 0,
      bombKg: 0,
      torpedoKg: 0,
      reliability: 4,
      costK: 30,
    },
  },
  {
    id: "deu_bf109_g6",
    country: "DEU",
    family: "plane",
    type: "fighter",
    techs: ["fighter_2", "aero_engine_2"],
    year: 1943,
    // Bf 109 G-6: 1 x 20 mm MG 151/20 + 2 x 13 mm MG 131 (cowl bulges); 642 km/h
    // at 6,300 m, 2,247 kg empty (Wikipedia).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source:
      "Checked 2026-11-04 on Wikipedia: Messerschmitt Bf 109 (G-6: 2,247 kg empty, 3,148 kg on 16.05 m2, 880 km). Other figures from memory; cost an estimate unless stated.",
    spec: {
      maxKmh: 640,
      rangeKm: 880,
      emptyKg: 2247,
      wingLoad: 196,
      guns: [
        { mm: 13, count: 2, rpm: 900 },
        { mm: 20, count: 1, rpm: 700 },
      ],
      defGuns: 0,
      bombKg: 0,
      torpedoKg: 0,
      reliability: 4,
      costK: 32,
    },
  },
  {
    id: "deu_bf109_k4",
    country: "DEU",
    family: "plane",
    type: "fighter",
    techs: ["fighter_3", "aero_engine_3"],
    year: 1944,
    // Bf 109 K-4: 1 x 30 mm MK 108 + 2 x 13 mm MG 131; 710 km/h, short legs.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 710,
      rangeKm: 600,
      emptyKg: 2350,
      wingLoad: 200,
      guns: [
        { mm: 13, count: 2, rpm: 900 },
        { mm: 30, count: 1, rpm: 650 },
      ],
      defGuns: 0,
      bombKg: 0,
      torpedoKg: 0,
      reliability: 3,
      costK: 32,
    },
  },
  {
    id: "deu_fw190_a3",
    country: "DEU",
    family: "plane",
    type: "fighter",
    techs: ["fighter_2", "aircraft_cannon_1"],
    year: 1941,
    // Fw 190 A-3: 2 x MG 17, 2 x 20 mm MG 151/20, 2 x 20 mm MG FF/M; BMW 801
    // with early engine trouble.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 635,
      rangeKm: 800,
      emptyKg: 2950,
      wingLoad: 215,
      guns: [
        { mm: 7.9, count: 2, rpm: 1100 },
        { mm: 20, count: 2, rpm: 700 },
        { mm: 20, count: 2, rpm: 520 },
      ],
      defGuns: 0,
      bombKg: 0,
      torpedoKg: 0,
      reliability: 3,
      costK: 36,
    },
  },
  {
    id: "deu_fw190_a8",
    country: "DEU",
    family: "plane",
    type: "fighter",
    techs: ["fighter_3", "aircraft_cannon_2"],
    year: 1944,
    // Fw 190 A-8: 2 x 13 mm MG 131 + 4 x 20 mm MG 151/20, 650 km/h class
    // (653 at altitude), heavy.
    // Audit w66: BMW 801 cured by this model: reliability 4.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source:
      "Checked 2026-11-04 on Wikipedia: Focke-Wulf Fw 190 (A-8: 3,200 / 4,417 kg on 18.3 m2, 652 km/h, 900-1,000 km). Other figures from memory; cost an estimate unless stated.",
    spec: {
      maxKmh: 653,
      rangeKm: 800,
      emptyKg: 3200,
      wingLoad: 240,
      guns: [
        { mm: 13, count: 2, rpm: 900 },
        { mm: 20, count: 4, rpm: 700 },
      ],
      defGuns: 0,
      bombKg: 0,
      torpedoKg: 0,
      reliability: 4,
      costK: 38,
    },
  },
  {
    id: "deu_fw190_d9",
    country: "DEU",
    family: "plane",
    type: "fighter",
    techs: ["fighter_3", "aero_engine_3"],
    year: 1944,
    // Fw 190 D-9 "Dora": Jumo 213A inline, 2 x 13 mm MG 131 + 2 x 20 mm
    // MG 151/20, 686 km/h; reliable.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 686,
      rangeKm: 800,
      emptyKg: 3500,
      wingLoad: 220,
      guns: [
        { mm: 13, count: 2, rpm: 900 },
        { mm: 20, count: 2, rpm: 700 },
      ],
      defGuns: 0,
      bombKg: 0,
      torpedoKg: 0,
      reliability: 4,
      costK: 40,
    },
  },
  {
    id: "deu_me262_a1",
    country: "DEU",
    family: "plane",
    type: "fighter",
    techs: ["fighter_3", "jet_airframe_2"],
    year: 1944,
    // Me 262 A-1a: 4 x 30 mm MK 108, 870 km/h, Jumo 004 engines that wore out
    // in 10-25 hours. About RM 87,400 (Wikipedia, one reference).
    // Audit w66: Jumo 004 life in hours: reliability 1, as the He 177.
    source: SRC_AIR,
    spec: {
      maxKmh: 870,
      rangeKm: 1050,
      emptyKg: 4000,
      wingLoad: 300,
      guns: [{ mm: 30, count: 4, rpm: 650 }],
      defGuns: 0,
      bombKg: 0,
      torpedoKg: 0,
      jet: true,
      reliability: 1,
      costK: 60,
    },
  },
  {
    id: "deu_bf110_c",
    country: "DEU",
    family: "plane",
    type: "heavy_fighter",
    techs: ["heavy_fighter_1"],
    year: 1939,
    // Bf 110 C-4 "Zerstorer": 2 x 20 mm MG FF + 4 x MG 17 forward, one MG 15
    // aft. Price about RM 80,000 (estimate).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 560,
      rangeKm: 775,
      emptyKg: 4100,
      wingLoad: 175,
      guns: [
        { mm: 7.9, count: 4, rpm: 1100 },
        { mm: 20, count: 2, rpm: 520 },
      ],
      defGuns: 1,
      bombKg: 0,
      torpedoKg: 0,
      reliability: 4,
      costK: 50,
    },
  },
  {
    id: "deu_bf110_g4",
    country: "DEU",
    family: "plane",
    type: "heavy_fighter",
    techs: ["heavy_fighter_2", "air_radar_1"],
    year: 1943,
    // Bf 110 G-4 night fighter: 2 x 30 mm MK 108, 2 x 20 mm MG 151/20, FuG 202
    // Lichtenstein radar, twin MG 81Z aft. Price estimated at RM 100,000.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 550,
      rangeKm: 900,
      emptyKg: 5200,
      wingLoad: 245,
      guns: [
        { mm: 30, count: 2, rpm: 650 },
        { mm: 20, count: 2, rpm: 700 },
      ],
      defGuns: 2,
      bombKg: 0,
      torpedoKg: 0,
      radar: true,
      reliability: 4,
      costK: 60,
    },
  },
  {
    id: "deu_me410_a1",
    country: "DEU",
    family: "plane",
    type: "heavy_fighter",
    techs: ["heavy_fighter_2", "aircraft_cannon_1"],
    year: 1943,
    // Me 410 A-1 Hornisse: 2 x 20 mm MG 151/20 + 2 x MG 17, two remote 13 mm
    // MG 131 barbettes, 1,000 kg bombs; 624 km/h. Price estimated at RM 120,000.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 624,
      rangeKm: 1670,
      emptyKg: 6150,
      wingLoad: 270,
      guns: [
        { mm: 7.9, count: 2, rpm: 1100 },
        { mm: 20, count: 2, rpm: 700 },
      ],
      defGuns: 2,
      bombKg: 1000,
      torpedoKg: 0,
      reliability: 3,
      costK: 75,
    },
  },
  {
    id: "deu_ju87_b",
    country: "DEU",
    family: "plane",
    type: "cas",
    techs: ["cas_1"],
    year: 1938,
    // Ju 87 B-2 Stuka: 500 kg bomb, 2 x MG 17, one MG 15 aft, steep dive
    // with sirens; 340 km/h. Price about RM 70,000 (estimate).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 340,
      rangeKm: 600,
      emptyKg: 2750,
      wingLoad: 135,
      guns: [{ mm: 7.9, count: 2, rpm: 1100 }],
      defGuns: 1,
      bombKg: 500,
      torpedoKg: 0,
      dive: true,
      reliability: 4,
      costK: 32,
    },
  },
  {
    id: "deu_ju87_d",
    country: "DEU",
    family: "plane",
    type: "cas",
    techs: ["cas_2"],
    year: 1941,
    // Ju 87 D-3: 410 km/h, 1,000 kg normal load (1,800 kg overload), twin MG
    // 81Z aft. Price about RM 78,000 (estimate).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source:
      "Checked 2026-11-04 on Wikipedia: Junkers Ju 87 (D: 8,598 lb empty, 255 mph). Other figures from memory; cost an estimate unless stated.",
    spec: {
      maxKmh: 410,
      rangeKm: 600,
      emptyKg: 3900,
      wingLoad: 179,
      guns: [{ mm: 7.9, count: 2, rpm: 1100 }],
      defGuns: 2,
      bombKg: 1000,
      torpedoKg: 0,
      dive: true,
      reliability: 4,
      costK: 38,
    },
  },
  {
    id: "deu_do17_z",
    country: "DEU",
    family: "plane",
    type: "bomber",
    techs: ["bomber_1"],
    year: 1939,
    // Do 17 Z-2 "Flying Pencil": 1,000 kg, four MG 15 in the nose and
    // gondola; 410 km/h. Price about RM 150,000 (estimate).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 410,
      rangeKm: 1160,
      emptyKg: 5210,
      wingLoad: 156,
      guns: [],
      defGuns: 4,
      bombKg: 1000,
      torpedoKg: 0,
      reliability: 4,
      costK: 65,
    },
  },
  {
    id: "deu_he111_h6",
    country: "DEU",
    family: "plane",
    type: "bomber",
    techs: ["bomber_1"],
    year: 1940,
    // He 111 H-6: 2,000 kg, 5 to 6 defensive guns incl. one 20 mm MG FF;
    // 440 km/h. Price about RM 215,000 (estimate).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 440,
      rangeKm: 1500,
      emptyKg: 8680,
      wingLoad: 162,
      guns: [],
      defGuns: 6,
      bombKg: 2000,
      torpedoKg: 0,
      reliability: 4,
      costK: 100,
    },
  },
  {
    id: "deu_ju88_a4",
    country: "DEU",
    family: "plane",
    type: "bomber",
    techs: ["bomber_2"],
    year: 1941,
    // Ju 88 A-4: 2,000 kg (800 kg inside), dive-capable, 433 km/h; empty
    // weight 7,200-9,860 kg by source and standard, 8,600 used. About RM
    // 250,000 (estimate).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 433,
      rangeKm: 1790,
      emptyKg: 8600,
      wingLoad: 255,
      guns: [],
      defGuns: 4,
      bombKg: 2000,
      torpedoKg: 0,
      dive: true,
      reliability: 3,
      costK: 120,
    },
  },
  {
    id: "deu_do217_e2",
    country: "DEU",
    family: "plane",
    type: "bomber",
    techs: ["bomber_2", "aero_engine_2"],
    year: 1941,
    // Do 217 E-2: 4,000 kg maximum (2,500 kg used as the working load), six
    // defensive guns incl. a 13 mm turret; 515 km/h. Price estimated at RM
    // 300,000.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 515,
      rangeKm: 2300,
      emptyKg: 8850,
      wingLoad: 250,
      guns: [],
      defGuns: 6,
      bombKg: 2500,
      torpedoKg: 0,
      reliability: 3,
      costK: 130,
    },
  },
  {
    id: "deu_ar234_b2",
    country: "DEU",
    family: "plane",
    type: "bomber",
    techs: ["bomber_2", "jet_airframe_2"],
    year: 1944,
    // Ar 234 B-2 jet bomber: 1,500 kg, two rear-firing 20 mm cannon; 742
    // km/h, Jumo 004 trouble. Price estimated at RM 120,000.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 742,
      rangeKm: 1556,
      emptyKg: 5200,
      wingLoad: 330,
      guns: [],
      defGuns: 2,
      bombKg: 1500,
      torpedoKg: 0,
      jet: true,
      reliability: 2,
      costK: 110,
    },
  },
  {
    id: "deu_he115_b",
    country: "DEU",
    family: "plane",
    type: "naval_bomber",
    techs: ["naval_bomber_1"],
    year: 1939,
    // He 115 B-1 floatplane: one LT F5b torpedo (765 kg) or 1,250 kg bombs,
    // one MG 17 forward, MG 15 aft; 328 km/h, 2,080 km. Estimated RM 180,000.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 328,
      rangeKm: 2080,
      emptyKg: 6100,
      wingLoad: 120,
      guns: [{ mm: 7.9, count: 1, rpm: 1100 }],
      defGuns: 2,
      bombKg: 0,
      torpedoKg: 765,
      reliability: 4,
      costK: 70,
    },
  },
  {
    id: "deu_fw200_c3",
    country: "DEU",
    family: "plane",
    type: "naval_bomber",
    techs: ["naval_bomber_1", "long_range_1"],
    year: 1941,
    // Fw 200 C-3 Condor, converted airliner: 3,550 km, 2,100 kg bombs, about
    // five defensive guns; the hull cracked on hard landings. Estimated RM
    // 450,000.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 360,
      rangeKm: 3550,
      emptyKg: 12950,
      wingLoad: 192,
      guns: [],
      defGuns: 5,
      bombKg: 2100,
      torpedoKg: 0,
      reliability: 1,
      costK: 200,
    },
  },
  {
    id: "deu_he177_a5",
    country: "DEU",
    family: "plane",
    type: "strat_bomber",
    techs: ["strat_bomber_2", "aero_engine_3"],
    year: 1943,
    // He 177 A-5 Greif: 6,000 kg, five defensive guns (13 mm and 20 mm), 488
    // km/h; coupled engines that caught fire. Estimated RM 400,000.
    source: SRC_AIR,
    spec: {
      maxKmh: 488,
      rangeKm: 5000,
      emptyKg: 16800,
      wingLoad: 304,
      guns: [],
      defGuns: 5,
      bombKg: 6000,
      torpedoKg: 0,
      reliability: 1,
      costK: 280,
    },
  },
  {
    id: "deu_ju52",
    country: "DEU",
    family: "plane",
    type: "transport_plane",
    techs: ["transport_plane_1"],
    year: 1936,
    // Ju 52/3m g4e: 18 paratroopers or about 2 t, 275 km/h, 870 km; very
    // robust. Price about RM 130,000 (estimate).
    source: SRC_AIR,
    spec: {
      maxKmh: 275,
      rangeKm: 870,
      emptyKg: 5720,
      wingLoad: 95,
      guns: [],
      defGuns: 2,
      bombKg: 0,
      torpedoKg: 0,
      reliability: 4,
      costK: 85,
    },
  },
  {
    id: "deu_me323",
    country: "DEU",
    family: "plane",
    type: "transport_plane",
    techs: ["transport_plane_2"],
    year: 1942,
    // Me 323 D-1 Gigant: six engines, up to 10 t of cargo, 285 km/h, about
    // 1,100 km; slow and easy prey. Price estimated at RM 300,000.
    source: SRC_AIR,
    spec: {
      maxKmh: 285,
      rangeKm: 1100,
      emptyKg: 27330,
      wingLoad: 143,
      guns: [],
      defGuns: 8,
      bombKg: 0,
      torpedoKg: 0,
      reliability: 2,
      costK: 190,
    },
  },

  // ---------------------------------------------------------------- ships
  // Standard displacement, armament and speed from Gröner, "Die deutschen
  // Kriegsschiffe", and Wikipedia class articles; costs from Gröner and
  // Hildebrand in RM at 2.5 per dollar, several estimated (noted).
  {
    id: "deu_t35",
    country: "DEU",
    family: "ship",
    cls: "dd",
    techs: [],
    year: 1939,
    // Torpedo boat Type 1935 (T1-T8): 844 t, 3 x 10.5 cm, 6 tubes, 35 kn.
    // About RM 5.5 million (estimate).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_SHIP,
    spec: {
      dispT: 844,
      main: { count: 3, mm: 105 },
      beltMm: 0,
      speedKn: 35,
      rangeNm: 1200,
      torpTubes: 6,
      torpWarheadKg: 280,
      asw: 1,
      aaLight: [
        { count: 1, mm: 37 },
        { count: 4, mm: 20 },
      ],
      aaHeavy: 0,
      aircraft: 0,
      costM: 3,
    },
  },
  {
    id: "deu_z1934",
    country: "DEU",
    family: "ship",
    cls: "dd",
    techs: [],
    year: 1937,
    // Type 1934 destroyer (Z1-Z4): 2,171 t standard, 5 x 12.7 cm, 8 tubes, 36
    // kn. About RM 11 million (estimate).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_SHIP,
    spec: {
      dispT: 2171,
      main: { count: 5, mm: 127 },
      beltMm: 0,
      speedKn: 36,
      rangeNm: 4400,
      torpTubes: 8,
      torpWarheadKg: 280,
      asw: 1,
      aaLight: [
        { count: 4, mm: 37 },
        { count: 4, mm: 20 },
      ],
      aaHeavy: 0,
      aircraft: 0,
      costM: 7.5,
    },
  },
  {
    id: "deu_z1934a",
    country: "DEU",
    family: "ship",
    cls: "dd",
    techs: ["dd_2"],
    year: 1938,
    // Type 1934A (Z5-Z16, Narvik class): 2,411 t standard, 5 x 12.7 cm, 8
    // tubes, 36 kn; wet and top-heavy. About RM 12 million (estimate).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_SHIP,
    spec: {
      dispT: 2411,
      main: { count: 5, mm: 127 },
      beltMm: 0,
      speedKn: 36,
      rangeNm: 4850,
      torpTubes: 8,
      torpWarheadKg: 280,
      asw: 1,
      aaLight: [
        { count: 4, mm: 37 },
        { count: 4, mm: 20 },
      ],
      aaHeavy: 0,
      aircraft: 0,
      costM: 8,
    },
  },
  {
    id: "deu_z1936a",
    country: "DEU",
    family: "ship",
    cls: "dd",
    techs: ["dd_3"],
    year: 1940,
    // Type 1936A (Z23 and later): 2,603 t standard, 5 x 15 cm in single
    // mounts, 8 tubes, 36 kn. About RM 14 million (estimate).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_SHIP,
    spec: {
      dispT: 2603,
      main: { count: 5, mm: 150 },
      beltMm: 0,
      speedKn: 36,
      rangeNm: 2600,
      torpTubes: 8,
      torpWarheadKg: 280,
      asw: 2,
      aaLight: [
        { count: 4, mm: 37 },
        { count: 10, mm: 20 },
      ],
      aaHeavy: 0,
      aircraft: 0,
      costM: 9,
    },
  },
  {
    id: "deu_koenigsberg",
    country: "DEU",
    family: "ship",
    cls: "cl",
    techs: [],
    year: 1929,
    // Königsberg class: 6,650 t standard, 9 x 15 cm in 3 turrets, 6 x 8.8 cm,
    // 12 tubes of 50 cm, 50 mm belt, 32 kn. About RM 30 million (estimate).
    source: SRC_SHIP,
    spec: {
      dispT: 6650,
      main: { count: 9, mm: 150 },
      beltMm: 50,
      speedKn: 32,
      rangeNm: 5700,
      torpTubes: 12,
      torpWarheadKg: 250,
      asw: 0,
      aaLight: [
        { count: 8, mm: 20 },
        { count: 4, mm: 37 },
      ],
      aaHeavy: 6,
      aircraft: 0,
      costM: 16,
    },
  },
  {
    id: "deu_deutschland",
    country: "DEU",
    family: "ship",
    cls: "ca",
    techs: [],
    year: 1933,
    // Deutschland class "pocket battleship": 10,600 t (Washington), 6 x 28 cm,
    // 8 x 15 cm, 80 mm belt, 28 kn, diesel with 8,900 nm range, 8 tubes. About
    // RM 90 million.
    source: SRC_SHIP,
    spec: {
      dispT: 10600,
      main: { count: 6, mm: 283 },
      secondary: { count: 8, mm: 150 },
      beltMm: 80,
      speedKn: 28,
      rangeNm: 8900,
      torpTubes: 8,
      torpWarheadKg: 280,
      asw: 0,
      aaLight: [
        { count: 8, mm: 37 },
        { count: 10, mm: 20 },
      ],
      aaHeavy: 6,
      aircraft: 0,
      costM: 36,
    },
  },
  {
    id: "deu_hipper",
    country: "DEU",
    family: "ship",
    cls: "ca",
    techs: ["ca_2"],
    year: 1939,
    // Admiral Hipper class: 14,050 t design standard (16,170 t later figures),
    // 8 x 20.3 cm, 12 x 10.5 cm, 80 mm belt, 32.5 kn, 12 tubes. About RM 86
    // million (estimate).
    source: SRC_SHIP,
    spec: {
      dispT: 14050,
      main: { count: 8, mm: 203 },
      secondary: { count: 12, mm: 105 },
      beltMm: 80,
      speedKn: 32.5,
      rangeNm: 6800,
      torpTubes: 12,
      torpWarheadKg: 280,
      asw: 0,
      aaLight: [
        { count: 12, mm: 37 },
        { count: 8, mm: 20 },
      ],
      aaHeavy: 12,
      aircraft: 0,
      costM: 42,
    },
  },
  {
    id: "deu_scharnhorst",
    country: "DEU",
    family: "ship",
    cls: "bc",
    techs: ["bc_2"],
    year: 1939,
    // Scharnhorst class: 32,100 t standard, 9 x 28.3 cm, 12 x 15 cm, 14 x
    // 10.5 cm, 350 mm belt, 31 kn, 6 tubes. RM 143 million (Gröner).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_SHIP,
    spec: {
      dispT: 32100,
      main: { count: 9, mm: 283 },
      secondary: { count: 12, mm: 150 },
      beltMm: 350,
      speedKn: 31,
      rangeNm: 10000,
      torpTubes: 6,
      torpWarheadKg: 280,
      asw: 0,
      aaLight: [
        { count: 16, mm: 37 },
        { count: 10, mm: 20 },
      ],
      aaHeavy: 14,
      aircraft: 0,
      costM: 66,
    },
  },
  {
    id: "deu_bismarck",
    country: "DEU",
    family: "ship",
    cls: "bb",
    techs: ["bb_3"],
    year: 1940,
    // Bismarck class: 41,700 t standard, 8 x 38 cm, 12 x 15 cm, 16 x 10.5 cm,
    // 320 mm belt, 30 kn on trials, 8,870 nm at 19 kn (Wikipedia). RM 196.8 million (memory); dollar cost is an estimate by weight against the North Carolina class.
    // Audit w66: 8,525 nm at 19 kn, and 20 x 2 cm as built (Wikipedia).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source:
      "Checked 2026-11-04 on Wikipedia: Bismarck class (41,700 t, 30 kn, 8,525 nm, 320 mm belt, 8 x 380, 12 x 150, 16 x 105, 16 x 37, 20 x 20). Cost: RM 196.8M at 2.5 plus a labour margin, an estimate.",
    spec: {
      dispT: 41700,
      main: { count: 8, mm: 380 },
      secondary: { count: 12, mm: 150 },
      beltMm: 320,
      speedKn: 30,
      rangeNm: 8525,
      torpTubes: 0,
      torpWarheadKg: 0,
      asw: 0,
      aaLight: [
        { count: 16, mm: 37 },
        { count: 20, mm: 20 },
      ],
      aaHeavy: 16,
      aircraft: 0,
      costM: 88,
    },
  },
  {
    id: "deu_graf_zeppelin",
    country: "DEU",
    family: "ship",
    cls: "cv",
    techs: ["cv_2"],
    year: 1938,
    // Graf Zeppelin (launched 1938, never finished): 23,200 t standard, 16 x
    // 15 cm casemates, 12 x 10.5 cm, 100 mm belt, 33.8 kn, about 42 aircraft
    // planned. Cost estimated at RM 90 million.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_SHIP,
    spec: {
      dispT: 23200,
      main: { count: 0, mm: 0 },
      secondary: { count: 16, mm: 150 },
      beltMm: 100,
      speedKn: 33.8,
      rangeNm: 8000,
      torpTubes: 0,
      torpWarheadKg: 0,
      asw: 0,
      aaLight: [
        { count: 22, mm: 37 },
        { count: 28, mm: 20 },
      ],
      aaHeavy: 12,
      aircraft: 42,
      costM: 50,
    },
  },
  {
    id: "deu_u_ii",
    country: "DEU",
    family: "ship",
    cls: "ss",
    techs: [],
    year: 1935,
    // Type II coastal U-boat (IIA-IID): 254-300 t, 3 bow tubes, 12.7 kn
    // surfaced, 1,600-3,800 nm; about RM 2 million (estimate).
    source: SRC_SHIP,
    spec: {
      dispT: 254,
      main: { count: 0, mm: 0 },
      beltMm: 0,
      speedKn: 13,
      rangeNm: 3500,
      torpTubes: 3,
      torpWarheadKg: 280,
      asw: 0,
      aaLight: [{ count: 1, mm: 20 }],
      aaHeavy: 0,
      aircraft: 0,
      costM: 0.9,
    },
  },
  {
    id: "deu_u_viic",
    country: "DEU",
    family: "ship",
    cls: "ss",
    techs: ["ss_2"],
    year: 1941,
    // Type VIIC: 769 t surfaced, 5 tubes (4 bow, 1 stern), 17.7 kn, 8,500 nm;
    // the workhorse. About RM 4.5 million (estimate).
    source: SRC_SHIP,
    spec: {
      dispT: 769,
      main: { count: 0, mm: 0 },
      beltMm: 0,
      speedKn: 17.7,
      rangeNm: 8500,
      torpTubes: 5,
      torpWarheadKg: 280,
      asw: 0,
      aaLight: [{ count: 2, mm: 20 }],
      aaHeavy: 0,
      aircraft: 0,
      costM: 2.5,
    },
  },
  {
    id: "deu_u_ixc",
    country: "DEU",
    family: "ship",
    cls: "ss",
    techs: ["ss_3"],
    year: 1941,
    // Type IXC ocean boat: 1,120 t surfaced, 6 tubes (4 bow, 2 stern), 18.3
    // kn, 13,450 nm. About RM 5.5 million (estimate).
    source: SRC_SHIP,
    spec: {
      dispT: 1120,
      main: { count: 0, mm: 0 },
      beltMm: 0,
      speedKn: 18.3,
      rangeNm: 13450,
      torpTubes: 6,
      torpWarheadKg: 280,
      asw: 0,
      aaLight: [
        { count: 1, mm: 37 },
        { count: 2, mm: 20 },
      ],
      aaHeavy: 0,
      aircraft: 0,
      costM: 3.2,
    },
  },
  {
    id: "deu_u_xxi",
    country: "DEU",
    family: "ship",
    cls: "ss",
    techs: ["ss_4", "snorkel"],
    year: 1944,
    // Type XXI electro-boat: 1,621 t surfaced, 6 bow tubes, 15.6 kn surfaced
    // (17 submerged, used), 11,150 nm, snorkel. About RM 6 million (estimate).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_SHIP,
    spec: {
      dispT: 1621,
      main: { count: 0, mm: 0 },
      beltMm: 0,
      speedKn: 17,
      rangeNm: 11150,
      torpTubes: 6,
      torpWarheadKg: 280,
      asw: 0,
      aaLight: [{ count: 4, mm: 20 }],
      aaHeavy: 0,
      aircraft: 0,
      costM: 4.5,
    },
  },

  // ---------------------------------------------------------------- gear
  {
    id: "deu_kar98k",
    country: "DEU",
    family: "infantry",
    techs: ["inf_eq_1"],
    year: 1935,
    // Karabiner 98k, 7.92 x 57 mm bolt action, 5-round clip; about RM 70.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_GEAR,
    spec: { mm: 7.92, aimedRpm: 15, rangeM: 500, autoPct: 0, costUsd: 30 },
  },
  {
    id: "deu_g43",
    country: "DEU",
    family: "infantry",
    techs: ["inf_eq_2"],
    year: 1943,
    // Gewehr 43, 7.92 x 57 mm gas-operated self-loader, 10-round magazine;
    // about RM 80. Aimed rate 25 per minute (semi-automatic).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_GEAR,
    spec: { mm: 7.92, aimedRpm: 25, rangeM: 500, autoPct: 0, costUsd: 60 },
  },
  {
    id: "deu_stg44",
    country: "DEU",
    family: "infantry",
    techs: ["inf_eq_3"],
    year: 1944,
    // Sturmgewehr 44, 7.92 x 33 mm assault rifle, selective fire, effective
    // range about 300-400 m; about RM 70.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_GEAR,
    spec: { mm: 7.92, aimedRpm: 25, rangeM: 400, autoPct: 50, costUsd: 50 },
  },
  {
    id: "deu_opel_blitz",
    country: "DEU",
    family: "support",
    techs: ["support_eq_1"],
    year: 1937,
    // Opel Blitz 3-ton 4x2 truck, about 410 km road range; about RM 5,000.
    source: SRC_GEAR,
    spec: { kind: "transport", rangeKm: 410, costUsd: 2000 },
  },
  {
    id: "deu_kuebelwagen",
    country: "DEU",
    family: "support",
    techs: ["support_eq_1", "motorized_1"],
    year: 1940,
    // Volkswagen Type 82 Kübelwagen light utility car, about 400 km range;
    // about RM 3,500.
    source: SRC_GEAR,
    spec: { kind: "recon", rangeKm: 400, costUsd: 1400 },
  },
  {
    id: "deu_lefh18",
    country: "DEU",
    family: "gun",
    role: "artillery",
    techs: ["artillery_1"],
    year: 1935,
    // 10.5 cm leFH 18: 14.8 kg shell, 4 rpm sustained, 10,675 m, 1,985 kg;
    // about RM 17,500.
    source: SRC_GEAR,
    spec: {
      mm: 105,
      rpm: 4,
      rangeM: 10675,
      shellKg: 14.8,
      penMm500: 0,
      massKg: 1985,
      barrels: 1,
      costK: 7,
    },
  },
  {
    id: "deu_sfh18",
    country: "DEU",
    family: "gun",
    role: "artillery",
    techs: ["artillery_2"],
    year: 1934,
    // 15 cm sFH 18: 43.5 kg shell, 2 rpm sustained, 13,325 m, 5,500 kg;
    // price estimated at RM 35,000.
    source: SRC_GEAR,
    spec: {
      mm: 150,
      rpm: 2,
      rangeM: 13325,
      shellKg: 43.5,
      penMm500: 0,
      massKg: 5500,
      barrels: 1,
      costK: 14,
    },
  },
  {
    id: "deu_pak36",
    country: "DEU",
    family: "gun",
    role: "anti_tank",
    techs: ["anti_tank_1"],
    year: 1936,
    // 3.7 cm Pak 36: 0.685 kg PzGr, 15 rpm, 29 mm at 500 m (30 degrees),
    // 432 kg; about RM 5,500.
    source: SRC_GEAR,
    spec: {
      mm: 37,
      rpm: 15,
      rangeM: 4000,
      shellKg: 0.685,
      penMm500: 29,
      massKg: 432,
      barrels: 1,
      costK: 2.2,
    },
  },
  {
    id: "deu_pak38",
    country: "DEU",
    family: "gun",
    role: "anti_tank",
    techs: ["anti_tank_1", "at_imp_1"],
    year: 1940,
    // 5 cm Pak 38 L/60: 2.06 kg PzGr 39, 14 rpm, 70 mm at 500 m (sources 59-86),
    // 1,000 kg; about RM 8,500.
    // Audit w66: Same round as the KwK 39 L/60 at 59 mm; 70 was above it.
    source: SRC_GEAR,
    spec: {
      mm: 50,
      rpm: 14,
      rangeM: 5000,
      shellKg: 2.06,
      penMm500: 60,
      massKg: 1000,
      barrels: 1,
      costK: 3.4,
    },
  },
  {
    id: "deu_pak40",
    country: "DEU",
    family: "gun",
    role: "anti_tank",
    techs: ["anti_tank_2", "at_imp_2"],
    year: 1942,
    // 7.5 cm Pak 40 L/46: 6.8 kg PzGr 39, 12 rpm, about 85 mm at 500 m,
    // 1,425 kg; about RM 12,000.
    // Audit w66: PzGr 39 is 96 mm at 500 m, 30 deg (Wikipedia, 7.5 cm Pak 40).
    source: SRC_GEAR,
    spec: {
      mm: 75,
      rpm: 12,
      rangeM: 7680,
      shellKg: 6.8,
      penMm500: 96,
      massKg: 1425,
      barrels: 1,
      costK: 4.8,
    },
  },
  {
    id: "deu_pak43",
    country: "DEU",
    family: "gun",
    role: "anti_tank",
    techs: ["anti_tank_2", "at_imp_3"],
    year: 1943,
    // 8.8 cm Pak 43 L/71: 10.2 kg PzGr 39/43, 10 rpm, about 210 mm at 500 m
    // (as the KwK 43), 4,400 kg; price estimated at RM 16,000.
    // Audit w66: PzGr 39/43 is 185 mm at 500 m, 30 deg (Wikipedia, 8.8 cm Pak 43).
    source: SRC_GEAR,
    spec: {
      mm: 88,
      rpm: 10,
      rangeM: 15000,
      shellKg: 10.2,
      penMm500: 185,
      massKg: 4400,
      barrels: 1,
      costK: 6.4,
    },
  },
  {
    id: "deu_flak38",
    country: "DEU",
    family: "gun",
    role: "anti_air",
    techs: ["anti_air_1"],
    year: 1939,
    // 2 cm Flak 38: 0.115 kg shell, about 220 rpm practical, 2,200 m
    // effective, 770 kg; about RM 4,000.
    source: SRC_GEAR,
    spec: {
      mm: 20,
      rpm: 220,
      rangeM: 2200,
      shellKg: 0.115,
      penMm500: 0,
      massKg: 770,
      barrels: 1,
      costK: 1.6,
    },
  },
  {
    id: "deu_flak36_88",
    country: "DEU",
    family: "gun",
    role: "anti_air",
    techs: ["anti_air_1", "aa_imp_1"],
    year: 1936,
    // 8.8 cm Flak 36: 9.4 kg shell, 15 rpm, 8,000 m effective ceiling, about
    // 5,000 kg in action; about RM 33,000.
    source: SRC_GEAR,
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
  {
    id: "deu_flakvierling38",
    country: "DEU",
    family: "gun",
    role: "anti_air",
    techs: ["anti_air_2"],
    year: 1940,
    // 2 cm Flakvierling 38: four barrels at about 220 rpm each, 2,200 m,
    // 1,500 kg; price estimated at RM 16,000.
    source: SRC_GEAR,
    spec: {
      mm: 20,
      rpm: 220,
      rangeM: 2200,
      shellKg: 0.115,
      penMm500: 0,
      massKg: 1500,
      barrels: 4,
      costK: 6.4,
    },
  },
  {
    id: "deu_maus",
    country: "DEU",
    family: "tank",
    role: "heavy",
    techs: ["super_heavy_tank", "tank_gun_4"],
    year: 1944,
    // ww85: Super-heavy prototype: two hulls and one turret finished in 1944, never in service. Price about RM 800,000, placed as a ratio to the Tiger's RM 299,800 (120), not by an exchange rate. HE filler is an estimate at about a tenth of the 28 kg shell, as for the 88 mm.
    source:
      "Checked 2026-11-05 on Wikipedia: Panzer VIII Maus (2 built, 188 t, 128 mm KwK 44, 20 km/h road, 16 km/h average off road, 13 on hard ground with the full motor field, about RM 800,000). Hull 200 mm (one passage says 220), turret 220-240, kept at 200 and 240; the 35 degree slope is from memory. 12.8 cm Pak 44: sources give 215 to 312 mm at 500 m, 30 deg (Senger und Etterlin 215 via Axis History forum, FORM data about 235, Wikipedia 312, which does not fit its own 230 at 1,000 m); 225 is the middle.",
    spec: {
      massT: 188,
      hullFrontMm: 200,
      hullSlopeDeg: 35,
      turretFrontMm: 240,
      gunMm: 128,
      penMm500: 225,
      heFillerG: 3000,
      mgs: 1,
      offroadKmh: 14,
      roadKmh: 20,
      reliability: 1,
      costK: 320,
    },
  },
  {
    id: "deu_jagdtiger",
    country: "DEU",
    family: "tank",
    role: "td",
    techs: ["heavy_tank_3", "tank_gun_4"],
    year: 1944,
    // ww85: Tiger II chassis with the 128 mm Pak 44; 70-88 built, more lost to breakdown and lack of fuel than to the enemy. No price found: estimate at the Tiger II's rate per tonne.
    source:
      "Checked 2026-11-05 on Wikipedia: Jagdtiger (71.7 t, 150 mm glacis, 250 mm casemate front, 34 km/h road, late 1944). The 15 degree slope and the 15 km/h off road are from memory. Gun figure as for deu_maus.",
    spec: {
      massT: 71.7,
      hullFrontMm: 250,
      hullSlopeDeg: 15,
      gunMm: 128,
      penMm500: 225,
      heFillerG: 3000,
      mgs: 1,
      offroadKmh: 15,
      roadKmh: 34,
      reliability: 1,
      costK: 165,
    },
  },
  {
    id: "deu_elefant",
    country: "DEU",
    family: "tank",
    role: "td",
    techs: ["heavy_tank_2", "tank_gun_4"],
    year: 1943,
    // ww85: 91 converted from Porsche Tiger chassis, at Kursk in 1943; most losses were breakdowns. No price found: estimate at about 2 per tonne, the rate of the Tigers. Slope left at 0: no source gives one.
    source:
      "Checked 2026-11-05 on Wikipedia: Elefant (91 built, 65 t, 200 mm front, 8.8 cm Pak 43/2 L/71, 30 km/h road, 10 km/h off road, poor reliability). Penetration as deu_tiger2_b's gun.",
    spec: {
      massT: 65,
      hullFrontMm: 200,
      hullSlopeDeg: 0,
      gunMm: 88,
      penMm500: 185,
      heFillerG: 870,
      mgs: 1,
      offroadKmh: 10,
      roadKmh: 30,
      reliability: 1,
      costK: 130,
    },
  },
];
