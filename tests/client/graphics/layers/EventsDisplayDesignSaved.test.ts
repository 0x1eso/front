/**
 * The "design saved" notice reaches the client a tick before the design's
 * view does (the world-war step hands its views over before the intent that
 * saved the design ran), so EventsDisplay waits for the design and names it
 * as the designer does, not by the fallback.
 */

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
  translateText: vi.fn(
    (key: string, params?: Record<string, string | number>) =>
      params?.name !== undefined ? String(params.name) : key,
  ),
  getMessageTypeClasses: vi.fn(() => ""),
}));
vi.mock("@openfront/engine-lib/Format", () => ({
  renderNumber: vi.fn(),
  renderTroops: vi.fn(),
}));

import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import type { DesignDef } from "@openfront/engine-api/ww1936/DepthTypes";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventsDisplay } from "../../../../src/client/hud/layers/EventsDisplay";

const def = {
  kind: "tank",
  base: "light_1",
  modules: [],
  name: "My Tank",
} as unknown as DesignDef;

describe("EventsDisplay names a saved design once it has arrived", () => {
  let ed: EventsDisplay;
  let tick = 10;
  let arrived = false;
  const events = () =>
    (ed as unknown as { events: { description: string }[] }).events;
  const msg = {
    type: GameUpdateType.DisplayEvent,
    message: "events_display.ww1936_design_saved",
    messageType: 0,
    playerID: 1,
    params: { name: "@", kind: "tank", slot: 1 },
  } as never;

  beforeEach(() => {
    tick = 10;
    arrived = false;
    ed = new EventsDisplay();
    (ed as unknown as { game: unknown }).game = {
      myPlayer: () => ({ smallID: () => 1, isAlive: () => true }),
      worldWarScenario: () => null,
      wwDepth: () => ({
        designOf: () => (arrived ? def : undefined),
        detail: () => undefined,
      }),
      unit: () => undefined,
      ticks: () => tick,
    };
  });

  it("holds the notice until the design's view arrives", () => {
    ed.onDisplayMessageEvent(msg);
    expect(events()).toHaveLength(0);
    tick++;
    arrived = true;
    (ed as unknown as { flushWaitingNotices(): void }).flushWaitingNotices();
    expect(events()).toHaveLength(1);
    expect(events()[0].description).toBe("My Tank");
  });

  it("shows the fallback after a few ticks if the design never arrives", () => {
    ed.onDisplayMessageEvent(msg);
    const flush = () =>
      (ed as unknown as { flushWaitingNotices(): void }).flushWaitingNotices();
    tick += 2;
    flush();
    expect(events()).toHaveLength(0);
    tick += 4;
    flush();
    expect(events()).toHaveLength(1);
  });

  it("shows it at once when the design is already there", () => {
    arrived = true;
    ed.onDisplayMessageEvent(msg);
    expect(events()[0].description).toBe("My Tank");
  });
});
