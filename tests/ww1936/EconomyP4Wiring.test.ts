// World War 1936 P4 (plan Task 1 Step 25): the economy's P4 places —
// bombed buildings, the coast and tech rules of the new buildings, the
// country turn's order, start fuel.
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  fuelCap,
  fuelGain,
  startFuelMilli,
} from "@openfront/engine-lib/ww1936/FuelRules";
import {
  damageBuilding,
  effectiveBuildings,
} from "@openfront/engine/ww1936/economy/Buildings";
import { queueBuild } from "@openfront/engine/ww1936/economy/Construction";
import { noteFuelUse } from "@openfront/engine/ww1936/economy/Fuel";
import { REGION, SEA, TAG_ID } from "./seaFixture";
import { HUMAN, stepTo, withTestPolitics, wwRunner } from "./util";

withTestPolitics();

const HUMANS = [{ clientID: HUMAN, country: "FRA" as const }];

describe("economy P4 wiring", () => {
  it("effectiveBuildings subtracts whole damaged buildings", async () => {
    const runner = await wwRunner({}, HUMANS, SEA.map);
    const econ = runner.game.worldWar()!.economy;
    expect(econ.mil[REGION.paris]).toBe(3);
    damageBuilding(econ, REGION.paris, "mil", 1999);
    expect(effectiveBuildings(econ, REGION.paris, "mil")).toBe(2);
    // Damage never exceeds the buildings.
    expect(damageBuilding(econ, REGION.paris, "mil", 10_000)).toBe(1001);
    expect(effectiveBuildings(econ, REGION.paris, "mil")).toBe(0);
    // Bombed infrastructure is what P2's supply and movement read.
    damageBuilding(econ, REGION.paris, "infra", 1000);
    expect(econ.infraEff[REGION.paris]).toBe(econ.infra[REGION.paris] - 1);
  });

  it("docks and naval bases need a coast", async () => {
    const runner = await wwRunner({}, HUMANS, SEA.map);
    const econ = runner.game.worldWar()!.economy;
    const ce = econ.country(TAG_ID.FRA)!;
    expect(queueBuild(econ, ce, REGION.paris, "dock", 1)).toBe("not_coastal");
    expect(queueBuild(econ, ce, REGION.paris, "naval_base", 1)).toBe(
      "not_coastal",
    );
    expect(queueBuild(econ, ce, REGION.lyon, "naval_base", 1)).toBeNull();
    expect(queueBuild(econ, ce, REGION.lyon, "coastal_fort", 1)).toBeNull();
  });

  it("level caps and building techs", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: HUMAN, country: "GBR" }],
      SEA.map,
    );
    const econ = runner.game.worldWar()!.economy;
    const ce = econ.country(TAG_ID.GBR)!;
    econ.addBuilding(REGION.london, "naval_base", 4);
    expect(econ.buildingArray("naval_base")[REGION.london]).toBe(10);
    expect(queueBuild(econ, ce, REGION.london, "naval_base", 1)).toBe(
      "infra_max",
    );
    expect(queueBuild(econ, ce, REGION.london, "radar", 1)).toBe("no_tech");
    ce.addTech("radar_1");
    expect(queueBuild(econ, ce, REGION.london, "radar", 2)).toBeNull();
    expect(queueBuild(econ, ce, REGION.london, "radar", 1)).toBe("no_tech");
  });

  it("the country turn runs naval lines, repairs and fuel in that order", async () => {
    const runner = await wwRunner({}, HUMANS, SEA.map);
    const ww = runner.game.worldWar()!;
    const ce = ww.economy.country(TAG_ID.FRA)!;
    const turn = dayStartTick(1, ww.prepEndTick()) + (TAG_ID.FRA % 7);
    stepTo(runner, turn);
    noteFuelUse(ce, 1000, 0);
    expect(ce.fuelLedgerMilli).toBe(1000);
    stepTo(runner, turn + 1);
    // The stub settlement after research emptied the ledger the same turn.
    expect(ce.fuelLedgerMilli).toBe(0);
    expect(ce.fuelRatioPm).toBe(1000);
  });

  it("start fuel is the formula of day-0 oil", async () => {
    const runner = await wwRunner({}, HUMANS, SEA.map);
    const ww = runner.game.worldWar()!;
    for (const ce of ww.economy.countries()) {
      const oil = ce.totals.produced[0];
      const silos = ww.economy.countryBuildings(ce.smallID, "fuel_silo");
      expect(ce.fuelMilli, ce.tag).toBe(
        startFuelMilli(fuelGain(oil, ce.stats), fuelCap(oil, silos, ce.stats)),
      );
    }
    // Kiev's oil: the Soviet Union has some.
    expect(ww.economy.country(TAG_ID.SUN)!.fuelMilli).toBeGreaterThan(0);
  });
});
