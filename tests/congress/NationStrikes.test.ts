import { TechId } from "@openfront/engine-api/domestic/DomesticTypes";
import {
  Difficulty,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { GameConfig } from "@openfront/engine-api/Schemas";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { isHeritageProtected } from "@openfront/engine/congress/Conflict";
import { EmergencyState } from "@openfront/engine/congress/Congress";
import { AttackExecution } from "@openfront/engine/execution/AttackExecution";
import { NationAllianceBehavior } from "@openfront/engine/execution/nation/NationAllianceBehavior";
import { congressAllowsAttack } from "@openfront/engine/execution/nation/NationCongressBehavior";
import { NationEmojiBehavior } from "@openfront/engine/execution/nation/NationEmojiBehavior";
import { NationMIRVBehavior } from "@openfront/engine/execution/nation/NationMIRVBehavior";
import { NationNukeBehavior } from "@openfront/engine/execution/nation/NationNukeBehavior";
import {
  nationDomesticPlan,
  Personality,
} from "@openfront/engine/execution/nation/NationPersonality";
import { NationStrategicBehavior } from "@openfront/engine/execution/nation/NationStrategicBehavior";
import {
  NationWarfareBehavior,
  warfareStyle,
} from "@openfront/engine/execution/nation/NationWarfareBehavior";
import { AiAttackBehavior } from "@openfront/engine/execution/utils/AiAttackBehavior";
import { Game, Player } from "@openfront/engine/game/Game";
import { StrategicExecution } from "@openfront/engine/strategic/StrategicExecution";
import { vi } from "vitest";
import { buildLevel, grantTechs } from "../domestic/util";
import {
  BLUE,
  congressGame,
  congressOf,
  enact,
  own,
  RED,
  runTicks,
} from "./util";

// Spec §11.4 (controller ruling): "starts nothing" covers strikes too. The
// gate is AiAttackBehavior.shouldAttack, which the nuke, warfare and
// strategic behaviours go through, plus the MIRV choice.

function nationOf(p: Personality): PlayerInfo {
  for (let i = 0; i < 500; i++) {
    const id = `nat${i}`;
    if (nationDomesticPlan(id).personality === p) {
      return new PlayerInfo(id, PlayerType.Nation, null, id);
    }
  }
  throw new Error(`no ${p}`);
}

const NUKE_TECHS: TechId[] = [
  "rocketry",
  "manhattan_project",
  "thermonuclear",
  "mirv",
];

function emergencyOn(game: Game, target: Player, members: Player[]): void {
  const e: EmergencyState = {
    kind: "aggression",
    target: target.smallID(),
    startTick: game.ticks(),
    endTick: game.ticks() + 1500,
    goalKind: "land",
    goal: 300,
    progress: 0,
    members: members.map((m) => m.smallID()),
    opposed: [],
    contributions: new Map(),
    goalSilos: [],
    countedSilos: [],
  };
  congressOf(game).setEmergency(e);
}

/**
 * Hard, big_plains: the nation holds the top-left corner with a silo and
 * plenty of gold, red a 40x40 block far away (no border); as
 * tests/NationNukeTargeting.test.ts's duel. With two players left a Hard
 * nation nukes the other one.
 */
async function duel(p: Personality) {
  const info = nationOf(p);
  const game = await congressGame(
    { difficulty: Difficulty.Hard },
    [info, RED],
    "big_plains",
  );
  const nation = own(game, info.id, 0, 0, 15, 15);
  const red = own(game, RED.id, 130, 130, 40, 40);
  grantTechs(nation, ...NUKE_TECHS);
  nation.buildUnit(UnitType.MissileSilo, game.ref(5, 5), {});
  nation.addGold(40_000_000n);
  game.executeNextTick();
  return { game, nation, red };
}

function nukeBehavior(game: Game, nation: Player): NationNukeBehavior {
  const emoji = new NationEmojiBehavior(new PseudoRandom(1), game, nation);
  const attack = new AiAttackBehavior(
    new PseudoRandom(1),
    game,
    nation,
    0.5,
    0.3,
    0.2,
    new NationAllianceBehavior(new PseudoRandom(1), game, nation, emoji),
    emoji,
  );
  return new NationNukeBehavior(
    new PseudoRandom(2),
    game,
    nation,
    attack,
    emoji,
  );
}

function nukesLaunched(game: Game, nation: Player): number {
  nukeBehavior(game, nation).maybeSendNuke();
  runTicks(game, 2);
  return nation.units(UnitType.AtomBomb, UnitType.HydrogenBomb).length;
}

describe("nation nukes and the congress", () => {
  test("control: a Hard merchant nukes the only other player", async () => {
    const { game, nation } = await duel("merchant");
    expect(nukesLaunched(game, nation)).toBeGreaterThan(0);
  });

  test("under a war tax a merchant doesn't nuke a human, unless it was hit", async () => {
    const taxed = await duel("merchant");
    enact(taxed.game, { resolution: "war_tax" });
    expect(congressAllowsAttack(taxed.game, taxed.nation, taxed.red)).toBe(
      false,
    );
    expect(nukesLaunched(taxed.game, taxed.nation)).toBe(0);

    // Hitting back isn't starting anything (spec §11.4 "반격").
    const hit = await duel("merchant");
    enact(hit.game, { resolution: "war_tax" });
    hit.nation.congress()!.recordHitBy(hit.red.smallID(), hit.game.ticks());
    expect(congressAllowsAttack(hit.game, hit.nation, hit.red)).toBe(true);
    expect(nukesLaunched(hit.game, hit.nation)).toBeGreaterThan(0);

    // A conqueror ignores the tax.
    const conqueror = await duel("conqueror");
    enact(conqueror.game, { resolution: "war_tax" });
    expect(nukesLaunched(conqueror.game, conqueror.nation)).toBeGreaterThan(0);
  });

  test("the emergency target starts no strike on a member; a member strikes the target", async () => {
    const target = await duel("conqueror");
    emergencyOn(target.game, target.nation, [target.red]);
    expect(congressAllowsAttack(target.game, target.nation, target.red)).toBe(
      false,
    );
    expect(nukesLaunched(target.game, target.nation)).toBe(0);

    // A member, even a merchant under a war tax.
    const member = await duel("merchant");
    enact(member.game, { resolution: "war_tax" });
    emergencyOn(member.game, member.red, [member.nation]);
    expect(congressAllowsAttack(member.game, member.nation, member.red)).toBe(
      true,
    );
    expect(nukesLaunched(member.game, member.nation)).toBeGreaterThan(0);
  });

  test("a truce partner is never nuked by choice", async () => {
    const { game, nation, red } = await duel("conqueror");
    enact(game, {
      resolution: "truce",
      targets: [nation.smallID(), red.smallID()].sort((a, b) => a - b),
      expires: game.ticks() + 1200,
    });
    expect(nukesLaunched(game, nation)).toBe(0);
  });

  test("a condemned project's host that world heritage still protects is no nuke target", async () => {
    const singledOut = async (protect: boolean) => {
      const { game, nation, red } = await duel("merchant");
      const host = buildLevel(
        game,
        red,
        UnitType.ResearchInstitute,
        150,
        150,
        3,
      );
      red.domestic()!.beginVictoryProject("science", host.id(), 2400);
      const heritage = (option: "A" | "B") =>
        enact(game, {
          resolution: "world_heritage",
          option,
          targets: [red.smallID()],
          param: String(host.id()),
          expires: "project_end",
        });
      // Condemned (spec §10.3); protected by an earlier A (spec §10.2).
      heritage("B");
      if (protect) heritage("A");
      expect(isHeritageProtected(game, host)).toBe(protect);
      return nukeBehavior(game, nation)["nukeVictoryProjectHost"]();
    };
    expect(await singledOut(false)).toBe(true);
    expect(await singledOut(true)).toBe(false);
  });

  test("a MIRV only goes where the nation may strike", async () => {
    // Hard: red, our size and bordering us, is the rival target.
    const run = async (warTax: boolean) => {
      const info = nationOf("merchant");
      const game = await congressGame(
        { difficulty: Difficulty.Hard },
        [info, RED],
        "big_plains",
      );
      const nation = own(game, info.id, 0, 0, 100, 200);
      own(game, RED.id, 100, 0, 100, 200);
      grantTechs(nation, ...NUKE_TECHS);
      nation.buildUnit(UnitType.MissileSilo, game.ref(50, 50), {});
      nation.addGold(1_000_000_000n);
      game.executeNextTick();
      if (warTax) enact(game, { resolution: "war_tax" });
      let chosen = 0;
      // A Hard nation hesitates one time in 8: try a few seeds.
      for (let seed = 1; seed <= 8; seed++) {
        const random = new PseudoRandom(seed);
        const mirv = new NationMIRVBehavior(
          random,
          game,
          nation,
          new NationEmojiBehavior(random, game, nation),
        );
        if (mirv.considerMIRV()) chosen++;
        game.nationMirvTargets().clear();
      }
      return chosen;
    };
    expect(await run(false)).toBeGreaterThan(0);
    expect(await run(true)).toBe(0);
  });
});

describe("nation bombers and missiles under a war tax", () => {
  // plains: the nation x 0-29 with an airport, red x 60-89 with a city, a gap between.
  async function airfield(warTax: boolean) {
    const info = nationOf("merchant");
    const game = await congressGame(
      { instantBuild: true, warfareExpansion: true },
      [info, RED],
    );
    const nation = own(game, info.id, 0, 0, 30, 30);
    const red = own(game, RED.id, 60, 0, 30, 30);
    grantTechs(nation, "industrialization");
    nation.buildUnit(UnitType.Airport, game.ref(10, 10), {});
    red.buildUnit(UnitType.City, game.ref(70, 10), {}).increaseLevel();
    nation.addGold(10_000_000n);
    game.executeNextTick();
    if (warTax) enact(game, { resolution: "war_tax" });
    return { game, nation };
  }

  test("no sortie at a human's city", async () => {
    for (const warTax of [false, true]) {
      const { game, nation } = await airfield(warTax);
      const style = { ...warfareStyle(nation), sortieOdds: 1 };
      expect(
        new NationWarfareBehavior(
          new PseudoRandom(1),
          game,
          nation,
        ).maybeSortie(style),
        `war tax ${warTax}`,
      ).toBe(!warTax);
    }
  });

  // plains: the nation x 0-29 with a factory and a silo, red x 60-99 making
  // a nuke in its factory, blue a corner.
  async function missiles(warTax: boolean) {
    const info = nationOf("merchant");
    const config: Partial<GameConfig> = {
      instantBuild: true,
      difficulty: Difficulty.Hard,
      strategicWeapons: true,
    };
    const game = await congressGame(config, [info, RED, BLUE]);
    game.addExecution(new StrategicExecution());
    const nation = own(game, info.id, 0, 0, 30, 100);
    const red = own(game, RED.id, 60, 0, 40, 100);
    own(game, BLUE.id, 40, 90, 10, 10);
    grantTechs(nation, ...NUKE_TECHS);
    nation.buildUnit(UnitType.Factory, game.ref(10, 30), {});
    nation.buildUnit(UnitType.MissileSilo, game.ref(10, 10), {});
    nation.addGold(5_000_000n);
    red.addGold(10_000_000n);
    const factory = red.buildUnit(UnitType.Factory, game.ref(80, 50), {});
    red.strategic()!.startJob({
      factoryId: factory.id(),
      type: UnitType.AtomBomb,
      startTick: 0,
      endTick: 10_000,
    });
    game.executeNextTick();
    if (warTax) enact(game, { resolution: "war_tax" });
    new NationStrategicBehavior(new PseudoRandom(1), game, nation).tick(null);
    runTicks(game, 3);
    return nation.units(UnitType.ConventionalMissile).length;
  }

  test("no missile at a human's nuke factory", async () => {
    expect(await missiles(false)).toBe(1);
    expect(await missiles(true)).toBe(0);
  });
});

describe("a Hard nation's beachhead follow-up and the congress", () => {
  // ocean_and_land: land at x <= 7, open water, an island at x >= 14 (as
  // tests/NationBeachhead.test.ts).
  async function landing(restrain: boolean) {
    const info = nationOf("merchant");
    const game = await congressGame(
      { difficulty: Difficulty.Hard },
      [info, RED],
      "ocean_and_land",
    );
    const nation = game.player(info.id);
    const island = game.player(RED.id);
    game.map().forEachTile((tile) => {
      if (!game.map().isLand(tile)) return;
      (game.x(tile) <= 7 ? nation : island).conquer(tile);
    });
    nation.setTroops(100_000);
    island.setTroops(10_000);
    const random = new PseudoRandom(42);
    const emoji = new NationEmojiBehavior(random, game, nation);
    const behavior = new AiAttackBehavior(
      random,
      game,
      nation,
      0,
      0,
      0,
      new NationAllianceBehavior(random, game, nation, emoji),
      emoji,
    );
    const spy = vi.spyOn(game, "addExecution");
    const attacks = (fromBoat: boolean) =>
      spy.mock.calls
        .map((c) => c[0])
        .filter(
          (e) =>
            e instanceof AttackExecution &&
            e.targetID() === island.id() &&
            (e["sourceTile"] !== null) === fromBoat,
        );
    expect(behavior.sendAttack(island)).toBe(true);
    // The emergency starts while the boat is at sea: red is a member and
    // the nation the target, so it starts nothing new on red (spec §11.4).
    if (restrain) emergencyOn(game, nation, [island]);
    for (let i = 0; i < 60; i++) {
      game.executeNextTick();
      behavior.followUpLandings();
    }
    expect(attacks(true)).toHaveLength(1);
    return attacks(false).length;
  }

  test("follows its landing by land, unless the congress bars attacking that player", async () => {
    expect(await landing(false)).toBeGreaterThan(0);
    expect(await landing(true)).toBe(0);
  });
});
