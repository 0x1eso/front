// World War 1936 P5 (plan decision 31): the end test map is the pol map
// plus Kosice (region 20, Czechoslovakia) east of Slovakia.
import { SEA_ZONE_BASE } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { decodeRegions } from "@openfront/engine-lib/ww1936/Regions";
import fs from "fs";
import path from "path";
import { END, endId } from "./endFixture";

const dir = (name: string) => path.join(__dirname, "../testdata/maps", name);
const read = (name: string, file: string) =>
  fs.readFileSync(path.join(dir(name), file));
const scenario = (name: string) =>
  JSON.parse(read(name, "scenario.json").toString("utf8")) as {
    width: number;
    height: number;
    regions: { id: number; box?: unknown; vp: number; vpTile: number[] }[];
    edges: number[][];
    countries: unknown;
    kmPerTile: number;
    version: number;
  };

describe("World War 1936 P5: the end test map", () => {
  it("the end map adds Kosice next to Slovakia and changes nothing else", () => {
    const pol = scenario("ww1936pol");
    const end = scenario("ww1936end");
    // Regions 1–19, the countries, kmPerTile and the version are the pol map's.
    expect(end.regions.filter((r) => r.id <= 19)).toEqual(pol.regions);
    expect(end.countries).toEqual(pol.countries);
    expect(end.kmPerTile).toBe(pol.kmPerTile);
    expect(end.version).toBe(pol.version);
    // Every tile is the pol map's, but Kosice's, which was sea there.
    const w = end.width;
    const h = end.height;
    const a = decodeRegions(read("ww1936pol", "regions.bin"), w, h);
    const b = decodeRegions(read("ww1936end", "regions.bin"), w, h);
    let kosice = 0;
    for (let i = 0; i < w * h; i++) {
      if (b[i] === 20) {
        kosice++;
        expect(a[i]).toBeGreaterThanOrEqual(SEA_ZONE_BASE);
        const x = i % w;
        const y = Math.floor(i / w);
        expect(x >= 115 && x < 122 && y >= 102 && y < 118).toBe(true);
      } else if (b[i] < SEA_ZONE_BASE) {
        expect(b[i]).toBe(a[i]);
      }
    }
    expect(kosice).toBe(7 * 16);
    // Kosice: 3 points at (118, 110); one more edge, 15–20.
    const r20 = end.regions.find((r) => r.id === 20)!;
    expect(r20.vp).toBe(3);
    expect(r20.vpTile).toEqual([118, 110]);
    expect(END.region.kosice).toBe(20);
    expect(END.owner[20]).toBe("CSK");
    expect(END.core[20]).toBe(true);
    const edges = (s: typeof end) =>
      s.edges.map(([x, y, border]) => `${x}-${y}:${border}`);
    expect(edges(end).filter((e) => !edges(pol).includes(e))).toEqual([
      "15-20:16",
    ]);
    expect(edges(pol).filter((e) => !edges(end).includes(e))).toEqual([]);
  });

  it("the players: the ten countries, then the 14 dormant slots", () => {
    expect(END.scenarioCount).toBe(10);
    expect(END.players).toBe(24);
    expect(endId("DEU")).toBe(1);
    expect(endId("CSK")).toBe(7);
    expect(endId("LTU")).toBe(10);
    expect(endId("SVK")).toBe(11);
    expect(endId("CW6")).toBe(24);
    // Czechoslovakia's points: Sudetenland, Prague, Slovakia, Kosice.
    expect([13, 14, 15, 20].reduce((s, r) => s + END.vp[r], 0)).toBe(23);
    expect(END.capital.CSK).toBe(14);
    expect(END.capital.SVK).toBe(0);
  });
});
