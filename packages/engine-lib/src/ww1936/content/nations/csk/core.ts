// ww229 (design ww227 §5-§6): CSK's generals, own equipment and start arms,
// read before the content. Czechoslovakia has no balance of power (design §5
// gives it the fortification and Sudeten chain instead, in index.ts).
//
// Equipment: real specifications, from memory of the en.wikipedia articles
// on each weapon (and the Czech wiki where named); nothing was checked
// against a printed reference. Costs are 1940 US dollars of industrial
// effort scaled from the majors' like items (hist/ita.ts header). The clamp
// (hist/MinorClamp.ts) holds every fight number between the generic key and
// the majors' median; nothing here is tuned. CSK held no foreign licence for
// a tank or plane at the start: Avia's SB-2 licence (B-71) came in 1937 and
// is its own entry here, as is Aero's licence-built Bloch MB.200.
import type { NationCore } from "../types";

const SRC_AIR =
  "en.wikipedia aircraft articles, from memory; cost scaled from the majors' aircraft of like weight";
const SRC_GUN =
  "en.wikipedia gun articles (Czech designations), from memory; cost scaled from the majors' guns";

export const CORE_CSK: NationCore = {
  tag: "CSK",
  generals: [
    {
      // Chief of the General Staff 1933-1939; commanded the field army in
      // the 1938 mobilisation.
      id: "csk_krejci",
      tag: "CSK",
      att: 3,
      def: 4,
      plan: 4,
      log: 3,
      traits: ["defensive_doctrine"],
      source:
        "en.wikipedia Ludvík Krejčí + cs.wikipedia: army general, Chief of the General Staff 1933-1939",
    },
    {
      // Inspector General of the Army from 1933, prime minister in the
      // autumn of 1938; a legion commander in Russia.
      id: "csk_syrovy",
      tag: "CSK",
      att: 2,
      def: 3,
      plan: 3,
      log: 3,
      traits: ["infantry_officer"],
      source:
        "en.wikipedia Jan Syrový + cs.wikipedia: army general, Inspector General 1933-1938, prime minister 1938",
    },
    {
      // Land commander in Prague, led the 1st Army in 1938; a legion
      // commander in Siberia.
      id: "csk_vojcechovsky",
      tag: "CSK",
      att: 4,
      def: 3,
      plan: 3,
      log: 2,
      traits: ["offensive_doctrine"],
      source:
        "en.wikipedia Sergej Vojcechovský + cs.wikipedia: army general, Land Military Commander in Prague, 1st Army 1938",
    },
    {
      // Land commander in Košice, led the 4th Army in Moravia in 1938.
      id: "csk_prchala",
      tag: "CSK",
      att: 3,
      def: 3,
      plan: 2,
      log: 3,
      traits: ["organizer"],
      source:
        "en.wikipedia Lev Prchala + cs.wikipedia: division general, 4th Army 1938, later in Poland and London",
    },
    {
      // The one Slovak general of the First Republic; commanded the 1st
      // Czechoslovak Army in Slovakia during the 1944 uprising.
      id: "csk_viest",
      tag: "CSK",
      att: 3,
      def: 3,
      plan: 3,
      log: 2,
      traits: ["infantry_expert"],
      source:
        "en.wikipedia Rudolf Viest + sk.wikipedia: division general, the only Slovak general of the interwar army",
    },
  ],
  bop: [],
  equipment: [
    // ------------------------------------------------------------ infantry
    {
      id: "csk_vz24",
      country: "CSK",
      family: "infantry",
      techs: ["inf_eq_1"],
      year: 1924,
      // Puška vz. 24: Zbrojovka Brno's 7.92 mm Mauser, exported widely.
      source:
        "en.wikipedia vz. 24 (Mauser, 7.92x57 mm, Zbrojovka Brno), from memory; cost near the Kar98k",
      spec: { mm: 7.92, aimedRpm: 15, rangeM: 500, autoPct: 0, costUsd: 28 },
    },
    {
      id: "csk_zb26",
      country: "CSK",
      family: "infantry",
      techs: ["inf_eq_1"],
      year: 1926,
      // ZB vz. 26: the light machine gun the Bren grew from; one per squad
      // raises the share of automatic fire (about one weapon in eight).
      source:
        "en.wikipedia ZB vz. 26 (7.92 mm, 500 rounds a minute, 30-round box), from memory; squad cost an estimate",
      spec: { mm: 7.92, aimedRpm: 18, rangeM: 600, autoPct: 12, costUsd: 40 },
    },
    // ------------------------------------------------------------ support
    {
      id: "csk_tatra_t82",
      country: "CSK",
      family: "support",
      techs: ["motorized_1"],
      staticFor: "motorized:1",
      year: 1935,
      // Tatra T 82: six-wheeled army truck on Tatra's backbone chassis.
      source:
        "en.wikipedia and cs.wikipedia Tatra 82 (6x4 army truck), from memory; range and cost estimates",
      spec: { kind: "transport", rangeKm: 400, costUsd: 2200, reliability: 4 },
    },
    // ------------------------------------------------------------ tanks
    {
      id: "csk_lt35",
      country: "CSK",
      family: "tank",
      role: "light",
      techs: ["light_tank_1"],
      year: 1936,
      // LT vz. 35 (Škoda S-II-a): 10.5 t, 25 mm front, 37 mm ÚV vz. 34,
      // two 7.92 mm machine guns, 34 km/h; its pneumatic steering failed
      // in the cold.
      source:
        "en.wikipedia LT vz. 35 (10.5 t, 8-25 mm, 37 mm A3), from memory; cost scaled from the Pz 38(t)",
      spec: {
        massT: 10.5,
        hullFrontMm: 25,
        hullSlopeDeg: 0,
        turretFrontMm: 25,
        gunMm: 37,
        penMm500: 30,
        heFillerG: 20,
        mgs: 2,
        offroadKmh: 20,
        roadKmh: 34,
        reliability: 2,
        costK: 22,
      },
    },
    {
      id: "csk_tancik_vz33",
      country: "CSK",
      family: "tank",
      role: "light",
      techs: ["light_tank_1"],
      year: 1933,
      // ČKD tančík vz. 33: 2.3 t tankette, 12 mm plate, two machine guns.
      source:
        "en.wikipedia Tančík vz. 33 (2.3 t, 12 mm, two 7.92 mm MGs, 70 built), from memory; cost scaled from the CV.33",
      spec: {
        massT: 2.3,
        hullFrontMm: 12,
        hullSlopeDeg: 0,
        gunMm: 7.92,
        penMm500: 0,
        heFillerG: 0,
        mgs: 2,
        offroadKmh: 18,
        roadKmh: 35,
        reliability: 3,
        costK: 8,
      },
    },
    {
      id: "csk_lt38",
      country: "CSK",
      family: "tank",
      role: "light",
      techs: ["light_tank_2"],
      year: 1938,
      // LT vz. 38 (ČKD TNH): 9.7 t, 25 mm front, 37 mm ÚV vz. 38, leaf
      // springs and big road wheels; very reliable.
      source:
        "en.wikipedia LT vz. 38 / Panzer 38(t) (9.7 t, 25 mm, 37 mm A7, 42 km/h), from memory; same figures as deu_pz38t_c",
      spec: {
        massT: 9.7,
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
    // ------------------------------------------------------------ guns
    {
      id: "csk_100_vz30",
      country: "CSK",
      family: "gun",
      role: "artillery",
      techs: ["artillery_1"],
      year: 1930,
      // 10 cm houfnice vz. 30 (Škoda): 16 kg shell, about 13,500 m.
      source: SRC_GUN,
      spec: {
        mm: 100,
        rpm: 6,
        rangeM: 13500,
        shellKg: 16,
        penMm500: 0,
        massKg: 1770,
        barrels: 1,
        costK: 8,
      },
    },
    {
      id: "csk_150_vz37",
      country: "CSK",
      family: "gun",
      role: "artillery",
      techs: ["artillery_1", "art_imp_1"],
      year: 1937,
      // 15 cm hrubá houfnice vz. 37 (Škoda K4): 42 kg shell, about 15,000 m,
      // a little over five tonnes in action (sources 5,200-5,700, 5,200 used).
      source: SRC_GUN,
      spec: {
        mm: 149,
        rpm: 4,
        rangeM: 15100,
        shellKg: 42,
        penMm500: 0,
        massKg: 5200,
        barrels: 1,
        costK: 18,
      },
    },
    {
      id: "csk_47_vz36",
      country: "CSK",
      family: "gun",
      role: "anti_tank",
      techs: ["anti_tank_1"],
      year: 1936,
      // 4.7 cm kanon PÚV vz. 36 (Škoda A6): 1.65 kg shot, about 590 kg;
      // penetration quoted 48-60 mm at 500 m by angle, 48 used.
      source: SRC_GUN,
      spec: {
        mm: 47,
        rpm: 12,
        rangeM: 4000,
        shellKg: 1.65,
        penMm500: 48,
        massKg: 590,
        barrels: 1,
        costK: 2.5,
      },
    },
    // ------------------------------------------------------------ aircraft
    {
      id: "csk_avia_b534",
      country: "CSK",
      family: "plane",
      type: "fighter",
      techs: ["fighter_1"],
      year: 1935,
      // Avia B-534: biplane fighter, about 400 km/h, four 7.92 mm vz. 30
      // guns, six 20 kg bombs; more than 500 built.
      source: SRC_AIR,
      spec: {
        maxKmh: 405,
        rangeKm: 580,
        emptyKg: 1460,
        wingLoad: 87,
        guns: [{ mm: 7.92, count: 4, rpm: 800 }],
        defGuns: 0,
        bombKg: 120,
        torpedoKg: 0,
        reliability: 4,
        costK: 14,
      },
    },
    {
      id: "csk_letov_s328",
      country: "CSK",
      family: "plane",
      type: "cas",
      techs: ["cas_1"],
      year: 1935,
      // Letov Š-328: reconnaissance and light bomber biplane, 280 km/h,
      // two fixed and two flexible 7.92 mm guns; bomb load 300-500 kg by
      // source, 300 used.
      source: SRC_AIR,
      spec: {
        maxKmh: 280,
        rangeKm: 700,
        emptyKg: 1680,
        wingLoad: 66,
        guns: [{ mm: 7.92, count: 2, rpm: 800 }],
        defGuns: 2,
        bombKg: 300,
        torpedoKg: 0,
        reliability: 4,
        costK: 16,
      },
    },
    {
      id: "csk_aero_mb200",
      country: "CSK",
      family: "plane",
      type: "bomber",
      techs: ["bomber_1"],
      year: 1935,
      // Aero and Avia licence-built Bloch MB.200: 285 km/h, three gun
      // positions, 1,200 kg of bombs; about 120 built in Czechoslovakia.
      source: SRC_AIR,
      spec: {
        maxKmh: 285,
        rangeKm: 1000,
        emptyKg: 4300,
        wingLoad: 118,
        guns: [],
        defGuns: 3,
        bombKg: 1200,
        torpedoKg: 0,
        reliability: 3,
        costK: 45,
      },
    },
    {
      id: "csk_avia_b71",
      country: "CSK",
      family: "plane",
      type: "bomber",
      techs: ["bomber_1", "aero_engine_2"],
      year: 1938,
      // Avia B-71: the Tupolev SB-2 built under licence with Czech guns;
      // figures as sun_sb2 (423-430 km/h, 600 kg of bombs).
      source: SRC_AIR,
      spec: {
        maxKmh: 430,
        rangeKm: 1200,
        emptyKg: 4100,
        wingLoad: 111,
        guns: [{ mm: 7.92, count: 2, rpm: 1000 }],
        defGuns: 2,
        bombKg: 600,
        torpedoKg: 0,
        reliability: 3,
        costK: 42,
      },
    },
  ],
  startArms: [],
};
