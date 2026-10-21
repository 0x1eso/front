// World War 1936 P4: naval battle, spotting and supremacy rules (P4 spec
// §8.4, §8.5, §9.2–§9.9). Integer arithmetic only, no randomness: the
// engine's battles, the AI and the screens' previews call the same
// functions (units: Global Constraints of the plan).
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_ROUND_HOUR_MILLI } from "@openfront/engine-api/ww1936/LandTypes";
import {
  FleetMission,
  NavalCtx,
  NavalPrediction,
  NavalSideSum,
  SHIP_CLASSES,
  ShipClass,
  ShipStats,
  WW_HIT_CARRIER_PM,
  WW_HIT_DEPTH_PM,
  WW_HIT_HEAVY_PM,
  WW_HIT_LIGHT_PM,
  WW_HIT_TORPEDO_PM,
  WW_NAVAL_MAX_ROUNDS,
  WW_NAVAL_MIN_ROUNDS,
  WW_NAVAL_RATIO_ROUNDS,
  WW_RETREAT_HP_LOSS_PM,
  WW_RETREAT_ORG_PM,
  WW_SCREEN_RATIO,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { GEN_SUB_VIS, SHIP_BASE } from "./ShipStats";

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/** Spec §9.2. Counts exclude ships that left, sank or hide. */
export function positioningPm(
  mine: number,
  theirs: number,
  maneuver: number,
  posPct: number,
  doctrinePm = 0,
): number {
  const p =
    1000 -
    10 * Math.max(0, mine - theirs) -
    (mine > 2 * theirs ? 100 : 0) +
    30 * maneuver +
    10 * posPct +
    doctrinePm;
  return clamp(p, 300, 1000);
}

/** Spec §9.2: the damage factor of a positioning, ‰ (half at 0%). */
export function posDamagePm(posPm: number): number {
  return 500 + Math.floor(posPm / 2);
}

/** Spec §9.3: three escorts screen one capital ship or carrier. */
export function screenPm(
  screens: number,
  capitals: number,
  carriers: number,
  posPm: number,
  bonusPm: number,
): number {
  if (capitals + carriers === 0) return 1000;
  const base = Math.min(
    1000,
    Math.floor((screens * 1000) / (WW_SCREEN_RATIO * (capitals + carriers))),
  );
  return Math.min(1000, Math.floor((base * posPm) / 1000) + bonusPm);
}

/** Spec §9.3: one capital ship screens one carrier. */
export function carrierScreenPm(
  capitals: number,
  carriers: number,
  posPm: number,
): number {
  if (carriers === 0) return 1000;
  return Math.floor(
    (Math.min(1000, Math.floor((capitals * 1000) / carriers)) * posPm) / 1000,
  );
}

/** Spec §9.4: pierce ÷ armor thresholds by cross-multiplying (no division). */
export function pierceFactorPm(pierce: number, armor: number): number {
  if (armor <= 0 || pierce >= armor) return 1000;
  if (pierce * 4 >= armor * 3) return 800;
  if (pierce * 2 >= armor) return 500;
  if (pierce * 4 >= armor) return 250;
  return 100;
}

/** Spec §9.4: visibility 20 = 1000‰; depth charges against a submarine use ×100 and cap at 1000. */
export function visFactorPm(vis: number, depthCharge: boolean): number {
  return depthCharge ? clamp(vis * 100, 300, 1000) : clamp(vis * 50, 300, 1500);
}

/**
 * Spec §9.4 damage in HP milli: attack × mods × hit × visibility ×
 * positioning × pierce × share. Order keeps every product below 2^53
 * (attack ≤ 4·10^5 centi after mods).
 */
export function shotDamageMilli(
  attackCenti: number,
  modsBp: number,
  hitPm: number,
  visPm: number,
  posDmgPm: number,
  piercePm: number,
  sharePm: number,
): number {
  const a = Math.floor((attackCenti * (10_000 + modsBp)) / 10_000);
  let x = Math.floor((a * hitPm * visPm) / 1000);
  x = Math.floor((x * posDmgPm) / 1000);
  x = Math.floor((x * piercePm) / 1000);
  x = Math.floor((x * sharePm) / 1000);
  return Math.floor(x / 100);
}

/** Spec §9.4: organisation damage = HP damage × (max org / max HP) × 1.5. */
export function orgDamageMilli(
  hpDamageMilli: number,
  maxOrgMilli: number,
  maxHpMilli: number,
): number {
  if (maxHpMilli <= 0) return 0;
  return Math.floor((hpDamageMilli * maxOrgMilli * 3) / (maxHpMilli * 2));
}

/** Spec §9.7: rounds to escape (faster first); speeds in centi-knots. */
export function retreatRounds(
  mySpeed: number,
  enemyMaxSpeed: number,
  hiddenSub: boolean,
): number {
  if (hiddenSub) return 2;
  return clamp(6 - Math.trunc((mySpeed - enemyMaxSpeed) / 300), 2, 8);
}

/** Spec §9.7: a side breaks off (checked from round WW_NAVAL_MIN_ROUNDS). */
export function sideRetreats(
  round: number,
  startHp: number,
  hp: number,
  startOrg: number,
  org: number,
  powerRatioPm: number,
  allAvoid: boolean,
): boolean {
  if (allAvoid) return true;
  if (round < WW_NAVAL_MIN_ROUNDS) return false;
  if ((startHp - hp) * 1000 > startHp * WW_RETREAT_HP_LOSS_PM) return true;
  if (org * 1000 <= startOrg * WW_RETREAT_ORG_PM) return true;
  return round >= WW_NAVAL_RATIO_ROUNDS && powerRatioPm < 500;
}

export interface ShipView {
  stats: ShipStats;
  hpMilli: number;
}

/**
 * Spec §9.9 in centi-points: (heavy × 3 + light + torpedo × 1.5 + depth ×
 * 0.5 + HP / 3 + deck × 0.6) × HP ratio.
 */
export function fleetPower(ships: readonly ShipView[]): number {
  let sum = 0;
  for (const s of ships) {
    const t = s.stats;
    const v =
      3 * t.heavy +
      t.light +
      Math.floor((3 * t.torpedo) / 2) +
      Math.floor(t.depth / 2) +
      Math.floor(t.hpMilli / 30) +
      t.deck * 60;
    sum += t.hpMilli <= 0 ? 0 : Math.floor((v * s.hpMilli) / t.hpMilli);
  }
  return sum;
}

/** Spec §8.4: search points of one fleet: Σ detection × mission ‰ × (100 + mods) / 100. */
export function searchPoints(
  detectSum: number,
  missionPm: number,
  modsPct: number,
): number {
  return Math.floor(
    (Math.floor((detectSum * missionPm) / 1000) * (100 + modsPct)) / 100,
  );
}

/** Spec §8.4: max visibility + 2 per extra surface ship (+1 per extra submarine for a submarine-only fleet). */
export function fleetVis(
  maxVis: number,
  ships: number,
  subsOnly: boolean,
): number {
  return ships <= 0 ? 0 : maxVis + (subsOnly ? 1 : 2) * (ships - 1);
}

/** Spec §8.4: a day's spotting progress, ‰. */
export function spotGainPm(search: number, vis: number, area: number): number {
  return Math.floor((search * vis) / Math.max(1, area));
}

/** Spec §8.5: a side's supremacy in a sea region, ‰. */
export function supremacyPm(mine: number, enemies: number): number {
  return mine <= 0 ? 0 : Math.floor((mine * 1000) / (mine + enemies));
}

/**
 * Spec §8.5, milli-weight: Σ weight × generation HP % × HP ratio ×
 * mission ‰ × fuel ‰.
 */
export function fleetSupPowerMilli(
  ships: readonly {
    supWeight: number;
    genHpPct: number;
    hpMilli: number;
    maxHpMilli: number;
  }[],
  missionPm: number,
  fuelPm: number,
): number {
  let s = 0;
  for (const x of ships) {
    if (x.maxHpMilli <= 0) continue;
    s += Math.floor((x.supWeight * x.genHpPct * 10 * x.hpMilli) / x.maxHpMilli);
  }
  return Math.floor((Math.floor((s * missionPm) / 1000) * fuelPm) / 1000);
}

/** Spec §7.3: milli-km a tick at a speed in centi-knots (25 kn → 84,682). */
export function tickMilliKm(speedCentiKn: number): number {
  return Math.floor((speedCentiKn * 1852 * WW_ROUND_HOUR_MILLI) / 100_000);
}

// ---- The battle preview (spec §9.9) ----

const GROUP_OF: Readonly<Record<ShipClass, number>> = {
  dd: 0,
  cl: 0,
  ca: 1,
  bc: 1,
  bb: 1,
  cv: 2,
  ss: 3,
};
const S = 0;
const C = 1;
const K = 2;
const U = 3;

/** One side as four groups (escorts S, capital ships C, carriers K, submarines U). */
interface Groups {
  n: number[];
  maxHp: number[];
  hp: number[];
  armor: number[];
  vis: number[];
  sunk: number[];
  /** Torpedo share fired by submarines, ‰. */
  subTorpPm: number;
}

function groupsOf(s: NavalSideSum): Groups {
  const n = [0, 0, 0, 0];
  const baseHp = [0, 0, 0, 0];
  const baseArmor = [0, 0, 0, 0];
  const vis = [0, 0, 0, 0];
  let allHp = 0;
  let allArmor = 0;
  let ships = 0;
  let torp = 0;
  let subTorp = 0;
  SHIP_CLASSES.forEach((cls, i) => {
    const k = s.count[i] ?? 0;
    if (k <= 0) return;
    const g = GROUP_OF[cls];
    const b = SHIP_BASE[cls];
    n[g] += k;
    baseHp[g] += k * b.hp;
    baseArmor[g] += k * b.armor;
    vis[g] = Math.max(vis[g], cls === "ss" ? GEN_SUB_VIS[0] : b.vis);
    allHp += k * b.hp;
    allArmor += k * b.armor;
    ships += k;
    torp += k * b.torpedo;
    if (cls === "ss") subTorp += k * b.torpedo;
  });
  const maxHp = baseHp.map((h) =>
    allHp === 0 ? 0 : Math.floor((s.maxHpMilli * h) / allHp),
  );
  const hp = maxHp.map((m) =>
    s.maxHpMilli === 0 ? 0 : Math.floor((m * s.hpMilli) / s.maxHpMilli),
  );
  // The side's average armour carries its generations; each group keeps its share.
  const avgBase = ships === 0 ? 0 : Math.floor((allArmor * 100) / ships);
  const armor = baseArmor.map((a, g) => {
    if (n[g] === 0 || avgBase === 0) return 0;
    return Math.floor((Math.floor((a * 100) / n[g]) * s.armor) / avgBase);
  });
  return {
    n,
    maxHp,
    hp,
    armor,
    vis,
    sunk: [0, 0, 0, 0],
    subTorpPm: torp === 0 ? 0 : Math.floor((subTorp * 1000) / torp),
  };
}

const alive = (g: Groups, i: number) => g.n[i] - g.sunk[i];
const aliveAll = (g: Groups) => alive(g, S) + alive(g, C) + alive(g, K);

/**
 * Spec §9.4 target shares of one weapon over the target's groups (‰),
 * with an empty group's share passed on S → C → K.
 */
function shares(
  t: Groups,
  back: number,
  carrierScreen: number,
  inBackToK: "screen" | "count",
): number[] {
  const out = [0, 0, 0, 0];
  const n = [alive(t, S), alive(t, C), alive(t, K)];
  let toK: number;
  if (inBackToK === "screen") {
    toK = Math.floor((back * (1000 - carrierScreen)) / 1000);
  } else {
    const nb = n[C] + n[K];
    toK = nb === 0 ? 0 : Math.floor((back * n[K]) / nb);
  }
  out[S] = 1000 - back;
  out[K] = toK;
  out[C] = back - toK;
  // Passing on: S → C → K.
  if (n[S] === 0) {
    out[C] += out[S];
    out[S] = 0;
  }
  if (n[C] === 0) {
    out[K] += out[C];
    out[C] = 0;
  }
  if (n[K] === 0) {
    if (n[S] > 0) out[S] += out[K];
    else if (n[C] > 0) out[C] += out[K];
    out[K] = 0;
  }
  return out;
}

/** A side's power from its sums, as fleetPower counts it (centi). */
function sidePower(s: NavalSideSum, hp: number): number {
  const v =
    3 * s.heavy +
    s.light +
    Math.floor((3 * s.torpedo) / 2) +
    Math.floor(s.depth / 2) +
    Math.floor(s.maxHpMilli / 30) +
    s.carrierAttack;
  return s.maxHpMilli <= 0 ? 0 : Math.floor((v * hp) / s.maxHpMilli);
}

/** Damage side `a` deals to `t` in round `round`, HP milli per group. */
function roundDamageTo(
  a: NavalSideSum,
  ag: Groups,
  t: Groups,
  posA: number,
  posT: number,
  screenBonusT: number,
  carrierEvery: number,
  round: number,
): number[] {
  const out = [0, 0, 0, 0];
  if (aliveAll(ag) + alive(ag, U) === 0) return out;
  const posDmg = posDamagePm(posA);
  const screen = screenPm(
    alive(t, S),
    alive(t, C),
    alive(t, K),
    posT,
    screenBonusT,
  );
  const cScreen = carrierScreenPm(alive(t, C), alive(t, K), posT);
  const fire = (
    attack: number,
    hit: number,
    pierce: number | null,
    sh: number[],
  ) => {
    for (let g = 0; g < 4; g++) {
      if (sh[g] <= 0 || alive(t, g) <= 0) continue;
      const pf = pierce === null ? 1000 : pierceFactorPm(pierce, t.armor[g]);
      out[g] += shotDamageMilli(
        attack,
        a.modsBp,
        hit,
        visFactorPm(t.vis[g], g === U),
        posDmg,
        pf,
        sh[g],
      );
    }
  };
  const lightSh = shares(t, 1000 - screen, cScreen, "screen");
  fire(a.light, WW_HIT_LIGHT_PM, a.lightPierce, lightSh);
  const heavyBack = alive(t, S) === 0 ? 1000 : 700;
  fire(
    a.heavy,
    WW_HIT_HEAVY_PM,
    a.heavyPierce,
    shares(t, heavyBack, cScreen, "screen"),
  );
  const subTorp = Math.floor((a.torpedo * ag.subTorpPm) / 1000);
  fire(a.torpedo - subTorp, WW_HIT_TORPEDO_PM, null, lightSh);
  if (subTorp > 0 && round % 2 === 0) {
    fire(
      subTorp,
      WW_HIT_TORPEDO_PM,
      null,
      shares(t, 1000 - Math.floor(screen / 2), cScreen, "screen"),
    );
  }
  if (a.depth > 0 && alive(t, U) > 0) {
    fire(a.depth, WW_HIT_DEPTH_PM, null, [0, 0, 0, 1000]);
  }
  if (a.carrierAttack > 0 && round % Math.max(1, carrierEvery) === 0) {
    fire(
      a.carrierAttack,
      WW_HIT_CARRIER_PM,
      null,
      shares(t, 700, cScreen, "count"),
    );
  }
  return out;
}

/** Applies a round's damage; returns the HP it took. */
function applyDamage(g: Groups, dmg: readonly number[]): number {
  let lost = 0;
  for (let i = 0; i < 4; i++) {
    const d = Math.min(g.hp[i], dmg[i]);
    g.hp[i] -= d;
    lost += d;
    if (g.n[i] > 0) {
      const per = Math.floor(g.maxHp[i] / g.n[i]);
      // Half the fire is focused (spec §9.4): about 2/3 of the HP lost sinks ships.
      const sunk =
        per <= 0
          ? 0
          : Math.floor(((g.maxHp[i] - g.hp[i]) * 2) / Math.max(1, per * 3));
      g.sunk[i] = Math.min(g.n[i], Math.max(g.sunk[i], sunk));
    }
  }
  return lost;
}

const sumOf = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0);

