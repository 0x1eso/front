// Great War 1914: the words of the mode and its state. Every list here is
// APPEND ONLY (scenes and snapshots name these ids). The state is plain data:
// GreatWar.snapshot() writes it as it is and hash() folds all of it, so a new
// field needs no plumbing. Never store undefined: use null. Integers only.
import { z } from "zod";
import { GwBudgetStateSchema } from "./GwBudget";
import { GW_TAGS } from "./GwCountries";
import { GwLawStateSchema } from "./GwLaw";
import { gwPressStart, GwPressStateSchema } from "./GwPress";
import { GwPrologueStateSchema } from "./GwPrologue";
import { GwRulerStateSchema } from "./GwRuler";
import {
  GW_RIVAL_ACTS,
  GW_RIVAL_ENDS,
  gwStoryStart,
  GwStoryStateSchema,
} from "./GwStory";

/** A content id: scene, person, flag, memory key. */
export const GwIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]*$/)
  .max(48);

export const GW_STAGES = [
  "crisis",
  "y1914",
  "war",
  "closing",
  // After an armistice: the chapters of the peace, before the closing one.
  "conference",
] as const;
export type GwStage = (typeof GW_STAGES)[number];

/** Lobby's choice of chapter table (engine-lib/ww1914/Calendars). */
export const GW_CALENDAR_IDS = ["y1914", "full", "standard"] as const;
export type GwCalendarId = (typeof GW_CALENDAR_IDS)[number];

// ---- People (design §6) ----

export const GW_OFFICES = [
  "chancellor",
  "foreign",
  "chief_of_staff",
  "war",
  "navy",
  "interior",
  "finance",
  "court",
  "ambassador_london",
  "ambassador_paris",
  "ambassador_petersburg",
  "ambassador_vienna",
  "hun_pm",
  "munitions",
  "sea_lord",
  "ireland",
  "ambassador_washington",
  // Russia: nobody holds it in June 1914; empty means the Tsar leads himself.
  "supreme_commander",
  "agriculture",
] as const;
export type GwOffice = (typeof GW_OFFICES)[number];

/** Camps: a person holds one per axis of their country. */
export const GW_CAMPS = [
  "military",
  "civil",
  "east",
  "west",
  "hard",
  "moderate",
  "liberal",
  "unionist",
  "labour",
  "irish",
  // Austria-Hungary's third axis (content/people_auh).
  "magyar",
  "dynasty",
  "nations",
  // Russia: whose person they are.
  "court",
  "duma",
] as const;
export type GwCamp = (typeof GW_CAMPS)[number];

export const GW_TEMPERAMENTS = [
  "anxious",
  "cold",
  "arrogant",
  "cunning",
  "weary",
  "stubborn",
] as const;
export type GwTemperament = (typeof GW_TEMPERAMENTS)[number];

export const GW_PERSON_STATUS = [
  "active",
  "fallen",
  "exiled",
  "dead",
  // Came to the throne: now the seat itself, off every list of the cast.
  "crowned",
  // Not on the scene yet: see `arrives`. Nothing reads them but the arrival.
  "waiting",
] as const;
export type GwPersonStatus = (typeof GW_PERSON_STATUS)[number];

/** Fields of the hidden competence band, 1..3. */
export const GW_FIELDS = ["war", "politics", "admin"] as const;
export type GwField = (typeof GW_FIELDS)[number];

export const GW_TRUST_MIN = -3;
export const GW_TRUST_MAX = 3;

/** A person as written in content (engine-lib/ww1914/content/people). */
export const GwPersonDefSchema = z
  .object({
    id: GwIdSchema,
    tag: z.enum(GW_TAGS),
    /** The office held in June 1914, or null. */
    office: z.enum(GW_OFFICES).nullable(),
    /** Offices they can be appointed to. */
    fit: z.array(z.enum(GW_OFFICES)),
    camps: z.array(z.enum(GW_CAMPS)),
    /** What the seed may give them: the recorded range. */
    temperaments: z.array(z.enum(GW_TEMPERAMENTS)).min(1),
    /** Rivals and allies, by person id. */
    rivals: z.array(GwIdSchema),
    allies: z.array(GwIdSchema),
    /** 1..5, renown. */
    fame: z.number().int().min(1).max(5),
    /** Where the facts come from (the design's source line). */
    source: z.string().min(1),
    /**
     * YYYY-MM-DD: not in the game before this day (engine People.ts). Absent:
     * there from June 1914. A floor for the people screen, not a scripted
     * event, and it reads the date so that every calendar row agrees.
     */
    arrives: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    /** Off the people screen until they have come up (private stories). */
    unlisted: z.boolean().optional(),
  })
  .strict();
export type GwPersonDef = z.infer<typeof GwPersonDefSchema>;

/** What someone remembers, or the seat remembers (design §5.4). */
export const GwMemorySchema = z.object({
  key: GwIdSchema,
  /** Person it concerns; null for the seat itself. */
  who: GwIdSchema.nullable(),
  chapter: z.number().int(),
  /** Positive a favour, negative a slight; fades with the chapters. */
  weight: z.number().int(),
});
export type GwMemory = z.infer<typeof GwMemorySchema>;

