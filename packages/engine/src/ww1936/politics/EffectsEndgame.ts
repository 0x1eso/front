// World War 1936 P5 (plan decision 26): the endgame effects. The
// foundation writes the dispatch (each kind to the lane that owns its
// state); P5 lane E fills applyOtherEndgameEffect (plan Task 8).
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import { applyActivationEffect } from "../endgame/Activate";
import { applyAidEffect } from "../endgame/LendLease";
import { applySubjectEffect } from "../endgame/Subjects";
import type { EffectCtx } from "./Dispatch";

export function applyEndgameEffect(
  ctx: EffectCtx,
  e: Effect,
  actor: number,
): void {
  switch (e.kind) {
    case "release":
    case "create_state":
    case "restore_country":
    case "set_name":
      applyActivationEffect(ctx, e, actor); // X
      return;
    case "make_subject":
    case "end_subject":
    case "autonomy":
      applySubjectEffect(ctx, e, actor); // S
      return;
    case "lend_lease":
    case "volunteers":
    case "transfer_ships":
    case "scuttle_fleet":
    case "embargo":
    case "end_embargo":
      applyAidEffect(ctx, e, actor); // A
      return;
    default:
      applyOtherEndgameEffect(ctx, e, actor); // E
  }
}

/**
 * P5 lane E fills this (plan Task 8): occupation_zone, annex_occupied,
 * separate_peace, switch_sides, exile_legitimacy, reparations, surrender,
 * uprising, resistance, compliance, navy_xp. Stub: nothing.
 */
export function applyOtherEndgameEffect(
  ctx: EffectCtx,
  e: Effect,
  actor: number,
): void {
  void ctx;
  void e;
  void actor;
}
