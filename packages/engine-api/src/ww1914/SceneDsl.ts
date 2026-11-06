// Great War 1914 (design §5): scenes are data. These schemas check them; the
// engine runs one fixed function per kind (engine/ww1914/SceneRun.ts) and
// trusts checked data. Kind lists are APPEND ONLY. Text never lives here: it
// is in the pack (GwPack.ts), under the scene's id.
import { z } from "zod";
import {
  GW_CAMPS,
  GW_GAUGES,
  GW_INSTITUTIONS,
  GW_OFFICES,
  GW_OPENINGS,
  GW_SOURCES,
  GW_STAGES,
  GW_STAMPS,
  GW_TEMPERAMENTS,
  GW_THEATRES,
  GW_TOPICS,
  GwCamp,
  GwGauge,
  GwIdSchema,
  GwInstitution,
  GwOffice,
  GwOpening,
  GwSource,
  GwStage,
  GwTemperament,
  GwTheatre,
  GwTopic,
} from "./GreatWarTypes";
import { GW_TAGS, GwTag } from "./GwCountries";
import {
  GwWorldCond,
  GwWorldCondSchema,
  GwWorldEffect,
  GwWorldEffectSchema,
} from "./WorldDsl";

/** A person in a scene: a cast role, whoever holds an office, or a name. */
export type GwWho =
  | { role: string }
  | { office: GwOffice }
  | { person: string };

export type GwCond =
  | { kind: "all"; of: GwCond[] }
  | { kind: "any"; of: GwCond[] }
  | { kind: "not"; of: GwCond }
  | { kind: "flag"; flag: string }
  | { kind: "memory"; key: string; who?: GwWho }
  | { kind: "seen"; scene: string }
  | { kind: "chapter"; min?: number; max?: number }
  | { kind: "stage"; stage: GwStage }
  | { kind: "opening"; of: GwOpening[] }
  | { kind: "secret"; id: string }
  | { kind: "crisis"; topic: GwTopic }
  | { kind: "pressure"; topic: GwTopic; min?: number; max?: number }
  | { kind: "temp"; min?: number; max?: number }
  | { kind: "gauge"; gauge: GwGauge; min?: number; max?: number }
  | { kind: "inst"; inst: GwInstitution; min?: number; max?: number }
  | { kind: "trust"; tag: GwTag; min?: number; max?: number }
  | { kind: "at_war"; tag: GwTag }
  | { kind: "line"; theatre: GwTheatre; min?: number; max?: number }
  | { kind: "trench"; theatre: GwTheatre; min?: number; max?: number }
  | { kind: "holder"; office: GwOffice; person: string }
  | { kind: "person_trust"; who: GwWho; min?: number; max?: number }
  | { kind: "pride"; who: GwWho; min?: number; max?: number }
  | { kind: "temperament"; who: GwWho; of: GwTemperament[] }
  | { kind: "leans"; who: GwWho; camp: GwCamp }
  | { kind: "promise"; who: GwWho; key: string; kept?: boolean }
  | { kind: "world"; of: GwWorldCond };

export type GwEffect =
  | { kind: "flag"; flag: string }
  | { kind: "unflag"; flag: string }
  | { kind: "gauge"; gauge: GwGauge; delta: number }
  | { kind: "inst"; inst: GwInstitution; delta: number }
  | { kind: "temp"; delta: number }
  | { kind: "pressure"; topic: GwTopic; delta: number }
  | { kind: "trust"; tag: GwTag; delta: number }
  | { kind: "person_trust"; who: GwWho; delta: number }
  | { kind: "pride"; who: GwWho; delta: number }
  | { kind: "remember"; key: string; who?: GwWho; weight?: number }
  | { kind: "promise"; who: GwWho; key: string; chapters: number }
  | { kind: "keep_promise"; who: GwWho; key: string }
  | { kind: "schedule"; scene: string; chapters: number }
  | { kind: "delay"; days: number }
  | { kind: "audiences"; delta: number }
  | { kind: "dismiss"; who: GwWho }
  | { kind: "appoint"; who: GwWho; office: GwOffice }
  | { kind: "source"; source: GwSource; right: boolean }
  | { kind: "reason"; key: string }
  | { kind: "end"; ending: string }
  | { kind: "maybe"; when: GwCond; then: GwEffect[] }
  | { kind: "world"; of: GwWorldEffect };

