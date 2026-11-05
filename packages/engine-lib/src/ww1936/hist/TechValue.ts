// World War 1936 research (ww81 lane R, ww78 §3): what a tech is worth for
// a country's own catalogue. Pure and integer; no state. The research score
// (ResearchScore.ts) adds `gain × weight × programme ÷ 10,000`, capped.
//
// An entry is scored by its converted stats inside its group (tank role,
// plane type, gun role, ship class, infantry, support kind). A tech's gain
// for a group is how far its entries beat the best entry already open:
//   - nothing open in the group yet: 40;
//   - else the percent above the best open entry, at most 60;
//   - an entry that still needs one more tech counts half, two or more a
//     quarter; a tech's gain is its best entry's plus 2 for each further
//     entry that improves the group, so ten variants do not outweigh a step.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type {
  PlaneDesignStats,
  TankDesignStats,
} from "@openfront/engine-api/ww1936/DepthTypes";
import type { WwTechId } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_TECH_IDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { ShipStats } from "@openfront/engine-api/ww1936/NavyTypes";
import { WW_TECHS } from "../WwTechs";
import { histStatsOf } from "./Convert";
import type { GearStats } from "./ConvertGear";
import { HIST_CATALOGUE } from "./index";
import type { HistCountry, HistEntry } from "./Types";

export const TECH_VALUE_CAP = 60;
const EMPTY_GROUP_GAIN = 40;
const EXTRA_ENTRY = 2;

/** The group an entry competes in, and its score there (memoised by id). */
interface Scored {
  group: string;
  score: number;
}
const MEMO = new Map<string, Scored>();

function scoreOf(e: HistEntry): Scored {
  let m = MEMO.get(e.id);
  if (m !== undefined) return m;
  const s = histStatsOf(e);
  switch (e.family) {
    case "tank": {
      const t = s as TankDesignStats;
      m = {
        group: `tank:${e.role}`,
        score: t.armor + t.pierce + t.soft + t.hard,
      };
      break;
    }
    case "plane": {
      const p = s as PlaneDesignStats;
      const air = p.airAttack + p.airDefense;
      let v: number;
      switch (e.type) {
        case "cas":
        case "cv_cas":
          v = p.ground * 2 + p.airDefense;
          break;
        case "bomber":
        case "strat_bomber":
          v = p.strategic + p.ground + p.airDefense;
          break;
        case "naval_bomber":
        case "cv_naval_bomber":
          v = p.naval * 2 + p.airDefense;
          break;
        case "transport_plane":
          v = p.range * 10 + p.speed;
          break;
        default:
          v = air;
      }
      m = { group: `plane:${e.type}`, score: v };
      break;
    }
    case "ship": {
      const sh = s as ShipStats;
      m = {
        group: `ship:${e.cls}`,
        score:
          sh.light +
          sh.heavy +
          sh.torpedo +
          sh.armor +
          sh.aa +
          Math.floor(sh.hpMilli / 10) +
          e.spec.aircraft * 100,
      };
      break;
    }
    case "infantry":
    case "support":
    case "gun": {
      const g = s as GearStats;
      const group =
        e.family === "gun"
          ? `gun:${e.role}`
          : e.family === "support"
            ? `sup:${e.spec.kind}`
            : "inf";
      m = { group, score: g.statPct * 100 + g.pierceCenti };
      break;
    }
  }
  MEMO.set(e.id, m);
  return m;
}

/** A tech's value for one group, after the country's weight and programme (percent each). */
export type GroupMult = (group: string) => number;

/**
 * The catalogue value of every tech by WW_TECH_IDS index for `tag`, given
 * what is researched. `mult(group)` is weight × programme ÷ 100 (percent;
 * 100 = neutral). Zero for a tech opening nothing, for a researched one and
 * for a country without a catalogue. Half of a tech's value passes to each
 * prerequisite, two steps at most.
 */
export function catalogueTechValues(
  tag: CountryTag,
  researched: ReadonlySet<WwTechId>,
  mult: GroupMult,
): number[] {
  const out = new Array<number>(WW_TECH_IDS.length).fill(0);
  const list = (
    HIST_CATALOGUE as Partial<Record<CountryTag, readonly HistEntry[]>>
  )[tag as HistCountry];
  if (list === undefined) return out;
  // Best open score per group.
  const best = new Map<string, number>();
  const missing: WwTechId[][] = [];
  for (const e of list) {
    const miss = e.techs.filter((t) => !researched.has(t));
    missing.push(miss);
    if (miss.length === 0) {
      const { group, score } = scoreOf(e);
      if (score > (best.get(group) ?? -1)) best.set(group, score);
    }
  }
  // Per tech and group: the best gain and the count of further entries.
  const acc = new Map<number, Map<string, [number, number]>>();
  list.forEach((e, n) => {
    const miss = missing[n];
    if (miss.length === 0) return;
    const { group, score } = scoreOf(e);
    const b = best.get(group);
    let gain: number;
    if (b === undefined) gain = EMPTY_GROUP_GAIN;
    else if (score <= b) return;
    else
      gain = Math.min(
        TECH_VALUE_CAP,
        b > 0 ? Math.floor(((score - b) * 100) / b) : EMPTY_GROUP_GAIN,
      );
    for (const t of miss) {
      const k = WW_TECH_IDS.indexOf(t);
      if (k < 0) continue;
      const left = miss.length - 1;
      const g = left === 0 ? gain : left === 1 ? gain >> 1 : gain >> 2;
      if (g <= 0) continue;
      let byGroup = acc.get(k);
      if (byGroup === undefined) acc.set(k, (byGroup = new Map()));
      const cur = byGroup.get(group);
      if (cur === undefined) byGroup.set(group, [g, 0]);
      else if (g > cur[0]) byGroup.set(group, [g, cur[1] + 1]);
      else cur[1]++;
    }
  });
  for (const [k, byGroup] of acc) {
    let v = 0;
    for (const [group, [g, more]] of byGroup) {
      const gain = Math.min(TECH_VALUE_CAP, g + more * EXTRA_ENTRY);
      v = Math.max(v, Math.floor((gain * mult(group)) / 100));
    }
    out[k] = Math.min(TECH_VALUE_CAP, v);
  }
  // Prerequisites take half of what the tech is worth, two steps deep.
  const pass = out.slice();
  for (let step = 0; step < 2; step++) {
    const from = pass.slice();
    for (let k = 0; k < from.length; k++) {
      const half = from[k] >> 1;
      if (half <= 0) continue;
      for (const p of WW_TECHS[WW_TECH_IDS[k]].prereqs) {
        const pk = WW_TECH_IDS.indexOf(p);
        if (pk >= 0 && !researched.has(p) && half > pass[pk]) pass[pk] = half;
      }
    }
  }
  return pass.map((v, k) => (researched.has(WW_TECH_IDS[k]) ? 0 : v));
}
