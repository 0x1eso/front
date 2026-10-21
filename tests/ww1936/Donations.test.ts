import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { vi } from "vitest";
import { byTag, stamped, step, stepTo, wwRunner } from "./util";

/**
 * Ports are off in this mode since P4 (naval bases replace them), like
 * every vanilla building: the capitulation tests turn them back on to
 * reach P0's guard.
 */
function allowPorts(runner: GameRunner): void {
  const cfg = runner.game.config();
  const off = cfg.isUnitDisabled.bind(cfg);
  vi.spyOn(cfg, "isUnitDisabled").mockImplementation(
    (t) => t !== UnitType.Port && off(t),
  );
}

// Britain and France share the Allies; Germany is in neither's faction.
const HUMANS = [
  { clientID: "HUMANGBR", country: "GBR" as const },
  { clientID: "HUMANFRA", country: "FRA" as const },
  { clientID: "HUMANDEU", country: "DEU" as const },
];

/** The lobby's donation switches off: the mode turns them back on. */
const NO_DONATIONS = { donateGold: false, donateTroops: false };

describe("World War 1936 donations (spec §7.2)", () => {
  test("a faction member gives gold to another, never troops; a neutral gives nothing", async () => {
    const runner = await wwRunner(NO_DONATIONS, HUMANS);
    const g = runner.game;
    expect(g.config().donateGold()).toBe(true);
    const [gbr, fra, deu] = (["GBR", "FRA", "DEU"] as const).map((t) =>
      byTag(g, t),
    );
    stepTo(runner, WW_PREP_TICKS + 1);
    expect(gbr.canDonateGold(fra)).toBe(true);
    // P2 spec §13.1: men are divisions; none are given away.
    expect(gbr.canDonateTroops(fra)).toBe(false);
    expect(deu.canDonateGold(fra)).toBe(false);
    expect(deu.canDonateTroops(fra)).toBe(false);

    const fraGold = fra.gold();
    const [gbrTroops, fraTroops] = [gbr.troops(), fra.troops()];
    // (A donor waits a cooldown between two donations to one recipient.)
    step(runner, 1, [
      stamped("HUMANGBR", {
        type: "donate_gold",
        recipient: fra.id(),
        gold: 1_000,
      }),
      stamped("HUMANFRA", {
        type: "donate_troops",
        recipient: gbr.id(),
        troops: 5_000,
      }),
    ]);
    step(runner);
    expect(fra.gold() - fraGold).toBeGreaterThanOrEqual(1_000n);
    // The troops are the field divisions' mirror: nothing moved.
    expect(gbr.troops()).toBe(gbrTroops);
    expect(fra.troops()).toBe(fraTroops);

    const beforeGold = fra.gold();
    const deuGold = deu.gold();
    step(runner, 1, [
      stamped("HUMANDEU", {
        type: "donate_gold",
        recipient: fra.id(),
        gold: 1_000,
      }),
    ]);
    step(runner);
    // Germany keeps what it would have given (it only grew since).
    expect(deu.gold()).toBeGreaterThanOrEqual(deuGold);
    // France got no more than its own income.
    expect(fra.gold() - beforeGold).toBeLessThan(1_000n);
  });

  test("a capitulated country neither donates nor builds", async () => {
    const runner = await wwRunner({}, HUMANS);
    allowPorts(runner);
    const g = runner.game;
    const ww = g.worldWar()!;
    const [gbr, fra, deu] = (["GBR", "FRA", "DEU"] as const).map((t) =>
      byTag(g, t),
    );
    stepTo(runner, WW_PREP_TICKS + 1);
    gbr.addGold(10_000_000n);
    // A port (turned back on): cities are off in this mode since P1 (spec
    // §4.6), defense posts since P2 (forts replace them), ports since P4.
    const post = [...gbr.tiles()].find(
      (t) => gbr.canBuild(UnitType.Port, t) !== false,
    )!;
    expect(post).toBeDefined();
    expect(gbr.canDonateGold(fra)).toBe(true);
    // Britain capitulates (its land still on its way to Germany).
    ww.setWar(deu.smallID(), gbr.smallID(), g.ticks());
    ww.addCapitulation(gbr.smallID(), deu.smallID(), g.ticks());
    expect(gbr.canBuild(UnitType.Port, post)).toBe(false);
    expect(gbr.canDonateGold(fra)).toBe(false);
    expect(gbr.canDonateTroops(fra)).toBe(false);
    // Nor does a faction friend give to it.
    expect(fra.canDonateGold(gbr)).toBe(false);
    expect(fra.canDonateTroops(gbr)).toBe(false);
  });

  test("a capitulated country upgrades nothing", async () => {
    const runner = await wwRunner({}, HUMANS);
    allowPorts(runner);
    const g = runner.game;
    const ww = g.worldWar()!;
    const [gbr, deu] = (["GBR", "DEU"] as const).map((t) => byTag(g, t));
    stepTo(runner, WW_PREP_TICKS + 1);
    gbr.addGold(100_000_000n);
    // A port (ports level up; cities and factories are off in this mode).
    const coast = [...gbr.tiles()].find(
      (t) => gbr.canBuild(UnitType.Port, t) !== false,
    )!;
    const spawn = gbr.canBuild(UnitType.Port, coast);
    expect(spawn).not.toBe(false);
    const port = gbr.buildUnit(UnitType.Port, spawn as number, {});
    // (Finished at once: the test needs a port, not its construction.)
    port.setUnderConstruction(false);
    expect(gbr.canUpgradeUnit(port)).toBe(true);
    const offer = () =>
      gbr.buildableUnits(port.tile(), [UnitType.Port])[0].canUpgrade;
    expect(offer()).toBe(port.id());
    ww.setWar(deu.smallID(), gbr.smallID(), g.ticks());
    ww.addCapitulation(gbr.smallID(), deu.smallID(), g.ticks());
    expect(gbr.canUpgradeUnit(port)).toBe(false);
    expect(gbr.findUnitToUpgrade(UnitType.Port, port.tile())).toBe(false);
    expect(offer()).toBe(false);
  });
});
