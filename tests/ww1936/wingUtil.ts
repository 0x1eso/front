// The air overhaul's (ww8) test helpers: a wing where a test wants it, and
// the switch to the wing model. Tests build wings through giveWing, not
// WwAir.addWing, so a change of what a new wing starts with is made here once.
import {
  AIR_MISSIONS,
  AIR_TYPES,
  AirMission,
  AirType,
  Wing,
  WING_NO_MISSION,
  WP_STATION,
} from "@openfront/engine-api/ww1936/AirTypes";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WING_CYCLE } from "@openfront/engine-lib/ww1936/WingRules";
import type { WwAir } from "@openfront/engine/ww1936/air/WwAir";
import { drawPlanes } from "@openfront/engine/ww1936/economy/Buildings";

export type GiveWing = Partial<
  Omit<Wing, "id" | "owner" | "type" | "mission" | "counts" | "base">
> & {
  owner: number;
  /** AIR_TYPES index or name. */
  type: number | AirType;
  /** AIR_MISSIONS index or name; none: idle. */
  mission?: number | AirMission;
  base?: number;
  /** Planes per generation, taken off the ledger by the caller. */
  counts?: number[];
  /**
   * Instead of counts: this many planes from the owner's stock (topped up
   * when short), through the ledger.
   */
  planes?: number;
  /** Puts it on station over its zone now (wing model tests). */
  flying?: boolean;
};

/** Adds a wing to the game, ids rising as ever. */
export function giveWing(air: WwAir, o: GiveWing): Wing {
  const type = typeof o.type === "number" ? o.type : AIR_TYPES.indexOf(o.type);
  const name = AIR_TYPES[type];
  const mission =
    o.mission === undefined
      ? WING_NO_MISSION
      : typeof o.mission === "number"
        ? o.mission
        : AIR_MISSIONS.indexOf(o.mission);
  let counts = o.counts;
  if (counts === undefined) {
    const n = o.planes ?? 0;
    const ce = air.econ.country(o.owner)!;
    const k = equipKey(name, 1);
    ce.stock[k] = Math.max(ce.stock[k], n);
    counts = drawPlanes(ce, name, n);
  }
  const { planes: _p, flying, ...rest } = o;
  const w = air.addWing({
    ...rest,
    type,
    mission,
    counts,
    base: o.base ?? 0,
  });
  if (flying === true) {
    let n = 0;
    for (const c of w.counts) n += c;
    for (const c of w.dcounts) n += c;
    w.phase = WP_STATION;
    w.until = air.mg.ticks() + WING_CYCLE[AIR_MISSIONS[mission]].station;
    w.flySr = w.sr;
    w.flyMission = mission;
    w.hit = w.target;
    w.leg = 1;
    w.flyMilli = n * 1000;
  }
  return w;
}

/** Runs this game on the wing model from now on (AirTypes.WW_WINGS_LIVE). */
export function liveWings(air: WwAir): void {
  air.wingsLive = true;
}
