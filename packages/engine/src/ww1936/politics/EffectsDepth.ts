// World War 1936 P6 (plan decision 27, Task 1 Step 11): the depth effects.
// The foundation writes the dispatch (each kind to the lane that owns its
// state); P6 lane W3 fills applyMechEffect (plan Task 9).
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import { applyIntelEffect } from "../depth/Agency";
import { grantDesign } from "../depth/Designs";
import { applyMasteryEffect } from "../depth/Doctrine";
import { applyEnergyEffect } from "../depth/Energy";
import { applyProjectEffect } from "../depth/Projects";
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
 * P6 lane W3 fills this (plan Task 9): congress, bop, cp (D's
 * cmd.cpMilli), cfocus_unlock. Stub: nothing.
 */
export function applyMechEffect(
  ctx: EffectCtx,
  e: Effect,
  actor: number,
): void {
  void ctx;
  void e;
  void actor;
}
