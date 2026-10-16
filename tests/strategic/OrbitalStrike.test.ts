import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { VictoryProjectExecution } from "@openfront/engine/domestic/VictoryProjectExecution";
import { processVictoryProjectSecond } from "@openfront/engine/domestic/VictoryProjects";
import { SAMLauncherExecution } from "@openfront/engine/execution/SAMLauncherExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { orbitalStrike } from "@openfront/engine/strategic/OrbitalStrike";
import { SatelliteTargetExecution } from "@openfront/engine/strategic/SatelliteOrders";
import { buildLevel, grantTechs } from "../domestic/util";
import { executeTicks } from "../util/utils";
import { BLUE, own, RED, strategicGame } from "./util";

// plains: red holds x 0-29, blue (the target) x 30-99 — 7,000 tiles, so
// craters have the 10-tile maximum radius.
async function theater(config: Parameters<typeof strategicGame>[1] = {}) {
  const game = await strategicGame("plains", { instantBuild: true, ...config });
  const red = own(game, RED.id, 0, 0, 30, 100);
  const blue = own(game, BLUE.id, 30, 0, 70, 100);
  blue.addGold(100_000_000n);
  blue.addTroops(100_000);
  return { game, red, blue };
}

/** Red's satellite in orbit aims at `target`; returns the strike tick. */
function aim(game: Game, red: Player, target: Player): number {
  red.strategic()!.setSatellite({ phase: "orbit" });
  game.addExecution(new SatelliteTargetExecution(red, target.id()));
  executeTicks(game, 1);
  return (red.strategic()!.satellite() as { strikeTick: number }).strikeTick;
}

const sat = (p: Player) => p.strategic()!.satellite();

describe("the orbital strike", () => {
  test("destroys every building of the target, warfare and domestic ones included", async () => {
    const { game, red, blue } = await theater({
      domesticMode: true,
      warfareExpansion: true,
    });
    const types = [
      UnitType.City,
      UnitType.Port,
      UnitType.Factory,
      UnitType.DefensePost,
      UnitType.SAMLauncher,
      UnitType.MissileSilo,
      UnitType.ResearchInstitute,
      UnitType.AdminOffice,
      UnitType.CoastalBattery,
      UnitType.Airport,
    ];
    const buildings = types.map((t, i) =>
      blue.buildUnit(t, game.ref(40 + 5 * i, 20 + (i % 3) * 25), {}),
    );
    const redCity = red.buildUnit(UnitType.City, game.ref(10, 50), {});
    orbitalStrike(game, red, blue);
    for (const b of buildings) expect(b.isActive(), b.type()).toBe(false);
    expect(redCity.isActive()).toBe(true);
  });

  test("kills 70% of the target's troops", async () => {
    const { game, red, blue } = await theater();
    const troops = blue.troops();
    orbitalStrike(game, red, blue);
    expect(blue.troops()).toBe(troops - Math.floor((troops * 70) / 100));
  });

  test("turns building sites and about 30% more of the land to sea, even without water nukes", async () => {
    const { game, red, blue } = await theater();
    const city = blue.buildUnit(UnitType.City, game.ref(70, 50), {});
    const before = blue.numTilesOwned();
    const land = [...blue.tiles()];
    orbitalStrike(game, red, blue);
    executeTicks(game, 1); // the water flush
    expect(game.config().waterNukes()).toBe(false);
    expect(game.isLand(city.tile())).toBe(false);
    const sea = land.filter((t) => !game.isLand(t));
    expect(sea.length).toBeGreaterThanOrEqual(Math.floor(before * 0.3));
    expect(sea.length).toBeLessThan(before * 0.4);
    expect(blue.numTilesOwned()).toBe(before - sea.length);
  });

  test("only the target's land turns to sea, even on a border and in a corner", async () => {
    const { game, red, blue } = await theater();
    blue.buildUnit(UnitType.City, game.ref(30, 0), {}); // next to red, map edge
    blue.buildUnit(UnitType.City, game.ref(99, 99), {}); // map corner
    const redLand = [...red.tiles()];
    orbitalStrike(game, red, blue);
    executeTicks(game, 1);
    expect(redLand.every((t) => game.isLand(t) && game.owner(t) === red)).toBe(
      true,
    );
    expect(game.isLand(game.ref(99, 99))).toBe(false);
  });

  test("the same strike falls the same way", async () => {
    const strike = async () => {
      const { game, red, blue } = await theater();
      blue.buildUnit(UnitType.City, game.ref(70, 50), {});
      const impacts = orbitalStrike(game, red, blue);
      return { impacts, left: [...blue.tiles()].sort((a, b) => a - b) };
    };
    expect(await strike()).toEqual(await strike());
  });

  test("lands 60 s after the target is chosen, past SAMs, once; the stockpile stays", async () => {
    const { game, red, blue } = await theater();
    const city = blue.buildUnit(UnitType.City, game.ref(70, 50), {});
    const sam = blue.buildUnit(UnitType.SAMLauncher, game.ref(72, 50), {});
    game.addExecution(new SAMLauncherExecution(blue, null, sam));
    blue.strategic()!.addStock(UnitType.HydrogenBomb);
    const strikeTick = aim(game, red, blue);
    executeTicks(game, strikeTick - game.ticks());
    expect(city.isActive()).toBe(true);

    const updates = game.executeNextTick();
    expect(city.isActive()).toBe(false);
    const strikes = updates[GameUpdateType.OrbitalStrike];
    expect(strikes).toHaveLength(1);
    expect(strikes[0]).toMatchObject({
      attackerID: red.smallID(),
      targetID: blue.smallID(),
    });
    expect(strikes[0].impacts).toContain(city.tile());
    expect(
      updates[GameUpdateType.DisplayEvent].some(
        (m) => m.message === "events_display.satellite_strike_landed",
      ),
    ).toBe(true);
    expect(sat(red)).toEqual({ phase: "spent" });
    expect(blue.strategic()!.stock(UnitType.HydrogenBomb)).toBe(1);
    executeTicks(game, 700);
    expect(game.executeNextTick()[GameUpdateType.OrbitalStrike]).toHaveLength(
      0,
    );
  });

  test("a target that turns friendly is spared and the satellite returns to orbit", async () => {
    const { game, red, blue } = await theater();
    const city = blue.buildUnit(UnitType.City, game.ref(70, 50), {});
    aim(game, red, blue);
    red.createAllianceRequest(blue)?.accept();
    executeTicks(game, 600);
    expect(city.isActive()).toBe(true);
    expect(sat(red)).toEqual({ phase: "orbit" });
  });

  test("a target eliminated before the strike leaves the satellite in orbit", async () => {
    const { game, red, blue } = await theater();
    aim(game, red, blue);
    for (const t of [...blue.tiles()]) blue.relinquish(t);
    executeTicks(game, 600);
    expect(sat(red)).toEqual({ phase: "orbit" });
  });

  test("domestic: a victory project in a struck building fails", async () => {
    const { game, red, blue } = await theater({ domesticMode: true });
    const host = buildLevel(game, blue, UnitType.ResearchInstitute, 80, 12, 3);
    grantTechs(blue, "space_program");
    game.addExecution(new VictoryProjectExecution(blue, "science", host.id()));
    executeTicks(game, 1);
    expect(blue.domestic()!.victoryProject()?.hostUnitId).toBe(host.id());
    orbitalStrike(game, red, blue);
    expect(host.isActive()).toBe(false);
    processVictoryProjectSecond(game, blue, blue.domestic()!);
    expect(blue.domestic()!.victoryProject()).toBeNull();
  });
});
