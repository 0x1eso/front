// Imjin sea layer: the order of one tick (design §6.2). Fleets out of battle
// sail their paths; convoy groups sail and are intercepted; fleets that see
// each other open or join battle circles; every circle runs its tactical
// step and, every 5 ticks of its own clock, its volley; then the lee lurk
// marks are set for the next tick. Repair runs once a day.
import { battleStep, detectBattles, updateLurk } from "./SeaBattle";
import { convoyStep } from "./SeaConvoys";
import { SeaCtx } from "./SeaCtx";
import { seaDailyRepair, strategicStep } from "./SeaFleets";
import { SeaState, shipIndex } from "./SeaState";

export function seaTick(st: SeaState, ctx: SeaCtx, newDay = false): void {
  const idx = shipIndex(st);
  for (const f of st.fleets) if (!f.battle) strategicStep(st, ctx, f, idx);
  convoyStep(st, ctx);
  detectBattles(st, ctx);
  battleStep(st, ctx);
  updateLurk(st, ctx);
  if (newDay) seaDailyRepair(st, ctx);
}
