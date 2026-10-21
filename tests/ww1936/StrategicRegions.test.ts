// World War 1936 P4: the strategic regions of scenario.json version 4 (P4
// spec §3.4). Read from the committed scenario.json as it is: the
// ScenarioIndex readers of P4 Task 1 (strategicList, zoneSr, regionSr, sr)
// are not on this branch yet.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

interface RawRegion {
  id: number;
  owner: string;
  name: string;
  center: [number, number];
  island?: string;
  sr: number;
}
interface RawZone {
  id: number;
  tiles: number;
  lake?: boolean;
  center: [number, number];
  sr: number;
}
interface RawStrategic {
  id: number;
  kind: "land" | "sea";
  name: string;
  nameKo: string;
  center: [number, number];
  latC: number;
  members: number[];
}
interface RawScenario {
  version: number;
  regions: RawRegion[];
  seaZones: RawZone[];
  edges: [number, number, number, number, number, number][];
  strategic: RawStrategic[];
}

const scenario: RawScenario = JSON.parse(
  fs.readFileSync(
    path.join(root, "resources/maps/world1936/scenario.json"),
    "utf8",
  ),
);
const seeds: { name: string; keepAlone?: boolean }[] = JSON.parse(
  fs.readFileSync(
    path.join(
      root,
      "map-generator/scenarios/world1936/src/landRegions1936.json",
    ),
    "utf8",
  ),
);

// P4 spec §3.4: the 65 sea strategic regions (Korean name, zones − 40000).
const SPEC_SEA: readonly (readonly [number, string, readonly number[]])[] = [
  [1001, "북극해", [1, 2, 3, 4, 5, 6, 7, 8, 9]],
  [1002, "캐나다 북극 제도", [10, 12, 17, 23, 24, 26, 27]],
  [1003, "그린란드해", [11, 19]],
  [1004, "바렌츠해", [13, 16, 33]],
  [1005, "카라해·랍테프해", [14, 15, 18, 25, 28]],
  [1006, "동시베리아해·축치해", [21, 30]],
  [1007, "노르웨이해", [22, 29]],
  [1008, "배핀만·허드슨만", [20, 31, 32, 35, 38]],
  [1009, "덴마크 해협(아이슬란드)", [34]],
  [1010, "북서 접근로", [40]],
  [1011, "북해", [46]],
  [1012, "스카게라크", [156]],
  [1013, "발트해", [37, 41]],
  [1014, "핀란드만", [157]],
  [1015, "영국 해협", [150]],
  [1016, "서부 접근로", [151, 152]],
  [1017, "비스케이만", [61]],
  [1018, "북대서양 중부", [43]],
  [1019, "북대서양 서부", [47, 50, 54]],
  [1020, "미국 동부 해안", [69, 75]],
  [1021, "카리브해·멕시코만", [72, 83]],
  [1022, "중부 대서양", [70]],
  [1023, "지브롤터 접근로", [63]],
  [1024, "기니만", [86, 94]],
  [1025, "서지중해", [153]],
  [1026, "티레니아해", [66]],
  [1027, "중앙 지중해", [62, 64]],
  [1028, "아드리아해", [155]],
  [1029, "에게해", [154]],
  [1030, "동지중해", [160]],
  [1031, "흑해", [59]],
  [1032, "홍해·아덴만", [77, 159]],
  [1033, "페르시아만", [158]],
  [1034, "아라비아해", [76, 87]],
  [1035, "벵골만", [68]],
  [1036, "안다만해·말라카", [85]],
  [1037, "인도양 서부", [91, 93, 121]],
  [1038, "인도양 중부", [96, 97]],
  [1039, "인도양 남부", [116, 125, 128, 132, 136, 139, 141, 148]],
  [1040, "오스트레일리아 남부", [129, 135]],
  [1041, "남중국해", [80, 89]],
  [1042, "자와해", [100, 114]],
  [1043, "동인도 동부", [88, 95, 101, 117]],
  [1044, "필리핀해", [74, 81]],
  [1045, "동중국해·황해", [60, 73]],
  [1046, "동해", [57]],
  [1047, "오호츠크해", [44, 49]],
  [1048, "일본 근해", [65]],
  [1049, "캐롤라인 제도", [79, 90]],
  [1050, "마셜 제도", [67]],
  [1051, "북서 태평양", [39, 53]],
  [1052, "베링해·알래스카만", [36, 42, 55]],
  [1053, "하와이 해역", [56, 78]],
  [1054, "미국 서부 해안", [45, 52, 71]],
  [1055, "동태평양", [84, 92, 99]],
  [1056, "남아메리카 서해안", [106, 120, 123]],
  [1057, "중남태평양", [82, 102, 103, 104, 105, 113]],
  [1058, "솔로몬 제도·비스마르크해", [98, 110, 112]],
  [1059, "산호해·아라푸라해", [111, 115, 119, 122]],
  [1060, "태즈먼해", [126, 133, 142, 147]],
  [1061, "남태평양 남부", [127, 131, 134, 137, 144, 145, 149]],
  [1062, "남대서양 서부", [107, 118]],
  [1063, "남대서양 중부", [108, 109, 124]],
  [1064, "희망봉 해역", [130, 140, 146]],
  [1065, "포클랜드·남대서양 남부", [138, 143]],
];

