// World War 1936 P3: national focus (spec §11). Lane F (Task 2): start,
// queue, cancel, bypass, cancelIf, the day's progress, completion and the
// screens' cards. The same rules for humans and the AI (AiFocus picks).
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { Condition } from "@openfront/engine-api/ww1936/PoliticsDsl";
import {
  WW_FOCUS_QUEUE,
  type FocusDef,
  type FocusId,
  type WwFocusCard,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  inTree,
  replacedInTree,
  treePosIn,
} from "@openfront/engine-lib/ww1936/content/registry";
import { scaleFocusEffects } from "@openfront/engine-lib/ww1936/FocusScale";
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
  // P6 (pre-flight §0-1): a generic focus the country's pack replaces
  // counts as bypassed; the position is the one in the country's tree.
  if (replacedInTree(pol.content, c.tree, id)) return true;
  const pos = treePosIn(pol.content, c.tree, id);
  return pos !== undefined && c.focusState[pos] !== 0;
}

/** Done with its effects (a bypassed focus does not block its exclusive partners). */
export function focusCompleted(
  pol: WwPolitics,
  c: CountryPol,
  id: FocusId,
): boolean {
  const pos = treePosIn(pol.content, c.tree, id);
  return pos !== undefined && c.focusState[pos] === 1;
}

/**
 * Why `focus` cannot start now for `id` (shared by orders, the AI and the
 * cards); null if it can. Spec §11.2 start rules. asQueued: reserving a
 * place in the queue. The running focus and the focuses queued earlier
 * count as finished for prerequisites (the queue is a chain, in order); a
 * focus exclusive with one done, running or queued is refused; `available`
 * waits for the start (each entry is tried the day its turn comes).
 */
export function focusBlock(
  pol: WwPolitics,
  id: number,
  focus: FocusId,
  asQueued: boolean,
): WwOrderBlock | null {
  const c = pol.country(id);
  const f = focusDef(pol, focus);
  // P6 (pre-flight §0-1): in the country's tree (a pack's: the generic
  // focuses it keeps and its own), and for its tag when the focus names some.
  if (
    c === null ||
    f === undefined ||
    !inTree(pol.content, c.tree, focus) ||
    (f.countries !== undefined && !f.countries.includes(c.tag))
  ) {
    return "focus_unavailable";
  }
  if (focusFinished(pol, c, focus)) return "focus_done";
  if (c.focus?.id === focus) return "focus_busy";
  if (!asQueued && c.focus !== null) return "focus_busy";
  if (asQueued && c.queue.includes(focus)) return "focus_queued";
  if (asQueued && c.queue.length >= WW_FOCUS_QUEUE) return "focus_queue_full";
  const running = asQueued ? (c.focus?.id ?? null) : null;
  for (const group of f.prereq ?? []) {
    if (
      !group.some(
        (p) =>
          p === running ||
          focusFinished(pol, c, p) ||
          (asQueued && c.queue.includes(p)),
      )
    ) {
      return "focus_prereq";
    }
  }
  if (exclusiveHeld(pol, c, f, asQueued)) return "focus_exclusive";
  if (
    !asQueued &&
    !evalCondition(makeCtx(pol, id, id, 0, pol.mg.ticks()), f.available)
  ) {
    return "focus_unavailable";
  }
  return null;
}

/**
 * An exclusive partner is done, running or reserved. Reserving also looks
 * the other way: a focus ahead in the queue that names this one as its
 * exclusive partner (the lists are not always written on both sides).
 */
function exclusiveHeld(
  pol: WwPolitics,
  c: CountryPol,
  f: FocusDef,
  asQueued: boolean,
): boolean {
  for (const x of f.exclusive ?? []) {
    if (focusCompleted(pol, c, x) || c.focus?.id === x || c.queue.includes(x)) {
      return true;
    }
  }
  if (!asQueued) return false;
  return c.queue.some((q) => focusDef(pol, q)?.exclusive?.includes(f.id));
}

