// World War 1936 P3: peaceful annexation, partial transfers and peace
// (spec §17.2–§17.4; plan decisions 17, 18). Control moves through the land
// war's bridge (the victory-point tile this tick, the rest by the spread).
import { MessageType, PlayerType } from "@openfront/engine-api/game/GameTypes";
import { RESOURCE_IDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import {
  endBattlesBetween,
  evictArmies,
  evictDivisions,
  transferCountryUnits,
  transferRegionPeaceful,
} from "../land/PoliticsBridge";
import { type EffectCtx, resolveSelector } from "./Dispatch";
import { leaveFaction } from "./Factions";
import { endTreatiesOf } from "./Treaties";
import { forgetCountry } from "./WarGoals";
import type { WwPolitics } from "./WwPolitics";

/** The territory group of effects (spec §10.4): annex, transfer_regions. */
export function applyTerritoryEffect(
  ctx: EffectCtx,
  e: Effect,
  actor: number,
): void {
  switch (e.kind) {
    case "annex":
      annexCountry(
        ctx.pol,
        actor,
        resolveSelector(ctx, e.target),
        e.units,
        e.core,
        ctx.tick,
      );
      return;
    case "transfer_regions":
      transferGroup(
        ctx.pol,
        actor,
        resolveSelector(ctx, e.to),
        e.group,
        e.core,
        ctx.tick,
      );
      return;
    default:
      return;
  }
}

/**
 * Spec §17.2: `by` takes all of `target` (alive and at war with nobody, or
 * nothing happens). Its legal regions become `by`'s (core when `core`),
 * the regions it controls change hands peacefully, its forces move or
 * disband, its stock and manpower (up to `by`'s ceiling) join `by`'s, its
 * queues, lines, research and trades end, and so do its faction place and
 * treaties; nobody aims at it any more. It dies with its last tile.
 */
export function annexCountry(
  pol: WwPolitics,
  by: number,
  target: number,
  units: "transfer" | "disband" | undefined,
  core: boolean | undefined,
  tick: number,
): void {
  if (target === by || target <= 0 || by <= 0) return;
  if (!pol.living(target) || !pol.living(by) || pol.ww.hasWar(target)) return;
  const land = pol.land;
  const sc = pol.ww.scenario;
  // A human loses the country: say so while it is still theirs.
  pol.message(target, "ww1936_annexed", { countryTag: pol.tagOf(target) });
  const taken: number[] = [];
  for (const r of sc.landRegions) {
    if (pol.legalOwner[r.id] === target) {
      pol.setLegalOwner(r.id, by, core === true);
    }
    if (land.controller[r.id] === target) taken.push(r.id);
  }
  transferCountryUnits(land, target, by, units ?? "transfer");
  for (const r of taken) transferRegionPeaceful(land, r, by, tick);
  sweepStrayTiles(pol, target, by, new Set(taken));
  mergeEconomy(pol, target, by);
  if (pol.factionIdx(target) >= 0) leaveFaction(pol, target, tick);
  endTreatiesOf(pol, target);
  forgetCountry(pol, target);
  const c = pol.country(target);
  if (c !== null) {
    c.pending = [];
    c.focus = null;
    c.queued = null;
    c.missions = [];
  }
  pol.recomputeStats(by);
  pol.markCountry(by);
  pol.markCountry(target);
  pol.markGlobal();
}

/**
 * Tiles `gone` holds outside the regions it controlled go to their
 * region's controller (or `by`), so it dies with the transfer (P0 rule).
 */
function sweepStrayTiles(
  pol: WwPolitics,
  gone: number,
  by: number,
  handled: ReadonlySet<number>,
): void {
  const mg = pol.mg;
  const p = mg.playerBySmallID(gone);
  if (!p.isPlayer()) return;
  const sc = pol.ww.scenario;
  const land = pol.land;
  const stray: number[] = [];
  for (const t of p.tiles()) {
    if (!handled.has(sc.regionAt(t))) stray.push(t);
  }
  stray.sort((a, b) => a - b);
  for (const t of stray) {
    const c = land.controller[sc.regionAt(t)] ?? 0;
    const to = mg.playerBySmallID(c !== 0 && c !== gone ? c : by);
    if (!to.isPlayer()) continue;
    to.conquer(t);
    if (!p.isAlive()) {
      mg.conquerPlayer(to, p);
      return;
    }
  }
}

/** Spec §17.2-3: the P1 side of an annexation. */
function mergeEconomy(pol: WwPolitics, gone: number, by: number): void {
  const econ = pol.econ;
  const from = econ.country(gone);
  const to = econ.country(by);
  if (from === null || to === null) return;
  for (let i = 0; i < from.stock.length; i++) {
    to.stock[i] += from.stock[i];
    from.stock[i] = 0;
  }
  // Manpower up to what the two countries' regions can give, less the army.
  const ceiling = Math.max(
    0,
    to.totals.recruitable + from.totals.recruitable - pol.land.armyMen(by),
  );
  to.manpower = Math.min(
    to.manpower + from.manpower,
    Math.max(to.manpower, ceiling),
  );
  from.manpower = 0;
  from.queue = [];
  from.lines = [];
  from.slots = from.slots.map(() => null);
  for (const tr of [...econ.trades()]) {
    if (tr.buyer !== gone && tr.seller !== gone) continue;
    econ.removeTrade(tr.id);
    // P1's rule (Trade.closeBroken): the buyer is told, naming the seller.
    if (tr.buyer === gone) continue;
    const p = pol.mg.playerBySmallID(tr.buyer);
    if (!p.isPlayer() || p.type() !== PlayerType.Human) continue;
    pol.mg.displayMessage(
      "events_display.ww1936_trade_closed",
      MessageType.WORLD_WAR,
      p.id(),
      undefined,
      { sellerTag: pol.tagOf(tr.seller), resource: RESOURCE_IDS[tr.res] },
    );
  }
  econ.markCountryDirty(gone);
  econ.markCountryDirty(by);
}

/**
 * Spec §17.3: the group's regions whose legal owner is `from` go to `to`
 * (core when `core`); where `from` controls them they change hands
 * peacefully, its divisions there go to its nearest own region (or
 * disband), and its building projects there end (P1's rule for a lost
 * region).
 */
export function transferGroup(
  pol: WwPolitics,
  from: number,
  to: number,
  group: string,
  core: boolean | undefined,
  tick: number,
): void {
  const g = pol.content.groupIdx.get(group);
  if (g === undefined || to <= 0 || to === from || !pol.living(to)) return;
  const land = pol.land;
  const regions = [...g.regions]
    .filter((r) => pol.legalOwner[r] === from)
    .sort((a, b) => a - b);
  const moved: number[] = [];
  for (const r of regions) {
    pol.setLegalOwner(r, to, core === true);
    if (land.controller[r] !== from) continue;
    transferRegionPeaceful(land, r, to, tick);
    moved.push(r);
  }
  for (const r of moved) evictDivisions(land, r, from);
  const ce = pol.econ.country(from);
  if (ce !== null && moved.length > 0) {
    const kept = ce.queue.filter((q) => !moved.includes(q.region));
    if (kept.length !== ce.queue.length) {
      ce.queue = kept;
      pol.econ.markCountryDirty(from);
    }
  }
  pol.markCountry(from);
  pol.markCountry(to);
}

/**
 * Spec §17.4 (`end_war`): the war between `a` and `b` alone ends. Regions
 * one holds that are the other's by law go back to the legal owner; armies
 * left on the other's land go home; the battles between them end;
 * controller ruling R12: they leave each other's declaredOn.
 */
export function endWarBetween(
  pol: WwPolitics,
  a: number,
  b: number,
  tick: number,
): void {
  if (a === b || !pol.ww.endWar(a, b)) return;
  const land = pol.land;
  for (const r of pol.ww.scenario.landRegions) {
    const c = land.controller[r.id];
    const owner = pol.legalOwner[r.id];
    if ((c === a && owner === b) || (c === b && owner === a)) {
      transferRegionPeaceful(land, r.id, owner, tick);
    }
  }
  endBattlesBetween(land, a, b);
  evictArmies(land, a, b);
  evictArmies(land, b, a);
  for (const [x, y] of [
    [a, b],
    [b, a],
  ]) {
    const c = pol.country(x);
    if (c === null || !c.declaredOn.includes(y)) continue;
    c.declaredOn = c.declaredOn.filter((v) => v !== y);
  }
  pol.recomputeStats(a);
  pol.recomputeStats(b);
  pol.markCountry(a);
  pol.markCountry(b);
  pol.markGlobal();
}
