import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import type {
  InterceptorData,
  SatelliteData,
} from "@openfront/engine-api/strategic/StrategicTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { beforeEach, describe, expect, it } from "vitest";
import { SoundEffectController } from "../../../src/client/controllers/SoundEffectController";
import { PlaySoundEffectEvent } from "../../../src/client/sound/Sounds";

describe("strategic weapons sounds (spec 6.6)", () => {
  let played: string[];
  let tick: number;
  let sat: SatelliteData;
  let strikes: unknown[];
  let me: number;
  let controller: SoundEffectController;
  let enabled: boolean;

  const step = (to: number, next: SatelliteData = sat) => {
    tick = to;
    sat = next;
    controller.tick();
  };

  beforeEach(() => {
    played = [];
    tick = 100;
    sat = { phase: "none" };
    strikes = [];
    me = 2;
    enabled = true;
    const eventBus = new EventBus();
    eventBus.on(PlaySoundEffectEvent, (e) => played.push(e.effect));
    const game = {
      ticks: () => tick,
      unit: (id: number) => ({ tile: () => id * 10 }),
      myPlayer: () => ({ smallID: () => me, id: () => "me" }),
      config: () => ({ strategicWeapons: () => enabled }),
      playerViews: () => [
        {
          smallID: () => 1,
          isAlive: () => true,
          strategicData: () => ({
            stock: {},
            jobs: [],
            satellite: sat,
          }),
        },
      ],
      updatesSinceLastTick: () => ({
        [GameUpdateType.OrbitalStrike]: strikes,
      }),
    };
    controller = new SoundEffectController(game as never, eventBus);
  });

  const shot = (resolveTick: number): InterceptorData => ({
    by: 3,
    type: UnitType.HydrogenBomb,
    resolveTick,
    from: 5,
  });

  it("plays the MIRV launch cue when a satellite reaches orbit", () => {
    const prep: SatelliteData = {
      phase: "preparing",
      siloId: 7,
      startTick: 0,
      readyTick: 900,
    };
    step(100, prep);
    step(101, prep);
    expect(played).toEqual([]);
    step(102, { phase: "orbit" });
    expect(played).toEqual(["mirv-launch"]);
  });

  it("the target hears the nuke warning, others a click, once a second in the last 10 s", () => {
    const targeted: SatelliteData = {
      phase: "targeted",
      target: 2,
      strikeTick: 1000,
      interceptors: [],
    };
    for (let t = 880; t <= 1000; t++) step(t, targeted);
    expect(played.filter((s) => s === "nuke-warning")).toHaveLength(10);
    expect(played.filter((s) => s === "click")).toHaveLength(0);
  });

  it("a bystander hears the soft click instead", () => {
    me = 5;
    const targeted: SatelliteData = {
      phase: "targeted",
      target: 2,
      strikeTick: 1000,
      interceptors: [],
    };
    for (let t = 880; t <= 1000; t++) step(t, targeted);
    expect(played.filter((s) => s === "click")).toHaveLength(10);
    expect(played).not.toContain("nuke-warning");
  });

  it("a shot-down satellite plays the SAM hit; a miss is silent", () => {
    const flying = (n: number): SatelliteData => ({
      phase: "targeted",
      target: 2,
      strikeTick: 1000,
      interceptors: n > 0 ? [shot(430)] : [],
    });
    step(428, flying(1));
    step(430, flying(0));
    expect(played).toEqual([]);
    step(431, flying(1));
    step(432, { phase: "none" });
    expect(played).toEqual(["sam-hit"]);
  });

  it("only the first wave of a strike sounds", () => {
    strikes = [{ attackerID: 1, targetID: 2, impacts: [], wave: 0 }];
    step(500);
    strikes = [{ attackerID: 1, targetID: 2, impacts: [], wave: 1 }];
    step(501);
    step(502);
    expect(played).toEqual(["hydrogen-hit"]);
  });

  it("is silent and does no work with the option off", () => {
    enabled = false;
    strikes = [{ attackerID: 1, targetID: 2, impacts: [], wave: 0 }];
    step(500, { phase: "orbit" });
    expect(played).toEqual([]);
  });
});
