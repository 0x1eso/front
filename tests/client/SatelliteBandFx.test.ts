import { PlayerType, UnitType } from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import type {
  InterceptorData,
  SatelliteData,
} from "@openfront/engine-api/strategic/StrategicTypes";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, string | number>) =>
    params ? `[${key}] ${JSON.stringify(params)}` : `[${key}]`,
}));

import {
  FLASH_TICKS,
  flashOpacity,
  liveResults,
  RESULT_TICKS,
  SatelliteBand,
} from "../../src/client/hud/layers/SatelliteBand";
import type { PlayerView } from "../../src/client/view";

function attacker(sat: () => SatelliteData): PlayerView {
  return {
    id: () => "red",
    smallID: () => 1,
    displayName: () => "red",
    isAlive: () => true,
    type: () => PlayerType.Human,
    strategicData: () => ({
      stock: {
        [UnitType.AtomBomb]: 0,
        [UnitType.HydrogenBomb]: 0,
        [UnitType.MIRV]: 0,
      },
      jobs: [],
      satellite: sat(),
    }),
    units: () => [],
  } as unknown as PlayerView;
}

const shot = (resolveTick: number): InterceptorData => ({
  by: 3,
  type: UnitType.HydrogenBomb,
  resolveTick,
  from: 9,
});

function setup() {
  let now = 400;
  let sat: SatelliteData = {
    phase: "targeted",
    target: 2,
    strikeTick: 700,
    interceptors: [],
  };
  let strikes: unknown[] = [];
  let myID = 3;
  const red = attacker(() => sat);
  const target = { isPlayer: () => true, displayName: () => "blue" };
  const el = document.createElement("satellite-band") as SatelliteBand;
  el.game = {
    config: () => ({ strategicWeapons: () => true }),
    ticks: () => now,
    updatesSinceLastTick: () => ({ [GameUpdateType.OrbitalStrike]: strikes }),
    myPlayer: () => ({
      smallID: () => myID,
      id: () => "me",
      isAlive: () => true,
      strategicData: () => null,
      units: () => [],
    }),
    playerViews: () => [red],
    playerBySmallID: () => target,
  } as unknown as SatelliteBand["game"];
  el.eventBus = { emit: vi.fn(), on: vi.fn() } as never;
  document.body.appendChild(el);
  return {
    el,
    step: async (
      to: number,
      next?: SatelliteData,
      withStrikes: unknown[] = [],
    ) => {
      now = to;
      if (next) sat = next;
      strikes = withStrikes;
      el.tick();
      await el.updateComplete;
    },
    setMe: (id: number) => (myID = id),
  };
}

describe("satellite band effects", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("turns red for the last 10 s only", async () => {
    const { el, step } = setup();
    await step(400);
    expect(
      el.querySelector("[data-countdown]")!.getAttribute("data-urgent"),
    ).toBe("false");
    await step(599);
    expect(
      el.querySelector("[data-countdown]")!.getAttribute("data-urgent"),
    ).toBe("false");
    await step(600);
    const row = el.querySelector("[data-countdown]")!;
    expect(row.getAttribute("data-urgent")).toBe("true");
    expect(row.className).toContain("bg-red-800");
  });

  it("shows 'shot down' with a burst when the satellite leaves the countdown early", async () => {
    const { el, step } = setup();
    await step(428, {
      phase: "targeted",
      target: 2,
      strikeTick: 700,
      interceptors: [shot(430)],
    });
    await step(431, { phase: "none" });
    const r = el.querySelector("[data-result]")!;
    expect(r.getAttribute("data-result")).toBe("hit");
    expect(r.textContent).toContain("[strategic.shot_down]");
    expect(r.querySelector("[data-burst]")).not.toBeNull();
  });

  it("shows 'missed' (no burst) and it fades away", async () => {
    const { el, step } = setup();
    await step(428, {
      phase: "targeted",
      target: 2,
      strikeTick: 700,
      interceptors: [shot(430)],
    });
    await step(431, {
      phase: "targeted",
      target: 2,
      strikeTick: 700,
      interceptors: [],
    });
    const r = el.querySelector("[data-result]")!;
    expect(r.getAttribute("data-result")).toBe("miss");
    expect(r.textContent).toContain("[strategic.missed]");
    expect(r.querySelector("[data-burst]")).toBeNull();
    await step(431 + RESULT_TICKS.miss);
    expect(el.querySelector("[data-result]")).toBeNull();
  });

  it("flashes the screen edge for the target alone, briefly, on the first wave", async () => {
    const wave0 = [{ attackerID: 1, targetID: 2, impacts: [], wave: 0 }];
    const a = setup();
    a.setMe(2);
    await a.step(700, { phase: "none" }, wave0);
    expect(a.el.querySelector("[data-edge-flash]")).not.toBeNull();
    await a.step(700 + FLASH_TICKS);
    expect(a.el.querySelector("[data-edge-flash]")).toBeNull();
    document.body.innerHTML = "";

    const b = setup();
    b.setMe(3);
    await b.step(700, { phase: "none" }, wave0);
    expect(b.el.querySelector("[data-edge-flash]")).toBeNull();
  });

  it("a later wave does not flash again", async () => {
    const a = setup();
    a.setMe(2);
    await a.step(700, { phase: "none" }, [
      { attackerID: 1, targetID: 2, impacts: [], wave: 1 },
    ]);
    expect(a.el.querySelector("[data-edge-flash]")).toBeNull();
  });

  it("helper math", () => {
    expect(flashOpacity(10, 10)).toBe(0);
    expect(flashOpacity(10 + FLASH_TICKS, 10)).toBe(1);
    expect(
      liveResults(
        [
          { hit: true, untilTick: 5 },
          { hit: false, untilTick: 9 },
        ],
        5,
      ),
    ).toEqual([{ hit: false, untilTick: 9 }]);
  });
});
