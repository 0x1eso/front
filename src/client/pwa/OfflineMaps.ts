// Maps for offline play. Every map a game loads online is kept by the
// service worker on first use; this is the deliberate version, the solo
// screen's "download maps for offline" (OfflineMapsPanel.ts): a map's whole
// folder plus the flags its nations (or World War 1936's countries) fly,
// written to the cache that outlives builds (OFFLINE_CACHE), with progress.
//
// Sizes come from the build (__OFFLINE_SIZES__, vite.config.ts): every map
// file's and flag's size by its path under resources/. Empty outside a
// production build, which has no service worker to play offline with.

import {
  GameMapSize,
  GameMapType,
  maps,
} from "@openfront/engine-api/game/GameTypes";
import type { MapManifest } from "@openfront/engine-api/game/MapFiles";
import type { GameConfig } from "@openfront/engine-api/Schemas";
import { COUNTRIES } from "@openfront/engine-api/ww1936/Countries";
import { assetUrl } from "@openfront/shared/AssetUrls";
import { mapFolderName } from "@openfront/shared/FetchGameMapLoader";
import { OFFLINE_CACHE } from "@openfront/shared/ServiceWorkerRules";

declare const __OFFLINE_SIZES__: Record<string, number>;

/** Bytes by asset path ("maps/world/map.bin", "flags/us.svg"). */
export type AssetSizes = Readonly<Record<string, number>>;

export function buildAssetSizes(): AssetSizes {
  return typeof __OFFLINE_SIZES__ === "undefined" ? {} : __OFFLINE_SIZES__;
}

/**
 * The maps the download offers: World War 1936's, then the featured ones a
 * solo game starts on (World first).
 */
export function offlineMapChoices(): GameMapType[] {
  const featured = maps
    .filter((m) => m.categories.includes("featured"))
    .sort((a, b) => (a.featuredRank ?? 99) - (b.featuredRank ?? 99))
    .map((m) => m.type);
  return [...new Set([GameMapType.World1936, ...featured])];
}

/** The files of a map's folder the build has, as asset paths. */
export function mapFolderFiles(map: GameMapType, sizes: AssetSizes): string[] {
  const folder = mapFolderName(map);
  if (folder === undefined) return [];
  const prefix = `maps/${folder}/`;
  return Object.keys(sizes)
    .filter((path) => path.startsWith(prefix))
    .sort();
}

/** The flags a game on this map shows, as asset paths the build has. */
export function mapFlags(manifest: MapManifest, sizes: AssetSizes): string[] {
  const stems =
    manifest.ww1936 === true
      ? Object.values(COUNTRIES).map((c) => c.flag)
      : manifest.nations.flatMap((n) => (n.flag ? [n.flag] : []));
  const paths = new Set<string>();
  for (const stem of stems) {
    const path = `flags/${stem}.svg`;
    if (sizes[path] !== undefined) paths.add(path);
  }
  return [...paths].sort();
}

export interface OfflineMapPlan {
  map: GameMapType;
  /** Asset paths: the map's folder, then its flags. */
  files: string[];
  bytes: number;
}

export function planOfflineMap(
  map: GameMapType,
  manifest: MapManifest,
  sizes: AssetSizes,
): OfflineMapPlan {
  const files = [...mapFolderFiles(map, sizes), ...mapFlags(manifest, sizes)];
  return { map, files, bytes: sumSizes(files, sizes) };
}

export function sumSizes(files: readonly string[], sizes: AssetSizes): number {
  return files.reduce((total, path) => total + (sizes[path] ?? 0), 0);
}

/**
 * The files a game on this map and size loads (shared/GameMapLoader.ts's
 * loadMapFiles, and the renderer's layer images): what must be cached for it
 * to start offline.
 */
