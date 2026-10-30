import { SERVICE_WORKER_URL } from "@openfront/shared/ServiceWorkerRules";

const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

// The service worker's script names the build, so a deploy reaches installed
// apps only if every check sees the current one: no proxy or CDN may keep it
// (express.static would otherwise send its year-long max-age).
const REVALIDATE_CACHE_CONTROL = "no-cache";

function stripQueryString(urlPath: string): string {
  return urlPath.split("?", 1)[0];
}

export function getStaticAssetCacheControl(
  urlPath: string | undefined,
): string | undefined {
  if (!urlPath) {
    return undefined;
  }

  const normalizedPath = stripQueryString(urlPath);
  if (normalizedPath === SERVICE_WORKER_URL) {
    return REVALIDATE_CACHE_CONTROL;
  }
  if (
    normalizedPath.startsWith("/assets/") ||
    normalizedPath.startsWith("/_assets/")
  ) {
    return IMMUTABLE_CACHE_CONTROL;
  }

  return undefined;
}

export function applyStaticAssetCacheControl(
  setHeader: (name: string, value: string) => void,
  urlPath: string | undefined,
): void {
  const cacheControl = getStaticAssetCacheControl(urlPath);
  if (cacheControl) {
    setHeader("Cache-Control", cacheControl);
  }
}
