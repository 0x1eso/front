// Great War 1914, ww180: named agents and the war of words (engine/ww1914/
// Agents, Propaganda). A scene reads them through `world({ is: "agent" })`
// and `world({ is: "prop" })`, and does them through `doWorld`. Lists are
// APPEND ONLY. Text: gw.agent.<id> (name, work, bio) in the lang files.
import type { GwAgentFate } from "./GreatWarTypes";
import type { GwTag } from "./GwCountries";

/** What a named agent adds to his country's net. APPEND ONLY. */
export const GW_AGENT_WORKS = [
  "eyes", // what he sees and hears: the foe's strain, plans, a neutral's mind
  "trains", // trains watched: the foe's offensive in preparation, confirmed
  "sabotage", // munitions ships and depots set on fire
  "papers", // newspapers bought: the foe's nerve at home
] as const;
export type GwAgentWork = (typeof GW_AGENT_WORKS)[number];

export interface GwAgentDef {
  id: string;
  /** The services that can hire him, each with the country he works in. */
  by: Partial<Record<GwTag, GwTag>>;
  /** The first month he can be hired: [year, month]. */
  from: readonly [number, number];
  work: GwAgentWork;
  /** 1..3: how good his reports and his work are. */
  skill: number;
  /** 1..3: how hard he is to catch. */
  care: number;
  /** He gets away when taken, more often than not. */
  slips?: true;
}

/**
 * The pool (design ww180 §6): real spies, their facts in `source`. Order
 * matters to the rolls: append.
 */
export const GW_AGENTS: readonly GwAgentDef[] = [
  {
    // Landed 27 Aug 1914 as "Charles A. Inglis"; MO5(g) read his letters;
    // taken at Killarney 2 Oct 1914, shot in the Tower 6 Nov 1914 (en.wikipedia).
    id: "lody",
    by: { DEU: "GBR" },
    from: [1914, 8],
    work: "eyes",
    skill: 1,
    care: 1,
  },
  {
    // German agent H-21; the Deuxième Bureau (Ladoux) took her on in 1916;
    // arrested in Paris 13 Feb 1917, shot at Vincennes 15 Oct 1917.
    id: "mata_hari",
    by: { DEU: "FRA", FRA: "DEU" },
    from: [1915, 10],
    work: "eyes",
    skill: 1,
    care: 2,
  },
  {
    // German money through the ex-Khedive for the French press; arrested
    // 29 Sep 1917, shot at Vincennes 17 Apr 1918.
    id: "bolo",
    by: { DEU: "FRA" },
    from: [1915, 3],
    work: "papers",
    skill: 1,
    care: 2,
  },
  {
    // In New York from 3 Apr 1915: cigar bombs in munitions ships, Labor's
    // National Peace Council; taken off the Noordam in August 1915.
    id: "rintelen",
    by: { DEU: "USA" },
    from: [1915, 4],
    work: "sabotage",
    skill: 2,
    care: 1,
  },
  {
    // Bombs in mineral-sample boxes on British ships from Bahia (Tennyson,
    // Feb 1916); faked his death; escaped Bellevue 25 May 1919.
    id: "duquesne",
    by: { DEU: "USA" },
    from: [1915, 6],
    work: "sabotage",
    skill: 2,
    care: 3,
    slips: true,
  },
  {
    // Sworn into SIS by Cumming in spring 1918, in Russia by April; the
    // Lockhart plot; out through Finland, in London 8 Nov 1918.
    id: "reilly",
    by: { GBR: "RUS" },
    from: [1918, 3],
    work: "eyes",
    skill: 2,
    care: 2,
    slips: true,
  },
  {
    // Belgian train-watchers for British intelligence from 1916 (Dewé,
    // Chauvin); over a thousand by 1918, never broken.
    id: "dame_blanche",
    by: { GBR: "DEU" },
    from: [1916, 7],
    work: "trains",
    skill: 3,
    care: 3,
  },
  {
    // "Alice Dubois": a network of about 100 in Lille for the British,
    // Jan-Sep 1915; taken 20 Oct 1915; died in Cologne 27 Sep 1918.
    id: "bettignies",
    by: { GBR: "DEU" },
    from: [1915, 1],
    work: "trains",
    skill: 2,
    care: 1,
  },
  // ---- ww190: Russia's and Austria-Hungary's own ----
  {
    // Col. Pavel A. Ignatiev ran Russia's intelligence and counter-
    // intelligence bureau in France from 1915 (the Interallied Bureau, Paris,
    // Sep 1915); by spring 1917 a large network (his memoir, Paris 1933).
    id: "ignatiev",
    by: { RUS: "DEU" },
    from: [1915, 9],
    work: "eyes",
    skill: 2,
    care: 3,
  },
  {
    // The Ceska druzina, formed at Kiev in August 1914 from the empire's
    // Czechs: patrols that scouted, questioned prisoners and talked the
    // regiments opposite over; first in action in November 1914.
    id: "druzhina",
    by: { RUS: "AUH" },
    from: [1914, 10],
    work: "eyes",
    skill: 2,
    care: 2,
  },
  {
    // Capt. Rudolf Mayer's office in the consulate at Zurich, blamed for the
    // Benedetto Brin (Brindisi, 27 Sep 1915) and the Leonardo da Vinci
    // (Taranto, 2 Aug 1916); the Italians broke in at the end of Feb 1917.
    id: "zurich_net",
    by: { AUH: "ITA" },
    from: [1915, 6],
    work: "sabotage",
    skill: 2,
    care: 2,
  },
  {
    // The Union for the Liberation of Ukraine: founded at Lemberg 4 Aug 1914,
    // in Vienna from late August; papers, and the camps of Ukrainian POWs.
    id: "svu",
    by: { AUH: "RUS" },
    from: [1914, 9],
    work: "papers",
    skill: 1,
    care: 3,
  },
  {
    // Pilsudski's Polish Military Organisation, named in November 1914:
    // underground, spying and sabotage behind the Russian lines.
    id: "pow_polish",
    by: { AUH: "RUS" },
    from: [1914, 11],
    work: "eyes",
    skill: 2,
    care: 2,
  },
];