export const GwPersonStateSchema = z.object({
  id: GwIdSchema,
  office: z.enum(GW_OFFICES).nullable(),
  status: z.enum(GW_PERSON_STATUS),
  temperament: z.enum(GW_TEMPERAMENTS),
  /** GW_FIELDS order, 1..3. Hidden: shows only through results. */
  competence: z.array(z.number().int()),
  /** With the head of state, GW_TRUST_MIN..GW_TRUST_MAX. */
  trust: z.number().int(),
  /** 0..5. */
  pride: z.number().int(),
  /** 1 bad .. 3 good. Hidden. */
  health: z.number().int(),
  memory: z.array(GwMemorySchema),
  /** Results in their field; what the seat sees of competence. */
  wins: z.number().int(),
  losses: z.number().int(),
  /** Chapter a resignation letter came; null with none open. */
  letter: z.number().int().nullable(),
  /** Chapter they began to fail; null when well. The warning comes first. */
  ailing: z.number().int().nullable(),
});
export type GwPersonState = z.infer<typeof GwPersonStateSchema>;

// ---- The country (design §4.1) ----

export const GW_GAUGES = [
  "shells",
  "bread",
  "money",
  "morale",
  "order",
] as const;
export type GwGauge = (typeof GW_GAUGES)[number];
export const GW_GAUGE_MAX: Readonly<Record<GwGauge, number>> = {
  shells: 3,
  bread: 3,
  money: 3,
  morale: 5,
  order: 5,
};

/** The bodies that can say no (design §6). */
export const GW_INSTITUTIONS = [
  "army",
  "reichstag",
  "countersign",
  // Britain
  "cabinet",
  "commons",
  "opposition",
  "irish",
  // Austria-Hungary; `berlin` is a debt: higher is worse.
  "hungary",
  "council",
  "nations",
  "berlin",
  // Russia
  "court",
  "stavka",
  "duma",
  "ministers",
  "soviet",
] as const;
export type GwInstitution = (typeof GW_INSTITUTIONS)[number];
export const GW_INST_MIN = -5;
export const GW_INST_MAX = 5;

export const GW_TOPICS = [
  "balkan",
  "straits",
  "colonial",
  "ireland",
  "alsace",
  "naval",
  "poland",
  "home",
] as const;
export type GwTopic = (typeof GW_TOPICS)[number];
export const GW_TEMP_MAX = 10;
export const GW_TENSION_MAX = 6;

export const GW_AI_KINDS = [
  "cautious",
  "hardline",
  "opportunist",
  "principled",
] as const;
export type GwAiKind = (typeof GW_AI_KINDS)[number];

// ---- The war ledger (design §4.2) ----

export const GW_THEATRES = [
  "west",
  "east",
  "balkan",
  "italy",
  "caucasus",
  "straits",
  "mesopotamia",
  "palestine",
  "sea",
  "colonies",
] as const;
export type GwTheatre = (typeof GW_THEATRES)[number];

export const GW_SIDES = ["central", "entente"] as const;
export type GwSide = (typeof GW_SIDES)[number];

/**
 * The named lines of a theatre, laid out on the ground: a theatre's `line`
 * goes up as GW_FRONT_UP's side advances and down as the other side does.
 * It starts at GW_FRONT_START. Scenes should name a line, not an index
 * (world cond `front`).
 */
export const GW_LINES: Readonly<Record<GwTheatre, readonly string[]>> = {
  west: ["rhine", "liege", "hindenburg", "somme", "aisne", "marne", "paris"],
  east: ["oder", "east_prussia", "vistula", "warsaw", "riga", "dvina", "kiev"],
  balkan: ["drina", "belgrade", "nis", "salonika"],
  italy: ["trentino", "isonzo", "piave", "adige"],
  caucasus: ["kars", "erzurum", "trabzon", "van"],
  straits: ["dardanelles", "gallipoli", "narrows", "constantinople"],
  mesopotamia: ["basra", "kut", "baghdad", "mosul"],
  palestine: ["suez", "gaza", "jerusalem", "damascus"],
  sea: ["blockade", "north_sea", "channel", "atlantic"],
  colonies: ["togo", "kamerun", "southwest", "east_africa"],
};

/** The side whose advance moves a theatre's line up. */
export const GW_FRONT_UP: Readonly<Record<GwTheatre, GwSide>> = {
  west: "central",
  east: "central",
  balkan: "central",
  italy: "central",
  caucasus: "entente",
  straits: "entente",
  mesopotamia: "entente",
  palestine: "entente",
  sea: "central",
  colonies: "entente",
};

/** Index into GW_LINES where a theatre's war begins. */
export const GW_FRONT_START: Readonly<Record<GwTheatre, number>> = {
  west: 1,
  east: 1,
  balkan: 0,
  italy: 1,
  caucasus: 0,
  straits: 0,
  mesopotamia: 0,
  palestine: 0,
  sea: 1,
  colonies: 0,
};

export const GW_POSTURES = ["offensive", "hold"] as const;
export type GwPosture = (typeof GW_POSTURES)[number];
export const GW_SCALES = ["limited", "major"] as const;
export type GwScale = (typeof GW_SCALES)[number];
export const GW_RESEARCH = ["artillery", "infantry", "sea"] as const;
export type GwResearch = (typeof GW_RESEARCH)[number];

/** What a chapter of a theatre came to; `quiet` means nobody attacked. */
export const GW_RESULTS = [
  "break",
  "advance",
  "stalemate",
  "repelled",
  "quiet",
] as const;
export type GwResult = (typeof GW_RESULTS)[number];

