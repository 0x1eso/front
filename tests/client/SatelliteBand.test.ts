import { PlayerType, UnitType } from "@openfront/engine-api/game/GameTypes";
import { StrategicData } from "@openfront/engine-api/strategic/StrategicTypes";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, string | number>) =>
    params
      ? `[${key}] ${Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")}`
      : `[${key}]`,
}));

import { SatelliteBand } from "../../src/client/hud/layers/SatelliteBand";
import {
  OpenSatelliteTargetPickerEvent,
  SatelliteTargetPicker,
} from "../../src/client/hud/layers/SatelliteTargetPicker";
import {
  SendInterceptSatelliteIntentEvent,
  SendSatelliteTargetIntentEvent,
} from "../../src/client/Transport";
import type { PlayerView } from "../../src/client/view";

function data(over: Partial<StrategicData> = {}): StrategicData {
  return {
    stock: {
      [UnitType.AtomBomb]: 0,
      [UnitType.HydrogenBomb]: 0,
      [UnitType.MIRV]: 0,
    },
    jobs: [],
    satellite: { phase: "none" },
    ...over,
  };
}

interface Stub {
  id: string;
  smallID: number;
  data?: StrategicData | null;
  tiles?: number;
  silos?: number;
  type?: PlayerType;
  friends?: string[];
}

function view(s: Stub): PlayerView {
  return {
    id: () => s.id,
    smallID: () => s.smallID,
    displayName: () => s.id,
    isAlive: () => true,
    isPlayer: () => true,
    type: () => s.type ?? PlayerType.Human,
    numTilesOwned: () => s.tiles ?? 100,
    strategicData: () => s.data ?? null,
    isFriendly: (o: PlayerView) => (s.friends ?? []).includes(o.id()),
    territoryColor: () => ({ toHex: () => "#ffffff" }),
    units: (t: UnitType) =>
      t === UnitType.MissileSilo
        ? Array.from({ length: s.silos ?? 0 }, () => ({
            isActive: () => true,
            isUnderConstruction: () => false,
            isInCooldown: () => false,
          }))
        : [],
  } as unknown as PlayerView;
}

function bus() {
  const emitted: unknown[] = [];
  const handlers = new Map<unknown, () => void>();
  return {
    emitted,
    handlers,
    eventBus: {
      emit: (e: unknown) => emitted.push(e),
      on: (type: unknown, cb: () => void) => handlers.set(type, cb),
    },
  };
}

async function band(me: PlayerView, players: PlayerView[], now = 400) {
  const el = document.createElement("satellite-band") as SatelliteBand;
  expect(el).toBeInstanceOf(SatelliteBand);
  const b = bus();
  el.game = {
    config: () => ({ strategicWeapons: () => true }),
    ticks: () => now,
    myPlayer: () => me,
    playerViews: () => players,
    playerBySmallID: (id: number) =>
      players.find((p) => p.smallID() === id) ?? { isPlayer: () => false },
  } as unknown as SatelliteBand["game"];
  el.eventBus = b.eventBus as unknown as SatelliteBand["eventBus"];
  document.body.appendChild(el);
  el.tick();
  await el.updateComplete;
  return { el, ...b };
}

// Red's satellite strikes blue at tick 700; it is tick 400: 30 s left, 50%.
const red = () =>
  view({
    id: "red",
    smallID: 1,
    data: data({
      satellite: {
        phase: "targeted",
        target: 2,
        strikeTick: 700,
        interceptors: [{ by: 3, type: UnitType.AtomBomb, resolveTick: 420 }],
      },
    }),
  });
const blue = () => view({ id: "blue", smallID: 2, data: data() });

