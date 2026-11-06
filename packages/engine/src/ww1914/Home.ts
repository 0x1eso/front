import { GwNationState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import { civilFromDays } from "@openfront/engine-lib/ww1936/Calendar";
import { allocOf } from "./Fronts";
import type { GreatWar } from "./GreatWar";
import { officeHolder, recordResult } from "./People";
import { leaveWar } from "./Wars";
import {
  clampTo,
  fights,
  isLongChapter,
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
  const c = gw.s.chapter;
  const war = gw.s.warChapter ?? c;
  const beat = n.gauges.money > 0 ? 3 : 5;
  if ((c - war) % beat === beat - 1) {
    moveGauge(gw, n.tag, "shells", 1, "shells_made");
  }
  if (
    n.tag === "DEU" &&
    gw.s.secrets.includes("deu_shell_stock_thin") &&
    c === war + 2
  ) {
    moveGauge(gw, n.tag, "shells", -1, "shells_stock_thin");
  }
  for (const seat of seatsOf(gw, n.tag)) {
    const war_ = officeHolder(gw, seat, "war");
    if (war_ === null || (c - war) % 4 !== 3) continue;
    const skill = war_.competence[2];
    if (skill === 3) moveGauge(gw, n.tag, "shells", 1, "shells_well_run");
    if (skill === 1) moveGauge(gw, n.tag, "shells", -1, "shells_badly_run");
    if (skill !== 2) recordResult(gw, war_.id, skill === 3);
  }
}

function bread(gw: GreatWar, n: GwNationState): void {
  const s = gw.s;
  const age = s.chapter - (s.warChapter ?? s.chapter);
  const month = civilFromDays(s.day).month;
  if (month === 9 || month === 10) {
    moveGauge(gw, n.tag, "bread", 1, "bread_harvest");
  }
  const sea = s.theatres.find((t) => t.id === "sea")!;
  const blocked =
    n.side === "central" && gw.nation("GBR")?.side === "entente" && sea.open;
  if (blocked) {
    const every = sea.line === 0 ? 2 : 3;
    if (age > 0 && age % every === 0) {
      moveGauge(gw, n.tag, "bread", -1, "bread_blockade");
    }
  }
  if (n.tag === "GBR" && s.uboat === 2 && age % 3 === 2) {
    moveGauge(gw, n.tag, "bread", -1, "bread_uboats");
  }
  if (n.tag === "RUS" && age > 12 && age % 4 === 3) {
    moveGauge(gw, n.tag, "bread", -1, "bread_rail");
  }
}

function money(gw: GreatWar, n: GwNationState): void {
  const age = gw.s.chapter - (gw.s.warChapter ?? gw.s.chapter);
  if (age > 0 && age % 3 === 0) {
    moveGauge(gw, n.tag, "money", -1, "money_war_costs");
  }
}

function mood(gw: GreatWar, n: GwNationState): void {
  if (n.gauges.bread === 0) moveGauge(gw, n.tag, "order", -1, "order_hunger");
  if (n.gauges.morale === 0) moveGauge(gw, n.tag, "order", -1, "order_despair");
  if (n.gauges.money === 0 && gw.s.chapter % 2 === 0) {
    moveGauge(gw, n.tag, "order", -1, "order_unpaid");
  }
  const last = gw.s.battles.filter((b) => b.chapter === gw.s.chapter);
  const i = n.side === "central" ? 0 : 1;
  const heavy = last.reduce((sum, b) => sum + (b.lost[i] ?? 0), 0);
  if (heavy >= 250) moveGauge(gw, n.tag, "order", -1, "order_casualties");
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
  if (s.warChapter !== null && age > 0 && age % 6 === 0) {
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
    if (inst.countersign <= -3 && ch.letter === null) {
      reason(gw, seat, "countersign_refused");
    }
    // War credits: the Reichstag's turn every half year of war.
    if (s.warChapter !== null && inst.reichstag !== undefined) {
      if (age === 1 || (age > 0 && age % 6 === 0)) {
        seat.scheduled.push({ scene: "gw_credits", chapter: s.chapter + 1 });
      }
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