/** Germany's war plan, signed in the crisis (design §2.4). */
export const GW_PLANS = ["west", "east", "wait"] as const;
export type GwPlan = (typeof GW_PLANS)[number];

export const GW_LINE_STEP = 3;
export const GW_SEA_MAX = 10;

/** Periods of the war (engine/ww1914/Eras): each shifts what attacks can do. */
export const GW_ERAS = [
  "movement",
  "trenches",
  "material",
  "depth",
  "storm",
] as const;
export type GwEra = (typeof GW_ERAS)[number];

/** What research reaches, in GW_RESEARCH's three tracks. Text: gw.tech.<id>. */
export const GW_TECHS = [
  "gas_heavy",
  "barrage",
  "predicted_fire",
  "assault_groups",
  "tanks",
  "depth_defence",
  "infiltration",
  "mine_nets",
  "ocean_boats",
  "convoys",
] as const;
export type GwTech = (typeof GW_TECHS)[number];

/** How a war closed: which side lost, or neither. */
export const GW_ARMISTICE_KINDS = [
  "central_lost",
  "entente_lost",
  "compromise",
] as const;
export type GwArmisticeKind = (typeof GW_ARMISTICE_KINDS)[number];

/** What a head of state lays before the cabinet (engine/ww1914/Authority). */
export const GW_ISSUES = [
  "entry",
  "bef",
  "straits",
  "evacuate",
  "conscription",
  "home_rule",
  "committee",
  "flanders",
  "coalition",
  "tighten_blockade",
  "peace_talks",
] as const;
export type GwIssue = (typeof GW_ISSUES)[number];

export const GwTheatreStateSchema = z.object({
  id: z.enum(GW_THEATRES),
  /** Index into GW_LINES[id]. */
  line: z.number().int(),
  /** Progress between lines, -2..2: at +-GW_LINE_STEP the line moves. */
  progress: z.number().int(),
  /** Trench stage, 0..5. */
  trench: z.number().int(),
  open: z.boolean(),
  /** The two sides by tag; null where nobody fights yet. */
  attacker: z.enum(GW_TAGS).nullable(),
  defender: z.enum(GW_TAGS).nullable(),
  /** Person commanding on the seat's side, or null. */
  commander: GwIdSchema.nullable(),
  /** Chapter it opened; null while closed. */
  since: z.number().int().nullable(),
});
export type GwTheatreState = z.infer<typeof GwTheatreStateSchema>;

export const GwAllocSchema = z.object({
  main: z.enum(GW_THEATRES),
  posture: z.enum(GW_POSTURES),
  scale: z.enum(GW_SCALES),
  /** Share sent to allies, 0..3. */
  allyShare: z.number().int(),
  research: z.enum(GW_RESEARCH),
});
export type GwAlloc = z.infer<typeof GwAllocSchema>;

export const GwNationStateSchema = z.object({
  tag: z.enum(GW_TAGS),
  gauges: z.record(z.enum(GW_GAUGES), z.number().int()),
  /** Institutions this country has, -5..5. */
  inst: z.partialRecord(z.enum(GW_INSTITUTIONS), z.number().int()),
  /** Hidden: strength band 1..5 by theatre. */
  strength: z.partialRecord(z.enum(GW_THEATRES), z.number().int()),
  /** Trust in other countries, -3..3, by tag; absent means 0. */
  trust: z.partialRecord(z.enum(GW_TAGS), z.number().int()),
  atWar: z.array(z.enum(GW_TAGS)),
  ai: z.enum(GW_AI_KINDS),
  /** Which side it fights on; null while neutral. */
  side: z.enum(GW_SIDES).nullable(),
  /** Hidden. -1 towards the Central side (Britain: stay out), 1 the Entente. */
  lean: z.number().int(),
  /** Hidden. 0..100, how near a neutral is to coming in. */
  readiness: z.number().int(),
  /** The best price each side has offered this neutral. */
  offers: z.partialRecord(z.enum(GW_SIDES), z.number().int()),
  /** 0 peace, 1 partial, 2 general. */
  mob: z.number().int(),
  /** An AI's effort this chapter; a seat's is on the seat. */
  alloc: GwAllocSchema.nullable(),
  /** 0..100: men left to send. */
  manpower: z.number().int(),
  /** Thousands, all game. */
  casualties: z.number().int(),
  /** Thousands, this chapter. */
  lostNow: z.number().int(),
  /** 0..100: what the head of state can spend (a dismissal). */
  authority: z.number().int(),
  /** The ladder, 0..4: strikes, riots, army unrest, revolution. */
  unrest: z.number().int(),
  /** Chapters in a row with order at the bottom. */
  lowOrder: z.number().int(),
  /** Hidden. Strength the band returns to as it refills. */
  base: z.partialRecord(z.enum(GW_THEATRES), z.number().int()),
  /** Hidden. Losses towards the next band lost. */
  wear: z.partialRecord(z.enum(GW_THEATRES), z.number().int()),
  /** Chapters of research put in. */
  tech: z.partialRecord(z.enum(GW_RESEARCH), z.number().int()),
  /** Beaten or collapsed: no longer in the war. */
  out: z.boolean(),
  /** Its form of government (engine/ww1914/Regimes); "" where there is one. */
  regime: z.string(),
  /** The head of state leads the army himself. */
  command: z.boolean(),
  /** What research has reached (GW_TECHS). */
  techs: z.array(z.string()),
  /** Chapter of its last major offensive; -9 none. */
  spent: z.number().int(),
  /** Chapter it first entered the war; null while neutral. */
  entered: z.number().int().nullable(),
  /** Its money: `gauges.money` follows from this (engine/ww1914/Budget). */
  budget: GwBudgetStateSchema,
  /** Bills taken up and laws in force; a bill nobody has touched has no row. */
  laws: z.array(GwLawStateSchema),
});
export type GwNationState = z.infer<typeof GwNationStateSchema>;

