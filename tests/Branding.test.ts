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
