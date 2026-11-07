// Great War 1914: the text pack format, resources/ww1914/ko/<file>.json.
// One file per country plus common.json; the client fetches common and the
// seat's country (shared/ww1914/GwPackLoader). The engine never reads a pack.
//
// Text may hold {role} (the cast's name), {role.title} (their office), {date},
// and two callbacks: {mem.<key>} is the date of that memory, {chose.<scene>}
// the date of that decision. A reason line holds {who}. Josa markers follow
// src/client/Josa.ts: {cos}이(가).
import { z } from "zod";
import { GwIdSchema } from "./GreatWarTypes";
import { gwSceneEffects } from "./SceneCheck";
import type { GwScene } from "./SceneDsl";

const Text = z.string().min(1);
const ById = z.record(GwIdSchema, Text);

export const GwNodePackSchema = z
  .object({
    /** says variant id -> text. */
    says: ById,
    /** person id -> says variant id -> text; wins over `says`. */
    saysBy: z.record(GwIdSchema, ById).optional(),
    /** reply id -> text. */
    replies: ById,
    /** A big scene: the hour here, "밤 열한 시". */
    at: Text.optional(),
    /** A big scene: a line of narration before this node's words. */
    room: Text.optional(),
  })
  .strict();

export const GwScenePackSchema = z
  .object({
    title: Text,
    /** variant id -> text. */
    text: ById,
    /** option id -> text. */
    opt: ById.optional(),
    /** variant id -> option id -> text: that body's own wording; wins over `opt`. */
    optBy: z.record(GwIdSchema, ById).optional(),
    /** option id -> why it is greyed. */
    why: ById.optional(),
    /** cast role -> person id -> that person's paragraph. */
    voice: z.record(GwIdSchema, ById).optional(),
    /** cast role -> person id -> voice variant id -> paragraph; wins over `voice`. */
    voiceBy: z.record(GwIdSchema, z.record(GwIdSchema, ById)).optional(),
    /** node id -> its lines. */
    nodes: z.record(GwIdSchema, GwNodePackSchema).optional(),
    /** A summonable talk's topic as listed on the people screen. */
    topic: Text.optional(),
    /**
     * The secretary's note at the top of a card or talk: one line saying what
     * this paper is. A string, or a map by variant id with a `base` row. Never
     * required.
     */
    brief: z.union([Text, z.record(GwIdSchema, Text)]).optional(),
    /**
     * The line a paper sent back comes again with: direction -> text, or `dug`
     * when the author would not change it. Absent: the rule's own line.
     */
    back: ById.optional(),
  })
  .strict();
export type GwScenePack = z.infer<typeof GwScenePackSchema>;

export const GwPersonPackSchema = z
  .object({
    name: Text,
    /** The one-line lean on the people screen. */
    lean: Text,
    bio: Text.optional(),
  })
  .strict();
export type GwPersonPack = z.infer<typeof GwPersonPackSchema>;

/** Three lines, low to sound, for one side of a ruler's card. */
const Bands = z.tuple([Text, Text, Text]);

/** A ruler card's words: pack `rulers.<row id>`. */
export const GwRulerPackSchema = z
  .object({
    name: Text,
    health: Bands,
    family: Bands,
    conscience: Bands,
    reputation: Bands,
    /** Stands for `conscience` once it has given out. */
    broken: Text,
    /**
     * Once it has, a decision with no body of its own ends on one of these:
     * how that person now takes a paper. Hand-written, one per card.
     */
    after: z.array(Text).min(5),
  })
  .strict();
export type GwRulerPack = z.infer<typeof GwRulerPackSchema>;

/**
 * A dictionary entry (hud/ww1914/GwDict): `terms` are how text writes it. An
 * entry with `secret` doesn't exist for a seat that hasn't found that secret;
 * `more` adds a line once its secret is found.
 */
export const GwDictEntrySchema = z
  .object({
    terms: z.array(Text).min(1),
    text: Text,
    secret: GwIdSchema.optional(),
    /** Countries whose text means this by these words; absent means all. */
    tags: z.array(z.string().regex(/^[A-Z]{3}$/)).optional(),
    more: z
      .array(z.object({ secret: GwIdSchema, text: Text }).strict())
      .optional(),
  })
  .strict();
export type GwDictEntry = z.infer<typeof GwDictEntrySchema>;

