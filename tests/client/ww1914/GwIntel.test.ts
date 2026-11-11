// ww179: the 정보부 tab gathers the service's knowledge from the seat's view.
import type { GwPropView } from "@openfront/engine-api/ww1914/GwAgents";
import type { GwOrder } from "@openfront/engine-api/ww1914/GwOrders";
import type { GwPack } from "@openfront/engine-api/ww1914/GwPack";
import type {
  GreatWarData,
  GwSeatView,
} from "@openfront/engine-api/ww1914/GwView";
import type {
  GwIntelView,
  GwReportView,
  GwWorldView,
} from "@openfront/engine-api/ww1914/GwWorldView";
import { render } from "lit";
import { describe, expect, test } from "vitest";
import type { GwCtx, GwUi } from "../../../src/client/hud/ww1914/GwCtx";
import { intelTab } from "../../../src/client/hud/ww1914/GwIntel";
import { GW_TABS, tabBadge } from "../../../src/client/hud/ww1914/GwModel";
import { nowLines } from "../../../src/client/hud/ww1914/GwNow";

const PACK = {
  version: 1,
  people: { deu_nicolai: { name: "발터 니콜라이", lean: "" } },
  scenes: {},
  acts: { gw_a_spy_net: { name: "요원망을 심는다" } },
} as unknown as GwPack;

const report = (o: Partial<GwReportView>): GwReportView => ({
  uid: 1,
  fact: "strain",
  tag: "RUS",
  theatre: "east",
  source: "agents",
  stamp: "unconfirmed",
  claim: 2,
  chapter: 5,
  checked: false,
  corrected: null,
  about: null,
  ...o,
});

const service = (o: Partial<GwIntelView> = {}): GwIntelView => ({
  levels: { read: 2, guard: 1, hunt: 3 },
  rivals: [],
  reads: [],
  nets: [],
  caught: [],
  turned: [],
  ops: [],
  ...o,
});

function ctx(world: Partial<GwWorldView>, seat: Partial<GwSeatView> = {}) {
  const sent: GwOrder[] = [];
  const root = document.createElement("div");
  const c = {
    data: { chapter: 6 } as unknown as GreatWarData,
    seat: {
      tag: "DEU",
      people: [],
      acts: [],
      actsLeft: 1,
      audiences: 1,
      ...seat,
      world: {
        side: "central",
        fronts: [],
        reports: [],
        sources: [],
        countries: [
          { tag: "DEU", side: "central", out: false, mob: 2 },
          { tag: "RUS", side: "entente", out: false, mob: 2 },
          { tag: "FRA", side: "entente", out: false, mob: 2 },
        ],
        news: [],
        candidates: {},
        people: [],
        ...world,
      },
    } as unknown as GwSeatView,
    pack: PACK,
    ui: {
      tab: "intel",
      actOpen: null,
      actPicks: {},
      notes: [],
    } as unknown as GwUi,
    tick: 0,
    send: (o: GwOrder) => sent.push(o),
    redraw: () => render(intelTab(c), root),
    card: () => undefined,
  } as GwCtx;
  c.redraw();
  return { c, sent, root };
}

const q = (root: HTMLElement, sel: string) =>
  root.querySelector(sel) as HTMLButtonElement | null;

