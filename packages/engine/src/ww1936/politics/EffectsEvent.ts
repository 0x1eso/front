// World War 1936 P3: the event group of effects (spec §10.4, plan decision
// 12). Lane E (Task 3).
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import {
  idHash,
  P_RAND,
  pickWeighted,
  wwRoll,
} from "@openfront/engine-lib/ww1936/Roll";
import { evalCondition } from "./Conditions";
import { takeDecision } from "./Decisions";
import { applyEffects, EffectCtx, resolveSelector } from "./Dispatch";
import { addTension } from "./Tension";

export function applyEventEffect(
  ctx: EffectCtx,
  e: Effect,
  actor: number,
): void {
  const pol = ctx.pol;
  const c = pol.country(actor)!;
  switch (e.kind) {
    case "fire_event": {
      // `to` resolves in the original context (Dispatch); the actor sends it.
      const to = e.to === undefined ? actor : resolveSelector(ctx, e.to);
      if (to === 0 || !pol.living(to)) return;
      if (e.days !== undefined && e.days > 0) {
        // Spec §10.5-3: the delay list (state), on that day's common step.
        pol.addDelayed({
          day: ctx.day + e.days,
          kind: "fire",
          eventId: e.id,
          to,
          from: actor,
          target: ctx.target,
          option: "",
        });
      } else {
        pol.queueEvent(e.id, to, actor, ctx.target, ctx.depth + 1);
      }
      return;
    }
    case "news":
      // Controller ruling R3: country params end in "Tag"; none: "none".
      pol.news(e.id, {
        countryTag: pol.tagOf(actor),
        targetTag: ctx.target > 0 ? pol.tagOf(ctx.target) : "none",
      });
      return;
    case "unlock_decision":
      c.unlocked.add(e.id);
      c.locked.delete(e.id);
      pol.markCountry(actor);
      return;
    case "lock_decision":
      c.locked.add(e.id);
      pol.markCountry(actor);
      return;
    case "take_decision":
      // Plan decision 21: free (no cost, conditions or cooldown check).
      takeDecision(pol, actor, e.id, ctx.target, ctx.tick, true);
      return;
    case "if":
      applyEffects(ctx, evalCondition(ctx, e.cond) ? e.then : (e.else ?? []));
      return;
    case "random_list": {
      // Spec §22.2: stateless; nextUid makes two lists in one tick differ.
      const k = pickWeighted(
        e.options.map((o) => o.weight),
        wwRoll(
          pol.seed,
          P_RAND,
          idHash(pol.tagOf(actor)),
          ctx.tick,
          pol.nextUid++,
        ),
      );
      if (k >= 0) applyEffects(ctx, e.options[k].effects);
      return;
    }
    case "tension":
      addTension(pol, actor, e.pct * 100);
      return;
    default:
      return;
  }
}
