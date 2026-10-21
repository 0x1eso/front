// World War 1936 P4: naval battles (P4 spec §9). Stubs with the final
// signatures (plan Task 1 Step 18, pre-flight A8); lane N2 (Task 4)
// writes the bodies.
import type { WwNavy } from "./WwNavy";

/** Spec §9.1: side `side` engages enemy fleet `target` in `zone` (or joins the battle there). Stub: nothing. */
export function startNavalBattle(
  navy: WwNavy,
  zone: number,
  side: number,
  target: number,
  tick: number,
): void {
  void navy;
  void zone;
  void side;
  void target;
  void tick;
}

/** One round of every naval battle, by zone (spec §2.2-6 ⑤). Stub: nothing. */
export function stepNavalBattles(navy: WwNavy, tick: number): void {
  void navy;
  void tick;
}

/** A fleet arriving in a battle's zone joins it (spec §9.1). Stub: nothing. */
export function joinNavalBattle(
  navy: WwNavy,
  zone: number,
  fleet: number,
): void {
  void navy;
  void zone;
  void fleet;
}

/**
 * Damage from outside a battle (air strikes, port strikes, ASW: lanes A2,
 * C): HP and org milli off one ship; at 0 HP it sinks. Stub: the HP and
 * org only, then WwNavy.removeShip at 0.
 */
export function applyShipDamage(
  navy: WwNavy,
  shipId: number,
  hpMilli: number,
  orgMilli: number,
  tick: number,
): void {
  const t = navy.ships;
  const r = t.rowOf(shipId);
  if (r < 0) return;
  t.hp[r] = Math.max(0, t.hp[r] - Math.max(0, hpMilli));
  t.org[r] = Math.max(0, t.org[r] - Math.max(0, orgMilli));
  navy.markFleet(t.fleet[r]);
  if (t.hp[r] === 0) navy.removeShip(shipId, true, tick);
}
