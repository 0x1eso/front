// World War 1936 P6 (plan decision 27, Task 1 Step 11): the depth effects.
// The foundation writes the dispatch (each kind to the lane that owns its
// state); P6 lane W3 fills applyMechEffect (plan Task 9).
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import { permPctOfXp } from "@openfront/engine-lib/ww1936/ThoughtRules";
import { applyIntelEffect } from "../depth/Agency";
import { addBop } from "../depth/BalanceOfPower";
import { addCongressPp, dissolveCongress, usaIdOf } from "../depth/Congress";
import { grantDesign } from "../depth/Designs";
import { applyEnergyEffect } from "../depth/Energy";
import { applyProjectEffect, applyStartProjectEffect } from "../depth/Projects";
import { applyMasteryEffect } from "../depth/Thought";
import type { WwDepth } from "../depth/WwDepth";
import { damageBuilding } from "../economy/Buildings";
import type { EffectCtx } from "./Dispatch";
import { pickRegions } from "./EffectsEcon";

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
    case "start_project":
      applyStartProjectEffect(ctx, e, actor);
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
 * (while the actor's mechanism is on), cp (ww9: ± whole points of
 * army experience, kept at 0 or more; no content uses it), cfocus_unlock.
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
    case "congress_dissolve":
      if (actor === usaIdOf(d)) dissolveCongress(d, actor);
      return;
    case "damage_buildings": {
      // Region picks as `build` does; the damage is capped by what stands.
      const econ = d.ww.economy;
      for (const r of pickRegions(ctx.pol, actor, e.where, undefined, ctx)) {
        damageBuilding(econ, r, e.building, e.milli);
      }
      econ.markCountryDirty(actor);
      return;
    }
    case "bop":
      addBop(d, actor, e.amount, ctx.day);
      return;
    case "cp":
      // ww15: the old command power is the army's permanent bonus (army_xp's).
      d.addPermPct(actor, 0, permPctOfXp(e.amount));
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
