import { render } from "lit";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as Utils from "../../src/client/Utils";
import { WinModal } from "../../src/client/hud/layers/WinModal";

describe("win modal", () => {
  it("renders no YouTube embed, even for a loss early in a new player's career", () => {
    const modal = document.createElement("win-modal") as WinModal;
    expect(modal).toBeInstanceOf(WinModal);
    (modal as unknown as { isWin: boolean }).isWin = false;
    const host = document.createElement("div");
    render(modal.innerHtml(), host);
    expect(host.innerHTML).not.toMatch(/youtube|youtu\.be/i);
    expect(host.querySelector("iframe")).toBeNull();
    expect(host.querySelector("video")).toBeNull();
  });

  it("has no video URL or embed left in the source", () => {
    const src = readFileSync("src/client/hud/layers/WinModal.ts", "utf8");
    expect(src).not.toMatch(/youtube|iframe>|<video|VIDEO_URL/i);
    expect("TUTORIAL_VIDEO_URL" in Utils).toBe(false);
    expect("DESKTOP_TUTORIAL_VIDEO_URL" in Utils).toBe(false);
  });
});
