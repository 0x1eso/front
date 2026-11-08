// ww162 lane L5b (design ww162 §1.5, §2; Design A §3): the army HUD's pure
// parts — the supply line's shortage and days, the group's summed line,
// the [사단] list's groups and picks, the stock table's [부족순] sort and its
// fronts / training split, and the event that lights stock rows.
import { EQUIPMENT_TYPES } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  type ArmySummary,
  type DivisionData,
  NEED_GROUPS,
} from "@openfront/engine-api/ww1936/LandTypes";
import type { GameEvent } from "@openfront/shared/EventBus";
import { translateText } from "../../Utils";
import { equipmentName, type StockTableRow } from "./EconomyModel";

/** The HUD's own text keys (en.json and ko.json); the planner's are in PlannerKeys. */
export const ARMY_HUD_KEYS = {
  blockNoFallback: "ww1936.army_hud.block_no_fallback",
  btnWholeArmy: "ww1936.army_hud.btn_whole_army",
  commandDivision: "ww1936.army_hud.command_division",
  /** Params: a, b (region names). */
  lineFront: "ww1936.army_hud.line_front",
  /** Params: n. */
  lineFallback: "ww1936.army_hud.line_fallback",
  /** Params: n. */
  lineGoal: "ww1936.army_hud.line_goal",
  /** Params: n. */
  lineGoalRunning: "ww1936.army_hud.line_goal_running",
  /** Params: n. */
  lineSpear: "ww1936.army_hud.line_spear",
  /** Params: n. */
  lineSpearRunning: "ww1936.army_hud.line_spear_running",
  /** Params: n. */
  picked: "ww1936.army_hud.picked",
  /** Params: region. */
  pinnedTo: "ww1936.army_hud.pinned_to",
  splitOff: "ww1936.army_hud.split_off",
  splitOn: "ww1936.army_hud.split_on",
  /** Params: n. */
  supplyDays: "ww1936.army_hud.supply_days",
  supplyFromStock: "ww1936.army_hud.supply_from_stock",
  /** Params: name, n. */
  supplyItem: "ww1936.army_hud.supply_item",
  supplyNoOutput: "ww1936.army_hud.supply_no_output",
  /** Params: list. */
  supplyShort: "ww1936.army_hud.supply_short",
  /** Params: pct. */
  supplyStrength: "ww1936.army_hud.supply_strength",
  /** Params: n. */
  stockFronts: "ww1936.econ.stock_short_fronts",
  stockSortShort: "ww1936.econ.stock_sort_short",
  stockSortType: "ww1936.econ.stock_sort_type",
  /** Params: n. */
  stockTraining: "ww1936.econ.stock_short_training",
} as const;

/** The design-only need groups' names (the stock table's words). */
const EXTRA_GROUP_KEYS = [
  "ww1936.battalion.heavy_armor",
  "ww1936.battalion.tank_destroyer",
  "ww1936.battalion.sp_artillery",
  "ww1936.battalion.sp_anti_air",
] as const;

/** A need group's name, as the stock table names its row. */
export function needGroupName(g: number): string {
  if (g < EQUIPMENT_TYPES.length) return equipmentName(EQUIPMENT_TYPES[g]);
  return translateText(EXTRA_GROUP_KEYS[g - EQUIPMENT_TYPES.length] ?? "");
}

// ---- The supply line (Design A §3) ----

export interface SupplyLine {
  /** The two shortest need groups, [NEED_GROUPS index, units missing]. */
  short: [number, number][];
  /**
   * Days until the country's stock and today's output cover those groups
   * (the stock table's own days, the longest of the two); 0: the stockpile
   * already holds enough; null: one of them has no production at all.
   */
  days: number | null;
}

/**
 * The army card's supply line from `short` (ArmyMineData.short, or a
 * group's sum) and the stock table's rows: null when nothing is short.
 */
export function supplyLine(
  short: readonly (readonly [number, number])[] | undefined,
  rows: readonly StockTableRow[],
): SupplyLine | null {
  const list = (short ?? []).filter(([, n]) => n > 0).slice(0, 2);
  if (list.length === 0) return null;
  let days: number | null = 0;
  for (const [g] of list) {
    const row = rows.find((r) => r.id === NEED_GROUPS[g]);
    const st = row?.status;
    if (st === undefined || st.kind === "no_line" || st.kind === "unknown") {
      days = null;
      break;
    }
    if (st.kind === "days") days = Math.max(days, st.days);
  }
  return { short: list.map(([g, n]) => [g, n]), days };
}

/** The supply line's words: strength, the short list, and the days (amber: no production). */
export function supplyWords(
  line: SupplyLine,
  strengthPm: number,
): { strength: string; short: string; days: string; amber: boolean } {
  const list = line.short
    .map(([g, n]) =>
      translateText(ARMY_HUD_KEYS.supplyItem, { name: needGroupName(g), n }),
    )
    .join(", ");
  return {
    strength: translateText(ARMY_HUD_KEYS.supplyStrength, {
      pct: Math.floor(strengthPm / 10),
    }),
    short: translateText(ARMY_HUD_KEYS.supplyShort, { list }),
    days:
      line.days === null
        ? translateText(ARMY_HUD_KEYS.supplyNoOutput)
        : line.days === 0
          ? translateText(ARMY_HUD_KEYS.supplyFromStock)
          : translateText(ARMY_HUD_KEYS.supplyDays, { n: line.days }),
    amber: line.days === null,
  };
}

