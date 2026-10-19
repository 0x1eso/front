vi.mock("lit", () => ({
  html: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  }),
  LitElement: class extends EventTarget {
    requestUpdate() {}
  },
}));
vi.mock("lit/decorators.js", () => ({
  customElement: () => (clazz: unknown) => clazz,
  state: () => () => {},
  property: () => () => {},
  query: () => () => {},
}));
vi.mock("lit/directive.js", () => ({}));
vi.mock("lit/directives/unsafe-html.js", () => ({
  unsafeHTML: (s: string) => s,
}));
vi.mock("../../../../src/client/Utils", () => ({
  // T(key) for a bare key; key|k=v,... with params.
  translateText: vi.fn(
    (key: string, params?: Record<string, string | number>) =>
      params === undefined
        ? `T(${key})`
        : `${key}|${Object.entries(params)
            .map(([k, v]) => `${k}=${v}`)
            .join(",")}`,
  ),
  getMessageTypeClasses: vi.fn(() => ""),
}));
vi.mock("@openfront/engine-lib/Format", () => ({
  renderNumber: vi.fn(),
  renderTroops: vi.fn(),
}));

import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventsDisplay } from "../../../../src/client/hud/layers/EventsDisplay";

describe("EventsDisplay world congress messages", () => {
  let ed: EventsDisplay;
  const names: Record<number, string> = {
    1: "Me",
    2: "Silent Falcon",
    3: "Quiet Owl",
  };

  beforeEach(() => {
    ed = new EventsDisplay();
    (ed as unknown as { game: unknown }).game = {
      myPlayer: () => ({ smallID: () => 1, displayName: () => names[1] }),
      playerBySmallID: (id: number) =>
        names[id] === undefined
          ? { isPlayer: () => false }
          : {
              smallID: () => id,
              displayName: () => names[id],
              isPlayer: () => true,
            },
      unit: () => undefined,
      ticks: () => 0,
    };
  });

  const description = () =>
    (ed as unknown as { events: { description: string }[] }).events[0]
      .description;

  it("names the resolution and the adopted option", () => {
    ed.onDisplayMessageEvent({
      type: GameUpdateType.DisplayEvent,
      message: "events_display.congress_adopted_target",
      messageType: 0,
      playerID: null,
      params: {
        resolution: "sanction",
        a: 11,
        b: 9,
        option: "A",
        name: "Real",
      },
      focusPlayerID: 2,
    } as never);
    expect(description()).toBe(
      "events_display.congress_adopted_target|resolution=T(congress.resolution.sanction.name),a=11,b=9,option=T(congress.resolution.sanction.a),name=Silent Falcon",
    );
  });

  it("names the emergency and both players", () => {
    ed.onDisplayMessageEvent({
      type: GameUpdateType.DisplayEvent,
      message: "events_display.congress_emergency_convened",
      messageType: 0,
      playerID: null,
      params: { kind: "nuclear", name: "Real", targetID: 3 },
      focusPlayerID: 2,
    } as never);
    expect(description()).toBe(
      "events_display.congress_emergency_convened|kind=T(congress.emergency.nuclear),name=Silent Falcon,targetID=3,target=Quiet Owl",
    );
  });

  it("folds the resolution's subject into its name, as the cards title it", () => {
    ed.onDisplayMessageEvent({
      type: GameUpdateType.DisplayEvent,
      message: "events_display.congress_adopted",
      messageType: 0,
      playerID: null,
      params: {
        resolution: "building_pact",
        a: 7,
        b: 3,
        option: "B",
        param: "factory",
      },
    } as never);
    expect(description()).toBe(
      "events_display.congress_adopted|resolution=T(congress.resolution.building_pact.name) · T(unit_type.factory),a=7,b=3,option=T(congress.resolution.building_pact.b)",
    );
  });

  it("a tied trade pact names its trade", () => {
    ed.onDisplayMessageEvent({
      type: GameUpdateType.DisplayEvent,
      message: "events_display.congress_tied",
      messageType: 0,
      playerID: null,
      params: { resolution: "trade_pact", a: 5, b: 5, param: "train" },
    } as never);
    expect(description()).toBe(
      "events_display.congress_tied|resolution=T(congress.resolution.trade_pact.name) · T(congress.param.train),a=5,b=5",
    );
  });

  it("a law under review names the law and its option", () => {
    ed.onDisplayMessageEvent({
      type: GameUpdateType.DisplayEvent,
      message: "events_display.congress_adopted_target",
      messageType: 0,
      playerID: null,
      params: {
        resolution: "law_review",
        a: 6,
        b: 4,
        option: "A",
        param: "doctrine:B",
        name: "Real",
      },
      focusPlayerID: 2,
    } as never);
    expect(description()).toBe(
      "events_display.congress_adopted_target|resolution=T(congress.resolution.law_review.name) · T(domestic.law.doctrine.B.name),a=6,b=4,option=T(congress.resolution.law_review.a),name=Silent Falcon",
    );
  });

  it("a subject with no name of its own (a host unit id) leaves the name alone", () => {
    ed.onDisplayMessageEvent({
      type: GameUpdateType.DisplayEvent,
      message: "events_display.congress_adopted_target",
      messageType: 0,
      playerID: null,
      params: {
        resolution: "world_heritage",
        a: 8,
        b: 2,
        option: "A",
        param: "412",
        name: "Real",
      },
      focusPlayerID: 2,
    } as never);
    expect(description()).toBe(
      "events_display.congress_adopted_target|resolution=T(congress.resolution.world_heritage.name),a=8,b=2,option=T(congress.resolution.world_heritage.a),name=Silent Falcon",
    );
  });
});
