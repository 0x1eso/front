// @vitest-environment jsdom
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAppShellContentCache,
  renderHtmlContent,
} from "../../src/server/RenderHtml";

const REAL_TEMPLATE = path.resolve(__dirname, "../../index.html");

// Runs the page's inline bootstrap script against this test's document, the
// way the browser runs it before any bundle loads.
function runBootstrapScript(html: string): void {
  const match =
    /<script>\s*(window\.BOOTSTRAP_CONFIG = [\s\S]*?)<\/script>/.exec(html);
  if (match === null) throw new Error("rendered page has no bootstrap script");
  new Function(match[1])();
}

describe("index.html as a self-hosted server renders it", () => {
  beforeEach(() => {
    vi.stubEnv("INSTANCE_LETTER", "a");
    vi.stubEnv("NUM_WORKERS", "2");
    vi.stubEnv("DOMAIN", "play.example.com");
    vi.stubEnv("GIT_COMMIT", "abc");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    clearAppShellContentCache();
    document.documentElement.className = "";
    document.head
      .querySelectorAll("script")
      .forEach((script) => script.remove());
    window.BOOTSTRAP_CONFIG = undefined;
  });

  it("marks the page self-hosted and loads no Turnstile", async () => {
    vi.stubEnv("SELF_HOSTED", "true");
    vi.stubEnv("TURNSTILE_SITE_KEY", "");
    runBootstrapScript(await renderHtmlContent(REAL_TEMPLATE));
    expect(window.BOOTSTRAP_CONFIG?.selfHosted).toBe(true);
    expect(window.BOOTSTRAP_CONFIG?.turnstileSiteKey).toBe("");
    expect(document.documentElement.classList.contains("self-hosted")).toBe(
      true,
    );
    expect(
      document.querySelector('script[src*="challenges.cloudflare.com"]'),
    ).toBeNull();
  });

  it("keeps Turnstile on a server that is not self-hosted", async () => {
    vi.stubEnv("TURNSTILE_SITE_KEY", "key");
    runBootstrapScript(await renderHtmlContent(REAL_TEMPLATE));
    expect(window.BOOTSTRAP_CONFIG?.selfHosted).toBeUndefined();
    expect(document.documentElement.classList.contains("self-hosted")).toBe(
      false,
    );
    expect(
      document.querySelector('script[src*="challenges.cloudflare.com"]'),
    ).not.toBeNull();
  });

  it.each([["true"], [""]])(
    "loads none of OpenFront's ad, analytics or portal tags (SELF_HOSTED=%j)",
    async (selfHosted) => {
      vi.stubEnv("SELF_HOSTED", selfHosted);
      vi.stubEnv("TURNSTILE_SITE_KEY", "key");
      const html = await renderHtmlContent(REAL_TEMPLATE);
      expect(html).not.toMatch(
        /googletagmanager|googletag|cloudflareinsights|intergient|crazygames-sdk|window\.ramp/,
      );
    },
  );
});
