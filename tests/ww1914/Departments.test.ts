import {
  GW_FIELDS,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwAct } from "@openfront/engine-api/ww1914/GwActs";
import type { GwDeptContent } from "@openfront/engine-api/ww1914/GwDepts";
import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import {
  GW_CONTENT,
  useGwContent,
} from "@openfront/engine-lib/ww1914/content/Content";
import {
  GW_TRAY_WAIT,
  productFitsTopic,
  taskChapters,
} from "@openfront/engine-lib/ww1914/TaskRows";
import {
  deptHead,
  deptState,
  openDepts,
  roomShut,
} from "@openfront/engine/ww1914/Departments";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { lawOfDraft, lawStage } from "@openfront/engine/ww1914/Laws";
import { applyGwOrder } from "@openfront/engine/ww1914/Orders";
import { ctxOf, optionOpen, sceneOf } from "@openfront/engine/ww1914/SceneRun";
import { backOpen } from "@openfront/engine/ww1914/SendBack";
import { timeLeft } from "@openfront/engine/ww1914/Time";
import { afterEach, describe, expect, test } from "vitest";
import { gwRunner } from "./util";

// ww193: departments at work. A commission comes back as an existing paper,
// a head's skill opens its gated option, unheard work is acted on, the
// send-back is reused, a rival department brings its counter-paper, and a
// trip costs two and shuts the audience room.

const paper = (id: string, extra: Partial<GwScene> = {}): GwScene => ({
  id,
  nation: ["DEU"],
  kind: "proposal",
  cast: { head: { office: "foreign" } },
  author: "head",
  salience: 3,
  tags: ["foreign"],
  scheduledOnly: true,
  variants: [{ id: "base" }],
  options: [
    {
      id: "plain",
      tell: [],
      effects: [{ kind: "gauge", gauge: "money", delta: -1 }],
    },
    {
      id: "deep",
      when: { kind: "memory", key: "k_t_dept_deep" },
      tell: [],
      effects: [{ kind: "flag", flag: "f_t_dept_deep" }],
    },
    {
      id: "give_way",
      tell: [],
      effects: [{ kind: "trust", tag: "GBR", delta: 1 }],
    },
  ],
  fallback: "plain",
  ...extra,
});

const SCENES: GwScene[] = [
  paper("t_dept_closed", { when: { kind: "flag", flag: "f_t_never" } }),
  paper("t_dept_paper"),
  {
    id: "t_dept_dispute",
    nation: ["DEU"],
    kind: "dispute",
    cast: { a: { office: "foreign" }, b: { office: "chief_of_staff" } },
    salience: 3,
    tags: ["foreign"],
    scheduledOnly: true,
    variants: [{ id: "base" }],
    options: [
      { id: "a", tell: [], effects: [] },
      { id: "strike", tell: [], effects: [{ kind: "temp", delta: 1 }] },
    ],
  },
  {
    id: "t_dept_topic",
    nation: ["DEU"],
    kind: "report",
    cast: { head: { office: "foreign" } },
    author: "head",
    salience: 3,
    tags: ["foreign"],
    scheduledOnly: true,
    variants: [
      {
        id: "shells",
        when: { kind: "picked", field: "subject", of: ["shells"] },
      },
      { id: "base" },
    ],
  },
  {
    id: "t_dept_trip",
    nation: ["DEU"],
    kind: "wire",
    cast: {},
    salience: 3,
    tags: ["war"],
    scheduledOnly: true,
    byAct: true,
    variants: [{ id: "base" }],
  },
];

const DEPTS: GwDeptContent = {
  tasks: [
    {
      id: "t_task",
      nation: ["DEU"],
      office: "foreign",
      kind: "plan",
      chapters: 1,
      products: ["t_dept_closed", "t_dept_paper"],
    },
  ],
  leans: [{ nation: ["DEU"], office: "foreign", lean: "gentle" }],
  rivals: [{ office: "foreign", against: ["chief_of_staff"] }],
};

const TRIP: GwAct = {
  id: "t_trip",
  nation: ["DEU"],
  kind: "visit",
  trip: true,
  scene: "t_dept_trip",
  wait: 1,
};

afterEach(() => useGwContent(null));

