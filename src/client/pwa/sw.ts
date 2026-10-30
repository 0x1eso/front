// The service worker: lets an installed (or bookmarked) Statecraft open and
// play single-player games with no network. The rules it follows live in
// packages/shared/src/ServiceWorkerRules.ts. The build (src/server/
// PwaBuild.ts, run from vite.config.ts) bundles this file into static/sw.js
// and prepends `__SW_BUILD__`, the build's id and file list. Registered by
// RegisterServiceWorker.ts, in production builds only.
//
// Versioning: every build's sw.js differs (its id changes), so the browser
// installs the new worker on the next visit. The install fills a new shell
// cache with that build's index.html and files, then takes over at once
// (skipWaiting + claim); the page that triggered it was itself loaded from
// the network, so it already runs that build. Old shell caches are deleted
// on activation. The cached index.html is only ever the one from the
// worker's own build, so an offline load never meets an index.html whose
// files are missing.

import {
  cachesToDelete,
  htmlBuildId,
  isCacheableResponse,
  isServerDown,
  isShellNavigation,
  keepOfflineEntry,
  markOfflineHtml,
  OFFLINE_CACHE,
  routeRequest,
  SHELL_KEY,
  shellCacheName,
  type SwBuild,
} from "@openfront/shared/ServiceWorkerRules";

declare const __SW_BUILD__: SwBuild;

// The DOM lib the client compiles with has no service-worker scope types;
// these are the parts this worker uses.
interface ExtendableEvent extends Event {
  waitUntil(promise: Promise<unknown>): void;
}
interface FetchEvent extends ExtendableEvent {
  readonly request: Request;
  readonly preloadResponse?: Promise<Response | undefined>;
  respondWith(response: Promise<Response>): void;
}
interface WorkerScope {
  readonly location: Location;
  readonly registration: ServiceWorkerRegistration;
  readonly clients: { claim(): Promise<void> };
  skipWaiting(): Promise<void>;
  addEventListener(
    type: "install" | "activate",
    listener: (event: ExtendableEvent) => void,
  ): void;
  addEventListener(type: "fetch", listener: (event: FetchEvent) => void): void;
}

const scope = globalThis as unknown as WorkerScope;
const BUILD = __SW_BUILD__;
const SHELL_CACHE = shellCacheName(BUILD.id);
const OFFLINE_HASHES = new Set(BUILD.offlineHashes);

// How long a navigation may wait on the network before the cached shell is
// shown instead (only when there is one): a connection that answers nothing.
const NAVIGATION_TIMEOUT_MS = 8000;
// Parallel downloads while precaching.
const PRECACHE_CONCURRENCY = 6;

scope.addEventListener("install", (event) => {
  event.waitUntil(install());
});

scope.addEventListener("activate", (event) => {
  event.waitUntil(activate());
});

scope.addEventListener("fetch", (event) => {
  const request = event.request;
  const route = routeRequest(request, scope.location.origin);
  switch (route) {
    case "network":
      // Not answered here: the browser fetches it exactly as without a
      // worker.
      return;
    case "navigate":
      event.respondWith(navigate(event));
      return;
    case "shell":
      event.respondWith(cacheFirst(event, SHELL_CACHE));
      return;
    case "offline":
      event.respondWith(cacheFirst(event, OFFLINE_CACHE));
      return;
  }
});

async function install(): Promise<void> {
  const cache = await caches.open(SHELL_CACHE);
  await cacheAppShell(cache);
  await runLimited(BUILD.precache, PRECACHE_CONCURRENCY, (url) =>
    precacheOne(cache, url),
  );
  await scope.skipWaiting();
}

/**
 * This build's index.html, under "/". Refuses one from another build (a
 * deploy that landed between sw.js and this fetch, or a proxy's stale copy):
 * the install fails and is retried on the next visit, rather than keeping a
 * page whose files this cache does not have.
 */
async function cacheAppShell(cache: Cache): Promise<void> {
  const response = await fetch(SHELL_KEY, {
    cache: "reload",
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error(`app shell answered ${response.status}`);
  }
  const html = await response.text();
  const built = htmlBuildId(html);
  if (built !== BUILD.id) {
    throw new Error(`app shell is build ${built}, this worker ${BUILD.id}`);
  }
  await cache.put(SHELL_KEY, htmlResponse(html));
}

async function precacheOne(cache: Cache, url: string): Promise<void> {
  if (await cache.match(url)) return;
  // Hashed names: the same URL in an older build's cache (or the offline
  // cache) is the same file, so a deploy only downloads what changed.
  const kept = await caches.match(url);
  if (kept) {
    await cache.put(url, kept);
    return;
  }
  const response = await fetch(url, { credentials: "same-origin" });
  if (!isCacheableResponse(response)) {
    throw new Error(`precache ${url} answered ${response.status}`);
  }
  await cache.put(url, response);
}

async function activate(): Promise<void> {
  const names = await caches.keys();
  await Promise.all(
    cachesToDelete(names, BUILD.id).map((name) => caches.delete(name)),
  );
  await pruneOfflineCache();
  // Starts the navigation's request while the worker boots, so network
  // first costs nothing when online.
  await scope.registration.navigationPreload?.enable().catch(() => {});
  await scope.clients.claim();
}

/** Drops map files and flags this build no longer has. */
async function pruneOfflineCache(): Promise<void> {
  if (!(await caches.has(OFFLINE_CACHE))) return;
  const cache = await caches.open(OFFLINE_CACHE);
  for (const request of await cache.keys()) {
    if (!keepOfflineEntry(request.url, OFFLINE_HASHES)) {
      await cache.delete(request);
    }
  }
}

async function navigate(event: FetchEvent): Promise<Response> {
  const shellCache = await caches.open(SHELL_CACHE);
  const cached = await shellCache.match(SHELL_KEY);
  let response: Response;
  try {
    response = await withTimeout(
      networkNavigation(event),
      cached ? NAVIGATION_TIMEOUT_MS : null,
    );
  } catch {
    if (cached) return offlineShell(cached);
    throw new Error("offline, and no app shell cached yet");
  }
  if (isServerDown(response.status) && cached) return offlineShell(cached);
  if (response.ok && isShellNavigation(event.request.url)) {
    event.waitUntil(refreshAppShell(shellCache, response.clone()));
  }
  return response;
}

async function networkNavigation(event: FetchEvent): Promise<Response> {
  // Undefined where navigation preload is not supported at all.
  const preload = event.preloadResponse;
  const preloaded = preload ? await preload.catch(() => undefined) : undefined;
  return preloaded ?? fetch(event.request);
}

/** Keeps a fresher copy of this build's shell; never another build's. */
async function refreshAppShell(cache: Cache, response: Response) {
  const html = await response.text();
  if (htmlBuildId(html) === BUILD.id) {
    await cache.put(SHELL_KEY, htmlResponse(html));
  }
}

async function offlineShell(cached: Response): Promise<Response> {
  return htmlResponse(markOfflineHtml(await cached.text()));
}

function htmlResponse(html: string): Response {
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

async function cacheFirst(
  event: FetchEvent,
  runtimeCache: string,
): Promise<Response> {
  const request = event.request;
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  // A range request gets a 206, which a cache cannot hold.
  if (isCacheableResponse(response) && !request.headers.has("range")) {
    const copy = response.clone();
    event.waitUntil(
      caches.open(runtimeCache).then((cache) => cache.put(request, copy)),
    );
  }
  return response;
}

function withTimeout<T>(promise: Promise<T>, ms: number | null): Promise<T> {
  if (ms === null) return promise;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function runLimited<T>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      await task(item);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
}
