// World War 1936 P3: the diplomacy group of effects (spec §10.4, plan
// decision 12). Effects skip the orders' costs and gates; a target that is
// missing or gone skips the effect (spec §10.5-2).
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import { declareWar, joinWar } from "../Diplomacy";
import { type EffectCtx, resolveSelector } from "./Dispatch";
import {
  createFaction,
  dissolveFaction,
  joinFaction,
  leaveFaction,
} from "./Factions";
import { endWarBetween } from "./Territory";
import {
  addAccess,
  addGuarantee,
  addNap,
  addOpinion,
  breakNap,
  endAccess,
  endGuarantee,
} from "./Treaties";
import { addWarGoal, removeWarGoal } from "./WarGoals";

export function applyDiploEffect(
  ctx: EffectCtx,
  e: Effect,
  actor: number,
): void {
  const pol = ctx.pol;
  /** The other country of the effect; 0 when missing, dead or the actor. */
  const other = (s: Parameters<typeof resolveSelector>[1]): number => {
    const id = resolveSelector(ctx, s);
    return id === actor || !pol.living(id) ? 0 : id;
  };
  switch (e.kind) {
    case "war_goal": {
      const on = other(e.on);
      if (on !== 0) addWarGoal(pol, actor, on, e.type, e.group ?? "", ctx.day);
      return;
    }
    case "remove_war_goal": {
      const on = resolveSelector(ctx, e.on);
      if (on > 0) removeWarGoal(pol, actor, on);
      return;
    }
    case "declare_war": {
      // Spec §14.5 (end): no goal → one made on the spot, no penalty.
      const on = other(e.on);
      const ap = pol.player(actor);
      const tp = pol.player(on);
      if (on === 0 || ap === null || tp === null) return;
      const made = !pol.hasWarGoal(actor, on);
      if (made) addWarGoal(pol, actor, on, e.goal ?? "conquer", "", ctx.day);
      const joined = declareWar(pol.mg, pol.ww, ap, tp, ctx.tick);
      // Refused (a pact, a guarantee…): the goal made for it goes again.
      if (joined.length === 0 && made) removeWarGoal(pol, actor, on);
      return;
    }
    case "join_war": {
      const on = other(e.of);
      const ap = pol.player(actor);
      const tp = pol.player(on);
      if (on === 0 || ap === null || tp === null) return;
      joinWar(pol.mg, pol.ww, ap, tp, ctx.tick);
      return;
    }
    case "end_war": {
      const on = resolveSelector(ctx, e.of);
      if (on > 0) endWarBetween(pol, actor, on, ctx.tick);
      return;
    }
    case "create_faction":
      createFaction(pol, actor, e.name, ctx.day);
      return;
    case "join_faction": {
      // Into `of`'s faction; nothing when it has none, when the actor is in
      // one already, or when it fights a member.
      const of = resolveSelector(ctx, e.of);
      const idx = of > 0 ? pol.factionIdx(of) : -1;
      if (idx < 0 || pol.factionIdx(actor) >= 0) return;
      const f = pol.faction(idx)!;
      if (f.members.some((m) => pol.ww.isAtWar(m, actor))) return;
      joinFaction(pol, actor, idx, ctx.tick);
      return;
    }
    case "invite": {
      const of = other(e.of);
      if (of === 0 || pol.factionIdx(actor) < 0 || pol.factionIdx(of) >= 0) {
        return;
      }
      pol.queueEvent("gen_diplo_faction_invite", of, actor, 0, ctx.depth + 1);
      return;
    }
    case "leave_faction": {
      if (pol.factionIdx(actor) < 0) return;
      // Controller ruling R8: the effect pays the −5%.
      const c = pol.country(actor)!;
      c.stabBaseBp = Math.max(0, c.stabBaseBp - 500);
      leaveFaction(pol, actor, ctx.tick);
      return;
    }
    case "kick": {
      const of = resolveSelector(ctx, e.of);
      const f = pol.faction(pol.factionIdx(actor));
      if (f === null || f.leader !== actor || of === actor) return;
      if (!f.members.includes(of)) return;
      leaveFaction(pol, of, ctx.tick);
      return;
    }
    case "dissolve_faction": {
      const idx = pol.factionIdx(actor);
      if (idx < 0 || pol.faction(idx)!.leader !== actor) return;
      dissolveFaction(pol, idx, ctx.tick);
      return;
    }
    case "guarantee": {
      const of = other(e.of);
      if (of !== 0) addGuarantee(pol, actor, of, ctx.day);
      return;
    }
    case "end_guarantee": {
      const of = resolveSelector(ctx, e.of);
      if (of > 0) endGuarantee(pol, actor, of);
      return;
    }
    case "nap": {
      const of = other(e.of);
      if (of !== 0) addNap(pol, actor, of, ctx.day);
      return;
    }
    case "break_nap": {
      // Without the order's cost, age rule and penalties (the data adds its own).
      const of = resolveSelector(ctx, e.of);
      if (of > 0) breakNap(pol, actor, of);
      return;
    }
    case "access": {
      // The actor opens its land to `of`.
      const of = other(e.of);
      if (of !== 0) addAccess(pol, of, actor);
      return;
    }
    case "end_access": {
      const of = resolveSelector(ctx, e.of);
      if (of > 0) endAccess(pol, of, actor);
      return;
    }
    case "opinion": {
      if (e.of === "all") {
        addOpinion(pol, actor, "all", e.value, e.days);
        return;
      }
      const of = resolveSelector(ctx, e.of);
      if (of > 0 && of !== actor) addOpinion(pol, actor, of, e.value, e.days);
      return;
    }
    default:
      return;
  }
}
