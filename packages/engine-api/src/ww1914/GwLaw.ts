// Great War 1914: bills and laws (brief ww142, lane L). The words, the state a
// country keeps and what a seat reads. The rows are engine-lib/ww1914/LawRows,
// the running of them engine/ww1914/Laws. Lists are APPEND ONLY.
import { z } from "zod";
import { GW_LAW_ORIGINS } from "./GwHouse";

/**
 * Where a bill stands: drawn up, being argued, on the day of the vote, the law
 * of the land. `idle` is a bill taken back or repealed: it can come again.
 */
export const GW_LAW_STAGES = [
  "idle",
  "draft",
  "persuade",
  "vote",
  "force",
] as const;
export type GwLawStage = (typeof GW_LAW_STAGES)[number];

/**
 * How a law came to be. `scene`: a decision of the desk had already made it.
 * `repealed`: it was ended, so that decision doesn't make it law again.
 */
export const GW_LAW_HOWS = [
  "none",
  "voted",
  "decreed",
  "scene",
  "repealed",
] as const;
export type GwLawHow = (typeof GW_LAW_HOWS)[number];

/** What the count looks like, in words: the seat never sees a number. */
export const GW_LAW_OUTLOOKS = ["easy", "tight", "short", "blocked"] as const;
export type GwLawOutlook = (typeof GW_LAW_OUTLOOKS)[number];

const int = z.number().int();

export const GwLawStateSchema = z.object({
  /** A row of GW_LAWS. */
  id: z.string(),
  stage: z.enum(GW_LAW_STAGES),
  /** The chapter it came to this stage. */
  since: int,
  /** What drafting and talks have won or lost it. */
  support: int,
  how: z.enum(GW_LAW_HOWS),
  /** The draft's option: which text of the bill this is. */
  text: z.string().nullable(),
  /** Times the body has turned it down. */
  lost: int,
  /** The aftermath scene has come. */
  after: z.boolean(),
  // ---- The house (ww158); a save from before has the defaults. ----
  /** Who brought it (GwHouse GW_LAW_ORIGINS). */
  origin: z.enum(GW_LAW_ORIGINS).default("seat"),
  /** The faction whose bill it is; null for the seat's own. */
  by: z.string().nullable().default(null),
  /** The minister who drafts and works it; null: the row's cast. */
  sponsor: z.string().nullable().default(null),
  /** Factions with a deal on this bill. */
  deals: z.array(z.string()).default([]),
  /** The whip's last word (GW_WHIP_WORDS index); -1 none yet. */
  whip: int.default(-1),
  /** The Lords put it off until this chapter; -1 not. */
  delayTo: int.default(-1),
});
export type GwLawState = z.infer<typeof GwLawStateSchema>;

/** One line of the country tab: all of it the seat's to know. */
export interface GwLawView {
  id: string;
  /** `open`: no one has taken it up; it can be drafted now. */
  stage: GwLawStage | "open";
  how: GwLawHow;
  text: string | null;
  /** While it is moving: how the count stands today. */
  outlook: GwLawOutlook | null;
  /** The body that can stop it, and the one behind that. */
  body: string | null;
  second: string | null;
  /** The bill can go past them, at the price the card shows. */
  decree: boolean;
  /** Why it can't be taken up now: another bill is moving, or it was just shelved. */
  waits: "busy" | "shelved" | null;
  /** Who can be called about it now. */
  talk: { person: string; topic: string } | null;
  /** In force: what ending it costs. */
  repeal: { tell: readonly string[]; open: boolean } | null;
  /** The house runs it (ww158): a sponsor is picked, the factions argue it. */
  house?: boolean;
}
