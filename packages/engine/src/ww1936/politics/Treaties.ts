// World War 1936 P3: guarantees, non-aggression pacts, military access and
// opinion (spec §16). Lists keep insertion order, pairs stored (lo, hi).
import type { PolOrder } from "@openfront/engine-api/Schemas";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  DiploAsk,
  EventId,
  WW_COST,
  WW_IMPROVE_RELATIONS_DAYS,
  WW_MAX_OPINIONS,
  WW_NAP_BREAK_DAYS,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  costWith,
  guaranteeGate,
} from "@openfront/engine-lib/ww1936/PoliticsRules";
import { sweepRefused } from "../land/PoliticsBridge";
import { aiAcceptScore } from "./AiPolitics";
import { callToArmsChoice, warBeatDue } from "./Factions";
import { payPp } from "./Power";
import { hasRule, ruleValue } from "./Spirits";
import { addTension, scaledTension } from "./Tension";
import type { WwPolitics } from "./WwPolitics";

type TreatyKind = "guarantee" | "nap" | "access";

/** ww1936_treaty / ww1936_treaty_ended to the two parties (controller ruling R21). */
function tell(
  pol: WwPolitics,
  key: "ww1936_treaty" | "ww1936_treaty_ended",
  kind: TreatyKind,
  a: number,
  b: number,
): void {
  const params = { kind, aTag: pol.tagOf(a), bTag: pol.tagOf(b) };
  pol.message(a, key, params);
  pol.message(b, key, params);
}

function diploCost(pol: WwPolitics, id: number, base: number): number {
  return costWith(base, pol.stats(id).diploCostPct);
}

/** `id` aims at `target`: a war goal or a justification (spec §16.1). */
function aimsAt(pol: WwPolitics, id: number, target: number): boolean {
  return (
    pol.hasWarGoal(id, target) || pol.country(id)?.justification?.on === target
  );
}

function justifiedAgainst(pol: WwPolitics, target: number): boolean {
  return pol.list().some((c) => c.justification?.on === target);
}

/** Spec §16.1–§16.4: the treaty orders. */
export function treatyOrder(
  pol: WwPolitics,
  id: number,
  o: PolOrder,
  tick: number,
): WwOrderBlock | null {
  const day = pol.ww.day(tick);
  if (!("target" in o)) return "bad_index";
  const t = o.target;
  if (t === id || !pol.living(t)) return "bad_target";
  switch (o.kind) {
    case "guarantee": {
      if (pol.guarantees.some((g) => g.by === id && g.to === t)) {
        return "treaty_exists";
      }
      if (
        pol.ww.isAtWar(id, t) ||
        pol.sameFaction(id, t) ||
        aimsAt(pol, id, t)
      ) {
        return "bad_target";
      }
      const c = pol.country(id)!;
      const gate = ruleValue(pol, id, "guaranteeGatePct") ?? 25;
      if (!guaranteeGate(c.ruling, pol.wtBp, justifiedAgainst(pol, t), gate)) {
        return "tension_gate";
      }
      const cost = hasRule(pol, id, "free_guarantees")
        ? 0
        : diploCost(pol, id, WW_COST.guarantee);
      if (!payPp(pol, id, cost)) return "no_pp";
      addGuarantee(pol, id, t, day);
      return null;
    }
    case "guarantee_end": {
      if (!pol.guarantees.some((g) => g.by === id && g.to === t)) {
        return "bad_target";
      }
      endGuarantee(pol, id, t);
      addOpinion(pol, id, t, -10, 180);
      return null;
    }
    case "nap_offer": {
      if (pol.isAtWarBlockedByNap(id, t)) return "treaty_exists";
      if (pol.ww.isAtWar(id, t)) return "bad_target";
      if (!payPp(pol, id, diploCost(pol, id, WW_COST.nap))) return "no_pp";
      pol.queueEvent("gen_diplo_nap", t, id, 0, 0);
      return null;
    }
    case "nap_break": {
      const n = napOf(pol, id, t);
      if (n === null) return "bad_target";
      if (!n.startTreaty && day - n.sinceDay < WW_NAP_BREAK_DAYS) {
        return "nap_young";
      }
      if (!payPp(pol, id, diploCost(pol, id, WW_COST.napBreak))) {
        return "no_pp";
      }
      // Spec §16.2: −5% stability, +3% tension, −50 opinion of the other.
      const c = pol.country(id)!;
      c.stabBaseBp = Math.max(0, c.stabBaseBp - 500);
      addTension(pol, id, scaledTension(pol, id, 300));
      addOpinion(pol, id, t, -50, 180);
      breakNap(pol, id, t);
      return null;
    }
    case "access_ask": {
      if (pol.hasAccess(id, t) || pol.sameFaction(id, t)) {
        return "treaty_exists";
      }
      if (pol.ww.isAtWar(id, t)) return "bad_target";
      if (!payPp(pol, id, diploCost(pol, id, WW_COST.access))) return "no_pp";
      pol.queueEvent("gen_diplo_access", t, id, 0, 0);
      return null;
    }
    case "access_revoke": {
      if (!pol.hasAccess(t, id)) return "bad_target";
      // Its divisions on my land go home in the next common step
      // (controller ruling R14: dailyTreaties' sweep).
      endAccess(pol, t, id);
      return null;
    }
    case "improve_relations": {
      if ((pol.country(id)!.improveCooldown.get(t) ?? -1) > day) {
        return "decision_cooldown";
      }
      if (!payPp(pol, id, diploCost(pol, id, WW_COST.improve))) {
        return "no_pp";
      }
      addOpinion(pol, id, t, 30, WW_IMPROVE_RELATIONS_DAYS);
      pol.country(id)!.improveCooldown.set(t, day + WW_IMPROVE_RELATIONS_DAYS);
      return null;
    }
    default:
      return "bad_index";
  }
}

