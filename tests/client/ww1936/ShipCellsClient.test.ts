// Ship designs as cells, the screens' side: a new line takes the cell's
// design and shows its name, the draft says why a design is blocked, the
// designer loads the cell's design, an old version shows with its ships,
// and the library keeps one entry a cell.
import type {
  DesignDef,
  WwDesignSlotData,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { render } from "lit";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, string | number>) =>
    params
      ? `[${key}] ${Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")}`
      : `[${key}]`,
}));

import { cellOf } from "../../../src/client/hud/ww1936/DesignLibrary";
import { cellTaken } from "../../../src/client/hud/ww1936/DesignLibraryStatus";
import { DesignerModel } from "../../../src/client/hud/ww1936/DesignerModel";
import {
  cellLineDesign,
  foreignLineDesigns,
  lineCards,
  navyCtx,
  type NavyGame,
  newLineOrder,
} from "../../../src/client/hud/ww1936/NavyModel";
import { renderDesignList } from "../../../src/client/hud/ww1936/WwDesignList";
import { saveLabel } from "../../../src/client/hud/ww1936/WwDesigner";
import { designerGame, saved } from "./DesignerFixture";
import { navyDetail, seaGame, SID } from "./SeaAirFixture";

const V1: DesignDef = {
  kind: "ship",
  base: "dd_2",
  modules: ["", "", "sec_aa", ""],
  name: "Version 1",
} as DesignDef;
const V2: DesignDef = { ...V1, name: "Version 2" };

const line = (design?: number) => ({
  id: 4,
  cls: "dd" as const,
  gen: 2,
  docks: 1,
  activeDocks: 1,
  progressMilli: 100,
  costMilli: 1000,
  left: 3,
  port: 6,
  nextName: 0,
  outputMilli: 10,
  fill: 1000,
  ...(design === undefined ? {} : { design }),
});

/** The sea game with a depth view: my designs and the treaty. */
function navyGame(
  designs: WwDesignSlotData[],
  member = false,
  lines = [line(2)],
) {
  const g = seaGame({ navy: navyDetail("GBR", { lines }) });
  const depth = {
    version: 1,
    treatyData: {
      members: member ? [SID("GBR")] : [],
      escalated: false,
      endDay: 0,
    },
    detail: () => ({ designs, projects: { done: 0 } }),
  };
  const game = { ...g.game, wwDepth: () => depth };
  return navyCtx(game as unknown as NavyGame)!;
}

