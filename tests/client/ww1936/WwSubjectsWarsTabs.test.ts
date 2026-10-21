import type { WwOrder } from "@openfront/engine-api/Schemas";
import { EventBus } from "@openfront/shared/EventBus";
import { render } from "lit";
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

import "../../../src/client/hud/ww1936/WwSubjectsTab";
import type { WwSubjectsTab } from "../../../src/client/hud/ww1936/WwSubjectsTab";
import {
  pastConferencesTemplate,
  warCardsTemplate,
} from "../../../src/client/hud/ww1936/WwWarsTab";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import { ID } from "./EconomyFixture";
import { type EndOptions, fakeEndGame } from "./EndgameFixture";
import { polDetail, polSummary } from "./PoliticsFixture";

/** Italy as Germany's puppet (35% autonomy, rising). */
const PUPPET: EndOptions["endgame"] = {
  subjects: [
    {
      subject: ID("ITA"),
      overlord: ID("DEU"),
      level: "puppet",
      autBp: 3_500,
      deltaBp: 12,
      neutral: false,
    },
  ],
};

async function mountSubjects(o: EndOptions) {
  const { game } = fakeEndGame(o);
  const bus = new EventBus();
  const sent: WwOrder[] = [];
  bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
  const el = document.createElement("ww-subjects-tab") as WwSubjectsTab;
  el.game = game;
  el.eventBus = bus;
  document.body.appendChild(el);
  await el.updateComplete;
  return { el, sent };
}

const card = (id: string, state: number) => ({
  id,
  target: ID("ITA"),
  state,
  costPp: 50,
  cooldownUntil: -1,
  failing: [],
});

describe("<ww-subjects-tab> (P5 spec §20.5)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("an overlord's row: level, autonomy, share and the decisions with reasons", async () => {
    vi.useFakeTimers();
    const { el, sent } = await mountSubjects({
      me: "DEU",
      polSummaries: [polSummary("DEU")],
      polDetails: [
        polDetail("DEU", {
          decisions: [
            card("gen_tighten_control", 0),
            card("gen_annex_subject", 2),
          ],
        }),
      ],
      endgame: PUPPET,
    });
    const row = el.querySelector(`[data-ww-subject="${ID("ITA")}"]`)!;
    expect(row.textContent).toContain("level=[ww1936.subject_level.puppet]");
    expect(
      row
        .querySelector("[data-ww-subject-autonomy]")
        ?.getAttribute("data-ww-subject-autonomy"),
    ).toBe("35");
    expect(
      row
        .querySelector("[data-ww-subject-trend]")
        ?.getAttribute("data-ww-subject-trend"),
    ).toBe("up");
    const act = (id: string) =>
      row.querySelector<HTMLButtonElement>(`[data-ww-subject-act="${id}"]`)!;
    const why = (id: string) =>
      row.querySelector(`[data-ww-subject-why="${id}"]`)?.textContent?.trim();
    expect(act("tighten").disabled).toBe(false);
    expect(act("annex").disabled).toBe(true);
    expect(why("annex")).toBe("[ww1936.subject.why.no_pp]");
    expect(why("release")).toBe("[ww1936.pol.decision.locked]");
    // Two taps take the decision on Italy.
    act("tighten").click();
    await el.updateComplete;
    expect(sent).toEqual([]);
    vi.advanceTimersByTime(500);
    act("tighten").click();
    await el.updateComplete;
    expect(sent).toEqual([
      {
        kind: "decision_take",
        decision: "gen_tighten_control",
        target: ID("ITA"),
      },
    ]);
  });

  it("a subject's row: the overlord and the request greyed until 100%", async () => {
    const { el } = await mountSubjects({ me: "ITA", endgame: PUPPET });
    const row = el.querySelector(`[data-ww-overlord="${ID("DEU")}"]`)!;
    expect(row).not.toBeNull();
    expect(row.textContent).toContain("[ww1936.subject.overlord]");
    expect(
      row.querySelector<HTMLButtonElement>('[data-ww-subject-act="ask_more"]')!
        .disabled,
    ).toBe(true);
    expect(
      row
        .querySelector('[data-ww-subject-why="ask_more"]')
        ?.textContent?.trim(),
    ).toBe("[ww1936.subject.why.not_max]");
  });

  it("no subjects: one line", async () => {
    const { el } = await mountSubjects({ me: "FRA", endgame: PUPPET });
    expect(el.querySelector("[data-ww-subject-none]")).not.toBeNull();
  });
});

