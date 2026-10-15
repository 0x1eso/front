import {
  PlayerInfo,
  PlayerType,
  TerrainType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import {
  AttackLogicInput,
  EngineConfig,
} from "@openfront/engine/configuration/EngineConfig";
import {
  domesticDefensePostScale,
  domesticTradeGold,
  domesticTradeShipSpawnRate,
} from "@openfront/engine/domestic/DomesticEconomy";
import { setup } from "../util/Setup";
import { conquerSquare, domesticGame, grantTechs, HUMAN } from "./util";

const OTHER = new PlayerInfo("other", PlayerType.Human, null, "other_id");
const THIRD = new PlayerInfo("third", PlayerType.Human, null, "third_id");

describe("economy tech effects", () => {
  test("city tax: +15 gold per tick per city level, +50% with currency", async () => {
    const game = await domesticGame();
    const player = game.player(HUMAN.id);
    conquerSquare(game, player, 0, 0, 20);
    player.addGold(1_000_000n);
    player.buildUnit(UnitType.City, game.ref(5, 5), {});
    expect(game.config().goldAdditionRate(player)).toBe(115n);
    grantTechs(player, "currency");
    expect(game.config().goldAdditionRate(player)).toBe(122n);
  });

  test("vanilla gold rate ignores cities", async () => {
    const game = await setup("plains", {}, [HUMAN]);
    const player = game.player(HUMAN.id);
    conquerSquare(game, player, 0, 0, 20);
    player.addGold(1_000_000n);
    player.buildUnit(UnitType.City, game.ref(5, 5), {});
    expect(game.config().goldAdditionRate(player)).toBe(100n);
  });

  test("globalization: base gold income +30%", async () => {
    const game = await domesticGame();
    const player = game.player(HUMAN.id);
    conquerSquare(game, player, 0, 0, 10);
    grantTechs(player, "globalization");
    expect(game.config().goldAdditionRate(player)).toBe(130n);
  });

  test("navigation: port cost -25%", async () => {
    const game = await domesticGame();
    const player = game.player(HUMAN.id);
    const portCost = () => game.unitInfo(UnitType.Port).cost(game, player);
    expect(portCost()).toBe(125_000n);
    grantTechs(player, "navigation");
    expect(portCost()).toBe(93_750n);
  });

  test("industrialization: structures -15%, nukes unaffected", async () => {
    const game = await domesticGame();
    const player = game.player(HUMAN.id);
    grantTechs(player, "industrialization");
    expect(game.unitInfo(UnitType.City).cost(game, player)).toBe(106_250n);
    expect(game.unitInfo(UnitType.AtomBomb).cost(game, player)).toBe(750_000n);
  });

  test("trade payouts are modified per recipient", async () => {
    const game = await domesticGame({}, [HUMAN, OTHER, THIRD]);
    const a = game.player(HUMAN.id);
    const b = game.player(OTHER.id);
    const c = game.player(THIRD.id);
    conquerSquare(game, a, 0, 0, 5);
    conquerSquare(game, b, 50, 50, 5);
    conquerSquare(game, c, 90, 90, 5);
    grantTechs(a, "navigation", "global_trade");
    expect(domesticTradeGold(1000n, a, b, "tradeShip")).toBe(1400n);
    expect(domesticTradeGold(1000n, b, a, "tradeShip")).toBe(1000n);
    expect(domesticTradeGold(1000n, a, a, "train")).toBe(1000n);
    a.createAllianceRequest(b)?.accept();
    expect(a.isAlliedWith(b)).toBe(true);
    expect(domesticTradeGold(1000n, a, b, "train")).toBe(1500n);
    expect(domesticTradeGold(1000n, a, c, "train")).toBe(1000n);
  });

  test("global trade: trade ships spawn 1.5x as often", async () => {
    const game = await domesticGame({}, [HUMAN, OTHER]);
    const a = game.player(HUMAN.id);
    const b = game.player(OTHER.id);
    grantTechs(a, "global_trade");
    expect(domesticTradeShipSpawnRate(100, a)).toBe(66);
    expect(domesticTradeShipSpawnRate(100, b)).toBe(100);
  });

  test("fortification scales the defense-post bonus by +50%", async () => {
    const game = await domesticGame();
    const config = game.config();
    // TestConfig stubs attackLogic; call the real formula.
    const realAttackLogic = (i: AttackLogicInput) =>
      EngineConfig.prototype.attackLogic.call(config, i);
    const input = (scale: number | undefined): AttackLogicInput => ({
      terrain: TerrainType.Plains,
      attackTroops: 10_000,
      attacker: { type: PlayerType.Human, numTiles: 1000 },
      defender: {
        type: PlayerType.Human,
        numTiles: 1000,
        troops: 10_000,
        isTraitor: false,
        isDisconnectedTeammate: false,
        defensePostScale: scale,
      },
      defenderHasDefensePost: true,
      falloutRatio: null,
      borderSize: 10,
    });
    const base = realAttackLogic(input(undefined));
    expect(realAttackLogic(input(1))).toEqual(base);
    const bonus = config.defensePostDefenseBonus();
    const fortified = realAttackLogic(input(1.5));
    expect(fortified.attackerTroopLoss / base.attackerTroopLoss).toBeCloseTo(
      (1 + (bonus - 1) * 1.5) / bonus,
      6,
    );

    const player = game.player(HUMAN.id);
    expect(domesticDefensePostScale(player)).toBe(1);
    grantTechs(player, "fortification");
    expect(domesticDefensePostScale(player)).toBe(1.5);
  });
});
