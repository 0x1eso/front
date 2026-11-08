// Great War 1914: the house and its factions (brief ww158). The words, the state
// a seat keeps and what it reads. Rows are engine-lib/ww1914/HouseRows, content
// in content/house/<tag>.ts, the running engine/ww1914/House (S1: factions,
// the count, the whip, ways round) and the S2 files (plots, the dossier,
// allies' asks). See /home/eser/dev/ww158-format.md. Lists are APPEND ONLY.
import { z } from "zod";

/** The chambers a bill can meet. Text: gw.house.chamber.<id>. */
export const GW_CHAMBERS = [
  "reichstag",
  "bundesrat",
  "commons",
  "lords",
  "duma",
  /** Russia's State Council. */
  "council",
  /** Vienna. */
  "reichsrat",
  /** The Hungarian Diet. */
  "budapest",
] as const;
export type GwChamber = (typeof GW_CHAMBERS)[number];

/**
 * `out`: not formed yet. `in`: sits and counts. `merged`: gone into another
 * faction. `under`: driven underground: it counts for nothing in the house.
 */
export const GW_FACTION_STATUS = ["out", "in", "merged", "under"] as const;
export type GwFactionStatus = (typeof GW_FACTION_STATUS)[number];

/** Strength 0..4: gw.house.strength.<n> (한 줌 .. 의회를 쥔). */
export const GW_FACTION_STRENGTH_MAX = 4;
/** Temper 0..4: gw.house.temper.<n> (따른다 .. 말이 없다). */
export const GW_FACTION_STEP_MAX = 4;

/** Who brought a bill. `house`: a faction put it by itself; it can't be withdrawn. */
export const GW_LAW_ORIGINS = ["seat", "faction", "ally", "house"] as const;
export type GwLawOrigin = (typeof GW_LAW_ORIGINS)[number];

/** The whip's word, best first: gw.house.whip.<word>. */
export const GW_WHIP_WORDS = [
  "wide",
  "likely",
  "even",
  "short",
  "hopeless",
] as const;
export type GwWhipWord = (typeof GW_WHIP_WORDS)[number];

/** How a vote went: the result card's variant. */
export const GW_VOTE_BANDS = [
  "wide",
  "narrow",
  "lost_narrow",
  "lost_wide",
] as const;
export type GwVoteBand = (typeof GW_VOTE_BANDS)[number];

/** The way round the house: which constitution's door. */
export const GW_AROUNDS = ["bundesrat", "dora", "art87", "par14"] as const;
export type GwAround = (typeof GW_AROUNDS)[number];

/** A file's weakness kinds (S2): gw.house.weak.<id>. */
export const GW_WEAKNESSES = [
  "debts",
  "letters",
  "industry_money",
  "foreign_ties",
  "old_scandal",
  "health",
] as const;
export type GwWeakness = (typeof GW_WEAKNESSES)[number];

/** Where an ally's ask stands (S2). */
export const GW_ASK_STAGES = ["asked", "yes", "no", "kept", "broken"] as const;
export type GwAskStage = (typeof GW_ASK_STAGES)[number];

/** What an ally asks for (S2). */
export const GW_ASK_KINDS = ["offensive", "loan", "front", "law"] as const;
export type GwAskKind = (typeof GW_ASK_KINDS)[number];

const int = z.number().int();
/** An id (GreatWarTypes imports this file, so not its GwIdSchema). */
const Id = z.string();

export const GwFactionStateSchema = z.object({
  /** A row of the country's factions. */
  id: Id,
  status: z.enum(GW_FACTION_STATUS),
  /** 0..GW_FACTION_STRENGTH_MAX. */
  strength: int,
  /** Temper as heat: a month a feed holds it climbs, a month none does it cools. */
  heat: int,
  /** 0..GW_FACTION_STEP_MAX, from the row's step thresholds. */
  step: int,
  /** Its asks refused or let lie; one fades every 6 months. */
  ignored: int,
  /** A file holds its leader to the seat's word until this chapter; -1 none. */
  held: int,
  /** Its leader now; null with nobody fit. */
  leader: Id.nullable(),
  /** The chapter it came to this status. */
  since: int,
  /** The last move of its strength: -1, 0, +1. */
  trend: int,
  /** The reason key of that move or of its temper: pack factions why. */
  why: Id.nullable(),
  /** The bill its leader came asking for; null none open. */
  asking: Id.nullable(),
  /** The chapter it last asked; -9 never. */
  asked: int,
  /** Promise keys of its deals not yet settled. */
  deals: z.array(Id),
  /** Chamber -> seats, once a split or a join has moved them; null: its row's. */
  seats: z.record(z.string(), int).nullable().default(null),
});
export type GwFactionState = z.infer<typeof GwFactionStateSchema>;

