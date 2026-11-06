// Great War 1914: the text pack format, resources/ww1914/ko/<file>.json.
// One file per country plus common.json; the client fetches common and the
// seat's country (shared/ww1914/GwPackLoader). The engine never reads a pack.
//
// Text may hold {role} (the cast's name), {role.title} (their office) and
// {date}. Josa markers follow src/client/Josa.ts: {cos}이(가).
import { z } from "zod";
import { GwIdSchema } from "./GreatWarTypes";

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
  })
  .strict();
export type GwPack = z.infer<typeof GwPackSchema>;

/** Later packs add to earlier ones; an id in two packs is a content bug. */
export function mergeGwPacks(packs: readonly GwPack[]): GwPack {
  const out: GwPack = { version: 1, scenes: {}, people: {} };
  for (const p of packs) {
    Object.assign(out.scenes, p.scenes);
    Object.assign(out.people, p.people);
  }
  return out;
}
