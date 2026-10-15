import { DomesticData } from "@openfront/engine-api/domestic/DomesticTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { describe, expect, it } from "vitest";
import { ToggleDomesticPanelEvent } from "../../src/client/hud/domestic/DomesticEvents";
import "../../src/client/hud/domestic/DomesticHud";
import type { DomesticHud } from "../../src/client/hud/domestic/DomesticHud";
import { SetRecruitTargetIntentEvent } from "../../src/client/Transport";
import type { GameView } from "../../src/client/view";

// Only the fields the HUD reads; the cast keeps this valid as DomesticData grows.
const DATA = {
  science: 120,
  political: 45,
  sciencePerSec: 2.5,
  politicalPerSec: 1,
  recruitTargetPct: 80,
} as unknown as DomesticData;

async function mount(): Promise<DomesticHud> {
  const el = document.createElement("domestic-hud") as DomesticHud;
  el.game = {
    myPlayer: () => ({ isAlive: () => true, domesticData: () => DATA }),
    inSpawnPhase: () => false,
  } as unknown as GameView;
  el.eventBus = new EventBus();
  document.body.appendChild(el);
  el.tick();
  await el.updateComplete;
  return el;
}

describe("domestic HUD on a tablet", () => {
  it("writes the resource names instead of hiding them in tooltips", async () => {
    const el = await mount();
    expect(
      el.querySelector('[data-domestic="science"]')!.textContent,
    ).toContain("domestic.science");
    expect(
      el.querySelector('[data-domestic="political"]')!.textContent,
    ).toContain("domestic.political");
    expect(el.querySelectorAll("[title]")).toHaveLength(0);
  });

  it("the recruit slider is the thick one and sends the new target", async () => {
    const el = await mount();
    const targets: number[] = [];
    el.eventBus.on(SetRecruitTargetIntentEvent, (e) => targets.push(e.percent));
    const slider = el.querySelector<HTMLInputElement>('input[type="range"]')!;
    expect(slider.classList.contains("touch-range")).toBe(true);

    slider.value = "60";
    slider.dispatchEvent(new Event("change"));

    expect(targets).toEqual([60]);
  });

  it("opens the panel with a 44px button", async () => {
    const el = await mount();
    let toggles = 0;
    el.eventBus.on(ToggleDomesticPanelEvent, () => toggles++);
    const button = el.querySelector<HTMLButtonElement>(
      '[data-domestic="open-panel"]',
    )!;
    expect(button.classList.contains("h-11")).toBe(true);

    button.click();

    expect(toggles).toBe(1);
  });
});
