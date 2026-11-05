// ww61: the catalogue in the engine: entries as design slots, unlock by
// techs, designer off refusing design orders.
import { DESIGNER_POOL } from "@openfront/engine-api/ww1936/DepthTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { HIST_CATALOGUE } from "@openfront/engine-lib/ww1936/hist/index";
import { histOwn } from "@openfront/engine-lib/ww1936/hist/Slots";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { clearStartSetup, HUMAN, order, step, stepTo, wwRunner } from "./util";

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
      expect(histOwn(c, "tank").length).toBeLessThanOrEqual(30);
      expect(histOwn(c, "plane").length).toBeLessThanOrEqual(34);
      expect(histOwn(c, "ship").length).toBeLessThanOrEqual(24);
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
    expect(wearLoss(3, 5000, 900_000)).toBe(0);
    expect(wearLoss(300, 5000, 0)).toBe(1);
    expect(wearLoss(2, 1_000_000, 0)).toBe(2);
    let lost = 0;
    for (let i = 0; i < 2000; i++) lost += wearLoss(30, 5000, wearRoll(i, 1));
    // 30 tanks at 0.5 % over 2000 days: about 300.
    expect(lost).toBeGreaterThan(220);
    expect(lost).toBeLessThan(380);
  });
});

describe("AI value rule", () => {
  test("good enough and cheap beats the best and dear", async () => {
    const { pickValue, valueNear } =
      await import("@openfront/engine/ww1936/depth/AiHist");
    // A Tiger-like (score 100, cost 100) against a T-34-like (score 70, cost 30).
    expect(
      pickValue([
        { key: 5, score: 100, cost: 100 },
        { key: 9, score: 70, cost: 30 },
      ]),
    ).toBe(9);
    // Junk far below the best is never picked however cheap.
    expect(
      pickValue([
        { key: 5, score: 100, cost: 100 },
        { key: 9, score: 30, cost: 5 },
      ]),
    ).toBe(5);
    expect(valueNear(70, 30, 70, 30)).toBe(true);
    expect(valueNear(100, 100, 70, 30)).toBe(false);
  });

  test("an AI game with the catalogue runs and the AI builds catalogue tanks", async () => {
    const runner = await wwRunner({ ww1936Designer: false }, [], DEEP.map);
    stepTo(runner, WW_PREP_TICKS + 2);
    const ww = runner.game.worldWar()!;
    for (const t of histOwn("DEU", "tank")[0].techs) {
      ww.economy.country(DEU)?.addTech(t);
    }
    step(runner, 1500);
    const ce = ww.economy.country(DEU)!;
    const slots = ww.depth.country(DEU)!.des.tank.filter((s) => s !== null);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => s!.def.hist !== undefined)).toBe(true);
    expect(ce.lines.length).toBeGreaterThan(0);
  });
});

describe("catalogue entries crossing between countries", () => {
  test("a foreign entry lands after the receiver's own catalogue; an own one in its own slot", async () => {
    const { copyDesignTo } =
      await import("@openfront/engine/ww1936/depth/DesignCopy");
    const { histDef } = await import("@openfront/engine/ww1936/depth/Hist");
    const { runner, ww, d } = await game(false);
    void runner;
    const GBR = DEEP.tag.GBR;
    const tigerIdx = histOwn("DEU", "tank").findIndex(
      (e) => e.id === "deu_tiger1_e",
    );
    const ce = ww.economy.country(DEU)!;
    for (const t of histOwn("DEU", "tank")[tigerIdx].techs) ce.addTech(t);
    step(runner, 20);
    const got = copyDesignTo(d, DEU, tigerIdx + 1, "tank", GBR, "licensed");
    expect(got).toBe(histOwn("GBR", "tank").length + 1);
    const slot = d.designSlot(GBR, "tank", got!)!;
    expect(slot.def.hist).toBe("deu_tiger1_e");
    expect(slot.origin).toBe("licensed");
    // Again: the same slot.
    expect(copyDesignTo(d, DEU, tigerIdx + 1, "tank", GBR, "received")).toBe(
      got,
    );
    // An entry of the receiver's own catalogue takes its own slot, locked or not.
    const mine = histOwn("GBR", "tank")[3];
    const dd = histDef(mine)!;
    d.country(DEU)!.des.tank[40] = {
      def: dd as never,
      origin: "own",
      from: 0,
      fromSlot: 0,
      obsolete: false,
      savedDay: 0,
    };
    expect(copyDesignTo(d, DEU, 41, "tank", GBR, "licensed")).toBe(4);
    expect(d.designSlot(GBR, "tank", 4)!.def.hist).toBe(mine.id);
  });
});

