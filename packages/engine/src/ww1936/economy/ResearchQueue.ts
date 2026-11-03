// World War 1936: a research queue for each research slot (owner request
// 2026-11-03). A slot that frees takes the first entry of its own queue; an
// entry whose prerequisite still runs in another slot keeps the slot
// waiting; one that can never start is dropped with what depends on it.
// Only a human reserves; the AI and the automatic research never touch a
// queue (the automatic research only skips what is queued).
import { MessageType } from "@openfront/engine-api/game/GameTypes";
import {
  WW_RESEARCH_QUEUE,
  WwOrderBlock,
  WwSlotQueue,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  movedQueue,
  queuedTechs,
  QueueMove,
  QueueState,
  reserveBlockOf,
  stuckEntries,
  withDependants,
} from "@openfront/engine-lib/ww1936/ResearchQueueRules";
import { WW_TECHS } from "@openfront/engine-lib/ww1936/WwTechs";
import type { Player } from "../../game/Game";
import { placeResearch, projectsDone, researchBlock } from "./ResearchRun";
import type { CountryEconomy, WwEconomy } from "./WwEconomy";

export function hasQueues(ce: CountryEconomy): boolean {
  return ce.rq.some((q) => q.length > 0);
}

function runningTechs(ce: CountryEconomy): WwTechId[] {
  return ce.slots.flatMap((s) => (s === null ? [] : [s.tech]));
}

function stateOf(econ: WwEconomy, ce: CountryEconomy): QueueState {
  return {
    researched: ce.researched,
    running: runningTechs(ce),
    slotCount: ce.totals.slotCount,
    projects: projectsDone(econ, ce),
    queues: ce.rq,
  };
}

function trim(ce: CountryEconomy): void {
  while (ce.rq.length > 0 && ce.rq[ce.rq.length - 1].length === 0) ce.rq.pop();
}

/** research_reserve: `tech` at the end of slot `slot`'s queue. */
export function reserveResearch(
  econ: WwEconomy,
  ce: CountryEconomy,
  tech: WwTechId,
  slot: number,
): WwOrderBlock | null {
  if (!econ.ww.isHumanControlled(ce.smallID)) return "not_controlled";
  const block = reserveBlockOf(stateOf(econ, ce), tech, slot);
  if (block !== null) return block;
  while (ce.rq.length <= slot) ce.rq.push([]);
  ce.rq[slot].push(tech);
  // A free slot takes it at once; the daily step does the rest.
  const p = econ.mg.playerBySmallID(ce.smallID);
  if (p.isPlayer()) stepQueues(econ, ce, p);
  trim(ce);
  return null;
}

/**
 * research_unreserve: `tech` out of its queue, and the entries that need it.
 * Saved progress stays with the tech (a queued tech has none of its own).
 */
export function unreserveResearch(
  econ: WwEconomy,
  ce: CountryEconomy,
  tech: WwTechId,
): WwOrderBlock | null {
  if (!econ.ww.isHumanControlled(ce.smallID)) return "not_controlled";
  if (!queuedTechs(ce.rq).includes(tech)) return "bad_index";
  removeEntries(ce, withDependants(ce.rq, tech));
  trim(ce);
  return null;
}

/** research_reorder: `tech` one place up or down, or to the top of its queue. */
export function reorderResearch(
  econ: WwEconomy,
  ce: CountryEconomy,
  tech: WwTechId,
  move: QueueMove,
): WwOrderBlock | null {
  if (!econ.ww.isHumanControlled(ce.smallID)) return "not_controlled";
  const slot = ce.rq.findIndex((q) => q.includes(tech));
  if (slot < 0) return "bad_index";
  const moved = movedQueue(ce.rq[slot], ce.rq[slot].indexOf(tech), move);
  const next = ce.rq.map((q, i) => (i === slot ? moved : q));
  // No entry may wait for one behind it, in its queue or across queues.
  if (stuckEntries(ce.researched, runningTechs(ce), next).size > 0) {
    return "queue_order";
  }
  ce.rq = next;
  const p = econ.mg.playerBySmallID(ce.smallID);
  if (p.isPlayer()) stepQueues(econ, ce, p);
  trim(ce);
  return null;
}

function removeEntries(ce: CountryEconomy, gone: readonly WwTechId[]): void {
  ce.rq = ce.rq.map((q) => q.filter((t) => !gone.includes(t)));
}

