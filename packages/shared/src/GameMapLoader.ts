import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import { MapFiles, MapManifest } from "@openfront/engine-api/game/MapFiles";
import { ScenarioDataSchema } from "@openfront/engine-api/ww1936/ScenarioTypes";

/** Where a host gets a map's files, its thumbnail and its layer images. */
export interface GameMapLoader {
  getMapData(map: GameMapType): MapData;
}

export interface MapData {
  mapBin: () => Promise<Uint8Array>;
  map4xBin: () => Promise<Uint8Array>;
  map16xBin: () => Promise<Uint8Array>;
  manifest: () => Promise<MapManifest>;
  /** Any other file of the map's folder (World War 1936: regions.bin, scenario.json). */
  file: (name: string) => Promise<Uint8Array>;
  webpPath: string;
  /**
   * Load a map layer image by layer id. `compact` selects the map4x-sized
   * variant (`<id>.4x.webp`; ids cannot contain dots, so it never collides
   * with another layer), which Compact games draw on directly.
   */
  layerImage: (layerId: string, compact: boolean) => Promise<ImageBitmap>;
}

/** Loads the files a game on this map and size reads (see MapFiles). */
export async function loadMapFiles(
  loader: GameMapLoader,
  map: GameMapType,
  mapSize: GameMapSize,
): Promise<MapFiles> {
  const data = loader.getMapData(map);
  if (mapSize === GameMapSize.Normal) {
    const [manifest, mapBin, map4xBin] = await Promise.all([
      data.manifest(),
      data.mapBin(),
      data.map4xBin(),
    ]);
    const scenario =
      manifest.ww1936 === true ? await loadScenarioFiles(data) : {};
    return { map, mapSize, manifest, mapBin, map4xBin, ...scenario };
  }
  const [manifest, map4xBin, map16xBin] = await Promise.all([
    data.manifest(),
    data.map4xBin(),
    data.map16xBin(),
  ]);
  return { map, mapSize, manifest, map4xBin, map16xBin };
}

/** The files' buffers, to move them to a worker instead of copying them. */
export function mapFilesTransfer(files: MapFiles): ArrayBuffer[] {
  return [
    files.mapBin,
    files.map4xBin,
    files.map16xBin,
    files.regionsBin,
  ].flatMap((bin) => (bin === undefined ? [] : [bin.buffer as ArrayBuffer]));
}

/** World War 1936 (spec §4.7): regions.bin and the validated scenario.json. */
async function loadScenarioFiles(
  data: MapData,
): Promise<Pick<MapFiles, "regionsBin" | "scenario">> {
  const [regionsBin, scenarioBytes] = await Promise.all([
    data.file("regions.bin"),
    data.file("scenario.json"),
  ]);
  const scenario = ScenarioDataSchema.parse(
    JSON.parse(new TextDecoder().decode(scenarioBytes)),
  );
  return { regionsBin, scenario };
}
