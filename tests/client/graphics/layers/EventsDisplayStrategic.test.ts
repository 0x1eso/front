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

describe("EventsDisplay strategic weapons messages", () => {
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

  it("translates the interceptor's bomb", () => {
    ed.onDisplayMessageEvent({
      type: GameUpdateType.DisplayEvent,
      message: "events_display.satellite_intercept_hit",
      messageType: 0,
      playerID: null,
      params: { name: "RealName", unit: "unit_type.hydrogen_bomb" },
      focusPlayerID: 2,
    } as never);
    expect(description()).toBe(
      "events_display.satellite_intercept_hit|name=Silent Falcon,unit=T(unit_type.hydrogen_bomb)",
    );
  });

  it("re-resolves the target's name from targetID", () => {
    ed.onDisplayMessageEvent({
      type: GameUpdateType.DisplayEvent,
      message: "events_display.satellite_targeted",
      messageType: 0,
      playerID: null,
      params: { name: "RealName", target: "RealTarget", targetID: 3 },
      focusPlayerID: 2,
    } as never);
    expect(description()).toBe(
      "events_display.satellite_targeted|name=Silent Falcon,target=Quiet Owl,targetID=3",
    );
  });

  it("the preparing alert goes to the silo, not the player", () => {
    const silo = { id: 77 };
    (ed as unknown as { game: { unit: unknown } }).game.unit = () => silo;
    ed.onDisplayMessageEvent({
      type: GameUpdateType.DisplayEvent,
      message: "events_display.satellite_preparing",
      messageType: 0,
      playerID: null,
      params: { name: "RealName" },
      unitID: 77,
      focusPlayerID: 2,
    } as never);
    const e = (
      ed as unknown as {
        events: { focusID?: number; unitView?: unknown }[];
      }
    ).events[0];
    expect(e.focusID).toBeUndefined();
    expect(e.unitView).toBe(silo);
  });
});
