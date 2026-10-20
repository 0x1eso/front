// World War 1936 P2: battles, retreats, overruns, org recovery and
// entrenchment (P2 spec §9, §5.5). One battle a defending region; every
// tick one round of every battle, in region order (spec §2.2-5). Integer
// arithmetic only, no randomness (plan decision 6).
import {
  CombatMods,
  MOVE_ADVANCE,
  MOVE_NONE,
  MOVE_RAIL,
  MOVE_RETREAT,
  MOVE_SEA,
  MOVE_WALK,
  ROLE_ATTACK,
  ROLE_DEFEND,
  ROLE_NONE,
  TPL_HOSPITAL,
  TPL_SIGNAL,
  traitBit,
  WW_ROUND_HOUR_MILLI,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  applyBp,
  attackValue,
  combatWidth,
  divisionMods,
  entrenchMax,
  excessWidthBp,
  ModInput,
  ModResult,
  roundDamage,
  roundHits,
} from "@openfront/engine-lib/ww1936/CombatRules";
import { techTotals } from "@openfront/engine-lib/ww1936/WwTechs";
import { returnManpower } from "../economy/Stock";
import { generalOf } from "./GeneralsRun";
import { startHopInto, stopDivision } from "./Movement";
import { capture } from "./Occupation";
import { Battle, SPREAD_BATTLE, SPREAD_REVERT, type WwLand } from "./WwLand";

const DESTROYED_KEY = "events_display.ww1936_divisions_destroyed" as const;

/**
 * Destructions of one battle round, told once per owner (spec §9.6,
 * §15.8: once to the owner and once to the opponent). Set only while a
 * round applies its damage (fight), so nothing outlives the call.
 */
interface DestroyedSink {
  battle: Battle;
  counts: Map<number, number>;
}
let sink: DestroyedSink | null = null;

/** The other side's lead country of the division's battle; 0 when none. */
function opponentOf(land: WwLand, row: number): number {
  const b = land.battles.get(land.divisions.battle[row]);
  if (b === undefined) return 0;
  return land.divisions.role[row] === ROLE_ATTACK ? b.defLead : b.attLead;
}

function noteDestroyed(
  land: WwLand,
  owner: number,
  region: number,
  opponent: number,
): void {
  if (sink !== null) {
    sink.counts.set(owner, (sink.counts.get(owner) ?? 0) + 1);
    return;
  }
  land.message(owner, DESTROYED_KEY, { count: 1, region });
  if (opponent > 0 && opponent !== owner) {
    land.message(opponent, DESTROYED_KEY, { count: 1, region });
  }
}

function flushDestroyed(land: WwLand, s: DestroyedSink): void {
  const b = s.battle;
  for (const [owner, count] of [...s.counts].sort((x, y) => x[0] - y[0])) {
    const opponent = land.sameSide(owner, b.attLead) ? b.defLead : b.attLead;
    land.message(owner, DESTROYED_KEY, { count, region: b.region });
    if (opponent > 0 && opponent !== owner) {
      land.message(opponent, DESTROYED_KEY, { count, region: b.region });
    }
  }
}

/** Spec §9.1: `div` attacks `region` from next door (or inside it, after a paradrop: decision 19). */
export function joinBattle(land: WwLand, div: number, region: number): void {
  const t = land.divisions;
  const r = t.rowOf(div);
  if (r < 0 || t.org[r] <= 0) return;
  const m = t.mode[r];
  if (m === MOVE_RETREAT || m === MOVE_RAIL || m === MOVE_SEA) return;
  const owner = t.owner[r];
  if (!land.isEnemy(owner, land.controller[region])) return;
  const at = t.region[r];
  if (at !== region && land.scenario.edgeBetween(at, region) < 0) return;
  // Its own region is under attack: it defends there (spec §9.1).
  if (at !== region && land.battles.has(at)) return;
  let b = land.battles.get(region);
  if (b === undefined) {
    b = {
      region,
      sinceTick: land.mg.ticks(),
      round: 0,
      attackers: [],
      defenders: [],
      attLine: [],
      defLine: [],
      startOrgMilli: 0,
      lostOrgMilli: 0,
      attLead: owner,
      defLead: land.controller[region],
    };
    land.addBattle(b);
  }
  if (t.battle[r] !== 0 && t.battle[r] !== region) release(land, r);
  if (m === MOVE_WALK || m === MOVE_ADVANCE) stopDivision(land, r);
  t.battle[r] = region;
  t.role[r] = ROLE_ATTACK;
  land.markArmy(t.army[r]);
  if (!b.attackers.includes(div)) {
    b.attackers.push(div);
    b.attackers.sort((x, y) => x - y);
  }
}

