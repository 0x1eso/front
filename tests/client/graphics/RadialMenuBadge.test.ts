import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  getSvgAspectRatio: async () => 1,
}));

import { EventBus } from "@openfront/shared/EventBus";
import { RadialMenu } from "../../../src/client/hud/layers/RadialMenu";
import type {
  MenuElement,
  MenuElementParams,
} from "../../../src/client/hud/layers/RadialMenuElements";

describe("radial menu item badge (M6: lock reason without hover)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("writes a locked item's badge under its icon", () => {
    const item = (id: string, badge?: string): MenuElement => ({
      id,
      name: id,
      icon: `${id}.svg`,
      badge,
      disabled: () => badge !== undefined,
    });
    const root: MenuElement = {
      id: "root",
      name: "root",
      disabled: () => false,
      subMenu: () => [item("factory", "🔒 Railroad"), item("city")],
    };
    const menu = new RadialMenu(new EventBus(), root, {
      disabled: () => false,
      action: () => {},
    });
    menu.init();
    menu.setParams({
      game: { inSpawnPhase: () => false },
    } as unknown as MenuElementParams);
    menu.showRadialMenu(300, 300);

    const badges = [...document.querySelectorAll(".item-badge")];
    expect(badges.map((b) => b.textContent)).toEqual(["🔒 Railroad"]);
    expect(badges[0].closest("[data-id]")!.getAttribute("data-id")).toBe(
      "factory",
    );
  });
});
