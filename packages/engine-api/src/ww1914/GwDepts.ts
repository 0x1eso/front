// Great War 1914 (ww193, ww196): departments at work. Each office of a seat is
// a department (부서) headed by whoever holds it. ww196: the ruler gives it a
// task of a type (`GW_TASK_TYPES`); it works through the stages 착수 → 조사 →
// 초안 → 보고 and brings back its own answer (답신), built from the answer rows
// (`GwAnswerRow`) that hold and filled from state (engine-lib AnswerSlots).
// Everything it produces comes to the desk; nothing is briefed, nothing waits
// in a tray. Honours come at their occasions (`GwHonourRow`, Honours.ts).
// Engine: engine/ww1914/Departments.ts, Honours.ts. Rules: engine-lib
// ww1914/TaskRows.ts, AnswerSlots.ts. Text: pack `depts` (GwDeptPackSchema).
// Rows: content/depts/<seat>.ts.
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
  GW_ANSWER_SLOTS,
  GW_DEPT_STAGES,
  GW_HONOUR_OCCASIONS,
  GW_HONOUR_POOLS,
  GW_NEED_KINDS,
  GW_PAPER_FORMS,
  GW_QUESTIONS,
  GW_SLOT_KINDS,
  GW_STALL_REASONS,
  GW_TASK_TYPES,
  GwAnswerRedo,
  GwAnswerSlot,
  GwConfidence,
  GwDeptStage,
  GwHonourPool,
  GwPetitionAnswer,
  GwQuestion,
  GwStallReason,
  GwTaskPush,
  GwTaskType,
} from "./GwDeptWords";
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

// ---- ww196: answers (the words are in GwDeptWords.ts) ----

export * from "./GwDeptWords";

export const GwSlotValueSchema = z.object({
  kind: z.enum(GW_SLOT_KINDS),
  /** A tag, person id, theatre, place id or word id; several joined by ",". */
  value: z.string().min(1),
});
export type GwSlotValue = z.infer<typeof GwSlotValueSchema>;
export type GwSlots = Partial<Record<GwAnswerSlot, GwSlotValue>>;

/**
 * A row part that holds only while slots have these values (any listed);
 * "*" asks only that the slot is filled. Text naming a slot needs the slot.
 */
const SlotTest = z.partialRecord(
  z.enum(GW_ANSWER_SLOTS),
  z.array(z.string().min(1)).min(1),
);

/**
 * A finding (알아낸 것). Weight 1..3: band 2 drops weight 1; band 1 keeps the
 * top 2 and, 30% of the time, the row's `wrong` finding instead of one.
 * `truth`: the state that shows it later; false 2-4 chapters on, an "알고
 * 보니" line comes (P; text `depts.answers.<row>.hindsight.<id>`).
 * Text `depts.answers.<row>.findings.<id>`, with `{slot}`s.
 */
export const GwFindingRowSchema = z
  .object({
    id: GwIdSchema,
    weight: z.number().int().min(1).max(3),
    when: GwCondSchema.optional(),
    slots: SlotTest.optional(),
    /** The finding a weak head brings instead of a true one. */
    wrong: z.boolean().optional(),
    truth: GwCondSchema.optional(),
  })
  .strict();
export type GwFindingRow = z.infer<typeof GwFindingRowSchema>;

export const GwNeedSchema = z
  .object({
    kind: z.enum(GW_NEED_KINDS),
    word: GwIdSchema.optional(),
    office: z.enum(GW_OFFICES).optional(),
    tag: z.enum(GW_TAGS).optional(),
    law: GwIdSchema.optional(),
  })
  .strict();
export type GwNeed = z.infer<typeof GwNeedSchema>;

/** How a `front` course fills the war paper's proposal (marked as his). */
export const GW_FRONT_COURSES = ["attack", "hold", "shorten", "shift"] as const;

