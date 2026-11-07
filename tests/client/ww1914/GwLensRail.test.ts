// @vitest-environment node
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GreatWarData,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import { decodeRegions } from "@openfront/engine-lib/ww1936/Regions";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  breadStep,
  industrial,
  lensCells,
  localStep,
  nationStep,
  orderStep,
  rumouredRung,
} from "../../../src/client/hud/ww1914/GwLensModel";
import {
  GW_RAILS,
  RailClock,
  pathOf,
  planSeen,
  railWay,
  running,
  share,
  weightOf,
} from "../../../src/client/hud/ww1914/GwRailModel";
import { OCC_HATCH } from "../../../src/client/render/gl/passes/OccupationPass";

const ROOT = path.resolve(__dirname, "../../..");
const dir = path.join(ROOT, "resources/maps/world1914");
const data1914 = JSON.parse(
  fs.readFileSync(path.join(dir, "scenario.json"), "utf8"),
);
const scenario = new ScenarioIndex(
  data1914,
  decodeRegions(
    new Uint8Array(fs.readFileSync(path.join(dir, "regions.bin"))),
    data1914.width,
    data1914.height,
  ),
);

interface SeatOver {
  tag?: GwTag;
  order?: number;
  bread?: number;
  unrest?: number;
  news?: { key: string; chapter: number; a: GwTag | null }[];
  mob?: Partial<Record<GwTag, number>>;
  plan?: "west" | "east" | "wait" | null;
  threads?: string[];
}

function view(
  over: SeatOver = {},
  date = "1914-07-12",
  held: Record<string, GwTag> = {},
  chapter = 2,
): { data: GreatWarData; seat: GwSeatView } {
  const seat = {
    smallID: 1,
    tag: over.tag ?? "AUH",
    gauges: {
      order: over.order ?? 5,
      bread: over.bread ?? 3,
      money: 2,
      morale: 3,
      shells: 2,
    },
    world: {
      unrest: over.unrest ?? 0,
      plan: over.plan ?? null,
      threads: over.threads ?? [],
      news: (over.news ?? []).map((n) => ({
        ...n,
        b: null,
        theatre: null,
      })),
      countries: (["DEU", "FRA", "RUS", "AUH", "GBR"] as GwTag[]).map(
        (tag) => ({
          tag,
          side: null,
          out: false,
          mob: over.mob?.[tag] ?? 0,
        }),
      ),
      gauges: [],
    },
    prologue: null,
  } as unknown as GwSeatView;
  const data = {
    calendar: "full",
    chapter,
    stage: "crisis",
    date,
    seats: [seat],
    held,
    landMoves: [],
  } as unknown as GreatWarData;
  return { data, seat };
}

const regionOf = (nameKo: string) =>
  data1914.regions.find((r: { nameKo: string }) => r.nameKo === nameKo);

describe("the unrest lens", () => {
  test("steps follow the gauges, a city goes first, a farm last", () => {
    expect(orderStep(5)).toBe(0);
    expect(orderStep(3)).toBe(1);
    expect(orderStep(0)).toBe(4);
    expect(breadStep(3)).toBe(0);
    expect(breadStep(0)).toBe(4);
    const berlin = regionOf("베를린");
    const farm = data1914.regions.find(
      (r: { cat: string; civ: number; mil: number; gwOwner: string }) =>
        r.gwOwner === "DEU" && r.cat === "pastoral" && r.civ + r.mil === 0,
    );
    expect(industrial(berlin)).toBe(true);
    expect(localStep(2, berlin, "strikes")).toBe(3);
    expect(localStep(2, farm, "strikes")).toBe(1);
    expect(localStep(0, berlin, "strikes")).toBe(0);
    expect(localStep(2, berlin, "bread")).toBe(3);
    expect(localStep(2, farm, "bread")).toBe(1);
  });

  test("it paints only the seat's own home, and a lost place changes hands", () => {
    const v = view({ tag: "DEU", order: 2 });
    const cells = lensCells("strikes", v.data, v.seat, scenario);
    const ids = new Set(cells.map((c) => c.region));
    expect(ids.has(regionOf("베를린").id)).toBe(true);
    expect(ids.has(regionOf("파리").id)).toBe(false);
    // Nothing of Germany's colonies or the far side of the world.
    expect(ids.size).toBeLessThan(80);
    const lost = view({ tag: "DEU", order: 2 }, "1914-09-01", { lille: "DEU" });
    const lilleId = regionOf("릴").id;
    const after = lensCells("strikes", lost.data, lost.seat, scenario);
    expect(after.some((c) => c.region === lilleId)).toBe(true);
    expect(cells.some((c) => c.region === lilleId)).toBe(false);
  });

  test("nationalities colour the restive lands only, hotter as order falls", () => {
    const calm = view({ tag: "AUH", order: 5 });
    const hot = view({ tag: "AUH", order: 1, unrest: 2 });
    const a = lensCells("nations", calm.data, calm.seat, scenario);
    const b = lensCells("nations", hot.data, hot.seat, scenario);
    const sarajevo = regionOf("사라예보").id;
    const vienna = regionOf("빈").id;
    expect(a.some((c) => c.region === vienna)).toBe(false);
    const stepOf = (cells: typeof a, id: number) =>
      cells.find((c) => c.region === id)!.level;
    expect(stepOf(b, sarajevo)).toBeGreaterThan(stepOf(a, sarajevo));
    // France has no such table: nothing is painted.
    const fra = view({ tag: "FRA", order: 0 });
    expect(lensCells("nations", fra.data, fra.seat, scenario)).toEqual([]);
    expect(nationStep(0, 3)).toBe(2);
  });

  test("Ireland is Britain's, and the thread makes it hotter", () => {
    const plain = view({ tag: "GBR", order: 4 });
    const thread = view({ tag: "GBR", order: 4, threads: ["ireland"] });
    const dublin = regionOf("더블린").id;
    const step = (v: typeof plain) =>
      lensCells("nations", v.data, v.seat, scenario).find(
        (c) => c.region === dublin,
      )!.level;
    expect(step(thread)).toBeGreaterThan(step(plain));
  });

  test("rumour shows only what the papers printed, hatched, and never the seat's own", () => {
    const quiet = view({ tag: "DEU" });
    expect(lensCells("rumour", quiet.data, quiet.seat, scenario)).toEqual([]);
    const v = view({
      tag: "DEU",
      news: [
        { key: "unrest_2", chapter: 1, a: "RUS" },
        { key: "unrest_3", chapter: 0, a: "DEU" },
      ],
    });
    const cells = lensCells("rumour", v.data, v.seat, scenario);
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.every((c) => (c.flags & OCC_HATCH) !== 0)).toBe(true);
    expect(cells.some((c) => c.region === regionOf("베를린").id)).toBe(false);
    expect(cells.some((c) => c.region === regionOf("모스크바").id)).toBe(true);
    expect(rumouredRung(v.data, v.seat, "RUS")).toBe(2);
    // Old news is forgotten.
    const late = view(
      { tag: "DEU", news: [{ key: "unrest_2", chapter: 1, a: "RUS" }] },
      "1915-01-01",
      {},
      20,
    );
    expect(rumouredRung(late.data, late.seat, "RUS")).toBe(0);
  });
});

