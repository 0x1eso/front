// Great War 1914 (ww193): departments at work. Each office of a seat is a
// department (부서) headed by whoever holds it. The ruler commissions work
// (`GwTaskRow`); the department brings back the first of the row's existing
// papers that holds, else a common report `gw_dept_<kind>`. Office-authored
// papers the desk draws go to the head's in-tray as the department's own
// initiatives. The head presents all he brings in one briefing (접견실).
// Engine: engine/ww1914/Departments.ts. Rules: engine-lib/ww1914/TaskRows.ts.
// Text: pack `depts` (GwDeptPackSchema). Rows: content/depts/<seat>.ts.
import { z } from "zod";
import {
  GW_CAMPS,
  GW_OFFICES,
  GW_STAGES,
  GW_THEATRES,
  GwIdSchema,
  GwOffice,
  GwStamp,
  GwVerdict,
} from "./GreatWarTypes";
import { GW_TAGS } from "./GwCountries";
import {
  GW_SCENE_TAGS,
  GwCondSchema,
  GwEffectSchema,
  GwScene,
} from "./SceneDsl";

/** What the ruler asks of a department. APPEND ONLY. Text: gw.dept.kind.<id>. */
export const GW_TASK_KINDS = [
  "plan", // 안을 짜 오시오: a country, a front, the fleet
  "study", // 조사해 오시오: shells, food, manpower, a strike, morale
  "terms", // 조건을 마련하시오: a separate peace, a loan, an alliance
  "bill", // 법안을 쓰시오: a tax, conscription
  "report", // 보고하시오: the police on the strikes, intelligence on a country
] as const;
export type GwTaskKind = (typeof GW_TASK_KINDS)[number];

/** A topic the player picks when commissioning: a country or a front. */
export const GW_TASK_PICKS = ["country", "front"] as const;
export type GwTaskPick = (typeof GW_TASK_PICKS)[number];

/**
 * How a department leans on a paper with options (TaskRows `leanPick`): the
 * option it marks as its own ("외무부 안"). APPEND ONLY.
 */
export const GW_LEANS = [
  "firm", // the hard line: costs to others, pressure up, refusals
  "gentle", // gives way: least temperature, pressure and trust spent
  "cheap", // spares the treasury
  "calm", // spares order, morale, opinion and the institutions
  "wait", // puts it off: wait, hold, later
  "bold", // the biggest gain, whatever it costs
] as const;
export type GwLean = (typeof GW_LEANS)[number];

/** A gift the ruler gives in an audience. APPEND ONLY. Text: gw.dept.lever.<id>. */
export const GW_LEVERS = ["honour", "post", "purse", "pardon"] as const;
export type GwLever = (typeof GW_LEVERS)[number];

/** When a head speaks: pack `depts.voices.<key>.<moment>`. APPEND ONLY. */
export const GW_DEPT_MOMENTS = [
  "bring", // presents commissioned work
  "initiative", // presents the department's own paper
  "task", // takes a commission
  "acted", // the line when the department acted on its own (대행)
  "overruled", // the ruler chose another option
  "passed", // the work went to another department
] as const;
export type GwDeptMoment = (typeof GW_DEPT_MOMENTS)[number];

const Topic = z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/);

/** A commission a department can be given (GW_TASKS; design §4.2). */
export const GwTaskRowSchema = z
  .object({
    id: GwIdSchema,
    nation: z.array(z.enum(GW_TAGS)).min(1),
    office: z.enum(GW_OFFICES),
    kind: z.enum(GW_TASK_KINDS),
    stage: z.array(z.enum(GW_STAGES)).optional(),
    /** State opens it: not met, it isn't offered. */
    when: GwCondSchema.optional(),
    /**
     * A fixed topic: a tag ("ROU"), a theatre ("west") or a subject word
     * ("shells", text `depts.topics.<id>`). Absent with no `pick`: none.
     */
    topic: Topic.optional(),
    /** The player picks the topic; `from` limits the list. */
    pick: z.enum(GW_TASK_PICKS).optional(),
    from: z.array(Topic).min(1).optional(),
    /** Base chapters of work, 1..3, before the head's own pace. */
    chapters: z.number().int().min(1).max(3),
    /**
     * Existing scene ids, in order: the first that holds now and is unseen (or
     * can come again) is what he brings. Any kind but a talk; `scheduledOnly`
     * papers are fine, the department is what brings them.
     */
    products: z.array(GwIdSchema),
    /** A scene of its own when none holds; absent: `gw_dept_<kind>`. */
    fallback: GwIdSchema.optional(),
    /** Given at most once a game. */
    once: z.boolean().optional(),
    /** Chapters after it was last given before it is offered again; absent 2. */
    cooldown: z.number().int().min(0).optional(),
  })
  .strict();
