// World War 1936 military thought sliders, the AI's judgement (design §9).
// Pure given the depth: at war every THOUGHT_AI_WAR_DAYS, at peace every
// THOUGHT_AI_PEACE_DAYS, on the day `day % n === id % n`, a country reads its
// situation and moves each slider's target. History is flavour: the
// historical AI takes only THOUGHT_AI_HISTORICAL_PCT of the situation's
// adjustment, so it stays near the national default; the free AI takes all of
// it and adds a small seeded personal lean, so games differ.
import { AIR_TYPES } from "@openfront/engine-api/ww1936/AirTypes";
import { TPL_ARMOR_MAJOR } from "@openfront/engine-api/ww1936/LandTypes";
import { SHIP_CLASSES } from "@openfront/engine-api/ww1936/NavyTypes";
import {
  THOUGHT_AI_HISTORICAL_PCT,
  THOUGHT_AI_MIN_CHANGE,
  THOUGHT_AI_PEACE_DAYS,
  THOUGHT_AI_WAR_DAYS,
  THOUGHT_MAX_STEP,
  THOUGHT_SLIDER_COUNT,
} from "@openfront/engine-api/ww1936/ThoughtTypes";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { thoughtStartPos } from "@openfront/engine-lib/ww1936/ThoughtRules";
import { AI_FIGHTER_HOLD_SUP_PM } from "../air/AiAir";
import { aiPersonality } from "../economy/AiEconomy";
import { homeSeaRegions } from "./AiSeaAir";
import { enemySupPm } from "./Atomic";
import type { WwDepth } from "./WwDepth";

/** The roll purpose of the AI's personal lean. */
export const P_THOUGHT_AI = idHash("thought_ai");

/** Situation thresholds (design §9 table); balance lane tunes them. */
export const AI_THOUGHT_STRONG_PCT = 130;
export const AI_THOUGHT_WEAK_PCT = 70;
export const AI_THOUGHT_ARMOR_PCT = 25;
export const AI_THOUGHT_FUEL_LOW_PM = 500;
export const AI_THOUGHT_LOW_MANPOWER_DIVS = 10;
export const AI_THOUGHT_RICH_MANPOWER_DIVS = 30;
export const AI_THOUGHT_SUBS = 10;
export const AI_THOUGHT_STRAT_PCT = 40;
export const AI_THOUGHT_FLEET_STRONG_PCT = 120;
export const AI_THOUGHT_FLEET_WEAK_PCT = 70;
/** Manpower of one division when the country has none, for the pool's size in divisions. */
const DEFAULT_DIV_MEN = 10_000;
/** A ship class's weight in a fleet's strength (dd, cl, ca, bc, bb, cv, ss). */
const SHIP_POWER = [1, 2, 3, 5, 6, 5, 1];

const C_BB = SHIP_CLASSES.indexOf("bb");
const C_BC = SHIP_CLASSES.indexOf("bc");
const C_CV = SHIP_CLASSES.indexOf("cv");
const C_SS = SHIP_CLASSES.indexOf("ss");
const T_STRAT = AIR_TYPES.indexOf("strat_bomber");
const T_BOMBER = AIR_TYPES.indexOf("bomber");
const T_NAVAL_BOMBER = AIR_TYPES.indexOf("naval_bomber");

interface Fleets {
  power: number;
  count: number[];
}

/** Ship counts by class and the weighted strength of `id`'s fleets. */
function fleetsOf(d: WwDepth, id: number): Fleets {
  const navy = d.ww.navy;
  const out: Fleets = { power: 0, count: SHIP_CLASSES.map(() => 0) };
  for (const f of navy.fleetsOf(id)) {
    for (const sid of f.ships) {
      const r = navy.ships.shipRowIndex.get(sid);
      if (r === undefined) continue;
      const c = navy.ships.cls[r];
      out.count[c]++;
      out.power += SHIP_POWER[c] ?? 1;
    }
  }
  return out;
}

const activeEnemies = (d: WwDepth, id: number): number[] =>
  d.ww.enemiesOf(id).filter((t) => d.ww.isActor(t));

