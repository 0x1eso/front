// World War 1936 P3: the AI's politics and its war decision (spec §18.6,
// §18.7; plan Task 6). Runs in an AI country's political day, after its
// focus, missions and triggered events.
//
// Political power goes in the spec's order (§18.6, "정치력 순서"): the law
// the P1 AI economy sets next is kept back first (controller ruling R10),
// with what the history beats due soon will spend; then an advisor; then
// — ahead of the decisions in the PP order, controller ruling 3 — a
// justification; then a decision, a guarantee, a faction invitation (or
// join request), an access request; the war decision last. A step that
// wants something it cannot pay for yet keeps that PP back from the later
// ones, so it is saved for rather than spent on cheaper things.
//
// One war score (aiWarScore) judges every war — the war decision, the
// justification's target and, with historical AI, the history beats: a
// beat is a suggestion (owner direction) the AI takes when the score says
// so, or waits for (HistoryBeats asks aiBeatReady), so games diverge.
//
// Everything here reads state and gives its orders through pol.issue (a
// human's rules). There is no randomness: choices follow fixed orders
// (traits, content, smallID), and the steps that need not run daily are
// staggered by `(day + smallID) % n`, a function of the state alone. The
// caches below are derived (built from the state they are keyed on).
import type { PolOrder } from "@openfront/engine-api/Schemas";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { LAW_KINDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { Condition } from "@openfront/engine-api/ww1936/PoliticsDsl";
import {
  ADVISOR_COST,
  ADVISOR_SLOTS,
  DecisionDef,
  DiploAsk,
  HistoryBeat,
  IDEO_COM,
  IDEO_DEM,
  IDEO_FAS,
  SLOT_BRANCHES,
  TraitId,
  WW_BEAT_WINDOW_DEFAULT_DAYS,
  WW_COST,
  WW_NAP_BREAK_DAYS,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import type { ContentRegistry } from "@openfront/engine-lib/ww1936/content/registry";
import {
  costWith,
  factionGate,
  justifyCost,
  justifyGate,
  lawCost,
} from "@openfront/engine-lib/ww1936/PoliticsRules";
import { aiWeight, idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { declareWar, declareWarBlock } from "../Diplomacy";
import {
  AiPersonality,
  aiLawTarget,
  aiPersonality,
} from "../economy/AiEconomy";
import type { CountryEconomy } from "../economy/WwEconomy";
import { aiOverseasWarScore } from "../navy/AiNavy";
import { candidatesFor } from "./Advisors";
import { evalCondition } from "./Conditions";
import {
  decisionBlock,
  decisionCostPp,
  decisionDef,
  decisionKey,
  decisionTargetOk,
} from "./Decisions";
import { makeCtx } from "./Dispatch";
import { factionEnemies, isMajor, joinBlock } from "./Factions";
import { beatPending } from "./HistoryBeats";
import { hasRule, ruleValue } from "./Spirits";
import { opinionOf } from "./Treaties";
import { justifyBlock } from "./WarGoals";
import type { CountryPol, WwPolitics } from "./WwPolitics";

/** wwRoll purpose of the early-war roll (fix round 1). */
const P_EARLY_WAR = idHash("ai_early_war");

/** Spec §18.6-2: the traits an AI seats, in order, by P1 personality. */
export const AI_ADVISOR_ORDER: Readonly<
  Record<AiPersonality, readonly TraitId[]>
> = {
  aggressor: ["chief_offense", "ind_production", "hawk", "staff_planner"],
  democracy: [
    "ind_construction",
    "administrator",
    "rs_science",
    "chief_defense",
  ],
  minor: ["administrator", "ind_construction", "chief_defense"],
};

/** Spec §18.6-2: the PP an advisor's hire leaves over its cost. */
export const AI_ADVISOR_SPARE_PP = 50;
/** Spec §18.6-5: justify on a neighbour the war score (aiWarScore) rates ≥ 1.5. */
export const AI_JUSTIFY_SCORE_PM = 1500;
/** Spec §18.7: declare with a goal when the war score is ≥ 1.3 (an aggressor) / 1.6. */
export const AI_WAR_SCORE_PM: Readonly<Record<AiPersonality, number>> = {
  aggressor: 1300,
  democracy: 1600,
  minor: 1600,
};
/**
 * Owner direction (history is a guide, not a script): with historical AI a
 * war beat — and a decision beat aimed at a country — is a suggestion the
 * AI takes when the war score is at least this (history pulls it below the
 * off-history bar); a join comes into a war others already fight.
 */
export const AI_BEAT_SCORE_PM = { declare: 800, join: 600 } as const;
/** Owner direction: a beat the AI does not like yet waits up to this many days past its day, then lapses. */
export const AI_BEAT_WAIT_DAYS = 180;
/** Fix round 1: a waiting war beat is planned (the land AI stages) from 7/10 of its bar. */
export const AI_BEAT_PLAN_TENTHS = 7;
/**
 * Owner direction 3 (R11 as a safety rail): before the date of a history
 * beat still to come between the two, the war decision declares only with
 * a score this strong — and only in the games where the seeded roll lets
 * that pair go early (AI_EARLY_WAR_PCT, fix round 1: an early war is the
 * exception, not the rule).
 */
export const AI_EARLY_WAR_SCORE_PM = 3000;
/** Fix round 1: in this share of games (seeded per pair) a strong AI may go to war before history's date. */
export const AI_EARLY_WAR_PCT = 25;
/** Spec §18.7: war support, bp. */
export const AI_WAR_SUPPORT_BP = 4000;
/** Spec §18.6-6: a democratic major guarantees from this world tension, bp. */
export const AI_GUARANTEE_TENSION_BP = 2500;
/** Spec §18.6-4, -6: the generated tension that makes a country a threat, bp. */
export const AI_THREAT_BP = 500;
/** Spec §18.6-7: a leader invites a neighbour that would score this. */
export const AI_INVITE_SCORE = 70;
/** Spec §18.6-4: an ask is accepted from this score. */
export const AI_ACCEPT_SCORE = 50;
/**
 * Spec §22.7 (≤ 0.1 ms a tick for 79 countries): the PP-spending steps
 * (advisor, justification, decision, guarantee, faction, access) run on
 * `(day + id) % 3 === 0`, as P1's AI economy runs on its own turns.
 */
export const AI_POLITICS_PERIOD_DAYS = 3;
/**
 * Decisions (spec §18.6-3, "하루 하나까지" — at most one a day) are looked at
 * on every second of those days, `(day + id) % 6 === 0`; targeted ones (a
 * line per candidate country, spec §13.1, each look judging every
 * candidate) on `(day + id) % 30 === 0`.
 */
export const AI_DECISION_PERIOD_DAYS = 6;
/**
 * A decision this heavy (aiWeight) the AI can take but for its PP is saved
 * for: no lighter one is taken meanwhile (spec §18.6's PP order).
 */
export const AI_DECISION_SAVE_WEIGHT = 15;
export const AI_TARGETED_PERIOD_DAYS = 30;
/** Spec §18.6-7: invitations (and join requests) on `(day + id) % 30 === 0`. */
export const AI_FACTION_PERIOD_DAYS = 30;
/** Access requests for planned wars, on `(day + id) % 15 === 0`. */
export const AI_ACCESS_PERIOD_DAYS = 15;
/** Spec §18.7: the war decision's regular look, `(day + id) % 7 === 0`. */
export const AI_WAR_PERIOD_DAYS = 7;
/** Spec §18.7: and every day of a goal's last 30 days. */
export const AI_WAR_LAST_LOOK_DAYS = 30;

// ---- The day (spec §18.6) ----

export function aiPoliticsTick(
  pol: WwPolitics,
  id: number,
  day: number,
  tick: number,
): void {
  const c = pol.country(id);
  if (c === null || !pol.living(id)) return;
  if ((day + id) % AI_POLITICS_PERIOD_DAYS === 0) {
    const persona = aiPersonality(c.tag);
    const historical = pol.mg.config().historicalAi();
    const budget = new Budget(pol, id, day);
    if (historical) aiHistoryGuarantees(pol, c, budget, day, tick);
    aiAdvisor(pol, c, persona, budget, day, tick);
    if (!historical) aiJustify(pol, c, persona, budget, day, tick);
    if ((day + id) % AI_DECISION_PERIOD_DAYS === 0) {
      aiDecision(pol, c, budget, day, tick);
    }
    if (!historical) {
      aiGuarantee(pol, c, budget, tick);
      if ((day + id) % AI_FACTION_PERIOD_DAYS === 0) {
        aiFaction(pol, c, budget, tick);
      }
      if ((day + id) % AI_ACCESS_PERIOD_DAYS === 0) {
        aiAccess(pol, c, budget, tick);
      }
    }
  }
  if (c.warGoals.length > 0 && warLookToday(c, day)) {
    aiWarDecision(pol, id, day, tick);
  }
}

/** The weekly look, or every day of a goal's last 30 days (spec §18.7). */
function warLookToday(c: CountryPol, day: number): boolean {
  if ((day + c.smallID) % AI_WAR_PERIOD_DAYS === 0) return true;
  return c.warGoals.some((g) => g.untilDay - day <= AI_WAR_LAST_LOOK_DAYS);
}

// ---- The PP budget (spec §18.6 "정치력 순서", §7.3) ----

/**
 * Spec §18.6-1, §7.3 (controller ruling R10): what the laws the P1 AI
 * economy would set on its next turn cost (aiLawTarget, then the target
 * after it); 0 when none.
 */
export function reserveForLaw(
  pol: WwPolitics,
  id: number,
  day: number,
): number {
  const ce = pol.econ.country(id);
  if (ce === null) return 0;
  // An AI turn may set one law of each kind (economy, then conscription):
  // the next is the target again with the one before already in place — a
  // view of the country with those laws, the country itself untouched.
  let pp = 0;
  let view: CountryEconomy = ce;
  const seen = new Set<string>();
  for (let i = 0; i < LAW_KINDS.length; i++) {
    const t = aiLawTarget(pol.econ, view, day);
    if (t === null || seen.has(t.kind) || view.laws[t.kind] === t.value) break;
    seen.add(t.kind);
    pp += lawCost(t.value, ce.stats);
    view = Object.create(view, {
      laws: { value: { ...view.laws, [t.kind]: t.value } },
    }) as CountryEconomy;
  }
  return pp;
}

/** Decision and diplomacy beats by actor tag, table order; per content (derived). */
const PP_BEATS = new WeakMap<ContentRegistry, Map<CountryTag, number[]>>();

function ppBeatsOf(content: ContentRegistry, tag: CountryTag): number[] {
  let m = PP_BEATS.get(content);
  if (m === undefined) {
    const out = new Map<CountryTag, number[]>();
    content.beats.forEach((b, i) => {
      if (b.act.kind !== "decision" && b.act.kind !== "diplo") return;
      const l = out.get(b.actor);
      if (l === undefined) out.set(b.actor, [i]);
      else l.push(i);
    });
    PP_BEATS.set(content, out);
    m = out;
  }
  return m.get(tag) ?? [];
}

/** Spec §16.1–§16.3, §15.3: the PP of a diplomacy beat's order. */
const DIPLO_BEAT_COST = {
  nap: WW_COST.nap,
  guarantee: WW_COST.guarantee,
  access: WW_COST.access,
  join_faction: WW_COST.factionRequest,
  invite: WW_COST.factionInvite,
} as const;

/**
 * Spec §18.2, §18.6-3 (R2): what `id`'s decision and diplomacy beats due
 * within 30 days (or due and not done yet) that the AI would take will
 * cost — the beat sets the date, so the AI has the PP there for it; none
 * for a beat it is waiting on. 0 without historical AI (every beat is
 * skipped).
 */
export function reserveForBeats(
  pol: WwPolitics,
  id: number,
  day: number,
): number {
  let pp = 0;
  for (const i of ppBeatsOf(pol.content, pol.tagOf(id))) {
    const s = pol.beats[i];
    if (s === undefined || s.skipped || s.done) continue;
    if (s.fireDay > day + WW_BEAT_WINDOW_DEFAULT_DAYS) continue;
    const b = pol.content.beats[i];
    const act = b.act;
    // Not for a beat the AI is waiting on (fix round 1).
    if (!aiBeatReady(pol, b, id)) continue;
    if (act.kind === "decision") {
      const d = decisionDef(pol, act.id);
      if (d !== undefined) pp += decisionCostPp(pol, id, d);
    } else if (act.kind === "diplo") {
      if (act.order === "guarantee" && hasRule(pol, id, "free_guarantees")) {
        continue;
      }
      pp += costWith(DIPLO_BEAT_COST[act.order], pol.stats(id).diploCostPct);
    }
  }
  return pp;
}

/**
 * One country's PP for the day: the law's and the beats' reserve (worked
 * out only when some step could pay at all), plus what the earlier steps
 * keep back for what they wait to buy.
 */
export class Budget {
  private base = -1;
  /** PP kept back by the earlier steps of the day. */
  saved = 0;

  constructor(
    private readonly pol: WwPolitics,
    private readonly id: number,
    private readonly day: number,
  ) {}

  keep(): number {
    if (this.base < 0) {
      this.base =
        reserveForLaw(this.pol, this.id, this.day) +
        reserveForBeats(this.pol, this.id, this.day);
    }
    return this.base + this.saved;
  }

  /** The PP above what is kept back covers `pp`. */
  affords(c: CountryPol, pp: number): boolean {
    if (c.ppMilli < 0 || c.ppMilli < (pp + this.saved) * 1000) return false;
    return c.ppMilli >= (pp + this.keep()) * 1000;
  }
}

function issue(
  pol: WwPolitics,
  id: number,
  order: PolOrder,
  tick: number,
): boolean {
  return pol.issue(id, order, tick) === null;
}

// ---- History's guarantees (fix round 1) ----

/** The countries a decision's effects guarantee, effect order (per decision, derived). */
const GUARANTEES = new WeakMap<DecisionDef, CountryTag[]>();

function guaranteeTargets(d: DecisionDef): CountryTag[] {
  let out = GUARANTEES.get(d);
  if (out === undefined) {
    const found: CountryTag[] = [];
    const walk = (x: unknown): void => {
      if (Array.isArray(x)) {
        for (const y of x) walk(y);
      } else if (x !== null && typeof x === "object") {
        const o = x as Record<string, unknown>;
        const of = o.of as { tag?: CountryTag } | undefined;
        if (o.kind === "guarantee" && of?.tag !== undefined) found.push(of.tag);
        for (const v of Object.values(o)) walk(v);
      }
    };
    walk(d.effects ?? []);
    out = [...new Set(found)];
    GUARANTEES.set(d, out);
  }
  return out;
}

/**
 * Fix round 1 (guarantees bring their guarantors in): with historical AI,
 * a guarantee one of `c`'s decision beats gives (the decision's effects
 * guarantee a country) that the decision could not give — the beat ran
 * out with the decision not taken, locked behind a focus the AI has not
 * reached, say — is given by the guarantee order (its rules and cost),
 * within AI_BEAT_WAIT_DAYS of the beat's day. One a day.
 */
function aiHistoryGuarantees(
  pol: WwPolitics,
  c: CountryPol,
  budget: Budget,
  day: number,
  tick: number,
): void {
  for (const i of ppBeatsOf(pol.content, c.tag)) {
    const s = pol.beats[i];
    const act = pol.content.beats[i].act;
    if (act.kind !== "decision" || s === undefined || s.skipped) continue;
    if (!s.done || c.taken.has(act.id)) continue;
    if (day >= s.fireDay + AI_BEAT_WAIT_DAYS) continue;
    const d = decisionDef(pol, act.id);
    if (d === undefined) continue;
    for (const tag of guaranteeTargets(d)) {
      const t = pol.idOfTag(tag);
      if (t === 0 || t === c.smallID || !pol.living(t)) continue;
      if (pol.guarantees.some((g) => g.by === c.smallID && g.to === t)) {
        continue;
      }
      const cost = hasRule(pol, c.smallID, "free_guarantees")
        ? 0
        : costWith(WW_COST.guarantee, c.stats.diploCostPct);
      if (!budget.affords(c, cost)) {
        budget.saved += cost;
        return;
      }
      if (issue(pol, c.smallID, { kind: "guarantee", target: t }, tick)) {
        return;
      }
    }
  }
}

// ---- 2. Advisors (spec §18.6-2) ----

/** Real names first (a `ww1936.person.` name, R20), then titled persons, then titled cards. */
function rank(pol: WwPolitics, a: string): number {
  if (a.startsWith("title:")) return 2;
  const p = pol.content.personIdx.get(a);
  return p?.nameKey.startsWith("ww1936.person.") === true ? 0 : 1;
}

/**
 * One empty seat: the first trait of the personality's order that no
 * seated advisor has, and for which a candidate and a fitting open seat
 * exist (the seat by the candidate's first trait, as hireAdvisor checks);
 * the best-ranked such candidate (content order within a rank), in the
 * first fitting seat, once the PP is ≥ cost + 50 above what is kept back.
 * Until then that PP is saved for it (no later trait goes first). Short of
 * even the cheapest seat, the cheapest seat's PP is saved without looking
 * at the candidates — when an open seat could take a wanted trait at all.
 */
function aiAdvisor(
  pol: WwPolitics,
  c: CountryPol,
  persona: AiPersonality,
  budget: Budget,
  day: number,
  tick: number,
): void {
  const seated = new Set<TraitId>();
  for (const a of c.advisors) {
    if (a !== null) for (const t of pol.traitsOf(c, a)) seated.add(t.id);
  }
  const wanted = AI_ADVISOR_ORDER[persona].filter((t) => !seated.has(t));
  // No open seat any wanted trait could take: nothing to save for.
  const open = c.advisors.some(
    (x, i) =>
      x === null &&
      c.advisorLockUntil[i] <= day &&
      wanted.some((t) => {
        const branch = pol.content.traitIdx.get(t)?.branch;
        return (
          branch !== undefined &&
          SLOT_BRANCHES[ADVISOR_SLOTS[i]].includes(branch)
        );
      }),
  );
  if (!open) return;
  const cheapest =
    costWith(
      Math.min(...ADVISOR_SLOTS.map((s) => ADVISOR_COST[s])),
      c.stats.advisorCostPct,
    ) + AI_ADVISOR_SPARE_PP;
  if (!budget.affords(c, cheapest)) {
    budget.saved += cheapest;
    return;
  }
  const cands = candidatesFor(pol, c.smallID, day)
    .map((a, i) => ({ a, i, r: rank(pol, a) }))
    .sort((x, y) => x.r - y.r || x.i - y.i);
  for (const trait of wanted) {
    for (const { a } of cands) {
      const traits = pol.traitsOf(c, a);
      if (traits.length === 0 || !traits.some((t) => t.id === trait)) continue;
      const branch = traits[0].branch;
      const slot = c.advisors.findIndex(
        (x, i) =>
          x === null &&
          c.advisorLockUntil[i] <= day &&
          SLOT_BRANCHES[ADVISOR_SLOTS[i]].includes(branch),
      );
      if (slot < 0) continue;
      const need =
        costWith(ADVISOR_COST[ADVISOR_SLOTS[slot]], c.stats.advisorCostPct) +
        AI_ADVISOR_SPARE_PP;
      if (!budget.affords(c, need)) {
        budget.saved += need;
        return;
      }
      issue(pol, c.smallID, { kind: "advisor_hire", slot, advisor: a }, tick);
      return;
    }
  }
}

// ---- 3. Decisions (spec §18.6-3) ----

/** A country's decisions (its own table and "any"), content order; per content (derived). */
const DECISIONS_OF = new WeakMap<ContentRegistry, Map<CountryTag, number[]>>();

function decisionsOf(content: ContentRegistry, tag: CountryTag): number[] {
  let m = DECISIONS_OF.get(content);
  if (m === undefined) {
    m = new Map();
    DECISIONS_OF.set(content, m);
  }
  let l = m.get(tag);
  if (l === undefined) {
    const own = content.decisionsFor.get(tag) ?? [];
    l = [...new Set([...own, ...content.decisionsAny])].sort((a, b) => a - b);
    m.set(tag, l);
  }
  return l;
}

/** Whether a condition names the "target" selector anywhere (per decision, derived). */
const NAMES_TARGET = new WeakMap<DecisionDef, boolean>();

function namesTarget(d: DecisionDef): boolean {
  let v = NAMES_TARGET.get(d);
  if (v === undefined) {
    const conds: (Condition | undefined)[] = [d.visible, d.available];
    v = conds.some(
      (x) => x !== undefined && JSON.stringify(x).includes('"target"'),
    );
    NAMES_TARGET.set(d, v);
  }
  return v;
}

/** A targeted decision's cooldown keys by target smallID (decisionKey; per decision, derived). */
const TARGET_KEYS = new WeakMap<DecisionDef, string[]>();

function targetKeys(d: DecisionDef, n: number): string[] {
  let k = TARGET_KEYS.get(d);
  if (k === undefined || k.length < n) {
    k = Array.from({ length: n }, (_, t) => decisionKey(d.id, t));
    TARGET_KEYS.set(d, k);
  }
  return k;
}

/**
 * The heaviest decision `id` can take now (a targeted one per target):
 * weight 0 never, ties by content order, a targeted decision's targets in
 * smallID order; one a history beat has still to take is left to it (R2).
 * One that is takeable but for its PP is saved for when its weight is
 * ≥ AI_DECISION_SAVE_WEIGHT, else passed over for a lighter one.
 * The weight's mods are judged for the chooser (AiWeight), no target.
 */
function aiDecision(
  pol: WwPolitics,
  c: CountryPol,
  budget: Budget,
  day: number,
  tick: number,
): void {
  const id = c.smallID;
  const ctx = makeCtx(pol, id, id, 0, tick);
  const targeted = (day + id) % AI_TARGETED_PERIOD_DAYS === 0;
  const options: { i: number; w: number; pp: number }[] = [];
  for (const i of decisionsOf(pol.content, c.tag)) {
    const d = pol.content.decisions[i];
    if (d.target !== undefined && !targeted) continue;
    // What decisionBlock would refuse first, cheaply: locked, on cooldown.
    if (
      (d.locked === true && !c.unlocked.has(d.id)) ||
      c.locked.has(d.id) ||
      (d.target === undefined && (c.decisionCooldown.get(d.id) ?? -1) > day)
    ) {
      continue;
    }
    const pp = decisionCostPp(pol, id, d);
    const mods = d.ai.mods;
    const w =
      mods === undefined || mods.length === 0
        ? Math.max(0, d.ai.base)
        : aiWeight(d.ai, (j) => evalCondition(ctx, mods[j].if));
    if (w <= 0) continue;
    // Short of its PP: only a heavy decision is worth saving for.
    if (c.ppMilli < (pp + budget.saved) * 1000 && w < AI_DECISION_SAVE_WEIGHT) {
      continue;
    }
    options.push({ i, w, pp });
  }
  if (options.length === 0) return;
  options.sort((a, b) => b.w - a.w || a.i - b.i);
  for (const { i, w, pp } of options) {
    const d = pol.content.decisions[i];
    const pays = budget.affords(c, pp);
    if (!pays && w < AI_DECISION_SAVE_WEIGHT) continue;
    let target = -1;
    let ready = false;
    if (d.target === undefined) {
      const block = decisionBlock(pol, id, d.id, 0);
      if (block !== null && block !== "no_pp") continue;
      target = 0;
      ready = block === null;
    } else {
      // The decider's own conditions first, once, when they do not look
      // at the target (decisionBlock judges `among` before them, per target).
      if (
        !namesTarget(d) &&
        (!evalCondition(ctx, d.visible ?? d.available) ||
          !evalCondition(ctx, d.available))
      ) {
        continue;
      }
      const keys = targetKeys(d, pol.countries.length);
      for (let t = 1; t < pol.countries.length; t++) {
        // A target on cooldown first (most are, for a decision taken often).
        if ((c.decisionCooldown.get(keys[t]) ?? -1) > day || t === id) {
          continue;
        }
        if (!decisionTargetOk(pol, d, t)) continue;
        const block = decisionBlock(pol, id, d.id, t);
        if (block !== null && block !== "no_pp") continue;
        target = t;
        ready = block === null;
        break;
      }
      if (target < 0) continue;
    }
    if (beatPending(pol, id, d.id)) continue;
    if (ready && pays) {
      issue(pol, id, { kind: "decision_take", decision: d.id, target }, tick);
      return;
    }
    // Takeable but for its PP: a heavy one is saved for (spec §18.6's PP
    // order, as the advisor and the justification wait for theirs).
    budget.saved += pp;
    return;
  }
}

// ---- Strength (spec §18.7; the P2 preview's fallback, pre-flight §C) ----

/** aiStrength by country, at one tick and division-table version; -1 not yet counted (derived). */
const STRENGTH = new WeakMap<
  WwPolitics,
  { tick: number; rows: number; v: number[] }
>();

/**
 * `id`'s army strength, counted once a tick: Σ of its divisions' soft and
 * hard attack, defence and breakthrough at their men and equipment now
 * (P2 statsOf) — the battle numbers P2's preview weighs, standing in for
 * its border-wide ratio (pre-flight §C: predictAttack works per region).
 * A plain division count (Conditions.armyStrength) rates a large militia
 * army like a modern one.
 */
export function aiStrength(pol: WwPolitics, id: number): number {
  const tick = pol.mg.ticks();
  const land = pol.land;
  const version = land.divisions.rowsVersion;
  let s = STRENGTH.get(pol);
  if (s === undefined || s.tick !== tick || s.rows !== version) {
    s = {
      tick,
      rows: version,
      v: new Array<number>(pol.countries.length).fill(-1),
    };
    STRENGTH.set(pol, s);
  }
  let x = s.v[id];
  if (x === undefined) return 0;
  if (x < 0) {
    x = 0;
    for (const r of land.rowsOf(id)) {
      const d = land.statsOf(r);
      x += d.soft + d.hard + d.def + d.brk;
    }
    s.v[id] = x;
  }
  return x;
}

/** `t` and the members of its faction (P0 §7.3: a war on one is a war on all) but `a`, living, ascending. */
function sideOf(pol: WwPolitics, t: number, a: number): number[] {
  const idx = pol.factionIdx(t);
  const all = idx < 0 ? [t] : pol.factionMembers(idx);
  return all.filter((m) => m !== a && pol.living(m));
}

/** Score cap (an enemy side with no strength). */
const SCORE_MAX = 1_000_000;

/**
 * The AI's view of a war of `a` on `t`, permille (1000: even). Owner
 * direction 4: one scoring for the war decision (§18.7), the justification
 * (§18.6-5) and the history beats (suggestions judged by it). Strength is
 * aiStrength (the divisions' battle numbers).
 * - Against: the new enemies — `t` and its faction (a declaration brings
 *   them all in, P0 §7.3; a join is `t` alone) not yet at war with `a`; on a declaration, half
 *   of each major guarantor of `t` not yet fighting `a` (it is likely to
 *   keep its promise, spec §16.1).
 * - For: `a`, everyone already at war with `t`, and `a`'s faction mates —
 *   whole when they already fight `t`'s side, else half when `a` leads the
 *   faction (its call to arms goes to them all, spec §15.5; a member's
 *   goes to its leader only and counts for nothing).
 * - The wars `a` already fights: halved for every living major enemy on its
 *   own land border (a second front), ×7/8 for one elsewhere; × war
 *   support / 40% below 40%.
 */
export function aiWarScore(
  pol: WwPolitics,
  a: number,
  t: number,
  join: boolean,
): number {
  const c = pol.country(a);
  if (c === null || t === a) return 0;
  // A join is a war between the two only (P0 §7.3).
  const side = join ? (pol.living(t) ? [t] : []) : sideOf(pol, t, a);
  // Both sides doubled, so a half is still a whole number.
  let against = 0;
  for (const x of side) {
    if (!pol.ww.isAtWar(a, x)) against += 2 * aiStrength(pol, x);
  }
  if (!join) {
    for (const g of pol.guarantorsOf(t)) {
      if (g === a || side.includes(g) || !isMajor(pol, g)) continue;
      if (!pol.living(g) || pol.sameFaction(a, g) || pol.ww.isAtWar(g, a)) {
        continue;
      }
      against += aiStrength(pol, g);
    }
  }
  let mine = 2 * aiStrength(pol, a);
  const counted = new Set<number>([a, ...side]);
  for (const e of pol.ww.enemiesOf(t)) {
    if (counted.has(e) || !pol.living(e)) continue;
    counted.add(e);
    mine += 2 * aiStrength(pol, e);
  }
  const idx = pol.factionIdx(a);
  const leads = idx >= 0 && pol.faction(idx)?.leader === a;
  if (idx >= 0) {
    for (const m of pol.factionMembers(idx)) {
      if (counted.has(m) || !pol.living(m)) continue;
      counted.add(m);
      if (side.some((x) => pol.ww.isAtWar(m, x))) {
        mine += 2 * aiStrength(pol, m);
      } else if (leads) {
        mine += aiStrength(pol, m);
      }
    }
  }
  if (mine <= 0) return 0;
  let score =
    against <= 0
      ? SCORE_MAX
      : Math.min(SCORE_MAX, Math.floor((mine * 1000) / against));
  score = aiOverseasWarScore(pol.ww, a, t, side, score); // P4 lane AI: an overseas war is fought at sea
  const near = pol.econ.countryNeighbours(a);
  for (const e of pol.ww.enemiesOf(a)) {
    if (e === t || !isMajor(pol, e) || !pol.living(e)) continue;
    score = near.includes(e)
      ? Math.floor(score / 2)
      : Math.floor((score * 7) / 8);
  }
  if (c.wsBp < AI_WAR_SUPPORT_BP) {
    score = Math.floor((score * Math.max(0, c.wsBp)) / AI_WAR_SUPPORT_BP);
  }
  return score;
}

/**
 * A war `a` owes: a faction mate already fights `t`, or `a` guarantees a
 * country at war with `t` (spec §15.5, §16.1) — taken without the score.
 */
function warOwed(pol: WwPolitics, a: number, t: number): boolean {
  const idx = pol.factionIdx(a);
  if (
    idx >= 0 &&
    pol.factionMembers(idx).some((m) => m !== a && pol.ww.isAtWar(m, t))
  ) {
    return true;
  }
  return pol.guarantees.some((g) => g.by === a && pol.ww.isAtWar(g.to, t));
}

/** `id` aims at `target`: a war goal or a justification on it. */
function aimsAt(pol: WwPolitics, id: number, target: number): boolean {
  return (
    pol.hasWarGoal(id, target) || pol.country(id)?.justification?.on === target
  );
}

function justifiedAgainst(pol: WwPolitics, id: number): boolean {
  for (let x = 1; x < pol.countries.length; x++) {
    if (pol.countries[x]?.justification?.on === id) return true;
  }
  return false;
}

// ---- 4. Justification (spec §18.6-5; historical AI off) ----

/** The countries holding part of `id`'s claim groups (CLAIMS, table order; the first region not `id`'s), with the group. */
function claimTargets(pol: WwPolitics, id: number): Map<number, string> {
  const out = new Map<number, string>();
  const tag = pol.tagOf(id);
  for (const row of pol.content.claims) {
    if (row.tag !== tag) continue;
    for (const g of row.groups) {
      const regions = pol.content.groupIdx.get(g)?.regions ?? [];
      const r = regions.find((x) => pol.legalOwner[x] !== id);
      if (r === undefined) continue;
      const owner = pol.legalOwner[r];
      if (owner > 0 && !out.has(owner)) out.set(owner, g);
    }
  }
  return out;
}

function majorGuaranteed(pol: WwPolitics, t: number): boolean {
  return pol.guarantees.some((g) => g.to === t && isMajor(pol, g.by));
}

/** The pact between the two may be broken now (spec §16.2). */
function napBreakable(
  pol: WwPolitics,
  a: number,
  b: number,
  day: number,
): boolean {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const n = pol.naps.find((x) => x.a === lo && x.b === hi);
  return (
    n !== undefined && (n.startTreaty || day - n.sinceDay >= WW_NAP_BREAK_DAYS)
  );
}

/** The PP of breaking a pact (spec §16.2, diploCostPct). */
function napBreakCost(pol: WwPolitics, id: number): number {
  return costWith(WW_COST.napBreak, pol.stats(id).diploCostPct);
}

/**
 * Spec §18.6-5: an aggressor (or a communist or fascist government) with
 * no war goal and no justification, at war with no major, justifies on
 * the first neighbour whose side (with its faction, as the war decision
 * counts it) it is 1.5 times as strong as and that no major guarantees —
 * claim targets (CLAIMS: a claim on the group) first, then the others,
 * smallID order. Controller ruling 1: a pact partner may be one — the AI
 * breaks the pact first and pays for both; pact partners come after the
 * others. Short of PP, what the first such target needs is saved.
 */
function aiJustify(
  pol: WwPolitics,
  c: CountryPol,
  persona: AiPersonality,
  budget: Budget,
  day: number,
  tick: number,
): void {
  const id = c.smallID;
  // A justification the target's joining my faction, a war with it or my
  // guarantee of it holds up for good goes (no refund, spec §14.3).
  const j = c.justification;
  if (
    j !== null &&
    (pol.sameFaction(id, j.on) ||
      pol.ww.isAtWar(id, j.on) ||
      pol.guarantees.some((g) => g.by === id && g.to === j.on))
  ) {
    issue(pol, id, { kind: "justify_cancel" }, tick);
  }
  if (c.warGoals.length > 0 || c.justification !== null) return;
  if (
    persona !== "aggressor" &&
    c.ruling !== IDEO_COM &&
    c.ruling !== IDEO_FAS
  ) {
    return;
  }
  if (pol.ww.enemiesOf(id).some((e) => isMajor(pol, e))) return;
  // The cheapest justification is kept ready; the targets are looked at
  // once the PP covers it.
  const least = justifyCost(false, c.stats);
  if (!budget.affords(c, least)) {
    budget.saved += least;
    return;
  }
  if (aiStrength(pol, id) <= 0) return;
  const claims = claimTargets(pol, id);
  const near = pol.econ
    .countryNeighbours(id)
    .filter(
      (t) =>
        t !== id &&
        pol.living(t) &&
        !pol.sameFaction(id, t) &&
        !majorGuaranteed(pol, t) &&
        aiWarScore(pol, id, t, false) >= AI_JUSTIFY_SCORE_PM,
    );
  const pact = (t: number) => pol.isAtWarBlockedByNap(id, t);
  const order = [
    ...near.filter((t) => claims.has(t) && !pact(t)),
    ...near.filter((t) => !claims.has(t) && !pact(t)),
    ...near.filter((t) => claims.has(t) && pact(t)),
    ...near.filter((t) => !claims.has(t) && pact(t)),
  ];
  for (const t of order) {
    const broken = pact(t);
    if (broken) {
      if (!napBreakable(pol, id, t, day)) continue;
      if (!justifiableOnceBroken(pol, c, t)) continue;
    } else if (justifyBlock(pol, id, t) !== null) {
      continue;
    }
    const need =
      justifyCost(isMajor(pol, t), c.stats) +
      (broken ? napBreakCost(pol, id) : 0);
    if (!budget.affords(c, need)) {
      budget.saved += need;
      return;
    }
    if (broken && !issue(pol, id, { kind: "nap_break", target: t }, tick)) {
      return;
    }
    const group = claims.get(t) ?? "";
    issue(
      pol,
      id,
      {
        kind: "justify",
        target: t,
        goal: group === "" ? "conquer" : "claim",
        group,
      },
      tick,
    );
    return;
  }
}

/**
 * Spec §14.3's gate with the pact gone: no war, faction, guarantee, goal
 * or rule in the way, and the government's tension gate (with the "member
 * of an enemy faction" door left shut, so it never opens wrongly).
 */
function justifiableOnceBroken(
  pol: WwPolitics,
  c: CountryPol,
  t: number,
): boolean {
  const id = c.smallID;
  return (
    !pol.hasWarGoal(id, t) &&
    justifyGate({
      ruling: c.ruling,
      wtBp: pol.wtBp,
      targetThreatBp: pol.threatBp[t] ?? 0,
      targetInEnemyFaction: false,
      atWarWith: pol.ww.isAtWar(id, t),
      sameFaction: pol.sameFaction(id, t),
      nap: false,
      iGuarantee: pol.guarantees.some((g) => g.by === id && g.to === t),
      noJustifyRule: hasRule(pol, id, "no_justify"),
      busy: c.justification !== null,
    }) === null
  );
}

// ---- 5. Guarantees (spec §18.6-6; historical AI off) ----

/**
 * A democratic major, from 25% world tension, guarantees a minor someone
 * is justifying on that borders a country with ≥ 5% generated tension;
 * the first by smallID.
 */
function aiGuarantee(
  pol: WwPolitics,
  c: CountryPol,
  budget: Budget,
  tick: number,
): void {
  const id = c.smallID;
  if (c.ruling !== IDEO_DEM || !isMajor(pol, id)) return;
  if (pol.wtBp < AI_GUARANTEE_TENSION_BP) return;
  const cost = hasRule(pol, id, "free_guarantees")
    ? 0
    : costWith(WW_COST.guarantee, c.stats.diploCostPct);
  if (!budget.affords(c, cost)) return;
  const targets = new Set<number>();
  for (let x = 1; x < pol.countries.length; x++) {
    const j = pol.countries[x]?.justification ?? null;
    if (j !== null) targets.add(j.on);
  }
  for (const t of [...targets].sort((a, b) => a - b)) {
    if (t === id || isMajor(pol, t) || !pol.living(t)) continue;
    if (pol.guarantees.some((g) => g.by === id && g.to === t)) continue;
    if (pol.ww.isAtWar(id, t) || pol.sameFaction(id, t) || aimsAt(pol, id, t)) {
      continue;
    }
    const threatened = pol.econ
      .countryNeighbours(t)
      .some((n) => (pol.threatBp[n] ?? 0) >= AI_THREAT_BP);
    if (!threatened) continue;
    if (issue(pol, id, { kind: "guarantee", target: t }, tick)) return;
  }
}

// ---- 6. Factions (spec §18.6-7, controller ruling 4; historical AI off) ----

/**
 * A leader invites the first neighbour without a faction (smallID order)
 * that would score ≥ 70 for it. A country in no faction that is
 * threatened (at war, justified against, or a goal held on it) asks to
 * join the first faction (index order) whose invitation it would accept
 * and whose leader would accept the request (both ≥ 50).
 */
function aiFaction(
  pol: WwPolitics,
  c: CountryPol,
  budget: Budget,
  tick: number,
): void {
  const id = c.smallID;
  const idx = pol.factionIdx(id);
  if (idx >= 0) {
    if (pol.faction(idx)?.leader !== id) return;
    const cost = costWith(WW_COST.factionInvite, c.stats.diploCostPct);
    if (!budget.affords(c, cost)) return;
    for (const t of pol.econ.countryNeighbours(id)) {
      if (t === id || pol.factionIdx(t) >= 0 || !pol.living(t)) continue;
      if (joinBlock(pol, t, idx) !== null) continue;
      if (aiAcceptScore(pol, "faction_invite", id, t) < AI_INVITE_SCORE) {
        continue;
      }
      if (issue(pol, id, { kind: "faction_invite", target: t }, tick)) return;
    }
    return;
  }
  const threatened =
    pol.ww.hasWar(id) ||
    justifiedAgainst(pol, id) ||
    pol.countries.some((x) => x?.warGoals.some((g) => g.on === id) === true);
  if (!threatened) return;
  const cost = costWith(WW_COST.factionRequest, c.stats.diploCostPct);
  if (!budget.affords(c, cost)) return;
  for (const f of pol.factions) {
    if (f.leader === id || joinBlock(pol, id, f.idx) !== null) continue;
    if (aiAcceptScore(pol, "faction_invite", f.leader, id) < AI_ACCEPT_SCORE) {
      continue;
    }
    if (aiAcceptScore(pol, "faction_request", id, f.leader) < AI_ACCEPT_SCORE) {
      continue;
    }
    if (issue(pol, id, { kind: "faction_request", target: f.leader }, tick)) {
      return;
    }
  }
}

// ---- Access for planned wars (controller ruling 4; historical AI off) ----

/**
 * For a country the AI plans to fight (a goal, its justification, a war
 * it declared) and does not border, it asks the first neighbour (smallID
 * order) that borders it, and would say yes (≥ 50), for military access.
 */
function aiAccess(
  pol: WwPolitics,
  c: CountryPol,
  budget: Budget,
  tick: number,
): void {
  const id = c.smallID;
  const planned = new Set<number>(c.warGoals.map((g) => g.on));
  if (c.justification !== null) planned.add(c.justification.on);
  for (const t of c.declaredOn) if (pol.ww.isAtWar(id, t)) planned.add(t);
  if (planned.size === 0) return;
  const cost = costWith(WW_COST.access, c.stats.diploCostPct);
  if (!budget.affords(c, cost)) return;
  const mine = pol.econ.countryNeighbours(id);
  for (const t of [...planned].sort((a, b) => a - b)) {
    if (!pol.living(t) || mine.includes(t)) continue;
    for (const x of mine) {
      if (x === t || !pol.living(x) || pol.hasAccess(id, x)) continue;
      if (pol.sameFaction(id, x) || pol.ww.isAtWar(id, x)) continue;
      if (!pol.econ.countryNeighbours(x).includes(t)) continue;
      if (aiAcceptScore(pol, "access", id, x) < AI_ACCEPT_SCORE) continue;
      if (issue(pol, id, { kind: "access_ask", target: x }, tick)) return;
    }
  }
}

// ---- 7. The war decision (spec §18.7) and the war beats ----

/** Declare / join beats by unordered pair "<tag>:<tag>" (sorted), per content (derived). */
const WAR_BEATS = new WeakMap<ContentRegistry, Map<string, number[]>>();

function pairKey(a: CountryTag, b: CountryTag): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function warBeats(content: ContentRegistry): Map<string, number[]> {
  let m = WAR_BEATS.get(content);
  if (m === undefined) {
    const out = new Map<string, number[]>();
    content.beats.forEach((b, i) => {
      if (b.act.kind !== "declare" && b.act.kind !== "join") return;
      const k = pairKey(b.actor, b.act.target);
      const l = out.get(k);
      if (l === undefined) out.set(k, [i]);
      else l.push(i);
    });
    WAR_BEATS.set(content, out);
    m = out;
  }
  return m;
}

/**
 * Owner direction 3 (R11 kept as a safety rail): a declare or join beat
 * between the two — either way round (controller ruling 2: the Soviet
 * Union and Barbarossa), skipped or not — not done yet and whose history
 * date has not come.
 */
export function earlyForHistory(
  pol: WwPolitics,
  a: number,
  b: number,
  day: number,
): boolean {
  const list = warBeats(pol.content).get(pairKey(pol.tagOf(a), pol.tagOf(b)));
  if (list === undefined) return false;
  return list.some(
    (i) =>
      pol.beats[i]?.done === false &&
      day < dayOfDate(pol.content.beats[i].date),
  );
}

/** Fix round 1: whether this game lets `a` go to war on `t` before history's date (seeded, AI_EARLY_WAR_PCT of games). */
export function earlyWarRolled(pol: WwPolitics, a: number, t: number): boolean {
  return (
    wwRoll(pol.seed, P_EARLY_WAR, idHash(pol.tagOf(a)), idHash(pol.tagOf(t))) %
      100 <
    AI_EARLY_WAR_PCT
  );
}

/**
 * Spec §18.7's "at war with a major (the same faction's wars aside)": a
 * living major enemy that no faction mate fights beside me.
 */
function fightsMajorAlone(
  pol: WwPolitics,
  id: number,
  mates: readonly number[],
): boolean {
  return pol.ww
    .enemiesOf(id)
    .some(
      (e) =>
        isMajor(pol, e) &&
        pol.living(e) &&
        !mates.some((m) => pol.ww.isAtWar(m, e)),
    );
}

/**
 * Spec §18.7: an AI with a war goal declares (P0 declareWar) when the war
 * score (aiWarScore) is ≥ 1.3 (an aggressor; else 1.6), it fights no major
 * alone and its war support is ≥ 40%. A pact is broken first (controller
 * ruling 1; its PP above what the law and the beats keep back). With
 * historical AI, before the date of a history beat still to come between
 * the two, only with a score ≥ 2 (owner direction 3, R11 as a rail).
 * Goals in target order; one declaration at most. Returns the target, 0
 * for none.
 */
export function aiWarDecision(
  pol: WwPolitics,
  id: number,
  day: number,
  tick: number,
): number {
  const c = pol.country(id);
  const me = pol.player(id);
  if (c === null || me === null || c.warGoals.length === 0) return 0;
  if (!pol.living(id) || c.wsBp < AI_WAR_SUPPORT_BP) return 0;
  const idx = pol.factionIdx(id);
  const mates = idx < 0 ? [] : pol.factionMembers(idx).filter((m) => m !== id);
  if (fightsMajorAlone(pol, id, mates)) return 0;
  const historical = pol.mg.config().historicalAi();
  const need = AI_WAR_SCORE_PM[aiPersonality(c.tag)];
  for (const g of [...c.warGoals]) {
    const t = g.on;
    const tp = pol.player(t);
    if (tp === null || !pol.living(t) || pol.ww.isAtWar(id, t)) continue;
    const score = aiWarScore(pol, id, t, false);
    if (score < need) continue;
    if (
      historical &&
      earlyForHistory(pol, id, t, day) &&
      (score < AI_EARLY_WAR_SCORE_PM || !earlyWarRolled(pol, id, t))
    ) {
      continue;
    }
    let block = declareWarBlock(pol.mg, pol.ww, me, tp, tick);
    if (block === "nap") {
      // Only when nothing else would refuse the declaration after the break.
      if (
        pol.guarantees.some((x) => x.by === id && x.to === t) ||
        hasRule(pol, id, "no_justify") ||
        !napBreakable(pol, id, t, day) ||
        !new Budget(pol, id, day).affords(c, napBreakCost(pol, id)) ||
        !issue(pol, id, { kind: "nap_break", target: t }, tick)
      ) {
        continue;
      }
      block = declareWarBlock(pol.mg, pol.ww, me, tp, tick);
    }
    if (block !== null) continue;
    if (declareWar(pol.mg, pol.ww, me, tp, tick).length > 0) return t;
  }
  return 0;
}

/**
 * Owner direction 1: with historical AI a history beat is a suggestion.
 * HistoryBeats asks before a declare or join beat, and before a war-like
 * decision beat aimed at a country (warLikeDecision), acts: true when the
 * AI takes it now — the war
 * score (aiWarScore: the target with its allies, other fronts, war
 * support) is ≥ 0.8 (a join, into a war others fight: 0.6), or the war is
 * owed (a faction mate already fights the target, or the AI guarantees a
 * country it fights: the Allies of 1939-09-03). A join nobody else's war
 * is waiting for yet is judged as a declaration. Else the beat
 * waits, a day at a time, up to AI_BEAT_WAIT_DAYS past its day, and then
 * lapses. A beat the act's own rules settle (the target gone, already at
 * war with it, a faction partner) is not judged.
 */
export function aiBeatReady(
  pol: WwPolitics,
  b: HistoryBeat,
  a: number,
): boolean {
  const v = beatVerdict(pol, b, a);
  return v === null || v.score >= v.need;
}

/**
 * Fix round 1: while a war beat waits, the land AI stages for it
 * (plannedWars) only once the AI rates it at ≥ 70% of what it needs.
 */
export function aiBeatPlanned(
  pol: WwPolitics,
  b: HistoryBeat,
  a: number,
): boolean {
  const v = beatVerdict(pol, b, a);
  return v === null || v.score * 10 >= v.need * AI_BEAT_PLAN_TENTHS;
}

/** A decision that may bring a war: an ultimatum (annexation) or one whose effects declare or join a war (per decision, derived). */
const WAR_LIKE = new WeakMap<DecisionDef, boolean>();

export function warLikeDecision(d: DecisionDef): boolean {
  let v = WAR_LIKE.get(d);
  if (v === undefined) {
    const effects = JSON.stringify([
      d.effects ?? [],
      d.completeEffects ?? [],
      d.failEffects ?? [],
    ]);
    v =
      d.category === "annexation" ||
      effects.includes('"kind":"declare_war"') ||
      effects.includes('"kind":"join_war"');
    WAR_LIKE.set(d, v);
  }
  return v;
}

/**
 * The war score a beat is judged on and the bar it must reach; null when
 * the beat is not judged: not a war (a peaceful decision — an invitation,
 * a base treaty — is subject only to its own cost and conditions), a war
 * the act's own rules settle (the target gone, already at war, a faction
 * partner), or a war owed.
 */
function beatVerdict(
  pol: WwPolitics,
  b: HistoryBeat,
  a: number,
): { score: number; need: number } | null {
  const act = b.act;
  // P5 final lane (balance, Spain targets): a civil-war beat is the rising
  // itself, not a war its actor weighs — never judged on war odds (Spain's
  // Nationalists scored 735 of the 800 bar and the war never began).
  if (b.civil === true) return null;
  let target: CountryTag;
  let join = false;
  if (act.kind === "declare" || act.kind === "join") {
    target = act.target;
    join = act.kind === "join";
  } else if (act.kind === "decision" && act.target !== undefined) {
    const d = decisionDef(pol, act.id);
    if (d === undefined || !warLikeDecision(d)) return null;
    target = act.target;
  } else {
    return null;
  }
  const t = pol.idOfTag(target);
  if (t === 0 || t === a || !pol.living(t) || !pol.living(a)) return null;
  if (pol.ww.isAtWar(a, t) || pol.sameFaction(a, t)) return null;
  if (warOwed(pol, a, t)) return null;
  // A join into a war nobody fights yet opens it: judged as a declaration.
  if (join && !pol.ww.enemiesOf(t).some((e) => e !== a && pol.living(e))) {
    join = false;
  }
  return {
    score: aiWarScore(pol, a, t, join),
    need: AI_BEAT_SCORE_PM[join ? "join" : "declare"],
  };
}

// ---- 4. Acceptance (spec §18.6-4) ----

/**
 * Spec §18.6 table: `to`'s score for `from`'s ask; ≥ 50 accepts. The
 * opinion is `to`'s of `from`, halved toward 0. A faction ask judges the
 * joiner (the invited country, or the one asking) against the faction
 * (the inviter's, or the asked leader's): same ideology +40 / else −40, a
 * common enemy +40, the joiner justified against +30, the asking country
 * a major +10, `to` a democracy below its faction door (40% tension) −100,
 * the faction at war and the joiner at peace −20. A pact: +30, `from`
 * justifying on `to` −100, `to` aiming at `from` (goal or justification)
 * −100, `from` twice `to`'s strength or more +20. Access: same ideology
 * +20, `from` at war with a neighbour of `to` that has ≥ 5% generated
 * tension +30, `from` aiming at `to` −100.
 */
export function aiAcceptScore(
  pol: WwPolitics,
  kind: DiploAsk,
  from: number,
  to: number,
): number {
  const a = pol.country(from);
  const b = pol.country(to);
  if (a === null || b === null || from === to) return 0;
  const opinion = Math.trunc(opinionOf(pol, to, from) / 2);
  switch (kind) {
    case "faction_invite":
    case "faction_request": {
      const joiner = kind === "faction_invite" ? to : from;
      const lead = kind === "faction_invite" ? from : to;
      const idx = pol.factionIdx(lead);
      const ideology =
        idx >= 0 ? pol.factionIdeology(idx) : pol.country(lead)!.ruling;
      const enemies =
        idx >= 0 ? factionEnemies(pol, idx) : pol.ww.enemiesOf(lead);
      let s = opinion + (pol.country(joiner)!.ruling === ideology ? 40 : -40);
      if (pol.ww.enemiesOf(joiner).some((e) => enemies.includes(e))) s += 40;
      if (justifiedAgainst(pol, joiner)) s += 30;
      if (isMajor(pol, from)) s += 10;
      // Spec §14.4: the 40% door (a spirit may lower it, as the gate does).
      const minus = ruleValue(pol, to, "factionGateMinusPp") ?? 0;
      if (b.ruling === IDEO_DEM && !factionGate(b.ruling, pol.wtBp, minus)) {
        s -= 100;
      }
      if (enemies.length > 0 && !pol.ww.hasWar(joiner)) s -= 20;
      return s;
    }
    case "nap": {
      let s = 30 + opinion;
      if (a.justification?.on === to) s -= 100;
      if (aimsAt(pol, to, from)) s -= 100;
      const sf = aiStrength(pol, from);
      if (sf > 0 && sf >= 2 * aiStrength(pol, to)) s += 20;
      return s;
    }
    case "access": {
      let s = opinion + (a.ruling === b.ruling ? 20 : 0);
      const threat = pol.econ
        .countryNeighbours(to)
        .some(
          (n) =>
            n !== from &&
            pol.ww.isAtWar(from, n) &&
            (pol.threatBp[n] ?? 0) >= AI_THREAT_BP,
        );
      if (threat) s += 30;
      if (aimsAt(pol, from, to)) s -= 100;
      return s;
    }
  }
}
