// Great War 1914 (ww150): what the story keeps on a seat. The rival is hidden:
// no view carries him until the memoir. Letters are the thread with a foreign
// ruler. `bigAt` and `met` pace the desk (engine/ww1914/Desk).
import { z } from "zod";
import { GW_TAGS } from "./GwCountries";

const Id = z
  .string()
  .regex(/^[a-z][a-z0-9_]*$/)
  .max(48);

/** The role scenes cast the rival in: `cast: { rival_man: { rival_man: true } }`. */
export const GW_RIVAL_ROLE = "rival_man";

/** 0 no rival, then small signs, gathering, open clash. */
export const GW_RIVAL_SIGNS = 1;
export const GW_RIVAL_GATHERING = 2;
export const GW_RIVAL_CLASH = 3;

/** What the seat last did about him. Append only. */
export const GW_RIVAL_ACTS = ["embrace", "push", "strike"] as const;
export type GwRivalAct = (typeof GW_RIVAL_ACTS)[number];

/** How the track closed. `gone` is the engine's: he died or left. Append only. */
export const GW_RIVAL_ENDS = [
  "reconciled",
  "broken",
  "prevailed",
  "gone",
] as const;
export type GwRivalEnd = (typeof GW_RIVAL_ENDS)[number];

export const GwRivalStateSchema = z.object({
  /** Person id; null where the seat's country has no row. */
  who: Id.nullable(),
  stage: z.number().int(),
  /** What the stage reads; grows by the chapter, moved by the seat's acts. */
  heat: z.number().int(),
  act: z.enum(GW_RIVAL_ACTS).nullable(),
  end: z.enum(GW_RIVAL_ENDS).nullable(),
});
export type GwRivalState = z.infer<typeof GwRivalStateSchema>;

/** One letter of a thread with a foreign ruler. */
export const GwLetterSchema = z.object({
  /** The other ruler's country. */
  with: z.enum(GW_TAGS),
  /** True: the seat wrote it. */
  out: z.boolean(),
  /** The scene it came in or was answered from; null when none. */
  scene: Id.nullable(),
  variant: Id.nullable(),
  /** The seat's tone (GW_STANCES); null for one that came in. */
  tone: Id.nullable(),
  chapter: z.number().int(),
});
export type GwLetter = z.infer<typeof GwLetterSchema>;

export const GwStoryStateSchema = z.object({
  rival: GwRivalStateSchema,
  letters: z.array(GwLetterSchema),
  /** The last chapter a big scene was dealt; -9 none. */
  bigAt: z.number().int(),
  /** A first game: who has come in beyond the opening circle. */
  met: z.array(Id),
});
export type GwStoryState = z.infer<typeof GwStoryStateSchema>;

export function gwStoryStart(): GwStoryState {
  return {
    rival: { who: null, stage: 0, heat: 0, act: null, end: null },
    letters: [],
    bigAt: -9,
    met: [],
  };
}
