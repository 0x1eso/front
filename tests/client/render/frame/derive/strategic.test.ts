import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { StrategicData } from "@openfront/engine-api/strategic/StrategicTypes";
import {
  MAX_ORBITAL_IMPACTS,
  orbitalImpactPoints,
} from "../../../../../src/client/render/frame/derive/OrbitalStrikes";
import { deriveStrategicProgress } from "../../../../../src/client/render/frame/derive/StrategicProgress";

const NONE = {
  [UnitType.AtomBomb]: 0,
  [UnitType.HydrogenBomb]: 0,
  [UnitType.MIRV]: 0,
};

const source = (alive: boolean, data: StrategicData | null) => ({
  isAlive: () => alive,
  strategicData: () => data,
});

describe("strategic map bars", () => {
  test("a factory shows its furthest-along nuke, a silo its satellite; the dead show nothing", () => {
    const out = deriveStrategicProgress(
      [
        source(true, {
          stock: NONE,
          jobs: [
            {
              factoryId: 5,
              type: UnitType.AtomBomb,
              startTick: 0,
              endTick: 200,
            },
            {
              factoryId: 5,
              type: UnitType.HydrogenBomb,
              startTick: 100,
              endTick: 500,
            },
          ],
          satellite: {
            phase: "preparing",
            siloId: 9,
            startTick: 0,
            readyTick: 900,
          },
        }),
        source(false, {
          stock: NONE,
          jobs: [
            {
              factoryId: 7,
              type: UnitType.AtomBomb,
              startTick: 0,
              endTick: 200,
            },
          ],
          satellite: { phase: "none" },
        }),
        source(true, null),
      ],
      100,
    );
    expect(out.get(5)).toBeCloseTo(0.5);
    expect(out.get(9)).toBeCloseTo(100 / 900);
    expect(out.has(7)).toBe(false);
  });

  test("orbital strike impacts become points, at most 16 a strike", () => {
    const impacts = Array.from({ length: 20 }, (_, i) => i * 101);
    const points = orbitalImpactPoints([{ impacts }], 100);
    expect(points).toHaveLength(MAX_ORBITAL_IMPACTS);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points[1]).toEqual({ x: 1, y: 1 });
  });
});
