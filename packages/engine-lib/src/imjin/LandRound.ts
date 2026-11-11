// The Imjin profile's battle round (ww175 design §5, ww177 merge 1): what
// LandRules' row rules add up to for one side's line in one round, as the
// percentages the 1936 battle loop takes (Battles.fight). Divisions carry no
// unit rows yet, so a country's mix stands for every division it fields.
// Pure integer code; every chance is a stateless wwRoll.
import type { DoctrinePerks } from "./Doctrine";
import {
  ambushFx,
  type AttackOrder,
  battleStep,
  type BattleStep,
  BIGYEOK_BARRAGE_MORALE,
  blockMulPct,
  chargeResult,
  COUNTER_OF_ORDER,
  type Crossing,
  type DefenceStance,
  ESCALADE_MAX_FORT,
  ESCALADE_PCT,
  ESCALADE_RATIO_PCT,
  feintFlips,
  gapLands,
  GATES_BLOWN_PCT,
  inCrossing,
  IRON_SHIELDS_MULPCT,
  isCharge,
  isPhaseStart,
  NIGHT_STORM_MULPCT,
  orderCountered,
  orderFx,
  rowDealtMulPct,
  SAMURAI_CLASH_PCT,
  stormMulPct,
  terrainRow,
  UNIT_ROWS,
  type UnitRow,
  VOLLEY_SHARE_PCT,
  volleyBeat,
  type VolleyBeat,
  volleyModeOf,
} from "./LandRules";
import type { ImjinTerrain } from "./Terrain";

/** A side's rows in %, summing to 100. */
export type RowMix = Readonly<Partial<Record<UnitRow, number>>>;

/**
 * Each country's army (design §5 "Unit rows"): Japan's spears, guns and
 * retinues; Joseon's archers, horse and chongtong; Ming's guns and horse;
 * the Jurchen riders.
 */
export const ROW_MIX_OF: Readonly<Record<string, RowMix>> = {
  JOS: { spear: 25, archer: 40, cavalry: 20, cannon: 10, hwacha: 5 },
  JPN: { spear: 40, arquebus: 30, samurai: 20, archer: 5, cavalry: 5 },
  MIN: { spear: 30, arquebus: 10, archer: 10, cavalry: 30, cannon: 20 },
  JUR: { spear: 10, archer: 30, cavalry: 60 },
};
export const DEFAULT_ROW_MIX: RowMix = { spear: 50, archer: 30, cavalry: 20 };

export function rowMixOf(tag: string): RowMix {
  return ROW_MIX_OF[tag] ?? DEFAULT_ROW_MIX;
}

export interface RoundSide<T> {
  order: T;
  mix: RowMix;
  /** The commander's skill (0 without one). */
  skill: number;
  /** Its hwacha have fired this battle. */
  hwachaUsed: boolean;
  /** ww177 P7b: its doctrine's perks (absent: none). */
  perks?: DoctrinePerks;
}

export interface RoundInput {
  seed: number;
  region: number;
  battleStart: number;
  /** The battle's round, from 1. */
  round: number;
  terrain: ImjinTerrain;
  wet: boolean;
  att: RoundSide<AttackOrder>;
  def: RoundSide<DefenceStance>;
  /** The crossing the attack makes (null: none). */
  crossing: Crossing | null;
  /** Fort level in play (0: none). */
  fort: number;
  /** The attacker walked into an ambush. */
  ambushed: boolean;
  /** One side has broken (pursuit). */
  broken: boolean;
  /** ww177 P7b: the lunar day (1-30; 0: unknown), for the moonlit storm. */
  lunarDay?: number;
  /** ww177 P7b: the attackers' strength over the defenders', % (escalade). */
  ratioPct?: number;
  /** ww177 P7b: the land regions the attack comes from (a walled town's width). */
  sides?: number;
  /** ww177 P7b: added to the defender's block (Joseon at home under 진관). */
  homeBlockPct?: number;
}

export interface RoundOut {
  step: BattleStep;
  attBeat: VolleyBeat;
  defBeat: VolleyBeat;
  /** Damage each side deals, % (100: as 1936 would). */
  attDealtPct: number;
  defDealtPct: number;
  /** The defender's block, %. */
  blockPct: number;
  /** What each side takes, %. */
  attTakenPct: number;
  defTakenPct: number;
  /** The width's fraction. */
  widthNum: number;
  widthDen: number;
  /** Morale (‰) each side loses this round, once a phase. */
  attMorale: number;
  defMorale: number;
  /** The hwacha fired this round. */
  attHwacha: boolean;
  defHwacha: boolean;
}

