// World War 1936 P6 (plan decision 27, Task 1 Step 11): the depth effects.
// The foundation writes the dispatch (each kind to the lane that owns its
// state); P6 lane W3 fills applyMechEffect (plan Task 9).
import { CP_MAX_MILLI } from "@openfront/engine-api/ww1936/DepthTypes";
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import { applyIntelEffect } from "../depth/Agency";
import { addBop } from "../depth/BalanceOfPower";
import { addCongressPp, usaIdOf } from "../depth/Congress";
import { grantDesign } from "../depth/Designs";
import { applyMasteryEffect } from "../depth/Doctrine";
import { applyEnergyEffect } from "../depth/Energy";
import { applyProjectEffect } from "../depth/Projects";
import type { WwDepth } from "../depth/WwDepth";
import type { EffectCtx } from "./Dispatch";

export function applyDepthEffect(
  ctx: EffectCtx,
  e: Effect,
  actor: number,
): void {
  switch (e.kind) {
    case "doctrine_mastery":
      applyMasteryEffect(ctx, e, actor); // D
      return;
    case "design_grant":
      grantDesign(ctx, e, actor); // E
      return;
    case "intel_network":
    case "decrypt":
    case "agency":
      applyIntelEffect(ctx, e, actor); // I
      return;
    case "project_progress":
      applyProjectEffect(ctx, e, actor); // S
      return;
    case "energy":
      applyEnergyEffect(ctx, e, actor); // W1
      return;
    default:
      applyMechEffect(ctx, e, actor); // W3
  }
}

/**
 * P6 lane W3 (plan Task 9 Step 6): congress (the US only, ± points), bop
 * (while the actor's mechanism is on), cp (D's cmd.cpMilli, ± whole
 * points, kept in 0..CP_MAX_MILLI), cfocus_unlock.
 */
export function applyMechEffect(
  ctx: EffectCtx,
  e: Effect,
  actor: number,
): void {
  // Neutral before depth exists (pre-flight §0-9).
  const d = ctx.pol.ww.depth as WwDepth | undefined;
  const c = d?.country(actor) ?? null;
  if (d === undefined || c === null) return;
  switch (e.kind) {
    case "congress":
      if (actor === usaIdOf(d)) addCongressPp(d, actor, e.pp);
      return;
    case "bop":
      addBop(d, actor, e.amount, ctx.day);
      return;
    case "cp":
      c.cmd.cpMilli = Math.max(
        0,
        Math.min(CP_MAX_MILLI, c.cmd.cpMilli + e.amount * 1000),
      );
      d.markCountry(actor);
      return;
    case "cfocus_unlock":
      if (!c.mech.cfocusOpen) {
        c.mech.cfocusOpen = true;
        d.markCountry(actor);
      }
      return;
    default:
      return;
  }
}
