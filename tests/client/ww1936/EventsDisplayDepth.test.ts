// World War 1936 P6 (plan Task 14): every depth notification renders.
// (harness of WwMessages.test.ts) World War 1936: vanilla notices in the UI's language — a nation named in
// a message is its translated country ("폴란드을 정복" was the engine's
// English "Poland" in a Korean sentence), and the Korean strings exist.
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

vi.mock("../../../src/client/Utils", () => ({
  translateText: vi.fn(
    (key: string, params?: Record<string, string | number>) =>
      params === undefined
        ? `[${key}]`
        : `[${key}] ${Object.entries(params)
            .map(([k, v]) => `${k}=${v}`)
            .join(",")}`,
  ),
  getMessageTypeClasses: vi.fn(() => ""),
}));

import { MessageType } from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { describe, expect, it, vi } from "vitest";
import { EventsDisplay } from "../../../src/client/hud/layers/EventsDisplay";

function display(worldWar: boolean) {
  const ed = new EventsDisplay();
  const me = { smallID: () => 1, displayName: () => "Germany" };
  const poland = {
    smallID: () => 2,
    displayName: () => "Poland",
    countryTag: () => "POL",
    isPlayer: () => true,
  };
  (ed as unknown as { game: unknown }).game = {
    myPlayer: () => me,
    playerBySmallID: (id: number) =>
      id === 2 ? poland : { isPlayer: () => false },
    unit: () => ({ owner: () => poland, troops: () => 11_700 }),
    ticks: () => 0,
    worldWarScenario: () => (worldWar ? {} : null),
  };
  const events = () =>
    (ed as unknown as { events: { description: string }[] }).events.map(
      (e) => e.description,
    );
  return { ed, events };
}

import { DEPTH_NOTICE_KEYS } from "../../../src/client/hud/ww1936/DepthMiscModel";

describe("World War 1936 depth notices", () => {
  it("every depth notification key renders", () => {
    const { ed, events } = display(true);
    for (const key of DEPTH_NOTICE_KEYS) {
      ed.onDisplayMessageEvent({
        type: GameUpdateType.DisplayEvent,
        message: key,
        messageType: MessageType.WORLD_WAR,
        playerID: 1,
        params: { project: "sp_atomic", n: 1 },
      } as never);
    }
    const out = events();
    expect(out.length).toBe(DEPTH_NOTICE_KEYS.length);
    DEPTH_NOTICE_KEYS.forEach((key, i) => expect(out[i]).toContain(`[${key}]`));
    // The project id came out as the project's name.
    expect(out[0]).toContain("[ww1936.project.sp_atomic]");
  });

  it("a trait or promotion names the general from its id; an ace its wing number", () => {
    const { ed, events } = display(true);
    const send = (key: string, params: Record<string, string | number>) =>
      ed.onDisplayMessageEvent({
        type: GameUpdateType.DisplayEvent,
        message: `events_display.${key}`,
        messageType: MessageType.WORLD_WAR,
        playerID: 1,
        params,
      } as never);
    send("ww1936_trait_unlocked", { general: 1, trait: "trickster" });
    send("ww1936_fm_promoted", { general: 1 });
    send("ww1936_ace", { callsign: 4, state: "rise" });
    const [trait, fm, ace] = events();
    expect(trait).toContain("general=[ww1936.general.");
    expect(trait).toContain("trait=[ww1936.trait.trickster]");
    expect(fm).toContain("general=[ww1936.general.");
    expect(fm).not.toContain("name=");
    expect(ace).toContain("callsign=[ww1936.ace.callsign] n=4");
  });

  it("the drop and the dam use the world-news colour", () => {
    const { ed } = display(true);
    for (const key of [
      "ww1936_nuke_dropped",
      "ww1936_dam_destroyed",
      "ww1936_scorched",
    ]) {
      ed.onDisplayMessageEvent({
        type: GameUpdateType.DisplayEvent,
        message: `events_display.${key}`,
        messageType: MessageType.WORLD_WAR,
        playerID: 1,
        params: {},
      } as never);
    }
    const types = (
      ed as unknown as { events: { type: MessageType }[] }
    ).events.map((e) => e.type);
    expect(types).toEqual([
      MessageType.NUKE_DETONATED,
      MessageType.NUKE_DETONATED,
      MessageType.WORLD_WAR,
    ]);
  });
});
