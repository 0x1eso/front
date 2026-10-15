import { BuildableUnit, UnitType } from "@openfront/engine-api/game/GameTypes";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/client/Utils", () => ({
  translateText: (key: string, params?: Record<string, string | number>) =>
    params
      ? `[${key}] ${Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")}`
      : `[${key}]`,
}));

import { UnitDisplay } from "../../src/client/hud/layers/UnitDisplay";

function buildable(type: UnitType, locked: boolean): BuildableUnit {
  return {
    type: type as BuildableUnit["type"],
    canBuild: locked ? false : 0,
    canUpgrade: false,
    cost: 100n,
    overlappingRailroads: [],
    ghostRailPaths: [],
    locked,
  };
}

/** Renders the hotbar and hovers the item whose icon has alt text `alt`. */
async function hover(buildables: BuildableUnit[], alt: string) {
  if (!customElements.get("unit-display")) {
    customElements.define("unit-display", UnitDisplay);
  }
  const el = document.createElement("unit-display") as UnitDisplay;
  const player = {
    buildables: vi.fn(() => Promise.resolve(buildables)),
    totalUnitLevels: () => 0,
    gold: () => 1_000_000n,
    units: () => [],
    isAlive: () => true,
  };
  el.game = {
    config: () => ({ isUnitDisabled: () => false }),
    myPlayer: () => player,
    inSpawnPhase: () => false,
  } as any;
  el.eventBus = { emit: vi.fn(), on: vi.fn() } as any;
  el.uiState = { ghostStructure: null } as any;
  document.body.appendChild(el);
  el.tick();
  await Promise.resolve();
  await el.updateComplete;
  const icon = el.querySelector(`img[alt="${alt}"]`);
  icon!.closest(".relative")!.dispatchEvent(new MouseEvent("mouseenter"));
  await el.updateComplete;
  return el;
}

describe("unit-display domestic locks", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows the required tech when hovering a locked unit", async () => {
    const el = await hover(
      [buildable(UnitType.HydrogenBomb, true)],
      "hydrogen_bomb",
    );
    expect(el.textContent).toContain(
      "[domestic.locked_requires] tech=[domestic.tech.thermonuclear.name]",
    );
  });

  it("shows no lock reason for an unlocked unit", async () => {
    const el = await hover([buildable(UnitType.Factory, false)], "factory");
    expect(el.textContent).toContain("[unit_type.factory]");
    expect(el.textContent).not.toContain("domestic.locked_requires");
  });
});
