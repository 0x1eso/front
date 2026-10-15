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

  it("anchors the build-bar card above the whole HUD box", () => {
    // The card (UnitDisplay) has no positioned ancestor inside the bar, so it
    // opens above this box instead of over the attack-ratio row.
    const box = doc.querySelector(
      "[data-bottom-hud] unit-display",
    )!.parentElement!;
    expect(box.querySelector("control-panel")).not.toBeNull();
    expect(box.querySelector("domestic-hud")).not.toBeNull();
    expect(box.classList).toContain("relative");
  });

  it("marks the top-right stack the domestic drawer stays below", () => {
    const stack = doc.querySelector("[data-hud-top-right]");
    expect(stack).not.toBeNull();
    expect(stack!.querySelector("game-right-sidebar")).not.toBeNull();
    expect(stack!.querySelector("replay-panel")).not.toBeNull();
  });

  it("always shows the build bar", () => {
    const bar = doc.querySelector("[data-bottom-hud] unit-display");
    expect(bar).not.toBeNull();
    expect(bar!.classList.contains("hidden")).toBe(false);
  });
});
