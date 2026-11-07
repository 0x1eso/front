import type { GwBudgetView } from "@openfront/engine-api/ww1914/GwBudget";
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

/** The format's two examples, here so the screens don't move with the writers. */
const SCENES = {
  deu_sample_envoy: {
    title: "빈에서 온 사절",
    back: { dug: "{chancellor}이(가) 원안을 다시 올렸다." },
    brief: { base: "빈이 세르비아를 치겠다며 독일의 지지를 묻고 있습니다." },
    text: {
      base: "빈에서 사절이 왔다. 세르비아를 벌하겠으니 베를린이 뒤를 받쳐 주겠느냐고 묻는다. {chancellor}은(는) 서류를 내려놓고 폐하의 답을 기다린다.",
      heard_chancellor:
        "사절은 아직 응접실에 있다. {chancellor}이(가) 어제 한 말이 귓가에 남아 있다. 빈은 답을 재촉하고, 답에는 날짜를 적을 수도 있다.",
    },
    opt: {
      back_vienna: "빈을 지지한다. {cos}이(가) 표를 편다.",
      term_limit: "지지하되 기한을 단다.",
      wait: "답을 미룬다.",
    },
    why: {
      term_limit: "수상의 속내를 아직 듣지 못했다.",
    },
    voice: {
      cos: {
        deu_moltke: "폐하, 시간표는 기다려 주지 않습니다.",
      },
    },
  },
  deu_sample_talk: {
    title: "수상의 방문",
    brief: "{chancellor.title}이(가) 폐하께 직접 할 말이 있어 왔습니다.",
    text: {
      base: "{chancellor}이(가) 문가에 서 있다. 불러서 온 얼굴은 아니다.",
    },
    topic: "빈의 속내",
    nodes: {
      open: {
        says: {
          base: "폐하, 잠시 시간을 주십시오. 빈 일로 드릴 말씀이 있습니다.",
          worn: "폐하, 어젯밤에도 잠을 이루지 못했습니다. 빈 일입니다.",
        },
        replies: {
          ask_vienna: "빈이 정말 바라는 것이 무엇이오?",
          press: "결론만 말하시오. 지금 당장.",
          leave: "나중에 듣겠소.",
        },
      },
      vienna: {
        says: {
          base: "빈은 전쟁을 바라면서 그 값은 우리에게 묻습니다. 답에 기한을 달아 두십시오.",
        },
        replies: {
          thank: "알겠소. 고맙소.",
        },
      },
    },
  },
};

const packFile = (f: string) =>
  JSON.parse(
    fs.readFileSync(
      path.join(__dirname, `../../../resources/ww1914/ko/${f}`),
      "utf8",
    ),
  );
const PACK = GwPackSchema.parse({
  ...packFile("DEU.json"),
  people: packFile("DEU.cast.json").people,
  scenes: SCENES,
  acts: {
    t_krupp: { name: "크루프 공장", note: "포탄 공장을 직접 본다." },
    t_nicky: {
      name: "니콜라이에게 쓴다",
      fields: {
        subject: { label: "무엇을", opt: { serbia: "세르비아", mob: "동원" } },
      },
    },
    t_council: {
      name: "회의를 소집한다",
      fields: { attend: { label: "누구를" } },
    },
  },
  aims: {
    t_aim_a: {
      name: "빈을 지킨다",
      text: "우리는 빈을 지키려 싸우오.",
      met: "빈이 섰다.",
      unmet: "빈이 무너졌다.",
    },
    t_aim_b: {
      name: "전쟁은 없다",
      text: "전쟁을 막겠소.",
      met: "전쟁이 없었다.",
      unmet: "전쟁이 왔다.",
    },
  },
});

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

const budget = (over: Partial<GwBudgetView> = {}): GwBudgetView => ({
  basis: {
    tag: "DEU",
    war: true,
    warYears: 0,
    treasury: 3000,
    debt: 5000,
    prices: 1000,
    rate: 100,
    morale: 3,
    news: 0,
    loanCap: 3,
    rally: false,
  },
  plan: { shares: [40, 13, 12, 22, 13], mix: [100, 0, 0, 0] },
  draft: null,
  norm: [72, 8, 8, 6, 6],
  meeting: false,
  refused: false,
  last: "none",
  next: "1915-01-01",
  notes: [],
  lenders: [],
  body: {
    kind: "vote",
    inst: "reichstag",
    need: -3,
    second: null,
    secondNeed: 0,
    value: 0,
    secondValue: 0,
    forcePrice: 30,
  },
  authority: 40,
  holder: "deu_kuhn",
  ...over,
});

