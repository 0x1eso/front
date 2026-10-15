import { EventBus } from "@openfront/shared/EventBus";
import { describe, expect, it } from "vitest";
import "../../src/client/hud/layers/MapControls";
import type { MapControls } from "../../src/client/hud/layers/MapControls";
import {
  AlternateViewEvent,
  CenterCameraEvent,
  ToggleCoordinateGridEvent,
} from "../../src/client/InputHandler";

async function mount(): Promise<MapControls> {
  const el = document.createElement("map-controls") as MapControls;
  el.eventBus = new EventBus();
  document.body.appendChild(el);
  el.init();
  await el.updateComplete;
  return el;
}

function button(el: MapControls, id: string): HTMLButtonElement {
  return el.querySelector<HTMLButtonElement>(`[data-map-control="${id}"]`)!;
}

describe("map-controls", () => {
  it("renders nothing before a game hands it the bus", async () => {
    const el = document.createElement("map-controls") as MapControls;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.querySelector("button")).toBeNull();
  });

  it("has three 44px buttons", async () => {
    const el = await mount();
    const buttons = [...el.querySelectorAll("button")];
    expect(buttons.map((b) => b.dataset.mapControl)).toEqual([
      "center",
      "view",
      "grid",
    ]);
    for (const b of buttons) {
      expect(b.classList.contains("size-11")).toBe(true);
      expect(b.getAttribute("aria-label")).not.toBe("");
    }
  });

  it("centers the camera on my nation", async () => {
    const el = await mount();
    let centered = 0;
    el.eventBus.on(CenterCameraEvent, () => centered++);

    button(el, "center").click();

    expect(centered).toBe(1);
  });

  it("toggles the relation view on and off", async () => {
    const el = await mount();
    const views: boolean[] = [];
    el.eventBus.on(AlternateViewEvent, (e) => views.push(e.alternateView));

    button(el, "view").click();
    await el.updateComplete;
    expect(button(el, "view").getAttribute("aria-pressed")).toBe("true");
    button(el, "view").click();
    await el.updateComplete;

    expect(views).toEqual([true, false]);
    expect(button(el, "view").getAttribute("aria-pressed")).toBe("false");
  });

  it("follows the M key's grid toggle", async () => {
    const el = await mount();
    const grids: boolean[] = [];
    el.eventBus.on(ToggleCoordinateGridEvent, (e) => grids.push(e.enabled));

    el.eventBus.emit(new ToggleCoordinateGridEvent(true));
    await el.updateComplete;
    expect(button(el, "grid").getAttribute("aria-pressed")).toBe("true");

    button(el, "grid").click();

    expect(grids).toEqual([true, false]);
  });
});
