// Great War 1914: the country's blocs and its newspapers. A bloc holds no value
// of its own: its support is read from the bodies, the gauges, the people and
// what the papers have written (engine/ww1914/Blocs). What is new is the press:
// the censor's level, the rumour that grows where news is cut, the papers' word
// with each bloc, and the chapter's edition. Text is in the pack's `press`.
import { z } from "zod";

const Id = z
  .string()
  .regex(/^[a-z][a-z0-9_]*$/)
  .max(48);
const Int = z.number().int();

/** Append only. Every country has these six, under its own names. */
export const GW_BLOCS = [
  "army",
  "court",
  "parliament",
  "business",
  "workers",
  "press",
] as const;
export type GwBloc = (typeof GW_BLOCS)[number];

/** A bloc's support runs -5..5; at this or under it has turned. */
export const GW_SUPPORT_MAX = 5;
export const GW_BLOC_AGAINST = -3;
/** What the papers have made of a bloc's mood, either way. */
export const GW_OPINION_MAX = 3;
export const GW_RUMOUR_MAX = 5;
/** 0 open, 1 wartime rules, 2 strict. */
export const GW_CENSOR_MAX = 2;

/** One headline of an edition: pack press.heads.<story>.<paper>. */
export const GwHeadlineSchema = z.object({
  paper: Id,
  /** -1 against the seat, 0 plain, 1 for it, as it reached the readers. */
  tone: Int,
  /** The censor took it: the paper shows a gap. */
  blank: z.boolean(),
  /** An invited paper held back a blow. */
  soft: z.boolean(),
});
export type GwHeadline = z.infer<typeof GwHeadlineSchema>;

/** The chapter's papers: one story, told two or three ways. */
export const GwEditionSchema = z.object({
  chapter: Int,
  story: Id,
  /** The decision it is about, by its title; null for news of the world. */
  scene: Id.nullable(),
  /** The person it names: the text's {who}. */
  who: Id.nullable(),
  heads: z.array(GwHeadlineSchema),
  /** What goes round the queues: pack press.rumours.<id>. */
  rumour: Id.nullable(),
});
export type GwEdition = z.infer<typeof GwEditionSchema>;

const BlocValues = z.record(z.enum(GW_BLOCS), Int);

/** A seat's press. Countries nobody plays have none. */
export const GwPressStateSchema = z.object({
  censor: Int,
  rumour: Int,
  /** The papers' word with each bloc, within GW_OPINION_MAX. */
  opinion: BlocValues,
  /** Support at the last close, and the close before: the trend. */
  support: BlocValues,
  was: BlocValues,
  /** Chapter of the last press act; -9 none. One a chapter. */
  acted: Int,
  /** The invited paper, and the last chapter it holds back. */
  friend: Id.nullable(),
  friendTo: Int,
  /** An act the next edition has to report (a story's `event`). */
  event: Id.nullable(),
  /** Who a leak was about. */
  leaked: Id.nullable(),
  /** The war's own censor has come: it comes once. */
  warBegun: z.boolean(),
  edition: GwEditionSchema.nullable(),
  /** Story id -> the chapter it last ran. */
  ran: z.record(z.string(), Int),
});
export type GwPressState = z.infer<typeof GwPressStateSchema>;

const zeros = () =>
  Object.fromEntries(GW_BLOCS.map((b) => [b, 0])) as Record<GwBloc, number>;

export function gwPressStart(): GwPressState {
  return {
    censor: 0,
    rumour: 0,
    opinion: zeros(),
    support: zeros(),
    was: zeros(),
    acted: -9,
    friend: null,
    friendTo: -1,
    event: null,
    leaked: null,
    warBegun: false,
    edition: null,
    ran: {},
  };
}

// ---- What the screen reads ----

/** 0 against, 1 cool, 2 waiting, 3 with the seat, 4 firm: gw.ui.bloc_word.<n>. */
export function gwSupportWord(support: number): number {
  if (support <= GW_BLOC_AGAINST) return 0;
  if (support < 0) return 1;
  if (support === 0) return 2;
  return support < 3 ? 3 : 4;
}

export interface GwBlocView {
  id: GwBloc;
  support: number;
  /** gwSupportWord. */
  word: number;
  /** Since the close before last. */
  delta: number;
  /** "leaving": one more chapter like this and it has turned. "back": it is coming round. */
  turning: "leaving" | "back" | null;
  /** The strongest reasons, strongest first; pack press.why.<key>. */
  why: readonly { key: string; up: boolean }[];
  /** Ministers who stand with it. */
  people: readonly string[];
  /** Its papers. */
  papers: readonly string[];
}

/** Two blocs: pack press.ties.<key>, or <key>_off once it has broken. */
export interface GwTieView {
  a: GwBloc;
  b: GwBloc;
  key: string;
  on: boolean;
}

export interface GwPaperView {
  id: string;
  blocs: readonly GwBloc[];
  /** The bloc its visit to the palace offends. */
  foe: GwBloc | null;
  /** Whether it can be invited at all. */
  invitable: boolean;
  friend: boolean;
}

export interface GwPressView {
  blocs: readonly GwBlocView[];
  ties: readonly GwTieView[];
  papers: readonly GwPaperView[];
  edition: GwEdition | null;
  censor: number;
  /** The most the censor can do now. */
  censorCap: number;
  /** Authority a tighter censor costs. */
  censorPrice: number;
  /** Why it can't be tightened, or null: gw.plan_why words. */
  censorBar: string | null;
  rumour: number;
  /** An act was taken this chapter. */
  acted: boolean;
}
