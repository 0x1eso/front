// World War 1936 P3: events (spec §12). Lane E (Task 3).
//
// Re-entrancy of the event queue (plan decision 13): WwPolitics.flushEvents
// delivers the tick's FIFO queue one entry at a time. An option effect may
// reach another entry point that flushes too — a war declared by an effect
// runs onWarDeclared, which flushes. That nested flush drains the same
// queue (everything queued so far, in order, and what those events queue in
// turn) before the rest of the first event's option runs; the outer loop then
// finds the queue empty or carries on with what came after. Every step is in
// queue order and the queue is plain data, so the result is the same on
// every client; only an option's effects after such a declaration run after
// the events queued before it, never in a different order between runs.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  EventDef,
  EventId,
  WW_EVENT_TIMEOUT_LONG_TICKS,
  WW_EVENT_TIMEOUT_TICKS,
  WW_HISTORY_EVENT_PCT,
  WW_MAX_PENDING_EVENTS,
  WW_TRIGGER_CHECK_DAYS,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  historicalAiActive,
  wwRealTicks,
} from "@openfront/engine-lib/ww1936/Pace";
import {
  aiWeight,
  idHash,
  P_DELAY,
  P_EVT,
  P_MTTH,
  pickWeighted,
  wwRoll,
} from "@openfront/engine-lib/ww1936/Roll";
import { evalCondition } from "./Conditions";
import { applyEffects, makeCtx } from "./Dispatch";
import { diploEventChoice } from "./Treaties";
import type { PendingEvent, QueuedEvent, WwPolitics } from "./WwPolitics";

export function eventDef(pol: WwPolitics, id: EventId): EventDef | undefined {
  const i = pol.content.eventIdx.get(id);
  return i === undefined ? undefined : pol.content.events[i];
}

/**
 * Spec §12.4: the option an AI takes, which is also a human card's default.
 * A diplomatic request (call to arms, accept score, a matching history beat)
 * is the treaty rules' answer first (controller ruling R1). Otherwise the
 * history option ~90% of the time with historical AI on, else by weight;
 * all weights 0 → the first open option.
 */
export function aiChooseOption(
  pol: WwPolitics,
  eventId: EventId,
  to: number,
  from: number,
  target: number,
  day: number,
): string {
  // P5 hook (A): the endgame's own events (gen_diplo_lend_lease) first.
  const endgame = pol.ww.endgame.aiEventChoice(eventId, to, from);
  if (endgame !== null) return endgame;
  const diplo = diploEventChoice(pol, eventId, to, from, target);
  if (diplo !== null) return diplo;
  const e = eventDef(pol, eventId);
  if (e === undefined) return "a";
  const ctx = makeCtx(pol, to, from, target, pol.mg.ticks());
  const open = e.options.map((o) => evalCondition(ctx, o.available));
  // Plan decision 26: one roll; its value mod 100 for the history check,
  // its high bits for the weighted pick.
  const roll = wwRoll(pol.seed, P_EVT, idHash(e.id), to, day);
  const weightOf = (i: number) => {
    const o = e.options[i];
    return open[i]
      ? aiWeight(o.ai, (j) => evalCondition(ctx, o.ai.mods![j].if))
      : 0;
  };
  const hist = e.options.findIndex((o, i) => o.history === true && open[i]);
  if (historicalAiActive(pol.mg.config(), day) && hist >= 0) {
    if (roll % 100 < (e.historyPct ?? WW_HISTORY_EVENT_PCT)) {
      return e.options[hist].id;
    }
    const k = pickWeighted(
      e.options.map((_, i) => (i === hist ? 0 : weightOf(i))),
      roll >>> 8,
    );
    return e.options[k >= 0 ? k : hist].id;
  }
  const k = pickWeighted(
    e.options.map((_, i) => weightOf(i)),
    roll >>> 8,
  );
  if (k >= 0) return e.options[k].id;
  const first = open.indexOf(true);
  return e.options[first >= 0 ? first : 0].id;
}