/** Every running battle, one round, by region (spec §9.3). */
export function stepBattles(land: WwLand, tick: number): void {
  for (const region of [...land.battles.keys()].sort((a, b) => a - b)) {
    const b = land.battles.get(region);
    if (b !== undefined) fight(land, b, tick);
  }
}

function fight(land: WwLand, b: Battle, tick: number): void {
  const t = land.divisions;
  const R = b.region;
  const ctrl = land.controller[R];
  // 1. Attackers still in it: alive, org > 0, at war, next door (or inside), not defending at home.
  b.attackers = b.attackers.filter((id) => {
    const r = t.rowOf(id);
    if (r < 0) return false;
    if (t.battle[r] !== R || t.role[r] !== ROLE_ATTACK) {
      // Taken out of it elsewhere (army_execute off sets the role to 0).
      if (t.battle[r] === R) clearRole(land, r);
      return false;
    }
    const at = t.region[r];
    const ok =
      t.org[r] > 0 &&
      t.mode[r] !== MOVE_RETREAT &&
      land.isEnemy(t.owner[r], ctrl) &&
      (at === R ||
        (land.scenario.edgeBetween(at, R) >= 0 && !land.battles.has(at)));
    if (!ok) release(land, r);
    return ok;
  });
  const attackerOwners = [
    ...new Set(b.attackers.map((id) => t.owner[t.rowOf(id)])),
  ];
  // 2. Defenders: in R, standing or walking, at war with every attacking
  // country. A division of R attacking a neighbour leaves that attack to
  // defend here (spec §9.1); a paradropped attacker inside R does not defend.
  const before = new Set(b.defenders);
  const defenders: number[] = [];
  if (attackerOwners.length > 0) {
    for (const r of [...land.rowsIn(R)]) {
      // Moving out (retreat, advance) or away by rail or sea: not in its
      // departure region's fight (spec §7.4, §9.5, §9.7).
      const m = t.mode[r];
      if (
        m === MOVE_RETREAT ||
        m === MOVE_ADVANCE ||
        m === MOVE_RAIL ||
        m === MOVE_SEA
      ) {
        continue;
      }
      if (t.role[r] === ROLE_ATTACK && t.battle[r] === R) continue;
      if (!attackerOwners.every((o) => land.isEnemy(o, t.owner[r]))) continue;
      if (t.role[r] === ROLE_ATTACK) release(land, r);
      const id = t.id[r];
      if (!before.has(id)) b.startOrgMilli += t.org[r];
      if (t.battle[r] !== R || t.role[r] !== ROLE_DEFEND) {
        t.battle[r] = R;
        t.role[r] = ROLE_DEFEND;
        land.markArmy(t.army[r]);
      }
      defenders.push(id);
    }
  }
  // Former defenders no longer in it (gone elsewhere, out of the war).
  for (const id of before) {
    const r = t.rowOf(id);
    if (r >= 0 && t.battle[r] === R && !defenders.includes(id)) {
      clearRole(land, r);
    }
  }
  b.defenders = defenders;
  if (b.attackers.length === 0) return endDefended(land, b);
  if (b.defenders.length === 0) return won(land, b, tick);
  b.round++;
  const day = land.day();
  // 3. Width and the lines (spec §9.2).
  const dirs = new Set(b.attackers.map((id) => t.region[t.rowOf(id)])).size;
  const width = combatWidth(
    land.scenario.landOf(R),
    Math.min(4, Math.max(1, dirs)),
  );
  const att = lineUp(land, b.attackers, b.attLine, width, b.round === 1);
  const def = lineUp(land, b.defenders, b.defLine, width, b.round === 1);
  b.attLine = att.line;
  b.defLine = def.line;
  // Pre-flight C4: the attackers' colour is the widest country in line.
  b.attLead = widestOwner(land, att.line, b.attLead);
  b.defLead = ctrl;
  ensureBattleSpread(land, b);
  // 4. Every hit of the round first, then all of them at once (spec §9.3-6).
  const org = new Map<number, number>();
  const hp = new Map<number, number>();
  const hit = (
    from: number,
    fromMods: CombatMods,
    to: number,
    toMods: CombatMods,
    toDefends: boolean,
    excess: number,
  ) => {
    const s = land.statsOf(from);
    const ts = land.statsOf(to);
    const a = applyBp(
      applyBp(attackValue(s.soft, s.hard, ts.hardnessPm), fromMods.attackBp),
      10_000 + excess,
    );
    const d = applyBp(toDefends ? ts.def : ts.brk, toMods.defenseBp);
    const dmg = roundDamage(roundHits(a, d), ts.armor > s.pierce);
    org.set(to, (org.get(to) ?? 0) + dmg.orgMilli);
    hp.set(to, (hp.get(to) ?? 0) + dmg.hpMilli);
  };
  const mods = new Map<number, CombatMods>();
  for (const r of [...att.active, ...def.active]) {
    mods.set(r, battleMods(land, b, r).mods);
  }
  if (def.active.length > 0) {
    att.active.forEach((r, i) => {
      const target = def.active[(i + b.round) % def.active.length];
      hit(r, mods.get(r)!, target, mods.get(target)!, true, att.excessBp);
    });
  }
  if (att.active.length > 0) {
    def.active.forEach((r, i) => {
      const target = att.active[(i + b.round) % att.active.length];
      hit(r, mods.get(r)!, target, mods.get(target)!, false, def.excessBp);
    });
  }
  const destroyed: DestroyedSink = { battle: b, counts: new Map() };
  sink = destroyed;
  try {
    for (const [r, o] of [...org].sort((x, y) => x[0] - y[0])) {
      const was = t.org[r];
      t.org[r] = Math.max(0, was - o);
      if (t.role[r] === ROLE_DEFEND) b.lostOrgMilli += was - t.org[r];
      land.markArmy(t.army[r]);
      applyHpLoss(land, r, hp.get(r) ?? 0);
    }
    for (const r of [...att.active, ...def.active]) {
      if (t.id[r] !== 0) t.lastFight[r] = day;
    }
    // 5. Zero org: defenders retreat (or die), attackers drop out (spec §9.3-7).
    for (const id of [...b.defenders]) {
      const r = t.rowOf(id);
      if (r >= 0 && t.org[r] === 0) retreatDivision(land, r);
    }
  } finally {
    sink = null;
  }
  flushDestroyed(land, destroyed);
  for (const id of [...b.attackers]) {
    const r = t.rowOf(id);
    if (r >= 0 && t.org[r] === 0) release(land, r);
  }
  if (
    b.defenders.every((id) => {
      const r = t.rowOf(id);
      return r < 0 || t.mode[r] === MOVE_RETREAT;
    })
  ) {
    won(land, b, tick);
  }
}

