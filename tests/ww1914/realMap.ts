import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { MapFiles } from "@openfront/engine-api/game/MapFiles";
import { ScenarioDataSchema } from "@openfront/engine-api/ww1936/ScenarioTypes";
import fs from "node:fs";
import path from "node:path";

const res = (p: string) => path.join(__dirname, "../../resources", p);
const bin = (p: string) => new Uint8Array(fs.readFileSync(res(p)));
const json = (p: string): unknown =>
  JSON.parse(fs.readFileSync(res(p), "utf8"));

/** The 1914 set on the real map: its places are what land moves. */
export function realMap(): MapFiles {
  return {
    map: GameMapType.World1936,
    mapSize: GameMapSize.Normal,
    manifest: json("maps/world1936/manifest.json") as MapFiles["manifest"],
    mapBin: bin("maps/world1936/map.bin"),
    map4xBin: bin("maps/world1936/map4x.bin"),
    regionsBin: bin("maps/world1914/regions.bin"),
    scenario: ScenarioDataSchema.parse(json("maps/world1914/scenario.json")),
  };
}
