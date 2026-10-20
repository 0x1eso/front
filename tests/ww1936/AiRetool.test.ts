// World War 1936 P1 (Task 9): a refused retooling makes the AI try the next
// line near its cap (pre-flight R6.7). The plan and the order see the same
// state, so in a game nothing refuses one; here changeLine refuses the first.
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import { aiEconomyTick } from "@openfront/engine/ww1936/economy/AiEconomy";
import * as Production from "@openfront/engine/ww1936/economy/Production";
import { byTag, stepTo, wwRunner } from "./util";

const refused = new Set<number>();

vi.mock("@openfront/engine/ww1936/economy/Production", async (original) => {
  const real =
    await original<
      typeof import("@openfront/engine/ww1936/economy/Production")
    >();
  return {
    ...real,
    changeLine: vi.fn((...args: Parameters<typeof real.changeLine>) =>
      refused.has(args[2]) ? "bad_line" : real.changeLine(...args),
    ),
  };
});

test("a refused retooling tries the next line near its cap", async () => {
  const runner = await wwRunner();
  const g = runner.game;
  const econ = g.worldWar()!.economy;
  const p = byTag(g, "DEU");
  const deu = econ.country(p.smallID())!;
  stepTo(runner, 700);
  deu.addTech("inf_eq_2");
  deu.addTech("artillery_2");
  const near = (id: number, type: "infantry_equipment" | "artillery") => ({
    id,
    key: equipKey(type, 1),
    factories: 2,
    active: 2,
    effBp: 5900,
    progress: 0,
    fill: 1000,
    lastOutput: 0,
  });
  deu.lines = [near(101, "infantry_equipment"), near(102, "artillery")];
  deu.nextLineId = 103;
  refused.add(101);
  // Germany's turn (day 9: (9 + 1) % 10 === 0).
  aiEconomyTick(econ, deu, p, 9, g.ticks());
  expect(vi.mocked(Production.changeLine).mock.calls.map((c) => c[2])).toEqual([
    101, 102,
  ]);
  expect(deu.lines.find((l) => l.id === 101)!.key).toBe(
    equipKey("infantry_equipment", 1),
  );
  expect(deu.lines.find((l) => l.id === 102)!.key).toBe(
    equipKey("artillery", 2),
  );
});
