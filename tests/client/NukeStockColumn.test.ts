import { PlayerType, UnitType } from "@openfront/engine-api/game/GameTypes";
import { StrategicData } from "@openfront/engine-api/strategic/StrategicTypes";
import { columnById } from "../../src/client/hud/layers/lib/StatsColumns";
import { PlayerStats } from "../../src/client/hud/layers/PlayerStats";
import { UserSettings } from "../../src/client/UserSettings";
import type { GameView, PlayerView } from "../../src/client/view";

function player(id: number, stock: StrategicData | null): PlayerView {
  return {
    id: () => `p${id}`,
    smallID: () => id,
    name: () => `p${id}`,
    displayName: () => `p${id}`,
    clanTag: () => null,
    type: () => PlayerType.Human,
    numTilesOwned: () => 100,
    gold: () => 0n,
    tradeGold: () => 0,
    trainGold: () => 0,
    piracyGold: () => 0,
    goldEarned: () => 0,
    troops: () => 0,
    totalUnitLevels: () => 0,
    isAlive: () => true,
    isOnSameTeam: () => false,
    domesticData: () => null,
    strategicData: () => stock,
  } as unknown as PlayerView;
}

function game(players: PlayerView[]): GameView {
  return {
    myPlayer: () => players[0],
    playerViews: () => players,
    worldWarScenario: () => null,
    config: () => ({ maxTroops: () => 100 }),
    ticks: () => 600,
    numLandTiles: () => 1000,
    numTilesWithFallout: () => 0,
  } as unknown as GameView;
}

const STOCK: StrategicData = {
  stock: {
    [UnitType.AtomBomb]: 2,
    [UnitType.HydrogenBomb]: 1,
    [UnitType.MIRV]: 1,
  },
  jobs: [],
  satellite: { phase: "none" },
};

describe("nukes column", () => {
  beforeEach(() => {
    localStorage.clear();
    (
      UserSettings as unknown as { cache: Map<string, string | null> }
    ).cache.clear();
  });

  it("sums each player's stockpile, for everyone to see, and can't be hidden", () => {
    const a = player(1, STOCK);
    const column = columnById("nukes");
    expect(column.value?.(a, game([a]))).toBe(4);
    expect(column.value?.(player(2, null), game([a]))).toBe(0);
    expect(column.cell({ position: 1, name: "a", value: 4 }, game([a]))).toBe(
      "4",
    );
    expect(column.isHideable).toBe(false);
    expect(column.strategicOnly).toBe(true);
  });

  it("player stats show it only with strategic weapons", async () => {
    for (const [on, template] of [
      [true, "34px 80px 100px auto auto auto auto 32px"],
      [false, "34px 80px 100px auto auto auto 32px"],
    ] as const) {
      const stats = new PlayerStats();
      stats.game = game([player(1, STOCK)]);
      stats.visible = true;
      stats.strategicWeapons = on;
      document.body.append(stats);
      stats.refresh();
      await stats.updateComplete;
      // rank, clan, player | (nukes,) tiles, gold, maxtroops | picker
      expect(
        stats.querySelector(".stats-table-content")?.getAttribute("style"),
      ).toContain(template);
      stats.remove();
    }
  });
});

describe("default order with strategic weapons", () => {
  it("ranks by land, not by the nukes column in front of it", async () => {
    const big = player(1, null);
    const armed = player(2, STOCK);
    (big as unknown as { numTilesOwned: () => number }).numTilesOwned = () =>
      500;
    const stats = new PlayerStats();
    stats.game = game([big, armed]);
    stats.visible = true;
    stats.strategicWeapons = true;
    document.body.append(stats);
    stats.refresh();
    await stats.updateComplete;
    expect((stats as unknown as { sortKey: string | null }).sortKey).toBe(
      "tiles",
    );
    stats.remove();
  });
});

describe("satellite icon on the leaderboard", () => {
  const withSatellite = (phase: StrategicData["satellite"]): StrategicData => ({
    ...STOCK,
    satellite: phase,
  });

  it("marks nations with a satellite in orbit or counting down", () => {
    const stats = new PlayerStats();
    stats.strategicWeapons = true;
    const players = [
      player(1, STOCK),
      player(2, withSatellite({ phase: "orbit" })),
      player(
        3,
        withSatellite({
          phase: "targeted",
          target: 1,
          strikeTick: 9,
          interceptors: [],
        }),
      ),
      player(
        4,
        withSatellite({
          phase: "preparing",
          siloId: 1,
          startTick: 0,
          readyTick: 9,
        }),
      ),
    ];
    const rows = (
      stats as unknown as {
        buildRows(
          g: GameView,
          c: never[],
        ): { key: string; satellite: boolean }[];
      }
    ).buildRows(game(players), []);
    expect(rows.map((r) => [r.key, r.satellite])).toEqual([
      ["p1", false],
      ["p2", true],
      ["p3", true],
      ["p4", false],
    ]);
  });
});