interface LineUp {
  /** Ids in line, in line order. */
  line: number[];
  /** Rows that hit (and are hit) this round. */
  active: number[];
  excessBp: number;
}

/**
 * Spec §9.2: divisions with org > 0, not retreating, until the width is
 * full: last round's line first (in its order), then the reserves by
 * highest org (ties: smaller id), so a reserve steps in when width frees
 * up. The first that does not fit still stands when a third of its width
 * is left (the side pays the excess); the rest wait. A newcomer to the
 * line fights from the next round (with a signal company at once); in the
 * first round every one in line fights.
 */
function lineUp(
  land: WwLand,
  ids: readonly number[],
  previous: readonly number[],
  width: number,
  first: boolean,
): LineUp {
  const t = land.divisions;
  const prev = new Set(previous);
  const able = (r: number) =>
    r >= 0 && t.org[r] > 0 && t.mode[r] !== MOVE_RETREAT;
  const member = new Set(ids);
  const cands: number[] = [];
  for (const id of previous) {
    const r = t.rowOf(id);
    if (member.has(id) && able(r)) cands.push(r);
  }
  const reserves: number[] = [];
  for (const id of ids) {
    const r = t.rowOf(id);
    if (!prev.has(id) && able(r)) reserves.push(r);
  }
  reserves.sort((a, b) => t.org[b] - t.org[a] || t.id[a] - t.id[b]);
  cands.push(...reserves);
  const line: number[] = [];
  const active: number[] = [];
  let used = 0;
  for (const r of cands) {
    const w = land.widthOf(r);
    const over = used + w > width;
    if (!over || (width - used) * 3 >= w) {
      line.push(t.id[r]);
      used += w;
      if (first || prev.has(t.id[r]) || (land.flagsOf(r) & TPL_SIGNAL) !== 0) {
        active.push(r);
      }
    }
    if (over) break;
  }
  return { line, active, excessBp: excessWidthBp(used, width) };
}

