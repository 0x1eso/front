import { TileRef } from "@openfront/engine-api/game/GameMap";
import { MessageType, UnitType } from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import {
  InterceptorNuke,
  SatelliteData,
} from "@openfront/engine-api/strategic/StrategicTypes";
import { SATELLITE_PREP_TICKS } from "@openfront/engine-lib/strategic/Strategic";
import type { Game, Player, Unit } from "../game/Game";
import { interceptorHits } from "./Interception";
import { orbitalStrike } from "./OrbitalStrike";
import type { PlayerStrategic } from "./PlayerStrategic";

/** A satellite message for every player, naming `player` (re-resolved through focusPlayerID). */
export function announceSatellite(
  mg: Game,
  key: string,
  type: MessageType,
  player: Player,
  params: Record<string, string | number> = {},
  unitId?: number,
): void {
  mg.displayMessage(
    key,
    type,
    null,
    undefined,
    { name: player.displayName(), ...params },
    unitId,
    player.id(),
  );
}

/** build_unit Satellite at a silo (spec §6.1): pays and starts the 90 s preparation there. */
export function startSatellitePrep(
  mg: Game,
  player: Player,
  tile: TileRef,
): void {
  const s = player.strategic();
  const spawn = player.canBuild(UnitType.Satellite, tile);
  if (s === null || spawn === false) return;
  const silo = player
    .units(UnitType.MissileSilo)
    .find((u) => u.tile() === spawn);
  if (silo === undefined) return;
  player.removeGold(mg.unitInfo(UnitType.Satellite).cost(mg, player));
  const now = mg.ticks();
  s.setSatellite({
    phase: "preparing",
    siloId: silo.id(),
    startTick: now,
    readyTick: now + SATELLITE_PREP_TICKS,
  });
  announceSatellite(
    mg,
    "events_display.satellite_preparing",
    MessageType.NUKE_INBOUND,
    player,
    {},
    silo.id(),
  );
}

/** Whether `player` may aim its satellite at `target` (spec §6.2). */
export function canTargetWithSatellite(
  mg: Game,
  player: Player,
  target: Player,
): boolean {
  return (
    target !== player &&
    target.isAlive() &&
    !player.isFriendly(target, true) &&
    !mg.isSpawnImmunityActive()
  );
}

/** The player's first finished silo with a free slot, in unit order; null if none. */
export function firstReadySilo(player: Player): Unit | null {
  return (
    player
      .units(UnitType.MissileSilo)
      .find(
        (s) => s.isActive() && !s.isUnderConstruction() && !s.isInCooldown(),
      ) ?? null
  );
}

const INTERCEPTOR_KEYS: Readonly<Record<InterceptorNuke, string>> = {
  [UnitType.HydrogenBomb]: "unit_type.hydrogen_bomb",
  [UnitType.AtomBomb]: "unit_type.atom_bomb",
};

/**
 * One tick of a satellite counting down (spec §6.3-6.4): every interceptor
 * that has arrived is judged in launch order, and one hit downs the
 * satellite for good. Once the clock has run out and nothing is still
 * flying, the strike lands — or, if the target is dead or friendly by
 * then, the satellite goes back to orbit.
 */
function resolveCountdown(
  mg: Game,
  player: Player,
  s: PlayerStrategic,
  sat: Extract<SatelliteData, { phase: "targeted" }>,
  now: number,
): void {
  const due = sat.interceptors.filter((i) => i.resolveTick <= now);
  const flying = sat.interceptors.filter((i) => i.resolveTick > now);
  for (const [index, shot] of due.entries()) {
    const shooter = mg.playerBySmallID(shot.by);
    const params = {
      name: shooter.isPlayer() ? shooter.displayName() : "",
      unit: INTERCEPTOR_KEYS[shot.type],
    };
    const focus = shooter.isPlayer() ? shooter.id() : undefined;
    if (interceptorHits(now, player.smallID(), shot, index)) {
      s.setSatellite({ phase: "none" });
      mg.displayMessage(
        "events_display.satellite_intercept_hit",
        MessageType.SAM_HIT,
        null,
        undefined,
        params,
        undefined,
        focus,
      );
      return;
    }
    mg.displayMessage(
      "events_display.satellite_intercept_miss",
      MessageType.SAM_MISS,
      null,
      undefined,
      params,
      undefined,
      focus,
    );
  }
  if (due.length > 0) s.setSatellite({ ...sat, interceptors: flying });
  if (now < sat.strikeTick || flying.length > 0) return;

  const target = mg.playerBySmallID(sat.target);
  if (
    !target.isPlayer() ||
    !target.isAlive() ||
    player.isFriendly(target, true)
  ) {
    s.setSatellite({ phase: "orbit" });
    mg.displayMessage(
      "events_display.satellite_strike_aborted",
      MessageType.ATTACK_CANCELLED,
      player.id(),
    );
    return;
  }
  s.setSatellite({ phase: "none" });
  const impacts = orbitalStrike(mg, player, target);
  mg.addUpdate({
    type: GameUpdateType.OrbitalStrike,
    attackerID: player.smallID(),
    targetID: target.smallID(),
    impacts,
  });
  announceSatellite(
    mg,
    "events_display.satellite_strike_landed",
    MessageType.NUKE_DETONATED,
    player,
    { target: target.displayName(), targetID: target.smallID() },
  );
}

/**
 * One tick of a player's satellite (spec §6.1): a preparation fails when
 * its silo is gone or has a new owner (the gold is lost, a new try is
 * allowed) and reaches orbit when its time is up. A targeted satellite
 * counts down in resolveCountdown.
 */
export function processSatellite(
  mg: Game,
  player: Player,
  s: PlayerStrategic,
  now: number,
): void {
  const sat = s.satellite();
  if (sat.phase === "targeted") {
    resolveCountdown(mg, player, s, sat, now);
    return;
  }
  if (sat.phase !== "preparing") return;
  const silo = mg.unit(sat.siloId);
  if (silo === undefined || !silo.isActive() || silo.owner() !== player) {
    s.setSatellite({ phase: "none" });
    announceSatellite(
      mg,
      "events_display.satellite_prep_failed",
      MessageType.UNIT_DESTROYED,
      player,
    );
  } else if (now >= sat.readyTick) {
    s.setSatellite({ phase: "orbit" });
    s.countLaunch();
    announceSatellite(
      mg,
      "events_display.satellite_in_orbit",
      MessageType.NUKE_INBOUND,
      player,
    );
  }
}
