// World War 1936 P2: battles, retreats, overruns, org recovery and
// entrenchment (P2 spec §9, §5.5). One battle a defending region; every
// tick one round of every battle, in region order (spec §2.2-5). Integer
// arithmetic only. ww7 lane A adds the luck of a battle (design ww6 §2):
// tactics every four rounds, initiative, daily luck on each side's attack and
// the reserves' entry rolls, all stateless wwRoll draws (TacticRules).
import {
  KeyStatsTable,
  KS,
  KS_FIELDS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  BattleCtx,
  BattleSummary,
  CombatMods,
  DivisionStats,
  GROUND_SLOTS,
  GROUND_STATIC_SLOTS,
  LAND_ATTACK_TACTICS,
  LAND_DEFENSE_TACTICS,
  MOVE_ADVANCE,
  MOVE_NONE,
  MOVE_RAIL,
  MOVE_RETREAT,
  MOVE_SEA,
  MOVE_WALK,
  NEED_GROUPS,
  NG_SPA,
  ROLE_ATTACK,
  ROLE_DEFEND,
  ROLE_NONE,
  TemplateDef,
  TPL_ENGINEER,
  TPL_HOSPITAL,
  TPL_RECON,
  TPL_SIGNAL,
  traitBit,
  WW_ROUND_HOUR_MILLI,
} from "@openfront/engine-api/ww1936/LandTypes";
import type { WwStatKey } from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  EVICT_ORG_PCT,
  EVICT_ORG_PCT_ENVELOP,
} from "@openfront/engine-lib/ww1936/BandRules";
import {
  addToSide,
  applyBp,
  attackValue,
  casCutHits,
  combatWidth,
  defenderOrgDamage,
  divisionMods,
  emptySide,
  entrenchMax,
  excessWidthBp,
  ModInput,
  ModResult,
  planMaxBp,
  predictBattleRange,
  roundDamage,
  roundHits,
} from "@openfront/engine-lib/ww1936/CombatRules";
import { reliabilityLossBp } from "@openfront/engine-lib/ww1936/DesignRules";
import { fuelCombatBp } from "@openfront/engine-lib/ww1936/FuelRules";
import { coastalFortBp } from "@openfront/engine-lib/ww1936/InvasionRules";
import {
  initiativeOf,
  luckBp,
  newTacticFx,
  newTacticSide,
  pickTactics,
  reinfPctOf,
  reinfRoll,
  TACTIC_PHASE_ROUNDS,
  tacticFx,
  type TacticFx,
  type TacticPick,
  type TacticSide,
} from "@openfront/engine-lib/ww1936/TacticRules";
import { techTotals } from "@openfront/engine-lib/ww1936/WwTechs";
import { effectiveLevel } from "../economy/Buildings";
import { returnManpower } from "../economy/Stock";
import { captureOnBattleEnd, captureOnEncircled } from "../endgame/Capture";
import { noteDamage } from "../endgame/Wars";
import {
  BAND_WAIT,
  BAND_WON,
  bandPhase,
  defenceIn,
  depthOf,
  pushBack,
  retreatInBand,
  walkThrough,
} from "./Bands";
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
  // P5 (plan decision 20): a volunteer fights as the country it serves.
  const owner = land.fightOwner(r);
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
      band: land.bandProg[region],
      tacticAtt: 0,
      tacticDef: 0,
      phaseRound: 0,
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
      land.isEnemy(land.fightOwner(r), ctrl) &&
      (at === R ||
        (land.scenario.edgeBetween(at, R) >= 0 && !land.battles.has(at)));
    if (!ok) release(land, r);
    return ok;
  });
  const attackerOwners = [
    ...new Set(b.attackers.map((id) => land.fightOwner(t.rowOf(id)))),
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
      if (!attackerOwners.every((o) => land.isEnemy(o, land.fightOwner(r)))) {
        continue;
      }
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
  // (Final perf lane: a set of today's defenders, not a scan per former one.)
  const stayed = new Set(defenders);
  for (const id of before) {
    const r = t.rowOf(id);
    if (r >= 0 && t.battle[r] === R && !stayed.has(id)) {
      clearRole(land, r);
    }
  }
  b.defenders = defenders;
  if (b.attackers.length === 0) return endDefended(land, b);
  // ww7 (lane B, bands): a round, a hold while the defenders step back to
  // the next band (or an empty band is walked through), or the band falls.
  const phase = bandPhase(land, b, tick);
  if (phase === BAND_WON) return won(land, b, tick);
  if (phase === BAND_WAIT) return;
  b.round++;
  // 3. Width and the lines (spec §9.2).
  const dirs = new Set(b.attackers.map((id) => t.region[t.rowOf(id)])).size;
  const terrain = land.scenario.landOf(R);
  // ww7: a fort of level 3+ halves the extra width of the extra directions.
  const width = combatWidth(
    terrain,
    Math.min(4, Math.max(1, dirs)),
    effectiveLevel(land.econ, R, "fort"),
  );
  // ww7 lane A (design §2): this round's tactics (a new pair every
  // TACTIC_PHASE_ROUNDS rounds, from last round's lines), the daily luck of
  // both sides, and the reserves' entry rolls inside lineUp. Everything is a
  // pure function of the battle's state and the game seed.
  const rc = beginRound(land, b, tick, dirs);
  if (b.phaseRound === 0) pickPhase(rc);
  b.phaseRound = (b.phaseRound + 1) % TACTIC_PHASE_ROUNDS;
  const fx = tacticFx(b.tacticAtt, b.tacticDef, rc.fx);
  const att = lineUp(land, b.attackers, b.attLine, width, b.round === 1, 0);
  const def = lineUp(land, b.defenders, b.defLine, width, b.round === 1, 1);
  b.attLine = att.line;
  b.defLine = def.line;
  // Pre-flight C4: the attackers' colour is the widest country in line.
  b.attLead = widestOwner(land, att.line, b.attLead);
  b.defLead = ctrl;
  ensureBattleSpread(land, b);
  // 4. Every hit of the round first, then all of them at once (spec §9.3-6).
  const org = new Map<number, number>();
  const hp = new Map<number, number>();
  // P5 hook (W, plan decision 21): who dealt each target's HP damage,
  // summed by dealer (one entry per country, not per hit).
  const dealt = new Map<number, Map<number, number>>();
  const deal = (to: number, by: number, hpMilli: number) => {
    if (hpMilli <= 0) return;
    let l = dealt.get(to);
    if (l === undefined) dealt.set(to, (l = new Map()));
    l.set(by, (l.get(by) ?? 0) + hpMilli);
  };
  // Every number a hit reads, once per division (nothing changes before
  // the damage is applied below).
  const stats = new Map<number, DivisionStats>();
  for (const r of att.active) stats.set(r, land.statsOf(r));
  for (const r of def.active) stats.set(r, land.statsOf(r));
  // ww7 lane A: each side's attack × tactic × daily luck, barrage's soft
  // attack and hold's block value, as bp multipliers (10,000 is ×1).
  const attMul = mulBp(10_000 + fx.attAtkBp, 10_000 + rc.luckAtt);
  const defMul = mulBp(10_000 + fx.defAtkBp, 10_000 + rc.luckDef);
  const softMul = 10_000 + fx.attSoftBp;
  const blockMul = 10_000 + fx.defBlockBp;
  const hit = (
    from: number,
    fromMods: CombatMods,
    to: number,
    toMods: CombatMods,
    toDefends: boolean,
    excess: number,
  ) => {
    const s = stats.get(from)!;
    const ts = stats.get(to)!;
    const soft = toDefends ? applyBp(s.soft, softMul) : s.soft;
    const a = applyBp(
      applyBp(
        applyBp(attackValue(soft, s.hard, ts.hardnessPm), fromMods.attackBp),
        10_000 + excess,
      ),
      toDefends ? attMul : defMul,
    );
    const d0 = applyBp(toDefends ? ts.def : ts.brk, toMods.defenseBp);
    const d = toDefends ? applyBp(d0, blockMul) : d0;
    const dmg = roundDamage(
      roundHits(a, d, toDefends ? (toMods.prepBp ?? 0) + fx.defBlockBp : 0),
      ts.armor > s.pierce,
    );
    org.set(to, (org.get(to) ?? 0) + dmg.orgMilli);
    hp.set(to, (hp.get(to) ?? 0) + dmg.hpMilli);
    deal(to, land.fightOwner(from), dmg.hpMilli);
  };
  const mods = new Map<number, CombatMods>();
  for (const r of att.active) mods.set(r, modsOf(land, r, R, true));
  // (A landed blitz halves the defenders' entrenchment bonus.)
  for (const r of def.active) {
    mods.set(r, modsOf(land, r, R, false, fx.halveEntrench));
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
  // P4 spec §14.7: each side's close air support, a round's hits on one
  // enemy division in line (round robin), no block value; the target's
  // anti-air (1% a point, at most 60%) and the region's AA (5% a level) cut it.
  const cas = (hits: number, targets: readonly number[], by: number) => {
    if (hits <= 0 || targets.length === 0) return;
    const to = targets[b.round % targets.length];
    const aa = effectiveLevel(land.econ, R, "anti_air");
    const h = casCutHits(hits, stats.get(to)!.airAtk, aa);
    const dmg = roundDamage(h, false);
    org.set(to, (org.get(to) ?? 0) + dmg.orgMilli);
    hp.set(to, (hp.get(to) ?? 0) + dmg.hpMilli);
    deal(to, by, dmg.hpMilli);
  };
  cas(land.hooks.casHits(R, land.sideOf(b.attLead)), def.active, b.attLead);
  cas(land.hooks.casHits(R, land.sideOf(ctrl)), att.active, ctrl);
  // P6 hook (W1, spec §16.5): railway guns, after close air support, the
  // same round robin (no anti-air cut: they are guns).
  const guns = (hits: number, targets: readonly number[], by: number) => {
    if (hits <= 0 || targets.length === 0) return;
    const to = targets[b.round % targets.length];
    const dmg = roundDamage(hits, false);
    org.set(to, (org.get(to) ?? 0) + dmg.orgMilli);
    hp.set(to, (hp.get(to) ?? 0) + dmg.hpMilli);
    deal(to, by, dmg.hpMilli);
  };
  guns(
    land.depthHooks.railGunHits(R, land.sideOf(b.attLead)),
    def.active,
    b.attLead,
  );
  guns(land.depthHooks.railGunHits(R, land.sideOf(ctrl)), att.active, ctrl);
  const destroyed: DestroyedSink = { battle: b, counts: new Map() };
  sink = destroyed;
  try {
    for (const [r, o0] of [...org].sort((x, y) => x[0] - y[0])) {
      const was = t.org[r];
      // ww7 lane A: what a side takes is cut or raised by the tactics
      // (assault's price, elastic and withdraw); every source of damage.
      const defending = t.role[r] === ROLE_DEFEND;
      const o = applyBp(o0, 10_000 + (defending ? fx.defOrgBp : fx.attOrgBp));
      // ww7 (street fighting): the defenders of an urban region take 15%
      // less org damage, whatever dealt it (hits, air support, guns).
      t.org[r] = Math.max(
        0,
        was - (defending ? defenderOrgDamage(terrain, o) : o),
      );
      if (defending) b.lostOrgMilli += was - t.org[r];
      land.markArmy(t.army[r]);
      const menBefore = t.men[r];
      const against = t.owner[r];
      applyHpLoss(
        land,
        r,
        applyBp(hp.get(r) ?? 0, 10_000 + (defending ? fx.defHpBp : fx.attHpBp)),
      );
      const lost = t.id[r] === 0 ? menBefore : menBefore - t.men[r];
      if (lost > 0) noteBattleDamage(land, b, dealt.get(r), against, lost);
    }
    const today = land.day();
    for (const r of [...att.active, ...def.active]) {
      // The tick of the round (Task 11): each country's day counts the
      // rounds since its previous day (Sustain.foughtTest).
      if (t.id[r] !== 0) t.lastFight[r] = tick;
      // P6 hook (D, plan decision 12): once a day, its share of combat to
      // its owner's doctrine tracks.
      if (t.id[r] !== 0 && t.tallyDay[r] !== today) {
        t.tallyDay[r] = today;
        const h = trackHalvesOf(land, r);
        land.depthHooks.noteLandCombat(t.owner[r], h[0], h[1], h[2]);
      }
    }
    // 5. Zero org: defenders retreat (or die), attackers drop out (spec §9.3-7).
    // ww7 (lane B): with a band left a broken defender stays put, out of the
    // fight, and steps back to the next band when this one falls (won).
    const lastBand = land.bandProg[R] + 1 >= depthOf(land, R);
    for (const id of [...b.defenders]) {
      const r = t.rowOf(id);
      if (r >= 0 && t.org[r] === 0 && lastBand) retreatDivision(land, r);
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
      return r < 0 || t.mode[r] === MOVE_RETREAT || t.org[r] === 0;
    })
  ) {
    won(land, b, tick);
  }
}

