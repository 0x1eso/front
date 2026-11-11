// The Imjin profile in the 1936 battle loop (ww175 design §5; ww177 I1's hook
// plan, merge 1). Battles.fight calls these only when WorldWar.imjinWar is
// set: a round every ROUND_TICKS ticks, the order chips taking effect at each
// phase (the AI picks by the counter table), the terrain's width, the volley
// clock, charges, crossings, ambush and the walls as the 1936 tactic
// multipliers, morale hits as organisation, and the rout cascade.
import {
  doctrineAttackOrder,
  doctrineDefenceStance,
} from "@openfront/engine-lib/imjin/Doctrine";
import {
  imjinRound,
  type RoundOut,
} from "@openfront/engine-lib/imjin/LandRound";
import {
  ambushHidden,
  ATTACK_ORDERS,
  type Crossing,
  crossingOf,
  DEFENCE_STANCES,
  inCrossing,
  isPhaseStart,
  isRoundTick,
  paddyWet,
  phaseOf,
  riverFrozen,
  routCascade,
  scoutSpots,
  seesRhythm,
} from "@openfront/engine-lib/imjin/LandRules";
import { lunarOf } from "@openfront/engine-lib/imjin/Lunar";
import {
  edgeBetween,
  type ImjinEdge,
  regionTerrain,
} from "@openfront/engine-lib/imjin/Terrain";
import { dateOfDay } from "@openfront/engine-lib/ww1936/Calendar";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import type { TacticFx } from "@openfront/engine-lib/ww1936/TacticRules";
import { generalOf } from "../../ww1936/land/GeneralsRun";
import type { Battle, WwLand } from "../../ww1936/land/WwLand";
import { EDGE_KINDS, type ImjinBattleOrders } from "../WwImjin";
import {
  homeBlockPct,
  mixOf,
  noteRouts,
  perksAt,
  techOf,
} from "./ImjinDoctrine";
import { imjinFortLevel } from "./Sieges";

const P_IMJIN_ORDER = idHash("imjin_order");

/** True on the ticks an Imjin battle fights a round. */
export function imjinRoundTick(b: Battle, tick: number): boolean {
  return isRoundTick(tick, b.sinceTick);
}

function monthOf(land: WwLand, tick: number): number {
  const ww = land.ww;
  return dateOfDay(ww.inPrep(tick) ? 0 : ww.day(tick), ww.epoch).month;
}

/**
 * Design §5 "River crossings": an attack over a great river needs a ford,
 * river boats (a port on either bank) or a frozen river.
 */
export function imjinCrossingAllowed(
  land: WwLand,
  from: number,
  to: number,
  tick: number,
): boolean {
  const sc = land.scenario;
  const edge = edgeBetween(sc, from, to);
  if (edge !== "great_river") return true;
  return crossingOf(
    edge,
    riverFrozen(monthOf(land, tick)),
    sc.isPort(from) || sc.isPort(to),
    false,
  ).allowed;
}

function tagMix(land: WwLand, owner: number) {
  return mixOf(land.ww.imjinWar!, owner);
}

function tagOf(land: WwLand, owner: number): string {
  return land.scenario.tagOfSmallId(owner) ?? "";
}

/** ww177 P7b: the side's men (alive rows), for the escalade's odds. */
function sideMen(land: WwLand, ids: readonly number[]): number {
  const t = land.divisions;
  let n = 0;
  for (const id of ids) {
    const r = t.rowOf(id);
    if (r >= 0 && t.org[r] > 0) n += t.men[r];
  }
  return n;
}

/** ww177 P7b: the attackers' strength over the defenders', %. */
function ratioPct(land: WwLand, b: Battle): number {
  const def = sideMen(land, b.defenders);
  const att = sideMen(land, b.attackers);
  return def <= 0 ? 1000 : Math.min(1000, Math.floor((att * 100) / def));
}

/** ww177 P7b: the land regions the attackers come from. */
function sidesOf(land: WwLand, b: Battle): number {
  const t = land.divisions;
  const seen: number[] = [];
  for (const id of b.attackers) {
    const r = t.rowOf(id);
    if (r < 0) continue;
    const from = t.region[r];
    if (from !== b.region && !seen.includes(from)) seen.push(from);
  }
  return Math.max(1, seen.length);
}

/**
 * ww177 I5a: a side's commander skill (design §5: the gap's chance, the
 * reload read at skill 3): its best general's attack (or defence) skill
 * among the armies in the battle, 0 with none.
 */