/** Option ids `id` may pick now, in option order. */
export function openOptions(
  pol: WwPolitics,
  id: number,
  p: PendingEvent,
): string[] {
  const e = eventDef(pol, p.eventId);
  if (e === undefined) return [];
  const ctx = makeCtx(pol, id, p.from, p.target, pol.mg.ticks());
  return e.options
    .filter((o) => evalCondition(ctx, o.available))
    .map((o) => o.id);
}

/**
 * Applies an option's effects for the receiver (AI pick, human pick,
 * deadline, delayed choice). Spec §12.5: an option that cannot be picked
 * any more falls to the first that can (or the first of all).
 */
export function applyOption(
  pol: WwPolitics,
  eventId: EventId,
  to: number,
  from: number,
  target: number,
  option: string,
  tick: number,
  depth: number,
): void {
  const e = eventDef(pol, eventId);
  if (e === undefined || !pol.living(to)) return;
  const ctx = makeCtx(pol, to, from, target, tick, depth);
  let o = e.options.find((x) => x.id === option);
  if (o === undefined || !evalCondition(ctx, o.available)) {
    o = e.options.find((x) => evalCondition(ctx, x.available)) ?? e.options[0];
  }
  applyEffects(ctx, o.effects);
  pol.markCountry(to);
  // P5 hook (A, plan decision 38): the option actually applied.
  pol.ww.endgame.onEventOption(e.id, o.id, to, from, tick);
}

/** One queued event reaches its receiver (spec §12.2-3, §12.4, §12.5). */
export function deliverEvent(
  pol: WwPolitics,
  q: QueuedEvent,
  tick: number,
): void {
  const e = eventDef(pol, q.eventId);
  if (e === undefined || !pol.living(q.to)) return;
  const c = pol.country(q.to)!;
  const day = pol.ww.day(tick);
  const once = e.once ?? "country";
  if (once === "country" && c.firedOnce.has(e.id)) return;
  if (once === "game" && pol.firedOnceGlobal.has(e.id)) return;
  // A date event with a trigger fires only when it holds that day (spec §12.2-1).
  if (
    e.date !== undefined &&
    e.trigger !== undefined &&
    !evalCondition(makeCtx(pol, q.to, q.from, q.target, tick), e.trigger)
  ) {
    return;
  }
  if (once === "country") c.firedOnce.add(e.id);
  if (once === "game") pol.firedOnceGlobal.add(e.id);
  if (e.cooldownDays !== undefined) {
    c.eventCooldown.set(e.id, day + e.cooldownDays);
  }
  if (e.kind === "news") {
    applyOption(
      pol,
      e.id,
      q.to,
      q.from,
      q.target,
      e.options[0].id,
      tick,
      q.depth,
    );
    // Controller ruling R3: country params end in "Tag"; none: "none".
    pol.news(e.id, {
      countryTag: pol.tagOf(q.to),
      targetTag: q.target > 0 ? pol.tagOf(q.target) : "none",
    });
    return;
  }
  const ai = aiChooseOption(pol, e.id, q.to, q.from, q.target, day);
  if (pol.isHuman(q.to)) {
    // Spec §12.5: at most 8 cards; the oldest gets its deadline now.
    if (c.pending.length >= WW_MAX_PENDING_EVENTS) {
      const old = c.pending.shift()!;
      applyOption(
        pol,
        old.eventId,
        q.to,
        old.from,
        old.target,
        old.aiOption,
        tick,
        0,
      );
      pol.message(q.to, "ww1936_event_auto_chosen", {
        event: old.eventId,
        option: old.aiOption,
      });
    }
    // Its real 20 / 30 s at the game's pace (Pace: fewer, longer ticks unlimited).
    const timeout = wwRealTicks(
      pol.mg.config().gameConfig(),
      e.timeoutSec === 30
        ? WW_EVENT_TIMEOUT_LONG_TICKS
        : WW_EVENT_TIMEOUT_TICKS,
    );
    const p: PendingEvent = {
      uid: pol.nextUid++,
      eventId: e.id,
      from: q.from,
      target: q.target,
      firedTick: tick,
      deadlineTick: tick + timeout,
      // Spec §26.4-12: an annexation of a human defaults to refusing.
      aiOption: e.humanDefault ?? ai,
    };
    c.pending.push(p);
    pol.noteCard(q.to, { ...p, open: openOptions(pol, q.to, p), to: q.to });
    pol.markCountry(q.to);
    return;
  }
  const [lo, hi] = e.aiDelayDays ?? [0, 0];
  const delay =
    hi > lo
      ? lo +
        (wwRoll(pol.seed, P_DELAY, idHash(e.id), q.to, day) % (hi - lo + 1))
      : lo;
  if (delay > 0) {
    pol.addDelayed({
      day: day + delay,
      kind: "choose",
      eventId: e.id,
      to: q.to,
      from: q.from,
      target: q.target,
      option: ai,
    });
    return;
  }
  applyOption(pol, e.id, q.to, q.from, q.target, ai, tick, q.depth);
}

