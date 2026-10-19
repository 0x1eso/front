import { PlayerType } from "@openfront/engine-api/game/GameTypes";
import {
  ledgerBucket,
  WAR_PAIR_BUCKETS,
} from "@openfront/engine-lib/congress/CongressBalance";
import { ringSum } from "@openfront/engine-lib/congress/Ring";
import type { Game, Player } from "../game/Game";
import type { PairConflict } from "./Congress";

/** Spec §2.7: only connected humans and nations count in the ledger and on the agenda. */
export function isLedgerPlayer(p: Player): boolean {
  return (
    (p.type() === PlayerType.Human || p.type() === PlayerType.Nation) &&
    !p.isDisconnected()
  );
}

/** Spec §4.2: tiles taken as aggression in the last 180 s, as a percent of the map's land. */
export function aggressionPct(
  mg: Game,
  player: Player,
  now: number = mg.ticks(),
): number {
  const pc = player.congress();
  const land = mg.numLandTiles();
  return pc === null || land <= 0 ? 0 : (pc.takenTiles(now) * 100) / land;
}

/** Spec §4.2: tiles lost in the last 180 s, as a percent of what the player held. */
export function victimPct(
  mg: Game,
  player: Player,
  now: number = mg.ticks(),
): number {
  const pc = player.congress();
  if (pc === null) return 0;
  const lost = pc.lostTiles(now);
  const total = player.numTilesOwned() + lost;
  return total <= 0 ? 0 : (lost * 100) / total;
}

/** Spec §4.2: tiles a pair took from each other in the last 120 s, as a percent of the map's land. */
export function pairPct(
  mg: Game,
  pair: PairConflict,
  now: number = mg.ticks(),
): number {
  const land = mg.numLandTiles();
  if (land <= 0) return 0;
  const b = ledgerBucket(now);
  const tiles =
    ringSum(pair.lowTook, b, WAR_PAIR_BUCKETS) +
    ringSum(pair.highTook, b, WAR_PAIR_BUCKETS);
  return (tiles * 100) / land;
}

/** Land share of the land without fallout (the conquest basis), percent. */
export function landSharePct(mg: Game, player: Player): number {
  const land = mg.totalLandTiles();
  return land <= 0 ? 0 : (player.numTilesOwned() * 100) / land;
}
