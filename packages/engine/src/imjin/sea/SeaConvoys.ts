// Imjin sea layer (design §6.2): convoys sail as visible groups along their
// route at strategic speed. A hostile fleet within 8 tiles intercepts: an
// escort of the route turns it into a battle; unescorted, the group loses
// cargo in proportion to the raider's guns and arquebus. Supply arrives only
// by the groups that land (`arrivals`, read by the SeaSupply bridge).
import {
  CONVOY_INTERCEPT_MT,
  distMt,
  gunWeight,
  HEAVY_CYCLE,
  raidLossPm,
  shipStats,
  STRATEGIC_SPEED_MT,
} from "@openfront/engine-lib/imjin/SeaRules";
import { engage } from "./SeaBattle";
import { SeaCtx, tileCentre } from "./SeaCtx";
import { followPath } from "./SeaFleets";
import { ConvoyGroup, SeaState, shipIndex } from "./SeaState";

/** Start a group of convoys on a route; null when no water path exists. */
export function addConvoyGroup(
  st: SeaState,
  ctx: SeaCtx,
  owner: number,
  route: number,
  from: number,
  to: number,
  convoys: number,
  cargo: number,
  hub = 0,
): ConvoyGroup | null {
  const path = from === to ? [to] : ctx.path(from, to);
  if (!path || path.length === 0) return null;
  const c = tileCentre(ctx, from);
  const g: ConvoyGroup = {
    id: st.nextId++,
    owner,
    route,
    path,
    pathIdx: 0,
    x: c.x,
    y: c.y,
    convoys,
    cargo,
    raidedBy: [],
  };
  if (hub !== 0) g.hub = hub;
  st.groups.push(g);
  return g;
}

/** One tick of every convoy group: sail, be intercepted, land. */
export function convoyStep(st: SeaState, ctx: SeaCtx): void {
  const idx = shipIndex(st);
  const landed: number[] = [];
  for (const g of st.groups) {
    const r = followPath(ctx, g.path, g.pathIdx, g.x, g.y, STRATEGIC_SPEED_MT);
    g.x = r.x;
    g.y = r.y;
    g.pathIdx = r.idx;
    for (const f of st.fleets) {
      if (f.fleeing || f.ships.length === 0) continue;
      if (!ctx.hostile(f.owner, g.owner) || g.raidedBy.includes(f.id)) continue;
      if (distMt(f.x - g.x, f.y - g.y) > CONVOY_INTERCEPT_MT) continue;
      g.raidedBy.push(f.id);
      g.raidedBy.sort((a, b) => a - b);
      const escort = st.fleets.find(
        (e) =>
          e.order === "escort" &&
          e.target === g.route &&
          !ctx.hostile(e.owner, g.owner) &&
          e.ships.length > 0 &&
          distMt(e.x - g.x, e.y - g.y) <= CONVOY_INTERCEPT_MT,
      );
      if (escort) {
        engage(st, ctx, f, escort);
        continue;
      }
      let guns = 0;
      let arq = 0;
      for (const id of f.ships) {
        const s = idx.get(id);
        if (!s) continue;
        guns += Math.floor(gunWeight(shipStats(s.kind)) / HEAVY_CYCLE);
        arq += shipStats(s.kind).arq;
      }
      const pm = raidLossPm(guns, arq);
      const lostCargo = Math.floor((g.cargo * pm) / 1000);
      g.cargo -= lostCargo;
      g.convoys -= Math.floor((g.convoys * pm) / 1000);
      st.events.push({ tick: ctx.tick, kind: "raid", a: g.id, b: f.id });
    }
    if (g.pathIdx >= g.path.length) {
      st.arrivals.push({
        owner: g.owner,
        route: g.route,
        hub: g.hub ?? 0,
        convoys: g.convoys,
        cargo: g.cargo,
        tick: ctx.tick,
      });
      landed.push(g.id);
    }
  }
  if (landed.length)
    st.groups = st.groups.filter((g) => !landed.includes(g.id));
}
