// World War 1936 P5 (plan decision 26): the endgame effects. The
// foundation writes the dispatch (each kind to the lane that owns its
// state); P5 lane E fills applyOtherEndgameEffect (plan Task 8, spec
// §16.4): zones, annexing occupied land, separate peace, changing sides,
// exile legitimacy, reparations, surrender, uprisings, resistance,
// compliance and navy experience. The actor is the effect's country.
import { MessageType } from "@openfront/engine-api/game/GameTypes";
import {
  CS_ACTIVE,
  MemberState,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { WW_NAVY_XP_MAX_MILLI } from "@openfront/engine-api/ww1936/NavyTypes";
import type {
  Effect,
  Selector,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import { complianceCap } from "@openfront/engine-lib/ww1936/EndgameRules";
import { capitulate } from "../Capitulation";
import { declareWarBlock } from "../Diplomacy";
import { setEmbargo } from "../depth/Embargo";
import { applyActivationEffect } from "../endgame/Activate";
import { applyAidEffect } from "../endgame/LendLease";
import { uprisingNow } from "../endgame/Occupation";
import { applySubjectEffect } from "../endgame/Subjects";
import type { WwEndgame } from "../endgame/WwEndgame";
import { evictDivisions, transferRegionPeaceful } from "../land/PoliticsBridge";
import { type EffectCtx, resolveSelector } from "./Dispatch";
import { joinFaction, leaveFaction } from "./Factions";
import { endWarBetween } from "./Territory";

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
      applyAidEffect(ctx, e, actor); // A
      return;
    // P6 hook (pre-flight §A9): the mode's one embargo list (lane M's depth state).
    case "embargo":
    case "end_embargo": {
      const on = resolveSelector(ctx, e.on);
      if (on !== 0 && on !== actor) {
        setEmbargo(ctx.pol.ww.depth, actor, on, e.kind === "embargo");
      }
      return;
    }
    default:
      applyOtherEndgameEffect(ctx, e, actor); // E
  }
}

/**
 * Plan Task 8 (spec §16.4): occupation_zone, annex_occupied,
 * separate_peace, switch_sides, exile_legitimacy, reparations, surrender,
 * uprising, resistance, compliance, navy_xp. A missing or dead other
 * country skips the effect (P3 spec §10.5-2).
 */
