// P6 lane D (plan Task 2): army groups and their field marshals (spec
// §4.3). A group is {id, owner, field marshal, 1–5 armies (6 with
// fm_strategist), auto}; each member army's P2 `group` names it. The
// orders act on every member army through P2's own army orders.
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  type LandOrderSource,
  ROLE_ATTACK,
  ROLE_DEFEND,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  groupArmyCap,
  splitFront,
} from "@openfront/engine-lib/ww1936/CommandRules";
import {
  GENERAL_LEVEL_MAX,
  GENERAL_SKILL_MAX,
  GENERAL_XP_CENTI,
} from "../land/GeneralsRun";
import { foughtTest } from "../land/Sustain";
import type { CountryLand, GeneralState } from "../land/WwLand";
import type { WwDepth } from "./WwDepth";

/**
 * Spec §4.3 "원수는 군을 직접 맡지 않는다": a field marshal's
 * GeneralState.army (P2 reads 0 as "free"), so P2's AI and screens never
 * hand him an army.
 */
export const FM_ARMY = -1;

type Group = WwDepth["groups"][number];

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
}

/** Every group of the country led by general `fm` disbands (he is no field marshal any more). */
export function disbandGroupsOf(d: WwDepth, id: number, fm: number): void {
  for (const g of d.groups.filter((x) => x.owner === id && x.fm === fm)) {
    disband(d, g);
  }
}

/** Spec §6.2 as P2's levelUp: a level at 100 × level experience, +1 to the most used skill below 5. */
function levelUp(g: GeneralState): void {
  if (g.level >= GENERAL_LEVEL_MAX || g.xp < 100 * GENERAL_XP_CENTI * g.level) {
    return;
  }
  g.level++;
  const skills = [g.att, g.dfn, g.plan, g.log];
  let best = -1;
  for (let i = 0; i < skills.length; i++) {
    if (skills[i] >= GENERAL_SKILL_MAX) continue;
    if (best < 0 || g.use[i] > g.use[best]) best = i;
  }
  if (best === 0) g.att++;
  else if (best === 1) g.dfn++;
  else if (best === 2) g.plan++;
  else if (best === 3) g.log++;
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
      if (g.auto) a.auto = true;
      land.markArmy(a.id);
      d.markGlobal();
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
      for (const aid of g.armies) {
        if (land.armies.has(aid)) {
          land.issue(id, { kind: "army_auto", army: aid, on: o.on }, "player");
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
  return null;
}

/**
 * ag_front (spec §4.3, deterministic): CommandRules.splitFront cuts the
 * front regions (ascending) into one stretch per army in proportion to
 * its divisions; each army with a stretch gets P2's front order anchored
 * on the stretch's first region against `enemy` (0: every enemy). An
 * army whose stretch is empty keeps its order. Taken when one army took
 * it.
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
  const parts = splitFront(
    front,
    armies.map((aid) => land.armies.get(aid)!.divisions.length),
  );
  let taken = false;
  let block: WwOrderBlock | null = "bad_region";
  armies.forEach((aid, i) => {
    const part = parts[i];
    if (part.length === 0) return;
    const r = land.issue(
      id,
      { kind: "army_front", army: aid, anchor: part[0], enemy },
      sourceOf(d, id),
    );
    if (r === null) taken = true;
    else if (block === "bad_region") block = r;
  });
  return taken ? null : block;
}
