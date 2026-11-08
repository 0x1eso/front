// P6 lane D (plan Task 2): army groups and their field marshals (spec
// §4.3). A group is {id, owner, field marshal, 1–5 armies (6 with
// fm_strategist), auto}; each member army's P2 `group` names it. The
// orders act on every member army through P2's own army orders.
import type { DepthOrder, LandOrder } from "@openfront/engine-api/Schemas";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  type LandOrderSource,
  ROLE_ATTACK,
  ROLE_DEFEND,
  WW_GOAL_MAX,
  WW_ZONE_MAX,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  groupArmyCap,
  sectorEnds,
  splitFront,
  splitGoal,
} from "@openfront/engine-lib/ww1936/CommandRules";
import {
  borderChain,
  borderRegionsOf,
  frontLineBetween,
} from "@openfront/engine-lib/ww1936/FrontRules";
import { goalRegionBlock } from "@openfront/engine-lib/ww1936/LandOrderChecks";
import { levelUp } from "../land/GeneralsRun";
import { armyOrderBlock, orderCheckWorld } from "../land/Orders";
import { freeCount } from "../land/Plans";
import { foughtTest } from "../land/Sustain";
import type { Army, CountryLand, GeneralState } from "../land/WwLand";
import type { WwDepth } from "./WwDepth";

/**
 * Spec §4.3 "원수는 군을 직접 맡지 않는다". `GeneralState.fm` is the one
 * truth: P2's army_general order (GeneralsRun.assignGeneral), its AI
 * (AiLand) and the army panel all refuse or hide a field marshal. His
 * `army` reads FM_ARMY as a busy hint only — P3's advisor list then
 * treats him as leading an army (Advisors.leadsArmy), and a P2 reset to 0
 * is harmless (the depth day sets it back).
 */
export const FM_ARMY = -1;

type Group = WwDepth["groups"][number];

/**
 * The version of lane D's command state (groups, marshals, medals, traits)
 * per game: commandLandMods' per-tick memo is valid only for the version it
 * was built at. Bumped by every change of that state; a derived counter.
 */
const commandVersion = new WeakMap<WwDepth, number>();
export function commandVer(d: WwDepth): number {
  return commandVersion.get(d) ?? 0;
}
export function touchCommand(d: WwDepth): void {
  commandVersion.set(d, commandVer(d) + 1);
}

/**
 * A general of the country by id, O(1). The index is checked against the
 * list on every read (the same id at the same place), so a restore, a new
 * general or a removed one never yields a stale answer.
 */
const generalIndex = new WeakMap<GeneralState[], Map<number, number>>();
export function generalById(cl: CountryLand, id: number): GeneralState | null {
  const list = cl.generals;
  const i = generalIndex.get(list)?.get(id);
  if (i !== undefined && list[i]?.id === id) return list[i];
  const m = new Map<number, number>();
  list.forEach((g, k) => m.set(g.id, k));
  generalIndex.set(list, m);
  const j = m.get(id);
  return j === undefined ? null : list[j];
}

/** The army group an army belongs to, 0 none. */
export function groupOfArmy(d: WwDepth, armyId: number): number {
  return d.ww.land.armies.get(armyId)?.group ?? 0;
}

function groupOf(d: WwDepth, id: number, group: number): Group | null {
  return d.groups.find((g) => g.id === group && g.owner === id) ?? null;
}

/** The group goes; its armies are free again. */
function disband(d: WwDepth, g: Group): void {
  const land = d.ww.land;
  for (const aid of g.armies) {
    const a = land.armies.get(aid);
    if (a !== undefined && a.group === g.id) {
      a.group = 0;
      land.markArmy(aid);
    }
  }
  d.groups = d.groups.filter((x) => x !== g);
  d.markGlobal();
  touchCommand(d);
}

/** Every group of the country led by general `fm` disbands (he is no field marshal any more). */
export function disbandGroupsOf(d: WwDepth, id: number, fm: number): void {
  for (const g of d.groups.filter((x) => x.owner === id && x.fm === fm)) {
    disband(d, g);
  }
}

/**
 * Spec §4.3, the country's depth day: groups drop the armies that are gone
 * (or no longer its own) and disband when empty or when their leader is no
 * field marshal; a group whose divisions fought since the country's last
 * day (P2's foughtTest, pre-flight §A2) gives its field marshal experience
 * as a general's battle day (the same thresholds and level-ups; the
 * attack and defence days pick the skill).
 */
