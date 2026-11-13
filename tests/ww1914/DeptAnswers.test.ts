import {
  GW_FIELDS,
  GwCard,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type {
  GwAnswerRow,
  GwDeptContent,
  GwSlots,
} from "@openfront/engine-api/ww1914/GwDepts";
import {
  answerSlots,
  slotsHold,
} from "@openfront/engine-lib/ww1914/AnswerSlots";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import {
  GW_CONTENT,
  useGwContent,
} from "@openfront/engine-lib/ww1914/content/Content";
import { daysFromCivil } from "@openfront/engine-lib/ww1936/Calendar";
import {
  closeDepts,
  deptHead,
  deptState,
  deptViews,
  leverViews,
  openDepts,
  paperView,
} from "@openfront/engine/ww1914/Departments";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { openHonours } from "@openfront/engine/ww1914/Honours";
import { applyGwOrder } from "@openfront/engine/ww1914/Orders";
import { timeLeft } from "@openfront/engine/ww1914/Time";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { gwRunner } from "./util";

// ww196 (design ww195 §2-4): a task brings its own answer through its
// stages, shaped by the head; questions, stalls and pushes; honours come at
// their occasion, not in the audience.

const ROW: GwAnswerRow = {
  id: "t_ans_envoy",
  nation: ["DEU"],
  type: "envoy",
  findings: [
    { id: "f_top", weight: 3 },
    { id: "f_mid", weight: 2 },
    { id: "f_low", weight: 1 },
    { id: "f_low2", weight: 1, slots: { country: ["*"] } },
    { id: "f_lie", weight: 2, wrong: true },
  ],
  courses: [
    { id: "c_offer", lean: ["bold"], effects: [] },
    { id: "c_neutral", lean: ["gentle"], effects: [] },
    { id: "c_scare", lean: ["firm"], effects: [{ kind: "temp", delta: 1 }] },
    { id: "c_wait", lean: ["wait"], wait: true, effects: [] },
  ],
};

const DEPTS: GwDeptContent = {
  answers: [ROW],
  rivals: [],
  orders: [
    { id: "t_eagle", nation: ["DEU"], rank: 1, pools: ["officials", "heads"] },
    { id: "t_cross", nation: ["DEU"], rank: 2, pools: ["officials", "heads"] },
  ],
  honours: [
    {
      id: "t_new_year",
      nation: ["DEU"],
      occasion: "date",
      day: "01-01",
      pools: ["officials", "heads"],
      orders: ["t_eagle", "t_cross"],
      from: ["chancellor"],
    },
  ],
};

const DAY_1915 = daysFromCivil(1915, 1, 1);

afterEach(() => useGwContent(null));

async function deu(depts: GwDeptContent = DEPTS) {
  useGwContent({ ...GW_CONTENT, depts });
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
  head.pride = 0;
  band(head, 2);
  return { gw, st, head };
}

const band = (head: { competence: number[] }, v: number) => {
  head.competence[GW_FIELDS.indexOf("politics")] = v;
};

const give = (gw: GreatWar, st: GwSeatState, topic = "ROU") =>
  applyGwOrder(gw, st, {
    kind: "task",
    office: "foreign",
    row: "envoy",
    topic,
  });

/** The chapter ends (papers held over) and the next one opens. */
function next(gw: GreatWar, st: GwSeatState): void {
  closeDepts(gw, st);
  st.desk = [];
  gw.s.chapter++;
  openDepts(gw, st);
}

const paper = (st: GwSeatState, form: string): GwCard | undefined =>
  st.desk.find((c) => c.paper?.form === form);

/** Gives the envoy task and runs chapters until its answer is on the desk. */
function untilAnswer(gw: GreatWar, st: GwSeatState): GwCard {
  expect(give(gw, st)).toBeNull();
  for (let i = 0; i < 5 && paper(st, "answer") === undefined; i++) {
    next(gw, st);
  }
  return paper(st, "answer")!;
}

describe("department answers (ww196)", () => {
  test("a task runs from 착수 to 보고 for free; its answer names its topic, with courses", async () => {
    const { gw, st } = await deu();
    const left = timeLeft(st);
    expect(give(gw, st)).toBeNull();
    expect(timeLeft(st)).toBe(left);
    const stages = [deptState(st).tasks[0].stage];
    for (let i = 0; i < 5 && paper(st, "answer") === undefined; i++) {
      next(gw, st);
      stages.push(deptState(st).tasks[0]?.stage ?? "report");
    }
    expect(stages[0]).toBe("start");
    expect(stages).toContain("inquiry");
    expect(stages[stages.length - 1]).toBe("report");
    const news = paper(st, "news")?.paper;
    expect(news?.form === "news" && news.lines[0].stage).toBe("report");
    const card = paper(st, "answer")!;
    const v = paperView(gw, st, card);
    expect(v?.form).toBe("answer");
    if (v?.form !== "answer") return;
    expect(v.topic).toBe("ROU");
    expect(v.slots.country).toEqual({ kind: "tag", value: "ROU" });
    expect(v.courses.length).toBeGreaterThanOrEqual(2);
    // The foreign office leans gentle: its own course is the gentle one.
    expect(v.courses.find((c) => c.own)?.id).toBe("c_neutral");
    expect(timeLeft(st)).toBe(left);
    // A course is taken by the answer order; the record keeps it.
    expect(
      applyGwOrder(gw, st, {
        kind: "answer",
        card: card.uid,
        course: "c_scare",
        redo: null,
      }),
    ).toBeNull();
    const past = deptState(st).past.slice(-1)[0]!;
    expect(past).toMatchObject({ verdict: "overrule", course: "c_scare" });
  });

  test("a band 1 head brings fewer findings than a band 3 head", async () => {
    const weak = await deu();
    band(weak.head, 1);
    const a = paperView(weak.gw, weak.st, untilAnswer(weak.gw, weak.st));
    const strong = await deu();
    band(strong.head, 3);
    const b = paperView(
      strong.gw,
      strong.st,
      untilAnswer(strong.gw, strong.st),
    );
    if (a?.form !== "answer" || b?.form !== "answer") throw new Error("form");
    expect(a.findings.length).toBe(2);
    expect(b.findings.length).toBe(4);
    expect(b.findings.every((f) => f.conf === "sure")).toBe(true);
    expect(a.findings.every((f) => f.conf === "heard")).toBe(true);
    expect(b.findings.some((f) => f.id === "f_lie")).toBe(false);
  });

  test("a cunning head writes no case against his own course", async () => {
    const { gw, st, head } = await deu();
    head.temperament = "cunning";
    const v = paperView(gw, st, untilAnswer(gw, st));
    if (v?.form !== "answer") throw new Error("form");
    const own = v.courses.find((c) => c.own)!;
    expect(own.against).toBe(false);
    expect(v.courses.filter((c) => !c.own).some((c) => !c.for)).toBe(true);
  });

  test("a question left unanswered becomes the head's own pick", async () => {
    const { gw, st } = await deu({
      ...DEPTS,
      answers: [{ ...ROW, question: "reach" }],
    });
    expect(give(gw, st)).toBeNull();
    next(gw, st);
    const q = paper(st, "question")!;
    expect(q.paper?.form).toBe("question");
    const lean = q.paper?.form === "question" ? q.paper.lean : null;
    expect(lean).toBe("sound");
    const card = (() => {
      for (let i = 0; i < 4 && paper(st, "answer") === undefined; i++) {
        next(gw, st);
      }
      return paper(st, "answer")!;
    })();
    expect(card.paper?.form === "answer" && card.paper.slots.reach).toEqual({
      kind: "word",
      value: "sound",
    });
  });

  test("서두르게 한다 clears a stall; 거둔다 frees the department", async () => {
    const { gw, st } = await deu();
    gw.nation("DEU")!.gauges.money = 2;
    expect(give(gw, st)).toBeNull();
    const t = deptState(st).tasks[0];
    t.stall = "rival";
    const due = t.due;
    expect(
      applyGwOrder(gw, st, {
        kind: "task_push",
        office: "foreign",
        how: "hurry",
        person: null,
      }),
    ).toBeNull();
    expect(t.stall).toBeNull();
    expect(t.hurried).toBe(true);
    expect(t.due).toBeLessThanOrEqual(due);
    expect(gw.nation("DEU")!.gauges.money).toBeLessThan(2);
    expect(
      applyGwOrder(gw, st, {
        kind: "task_push",
        office: "foreign",
        how: "withdraw",
        person: null,
      }),
    ).toBeNull();
    expect(deptState(st).tasks).toEqual([]);
    const view = deptViews(gw, st, () => "")[0];
    expect(view.task).toBeNull();
    expect(deptState(st).past.slice(-1)[0]?.verdict).toBe("withdraw");
  });

  test("a 1 January chapter brings the list and its 서훈식; the audience gives nothing", async () => {
    const { gw, st } = await deu();
    const chs = gwChapters(gw.s.calendar);
    const i = chs.findIndex(
      (c, k) =>
        k + 1 < chs.length &&
        c.day + gw.s.dayShift <= DAY_1915 &&
        chs[k + 1].day + gw.s.dayShift > DAY_1915,
    );
    expect(i).toBeGreaterThan(0);
    gw.s.chapter = i;
    gw.s.day = chs[i].day + gw.s.dayShift;
    openHonours(gw, st);
    const list = paper(st, "honours")!;
    expect(list.paper?.form).toBe("honours");
    if (list.paper?.form !== "honours") return;
    expect(list.paper.entries.length).toBeGreaterThan(0);
    const who = list.paper.entries[0].person!;
    const trust = gw.person(who)!.trust;
    const left = timeLeft(st);
    expect(
      applyGwOrder(gw, st, {
        kind: "honours",
        card: list.uid,
        give: [{ at: 0, honour: "t_eagle" }],
      }),
    ).toBeNull();
    expect(timeLeft(st)).toBe(left - 1);
    expect(gw.person(who)!.trust).toBe(trust + 1);
    // No gifts in the audience any more.
    expect(
      applyGwOrder(gw, st, { kind: "gift", row: "t_eagle", person: who }),
    ).toBe("gone");
    expect(leverViews()).toEqual([]);
  });
});

// ww201: once the production step has run, the heads of arms, food and money
// say where it takes their gauge (the common rows' trend findings).
describe("the production step in the heads' answers (ww201)", () => {
  test("the trend slots fill from the step and pick the row's findings", async () => {
    const { runner } = await gwRunner({ greatWar1914Calendar: "full" });
    const gw = runner.game.greatWar()!;
    const st = gw.s.seats[0];
    const n = gw.s.nations.find((x) => x.tag === st.tag)!;
    const holds = (row: string, type: "arms" | "bread" | "money") =>
      GW_CONTENT.depts!.answers!.find((r) => r.id === row)!
        .findings.filter((f) =>
          slotsHold(f.slots, answerSlots(gw.s, st, type, null)),
        )
        .map((f) => f.id)
        .filter((id) => /_(rising|full|steady|falling)/.test(id));
    // Before the step runs there is no trend to tell.
    delete n.econ;
    expect(holds("c_arms", "arms")).toEqual([]);
    n.gauges.shells = 1;
    n.gauges.money = 3;
    n.econ = {
      rate: { shells: -400, bread: 0, money: 120 },
      why: { shells: "econ_fronts", bread: "", money: "econ_trade" },
      moved: [],
      dry: null,
      mobilised: null,
    };
    expect(holds("c_arms", "arms")).toEqual(["shells_falling_fast"]);
    expect(holds("c_bread", "bread")).toEqual(["bread_steady"]);
    expect(holds("c_money", "money")).toEqual(["money_full"]);
    expect(holds("c_budget", "money")).toEqual(["money_full"]);
  });
});

// ww203: the count paper on a bill (task `count`, given by `bill_count`).
describe("the count paper (ww203)", () => {
  const row = GW_CONTENT.depts!.answers!.find((r) => r.id === "c_count")!;
  const word = (value: string) => ({ kind: "word" as const, value });
  const ids = (xs: readonly { id: string; slots?: object }[], s: GwSlots) =>
    xs
      .filter((x) => slotsHold(x.slots as never, s))
      .map((x) => x.id)
      .sort();

  test("the tally picks the findings and courses; every one has its words", () => {
    expect(row.nation).toHaveLength(5);
    const easy: GwSlots = { bill: word("deu_peace_res"), tally: word("easy") };
    expect(ids(row.findings, easy)).toEqual(["easy", "whips"]);
    expect(ids(row.courses, easy)).toEqual(["vote", "wait"]);
    const short: GwSlots = {
      ...easy,
      tally: word("short"),
      swing: word("deu_centre,deu_natlib"),
    };
    expect(ids(row.courses, short)).toEqual([
      "amend",
      "vote",
      "wait",
      "withdraw",
      "work",
    ]);
    const ko = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../../resources/ww1914/ko/common.depts.json"),
        "utf8",
      ),
    ).depts;
    expect(ko.types.count.name).toContain("{topic}");
    const t = ko.answers.c_count;
    for (const f of row.findings) expect(t.findings[f.id]).toBeTruthy();
    for (const f of row.findings.filter((x) => x.wrong)) {
      expect(t.hindsight[f.id]).toBeTruthy();
    }
    for (const c of row.courses) {
      expect(Object.keys(t.courses[c.id]).sort()).toEqual([
        "against",
        "for",
        "name",
      ]);
    }
  });
});