describe("satellite band", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows nothing without a strike or a satellite in orbit", async () => {
    const me = blue();
    const { el } = await band(me, [me]);
    expect(el.querySelector("[data-satellite-band]")).toBeNull();
  });

  it("shows everyone who strikes whom, the seconds left and the bar", async () => {
    const me = view({ id: "green", smallID: 3, data: data(), silos: 1 });
    const { el } = await band(me, [red(), blue(), me]);
    const row = el.querySelector("[data-countdown]")!;
    expect(row.textContent).toContain("[strategic.band] name=red,target=blue");
    expect(row.querySelector("[data-seconds]")!.textContent).toContain(
      "seconds=30",
    );
    expect(row.querySelector<HTMLElement>("[data-progress]")!.style.width).toBe(
      "50%",
    );
    expect(row.textContent).toContain(
      "[strategic.interceptors_in_flight] count=1",
    );
  });

  it("intercept buttons show each stock and odds; two taps fire", async () => {
    const me = view({
      id: "green",
      smallID: 3,
      silos: 1,
      data: data({
        stock: {
          [UnitType.AtomBomb]: 0,
          [UnitType.HydrogenBomb]: 2,
          [UnitType.MIRV]: 0,
        },
      }),
    });
    const { el, emitted } = await band(me, [red(), blue(), me]);
    const hydrogen = el.querySelector<HTMLButtonElement>(
      `[data-intercept="${UnitType.HydrogenBomb}"]`,
    )!;
    const atom = el.querySelector<HTMLButtonElement>(
      `[data-intercept="${UnitType.AtomBomb}"]`,
    )!;
    expect(hydrogen.textContent).toContain(
      "[strategic.intercept_with] unit=[unit_type.hydrogen_bomb],count=2,pct=20",
    );
    expect(atom.textContent).toContain("count=0,pct=4");
    expect(atom.disabled).toBe(true);
    expect(hydrogen.classList.contains("min-h-11")).toBe(true);

    hydrogen.click();
    await el.updateComplete;
    expect(emitted).toHaveLength(0);
    expect(hydrogen.textContent).toContain("[strategic.tap_again_to_fire]");
    hydrogen.click();
    expect(emitted).toContainEqual(
      new SendInterceptSatelliteIntentEvent("red", UnitType.HydrogenBomb),
    );
  });

  it("the attacker gets no intercept buttons; without a ready silo they're disabled", async () => {
    const attacker = red();
    const { el } = await band(attacker, [attacker, blue()]);
    expect(el.querySelector("[data-intercept]")).toBeNull();
    document.body.innerHTML = "";

    const me = view({
      id: "green",
      smallID: 3,
      silos: 0,
      data: data({
        stock: {
          [UnitType.AtomBomb]: 1,
          [UnitType.HydrogenBomb]: 1,
          [UnitType.MIRV]: 0,
        },
      }),
    });
    const second = await band(me, [red(), blue(), me]);
    for (const b of second.el.querySelectorAll<HTMLButtonElement>(
      "[data-intercept]",
    )) {
      expect(b.disabled).toBe(true);
    }
  });

  it("the satellite's owner opens the target picker while it waits in orbit", async () => {
    const me = view({
      id: "red",
      smallID: 1,
      data: data({ satellite: { phase: "orbit" } }),
    });
    const { el, emitted } = await band(me, [me, blue()]);
    el.querySelector<HTMLButtonElement>("[data-choose-target]")!.click();
    expect(emitted).toContainEqual(new OpenSatelliteTargetPickerEvent());
  });
});

describe("satellite target picker", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("lists the nations it may strike, biggest first; two taps aim and close", async () => {
    const me = view({ id: "red", smallID: 1, friends: ["green"] });
    const players = [
      me,
      view({ id: "blue", smallID: 2, tiles: 300 }),
      view({ id: "green", smallID: 3, tiles: 900 }), // an ally
      view({ id: "yellow", smallID: 4, tiles: 500 }),
      view({ id: "tribe", smallID: 5, tiles: 999, type: PlayerType.Bot }),
    ];
    const el = document.createElement(
      "satellite-target-picker",
    ) as SatelliteTargetPicker;
    const b = bus();
    el.game = {
      myPlayer: () => me,
      playerViews: () => players,
    } as unknown as SatelliteTargetPicker["game"];
    el.eventBus = b.eventBus as unknown as SatelliteTargetPicker["eventBus"];
    document.body.appendChild(el);
    el.init();
    b.handlers.get(OpenSatelliteTargetPickerEvent)!();
    await el.updateComplete;

    const rows = [...el.querySelectorAll<HTMLButtonElement>("[data-target]")];
    expect(rows.map((r) => r.dataset.target)).toEqual(["yellow", "blue"]);
    expect(rows.every((r) => r.classList.contains("min-h-11"))).toBe(true);
    rows[1].click();
    await el.updateComplete;
    expect(b.emitted).toHaveLength(0);
    el.querySelector<HTMLButtonElement>('[data-target="blue"]')!.click();
    await el.updateComplete;
    expect(b.emitted).toContainEqual(
      new SendSatelliteTargetIntentEvent("blue"),
    );
    expect(el.querySelector("[data-target-picker]")).toBeNull();
  });
});
