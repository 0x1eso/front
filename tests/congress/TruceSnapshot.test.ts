import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { TransportShipExecution } from "@openfront/engine/execution/TransportShipExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { decodeSnapshotValue } from "@openfront/engine/snapshot/SnapshotCodec";
import { roundTrip } from "../util/Snapshot";
import { BLUE, congressGame, enact, own, RED, runTicks } from "./util";

const MAP = "half_land_half_ocean";

async function sail() {
  const game = await congressGame({}, [RED, BLUE], MAP);
  const red = own(game, RED.id, 0, 0, 8, 4);
  const blue = own(game, BLUE.id, 0, 12, 8, 4);
  game.executeNextTick();
  red.setTroops(10_000);
  game.addExecution(new TransportShipExecution(red, game.ref(7, 13), 1000));
  runTicks(game, 3);
  expect(red.troops()).toBe(9_000);
  return { game, red, blue };
}

function dock(game: Game, p: Player) {
  for (let i = 0; i < 400; i++) {
    if (p.units(UnitType.TransportShip).length === 0) break;
    game.executeNextTick();
  }
  expect(p.units(UnitType.TransportShip)).toHaveLength(0);
}

const hasKey = (bytes: Uint8Array) =>
  JSON.stringify(decodeSnapshotValue(bytes), (_k, v) =>
    typeof v === "bigint" ? v.toString() : v,
  ).includes("recalledByTruce");

describe("recalledByTruce survives a snapshot", () => {
  test("a boat a truce turned around lands home whole after a restore", async () => {
    const { game, red, blue } = await sail();
    enact(game, {
      resolution: "truce",
      targets: [red.smallID(), blue.smallID()],
      expires: game.ticks() + 1200,
    });
    runTicks(game, 1); // the boat turns around
    expect(red.units(UnitType.TransportShip)).toHaveLength(1);
    const { bytes, restored } = await roundTrip(game, MAP);
    expect(hasKey(bytes)).toBe(true);
    // The truce lapses on the restored side before the boat docks: the loss
    // must follow the recall, not the truce.
    restored.congress()!.expireResolutions(restored.ticks() + 5000);
    const r = restored.player(RED.id);
    expect(r.isTruceWith(restored.player(BLUE.id))).toBe(false);
    dock(restored, r);
    expect(r.troops()).toBe(10_000);
  });

  test("the key is absent while the flag is false", async () => {
    const { game } = await sail();
    const { bytes } = await roundTrip(game, MAP);
    expect(hasKey(bytes)).toBe(false);
  });
});