const world = (over: Partial<GwWorldView> = {}): GwWorldView => ({
  budget: budget(),
  laws: [],
  press: null,
  war: {
    era: "movement",
    regime: "empire",
    command: false,
    blockade: 0,
    shipping: 0,
    uboat: 0,
    america: 0,
    techs: [],
    armistice: null,
    votes: [],
  },
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
    const note = reader.querySelector("[data-gw-brief]")!;
    expect(note.textContent).toContain("gw.ui.brief_label");
    expect(note.textContent).toContain("독일의 지지를 묻고 있습니다");
    expect(reader.textContent).toContain("시간표는 기다려 주지 않습니다");
  });

  test("an option is armed, then signed; a closed one stays shut and says why", async () => {
    const { panel, orders } = await mount(data([card()]));
    const by = (sel: string) => panel.querySelector<HTMLButtonElement>(sel)!;
    by("[data-gw-open='1']").click();
    await panel.updateComplete;
    expect(by("[data-gw-option=term_limit]").disabled).toBe(true);
    // Before the signature the option names only what it does, never its result.
    const label = by("[data-gw-option=back_vienna]").textContent!;
    expect(label).toContain("빈을 지지한다");
    expect(label).not.toContain("몰트케가 표를 편다");
    expect(label).not.toContain("army");
    expect(panel.textContent).toContain("수상의 속내를 아직 듣지 못했다");
    by("[data-gw-option=back_vienna]").click();
    await panel.updateComplete;
    expect(orders).toEqual([]);
    by("[data-gw-sign]").click();
    expect(orders).toEqual([
      { kind: "choose", card: 1, option: "back_vienna" },
    ]);
    await panel.updateComplete;
    // Once signed, the rest of the text and the price show on the desk.
    const note = panel.querySelector("[data-gw-results]")!.textContent!;
    expect(note).toContain("몰트케가 표를 편다");
    expect(note).toContain("+1");
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
    expect(view.querySelector("[data-gw-brief]")!.textContent).toContain(
      "폐하께 직접 할 말이",
    );
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

  test("a private meeting opens from its own entry, only if there is one", async () => {
    const d = data([]);
    const shut = await mount(d);
    shut.panel
      .querySelector<HTMLButtonElement>("[data-gw-tab=people]")!
      .click();
    await shut.panel.updateComplete;
    expect(shut.panel.querySelector("[data-gw-private]")).toBeNull();
    const open = data([]);
    const me = open.seats[0];
    const seat = {
      ...me,
      privates: 1,
      people: [{ ...me.people[0], privateTopics: ["deu_sample_talk"] }],
    };
    const { panel, orders } = await mount({ ...open, seats: [seat] });
    panel.querySelector<HTMLButtonElement>("[data-gw-tab=people]")!.click();
    await panel.updateComplete;
    panel.querySelector<HTMLButtonElement>("[data-gw-private-toggle]")!.click();
    await panel.updateComplete;
    panel.querySelector<HTMLButtonElement>("[data-gw-private-topic]")!.click();
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
    panel.querySelector<HTMLButtonElement>("[data-gw-tab=country]")!.click();
    await panel.updateComplete;
    expect(panel.querySelector("[data-gw-war]")).not.toBeNull();
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
      "1914년 6월 28일",
    );
    expect(panel.querySelectorAll("[data-gw-gauges] > span").length).toBe(5);
  });

  test("holes and tells", () => {
    const d = data([card()]);
    const out = fillGw("{date}, {cos}", PACK, card(), d.seats[0], d.date);
    expect(out).toBe("6월 28일, 몰트케");
    expect(tellText("army:+1")).toContain("+1");
  });

  const seatWith = (over: Partial<GreatWarData["seats"][0]>) => {
    const d = data([]);
    return { ...d, seats: [{ ...d.seats[0], ...over }] };
  };
  const SCHEDULE = {
    actsLeft: 2,
    acts: [
      { id: "t_krupp", kind: "visit" as const, fields: [], tell: [] },
      {
        id: "t_nicky",
        kind: "letter" as const,
        tell: ["ally:+1"],
        fields: [
          {
            id: "subject",
            options: ["serbia", "mob"],
            tones: [],
            people: [],
            count: 1,
          },
          {
            id: "tone",
            options: [],
            tones: ["warm", "threat"] as const,
            people: [],
            count: 1,
          },
        ],
      },
      {
        id: "t_council",
        kind: "order" as const,
        tell: [],
        fields: [
          {
            id: "attend",
            options: [],
            tones: [],
            people: ["deu_bethmann", "deu_moltke", "deu_jagow"],
            count: 2,
          },
        ],
      },
    ],
  };
  const tab = async (panel: GwPanel, name: string) => {
    panel.querySelector<HTMLButtonElement>(`[data-gw-tab=${name}]`)!.click();
    await panel.updateComplete;
  };
  const tap = async (panel: GwPanel, sel: string) => {
    panel.querySelector<HTMLButtonElement>(sel)!.click();
    await panel.updateComplete;
  };

  test("the schedule sits beside the people tab and lists by kind", async () => {
    const { panel } = await mount(seatWith(SCHEDULE));
    const tabs = [...panel.querySelectorAll("[data-gw-tab]")].map((x) =>
      x.getAttribute("data-gw-tab"),
    );
    expect(tabs.indexOf("schedule")).toBe(tabs.indexOf("people") + 1);
    expect(
      panel.querySelector("[data-gw-tab=schedule]")!.textContent,
    ).toContain("2");
    await tab(panel, "schedule");
    expect(
      panel.querySelector("[data-gw-act-kind=visit]")!.textContent,
    ).toContain("크루프 공장");
    expect(panel.querySelector("[data-gw-act-kind=letter]")).not.toBeNull();
    expect(panel.querySelector("[data-gw-act-kind=speech]")).toBeNull();
  });

  test("a letter waits for every field, then goes as one order", async () => {
    const { panel, orders } = await mount(seatWith(SCHEDULE));
    await tab(panel, "schedule");
    await tap(panel, "[data-gw-act-open=t_nicky]");
    const go = () =>
      panel.querySelector<HTMLButtonElement>("[data-gw-act-go]")!;
    expect(go().disabled).toBe(true);
    await tap(panel, "[data-gw-act-pick=mob]");
    expect(go().disabled).toBe(true);
    await tap(panel, "[data-gw-act-pick=warm]");
    expect(go().disabled).toBe(false);
    await tap(panel, "[data-gw-act-go]");
    expect(orders).toEqual([
      { kind: "act", act: "t_nicky", picks: ["mob", "warm"] },
    ]);
  });

  test("a people field takes exactly its count", async () => {
    const { panel, orders } = await mount(seatWith(SCHEDULE));
    await tab(panel, "schedule");
    await tap(panel, "[data-gw-act-open=t_council]");
    await tap(panel, "[data-gw-act-pick=deu_bethmann]");
    await tap(panel, "[data-gw-act-pick=deu_moltke]");
    await tap(panel, "[data-gw-act-pick=deu_jagow]");
    await tap(panel, "[data-gw-act-go]");
    expect(orders).toEqual([
      {
        kind: "act",
        act: "t_council",
        picks: ["deu_bethmann", "deu_moltke"],
      },
    ]);
  });

  test("no slot left: the entries stay in view and can't be opened", async () => {
    const { panel } = await mount(seatWith({ ...SCHEDULE, actsLeft: 0 }));
    await tab(panel, "schedule");
    const b = panel.querySelector<HTMLButtonElement>(
      "[data-gw-act-open=t_krupp]",
    )!;
    expect(b.disabled).toBe(true);
  });

  test("the aim: asked on the desk, declared on the schedule", async () => {
    const aims = {
      aim: null,
      open: ["t_aim_a", "t_aim_b"],
      priced: false,
      dropped: [],
    };
    const { panel, orders } = await mount(seatWith({ aims }));
    await tap(panel, "[data-gw-aim-nudge]");
    expect(panel.querySelector("[data-gw-aim-priced]")).toBeNull();
    await tap(panel, "[data-gw-aim-pick=t_aim_a]");
    expect(panel.querySelector("[data-gw-aims]")!.textContent).toContain(
      "우리는 빈을 지키려",
    );
    await tap(panel, "[data-gw-aim-go]");
    expect(orders).toEqual([{ kind: "aim", aim: "t_aim_a" }]);
  });

  test("a declared aim shows, and changing it warns of a price", async () => {
    const aims = {
      aim: "t_aim_a",
      open: ["t_aim_a", "t_aim_b"],
      priced: true,
      dropped: [],
    };
    const { panel } = await mount(seatWith({ aims }));
    expect(panel.querySelector("[data-gw-aim-nudge]")).toBeNull();
    await tab(panel, "schedule");
    expect(panel.querySelector("[data-gw-aim-now]")!.textContent).toContain(
      "빈을 지킨다",
    );
    expect(panel.querySelector("[data-gw-aim-pick]")).toBeNull();
    await tap(panel, "[data-gw-aim-change]");
    expect(panel.querySelector("[data-gw-aim-priced]")).not.toBeNull();
    expect(panel.querySelector("[data-gw-aim-pick=t_aim_a]")).toBeNull();
    expect(panel.querySelector("[data-gw-aim-pick=t_aim_b]")).not.toBeNull();
  });

  test("terms: a country, clauses, one order; the answer shows after", async () => {
    const terms = {
      sent: false,
      targets: [
        {
          tag: "ITA" as const,
          give: ["price", "credit"] as const,
          ask: ["stay_out"] as const,
        },
      ],
      log: [
        {
          tag: "GBR" as const,
          give: [],
          ask: ["stay_out"] as const,
          yes: false,
          why: "no_trust" as const,
        },
      ],
    };
    const { panel, orders } = await mount(seatWith({ terms }));
    await tab(panel, "schedule");
    expect(panel.querySelector("[data-gw-term-log=GBR]")).not.toBeNull();
    await tap(panel, "[data-gw-term-tag=ITA]");
    const go = () =>
      panel.querySelector<HTMLButtonElement>("[data-gw-term-go]")!;
    expect(go().disabled).toBe(true);
    await tap(panel, "[data-gw-clause='give.price']");
    await tap(panel, "[data-gw-clause='ask.stay_out']");
    await tap(panel, "[data-gw-term-go]");
    expect(orders).toEqual([
      { kind: "terms", tag: "ITA", give: ["price"], ask: ["stay_out"] },
    ]);
  });

  test("a paper goes back with a direction, beside the signature", async () => {
    const paper = card({
      backTo: ["cheaper", "firmer"],
      backWho: "deu_bethmann",
    });
    const { panel, orders } = await mount(data([paper]));
    await tap(panel, "[data-gw-open='1']");
    await tap(panel, "[data-gw-back-open]");
    expect(panel.querySelectorAll("[data-gw-back-dir]").length).toBe(2);
    expect(panel.querySelector("[data-gw-back-go]")).toBeNull();
    await tap(panel, "[data-gw-back-dir=cheaper]");
    await tap(panel, "[data-gw-back-go]");
    expect(orders).toEqual([
      { kind: "send_back", card: 1, direction: "cheaper" },
    ]);
  });

  test("a paper that can't go back has no such button", async () => {
    const { panel } = await mount(data([card()]));
    await tap(panel, "[data-gw-open='1']");
    expect(panel.querySelector("[data-gw-back]")).toBeNull();
  });

  test("a paper come again says what its author did", async () => {
    const d = data([
      card({
        back: { direction: "cheaper", changed: false },
        backWho: "deu_bethmann",
      }),
    ]);
    const { panel } = await mount(d);
    const line = panel.querySelector("[data-gw-back-line]")!;
    expect(line.textContent).toContain("베트만홀베크이(가)".slice(0, 6));
    expect(line.textContent).toContain("원안을 다시");
  });
});
