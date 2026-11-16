// ww229 (design ww227 §5-§6): Canada's generals, own equipment and start
// arms, read before the content. Canada has no balance of power (not in
// BOP_TAGS); its mechanism (the conscription question) is spirits and
// decisions in index.ts.
//
// Equipment: what Canadian plants built, real specifications from memory of
// the en.wikipedia articles named in each `source`; nothing here was checked
// against a printed reference, and a middle value is used where recalled
// figures differ. Licence-built types (Hurricane, Bolingbroke, Hampden,
// Canso, Mosquito, Lancaster, Grizzly, Bren, No. 4 rifle, 25-pounder,
// Bofors) carry the specification of the Canadian version. Costs are 1940
// US dollars of industrial effort scaled from the comparable item in the
// majors' catalogues. MinorClamp holds every fight number between the
// generic key's and the majors' median.
import type { NationCore } from "../types";

export const CORE_CAN: NationCore = {
  tag: "CAN",
  // Skills [att, def, plan, log] judged from the careers. The divisional
  // commanders of the later war come in from the year they led formations.
  generals: [
    {
      id: "can_mcnaughton",
      tag: "CAN",
      att: 2,
      def: 3,
      plan: 4,
      log: 4,
      traits: ["artillery_officer", "organizer"],
      source:
        "en.wikipedia Andrew McNaughton: gunner and scientist, commanded the 1st Canadian Division, the Canadian Corps and First Canadian Army 1939-1943",
    },
    {
      id: "can_crerar",
      tag: "CAN",
      att: 2,
      def: 3,
      plan: 4,
      log: 3,
      traits: ["artillery_officer", "defensive_doctrine"],
      source:
        "en.wikipedia Harry Crerar: Chief of the General Staff 1940-1941, I Canadian Corps, First Canadian Army 1944-1945",
    },
    {
      id: "can_simonds",
      tag: "CAN",
      att: 4,
      def: 3,
      plan: 4,
      log: 3,
      traits: ["armor_expert", "offensive_doctrine"],
      from: "1942-01-01",
      source:
        "en.wikipedia Guy Simonds: 1st Infantry and 5th Armoured Divisions, II Canadian Corps 1944-1945; Operation Totalize and the first armoured personnel carriers",
    },
    {
      id: "can_foulkes",
      tag: "CAN",
      att: 3,
      def: 3,
      plan: 3,
      log: 3,
      traits: ["infantry_officer"],
      from: "1942-01-01",
      source:
        "en.wikipedia Charles Foulkes: 2nd Canadian Infantry Division in Normandy, I Canadian Corps in Italy and the Netherlands 1944-1945",
    },
    {
      id: "can_burns",
      tag: "CAN",
      att: 2,
      def: 3,
      plan: 3,
      log: 3,
      traits: ["engineer_officer"],
      from: "1943-01-01",
      source:
        "en.wikipedia E. L. M. Burns: 5th Canadian Armoured Division and I Canadian Corps in Italy 1944",
    },
    {
      id: "can_hoffmeister",
      tag: "CAN",
      att: 4,
      def: 2,
      plan: 3,
      log: 2,
      traits: ["armor_expert"],
      from: "1943-01-01",
      source:
        "en.wikipedia Bert Hoffmeister: 2nd Canadian Infantry Brigade at Ortona, 5th Canadian Armoured Division 1944-1945",
    },
  ],
  bop: [],
  equipment: [
    // ------------------------------------------------------------ tanks
    {
      id: "can_otter",
      country: "CAN",
      family: "tank",
      role: "light",
      techs: ["light_tank_1"],
      year: 1942,
      staticFor: "light_tank:1",
      // GM Canada Otter light reconnaissance car: about 4.8 t, 12 mm
      // plate, a Bren gun and a Boys anti-tank rifle, 72 km/h on the road.
      source:
        "en.wikipedia Otter Light Reconnaissance Car, from memory; cost scaled from the Daimler armoured car",
      spec: {
        massT: 4.8,
        hullFrontMm: 12,
        hullSlopeDeg: 30,
        gunMm: 13.9,
        penMm500: 12,
        heFillerG: 0,
        mgs: 1,
        offroadKmh: 30,
        roadKmh: 72,
        wheeled: true,
        reliability: 3,
        costK: 9,
      },
    },
    {
      id: "can_fox",
      country: "CAN",
      family: "tank",
      role: "light",
      techs: ["light_tank_2"],
      year: 1943,
      // GM Canada Fox armoured car: the Humber IV on a Canadian chassis,
      // 7.5 t, 15 mm front, a .50 and a .30 machine gun in the turret.
      source:
        "en.wikipedia Fox Armoured Car, from memory; cost scaled from the Daimler armoured car",
      spec: {
        massT: 7.5,
        hullFrontMm: 15,
        hullSlopeDeg: 30,
        turretFrontMm: 15,
        gunMm: 12.7,
        penMm500: 15,
        heFillerG: 0,
        mgs: 1,
        offroadKmh: 30,
        roadKmh: 80,
        wheeled: true,
        reliability: 3,
        costK: 14,
      },
    },
    {
      id: "can_ram_ii",
      country: "CAN",
      family: "tank",
      role: "medium",
      techs: ["medium_tank_1"],
      year: 1942,
      staticFor: "medium_tank:1",
      // Montreal Locomotive Works Ram II: the M3 Lee chassis with a cast
      // Canadian hull and turret, 29.5 t, about 76 mm on the front, a 6-pdr
      // (57 mm) gun, three machine guns. Never fought as a gun tank.
      source:
        "en.wikipedia Ram tank, from memory; cost scaled from the M3 Lee by weight",
      spec: {
        massT: 29.5,
        hullFrontMm: 76,
        hullSlopeDeg: 10,
        turretFrontMm: 76,
        gunMm: 57,
        penMm500: 70,
        heFillerG: 0,
        mgs: 3,
        offroadKmh: 24,
        roadKmh: 40,
        reliability: 4,
        costK: 40,
      },
    },
    {
      id: "can_grizzly",
      country: "CAN",
      family: "tank",
      role: "medium",
      techs: ["medium_tank_2", "tank_gun_2"],
      year: 1943,
      staticFor: "medium_tank:2",
      // Grizzly I: the M4A1 Sherman built under licence at Montreal
      // Locomotive Works with Canadian tracks; 30.3 t, 51 mm at 56 degrees,
      // 75 mm M3 gun.
      source:
        "en.wikipedia Grizzly I (M4A1 Sherman), from memory; figures as the M4A1",
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
      id: "can_sexton",
      country: "CAN",
      family: "tank",
      role: "spa",
      techs: ["medium_tank_2", "artillery_2"],
      year: 1943,
      // Sexton: a 25-pounder in an open casemate on the Ram (later the
      // Grizzly) chassis, designed and built in Canada; 25.9 t.
      source:
        "en.wikipedia Sexton (artillery), from memory; cost scaled from the M7 Priest",
      spec: {
        massT: 25.9,
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
      id: "can_skink",
      country: "CAN",
      family: "tank",
      role: "spaa",
      techs: ["medium_tank_2", "anti_air_2"],
      year: 1944,
      // Skink: a Grizzly hull with a closed turret of four 20 mm Polsten
      // cannon; only a handful were finished before the order was cut.
      source:
        "en.wikipedia Skink anti-aircraft tank, from memory; cost scaled from the Grizzly",
      spec: {
        massT: 29,
        hullFrontMm: 51,
        hullSlopeDeg: 56,
        turretFrontMm: 51,
        gunMm: 20,
        penMm500: 16,
        heFillerG: 6,
        mgs: 1,
        offroadKmh: 25,
        roadKmh: 38,
        reliability: 4,
        costK: 46,
        aa: { barrels: 4, rpm: 450, mm: 20 },
      },
    },
    // ------------------------------------------------------------ planes
    {
      id: "can_hurricane_xii",
      country: "CAN",
      family: "plane",
      type: "fighter",
      techs: ["fighter_1"],
      year: 1941,
      staticFor: "fighter:1",
      // Canadian Car and Foundry Hurricane XII: Packard Merlin 29,
      // twelve .303 Brownings, about 540 km/h.
      source:
        "en.wikipedia Hawker Hurricane (Canadian production, Mk X-XII), from memory; cost as the Hurricane I",
      spec: {
        maxKmh: 540,
        rangeKm: 900,
        emptyKg: 2500,
        wingLoad: 130,
        guns: [{ mm: 7.7, count: 12, rpm: 1150 }],
        defGuns: 0,
        bombKg: 0,
        torpedoKg: 0,
        reliability: 4,
        costK: 30,
      },
    },
    {
      id: "can_bolingbroke",
      country: "CAN",
      family: "plane",
      type: "bomber",
      techs: ["bomber_1"],
      year: 1939,
      staticFor: "bomber:1",
      // Fairchild Canada Bolingbroke IV: the Blenheim IV built at
      // Longueuil, used for coastal patrol and training.
      source:
        "en.wikipedia Bristol Blenheim (Fairchild Bolingbroke), from memory; figures as the Blenheim IV",
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
      id: "can_hampden",
      country: "CAN",
      family: "plane",
      type: "naval_bomber",
      techs: ["naval_bomber_1"],
      year: 1940,
      staticFor: "naval_bomber:1",
      // Canadian Associated Aircraft Hampden: about 160 built in Quebec and
      // Ontario; as a torpedo bomber it carried one 18-inch torpedo.
      source:
        "en.wikipedia Handley Page Hampden (Canadian production), from memory; cost scaled from the Beaufort",
      spec: {
        maxKmh: 409,
        rangeKm: 2700,
        emptyKg: 5340,
        wingLoad: 160,
        guns: [{ mm: 7.7, count: 1, rpm: 1150 }],
        defGuns: 5,
        bombKg: 1800,
        torpedoKg: 730,
        reliability: 3,
        costK: 70,
      },
    },
    {
      id: "can_canso_a",
      country: "CAN",
      family: "plane",
      type: "naval_bomber",
      techs: ["naval_bomber_2"],
      year: 1942,
      // Canso A: the amphibious PBY-5A built by Canadian Vickers and Boeing
      // Canada, with ASV radar for the air gap over the convoys.
      source:
        "en.wikipedia Consolidated PBY Catalina (Canso A), from memory; figures as the PBY-5A",
      spec: {
        maxKmh: 288,
        rangeKm: 4000,
        emptyKg: 9500,
        wingLoad: 118,
        guns: [],
        defGuns: 5,
        bombKg: 1800,
        torpedoKg: 970,
        radar: true,
        reliability: 5,
        costK: 90,
      },
    },
    {
      id: "can_mosquito_b20",
      country: "CAN",
      family: "plane",
      type: "bomber",
      techs: ["bomber_2", "aero_engine_3"],
      year: 1943,
      // de Havilland Canada Mosquito B.XX: the B Mk IV with Packard
      // Merlins, built at Downsview.
      source:
        "en.wikipedia de Havilland Mosquito (Canadian production, B.XX), from memory; figures as the B Mk IV",
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
      id: "can_lancaster_x",
      country: "CAN",
      family: "plane",
      type: "strat_bomber",
      techs: ["strat_bomber_3", "aero_engine_3"],
      year: 1943,
      // Victory Aircraft Lancaster B.X: the Lancaster with Packard Merlins,
      // built at Malton and flown to No. 6 Group.
      source:
        "en.wikipedia Avro Lancaster (Victory Aircraft B.X), from memory; figures as the Lancaster I",
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
    // ------------------------------------------------------------ ships
    {
      id: "can_flower_class",
      country: "CAN",
      family: "ship",
      cls: "dd",
      techs: [],
      year: 1940,
      // Flower-class corvette, Canadian builds: about 1,000 t, one 4-inch
      // gun, a 2-pdr pom-pom, 16 knots, depth charges and asdic.
      source:
        "en.wikipedia Flower-class corvette (Royal Canadian Navy), from memory; cost estimate",
      spec: {
        dispT: 1000,
        main: { count: 1, mm: 102 },
        beltMm: 0,
        speedKn: 16,
        rangeNm: 3500,
        torpTubes: 0,
        torpWarheadKg: 0,
        asw: 3,
        aaLight: [{ count: 1, mm: 40 }],
        aaHeavy: 0,
        aircraft: 0,
        costM: 0.6,
      },
    },
    {
      id: "can_river_class",
      country: "CAN",
      family: "ship",
      cls: "dd",
      techs: ["dd_2"],
      year: 1942,
      // River-class frigate, Canadian builds: 1,445 t, two 4-inch guns,
      // 20 knots, the range to escort a convoy across.
      source:
        "en.wikipedia River-class frigate (Royal Canadian Navy), from memory; cost estimate",
      spec: {
        dispT: 1445,
        main: { count: 2, mm: 102 },
        beltMm: 0,
        speedKn: 20,
        rangeNm: 7200,
        torpTubes: 0,
        torpWarheadKg: 0,
        asw: 3,
        aaLight: [{ count: 4, mm: 20 }],
        aaHeavy: 0,
        aircraft: 0,
        costM: 1.5,
      },
    },
    {
      id: "can_tribal_class",
      country: "CAN",
      family: "ship",
      cls: "dd",
      techs: ["dd_2"],
      year: 1942,
      // Tribal-class destroyer for the RCN (Iroquois, Athabaskan, Huron,
      // Haida from British yards; four more at Halifax): 1,927 t, six 4.7-in
      // and two 4-in guns, 36 knots.
      source:
        "en.wikipedia Tribal-class destroyer (1936) in Canadian service, from memory; cost as the British Tribal",
      spec: {
        dispT: 1927,
        main: { count: 6, mm: 120 },
        secondary: { count: 2, mm: 102 },
        beltMm: 0,
        speedKn: 36,
        rangeNm: 5700,
        torpTubes: 4,
        torpWarheadKg: 365,
        asw: 2,
        aaLight: [
          { count: 4, mm: 40 },
          { count: 6, mm: 20 },
        ],
        aaHeavy: 0,
        aircraft: 0,
        costM: 6.5,
      },
    },
    // ------------------------------------------------------------ infantry
    {
      id: "can_no4_long_branch",
      country: "CAN",
      family: "infantry",
      techs: ["inf_eq_2"],
      year: 1941,
      staticFor: "infantry_equipment:2",
      // Rifle No. 4 Mk I*, made at the Long Branch arsenal near Toronto.
      source:
        "en.wikipedia Lee-Enfield (Long Branch No. 4 Mk I*), from memory; cost as the No. 4",
      spec: { mm: 7.7, aimedRpm: 20, rangeM: 500, autoPct: 0, costUsd: 22 },
    },
    {
      id: "can_inglis_bren",
      country: "CAN",
      family: "infantry",
      techs: ["inf_eq_1"],
      year: 1940,
      // Bren light machine gun, made by John Inglis and Company in Toronto,
      // one to a section.
      source:
        "en.wikipedia Bren light machine gun (John Inglis production), from memory; cost scaled from the BAR",
      spec: { mm: 7.7, aimedRpm: 30, rangeM: 600, autoPct: 12, costUsd: 60 },
    },
    // ------------------------------------------------------------ guns
    {
      id: "can_sorel_25pdr",
      country: "CAN",
      family: "gun",
      role: "artillery",
      techs: ["artillery_2"],
      year: 1941,
      staticFor: "artillery:2",
      // Ordnance QF 25-pounder, built by Sorel Industries.
      source:
        "en.wikipedia Ordnance QF 25-pounder (Sorel Industries production), from memory; figures as the British gun",
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
      id: "can_otis_bofors",
      country: "CAN",
      family: "gun",
      role: "anti_air",
      techs: ["anti_air_1"],
      year: 1941,
      staticFor: "anti_air:1",
      // Bofors 40 mm, built by Otis-Fensom in Hamilton.
      source:
        "en.wikipedia Bofors 40 mm gun (Otis-Fensom production), from memory; figures as the British Bofors",
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
    // ------------------------------------------------------------ support
    {
      id: "can_cmp_truck",
      country: "CAN",
      family: "support",
      techs: ["motorized_1"],
      year: 1940,
      staticFor: "motorized:1",
      // Canadian Military Pattern truck, Ford and GM Canada: some 400,000
      // built for the Commonwealth armies.
      source:
        "en.wikipedia Canadian Military Pattern truck, from memory; cost scaled from the Bedford QL",
      spec: { kind: "transport", rangeKm: 300, costUsd: 1800, reliability: 4 },
    },
    {
      id: "can_ws58",
      country: "CAN",
      family: "support",
      techs: ["support_eq_2"],
      year: 1943,
      // Wireless Set No. 58: a Canadian-designed man-pack set for the
      // infantry company.
      source:
        "en.wikipedia Wireless Set No. 58 (Canadian design), from memory; cost scaled from the No. 18 set",
      spec: { kind: "signal", rangeKm: 8, costUsd: 400 },
    },
  ],
  startArms: [
    {
      entry: "gbr_lt_mk6b",
      origin: "received",
      count: 16,
      source:
        "en.wikipedia Light Tank Mk VI: a few bought for Canada's tank school before the war, from memory",
    },
    {
      entry: "gbr_hurricane_i",
      origin: "received",
      count: 20,
      source:
        "en.wikipedia No. 1 Squadron RCAF: twenty Hurricane Is delivered in 1939, from memory",
    },
    {
      entry: "gbr_valentine",
      origin: "licensed",
      count: 0,
      source:
        "en.wikipedia Valentine tank: about 1,420 built by the CPR Angus Shops in Montreal, most sent to the Soviet Union",
    },
  ],
};
