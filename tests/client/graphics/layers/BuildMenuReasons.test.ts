import { BuildableUnit, UnitType } from "@openfront/engine-api/game/GameTypes";
import { StrategicData } from "@openfront/engine-api/strategic/StrategicTypes";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../src/client/Utils")>()),
  translateText: (key: string) => `[${key}]`,
}));

import "../../../../src/client/hud/layers/BuildMenu";
import type { BuildMenu } from "../../../../src/client/hud/layers/BuildMenu";

function unit(
  type: UnitType,
  canBuild: false | number,
  locked = false,
): BuildableUnit {
  return {
    type: type as BuildableUnit["type"],
    canBuild,
    canUpgrade: false,
    cost: 500n,
    overlappingRailroads: [],
    ghostRailPaths: [],
    locked,
  } as BuildableUnit;
}

async function openMenu(
  buildables: BuildableUnit[],
  gold = 0n,
  strategic: StrategicData | null = null,
): Promise<BuildMenu> {
  const menu = document.createElement("build-menu") as BuildMenu;
  menu.game = {
    myPlayer: () => ({
      totalUnitLevels: () => 0,
      gold: () => gold,
      strategicData: () => strategic,
    }),
    config: () => ({ isUnitDisabled: () => false }),
  } as unknown as BuildMenu["game"];
  menu.playerBuildables = buildables;
  document.body.appendChild(menu);
  (menu as unknown as { _hidden: boolean })._hidden = false;
  await menu.updateComplete;
  return menu;
}

function buttonFor(menu: BuildMenu, type: UnitType): HTMLButtonElement {
  return menu
    .shadowRoot!.querySelector(`img[alt="${type}"]`)!
    .closest("button")!;
}

describe("build menu on a tablet", () => {
  it("writes why a unit is blocked inside its button", async () => {
    const menu = await openMenu([
      unit(UnitType.HydrogenBomb, false, true),
      unit(UnitType.City, false),
      unit(UnitType.Port, 7),
    ]);

    expect(
      buttonFor(menu, UnitType.HydrogenBomb).querySelector(
        "[data-build-reason]",
      )!.textContent,
    ).toContain("[domestic.locked_requires]");
    expect(
      buttonFor(menu, UnitType.City).querySelector("[data-build-reason]")!
        .textContent,
    ).toContain("[build_menu.not_enough_money]");
    expect(
      buttonFor(menu, UnitType.Port).querySelector("[data-build-reason]"),
    ).toBeNull();
    expect(menu.shadowRoot!.querySelectorAll("button[title]")).toHaveLength(0);
    menu.remove();
  });

  it("blames the tile, not the gold, when the gold is there (M5)", async () => {
    const menu = await openMenu([unit(UnitType.Port, false)], 500n);
    const reason = buttonFor(menu, UnitType.Port).querySelector(
      "[data-build-reason]",
    )!.textContent;
    expect(reason).toContain("[build_menu.cant_build_here]");
    expect(reason).not.toContain("[build_menu.not_enough_money]");
    menu.remove();
  });

  it("strategic weapons: nukes show the stockpile, and an empty one is the reason", async () => {
    const menu = await openMenu(
      [unit(UnitType.AtomBomb, false), unit(UnitType.HydrogenBomb, 7)],
      1_000_000n,
      {
        stock: {
          [UnitType.AtomBomb]: 0,
          [UnitType.HydrogenBomb]: 1,
          [UnitType.MIRV]: 0,
        },
        jobs: [],
        satellite: { phase: "none" },
      },
    );
    const atom = buttonFor(menu, UnitType.AtomBomb);
    expect(atom.querySelector("[data-build-stock]")!.textContent).toContain(
      "[strategic.stock]",
    );
    expect(atom.querySelector("[data-build-reason]")!.textContent).toContain(
      "[strategic.no_stock]",
    );
    expect(
      buttonFor(menu, UnitType.HydrogenBomb).querySelector(
        "[data-build-reason]",
      ),
    ).toBeNull();
    menu.remove();
  });
});