/** A schedule entry's words (GwActs.ts): pack `acts.<id>`. */
export const GwActPackSchema = z
  .object({
    /** How the schedule lists it: "크루프 공장", "니콜라이에게 쓴다". */
    name: Text,
    /** One plain line under the name; no result, no hidden value. */
    note: Text.optional(),
    /** Field id -> its heading and its options' words. */
    fields: z
      .record(
        GwIdSchema,
        z.object({ label: Text, opt: ById.optional() }).strict(),
      )
      .optional(),
  })
  .strict();
export type GwActPack = z.infer<typeof GwActPackSchema>;

/** A national aim's words: pack `aims.<id>`. */
export const GwAimPackSchema = z
  .object({
    name: Text,
    /** What the seat declares, in the ruler's own words. */
    text: Text,
    /** The memoir's line, by how it ended. */
    met: Text,
    unmet: Text,
  })
  .strict();
export type GwAimPack = z.infer<typeof GwAimPackSchema>;

/** A scene's lines laid over from another share: every table is optional. */
const GwOverSchema = GwScenePackSchema.omit({ nodes: true })
  .partial()
  .extend({
    nodes: z.record(GwIdSchema, GwNodePackSchema.partial()).optional(),
  });
type GwOver = z.infer<typeof GwOverSchema>;

/** One paper's take on a story: a headline and a line under it. */
const GwHeadPackSchema = z
  .object({ head: Text, deck: Text.optional() })
  .strict();

/** A country's blocs and papers (GwPress.ts). */
export const GwPressPackSchema = z
  .object({
    /** Bloc id -> its name here and who is in it. */
    blocs: z.record(GwIdSchema, z.object({ name: Text, who: Text }).strict()),
    /** Paper id -> its name and its lean. */
    papers: z.record(GwIdSchema, z.object({ name: Text, lean: Text }).strict()),
    /** A support term's key -> the line, as the screen gives it. */
    why: ById,
    /** Tie key -> the line; <key>_off once it broke. */
    ties: ById,
    /** Story id -> paper id -> its take; may hold {who}. */
    heads: z.record(GwIdSchema, z.record(GwIdSchema, GwHeadPackSchema)),
    /** Paper id -> what its gap says when the censor has been. */
    gaps: ById,
    rumours: ById,
  })
  .strict();
export type GwPressPack = z.infer<typeof GwPressPackSchema>;

export const GwPackSchema = z
  .object({
    version: z.literal(1),
    scenes: z.record(GwIdSchema, GwScenePackSchema),
    people: z.record(GwIdSchema, GwPersonPackSchema),
    /** `reason` effect key -> the line, may hold {who}. */
    reasons: ById.optional(),
    /** Promise key -> how the people screen lists it, may hold {who}. */
    promises: ById.optional(),
    /** Ending id -> the memoir's paragraph, may hold {date}, {casualties}. */
    endings: ById.optional(),
    /** Ruler row id -> the card's words. */
    rulers: z.record(GwIdSchema, GwRulerPackSchema).optional(),
    /**
     * Lines laid over a scene another share owns: a body, an option's wording,
     * a why, a node's line. A later share adds to a scene without touching its
     * file.
     */
    over: z.record(GwIdSchema, GwOverSchema).optional(),
    /** Term id -> what the dictionary says of it. */
    dict: z.record(GwIdSchema, GwDictEntrySchema).optional(),
    /** Only the seat's own country's: its blocs and papers. */
    press: GwPressPackSchema.optional(),
    /** Act id -> its words on the schedule. */
    acts: z.record(GwIdSchema, GwActPackSchema).optional(),
    /** Aim id -> its words. */
    aims: z.record(GwIdSchema, GwAimPackSchema).optional(),
    /**
     * Rival's person id -> the memoir's line about him, by how it went: an end
     * (`reconciled`...), else an act (`embrace`...), else `stage1`..`stage3`.
     */
    rivals: z.record(GwIdSchema, ById).optional(),
  })
  .strict();
export type GwPack = z.infer<typeof GwPackSchema>;

