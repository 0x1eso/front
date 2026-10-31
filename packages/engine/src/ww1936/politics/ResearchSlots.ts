// World War 1936 research overhaul R1 (changes §1.3, §1.7): where a
// country's research slots come from, and the next source the research
// screen's slot chip points at (its yellow dot when it can be taken now).
// Screens only: nothing here is state, and auto-research never takes a
// focus or a decision (the approved automation scope).
import {
  WW_MAX_SLOTS,
  WwSlotHint,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import type { FocusDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { startResearchSlots } from "@openfront/engine-lib/ww1936/EconomyStart";
import { evalCondition } from "./Conditions";
import { decisionBlock } from "./Decisions";
import { makeCtx } from "./Dispatch";
import { focusFinished } from "./Focus";
import type { WwPolitics } from "./WwPolitics";

/** The decision that gives a research slot once a game (content/decisions/generic.ts). */
export const SCIENCE_DECISION = "gen_science_mobilisation";

export interface ResearchSlotView {
  sources: { start: number; focus: number; decision: number; max: number };
  hint?: WwSlotHint;
}

const givesSlot = (f: FocusDef) =>
  (f.effects ?? []).some((e) => e.kind === "research_slot");

/** The research slot view of country `id` (null: no politics state for it). */
export function researchSlotView(
  pol: WwPolitics,
  id: number,
  slotCount: number,
): ResearchSlotView | null {
  const c = pol.country(id);
  if (c === null) return null;
  const extra = c.extraResearchSlots;
  const decision = c.taken.has(SCIENCE_DECISION) ? Math.min(1, extra) : 0;
  const start = startResearchSlots(c.tag);
  let treeSlots = 0;
  for (const fi of pol.content.treeFocuses[c.tree]) {
    const f = pol.content.focuses[fi];
    if (f.countries !== undefined && !f.countries.includes(c.tag)) continue;
    if (givesSlot(f)) treeSlots++;
  }
  const sources = {
    start,
    focus: Math.max(0, extra - decision),
    decision,
    max: Math.min(WW_MAX_SLOTS, start + treeSlots + 1),
  };
  if (slotCount >= WW_MAX_SLOTS) return { sources };
  const ctx = makeCtx(pol, id, id, 0, pol.mg.ticks());
  let later: string | null = null;
  for (const fi of pol.content.treeFocuses[c.tree]) {
    const f = pol.content.focuses[fi];
    if (!givesSlot(f) || focusFinished(pol, c, f.id)) continue;
    if (f.countries !== undefined && !f.countries.includes(c.tag)) continue;
    const prereqsMet = (f.prereq ?? []).every((g) =>
      g.some((p) => focusFinished(pol, c, p)),
    );
    if (c.focus?.id !== f.id && prereqsMet && evalCondition(ctx, f.available)) {
      return { sources, hint: { kind: "focus", id: f.id, ready: true } };
    }
    later ??= f.id;
  }
  const decisionLeft = !c.taken.has(SCIENCE_DECISION);
  if (decisionLeft && decisionBlock(pol, id, SCIENCE_DECISION, 0) === null) {
    return {
      sources,
      hint: { kind: "decision", id: SCIENCE_DECISION, ready: true },
    };
  }
  if (later !== null) {
    return { sources, hint: { kind: "focus", id: later, ready: false } };
  }
  if (decisionLeft) {
    return {
      sources,
      hint: { kind: "decision", id: SCIENCE_DECISION, ready: false },
    };
  }
  return { sources };
}
