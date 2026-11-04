// ww71: the focus trees, events and decisions give each major's real
// equipment (a catalogue item), and nothing reads or grants a design while
// the designer is off.
import {
  equipKey,
  EQUIPMENT_TYPES,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import { WwEffectSchema } from "@openfront/engine-api/ww1936/PoliticsDsl";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import {
  HIST_CATALOGUE,
  histEntry,
} from "@openfront/engine-lib/ww1936/hist/index";
import {
  histOwn,
  histSlotOf,
  histStaticEntry,
} from "@openfront/engine-lib/ww1936/hist/Slots";
import type { HistCountry } from "@openfront/engine-lib/ww1936/hist/Types";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import {
  applyEffect,
  makeCtx,
} from "@openfront/engine/ww1936/politics/Dispatch";
import { allEffectLists, walkEffects } from "./contentUtil";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { HUMAN, step, stepTo, wwRunner } from "./util";

const MAJORS = Object.keys(HIST_CATALOGUE) as HistCountry[];
const isMajor = (t: string): t is HistCountry =>
  (MAJORS as string[]).includes(t);

/** Equipment effects with the country that owns the list (focus tree, or the tag an event or decision id starts with). */
function owned(): { where: string; tag: HistCountry; e: Effect }[] {
  const out: { where: string; tag: HistCountry; e: Effect }[] = [];
  const treeOf = new Map(CONTENT.focuses.map((f) => [`focus ${f.id}`, f.tree]));
  for (const [where, list] of allEffectLists()) {
    const tree = treeOf.get(where);
    const id = where.split(" ")[1].split(".")[0];
    const tag = (tree ?? id.split("_")[0]).toUpperCase();
    if (!isMajor(tag)) continue;
    walkEffects(list, (e) => {
      if (e.kind === "equipment" || e.kind === "send_equipment") {
        out.push({ where, tag, e });
      }
    });
  }
  return out;
}

describe("a major's rewards name its real equipment", () => {
  const rows = owned();

  it("finds the rewards of all seven majors", () => {
    for (const t of MAJORS) {
      expect(rows.some((r) => r.tag === t)).toBe(true);
    }
  });

  it("every one has an item when the catalogue has the equipment", () => {
    const bad: string[] = [];
    for (const { where, tag, e } of rows) {
      if (e.kind !== "equipment" && e.kind !== "send_equipment") continue;
      if (e.item !== undefined) continue;
      const gen = e.kind === "equipment" ? e.gen : 1;
      const stand = histStaticEntry(tag, e.type, gen);
      const planes = histOwn(tag, "plane").some(
        (p) => p.family === "plane" && p.type === e.type,
      );
      if (stand !== undefined || planes) bad.push(`${where}: ${e.type} ${gen}`);
    }
    expect(bad).toEqual([]);
  });

  it("every item is the country's own entry and fits the stock it replaces", () => {
    const bad: string[] = [];
    for (const { where, tag, e } of rows) {
      if (e.kind !== "equipment" && e.kind !== "send_equipment") continue;
      if (e.item === undefined) continue;
      const it = histEntry(e.item);
      if (it === undefined || it.country !== tag) {
        bad.push(`${where}: ${e.item} is not ${tag}'s`);
        continue;
      }
      if (it.family === "plane") {
        if (e.type !== it.type) bad.push(`${where}: ${e.item} is ${it.type}`);
      } else if (it.family === "tank") {
        if (e.type !== "light_tank" && e.type !== "medium_tank") {
          bad.push(`${where}: ${e.item} under ${e.type}`);
        }
      } else if (
        e.kind === "equipment" &&
        histStaticEntry(tag, e.type, e.gen)?.id !== e.item
      ) {
        // Rifles, trucks and guns are static stock: the item is the stand-in.
        bad.push(
          `${where}: ${e.item} is not the stand-in of ${e.type} ${e.gen}`,
        );
      } else if (
        e.kind === "send_equipment" &&
        histStaticEntry(tag, e.type, 1)?.id !== e.item
      ) {
        bad.push(`${where}: ${e.item} is not what ${e.type} reads as`);
      }
      expect(() => WwEffectSchema.parse(e)).not.toThrow();
    }
    expect(bad).toEqual([]);
  });
});

describe("no content leans on a design the player can no longer make", () => {
  it("a design_grant always comes with the item that replaces it", () => {
    for (const [where, list] of allEffectLists()) {
      let grant = false;
      let item = false;
      walkEffects(list, (e) => {
        if (e.kind === "design_grant") grant = true;
        if (e.kind === "equipment" && e.item !== undefined) item = true;
      });
      if (grant) expect([where, item]).toEqual([where, true]);
    }
  });

  it("no condition asks for a design", () => {
    const kinds = JSON.stringify(
      CONTENT.focuses.map((f) => [f.available, f.bypass, f.cancelIf, f.ai]),
    );
    expect(kinds).not.toMatch(/design/);
  });
});

describe("the reward gives the item", () => {
  beforeEach(() =>
    usePoliticsContent(
      depthFixture({ aiDesignPresets: CONTENT.aiDesignPresets }),
    ),
  );
  afterEach(() => usePoliticsContent(null));
  const DEU = DEEP.tag.DEU;

  async function game(designer: boolean) {
    const runner = await wwRunner(
      { ww1936Designer: designer },
      [{ clientID: HUMAN, country: "DEU" }],
      DEEP.map,
    );
    stepTo(runner, WW_PREP_TICKS + 2);
    return {
      runner,
      ww: runner.game.worldWar()!,
      d: runner.game.worldWar()!.depth,
    };
  }
  const give = (runner: GameRunner, e: Effect) =>
    applyEffect(
      makeCtx(
        runner.game.worldWar()!.politics,
        DEU,
        DEU,
        0,
        runner.game.ticks(),
      ),
      e,
    );

  it("designer off: units go to the item's own slot, opened even before its techs", async () => {
    const { runner, ww, d } = await game(false);
    const slot = histSlotOf("DEU", "deu_tiger1_e");
    expect(d.designSlot(DEU, "tank", slot)).toBeNull();
    give(runner, {
      kind: "equipment",
      type: "medium_tank",
      gen: 3,
      count: 40,
      item: "deu_tiger1_e",
    });
    expect(d.designSlot(DEU, "tank", slot)?.def.hist).toBe("deu_tiger1_e");
    const ce = ww.economy.country(DEU)!;
    expect(ce.stock[equipKey("tank_design", slot)]).toBe(40);
    expect(ce.stock[equipKey("medium_tank", 3)]).toBe(0);
    // A plane goes to the plane slots, a loss takes it back and stops at zero.
    const me = histSlotOf("DEU", "deu_me262_a1");
    give(runner, {
      kind: "equipment",
      type: "fighter",
      gen: 3,
      count: 15,
      item: "deu_me262_a1",
    });
    expect(ce.stock[equipKey("plane_design", me)]).toBe(15);
    give(runner, {
      kind: "equipment",
      type: "fighter",
      gen: 3,
      count: -99,
      item: "deu_me262_a1",
    });
    expect(ce.stock[equipKey("plane_design", me)]).toBe(0);
  });

  it("designer off: another country's item, or a gear item, falls back to the static stock", async () => {
    const { runner, ww } = await game(false);
    const ce = ww.economy.country(DEU)!;
    const before = ce.stock[equipKey("medium_tank", 1)];
    give(runner, {
      kind: "equipment",
      type: "medium_tank",
      gen: 1,
      count: 7,
      item: "usa_m4a1_sherman",
    });
    give(runner, {
      kind: "equipment",
      type: "infantry_equipment",
      gen: 1,
      count: 9,
      item: "deu_kar98k",
    });
    expect(ce.stock[equipKey("medium_tank", 1)]).toBe(before + 7);
    expect(ce.stock[equipKey("infantry_equipment", 1)]).toBeGreaterThanOrEqual(
      9,
    );
  });

  it("designer on: the item is ignored, the old stock is given", async () => {
    const { runner, ww, d } = await game(true);
    const ce = ww.economy.country(DEU)!;
    const slot = histSlotOf("DEU", "deu_tiger1_e");
    give(runner, {
      kind: "equipment",
      type: "medium_tank",
      gen: 3,
      count: 40,
      item: "deu_tiger1_e",
    });
    expect(ce.stock[equipKey("medium_tank", 3)]).toBe(40);
    expect(ce.stock[equipKey("tank_design", slot)]).toBe(0);
    give(runner, { kind: "design_grant", preset: "preset_heavy_2" });
    expect(d.country(DEU)!.des.tank.some((s) => s !== null)).toBe(true);
  });

  it("designer off: design_grant gives nothing", async () => {
    const { runner, d } = await game(false);
    const filled = d.country(DEU)!.des.tank.filter((s) => s !== null).length;
    give(runner, { kind: "design_grant", preset: "preset_heavy_2" });
    expect(d.country(DEU)!.des.tank.filter((s) => s !== null).length).toBe(
      filled,
    );
  });

  it("the catalogue entries are in their slots from the first tick", async () => {
    const runner = await wwRunner(
      { ww1936Designer: false },
      [{ clientID: HUMAN, country: "DEU" }],
      DEEP.map,
    );
    step(runner, 3);
    const ww = runner.game.worldWar()!;
    expect(ww.inPrep(runner.game.ticks())).toBe(true);
    const researched = ww.economy.country(DEU)!.researched;
    const own = histOwn("DEU", "tank");
    const open = own.findIndex((e) => e.techs.every((t) => researched.has(t)));
    expect(open).toBeGreaterThanOrEqual(0);
    expect(ww.depth.designSlot(DEU, "tank", open + 1)?.def.hist).toBe(
      own[open].id,
    );
  });

  it("every equipment type used exists", () => {
    for (const { e } of owned()) {
      if (e.kind === "equipment") expect(EQUIPMENT_TYPES).toContain(e.type);
    }
  });
});
