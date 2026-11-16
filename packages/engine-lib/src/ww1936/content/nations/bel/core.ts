// ww229 (design ww227 §5-§6): BEL's generals, balance of power, own
// equipment and start arms, read before the content. Data only.
//
// Generals: the chiefs of staff and the King's adviser of 1936-1940, the
// commander of the Ardennes group and the Force Publique's general of the
// Ethiopian campaign. No `from`: their general's rank dates are not checked
// day by day (the sources say so).
//
// Balance of power: the language question, francophone (left, −) against
// Flemish (right, +). The state starts on the francophone side while the
// Flemish movement rises; focuses, decisions and events move it.
//
// Equipment: Belgian designs, Belgian licence production and the vehicles
// built abroad to Belgian order. Figures marked "from memory" were not
// checked against a second source; costs are estimates in 1940 US dollars
// against comparable items of the majors' catalogues.
import type { NationCore } from "../types";

export const CORE_BEL: NationCore = {
  tag: "BEL",
  generals: [
    {
      id: "bel_gen_van_den_bergen",
      tag: "BEL",
      att: 2,
      def: 3,
      plan: 3,
      log: 2,
      traits: ["defensive_doctrine"],
      source:
        "fr.wikipedia Édouard Van den Bergen: lieutenant-general, Chief of the General Staff 1935-1940; rank date not checked",
    },
    {
      id: "bel_gen_michiels",
      tag: "BEL",
      att: 2,
      def: 3,
      plan: 3,
      log: 3,
      traits: ["organizer"],
      source:
        "fr.wikipedia Oscar Michiels: lieutenant-general, Chief of the General Staff in the campaign of 1940; rank date not checked",
    },
    {
      id: "bel_gen_van_overstraeten",
      tag: "BEL",
      att: 1,
      def: 4,
      plan: 4,
      log: 2,
      traits: ["defensive_doctrine", "river_crosser"],
      source:
        "fr.wikipedia Raoul Van Overstraeten: general, the King's military adviser, author of the canal and K-W line plans; rank date not checked",
    },
    {
      id: "bel_gen_keyaerts",
      tag: "BEL",
      att: 2,
      def: 3,
      plan: 2,
      log: 2,
      traits: ["forest_expert"],
      source:
        "en.wikipedia Battle of Belgium + fr.wikipedia Maurice Keyaerts: commanded the K group (Chasseurs Ardennais and cavalry) in 1940; from memory",
    },
    {
      id: "bel_gen_gilliaert",
      tag: "BEL",
      att: 3,
      def: 2,
      plan: 3,
      log: 3,
      traits: ["logistics_wizard"],
      source:
        "en.wikipedia Auguste-Éduard Gilliaert + East African campaign: led the Force Publique at Saïo in 1941, accepting Gazzera's surrender; rank date not checked",
    },
  ],
  bop: [
    {
      tag: "BEL",
      // The left band (−600..−200): the francophone state still leads.
      startPm: -250,
      spirits: [
        "bel_sp_bop_french_state",
        "bel_sp_bop_francophone_lead",
        "bel_sp_bop_language_peace",
        "bel_sp_bop_flemish_rise",
        "bel_sp_bop_flemish_ascendant",
      ],
    },
  ],
  equipment: [
    // ---------------------------------------------------------------- tanks
    {
      id: "bel_t15",
      country: "BEL",
      family: "tank",
      role: "light",
      techs: [],
      year: 1935,
      // Vickers-Carden-Loyd Light Tank Model 1934, bought from Britain for
      // the cavalry; a 13.2 mm Hotchkiss machine gun in the turret.
      source:
        "en.wikipedia T-15 tank (Vickers-Carden-Loyd light tank, 42 delivered from 1935, about 3.8 t, 9 mm, 13.2 mm Hotchkiss); speeds, penetration and cost from memory.",
      spec: {
        massT: 3.8,
        hullFrontMm: 9,
        hullSlopeDeg: 0,
        turretFrontMm: 9,
        gunMm: 13.2,
        penMm500: 10,
        heFillerG: 0,
        mgs: 1,
        offroadKmh: 25,
        roadKmh: 50,
        reliability: 3,
        costK: 9,
      },
    },
    {
      id: "bel_t13_b3",
      country: "BEL",
      family: "tank",
      role: "td",
      techs: ["light_tank_1"],
      year: 1935,
      // The 47 mm FRC gun in an open turret on a Vickers tractor chassis.
      source:
        "en.wikipedia T-13 tank destroyer (Vickers-Carden-Loyd chassis, 47 mm FRC, open turret; T-13 B3 from 1935, about 5 t, 6-13 mm, 40 km/h); penetration as the bel_frc_47 entry; cost from memory.",
      spec: {
        massT: 5,
        hullFrontMm: 13,
        hullSlopeDeg: 0,
        turretFrontMm: 13,
        gunMm: 47,
        penMm500: 40,
        heFillerG: 60,
        mgs: 1,
        offroadKmh: 20,
        roadKmh: 40,
        openTop: true,
        reliability: 3,
        costK: 12,
      },
    },
    {
      id: "bel_acg1",
      country: "BEL",
      family: "tank",
      role: "light",
      techs: ["light_tank_1"],
      staticFor: "light_tank:1",
      year: 1937,
      // The French AMC 35 to Belgian order, with a Belgian turret and the
      // 47 mm FRC gun; troublesome in service.
      source:
        "en.wikipedia AMC 35 (ACG-1: 25 for Belgium from 1937, 14.5 t, 25 mm, 47 mm FRC in a Belgian turret, 40 km/h); cross-country speed and cost from memory.",
      spec: {
        massT: 14.5,
        hullFrontMm: 25,
        hullSlopeDeg: 0,
        turretFrontMm: 25,
        gunMm: 47,
        penMm500: 40,
        heFillerG: 60,
        mgs: 1,
        offroadKmh: 25,
        roadKmh: 40,
        reliability: 2,
        costK: 30,
      },
    },
    // ---------------------------------------------------------------- planes
    {
      id: "bel_firefly_iim",
      country: "BEL",
      family: "plane",
      type: "fighter",
      techs: ["fighter_1"],
      staticFor: "fighter:1",
      year: 1932,
      // Fairey Firefly IIM, biplane fighter, most built under licence by
      // Avions Fairey at Gosselies; still in the fighter groups in 1936.
      source:
        "en.wikipedia Fairey Firefly IIM (Belgian service from the early 1930s, most built by Avions Fairey; about 360 km/h, two machine guns); masses, range and cost from memory.",
      spec: {
        guns: [{ mm: 7.65, count: 2, rpm: 1000 }],
        maxKmh: 359,
        rangeKm: 500,
        emptyKg: 1130,
        wingLoad: 75,
        defGuns: 0,
        bombKg: 0,
        torpedoKg: 0,
        reliability: 3,
        costK: 14,
      },
    },
    {
      id: "bel_renard_r36",
      country: "BEL",
      family: "plane",
      type: "fighter",
      techs: ["fighter_2"],
      year: 1937,
      // Renard's monoplane fighter; one prototype flew and a production
      // order was placed, then cancelled. Here a design a research path
      // reaches.
      source:
        "en.wikipedia Renard R.36 (single-seat monoplane, Hispano-Suiza 12Y, about 500 km/h; one built, the order for 40 cancelled); armament, masses and cost from memory.",
      spec: {
        guns: [
          { mm: 20, count: 1, rpm: 600 },
          { mm: 7.65, count: 2, rpm: 1000 },
        ],
        maxKmh: 500,
        rangeKm: 900,
        emptyKg: 1800,
        wingLoad: 140,
        defGuns: 0,
        bombKg: 0,
        torpedoKg: 0,
        reliability: 3,
        costK: 30,
      },
    },
    {
      id: "bel_fox_vi",
      country: "BEL",
      family: "plane",
      type: "cas",
      techs: ["cas_1"],
      staticFor: "cas:1",
      year: 1934,
      // Fairey Fox VI, Belgian-built light bomber and army co-operation
      // biplane with a Hispano-Suiza engine.
      source:
        "en.wikipedia Fairey Fox (Belgian Fox VI built by Avions Fairey from the mid-1930s, Hispano-Suiza 12Y, light bomb load); speed, masses and cost from memory.",
      spec: {
        guns: [{ mm: 7.65, count: 1, rpm: 1000 }],
        maxKmh: 360,
        rangeKm: 600,
        emptyKg: 1300,
        wingLoad: 70,
        defGuns: 1,
        bombKg: 100,
        torpedoKg: 0,
        reliability: 3,
        costK: 16,
      },
    },
    {
      id: "bel_renard_r31",
      country: "BEL",
      family: "plane",
      type: "cas",
      techs: [],
      year: 1935,
      // Renard R.31, parasol-wing reconnaissance monoplane built by SABCA;
      // the only Belgian-designed aircraft in squadron service (the
      // catalogue has no recon flag on planes yet, so it flies as cas).
      source:
        "en.wikipedia Renard R.31 (two-seat parasol reconnaissance monoplane, Rolls-Royce Kestrel, about 300 km/h, 34 built by SABCA); masses, range and cost from memory.",
      spec: {
        guns: [{ mm: 7.65, count: 1, rpm: 1000 }],
        maxKmh: 300,
        rangeKm: 650,
        emptyKg: 1350,
        wingLoad: 75,
        defGuns: 1,
        bombKg: 0,
        torpedoKg: 0,
        reliability: 3,
        costK: 13,
      },
    },
    // ---------------------------------------------------------------- gear
    {
      id: "bel_mauser_m1935",
      country: "BEL",
      family: "infantry",
      techs: ["inf_eq_1"],
      staticFor: "infantry_equipment:1",
      year: 1935,
      // The FN Mauser in 7.65 mm, the Belgian service rifle.
      source:
        "en.wikipedia FN Model 1935 / Belgian Mauser (7.65x53 mm, FN Herstal); rate and range as the Kar 98k entry; cost from memory.",
      spec: { mm: 7.65, aimedRpm: 15, rangeM: 500, autoPct: 0, costUsd: 30 },
    },
    {
      id: "bel_fn_model_d",
      country: "BEL",
      family: "infantry",
      techs: ["inf_eq_1"],
      year: 1932,
      // FN Model D, Herstal's improved Browning automatic rifle with a
      // quick-change barrel; one in each squad raises the automatic share.
      source:
        "en.wikipedia M1918 Browning Automatic Rifle (FN Model D, Belgian service from 1932 in 7.65 mm, quick-change barrel); squad share and cost from memory.",
      spec: { mm: 7.65, aimedRpm: 18, rangeM: 600, autoPct: 12, costUsd: 42 },
    },
    {
      id: "bel_frc_47",
      country: "BEL",
      family: "gun",
      role: "anti_tank",
      techs: ["anti_tank_1"],
      staticFor: "anti_tank:1",
      year: 1932,
      // Canon antichar de 47 mm FRC: the Royal Gun Foundry's anti-tank gun.
      source:
        "en.wikipedia 47 mm anti-tank gun Model 1931 (FRC, about 515 kg, 1.52 kg AP shell at about 720 m/s); penetration, range and rate from memory.",
      spec: {
        mm: 47,
        rpm: 15,
        rangeM: 2500,
        shellKg: 1.52,
        penMm500: 40,
        massKg: 515,
        barrels: 1,
        costK: 4,
      },
    },
    {
      id: "bel_frc_76",
      country: "BEL",
      family: "gun",
      role: "artillery",
      techs: ["artillery_1"],
      staticFor: "artillery:1",
      year: 1932,
      // Canon de 76 FRC, the short infantry gun of the Royal Gun Foundry.
      source:
        "en.wikipedia 76 mm FRC infantry gun (short 76 mm piece of the Fonderie Royale des Canons, early 1930s); weight, shell, range, rate and cost from memory.",
      spec: {
        mm: 76,
        rpm: 10,
        rangeM: 6500,
        shellKg: 4.5,
        penMm500: 0,
        massKg: 800,
        barrels: 1,
        costK: 5,
      },
    },
  ],
  startArms: [
    {
      entry: "gbr_battle",
      origin: "licensed",
      count: 0,
      source:
        "en.wikipedia Fairey Battle (Belgium: 16 built by Avions Fairey, the Belgian branch of Fairey, from 1938); the licence stood within the Fairey firm.",
    },
  ],
};