/** A human's `event_choose` order. */
export function chooseEventOption(
  pol: WwPolitics,
  id: number,
  uid: number,
  option: string,
  tick: number,
): WwOrderBlock | null {
  const c = pol.country(id);
  if (c === null) return "no_event";
  const i = c.pending.findIndex((p) => p.uid === uid);
  if (i < 0) return "no_event";
  const p = c.pending[i];
  if (!openOptions(pol, id, p).includes(option)) return "bad_option";
  c.pending.splice(i, 1);
  applyOption(pol, p.eventId, id, p.from, p.target, option, tick, 0);
  return null;
}

/**
 * Spec §12.5: from deadlineTick + 1 the shown option applies. Countries by
 * smallID, cards in their order. A dead or capitulated country's cards
 * vanish without being applied.
 */
export function expireCards(pol: WwPolitics, tick: number): void {
  for (const c of pol.list()) {
    if (c.pending.length === 0) continue;
    if (!pol.living(c.smallID)) {
      c.pending = [];
      pol.markCountry(c.smallID);
      continue;
    }
    const due = c.pending.filter((p) => p.deadlineTick < tick);
    if (due.length === 0) continue;
    c.pending = c.pending.filter((p) => p.deadlineTick >= tick);
    for (const p of due) {
      applyOption(
        pol,
        p.eventId,
        c.smallID,
        p.from,
        p.target,
        p.aiOption,
        tick,
        0,
      );
      pol.message(c.smallID, "ww1936_event_auto_chosen", {
        event: p.eventId,
        option: p.aiOption,
      });
    }
    pol.markCountry(c.smallID);
  }
}

/**
 * Spec §12.2-2: every 5th day of the country, its table and the "any" table
 * in event order. With mtthDays the event fires when the stateless roll
 * falls under 5 / mtth (the same mean time as a daily 1 / mtth roll).
 * Dated events are checked only on their day (controller ruling R21).
 */
export function checkTriggeredEvents(
  pol: WwPolitics,
  id: number,
  day: number,
  tick: number,
): void {
  const c = pol.country(id)!;
  const own = pol.content.eventsByTag.get(c.tag) ?? [];
  const list =
    own.length === 0
      ? pol.content.eventsAny
      : [...own, ...pol.content.eventsAny].sort((a, b) => a - b);
  const ctx = makeCtx(pol, id, id, 0, tick);
  let last = -1;
  for (const i of list) {
    if (i === last) continue;
    last = i;
    const e = pol.content.events[i];
    if (e.date !== undefined) continue;
    const once = e.once ?? "country";
    if (once === "country" && c.firedOnce.has(e.id)) continue;
    if (once === "game" && pol.firedOnceGlobal.has(e.id)) continue;
    if ((c.eventCooldown.get(e.id) ?? -1) > day) continue;
    if (!evalCondition(ctx, e.trigger)) continue;
    if (
      e.mtthDays !== undefined &&
      wwRoll(pol.seed, P_MTTH, pol.content.eventHash[i], id, day) %
        e.mtthDays >=
        WW_TRIGGER_CHECK_DAYS
    ) {
      continue;
    }
    pol.queueEvent(e.id, id, id, 0, 0);
  }
}