/** Later packs add to earlier ones; an id in two packs is a content bug. */
export function mergeGwPacks(packs: readonly GwPack[]): GwPack {
  const out: GwPack = {
    version: 1,
    scenes: {},
    people: {},
    reasons: {},
    promises: {},
    endings: {},
    rulers: {},
    dict: {},
    acts: {},
    aims: {},
    rivals: {},
  };
  for (const p of packs) {
    Object.assign(out.scenes, p.scenes);
    Object.assign(out.people, p.people);
    Object.assign(out.reasons!, p.reasons);
    Object.assign(out.promises!, p.promises);
    Object.assign(out.endings!, p.endings);
    Object.assign(out.rulers!, p.rulers);
    Object.assign(out.dict!, p.dict);
    Object.assign(out.acts!, p.acts);
    Object.assign(out.aims!, p.aims);
    Object.assign(out.rivals!, p.rivals);
    if (p.press !== undefined) out.press = p.press;
  }
  for (const p of packs) {
    for (const [id, o] of Object.entries(p.over ?? {})) {
      const s = out.scenes[id];
      if (s !== undefined) out.scenes[id] = layOver(s, o);
    }
  }
  return out;
}

/** Each of the scene's line tables with the laid-over lines added. */
function layOver(s: GwScenePack, o: GwOver): GwScenePack {
  const nodes = { ...s.nodes };
  for (const [id, n] of Object.entries(o.nodes ?? {})) {
    const at = nodes[id];
    if (at === undefined) continue;
    nodes[id] = {
      ...at,
      says: { ...at.says, ...n.says },
      ...(n.saysBy === undefined
        ? {}
        : { saysBy: { ...at.saysBy, ...n.saysBy } }),
      replies: { ...at.replies, ...n.replies },
      ...(n.at === undefined ? {} : { at: n.at }),
      ...(n.room === undefined ? {} : { room: n.room }),
    };
  }
  return {
    ...s,
    text: { ...s.text, ...o.text },
    ...(o.opt === undefined ? {} : { opt: { ...s.opt, ...o.opt } }),
    ...(o.why === undefined ? {} : { why: { ...s.why, ...o.why } }),
    ...(o.optBy === undefined ? {} : { optBy: { ...s.optBy, ...o.optBy } }),
    ...(o.brief === undefined ? {} : { brief: mergeBrief(s.brief, o.brief) }),
    ...(o.back === undefined ? {} : { back: { ...s.back, ...o.back } }),
    ...(s.nodes === undefined ? {} : { nodes }),
  };
}

function mergeBrief(
  a: GwScenePack["brief"],
  b: NonNullable<GwScenePack["brief"]>,
): NonNullable<GwScenePack["brief"]> {
  if (typeof b === "string") return b;
  const base = typeof a === "string" ? { base: a } : a;
  return { ...base, ...b };
}

/** The secretary's note for a card's variant: its row, else `base`, else the string. */
export function gwBrief(
  brief: GwScenePack["brief"],
  variant: string,
): string | null {
  if (brief === undefined) return null;
  if (typeof brief === "string") return brief;
  return brief[variant] ?? brief.base ?? null;
}

/** Ids two packs both hold: `mergeGwPacks` would keep only the later one. */
export function gwPackOverlaps(packs: readonly GwPack[]): string[] {
  const out = new Set<string>();
  const seen = new Set<string>();
  for (const p of packs) {
    const ids = [
      ...Object.keys(p.scenes).map((x) => `scene ${x}`),
      ...Object.keys(p.people).map((x) => `person ${x}`),
      ...Object.keys(p.reasons ?? {}).map((x) => `reason ${x}`),
      ...Object.keys(p.promises ?? {}).map((x) => `promise ${x}`),
      ...Object.keys(p.endings ?? {}).map((x) => `ending ${x}`),
      ...Object.keys(p.rulers ?? {}).map((x) => `ruler ${x}`),
      ...Object.keys(p.dict ?? {}).map((x) => `dict ${x}`),
      ...Object.keys(p.acts ?? {}).map((x) => `act ${x}`),
      ...Object.keys(p.aims ?? {}).map((x) => `aim ${x}`),
      ...Object.keys(p.rivals ?? {}).map((x) => `rival ${x}`),
    ];
    for (const id of ids) {
      if (seen.has(id)) out.add(id);
      seen.add(id);
    }
  }
  return [...out];
}

const firstSentence = (t: string) => t.split(/(?<=[.!?…])\s/)[0].trim();

/** Two bodies of one scene opening alike read as a template (design §13). */
function sameOpenings(where: string, texts: Readonly<Record<string, string>>) {
  const by = new Map<string, string>();
  const out: string[] = [];
  for (const [id, t] of Object.entries(texts)) {
    const first = firstSentence(t);
    const other = by.get(first);
    if (other !== undefined)
      out.push(`${where}: ${other} and ${id} open alike`);
    by.set(first, id);
  }
  return out;
}

