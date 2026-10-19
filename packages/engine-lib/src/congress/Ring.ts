import { z } from "zod";
import { zInt } from "../snapshot/SnapshotType";

/**
 * Counts per ledger bucket over a sliding window (spec §4): `slots[b % size]`
 * holds bucket b for the `size` buckets ending at `head`. Plain data, so it
 * snapshots as it is.
 */
export interface Ring {
  head: number;
  slots: number[];
}

export const RingSchema = z.object({
  head: zInt(),
  slots: z.array(zInt()),
});

export function newRing(size: number): Ring {
  return { head: -1, slots: new Array<number>(size).fill(0) };
}

/** A copy that shares no slots (snapshots, restores). */
export function copyRing(r: Ring): Ring {
  return { head: r.head, slots: [...r.slots] };
}

/** Adds `n` to `bucket`. Later buckets clear what they overwrite; a bucket older than the window is ignored. */
export function ringAdd(r: Ring, bucket: number, n: number): void {
  const size = r.slots.length;
  if (bucket > r.head) {
    const clear = Math.min(size, bucket - r.head);
    for (let i = 1; i <= clear; i++) r.slots[(r.head + i) % size] = 0;
    r.head = bucket;
  }
  if (bucket <= r.head - size) return;
  r.slots[bucket % size] += n;
}

/** The sum of the `window` buckets ending at `bucket` (which may be ahead of the last write). */
export function ringSum(r: Ring, bucket: number, window: number): number {
  const size = r.slots.length;
  let sum = 0;
  for (let b = bucket - Math.min(window, size) + 1; b <= bucket; b++) {
    if (b < 0 || b > r.head || b <= r.head - size) continue;
    sum += r.slots[b % size];
  }
  return sum;
}
