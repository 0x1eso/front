import { GwPackSchema } from "@openfront/engine-api/ww1914/GwPack";
import type {
  GreatWarData,
  GwCardView,
} from "@openfront/engine-api/ww1914/GwView";
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

const data = (desk: GwCardView[]): GreatWarData => ({
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
      readyBlock: desk.length > 0 ? "open_cards" : null,
    },
  ],
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
    expect(panel.textContent).toContain("빈에서");
  });
  return { panel, orders };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("the placeholder panel", () => {
  test("shows the pack's text with the cast filled in", async () => {
    const { panel } = await mount(data([card()]));
    expect(panel.textContent).toContain("빈에서 온 사절");
    expect(panel.textContent).toContain("베트만홀베크는");
    expect(panel.textContent).toContain("시간표는 기다려 주지 않습니다");
  });

  test("a click sends the order; a closed option and ready stay shut", async () => {
    const { panel, orders } = await mount(data([card()]));
    const by = (sel: string) => panel.querySelector<HTMLButtonElement>(sel)!;
    by("[data-gw-option=back_vienna]").click();
    expect(orders).toEqual([
      { kind: "choose", card: 1, option: "back_vienna" },
    ]);
    expect(by("[data-gw-option=term_limit]").disabled).toBe(true);
    expect(panel.textContent).toContain("수상의 속내를 아직 듣지 못했다");
    expect(by("[data-gw-ready]").disabled).toBe(true);
  });

  test("a talk shows its line and replies, a topic summons", async () => {
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
      ],
    });
    const { panel, orders } = await mount(data([card(), talk]));
    expect(panel.textContent).toContain("잠시 시간을 주십시오");
    panel
      .querySelector<HTMLButtonElement>("[data-gw-option=ask_vienna]")!
      .click();
    panel.querySelector<HTMLButtonElement>("[data-gw-topic]")!.click();
    expect(orders).toEqual([
      { kind: "reply", card: 2, reply: "ask_vienna" },
      { kind: "summon", person: "deu_bethmann", topic: "deu_sample_talk" },
    ]);
  });

  test("holes and tells", () => {
    const d = data([card()]);
    const out = fillGw("{date}, {cos}", PACK, card(), d.seats[0], d.date);
    expect(out).toBe("1914-06-28, 몰트케");
    expect(tellText("army:+1")).toContain("+1");
  });
});
