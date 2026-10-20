import { WwOrder } from "@openfront/engine-api/Schemas";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  equipKey,
  RESOURCE_COUNT,
  RESOURCE_IDS,
  WW_MAX_LINE_FACTORIES,
  WW_MAX_LINES,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  effAfterAdding,
  effCapBp,
  efficiencyGrowth,
  lineOutputMilli,
} from "@openfront/engine-lib/ww1936/EconomyRules";
import { unitCostMilli } from "@openfront/engine-lib/ww1936/Equipment";
import { GameRunner } from "@openfront/engine/GameRunner";
import {
  addLine,
  changeLine,
  factoryCount,
  moveLine,
  removeLine,
  setLineFactories,
  stepProduction,
} from "@openfront/engine/ww1936/economy/Production";
import { openTrade } from "@openfront/engine/ww1936/economy/Trade";
import type {
  CountryEconomy,
  WwEconomy,
} from "@openfront/engine/ww1936/economy/WwEconomy";
import {
  byTag,
  clearLand,
  clearStartSetup,
  stamped,
  step,
  stepTo,
  wwRunner,
} from "./util";

// The measured countries are human, so no AI economy (Task 6) touches
// their lines (pre-flight S3); their starting lines are taken back.
const CLIENT: Record<string, string> = {
  DEU: "HUMAN001",
  ITA: "HUMAN002",
  GBR: "HUMAN003",
  FRA: "HUMAN004",
  SUN: "HUMAN005",
  POL: "HUMAN006",
};

interface Game1936 {
  runner: GameRunner;
  econ: WwEconomy;
  ce: (tag: CountryTag) => CountryEconomy;
  order: (tag: CountryTag, order: WwOrder) => void;
}

async function game(tags: CountryTag[]): Promise<Game1936> {
  const runner = await wwRunner(
    {},
    tags.map((country) => ({ clientID: CLIENT[country], country })),
  );
  const g = runner.game;
  const econ = g.worldWar()!.economy;
  // Lines measured from none: the starting ones go.
  for (const tag of tags) {
    clearStartSetup(econ, econ.country(byTag(g, tag).smallID())!);
  }
  return {
    runner,
    econ,
    ce: (tag) => econ.country(byTag(g, tag).smallID())!,
    order: (tag, order) =>
      step(runner, 1, [stamped(CLIENT[tag], { type: "ww_order", order })]),
  };
}

const dayStart = (d: number) => dayStartTick(d, WW_PREP_TICKS);
/** Runs through day `d`: every country has had that day's step. */
const throughDay = (runner: GameRunner, d: number) =>
  stepTo(runner, dayStart(d + 1));
const outputPct = (ce: CountryEconomy) =>
  ce.law().outputPct + ce.tech.outputPct;
const STEEL = RESOURCE_IDS.indexOf("steel");

