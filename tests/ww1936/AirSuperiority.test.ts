// World War 1936 P4 Task 7 (lane A1): air superiority and radar (spec
// §12.1, §14.5) on ww1936sea, human countries at war, no production.
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import type {
  AirMission,
  AirType,
} from "@openfront/engine-api/ww1936/AirTypes";
import {
  equipKey,
  EQUIPMENT_GENS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  FLEET_MISSIONS,
  FLEET_STATES,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { airSupPm } from "@openfront/engine-lib/ww1936/AirRules";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { planeStats } from "@openfront/engine-lib/ww1936/PlaneStats";
import { emptyStats } from "@openfront/engine-lib/ww1936/Stats";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { zoneWeather } from "@openfront/engine/ww1936/air/AirCombat";
import { radarPmAt } from "@openfront/engine/ww1936/air/AirSuperiority";
import { drawPlanes } from "@openfront/engine/ww1936/economy/Buildings";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { REGION, SEA, SR, TAG_ID, ZONE } from "./seaFixture";
import {
  clearStartSetup,
  gameHash,
  HUMAN,
  step,
  stepTo,
  warAfterPrep,
  withTestPolitics,
  WwHuman,
  wwRestore,
  wwRunner,
  wwRunnerCapture,
} from "./util";

withTestPolitics();

const GBR_ITA: WwHuman[] = [
  { clientID: HUMAN, country: "GBR" },
  { clientID: "HUMAN002", country: "ITA" },
];

function setStock(ww: WorldWar, id: number, type: AirType, counts: number[]) {
  const ce = ww.economy.country(id)!;
  for (let g = 1; g <= EQUIPMENT_GENS[type]; g++) {
    ce.stock[equipKey(type, g)] = counts[g - 1] ?? 0;
  }
}

function deploy(
  runner: GameRunner,
  id: number,
  sr: number,
  type: AirType,
  mission: AirMission,
  count: number,
) {
  return runner.game
    .worldWar()!
    .air.issue(
      id,
      { kind: "air_deploy", sr, type, mission, count },
      runner.game.ticks(),
    );
}

function through(runner: GameRunner, day: number, k: number): void {
  const ww = runner.game.worldWar()!;
  stepTo(runner, dayStartTick(day, ww.prepEndTick()) + k + 1);
}

async function channelWar() {
  const runner = await wwRunner({}, GBR_ITA, SEA.map);
  const ww = runner.game.worldWar()!;
  for (const id of [TAG_ID.GBR, TAG_ID.ITA]) {
    clearStartSetup(ww.economy, ww.economy.country(id)!);
  }
  warAfterPrep(runner, HUMAN, "ITA");
  let day = ww.day(runner.game.ticks()) + 1;
  while (zoneWeather(ww.air, SR.central, day) !== "clear") day++;
  stepTo(runner, dayStartTick(day, ww.prepEndTick()));
  return { runner, ww, day };
}

describe("air superiority (spec §14.5)", () => {
  it("equal fighters give 500‰", async () => {
    const { runner, ww, day } = await channelWar();
    setStock(ww, TAG_ID.GBR, "fighter", [200, 0, 0]);
    setStock(ww, TAG_ID.ITA, "fighter", [200, 0, 0]);
    deploy(runner, TAG_ID.GBR, SR.central, "fighter", "air_superiority", 200);
    deploy(runner, TAG_ID.ITA, SR.central, "fighter", "air_superiority", 200);
    through(runner, day, ww.scenario.srIdxOf(SR.central) % 7);
    const [gbr, ita] = [TAG_ID.GBR, TAG_ID.ITA].map((id) => ww.land.sideOf(id));
    expect(ww.air.airSup(gbr, SR.central)).toBe(500);
    expect(ww.air.airSup(ita, SR.central)).toBe(500);
    const z = ww.air.zoneState[ww.scenario.srIdxOf(SR.central)];
    // Each side's worst enemy superiority (the land war reads it).
    expect(z.enemySup.get(gbr)).toBe(500);
    expect(z.enemySup.get(ita)).toBe(500);
  }, 60_000);

  it("no planes → 0", async () => {
    const { runner, ww, day } = await channelWar();
    setStock(ww, TAG_ID.GBR, "fighter", [100, 0, 0]);
    deploy(runner, TAG_ID.GBR, SR.central, "fighter", "air_superiority", 100);
    through(runner, day, 6);
    const gbr = ww.land.sideOf(TAG_ID.GBR);
    const ita = ww.land.sideOf(TAG_ID.ITA);
    // Alone in the sky: all of it; the side with no planes: nothing.
    expect(ww.air.airSup(gbr, SR.central)).toBe(1000);
    expect(ww.air.airSup(ita, SR.central)).toBe(0);
    expect(ww.air.airSup(gbr, SR.approaches)).toBe(0);
    // Called home: the next day the zone is empty again.
    ww.air.issue(
      TAG_ID.GBR,
      { kind: "air_recall", sr: SR.central },
      runner.game.ticks(),
    );
    through(runner, day + 1, 6);
    expect(ww.air.airSup(gbr, SR.central)).toBe(0);
    const z = ww.air.zoneState[ww.scenario.srIdxOf(SR.central)];
    expect([z.sup.size, z.enemySup.size, z.sorties.size]).toEqual([0, 0, 0]);
  }, 60_000);

  it("carrier fighters count in their sea zone", async () => {
    const { runner, ww, day } = await channelWar();
    const gbr = TAG_ID.GBR;
    setStock(ww, gbr, "cv_fighter", [30, 0, 0]);
    setStock(ww, TAG_ID.ITA, "fighter", [30, 0, 0]);
    const navy = ww.navy;
    const fid = navy.createFleet(gbr, REGION.london, [["cv", 1, 1]]);
    const f = navy.fleets.get(fid)!;
    const ship = f.ships[0];
    const deck = () => navy.ships.deckOf(navy.ships.rowOf(ship));
    drawPlanes(ww.economy.country(gbr)!, "cv_fighter", 30).forEach(
      (n, g) => (deck()[g] = n),
    );
    f.docked = 0;
    navy.setFleetZone(f, ZONE.middle);
    f.mission = FLEET_MISSIONS.indexOf("patrol");
    f.missionSr = SR.central;
    f.state = FLEET_STATES.indexOf("on_station");
    deploy(runner, TAG_ID.ITA, SR.central, "fighter", "air_superiority", 30);
    // Britain's day puts the deck in the air; the zone flies it the next day.
    through(runner, day + 1, 6);
    const wing = ww.air
      .deploymentsIn(SR.central)
      .map((id) => ww.air.deployments.get(id)!)
      .find((d) => d.owner === gbr)!;
    expect(wing.base).toBe(-ship);
    expect(wing.sr).toBe(SR.central);
    // The deck holds the planes: the stock gave none to the wing.
    expect(ww.economy.country(gbr)!.stock[equipKey("cv_fighter", 1)]).toBe(0);
    const Z = emptyStats();
    const none = new Set<never>();
    const cv = planeStats("cv_fighter", 1, Z, none).supWeightMilli;
    const fi = planeStats("fighter", 1, Z, none).supWeightMilli;
    expect(cv).toBe(900);
    const z = ww.air.zoneState[ww.scenario.srIdxOf(SR.central)];
    const flown = (z.sorties.get(ww.land.sideOf(gbr)) ?? [])[7];
    expect(flown).toBeGreaterThan(0);
    // 30 carrier fighters (weight 0.9) against 30 fighters (1.0), the same
    // weather and full range: 27 against 30.
    expect(fi).toBe(1000);
    expect(ww.air.airSup(ww.land.sideOf(gbr), SR.central)).toBe(
      airSupPm(27, 30),
    );
    expect(airSupPm(27, 30)).toBe(473);
    // The carrier docks: its wing is gone on Britain's next day.
    f.docked = REGION.london;
    navy.setFleetZone(f, ZONE.west);
    f.state = FLEET_STATES.indexOf("docked");
    through(runner, day + 2, 6);
    expect(
      ww.air
        .deploymentsIn(SR.central)
        .map((id) => ww.air.deployments.get(id)!)
        .filter((d) => d.owner === gbr),
    ).toEqual([]);
  }, 60_000);
});

describe("radar (spec §12.1)", () => {
  it("a radar adds 150‰ a level within 300 km a level", async () => {
    const runner = await wwRunner({}, GBR_ITA, SEA.map);
    const ww = runner.game.worldWar()!;
    const gbr = ww.land.sideOf(TAG_ID.GBR);
    expect(radarPmAt(ww.air, gbr, SR.central)).toBe(0);
    ww.economy.addBuilding(REGION.london, "radar", 1);
    // London is 200 km from the Central Waters, 260 from the Eastern.
    expect(radarPmAt(ww.air, gbr, SR.central)).toBe(150);
    expect(radarPmAt(ww.air, gbr, SR.eastern)).toBe(150);
    expect(radarPmAt(ww.air, ww.land.sideOf(TAG_ID.ITA), SR.central)).toBe(0);
    ww.economy.addBuilding(REGION.london, "radar", 1);
    expect(radarPmAt(ww.air, gbr, SR.central)).toBe(300);
    // Moscow is 394 km from the Western Approaches: out of one level's reach.
    ww.economy.addBuilding(REGION.moscow, "radar", 1);
    const sun = ww.land.sideOf(TAG_ID.SUN);
    expect(ww.scenario.srKm(REGION.moscow, SR.approaches)).toBe(394);
    expect(radarPmAt(ww.air, sun, SR.approaches)).toBe(0);
    ww.economy.addBuilding(REGION.moscow, "radar", 1);
    expect(radarPmAt(ww.air, sun, SR.approaches)).toBe(300);
  }, 60_000);
});

describe("the 50% alert (spec §18.10)", () => {
  it("goes out once in 7 days a side and zone, the same after a restore", async () => {
    const { runner, updates } = await wwRunnerCapture({}, GBR_ITA, SEA.map);
    const ww = runner.game.worldWar()!;
    for (const id of [TAG_ID.GBR, TAG_ID.ITA]) {
      clearStartSetup(ww.economy, ww.economy.country(id)!);
    }
    warAfterPrep(runner, HUMAN, "ITA");
    const gbr = ww.land.sideOf(TAG_ID.GBR);
    const z = () => ww.air.zoneState[ww.scenario.srIdxOf(SR.central)];
    const alerts = (from: number) =>
      updates
        .slice(from)
        .flatMap((u) => u.updates[GameUpdateType.DisplayEvent] ?? [])
        .filter((m) => m.message === "events_display.ww1936_air_superiority");
    const day = ww.day(runner.game.ticks()) + 1;
    stepTo(runner, dayStartTick(day, ww.prepEndTick()));
    setStock(ww, TAG_ID.GBR, "fighter", [100, 0, 0]);
    deploy(runner, TAG_ID.GBR, SR.central, "fighter", "air_superiority", 100);
    let mark = updates.length;
    through(runner, day, 6);
    // Britain's sky: 0 → 1000 over a zone it flies in, at war.
    const first = alerts(mark);
    expect(first).toHaveLength(1);
    expect(first[0].params).toEqual({ sr: SR.central, pct: 100, gained: 1 });
    expect(z().alertDay.get(gbr)).toBe(day);
    // Called home: the sky is lost the next day, within 7 days — no alert.
    ww.air.issue(
      TAG_ID.GBR,
      { kind: "air_recall", sr: SR.central },
      runner.game.ticks(),
    );
    mark = updates.length;
    through(runner, day + 1, 6);
    expect(ww.air.airSup(gbr, SR.central)).toBe(0);
    expect(alerts(mark)).toHaveLength(0);
    expect(z().alertDay.get(gbr)).toBe(day);
    // A restored game keeps the alert's day and follows the same way.
    const b = await wwRestore(runner, GBR_ITA, SEA.map);
    const wb = b.game.worldWar()!;
    const zb = () => wb.air.zoneState[wb.scenario.srIdxOf(SR.central)];
    expect([...zb().alertDay]).toEqual([...z().alertDay]);
    const again = dayStartTick(day + 8, ww.prepEndTick());
    while (runner.game.ticks() < again) {
      step(runner);
      step(b);
      expect(gameHash(b)).toBe(gameHash(runner));
    }
    // Eight days on, out again: the old day is forgotten, a new alert.
    for (const [g, w] of [
      [runner, ww],
      [b, wb],
    ] as const) {
      setStock(w, TAG_ID.GBR, "fighter", [100, 0, 0]);
      deploy(g, TAG_ID.GBR, SR.central, "fighter", "air_superiority", 100);
    }
    mark = updates.length;
    const end = dayStartTick(day + 8, ww.prepEndTick()) + 7;
    while (runner.game.ticks() < end) {
      step(runner);
      step(b);
      expect(gameHash(b)).toBe(gameHash(runner));
    }
    expect(alerts(mark)).toHaveLength(1);
    expect(z().alertDay.get(gbr)).toBe(day + 8);
    expect(zb().alertDay.get(gbr)).toBe(day + 8);
  }, 120_000);
});
