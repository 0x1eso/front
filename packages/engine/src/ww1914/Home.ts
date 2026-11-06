import { GwNationState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import { civilFromDays } from "@openfront/engine-lib/ww1936/Calendar";
import { allocOf } from "./Fronts";
import type { GreatWar } from "./GreatWar";
import { officeHolder, openLetter, recordResult } from "./People";
import { leaveWar } from "./Wars";
import {
  clampTo,
  everyMonths,
  fights,
  isLongChapter,
  monthsOf,
  moveGauge,
  news,
  reason,
  seatsOf,
} from "./World";

/** Chapters of order at the bottom for each rung (design §4.6). */
const LADDER = [0, 2, 4, 6, 8];
/** Authority back each chapter. */
const AUTHORITY_BACK = 4;

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

function bread(gw: GreatWar, n: GwNationState): void {
  const s = gw.s;
  const month = civilFromDays(s.day).month;
  const harvest = month === 9 || (month === 10 && monthsOf(gw) > 1);
  if (harvest) {
    moveGauge(gw, n.tag, "bread", 1, "bread_harvest");
  }
  const sea = s.theatres.find((t) => t.id === "sea")!;
  const blocked =
    n.side === "central" && gw.nation("GBR")?.side === "entente" && sea.open;
  if (blocked && everyMonths(gw, sea.line === 0 ? 4 : 6)) {
    moveGauge(gw, n.tag, "bread", -1, "bread_blockade");
  }
  if (n.tag === "GBR" && s.uboat === 2 && everyMonths(gw, 4)) {
    moveGauge(gw, n.tag, "bread", -1, "bread_uboats");
  }
  if (n.tag === "RUS" && everyMonths(gw, 8, 12)) {
    moveGauge(gw, n.tag, "bread", -1, "bread_rail");
  }
}

function money(gw: GreatWar, n: GwNationState): void {
  if (everyMonths(gw, 6)) moveGauge(gw, n.tag, "money", -1, "money_war_costs");
  // AI treasuries borrow as a seat does through its scenes.
  const borrows = seatsOf(gw, n.tag).length === 0 && n.gauges.money === 0;
  if (borrows && everyMonths(gw, 6, 3)) {
    moveGauge(gw, n.tag, "money", 1, "money_war_costs");
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
  if (heavy >= 300) moveGauge(gw, n.tag, "order", -1, "order_casualties");
  // A country gets its breath back when nothing is breaking.
  if (everyMonths(gw, 3) && heavy < 150) {
    moveGauge(gw, n.tag, "morale", 1, "morale_steadied");
  }
  if (everyMonths(gw, 4, 2) && n.gauges.bread > 0 && n.gauges.morale > 1) {
    moveGauge(gw, n.tag, "order", 1, "order_steadied");
  }
}

/** The ladder: each rung has its turn and its offer of a way down. */
function ladder(gw: GreatWar, n: GwNationState): void {
  const bottom = n.gauges.order === 0;
  n.lowOrder = bottom ? n.lowOrder + 1 : Math.max(0, n.lowOrder - 1);
  const rung = LADDER.filter((x, i) => i > 0 && n.lowOrder >= x).length;
  if (rung <= n.unrest) {
    if (!bottom && n.unrest > 0 && n.lowOrder === 0) n.unrest--;
    return;
  }
  n.unrest = rung;
  news(gw, `unrest_${rung}`, n.tag);
  for (const seat of seatsOf(gw, n.tag)) {
    reason(gw, seat, `unrest_${rung}`);
    seat.scheduled.push({ scene: "gw_unrest", chapter: gw.s.chapter + 1 });
  }
  if (seatsOf(gw, n.tag).length === 0 && rung >= 4) {
    leaveWar(gw, n.tag, "nation_collapsed");
  }
}

/** Germany's balance (design §6): the war feeds the army's weight. */
function authority(gw: GreatWar, n: GwNationState): void {
  n.authority = clampTo(n.authority + AUTHORITY_BACK, 0, 100);
  const inst = n.inst;
  if (inst.army === undefined) return;
  const s = gw.s;
  const age = s.chapter - (s.warChapter ?? s.chapter);
  const halfYear = everyMonths(gw, 6);
  if (halfYear) {
    inst.army = clampTo(inst.army + 1, -5, 5);
    for (const seat of seatsOf(gw, n.tag)) reason(gw, seat, "army_grows");
  }
  if (inst.reichstag !== undefined && n.gauges.order <= 1) {
    inst.reichstag = clampTo(inst.reichstag - 1, -5, 5);
    for (const seat of seatsOf(gw, n.tag)) reason(gw, seat, "reichstag_cools");
  }
  for (const seat of seatsOf(gw, n.tag)) {
    const ch = officeHolder(gw, seat, "chancellor");
    if (ch === null || inst.countersign === undefined) continue;
    const target = clampTo(ch.trust, -3, 3);
    if (inst.countersign !== target) {
      inst.countersign += inst.countersign < target ? 1 : -1;
    }
    // A chancellor who won't sign any more says so in writing.
    if (inst.countersign <= -3 && ch.letter === null) {
      reason(gw, seat, "countersign_refused");
      openLetter(gw, seat, ch);
    }
    // War credits: the Reichstag's turn every half year of war.
    if (inst.reichstag !== undefined && (age === 1 || halfYear)) {
      seat.scheduled.push({ scene: "gw_credits", chapter: s.chapter + 1 });
    }
  }
}

/** Chapter step: the home front of every country, with its reason lines. */
export function homeStep(gw: GreatWar): void {
  const atWar = gw.s.warChapter !== null;
  for (const n of gw.s.nations) {
    authority(gw, n);
    if (!fights(n) || !atWar || !isLongChapter(gw)) continue;
    shells(gw, n);
    bread(gw, n);
    money(gw, n);
    mood(gw, n);
    ladder(gw, n);
  }
}