const pct = (v: number, p: number) => Math.floor((v * p) / 100);

/** One side's damage %, its rows weighed by their share. */
function sideDealt(
  mix: RowMix,
  defending: boolean,
  step: BattleStep,
  beat: VolleyBeat,
  inp: RoundInput,
  fx: ReturnType<typeof orderFx>,
  enemySpearPct: number,
  crossing: Crossing | null,
  hwachaUsed: boolean,
  cavalryMulPct: number,
  rowMul: Partial<Record<UnitRow, number>> = {},
  hwachaReload = false,
  samuraiClashPct = SAMURAI_CLASH_PCT,
): number {
  const terrain = terrainRow(inp.terrain, inp.wet);
  let sum = 0;
  for (const row of UNIT_ROWS) {
    const share = mix[row] ?? 0;
    if (share <= 0) continue;
    let v = rowDealtMulPct({
      row,
      defending,
      step,
      terrain,
      fx,
      beat,
      enemySpearPct,
      crossing,
      targetRouted: inp.broken,
      hwachaUsed,
      hwachaReload,
      samuraiClashPct,
    });
    if (row === "cavalry") v = pct(v, cavalryMulPct);
    const m = rowMul[row];
    if (m !== undefined) v = pct(v, m);
    sum += share * v;
  }
  return Math.floor(sum / 100);
}

