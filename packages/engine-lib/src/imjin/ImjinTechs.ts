// ww184: the Imjin War's research (design §2: "the profile swaps the unit,
// ship and tech tables"). Each country researches its own weapons and drill
// on the 1936 research screen and slots; nothing of 1936 is offered in the
// Imjin profile, and none of these is offered in 1936 (EconomyChecks,
// ResearchScore). Every effect is read by the Imjin battle, siege or sea
// rules (ImjinBattle, Sieges, SeaBattle): no dead entries
// (tests/imjin/ImjinTechs.test.ts). Facts: the doctrine's sources
// (/home/eser/dev/ww177-doctrine.md §9) and the ww184 report.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type {
  TechBranch,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WwTechDef } from "../ww1936/WwTechs";
import type { UnitRow } from "./LandRules";
import type { ShipKind } from "./SeaRules";

/** What an Imjin tech changes, all integers (absent: nothing). */
export interface ImjinTechFx {
  /** A land row's damage, + % (LandRound.sideDealt). */
  row?: Partial<Record<UnitRow, number>>;
  /** Defending behind walls (fort > 0): + to the block % (LandRound). */
  wallBlockPct?: number;
  /** Storming walls: + % damage (LandRound). */
  stormPct?: number;
  /** A barrage at walls costs the garrison this much more morale a phase (‰). */
  barrageMorale?: number;
  /** The besiegers' guns breach this much faster, % (Sieges). */
  breachPct?: number;
  /** A besieged fort of this side holds this many more days of grain (Sieges). */
  grainDays?: number;
  /** Ships: + heavy guns (the gun clock), by kind (SeaBattle). */
  heavy?: Partial<Record<ShipKind, number>>;
  /** Ships: + light guns, by kind. */
  light?: Partial<Record<ShipKind, number>>;
  /** Ships: + arquebus crew damage, by kind. */
  arq?: Partial<Record<ShipKind, number>>;
  /** Ships: + boarding attack, by kind (only ships that board). */
  board?: Partial<Record<ShipKind, number>>;
  /** Ships: hull damage taken − %, by kind. */
  hullPct?: Partial<Record<ShipKind, number>>;
  /** Ships: + gunnery points (3 % to hit each, as an admiral's). */
  gunnery?: number;
}

/** The summed effects of a country's Imjin techs. */
export interface ImjinTechTotals {
  row: Partial<Record<UnitRow, number>>;
  wallBlockPct: number;
  stormPct: number;
  barrageMorale: number;
  breachPct: number;
  grainDays: number;
  heavy: Partial<Record<ShipKind, number>>;
  light: Partial<Record<ShipKind, number>>;
  arq: Partial<Record<ShipKind, number>>;
  board: Partial<Record<ShipKind, number>>;
  hullPct: Partial<Record<ShipKind, number>>;
  gunnery: number;
}

export interface ImjinTechMeta {
  /** The countries that research it. */
  tags: readonly CountryTag[];
  /** Its year on the research screen's axis (the real year it came in). */
  year: number;
  /** The AI's priority, higher first (ties by the seeded roll). */
  ai: number;
  fx: ImjinTechFx;
}

/**
 * Research days: a 1936 tech of its first year costs 84 days at ‰ 1000.
 * The Imjin table is short, so each tech costs four times that: a country's
 * three slots run through its table in about four years of war.
 */
export const IMJIN_COST_SCALE = 4;

/** The screen's year axis in the Imjin profile. */
export const IMJIN_FIRST_YEAR = 1590;
export const IMJIN_LAST_YEAR = 1599;

/** The research screen's tabs in the Imjin profile (TECH_TABS ids), in order. */
export const IMJIN_TECH_TABS = [
  "infantry",
  "artillery",
  "naval",
  "industry",
] as const;

type ImjinTab = (typeof IMJIN_TECH_TABS)[number];

function tech(
  id: WwTechId,
  tab: ImjinTab,
  tags: readonly CountryTag[],
  year: number,
  costPm: number,
  ai: number,
  fx: ImjinTechFx,
  prereqs: readonly WwTechId[] = [],
): WwTechDef {
  const branch: TechBranch = tab;
  return {
    id,
    branch,
    tab,
    // The 1936 axis: never ahead of time (the Imjin calendar has its own
    // years; `imjin.year` places the card on the screen).
    year: 1936,
    prereqs,
    effects: {},
    costPm: costPm * IMJIN_COST_SCALE,
    role: "imp",
    imjin: { tags, year, ai, fx },
  };
}