/**
 * Spec §9.9: the battle of two sides' class sums, round by round in the
 * engine's order (positioning → screening → shares → all at once →
 * retreat check), up to WW_NAVAL_MAX_ROUNDS. Within a group the damage
 * spreads by ship count; a group's ships sunk are about two thirds of
 * its HP lost over one ship's HP (half the fire is focused). Submarines
 * count as revealed from the first round. `ratioPm`: the defender's HP
 * lost over the attacker's in the first four rounds (4000 when the
 * attacker loses none); `rounds`: the round a side breaks off plus the
 * slower side's escape. The previews, the AI and the screens call it
 * (`if_stronger` uses fleetPower only).
 */
export function predictNaval(
  a: NavalSideSum,
  b: NavalSideSum,
  ctx: NavalCtx,
): NavalPrediction {
  const ga = groupsOf(a);
  const gb = groupsOf(b);
  const startA = sumOf(ga.hp);
  const startB = sumOf(gb.hp);
  let orgA = a.orgMilli;
  let orgB = b.orgMilli;
  let lostA4 = 0;
  let lostB4 = 0;
  let rounds = WW_NAVAL_MAX_ROUNDS;
  for (let round = 1; round <= WW_NAVAL_MAX_ROUNDS; round++) {
    const na = aliveAll(ga) + alive(ga, U);
    const nb = aliveAll(gb) + alive(gb, U);
    if (na === 0 || nb === 0) {
      rounds = round - 1;
      break;
    }
    const posA = positioningPm(na, nb, a.maneuver, ctx.attackerPosPct);
    const posB = positioningPm(nb, na, b.maneuver, ctx.defenderPosPct);
    const toB = roundDamageTo(
      a,
      ga,
      gb,
      posA,
      posB,
      ctx.defenderScreenBonusPm,
      ctx.attackerCarrierEvery,
      round,
    );
    const toA = roundDamageTo(
      b,
      gb,
      ga,
      posB,
      posA,
      ctx.attackerScreenBonusPm,
      ctx.defenderCarrierEvery,
      round,
    );
    const lostB = applyDamage(gb, toB);
    const lostA = applyDamage(ga, toA);
    orgB = Math.max(0, orgB - orgDamageMilli(lostB, b.orgMilli, b.maxHpMilli));
    orgA = Math.max(0, orgA - orgDamageMilli(lostA, a.orgMilli, a.maxHpMilli));
    if (round <= WW_NAVAL_MIN_ROUNDS) {
      lostA4 += lostA;
      lostB4 += lostB;
    }
    const hpA = sumOf(ga.hp);
    const hpB = sumOf(gb.hp);
    const pa = sidePower(a, hpA);
    const pb = sidePower(b, hpB);
    const ratioA = pb === 0 ? 4000 : Math.floor((pa * 1000) / pb);
    const ratioB = pa === 0 ? 4000 : Math.floor((pb * 1000) / pa);
    const outA = sideRetreats(
      round,
      startA,
      hpA,
      a.orgMilli,
      orgA,
      ratioA,
      false,
    );
    const outB = sideRetreats(
      round,
      startB,
      hpB,
      b.orgMilli,
      orgB,
      ratioB,
      false,
    );
    if (outA || outB) {
      const slowA = retreatRounds(a.minSpeed, b.maxSpeed, false);
      const slowB = retreatRounds(b.minSpeed, a.maxSpeed, false);
      const esc = outA && outB ? Math.max(slowA, slowB) : outA ? slowA : slowB;
      rounds = Math.min(WW_NAVAL_MAX_ROUNDS, round + esc);
      break;
    }
  }
  return {
    ratioPm: lostA4 === 0 ? 4000 : Math.floor((lostB4 * 1000) / lostA4),
    rounds,
    sunkA: sumOf(ga.sunk),
    sunkB: sumOf(gb.sunk),
  };
}

// ---- Order judges the screens share (lane N1 fills them) ----

/** What fleetMissionBlock reads (P4 spec §8.1, §8.3). */
export interface FleetMissionAsk {
  mission: FleetMission;
  /** The mission region's kind; null when it is no strategic region. */
  srKind: "land" | "sea" | null;
  /** Sea km from the home port's harbor to the region's nearest zone; null: no sea route. */
  km: number | null;
  /** The fleet's range (its shortest-ranged ship). */
  rangeKm: number;
  /** The fleet fights a battle now. */
  inBattle: boolean;
}

/**
 * Spec §8.1, §8.3: why the fleet may not take the mission; null when it
 * may (lane N1). A fleet in a battle takes none; `hold` needs no region;
 * any other mission needs a sea region within the fleet's range of its
 * home port by sea. (Training's "own coastal region" needs the map and
 * the war: the engine checks it after this.)
 */
export function fleetMissionBlock(a: FleetMissionAsk): WwOrderBlock | null {
  if (a.inBattle) return "fleet_busy";
  if (a.mission === "hold") return null;
  if (a.srKind !== "sea") return "bad_zone";
  if (a.km === null) return "no_sea_path";
  if (a.km > a.rangeKm) return "out_of_range";
  return null;
}
