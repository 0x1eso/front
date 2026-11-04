// Plane design reform, phase 2: one design per cell (plane type x airframe)
// — the score, the old rule, saving and absorbing the static planes (stock,
// wings out on a mission, decks, lines), the draw order, the generation swap
// and the slot pool. A human Britain at war with a human Italy on ww1936deep.
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import {
  AIR_TYPES,
  WING_UPGRADE_PER_REARM,
} from "@openfront/engine-api/ww1936/AirTypes";
import {
  DESIGNER_POOL,
  PLANE_BASES,
  type PlaneDesignStats,
  WW_PLANE_DESIGN_SLOTS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  equipKey,
  EQUIPMENT_GENS,
  WW_TECH_IDS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  planeType,
  recommendedPlane,
} from "@openfront/engine-lib/ww1936/DesignRules";
import {
  staticPartnerOfCell,
  staticPlaneScore,
} from "@openfront/engine-lib/ww1936/PlaneScore";
import { isOldScore } from "@openfront/engine-lib/ww1936/TemplateStats";
import type { GameRunner } from "@openfront/engine/GameRunner";
import {
  planeDesignIsOld,
  planeRankOf,
  planeSources,
} from "@openfront/engine/ww1936/air/DesignPlanes";
import { rearmWing } from "@openfront/engine/ww1936/air/Wings";
import { designHeld } from "@openfront/engine/ww1936/depth/Designs";
import { sweepStaticPlanes } from "@openfront/engine/ww1936/depth/PlaneCells";
import { addLine } from "@openfront/engine/ww1936/economy/Production";
import { fillDecks } from "@openfront/engine/ww1936/navy/Carriers";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import "./oldAirModel";
import { clearStartSetup, gameHash, stepTo, wwRestore, wwRunner } from "./util";
import { giveWing } from "./wingUtil";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const GBR = DEEP.tag.GBR;
const ITA = DEEP.tag.ITA;
const LONDON = DEEP.region.london;
const ALL = new Set(WW_TECH_IDS);
type Def = Extract<DepthOrder, { kind: "design_save" }>["def"];

async function game() {
  const runner = await wwRunner(
    {},
    [
      { clientID: "HUMANGBR", country: "GBR" },
      { clientID: "HUMANITA", country: "ITA" },
    ],
    DEEP.map,
  );
  stepTo(runner, WW_PREP_TICKS + 2);
  const ww = runner.game.worldWar()!;
  ww.setWar(GBR, ITA, runner.game.ticks());
  const ce = ww.economy.country(GBR)!;
  for (const t of WW_TECH_IDS) ce.addTech(t);
  // Only the planes a test puts there.
  for (const t of AIR_TYPES) {
    for (let g = 1; g <= EQUIPMENT_GENS[t]; g++) ce.stock[equipKey(t, g)] = 0;
  }
  return { runner, ww, d: ww.depth, ce };
}
type G = Awaited<ReturnType<typeof game>>;

const fit = (base: string, type?: string, name = base): Def =>
  ({ ...recommendedPlane(base, ALL, type), name }) as Def;
const save = (g: G, def: Def, slot?: number) =>
  g.d.issue(
    GBR,
    { kind: "design_save", def, ...(slot === undefined ? {} : { slot }) },
    g.runner.game.ticks(),
  );
const stats = (g: G, slot: number) =>
  g.d.designStatsOf(GBR, "plane", slot) as PlaneDesignStats;
const dkey = (slot: number) => equipKey("plane_design", slot);
/** A fighter design with a weaker weapon: the same cell as `fit`, a different design. */
const weak = (base: string, name: string): Def =>
  ({ ...fit(base, "fighter", name), modules: ["w_mg2", "", "", ""] }) as Def;

