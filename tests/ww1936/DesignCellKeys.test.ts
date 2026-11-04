import type { DesignDef } from "@openfront/engine-api/ww1936/DepthTypes";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  staticKeyOfCell,
  staticKeyOfPlaneCell,
} from "@openfront/engine-lib/ww1936/DesignCellKeys";
import { describe, expect, it } from "vitest";

const def = (
  kind: "tank" | "plane",
  base: string,
  modules: string[] = [],
): DesignDef =>
  ({ kind, base, modules, armorLevel: 0, engineLevel: 0, name: "x" }) as never;

describe("the static a design's cell stands in for", () => {
  it("tanks: a plain light or medium chassis maps, other roles and chassis do not", () => {
    expect(staticKeyOfCell(def("tank", "medium_2"))).toBe(
      equipKey("medium_tank", 2),
    );
    expect(staticKeyOfCell(def("tank", "light_1"))).toBe(
      equipKey("light_tank", 1),
    );
    expect(
      staticKeyOfCell(def("tank", "medium_1", ["gun_small", "turret_none"])),
    ).toBe(-1);
    expect(staticKeyOfCell(def("tank", "heavy_1"))).toBe(-1);
    expect(staticKeyOfCell(def("plane", "small_1"))).toBe(-1);
  });

  it("planes: a conventional airframe maps, a jet does not", () => {
    expect(staticKeyOfPlaneCell(def("plane", "small_2"))).toBe(
      equipKey("fighter", 2),
    );
    expect(staticKeyOfPlaneCell(def("plane", "jet_1"))).toBe(-1);
    expect(staticKeyOfPlaneCell(def("tank", "medium_1"))).toBe(-1);
  });
});
