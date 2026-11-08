// P6 lane D (plan Task 2): the AI's doctrine and command choices (spec
// §19.1–§19.2). Daily at war, every 10 days in peace (day % 10 ===
// smallID % 10, plan decision 39), through the same orders a player gives.
// History is flavour (owner, 2026-10-21): the real field marshals come on
// their day only with the historical AI.
import {
  FM_PROMOTE_PP,
  FM_TRAITS,
  FmTrait,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import {
  fieldMarshalCap,
  fmEligible,
  groupArmyCap,
} from "@openfront/engine-lib/ww1936/CommandRules";
import { frontChainBetween } from "@openfront/engine-lib/ww1936/FrontRules";
import { GENERALS } from "@openfront/engine-lib/ww1936/Generals";
import { historicalAiActive } from "@openfront/engine-lib/ww1936/Pace";
import { AI_STEP2 } from "../land/AiLand";
import { canServe } from "../land/GeneralsRun";
import { newTitledGeneralState } from "../land/LandStartRun";
import type { Army, CountryLand, GeneralState } from "../land/WwLand";
import { payPp } from "../politics/PayPp";
import {
  clearGroupLines,
  createGroup,
  FM_ARMY,
  issueArmyGroup,
} from "./ArmyGroups";
import { issueCommand, listedFm, makeMarshal, promoteMarshal } from "./Command";
import { startPosOf } from "./Thought";
import type { WwDepth } from "./WwDepth";

/** Spec §19.2: armies before the AI wants a field marshal. */
const AI_FM_ARMIES = 4;
/** Spec §4.3: a titled field marshal's every skill (Japan's, Italy's office). */
const TITLED_FM_SKILL = 2;
/** A field marshal's traits by landRowOf, first choice first. */
const FM_TRAIT_PLAN: Readonly<Record<string, readonly FmTrait[]>> = {
  gd_mobile: ["fm_offensive", "fm_fast_planner", "fm_logistics"],
  gd_mass: ["fm_inspiring", "fm_logistics", "fm_offensive"],
  gd_firepower: ["fm_logistics", "fm_offensive", "fm_thorough"],
  gd_battleplan: ["fm_thorough", "fm_defensive", "fm_strategist"],
  "": ["fm_strategist", "fm_logistics", "fm_defensive"],
};
/**
 * Spec §19.1–§19.2, an AI country's depth day: at war daily and in peace
 * every 10 days, the armies' reinforcement priority, field marshals and
 * army groups (traits and the officer corps are gone: traits come by
 * themselves, Command.dailyCommand).
 */
export function aiCommandDay(d: WwDepth, id: number, day: number): void {
  const c = d.country(id);
  if (c === null || d.ww.land.country(id) === null) return;
  if (!d.ww.hasWar(id) && day % 10 !== id % 10) return;
  aiPriorities(d, id);
  aiMarshals(d, id, day);
  aiGroups(d, id);
  if (AI_STEP2.groupLines) {
    for (const g of d.groups.filter((x) => x.owner === id)) {
      aiGroupLines(d, id, g.id);
    }
  }
}

/** ww162 §4 (e): most regions in a group's split offensive line. */
const AI_GROUP_GOAL_MAX = 24;

/**
 * ww162 §4 (e): a group whose armies all hold front lines against one
 * enemy that join into one stretch of the border gets that stretch as
 * group_front_line (the group then cuts it among them daily), and the
 * union of its armies' broad offensive lines as a split group_goal. Any
 * other group's lines go (the land AI holds a ring or an effort there).
 */
export function aiGroupLines(d: WwDepth, id: number, group: number): void {
  const land = d.ww.land;
  const g = d.groups.find((x) => x.owner === id && x.id === group);
  if (g === undefined) return;
  const armies = g.armies
    .map((aid) => land.armies.get(aid))
    .filter((a): a is Army => a !== undefined && a.divisions.length > 0);
  const enemy = armies[0]?.order.enemy ?? 0;
  const lined =
    armies.length >= 2 &&
    enemy !== 0 &&
    armies.every(
      (a) =>
        (a.order.kind === "front" || a.order.kind === "plan") &&
        a.order.enemy === enemy &&
        a.order.ends !== undefined,
    );
  const ends = lined ? groupEnds(d, id, enemy, armies) : null;
  if (ends === null) {
    clearGroupLines(d, id, g.id);
    return;
  }
  const now =
    g.ends !== undefined && g.enemy === enemy
      ? frontChainBetween(land, id, enemy, g.ends[0], g.ends[1])
      : [];
  const want = frontChainBetween(land, id, enemy, ends[0], ends[1]);
  if (now.length !== want.length || !now.every((r) => want.includes(r))) {
    land.issue(
      id,
      { kind: "group_front_line", group: g.id, ends, enemy },
      "ai",
    );
  }
  const goal: number[] = [];
  for (const a of armies) {
    if (a.order.spear === true) continue;
    for (const r of a.order.goal ?? []) {
      if (goal.includes(r) || !land.isEnemy(id, land.controller[r])) continue;
      if (goal.length < AI_GROUP_GOAL_MAX) goal.push(r);
    }
  }
  goal.sort((x, y) => x - y);
  if (goal.length === 0) return;
  const had = g.goal ?? [];
  if (
    had.length === goal.length &&
    had.every((r, i) => r === goal[i]) &&
    g.split === true &&
    g.spear !== true
  ) {
    return;
  }
  land.issue(
    id,
    {
      kind: "group_goal",
      group: g.id,
      regions: goal,
      spear: false,
      split: true,
    },
    "ai",
  );
}

/**
 * ww162 §4 (e): the ends of the stretch the armies' front lines make
 * together (its two tips, ascending), when frontChainBetween joins them
 * through exactly those regions; null otherwise.
 */
function groupEnds(
  d: WwDepth,
  id: number,
  enemy: number,
  armies: readonly Army[],
): [number, number] | null {
  const land = d.ww.land;
  const union = new Set<number>();
  for (const a of armies) {
    const e = a.order.ends!;
    for (const r of frontChainBetween(land, id, enemy, e[0], e[1])) {
      union.add(r);
    }
  }
  const list = [...union].sort((x, y) => x - y);
  if (list.length === 0) return null;
  const tips =
    list.length === 1
      ? [list[0], list[0]]
      : list.filter((r) => {
          const near = new Set<number>();
          for (const e of land.scenario.edgesOf(r)) {
            if (union.has(e.to) && e.to !== r) near.add(e.to);
          }
          return near.size <= 1;
        });
  if (tips.length !== 2) return null;
  const chain = frontChainBetween(land, id, enemy, tips[0], tips[1]);
  if (chain.length !== union.size || !chain.every((r) => union.has(r))) {
    return null;
  }
  return [tips[0], tips[1]];
}

/**
 * The land row key (an officer corps and marshal table) of a start
 * position: mass leaning first, then mobility, then firepower, else the
 * battle plan (design §9). Notches: negative = left end.
 */
export function landRowOf(pos: readonly number[]): string {
  if (pos[2] <= -4) return "gd_mass";
  if (pos[1] <= -3) return "gd_mobile";
  if (pos[1] >= 3) return "gd_firepower";
  return "gd_battleplan";
}
/** The naval row key: raid -> trade interdiction, carrier -> base strike, patrol -> fleet in being, else "". */
export function navalRowOf(pos: readonly number[]): string {
  if (pos[4] <= -3) return "gd_trade_interdiction";
  if (pos[3] >= 3) return "gd_base_strike";
  if (pos[5] >= 3) return "gd_fleet_in_being";
  return "";
}
/** The air row key: strategic -> destruction, close support -> battlefield support, air escort -> operational integrity, else "". */
export function airRowOf(pos: readonly number[]): string {
  if (pos[7] <= -3) return "gd_strategic_destruction";
  if (pos[7] >= 3) return "gd_battlefield_support";
  if (pos[6] >= 3) return "gd_operational_integrity";
  return "";
}

/** Spec §4.6 / §19.2: front armies high, P5 garrisons low, the rest normal. */
function aiPriorities(d: WwDepth, id: number): void {
  for (const a of d.ww.land.armiesOf(id)) {
    const k = a.order.kind;
    const want = k === "garrison" ? 0 : k === "front" || k === "plan" ? 2 : 1;
    if (a.priority === want) continue;
    issueCommand(
      d,
      id,
      { kind: "army_priority", army: a.id, value: want },
      tickOf(d),
    );
  }
}

/** The tick the AI's orders are given on (its depth turn's). */
function tickOf(d: WwDepth): number {
  return d.mg.ticks();
}

/** The front bundles (spec §19.2): armies on a front or plan, by the enemy they face. */
function frontBundles(d: WwDepth, id: number): Map<number, Army[]> {
  const out = new Map<number, Army[]>();
  for (const a of d.ww.land.armiesOf(id)) {
    if (a.order.kind !== "front" && a.order.kind !== "plan") continue;
    if (a.divisions.length === 0) continue;
    let list = out.get(a.order.enemy);
    if (list === undefined) {
      list = [];
      out.set(a.order.enemy, list);
    }
    list.push(a);
  }
  return out;
}

const skillSum = (g: GeneralState) => g.att + g.dfn + g.plan + g.log;

/** The start position's preferred field marshal trait the general lacks (FM_TRAITS index), -1 none. */
function fmTraitFor(d: WwDepth, id: number, have: number): number {
  const plan = FM_TRAIT_PLAN[landRowOf(startPosOf(d, id))];
  for (const t of [...plan, ...FM_TRAITS]) {
    const b = FM_TRAITS.indexOf(t);
    if ((have & (1 << b)) === 0) return b;
  }
  return -1;
}

/**
 * Spec §4.3 / §19.2 field marshals: with the historical AI, a K5 marshal
 * whose day has come is promoted (an office's is a new titled general,
 * every skill 2); with 4 armies or more, one marshal per front bundle (at
 * least one) up to the cap — the listed general first, then the highest
 * skill sum. Each costs 25 PP: the AI waits for them.
 */
function aiMarshals(d: WwDepth, id: number, day: number): void {
  const land = d.ww.land;
  const cl = land.country(id)!;
  if (historicalAiActive(d.mg.config(), day)) {
    const tag = d.ww.tagOf(id);
    const rows = d.ww.politics.content.startFieldMarshals.filter(
      (r) =>
        r.tag === tag &&
        (r.from === undefined || dayOfDate(r.from) <= day) &&
        (r.until === undefined || day < dayOfDate(r.until)),
    );
    let titled = 0;
    for (const g of cl.generals) if (g.fm && g.roster < 0) titled++;
    for (const r of rows) {
      const trait = FM_TRAITS.indexOf(r.trait);
      if (r.general.startsWith("title:")) {
        if (titled > 0) {
          titled--;
          continue;
        }
        if (promoteTitled(d, id, cl, trait)) return;
        continue;
      }
      const g = cl.generals.find(
        (x) => x.roster >= 0 && GENERALS[x.roster]?.id === r.general,
      );
      if (g === undefined || g.fm) continue;
      if (promoteMarshal(d, id, g.id, trait, day) === null) return;
    }
  }
  const armies = land.armiesOf(id);
  if (armies.length < AI_FM_ARMIES) return;
  const marshals = land.fieldMarshalCount(id);
  const want = Math.max(1, frontBundles(d, id).size);
  if (marshals >= want) return;
  if (marshals >= fieldMarshalCap(land.rowsOf(id).length)) return;
  const best = cl.generals
    .filter(
      (g) =>
        !g.fm &&
        canServe(land, g, day) &&
        fmEligible(g.level, skillSum(g), listedFm(d, id, g, day)),
    )
    .sort(
      (a, b) =>
        Number(listedFm(d, id, b, day)) - Number(listedFm(d, id, a, day)) ||
        skillSum(b) - skillSum(a) ||
        b.level - a.level ||
        a.id - b.id,
    )[0];
  if (best === undefined) return;
  promoteMarshal(d, id, best.id, fmTraitFor(d, id, 0), day);
}

/** K5's titled marshal (an office): a new titled general, every skill 2, made a field marshal; the cap and 25 PP. */
function promoteTitled(
  d: WwDepth,
  id: number,
  cl: CountryLand,
  trait: number,
): boolean {
  const land = d.ww.land;
  if (land.fieldMarshalCount(id) >= fieldMarshalCap(land.rowsOf(id).length)) {
    return false;
  }
  const pp = d.ww.politics.country(id)?.ppMilli ?? 0;
  if (pp < FM_PROMOTE_PP * 1000) return false;
  if (!payPp(d.ww.politics, id, FM_PROMOTE_PP)) return false;
  const g = newTitledGeneralState(id, cl.nextTitleNo++);
  g.att = TITLED_FM_SKILL;
  g.dfn = TITLED_FM_SKILL;
  g.plan = TITLED_FM_SKILL;
  g.log = TITLED_FM_SKILL;
  cl.generals.push(g);
  makeMarshal(d, id, g, trait);
  return true;
}

/**
 * Spec §19.2 army groups: members that left the front leave their group;
 * each front bundle's armies outside a group join the bundle's group (room
 * permitting) or form one under a free field marshal (the biggest armies
 * first). The armies keep the fronts P2's AI planner gave them (an
 * ag_front on top would reset their readiness).
 */
function aiGroups(d: WwDepth, id: number): void {
  const land = d.ww.land;
  const cl = land.country(id)!;
  const tick = tickOf(d);
  for (const g of d.groups.filter((x) => x.owner === id)) {
    for (const aid of [...g.armies]) {
      const k = land.armies.get(aid)?.order.kind;
      if (k === "front" || k === "plan") continue;
      issueArmyGroup(
        d,
        id,
        { kind: "ag_remove", group: g.id, army: aid },
        tick,
      );
    }
  }
  const bundles = [...frontBundles(d, id).entries()].sort(
    (a, b) =>
      b[1].reduce((s, x) => s + x.divisions.length, 0) -
        a[1].reduce((s, x) => s + x.divisions.length, 0) || a[0] - b[0],
  );
  for (const [enemy, armies] of bundles) {
    const free = armies
      .filter((a) => a.group === 0)
      .sort((a, b) => b.divisions.length - a.divisions.length || a.id - b.id);
    if (free.length === 0) continue;
    const group = d.groups.find(
      (g) =>
        g.owner === id &&
        g.armies.some((aid) => {
          const o = land.armies.get(aid)?.order;
          return o !== undefined && o.enemy === enemy;
        }),
    );
    if (group !== undefined) {
      for (const a of free) {
        issueArmyGroup(
          d,
          id,
          { kind: "ag_add", group: group.id, army: a.id },
          tick,
        );
      }
      continue;
    }
    const fm = cl.generals
      .filter(
        (g) =>
          g.fm &&
          g.army === FM_ARMY &&
          !d.groups.some((x) => x.owner === id && x.fm === g.id),
      )
      .sort((a, b) => skillSum(b) - skillSum(a) || a.id - b.id)[0];
    if (fm === undefined) continue;
    const take = free.slice(0, groupArmyCap(fm.fmTraits)).map((a) => a.id);
    createGroup(d, id, fm.id, take);
  }
}
