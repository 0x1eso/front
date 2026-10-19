import { accrueInfluence } from "@openfront/engine/congress/Influence";
import { DomesticExecution } from "@openfront/engine/domestic/DomesticExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { grantGovernment } from "../domestic/util";
import {
  BLUE,
  congressGame,
  congressOf,
  enact,
  giveInfluence,
  GREEN,
  own,
  RED,
  runTicks,
} from "./util";

async function three(): Promise<{
  game: Game;
  red: Player;
  blue: Player;
  green: Player;
}> {
  const game = await congressGame({}, [RED, BLUE, GREEN]);
  const red = own(game, RED.id, 0, 0, 30, 100);
  const blue = own(game, BLUE.id, 30, 0, 30, 100);
  const green = own(game, GREEN.id, 60, 0, 30, 100);
  game.executeNextTick();
  return { game, red, blue, green };
}

describe("influence", () => {
  test("a peaceful nation earns 0.1 + 5% of its political output + 0.05 per ally a second", async () => {
    const { game, red, blue } = await three();
    red.domestic()!.addYield(0, 2000); // 2 political power last second
    red.createAllianceRequest(blue)?.accept();
    accrueInfluence(game, congressOf(game));
    expect(red.congress()!.influenceMilli()).toBe(100 + 100 + 50);
    expect(red.congress()!.toData()).toMatchObject({
      influencePerSec: 0.25,
      status: "peaceful",
    });
  });

  test("each government tier adds 0.05", async () => {
    const { game, red } = await three();
    const d = red.domestic()!;
    d.addYield(0, 800_000);
    d.refreshGovernmentTier();
    d.addYield(0, 0); // last second's output back to 0
    expect(d.governmentTier()).toBe(1);
    accrueInfluence(game, congressOf(game));
    expect(red.congress()!.influenceMilli()).toBe(150);
  });

  test("sanctioned nations, the emergency target and aggressors earn nothing", async () => {
    const { game, red, blue, green } = await three();
    const c = congressOf(game);
    enact(game, { resolution: "sanction", targets: [red.smallID()] });
    c.setEmergency({
      kind: "aggression",
      target: blue.smallID(),
      startTick: game.ticks(),
      endTick: game.ticks() + 1500,
      goalKind: "land",
      goal: 450,
      progress: 0,
      members: [],
      opposed: [],
      contributions: new Map(),
      goalSilos: [],
      countedSilos: [],
    });
    green.createAttack(blue, 100, null, new Set());
    accrueInfluence(game, c);
    expect(red.congress()!.toData()).toMatchObject({
      influence: 0,
      status: "sanctioned",
    });
    expect(blue.congress()!.status()).toBe("target");
    expect(green.congress()!.status()).toBe("aggressing");
    expect(green.congress()!.influenceMilli()).toBe(0);
  });

  test("accrual stops at 300; refunds and rewards may pass it", async () => {
    const { game, red } = await three();
    const c = congressOf(game);
    red.congress()!.grant(299_950);
    accrueInfluence(game, c);
    expect(red.congress()!.influenceMilli()).toBe(300_000);
    expect(red.congress()!.status()).toBe("peaceful");
    accrueInfluence(game, c);
    expect(red.congress()!.influenceMilli()).toBe(300_000);
    expect(red.congress()!.status()).toBe("capped");
    giveInfluence(red, 10);
    expect(red.congress()!.influenceMilli()).toBe(310_000);
  });

  test("government resolutions: support ×1.25, condemnation ×0", async () => {
    const { game, red, blue } = await three();
    const c = congressOf(game);
    grantGovernment(red, "monarchy");
    grantGovernment(blue, "republic");
    enact(game, { resolution: "government_resolution", param: "monarchy" });
    accrueInfluence(game, c);
    expect(red.congress()!.influenceMilli()).toBe(125);
    expect(blue.congress()!.influenceMilli()).toBe(100);
    enact(game, {
      resolution: "government_resolution",
      option: "B",
      param: "republic",
    });
    accrueInfluence(game, c);
    expect(blue.congress()!.influenceMilli()).toBe(100);
  });

  test("the clock pays once a second, with 5% of the political output", async () => {
    const { game, red } = await three();
    game.addExecution(new DomesticExecution());
    runTicks(game, 21);
    // Two congress seconds; the second one sees a domestic second's output.
    expect(red.congress()!.influenceMilli()).toBeGreaterThanOrEqual(2 * 100);
    expect(red.congress()!.toData().influencePerSec).toBeGreaterThan(0.1);
  });
});
