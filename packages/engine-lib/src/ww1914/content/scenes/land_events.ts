// Great War 1914 (ww172 phase 5): the conditions every seat's scenes of
// occupation and the bilateral tables use, so the five writer lanes
// (scenes/<seat>_lands.ts) open their scenes on the same states. A scene
// says what happened, not when: land was taken or lost, a country was
// knocked out, a table of two sat or signed. Months count on the calendar's
// dates; `max: 0` is "this month".
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwCond } from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";

/** The seat's country took land of `from` (absent: anyone's) within `months`. */
export const tookLand = (from?: GwTag, months = 0): GwCond =>
  world(
    from === undefined
      ? { is: "land_taken", max: months }
      : { is: "land_taken", from, max: months },
  );

/** The seat's country holds `of`'s capital, taken within `months`. */
export const tookCapital = (of: GwTag, months = 0): GwCond =>
  world({ is: "land_taken", from: of, capital: true, max: months });

/** Land of the seat's country fell to `to` (absent: anyone) within `months`. */
export const lostLand = (to?: GwTag, months = 0): GwCond =>
  world(
    to === undefined
      ? { is: "land_lost", max: months }
      : { is: "land_lost", to, max: months },
  );

/** The seat's capital is in an enemy's hands, taken within `months`. */
export const lostCapital = (months = 0): GwCond =>
  world({ is: "land_lost", capital: true, max: months });

/** An ally of the seat's coalition took `of`'s capital within `months`. */
export const capitalFell = (by: GwTag, of: GwTag, months = 0): GwCond =>
  world({ is: "land_taken", tag: by, from: of, capital: true, max: months });

/** `tag` was knocked out of the war within `months`. */
export const knockedOut = (tag: GwTag, months = 0): GwCond =>
  world({ is: "beaten", tag, max: months });

/** A bilateral table with `tag` sits now (the system's table runs it). */
export const tableSits = (tag?: GwTag): GwCond =>
  world(
    tag === undefined
      ? { is: "pair_table", open: true }
      : { is: "pair_table", with: tag, open: true },
  );

/**
 * A bilateral table with `tag` (absent: anyone) signed within `months`,
 * the seat having come to it as `result`.
 */
export const tableSigned = (
  result: "won" | "lost" | "even",
  tag?: GwTag,
  months = 1,
): GwCond =>
  world(
    tag === undefined
      ? { is: "pair_table", open: false, result: [result], max: months }
      : {
          is: "pair_table",
          with: tag,
          open: false,
          result: [result],
          max: months,
        },
  );
