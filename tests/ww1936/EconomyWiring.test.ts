import {
  GameMapSize,
  GameMapType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { IntentSchema } from "@openfront/engine-api/Schemas";
import {
  BUILDING_COST,
  BUILDING_IDS,
  CATEGORY_SLOTS,
  EQUIP_KEYS,
  equipKey,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { regionSlots } from "@openfront/engine-lib/ww1936/EconomyRules";
import {
  createGameRunnerFromSnapshot,
  GameRunner,
} from "@openfront/engine/GameRunner";
import { snapshotGame } from "@openfront/engine/snapshot/GameSnapshot";
import { applyWwOrder } from "@openfront/engine/ww1936/economy/WwOrderExecution";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import { WwEconomyView } from "../../src/client/view/WwEconomyView";
import { TestDataMapLoader } from "../util/ScriptedGame";
import { setup } from "../util/Setup";
import { diffSnapshots } from "../util/Snapshot";
import {
  byTag,
  clearStartSetup,
  HUMAN,
  MINI,
  stamped,
  step,
  stepTo,
  takeRegion,
  withTestPolitics,
  wwGameStart,
  WwHuman,
  wwRunner,
  wwRunnerCapture,
} from "./util";

/** A new runner from `runner`'s snapshot. */
async function restoreRunner(
  runner: GameRunner,
  humans: WwHuman[] = [],
): Promise<GameRunner> {
  return createGameRunnerFromSnapshot(
    wwGameStart({}, humans),
    runner.snapshot(),
    undefined,
    await loadMapFiles(
      new TestDataMapLoader(MINI),
      GameMapType.World1936,
      GameMapSize.Normal,
    ),
    () => {},
  );
}

// P3: the P1 formulas, not the 1936 politics content (plan Task 1).
withTestPolitics();

describe("economy wiring (spec §6, §14)", () => {
  test("Germany starts with its 1936 army, its manpower and a matching cap", async () => {
    const runner = await wwRunner();
    const g = runner.game;
    const deu = byTag(g, "DEU");
    const econ = g.worldWar()!.economy;
    const ce = econ.country(deu.smallID())!;
    // P2 spec §6.4: the 480,000-man army fields 45 divisions of 10,500
    // men; the troops mirror them (P2 spec §13.2).
    expect(deu.troops()).toBe(472_500);
    // Berlin and Munich: 67 million people, 2.5% under limited conscription.
    expect(ce.totals.recruitable).toBe(1_675_000);
    expect(ce.manpower).toBe(ce.totals.recruitable - 472_500);
    expect(ce.manpower).toBe(1_202_500);
    expect(g.config().maxTroops(deu)).toBe(472_500);
    expect(g.config().troopIncreaseRate(deu)).toBe(0);
    // The reserve and the army's 48,000 rifles, less 45 × 900 in the field.
    expect(ce.infStock()).toBe(15_000 + 48_000 - 40_500);
    expect(ce.researched.has("tools_1")).toBe(true);
    expect(deu.wwTroopCap()).toBe(deu.troops());
    // A major has three research slots (none new on day 0), all at work
    // (HOI4's 1936 start, aiStartSetup); fortification_1 (P2 Task 6: the
    // construction group) is a 1936 tech ahead of electronics_1 (P6 plan
    // decision 25: mobile_1 is retired; cryptography_1 is P6's).
    expect(ce.totals.slotCount).toBe(3);
    expect(ce.slots.map((x) => x?.tech)).toEqual([
      "fortification_1",
      "electronics_1",
      "cryptography_1",
    ]);
  });

  test("a human Germany starts with its lines and research (HOI4's 1936 start)", async () => {
    const { runner, updates } = await wwRunnerCapture({}, [
      { clientID: HUMAN, country: "DEU" },
    ]);
    const g = runner.game;
    const deu = byTag(g, "DEU");
    const ce = g.worldWar()!.economy.country(deu.smallID())!;
    step(runner, 2);
    expect(g.worldWar()!.inPrep(g.ticks())).toBe(true);
    // Every military factory on a line, every slot at work: the AI's day-0
    // plan (mobile warfare: rifles first, tanks and trucks before guns).
    const lined = ce.lines.reduce((n, l) => n + l.factories, 0);
    expect(lined).toBe(ce.totals.mil);
    expect(ce.totals.idleMil).toBe(0);
    expect(ce.lines[0]).toMatchObject({
      key: equipKey("infantry_equipment", 1),
      effBp: 1000,
      active: 0,
    });
    expect(ce.slots.every((x) => x !== null && x.progress === 0)).toBe(true);
    // Nothing built and no deal: the queue and the trade are the player's
    // first choices; the laws are 1936's.
    expect(ce.queue).toEqual([]);
    expect(g.worldWar()!.economy.trades()).toEqual([]);
    expect(ce.laws).toEqual({
      economy: "partial_mobilization",
      trade: "limited_exports",
      conscription: "limited",
    });
    // The screens have them from the first update.
    const [detail] = updates
      .flatMap((u) => u.updates[GameUpdateType.WwEconomy])
      .flatMap((u) => u.data.details)
      .filter((d) => d.smallID === deu.smallID());
    expect(detail.lines.map((l) => [l.equipment, l.factories])).toEqual(
      ce.lines.map((l) => [EQUIP_KEYS[l.key][0], l.factories]),
    );
    expect(detail.slots.map((x) => x?.tech)).toEqual(
      ce.slots.map((x) => x?.tech),
    );
    // The player's to change in the preparation minute.
    step(runner, 1, [
      stamped(HUMAN, {
        type: "ww_order",
        order: { kind: "remove_line", line: ce.lines[0].id },
      }),
      stamped(HUMAN, {
        type: "ww_order",
        order: { kind: "cancel_research", slot: 0 },
      }),
    ]);
    expect(ce.lines.reduce((n, l) => n + l.factories, 0)).toBeLessThan(lined);
    expect(ce.slots[0]).toBeNull();
  });

  test("every country's summary carries its slot bonus, for its regions' slots", async () => {
    const { runner, updates } = await wwRunnerCapture();
    const g = runner.game;
    const econ = g.worldWar()!.economy;
    const summaries = () =>
      updates
        .flatMap((u) => u.updates[GameUpdateType.WwEconomy])
        .flatMap((u) => u.data.countries);
    step(runner, 2);
    for (const ce of econ.countries()) {
      // P5 plan decision 4: a dormant slot has no summary until it wakes.
      if (econ.scenario.isDormantSlot(ce.smallID)) continue;
      const [s] = summaries().filter((x) => x.smallID === ce.smallID);
      expect(s.slotPct).toBe(ce.tech.slotPct);
      // A region's slots, as the engine counts them for its controller.
      for (const r of econ.regionsOf(ce.smallID)) {
        const cat = econ.scenario.region(r)!.cat;
        expect(regionSlots(cat, s.slotPct)).toBe(
          econ.regionSlots(r, ce.tech.slotPct),
        );
      }
    }
    // Germany (an AI here) starts with construction_1: +20%.
    const deu = econ.country(byTag(g, "DEU").smallID())!;
    expect(deu.tech.slotPct).toBe(20);
    // A new construction tech shows on its next day.
    deu.addTech("construction_2");
    stepTo(runner, dayStartTick(1, WW_PREP_TICKS));
    const last = summaries()
      .filter((x) => x.smallID === deu.smallID)

      .slice(-1)[0];
    expect(last.slotPct).toBe(40);
  });

  test("Poland's army and cap follow the formula (spec §11.3)", async () => {
    const runner = await wwRunner();
    const g = runner.game;
    const pol = byTag(g, "POL");
    const ce = g.worldWar()!.economy.country(pol.smallID())!;
    // Warsaw and Krakow: 34 million, 2.5%; the army is 30% of that,
    // 255,000 men, and Poland (dev 1) fields 30% of it in 9,000-man
    // divisions: 8 (P2 spec §6.4).
    expect(ce.totals.recruitable).toBe(850_000);
    expect(pol.troops()).toBe(72_000);
    expect(ce.manpower).toBe(850_000 - 72_000);
    // 2,550 in reserve and the army's 25,500 rifles, less 8 × 900.
    expect(ce.infStock()).toBe(2_550 + 25_500 - 7_200);
    expect(g.config().maxTroops(pol)).toBe(72_000);
    // Two slots, both at work from the start (P2 Task 6: the fort tech in
    // a minor's construction group).
    expect(ce.slots.map((x) => x?.tech)).toEqual([
      "construction_1",
      "fortification_1",
    ]);
  });

  test("the army counts its divisions and its men in training", async () => {
    const runner = await wwRunner();
    const g = runner.game;
    const ww = g.worldWar()!;
    const econ = ww.economy;
    const gbr = byTag(g, "GBR");
    // P2 spec §13.2: the field divisions' men, the troops' mirror.
    const before = econ.armyMen(gbr);
    expect(before).toBe(ww.land.fieldMen(gbr.smallID()));
    expect(before).toBe(gbr.troops());
    // Men in training count against the manpower ceiling too.
    ww.land.country(gbr.smallID())!.trainees.push({
      entry: 1,
      template: 1,
      men: 9_000,
      equip: [],
      days: 0,
    });
    expect(econ.armyMen(gbr)).toBe(before + 9_000);
  });

  test("the test map's regions (plan Task 1 Step 13)", async () => {
    const runner = await wwRunner();
    const g = runner.game;
    const econ = g.worldWar()!.economy;
    const deu = byTag(g, "DEU").smallID();
    const sum = (b: "civ" | "mil" | "dock") =>
      econ.regionsOf(deu).reduce((n, id) => n + econ[b][id], 0);
    expect([sum("civ"), sum("mil"), sum("dock")]).toEqual([9, 6, 0]);
    const munich = g
      .worldWar()!
      .scenario.landRegions.find((r) => r.name === "Munich")!;
    const berlin = g
      .worldWar()!
      .scenario.landRegions.find((r) => r.name === "Berlin")!;
    // Munich: 8 base slots, 7 factories; with Germany's construction_1
    // (+20%) it has 9, so 2 free.
    const built =
      econ.civ[munich.id] + econ.mil[munich.id] + econ.dock[munich.id];
    expect(CATEGORY_SLOTS[munich.cat] - built).toBe(1);
    const deuTech = econ.country(deu)!.tech;
    expect(econ.regionSlots(munich.id, deuTech.slotPct) - built).toBe(2);
    expect(econ.infra[berlin.id]).toBe(5);
    expect(g.worldWar()!.scenario.baseSlots(munich.id)).toBe(8);
    expect(g.worldWar()!.scenario.regionNeighbours(munich.id)).toEqual([
      1, 2, 3, 5, 6, 7,
    ]);
    // Every dockyard sits on a coast.
    for (const r of g.worldWar()!.scenario.landRegions) {
      if (r.dock > 0) expect(r.coastal).toBe(true);
    }
  });

  test("the country graph follows region control", async () => {
    const runner = await wwRunner();
    const g = runner.game;
    const ww = g.worldWar()!;
    const econ = ww.economy;
    const [deu, ita, fra, pol, sun, gbr] = (
      ["DEU", "ITA", "FRA", "POL", "SUN", "GBR"] as const
    ).map((t) => byTag(g, t).smallID());
    expect(econ.countryNeighbours(deu)).toEqual([ita, fra, pol]);
    expect(econ.countryNeighbours(gbr)).toEqual([]);
    // Germany takes Krakow (P2: the land war's control): at the next day's
    // common step the economy follows (occupied: Poland still fights) and
    // Germany borders Russia.
    const krakow = ww.scenario.landRegions.find((r) => r.name === "Krakow")!;
    stepTo(runner, WW_PREP_TICKS + 1);
    takeRegion(g, krakow.id, "DEU");
    stepTo(runner, dayStartTick(2, WW_PREP_TICKS) + 1);
    expect(econ.controllerOf(krakow.id)).toBe(deu);
    expect(econ.isOccupied(krakow.id)).toBe(true);
    expect(econ.controlPct(krakow.id)).toBe(50);
    expect(econ.manpowerPct(krakow.id)).toBe(0);
    expect(econ.regionsOf(deu)).toContain(krakow.id);
    expect(econ.countryNeighbours(deu)).toContain(sun);
  });

  test("a region changing hands reaches the screens", async () => {
    const { runner, updates } = await wwRunnerCapture();
    const g = runner.game;
    const ww = g.worldWar()!;
    const scenario = ww.scenario;
    const view = new WwEconomyView(scenario);
    const krakow = scenario.landRegions.find((r) => r.name === "Krakow")!;
    stepTo(runner, WW_PREP_TICKS + 1);
    takeRegion(g, krakow.id, "DEU");
    stepTo(runner, dayStartTick(2, WW_PREP_TICKS));
    for (const u of updates) {
      for (const e of u.updates[GameUpdateType.WwEconomy]) view.apply(e.data);
    }
    expect(view.region(krakow.id)).toEqual({
      id: krakow.id,
      controller: byTag(g, "DEU").smallID(),
      civ: 1,
      mil: 1,
      dock: 0,
      infra: 3,
      fort: 0,
      rail: 0,
      hub: 0,
      navalBase: 0,
      airBase: 0,
      aa: 0,
      radar: 0,
      coastalFort: 0,
      refinery: 0,
      silo: 0,
      damage: [],
      // P6: its depth buildings and v5 resources (none on this map).
      rocketSite: 0,
      dam: 0,
      powerPlant: 0,
      facility: 0,
      coal: 0,
      uranium: 0,
      hydro: 0,
      damLevel: 0,
    });
    expect(view.troopCap(byTag(g, "DEU").smallID())).toBe(
      ww.land.fieldMen(byTag(g, "DEU").smallID()),
    );
    expect(view.version).toBeGreaterThan(1);
  });

  test("cities and vanilla factories cannot be built in this mode", async () => {
    const runner = await wwRunner();
    expect(runner.game.config().isUnitDisabled(UnitType.City)).toBe(true);
    expect(runner.game.config().isUnitDisabled(UnitType.Factory)).toBe(true);
    // P4: ports and warships too (naval bases and the navy replace them).
    expect(runner.game.config().isUnitDisabled(UnitType.Port)).toBe(true);
    expect(runner.game.config().isUnitDisabled(UnitType.Warship)).toBe(true);
  });

  test("the vanilla troop rules are untouched when the mode is off", async () => {
    const game = await setup("plains", { worldWar1936: false });
    expect(game.worldWar()).toBeNull();
    for (const p of game.allPlayers()) expect(p.wwTroopCap()).toBeNull();
  });

  test("ww_order survives the wire", () => {
    const intent = {
      type: "ww_order",
      order: { kind: "build", region: 3, building: "civ", count: 2 },
    };
    expect(IntentSchema.parse(intent)).toEqual(intent);
    expect(() =>
      IntentSchema.parse({
        type: "ww_order",
        order: { kind: "build", region: 3, building: "civ", count: 11 },
      }),
    ).toThrow();
    expect(() =>
      IntentSchema.parse({
        type: "ww_order",
        order: { kind: "research", tech: "nuclear_fusion" },
      }),
    ).toThrow();
  });

  test("an order of a capitulated or unknown country is refused", async () => {
    const runner = await wwRunner({}, [{ clientID: HUMAN, country: "POL" }]);
    const g = runner.game;
    const ww = g.worldWar()!;
    const pol = byTag(g, "POL");
    const order = { kind: "research", tech: "tools_1" } as const;
    // A slot free of the starting research.
    clearStartSetup(ww.economy, ww.economy.country(pol.smallID())!);
    expect(applyWwOrder(g, ww.economy, pol, order, 0)).toBeNull();
    ww.addCapitulation(pol.smallID(), byTag(g, "DEU").smallID(), 0);
    expect(applyWwOrder(g, ww.economy, pol, order, 0)).toBe("dead");
    expect(
      applyWwOrder(
        g,
        ww.economy,
        byTag(g, "DEU"),
        { kind: "open_trade", seller: "NOBODY01", resource: "oil", civs: 1 },
        0,
      ),
    ).toBe("no_partner");
  });

  test("a ww_order intent runs for its sender's country", async () => {
    const { runner, updates } = await wwRunnerCapture({}, [
      { clientID: HUMAN, country: "DEU" },
    ]);
    const g = runner.game;
    const econ = g.worldWar()!.economy;
    step(runner, 3);
    const before = econ.hash();
    updates.length = 0;
    step(runner, 1, [
      stamped(HUMAN, {
        type: "ww_order",
        order: { kind: "set_law", law: "economy", value: "civilian" },
      }),
    ]);
    step(runner, 2);
    // The order reached Germany's economy (its screen hears of it): the law
    // changed during the preparation minute, the hash shows it at once, and
    // the execution came and went.
    const deu = byTag(g, "DEU").smallID();
    const details = updates
      .flatMap((u) => u.updates[GameUpdateType.WwEconomy])
      .flatMap((u) => u.data.details);
    expect(details.map((d) => d.smallID)).toEqual([deu]);
    expect(econ.country(deu)!.laws.economy).toBe("civilian");
    expect(econ.hash()).not.toBe(before);
    const execs = (g as unknown as { executions(): object[] }).executions();
    expect(execs.some((e) => e.constructor.name === "WwOrderExecution")).toBe(
      false,
    );
  });

  test("a snapshot round trip keeps the economy and its hash", async () => {
    const humans: WwHuman[] = [{ clientID: HUMAN, country: "DEU" }];
    const runner = await wwRunner({}, humans);
    stepTo(runner, 700);
    const restored = await restoreRunner(runner, humans);
    const a = runner.game.worldWar()!.economy;
    const b = restored.game.worldWar()!.economy;
    expect(b.hash()).toBe(a.hash());
    expect(b.snapshot()).toEqual(a.snapshot());
    expect(
      diffSnapshots(snapshotGame(runner.game), snapshotGame(restored.game)),
    ).toEqual([]);
    // Restored mid-day, both go on alike.
    for (let i = 0; i < 30; i++) {
      step(runner);
      step(restored);
      expect(b.hash()).toBe(a.hash());
    }
  });

  test("a snapshot without the economy is refused", async () => {
    const runner = await wwRunner();
    const ww = runner.game.worldWar()!;
    const s = ww.snapshot();
    delete s.economy;
    expect(() => ww.restoreState(s)).toThrow(/economy/);
  });

  test("building costs agree in both units", () => {
    for (const b of BUILDING_IDS)
      expect(BUILDING_COST[b] * 1000).toBeGreaterThan(0);
    expect(BUILDING_COST.civ).toBe(10_800);
  });
});
