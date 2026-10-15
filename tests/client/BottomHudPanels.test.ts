import { MessageType } from "@openfront/engine-api/game/GameTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { describe, expect, it } from "vitest";
import "../../src/client/hud/layers/AttacksDisplay";
import type { AttacksDisplay } from "../../src/client/hud/layers/AttacksDisplay";
import "../../src/client/hud/layers/EventsDisplay";
import type { EventsDisplay } from "../../src/client/hud/layers/EventsDisplay";
import { CancelAttackIntentEvent } from "../../src/client/Transport";
import type { GameView } from "../../src/client/view";

describe("attacks list on a tablet", () => {
  it("cancels a wilderness attack with a 44px button", async () => {
    const el = document.createElement("attacks-display") as AttacksDisplay;
    el.eventBus = new EventBus();
    el.game = { myPlayer: () => ({}) } as unknown as GameView;
    Object.assign(el, {
      active: true,
      _isVisible: true,
      outgoingLandAttacks: [
        { id: "attack-1", troops: 1000, retreating: false, targetID: 0 },
      ],
    });
    document.body.appendChild(el);
    await el.updateComplete;
    const cancelled: string[] = [];
    el.eventBus.on(CancelAttackIntentEvent, (e) => cancelled.push(e.attackID));

    const cancel = [...el.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("❌"),
    )!;
    expect(cancel.classList.contains("min-w-11")).toBe(true);
    expect(cancel.classList.contains("min-h-11")).toBe(true);
    cancel.click();

    expect(cancelled).toEqual(["attack-1"]);
  });
});

describe("events on a tablet", () => {
  it("events fill their column instead of a fixed 384px", async () => {
    const el = document.createElement("events-display") as EventsDisplay;
    Object.assign(el, {
      active: true,
      _isVisible: true,
      events: [
        {
          description: "Attack failed",
          type: MessageType.ATTACK_FAILED,
          createdAt: 0,
          focusID: 2,
        },
      ],
      game: { myPlayer: () => ({ isTraitor: () => false }) },
    });
    document.body.appendChild(el);
    await el.updateComplete;

    const wrapper = el.firstElementChild as HTMLElement;
    expect(wrapper.classList.contains("w-full")).toBe(true);
    expect([...wrapper.classList].some((c) => c.includes("w-96"))).toBe(false);
    const row = el.querySelector("button")!;
    expect(row.textContent).toContain("Attack failed");
    expect(row.classList.contains("min-h-11")).toBe(true);
  });
});
