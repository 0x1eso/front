// Imjin sea layer (design §6.2): fleet orders, strategic movement on the
// water A* at about 2 tiles a tick, slot keeping out of battle, splitting a
// detachment off (the lure), and repair in port.
import type { Formation } from "@openfront/engine-lib/imjin/SeaRules";
import {
  angleOf,
  distMt,
  formationChangeTicks,
  formationSlot,
  MORALE_MAX,
  MORALE_RALLY,
  MT,
  repairPmPerDay,
  rotate,
  SEA_TICKS_PER_SECOND,
  shipStats,
  STRATEGIC_SPEED_MT,
} from "@openfront/engine-lib/imjin/SeaRules";
import { flagsAt, SeaCtx, tileAt, tileCentre } from "./SeaCtx";
import {
  fullHull,
  newAdmiral,
  SeaFleet,
  SeaShip,
  SeaState,
  shipIndex,
} from "./SeaState";

export type SeaOrder =
  | { kind: "move"; tile: number }
  | { kind: "hold" }
  | { kind: "formation"; formation: Formation }
  | { kind: "engage"; mode: "board" | "keep_range" }
  | { kind: "break_off" }
  | { kind: "fire_ship"; ship: number }
  | { kind: "lure"; tile: number }
  | { kind: "escort"; route: number };

/** Apply an order from `owner` to one of its fleets; false when refused. */
export function seaOrder(
  st: SeaState,
  ctx: SeaCtx,
  owner: number,
  fleetId: number,
  order: SeaOrder,
): boolean {
  const f = st.fleets.find((x) => x.id === fleetId);
  if (!f || f.owner !== owner) return false;
  switch (order.kind) {
    case "move":
    case "lure": {
      if (!ctx.isWater(order.tile)) return false;
      const from = tileAt(ctx, f.x, f.y);
      if (from < 0) return false;
      const p = from === order.tile ? [order.tile] : ctx.path(from, order.tile);
      if (!p || p.length === 0) return false;
      f.order = order.kind;
      f.target = order.tile;
      f.path = p;
      f.pathIdx = 0;
      return true;
    }
    case "hold":
      f.order = "hold";
      f.target = -1;
      f.path = [];
      f.pathIdx = 0;
      return true;
    case "formation":
      if (order.formation === f.formationTo) return true;
      // ww177 final: a chaser in disorder cannot re-form yet.
      if ((f.disorder ?? 0) > 0) return false;
      f.formationTo = order.formation;
      f.formationTicks = formationChangeTicks(f.admiral.tactics);
      return true;
    case "engage":
      f.order = order.mode;
      return true;
    case "break_off":
      f.order = "break_off";
      return true;
    case "fire_ship": {
      if (!f.ships.includes(order.ship)) return false;
      const s = st.ships.find((x) => x.id === order.ship);
      if (!s || !shipStats(s.kind).small) return false;
      s.fireShip = 1;
      return true;
    }
    case "escort":
      f.order = "escort";
      f.target = order.route;
      f.path = [];
      f.pathIdx = 0;
      return true;
  }
}

/** Split ships off into a new fleet (a lure detachment); its admiral has no skills. */
export function splitFleet(
  st: SeaState,
  fleetId: number,
  shipIds: readonly number[],
): SeaFleet | undefined {
  const f = st.fleets.find((x) => x.id === fleetId);
  if (!f) return undefined;
  const moving = f.ships.filter(
    (id) => id !== f.ships[0] && shipIds.includes(id),
  );
  if (moving.length === 0) return undefined;
  const idx = shipIndex(st);
  const lead = idx.get(moving[0])!;
  const nf: SeaFleet = {
    ...f,
    id: st.nextId++,
    ships: moving,
    admiral: newAdmiral({ alive: 1 }),
    path: [],
    pathIdx: 0,
    order: "hold",
    target: -1,
    x: lead.x,
    y: lead.y,
    still: 0,
    ambush: 0,
    lurk: 0,
  };
  delete nf.lureTo;
  f.ships = f.ships.filter((id) => !moving.includes(id));
  for (const id of moving) idx.get(id)!.fleet = nf.id;
  st.fleets.push(nf);
  st.fleets.sort((a, b) => a.id - b.id);
  return nf;
}

/** Where a slot sits now: the flagship's position plus the rotated slot offset. */
export function slotPoint(
  f: SeaFleet,
  slot: number,
  count: number,
  ax: number,
  ay: number,
  heading: number,
  channel: boolean,
): { x: number; y: number } {
  const o = formationSlot(channel ? "column" : f.formation, slot, count);
  const r = rotate(o.fwd, o.stbd, heading);
  return { x: ax + r.dx, y: ay + r.dy };
}

/** Advance a point along a tile path by a budget; returns the new state. */
export function followPath(
  ctx: SeaCtx,
  path: readonly number[],
  idx: number,
  x: number,
  y: number,
  budget: number,
): { x: number; y: number; idx: number; heading: number | null } {
  let heading: number | null = null;
  while (budget > 0 && idx < path.length) {
    const c = tileCentre(ctx, path[idx]);
    const dx = c.x - x;
    const dy = c.y - y;
    const d = distMt(dx, dy);
    if (d > 0) heading = angleOf(dx, dy);
    if (d <= budget) {
      x = c.x;
      y = c.y;
      budget -= d;
      idx++;
    } else {
      x += Math.trunc((dx * budget) / d);
      y += Math.trunc((dy * budget) / d);
      budget = 0;
    }
  }
  return { x, y, idx, heading };
}

