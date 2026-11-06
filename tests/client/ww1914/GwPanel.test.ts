import { GwPackSchema } from "@openfront/engine-api/ww1914/GwPack";
import type {
  GreatWarData,
  GwCardView,
} from "@openfront/engine-api/ww1914/GwView";
import type { GwWorldView } from "@openfront/engine-api/ww1914/GwWorldView";
import { EventBus } from "@openfront/shared/EventBus";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { GwPanel } from "../../../src/client/hud/ww1914/GwPanel";
import { fillGw, tellText } from "../../../src/client/hud/ww1914/GwText";
import { SendGwOrderIntentEvent } from "../../../src/client/Transport";

const PACK = GwPackSchema.parse(
  JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../../../resources/ww1914/ko/DEU.json"),
      "utf8",
    ),
  ),
);

const card = (over: Partial<GwCardView> = {}): GwCardView => ({
  uid: 1,
  scene: "deu_sample_envoy",
  kind: "proposal",
  variant: "base",
  cast: { chancellor: "deu_bethmann", cos: "deu_moltke" },
  stamp: null,
  options: [
    { id: "back_vienna", open: true, tell: ["army:+1"] },
    { id: "term_limit", open: false, tell: [] },
  ],
  who: null,
  node: null,
  says: null,
  replies: [],
  ...over,
});

const world = (over: Partial<GwWorldView> = {}): GwWorldView => ({
  gauges: [],
  authority: 40,
  manpower: 90,
  casualties: 0,
  unrest: 0,
  side: null,
  plan: null,
  signed: false,
  proposals: [],
  fronts: [],
  chain: null,
  chainEnds: [],
  reports: [],
  sources: [],
  mandates: [],
  secrets: [],
  threads: [],
  people: [
    {
      id: "deu_bethmann",
      wins: 0,
      losses: 0,
      repute: 0,
      letter: false,
      ailing: false,
      dismissPrice: 31,
    },
  ],
  candidates: {},
  countries: [],
  news: [],
  memoir: null,
  ...over,
});

const data = (
  desk: GwCardView[],
  w: Partial<GwWorldView> = {},
): GreatWarData => ({
  calendar: "y1914",
  chapter: 0,
  chapterCount: 12,
  stage: "crisis",
  date: "1914-06-28",
  deadlineTick: null,
  ended: null,
  opening: "sarajevo",
  temp: 3,
  seats: [
    {
      smallID: 1,
      tag: "DEU",
      ready: false,
      audiences: 3,
      desk,
      people: [
        {
          id: "deu_bethmann",
          office: "chancellor",
          trust: 0,
          topics: ["deu_sample_talk"],
          fit: [],
          rivals: ["deu_moltke"],
        },
      ],
      gauges: { shells: 2, bread: 2, money: 2, morale: 3, order: 3 },
      inst: { army: 0 },
      theatres: [],
      alloc: {
        main: "west",
        posture: "hold",
        scale: "limited",
        allyShare: 0,
        research: "artillery",
      },
      log: [],
      world: world(w),
      readyBlock: desk.length > 0 ? "open_cards" : null,
      diplo: { telegrams: [], treaties: [], wiresLeft: 4 },
    },
  ],
  roster: [
    {
      smallID: 1,
      tag: "DEU",
      ready: false,
      regent: false,
      away: false,
      host: true,
    },
  ],
  slow: { asked: [], granted: 0, max: 3 },
  finale: null,
});

