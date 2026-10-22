// World War 1936 P6 lane W3 (plan Task 9): continuous focuses (spec §12).
// One at a time, beside the focus tree. They open after 10 focuses (done or
// bypassed, pre-flight §A17), on 1939-01-01, or by a cfocus_unlock effect.
// A pick takes effect at once; a pick or a clear locks the next pick for
// 30 days. State: CountryDepth.mech.cfocus (CONTINUOUS_FOCUSES index, -1
// none), cfocusLock (the first day a pick is allowed again), cfocusOpen.
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import {
  CFOCUS_LOCK_DAYS,
  CONTINUOUS_FOCUSES,
} from "@openfront/engine-api/ww1936/DepthTypes";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WwStats } from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  CFOCUS_STATS,
  cfocusBlock,
  cfocusOpen,
} from "@openfront/engine-lib/ww1936/MechRules";
import type { WwDepth } from "./WwDepth";

const NONE: Partial<WwStats> = {};

/** The continuous focus's (and other mechanisms') stats part. */
export function mechStatsOf(d: WwDepth, id: number): Partial<WwStats> {
  const c = d.countries[id];
  if (c === null || c === undefined || c.mech.cfocus < 0) return NONE;
  const cf = CONTINUOUS_FOCUSES[c.mech.cfocus];
  return cf === undefined ? NONE : CFOCUS_STATS[cf];
}

/** Spec §12: whether the country's continuous focuses are open now. */
export function cfocusOpenFor(d: WwDepth, id: number, day: number): boolean {
  const c = d.countries[id];
  if (c === null || c === undefined) return false;
  return cfocusOpen(d.ww.politics.doneFocusCount(id), day, c.mech.cfocusOpen);
}

/** The country's day: once open, the flag stays (the screens read it). */
export function dailyContinuousFocus(
  d: WwDepth,
  id: number,
  day: number,
): void {
  const c = d.countries[id];
  if (c === null || c === undefined || c.mech.cfocusOpen) return;
  if (cfocusOpenFor(d, id, day)) {
    c.mech.cfocusOpen = true;
    d.markCountry(id);
  }
}

/** cfocus_set / cfocus_clear. */
export function issueCfocus(
  d: WwDepth,
  id: number,
  o: DepthOrder,
  day: number,
): WwOrderBlock | null {
  const c = d.countries[id]!;
  const open = cfocusOpenFor(d, id, day);
  if (o.kind === "cfocus_set") {
    const want = CONTINUOUS_FOCUSES.indexOf(o.id);
    const block = cfocusBlock({
      open,
      current: c.mech.cfocus,
      lockUntil: c.mech.cfocusLock,
      day,
      want,
    });
    if (block !== null) return block;
    setCfocus(d, id, want, day);
    return null;
  }
  if (o.kind === "cfocus_clear") {
    if (!open) return "cfocus_locked";
    if (c.mech.cfocus < 0) return "bad_index";
    setCfocus(d, id, -1, day);
    return null;
  }
  return "bad_index";
}

/** A pick (or -1: a clear); either locks the next pick for 30 days. */
export function setCfocus(
  d: WwDepth,
  id: number,
  index: number,
  day: number,
): void {
  const c = d.countries[id];
  if (c === null || c === undefined) return;
  c.mech.cfocus = index;
  c.mech.cfocusLock = day + CFOCUS_LOCK_DAYS;
  c.mech.cfocusOpen = true;
  d.markStats(id);
  d.markCountry(id);
}
