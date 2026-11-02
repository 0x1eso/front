// Air overhaul (ww8) lane C: what a wing does when it gets there. Wings are
// delivered by hand (deliverSortie, accrueStation), as lane B's cycle calls them.
import {
  AIR_MISSIONS,
  AIR_TYPES,
  WW_BOMB_CLASSES,
} from "@openfront/engine-api/ww1936/AirTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayOfDate, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  loadCenti,
  raidEffectLines,
} from "@openfront/engine-lib/ww1936/WingRules";
import {
  accrueStation,
  deliverSortie,
} from "@openfront/engine/ww1936/air/WingStrikes";
import { damageOf } from "@openfront/engine/ww1936/economy/Buildings";
import { REGION, SEA, SR } from "./seaFixture";
import {
  byTag,
  HUMAN,
  stamped,
  step,
  stepTo,
  takeRegion,
  withTestPolitics,
  wwRunnerCapture,
} from "./util";
import { giveWing, liveWings } from "./wingUtil";

withTestPolitics();

const STRAT = AIR_TYPES.indexOf("strat_bomber");
const M = (m: (typeof AIR_MISSIONS)[number]) => AIR_MISSIONS.indexOf(m);
const CLS = (c: (typeof WW_BOMB_CLASSES)[number]) => WW_BOMB_CLASSES.indexOf(c);

async function war() {
  const { runner } = await wwRunnerCapture(
    {},
    [
      { clientID: HUMAN, country: "GBR" },
      { clientID: "HUMAN002", country: "DEU" },
    ],
    SEA.map,
  );
  const g = runner.game;
  const ww = g.worldWar()!;
  stepTo(runner, dayStartTick(dayOfDate("1936-06-01"), WW_PREP_TICKS));
  step(runner, 2, [
    stamped(HUMAN, { type: "declare_war", target: byTag(g, "DEU").id() }),
  ]);
  takeRegion(g, REGION.munich, "GBR");
  takeRegion(g, REGION.rome, "GBR");
  const air = ww.air;
  liveWings(air);
  return {
    g,
    ww,
    air,
    gbr: byTag(g, "GBR").smallID(),
    deu: byTag(g, "DEU").smallID(),
  };
}

function bomber(
  air: ReturnType<typeof Object>,
  gbr: number,
  cls: (typeof WW_BOMB_CLASSES)[number],
  planes = 400,
) {
  const a = air as Awaited<ReturnType<typeof war>>["air"];
  return giveWing(a, {
    owner: gbr,
    type: STRAT,
    mission: M("strategic_bombing"),
    planes,
    base: REGION.london,
    sr: SR.westLand,
    flySr: SR.westLand,
    flyMission: M("strategic_bombing"),
    hit: REGION.berlin,
    cls: CLS(cls),
    flyMilli: planes * 1000,
  });
}

const load = () => loadCenti(AIR_TYPES[STRAT], "strategic_bombing");

