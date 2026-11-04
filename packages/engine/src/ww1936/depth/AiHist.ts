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
import { shipStatsOfEntry } from "@openfront/engine-lib/ww1936/hist/ConvertShip";
import { histEntry } from "@openfront/engine-lib/ww1936/hist/index";
import { planeScore } from "@openfront/engine-lib/ww1936/PlaneScore";
import { changeLine } from "../economy/Production";
import type { CountryEconomy } from "../economy/WwEconomy";
import { equipCostMilli, shipDesignOf } from "./Designs";
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

function planeCands(
  d: WwDepth,
  id: number,
  type: string,
  slotOnly = 0,
): (Cand & { slot: number })[] {
  const out: (Cand & { slot: number })[] = [];
  d.country(id)?.des.plane.forEach((s, i) => {
    if (s === null || s.obsolete || (slotOnly > 0 && i + 1 !== slotOnly))
      return;
    if (s.origin !== "own" && s.origin !== "licensed") return;
    if (planeType(s.def) !== type) return;
    const st = d.designStatsOf(id, "plane", i + 1) as PlaneDesignStats | null;
    if (st === null) return;
    const key = EQUIP_KEYS.findIndex(
      (k) => k[0] === "plane_design" && k[1] === i + 1,
    );
    out.push({
      slot: i + 1,
      key,
      cost: equipCostMilli(d, id, key),
      score: planeScore(type, {
        airAtk: st.airAttack,
        airDef: st.airDefense,
        agility: st.agility,
        speed: st.speed,
        range: st.range,
        ground: st.ground,
        strat: st.strategic,
        naval: st.naval,
      }),
    });
  });
  return out;
}

/** One air line a day moves to the value-best catalogue plane of its type. */
function aiPlaneLines(d: WwDepth, id: number, ce: CountryEconomy): void {
  const des = d.country(id)?.des.plane;
  if (des === undefined) return;
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
    const best = cands.find((c) => c.key === pickValue(cands))!;
    if (best.slot === cur) continue;
    if (cur > 0) {
      const mine = planeCands(d, id, type, cur)[0];
      if (
        mine !== undefined &&
        valueNear(mine.score, mine.cost, best.score, best.cost)
      ) {
        continue;
      }
    }
    if (
      changeLine(d.ww.economy, ce, l.id, "plane_design", best.slot) === null
    ) {
      return;
    }
  }
}

/** Ship power for ranking within a class (points; not a game number). */
function shipPower(id: string): number {
  const e = histEntry(id);
  if (e === undefined || e.family !== "ship") return 0;
  const s = shipStatsOfEntry(e);
  return Math.floor(
    s.hpMilli / 100 +
      s.heavy / 10 +
      s.light / 20 +
      s.torpedo / 10 +
      s.depth / 20 +
      s.aa / 20 +
      s.armor / 10 +
      s.speedCentiKn / 50,
  );
}

/** A naval line between ships takes the value-best catalogue ship of its class. */
function aiShipLines(d: WwDepth, id: number, ce: CountryEconomy): void {
  const des = d.country(id)?.des.ship;
  if (des === undefined) return;
  for (const l of ce.navalLines) {
    if (l.cls >= SHIP_CLASSES.length) continue;
    const between = l.progress === 0 || l.progress < l.lastOutput;
    if (!between) continue;
    const cands: (Cand & { slot: number })[] = [];
    des.forEach((s, i) => {
      if (s === null || s.obsolete || s.def.hist === undefined) return;
      if (s.origin !== "own" && s.origin !== "licensed") return;
      if (!s.def.base.startsWith(`${SHIP_CLASSES[l.cls]}_`)) return;
      const mods = shipDesignOf(d, id, i + 1);
      cands.push({
        slot: i + 1,
        key: i + 1,
        score: shipPower(s.def.hist),
        cost: Math.max(1, 1000 + (mods?.costPct ?? 0) * 10),
      });
    });
    if (cands.length === 0) continue;
    // Cost: the entry's own yard cost (the line cost scales with it).
    for (const c of cands) {
      const e = histEntry(des[c.slot - 1]!.def.hist!);
      if (e?.family === "ship") c.cost = shipStatsOfEntry(e).cost;
    }
    const slot = pickValue(cands);
    if (l.design !== slot && l.gen === 1) l.design = slot;
  }
}