/**
 * A course (안). `lean`: how it reads to a head's lean; his department's own
 * course is the best by his lean (a lean row's `picks` may name it). `wait`:
 * the 기다린다 course an anxious head adds. `effects` run when it is taken;
 * `then`: existing papers scheduled later as consequences (never the answer).
 * Text `depts.answers.<row>.courses.<id>` = { name, for, against }.
 */
export const GwCourseRowSchema = z
  .object({
    id: GwIdSchema,
    lean: z.array(z.enum(GW_LEANS)).min(1),
    when: GwCondSchema.optional(),
    slots: SlotTest.optional(),
    wait: z.boolean().optional(),
    effects: z.array(GwEffectSchema),
    then: z.array(GwIdSchema).optional(),
    /** Chapters before the first `then` paper; absent 2. */
    thenAfter: z.number().int().min(1).max(4).optional(),
    needs: z.array(GwNeedSchema).optional(),
    front: z.enum(GW_FRONT_COURSES).optional(),
  })
  .strict();
export type GwCourseRow = z.infer<typeof GwCourseRowSchema>;

/**
 * The answer generator (ww196 §2.1): what a task of `type` can find and
 * propose. Every row that holds for the seat, the type and the topic adds its
 * findings and courses; a seat's row comes before the common one, and a
 * course id given twice keeps the first. `topic`: only these tags, theatres
 * or subjects. `question`: the one asked back at 조사. Stage lines (부서
 * 소식) are text: `depts.answers.<row>.stages.<stage>`.
 */
export const GwAnswerRowSchema = z
  .object({
    id: GwIdSchema,
    nation: z.array(z.enum(GW_TAGS)).min(1),
    type: z.enum(GW_TASK_TYPES),
    office: z.enum(GW_OFFICES).optional(),
    topic: z.array(Topic).min(1).optional(),
    when: GwCondSchema.optional(),
    stage: z.array(z.enum(GW_STAGES)).optional(),
    question: z.enum(GW_QUESTIONS).optional(),
    findings: z.array(GwFindingRowSchema),
    courses: z.array(GwCourseRowSchema),
  })
  .strict();
export type GwAnswerRow = z.infer<typeof GwAnswerRowSchema>;

// ---- ww196: honours at their occasions (§4) ----

/**
 * An order or decoration (Pour le Mérite, VC, Légion …). `rank` 1..3 orders
 * the list; `pools` who may get it; `from`/`until` ISO dates it exists in.
 * Text `depts.honours.<id>` = { name, note? }.
 */
