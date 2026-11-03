// World War 1936 military thought sliders (design §5, §8): the state of
// the nine sliders, their daily drift toward the target, the stats they
// give, the thought_set order.
// Replaces the doctrine system (Doctrine.ts).
import type { WwOrder } from "@openfront/engine-api/Schemas";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import type {
  WwStatKey,
  WwStats,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  THOUGHT_SLIDER_COUNT,
  THOUGHT_SLIDERS,
  THOUGHT_START_YEAR,
} from "@openfront/engine-api/ww1936/ThoughtTypes";
import { dateOfDay } from "@openfront/engine-lib/ww1936/Calendar";
import {
  masteryXpMilli,
  permPctOfMilli,
  thoughtNotch,
  thoughtRateMilli,
  thoughtSetBlock,
  thoughtStartPos,
  thoughtStats,
  thoughtStep,
  thoughtYearPct,
} from "@openfront/engine-lib/ww1936/ThoughtRules";
import { aiPersonality } from "../economy/AiEconomy";
import type { EffectCtx } from "../politics/Dispatch";
import { aiThoughtTargets } from "./ThoughtAi";
import type { CountryDepth, WwDepth } from "./WwDepth";

/** The year multiplier (percent) the stats use today, from the common day. */
export function thoughtYearPctOf(d: WwDepth): number {
  const year = dateOfDay(Math.max(0, d.lastCommonDay)).year;
  return thoughtYearPct(Math.max(THOUGHT_START_YEAR, year));
}

function rsDoctrinePct(d: WwDepth, id: number): number {
  const s = d.ww.economy.country(id)?.stats as
    | Partial<Record<WwStatKey, number>>
    | undefined;
  return s?.rsDoctrinePct ?? 0;
}

/**
 * Design §5.5: the nine notches the country starts from. Pure, so nothing
 * stores it; the lobby's historical AI setting decides the row, so it stays
 * the same past V-J Day and the AI's officer corps stay keyed by it.
 */
export function startPosOf(d: WwDepth, id: number): number[] {
  const tag = d.ww.tagOf(id);
  return thoughtStartPos({
    table: d.ww.politics.content.startThoughts,
    tag,
    personality: aiPersonality(tag),
    historical: d.mg.config().historicalAi() === true,
    seed: d.ww.politics.seed,
    id,
  });
}

/**
 * Design §8: the start position of a country that has none yet (the first
 * clock, a woken slot's first day). An empty content table starts nothing.
 */
export function startThought(d: WwDepth, id: number): void {
  const c = d.country(id);
  if (c === null || c.th.started) return;
  if (d.ww.politics.content.startThoughts.length === 0) return;
  const pos = startPosOf(d, id);
  for (let s = 0; s < THOUGHT_SLIDER_COUNT; s++) {
    c.th.target[s] = pos[s];
    c.th.curMilli[s] = pos[s] * 1000;
  }
  c.th.started = true;
  d.markStats(id);
  d.markCountry(id);
}

/**
 * Design §8, the country's depth day: the air experience from the day's
 * sorties; the AI's (or an auto human's) judgement; each slider's step
 * toward its target; the stats follow when a notch or the year changed.
 */
export function dailyThought(d: WwDepth, id: number, day: number): void {
  const c = d.country(id);
  if (c === null) return;
  startThought(d, id);
  if (!c.th.started) return;
  if (!d.ww.isHumanControlled(id) || d.ww.autoOn(id, "thought")) {
    const t = aiThoughtTargets(d, id, day);
    if (t !== null) {
      for (let s = 0; s < THOUGHT_SLIDER_COUNT; s++) {
        const v = t[s];
        if (Number.isInteger(v))
          c.th.target[s] = Math.max(-10, Math.min(10, v));
      }
      d.markCountry(id);
    }
  }
  const rate = thoughtRateMilli(rsDoctrinePct(d, id));
  let changed = false;
  for (let s = 0; s < THOUGHT_SLIDER_COUNT; s++) {
    const before = c.th.curMilli[s];
    const after = thoughtStep(before, c.th.target[s], rate);
    if (after === before) continue;
    c.th.curMilli[s] = after;
    if (thoughtNotch(after) !== thoughtNotch(before)) changed = true;
  }
  const memo = thoughtMemo.get(c);
  if (changed || memo === undefined || memo.yearPct !== thoughtYearPctOf(d)) {
    d.markStats(id);
  }
  if (changed) d.markCountry(id);
}

