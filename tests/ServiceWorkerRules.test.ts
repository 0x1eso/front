import {
  assetHashOf,
  buildMetaTag,
  cachesToDelete,
  htmlBuildId,
  insertIntoHead,
  isCacheableResponse,
  isServerDown,
  isShellNavigation,
  keepOfflineEntry,
  markOfflineHtml,
  OFFLINE_CACHE,
  OFFLINE_META,
  routeRequest,
  shellCacheName,
} from "@openfront/shared/ServiceWorkerRules";
import { describe, expect, test } from "vitest";

const ORIGIN = "https://front.eserlic.cloud";

function route(path: string, mode = "cors", method = "GET", origin = ORIGIN) {
  return routeRequest({ url: `${origin}${path}`, method, mode }, ORIGIN);
}

describe("service worker routing", () => {
  describe("network first: the pages", () => {
    test.each(["/", "/?foo=1", "/#modal=single-player", "/player/abc"])(
      "a navigation to %s",
      (path) => {
        expect(route(path, "navigate")).toBe("navigate");
      },
    );

    test("a game link is a page too: offline it opens the menu", () => {
      expect(route("/w0/game/AbCdEfGh", "navigate")).toBe("navigate");
      expect(route("/game/AbCdEfGh", "navigate")).toBe("navigate");
    });

    test("only a navigation to / refreshes the cached app shell", () => {
      expect(isShellNavigation(`${ORIGIN}/`)).toBe(true);
      expect(isShellNavigation(`${ORIGIN}/?x=1`)).toBe(true);
      expect(isShellNavigation(`${ORIGIN}/w0/game/AbCdEfGh`)).toBe(false);
      expect(isShellNavigation(`${ORIGIN}/player/abc`)).toBe(false);
    });
  });

  describe("cache first: the build's hashed files", () => {
    test.each([
      "/assets/index-UTvwzk6A.js",
      "/assets/index-BDWjdTfp.css",
      "/assets/Worker.worker-n5XZfd5L.js",
      "/_assets/lang/ko.0123456789ab.json",
      "/_assets/images/background.0123456789ab.webp",
      "/_assets/manifest.0123456789ab.json",
      "/_assets/sounds/effects/click.0123456789ab.mp3",
    ])("%s, in this build's cache", (path) => {
      expect(route(path)).toBe("shell");
    });

    test.each([
      "/_assets/maps/world1936/map.0123456789ab.bin",
      "/_assets/maps/world/manifest.0123456789ab.json",
      "/_assets/flags/us.0123456789ab.svg",
    ])("%s, in the cache that outlives builds", (path) => {
      expect(route(path)).toBe("offline");
    });
  });

  describe("never cached", () => {
    test.each([
      "/api/health",
      "/api",
      "/api/create_game",
      "/selfhost-api/users/@me",
      "/lobbies",
      "/w0/api/game/abc",
      "/w0",
      "/w12/socket",
      "/desktop/version.json",
      "/.well-known/security.txt",
      "/sw.js",
      "/asset-manifest.json",
      "/asset-hashes.json",
      "/version.txt",
      "/robots.txt",
      "/apple-touch-icon.png",
    ])("%s", (path) => {
      expect(route(path)).toBe("network");
    });

    test("API navigations (sign-in redirects) are not answered from cache", () => {
      expect(route("/api/auth/callback?code=x", "navigate")).toBe("network");
      expect(route("/selfhost-api/x", "navigate")).toBe("network");
    });

    test("anything but a GET", () => {
      expect(route("/assets/index-UTvwzk6A.js", "cors", "POST")).toBe(
        "network",
      );
      expect(route("/", "cors", "HEAD")).toBe("network");
      expect(route("/", "navigate", "POST")).toBe("network");
    });

    test("other origins: the API host, CDNs, Turnstile", () => {
      expect(route("/assets/x.js", "cors", "GET", "https://cdn.example")).toBe(
        "network",
      );
      expect(
        route("/", "navigate", "GET", "https://challenges.cloudflare.com"),
      ).toBe("network");
    });

    test("a plain fetch of / is the server, not the cached shell", () => {
      // OfflineState's probe asks for exactly this.
      expect(route("/")).toBe("network");
    });

    test("an unparsable URL", () => {
      expect(
        routeRequest({ url: "::", method: "GET", mode: "cors" }, ORIGIN),
      ).toBe("network");
    });
  });

  test("keeps only whole same-origin 200s", () => {
    expect(isCacheableResponse({ status: 200, type: "basic" })).toBe(true);
    expect(isCacheableResponse({ status: 206, type: "basic" })).toBe(false);
    expect(isCacheableResponse({ status: 404, type: "basic" })).toBe(false);
    expect(isCacheableResponse({ status: 0, type: "opaque" })).toBe(false);
    expect(isCacheableResponse({ status: 200, type: "cors" })).toBe(false);
  });

  test("a 5xx from the proxy means the home server is down", () => {
    expect(isServerDown(502)).toBe(true);
    expect(isServerDown(530)).toBe(true);
    expect(isServerDown(500)).toBe(true);
    expect(isServerDown(404)).toBe(false);
    expect(isServerDown(200)).toBe(false);
  });
});

