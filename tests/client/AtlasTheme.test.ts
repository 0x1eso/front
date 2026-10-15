import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

// The light "atlas" theme (src/client/atlas.css) covers the menus only: it
// is keyed on .atlas, which index.html puts on the homepage container and the
// loading card. The in-game HUD overlays the map and keeps its dark look.
const root = path.join(__dirname, "../..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

function page(): Document {
  // The template's EJS placeholders are irrelevant to the markup checked here.
  return new DOMParser().parseFromString(read("index.html"), "text/html");
}

describe("the atlas theme", () => {
  it("is imported by styles.css, and the Halloween theme is gone", () => {
    const styles = read("src/client/styles.css");
    expect(styles).toContain('@import "./atlas.css";');
    expect(styles).not.toMatch(/halloween/i);
    expect(read("index.html")).not.toMatch(/halloween/i);
    expect(fs.existsSync(path.join(root, "src/client/halloween.css"))).toBe(
      false,
    );
  });

  it("covers the menus and the loading card", () => {
    const doc = page();
    const scopes = Array.from(doc.querySelectorAll(".atlas"));
    expect(scopes.some((el) => el.querySelector("main-layout"))).toBe(true);
    expect(scopes.some((el) => el.querySelector("page-footer"))).toBe(true);
    expect(doc.querySelector("game-starting-modal.atlas")).not.toBeNull();
  });

  it("leaves the in-game HUD out of it", () => {
    const doc = page();
    for (const selector of [
      "[data-bottom-hud]",
      "[data-hud-top-right]",
      "#app",
      "build-menu",
      "win-modal",
      "settings-modal",
      "#game-settings",
      "game-left-sidebar",
      "map-controls",
    ]) {
      const el = doc.querySelector(selector);
      expect(el, selector).not.toBeNull();
      expect(el!.closest(".atlas"), selector).toBeNull();
    }
  });

  it("loads nothing from other sites: no web fonts, no remote images", () => {
    const css = read("src/client/atlas.css");
    expect(css).not.toMatch(/@font-face|@import\s+url|url\(\s*["']?https?:/i);
  });
});