describe("the 정보부 tab", () => {
  test("it sits next to the fronts tab and badges agents waiting for a word", () => {
    expect(GW_TABS.indexOf("intel")).toBe(GW_TABS.indexOf("fronts") + 1);
    const { c } = ctx({
      service: service({ caught: [{ tag: "RUS", chapter: 6 }] }),
    });
    expect(tabBadge(c.seat, "intel")).toBe(1);
  });

  test("every section says what it is, and empty ones say what to do", () => {
    const { root } = ctx({ service: service() });
    // ww180: the service's money, named agents and propaganda have sections too.
    expect(root.querySelectorAll("[data-gw-intel-why]").length).toBe(8);
    // A chief not met yet is not a vacancy; a vacant one points to people.
    expect(q(root, "[data-gw-intel-to-people]")).toBeNull();
    const vacant = ctx({
      service: service(),
      candidates: { intelligence: ["deu_nicolai"] },
    });
    expect(q(vacant.root, "[data-gw-intel-to-people]")).not.toBeNull();
    // Rivals by camp, nothing known yet: the empty line, not a bare blank.
    expect(q(root, "[data-gw-intel-blank]")!.dataset.gwIntelBlank).toBe(
      "RUS FRA",
    );
    expect(
      root.querySelectorAll("[data-gw-intel-empty]").length,
    ).toBeGreaterThan(3);
    expect(root.querySelectorAll("[data-gw-intel-skill]").length).toBe(4);
  });

  test("ww180: each branch's share is picked in words and says where it heads", () => {
    const { root, sent } = ctx({
      service: service({
        fund: {
          branches: [
            { level: 1, share: 2, trend: 1 },
            { level: 1, share: 1, trend: 0 },
            { level: 1, share: 0, trend: -1 },
            { level: 2, share: 1, trend: 0 },
          ],
          nets: 3,
          broke: true,
          air: false,
        },
      }),
    });
    const trend = (b: string) =>
      q(root, `[data-gw-intel-branch="${b}"] [data-gw-intel-trend]`)!;
    expect(trend("crypt").textContent).toContain("gw.intel.fund.trend.up");
    expect(trend("secure").textContent).toContain("gw.intel.fund.trend.down");
    expect(q(root, '[data-gw-pick="service:crypt:2"]')!.ariaPressed).toBe(
      "true",
    );
    q(root, '[data-gw-pick="service:abroad:3"]')!.click();
    expect(sent).toEqual([{ kind: "service", branch: "abroad", share: 3 }]);
    expect(q(root, "[data-gw-intel-broke]")).not.toBeNull();
    expect(q(root, '[data-gw-intel-air="no"]')).not.toBeNull();
    expect(q(root, '[data-gw-intel-skill="abroad"]')!.textContent).toContain(
      "gw.intel.skill.abroad.2",
    );
  });

  test("ww180: propaganda and censorship show in 지금 상황 only while they run", () => {
    const prop: GwPropView = {
      home: false,
      hush: false,
      leaflets: [],
      papers: [],
      ops: [],
    };
    const keys = (p: Partial<GwPropView>) => {
      const { c } = ctx(
        { side: null, countries: [], prop: { ...prop, ...p } },
        { desk: [] },
      );
      return nowLines({ ...c.data, ended: null } as GreatWarData, c.seat);
    };
    expect(keys({}).map((l) => l.key)).not.toContain("gw.ui.now.prop");
    const line = keys({ hush: true, leaflets: ["RUS"] }).find(
      (l) => l.key === "gw.ui.now.prop",
    );
    expect(line?.params.what).toBe(
      "gw.ui.now.prop_hush, gw.ui.now.prop_leaflets",
    );
  });

  test("reports go under their front or country with who, how sure and how old", () => {
    const { root } = ctx({
      fronts: [
        {
          id: "east",
          foe: { tag: "RUS", word: 2, stamp: "unconfirmed" },
          reading: true,
        },
      ] as unknown as GwWorldView["fronts"],
      reports: [
        report({ uid: 1, claim: 1, chapter: 2 }),
        report({ uid: 2, claim: 3, chapter: 6 }),
        report({ uid: 3, fact: "morale", theatre: null, claim: 3, chapter: 5 }),
        // The house's own papers belong elsewhere.
        report({ uid: 4, fact: "plot", tag: "DEU", theatre: null, about: "x" }),
      ],
      service: service({ reads: [{ tag: "RUS", named: ["east"] }] }),
    });
    const east = q(root, "[data-gw-intel-front=east]")!;
    // Only the newest strain report on the front.
    expect(east.querySelector("[data-gw-intel-report='2']")).not.toBeNull();
    expect(east.querySelector("[data-gw-intel-report='1']")).toBeNull();
    const rus = q(root, "[data-gw-intel-country=RUS]")!;
    expect(rus.querySelector("[data-gw-intel-report='3']")).not.toBeNull();
    expect(q(root, "[data-gw-intel-report='4']")).toBeNull();
    expect(q(root, "[data-gw-intel-read=RUS]")).not.toBeNull();
    expect(q(root, "[data-gw-intel-unread]")).not.toBeNull();
  });

  test("the 뒷공작 rows order from here; a result waits for its card", () => {
    const { root, sent } = ctx(
      {
        service: service({
          nets: [{ tag: "RUS", size: 2 }],
          ops: [
            { act: "net", tag: "FRA", ok: null, out: null, chapter: 6 },
            { act: "sabotage", tag: "RUS", ok: true, out: false, chapter: 5 },
          ],
        }),
      },
      {
        people: [
          {
            id: "deu_nicolai",
            office: "intelligence",
            trust: 1,
            topics: [],
            fit: [],
            rivals: [],
          },
        ],
        acts: [
          {
            id: "gw_a_spy_net",
            kind: "intrigue",
            fields: [
              {
                id: "where",
                count: 1,
                options: ["main_foe"],
                tones: [],
                people: [],
              },
            ],
            tell: [],
          },
          { id: "t_visit", kind: "visit", fields: [], tell: [] },
        ] as unknown as GwSeatView["acts"],
      },
    );
    expect(q(root, "[data-gw-person=deu_nicolai]")).not.toBeNull();
    expect(q(root, "[data-gw-intel-to-people]")).toBeNull();
    expect(q(root, "[data-gw-intel-net=RUS]")).not.toBeNull();
    expect(q(root, "[data-gw-act=t_visit]")).toBeNull();
    expect(root.querySelectorAll("[data-gw-intel-op]").length).toBe(2);
    q(root, "[data-gw-act-open=gw_a_spy_net]")!.click();
    q(root, "[data-gw-act-pick=main_foe]")!.click();
    q(root, "[data-gw-act-go]")!.click();
    expect(sent).toEqual([
      { kind: "act", act: "gw_a_spy_net", picks: ["main_foe"] },
    ]);
  });

  test("in peace: the camp's rivals, a war plan read, a mobilisation round-up", () => {
    const { root } = ctx({
      side: null,
      reports: [
        report({ uid: 9, fact: "plan", tag: "FRA", theatre: null, claim: 0 }),
      ],
      news: [
        { key: "spy_rolled_up", chapter: 6, a: "RUS", b: null, theatre: null },
      ] as unknown as GwWorldView["news"],
      service: service({ rivals: ["FRA", "RUS"] }),
    });
    const fra = q(root, "[data-gw-intel-country=FRA]")!;
    expect(fra.querySelector("[data-gw-intel-report='9']")).not.toBeNull();
    expect(q(root, "[data-gw-intel-blank]")!.dataset.gwIntelBlank).toBe("RUS");
    expect(q(root, "[data-gw-intel-exposed]")).not.toBeNull();
  });
});
