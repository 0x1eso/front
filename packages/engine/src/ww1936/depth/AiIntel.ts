// P6 lane I (plan Task 5): the AI's intelligence (spec §19.5, plan
// decision 39). The AI reads true values (spec §8.1) but picks its
// operations through what its intel levels show (a facility to sabotage).
// History is a loose guide (owner, 2026-10-21): the majors' founding day
// is K5's table only with historical AI; otherwise a seeded day in the
// window, so games differ.
import {
  AGENCY_UPGRADE_CIVS,
  AGENCY_UPGRADES,
  AgencyUpgrade,
  ID_ARMY,
  ID_CIVIL,
  INTEL_MISSIONS,
  IntelOperation,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import {
  OPERATION_DEFS,
  upgradeBlock,
} from "@openfront/engine-lib/ww1936/IntelRules";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { foundAgency, startUpgrade } from "./Agency";
import {
  activateCrypto,
  decryptedFor,
  decryptedOwn,
  exploiting,
  setCryptoTarget,
} from "./Crypto";
import { COLLAB_MAX_PP, collabCutPp, startOperation } from "./Operations";
import {
  assignOperative,
  isFree,
  M_BUILD_NETWORK,
  M_COUNTER,
  recruitOperative,
  ST_CAPTURED,
  ST_MISSION,
  ST_OPERATION,
  ST_TRAVEL,
} from "./Operatives";
import type { Operative, WwDepth } from "./WwDepth";

/** The AI's founding jitter in the majors' window (like P4's P_AI_NAVY). */
export const P_AI_INTEL = idHash("ai_intel");
/** Spec §19.5: the majors' founding window. */
export const AI_FOUND_FROM = "1936-03-01";
export const AI_FOUND_TO = "1937-06-30";
/** Spec §19.5: a minor founds at this PP with dev ≥ 3. */
export const AI_MINOR_FOUND_PP = 150;
export const AI_MINOR_FOUND_DEV = 3;
/** Spec §19.5: the upgrade order; the rest follow in list order. */
export const AI_UPGRADE_ORDER: readonly AgencyUpgrade[] = [
  "ag_ops_1",
  "ag_crypto_1",
  "ag_army_dept",
  "ag_counter",
  "ag_ops_2",
  "ag_crypto_2",
  ...AGENCY_UPGRADES.filter(
    (u) =>
      ![
        "ag_ops_1",
        "ag_crypto_1",
        "ag_army_dept",
        "ag_counter",
        "ag_ops_2",
        "ag_crypto_2",
      ].includes(u),
  ),
];
/** 내 판단: an upgrade leaves the AI at least 3 civilian factories for its own building. */
export const AI_UPGRADE_FREE_CIVS = AGENCY_UPGRADE_CIVS + 3;
/** 내 판단: an operation leaves the AI this much PP for its politics. */
export const AI_OP_PP_SPARE = 25;
/** Spec §19.5: collaboration once the enemy is half-way to its surrender line. */
export const AI_COLLAB_GAUGE_PCT = 50;
/** Spec §19.5: a coup (historical AI off) needs my ideology at 45% in the target. */
export const AI_COUP_IDEOLOGY_BP = 4_500;
/** Spec §8.9: "close" (근사) civil intelligence shows a facility. */
const SEE_FACILITY_LEVEL = 50;

export function aiIntelDay(d: WwDepth, id: number, day: number): void {
  const c = d.country(id);
  if (c === null) return;
  let founded = false;
  if (!c.intel.agency) {
    if (!aiFound(d, id, day)) return;
    founded = true;
  }
  // Plan decision 39: daily at war, every 10 days at peace (spread by id).
  const atWar = d.ww.hasWar(id);
  if (!founded && !atWar && day % 10 !== id % 10) return;
  aiUpgrade(d, id);
  aiCrypto(d, id, day);
  aiOperatives(d, id, day);
}

// ---- founding ----

/** Spec §19.5: majors on their day (K5's AGENCY_STARTS, or a seeded day in the window), minors with PP and development. */
function aiFound(d: WwDepth, id: number, day: number): boolean {
  const ww = d.ww;
  const ce = ww.economy.country(id);
  const pc = ww.politics.country(id);
  if (ce === null || pc === null) return false;
  const pp = Math.floor(pc.ppMilli / 1000);
  if (ce.major) {
    if (day < foundDay(d, id)) return false;
  } else {
    const dev = ww.scenario.devOf(ce.tag, ce.totals.civ);
    if (pp < AI_MINOR_FOUND_PP || dev < AI_MINOR_FOUND_DEV) return false;
  }
  return foundAgency(d, id) === null;
}

/** A major's founding day. */
export function foundDay(d: WwDepth, id: number): number {
  const tag = d.ww.tagOf(id);
  if (d.ww.historicalAiNow()) {
    const row = d.ww.politics.content.agencyStarts.find((r) => r.tag === tag);
    if (row !== undefined) return dayOfDate(row.date);
  }
  const from = dayOfDate(AI_FOUND_FROM);
  const span = dayOfDate(AI_FOUND_TO) - from + 1;
  return from + (wwRoll(d.ww.politics.seed, P_AI_INTEL, id) % span);
}

// ---- upgrades ----

function aiUpgrade(d: WwDepth, id: number): void {
  const c = d.country(id)!;
  if (c.intel.upId >= 0) return;
  const ce = d.ww.economy.country(id);
  const freeCivs = Math.floor((ce?.totals.freeCivMilli ?? 0) / 1000);
  if (freeCivs < AI_UPGRADE_FREE_CIVS) return;
  for (const u of AI_UPGRADE_ORDER) {
    const block = upgradeBlock({
      agency: true,
      upgrades: c.intel.upgrades,
      upgrade: u,
      inProgress: false,
      computing1: ce?.researched.has("computing_1") ?? false,
      freeCivs,
    });
    if (block === null) {
      startUpgrade(d, id, u);
      return;
    }
  }
}

// ---- whom ----

function factories(d: WwDepth, t: number): number {
  const tt = d.ww.economy.country(t)?.totals;
  return tt === undefined ? 0 : tt.civ + tt.mil;
}

/** The largest (factories) country `id` is at war with; 0 none. */
export function biggestEnemy(d: WwDepth, id: number): number {
  let best = 0;
  for (const t of d.ww.enemiesOf(id)) {
    if (!d.ww.isActor(t)) continue;
    if (best === 0 || factories(d, t) > factories(d, best)) best = t;
  }
  return best;
}

/** Spec §19.5 "위협 1위": the most threatening country outside the faction (P3 threat), else the largest neighbour outside it. */
export function topThreat(d: WwDepth, id: number): number {
  const pol = d.ww.politics;
  let best = 0;
  let bestBp = 0;
  for (let t = 1; t < d.cap; t++) {
    if (t === id || !d.ww.isActor(t) || d.ww.sameFaction(id, t)) continue;
    const bp = pol.threatBp[t] ?? 0;
    if (bp > bestBp) {
      best = t;
      bestBp = bp;
    }
  }
  if (best > 0) return best;
  for (const t of d.ww.economy.countryNeighbours(id)) {
    if (!d.ww.isActor(t) || d.ww.sameFaction(id, t)) continue;
    if (best === 0 || factories(d, t) > factories(d, best)) best = t;
  }
  return best;
}

/** Spec §19.5: the country outside the faction with the most research, above mine; 0 none. */
export function techLeader(d: WwDepth, id: number): number {
  const econ = d.ww.economy;
  let best = 0;
  let most = econ.country(id)?.researched.size ?? 0;
  for (let t = 1; t < d.cap; t++) {
    if (t === id || !d.ww.isActor(t) || d.ww.sameFaction(id, t)) continue;
    const n = econ.country(t)?.researched.size ?? 0;
    if (n > most) {
      best = t;
      most = n;
    }
  }
  return best;
}

/** `t`'s lost legal victory points against its surrender line, percent (P0 §7.5's gauge input). */
export function surrenderProgressPct(d: WwDepth, t: number): number {
  const pol = d.ww.politics;
  const land = d.ww.land;
  let start = 0;
  let held = 0;
  for (const r of d.ww.scenario.landRegions) {
    if (pol.legalOwner[r.id] !== t) continue;
    start += r.vp;
    if (land.controller[r.id] === t) held += r.vp;
  }
  const line = start * pol.surrenderPct(t);
  if (line <= 0) return 0;
  return Math.floor(((start - held) * 100 * 100) / line);
}

// ---- cryptology ----

function battleWith(d: WwDepth, id: number, t: number): boolean {
  for (const b of d.ww.land.battles.values()) {
    if (
      (b.attLead === id && b.defLead === t) ||
      (b.attLead === t && b.defLead === id)
    ) {
      return true;
    }
  }
  return false;
}

/** Spec §19.5: break the largest enemy's codes (else the top threat's); exploit on a day of battle with it. */
function aiCrypto(d: WwDepth, id: number, day: number): void {
  const c = d.country(id)!;
  const enemy = biggestEnemy(d, id);
  const want = enemy > 0 ? enemy : topThreat(d, id);
  const cur = c.intel.cryptoTarget;
  if (
    want > 0 &&
    want !== cur &&
    (cur <= 0 ||
      !d.ww.isActor(cur) ||
      decryptedOwn(d, id, cur) ||
      (enemy > 0 && !d.ww.isAtWar(id, cur)))
  ) {
    setCryptoTarget(d, id, want);
  }
  for (const t of d.ww.enemiesOf(id)) {
    if (exploiting(d, id, t) || !decryptedFor(d, id, t)) continue;
    if (battleWith(d, id, t)) activateCrypto(d, id, t, day);
  }
}

// ---- operatives and operations ----

/** What an operative should be doing: a mission (target, mission) or null for operations. */
function roleOf(
  d: WwDepth,
  id: number,
  n: number,
): { target: number; mission: number } | null {
  const enemy = biggestEnemy(d, id);
  if (n === 0) {
    const t = enemy > 0 ? enemy : topThreat(d, id);
    return t > 0 ? { target: t, mission: M_BUILD_NETWORK } : null;
  }
  if (n === 1) {
    if (enemy > 0) return { target: id, mission: M_COUNTER };
    const leader = techLeader(d, id);
    const first = topThreat(d, id);
    return leader > 0 && leader !== first
      ? { target: leader, mission: M_BUILD_NETWORK }
      : null;
  }
  return null;
}

function doing(o: Operative, target: number, mission: number): boolean {
  return (
    (o.state === ST_MISSION || o.state === ST_TRAVEL) &&
    o.target === target &&
    o.mission === mission
  );
}

/** Spec §19.5: recruit to the slots; first a network on the top threat, second counter-intelligence at war, the rest operations. */
function aiOperatives(d: WwDepth, id: number, day: number): void {
  const c = d.country(id)!;
  // Every free slot (recruiting costs nothing).
  for (let n = 0; n < 4 && recruitOperative(d, id, day) === null; n++) {
    void n;
  }
  const ready = c.intel.operatives
    .filter((o) => o.recruitLeft === 0 && o.state !== ST_CAPTURED)
    .sort((a, b) => a.uid - b.uid);
  ready.forEach((o, n) => {
    if (o.state === ST_OPERATION) return;
    const role = roleOf(d, id, n);
    if (role === null) return;
    if (doing(o, role.target, role.mission)) return;
    assignOperative(
      d,
      id,
      {
        kind: "operative_assign",
        operative: o.uid,
        target: role.target,
        mission: INTEL_MISSIONS[role.mission],
      },
      day,
    );
  });
  const free = ready.filter((o, n) => isFree(o) && roleOf(d, id, n) === null);
  if (free.length > 0) aiOperation(d, id, free);
}

/** Spec §19.5: the operations in priority order; the first one the target allows starts. */
function aiOperation(d: WwDepth, id: number, free: Operative[]): void {
  const ww = d.ww;
  const c = d.country(id)!;
  const pp = Math.floor((ww.politics.country(id)?.ppMilli ?? 0) / 1000);
  const tick = d.mg.ticks();
  const tries: [IntelOperation, number][] = [];
  // A captive of mine first.
  for (const o of c.intel.operatives) {
    if (o.state === ST_CAPTURED) tries.push(["op_rescue", o.target]);
  }
  const enemy = biggestEnemy(d, id);
  if (enemy > 0) {
    if (
      !d.infiltrations.some(
        (x) => x[0] === id && x[1] === enemy && x[2] === ID_ARMY,
      )
    ) {
      tries.push(["op_infiltrate_army", enemy]);
    }
    if (c.intel.cryptoTarget === enemy && !decryptedOwn(d, id, enemy)) {
      tries.push(["op_capture_cipher", enemy]);
    }
    if (ww.endgame.isExile(id)) tries.push(["op_uprising", enemy]);
    const facility = (d.country(enemy)?.proj.running.length ?? 0) > 0;
    if (facility && d.intelOf(id, enemy, ID_CIVIL) >= SEE_FACILITY_LEVEL) {
      tries.push(["op_sabotage", enemy]);
    }
    if (
      collabCutPp(d, enemy) < COLLAB_MAX_PP &&
      surrenderProgressPct(d, enemy) >= AI_COLLAB_GAUGE_PCT
    ) {
      tries.push(["op_collaboration", enemy]);
    }
    tries.push(["op_sabotage", enemy]);
  } else {
    const leader = techLeader(d, id);
    if (leader > 0) tries.push(["op_steal_blueprints", leader]);
    // Spec §19.5: never with historical AI (no regime change history lacks).
    if (!ww.historicalAiNow()) {
      const me = ww.politics.country(id);
      for (const t of [topThreat(d, id), leader]) {
        const tc = ww.politics.country(t);
        if (t <= 0 || me === null || tc === null) continue;
        if (tc.ruling === me.ruling) continue;
        if ((tc.pop[me.ruling] ?? 0) >= AI_COUP_IDEOLOGY_BP) {
          tries.push(["op_coup", t]);
        }
      }
    }
  }
  for (const [op, t] of tries) {
    const def = OPERATION_DEFS[op];
    if (t <= 0 || free.length < def.operatives) continue;
    if (pp < def.pp + AI_OP_PP_SPARE) continue;
    const uids = free.slice(0, def.operatives).map((o) => o.uid);
    if (startOperation(d, id, op, t, uids, tick) === null) return;
  }
}