/** What a condition asks of named agents. APPEND ONLY. */
export const GW_AGENT_CANS = [
  "hire", // the seat can hire him now (`id`), or anyone
  "working", // the seat has an agent at work (`id`, or anyone)
  "lost", // one of the seat's agents was lost in the last two chapters
] as const;
export type GwAgentCan = (typeof GW_AGENT_CANS)[number];

/** The war of words. APPEND ONLY. */
export const GW_PROP_ACTS = [
  "home", // 나라 안에 선전을 편다: the nerve at home
  "hush", // 나쁜 소식을 덮는다: blows kept out of the papers
  "leaflets", // 적국 후방에 전단을 뿌린다 (tag)
  "papers", // 중립국 신문을 산다 (tag)
] as const;
export type GwPropAct = (typeof GW_PROP_ACTS)[number];

/** The acts: whether the seat can order it now; ok/out: how `act` went. */
export const GW_PROP_CANS = [...GW_PROP_ACTS, "ok", "out"] as const;
export type GwPropCan = (typeof GW_PROP_CANS)[number];

/** ww180: the seat's own named agents, as the 정보부 and 사람 tabs show them. */
export interface GwAgentsView {
  /** Hired, at work or lost, in order. */
  mine: readonly {
    id: string;
    at: GwTag;
    since: number;
    fate: GwAgentFate | null;
    end: number | null;
  }[];
  /**
   * The pool the seat's service could hire from, not yet taken by anyone:
   * `open` now, or what it waits for ("no_net": a net there; "date": not yet;
   * "full": two at work already).
   */
  pool: readonly {
    id: string;
    at: GwTag;
    open: boolean;
    wait: "no_net" | "date" | "full" | "gone" | null;
  }[];
}

/** ww180: the seat's own campaigns, as the 정보부 tab shows them. */
export interface GwPropView {
  home: boolean;
  hush: boolean;
  leaflets: readonly GwTag[];
  papers: readonly GwTag[];
  /** Newest last; `ok`/`out` null until the card came. */
  ops: readonly {
    act: string;
    tag: GwTag | null;
    ok: boolean | null;
    out: boolean | null;
    chapter: number;
  }[];
}
