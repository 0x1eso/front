// World War 1936 P5 (spec §3.2, §19.7): the politics of the 14 dormant slots,
// read when a slot wakes. The ruling ideology holds 60%; the other three share
// the rest in the ratio of the P3 neutral default (15:10:20:55). Stability 50,
// war support 40, the generic tree.
//
// Collaborationist heads are titles (spec §19.5, §18.1-3): Slovakia, Croatia,
// Vichy, Nanjing, Mengjiang, Burma and the Philippine republic of 1943. The
// Social Republic reuses Italy's 1936 leader; the American-side Philippines
// has Manuel L. Quezon, then Sergio Osmena (phl_osmena_succeeds). The
// civil-war slots start non-aligned under a provisional leader; the civil war
// sets their ideology and leader when it wakes them.
import type { CountryPoliticsDef } from "../types";

const OTHERS = {
  democratic: "title:leader_democratic",
  communist: "title:leader_communist",
  fascist: "title:leader_fascist",
  neutral: "title:leader_neutral",
} as const;

export const DORMANT_POLITICS: CountryPoliticsDef[] = [
  {
    tag: "SVK",
    ruling: "neutral",
    popularity: [13, 9, 18, 60],
    stability: 50,
    warSupport: 40,
    tree: "new",
    leaders: { ...OTHERS, neutral: "title:svk_head" },
    govNames: ["neutral"],
  },
  {
    tag: "HRV",
    ruling: "fascist",
    popularity: [8, 5, 60, 27],
    stability: 50,
    warSupport: 40,
    tree: "new",
    leaders: { ...OTHERS, fascist: "title:hrv_head" },
    govNames: ["fascist"],
  },
  {
    // The government name ww1936.gov.VIC.neutral is lane K3's.
    tag: "VIC",
    ruling: "neutral",
    popularity: [13, 9, 18, 60],
    stability: 50,
    warSupport: 40,
    tree: "new",
    leaders: { ...OTHERS, neutral: "title:vic_head" },
    govNames: ["neutral"],
  },
  {
    tag: "RSI",
    ruling: "fascist",
    popularity: [8, 5, 60, 27],
    stability: 50,
    warSupport: 40,
    tree: "new",
    leaders: { ...OTHERS, fascist: "leader_ita" },
    govNames: ["fascist"],
  },
  {
    tag: "RNG",
    ruling: "neutral",
    popularity: [13, 9, 18, 60],
    stability: 50,
    warSupport: 40,
    tree: "new",
    leaders: { ...OTHERS, neutral: "title:rng_head" },
    govNames: ["neutral"],
  },
  {
    tag: "MEN",
    ruling: "neutral",
    popularity: [13, 9, 18, 60],
    stability: 50,
    warSupport: 40,
    tree: "new",
    leaders: { ...OTHERS, neutral: "title:men_head" },
    govNames: ["neutral"],
  },
  {
    tag: "BRM",
    ruling: "neutral",
    popularity: [13, 9, 18, 60],
    stability: 50,
    warSupport: 40,
    tree: "new",
    leaders: { ...OTHERS, neutral: "title:brm_head" },
    govNames: ["neutral"],
  },
  {
    // Democratic when the United States releases it, non-aligned (the 1943
    // republic, its head by title) when Japan creates it.
    tag: "PHL",
    ruling: "democratic",
    popularity: [60, 5, 9, 26],
    stability: 50,
    warSupport: 40,
    tree: "new",
    leaders: { ...OTHERS, democratic: "phl_quezon", neutral: "title:phl_head" },
    govNames: ["democratic", "neutral"],
  },
  {
    tag: "CW1",
    ruling: "neutral",
    popularity: [0, 0, 0, 100],
    stability: 50,
    warSupport: 40,
    tree: "new",
    leaders: { ...OTHERS, neutral: "title:cw_provisional_leader" },
  },
  {
    tag: "CW2",
    ruling: "neutral",
    popularity: [0, 0, 0, 100],
    stability: 50,
    warSupport: 40,
    tree: "new",
    leaders: { ...OTHERS, neutral: "title:cw_provisional_leader" },
  },
  {
    tag: "CW3",
    ruling: "neutral",
    popularity: [0, 0, 0, 100],
    stability: 50,
    warSupport: 40,
    tree: "new",
    leaders: { ...OTHERS, neutral: "title:cw_provisional_leader" },
  },
  {
    tag: "CW4",
    ruling: "neutral",
    popularity: [0, 0, 0, 100],
    stability: 50,
    warSupport: 40,
    tree: "new",
    leaders: { ...OTHERS, neutral: "title:cw_provisional_leader" },
  },
  {
    tag: "CW5",
    ruling: "neutral",
    popularity: [0, 0, 0, 100],
    stability: 50,
    warSupport: 40,
    tree: "new",
    leaders: { ...OTHERS, neutral: "title:cw_provisional_leader" },
  },
  {
    tag: "CW6",
    ruling: "neutral",
    popularity: [0, 0, 0, 100],
    stability: 50,
    warSupport: 40,
    tree: "new",
    leaders: { ...OTHERS, neutral: "title:cw_provisional_leader" },
  },
];
