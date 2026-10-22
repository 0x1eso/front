// P6 lane I (plan Task 5): intelligence operations (spec §8.5) and the
// resistance table support_resistance, suppress_resistance and
// op_uprising write (pre-flight §0-8: WwDepth.resistBoost is state).
//
// WwDepth.ops rows: kind (INTEL_OPERATIONS index), owner, target, the
// operatives, startDay, endDay. A finished op_uprising stays as a row with
// no operatives for its 60 days (startDay = the day it finished), so the
// table keeps raising those regions.
import {
  DESIGN_KINDS,
  DesignKind,
  INTEL_OPERATIONS,
  IntelOperation,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  equipKey,
  EQUIPMENT_GENS,
  WW_TECH_IDS,
  WwOrderBlock,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { IDEOLOGIES } from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  P_INTEL_INFIL,
  P_INTEL_OP,
} from "@openfront/engine-lib/ww1936/DepthRules";
import {
  coupNeedBp,
  OPERATION_DEFS,
  operationDays,
  opStartBlock,
  OpStartInput,
  opSuccessPm,
} from "@openfront/engine-lib/ww1936/IntelRules";
import { wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { isRetiredTech, WW_TECHS } from "@openfront/engine-lib/ww1936/WwTechs";
import { damageBuilding, effectiveBuildings } from "../economy/Buildings";
import { drawEquip } from "../economy/Stock";
import { applyEffects, makeCtx } from "../politics/Dispatch";
import { payPp } from "../politics/PayPp";
import { addOpinion } from "../politics/Treaties";
import { addDecryptMilli } from "./Crypto";
import { copyDesignTo } from "./DesignCopy";
import {
  codenameId,
  counterHalfOf,
  counterMissions,
  exileOwnCore,
  goHome,
  hasUp,
  holdOperative,
  INTEL_OPINION_DAYS,
  isFree,
  M_SUPPORT_RES,
  M_SUPPRESS_RES,
  operativeOf,
  ST_CAPTURED,
  ST_MISSION,
  ST_OPERATION,
  statOf,
  SUPPORT_RES_NET_PM,
  validTarget,
} from "./Operatives";
import type { WwDepth, WwDepthState } from "./WwDepth";

type OpRow = WwDepthState["ops"][number];

const K = (op: IntelOperation) => INTEL_OPERATIONS.indexOf(op);
const OP_UPRISING = K("op_uprising");
/** The domain (ID_ARMY, ID_NAVY, ID_AIR) of each infiltration. */
const INFILTRATE_DOMAIN: ReadonlyMap<number, number> = new Map([
  [K("op_infiltrate_army"), 1],
  [K("op_infiltrate_navy"), 2],
  [K("op_infiltrate_air"), 3],
]);

/** Spec §8.5 op_infiltrate_*: a day's chance a counter-intelligence mission undoes it, milli‰ (0.5%). */
export const INFIL_LOSS_MILLI = 5_000;
/** Spec §8.5 op_collaboration: the cut per success and the cap per target, pp. */
export const COLLAB_PP = 10;
export const COLLAB_MAX_PP = 20;
/** Spec §8.5 op_sabotage: a project's progress lost (10% of the whole), milli; a factory region's damage. */
export const SABOTAGE_PROJECT_MILLI = 100_000;
export const SABOTAGE_DAMAGE_MILLI = 2_000;
/** Spec §8.5 op_coup: a failed coup's opinion. */
export const COUP_FAIL_OPINION = -50;
/** Spec §8.4–§8.5: the resistance table (pp) and its region bundle. */
export const RESIST_BUNDLE = 8;
export const SUPPORT_RES_PP = 10;
export const SUPPRESS_RES_PP = 5;
export const UPRISING_PP = 15;
export const UPRISING_DAYS = 60;

// ---- start ----

/** The idle operatives of `id` named in an order, or null when one is not idle (or named twice). */
function freeOperatives(
  d: WwDepth,
  id: number,
  uids: readonly number[],
): number[] | null {
  const c = d.country(id);
  if (c === null) return null;
  const out: number[] = [];
  for (const uid of uids) {
    const o = operativeOf(c, uid);
    if (o === undefined || !isFree(o) || out.includes(uid)) return null;
    out.push(uid);
  }
  return out;
}

function infantryHeld(d: WwDepth, id: number): number {
  const ce = d.ww.economy.country(id);
  if (ce === null) return 0;
  let n = 0;
  for (let g = 1; g <= EQUIPMENT_GENS.infantry_equipment; g++) {
    n += ce.stock[equipKey("infantry_equipment", g)];
  }
  return n;
}

/** Administered regions `t` controls that hold `owner`'s core (op_uprising's bundle source). */
function myCoresHeldBy(d: WwDepth, owner: number, t: number): number[] {
  const eg = d.ww.endgame;
  return eg.administeredOf(t).filter((r) => eg.hasCore(owner, r));
}

/** What opStartBlock judges, as the screens can see it (plan decision 40). */
export function opStartInputOf(
  d: WwDepth,
  id: number,
  op: IntelOperation,
  target: number,
  operativesFree: number,
): OpStartInput {
  const c = d.country(id);
  const pol = d.ww.politics;
  const me = pol.country(id);
  const tc = pol.country(target);
  return {
    agency: c?.intel.agency ?? false,
    op,
    networkPm: d.netPm(id, target),
    operativesFree,
    pp: Math.floor((me?.ppMilli ?? 0) / 1000),
    infEquipment: infantryHeld(d, id),
    atWar: d.ww.isAtWar(id, target),
    targetHasCaptive: (c?.intel.operatives ?? []).some(
      (o) => o.state === ST_CAPTURED && o.target === target,
    ),
    targetControlsMyCore: myCoresHeldBy(d, id, target).length > 0,
    ideologyBp: me === null || tc === null ? 0 : tc.pop[me.ruling],
    targetStabilityBp: tc?.stabBp ?? 0,
    halfThreshold: op === "op_uprising" && exileOwnCore(d, id, target),
  };
}

/** operation_start (spec §8.5): costs paid, the operatives go, the day it ends. */
export function startOperation(
  d: WwDepth,
  id: number,
  op: IntelOperation,
  target: number,
  operatives: readonly number[],
  tick: number,
): WwOrderBlock | null {
  const c = d.country(id);
  if (c === null || !c.intel.agency) return "no_agency";
  if (!validTarget(d, id, target) || !d.ww.isActor(target)) {
    return "bad_target";
  }
  const def = OPERATION_DEFS[op];
  const free = freeOperatives(d, id, operatives);
  if (free === null || free.length !== def.operatives) return "no_operative";
  const block = opStartBlock(opStartInputOf(d, id, op, target, free.length));
  if (block !== null) return block;
  if (!payPp(d.ww.politics, id, def.pp)) return "no_pp";
  const ce = d.ww.economy.country(id);
  if (ce !== null && def.infEquipment > 0) {
    let want = def.infEquipment;
    for (let g = EQUIPMENT_GENS.infantry_equipment; g >= 1 && want > 0; g--) {
      want -= drawEquip(ce, equipKey("infantry_equipment", g), want);
    }
    d.ww.economy.markCountryDirty(id);
  }
  d.ww.politics.markCountry(id);
  const day = d.ww.day(tick);
  const uid = d.uid();
  const days = operationDays(
    op,
    hasUp(c, "ag_army_dept"),
    hasUp(c, "ag_special_ops"),
    statOf(d, id, "opSpeedPct"),
  );
  d.ops.push({
    uid,
    kind: K(op),
    owner: id,
    target,
    operatives: [...free],
    startDay: day,
    endDay: day + days,
  });
  for (const u of free) {
    const o = operativeOf(c, u)!;
    o.state = ST_OPERATION;
    o.target = target;
    o.op = uid;
    o.mission = -1;
    o.sinceDay = day;
  }
  d.markCountry(id);
  return null;
}

/** operation_cancel: the operation ends now, its cost spent; the operatives come home. */
export function cancelOperation(
  d: WwDepth,
  id: number,
  uid: number,
): WwOrderBlock | null {
  const c = d.country(id);
  if (c === null || !c.intel.agency) return "no_agency";
  const row = d.ops.find((x) => x.uid === uid && x.owner === id);
  if (row === undefined || row.operatives.length === 0) return "bad_index";
  d.ops.splice(d.ops.indexOf(row), 1);
  for (const o of c.intel.operatives) {
    if (o.state === ST_OPERATION && o.op === uid) goHome(o);
  }
  d.markCountry(id);
  return null;
}

// ---- the day ----

/**
 * Spec §8.5, on the owner's turn: infiltrations a counter-intelligence
 * mission undoes, then the operations whose day has come (uid order), then
 * the uprisings' 60 days.
 */
export function dailyOperations(d: WwDepth, id: number, day: number): void {
  const seed = d.ww.politics.seed;
  // The infiltration row has no uid: the roll takes (owner, target) and the domain.
  const before = d.infiltrations.length;
  d.infiltrations = d.infiltrations.filter(
    ([o, t, dom]) =>
      o !== id ||
      counterMissions(d, t) === 0 ||
      wwRoll(seed, P_INTEL_INFIL, o * 1024 + t, day, dom) % 1_000_000 >=
        INFIL_LOSS_MILLI,
  );
  if (d.infiltrations.length !== before) d.markIntel(id);
  const due = d.ops.filter((x) => x.owner === id && day >= x.endDay);
  for (const row of due) {
    if (row.operatives.length === 0) {
      d.ops.splice(d.ops.indexOf(row), 1);
      continue;
    }
    if (!d.ops.includes(row)) continue;
    finishOperation(d, row, day);
  }
}

function finishOperation(d: WwDepth, row: OpRow, day: number): void {
  const id = row.owner;
  const t = row.target;
  const c = d.country(id)!;
  const op = INTEL_OPERATIONS[row.kind];
  const tick = d.mg.ticks();
  const opers = row.operatives
    .map((u) => operativeOf(c, u))
    .filter((o) => o !== undefined);
  let ok = true;
  let tellTarget = false;
  let keep = false;
  switch (op) {
    case "op_infiltrate_army":
    case "op_infiltrate_navy":
    case "op_infiltrate_air": {
      const dom = INFILTRATE_DOMAIN.get(row.kind)!;
      if (
        !d.infiltrations.some((x) => x[0] === id && x[1] === t && x[2] === dom)
      ) {
        d.infiltrations.push([id, t, dom]);
      }
      d.markIntel(id);
      break;
    }
    case "op_steal_blueprints":
      stealBlueprints(d, id, t, tick);
      break;
    case "op_capture_cipher":
      addDecryptMilli(d, id, t, 500_000);
      break;
    case "op_sabotage":
      sabotage(d, t);
      break;
    case "op_collaboration": {
      tellTarget = true;
      ok = rollSuccess(d, id, row);
      if (ok) {
        const has = collabCutPp(d, t);
        const add = Math.min(COLLAB_PP, COLLAB_MAX_PP - has);
        if (add > 0) addCollab(d, id, t, add);
      }
      break;
    }
    case "op_coup": {
      tellTarget = true;
      const pol = d.ww.politics;
      const me = pol.country(id);
      const tc = pol.country(t);
      ok =
        me !== null &&
        tc !== null &&
        tc.pop[me.ruling] >= coupNeedBp(tc.stabBp) &&
        rollSuccess(d, id, row);
      if (ok) {
        const ctx = makeCtx(pol, id, id, t, tick);
        applyEffects(ctx, [
          {
            kind: "set_government",
            who: "target",
            ideology: IDEOLOGIES[me!.ruling],
          },
          { kind: "fire_event", id: "gen_coup_done", to: "target" },
        ]);
      } else {
        // Spec §8.5: both operatives are caught, relations −50.
        for (const o of opers) holdOperative(d, id, o, day, 0);
        addOpinion(pol, id, t, COUP_FAIL_OPINION, INTEL_OPINION_DAYS);
        pol.markCountry(id);
        pol.markCountry(t);
      }
      break;
    }
    case "op_rescue": {
      const held = c.intel.operatives
        .filter((o) => o.state === ST_CAPTURED && o.target === t)
        .sort((a, b) => a.uid - b.uid)[0];
      if (held !== undefined) {
        goHome(held);
        held.sinceDay = day;
        d.message(id, "ww1936_operative_released", {
          codename: codenameId(held.codename),
          countryTag: d.ww.tagOf(t),
        });
      }
      break;
    }
    case "op_uprising":
      keep = true;
      break;
  }
  for (const o of opers) {
    if (o.state === ST_OPERATION && o.op === row.uid) {
      goHome(o);
      o.sinceDay = day;
    }
  }
  const i = d.ops.indexOf(row);
  if (keep) {
    row.operatives = [];
    row.startDay = day;
    row.endDay = day + UPRISING_DAYS;
  } else if (i >= 0) {
    d.ops.splice(i, 1);
  }
  const params = { countryTag: d.ww.tagOf(t), op };
  const key = ok ? "ww1936_operation_done" : "ww1936_operation_failed";
  d.message(id, key, params);
  if (tellTarget) {
    d.message(t, key, params);
    d.markCountry(t);
  }
  d.markCountry(id);
}

/** Spec §8.5 (pre-flight §A13): the success roll of collaboration and the coup, milli‰. */
function rollSuccess(d: WwDepth, id: number, row: OpRow): boolean {
  const pm = operationSuccessPm(d, id, row);
  return (
    wwRoll(d.ww.politics.seed, P_INTEL_OP, row.uid) % 1_000_000 < pm * 1000
  );
}

/**
 * Spec §8.5 op_steal_blueprints: a research bonus of 100% once for the
 * earliest tech (year, then id) the target has and the owner does not;
 * the target's newest saved design (savedDay; ties tank, plane, ship,
 * then the slot) copied as captured (lane E's copyDesignTo).
 */
function stealBlueprints(
  d: WwDepth,
  id: number,
  t: number,
  tick: number,
): void {
  const mine = d.ww.economy.country(id)?.researched;
  const theirs = d.ww.economy.country(t)?.researched;
  if (mine !== undefined && theirs !== undefined) {
    let best: WwTechId | null = null;
    for (const tech of WW_TECH_IDS) {
      if (!theirs.has(tech) || mine.has(tech) || isRetiredTech(tech)) continue;
      if (
        best === null ||
        WW_TECHS[tech].year < WW_TECHS[best].year ||
        (WW_TECHS[tech].year === WW_TECHS[best].year && tech < best)
      ) {
        best = tech;
      }
    }
    if (best !== null) {
      applyEffects(makeCtx(d.ww.politics, id, id, t, tick), [
        { kind: "research_bonus", tech: best, pct: 100, uses: 1 },
      ]);
    }
  }
  const tc = d.country(t);
  if (tc === null) return;
  let kind: DesignKind | null = null;
  let slot = 0;
  let saved = 0;
  for (const k of DESIGN_KINDS) {
    const slots = tc.des[k];
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (s === null || (kind !== null && s.savedDay <= saved)) continue;
      kind = k;
      slot = i + 1;
      saved = s.savedDay;
    }
  }
  if (kind !== null) copyDesignTo(d, t, slot, kind, id, "captured");
}