// ---- The treaties themselves (orders, effects, the AI's accepted asks) ----

export function addGuarantee(
  pol: WwPolitics,
  by: number,
  to: number,
  day: number,
): void {
  if (by === to || by <= 0 || to <= 0) return;
  if (pol.guarantees.some((g) => g.by === by && g.to === to)) return;
  if (pol.ww.isAtWar(by, to) || pol.sameFaction(by, to)) return;
  pol.guarantees.push({ by, to, sinceDay: day });
  tell(pol, "ww1936_treaty", "guarantee", by, to);
  pol.markCountry(by);
  pol.markCountry(to);
  pol.markGlobal();
}

/** Spec §16.1: the guarantee ends (the order adds its −10 opinion). */
export function endGuarantee(pol: WwPolitics, by: number, to: number): void {
  const n = pol.guarantees.length;
  pol.guarantees = pol.guarantees.filter((g) => !(g.by === by && g.to === to));
  if (pol.guarantees.length === n) return;
  tell(pol, "ww1936_treaty_ended", "guarantee", by, to);
  pol.markGlobal();
}

function napOf(pol: WwPolitics, a: number, b: number) {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return pol.naps.find((n) => n.a === lo && n.b === hi) ?? null;
}

export function addNap(
  pol: WwPolitics,
  a: number,
  b: number,
  day: number,
): void {
  if (a === b || a <= 0 || b <= 0 || napOf(pol, a, b) !== null) return;
  if (pol.ww.isAtWar(a, b)) return;
  pol.naps.push({
    a: Math.min(a, b),
    b: Math.max(a, b),
    sinceDay: day,
    startTreaty: false,
  });
  tell(pol, "ww1936_treaty", "nap", a, b);
  pol.markGlobal();
}

/** The pact is gone (the order pays its cost and penalties; an effect does not). */
export function breakNap(pol: WwPolitics, a: number, b: number): void {
  const n = napOf(pol, a, b);
  if (n === null) return;
  pol.naps = pol.naps.filter((x) => x !== n);
  tell(pol, "ww1936_treaty_ended", "nap", a, b);
  pol.markGlobal();
}

/** Spec §16.3: `by`'s armies may enter `from`'s regions. */
export function addAccess(pol: WwPolitics, by: number, from: number): void {
  if (by === from || by <= 0 || from <= 0 || pol.hasAccess(by, from)) return;
  if (pol.ww.isAtWar(by, from)) return;
  pol.access.push({ by, from });
  tell(pol, "ww1936_treaty", "access", from, by);
  pol.land.onFactionsChanged();
  pol.markGlobal();
}