function markFinished(
  pol: WwPolitics,
  c: CountryPol,
  f: FocusDef,
  state: 1 | 2,
): void {
  c.focusState[treePosIn(pol.content, c.tree, f.id)!] = state;
  if (state === 1) c.focusesDone++;
  c.partial.delete(f.id);
  pol.markCountry(c.smallID);
}

/** One day of focus progress, milli (at least 1: a low focusSpeedPct never stalls or reverses it). */
function perDayMilli(c: CountryPol): number {
  return Math.max(1, Math.floor((1000 * (100 + c.stats.focusSpeedPct)) / 100));
}

/**
 * Spec §11.2 `focus_start`: nothing running, not done, prerequisites,
 * no exclusive partner, `available`. A true `bypass` finishes it at once
 * without effects; otherwise it goes on from its saved progress. Its
 * first day of progress is the country's next daily step (stepFocus).
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
  // Started, it is no longer waiting in the queue (no failed-queue notice later).
  const at = c.queue.indexOf(focus);
  if (at >= 0) c.queue.splice(at, 1);
  if (holds(makeCtx(pol, id, id, 0, tick), f.bypass)) {
    markFinished(pol, c, f, 2);
    return null;
  }
  c.focus = { id: f.id, progressMilli: c.partial.get(f.id) ?? 0 };
  c.partial.delete(f.id);
  return null;
}

/**
 * Spec §11.2: with nothing running it starts now; else it is reserved at
 * the end of the queue (at most WW_FOCUS_QUEUE, a chain: see focusBlock).
 */
