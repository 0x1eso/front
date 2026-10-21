// World War 1936 P4: the navy group of effects (P4 spec §16.3, plan
// decision 24): ships launched at once, convoys, fuel. The foundation
// writes them all (each is short).
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import { addConvoys, loseConvoys } from "../economy/Buildings";
import { fuelCapOf } from "../economy/Fuel";
import { clampToStock } from "../navy/Convoys";
import { bestNavalBase, navalPort } from "../navy/Ports";
import type { EffectCtx } from "./Dispatch";

/** The navy effects for `actor` (Dispatch, group "navy"). */
export function applyNavyEffect(
  ctx: EffectCtx,
  e: Effect,
  actor: number,
): void {
  const ww = ctx.pol.ww;
  const ce = ww.economy.country(actor);
  if (ce === null) return;
  switch (e.kind) {
    case "ships": {
      // `port` when it is the actor's working naval base, else its best one; none: skipped.
      const given =
        e.port !== undefined &&
        ww.land.controller[e.port] === actor &&
        navalPort(ww, e.port)
          ? e.port
          : 0;
      const port = given !== 0 ? given : bestNavalBase(ww, actor);
      if (port === 0) return;
      for (let i = 0; i < e.count; i++) {
        ww.navy.commissionShip(actor, e.cls, e.gen, port);
      }
      return;
    }
    case "convoys":
      if (e.amount >= 0) addConvoys(ce, e.amount);
      else {
        loseConvoys(ce, -e.amount);
        // Lane C (review): what the routes and voyages hold gives way, so
        // they never hold more than the stock (Review Focus 3).
        clampToStock(ww.navy, actor);
      }
      ww.economy.markCountryDirty(actor);
      return;
    case "fuel": {
      const cap = fuelCapOf(ww.economy, ce);
      ce.fuelMilli = Math.max(0, Math.min(cap, ce.fuelMilli + e.amount * 1000));
      ww.economy.markCountryDirty(actor);
      return;
    }
    default:
      return;
  }
}
