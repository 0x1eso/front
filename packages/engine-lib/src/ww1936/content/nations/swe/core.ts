// ww229 (design ww227 §5-§6): Sweden's generals, own equipment and start
// arms, read before the content. Sweden has no balance of power (not in
// BOP_TAGS); its mechanism (ore and readiness) is spirits and decisions in
// index.ts.
//
// Equipment: real specifications, from memory of the en.wikipedia articles
// named in each `source`; nothing here was checked against a printed
// reference, and a middle value is used where recalled figures differ.
// Costs are 1940 US dollars of industrial effort scaled from the comparable
// American item the way the majors' catalogues do it (M3 Stuart about $33k
// for 12.5 t, P-40 about $45k, Fletcher about $6.5M, Bofors 40 mm about
// $6-10k). MinorClamp holds every fight number between the generic key's
// and the majors' median.
import type { NationCore } from "../types";

const SRC_GUN =
  "en.wikipedia gun articles (Bofors), from memory; cost scaled from US guns";

export const CORE_SWE: NationCore = {
  tag: "SWE",
  // Skills [att, def, plan, log] judged from the careers; no `from`: every
  // one held a general's rank or command in the years of the game.
  generals: [
    {
      id: "swe_thornell",
      tag: "SWE",
      att: 2,
      def: 4,
      plan: 3,
      log: 3,
      traits: ["defensive_doctrine"],
      source:
        "en.wikipedia Olof Thörnell: Supreme Commander of the Swedish Armed Forces 1939-1944",
    },
    {
      id: "swe_jung",
      tag: "SWE",
      att: 2,
      def: 3,
      plan: 4,
      log: 3,
      traits: ["organizer"],
      source:
        "en.wikipedia Helge Jung: Supreme Commander of the Swedish Armed Forces 1944-1951",
    },
    {
      id: "swe_douglas",
      tag: "SWE",
      att: 3,
      def: 3,
      plan: 3,
      log: 2,
      traits: ["infantry_officer"],
      source:
        "en.wikipedia Archibald Douglas (1883-1960): commanding general in Upper Norrland, Commander-in-Chief of the Army 1944-1948",
    },
    {
      id: "swe_ehrensvard",
      tag: "SWE",
      att: 2,
      def: 3,
      plan: 4,
      log: 3,
      traits: ["logistics_wizard"],
      source:
        "en.wikipedia Carl August Ehrensvärd: Chief of the Defence Staff 1940-1947",
    },
    {
      id: "swe_linder",
      tag: "SWE",
      att: 3,
      def: 2,
      plan: 2,
      log: 2,
      traits: ["cavalry_officer"],
      source:
        "en.wikipedia Ernst Linder: cavalry general, commander of the Swedish Volunteer Corps in Finland 1940",
    },
  ],
  bop: [],
  equipment: [
    // ------------------------------------------------------------ tanks
    {
      id: "swe_strv_m38",
      country: "SWE",
      family: "tank",
      role: "light",
      techs: ["light_tank_1"],
      year: 1938,
      staticFor: "light_tank:1",
      // Landsverk L-60, Stridsvagn m/38: 8.5 t, 15 mm sloped front, 37 mm
      // Bofors L/45 in a turret, one 8 mm machine gun, torsion bars, 45 km/h.
      source:
        "en.wikipedia Landsverk L-60 (Stridsvagn m/38), from memory; cost scaled from the M3 Stuart by weight",
      spec: {
        massT: 8.5,
        hullFrontMm: 15,
        hullSlopeDeg: 20,
        turretFrontMm: 15,
        gunMm: 37,
        penMm500: 30,
        heFillerG: 25,
        mgs: 1,
        offroadKmh: 25,
        roadKmh: 45,
        reliability: 3,
        costK: 22,
      },
    },
    {
      id: "swe_lynx",
      country: "SWE",
      family: "tank",
      role: "light",
      techs: ["light_tank_1"],
      year: 1940,
      // Landsverk Lynx, Pansarbil m/39: 7.8 t four-wheel armoured car, about
      // 15 mm of plate, 20 mm automatic cannon and three 8 mm machine guns,
      // driven from either end, 70 km/h on the road.
      source:
        "en.wikipedia Landsverk Lynx (Pansarbil m/39), from memory; cost scaled from the M8 armoured car",
      spec: {
        massT: 7.8,
        hullFrontMm: 15,
        hullSlopeDeg: 30,
        turretFrontMm: 15,
        gunMm: 20,
        penMm500: 18,
        heFillerG: 4,
        mgs: 3,
        offroadKmh: 30,
        roadKmh: 70,
        wheeled: true,
        reliability: 4,
        costK: 16,
      },
    },
    {
      id: "swe_strv_m40",
      country: "SWE",
      family: "tank",
      role: "light",
      techs: ["light_tank_2"],
      year: 1941,
      staticFor: "light_tank:2",
      // Stridsvagn m/40L: the L-60 grown to 9.1 t with 24 mm front plates and
      // two machine guns, same 37 mm gun, 48 km/h.
      source:
        "en.wikipedia Landsverk L-60 (Strv m/40L), from memory; cost scaled from the M3 Stuart by weight",
      spec: {
        massT: 9.1,
        hullFrontMm: 24,
        hullSlopeDeg: 20,
        turretFrontMm: 24,
        gunMm: 37,
        penMm500: 30,
        heFillerG: 25,
        mgs: 2,
        offroadKmh: 25,
        roadKmh: 48,
        reliability: 3,
        costK: 25,
      },
    },
    {
      id: "swe_strv_m42",
      country: "SWE",
      family: "tank",
      role: "medium",
      techs: ["medium_tank_1"],
      year: 1943,
      // Stridsvagn m/42: 22.5 t, 55 mm front, 75 mm kan m/41 L/34 (about
      // 48 mm at 500 m with AP), three 8 mm machine guns, 42 km/h; the
      // electric-transmission version was troublesome.
      source:
        "en.wikipedia Stridsvagn m/42, from memory; cost scaled from the M4 by weight",
      spec: {
        massT: 22.5,
        hullFrontMm: 55,
        hullSlopeDeg: 10,
        turretFrontMm: 55,
        gunMm: 75,
        penMm500: 48,
        heFillerG: 650,
        mgs: 3,
        offroadKmh: 25,
        roadKmh: 42,
        reliability: 3,
        costK: 45,
      },
    },
    // ------------------------------------------------------------ planes
    {
      id: "swe_j22",
      country: "SWE",
      family: "plane",
      type: "fighter",
      techs: ["fighter_2"],
      year: 1943,
      // FFVS J 22A: 575 km/h, range about 1,270 km, 2,020 kg empty, wing
      // area 16 m2 at about 2,830 kg; two 13.2 mm and two 8 mm guns.
      source: "en.wikipedia FFVS J 22, from memory; cost scaled from the P-40",
      spec: {
        maxKmh: 575,
        rangeKm: 1270,
        emptyKg: 2020,
        wingLoad: 177,
        guns: [
          { mm: 13.2, count: 2, rpm: 850 },
          { mm: 8, count: 2, rpm: 1100 },
        ],
        defGuns: 0,
        bombKg: 0,
        torpedoKg: 0,
        reliability: 3,
        costK: 38,
      },
    },
    {
      id: "swe_saab17",
      country: "SWE",
      family: "plane",
      type: "cas",
      techs: ["cas_1"],
      year: 1942,
      // Saab 17 (B 17A): dive bomber and scout, 435 km/h, range about
      // 1,700 km, 2,600 kg empty, 28.5 m2; two fixed 8 mm guns, one rear gun,
      // up to 700 kg of bombs; the undercarriage doubled as a dive brake.
      source:
        "en.wikipedia Saab 17, from memory; cost scaled from US single-engine bombers",
      spec: {
        maxKmh: 435,
        rangeKm: 1700,
        emptyKg: 2600,
        wingLoad: 139,
        guns: [{ mm: 8, count: 2, rpm: 1100 }],
        defGuns: 1,
        bombKg: 700,
        torpedoKg: 0,
        dive: true,
        reliability: 4,
        costK: 55,
      },
    },
    {
      id: "swe_saab18",
      country: "SWE",
      family: "plane",
      type: "bomber",
      techs: ["bomber_2"],
      year: 1944,
      // Saab 18 (B 18B): twin-engine bomber, 575 km/h, range about 2,600 km,
      // about 5,900 kg empty, 43.75 m2 at about 8,800 kg; three defensive
      // guns, 1,500 kg of bombs, able to dive.
      source:
        "en.wikipedia Saab 18, from memory; cost scaled from the B-25 by weight",
      spec: {
        maxKmh: 575,
        rangeKm: 2600,
        emptyKg: 5900,
        wingLoad: 201,
        guns: [],
        defGuns: 3,
        bombKg: 1500,
        torpedoKg: 0,
        dive: true,
        reliability: 3,
        costK: 110,
      },
    },
    // ------------------------------------------------------------ ships
    {
      id: "swe_sverige_class",
      country: "SWE",
      family: "ship",
      cls: "ca",
      techs: [],
      year: 1917,
      // Sverige class coastal defence ships (pansarskepp): about 6,850 t,
      // 4 x 283 mm, 8 x 152 mm, 200 mm belt, 22.5 kn; 75 mm and 25 mm AA
      // added in the 1930s. Counted as heavy cruisers, like StartNavy.
      source:
        "en.wikipedia Sverige-class coastal defence ship, from memory; Conway's 1922-46; cost scaled from US ships by displacement",
      spec: {
        dispT: 6850,
        main: { count: 4, mm: 283 },
        secondary: { count: 8, mm: 152 },
        beltMm: 200,
        speedKn: 22.5,
        rangeNm: 2700,
        torpTubes: 2,
        torpWarheadKg: 150,
        asw: 0,
        aaLight: [{ count: 4, mm: 25 }],
        aaHeavy: 4,
        aircraft: 0,
        costM: 8,
      },
    },
    {
      id: "swe_gotland_class",
      country: "SWE",
      family: "ship",
      cls: "cl",
      techs: [],
      year: 1934,
      // HSwMS Gotland, aircraft cruiser: 4,750 t, 6 x 152 mm, 4 x 75 mm AA,
      // 6 x 533 mm tubes, 27.5 kn. Her floatplanes (6, room for 11) were
      // scouts on a catapult, not a strike group: aircraft 0.
      source:
        "en.wikipedia HSwMS Gotland (1933), from memory; Conway's 1922-46; cost scaled from US cruisers",
      spec: {
        dispT: 4750,
        main: { count: 6, mm: 152 },
        beltMm: 0,
        speedKn: 27.5,
        rangeNm: 4000,
        torpTubes: 6,
        torpWarheadKg: 250,
        asw: 1,
        aaLight: [{ count: 4, mm: 25 }],
        aaHeavy: 4,
        aircraft: 0,
        costM: 6,
      },
    },
    {
      id: "swe_goteborg_class",
      country: "SWE",
      family: "ship",
      cls: "dd",
      techs: [],
      year: 1936,
      // Göteborg class destroyers: about 1,040 t, 3 x 120 mm, 6 x 533 mm
      // tubes, 39 kn, light AA of 25 mm guns, short-legged.
      source:
        "en.wikipedia Göteborg-class destroyer, from memory; cost scaled from the Fletcher by displacement",
      spec: {
        dispT: 1040,
        main: { count: 3, mm: 120 },
        beltMm: 0,
        speedKn: 39,
        rangeNm: 1600,
        torpTubes: 6,
        torpWarheadKg: 250,
        asw: 1,
        aaLight: [{ count: 6, mm: 25 }],
        aaHeavy: 0,
        aircraft: 0,
        costM: 3.2,
      },
    },
    {
      id: "swe_sjolejonet_class",
      country: "SWE",
      family: "ship",
      cls: "ss",
      techs: [],
      year: 1938,
      // Sjölejonet class submarines: about 580 t surfaced, 6 x 533 mm tubes,
      // two 40 mm guns, 16 kn surfaced.
      source:
        "en.wikipedia Sjölejonet-class submarine, from memory; cost scaled from the Gato by displacement",
      spec: {
        dispT: 580,
        main: { count: 2, mm: 40 },
        beltMm: 0,
        speedKn: 16,
        rangeNm: 2000,
        torpTubes: 6,
        torpWarheadKg: 250,
        asw: 0,
        aaLight: [],
        aaHeavy: 0,
        aircraft: 0,
        costM: 2.2,
      },
    },
    // ------------------------------------------------------------ infantry
    {
      id: "swe_m96",
      country: "SWE",
      family: "infantry",
      techs: ["inf_eq_1"],
      year: 1896,
      staticFor: "infantry_equipment:1",
      // Gevär m/96, the Swedish Mauser: 6.5 x 55 mm, about 12 aimed rounds a
      // minute, accurate at long range.
      source:
        "en.wikipedia Swedish Mauser (m/96), from memory; cost a guess near the US 1903 rifle",
      spec: { mm: 6.5, aimedRpm: 12, rangeM: 600, autoPct: 0, costUsd: 25 },
    },
    {
      id: "swe_kg_m37",
      country: "SWE",
      family: "infantry",
      techs: ["inf_eq_2"],
      year: 1937,
      staticFor: "infantry_equipment:2",
      // Kulsprutegevär m/37: the BAR built by Carl Gustaf in 6.5 mm, one to a
      // squad beside the m/96 rifles.
      source:
        "en.wikipedia M1918 Browning Automatic Rifle (Kg m/37), from memory; cost scaled from the BAR",
      spec: { mm: 6.5, aimedRpm: 25, rangeM: 600, autoPct: 10, costUsd: 45 },
    },
    {
      id: "swe_ag_m42",
      country: "SWE",
      family: "infantry",
      techs: ["inf_eq_3"],
      year: 1942,
      staticFor: "infantry_equipment:3",
      // Automatgevär m/42, the Ljungman: gas-operated self-loading rifle in
      // 6.5 mm, issued to part of the infantry.
      source:
        "en.wikipedia Ag m/42, from memory; cost scaled from the M1 Garand",
      spec: { mm: 6.5, aimedRpm: 20, rangeM: 600, autoPct: 20, costUsd: 55 },
    },
    // ------------------------------------------------------------ guns
    {
      id: "swe_falt_m02_33",
      country: "SWE",
      family: "gun",
      role: "artillery",
      techs: ["artillery_1"],
      year: 1933,
      staticFor: "artillery:1",
      // 7.5 cm fältkanon m/02-33: the Krupp field gun of 1902 rebuilt in the
      // 1930s; 8 rounds a minute, about 9,800 m, 6.5 kg shell, 1,100 kg.
      source: SRC_GUN,
      spec: {
        mm: 75,
        rpm: 8,
        rangeM: 9800,
        shellKg: 6.5,
        penMm500: 0,
        massKg: 1100,
        barrels: 1,
        costK: 5,
      },
    },
    {
      id: "swe_haubits_m39",
      country: "SWE",
      family: "gun",
      role: "artillery",
      techs: ["artillery_2"],
      year: 1940,
      staticFor: "artillery:2",
      // Bofors 10.5 cm haubits m/39: 6 rounds a minute, about 14,000 m,
      // 15 kg shell, about 2,400 kg; sources disagree, middle values.
      source: SRC_GUN,
      spec: {
        mm: 105,
        rpm: 6,
        rangeM: 14000,
        shellKg: 15,
        penMm500: 0,
        massKg: 2400,
        barrels: 1,
        costK: 8,
      },
    },
    {
      id: "swe_pvkan_m38",
      country: "SWE",
      family: "gun",
      role: "anti_tank",
      techs: ["anti_tank_1"],
      year: 1938,
      staticFor: "anti_tank:1",
      // Bofors 37 mm pansarvärnskanon m/38: 0.74 kg AP shot, about 35 mm at
      // 500 m, 380 kg, low and light; sold to a dozen armies.
      source: SRC_GUN,
      spec: {
        mm: 37,
        rpm: 20,
        rangeM: 4000,
        shellKg: 0.74,
        penMm500: 35,
        massKg: 380,
        barrels: 1,
        costK: 3,
      },
    },
    {
      id: "swe_lvakan_m36",
      country: "SWE",
      family: "gun",
      role: "anti_air",
      techs: ["anti_air_1"],
      year: 1936,
      staticFor: "anti_air:1",
      // 40 mm luftvärnsautomatkanon m/36, the Bofors L/60: 120 rounds a
      // minute, 0.9 kg shell, effective ceiling about 2,500 m, 2,000 kg.
      source: SRC_GUN,
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
      id: "swe_lvkan_m30",
      country: "SWE",
      family: "gun",
      role: "anti_air",
      techs: ["anti_air_1"],
      year: 1930,
      // Bofors 7.5 cm luftvärnskanon m/30: heavy anti-aircraft gun, about 20
      // rounds a minute, 6.5 kg shell, ceiling about 8,000 m, 3,300 kg.
      source: SRC_GUN,
      spec: {
        mm: 75,
        rpm: 20,
        rangeM: 8000,
        shellKg: 6.5,
        penMm500: 0,
        massKg: 3300,
        barrels: 1,
        costK: 12,
      },
    },
  ],
  // Bought and licensed abroad (owner D4: start licences already paid).
  startArms: [
    {
      // J 8 and J 8A: 55 Gloster Gladiators bought from Britain in 1937-38.
      entry: "gbr_gladiator_i",
      origin: "received",
      count: 55,
      source:
        "en.wikipedia Gloster Gladiator, Swedish service (J 8, J 8A): 55 bought",
    },
    {
      // Strv m/41: the Czech TNH (Pz 38(t)) built under licence by
      // Scania-Vabis from 1942; the design only at the start.
      entry: "deu_pz38t_c",
      origin: "licensed",
      count: 0,
      source:
        "en.wikipedia Stridsvagn m/41: Praga TNH built under licence by Scania-Vabis",
    },
  ],
};
