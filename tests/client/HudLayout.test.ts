import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const doc = new DOMParser().parseFromString(
  fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8"),
  "text/html",
);
/** Tailwind width-dependent variants: what spec §14a removes from the HUD. */
const RESPONSIVE = /^(sm|md|lg|xl|2xl):|^(min|max)-\[/;

describe("index.html bottom HUD", () => {
  it("the in-game bottom HUD is one grid that never forces a horizontal scroll", () => {
    const hud = doc.querySelector<HTMLElement>("[data-bottom-hud]");
    expect(hud).not.toBeNull();
    const classes = [hud!, ...hud!.querySelectorAll("*")].flatMap((el) => [
      ...el.classList,
    ]);
    expect(classes.filter((c) => RESPONSIVE.test(c))).toEqual([]);
    // Only the HUD column has a fixed width; the side columns shrink to 0.
    expect(hud!.classList).toContain(
      "grid-cols-[minmax(0,1fr)_600px_minmax(0,1fr)]",
    );
  });

  it("always shows the build bar", () => {
    const bar = doc.querySelector("[data-bottom-hud] unit-display");
    expect(bar).not.toBeNull();
    expect(bar!.classList.contains("hidden")).toBe(false);
  });
});
