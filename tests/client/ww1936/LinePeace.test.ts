// World War 1936: peace on the current line on the screens — the drawer's
// [현 점령선 평화] beside [평화 제안] and its preview (totals, the regions
// each way, the engine judge's hint, two taps to send), the map (regions
// in their new owner's colour, the panel stepping aside, taps naming
// them), and the target's card (the same summary from its side, its map).
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

import type { WwOrder } from "@openfront/engine-api/Schemas";
import type {
  WwLinePeaceRow,
  WwPeaceOfferView,
  WwWarSummary,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { EventBus } from "@openfront/shared/EventBus";
import fs from "fs";
import { html, render } from "lit";
import path from "path";
import {
  LINE_NAMES_SHOWN,
  linePeaceBand,
  linePeaceMapRegions,
  linePeaceMapSource,
  linePeaceMapTap,
  linePeacePreview,
  linePeaceUiOf,
} from "../../../src/client/hud/ww1936/LinePeaceModel";
import type { NegPeaceGame } from "../../../src/client/hud/ww1936/NegPeaceModel";
import { peaceColor } from "../../../src/client/hud/ww1936/PeaceModel";
import { whitePeaceCardModel } from "../../../src/client/hud/ww1936/WhitePeaceModel";
import { TWO_TAP_MIN_MS } from "../../../src/client/hud/ww1936/WorldWarModel";
import "../../../src/client/hud/ww1936/WwDiplomacyPanel";
import type { WwDiplomacyPanel } from "../../../src/client/hud/ww1936/WwDiplomacyPanel";
import { OpenWwDiplomacyEvent } from "../../../src/client/hud/ww1936/WwDrawer";
import { linePeacePreviewTemplate } from "../../../src/client/hud/ww1936/WwLinePeacePreview";
import { wwMapFlowActive } from "../../../src/client/hud/ww1936/WwPanelMode";
import "../../../src/client/hud/ww1936/WwWhitePeaceCard";
import type { WwWhitePeaceCard } from "../../../src/client/hud/ww1936/WwWhitePeaceCard";
import {
  PEACE_MINE,
  PEACE_SELECTED,
} from "../../../src/client/render/gl/passes/PeaceMapPass";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import { WwEndgameView } from "../../../src/client/view/WwEndgameView";
import { ID } from "./EconomyFixture";
import { fakePolGame } from "./PoliticsFixture";

/** Day 100 (7.5 ticks a day after the preparation's 600). */
const DAY100 = 600 + 750;
// The mini map's regions.
const [MUNICH, WARSAW, KRAKOW] = [4, 6, 7];

/** Germany and Italy against Poland and France, begun on `startDay`. */
function war(startDay = 0): WwWarSummary {
  const m = (tag: "DEU" | "ITA" | "POL" | "FRA") => ({
    id: ID(tag),
    state: "active" as const,
    sharePm: 500,
  });
  return {
    id: 4,
    kind: "normal",
    startDay,
    sides: [
      { leader: ID("DEU"), members: [m("DEU"), m("ITA")] },
      { leader: ID("POL"), members: [m("POL"), m("FRA")] },
    ],
    ended: false,
  };
}

function game(me: "DEU" | "POL", eg: WwEndgameView): NegPeaceGame {
  const { game } = fakePolGame({
    me,
    ticks: DAY100,
    politics: { ppMilli: 500_000 },
  });
  return { ...game, wwEndgame: () => eg } as unknown as NegPeaceGame;
}

/** Poland's possible line in war 4: it gets Munich, gives up Krakow. */
function row(o: Partial<WwLinePeaceRow> = {}): WwLinePeaceRow {
  return {
    war: 4,
    from: ID("POL"),
    to: ID("DEU"),
    gain: [MUNICH],
    lose: [KRAKOW],
    gainVp: 4,
    loseVp: 3,
    chance: 70,
    ...o,
  };
}

function polandPreviewing(r: WwLinePeaceRow | null = row()) {
  const eg = new WwEndgameView();
  const w = war();
  eg.apply({ news: [], wars: [w], linePeace: r === null ? [] : [r] });
  const g = game("POL", eg);
  const ui = linePeaceUiOf(g);
  ui.open(4, ID("DEU"));
  return { eg, w, g, ui };
}

describe("the line peace preview", () => {
  it("shows the totals and the regions each way, and offers line_peace_offer", () => {
    const { w, g } = polandPreviewing();
    const v = linePeacePreview(g, ID("POL"), w)!;
    expect(v.ready).toBe(true);
    expect(v.title).toContain("ww1936.lpeace.title");
    expect(v.totals).toBe("[ww1936.lpeace.totals] n=1,vp=4,m=1,lvp=3");
    expect(v.gain).toContain("ww1936.lpeace.gain");
    expect(v.lose).toContain("ww1936.lpeace.lose");
    expect(v.empty).toBeNull();
    expect(v.order).toEqual({
      kind: "line_peace_offer",
      war: 4,
      target: ID("DEU"),
    });
    // Another war's row has no preview.
    expect(linePeacePreview(g, ID("POL"), { ...w, id: 5 })).toBeNull();
  });

  it("the hint is the engine judge's chance in words; a human target decides alone", () => {
    const { eg, w, g } = polandPreviewing();
    expect(linePeacePreview(g, ID("POL"), w)!.hintLevel).toBe("high");
    expect(linePeacePreview(g, ID("POL"), w)!.hint).toBe(
      "[ww1936.npeace.chance] level=[ww1936.npeace.chance_high]",
    );
    eg.apply({ news: [], linePeace: [row({ chance: 40 })] });
    expect(linePeacePreview(g, ID("POL"), w)!.hintLevel).toBe("medium");
    eg.apply({ news: [], linePeace: [row({ chance: 10 })] });
    expect(linePeacePreview(g, ID("POL"), w)!.hintLevel).toBe("low");
    eg.apply({ news: [], controllers: [["HUMAN002", ID("DEU")]] });
    const h = linePeacePreview(g, ID("POL"), w)!;
    expect(h.hintLevel).toBeNull();
    expect(h.hint).toBe("[ww1936.npeace.chance_human]");
  });

  it("nothing changing hands reads as a white peace; long lists end in 'and N more'; no row yet, no totals", () => {
    const empty = polandPreviewing(
      row({ gain: [], lose: [], gainVp: 0, loseVp: 0 }),
    );
    const e = linePeacePreview(empty.g, ID("POL"), empty.w)!;
    expect(e.empty).toBe("[ww1936.lpeace.empty]");
    expect(e.gain).toBe("");
    const many = Array.from({ length: LINE_NAMES_SHOWN + 3 }, (_, i) => i + 1);
    const long = polandPreviewing(row({ gain: many }));
    expect(linePeacePreview(long.g, ID("POL"), long.w)!.gain).toContain(
      "[ww1936.lpeace.more]",
    );
    expect(linePeacePreview(long.g, ID("POL"), long.w)!.gain).toContain("n=3");
    const none = polandPreviewing(null);
    const n = linePeacePreview(none.g, ID("POL"), none.w)!;
    expect(n.ready).toBe(false);
    expect(n.totals).toBe("");
    expect(n.hint).toBe("");
  });

  it("the map: what I gain in my colour, what they gain in theirs; taps name them; the panel steps aside", () => {
    const { g, ui } = polandPreviewing();
    expect(wwMapFlowActive(g)).toBe(false);
    ui.openMap();
    expect(wwMapFlowActive(g)).toBe(true);
    expect(linePeaceMapSource(g).key()).toMatch(/^line:/);
    expect(linePeaceMapTap(g, KRAKOW)).toBe(true);
    const regions = linePeaceMapRegions(g);
    const at = (r: number) => regions.find((x) => x.region === r)!;
    expect(at(MUNICH).state).toBe(PEACE_MINE);
    expect(at(MUNICH).rgb).toBe(peaceColor(g, ID("POL")));
    expect(at(KRAKOW).state).toBe(PEACE_MINE | PEACE_SELECTED);
    expect(at(KRAKOW).rgb).toBe(peaceColor(g, ID("DEU")));
    expect(regions.some((x) => x.region === WARSAW)).toBe(false);
    const band = linePeaceBand(g)!;
    expect(band.line).toBe("[ww1936.lpeace.band] n=1,m=1");
    expect(band.region).toContain("ww1936.lpeace.region_lose");
    linePeaceMapTap(g, WARSAW);
    expect(linePeaceBand(g)!.region).toContain("ww1936.lpeace.region_none");
    ui.closeMap();
    expect(wwMapFlowActive(g)).toBe(false);
    expect(linePeaceMapTap(g, KRAKOW)).toBe(false);
    expect(linePeaceMapSource(g).key()).not.toMatch(/^line:/);
    // Closing the preview closes its map.
    ui.openMap();
    ui.close();
    expect(ui.map).toBe(false);
  });

  it("renders its buttons and hands their taps over", () => {
    const { w, g } = polandPreviewing();
    const v = linePeacePreview(g, ID("POL"), w)!;
    const calls: string[] = [];
    const host = document.createElement("div");
    render(
      html`${linePeacePreviewTemplate(v, {
        armed: false,
        map: () => calls.push("map"),
        send: () => calls.push("send"),
        cancel: () => calls.push("cancel"),
      })}`,
      host,
    );
    const q = (sel: string) => host.querySelector<HTMLButtonElement>(sel)!;
    expect(q("[data-ww-lpeace-totals]").textContent).toContain(
      "ww1936.lpeace.totals",
    );
    expect(host.querySelector('[data-ww-lpeace-hint="high"]')).not.toBeNull();
    q('[data-ww-act="lpeace_map"]').click();
    q('[data-ww-act="line_peace_offer"]').click();
    q('[data-ww-act="lpeace_cancel"]').click();
    expect(calls).toEqual(["map", "send", "cancel"]);
  });
});

describe("the drawer's war row", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  async function mount(startDay = 0) {
    const eg = new WwEndgameView();
    eg.apply({
      news: [],
      wars: [war(startDay)],
      linePeace: [row({ from: ID("DEU"), to: ID("POL"), chance: 50 })],
    });
    const g = game("DEU", eg);
    const bus = new EventBus();
    const sent: WwOrder[] = [];
    bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
    const el = document.createElement("ww-diplomacy-panel") as WwDiplomacyPanel;
    el.game = g as never;
    el.eventBus = bus;
    document.body.appendChild(el);
    el.init();
    bus.emit(new OpenWwDiplomacyEvent("wars"));
    el.tick();
    await el.updateComplete;
    const q = (sel: string) => el.querySelector<HTMLButtonElement>(sel);
    const click = async (sel: string) => {
      const b = q(sel);
      if (b === null) throw new Error(`no ${sel}`);
      b.click();
      el.tick();
      await el.updateComplete;
      await el.updateComplete;
    };
    return { el, g, sent, q, click };
  }

  it("[현 점령선 평화] sits beside [평화 제안]; the preview and the composer take turns; two taps send it", async () => {
    const m = await mount();
    expect(m.q('[data-ww-act="peace_compose"]')).not.toBeNull();
    const open = m.q('[data-ww-act="lpeace_open"]')!;
    expect(open.textContent).toContain("ww1936.lpeace.offer");
    expect(open.disabled).toBe(false);
    await m.click('[data-ww-act="lpeace_open"]');
    expect(m.q("[data-ww-lpeace]")).not.toBeNull();
    expect(m.q("[data-ww-lpeace-totals]")!.textContent).toContain(
      "ww1936.lpeace.totals",
    );
    // [평화 제안] opens the composer as before; the preview goes.
    await m.click('[data-ww-act="peace_compose"]');
    expect(m.q("[data-ww-npeace]")).not.toBeNull();
    expect(m.q("[data-ww-lpeace]")).toBeNull();
    // And back.
    await m.click('[data-ww-act="lpeace_open"]');
    expect(m.q("[data-ww-npeace]")).toBeNull();
    expect(m.q("[data-ww-lpeace]")).not.toBeNull();
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    await m.click('[data-ww-act="line_peace_offer"]');
    expect(m.sent).toEqual([]);
    now += TWO_TAP_MIN_MS + 1;
    await m.click('[data-ww-act="line_peace_offer"]');
    expect(m.sent).toEqual([
      { kind: "line_peace_offer", war: 4, target: ID("POL") },
    ]);
    expect(linePeaceUiOf(m.g).war).toBe(0);
  });

  it("greyed with the white peace's reason while it can't go", async () => {
    // Day 100 of a war begun on day 20: ten days early.
    const m = await mount(20);
    expect(m.q('[data-ww-act="lpeace_open"]')!.disabled).toBe(true);
    expect(m.q("[data-ww-wpeace-block]")!.textContent).toContain(
      "ww1936.wpeace.block.too_early",
    );
  });
});