// ---- Reports (design §4.5) ----

export const GW_SOURCES = [
  "embassy_london",
  "embassy_paris",
  "embassy_petersburg",
  "embassy_vienna",
  "attache",
  "staff",
  "press",
  "agents",
  "embassy_berlin",
  "embassy_rome",
  /** The seat's own eyes: a visit. Never wrong. */
  "own_eyes",
] as const;
export type GwSource = (typeof GW_SOURCES)[number];
export const GW_STAMPS = ["confirmed", "unconfirmed", "estimate"] as const;
export type GwStamp = (typeof GW_STAMPS)[number];

/** What a report is about. Text: gw.fact.<kind>.<claim>. */
export const GW_FACT_KINDS = [
  "force",
  "lean",
  "mob",
  "shells",
  "morale",
] as const;
export type GwFactKind = (typeof GW_FACT_KINDS)[number];

export const GwReportSchema = z.object({
  uid: z.number().int(),
  fact: z.enum(GW_FACT_KINDS),
  tag: z.enum(GW_TAGS),
  theatre: z.enum(GW_THEATRES).nullable(),
  source: z.enum(GW_SOURCES),
  stamp: z.enum(GW_STAMPS),
  /** What the report says. */
  claim: z.number().int(),
  /** Hidden until corrected: the truth when it was sent. */
  truth: z.number().int(),
  /** The seat it reached. */
  smallID: z.number().int(),
  chapter: z.number().int(),
  /** Day an unconfirmed report is checked; null once it has been. */
  checkDay: z.number().int().nullable(),
});
export type GwReport = z.infer<typeof GwReportSchema>;

export const GwSourceStateSchema = z.object({
  id: z.enum(GW_SOURCES),
  /** Hidden: 1 poor .. 3 good. */
  band: z.number().int(),
  right: z.number().int(),
  wrong: z.number().int(),
});
export type GwSourceState = z.infer<typeof GwSourceStateSchema>;

// ---- The seat and its desk (design §5.2, §5.6) ----

export const GW_OPENINGS = [
  "sarajevo",
  "sarajevo_survived",
  "sarajevo_failed",
  "sarajevo_delayed",
  "no_sarajevo",
] as const;
export type GwOpening = (typeof GW_OPENINGS)[number];

/** How a card reached the desk: drawn, summoned, or scheduled by an effect. */
export const GW_CARD_ORIGINS = ["desk", "summon", "scheduled"] as const;

/** "다시 써 오시오": what a paper can be sent back for (engine/ww1914/SendBack). */
export const GW_BACK_DIRECTIONS = [
  "cheaper",
  "gentler",
  "calmer",
  "kinder",
  "firmer",
] as const;
export type GwBackDirection = (typeof GW_BACK_DIRECTIONS)[number];

/** A paper that came back: what it was sent back for, whether it changed. */
export const GwBackSchema = z.object({
  direction: z.enum(GW_BACK_DIRECTIONS),
  changed: z.boolean(),
});
export type GwBack = z.infer<typeof GwBackSchema>;

/** Terms a seat can offer a country, from what the game already keeps. */
export const GW_GIVE_CLAUSES = [
  "price",
  "credit",
  "grain",
  "shells",
  "guarantee",
] as const;
export type GwGiveClause = (typeof GW_GIVE_CLAUSES)[number];
/** Terms a seat can ask of a country. */
export const GW_ASK_CLAUSES = [
  "peace",
  "join",
  "stay_out",
  "credit",
  "grain",
  "shells",
  "mediate",
] as const;
export type GwAskClause = (typeof GW_ASK_CLAUSES)[number];
/** Why a country said no, in plain words: gw.terms.why.<id>. */
export const GW_TERM_REFUSALS = [
  "too_little",
  "no_trust",
  "winning",
  "bound",
  "too_soon",
] as const;
export type GwTermRefusal = (typeof GW_TERM_REFUSALS)[number];

export const GwCardSchema = z.object({
  uid: z.number().int(),
  scene: GwIdSchema,
  /** The variant chosen when it was dealt. */
  variant: GwIdSchema,
  /** role -> person id, fixed when it was dealt. */
  cast: z.record(z.string(), GwIdSchema),
  origin: z.enum(GW_CARD_ORIGINS),
  /** A talk's current node; null for other kinds. */
  node: GwIdSchema.nullable(),
  chapter: z.number().int(),
  /** role -> the voice variant fixed when it was dealt (pack `voiceBy`). */
  voice: z.record(z.string(), GwIdSchema),
  /** A talk: what the replies have added up to with this person so far. */
  mood: z.number().int(),
  /** A talk: reason keys held back until it ends, so no reaction shows. */
  notes: z.array(GwIdSchema),
  /** A quiet card: the small scenes folded into it. */
  folded: z.array(GwIdSchema),
  /** Played from the schedule: its row in `seat.acted`. */
  act: z.number().int().nullable().default(null),
  /** A paper sent back and come again. */
  back: GwBackSchema.nullable().default(null),
});
export type GwCard = z.infer<typeof GwCardSchema>;

