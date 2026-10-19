import {
  Difficulty,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { EmergencyState } from "@openfront/engine/congress/Congress";
import { AttackExecution } from "@openfront/engine/execution/AttackExecution";
import { NationAllianceBehavior } from "@openfront/engine/execution/nation/NationAllianceBehavior";
import {
  congressHoldsFire,
  congressSparesTarget,
  emergencyTargetFor,
  joinableEmergencyTarget,
} from "@openfront/engine/execution/nation/NationCongressBehavior";
import { nationDomesticTick } from "@openfront/engine/execution/nation/NationDomesticBehavior";
import { NationEmojiBehavior } from "@openfront/engine/execution/nation/NationEmojiBehavior";
import {
  nationDomesticPlan,
  Personality,
} from "@openfront/engine/execution/nation/NationPersonality";
import { AiAttackBehavior } from "@openfront/engine/execution/utils/AiAttackBehavior";
import { Game, Player } from "@openfront/engine/game/Game";
import { congressGame, congressOf, enact, runTicks } from "./util";

function idWith(p: Personality): string {
  for (let i = 0; i < 500; i++) {
    const id = `nat${i}`;
    if (nationDomesticPlan(id).personality === p) return id;
  }
  throw new Error(`no ${p}`);
}

/**
 * big_plains in three stripes, weak | attacker | rich, with no unowned land
 * (as tests/AiAttackBehavior.test.ts's juicy setup): Medium nations pick
 * the weakest, so `weak` is the target unless the congress says otherwise.
 * `weakType` makes `weak` a bot instead of a human.
 */
async function stripes(
  p: Personality,
  difficulty = Difficulty.Medium,
  weakType = PlayerType.Human,
) {
  const id = idWith(p);
  const game = await congressGame(
    { difficulty },
    [
      new PlayerInfo(id, PlayerType.Nation, null, id),
      new PlayerInfo("weak", weakType, null, "weak_id"),
      new PlayerInfo("rich", PlayerType.Human, null, "rich_id"),
    ],
    "big_plains",
  );
  const attacker = game.player(id);
  const weak = game.player("weak_id");
  const rich = game.player("rich_id");
  for (let x = 0; x < game.map().width(); x++) {
    for (let y = 0; y < game.map().height(); y++) {
      const tile = game.ref(x, y);
      if (!game.map().isLand(tile)) continue;
      if (x < 40) weak.conquer(tile);
      else if (x < 60) attacker.conquer(tile);
      else rich.conquer(tile);
    }
  }
  game.executeNextTick();
  attacker.setTroops(5_000_000);
  weak.setTroops(Math.floor(game.config().maxTroops(weak) * 0.5));
  rich.setTroops(Math.floor(game.config().maxTroops(rich) * 0.9));
  const emoji = new NationEmojiBehavior(new PseudoRandom(42), game, attacker);
  const behavior = new AiAttackBehavior(
    new PseudoRandom(42),
    game,
    attacker,
    0,
    0,
    0.2,
    new NationAllianceBehavior(new PseudoRandom(42), game, attacker, emoji),
    emoji,
  );
  return { game, attacker, weak, rich, behavior };
}

/** The names of the players the attacks it starts go at (null: free land). */
function targetsAfterAttack(
  game: Game,
  attacker: Player,
  behavior: AiAttackBehavior,
): (string | null)[] {
  const before = attacker.outgoingAttacks().length;
  behavior.maybeAttack();
  runTicks(game, 1);
  return attacker
    .outgoingAttacks()
    .slice(before)
    .map((a) => (a.target().isPlayer() ? (a.target() as Player).name() : null));
}

function emergencyOn(
  game: Game,
  target: Player,
  members: Player[],
  opposed: Player[] = [],
): void {
  const e: EmergencyState = {
    kind: "aggression",
    target: target.smallID(),
    startTick: game.ticks(),
    endTick: game.ticks() + 1500,
    goalKind: "land",
    goal: 300,
    progress: 0,
    members: members.map((m) => m.smallID()),
    opposed: opposed.map((m) => m.smallID()),
    contributions: new Map(),
    goalSilos: [],
    countedSilos: [],
  };
  congressOf(game).setEmergency(e);
}

describe("nations follow the congress (spec §11.4)", () => {
  test("control: a Medium nation attacks the weakest neighbour", async () => {
    const { game, attacker, weak, behavior } = await stripes("merchant");
    expect(congressSparesTarget(game, attacker, weak)).toBe(false);
    expect(congressHoldsFire(game, attacker)).toBe(false);
    expect(emergencyTargetFor(game, attacker)).toBeNull();
    expect(targetsAfterAttack(game, attacker, behavior)).toContain("weak");
  });

  test("a truce partner is never picked", async () => {
    const { game, attacker, weak, behavior } = await stripes("merchant");
    enact(game, {
      resolution: "truce",
      targets: [attacker.smallID(), weak.smallID()].sort((a, b) => a - b),
      expires: game.ticks() + 1200,
    });
    expect(congressSparesTarget(game, attacker, weak)).toBe(true);
    expect(targetsAfterAttack(game, attacker, behavior)).not.toContain("weak");
    // Not by any other path either (hated, island, assist...), forced or not.
    attacker.setTroops(5_000_000);
    expect(behavior.sendAttack(weak)).toBe(false);
    expect(behavior.sendAttack(weak, true)).toBe(false);
  });

  test("a truce partner's recalled attack is nothing to answer", async () => {
    const { game, attacker, weak, behavior } = await stripes("merchant");
    game.addExecution(
      new AttackExecution(weak.troops() / 2, weak, attacker.id()),
    );
    runTicks(game, 2);
    expect(behavior.findIncomingAttackPlayer()?.name()).toBe("weak");
    enact(game, {
      resolution: "truce",
      targets: [attacker.smallID(), weak.smallID()].sort((a, b) => a - b),
      expires: game.ticks() + 1200,
    });
    // Still on its way home this tick; nations don't strike back at it.
    expect(attacker.incomingAttacks().length).toBeGreaterThan(0);
    expect(behavior.findIncomingAttackPlayer()).toBeNull();
  });

  test("an emergency member hits the target first", async () => {
    const { game, attacker, rich, behavior } = await stripes("merchant");
    emergencyOn(game, rich, [attacker]);
    expect(emergencyTargetFor(game, attacker)?.name()).toBe("rich");
    expect(targetsAfterAttack(game, attacker, behavior)).toEqual(["rich"]);
    // A member that allies with the target stays a member, but leaves it be.
    attacker.createAllianceRequest(rich)?.accept();
    expect(attacker.isFriendly(rich)).toBe(true);
    expect(emergencyTargetFor(game, attacker)).toBeNull();
    expect(joinableEmergencyTarget(game, attacker)).toBeNull();
  });

  test("the emergency target starts nothing and recruits at 100%", async () => {
    const { game, attacker, rich, behavior } = await stripes("conqueror");
    emergencyOn(game, attacker, [rich]);
    expect(congressHoldsFire(game, attacker)).toBe(true);
    expect(targetsAfterAttack(game, attacker, behavior)).toEqual([]);
    nationDomesticTick(game, attacker);
    runTicks(game, 1);
    expect(attacker.domestic()!.recruitTargetPct()).toBe(100);
  });

  test("a war tax keeps a merchant's troops home, not a conqueror's", async () => {
    const merchant = await stripes("merchant");
    enact(merchant.game, { resolution: "war_tax" });
    expect(congressHoldsFire(merchant.game, merchant.attacker)).toBe(true);
    expect(
      targetsAfterAttack(merchant.game, merchant.attacker, merchant.behavior),
    ).toEqual([]);
    const conqueror = await stripes("conqueror");
    enact(conqueror.game, { resolution: "war_tax" });
    expect(congressHoldsFire(conqueror.game, conqueror.attacker)).toBe(false);
  });

  // Ruling F8: a war tax only bars humans and nations.
  test("under a war tax a merchant still takes on bots", async () => {
    const { game, attacker, behavior } = await stripes(
      "merchant",
      Difficulty.Medium,
      PlayerType.Bot,
    );
    enact(game, { resolution: "war_tax" });
    expect(congressHoldsFire(game, attacker)).toBe(true);
    const targets = targetsAfterAttack(game, attacker, behavior);
    expect(targets).toContain("weak");
    expect(targets).not.toContain("rich");
  });

  test("under a war tax a scholar still hits the emergency target, unless it voted against", async () => {
    const member = await stripes("scholar", Difficulty.Hard);
    enact(member.game, { resolution: "war_tax" });
    emergencyOn(member.game, member.rich, [member.attacker]);
    expect(
      targetsAfterAttack(member.game, member.attacker, member.behavior),
    ).toEqual(["rich"]);

    // Not a member yet: taking the target's land would make it one.
    const late = await stripes("scholar", Difficulty.Hard);
    enact(late.game, { resolution: "war_tax" });
    emergencyOn(late.game, late.rich, []);
    expect(emergencyTargetFor(late.game, late.attacker)).toBeNull();
    expect(joinableEmergencyTarget(late.game, late.attacker)?.name()).toBe(
      "rich",
    );
    expect(targetsAfterAttack(late.game, late.attacker, late.behavior)).toEqual(
      ["rich"],
    );

    const opposed = await stripes("scholar", Difficulty.Hard);
    enact(opposed.game, { resolution: "war_tax" });
    emergencyOn(opposed.game, opposed.rich, [], [opposed.attacker]);
    expect(joinableEmergencyTarget(opposed.game, opposed.attacker)).toBeNull();
    expect(
      targetsAfterAttack(opposed.game, opposed.attacker, opposed.behavior),
    ).toEqual([]);
  });

  test("a protectorate is attacked only with twice its troops", async () => {
    const { game, attacker, weak, behavior } = await stripes("merchant");
    enact(game, { resolution: "protectorate", targets: [weak.smallID()] });
    weak.setTroops(attacker.troops());
    expect(congressSparesTarget(game, attacker, weak)).toBe(true);
    expect(behavior.sendAttack(weak)).toBe(false);
    weak.setTroops(Math.floor(attacker.troops() / 2));
    expect(congressSparesTarget(game, attacker, weak)).toBe(false);
  });

  test("Hard nations single out a project only when the congress condemned it", async () => {
    const { game, attacker, weak, rich, behavior } = await stripes(
      "merchant",
      Difficulty.Hard,
    );
    // The juicy target is rich (tests/AiAttackBehavior.test.ts's setup).
    for (const tile of Array.from(rich.tiles()).slice(0, 3)) {
      const city = rich.buildUnit(UnitType.City, tile, {});
      city.increaseLevel();
      city.increaseLevel();
    }
    rich.setTroops(Math.floor(game.config().maxTroops(rich) * 0.3));
    weak.domestic()!.beginVictoryProject("science", 99, 2400);
    const first = targetsAfterAttack(game, attacker, behavior);
    expect(first.length).toBeGreaterThan(0);
    for (const t of first) expect(t).toBe("rich");
    enact(game, {
      resolution: "world_heritage",
      option: "B",
      targets: [weak.smallID()],
      param: "99",
    });
    // The first attack sent everything above Hard's neighbour reserve.
    attacker.setTroops(5_000_000);
    expect(targetsAfterAttack(game, attacker, behavior)).toContain("weak");
  });
});