/** The round's numbers for both sides of an Imjin battle. */
export function imjinRound(inp: RoundInput): RoundOut {
  const step = battleStep(inp.round, inp.broken);
  const phaseStart = isPhaseStart(inp.round);
  const crossing =
    inp.crossing !== null &&
    inp.crossing.phases > 0 &&
    inCrossing(inp.crossing, inp.round)
      ? inp.crossing
      : null;
  const fx = orderFx(inp.att.order, inp.def.order, crossing !== null);
  const attArq = inp.att.mix.arquebus ?? 0;
  const defArq = inp.def.mix.arquebus ?? 0;
  const attSpear = inp.att.mix.spear ?? 0;
  const defSpear = inp.def.mix.spear ?? 0;
  const attMode = volleyModeOf(inp.att.order, attArq);
  const defMode = volleyModeOf(inp.def.order, defArq);
  const attBeat = volleyBeat(attMode, inp.round);
  const defBeat = volleyBeat(defMode, inp.round);
  // A charge meets the defender's volley clock once the lines close.
  const charged =
    isCharge(inp.att.order) &&
    step !== "opening" &&
    (inp.att.mix.cavalry ?? 0) > 0;
  const gap =
    charged &&
    inp.att.order === "charge_gap" &&
    defMode === "massed" &&
    gapLands(inp.seed, inp.region, inp.battleStart, inp.round, inp.att.skill);
  // ww177 P7b: the 살수 guard the gunners whatever their share.
  const defSpearVsCharge =
    inp.def.perks?.spearGuard === true && defSpear > 0
      ? Math.max(defSpear, VOLLEY_SHARE_PCT)
      : defSpear;
  const ch = charged
    ? chargeResult(defMode, gap, defSpearVsCharge)
    : chargeResult("none", false, 0);
  // ww177 P7b: doctrine on each side's rows (doctrine §2, §4, §6).
  const attPerks = inp.att.perks;
  const defPerks = inp.def.perks;
  const attRowMul: Partial<Record<UnitRow, number>> = {};
  const defRowMul: Partial<Record<UnitRow, number>> = {};
  const lunar = inp.lunarDay ?? 0;
  if (
    attPerks?.nightStorm === true &&
    (inp.att.order === "storm" || inp.att.order === "advance") &&
    lunar >= 13 &&
    lunar <= 17
  ) {
    defRowMul.archer = NIGHT_STORM_MULPCT;
    defRowMul.arquebus = NIGHT_STORM_MULPCT;
    defRowMul.hwacha = NIGHT_STORM_MULPCT;
  }
  if (defPerks?.ironShields === true) attRowMul.arquebus = IRON_SHIELDS_MULPCT;
  if (attPerks?.ironShields === true) defRowMul.arquebus = IRON_SHIELDS_MULPCT;
  const clashOf = (enemy: DoctrinePerks | undefined) =>
    enemy?.halvesShock === true
      ? Math.floor(SAMURAI_CLASH_PCT / 2)
      : SAMURAI_CLASH_PCT;
  const defHwachaReload =
    defPerks?.hwachaReload === true && inp.fort > 0 && phaseStart;
  let attDealt = sideDealt(
    inp.att.mix,
    false,
    step,
    attBeat,
    inp,
    fx,
    defSpear,
    crossing,
    inp.att.hwachaUsed,
    ch.dealtMulPct,
    attRowMul,
    false,
    clashOf(defPerks),
  );
  let defDealt = sideDealt(
    inp.def.mix,
    true,
    step,
    defBeat,
    inp,
    fx,
    attSpear,
    null,
    inp.def.hwachaUsed,
    100,
    defRowMul,
    defHwachaReload,
    clashOf(attPerks),
  );
  // The feigned retreat taken: the defender crosses after the bait into
  // the waiting volley (design §5): it fights the crossing's way.
  if (feintFlips(inp.att.order, inp.def.order)) {
    defDealt = pct(defDealt, 70);
    attDealt = pct(attDealt, 150);
  }
  // Storming the walls (design §5 "Sieges").
  const storm = stormMulPct(inp.fort);
  attDealt = pct(attDealt, storm.attacker);
  defDealt = pct(defDealt, storm.defender);
  if (inp.fort > 0 && inp.att.order !== "barrage") {
    // Escalade (doctrine §7.3): ladders under covering fire, 3 to 1.
    if (
      attPerks?.escalade === true &&
      inp.fort <= ESCALADE_MAX_FORT &&
      (inp.ratioPct ?? 0) >= ESCALADE_RATIO_PCT &&
      (attArq >= 20 || (inp.att.mix.cannon ?? 0) >= 10)
    )
      attDealt = pct(attDealt, 100 + ESCALADE_PCT);
    // Ming's guns blow the gates (doctrine §6).
    if (
      attPerks?.bigGuns === true &&
      inp.att.order === "storm" &&
      (inp.att.mix.cannon ?? 0) >= 20
    )
      attDealt = pct(attDealt, 100 + GATES_BLOWN_PCT);
  }
  const terrain = terrainRow(inp.terrain, inp.wet);
  let widthNum = terrain.widthNum;
  let widthDen = terrain.widthDen;
  // A walled town stormed from several sides (doctrine §7.3): 1/2 and 1/8
  // for each further side, up to the full width.
  const sides = inp.sides ?? 1;
  if (inp.terrain === "walled" && sides > 1) {
    widthNum = 4 + Math.min(4, sides - 1);
    widthDen = 8;
  }
  if (crossing !== null) {
    widthNum *= crossing.widthNum;
    widthDen *= crossing.widthDen;
  }
  let attTaken = fx.attTakenMulPct;
  // The charge into a loaded volley: the horse's share takes it.
  const cav = inp.att.mix.cavalry ?? 0;
  if (charged && ch.takenMulPct !== 100) {
    attTaken = pct(
      attTaken,
      100 + Math.floor(((ch.takenMulPct - 100) * cav) / 100),
    );
  }
  let attMorale = 0;
  let defMorale = 0;
  if (phaseStart) {
    defMorale += fx.defMoraleHit;
    // The bigyeokjincheonroe lobbed over the walls (doctrine §4).
    if (
      attPerks?.bigyeok === true &&
      inp.att.order === "barrage" &&
      inp.fort > 0
    )
      defMorale += BIGYEOK_BARRAGE_MORALE;
    if (charged) {
      attMorale += ch.chargerMorale;
      defMorale += ch.defenderMorale;
    }
  }
  if (inp.ambushed) {
    const a = ambushFx(inp.terrain, false);
    widthNum *= a.widthNum;
    widthDen *= a.widthDen;
    attTaken = pct(attTaken, a.takenMulPct);
    if (inp.round === 1) attMorale += a.morale;
  }
  return {
    step,
    attBeat,
    defBeat,
    attDealtPct: attDealt,
    defDealtPct: defDealt,
    blockPct:
      blockMulPct(terrain, fx, defSpearVsCharge, charged) +
      (inp.homeBlockPct ?? 0),
    attTakenPct: attTaken,
    defTakenPct: fx.defTakenMulPct,
    widthNum,
    widthDen,
    attMorale,
    defMorale,
    attHwacha: step === "opening" && (inp.att.mix.hwacha ?? 0) > 0,
    defHwacha:
      (step === "opening" || defHwachaReload) && (inp.def.mix.hwacha ?? 0) > 0,
  };
}

