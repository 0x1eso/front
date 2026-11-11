// Great War 1914 (ww171 phase 4): the conditions every seat's state-event
// scenes use, so the five writer lanes (scenes/<seat>_wars.ts) open their
// scenes on the same states. A scene says what happened, not when: a war
// with a country began, a front opened, a neutral came in, a peace of two.
// Months count on the calendar's dates; `max: 0` is "this month".
import type {
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

/** A front opened within `months` and still stands. */
export const frontOpened = (theatre: GwTheatre, months = 0): GwCond =>
  world({ is: "front_months", theatre, max: months });

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

/** The seat's country made a peace of its own with `tag` within `months`. */
export const peaceWith = (tag: GwTag, months = 1): GwCond =>
  world({ is: "pair_peace", with: tag, max: months });

/** Two other countries made a peace of their own within `months`. */
export const peaceBetween = (a: GwTag, b: GwTag, months = 1): GwCond =>
  world({ is: "pair_peace", tag: a, with: b, max: months });

/** A peace offer waits for the seat's answer (from `tag`, if given). */
export const offered = (tag?: GwTag): GwCond =>
  world(
    tag === undefined ? { is: "peace_offered" } : { is: "peace_offered", tag },
  );