/**
 * Spec §8.5 op_sabotage: a running project of the target loses 10% (lane
 * S's proj.running[0]); else its region with the most working military
 * factories (ties: the lower id; never a no-strike region) takes 2,000
 * milli of bomb damage on them (two factories stop).
 */
function sabotage(d: WwDepth, t: number): void {
  const run = d.country(t)?.proj.running[0];
  if (run !== undefined) {
    run.progressMilli = Math.max(0, run.progressMilli - SABOTAGE_PROJECT_MILLI);
    d.markCountry(t);
    return;
  }
  const econ = d.ww.economy;
  let best = 0;
  let most = 0;
  for (const r of [...econ.regionsOf(t)].sort((a, b) => a - b)) {
    if (d.noStrike(r)) continue;
    const n = effectiveBuildings(econ, r, "mil");
    if (n > most) {
      most = n;
      best = r;
    }
  }
  if (best > 0) {
    damageBuilding(econ, best, "mil", SABOTAGE_DAMAGE_MILLI);
    econ.markCountryDirty(t);
  }
}

function addCollab(d: WwDepth, id: number, t: number, pp: number): void {
  const c = d.country(id);
  if (c === null) return;
  const rec = c.intel.collabPp.find((x) => x[0] === t);
  if (rec === undefined) {
    c.intel.collabPp.push([t, pp]);
    c.intel.collabPp.sort((a, b) => a[0] - b[0]);
  } else {
    rec[1] += pp;
  }
  d.ww.politics.markCountry(t);
}

