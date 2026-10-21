// World War 1936 P4 (Task 5, lane C): helpers of the convoy tests on the
// test map ww1936sea. Every country is human: no AI economy opens deals
// or naval lines, no AI navy moves fleets (plan decision 28).
import type { GameUpdateViewData } from "@openfront/engine-api/game/GameUpdates";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  FLEET_MISSIONS,
  FLEET_STATES,
  type FleetMission,
  type ShipClass,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { GameRunner } from "@openfront/engine/GameRunner";
import type { CountryEconomy } from "@openfront/engine/ww1936/economy/WwEconomy";
import type { Fleet, WwNavy } from "@openfront/engine/ww1936/navy/WwNavy";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { SEA, TAG_ID } from "./seaFixture";
import { stepTo, wwRunnerCapture } from "./util";

export const TAGS = ["DEU", "ITA", "GBR", "FRA", "SUN", "POL", "TUR"] as const;
export const clientOf = (tag: CountryTag) =>
  `HUMAN00${TAGS.indexOf(tag as (typeof TAGS)[number]) + 1}`;
export const CONVOY = equipKey("convoy", 1);

export interface SeaGame {
  runner: GameRunner;
  updates: GameUpdateViewData[];
  ww: WorldWar;
  navy: WwNavy;
  ce: (tag: keyof typeof TAG_ID) => CountryEconomy;
}

/** The sea test map, every country human, past the preparation minute. */
export async function seaGame(): Promise<SeaGame> {
  const { runner, updates } = await wwRunnerCapture(
    {},
    TAGS.map((country) => ({ clientID: clientOf(country), country })),
    SEA.map,
  );
  stepTo(runner, WW_PREP_TICKS + 1);
  const ww = runner.game.worldWar()!;
  return {
    runner,
    updates,
    ww,
    navy: ww.navy,
    ce: (tag) => ww.economy.country(TAG_ID[tag])!,
  };
}

/** The first tick of `day` plus `k` (a country's day runs at k = smallID % 7). */
export const dayTick = (day: number, k = 0) =>
  dayStartTick(day, WW_PREP_TICKS) + k;

/** A war of `a` with `b`, on at once (past the preparation minute). */
export function war(
  g: SeaGame,
  a: keyof typeof TAG_ID,
  b: keyof typeof TAG_ID,
) {
  g.ww.setWar(TAG_ID[a], TAG_ID[b], g.runner.game.ticks());
}

/**
 * A fleet of `owner` out of `port` on `mission` in sea region `sr`, at sea
 * in `zone` (lane N1's moves would take it there; the tests put it there).
 */
export function fleetAtSea(
  navy: WwNavy,
  owner: number,
  port: number,
  comp: readonly (readonly [ShipClass, number, number])[],
  zone: number,
  mission: FleetMission,
  sr: number,
): Fleet {
  const f = navy.fleets.get(navy.createFleet(owner, port, comp))!;
  f.docked = 0;
  navy.setFleetZone(f, zone);
  f.mission = FLEET_MISSIONS.indexOf(mission);
  f.missionSr = sr;
  f.state = FLEET_STATES.indexOf("on_station");
  return f;
}

/** A naval base level now (with the economy's notice: portVer). */
export function setNavalBase(ww: WorldWar, region: number, level: number) {
  ww.economy.buildingArray("naval_base")[region] = level;
  ww.economy.afterBuildingChange(region, "naval_base");
}

/** The display messages of `key` sent so far: [to, params]. */
export function messages(
  updates: readonly GameUpdateViewData[],
  key: string,
): { to: number | null; params: unknown }[] {
  return updates
    .flatMap((u) => u.updates[GameUpdateType.DisplayEvent])
    .filter((e) => e.message === key)
    .map((e) => ({ to: e.playerID, params: e.params }));
}