describe("plane score and the old rule", () => {
  it("static planes rise with their generation, and so do base-fit designs along an airframe line", async () => {
    const g = await game();
    for (const t of AIR_TYPES) {
      for (let k = 2; k <= EQUIPMENT_GENS[t]; k++) {
        expect(staticPlaneScore(t, k)).toBeGreaterThan(
          staticPlaneScore(t, k - 1),
        );
      }
    }
    const lines = [
      ["small_1", "small_2", "small_3"],
      ["medium_1", "medium_2", "medium_3"],
      ["large_1", "large_2", "large_3"],
    ];
    const rows: string[] = [];
    for (const line of lines) {
      let prev = 0;
      for (const base of line) {
        expect(save(g, fit(base))).toBeNull();
      }
      for (const base of line) {
        const slot =
          g.d.country(GBR)!.des.plane.findIndex((s) => s?.def.base === base) +
          1;
        const st = stats(g, slot);
        const sc = planeRankOf(g.d, GBR, st.type);
        const i = sc.sources.findIndex((x) => x.slot === slot);
        rows.push(`${base} ${st.type} ${sc.scores[i]}`);
        expect(sc.scores[i]).toBeGreaterThan(prev);
        prev = sc.scores[i];
      }
    }
    for (const t of AIR_TYPES) {
      rows.push(
        `static ${t} ${Array.from({ length: EQUIPMENT_GENS[t] }, (_, i) => staticPlaneScore(t, i + 1)).join(" ")}`,
      );
    }
    if (process.env.PLANE_TABLE) console.log(rows.join("\n"));
  }, 120_000);

  it("is old exactly when more than 15 % below the best of its type", () => {
    expect(isOldScore(85, 100)).toBe(false);
    expect(isOldScore(84, 100)).toBe(true);
  });

  it("a static generation is old once a newer one is researched, per plane type", async () => {
    const g = await game();
    const rank = planeRankOf(g.d, GBR, "fighter");
    expect(rank.sources.map((x) => x.gen)).toEqual([3, 2, 1]);
    expect(rank.old).toEqual([false, true, true]);
    // A country without the third generation: generation 2 is the best.
    const ita = planeRankOf(g.d, ITA, "bomber");
    expect(ita.sources.length).toBe(2);
  });
});

describe("the cell map", () => {
  it("maps airframe and type to the static plane, none where there is none", () => {
    expect(staticPartnerOfCell("fighter", "small_2")).toEqual({
      type: "fighter",
      gen: 2,
    });
    expect(staticPartnerOfCell("cv_cas", "small_3")).toEqual({
      type: "cv_cas",
      gen: 3,
    });
    expect(staticPartnerOfCell("heavy_fighter", "medium_3")).toEqual({
      type: "heavy_fighter",
      gen: 3,
    });
    expect(staticPartnerOfCell("bomber", "medium_2")?.gen).toBe(2);
    expect(staticPartnerOfCell("bomber", "medium_3")).toBeNull();
    expect(staticPartnerOfCell("transport_plane", "medium_1")?.gen).toBe(1);
    expect(staticPartnerOfCell("transport_plane", "medium_2")).toBeNull();
    expect(staticPartnerOfCell("strat_bomber", "large_3")?.gen).toBe(3);
    expect(staticPartnerOfCell("naval_bomber", "medium_1")).toBeNull();
    expect(staticPartnerOfCell("fighter", "jet_1")).toBeNull();
    expect(PLANE_BASES.length).toBe(12);
  });
});

