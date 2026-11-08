// World War 1936 diplomacy D4 (ww161 Design B §4; ww162 lane L3): promised
// land as pure rules. The engine checks and values a deal's promise and
// join_war items with them (endgame/Promises.ts), and the composer can grey
// with the same ones. Integers only; countries by smallID.
import type { DealItem } from "@openfront/engine-api/ww1936/DiploTypes";
import { WW_PROMISE_STRENGTH_PCT } from "@openfront/engine-api/ww1936/DiploTypes";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import { IDEO_DEM, IDEO_NEU } from "@openfront/engine-api/ww1936/PoliticsTypes";
import type { DealFacts } from "./DiploRules";

// ---- Value points (named; L7 tunes them) ----

/** What going to war costs the AI that joins (before the promise it gets). */
export const WW_PROMISE_JOIN_PTS = 5;
/** A new ally with an army, to the side it joins. */
export const WW_PROMISE_ALLY_PTS = 10;
/** A joiner's promised group: this × its regions' base value when it is its core or claim (× 1 when it only borders it). */
export const WW_PROMISE_WANTED_X = 2;
/** The world tension a democracy needs to join a war by a deal (bp)… */
export const WW_PROMISE_DEM_TENSION_BP = 5000;
/** …and a neutral government (bp). */
export const WW_PROMISE_NEU_TENSION_BP = 2500;

/** Why a government may not go to war by a deal at world tension `wtBp` (null: it may). */
export function promiseGateBlock(
  ruling: number,
  wtBp: number,
): WwOrderBlock | null {
  if (ruling === IDEO_DEM && wtBp < WW_PROMISE_DEM_TENSION_BP) {
    return "tension_gate";
  }
  if (ruling === IDEO_NEU && wtBp < WW_PROMISE_NEU_TENSION_BP) {
    return "tension_gate";
  }
  return null;
}

/** The side a country is asked to join is strong enough: WW_PROMISE_STRENGTH_PCT of the enemy side's strength. */
export function promiseStrengthOk(mine: number, theirs: number): boolean {
  return mine * 100 >= WW_PROMISE_STRENGTH_PCT * theirs;
}

/**
 * A deal's promises go to a country that fights for them: each promise of
 * `target`'s land needs its receiver to join the war on `target` in the same
 * deal (a join_war item it gives), or to fight `target` already on the
 * promiser's side (an ally: the promise only pre-assigns at the conference).
 * `from` gives `give`, `to` gives `take`. Null: fine.
 */
export function promisePairBlock(
  f: Pick<DealFacts, "atWar" | "sameSide">,
  from: number,
  to: number,
  give: readonly DealItem[],
  take: readonly DealItem[],
): WwOrderBlock | null {
  for (const [giver, taker, list, back] of [
    [from, to, give, take],
    [to, from, take, give],
  ] as const) {
    for (const i of list) {
      if (i.kind !== "promise") continue;
      const joins = back.some(
        (x) => x.kind === "join_war" && x.target === i.target,
      );
      if (joins) continue;
      if (f.atWar(taker, i.target) && f.sameSide(giver, taker)) continue;
      return "promise_bad_target";
    }
  }
  return null;
}