const int = z.number().int();
const range = { min: int.optional(), max: int.optional() };
const tag = z.enum(GW_TAGS);
const office = z.enum(GW_OFFICES);
const topic = z.enum(GW_TOPICS);
const gauge = z.enum(GW_GAUGES);
const inst = z.enum(GW_INSTITUTIONS);
const theatre = z.enum(GW_THEATRES);
const obj = <S extends z.ZodRawShape>(kind: string, shape: S) =>
  z.object({ kind: z.literal(kind), ...shape }).strict();

export const GwWhoSchema: z.ZodType<GwWho> = z.union([
  z.object({ role: GwIdSchema }).strict(),
  z.object({ office }).strict(),
  z.object({ person: GwIdSchema }).strict(),
]);

export const GwCondSchema: z.ZodType<GwCond> = z.lazy(() =>
  z.union([
    obj("all", { of: z.array(GwCondSchema) }),
    obj("any", { of: z.array(GwCondSchema) }),
    obj("not", { of: GwCondSchema }),
    obj("flag", { flag: GwIdSchema }),
    obj("memory", { key: GwIdSchema, who: GwWhoSchema.optional() }),
    obj("seen", { scene: GwIdSchema }),
    obj("chapter", range),
    obj("stage", { stage: z.enum(GW_STAGES) }),
    obj("opening", { of: z.array(z.enum(GW_OPENINGS)) }),
    obj("secret", { id: GwIdSchema }),
    obj("crisis", { topic }),
    obj("pressure", { topic, ...range }),
    obj("temp", range),
    obj("gauge", { gauge, ...range }),
    obj("inst", { inst, ...range }),
    obj("trust", { tag, ...range }),
    obj("at_war", { tag }),
    obj("line", { theatre, ...range }),
    obj("trench", { theatre, ...range }),
    obj("holder", { office, person: GwIdSchema }),
    obj("person_trust", { who: GwWhoSchema, ...range }),
    obj("pride", { who: GwWhoSchema, ...range }),
    obj("temperament", {
      who: GwWhoSchema,
      of: z.array(z.enum(GW_TEMPERAMENTS)),
    }),
    obj("leans", { who: GwWhoSchema, camp: z.enum(GW_CAMPS) }),
    obj("promise", {
      who: GwWhoSchema,
      key: GwIdSchema,
      kept: z.boolean().optional(),
    }),
    obj("world", { of: GwWorldCondSchema }),
  ]),
) as z.ZodType<GwCond>;

export const GwEffectSchema: z.ZodType<GwEffect> = z.lazy(() =>
  z.union([
    obj("flag", { flag: GwIdSchema }),
    obj("unflag", { flag: GwIdSchema }),
    obj("gauge", { gauge, delta: int }),
    obj("inst", { inst, delta: int }),
    obj("temp", { delta: int }),
    obj("pressure", { topic, delta: int }),
    obj("trust", { tag, delta: int }),
    obj("person_trust", { who: GwWhoSchema, delta: int }),
    obj("pride", { who: GwWhoSchema, delta: int }),
    obj("remember", {
      key: GwIdSchema,
      who: GwWhoSchema.optional(),
      weight: int.optional(),
    }),
    obj("promise", { who: GwWhoSchema, key: GwIdSchema, chapters: int }),
    obj("keep_promise", { who: GwWhoSchema, key: GwIdSchema }),
    obj("schedule", { scene: GwIdSchema, chapters: int.min(0) }),
    obj("delay", { days: int.min(0) }),
    obj("audiences", { delta: int }),
    obj("dismiss", { who: GwWhoSchema }),
    obj("appoint", { who: GwWhoSchema, office }),
    obj("source", { source: z.enum(GW_SOURCES), right: z.boolean() }),
    obj("reason", { key: GwIdSchema }),
    obj("end", { ending: GwIdSchema }),
    obj("maybe", { when: GwCondSchema, then: z.array(GwEffectSchema) }),
    obj("world", { of: GwWorldEffectSchema }),
  ]),
) as z.ZodType<GwEffect>;

