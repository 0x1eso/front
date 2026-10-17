import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { Game } from "@openfront/engine/game/Game";
import { describe, expect, test } from "vitest";
import { domesticGame, HUMAN } from "./domestic/util";
import { BLUE, RED, strategicGame } from "./strategic/util";
import { expectSnapshotRoundTrip } from "./util/Snapshot";
import { warfareGame } from "./warfare/util";

const hashOf = (g: Game): number => (g as unknown as { hash(): number }).hash();

describe("desync hash covers fork state only when its option is on", () => {
  test("domestic: science, techs and gold change the hash", async () => {
    const game = await domesticGame();
    const p = game.player(HUMAN.id);
    const base = hashOf(game);
    p.domestic()!.addYield(5_000, 0);
    const afterScience = hashOf(game);
    expect(afterScience).not.toBe(base);
    p.domestic()!.setQueuedTech("agriculture" as never);
    expect(hashOf(game)).not.toBe(afterScience);
    const before = hashOf(game);
    p.addGold(1n);
    expect(hashOf(game)).not.toBe(before);
  });

  test("strategic: stockpile changes the hash", async () => {
    const game = await strategicGame("plains");
    const red = game.player(RED.id);
    const base = hashOf(game);
    red.strategic()!.addStock(UnitType.AtomBomb as never);
    expect(hashOf(game)).not.toBe(base);
  });

  test("warfare: an airport sortie slot changes the hash", async () => {
    const game = await warfareGame("plains");
    const red = game.player(RED.id);
    const airport = red.buildUnit(UnitType.Airport, game.ref(10, 10), {});
    const base = hashOf(game);
    airport.launch();
    expect(hashOf(game)).not.toBe(base);
  });

  test("options off: fork-state-free hash ignores gold", async () => {
    const game = await warfareGame("plains", { warfareExpansion: false });
    const red = game.player(RED.id);
    const base = hashOf(game);
    red.addGold(12345n);
    expect(hashOf(game)).toBe(base);
    expect(game.player(BLUE.id)).toBeDefined();
  });

  test("hash survives a snapshot/restore round trip", async () => {
    const game = await strategicGame("plains", { domesticMode: true });
    const red = game.player(RED.id);
    red.strategic()!.addStock(UnitType.AtomBomb as never);
    red.domestic()!.addYield(7_000, 3_000);
    // Compares the hash of both games after restore and every tick after.
    const restored = await expectSnapshotRoundTrip(game, "plains", 20);
    expect(hashOf(restored)).toBe(hashOf(game));
  });
});