describe("mobilisation by rail", () => {
  test("every route has a road on the real map, and the road ends at its frontier", () => {
    for (const row of GW_RAILS) {
      for (const route of row.routes) {
        const p = pathOf(scenario, route);
        expect(p.pts.length, route.id).toBeGreaterThanOrEqual(2);
        expect(p.length, route.id).toBeGreaterThan(5);
      }
    }
    // The Belgian road starts where the northern one ends.
    const north = GW_RAILS[0].routes.find((r) => r.id === "deu_north")!;
    const belgium = GW_RAILS[0].routes.find((r) => r.id === "deu_belgium")!;
    const a = pathOf(scenario, north).pts;
    const b = pathOf(scenario, belgium).pts;
    expect(a[a.length - 1]).toEqual(b[0]);
  });

  test("the road prefers rail, and the sea is a dashed hop", () => {
    const way = railWay(scenario, regionOf("베를린").id, regionOf("쾰른").id)!;
    expect(way[0]).toBe(regionOf("베를린").id);
    expect(way[way.length - 1]).toBe(regionOf("쾰른").id);
    const bef = GW_RAILS.find((r) => r.tag === "GBR")!.routes[0];
    expect(pathOf(scenario, bef).sea.size).toBeGreaterThan(0);
  });

  test("the days are the chapters' own dates, a partial order counting half", () => {
    const clock = new RailClock();
    const first = view({ mob: { RUS: 1 } }, "1914-07-19");
    clock.observe(first.data, first.seat);
    expect(clock.elapsed("RUS", "1914-07-19")).toBe(0);
    expect(clock.elapsed("RUS", "1914-07-26")).toBe(3.5);
    const general = view({ mob: { RUS: 2 } }, "1914-07-26");
    clock.observe(general.data, general.seat);
    expect(clock.elapsed("RUS", "1914-07-26")).toBe(3.5);
    expect(clock.elapsed("RUS", "1914-08-02")).toBe(10.5);
    const rus = GW_RAILS.find((r) => r.tag === "RUS")!;
    expect(share(10.5, rus)).toBe(0.5);
    expect(share(99, rus)).toBe(1);
    // A country that has not mobilised has no trains.
    expect(running(general.seat).map((x) => x.row.tag)).toEqual(["RUS"]);
    expect(clock.elapsed("FRA", "1914-08-02")).toBe(0);
  });

  test("Germany's road through Belgium follows the plan; a foreign seat sees it late", () => {
    const belgium = GW_RAILS[0].routes.find((r) => r.id === "deu_belgium")!;
    expect(weightOf(belgium, null)).toBe(1);
    expect(weightOf(belgium, "west")).toBe(2);
    expect(weightOf(belgium, "wait")).toBe(0);
    expect(weightOf(belgium, "east")).toBe(0);
    const mine = view({ tag: "DEU", plan: "west", mob: { DEU: 2 } });
    expect(planSeen(mine.data, mine.seat)).toBe("west");
    const foreign = view({ tag: "FRA", plan: "west", mob: { DEU: 1 } });
    expect(planSeen(foreign.data, foreign.seat)).toBeNull();
  });
});