/** The country with the most width in line (ties: smaller smallID); `keep` when the line is empty. */
function widestOwner(
  land: WwLand,
  line: readonly number[],
  keep: number,
): number {
  const t = land.divisions;
  const w = new Map<number, number>();
  for (const id of line) {
    const r = t.rowOf(id);
    if (r < 0) continue;
    w.set(t.owner[r], (w.get(t.owner[r]) ?? 0) + land.widthOf(r));
  }
  let best = keep;
  let bestW = -1;
  for (const [o, x] of w) {
    if (x > bestW || (x === bestW && o < best)) {
      best = o;
      bestW = x;
    }
  }
  return best;
}

/**
 * Pre-flight C1: the battle's spread (spec §12.3 "in battle"), from the
 * attackers' regions, in the lead attacker's colour. A region has one
 * spread: the controller's own fill (a capture, a capitulation) and
 * another side's way back finish first, and one with tiles already out
 * keeps its order and its colour.
 */
function ensureBattleSpread(land: WwLand, b: Battle): void {
  const R = b.region;
  const old = land.spreads.get(R);
  if (old !== undefined) {
    if (old.by === land.controller[R]) return;
    if (!land.sameSide(old.by, b.attLead)) return;
    if (old.done > 0) {
      old.kind = SPREAD_BATTLE;
      return;
    }
  }
  const t = land.divisions;
  const from = new Set<number>();
  for (const id of b.attackers) {
    const r = t.rowOf(id);
    if (r >= 0 && t.region[r] !== R) from.add(t.region[r]);
  }
  const sources = [...from].sort((x, y) => x - y);
  if (
    old !== undefined &&
    old.by === b.attLead &&
    old.sources.length === sources.length &&
    old.sources.every((x, i) => x === sources[i])
  ) {
    old.kind = SPREAD_BATTLE;
    return;
  }
  land.setSpread({
    region: R,
    by: b.attLead,
    kind: SPREAD_BATTLE,
    sources,
    done: 0,
    dayBase: 0,
    dayNo: -1,
  });
  land.spreadOrders.delete(R);
}

/** Takes a division out of its battle: no battle, no role, off the battle's lists. */
function release(land: WwLand, row: number): void {
  const t = land.divisions;
  const R = t.battle[row];
  const b = R === 0 ? undefined : land.battles.get(R);
  if (b !== undefined) {
    const id = t.id[row];
    b.attackers = b.attackers.filter((d) => d !== id);
    b.defenders = b.defenders.filter((d) => d !== id);
    b.attLine = b.attLine.filter((d) => d !== id);
    b.defLine = b.defLine.filter((d) => d !== id);
  }
  clearRole(land, row);
}

function clearRole(land: WwLand, row: number): void {
  const t = land.divisions;
  if (t.battle[row] === 0 && t.role[row] === ROLE_NONE) return;
  t.battle[row] = 0;
  t.role[row] = ROLE_NONE;
  land.markArmy(t.army[row]);
}