describe("saving into a cell", () => {
  it("overwrites in place: stock, wings (one out on a mission) and a line follow, count conserved", async () => {
    const g = await game();
    const { ww, ce } = g;
    expect(save(g, fit("small_2", "fighter", "A"))).toBeNull();
    ce.stock[dkey(1)] = 40;
    const w = giveWing(ww.air, {
      owner: GBR,
      type: "fighter",
      counts: [0, 0, 0],
      base: LONDON,
    });
    w.dcounts[0] = 25;
    ce.planesDeployed[dkey(1)] = 25;
    w.phase = 1; // in the air
    clearStartSetup(ww.economy, ce);
    expect(addLine(ww.economy, ce, "plane_design", 1, 5)).toBeNull();
    const before = stats(g, 1);
    expect(save(g, weak("small_2", "B"), 9)).toBeNull(); // the slot asked for is ignored
    expect(g.d.country(GBR)!.des.plane.filter((s) => s !== null).length).toBe(
      1,
    );
    expect(stats(g, 1).airAttack).toBeLessThan(before.airAttack);
    expect(ce.stock[dkey(1)]).toBe(40);
    expect(w.dcounts[0]).toBe(25);
    expect(ce.planesDeployed[dkey(1)]).toBe(25);
    expect(ce.lines.some((l) => l.key === dkey(1))).toBe(true);
  }, 120_000);

  it("the first save absorbs the static planes: stock, a wing out on a mission, a deck and a line; foreign designs stay", async () => {
    const g = await game();
    const { ww, ce, d } = g;
    const st1 = equipKey("fighter", 2);
    const other = equipKey("fighter", 3);
    ce.stock[st1] = 60;
    ce.stock[other] = 11;
    const w = giveWing(ww.air, {
      owner: GBR,
      type: "fighter",
      counts: [0, 30, 0],
      base: LONDON,
    });
    ce.planesDeployed[st1] = 30;
    w.phase = 1;
    const cv = equipKey("cv_fighter", 2);
    ce.stock[cv] = 0;
    // A deck with static carrier fighters of generation 2.
    const navy = ww.navy;
    const fid = navy.createFleet(GBR, LONDON, [["cv", 1, 1]]);
    const row = navy.ships.rowOf(navy.fleets.get(fid)!.ships[0]);
    navy.ships.deckOf(row)[0 * 3 + 1] = 9;
    ce.planesDeployed[cv] = 9;
    clearStartSetup(ww.economy, ce);
    expect(addLine(ww.economy, ce, "fighter", 2, 5)).toBeNull();
    // A foreign (captured) design in its own slot is never touched.
    const foreign = fit("small_2", "fighter", "F");
    expect(
      d.country(GBR) !== null &&
        (d.country(GBR)!.des.plane[5] = {
          def: foreign as never,
          origin: "captured",
          from: ITA,
          fromSlot: 1,
          obsolete: false,
          savedDay: 0,
        }),
    ).toBeTruthy();
    expect(save(g, fit("small_2", "fighter", "A"))).toBeNull();
    const slot =
      d.country(GBR)!.des.plane.findIndex((s) => s?.origin === "own") + 1;
    expect(slot).toBe(1);
    expect(ce.stock[st1]).toBe(0);
    expect(ce.stock[dkey(1)]).toBe(60);
    expect(ce.stock[other]).toBe(11); // another generation: not this cell
    expect(w.counts[1]).toBe(0);
    expect(w.dcounts[0]).toBe(30);
    expect(ce.planesDeployed[dkey(1)]).toBe(30);
    expect(ce.planesDeployed[st1]).toBe(0);
    expect(ce.lines.some((l) => l.key === dkey(1))).toBe(true);
    expect(ce.lines.some((l) => l.key === st1)).toBe(false);
    // The carrier form is its own cell: a cv_fighter design absorbs the deck.
    const cvDef = {
      ...fit("small_2", "cv_fighter", "C"),
      modules: ["w_mg4", "", "", "m_carrier"],
    } as Def;
    expect(planeType(cvDef as never)).toBe("cv_fighter");
    expect(save(g, cvDef)).toBeNull();
    const cslot =
      d.country(GBR)!.des.plane.findIndex((s) => s?.def.name === "C") + 1;
    expect(navy.ships.deckOf(row)[1]).toBe(0);
    expect(navy.ships.deckDOf(row)[cslot - 1]).toBe(9);
    expect(ce.planesDeployed[dkey(cslot)]).toBe(9);
    // Late arrival: a static plane bought later joins in the daily sweep.
    ce.stock[st1] = 5;
    sweepStaticPlanes(d, GBR);
    expect(ce.stock[st1]).toBe(0);
    expect(ce.stock[dkey(1)]).toBe(65);
  }, 120_000);

  it("a full pool refuses a new cell, and the screen's reason is design_slots_full", async () => {
    const g = await game();
    const bases = [
      "small_1",
      "small_2",
      "small_3",
      "medium_1",
      "medium_2",
      "medium_3",
      "large_1",
      "large_2",
      "large_3",
    ];
    let n = 0;
    for (const b of bases) {
      expect(save(g, fit(b))).toBeNull();
      n++;
    }
    // Fill with foreign designs to the pool's size.
    const des = g.d.country(GBR)!.des.plane;
    // ww61: the array holds the catalogue's slots too; the designer's own
    // pool is the first DESIGNER_POOL.plane of them.
    const pool = DESIGNER_POOL.plane;
    expect(pool).toBe(28);
    expect(des.length).toBeGreaterThan(pool);
    for (let i = 0; i < pool; i++) {
      des[i] ??= {
        def: weak("small_1", "x") as never,
        origin: "received",
        from: ITA,
        fromSlot: 1,
        obsolete: false,
        savedDay: 0,
      };
    }
    expect(des.slice(0, pool).every((s) => s !== null)).toBe(true);
    expect(n).toBeLessThan(WW_PLANE_DESIGN_SLOTS + 1);
    expect(save(g, weak("small_3", "z"))).toBeNull(); // an existing cell: overwrite, no new slot
    expect(
      save(g, {
        ...fit("small_1", "cas", "n"),
        modules: ["w_mg4", "", "", ""].map((m, i) =>
          i === 1 ? "w_bombs_s" : m,
        ),
      } as Def),
    ).toBe("design_slots_full");
  }, 120_000);
});

