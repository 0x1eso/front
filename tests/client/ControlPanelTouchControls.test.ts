import { EventBus } from "@openfront/shared/EventBus";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "../../src/client/hud/layers/ControlPanel";
import type { ControlPanel } from "../../src/client/hud/layers/ControlPanel";
import { AttackRatioEvent } from "../../src/client/InputHandler";
import type { UIState } from "../../src/client/UIState";
import { UserSettings } from "../../src/client/UserSettings";
import type { GameView } from "../../src/client/view";

describe("control-panel attack ratio controls", () => {
  let panel: ControlPanel;
  let uiState: UIState;

  beforeEach(async () => {
    document.body.innerHTML = "";
    localStorage.clear();
    (
      UserSettings as unknown as { cache: Map<string, string | null> }
    ).cache.clear();
    new UserSettings().setAttackRatio(0.2);

    panel = document.createElement("control-panel") as ControlPanel;
    uiState = { attackRatio: 0 } as UIState;
    panel.uiState = uiState;
    panel.eventBus = new EventBus();
    panel.game = {
      inSpawnPhase: () => false,
      myPlayer: () => ({ isAlive: () => true, troops: () => 100_000 }),
    } as unknown as GameView;
    document.body.appendChild(panel);
    panel.init();
    panel.setVisibile(true);
    await panel.updateComplete;
  });

  afterEach(() => {
    panel.remove();
  });

  async function click(selector: string): Promise<void> {
    panel.querySelector<HTMLButtonElement>(selector)!.click();
    await panel.updateComplete;
  }

  function slider(): HTMLInputElement {
    return panel.querySelector<HTMLInputElement>('input[type="range"]')!;
  }

  it("the steppers clamp at 1% and 100% and snap 1% up to 10%", async () => {
    await click('[data-ratio-step="up"]');
    expect(uiState.attackRatio).toBeCloseTo(0.3);

    await click('[data-ratio-preset="100"]');
    await click('[data-ratio-step="up"]');
    expect(uiState.attackRatio).toBe(1);

    await click('[data-ratio-preset="25"]');
    for (let i = 0; i < 3; i++) await click('[data-ratio-step="down"]');
    expect(uiState.attackRatio).toBe(0.01);

    await click('[data-ratio-step="up"]');
    expect(uiState.attackRatio).toBe(0.1);
    expect(slider().value).toBe("10");
  });

  it("a preset sets the exact ratio and marks itself pressed", async () => {
    await click('[data-ratio-preset="75"]');

    expect(uiState.attackRatio).toBe(0.75);
    const pressed = [
      ...panel.querySelectorAll<HTMLElement>("[data-ratio-preset]"),
    ]
      .filter((b) => b.getAttribute("aria-pressed") === "true")
      .map((b) => b.dataset.ratioPreset);
    expect(pressed).toEqual(["75"]);
  });

  it("the keyboard still steps from a preset", async () => {
    await click('[data-ratio-preset="50"]');
    panel.eventBus.emit(new AttackRatioEvent(-10));
    expect(uiState.attackRatio).toBeCloseTo(0.4);
  });

  it("has one slider and small step buttons at every width", async () => {
    for (const width of [800, 1366]) {
      Object.defineProperty(window, "innerWidth", {
        value: width,
        configurable: true,
        writable: true,
      });
      panel.requestUpdate();
      await panel.updateComplete;
      expect(panel.querySelectorAll('input[type="range"]')).toHaveLength(1);
      expect(slider().classList.contains("touch-range")).toBe(false);
      expect(slider().classList.contains("h-1.5")).toBe(true);
      for (const b of panel.querySelectorAll("[data-attack-ratio] button")) {
        expect(b.className).not.toMatch(/\b(size-11|h-11)\b/);
      }
    }
    Object.defineProperty(window, "innerWidth", {
      value: 1024,
      configurable: true,
      writable: true,
    });
  });
});
