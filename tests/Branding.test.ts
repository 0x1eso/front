import {
  GAME_TITLE,
  SOURCE_URL,
  UPSTREAM_URL,
} from "@openfront/shared/Branding";
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");

function readJson(relativePath: string): any {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

// LICENSE, "ADDITIONAL TERMS (AGPL v3 Section 7)": a modified version keeps
// "© OpenFront and Contributors" visible (7(b)) and must not use "OpenFront"
// as its primary title (7(c)). AGPL section 13 obliges offering the source.
describe("fork branding", () => {
  test("every language file that has it carries the based-on line", () => {
    expect(readJson("resources/lang/en.json").branding.based_on).toBe(
      "Based on OpenFront",
    );
    expect(readJson("resources/lang/ko.json").branding.based_on).toContain(
      "OpenFront",
    );
  });

  // LICENSE section 7(c): OpenFront Inc.'s own documents and ad-seller list
  // must not be served from this fork's site root. A merge from upstream
  // brings them back; this fails when it does.
  test("upstream's public documents are not served as the fork's", () => {
    for (const name of [
      "ads.txt",
      "terms-of-service.html",
      "privacy-policy.html",
      "press",
      // OpenFront Inc.'s Apple Pay domain verification (its payment identity).
      ".well-known",
    ]) {
      expect(
        fs.existsSync(path.join(ROOT, "resources", "public", name)),
        `resources/public/${name}`,
      ).toBe(false);
    }
  });

  test("the game is not titled OpenFront", () => {
    expect(GAME_TITLE.length).toBeGreaterThan(0);
    expect(GAME_TITLE).toBe(GAME_TITLE.trim());
    expect(GAME_TITLE).not.toMatch(/open\s*front/i);
  });

  test("the web app manifest carries the same name", () => {
    const manifest = readJson("resources/manifest.json");
    expect(manifest.name).toBe(GAME_TITLE);
    expect(manifest.short_name).toBe(GAME_TITLE);
  });

  test("English text takes the name from GAME_TITLE", () => {
    const en = readJson("resources/lang/en.json");
    expect(en.branding.title).toBe("{name}");
    expect(en.main.title).toBeUndefined();
  });

  test("Korean text spells the name its own way, and not as OpenFront", () => {
    const title = readJson("resources/lang/ko.json").branding.title;
    expect(typeof title).toBe("string");
    expect(title).not.toMatch(/open\s*front|오픈\s*프론트/i);
  });

  test("the upstream copyright notice is kept", () => {
    expect(readJson("resources/lang/en.json").main.copyright).toMatch(
      /^© OpenFront™? and Contributors$/,
    );
  });

  test("the source offer points at this fork's public repository", () => {
    expect(SOURCE_URL).toBe("https://github.com/0x1eso/front");
    expect(UPSTREAM_URL).toBe("https://github.com/openfrontio/OpenFrontIO");
  });
});

// Text a guest meets on this server. These must not present the game as
// OpenFront. Some other strings in en.json still name OpenFront: they sit
// behind account, store and Steam screens a self-hosted server hides, or are
// unused. Locales other than en and ko are left as upstream wrote them.
const GUEST_VISIBLE_KEYS = [
  "common.backend_unreachable",
  "mode_selector.servers_unreachable",
  "graphics_setting.preset_default_desc",
  "help_modal.troubleshooting_desc",
  "help_modal.video_tutorial_title",
  "ios_banner.modal_desc",
  "ios_banner.text",
  "troubleshooting.chromium_tip",
  "update_available.message",
  "win_modal.support_openfront",
  "replay_viewer.unavailable_desync",
  "replay_viewer.unavailable_other_build",
  "marketing_consent.title",
];

describe.each(["en", "ko"])("%s guest-visible text", (lang) => {
  test.each(GUEST_VISIBLE_KEYS)("%s does not name OpenFront", (key) => {
    const json = readJson(`resources/lang/${lang}.json`);
    const value = key.split(".").reduce((node, part) => node[part], json);
    expect(typeof value).toBe("string");
    expect(value).not.toMatch(/open\s*front|오픈\s*프론트/i);
  });
});

test("the quick-chat Discord line does not name OpenFront", () => {
  const value = readJson("resources/lang/en.json").chat.misc.join_discord;
  expect(typeof value).toBe("string");
  expect(value).not.toMatch(/open\s*front|오픈\s*프론트/i);
});