// ---- ww7 lane A: the luck of a battle round (design ww6 §2) ----

/** x × bp ÷ 10,000, floored (both sides' multipliers are bp around 10,000). */
function mulBp(x: number, bp: number): number {
  return Math.floor((x * bp) / 10_000);
}

/**
 * What one round of one battle derives from its state: the seed and the
 * battle's roll keys, the tactics' effects, both sides' luck, and each
 * side's profile and initiative (read off last round's line the first time
 * a pick or a reserve roll needs them). One object, reused: a round
 * allocates nothing for it. Rebuilt from the battle every round, so nothing
 * of it is snapshotted and a restored game rolls the same.
 */
interface RoundCtx {
  land: WwLand;
  b: Battle | null;
  seed: number;
  region: number;
  since: number;
  round: number;
  directions: number;
  fx: TacticFx;
  luckAtt: number;
  luckDef: number;
  /** Profiles of the sides (valid when have[side]) and their initiative (-1: not computed). */
  side: [TacticSide, TacticSide];
  have: [boolean, boolean];
  init: [number, number];
}

const RC: RoundCtx = {
  land: null as unknown as WwLand,
  b: null,
  seed: 0,
  region: 0,
  since: 0,
  round: 0,
  directions: 1,
  fx: newTacticFx(),
  luckAtt: 0,
  luckDef: 0,
  side: [newTacticSide(), newTacticSide()],
  have: [false, false],
  init: [-1, -1],
};
const PICK: TacticPick = { att: 0, def: 0 };
const FX_SCRATCH: TacticFx = newTacticFx();