export const GwPromiseSchema = z.object({
  key: GwIdSchema,
  who: GwIdSchema,
  /** Chapter it is due; a later chapter without keep_promise breaks it. */
  due: z.number().int(),
  kept: z.boolean(),
  /** Past due and not kept: the person has been told so. Set once. */
  broken: z.boolean(),
  /** A GwCond as JSON: kept by itself the chapter it holds. `who` is the person. */
  keep: z.string().nullable(),
  /** The scene they come back with; null for the common one. */
  back: GwIdSchema.nullable(),
});
export type GwPromise = z.infer<typeof GwPromiseSchema>;

/**
 * A line of the why-log: pack `reasons.<key>`, else gw.reason.<key>, with a
 * chapter and the person it is about, the text's {who}.
 */
export const GwReasonSchema = z.object({
  key: GwIdSchema,
  chapter: z.number().int(),
  who: GwIdSchema.nullable().optional(),
  /** The country it is about: the text's {country}. */
  tag: z.enum(GW_TAGS).optional(),
});
export type GwReason = z.infer<typeof GwReasonSchema>;

/**
 * A threat to the seat's government (engine GovTable): how hot, how many of its
 * scenes have come, the chapter it lies quiet until, how often it was beaten.
 */
export const GwGovSchema = z.object({
  id: GwIdSchema,
  heat: z.number().int(),
  step: z.number().int(),
  rest: z.number().int(),
  beaten: z.number().int(),
});
export type GwGov = z.infer<typeof GwGovSchema>;

/** What the seat decided: an option or a reply (design §5.4). */
export const GwChoiceSchema = z.object({
  scene: GwIdSchema,
  pick: GwIdSchema,
  chapter: z.number().int(),
  /** The timer took it. */
  proxy: z.boolean(),
  /** Who was in the scene, role -> person; a reply keeps none. */
  cast: z.record(z.string(), GwIdSchema).optional(),
});
export type GwChoice = z.infer<typeof GwChoiceSchema>;
/** A gauge's move this chapter and why (a reason line of the country tab). */
export const GwLineSchema = z.object({
  gauge: z.enum(GW_GAUGES),
  /** Text: gw.line.<key>. */
  key: GwIdSchema,
  delta: z.number().int(),
  chapter: z.number().int(),
});
export type GwLine = z.infer<typeof GwLineSchema>;

/** Ways a game can end. Text: gw.ending.<id>. "closing" is the old plain end. */
export const GW_ENDINGS = [
  "closing",
  "long_peace",
  "victory_peace",
  "compromise_peace",
  "armistice_conference",
  "home_collapse",
  "deadline",
  "first_winter_ahead",
  "first_winter_level",
  "first_winter_behind",
  // Germany
  "deu_paris_dictated",
  "deu_east_won",
  "deu_peace_of_exhaustion",
  "deu_november",
  "deu_republic_signs",
  "deu_hunger_peace",
  // Britain
  "gbr_end_master",
  "gbr_end_dear_win",
  "gbr_end_compromise",
  "gbr_end_neutral",
  "gbr_end_outside",
  "gbr_end_long_peace",
  "gbr_end_island",
  "gbr_end_fell",
  "gbr_end_other_hands",
  "gbr_end_deadline",
  // Austria-Hungary
  "auh_e_long_peace",
  "auh_e_serbia_punished",
  "auh_e_victor_carried",
  "auh_e_vassal",
  "auh_e_compromise",
  "auh_e_separate_peace",
  "auh_e_federal",
  "auh_e_personal_union",
  "auh_e_dissolution",
  "auh_e_army_gone",
  "auh_e_remnant",
  "auh_e_deadline",
  // Russia
  "rus_straits_won",
  "rus_tsar_at_conference",
  "rus_provisional_holds",
  "rus_separate_peace",
  "rus_october",
  "rus_tsar_falls",
  "rus_crown_of_duma",
  "rus_boy_tsar",
  "rus_great_programme",
  "rus_serbia_abandoned",
  "rus_assembly_republic",
  "rus_civil_war",
  // The person at the desk is gone (engine/ww1914/Ruler).
  "deu_r_death",
  "deu_r_removed",
  "gbr_r_death",
  "gbr_r_removed",
  "auh_r_death",
  "auh_r_removed",
  "rus_r_death",
  "rus_r_removed",
  // Turned out by the country's own politics (engine GovTable).
  "gbr_end_turned_out",
  "gbr_end_polls",
  "deu_end_set_aside",
  "auh_e_regency",
  "rus_palace_coup",
  // Beaten at the table with the peoples still in the house.
  "auh_e_conference",
] as const;
export type GwEnding = (typeof GW_ENDINGS)[number];

/** What "이 판에서 당신이 몰랐던 것" can name. */
export const GW_UNKNOWN_KINDS = [
  "secret",
  "lean",
  "wrong_report",
  "source",
  "person",
  "ai",
  "force",
] as const;

export const GwUnknownSchema = z.object({
  kind: z.enum(GW_UNKNOWN_KINDS),
  /** A secret, a source, a person's id, or a country's tag. */
  id: z.string(),
  /** The theatre, for `force` and `wrong_report`. */
  theatre: z.enum(GW_THEATRES).nullable(),
  /** The hidden value. */
  value: z.number().int(),
  /** A word for it (GW_AI_KINDS, a fact kind), or null. */
  word: z.string().nullable(),
});
export type GwUnknown = z.infer<typeof GwUnknownSchema>;