/** Spec §16.3: `by`'s divisions left on `from`'s land go home in dailyTreaties' sweep. */
export function endAccess(pol: WwPolitics, by: number, from: number): void {
  const n = pol.access.length;
  pol.access = pol.access.filter((x) => !(x.by === by && x.from === from));
  if (pol.access.length === n) return;
  tell(pol, "ww1936_treaty_ended", "access", from, by);
  pol.land.onFactionsChanged();
  pol.markGlobal();
}

/** Every guarantee, pact and access `id` gave or got (capitulation, annexation). */
export function endTreatiesOf(pol: WwPolitics, id: number): void {
  const g = pol.guarantees.filter((x) => x.by !== id && x.to !== id);
  const n = pol.naps.filter((x) => x.a !== id && x.b !== id);
  const a = pol.access.filter((x) => x.by !== id && x.from !== id);
  const accessChanged = a.length !== pol.access.length;
  if (
    g.length === pol.guarantees.length &&
    n.length === pol.naps.length &&
    !accessChanged
  ) {
    return;
  }
  pol.guarantees = g;
  pol.naps = n;
  pol.access = a;
  if (accessChanged) pol.land.onFactionsChanged();
  pol.markGlobal();
}

// ---- Calls (spec §16.1) ----

/**
 * Spec §16.1: `attacker` declared on `target` (the first declarer only):
 * every guarantor of `target` gets gen_guarantee_called (from = target,
 * target = attacker). One in the attacker's faction gets it too: its event
 * data blocks keeping the promise.
 */
export function guaranteeCalled(
  pol: WwPolitics,
  attacker: number,
  target: number,
  tick: number,
): void {
  const enemies = pol.ww.enemiesOf(target);
  for (const g of pol.guarantees) {
    if (g.to !== target) continue;
    const by = g.by;
    if (by === attacker || !pol.living(by)) continue;
    // Controller ruling (lane D fix 1): not one already at war with an
    // enemy of the guaranteed (it fights for it), nor one a pact with the
    // attacker holds back (its "keep the promise" would fail).
    if (enemies.some((e) => pol.ww.isAtWar(by, e))) continue;
    if (pol.isAtWarBlockedByNap(by, attacker)) continue;
    pol.queueEvent("gen_guarantee_called", by, target, attacker, 0);
  }
  void tick;
}

// ---- Opinion (spec §16.4) ----

/**
 * A timed opinion modifier between `a` and `b` (both ways), or everyone's
 * opinion of `a` ("all", stored with a = 0). Past WW_MAX_OPINIONS the
 * oldest go.
 */
export function addOpinion(
  pol: WwPolitics,
  a: number,
  b: number | "all",
  value: number,
  days: number,
): void {
  if (value === 0 || a <= 0) return;
  const day = pol.day();
  if (b === "all") {
    pol.opinions.push({ a: 0, b: a, value, untilDay: day + days });
  } else {
    if (b <= 0 || b === a) return;
    pol.opinions.push({
      a: Math.min(a, b),
      b: Math.max(a, b),
      value,
      untilDay: day + days,
    });
  }
  if (pol.opinions.length > WW_MAX_OPINIONS) {
    pol.opinions.splice(0, pol.opinions.length - WW_MAX_OPINIONS);
  }
}

/** Spec §16.4: `a`'s opinion of `b`, −100..100 (base + timed modifiers). */
export function opinionOf(pol: WwPolitics, a: number, b: number): number {
  const ca = pol.country(a);
  const cb = pol.country(b);
  if (ca === null || cb === null || a === b) return 0;
  let v = ca.ruling === cb.ruling ? 20 : -10;
  if (pol.sameFaction(a, b)) v += 50;
  if (pol.ww.isAtWar(a, b)) v -= 100;
  if (pol.isAtWarBlockedByNap(a, b)) v += 10;
  if (pol.guarantees.some((g) => g.by === b && g.to === a)) v += 20;
  v -= Math.floor((pol.threatBp[b] ?? 0) / 100);
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  for (const o of pol.opinions) {
    if ((o.a === lo && o.b === hi) || (o.a === 0 && o.b === b)) v += o.value;
  }
  return Math.max(-100, Math.min(100, v));
}

// ---- The day's common step ----

/**
 * Spec §16: expired opinions and cooldowns go; guarantees end when the two
 * fight, share a faction or one is gone; pacts and access when the two
 * fight or one is gone. Then controller ruling R14: divisions standing
 * where they may no longer be go to their side's nearest region.
 */
