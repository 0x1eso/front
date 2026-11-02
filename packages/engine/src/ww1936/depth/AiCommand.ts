// P6 lane D (plan Task 2): the AI's doctrine and command choices (spec
// §19.1–§19.2). Daily at war, every 10 days in peace (day % 10 ===
// smallID % 10, plan decision 39), through the same orders a player gives.
// History is flavour (owner, 2026-10-21): the officer corps follow the row
// of the country's start position on the thought sliders with a seeded
// chance of another choice, and the real field marshals come on their day
// only with the historical AI.
import {
  ARMY_SPIRIT_CATEGORIES,
  ARMY_SPIRITS,
  ArmySpirit,
  FM_PROMOTE_PP,
  FM_TRAITS,
  FmTrait,
  SPIRIT_CAT_DOMAIN,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  GENERAL_TRAITS,
  GeneralTrait,
  traitBit,
} from "@openfront/engine-api/ww1936/LandTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import {
  AI_TRAIT_RESERVE_XP,
  fieldMarshalCap,
  fmEligible,
  groupArmyCap,
  NEW_GENERAL_TRAITS,
  spiritCost,
  traitAssignBlock,
  traitSlots,
  traitXpCost,
} from "@openfront/engine-lib/ww1936/CommandRules";
import { GENERALS } from "@openfront/engine-lib/ww1936/Generals";
import { historicalAiActive } from "@openfront/engine-lib/ww1936/Pace";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { canServe } from "../land/GeneralsRun";
import { newTitledGeneralState } from "../land/LandStartRun";
import type { Army, CountryLand, GeneralState } from "../land/WwLand";
import { payPp } from "../politics/PayPp";
import {
  createGroup,
  FM_ARMY,
  generalById,
  issueArmyGroup,
} from "./ArmyGroups";
import {
  assignGeneralTrait,
  issueCommand,
  listedFm,
  makeMarshal,
  promoteMarshal,
} from "./Command";
import { startPosOf } from "./Thought";
import type { Domain, WwDepth } from "./WwDepth";

/** Spec §19.2: armies before the AI wants a field marshal. */
const AI_FM_ARMIES = 4;
/** Spec §4.3: a titled field marshal's every skill (Japan's, Italy's office). */
const TITLED_FM_SKILL = 2;
/** Roll purpose of the officer-corps deviation. */
const P_SPIRIT_PLAN = idHash("ai_spirit_plan");
/** Chance of another officer-corps choice than the start position's row, percent (history as flavour). */
const AI_SPIRIT_DEVIATION_PCT = 25;

/** Spec §19.2: the land officer corps of each start-position row, landRowOf (recruitment, command, formation). */
const LAND_SPIRITS: Readonly<
  Record<string, readonly [ArmySpirit, ArmySpirit, ArmySpirit]>
> = {
  gd_mobile: ["as_professional", "as_mission_command", "as_combined_arms"],
  gd_mass: ["as_conscript", "as_political_officers", "as_mass_formation"],
  gd_firepower: ["as_reserve", "as_central_command", "as_combined_arms"],
  gd_battleplan: ["as_professional", "as_central_command", "as_elite_units"],
};
/** Spec §19.2 "해·공도 표": the naval officer corps (training, operations) by navalRowOf; "" no leaning. */
const NAVAL_SPIRITS: Readonly<
  Record<string, readonly [ArmySpirit, ArmySpirit]>
> = {
  gd_fleet_in_being: ["as_fleet_drill", "as_aggressive_fleet"],
  gd_trade_interdiction: ["as_night_training", "as_aggressive_fleet"],
  gd_base_strike: ["as_fleet_drill", "as_joint_ops"],
  "": ["as_damage_control", "as_fleet_preservation"],
};
/** The air officer corps (personnel, command) by airRowOf; "" no leaning. */
const AIR_SPIRITS: Readonly<Record<string, readonly [ArmySpirit, ArmySpirit]>> =
  {
    gd_strategic_destruction: ["as_air_college", "as_independent_air"],
    gd_battlefield_support: ["as_ground_crew", "as_army_cooperation"],
    gd_operational_integrity: ["as_pilot_school", "as_escort_first"],
    "": ["as_pilot_school", "as_army_cooperation"],
  };
/** A field marshal's traits by landRowOf, first choice first. */
const FM_TRAIT_PLAN: Readonly<Record<string, readonly FmTrait[]>> = {
  gd_mobile: ["fm_offensive", "fm_fast_planner", "fm_logistics"],
  gd_mass: ["fm_inspiring", "fm_logistics", "fm_offensive"],
  gd_firepower: ["fm_logistics", "fm_offensive", "fm_thorough"],
  gd_battleplan: ["fm_thorough", "fm_defensive", "fm_strategist"],
  "": ["fm_strategist", "fm_logistics", "fm_defensive"],
};
/** Spec §19.2: the order the AI buys general traits in (armour first for a panzer leader — its prerequisite). */
const TRAIT_PLAN: readonly GeneralTrait[] = [
  "armor_expert",
  "infantry_expert",
  "artillery_officer",
  "engineer_officer",
  ...GENERAL_TRAITS.filter(
    (t) =>
      NEW_GENERAL_TRAITS[t]?.kind === "assign" &&
      ![
        "armor_expert",
        "infantry_expert",
        "artillery_officer",
        "engineer_officer",
      ].includes(t),
  ),
];