/** Takes a division out of whatever battle it is in (occupation pushes it away). */
export function leaveBattle(land: WwLand, row: number): void {
  release(land, row);
}

/** Ends the battle over `region`: every attacker and defender back to no battle. */
export function closeBattle(land: WwLand, region: number): void {
  const b = land.battles.get(region);
  if (b === undefined) return;
  const t = land.divisions;
  for (const id of [...b.attackers, ...b.defenders]) {
    const r = t.rowOf(id);
    if (r >= 0 && t.battle[r] === region) clearRole(land, r);
  }
  land.endBattle(region);
}

/** Spec §9.3-8: nobody attacks any more; the attackers stay where they are and the spread goes back (Occupation). */
function endDefended(land: WwLand, b: Battle): void {
  const s = land.spreads.get(b.region);
  if (s !== undefined && s.by !== land.controller[b.region]) {
    s.kind = SPREAD_REVERT;
  }
  closeBattle(land, b.region);
}

/**
 * Spec §9.7: the defence is gone. Attackers with org left whose army runs
 * a plan (army_attack is one) advance into R; a paradropped one inside R
 * takes it on the spot.
 */
function won(land: WwLand, b: Battle, tick: number): void {
  const t = land.divisions;
  const R = b.region;
  let inside = -1;
  const advancers: number[] = [];
  for (const id of b.attackers) {
    const r = t.rowOf(id);
    if (r < 0 || t.org[r] <= 0 || t.mode[r] === MOVE_RETREAT) continue;
    if (t.region[r] === R) {
      if (inside < 0) inside = r;
      continue;
    }
    const a = land.armies.get(t.army[r]);
    if (a !== undefined && a.order.kind === "plan" && a.order.executing) {
      advancers.push(r);
    }
  }
  closeBattle(land, R);
  if (inside >= 0) {
    capture(land, R, t.owner[inside], tick);
    return;
  }
  for (const r of advancers) startHopInto(land, r, R, MOVE_ADVANCE);
}

/**
 * Spec §9.5, §9.6: starts a retreat from the division's region to the
 * best neighbour of its side (no battle there first, then the most supply,
 * then the smaller id; an encircled division only into the pocket), or
 * destroys it when there is none.
 */
export function retreatDivision(land: WwLand, row: number): void {
  const t = land.divisions;
  if (t.id[row] === 0) return;
  const to = refugeOf(land, row);
  if (to === 0) {
    const owner = t.owner[row];
    const at = t.region[row];
    // The opponent: the other side of its battle, else whoever holds the
    // region it stands in or was heading for.
    let opponent = opponentOf(land, row);
    if (opponent === 0 && land.isEnemy(owner, land.controller[at])) {
      opponent = land.controller[at];
    }
    const next = t.next[row];
    if (opponent === 0 && land.isEnemy(owner, land.controller[next])) {
      opponent = land.controller[next];
    }
    const region = t.battle[row] !== 0 ? t.battle[row] : at;
    land.killDivision(row, true);
    noteDestroyed(land, owner, region, opponent);
    return;
  }
  release(land, row);
  startHopInto(land, row, to, MOVE_RETREAT);
}

/**
 * Where a retreat from the division's region goes (spec §9.5, §9.6): a
 * neighbour its side controls (encircled: one inside the pocket), no
 * battle there first, then the most supply, then the smaller id; 0: none.
 */
export function refugeOf(land: WwLand, row: number): number {
  const t = land.divisions;
  const owner = t.owner[row];
  const enc = t.encircled[row] !== 0;
  let best = 0;
  let bestBattle = 0;
  let bestSupply = 0;
  for (const e of land.scenario.edgesOf(t.region[row])) {
    const n = e.to;
    if (!land.sameSide(owner, land.controller[n])) continue;
    if (enc && land.encircled[n] === 0) continue;
    const battle = land.battles.has(n) ? 1 : 0;
    const supply = land.supplyMilli[n];
    if (
      best === 0 ||
      battle < bestBattle ||
      (battle === bestBattle && supply > bestSupply)
    ) {
      best = n;
      bestBattle = battle;
      bestSupply = supply;
    }
  }
  return best;
}

