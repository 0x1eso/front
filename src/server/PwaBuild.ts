// Build-time half of the installable, offline-capable web app: what the
// service worker precaches, the build id that versions its caches, and the
// sw.js the build writes. vite.config.ts runs writeServiceWorker() after the
// bundle and the hashed assets are written; the worker itself is
// src/client/pwa/sw.ts.
//
// vite.config.ts imports this file relatively, so Vite's config loader
// bundles it; keep its @openfront imports type-only (see AssetUrls.ts).

import type { AssetManifest } from "@openfront/shared/AssetPaths";
import {
  assetHashOf,
  buildMetaTag,
  insertIntoHead,
  SERVICE_WORKER_URL,
  type SwBuild,
} from "@openfront/shared/ServiceWorkerRules";
import { createHash } from "crypto";
import fs from "fs";
import path from "path";

/** The precache budget: an install downloads all of it before it is used. */
export const PRECACHE_BUDGET_BYTES = 50 * 1024 * 1024;

// A map's folder is fetched on first use or from "download for offline",
// except the two files the map picker shows for every map.
const MAP_FILE = /^maps\/[^/]+\/(.+)$/;
const PICKER_MAP_FILES = new Set(["manifest.json", "thumbnail.webp"]);
const FLAG_FILE = /^flags\/(.+)\.svg$/;

export interface PrecachePlanInput {
  /** Semantic path -> hashed URL (PublicAssetManifest). */
  assetManifest: AssetManifest;
  /** Vite's emitted files, relative to the output dir ("assets/x.js"). */
  bundleFiles: readonly string[];
  /** Flags the menus show before any game (the language picker's). */
  coreFlags: ReadonlySet<string>;
}

/**
 * The app shell's files: the whole Vite bundle, and every hashed asset but
 * the maps (only their manifest and thumbnail) and the flags (only the core
 * ones). Maps and flags are cached on first use, or by the offline map
 * download. Sorted, without duplicates, without "/" (cached separately).
 */
export function planPrecache(input: PrecachePlanInput): string[] {
  const urls = new Set<string>();
  for (const file of input.bundleFiles) {
    if (!file.startsWith("assets/") || file.endsWith(".map")) continue;
    urls.add(`/${file}`);
  }
  for (const [semantic, url] of Object.entries(input.assetManifest)) {
    if (semantic.startsWith("assets/")) {
      // Vite's own files, merged into the manifest by the build.
      if (!semantic.endsWith(".map")) urls.add(url);
      continue;
    }
    const map = MAP_FILE.exec(semantic);
    if (map !== null) {
      if (PICKER_MAP_FILES.has(map[1])) urls.add(url);
      continue;
    }
    const flag = FLAG_FILE.exec(semantic);
    if (flag !== null) {
      if (input.coreFlags.has(flag[1])) urls.add(url);
      continue;
    }
    if (semantic.startsWith("flags/")) continue;
    urls.add(url);
  }
  return [...urls].sort();
}

/** Content hashes of the files kept across builds: maps and flags. */
export function offlineAssetHashes(assetManifest: AssetManifest): string[] {
  const hashes = new Set<string>();
  for (const [semantic, url] of Object.entries(assetManifest)) {
    if (!semantic.startsWith("maps/") && !semantic.startsWith("flags/")) {
      continue;
    }
    const hash = assetHashOf(url);
    if (hash !== null) hashes.add(hash);
  }
  return [...hashes].sort();
}

/**
 * Sizes of every map file and flag, by semantic path, for the offline map
 * download's sizes (OfflineMaps.ts reads them as __OFFLINE_SIZES__). Read
 * from the sources: the build copies these files unchanged.
 */
export function offlineAssetSizes(
  sourceDirs: readonly string[],
): Record<string, number> {
  const sizes: Record<string, number> = {};
  for (const dir of sourceDirs) {
    for (const sub of ["maps", "flags"]) {
      const root = path.join(dir, sub);
      if (!fs.existsSync(root)) continue;
      for (const entry of fs.readdirSync(root, {
        recursive: true,
        withFileTypes: true,
      })) {
        if (!entry.isFile() || entry.name.startsWith(".")) continue;
        const rel = path
          .relative(dir, path.join(entry.parentPath, entry.name))
          .split(path.sep)
          .join("/");
        sizes[rel] ??= fs.statSync(path.join(dir, rel)).size;
      }
    }
  }
  return sizes;
}

/** The flag stems the language picker shows (resources/lang/metadata.json). */
export function languageFlags(resourcesDir: string): Set<string> {
  const metadata = JSON.parse(
    fs.readFileSync(path.join(resourcesDir, "lang", "metadata.json"), "utf8"),
  ) as Array<{ svg?: string }>;
  return new Set(
    metadata.flatMap((lang) => (lang.svg === undefined ? [] : [lang.svg])),
  );
}

/** A short id that changes whenever any of the parts does. */
export function buildIdOf(parts: readonly string[]): string {
  const hash = createHash("sha256");
  for (const part of parts) {
    hash.update(`${part.length}:`);
    hash.update(part);
  }
  return hash.digest("hex").slice(0, 16);
}

/** sw.js: the build's data, then the bundled worker that reads it. */
export function renderServiceWorker(code: string, build: SwBuild): string {
  return `var __SW_BUILD__ = ${JSON.stringify(build)};\n${code}`;
}

export interface WriteServiceWorkerOptions extends PrecachePlanInput {
  outDir: string;
  /** Bundles src/client/pwa/sw.ts to one classic script. */
  compile: () => Promise<string>;
}

export interface ServiceWorkerSummary {
  buildId: string;
  files: number;
  bytes: number;
}

/**
 * Writes sw.js to the output's root and names the build in its index.html,
 * so the worker can tell its own app shell from another build's.
 */
export async function writeServiceWorker(
  options: WriteServiceWorkerOptions,
): Promise<ServiceWorkerSummary> {
  const indexPath = path.join(options.outDir, "index.html");
  const html = fs.readFileSync(indexPath, "utf8");
  const code = await options.compile();
  const precache = planPrecache(options);
  const offlineHashes = offlineAssetHashes(options.assetManifest);
  const buildId = buildIdOf([
    code,
    html,
    JSON.stringify(precache),
    JSON.stringify(offlineHashes),
  ]);

  let bytes = 0;
  for (const url of precache) {
    const file = path.join(options.outDir, decodeURIComponent(url));
    if (!fs.existsSync(file)) {
      throw new Error(`precache lists ${url}, which the build did not write`);
    }
    bytes += fs.statSync(file).size;
  }
  bytes += Buffer.byteLength(html);

  fs.writeFileSync(
    path.join(options.outDir, SERVICE_WORKER_URL.slice(1)),
    renderServiceWorker(code, { id: buildId, precache, offlineHashes }),
  );
  fs.writeFileSync(indexPath, insertIntoHead(html, buildMetaTag(buildId)));
  return { buildId, files: precache.length + 1, bytes };
}