export type GwTaskRow = z.infer<typeof GwTaskRowSchema>;

/**
 * The option a department marks (design §4.3 camp). The first row that fits
 * the seat, the office and the head's camps wins; a row with no `camp` fits
 * any head. `picks`: scene id -> option id, over the lean, for papers where
 * the writer knows the department's line.
 */
export const GwDeptLeanSchema = z
  .object({
    nation: z.array(z.enum(GW_TAGS)).min(1),
    office: z.enum(GW_OFFICES),
    camp: z.enum(GW_CAMPS).optional(),
    lean: z.enum(GW_LEANS),
    picks: z.record(GwIdSchema, GwIdSchema).optional(),
  })
  .strict();
export type GwDeptLean = z.infer<typeof GwDeptLeanSchema>;

/**
 * Who comes with a counter-paper (GW_DEPT_RIVALS): `office`'s papers bring
 * `against`'s head when the two heads are rivals, feuding or in opposing camps.
 * `tags`: only papers with one of these tags. `cost`: only papers that spend
 * money, and then `against` absent means any office.
 */
export const GwDeptRivalSchema = z
  .object({
    office: z.enum(GW_OFFICES),
    against: z.array(z.enum(GW_OFFICES)).min(1).optional(),
    tags: z.array(z.enum(GW_SCENE_TAGS)).min(1).optional(),
    cost: z.boolean().optional(),
  })
  .strict();
export type GwDeptRival = z.infer<typeof GwDeptRivalSchema>;

/**
 * What a department or a person wants, in words: "외무부가 바라는 것: 루마니아에
 * 양보". The first that holds is shown. A cunning head shows `cover` until the
 * dossier has a file on him. Text: `depts.wants.<id>`.
 */
export const GwDeptWantSchema = z
  .object({
    id: GwIdSchema,
    nation: z.array(z.enum(GW_TAGS)).min(1),
    /** A department's want; else `person`'s own. One of the two. */
    office: z.enum(GW_OFFICES).optional(),
    person: GwIdSchema.optional(),
    when: GwCondSchema.optional(),
    cover: GwIdSchema.optional(),
  })
  .strict();
export type GwDeptWant = z.infer<typeof GwDeptWantSchema>;

/** Who a lever can go to. */
export const GW_LEVER_PEOPLE = ["cabinet", "own"] as const;

/**
 * A gift (honours, posts, the purse, pardons): one per person a chapter, to
 * someone met this chapter. Effects run with the role `who` as the receiver;
 * the engine adds a trust step for him and takes one from each of his rivals.
 * `scene`: a paper laid on the desk at once (an investiture, a reply).
 * Text: `depts.levers.<id>`.
 */
export const GwLeverRowSchema = z
  .object({
    id: GwIdSchema,
    nation: z.array(z.enum(GW_TAGS)).min(1),
    lever: z.enum(GW_LEVERS),
    when: GwCondSchema.optional(),
    people: z.enum(GW_LEVER_PEOPLE).optional(),
    once: z.boolean().optional(),
    effects: z.array(GwEffectSchema),
    scene: GwIdSchema.optional(),
  })
  .strict();
export type GwLeverRow = z.infer<typeof GwLeverRowSchema>;