/** The closing page's data (design §2.8). Hidden values are fair game here. */
export const GwMemoirSchema = z.object({
  ending: GwIdSchema,
  /** A closing paragraph after the ending's own, or null. */
  coda: GwIdSchema.nullable(),
  chapter: z.number().int(),
  day: z.number().int(),
  mandates: z.array(z.object({ id: GwIdSchema, met: z.boolean() })),
  /** The aim the seat stood on at the end, and those it gave up. */
  aim: z
    .object({
      id: GwIdSchema,
      met: z.boolean(),
      dropped: z.array(GwIdSchema),
    })
    .nullable()
    .default(null),
  /** The seat's own record: casualties in thousands, lines held. */
  casualties: z.number().int(),
  fronts: z.array(
    z.object({ theatre: z.enum(GW_THEATRES), line: z.number().int() }),
  ),
  /** What happened, in order. Text: gw.turn.<key>, {country} from `tag`. */
  turns: z.array(
    z.object({
      key: GwIdSchema,
      tag: z.enum(GW_TAGS).nullable(),
      chapter: z.number().int(),
    }),
  ),
  people: z.array(
    z.object({
      id: GwIdSchema,
      office: z.enum(GW_OFFICES).nullable(),
      status: z.enum(GW_PERSON_STATUS),
      trust: z.number().int(),
      wins: z.number().int(),
      losses: z.number().int(),
    }),
  ),
  /** The closing page: at most three things the seat never learned. */
  unknown: z.array(GwUnknownSchema),
  /** The rival, named at last; null where the country has none. */
  rival: z
    .object({
      who: GwIdSchema,
      stage: z.number().int(),
      act: z.enum(GW_RIVAL_ACTS).nullable(),
      end: z.enum(GW_RIVAL_ENDS).nullable(),
    })
    .nullable()
    .default(null),
  /** What this game adds to the shelf between games (the client keeps it). */
  shelf: z.object({
    ending: GwIdSchema,
    people: z.array(GwIdSchema),
    secrets: z.array(GwIdSchema),
    mandates: z.array(GwIdSchema),
  }),
});
export type GwMemoir = z.infer<typeof GwMemoirSchema>;

export const GwSeatStateSchema = z.object({
  /** The human's player. */
  smallID: z.number().int(),
  tag: z.enum(GW_TAGS),
  ready: z.boolean(),
  /** Summons left this chapter. */
  audiences: z.number().int(),
  /** Private meetings left this chapter (tag `private`). */
  privates: z.number().int(),
  desk: z.array(GwCardSchema),
  flags: z.array(GwIdSchema),
  memory: z.array(GwMemorySchema),
  promises: z.array(GwPromiseSchema),
  /** scene id -> the last chapter it was dealt. */
  seen: z.record(z.string(), z.number().int()),
  /** Scenes an effect queued: dealt from `chapter` on. */
  scheduled: z.array(
    z.object({
      scene: GwIdSchema,
      chapter: z.number().int(),
      /** Who fills its `called` role. */
      who: GwIdSchema.nullable().optional(),
      /** Played from the schedule: its row in `acted`. */
      act: z.number().int().nullable().optional(),
      /** A paper sent back, coming again. */
      back: GwBackSchema.nullable().optional(),
    }),
  ),
  alloc: GwAllocSchema,
  log: z.array(GwReasonSchema),
  /** The desk's tension curve, 0..GW_TENSION_MAX (design §5.2). */
  tension: z.number().int(),
  /** Every body dealt, as "<scene>.<variant>", in order. */
  shown: z.array(z.string()),
  /** Every option and reply taken, in order. */
  choices: z.array(GwChoiceSchema),
  /** Three tasks of this game (design §2.3 no. 7), judged at the end. */
  mandates: z.array(GwIdSchema),
  /** World secrets this seat has found. */
  known: z.array(GwIdSchema),
  /** Scene id -> the person a world scene is about (cast rule `subject`). */
  subjects: z.record(z.string(), GwIdSchema),
  /** The last big chapter (more summons); -9 none. */
  big: z.number().int(),
  /** The cabinet's votes, for the record and the reason lines. */
  votes: z.array(
    z.object({
      issue: z.enum(GW_ISSUES),
      ayes: z.number().int(),
      noes: z.number().int(),
      chapter: z.number().int(),
    }),
  ),
  /** The chapter the plan was last signed; -1 never. */
  signed: z.number().int(),
  /** Why the gauges moved, last chapters first dropped. */
  lines: z.array(GwLineSchema),
  /** What threatens the government, by row of the engine's GovTable. */
  gov: z.array(GwGovSchema),
  memoir: GwMemoirSchema.nullable(),
  /** The person at the desk (engine/ww1914/Ruler). */
  ruler: GwRulerStateSchema,
  /** The censor, the rumour, the papers (engine/ww1914/Press). A save from before it has none. */
  press: GwPressStateSchema.default(gwPressStart),
  /** Schedule slots left this chapter (원수의 일정). */
  acts: z.number().int().default(0),
  /** What the seat has started, in order. */
  acted: z
    .array(
      z.object({
        act: GwIdSchema,
        chapter: z.number().int(),
        /** Field id -> what was picked: option ids or person ids. */
        picks: z.record(z.string(), z.array(GwIdSchema)),
      }),
    )
    .default([]),
  /** The declared aim of this war or reign (국가 목표); null none yet. */
  aim: GwIdSchema.nullable().default(null),
  /** Every aim given up, in order. */
  aimsDropped: z
    .array(z.object({ id: GwIdSchema, chapter: z.number().int() }))
    .default([]),
  /** Papers sent back, in order: "다시 써 오시오". */
  returns: z
    .array(
      z.object({
        scene: GwIdSchema,
        direction: z.enum(GW_BACK_DIRECTIONS),
        chapter: z.number().int(),
        changed: z.boolean(),
        who: GwIdSchema.nullable(),
      }),
    )
    .default([]),
  /** Terms offered to other countries, and their answers. */
  terms: z
    .array(
      z.object({
        tag: z.enum(GW_TAGS),
        give: z.array(z.enum(GW_GIVE_CLAUSES)),
        ask: z.array(z.enum(GW_ASK_CLAUSES)),
        chapter: z.number().int(),
        /** Null until the chapter closes. */
        yes: z.boolean().nullable(),
        why: z.enum(GW_TERM_REFUSALS).nullable(),
      }),
    )
    .default([]),
  /** The rival, the letters, the desk's pace (GwStory.ts). */
  story: GwStoryStateSchema.default(gwStoryStart),
  /** Absent unless the lobby asked for a prologue (GwPrologue.ts). */
  prologue: GwPrologueStateSchema.optional(),
});
export type GwSeatState = z.infer<typeof GwSeatStateSchema>;

