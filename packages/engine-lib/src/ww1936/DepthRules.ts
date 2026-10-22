// World War 1936 P6: the depth systems' shared helpers — the seven roll
// purposes (plan decision 17), the non-transferable items (decision 20),
// hex snapshots of byte tables (decision 16) and the test roll finder
// (decision 30). Final (plan Task 1 Step 8).
import type { EquipmentType } from "@openfront/engine-api/ww1936/EconomyTypes";
import { idHash, wwRoll } from "./Roll";

export const P_INTEL_CAPTURE = idHash("intel_capture");
export const P_INTEL_OP = idHash("intel_op");
export const P_INTEL_INFIL = idHash("intel_infil");
export const P_NUKE_INTERCEPT = idHash("nuke_intercept");
export const P_RAID = idHash("raid");
export const P_ACE_SPAWN = idHash("ace_spawn");
export const P_ACE_DEATH = idHash("ace_death");

/** Plan decision 20. */
export const NON_TRANSFERABLE: readonly EquipmentType[] = [
  "atomic_bomb",
  "convoy",
  "floating_harbor",
  "ballistic_rocket",
  "flying_bomb",
];

export function hexOf(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) {
    s += (b[i] < 16 ? "0" : "") + b[i].toString(16);
  }
  return s;
}

export function bytesOfHex(s: string, out: Uint8Array): void {
  for (let i = 0; i < out.length && 2 * i + 1 < s.length; i++) {
    out[i] = parseInt(s.substring(2 * i, 2 * i + 2), 16);
  }
}

/** A plan-decision-30 helper for tests: the first n in [0, 100000) whose roll passes. */
export function firstPassing(
  seed: number,
  purpose: number,
  pred: (n: number, roll: number) => boolean,
  a = 0,
  b = 0,
): number {
  for (let n = 0; n < 100_000; n++) {
    if (pred(n, wwRoll(seed, purpose, n, a, b))) return n;
  }
  return -1;
}
