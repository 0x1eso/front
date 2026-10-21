import { EventBus } from "@openfront/shared/EventBus";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, string | number>) =>
    params
      ? `[${key}] ${Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")}`
      : `[${key}]`,
}));

import { EVENT_PICTURES } from "@openfront/engine-api/ww1936/PoliticsTypes";
import fs from "fs";
import path from "path";
import { OpenWwDiplomacyEvent } from "../../../src/client/hud/ww1936/WwDrawer";
import "../../../src/client/hud/ww1936/WwEventCards";
import {
  CHOICE_WAIT_TICKS,
  type WwEventCards,
} from "../../../src/client/hud/ww1936/WwEventCards";
import "../../../src/client/hud/ww1936/WwNewsTicker";
import {
  NEWS_SHOW_MS,
  WwNewsTicker,
} from "../../../src/client/hud/ww1936/WwNewsTicker";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import { ID } from "./EconomyFixture";
import {
  card,
  fakePolGame,
  polDetail,
  PolOptions,
  polSummary,
} from "./PoliticsFixture";

async function mount(o: PolOptions) {
  const { game, pol } = fakePolGame({ ticks: 700, ...o });
  const bus = new EventBus();
  const sent: unknown[] = [];
  bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
  const column = document.createElement("div");
  document.body.appendChild(column);
  const el = document.createElement("ww-event-cards") as WwEventCards;
  el.game = game as never;
  el.eventBus = bus;
  column.appendChild(el);
  el.init();
  el.tick();
  await el.updateComplete;
  const layer = el.cardLayer()!;
  const q = <T extends Element = HTMLElement>(s: string) =>
    layer.querySelector<T & Element>(s) as T | null;
  const redraw = async () => {
    el.requestUpdate();
    await el.updateComplete;
  };
  return { el, bus, sent, layer, q, redraw, pol };
}

const me = (cards: ReturnType<typeof card>[], tag: "DEU" | "POL" = "DEU") => ({
  me: tag,
  polSummaries: [polSummary(tag)],
  polDetails: [polDetail(tag, { pending: cards })],
});

