import {
  MessageType,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { activeConditions } from "@openfront/engine/domestic/DomesticEconomy";
import { DomesticExecution } from "@openfront/engine/domestic/DomesticExecution";
import {
  hasActiveVictoryProject,
  processVictoryProjectSecond,
  victoryProjectHosts,
} from "@openfront/engine/domestic/VictoryProjects";
import { AttackExecution } from "@openfront/engine/execution/AttackExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { vi } from "vitest";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import { executeTicks } from "../util/utils";
import { buildLevel, conquerRect, domesticGame, HUMAN } from "./util";

const RIVAL = new PlayerInfo("rival", PlayerType.Human, null, "rival_id");

/** a holds the left half of the plains, b the right half. */
async function twoPlayers(): Promise<{ game: Game; a: Player; b: Player }> {
  const game = await domesticGame({}, [HUMAN, RIVAL]);
  const a = game.player(HUMAN.id);
  const b = game.player(RIVAL.id);
  conquerRect(game, a, 0, 0, 50, 100);
  conquerRect(game, b, 50, 0, 50, 100);
  return { game, a, b };
}

/**
 * One second of the project. DomesticExecution runs processDomesticSecond
 * first, which sets this second's conditions; here only that step is
 * repeated, so gold and troops stay as the test left them.
 */
function second(game: Game, player: Player): void {
  const d = player.domestic()!;
  d.setConditions(activeConditions(player, game.config().maxTroops(player)));
  processVictoryProjectSecond(game, player, d);
}

describe("victory project progress", () => {
  test("advances a second at a time and announces completion", async () => {
    const { game, a } = await twoPlayers();
    const host = buildLevel(game, a, UnitType.ResearchInstitute, 5, 50, 3);
    const d = a.domestic()!;
    d.beginVictoryProject("science", host.id(), 20);
    const spy = vi.spyOn(game, "displayMessage");

    second(game, a);
    expect(d.victoryProject()?.ticksLeft).toBe(10);
    expect(hasActiveVictoryProject(a)).toBe(true);
    expect(victoryProjectHosts(game)).toEqual([host]);

    second(game, a);
    expect(d.victoryProject()?.ticksLeft).toBe(0);
    expect(hasActiveVictoryProject(a)).toBe(false);
    expect(victoryProjectHosts(game)).toEqual([]);
    expect(spy).toHaveBeenCalledWith(
      "events_display.victory_project_complete",
      MessageType.VICTORY_PROJECT,
      null,
      undefined,
      { name: a.displayName(), project: "science" },
      host.id(),
      a.id(),
    );

    second(game, a);
    expect(d.victoryProject()?.ticksLeft).toBe(0);
  });

  test("fails without refund when the host is captured", async () => {
    const { game, a, b } = await twoPlayers();
    const host = buildLevel(game, a, UnitType.ResearchInstitute, 5, 50, 3);
    a.domestic()!.beginVictoryProject("science", host.id(), 2400);
    const gold = a.gold();
    const spy = vi.spyOn(game, "displayMessage");

    b.captureUnit(host);
    second(game, a);

    expect(a.domestic()!.victoryProject()).toBeNull();
    expect(a.gold()).toBe(gold);
    expect(spy).toHaveBeenCalledWith(
      "events_display.victory_project_failed",
      MessageType.VICTORY_PROJECT,
      null,
      undefined,
      { name: a.displayName(), project: "science" },
      undefined,
      a.id(),
    );
  });

  test("fails when the host is destroyed", async () => {
    const { game, a } = await twoPlayers();
    const host = buildLevel(game, a, UnitType.AdminOffice, 5, 50, 3);
    a.domestic()!.beginVictoryProject("political", host.id(), 2400);
    host.delete();
    second(game, a);
    expect(a.domestic()!.victoryProject()).toBeNull();
  });

  test("the political project pauses while its owner attacks another nation", async () => {
    const { game, a, b } = await twoPlayers();
    const host = buildLevel(game, a, UnitType.AdminOffice, 5, 50, 3);
    const d = a.domestic()!;
    d.beginVictoryProject("political", host.id(), 2400);
    a.setTroops(100_000);
    game.addExecution(new AttackExecution(50_000, a, b.id(), null));
    executeTicks(game, 3);
    expect(a.outgoingAttacks().length).toBeGreaterThan(0);

    second(game, a);
    expect(d.victoryProject()).toMatchObject({ ticksLeft: 2400, paused: true });
  });

  test("defending doesn't pause it", async () => {
    const { game, a, b } = await twoPlayers();
    const host = buildLevel(game, a, UnitType.AdminOffice, 5, 50, 3);
    const d = a.domestic()!;
    d.beginVictoryProject("political", host.id(), 2400);
    b.setTroops(100_000);
    game.addExecution(new AttackExecution(50_000, b, a.id(), null));
    executeTicks(game, 3);
    expect(a.incomingAttacks().length).toBeGreaterThan(0);
    expect(a.outgoingAttacks()).toHaveLength(0);
    expect(host.owner()).toBe(a);

    second(game, a);
    expect(d.victoryProject()).toMatchObject({
      ticksLeft: 2390,
      paused: false,
    });
  });

  test("the space program keeps going while attacking", async () => {
    const { game, a, b } = await twoPlayers();
    const host = buildLevel(game, a, UnitType.ResearchInstitute, 5, 50, 3);
    const d = a.domestic()!;
    d.beginVictoryProject("science", host.id(), 2400);
    a.setTroops(100_000);
    game.addExecution(new AttackExecution(50_000, a, b.id(), null));
    executeTicks(game, 3);
    expect(a.outgoingAttacks().length).toBeGreaterThan(0);

    second(game, a);
    expect(d.victoryProject()).toMatchObject({
      ticksLeft: 2390,
      paused: false,
    });
  });

  test("DomesticExecution runs it and it survives a snapshot", async () => {
    const { game, a } = await twoPlayers();
    const host = buildLevel(game, a, UnitType.ResearchInstitute, 5, 50, 3);
    a.domestic()!.beginVictoryProject("science", host.id(), 2400);
    game.addExecution(new DomesticExecution());
    executeTicks(game, 1); // init
    executeTicks(game, 20);
    expect(a.domestic()!.victoryProject()?.ticksLeft).toBe(2380);

    const restored = await expectSnapshotRoundTrip(game, "plains", 30);
    expect(restored.player(HUMAN.id).domestic()!.victoryProject()?.kind).toBe(
      "science",
    );
  });

  test("the project rides the player update", async () => {
    const { a } = await twoPlayers();
    const d = a.domestic()!;
    expect(d.toData().project).toBeUndefined();
    d.beginVictoryProject("science", 42, 2400);
    expect(d.toData().project).toEqual({
      kind: "science",
      hostUnitId: 42,
      ticksLeft: 2400,
      totalTicks: 2400,
      paused: false,
    });
    d.clearVictoryProject();
    expect(d.toData().project).toBeUndefined();
  });
});
