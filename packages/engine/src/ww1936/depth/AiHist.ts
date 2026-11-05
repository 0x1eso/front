// ww61: the AI with the historical catalogue (rule 9). It designs nothing;
// it builds what it holds, chosen by VALUE, not by score alone: among the
// usable entries of a group that are not far behind the best (MIN_SCORE_PCT),
// the one with the most score per industry point wins. So a country with a
// Tiger and a T-34 keeps building the cheaper one in numbers and does not
// starve its lines on the dearest thing; the Tiger is still used where it
// scores clearly above the rest (the old rule and the swap are the engine's).
import { AIR_TYPES } from "@openfront/engine-api/ww1936/AirTypes";
import type { PlaneDesignStats } from "@openfront/engine-api/ww1936/DepthTypes";
import { EQUIP_KEYS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { SHIP_CLASSES } from "@openfront/engine-api/ww1936/NavyTypes";
import { planeType } from "@openfront/engine-lib/ww1936/DesignRules";
import {
  shipPowerOf,
  shipStatsOfEntry,
} from "@openfront/engine-lib/ww1936/hist/ConvertShip";
import { histEntry } from "@openfront/engine-lib/ww1936/hist/index";
import { changeLine } from "../economy/Production";
import type { CountryEconomy } from "../economy/WwEconomy";
import type { PickCand } from "./AiPick";
import {
  AI_FIGHTER_TYPES,
  AI_PLANE_BASE_YEAR,
  aiKeeps,
  aiPickEntry,
  aiPlaneScore,
  lineDraw,
  qualityLean,
  resourceMultPm,
} from "./AiPick";
import { equipCostMilli } from "./Designs";
import { histCountryOf } from "./Hist";
import type { WwDepth } from "./WwDepth";

/** An entry scoring less than this share of the best is not a candidate. */
export const MIN_SCORE_PCT = 55;
/** A line keeps its key when its value is at least this share of the best's. */
export const KEEP_VALUE_PCT = 85;

export interface Cand {
  key: number;
  score: number;
  cost: number;
}

const valueOf = (score: number, cost: number): number =>
  Math.floor((Math.max(0, score) * 1_000_000) / Math.max(1, cost));

/** The candidate with the best value among those within MIN_SCORE_PCT of the top score (ties: the smaller key). */
export function pickValue(list: readonly Cand[]): number {
  let top = 0;
  for (const c of list) top = Math.max(top, c.score);
  let best = list[0];
  let bestV = -1;
  for (const c of list) {
    if (c.score * 100 < top * MIN_SCORE_PCT) continue;
    const v = valueOf(c.score, c.cost);
    if (v > bestV || (v === bestV && c.key < best.key)) {
      best = c;
      bestV = v;
    }
  }
  return best.key;
}

/** Whether (score, cost) is nearly as good a value as the best's. */
export function valueNear(
  score: number,
  cost: number,
  bestScore: number,
  bestCost: number,
): boolean {
  return (
    valueOf(score, cost) * 100 >= valueOf(bestScore, bestCost) * KEEP_VALUE_PCT
  );
}

/** The AI's catalogue day: plane lines and ship lines (tank lines are AiDesigns.aiTankLines). */
export function aiHistDay(d: WwDepth, id: number, ce: CountryEconomy): void {
  if (histCountryOf(d, id) === null) return;
  aiPlaneLines(d, id, ce);
  aiShipLines(d, id, ce);
}

const AIR_SET: ReadonlySet<string> = new Set(AIR_TYPES);

/**
 * ww85: a fighter shorter-ranged than this is a point-defence rocket (Me 163,
 * Shusui, 70-80 km): the duel score ignores range, so without this floor the
 * AI would turn its fighter lines to planes that cannot reach the front. The
 * next shortest fighter flies 510 km.
 */
export const AI_MIN_FIGHTER_RANGE = 300;

function planeCands(
  d: WwDepth,
  id: number,
  type: string,
  slotOnly = 0,
): (PickCand & { slot: number })[] {
  const out: (PickCand & { slot: number })[] = [];
  const ce = d.ww.economy.country(id);
  const draw = ce === null ? [] : lineDraw(d, id, ce);
  d.country(id)?.des.plane.forEach((s, i) => {
    if (s === null || s.obsolete || (slotOnly > 0 && i + 1 !== slotOnly))
      return;
    if (s.origin !== "own" && s.origin !== "licensed") return;
    if (planeType(s.def) !== type) return;
    const st = d.designStatsOf(id, "plane", i + 1) as PlaneDesignStats | null;
    if (st === null) return;
    if (AI_FIGHTER_TYPES.has(type) && st.range < AI_MIN_FIGHTER_RANGE) return;
    const key = EQUIP_KEYS.findIndex(
      (k) => k[0] === "plane_design" && k[1] === i + 1,
    );
    out.push({
      slot: i + 1,
      key,
      cost: equipCostMilli(d, id, key),
      relPm: st.relPm,
      resPm: ce === null ? 1000 : resourceMultPm(d, id, ce, key, draw),
      // ww81 P1b, ww103: what the duel reads, counted up for speed and year.
      score: aiPlaneScore(type, st, planeYear(s.def)),
    });
  });
  return out;
}

/** A design's year: its catalogue entry's; one of the designer's by its airframe's generation. */
function planeYear(def: { hist?: string; base: string }): number {
  const e = def.hist === undefined ? undefined : histEntry(def.hist);
  if (e !== undefined) return e.year;
  const gen = Number(/_(\d)$/.exec(def.base)?.[1] ?? 1);
  return AI_PLANE_BASE_YEAR + 3 * gen;
}

/** One air line a day moves to the value-best catalogue plane of its type. */
function aiPlaneLines(d: WwDepth, id: number, ce: CountryEconomy): void {
  const des = d.country(id)?.des.plane;
  if (des === undefined) return;
  const q = qualityLean(d, id);
  for (const l of ce.lines) {
    const [t, g] = EQUIP_KEYS[l.key];
    let type: string | null = null;
    let cur = 0;
    if (AIR_SET.has(t)) type = t;
    else if (t === "plane_design" && des[g - 1] !== null) {
      type = planeType(des[g - 1]!.def);
      cur = g;
    }
    if (type === null) continue;
    const cands = planeCands(d, id, type);
    if (cands.length === 0) continue;
    const bestKey = aiPickEntry(cands, q);
    const best = cands.find((c) => c.key === bestKey)!;
    if (best.slot === cur) continue;
    if (cur > 0 && aiKeeps(cands, q, l.key)) continue;
    if (
      changeLine(d.ww.economy, ce, l.id, "plane_design", best.slot) === null
    ) {
      return;
    }
  }
}

/**
 * ww81 (B4, AI side): a plane line just added as a static type takes its
 * catalogue entry at once, not on the next design day.
 */
export function aiPickNewPlaneLines(
  d: WwDepth,
  id: number,
  ce: CountryEconomy,
): void {
  if (histCountryOf(d, id) === null) return;
  aiPlaneLines(d, id, ce);
}

/** Ship power for ranking within a class (points; not a game number). */
function shipPower(id: string): number {
  const e = histEntry(id);
  if (e === undefined || e.family !== "ship") return 0;
  return shipPowerOf(shipStatsOfEntry(e));
}

/**
 * A naval line between ships takes the value-best catalogue ship of its
 * class; a line with no design at all takes one at once (ww81 P3, B6).
 */
export function aiShipLines(d: WwDepth, id: number, ce: CountryEconomy): void {
  const des = d.country(id)?.des.ship;
  if (des === undefined) return;
  const q = qualityLean(d, id);
  for (const l of ce.navalLines) {
    if (l.cls >= SHIP_CLASSES.length) continue;
    const between = l.progress === 0 || l.progress < l.lastOutput;
    if (!between && l.design > 0) continue;
    const cands: (PickCand & { slot: number })[] = [];
    des.forEach((s, i) => {
      if (s === null || s.obsolete || s.def.hist === undefined) return;
      if (s.origin !== "own" && s.origin !== "licensed") return;
      if (!s.def.base.startsWith(`${SHIP_CLASSES[l.cls]}_`)) return;
      const e = histEntry(s.def.hist);
      cands.push({
        slot: i + 1,
        key: i + 1,
        score: shipPower(s.def.hist),
        // The entry's own yard cost (the line cost scales with it).
        cost: Math.max(
          1,
          e?.family === "ship" ? shipStatsOfEntry(e).cost : 1000,
        ),
        relPm: 1000,
      });
    });
    if (cands.length === 0) continue;
    const slot = aiPickEntry(cands, q);
    if (l.design !== slot && l.gen === 1) l.design = slot;
  }
}
