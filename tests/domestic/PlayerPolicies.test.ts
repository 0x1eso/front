import {
  Condition,
  LawId,
  LawOption,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { LAW_COOLDOWN_TICKS } from "@openfront/engine-lib/domestic/Balance";
import { domesticModifiers } from "@openfront/engine-lib/domestic/Policies";
import { PlayerDomestic } from "@openfront/engine/domestic/PlayerDomestic";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import {
  conquerSquare,
  domesticGame,
  grantGovernment,
  grantLaws,
  HUMAN,
} from "./util";

function when(...conditions: Condition[]): ReadonlySet<Condition> {
  return new Set(conditions);
}

describe("domesticModifiers", () => {
  test("techs, laws and the government add up per stat and condition", () => {
    const totals = domesticModifiers(
      ["computers"], // science +30, political +15
      new Map<LawId, LawOption>([["opinion", "B"]]), // science +20
      "democracy", // science +30; political +30 in peace, -50 while attacking
    );
    expect(totals.pct("science")).toBe(80);
    expect(totals.pct("political")).toBe(15);
    expect(totals.pct("political", when("notAttacking"))).toBe(45);
    expect(totals.pct("political", when("attacking"))).toBe(-35);
  });
});

describe("PlayerDomestic laws and government", () => {
  test("a proclaimed law applies its modifiers and starts the cooldown", () => {
    const d = new PlayerDomestic();
    d.proclaimLaw("trade", "A", 100);
    expect(d.proclaimedLaws().get("trade")).toBe("A");
    expect(d.pct("trade")).toBe(40);
    expect(d.lawCooldownUntilTick()).toBe(100 + LAW_COOLDOWN_TICKS);
  });

  test("conditional modifiers follow the active conditions", () => {
    const d = new PlayerDomestic();
    d.chooseGovernment("democracy", 0);
    expect(d.pct("political")).toBe(0);
    d.setConditions(when("notAttacking"));
    expect(d.pct("political")).toBe(30);
    d.setConditions(when("attacking"));
    expect(d.pct("political")).toBe(-50);
  });

  test("setting the same conditions keeps the cached data", () => {
    const d = new PlayerDomestic();
    d.setConditions(when("notAttacking"));
    const a = d.toData();
    d.setConditions(when("notAttacking"));
    expect(d.toData()).toBe(a);
    d.setConditions(when("attacking"));
    expect(d.toData()).not.toBe(a);
    expect(d.toData().conditions).toEqual(["attacking"]);
  });

  test("the tier rises with cumulative political power, once per tier", () => {
    const d = new PlayerDomestic();
    d.addYield(0, 299_999);
    expect(d.refreshGovernmentTier()).toBeNull();
    d.addYield(0, 1);
    expect(d.refreshGovernmentTier()).toBe(1);
    expect(d.refreshGovernmentTier()).toBeNull();
    d.spendPoliticalMilli(300_000);
    d.addYield(0, 3_200_000);
    expect(d.refreshGovernmentTier()).toBe(3);
    expect(d.governmentTier()).toBe(3);
    expect(d.cumulativePoliticalMilli()).toBe(3_500_000);
  });

  test("a new government replaces the old one's effects", () => {
    const d = new PlayerDomestic();
    d.chooseGovernment("monarchy", 0);
    expect(d.pct("maxTroops")).toBe(20);
    expect(d.hasFlag("feudal")).toBe(true);
    d.chooseGovernment("communism", 0);
    expect(d.pct("maxTroops")).toBe(0);
    expect(d.hasFlag("feudal")).toBe(false);
    expect(d.hasFlag("noProductionUpkeep")).toBe(true);
  });

  test("toData carries laws, cooldown, tier, government and conditions", () => {
    const d = new PlayerDomestic();
    d.addYield(0, 300_000);
    d.refreshGovernmentTier();
    d.proclaimLaw("religion", "A", 10);
    d.chooseGovernment("theocracy", 20);
    d.setConditions(when("notAttacking", "troopsAtMostHalf"));
    expect(d.toData()).toMatchObject({
      laws: { religion: "A" },
      lawCooldownUntilTick: 20 + LAW_COOLDOWN_TICKS,
      governmentTier: 1,
      government: "theocracy",
      conditions: ["notAttacking", "troopsAtMostHalf"],
    });
  });

  test("spending more political power than available throws", () => {
    const d = new PlayerDomestic();
    d.addYield(0, 500);
    expect(() => d.spendPoliticalMilli(501)).toThrow();
  });

  test("a snapshot written before laws existed restores with defaults", () => {
    const d = PlayerDomestic.restore({
      scienceMilli: 1000,
      politicalMilli: 2000,
      cumScienceMilli: 1000,
      cumPoliticalMilli: 2000,
      lastScienceMilli: 0,
      lastPoliticalMilli: 0,
      techs: ["currency"],
      research: null,
      recruitTargetPct: 100,
    });
    expect(d.proclaimedLaws().size).toBe(0);
    expect(d.currentGovernment()).toBe("chiefdom");
    expect(d.governmentTier()).toBe(0);
    expect(d.lawCooldownUntilTick()).toBe(0);
    expect(d.activeConditions().size).toBe(0);
    expect(d.hasTech("currency")).toBe(true);
  });

  test("snapshot round trip keeps laws, government, cooldown and conditions", async () => {
    const game = await domesticGame();
    const player = game.player(HUMAN.id);
    conquerSquare(game, player, 0, 0, 10);
    const d = player.domestic()!;
    d.addYield(0, 400_000);
    d.refreshGovernmentTier();
    d.proclaimLaw("religion", "A", game.ticks());
    d.chooseGovernment("theocracy", game.ticks());
    d.setConditions(when("attacking", "troopsAtMostHalf"));

    const restored = await expectSnapshotRoundTrip(game, "plains", 5);
    const rd = restored.player(HUMAN.id).domestic()!;
    expect(rd.proclaimedLaws().get("religion")).toBe("A");
    expect(rd.currentGovernment()).toBe("theocracy");
    expect(rd.governmentTier()).toBe(1);
    expect(rd.lawCooldownUntilTick()).toBe(d.lawCooldownUntilTick());
    expect([...rd.activeConditions()]).toEqual([
      "attacking",
      "troopsAtMostHalf",
    ]);
    expect(rd.pct("political")).toBe(45);
  });

  test("grantLaws and grantGovernment leave the law cooldown open", async () => {
    const game = await domesticGame();
    const player = game.player(HUMAN.id);
    grantLaws(player, { trade: "A", religion: "A" });
    grantGovernment(player, "theocracy");
    const d = player.domestic()!;
    expect([...d.proclaimedLaws()]).toEqual([
      ["trade", "A"],
      ["religion", "A"],
    ]);
    expect(d.currentGovernment()).toBe("theocracy");
    expect(d.lawCooldownUntilTick()).toBe(0);
    expect(d.pct("political")).toBe(45);
  });
});
