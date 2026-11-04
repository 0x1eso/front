// ww61: the catalogue in the engine: entries as design slots, unlock by
// techs, designer off refusing design orders.
import { DESIGNER_POOL } from "@openfront/engine-api/ww1936/DepthTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { HIST_CATALOGUE } from "@openfront/engine-lib/ww1936/hist/index";
import { histOwn } from "@openfront/engine-lib/ww1936/hist/Slots";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { HUMAN, step, stepTo, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const DEU = DEEP.tag.DEU;

async function game(designer: boolean) {
  const runner = await wwRunner(
    designer ? { ww1936Designer: true } : { ww1936Designer: false },
    [{ clientID: HUMAN, country: "DEU" }],
    DEEP.map,
  );
  stepTo(runner, WW_PREP_TICKS + 2);
  const ww = runner.game.worldWar()!;
  return { runner, ww, d: ww.depth };
}

describe("catalogue as design slots", () => {
  test("the pools hold the largest catalogue with room for received entries", () => {
    for (const c of Object.keys(
      HIST_CATALOGUE,
    ) as (keyof typeof HIST_CATALOGUE)[]) {
      expect(histOwn(c, "tank").length).toBeLessThanOrEqual(36);
      expect(histOwn(c, "plane").length).toBeLessThanOrEqual(48);
      expect(histOwn(c, "ship").length).toBeLessThanOrEqual(28);
    }
    expect(DESIGNER_POOL.tank).toBe(12);
  });

  test("designer off: entries appear with their techs and design orders are refused", async () => {
    const { runner, ww, d } = await game(false);
    const own = histOwn("DEU", "tank");
    const tiger = own.findIndex((e) => e.id === "deu_tiger1_e");
    expect(tiger).toBeGreaterThanOrEqual(0);
    step(runner, 20);
    expect(d.designSlot(DEU, "tank", tiger + 1)).toBeNull();
    const ce = ww.economy.country(DEU)!;
    for (const t of own[tiger].techs) ce.addTech(t);
    step(runner, 20);
    const slot = d.designSlot(DEU, "tank", tiger + 1)!;
    expect(slot.def.hist).toBe("deu_tiger1_e");
    expect(slot.def.name).toBe("deu_tiger1_e");
    expect(slot.origin).toBe("own");
    const st = d.designStatsOf(DEU, "tank", tiger + 1)!;
    expect(st.kind).toBe("tank");
    expect(
      d.issue(
        DEU,
        {
          kind: "design_save",
          def: {
            kind: "tank",
            base: "medium_1",
            modules: [
              "gun_cs",
              "turret_2",
              "bogie",
              "welded",
              "petrol",
              "",
              "",
            ],
            armorLevel: 0,
            engineLevel: 0,
            name: "X",
          },
        },
        runner.game.ticks(),
      ),
    ).toBe("designer_off");
  });

  test("designer on: no catalogue slots", async () => {
    const { runner, ww, d } = await game(true);
    const own = histOwn("DEU", "tank");
    const ce = ww.economy.country(DEU)!;
    for (const t of own[0].techs) ce.addTech(t);
    step(runner, 20);
    expect(d.country(DEU)!.des.tank.every((s) => s === null)).toBe(true);
  });
});

describe("reliability wear", () => {
  test("poor reliability wears more, from 90 percent nothing", async () => {
    const { breakdownPpm, wearLoss, wearRoll } =
      await import("@openfront/engine-lib/ww1936/hist/Wear");
    expect(breakdownPpm(700)).toBe(5000);
    expect(breakdownPpm(830)).toBe(1750);
    expect(breakdownPpm(900)).toBe(0);
    expect(breakdownPpm(950)).toBe(0);
    // Deterministic: the same inputs, the same roll; the loss never exceeds the holding.
    expect(wearRoll(7, 9)).toBe(wearRoll(7, 9));
    expect(wearLoss(3, 5000, 999_999)).toBe(0);
    expect(wearLoss(300, 5000, 0)).toBe(1);
    expect(wearLoss(2, 1_000_000, 0)).toBe(2);
    let lost = 0;
    for (let i = 0; i < 2000; i++) lost += wearLoss(30, 5000, wearRoll(i, 1));
    // 30 tanks at 0.5 % over 2000 days: about 300.
    expect(lost).toBeGreaterThan(220);
    expect(lost).toBeLessThan(380);
  });
});