function sideSkill(
  land: WwLand,
  ids: readonly number[],
  attack: boolean,
): number {
  const t = land.divisions;
  let best = 0;
  let last = 0;
  for (const id of ids) {
    const r = t.rowOf(id);
    if (r < 0 || t.army[r] === last) continue;
    last = t.army[r];
    const a = land.armies.get(last);
    const g = a === undefined ? null : generalOf(land, a);
    if (g !== null) best = Math.max(best, attack ? g.att : g.dfn);
  }
  return best;
}

/** The crossing the attack makes in this battle (null: none). */
function crossingFor(
  land: WwLand,
  o: ImjinBattleOrders,
  tick: number,
): Crossing | null {
  const edge = EDGE_KINDS[o.edge] ?? "none";
  return edge === "none"
    ? null
    : crossingOf(edge, riverFrozen(monthOf(land, tick)), true, false);
}

/** The battle's orders record, set up on its first round (crossing, ambush). */
function ordersFor(land: WwLand, b: Battle, tick: number): ImjinBattleOrders {
  const im = land.ww.imjinWar!;
  const o = im.ordersOf(b.region, b.sinceTick);
  if (b.round !== 1) return o;
  const t = land.divisions;
  const sc = land.scenario;
  // The crossing: the first attacker's edge into the region.
  const first = b.attackers.length > 0 ? t.rowOf(b.attackers[0]) : -1;
  const from = first >= 0 ? t.region[first] : b.region;
  const edge: ImjinEdge =
    from === b.region ? "none" : edgeBetween(sc, from, b.region);
  o.edge = EDGE_KINDS.indexOf(edge);
  // An ambush: the defenders lay still in hiding ground; the attacker's
  // scouts (none yet: level 0) may see it a region ahead.
  const terrain = regionTerrain(sc, b.region);
  let still = Infinity;
  for (const id of b.defenders) {
    const r = t.rowOf(id);
    if (r >= 0) still = Math.min(still, t.stillDays[r]);
  }
  const day = land.ww.inPrep(tick) ? 0 : land.ww.day(tick);
  if (
    b.defenders.length > 0 &&
    ambushHidden(terrain, "ambush", still) &&
    !scoutSpots(land.ww.politics.seed, b.region, day, b.attLead, 0)
  ) {
    o.ambushed = 1;
    o.def = DEFENCE_STANCES.indexOf("ambush");
  }
  return o;
}

/**
 * At a phase's first round: pending orders take effect (an ambushed
 * attacker's are locked for two phases), and the AI picks its side's.
 */
function stepPhase(
  land: WwLand,
  b: Battle,
  o: ImjinBattleOrders,
  tick: number,
): void {
  if (!isPhaseStart(b.round)) return;
  const ww = land.ww;
  const seed = ww.politics.seed;
  const lockedAtt = o.ambushed === 1 && b.round <= 20;
  const fort = imjinFortLevel(ww.imjinWar!, b.region);
  const terrain = regionTerrain(land.scenario, b.region);
  const defOwner = land.controller[b.region];
  if (!lockedAtt) {
    if (o.pendAtt >= 0) o.att = o.pendAtt;
    else if (o.humanAtt === 0 && !ww.isHumanControlled(b.attLead)) {
      const roll = wwRoll(
        seed,
        P_IMJIN_ORDER,
        b.region,
        b.sinceTick,
        b.round * 2,
      );
      o.att = ATTACK_ORDERS.indexOf(
        doctrineAttackOrder(
          tagOf(land, b.attLead),
          tagMix(land, b.attLead),
          terrain,
          fort,
          b.round === 1 ? null : DEFENCE_STANCES[o.def],
          roll,
          {
            seesRhythm: seesRhythm(false, sideSkill(land, b.attackers, true)),
            phase: phaseOf(b.round),
            enemy: tagOf(land, defOwner),
          },
        ),
      );
    }
    o.pendAtt = -1;
  }
  if (o.pendDef >= 0) o.def = o.pendDef;
  else if (
    o.humanDef === 0 &&
    !ww.isHumanControlled(defOwner) &&
    !(o.ambushed === 1 && b.round === 1)
  ) {
    const roll = wwRoll(
      seed,
      P_IMJIN_ORDER,
      b.region,
      b.sinceTick,
      b.round * 2 + 1,
    );
    const c = crossingFor(land, o, tick);
    o.def = DEFENCE_STANCES.indexOf(
      doctrineDefenceStance(
        tagOf(land, defOwner),
        tagMix(land, defOwner),
        b.round === 1 ? null : ATTACK_ORDERS[o.att],
        roll,
        {
          terrain,
          crossing: c !== null && c.phases > 0 && inCrossing(c, b.round),
          fort,
          enemy: tagOf(land, b.attLead),
        },
      ),
    );
  }
  o.pendDef = -1;
}

