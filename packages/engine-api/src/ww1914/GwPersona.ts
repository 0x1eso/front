// Great War 1914 (ww196 §0): you are that person. The rows that put the
// player in the ruler's chair: where he sits on the chapter's date, who hands
// him each paper, how he is addressed, what goes against his grain (and costs
// nerve), his diary, the "알고 보니" lines and the private papers.
// Engine: engine/ww1914/Persona.ts, Diary.ts (lane P). Rows: content
// persona/<seat>.ts (writers), joined in Content.ts as `persona`. Text: pack
// `persona` (GwPersonaPackSchema), shares `<SEAT>.persona.json`.
// The nerve side (기력): P appends "nerve" to GW_RULER_SIDES (GwRuler.ts);
// the ruler view's `levels` then has a fifth entry.
import { z } from "zod";
import { GW_OFFICES, GW_THEATRES, GwIdSchema } from "./GreatWarTypes";
import { GW_TAGS, GwTag } from "./GwCountries";
import { GW_LEANS } from "./GwDepts";
import { GW_PAPER_FORMS } from "./GwDeptWords";
import { GW_SCENE_KINDS, GW_SCENE_TAGS, GwCondSchema } from "./SceneDsl";

/**
 * Dates are Gregorian, as the game's calendar is (a Russian row converts the
 * Julian date: 13 days on). `from` is the first day it holds, `until` the
 * first day it no longer does.
 */
const Iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Text = z.string().min(1);
const ById = z.record(GwIdSchema, Text);

/**
 * Where the ruler sits (§0.1): the desk heading's "<장소> · <날짜> · <누가>
 * 서류를 들고 들어온다". The last row that holds wins (put the war HQ moves
 * after the palace). `ruler`: only for that person (Karl after Franz Joseph);
 * `trip`: the place of a trip act (`act` id) while it runs.
 * Text `persona.places.<id>`.
 */
export const GwRulerPlaceSchema = z
  .object({
    id: GwIdSchema,
    nation: z.array(z.enum(GW_TAGS)).min(1),
    ruler: GwIdSchema.optional(),
    from: Iso.optional(),
    until: Iso.optional(),
    when: GwCondSchema.optional(),
    act: GwIdSchema.optional(),
  })
  .strict();
export type GwRulerPlace = z.infer<typeof GwRulerPlaceSchema>;

/**
 * Who hands the ruler a paper (§0.2): "<누가> 올린 서류" on the desk card, and
 * the heading's <누가>. The first row that holds and fits the paper wins:
 * its scene tags, kinds, a department paper's office or form, or `private`
 * (the existing private scenes, grouped as 사사로운 것). `person`: a cast id
 * if the bearer is one; else the name is text. Text `persona.bearers.<id>` =
 * { name, manner: [3-4 lines] }.
 */
export const GwBearerSchema = z
  .object({
    id: GwIdSchema,
    nation: z.array(z.enum(GW_TAGS)).min(1),
    person: GwIdSchema.optional(),
    ruler: GwIdSchema.optional(),
    tags: z.array(z.enum(GW_SCENE_TAGS)).min(1).optional(),
    kinds: z.array(z.enum(GW_SCENE_KINDS)).min(1).optional(),
    offices: z.array(z.enum(GW_OFFICES)).min(1).optional(),
    forms: z.array(z.enum(GW_PAPER_FORMS)).min(1).optional(),
    private: z.boolean().optional(),
    from: Iso.optional(),
    until: Iso.optional(),
    when: GwCondSchema.optional(),
  })
  .strict();
export type GwBearer = z.infer<typeof GwBearerSchema>;

/** How each seat's ruler is addressed (§0.3). Text `persona.address.<key>`. */
export const GW_ADDRESS = ["majesty", "president", "premier"] as const;
export type GwAddress = (typeof GW_ADDRESS)[number];
export const GW_RULER_ADDRESS: Readonly<Partial<Record<GwTag, GwAddress>>> = {
  DEU: "majesty",
  RUS: "majesty",
  AUH: "majesty",
  FRA: "president",
  GBR: "premier",
};

/**
 * A minister's voice toward the ruler (§0.3), tried after the person and the
 * office and before the temperament in `depts.voices.<key>`: fear (anxious or
 * trust ≤ -1), flattery (cunning), bluntness (arrogant or pride ≥ 3).
 */
export const GW_RELATION_VOICES = ["fear", "flattery", "bluntness"] as const;
export type GwRelationVoice = (typeof GW_RELATION_VOICES)[number];

/**
 * What goes against the person's grain (§0.4, `GW_RULER_GRAIN`): an option
 * the lean classifier (TaskRows `leanPick` scoring) reads as `lean`, toward
 * these people or camps (`kin`: his family), and `second`: only a second
 * time (Wilhelm holding firm after blustering). It costs one nerve; at nerve
 * 0-1 it stays listed but locked. Text `persona.grain.<id>`: the `why` line in
 * his voice ("오늘은 그 말을 할 기력이 없다").
 */
