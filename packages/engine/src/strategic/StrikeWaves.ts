import { MessageType } from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import type { Game, Player } from "../game/Game";
import {
  landStrikeWave,
  planOrbitalStrike,
  strikeWaveCount,
  strikeWaveOffset,
} from "./OrbitalStrike";
import type { PlayerStrategic, StrikeState } from "./PlayerStrategic";

/**
 * Starts the orbital strike on `target` (spec §6.4, §6.6): plans it, keeps
 * the plan on the attacker and lands wave 0 now. The rest land in
 * processStrike over the next STRIKE_WAVE_TICKS.
 */
export function startOrbitalStrike(
  mg: Game,
  attacker: Player,
  s: PlayerStrategic,
  target: Player,
  now: number,
): void {
  const plan = planOrbitalStrike(mg, attacker, target);
  s.setStrike({
    target: target.smallID(),
    startTick: now,
    nextWave: 0,
    craterRadius: plan.craterRadius,
    sites: plan.sites,
    craters: plan.craters,
    buildings: 0,
    troops: 0,
  });
  processStrike(mg, attacker, s, now);
}

/**
 * Lands the waves of the attacker's strike that are due. Once started, a
 * strike always finishes: if the target dies or turns friendly meanwhile
 * the committed waves still land (they only touch whatever land the target
 * still owns). Sends the result to everyone after the last wave.
 */
export function processStrike(
  mg: Game,
  attacker: Player,
  s: PlayerStrategic,
  now: number,
): void {
  let strike = s.strike();
  if (strike === null) return;
  const target = mg.playerBySmallID(strike.target);
  if (!target.isPlayer()) {
    s.setStrike(null);
    s.setSatellite({ phase: "none" });
    return;
  }
  const plan = {
    sites: strike.sites,
    craters: strike.craters,
    craterRadius: strike.craterRadius,
  };
  const waves = strikeWaveCount(plan);
  while (
    strike.nextWave < waves &&
    now >= strike.startTick + strikeWaveOffset(plan, strike.nextWave)
  ) {
    const wave: number = strike.nextWave;
    const result = landStrikeWave(mg, attacker, target, plan, wave);
    const lastWave = wave === waves - 1;
    strike = {
      ...strike,
      nextWave: wave + 1,
      buildings: strike.buildings + result.buildings,
      troops: strike.troops + result.troops,
    } satisfies StrikeState;
    mg.addUpdate({
      type: GameUpdateType.OrbitalStrike,
      attackerID: attacker.smallID(),
      targetID: target.smallID(),
      impacts: result.impacts,
      wave,
      lastWave,
    });
    if (lastWave) {
      s.setStrike(null);
      s.setSatellite({ phase: "none" });
      mg.displayMessage(
        "events_display.orbital_strike_result",
        MessageType.NUKE_DETONATED,
        null,
        undefined,
        {
          target: target.displayName(),
          buildings: strike.buildings,
          troops: strike.troops,
        },
      );
      return;
    }
  }
  s.setStrike(strike);
}
