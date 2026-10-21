// P5 lane A fills this file (plan Task 6): volunteers, air volunteers,
// ship transfers (spec §12, §13.4). The foundation's stub: refused.
import type { AirType } from "@openfront/engine-api/ww1936/AirTypes";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WwEndgame } from "./WwEndgame";

/** volunteers_send (spec §12.1). Stub: refused. */
export function sendVolunteers(
  eg: WwEndgame,
  army: number,
  to: number,
  tick: number,
): WwOrderBlock | null {
  void eg;
  void army;
  void to;
  void tick;
  return "volunteer_conditions";
}

/** volunteers_recall (spec §12.3). Stub: not a volunteer army. */
export function recallVolunteers(
  eg: WwEndgame,
  army: number,
  tick: number,
): WwOrderBlock | null {
  void eg;
  void army;
  void tick;
  return "not_volunteer";
}

/** air_volunteers (spec §12.4). Stub: refused. */
export function sendAirVolunteers(
  eg: WwEndgame,
  from: number,
  to: number,
  zone: number,
  plane: AirType,
  count: number,
  tick: number,
): WwOrderBlock | null {
  void eg;
  void from;
  void to;
  void zone;
  void plane;
  void count;
  void tick;
  return "volunteer_conditions";
}

/** ships_transfer (spec §13.4). Stub: refused. */
export function transferShips(
  eg: WwEndgame,
  from: number,
  to: number,
  ships: readonly number[],
  tick: number,
): WwOrderBlock | null {
  void eg;
  void from;
  void to;
  void ships;
  void tick;
  return "ships_not_owned";
}