function holeProblems(where: string, t: string, roles: readonly string[]) {
  const out: string[] = [];
  for (const m of t.matchAll(/\{([a-z_0-9]+)(?:\.([a-z_0-9]+))?\}/g)) {
    const [hole, head, tail] = m;
    if (head === "date" && tail === undefined) continue;
    if ((head === "mem" || head === "chose") && tail !== undefined) continue;
    if (roles.includes(head) && (tail === undefined || tail === "title")) {
      continue;
    }
    out.push(`${where}: ${hole} fills from nothing`);
  }
  return out;
}

/**
 * Every line a scene can show that the pack lacks, and the template smells a
 * machine can find; a content test requires an empty list. `reasonKeys` are
 * those that have text outside the pack (gw.reason.* in the language files).
 */
export function gwPackProblems(
  scenes: readonly GwScene[],
  pack: GwPack,
  reasonKeys: readonly string[] = [],
): string[] {
  const out: string[] = [];
  for (const s of scenes) {
    const t = pack.scenes[s.id];
    if (t === undefined) {
      out.push(`${s.id}: not in the pack`);
      continue;
    }
    const roles = Object.keys(s.cast);
    const need = (ok: unknown, what: string) => {
      if (ok === undefined) out.push(`${s.id}: no text for ${what}`);
    };
    const check = (where: string, text: string | undefined) => {
      if (text !== undefined) out.push(...holeProblems(where, text, roles));
    };
    for (const v of s.variants) {
      need(t.text[v.id], `variant ${v.id}`);
      check(`${s.id}.${v.id}`, t.text[v.id]);
    }
    out.push(...sameOpenings(s.id, t.text));
    // `brief` is optional; when present its holes must be known roles.
    if (typeof t.brief === "string") check(`${s.id}.brief`, t.brief);
    else {
      for (const [v, b] of Object.entries(t.brief ?? {})) {
        check(`${s.id}.brief.${v}`, b);
      }
    }
    for (const [k, b] of Object.entries(t.back ?? {})) {
      check(`${s.id}.back.${k}`, b);
    }
    for (const o of s.options ?? []) {
      need(t.opt?.[o.id], `option ${o.id}`);
      check(`${s.id}.${o.id}`, t.opt?.[o.id]);
      if (o.when !== undefined) need(t.why?.[o.id], `why ${o.id}`);
    }
    for (const [v, opts] of Object.entries(t.optBy ?? {})) {
      for (const [o, text] of Object.entries(opts)) {
        check(`${s.id}.${v}.${o}`, text);
      }
    }
    for (const [id, n] of Object.entries(s.nodes ?? {})) {
      const nt = t.nodes?.[id];
      for (const v of n.says) {
        const by = Object.values(nt?.saysBy ?? {}).some(
          (x) => x[v.id] !== undefined,
        );
        if (!by) need(nt?.says[v.id], `${id}.says.${v.id}`);
        check(`${s.id}.${id}.${v.id}`, nt?.says[v.id]);
      }
      if (nt !== undefined) out.push(...sameOpenings(`${s.id}.${id}`, nt.says));
      check(`${s.id}.${id}.at`, nt?.at);
      check(`${s.id}.${id}.room`, nt?.room);
      for (const r of n.replies) {
        need(nt?.replies[r.id], `${id}.reply.${r.id}`);
        check(`${s.id}.${id}.${r.id}`, nt?.replies[r.id]);
      }
    }
    for (const [role, list] of Object.entries(s.voices ?? {})) {
      for (const v of list) {
        const has = Object.values(t.voiceBy?.[role] ?? {}).some(
          (x) => x[v.id] !== undefined,
        );
        if (!has) need(t.voice?.[role], `voice ${role}.${v.id}`);
      }
    }
    if (s.summon === true) need(t.topic, "topic");
    for (const e of gwSceneEffects(s)) {
      if (
        e.kind === "reason" &&
        pack.reasons?.[e.key] === undefined &&
        !reasonKeys.includes(e.key)
      ) {
        out.push(`${s.id}: no text for reason ${e.key}`);
      }
      if (
        e.kind === "ruler" &&
        pack.reasons?.[e.key] === undefined &&
        !reasonKeys.includes(e.key)
      ) {
        out.push(`${s.id}: no text for ruler line ${e.key}`);
      }
      if (e.kind === "promise" && pack.promises?.[e.key] === undefined) {
        out.push(`${s.id}: no text for promise ${e.key}`);
      }
    }
  }
  return out;
}
