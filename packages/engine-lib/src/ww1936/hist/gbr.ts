// World War 1936 historical catalogue: United Kingdom (GBR).
//
// Conventions (see Types.ts): armour in mm, slope from the vertical,
// penetration at 500 m / 30 degrees with the normal AP round (British
// sources quote 500 yd, 457 m; ignored), reliability 1..5 from the history.
// Long and metric tons are treated as equal (1.6 %).
//
// Sourcing, honestly: specifications are from memory of the usual reference
// works; only the Comet hull armour and the Spitfire price were checked by
// web search. Where references differ a middle value is used and noted.
//
// Costs are INDUSTRIAL ESTIMATES in 1940 US dollars, not pounds at the
// official rate: scaled from comparable US items by weight, labour and
// material (Sherman about 33k, Fletcher about 10 million, North Carolina
// about 77 million), British prices only as a cross-check; good to +-30 %.
// The one hard price found, 12,604 pounds for a Spitfire I (a 1939 export
// contract, engine and guns included), fits about 30k.
//
// Static generations onto these entries:
//   light I = Light Tank Mk VIB, light II = Tetrarch (and A9)
//   medium I = Matilda II / Valentine / A13, medium II = Crusader III,
//   medium III = Cromwell / Comet
//   fighter I = Hurricane I / Spitfire I, II = Spitfire V / IX,
//   III = Spitfire XIV / Tempest V
import type { HistEntry } from "./Types";

const SRC_TANK =
  "From memory (British tank and gun reference works, Wikipedia type articles; not re-checked except where noted)";
const SRC_AIR =
  "From memory (Mason's British fighter and bomber histories, Wikipedia type articles; not re-checked)";
const SRC_SHIP =
  "From memory (Conway's 1922-1946, Lenton's British Warships of WWII, Wikipedia class articles; not re-checked)";
const SRC_GEAR =
  "From memory (Chamberlain & Gander, Allied Weapons of WWII; Wikipedia weapon articles; not re-checked)";

