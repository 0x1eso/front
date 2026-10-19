import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { GameConfig } from "@openfront/engine-api/Schemas";
import {
  nukeProductionTimePct,
  researchCostMilli,
} from "@openfront/engine/congress/Effects";
import {
  activeConditions,
  domesticConstructionTicks,
  processDomesticSecond,
} from "@openfront/engine/domestic/DomesticEconomy";
import { DomesticExecution } from "@openfront/engine/domestic/DomesticExecution";
import { ResearchExecution } from "@openfront/engine/domestic/ResearchExecution";
import { ConstructionExecution } from "@openfront/engine/execution/ConstructionExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { NukeProductionExecution } from "@openfront/engine/strategic/NukeProductionExecution";
import { grantGovernment, grantLaws, grantTechs } from "../domestic/util";
import { setup } from "../util/Setup";
import {
  BLUE,
  congressGame,
  congressOf,
  enact,
  GREEN,
  own,
  RED,
  runTicks,
} from "./util";

// The ledger is Task 2's. The aggressing tests force its answer for chosen
// players (everyone else gets the real one) to check that the domestic second
// asks it in congress games, and only there.
const ledger = vi.hoisted(() => ({ forced: new Set<string>() }));
vi.mock("@openfront/engine/congress/Ledger", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("@openfront/engine/congress/Ledger")>();
  return {
    ...real,
    isAggressing: (mg: Game, p: Player) =>
      ledger.forced.has(p.id()) || real.isAggressing(mg, p),
  };
});

afterEach(() => ledger.forced.clear());

async function three(config: Partial<GameConfig> = {}): Promise<{
  game: Game;
  red: Player;
  blue: Player;
  green: Player;
}> {
  const game = await congressGame(config, [RED, BLUE, GREEN]);
  const red = own(game, RED.id, 0, 0, 30, 100);
  const blue = own(game, BLUE.id, 30, 0, 30, 100);
  const green = own(game, GREEN.id, 60, 0, 30, 100);
  game.executeNextTick();
  return { game, red, blue, green };
}