/**
 * Derived, never state (a restored game has new country objects): the last
 * answer with what it was made from, the nine notches and the year's
 * multiplier. thoughtStats is pure, so equal inputs give equal stats.
 */
const thoughtMemo = new WeakMap<
  CountryDepth,
  { sig: number[]; yearPct: number; out: Readonly<Partial<WwStats>> }
>();
const NO_STATS: Readonly<Partial<WwStats>> = Object.freeze({});

/** Design §5.2, §6: the thought part of the country's stats. */
export function thoughtStatsOf(d: WwDepth, id: number): Partial<WwStats> {
  const c = d.country(id);
  if (c === null || !c.th.started) return NO_STATS;
  const yearPct = thoughtYearPctOf(d);
  const notches: number[] = [];
  for (let s = 0; s < THOUGHT_SLIDER_COUNT; s++) {
    notches.push(thoughtNotch(c.th.curMilli[s] ?? 0));
  }
  const memo = thoughtMemo.get(c);
  if (
    memo !== undefined &&
    memo.yearPct === yearPct &&
    memo.sig.every((n, i) => n === notches[i])
  ) {
    return memo.out;
  }
  const out = Object.freeze(thoughtStats(notches, yearPct)) as Readonly<
    Partial<WwStats>
  >;
  thoughtMemo.set(c, { sig: notches, yearPct, out });
  return out;
}

/**
 * thought_set (design §8): the target of one slider. Applies to the sender
 * only. In the preparation minute no time passes, so the actual position
 * follows at once.
 */
export function issueThought(
  d: WwDepth,
  id: number,
  o: Extract<WwOrder, { kind: "thought_set" }>,
  tick: number,
): WwOrderBlock | null {
  const c = d.country(id);
  if (c === null || !d.ww.isActor(id)) return "dead";
  startThought(d, id);
  const s = THOUGHT_SLIDERS.indexOf(o.slider);
  const block = thoughtSetBlock(s, o.pos, c.th.target[s] ?? 0);
  if (block !== null) return block;
  c.th.target[s] = o.pos;
  if (d.ww.inPrep(tick) && c.th.started) {
    c.th.curMilli[s] = o.pos * 1000;
    d.markStats(id);
  }
  d.markCountry(id);
  return null;
}

/**
 * The doctrine_mastery effect (ww15): the old mastery points are a
 * permanent bonus now: the experience masteryXpMilli gives, as a percent
 * (ThoughtRules.permPctOfMilli; naval: repair speed, the rest: division
 * experience).
 */
export function applyMasteryEffect(
  ctx: EffectCtx,
  e: Extract<Effect, { kind: "doctrine_mastery" }>,
  actor: number,
): void {
  const d = ctx.pol.ww.depth as WwDepth | undefined;
  if (d === undefined || d.country(actor) === null) return;
  const domain = ["land", "naval", "air"].indexOf(e.domain);
  if (domain < 0) return;
  d.addPermPct(
    actor,
    domain === 1 ? 1 : 0,
    permPctOfMilli(masteryXpMilli(e.amount)),
  );
}

/** The screens' view of the sliders (design §8). */
export function thoughtView(
  d: WwDepth,
  id: number,
): { target: number[]; curMilli: number[]; rateMilli: number } {
  const c = d.country(id);
  return {
    target: c === null ? [] : [...c.th.target],
    curMilli: c === null ? [] : [...c.th.curMilli],
    rateMilli: thoughtRateMilli(rsDoctrinePct(d, id)),
  };
}
