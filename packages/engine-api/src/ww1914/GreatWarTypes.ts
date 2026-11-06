// Great War 1914: the words of the mode and its state. Every list here is
// APPEND ONLY (scenes and snapshots name these ids). The state is plain data:
// GreatWar.snapshot() writes it as it is and hash() folds all of it, so a new
// field needs no plumbing. Never store undefined: use null. Integers only.
import { z } from "zod";
import { GW_TAGS } from "./GwCountries";

/** A content id: scene, person, flag, memory key. */
export const GwIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]*$/)
  .max(48);

export const GW_STAGES = ["crisis", "y1914", "war", "closing"] as const;
export type GwStage = (typeof GW_STAGES)[number];

/** Lobby's choice of chapter table (engine-lib/ww1914/Calendars). */
export const GW_CALENDAR_IDS = ["y1914", "full"] as const;
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

export const GW_PERSON_STATUS = ["active", "fallen", "exiled", "dead"] as const;
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
export const GW_INSTITUTIONS = ["army", "reichstag", "countersign"] as const;
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

/** The named lines of a theatre, in order of the advance. */
export const GW_LINES: Readonly<Record<GwTheatre, readonly string[]>> = {
  west: ["liege", "marne", "aisne", "somme", "hindenburg", "rhine"],
  east: ["east_prussia", "vistula", "warsaw", "riga", "dvina", "kiev"],
  balkan: ["drina", "belgrade", "nis", "salonika"],
  italy: ["isonzo", "trentino", "piave", "adige"],
  caucasus: ["kars", "erzurum", "trabzon", "van"],
  straits: ["dardanelles", "gallipoli", "narrows", "constantinople"],
  mesopotamia: ["basra", "kut", "baghdad", "mosul"],
  palestine: ["suez", "gaza", "jerusalem", "damascus"],
  sea: ["north_sea", "channel", "atlantic", "blockade"],
  colonies: ["togo", "kamerun", "southwest", "east_africa"],
};

export const GW_POSTURES = ["offensive", "hold"] as const;
export type GwPosture = (typeof GW_POSTURES)[number];
export const GW_SCALES = ["limited", "major"] as const;
export type GwScale = (typeof GW_SCALES)[number];
export const GW_RESEARCH = ["artillery", "infantry", "sea"] as const;
export type GwResearch = (typeof GW_RESEARCH)[number];

export const GwTheatreStateSchema = z.object({
  id: z.enum(GW_THEATRES),
  /** Index into GW_LINES[id]. */
  line: z.number().int(),
  /** Progress towards the next line, 0..3. */
  progress: z.number().int(),
  /** Trench stage, 0..5. */
  trench: z.number().int(),
  open: z.boolean(),
  /** The two sides by tag; null where nobody fights yet. */
  attacker: z.enum(GW_TAGS).nullable(),
  defender: z.enum(GW_TAGS).nullable(),
  /** Person commanding on the seat's side, or null. */
  commander: GwIdSchema.nullable(),
});
export type GwTheatreState = z.infer<typeof GwTheatreStateSchema>;

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
] as const;
export type GwSource = (typeof GW_SOURCES)[number];
export const GW_STAMPS = ["confirmed", "unconfirmed", "estimate"] as const;
export type GwStamp = (typeof GW_STAMPS)[number];

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
});
export type GwCard = z.infer<typeof GwCardSchema>;

export const GwAllocSchema = z.object({
  main: z.enum(GW_THEATRES),
  posture: z.enum(GW_POSTURES),
  scale: z.enum(GW_SCALES),
  /** Share sent to allies, 0..3. */
  allyShare: z.number().int(),
  research: z.enum(GW_RESEARCH),
});
export type GwAlloc = z.infer<typeof GwAllocSchema>;

export const GwPromiseSchema = z.object({
  key: GwIdSchema,
  who: GwIdSchema,
  /** Chapter it is due; a later chapter without keep_promise breaks it. */
  due: z.number().int(),
  kept: z.boolean(),
});
export type GwPromise = z.infer<typeof GwPromiseSchema>;

/** A line of the why-log: a translation key under gw.reason, with a chapter. */
export const GwReasonSchema = z.object({
  key: GwIdSchema,
  chapter: z.number().int(),
});
export type GwReason = z.infer<typeof GwReasonSchema>;

export const GwSeatStateSchema = z.object({
  /** The human's player. */
  smallID: z.number().int(),
  tag: z.enum(GW_TAGS),
  ready: z.boolean(),
  /** Summons left this chapter. */
  audiences: z.number().int(),
  desk: z.array(GwCardSchema),
  flags: z.array(GwIdSchema),
  memory: z.array(GwMemorySchema),
  promises: z.array(GwPromiseSchema),
  /** scene id -> the last chapter it was dealt. */
  seen: z.record(z.string(), z.number().int()),
  /** Scenes an effect queued: dealt from `chapter` on. */
  scheduled: z.array(
    z.object({ scene: GwIdSchema, chapter: z.number().int() }),
  ),
  alloc: GwAllocSchema,
  log: z.array(GwReasonSchema),
});
export type GwSeatState = z.infer<typeof GwSeatStateSchema>;

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
});
export type GreatWarState = z.infer<typeof GreatWarStateSchema>;