export const GBR_HIST: readonly HistEntry[] = [
  // ============================================================== tanks
  {
    id: "gbr_lt_mk6b",
    country: "GBR",
    family: "tank",
    role: "light",
    techs: ["light_tank_1"],
    year: 1936,
    // Vickers Light Tank Mk VIB: 5.3 t, 14 mm all round, one .50 and one
    // .303 MG, 56 km/h. Cost estimate by weight.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_TANK,
    spec: {
      massT: 5.3,
      hullFrontMm: 14,
      hullSlopeDeg: 0,
      turretFrontMm: 14,
      gunMm: 12.7,
      penMm500: 0,
      heFillerG: 0,
      mgs: 1,
      offroadKmh: 35,
      roadKmh: 56,
      reliability: 4,
      costK: 12,
    },
  },
  {
    id: "gbr_matilda1",
    country: "GBR",
    family: "tank",
    role: "light",
    techs: ["light_tank_2"],
    year: 1938,
    // Infantry Tank Mk I: 11 t, 60 mm front, one Vickers .50 in the turret,
    // 13 km/h. Cost estimate.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_TANK,
    spec: {
      massT: 11.2,
      hullFrontMm: 60,
      hullSlopeDeg: 0,
      turretFrontMm: 65,
      gunMm: 12.7,
      penMm500: 0,
      heFillerG: 0,
      mgs: 0,
      offroadKmh: 8,
      roadKmh: 13,
      reliability: 3,
      costK: 22,
    },
  },
  {
    id: "gbr_a9",
    country: "GBR",
    family: "tank",
    role: "light",
    techs: ["light_tank_2"],
    year: 1939,
    // Cruiser Mk I (A9): 12.7 t, 14 mm, 2-pdr and three MGs, 40 km/h;
    // mechanically troublesome. Cost estimate.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_TANK,
    spec: {
      massT: 12.7,
      hullFrontMm: 14,
      hullSlopeDeg: 0,
      turretFrontMm: 14,
      gunMm: 40,
      penMm500: 46,
      heFillerG: 0,
      mgs: 3,
      offroadKmh: 25,
      roadKmh: 40,
      reliability: 2,
      costK: 30,
    },
  },
  {
    id: "gbr_tetrarch",
    country: "GBR",
    family: "tank",
    role: "light",
    techs: ["light_tank_2"],
    year: 1941,
    // Light Tank Mk VII: 7.6 t, 14-16 mm, 2-pdr and a coaxial Besa, 64 km/h;
    // air-portable by glider. Cost estimate.
    source: SRC_TANK,
    spec: {
      massT: 7.6,
      hullFrontMm: 14,
      hullSlopeDeg: 0,
      turretFrontMm: 16,
      gunMm: 40,
      penMm500: 46,
      heFillerG: 0,
      mgs: 1,
      offroadKmh: 40,
      roadKmh: 64,
      reliability: 3,
      costK: 20,
    },
  },
  {
    id: "gbr_daimler_ac",
    country: "GBR",
    family: "tank",
    role: "light",
    techs: ["light_tank_2"],
    year: 1941,
    // Daimler Armoured Car: 7.5 t, 16 mm front, 2-pdr and a coaxial Besa,
    // 80 km/h, four-wheel drive and steering. Cost estimate.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_TANK,
    spec: {
      massT: 7.5,
      hullFrontMm: 16,
      hullSlopeDeg: 0,
      turretFrontMm: 14,
      gunMm: 40,
      penMm500: 46,
      heFillerG: 0,
      mgs: 1,
      offroadKmh: 40,
      roadKmh: 80,
      wheeled: true,
      reliability: 4,
      costK: 20,
    },
  },
  {
    id: "gbr_a13",
    country: "GBR",
    family: "tank",
    role: "medium",
    techs: ["medium_tank_1"],
    year: 1939,
    // Cruiser Mk IV (A13 Mk II): 15 t, 30 mm, 2-pdr and a Besa, Christie
    // suspension, 48 km/h; thin armour, poor mechanical life. Cost estimate.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_TANK,
    spec: {
      massT: 15.1,
      hullFrontMm: 30,
      hullSlopeDeg: 0,
      turretFrontMm: 30,
      gunMm: 40,
      penMm500: 46,
      heFillerG: 0,
      mgs: 1,
      offroadKmh: 28,
      roadKmh: 48,
      reliability: 2,
      costK: 32,
    },
  },
  {
    id: "gbr_valentine",
    country: "GBR",
    family: "tank",
    role: "medium",
    techs: ["medium_tank_1"],
    year: 1940,
    // Valentine II: 16 t, 60 mm hull, 65 mm turret, 2-pdr and a Besa,
    // 24 km/h; very reliable, cheap for its armour by design (reused A9/A10
    // parts). Cost estimate.
    // Audit w66: AEC diesel.
    source: SRC_TANK,
    spec: {
      diesel: true,
      massT: 16.3,
      hullFrontMm: 60,
      hullSlopeDeg: 0,
      turretFrontMm: 65,
      gunMm: 40,
      penMm500: 46,
      heFillerG: 0,
      mgs: 1,
      offroadKmh: 14,
      roadKmh: 24,
      reliability: 4,
      costK: 36,
    },
  },
  {
    id: "gbr_matilda2",
    country: "GBR",
    family: "tank",
    role: "medium",
    techs: ["medium_tank_1"],
    year: 1939,
    // Matilda II: 27 t, 78 mm hull, 75 mm turret, 2-pdr and a Besa, 24 km/h;
    // immune to most 1940 guns, slow, costly cast hull. Cost estimate.
    // Audit w66: Twin diesels (AEC or Leyland).
    source: SRC_TANK,
    spec: {
      diesel: true,
      massT: 26.9,
      hullFrontMm: 78,
      hullSlopeDeg: 0,
      turretFrontMm: 75,
      gunMm: 40,
      penMm500: 46,
      heFillerG: 0,
      mgs: 1,
      offroadKmh: 13,
      roadKmh: 24,
      reliability: 4,
      costK: 50,
    },
  },
  {
    id: "gbr_crusader_i",
    country: "GBR",
    family: "tank",
    role: "medium",
    techs: ["medium_tank_2"],
    year: 1941,
    // Crusader I: 19 t, 40 mm hull, 49 mm turret, 2-pdr and two Besa,
    // 43 km/h; fast but unreliable in the desert. Cost estimate.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_TANK,
    spec: {
      massT: 19.3,
      hullFrontMm: 40,
      hullSlopeDeg: 0,
      turretFrontMm: 49,
      gunMm: 40,
      penMm500: 46,
      heFillerG: 0,
      mgs: 2,
      offroadKmh: 24,
      roadKmh: 43,
      reliability: 2,
      costK: 36,
    },
  },
  {
    id: "gbr_crusader_iii",
    country: "GBR",
    family: "tank",
    role: "medium",
    techs: ["medium_tank_2", "tank_gun_2"],
    year: 1942,
    // Crusader III: 20 t, 51 mm, 6-pdr (APCBC about 74 mm at 500 m; sources
    // 68-80), one Besa. Cost estimate on the Crusader I.
    // Audit w66: 6-pounder: one figure, 75, for it and the US M1 57 mm.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_TANK,
    spec: {
      massT: 20,
      hullFrontMm: 51,
      hullSlopeDeg: 0,
      turretFrontMm: 51,
      gunMm: 57,
      penMm500: 75,
      heFillerG: 80,
      mgs: 1,
      offroadKmh: 24,
      roadKmh: 43,
      reliability: 2,
      costK: 40,
    },
  },
  {
    id: "gbr_cromwell_iv",
    country: "GBR",
    family: "tank",
    role: "medium",
    techs: ["medium_tank_3", "tank_gun_2"],
    year: 1944,
    // Cromwell IV: 28 t, 64 mm hull, 76 mm turret, 75 mm QF (bored-out
    // 6-pdr, about 68 mm at 500 m; HE about 0.6 kg filler), two Besa,
    // Meteor engine, 64 km/h. Cost estimate.
    // Audit w66: QF 75 mm fires the US M61: 68. 29 km/h cross-country and a 64 mm vertical plate per Wikipedia, so slope 0 is right; 40 was above the page's figure.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_TANK,
    spec: {
      massT: 27.9,
      hullFrontMm: 64,
      hullSlopeDeg: 0,
      turretFrontMm: 76,
      gunMm: 75,
      penMm500: 68,
      heFillerG: 600,
      mgs: 2,
      offroadKmh: 29,
      roadKmh: 64,
      reliability: 4,
      costK: 40,
    },
  },
  {
    id: "gbr_comet",
    country: "GBR",
    family: "tank",
    role: "medium",
    techs: ["medium_tank_3", "tank_gun_3"],
    year: 1944,
    // Comet I: 33.5 t, hull front 76 mm (web check: 74-76 mm; the 101 mm
    // often quoted is the turret), 77 mm HV (APCBC about 109 mm at 500 m,
    // 30 degrees; other angles and ranges give 110-137), two Besa, 47 km/h;
    // reliable. Cost estimate.
    // Audit w66: 14.3 mph cross-country (Wikipedia). 76 mm plate is vertical (Wikipedia, Tank Encyclopedia), so slope 0 is right.
    source: SRC_TANK,
    spec: {
      massT: 33.5,
      hullFrontMm: 76,
      hullSlopeDeg: 0,
      turretFrontMm: 101,
      gunMm: 77,
      penMm500: 109,
      heFillerG: 650,
      mgs: 2,
      offroadKmh: 23,
      roadKmh: 47,
      reliability: 4,
      costK: 50,
    },
  },
  {
    id: "gbr_firefly",
    country: "GBR",
    family: "tank",
    role: "medium",
    techs: ["medium_tank_3", "tank_gun_4"],
    year: 1944,
    // Sherman VC Firefly: US hull (51 mm at 56 degrees, 76 mm turret) with
    // the British 17-pdr (APCBC about 140 mm at 500 m; sources 130-150), one
    // MG. Cost: the US hull (about 33k) plus gun and conversion, estimate.
    // Audit w66: A Sherman V with a 17-pounder: same mechanicals, reliability 4 as a Sherman of that kind.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_TANK,
    spec: {
      massT: 34,
      hullFrontMm: 51,
      hullSlopeDeg: 56,
      turretFrontMm: 76,
      gunMm: 76,
      penMm500: 140,
      heFillerG: 500,
      mgs: 1,
      offroadKmh: 26,
      roadKmh: 40,
      reliability: 4,
      costK: 50,
    },
  },
  {
    id: "gbr_churchill_i",
    country: "GBR",
    family: "tank",
    role: "heavy",
    techs: ["heavy_tank_1"],
    year: 1941,
    // Churchill I: 39 t, 102 mm hull, 89 mm turret, 2-pdr plus a 3-inch
    // howitzer in the hull, 25 km/h; the first batches broke down badly.
    // Cost estimate.
    source: SRC_TANK,
    spec: {
      massT: 39.1,
      hullFrontMm: 102,
      hullSlopeDeg: 0,
      turretFrontMm: 89,
      gunMm: 40,
      penMm500: 46,
      heFillerG: 0,
      mgs: 1,
      offroadKmh: 14,
      roadKmh: 25,
      reliability: 1,
      costK: 45,
    },
  },
  {
    id: "gbr_churchill_iv",
    country: "GBR",
    family: "tank",
    role: "heavy",
    techs: ["heavy_tank_1", "tank_gun_2"],
    year: 1942,
    // Churchill III/IV: 40 t, 102 mm hull, 89 mm turret, 6-pdr (74 mm at
    // 500 m), two Besa; the faults mostly cured. Cost estimate.
    // Audit w66: 127 mm turret front on Mk IV-VI (Wikipedia). 6-pounder: 75, as the US M1 57 mm.
    source: SRC_TANK,
    spec: {
      massT: 39.6,
      hullFrontMm: 102,
      hullSlopeDeg: 0,
      turretFrontMm: 127,
      gunMm: 57,
      penMm500: 75,
      heFillerG: 80,
      mgs: 2,
      offroadKmh: 15,
      roadKmh: 25,
      reliability: 3,
      costK: 48,
    },
  },
  {
    id: "gbr_churchill_vii",
    country: "GBR",
    family: "tank",
    role: "heavy",
    techs: ["heavy_tank_2", "tank_gun_2"],
    year: 1944,
    // Churchill VII: 40.7 t, 152 mm hull and turret, 75 mm (68 mm at
    // 500 m), two Besa, 20 km/h; reliable by then. Cost estimate.
    // Audit w66: QF 75 mm: 68. 152 mm hull and turret front are the real figures (Wikipedia): the highest of any British tank, and a Panther's gun at 124 fails against them at 500 m, 30 deg, as the numbers say.
    source: SRC_TANK,
    spec: {
      massT: 40.7,
      hullFrontMm: 152,
      hullSlopeDeg: 0,
      turretFrontMm: 152,
      gunMm: 75,
      penMm500: 68,
      heFillerG: 600,
      mgs: 2,
      offroadKmh: 12,
      roadKmh: 20,
      reliability: 4,
      costK: 55,
    },
  },
  {
    id: "gbr_archer",
    country: "GBR",
    family: "tank",
    role: "td",
    techs: ["medium_tank_2", "tank_gun_4"],
    year: 1944,
    // Archer: 17-pdr on a Valentine hull, firing to the rear, 60 mm front,
    // open top, 32 km/h. Cost estimate from the Valentine.
    source: SRC_TANK,
    spec: {
      massT: 14.8,
      hullFrontMm: 60,
      hullSlopeDeg: 0,
      gunMm: 76,
      penMm500: 140,
      heFillerG: 500,
      mgs: 0,
      offroadKmh: 18,
      roadKmh: 32,
      openTop: true,
      reliability: 4,
      costK: 38,
    },
  },
  {
    id: "gbr_bishop",
    country: "GBR",
    family: "tank",
    role: "spa",
    techs: ["medium_tank_1", "artillery_2"],
    year: 1941,
    // Bishop: 25-pdr (87.6 mm, HE about 0.7 kg filler) in a fixed box on a
    // Valentine hull, 60 mm front, 24 km/h; cramped, limited elevation. Cost
    // estimate.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_TANK,
    spec: {
      massT: 17.3,
      hullFrontMm: 60,
      hullSlopeDeg: 0,
      gunMm: 87.6,
      penMm500: 0,
      heFillerG: 700,
      mgs: 0,
      offroadKmh: 14,
      roadKmh: 24,
      reliability: 3,
      costK: 34,
    },
  },
  {
    id: "gbr_sexton",
    country: "GBR",
    family: "tank",
    role: "spa",
    techs: ["medium_tank_2", "artillery_2"],
    year: 1943,
    // Sexton II: 25-pdr on the Canadian Ram hull (Montreal Locomotive
    // Works), open top, light armour, 40 km/h; the standard British SP gun.
    // Cost estimate.
    source: SRC_TANK,
    spec: {
      massT: 25.4,
      hullFrontMm: 32,
      hullSlopeDeg: 0,
      gunMm: 87.6,
      penMm500: 0,
      heFillerG: 700,
      mgs: 0,
      offroadKmh: 24,
      roadKmh: 40,
      openTop: true,
      reliability: 4,
      costK: 38,
    },
  },
  {
    id: "gbr_crusader_aa1",
    country: "GBR",
    family: "tank",
    role: "spaa",
    techs: ["medium_tank_2", "anti_air_2"],
    year: 1943,
    // Crusader AA Mk I: one 40 mm Bofors (AP about 48 mm at 500 m; sources
    // 47-50; 120 rounds a minute) in an open turret on a Crusader hull.
    // Cost estimate.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_TANK,
    spec: {
      massT: 19.5,
      hullFrontMm: 51,
      hullSlopeDeg: 0,
      gunMm: 40,
      penMm500: 48,
      heFillerG: 70,
      mgs: 0,
      offroadKmh: 24,
      roadKmh: 43,
      openTop: true,
      reliability: 2,
      costK: 44,
      aa: { barrels: 1, rpm: 120, mm: 40 },
    },
  },
  {
    id: "gbr_crusader_aa2",
    country: "GBR",
    family: "tank",
    role: "spaa",
    techs: ["medium_tank_2", "anti_air_1"],
    year: 1943,
    // Crusader AA Mk II: twin 20 mm Oerlikon (450 rounds a minute each) in
    // an open turret on a Crusader hull. Cost estimate.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_TANK,
    spec: {
      massT: 19.5,
      hullFrontMm: 51,
      hullSlopeDeg: 0,
      gunMm: 20,
      penMm500: 16,
      heFillerG: 6,
      mgs: 0,
      offroadKmh: 24,
      roadKmh: 43,
      openTop: true,
      reliability: 2,
      costK: 42,
      aa: { barrels: 2, rpm: 450, mm: 20 },
    },
  },

  // ============================================================== planes
  {
    id: "gbr_gladiator_i",
    country: "GBR",
    family: "plane",
    type: "fighter",
    techs: [],
    year: 1937,
    // Gloster Gladiator I: biplane, 414 km/h, four .303 Brownings, 690 km.
    // Cost estimate.
    source: SRC_AIR,
    spec: {
      maxKmh: 414,
      rangeKm: 690,
      emptyKg: 1562,
      wingLoad: 72,
      guns: [{ mm: 7.7, count: 4, rpm: 1150 }],
      defGuns: 0,
      bombKg: 0,
      torpedoKg: 0,
      reliability: 4,
      costK: 14,
    },
  },
  {
    id: "gbr_hurricane_i",
    country: "GBR",
    family: "plane",
    type: "fighter",
    techs: ["fighter_1"],
    year: 1937,
    // Hawker Hurricane I: 520 km/h (100-octane), eight .303, about 950 km,
    // rugged. Cost estimate (tube-and-fabric airframe, cheaper than the
    // Spitfire; the ratio is disputed).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 520,
      rangeKm: 950,
      emptyKg: 2309,
      wingLoad: 123,
      guns: [{ mm: 7.7, count: 8, rpm: 1150 }],
      defGuns: 0,
      bombKg: 0,
      torpedoKg: 0,
      reliability: 4,
      costK: 28,
    },
  },
  {
    id: "gbr_spitfire_i",
    country: "GBR",
    family: "plane",
    type: "fighter",
    techs: ["fighter_1"],
    year: 1938,
    // Spitfire Ia: 570 km/h (sources 555-580), eight .303, 636 km. 12,604
    // pounds in a 1939 export contract (web check); US-terms cost estimate.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 570,
      rangeKm: 636,
      emptyKg: 2180,
      wingLoad: 125,
      guns: [{ mm: 7.7, count: 8, rpm: 1150 }],
      defGuns: 0,
      bombKg: 0,
      torpedoKg: 0,
      reliability: 4,
      costK: 36,
    },
  },
  {
    id: "gbr_spitfire_v",
    country: "GBR",
    family: "plane",
    type: "fighter",
    techs: ["fighter_2", "aircraft_cannon_1"],
    year: 1941,
    // Spitfire Vb: 594 km/h, two 20 mm Hispano and four .303, 760 km. Cost
    // estimate on the Mk I.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 594,
      rangeKm: 760,
      emptyKg: 2313,
      wingLoad: 129,
      guns: [
        { mm: 20, count: 2, rpm: 600 },
        { mm: 7.7, count: 4, rpm: 1150 },
      ],
      defGuns: 0,
      bombKg: 0,
      torpedoKg: 0,
      reliability: 4,
      costK: 38,
    },
  },
  {
    id: "gbr_spitfire_ix",
    country: "GBR",
    family: "plane",
    type: "fighter",
    techs: ["fighter_2", "aero_engine_3"],
    year: 1942,
    // Spitfire IXc: Merlin 61, 650 km/h (sources up to 657), two 20 mm and
    // four .303, 700 km. Cost estimate.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 650,
      rangeKm: 700,
      emptyKg: 2545,
      wingLoad: 150,
      guns: [
        { mm: 20, count: 2, rpm: 600 },
        { mm: 7.7, count: 4, rpm: 1150 },
      ],
      defGuns: 0,
      bombKg: 0,
      torpedoKg: 0,
      reliability: 4,
      costK: 40,
    },
  },
  {
    id: "gbr_spitfire_xiv",
    country: "GBR",
    family: "plane",
    type: "fighter",
    techs: ["fighter_3", "aero_engine_4"],
    year: 1944,
    // Spitfire XIV: Griffon 65, 722 km/h, two 20 mm and two .50, 740 km.
    // Cost estimate.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 722,
      rangeKm: 740,
      emptyKg: 2990,
      wingLoad: 170,
      guns: [
        { mm: 20, count: 2, rpm: 600 },
        { mm: 12.7, count: 2, rpm: 800 },
      ],
      defGuns: 0,
      bombKg: 0,
      torpedoKg: 0,
      reliability: 3,
      costK: 46,
    },
  },
  {
    id: "gbr_tempest_v",
    country: "GBR",
    family: "plane",
    type: "fighter",
    techs: ["fighter_3", "aero_engine_3", "aircraft_cannon_2"],
    year: 1944,
    // Hawker Tempest V: Sabre IIA, 695 km/h, four 20 mm Hispano Mk II,
    // about 1,190 km; fast at low level, a thirsty engine. Cost estimate.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 695,
      rangeKm: 1190,
      emptyKg: 4200,
      wingLoad: 184,
      guns: [{ mm: 20, count: 4, rpm: 750 }],
      defGuns: 0,
      bombKg: 0,
      torpedoKg: 0,
      reliability: 3,
      costK: 55,
    },
  },
  {
    id: "gbr_beaufighter_if",
    country: "GBR",
    family: "plane",
    type: "heavy_fighter",
    techs: ["heavy_fighter_1"],
    year: 1940,
    // Bristol Beaufighter IF: twin Hercules, 520 km/h, four 20 mm and six
    // .303, AI Mk IV radar; range 1,750 km (sources 1,500-2,000). Cost
    // estimate.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 520,
      rangeKm: 1750,
      emptyKg: 6380,
      wingLoad: 215,
      guns: [
        { mm: 20, count: 4, rpm: 600 },
        { mm: 7.7, count: 6, rpm: 1150 },
      ],
      defGuns: 0,
      bombKg: 0,
      torpedoKg: 0,
      radar: true,
      reliability: 3,
      costK: 75,
    },
  },
  {
    id: "gbr_mosquito_fb6",
    country: "GBR",
    family: "plane",
    type: "heavy_fighter",
    techs: ["heavy_fighter_2", "aero_engine_3"],
    year: 1943,
    // Mosquito FB Mk VI: wooden twin, 612 km/h, four 20 mm and four .303,
    // 907 kg of bombs; empty weight 6,200-6,800 kg in the sources. Cost
    // estimate.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 612,
      rangeKm: 2100,
      emptyKg: 6400,
      wingLoad: 215,
      guns: [
        { mm: 20, count: 4, rpm: 600 },
        { mm: 7.7, count: 4, rpm: 1150 },
      ],
      defGuns: 0,
      bombKg: 907,
      torpedoKg: 0,
      reliability: 4,
      costK: 80,
    },
  },
  {
    id: "gbr_battle",
    country: "GBR",
    family: "plane",
    type: "cas",
    techs: ["cas_1"],
    year: 1937,
    // Fairey Battle: single-engine light bomber, 388 km/h, 454 kg of bombs,
    // one fixed and one flexible .303; slow, easy prey in 1940. Cost
    // estimate.
    source: SRC_AIR,
    spec: {
      maxKmh: 388,
      rangeKm: 1600,
      emptyKg: 3015,
      wingLoad: 125,
      guns: [{ mm: 7.7, count: 1, rpm: 1150 }],
      defGuns: 1,
      bombKg: 454,
      torpedoKg: 0,
      reliability: 3,
      costK: 35,
    },
  },
  {
    id: "gbr_typhoon_ib",
    country: "GBR",
    family: "plane",
    type: "cas",
    techs: ["cas_2", "aero_engine_2"],
    year: 1942,
    // Hawker Typhoon Ib: 663 km/h, four 20 mm, two 227 kg bombs; a poor
    // start (engine, tail failures), then the best ground-attack fighter.
    // Cost estimate.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 663,
      rangeKm: 820,
      emptyKg: 3990,
      wingLoad: 200,
      guns: [{ mm: 20, count: 4, rpm: 750 }],
      defGuns: 0,
      bombKg: 454,
      torpedoKg: 0,
      reliability: 2,
      costK: 50,
    },
  },
  {
    id: "gbr_blenheim_iv",
    country: "GBR",
    family: "plane",
    type: "bomber",
    techs: ["bomber_1"],
    year: 1939,
    // Bristol Blenheim IV: 428 km/h, 454 kg of bombs, one fixed .303 and
    // three flexible; range 1,950 km (sources 1,800-2,350). Cost estimate.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 428,
      rangeKm: 1950,
      emptyKg: 4440,
      wingLoad: 150,
      guns: [{ mm: 7.7, count: 1, rpm: 1150 }],
      defGuns: 3,
      bombKg: 454,
      torpedoKg: 0,
      reliability: 3,
      costK: 65,
    },
  },
  {
    id: "gbr_mosquito_b4",
    country: "GBR",
    family: "plane",
    type: "bomber",
    techs: ["bomber_2", "aero_engine_3"],
    year: 1942,
    // Mosquito B Mk IV: unarmed, 612 km/h, four 227 kg bombs (908 kg),
    // about 2,200 km. Cost estimate.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 612,
      rangeKm: 2200,
      emptyKg: 6400,
      wingLoad: 205,
      guns: [],
      defGuns: 0,
      bombKg: 908,
      torpedoKg: 0,
      reliability: 4,
      costK: 75,
    },
  },
  {
    id: "gbr_beaufort_i",
    country: "GBR",
    family: "plane",
    type: "naval_bomber",
    techs: ["naval_bomber_1"],
    year: 1939,
    // Bristol Beaufort I: twin torpedo bomber, 418 km/h, one 730 kg torpedo
    // or 680 kg of bombs, one fixed and two flexible .303; 1,600 km (sources
    // 1,500-2,500). Cost estimate.
    source: SRC_AIR,
    spec: {
      maxKmh: 418,
      rangeKm: 1600,
      emptyKg: 5900,
      wingLoad: 200,
      guns: [{ mm: 7.7, count: 1, rpm: 1150 }],
      defGuns: 2,
      bombKg: 680,
      torpedoKg: 730,
      reliability: 3,
      costK: 75,
    },
  },
  {
    id: "gbr_wellington_ic",
    country: "GBR",
    family: "plane",
    type: "strat_bomber",
    techs: ["strat_bomber_1"],
    year: 1938,
    // Vickers Wellington Ic: geodetic frame, 378 km/h, 2,040 kg of bombs,
    // eight .303 in three turrets; 2,400 km at that load. Cost estimate.
    source: SRC_AIR,
    spec: {
      maxKmh: 378,
      rangeKm: 2400,
      emptyKg: 8417,
      wingLoad: 165,
      guns: [],
      defGuns: 8,
      bombKg: 2041,
      torpedoKg: 0,
      reliability: 4,
      costK: 80,
    },
  },
  {
    id: "gbr_whitley_v",
    country: "GBR",
    family: "plane",
    type: "strat_bomber",
    techs: ["strat_bomber_1"],
    year: 1939,
    // Armstrong Whitworth Whitley V: 357 km/h, up to 3,175 kg of bombs, one
    // nose and four tail .303; 2,650 km (sources 2,400-2,650). Cost estimate.
    source: SRC_AIR,
    spec: {
      maxKmh: 357,
      rangeKm: 2650,
      emptyKg: 8780,
      wingLoad: 144,
      guns: [{ mm: 7.7, count: 1, rpm: 1150 }],
      defGuns: 4,
      bombKg: 3175,
      torpedoKg: 0,
      reliability: 3,
      costK: 80,
    },
  },
  {
    id: "gbr_halifax_iii",
    country: "GBR",
    family: "plane",
    type: "strat_bomber",
    techs: ["strat_bomber_2", "aero_engine_3"],
    year: 1944,
    // Handley Page Halifax III: Hercules radials, 454 km/h, 5,900 kg
    // (13,000 lb) of bombs, nine .303; about 3,000 km (sources 2,000-3,200
    // by load). Cost estimate by weight (a B-24 was about 215k).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 454,
      rangeKm: 3000,
      emptyKg: 17345,
      wingLoad: 245,
      guns: [],
      defGuns: 9,
      bombKg: 5900,
      torpedoKg: 0,
      reliability: 3,
      costK: 185,
    },
  },
  {
    id: "gbr_lancaster_i",
    country: "GBR",
    family: "plane",
    type: "strat_bomber",
    techs: ["strat_bomber_3", "aero_engine_3"],
    year: 1942,
    // Avro Lancaster I: four Merlins, 462 km/h, 6,350 kg (14,000 lb) normal
    // load (much more in special versions), eight .303; about 4,000 km with
    // 6.3 t. Cost estimate (a forum post gave about 43,000 pounds in 1941;
    // not verified).
    // Audit w66: 55,000 lb on 1,297 sq ft (Wikipedia): normal weight.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 462,
      rangeKm: 4070,
      emptyKg: 16800,
      wingLoad: 207,
      guns: [],
      defGuns: 8,
      bombKg: 6350,
      torpedoKg: 0,
      reliability: 4,
      costK: 190,
    },
  },
  {
    id: "gbr_bombay",
    country: "GBR",
    family: "plane",
    type: "transport_plane",
    techs: ["transport_plane_1"],
    year: 1939,
    // Bristol Bombay: bomber-transport, 24 troops, 309 km/h, 1,416 km, nose
    // and tail Vickers K. Cost estimate.
    source: SRC_AIR,
    spec: {
      maxKmh: 309,
      rangeKm: 1416,
      emptyKg: 6260,
      wingLoad: 73,
      guns: [],
      defGuns: 2,
      bombKg: 0,
      torpedoKg: 0,
      reliability: 3,
      costK: 60,
    },
  },
  {
    id: "gbr_fulmar_i",
    country: "GBR",
    family: "plane",
    type: "cv_fighter",
    techs: ["carrier_aviation", "fighter_1"],
    year: 1940,
    // Fairey Fulmar I: two-seat carrier fighter, 398 km/h, eight .303,
    // 1,300 km; slow but long-legged. Cost estimate.
    source: SRC_AIR,
    spec: {
      maxKmh: 398,
      rangeKm: 1300,
      emptyKg: 3200,
      wingLoad: 145,
      guns: [{ mm: 7.7, count: 8, rpm: 1150 }],
      defGuns: 0,
      bombKg: 0,
      torpedoKg: 0,
      reliability: 4,
      costK: 40,
    },
  },
  {
    id: "gbr_seafire_iic",
    country: "GBR",
    family: "plane",
    type: "cv_fighter",
    techs: ["carrier_aviation", "fighter_2"],
    year: 1942,
    // Seafire IIC: naval Spitfire V, 540 km/h (sources 535-560), two 20 mm
    // and four .303, short range 760 km; fragile undercarriage. Cost
    // estimate.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 540,
      rangeKm: 760,
      emptyKg: 2400,
      wingLoad: 135,
      guns: [
        { mm: 20, count: 2, rpm: 600 },
        { mm: 7.7, count: 4, rpm: 1150 },
      ],
      defGuns: 0,
      bombKg: 0,
      torpedoKg: 0,
      reliability: 3,
      costK: 40,
    },
  },
  {
    id: "gbr_skua_ii",
    country: "GBR",
    family: "plane",
    type: "cv_cas",
    techs: ["carrier_aviation", "cas_1"],
    year: 1938,
    // Blackburn Skua II: dive bomber, 362 km/h, one 227 kg bomb, four fixed
    // .303 and one flexible; 1,220 km. Cost estimate.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 362,
      rangeKm: 1220,
      emptyKg: 2490,
      wingLoad: 129,
      guns: [{ mm: 7.7, count: 4, rpm: 1150 }],
      defGuns: 1,
      bombKg: 227,
      torpedoKg: 0,
      dive: true,
      reliability: 3,
      costK: 35,
    },
  },
  {
    id: "gbr_swordfish_i",
    country: "GBR",
    family: "plane",
    type: "cv_naval_bomber",
    techs: ["carrier_aviation", "naval_bomber_1"],
    year: 1936,
    // Fairey Swordfish I: biplane, 224 km/h, one 730 kg torpedo (or 680 kg of
    // mines or bombs), one fixed and one flexible .303; 880 km. Slow, very
    // rugged. Cost estimate.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 224,
      rangeKm: 880,
      emptyKg: 2132,
      wingLoad: 61,
      guns: [{ mm: 7.7, count: 1, rpm: 1000 }],
      defGuns: 1,
      bombKg: 680,
      torpedoKg: 730,
      reliability: 5,
      costK: 22,
    },
  },
  {
    id: "gbr_barracuda_ii",
    country: "GBR",
    family: "plane",
    type: "cv_naval_bomber",
    techs: ["carrier_aviation", "naval_bomber_2"],
    year: 1943,
    // Fairey Barracuda II: monoplane torpedo and dive bomber, 367 km/h, one
    // 730 kg torpedo or 725 kg of bombs, two flexible .303; 1,100 km. Cost
    // estimate.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_AIR,
    spec: {
      maxKmh: 367,
      rangeKm: 1100,
      emptyKg: 4240,
      wingLoad: 170,
      guns: [],
      defGuns: 2,
      bombKg: 725,
      torpedoKg: 730,
      dive: true,
      reliability: 3,
      costK: 50,
    },
  },

  // ============================================================== ships
  // Tons are Washington standard (long tons treated as tonnes). 21-inch
  // warheads: Mk V about 234 kg (older boats), Mk IX 365 kg (destroyers from
  // 1938), Mk VIII 327 kg (submarines). Costs are industrial estimates in
  // million 1940 dollars, scaled from US ships by displacement and fit.
  {
    id: "gbr_dd_w",
    country: "GBR",
    family: "ship",
    cls: "dd",
    techs: [],
    year: 1918,
    // Admiralty W class: 1,140 t, four 4-inch, four 21-inch tubes (sources
    // give 4 to 6), 34 kn, 3,500 nm at 15 kn; one 3-inch HA gun.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_SHIP,
    spec: {
      dispT: 1140,
      main: { count: 4, mm: 102 },
      beltMm: 0,
      speedKn: 34,
      rangeNm: 3500,
      torpTubes: 4,
      torpWarheadKg: 234,
      asw: 1,
      aaLight: [],
      aaHeavy: 1,
      aircraft: 0,
      costM: 3.5,
    },
  },
  {
    id: "gbr_dd_tribal",
    country: "GBR",
    family: "ship",
    cls: "dd",
    techs: ["dd_2"],
    year: 1938,
    // Tribal class: 1,850 t, eight 4.7-inch in four twins, one quadruple
    // 2-pdr, four tubes, 36 kn, 5,700 nm at 15 kn; strong guns, few
    // torpedoes, no HA main battery.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_SHIP,
    spec: {
      dispT: 1850,
      main: { count: 8, mm: 120 },
      beltMm: 0,
      speedKn: 36,
      rangeNm: 5700,
      torpTubes: 4,
      torpWarheadKg: 365,
      asw: 2,
      aaLight: [{ count: 4, mm: 40 }],
      aaHeavy: 0,
      aircraft: 0,
      costM: 6.5,
    },
  },
  {
    id: "gbr_dd_j",
    country: "GBR",
    family: "ship",
    cls: "dd",
    techs: ["dd_3"],
    year: 1939,
    // J class (Jervis): 1,690 t, six 4.7-inch in three twins, ten tubes (two
    // quintuple), 36 kn, 5,500 nm at 15 kn, one quadruple 2-pdr, asdic and
    // throwers.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_SHIP,
    spec: {
      dispT: 1690,
      main: { count: 6, mm: 120 },
      beltMm: 0,
      speedKn: 36,
      rangeNm: 5500,
      torpTubes: 10,
      torpWarheadKg: 365,
      asw: 2,
      aaLight: [{ count: 4, mm: 40 }],
      aaHeavy: 0,
      aircraft: 0,
      costM: 6.5,
    },
  },
  {
    id: "gbr_cl_leander",
    country: "GBR",
    family: "ship",
    cls: "cl",
    techs: ["cl_2"],
    year: 1933,
    // Leander class: 7,000 t, eight 6-inch in four twins, four 4-inch HA,
    // eight tubes, 76 mm belt, 32.5 kn, about 5,700 nm at 13 kn (sources
    // 5,500-5,730).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_SHIP,
    spec: {
      dispT: 7000,
      main: { count: 8, mm: 152 },
      secondary: { count: 4, mm: 102 },
      beltMm: 76,
      speedKn: 32.5,
      rangeNm: 5700,
      torpTubes: 8,
      torpWarheadKg: 234,
      asw: 1,
      aaLight: [],
      aaHeavy: 4,
      aircraft: 0,
      costM: 20,
    },
  },
  {
    id: "gbr_cl_southampton",
    country: "GBR",
    family: "ship",
    cls: "cl",
    techs: ["cl_3"],
    year: 1937,
    // Southampton (Town) class: 9,100 t, twelve 6-inch in four triples,
    // eight 4-inch HA, six tubes, 114 mm belt, 32 kn, 7,700 nm at 13 kn.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_SHIP,
    spec: {
      dispT: 9100,
      main: { count: 12, mm: 152 },
      secondary: { count: 8, mm: 102 },
      beltMm: 114,
      speedKn: 32,
      rangeNm: 7700,
      torpTubes: 6,
      torpWarheadKg: 365,
      asw: 1,
      aaLight: [],
      aaHeavy: 8,
      aircraft: 0,
      costM: 27,
    },
  },
  {
    id: "gbr_cl_dido",
    country: "GBR",
    family: "ship",
    cls: "cl",
    techs: ["cl_3", "dual_purpose_guns"],
    year: 1940,
    // Dido class: 5,450 t, ten 5.25-inch DP guns in five twins, six tubes,
    // 76 mm belt, 33 kn, about 4,000 nm (sources 3,500-4,240); two quadruple
    // 2-pdr and some 20 mm. An anti-aircraft cruiser first.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_SHIP,
    spec: {
      dispT: 5450,
      main: { count: 10, mm: 133 },
      beltMm: 76,
      speedKn: 33,
      rangeNm: 4000,
      torpTubes: 6,
      torpWarheadKg: 365,
      asw: 1,
      aaLight: [
        { count: 8, mm: 40 },
        { count: 8, mm: 20 },
      ],
      aaHeavy: 10,
      aircraft: 0,
      costM: 18,
    },
  },
  {
    id: "gbr_ca_norfolk",
    country: "GBR",
    family: "ship",
    cls: "ca",
    techs: [],
    year: 1930,
    // Norfolk class (County type): 9,975 t, eight 8-inch in four twins, eight
    // 4-inch HA, eight tubes, 114 mm belt over the magazines, 32 kn, a very
    // long range (12,500 nm at 12 kn in one reference; others less).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_SHIP,
    spec: {
      dispT: 9975,
      main: { count: 8, mm: 203 },
      secondary: { count: 8, mm: 102 },
      beltMm: 114,
      speedKn: 32,
      rangeNm: 12500,
      torpTubes: 8,
      torpWarheadKg: 234,
      asw: 1,
      aaLight: [],
      aaHeavy: 8,
      aircraft: 0,
      costM: 26,
    },
  },
  {
    id: "gbr_bc_hood",
    country: "GBR",
    family: "ship",
    cls: "bc",
    techs: [],
    year: 1920,
    // HMS Hood: 41,200 t, eight 15-inch in four twins, twelve 5.5-inch,
    // 305 mm belt, 31 kn, 7,500 nm at 14 kn, four submerged tubes, eight
    // 4-inch HA by 1939.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_SHIP,
    spec: {
      dispT: 41200,
      main: { count: 8, mm: 381 },
      secondary: { count: 12, mm: 140 },
      beltMm: 305,
      speedKn: 31,
      rangeNm: 7500,
      torpTubes: 4,
      torpWarheadKg: 234,
      asw: 0,
      aaLight: [],
      aaHeavy: 8,
      aircraft: 0,
      costM: 85,
    },
  },
  {
    id: "gbr_bb_qe",
    country: "GBR",
    family: "ship",
    cls: "bb",
    techs: [],
    year: 1915,
    // Queen Elizabeth class as modernised 1934-41 (Valiant, Warspite): 31,100
    // t, eight 15-inch in four twins, twenty 4.5-inch DP (ten twins), 330 mm
    // belt, 24 kn, about 5,000 nm (sources 4,500-6,000), four octuple 2-pdr.
    // Cost: a rebuild of an old hull, estimate.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_SHIP,
    spec: {
      dispT: 31100,
      main: { count: 8, mm: 381 },
      secondary: { count: 20, mm: 114 },
      beltMm: 330,
      speedKn: 24,
      rangeNm: 5000,
      torpTubes: 0,
      torpWarheadKg: 0,
      asw: 0,
      aaLight: [{ count: 32, mm: 40 }],
      aaHeavy: 20,
      aircraft: 0,
      costM: 55,
    },
  },
  {
    id: "gbr_bb_nelson",
    country: "GBR",
    family: "ship",
    cls: "bb",
    techs: ["bb_2"],
    year: 1927,
    // Nelson class: 33,950 t, nine 16-inch in three triples forward, twelve
    // 6-inch, six 4.7-inch HA, 356 mm belt, 23.5 kn, 7,000 nm, two 24.5-inch
    // tubes (warhead 337 kg), one octuple 2-pdr.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_SHIP,
    spec: {
      dispT: 33950,
      main: { count: 9, mm: 406 },
      secondary: { count: 12, mm: 152 },
      beltMm: 356,
      speedKn: 23.5,
      rangeNm: 7000,
      torpTubes: 2,
      torpWarheadKg: 337,
      asw: 0,
      aaLight: [{ count: 8, mm: 40 }],
      aaHeavy: 6,
      aircraft: 0,
      costM: 60,
    },
  },
  {
    id: "gbr_bb_kgv",
    country: "GBR",
    family: "ship",
    cls: "bb",
    techs: ["bb_3", "dual_purpose_guns"],
    year: 1940,
    // King George V class: 36,700 t (35,000 treaty), ten 14-inch (two quad,
    // one twin), sixteen 5.25-inch DP, 356 mm belt, 28 kn, about 6,000 nm,
    // four octuple 2-pdr.
    // Audit w66: 14.7 in belt (Wikipedia).
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_SHIP,
    spec: {
      dispT: 36700,
      main: { count: 10, mm: 356 },
      secondary: { count: 16, mm: 133 },
      beltMm: 370,
      speedKn: 28,
      rangeNm: 6000,
      torpTubes: 0,
      torpWarheadKg: 0,
      asw: 0,
      aaLight: [{ count: 32, mm: 40 }],
      aaHeavy: 16,
      aircraft: 0,
      costM: 75,
    },
  },
  {
    id: "gbr_cv_courageous",
    country: "GBR",
    family: "ship",
    cls: "cv",
    techs: [],
    year: 1928,
    // HMS Courageous (converted battlecruiser): 22,500 t, 48 aircraft,
    // sixteen 4.7-inch HA (carried as the secondary battery), 76 mm belt,
    // 30 kn, about 6,000 nm at 16 kn (sources differ).
    source: SRC_SHIP,
    spec: {
      dispT: 22500,
      main: { count: 0, mm: 0 },
      secondary: { count: 16, mm: 120 },
      beltMm: 76,
      speedKn: 30,
      rangeNm: 6000,
      torpTubes: 0,
      torpWarheadKg: 0,
      asw: 0,
      aaLight: [],
      aaHeavy: 16,
      aircraft: 48,
      costM: 40,
    },
  },
  {
    id: "gbr_cv_ark_royal",
    country: "GBR",
    family: "ship",
    cls: "cv",
    techs: ["cv_2"],
    year: 1938,
    // HMS Ark Royal: 22,000 t, 60 aircraft in two hangars, sixteen 4.5-inch
    // DP (eight twins), 114 mm belt, 31 kn, 7,600 nm at 20 kn, four octuple
    // 2-pdr.
    source: SRC_SHIP,
    spec: {
      dispT: 22000,
      main: { count: 0, mm: 0 },
      secondary: { count: 16, mm: 114 },
      beltMm: 114,
      speedKn: 31,
      rangeNm: 7600,
      torpTubes: 0,
      torpWarheadKg: 0,
      asw: 0,
      aaLight: [{ count: 32, mm: 40 }],
      aaHeavy: 16,
      aircraft: 60,
      costM: 45,
    },
  },
  {
    id: "gbr_cv_illustrious",
    country: "GBR",
    family: "ship",
    cls: "cv",
    techs: ["cv_2", "armored_deck"],
    year: 1940,
    // HMS Illustrious: 23,200 t, armoured flight deck (76 mm) and 114 mm
    // belt, 36 aircraft (the armoured hangar cost capacity), sixteen
    // 4.5-inch DP, six octuple 2-pdr, 30.5 kn, 6,900 nm at 20 kn (sources
    // 6,900-11,000 at different speeds).
    source: SRC_SHIP,
    spec: {
      dispT: 23200,
      main: { count: 0, mm: 0 },
      secondary: { count: 16, mm: 114 },
      beltMm: 114,
      speedKn: 30.5,
      rangeNm: 6900,
      torpTubes: 0,
      torpWarheadKg: 0,
      asw: 0,
      aaLight: [{ count: 48, mm: 40 }],
      aaHeavy: 16,
      aircraft: 36,
      costM: 48,
    },
  },
  {
    id: "gbr_ss_s",
    country: "GBR",
    family: "ship",
    cls: "ss",
    techs: [],
    year: 1931,
    // S class (group 1): 670 t surfaced, six bow tubes, one 3-inch gun,
    // 13.75 kn surfaced, 3,800 nm at 10 kn.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_SHIP,
    spec: {
      dispT: 670,
      main: { count: 1, mm: 76 },
      beltMm: 0,
      speedKn: 13.75,
      rangeNm: 3800,
      torpTubes: 6,
      torpWarheadKg: 327,
      asw: 0,
      aaLight: [],
      aaHeavy: 0,
      aircraft: 0,
      costM: 2.5,
    },
  },
  {
    id: "gbr_ss_t",
    country: "GBR",
    family: "ship",
    cls: "ss",
    techs: ["ss_2"],
    year: 1938,
    // T class (group 1): 1,090 t surfaced, eleven tubes (eight internal and
    // two external forward, one aft; sources say 10 or 11), one 4-inch gun,
    // 15.25 kn surfaced, 8,000 nm at 10 kn.
    // Audit w66: Cost rebased to the one table in the ww66 report (was the lane's own estimate, kept above if it says so).
    source: SRC_SHIP,
    spec: {
      dispT: 1090,
      main: { count: 1, mm: 102 },
      beltMm: 0,
      speedKn: 15.25,
      rangeNm: 8000,
      torpTubes: 11,
      torpWarheadKg: 327,
      asw: 0,
      aaLight: [],
      aaHeavy: 0,
      aircraft: 0,
      costM: 4.2,
    },
  },

  // ============================================================== gear
  {
    id: "gbr_smle",
    country: "GBR",
    family: "infantry",
    techs: [],
    year: 1907,
    // SMLE No. 1 Mk III*: .303, ten-round magazine, the fastest bolt action
    // in service (about 20 aimed rounds a minute), effective range about
    // 500 m; one Bren (10 %) in each ten-man section. Cost estimate.
    // Audit w66: autoPct counts self-loading or automatic rifles only, as Types.ts says; the squad LMG counts for nobody.
    source: SRC_GEAR,
    spec: { mm: 7.7, aimedRpm: 20, rangeM: 500, autoPct: 10, costUsd: 25 },
  },
  {
    id: "gbr_no4_mk1",
    country: "GBR",
    family: "infantry",
    techs: ["inf_eq_2"],
    year: 1941,
    // Rifle No. 4 Mk I: simpler and stronger than the SMLE, quicker to make,
    // 20 aimed rounds a minute, 500 m; the Bren and Sten issue lifts the
    // automatic share to about a quarter by 1944. Cost estimate.
    // Audit w66: autoPct as the SMLE.
    source: SRC_GEAR,
    spec: { mm: 7.7, aimedRpm: 20, rangeM: 500, autoPct: 25, costUsd: 22 },
  },
  {
    id: "gbr_ws18",
    country: "GBR",
    family: "support",
    techs: ["support_eq_1"],
    year: 1940,
    // Wireless Set No. 18: man-pack set for company and battalion, voice
    // range about 8 km (sources 6-10). Cost estimate.
    source: SRC_GEAR,
    spec: { kind: "signal", rangeKm: 8, costUsd: 250 },
  },
  {
    id: "gbr_ws19",
    country: "GBR",
    family: "support",
    techs: ["support_eq_2"],
    year: 1941,
    // Wireless Set No. 19: the vehicle set of every British tank, voice
    // range about 16 km (10 miles). Cost estimate.
    source: SRC_GEAR,
    spec: { kind: "signal", rangeKm: 16, costUsd: 600 },
  },
  {
    id: "gbr_dingo",
    country: "GBR",
    family: "support",
    techs: ["recon_company"],
    year: 1939,
    // Daimler Dingo scout car: 1.7 t, 322 km range, 90 km/h, armoured and
    // very quiet. Cost estimate (a jeep was about 900 dollars).
    source: SRC_GEAR,
    spec: { kind: "recon", rangeKm: 322, costUsd: 3000 },
  },
  {
    id: "gbr_bedford_ql",
    country: "GBR",
    family: "support",
    techs: ["motorized_2"],
    year: 1941,
    // Bedford QL 3-ton 4x4 lorry, the army's standard truck, range about
    // 380 km (sources 320-480). Cost estimate.
    source: SRC_GEAR,
    spec: { kind: "transport", rangeKm: 380, costUsd: 2000 },
  },
  {
    id: "gbr_18pdr",
    country: "GBR",
    family: "gun",
    role: "artillery",
    techs: ["artillery_1"],
    year: 1917,
    // QF 18-pounder Mk IV: 84 mm, about 8 rounds a minute, 9,100 m, 8.4 kg
    // shell, 1,300 kg. Still in service in 1939. Cost estimate.
    source: SRC_GEAR,
    spec: {
      mm: 84,
      rpm: 8,
      rangeM: 9100,
      shellKg: 8.4,
      penMm500: 0,
      massKg: 1300,
      barrels: 1,
      costK: 5,
    },
  },
  {
    id: "gbr_25pdr",
    country: "GBR",
    family: "gun",
    role: "artillery",
    techs: ["artillery_2"],
    year: 1940,
    // QF 25-pounder Mk II: 87.6 mm, 5 rounds a minute, 12,250 m, 11.3 kg
    // shell, 1,800 kg; the best British field gun, firing flat and high.
    // Cost estimate.
    source: SRC_GEAR,
    spec: {
      mm: 87.6,
      rpm: 5,
      rangeM: 12253,
      shellKg: 11.3,
      penMm500: 0,
      massKg: 1800,
      barrels: 1,
      costK: 7,
    },
  },
  {
    id: "gbr_55in",
    country: "GBR",
    family: "gun",
    role: "artillery",
    techs: ["artillery_3"],
    year: 1941,
    // BL 5.5-inch medium gun: 140 mm, 2 rounds a minute, 14,800 m (sources
    // 14,600-16,000), 45.4 kg shell, 5,900 kg. Cost estimate.
    source: SRC_GEAR,
    spec: {
      mm: 140,
      rpm: 2,
      rangeM: 14800,
      shellKg: 45.4,
      penMm500: 0,
      massKg: 5900,
      barrels: 1,
      costK: 14,
    },
  },
  {
    id: "gbr_2pdr_at",
    country: "GBR",
    family: "gun",
    role: "anti_tank",
    techs: ["anti_tank_1"],
    year: 1938,
    // QF 2-pounder: 40 mm, about 15 rounds a minute, AP shot 1.08 kg and
    // about 46 mm at 500 m (sources 42-53), 814 kg. The range figure
    // (4,500 m) is a rough estimate. Cost estimate.
    source: SRC_GEAR,
    spec: {
      mm: 40,
      rpm: 15,
      rangeM: 4500,
      shellKg: 1.08,
      penMm500: 46,
      massKg: 814,
      barrels: 1,
      costK: 2.5,
    },
  },
  {
    id: "gbr_6pdr_at",
    country: "GBR",
    family: "gun",
    role: "anti_tank",
    techs: ["anti_tank_2"],
    year: 1942,
    // QF 6-pounder Mk II: 57 mm, 15 rounds a minute, APCBC 2.85 kg and about
    // 74 mm at 500 m (sources 68-80), 1,112 kg. The range figure (5,000 m)
    // is a rough estimate. Cost estimate.
    // Audit w66: One figure for the 6-pounder and the US M1: 75, estimate.
    source: SRC_GEAR,
    spec: {
      mm: 57,
      rpm: 15,
      rangeM: 5000,
      shellKg: 2.85,
      penMm500: 75,
      massKg: 1112,
      barrels: 1,
      costK: 3.5,
    },
  },
  {
    id: "gbr_17pdr_at",
    country: "GBR",
    family: "gun",
    role: "anti_tank",
    techs: ["tank_gun_4"],
    year: 1943,
    // QF 17-pounder: 76.2 mm, 10 rounds a minute, APCBC 7.7 kg and about
    // 140 mm at 500 m (sources 130-150), 3,040 kg; the strongest Allied AT
    // gun. The range figure (9,200 m) is a rough estimate. Cost estimate.
    source: SRC_GEAR,
    spec: {
      mm: 76,
      rpm: 10,
      rangeM: 9200,
      shellKg: 7.7,
      penMm500: 140,
      massKg: 3040,
      barrels: 1,
      costK: 8,
    },
  },
  {
    id: "gbr_bofors40",
    country: "GBR",
    family: "gun",
    role: "anti_air",
    techs: ["anti_air_1"],
    year: 1938,
    // 40 mm Bofors L/60, Mk III carriage: 120 rounds a minute, 0.9 kg shell,
    // effective ceiling about 2,500 m (sources 1,800-3,000), 2,000 kg. Cost
    // estimate.
    source: SRC_GEAR,
    spec: {
      mm: 40,
      rpm: 120,
      rangeM: 2500,
      shellKg: 0.9,
      penMm500: 0,
      massKg: 2000,
      barrels: 1,
      costK: 6,
    },
  },
  {
    id: "gbr_37in_aa",
    country: "GBR",
    family: "gun",
    role: "anti_air",
    techs: ["anti_air_2"],
    year: 1938,
    // QF 3.7-inch AA gun (mobile): 94 mm, 20 rounds a minute, 12.7 kg shell,
    // effective ceiling about 9,800 m, 9,300 kg; the standard heavy AA gun
    // of Britain. Cost estimate.
    source: SRC_GEAR,
    spec: {
      mm: 94,
      rpm: 20,
      rangeM: 9800,
      shellKg: 12.7,
      penMm500: 0,
      massKg: 9317,
      barrels: 1,
      costK: 15,
    },
  },
];
