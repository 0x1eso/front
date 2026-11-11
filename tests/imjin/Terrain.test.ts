import {
  ImjinMapSchema,
  ScenarioRegionSchema,
} from "@openfront/engine-api/ww1936/ScenarioTypes";
import {
  edgeBetween,
  hasImjinTerrain,
  regionTerrain,
  seaFlagsAt,
  type ImjinMapLike,
} from "@openfront/engine-lib/imjin/Terrain";
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

// The built Imjin map (map-generator cmd/ww1936build imjin.go). Its owners
// (JOS, MIN, JUR) are the profile lane's tags, so the whole file is read
// raw here and only the Imjin parts go through their schemas.
const raw = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../resources/maps/imjin1592/scenario.json"),
    "utf8",
  ),
);

function mapOf(data: typeof raw): ImjinMapLike {
  const byId = new Map<number, (typeof raw.regions)[number]>(
    data.regions.map((r: { id: number }) => [r.id, r]),
  );
  const edges: { a: number; b: number; river: 0 | 1 | 2 }[] = data.edges.map(
    (e: number[]) => ({ a: e[0], b: e[1], river: e[4] }),
  );
  return {
    data,
    region: (id) => byId.get(id),
    edgeBetween: (a, b) =>
      edges.findIndex(
        (e) => (e.a === a && e.b === b) || (e.a === b && e.b === a),
      ),
    edge: (i) => edges[i],
  };
}

const map = mapOf(raw);
const idOf = (name: string): number =>
  raw.regions.find((r: { name: string }) => r.name === name).id;
const tileOf = (x: number, y: number) => y * raw.width + x;

describe("Imjin terrain data", () => {
  it("passes its schemas", () => {
    expect(() => ImjinMapSchema.parse(raw.imjin)).not.toThrow();
    for (const r of raw.regions) {
      expect(
        ScenarioRegionSchema.shape.imjinTerrain.parse(r.imjinTerrain),
      ).toBe(r.imjinTerrain);
    }
    expect(raw.wrapX).toBe(false);
  });

  it("reads region classes", () => {
    expect(hasImjinTerrain(map)).toBe(true);
    expect(regionTerrain(map, idOf("Hanseong"))).toBe("walled");
    expect(regionTerrain(map, idOf("Joryeong"))).toBe("pass");
    expect(regionTerrain(map, idOf("Haengju"))).toBe("fortress");
    expect(regionTerrain(map, idOf("Gimje"))).toBe("paddy");
    expect(regionTerrain(map, 9999)).toBe("plain");
  });

  it("reads edges: fords, big rivers, none", () => {
    for (const [a, b] of raw.imjin.fords) {
      expect(edgeBetween(map, a, b)).toBe("ford");
      expect(edgeBetween(map, b, a)).toBe("ford");
    }
    const big = raw.edges.find(
      (e: number[]) =>
        e[4] === 2 &&
        !raw.imjin.fords.some((f: number[]) => f[0] === e[0] && f[1] === e[1]),
    );
    expect(edgeBetween(map, big[0], big[1])).toBe("great_river");
    const dry = raw.edges.find((e: number[]) => e[4] === 0);
    expect(edgeBetween(map, dry[0], dry[1])).toBe("none");
    expect(edgeBetween(map, idOf("Hanseong"), idOf("Kyoto"))).toBe("none");
  });

  it("reads sea flags: channels with their current, land without", () => {
    const channels = raw.imjin.labels.filter(
      (l: { kind: string }) => l.kind === "channel",
    );
    expect(channels.map((c: { name: string }) => c.name)).toEqual([
      "Myeongnyang",
      "Noryang",
      "Gyeonnaeryang",
    ]);
    channels.forEach((c: { x: number; y: number; dir: number }, k: number) => {
      const f = seaFlagsAt(map, tileOf(c.x, c.y));
      expect(f.channel).toBe(true);
      expect(f.coastal).toBe(true);
      expect(f.current).toBe(k + 1);
      expect(f.currentDir).toBe(c.dir);
      expect(f.currentDir).toBeGreaterThanOrEqual(0);
      expect(f.currentDir).toBeLessThan(64);
    });
    const hanseong = raw.regions.find(
      (r: { name: string }) => r.name === "Hanseong",
    );
    const land = seaFlagsAt(
      map,
      tileOf(hanseong.vpTile[0], hanseong.vpTile[1]),
    );
    expect(land).toEqual({
      coastal: false,
      lee: false,
      channel: false,
      shoal: false,
      current: 0,
      currentDir: 0,
    });
    // The run-length data covers the whole map.
    let n = 0;
    for (let k = 0; k < raw.imjin.seaFlags.length; k += 2) {
      n += raw.imjin.seaFlags[k];
    }
    expect(n).toBe(raw.width * raw.height);
  });
});