describe("the wars tab (P5 spec §20.5)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("war cards: mine first, both sides' flags, members' states and my share", () => {
    const { game } = fakeEndGame({
      me: "DEU",
      endgame: {
        wars: [
          {
            id: 0,
            kind: "normal",
            startDay: 100,
            ended: true,
            sides: [
              {
                leader: ID("DEU"),
                members: [{ id: ID("DEU"), state: "active", sharePm: 1000 }],
              },
              {
                leader: ID("FRA"),
                members: [
                  { id: ID("FRA"), state: "capitulated", sharePm: 1000 },
                ],
              },
            ],
          },
          {
            id: 1,
            kind: "normal",
            startDay: 900,
            ended: false,
            sides: [
              {
                leader: ID("DEU"),
                members: [
                  { id: ID("DEU"), state: "active", sharePm: 820 },
                  { id: ID("ITA"), state: "active", sharePm: 180 },
                ],
              },
              {
                leader: ID("POL"),
                members: [
                  { id: ID("POL"), state: "exiled", sharePm: 640 },
                  { id: ID("GBR"), state: "active", sharePm: 360 },
                ],
              },
            ],
          },
          {
            // Not mine and over: not listed.
            id: 2,
            kind: "civil",
            startDay: 50,
            ended: true,
            sides: [
              {
                leader: ID("SUN"),
                members: [{ id: ID("SUN"), state: "active", sharePm: 1000 }],
              },
              { leader: ID("GBR"), members: [] },
            ],
          },
        ],
      },
    });
    const box = document.createElement("div");
    render(warCardsTemplate(game, ID("DEU")), box);
    const cards = [...box.querySelectorAll<HTMLElement>("[data-ww-war]")];
    expect(cards.map((c) => [c.dataset.wwWar, c.dataset.status])).toEqual([
      ["1", "ongoing"],
      ["0", "ended"],
    ]);
    expect(cards[0].querySelectorAll("[data-ww-war-sides] img")).toHaveLength(
      2,
    );
    expect(
      cards[0]
        .querySelector(`[data-ww-war-member="${ID("POL")}"]`)
        ?.getAttribute("data-state"),
    ).toBe("exiled");
    expect(
      cards[0]
        .querySelector("[data-ww-war-share]")
        ?.getAttribute("data-ww-war-share"),
    ).toBe("82");
  });

  it("past conferences: the newest first, treaty lines with region names", () => {
    const { game } = fakeEndGame({
      me: "DEU",
      endgame: {
        peaceLog: [
          {
            day: 300,
            losers: [ID("POL")],
            lines: [
              {
                key: "ww1936.peace.line.take",
                params: { who: "DEU", whoTag: "DEU", n: 2, regions: "6,7" },
              },
            ],
          },
          { day: 500, losers: [ID("FRA")], lines: [] },
        ],
      },
    });
    const box = document.createElement("div");
    render(pastConferencesTemplate(game), box);
    const items = [
      ...box.querySelectorAll("[data-ww-past-conferences] > li"),
    ].map((li) => li.textContent?.replace(/\s+/g, " ").trim() ?? "");
    expect(items).toHaveLength(2);
    expect(items[0]).toContain("[ww1936.peace.past_line]");
    expect(items[0]).toContain("[ww1936.country.FRA]");
    expect(items[1]).toContain("[ww1936.peace.line.take]");
    expect(items[1]).toContain("who=[ww1936.country.DEU]");
    expect(items[1]).toMatch(/what=\S/);
  });
});