export function requiredMapFiles(
  folderFiles: readonly string[],
  size: GameMapSize,
): string[] {
  const compact = size === GameMapSize.Compact;
  return folderFiles.filter((path) => {
    const file = path.slice(path.lastIndexOf("/") + 1);
    if (file === "manifest.json" || file === "map4x.bin") return true;
    if (file === "map.bin") return !compact;
    if (file === "map16x.bin") return compact;
    // World War 1936's scenario, read by Normal games only.
    if (file === "regions.bin" || file === "scenario.json") return !compact;
    if (file === "thumbnail.webp" || !file.endsWith(".webp")) return false;
    // Layer images: <id>.webp, and <id>.4x.webp for Compact games.
    return compact === file.endsWith(".4x.webp");
  });
}

/** The parts of the Cache Storage API this module uses. */
export interface CacheStore {
  match(url: string): Promise<Response | undefined>;
  open(name: string): Promise<Pick<Cache, "put">>;
}

function browserCaches(): CacheStore | null {
  return typeof caches === "undefined" ? null : caches;
}

/**
 * Whether a game with this config can start from the cache. True when the
 * build lists no files (nothing to check against) or there is no Cache API.
 */
export async function mapPlayableOffline(
  config: Pick<GameConfig, "gameMap" | "gameMapSize">,
  sizes: AssetSizes = buildAssetSizes(),
  store: CacheStore | null = browserCaches(),
): Promise<boolean> {
  const folderFiles = mapFolderFiles(config.gameMap, sizes);
  if (store === null || folderFiles.length === 0) return true;
  for (const path of requiredMapFiles(folderFiles, config.gameMapSize)) {
    if (!(await store.match(assetUrl(path)))) return false;
  }
  return true;
}

/** The files of a plan this browser does not have yet. */
export async function missingFiles(
  plan: OfflineMapPlan,
  store: CacheStore | null = browserCaches(),
): Promise<string[]> {
  if (store === null) return [...plan.files];
  const missing: string[] = [];
  for (const path of plan.files) {
    if (!(await store.match(assetUrl(path)))) missing.push(path);
  }
  return missing;
}

/**
 * Downloads every file of the plans that is not cached yet, into the
 * offline cache. `onProgress` gets the bytes done so far, out of the plans'
 * total less what is shared between them. Throws on the first failure; what
 * was downloaded until then stays.
 */
export async function downloadOfflineMaps(
  plans: readonly OfflineMapPlan[],
  sizes: AssetSizes,
  onProgress: (done: number, total: number) => void,
  store: CacheStore | null = browserCaches(),
  fetcher: typeof fetch = fetch,
): Promise<void> {
  if (store === null) throw new Error("no Cache Storage in this browser");
  const files = [...new Set(plans.flatMap((plan) => plan.files))];
  const total = sumSizes(files, sizes);
  const cache = await store.open(OFFLINE_CACHE);
  let done = 0;
  onProgress(done, total);
  for (const path of files) {
    const url = assetUrl(path);
    const size = sizes[path] ?? 0;
    if (!(await store.match(url))) {
      const response = await fetcher(url, { credentials: "same-origin" });
      if (!response.ok) {
        throw new Error(`${url} answered ${response.status}`);
      }
      const start = done;
      const body = await readWithProgress(response, (read) =>
        onProgress(start + Math.min(read, size), total),
      );
      await cache.put(
        url,
        new Response(body, {
          status: 200,
          headers: {
            "Content-Type":
              response.headers.get("Content-Type") ??
              "application/octet-stream",
          },
        }),
      );
    }
    done += size;
    onProgress(done, total);
  }
}

async function readWithProgress(
  response: Response,
  onRead: (bytes: number) => void,
): Promise<Blob> {
  const reader = response.body?.getReader();
  if (reader === undefined) return response.blob();
  const chunks: BlobPart[] = [];
  let read = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    read += value.byteLength;
    onRead(read);
  }
  return new Blob(chunks);
}

/** Asks the browser not to evict what was downloaded (best effort). */
export async function requestPersistentStorage(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Not offered (or refused): the cache simply stays evictable.
  }
}

/** "12.3 MB", for the download's sizes. */
export function formatMegabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}