export const GwGrainSchema = z
  .object({
    id: GwIdSchema,
    nation: z.array(z.enum(GW_TAGS)).min(1),
    ruler: GwIdSchema,
    lean: z.enum(GW_LEANS),
    people: z.array(GwIdSchema).min(1).optional(),
    camps: z.array(z.string()).min(1).optional(),
    kin: z.boolean().optional(),
    second: z.boolean().optional(),
    when: GwCondSchema.optional(),
  })
  .strict();
export type GwGrain = z.infer<typeof GwGrainSchema>;

/** The moments a diary line can be about (§0.6). APPEND ONLY. */
export const GW_DIARY_MOMENTS = [
  "decision",
  "death",
  "front",
  "audience",
  "family",
  "health",
  "hindsight", // an "알고 보니" line
  "filler", // the seat's filler: weather, who came, a book
] as const;
export type GwDiaryMoment = (typeof GW_DIARY_MOMENTS)[number];

/**
 * A diary line (§0.6): Nicholas's diary, Poincaré's notes, the Kaiser's
 * marginalia, Asquith's letters, Franz Joseph's letters to Schratt. `months`:
 * 1..12 for a filler by season. `theatre`: a front moment there. Text
 * `persona.diary.<id>` with {who}, {topic}, {front}, {scene}.
 */
export const GwDiaryRowSchema = z
  .object({
    id: GwIdSchema,
    nation: z.array(z.enum(GW_TAGS)).min(1),
    ruler: GwIdSchema.optional(),
    moment: z.enum(GW_DIARY_MOMENTS),
    when: GwCondSchema.optional(),
    months: z.array(z.number().int().min(1).max(12)).min(1).optional(),
    theatre: z.array(z.enum(GW_THEATRES)).min(1).optional(),
    from: Iso.optional(),
    until: Iso.optional(),
  })
  .strict();
export type GwDiaryRow = z.infer<typeof GwDiaryRowSchema>;

/** What a content file adds; content/persona/<seat>.ts exports one each. */
export interface GwPersonaContent {
  readonly places?: readonly GwRulerPlace[];
  readonly bearers?: readonly GwBearer[];
  readonly grain?: readonly GwGrain[];
  readonly diary?: readonly GwDiaryRow[];
}

export function joinPersona(
  parts: readonly GwPersonaContent[],
): GwPersonaContent {
  return {
    places: parts.flatMap((p) => p.places ?? []),
    bearers: parts.flatMap((p) => p.bearers ?? []),
    grain: parts.flatMap((p) => p.grain ?? []),
    diary: parts.flatMap((p) => p.diary ?? []),
  };
}

/** Pack `persona`: the words. Shares merge field by field. */
export const GwPersonaPackSchema = z
  .object({
    places: ById.optional(),
    bearers: z
      .record(
        GwIdSchema,
        z.object({ name: Text, manner: z.array(Text).min(1) }).strict(),
      )
      .optional(),
    address: z.partialRecord(z.enum(GW_ADDRESS), Text).optional(),
    grain: ById.optional(),
    diary: ById.optional(),
    /** The diary card's head per seat ("니콜라이의 일기"): tag -> words. */
    forms: z.partialRecord(z.enum(GW_TAGS), Text).optional(),
  })
  .strict();
export type GwPersonaPack = z.infer<typeof GwPersonaPackSchema>;

export function mergeGwPersonaPacks(
  a: GwPersonaPack | undefined,
  b: GwPersonaPack | undefined,
): GwPersonaPack | undefined {
  if (b === undefined) return a;
  if (a === undefined) return b;
  return {
    places: { ...a.places, ...b.places },
    bearers: { ...a.bearers, ...b.bearers },
    address: { ...a.address, ...b.address },
    grain: { ...a.grain, ...b.grain },
    diary: { ...a.diary, ...b.diary },
    forms: { ...a.forms, ...b.forms },
  };
}

// ---- State (seat.persona) ----

// The state lives in GreatWarTypes (seat.persona), which can't import this.
export {
  GwDiaryEntrySchema,
  gwPersonaStart,
  GwPersonaStateSchema,
} from "./GreatWarTypes";
export type { GwDiaryEntry, GwPersonaState } from "./GreatWarTypes";

// ---- Views ----

/** The desk heading (§0.1): place row, bearer row of the first paper. */
export interface GwDeskHeadView {
  place: string | null;
  bearer: string | null;
}

/** A diary line on 수첩 › 일기 and atop the next desk. */
export interface GwDiaryView {
  chapter: number;
  date: string;
  row: string;
  who: string | null;
  scene: string | null;
  theatre: string | null;
  /**
   * A "hindsight" line: the answer row and finding that proved wrong; text
   * `depts.answers.<row>.hindsight.<id>` when written, else the row's.
   */
  hindsight?: { row: string; id: string };
}

/**
 * The diary row a hindsight line falls back on when the seat has none of its
 * own (`persona.diary.gw_hindsight` in common.persona.json, with {who}).
 */
export const GW_DIARY_HINDSIGHT = "gw_hindsight";