describe("lane C: wing deliveries", () => {
  test("a bombing run damages the target, rings, reports and result", async () => {
    const { ww, air, gbr, deu } = await war();
    const w = bomber(air, gbr, "factories", 60);
    const tick = air.mg.ticks();
    const day = ww.day(tick);
    deliverSortie(air, w, load(), tick);
    const econ = ww.economy;
    const dmg =
      damageOf(econ, REGION.berlin, "civ") +
      damageOf(econ, REGION.berlin, "mil") +
      damageOf(econ, REGION.berlin, "dock");
    expect(dmg).toBeGreaterThan(0);
    // Only the class's buildings took it.
    expect(damageOf(econ, REGION.berlin, "infra")).toBe(0);
    const z = air.zoneState[ww.scenario.srIdxOf(SR.westLand)];
    expect(z.today.result.get(gbr)![3]).toBeGreaterThan(0);
    expect(air.country(deu)!.bombTaken[day % 30]).toBeGreaterThan(0);
    // The report is in both countries' lists; a second run merges into it.
    for (const id of [gbr, deu]) {
      const rows = air.country(id)!.reports;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        attacker: gbr,
        victim: deu,
        region: REGION.berlin,
        cls: CLS("factories"),
        raids: 1,
        planes: 60,
      });
      expect(rows[0].stopped.length).toBeGreaterThan(0);
    }
    deliverSortie(air, w, load(), air.mg.ticks() + 1);
    expect(air.country(deu)!.reports).toHaveLength(1);
    expect(air.country(deu)!.reports[0].raids).toBe(2);
  }, 60_000);

  test("the rail class cuts railEff, the fuel class takes the stock", async () => {
    const { ww, air, gbr, deu } = await war();
    const econ = ww.economy;
    econ.addBuilding(REGION.berlin, "rail", 2);
    econ.addBuilding(REGION.berlin, "fuel_silo", 2);
    const w = bomber(air, gbr, "rail", 600);
    deliverSortie(air, w, load(), air.mg.ticks());
    expect(damageOf(econ, REGION.berlin, "rail")).toBeGreaterThan(0);
    expect(econ.railEff[REGION.berlin]).toBeLessThanOrEqual(
      econ.rail[REGION.berlin],
    );
    expect(damageOf(econ, REGION.berlin, "civ")).toBe(0);
    const ce = econ.country(deu)!;
    ce.fuelMilli = 5_000_000;
    const f = bomber(air, gbr, "fuel", 600);
    deliverSortie(air, f, load(), air.mg.ticks() + 2);
    expect(ce.fuelMilli).toBeLessThan(5_000_000);
    const rows = air.country(deu)!.reports.filter((r) => r.cls === CLS("fuel"));
    expect(rows[0].fuelMilli).toBe(5_000_000 - ce.fuelMilli);
  }, 60_000);

  test("air supply goes to the short region, patrol and recon add up", async () => {
    const { ww, air, gbr } = await war();
    const land = ww.land;
    land.useMilli[REGION.munich] = 40_000;
    land.supplyMilli[REGION.munich] = 0;
    const t = giveWing(air, {
      owner: gbr,
      type: "transport_plane",
      mission: M("air_supply"),
      planes: 100,
      base: REGION.london,
      sr: SR.westLand,
      flySr: SR.westLand,
      flyMission: M("air_supply"),
      hit: REGION.munich,
      flyMilli: 100_000,
    });
    deliverSortie(air, t, 600, air.mg.ticks());
    const z = air.zoneState[ww.scenario.srIdxOf(SR.westLand)];
    const row = z.today.airSupply.find((r) => r[0] === REGION.munich)!;
    expect(row[1]).toBe(land.sideOf(gbr));
    expect(row[2]).toBeGreaterThan(0);
    expect(row[2]).toBeLessThanOrEqual(40_000);

    const r = giveWing(air, {
      owner: gbr,
      type: "fighter",
      mission: M("recon"),
      planes: 100,
      base: REGION.london,
      sr: SR.westLand,
      flySr: SR.westLand,
      flyMission: M("recon"),
      flyMilli: 100_000,
    });
    accrueStation(air, r, air.mg.ticks());
    expect(z.today.recon.get(land.sideOf(gbr))).toBeGreaterThan(0);
  }, 60_000);

  test("raidEffectLines: rail and fuel cards", () => {
    const base = {
      day: 1,
      attacker: 1,
      victim: 2,
      region: 3,
      raids: 1,
      planes: 10,
      lost: 0,
      points: 100,
      stopped: [] as [number, number][],
      fuelMilli: 0,
      shipsHit: 0,
      groundPlanes: 0,
      wsBp: 0,
      repairDays: 5,
    };
    const rail = raidEffectLines(
      { ...base, cls: CLS("rail") },
      { railLevel: 3, railEffLevel: 1, hubCapacityPct: 68, railMovePct: 34 },
    );
    expect(rail.map((l) => l.key)).toEqual([
      "ww1936.raid_effect.rail_levels",
      "ww1936.raid_effect.hub_capacity",
      "ww1936.raid_effect.rail_move",
      "ww1936.raid_effect.repair",
    ]);
    expect(rail[1].params).toEqual({ pct: 32 });
    const fuel = raidEffectLines(
      { ...base, cls: CLS("fuel"), fuelMilli: 8000 },
      {},
    );
    expect(fuel[0]).toEqual({
      key: "ww1936.raid_effect.fuel",
      params: { n: 8 },
    });
  });
});
