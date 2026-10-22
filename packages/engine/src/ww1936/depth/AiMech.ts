// World War 1936 P6 lane W3 (plan Task 9 Step 7): the AI's mechanisms
// (spec §19.7, §13.2, §14). Every 10th day of the country (plan decision
// 39). History is a loose guide (owner's direction): each rule judges the
// situation (war, tension, the faction's state) and the dates only stand
// in for "the world got there". A mechanism decision (K5's data) is taken
// here only when its AI weight is 0 — a weighted one is P3's decision AI's.
import { COUNTRIES } from "@openfront/engine-api/ww1936/Countries";
import {
  CONTINUOUS_FOCUSES,
  type ContinuousFocus,
  FACTION_GOALS,
  type FactionGoal,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { IDEO_DEM } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import { CONGRESS, cfocusBlock } from "@openfront/engine-lib/ww1936/MechRules";
import {
  decisionBlock,
  decisionDef,
  takeDecision,
} from "../politics/Decisions";
import { bopBandOf, bopValue } from "./BalanceOfPower";
import { usaIdOf } from "./Congress";
import { cfocusOpenFor, setCfocus } from "./ContinuousFocus";
import {
  FACTION_GOAL_SLOTS,
  FR_SHARED_INTEL,
  FR_SHARED_RESEARCH,
  goalProgressPm,
  issueFactionGoal,
  issueFactionRule,
  ruleOn,
} from "./FactionRules";
import type { WwDepth } from "./WwDepth";

/** Spec §19.7: congress lobbying from 40% world tension. */
const AI_CONGRESS_TENSION_BP = 4_000;
/** PP an AI keeps after paying for a faction rule. */
const AI_PP_RESERVE = 50;
/** Spec §14.2 AI: members first, then industry (then the rest) — the tie order. */
const AI_GOAL_ORDER: readonly FactionGoal[] = [
  "fg_members",
  "fg_industry",
  "fg_research",
  "fg_europe_vp",
  "fg_sea_lanes",
  "fg_liberation",
];

export function aiMechDay(d: WwDepth, id: number, day: number): void {
  if (d.countries[id] === null || d.countries[id] === undefined) return;
  if (day % 10 !== id % 10) return;
  aiContinuousFocus(d, id, day);
  aiCongress(d, id);
  aiBalance(d, id, day);
  aiFactionRules(d, id, day);
  aiFactionGoals(d, id);
}

/** Spec §19.7: at war war effort (war support < 50%) or industry; at peace construction. */
function aiContinuousFocus(d: WwDepth, id: number, day: number): void {
  const c = d.countries[id]!;
  if (!cfocusOpenFor(d, id, day)) return;
  const ws = d.ww.politics.country(id)?.wsBp ?? 0;
  const want: ContinuousFocus = d.ww.hasWar(id)
    ? ws < 5_000
      ? "cf_war_effort"
      : "cf_industry"
    : "cf_construction";
  const i = CONTINUOUS_FOCUSES.indexOf(want);
  const block = cfocusBlock({
    open: true,
    current: c.mech.cfocus,
    lockUntil: c.mech.cfocusLock,
    day,
    want: i,
  });
  if (block === null) setCfocus(d, id, i, day);
}

/**
 * A mechanism decision this AI takes itself (unweighted in the data), when
 * allowed now. K5's congress and balance decisions all carry AI weights,
 * so with K5's data P3's decision AI takes them and aiCongress/aiBalance
 * take nothing: they stand for data that leaves a decision to this AI.
 */
function takeMechDecision(d: WwDepth, id: number, decision: string): boolean {
  const pol = d.ww.politics;
  const def = decisionDef(pol, decision);
  if (def === undefined || def.ai.base > 0) return false;
  if (decisionBlock(pol, id, decision, 0) !== null) return false;
  return takeDecision(pol, id, decision, 0, d.mg.ticks(), false) === null;
}

/** Spec §19.7: under the faction threshold and tension ≥ 40% → lobbying, then a fireside chat. */
function aiCongress(d: WwDepth, id: number): void {
  if (id !== usaIdOf(d)) return;
  if (d.ww.politics.wtBp < AI_CONGRESS_TENSION_BP) return;
  if (d.mech.congressBp >= CONGRESS.faction) return;
  if (!takeMechDecision(d, id, "usa_lobby_congress")) {
    takeMechDecision(d, id, "usa_fireside_chat");
  }
}

function atWarWithTag(
  d: WwDepth,
  id: number,
  tags: readonly string[],
): boolean {
  return tags.some((t) => {
    const x = d.ww.politics.idOfTag(t as never);
    return x > 0 && d.ww.isAtWar(id, x);
  });
}

/**
 * Spec §13.2 AI: China toward the centre; Japan the army's way until it
 * fights a naval power (or 1941 comes), then toward the balance; France to
 * the right once rearmament is called for (1938, 40% tension, or war).
 */
function aiBalance(d: WwDepth, id: number, day: number): void {
  const tag = d.ww.tagOf(id);
  if (tag !== "CHN" && tag !== "JPN" && tag !== "FRA") return;
  if (bopBandOf(d, tag) < 0) return; // switched off
  const v = bopValue(d, tag);
  if (tag === "CHN") {
    if (v > -600) takeMechDecision(d, id, "chn_central_officers");
    return;
  }
  if (tag === "JPN") {
    const balance =
      atWarWithTag(d, id, ["USA", "GBR"]) || day >= dayOfDate("1941-01-01");
    if (!balance) {
      if (v > -600) takeMechDecision(d, id, "jpn_army_budget");
    } else if (v < -200) {
      takeMechDecision(d, id, "jpn_navy_budget");
    } else if (v > 200) {
      takeMechDecision(d, id, "jpn_army_budget");
    }
    return;
  }
  const rearm =
    day >= dayOfDate("1938-01-01") ||
    d.ww.politics.wtBp >= AI_CONGRESS_TENSION_BP ||
    d.ww.hasWar(id);
  if (rearm && v < 600) takeMechDecision(d, id, "fra_rearmament_act");
}

/** The faction `id` leads (-1 none) and its members. */
function led(d: WwDepth, id: number): { f: number; members: number[] } {
  const pol = d.ww.politics;
  const f = pol.factionIdx(id);
  const fs = f < 0 ? null : pol.faction(f);
  return fs === null || fs.leader !== id
    ? { f: -1, members: [] }
    : { f, members: fs.members };
}

/**
 * Spec §14.1 AI: the leader shares research from 1939; a democratic leader
 * shares intelligence once the faction fights a major and the war has
 * turned hard (mid-1940, or a member down) — the Anglo-American way; the
 * others never do. (Spec §19.7: the naval treaty's members follow the
 * escalator and stay — no AI step.)
 */
function aiFactionRules(d: WwDepth, id: number, day: number): void {
  const { f, members } = led(d, id);
  if (f < 0) return;
  const pol = d.ww.politics;
  const pp = () => pol.country(id)?.ppMilli ?? 0;
  if (
    !ruleOn(d, f, FR_SHARED_RESEARCH) &&
    day >= dayOfDate("1939-01-01") &&
    pp() >= (50 + AI_PP_RESERVE) * 1000
  ) {
    issueFactionRule(
      d,
      id,
      { kind: "faction_rule", rule: "fr_shared_research", on: true },
      day,
    );
  }
  if (
    !ruleOn(d, f, FR_SHARED_INTEL) &&
    pol.country(id)?.ruling === IDEO_DEM &&
    members.some((m) => d.ww.enemiesOf(m).some((e) => isMajorId(d, e))) &&
    (day >= dayOfDate("1940-06-01") ||
      members.some((m) => d.ww.isCapitulated(m))) &&
    pp() >= (50 + AI_PP_RESERVE) * 1000
  ) {
    issueFactionRule(
      d,
      id,
      { kind: "faction_rule", rule: "fr_shared_intel", on: true },
      day,
    );
  }
}

function isMajorId(d: WwDepth, id: number): boolean {
  const tag = d.ww.scenario.tagOfSmallId(id);
  return tag !== undefined && COUNTRIES[tag].major;
}

/**
 * Spec §14.2 AI: the leader watches the three open goals its faction is
 * closest to (goalProgressPm; ties members, industry, research, Europe,
 * sea lanes, liberation). A slotted goal that fell behind is replaced, so
 * a faction too small for six members or short of 400 factories turns to
 * what it can reach. Slots cost nothing and goals keep no progress.
 */
function aiFactionGoals(d: WwDepth, id: number): void {
  const { f } = led(d, id);
  if (f < 0) return;
  const g = d.mech.factionGoals.find((x) => x.faction === f);
  const achieved = g?.achieved ?? 0;
  const want = AI_GOAL_ORDER.map((goal, k) => ({
    i: FACTION_GOALS.indexOf(goal),
    k,
    p: goalProgressPm(d, f, goal),
  }))
    .filter((x) => (achieved & (1 << x.i)) === 0)
    .sort((a, b) => b.p - a.p || a.k - b.k)
    .slice(0, FACTION_GOAL_SLOTS)
    .map((x) => x.i);
  const slots = [...(g?.slots ?? [])];
  const missing = want.filter((i) => !slots.includes(i));
  for (let s = 0; s < FACTION_GOAL_SLOTS && missing.length > 0; s++) {
    const cur = slots[s] ?? -1;
    if (cur >= 0 && want.includes(cur)) continue;
    const goal = missing.shift()!;
    issueFactionGoal(d, id, {
      kind: "faction_goal",
      slot: s,
      goal: FACTION_GOALS[goal],
    });
  }
}
