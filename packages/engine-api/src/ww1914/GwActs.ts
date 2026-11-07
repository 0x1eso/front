// Great War 1914: what the seat starts itself. A schedule entry (`GwAct`) is
// something the player picks on the schedule screen: it spends a slot, runs its
// effects and plays `scene` `wait` chapters later. The scene is an ordinary
// scene with `scheduledOnly`: what was picked reaches it through the `picked`
// and `tone_fits` conditions and the `picked` cast rule. An aim (`GwAim`) is what
// the seat declares this war is for. Text: pack `acts.<id>`, `aims.<id>`.
import { z } from "zod";
import { GwIdSchema, GW_STAGES } from "./GreatWarTypes";
import { GW_TAGS } from "./GwCountries";
import {
  GW_STANCES,
  GwCondSchema,
  GwEffectSchema,
  GwScene,
} from "./SceneDsl";

/** The schedule's sections. APPEND ONLY. */
export const GW_ACT_KINDS = [
  "visit", // 시찰: a front, a factory, a hospital, a province
  "letter", // 친서: to a foreign ruler or a subject
  "order", // 칙령과 지시: an inquiry, an envoy, a meeting
  "speech", // 연설: where, and on what
  "intrigue", // 뒷공작: a rumour, two ministers, an agent
] as const;
export type GwActKind = (typeof GW_ACT_KINDS)[number];

const TellSchema = z.string().regex(/^[a-zA-Z_]+(?::[+-]?\d+)?$/);

/** One choice in a list field. Nothing here shows before the pick but its words. */
export const GwActOptionSchema = z
  .object({
    id: GwIdSchema,
    /** Not met: off the list, as the act itself is. */
    when: GwCondSchema.optional(),
    /** Shown after the pick, with the act's own `tell`. */
    tell: z.array(TellSchema).optional(),
    /** Run at the pick, after the act's. */
    effects: z.array(GwEffectSchema).optional(),
    /** This pick plays another scene than the act's. */
    scene: GwIdSchema.optional(),
  })
  .strict();
export type GwActOption = z.infer<typeof GwActOptionSchema>;

/** Who a people field lists: those in office, or anyone of the country. */
export const GW_ACT_PEOPLE = ["cabinet", "own"] as const;

/** Exactly one of `options`, `tones`, `people`. */
export const GwActFieldSchema = z
  .object({
    id: GwIdSchema,
    options: z.array(GwActOptionSchema).min(2).optional(),
    /** The tones on offer: `tone_fits` reads the pick. */
    tones: z.array(z.enum(GW_STANCES)).min(2).optional(),
    people: z.enum(GW_ACT_PEOPLE).optional(),
    /** How many people must be picked; a list field is always one. */
    count: z.number().int().min(1).max(3).optional(),
  })
  .strict();
export type GwActField = z.infer<typeof GwActFieldSchema>;

export const GwActSchema = z
  .object({
    id: GwIdSchema,
    nation: z.array(z.enum(GW_TAGS)).min(1),
    kind: z.enum(GW_ACT_KINDS),
    stage: z.array(z.enum(GW_STAGES)).optional(),
    /** State opens and closes it: not met, it isn't on the schedule at all. */
    when: GwCondSchema.optional(),
    /** Taken at most once a game. */
    once: z.boolean().optional(),
    /** Chapters before it can be taken again; absent: GW_ACT_COOLDOWN. */
    cooldown: z.number().int().min(0).optional(),
    /** The scene that plays: `scheduledOnly`, any kind. */
    scene: GwIdSchema,
    /** 0: on the desk at once. 1: next chapter. A letter's reply: 1 or more. */
    wait: z.number().int().min(0),
    fields: z.array(GwActFieldSchema).optional(),
    /** Shown after the pick. */
    tell: z.array(TellSchema).optional(),
    /** Run at the pick. */
    effects: z.array(GwEffectSchema).optional(),
    /** 뒷공작: it can come out. `scene` then comes, on top of the act's own. */
    caught: z
      .object({
        pct: z.number().int().min(0).max(100),
        scene: GwIdSchema,
        wait: z.number().int().min(1),
      })
      .strict()
      .optional(),
  })
  .strict();
export type GwAct = z.infer<typeof GwActSchema>;