/** World secrets (design §4.4): each is there or not in a game. */
export const GW_SECRETS = [
  "ita_fra_understanding",
  "rus_rail_ahead",
  "ott_fleet_late",
  "fra_offensive_doctrine",
  "bel_forts_strong",
  "auh_rail_muddle",
  "deu_shell_stock_thin",
  "rou_treaty_dead",
  "jpn_tsingtao_plan",
  "anglo_russian_naval_talks",
  "srb_officers_plot",
  "bgr_loan_berlin",
  "auh_redl_plans",
  "auh_hun_grain_hidden",
  "auh_czech_regiments_sound",
  "auh_sixtus_copy",
  "gbr_wilson_leaks",
  "gbr_haig_letters",
  "gbr_sailings_count",
  "deu_zimmermann_wire",
  "fra_army_refusals",
  "ott_forts_short",
  "usa_credit_cliff",
  "rus_garrison_rotten",
  "rus_palace_plot",
  "rus_german_feeler",
  "rus_myasoedov_spy",
  "deu_table_wrong",
  "deu_heir_ring",
  "deu_tirpitz_press",
  "deu_food_books",
  "deu_fleet_plan_oct",
  "ita_price_list",
  "bgr_macedonia_signed",
  "rou_shell_gap",
  "grc_king_letters",
  "ott_peace_feelers",
  "jpn_china_list",
] as const;
export type GwSecret = (typeof GW_SECRETS)[number];

/** Secrets only one seat's country can find: off every other shelf. */
const GW_SECRET_SEATS: Readonly<Partial<Record<GwSecret, string>>> = {
  auh_redl_plans: "AUH",
  auh_hun_grain_hidden: "AUH",
  auh_czech_regiments_sound: "AUH",
  auh_sixtus_copy: "AUH",
  gbr_wilson_leaks: "GBR",
  gbr_haig_letters: "GBR",
  gbr_sailings_count: "GBR",
  rus_garrison_rotten: "RUS",
  rus_palace_plot: "RUS",
  rus_german_feeler: "RUS",
  rus_myasoedov_spy: "RUS",
  deu_table_wrong: "DEU",
  deu_heir_ring: "DEU",
  deu_tirpitz_press: "DEU",
  deu_food_books: "DEU",
  deu_fleet_plan_oct: "DEU",
};

/** The secrets a seat of this country can come to know. */
export function gwSecretsFor(tag: string): readonly GwSecret[] {
  return GW_SECRETS.filter((id) => (GW_SECRET_SEATS[id] ?? tag) === tag);
}

/**
 * Flags the world sets on every seat (`flag` conds read them, scene plan §1):
 * what the AI and the fronts did, which a scene can't set for itself.
 */
export const GW_WORLD_FLAGS = [
  "w_ultimatum_out",
  "w_aut_at_war",
  "w_rus_partial",
  "w_rus_general",
  "w_tannenberg",
  "w_marne_stopped",
  "w_bad_luck_east",
  "w_summer_war",
  "w_serbia_fallen",
  "w_italy_in",
  "w_america_in",
  "w_russia_out",
  "w_unrestricted",
  "w_liner_sunk",
  "w_france_falling",
  "w_auh_karl",
  "w_auh_ff_throne",
  "w_auh_sturgkh_shot",
  "w_ottoman_in",
  "w_romania_in",
  "w_warsaw_lost",
  "w_german_offer",
  // Friends' treaties: set when multiplayer lands, so solo never reads them.
  "w_treaty_kept",
  "w_treaty_broken",
  "w_treaty_leaked",
  "w_treaty_i_broke",
] as const;
export type GwWorldFlag = (typeof GW_WORLD_FLAGS)[number];

/** Long threads (design §2.6): three run hot in a game. */
export const GW_THREADS = [
  "ireland",
  "rus_rail",
  "us_loans",
  "poland",
  "reichstag_left",
  "alsace_unrest",
  "naval_race",
  "baghdad_rail",
] as const;
export type GwThread = (typeof GW_THREADS)[number];

