import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { InterceptorNuke } from "@openfront/engine-api/strategic/StrategicTypes";
import { interceptorHits } from "@openfront/engine/strategic/Interception";

const shot = (type: InterceptorNuke, tick: number) => ({
  by: 5,
  type,
  resolveTick: tick,
});

describe("interceptor odds", () => {
  test("hydrogen bombs hit 10% and atom bombs 2% of the time, the same on every client", () => {
    let hydrogen = 0;
    let atom = 0;
    for (let tick = 0; tick < 10_000; tick++) {
      if (interceptorHits(tick, 3, shot(UnitType.HydrogenBomb, tick), 0)) {
        hydrogen++;
      }
      if (interceptorHits(tick, 3, shot(UnitType.AtomBomb, tick), 0)) atom++;
    }
    expect(hydrogen).toBeGreaterThan(900);
    expect(hydrogen).toBeLessThan(1100);
    expect(atom).toBeGreaterThan(150);
    expect(atom).toBeLessThan(250);
    const s = shot(UnitType.HydrogenBomb, 1234);
    expect(interceptorHits(1234, 3, s, 1)).toBe(interceptorHits(1234, 3, s, 1));
  });
});
