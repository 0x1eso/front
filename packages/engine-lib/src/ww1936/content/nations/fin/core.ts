// ww229 (design ww227 §5-§6): FIN's generals, own equipment and start arms,
// read before the content. Finland has no balance of power (its mechanism,
// the Isthmus line and the Civil Guard, is decisions and spirits in
// index.ts). Mannerheim, Österman, Heinrichs and Siilasvuo are already in
// Generals.ts; these are the others who led in 1939-44.
//
// Equipment: what Finland made itself (the state arsenals VKT and VL, Tampella,
// the Crichton-Vulcan yard at Turku). Figures are from the Wikipedia articles
// on each weapon, from memory; where they disagree a middle value is used.
// Costs are 1940 US dollars of industrial effort scaled from a comparable
// American or British item, as in the majors' files. The numbers are real
// specifications; hist/MinorClamp.ts holds the fight numbers in the minor
// band.
import type { NationCore } from "../types";

const SRC_INF =
  "Wikipedia (en, fi) on the weapon, from memory; cost scaled from the US M1903 and the Thompson";
const SRC_SHIP =
  "Wikipedia ship class articles (en, fi), from memory; cost scaled from US ships by displacement";

export const CORE_FIN: NationCore = {
  tag: "FIN",
  generals: [
    {
      id: "ohquist",
      tag: "FIN",
      att: 3,
      def: 3,
      plan: 3,
      log: 2,
      traits: ["infantry_officer"],
      source:
        "en.wikipedia Harald Öhquist + fi.wikipedia: a general officer since the 1920s; II Army Corps on the Karelian Isthmus 1939-40",
    },
    {
      id: "hagglund",
      tag: "FIN",
      att: 2,
      def: 4,
      plan: 2,
      log: 2,
      traits: ["defensive_doctrine"],
      source:
        "en.wikipedia Woldemar Hägglund + fi.wikipedia: IV Army Corps north of Lake Ladoga 1939-40, Kollaa held",
    },
    {
      id: "talvela",
      tag: "FIN",
      att: 4,
      def: 3,
      plan: 3,
      log: 2,
      traits: ["ambusher"],
      source:
        "en.wikipedia Paavo Talvela + fi.wikipedia: Group Talvela and the Tolvajärvi victory 1939; general-officer rank from 1940 (exact day not checked)",
    },
    {
      id: "wallenius",
      tag: "FIN",
      att: 3,
      def: 2,
      plan: 2,
      log: 2,
      traits: ["guerrilla_fighter"],
      source:
        "en.wikipedia Kurt Martti Wallenius + fi.wikipedia: chief of the general staff 1930-32, Mäntsälä rebellion 1932, Lapland Group 1939-40",
    },
    {
      id: "airo",
      tag: "FIN",
      att: 2,
      def: 3,
      plan: 4,
      log: 5,
      traits: ["logistics_wizard"],
      source:
        "en.wikipedia Aksel Airo + fi.wikipedia: quartermaster-general of headquarters 1939-44 (general-officer rank date not checked)",
    },
    {
      id: "oesch",
      tag: "FIN",
      att: 3,
      def: 4,
      plan: 3,
      log: 3,
      traits: ["organizer"],
      source:
        "en.wikipedia Karl Lennart Oesch + fi.wikipedia: chief of the general staff in the 1930s, Coastal Group 1940, Isthmus forces 1944",
    },
  ],
  bop: [],
  equipment: [
    // ------------------------------------------------------------ infantry
    {
      id: "fin_m28_30",
      country: "FIN",
      family: "infantry",
      techs: ["inf_eq_1"],
      year: 1930,
      // M/28-30 "Pystykorva": the Civil Guard's rebuilt Mosin-Nagant,
      // 7.62x53R, heavier barrel and better sights; about 10-12 aimed
      // rounds a minute.
      source: SRC_INF,
      staticFor: "infantry_equipment:1",
      spec: { mm: 7.62, aimedRpm: 12, rangeM: 550, autoPct: 0, costUsd: 20 },
    },
    {
      id: "fin_suomi_kp31",
      country: "FIN",
      family: "infantry",
      techs: ["inf_eq_1"],
      year: 1931,
      // Suomi KP/-31: Aimo Lahti's 9 mm submachine gun, drum magazine of
      // 70 rounds, about 900 rounds a minute cyclic; heavy and well made.
      source: SRC_INF,
      spec: { mm: 9, aimedRpm: 25, rangeM: 200, autoPct: 12, costUsd: 65 },
    },
    {
      id: "fin_ls26",
      country: "FIN",
      family: "infantry",
      techs: ["inf_eq_1"],
      year: 1926,
      // Lahti-Saloranta M/26: the 7.62 mm squad light machine gun, about 500
      // rounds a minute cyclic, 20-round box; complicated but accurate.
      source: SRC_INF,
      spec: { mm: 7.62, aimedRpm: 35, rangeM: 600, autoPct: 10, costUsd: 110 },
    },
    {
      id: "fin_m39",
      country: "FIN",
      family: "infantry",
      techs: ["inf_eq_2"],
      year: 1939,
      // M/39 "Ukko-Pekka": the army's and the Civil Guard's common rifle,
      // 7.62x53R; with the Suomi and the M/26 in every squad.
      source: SRC_INF,
      staticFor: "infantry_equipment:2",
      spec: { mm: 7.62, aimedRpm: 13, rangeM: 600, autoPct: 8, costUsd: 22 },
    },
    // ------------------------------------------------------------ guns
    {
      id: "fin_37pstk36",
      country: "FIN",
      family: "gun",
      role: "anti_tank",
      techs: ["anti_tank_1"],
      year: 1938,
      // 37 PstK/36: the Bofors 37 mm anti-tank gun built under licence by
      // Tampella; about 40 mm at 500 m upright, some 30 mm at 30 degrees.
      source:
        "Wikipedia Bofors 37 mm and fi.wikipedia 37 PstK/36, from memory; cost scaled from the US 37 mm M3",
      staticFor: "anti_tank:1",
      spec: {
        mm: 37,
        rpm: 12,
        rangeM: 4000,
        shellKg: 0.7,
        penMm500: 30,
        massKg: 380,
        barrels: 1,
        costK: 4,
      },
    },
    {
      id: "fin_lahti_l39",
      country: "FIN",
      family: "gun",
      role: "anti_tank",
      techs: ["anti_tank_1"],
      year: 1939,
      // Lahti L-39: 20 mm anti-tank rifle, 49.5 kg, semi-automatic, 10-round
      // box; useless against T-34 armour, still a sniper's weapon later.
      source:
        "Wikipedia Lahti L-39, from memory; penetration a middle value of the quoted 20-30 mm at 100 m; cost a guess near a heavy machine gun",
      spec: {
        mm: 20,
        rpm: 15,
        rangeM: 1400,
        shellKg: 0.15,
        penMm500: 14,
        massKg: 50,
        barrels: 1,
        costK: 1,
      },
    },
    // ------------------------------------------------------------ planes
    {
      id: "fin_fokker_dxxi",
      country: "FIN",
      family: "plane",
      type: "fighter",
      techs: ["fighter_1"],
      year: 1937,
      // Fokker D.XXI built under licence by the State Aircraft Factory
      // (Valtion lentokonetehdas), Bristol Mercury: about 460 km/h, four
      // 7.7 mm guns; fixed undercarriage, sturdy, skis in winter.
      source:
        "Wikipedia Fokker D.XXI (Finnish service), from memory; cost scaled from the Gladiator",
      staticFor: "fighter:1",
      spec: {
        maxKmh: 460,
        rangeKm: 930,
        emptyKg: 1450,
        wingLoad: 120,
        guns: [{ mm: 7.7, count: 4, rpm: 1000 }],
        defGuns: 0,
        bombKg: 0,
        torpedoKg: 0,
        reliability: 4,
        costK: 20,
      },
    },
    {
      id: "fin_vl_myrsky",
      country: "FIN",
      family: "plane",
      type: "fighter",
      techs: ["fighter_2"],
      year: 1943,
      // VL Myrsky II: the State Aircraft Factory's own fighter of wood and
      // steel tube, Twin Wasp, about 535 km/h, four 12.7 mm guns; its wooden
      // wing gave trouble in service.
      source:
        "Wikipedia VL Myrsky, from memory; cost scaled from the Brewster Buffalo",
      spec: {
        maxKmh: 535,
        rangeKm: 500,
        emptyKg: 2340,
        wingLoad: 178,
        guns: [{ mm: 12.7, count: 4, rpm: 750 }],
        defGuns: 0,
        bombKg: 200,
        torpedoKg: 0,
        reliability: 2,
        costK: 34,
      },
    },
    // ------------------------------------------------------------ ships
    {
      id: "fin_vainamoinen_class",
      country: "FIN",
      family: "ship",
      cls: "ca",
      techs: [],
      year: 1932,
      // Väinämöinen and Ilmarinen, coast-defence ships built at Turku:
      // 3,900 t, four 254 mm and eight 105 mm guns, 55 mm belt, 15.5 kn,
      // icebreaker bows for the skerries.
      source: SRC_SHIP,
      spec: {
        dispT: 3900,
        main: { count: 4, mm: 254 },
        secondary: { count: 8, mm: 105 },
        beltMm: 55,
        speedKn: 15.5,
        rangeNm: 1500,
        torpTubes: 0,
        torpWarheadKg: 0,
        asw: 0,
        aaLight: [{ count: 4, mm: 40 }],
        aaHeavy: 0,
        aircraft: 0,
        costM: 6,
      },
    },
    {
      id: "fin_vetehinen_class",
      country: "FIN",
      family: "ship",
      cls: "ss",
      techs: [],
      year: 1930,
      // Vetehinen, Vesihiisi and Iku-Turso: about 490 t surfaced, four
      // 533 mm tubes and a 76 mm deck gun, 12 kn surfaced; minelayers too.
      source: SRC_SHIP,
      spec: {
        dispT: 490,
        main: { count: 1, mm: 76 },
        beltMm: 0,
        speedKn: 12,
        rangeNm: 1500,
        torpTubes: 4,
        torpWarheadKg: 250,
        asw: 0,
        aaLight: [{ count: 1, mm: 20 }],
        aaHeavy: 0,
        aircraft: 0,
        costM: 1.5,
      },
    },
    {
      id: "fin_vesikko",
      country: "FIN",
      family: "ship",
      cls: "ss",
      techs: [],
      year: 1933,
      // Vesikko: the German-designed coastal boat built at Turku, about
      // 250 t surfaced, three 533 mm bow tubes, 13 kn; the model of the
      // German Type II.
      source: SRC_SHIP,
      spec: {
        dispT: 250,
        main: { count: 1, mm: 20 },
        beltMm: 0,
        speedKn: 13,
        rangeNm: 1500,
        torpTubes: 3,
        torpWarheadKg: 250,
        asw: 0,
        aaLight: [],
        aaHeavy: 0,
        aircraft: 0,
        costM: 0.8,
      },
    },
  ],
  startArms: [
    {
      entry: "fra_ft17",
      origin: "received",
      count: 32,
      source:
        "en.wikipedia Renault FT (Finnish service): 32 bought from France in 1919, the army's only tanks until the Vickers deliveries",
    },
    {
      entry: "gbr_blenheim_iv",
      origin: "licensed",
      count: 0,
      source:
        "en.wikipedia Bristol Blenheim (Finland): Mk I bought from 1936, the licence taken in 1938, Mk IV built by the State Aircraft Factory",
    },
  ],
};
