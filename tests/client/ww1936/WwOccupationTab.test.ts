import type { WwOrder } from "@openfront/engine-api/Schemas";
import { WW_AUTO_INTEGRATE_DAYS } from "@openfront/engine-api/ww1936/EndgameTypes";
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

import { today } from "../../../src/client/hud/ww1936/WorldWarModel";
import "../../../src/client/hud/ww1936/WwOccupationTab";
import type { WwOccupationTab } from "../../../src/client/hud/ww1936/WwOccupationTab";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import { ID } from "./EconomyFixture";
import { type EndOptions, fakeEndGame, occ } from "./EndgameFixture";

const PARIS = 1;
const WARSAW = 6;
const KRAKOW = 7;

/** Germany administers Paris (France's) and Warsaw, Krakow (Poland's). */
function occupation(over: EndOptions["endgame"] = {}): EndOptions {
  return {
    me: "DEU",
    control: [
      [PARIS, "DEU"],
      [WARSAW, "DEU"],
      [KRAKOW, "DEU"],
    ],
    endgame: {
      occupation: [
        occ(PARIS, "DEU", { needDeci: 30, supDeci: 10, resBp: 4_000 }),
        occ(WARSAW, "DEU", { needDeci: 40, supDeci: 40, resBp: 6_000 }),
        occ(KRAKOW, "DEU", { needDeci: 20, supDeci: 5, resBp: 2_000 }),
      ],
      ...over,
    },
  };
}

async function mount(o: EndOptions) {
  const { game } = fakeEndGame(o);
  const bus = new EventBus();
  const sent: WwOrder[] = [];
  bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
  const el = document.createElement("ww-occupation-tab") as WwOccupationTab;
  el.game = game;
  el.eventBus = bus;
  document.body.appendChild(el);
  await el.updateComplete;
  const toggle = async (owner: number) => {
    el.querySelector<HTMLButtonElement>(
      `[data-ww-occ-owner="${owner}"] [data-ww-occ-toggle]`,
    )!.click();
    await el.updateComplete;
  };
  const open = () =>
    [...el.querySelectorAll<HTMLElement>("[data-ww-occ-owner]")]
      .filter(
        (li) =>
          li
            .querySelector("[data-ww-occ-toggle]")
            ?.getAttribute("aria-expanded") === "true",
      )
      .map((li) => Number(li.dataset.wwOccOwner));
  return { el, game, sent, toggle, open };
}

describe("<ww-occupation-tab> annexed land", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("labels annexed regions and counts down to auto-integration", async () => {
    const { el, game, toggle } = await mount(
      occupation({
        occupation: [
          occ(WARSAW, "DEU", { autoSinceDay: 0 }),
          occ(KRAKOW, "DEU", { autoSinceDay: -1 }),
        ],
      }),
    );
    await toggle(ID("POL"));
    const tag = (r: number) =>
      el.querySelector(`[data-ww-occ-region="${r}"] [data-ww-occ-annexed]`);
    expect(tag(WARSAW)?.textContent).toContain("ww1936.occ.annexed");
    expect(tag(WARSAW)?.textContent).toContain(
      `days=${Math.max(0, WW_AUTO_INTEGRATE_DAYS - today(game))}`,
    );
    expect(tag(KRAKOW)).toBeNull();
  });
});

describe("<ww-occupation-tab> (P5 spec §20.4)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("only one country row opens at a time", async () => {
    const { el, toggle, open } = await mount(occupation());
    // One row per legal owner, by smallID, none open.
    expect(
      [...el.querySelectorAll<HTMLElement>("[data-ww-occ-owner]")].map((li) =>
        Number(li.dataset.wwOccOwner),
      ),
    ).toEqual([ID("FRA"), ID("POL")]);
    expect(open()).toEqual([]);
    expect(el.querySelector("[data-ww-occ-summary]")?.textContent).toContain(
      "n=3",
    );
    await toggle(ID("POL"));
    expect(open()).toEqual([ID("POL")]);
    // Poland's regions by resistance, highest first.
    expect(
      [...el.querySelectorAll<HTMLElement>("[data-ww-occ-region]")].map((b) =>
        Number(b.dataset.wwOccRegion),
      ),
    ).toEqual([WARSAW, KRAKOW]);
    await toggle(ID("FRA"));
    expect(open()).toEqual([ID("FRA")]);
    expect(el.querySelectorAll("[data-ww-occ-regions]")).toHaveLength(1);
    // A second tap closes it.
    await toggle(ID("FRA"));
    expect(open()).toEqual([]);
  });

  it("the law buttons show the lock days", async () => {
    vi.useFakeTimers();
    const { game } = fakeEndGame({ me: "DEU" });
    const day = today(game);
    const { el, toggle, sent } = await mount(
      occupation({
        occLaws: [
          {
            by: ID("DEU"),
            of: ID("POL"),
            law: "occ_martial",
            lockUntilDay: day + 12,
          },
        ],
      }),
    );
    await toggle(ID("POL"));
    const row = el.querySelector(`[data-ww-occ-owner="${ID("POL")}"]`)!;
    const state = (law: string) =>
      row
        .querySelector(`[data-ww-occ-law="${law}"]`)
        ?.getAttribute("data-state");
    expect(state("occ_martial")).toBe("current");
    expect(state("occ_civil")).toBe("blocked");
    expect(state("occ_military")).toBe("blocked");
    const why = [...row.querySelectorAll("[data-ww-occ-law-why]")].map(
      (s) => s.textContent?.trim() ?? "",
    );
    expect(why).toEqual([
      "[ww1936.occ.law_lock] days=12",
      "[ww1936.occ.law_lock] days=12",
    ]);
    // The default law (every other country's) has no lock: two taps set it.
    const civil = el.querySelector<HTMLButtonElement>(
      '[data-ww-occ-default] [data-ww-occ-law="occ_civil"]',
    )!;
    expect(civil.dataset.state).toBe("open");
    expect(civil.textContent).toContain("[ww1936.occ.law_cost] pp=25");
    civil.click();
    await el.updateComplete;
    expect(sent).toEqual([]);
    vi.advanceTimersByTime(500);
    civil.click();
    await el.updateComplete;
    expect(sent).toEqual([{ kind: "occupation_law", of: 0, law: "occ_civil" }]);
  });
});
