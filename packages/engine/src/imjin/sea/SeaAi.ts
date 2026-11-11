// The Imjin sea AI, a first cut (ww175 design §9 "Sea"; P5 deepens it):
// once a day each fleet of a country no human steers picks one aim. Japan
// closes to board and guards its supply groups; Joseon and Ming keep range
// and hunt what they can beat. A beaten fleet goes home to mend.
import { distMt, MT, shipStats } from "@openfront/engine-lib/imjin/SeaRules";
import type { WwImjin } from "../WwImjin";
import { tileAt } from "./SeaCtx";
import { seaOrder } from "./SeaFleets";
import type { SeaFleet, SeaState } from "./SeaState";
import { shipIndex } from "./SeaState";

/** A fleet seeks battle only against a foe at most this many times stronger (%). */
const ODDS_PCT = 130;
/** How far a fleet looks for a target, milli-tiles. */
const HUNT_MT = 260 * MT;
/**
 * Joseon and Ming hold their own waters (design §9): they seek a foe only
 * this close to one of their ports, milli-tiles.
 */
const HOME_WATERS_MT = 90 * MT;
/** Below this hull share (‰) a fleet goes home to mend. */
const MEND_HULL_PM = 550;
/** It sails again once mended to this share. */
const SAIL_HULL_PM = 850;

export function fleetStrength(st: SeaState, f: SeaFleet): number {
  const idx = shipIndex(st);
  let v = 0;
  for (const id of f.ships) {
    const s = idx.get(id);
    if (s === undefined) continue;
    const k = shipStats(s.kind);
    v += Math.floor(
      ((k.guns * 3 + k.arq * 2 + k.boardAtk * 2 + 2) * s.hull) /
        (k.hull * 1000),
    );
  }
  return v;
}

function hullPm(st: SeaState, f: SeaFleet): number {
  const idx = shipIndex(st);
  let have = 0;
  let full = 0;
  for (const id of f.ships) {
    const s = idx.get(id);
    if (s === undefined) continue;
    have += s.hull;
    full += shipStats(s.kind).hull * 1000;
  }
  return full === 0 ? 0 : Math.floor((have * 1000) / full);
}

/** One day of the AI's fleets (WwImjin.daily). */
export function imjinSeaAi(im: WwImjin, _day: number, tick: number): void {
  const ww = im.ww;
  const st = im.st.sea;
  const ctx = im.ctx(tick);
  const jpn = im.idOf("JPN");
  for (const f of [...st.fleets]) {
    if (f.ships.length === 0 || f.battle !== 0 || f.fleeing) continue;
    if (ww.isHumanControlled(f.owner) && !ww.autoOn(f.owner, "navy")) continue;
    const boarder = f.owner === jpn;
    const want = boarder ? "board" : "keep_range";
    if (f.order !== want && f.order !== "move" && f.order !== "escort") {
      seaOrder(st, ctx, f.owner, f.id, { kind: "engage", mode: want });
    }
    const here = tileAt(ctx, f.x, f.y);
    if (here < 0) continue;
    const hull = hullPm(st, f);
    const home = ctx.nearestPort(f.owner, f.x, f.y);
    if (
      hull < MEND_HULL_PM ||
      (f.order === "hold" &&
        hull < SAIL_HULL_PM &&
        home >= 0 &&
        ctx.portLevelAt(f.owner, here) > 0)
    ) {
      if (home >= 0 && home !== here && f.path.length === 0) {
        seaOrder(st, ctx, f.owner, f.id, { kind: "move", tile: home });
      }
      continue;
    }
    if (ww.enemiesOf(f.owner).length === 0) continue;
    // Japan's first fleet guards the busiest supply route.
    if (boarder && f.id === firstFleetOf(st, f.owner)) {
      const route = busiestRoute(im, f.owner);
      if (route >= 0) {
        if (f.order !== "escort" || f.target !== route) {
          seaOrder(st, ctx, f.owner, f.id, { kind: "escort", route });
        }
        continue;
      }
    }
    // The nearest foe it can beat: a fleet, else a convoy group.
    const mine = fleetStrength(st, f);
    const inReach = (x: number, y: number): boolean => {
      if (boarder) return true;
      const p = ctx.nearestPort(f.owner, x, y);
      if (p < 0) return false;
      const dx = ctx.tileX(p) * MT - x;
      const dy = ctx.tileY(p) * MT - y;
      return distMt(dx, dy) <= HOME_WATERS_MT;
    };
    let best: { x: number; y: number } | null = null;
    let bestD = HUNT_MT;
    for (const e of st.fleets) {
      if (e.ships.length === 0 || !ctx.hostile(f.owner, e.owner)) continue;
      const d = distMt(e.x - f.x, e.y - f.y);
      if (d >= bestD) continue;
      if (fleetStrength(st, e) * 100 > mine * ODDS_PCT) continue;
      if (!inReach(e.x, e.y)) continue;
      best = { x: e.x, y: e.y };
      bestD = d;
    }
    if (best === null) {
      for (const g of st.groups) {
        if (!ctx.hostile(f.owner, g.owner)) continue;
        const d = distMt(g.x - f.x, g.y - f.y);
        if (d >= bestD || !inReach(g.x, g.y)) continue;
        best = { x: g.x, y: g.y };
        bestD = d;
      }
    }
    if (best === null) continue;
    const to = tileAt(ctx, best.x, best.y);
    if (to < 0 || !ctx.isWater(to) || to === here) continue;
    seaOrder(st, ctx, f.owner, f.id, { kind: "move", tile: to });
    seaOrder(st, ctx, f.owner, f.id, { kind: "engage", mode: want });
    // (The move order set `order`; engage keeps the path and sets the mode.)
  }
}

function firstFleetOf(st: SeaState, owner: number): number {
  for (const f of st.fleets)
    if (f.owner === owner && f.ships.length > 0) return f.id;
  return -1;
}

function busiestRoute(im: WwImjin, owner: number): number {
  let best = -1;
  let got = 0;
  for (const r of [...im.ww.navy.routes.values()].sort((a, b) => a.id - b.id)) {
    if (r.owner !== owner || r.got <= got) continue;
    if (!im.st.sea.groups.some((g) => g.route === r.id)) continue;
    best = r.id;
    got = r.got;
  }
  return best;
}