describe("<ww-event-cards> (P3 spec §21.6)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("two cards at most and a +N badge", async () => {
    const m = await mount(
      me([card({ uid: 1 }), card({ uid: 2 }), card({ uid: 3 })]),
    );
    expect(m.layer.querySelectorAll("[data-ww-event]")).toHaveLength(2);
    expect(m.q("[data-ww-event-more]")!.textContent!.trim()).toBe(
      "[ww1936.eventui.more] n=1",
    );
    // The layer is its own, above the drawers (spec §21.9).
    expect(m.layer.className).toContain("z-[1003]");
    // The picture and the sender's flag.
    const first = m.q("[data-ww-event='1']")!;
    expect(
      first.querySelector("[data-ww-event-picture]")!.getAttribute("alt"),
    ).toBe("[ww1936.eventui.pic.table]");
    expect(
      first.querySelector("[data-ww-event-flag]")!.getAttribute("src"),
    ).toContain("flags/");
    // "–" folds a card to a strip; its time still shows.
    first.querySelector<HTMLButtonElement>("[data-ww-event-fold]")!.click();
    await m.redraw();
    const strip = m.q("[data-ww-event='1']")!;
    expect(strip.dataset.folded).toBe("true");
    expect(strip.textContent).toContain("[ww1936.eventui.seconds] s=10");
  });

  it("a choice needs two taps and sends event_choose", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout"] });
    vi.setSystemTime(10_000);
    const m = await mount(me([card({ uid: 7 })]));
    const option = () => m.q<HTMLButtonElement>("[data-ww-option='a']")!;
    option().click();
    await m.redraw();
    expect(m.sent).toEqual([]);
    expect(option().dataset.armed).toBe("true");
    expect(option().textContent).toContain("[ww1936.eventui.confirm]");
    vi.setSystemTime(10_500);
    option().click();
    await m.redraw();
    expect(m.sent).toEqual([{ kind: "event_choose", uid: 7, option: "a" }]);
    expect(m.q("[data-ww-event-sent]")!.textContent!.trim()).toBe(
      "[ww1936.eventui.sent]",
    );
    // The other option can no longer be picked; a third tap sends nothing.
    expect(m.q<HTMLButtonElement>("[data-ww-option='b']")!.disabled).toBe(true);
    option().click();
    expect(m.sent).toHaveLength(1);
  });

  it("the countdown and the default option are shown", async () => {
    const m = await mount(
      me([card({ uid: 1, firedTick: 600, deadlineTick: 800, aiOption: "a" })]),
    );
    const c = m.q("[data-ww-event='1']")!;
    expect(c.textContent).toContain("[ww1936.eventui.seconds] s=10");
    expect(
      c.querySelector<HTMLElement>("[data-ww-event-time]")!.style.width,
    ).toBe("50%");
    expect(c.querySelector("[data-ww-event-default]")!.textContent).toBe(
      "[ww1936.eventui.default] option=[ww1936.event_opt.gen_diplo_nap.a]",
    );
    // An option's effects: the first two lines of describeEffects.
    const a = c.querySelector("[data-ww-option='a']")!.textContent!;
    expect(a).toContain("[ww1936.fx.nap]");
    expect(a).toContain("of=[ww1936.pol.sel.from]");
    document.body.innerHTML = "";
    // A human default wins over the AI's pick at the deadline (spec §12.5).
    const ultimatum = await mount(
      me(
        [
          card({
            uid: 2,
            eventId: "aut_berlin_ultimatum",
            from: ID("DEU"),
            aiOption: "a",
          }),
        ],
        "POL",
      ),
    );
    expect(ultimatum.q("[data-ww-event-default]")!.textContent).toBe(
      "[ww1936.eventui.default] option=[ww1936.event_opt.aut_berlin_ultimatum.b]",
    );
  });

  it("an annexation option carries the red warning", async () => {
    const m = await mount(
      me(
        [
          card({
            uid: 3,
            eventId: "aut_berlin_ultimatum",
            from: ID("DEU"),
            open: ["a", "b"],
          }),
        ],
        "POL",
      ),
    );
    const a = m.q("[data-ww-option='a']")!;
    expect(
      a.querySelector("[data-ww-annex-warning]")!.textContent!.trim(),
    ).toBe("[ww1936.eventui.annex_warning] country=[ww1936.country.DEU]");
    expect(m.q("[data-ww-option='b'] [data-ww-annex-warning]")).toBeNull();
    // An option that can't be picked now is disabled.
    document.body.innerHTML = "";
    const closed = await mount(me([card({ uid: 4, open: ["b"] })], "POL"));
    expect(closed.q<HTMLButtonElement>("[data-ww-option='a']")!.disabled).toBe(
      true,
    );
  });

  it("a refused choice gives the options back", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout"] });
    vi.setSystemTime(10_000);
    const m = await mount(me([card({ uid: 9 })]));
    const option = () => m.q<HTMLButtonElement>("[data-ww-option='b']")!;
    option().click();
    vi.setSystemTime(10_500);
    option().click();
    await m.redraw();
    expect(m.q<HTMLButtonElement>("[data-ww-option='a']")!.disabled).toBe(true);
    // The card is still there two seconds later: the engine refused it.
    const game = m.el.game as unknown as { ticks: () => number };
    const t = game.ticks();
    game.ticks = () => t + CHOICE_WAIT_TICKS;
    m.el.tick();
    await m.redraw();
    expect(m.q<HTMLButtonElement>("[data-ww-option='a']")!.disabled).toBe(
      false,
    );
    expect(m.q("[data-ww-event-sent]")).toBeNull();
  });

  it("on a short phone the time stays under the title and the text scrolls", async () => {
    vi.stubGlobal("innerHeight", 390);
    const m = await mount(me([card({ uid: 1 })]));
    const c = m.q("[data-ww-event='1']")!;
    const order = [
      ...c.querySelectorAll("[data-ww-event-default], [data-ww-event-body]"),
    ].map((e) => (e.hasAttribute("data-ww-event-body") ? "body" : "time"));
    expect(order).toEqual(["time", "body"]);
    expect(c.querySelector("[data-ww-event-scroll]")!.className).toContain(
      "overflow-y-auto",
    );
    vi.unstubAllGlobals();
  });

  it("the eight pictures are small, plain line drawings", () => {
    const DIR = path.join(__dirname, "../../../resources/images/ww1936/event");
    const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".svg"));
    expect(files.sort()).toEqual(EVENT_PICTURES.map((p) => `${p}.svg`).sort());
    for (const f of files) {
      const svg = fs.readFileSync(path.join(DIR, f), "utf8");
      expect(svg.length, f).toBeLessThanOrEqual(4096);
      expect(svg, f).not.toMatch(
        /<script|on[a-z]+=|href=|<image|<foreignObject|<text|style=|Gradient/i,
      );
      expect(svg, f).toContain('viewBox="0 0 160 64"');
      expect(svg, f).toContain("CC BY-SA 4.0");
      // One light line colour, no fills.
      for (const m of svg.matchAll(/(fill|stroke)="([^"]*)"/g)) {
        expect(["none", "#e5e7eb"], `${f} ${m[1]}`).toContain(m[2]);
      }
    }
  });

  it("a capitulated country and a spectator get no cards", async () => {
    const gone = await mount({ ...me([card()]), capitulated: ["DEU"] });
    expect(gone.layer.querySelector("[data-ww-event]")).toBeNull();
    document.body.innerHTML = "";
    const spectator = await mount({ me: null });
    expect(spectator.layer.querySelector("[data-ww-event]")).toBeNull();
  });
});

