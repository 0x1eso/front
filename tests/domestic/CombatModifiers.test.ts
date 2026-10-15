import {
  PlayerInfo,
  PlayerType,
  TerrainType,
} from "@openfront/engine-api/game/GameTypes";
import { GameConfig } from "@openfront/engine-api/Schemas";
import {
  AttackLogicInput,
  AttackLogicResult,
  EngineConfig,
} from "@openfront/engine/configuration/EngineConfig";
import { domesticCombat } from "@openfront/engine/domestic/DomesticEconomy";
import { AttackExecution } from "@openfront/engine/execution/AttackExecution";
import { setup } from "../util/Setup";
import { TestConfig } from "../util/TestConfig";
import { executeTicks } from "../util/utils";
import { conquerSquare, grantGovernment, grantLaws, HUMAN } from "./util";

const OTHER = new PlayerInfo("other", PlayerType.Human, null, "other_id");
// The real formula; TestConfig stubs attackLogic out.
const formula = new EngineConfig({} as GameConfig, false);

const DEFENDER = {
  type: PlayerType.Human,
  numTiles: 1000,
  troops: 10_000,
  isTraitor: false,
  isDisconnectedTeammate: false,
};

function input(o: Partial<AttackLogicInput> = {}): AttackLogicInput {
  return {
    terrain: TerrainType.Plains,
    attackTroops: 10_000,
    attacker: { type: PlayerType.Human, numTiles: 1000 },
    defender: DEFENDER,
    defenderHasDefensePost: false,
    falloutRatio: null,
    borderSize: 10,
    ...o,
  };
}

/** Records every attackLogic input; the stubbed result stays the same. */
class RecordingConfig extends TestConfig {
  readonly inputs: AttackLogicInput[] = [];
  override attackLogic(i: AttackLogicInput): AttackLogicResult {
    this.inputs.push(i);
    return super.attackLogic(i);
  }
}

describe("attackLogic scales", () => {
  test("absent scales and scales of 1 are vanilla", () => {
    const base = formula.attackLogic(input());
    expect(
      formula.attackLogic(
        input({
          attacker: {
            type: PlayerType.Human,
            numTiles: 1000,
            lossScale: 1,
            speedScale: 1,
          },
          defender: { ...DEFENDER, lossScale: 1 },
        }),
      ),
    ).toEqual(base);
    const tn = formula.attackLogic(input({ defender: null }));
    expect(
      formula.attackLogic(
        input({
          defender: null,
          attacker: { type: PlayerType.Human, numTiles: 1000, speedScale: 1 },
        }),
      ),
    ).toEqual(tn);
  });

  test("loss scales multiply losses; the speed scale divides the tick share", () => {
    const base = formula.attackLogic(input());
    const r = formula.attackLogic(
      input({
        attacker: {
          type: PlayerType.Human,
          numTiles: 1000,
          lossScale: 0.85,
          speedScale: 1.3,
        },
        defender: { ...DEFENDER, lossScale: 1.1 },
      }),
    );
    expect(r.attackerTroopLoss).toBeCloseTo(base.attackerTroopLoss * 0.85, 9);
    expect(r.defenderTroopLoss).toBeCloseTo(base.defenderTroopLoss * 1.1, 9);
    expect(r.tickFraction).toBeCloseTo(base.tickFraction / 1.3, 9);
  });

  test("expansion uses only the speed scale", () => {
    const base = formula.attackLogic(input({ defender: null }));
    const r = formula.attackLogic(
      input({
        defender: null,
        attacker: {
          type: PlayerType.Human,
          numTiles: 1000,
          lossScale: 0.5,
          speedScale: 1.2,
        },
      }),
    );
    expect(r.attackerTroopLoss).toBe(base.attackerTroopLoss);
    expect(r.tickFraction).toBeCloseTo(base.tickFraction / 1.2, 9);
  });
});

describe("domesticCombat", () => {
  test("laws and governments set each side's scales", async () => {
    const game = await setup("plains", { domesticMode: true }, [HUMAN, OTHER]);
    const a = game.player(HUMAN.id);
    const b = game.player(OTHER.id);
    expect(domesticCombat(a, b)).toEqual({
      attackerLoss: 1,
      attackerSpeed: 1,
      defenderLoss: 1,
    });
    // Professional army (attackLoss -15) and blitzkrieg (attackSpeed +30).
    grantLaws(a, { service: "B", doctrine: "B" });
    // Theocracy: defenseLoss -20.
    grantGovernment(b, "theocracy");
    const c = domesticCombat(a, b);
    expect(c.attackerLoss).toBeCloseTo(0.85, 9);
    expect(c.attackerSpeed).toBeCloseTo(1.3, 9);
    expect(c.defenderLoss).toBeCloseTo(0.8, 9);
  });

  test("expanding into unclaimed land only uses expansionSpeed", async () => {
    const game = await setup("plains", { domesticMode: true }, [HUMAN]);
    const a = game.player(HUMAN.id);
    grantLaws(a, { service: "B", religion: "B" });
    const c = domesticCombat(a, null);
    expect(c.attackerLoss).toBe(1);
    expect(c.attackerSpeed).toBeCloseTo(1.2, 9);
    expect(c.defenderLoss).toBe(1);
  });

  test("players without domestic state stay at 1", async () => {
    const game = await setup("plains", {}, [HUMAN, OTHER]);
    const a = game.player(HUMAN.id);
    const b = game.player(OTHER.id);
    expect(domesticCombat(a, b)).toEqual({
      attackerLoss: 1,
      attackerSpeed: 1,
      defenderLoss: 1,
    });
    expect(domesticCombat(a, null)).toEqual({
      attackerLoss: 1,
      attackerSpeed: 1,
      defenderLoss: 1,
    });
  });
});

describe("AttackExecution passes the scales", () => {
  async function recordingGame() {
    const game = await setup(
      "plains",
      { domesticMode: true },
      [HUMAN, OTHER],
      undefined,
      RecordingConfig,
    );
    const a = game.player(HUMAN.id);
    const b = game.player(OTHER.id);
    conquerSquare(game, a, 0, 0, 10);
    conquerSquare(game, b, 10, 0, 20);
    a.setTroops(50_000);
    return { game, a, b, config: game.config() as RecordingConfig };
  }

  test("an attack on a player carries both sides' scales", async () => {
    const { game, a, b, config } = await recordingGame();
    grantLaws(a, { service: "B", doctrine: "B" });
    grantLaws(b, { doctrine: "A" }); // defenseLoss -15
    game.addExecution(new AttackExecution(1000, a, b.id(), null));
    executeTicks(game, 3);
    const last = config.inputs[config.inputs.length - 1];
    expect(last.attacker.lossScale).toBeCloseTo(0.85, 9);
    expect(last.attacker.speedScale).toBeCloseTo(1.3, 9);
    expect(last.defender?.lossScale).toBeCloseTo(0.85, 9);
  });

  test("expansion carries expansionSpeed", async () => {
    const { game, a, config } = await recordingGame();
    grantLaws(a, { religion: "B" });
    game.addExecution(
      new AttackExecution(1000, a, game.terraNullius().id(), null),
    );
    executeTicks(game, 3);
    const last = config.inputs[config.inputs.length - 1];
    expect(last.defender).toBeNull();
    expect(last.attacker.speedScale).toBeCloseTo(1.2, 9);
  });
});
