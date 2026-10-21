import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import type { GameConfig } from "@openfront/engine-api/Schemas";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { Config } from "@openfront/engine-lib/configuration/Config";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { describe, expect, it } from "vitest";
import type {
  PlayerState,
  PlayerStatic,
} from "../../../src/client/render/types/Renderer";
import { FrameNormalizer } from "../../../src/client/replay/codec/FrameNormalizer";
import type {
  MiscUpdates,
  ReplayFrame,
} from "../../../src/client/replay/codec/ReplayTypes";
import { ReplayGameView } from "../../../src/client/replay/ReplayGameAdapter";
import { HUMAN, step, stepTo, wwRunnerCapture } from "../../ww1936/util";

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

/** The economy's misc updates as a replay keeps them (FrameNormalizer). */
function capsMisc(
  caps: { smallID: number; troopCap: number }[] | null,
): MiscUpdates | null {
  return caps === null
    ? null
    : { WwEconomy: [{ caps: caps.flatMap((c) => [c.smallID, c.troopCap]) }] };
}

function frame(
  tick: number,
  troops: number,
  caps: { smallID: number; troopCap: number }[] | null,
  miscUpdates: MiscUpdates | null = capsMisc(caps),
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
    miscUpdates,
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

  it("reads a replay recorded before the trim (whole economy updates)", () => {
    const v = view(true);
    const p = v.playerBySmallID(1)!;
    const whole = {
      WwEconomy: [
        {
          data: {
            countries: [{ smallID: 1, troopCap: 630_000 }],
            details: [],
            regions: [],
          },
        },
      ],
    };
    v.update(frame(1, 480_000, null, whole), new Uint8Array(100), 0, false);
    expect(p.wwTroopCap()).toBe(630_000);
    // No HUD reads the economy's updates: they don't reach its event feed.
    expect(v.updatesSinceLastTick()[GameUpdateType.WwEconomy]).toEqual([]);
  });

  it("is null outside the mode", () => {
    const v = view(false);
    v.update(frame(1, 1_000, null), new Uint8Array(100), 0, false);
    expect(v.playerBySmallID(1)!.wwTroopCap()).toBeNull();
  });
});

describe("a World War 1936 replay keeps only the economy's troop caps", () => {
  it("is a small fraction of the economy stream, and every cap is kept", async () => {
    // A human Germany: its details (queue, lines, research, deals, stock)
    // ride on the stream too.
    const { runner, updates } = await wwRunnerCapture({}, [
      { clientID: HUMAN, country: "DEU" },
    ]);
    const econ = runner.game.worldWar()!.economy;
    const n = new FrameNormalizer();
    const v = view(true);
    let raw = 0;
    let kept = 0;
    let entries = 0;
    let seen = 0;
    const end = dayStartTick(12, WW_PREP_TICKS);
    // From the first tick (the start's countries) past twelve days.
    stepTo(runner, 1);
    while (runner.game.ticks() < end) {
      if (updates.length === seen) step(runner);
      for (; seen < updates.length; seen++) {
        const gu = updates[seen];
        const stream = gu.updates[GameUpdateType.WwEconomy];
        const misc = n.push(gu).misc;
        if (stream.length > 0) raw += JSON.stringify(stream).length;
        if (misc?.WwEconomy !== undefined) {
          kept += JSON.stringify(misc.WwEconomy).length;
        }
        const want = stream.flatMap((u) =>
          u.data.countries.map((c) => [c.smallID, c.troopCap]),
        );
        entries += want.length;
        const caps = (misc?.WwEconomy ?? []).flatMap(
          (u) => (u as { caps: number[] }).caps,
        );
        expect(caps).toEqual(want.flat());
        // Through the replay file's JSON, as the viewer reads it.
        v.update(
          {
            ...frame(gu.tick, 0, null),
            miscUpdates:
              misc === null ? null : JSON.parse(JSON.stringify(misc)),
          },
          new Uint8Array(100),
          0,
          false,
        );
        for (const [id, cap] of want) expect(v.wwTroopCapOf(id)).toBe(cap);
      }
    }
    // Every country's cap, and today's, as the engine has it (P2: the men
    // in its field divisions, the troop mirror).
    const land = runner.game.worldWar()!.land;
    // P5 plan decision 4: the dormant slots have no economy (no updates).
    const playing = econ
      .countries()
      .filter((ce) => !econ.scenario.isDormantSlot(ce.smallID));
    for (const ce of playing) {
      expect(v.wwTroopCapOf(ce.smallID)).toBe(land.fieldMen(ce.smallID));
    }
    expect(entries).toBeGreaterThan(12 * playing.length);
    console.log(
      `ww1936 replay economy: ${raw} B streamed, ${kept} B kept over ${entries} caps`,
    );
    // About a dozen bytes a cap, against the whole stream.
    expect(kept).toBeLessThan(24 * entries);
    expect(kept * 10).toBeLessThan(raw);
  }, 120_000);
});