/** One tick of a fleet outside battle: its path, its slots, its rest. */
export function strategicStep(
  st: SeaState,
  ctx: SeaCtx,
  f: SeaFleet,
  idx: Map<number, SeaShip>,
): void {
  const x0 = f.x;
  const y0 = f.y;
  if (f.order === "escort") escortStep(st, ctx, f);
  if (f.pathIdx < f.path.length) {
    const r = followPath(ctx, f.path, f.pathIdx, f.x, f.y, STRATEGIC_SPEED_MT);
    f.x = r.x;
    f.y = r.y;
    f.pathIdx = r.idx;
    if (r.heading !== null) f.heading = r.heading;
    if (f.pathIdx >= f.path.length) {
      f.path = [];
      f.pathIdx = 0;
      if (f.order === "move" || f.order === "lure") f.order = "hold";
      if (f.fleeing) {
        f.fleeing = 0;
        f.morale = Math.max(f.morale, MORALE_RALLY);
      }
      rejoin(st, f, idx);
    }
  }
  f.still = f.x === x0 && f.y === y0 ? f.still + 1 : 0;
  if (f.formationTicks > 0 && --f.formationTicks === 0)
    f.formation = f.formationTo;
  if (
    !f.fleeing &&
    f.morale < MORALE_MAX &&
    ctx.tick % SEA_TICKS_PER_SECOND === 0
  )
    f.morale++;
  // Ships close on their slots at strategic speed.
  const channel = flagsAt(ctx, f.x, f.y).channel;
  const n = f.ships.length;
  for (let i = 0; i < n; i++) {
    const s = idx.get(f.ships[i]);
    if (!s) continue;
    s.fire = 0;
    s.fouled = 0;
    s.stuck = 0;
    let p = slotPoint(f, i, n, f.x, f.y, f.heading, channel);
    const t = tileAt(ctx, p.x, p.y);
    if (t < 0 || !ctx.isWater(t)) p = { x: f.x, y: f.y };
    const dx = p.x - s.x;
    const dy = p.y - s.y;
    const d = distMt(dx, dy);
    const step = STRATEGIC_SPEED_MT + (STRATEGIC_SPEED_MT >> 1);
    if (d <= step) {
      s.x = p.x;
      s.y = p.y;
      s.heading = f.heading;
    } else {
      s.x += Math.trunc((dx * step) / d);
      s.y += Math.trunc((dy * step) / d);
      s.heading = angleOf(dx, dy);
    }
    // ww177 I5b: the straight run to the slot may cross a headland; a ship
    // never stops on land (a battle would find it there and it could not
    // move again): it keeps to the flagship's wake instead.
    const st2 = tileAt(ctx, s.x, s.y);
    if (st2 < 0 || !ctx.isWater(st2)) {
      s.x = f.x;
      s.y = f.y;
    }
    s.tx = s.x;
    s.ty = s.y;
  }
}

/**
 * ww177 m2: ships that fled one by one (no admiral aboard) join a friendly
 * fleet lying within 3 tiles of the port they reach; I5b: so does any
 * fleet without an admiral that ends a voyage there.
 */
function rejoin(st: SeaState, f: SeaFleet, idx: Map<number, SeaShip>): void {
  if (f.admiral.alive) return;
  const g = st.fleets.find(
    (o) =>
      o !== f &&
      o.owner === f.owner &&
      o.battle === 0 &&
      !o.fleeing &&
      o.ships.length > 0 &&
      distMt(o.x - f.x, o.y - f.y) <= 3 * MT,
  );
  if (!g) return;
  for (const id of f.ships) {
    const s = idx.get(id);
    if (s) s.fleet = g.id;
  }
  g.ships.push(...f.ships);
  f.ships = [];
  st.fleets = st.fleets.filter((o) => o !== f);
}

/** An escort sails with the first group of its route. */
function escortStep(st: SeaState, ctx: SeaCtx, f: SeaFleet): void {
  const g = st.groups.find((x) => x.route === f.target && x.owner === f.owner);
  if (!g) return;
  const d = distMt(g.x - f.x, g.y - f.y);
  if (d <= 2000) {
    f.path = [];
    f.pathIdx = 0;
    return;
  }
  if (f.pathIdx < f.path.length && ctx.tick % 20 !== 0) return;
  const from = tileAt(ctx, f.x, f.y);
  const to = tileAt(ctx, g.x, g.y);
  if (from < 0 || to < 0 || from === to) return;
  const p = ctx.path(from, to);
  if (p) {
    f.path = p;
    f.pathIdx = 0;
  }
}

/** Once a day: ships in a friendly naval base mend hull and fill crew. */
export function seaDailyRepair(st: SeaState, ctx: SeaCtx): void {
  const idx = shipIndex(st);
  for (const f of st.fleets) {
    if (f.battle) continue;
    const t = tileAt(ctx, f.x, f.y);
    if (t < 0) continue;
    const pm = repairPmPerDay(ctx.portLevelAt(f.owner, t));
    if (pm <= 0) continue;
    for (const id of f.ships) {
      const s = idx.get(id);
      if (!s) continue;
      const full = fullHull(s.kind);
      s.hull = Math.min(full, s.hull + Math.floor((full * pm) / 1000));
      const crew = shipStats(s.kind).crew;
      s.crew = Math.min(crew, s.crew + Math.max(1, Math.floor(crew / 10)));
    }
  }
}