function beginRound(
  land: WwLand,
  b: Battle,
  tick: number,
  directions: number,
): RoundCtx {
  const rc = RC;
  rc.land = land;
  rc.b = b;
  rc.seed = land.ww.politics.seed;
  rc.region = b.region;
  rc.since = b.sinceTick;
  rc.round = b.round;
  rc.directions = directions;
  rc.have[0] = rc.have[1] = false;
  rc.init[0] = rc.init[1] = -1;
  // The luck of the battle's day: one draw pair a side a game day.
  const day = land.ww.day(tick);
  rc.luckAtt = luckBp(rc.seed, b.region, b.sinceTick, day, 0);
  rc.luckDef = luckBp(rc.seed, b.region, b.sinceTick, day, 1);
  return rc;
}

/** Side `s`'s profile for this round (from the previous round's line), once. */
function profile(rc: RoundCtx, s: number): TacticSide {
  const out = rc.side[s];
  if (rc.have[s]) return out;
  rc.have[s] = true;
  const b = rc.b!;
  const defending = s === 1;
  sideProfileOf(
    rc.land,
    defending ? b.defLine : b.attLine,
    defending ? b.defenders : b.attackers,
    defending,
    out,
  );
  if (defending) out.fort = effectiveLevel(rc.land.econ, b.region, "fort");
  else out.directions = rc.directions;
  return out;
}

function initiative(rc: RoundCtx, s: number): number {
  if (rc.init[s] < 0) rc.init[s] = initiativeOf(profile(rc, s), s === 1);
  return rc.init[s];
}

/** A new tactic pair, picked from both sides' profiles by pickTactics' rolls. */
function pickPhase(rc: RoundCtx): void {
  const b = rc.b!;
  pickTactics(
    rc.seed,
    rc.region,
    rc.since,
    rc.round,
    profile(rc, 0),
    profile(rc, 1),
    PICK,
  );
  b.tacticAtt = PICK.att;
  b.tacticDef = PICK.def;
}

/** Whether reserve `row` of side `side` rolls its way into the line this round. */
function reserveEnters(land: WwLand, row: number, side: number): boolean {
  const rc = RC;
  const pct = reinfPctOf(
    initiative(rc, side),
    (land.flagsOf(row) & TPL_SIGNAL) !== 0,
    side === 0 ? rc.fx.attReinfPp : rc.fx.defReinfPp,
  );
  return (
    reinfRoll(rc.seed, rc.region, rc.since, rc.round, land.divisions.id[row]) <
    pct
  );
}

// The armies a profile counts (scratch: army id, divisions, first row).
const PA_ID: number[] = [];
const PA_N: number[] = [];
const PA_ROW: number[] = [];

/** Battalion counts of a template: [all, artillery, armour + motorized], cached per def. */
const COMPOSITION = new WeakMap<
  TemplateDef,
  readonly [number, number, number]
>();
const ARTILLERY_BN: ReadonlySet<string> = new Set([
  "artillery",
  "mot_artillery",
  "sp_artillery",
]);
const MOBILE_BN: ReadonlySet<string> = new Set([
  "motorized",
  "light_armor",
  "medium_armor",
  "heavy_armor",
]);
const NO_COMPOSITION: readonly [number, number, number] = [0, 0, 0];

function compositionOf(
  land: WwLand,
  row: number,
): readonly [number, number, number] {
  const t = land.divisions;
  const def = land.country(t.owner[row])?.template(t.template[row])?.def;
  if (def === undefined) return NO_COMPOSITION;
  let c = COMPOSITION.get(def);
  if (c === undefined) {
    let art = 0;
    let mobile = 0;
    for (const id of def.battalions) {
      if (ARTILLERY_BN.has(id)) art++;
      else if (MOBILE_BN.has(id)) mobile++;
    }
    c = [def.battalions.length, art, mobile];
    COMPOSITION.set(def, c);
  }
  return c;
}

/**
 * A side's TacticSide: composition, experience, entrenchment and company
 * flags over its divisions (`line` if it has one, else every `all`), the
 * general and research of the army with the most of them (ties: the smaller
 * army id). Pure in the state it reads.
 */