describe("modifiers from the congress", () => {
  test("the clock puts them into the domestic totals once a second, and takes them out", async () => {
    const { game, red } = await three();
    const before = game.config().maxTroops(red);
    enact(game, { resolution: "arms_treaty" });
    runTicks(game, 10);
    expect(red.domestic()!.pct("maxTroops")).toBe(-15);
    expect(red.domestic()!.pct("goldIncome")).toBe(15);
    expect(game.config().maxTroops(red)).toBeCloseTo(before * 0.85);
    congressOf(game).dropTallyResolutions();
    runTicks(game, 10);
    expect(red.domestic()!.pct("maxTroops")).toBe(0);
    expect(red.domestic()!.toData().congressModifiers).toBeUndefined();
  });

  test("a war tax bites only while aggressing", async () => {
    const { game, red } = await three();
    enact(game, { resolution: "war_tax" });
    runTicks(game, 10);
    const d = red.domestic()!;
    const max = game.config().maxTroops(red);
    expect(activeConditions(red, max, false).has("aggressing")).toBe(false);
    d.setConditions(activeConditions(red, max, false));
    expect(d.pct("allGold")).toBe(0);
    d.setConditions(activeConditions(red, max, true));
    expect(d.pct("allGold")).toBe(-30);
    expect(d.pct("troopUpkeep")).toBe(50);
  });

  test("the domestic second turns aggressing on from the ledger, so a war tax bites", async () => {
    const { game, red, blue } = await three();
    enact(game, { resolution: "war_tax" });
    game.addExecution(new DomesticExecution());
    runTicks(game, 10);
    const d = red.domestic()!;
    expect(d.activeConditions().has("aggressing")).toBe(false);
    expect(d.pct("allGold")).toBe(0);
    ledger.forced.add(red.id());
    runTicks(game, 10);
    expect(d.activeConditions().has("aggressing")).toBe(true);
    expect(d.toData().conditions).toContain("aggressing");
    expect(d.pct("allGold")).toBe(-30);
    expect(d.pct("troopUpkeep")).toBe(50);
    expect(blue.domestic()!.activeConditions().has("aggressing")).toBe(false);
    expect(blue.domestic()!.pct("allGold")).toBe(0);
    ledger.forced.clear();
    runTicks(game, 10);
    expect(d.activeConditions().has("aggressing")).toBe(false);
    expect(d.pct("allGold")).toBe(0);
  });

  test("a domestic game without a congress never has aggressing", async () => {
    const game = await setup("plains", { domesticMode: true }, [RED, BLUE]);
    const red = own(game, RED.id, 0, 0, 30, 100);
    game.executeNextTick();
    ledger.forced.add(red.id());
    game.addExecution(new DomesticExecution());
    runTicks(game, 20);
    expect(red.domestic()!.activeConditions().has("aggressing")).toBe(false);
    expect(red.domestic()!.toData().conditions ?? []).not.toContain(
      "aggressing",
    );
  });

  test("law review: every holder's law ×1.5 when recommended, off when suspended", async () => {
    const { game, red, blue, green } = await three();
    grantLaws(red, { doctrine: "B" });
    grantLaws(blue, { doctrine: "B" });
    enact(game, { resolution: "law_review", param: "doctrine:B" });
    runTicks(game, 10);
    expect(red.domestic()!.pct("attackSpeed")).toBe(45);
    expect(blue.domestic()!.pct("attackSpeed")).toBe(45);
    expect(green.domestic()!.pct("attackSpeed")).toBe(0);
    congressOf(game).dropTallyResolutions();
    enact(game, { resolution: "law_review", option: "B", param: "doctrine:B" });
    runTicks(game, 10);
    expect(red.domestic()!.pct("attackSpeed")).toBe(0);
  });

  test("research fund and government resolutions", async () => {
    const { game, red, blue } = await three();
    grantGovernment(red, "monarchy");
    enact(game, { resolution: "research_fund" });
    enact(game, {
      resolution: "government_resolution",
      option: "B",
      param: "monarchy",
    });
    runTicks(game, 10);
    // Blue keeps chiefdom (no modifiers); red's monarchy adds science -15.
    expect(blue.domestic()!.pct("science")).toBe(20);
    expect(blue.domestic()!.pct("political")).toBe(-10);
    expect(red.domestic()!.pct("science")).toBe(5);
    expect(red.domestic()!.pct("political")).toBe(-35);
  });
});

