import {
  GwNationState,
  GwSide,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { civilFromDays } from "@openfront/engine-lib/ww1936/Calendar";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { authorityStep } from "./Authority";
import { warMonths } from "./Eras";
import { allocOf } from "./Fronts";
import type { GreatWar } from "./GreatWar";
import { GW_CONCEDES, GW_HOME } from "./HomeTable";
import { officeHolder, recordResult } from "./People";
import { changeRegime, regimeRow, successionStep } from "./Regimes";
import { seaFor } from "./Sea";
import { leaveWar } from "./Wars";
import {
  everyMonths,
  fights,
  isLongChapter,
  monthsOf,
  moveGauge,
  news,
  reason,
  seatsOf,
} from "./World";

const P_HARVEST = idHash("gw_harvest");
const P_CONCEDE = idHash("gw_concede");

/** Chapters of order at the bottom for each rung (design §4.6). */
const LADDER = [0, 2, 4, 6, 8];

/** Countries the war never reaches at home. */
const FAR_FROM_IT: readonly GwTag[] = ["JPN", "USA"];

function shells(gw: GreatWar, n: GwNationState): void {
  const a = allocOf(gw, n.tag);
  if (a?.posture === "offensive" && a.scale === "major") {
    moveGauge(gw, n.tag, "shells", -1, "shells_spent");
  }
  // War factories come slowly, and only with money behind them.
  if (everyMonths(gw, n.gauges.money > 0 ? 2 : 4)) {
    moveGauge(gw, n.tag, "shells", 1, "shells_made");
  }
  if (
    n.tag === "DEU" &&
    gw.s.secrets.includes("deu_shell_stock_thin") &&
    gw.s.chapter === (gw.s.warChapter ?? 0) + 2
  ) {
    moveGauge(gw, n.tag, "shells", -1, "shells_stock_thin");
  }
  for (const seat of seatsOf(gw, n.tag)) {
    const minister = officeHolder(gw, seat, "war");
    if (minister === null || !everyMonths(gw, 4, 1)) continue;
    const skill = minister.competence[2];
    if (skill === 3) moveGauge(gw, n.tag, "shells", 1, "shells_well_run");
    if (skill === 1) moveGauge(gw, n.tag, "shells", -1, "shells_badly_run");
    if (skill !== 2) recordResult(gw, minister.id, skill === 3);
  }
}

/** Sides the year's harvest failed for; the seed's, one bad year or two a war. */
function badHarvest(gw: GreatWar, year: number, side: GwSide | null): boolean {
  const i = side === "central" ? 1 : 0;
  return wwRoll(gw.s.seed, P_HARVEST, year, i) % 100 < 22;
}

function bread(gw: GreatWar, n: GwNationState): void {
  const s = gw.s;
  const date = civilFromDays(s.day);
  const harvest = date.month === 9 || (date.month === 10 && monthsOf(gw) > 1);
  if (harvest) {
    const bad = badHarvest(gw, date.year, n.side);
    if (!bad) moveGauge(gw, n.tag, "bread", 1, "bread_harvest");
    else moveGauge(gw, n.tag, "bread", -1, "bread_bad_harvest");
  }
  seaFor(gw, n);
}

function money(gw: GreatWar, n: GwNationState): void {
  if (everyMonths(gw, 6)) moveGauge(gw, n.tag, "money", -1, "money_war_costs");
  // AI treasuries borrow as a seat does through its scenes.
  const borrows = seatsOf(gw, n.tag).length === 0 && n.gauges.money === 0;
  if (borrows && everyMonths(gw, 6, 3)) {
    moveGauge(gw, n.tag, "money", 1, "money_war_costs");
  }
}

function strains(gw: GreatWar, n: GwNationState): void {
  const s = gw.s;
  const months = warMonths(gw);
  for (const r of GW_HOME[n.tag]?.strains ?? []) {
    if (months < (r.from ?? 0) || !everyMonths(gw, r.every, r.offset ?? 0)) {
      continue;
    }
    if (r.thread !== undefined && !s.threads.includes(r.thread)) continue;
    if (r.secret !== undefined && !s.secrets.includes(r.secret)) continue;
    if (
      r.unless !== undefined &&
      (n.inst[r.unless.inst] ?? 0) >= r.unless.min
    ) {
      continue;
    }
    moveGauge(gw, n.tag, r.gauge, r.delta, r.key);
  }
}

function mood(gw: GreatWar, n: GwNationState): void {
  if (n.gauges.bread === 0 && everyMonths(gw, 2)) {
    moveGauge(gw, n.tag, "order", -1, "order_hunger");
  }
  if (n.gauges.morale === 0 && everyMonths(gw, 2, 1)) {
    moveGauge(gw, n.tag, "order", -1, "order_despair");
  }
  if (n.gauges.money === 0 && everyMonths(gw, 4)) {
    moveGauge(gw, n.tag, "order", -1, "order_unpaid");
  }
  const heavy = n.lostNow;
  if (heavy >= 350) moveGauge(gw, n.tag, "order", -1, "order_casualties");
  // A country gets its breath back when nothing is breaking.
  if (everyMonths(gw, 3) && heavy < 150) {
    moveGauge(gw, n.tag, "morale", 1, "morale_steadied");
  }
  if (everyMonths(gw, 4, 2) && n.gauges.bread > 0 && n.gauges.morale > 1) {
    moveGauge(gw, n.tag, "order", 1, "order_steadied");
  }
}

/** The way down an AI government takes: it pays, or it can't. */
function aiConcedes(gw: GreatWar, n: GwNationState): void {
  const s = gw.s;
  if (seatsOf(gw, n.tag).length > 0 || n.unrest === 0) return;
  const broke = n.gauges.money === 0;
  const pct = (GW_HOME[n.tag]?.concedes ?? GW_CONCEDES) >> (broke ? 1 : 0);
  const roll = wwRoll(s.seed, P_CONCEDE, s.chapter, s.nations.indexOf(n)) % 100;
  if (roll >= pct) return;
  if (!broke) n.gauges.money--;
  n.unrest--;
  n.lowOrder = Math.max(0, n.lowOrder - 2);
  n.gauges.order = Math.min(5, n.gauges.order + 1);
}

/** The top of the ladder for a country nobody plays. */
function aiFalls(gw: GreatWar, n: GwNationState): void {
  const next = regimeRow(n)?.next ?? null;
  if (next !== null) {
    changeRegime(gw, n.tag, next);
    return;
  }
  leaveWar(gw, n.tag, "nation_collapsed");
}

/** The rung so many chapters at the bottom reach, `months` into the war. */
export function ladderRung(
  lowOrder: number,
  months: number,
  topFrom = 0,
): number {
  const rung = LADDER.filter((x, i) => i > 0 && lowOrder >= x).length;
  return months < topFrom ? Math.min(rung, LADDER.length - 2) : rung;
}

/** The ladder: each rung has its turn and its offer of a way down. */
function ladder(gw: GreatWar, n: GwNationState): void {
  const bottom = n.gauges.order === 0;
  n.lowOrder = bottom ? n.lowOrder + 1 : Math.max(0, n.lowOrder - 1);
  const rung = ladderRung(n.lowOrder, warMonths(gw), GW_HOME[n.tag]?.topFrom);
  if (rung <= n.unrest) {
    if (!bottom && n.unrest > 0 && n.lowOrder === 0) n.unrest--;
    return;
  }
  n.unrest = rung;
  news(gw, `unrest_${rung}`, n.tag);
  const row = GW_HOME[n.tag];
  const own = row?.top?.[n.regime];
  const written = gwContent().scenes.some((x) => x.id === own);
  const scene =
    rung === 4 && written ? own! : (row?.rungs[rung - 1] ?? "gw_unrest");
  for (const seat of seatsOf(gw, n.tag)) {
    reason(gw, seat, `unrest_${rung}`);
    seat.scheduled.push({ scene, chapter: gw.s.chapter + 1 });
  }
  if (seatsOf(gw, n.tag).length === 0) {
    if (rung >= 4) aiFalls(gw, n);
    else aiConcedes(gw, n);
  }
}

/** Chapter step: the home front of every country, with its reason lines. */
export function homeStep(gw: GreatWar): void {
  successionStep(gw);
  const atWar = gw.s.warChapter !== null;
  for (const n of gw.s.nations) {
    authorityStep(gw, n);
    if (!fights(n) || !atWar || !isLongChapter(gw)) continue;
    if (FAR_FROM_IT.includes(n.tag)) continue;
    shells(gw, n);
    bread(gw, n);
    money(gw, n);
    strains(gw, n);
    mood(gw, n);
    ladder(gw, n);
  }
}
