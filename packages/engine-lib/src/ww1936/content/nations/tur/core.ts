// ww229 (design ww227 §5-§6): TUR's generals, balance of power, own
// equipment and start arms, read before the content. Çakmak, Orbay and
// Altay are already in GENERALS; these are the next rank of the army.
//
// Equipment: real specifications, from memory of the Wikipedia articles on
// each rifle, aircraft and ship (nothing checked against a printed
// reference; where recalled figures differ a middle value is used). Costs
// are 1940 US dollars scaled from comparable items of the majors'
// catalogues. The game's numbers come from the conversions and are clamped
// between the generic key and the majors' median (hist/MinorClamp.ts).
import type { NationCore } from "../types";

const SRC_SHIP =
  "Wikipedia ship articles and Conway's All the World's Fighting Ships 1922-1946, from memory; cost scaled from the Italian destroyers and cruisers of the catalogue";

export const CORE_TUR: NationCore = {
  tag: "TUR",
  // No dates: none of these men was arrested; offices are in the sources.
  generals: [
    {
      id: "tur_omurtak",
      tag: "TUR",
      att: 3,
      def: 3,
      plan: 3,
      log: 2,
      traits: ["infantry_officer"],
      source:
        "en.wikipedia Salih Omurtak: corps and army commands in the 1930s, Chief of the General Staff 1946-1947",
    },
    {
      id: "tur_gurman",
      tag: "TUR",
      att: 2,
      def: 3,
      plan: 3,
      log: 3,
      traits: ["organizer"],
      source:
        "en.wikipedia Abdurrahman Nafiz Gürman: army inspector in the war years, Chief of the General Staff 1947-1949",
    },
    {
      id: "tur_calislar",
      tag: "TUR",
      att: 2,
      def: 4,
      plan: 3,
      log: 2,
      traits: ["defensive_doctrine"],
      source:
        "en.wikipedia İzzettin Çalışlar: general of the War of Independence, army inspector in the 1930s and 1940s",
    },
    {
      id: "tur_muglali",
      tag: "TUR",
      att: 3,
      def: 2,
      plan: 2,
      log: 2,
      traits: ["mountaineer"],
      source:
        "en.wikipedia Mustafa Muğlalı: commander of the Third Army in the east until his conviction over the 1943 Özalp killings",
    },
    {
      id: "tur_toydemir",
      tag: "TUR",
      att: 2,
      def: 3,
      plan: 3,
      log: 3,
      traits: ["cavalry_officer"],
      source:
        "tr.wikipedia Cemil Cahit Toydemir: led the Turkish troops into the Sanjak of Alexandretta in 1938, later a corps and army commander",
    },
  ],
  bop: [],
  equipment: [
    // ------------------------------------------------------------ infantry
    {
      id: "tur_m1938_mauser",
      country: "TUR",
      family: "infantry",
      techs: ["inf_eq_1"],
      year: 1938,
      // Turkish Mauser M1938: older Mausers rebuilt to a short-rifle
      // pattern at Ankara and Kırıkkale, 7.92x57 mm, five-round magazine,
      // about 12 aimed rounds a minute.
      source:
        "Wikipedia Turkish Mauser (M1938) and Kırıkkale arsenal, from memory; cost a guess near the Kar98k",
      staticFor: "infantry_equipment:1",
      spec: { mm: 7.92, aimedRpm: 12, rangeM: 550, autoPct: 0, costUsd: 22 },
    },
    // ------------------------------------------------------------ planes
    {
      id: "tur_kayseri_p24",
      country: "TUR",
      family: "plane",
      type: "fighter",
      techs: ["fighter_1"],
      year: 1937,
      // PZL P.24 bought from Poland and built under licence at the Kayseri
      // aircraft factory: Gnome-Rhône 14K, about 430 km/h, gull wing, two
      // 20 mm Oerlikon cannon and two machine guns on the A and C models.
      source:
        "Wikipedia PZL P.24 (Turkish service and Kayseri licence production), from memory; cost scaled from the Gladiator",
      staticFor: "fighter:1",
      spec: {
        maxKmh: 430,
        rangeKm: 700,
        emptyKg: 1330,
        wingLoad: 107,
        guns: [
          { mm: 20, count: 2, rpm: 350 },
          { mm: 7.92, count: 2, rpm: 1100 },
        ],
        defGuns: 0,
        bombKg: 40,
        torpedoKg: 0,
        reliability: 3,
        costK: 22,
      },
    },
    // ------------------------------------------------------------ ships
    {
      id: "tur_yavuz",
      country: "TUR",
      family: "ship",
      cls: "bc",
      techs: [],
      year: 1912,
      // Yavuz Sultan Selim, the former SMS Goeben (Moltke class), refitted
      // at Gölcük 1927-1930: about 23,000 t, ten 283 mm and ten 150 mm guns,
      // 270 mm belt, about 25 kn after the refit; four 88 mm AA guns.
      source: SRC_SHIP,
      spec: {
        dispT: 23000,
        main: { count: 10, mm: 283 },
        secondary: { count: 10, mm: 150 },
        beltMm: 270,
        speedKn: 25.5,
        rangeNm: 4100,
        torpTubes: 0,
        torpWarheadKg: 0,
        asw: 0,
        aaLight: [],
        aaHeavy: 4,
        aircraft: 0,
        costM: 17,
      },
    },
    {
      id: "tur_hamidiye",
      country: "TUR",
      family: "ship",
      cls: "cl",
      techs: [],
      year: 1904,
      // Hamidiye, protected cruiser built by Armstrong: about 3,800 t, two
      // 150 mm and eight 76 mm guns, armoured deck but no belt, about 22 kn
      // new and less by 1936; a training ship.
      source: SRC_SHIP,
      spec: {
        dispT: 3800,
        main: { count: 2, mm: 150 },
        secondary: { count: 8, mm: 76 },
        beltMm: 0,
        speedKn: 21,
        rangeNm: 4000,
        torpTubes: 0,
        torpWarheadKg: 0,
        asw: 0,
        aaLight: [],
        aaHeavy: 0,
        aircraft: 0,
        costM: 2,
      },
    },
    {
      id: "tur_kocatepe_class",
      country: "TUR",
      family: "ship",
      cls: "dd",
      techs: [],
      year: 1931,
      // Kocatepe and Adatepe, built by Ansaldo: about 1,250 t, four 120 mm
      // guns, six 533 mm tubes, about 38 kn on trials.
      source: SRC_SHIP,
      spec: {
        dispT: 1250,
        main: { count: 4, mm: 120 },
        beltMm: 0,
        speedKn: 36,
        rangeNm: 3200,
        torpTubes: 6,
        torpWarheadKg: 250,
        asw: 1,
        aaLight: [{ count: 2, mm: 40 }],
        aaHeavy: 0,
        aircraft: 0,
        costM: 1.5,
      },
    },
    {
      id: "tur_demirhisar_class",
      country: "TUR",
      family: "ship",
      cls: "dd",
      techs: ["dd_2"],
      year: 1942,
      // Demirhisar and Sultanhisar, of the British I class ordered in 1939
      // (two delivered, two kept by the Royal Navy): about 1,360 t, four
      // 120 mm guns, eight 533 mm tubes, 35.5 kn.
      source: SRC_SHIP,
      spec: {
        dispT: 1360,
        main: { count: 4, mm: 120 },
        beltMm: 0,
        speedKn: 35.5,
        rangeNm: 5500,
        torpTubes: 8,
        torpWarheadKg: 330,
        asw: 2,
        aaLight: [{ count: 4, mm: 20 }],
        aaHeavy: 0,
        aircraft: 0,
        costM: 2,
      },
    },
  ],
  startArms: [
    {
      entry: "sun_t26_33",
      origin: "received",
      count: 60,
      source:
        "en.wikipedia T-26 (operators): Turkey received about 60 T-26 mod. 1933 with BA armoured cars from the Soviet Union in the mid-1930s, from memory",
    },
  ],
};