const JOS: readonly CountryTag[] = ["JOS"];
const JPN: readonly CountryTag[] = ["JPN"];
const MIN: readonly CountryTag[] = ["MIN"];
const JUR: readonly CountryTag[] = ["JUR"];

/** Every Imjin tech, by id (WwTechs merges them into WW_TECHS). */
export const IMJIN_TECH_DEFS = {
  // ---- Joseon ----
  // The 천·지·현·황자 총통 rank the guns from the largest down; the
  // panokseon's heavy battery fired the 대장군전 [S4, S8].
  imj_jos_cheonja: tech("imj_jos_cheonja", "artillery", JOS, 1592, 1250, 80, {
    heavy: { panokseon: 2, turtle: 1 },
    row: { cannon: 10 },
  }),
  imj_jos_hyeonja: tech("imj_jos_hyeonja", "artillery", JOS, 1592, 1000, 70, {
    light: { panokseon: 1, hyeopseon: 1 },
    row: { cannon: 10 },
  }),
  // Yi Jang-son's time bomb, fired from a wangu, retook Gyeongju in
  // 1592-09: the garrison left the next day [S15].
  imj_jos_bigyeok: tech(
    "imj_jos_bigyeok",
    "artillery",
    JOS,
    1592,
    1250,
    60,
    { barrageMorale: 60, breachPct: 25 },
    ["imj_jos_cheonja"],
  ),
  // Haengju (1593): the hwacha threw back seven assaults [S16].
  imj_jos_hwacha: tech("imj_jos_hwacha", "artillery", JOS, 1593, 1000, 65, {
    row: { hwacha: 40 },
  }),
  // The pyeonjeon, a short arrow fired from a tube, outranged the bows [S17].
  imj_jos_pyeonjeon: tech("imj_jos_pyeonjeon", "infantry", JOS, 1592, 750, 75, {
    row: { archer: 15 },
  }),
  // Captured arquebuses, then copies: hard at first (the sillok, 1593) [S18].
  imj_jos_jochong: tech("imj_jos_jochong", "infantry", JOS, 1593, 1250, 50, {
    row: { arquebus: 20 },
  }),
  // The 훈련도감 (1593-08) and its 삼수병: gunners, archers, blades [S12].
  imj_jos_samsu: tech(
    "imj_jos_samsu",
    "infantry",
    JOS,
    1594,
    1500,
    45,
    { row: { arquebus: 10, spear: 15, archer: 5 } },
    ["imj_jos_jochong"],
  ),
  // Qi Jiguang's 『기효신서』, the drill of the Zhejiang troops [S11, S12].
  imj_jos_jeolgang: tech(
    "imj_jos_jeolgang",
    "infantry",
    JOS,
    1594,
    1250,
    40,
    { row: { spear: 20 } },
    ["imj_jos_pyeonjeon"],
  ),
  imj_jos_panokseon: tech("imj_jos_panokseon", "naval", JOS, 1592, 1000, 78, {
    hullPct: { panokseon: 15 },
  }),
  // The turtle ship, first used at Sacheon (1592) [S8].
  imj_jos_turtle: tech(
    "imj_jos_turtle",
    "naval",
    JOS,
    1592,
    1250,
    72,
    { heavy: { turtle: 2 }, hullPct: { turtle: 20 } },
    ["imj_jos_panokseon"],
  ),
  imj_jos_drill: tech("imj_jos_drill", "naval", JOS, 1592, 750, 68, {
    gunnery: 1,
  }),
  imj_jos_sanseong: tech("imj_jos_sanseong", "industry", JOS, 1592, 1000, 55, {
    wallBlockPct: 15,
    grainDays: 30,
  }),
  // ---- Japan ----
  // About 30 % of a contingent carried the teppō [S21].
  imj_jpn_teppo: tech("imj_jpn_teppo", "infantry", JPN, 1592, 1000, 80, {
    row: { arquebus: 15 },
  }),
  // Korean sources describe the Japanese firing in rotating ranks [S22].
  imj_jpn_volley: tech(
    "imj_jpn_volley",
    "infantry",
    JPN,
    1592,
    1250,
    70,
    { row: { arquebus: 15 } },
    ["imj_jpn_teppo"],
  ),
  // The ashigaru's long pikes held the line [S2].
  imj_jpn_nagae: tech("imj_jpn_nagae", "infantry", JPN, 1592, 750, 65, {
    row: { spear: 20 },
  }),
  imj_jpn_samurai: tech("imj_jpn_samurai", "infantry", JPN, 1592, 1000, 60, {
    row: { samurai: 15, cavalry: 15 },
  }),
  // Busanjin's defenders were shot off the walls from the heights, and the
  // ladders went up [S3].
  imj_jpn_ladders: tech("imj_jpn_ladders", "industry", JPN, 1592, 1000, 75, {
    stormPct: 15,
  }),
  // About 30 stone wajō on the south coast from 1593 [S19, S23].
  imj_jpn_waeseong: tech("imj_jpn_waeseong", "industry", JPN, 1593, 1250, 45, {
    wallBlockPct: 15,
    grainDays: 30,
  }),
  // The atakebune: at most four cannon, many arquebuses [S5].
  imj_jpn_atakebune: tech("imj_jpn_atakebune", "naval", JPN, 1592, 1000, 55, {
    hullPct: { atakebune: 15 },
    heavy: { atakebune: 1 },
  }),
  imj_jpn_sekibune: tech("imj_jpn_sekibune", "naval", JPN, 1592, 750, 58, {
    arq: { sekibune: 2, kobaya: 1 },
  }),
  // "Crews, not ships": Japan fought at sea by boarding [S5].
  imj_jpn_boarding: tech("imj_jpn_boarding", "naval", JPN, 1592, 1000, 62, {
    board: { atakebune: 2, sekibune: 2, kobaya: 1 },
  }),
  // By 1597-98 Japanese fleets carried some cannon, some captured [S1, S7].
  imj_jpn_cannon: tech(
    "imj_jpn_cannon",
    "naval",
    JPN,
    1597,
    1500,
    30,
    { heavy: { atakebune: 1 }, light: { sekibune: 1 } },
    ["imj_jpn_atakebune"],
  ),
  // ---- Ming (AI) ----
  // Breech-loaders from the Portuguese; Li Rusong's 200 guns at Pyongyang [S9].
  imj_min_folangji: tech("imj_min_folangji", "artillery", MIN, 1593, 1000, 80, {
    row: { cannon: 15 },
    light: { fuchuan: 1, shachuan: 1 },
  }),
  imj_min_hudun: tech("imj_min_hudun", "artillery", MIN, 1593, 750, 60, {
    row: { cannon: 10 },
  }),
  imj_min_dajiangjun: tech(
    "imj_min_dajiangjun",
    "artillery",
    MIN,
    1593,
    1250,
    70,
    { breachPct: 50 },
    ["imj_min_folangji"],
  ),
  // Qi Jiguang's twelve-man mandarin duck squad [S11].
  imj_min_yuanyang: tech("imj_min_yuanyang", "infantry", MIN, 1593, 1000, 65, {
    row: { spear: 20 },
  }),
  // The southern troops (남병) went up Pyongyang's walls [S9].
  imj_min_southern: tech("imj_min_southern", "infantry", MIN, 1593, 1000, 55, {
    row: { arquebus: 20 },
  }),
  // The northern horse (북병), Li Rusong's vanguard at Byeokjegwan [S10].
  imj_min_northern: tech("imj_min_northern", "infantry", MIN, 1593, 750, 50, {
    row: { cavalry: 15 },
  }),
  // ---- The Jurchen (AI) ----
  imj_jur_riders: tech("imj_jur_riders", "infantry", JUR, 1592, 1000, 50, {
    row: { cavalry: 10, archer: 10 },
  }),
} as const satisfies Record<string, WwTechDef>;