export function dailyArmyGroups(d: WwDepth, id: number, day: number): void {
  const land = d.ww.land;
  const cl = land.country(id);
  // A country that stopped playing (capitulated, not in exile) has no day
  // of its own: its groups go on any playing country's day (review 15).
  for (const g of d.groups.filter((x) => !d.ww.isActor(x.owner))) {
    disband(d, g);
  }
  for (const g of d.groups.filter((x) => x.owner === id)) {
    const keep = g.armies.filter((aid) => {
      const a = land.armies.get(aid);
      return a !== undefined && a.owner === id && a.group === g.id;
    });
    const fm = cl === null ? null : generalById(cl, g.fm);
    if (keep.length === 0 || fm === null || !fm.fm) {
      g.armies = keep;
      disband(d, g);
    } else if (keep.length !== g.armies.length) {
      g.armies = keep;
      d.markGlobal();
      touchCommand(d);
    }
  }
  if (cl === null) return;
  const fought = foughtTest(id, day, d.ww.prepEndTick());
  const t = land.divisions;
  const xpPct = d.ww.economy.country(id)?.stats.generalXpPct ?? 0;
  for (const g of d.groups) {
    if (g.owner !== id) continue;
    let fight = false;
    let att = false;
    let dfn = false;
    for (const aid of g.armies) {
      for (const div of land.armies.get(aid)?.divisions ?? []) {
        const r = t.rowOf(div);
        if (r < 0 || !fought(t.lastFight[r])) continue;
        fight = true;
        if (t.role[r] === ROLE_ATTACK) att = true;
        if (t.role[r] === ROLE_DEFEND) dfn = true;
      }
    }
    if (!fight) continue;
    const fm = generalById(cl, g.fm)!;
    fm.xp += Math.max(1, 100 + xpPct);
    if (att) fm.use[0]++;
    if (dfn) fm.use[1]++;
    levelUp(fm);
    land.markCountry(id);
    touchCommand(d);
  }
  // ww162 §1.1-§1.3: the marshals' lines, recut for the day.
  const source = sourceOf(d, id);
  for (const g of d.groups) {
    if (g.owner === id && hasLines(g)) recutGroup(d, id, g, source, null);
  }
}

/** Who gives the member armies' orders: P2's "player" turns an army's auto off, "ai" does not. */
function sourceOf(d: WwDepth, id: number): LandOrderSource {
  return d.ww.isHumanControlled(id) ? "player" : "ai";
}

/** ag_create … ag_auto (spec §4.3). */
export function issueArmyGroup(
  d: WwDepth,
  id: number,
  o: DepthOrder,
  tick: number,
): WwOrderBlock | null {
  void tick;
  const land = d.ww.land;
  if (o.kind === "ag_create") return createGroup(d, id, o.fm, o.armies);
  if (
    o.kind !== "ag_add" &&
    o.kind !== "ag_remove" &&
    o.kind !== "ag_disband" &&
    o.kind !== "ag_front" &&
    o.kind !== "ag_execute" &&
    o.kind !== "ag_auto"
  ) {
    return "bad_index";
  }
  const g = groupOf(d, id, o.group);
  if (g === null) return "bad_index";
  switch (o.kind) {
    case "ag_add": {
      const a = land.armies.get(o.army);
      if (a === undefined || a.owner !== id) return "no_army";
      if (a.group !== 0) return "army_busy";
      const fm = generalById(land.country(id)!, g.fm);
      if (g.armies.length >= groupArmyCap(fm?.fmTraits ?? 0)) {
        return "group_full";
      }
      g.armies = [...g.armies, a.id].sort((x, y) => x - y);
      a.group = g.id;
      if (g.auto) {
        a.auto = true;
        if (a.autoLevel === 0) a.autoLevel = 2;
      }
      land.markArmy(a.id);
      d.markGlobal();
      touchCommand(d);
      return null;
    }
    case "ag_remove": {
      const a = land.armies.get(o.army);
      if (a === undefined || a.owner !== id || !g.armies.includes(a.id)) {
        return "no_army";
      }
      g.armies = g.armies.filter((x) => x !== a.id);
      a.group = 0;
      land.markArmy(a.id);
      touchCommand(d);
      if (g.armies.length === 0) disband(d, g);
      else d.markGlobal();
      return null;
    }
    case "ag_disband":
      disband(d, g);
      return null;
    case "ag_front":
      return groupFront(d, id, g, o.frontRegions, o.enemy);
    case "ag_execute": {
      let taken = false;
      let block: WwOrderBlock | null = "no_army";
      for (const aid of g.armies) {
        const a = land.armies.get(aid);
        if (a === undefined) continue;
        if (o.targets !== undefined) {
          // ww42: the same direct attack for every army of the group.
          const r = land.issue(
            id,
            { kind: "army_direct", army: aid, targets: o.targets },
            sourceOf(d, id),
          );
          if (r === null) taken = true;
          else if (block === "no_army") block = r;
          continue;
        }
        if (a.order.kind !== "front" && a.order.kind !== "plan") continue;
        const r = land.issue(
          id,
          { kind: "army_execute", army: aid, on: true },
          sourceOf(d, id),
        );
        if (r === null) taken = true;
        else if (block === "no_army") block = r;
      }
      return taken ? null : block;
    }
    case "ag_auto": {
      g.auto = o.on;
      // ww162: the AI takes the group: the marshal's lines go.
      if (o.on) clearGroupLines(d, id, g.id);
      for (const aid of g.armies) {
        if (land.armies.has(aid)) {
          land.issue(
            id,
            { kind: "army_auto", army: aid, on: o.on },
            sourceOf(d, id),
          );
        }
      }
      d.markGlobal();
      return null;
    }
  }
  return "bad_index";
}