/** What the AI reads of the battle beyond the last order (design §9). */
export interface AiOrderCtx {
  /** The enemy's volley rhythm shows (scouts, or a commander of skill 3+). */
  seesRhythm?: boolean;
  /** The defender's ground (its stance's choice). */
  terrain?: ImjinTerrain;
  /** The attacker is still crossing a river this phase. */
  crossing?: boolean;
}

const HIDING: ReadonlySet<ImjinTerrain> = new Set([
  "pass",
  "forest",
  "mountain",
  "hills",
]);

/**
 * The AI's pick for the next phase (design §5, §9), from the orders a
 * player has, by what it sees:
 * - against walls, the siege picks: a breach by the guns where it has
 *   them, else the ladders (storm), or a volley advance;
 * - on open ground, the arquebus line advances by volleys;
 * - its horse charges where the ground allows; against a massed volley it
 *   charges at the gap only when it can read the reload, never blind;
 * - a counter-charge it met is baited with a feigned retreat;
 * - never the order the last stance counters, when it has another.
 * A roll varies the rest.
 */
export function aiAttackOrder(
  mix: RowMix,
  terrain: ImjinTerrain,
  fort: number,
  lastStance: DefenceStance | null,
  roll: number,
  ctx: AiOrderCtx = {},
): AttackOrder {
  const t = terrainRow(terrain);
  const cav = mix.cavalry ?? 0;
  const arq = mix.arquebus ?? 0;
  const guns = mix.cannon ?? 0;
  const opts: AttackOrder[] = [];
  if (fort > 0) {
    // ww177 P7b (doctrine §2): a barrage at walls needs guns and bows.
    if (guns >= 10 && guns + (mix.archer ?? 0) >= 30)
      opts.push("barrage", "barrage");
    opts.push("storm");
    if (arq >= 30) opts.push("volley_advance");
  } else {
    opts.push("advance", "flank");
    if (arq >= 30) {
      opts.push("volley_advance");
      // Volleys on open ground: the guns are at their best there.
      if (t.charge && t.arquebusPct >= 0) opts.push("volley_advance");
    }
    if (cav >= 20 && t.charge && t.cavalryPct >= 0) {
      if (lastStance === "massed_volley") {
        if (ctx.seesRhythm === true) opts.push("charge_gap", "charge_gap");
      } else opts.push("charge");
      if (lastStance === "counter_charge") opts.push("feigned_retreat");
    }
    if (guns + (mix.archer ?? 0) >= 30) opts.push("barrage");
  }
  const ok = opts.filter(
    (o) => lastStance === null || !orderCountered(o, lastStance),
  );
  const list = ok.length > 0 ? ok : opts;
  return list[roll % list.length];
}

/**
 * The AI's stance: it strikes an attacker caught crossing; it answers the
 * order it met with its counter (most phases); otherwise its army's way:
 * massed volleys on open ground and rolling ones in rough country, the
 * archers' screen where the ground hides them, and the counter-charge
 * where horse can ride.
 */
export function aiDefenceStance(
  mix: RowMix,
  lastOrder: AttackOrder | null,
  roll: number,
  ctx: AiOrderCtx = {},
): DefenceStance {
  if (ctx.crossing === true && roll % 4 !== 0) return "strike_crossing";
  const c = lastOrder === null ? null : COUNTER_OF_ORDER[lastOrder];
  if (c !== null && roll % 4 !== 0) return c;
  const t = terrainRow(ctx.terrain ?? "plain");
  const rough = ctx.terrain !== undefined && HIDING.has(ctx.terrain);
  const arq = mix.arquebus ?? 0;
  const opts: DefenceStance[] = ["hold"];
  if (arq >= 30) {
    if (rough) opts.push("rolling_volley", "rolling_volley");
    else opts.push("massed_volley", "massed_volley", "rolling_volley");
  }
  if ((mix.archer ?? 0) >= 30) {
    opts.push("archer_screen");
    if (rough) opts.push("archer_screen");
  }
  if ((mix.cavalry ?? 0) >= 20 && t.charge) opts.push("counter_charge");
  return opts[roll % opts.length];
}
