// ww92: a major's static keys from its catalogue, in the engine-lib so the
// client's template screens read the very numbers the engine does.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type { KeyStatsTable } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  DS_HIST,
  KS,
  KS_FIELDS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { EQUIP_KEYS } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_EQUIP_KEYS,
  GROUND_STATIC_SLOTS,
} from "@openfront/engine-api/ww1936/LandTypes";
import { rowScore, STATIC_KEY_STATS } from "../TemplateStats";
import { histStatsOf } from "./Convert";
import type { GearStats } from "./ConvertGear";
import { RELIABILITY_PM, tankStatsOfEntry } from "./ConvertTank";
import { histStaticEntry } from "./Slots";
import { HIST_COUNTRIES, type HistCountry } from "./Types";
import { weakKeyRow } from "./WeakGeneric";

const GEAR_FIELDS = [KS.soft, KS.hard, KS.def, KS.brk] as const;

/**
 * A major's static keys take their numbers from its catalogue (rule 7). A tank
 * key: the entry standing in for it, real numbers, since its generations are
 * real vehicles. Any other key: the generic row of its own generation × the
 * entry's percent, so the next generation helps as it does for everyone and
 * the country's weapon sets the spread around it (small, by the owner's rule);
 * an anti-tank key with its real pierce. A generation with no entry goes on
 * from the country's last stand-in of the type, never the bare generic row.
 * With the designer off, a key with nothing to go on and every minor's key is
 * generic use (WeakGeneric); a designer-on game keeps the generic row.
 */
export function fillStaticKeys(
  country: HistCountry | null,
  t: KeyStatsTable,
): void {
  if (country === null) {
    for (let j = 0; j < GROUND_STATIC_SLOTS; j++) weakKeyRow(t, j);
    return;
  }
  // Per type: the last tank row, or the last gear entry's percent and pierce row.
  const lastTank = new Map<string, number>();
  const lastGear = new Map<string, { pct: number; pierceRow: number }>();
  for (let j = 0; j < GROUND_STATIC_SLOTS; j++) {
    const [type, gen] = EQUIP_KEYS[GROUND_EQUIP_KEYS[j]];
    const e = histStaticEntry(country, type, gen);
    const o = j * KS_FIELDS;
    const generic = STATIC_KEY_STATS.stats;
    if (e === undefined) {
      const tank = lastTank.get(type);
      if (tank !== undefined) {
        for (let f = 0; f < KS_FIELDS; f++) {
          t.stats[o + f] = t.stats[tank * KS_FIELDS + f];
        }
        t.score[j] = t.score[tank];
        lastTank.set(type, j);
        continue;
      }
      const gear = lastGear.get(type);
      if (gear === undefined) {
        weakKeyRow(t, j);
        continue;
      }
      for (const f of GEAR_FIELDS) {
        t.stats[o + f] = Math.floor((generic[o + f] * gear.pct) / 100);
      }
      const baseP = generic[gear.pierceRow * KS_FIELDS + KS.pierce];
      if (baseP > 0) {
        t.stats[o + KS.pierce] = Math.floor(
          (t.stats[gear.pierceRow * KS_FIELDS + KS.pierce] *
            generic[o + KS.pierce]) /
            baseP,
        );
      }
      continue;
    }
    if (e.family === "tank") {
      if (type !== "light_tank" && type !== "medium_tank") continue;
      const s = tankStatsOfEntry(e);
      t.stats[o + KS.soft] = s.soft;
      t.stats[o + KS.hard] = s.hard;
      t.stats[o + KS.def] = s.def;
      t.stats[o + KS.brk] = s.brk;
      t.stats[o + KS.pierce] = s.pierce;
      t.stats[o + KS.armor] = s.armor;
      t.stats[o + KS.hardnessPm] = s.hardnessPm;
      t.stats[o + KS.speedCenti] = s.speedCenti;
      t.stats[o + KS.aa] = s.aa;
      t.stats[o + KS.relPm] = s.relPm;
      t.stats[o + KS.fuelPct] = s.fuelPct;
      t.stats[o + KS.flags] = s.flags;
      t.score[j] = rowScore(t.stats, j, t.group[j], t.year[j]);
      lastTank.set(type, j);
      continue;
    }
    if (
      e.family !== "infantry" &&
      e.family !== "support" &&
      e.family !== "gun"
    ) {
      continue;
    }
    // ww91: a truck's row has no combat numbers; its reliability makes the
    // slot wear while the division moves (Sustain.attrition reads DS_HIST).
    if (type === "motorized") {
      if (e.family === "support" && e.spec.reliability !== undefined) {
        t.stats[o + KS.relPm] = RELIABILITY_PM[e.spec.reliability];
        t.stats[o + KS.flags] |= DS_HIST;
      }
      continue;
    }
    const g = histStatsOf(e) as GearStats;
    for (const f of GEAR_FIELDS) {
      t.stats[o + f] = Math.floor((generic[o + f] * g.statPct) / 100);
    }
    if (g.pierceCenti > 0) t.stats[o + KS.pierce] = g.pierceCenti;
    lastGear.set(type, { pct: g.statPct, pierceRow: j });
  }
}

/** The static key table of a country with the designer off (what the engine's buildKeyStats makes for a fresh division). */
export function histStaticKeyTable(tag: CountryTag): KeyStatsTable {
  const t: KeyStatsTable = {
    group: STATIC_KEY_STATS.group.slice(),
    year: STATIC_KEY_STATS.year.slice(),
    score: STATIC_KEY_STATS.score.slice(),
    stats: STATIC_KEY_STATS.stats.slice(),
  };
  fillStaticKeys(
    (HIST_COUNTRIES as readonly string[]).includes(tag)
      ? (tag as HistCountry)
      : null,
    t,
  );
  return t;
}
