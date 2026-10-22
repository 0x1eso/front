// World War 1936 P6 lane W3 (plan Task 9): faction rules, goals and shared
// research (spec §14). Rules: the leader turns one on or off (50 PP, then
// 180 days locked) — WwDepth.mech.factionRules [faction, rule, on, first
// day it may change again]. Goals: the leader picks up to three (free);
// each is a state check once a day, rewards every member once, and can
// never be met again — mech.factionGoals {faction, slots (FACTION_GOALS
// index, -1 empty), achieved (bits)}.
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import { COUNTRIES } from "@openfront/engine-api/ww1936/Countries";
import {
  FACTION_GOALS,
  FACTION_RULE_LOCK_DAYS,
  FACTION_RULE_PP,
  FACTION_RULES,
  type FactionGoal,
} from "@openfront/engine-api/ww1936/DepthTypes";
import type {
  WwOrderBlock,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { sharedResearchBonusPct } from "@openfront/engine-lib/ww1936/MechRules";
import { addPpCapped } from "@openfront/engine-lib/ww1936/PoliticsRules";
import type { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { payPp } from "../politics/PayPp";
import { addSpirit } from "../politics/Spirits";
import type { WwDepth } from "./WwDepth";

export const FR_IDEOLOGY_LOCK = FACTION_RULES.indexOf("fr_ideology_lock");
export const FR_SHARED_RESEARCH = FACTION_RULES.indexOf("fr_shared_research");
export const FR_SHARED_INTEL = FACTION_RULES.indexOf("fr_shared_intel");
export const FACTION_GOAL_SLOTS = 3;

/** Spec §14.2 thresholds. */
export const GOAL_MEMBERS = 6;
export const GOAL_EUROPE_VP_PCT = 40;
export const GOAL_SEA_REGIONS = 20;
export const GOAL_SEA_SUPREMACY_PM = 600;
export const GOAL_TECHS_PER_MEMBER = 50;
export const GOAL_MIL_FACTORIES = 400;
/** Spec §14.2 rewards: PP, the 365-day spirits (K5's), war support. */
export const GOAL_PP = 50;
export const GOAL_SPIRIT_DAYS = 365;
export const GOAL_WAR_SUPPORT_BP = 1_000;
export const GOAL_SPIRITS: Partial<Record<FactionGoal, string>> = {
  fg_europe_vp: "fg_cohesion",
  fg_sea_lanes: "fg_sea_control",
  fg_research: "fg_science",
  fg_industry: "fg_arsenal",
};

/** The faction's rule (FACTION_RULES index) is on. */
export function ruleOn(d: WwDepth, faction: number, rule: number): boolean {
  if (faction < 0) return false;
  for (const r of d.mech.factionRules) {
    if (r[0] === faction && r[1] === rule) return r[2];
  }
  return false;
}

/** Spec §14.1: +10% per other member that has the tech, at most +30%. */
export function sharedResearchPct(
  d: WwDepth,
  id: number,
  tech: WwTechId,
): number {
  if (d.mech.factionRules.length === 0) return 0;
  const pol = d.ww.politics;
  const f = pol.factionIdx(id);
  if (f < 0 || !ruleOn(d, f, FR_SHARED_RESEARCH)) return 0;
  let n = 0;
  for (const m of pol.faction(f)?.members ?? []) {
    if (m !== id && d.ww.economy.country(m)?.researched.has(tech) === true) {
      n++;
    }
  }
  return sharedResearchBonusPct(n);
}

/** Spec §14.1, §8.6–§8.7: two members of a faction sharing intelligence. */
export function sharedIntel(d: WwDepth, a: number, b: number): boolean {
  if (d.mech.factionRules.length === 0) return false;
  const pol = d.ww.politics;
  return pol.sameFaction(a, b) && ruleOn(d, pol.factionIdx(a), FR_SHARED_INTEL);
}

/** The leader's ideology lock refuses the joiner (another ruling ideology). */
export function ideologyLocked(
  d: WwDepth,
  leader: number,
  joiner: number,
): boolean {
  if (d.mech.factionRules.length === 0) return false;
  const pol = d.ww.politics;
  const f = pol.factionIdx(leader);
  if (f < 0 || !ruleOn(d, f, FR_IDEOLOGY_LOCK)) return false;
  return pol.country(joiner)?.ruling !== pol.country(leader)?.ruling;
}

/** The faction `id` leads, -1 when none. */
function ledFaction(d: WwDepth, id: number): number {
  const pol = d.ww.politics;
  const f = pol.factionIdx(id);
  return f >= 0 && pol.faction(f)?.leader === id ? f : -1;
}

/** faction_rule {rule, on}: the leader, a change, unlocked, 50 PP. */
export function issueFactionRule(
  d: WwDepth,
  id: number,
  o: Extract<DepthOrder, { kind: "faction_rule" }>,
  day: number,
): WwOrderBlock | null {
  const f = ledFaction(d, id);
  if (f < 0) return "faction_leader_only";
  const rule = FACTION_RULES.indexOf(o.rule);
  const e = d.mech.factionRules.find((r) => r[0] === f && r[1] === rule);
  if ((e?.[2] ?? false) === o.on) return "faction_rule";
  if (e !== undefined && day < e[3]) return "faction_rule";
  const pol = d.ww.politics;
  if (!payPp(pol, id, FACTION_RULE_PP)) return "no_pp";
  pol.markCountry(id);
  setRule(d, f, rule, o.on, day);
  return null;
}

export function setRule(
  d: WwDepth,
  f: number,
  rule: number,
  on: boolean,
  day: number,
): void {
  const e = d.mech.factionRules.find((r) => r[0] === f && r[1] === rule);
  if (e !== undefined) {
    e[2] = on;
    e[3] = day + FACTION_RULE_LOCK_DAYS;
  } else {
    d.mech.factionRules.push([f, rule, on, day + FACTION_RULE_LOCK_DAYS]);
    d.mech.factionRules.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  }
  d.markGlobal();
}

type GoalRecord = { faction: number; slots: number[]; achieved: number };

function goalRecord(d: WwDepth, f: number): GoalRecord {
  let g = d.mech.factionGoals.find((x) => x.faction === f);
  if (g === undefined) {
    g = { faction: f, slots: [-1, -1, -1], achieved: 0 };
    d.mech.factionGoals.push(g);
    d.mech.factionGoals.sort((a, b) => a.faction - b.faction);
  }
  return g;
}

/** faction_goal {slot, goal}: the leader, free; not met yet, not in another slot. */
export function issueFactionGoal(
  d: WwDepth,
  id: number,
  o: Extract<DepthOrder, { kind: "faction_goal" }>,
): WwOrderBlock | null {
  const f = ledFaction(d, id);
  if (f < 0) return "faction_leader_only";
  const goal = FACTION_GOALS.indexOf(o.goal);
  if (goal < 0 || o.slot >= FACTION_GOAL_SLOTS) return "bad_index";
  const g = goalRecord(d, f);
  if ((g.achieved & (1 << goal)) !== 0 || g.slots.includes(goal)) {
    return "bad_index";
  }
  g.slots[o.slot] = goal;
  d.markGlobal();
  return null;
}

/** Once a day (dayCommon): stale factions' rows go, then each faction's goals. */
export function factionGoalsDay(d: WwDepth, day: number): void {
  const pol = d.ww.politics;
  const live = (f: number) => pol.faction(f) !== null;
  if (d.mech.factionRules.some((r) => !live(r[0]))) {
    d.mech.factionRules = d.mech.factionRules.filter((r) => live(r[0]));
    d.markGlobal();
  }
  if (d.mech.factionGoals.some((g) => !live(g.faction))) {
    d.mech.factionGoals = d.mech.factionGoals.filter((g) => live(g.faction));
    d.markGlobal();
  }
  for (const g of d.mech.factionGoals) {
    for (let s = 0; s < g.slots.length; s++) {
      const goal = g.slots[s];
      if (goal < 0 || (g.achieved & (1 << goal)) !== 0) continue;
      if (!goalMet(d, g.faction, FACTION_GOALS[goal])) continue;
      g.achieved |= 1 << goal;
      g.slots[s] = -1;
      rewardGoal(d, g.faction, FACTION_GOALS[goal], day);
      d.markGlobal();
    }
  }
}

/** Spec §14.2 conditions, judged on the faction as it stands. */
export function goalMet(d: WwDepth, f: number, goal: FactionGoal): boolean {
  return goalProgressPm(d, f, goal) >= 1000;
}

/**
 * How far the faction is toward the goal, ‰ (1000 or more: met). The AI
 * ranks its slots by it. Liberation has no measure: 1000 when met, 500
 * while a member has lost its country, else 0.
 */
export function goalProgressPm(
  d: WwDepth,
  f: number,
  goal: FactionGoal,
): number {
  const pol = d.ww.politics;
  const fs = pol.faction(f);
  if (fs === null) return 0;
  const members = fs.members;
  const pm = (have: number, need: number) =>
    need <= 0 ? 0 : Math.floor((have * 1000) / need);
  switch (goal) {
    case "fg_members":
      return pm(members.length, GOAL_MEMBERS);
    case "fg_europe_vp": {
      let all = 0;
      let held = 0;
      for (const [r, vp] of europeVp(d.ww.scenario)) {
        all += vp;
        if (pol.factionIdx(d.ww.land.controller[r] ?? 0) === f) held += vp;
      }
      return pm(held * 100, all * GOAL_EUROPE_VP_PCT);
    }
    case "fg_sea_lanes": {
      const side = d.ww.navy.sideOf(fs.leader);
      let n = 0;
      for (const sr of d.ww.scenario.strategicList()) {
        if (sr.kind !== "sea") continue;
        if (d.ww.navy.supremacy(side, sr.id) >= GOAL_SEA_SUPREMACY_PM) n++;
      }
      return pm(n, GOAL_SEA_REGIONS);
    }
    case "fg_research": {
      let techs = 0;
      for (const m of members) {
        techs += d.ww.economy.country(m)?.researched.size ?? 0;
      }
      return pm(techs, members.length * GOAL_TECHS_PER_MEMBER);
    }
    case "fg_industry": {
      let mil = 0;
      for (const m of members) mil += d.ww.economy.country(m)?.totals.mil ?? 0;
      return pm(mil, GOAL_MIL_FACTORIES);
    }
    case "fg_liberation": {
      // A member that lost its country (capitulated, or a government in
      // exile) whose capital the faction holds again.
      let lost = false;
      for (const m of members) {
        if (!d.ww.isCapitulated(m) && !d.ww.endgame.isExile(m)) continue;
        lost = true;
        const cap = d.ww.capitalRegion(m);
        if (cap > 0 && pol.factionIdx(d.ww.land.controller[cap] ?? 0) === f) {
          return 1000;
        }
      }
      return lost ? 500 : 0;
    }
  }
}

/** Every member: PP +50, the goal's spirit for 365 days, or war support +10 points. */
function rewardGoal(
  d: WwDepth,
  f: number,
  goal: FactionGoal,
  day: number,
): void {
  const pol = d.ww.politics;
  const spirit = GOAL_SPIRITS[goal];
  for (const m of pol.factionMembers(f)) {
    const c = pol.country(m);
    if (c === null || !pol.living(m)) continue;
    if (goal === "fg_members") {
      c.ppMilli = addPpCapped(c.ppMilli, GOAL_PP * 1000);
    } else if (goal === "fg_liberation") {
      c.wsBaseBp = Math.min(10_000, c.wsBaseBp + GOAL_WAR_SUPPORT_BP);
      pol.recomputeStats(m);
    } else if (spirit !== undefined && pol.content.spiritIdx.has(spirit)) {
      addSpirit(pol, m, spirit, GOAL_SPIRIT_DAYS, day);
    }
    pol.markCountry(m);
    d.markCountry(m);
    d.message(m, "ww1936_faction_goal", { goal });
  }
}

/**
 * Europe for fg_europe_vp (plan Task 9 Step 5): the scenario has no
 * continent field and P0 no REGION_CONTINENT table (decision 1 check), so a
 * region is European when its 1936 owner is in the "europe" country group
 * (COUNTRIES) and its centre lies at 35°N or more, from 30°W to 60°E (the
 * weather cell's longitude): North Africa, the Urals' east side and the
 * colonies stay out. [region, VP] of the VP regions, by region (derived).
 */
const EUROPE = new WeakMap<ScenarioIndex, [number, number][]>();

export function europeVp(sc: ScenarioIndex): readonly [number, number][] {
  let l = EUROPE.get(sc);
  if (l === undefined) {
    l = [];
    for (const r of sc.landRegions) {
      if (r.vp <= 0 || COUNTRIES[r.owner]?.group !== "europe") continue;
      const lon = (sc.wcell(r.id) % 36) * 10 - 180;
      if (sc.latC(r.id) < 3500 || lon < -30 || lon >= 60) continue;
      l.push([r.id, r.vp]);
    }
    l.sort((a, b) => a[0] - b[0]);
    EUROPE.set(sc, l);
  }
  return l;
}
