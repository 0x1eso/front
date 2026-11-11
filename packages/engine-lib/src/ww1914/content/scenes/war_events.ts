// Great War 1914 (ww171 phase 4): the conditions every seat's state-event
// scenes use, so the five writer lanes (scenes/<seat>_wars.ts) open their
// scenes on the same states. A scene says what happened, not when: a war
// with a country began, a front opened, a neutral came in, a peace of two.
// Months count on the calendar's dates; `max: 0` is "this month".
import type {
  GwLadderStep,
  GwSide,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwCond } from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";

/** The seat's country is at war with `tag`, begun within `months`. */
export const warWith = (tag: GwTag, months = 0): GwCond =>
  world({ is: "pair_war", with: tag, max: months });

/** As warWith, a war of the two's own: neither in a coalition against the other. */
export const ownWarWith = (tag: GwTag, months = 0): GwCond =>
  world({ is: "pair_war", with: tag, outside: true, max: months });

/** Two other countries went to war with each other within `months`. */
export const warBetween = (a: GwTag, b: GwTag, months = 0): GwCond =>
  world({ is: "pair_war", tag: a, with: b, max: months });

/**
 * The war of `by` and `on`, on now, was declared by `by` (ww171 merge 4):
 * whoever sent or never sent a note before it. The seat's own: pass its tag.
 */
export const declaredBy = (by: GwTag, on: GwTag): GwCond =>
  world({ is: "pair_war", tag: by, with: on, by });

/** A front opened within `months` and still stands. */
export const frontOpened = (theatre: GwTheatre, months = 0): GwCond =>
  world({ is: "front_months", theatre, max: months });

/**
 * `tag` fights on the front, and came onto it within `months`: the front's
 * opening or `tag`'s war with the far end, the later (ww171 merge 4).
 */
export const frontOn = (theatre: GwTheatre, tag: GwTag, months = 0): GwCond =>
  world({ is: "front_months", theatre, tag, max: months });

/**
 * `from` sent `to` an ultimatum that stands at one of `of` (absent: still
 * open): another country's ladder, Vienna's note to Petersburg.
 */
export const noteBetween = (
  from: GwTag,
  to: GwTag,
  of?: GwLadderStep[],
): GwCond =>
  world(
    of === undefined
      ? { is: "ladder", nation: from, role: "from", tag: to }
      : { is: "ladder", nation: from, role: "from", tag: to, of },
  );

/** A neutral came into the war within `chapters` chapters, on `side`. */
export const joined = (tag: GwTag, side?: GwSide, chapters = 1): GwCond => ({
  kind: "all",
  of: [
    world({ is: "in_war", tag, max: chapters }),
    world(
      side === undefined
        ? { is: "entered", tag }
        : { is: "entered", tag, side },
    ),
  ],
});

/**
 * The seat's country's war with `tag` ended within `months`: in a peace, or
 * because one of the two fell out of the war (see peaceMade, fellOut).
 */
export const peaceWith = (tag: GwTag, months = 1): GwCond =>
  world({ is: "pair_peace", with: tag, max: months });

/** Two other countries' war ended within `months` (as peaceWith). */
export const peaceBetween = (a: GwTag, b: GwTag, months = 1): GwCond =>
  world({ is: "pair_peace", tag: a, with: b, max: months });

/**
 * The war of `a` and `b` ended in a signed peace within `months`, not by
 * one of them falling out (ww171 merge 4). `by`: whose offer was taken;
 * "mutual": both came to it at once, nobody's offer.
 */
export const peaceMade = (
  a: GwTag,
  b: GwTag,
  by?: GwTag | "mutual",
  months = 1,
): GwCond =>
  world(
    by === undefined
      ? {
          is: "pair_peace",
          tag: a,
          with: b,
          how: ["offer", "mutual"],
          max: months,
        }
      : by === "mutual"
        ? { is: "pair_peace", tag: a, with: b, how: ["mutual"], max: months }
        : {
            is: "pair_peace",
            tag: a,
            with: b,
            how: ["offer"],
            by,
            max: months,
          },
  );

/** The war of `a` and `b` ended within `months` as one of them fell out. */
export const fellOut = (a: GwTag, b: GwTag, months = 1): GwCond =>
  world({ is: "pair_peace", tag: a, with: b, how: ["fell"], max: months });

/** A peace offer waits for the seat's answer (from `tag`, if given). */
export const offered = (tag?: GwTag): GwCond =>
  world(
    tag === undefined ? { is: "peace_offered" } : { is: "peace_offered", tag },
  );
