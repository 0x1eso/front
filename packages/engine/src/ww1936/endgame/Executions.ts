// World War 1936 P5 (plan decisions 4, 5): the executions of a woken
// country — the same kinds and arguments as GameRunner.init gives a
// starting one (PlayerExecution, NationExecution), never twice.
import { Cell, Nation } from "@openfront/engine-api/game/GameTypes";
import { NationExecution } from "../../execution/NationExecution";
import { PlayerExecution } from "../../execution/PlayerExecution";
import type { Game, Player } from "../../game/Game";
import type { WwEndgame } from "./WwEndgame";

/** Plan decision 5: the executions GameRunner.init gives a starting country; never twice. */
export function addCountryExecutions(
  mg: Game,
  p: Player,
  gameID: string,
): void {
  const live = mg.executions().filter((e) => e.isActive());
  if (!live.some((e) => e instanceof PlayerExecution && e.playerRef() === p)) {
    mg.addExecution(new PlayerExecution(p));
  }
  if (!mg.config().spawnNations()) return;
  if (
    live.some(
      (e) => e instanceof NationExecution && e.nationPlayerId() === p.id(),
    )
  ) {
    return;
  }
  const tile = spawnTileOf(mg, p);
  if (tile === null) return;
  mg.addExecution(
    new NationExecution(
      gameID,
      new Nation(new Cell(mg.x(tile), mg.y(tile)), p.info()),
    ),
  );
}

/** Spec §3.3-2: executions for countries woken this tick (order 8). */
export function wakePending(eg: WwEndgame, _tick: number): void {
  if (eg.wakeQueue.length === 0) return;
  const ids = [...new Set(eg.wakeQueue)].sort((a, b) => a - b);
  eg.wakeQueue = [];
  for (const id of ids) {
    const p = eg.mg.playerBySmallID(id);
    if (p.isPlayer() && p.isAlive()) {
      addCountryExecutions(eg.mg, p, eg.gameID);
    }
  }
}

/** The victory-point tile of the region with the most points the country controls (ties: smaller id). */
function spawnTileOf(mg: Game, p: Player): number | null {
  const ww = mg.worldWar()!;
  let best = 0;
  let bestVp = -1;
  for (const r of ww.scenario.landRegions) {
    if (ww.land.controller[r.id] !== p.smallID()) continue;
    if (r.vp > bestVp) {
      best = r.id;
      bestVp = r.vp;
    }
  }
  return best === 0 ? null : ww.scenario.vpTile(ww.scenario.region(best)!);
}
