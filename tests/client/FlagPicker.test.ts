// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@openfront/shared/AssetUrls", () => ({
  assetUrl: (path: string) => `/${path}`,
}));
vi.mock("../../src/client/Utils", () => ({
  translateText: (key: string) => key,
}));

import {
  FlagPicker,
  filterFlags,
} from "../../src/client/components/FlagPicker";

describe("flag picker", () => {
  let el: FlagPicker;

  async function mount() {
    if (!customElements.get("flag-picker")) {
      customElements.define("flag-picker", FlagPicker);
    }
    el = document.createElement("flag-picker") as FlagPicker;
    document.body.appendChild(el);
    await el.updateComplete;
  }

  beforeEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("filters by code, English and Korean names", () => {
    expect(filterFlags("").length).toBeGreaterThan(100);
    expect(filterFlags("japan").map((e) => e.code)).toContain("jp");
    expect(filterFlags("zzzzzz")).toEqual([]);
    const ko = filterFlags("일본");
    if (ko.length > 0) expect(ko.map((e) => e.code)).toContain("jp");
  });

  it("shows the placeholder, then saves a picked flag and updates the button", async () => {
    await mount();
    const button = el.querySelector("[data-flag-button]")!;
    expect(button.querySelector("img")).toBeNull();
    expect(button.textContent).toContain("main.flag_none");

    (button as HTMLElement).click();
    await el.updateComplete;
    const input = el.querySelector("[data-flag-search]") as HTMLInputElement;
    input.value = "japan";
    input.dispatchEvent(new Event("input"));
    await el.updateComplete;
    const tile = el.querySelector("[data-flag-code=jp]") as HTMLElement;
    expect(tile).not.toBeNull();
    expect(el.querySelector("[data-flag-code=us]")).toBeNull();
    tile.click();
    await el.updateComplete;

    expect(localStorage.getItem("flag")).toBe("country:jp");
    expect(el.querySelector("[data-flag-search]")).toBeNull();
    expect(
      el.querySelector("[data-flag-button] img")!.getAttribute("src"),
    ).toBe("/flags/jp.svg");
  });

  it("the none option clears the flag", async () => {
    localStorage.setItem("flag", "country:jp");
    await mount();
    expect(el.querySelector("[data-flag-button] img")).not.toBeNull();
    (el.querySelector("[data-flag-button]") as HTMLElement).click();
    await el.updateComplete;
    (el.querySelector("[data-flag-none]") as HTMLElement).click();
    await el.updateComplete;
    expect(localStorage.getItem("flag")).toBeNull();
    expect(el.querySelector("[data-flag-button] img")).toBeNull();
  });
});