/**
 * Spec §5.5: HP damage takes men and every equipment slot by the same
 * share: the share of the HP the division has now, so the loss stays
 * linear in damage (HOI4's strength) and a division can bleed out.
 * Fractions carry in lossMen / lossEq; lost equipment is gone. A fifth of
 * the men lost (half with a field hospital) come back to the pool, the
 * rest are dead for good (P1 casualties). No men left: destroyed.
 */
export function applyHpLoss(land: WwLand, row: number, hpMilli: number): void {
  const t = land.divisions;
  if (hpMilli <= 0 || t.id[row] === 0) return;
  const hpNow = land.statsOf(row).hpMilli;
  const flags = land.flagsOf(row);
  const owner = t.owner[row];
  const men = t.men[row];
  if (men <= 0) return;
  // A handful of men has no HP left to count in: any hit takes them all.
  const all = hpNow <= 0;
  const menMilli = all
    ? men * 1000
    : Math.floor((men * hpMilli * 1000) / hpNow) + t.lossMen[row];
  const lost = Math.min(men, Math.floor(menMilli / 1000));
  t.lossMen[row] = lost === men ? 0 : menMilli - lost * 1000;
  const eq = t.equipOf(row);
  const base = row * eq.length;
  for (let j = 0; j < eq.length; j++) {
    const have = eq[j];
    const carry = t.lossEq[base + j];
    if (have <= 0 && carry === 0) continue;
    const m = all
      ? have * 1000
      : Math.floor((have * hpMilli * 1000) / hpNow) + carry;
    const k = Math.min(have, Math.floor(m / 1000));
    t.lossEq[base + j] = k === have ? 0 : m - k * 1000;
    if (k > 0) land.addEquip(row, j, -k);
  }
  if (lost > 0) {
    const pct = (flags & TPL_HOSPITAL) !== 0 ? 50 : 20;
    const back = Math.floor((lost * pct) / 100);
    const ce = land.econ.country(owner);
    if (ce !== null) returnManpower(ce, back);
    land.noteCasualties(owner, lost, lost - back);
    land.setMen(row, men - lost);
  }
  land.touchDivision(row);
  if (t.men[row] <= 0) {
    const opponent = opponentOf(land, row);
    const region = t.battle[row] !== 0 ? t.battle[row] : t.region[row];
    land.killDivision(row, true);
    noteDestroyed(land, owner, region, opponent);
  }
}

/**
 * Spec §9.8: org back every tick for divisions not in battle, not
 * retreating, advancing, on a train or at sea, and not encircled; half
 * while walking; up to the maximum. The army goes out again when a
 * division's bar moves by a percent.
 */
export function stepRecovery(land: WwLand): void {
  const t = land.divisions;
  const base = Math.floor((300 * WW_ROUND_HOUR_MILLI) / 1000);
  const pctOf = new Map<number, number>();
  for (let r = 0; r < t.rows; r++) {
    if (t.id[r] === 0 || t.battle[r] !== 0 || t.encircled[r] !== 0) continue;
    const m = t.mode[r];
    if (m !== MOVE_NONE && m !== MOVE_WALK) continue;
    const was = t.org[r];
    const max = land.orgMaxOf(r);
    if (was >= max) continue;
    const army = t.army[r];
    // Per army; a division without one by its owner (its tech).
    const key = army > 0 ? army : -t.owner[r];
    let pct = pctOf.get(key);
    if (pct === undefined) {
      const a = land.armies.get(army);
      const g = a === undefined ? null : generalOf(land, a);
      pct =
        100 +
        (g !== null && (g.traits & traitBit("organizer")) !== 0 ? 20 : 0) +
        (land.econ.country(t.owner[r])?.tech.recoveryPct ?? 0);
      pctOf.set(key, pct);
    }
    const signal = (land.flagsOf(r) & TPL_SIGNAL) !== 0 ? 10 : 0;
    let gain = Math.floor(
      (Math.floor((base * (pct + signal)) / 100) * Math.max(0, t.supply[r])) /
        1000,
    );
    if (m === MOVE_WALK) gain = Math.floor(gain / 2);
    if (gain <= 0) continue;
    const now = Math.min(max, was + gain);
    t.org[r] = now;
    if (Math.floor((was * 100) / max) !== Math.floor((now * 100) / max)) {
      land.markArmy(army);
    }
  }
}

