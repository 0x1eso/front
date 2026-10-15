import { VictoryProjectKind } from "@openfront/engine-api/domestic/DomesticTypes";
import {
  MessageType,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { IntentSchema } from "@openfront/engine-api/Schemas";
import { VictoryProjectExecution } from "@openfront/engine/domestic/VictoryProjectExecution";
import { processVictoryProjectSecond } from "@openfront/engine/domestic/VictoryProjects";
import { Game, Player } from "@openfront/engine/game/Game";
import { vi } from "vitest";
import { setup } from "../util/Setup";
import { executeTicks } from "../util/utils";
import {
  buildLevel,
  conquerRect,
  domesticGame,
  grantTechs,
  HUMAN,
  reachGovernmentTier3,
} from "./util";

const RIVAL = new PlayerInfo("rival", PlayerType.Human, null, "rival_id");

async function twoPlayers(): Promise<{ game: Game; a: Player; b: Player }> {
  const game = await domesticGame({}, [HUMAN, RIVAL]);
  const a = game.player(HUMAN.id);
  const b = game.player(RIVAL.id);
  conquerRect(game, a, 0, 0, 50, 100);
  conquerRect(game, b, 50, 0, 50, 100);
  return { game, a, b };
}

function start(
  game: Game,
  player: Player,
  kind: VictoryProjectKind,
  unitId: number,
): void {
  game.addExecution(new VictoryProjectExecution(player, kind, unitId));
  executeTicks(game, 1);
}

describe("start_victory_project", () => {
  test("the space program costs 5M gold and is announced to everyone", async () => {
    const { game, a } = await twoPlayers();
    const host = buildLevel(game, a, UnitType.ResearchInstitute, 5, 50, 3);
    grantTechs(a, "space_program");
    a.addGold(5_000_001n);
    const spy = vi.spyOn(game, "displayMessage");

    start(game, a, "science", host.id());

    expect(a.domestic()!.victoryProject()).toEqual({
      kind: "science",
      hostUnitId: host.id(),
      ticksLeft: 2400,
      totalTicks: 2400,
      paused: false,
    });
    expect(a.gold()).toBe(1n);
    expect(spy).toHaveBeenCalledWith(
      "events_display.victory_project_started",
      MessageType.VICTORY_PROJECT,
      null,
      undefined,
      { name: a.displayName(), project: "science" },
      host.id(),
      a.id(),
    );
  });

  test("world government costs 3M gold and 1,000 political power, never cumulative", async () => {
    const { game, a } = await twoPlayers();
    const host = buildLevel(game, a, UnitType.AdminOffice, 5, 50, 3);
    reachGovernmentTier3(a);
    a.addGold(3_000_000n);

    start(game, a, "political", host.id());

    const d = a.domestic()!;
    expect(d.victoryProject()?.kind).toBe("political");
    expect(a.gold()).toBe(0n);
    expect(d.politicalMilliAvailable()).toBe(2_500_000);
    expect(d.cumulativePoliticalMilli()).toBe(3_500_000);
  });

  test("refuses without the requirement, its own level 3 host or the gold", async () => {
    const { game, a, b } = await twoPlayers();
    const lv2 = buildLevel(game, a, UnitType.ResearchInstitute, 5, 20, 2);
    const lv3 = buildLevel(game, a, UnitType.ResearchInstitute, 5, 50, 3);
    const office = buildLevel(game, a, UnitType.AdminOffice, 5, 80, 3);
    const rivals = buildLevel(game, b, UnitType.ResearchInstitute, 80, 50, 3);
    a.addGold(5_000_000n);
    const refused = (
      kind: VictoryProjectKind,
      unitId: number,
      gold: bigint,
    ) => {
      start(game, a, kind, unitId);
      expect(a.domestic()!.victoryProject()).toBeNull();
      expect(a.gold()).toBe(gold);
    };

    refused("science", lv3.id(), 5_000_000n); // no space program yet
    grantTechs(a, "space_program");
    refused("science", lv2.id(), 5_000_000n); // level 2
    refused("science", office.id(), 5_000_000n); // wrong kind of building
    refused("science", rivals.id(), 5_000_000n); // someone else's
    refused("science", 999_999, 5_000_000n); // no such unit
    refused("political", office.id(), 5_000_000n); // not at tier 3
    a.removeGold(1n);
    refused("science", lv3.id(), 4_999_999n); // 1 gold short
  });

  test("one project at a time", async () => {
    const { game, a } = await twoPlayers();
    const lab = buildLevel(game, a, UnitType.ResearchInstitute, 5, 20, 3);
    const office = buildLevel(game, a, UnitType.AdminOffice, 5, 80, 3);
    grantTechs(a, "space_program");
    reachGovernmentTier3(a);
    a.addGold(8_000_000n);
    start(game, a, "science", lab.id());
    start(game, a, "political", office.id());
    expect(a.domestic()!.victoryProject()?.kind).toBe("science");
    expect(a.gold()).toBe(3_000_000n);
  });

  test("a failed project keeps its cost; restarting elsewhere pays again", async () => {
    const { game, a, b } = await twoPlayers();
    const first = buildLevel(game, a, UnitType.ResearchInstitute, 5, 20, 3);
    const second = buildLevel(game, a, UnitType.ResearchInstitute, 5, 80, 3);
    grantTechs(a, "space_program");
    a.addGold(10_000_000n);
    start(game, a, "science", first.id());

    b.captureUnit(first);
    processVictoryProjectSecond(game, a, a.domestic()!);
    expect(a.domestic()!.victoryProject()).toBeNull();
    expect(a.gold()).toBe(5_000_000n);

    start(game, a, "science", second.id());
    expect(a.domestic()!.victoryProject()?.hostUnitId).toBe(second.id());
    expect(a.gold()).toBe(0n);
  });

  test("does nothing outside domestic mode", async () => {
    const game = await setup("plains", {}, [HUMAN]);
    const a = game.player(HUMAN.id);
    a.addGold(10_000_000n);
    start(game, a, "science", 1);
    expect(a.domestic()).toBeNull();
    expect(a.gold()).toBe(10_000_000n);
  });

  test("intents validate", () => {
    expect(
      IntentSchema.safeParse({
        type: "start_victory_project",
        kind: "science",
        unitId: 12,
      }).success,
    ).toBe(true);
    expect(
      IntentSchema.safeParse({
        type: "start_victory_project",
        kind: "magic",
        unitId: 12,
      }).success,
    ).toBe(false);
    expect(
      IntentSchema.safeParse({
        type: "start_victory_project",
        kind: "political",
        unitId: -1,
      }).success,
    ).toBe(false);
  });
});
