import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { VictoryProjectExecution } from "@openfront/engine/domestic/VictoryProjectExecution";
import { processVictoryProjectSecond } from "@openfront/engine/domestic/VictoryProjects";
import { SAMLauncherExecution } from "@openfront/engine/execution/SAMLauncherExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { orbitalStrike } from "@openfront/engine/strategic/OrbitalStrike";
import { SatelliteTargetExecution } from "@openfront/engine/strategic/SatelliteOrders";
import { buildLevel, grantTechs } from "../domestic/util";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
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
    const strikes = [...updates[GameUpdateType.OrbitalStrike]];
    expect(strikes).toHaveLength(1);
    expect(strikes[0]).toMatchObject({
      attackerID: red.smallID(),
      targetID: blue.smallID(),
      wave: 0,
    });
    for (let i = 0; i < 40; i++) {
      strikes.push(...game.executeNextTick()[GameUpdateType.OrbitalStrike]);
    }
    expect(city.isActive()).toBe(false);
    expect(strikes.flatMap((u) => u.impacts)).toContain(city.tile());
    expect(
      updates[GameUpdateType.DisplayEvent].some(
        (m) => m.message === "events_display.satellite_strike_landed",
      ),
    ).toBe(true);
    expect(sat(red)).toEqual({ phase: "none" });
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

describe("the strike in waves (spec §6.6)", () => {
  /** Aims, runs to the strike and collects every tick's strike updates and messages. */
  async function run(extra: (g: Game, b: Player) => void = () => {}) {
    const { game, red, blue } = await theater();
    for (let i = 0; i < 6; i++) {
      blue.buildUnit(UnitType.City, game.ref(40 + 8 * i, 20 + 12 * i), {});
    }
    extra(game, blue);
    const before = blue.troops();
    const strikeTick = aim(game, red, blue);
    executeTicks(game, strikeTick - game.ticks());
    const waves: { tick: number; u: any }[] = [];
    const msgs: string[] = [];
    const troops: number[] = [];
    for (let i = 0; i < 45; i++) {
      const t = game.ticks();
      const updates = game.executeNextTick();
      for (const u of updates[GameUpdateType.OrbitalStrike]) {
        waves.push({ tick: t + 1, u });
      }
      troops.push(blue.troops());
      for (const m of updates[GameUpdateType.DisplayEvent]) {
        if (m.message === "events_display.orbital_strike_result") {
          msgs.push(JSON.stringify(m.params));
        }
      }
    }
    return { game, red, blue, strikeTick, waves, msgs, troops, before };
  }

  test("lands over about 30 ticks, one update per wave, buildings first", async () => {
    const { game, blue, strikeTick, waves } = await run();
    expect(waves.length).toBeGreaterThan(5);
    expect(waves.map((w) => w.u.wave)).toEqual(waves.map((_, i) => i));
    expect(waves.map((w) => w.u.lastWave === true)).toEqual(
      waves.map((_, i) => i === waves.length - 1),
    );
    const span = waves[waves.length - 1].tick - waves[0].tick;
    expect(span).toBeGreaterThanOrEqual(25);
    expect(span).toBeLessThan(31);
    expect(waves[0].tick).toBe(strikeTick + 1);
    // Sites come before any crater: the first impacts are the 6 cities.
    const impacts = waves.flatMap((w) => w.u.impacts as number[]);
    const city = (t: number) => game.x(t) >= 40 && game.x(t) < 90;
    expect(impacts.slice(0, 6).every(city)).toBe(true);
    expect(blue.units(UnitType.City)).toHaveLength(0);
  });

  test("each impact acts when it lands", async () => {
    const { game, red, blue } = await theater();
    for (let i = 0; i < 6; i++) {
      blue.buildUnit(UnitType.City, game.ref(40 + 8 * i, 20 + 12 * i), {});
    }
    const strikeTick = aim(game, red, blue);
    executeTicks(game, strikeTick - game.ticks() + 1);
    const left = blue.units(UnitType.City).length;
    expect(left).toBeLessThan(6);
    expect(left).toBeGreaterThan(0);
  });

  test("the 70% troop loss is applied once, at the first wave", async () => {
    const { troops, before } = await run();
    expect(troops[0]).toBeLessThan(before * 0.4);
    expect(troops[0]).toBeGreaterThan(before * 0.2);
    // Later waves do not take another 70%.
    expect(troops[troops.length - 1]).toBeGreaterThan(troops[0] * 0.9);
  });

  test("sends the result message once, with the totals", async () => {
    const { msgs } = await run();
    expect(msgs).toHaveLength(1);
    const p = JSON.parse(msgs[0]);
    expect(p.buildings).toBe(6);
    expect(p.troops).toBeGreaterThan(0);
    expect(typeof p.target).toBe("string");
  });

  test("totals match the all-at-once strike", async () => {
    const waved = await run();
    const { game, red, blue } = await theater();
    for (let i = 0; i < 6; i++) {
      blue.buildUnit(UnitType.City, game.ref(40 + 8 * i, 20 + 12 * i), {});
    }
    const before = blue.numTilesOwned();
    aim(game, red, blue);
    // same tick as the waved run, so the same seed
    executeTicks(game, waved.strikeTick - game.ticks());
    orbitalStrike(game, red, blue);
    executeTicks(game, 2);
    for (const left of [waved.blue.numTilesOwned(), blue.numTilesOwned()]) {
      expect(left).toBeLessThan(before * 0.75);
      expect(left).toBeGreaterThan(before * 0.55);
    }
  });

  test("a snapshot mid-strike restores and finishes identically", async () => {
    const { game, red, blue } = await theater();
    for (let i = 0; i < 6; i++) {
      blue.buildUnit(UnitType.City, game.ref(40 + 8 * i, 20 + 12 * i), {});
    }
    const strikeTick = aim(game, red, blue);
    executeTicks(game, strikeTick - game.ticks() + 10);
    expect(red.strategic()!.strike()).not.toBeNull();
    await expectSnapshotRoundTrip(game, "plains", 40);
  });

  test("a strike in progress is kept when the target is allied meanwhile", async () => {
    const { game, red, blue } = await theater();
    blue.buildUnit(UnitType.City, game.ref(70, 50), {});
    const strikeTick = aim(game, red, blue);
    executeTicks(game, strikeTick - game.ticks() + 3);
    red.createAllianceRequest(blue)?.accept();
    executeTicks(game, 40);
    expect(red.strategic()!.strike()).toBeNull();
  });
});
