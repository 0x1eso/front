// World War 1936 P3 (spec §22.2): the only randomness of politics. Stateless:
// the same inputs give the same value whatever ran before, so a restored game
// and a game with more content roll the same.
import type { AiWeight } from "@openfront/engine-api/ww1936/PoliticsTypes";

/** splitmix32 finaliser. */
function mix32(x: number): number {
  let z = (x + 0x9e3779b9) | 0;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
  return (z ^ (z >>> 16)) >>> 0;
}

/** A 32-bit unsigned value from (seed, purpose, a, b, c). */
export function wwRoll(
  seed: number,
  purpose: number,
  a: number,
  b = 0,
  c = 0,
): number {
  let h = mix32(seed | 0);
  h = mix32((h ^ purpose) | 0);
  h = mix32((h ^ a) | 0);
  h = mix32((h ^ b) | 0);
  return mix32((h ^ c) | 0);
}

/** FNV-1a of an id string (content ids, purposes). */
export function idHash(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export const P_BEAT = idHash("beat");
export const P_BRANCH = idHash("branch");
export const P_EVT = idHash("evt");
export const P_MTTH = idHash("mtth");
export const P_FOCUS = idHash("focus");
export const P_RAND = idHash("rand");
export const P_ELECTION = idHash("election");
export const P_DELAY = idHash("delay");
/** P4 (pre-flight A14): the naval and air history beats' skip and delay. */
export const P_NAVALBEAT = idHash("navalbeat");

/**
 * Spec §12.4, §18.5: weight = base × Π factor/100 (floor each step) over
 * the mods whose condition holds. `holds` evaluates a mod's condition.
 */
export function aiWeight(
  w: AiWeight | undefined,
  holds: (i: number) => boolean,
  base = 10,
): number {
  let v = w?.base ?? base;
  (w?.mods ?? []).forEach((m, i) => {
    if (holds(i)) v = Math.floor((v * m.factor) / 100);
  });
  return Math.max(0, v);
}

/** Index picked by `roll` over the weights; -1 when every weight is 0. */
export function pickWeighted(weights: readonly number[], roll: number): number {
  let total = 0;
  for (const w of weights) total += w;
  if (total <= 0) return -1;
  let r = roll % total;
  for (let i = 0; i < weights.length; i++) {
    if (r < weights[i]) return i;
    r -= weights[i];
  }
  return weights.length - 1;
}