export const GW_CHAIN_OUTCOMES = [
  "war",
  "compromise",
  "humiliation",
  "fizzled",
] as const;
export type GwChainOutcome = (typeof GW_CHAIN_OUTCOMES)[number];

/** An open crisis (design §4.3): one link per chapter. */
export const GwChainSchema = z.object({
  topic: z.enum(GW_TOPICS),
  /** Index into the crisis's links (eng/ww1914/Crises). */
  step: z.number().int(),
  /** Chapters the next link waits. */
  hold: z.number().int(),
  /** A spark's short chain, not July's. */
  short: z.boolean(),
});
export type GwChain = z.infer<typeof GwChainSchema>;

/** The fighting has stopped; the conference is the next chapter. */
export const GwArmisticeSchema = z.object({
  kind: z.enum(GW_ARMISTICE_KINDS),
  chapter: z.number().int(),
  /** Who asked first; null when both were spent. */
  by: z.enum(GW_TAGS).nullable(),
});
export type GwArmistice = z.infer<typeof GwArmisticeSchema>;

export const GwChainEndSchema = z.object({
  topic: z.enum(GW_TOPICS),
  outcome: z.enum(GW_CHAIN_OUTCOMES),
  chapter: z.number().int(),
});

export const GwBattleSchema = z.object({
  theatre: z.enum(GW_THEATRES),
  chapter: z.number().int(),
  result: z.enum(GW_RESULTS),
  /** The attacking side; null when quiet. */
  by: z.enum(GW_SIDES).nullable(),
  /** Thousands lost, in GW_SIDES order. */
  lost: z.array(z.number().int()),
  /** The theatre's line after it. */
  line: z.number().int(),
  /** The roll went against the attacker (or for it): "운이 나빴다". */
  luck: z.number().int(),
});
export type GwBattle = z.infer<typeof GwBattleSchema>;

/** A line of the ticker. Text: gw.news.<key>, with {a}, {b}, {theatre}. */
export const GwNewsSchema = z.object({
  key: GwIdSchema,
  chapter: z.number().int(),
  a: z.enum(GW_TAGS).nullable(),
  b: z.enum(GW_TAGS).nullable(),
  theatre: z.enum(GW_THEATRES).nullable(),
});
export type GwNews = z.infer<typeof GwNewsSchema>;

/** All of the mode's state. Version bumps go through GreatWarSnapshot. */
export const GreatWarStateSchema = z.object({
  seed: z.number().int(),
  rolled: z.boolean(),
  calendar: z.enum(GW_CALENDAR_IDS),
  /** Index into the calendar. */
  chapter: z.number().int(),
  /** Days added to the calendar's dates (a delay, a late opening). */
  dayShift: z.number().int(),
  /** daysFromCivil of the chapter's date. */
  day: z.number().int(),
  /** Tick the chapter closes at; null with no timer (solo). */
  deadlineTick: z.number().int().nullable(),
  /** The ending's id once the game closed. */
  ended: GwIdSchema.nullable(),
  opening: z.enum(GW_OPENINGS),
  /** Crisis temperature, 0..GW_TEMP_MAX. */
  temp: z.number().int(),
  /** The open crisis's topic. */
  crisis: z.enum(GW_TOPICS).nullable(),
  pressure: z.record(z.enum(GW_TOPICS), z.number().int()),
  /** World secrets present in this game (design §4.4). */
  secrets: z.array(GwIdSchema),
  sources: z.array(GwSourceStateSchema),
  nations: z.array(GwNationStateSchema),
  people: z.array(GwPersonStateSchema),
  theatres: z.array(GwTheatreStateSchema),
  seats: z.array(GwSeatStateSchema),
  /** The next card uid. */
  nextCard: z.number().int(),
  chain: GwChainSchema.nullable(),
  /** Crises that closed, in order. */
  chains: z.array(GwChainEndSchema),
  /** A spark waiting to light: its topic and chapter. */
  spark: z
    .object({ topic: z.enum(GW_TOPICS), chapter: z.number().int() })
    .nullable(),
  /** The long threads hot in this game (design §2.6). */
  threads: z.array(z.enum(GW_THREADS)),
  plan: z.enum(GW_PLANS).nullable(),
  /** Germany stayed out of its ally's war. */
  aside: z.boolean(),
  /** Submarine war, 0 cruiser rules, 1 restricted, 2 unrestricted. */
  uboat: z.number().int(),
  /** Chapter the great war began; null at peace. */
  warChapter: z.number().int().nullable(),
  /** How tight the blockade is, 0..GW_SEA_MAX. */
  blockade: z.number().int(),
  /** What the submarines have cost Britain's shipping, 0..GW_SEA_MAX. */
  shipping: z.number().int(),
  armistice: GwArmisticeSchema.nullable(),
  /** The conference's date, once an armistice brought it forward. */
  closingDay: z.number().int().nullable(),
  /** Chapters of the peace conference still to run, after an armistice. */
  conferenceLeft: z.number().int(),
  /** Chapter a peace offer was last made; -9 none. */
  talks: z.number().int(),
  reports: z.array(GwReportSchema),
  nextReport: z.number().int(),
  battles: z.array(GwBattleSchema),
  news: z.array(GwNewsSchema),
});
export type GreatWarState = z.infer<typeof GreatWarStateSchema>;
