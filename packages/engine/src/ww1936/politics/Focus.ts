// World War 1936 P3: national focus (spec §11). Lane F (Task 2): start,
// queue, cancel, bypass, cancelIf, the day's progress, completion and the
// screens' cards. The same rules for humans and the AI (AiFocus picks).
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { Condition } from "@openfront/engine-api/ww1936/PoliticsDsl";
import type {
  FocusDef,
  FocusId,
  WwFocusCard,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { aiPickFocus } from "./AiFocus";
import { evalCondition, failingLeaves } from "./Conditions";
import { applyEffects, EffectCtx, makeCtx } from "./Dispatch";
import type { CountryPol, WwPolitics } from "./WwPolitics";

export function focusDef(pol: WwPolitics, id: FocusId): FocusDef | undefined {
  const i = pol.content.focusIdx.get(id);
  return i === undefined ? undefined : pol.content.focuses[i];
}

/** A condition that is given and true (an absent bypass / cancelIf never holds). */
export const holds = (ctx: EffectCtx, c: Condition | undefined): boolean =>
  c !== undefined && evalCondition(ctx, c);

/** Done or bypassed: both count for prerequisites (spec §11.2). */
export function focusFinished(
  pol: WwPolitics,
  c: CountryPol,
  id: FocusId,
): boolean {
  const pos = pol.content.treePos.get(id);
  return (
    pos !== undefined &&
    focusDef(pol, id)?.tree === c.tree &&
    c.focusState[pos] !== 0
  );
}

/** Done with its effects (a bypassed focus does not block its exclusive partners). */
export function focusCompleted(
  pol: WwPolitics,
  c: CountryPol,
  id: FocusId,
): boolean {
  const pos = pol.content.treePos.get(id);
  return (
    pos !== undefined &&
    focusDef(pol, id)?.tree === c.tree &&
    c.focusState[pos] === 1
  );
}

/**
 * Why `focus` cannot start now for `id` (shared by orders, the AI and the
 * cards); null if it can. Spec §11.2 start rules. asQueued: the running
 * focus counts as finished for prerequisites and `available` waits for the
 * start (the queue is tried again the day the running one ends).
 */
export function focusBlock(
  pol: WwPolitics,
  id: number,
  focus: FocusId,
  asQueued: boolean,
): WwOrderBlock | null {
  const c = pol.country(id);
  const f = focusDef(pol, focus);
  if (c === null || f === undefined || f.tree !== c.tree) {
    return "focus_unavailable";
  }
  if (focusFinished(pol, c, focus)) return "focus_done";
  if (c.focus?.id === focus) return "focus_busy";
  if (!asQueued && c.focus !== null) return "focus_busy";
  const running = asQueued ? (c.focus?.id ?? null) : null;
  for (const group of f.prereq ?? []) {
    if (!group.some((p) => p === running || focusFinished(pol, c, p))) {
      return "focus_prereq";
    }
  }
  for (const x of f.exclusive ?? []) {
    if (focusCompleted(pol, c, x) || c.focus?.id === x || c.queued === x) {
      return "focus_exclusive";
    }
  }
  if (
    !asQueued &&
    !evalCondition(makeCtx(pol, id, id, 0, pol.mg.ticks()), f.available)
  ) {
    return "focus_unavailable";
  }
  return null;
}

function markFinished(
  pol: WwPolitics,
  c: CountryPol,
  f: FocusDef,
  state: 1 | 2,
): void {
  c.focusState[pol.content.treePos.get(f.id)!] = state;
  if (state === 1) c.focusesDone++;
  c.partial.delete(f.id);
  pol.markCountry(c.smallID);
}

/**
 * Spec §11.2 `focus_start`: nothing running, not done, prerequisites,
 * no exclusive partner, `available`. A true `bypass` finishes it at once
 * without effects; otherwise it goes on from its saved progress.
 */
export function startFocus(
  pol: WwPolitics,
  id: number,
  focus: FocusId,
  tick: number,
): WwOrderBlock | null {
  const block = focusBlock(pol, id, focus, false);
  if (block !== null) return block;
  const c = pol.country(id)!;
  const f = focusDef(pol, focus)!;
  if (holds(makeCtx(pol, id, id, 0, tick), f.bypass)) {
    markFinished(pol, c, f, 2);
    return null;
  }
  c.focus = { id: f.id, progressMilli: c.partial.get(f.id) ?? 0 };
  c.partial.delete(f.id);
  return null;
}

/** Spec §11.2: one queued focus; with nothing running it starts now. A new queue replaces the old one. */
export function queueFocus(
  pol: WwPolitics,
  id: number,
  focus: FocusId,
): WwOrderBlock | null {
  const c = pol.country(id)!;
  if (c.focus === null) return startFocus(pol, id, focus, pol.mg.ticks());
  const block = focusBlock(pol, id, focus, true);
  if (block !== null) return block;
  c.queued = focus;
  return null;
}

/** Spec §11.2: the progress waits in `partial` (HOI4: cancelling loses nothing). */
export function cancelFocus(pol: WwPolitics, id: number): WwOrderBlock | null {
  const c = pol.country(id)!;
  if (c.focus === null) return "focus_none";
  c.partial.set(c.focus.id, c.focus.progressMilli);
  c.focus = null;
  return null;
}

export function unqueueFocus(pol: WwPolitics, id: number): WwOrderBlock | null {
  const c = pol.country(id)!;
  if (c.queued === null) return "focus_none";
  c.queued = null;
  return null;
}

/** The queued focus tries to start; a refusal clears it and tells the owner. */
function startQueued(pol: WwPolitics, c: CountryPol, tick: number): void {
  const q = c.queued;
  if (q === null) return;
  c.queued = null;
  if (startFocus(pol, c.smallID, q, tick) !== null) {
    pol.message(c.smallID, "ww1936_focus_queue_failed", { focus: q });
  }
}

/** Spec §11.2: the day's progress, bypass, cancelIf, completion, the queued one. */
export function stepFocus(
  pol: WwPolitics,
  id: number,
  day: number,
  tick: number,
): void {
  const c = pol.country(id)!;
  if (c.focus === null) startQueued(pol, c, tick);
  if (c.focus === null && !pol.isHuman(id)) {
    const pick = aiPickFocus(pol, id, day);
    if (pick !== null) startFocus(pol, id, pick, tick);
  }
  if (c.focus === null) return; // an empty day earns nothing (spec §11.2)
  const f = focusDef(pol, c.focus.id)!;
  const ctx = makeCtx(pol, id, id, 0, tick);
  if (holds(ctx, f.bypass)) {
    c.focus = null;
    markFinished(pol, c, f, 2);
    startQueued(pol, c, tick);
    return;
  }
  if (holds(ctx, f.cancelIf)) {
    cancelFocus(pol, id);
    return;
  }
  c.focus.progressMilli += Math.floor(
    (1000 * (100 + c.stats.focusSpeedPct)) / 100,
  );
  if (c.focus.progressMilli < f.days * 1000) return;
  c.focus = null;
  markFinished(pol, c, f, 1);
  applyEffects(ctx, f.effects);
  pol.message(id, "ww1936_focus_done", { focus: f.id });
  startQueued(pol, c, tick);
}

/** Days a focus takes with the country's focusSpeedPct, milli. */
export function focusDaysMilli(
  pol: WwPolitics,
  id: number,
  focus: FocusId,
): number {
  const f = focusDef(pol, focus);
  const c = pol.country(id);
  if (f === undefined || c === null) return 0;
  const perDay = Math.max(
    1,
    Math.floor((1000 * (100 + c.stats.focusSpeedPct)) / 100),
  );
  return Math.ceil((f.days * 1000) / perDay) * 1000;
}

/**
 * Spec §21.3 card states, tree order (WwFocusCard.state numbers): 1 done,
 * 2 bypassed, 3 running, 7 queued, 4 needs a prerequisite, 6 an exclusive
 * partner done, running or queued (controller ruling R21), 5 `available`
 * false (with its failing leaves), 0 open.
 */
export function focusCards(pol: WwPolitics, id: number): WwFocusCard[] {
  const c = pol.country(id)!;
  const ctx = makeCtx(pol, id, id, 0, pol.mg.ticks());
  return pol.content.treeFocuses[c.tree].map((fi, idx) => {
    const f = pol.content.focuses[fi];
    const st = c.focusState[idx];
    if (st !== 0) return { idx, state: st, failing: [] };
    if (c.focus?.id === f.id) return { idx, state: 3, failing: [] };
    if (c.queued === f.id) return { idx, state: 7, failing: [] };
    if (
      (f.prereq ?? []).some((g) => !g.some((p) => focusFinished(pol, c, p)))
    ) {
      return { idx, state: 4, failing: [] };
    }
    if (
      (f.exclusive ?? []).some(
        (x) => focusCompleted(pol, c, x) || c.focus?.id === x || c.queued === x,
      )
    ) {
      return { idx, state: 6, failing: [] };
    }
    // A satisfied any/not is open even when one of its leaves is false.
    if (evalCondition(ctx, f.available)) return { idx, state: 0, failing: [] };
    return { idx, state: 5, failing: failingLeaves(ctx, f.available) };
  });
}