describe("ship design cells in the screens", () => {
  it("a new line takes the cell's current design and sends it", () => {
    const ctx = navyGame([
      saved(V1, 1, { obsolete: true, inUse: 2 }),
      saved(V2, 2),
    ]);
    ctxTechs(ctx);
    const d = cellLineDesign(ctx, "dd", 2);
    expect(d?.slot).toBe(2);
    expect(d?.name).toBe("Version 2");
    expect(d?.block).toBeNull();
    expect(cellLineDesign(ctx, "dd", 3)).toBeNull();
    expect(cellLineDesign(ctx, "convoy", 1)).toBeNull();
    expect(newLineOrder("dd", 2, 6, 1, 3, d?.slot)).toMatchObject({
      kind: "naval_line_add",
      design: 2,
    });
    // No design: as before, no field.
    expect(newLineOrder("dd", 2, 6, 1, 3)).not.toHaveProperty("design");
    expect(newLineOrder("convoy", 1, 6, 1, 0, 2)).not.toHaveProperty("design");
  });

  it("the line rows show the design's name; a blocked design says why", () => {
    const ctx = navyGame([saved(V2, 2)]);
    expect(lineCards(ctx)[0].designName).toBe("Version 2");
    const none = navyGame([saved(V2, 2)], false, [line()]);
    expect(lineCards(none)[0].designName).toBeNull();
    const bb: DesignDef = {
      kind: "ship",
      base: "bb_2",
      modules: ["main_heavy", "", "", "", "", ""],
      name: "Big",
    } as DesignDef;
    const member = navyGame([saved(bb, 1)], true);
    ctxTechs(member);
    expect(cellLineDesign(member, "bb", 2)?.block).toBe("treaty_limit");
    const free = navyGame([saved(bb, 1)], false);
    ctxTechs(free);
    expect(cellLineDesign(free, "bb", 2)?.block).toBeNull();
  });

  it("a licensed design is a separate choice", () => {
    const ctx = navyGame([
      saved(V2, 1),
      saved({ ...V1, name: "Licensed" }, 3, { origin: "licensed" }),
      saved({ ...V1, name: "Captured" }, 4, { origin: "captured" }),
    ]);
    expect(foreignLineDesigns(ctx, "dd", 2).map((x) => x.name)).toEqual([
      "Licensed",
    ]);
    expect(cellLineDesign(ctx, "dd", 2)?.slot).toBe(1);
  });

  it("the designer opens a ship cell on its current design", () => {
    const m = new DesignerModel(
      designerGame({
        designs: [saved(V1, 1, { obsolete: true }), saved(V2, 2)],
      }),
    );
    m.open("ship");
    m.setBase("dd_2");
    expect(m.draft?.name).toBe("Version 2");
    m.setBase("dd_1");
    expect(m.draft?.name).toBe("@");
    expect(m.shipCellDesign("dd_2")?.slot).toBe(2);
  });

  it("a full ship pool saves only into a cell that can be rewritten", () => {
    const filler = (n: number): WwDesignSlotData =>
      saved(
        {
          kind: "ship",
          base: "ca_1",
          modules: ["", "", "", ""],
          name: `f${n}`,
        } as DesignDef,
        n,
      );
    const rows = [
      saved(V2, 1, { inUse: 0 }),
      ...Array.from({ length: 23 }, (_, i) => filler(i + 2)),
    ];
    const free = new DesignerModel(designerGame({ designs: rows }));
    free.open("ship");
    free.setBase("dd_2");
    expect(free.shipCellRewritable("dd_2")).toBe(true);
    expect(free.block()).toBeNull();
    const heldRows = [saved(V2, 1, { inUse: 3 }), ...rows.slice(1)];
    const held = new DesignerModel(designerGame({ designs: heldRows }));
    held.open("ship");
    held.setBase("dd_2");
    expect(held.shipCellRewritable("dd_2")).toBe(false);
    expect(held.block()).toBe("design_slots_full");
  });

  it("the save label says what a ship cell save does", () => {
    expect(saveLabel(true, false, false, true)).toBe(
      "ww1936.design.save_cell_ship",
    );
    expect(saveLabel(true, true, false, true)).toBe(
      "ww1936.design.save_cell_confirm_ship",
    );
    expect(saveLabel(false, false, false, true)).toBe("ww1936.design.save");
  });

  it("the design list marks an old version with the ships that hold it", () => {
    const rows = [saved(V1, 1, { obsolete: true, inUse: 4 }), saved(V2, 2)];
    const model = new DesignerModel(designerGame({ designs: rows }));
    const box = document.createElement("div");
    const makeLine = vi.fn();
    render(
      renderDesignList({
        model,
        armed: "",
        copy: () => undefined,
        retire: () => undefined,
        openLicences: () => undefined,
        licenceFrom: null,
        makeLine,
      }),
      box,
    );
    const old = box.querySelector('[data-ww-design-card="ship:1"]')!;
    expect(old.querySelector("[data-ww-old]")).not.toBeNull();
    expect(old.textContent).toContain("n=4");
    expect(old.querySelector("[data-ww-design-copy]")).toBeNull();
    expect(old.querySelector("[data-ww-design-line]")).toBeNull();
    expect(old.querySelector("[data-ww-design-retire]")).toBeNull();
    const cur = box.querySelector('[data-ww-design-card="ship:2"]')!;
    expect(cur.querySelector("[data-ww-design-copy]")).not.toBeNull();
    expect(cur.querySelector("[data-ww-design-retire]")).toBeNull();
    (cur.querySelector("[data-ww-design-line]") as HTMLElement).click();
    expect(makeLine).toHaveBeenCalledWith(expect.objectContaining({ slot: 2 }));
  });

  it("the library keeps one entry a cell for ships", () => {
    expect(cellOf({ type: "design", def: V1 })).toBe("ship|dd_2");
    expect(cellOf({ type: "design", def: { ...V1, base: "dd_3" } })).toBe(
      "ship|dd_3",
    );
    const game = designerGame({
      designs: [saved(V1, 1, { obsolete: true }), saved(V2, 2)],
    }) as never;
    expect(cellTaken(game, "ship|dd_2")).toBe(true);
    expect(cellTaken(game, "ship|dd_3")).toBe(false);
    const gone = designerGame({
      designs: [saved(V1, 1, { obsolete: true })],
    }) as never;
    expect(cellTaken(gone, "ship|dd_2")).toBe(false);
  });
});

/** The sea fixture's country has the techs of a 1936 start only; give the ctx the battleship's. */
function ctxTechs(ctx: ReturnType<typeof navyGame>): void {
  for (const t of ["dd_2", "bb_2"]) (ctx.techs as Set<string>).add(t);
}
