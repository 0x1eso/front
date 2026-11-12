import type { GwAct } from "@openfront/engine-api/ww1914/GwActs";
import type { GwDeptContent } from "@openfront/engine-api/ww1914/GwDepts";
import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import {
  GW_CONTENT,
  useGwContent,
} from "@openfront/engine-lib/ww1914/content/Content";
import {
  closeDepts,
  deptHead,
  deptState,
  markInitiative,
  roomShut,
} from "@openfront/engine/ww1914/Departments";
import { makeCard, placeCard } from "@openfront/engine/ww1914/Desk";
import { applyGwOrder } from "@openfront/engine/ww1914/Orders";
import { sceneOf } from "@openfront/engine/ww1914/SceneRun";
import { timeLeft } from "@openfront/engine/ww1914/Time";
import { afterEach, describe, expect, test } from "vitest";
import { gwRunner } from "./util";

// ww193 rules kept by ww196: a head's own desk paper carries his chip and
// his option, a rival head brings his counter-paper, the department acts on
// what is left undecided, and a trip costs two and shuts the room.

const SCENES: GwScene[] = [
  {
    id: "t_dept_paper",
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
        id: "give_way",
        tell: [],
        effects: [{ kind: "trust", tag: "GBR", delta: 1 }],
      },
    ],
    fallback: "plain",
  },
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

async function deu() {
  useGwContent({
    ...GW_CONTENT,
    scenes: [...GW_CONTENT.scenes, ...SCENES],
    acts: [...(GW_CONTENT.acts ?? []), TRIP],
    depts: DEPTS,
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
  head.feuds = [];
  return { gw, st, head };
}

/** The head's paper dealt to the desk and marked as his. */
function deal(
  gw: Awaited<ReturnType<typeof deu>>["gw"],
  st: (typeof gw.s.seats)[0],
) {
  const card = makeCard(gw, st, sceneOf("t_dept_paper")!, "desk")!;
  placeCard(gw, st, card);
  expect(markInitiative(gw, st, card)).toBe(true);
  return card;
}

describe("departments' own papers (ww193 rules kept)", () => {
  test("a head's own paper stays on the desk with his chip and his option", async () => {
    const { gw, st, head } = await deu();
    const card = deal(gw, st);
    expect(st.desk).toContain(card);
    expect(card.dept).toMatchObject({ office: "foreign", by: head.id });
    expect(card.dept?.option).toBe("give_way");
  });

  test("left undecided, the department takes its own option at the chapter's end", async () => {
    const { gw, st } = await deu();
    const card = deal(gw, st);
    closeDepts(gw, st);
    expect(st.desk).not.toContain(card);
    const taken = st.choices.find((x) => x.scene === card.scene);
    expect(taken).toMatchObject({ pick: "give_way", proxy: true });
    expect(deptState(st).past.slice(-1)[0]?.verdict).toBe("acted");
  });

  test("a rival head comes with his counter-paper", async () => {
    const { gw, st, head } = await deu();
    const chief = deptHead(gw, st, "chief_of_staff")!;
    head.feuds = [chief.id];
    const card = deal(gw, st);
    expect(card.dept?.rival?.office).toBe("chief_of_staff");
    const counter = st.desk.find((c) => c.dept?.counter === true);
    expect(counter?.scene).toBe("t_dept_dispute");
    expect(counter?.dept?.by).toBe(chief.id);
  });

  test("a trip costs two of the time and shuts the room; briefings are gone", async () => {
    const { gw, st } = await deu();
    st.audiences = 1;
    st.acts = 2;
    expect(
      applyGwOrder(gw, st, { kind: "act", act: "t_trip", picks: [] }),
    ).toBeNull();
    expect(timeLeft(st)).toBe(1);
    expect(roomShut(gw, st)).toBe(true);
    expect(applyGwOrder(gw, st, { kind: "brief", office: "foreign" })).toBe(
      "gone",
    );
  });
});
