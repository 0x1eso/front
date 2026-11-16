// ww229 (design ww227 §5-§6): POL's generals, balance of power, own
// equipment and start arms, read before the content. Data only.
//
// Generals: the 1939 army commanders not yet in GENERALS (Rydz-Śmigły,
// Sosnkowski, Kutrzeba, Anders and Maczek are there already). All six held
// general's rank before 1936, so none has a `from`.
//
// Balance of power: the ruling camp (Sanacja, right, +) against the
// opposition (the Morges Front, the peasants and the socialists, left, −).
// The colonels start firmly ahead but split after the Marshal's death.
//
// Equipment: Polish designs and Polish licence production, real figures.
// Where a figure comes from memory the source says so; costs are estimates
// in 1940 US dollars against comparable items of the majors' catalogues.
import type { NationCore } from "../types";

export const CORE_POL: NationCore = {
  tag: "POL",
  generals: [
    {
      id: "juliusz_rommel",
      tag: "POL",
      att: 2,
      def: 3,
      plan: 3,
      log: 2,
      traits: ["infantry_officer"],
      source:
        "en.wikipedia Juliusz Rómmel + pl.wikipedia: general officer since the 1920s; commanded the Łódź Army and then the Warsaw Army in 1939",
    },
    {
      id: "bortnowski",
      tag: "POL",
      att: 3,
      def: 2,
      plan: 2,
      log: 2,
      traits: ["offensive_doctrine"],
      source:
        "en.wikipedia Władysław Bortnowski + pl.wikipedia: general officer since the 1920s; led the Silesia group into Zaolzie in 1938 and the Pomorze Army in 1939",
    },
    {
      id: "kleeberg",
      tag: "POL",
      att: 3,
      def: 4,
      plan: 2,
      log: 3,
      traits: ["defensive_doctrine"],
      source:
        "en.wikipedia Franciszek Kleeberg + pl.wikipedia: generał brygady from 1928; Independent Operational Group Polesie, the battle of Kock in 1939",
    },
    {
      id: "szylling",
      tag: "POL",
      att: 2,
      def: 3,
      plan: 3,
      log: 2,
      traits: ["defensive_doctrine"],
      source:
        "en.wikipedia Antoni Szylling + pl.wikipedia: general officer since the 1920s; commanded the Kraków Army in 1939",
    },
    {
      id: "dab_biernacki",
      tag: "POL",
      att: 2,
      def: 2,
      plan: 2,
      log: 2,
      traits: [],
      source:
        "en.wikipedia Stefan Dąb-Biernacki + pl.wikipedia: general officer since the 1920s, Army Inspector; commanded the Prusy Army and the Northern Front in 1939",
    },
    {
      id: "fabrycy",
      tag: "POL",
      att: 2,
      def: 3,
      plan: 2,
      log: 3,
      traits: [],
      source:
        "en.wikipedia Kazimierz Fabrycy + pl.wikipedia: generał dywizji in the 1920s, deputy minister of military affairs; commanded the Karpaty Army in 1939",
    },
  ],
  bop: [
    {
      tag: "POL",
      // The right band (+200..+600): the colonels rule, the opposition grows.
      startPm: 350,
      spirits: [
        "pol_sp_bop_opposition_rules",
        "pol_sp_bop_opposition_gains",
        "pol_sp_bop_uneasy_balance",
        "pol_sp_bop_colonels_lead",
        "pol_sp_bop_colonels_alone",
      ],
      endsOnRulingChange: true,
    },
  ],
  equipment: [
    // ---------------------------------------------------------------- tanks
    {
      id: "pol_tks",
      country: "POL",
      family: "tank",
      role: "light",
      techs: [],
      year: 1934,
      // Two-man tankette, one 7.92 mm machine gun in a casemate; about 575 built.
      source:
        "en.wikipedia TKS (2.6 t, 8-10 mm armour, 40 km/h road); cross-country speed and cost from memory, cost against the Pz I by weight.",
      spec: {
        massT: 2.6,
        hullFrontMm: 10,
        hullSlopeDeg: 0,
        gunMm: 8,
        penMm500: 0,
        heFillerG: 0,
        mgs: 1,
        offroadKmh: 20,
        roadKmh: 40,
        reliability: 3,
        costK: 7,
      },
    },
    {
      id: "pol_wz34",
      country: "POL",
      family: "tank",
      role: "light",
      techs: [],
      year: 1934,
      // Armoured car on a Polski Fiat chassis; the 37 mm Puteaux version.
      source:
        "en.wikipedia Samochód pancerny wz. 34 (about 2.2 t, 6-8 mm armour, 37 mm SA-18 or a machine gun, 50 km/h); penetration as the French SA-18 entry; cost from memory.",
      spec: {
        massT: 2.2,
        hullFrontMm: 8,
        hullSlopeDeg: 0,
        turretFrontMm: 8,
        gunMm: 37,
        penMm500: 12,
        heFillerG: 15,
        mgs: 0,
        offroadKmh: 15,
        roadKmh: 50,
        wheeled: true,
        reliability: 2,
        costK: 5,
      },
    },
    {
      id: "pol_7tp",
      country: "POL",
      family: "tank",
      role: "light",
      techs: ["light_tank_1"],
      staticFor: "light_tank:1",
      year: 1937,
      // Single-turret 7TP with the Bofors 37 mm wz. 37 and a Saurer diesel.
      // About 130 built.
      source:
        "en.wikipedia 7TP (9.9 t, 17 mm front, 37 mm Bofors, 37 km/h, Saurer diesel); penetration as the wz. 36 entry; cost from memory against the Pz II.",
      spec: {
        massT: 9.9,
        hullFrontMm: 17,
        hullSlopeDeg: 0,
        turretFrontMm: 15,
        gunMm: 37,
        penMm500: 31,
        heFillerG: 30,
        mgs: 1,
        offroadKmh: 20,
        roadKmh: 37,
        diesel: true,
        reliability: 3,
        costK: 18,
      },
    },
    // ---------------------------------------------------------------- planes
    {
      id: "pol_pzl_p7a",
      country: "POL",
      family: "plane",
      type: "fighter",
      techs: [],
      year: 1933,
      // Gull-wing monoplane of the Puławski line; still a third of the
      // fighter squadrons in 1939.
      source:
        "en.wikipedia PZL P.7 (P.7a: 1,090 / 1,476 kg on 17.9 m2, 327 km/h, 600 km, two 7.92 mm); rate of fire and cost from memory.",
      spec: {
        guns: [{ mm: 7.92, count: 2, rpm: 1000 }],
        maxKmh: 327,
        rangeKm: 600,
        emptyKg: 1090,
        wingLoad: 82,
        defGuns: 0,
        bombKg: 0,
        torpedoKg: 0,
        reliability: 3,
        costK: 14,
      },
    },
    {
      id: "pol_pzl_p11c",
      country: "POL",
      family: "plane",
      type: "fighter",
      techs: ["fighter_1"],
      staticFor: "fighter:1",
      year: 1935,
      // The main Polish fighter of 1939; two guns, four on the later batches
      // (two used).
      source:
        "en.wikipedia PZL P.11 (P.11c: 1,147 / 1,630 kg on 17.9 m2, 375 km/h, 700 km); rate of fire and cost from memory.",
      spec: {
        guns: [{ mm: 7.92, count: 2, rpm: 1000 }],
        maxKmh: 375,
        rangeKm: 700,
        emptyKg: 1147,
        wingLoad: 91,
        defGuns: 0,
        bombKg: 0,
        torpedoKg: 0,
        reliability: 4,
        costK: 17,
      },
    },
    {
      id: "pol_pzl_p24",
      country: "POL",
      family: "plane",
      type: "fighter",
      techs: ["fighter_1"],
      year: 1936,
      // The export fighter (Turkey, Romania, Greece, Bulgaria); the P.24F
      // with two 20 mm Oerlikon cannon and two machine guns.
      source:
        "en.wikipedia PZL P.24 (P.24F: about 1,330 / 1,915 kg on 17.9 m2, 430 km/h, 700 km); rates of fire and cost from memory.",
      spec: {
        guns: [
          { mm: 20, count: 2, rpm: 520 },
          { mm: 7.92, count: 2, rpm: 1000 },
        ],
        maxKmh: 430,
        rangeKm: 700,
        emptyKg: 1332,
        wingLoad: 107,
        defGuns: 0,
        bombKg: 0,
        torpedoKg: 0,
        reliability: 4,
        costK: 22,
      },
    },
    {
      id: "pol_pzl23_karas",
      country: "POL",
      family: "plane",
      type: "cas",
      techs: ["cas_1"],
      staticFor: "cas:1",
      year: 1936,
      // Light bomber and reconnaissance plane; flew low attacks in 1939.
      source:
        "en.wikipedia PZL.23 Karaś (P.23B: 1,928 / 3,526 kg on 26.8 m2, 365 km/h, 1,260 km, 700 kg of bombs); rates of fire and cost from memory.",
      spec: {
        guns: [{ mm: 7.92, count: 1, rpm: 1000 }],
        maxKmh: 365,
        rangeKm: 1260,
        emptyKg: 1928,
        wingLoad: 131,
        defGuns: 2,
        bombKg: 700,
        torpedoKg: 0,
        reliability: 3,
        costK: 30,
      },
    },
    {
      id: "pol_pzl37_los",
      country: "POL",
      family: "plane",
      type: "bomber",
      techs: ["bomber_1"],
      staticFor: "bomber:1",
      year: 1938,
      // Fast twin-engined medium bomber; about 100 built before the war.
      source:
        "en.wikipedia PZL.37 Łoś (P.37B: 4,280 / 8,865 kg on 53.5 m2, 445 km/h, 2,600 km, 2,580 kg of bombs); cost from memory.",
      spec: {
        guns: [],
        maxKmh: 445,
        rangeKm: 2600,
        emptyKg: 4280,
        wingLoad: 166,
        defGuns: 3,
        bombKg: 2580,
        torpedoKg: 0,
        reliability: 3,
        costK: 60,
      },
    },
    // ---------------------------------------------------------------- ships
    {
      id: "pol_wicher",
      country: "POL",
      family: "ship",
      cls: "dd",
      techs: [],
      year: 1930,
      // Wicher and Burza, built in France; the 1936 destroyers.
      source:
        "en.wikipedia Wicher-class destroyer (1,540 t, 4 x 130 mm, 2 x 3 x 550 mm, 33 kn, 3,000 nm); warhead and cost from memory, cost against the French Bourrasque.",
      spec: {
        dispT: 1540,
        main: { count: 4, mm: 130 },
        beltMm: 0,
        speedKn: 33,
        rangeNm: 3000,
        torpTubes: 6,
        torpWarheadKg: 310,
        asw: 1,
        aaLight: [{ count: 2, mm: 40 }],
        aaHeavy: 0,
        aircraft: 0,
        costM: 4.4,
      },
    },
    {
      id: "pol_grom",
      country: "POL",
      family: "ship",
      cls: "dd",
      techs: ["dd_2"],
      year: 1937,
      // Grom and Błyskawica, built at Cowes; among the fastest and best-armed
      // destroyers of their day.
      source:
        "en.wikipedia Grom-class destroyer (2,011 t, 7 x 120 mm, 2 x 3 x 533 mm, 39 kn, 3,000 nm, twin 40 mm Bofors); warhead and cost from memory.",
      spec: {
        dispT: 2011,
        main: { count: 7, mm: 120 },
        beltMm: 0,
        speedKn: 39,
        rangeNm: 3000,
        torpTubes: 6,
        torpWarheadKg: 320,
        asw: 1,
        aaLight: [{ count: 4, mm: 40 }],
        aaHeavy: 0,
        aircraft: 0,
        costM: 5.5,
      },
    },
    {
      id: "pol_wilk",
      country: "POL",
      family: "ship",
      cls: "ss",
      techs: [],
      year: 1931,
      // Wilk, Ryś and Żbik, French-built minelaying submarines.
      source:
        "en.wikipedia Wilk-class submarine (980 t surfaced, 1 x 100 mm, 6 x 550 mm tubes, 14 kn, 7,000 nm); warhead and cost from memory.",
      spec: {
        dispT: 980,
        main: { count: 1, mm: 100 },
        beltMm: 0,
        speedKn: 14,
        rangeNm: 7000,
        torpTubes: 6,
        torpWarheadKg: 310,
        asw: 0,
        aaLight: [],
        aaHeavy: 0,
        aircraft: 0,
        costM: 3,
      },
    },
    {
      id: "pol_orzel",
      country: "POL",
      family: "ship",
      cls: "ss",
      techs: ["ss_2"],
      year: 1939,
      // Orzeł and Sęp, built in the Netherlands, partly from the Navy Fund.
      source:
        "en.wikipedia Orzeł-class submarine (1,100 t surfaced, 1 x 105 mm Bofors, 12 tubes, 15 kn, 7,000 nm, twin 40 mm); warhead and cost from memory.",
      spec: {
        dispT: 1100,
        main: { count: 1, mm: 105 },
        beltMm: 0,
        speedKn: 15,
        rangeNm: 7000,
        torpTubes: 12,
        torpWarheadKg: 300,
        asw: 0,
        aaLight: [{ count: 2, mm: 40 }],
        aaHeavy: 0,
        aircraft: 0,
        costM: 3.5,
      },
    },
    // ---------------------------------------------------------------- gear
    {
      id: "pol_wz29",
      country: "POL",
      family: "infantry",
      techs: ["inf_eq_1"],
      staticFor: "infantry_equipment:1",
      year: 1930,
      // Karabin wz. 29 from Radom, a short Mauser; the wz. 28 automatic rifle
      // (a Browning copy) in each squad is not counted (as the majors' BAR).
      source:
        "en.wikipedia Karabin wz. 1929 (7.92 x 57 mm, Mauser action, FB Radom); rate and range as the Kar 98k entry; cost from memory.",
      spec: { mm: 7.92, aimedRpm: 15, rangeM: 500, autoPct: 0, costUsd: 30 },
    },
    {
      id: "pol_fiat621",
      country: "POL",
      family: "support",
      techs: ["motorized_1"],
      staticFor: "motorized:1",
      year: 1935,
      // Polski Fiat 621, built under licence by PZInż in Warsaw.
      source:
        "en.wikipedia Polski Fiat 621 (2.5 t truck, licence-built by PZInż from 1935); range, cost and reliability from memory, against the Citroën U23 entry.",
      spec: {
        kind: "transport",
        rangeKm: 400,
        costUsd: 2000,
        reliability: 3,
      },
    },
    {
      id: "pol_wz14_19",
      country: "POL",
      family: "gun",
      role: "artillery",
      techs: ["artillery_1"],
      staticFor: "artillery:1",
      year: 1930,
      // 100 mm haubica wz. 14/19P, the Škoda howitzer built at Starachowice.
      source:
        "en.wikipedia Škoda 100 mm Model 1916 + pl.wikipedia haubica wz. 14/19 (about 1,500 kg, 16 kg shell, 9,800 m); rate of fire and cost from memory.",
      spec: {
        mm: 100,
        rpm: 6,
        rangeM: 9800,
        shellKg: 16,
        penMm500: 0,
        massKg: 1500,
        barrels: 1,
        costK: 7,
      },
    },
    {
      id: "pol_bofors_wz36",
      country: "POL",
      family: "gun",
      role: "anti_tank",
      techs: ["anti_tank_1"],
      staticFor: "anti_tank:1",
      year: 1936,
      // 37 mm armata przeciwpancerna wz. 36, the Bofors gun built under
      // licence.
      source:
        "en.wikipedia 37 mm Bofors anti-tank gun (about 380 kg, 0.7 kg shell, about 40 mm at 500 m flat, 31 used at 30 degrees); rate, range and cost from memory.",
      spec: {
        mm: 37,
        rpm: 12,
        rangeM: 1500,
        shellKg: 0.7,
        penMm500: 31,
        massKg: 380,
        barrels: 1,
        costK: 2.5,
      },
    },
    {
      id: "pol_ur_wz35",
      country: "POL",
      family: "gun",
      role: "anti_tank",
      techs: ["anti_tank_1", "inf_at_1"],
      year: 1938,
      // Karabin przeciwpancerny wz. 35, issued in sealed crates under the
      // cover name "Uruguay"; a rifle, so its numbers are small. No static
      // key: the Bofors gun holds anti_tank:1.
      source:
        "en.wikipedia Wz. 35 anti-tank rifle (7.92 mm, 9.5 kg, 15 mm at 300 m at 30 degrees, about 10 at 500 m); rate and cost from memory.",
      spec: {
        mm: 7.92,
        rpm: 10,
        rangeM: 300,
        shellKg: 0.013,
        penMm500: 10,
        massKg: 10,
        barrels: 1,
        costK: 0.1,
      },
    },
    {
      id: "pol_bofors_40",
      country: "POL",
      family: "gun",
      role: "anti_air",
      techs: ["anti_air_1"],
      staticFor: "anti_air:1",
      year: 1937,
      // 40 mm armata przeciwlotnicza wz. 36, the Bofors gun under licence.
      source:
        "en.wikipedia Bofors 40 mm L/60 gun (about 2,000 kg, 0.9 kg shell, 120 rpm, effective ceiling about 3,800 m); cost from memory.",
      spec: {
        mm: 40,
        rpm: 120,
        rangeM: 3800,
        shellKg: 0.9,
        penMm500: 0,
        massKg: 2000,
        barrels: 1,
        costK: 6,
      },
    },
  ],
  startArms: [
    {
      entry: "fra_ft17",
      origin: "received",
      count: 100,
      source:
        "en.wikipedia Renault FT in Polish service: about 120 came with Haller's army in 1919 and more were bought; about 100 remained in the 1930s",
    },
  ],
};
