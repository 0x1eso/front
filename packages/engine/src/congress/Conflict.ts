import type { TileRef } from "@openfront/engine-api/game/GameMap";
import {
  CONDEMN_LOSS_PCT,
  CONDEMN_SPEED_PCT,
  DUEL_LOSS_PCT,
  DUEL_SPEED_PCT,
  HEGEMONY_CHECK_ATTACK_LOSS_PCT,
  MEMBER_LOSS_PCT,
  MEMBER_SPEED_PCT,
  PARTITION_ATTACK_LOSS_PCT,
  PROTECTORATE_ATTACK_LOSS_PCT,
  PROTECTORATE_ATTACK_SPEED_PCT,
  PROTECTORATE_DEFENSE_LOSS_PCT,
} from "@openfront/engine-lib/congress/CongressBalance";
import type { DomesticCombat } from "../domestic/DomesticEconomy";
import type { Game, Player, Unit } from "../game/Game";
import type { Congress } from "./Congress";

const scale = (pct: number): number => 1 + pct / 100;

/** S2 A truces (sessions and emergency aftermaths), and emergency members among themselves (spec §8.1, §9.4). */
export function isTruce(c: Congress, a: Player, b: Player): boolean {
  const x = a.smallID();
  const y = b.smallID();
  for (const r of c.active()) {
    if (
      r.resolution === "truce" &&
      r.option === "A" &&
      r.targets.includes(x) &&
      r.targets.includes(y)
    ) {
      return true;
    }
  }
  return c.isEmergencyMember(x) && c.isEmergencyMember(y);
}

/**
 * `base` (the domestic combat scales) times the congress scales for
 * `attacker` against `defender` (spec §8.1, §9.4, §10.2). The same object
 * comes back when nothing applies.
 */
export function withCongressCombat(
  base: Readonly<DomesticCombat>,
  c: Congress | null,
  attacker: Player,
  defender: Player | null,
): Readonly<DomesticCombat> {
  if (c === null || defender === null) return base;
  const a = attacker.smallID();
  const d = defender.smallID();
  let loss = 1;
  let speed = 1;
  let defLoss = 1;
  for (const r of c.active()) {
    switch (r.resolution) {
      case "truce":
        if (
          r.option === "B" &&
          r.targets.includes(a) &&
          r.targets.includes(d)
        ) {
          speed *= scale(DUEL_SPEED_PCT);
          loss *= scale(DUEL_LOSS_PCT);
        }
        break;
      case "protectorate":
        if (r.targets[0] !== d) break;
        if (r.option === "A") {
          loss *= scale(PROTECTORATE_ATTACK_LOSS_PCT);
          speed *= scale(PROTECTORATE_ATTACK_SPEED_PCT);
          defLoss *= scale(PROTECTORATE_DEFENSE_LOSS_PCT);
        } else {
          loss *= scale(PARTITION_ATTACK_LOSS_PCT);
        }
        break;
      case "hegemony_check":
        if (r.option === "A" && r.targets[0] === d) {
          loss *= scale(HEGEMONY_CHECK_ATTACK_LOSS_PCT);
        }
        break;
      case "world_heritage":
        if (r.option === "B" && r.targets[0] === d) {
          speed *= scale(CONDEMN_SPEED_PCT);
          loss *= scale(CONDEMN_LOSS_PCT);
        }
        break;
    }
  }
  if (c.isEmergencyTarget(d) && c.isEmergencyMember(a)) {
    speed *= scale(MEMBER_SPEED_PCT);
    loss *= scale(MEMBER_LOSS_PCT);
  }
  if (loss === 1 && speed === 1 && defLoss === 1) return base;
  return {
    attackerLoss: base.attackerLoss * loss,
    attackerSpeed: base.attackerSpeed * speed,
    defenderLoss: base.defenderLoss * defLoss,
  };
}

/** World heritage A (spec §10.2): its owner's named host can't be destroyed. */
export function isHeritageProtected(mg: Game, unit: Unit): boolean {
  const c = mg.congress();
  if (c === null) return false;
  const id = String(unit.id());
  const owner = unit.owner().smallID();
  return c
    .active()
    .some(
      (r) =>
        r.resolution === "world_heritage" &&
        r.option === "A" &&
        r.param === id &&
        r.targets[0] === owner,
    );
}

const NO_TILES: ReadonlySet<TileRef> = new Set<TileRef>();

/** The tiles protected hosts stand on: blasts leave them owned (plan decision 8). */
export function heritageHostTiles(mg: Game): ReadonlySet<TileRef> {
  const c = mg.congress();
  if (c === null) return NO_TILES;
  let tiles: Set<TileRef> | null = null;
  for (const r of c.active()) {
    if (r.resolution !== "world_heritage" || r.option !== "A") continue;
    const unit = mg.unit(Number(r.param));
    if (
      unit !== undefined &&
      unit.isActive() &&
      unit.owner().smallID() === r.targets[0]
    ) {
      tiles ??= new Set<TileRef>();
      tiles.add(unit.tile());
    }
  }
  return tiles ?? NO_TILES;
}
