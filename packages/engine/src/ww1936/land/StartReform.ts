// World War 1936: a human edits a start template in the preparation minute
// and its divisions are re-formed from the template's men budget (the rule
// itself is engine-lib's startReformCount; the lobby previews with it).
// Men and equipment move only through economy/Stock.ts: the old divisions'
// go back first, the new ones draw them again, the rest stays in the pool.
import {
  GROUND_EQUIP_KEYS,
  GROUND_SLOTS,
  WW_MAX_ARMY_DIVISIONS,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  apportion,
  startReformCount,
} from "@openfront/engine-lib/ww1936/StartReform";
import {
  genMixOf,
  templateStats,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import {
  drawEquip,
  drawManpower,
  drawOrderOf,
  drawTemplateEquip,
  returnDivisionEquip,
} from "../economy/Stock";
import type { CountryEconomy } from "../economy/WwEconomy";
import { autoGenerals } from "./GeneralsRun";
import type { CountryLand, LandTemplate, WwLand } from "./WwLand";

/** Remembers the template's budget from its first save in preparation; true: this save re-forms. */
export function noteStartBudget(
  land: WwLand,
  cl: CountryLand,
  ce: CountryEconomy,
  tpl: LandTemplate,
): boolean {
  // (Cleared when preparation ends, but a save on that very tick must not use it.)
  if (!land.ww.inPrep(land.mg.ticks())) return false;
  if (!land.ww.isHumanControlled(cl.smallID)) return false;
  // The whole start army was planned (start_oob): no per-template re-form after it.
  if (cl.startOob) return false;
  if (cl.startReform.some((e) => e.template === tpl.id)) return true;
  // Only a 1936 start template (its key stays until the player renames it).
  if (tpl.key === "") return false;
  const count = land
    .rowsOf(cl.smallID)
    .filter((r) => land.divisions.template[r] === tpl.id).length;
  if (count === 0) return false;
  const men = templateStats(
    tpl.def,
    ce.stats,
    genMixOf(new Array<number>(GROUND_SLOTS).fill(0)),
  ).men;
  cl.startReform.push({ template: tpl.id, count, budget: count * men });
  return true;
}

interface Gear {
  slots: number[];
  orgMilli: number;
}

/**
 * Re-forms the divisions of `tpl` (already holding its new def) from its
 * budget. False: not a single division could be filled, nothing changed
 * (the caller's refit applies).
 */
export function reformStartDivisions(
  land: WwLand,
  cl: CountryLand,
  ce: CountryEconomy,
  tpl: LandTemplate,
): boolean {
  const entry = cl.startReform.find((e) => e.template === tpl.id);
  if (entry === undefined) return false;
  const t = land.divisions;
  const rows = land.rowsOf(cl.smallID).filter((r) => t.template[r] === tpl.id);
  if (rows.length === 0) return false;
  const ks = land.keyStatsOf(cl.smallID);
  const s = templateStats(
    tpl.def,
    ce.stats,
    genMixOf(new Array<number>(GROUND_SLOTS).fill(0)),
  );

  // Everything the old divisions held goes back first.
  const givenMen = rows.reduce((n, r) => n + t.men[r], 0);
  const givenEquip = new Array<number>(GROUND_SLOTS).fill(0);
  for (const r of rows) {
    returnDivisionEquip(ce, t.equipOf(r), t.men[r]);
    const e = t.equipOf(r);
    for (let j = 0; j < GROUND_SLOTS; j++) givenEquip[j] += e[j];
  }

  // As many full-strength divisions as the budget, the cap and the stock allow.
  const order = drawOrderOf(ks);
  const full = (slots: number[]) =>
    s.need.every((need, g) => {
      const list = order[g];
      if (list === undefined || list.length === 0) return true;
      let have = 0;
      for (const j of list) have += slots[j];
      return have >= need;
    });
  const gear: Gear[] = [];
  const room = Math.max(
    1,
    Math.min(s.men > 0 ? Math.floor(entry.budget / s.men) : 0, 2 * entry.count),
  );
  for (let i = 0; i < room; i++) {
    if (!drawManpower(ce, s.men)) break;
    const slots = new Array<number>(GROUND_SLOTS).fill(0);
    drawTemplateEquip(ce, slots, s.need, ks);
    if (!full(slots)) {
      returnDivisionEquip(ce, slots, s.men);
      break;
    }
    gear.push({
      slots,
      orgMilli: templateStats(tpl.def, ce.stats, genMixOf(slots, ks), ks)
        .orgMilli,
    });
  }
  const n = startReformCount(entry.budget, entry.count, s.men, gear.length);
  for (const g of gear.splice(n)) returnDivisionEquip(ce, g.slots, s.men);
  if (n === 0) {
    // Undo the give-back exactly: the old divisions stay as they were.
    drawManpower(ce, givenMen);
    for (let j = 0; j < GROUND_SLOTS; j++) {
      drawEquip(ce, GROUND_EQUIP_KEYS[j], givenEquip[j]);
    }
    return false;
  }

  // Placement: each army's count scales proportionally; an army over the
  // cap gets a sibling in the same region.
  const armyIds: number[] = [];
  const region = new Map<number, number>();
  const had = new Map<number, number>();
  for (const r of rows) {
    const a = t.army[r];
    if (!had.has(a)) {
      armyIds.push(a);
      region.set(a, t.region[r]);
    }
    had.set(a, (had.get(a) ?? 0) + 1);
  }
  armyIds.sort((a, b) => a - b);
  const share = apportion(
    n,
    armyIds.map((a) => had.get(a) ?? 0),
  );
  const born = new Set<number>();
  let next = 0;
  const spawn = (armyId: number, count: number, at: number): void => {
    const a = land.armies.get(armyId);
    if (a === undefined) return;
    for (let i = 0; i < count; i++) {
      const g = gear[next++];
      land.spawnDivision(cl.smallID, tpl.id, at, a, s.men, g.slots, g.orgMilli);
    }
  };
  armyIds.forEach((id, i) => {
    const a = land.armies.get(id);
    if (a === undefined) return;
    const others = a.divisions.length - (had.get(id) ?? 0);
    const put = Math.min(share[i], Math.max(0, WW_MAX_ARMY_DIVISIONS - others));
    const at = region.get(id) ?? 0;
    spawn(id, put, at);
    let over = share[i] - put;
    while (over > 0) {
      const sib = land.newArmy(cl.smallID);
      if (sib === null) break;
      // Same region; a plan or an order carries over with its targets.
      sib.order = {
        ...a.order,
        targets: [...a.order.targets],
        zone: [...a.order.zone],
      };
      sib.pending = a.pending;
      sib.auto = a.auto;
      sib.autoLevel = a.autoLevel;
      sib.priority = a.priority;
      sib.group = a.group;
      born.add(sib.id);
      const k = Math.min(over, WW_MAX_ARMY_DIVISIONS);
      spawn(sib.id, k, at);
      over -= k;
    }
  });
  // Gear nobody took (no room for a new army) goes back.
  for (const g of gear.slice(next)) returnDivisionEquip(ce, g.slots, s.men);
  // The old divisions go; an army left with nothing goes with them.
  for (const r of rows) land.killDivision(r, false);
  land.markCountry(cl.smallID);
  // A new army uses the existing free-commander assignment.
  if (born.size > 0) autoGenerals(land, cl, land.day(), born);
  const p = land.mg.playerBySmallID(cl.smallID);
  if (p.isPlayer()) p.setTroops(land.fieldMen(cl.smallID));
  return true;
}