describe("snapshot and hash", () => {
  test("a catalogue game restores to the same hash and keeps running alike", async () => {
    const { wwRestore, gameHash } = await import("./util");
    const humans = [{ clientID: HUMAN, country: "DEU" as const }];
    const { runner, ww } = await game(false);
    for (const t of histOwn("DEU", "tank")[0].techs) {
      ww.economy.country(DEU)?.addTech(t);
    }
    step(runner, 30);
    const b = await wwRestore(runner, humans, DEEP.map, {
      ww1936Designer: false,
    });
    expect(gameHash(b)).toBe(gameHash(runner));
    for (let i = 0; i < 20; i++) {
      step(runner, 1);
      step(b, 1);
      expect(gameHash(b), `tick ${i}`).toBe(gameHash(runner));
    }
    expect(
      b.game
        .worldWar()!
        .depth.country(DEU)!
        .des.tank.some((s) => s?.def.hist),
    ).toBe(true);
  });
});

describe("start stock", () => {
  test("static plane stock becomes a named catalogue plane of its type", async () => {
    const { equipKey } =
      await import("@openfront/engine-api/ww1936/EconomyTypes");
    const { runner, ww, d } = await game(false);
    const ce = ww.economy.country(DEU)!;
    const own = histOwn("DEU", "plane");
    const fighters = () =>
      own.reduce(
        (n, e, i) =>
          n +
          (e.family === "plane" && e.type === "fighter"
            ? ce.stock[equipKey("plane_design", i + 1)]
            : 0),
        0,
      );
    const before = fighters();
    ce.stock[equipKey("fighter", 1)] += 7;
    step(runner, 20);
    expect(ce.stock[equipKey("fighter", 1)]).toBe(0);
    expect(fighters()).toBe(before + ce.stock[equipKey("fighter", 1)] + 7);
    own.forEach((e, i) => {
      if (ce.stock[equipKey("plane_design", i + 1)] > 0) {
        expect(d.designSlot(DEU, "plane", i + 1)!.def.hist).toBe(e.id);
      }
    });
  });
});

describe("catalogue carrier deck (B15)", () => {
  test("a catalogue carrier's deck is its own, not the generation's 40", async () => {
    const { deckSize } = await import("@openfront/engine/ww1936/navy/Carriers");
    const { histSlotOf } =
      await import("@openfront/engine-lib/ww1936/hist/Slots");
    const { histEntry } =
      await import("@openfront/engine-lib/ww1936/hist/index");
    const { runner, ww } = await game(false);
    const ce = ww.economy.country(DEU)!;
    const e = histEntry("deu_graf_zeppelin")!;
    for (const t of e.techs) ce.addTech(t);
    step(runner, 20);
    const port = ww.scenario.landRegions.find(
      (r) => ww.scenario.harborOf(r.id) !== 0,
    )!.id;
    const id = ww.navy.createFleet(DEU, port, [["cv", 1, 1]]);
    const f = ww.navy.fleets.get(id)!;
    const row = ww.navy.ships.rowOf(f.ships[0]);
    const generic = deckSize(ww.navy, row, f);
    ww.navy.ships.design[row] = histSlotOf("DEU", e.id);
    const own = deckSize(ww.navy, row, f);
    const aircraft = (e as { spec: { aircraft: number } }).spec.aircraft;
    expect(aircraft).not.toBe(40);
    expect(own).toBeGreaterThanOrEqual(aircraft - 2);
    expect(own).toBeLessThanOrEqual(aircraft + 2);
    expect(own).not.toBe(generic);
  });
});

