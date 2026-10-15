import {
  Difficulty,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { AttackExecution } from "@openfront/engine/execution/AttackExecution";
import { NationAllianceBehavior } from "@openfront/engine/execution/nation/NationAllianceBehavior";
import { NationEmojiBehavior } from "@openfront/engine/execution/nation/NationEmojiBehavior";
import { NationNukeBehavior } from "@openfront/engine/execution/nation/NationNukeBehavior";
import { AiAttackBehavior } from "@openfront/engine/execution/utils/AiAttackBehavior";
import { Game, Player } from "@openfront/engine/game/Game";
import { vi } from "vitest";
import { setup } from "../util/Setup";
import { buildLevel, conquerRect, grantTechs } from "./util";

const RUNNER = new PlayerInfo("runner", PlayerType.Human, null, "runner_id");
const NATION = new PlayerInfo("nation", PlayerType.Nation, null, "nation_id");
const WEAK = new PlayerInfo("weak", PlayerType.Human, null, "weak_id");

/** Full-height stripes, left to right: runner | nation | weak. */
async function stripes(difficulty: Difficulty) {
  const game = await setup("plains", { difficulty, domesticMode: true }, [
    RUNNER,
    NATION,
    WEAK,
  ]);
  const [runner, nation, weak] = [RUNNER, NATION, WEAK].map((i) =>
    game.player(i.id),
  );
  conquerRect(game, runner, 0, 0, 30, 100);
  conquerRect(game, nation, 30, 0, 30, 100);
  conquerRect(game, weak, 60, 0, 40, 100);
  const emoji = new NationEmojiBehavior(new PseudoRandom(42), game, nation);
  const alliance = new NationAllianceBehavior(
    new PseudoRandom(42),
    game,
    nation,
    emoji,
  );
  const attack = new AiAttackBehavior(
    new PseudoRandom(42),
    game,
    nation,
    0.5, // triggerRatio
    0.3, // reserveRatio
    0.2, // expandRatio
    alliance,
    emoji,
  );
  return { game, runner, nation, weak, emoji, attack };
}

/** The nation well above its trigger ratio, the runner a bit weaker, weak very weak. */
function setTroops(game: Game, nation: Player, runner: Player, weak: Player) {
  nation.setTroops(Math.floor(game.config().maxTroops(nation) * 0.7));
  runner.setTroops(Math.floor(nation.troops() * 0.8));
  weak.setTroops(1000);
}

function startProject(game: Game, runner: Player) {
  const host = buildLevel(game, runner, UnitType.ResearchInstitute, 5, 50, 3);
  runner.domestic()!.beginVictoryProject("science", host.id(), 2400);
  return host;
}

function attacksOn(spy: { mock: { calls: unknown[][] } }, target: Player) {
  return spy.mock.calls
    .map((c) => c[0])
    .filter(
      (e): e is AttackExecution =>
        e instanceof AttackExecution && e.targetID() === target.id(),
    );
}

describe("nations counter victory projects", () => {
  test.each([Difficulty.Hard, Difficulty.Impossible])(
    "%s: attacks the project owner first",
    async (difficulty) => {
      const { game, runner, nation, weak, attack } = await stripes(difficulty);
      setTroops(game, nation, runner, weak);
      startProject(game, runner);

      const spy = vi.spyOn(game, "addExecution");
      attack.maybeAttack();

      expect(attacksOn(spy, runner).length).toBeGreaterThan(0);
      expect(attacksOn(spy, weak)).toHaveLength(0);
    },
  );

  test("Hard: without a project it goes for the very weak neighbor", async () => {
    const { game, runner, nation, weak, attack } = await stripes(
      Difficulty.Hard,
    );
    setTroops(game, nation, runner, weak);

    const spy = vi.spyOn(game, "addExecution");
    attack.maybeAttack();

    expect(attacksOn(spy, weak).length).toBeGreaterThan(0);
    expect(attacksOn(spy, runner)).toHaveLength(0);
  });

  test("Medium nations don't single out the project owner", async () => {
    const { game, runner, nation, weak, attack } = await stripes(
      Difficulty.Medium,
    );
    setTroops(game, nation, runner, weak);
    startProject(game, runner);

    const spy = vi.spyOn(game, "addExecution");
    attack.maybeAttack();

    expect(attacksOn(spy, runner)).toHaveLength(0);
  });

  function nukeBehavior(
    game: Game,
    nation: Player,
    attack: AiAttackBehavior,
    emoji: NationEmojiBehavior,
  ) {
    nation.buildUnit(UnitType.MissileSilo, game.ref(45, 50), {});
    grantTechs(nation, "rocketry", "manhattan_project");
    nation.addGold(10_000_000n);
    return new NationNukeBehavior(
      new PseudoRandom(2),
      game,
      nation,
      attack,
      emoji,
    );
  }

  test("Hard: nukes the project building", async () => {
    const { game, runner, nation, attack, emoji } = await stripes(
      Difficulty.Hard,
    );
    const host = startProject(game, runner);

    nukeBehavior(game, nation, attack, emoji).maybeSendNuke();
    // First tick initializes the NukeExecution, the second launches the bomb
    game.executeNextTick();
    game.executeNextTick();

    const nukes = nation.units(UnitType.AtomBomb);
    expect(nukes).toHaveLength(1);
    expect(nukes[0].targetTile()).toBe(host.tile());
  });

  test("never nukes an ally's project building", async () => {
    const { game, runner, nation, attack, emoji } = await stripes(
      Difficulty.Hard,
    );
    const host = startProject(game, runner);
    nation.createAllianceRequest(runner)?.accept();
    expect(nation.isAlliedWith(runner)).toBe(true);

    nukeBehavior(game, nation, attack, emoji).maybeSendNuke();
    game.executeNextTick();
    game.executeNextTick();

    expect(
      nation
        .units(UnitType.AtomBomb)
        .filter((n) => n.targetTile() === host.tile()),
    ).toHaveLength(0);
  });
});

describe("a nation running a project that pauses while it attacks", () => {
  function runOwnProject(
    game: Game,
    nation: Player,
    kind: "science" | "political",
  ) {
    const type =
      kind === "political" ? UnitType.AdminOffice : UnitType.ResearchInstitute;
    const host = buildLevel(game, nation, type, 45, 50, 3);
    nation.domestic()!.beginVictoryProject(kind, host.id(), 2400);
  }

  test.each([Difficulty.Hard, Difficulty.Impossible])(
    "%s: world government holds its fire, even at a very weak neighbor",
    async (difficulty) => {
      const { game, runner, nation, weak, attack } = await stripes(difficulty);
      setTroops(game, nation, runner, weak);
      runOwnProject(game, nation, "political");

      const spy = vi.spyOn(game, "addExecution");
      attack.maybeAttack();

      expect(attacksOn(spy, weak)).toHaveLength(0);
      expect(attacksOn(spy, runner)).toHaveLength(0);
    },
  );

  test("world government still answers an attack", async () => {
    const { game, runner, nation, weak, attack } = await stripes(
      Difficulty.Hard,
    );
    setTroops(game, nation, runner, weak);
    runOwnProject(game, nation, "political");
    game.addExecution(new AttackExecution(10_000, runner, nation.id(), null));
    game.executeNextTick();
    game.executeNextTick();
    expect(nation.incomingAttacks().length).toBeGreaterThan(0);

    const spy = vi.spyOn(game, "addExecution");
    attack.maybeAttack();

    expect(attacksOn(spy, runner).length).toBeGreaterThan(0);
    expect(attacksOn(spy, weak)).toHaveLength(0);
  });

  test("the space program doesn't pause, so it attacks as usual", async () => {
    const { game, runner, nation, weak, attack } = await stripes(
      Difficulty.Hard,
    );
    setTroops(game, nation, runner, weak);
    runOwnProject(game, nation, "science");

    const spy = vi.spyOn(game, "addExecution");
    attack.maybeAttack();

    expect(attacksOn(spy, weak).length).toBeGreaterThan(0);
  });
});
