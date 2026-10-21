// World War 1936 P1: production lines (spec §8): factories assigned top
// down, resources allocated in line order (§7.3), output into the
// stockpile, and the HOI4 efficiency rules (§8.3).
import {
  EQUIP_KEYS,
  equipKey,
  EquipmentType,
  WW_MAX_LINE_FACTORIES,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  addLineBlockOf,
  equipmentTechBlock,
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
  const block = addLineBlockOf(ce.researched, ce.lines.length, type, gen);
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
  const block = equipmentTechBlock(ce.researched, type, gen);
  if (block !== null) return block;
  const line = ce.lines[i];
  const [from, fromGen] = EQUIP_KEYS[line.key];
  if (from === type && fromGen === gen) return null;
  line.effBp = effAfterSwitch(
    line.effBp,
    from,
    fromGen,
    type,
    gen,
    ce.stats.retentionBp,
  );
  line.key = equipKey(type, gen);
  line.progress = 0;
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
  ce.lines[i].factories = factoryCount(factories);
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

/**
 * One day of resource allocation and production for `ce` (spec §7.3,
 * §8.2–§8.3): trim the lines to the working military factories from the
 * bottom, allocate resources in line order, produce, then grow efficiency.
 */
export function stepProduction(econ: WwEconomy, ce: CountryEconomy): void {
  const t = ce.totals;
  let avail = t.mil;
  for (const line of ce.lines) {
    const now = Math.min(line.factories, avail);
    avail -= now;
    if (now > line.active) {
      line.effBp = effAfterAdding(line.effBp, line.active, now - line.active);
    }
    line.active = now;
  }
  t.idleMil = avail;
  const available = t.produced.map((v, k) => v - t.exported[k] + t.imported[k]);
  // P4 spec §5.2: after every P1 line the naval lines, in their order
  // (lane E's demand); each naval line's fill is today's share.
  const naval = navalLineDemand(econ, ce);
  const alloc = allocateResources(
    available,
    ce.lines.map((l) => ({ key: l.key, factories: l.active })),
    naval,
  );
  t.used = alloc.used;
  naval.forEach((_, i) => {
    const l = ce.navalLines[i];
    if (l !== undefined) l.fill = alloc.extraFill[i];
  });
  const outputPct = ce.law().outputPct + ce.stats.outputPct;
  const cap = effCapBp(ce.stats);
  ce.lines.forEach((line, i) => {
    line.fill = alloc.fill[i];
    if (line.active === 0) {
      line.lastOutput = 0;
      return;
    }
    const out = lineOutputMilli(line.active, line.effBp, outputPct, line.fill);
    line.lastOutput = out;
    line.progress += out;
    const [type, gen] = EQUIP_KEYS[line.key];
    const cost = unitCostMilli(type, gen);
    const units = Math.floor(line.progress / cost);
    ce.stock[line.key] += units;
    line.progress -= units * cost;
    line.effBp = efficiencyGrowth(line.effBp, cap);
  });
}
