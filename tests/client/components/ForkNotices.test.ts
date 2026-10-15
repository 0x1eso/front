import { SOURCE_URL, UPSTREAM_URL } from "@openfront/shared/Branding";
import { afterEach, describe, expect, it } from "vitest";
import { ClientEnv } from "../../../src/client/ClientEnv";
import "../../../src/client/components/DesktopNavBar";
import "../../../src/client/components/Footer";
import "../../../src/client/components/MobileNavBar";
import "../../../src/client/components/PlayPage";
import "../../../src/client/GameStartingModal";

// jsdom has no ResizeObserver, and the mobile top bar shares a subtree with
// <steam-wishlist>, which constructs one on first update.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

type Mountable = HTMLElement & { updateComplete: Promise<unknown> };

async function mount(tag: string): Promise<Mountable> {
  const el = document.createElement(tag) as Mountable;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const SHA = "bf739f86c4e1d2a3b5c6d7e8f90123456789abcd";

// The page as a server renders it, running commit `gitCommit`.
function bootstrap(gitCommit: string) {
  (window as { BOOTSTRAP_CONFIG?: unknown }).BOOTSTRAP_CONFIG = {
    gameEnv: "prod",
    numWorkers: 1,
    turnstileSiteKey: "",
    jwtAudience: "play.example.com",
    instanceId: "test",
    gitCommit,
  };
  ClientEnv.reset();
}

afterEach(() => {
  document.body.innerHTML = "";
  delete (window as { BOOTSTRAP_CONFIG?: unknown }).BOOTSTRAP_CONFIG;
  ClientEnv.reset();
});

// LICENSE, AGPL v3 section 7 and section 13. Without a <lang-selector> in the
// page, translateText answers with the key, which is what these look for.
describe("footer notices", () => {
  it("offers this fork's source to every player", async () => {
    const footer = await mount("page-footer");
    expect(
      footer.querySelector(
        `a[href="${SOURCE_URL}"][data-i18n="branding.source_code"]`,
      ),
    ).not.toBeNull();
    const github = footer.querySelector('img[data-i18n-alt="main.github"]');
    expect(github?.closest("a")?.getAttribute("href")).toBe(SOURCE_URL);
  });

  // The repository's default branch mirrors upstream: the offer has to name
  // the commit the server runs.
  it("links the source of the commit the server runs", async () => {
    bootstrap(SHA);
    const footer = await mount("page-footer");
    const tree = `${SOURCE_URL}/tree/${SHA}`;
    expect(
      footer.querySelector(
        `a[href="${tree}"][data-i18n="branding.source_code"]`,
      ),
    ).not.toBeNull();
    const github = footer.querySelector('img[data-i18n-alt="main.github"]');
    expect(github?.closest("a")?.getAttribute("href")).toBe(tree);
  });

  it("keeps the upstream copyright and says what the game is based on", async () => {
    const footer = await mount("page-footer");
    expect(footer.querySelector('[data-i18n="main.copyright"]')).not.toBeNull();
    expect(
      footer.querySelector(
        `a[href="${UPSTREAM_URL}"][data-i18n="branding.based_on"]`,
      ),
    ).not.toBeNull();
  });

  it("links none of upstream's community or legal pages as its own", async () => {
    const footer = await mount("page-footer");
    const hrefs = Array.from(footer.querySelectorAll("a")).map(
      (a) => a.getAttribute("href") ?? "",
    );
    expect(
      hrefs.filter((href) =>
        /discord\.gg\/openfront|reddit\.com\/r\/OpenFront|terms-of-service|privacy-policy/.test(
          href,
        ),
      ),
    ).toEqual([]);
  });
});

describe("loading screen notices", () => {
  it("shows the copyright, the based-on line and the source link", async () => {
    const modal = await mount("game-starting-modal");
    expect(modal.textContent).toContain("main.copyright");
    expect(modal.textContent).toContain("branding.based_on");
    // No BOOTSTRAP_CONFIG, so no commit to name: the repository itself.
    expect(modal.querySelectorAll(`a[href="${SOURCE_URL}"]`)).toHaveLength(2);
  });

  it("links the source and credits of the commit the server runs", async () => {
    bootstrap(SHA);
    const modal = await mount("game-starting-modal");
    expect(
      modal.querySelector(`a[href="${SOURCE_URL}/tree/${SHA}"]`),
    ).not.toBeNull();
    expect(
      modal.querySelector(`a[href="${SOURCE_URL}/blob/${SHA}/CREDITS.md"]`),
    ).not.toBeNull();
  });
});

describe("menus", () => {
  it.each(["desktop-nav-bar", "mobile-nav-bar", "play-page"])(
    "%s shows the wordmark, not upstream's logo",
    async (tag) => {
      const el = await mount(tag);
      expect(el.querySelector("game-wordmark")).not.toBeNull();
      expect(el.querySelector('img[src*="OpenFrontLogo"]')).toBeNull();
    },
  );
});
