// ww229 (design ww227 §5-§6): CHN's generals, own equipment and start arms,
// read before the content. Data only.
//
// Generals: commanders of the war of resistance not yet in GENERALS (Chen
// Cheng, Xue Yue, He Yingqin and Zhang Zhizhong are there already).
//
// Balance of power: China's centre-provinces balance is the majors' table's
// (MechRules BOP_DEFS_BASE, spirits bop_chn_*), so no row here.
//
// Equipment: the army's own and bought issue: arsenal rifles, German guns,
// American-designed aircraft assembled in China, the Vickers tanks and the
// two cruiser classes. Where a figure comes from memory the source says so;
// costs are estimates in 1940 US dollars against comparable entries.
// Start arms: German and Italian deliveries before the war with their stock;
// the Soviet designs with no stock, which comes with the credits and the
// volunteers (chn_ev_soviet_credit, chn_ev_ask_soviet_pilots, the P5 beat).
import type { NationCore } from "../types";

export const CORE_CHN: NationCore = {
  tag: "CHN",
  generals: [
    {
      id: "wei_lihuang",
      tag: "CHN",
      att: 3,
      def: 4,
      plan: 3,
      log: 2,
      traits: ["defensive_doctrine"],
      source:
        "en.wikipedia Wei Lihuang: general officer before 1936; commanded at Xinkou, the 1st War Area and the Y-Force in Yunnan",
    },
    {
      id: "tang_enbo",
      tag: "CHN",
      att: 3,
      def: 3,
      plan: 2,
      log: 2,
      traits: ["infantry_officer"],
      source:
        "en.wikipedia Tang Enbo: division commander before 1936; held Nankou and fought at Tai'erzhuang",
    },
    {
      id: "hu_zongnan",
      tag: "CHN",
      att: 2,
      def: 3,
      plan: 2,
      log: 3,
      traits: ["organizer"],
      source:
        "en.wikipedia Hu Zongnan: Whampoa first class, commander of the 1st Division before 1936; fought at Shanghai, then held the northwest",
    },
    {
      id: "zhang_fakui",
      tag: "CHN",
      att: 4,
      def: 3,
      plan: 3,
      log: 2,
      traits: ["offensive_doctrine"],
      source:
        "en.wikipedia Zhang Fakui: commander of the Ironsides in the Northern Expedition; fought at Shanghai and Wuhan, commanded the 4th War Area",
    },
    {
      id: "gu_zhutong",
      tag: "CHN",
      att: 2,
      def: 3,
      plan: 3,
      log: 3,
      traits: [],
      source:
        "en.wikipedia Gu Zhutong: general officer before 1936; deputy commander at Shanghai, commander of the 3rd War Area",
    },
    {
      id: "sun_liren",
      tag: "CHN",
      att: 4,
      def: 4,
      plan: 3,
      log: 2,
      traits: ["infantry_expert"],
      from: "1939-01-01",
      source:
        "en.wikipedia Sun Liren: Virginia Military Institute graduate, commanded the Salt Tax Police regiment at Shanghai, then the New 38th Division in Burma; general's rank date from memory",
    },
  ],
  bop: [],
  equipment: [
    {
      id: "chn_hanyang88",
      country: "CHN",
      family: "infantry",
      techs: [],
      year: 1896,
      source:
        "en.wikipedia Hanyang 88 (a copy of the Gewehr 88, 7.92 x 57 mm, made at the Hanyang Arsenal from 1896, the most numerous Chinese rifle of the war); rate and cost figures partly from memory",
      spec: { mm: 7.92, aimedRpm: 10, rangeM: 500, autoPct: 0, costUsd: 18 },
    },
    {
      id: "chn_zhongzheng",
      country: "CHN",
      family: "infantry",
      techs: ["inf_eq_1"],
      staticFor: "infantry_equipment:1",
      year: 1935,
      source:
        "en.wikipedia Chiang Kai-shek rifle (Type 24 'Zhongzheng', a copy of the Mauser Standardmodell, 7.92 x 57 mm, Gongxian Arsenal from 1935); rate and cost figures partly from memory",
      spec: { mm: 7.92, aimedRpm: 15, rangeM: 500, autoPct: 0, costUsd: 24 },
    },
    {
      id: "chn_type26_lmg",
      country: "CHN",
      family: "infantry",
      techs: ["inf_eq_1"],
      year: 1937,
      source:
        "en.wikipedia ZB vz. 26 (China bought tens of thousands and its arsenals copied it as the Type 26; 7.92 mm, 20-round magazine, about 500 rounds a minute cyclic); squad share and cost figures partly from memory",
      spec: { mm: 7.92, aimedRpm: 35, rangeM: 600, autoPct: 10, costUsd: 95 },
    },
    {
      id: "chn_pak36",
      country: "CHN",
      family: "gun",
      role: "anti_tank",
      techs: ["anti_tank_1"],
      staticFor: "anti_tank:1",
      year: 1936,
      source:
        "en.wikipedia 3.7 cm Pak 36 (432 kg, 0.68 kg AP shell, about 29 mm at 500 m at 30 degrees); bought from Germany for the trained divisions in the mid-1930s; rate and cost figures partly from memory",
      spec: {
        mm: 37,
        rpm: 13,
        rangeM: 1500,
        shellKg: 0.68,
        penMm500: 29,
        massKg: 432,
        barrels: 1,
        costK: 3,
      },
    },
    {
      id: "chn_bofors_75_mtn",
      country: "CHN",
      family: "gun",
      role: "artillery",
      techs: ["artillery_1"],
      staticFor: "artillery:1",
      year: 1934,
      source:
        "en.wikipedia Bofors 75 mm Model 1934 mountain gun (about 930 kg, 6.6 kg shell, 9,300 m), bought by China in the 1930s; rate and cost figures partly from memory",
      spec: {
        mm: 75,
        rpm: 8,
        rangeM: 9300,
        shellKg: 6.6,
        penMm500: 0,
        massKg: 930,
        barrels: 1,
        costK: 9,
      },
    },
    {
      id: "chn_sfh18",
      country: "CHN",
      family: "gun",
      role: "artillery",
      techs: ["artillery_2"],
      year: 1934,
      source:
        "en.wikipedia 15 cm sFH 18 (5,512 kg, 43.5 kg shell, 13,325 m); China bought a few dozen from Germany in the mid-1930s; rate and cost figures partly from memory",
      spec: {
        mm: 150,
        rpm: 4,
        rangeM: 13300,
        shellKg: 43.5,
        penMm500: 0,
        massKg: 5512,
        barrels: 1,
        costK: 35,
      },
    },
    {
      id: "chn_flak30",
      country: "CHN",
      family: "gun",
      role: "anti_air",
      techs: ["anti_air_1"],
      staticFor: "anti_air:1",
      year: 1935,
      source:
        "en.wikipedia 2 cm Flak 30 (450 kg, 120 rounds a minute in practice, about 2,200 m effective ceiling); bought from Germany for the capital's air defence; cost figures partly from memory",
      spec: {
        mm: 20,
        rpm: 120,
        rangeM: 2200,
        shellKg: 0.12,
        penMm500: 0,
        massKg: 450,
        barrels: 1,
        costK: 2.5,
      },
    },
    {
      id: "chn_vickers_mk_e",
      country: "CHN",
      family: "tank",
      role: "light",
      techs: ["light_tank_1"],
      staticFor: "light_tank:1",
      year: 1935,
      source:
        "en.wikipedia Vickers 6-ton (7.3 t, 13 mm armour, 47 mm QF 3-pounder on the single-turret type, 35 km/h road); China bought some twenty in the mid-1930s; cross-country speed, penetration and cost figures partly from memory",
      spec: {
        massT: 7.3,
        hullFrontMm: 13,
        hullSlopeDeg: 0,
        turretFrontMm: 13,
        gunMm: 47,
        penMm500: 20,
        heFillerG: 90,
        mgs: 1,
        offroadKmh: 18,
        roadKmh: 35,
        reliability: 3,
        costK: 22,
      },
    },
    {
      id: "chn_hawk3",
      country: "CHN",
      family: "plane",
      type: "fighter",
      techs: ["fighter_1"],
      staticFor: "fighter:1",
      year: 1936,
      source:
        "en.wikipedia Curtiss F11C Goshawk (Hawk III export: about 1,400 / 2,150 kg on 24 m2, about 385 km/h, one 7.62 mm and one 12.7 mm gun, bombs under the wings); China's main fighter of 1937, many assembled at Hangzhou; range and cost figures partly from memory",
      spec: {
        guns: [
          { mm: 7.62, count: 1, rpm: 1000 },
          { mm: 12.7, count: 1, rpm: 750 },
        ],
        maxKmh: 385,
        rangeKm: 900,
        emptyKg: 1400,
        wingLoad: 89,
        defGuns: 0,
        bombKg: 225,
        torpedoKg: 0,
        reliability: 3,
        costK: 24,
      },
    },
    {
      id: "chn_hawk75m",
      country: "CHN",
      family: "plane",
      type: "fighter",
      techs: ["fighter_1"],
      year: 1938,
      source:
        "en.wikipedia Curtiss P-36 Hawk, export Hawk 75M with fixed undercarriage (about 1,800 kg empty, about 450 km/h, four 7.62 mm guns); some thirty for China, assembled at Loiwing; range and cost figures partly from memory",
      spec: {
        guns: [{ mm: 7.62, count: 4, rpm: 1000 }],
        maxKmh: 450,
        rangeKm: 880,
        emptyKg: 1800,
        wingLoad: 118,
        defGuns: 0,
        bombKg: 135,
        torpedoKg: 0,
        reliability: 3,
        costK: 32,
      },
    },
    {
      id: "chn_gamma_2e",
      country: "CHN",
      family: "plane",
      type: "cas",
      techs: ["cas_1"],
      staticFor: "cas:1",
      year: 1934,
      source:
        "en.wikipedia Northrop Gamma (2E: light bomber for China, about 350 km/h, up to 725 kg of bombs, four fixed 7.62 mm guns and one flexible); a few dozen bought and assembled in the mid-1930s; masses and cost figures partly from memory",
      spec: {
        guns: [{ mm: 7.62, count: 4, rpm: 1000 }],
        maxKmh: 352,
        rangeKm: 1900,
        emptyKg: 2200,
        wingLoad: 125,
        defGuns: 1,
        bombKg: 725,
        torpedoKg: 0,
        reliability: 3,
        costK: 45,
      },
    },
    {
      id: "chn_ning_hai",
      country: "CHN",
      family: "ship",
      cls: "cl",
      techs: [],
      year: 1932,
      source:
        "en.wikipedia Chinese cruiser Ning Hai (about 2,500 t, six 140 mm guns in three twin mounts, six 76 mm AA guns, four torpedo tubes, about 22 kn; Ning Hai built in Japan, Ping Hai at the Jiangnan yard); range and cost figures partly from memory",
      spec: {
        dispT: 2526,
        main: { count: 6, mm: 140 },
        secondary: { count: 6, mm: 76 },
        beltMm: 0,
        speedKn: 22,
        rangeNm: 4000,
        torpTubes: 4,
        torpWarheadKg: 200,
        asw: 0,
        aaLight: [],
        aaHeavy: 0,
        aircraft: 0,
        costM: 3,
      },
    },
    {
      id: "chn_chao_ho",
      country: "CHN",
      family: "ship",
      cls: "cl",
      techs: [],
      year: 1912,
      source:
        "en.wikipedia Chao Ho-class cruiser (about 2,750 t, two 152 mm and four 102 mm guns, built in Britain and the United States for the Qing navy, about 20 kn by the 1930s); range and cost figures partly from memory",
      spec: {
        dispT: 2750,
        main: { count: 2, mm: 152 },
        secondary: { count: 4, mm: 102 },
        beltMm: 0,
        speedKn: 20,
        rangeNm: 4000,
        torpTubes: 2,
        torpWarheadKg: 100,
        asw: 0,
        aaLight: [],
        aaHeavy: 0,
        aircraft: 0,
        costM: 1.5,
      },
    },
  ],
  startArms: [
    {
      entry: "deu_pz1_b",
      origin: "received",
      count: 15,
      source:
        "en.wikipedia Panzer I, operational history in China: fifteen Ausf. A bought from Germany in the mid-1930s and lost around Nanjing; the catalogue's Ausf. B stands in",
    },
    {
      entry: "deu_sdkfz222",
      origin: "received",
      count: 12,
      source:
        "en.wikipedia Sd.Kfz. 221/222: a few armoured cars of the Sd.Kfz. 221 and 222 series went to China with the German aid; the number from memory",
    },
    {
      entry: "ita_cv33",
      origin: "received",
      count: 20,
      source:
        "en.wikipedia L3/33: tankettes sold to China in the mid-1930s and used at Shanghai; the number from memory",
    },
    {
      entry: "ita_cr32",
      origin: "received",
      count: 16,
      source:
        "en.wikipedia Fiat CR.32, operators: a batch bought by China in the 1930s; the number from memory",
    },
    {
      entry: "sun_t26_33",
      origin: "received",
      count: 0,
      source:
        "en.wikipedia T-26 in China: about 80 delivered under the Soviet credit of the late 1930s for the 200th Division; the stock comes with the credit (chn_ev_soviet_credit)",
    },
    {
      entry: "sun_i16",
      origin: "received",
      count: 0,
      source:
        "en.wikipedia Soviet Volunteer Group: Polikarpov I-16s sent to China from the late 1930s with Soviet and then Chinese crews; the stock comes with the aid events",
    },
    {
      entry: "sun_sb2",
      origin: "received",
      count: 0,
      source:
        "en.wikipedia Tupolev SB, operational history in China: bombers delivered with the Soviet credits and flown by volunteer and Chinese crews; the stock comes with the aid events",
    },
  ],
};