export type ImjinTechId = keyof typeof IMJIN_TECH_DEFS;

/** The Imjin tech ids, in WW_TECH_IDS order. */
export const IMJIN_TECH_IDS = Object.keys(IMJIN_TECH_DEFS) as ImjinTechId[];

const IMJIN_SET: ReadonlySet<string> = new Set(IMJIN_TECH_IDS);

/** Whether `id` belongs to the Imjin table. */
export function isImjinTech(id: WwTechId): boolean {
  return IMJIN_SET.has(id);
}

/**
 * Whether a country researching from `imjinTag`'s table (undefined: the
 * 1936 table) may research `id`: the Imjin profile offers only its own
 * country's Imjin techs, 1936 none of them.
 */
export function techInTable(
  id: WwTechId,
  imjinTag: CountryTag | undefined,
): boolean {
  const def = (IMJIN_TECH_DEFS as Record<string, WwTechDef>)[id];
  if (imjinTag === undefined) return def === undefined;
  return def?.imjin?.tags.includes(imjinTag) === true;
}

/** The Imjin techs `tag` researches, in WW_TECH_IDS order. */
export function imjinTechsOf(tag: CountryTag): ImjinTechId[] {
  return IMJIN_TECH_IDS.filter(
    (id) => IMJIN_TECH_DEFS[id].imjin?.tags.includes(tag) === true,
  );
}