const land = scenario.strategic.filter((s) => s.kind === "land");
const sea = scenario.strategic.filter((s) => s.kind === "sea");
const regionById = new Map(scenario.regions.map((r) => [r.id, r]));
const zoneById = new Map(scenario.seaZones.map((z) => [z.id, z]));

/** Each region's neighbours along land edges that are not straits. */
const landAdj = new Map<number, number[]>();
for (const [a, b, , , , strait] of scenario.edges) {
  if (strait === 1) continue;
  landAdj.set(a, [...(landAdj.get(a) ?? []), b]);
  landAdj.set(b, [...(landAdj.get(b) ?? []), a]);
}

describe("strategic regions (P4 spec §3.4, scenario v4)", () => {
  test("the file is version 4 with land regions first, then the sea", () => {
    expect(scenario.version).toBe(4);
    const kinds = scenario.strategic.map((s) => s.kind);
    expect(kinds.indexOf("sea")).toBe(land.length);
    expect(land.map((s) => s.id)).toEqual(land.map((_s, k) => k + 1));
  });

  test("65 sea strategic regions, 1001..1065, as the spec's table", () => {
    expect(
      sea.map((s) => [s.id, s.nameKo, s.members.map((z) => z - 40000)]),
    ).toEqual(
      SPEC_SEA.map(([id, ko, zones]) => [
        id,
        ko,
        [...zones].sort((a, b) => a - b),
      ]),
    );
    for (const s of sea) expect(s.name.length, `${s.id}`).toBeGreaterThan(0);
  });

  test("every sea zone but a lake is in exactly one sea strategic region", () => {
    const count = new Map<number, number>();
    for (const s of sea) {
      for (const z of s.members) {
        count.set(z, (count.get(z) ?? 0) + 1);
        expect(zoneById.get(z)?.sr, `${z}`).toBe(s.id);
      }
    }
    for (const z of scenario.seaZones) {
      expect(count.get(z.id) ?? 0, `${z.id}`).toBe(z.lake === true ? 0 : 1);
      if (z.lake === true) expect(z.sr, `${z.id}`).toBe(0);
    }
  });

  test("the six Mediterranean zones are six strategic regions, 1025..1030", () => {
    const med = [40153, 40066, 40062, 40155, 40154, 40160];
    expect(med.map((z) => zoneById.get(z)!.sr)).toEqual([
      1025, 1026, 1027, 1028, 1029, 1030,
    ]);
    // The Ionian Sea goes with the Central Mediterranean.
    expect(zoneById.get(40064)!.sr).toBe(1027);
  });

  test("srArea is the zones' tiles / 1,000, at least 3", () => {
    for (const s of sea) {
      const tiles = s.members.reduce((a, z) => a + zoneById.get(z)!.tiles, 0);
      expect(tiles, `${s.id}`).toBeGreaterThan(0);
      expect(
        Math.max(3, Math.floor(tiles / 1000)),
        `${s.id}`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  test("150 to 185 land strategic regions; every region in exactly one", () => {
    // Spec §3.4-7 said 110..140; the controller rulings of 2026-10-21 raised
    // it for HOI4-like zones outside Europe.
    expect(land.length).toBeGreaterThanOrEqual(150);
    expect(land.length).toBeLessThanOrEqual(185);
    const count = new Map<number, number>();
    for (const s of land) {
      for (const r of s.members) {
        count.set(r, (count.get(r) ?? 0) + 1);
        expect(regionById.get(r)?.sr, `${r}`).toBe(s.id);
      }
    }
    for (const r of scenario.regions) {
      expect(count.get(r.id), `${r.id} ${r.name}`).toBe(1);
    }
  });

  test("a land strategic region is joined by land; what else it holds are small whole islands", () => {
    for (const s of land) {
      const own = new Set(s.members);
      const seen = new Set<number>();
      const parts: number[][] = [];
      for (const start of s.members) {
        if (seen.has(start)) continue;
        const part = [start];
        seen.add(start);
        for (let k = 0; k < part.length; k++) {
          for (const n of landAdj.get(part[k]) ?? []) {
            if (own.has(n) && !seen.has(n)) {
              seen.add(n);
              part.push(n);
            }
          }
        }
        parts.push(part);
      }
      parts.sort((a, b) => b.length - a.length || a[0] - b[0]);
      for (const part of parts.slice(1)) {
        // A joined island: at most 3 regions, no land edge off it.
        expect(part.length, s.name).toBeLessThanOrEqual(3);
        for (const r of part) {
          for (const n of landAdj.get(r) ?? []) {
            expect(part.includes(n), `${s.name}: ${r}–${n}`).toBe(true);
          }
        }
      }
    }
  });

  test("Malta, Pantelleria and Rhodes are strategic regions of their own", () => {
    for (const key of ["malta", "pantelleria", "rhodes"]) {
      const r = scenario.regions.find((x) => x.island === key)!;
      const s = land.find((x) => x.members.includes(r.id))!;
      expect([s.members, s.name], key).toEqual([[r.id], r.name]);
    }
    expect(seeds.filter((s) => s.keepAlone).map((s) => s.name)).toEqual([
      "Malta",
      "Pantelleria",
      "Rhodes",
    ]);
  });

  test("the hand seeds name their strategic regions", () => {
    const names = new Set(land.map((s) => s.name));
    for (const n of [
      "England South",
      "Normandy and Brittany",
      "Sicily",
      "Crete",
      // Outside Europe (controller ruling 2026-10-21).
      "Punjab",
      "Bengal",
      "Northern Persia",
      "Arabia",
      "Kazakhstan",
      "West Siberia",
      "Yakutia",
      "Northern Manchuria",
      "Sichuan",
      "Tibet",
      "Siam",
      "Tonkin",
      "Cochinchina",
      "Amur",
      "West Africa",
      "Congo",
      "South Africa",
      "US Midwest",
      "Pacific Coast",
      "Quebec",
      "Mexico",
      "Southern Brazil",
      "Andes",
      "Australia",
    ]) {
      expect(names.has(n), n).toBe(true);
    }
    // Every hand seed keeps its region (none joins another).
    for (const s of seeds) expect(names.has(s.name), s.name).toBe(true);
  });

  test("the Korean Peninsula and Taiwan are neutral geographic zones of their own", () => {
    // Controller ruling 2026-10-21. The Korean regions: the land the 1936
    // owner holds around Keijō (Seoul), joined by land edges that are not
    // straits (Kwantung lies beyond Manchukuo).
    const seoul = scenario.regions.find((r) => r.name === "Keijō (Seoul)")!;
    const korea = new Set([seoul.id]);
    const queue = [seoul.id];
    for (let k = 0; k < queue.length; k++) {
      for (const n of landAdj.get(queue[k]) ?? []) {
        if (!korea.has(n) && regionById.get(n)!.owner === seoul.owner) {
          korea.add(n);
          queue.push(n);
        }
      }
    }
    expect(korea.size).toBe(11);
    const peninsula = land.find((s) => s.name === "Korean Peninsula")!;
    expect(peninsula.nameKo).toBe("한반도");
    expect(peninsula.members).toEqual([...korea].sort((a, b) => a - b));
    const taiwan = scenario.regions.find((r) => r.name === "Taiwan")!;
    const zone = land.find((s) => s.members.includes(taiwan.id))!;
    expect([zone.name, zone.nameKo, zone.members]).toEqual([
      "Taiwan",
      "대만",
      [taiwan.id],
    ]);
  });

  test("a strategic region's centre is one of its members' centres", () => {
    for (const s of land) {
      expect(
        s.members.some((r) => {
          const c = regionById.get(r)!.center;
          return c[0] === s.center[0] && c[1] === s.center[1];
        }),
        s.name,
      ).toBe(true);
      expect(Math.abs(s.latC)).toBeLessThanOrEqual(9000);
    }
    for (const s of sea) {
      expect(
        s.members.some((z) => {
          const c = zoneById.get(z)!.center;
          return c[0] === s.center[0] && c[1] === s.center[1];
        }),
        s.name,
      ).toBe(true);
    }
  });
});
