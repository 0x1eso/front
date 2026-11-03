// World War 1936: the research queues' judgements over plain data. The
// engine (ResearchQueue) and the research screen call the same ones.
import {
  WW_RESEARCH_QUEUE,
  WW_TECH_IDS,
  WwOrderBlock,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { researchBlockOf } from "./EconomyChecks";
import { WW_TECHS } from "./WwTechs";

export type QueueMove = "up" | "down" | "top";

export interface QueueState {
  researched: ReadonlySet<WwTechId>;
  /** The techs running in the slots. */
  running: readonly WwTechId[];
  slotCount: number;
  /** Bit i: SPECIAL_PROJECTS[i] finished. */
  projects?: number;
  /** One queue per slot index (may be shorter than slotCount). */
  queues: readonly (readonly WwTechId[])[];
}

/** Every queued tech. */
export function queuedTechs(
  queues: readonly (readonly WwTechId[])[],
): WwTechId[] {
  return queues.flatMap((q) => [...q]);
}

/**
 * Why `tech` cannot be put at the end of slot `slot`'s queue; null when it
 * can. A prerequisite counts when done, running or queued anywhere; an
 * exclusive or a doctrine school is judged against what is done, running or
 * queued. Whether a slot will be free in time is not asked.
 */
export function reserveBlockOf(
  s: QueueState,
  tech: WwTechId,
  slot: number,
): WwOrderBlock | null {
  if (slot < 0 || slot >= s.slotCount) return "bad_slot";
  if (s.researched.has(tech)) return "researched";
  if (s.running.includes(tech)) return "in_progress";
  const queued = queuedTechs(s.queues);
  if (queued.includes(tech)) return "research_queued";
  if (WW_TECHS[tech].retired === true) return "no_tech";
  if ((s.queues[slot]?.length ?? 0) >= WW_RESEARCH_QUEUE) {
    return "research_queue_full";
  }
  const reached = new Set<WwTechId>([...s.researched, ...s.running, ...queued]);
  const occupants = [...s.running, ...queued];
  return researchBlockOf(
    {
      researched: reached,
      slots: occupants,
      slotCount: occupants.length + 1,
      projects: s.projects,
    },
    tech,
  );
}

/** `queue` with the entry at `index` moved; the same array when nothing moves. */
export function movedQueue(
  queue: readonly WwTechId[],
  index: number,
  move: QueueMove,
): WwTechId[] {
  const out = [...queue];
  if (index < 0 || index >= out.length) return out;
  const to = move === "top" ? 0 : move === "up" ? index - 1 : index + 1;
  if (to < 0 || to >= out.length || to === index) return out;
  const [x] = out.splice(index, 1);
  out.splice(to, 0, x);
  return out;
}

/**
 * The entries that would wait for ever: each queue is walked in order, an
 * entry starting once its queued prerequisites have started (they all finish
 * in the end). What no walk can start sits in a cycle or behind one. A
 * prerequisite that is nowhere (not done, not running, not queued) does not
 * count here; that entry is dropped when its turn comes.
 */
export function stuckEntries(
  researched: ReadonlySet<WwTechId>,
  running: readonly WwTechId[],
  queues: readonly (readonly WwTechId[])[],
): Set<WwTechId> {
  const queued = new Set(queuedTechs(queues));
  const done = new Set<WwTechId>([...researched, ...running]);
  const pos = queues.map(() => 0);
  for (let moved = true; moved; ) {
    moved = false;
    queues.forEach((q, i) => {
      for (;;) {
        const head = q[pos[i]];
        if (head === undefined) return;
        const ok = WW_TECHS[head].prereqs.every(
          (p) => done.has(p) || !queued.has(p),
        );
        if (!ok) return;
        done.add(head);
        pos[i]++;
        moved = true;
      }
    });
  }
  const stuck = new Set<WwTechId>();
  queues.forEach((q, i) => {
    for (let k = pos[i]; k < q.length; k++) stuck.add(q[k]);
  });
  return stuck;
}

/** `tech` and every queued entry that needs it, directly or through others, in WW_TECH_IDS order. */
export function withDependants(
  queues: readonly (readonly WwTechId[])[],
  tech: WwTechId,
): WwTechId[] {
  const gone = new Set<WwTechId>([tech]);
  const all = queuedTechs(queues);
  for (let grew = true; grew; ) {
    grew = false;
    for (const t of all) {
      if (gone.has(t)) continue;
      if (WW_TECHS[t].prereqs.some((p) => gone.has(p))) {
        gone.add(t);
        grew = true;
      }
    }
  }
  return WW_TECH_IDS.filter((t) => gone.has(t));
}