describe("production lines (spec §8)", () => {
  test("a new line starts at 10% and grows by the HOI4 rule", async () => {
    const { runner, ce, order } = await game(["DEU"]);
    const deu = ce("DEU");
    order("DEU", {
      kind: "add_line",
      equipment: "infantry_equipment",
      gen: 1,
      factories: 6,
    });
    expect(deu.lines).toHaveLength(1);
    const line = deu.lines[0];
    expect(line).toMatchObject({ factories: 6, active: 0, effBp: 1000 });
    // Germany's tools_1 lifts the cap to 60%.
    const cap = effCapBp(deu.tech);
    expect(cap).toBe(6000);
    throughDay(runner, 0);
    expect(line.active).toBe(6);
    expect(line.effBp).toBe(efficiencyGrowth(1000, cap));
    throughDay(runner, 29);
    let eff = 1000;
    for (let d = 0; d < 30; d++) eff = efficiencyGrowth(eff, cap);
    expect(line.effBp).toBe(eff);
    expect(deu.totals.idleMil).toBe(0);
  });

  test("output turns into equipment", async () => {
    const { runner, ce, order } = await game(["DEU"]);
    const deu = ce("DEU");
    // Support equipment: no one draws it from the stock the same day (the
    // draft takes infantry equipment, pre-flight S5). P2 Task 5: the
    // divisions' reinforcement would, so the board is cleared.
    clearLand(runner.game);
    order("DEU", {
      kind: "add_line",
      equipment: "support_equipment",
      gen: 1,
      factories: 6,
    });
    const line = deu.lines[0];
    const key = equipKey("support_equipment", 1);
    const cost = unitCostMilli("support_equipment", 1);
    let made = 0;
    for (let d = 0; d < 6; d++) {
      const progress = line.progress;
      const stock = deu.stock[key];
      // Day 0 puts all six factories in at the floor; later days keep them.
      const eff = d === 0 ? effAfterAdding(line.effBp, 0, 6) : line.effBp;
      throughDay(runner, d);
      expect(line.fill).toBe(1000);
      const out = lineOutputMilli(6, eff, outputPct(deu), 1000);
      expect(line.lastOutput).toBe(out);
      expect(deu.stock[key] - stock).toBe(Math.floor((progress + out) / cost));
      expect(line.progress).toBe((progress + out) % cost);
      made += deu.stock[key] - stock;
    }
    expect(made).toBeGreaterThan(0);
  });

  test("infantry equipment: a day's output over 0.5 each", async () => {
    const { econ, ce } = await game(["DEU"]);
    const deu = ce("DEU");
    expect(addLine(econ, deu, "infantry_equipment", 1, 6)).toBeNull();
    const key = equipKey("infantry_equipment", 1);
    const line = deu.lines[0];
    line.progress = 400;
    const stock = deu.stock[key];
    stepProduction(econ, deu);
    const out = lineOutputMilli(6, 1000, outputPct(deu), 1000);
    expect(deu.stock[key] - stock).toBe(Math.floor((400 + out) / 500));
    expect(line.progress).toBe((400 + out) % 500);
  });

  test("lines past the factories go idle from the bottom", async () => {
    const { runner, ce, order } = await game(["DEU"]);
    const deu = ce("DEU");
    expect(deu.totals.mil).toBe(6);
    for (let i = 0; i < 2; i++) {
      order("DEU", {
        kind: "add_line",
        equipment: "infantry_equipment",
        gen: 1,
        factories: 4,
      });
    }
    const [first, second] = deu.lines;
    throughDay(runner, 0);
    expect(first.active).toBe(4);
    expect(second.active).toBe(2);
    expect(deu.totals.idleMil).toBe(0);
    const prev = second.effBp;
    order("DEU", { kind: "remove_line", line: first.id });
    expect(deu.lines).toEqual([second]);
    throughDay(runner, 1);
    expect(second.active).toBe(4);
    // Two factories join at the floor, then the day's growth (S6).
    const cap = effCapBp(deu.tech);
    expect(second.effBp).toBe(
      efficiencyGrowth(effAfterAdding(prev, 2, 2), cap),
    );
    expect(deu.totals.idleMil).toBe(2);
    // Fewer factories: the working count follows the next day, and the
    // efficiency only grows.
    const before = second.effBp;
    order("DEU", { kind: "set_line_factories", line: second.id, factories: 1 });
    expect(second.factories).toBe(1);
    expect(second.active).toBe(4);
    throughDay(runner, 2);
    expect(second.active).toBe(1);
    expect(second.effBp).toBe(efficiencyGrowth(before, cap));
    expect(deu.totals.idleMil).toBe(5);
  });

  test("a missing resource cuts output to its share", async () => {
    // Every country human: an AI buying London's tungsten first (they plan
    // on day 0 since Task 9) would leave Italy no room.
    const { runner, econ, ce, order } = await game([
      "ITA",
      "GBR",
      "DEU",
      "FRA",
      "SUN",
      "POL",
    ]);
    const ita = ce("ITA");
    const gbr = ce("GBR");
    const TUNGSTEN = RESOURCE_IDS.indexOf("tungsten");
    expect(ita.totals.produced[TUNGSTEN]).toBe(0);
    order("ITA", {
      kind: "add_line",
      equipment: "artillery",
      gen: 1,
      factories: 1,
    });
    const line = ita.lines[0];
    throughDay(runner, 0);
    expect(line.active).toBe(1);
    expect(line.fill).toBe(0);
    // No tungsten at all: 20% of the line's output.
    expect(line.lastOutput).toBe(lineOutputMilli(1, 1000, outputPct(ita), 0));
    expect(line.lastOutput).toBe(
      Math.floor(lineOutputMilli(1, 1000, outputPct(ita), 1000) / 5),
    );
    // Britain sells London's tungsten across the sea.
    expect(openTrade(econ, ita, gbr.smallID, TUNGSTEN, 1)).toBeNull();
    const eff = line.effBp;
    throughDay(runner, 1);
    expect(ita.totals.imported[TUNGSTEN]).toBe(8);
    expect(line.fill).toBeGreaterThan(0);
    expect(line.lastOutput).toBe(
      lineOutputMilli(1, eff, outputPct(ita), line.fill),
    );
    expect(ita.totals.used[TUNGSTEN]).toBe(1);
  });

  test("lines take resources in order", async () => {
    const { econ, ce } = await game(["DEU"]);
    const deu = ce("DEU");
    expect(addLine(econ, deu, "infantry_equipment", 1, 8)).toBeNull();
    expect(addLine(econ, deu, "infantry_equipment", 1, 8)).toBeNull();
    const [top, bottom] = deu.lines;
    // Ten steel a day for two lines that need eight each (pre-flight S8).
    const t = deu.totals;
    t.mil = 16;
    t.produced = new Array<number>(RESOURCE_COUNT).fill(0);
    t.produced[STEEL] = 10;
    t.exported = new Array<number>(RESOURCE_COUNT).fill(0);
    t.imported = new Array<number>(RESOURCE_COUNT).fill(0);
    stepProduction(econ, deu);
    expect(top.fill).toBe(1000);
    expect(bottom.fill).toBe(250);
    expect(t.used[STEEL]).toBe(10);
    expect(top.lastOutput).toBe(lineOutputMilli(8, 1000, outputPct(deu), 1000));
    expect(bottom.lastOutput).toBe(
      lineOutputMilli(8, 1000, outputPct(deu), 250),
    );
    // Moving the bottom line up gives it the steel first.
    expect(moveLine(econ, deu, bottom.id, 0)).toBeNull();
    expect(deu.lines).toEqual([bottom, top]);
    stepProduction(econ, deu);
    expect(bottom.fill).toBe(1000);
    expect(top.fill).toBe(250);
    // Exports leave less, imports more.
    t.exported[STEEL] = 8;
    t.imported[STEEL] = 4;
    stepProduction(econ, deu);
    expect(bottom.fill).toBe(750);
    expect(top.fill).toBe(0);
    expect(t.used[STEEL]).toBe(6);
  });

  test("switching keeps 80/50/30% and resets progress", async () => {
    const { econ, ce } = await game(["DEU"]);
    const deu = ce("DEU");
    deu.addTech("inf_eq_2");
    expect(addLine(econ, deu, "infantry_equipment", 1, 6)).toBeNull();
    const line = deu.lines[0];
    const from = (eff: number) => {
      line.key = equipKey("infantry_equipment", 1);
      line.effBp = eff;
      line.progress = 300;
    };
    from(5000);
    expect(changeLine(econ, deu, line.id, "infantry_equipment", 2)).toBeNull();
    expect(line.effBp).toBe(4000);
    expect(line.key).toBe(equipKey("infantry_equipment", 2));
    expect(line.progress).toBe(0);
    from(5000);
    expect(changeLine(econ, deu, line.id, "support_equipment", 1)).toBeNull();
    expect(line.effBp).toBe(2500);
    expect(line.progress).toBe(0);
    from(5000);
    expect(changeLine(econ, deu, line.id, "artillery", 1)).toBeNull();
    expect(line.effBp).toBe(1500);
    expect(line.key).toBe(equipKey("artillery", 1));
    // Never below the floor.
    from(1200);
    expect(changeLine(econ, deu, line.id, "light_tank", 1)).toBeNull();
    expect(line.effBp).toBe(1000);
    // The same equipment and generation: nothing happens.
    from(5000);
    expect(changeLine(econ, deu, line.id, "infantry_equipment", 1)).toBeNull();
    expect(line.effBp).toBe(5000);
    expect(line.progress).toBe(300);
    // flexible_line keeps ten points more.
    deu.addTech("flexible_line");
    from(5000);
    expect(changeLine(econ, deu, line.id, "artillery", 1)).toBeNull();
    expect(line.effBp).toBe(2000);
  });

  test("a generation needs its tech", async () => {
    const { econ, ce, order } = await game(["DEU"]);
    const deu = ce("DEU");
    expect(deu.researched.has("inf_eq_2")).toBe(false);
    expect(addLine(econ, deu, "infantry_equipment", 2, 1)).toBe("no_tech");
    expect(addLine(econ, deu, "medium_tank", 1, 1)).toBe("no_tech");
    expect(addLine(econ, deu, "motorized", 2, 1)).toBe("no_tech");
    // Refused orders change nothing.
    order("DEU", {
      kind: "add_line",
      equipment: "infantry_equipment",
      gen: 2,
      factories: 1,
    });
    expect(deu.lines).toEqual([]);
    expect(addLine(econ, deu, "infantry_equipment", 1, 1)).toBeNull();
    const id = deu.lines[0].id;
    expect(changeLine(econ, deu, id, "infantry_equipment", 2)).toBe("no_tech");
    expect(deu.lines[0].key).toBe(equipKey("infantry_equipment", 1));
    deu.addTech("inf_eq_2");
    expect(addLine(econ, deu, "infantry_equipment", 2, 1)).toBeNull();
    expect(deu.lines[1]).toMatchObject({
      id: id + 1,
      key: equipKey("infantry_equipment", 2),
      effBp: 1000,
    });
  });

  test("line orders check their line and their limits", async () => {
    const { econ, ce } = await game(["DEU"]);
    const deu = ce("DEU");
    // Ids go on from the starting lines' (taken back by game()).
    const first = deu.nextLineId;
    for (let i = 0; i < WW_MAX_LINES; i++) {
      expect(addLine(econ, deu, "infantry_equipment", 1, i)).toBeNull();
    }
    expect(addLine(econ, deu, "infantry_equipment", 1, 1)).toBe("lines_full");
    const ids = deu.lines.map((l) => l.id);
    expect(ids).toEqual(
      Array.from({ length: WW_MAX_LINES }, (_, i) => first + i),
    );
    const missing = 999;
    expect(changeLine(econ, deu, missing, "artillery", 1)).toBe("bad_line");
    expect(setLineFactories(econ, deu, missing, 3)).toBe("bad_line");
    expect(removeLine(econ, deu, missing)).toBe("bad_line");
    expect(moveLine(econ, deu, missing, 0)).toBe("bad_line");
    expect(moveLine(econ, deu, first, WW_MAX_LINES)).toBe("bad_index");
    expect(moveLine(econ, deu, first, WW_MAX_LINES - 1)).toBeNull();
    expect(deu.lines.map((l) => l.id)).toEqual([...ids.slice(1), first]);
    expect(removeLine(econ, deu, first + 2)).toBeNull();
    expect(deu.lines.map((l) => l.id)).not.toContain(first + 2);
    // A removed line's id is never reused.
    expect(addLine(econ, deu, "artillery", 1, 2)).toBeNull();
    expect(deu.lines[WW_MAX_LINES - 1].id).toBe(first + WW_MAX_LINES);
  });

  test("a factory count that is no number gives none", async () => {
    // Direct callers (the AI) are not checked by the wire schema.
    expect(factoryCount(Number.NaN)).toBe(0);
    expect(factoryCount(-3)).toBe(0);
    expect(factoryCount(2.7)).toBe(2);
    expect(factoryCount(Number.POSITIVE_INFINITY)).toBe(WW_MAX_LINE_FACTORIES);
    const { econ, ce } = await game(["DEU"]);
    const deu = ce("DEU");
    expect(addLine(econ, deu, "infantry_equipment", 1, Number.NaN)).toBeNull();
    expect(deu.lines[0].factories).toBe(0);
    expect(setLineFactories(econ, deu, deu.lines[0].id, 4)).toBeNull();
    expect(setLineFactories(econ, deu, deu.lines[0].id, Number.NaN)).toBeNull();
    expect(deu.lines[0].factories).toBe(0);
    // And the day's production stays whole.
    stepProduction(econ, deu);
    expect(Number.isInteger(deu.totals.idleMil)).toBe(true);
    expect(deu.lines[0].active).toBe(0);
  });
});