/**
 * ag_create (spec §4.3): the country's own field marshal leading no other
 * group, 1–5 of its armies (6 with fm_strategist) in no group; a new
 * group number (WwDepth.uid), the armies in number order.
 */
export function createGroup(
  d: WwDepth,
  id: number,
  fm: number,
  armies: readonly number[],
): WwOrderBlock | null {
  const land = d.ww.land;
  const cl = land.country(id);
  const g = cl === null ? null : generalById(cl, fm);
  if (g === null || !g.fm) return "general_unavailable";
  if (d.groups.some((x) => x.owner === id && x.fm === fm)) {
    return "general_unavailable";
  }
  const ids = [...new Set(armies)].sort((a, b) => a - b);
  if (ids.length === 0 || ids.length !== armies.length) return "bad_index";
  if (ids.length > groupArmyCap(g.fmTraits)) return "group_full";
  for (const aid of ids) {
    const a = land.armies.get(aid);
    if (a === undefined || a.owner !== id) return "no_army";
    if (a.group !== 0) return "army_busy";
  }
  const gid = d.uid();
  d.groups.push({ id: gid, owner: id, fm, armies: ids, auto: false });
  for (const aid of ids) {
    land.armies.get(aid)!.group = gid;
    land.markArmy(aid);
  }
  d.markGlobal();
  touchCommand(d);
  return null;
}

/**
 * ag_front (spec §4.3, deterministic; ww7): the front regions on our side's
 * border against `enemy` (0: every enemy), in geographic order along the
 * border (FrontRules.borderChain), cut by CommandRules.splitFront into one
 * stretch per army in proportion to its divisions; each army with a stretch
 * gets Defend (P2's front order anchored on the stretch's first region)
 * with that stretch as its explicit zone. An army whose stretch is empty
 * keeps its order. Taken when one army took it.
 */
function groupFront(
  d: WwDepth,
  id: number,
  g: Group,
  front: readonly number[],
  enemy: number,
): WwOrderBlock | null {
  const land = d.ww.land;
  const armies = g.armies.filter((aid) => land.armies.has(aid));
  if (armies.length === 0) return "no_army";
  const border = new Set(borderRegionsOf(land, id, enemy));
  const chain = borderChain(
    land,
    id,
    enemy,
    front.filter((r) => border.has(r)),
  );
  const parts = splitFront(
    chain,
    armies.map((aid) => land.armies.get(aid)!.divisions.length),
  );
  let taken = false;
  let block: WwOrderBlock | null = "not_adjacent";
  armies.forEach((aid, i) => {
    const part = parts[i];
    if (part.length === 0) return;
    const source = sourceOf(d, id);
    // The front order's block when it is refused, else the zone order's.
    const r =
      land.issue(
        id,
        { kind: "army_front", army: aid, anchor: part[0], enemy },
        source,
      ) ??
      land.issue(id, { kind: "army_zone", army: aid, regions: part }, source);
    if (r === null) taken = true;
    else if (block === "not_adjacent") block = r;
  });
  return taken ? null : block;
}

// ---- ww162 §1.1-§1.3 (lane L2): a marshal's lines ----

type GroupLineOrder = Extract<
  LandOrder,
  { kind: "group_front_line" | "group_goal" | "group_fallback" }