function sideProfileOf(
  land: WwLand,
  line: readonly number[],
  all: readonly number[],
  defending: boolean,
  out: TacticSide,
): void {
  const t = land.divisions;
  const ids = line.length > 0 ? line : all;
  PA_ID.length = 0;
  PA_N.length = 0;
  PA_ROW.length = 0;
  let n = 0;
  let battalions = 0;
  let art = 0;
  let mobile = 0;
  let exp = 0;
  let entrench = 0;
  let signal = false;
  let recon = false;
  for (const id of ids) {
    const r = t.rowOf(id);
    if (r < 0) continue;
    n++;
    const k = PA_ID.indexOf(t.army[r]);
    if (k < 0) {
      PA_ID.push(t.army[r]);
      PA_N.push(1);
      PA_ROW.push(r);
    } else PA_N[k]++;
    const flags = land.flagsOf(r);
    if ((flags & TPL_SIGNAL) !== 0) signal = true;
    if ((flags & TPL_RECON) !== 0) recon = true;
    exp += t.exp[r];
    entrench += t.entrench[r];
    const c = compositionOf(land, r);
    battalions += c[0];
    art += c[1];
    mobile += c[2];
  }
  let lead = -1;
  for (let k = 0; k < PA_ID.length; k++) {
    if (
      lead < 0 ||
      PA_N[k] > PA_N[lead] ||
      (PA_N[k] === PA_N[lead] && PA_ID[k] < PA_ID[lead])
    ) {
      lead = k;
    }
  }
  const a = lead < 0 ? undefined : land.armies.get(PA_ID[lead]);
  const g = a === undefined ? null : generalOf(land, a);
  out.traits = g?.traits ?? 0;
  out.skill = g === null ? 0 : defending ? g.dfn : g.att;
  out.level = g?.level ?? 0;
  out.signal = signal;
  out.recon = recon;
  const ce = lead < 0 ? null : land.econ.country(t.owner[PA_ROW[lead]]);
  out.doctrine = Math.min(10, Math.floor((ce?.stats.reconPct ?? 0) / 5));
  const mean = n === 0 ? 0 : Math.floor(exp / n);
  out.expTier = mean < 250 ? 0 : mean < 500 ? 1 : mean < 750 ? 2 : 3;
  out.artPm = battalions === 0 ? 0 : Math.floor((art * 1000) / battalions);
  out.mechPm = battalions === 0 ? 0 : Math.floor((mobile * 1000) / battalions);
  out.entrench = n === 0 ? 0 : Math.floor(entrench / n);
  out.fort = 0;
  out.directions = 1;
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
 *
 * ww7 lane A (design §2.4): after the first round a reserve that would fit
 * enters only on its roll (25 % + initiative ÷ 4 + a signal company 10 +
 * infiltration, at most 70 %); one that fails waits for the next round and
 * the next reserve is tried. `side` is 0 for the attackers, 1 for the defenders.
 */
function lineUp(
  land: WwLand,
  ids: readonly number[],
  previous: readonly number[],
  width: number,
  first: boolean,
  side: number,
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
  const inLine = cands.length;
  cands.push(...reserves);
  const line: number[] = [];
  const active: number[] = [];
  let used = 0;
  for (let i = 0; i < cands.length; i++) {
    const r = cands[i];
    const w = land.widthOf(r);
    const over = used + w > width;
    const fits = !over || (width - used) * 3 >= w;
    // A reserve that would fit still has to roll its way in.
    if (fits && i >= inLine && !first && !reserveEnters(land, r, side)) {
      continue;
    }
    if (fits) {
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
    // P5 (plan decision 20): a volunteer counts for the country it serves.
    const o = land.fightOwner(r);
    w.set(o, (w.get(o) ?? 0) + land.widthOf(r));
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
  // P5 hook (A, spec §14): the defenders held the field.
  captureOnBattleEnd(land.ww.endgame, b, 1);
  land.depthHooks.onBattleEnd(1, b.attackers, b.defenders, false);
  const s = land.spreads.get(b.region);
  if (s !== undefined && s.by !== land.controller[b.region]) {
    s.kind = SPREAD_REVERT;
  }
  const fought = b.round > 0;
  closeBattle(land, b.region);
  // ww7 (lane B, bands): the defenders won this band; the occupation
  // recedes one band, the occupiers inside step back (at band 0 they leave).
  if (fought) pushBack(land, b.region);
}

/**
 * Spec §9.7: the defence is gone. With bands left the band falls (ww7
 * bands): the region stays the defenders', its broken defenders step back
 * to the next band inside it, and the attackers with org left move in
 * ("occupying": the plan's from next door, the ones inside stay) for the
 * next battle. On the last band it is spec §9.7 as before: attackers with
 * org left whose army runs a plan (army_attack is one) advance into R; one
 * inside R (a paradrop, an occupier) takes it on the spot.
 */
function won(land: WwLand, b: Battle, tick: number): void {
  const t = land.divisions;
  const R = b.region;
  const depth = depthOf(land, R);
  const prog = land.bandProg[R];
  const inside: number[] = [];
  const advancers: number[] = [];
  for (const id of b.attackers) {
    const r = t.rowOf(id);
    if (r < 0 || t.org[r] <= 0 || t.mode[r] === MOVE_RETREAT) continue;
    if (t.region[r] === R) {
      inside.push(r);
      continue;
    }
    const a = land.armies.get(t.army[r]);
    if (a !== undefined && a.order.kind === "plan" && a.order.executing) {
      advancers.push(r);
    }
  }
  // P5 hook (A, spec §14): the attackers took the field.
  captureOnBattleEnd(land.ww.endgame, b, 0);
  land.depthHooks.onBattleEnd(0, b.attackers, b.defenders, true);
  if (prog + 1 >= depth) {
    // ww7: an enveloping win (not met by a withdrawal) overruns more.
    const envelop =
      LAND_ATTACK_TACTICS[b.tacticAtt] === "envelop" &&
      LAND_DEFENSE_TACTICS[b.tacticDef] !== "withdraw";
    // ww7 lane F: a defender broken before any round (bandPhase comes here at
    // once: no org and, in a pocket, no way to get it back) retreats or dies
    // as one broken in a round does. Left standing it kept the attackers out
    // for good: a walker stops at any enemy division and joins the battle,
    // which it wins at once, every tick (Murcia held so for four years).
    for (const id of [...b.defenders]) {
      const r = t.rowOf(id);
      if (r >= 0 && t.org[r] === 0 && t.mode[r] !== MOVE_RETREAT) {
        retreatDivision(land, r);
      }
    }
    closeBattle(land, R);
    if (inside.length > 0) {
      // P5 (plan decision 20): a volunteer takes it for the country it serves.
      capture(
        land,
        R,
        land.fightOwner(inside[0]),
        tick,
        envelop ? EVICT_ORG_PCT_ENVELOP : EVICT_ORG_PCT,
      );
      return;
    }
    for (const r of advancers) startHopInto(land, r, R, MOVE_ADVANCE);
    return;
  }
  if (b.attackers.length === 0) {
    closeBattle(land, R);
    return;
  }
  // A band falls; R is the defenders' until the last one does.
  land.bandProg[R] = prog + 1;
  land.bandTaker[R] = b.attLead;
  land.bandDue[R] = 0;
  land.markRegion(R);
  const withdraw = LAND_DEFENSE_TACTICS[b.tacticDef] === "withdraw";
  for (const id of b.defenders) {
    const r = t.rowOf(id);
    if (
      r >= 0 &&
      t.region[r] === R &&
      t.org[r] === 0 &&
      t.mode[r] !== MOVE_RETREAT
    ) {
      retreatInBand(land, r, withdraw);
    }
  }
  for (const r of advancers) enterBand(land, r);
  for (const id of [...b.attackers]) {
    const r = t.rowOf(id);
    if (r >= 0 && t.region[r] !== R) leaveBattle(land, r);
  }
  if (b.attackers.length === 0) {
    closeBattle(land, R);
    return;
  }
  // The next band's battle: a new round count, lines, tactics and ledger.
  b.band = prog + 1;
  b.round = 0;
  b.attLine = [];
  b.defLine = [];
  b.defenders = [];
  b.startOrgMilli = 0;
  b.lostOrgMilli = 0;
  b.sinceTick = tick;
  b.tacticAtt = 0;
  b.tacticDef = 0;
  b.phaseRound = 0;
  delete b.capEq;
  delete b.dmgBy;
  // An empty band is walked through at a band's pace.
  if (!defenceIn(land, R, b.attLead)) {
    walkThrough(
      land,
      R,
      b.attackers.map((id) => t.rowOf(id)).filter((r) => r >= 0),
      tick,
    );
  }
}

/** ww7: an attacker of the plan steps into the region whose band just fell; it stays in the battle. */
function enterBand(land: WwLand, row: number): void {
  const t = land.divisions;
  const R = t.battle[row];
  stopDivision(land, row);
  land.setDivisionRegion(row, R);
  t.dest[row] = R;
  t.stillDays[row] = 0;
  t.entrench[row] = 0;
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
    const fo = land.fightOwner(row);
    const at = t.region[row];
    // The opponent: the other side of its battle, else whoever holds the
    // region it stands in or was heading for.
    let opponent = opponentOf(land, row);
    if (opponent === 0 && land.isEnemy(fo, land.controller[at])) {
      opponent = land.controller[at];
    }
    const next = t.next[row];
    if (opponent === 0 && land.isEnemy(fo, land.controller[next])) {
      opponent = land.controller[next];
    }
    const region = t.battle[row] !== 0 ? t.battle[row] : at;
    // P5 hook (A, spec §14): destroyed in a pocket, its equipment is taken.
    if (t.encircled[row] !== 0 && opponent > 0) {
      captureOnEncircled(land.ww.endgame, row, opponent);
    }
    land.killDivision(row, true);
    noteDestroyed(land, owner, region, opponent);
    return;
  }
  release(land, row);
  startHopInto(land, row, to, MOVE_RETREAT);
}

/**
 * Where a retreat from the division's region goes (spec §9.5, §9.6;
 * Task 11, controller ruling 5 — HOI4 retreats into an adjacent friendly
 * province): a neighbour its side controls (encircled: one inside the
 * pocket), over land before a strait, no battle there first, then the
 * nearest (edge km), then the most supply, then the smaller id; 0: none.
 */
export function refugeOf(land: WwLand, row: number): number {
  const t = land.divisions;
  // P5 (plan decision 20): a volunteer retreats into its host's side.
  const owner = land.fightOwner(row);
  const enc = t.encircled[row] !== 0;
  const sc = land.scenario;
  let best = 0;
  let bestStrait = 0;
  let bestBattle = 0;
  let bestKm = 0;
  let bestSupply = 0;
  for (const e of sc.edgesOf(t.region[row])) {
    const n = e.to;
    if (!land.sameSide(owner, land.controller[n])) continue;
    if (enc && land.encircled[n] === 0) continue;
    const edge = sc.edge(e.edge);
    const strait = edge.strait;
    const battle = land.battles.has(n) ? 1 : 0;
    const km = edge.km;
    const supply = land.supplyMilli[n];
    const better =
      best === 0 ||
      strait < bestStrait ||
      (strait === bestStrait &&
        (battle < bestBattle ||
          (battle === bestBattle &&
            (km < bestKm || (km === bestKm && supply > bestSupply)))));
    if (better) {
      best = n;
      bestStrait = strait;
      bestBattle = battle;
      bestKm = km;
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
  // Written in place, one touchDivision for all of it (P2 Task 11 perf).
  const eq = t.equip;
  const base = row * GROUND_SLOTS;
  // P5 (plan decision 21): the battle's equipment ledger, by side.
  const bt = t.battle[row] === 0 ? undefined : land.battles.get(t.battle[row]);
  const side = t.role[row] === ROLE_ATTACK ? 0 : GROUND_SLOTS;
  const ks = land.keyStatsOf(owner);
  for (let j = 0; j < GROUND_SLOTS; j++) {
    const have = eq[base + j];
    const carry = t.lossEq[base + j];
    if (have <= 0 && carry === 0) continue;
    const m = all
      ? have * 1000
      : designLossMilli(ks, j, Math.floor((have * hpMilli * 1000) / hpNow)) +
        carry;
    const k = Math.min(have, Math.floor(m / 1000));
    t.lossEq[base + j] = k === have ? 0 : m - k * 1000;
    if (k > 0) eq[base + j] = have - k;
    if (k > 0 && bt !== undefined) {
      bt.capEq ??= new Array<number>(2 * GROUND_SLOTS).fill(0);
      bt.capEq[side + j] += k * 1000;
    }
  }
  if (lost > 0) {
    const ce = land.econ.country(owner);
    // Research overhaul (hospital_2): casualtyReturnPp adds to the share.
    const pct = Math.min(
      100,
      ((flags & TPL_HOSPITAL) !== 0 ? 50 : 20) +
        Math.max(0, ce?.stats.casualtyReturnPp ?? 0),
    );
    const back = Math.floor((lost * pct) / 100);
    if (ce !== null) returnManpower(ce, back);
    land.noteCasualties(owner, lost, lost - back);
    t.men[row] = men - lost;
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
 *
 * P6 (spec §4.2 guerrilla_fighter, T1b): an army whose general has the
 * trait (lane D's armyMods halfSupply) recovers while encircled, and its
 * recovery takes half the supply penalty: supply + (1000 − supply) / 2, so
 * a cut-off division recovers at half the rate.
 */
export function stepRecovery(land: WwLand): void {
  const t = land.divisions;
  const base = Math.floor((300 * WW_ROUND_HOUR_MILLI) / 1000);
  // Per army key: pct × 2, + 1 when it halves supply penalties (one map).
  const pctOf = new Map<number, number>();
  // Nothing below changes a template or a tech: the epochs hold for the pass.
  const epochs = land.statsEpochs();
  for (let r = 0; r < t.rows; r++) {
    if (t.id[r] === 0 || t.battle[r] !== 0) continue;
    const encircled = t.encircled[r] !== 0;
    if (encircled && t.army[r] <= 0) continue;
    const m = t.mode[r];
    // ww7 (bands): a division stepping back to the next band of its own
    // region recovers at half the rate, as one walking does.
    const stepping = m === MOVE_RETREAT && t.next[r] === t.region[r];
    if (m !== MOVE_NONE && m !== MOVE_WALK && !stepping) continue;
    const was = t.org[r];
    const max = land.orgMaxAt(r, epochs[t.owner[r]]);
    if (was >= max) continue;
    const army = t.army[r];
    // Per army; a division without one by its owner (its tech).
    const key = army > 0 ? army : -t.owner[r];
    let packed = pctOf.get(key);
    if (packed === undefined) {
      const a = land.armies.get(army);
      const g = a === undefined ? null : generalOf(land, a);
      const am = army > 0 ? land.depthHooks.armyMods(t.owner[r], army) : null;
      const p =
        100 +
        (g !== null && (g.traits & traitBit("organizer")) !== 0 ? 20 : 0) +
        (land.econ.country(t.owner[r])?.stats.recoveryPct ?? 0) +
        // Review L4: the army's field marshal and medal (lane D).
        (am?.recoveryPct ?? 0);
      packed = p * 2 + (am?.halfSupply === true ? 1 : 0);
      pctOf.set(key, packed);
    }
    const half = (packed & 1) !== 0;
    if (encircled && !half) continue;
    const pct = (packed - (packed & 1)) / 2;
    const signal =
      (land.flagsAt(r, epochs[t.owner[r]]) & TPL_SIGNAL) !== 0 ? 10 : 0;
    let supply = Math.max(0, t.supply[r]);
    if (half && supply < 1000) supply += Math.floor((1000 - supply) / 2);
    let gain = Math.floor(
      (Math.floor((base * (pct + signal)) / 100) * supply) / 1000,
    );
    if (m === MOVE_WALK || stepping) gain = Math.floor(gain / 2);
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
 * entrenches a level every two days (ww7: was three; two levels with a
 * defensive general), up to entrenchMax; a moving one has none (arrive
 * zeroes both too). A level is worth ENTRENCH_DEF_BP (ww7: 5%, was 3%).
 */
export function dailyEntrench(land: WwLand, smallID: number): void {
  const t = land.divisions;
  const ce = land.econ.country(smallID);
  if (ce === null) return;
  const ePct =
    (ce.stats as Partial<Record<WwStatKey, number>>).entrenchSpeedPct ?? 0;
  // P6 (spec §21.2): entrenchSpeedPct shortens the days a level takes
  // (whole days: an approximation, recorded; ww7: the base is two days, so
  // any speed bonus makes it a level a day); review L4: plus the army's
  // field marshal (lane D).
  const everyOf = new Map<number, number>();
  const stepOf = new Map<number, number>();
  for (const r of land.rowsOf(smallID)) {
    if (t.mode[r] !== MOVE_NONE) {
      t.stillDays[r] = 0;
      t.entrench[r] = 0;
      continue;
    }
    t.stillDays[r] = Math.min(65_535, t.stillDays[r] + 1);
    const army = t.army[r];
    let entrenchEvery = everyOf.get(army);
    if (entrenchEvery === undefined) {
      const pct =
        ePct +
        (army > 0
          ? land.depthHooks.armyMods(smallID, army).entrenchSpeedPct
          : 0);
      entrenchEvery =
        pct === 0 ? 2 : Math.max(1, Math.floor(200 / Math.max(10, 100 + pct)));
      everyOf.set(army, entrenchEvery);
    }
    if (t.stillDays[r] % entrenchEvery !== 0) continue;
    let step = stepOf.get(army);
    if (step === undefined) {
      const a = land.armies.get(army);
      const g = a === undefined ? null : generalOf(land, a);
      step =
        g !== null && (g.traits & traitBit("defensive_doctrine")) !== 0 ? 2 : 1;
      stepOf.set(army, step);
    }
    const max = entrenchMax(land.flagsOf(r), ce.stats);
    t.entrench[r] = Math.min(max, t.entrench[r] + step);
  }
}

/**
 * What divisionMods takes for division `row` in battle `b` (spec §9.4),
 * so the battle card shows the very lines the engine fights with.
 */
export function battleMods(land: WwLand, b: Battle, row: number): ModResult {
  const attacking = land.divisions.role[row] === ROLE_ATTACK;
  const input = modInputOf(land, row, b.region, attacking);
  // ww7 lane A: a landed blitz halves the defenders' entrenchment.
  if (!attacking) {
    input.halfEntrench = tacticFx(
      b.tacticAtt,
      b.tacticDef,
      FX_SCRATCH,
    ).halveEntrench;
  }
  return divisionMods(input);
}

const SUMMARY_SIDES: [TacticSide, TacticSide] = [
  newTacticSide(),
  newTacticSide(),
];

/**
 * ww7 lane A (design §2.6): what the battle card shows of the battle's odds,
 * written into its summary: the attacker's win % and the low, average and
 * high org-removal ratio (predictBattleRange over every division in the
 * battle, with the modifiers the battle fights with), each side's
 * initiative, and the attacker's chance for a reserve to enter. The tactics
 * in play are the summary's own fields (WwLand.battleSummary). Nothing is
 * written for a battle with a side missing.
 */
export function battleExtras(
  land: WwLand,
  b: Battle,
  out: BattleSummary,
): void {
  const t = land.divisions;
  // ww8: the wings on station, on the card whatever the lines are doing.
  const attSide = land.sideOf(b.attLead);
  const defSide = land.sideOf(b.defLead);
  const wingsA = land.hooks.casWingsNow(b.region, attSide);
  const wingsD = land.hooks.casWingsNow(b.region, defSide);
  if (wingsA > 0) out.casAtt = wingsA;
  if (wingsD > 0) out.casDef = wingsD;
  const att = emptySide();
  const def = emptySide();
  let firstAtt = -1;
  let firstDef = -1;
  for (const id of b.attLine.length > 0 ? b.attLine : b.attackers) {
    if (t.rowOf(id) >= 0 && firstAtt < 0) firstAtt = t.rowOf(id);
  }
  for (const id of b.defLine.length > 0 ? b.defLine : b.defenders) {
    if (t.rowOf(id) >= 0 && firstDef < 0) firstDef = t.rowOf(id);
  }
  if (firstAtt < 0 || firstDef < 0) return;
  for (const id of b.attackers) {
    const r = t.rowOf(id);
    if (r >= 0) addToSide(att, land.statsOf(r), t.org[r]);
  }
  for (const id of b.defenders) {
    const r = t.rowOf(id);
    if (r >= 0) addToSide(def, land.statsOf(r), t.org[r]);
  }
  const fx = tacticFx(b.tacticAtt, b.tacticDef, FX_SCRATCH);
  const am = modsOf(land, firstAtt, b.region, true);
  const dm = modsOf(land, firstDef, b.region, false, fx.halveEntrench);
  const ctx: BattleCtx = {
    land: land.scenario.landOf(b.region),
    directions: Math.max(1, Math.min(4, out.directions)),
    attackerAttackBp: am.attackBp,
    attackerBlockBp: am.defenseBp,
    defenderAttackBp: dm.attackBp,
    defenderBlockBp: dm.defenseBp,
    defenderPrepBp: dm.prepBp ?? 0,
  };
  // ww8: the wings on station count in the odds.
  const casA = land.hooks.casNowCenti(b.region, attSide);
  const casD = land.hooks.casNowCenti(b.region, defSide);
  if (casA > 0 || casD > 0) {
    const aa = effectiveLevel(land.econ, b.region, "anti_air");
    ctx.casAttCenti = casCutHits(casA, land.statsOf(firstDef).airAtk, aa);
    ctx.casDefCenti = casCutHits(casD, land.statsOf(firstAtt).airAtk, aa);
    if (ctx.casAttCenti > 0) out.casAttCenti = ctx.casAttCenti;
    if (ctx.casDefCenti > 0) out.casDefCenti = ctx.casDefCenti;
  }
  const range = predictBattleRange(att, def, ctx);
  out.winPct = range.winPct;
  out.lowPm = range.lowPm;
  out.midPm = range.midPm;
  out.highPm = range.highPm;
  sideProfileOf(land, b.attLine, b.attackers, false, SUMMARY_SIDES[0]);
  sideProfileOf(land, b.defLine, b.defenders, true, SUMMARY_SIDES[1]);
  out.initAtt = initiativeOf(SUMMARY_SIDES[0], false);
  out.initDef = initiativeOf(SUMMARY_SIDES[1], true);
  out.reinfPct = reinfPctOf(out.initAtt, false, fx.attReinfPp);
}

/**
 * divisionMods(modInputOf(...)).mods, kept by division (derived): a hit
 * needs every field of the new input equal to the one the mods were
 * computed from (divisionMods reads nothing else) and the same
 * CountryEconomy.statsVer (P3 writes the stats object, the input's `tech`,
 * in place and bumps it), so a kept value is the one a fresh computation
 * gives. The battles and the plans' predictions call it.
 */
export function modsOf(
  land: WwLand,
  row: number,
  region: number,
  attacking: boolean,
  halfEntrench = false,
): CombatMods {
  const input = modInputOf(land, row, region, attacking);
  // ww7 lane A (design §2.2 blitz): the defender's entrenchment counts half.
  if (halfEntrench) input.halfEntrench = true;
  let kept = modsCaches.get(land);
  // A rebuild (restore, factions) starts the cache over.
  if (kept === undefined || kept.epoch !== land.derivedEpoch) {
    kept = { epoch: land.derivedEpoch, byId: new Map() };
    modsCaches.set(land, kept);
  }
  const cache = kept.byId;
  const id = land.divisions.id[row];
  const statsVer = land.econ.country(land.divisions.owner[row])?.statsVer ?? -1;
  const hit = cache.get(id);
  if (
    hit !== undefined &&
    hit.statsVer === statsVer &&
    sameModInput(hit.input, input)
  ) {
    return hit.mods;
  }
  // Dead divisions' entries: drop them all now and then (a refill is exact).
  if (cache.size > 2 * land.divisions.count() + 1024) cache.clear();
  const mods = divisionMods(input).mods;
  cache.set(id, { input, statsVer, mods });
  return mods;
}

const modsCaches = new WeakMap<
  WwLand,
  {
    epoch: number;
    byId: Map<number, { input: ModInput; statsVer: number; mods: CombatMods }>;
  }
>();
let modInputKeys: readonly (keyof ModInput)[] | null = null;

function sameModInput(a: ModInput, b: ModInput): boolean {
  const keys = (modInputKeys ??= Object.keys(b) as (keyof ModInput)[]);
  for (let i = 0; i < keys.length; i++) {
    if (a[keys[i]] !== b[keys[i]]) return false;
  }
  return true;
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
  const ce = land.econ.country(t.owner[row]);
  const tech = ce?.stats ?? NEUTRAL_TECH;
  // P6 (pre-flight §0-2): flat O(1) reads of what the depth days stored
  // (one armyMods read; no object built per call).
  const h = land.depthHooks;
  const am = h.armyMods(t.owner[row], t.army[row]);
  // Review L4: the readiness above the country's cap is the field
  // marshal's (planMaxBp), its own line.
  const fmPlanBp = Math.max(0, planBp - planMaxBp(tech));
  planBp -= fmPlanBp;
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
  // P4 (pre-flight ruling 3): the navy's, the air war's and fuel's cuts,
  // O(1) reads of what their days stored, so the mods cache sees them.
  // P5 (plan decision 20): a volunteer fights on its host's side, under
  // its host's air cover and on its host's fuel.
  const fighter = land.fightOwner(row);
  const side = land.sideOf(fighter);
  const base = land.baseStatsOf(row);
  const fuelBp =
    base.fuelWidthPm > 0
      ? fuelCombatBp(land.hooks.fuelFactorPm(fighter), base.fuelWidthPm)
      : 0;
  let landingBp = 0;
  let fortBp = 0;
  const amph = attacking ? land.hooks.amphibious(region, row) : null;
  if (amph !== null) {
    const engineers = (land.flagsOf(row) & TPL_ENGINEER) !== 0;
    const lv = effectiveLevel(land.econ, region, "coastal_fort");
    fortBp = lv === 0 ? 0 : -coastalFortBp(lv, engineers);
    // The hook gives the landing part only (lane I); the fort is ours.
    landingBp = amph.attackBp;
  }
  return {
    attacking,
    genAtt: g?.att ?? 0,
    genDef: g?.dfn ?? 0,
    traits: g?.traits ?? 0,
    flags: land.flagsOf(row),
    tech,
    exp: t.exp[row],
    planBp,
    land: landOf,
    weather: land.weatherOn(region, land.day()),
    river,
    strait,
    // P4 (spec §14.8): a bombed fort holds as the lower level. P6 (spec
    // §21.2 fortDefPerLevelBp): the defender reads its own region's fort.
    fort: effectiveLevel(land.econ, region, "fort"),
    entrench: attacking ? 0 : t.entrench[row],
    // ww7: the position its side built in the region (Positions.ts).
    posLevel: attacking ? 0 : land.posLevel[region],
    excessBp: 0,
    supplyPm: t.supply[row],
    encircled: t.encircled[row] !== 0,
    airBp: land.hooks.airPenaltyBp(region, side, base.airAtk),
    fuelBp,
    landingBp,
    coastalFortBp: fortBp,
    shoreBp: attacking ? 0 : land.hooks.shoreBombardBp(region, side),
    fmAtt: am.fmAtt,
    fmDef: am.fmDef,
    fmTraits: am.fmTraits,
    cmdAttBp: am.cmdAttBp,
    cmdDefBp: am.cmdDefBp,
    enemyPlanCutBp: h.planCutBp(fighter, region),
    fortCut: attacking ? h.fortCut(t.army[row], region) : 0,
    halfSupply: am.halfSupply,
    designFlags: base.designFlags,
    artSoftPm: artSoftPmOf(base),
    fmPlanBp,
    halfEntrench: false,
  };
}

/**
 * P6 (spec §5.2.2, plan Task 1 Step 13): a design slot's equipment losses
 * scaled by its reliability (reliabilityLossBp); a static slot's as P2's.
 */
export function designLossMilli(
  ks: KeyStatsTable,
  j: number,
  milli: number,
): number {
  if (j < GROUND_STATIC_SLOTS || milli <= 0) return milli;
  const rel = ks.stats[j * KS_FIELDS + KS.relPm];
  return rel <= 0
    ? milli
    : Math.floor((milli * reliabilityLossBp(rel)) / 10_000);
}

/** Spec §3.4 row 1: battalions in each doctrine track group. */
const INF_TRACK: ReadonlySet<string> = new Set([
  "infantry",
  "cavalry",
  "mountain",
  "marine",
  "paratrooper",
  "motorized",
]);
const ARMOR_TRACK: ReadonlySet<string> = new Set([
  "light_armor",
  "medium_armor",
  "heavy_armor",
  "tank_destroyer",
]);
const TRACK_HALVES = new WeakMap<
  TemplateDef,
  readonly [number, number, number]
>();
const NO_HALVES: readonly [number, number, number] = [0, 0, 0];

/**
 * P6 (plan decision 12, spec §3.4): a division's battalions as half
 * battalions in the infantry, armour and support tracks (a support
 * company counts half), cached per template def (replaced, never written).
 */
function trackHalvesOf(
  land: WwLand,
  r: number,
): readonly [number, number, number] {
  const t = land.divisions;
  const def = land.country(t.owner[r])?.template(t.template[r])?.def;
  if (def === undefined) return NO_HALVES;
  let h = TRACK_HALVES.get(def);
  if (h === undefined) {
    let inf = 0;
    let arm = 0;
    let sup = def.support.length;
    for (const id of def.battalions) {
      if (INF_TRACK.has(id)) inf += 2;
      else if (ARMOR_TRACK.has(id)) arm += 2;
      else sup += 2;
    }
    h = [inf, arm, sup];
    TRACK_HALVES.set(def, h);
  }
  return h;
}

/** NEED_GROUPS of the artillery-like parts (artillery_officer's share). */
const ART_GROUPS: readonly number[] = [
  NEED_GROUPS.indexOf("artillery"),
  NG_SPA,
];

/** P6 (spec §4.2 artillery_officer): the share of soft attack its artillery carries, ‰. */
function artSoftPmOf(s: DivisionStats): number {
  if (s.soft <= 0) return 0;
  let a = 0;
  for (const g of ART_GROUPS) a += s.parts[g * 4] ?? 0;
  return Math.min(1000, Math.floor((a * 1000) / s.soft));
}

/**
 * P5 (plan decision 21): `lost` men of `against` died this round; each
 * dealer gets its share by the HP it dealt (floor), into the battle's
 * ledger and the war score (lane W's noteDamage).
 */
function noteBattleDamage(
  land: WwLand,
  b: Battle,
  dealers: ReadonlyMap<number, number> | undefined,
  against: number,
  lost: number,
): void {
  if (dealers === undefined || dealers.size === 0) return;
  let total = 0;
  for (const h of dealers.values()) total += h;
  if (total <= 0) return;
  const ledger = (b.dmgBy ??= []);
  for (const [o, h] of [...dealers].sort((x, y) => x[0] - y[0])) {
    const men = Math.floor((lost * h) / total);
    if (men <= 0) continue;
    const row = ledger.find((x) => x[0] === o);
    if (row === undefined) {
      ledger.push([o, men]);
      ledger.sort((x, y) => x[0] - y[0]);
    } else row[1] += men;
    noteDamage(land.ww.endgame, o, against, men);
  }
}
