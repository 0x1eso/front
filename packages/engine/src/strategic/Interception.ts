import { InterceptorData } from "@openfront/engine-api/strategic/StrategicTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { INTERCEPT_ODDS } from "@openfront/engine-lib/strategic/Strategic";

/**
 * Whether one interceptor hits the satellite (spec §6.3: hydrogen 20%,
 * atom 4%). A fresh PRNG seeded by the tick, the satellite's owner, the
 * shooter and the shot's place among this tick's arrivals: nothing shared
 * rolls, and every client agrees.
 */
export function interceptorHits(
  tick: number,
  ownerSmallID: number,
  shot: InterceptorData,
  index: number,
): boolean {
  return new PseudoRandom(
    tick * 7919 + ownerSmallID * 104_729 + shot.by * 131 + index,
  ).chance(INTERCEPT_ODDS[shot.type]);
}