>;

/** The group carries a front, offensive or fallback line. */
function hasLines(g: Group): boolean {
  return (
    g.ends !== undefined ||
    (g.goal !== undefined && g.goal.length > 0) ||
    (g.fallback !== undefined && g.fallback.length > 0)
  );
}

/** The group's armies still its own, in its army order. */
function liveArmies(d: WwDepth, g: Group): Army[] {
  const out: Army[] = [];
  for (const aid of g.armies) {
    const a = d.ww.land.armies.get(aid);
    if (a !== undefined && a.owner === g.owner && a.group === g.id) out.push(a);
  }
  return out;
}

function sameList(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

function clearGoal(g: Group): void {
  delete g.goal;
  delete g.spear;
  delete g.split;
}

/**
 * ww162: the group's lines go (an army of it fell back, or the AI took the
 * group). Its armies keep the orders they have.
 */
export function clearGroupLines(
  d: WwDepth,
  owner: number,
  group: number,
): void {
  const g = groupOf(d, owner, group);
  if (g === null || !hasLines(g)) return;
  delete g.ends;
  delete g.enemy;
  clearGoal(g);
  delete g.fallback;
  d.markGlobal();
}

/**
 * ww162 §1.1-§1.3: group_front_line, group_goal and group_fallback (land
 * orders; WwLand.issue routes them here). The group stores the line, then
 * cuts it among its armies at once (recutGroup) and again every day.
 * - Front line: the ends must make a line (army_front_line's check); it
 *   clears the group's offensive line, as an army's front line does.
 * - Offensive line: empty clears it; else army_goal's check (enemy regions
 *   in reach), at most WW_GOAL_MAX, repeats dropped; `spear` and `split`
 *   are kept only when on.
 * - Fallback line: our side's regions, at most WW_ZONE_MAX; empty clears it.
 * A player's line turns the group's auto off. Taken once the group took it
 * (the armies' own refusals don't refuse it: the day's recut tries again).
 */
export function issueGroupLine(
  d: WwDepth,
  id: number,
  o: GroupLineOrder,
  by: LandOrderSource,
): WwOrderBlock | null {
  const land = d.ww.land;
  const g = groupOf(d, id, o.group);
  if (g === null) return "bad_index";
  const armies = liveArmies(d, g);
  const cl = land.country(id);
  if (armies.length === 0 || cl === null) return "no_army";
  switch (o.kind) {
    case "group_front_line": {
      const block = armyOrderBlock(land, cl, {
        kind: "army_front_line",
        army: armies[0].id,
        ends: o.ends,
        enemy: o.enemy,
      });
      if (block !== null) return block;
      g.ends = [o.ends[0], o.ends[1]];
      g.enemy = o.enemy;
      clearGoal(g);
      break;
    }
    case "group_goal": {
      const goal = [...new Set(o.regions)].slice(0, WW_GOAL_MAX);
      if (goal.length === 0) {
        clearGoal(g);
        break;
      }
      const block = armyOrderBlock(land, cl, {
        kind: "army_goal",
        army: armies[0].id,
        regions: goal,
        spear: o.spear,
        stance: armies[0].order.stance,
      });
      if (block !== null) return block;
      g.goal = goal;
      if (o.spear) g.spear = true;
      else delete g.spear;
      if (o.split) g.split = true;
      else delete g.split;
      break;
    }
    case "group_fallback": {
      const line = [...new Set(o.regions)].slice(0, WW_ZONE_MAX);
      for (const r of line) {
        if (
          land.scenario.region(r) === undefined ||
          !land.sameSide(id, land.controller[r])
        ) {
          return "bad_region";
        }
      }
      if (line.length === 0) delete g.fallback;
      else g.fallback = line;
      break;
    }
  }
  if (by === "player") g.auto = false;
  d.markGlobal();
  recutGroup(d, id, g, by, o.kind);
  return null;
}

/**
 * ww162 §1.1-§1.3: the group's lines cut among its armies (on the order,
 * `issued` its kind, and every day with null).
 * - Front line: the ends re-snap to the border (frontLineBetween; none
 *   left: the group's front line goes); the chain is cut by the armies'
 *   free divisions (CommandRules.splitFront) into sectors, one run each.
 *   An army whose sector's first and last region differ from its ends
 *   gets them: in place when it holds a line against the same enemy (its
 *   offensive line, plan and readiness stay), else by army_front_line. On
 *   the order every army with a sector gets army_front_line.
 * - Offensive line: the day drops the regions our side took or that went
 *   out of reach (none left: the group's line goes, the armies finish their
 *   own). Split, each region goes to the army whose sector is nearest
 *   (CommandRules.splitGoal; without a group front, each army's own front);
 *   else every army takes the whole line. An army whose share differs from
 *   its line (regions taken left out) gets army_goal with its own stance.
 * - Fallback line: cut like the front (splitFront by free divisions); a
 *   changed share is written in place by day (the fallback rule's days go
 *   on), by army_fallback on the order.
 * By day only armies holding a front or plan order follow; one sent
 * elsewhere (move, halt, garrison, invasion) is left be.
 */
function recutGroup(
  d: WwDepth,
  id: number,
  g: Group,
  by: LandOrderSource,
  issued: GroupLineOrder["kind"] | null,
): void {
  const land = d.ww.land;
  const armies = liveArmies(d, g);
  if (armies.length === 0) return;
  const holds = (a: Army) =>
    a.order.kind === "front" || a.order.kind === "plan";
  let sectors: number[][] | null = null;
  if (g.ends !== undefined) {
    const enemy = g.enemy ?? 0;
    const line = frontLineBetween(land, id, enemy, g.ends[0], g.ends[1]);
    if (line === null) {
      delete g.ends;
      delete g.enemy;
      d.markGlobal();
    } else {
      if (!sameList(line.ends, g.ends)) {
        g.ends = line.ends;
        d.markGlobal();
      }
      sectors = splitFront(line.chain, armies.map(freeCount));
      const force = issued === "group_front_line";
      armies.forEach((a, i) => {
        const want = sectorEnds(sectors![i]);
        if (want === null || (!force && !holds(a))) return;
        const o = a.order;
        const lined = holds(a) && o.ends !== undefined && o.enemy === enemy;
        if (!force && lined && sameList(o.ends!, want)) return;
        if (!force && lined) {
          o.ends = want;
          o.anchor = want[0];
          a.pending = true;
          land.markArmy(a.id);
          return;
        }
        land.issue(
          id,
          { kind: "army_front_line", army: a.id, ends: want, enemy },
          by,
        );
      });
    }
  }
  if (g.goal !== undefined && g.goal.length > 0 && issued === null) {
    const w = orderCheckWorld(land, id);
    const left = g.goal.filter(
      (r) =>
        !land.sameSide(id, land.controller[r]) &&
        goalRegionBlock(w, r) === null,
    );
    if (left.length !== g.goal.length) {
      if (left.length === 0) clearGoal(g);
      else g.goal = left;
      d.markGlobal();
    }
  }
  const goal = g.goal ?? [];
  if (goal.length > 0 || issued === "group_goal") {
    const shares =
      goal.length === 0
        ? armies.map((): number[] => [])
        : g.split === true
          ? splitGoal(
              land,
              goal,
              armies.map((a, i) => sectors?.[i] ?? a.front),
            )
          : armies.map(() => goal);
    const force = issued === "group_goal";
    const spear = g.spear === true;
    armies.forEach((a, i) => {
      if (!force && !holds(a)) return;
      const o = a.order;
      const want = shares[i];
      const have = (o.goal ?? []).filter(
        (r) => !land.sameSide(id, land.controller[r]),
      );
      if (want.length === 0 && (o.goal === undefined || o.goal.length === 0)) {
        return;
      }
      if (
        !force &&
        sameList(have, want) &&
        (want.length === 0 || (o.spear === true) === spear)
      ) {
        return;
      }
      land.issue(
        id,
        {
          kind: "army_goal",
          army: a.id,
          regions: want,
          spear,
          stance: o.stance,
        },
        by,
      );
    });
  }
  const fallback = g.fallback ?? [];
  if (fallback.length > 0 || issued === "group_fallback") {
    const parts =
      fallback.length === 0
        ? armies.map((): number[] => [])
        : splitFront(fallback, armies.map(freeCount));
    armies.forEach((a, i) => {
      if (!holds(a)) return;
      const o = a.order;
      const want = parts[i];
      if (sameList(o.fallback ?? [], want)) return;
      if (issued === "group_fallback") {
        land.issue(
          id,
          {
            kind: "army_fallback",
            army: a.id,
            regions: want,
            manual: o.fbManual === true,
          },
          by,
        );
      } else {
        if (want.length === 0) delete o.fallback;
        else o.fallback = [...want];
        land.markArmy(a.id);
      }
    });
  }
}