export const GwHonourOrderSchema = z
  .object({
    id: GwIdSchema,
    nation: z.array(z.enum(GW_TAGS)).min(1),
    rank: z.number().int().min(1).max(3),
    pools: z.array(z.enum(GW_HONOUR_POOLS)).min(1),
    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    until: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .strict();
export type GwHonourOrder = z.infer<typeof GwHonourOrderSchema>;

/**
 * When a seat's honours list comes (서훈 명단). `date`: on `day` ("01-01",
 * "01-27"), the chapter that holds it; `victory`: the chapter after a front
 * won (`theatre` limits it); `deed`: after a front's battle, now and then;
 * `petition`: a department's petition between lists (서훈 상신), after a
 * victory in its field. `orders` it may give; `from` the proposing offices.
 * Text `depts.occasions.<id>` = { name, note? }.
 */
export const GwHonourRowSchema = z
  .object({
    id: GwIdSchema,
    nation: z.array(z.enum(GW_TAGS)).min(1),
    occasion: z.enum(GW_HONOUR_OCCASIONS),
    day: z
      .string()
      .regex(/^\d{2}-\d{2}$/)
      .optional(),
    theatre: z.array(z.enum(GW_THEATRES)).min(1).optional(),
    when: GwCondSchema.optional(),
    pools: z.array(z.enum(GW_HONOUR_POOLS)).min(1),
    orders: z.array(GwIdSchema).min(1),
    from: z.array(z.enum(GW_OFFICES)).min(1),
    /** ISO dates the occasion is kept in. */
    since: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    until: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .strict();
export type GwHonourRow = z.infer<typeof GwHonourRowSchema>;

/**
 * A task a department can be given. ww196: `type` names what it is about and
 * so which answer rows build its answer; a row with no `type` is a ww193 row
 * and is never offered (writers drop them). The nine common types are offered
 * without rows, to the offices of `GW_TASK_OFFICES` (TaskRows); a seat row of
 * a common type overrides that office's offer (its `when`, `from`, pace).
 */
export const GwTaskRowSchema = z
  .object({
    id: GwIdSchema,
    nation: z.array(z.enum(GW_TAGS)).min(1),
    office: z.enum(GW_OFFICES),
    /** ww196: the task type; text `depts.types.<type>` unless the row's own. */
    type: z.enum(GW_TASK_TYPES).optional(),
    /** ww193; ignored since ww196. */
    kind: z.enum(GW_TASK_KINDS).optional(),
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
    /** ww193; ignored since ww196 (§5: tasks bring their own answer). */
    products: z.array(GwIdSchema).optional(),
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
 * ww193 merge: `papers` names the papers the row is about; on those the two
 * heads need not be at odds, since the paper is the quarrel. `counter` is the
 * counter-paper `against` brings (a dispute casting both offices); without it
 * the first such dispute that holds comes, or his option is marked.
 */
export const GwDeptRivalSchema = z
  .object({
    office: z.enum(GW_OFFICES),
    against: z.array(z.enum(GW_OFFICES)).min(1).optional(),
    tags: z.array(z.enum(GW_SCENE_TAGS)).min(1).optional(),
    cost: z.boolean().optional(),
    papers: z.array(GwIdSchema).min(1).optional(),
    counter: GwIdSchema.optional(),
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
  /** ww196: gifts are gone from the audience; kept so old rows parse. */
  readonly levers?: readonly GwLeverRow[];
  /** ww196: the answer generators. */
  readonly answers?: readonly GwAnswerRow[];
  /** ww196: honours, their orders and their occasions. */
  readonly honours?: readonly GwHonourRow[];
  readonly orders?: readonly GwHonourOrder[];
}

const Text = z.string().min(1);
const ById = z.record(GwIdSchema, Text);
const Named = z.object({ name: Text, note: Text.optional() }).strict();

/**
 * ww196: an answer row's words. `title` heads the card ({topic}); findings,
 * courses and the stage lines (부서 소식, "외무부: 부쿠레슈티 공사관 전보
 * 입수") hold `{slot}`s, `{who}` and `{topic}`. `hindsight`: the "알고 보니"
 * line of a finding that proves wrong (P).
 */
export const GwAnswerTextSchema = z
  .object({
    title: Text.optional(),
    findings: ById.optional(),
    courses: z
      .record(
        GwIdSchema,
        z.object({ name: Text, for: Text, against: Text }).strict(),
      )
      .optional(),
    stages: z.partialRecord(z.enum(GW_DEPT_STAGES), Text).optional(),
    hindsight: ById.optional(),
  })
  .strict();
export type GwAnswerText = z.infer<typeof GwAnswerTextSchema>;

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
    /** ww196: task type -> how the row offers it ({topic}); a row's own wins. */
    types: z.partialRecord(z.enum(GW_TASK_TYPES), Named).optional(),
    /** ww196: answer row id -> its words. */
    answers: z.record(GwIdSchema, GwAnswerTextSchema).optional(),
    /** ww196: question -> its line ({topic}); pick id -> its words. */
    questions: z.partialRecord(z.enum(GW_QUESTIONS), Text).optional(),
    picks: ById.optional(),
    /** ww196: stall reason -> the line ({who}, {topic}). */
    stalls: z.partialRecord(z.enum(GW_STALL_REASONS), Text).optional(),
    /** ww196: a slot's word id -> the word ("중립", "바닥남"). */
    words: ById.optional(),
    /** ww196: honour order id and occasion id -> name and note. */
    honours: z.record(GwIdSchema, Named).optional(),
    occasions: z.record(GwIdSchema, Named).optional(),
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
    types: { ...a.types, ...b.types },
    answers: { ...a.answers, ...b.answers },
    questions: { ...a.questions, ...b.questions },
    picks: { ...a.picks, ...b.picks },
    stalls: { ...a.stalls, ...b.stalls },
    words: { ...a.words, ...b.words },
    honours: { ...a.honours, ...b.honours },
    occasions: { ...a.occasions, ...b.occasions },
  };
}

// ---- What the screens get ----

/** A task the department row offers now. Giving it is free (ww196). */
export interface GwTaskOfferView {
  /** The seat row, or `<type>` for a common type offered without one. */
  row: string;
  /** ww196: the type; text `depts.tasks.<row>` if any, else `depts.types`. */
  type: GwTaskType;
  /** ww193; "plan" since ww196. */
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
  /**
   * Working on: the row, its type and topic, the stage, whether the answer
   * comes next chapter; ww196: a stall's reason, the person put beside him,
   * whether it was hurried, and what the row offers (서두르게 한다 …).
   */
  task: {
    row: string | null;
    type: GwTaskType | null;
    topic: string | null;
    stage: GwDeptStage;
    soon: boolean;
    stall: GwStallReason | null;
    staff: string | null;
    hurried: boolean;
    pushes: readonly GwTaskPush[];
  } | null;
  /** ww193; 0 since ww196 (no tray). */
  ready: number;
  initiatives: number;
  /** The want shown (or its cover); null none. */
  want: string | null;
  /** What can be commissioned now (empty while busy). */
  offers: readonly GwTaskOfferView[];
  /** ww193; 0 since ww196: giving a task is free. */
  price: number;
  /** ww196: the 할 일 markers, in words (§2.8). */
  todo: readonly GwTodoView[];
  past: readonly {
    row: string | null;
    topic: string | null;
    scene: string;
    verdict: GwVerdict;
    date: string;
    /** ww196: the answer's type and the course taken. */
    type?: GwTaskType;
    course?: string | null;
  }[];
}

/**
 * ww196: a 할 일 marker (amber chip on the 부서 row, the person row and the 사람
 * tab badge): 물을 것이 있음 · 일이 멈춤: <이유> · 답신 올라옴 · 뵙기를 청함 ·
 * 부를 수 있음; `idle` (한가함 · 일을 맡길 수 있음) is muted and not counted.
 * `card`: the desk paper it is about. Text gw.ui.dept_todo_<kind>.
 */
export const GW_TODOS = [
  "question",
  "stall",
  "answer",
  "asks",
  "callable",
  "idle",
] as const;
export type GwTodo = (typeof GW_TODOS)[number];
export interface GwTodoView {
  kind: GwTodo;
  reason?: GwStallReason;
  card?: number;
}

/**
 * Who waits in the audience room (접견실), ww196 (§2.7): petitioners with
 * wants; heads who can be called about their paper (불러서 묻는다, `call` the
 * card uid); people who press (a proud head overruled twice, a rival whose
 * course lost); on a trip the front's commander, free.
 */
export interface GwRoomRowView {
  person: string;
  office: GwOffice | null;
  /** ww193; 0 since ww196. */
  brings: number;
  /** A petitioner: seeing him is the summon of `topic`. */
  petition: boolean;
  topic?: string;
  /** A person's want, if one holds (ww196: up to 3, in words). */
  want?: string | null;
  wants?: readonly string[];
  /** ww196: 불러서 묻는다 about this desk paper (order `call`). */
  call?: number;
  /** ww196: he presses to be seen. */
  press?: boolean;
  /** ww196: costs nothing (the front's commander on a trip). */
  free?: boolean;
}

/** A finding on an answer card. */
export interface GwFindingView {
  /** Answer row and finding id: text `depts.answers.<row>.findings.<id>`. */
  row: string;
  id: string;
  conf: GwConfidence;
  /** Shown only after the head was called (what he left out). */
  late?: boolean;
}

/** A course on an answer card. No effects shown: no result before the pick. */
export interface GwCourseView {
  row: string;
  id: string;
  /** Whose course: the department's own, or the rival's ("참모본부 안"). */
  by: GwOffice;
  own: boolean;
  /** Whether the case for / against is written (a cunning head leaves out). */
  for: boolean;
  against: boolean;
  needs: readonly GwNeed[];
}

/** A desk paper of the departments or the honours (`GwCardView.paper`). */
export type GwPaperView =
  | {
      form: "answer";
      office: GwOffice;
      by: string;
      type: GwTaskType;
      topic: string | null;
      /** Answer rows used: the title is the first's (`depts.answers`). */
      rows: readonly string[];
      slots: GwSlots;
      findings: readonly GwFindingView[];
      courses: readonly GwCourseView[];
      /** Called this paper's head in (불러서 묻는다) already. */
      called: boolean;
      /** Chapters it has waited; at 2 the department takes its course. */
      waited: number;
      redo: readonly GwAnswerRedo[];
    }
  | {
      form: "question";
      office: GwOffice;
      by: string;
      type: GwTaskType;
      topic: string | null;
      q: GwQuestion;
      /** Pick ids (`depts.picks`) or person ids for `person`. */
      picks: readonly string[];
      /** The head's own pick if unanswered (shown as "그에게 맡기면"). */
      lean: string | null;
    }
  | {
      form: "stall";
      office: GwOffice;
      by: string;
      type: GwTaskType;
      topic: string | null;
      reason: GwStallReason;
      pushes: readonly GwTaskPush[];
    }
  | {
      form: "news";
      lines: readonly {
        office: GwOffice;
        by: string;
        type: GwTaskType;
        topic: string | null;
        stage: GwDeptStage;
        /** The answer row whose stage line is used; null the common one. */
        row: string | null;
        slots: GwSlots;
      }[];
    }
  | {
      form: "honours";
      /** The occasion row (`depts.occasions.<id>`). */
      row: string;
      /** Last chapter the 서훈식 can be held; after it, 대행. */
      until: number;
      /** The proposers' list: who, from which pool, the honour proposed. */
      entries: readonly {
        person: string | null;
        pool: GwHonourPool;
        honour: string;
        from: GwOffice;
      }[];
      /** Orders that can be given at the ceremony. */
      orders: readonly string[];
    }
  | {
      form: "petition";
      office: GwOffice;
      by: string;
      person: string;
      honour: string;
      answers: readonly GwPetitionAnswer[];
    };

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

/** A gift the ruler can give now. ww196: never sent (gifts are gone). */
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

/** A ww193 row's papers, still called until the writers drop the row. */
function oldPapers(t: GwTaskRow): string[] {
  const fb =
    t.fallback ?? (t.kind === undefined ? undefined : `gw_dept_${t.kind}`);
  return [...(t.products ?? []), ...(fb === undefined ? [] : [fb])];
}

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
    for (const id of oldPapers(t)) {
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
  // ww193 merge: a rival row's named papers and its counter-paper.
  for (const r of c.rivals ?? []) {
    for (const id of r.papers ?? []) {
      if (!scenes.has(id)) out.push(`rival ${r.office}: no scene ${id}`);
    }
    if (r.counter === undefined) continue;
    const x = scenes.get(r.counter);
    if (x === undefined) out.push(`rival ${r.office}: no scene ${r.counter}`);
    else if (x.kind !== "dispute") {
      out.push(`rival ${r.office}: ${r.counter} is no dispute`);
    }
  }
  return out;
}

/**
 * ww193 merge: scenes the departments bring (task products, fallbacks and
 * counter-papers): called by the engine, so a `scheduledOnly` one is reached.
 */
export function gwDeptCalled(c: GwDeptContent): string[] {
  return [
    ...(c.tasks ?? []).flatMap(oldPapers),
    ...GW_PAPER_FORMS.map((f) => `gw_paper_${f}`),
    ...(c.rivals ?? []).flatMap((r) =>
      r.counter === undefined ? [] : [r.counter],
    ),
  ];
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
