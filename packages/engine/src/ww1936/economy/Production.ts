// World War 1936 P1: production lines (spec §8): factories assigned top
// down, resources allocated in line order (§7.3), output into the
// stockpile, and the HOI4 efficiency rules (§8.3).
import { MIO_FAMILIES } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  EQUIP_KEYS,
  equipKey,
  EquipmentType,
  WW_MAX_LINE_FACTORIES,
  WwLineStop,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WwStatKey } from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  addLineBlockOf,
  equipmentTechBlock,
  LineDepthCtx,
  lineDepthCtxOf,
} from "@openfront/engine-lib/ww1936/EconomyChecks";
import {
  allocateResources,
  EFF_FLOOR_BP,
  effAfterAdding,
  effAfterSwitch,
  effCapBp,
  efficiencyGrowth,
  lineOutputMilli,
} from "@openfront/engine-lib/ww1936/EconomyRules";
import { unitCostMilli } from "@openfront/engine-lib/ww1936/Equipment";
import { mioFamilyOf } from "@openfront/engine-lib/ww1936/MioRules";
import {
  conversionCostMilli,
  equipCostMilli,
  equipResources,
  lineRetentionBp,
} from "../depth/Designs";
import { licenceKeys } from "../depth/Licences";
import { mioFamilyOfKey } from "../depth/Mio";
import type { WwDepth } from "../depth/WwDepth";
import { navalLineDemand } from "./NavalLines";
import type { CountryEconomy, Line, WwEconomy } from "./WwEconomy";

/** 0..WW_MAX_LINE_FACTORIES; a value that is no number at all (NaN) is 0. */
export function factoryCount(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(WW_MAX_LINE_FACTORIES, Math.floor(n)));
}

function lineIndex(ce: CountryEconomy, lineId: number): number {
  return ce.lines.findIndex((l) => l.id === lineId);
}

/** Spec §8.4: a new line at the bottom, starting at the efficiency floor. */
export function addLine(
  econ: WwEconomy,
  ce: CountryEconomy,
  type: EquipmentType,
  gen: number,
  factories: number,
): WwOrderBlock | null {
  const block = addLineBlockOf(
    ce.researched,
    ce.lines.length,
    type,
    gen,
    lineDepthCtx(econ, ce),
  );
  if (block !== null) return block;
  const line: Line = {
    id: ce.nextLineId++,
    key: equipKey(type, gen),
    factories: factoryCount(factories),
    active: 0,
    effBp: EFF_FLOOR_BP,
    progress: 0,
    fill: 1000,
    lastOutput: 0,
    convertFrom: -1,
  };
  ce.lines.push(line);
  return null;
}

/** Spec §8.3: retool a line; it keeps part of its efficiency, not its progress. */
export function changeLine(
  econ: WwEconomy,
  ce: CountryEconomy,
  lineId: number,
  type: EquipmentType,
  gen: number,
): WwOrderBlock | null {
  const i = lineIndex(ce, lineId);
  if (i < 0) return "bad_line";
  const block = equipmentTechBlock(
    ce.researched,
    type,
    gen,
    lineDepthCtx(econ, ce),
  );
  if (block !== null) return block;
  const line = ce.lines[i];
  const [from, fromGen] = EQUIP_KEYS[line.key];
  if (from === type && fromGen === gen) return null;
  // P6 hook (E, spec §5.5): a design's retention, else P1's rule.
  const toKey = equipKey(type, gen);
  const depth = econ.ww.depth as WwDepth | undefined;
  const bp =
    depth === undefined
      ? -1
      : lineRetentionBp(depth, ce.smallID, line.key, toKey);
  line.effBp =
    bp >= 0
      ? Math.max(EFF_FLOOR_BP, Math.floor((line.effBp * bp) / 10_000))
      : effAfterSwitch(
          line.effBp,
          from,
          fromGen,
          type,
          gen,
          ce.stats.retentionBp,
        );
  line.key = toKey;
  line.progress = 0;
  line.convertFrom = -1;
  // ww115 T6: what it remembers it ran on the old equipment.
  delete line.peak;
  return null;
}

/** The factories asked for; the working count follows on the next day. */
export function setLineFactories(
  econ: WwEconomy,
  ce: CountryEconomy,
  lineId: number,
  factories: number,
): WwOrderBlock | null {
  const i = lineIndex(ce, lineId);
  if (i < 0) return "bad_line";
  const line = ce.lines[i];
  const n = factoryCount(factories);
  // P6 (lane M review glue 4, spec §7.1): a stopped line is staffed again
  // only if its equipment may still be built — a line a licence's end
  // stopped stays stopped until it is retooled.
  if (line.factories === 0 && n > 0) {
    const [type, gen] = EQUIP_KEYS[line.key];
    const block = equipmentTechBlock(
      ce.researched,
      type,
      gen,
      lineDepthCtx(econ, ce),
    );
    if (block !== null) return block;
  }
  line.factories = n;
  return null;
}