export const GwAimSchema = z
  .object({
    id: GwIdSchema,
    nation: z.array(z.enum(GW_TAGS)).min(1),
    /** Not met: off the list. */
    when: GwCondSchema.optional(),
    /** Judged by the memoir and by `aim_met`. Read at the end, so plain state. */
    met: GwCondSchema,
    /** Up to three GW_MANDATES ids: they replace the three drawn ones. */
    tasks: z.array(GwIdSchema).max(3),
    /** Run when declared. */
    effects: z.array(GwEffectSchema).optional(),
    /** Run, on top of the rule's price, when it is given up. */
    dropped: z.array(GwEffectSchema).optional(),
  })
  .strict();
export type GwAim = z.infer<typeof GwAimSchema>;

/** The fields' values in order, or null when `flat` doesn't fit them. */
export function gwSplitPicks(
  act: GwAct,
  flat: readonly string[],
): Record<string, string[]> | null {
  const out: Record<string, string[]> = {};
  let at = 0;
  for (const f of act.fields ?? []) {
    const n = f.people === undefined ? 1 : (f.count ?? 1);
    if (at + n > flat.length) return null;
    out[f.id] = flat.slice(at, at + n);
    at += n;
  }
  return at === flat.length ? out : null;
}

/** What the schema can't say; a content test requires an empty list. */
export function gwActProblems(
  a: GwAct,
  scenes: ReadonlyMap<string, GwScene>,
): string[] {
  const out: string[] = [];
  const called = new Set<string>();
  const played = (id: string, where: string) => {
    const s = scenes.get(id);
    if (s === undefined) out.push(`${where}: no scene ${id}`);
    else if (s.scheduledOnly !== true) {
      out.push(`${where}: scene ${id} is not scheduledOnly`);
    } else called.add(id);
  };
  played(a.scene, a.id);
  if (a.caught !== undefined) played(a.caught.scene, `${a.id}.caught`);
  const ids = new Set<string>();
  const picks = new Map<string, number>();
  for (const f of a.fields ?? []) {
    if (ids.has(f.id)) out.push(`${a.id}: field ${f.id} twice`);
    ids.add(f.id);
    const kinds = [f.options, f.tones, f.people].filter((x) => x !== undefined);
    if (kinds.length !== 1) {
      out.push(`${a.id}.${f.id}: needs one of options, tones, people`);
    }
    if (f.count !== undefined && f.people === undefined) {
      out.push(`${a.id}.${f.id}: count on a list`);
    }
    if (f.people !== undefined) picks.set(f.id, f.count ?? 1);
    for (const o of f.options ?? []) {
      if (o.scene !== undefined) played(o.scene, `${a.id}.${f.id}.${o.id}`);
    }
    const open = f.options?.filter((o) => o.when === undefined) ?? [true];
    if (open.length === 0) out.push(`${a.id}.${f.id}: every option can close`);
  }
  for (const id of called) {
    for (const [role, rule] of Object.entries(scenes.get(id)!.cast)) {
      for (const x of "any_of" in rule ? rule.any_of : [rule]) {
        if (!("picked" in x)) continue;
        const n = picks.get(x.picked);
        if (n === undefined) {
          out.push(`${id}.${role}: ${a.id} has no people field ${x.picked}`);
        } else if ((x.nth ?? 0) >= n) {
          out.push(`${id}.${role}: nth past ${a.id}.${x.picked}'s count`);
        }
      }
    }
  }
  return out;
}

/** What the pack lacks for the schedule; a content test requires an empty list. */
export function gwActPackProblems(
  acts: readonly GwAct[],
  aims: readonly GwAim[],
  pack: {
    acts?: Readonly<
      Record<
        string,
        {
          name: string;
          fields?: Readonly<
            Record<
              string,
              { label: string; opt?: Readonly<Record<string, string>> }
            >
          >;
        }
      >
    >;
    aims?: Readonly<Record<string, unknown>>;
  },
): string[] {
  const out: string[] = [];
  for (const a of acts) {
    const t = pack.acts?.[a.id];
    if (t === undefined) {
      out.push(`${a.id}: act not in the pack`);
      continue;
    }
    for (const f of a.fields ?? []) {
      const ft = t.fields?.[f.id];
      // A tone field has words of its own in gw.act.tone.*.
      if (ft === undefined && f.tones === undefined) {
        out.push(`${a.id}.${f.id}: no label`);
      }
      for (const o of f.options ?? []) {
        if (ft?.opt?.[o.id] === undefined) {
          out.push(`${a.id}.${f.id}.${o.id}: no text`);
        }
      }
    }
  }
  for (const a of aims) {
    if (pack.aims?.[a.id] === undefined) out.push(`${a.id}: aim not in the pack`);
  }
  return out;
}
