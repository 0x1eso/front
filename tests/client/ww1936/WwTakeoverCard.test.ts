// World War 1936 P5 (plan Task 11, lane U3; spec §11.2, §20.6): the
// takeover card — three same-faction candidates, two taps pick one, the
// first is the timeout default; a controller change closes the drawers;
// who is out of the game (the P0 spectate screen).
import { EventBus } from "@openfront/shared/EventBus";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, string | number>) =>
    params && Object.keys(params).length > 0
      ? `[${key}] ${Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")}`
      : `[${key}]`,
}));

import type { WwTakeoverView } from "@openfront/engine-api/ww1936/EndgameTypes";
import { html } from "lit";
import { TWO_TAP_MIN_MS } from "../../../src/client/hud/ww1936/WorldWarModel";
import {
  OpenWwPoliticsEvent,
  WwDrawerBase,
  WwDrawerEvent,
} from "../../../src/client/hud/ww1936/WwDrawer";
import "../../../src/client/hud/ww1936/WwExileBand";
import {
  EXILE_BAND_TOP,
  type WwExileBand,
} from "../../../src/client/hud/ww1936/WwExileBand";
import "../../../src/client/hud/ww1936/WwTakeoverCard";
import {
  type WwTakeoverCard,
  wwOutOfGame,
} from "../../../src/client/hud/ww1936/WwTakeoverCard";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import type { PlayerView } from "../../../src/client/view";
import {
  WwControllerChangedEvent,
  WwEndgameView,
} from "../../../src/client/view/WwEndgameView";
import { ID, scenario } from "./EconomyFixture";

const card = (over: Partial<WwTakeoverView> = {}): WwTakeoverView => ({
  client: "c1",
  from: ID("DEU"),
  candidates: [ID("ITA"), ID("GBR")],
  deadlineTick: 900,
  ...over,
});

function me(tiles: number): PlayerView {
  return {
    smallID: () => ID("DEU"),
    isAlive: () => tiles > 0,
    hasSpawned: () => true,
    isPlayer: () => true,
  } as unknown as PlayerView;
}

function fakeGame(eg: WwEndgameView, ticks = 700, mine = me(0)) {
  const summaries = new Map([
    [ID("ITA"), { civ: 20, mil: 14 }],
    [ID("GBR"), { civ: 30, mil: 9 }],
  ]);
  return {
    ticks: () => ticks,
    myClientID: () => "c1",
    myPlayer: () => mine,
    worldWarScenario: () => scenario,
    // Italy fights France.
    worldWarData: () => ({
      wars: [{ a: ID("ITA"), b: ID("FRA") }],
      capitulated: [],
    }),
    wwEndgame: () => eg,
    wwEconomy: () => ({ summary: (id: number) => summaries.get(id) ?? null }),
    wwLand: () => ({
      countries: new Map([
        [ID("ITA"), { divisions: 41 }],
        [ID("GBR"), { divisions: 18 }],
      ]),
    }),
    playerBySmallID: () => ({ isPlayer: () => false }),
  };
}

async function mount(eg: WwEndgameView) {
  const bus = new EventBus();
  const sent: unknown[] = [];
  bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
  const column = document.createElement("div");
  document.body.appendChild(column);
  const el = document.createElement("ww-takeover-card") as WwTakeoverCard;
  el.game = fakeGame(eg) as never;
  el.eventBus = bus;
  column.appendChild(el);
  el.init();
  el.tick();
  await el.updateComplete;
  const layer = el.cardLayer()!;
  const q = (s: string) => layer.querySelector<HTMLElement>(s);
  const redraw = async () => {
    el.requestUpdate();
    await el.updateComplete;
  };
  return { el, bus, sent, layer, q, redraw };
}

/** A drawer as the World War drawers are: one open at a time (WwDrawerBase). */
class TestDrawer extends WwDrawerBase {
  constructor(protected readonly drawerId: "industry" | "politics") {
    super();
  }
  show() {
    this.setOpen(true);
  }
  render() {
    return html``;
  }
}
customElements.define("ww-test-drawer", TestDrawer);