describe("enforced resolutions", () => {
  test("sanctions: no trade either way, no donations to the target", async () => {
    const { game, red, blue, green } = await three({
      donateGold: true,
      donateTroops: true,
    });
    red.createAllianceRequest(blue)?.accept();
    expect(red.canTrade(blue)).toBe(true);
    expect(blue.canDonateGold(red)).toBe(true);
    enact(game, { resolution: "sanction", targets: [red.smallID()] });
    expect(red.canTrade(blue)).toBe(false);
    expect(blue.canTrade(red)).toBe(false);
    expect(blue.canTrade(green)).toBe(true);
    expect(blue.canDonateGold(red)).toBe(false);
    expect(blue.canDonateTroops(red)).toBe(false);
    expect(red.canDonateGold(blue)).toBe(true);
  });

  test("a building ban locks that structure's new builds and upgrades for everyone", async () => {
    const { game, red, blue } = await three();
    red.addGold(10_000_000n);
    blue.addGold(10_000_000n);
    const city = red.buildUnit(UnitType.City, game.ref(5, 5), {});
    enact(game, { resolution: "building_pact", option: "B", param: "city" });
    expect(red.canBuild(UnitType.City, game.ref(20, 50))).toBe(false);
    expect(blue.canBuild(UnitType.City, game.ref(45, 50))).toBe(false);
    expect(red.canUpgradeUnit(city)).toBe(false);
    expect(red.canBuild(UnitType.DefensePost, game.ref(20, 50))).not.toBe(
      false,
    );
    const city2 = red
      .buildableUnits(game.ref(20, 50))
      .find((b) => b.type === UnitType.City)!;
    expect(city2.banned).toBe(true);
    expect(red.isCongressBanned(UnitType.City)).toBe(true);
  });

  test("an arms embargo bans its target's nukes and new silos; others buy freely", async () => {
    const { game, red, blue } = await three();
    for (const [p, x] of [
      [red, 10],
      [blue, 40],
    ] as const) {
      grantTechs(p, "rocketry", "manhattan_project");
      p.addGold(100_000_000n);
      p.buildUnit(UnitType.MissileSilo, game.ref(x, 10), {});
    }
    enact(game, { resolution: "arms_embargo", targets: [red.smallID()] });
    expect(red.canBuild(UnitType.AtomBomb, game.ref(45, 50))).toBe(false);
    expect(blue.canBuild(UnitType.AtomBomb, game.ref(15, 50))).not.toBe(false);
    expect(red.canBuild(UnitType.MissileSilo, game.ref(20, 80))).toBe(false);
    expect(red.canBuild(UnitType.DefensePost, game.ref(20, 80))).not.toBe(
      false,
    );
  });

  test("with strategic weapons the embargo stops production, never a launch from stock", async () => {
    const { game, red } = await three({ strategicWeapons: true });
    grantTechs(red, "railroad", "rocketry", "manhattan_project");
    red.addGold(100_000_000n);
    red.buildUnit(UnitType.Factory, game.ref(10, 30), {});
    red.buildUnit(UnitType.MissileSilo, game.ref(10, 10), {});
    red.strategic()!.addStock(UnitType.AtomBomb);
    enact(game, { resolution: "arms_embargo", targets: [red.smallID()] });
    expect(red.canBuild(UnitType.AtomBomb, game.ref(45, 50))).not.toBe(false);
    const atom = red
      .buildableUnits(game.ref(45, 50))
      .find((b) => b.type === UnitType.AtomBomb)!;
    expect(atom.banned).toBe(false);
    game.addExecution(new NukeProductionExecution(red, UnitType.AtomBomb));
    runTicks(game, 1);
    expect(red.strategic()!.jobs()).toHaveLength(0);
  });

  test("non-proliferation stops new production and leaves a running line alone", async () => {
    const { game, red } = await three({ strategicWeapons: true });
    grantTechs(red, "railroad", "rocketry", "manhattan_project");
    red.addGold(100_000_000n);
    const factory = red.buildUnit(UnitType.Factory, game.ref(10, 30), {});
    factory.increaseLevel();
    game.addExecution(new NukeProductionExecution(red, UnitType.AtomBomb));
    runTicks(game, 1);
    expect(red.strategic()!.jobs()).toHaveLength(1);
    enact(game, { resolution: "non_proliferation" });
    game.addExecution(new NukeProductionExecution(red, UnitType.AtomBomb));
    runTicks(game, 1);
    expect(red.strategic()!.jobs()).toHaveLength(1);
  });

  test("military aid and the development race shorten nuke production (capped at -60%)", async () => {
    const { game, red } = await three({ strategicWeapons: true });
    grantTechs(red, "railroad", "rocketry", "manhattan_project");
    red.addGold(100_000_000n);
    const factory = red.buildUnit(UnitType.Factory, game.ref(10, 30), {});
    factory.increaseLevel();
    const c = congressOf(game);
    enact(game, {
      resolution: "arms_embargo",
      option: "B",
      targets: [red.smallID()],
    });
    expect(nukeProductionTimePct(c, red)).toBe(-50);
    game.addExecution(new NukeProductionExecution(red, UnitType.AtomBomb));
    runTicks(game, 1);
    const [first] = red.strategic()!.jobs();
    expect(first.endTick - first.startTick).toBe(100);
    enact(game, { resolution: "non_proliferation", option: "B" });
    game.addExecution(new NukeProductionExecution(red, UnitType.AtomBomb));
    runTicks(game, 1);
    const second = red.strategic()!.jobs()[1];
    expect(second.endTick - second.startTick).toBe(80);
  });

  test("promotion: a city costs 40% less and builds in half the time", async () => {
    const { game, red } = await three();
    const c = congressOf(game);
    const cost = () => game.unitInfo(UnitType.City).cost(game, red);
    const before = cost();
    enact(game, { resolution: "building_pact", param: "city" });
    expect(cost()).toBe(BigInt(Math.round(Number(before) * 0.6)));
    expect(domesticConstructionTicks(20, red, UnitType.City, -50)).toBe(10);
    red.addGold(10_000_000n);
    game.addExecution(
      new ConstructionExecution(red, UnitType.City, game.ref(20, 20)),
    );
    runTicks(game, 2);
    expect(red.units(UnitType.City)[0].constructionTicks()).toBe(10);
    expect(c.active()).toHaveLength(1);
  });
});