/**
 * Spec §19.1–§19.2, an AI country's depth day: at war daily and in peace
 * every 10 days, the officer corps, the armies' reinforcement priority, field marshals and
 * army groups, a trait.
 */
export function aiCommandDay(d: WwDepth, id: number, day: number): void {
  const c = d.country(id);
  if (c === null || d.ww.land.country(id) === null) return;
  if (!d.ww.hasWar(id) && day % 10 !== id % 10) return;
  aiSpirits(d, id);
  aiPriorities(d, id);
  aiMarshals(d, id, day);
  aiGroups(d, id);
  aiTraits(d, id);
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

/** The officer corps each category would take: the start position's row, or (seeded, AI_SPIRIT_DEVIATION_PCT) another of the three. */
export function aiSpiritPlan(d: WwDepth, id: number): number[] {
  const pos = startPosOf(d, id);
  const land = LAND_SPIRITS[landRowOf(pos)];
  const naval = NAVAL_SPIRITS[navalRowOf(pos)];
  const air = AIR_SPIRITS[airRowOf(pos)];
  const rows = [...land, ...naval, ...air];
  const seed = d.ww.politics.seed;
  return ARMY_SPIRIT_CATEGORIES.map((_, cat) => {
    const row = ARMY_SPIRITS.indexOf(rows[cat]);
    if (
      wwRoll(seed, P_SPIRIT_PLAN, id, 100 + cat) % 100 >=
      AI_SPIRIT_DEVIATION_PCT
    ) {
      return row;
    }
    const others = [0, 1, 2].map((k) => cat * 3 + k).filter((s) => s !== row);
    return others[wwRoll(seed, P_SPIRIT_PLAN, id, 110 + cat) % 2];
  });
}

/** Spec §19.2 officer corps: each category's plan once the domain has the experience; never switched. */
function aiSpirits(d: WwDepth, id: number): void {
  const c = d.country(id)!;
  if (c.cmd.spirits.every((s) => s >= 0)) return;
  const plan = aiSpiritPlan(d, id);
  ARMY_SPIRIT_CATEGORIES.forEach((category, cat) => {
    if (c.cmd.spirits[cat] >= 0) return;
    const domain = SPIRIT_CAT_DOMAIN[cat] as Domain;
    if (d.xpOf(id, domain) < spiritCost(-1)) return;
    issueCommand(
      d,
      id,
      { kind: "army_spirit_pick", category, id: ARMY_SPIRITS[plan[cat]] },
      tickOf(d),
    );
  });
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

/**
 * Spec §19.2 traits (ww9: paid with army XP): one a day, when the XP is
 * the trait's price + AI_TRAIT_RESERVE_XP (what the organisation and
 * designs need stays) — the generals of front armies first (the bigger army
 * first), then the other army generals, in TRAIT_PLAN order; then a field
 * marshal's next trait (levels 3 and 5).
 */
function aiTraits(d: WwDepth, id: number): void {
  const land = d.ww.land;
  const cl = land.country(id)!;
  const xp = d.xpOf(id, 0);
  // The cheapest trait plus the reserve: nothing to buy below it.
  if (xp < traitXpCost("skirmisher", false) + AI_TRAIT_RESERVE_XP) return;
  const armies = land
    .armiesOf(id)
    .filter((a) => a.general !== 0)
    .sort((a, b) => {
      const fa = a.order.kind === "front" || a.order.kind === "plan" ? 0 : 1;
      const fb = b.order.kind === "front" || b.order.kind === "plan" ? 0 : 1;
      return fa - fb || b.divisions.length - a.divisions.length || a.id - b.id;
    });
  for (const a of armies) {
    const g = generalById(cl, a.general);
    if (g === null || g.fm) continue;
    const held = GENERAL_TRAITS.filter((t) => (g.traits & traitBit(t)) !== 0);
    for (const t of TRAIT_PLAN) {
      if (
        xp < traitXpCost(t, false) + AI_TRAIT_RESERVE_XP ||
        traitAssignBlock({
          admiral: false,
          level: g.level,
          traits: held,
          slots: traitSlots(g.level),
          trait: t,
          xp,
          isFm: false,
          fmTraits: [],
        }) !== null
      ) {
        continue;
      }
      if (assignGeneralTrait(d, id, g.id, t) === null) return;
    }
  }
  for (const g of cl.generals) {
    if (!g.fm) continue;
    const b = fmTraitFor(d, id, g.fmTraits);
    if (b < 0) continue;
    const t = FM_TRAITS[b];
    if (d.xpOf(id, 0) < traitXpCost(t, false) + AI_TRAIT_RESERVE_XP) return;
    if (assignGeneralTrait(d, id, g.id, t) === null) return;
  }
}
