import { PlayerInfo, PlayerType } from "@openfront/engine-api/game/GameTypes";
import { PlayerDomestic } from "@openfront/engine/domestic/PlayerDomestic";
import { PlayerImpl } from "@openfront/engine/game/PlayerImpl";
import { setup } from "../util/Setup";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import { conquerSquare, domesticGame, grantTechs, HUMAN } from "./util";

describe("PlayerDomestic", () => {
  test("humans and nations get domestic state; bots don't", async () => {
    const game = await domesticGame();
    const nation = game.addPlayer(
      new PlayerInfo("nation", PlayerType.Nation, null, "nation_id"),
    );
    const bot = game.addPlayer(
      new PlayerInfo("bot", PlayerType.Bot, null, "bot_id"),
    );
    expect(game.player(HUMAN.id).domestic()).not.toBeNull();
    expect(nation.domestic()).not.toBeNull();
    expect(bot.domestic()).toBeNull();
  });

  test("no domestic state outside domestic mode", async () => {
    const game = await setup("plains", {}, [HUMAN]);
    expect(game.player(HUMAN.id).domestic()).toBeNull();
  });

  test("research completes after its ticks and grants its modifiers", () => {
    const d = new PlayerDomestic();
    d.beginResearch("computers", 25);
    expect(d.advanceResearch(10)).toBeNull();
    expect(d.currentResearch()?.ticksLeft).toBe(15);
    expect(d.advanceResearch(10)).toBeNull();
    expect(d.advanceResearch(10)).toBe("computers");
    expect(d.hasTech("computers")).toBe(true);
    expect(d.pct("science")).toBe(30);
    expect(d.currentResearch()).toBeNull();
  });

  test("toData is cached until something changes", () => {
    const d = new PlayerDomestic();
    const a = d.toData();
    expect(d.toData()).toBe(a);
    d.addYield(1500, 500);
    const b = d.toData();
    expect(b).not.toBe(a);
    expect(b.science).toBe(1);
    expect(b.political).toBe(0);
    expect(b.sciencePerSec).toBe(1.5);
    expect(b.cumulativeScience).toBe(1);
  });

  test("recruit target is clamped to 10..100", () => {
    const d = new PlayerDomestic();
    d.setRecruitTargetPct(5);
    expect(d.recruitTargetPct()).toBe(10);
    d.setRecruitTargetPct(250);
    expect(d.recruitTargetPct()).toBe(100);
  });

  test("spending more science than available throws", () => {
    const d = new PlayerDomestic();
    d.addYield(500, 0);
    expect(() => d.spendScienceMilli(501)).toThrow();
  });

  test("domestic state rides the player update and diffs by reference", async () => {
    const game = await domesticGame();
    const player = game.player(HUMAN.id) as PlayerImpl;
    const full = player.toUpdate()!;
    expect(full.domestic?.recruitTargetPct).toBe(100);
    expect(player.toUpdate()).toBeNull();
    player.domestic()!.setRecruitTargetPct(50);
    expect(player.toUpdate()?.domestic?.recruitTargetPct).toBe(50);
  });

  test("snapshot round trip keeps techs, research and points", async () => {
    const game = await domesticGame();
    const player = game.player(HUMAN.id);
    conquerSquare(game, player, 0, 0, 10);
    const d = player.domestic()!;
    d.addYield(123_456, 7_890);
    grantTechs(player, "currency", "academia");
    d.beginResearch("railroad", 300);
    d.setRecruitTargetPct(60);

    const restored = await expectSnapshotRoundTrip(game, "plains", 5);
    const rd = restored.player(HUMAN.id).domestic()!;
    expect(rd.hasTech("academia")).toBe(true);
    expect(rd.currentResearch()?.tech).toBe("railroad");
    expect(rd.recruitTargetPct()).toBe(60);
    expect(rd.scienceMilliAvailable()).toBe(123_456);
  });
});
