// The service worker's rules (src/client/pwa/sw.ts), kept free of any
// service-worker or DOM global so they are testable as plain functions. The
// page (src/client/pwa/OfflineMaps.ts) and the build
// (src/server/PwaBuild.ts) read the cache names and the build id format from
// here too, so the three cannot drift.
//
// vite.config.ts loads this file through PwaBuild.ts, and Vite's config
// loader leaves @openfront/* imports to Node, which only strips types: keep
// it to erasable TypeScript (no enums), importing nothing.
//
// What the worker does with a request:
//
//   navigate  the page itself: network first; when the network fails (or the
//             server behind the proxy is down) the cached app shell, marked
//             offline.
//   shell     a hashed file of the build (Vite's /assets/, the hashed
//             /_assets/): cache first, a miss is fetched and kept in this
//             build's cache.
//   offline   a map's files and flags (/_assets/maps/, /_assets/flags/):
//             cache first, a miss is fetched and kept in the cache that
//             outlives builds, so a map downloaded for offline play survives
//             a deploy that did not change it.
//   network   everything else, and never cached: the API, the self-hosted
//             API stub, the game servers (/w<n>/), the lobby socket, the
//             desktop descriptor, cross-origin requests, anything not a GET.
//             A page under a game server's path (/w0/game/<id>) is still a
//             navigation.

/** Where the worker is served: the site root, so its scope is the site. */
export const SERVICE_WORKER_URL = "/sw.js";

/** Every cache this app makes starts with this. */
export const CACHE_PREFIX = "statecraft-";

/** Map files and flags: kept across builds, pruned to the current build's. */
export const OFFLINE_CACHE = `${CACHE_PREFIX}offline`;

const SHELL_CACHE_PREFIX = `${CACHE_PREFIX}shell-`;

/** The build's own files and its app shell (index.html, under "/"). */
export function shellCacheName(buildId: string): string {
  return `${SHELL_CACHE_PREFIX}${buildId}`;
}

/** Where the app shell is kept in the shell cache. */
export const SHELL_KEY = "/";

/** The build a page belongs to, written into index.html at build time. */
export const BUILD_META = "statecraft-build";

/** Added to a cached app shell served because the network was not there. */
export const OFFLINE_META = "statecraft-offline";

export type RouteKind = "navigate" | "shell" | "offline" | "network";

/** The parts of a Request the routing reads. */
export interface RoutableRequest {
  url: string;
  method: string;
  mode: string;
}

// Never cached, never answered from a cache: they are live by nature.
const NETWORK_ONLY_PREFIXES = [
  "/api/",
  "/selfhost-api/",
  "/lobbies",
  "/desktop/",
  "/.well-known/",
];

// A game server: /w0/..., /w12/... (and the bare /w0).
const WORKER_PATH = /^\/w\d+(?:\/|$)/;

// Root files that must always come from the server: the worker script
// itself, and the build's own listings.
const NETWORK_ONLY_FILES = new Set([
  SERVICE_WORKER_URL,
  "/asset-manifest.json",
  "/asset-hashes.json",
  "/core-version.txt",
  "/version.txt",
  "/root-files.json",
]);

function isNetworkOnlyPath(pathname: string): boolean {
  if (NETWORK_ONLY_FILES.has(pathname)) return true;
  return NETWORK_ONLY_PREFIXES.some(
    (prefix) =>
      pathname.startsWith(prefix) ||
      // "/api" and "/lobbies" themselves, not just what is under them.
      pathname === prefix.replace(/\/$/, ""),
  );
}

/** Which of the four ways a request is handled. */
export function routeRequest(
  request: RoutableRequest,
  origin: string,
): RouteKind {
  if (request.method !== "GET") return "network";
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return "network";
  }
  if (url.origin !== origin) return "network";
  const path = url.pathname;
  if (isNetworkOnlyPath(path)) return "network";
  // A page, wherever it is: a game link (/w0/game/<id>) is the same app
  // shell, which offline at least opens on the menu.
  if (request.mode === "navigate") return "navigate";
  if (WORKER_PATH.test(path)) return "network";
  if (path.startsWith("/_assets/maps/") || path.startsWith("/_assets/flags/")) {
    return "offline";
  }
  if (path.startsWith("/assets/") || path.startsWith("/_assets/")) {
    return "shell";
  }
  return "network";
}

/** Whether a fetched response may be stored: a whole, same-origin 200. */
export function isCacheableResponse(response: {
  status: number;
  type: string;
}): boolean {
  // 206 (a range) cannot be stored, and an opaque or error response says
  // nothing about what the file holds.
  return response.status === 200 && response.type === "basic";
}

/** Whether the shell cache should be refreshed from this navigation. */
export function isShellNavigation(url: string): boolean {
  try {
    return new URL(url).pathname === SHELL_KEY;
  } catch {
    return false;
  }
}

/**
 * Whether a navigation's response means the server is not there, so the
 * cached shell should be shown instead: a 5xx is what a proxy or tunnel
 * answers for a home server that is down.
 */
export function isServerDown(status: number): boolean {
  return status >= 500;
}

/** The build id an app shell names in its build meta tag, or null. */
export function htmlBuildId(html: string): string | null {
  const match = new RegExp(
    `<meta\\s+name=["']${BUILD_META}["']\\s+content=["']([^"']+)["']`,
    "i",
  ).exec(html);
  return match === null ? null : match[1];
}

/** A meta tag naming the build, for index.html's <head>. */
export function buildMetaTag(buildId: string): string {
  return `<meta name="${BUILD_META}" content="${buildId}" />`;
}

/** Inserts a tag right after <head>; the html unchanged if it has none. */
export function insertIntoHead(html: string, tag: string): string {
  return html.replace(/<head(\s[^>]*)?>/i, (head) => `${head}\n    ${tag}`);
}

/** The cached shell, marked so the page knows it was loaded offline. */
export function markOfflineHtml(html: string): string {
  return insertIntoHead(html, `<meta name="${OFFLINE_META}" content="1" />`);
}

/** The caches a new build's worker deletes when it takes over. */
export function cachesToDelete(names: string[], buildId: string): string[] {
  const keep = new Set([shellCacheName(buildId), OFFLINE_CACHE]);
  return names.filter(
    (name) => name.startsWith(CACHE_PREFIX) && !keep.has(name),
  );
}

/**
 * The content hash in a hashed asset's name (`map.0123456789ab.bin`), or
 * null. PublicAssetManifest.createHashedAssetUrl writes twelve hex digits
 * between the name and the extension.
 */
export function assetHashOf(url: string): string | null {
  let pathname: string;
  try {
    pathname = new URL(url, "http://x").pathname;
  } catch {
    return null;
  }
  const file = pathname.slice(pathname.lastIndexOf("/") + 1);
  const match = /\.([0-9a-f]{12})(?:\.[^./]*)?$/.exec(file);
  return match === null ? null : match[1];
}

/**
 * Whether an entry of the offline cache is still one of this build's files.
 * Map files and flags are content hashed, so a changed file has a new hash
 * and the old one is only taking space.
 */
export function keepOfflineEntry(
  url: string,
  currentHashes: ReadonlySet<string>,
): boolean {
  const hash = assetHashOf(url);
  return hash !== null && currentHashes.has(hash);
}

/** What the build tells its service worker (prepended to sw.js). */
export interface SwBuild {
  /** Changes with every build: names the shell cache. */
  id: string;
  /** The app shell's files, besides "/" itself. */
  precache: string[];
  /** Content hashes of every map file and flag of this build. */
  offlineHashes: string[];
}
