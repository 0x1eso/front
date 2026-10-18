import { DOMESTIC_TRAIN_GOLD_MULT } from "@openfront/engine-lib/domestic/Balance";
import { setup } from "../util/Setup";
import { domesticGame, HUMAN } from "./util";

// Factories earn through trains; domestic mode pays them more so unlocking
// factories with Railways is worth it next to ports (spec §3.4).
describe("train gold in domestic mode", () => {
  test("pays at least twice the vanilla amount for every relation", async () => {
    expect(DOMESTIC_TRAIN_GOLD_MULT).toBeGreaterThanOrEqual(2);
    const domestic = await domesticGame();
    const vanilla = await setup("plains", {}, [HUMAN]);
    const dp = domestic.player(HUMAN.id);
    const vp = vanilla.player(HUMAN.id);
    for (const rel of ["self", "team", "ally", "other"] as const) {
      for (const visited of [0, 12, 40]) {
        const base = Number(vanilla.config().trainGold(rel, visited, vp));
        expect(Number(domestic.config().trainGold(rel, visited, dp))).toBe(
          Math.trunc(base * DOMESTIC_TRAIN_GOLD_MULT),
        );
      }
    }
  });

  test("vanilla train gold is unchanged", async () => {
    const vanilla = await setup("plains", {}, [HUMAN]);
    const p = vanilla.player(HUMAN.id);
    expect(vanilla.config().trainGold("self", 0, p)).toBe(10_000n);
    expect(vanilla.config().trainGold("ally", 0, p)).toBe(35_000n);
  });
});