describe("the app shell's build", () => {
  const html = `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n  </head><body></body></html>`;

  test("the build writes its id into <head>, and the worker reads it", () => {
    const built = insertIntoHead(html, buildMetaTag("830cb31253626a2e"));
    expect(built).toContain(
      '<head>\n    <meta name="statecraft-build" content="830cb31253626a2e" />',
    );
    expect(htmlBuildId(built)).toBe("830cb31253626a2e");
  });

  test("a page with no build id names none", () => {
    expect(htmlBuildId(html)).toBeNull();
  });

  test("the offline copy carries the mark, ahead of the bootstrap script", () => {
    const offline = markOfflineHtml(insertIntoHead(html, buildMetaTag("abc")));
    expect(offline).toMatch(
      new RegExp(`<head>\\s*<meta name="${OFFLINE_META}" content="1" />`),
    );
    expect(htmlBuildId(offline)).toBe("abc");
  });

  test("keeps <head> attributes", () => {
    expect(insertIntoHead('<head data-x="1"><title>', "<meta>")).toBe(
      '<head data-x="1">\n    <meta><title>',
    );
  });
});

describe("versioned caches", () => {
  test("a new build deletes the old builds' caches, keeps the offline one", () => {
    const names = [
      shellCacheName("old1"),
      shellCacheName("new"),
      OFFLINE_CACHE,
      shellCacheName("old2"),
      "someone-elses-cache",
    ];
    expect(cachesToDelete(names, "new")).toEqual([
      shellCacheName("old1"),
      shellCacheName("old2"),
    ]);
  });

  test("reads the content hash from a hashed asset's name", () => {
    expect(assetHashOf("/_assets/maps/world/map.0123456789ab.bin")).toBe(
      "0123456789ab",
    );
    expect(
      assetHashOf(`${ORIGIN}/_assets/flags/1_East%20Anglia.abcdefabcdef.svg`),
    ).toBe("abcdefabcdef");
    expect(assetHashOf("/_assets/maps/world/map.bin")).toBeNull();
    expect(assetHashOf("/assets/index-UTvwzk6A.js")).toBeNull();
  });

  test("prunes map files and flags the current build no longer has", () => {
    const current = new Set(["0123456789ab"]);
    expect(
      keepOfflineEntry(
        `${ORIGIN}/_assets/maps/w/map.0123456789ab.bin`,
        current,
      ),
    ).toBe(true);
    expect(
      keepOfflineEntry(
        `${ORIGIN}/_assets/maps/w/map.ffffffffffff.bin`,
        current,
      ),
    ).toBe(false);
    expect(keepOfflineEntry(`${ORIGIN}/_assets/maps/w/map.bin`, current)).toBe(
      false,
    );
  });
});