/** op_collaboration's cut of the target's surrender line, pp (every country's, at most 20; to the game's end). */
export function collabCutPp(d: WwDepth, id: number): number {
  let n = 0;
  for (let o = 1; o < d.countries.length; o++) {
    const c = d.countries[o];
    if (c === null || c === undefined) continue;
    for (const [t, pp] of c.intel.collabPp) if (t === id) n += pp;
  }
  return Math.min(COLLAB_MAX_PP, n);
}

/** support_resistance / op_uprising: the resistance target added in an occupied region, percentage points. */
export function intelResistancePp(d: WwDepth, region: number): number {
  const i = d.resistBoostIndex.get(region);
  return i === undefined ? 0 : (d.resistBoost[i]?.[1] ?? 0);
}

/**
 * Review E6: an operation's success chance, ‰ (spec §8.5 opSuccessPm):
 * the owner's network on the target, its operatives' average skill, the
 * civil department and the target's counter-intelligence.
 */
export function operationSuccessPm(
  d: WwDepth,
  id: number,
  op: { target: number; operatives: readonly number[] },
): number {
  const c = d.country(id);
  const ops = c?.intel.operatives ?? [];
  let skill = 0;
  let n = 0;
  for (const uid of op.operatives) {
    const o = ops.find((x) => x.uid === uid);
    if (o === undefined) continue;
    skill += o.skill;
    n++;
  }
  const avgSkillMilli = n === 0 ? 1000 : Math.floor((skill * 1000) / n);
  return opSuccessPm(
    d.netPm(id, op.target),
    avgSkillMilli,
    hasUp(c, "ag_civil_dept"),
    counterHalfOf(d, op.target),
  );
}

