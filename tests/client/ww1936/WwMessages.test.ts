// World War 1936: vanilla notices in the UI's language — a nation named in
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
import fs from "fs";
import path from "path";
import { describe, expect, it, vi } from "vitest";
import { EventsDisplay } from "../../../src/client/hud/layers/EventsDisplay";

const LANG = path.join(__dirname, "../../../resources/lang");
const lang = (code: string) =>
  JSON.parse(fs.readFileSync(path.join(LANG, `${code}.json`), "utf8")) as {
    events_display: Record<string, string>;
  };

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

describe("World War 1936: vanilla notices name countries in the UI's language", () => {
  it("the conquest notice names the translated country", () => {
    for (const ww of [true, false]) {
      const { ed, events } = display(ww);
      ed.onDisplayMessageEvent({
        type: GameUpdateType.DisplayEvent,
        message: "events_display.received_gold_from_conquest",
        messageType: MessageType.CONQUERED_PLAYER,
        playerID: 1,
        params: { gold: "18.5M", name: "Poland" },
        focusPlayerID: 2,
      } as never);
      expect(events()[0]).toBe(
        `[events_display.received_gold_from_conquest] gold=18.5M,name=${
          ww ? "[ww1936.country.POL]" : "Poland"
        }`,
      );
    }
  });

  it("so does an incoming naval invasion", () => {
    const { ed, events } = display(true);
    ed.onUnitIncomingEvent({
      type: GameUpdateType.UnitIncoming,
      unitID: 7,
      message: "events_display.naval_invasion_inbound",
      messageType: MessageType.NAVAL_INVASION_INBOUND,
      playerID: 1,
    } as never);
    expect(events()[0]).toContain("name=[ww1936.country.POL]");
  });

  it("Korean has the vanilla notices, with a particle that fits any name", () => {
    const en = lang("en").events_display;
    const ko = lang("ko").events_display;
    for (const key of [
      "naval_invasion_inbound",
      "atom_bomb_inbound",
      "hydrogen_bomb_inbound",
      "mirv_inbound",
      "sent_emoji_all",
    ]) {
      expect(en[key]).toBeDefined();
      expect(ko[key]).toBeDefined();
      // The same placeholders as the English one.
      const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
      expect(holes(ko[key])).toEqual(holes(en[key]));
    }
    // "폴란드을" was wrong: the object particle stays open, as in the
    // mode's own notices ("{loser}이(가)").
    expect(ko.received_gold_from_conquest).toContain("{name}을(를)");
  });
});