describe("catalogue transports (B9)", () => {
  test("the paradrop's transport count sees plane-design stock", async () => {
    const { equipKey } =
      await import("@openfront/engine-api/ww1936/EconomyTypes");
    const { transportStock } =
      await import("@openfront/engine/ww1936/air/Paradrop");
    const { runner, ww } = await game(false);
    const ce = ww.economy.country(DEU)!;
    const own = histOwn("DEU", "plane");
    const slot =
      own.findIndex(
        (e) => e.family === "plane" && e.type === "transport_plane",
      ) + 1;
    expect(slot).toBeGreaterThan(0);
    for (const t of own[slot - 1].techs) ce.addTech(t);
    step(runner, 20);
    const before = transportStock(ww.air, DEU);
    ce.stock[equipKey("plane_design", slot)] += 33;
    expect(transportStock(ww.air, DEU)).toBe(before + 33);
  });
});

describe("start stock by generation (B4)", () => {
  test("generic fighter:2 does not land in the same entry as fighter:1", async () => {
    const { equipKey } =
      await import("@openfront/engine-api/ww1936/EconomyTypes");
    const { runner, ww } = await game(false);
    const ce = ww.economy.country(DEU)!;
    const own = histOwn("DEU", "plane");
    // ww83: one fighter is open at the start now; open a second.
    ce.researched.add("fighter_2");
    const slots = (): number[] =>
      own
        .map((e, i) => (ce.stock[equipKey("plane_design", i + 1)] > 0 ? i : -1))
        .filter((i) => i >= 0);
    const g1Only = async () => {
      ce.stock[equipKey("fighter", 1)] = 0;
      ce.stock[equipKey("fighter", 2)] = 0;
    };
    await g1Only();
    for (let i = 0; i < own.length; i++)
      ce.stock[equipKey("plane_design", i + 1)] = 0;
    ce.stock[equipKey("fighter", 2)] = 5;
    step(runner, 20);
    const g2 = slots().filter(
      (i) => (own[i] as { type?: string }).type === "fighter",
    );
    ce.stock[equipKey("fighter", 1)] = 5;
    step(runner, 20);
    const both = slots().filter(
      (i) => (own[i] as { type?: string }).type === "fighter",
    );
    expect(g2.length).toBe(1);
    // The generation-1 stock went to another (older) entry than generation 2's.
    expect(both.length).toBeGreaterThan(1);
  });
});

// ww85: the rocket interceptors stay a player's choice.
describe("the AI and point-defence fighters", () => {
  test("only the two rocket planes fall under the floor", async () => {
    const { AI_MIN_FIGHTER_RANGE } =
      await import("@openfront/engine/ww1936/depth/AiHist");
    const { HIST_ALL, histStatsOf } =
      await import("@openfront/engine-lib/ww1936/hist/index");
    const short = HIST_ALL.filter(
      (e) =>
        e.family === "plane" &&
        e.type.endsWith("fighter") &&
        (histStatsOf(e) as { range: number }).range < AI_MIN_FIGHTER_RANGE,
    ).map((e) => e.id);
    expect(short.sort()).toEqual(["deu_me163_b", "jpn_shusui"]);
  });

  test("a German AI fighter line never moves to the Me 163", async () => {
    const { aiPickNewPlaneLines } =
      await import("@openfront/engine/ww1936/depth/AiHist");
    const { EQUIP_KEYS, equipKey } =
      await import("@openfront/engine-api/ww1936/EconomyTypes");
    const { ww, d, runner } = await game(false);
    const ce = ww.economy.country(DEU)!;
    const own = histOwn("DEU", "plane");
    const fighters = own.filter(
      (e) => (e as { type?: string }).type === "fighter",
    );
    for (const e of fighters) for (const t of e.techs) ce.addTech(t);
    step(runner, 30);
    const komet = equipKey(
      "plane_design",
      own.findIndex((e) => e.id === "deu_me163_b") + 1,
    );
    // The start pick has moved the 1936 line; put a static one back.
    const line = ce.lines.find(
      (l) => EQUIP_KEYS[l.key][0] === "plane_design",
    )!;
    line.key = equipKey("fighter", 1);
    aiPickNewPlaneLines(d, DEU, ce);
    expect(line.key).not.toBe(equipKey("fighter", 1));
    expect(ce.lines.some((l) => l.key === komet)).toBe(false);
  });
});