/** The divisions' average strength over armies, ‰ (by division count). */
export function meanStrengthPm(armies: readonly ArmySummary[]): number {
  let n = 0;
  let sum = 0;
  for (const a of armies) {
    n += a.divisions;
    sum += a.strengthPm * a.divisions;
  }
  return n === 0 ? 0 : Math.floor(sum / n);
}

/** A group's line (Design A §3): its armies' shortages summed per need group, the two biggest. */
export function groupShort(armies: readonly ArmySummary[]): [number, number][] {
  const sum = new Map<number, number>();
  for (const a of armies) {
    for (const [g, n] of a.mine?.short ?? []) {
      sum.set(g, (sum.get(g) ?? 0) + n);
    }
  }
  return [...sum.entries()]
    .filter(([, n]) => n > 0)
    .sort((x, y) => y[1] - x[1] || x[0] - y[0])
    .slice(0, 2);
}

/** The planning bar's cap in %, from the country's planMaxBp stat (3000 bp + techs and spirits). */
export function planMaxPct(statPlanMaxBp: number): number {
  return Math.max(1, Math.floor((3000 + statPlanMaxBp) / 100));
}

// ---- The [사단] list (design §2) ----

export interface DivisionGroup {
  region: number;
  /** The army's divisions standing there, by id. */
  divisions: DivisionData[];
}

/** The army's divisions grouped by the region they stand in (regions, then ids, ascending). */
export function divisionGroups(
  divisions: readonly DivisionData[],
  army: number,
): DivisionGroup[] {
  const by = new Map<number, DivisionData[]>();
  for (const d of divisions) {
    if (d.army !== army) continue;
    const l = by.get(d.region);
    if (l === undefined) by.set(d.region, [d]);
    else l.push(d);
  }
  return [...by.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([region, l]) => ({
      region,
      divisions: [...l].sort((a, b) => a.id - b.id),
    }));
}

/**
 * A check tapped in the list: `ids` all picked go; otherwise they are all
 * added. The picks stay ascending and unique.
 */
export function togglePick(
  picked: readonly number[],
  ids: readonly number[],
): number[] {
  const set = new Set(picked);
  const all = ids.length > 0 && ids.every((id) => set.has(id));
  for (const id of ids) {
    if (all) set.delete(id);
    else set.add(id);
  }
  return [...set].sort((a, b) => a - b);
}

/** The pin of a division ([division id, region] list), or null. */
export function pinOf(
  pins: readonly (readonly [number, number])[] | undefined,
  division: number,
): number | null {
  return pins?.find(([d]) => d === division)?.[1] ?? null;
}

// ---- The stock table (Design A §3) ----

/** Whether the table opens sorted by shortage: anything short. */
export function stockSortsShort(rows: readonly StockTableRow[]): boolean {
  return rows.some((r) => (r.short ?? 0) > 0);
}

/**
 * The table's order: [부족순] puts the rows short of something first, the
 * biggest shortage first; otherwise (and after them) the type order.
 */
export function sortStock(
  rows: readonly StockTableRow[],
  byShort: boolean,
): StockTableRow[] {
  const order = (r: StockTableRow) => {
    const i = (NEED_GROUPS as readonly string[]).indexOf(r.id);
    return i < 0 ? NEED_GROUPS.length : i;
  };
  const typed = [...rows].sort((a, b) => order(a) - order(b));
  if (!byShort) return typed;
  const missing = typed.filter((r) => (r.short ?? 0) > 0);
  missing.sort((a, b) => (b.short ?? 0) - (a.short ?? 0));
  return [...missing, ...typed.filter((r) => (r.short ?? 0) <= 0)];
}

/**
 * The "short" cell split (Design A §3): the fielded armies' part, summed
 * from each army's two shortest groups (ArmyMineData.short), and the rest
 * (trainees). The armies send only their two biggest gaps, so an army short
 * of three or more groups counts under training for the third: the fronts
 * part is a floor.
 */
export function shortSplit(
  armies: readonly ArmySummary[],
  group: number,
  total: number,
): { fronts: number; training: number } {
  let fronts = 0;
  for (const a of armies) {
    for (const [g, n] of a.mine?.short ?? []) if (g === group) fronts += n;
  }
  fronts = Math.min(Math.max(0, total), fronts);
  return { fronts, training: Math.max(0, total - fronts) };
}

/**
 * The army card's supply line was tapped: the industry drawer opens on its
 * production tab with these need groups' rows lit for 2 s.
 */
export class WwStockLitEvent implements GameEvent {
  constructor(readonly groups: readonly number[]) {}
}

/** How long lit stock rows keep their outline. */
export const STOCK_LIT_MS = 2000;
