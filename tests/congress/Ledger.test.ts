import {
  aggressionExempt,
  isAggressing,
} from "@openfront/engine/congress/Ledger";
import {
  aggressionPct,
  pairPct,
  victimPct,
} from "@openfront/engine/congress/Metrics";
import { Game, Player } from "@openfront/engine/game/Game";
import {
  BLUE,
  botInfo,
  congressGame,
  congressOf,
  enact,
  GREEN,
  own,
  RED,
  runTicks,
} from "./util";

// plains: 10,000 land tiles. red holds x 0-29, blue x 30-59 (they border),
// green x 60-89, a bot x 90-99.
async function sides(): Promise<{
  game: Game;
  red: Player;
  blue: Player;
  green: Player;
  bot: Player;
}> {
  const game = await congressGame({}, [RED, BLUE, GREEN, botInfo("bot")]);
  const red = own(game, RED.id, 0, 0, 30, 100);
  const blue = own(game, BLUE.id, 30, 0, 30, 100);
  const green = own(game, GREEN.id, 60, 0, 30, 100);
  const bot = own(game, "bot_id", 90, 0, 10, 100);
  game.executeNextTick();
  return { game, red, blue, green, bot };
}

/** `taker` takes column x, rows 0..n-1. */
function take(game: Game, taker: Player, x: number, n: number): void {
  for (let y = 0; y < n; y++) taker.conquer(game.ref(x, y));
}

describe("the aggression ledger", () => {
  test("taking a nation's land is aggression for whoever strikes first", async () => {
    const { game, red, blue } = await sides();
    take(game, red, 30, 50);
    const now = game.ticks();
    expect(red.congress()!.takenTiles(now)).toBe(50);
    expect(aggressionPct(game, red)).toBeCloseTo(0.5);
    expect(blue.congress()!.lostTiles(now)).toBe(50);
    expect(victimPct(game, blue)).toBeCloseTo((50 * 100) / 3000);
    expect(blue.congress()!.lastHitTick(red.smallID())).toBe(now);
    const pair = congressOf(game).pair(red.smallID(), blue.smallID())!;
    expect(pair.initiator).toBe(red.smallID());
    expect(pairPct(game, pair)).toBeCloseTo(0.5);
  });

  test("the victim's counter-attack is self-defense; the aggressor stays the aggressor", async () => {
    const { game, red, blue } = await sides();
    take(game, red, 30, 50);
    take(game, blue, 29, 30);
    const now = game.ticks();
    expect(blue.congress()!.takenTiles(now)).toBe(0);
    expect(red.congress()!.lostTiles(now)).toBe(30);
    take(game, red, 31, 10);
    expect(red.congress()!.takenTiles(now)).toBe(60);
  });

  test("bots, unclaimed land and disconnected humans are not in the ledger", async () => {
    const { game, red, blue, green, bot } = await sides();
    take(game, green, 90, 20);
    expect(green.congress()!.takenTiles(game.ticks())).toBe(0);
    expect(
      congressOf(game).pair(green.smallID(), bot.smallID()),
    ).toBeUndefined();
    blue.markDisconnected(true);
    take(game, red, 30, 20);
    expect(red.congress()!.takenTiles(game.ticks())).toBe(0);
    expect(
      congressOf(game).pair(red.smallID(), blue.smallID()),
    ).toBeUndefined();
  });

  test("taking back your own tile records nothing", async () => {
    const { game, red } = await sides();
    take(game, red, 0, 10);
    expect(red.congress()!.takenTiles(game.ticks())).toBe(0);
    expect(red.congress()!.lostTiles(game.ticks())).toBe(0);
    expect(congressOf(game).pairs()).toHaveLength(0);
  });

  test("the window forgets after 180 s, and after 180 s of quiet the next strike starts a new conflict", async () => {
    const { game, red, blue } = await sides();
    take(game, red, 30, 10);
    runTicks(game, 1810);
    expect(aggressionPct(game, red)).toBe(0);
    take(game, blue, 29, 5);
    expect(
      congressOf(game).pair(red.smallID(), blue.smallID())!.initiator,
    ).toBe(blue.smallID());
    expect(blue.congress()!.takenTiles(game.ticks())).toBe(5);
  });

  test("an emergency member taking the target's land, and anyone taking a condemned owner's, is not aggression", async () => {
    const { game, red, blue, green } = await sides();
    const c = congressOf(game);
    c.setEmergency({
      kind: "aggression",
      target: blue.smallID(),
      startTick: game.ticks(),
      endTick: game.ticks() + 1500,
      goalKind: "land",
      goal: 450,
      progress: 0,
      members: [red.smallID()],
      opposed: [],
      contributions: new Map(),
      goalSilos: [],
      countedSilos: [],
    });
    expect(aggressionExempt(game, c, red, blue)).toBe(true);
    take(game, red, 30, 10);
    expect(red.congress()!.takenTiles(game.ticks())).toBe(0);
    expect(blue.congress()!.lostTiles(game.ticks())).toBe(10);
    c.setEmergency(null);
    enact(game, {
      resolution: "world_heritage",
      option: "B",
      targets: [green.smallID()],
      param: "1",
    });
    expect(aggressionExempt(game, c, blue, green)).toBe(true);
    take(game, blue, 60, 10);
    expect(blue.congress()!.takenTiles(game.ticks())).toBe(0);
  });

  test("attacking a nation first is aggressing; answering its first strike, hitting a bot or retreating isn't", async () => {
    const { game, red, blue, green, bot } = await sides();
    expect(isAggressing(game, red)).toBe(false);
    const attack = red.createAttack(blue, 100, null, new Set());
    expect(isAggressing(game, red)).toBe(true);
    attack.orderRetreat();
    expect(isAggressing(game, red)).toBe(false);
    green.createAttack(bot, 100, null, new Set());
    expect(isAggressing(game, green)).toBe(false);
    // Blue strikes first; red's attack on blue is then defense.
    take(game, blue, 29, 5);
    red.createAttack(blue, 100, null, new Set());
    expect(isAggressing(game, red)).toBe(false);
    blue.createAttack(red, 100, null, new Set());
    expect(isAggressing(game, blue)).toBe(true);
  });
});