/** This round's Imjin numbers, after Battles.fight's b.round++. */
export function imjinRoundOf(land: WwLand, b: Battle, tick: number): RoundOut {
  const o = ordersFor(land, b, tick);
  stepPhase(land, b, o, tick);
  const sc = land.scenario;
  const month = monthOf(land, tick);
  const terrain = regionTerrain(sc, b.region);
  const crossing = crossingFor(land, o, tick);
  const im = land.ww.imjinWar!;
  const defOwner = land.controller[b.region];
  const day = land.ww.inPrep(tick) ? 0 : land.ww.day(tick);
  const lunar = lunarOf(land.ww.epoch + day);
  const out = imjinRound({
    seed: land.ww.politics.seed,
    region: b.region,
    battleStart: b.sinceTick,
    round: b.round,
    terrain,
    wet: paddyWet(month, true),
    att: {
      order: ATTACK_ORDERS[o.att] ?? "advance",
      mix: tagMix(land, b.attLead),
      skill: sideSkill(land, b.attackers, true),
      hwachaUsed: o.hwAtt === 1,
      perks: perksAt(im, b.attLead, b.region, true),
      tech: techOf(im, b.attLead),
    },
    def: {
      order: DEFENCE_STANCES[o.def] ?? "hold",
      mix: tagMix(land, defOwner),
      skill: sideSkill(land, b.defenders, false),
      hwachaUsed: o.hwDef === 1,
      perks: perksAt(im, defOwner, b.region, false),
      tech: techOf(im, defOwner),
    },
    crossing,
    fort: imjinFortLevel(land.ww.imjinWar!, b.region),
    ambushed: o.ambushed === 1,
    broken: b.exploit !== undefined,
    lunarDay: lunar === null ? 0 : lunar.day,
    ratioPct: ratioPct(land, b),
    sides: sidesOf(land, b),
    homeBlockPct: homeBlockPct(im, defOwner, b.region),
  });
  if (out.attHwacha) o.hwAtt = 1;
  if (out.defHwacha) o.hwDef = 1;
  return out;
}

const bp = (pct: number) => (pct - 100) * 100;

/** Lays the round's numbers over the 1936 tactic effects (neutral in Imjin). */
export function applyImjinFx(fx: TacticFx, r: RoundOut): void {
  fx.attAtkBp += bp(r.attDealtPct);
  fx.defAtkBp += bp(r.defDealtPct);
  fx.defBlockBp += bp(r.blockPct);
  fx.attOrgBp += bp(r.attTakenPct);
  fx.attHpBp += bp(r.attTakenPct);
  fx.defOrgBp += bp(r.defTakenPct);
  fx.defHpBp += bp(r.defTakenPct);
}

/** The terrain's, crossing's and ambush's share of the width. */
export function imjinWidth(width: number, r: RoundOut): number {
  return Math.max(1, Math.floor((width * r.widthNum) / r.widthDen));
}

/** Morale (‰ of full organisation) lost at once by a side's line. */
export function imjinMoraleHit(
  land: WwLand,
  line: readonly number[],
  pm: number,
): void {
  if (pm <= 0) return;
  const t = land.divisions;
  for (const row of line) {
    if (t.id[row] === 0) continue;
    const cut = Math.floor((land.orgMaxOf(row) * pm) / 1000);
    t.org[row] = Math.max(0, t.org[row] - cut);
    land.markArmy(t.army[row]);
  }
}

/**
 * Design §5 "Morale and rout": below 150‰ a unit routs, and the rout runs
 * along the line (its neighbours lose 60‰). A routed unit's organisation
 * is 0, so the 1936 loop takes it out of the fight.
 */
export function imjinRouts(
  land: WwLand,
  line: readonly number[],
  enemy = 0,
): void {
  const t = land.divisions;
  const rows = line.filter((r) => t.id[r] !== 0);
  if (rows.length === 0) return;
  const morale = rows.map((r) =>
    Math.floor((t.org[r] * 1000) / Math.max(1, land.orgMaxOf(r))),
  );
  const res = routCascade(
    morale,
    rows.map(() => false),
  );
  const routed = rows.filter((_, i) => res.routed[i]);
  rows.forEach((r, i) => {
    if (res.routed[i]) t.org[r] = 0;
    else {
      t.org[r] = Math.min(
        t.org[r],
        Math.floor((land.orgMaxOf(r) * res.morale[i]) / 1000),
      );
    }
    land.markArmy(t.army[r]);
  });
  // ww177 P7b: the doctrine learns from the rout.
  noteRouts(land, routed, enemy);
}
