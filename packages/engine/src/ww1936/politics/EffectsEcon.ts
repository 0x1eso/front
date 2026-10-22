// World War 1936 P3: the economy and military groups of effects (spec
// §10.4; plan decisions 12, 20, 21; controller rulings R17, R18). Region
// picks go through pickRegions; buildings appear at once (P1 addBuilding);
// men and equipment move through P1's stock (economy/Stock.ts). Nothing
// here charges army experience (P2's appointGeneral and saveTemplate do).
import {
  BuildingId,
  equipKey,
  EQUIPMENT_GENS,
  LEVEL_MAX,
  RESOURCE_COUNT,
  RESOURCE_IDS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_SLOTS,
  TemplateDef,
  WW_ARMY_XP_MAX_MILLI,
  WW_MAX_TEMPLATES,
} from "@openfront/engine-api/ww1936/LandTypes";
import type {
  Effect,
  RegionPick,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import {
  RESERVE_KEYS,
  WW_MAX_RESEARCH_BONUSES,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  genMixOf,
  templateBlock,
  templateStats,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import { receiveKey } from "../depth/DesignCopy";
import type { WwDepth } from "../depth/WwDepth";
import { usedSlots } from "../economy/Construction";
import { drawManpower, drawTemplateEquip } from "../economy/Stock";
import { capitalRegion, newTitledGeneralState } from "../land/LandStartRun";
import { removeGeneral, restoreGeneral } from "../land/PoliticsBridge";
import type { LandTemplate } from "../land/WwLand";
import { EffectCtx, makeCtx, resolveSelector } from "./Dispatch";
import { addSpirit, dmzRegions } from "./Spirits";
import type { WwPolitics } from "./WwPolitics";

/** Controller ruling R5: the research_slot effect gives at most two slots. */
export const WW_MAX_EXTRA_RESEARCH_SLOTS = 2;
/** Controller ruling R18: moved factories hold back production this long. */
export const WW_RELOCATION_DAYS = 60;

/** Free factory slots of a region (P1: built plus its controller's queue). */
function freeSlots(pol: WwPolitics, actor: number, region: number): number {
  const ce = pol.econ.country(actor);
  if (ce === null) return 0;
  const slots = pol.econ.regionSlots(region, ce.stats.slotPct);
  return Math.max(0, slots - usedSlots(pol.econ, region));
}

/** How many of `b` region `region` can still take from an effect. */
function room(
  pol: WwPolitics,
  actor: number,
  region: number,
  b: BuildingId,
): number {
  const econ = pol.econ;
  const max = LEVEL_MAX[b];
  if (max !== undefined) {
    if (
      b === "fort" &&
      (dmzRegions(pol, actor).includes(region) ||
        // P5 (spec §6.4): a peace treaty's demilitarised region.
        pol.ww.endgame.isDmz(region, actor))
    ) {
      return 0;
    }
    // P4 (spec §12.1): a naval base or a coastal fort needs a harbor zone.
    if (
      (b === "naval_base" || b === "coastal_fort") &&
      econ.scenario.harborOf(region) === 0
    ) {
      return 0;
    }
    return Math.max(0, max - econ.buildingArray(b)[region]);
  }
  if (econ.isOccupied(region)) return 0;
  if (b === "dock" && econ.scenario.region(region)?.coastal !== true) return 0;
  return freeSlots(pol, actor, region);
}

/**
 * Spec §10.4 RegionPick for `actor`, in pick order; fewer when fewer fit.
 * Every pick names regions `actor` controls now; `n` caps the count
 * further. Selectors resolve in `ctx` (the effect's) when given. Every
 * variant the DSL ships has its branch (controller ruling R17): a new one
 * fails to compile at the end.
 */
export function pickRegions(
  pol: WwPolitics,
  actor: number,
  pick: RegionPick,
  n?: number,
  ctx?: EffectCtx,
): number[] {
  const out = picked(pol, actor, pick, ctx);
  return n === undefined ? out : out.slice(0, n);
}

function picked(
  pol: WwPolitics,
  actor: number,
  pick: RegionPick,
  ctx: EffectCtx | undefined,
): number[] {
  const sc = pol.ww.scenario;
  const ctl = pol.land.controller;
  const mine = (r: number) => ctl[r] === actor;
  const held = () =>
    sc.landRegions.filter((r) => ctl[r.id] === actor).map((r) => r.id);
  // P1 AI order (spec §10.4): most free slots, then infrastructure, then id.
  const best = (ids: number[]) => {
    const free = new Map(ids.map((r) => [r, freeSlots(pol, actor, r)]));
    return ids.sort(
      (a, b) =>
        free.get(b)! - free.get(a)! ||
        pol.econ.infra[b] - pol.econ.infra[a] ||
        a - b,
    );
  };
  if (pick === "capital") {
    // P2's capital: the capital if held, else the most valuable region.
    const cap = capitalRegion(pol.land, actor);
    return cap === 0 ? [] : [cap];
  }
  if ("group" in pick) {
    return (pol.content.groupIdx.get(pick.group)?.regions ?? []).filter(mine);
  }
  if ("best" in pick) {
    const of =
      pick.of === undefined
        ? null
        : (pol.content.groupIdx.get(pick.of)?.regions ?? []);
    return best(held().filter((r) => of === null || of.includes(r))).slice(
      0,
      pick.best,
    );
  }
  if ("coreBest" in pick) {
    return best(
      held().filter((r) => pol.legalOwner[r] === actor && pol.isCore(r)),
    ).slice(0, pick.coreBest);
  }
  if ("borderWith" in pick) {
    let other = 0;
    if (pick.borderWith === "threat") {
      // The neighbour whose tension is the largest (ties: smaller id).
      let top = -1;
      for (const nb of pol.econ.countryNeighbours(actor)) {
        const t = pol.threatBp[nb] ?? 0;
        if (t > top) {
          top = t;
          other = nb;
        }
      }
    } else {
      const c = ctx ?? makeCtx(pol, actor, actor, 0, pol.mg.ticks());
      other = resolveSelector(c, pick.borderWith);
    }
    if (other === 0 || other === actor) return [];
    const vp = (r: number) => sc.region(r)?.vp ?? 0;
    return held()
      .filter((r) => sc.edgesOf(r).some((e) => ctl[e.to] === other))
      .sort((a, b) => vp(b) - vp(a) || a - b)
      .slice(0, pick.n);
  }
  if ("acquired" in pick) {
    const owners = sc.ownerByRegion();
    return best(
      held().filter((r) => pol.legalOwner[r] === actor && owners[r] !== actor),
    ).slice(0, pick.n);
  }
  if ("coastal" in pick) {
    return best(held().filter((r) => sc.region(r)?.coastal === true)).slice(
      0,
      pick.n,
    );
  }
  if ("withResources" in pick) {
    const total = new Map<number, number>();
    for (const r of held()) {
      let s = 0;
      for (let k = 0; k < RESOURCE_COUNT; k++) s += pol.econ.deposit(r, k);
      if (s > 0) total.set(r, s);
    }
    return [...total.keys()]
      .sort((a, b) => total.get(b)! - total.get(a)! || a - b)
      .slice(0, pick.withResources);
  }
  if ("regions" in pick) return [...new Set(pick.regions)].filter(mine);
  const unknown: never = pick;
  return unknown;
}

/**
 * Plan decision 20, controller ruling R17: a content template (content.
 * templates) joins `actor`'s templates with P2's checks (the techs, the
 * width, at most WW_MAX_TEMPLATES) and no army experience; named by its
 * key (ww1936.tpl.<id>). Null when refused; the same template when the
 * country has it already.
 */
export function unlockTemplate(
  pol: WwPolitics,
  actor: number,
  id: string,
): LandTemplate | null {
  const cl = pol.land.country(actor);
  const ce = pol.econ.country(actor);
  const t = pol.content.templates.find((x) => x.id === id);
  if (cl === null || ce === null || t === undefined) return null;
  const had = cl.templates.find((x) => x.key === id);
  if (had !== undefined) return had;
  if (cl.templates.length >= WW_MAX_TEMPLATES) return null;
  const def: TemplateDef = {
    name: "",
    battalions: [...t.battalions] as TemplateDef["battalions"],
    support: [...t.support] as TemplateDef["support"],
  };
  if (templateBlock(def, ce.researched, Infinity) !== null) return null;
  const tpl: LandTemplate = { id: cl.nextTemplateId++, key: id, def };
  cl.templates.push(tpl);
  pol.land.markCountry(actor);
  return tpl;
}

/** P5 lane E: the template id every country's basic infantry answers to. */
export const BASIC_INFANTRY = "infantry";

/** The template with the most infantry battalions (ties: the earliest); null when none has any. */
function basicInfantry(
  templates: readonly LandTemplate[],
): LandTemplate | null {
  let best: LandTemplate | null = null;
  let most = 0;
  for (const t of templates) {
    const n = t.def.battalions.filter((b) => b === "infantry").length;
    if (n > most) {
      best = t;
      most = n;
    }
  }
  return best;
}

/**
 * Spec §10.4 `divisions`: `count` divisions of the template (the country's
 * own by key, or a content template it unlocks) in a new army at the first
 * picked region, without training. Men and equipment come from the pool
 * and the stock as far as they go (a thin division when short); no men,
 * no more divisions.
 *
 * P5 lane E (the content lanes' gaps): template `infantry` is every
 * country's basic infantry — its own `infantry` (the P2 default's key),
 * else its template with the most infantry battalions (ties: the
 * earliest; Italy's binary, Japan's square, the Soviet rifle division).
 * An exile's `capital` is its host's capital region (spec §10.4: its
 * divisions stand there).
 */
function addDivisions(
  ctx: EffectCtx,
  actor: number,
  e: Extract<Effect, { kind: "divisions" }>,
): void {
  const pol = ctx.pol;
  const land = pol.land;
  const cl = land.country(actor);
  const ce = pol.econ.country(actor);
  if (cl === null || ce === null) return;
  const host = pol.ww.endgame.exileHost(actor);
  const region =
    e.where === "capital" && host > 0
      ? capitalRegion(land, host)
      : (pickRegions(pol, actor, e.where, 1, ctx)[0] ?? 0);
  if (region === 0) return;
  const tpl =
    cl.templates.find((t) => t.key === e.template) ??
    unlockTemplate(pol, actor, e.template) ??
    (e.template === BASIC_INFANTRY ? basicInfantry(cl.templates) : null);
  if (tpl === null) return;
  const army = land.newArmy(actor);
  if (army === null) return;
  for (let i = 0; i < e.count; i++) {
    const s = templateStats(
      tpl.def,
      ce.stats,
      genMixOf(new Array<number>(GROUND_SLOTS).fill(0)),
    );
    const men = Math.min(s.men, ce.manpower);
    if (men <= 0 || !drawManpower(ce, men)) break;
    const slots = new Array<number>(GROUND_SLOTS).fill(0);
    const ks = land.keyStatsOf(actor);
    drawTemplateEquip(ce, slots, s.need, ks);
    const full = templateStats(tpl.def, ce.stats, genMixOf(slots, ks), ks);
    land.spawnDivision(actor, tpl.id, region, army, men, slots, full.orgMilli);
  }
  if (army.divisions.length === 0) land.removeArmy(army.id);
}

/**
 * Spec §10.4 `move_buildings`, controller ruling R18: as many as the
 * picked regions hold and the destinations can take move at once; the
 * hidden spirit gen_relocating (fixed stats, content's) runs 60 days.
 */
function moveBuildings(
  ctx: EffectCtx,
  actor: number,
  e: Extract<Effect, { kind: "move_buildings" }>,
): void {
  const pol = ctx.pol;
  const econ = pol.econ;
  const arr = econ.buildingArray(e.building);
  const from = pickRegions(pol, actor, e.from, undefined, ctx);
  const to = pickRegions(pol, actor, e.to, undefined, ctx).filter(
    (r) => !from.includes(r),
  );
  let have = 0;
  for (const r of from) have += arr[r];
  const rooms = to.map((r) => room(pol, actor, r, e.building));
  let space = 0;
  for (const x of rooms) space += x;
  const n = Math.min(e.count, have, space);
  if (n <= 0) return;
  let left = n;
  for (const r of from) {
    const k = Math.min(left, arr[r]);
    if (k > 0) econ.addBuilding(r, e.building, -k);
    left -= k;
  }
  left = n;
  to.forEach((r, i) => {
    const k = Math.min(left, rooms[i]);
    if (k > 0) econ.addBuilding(r, e.building, k);
    left -= k;
  });
  addSpirit(pol, actor, "gen_relocating", WW_RELOCATION_DAYS, ctx.day);
}

export function applyEconEffect(
  ctx: EffectCtx,
  e: Effect,
  actor: number,
): void {
  const pol = ctx.pol;
  const econ = pol.econ;
  const land = pol.land;
  const c = pol.country(actor);
  const ce = econ.country(actor);
  if (c === null || ce === null) return;
  switch (e.kind) {
    case "build": {
      let left = e.count;
      for (const r of pickRegions(pol, actor, e.where, undefined, ctx)) {
        if (left <= 0) break;
        const k = Math.min(left, room(pol, actor, r, e.building));
        if (k > 0) econ.addBuilding(r, e.building, k);
        left -= k;
      }
      break;
    }
    case "infra":
    case "rail":
    case "fort":
      for (const r of pickRegions(pol, actor, e.where, undefined, ctx)) {
        const k = Math.min(e.amount, room(pol, actor, r, e.kind));
        if (k > 0) econ.addBuilding(r, e.kind, k);
      }
      break;
    case "resource": {
      const k = RESOURCE_IDS.indexOf(e.res);
      for (const r of pickRegions(pol, actor, e.where, undefined, ctx)) {
        const base = econ.scenario.region(r)!.res[k];
        const i = r * RESOURCE_COUNT + k;
        econ.resBonus[i] = Math.max(
          -base,
          Math.min(30_000, econ.resBonus[i] + e.amount),
        );
        econ.markRegionDirty(r);
      }
      break;
    }
    case "move_buildings":
      moveBuildings(ctx, actor, e);
      break;
    case "manpower": {
      const pct = e.recruitablePct ?? 0;
      const add =
        (e.amount ?? 0) + Math.floor((pct * ce.totals.recruitable) / 100);
      ce.manpower = Math.max(0, ce.manpower + add);
      break;
    }
    case "equipment": {
      const key = equipKey(e.type, e.gen);
      if (key >= 0) ce.stock[key] += e.count;
      break;
    }
    case "send_equipment": {
      const to = resolveSelector(ctx, e.to);
      const te = econ.country(to);
      if (to === actor || te === null || !pol.living(to)) return;
      // The oldest generation first.
      // P6 (lane E, spec §26): a design key becomes `to`'s copy of the design.
      const depth = pol.ww.depth as WwDepth | undefined;
      let left = e.count;
      for (let g = 1; g <= EQUIPMENT_GENS[e.type] && left > 0; g++) {
        const key = equipKey(e.type, g);
        const k = Math.min(left, ce.stock[key]);
        if (k <= 0) continue;
        ce.stock[key] -= k;
        const k2 =
          depth === undefined
            ? key
            : receiveKey(depth, actor, key, to, "received");
        if (k2 >= 0) te.stock[k2] += k;
        left -= k;
      }
      econ.markCountryDirty(to);
      break;
    }
    case "research_bonus": {
      const key = e.tech ?? e.branch;
      if (key === undefined) return;
      c.researchBonuses.push({ key, pct: e.pct, uses: e.uses });
      if (c.researchBonuses.length > WW_MAX_RESEARCH_BONUSES) {
        c.researchBonuses.shift();
      }
      break;
    }
    case "add_tech":
      if (ce.researched.has(e.tech)) return;
      // A slot researching it is free again (its progress is moot).
      ce.slots = ce.slots.map((s) => (s?.tech === e.tech ? null : s));
      ce.addTech(e.tech);
      break;
    case "research_slot":
      c.extraResearchSlots = Math.max(
        0,
        Math.min(WW_MAX_EXTRA_RESEARCH_SLOTS, c.extraResearchSlots + e.amount),
      );
      break;
    case "reserve":
      c.reserved[RESERVE_KEYS.indexOf(e.key)] += e.amount;
      break;
    case "army_xp": {
      const cl = land.country(actor);
      if (cl === null) return;
      cl.armyXpMilli = Math.max(
        0,
        Math.min(WW_ARMY_XP_MAX_MILLI, cl.armyXpMilli + e.amount * 1000),
      );
      land.markCountry(actor);
      break;
    }
    case "unlock_template":
      unlockTemplate(pol, actor, e.template);
      break;
    case "add_general": {
      if (e.general !== undefined) {
        restoreGeneral(land, e.general);
        break;
      }
      // Controller ruling R17: a titled general, no army experience paid.
      const cl = land.country(actor);
      if (cl === null) return;
      cl.generals.push(newTitledGeneralState(actor, cl.nextTitleNo++));
      land.markCountry(actor);
      break;
    }
    case "remove_general":
      removeGeneral(land, e.general);
      break;
    case "restore_general":
      restoreGeneral(land, e.general);
      land.markCountry(actor);
      break;
    case "divisions":
      addDivisions(ctx, actor, e);
      break;
    default:
      return;
  }
  econ.markCountryDirty(actor);
  pol.markCountry(actor);
}