export function removeLine(
  econ: WwEconomy,
  ce: CountryEconomy,
  lineId: number,
): WwOrderBlock | null {
  const i = lineIndex(ce, lineId);
  if (i < 0) return "bad_line";
  ce.lines.splice(i, 1);
  return null;
}

/** Moves a line to position `to` (0 = top: first factories, first resources). */
export function moveLine(
  econ: WwEconomy,
  ce: CountryEconomy,
  lineId: number,
  to: number,
): WwOrderBlock | null {
  const i = lineIndex(ce, lineId);
  if (i < 0) return "bad_line";
  if (!(to >= 0 && to < ce.lines.length)) return "bad_index";
  const [line] = ce.lines.splice(i, 1);
  ce.lines.splice(to, 0, line);
  return null;
}

/** ww115 T6: a line forgets one factory it lost every this many days. */
export const LINE_PEAK_FORGET_DAYS = 30;

/**
 * ww115 T6: the line's working factories become `now`. Factories coming
 * back within the recent count (bombed, taken or trimmed, then repaired)
 * rejoin without a penalty; only ones past it join at the floor. An order
 * for fewer factories gives the memory up (it is capped by line.factories),
 * so moving factories between lines by hand costs what it always did.
 */
function staffLine(line: Line, now: number, day: number): void {
  const had = line.active;
  const known = Math.max(line.peak ?? 0, had);
  if (now > had) {
    const back = Math.min(now, known);
    line.effBp = effAfterAdding(line.effBp, back, now - back);
  }
  line.active = now;
  let peak = Math.min(known, line.factories);
  if (peak > now && day % LINE_PEAK_FORGET_DAYS === 0) peak--;
  if (peak > now) line.peak = peak;
  else if (line.peak !== undefined) delete line.peak;
}

/**
 * One day of resource allocation and production for `ce` (spec §7.3,
 * §8.2–§8.3): trim the lines to the working military factories from the
 * bottom, allocate resources in line order, produce, then grow efficiency.
 */
export function stepProduction(
  econ: WwEconomy,
  ce: CountryEconomy,
  day = econ.day(),
): void {
  const t = ce.totals;
  let avail = t.mil;
  for (const line of ce.lines) {
    const now = Math.min(line.factories, avail);
    avail -= now;
    staffLine(line, now, day);
  }
  t.idleMil = avail;
  const available = t.produced.map((v, k) => v - t.exported[k] + t.imported[k]);
  // P4 spec §5.2: after every P1 line the naval lines, in their order
  // (lane E's demand); each naval line's fill is today's share.
  const naval = navalLineDemand(econ, ce);
  // P6 hook (E, S, W1; plan decision 22): designs' resources per factory,
  // and uranium and coal taken first.
  const depth = econ.ww.depth as WwDepth | undefined;
  // w69: an exile under licence_gear_only (France) makes only licensed gear;
  // ww115: a locked line makes nothing, so it takes no resources either.
  const licensed = gearLicences(econ, depth, ce.smallID);
  const makes = (l: Line) => licensed === null || licensed.has(l.key);
  const alloc = allocateResources(
    available,
    ce.lines.map((l) =>
      depth === undefined
        ? { key: l.key, factories: l.active }
        : {
            key: l.key,
            factories: makes(l) ? l.active : 0,
            per: equipResources(depth, ce.smallID, l.key),
          },
    ),
    naval,
    depth === undefined ? [] : depth.priorityDemand(ce.smallID),
  );
  depth?.priorityGot(ce.smallID, alloc.preGot);
  t.used = alloc.used;
  naval.forEach((_, i) => {
    const l = ce.navalLines[i];
    if (l !== undefined) l.fill = alloc.extraFill[i];
  });
  // P6 hook (W1, plan decision 22): yesterday's energy shortage.
  const outputPct =
    ce.law().outputPct +
    ce.stats.outputPct +
    (depth?.energyOutputPct(ce.smallID) ?? 0);
  const cap = effCapBp(ce.stats);
  ce.lines.forEach((line, i) => {
    line.fill = alloc.fill[i];
    if (line.active === 0 || !makes(line)) {
      line.lastOutput = 0;
      return;
    }
    const out = lineOutputMilli(line.active, line.effBp, outputPct, line.fill);
    line.lastOutput = out;
    line.progress += out;
    const [type, gen] = EQUIP_KEYS[line.key];
    // P6 hook (E): a design's cost (the stub: P1's table).
    const cost =
      depth === undefined
        ? unitCostMilli(type, gen)
        : equipCostMilli(depth, ce.smallID, line.key);
    if (cost <= 0) {
      line.progress = 0;
      return;
    }
    // P6 hook (E, spec §5.5): a converting line rebuilds stock it takes.
    const conv =
      depth === undefined || line.convertFrom < 0
        ? null
        : conversionCostMilli(depth, ce.smallID, line.id, line.key);
    if (conv === null) {
      const units = Math.floor(line.progress / cost);
      ce.stock[line.key] += units;
      line.progress -= units * cost;
    } else {
      for (;;) {
        const from = ce.stock[line.convertFrom] ?? 0;
        const c = from > 0 ? Math.max(1, conv) : cost;
        if (line.progress < c) break;
        line.progress -= c;
        if (from > 0) ce.stock[line.convertFrom]--;
        ce.stock[line.key]++;
      }
    }
    line.effBp = efficiencyGrowth(
      line.effBp,
      lineCapBp(depth, ce, cap, line.key),
      ce.stats.effGrowthPct,
    );
  });
}