export function emptyImjinTechTotals(): ImjinTechTotals {
  return {
    row: {},
    wallBlockPct: 0,
    stormPct: 0,
    barrageMorale: 0,
    breachPct: 0,
    grainDays: 0,
    heavy: {},
    light: {},
    arq: {},
    board: {},
    hullPct: {},
    gunnery: 0,
  };
}

export const NO_IMJIN_TECH: ImjinTechTotals = emptyImjinTechTotals();

function addTo<K extends string>(
  to: Partial<Record<K, number>>,
  from: Partial<Record<K, number>> | undefined,
): void {
  if (from === undefined) return;
  for (const k of Object.keys(from) as K[]) {
    to[k] = (to[k] ?? 0) + (from[k] ?? 0);
  }
}

/** The summed effects of the researched Imjin techs (others ignored). */
export function imjinTechTotals(
  researched: Iterable<WwTechId>,
): ImjinTechTotals {
  const t = emptyImjinTechTotals();
  for (const id of researched) {
    const fx = (IMJIN_TECH_DEFS as Record<string, WwTechDef>)[id]?.imjin?.fx;
    if (fx === undefined) continue;
    addTo(t.row, fx.row);
    t.wallBlockPct += fx.wallBlockPct ?? 0;
    t.stormPct += fx.stormPct ?? 0;
    t.barrageMorale += fx.barrageMorale ?? 0;
    t.breachPct += fx.breachPct ?? 0;
    t.grainDays += fx.grainDays ?? 0;
    addTo(t.heavy, fx.heavy);
    addTo(t.light, fx.light);
    addTo(t.arq, fx.arq);
    addTo(t.board, fx.board);
    addTo(t.hullPct, fx.hullPct);
    t.gunnery += fx.gunnery ?? 0;
  }
  return t;
}

/** The research score of an Imjin tech for the AI (higher first; null: not its). */
export function imjinTechScore(
  id: WwTechId,
  tag: CountryTag,
  roll: number,
): number | null {
  const def = (IMJIN_TECH_DEFS as Record<string, WwTechDef>)[id];
  if (def?.imjin === undefined || !def.imjin.tags.includes(tag)) return null;
  return def.imjin.ai * 4 + (roll % 11);
}

// ---- What the rules read (SeaBattle.volley, Sieges) ----

/** A ship's added guns on a volley: its light pieces, and its heavy ones on the heavy beat. */
export function techGuns(
  t: ImjinTechTotals,
  kind: ShipKind,
  heavyBeat: boolean,
): number {
  return (t.light[kind] ?? 0) + (heavyBeat ? (t.heavy[kind] ?? 0) : 0);
}

/** A ship's added arquebus fire. */
export function techArq(t: ImjinTechTotals, kind: ShipKind): number {
  return t.arq[kind] ?? 0;
}

/** A ship's added boarding attack. */
export function techBoard(t: ImjinTechTotals, kind: ShipKind): number {
  return t.board[kind] ?? 0;
}

/** Hull damage a ship takes, cut by its researched hull (+n % hull). */
export function techHullTaken(
  t: ImjinTechTotals,
  kind: ShipKind,
  damage: number,
): number {
  const hp = t.hullPct[kind] ?? 0;
  return damage > 0 && hp > 0
    ? Math.floor((damage * 100) / (100 + hp))
    : damage;
}

/** A fort's grain at the start of a siege, with its owner's researched days. */
export function techGrainDays(t: ImjinTechTotals, base: number): number {
  return base + t.grainDays;
}
