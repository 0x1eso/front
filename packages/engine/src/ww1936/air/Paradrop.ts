// World War 1936 P4: paradrops (P4 spec §14.10, plan decision 35). Stubs
// with the final signatures (plan Task 1 Step 18); lane A2 (Task 8) writes
// the bodies (the pure judge is AirRules.paradropBlockOf).
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WwAir } from "./WwAir";

/** Every tick: the paradrops' cooldowns (P2's drop tick calls resolveParadrop). Stub: nothing. */
export function stepParadrops(air: WwAir, tick: number): void {
  void air;
  void tick;
}

/** Spec §14.10: the air war's conditions of a paradrop order (P2's order check asks first). Stub: null. */
export function paradropBlockFor(
  air: WwAir,
  smallID: number,
  army: number,
  target: number,
): WwOrderBlock | null {
  void air;
  void smallID;
  void army;
  void target;
  return null;
}

/** Spec §14.10: the drop's transport losses (P2's drop calls it after landing the army). Stub: nothing. */
export function resolveParadrop(air: WwAir, army: number, tick: number): void {
  void air;
  void army;
  void tick;
}
