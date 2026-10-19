import type { EmergencyKind } from "@openfront/engine-api/congress/CongressTypes";
import type { NukeWeapon } from "@openfront/engine-lib/congress/CongressBalance";
import type { ConveneBlock } from "@openfront/engine-lib/congress/Voting";
import type { Game, Player } from "../game/Game";
import type { Congress, ItemResult } from "./Congress";

// Task 6 (spec §9) fills these in. Until then nothing can be convened.

/** Once a second: the running emergency, then the available list. */
export function processEmergencySecond(_mg: Game, _c: Congress): void {}

/** After an emergency vote: it starts, or the cooldowns do. */
export function onEmergencyVote(
  _mg: Game,
  _c: Congress,
  _result: ItemResult,
): void {}

/** convene_emergency: pays and opens the vote; returns why not otherwise. */
export function conveneEmergency(
  _mg: Game,
  _convener: Player,
  _kind: EmergencyKind,
  _target: Player,
): ConveneBlock | null {
  return "unavailable";
}

/** GameImpl.conquer: late joiners and contributions against the target. */
export function emergencyConquer(
  _mg: Game,
  _c: Congress,
  _prev: Player,
  _next: Player,
): void {}

/** A nuke, MIRV or orbital strike hit: the shooter's score, the victims' losses. */
export function congressNukeHit(
  _mg: Game,
  _c: Congress,
  _shooter: Player,
  _impacted: ReadonlyMap<Player, number>,
  _weapon: NukeWeapon,
): void {}

/** GameImpl.conquerPlayer: a human's elimination makes its conqueror's emergency available. */
export function congressElimination(
  _mg: Game,
  _c: Congress,
  _conqueror: Player,
  _conquered: Player,
): void {}