export function applyOtherEndgameEffect(
  ctx: EffectCtx,
  e: Effect,
  actor: number,
): void {
  const pol = ctx.pol;
  const eg = pol.ww.endgame;
  switch (e.kind) {
    case "occupation_zone": {
      // The zone keeps the holder's control for `days` (to the game's end
      // without); a region it does not control is left out.
      const holder = e.holder === undefined ? actor : other(ctx, e.holder);
      if (holder === 0) return;
      const regions = groupRegions(ctx, e.group);
      if (e.seize === true) seizeZone(ctx, actor, holder, regions);
      const until = e.days === undefined ? -1 : ctx.day + e.days;
      for (const r of regions) {
        if (pol.land.controller[r] === holder) setZone(eg, r, holder, until);
      }
      return;
    }
    case "annex_occupied": {
      // Spec §6.8: the legal owner changes (not the cores), only while it
      // has capitulated or is in exile.
      const to = e.to === undefined ? actor : other(ctx, e.to);
      if (to === 0) return;
      for (const r of groupRegions(ctx, e.group)) {
        const c = pol.land.controller[r];
        const owner = pol.legalOwner[r] ?? 0;
        if ((c !== actor && c !== to) || owner === 0 || owner === to) continue;
        if (!pol.ww.isCapitulated(owner) && !eg.isExile(owner)) continue;
        pol.setLegalOwner(r, to);
        pol.markCountry(owner);
        pol.markCountry(to);
      }
      return;
    }
    case "separate_peace":
      if (e.with === "all") separatePeaceAll(ctx, actor);
      else {
        const o = resolveSelector(ctx, e.with);
        if (o > 0 && o !== actor) endWarBetween(pol, actor, o, ctx.tick);
      }
      return;
    case "switch_sides": {
      const to = other(ctx, e.to);
      if (to !== 0 && to !== actor) switchSides(ctx, actor, to);
      return;
    }
    case "exile_legitimacy": {
      // Spec §10.3: ±%p of a government in exile (the actor, or every
      // exile of the actor's faction).
      const fid = pol.factionIdx(actor);
      const ids =
        e.scope === "faction_exiles"
          ? eg.exiles
              .map((x) => x.smallID)
              .filter((x) => fid >= 0 && pol.factionIdx(x) === fid)
          : [actor];
      for (const id of ids) {
        const i = eg.exileIdx.get(id);
        if (i === undefined) continue;
        const x = eg.exiles[i];
        x.legitBp = clamp(x.legitBp + e.pct * 100, 0, 10_000);
        eg.dirtyExiles = true;
      }
      return;
    }
    case "reparations": {
      const to = other(ctx, e.to);
      if (to === 0 || to === actor) return;
      eg.reparations.push({
        from: actor,
        to,
        k: e.k,
        untilDay: ctx.day + e.days,
      });
      return;
    }
    case "surrender":
      surrender(ctx, actor, e.to === undefined ? 0 : other(ctx, e.to));
      return;
    case "uprising":
      for (const r of groupRegions(ctx, e.group)) {
        if (eg.isAdministered(r)) uprisingNow(eg, r, ctx.tick); // O
      }
      return;
    case "resistance":
    case "compliance":
      for (const r of groupRegions(ctx, e.group)) {
        if (!eg.isAdministered(r)) continue;
        const d = e.pct * 100;
        if (e.kind === "resistance") {
          eg.resBp[r] = clamp(eg.resBp[r] + d, 0, 10_000);
        } else {
          // Spec §8.4: compliance stops at its cap (8,000 while a core
          // holder plays on); a rise never lowers it.
          const cur = eg.compBp[r];
          const cap = complianceCap(coreHolderPlays(eg, r));
          eg.compBp[r] =
            d > 0
              ? Math.max(cur, Math.min(cap, cur + d))
              : Math.max(0, cur + d);
        }
        eg.dirtyOcc.add(r);
      }
      return;
    case "navy_xp": {
      const navy = pol.ww.navy;
      const cn = navy.country(actor);
      if (cn === null) return;
      cn.navyXpMilli = clamp(
        cn.navyXpMilli + e.amount * 1000,
        0,
        WW_NAVY_XP_MAX_MILLI,
      );
      navy.markCountry(actor);
      return;
    }
    default:
      return;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** The other country of the effect; 0 when missing or not playing. */
function other(ctx: EffectCtx, s: Selector): number {
  const id = resolveSelector(ctx, s);
  return id > 0 && ctx.pol.living(id) ? id : 0;
}

/** The group's regions, ascending (none for an unknown group). */
function groupRegions(ctx: EffectCtx, group: string): number[] {
  const g = ctx.pol.content.groupIdx.get(group);
  return g === undefined ? [] : [...g.regions].sort((a, b) => a - b);
}

/** Spec §8.4: a core holder of the region still plays (active or in exile). */
function coreHolderPlays(eg: WwEndgame, region: number): boolean {
  return eg
    .coreHolders(region)
    .some((h) => eg.countryStateArr[h] === CS_ACTIVE || eg.isExile(h));
}

/** The region's zone row (an existing one is updated). */
function setZone(
  eg: WwEndgame,
  region: number,
  holder: number,
  untilDay: number,
): void {
  const z = eg.zones.find((x) => x.region === region);
  if (z !== undefined) {
    if (z.holder === holder && z.untilDay === untilDay) return;
    z.holder = holder;
    z.untilDay = untilDay;
  } else {
    eg.zones.push({ region, holder, untilDay });
    eg.zones.sort((a, b) => a.region - b.region);
  }
  eg.dirtyZones = true;
}

/**
 * occupation_zone `seize` (plan decision 26, spec #33): the holder takes
 * control of the group's regions now, each change peaceful (P3
 * transferRegionPeaceful), the old controller's divisions sent home (P3
 * evictDivisions). An actor handing its land to another holder (the
 * Iranian zones, Porkkala, central Slovakia) gives every group region it
 * controls. A holder taking a zone itself (Germany in northern Italy,
 * Case Anton, Italy's Alpine zone) takes it outward from its own border,
 * breadth-first through the group, from the region's legal owner or from
 * a country not at war with it: a region an enemy of the holder took from
 * someone else stops the spread there.
 */
function seizeZone(
  ctx: EffectCtx,
  actor: number,
  holder: number,
  regions: readonly number[],
): void {
  const pol = ctx.pol;
  const land = pol.land;
  const sc = pol.ww.scenario;
  const take = (r: number): void => {
    const from = land.controller[r];
    transferRegionPeaceful(land, r, holder, ctx.tick);
    if (from !== 0 && from !== holder) evictDivisions(land, r, from);
  };
  if (actor !== holder) {
    for (const r of regions) if (land.controller[r] === actor) take(r);
    return;
  }
  const inGroup = new Set(regions);
  const open = (r: number): boolean => {
    const c = land.controller[r];
    if (c === 0 || c === holder) return false;
    return c === pol.legalOwner[r] || !pol.ww.isAtWar(c, holder);
  };
  const touchesHolder = (r: number): boolean =>
    sc.edgesOf(r).some((x) => land.controller[x.to] === holder);
  const queue = regions.filter((r) => open(r) && touchesHolder(r));
  const seen = new Set(queue);
  for (let i = 0; i < queue.length; i++) {
    const r = queue[i];
    if (!open(r)) continue;
    take(r);
    for (const x of sc.edgesOf(r)) {
      if (!inGroup.has(x.to) || seen.has(x.to) || !open(x.to)) continue;
      seen.add(x.to);
      queue.push(x.to);
    }
  }
}

const fights = (s: MemberState): boolean => s === "active" || s === "exiled";

/**
 * separate_peace all (pre-flight §A W × E): the actor is marked `left` in
 * each war first, then every pair ends by P3 end_war (occupied land goes
 * back to its legal owner, the armies go home).
 */
function separatePeaceAll(ctx: EffectCtx, actor: number): void {
  const pol = ctx.pol;
  const eg = pol.ww.endgame;
  for (const enemy of [...pol.ww.enemiesOf(actor)].sort((a, b) => a - b)) {
    const w = eg.warOfPair(actor, enemy);
    if (w !== 0) eg.setMemberState(w, actor, "left");
    endWarBetween(pol, actor, enemy, ctx.tick);
  }
}

/**
 * switch_sides (spec §16.4): a separate peace with everyone, out of its
 * faction, into `to`'s (no ideology rule), then at war with each old
 * friend that fights `to`, in `to`'s war record — with no goal and no
 * penalty (a join: P0 joinWar's rules). In each war it fought against
 * `to` it changes sides in the record first (its war score starts again),
 * so the faction's wars take it in on `to`'s side, not as a new war.
 */
function switchSides(ctx: EffectCtx, actor: number, to: number): void {
  const pol = ctx.pol;
  const ww = pol.ww;
  const eg = ww.endgame;
  // Old friends: its faction and the members of its side in its wars.
  const friends = new Set<number>();
  const f = pol.faction(pol.factionIdx(actor));
  for (const m of f?.members ?? []) if (m !== actor) friends.add(m);
  for (const w of eg.wars) {
    const s = eg.sideIndex(w, actor);
    if (w.ended !== null || s === -1 || !fights(eg.member(w, actor)!.state)) {
      continue;
    }
    for (const m of w.sides[s].members) {
      if (m.id !== actor && fights(m.state)) friends.add(m.id);
    }
  }
  separatePeaceAll(ctx, actor);
  for (const w of eg.wars) {
    const s = eg.sideIndex(w, actor);
    if (w.ended !== null || s === -1) continue;
    const o = s === 0 ? 1 : 0;
    if (eg.sideIndex(w, to) !== o || !fights(eg.member(w, to)!.state)) {
      continue;
    }
    const side = w.sides[s];
    if (side.members.every((m) => m.id === actor)) continue;
    const [m] = side.members.splice(
      side.members.findIndex((x) => x.id === actor),
      1,
    );
    w.sides[o].members.push({
      ...m,
      state: "left",
      joinedDay: ctx.day,
      wsMilli: 0,
    });
    eg.fixLeader(w);
    eg.dirtyWars = true;
  }
  if (pol.factionIdx(actor) >= 0) leaveFaction(pol, actor, ctx.tick);
  const idx = pol.factionIdx(to);
  if (idx >= 0) joinFaction(pol, actor, idx, ctx.tick);
  const me = pol.player(actor);
  for (const friend of [...friends].sort((a, b) => a - b)) {
    if (!ww.isAtWar(friend, to) || ww.isAtWar(friend, actor)) continue;
    const fp = pol.player(friend);
    if (me === null || fp === null) continue;
    if (declareWarBlock(pol.mg, ww, me, fp, ctx.tick, true) !== null) continue;
    ww.setWar(actor, friend, ctx.tick, {
      kind: "into",
      warId: eg.warOfPair(to, friend),
    });
    pol.mg.displayMessage(
      "events_display.ww1936_war_joined",
      MessageType.WORLD_WAR,
      null,
      undefined,
      { actorTag: ww.tagOf(actor), enemyTag: ww.tagOf(friend) },
    );
    pol.onWarJoined(actor, friend, ctx.tick);
  }
  pol.recomputeStats(actor);
  pol.markCountry(actor);
  pol.markGlobal();
}

/**
 * surrender (spec §16.4, §5.1): P0's capitulation this tick, whatever the
 * gauge says, to `to` when given (else P0's pickVictor). Only a country at
 * war that has not capitulated and is not in exile.
 */
function surrender(ctx: EffectCtx, actor: number, to: number): void {
  const pol = ctx.pol;
  const ww = pol.ww;
  if (ww.isCapitulated(actor) || ww.endgame.isExile(actor)) return;
  if (!ww.hasWar(actor)) return;
  const p = pol.player(actor);
  if (p === null) return;
  const receiver = to !== 0 && to !== actor ? pol.player(to) : null;
  capitulate(pol.mg, ww, p, ctx.tick, receiver ?? undefined);
}
