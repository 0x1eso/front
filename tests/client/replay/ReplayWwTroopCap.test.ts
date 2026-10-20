import type { GameConfig } from "@openfront/engine-api/Schemas";
import { Config } from "@openfront/engine-lib/configuration/Config";
import { describe, expect, it } from "vitest";
import type {
  PlayerState,
  PlayerStatic,
} from "../../../src/client/render/types/Renderer";
import type { ReplayFrame } from "../../../src/client/replay/codec/ReplayTypes";
import { ReplayGameView } from "../../../src/client/replay/ReplayGameAdapter";

// World War 1936 P1: Config.maxTroops asks the player for its economy's
// troop cap in this mode, so a replay player has to answer too.

function view(worldWar: boolean): ReplayGameView {
  const info = {
    smallID: 1,
    id: "P1",
    name: "Germany",
    displayName: "Germany",
    clanTag: null,
    clientID: null,
    playerType: 0,
    team: null,
    isLobbyCreator: false,
  } as unknown as PlayerStatic;
  const config = new Config(
    { worldWar1936: worldWar } as unknown as GameConfig,
    true,
  );
  return new ReplayGameView([info], config, 10, 10, 100, new Uint8Array(100));
}

function frame(
  tick: number,
  troops: number,
  caps: { smallID: number; troopCap: number }[] | null,
): ReplayFrame {
  return {
    frame: tick,
    tick,
    tileState: new Uint16Array(100),
    changedTiles: null,
    falloutTiles: 0,
    players: new Map([
      [1, { troops, isAlive: true } as unknown as PlayerState],
    ]),
    units: new Map(),
    names: new Map(),
    terrain: new Map(),
    changedTerrain: null,
    miscUpdates:
      caps === null
        ? null
        : {
            WwEconomy: [
              { data: { countries: caps, details: [], regions: [] } },
            ],
          },
  };
}

describe("a World War 1936 replay's troop cap", () => {
  it("comes from the economy updates, the army before the first", () => {
    const v = view(true);
    const p = v.playerBySmallID(1)!;
    v.update(frame(1, 480_000, null), new Uint8Array(100), 0, false);
    expect(p.wwTroopCap()).toBe(480_000);
    v.update(
      frame(2, 480_000, [{ smallID: 1, troopCap: 630_000 }]),
      new Uint8Array(100),
      0,
      false,
    );
    expect(p.wwTroopCap()).toBe(630_000);
    // The HUD's maxTroops no longer throws on a replay player.
    expect(v.config().maxTroops(p as never)).toBe(630_000);
    // Kept until the next update…
    v.update(frame(3, 500_000, null), new Uint8Array(100), 0, false);
    expect(p.wwTroopCap()).toBe(630_000);
    // …but not across a seek.
    v.update(frame(900, 300_000, null), new Uint8Array(100), 0, false, true);
    expect(p.wwTroopCap()).toBe(300_000);
  });

  it("is null outside the mode", () => {
    const v = view(false);
    v.update(frame(1, 1_000, null), new Uint8Array(100), 0, false);
    expect(v.playerBySmallID(1)!.wwTroopCap()).toBeNull();
  });
});