describe("<ww-news-ticker> (P3 spec §21.7)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("one line for six seconds, three waiting at most, a tap opens the world tab", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(100_000);
    const { game, pol } = fakePolGame({});
    const bus = new EventBus();
    const opened: OpenWwDiplomacyEvent[] = [];
    bus.on(OpenWwDiplomacyEvent, (e) => opened.push(e));
    const el = document.createElement("ww-news-ticker") as WwNewsTicker;
    el.game = game as never;
    el.eventBus = bus;
    document.body.appendChild(el);
    const news = (...ids: string[]) =>
      pol.apply(
        {
          countries: [],
          details: [],
          global: null,
          regions: [],
          news: ids.map((id) => ({ id, params: { countryTag: "DEU" } })),
          cards: [],
        },
        700,
      );
    const text = async () => {
      el.tick();
      await el.updateComplete;
      return el.querySelector("[data-ww-news-text]")?.textContent ?? null;
    };
    news("news_anschluss");
    expect(await text()).toBe(
      "[ww1936.news.news_anschluss] countryTag=DEU,country=[ww1936.country.DEU]",
    );
    expect(
      el.querySelector("[data-ww-news] img")!.getAttribute("src"),
    ).toContain("flags/");
    // Five more in one go: only the newest three wait; the oldest fold.
    news("n1", "n2", "n3", "n4", "n5");
    expect(await text()).toContain("[ww1936.news.n3]");
    vi.setSystemTime(100_000 + NEWS_SHOW_MS);
    expect(await text()).toContain("[ww1936.news.n4]");
    vi.setSystemTime(100_000 + 2 * NEWS_SHOW_MS);
    expect(await text()).toContain("[ww1936.news.n5]");
    el.querySelector<HTMLButtonElement>("[data-ww-news]")!.click();
    expect(opened[0].tab).toBe("world");
    vi.setSystemTime(100_000 + 3 * NEWS_SHOW_MS);
    expect(await text()).toBeNull();
  });
});
