// World War 1936 P4 (lane U review): the data the screens read instead of
// guessing — a fleet's home, repair days and deck mix; my landing
// divisions and my admirals' skills; my auto air zones; a bombed region's
// repair progress.
import { BUILDING_IDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { FLEET_STATES } from "@openfront/engine-api/ww1936/NavyTypes";
import { repairCostMilli } from "@openfront/engine/ww1936/economy/Repairs";
import {
  fleetRepairDays,
  repairDayMilli,
} from "@openfront/engine/ww1936/navy/Repair";
import { describe, expect, it } from "vitest";
import { REGION, SEA, SR, TAG_ID } from "./seaFixture";
import { HUMAN, step, warAfterPrep, withTestPolitics, wwRunner } from "./util";

withTestPolitics();

async function game() {
  const runner = await wwRunner(
    {},
    [
      { clientID: HUMAN, country: "GBR" },
      { clientID: "HUMAN002", country: "ITA" },
    ],
    SEA.map,
  );
  warAfterPrep(runner, HUMAN, "ITA");
  const ww = runner.game.worldWar()!;
  return { runner, g: runner.game, ww };
}

describe("the screens' view data (lane U)", () => {
  it("a fleet's home, its repair days and a carrier's deck mix", async () => {
    const { ww } = await game();
    const navy = ww.navy;
    const fid = navy.createFleet(TAG_ID.GBR, REGION.london, [
      ["bb", 1, 1],
      ["cv", 1, 1],
    ]);
    const f = navy.fleets.get(fid)!;
    const r = navy.ships.rowOf(f.ships[0]);
    const max = navy.shipStatsOf(r).hpMilli;
    navy.ships.hp[r] = Math.floor(max / 2);
    f.state = FLEET_STATES.indexOf("repairing");
    const s = navy.fleetSummary(f, new Set([TAG_ID.GBR]));
    expect(s.home).toBe(REGION.london);
    const level = navy.econ.buildingArray("naval_base")[REGION.london];
    const day = repairDayMilli(
      max,
      level,
      navy.econ.country(TAG_ID.GBR)!.stats.repairPct,
      2,
      2,
    );
    expect(s.repairDays).toBe(Math.ceil((max - navy.ships.hp[r]) / day));
    expect(s.repairDays).toBe(fleetRepairDays(navy, f));
    expect(s.mix).toEqual([4, 3, 3]);
    // Another country's view of it: none of these.
    const other = navy.fleetSummary(f, new Set());
    expect(other.home).toBeUndefined();
    expect(other.mix).toBeUndefined();
  }, 60_000);

  it("my admirals' skills now and my auto air zones", async () => {
    const { runner, g, ww } = await game();
    const cn = ww.navy.country(TAG_ID.GBR)!;
    cn.navyXpMilli = 50_000;
    expect(
      ww.navy.issue(TAG_ID.GBR, { kind: "appoint_admiral" }, g.ticks()),
    ).toBeNull();
    // The game's own tick sends (and clears) the updates: ask again.
    step(runner);
    ww.navy.markCountry(TAG_ID.GBR);
    const detail = ww.navy
      .takeData()!
      .details.find((d) => d.smallID === TAG_ID.GBR)!;
    const titled = detail.admiralSkills ?? [];
    expect(titled.length).toBeGreaterThan(0);
    const a = [...ww.navy.admirals.values()].find(
      (x) => x.owner === TAG_ID.GBR,
    )!;
    expect(titled.find((x) => x[0] === a.id)).toEqual([
      a.id,
      ...a.skills,
      a.traits,
      a.level,
    ]);
    expect(detail.landing).toEqual([]);
    ww.air.issue(
      TAG_ID.GBR,
      { kind: "air_auto", sr: SR.central, on: true },
      g.ticks(),
    );
    const air = ww.air.takeData()!;
    expect(
      air.details.find((d) => d.smallID === TAG_ID.GBR)?.autoZones,
    ).toEqual([SR.central]);
  }, 60_000);

  it("a bombed region's repair progress", async () => {
    const { runner, ww } = await game();
    const econ = ww.economy;
    const n = BUILDING_IDS.length;
    const civ = BUILDING_IDS.indexOf("civ");
    const i = REGION.london * n + civ;
    econ.damage[i] = 1_500;
    econ.repair[i] = Math.floor(repairCostMilli("civ", 1000) / 4);
    econ.markRegionDirty(REGION.london);
    step(runner, 0);
    const data = econ.takeData()!;
    const london = data.regions.find((x) => x.id === REGION.london)!;
    expect(london.repairPm).toBe(250);
    // An undamaged region has none.
    econ.markRegionDirty(REGION.paris);
    const paris = econ.takeData()!.regions.find((x) => x.id === REGION.paris)!;
    expect(paris.repairPm).toBeUndefined();
  }, 60_000);
});
