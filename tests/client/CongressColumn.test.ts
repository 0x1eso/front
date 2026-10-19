import { CongressData } from "@openfront/engine-api/congress/CongressTypes";
import { PlayerType } from "@openfront/engine-api/game/GameTypes";
import { columnById } from "../../src/client/hud/layers/lib/StatsColumns";
import { PlayerStats } from "../../src/client/hud/layers/PlayerStats";
import { UserSettings } from "../../src/client/UserSettings";
import type { GameView, PlayerView } from "../../src/client/view";
import { EMPTY } from "./CongressFixture";

function player(id: number, tiles = 100): PlayerView {
  return {
    id: () => `p${id}`,
    smallID: () => id,
    name: () => `p${id}`,
    displayName: () => `p${id}`,
    clanTag: () => null,
    type: () => PlayerType.Human,
    numTilesOwned: () => tiles,
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
    strategicData: () => null,
  } as unknown as PlayerView;
}

function game(players: PlayerView[], data: CongressData | null): GameView {
  return {
    myPlayer: () => players[0],
    playerViews: () => players,
    config: () => ({ maxTroops: () => 100 }),
    ticks: () => 600,
    numLandTiles: () => 1000,
    numTilesWithFallout: () => 0,
    congressData: () => data,
  } as unknown as GameView;
}

const DATA: CongressData = {
  ...EMPTY,
  active: [
    {
      resolution: "sanction",
      option: "A",
      targets: [2],
      param: null,
      sinceTick: 0,
      expires: "next_tally",
    },
  ],
};

describe("congress column", () => {
  beforeEach(() => {
    localStorage.clear();
    (
      UserSettings as unknown as { cache: Map<string, string | null> }
    ).cache.clear();
  });

  it("shows each nation's congress flags, for everyone, and can't be hidden", () => {
    const column = columnById("congress");
    const g = game([player(1), player(2)], DATA);
    expect(column.value?.(player(2), g)).toBe(1);
    expect(column.value?.(player(1), g)).toBe(0);
    expect(column.cell({ position: 1, name: "p2", value: 1 }, g)).toBe("⛔");
    expect(column.cell({ position: 2, name: "p1", value: 0 }, g)).toBe("");
    expect(column.isHideable).toBe(false);
    expect(column.congressOnly).toBe(true);
  });

  it("player stats show it only in congress games, and still rank by land", async () => {
    for (const [on, template] of [
      [true, "34px 80px 100px auto auto auto auto 32px"],
      [false, "34px 80px 100px auto auto auto 32px"],
    ] as const) {
      const stats = new PlayerStats();
      stats.game = game([player(1, 500), player(2)], DATA);
      stats.visible = true;
      stats.congress = on;
      document.body.append(stats);
      stats.refresh();
      await stats.updateComplete;
      expect(
        stats.querySelector(".stats-table-content")?.getAttribute("style"),
      ).toContain(template);
      expect(stats.textContent!.includes("⛔")).toBe(on);
      expect((stats as unknown as { sortKey: string | null }).sortKey).toBe(
        "tiles",
      );
      stats.remove();
    }
  });
});
