import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import type { ItemResult } from "@openfront/engine/congress/Congress";
import {
  applyAdoption,
  awaitsRatification,
  isProjectCondemned,
} from "@openfront/engine/congress/WorldGovernment";
import { DomesticExecution } from "@openfront/engine/domestic/DomesticExecution";
import { checkDomesticWin } from "@openfront/engine/domestic/DomesticWinCheck";
import { Game, Player, Unit } from "@openfront/engine/game/Game";
import { buildLevel, reachGovernmentTier3 } from "../domestic/util";
import { setup } from "../util/Setup";
import {
  BLUE,
  congressGame,
  congressOf,
  enact,
  own,
  RED,
  runTicks,
} from "./util";

async function proclamation() {
  const game = await congressGame({}, [RED, BLUE]);
  const red = own(game, RED.id, 0, 0, 30, 100);
  own(game, BLUE.id, 30, 0, 30, 100);
  game.executeNextTick();
  reachGovernmentTier3(red);
  const office = buildLevel(game, red, UnitType.AdminOffice, 15, 50, 3);
  const d = red.domestic()!;
  d.beginVictoryProject("political", office.id(), 2400);
  return { game, red, d, office, c: congressOf(game) };
}

function verdict(red: Player, office: Unit, adopted: "A" | "B"): ItemResult {
  return {
    sessionId: 1,
    kind: "regular",
    index: 2,
    item: {
      resolution: "world_government",
      targets: [red.smallID()],
      param: String(office.id()),
      reason: "project",
      reasonValue: 0,
      voters: 2,
    },
    a: adopted === "A" ? 2 : 1,
    b: adopted === "B" ? 2 : 1,
    adopted,
    aVoters: [],
    bVoters: [],
  };
}

function messagesOver(game: Game, ticks: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < ticks; i++) {
    for (const m of game.executeNextTick()[GameUpdateType.DisplayEvent]) {
      out.push(m.message);
    }
  }
  return out;
}

describe("world government approval (spec §10.1)", () => {
  test("approval moves the proclamation 60 s ahead and ratifies it; rejection moves it back", async () => {
    const { game, red, d, office, c } = await proclamation();
    applyAdoption(game, c, verdict(red, office, "A"));
    expect(d.victoryProject()!.ticksLeft).toBe(1800);
    expect(c.verdict(red.smallID())).toEqual({
      host: office.id(),
      ratified: true,
    });
    applyAdoption(game, c, verdict(red, office, "B"));
    applyAdoption(game, c, verdict(red, office, "B"));
    expect(d.victoryProject()!.ticksLeft).toBe(2400);
    expect(c.verdict(red.smallID())!.ratified).toBe(false);
  });

  test("a proclamation that completes unratified waits instead of winning", async () => {
    const { game, red, d } = await proclamation();
    d.shiftVictoryProject(-2400);
    expect(awaitsRatification(game, red)).toBe(true);
    expect(checkDomesticWin(game)).toBeNull();
  });

  test("approval of a waiting proclamation wins at the next win check", async () => {
    const { game, red, d, office, c } = await proclamation();
    d.shiftVictoryProject(-2400);
    applyAdoption(game, c, verdict(red, office, "A"));
    expect(awaitsRatification(game, red)).toBe(false);
    expect(checkDomesticWin(game)).toEqual({
      winner: red,
      reason: "political",
    });
  });

  test("rejection of a waiting proclamation sends it back to 75%", async () => {
    const { game, red, d, office, c } = await proclamation();
    d.shiftVictoryProject(-2400);
    applyAdoption(game, c, verdict(red, office, "B"));
    expect(d.victoryProject()!.ticksLeft).toBe(600);
  });

  test("losing the office while waiting fails the project", async () => {
    const { game, d, office } = await proclamation();
    d.shiftVictoryProject(-2400);
    game.addExecution(new DomesticExecution());
    office.delete(true);
    runTicks(game, 11);
    expect(d.victoryProject()).toBeNull();
  });

  test("the completion message says it awaits ratification", async () => {
    const { game, d } = await proclamation();
    d.shiftVictoryProject(-2390);
    game.addExecution(new DomesticExecution());
    const messages = messagesOver(game, 12);
    expect(messages).toContain("events_display.world_gov_awaiting");
    expect(messages).not.toContain("events_display.victory_project_complete");
    expect(d.victoryProject()!.ticksLeft).toBe(0);
  });

  test("a waiting proclamation is announced once, not every second", async () => {
    const { game, d } = await proclamation();
    d.shiftVictoryProject(-2390);
    game.addExecution(new DomesticExecution());
    const messages = messagesOver(game, 60);
    expect(
      messages.filter((m) => m === "events_display.world_gov_awaiting"),
    ).toHaveLength(1);
    expect(d.victoryProject()!.ticksLeft).toBe(0);
  });

  test("a ratified proclamation completes and wins as before", async () => {
    const { game, red, d, office, c } = await proclamation();
    applyAdoption(game, c, verdict(red, office, "A"));
    d.shiftVictoryProject(-1790);
    game.addExecution(new DomesticExecution());
    const messages = messagesOver(game, 12);
    expect(messages).toContain("events_display.victory_project_complete");
    expect(checkDomesticWin(game)).toEqual({
      winner: red,
      reason: "political",
    });
  });
});

describe("which projects nations may single out (spec §10.3)", () => {
  test("only condemned ones in a congress game; all of them without one", async () => {
    const { game, red, office, c } = await proclamation();
    expect(isProjectCondemned(game, red)).toBe(false);
    applyAdoption(game, c, verdict(red, office, "B"));
    expect(isProjectCondemned(game, red)).toBe(true);

    const blue = game.player(BLUE.id);
    blue.domestic()!.beginVictoryProject("science", 99, 2400);
    expect(isProjectCondemned(game, blue)).toBe(false);
    enact(game, {
      resolution: "world_heritage",
      option: "B",
      targets: [blue.smallID()],
      param: "99",
    });
    expect(isProjectCondemned(game, blue)).toBe(true);

    const plain = await setup("plains", { domesticMode: true }, [RED]);
    expect(isProjectCondemned(plain, plain.player(RED.id))).toBe(true);
  });
});