/** mioEffCapBp_<family> by MIO_FAMILIES index (final perf lane: built once). */
const MIO_CAP_KEYS = MIO_FAMILIES.map(
  (f) => `mioEffCapBp_${f.slice(4)}` as WwStatKey,
);

/**
 * P6 hook (M, spec §6.3): the line's MIO efficiency cap on top of the
 * country's. Lane M review glue 3: a plane design's family goes by its
 * airframe (mioFamilyOfKey reads the design slot).
 */
export function lineCapBp(
  depth: WwDepth | undefined,
  ce: CountryEconomy,
  cap: number,
  lineKey: number,
): number {
  const fam =
    depth === undefined
      ? mioFamilyOf(EQUIP_KEYS[lineKey][0])
      : mioFamilyOfKey(depth, ce.smallID, lineKey);
  if (fam < 0) return cap;
  const key = MIO_CAP_KEYS[fam];
  const add = (ce.stats as Partial<Record<WwStatKey, number>>)[key] ?? 0;
  return add === 0 ? cap : Math.max(EFF_FLOOR_BP, Math.min(10_000, cap + add));
}

/**
 * P6 (plan decision 5, spec §7.1): the depth layer's word on a line's
 * equipment — a usable design slot, licences, projects done.
 */
export function lineDepthCtx(
  econ: WwEconomy,
  ce: CountryEconomy,
): LineDepthCtx | undefined {
  const depth = econ.ww.depth as WwDepth | undefined;
  if (depth === undefined || depth.country(ce.smallID) === null) {
    return undefined;
  }
  return lineDepthCtxOf(
    (kind, slot) => depth.designSlot(ce.smallID, kind, slot),
    depth.market.licences,
    ce.smallID,
    depth.country(ce.smallID)?.proj.done ?? 0,
  );
}

/**
 * ww115 T12: why each line of `ce` makes nothing now, in line order;
 * undefined for a line that works or one simply set to no factories.
 */
export function lineStops(
  econ: WwEconomy,
  ce: CountryEconomy,
): (WwLineStop | undefined)[] {
  const depth = econ.ww.depth as WwDepth | undefined;
  const licensed = gearLicences(econ, depth, ce.smallID);
  // The factories as stepProduction hands them out, so a line added today or
  // in the preparation minute (active 0 until its first day) is not "stopped".
  let avail = ce.totals.mil;
  return ce.lines.map((l) => {
    const now = Math.min(l.factories, avail);
    avail -= now;
    if (licensed !== null && !licensed.has(l.key)) return "licence_only";
    if (l.factories > 0) return now === 0 ? "no_factories" : undefined;
    const [type, gen] = EQUIP_KEYS[l.key];
    return equipmentTechBlock(
      ce.researched,
      type,
      gen,
      lineDepthCtx(econ, ce),
    ) === null
      ? undefined
      : "not_allowed";
  });
}

/**
 * w69: the keys an exile with the licence_gear_only spirit may still make
 * (the ones it holds a licence for); null when no such lock is on.
 */
function gearLicences(
  econ: WwEconomy,
  depth: WwDepth | undefined,
  id: number,
): Set<number> | null {
  if (depth === undefined) return null;
  const pol = econ.ww.politics;
  const c = pol.country(id);
  if (c === null || c.spirits.length === 0) return null;
  let locked = false;
  for (const s of c.spirits) {
    if (pol.content.spiritIdx.get(s.id)?.rules?.includes("licence_gear_only")) {
      locked = true;
      break;
    }
  }
  if (!locked || !econ.ww.endgame.isExile(id)) return null;
  return new Set(licenceKeys(depth, id));
}