describe("the tech pact", () => {
  test("A: a tech two players have costs and takes 30% less", async () => {
    const { game, red, blue, green } = await three();
    grantTechs(red, "currency");
    grantTechs(blue, "currency");
    enact(game, { resolution: "tech_pact" });
    runTicks(game, 10);
    const c = congressOf(game);
    expect(c.discountedTechs()).toEqual(["currency"]);
    expect(researchCostMilli(c, "currency", 150_000)).toBe(105_000);
    green.domestic()!.addYield(105_000, 0);
    game.addExecution(new ResearchExecution(green, "currency", false));
    runTicks(game, 1);
    expect(green.domestic()!.currentResearch()).toMatchObject({
      tech: "currency",
      totalTicks: 140,
    });
    expect(green.domestic()!.scienceMilliAvailable()).toBe(0);
  });

  test("A: the cut shares the -60% research-time cap with the player's own", async () => {
    const { game, red, blue, green } = await three();
    grantTechs(red, "currency", "academia");
    grantTechs(blue, "currency", "academia");
    enact(game, { resolution: "tech_pact" });
    runTicks(game, 10);
    const c = congressOf(game);
    expect(c.discountedTechs()).toContain("currency");
    expect(c.discountedTechs()).toContain("academia");
    // No rule cuts research time by more than 30% today; a congress modifier
    // stands in for a bigger own cut. No tick runs from here on, so the
    // clock can't refresh it away.
    const g = green.domestic()!;
    g.setCongressModifiers([{ stat: "researchTime", pct: -50 }]);
    expect(g.pct("researchTime")).toBe(-50);
    g.addYield(1_000_000, 0);
    new ResearchExecution(green, "currency", false).init(game, game.ticks());
    // 200 ticks at -60%, not at -80%.
    expect(g.currentResearch()).toMatchObject({
      tech: "currency",
      totalTicks: 80,
    });

    // The reserved-research path, once that is done.
    g.advanceResearch(80);
    expect(g.hasTech("currency")).toBe(true);
    g.setQueuedTech("academia");
    processDomesticSecond(game, green, g);
    expect(g.currentResearch()).toMatchObject({
      tech: "academia",
      totalTicks: 80,
    });
  });

  test("B: the first to complete a tech nobody has gets 60 s of science", async () => {
    const { game, red, blue } = await three();
    enact(game, { resolution: "tech_pact", option: "B" });
    game.addExecution(new DomesticExecution());
    const d = red.domestic()!;
    d.beginResearch("academia", 10);
    runTicks(game, 11);
    expect(d.hasTech("academia")).toBe(true);
    expect(d.scienceMilliAvailable()).toBe(d.scienceMilliPerSecond() * 61);
    const b = blue.domestic()!;
    b.beginResearch("academia", 10);
    runTicks(game, 10);
    expect(b.hasTech("academia")).toBe(true);
    expect(b.scienceMilliAvailable()).toBe(b.scienceMilliPerSecond() * 2);
  });
});