// ww73: a catalogue line is never slower than the generic line of its type.
describe("catalogue line against the generic line", () => {
  test("the Panzer II line asks what the generic light tank asks and makes as many", async () => {
    const { equipKey } =
      await import("@openfront/engine-api/ww1936/EconomyTypes");
    const { equipResources } =
      await import("@openfront/engine/ww1936/depth/Designs");
    const run = async (hist: boolean) => {
      const { runner, ww, d } = await game(false);
      const ce = ww.economy.country(DEU)!;
      clearStartSetup(ww.economy, ce);
      const own = histOwn("DEU", "tank");
      const slot = own.findIndex((e) => e.id === "deu_pz2_c") + 1;
      for (const t of own[slot - 1].techs) ce.addTech(t);
      step(runner, 20);
      const equipment = hist ? "tank_design" : "light_tank";
      const gen = hist ? slot : 1;
      const key = equipKey(equipment, gen);
      const before = ce.stock[key];
      step(runner, 1, [
        order(HUMAN, { kind: "add_line", equipment, gen, factories: 4 }),
      ]);
      step(runner, 600);
      const line = ce.lines[0];
      return {
        per: equipResources(d, DEU, key),
        made: ce.stock[key] - before,
        active: line.active,
        eff: line.effBp,
      };
    };
    const generic = await run(false);
    const hist = await run(true);
    expect(hist.per).toEqual(generic.per);
    expect(hist.active).toBe(generic.active);
    expect(hist.eff).toBe(generic.eff);
    expect(hist.made).toBeGreaterThanOrEqual(generic.made);
    expect(hist.made).toBeGreaterThan(0);
  });
});

describe("designer-only notices", () => {
  test("with the designer off a new chassis or airframe is not announced", async () => {
    const { noteNewChassis } =
      await import("@openfront/engine/ww1936/depth/DesignCells");
    const { noteNewAirframe } =
      await import("@openfront/engine/ww1936/depth/PlaneCells");
    const { TANK_BASE_DEFS } =
      await import("@openfront/engine-lib/ww1936/DesignRules");
    const { PLANE_BASE_DEFS } =
      await import("@openfront/engine-lib/ww1936/DesignRules");
    const { runner, ww, d } = await game(false);
    const ce = ww.economy.country(DEU)!;
    for (const t of histOwn("DEU", "tank")[0].techs) ce.addTech(t);
    for (const t of histOwn("DEU", "plane")[0].techs) ce.addTech(t);
    step(runner, 20);
    // The country holds own slots, which is what used to trigger the notice.
    expect(d.country(DEU)!.des.tank.some((s) => s?.origin === "own")).toBe(
      true,
    );
    const spy = vi.spyOn(d, "message");
    const tank = Object.values(TANK_BASE_DEFS)[1].tech;
    const plane = Object.values(PLANE_BASE_DEFS)[1].tech!;
    noteNewChassis(d, DEU, tank);
    noteNewAirframe(d, DEU, plane);
    expect(spy).not.toHaveBeenCalled();
  });
});