async function deu(depts: GwDeptContent = DEPTS) {
  useGwContent({
    ...GW_CONTENT,
    scenes: [...GW_CONTENT.scenes, ...SCENES],
    acts: [...(GW_CONTENT.acts ?? []), TRIP],
    depts,
  });
  const { runner } = await gwRunner({ greatWar1914Calendar: "full" });
  const gw = runner.game.greatWar()!;
  const st = gw.s.seats[0];
  st.desk = [];
  st.audiences = 2;
  st.acts = 2;
  delete st.depts;
  const head = deptHead(gw, st, "foreign")!;
  head.temperament = "cold";
  head.trust = 0;
  return { gw, st, head };
}

/** Commissions `row` and opens the chapter its work is done. */
function commission(gw: GreatWar, st: GwSeatState, row = "t_task") {
  const head = deptHead(gw, st, "foreign")!;
  const order = { kind: "task", office: "foreign", row, topic: null };
  expect(applyGwOrder(gw, st, order as never)).toBeNull();
  const due = gw.s.chapter + taskChapters(1, head, "foreign");
  expect(deptState(st).tasks[0].due).toBe(due);
  gw.s.chapter = due;
  openDepts(gw, st);
  return deptState(st).tray.find((c) => c.dept?.row === row)!;
}

/** One foreign task row of these products, and a topic if fixed. */
const oneTask = (
  products: string[],
  topic?: string,
  rivals: GwDeptContent["rivals"] = [],
): GwDeptContent => ({
  tasks: [
    {
      id: "t_task",
      nation: ["DEU"],
      office: "foreign",
      kind: "bill",
      chapters: 1,
      products,
      ...(topic === undefined ? {} : { topic }),
    },
  ],
  rivals,
});

const band = (head: { competence: number[] }, v: number) => {
  head.competence[GW_FIELDS.indexOf("politics")] = v;
};

