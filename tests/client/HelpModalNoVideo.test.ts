import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/client/Utils")>()),
  translateText: (key: string) => `[${key}]`,
}));

import { readFileSync } from "node:fs";
import { HelpModal } from "../../src/client/HelpModal";

describe("help page", () => {
  it("renders no video embed and never calls out to YouTube", async () => {
    const modal = document.createElement("help-modal") as HelpModal;
    expect(modal).toBeInstanceOf(HelpModal);
    document.body.appendChild(modal);
    (modal as unknown as { isModalOpen: boolean }).isModalOpen = true;
    await modal.updateComplete;
    const markup = modal.outerHTML;
    expect(markup).toContain("help_modal.in_game_tutorial");
    expect(markup).toContain("help_modal.troubleshooting");
    expect(markup).not.toMatch(/youtube|youtu\.be/i);
    expect(modal.querySelector("iframe")).toBeNull();
    expect(modal.querySelector("video")).toBeNull();
    document.body.innerHTML = "";
  });

  it("has no video text left in the help strings or the source", () => {
    const en = JSON.parse(readFileSync("resources/lang/en.json", "utf8"));
    expect(Object.keys(en.help_modal).filter((k) => /video/.test(k))).toEqual(
      [],
    );
    const src = readFileSync("src/client/HelpModal.ts", "utf8");
    expect(src).not.toMatch(/youtube|iframe|VIDEO_URL/i);
  });
});