// ---- the resistance table (pre-flight §0-8: state) ----

/** The bundle: `regions` by resistance (high first), then id; at most 8. */
function bundle(d: WwDepth, regions: readonly number[]): number[] {
  const res = d.ww.endgame.resBp;
  return [...regions]
    .sort((a, b) => res[b] - res[a] || a - b)
    .slice(0, RESIST_BUNDLE);
}

/**
 * Spec §8.4–§8.5: support_resistance (+10pp × skill / 3 on the target's 8
 * most resisting administered regions, ×1.5 for an exile or the core's
 * holder; network ≥ 200‰, 100‰ for an exile at its own cores),
 * suppress_resistance (−5pp × skill / 3 on the owner's administered
 * regions) and the uprisings (+15pp, 60 days). Rebuilt from state at most
 * once a tick (WwDepth.resistBoost and its index): only administered
 * regions ever get a row, so Korea and Taiwan never do (plan decision 33).
 */
export function rebuildResistBoost(d: WwDepth): void {
  const eg = d.ww.endgame;
  const add = new Map<number, number>();
  const put = (r: number, pp: number) => add.set(r, (add.get(r) ?? 0) + pp);
  for (let id = 1; id < d.countries.length; id++) {
    const c = d.countries[id];
    if (c === null || c === undefined || c.intel.operatives.length === 0) {
      continue;
    }
    for (const o of c.intel.operatives) {
      if (o.state !== ST_MISSION) continue;
      if (o.mission === M_SUPPORT_RES && o.target !== id) {
        const exile = exileOwnCore(d, id, o.target);
        const need = exile
          ? Math.floor(SUPPORT_RES_NET_PM / 2)
          : SUPPORT_RES_NET_PM;
        if (d.netPm(id, o.target) < need) continue;
        for (const r of bundle(d, eg.administeredOf(o.target))) {
          const strong = eg.isExile(id) || eg.hasCore(id, r);
          put(r, Math.floor((SUPPORT_RES_PP * o.skill * (strong ? 3 : 2)) / 6));
        }
      } else if (o.mission === M_SUPPRESS_RES && o.target === id) {
        const pp = Math.floor((SUPPRESS_RES_PP * o.skill) / 3);
        if (pp > 0) for (const r of eg.administeredOf(id)) put(r, -pp);
      }
    }
  }
  const today = d.lastCommonDay;
  for (const row of d.ops) {
    if (row.kind !== OP_UPRISING || row.operatives.length > 0) continue;
    if (today >= row.endDay) continue;
    for (const r of bundle(d, myCoresHeldBy(d, row.owner, row.target))) {
      put(r, UPRISING_PP);
    }
  }
  const next = [...add.entries()]
    .filter(([, pp]) => pp !== 0)
    .sort((a, b) => a[0] - b[0]);
  const cur = d.resistBoost;
  if (
    next.length === cur.length &&
    next.every(([r, pp], i) => cur[i][0] === r && cur[i][1] === pp)
  ) {
    return;
  }
  d.resistBoost = next.map(([r, pp]) => [r, pp]);
  d.reindexSparse();
}