/** What the head of a queue does now: start, wait for a running or queued prerequisite, or never start. */
type Turn =
  | { kind: "start" }
  | { kind: "wait"; on: WwTechId }
  | { kind: "dead" };

function turnOf(econ: WwEconomy, ce: CountryEconomy, tech: WwTechId): Turn {
  const block = researchBlock(econ, ce, tech);
  if (block === null) return { kind: "start" };
  if (block !== "prereq") return { kind: "dead" };
  const missing = WW_TECHS[tech].prereqs.filter((p) => !ce.researched.has(p));
  const coming = new Set<WwTechId>([
    ...runningTechs(ce),
    ...queuedTechs(ce.rq).filter((t) => t !== tech),
  ]);
  return missing.every((p) => coming.has(p))
    ? { kind: "wait", on: missing[0] }
    : { kind: "dead" };
}

/**
 * The daily step, after the research step: queues of slots that went away
 * join the shortest remaining queue; entries that could only wait for ever
 * go; each empty slot takes its queue's first entry, the next one the same
 * day when it can never start. One notice names what was dropped.
 */
export function stepQueues(
  econ: WwEconomy,
  ce: CountryEconomy,
  p: Player,
): void {
  if (!hasQueues(ce)) return;
  const dropped: WwTechId[] = [];
  mergeLostSlots(ce, dropped);
  const stuck = stuckEntries(ce.researched, runningTechs(ce), ce.rq);
  for (const t of stuck) {
    if (!dropped.includes(t)) {
      dropped.push(...withDependants(ce.rq, t));
      removeEntries(ce, withDependants(ce.rq, t));
    }
  }
  for (let again = true; again; ) {
    again = false;
    for (let i = 0; i < ce.totals.slotCount; i++) {
      const q = ce.rq[i];
      if (q === undefined || q.length === 0 || (ce.slots[i] ?? null) !== null) {
        continue;
      }
      const turn = turnOf(econ, ce, q[0]);
      if (turn.kind === "wait") continue;
      again = true;
      if (turn.kind === "start") {
        placeResearch(econ, ce, q.shift()!, i);
      } else {
        const gone = withDependants(ce.rq, q[0]);
        dropped.push(...gone);
        removeEntries(ce, gone);
      }
    }
  }
  trim(ce);
  if (dropped.length > 0 && econ.ww.isHumanControlled(ce.smallID)) {
    econ.mg.displayMessage(
      "events_display.ww1936_research_queue_failed",
      MessageType.WORLD_WAR,
      p.id(),
      undefined,
      { tech: dropped[0] },
    );
  }
}

/**
 * A queue past the slot count (a slot went away) moves to the end of the
 * shortest remaining queue, the lowest slot on a tie; what no longer fits
 * in WW_RESEARCH_QUEUE is dropped.
 */
function mergeLostSlots(ce: CountryEconomy, dropped: WwTechId[]): void {
  const n = ce.totals.slotCount;
  if (n <= 0 || ce.rq.length <= n) return;
  const lost = ce.rq.splice(n);
  while (ce.rq.length < n) ce.rq.push([]);
  for (const q of lost) {
    for (const t of q) {
      let to = 0;
      for (let i = 1; i < n; i++)
        if (ce.rq[i].length < ce.rq[to].length) to = i;
      if (ce.rq[to].length >= WW_RESEARCH_QUEUE) dropped.push(t);
      else ce.rq[to].push(t);
    }
  }
}

/** The queues as the screens read them (a waiting slot names its prerequisite). */
export function queueView(econ: WwEconomy, ce: CountryEconomy): WwSlotQueue[] {
  const n = Math.max(ce.rq.length, ce.totals.slotCount);
  return Array.from({ length: n }, (_, i) => {
    const techs = [...(ce.rq[i] ?? [])];
    if (techs.length === 0 || (ce.slots[i] ?? null) !== null) return { techs };
    const turn = turnOf(econ, ce, techs[0]);
    return turn.kind === "wait" ? { techs, waitingOn: turn.on } : { techs };
  });
}

/**
 * For the automatic research: the head of each slot's queue (the slot is
 * held; null: free) and every queued tech (never picked by it).
 */
export function queueHolds(ce: CountryEconomy): {
  held: (WwTechId | null)[];
  queued: WwTechId[];
} {
  return {
    held: ce.slots.map((_, i) => ce.rq[i]?.[0] ?? null),
    queued: queuedTechs(ce.rq),
  };
}