export function queueFocus(
  pol: WwPolitics,
  id: number,
  focus: FocusId,
): WwOrderBlock | null {
  const c = pol.country(id)!;
  if (c.focus === null) return startFocus(pol, id, focus, pol.mg.ticks());
  const block = focusBlock(pol, id, focus, true);
  if (block !== null) return block;
  c.queue.push(focus);
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

/**
 * The queue entries from `from` on, minus the ones that lost a prerequisite
 * they only had through an entry that is gone: an entry stays when each of
 * its prerequisite groups has a member finished, running, or kept before it.
 */
function keepChained(
  pol: WwPolitics,
  c: CountryPol,
  queue: readonly FocusId[],
  from: number,
): FocusId[] {
  const kept = queue.slice(0, from);
  const running = c.focus?.id ?? null;
  for (const q of queue.slice(from)) {
    const f = focusDef(pol, q);
    const ok = (f?.prereq ?? []).every((group) =>
      group.some(
        (p) => p === running || focusFinished(pol, c, p) || kept.includes(p),
      ),
    );
    if (f !== undefined && ok) kept.push(q);
  }
  return kept;
}

/**
 * Takes `focus` out of the queue with the entries behind it that need it;
 * with no focus, empties the queue.
 */
export function unqueueFocus(
  pol: WwPolitics,
  id: number,
  focus?: FocusId,
): WwOrderBlock | null {
  const c = pol.country(id)!;
  if (c.queue.length === 0) return "focus_none";
  if (focus === undefined) {
    c.queue = [];
    return null;
  }
  const at = c.queue.indexOf(focus);
  if (at < 0) return "focus_none";
  c.queue = keepChained(
    pol,
    c,
    c.queue.filter((_, i) => i !== at),
    at,
  );
  return null;
}

/**
 * With nothing running, the queue's entries are tried in turn: one that
 * cannot start is dropped with one notice (it names the entry) and so are
 * the entries that needed it; the next is tried the same day. A skipped
 * (bypassed) focus finishes at once, so the next one is tried too.
 */
function startQueued(pol: WwPolitics, c: CountryPol, tick: number): void {
  while (c.focus === null && c.queue.length > 0) {
    const [head, ...rest] = c.queue;
    // The entries behind it do not block it (an exclusive partner there).
    c.queue = [];
    if (startFocus(pol, c.smallID, head, tick) === null) {
      c.queue = rest;
    } else {
      pol.message(c.smallID, "ww1936_focus_queue_failed", { focus: head });
      c.queue = keepChained(pol, c, rest, 0);
    }
  }
}

/**
 * Spec §11.2, the country's daily step: the running focus's bypass,
 * cancelIf, one day of progress and completion; then, with nothing
 * running, the queued focus or the AI's pick starts. One schedule for
 * everyone: a step credits only a focus that was running when it began, so
 * every focus — started by an order between two steps, or at a step by the
 * queue or the AI — earns its first day at the next step after its start.
 */
export function stepFocus(
  pol: WwPolitics,
  id: number,
  day: number,
  tick: number,
): void {
  const c = pol.country(id)!;
  if (c.focus !== null) runningDay(pol, c, tick);
  if (c.focus === null) startQueued(pol, c, tick);
  if (c.focus === null && !pol.isHuman(id)) {
    const pick = aiPickFocus(pol, id, day);
    if (pick !== null) startFocus(pol, id, pick, tick);
  }
}

/** The running focus's day: bypass, cancelIf, progress, completion. */
function runningDay(pol: WwPolitics, c: CountryPol, tick: number): void {
  const id = c.smallID;
  const run = c.focus!;
  const f = focusDef(pol, run.id)!;
  const ctx = makeCtx(pol, id, id, 0, tick);
  if (holds(ctx, f.bypass)) {
    c.focus = null;
    markFinished(pol, c, f, 2);
    return;
  }
  if (holds(ctx, f.cancelIf)) {
    cancelFocus(pol, id);
    return;
  }
  run.progressMilli += perDayMilli(c);
  if (run.progressMilli < f.days * 1000) return;
  c.focus = null;
  markFinished(pol, c, f, 1);
  applyEffects(ctx, scaleFocusEffects(f.effects));
  pol.message(id, "ww1936_focus_done", { focus: f.id });
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
  return Math.ceil((f.days * 1000) / perDayMilli(c)) * 1000;
}

/**
 * Spec §21.3 card states, tree order (WwFocusCard.state numbers): 1 done,
 * 2 bypassed, 3 running, 7 queued, 4 needs a prerequisite (reserve: it is
 * running or queued, so the focus can be queued behind it), 6 an exclusive
 * partner done, running or queued, 5 `available` false (with its failing
 * leaves), 0 open.
 */
export function focusCards(pol: WwPolitics, id: number): WwFocusCard[] {
  const c = pol.country(id)!;
  const ctx = makeCtx(pol, id, id, 0, pol.mg.ticks());
  const running = c.focus?.id ?? null;
  return pol.content.treeFocuses[c.tree].map((fi, idx) => {
    const f = pol.content.focuses[fi];
    const st = c.focusState[idx];
    if (st !== 0) return { idx, state: st, failing: [] };
    if (c.focus?.id === f.id) return { idx, state: 3, failing: [] };
    if (c.queue.includes(f.id)) return { idx, state: 7, failing: [] };
    // 4 when a group has no finished member; reserve: each such group has a
    // running or queued one (the focus can be queued behind it).
    let missing = false;
    let reserve = true;
    for (const g of f.prereq ?? []) {
      if (g.some((p) => focusFinished(pol, c, p))) continue;
      missing = true;
      if (!g.some((p) => p === running || c.queue.includes(p))) reserve = false;
    }
    if (missing && !reserve) return { idx, state: 4, failing: [] };
    if (exclusiveHeld(pol, c, f, true)) return { idx, state: 6, failing: [] };
    // A satisfied any/not is open even when one of its leaves is false.
    const open = evalCondition(ctx, f.available);
    if (missing) {
      return open
        ? { idx, state: 4, failing: [], reserve: true }
        : { idx, state: 5, failing: failingLeaves(ctx, f.available) };
    }
    if (open) return { idx, state: 0, failing: [] };
    return { idx, state: 5, failing: failingLeaves(ctx, f.available) };
  });
}
