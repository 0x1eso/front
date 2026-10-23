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
      "grid-cols-[minmax(0,1fr)_minmax(0,560px)_minmax(0,1fr)]",
    );
  });

  it("anchors the build-bar card above the whole HUD box", () => {
    // The card (UnitDisplay) has no positioned ancestor inside the bar, so it
    // opens above this box instead of over the attack-ratio row.
    const box = doc.querySelector("[data-bottom-hud-rows]")!;
    expect(box.contains(doc.querySelector("unit-display"))).toBe(true);
    expect(box.querySelector("control-panel")).not.toBeNull();
    expect(box.classList).toContain("relative");
    // The inner column holding the panel and the hotbar is not positioned.
    expect(
      doc.querySelector("unit-display")!.parentElement!.classList,
    ).not.toContain("relative");
  });

  it("puts the domestic dials at the left of the rows, the panel and hotbar to their right", () => {
    const rows = doc.querySelector<HTMLElement>("[data-bottom-hud-rows]")!;
    expect(rows.classList).toContain("flex-row");
    // World War 1936: its dock is not in the rows; it is a slim fixed row
    // above them, over the full-screen panels (z-[1003] > the panels' 1002).
    const [dials, column] = [...rows.children];
    expect(dials.tagName.toLowerCase()).toBe("domestic-dials");
    expect(dials.classList).toContain("shrink-0");
    const wwDials = doc.querySelector("ww-dials")!;
    expect(rows.contains(wwDials)).toBe(false);
    expect(wwDials.classList).toContain("fixed");
    expect(wwDials.classList).toContain("z-[1003]");
    expect(column.querySelector("control-panel")).not.toBeNull();
    expect(column.querySelector("unit-display")).not.toBeNull();
    expect(doc.querySelector("domestic-hud")).toBeNull();
    // control-panel sits above unit-display in the right-hand column.
    expect(
      column
        .querySelector("control-panel")!
        .compareDocumentPosition(column.querySelector("unit-display")!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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

  it("mounts the World War 1936 land screens among the overlays", () => {
    // P2 (spec §15): the army drawer, the chosen army's card, a battle's card.
    for (const tag of ["ww-army-panel", "ww-army-card", "ww-battle-card"]) {
      const el = doc.querySelector(tag);
      expect(el).not.toBeNull();
      // Outside the bottom HUD: the cards place themselves above its rows.
      expect(doc.querySelector("[data-bottom-hud]")!.contains(el)).toBe(false);
    }
  });

  it("puts the congress cards right above the HUD rows and the band among the overlays", () => {
    const rows = doc.querySelector("[data-bottom-hud-rows]")!;
    const cards = doc.querySelector("congress-cards")!;
    expect(cards).not.toBeNull();
    // The World War 1936 dock keeps a spacer between them (its height).
    const spacer = cards.nextElementSibling!;
    expect(spacer.hasAttribute("data-ww-dock-spacer")).toBe(true);
    expect(spacer.nextElementSibling).toBe(rows);
    expect(
      doc
        .querySelector("satellite-band")!
        .nextElementSibling!.tagName.toLowerCase(),
    ).toBe("congress-band");
  });
});