describe("draw and swap", () => {
  it("the draw order is by score, and an old design frees its slot when nothing holds it", async () => {
    const g = await game();
    const { d, ce } = g;
    expect(save(g, weak("small_1", "old"))).toBeNull();
    expect(planeDesignIsOld(d, GBR, 1)).toBe(true);
    const src = planeSources(d, GBR, "fighter");
    expect(src[0]).toEqual({ gen: 3, slot: 0 });
    expect(src[src.length - 1].slot).toBe(1);
    expect(designHeld(d, GBR, "plane", 1)).toBe(false);
    ce.stock[dkey(1)] = 1;
    expect(designHeld(d, GBR, "plane", 1)).toBe(true);
  }, 120_000);

  it("a rearm swaps old planes for non-old stock at the replacement pace, conserved; non-old stays", async () => {
    const g = await game();
    const { ww, ce, runner } = g;
    expect(save(g, weak("small_1", "old"))).toBeNull();
    const newest = equipKey("fighter", 3);
    const w = giveWing(ww.air, {
      owner: GBR,
      type: "fighter",
      counts: [0, 0, 0],
      base: LONDON,
    });
    w.dcounts[0] = 150;
    ce.planesDeployed[dkey(1)] = 150;
    ce.stock[newest] = 20;
    rearmWing(ww.air, w, runner.game.ticks());
    expect(w.dcounts[0]).toBe(150 - WING_UPGRADE_PER_REARM);
    expect(w.counts[2]).toBe(WING_UPGRADE_PER_REARM);
    expect(ce.stock[dkey(1)]).toBe(WING_UPGRADE_PER_REARM);
    expect(ce.stock[newest]).toBe(20 - WING_UPGRADE_PER_REARM);
    expect(ce.planesDeployed[newest]).toBe(WING_UPGRADE_PER_REARM);
    // Nothing old in the wing: nothing moves.
    ce.stock[newest] = 0;
    ce.stock[dkey(1)] = 30;
    const w2 = giveWing(ww.air, {
      owner: GBR,
      type: "fighter",
      counts: [0, 0, 150],
      base: LONDON,
    });
    ce.planesDeployed[newest] += 150;
    const stock = [...ce.stock];
    rearmWing(ww.air, w2, runner.game.ticks());
    expect(w2.counts).toEqual([0, 0, 150]);
    expect(ce.stock).toEqual(stock);
  }, 120_000);

  it("a docked deck swaps its old planes at the same pace", async () => {
    const g = await game();
    const { ww, ce } = g;
    const def = {
      ...weak("small_1", "oldsea"),
      modules: ["w_mg2", "", "", "m_carrier"],
    } as Def;
    expect(save(g, def)).toBeNull();
    const slot = g.d.country(GBR)!.des.plane.findIndex((s) => s !== null) + 1;
    const navy = ww.navy;
    const fid = navy.createFleet(GBR, LONDON, [["cv", 1, 1]]);
    navy.fleets.get(fid)!.mix = [10, 0, 0];
    const row = navy.ships.rowOf(navy.fleets.get(fid)!.ships[0]);
    ce.stock[dkey(slot)] = 300;
    fillDecks(navy, GBR);
    const on = navy.ships.deckDOf(row)[slot - 1];
    expect(on).toBeGreaterThan(0);
    ce.stock[equipKey("cv_fighter", 3)] = 50;
    const total = () =>
      navy.ships.deckOf(row)[2] + navy.ships.deckDOf(row)[slot - 1];
    const t0 = total();
    fillDecks(navy, GBR);
    expect(navy.ships.deckOf(row)[2]).toBe(WING_UPGRADE_PER_REARM);
    expect(total()).toBe(t0);
  }, 120_000);

  it("a snapshot taken mid-swap restores to the same hash", async () => {
    const g = await game();
    const { ww, ce, runner } = g;
    expect(save(g, weak("small_1", "old"))).toBeNull();
    const w = giveWing(ww.air, {
      owner: GBR,
      type: "fighter",
      counts: [0, 0, 0],
      base: LONDON,
    });
    w.dcounts[0] = 50;
    ce.planesDeployed[dkey(1)] = 50;
    ce.stock[equipKey("fighter", 3)] = 20;
    rearmWing(ww.air, w, runner.game.ticks());
    const h = gameHash(runner);
    const copy = await wwRestore(
      runner,
      [
        { clientID: "HUMANGBR", country: "GBR" },
        { clientID: "HUMANITA", country: "ITA" },
      ],
      DEEP.map,
    );
    expect(gameHash(copy)).toBe(h);
  }, 120_000);
});

export type { GameRunner, WorldWar };