describe("the target's card of a line offer", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  /** Germany offers Poland the line: Germany gets Krakow, Poland Munich. */
  function offer(): WwPeaceOfferView {
    return {
      id: 7,
      war: 4,
      from: ID("DEU"),
      to: ID("POL"),
      whole: true,
      sentTick: DAY100 - 100,
      deadlineTick: DAY100 + 200,
      sides: [
        { id: ID("DEU"), capPm: 120, scorePm: 640 },
        { id: ID("POL"), capPm: 450, scorePm: 360 },
      ],
      held: [[ID("DEU"), ID("POL"), 120]],
      terms: null,
      line: { gain: [KRAKOW], lose: [MUNICH], gainVp: 3, loseVp: 4 },
    };
  }

  it("shows the line from my side under its own title", () => {
    const eg = new WwEndgameView();
    eg.apply({ news: [], wars: [war()], peaceOffers: [offer()] });
    const c = whitePeaceCardModel(game("POL", eg))!;
    expect(c.title).toContain("ww1936.lpeace.card_title");
    // Poland gets Munich (4 points), gives up Krakow (3).
    expect(c.line!.totals).toBe("[ww1936.lpeace.totals] n=1,vp=4,m=1,lvp=3");
    expect(c.terms).toEqual([]);
    // Another kind of offer has no line.
    eg.apply({ news: [], peaceOffers: [{ ...offer(), line: undefined }] });
    expect(whitePeaceCardModel(game("POL", eg))!.line).toBeNull();
  });

  it("[지도에서 보기] shows the line on the map with a band; [완료] or the offer's end closes it", async () => {
    const eg = new WwEndgameView();
    eg.apply({ news: [], wars: [war()], peaceOffers: [offer()] });
    const g = game("POL", eg);
    const el = document.createElement(
      "ww-white-peace-card",
    ) as WwWhitePeaceCard;
    el.game = g as never;
    el.eventBus = new EventBus();
    document.body.appendChild(el);
    el.init();
    el.tick();
    await el.updateComplete;
    const layer = el.cardLayer()!;
    expect(layer.querySelector("[data-ww-wpeace-line]")).not.toBeNull();
    layer
      .querySelector<HTMLButtonElement>('[data-ww-act="lpeace_card_map"]')!
      .click();
    await el.updateComplete;
    const ui = linePeaceUiOf(g);
    expect(ui.map).toBe(true);
    expect(ui.offer).toBe(7);
    expect(wwMapFlowActive(g)).toBe(true);
    // From my side: Munich mine, Krakow theirs.
    const regions = linePeaceMapRegions(g);
    expect(regions.find((r) => r.region === MUNICH)!.rgb).toBe(
      peaceColor(g, ID("POL")),
    );
    expect(regions.find((r) => r.region === KRAKOW)!.rgb).toBe(
      peaceColor(g, ID("DEU")),
    );
    el.tick();
    await el.updateComplete;
    const done = document.querySelector<HTMLButtonElement>(
      '[data-ww-act="lpeace_done"]',
    )!;
    expect(done).not.toBeNull();
    done.click();
    expect(ui.map).toBe(false);
    // The offer ends while its map shows: the map goes with it.
    ui.openMap(7);
    eg.apply({ news: [], peaceOffers: [] });
    el.tick();
    expect(ui.map).toBe(false);
  });
});

describe("the line peace's texts", () => {
  const lang = (code: string) =>
    JSON.parse(
      fs.readFileSync(
        path.join(__dirname, `../../../resources/lang/${code}.json`),
        "utf8",
      ),
    ) as {
      ww1936: {
        lpeace: Record<string, string>;
        news: Record<string, string>;
      };
    };
  const params = (s: string) =>
    [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

  it("every key is in English and Korean with the same parameters, a space after } before Hangul", () => {
    const en = lang("en").ww1936;
    const ko = lang("ko").ww1936;
    const keys = Object.keys(en.lpeace);
    expect(Object.keys(ko.lpeace).sort()).toEqual([...keys].sort());
    const pairs: [string, string][] = keys.map((k) => [
      en.lpeace[k],
      ko.lpeace[k],
    ]);
    pairs.push([en.news.news_line_peace, ko.news.news_line_peace]);
    for (const [e, k] of pairs) {
      expect(params(k)).toEqual(params(e));
      expect(k).not.toMatch(/\}[가-힣]/);
    }
  });
});