/** What a content file adds; content/depts/<seat>.ts exports one each. */
export interface GwDeptContent {
  readonly tasks?: readonly GwTaskRow[];
  readonly leans?: readonly GwDeptLean[];
  readonly rivals?: readonly GwDeptRival[];
  readonly wants?: readonly GwDeptWant[];
  readonly levers?: readonly GwLeverRow[];
}

const Text = z.string().min(1);
const ById = z.record(GwIdSchema, Text);

/** Pack `depts`: the words of the departments. Shares merge field by field. */
export const GwDeptPackSchema = z
  .object({
    /** Office -> the department's name on this seat ("외무부"). */
    names: z.partialRecord(z.enum(GW_OFFICES), Text).optional(),
    /** Task row id -> how the department row offers it. No result. */
    tasks: z
      .record(GwIdSchema, z.object({ name: Text, note: Text.optional() }))
      .optional(),
    /** Subject topic id -> its word ("포탄"); tags and theatres have their own. */
    topics: ById.optional(),
    /** Want id (and cover id) -> the line. */
    wants: ById.optional(),
    /** Lever row id -> its name and a plain note. */
    levers: z
      .record(GwIdSchema, z.object({ name: Text, note: Text.optional() }))
      .optional(),
    /**
     * Voice key -> moment -> the line. The key is tried as the person id, then
     * the office, then the temperament (GwDeptView.voice); the first with the
     * moment is used. May hold {who} (the head) and {topic}.
     */
    voices: z.record(z.string().regex(/^[a-z][a-z0-9_]*$/), ById).optional(),
  })
  .strict();
export type GwDeptPack = z.infer<typeof GwDeptPackSchema>;

/** Later shares add to earlier ones, entry by entry. */
export function mergeGwDeptPacks(
  a: GwDeptPack | undefined,
  b: GwDeptPack | undefined,
): GwDeptPack | undefined {
  if (b === undefined) return a;
  if (a === undefined) return b;
  const voices: Record<string, Record<string, string>> = { ...a.voices };
  for (const [k, v] of Object.entries(b.voices ?? {})) {
    voices[k] = { ...voices[k], ...v };
  }
  return {
    names: { ...a.names, ...b.names },
    tasks: { ...a.tasks, ...b.tasks },
    topics: { ...a.topics, ...b.topics },
    wants: { ...a.wants, ...b.wants },
    levers: { ...a.levers, ...b.levers },
    voices,
  };
}

// ---- What the screens get ----

/** A task the department row offers now. */
export interface GwTaskOfferView {
  row: string;
  kind: GwTaskKind;
  /** The topic list to pick from; empty: the row's own `topic` (or none). */
  topics: readonly string[];
  topic: string | null;
}

/** One department on 사람 › 부서. */
export interface GwDeptView {
  office: GwOffice;
  /** The head; null when the office is empty (no work, no tray). */
  head: string | null;
  /** Pack voice keys to try, in order: person, office, temperament. */
  voice: readonly string[];
  /** Working on: the row, its topic, and whether it is ready next chapter. */
  task: { row: string | null; topic: string | null; soon: boolean } | null;
  /** Papers waiting in the tray: commissioned, and its own. */
  ready: number;
  initiatives: number;
  /** The want shown (or its cover); null none. */
  want: string | null;
  /** What can be commissioned now (empty while busy). */
  offers: readonly GwTaskOfferView[];
  /** Time a written order costs now: 0 after a briefing this chapter. */
  price: number;
  past: readonly {
    row: string | null;
    topic: string | null;
    scene: string;
    verdict: GwVerdict;
    date: string;
  }[];
}

/** Who waits in the audience room (접견실). */
export interface GwRoomRowView {
  person: string;
  office: GwOffice | null;
  /** Papers he brings; 0 for a petitioner. */
  brings: number;
  /** A petitioner: seeing him is the summon of `topic`. */
  petition: boolean;
  topic?: string;
  /** A person's want, if one holds. */
  want?: string | null;
}