describe("<ww-takeover-card> (spec §20.6)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("two taps pick a candidate", async () => {
    const eg = new WwEndgameView();
    eg.apply({ news: [], takeover: [card()] });
    const m = await mount(eg);
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const italy = () => m.q(`[data-ww-candidate="${ID("ITA")}"]`)!;
    italy().click();
    await m.redraw();
    // The first tap arms it: nothing sent, "tap again to confirm".
    expect(m.sent).toEqual([]);
    expect(italy().dataset.armed).toBe("true");
    expect(m.q("[data-ww-confirm]")!.textContent).toBe(
      "[ww1936.takeover.confirm]",
    );
    now += TWO_TAP_MIN_MS + 50;
    italy().click();
    await m.redraw();
    expect(m.sent).toEqual([{ kind: "takeover_pick", smallID: ID("ITA") }]);
    // Waiting for the engine: the other candidate is shut, no second pick.
    expect(m.q("[data-ww-takeover-sent]")).not.toBeNull();
    const gbr = m.q(`[data-ww-candidate="${ID("GBR")}"]`) as HTMLButtonElement;
    expect(gbr.disabled).toBe(true);
    gbr.click();
    now += 1000;
    gbr.click();
    expect(m.sent).toHaveLength(1);
  });

  it("the first candidate is shown as the timeout default", async () => {
    const eg = new WwEndgameView();
    eg.apply({ news: [], takeover: [card()] });
    const m = await mount(eg);
    expect(m.q("[data-ww-takeover-default]")!.textContent).toBe(
      "[ww1936.takeover.default] country=[ww1936.country.ITA]",
    );
    const rows = [...m.layer.querySelectorAll("[data-ww-candidate]")];
    expect(rows.map((r) => r.getAttribute("data-ww-candidate"))).toEqual([
      String(ID("ITA")),
      String(ID("GBR")),
    ]);
    // Flag, name, factories (civilian + military), divisions; the wars.
    expect(rows[0].textContent).toContain(
      "[ww1936.takeover.candidate] country=[ww1936.country.ITA],factories=34,divisions=41 ⏱",
    );
    expect(rows[0].textContent).toContain(
      "[ww1936.takeover.at_war] enemies=[ww1936.country.FRA]",
    );
    expect(rows[1].textContent).not.toContain("⏱");
    expect(rows[1].textContent).not.toContain("ww1936.takeover.at_war");
    expect(rows[0].querySelector("img")!.getAttribute("src")).toContain(
      "flags/italy.svg",
    );
    // 200 ticks left of 300: 20 s, two thirds of the bar.
    expect(m.layer.textContent).toContain("[ww1936.takeover.time] s=20");
    expect(m.q("[data-ww-takeover-time]")!.style.width).toBe("67%");
    // No card for another client.
    eg.apply({ news: [], takeover: [card({ client: "c2" })] });
    m.el.tick();
    await m.el.updateComplete;
    expect(m.q("[data-ww-takeover]")).toBeNull();
  });

  it("a takeover closes every open drawer", async () => {
    const eg = new WwEndgameView();
    const m = await mount(eg);
    const drawers = (["industry", "politics"] as const).map((id) => {
      const d = new TestDrawer(id);
      d.eventBus = m.bus;
      d.init();
      return d;
    });
    const open = new Set<string>();
    m.bus.on(WwDrawerEvent, (e) =>
      e.open ? open.add(e.drawer) : open.delete(e.drawer),
    );
    for (const d of drawers) {
      d.show();
      m.bus.emit(new WwControllerChangedEvent(ID("ITA")));
      expect(drawers.map((x) => x.isOpen())).toEqual([false, false]);
      // The trackers (dials, leaderboard fold) see nothing open.
      expect(open.size).toBe(0);
    }
  });

  it("an exile and a human picking a country stay in the game", () => {
    const eg = new WwEndgameView();
    const out = (mine: PlayerView) =>
      wwOutOfGame(fakeGame(eg, 700, mine) as never);
    // Playing: alive.
    expect(out(me(40))).toBe(false);
    // Gone with no exile and no card: the P0 spectate screen.
    expect(out(me(0))).toBe(true);
    // A government in exile has no land and plays on.
    eg.apply({
      news: [],
      exiles: [
        {
          smallID: ID("DEU"),
          host: ID("ITA"),
          legitBp: 5_000,
          deltaBp: 0,
          virtualMil: 5,
          capital: 3,
        },
      ],
    });
    expect(out(me(0))).toBe(false);
    // Picking a country: no screen over the card.
    eg.apply({ news: [], exiles: [], takeover: [card()] });
    expect(out(me(0))).toBe(false);
    // Spectating (no candidate): out, though "my player" is none.
    eg.apply({ news: [], takeover: [], controllers: [["c1", 0]] });
    expect(out(null as never)).toBe(true);
  });
});

describe("<ww-exile-band> (spec §20.6)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("an exiled human sees the seat, legitimacy, factories and capital", async () => {
    const eg = new WwEndgameView();
    const bus = new EventBus();
    const opened: unknown[] = [];
    bus.on(OpenWwPoliticsEvent, (e) => opened.push(e.tab));
    const el = document.createElement("ww-exile-band") as WwExileBand;
    el.game = fakeGame(eg) as never;
    el.eventBus = bus;
    document.body.appendChild(el);
    el.init();
    el.tick();
    await el.updateComplete;
    // Not in exile: no band.
    expect(el.querySelector("[data-ww-exile-band]")).toBeNull();
    eg.apply({
      news: [],
      exiles: [
        {
          smallID: ID("DEU"),
          // Seated in Britain's capital region, London (region 10).
          host: ID("GBR"),
          legitBp: 5_480,
          deltaBp: 12,
          virtualMil: 5,
          capital: 3,
        },
      ],
    });
    el.tick();
    await el.updateComplete;
    const band = el.querySelector<HTMLButtonElement>("[data-ww-exile-band]")!;
    expect(band.querySelector("[data-ww-exile-text]")!.textContent).toBe(
      "[ww1936.exile.band] host=London,pct=54,trend=0.12,n=5,capital=Berlin",
    );
    // Below the top band and the news line.
    expect(band.style.top).toBe(`${EXILE_BAND_TOP}px`);
    band.click();
    expect(opened).toEqual(["government"]);
  });
});
