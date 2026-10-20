// World War 1936 P3: guarantees, pacts, access, opinions (spec §16). STUB:
// lane D (Task 5) writes the bodies; the signatures are final.
import type { PolOrder } from "@openfront/engine-api/Schemas";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { EventId } from "@openfront/engine-api/ww1936/PoliticsTypes";
import type { WwPolitics } from "./WwPolitics";

export function treatyOrder(
  pol: WwPolitics,
  id: number,
  o: PolOrder,
  tick: number,
): WwOrderBlock | null {
  return "bad_target";
}

export function dailyTreaties(
  pol: WwPolitics,
  day: number,
  tick: number,
): void {}

/**
 * Controller ruling R1: the engine's answer to a diplomatic request event
 * (call to arms, accept score ≥ 50, a matching history beat), which E's
 * aiChooseOption asks first and a human card shows as its default; null:
 * the event's own AI weights decide. STUB: lane D (Task 5) writes it.
 */
export function diploEventChoice(
  pol: WwPolitics,
  eventId: EventId,
  to: number,
  from: number,
  target: number,
): string | null {
  return null;
}

/** Spec §16.4: −100..100. */
export function opinionOf(pol: WwPolitics, a: number, b: number): number {
  return 0;
}