describe("departments", () => {
  test("a commission brings the first of its papers that holds, after its chapters", async () => {
    const { gw, st } = await deu();
    const card = commission(gw, st);
    expect(card.scene).toBe("t_dept_paper");
    expect(card.dept?.office).toBe("foreign");
    // The written order cost one; the briefing costs one and lays it all.
    const left = timeLeft(st);
    expect(
      applyGwOrder(gw, st, { kind: "brief", office: "foreign" }),
    ).toBeNull();
    expect(timeLeft(st)).toBe(left - 1);
    expect(st.desk.map((c) => c.scene)).toContain("t_dept_paper");
    // The department marked the option of its lean.
    expect(card.dept?.option).toBe("give_way");
  });

  test("band 3 opens the gated option; band 1 leaves it shut", async () => {
    const { gw, st, head } = await deu();
    band(head, 3);
    const deep = sceneOf("t_dept_paper")!.options!.find(
      (o) => o.id === "deep",
    )!;
    const good = commission(gw, st);
    expect(good.dept?.keys).toEqual(["k_t_dept_deep"]);
    expect(optionOpen(ctxOf(gw, st, good), deep)).toBe(true);
    const r = await deu();
    band(r.head, 1);
    const poor = commission(r.gw, r.st);
    expect(poor.dept?.keys).toEqual([]);
    expect(optionOpen(ctxOf(r.gw, r.st, poor), deep)).toBe(false);
  });

  test("a product unheard for two chapters is acted on by the department", async () => {
    const { gw, st } = await deu();
    const card = commission(gw, st);
    gw.s.chapter += GW_TRAY_WAIT;
    openDepts(gw, st);
    expect(deptState(st).tray).not.toContain(card);
    const taken = st.choices.find((x) => x.scene === card.scene);
    expect(taken).toMatchObject({ pick: "give_way", proxy: true });
    const past = deptState(st).past.find((x) => x.scene === card.scene);
    expect(past?.verdict).toBe("acted");
    expect(st.log.some((l) => l.key === "dept_acted")).toBe(true);
  });

  test("다시 써 오시오 is the old send-back, and the head brings the rewrite", async () => {
    const { gw, st } = await deu();
    const card = commission(gw, st);
    expect(
      applyGwOrder(gw, st, { kind: "brief", office: "foreign" }),
    ).toBeNull();
    const dir = backOpen(gw, st, card, sceneOf(card.scene)!)[0];
    expect(dir).toBeDefined();
    expect(
      applyGwOrder(gw, st, {
        kind: "send_back",
        card: card.uid,
        direction: dir,
      }),
    ).toBeNull();
    expect(st.returns[st.returns.length - 1]?.scene).toBe("t_dept_paper");
    expect(st.scheduled.some((q) => q.scene === "t_dept_paper")).toBe(false);
    gw.s.chapter++;
    openDepts(gw, st);
    const again = deptState(st).tray.find((c) => c.scene === "t_dept_paper");
    expect(again?.back?.direction).toBe(dir);
    expect(again?.dept?.row).toBe("t_task");
  });

  test("a rival head comes with his counter-paper", async () => {
    const { gw, st, head } = await deu();
    const chief = deptHead(gw, st, "chief_of_staff")!;
    head.feuds = [chief.id];
    const card = commission(gw, st);
    expect(card.dept?.rival?.office).toBe("chief_of_staff");
    const counter = deptState(st).tray.find((c) => c.dept?.counter === true);
    expect(counter?.scene).toBe("t_dept_dispute");
    expect(counter?.dept?.by).toBe(chief.id);
    // One briefing, no extra time: both come in.
    expect(
      applyGwOrder(gw, st, { kind: "brief", office: "foreign" }),
    ).toBeNull();
    expect(st.desk.map((c) => c.scene)).toEqual(
      expect.arrayContaining(["t_dept_paper", "t_dept_dispute"]),
    );
  });

  test("a bill task lays its law's draft in the tray; shelved, the bill is idle", async () => {
    const { gw, st } = await deu(oneTask(["gw_law_deu_censor"]));
    // At war, past the first winter (as Laws.test's atWar).
    gw.s.warChapter = 0;
    const n = gw.nation("DEU")!;
    n.atWar = ["FRA"];
    n.side = "central";
    gw.s.dayShift = 800;
    gw.s.day += 800;
    const card = commission(gw, st);
    expect(lawOfDraft(card.scene)).toBe("deu_censor");
    expect(lawStage(n, "deu_censor")?.stage).toBe("draft");
    expect(st.desk.some((c) => c.scene === card.scene)).toBe(false);
    applyGwOrder(gw, st, { kind: "brief", office: "foreign" });
    expect(applyGwOrder(gw, st, { kind: "shelve", card: card.uid })).toBeNull();
    expect(lawStage(n, "deu_censor")?.stage).toBe("idle");
  });

  test("a topic narrows the products and reaches the paper's subject", async () => {
    expect(productFitsTopic("deu_dept_kin_grc", "GRC", ["GRC", "ROU"])).toBe(
      true,
    );
    expect(productFitsTopic("deu_dept_kin_rou", "GRC", ["GRC", "ROU"])).toBe(
      false,
    );
    expect(productFitsTopic("deu_w_plain", "GRC", ["GRC", "ROU"])).toBe(true);
    const { gw, st } = await deu(oneTask(["t_dept_topic"], "shells"));
    expect(commission(gw, st).variant).toBe("shells");
  });

  test("a rival row about a named paper brings its own counter, feud or not", async () => {
    const rivals = [
      {
        office: "foreign" as const,
        against: ["chief_of_staff" as const],
        papers: ["t_dept_paper"],
        counter: "t_dept_dispute",
      },
    ];
    const { gw, st, head } = await deu(
      oneTask(["t_dept_paper"], undefined, rivals),
    );
    head.feuds = [];
    commission(gw, st);
    const counter = deptState(st).tray.find((c) => c.dept?.counter === true);
    expect(counter?.scene).toBe("t_dept_dispute");
  });

  test("a trip costs two of the time and shuts the room", async () => {
    const { gw, st } = await deu();
    commission(gw, st);
    st.audiences = 1;
    st.acts = 2;
    expect(
      applyGwOrder(gw, st, { kind: "act", act: "t_trip", picks: [] }),
    ).toBeNull();
    expect(timeLeft(st)).toBe(1);
    expect(roomShut(gw, st)).toBe(true);
    // The tray came by wire; nobody is received.
    expect(st.desk.some((c) => c.scene === "t_dept_paper")).toBe(true);
    expect(applyGwOrder(gw, st, { kind: "brief", office: "foreign" })).toBe(
      "room_shut",
    );
  });
});
