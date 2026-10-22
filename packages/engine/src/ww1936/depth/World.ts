// P6 lane W1 (plan Task 7): the world devices' orders, common day and
// region status (spec §16).
//
// The region status (pre-flight §0-8: state, `world.regionStatus`) is made
// on the common day, before any country's turn, from the floods, the
// atomic bombs and the exhausted resources; P1 and P2 read it O(1) the
// rest of the day: supply × ½ for a flood and × ½ for a bomb, building
// speed −50% after a bomb, the way in −30% while flooded, resources −50%
// after scorched earth. A dam destroyed mid-day writes it at once.
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import { nukeOutcome } from "@openfront/engine-lib/ww1936/ProjectRules";
import { FLOOD, SCORCH } from "@openfront/engine-lib/ww1936/WorldRules";
import { dayCommonHarbors, issueHarbor } from "./Harbors";
import { landmarkDates } from "./Landmarks";
import { dayCommonRailGuns, issueRailGun } from "./RailGuns";
import { dayCommonScorch, issueScorch } from "./Scorch";
import type { WwDepth } from "./WwDepth";

export interface RegionStatus {
  /** Supply multiplier, ‰ (flood, scorch, nuke). */
  supplyPm: number;
  buildPct: number;
  moveCutPct: number;
  resourcePct: number;
}
const NEUTRAL: RegionStatus = {
  supplyPm: 1000,
  buildPct: 0,
  moveCutPct: 0,
  resourcePct: 0,
};
/** Spec §9.5: a bombed region's supply and building cuts (ProjectRules' constants). */
const NUKE = nukeOutcome(0, 0, 0, 0);

/** railgun_assign, railgun_return, harbor_deploy, scorch. */
export function issueWorld(
  d: WwDepth,
  id: number,
  o: DepthOrder,
  tick: number,
): WwOrderBlock | null {
  switch (o.kind) {
    case "railgun_assign":
    case "railgun_return":
      return issueRailGun(d, id, o);
    case "harbor_deploy":
      return issueHarbor(d, id, o);
    case "scorch":
      return issueScorch(d, id, o, tick);
    default:
      return "bad_index";
  }
}

/** Floods, harbours, the scorch queue, exhausted resources, dam and landmark dates. */
export function dayCommonWorld(d: WwDepth, day: number, tick: number): void {
  const w = d.world;
  // Expired floods, scorch marks, exhausted resources and bombs.
  const live = (xs: [number, number][]) => {
    const keep = xs.filter((x) => x[1] >= day);
    if (keep.length !== xs.length) d.markGlobal();
    return keep;
  };
  w.floodUntil = live(w.floodUntil);
  w.scorchedUntil = live(w.scorchedUntil);
  w.exhaustedUntil = live(w.exhaustedUntil);
  for (const [r, until] of [...d.nuked]) {
    if (until < day) {
      d.nuked.delete(r);
      d.markGlobal();
    }
  }
  dayCommonHarbors(d, day);
  dayCommonScorch(d, day, tick);
  dayCommonRailGuns(d);
  // (A dam working from a date counts in its controller's energy that day:
  // Energy reads DAM_FROM.)
  landmarkDates(d, day);
  refreshRegionStatus(d, day);
}

/**
 * Pre-flight §0-8: `world.regionStatus` again from the floods, bombs and
 * exhausted resources live on `day` (region order; the index follows).
 */
export function refreshRegionStatus(d: WwDepth, day: number): void {
  const w = d.world;
  const flooded = new Set<number>();
  const nuked = new Set<number>();
  const exhausted = new Set<number>();
  for (const [r, until] of w.floodUntil) if (until >= day) flooded.add(r);
  for (const [r, until] of d.nuked) if (until >= day) nuked.add(r);
  for (const [r, until] of w.exhaustedUntil) if (until >= day) exhausted.add(r);
  const regions = [...new Set([...flooded, ...nuked, ...exhausted])].sort(
    (a, b) => a - b,
  );
  const next: [number, number, number, number, number][] = [];
  for (const r of regions) {
    let supply = 1000;
    if (flooded.has(r)) {
      supply = Math.floor((supply * (100 + FLOOD.supplyPct)) / 100);
    }
    if (nuked.has(r)) {
      supply = Math.floor((supply * (100 + NUKE.supplyPct)) / 100);
    }
    next.push([
      r,
      supply,
      nuked.has(r) ? NUKE.buildPct : 0,
      flooded.has(r) ? FLOOD.moveCutPct : 0,
      exhausted.has(r) ? SCORCH.resourcePct : 0,
    ]);
  }
  const same =
    next.length === w.regionStatus.length &&
    next.every((x, i) => x.every((v, j) => v === w.regionStatus[i][j]));
  if (same) return;
  w.regionStatus = next;
  d.reindexSparse();
}

/** The status object of each regionStatus row (derived: rows are replaced, never edited). */
const STATUS_OF = new WeakMap<readonly number[], RegionStatus>();

/** The region's flood / scorch / nuke status (read O(1) by P1 and P2). */
export function regionStatus(d: WwDepth, region: number): RegionStatus {
  const rows = d.world.regionStatus;
  if (rows.length === 0) return NEUTRAL;
  const i = d.regionStatusIndex.get(region);
  if (i === undefined) return NEUTRAL;
  const x = rows[i];
  let s = STATUS_OF.get(x);
  if (s === undefined) {
    s = { supplyPm: x[1], buildPct: x[2], moveCutPct: x[3], resourcePct: x[4] };
    STATUS_OF.set(x, s);
  }
  return s;
}
