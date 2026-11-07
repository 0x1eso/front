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
  })
  .strict();

export const GwScenePackSchema = z
  .object({
    title: Text,
    /** variant id -> text. */
    text: ById,
    /** option id -> text. */
    opt: ById.optional(),
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
    /**
     * Lines laid over a scene another share owns: a body, a node's line. Later
     * shares add to a scene without touching its file.
     */
    over: z
      .record(
        GwIdSchema,
        GwScenePackSchema.omit({ nodes: true })
          .partial()
          .extend({
            nodes: z.record(GwIdSchema, GwNodePackSchema.partial()).optional(),
          }),
      )
      .optional(),
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
  };
  for (const p of packs) {
    Object.assign(out.scenes, p.scenes);
    Object.assign(out.people, p.people);
    Object.assign(out.reasons!, p.reasons);
    Object.assign(out.promises!, p.promises);
    Object.assign(out.endings!, p.endings);
  }
  for (const p of packs) {
    for (const [id, o] of Object.entries(p.over ?? {})) {
      const s = out.scenes[id];
      if (s !== undefined) out.scenes[id] = layOver(s, o);
    }
  }
  return out;
}

type GwOver = NonNullable<GwPack["over"]>[string];

/** Each of the scene's line tables with the laid-over lines added. */
function layOver(s: GwScenePack, o: GwOver): GwScenePack {
  const nodes = { ...s.nodes };
  for (const [id, n] of Object.entries(o.nodes ?? {})) {
    const at = nodes[id];
    if (at === undefined) continue;
    nodes[id] = {
      ...at,
      says: { ...at.says, ...n.says },
      replies: { ...at.replies, ...n.replies },
    };
  }
  return {
    ...s,
    text: { ...s.text, ...o.text },
    ...(o.opt === undefined ? {} : { opt: { ...s.opt, ...o.opt } }),
    ...(o.why === undefined ? {} : { why: { ...s.why, ...o.why } }),
    ...(s.nodes === undefined ? {} : { nodes }),
  };
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
    for (const o of s.options ?? []) {
      need(t.opt?.[o.id], `option ${o.id}`);
      check(`${s.id}.${o.id}`, t.opt?.[o.id]);
      if (o.when !== undefined) need(t.why?.[o.id], `why ${o.id}`);
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
      if (e.kind === "promise" && pack.promises?.[e.key] === undefined) {
        out.push(`${s.id}: no text for promise ${e.key}`);
      }
    }
  }
  return out;
}