// ---- Scenes ----

export const GW_SCENE_KINDS = [
  "wire", // read only
  "report", // read only, carries a stamp
  "proposal", // sign or return
  "dispute", // one of two people
  "audience", // a matter of a person
  "crisis", // a link of a crisis chain
  "ledger", // the war's accounts
  "talk", // a conversation (design §5.6)
] as const;
export type GwSceneKind = (typeof GW_SCENE_KINDS)[number];

/** Scene kinds with no decision: a card closes by being read. */
export const GW_READ_ONLY_KINDS: readonly GwSceneKind[] = ["wire", "report"];

export const GW_SCENE_TAGS = [
  "foreign",
  "home",
  "war",
  "people",
  "tension_up",
  "tension_down",
] as const;

/** What the player sees of a value: "army:-1", "delay:14", or a bare word. */
const TellSchema = z.string().regex(/^[a-zA-Z_]+(?::[+-]?\d+)?$/);

/** Who fills a cast role. Append only. */
export const GwCastRuleSchema = z.union([
  z.object({ office }).strict(),
  z.object({ person: GwIdSchema }).strict(),
  /** The minister the head of state trusts least. */
  z.object({ rival: z.literal(true) }).strict(),
  /** The person a world scene is about (seat.subjects[scene id]). */
  z.object({ subject: z.literal(true) }).strict(),
]);
export type GwCastRule = z.infer<typeof GwCastRuleSchema>;

export const GwVariantSchema = z
  .object({ id: GwIdSchema, when: GwCondSchema.optional() })
  .strict();
export type GwVariant = z.infer<typeof GwVariantSchema>;

export const GwOptionSchema = z
  .object({
    id: GwIdSchema,
    /** Not met: shown greyed, with pack text `why.<id>` (design §5.6). */
    when: GwCondSchema.optional(),
    tell: z.array(TellSchema),
    effects: z.array(GwEffectSchema),
  })
  .strict();
export type GwOption = z.infer<typeof GwOptionSchema>;

export const GW_STANCES = [
  "warm",
  "cold",
  "threat",
  "flatter",
  "frank",
] as const;
export type GwStance = (typeof GW_STANCES)[number];
export const GW_REPLY_KINDS = ["ask", "push", "deal", "leave"] as const;
export type GwReplyKind = (typeof GW_REPLY_KINDS)[number];

/** How the person takes a reply: the first `when` that holds replaces next and effects. */
export const GwReactSchema = z
  .object({
    when: GwCondSchema,
    next: GwIdSchema.nullable(),
    effects: z.array(GwEffectSchema),
  })
  .strict();
export type GwReact = z.infer<typeof GwReactSchema>;

export const GwReplySchema = z
  .object({
    id: GwIdSchema,
    stance: z.enum(GW_STANCES),
    kind: z.enum(GW_REPLY_KINDS),
    when: GwCondSchema.optional(),
    /** The price shown. The person's reaction never is. */
    tell: z.array(TellSchema),
    effects: z.array(GwEffectSchema),
    /** The next node; null ends the talk. */
    next: GwIdSchema.nullable(),
    reacts: z.array(GwReactSchema).optional(),
  })
  .strict();
export type GwReply = z.infer<typeof GwReplySchema>;

export const GwNodeSchema = z
  .object({
    /** The line said here: the first variant whose `when` holds, last is the default. */
    says: z.array(GwVariantSchema).min(1),
    replies: z.array(GwReplySchema).min(1),
  })
  .strict();
export type GwNode = z.infer<typeof GwNodeSchema>;

