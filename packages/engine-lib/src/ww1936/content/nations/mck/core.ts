// ww229 (design ww227 §5-§6): MCK's generals, own equipment and start arms,
// read before the content. Manchukuo has no balance of power: its mechanism,
// the Kwantung Army's grip, is the subject's autonomy worked by staged
// spirits, decisions and events in content.ts.
//
// Equipment: what Manchukuo made itself, at the old Fengtian (Mukden)
// arsenal of the Zhang family, the Manchurian Aircraft Manufacturing Company
// (Manshū) and the Dōwa motor works at Mukden. Manchukuo built no tanks or
// warships. Figures are from the Wikipedia articles on each item and on the
// Manchukuo Imperial Army, partly from memory; where they disagree a middle
// value is used. Costs are 1940 US dollars of industrial effort scaled from
// the comparable Japanese entry. hist/MinorClamp.ts holds the fight numbers
// in the minor band.
import type { NationCore } from "../types";

const SRC_INF =
  "en.wikipedia Manchukuo Imperial Army (equipment: Type 38 the standard from the mid-1930s, the Fengtian arsenal expanded) and the rifle's article, from memory; cost scaled from the Japanese Type 38";

export const CORE_MCK: NationCore = {
  tag: "MCK",
  generals: [
    {
      id: "mck_zhang_haipeng",
      tag: "MCK",
      att: 3,
      def: 2,
      plan: 2,
      log: 2,
      traits: ["cavalry_officer"],
      source:
        "en.wikipedia Manchukuo Imperial Army: led about 42,000 Manchukuo troops in the 1933 Rehe campaign, then the 5th District Army at Chengde (9,294 men, 1934)",
    },
    {
      id: "mck_yu_zhishan",
      tag: "MCK",
      att: 2,
      def: 3,
      plan: 2,
      log: 2,
      traits: ["infantry_officer"],
      source:
        "en.wikipedia Manchukuo Imperial Army: the 1st District Army at Fengtian (12,321 men, 1934); later minister of military affairs (from memory)",
    },
    {
      id: "mck_ganjuurjab",
      tag: "MCK",
      att: 3,
      def: 2,
      plan: 2,
      log: 1,
      traits: ["cavalry_officer"],
      source:
        "en.wikipedia Ganjuurjab: Mongol cavalry officer, son of Babojab, led Mongol troops in Inner Mongolia in the 1930s, later a Manchukuo general (from memory)",
    },
    {
      id: "mck_xing_shilian",
      tag: "MCK",
      att: 2,
      def: 2,
      plan: 3,
      log: 3,
      traits: ["organizer"],
      source:
        "zh.wikipedia Xing Shilian: former Fengtian officer, minister of military affairs of Manchukuo in the war years (from memory, dates not checked)",
    },
    {
      id: "mck_zhang_wendao",
      tag: "MCK",
      att: 2,
      def: 3,
      plan: 2,
      log: 2,
      traits: ["defensive_doctrine"],
      source:
        "en.wikipedia Manchukuo Imperial Army: led the 3rd District Army at Qiqihar (13,938 men, 1934)",
    },
  ],
  bop: [],
  equipment: [
    // ------------------------------------------------------------ infantry
    {
      id: "mck_liao_type13",
      country: "MCK",
      family: "infantry",
      techs: ["inf_eq_1"],
      year: 1924,
      // Liao Type 13: the Fengtian arsenal's 7.92 mm Mauser-pattern rifle of
      // the Zhang years, still in the hands of the former warlord troops.
      source:
        "en.wikipedia Type 13 rifle (Liao) and Manchukuo Imperial Army (26 rifle types in 1932), from memory; cost scaled from the Japanese Type 38",
      spec: { mm: 7.92, aimedRpm: 12, rangeM: 500, autoPct: 0, costUsd: 20 },
    },
    {
      id: "mck_mukden_type38",
      country: "MCK",
      family: "infantry",
      techs: ["inf_eq_1"],
      year: 1935,
      // The Type 38 made at the Mukden arsenal for the Manchukuo army,
      // 6.5 mm, with the Type 11 light machine gun in the squad.
      source: SRC_INF,
      staticFor: "infantry_equipment:1",
      spec: { mm: 6.5, aimedRpm: 12, rangeM: 400, autoPct: 0, costUsd: 23 },
    },
    // ------------------------------------------------------------ guns
    {
      id: "mck_mukden_77",
      country: "MCK",
      family: "gun",
      role: "artillery",
      techs: ["artillery_1"],
      year: 1925,
      // Liao Type 14 77 mm field gun of the Fengtian arsenal: a light field
      // gun on the German pattern; shell about 6.5 kg, range about 8 km.
      source:
        "zh.wikipedia on the Fengtian arsenal's Type 14 77 mm gun, from memory; figures are middle values and uncertain; cost scaled from the Japanese Type 38 75 mm",
      spec: {
        mm: 77,
        rpm: 8,
        rangeM: 8000,
        shellKg: 6.5,
        penMm500: 0,
        massKg: 1000,
        barrels: 1,
        costK: 4,
      },
    },
    // ------------------------------------------------------------ support
    {
      id: "mck_dowa_truck",
      country: "MCK",
      family: "support",
      techs: ["motorized_1"],
      year: 1934,
      // Dōwa Automobile at Mukden assembled Japanese and American trucks for
      // the army and the railway company.
      source:
        "ja.wikipedia Dōwa Automobile (Mukden, from 1934), from memory; range and cost estimated against the Isuzu Type 94",
      spec: { kind: "transport", rangeKm: 350, costUsd: 2000, reliability: 2 },
    },
    // ------------------------------------------------------------ planes
    {
      id: "mck_manshu_ki27",
      country: "MCK",
      family: "plane",
      type: "fighter",
      techs: ["fighter_1"],
      year: 1939,
      // Ki-27b built by Manshū alongside Nakajima and Tachikawa: 470 km/h,
      // 630 km, 1,110 kg empty, 18.56 m2, two 7.7 mm guns.
      source:
        "en.wikipedia Nakajima Ki-27 (web-checked: Manshūkoku Hikōki Seizō among the builders, the Ki-27b figures); the Manchukuo air force flew it",
      staticFor: "fighter:1",
      spec: {
        maxKmh: 470,
        rangeKm: 630,
        emptyKg: 1110,
        wingLoad: 96,
        guns: [{ mm: 7.7, count: 2, rpm: 900 }],
        defGuns: 0,
        bombKg: 100,
        torpedoKg: 0,
        reliability: 4,
        costK: 15,
      },
    },
    {
      id: "mck_manshu_mt1",
      country: "MCK",
      family: "plane",
      type: "transport_plane",
      techs: ["transport_plane_1"],
      year: 1937,
      // Manshū MT-1 Hayabusa: a six-passenger high-wing airliner of
      // Manchukuo National Airways, one Nakajima radial, about 30 built.
      source:
        "en.wikipedia Manshū MT-1 Hayabusa, from memory; speed, range and weight are middle values and uncertain; cost scaled from the Japanese L2D by weight",
      spec: {
        maxKmh: 280,
        rangeKm: 800,
        emptyKg: 1400,
        wingLoad: 70,
        guns: [],
        defGuns: 0,
        bombKg: 0,
        torpedoKg: 0,
        reliability: 3,
        costK: 25,
      },
    },
  ],
  startArms: [
    {
      entry: "fra_ft17",
      origin: "received",
      count: 8,
      source:
        "en.wikipedia Manchukuo Imperial Army: 8 Renault NC-27 light tanks (a development of the FT, the nearest catalogue entry) and possibly a few Renault FT",
    },
    {
      entry: "jpn_type94_teke",
      origin: "received",
      count: 10,
      source:
        "en.wikipedia Manchukuo Imperial Army: Japan lent a company of 10 Type 94 tankettes (in the 1940s; given at the start here)",
    },
  ],
};
