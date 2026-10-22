// World War 1936 P6 (spec §8.9, §20.7): the fog model — the band labels,
// the four conditions that show an enemy army, own side and spectators
// seeing everything, and the ghost token.
import { ARMY_BATTLE } from "@openfront/engine-api/ww1936/LandTypes";
import { describe, expect, it } from "vitest";
import { FAR, fogGame, NEAR, newFog } from "./FogFixture";
import { army, battle, ID } from "./LandFixture";

const polArmy = (id: number, region: number, over = {}) =>
  army(id, "POL", region, { divisions: 12, ...over });

describe("FogModel (spec §8.9)", () => {
  it("prints a division count by band: ?, 6~18, 9~15, 12", () => {
    const labels = [0, 20, 50, 80].map((level) => {
      const g = fogGame({ level, armies: [polArmy(1, NEAR)] });
      const f = newFog(g);
      const v = f.armyView(1);
      expect(v.visible).toBe(true);
      return v.visible ? v.countLabel : "";
    });
    expect(labels).toEqual(["?", "6~18", "9~15", "12"]);
  });

  it("shows an army whose province touches ours, and hides a far one", () => {
    const g = fogGame({
      armies: [polArmy(1, NEAR), polArmy(2, FAR)],
    });
    const f = newFog(g);
    expect(f.armyView(1).visible).toBe(true);
    expect(f.armyView(2).visible).toBe(false);
  });

  it("shows a far army under our air superiority >= 600 or 20 recon planes", () => {
    const g = fogGame({ armies: [polArmy(2, FAR)] });
    const f = newFog(g);
    expect(f.armyView(2).visible).toBe(false);
    g.state.superiority = 600;
    g.air.version++;
    expect(f.armyView(2).visible).toBe(true);
    g.state.superiority = 0;
    g.air.version++;
    expect(f.armyView(2).visible).toBe(false);
    g.air.deployments.set(1, {
      sr: g.game.worldWarScenario().regionSr(FAR),
      mission: "recon",
      counts: [12, 8],
    });
    g.air.version++;
    expect(f.armyView(2).visible).toBe(true);
  });

  it("shows a far army when our army intel on it is exact", () => {
    const g = fogGame({ level: 80, armies: [polArmy(2, FAR)] });
    expect(newFog(g).armyView(2).visible).toBe(true);
  });

  it("shows a far army whose divisions fight ours", () => {
    const g = fogGame({
      armies: [polArmy(2, FAR, { state: ARMY_BATTLE })],
      battles: [battle(FAR, "DEU", "POL", {})],
    });
    expect(newFog(g).armyView(2).visible).toBe(true);
  });

  it("shows everything to a spectator and the game's end", () => {
    const g = fogGame({ armies: [polArmy(2, FAR)], spectator: true });
    const f = newFog(g);
    const v = f.armyView(2);
    expect(v.visible && v.countLabel).toBe("12");
    expect(f.fogOff()).toBe(true);
    const h = fogGame({ armies: [polArmy(2, FAR)] });
    h.state.over = true;
    expect(newFog(h).fogOff()).toBe(true);
  });

  it("shows our own side exactly, whatever the intel row says", () => {
    const g = fogGame({
      level: 0,
      armies: [army(5, "DEU", 4, { divisions: 9 })],
    });
    const v = newFog(g).armyView(5);
    expect(v.visible && v.countLabel).toBe("9");
    expect(v.visible && v.bars).toBe("exact");
  });

  it("keeps a ghost 10 days where an army was last seen", () => {
    const g = fogGame({ armies: [polArmy(1, NEAR)] });
    const f = newFog(g);
    expect(f.armyView(1).visible).toBe(true);
    expect(f.ghosts()).toHaveLength(0);
    // Germany loses sight: the border region's neighbour changes hands.
    g.land.apply(
      {
        armies: [],
        removedArmies: [],
        battles: [],
        endedBattles: [],
        regions: [3, 4].map((id) => ({
          id,
          controller: ID("POL"),
          supplyMilli: 0,
          useMilli: 0,
          encircled: false,
          counts: [],
        })),
        countries: [],
        details: [],
      },
      g.state.ticks,
    );
    expect(f.armyView(1).visible).toBe(false);
    expect(f.ghosts()).toHaveLength(1);
    expect(f.ghosts()[0].id).toBe(1);
    // 9 days later (15 ticks are two days): still there; 10 days: gone.
    g.state.ticks += 68;
    g.land.version++;
    expect(f.ghosts()).toHaveLength(1);
    g.state.ticks += 8;
    g.land.version++;
    expect(f.ghosts()).toHaveLength(0);
  });
});
