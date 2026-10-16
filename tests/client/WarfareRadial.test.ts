import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/client/Utils")>()),
  translateText: vi.fn((key: string) => key),
}));
vi.mock("../../src/client/hud/layers/BuildMenu", () => ({
  flattenedBuildTable: [],
}));
vi.mock("nanoid", () => ({
  customAlphabet: vi.fn(() => vi.fn(() => "mock-id")),
}));
vi.mock("dompurify", () => ({
  __esModule: true,
  default: { sanitize: vi.fn((str: string) => str) },
}));

import { PlayerActionHandler } from "../../src/client/hud/layers/PlayerActionHandler";
import {
  attackMenuElement,
  MenuElementParams,
} from "../../src/client/hud/layers/RadialMenuElements";
import { SendParadropIntentEvent } from "../../src/client/Transport";

function params(
  plane: { canBuild: number | false; locked?: boolean } | null,
  disabled = false,
  gold = 1_000_000n,
): MenuElementParams {
  return {
    game: {
      inSpawnPhase: () => false,
      config: () => ({ isUnitDisabled: () => disabled }),
    },
    playerActions: {
      buildableUnits:
        plane === null
          ? []
          : [
              {
                type: UnitType.TransportPlane,
                canBuild: plane.canBuild,
                canUpgrade: false,
                cost: 100_000n,
                overlappingRailroads: [],
                ghostRailPaths: [],
                locked: plane.locked ?? false,
              },
            ],
    },
    myPlayer: { troops: () => 1000, gold: () => gold },
    selected: null,
    tile: 77,
    playerActionHandler: { handleParadrop: vi.fn() },
    closeMenu: vi.fn(),
  } as unknown as MenuElementParams;
}

const paradrop = (p: MenuElementParams) =>
  attackMenuElement.subMenu!(p).find((e) => e.id === "attack_paradrop");

describe("paradrop in the radial attack menu", () => {
  it("is absent with the option off", () => {
    expect(paradrop(params({ canBuild: 5 }, true))).toBeUndefined();
    expect(paradrop(params(null))).toBeUndefined();
  });

  it("drops on the tapped tile when an airport reaches it", () => {
    const p = params({ canBuild: 5 });
    const item = paradrop(p)!;
    expect(item.disabled(p)).toBe(false);
    item.action!(p);
    expect(p.playerActionHandler.handleParadrop).toHaveBeenCalledWith(
      p.myPlayer,
      77,
    );
    expect(p.closeMenu).toHaveBeenCalled();
  });

  it("is greyed out with no airport in reach and shows a lock when locked", () => {
    const p = params({ canBuild: false, locked: true });
    const item = paradrop(p)!;
    expect(item.disabled(p)).toBe(true);
    const badge = item.badge as (p: MenuElementParams) => string;
    expect(badge(p)).toContain("domestic.tech.industrialization.name");
  });

  it("re-reads the live params: it lights up and goes out with the menu open", () => {
    const off = params({ canBuild: false });
    const item = paradrop(off)!;
    expect(item.disabled(off)).toBe(true);
    const color = item.color as (p: MenuElementParams) => string;
    const greyed = color(off);
    const on = params({ canBuild: 5 });
    expect(item.disabled(on)).toBe(false);
    expect(color(on)).not.toBe(greyed);
    expect(item.disabled(off)).toBe(true);
  });

  it("always shows its cost, or why it is off, as a badge", () => {
    const item = paradrop(params({ canBuild: 5 }))!;
    const badge = item.badge as (p: MenuElementParams) => string;
    expect(badge(params({ canBuild: 5 }))).toBe("100K");
    expect(badge(params({ canBuild: false }))).toBe(
      "radial_menu.paradrop_no_airport",
    );
    expect(badge(params({ canBuild: false }, false, 5n))).toBe(
      "radial_menu.paradrop_need_gold",
    );
  });

  it("sends the attack ratio of the troops", () => {
    const emit = vi.fn();
    const handler = new PlayerActionHandler(
      { emit } as never,
      {
        attackRatio: 0.25,
      } as never,
    );
    handler.handleParadrop({ troops: () => 1000 } as never, 77);
    expect(emit).toHaveBeenCalledWith(new SendParadropIntentEvent(77, 250));
  });
});
