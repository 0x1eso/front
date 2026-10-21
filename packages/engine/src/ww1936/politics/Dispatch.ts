// World War 1936 P3 (spec §10.2, §10.5; plan decisions 12, 13): the effect
// dispatcher. `who` changes only the country an effect acts on (the
// actor); the other selectors inside it (target, of, to, on) resolve in
// the original context, so { kind: "annex", who: "from", target: "self" }
// (Germany annexes Austria, spec §20.3) means what it says. The group
// functions take (ctx, e, actor).
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  Effect,
  effectGroup,
  Selector,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import { applyDiploEffect } from "./EffectsDiplo";
import { applyEconEffect } from "./EffectsEcon";
import { applyEventEffect } from "./EffectsEvent";
import { applyNavyEffect } from "./EffectsNavy";
import { applyPoliticalEffect } from "./EffectsPol";
import { applyTerritoryEffect } from "./Territory";
import type { WwPolitics } from "./WwPolitics";

/**
 * Spec §10.2: who the data talks about. self: the focus / decision owner or
 * the event receiver; from: the event's sender; target: the decision's or
 * request's target. depth: the event chain length (spec §10.5-3).
 */
export interface EffectCtx {
  pol: WwPolitics;
  self: number;
  from: number;
  target: number;
  day: number;
  tick: number;
  depth: number;
}

export function makeCtx(
  pol: WwPolitics,
  self: number,
  from: number,
  target: number,
  tick: number,
  depth = 0,
): EffectCtx {
  return { pol, self, from, target, day: pol.ww.day(tick), tick, depth };
}

/** The smallID a selector names; 0 when nobody (not in this scenario, no faction). Dead countries resolve. */
export function resolveSelector(
  ctx: EffectCtx,
  s: Selector | undefined,
): number {
  if (s === undefined || s === "self") return ctx.self;
  if (s === "from") return ctx.from;
  if (s === "target") return ctx.target;
  if ("tag" in s) return ctx.pol.idOfTag(s.tag as CountryTag);
  if ("factionLeaderOf" in s) {
    const of = resolveSelector(ctx, s.factionLeaderOf);
    return ctx.pol.faction(ctx.pol.factionIdx(of))?.leader ?? 0;
  }
  const g = ctx.pol.content.groupIdx.get(s.ownerOf);
  if (g === undefined || g.regions.length === 0) return 0;
  return ctx.pol.legalOwner[g.regions[0]] ?? 0;
}

/** Spec §10.5-1/-2: in order; an effect whose actor is missing or dead is skipped. */
export function applyEffects(ctx: EffectCtx, effects: readonly Effect[]): void {
  for (const e of effects) applyEffect(ctx, e);
}

export function applyEffect(ctx: EffectCtx, e: Effect): void {
  const actor = e.who === undefined ? ctx.self : resolveSelector(ctx, e.who);
  if (actor === 0 || !ctx.pol.living(actor)) return;
  switch (effectGroup(e.kind)) {
    case "event":
      applyEventEffect(ctx, e, actor);
      break;
    case "political":
      applyPoliticalEffect(ctx, e, actor);
      break;
    case "econ":
      applyEconEffect(ctx, e, actor);
      break;
    case "diplo":
      applyDiploEffect(ctx, e, actor);
      break;
    case "territory":
      applyTerritoryEffect(ctx, e, actor);
      break;
    // P4 plan decision 24.
    case "navy":
      applyNavyEffect(ctx, e, actor);
      break;
  }
}