/**
 * Spec §9.8, the country's day: a division that stood still all day
 * entrenches a level every three days (two with a defensive general), up
 * to entrenchMax; a moving one has none (arrive zeroes both too).
 */
export function dailyEntrench(land: WwLand, smallID: number): void {
  const t = land.divisions;
  const ce = land.econ.country(smallID);
  if (ce === null) return;
  const stepOf = new Map<number, number>();
  for (const r of land.rowsOf(smallID)) {
    if (t.mode[r] !== MOVE_NONE) {
      t.stillDays[r] = 0;
      t.entrench[r] = 0;
      continue;
    }
    t.stillDays[r] = Math.min(65_535, t.stillDays[r] + 1);
    if (t.stillDays[r] % 3 !== 0) continue;
    const army = t.army[r];
    let step = stepOf.get(army);
    if (step === undefined) {
      const a = land.armies.get(army);
      const g = a === undefined ? null : generalOf(land, a);
      step =
        g !== null && (g.traits & traitBit("defensive_doctrine")) !== 0 ? 2 : 1;
      stepOf.set(army, step);
    }
    const max = entrenchMax(land.flagsOf(r), ce.tech);
    t.entrench[r] = Math.min(max, t.entrench[r] + step);
  }
}

/**
 * What divisionMods takes for division `row` in battle `b` (spec §9.4),
 * so the battle card shows the very lines the engine fights with.
 */
export function battleMods(land: WwLand, b: Battle, row: number): ModResult {
  return divisionMods(
    modInputOf(land, row, b.region, land.divisions.role[row] === ROLE_ATTACK),
  );
}

const NEUTRAL_TECH = techTotals(new Set());

/**
 * What divisionMods needs for division `row` fighting over `region`
 * (attacking it, or defending it): its general, template flags, tech,
 * experience, readiness, the region's terrain and weather, the edge's
 * river and strait, the fort, its entrenchment, supply and encirclement
 * (pre-flight U11). The battles (battleMods) and the plans' predictions
 * (Plans.predictAttack) both call it. The excess width is 0: a battle
 * applies it to its whole line.
 */
export function modInputOf(
  land: WwLand,
  row: number,
  region: number,
  attacking: boolean,
): ModInput {
  const t = land.divisions;
  const sc = land.scenario;
  const at = t.region[row];
  const a = land.armies.get(t.army[row]);
  const g = a === undefined ? null : generalOf(land, a);
  // Readiness (spec §8.3): a front or plan army fighting in or from its
  // front, or dropped into the region it attacks.
  let planBp = 0;
  if (
    a !== undefined &&
    (a.order.kind === "front" || a.order.kind === "plan") &&
    (a.front.includes(at) || (attacking && at === region))
  ) {
    planBp = a.planBp;
  }
  // The edge it attacks over (none when dropped in).
  let river: 0 | 1 | 2 = 0;
  let strait = false;
  if (attacking && at !== region) {
    const e = sc.edgeBetween(at, region);
    if (e >= 0) {
      const edge = sc.edge(e);
      river = edge.river;
      strait = edge.strait === 1;
    }
  }
  const landOf = sc.landOf(region);
  return {
    attacking,
    genAtt: g?.att ?? 0,
    genDef: g?.dfn ?? 0,
    traits: g?.traits ?? 0,
    flags: land.flagsOf(row),
    tech: land.econ.country(t.owner[row])?.tech ?? NEUTRAL_TECH,
    exp: t.exp[row],
    planBp,
    land: landOf,
    weather: land.weatherOn(region, land.day()),
    river,
    strait,
    fort: attacking ? land.econ.fort[region] : 0,
    entrench: attacking ? 0 : t.entrench[row],
    excessBp: 0,
    supplyPm: t.supply[row],
    encircled: t.encircled[row] !== 0,
  };
}
