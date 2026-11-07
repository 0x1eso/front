// Great War 1914: the peace table. When the war ends by armistice the map is the
// table: the countries put places on it in turn, the other side says yes, no, or
// offers something else, and what is agreed repaints the map. Rules live in
// engine/ww1914/Table; lists of what each country came for in
// engine-lib/ww1914/TableRows; words in the pack's `table`.
import { z } from "zod";
import { GW_TAGS, GwTag } from "./GwCountries";
import { GwPlace, GwPlaceSchema } from "./GwPlaces";

/** What can stand in for the land. APPEND ONLY (wire). */
export const GW_TABLE_TRADES = [
  "reparations", // the land stays, the holder pays
  "recognition", // the land stays, the holder signs a word of recognition
  "port", // the land stays, the claimant keeps a free port in it
  "guarantee", // the land stays, under a guarantee: no forts, no garrison
] as const;
export type GwTableTrade = (typeof GW_TABLE_TRADES)[number];

/** What one side can answer. APPEND ONLY (wire). */
export const GW_TABLE_WORDS = ["yes", "no", "offer", "press", "drop"] as const;
export type GwTableWord = (typeof GW_TABLE_WORDS)[number];

/** Where a claim has got to. `pressed`: it has been insisted on, once. */
export const GW_TABLE_STEPS = [
  "asked",
  "refused",
  "offered",
  "pressed",
] as const;

export const GW_TABLE_ENDS = [
  "open",
  "agreed", // given up by consent
  "imposed", // taken after the holder ran out of refusals
  "traded", // something else in its place
  "refused", // refused to the last
  "dropped", // the claimant let it go
] as const;
export type GwTableEnd = (typeof GW_TABLE_ENDS)[number];

/** What is said at the table: each is a line in the pack. */
export const GW_TABLE_LINES = [
  "open",
  "claim",
  "yes",
  "no",
  "offer",
  "traded",
  "press",
  "drop",
  "impose",
  "over",
  "hold",
  "close",
] as const;
export type GwTableLineKind = (typeof GW_TABLE_LINES)[number];

const Tag = z.enum(GW_TAGS);
const Trade = z.enum(GW_TABLE_TRADES);

export const GwTableClaimSchema = z.object({
  id: z.number().int(),
  place: GwPlaceSchema,
  by: Tag,
  against: Tag,
  session: z.number().int(),
  state: z.enum(GW_TABLE_ENDS),
  step: z.enum(GW_TABLE_STEPS),
  /** What is on offer in the land's place, and who offers it. */
  offer: Trade.nullable(),
  offerBy: Tag.nullable(),
  /** Offers made on it so far. */
  offers: z.number().int(),
  /** It has been insisted on: that can't be done twice. */
  pressed: z.boolean(),
});
export type GwTableClaim = z.infer<typeof GwTableClaimSchema>;

export const GwTableLineSchema = z.object({
  n: z.number().int(),
  word: z.enum(GW_TABLE_LINES),
  who: Tag,
  /** The claim it is about; -1 for none. */
  claim: z.number().int(),
});
export type GwTableLine = z.infer<typeof GwTableLineSchema>;

export const GwTableStateSchema = z.object({
  /** 0-based: the month of the conference. */
  session: z.number().int(),
  /** Countries in speaking order, and how far round they have got. */
  order: z.array(Tag),
  round: z.number().int(),
  at: z.number().int(),
  /** No step runs before this tick: the table talks at reading speed. */
  next: z.number().int(),
  /** This month's business is over. */
  done: z.boolean(),
  /** The treaty is signed. */
  closed: z.boolean(),
  claims: z.array(GwTableClaimSchema),
  lines: z.array(GwTableLineSchema),
  /** Tag -> steps of reparations it owes. */
  bill: z.partialRecord(Tag, z.number().int()),
  /** Tag -> how far past what the table will bear it has gone. */
  over: z.partialRecord(Tag, z.number().int()),
  /** Tag -> claims it refused to the last. */
  held: z.partialRecord(Tag, z.number().int()),
});
export type GwTableState = z.infer<typeof GwTableStateSchema>;

/** A claim as the seat sees it; `words` are what it may say to it now. */
export interface GwTableClaimView {
  id: number;
  place: GwPlace;
  by: GwTag;
  against: GwTag;
  session: number;
  state: GwTableEnd;
  step: (typeof GW_TABLE_STEPS)[number];
  offer: GwTableTrade | null;
  offerBy: GwTag | null;
}

/** What the seat has to do at the table now. */
export type GwTableDue =
  /** Its turn: a place of `places`, or pass. */
  | { kind: "turn"; left: number; places: readonly GwPlace[] }
  /** A claim waits for its word. */
  | {
      kind: "word";
      claim: number;
      words: readonly GwTableWord[];
      trades: readonly GwTableTrade[];
    }
  | null;

/** What the screens read; the same for every seat but `due` and `role`. */
export interface GwTableView {
  session: number;
  sessions: number;
  closed: boolean;
  done: boolean;
  /** `won`, `lost`, `even`, or `watch` for a seat with no chair. */
  role: "won" | "lost" | "even" | "watch";
  /** The chairs, in speaking order. */
  order: readonly GwTag[];
  /** Those who came to the table beaten; [] when nobody was. */
  losers: readonly GwTag[];
  /** Whose turn it is; null while nobody's. */
  speaker: GwTag | null;
  claims: readonly GwTableClaimView[];
  /** The last things said, oldest first. */
  lines: readonly GwTableLine[];
  bill: Readonly<Partial<Record<GwTag, number>>>;
  over: number;
  held: number;
  due: GwTableDue;
}

/** The seat's painted land (war aims). */
export interface GwClaimsView {
  places: readonly GwPlace[];
  /** Painted land it now holds. */
  held: readonly GwPlace[];
  /** Painting is open: the war is on and the guns haven't stopped. */
  open: boolean;
  /** It has been signed: a change now has a price. */
  priced: boolean;
}

/** The map at the end, for the memoir. */
export const GwMapRecordSchema = z.object({
  painted: z.array(GwPlaceSchema),
  got: z.array(GwPlaceSchema),
  /** Everything out of its 1914 owner's hands at the end. */
  moves: z.array(
    z.object({ place: GwPlaceSchema, from: Tag, to: Tag }),
  ),
  /** What the seat's claims came to, other than land. */
  trades: z.array(
    z.object({
      place: GwPlaceSchema,
      with: Tag,
      trade: Trade,
      mine: z.boolean(),
    }),
  ),
  /** Claims made on the seat that it refused to the last. */
  held: z.number().int(),
  over: z.number().int(),
  /** `won`, `lost`, `even`, `watch`, or null with no table. */
  role: z.enum(["won", "lost", "even", "watch"]).nullable(),
});
export type GwMapRecord = z.infer<typeof GwMapRecordSchema>;
