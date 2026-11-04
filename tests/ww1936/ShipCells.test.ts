// Ship designs as cells (ship class x generation): a human's save keeps
// one current own design per cell, never changes a ship in service, and
// moves the human's running lines to the new design. A human Britain on
// ww1936deep (London is the naval base).
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import { DESIGNER_POOL } from "@openfront/engine-api/ww1936/DepthTypes";
import { SHIP_CLASSES } from "@openfront/engine-api/ww1936/NavyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { copyDesignTo } from "@openfront/engine/ww1936/depth/DesignCopy";
import {
  dailyDesigns,
  navalLineCostMilli,
  navalLineDesignBlock,
  saveDesign,
} from "@openfront/engine/ww1936/depth/Designs";
import {
  issueNavalLineOrder,
  stepNavalLines,
} from "@openfront/engine/ww1936/economy/NavalLines";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { gameHash, HUMAN, step, stepTo, wwRestore, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

type Def = Extract<DepthOrder, { kind: "design_save" }>["def"];
const GBR = DEEP.tag.GBR;
const DEU = DEEP.tag.DEU;
const LONDON = DEEP.region.london;
const DD = SHIP_CLASSES.indexOf("dd");
const V1: Def = {
  kind: "ship",
  base: "dd_2",
  modules: ["", "", "sec_aa", ""],
  name: "Version 1",
};
const V2: Def = { ...V1, modules: ["", "", "", ""], name: "Version 2" };

async function game() {
  const runner = await wwRunner(
    {},
    [{ clientID: HUMAN, country: "GBR" }],
    DEEP.map,
  );
  stepTo(runner, WW_PREP_TICKS + 2);
  const ww = runner.game.worldWar()!;
  return {
    runner,
    ww,
    d: ww.depth,
    navy: ww.navy,
    ce: ww.economy.country(GBR)!,
  };
}
type G = Awaited<ReturnType<typeof game>>;

const save = (g: G, def: Def) =>
  g.d.issue(GBR, { kind: "design_save", def }, g.runner.game.ticks());

function addLine(g: G, cls: "dd" | "convoy", gen: number, design?: number) {
  expect(
    issueNavalLineOrder(
      g.ww.economy,
      g.ce,
      {
        kind: "naval_line_add",
        cls,
        gen,
        docks: 1,
        count: cls === "convoy" ? 0 : 5,
        port: LONDON,
        ...(design === undefined ? {} : { design }),
      },
      g.ww.scenario,
    ),
  ).toBeNull();
  return g.ce.navalLines[g.ce.navalLines.length - 1];
}

/** A ship of the design in a London fleet. */
function shipOf(g: G, design: number): number {
  const fid = g.navy.createFleet(GBR, LONDON, [["dd", 2, 1]]);
  const id = g.navy.fleets.get(fid)!.ships[0];
  g.navy.ships.design[g.navy.ships.rowOf(id)] = design;
  return id;
}

/** Launches one ship of the line now. */
function launch(g: G, line: ReturnType<typeof addLine>): number {
  const ships = () =>
    g.navy.fleetsOf(GBR).reduce((n, f) => n + f.ships.flat().length, 0);
  const n = ships();
  const cost = navalLineCostMilli(g.d, GBR, line);
  line.activeDocks = 1;
  line.fill = 1000;
  line.progress = cost - 1;
  stepNavalLines(g.ww.economy, g.ce, 0);
  expect(ships()).toBe(n + 1);
  const fleets = g.navy.fleetsOf(GBR);
  const all = fleets.flatMap((f) => [...f.ships]);
  return all[all.length - 1];
}

describe("ship design cells", () => {
  it("the first save takes a slot and the running lines of the cell follow it", async () => {
    const g = await game();
    const run = addLine(g, "dd", 2);
    const other = addLine(g, "dd", 1);
    const conv = addLine(g, "convoy", 1);
    expect(save(g, V1)).toBeNull();
    expect(g.d.country(GBR)!.des.ship[0]!.def.name).toBe("Version 1");
    expect([run.design, other.design, conv.design]).toEqual([1, 0, 0]);
    // A line on a foreign design is left alone.
    saveDesign(g.d, DEU, V1, 0, "own", 0, 0, 0);
    const lic = copyDesignTo(g.d, DEU, 1, "ship", GBR, "licensed")!;
    expect(lic).toBeGreaterThan(0);
    const foreign = addLine(g, "dd", 2);
    foreign.design = lic;
    expect(save(g, V2)).toBeNull();
    expect(foreign.design).toBe(lic);
    expect(run.design).toBe(1);
  });

  it("an unheld design is overwritten in place; the next ship has it", async () => {
    const g = await game();
    expect(save(g, V1)).toBeNull();
    const line = addLine(g, "dd", 2, 1);
    expect(save(g, V2)).toBeNull();
    const des = g.d.country(GBR)!.des.ship;
    expect(des.filter((s) => s !== null)).toHaveLength(1);
    expect(des[0]!.def.name).toBe("Version 2");
    expect(des[0]!.obsolete).toBe(false);
    expect(line.design).toBe(1);
    const ship = launch(g, line);
    expect(g.navy.ships.design[g.navy.ships.rowOf(ship)]).toBe(1);
  });

  it("a held design stays as it was: a new slot, the old one obsolete, then freed", async () => {
    const g = await game();
    expect(save(g, V1)).toBeNull();
    const line = addLine(g, "dd", 2, 1);
    const old = shipOf(g, 1);
    const row = g.navy.ships.rowOf(old);
    const before = JSON.stringify(g.navy.shipStatsOf(row));
    const costBefore = navalLineCostMilli(g.d, GBR, line);
    expect(save(g, V2)).toBeNull();
    const des = g.d.country(GBR)!.des.ship;
    expect(des[0]!.def.name).toBe("Version 1");
    expect(des[0]!.obsolete).toBe(true);
    expect(des[1]!.def.name).toBe("Version 2");
    expect(des[1]!.obsolete).toBe(false);
    // The ship in service keeps its design and its numbers.
    expect(g.navy.ships.design[row]).toBe(1);
    expect(JSON.stringify(g.navy.shipStatsOf(row))).toBe(before);
    // The line moved: the next ship is the new design, at its cost.
    expect(line.design).toBe(2);
    expect(navalLineCostMilli(g.d, GBR, line)).not.toBe(costBefore);
    const next = launch(g, line);
    expect(g.navy.ships.design[g.navy.ships.rowOf(next)]).toBe(2);
    expect(g.navy.ships.design[row]).toBe(1);
    // A third save overwrites version 2 only when no ship has it.
    expect(save(g, { ...V2, name: "Version 3" })).toBeNull();
    expect(g.d.country(GBR)!.des.ship[2]!.def.name).toBe("Version 3");
    // The old slot frees by the daily check once no ship holds it.
    const day = 10 + (GBR % 10);
    dailyDesigns(g.d, GBR, day);
    expect(g.d.country(GBR)!.des.ship[0]).not.toBeNull();
    g.navy.ships.design[row] = 0;
    dailyDesigns(g.d, GBR, day + 10);
    expect(g.d.country(GBR)!.des.ship[0]).toBeNull();
  });

  it("a line with progress in hand keeps the old design in its own slot but follows the new one", async () => {
    const g = await game();
    expect(save(g, V1)).toBeNull();
    const line = addLine(g, "dd", 2, 1);
    line.progress = 1234;
    expect(save(g, V2)).toBeNull();
    const des = g.d.country(GBR)!.des.ship;
    expect(des[0]!.obsolete).toBe(true);
    expect(line.design).toBe(2);
    expect(line.progress).toBe(1234);
  });

  it("a full pool refuses a save that needs a slot and changes nothing", async () => {
    const g = await game();
    expect(save(g, V1)).toBeNull();
    const line = addLine(g, "dd", 2, 1);
    shipOf(g, 1);
    const fill: Def = { kind: "ship", base: "ca_1", modules: [], name: "x" };
    let n = 0;
    while (saveDesign(g.d, GBR, fill, 0, "own", 0, 0, 0) === 1 + n + 1) n++;
    // ww61: the designer's own pool is the first DESIGNER_POOL.ship slots.
    expect(DESIGNER_POOL.ship).toBe(24);
    expect(n).toBeLessThanOrEqual(DESIGNER_POOL.ship);
    expect(
      g.d
        .country(GBR)!
        .des.ship.slice(0, DESIGNER_POOL.ship)
        .every((s) => s !== null),
    ).toBe(true);
    const snap = JSON.stringify(g.d.country(GBR)!.des.ship);
    expect(save(g, V2)).toBe("design_slots_full");
    expect(JSON.stringify(g.d.country(GBR)!.des.ship)).toBe(snap);
    expect(line.design).toBe(1);
  });

  it("a new line takes the design; the treaty check still applies", async () => {
    const g = await game();
    expect(save(g, V1)).toBeNull();
    expect(navalLineDesignBlock(g.d, GBR, DD, 2, 1)).toBeNull();
    expect(navalLineDesignBlock(g.d, GBR, DD, 3, 1)).toBe("bad_line");
    const line = addLine(g, "dd", 2, 1);
    expect(line.design).toBe(1);
    // An old version cannot start a line.
    shipOf(g, 1);
    expect(save(g, V2)).toBeNull();
    expect(navalLineDesignBlock(g.d, GBR, DD, 2, 1)).toBe("bad_line");
    expect(navalLineDesignBlock(g.d, GBR, DD, 2, 2)).toBeNull();
  });

  it("a restored game keeps the cell, the old version and the line", async () => {
    const g = await game();
    expect(save(g, V1)).toBeNull();
    const line = addLine(g, "dd", 2, 1);
    const ship = shipOf(g, 1);
    expect(save(g, V2)).toBeNull();
    step(g.runner, 15);
    const b = await wwRestore(
      g.runner,
      [{ clientID: HUMAN, country: "GBR" }],
      DEEP.map,
    );
    const w = b.game.worldWar()!;
    expect(JSON.stringify(w.depth.country(GBR)!.des)).toBe(
      JSON.stringify(g.d.country(GBR)!.des),
    );
    expect(w.economy.country(GBR)!.navalLines.map((l) => l.design)).toEqual([
      line.design,
    ]);
    expect(w.navy.ships.design[w.navy.ships.rowOf(ship)]).toBe(1);
    for (let i = 0; i < 30; i++) {
      step(g.runner);
      step(b);
      expect(gameHash(b), `tick ${i}`).toBe(gameHash(g.runner));
    }
  });
});
