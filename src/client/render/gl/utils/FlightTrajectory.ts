import type { NukeTrajectoryData } from "../../types";
import type { SAMInfo } from "./NukeTrajectory";

/**
 * Expanded warfare: where (0..1 along the line) a straight flight first
 * enters a SAM's range; 1 when it never does, 0 when it starts inside one.
 */
export function firstSamEntry(
  srcX: number,
  srcY: number,
  dstX: number,
  dstY: number,
  sams: readonly SAMInfo[],
): number {
  const dx = dstX - srcX;
  const dy = dstY - srcY;
  const a = dx * dx + dy * dy;
  let first = 1;
  for (const sam of sams) {
    const fx = srcX - sam.x;
    const fy = srcY - sam.y;
    const c = fx * fx + fy * fy - sam.r * sam.r;
    if (c <= 0) return 0;
    if (a === 0) continue;
    const b = 2 * (fx * dx + fy * dy);
    const disc = b * b - 4 * a * c;
    if (disc < 0) continue;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    if (t >= 0 && t < first) first = t;
  }
  return first;
}

/**
 * A plane's or a barrage's straight flight for the trajectory overlay: a
 * cubic Bezier with its control points on the line. Planes can be shot at
 * all the way, so there is no untargetable stretch.
 */
export function buildFlightTrajectory(
  srcX: number,
  srcY: number,
  dstX: number,
  dstY: number,
  sams: readonly SAMInfo[],
): NukeTrajectoryData {
  const dx = dstX - srcX;
  const dy = dstY - srcY;
  return {
    p0x: srcX,
    p0y: srcY,
    p1x: srcX + dx / 3,
    p1y: srcY + dy / 3,
    p2x: srcX + (2 * dx) / 3,
    p2y: srcY + (2 * dy) / 3,
    p3x: dstX,
    p3y: dstY,
    tUntargetableStart: -1,
    tUntargetableEnd: -1,
    tSamIntercept: firstSamEntry(srcX, srcY, dstX, dstY, sams),
  };
}