export function dailyTreaties(
  pol: WwPolitics,
  day: number,
  tick: number,
): void {
  if (pol.opinions.some((o) => o.untilDay <= day)) {
    pol.opinions = pol.opinions.filter((o) => o.untilDay > day);
  }
  for (const c of pol.list()) {
    for (const [t, until] of [...c.improveCooldown]) {
      if (until <= day) c.improveCooldown.delete(t);
    }
  }
  const ww = pol.ww;
  for (const g of [...pol.guarantees]) {
    if (
      !pol.living(g.by) ||
      !pol.living(g.to) ||
      ww.isAtWar(g.by, g.to) ||
      pol.sameFaction(g.by, g.to)
    ) {
      endGuarantee(pol, g.by, g.to);
    }
  }
  for (const n of [...pol.naps]) {
    if (!pol.living(n.a) || !pol.living(n.b) || ww.isAtWar(n.a, n.b)) {
      breakNap(pol, n.a, n.b);
    }
  }
  for (const x of [...pol.access]) {
    if (!pol.living(x.by) || !pol.living(x.from) || ww.isAtWar(x.by, x.from)) {
      endAccess(pol, x.by, x.from);
    }
  }
  sweepRefused(pol.land);
  void tick;
}

// ---- The AI's answer to a request (controller ruling R1) ----

const ASK_OF: Readonly<Record<string, DiploAsk>> = {
  gen_diplo_faction_invite: "faction_invite",
  gen_diplo_faction_request: "faction_request",
  gen_diplo_nap: "nap",
  gen_diplo_access: "access",
};

/**
 * Controller ruling R1: the engine's answer to a diplomatic request event,
 * which E's aiChooseOption asks first and a human card shows as its
 * default. 1. A call to arms (spec §15.5, callToArmsChoice); a guarantee's
 * call that history keeps. 2. With historical AI, a request a due history
 * beat makes is accepted. 3. The acceptance score (spec §18.6-4): ≥ 50
 * accepts ("a"), else "b". null: the event's own weights decide.
 */
export function diploEventChoice(
  pol: WwPolitics,
  eventId: EventId,
  to: number,
  from: number,
  target: number,
): string | null {
  if (eventId === "gen_call_to_arms") {
    return callToArmsChoice(pol, to, from, target);
  }
  // A guarantee history keeps (1939-09-03): certain; else the event's weights.
  if (eventId === "gen_guarantee_called") {
    return pol.mg.config().historicalAi() &&
      warBeatDue(pol, to, target, pol.day())
      ? "a"
      : null;
  }
  const kind = ASK_OF[eventId];
  if (kind === undefined) return null;
  if (pol.mg.config().historicalAi() && historyAsks(pol, kind, from, to)) {
    return "a";
  }
  return aiAcceptScore(pol, kind, from, to) >= 50 ? "a" : "b";
}

/**
 * A diplo beat making this request that is due and not yet done or
 * skipped (controller ruling R1, final: lane E marks a beat done after it
 * acts, so the beat's own request still matches).
 */
function historyAsks(
  pol: WwPolitics,
  kind: DiploAsk,
  from: number,
  to: number,
): boolean {
  const day = pol.day();
  const f = pol.tagOf(from);
  const t = pol.tagOf(to);
  const factionOfTag = (tag: CountryTag) => pol.factionIdx(pol.idOfTag(tag));
  return pol.content.beats.some((b, i) => {
    const s = pol.beats[i];
    if (s === undefined || s.skipped || s.done || s.fireDay > day) return false;
    if (b.act.kind !== "diplo") return false;
    const { order, target } = b.act;
    switch (kind) {
      case "nap":
        return (
          order === "nap" &&
          ((b.actor === f && target === t) || (b.actor === t && target === f))
        );
      case "access":
        return order === "access" && b.actor === f && target === t;
      case "faction_invite":
        return (
          (order === "invite" && b.actor === f && target === t) ||
          (order === "join_faction" &&
            b.actor === t &&
            factionOfTag(target) >= 0 &&
            factionOfTag(target) === pol.factionIdx(from))
        );
      case "faction_request":
        return (
          (order === "join_faction" &&
            b.actor === f &&
            factionOfTag(target) >= 0 &&
            factionOfTag(target) === pol.factionIdx(to)) ||
          (order === "invite" && b.actor === t && target === f)
        );
    }
  });
}
