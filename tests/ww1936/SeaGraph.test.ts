// World War 1936 P4 (plan Task 1 Step 25): the sea graph of ww1936sea —
// the date line, the strait, the canal, lakes, Montreux (spec §3.3).
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { ReadonlyScenarioData } from "@openfront/engine-api/ww1936/ScenarioTypes";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import {
  ALL_EDGES,
  edgePassable,
  PassQuery,
  seaPath,
  stationZone,
} from "@openfront/engine-lib/ww1936/SeaGraph";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import fs from "fs";
import path from "path";
import { TestDataMapLoader } from "../util/ScriptedGame";
import { PATH_KM, REGION, SEA, SR, TAG_ID, ZONE } from "./seaFixture";

const DIR = path.join(__dirname, "../testdata/maps/ww1936sea");
const json = () =>
  JSON.parse(fs.readFileSync(path.join(DIR, "scenario.json"), "utf8"));
const bin = () =>
  new Uint8Array(fs.readFileSync(path.join(DIR, "regions.bin")));
const index = (data: ReadonlyScenarioData = json()) =>
  ScenarioIndex.fromFiles(data, bin());

/** A world where `wars` are the pairs at war and the shore regions keep their 1936 owners. */
function query(sc: ScenarioIndex, wars: [number, number][]): PassQuery {
  const atWar = (a: number, b: number) =>
    wars.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  return {
    controller: (r) => sc.ownerByRegion()[r] ?? 0,
    isEnemy: atWar,
    neutralTurkey: (r) => sc.ownerByRegion()[r] === TAG_ID.TUR,
    isAtWarAny: (a) => wars.some(([x, y]) => x === a || y === a),
  };
}

describe("the sea graph (spec §3.3)", () => {
  it("the map loads with its zones", async () => {
    const files = await loadMapFiles(
      new TestDataMapLoader(SEA.map),
      GameMapType.World1936,
      GameMapSize.Normal,
    );
    expect(files).toBeDefined();
  });

  it("shortest paths: the date line, the strait and the canal", () => {
    const sc = index();
    expect(seaPath(sc, [ZONE.west], [ZONE.east], ALL_EDGES)).toEqual({
      zones: [ZONE.west, ZONE.east],
      km: PATH_KM.westToEast,
    });
    expect(seaPath(sc, [ZONE.middle], [ZONE.east], ALL_EDGES)).toEqual({
      zones: [ZONE.middle, ZONE.narrows, ZONE.east],
      km: PATH_KM.middleToEast,
    });
    const canal = 3;
    const strait = 2;
    expect(seaPath(sc, [ZONE.middle], [ZONE.east], (e) => e !== canal)).toEqual(
      {
        zones: [ZONE.middle, ZONE.west, ZONE.east],
        km: PATH_KM.middleToEastCanalClosed,
      },
    );
    expect(
      seaPath(sc, [ZONE.middle], [ZONE.narrows], (e) => e !== strait),
    ).toEqual({
      zones: [ZONE.middle, ZONE.west, ZONE.east, ZONE.narrows],
      km: PATH_KM.middleToNarrowsStraitClosed,
    });
  });

  it("a lake is never on a path", () => {
    const data = json();
    data.seaZones.find((z: { id: number }) => z.id === ZONE.narrows).lake =
      true;
    const sc = index(data);
    expect(seaPath(sc, [ZONE.middle], [ZONE.east], ALL_EDGES)).toEqual({
      zones: [ZONE.middle, ZONE.west, ZONE.east],
      km: PATH_KM.middleToEastCanalClosed,
    });
    expect(seaPath(sc, [ZONE.middle], [ZONE.narrows], ALL_EDGES)).toBeNull();
  });

  it("straits and canals close to an enemy of a shore's holder", () => {
    const sc = index();
    const canal = 3;
    const strait = 2;
    const fra = TAG_ID.FRA;
    const peace = query(sc, []);
    expect(edgePassable(sc, canal, fra, true, peace)).toBe(true);
    expect(edgePassable(sc, strait, fra, true, peace)).toBe(true);
    const vsTur = query(sc, [[fra, TAG_ID.TUR]]);
    expect(edgePassable(sc, canal, fra, true, vsTur)).toBe(false);
    expect(edgePassable(sc, strait, fra, true, vsTur)).toBe(true);
    const vsPol = query(sc, [[fra, TAG_ID.POL]]);
    expect(edgePassable(sc, strait, fra, true, vsPol)).toBe(false);
    expect(edgePassable(sc, canal, fra, true, vsPol)).toBe(true);
    expect(edgePassable(sc, 0, fra, true, vsTur)).toBe(true);
  });

  it("Montreux: a belligerent's warships stay out of a neutral Turkey's Bosporus", () => {
    const data = json();
    data.straits[1].id = "bosporus";
    const sc = index(data);
    const canal = 3;
    // France at war with Germany; Turkey neutral and at peace.
    const war = query(sc, [[TAG_ID.FRA, TAG_ID.DEU]]);
    expect(edgePassable(sc, canal, TAG_ID.FRA, true, war)).toBe(false);
    expect(edgePassable(sc, canal, TAG_ID.FRA, false, war)).toBe(true);
    expect(edgePassable(sc, canal, TAG_ID.ITA, true, war)).toBe(true);
    void REGION;
  });

  it("the station zone of a sea region", () => {
    const sc = index();
    expect(stationZone(sc, SR.central, ZONE.west, ALL_EDGES)).toBe(ZONE.middle);
    expect(stationZone(sc, SR.central, ZONE.east, ALL_EDGES)).toBe(
      ZONE.narrows,
    );
    expect(stationZone(sc, SR.westLand, ZONE.west, ALL_EDGES)).toBe(0);
  });
});
