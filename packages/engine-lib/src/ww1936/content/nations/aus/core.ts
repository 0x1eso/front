// ww229 (design ww227 §5-§6): AUS's generals, own equipment and start arms,
// read before the content. Australia has no balance of power: its mechanism,
// Empire First or Pacific First, is two ladders of decisions and staged
// spirits in content.ts.
//
// Generals: the commanders of the Second AIF and of the New Guinea
// campaigns. Equipment: what Australia built itself (the Lithgow and
// Maribyrnong government factories, the Commonwealth Aircraft Corporation,
// the Department of Aircraft Production, Cockatoo Island and the corvette
// yards). Figures are from the Wikipedia articles on each weapon, from
// memory; where they disagree a middle value is used. Costs are 1940 US
// dollars scaled from a comparable British or American item, as in the
// majors' files. hist/MinorClamp.ts holds the fight numbers in the minor band.
import type { NationCore } from "../types";

const SRC_INF =
  "Wikipedia (en) on the weapon and the Lithgow Small Arms Factory, from memory; cost scaled from the British equivalent";
const SRC_SHIP =
  "Wikipedia ship class articles (en), from memory; cost scaled from British ships by displacement";

export const CORE_AUS: NationCore = {
  tag: "AUS",
  generals: [
    {
      id: "blamey",
      tag: "AUS",
      att: 3,
      def: 3,
      plan: 4,
      log: 4,
      traits: ["organizer"],
      source:
        "en.wikipedia Thomas Blamey: GOC Second AIF and I Corps in Libya and Greece 1940-41, Commander-in-Chief Australian Military Forces 1942-45",
    },
    {
      id: "morshead",
      tag: "AUS",
      att: 3,
      def: 5,
      plan: 3,
      log: 3,
      traits: ["defensive_doctrine"],
      source:
        "en.wikipedia Leslie Morshead: 9th Division, commander of the Tobruk garrison 1941, El Alamein 1942, Borneo 1945",
    },
    {
      id: "mackay",
      tag: "AUS",
      att: 3,
      def: 3,
      plan: 4,
      log: 2,
      traits: ["set_piece"],
      source:
        "en.wikipedia Iven Mackay: 6th Division at Bardia and Tobruk 1941 and in Greece, later Home Forces and New Guinea Force",
    },
    {
      id: "vasey",
      tag: "AUS",
      att: 4,
      def: 3,
      plan: 3,
      log: 2,
      traits: ["hard_pursuit"],
      until: "1945-03-05",
      source:
        "en.wikipedia George Vasey: 7th Division on the Kokoda Track, Lae and the Ramu valley 1942-44; killed in an air crash 1945",
    },
    {
      id: "rowell",
      tag: "AUS",
      att: 2,
      def: 4,
      plan: 4,
      log: 3,
      traits: ["infantry_officer"],
      source:
        "en.wikipedia Sydney Rowell: I Corps and New Guinea Force on the Kokoda Track 1942, relieved by Blamey; later Chief of the General Staff",
    },
    {
      id: "bennett",
      tag: "AUS",
      att: 3,
      def: 2,
      plan: 2,
      log: 2,
      traits: ["ambusher"],
      source:
        "en.wikipedia Gordon Bennett: 8th Division in Malaya 1941-42 (the Gemas ambush), escaped from Singapore at its fall",
    },
  ],
  bop: [],
  equipment: [
    // ------------------------------------------------------------ infantry
    {
      id: "aus_lithgow_smle",
      country: "AUS",
      family: "infantry",
      techs: ["inf_eq_1"],
      year: 1913,
      // SMLE No. 1 Mk III*: the .303 rifle Lithgow made from 1913 on; the
      // army's rifle through both wars.
      source: SRC_INF,
      staticFor: "infantry_equipment:1",
      spec: { mm: 7.7, aimedRpm: 20, rangeM: 500, autoPct: 0, costUsd: 25 },
    },
    {
      id: "aus_lithgow_bren",
      country: "AUS",
      family: "infantry",
      techs: ["inf_eq_2"],
      year: 1941,
      // Bren light machine gun made at Lithgow in the war years, .303,
      // 30-round box, about 500 rounds a minute cyclic (first year of
      // production not checked).
      source: SRC_INF,
      spec: { mm: 7.7, aimedRpm: 40, rangeM: 550, autoPct: 10, costUsd: 120 },
    },
    {
      id: "aus_owen_gun",
      country: "AUS",
      family: "infantry",
      techs: ["inf_eq_2"],
      year: 1942,
      // Owen Machine Carbine: Evelyn Owen's 9 mm sub-machine gun, top-fed
      // 33-round magazine, about 700 rounds a minute; famous for working in
      // mud and jungle.
      source:
        "en.wikipedia Owen Gun, from memory; cost a guess near the Sten and the Thompson",
      spec: { mm: 9, aimedRpm: 25, rangeM: 150, autoPct: 12, costUsd: 45 },
    },
    // ------------------------------------------------------------ guns
    {
      id: "aus_2pdr_at",
      country: "AUS",
      family: "gun",
      role: "anti_tank",
      techs: ["anti_tank_1"],
      year: 1940,
      // Ordnance QF 2-pounder made by the Australian ordnance factories, the
      // AIF's anti-tank gun in the desert and in Malaya.
      source:
        "en.wikipedia Ordnance QF 2-pounder (Australian production), from memory; figures as the British gun",
      staticFor: "anti_tank:1",
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
      id: "aus_25pdr_short",
      country: "AUS",
      family: "gun",
      role: "artillery",
      techs: ["artillery_2"],
      year: 1943,
      // Ordnance QF 25-pounder Short: the Australian lightweight jungle
      // version, shorter barrel and lighter carriage, could be broken down
      // and carried; about 10.5 km range.
      source:
        "en.wikipedia Ordnance QF 25-pounder Short, from memory; cost scaled from the 25-pounder",
      spec: {
        mm: 87.6,
        rpm: 5,
        rangeM: 10500,
        shellKg: 11.3,
        penMm500: 0,
        massKg: 1315,
        barrels: 1,
        costK: 6,
      },
    },
    // ------------------------------------------------------------ tanks
    {
      id: "aus_lp2_carrier",
      country: "AUS",
      family: "tank",
      role: "light",
      techs: ["light_tank_1"],
      year: 1940,
      // Carrier, Machine Gun, LP2: the Australian-built version of the
      // universal carrier, about 4.5 t, 10 mm armour, a Bren and a Ford V8.
      source:
        "en.wikipedia Universal Carrier (Australian LP2 variants), from memory; armour and speed middle values; cost scaled from the Universal Carrier",
      spec: {
        massT: 4.5,
        hullFrontMm: 10,
        hullSlopeDeg: 0,
        gunMm: 7.7,
        penMm500: 0,
        heFillerG: 0,
        mgs: 1,
        offroadKmh: 30,
        roadKmh: 48,
        openTop: true,
        reliability: 3,
        costK: 6,
      },
    },
    {
      id: "aus_sentinel_ac1",
      country: "AUS",
      family: "tank",
      role: "medium",
      techs: ["medium_tank_1"],
      year: 1942,
      // AC1 Sentinel: cast hull and turret, 65 mm front, 2-pounder, three
      // Cadillac V8s, about 28 t and 48 km/h on the road; 65 built at
      // Chullora, never in battle.
      source:
        "en.wikipedia Sentinel tank, from memory; cost scaled from the M3 Lee by weight",
      spec: {
        massT: 28,
        hullFrontMm: 65,
        hullSlopeDeg: 0,
        turretFrontMm: 65,
        gunMm: 40,
        penMm500: 46,
        heFillerG: 0,
        mgs: 2,
        offroadKmh: 25,
        roadKmh: 48,
        reliability: 3,
        costK: 45,
      },
    },
    // ------------------------------------------------------------ planes
    {
      id: "aus_wirraway",
      country: "AUS",
      family: "plane",
      type: "cas",
      techs: ["cas_1"],
      year: 1939,
      // CAC Wirraway: the North American NA-16 built under licence and armed,
      // Wasp engine, about 354 km/h, two fixed and one flexible .303, 450 kg
      // of bombs; a trainer pressed into combat.
      source:
        "en.wikipedia CAC Wirraway, from memory; cost scaled from the North American Harvard",
      staticFor: "cas:1",
      spec: {
        maxKmh: 354,
        rangeKm: 1150,
        emptyKg: 1810,
        wingLoad: 127,
        guns: [{ mm: 7.7, count: 2, rpm: 1000 }],
        defGuns: 1,
        bombKg: 450,
        torpedoKg: 0,
        reliability: 4,
        costK: 25,
      },
    },
    {
      id: "aus_boomerang",
      country: "AUS",
      family: "plane",
      type: "fighter",
      techs: ["fighter_2"],
      year: 1942,
      // CAC Boomerang: the stopgap fighter built from Wirraway parts with a
      // Twin Wasp, about 490 km/h, two 20 mm and four .303; agile at low
      // level, used mostly for army co-operation.
      source:
        "en.wikipedia CAC Boomerang, from memory; cost scaled from the P-40",
      spec: {
        maxKmh: 490,
        rangeKm: 930,
        emptyKg: 2440,
        wingLoad: 167,
        guns: [
          { mm: 20, count: 2, rpm: 600 },
          { mm: 7.7, count: 4, rpm: 1000 },
        ],
        defGuns: 0,
        bombKg: 0,
        torpedoKg: 0,
        reliability: 4,
        costK: 30,
      },
    },
    {
      id: "aus_dap_beaufort",
      country: "AUS",
      family: "plane",
      type: "naval_bomber",
      techs: ["naval_bomber_1", "aero_engine_2"],
      year: 1941,
      // DAP Beaufort (Mk V-VIII): the British torpedo bomber built in
      // Australia with Pratt & Whitney Twin Wasps, about 430 km/h, an 18-inch
      // torpedo or 900 kg of bombs; about 700 built.
      source:
        "en.wikipedia Bristol Beaufort (Australian production), from memory; cost as the British Beaufort",
      spec: {
        maxKmh: 430,
        rangeKm: 2300,
        emptyKg: 6000,
        wingLoad: 205,
        guns: [{ mm: 7.7, count: 2, rpm: 1150 }],
        defGuns: 3,
        bombKg: 900,
        torpedoKg: 730,
        reliability: 3,
        costK: 75,
      },
    },
    {
      id: "aus_dap_beaufighter",
      country: "AUS",
      family: "plane",
      type: "heavy_fighter",
      techs: ["heavy_fighter_2"],
      year: 1944,
      // DAP Beaufighter Mk 21: Hercules engines, four 20 mm cannon and four
      // .50 wing guns, rockets or bombs; the RAAF's strike fighter in the
      // islands, no interception radar.
      source:
        "en.wikipedia Bristol Beaufighter (DAP Mk 21), from memory; cost as the British Beaufighter",
      spec: {
        maxKmh: 515,
        rangeKm: 2380,
        emptyKg: 7080,
        wingLoad: 214,
        guns: [
          { mm: 20, count: 4, rpm: 600 },
          { mm: 12.7, count: 4, rpm: 750 },
        ],
        defGuns: 1,
        bombKg: 450,
        torpedoKg: 0,
        reliability: 3,
        costK: 75,
      },
    },
    // ------------------------------------------------------------ ships
    {
      id: "aus_bathurst_class",
      country: "AUS",
      family: "ship",
      cls: "dd",
      techs: ["sonar_1"],
      year: 1940,
      // Bathurst-class corvette (Australian Minesweeper): 650 t, one 4-inch,
      // a 40 mm and 20 mm guns, depth charges and asdic, 15.5 kn; 60 built
      // in Australian yards.
      source: SRC_SHIP,
      spec: {
        dispT: 650,
        main: { count: 1, mm: 102 },
        beltMm: 0,
        speedKn: 15.5,
        rangeNm: 2800,
        torpTubes: 0,
        torpWarheadKg: 0,
        asw: 2,
        aaLight: [
          { count: 1, mm: 40 },
          { count: 2, mm: 20 },
        ],
        aaHeavy: 0,
        aircraft: 0,
        costM: 0.8,
      },
    },
    {
      id: "aus_tribal_class",
      country: "AUS",
      family: "ship",
      cls: "dd",
      techs: ["dd_3"],
      year: 1942,
      // Arunta, Warramunga and Bataan, Tribal-class destroyers built at
      // Cockatoo Island: about 1,930 t, six 4.7-inch and two 4-inch, four
      // torpedo tubes, 36 kn.
      source: SRC_SHIP,
      spec: {
        dispT: 1930,
        main: { count: 6, mm: 120 },
        secondary: { count: 2, mm: 102 },
        beltMm: 0,
        speedKn: 36,
        rangeNm: 5700,
        torpTubes: 4,
        torpWarheadKg: 340,
        asw: 2,
        aaLight: [
          { count: 4, mm: 40 },
          { count: 6, mm: 20 },
        ],
        aaHeavy: 2,
        aircraft: 0,
        costM: 7,
      },
    },
  ],
  startArms: [
    {
      entry: "gbr_lt_mk6b",
      origin: "received",
      count: 10,
      source:
        "en.wikipedia Tanks in the Australian Army: ten Light Tank Mk VIA bought before the war (the catalogue's Mk VIB is the nearest entry), with four old Vickers Mediums",
    },
  ],
};