/** A department's mark on a desk card. */
export interface GwCardDeptView {
  office: GwOffice;
  by: string;
  option: string | null;
  /** 1 자신 없음, 2 대체로, 3 확신: the head's band in the field. */
  confidence: number;
  rival: { office: GwOffice; by: string; option: string | null } | null;
  counter: boolean;
  initiative: boolean;
  row: string | null;
  topic: string | null;
  /** A report's stamp by his band, over the scene's own. */
  stamp: GwStamp | null;
  /** Chapters it has waited unheard. */
  waited: number;
}

/** A gift the ruler can give now. */
export interface GwLeverView {
  row: string;
  lever: GwLever;
  /** People it can go to now: met this chapter, not yet given one. */
  people: readonly string[];
}

/** The one time pool (남은 일정). */
export interface GwTimeView {
  left: number;
  /** On a trip this chapter: the room is shut. */
  away: boolean;
  /** Carried from last chapter. */
  carry: number;
}

// ---- Content checks ----

/** What the schema can't say; a content test requires an empty list. */
export function gwDeptProblems(
  c: GwDeptContent,
  scenes: ReadonlyMap<string, GwScene>,
): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  for (const t of c.tasks ?? []) {
    if (ids.has(t.id)) out.push(`task ${t.id} twice`);
    ids.add(t.id);
    if (t.pick === undefined && t.from !== undefined) {
      out.push(`task ${t.id}: from without pick`);
    }
    if (t.pick !== undefined && t.topic !== undefined) {
      out.push(`task ${t.id}: topic and pick`);
    }
    if (t.pick === "front") {
      for (const x of t.from ?? []) {
        if (!(GW_THEATRES as readonly string[]).includes(x)) {
          out.push(`task ${t.id}: ${x} is no theatre`);
        }
      }
    }
    if (t.pick === "country") {
      for (const x of t.from ?? []) {
        if (!(GW_TAGS as readonly string[]).includes(x)) {
          out.push(`task ${t.id}: ${x} is no country`);
        }
      }
    }
    for (const id of [...t.products, t.fallback ?? `gw_dept_${t.kind}`]) {
      const s = scenes.get(id);
      if (s === undefined) out.push(`task ${t.id}: no scene ${id}`);
      else if (s.kind === "talk") out.push(`task ${t.id}: ${id} is a talk`);
      else if (!t.nation.every((n) => s.nation.includes(n))) {
        out.push(`task ${t.id}: ${id} isn't for all of its nations`);
      }
    }
  }
  for (const l of c.leans ?? []) {
    for (const [scene, opt] of Object.entries(l.picks ?? {})) {
      const s = scenes.get(scene);
      if (s === undefined) out.push(`lean ${l.office}: no scene ${scene}`);
      else if (!(s.options ?? []).some((o) => o.id === opt)) {
        out.push(`lean ${l.office}: ${scene} has no option ${opt}`);
      }
    }
  }
  for (const w of c.wants ?? []) {
    if ((w.office === undefined) === (w.person === undefined)) {
      out.push(`want ${w.id}: one of office, person`);
    }
  }
  for (const v of c.levers ?? []) {
    if (v.scene !== undefined && !scenes.has(v.scene)) {
      out.push(`lever ${v.id}: no scene ${v.scene}`);
    }
  }
  return out;
}

/** What the pack lacks for the rows; a content test requires an empty list. */
export function gwDeptPackProblems(
  c: GwDeptContent,
  pack: GwDeptPack | undefined,
): string[] {
  const out: string[] = [];
  for (const t of c.tasks ?? []) {
    if (pack?.tasks?.[t.id] === undefined) out.push(`task ${t.id}: no text`);
  }
  for (const w of c.wants ?? []) {
    for (const id of [w.id, ...(w.cover === undefined ? [] : [w.cover])]) {
      if (pack?.wants?.[id] === undefined) out.push(`want ${id}: no text`);
    }
  }
  for (const v of c.levers ?? []) {
    if (pack?.levers?.[v.id] === undefined) out.push(`lever ${v.id}: no text`);
  }
  return out;
}