export const GwSceneSchema = z
  .object({
    id: GwIdSchema,
    /** Countries whose desk it can reach. */
    nation: z.array(tag).min(1),
    kind: z.enum(GW_SCENE_KINDS),
    /** Stages it can come in; absent means any. */
    stage: z.array(z.enum(GW_STAGES)).optional(),
    when: GwCondSchema.optional(),
    cast: z.record(GwIdSchema, GwCastRuleSchema),
    salience: int.min(0).max(9),
    tags: z.array(z.enum(GW_SCENE_TAGS)),
    /** Dealt at most once a game. */
    once: z.boolean().optional(),
    /** Chapters before it can come again. */
    cooldown: int.min(1).optional(),
    /** Read-only report: its stamp and source. */
    stamp: z.enum(GW_STAMPS).optional(),
    source: z.enum(GW_SOURCES).optional(),
    /** The most specific first; the last, with no `when`, is the base text. */
    variants: z.array(GwVariantSchema).min(1),
    /** What a timer or a regent picks: an option's id. */
    fallback: GwIdSchema.optional(),
    options: z.array(GwOptionSchema).optional(),
    // Talk scenes only.
    /** The person spoken to: a cast role. */
    who: GwIdSchema.optional(),
    /** The player can open it from the people screen (else the desk deals it). */
    summon: z.boolean().optional(),
    start: GwIdSchema.optional(),
    nodes: z.record(GwIdSchema, GwNodeSchema).optional(),
  })
  .strict();
export type GwScene = z.infer<typeof GwSceneSchema>;

/** What the schema can't say; a content test requires an empty list. */
export function gwSceneProblems(s: GwScene): string[] {
  const out: string[] = [];
  const last = s.variants[s.variants.length - 1];
  if (last.when !== undefined) out.push(`${s.id}: last variant has a when`);
  if (s.kind === "talk") {
    if (s.who === undefined || s.cast[s.who] === undefined) {
      out.push(`${s.id}: who is not a cast role`);
    }
    const nodes = s.nodes ?? {};
    if (s.start === undefined || nodes[s.start] === undefined) {
      out.push(`${s.id}: start is not a node`);
    }
    for (const [id, n] of Object.entries(nodes)) {
      const ends = [
        ...n.replies.map((r) => r.next),
        ...n.replies.flatMap((r) => (r.reacts ?? []).map((x) => x.next)),
      ];
      for (const next of ends) {
        if (next !== null && nodes[next] === undefined) {
          out.push(`${s.id}.${id}: next ${next} is not a node`);
        }
      }
      if (n.says[n.says.length - 1].when !== undefined) {
        out.push(`${s.id}.${id}: last says has a when`);
      }
      if (n.replies.every((r) => r.when !== undefined)) {
        out.push(`${s.id}.${id}: every reply can be closed`);
      }
    }
    if (s.options !== undefined) out.push(`${s.id}: talk with options`);
  } else {
    if (s.nodes !== undefined) out.push(`${s.id}: nodes on a non-talk`);
    const read = GW_READ_ONLY_KINDS.includes(s.kind);
    if (read && (s.options ?? []).length > 0) {
      out.push(`${s.id}: read-only kind with options`);
    }
    if (!read && (s.options ?? []).length === 0) {
      out.push(`${s.id}: no options`);
    }
    if (!read && (s.options ?? []).every((o) => o.when !== undefined)) {
      out.push(`${s.id}: every option can be closed`);
    }
    const ids = (s.options ?? []).map((o) => o.id);
    if (s.fallback !== undefined && !ids.includes(s.fallback)) {
      out.push(`${s.id}: fallback is not an option`);
    }
  }
  return out;
}

// ---- Authoring helpers: scene files read like the design's examples ----

export const all = (...of: GwCond[]): GwCond => ({ kind: "all", of });
export const any = (...of: GwCond[]): GwCond => ({ kind: "any", of });
export const not = (of: GwCond): GwCond => ({ kind: "not", of });
export const flag = (f: string): GwCond => ({ kind: "flag", flag: f });
export const memory = (key: string, who?: GwWho): GwCond =>
  who === undefined ? { kind: "memory", key } : { kind: "memory", key, who };
export const role = (r: string): GwWho => ({ role: r });
export const holder = (o: GwOffice): GwCastRule => ({ office: o });
export const setFlag = (f: string): GwEffect => ({ kind: "flag", flag: f });
export const inst_ = (i: GwInstitution, delta: number): GwEffect => ({
  kind: "inst",
  inst: i,
  delta,
});
export const remember = (key: string, who?: GwWho): GwEffect =>
  who === undefined
    ? { kind: "remember", key }
    : { kind: "remember", key, who };
export const trustOf = (who: GwWho, delta: number): GwEffect => ({
  kind: "person_trust",
  who,
  delta,
});