async function mount(d: GreatWarData) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        url.includes("common") ? { version: 1, scenes: {}, people: {} } : PACK,
    })),
  );
  const panel = new GwPanel();
  const bus = new EventBus();
  const orders: unknown[] = [];
  bus.on(SendGwOrderIntentEvent, (e) => orders.push(e.order));
  panel.eventBus = bus;
  panel.game = {
    greatWarData: () => d,
    myPlayer: () => ({ smallID: () => 1 }),
  } as unknown as GwPanel["game"];
  document.body.appendChild(panel);
  panel.tick();
  await vi.waitFor(() => {
    expect((panel as unknown as { pack: unknown }).pack).not.toBeNull();
  });
  await panel.updateComplete;
  return { panel, orders };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("the screens", () => {
  test("a paper shows on the desk and reads in full in the reader", async () => {
    const { panel } = await mount(data([card()]));
    expect(panel.textContent).toContain("빈에서 온 사절");
    expect(panel.querySelector("[data-gw-reader]")).toBeNull();
    panel.querySelector<HTMLButtonElement>("[data-gw-open='1']")!.click();
    await panel.updateComplete;
    const reader = panel.querySelector("[data-gw-reader]")!;
    expect(reader.textContent).toContain("베트만홀베크는");
    expect(reader.textContent).toContain("시간표는 기다려 주지 않습니다");
  });

  test("an option is armed, then signed; a closed one stays shut and says why", async () => {
    const { panel, orders } = await mount(data([card()]));
    const by = (sel: string) => panel.querySelector<HTMLButtonElement>(sel)!;
    by("[data-gw-open='1']").click();
    await panel.updateComplete;
    expect(by("[data-gw-option=term_limit]").disabled).toBe(true);
    expect(panel.textContent).toContain("수상의 속내를 아직 듣지 못했다");
    by("[data-gw-option=back_vienna]").click();
    await panel.updateComplete;
    expect(orders).toEqual([]);
    by("[data-gw-sign]").click();
    expect(orders).toEqual([
      { kind: "choose", card: 1, option: "back_vienna" },
    ]);
    expect(by("[data-gw-ready]").disabled).toBe(true);
    expect(panel.querySelector("[data-gw-block]")).not.toBeNull();
  });

  test("a talk opens as a table, keeps what was said, and a reply is one order", async () => {
    const talk = card({
      uid: 2,
      scene: "deu_sample_talk",
      kind: "talk",
      variant: "base",
      options: [],
      who: "deu_bethmann",
      node: "open",
      says: "base",
      replies: [
        {
          id: "ask_vienna",
          open: true,
          tell: [],
          stance: "frank",
          kind: "ask",
        },
        { id: "leave", open: true, tell: [], stance: "cold", kind: "leave" },
      ],
    });
    const { panel, orders } = await mount(data([talk]));
    panel.querySelector<HTMLButtonElement>("[data-gw-open='2']")!.click();
    await panel.updateComplete;
    const view = panel.querySelector("[data-gw-talk]")!;
    expect(view.textContent).toContain("잠시 시간을 주십시오");
    expect(view.textContent).toContain("베트만홀베크");
    expect(view.querySelectorAll("[data-gw-reply]").length).toBe(2);
    view
      .querySelector<HTMLButtonElement>("[data-gw-reply=ask_vienna]")!
      .click();
    await panel.updateComplete;
    expect(orders).toEqual([{ kind: "reply", card: 2, reply: "ask_vienna" }]);
    // The answer is shown as said, and the replies wait for their next line.
    expect(panel.textContent).toContain("빈이 정말 바라는 것이 무엇이오?");
    expect(panel.querySelector("[data-gw-replies]")).toBeNull();
  });

  test("a person opens on the people tab and a topic summons", async () => {
    const { panel, orders } = await mount(data([]));
    panel.querySelector<HTMLButtonElement>("[data-gw-tab=people]")!.click();
    await panel.updateComplete;
    panel.querySelector<HTMLButtonElement>("[data-gw-person] button")!.click();
    await panel.updateComplete;
    panel.querySelector<HTMLButtonElement>("[data-gw-topic]")!.click();
    expect(orders).toEqual([
      { kind: "summon", person: "deu_bethmann", topic: "deu_sample_talk" },
    ]);
  });

  test("a dismissal needs a second tap", async () => {
    const { panel, orders } = await mount(data([]));
    panel.querySelector<HTMLButtonElement>("[data-gw-tab=people]")!.click();
    await panel.updateComplete;
    panel.querySelector<HTMLButtonElement>("[data-gw-person] button")!.click();
    await panel.updateComplete;
    const dismiss = () =>
      panel.querySelector<HTMLButtonElement>("[data-gw-dismiss]")!;
    dismiss().click();
    await panel.updateComplete;
    expect(orders).toEqual([]);
    dismiss().click();
    expect(orders).toEqual([{ kind: "dismiss", person: "deu_bethmann" }]);
  });

  test("a dismissal shows its price and is shut short of authority", async () => {
    const { panel } = await mount(data([], { authority: 30 }));
    panel.querySelector<HTMLButtonElement>("[data-gw-tab=people]")!.click();
    await panel.updateComplete;
    panel.querySelector<HTMLButtonElement>("[data-gw-person] button")!.click();
    await panel.updateComplete;
    const dismiss =
      panel.querySelector<HTMLButtonElement>("[data-gw-dismiss]")!;
    expect(dismiss.disabled).toBe(true);
    expect(panel.querySelector("[data-gw-dismiss-why]")).not.toBeNull();
  });

  test("the fronts tab signs a paper as it came, with the research picked", async () => {
    const proposals: GwWorldView["proposals"] = [
      {
        id: "cos_plan",
        by: "deu_moltke",
        main: "west",
        posture: "offensive",
        scale: "major",
        allyShare: 0,
        open: true,
        why: null,
        estimate: 3,
        tell: ["shells:-1"],
      },
      {
        id: "hold_all",
        by: "deu_moltke",
        main: "west",
        posture: "hold",
        scale: "limited",
        allyShare: 0,
        open: false,
        why: "army",
        estimate: 3,
        tell: [],
      },
    ];
    const { panel, orders } = await mount(data([], { proposals }));
    panel.querySelector<HTMLButtonElement>("[data-gw-tab=fronts]")!.click();
    await panel.updateComplete;
    expect(panel.querySelector("[data-gw-paper-why]")).not.toBeNull();
    expect(panel.querySelector("[data-gw-sign-paper=hold_all]")).toBeNull();
    panel
      .querySelector<HTMLButtonElement>("[data-gw-pick='research:sea']")!
      .click();
    await panel.updateComplete;
    panel
      .querySelector<HTMLButtonElement>("[data-gw-sign-paper=cos_plan]")!
      .click();
    expect(orders).toEqual([
      {
        kind: "allocate",
        main: "west",
        posture: "offensive",
        scale: "major",
        allyShare: 0,
        research: "sea",
      },
    ]);
  });

  test("the band holds the date and five gauges in words", async () => {
    const { panel } = await mount(data([card()]));
    expect(panel.querySelector("[data-gw-date]")!.textContent).toBe(
      "1914-06-28",
    );
    expect(panel.querySelectorAll("[data-gw-gauges] > span").length).toBe(5);
  });

  test("holes and tells", () => {
    const d = data([card()]);
    const out = fillGw("{date}, {cos}", PACK, card(), d.seats[0], d.date);
    expect(out).toBe("1914-06-28, 몰트케");
    expect(tellText("army:+1")).toContain("+1");
  });
});
