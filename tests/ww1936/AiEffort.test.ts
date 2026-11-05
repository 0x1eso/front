import { describe, expect, it } from "vitest";
import {
  AI_EFFORT_FORT_BAR,
  type EffortRegion,
  effortFed,
  effortRoom,
  effortScore,
  pickMainSector,
} from "../../packages/engine/src/ww1936/land/AiEffort";

const region = (
  r: Partial<EffortRegion> & { region: number },
): EffortRegion => ({
  vp: 0,
  capital: false,
  fort: 0,
  width: 90,
  defence: 100,
  extra: 0,
  ...r,
});

describe("AI main sector", () => {
  it("values points over defence, and fort levels count as defence", () => {
    const open = effortScore(region({ region: 1, vp: 4 }));
    expect(open).toBe(50);
    expect(effortScore(region({ region: 1, vp: 4, fort: 2 }))).toBeLessThan(
      open,
    );
    expect(effortScore(region({ region: 1, vp: 4, defence: 50 }))).toBe(100);
  });

  it("takes the best, and the smaller id on a tie", () => {
    const list = [
      region({ region: 7, vp: 1 }),
      region({ region: 3, vp: 9 }),
      region({ region: 2, vp: 9 }),
    ];
    expect(pickMainSector(list, 0)).toBe(2);
  });

  it("draws between the top two only when they are close", () => {
    const close = [region({ region: 1, vp: 9 }), region({ region: 2, vp: 8 })];
    expect(pickMainSector(close, 0)).toBe(1);
    expect(pickMainSector(close, 1)).toBe(2);
    const far = [region({ region: 1, vp: 9 }), region({ region: 2, vp: 2 })];
    expect(pickMainSector(far, 1)).toBe(1);
  });

  it("keeps the standing sector while it is close to the best", () => {
    const list = [region({ region: 1, vp: 9 }), region({ region: 2, vp: 8 })];
    expect(pickMainSector(list, 0, 2)).toBe(2);
    const far = [region({ region: 1, vp: 9 }), region({ region: 2, vp: 1 })];
    expect(pickMainSector(far, 0, 2)).toBe(1);
  });

  it("leaves strong forts out unless nothing else is in reach", () => {
    const fort = region({ region: 1, vp: 50, fort: AI_EFFORT_FORT_BAR });
    expect(pickMainSector([fort, region({ region: 2 })], 0)).toBe(2);
    expect(pickMainSector([fort], 0)).toBe(1);
    expect(pickMainSector([], 0)).toBe(0);
  });

  it("counts what a sector feeds, heavier divisions fewer, and starts on half of it", () => {
    expect(effortRoom([1000, 2500], 1000)).toBe(3);
    expect(effortRoom([1000, 2500], 2000)).toBe(1);
    expect(effortFed(6, 12)).toBe(true);
    expect(effortFed(5, 12)).toBe(false);
  });
});
