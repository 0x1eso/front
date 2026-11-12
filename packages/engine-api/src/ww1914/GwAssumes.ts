// Great War 1914 (ww187): what a scene's text takes for granted. A scene or a
// variant declares the facts its words assume; they compile to conditions
// (gwAssumesCond) that the engine asks besides `when`:
// - a scene whose facts are false is not dealt, scheduled or not;
// - a variant whose facts are false is passed over for the next; the last
//   variant carries none.
// A tag never makes a variant win: only `when` does that (SceneRun.pickVariant).
// The text lint (tests/ww1914/TextLint.test.ts) asks every body that names a
// place, a front line, a sitting house or a person for the matching tag, or
// `past` when it only remembers. Format: /home/eser/dev/ww187-l1-format.md.
import { z } from "zod";
import {
  GW_LINES,
  GW_THEATRES,
  GW_WORLD_FLAGS,
  GwIdSchema,
  GwTheatre,
  GwWorldFlag,
} from "./GreatWarTypes";
import { GW_TAGS, GwTag } from "./GwCountries";
import { GW_CHAMBERS, GwChamber } from "./GwHouse";
import { GwPlace, GwPlaceSchema } from "./GwPlaces";

/**
 * Who holds a place, from the seat's chair: its own country or an ally (`us`),
 * a country it is at war with (`foe`), the country it belongs to (`owner`).
 * A French town in French hands is both `owner` and, for Germany, `foe`.
 */
export const GW_HOLDERS = ["us", "foe", "owner"] as const;
export type GwHolder = (typeof GW_HOLDERS)[number];

export interface GwAssumes {
  /** place -> who holds it now. */
  held?: Partial<Record<GwPlace, GwHolder>>;
  /** theatre -> [from, to]: the line stands in this band, both ends included. */
  line?: Partial<Record<GwTheatre, readonly [string, string]>>;
  /** These chambers of the seat's house sit now (not dissolved, prorogued, abolished). */
  sits?: readonly GwChamber[];
  /** These chambers do not sit now: for the "the house is closed" text. */
  shut?: readonly GwChamber[];
  /** These persons are about: not dead, fallen or gone. */
  active?: readonly string[];
  /** The seat's country is at war with each. */
  war?: readonly GwTag[];
  /** Each of these countries fights in the war now: came in, not out. */
  fights?: readonly GwTag[];
  /** The seat's form of government is one of these. */
  regime?: readonly string[];
  /** These world flags are true now, not only once (WorldFlags.flagNow). */
  now?: readonly GwWorldFlag[];
  /** The text only remembers: the lint passes what it names. Compiles to nothing. */
  past?: true;
}

const tag = z.enum(GW_TAGS);

export const GwAssumesSchema: z.ZodType<GwAssumes> = z
  .object({
    held: z.partialRecord(GwPlaceSchema, z.enum(GW_HOLDERS)).optional(),
    line: z
      .partialRecord(
        z.enum(GW_THEATRES),
        z.tuple([z.string().min(1), z.string().min(1)]).readonly(),
      )
      .optional(),
    sits: z.array(z.enum(GW_CHAMBERS)).min(1).readonly().optional(),
    shut: z.array(z.enum(GW_CHAMBERS)).min(1).readonly().optional(),
    active: z.array(GwIdSchema).min(1).readonly().optional(),
    war: z.array(tag).min(1).readonly().optional(),
    fights: z.array(tag).min(1).readonly().optional(),
    regime: z.array(GwIdSchema).min(1).readonly().optional(),
    now: z.array(z.enum(GW_WORLD_FLAGS)).min(1).readonly().optional(),
    past: z.literal(true).optional(),
  })
  .strict() as unknown as z.ZodType<GwAssumes>;

/** What the schema can't say: a line band names lines of its theatre, low end first. */
export function gwAssumesProblems(a: GwAssumes): string[] {
  const out: string[] = [];
  for (const [t, band] of Object.entries(a.line ?? {})) {
    const lines = GW_LINES[t as GwTheatre];
    const [from, to] = band as readonly [string, string];
    const i = lines.indexOf(from);
    const j = lines.indexOf(to);
    if (i < 0) out.push(`line ${t}: no line ${from}`);
    if (j < 0) out.push(`line ${t}: no line ${to}`);
    if (i >= 0 && j >= 0 && i > j) out.push(`line ${t}: ${from} is past ${to}`);
  }
  return out;
}

/**
 * The tags as one condition (SceneDsl's GwCond shape, built here as plain data
 * so this file needs no import of SceneDsl); null when they assume nothing.
 */
export function gwAssumesCond(a: GwAssumes | undefined): GwAssumedCond | null {
  if (a === undefined) return null;
  const of: GwAssumedCond[] = [];
  const w = (x: object): GwAssumedCond => ({ kind: "world", of: x });
  for (const [place, by] of Object.entries(a.held ?? {})) {
    of.push(w({ is: "held", place, by }));
  }
  for (const [theatre, band] of Object.entries(a.line ?? {})) {
    const [from, to] = band as readonly [string, string];
    of.push(w({ is: "front", theatre, from, to }));
  }
  for (const id of a.sits ?? []) of.push(w({ is: "sits", id }));
  for (const id of a.shut ?? []) {
    of.push({ kind: "not", of: w({ is: "sits", id }) });
  }
  for (const person of a.active ?? []) {
    of.push({ kind: "person_active", person });
  }
  for (const t of a.war ?? []) of.push({ kind: "at_war", tag: t });
  for (const t of a.fights ?? []) {
    of.push(w({ is: "entered", tag: t }));
    of.push({ kind: "not", of: w({ is: "out", tag: t }) });
  }
  if (a.regime !== undefined) of.push(w({ is: "regime", of: [...a.regime] }));
  for (const flag of a.now ?? []) of.push(w({ is: "flag_now", flag }));
  if (of.length === 0) return null;
  return of.length === 1 ? of[0] : { kind: "all", of };
}

/** A GwCond, loosely typed here; SceneDsl's `assumedCond` gives it its type. */
export type GwAssumedCond = { kind: string } & Record<string, unknown>;
