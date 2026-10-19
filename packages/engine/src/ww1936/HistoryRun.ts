import { PlayerType } from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import {
  HISTORY,
  HISTORY_MAX_DELAY_DAYS,
  HISTORY_SKIP_ODDS,
} from "@openfront/engine-lib/ww1936/History";
import type { Game } from "../game/Game";
import { declareWar, joinWar } from "./Diplomacy";
import type { WorldWar } from "./WorldWar";

/**
 * Spec §7.4, plan decision 10: once per game, in table order, each entry is
 * skipped with odds 1 in HISTORY_SKIP_ODDS and otherwise happens 0..20 days
 * late. Both values are rolled for every entry. Off: no calendar at all.
 */
export function rollHistory(
  ww: WorldWar,
  random: PseudoRandom,
  enabled: boolean,
): void {
  if (!enabled) {
    ww.setHistory([]);
    return;
  }
  ww.setHistory(
    HISTORY.map((e): [number, boolean] => {
      const skip = random.chance(HISTORY_SKIP_ODDS);
      const delay = random.nextInt(0, HISTORY_MAX_DELAY_DAYS + 1);
      return [skip ? -1 : dayOfDate(e.date) + delay, false];
    }),
  );
}

/**
 * Fires every entry due by `day`, in table order. Only a nation (AI) acts on
 * the calendar; a human decides for themselves. An entry is used up whether
 * or not it could fire.
 */
export function processHistory(
  mg: Game,
  ww: WorldWar,
  day: number,
  tick: number,
): void {
  const plan = ww.history();
  for (let i = 0; i < plan.length; i++) {
    const [fireDay, done] = plan[i];
    if (done || fireDay < 0 || fireDay > day) continue;
    ww.markHistoryDone(i);
    const e = HISTORY[i];
    const actor = ww.playerOfTag(e.actor);
    const target = ww.playerOfTag(e.target);
    if (actor === null || target === null) continue;
    if (actor.type() !== PlayerType.Nation) continue;
    if (e.kind === "declare") declareWar(mg, ww, actor, target, tick);
    else joinWar(mg, ww, actor, target, tick);
  }
}