/** Design §9 table: the nine adjustments (notches) the situation asks for, before the history multiplier. */
function adjustments(d: WwDepth, id: number): number[] {
  const adj: number[] = new Array(THOUGHT_SLIDER_COUNT).fill(0);
  const ww = d.ww;
  const land = ww.land;
  const ce = ww.economy.country(id);
  const enemies = activeEnemies(d, id);
  const atWar = enemies.length > 0;
  const rows = land.rowsOf(id);
  const fuelLow = ce !== null && ce.fuelRatioPm < AI_THOUGHT_FUEL_LOW_PM;

  // 0 offence <-> defence: my divisions against the enemies' sum.
  if (atWar) {
    let theirs = 0;
    for (const t of enemies) theirs += land.rowsOf(t).length;
    if (theirs > 0) {
      if (rows.length * 100 >= theirs * AI_THOUGHT_STRONG_PCT) adj[0] = -3;
      else if (rows.length * 100 <= theirs * AI_THOUGHT_WEAK_PCT) adj[0] = 4;
    }
  }

  // 1 mobility <-> firepower: armour share; a thirsty army wants firepower.
  let armor = 0;
  for (const r of rows) if ((land.flagsOf(r) & TPL_ARMOR_MAJOR) !== 0) armor++;
  if (fuelLow) adj[1] = 3;
  else if (
    rows.length > 0 &&
    armor * 100 >= rows.length * AI_THOUGHT_ARMOR_PCT
  ) {
    adj[1] = -3;
  }

  // 2 mass <-> quality: the manpower pool in divisions.
  if (ce !== null) {
    const men = land.divisions.men;
    let sum = 0;
    for (const r of rows) sum += men[r];
    const per =
      rows.length > 0
        ? Math.max(1, Math.floor(sum / rows.length))
        : DEFAULT_DIV_MEN;
    if (ce.manpower < AI_THOUGHT_LOW_MANPOWER_DIVS * per) adj[2] = -3;
    else if (!atWar && ce.manpower >= AI_THOUGHT_RICH_MANPOWER_DIVS * per) {
      adj[2] = 2;
    }
  }

  // 3 battleship <-> carrier, 4 raid <-> escort, 5 decisive <-> patrol.
  const mine = fleetsOf(d, id);
  const heavy = mine.count[C_BB] + mine.count[C_BC];
  const cv = mine.count[C_CV];
  if (heavy + cv > 0) {
    if (cv * 3 >= heavy) adj[3] = 3;
    else if (cv === 0) adj[3] = -3;
  }
  const cn = ww.navy.country(id);
  const lost = cn !== null && cn.convoyLoss.some((v) => v > 0);
  if (lost) adj[4] = 3;
  else if (atWar && mine.count[C_SS] >= AI_THOUGHT_SUBS) adj[4] = -3;
  if (atWar && mine.power > 0) {
    let theirs = 0;
    for (const t of enemies) theirs += fleetsOf(d, t).power;
    if (theirs > 0) {
      if (mine.power * 100 >= theirs * AI_THOUGHT_FLEET_STRONG_PCT) adj[5] = -2;
      else if (mine.power * 100 <= theirs * AI_THOUGHT_FLEET_WEAK_PCT) {
        adj[5] = 3;
      }
    }
  }

  // 6 intercept <-> air escort: who holds the sky over my waters.
  if (atWar) {
    let worst = 0;
    for (const sr of homeSeaRegions(d, id)) {
      worst = Math.max(worst, enemySupPm(d, id, sr));
    }
    if (worst >= AI_FIGHTER_HOLD_SUP_PM) adj[6] = -3;
    else if (worst === 0) adj[6] = 2;
  }

  // 7 strategic <-> close support: the front on the ground, the bombers' mix.
  let strat = 0;
  let bombers = 0;
  for (const w of ww.air.wingsOf(id)) {
    strat += w.counts[T_STRAT] ?? 0;
    bombers +=
      (w.counts[T_STRAT] ?? 0) +
      (w.counts[T_BOMBER] ?? 0) +
      (w.counts[T_NAVAL_BOMBER] ?? 0);
  }
  const front = land
    .armiesOf(id)
    .some((a) => a.order.kind === "front" || a.order.kind === "plan");
  if (bombers > 0 && strat * 100 >= bombers * AI_THOUGHT_STRAT_PCT) adj[7] = -3;
  else if (front) adj[7] = 3;

  // 8 sortie <-> preserve: thirst keeps the planes home; war flies them.
  if (fuelLow) adj[8] = 3;
  else if (atWar) adj[8] = -2;
  return adj;
}

/** `a * pct / 100` rounded half away from zero. */
function scaled(a: number, pct: number): number {
  const m = Math.floor((Math.abs(a) * pct + 50) / 100);
  return a < 0 ? -m : m;
}

/**
 * Design §9: the nine target notches the AI chooses for `id` on its
 * judgement day, or null (not its day, not started, or nothing moves by
 * THOUGHT_AI_MIN_CHANGE). Only the sliders that move change; the rest keep
 * their target.
 */
export function aiThoughtTargets(
  d: WwDepth,
  id: number,
  day: number,
): number[] | null {
  const n = d.ww.hasWar(id) ? THOUGHT_AI_WAR_DAYS : THOUGHT_AI_PEACE_DAYS;
  if (day % n !== id % n) return null;
  const c = d.country(id);
  if (c === null || !c.th.started) return null;
  const cur = c.th.target;
  const historical = d.ww.historicalAiNow();
  const tag = d.ww.tagOf(id);
  const start = thoughtStartPos({
    table: d.ww.politics.content.startThoughts,
    tag,
    personality: aiPersonality(tag),
    historical,
    seed: d.ww.politics.seed,
    id,
    jitter: 0,
  });
  const adj = adjustments(d, id);
  const pct = historical ? THOUGHT_AI_HISTORICAL_PCT : 100;
  const out = cur.slice(0, THOUGHT_SLIDER_COUNT);
  let changed = false;
  for (let s = 0; s < THOUGHT_SLIDER_COUNT; s++) {
    // The free AI's own lean, fixed per country and slider: -1, 0 or +1.
    const lean = historical
      ? 0
      : (wwRoll(d.ww.politics.seed, P_THOUGHT_AI, id, s) % 3) - 1;
    const want = Math.max(
      -THOUGHT_MAX_STEP,
      Math.min(THOUGHT_MAX_STEP, start[s] + scaled(adj[s], pct) + lean),
    );
    if (Math.abs(want - cur[s]) >= THOUGHT_AI_MIN_CHANGE) {
      out[s] = want;
      changed = true;
    }
  }
  return changed ? out : null;
}
