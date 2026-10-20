// World War 1936 P3: events (spec §12). STUB: lane E (Task 3) writes the
// bodies; the signatures are final.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { EventId } from "@openfront/engine-api/ww1936/PoliticsTypes";
import type { PendingEvent, QueuedEvent, WwPolitics } from "./WwPolitics";

/** One queued event reaches its receiver (spec §12.2-3, §12.4, §12.5). */
export function deliverEvent(
  pol: WwPolitics,
  q: QueuedEvent,
  tick: number,
): void {}

/** Applies an option's effects for the receiver (AI pick, human pick, deadline, delayed choice). */
export function applyOption(
  pol: WwPolitics,
  eventId: EventId,
  to: number,
  from: number,
  target: number,
  option: string,
  tick: number,
  depth: number,
): void {}

export function chooseEventOption(
  pol: WwPolitics,
  id: number,
  uid: number,
  option: string,
  tick: number,
): WwOrderBlock | null {
  return "no_event";
}

export function expireCards(pol: WwPolitics, tick: number): void {}

export function checkTriggeredEvents(
  pol: WwPolitics,
  id: number,
  day: number,
  tick: number,
): void {}

/** Spec §12.4: the option an AI (or a card's default) takes. */
export function aiChooseOption(
  pol: WwPolitics,
  eventId: EventId,
  to: number,
  from: number,
  target: number,
  day: number,
): string {
  const i = pol.content.eventIdx.get(eventId);
  return (
    (i === undefined ? undefined : pol.content.events[i])?.options[0]?.id ?? "a"
  );
}

/** Option ids `id` may pick now. */
export function openOptions(
  pol: WwPolitics,
  id: number,
  p: PendingEvent,
): string[] {
  const i = pol.content.eventIdx.get(p.eventId);
  return (
    (i === undefined ? undefined : pol.content.events[i])?.options.map(
      (o) => o.id,
    ) ?? []
  );
}
