// World War 1936 P3 (spec §10.3; plan decision 12): every condition kind.
// Conditions only read state, so the foundation finishes them all.
import { COUNTRIES } from "@openfront/engine-api/ww1936/Countries";
import { LAW_LADDERS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { SHIP_CLASSES } from "@openfront/engine-api/ww1936/NavyTypes";
import type {
  Condition,
  LeafCondition,
  Selector,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import { IDEOLOGIES } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import { conditionLeaves } from "@openfront/engine-lib/ww1936/Describe";
import { EffectCtx, resolveSelector } from "./Dispatch";
import { opinionOf } from "./Treaties";
import type { WwPolitics } from "./WwPolitics";

export function evalCondition(
  ctx: EffectCtx,
  c: Condition | undefined,
): boolean {
  if (c === undefined) return true;
  if ("all" in c) return c.all.every((x) => evalCondition(ctx, x));
  if ("any" in c) return c.any.some((x) => evalCondition(ctx, x));
  if ("not" in c) return !evalCondition(ctx, c.not);
  return evalLeaf(ctx, c);
}

/** Leaf numbers (conditionLeaves order) that are false now: the screens' ✗ lines (spec §21.3). */
export function failingLeaves(
  ctx: EffectCtx,
  c: Condition | undefined,
): number[] {
  const out: number[] = [];
  conditionLeaves(c).forEach((l, i) => {
    if (!evalLeaf(ctx, l)) out.push(i);
  });
  return out;
}

export function divisionCount(pol: WwPolitics, id: number): number {
  const t = pol.land.divisions;
  let n = 0;
  for (let r = 0; r < t.rows; r++) if (t.id[r] !== 0 && t.owner[r] === id) n++;
  return n;
}

/** Spec §18.7: Σ division strength ‰ (P2 strengthOf). */
export function armyStrength(pol: WwPolitics, id: number): number {
  const t = pol.land.divisions;
  let n = 0;
  for (let r = 0; r < t.rows; r++) {
    if (t.id[r] !== 0 && t.owner[r] === id) n += pol.land.strengthOf(r);
  }
  return n;
}

export function capitalRegion(pol: WwPolitics, id: number): number {
  const sc = pol.ww.scenario;
  return sc.regionAt(sc.capitalTile(pol.tagOf(id)));
}

/** Spec §6.1, §6.4: % of the legal victory points someone else controls. */
export function lostLegalVpPct(pol: WwPolitics, id: number): number {
  let all = 0;
  let lost = 0;
  for (const r of pol.ww.scenario.landRegions) {
    if (pol.legalOwner[r.id] !== id) continue;
    all += r.vp;
    if (pol.land.controller[r.id] !== id) lost += r.vp;
  }
  return all === 0 ? 0 : Math.floor((lost * 100) / all);
}

/** Whether a region `id` legally owns touches the sea (controller ruling, K1). */
export function isCoastal(pol: WwPolitics, id: number): boolean {
  return pol.ww.scenario.landRegions.some(
    (r) => r.coastal && pol.legalOwner[r.id] === id,
  );
}

function groupEvery(
  pol: WwPolitics,
  group: string,
  test: (r: number) => boolean,
): boolean {
  const g = pol.content.groupIdx.get(group);
  return g !== undefined && g.regions.length > 0 && g.regions.every(test);
}

function evalLeaf(ctx: EffectCtx, c: LeafCondition): boolean {
  const pol = ctx.pol;
  switch (c.kind) {
    case "always":
      return c.value;
    case "date_ge":
      return ctx.day >= dayOfDate(c.date);
    case "date_lt":
      return ctx.day < dayOfDate(c.date);
    case "historical_ai":
      return pol.mg.config().historicalAi();
    case "gflag":
      return pol.gflags.has(c.flag);
    case "wt_ge":
      return pol.wtBp >= c.pct * 100;
    default:
      break;
  }
  const id = c.who === undefined ? ctx.self : resolveSelector(ctx, c.who);
  if (id === 0) return false;
  if (c.kind === "exists") return pol.living(id);
  if (c.kind === "capitulated") return pol.ww.isCapitulated(id);
  if (!pol.living(id)) return false;
  const p = pol.country(id)!;
  const ce = pol.econ.country(id);
  const other = (s: Selector) => resolveSelector(ctx, s);
  switch (c.kind) {
    case "days_since_flag_ge": {
      const f = p.flags.get(c.flag);
      return f !== undefined && ctx.day - f[0] >= c.days;
    }
    case "tag":
      return pol.tagOf(id) === c.tag;
    case "is_major":
      return COUNTRIES[pol.tagOf(id)].major;
    case "is_ai":
      return !pol.isHuman(id);
    case "is_human":
      return pol.isHuman(id);
    case "ruling":
      return p.ruling === IDEOLOGIES.indexOf(c.ideology);
    case "pop_ge":
      return p.pop[IDEOLOGIES.indexOf(c.ideology)] >= c.pct * 100;
    case "stability_ge":
      return p.stabBp >= c.pct * 100;
    case "ws_ge":
      return p.wsBp >= c.pct * 100;
    case "lost_vp_ge":
      return lostLegalVpPct(pol, id) >= c.pct;
    case "pp_ge":
      return p.ppMilli >= c.amount * 1000;
    case "army_xp_ge":
      return (pol.land.country(id)?.armyXpMilli ?? 0) >= c.amount * 1000;
    case "has_spirit":
      return p.hasSpirit(c.id);
    case "focus_done": {
      const pos = pol.content.treePos.get(c.id);
      const fi = pol.content.focusIdx.get(c.id);
      return (
        pos !== undefined &&
        fi !== undefined &&
        pol.content.focuses[fi].tree === p.tree &&
        p.focusState[pos] !== 0
      );
    }
    case "focus_in_progress":
      return p.focus?.id === c.id;
    case "decision_taken":
      return p.taken.has(c.id);
    case "has_advisor":
      return p.advisors.includes(c.person);
    case "leader":
      return p.leader === c.person;
    case "flag":
      return p.hasFlag(c.flag, ctx.day);
    case "law":
      return ce?.laws[c.law] === c.value;
    case "law_ge": {
      const ladder = LAW_LADDERS[c.law];
      return (
        ce !== null && ladder.indexOf(ce.laws[c.law]) >= ladder.indexOf(c.value)
      );
    }
    case "has_tech":
      return ce?.researched.has(c.tech) ?? false;
    case "factories_ge":
      return ce !== null && ce.totals.civ + ce.totals.mil >= c.count;
    case "divisions_ge":
      return divisionCount(pol, id) >= c.count;
    case "strength_ratio_ge": {
      const o = other(c.vs);
      return (
        o !== 0 &&
        armyStrength(pol, id) * 1000 >=
          c.permille * Math.max(1, armyStrength(pol, o))
      );
    }
    case "owns_group":
      return groupEvery(pol, c.group, (r) => pol.legalOwner[r] === id);
    case "controls_group":
      return groupEvery(pol, c.group, (r) => pol.land.controller[r] === id);
    case "controls_capital_of": {
      const o = other(c.of);
      const r = o === 0 ? 0 : capitalRegion(pol, o);
      return r > 0 && pol.land.controller[r] === id;
    }
    case "neighbor_of":
      return pol.econ.countryNeighbours(id).includes(other(c.of));
    case "at_war":
      return pol.ww.hasWar(id);
    case "at_war_with":
      return pol.ww.isAtWar(id, other(c.of));
    case "war_days_ge":
      return pol.econ.warDays(id, ctx.tick) >= c.days;
    case "in_faction":
      return pol.factionIdx(id) >= 0;
    case "faction_leader":
      return pol.faction(pol.factionIdx(id))?.leader === id;
    case "same_faction":
      return pol.sameFaction(id, other(c.of));
    case "faction_ideology": {
      const f = pol.factionIdx(id);
      return (
        f >= 0 && pol.factionIdeology(f) === IDEOLOGIES.indexOf(c.ideology)
      );
    }
    case "has_war_goal_on":
      return pol.hasWarGoal(id, other(c.of));
    case "justifying_on":
      return p.justification !== null && p.justification.on === other(c.of);
    case "justified_against":
      return pol.list().some((x) => x.justification?.on === id);
    case "nap_with":
      return pol.isAtWarBlockedByNap(id, other(c.of));
    case "guarantees":
      return pol.guarantees.some((g) => g.by === id && g.to === other(c.of));
    case "guaranteed_by":
      return pol.guarantees.some((g) => g.to === id && g.by === other(c.of));
    case "has_access_from":
      return pol.hasAccess(id, other(c.of));
    case "threat_ge":
      return (pol.threatBp[other(c.of)] ?? 0) >= c.pct * 100;
    case "opinion_ge":
      return opinionOf(pol, id, other(c.of)) >= c.value;
    case "coastal":
      return isCoastal(pol, id);
    case "landlocked":
      return !isCoastal(pol, id);
    case "declared_by": {
      // `of` declared war on me and that war still runs (CountryPol.declaredOn).
      const o = other(c.of);
      return o !== 0 && (pol.country(o)?.declaredOn.includes(id) ?? false);
    }
    // P4 (plan decision 24).
    case "navy_size": {
      const t = pol.ww.navy.ships;
      const cls = c.cls === undefined ? -1 : SHIP_CLASSES.indexOf(c.cls);
      let n = 0;
      for (let r = 0; r < t.rows; r++) {
        if (
          t.id[r] !== 0 &&
          t.owner[r] === id &&
          (cls < 0 || t.cls[r] === cls)
        ) {
          n++;
        }
      }
      return n >= c.min;
    }
    case "fuel_ratio_below":
      return (pol.econ.country(id)?.fuelRatioPm ?? 1000) < c.pct * 10;
    default:
      return false;
  }
}