/** A file on a person (S2). `truth` is hidden from the view. */
export const GwFileSchema = z.object({
  uid: int,
  /** The person. */
  who: Id,
  weak: z.enum(GW_WEAKNESSES),
  /** The police's stamp on it. */
  stamp: z.enum(["confirmed", "unconfirmed", "estimate"]),
  /** Hidden: whether the weakness is real. */
  truth: z.boolean(),
  chapter: int,
  /** Times it has been used. */
  used: int,
  /** Burnt (false, used) or found out: no longer held. */
  out: z.boolean(),
});
export type GwFile = z.infer<typeof GwFileSchema>;

/** An ally's ask (S2): a row of the country's asks and where it stands. */
export const GwAskStateSchema = z.object({
  id: Id,
  stage: z.enum(GW_ASK_STAGES),
  chapter: int,
});
export type GwAskState = z.infer<typeof GwAskStateSchema>;

/** A plot's fair-warning record (S2): signs opened, the warning's chapter. */
export const GwPlotStateSchema = z.object({
  /** A plot row (a GW_GOV row with `plot`). */
  id: Id,
  /** Sign scenes the seat has opened. */
  signs: z.array(Id),
  /** The chapter the warning was opened; -1 not yet. */
  warned: int,
});
export type GwPlotState = z.infer<typeof GwPlotStateSchema>;

/** A seat's house: absent until the first chapter of a seat that has rows. */
export const GwHouseStateSchema = z.object({
  factions: z.array(GwFactionStateSchema),
  /** Extra calls left this chapter, for the moving bill's leaders only. */
  calls: int,
  /** The whip's record: words that the vote bore out, and not. */
  right: int,
  wrong: int,
  /** The last vote: the bill, the band, the chapter. */
  last: z
    .object({ law: Id, band: z.enum(GW_VOTE_BANDS), chapter: int })
    .nullable(),
  /** Times the way round has been used. */
  around: int,
  /** A split or a join this chapter: the edition's story. */
  story: z
    .object({ kind: z.enum(["split", "joined"]), faction: Id, chapter: int })
    .nullable()
    .default(null),
  // ---- S2 ----
  files: z.array(GwFileSchema),
  nextFile: int,
  asks: z.array(GwAskStateSchema),
  plots: z.array(GwPlotStateSchema),
});
export type GwHouseState = z.infer<typeof GwHouseStateSchema>;

export function gwHouseStart(): GwHouseState {
  return {
    factions: [],
    calls: 0,
    right: 0,
    wrong: 0,
    last: null,
    around: 0,
    story: null,
    files: [],
    nextFile: 1,
    asks: [],
    plots: [],
  };
}

// ---- What the screen reads ----

/** A faction on the 정국 tab: words only, nothing hidden. */
export interface GwFactionView {
  id: string;
  /** Its bloc (GwPress GW_BLOCS). */
  bloc: string;
  status: GwFactionStatus;
  /** gw.house.strength.<n>. */
  strength: number;
  /** gw.house.temper.<n>. */
  temper: number;
  trend: number;
  /** Pack factions.<id>.why.<key>, else gw.house.why.<key>. */
  why: string | null;
  leader: string | null;
  /** The chambers it sits in. */
  chambers: readonly GwChamber[];
}

/** One faction of the moving bill's house. */
export interface GwBillFactionView {
  id: string;
  leader: string | null;
  /** What the whip says it will do, if he said: -1 against, 0 away, 1 for. */
  said: number | null;
  /** A deal was struck with it on this bill. */
  deal: boolean;
  /** The lobby talk, while it can be called. */
  call: string | null;
}

/** The moving bill as the house sees it. */
export interface GwBillView {
  law: string;
  stage: "draft" | "persuade" | "vote" | "sign";
  origin: GwLawOrigin;
  sponsor: string | null;
  chambers: readonly GwChamber[];
  /** The whip's last word and who said it. */
  whip: { person: string | null; word: GwWhipWord; chapter: number } | null;
  factions: readonly GwBillFactionView[];
  /** The Lords have put it off to this chapter; null not. */
  delayTo: number | null;
}

export interface GwHouseView {
  bill: GwBillView | null;
  /** Extra calls left this chapter. */
  calls: number;
  /** The whip's record: 맞음 n, 틀림 n. */
  record: { right: number; wrong: number };
  whipPerson: string | null;
  factions: readonly GwFactionView[];
  /** A faction out on the street or out of the house: the band's chip. */
  out: { id: string; bloc: string } | null;
  /** The way round, if the constitution has one. */
  around: GwAround | null;
}
