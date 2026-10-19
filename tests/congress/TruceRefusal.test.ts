import { MessageType, UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  DisplayMessageUpdate,
  GameUpdateType,
} from "@openfront/engine-api/game/GameUpdates";
import { AttackExecution } from "@openfront/engine/execution/AttackExecution";
import { Executor } from "@openfront/engine/execution/ExecutionManager";
import { TransportShipExecution } from "@openfront/engine/execution/TransportShipExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { GameRunner } from "@openfront/engine/GameRunner";
import { ParadropExecution } from "@openfront/engine/warfare/ParadropExecution";
import { grantTechs } from "../domestic/util";
import { BLUE, congressGame, enact, NATION, own, RED, runTicks } from "./util";

const TRUCE_LINE = "events_display.congress_truce_blocked";

function truce(game: Game, a: Player, b: Player): void {
  enact(game, {
    resolution: "truce",
    targets: [a.smallID(), b.smallID()],
    expires: game.ticks() + 1200,
  });
}

/** Every message of the next `ticks` ticks. */
function messagesOver(game: Game, ticks: number): DisplayMessageUpdate[] {
  const out: DisplayMessageUpdate[] = [];
  for (let i = 0; i < ticks; i++) {
    out.push(...game.executeNextTick()[GameUpdateType.DisplayEvent]);
  }
  return out;
}

const truceLines = (messages: DisplayMessageUpdate[]) =>
  messages.filter((m) => m.message === TRUCE_LINE);

// red x 0-29, blue x 30-59, the nation x 60-89 (all bordering in a row).
async function three() {
  const game = await congressGame({}, [RED, BLUE, NATION]);
  const red = own(game, RED.id, 0, 0, 30, 100);
  const blue = own(game, BLUE.id, 30, 0, 30, 100);
  const nation = own(game, NATION.id, 60, 0, 30, 100);
  game.executeNextTick();
  for (const p of [red, blue, nation]) p.setTroops(10_000);
  return { game, red, blue, nation };
}

describe("an attack a truce refuses says why (spec §8.1)", () => {
  test("a human's land attack: one line to the attacker, naming the partner", async () => {
    const { game, red, blue } = await three();
    truce(game, red, blue);
    game.addExecution(new AttackExecution(1000, red, blue.id(), null));
    const lines = truceLines(messagesOver(game, 3));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      messageType: MessageType.ATTACK_FAILED,
      playerID: red.smallID(),
      focusPlayerID: blue.smallID(),
      params: { name: blue.displayName() },
    });
    expect(red.outgoingAttacks()).toHaveLength(0);
  });

  test("a nation's refused attack, or an attack without a truce, says nothing", async () => {
    const { game, red, blue, nation } = await three();
    truce(game, nation, blue);
    game.addExecution(new AttackExecution(1000, nation, blue.id(), null));
    game.addExecution(new AttackExecution(1000, red, blue.id(), null));
    expect(truceLines(messagesOver(game, 3))).toEqual([]);
    expect(nation.outgoingAttacks()).toHaveLength(0);
    expect(red.outgoingAttacks()).toHaveLength(1);
  });

  test("a landing's own attack leaves the line to its boat or plane", async () => {
    const { game, red, blue } = await three();
    truce(game, red, blue);
    game.addExecution(
      new AttackExecution(1000, red, blue.id(), game.ref(30, 5), false),
    );
    expect(truceLines(messagesOver(game, 3))).toEqual([]);
  });

  test("a boat sent at a truce partner: one line", async () => {
    // half_land_half_ocean: land x 0-7, sea x 8-15.
    const game = await congressGame({}, [RED, BLUE], "half_land_half_ocean");
    const red = own(game, RED.id, 0, 0, 8, 4);
    const blue = own(game, BLUE.id, 0, 12, 8, 4);
    game.executeNextTick();
    red.setTroops(10_000);
    truce(game, red, blue);
    game.addExecution(new TransportShipExecution(red, game.ref(7, 13), 1000));
    const lines = truceLines(messagesOver(game, 5));
    expect(lines).toHaveLength(1);
    expect(lines[0].playerID).toBe(red.smallID());
    expect(red.units(UnitType.TransportShip)).toHaveLength(0);
  });

  test("a paradrop at a truce partner: the truce line, not 'no airport'", async () => {
    const game = await congressGame(
      { warfareExpansion: true, instantBuild: true },
      [RED, BLUE],
    );
    const red = own(game, RED.id, 0, 0, 30, 100);
    const blue = own(game, BLUE.id, 60, 0, 40, 100);
    game.executeNextTick();
    grantTechs(red, "industrialization");
    red.addGold(10_000_000n);
    red.addTroops(100_000);
    red.buildUnit(UnitType.Airport, game.ref(10, 10), {});
    truce(game, red, blue);
    const troops = red.troops();
    game.addExecution(new ParadropExecution(red, 30_000, game.ref(70, 10)));
    const messages = messagesOver(game, 5);
    expect(truceLines(messages)).toHaveLength(1);
    expect(
      messages.some((m) => m.message === "events_display.no_airport_available"),
    ).toBe(false);
    expect(red.units(UnitType.TransportPlane)).toHaveLength(0);
    expect(red.troops()).toBe(troops);
  });

  test("the worker tells the client a tap on that land meets a truce", async () => {
    const { game, red, blue, nation } = await three();
    const runner = new GameRunner(
      game,
      new Executor(game, "game_id", undefined),
      () => {},
    );
    const at = (p: Player) =>
      runner.playerActions(red.id(), p === blue ? 35 : 65, 5, null);
    expect(at(blue).canAttack).toBe(true);
    expect(at(blue).interaction?.truce).toBeUndefined();
    truce(game, red, blue);
    runTicks(game, 1);
    expect(at(blue).canAttack).toBe(false);
    expect(at(blue).interaction?.truce).toBe(true);
    expect(at(nation).interaction?.truce).toBeUndefined();
  });
});
