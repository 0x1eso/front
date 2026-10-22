// World War 1936 P6 (plan Task 1 Step 19): the deep test map is the sea map
// plus the scenario v5 fields of the plan's table; v4 maps read them as 0.
import type { ReadonlyScenarioData } from "@openfront/engine-api/ww1936/ScenarioTypes";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import fs from "fs";
import path from "path";
import { DEEP } from "./deepFixture";

const dir = (name: string) => path.join(__dirname, "../testdata/maps", name);
const read = (name: string, file: string) =>
  fs.readFileSync(path.join(dir(name), file));
const json = (name: string) =>
  JSON.parse(read(name, "scenario.json").toString()) as ReadonlyScenarioData;
const index = (name: string) =>
  ScenarioIndex.fromFiles(
    json(name),
    new Uint8Array(read(name, "regions.bin")),
  );

describe("the deep test map", () => {
  it("the deep map is the sea map plus v5 fields", () => {
    for (const f of ["map.bin", "map4x.bin", "map16x.bin", "regions.bin"]) {
      expect(read("ww1936deep", f).equals(read("ww1936sea", f)), f).toBe(true);
    }
    const deep = json("ww1936deep");
    const sea = json("ww1936sea");
    expect(deep.version).toBe(5);
    // Sensitivity (decision 34): no Korean or Taiwanese region on the map.
    expect(JSON.stringify(deep)).not.toMatch(/korea|taiwan/i);
    const strip = (s: ReadonlyScenarioData) =>
      JSON.stringify({
        ...s,
        version: 0,
        regions: s.regions.map((r) => {
          const { coal, uranium, hydro, landmarks, dam, ...rest } =
            r as typeof r & Record<string, unknown>;
          void coal;
          void uranium;
          void hydro;
          void landmarks;
          void dam;
          return rest;
        }),
      });
    expect(strip(deep)).toBe(strip(sea));
    const sc = index("ww1936deep");
    for (const r of sc.landRegions) {
      expect(sc.coalOf(r.id), `${r.id}`).toBe(DEEP.coal[r.id] ?? 0);
      expect(sc.uraniumOf(r.id), `${r.id}`).toBe(DEEP.uranium[r.id] ?? 0);
      expect(sc.hydroOf(r.id), `${r.id}`).toBe(DEEP.hydro[r.id] ?? 0);
    }
    for (const [lm, region] of Object.entries(DEEP.landmarks)) {
      expect(sc.landmarkRegion.get(lm as never), lm).toBe(region);
    }
    for (const d of Object.values(DEEP.dam)) {
      expect(sc.damRegion[d.index]).toBe(d.region);
      expect(sc.damDownstream[d.index]).toEqual(d.downstream);
    }
    // The other seven dams are not on this map.
    expect(sc.damRegion.filter((r) => r > 0)).toHaveLength(2);
  });

  it("v4 maps read v5 fields as zero", () => {
    for (const name of ["ww1936sea", "ww1936mini"]) {
      const sc = index(name);
      for (const r of sc.landRegions) {
        expect(sc.coalOf(r.id)).toBe(0);
        expect(sc.uraniumOf(r.id)).toBe(0);
        expect(sc.hydroOf(r.id)).toBe(0);
        expect(sc.landmarksOf(r.id)).toEqual([]);
        expect(sc.damOf(r.id)).toBe(-1);
      }
      expect(sc.damRegion.every((r) => r === 0)).toBe(true);
    }
  });
});
