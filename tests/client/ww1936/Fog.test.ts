// World War 1936 P6 (spec §8.9, §20.7): the fog model — the band labels,
// the four conditions that show an enemy army, own side and spectators
// seeing everything, and the ghost token.
import { ID_ARMY } from "@openfront/engine-api/ww1936/DepthTypes";
import { ARMY_BATTLE } from "@openfront/engine-api/ww1936/LandTypes";
import { describe, expect, it } from "vitest";
import { FogModel } from "../../../src/client/hud/ww1936/FogModel";
import { WwEndgameView } from "../../../src/client/view/WwEndgameView";
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

  it("shows volunteers fighting for my side exactly, like a faction ally (T1b)", () => {
    const g = fogGame({
      armies: [
        // Soviet volunteers for me (Germany) and for my ally Italy, far away.
        army(1, "SUN", FAR, { divisions: 13, volunteerFor: ID("DEU") }),
        army(2, "SUN", FAR, { divisions: 11, volunteerFor: ID("ITA") }),
        // Italy itself, my faction: the existing ally rule.
        army(3, "ITA", FAR, { divisions: 7 }),
        // British volunteers for my enemy Poland: still fogged (and far).
        army(4, "GBR", FAR, { divisions: 9, volunteerFor: ID("POL") }),
        // My own army sent as volunteers to Poland's enemy elsewhere: mine.
        army(5, "DEU", FAR, { divisions: 5, volunteerFor: ID("ITA") }),
      ],
    });
    // Italy's politics summary: the same faction as mine (the ally rule).
    const deu = g.pol.summary(ID("DEU"))!;
    g.pol.apply(
      {
        countries: [{ ...deu, smallID: ID("ITA") }],
        details: [],
        global: null,
        regions: [],
        news: [],
        cards: [],
      } as never,
      700,
    );
    const f = newFog(g);
    const exact = (id: number, n: number) => {
      const v = f.armyView(id);
      expect(v.visible).toBe(true);
      expect(v.visible && [v.countLabel, v.bars, v.composition]).toEqual([
        String(n),
        "exact",
        true,
      ]);
    };
    exact(1, 13);
    exact(2, 11);
    exact(3, 7);
    exact(5, 5);
    expect(f.armyView(4).visible).toBe(false);
    // The same Soviet army without the volunteer mark: hidden, as before.
    const h = fogGame({ armies: [army(1, "SUN", FAR, { divisions: 13 })] });
    expect(newFog(h).armyView(1).visible).toBe(false);
  });

  it("final review C (I3): an exile and a takeover chooser keep the fog", () => {
    // My country (Germany) holds no land: the GameView calls me a spectator
    // (isSpectator is !isAlive), but the endgame says whether I still play.
    const g = fogGame({ armies: [polArmy(2, FAR)], spectator: true });
    const eg = new WwEndgameView();
    const deu = g.players[ID("DEU") - 1];
    const dead = { ...deu, isAlive: () => false, hasSpawned: () => true };
    const game = {
      ...g.game,
      myClientID: () => "c1",
      wwEndgame: () => eg,
      myPlayer: () => dead,
    };
    const f = new FogModel(game as never);
    // A government in exile: it commands its escaped armies, so the fog stays.
    eg.apply({
      news: [],
      exiles: [
        {
          smallID: ID("DEU"),
          host: ID("ITA"),
          legitBp: 5_000,
          deltaBp: 0,
          virtualMil: 5,
          capital: 3,
        },
      ],
    });
    g.land.version++;
    expect(f.fogOff()).toBe(false);
    expect(f.armyView(2).visible).toBe(false);
    expect(f.countLabel(ID("POL"), 41, ID_ARMY)).toBe("?");
    // Picking a takeover country: the candidates and the map stay fogged.
    eg.apply({
      news: [],
      exiles: [],
      takeover: [
        {
          client: "c1",
          from: ID("DEU"),
          candidates: [ID("ITA")],
          deadlineTick: 900,
        },
      ],
    });
    g.land.version++;
    expect(f.fogOff()).toBe(false);
    expect(f.armyView(2).visible).toBe(false);
    // Out of the game (gone, no exile, no card): the spectator's full view.
    eg.apply({ news: [], exiles: [], takeover: [] });
    g.land.version++;
    expect(f.fogOff()).toBe(true);
    expect(f.armyView(2).visible).toBe(true);
    // Spectating after the card (controller 0): the same.
    eg.apply({ news: [], controllers: [["c1", 0]] });
    expect(f.fogOff()).toBe(true);
    // A replay is never fogged.
    const r = { ...game, config: () => ({ isReplay: () => true }) };
    eg.apply({ news: [], controllers: [], exiles: [], takeover: [] });
    expect(new FogModel(r as never).fogOff()).toBe(true);
  });

  it("final review C (I3): a new observer does not inherit the old one's ghosts", () => {
    const g = fogGame({ armies: [polArmy(1, NEAR)] });
    const f = newFog(g);
    expect(f.armyView(1).visible).toBe(true);
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
    expect(f.ghosts()).toHaveLength(1);
    // My client takes over France (spec §11): Germany's sightings go.
    f.setObserver(ID("FRA"));
    expect(f.ghosts()).toHaveLength(0);
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
