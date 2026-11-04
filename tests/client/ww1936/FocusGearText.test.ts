import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, string | number>) =>
    params
      ? `[${key}] ${Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")}`
      : `[${key}]`,
}));

import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import { effectLines } from "../../../src/client/hud/ww1936/PoliticsModel";

const text = (e: Effect) => effectLines([e])[0].text;

describe("a gift of a catalogue item reads as the item", () => {
  it("names the item and counts it by its kind", () => {
    const tank = text({
      kind: "equipment",
      type: "medium_tank",
      gen: 3,
      count: 40,
      item: "deu_tiger1_e",
    });
    expect(tank).toContain("[ww1936.fx.equipment_item]");
    expect(tank).toContain("item=[ww1936.hist.deu_tiger1_e]");
    expect(tank).toContain("count=40");
    expect(tank).toContain("unit=veh");
  });

  it("rifles and guns have their own counter, a loss is marked", () => {
    const rifle = text({
      kind: "equipment",
      type: "infantry_equipment",
      gen: 1,
      count: -4000,
      item: "sun_mosin",
    });
    expect(rifle).toContain("unit=rifle");
    expect(rifle).toContain("count=4000");
    expect(rifle).toContain("lost=1");
    const gun = text({
      kind: "send_equipment",
      to: { tag: "ESR" },
      type: "artillery",
      count: 200,
      item: "sun_f22usv",
    });
    expect(gun).toContain("[ww1936.fx.send_equipment_item]");
    expect(gun).toContain("unit=gun");
  });

  it("without an item the generic line stays", () => {
    expect(
      text({ kind: "equipment", type: "motorized", gen: 1, count: 500 }),
    ).toContain("[ww1936.fx.equipment]");
  });
});
