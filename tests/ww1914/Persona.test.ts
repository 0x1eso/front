import type { GwSeatState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwPersonaContent } from "@openfront/engine-api/ww1914/GwPersona";
import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import {
  GW_CONTENT,
  useGwContent,
} from "@openfront/engine-lib/ww1914/content/Content";
import { daysFromCivil } from "@openfront/engine-lib/ww1936/Calendar";
import { makeCard, placeCard } from "@openfront/engine/ww1914/Desk";
import { personaStep } from "@openfront/engine/ww1914/Diary";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { applyGwOrder } from "@openfront/engine/ww1914/Orders";
import { sceneOf } from "@openfront/engine/ww1914/SceneRun";
import { gwView } from "@openfront/engine/ww1914/View";
import { afterEach, describe, expect, test } from "vitest";
import { gwRunner } from "./util";

// ww196 §0: the person at the desk. Where he sits and who brings the paper
// follow the date and the paper; at the bottom of his nerve a thing against
// his grain is listed but locked; the chapter's diary line is about its
// heaviest moment.

const paper = (
  id: string,
  tags: GwScene["tags"],
  options: GwScene["options"] = [{ id: "ok", tell: [], effects: [] }],
): GwScene => ({
  id,
  nation: ["DEU"],
  kind: "proposal",
  cast: {},
  salience: 3,
  tags,
  scheduledOnly: true,
  variants: [{ id: "base" }],
  options,
});

const SCENES: GwScene[] = [
  paper("t_p_war", ["war"]),
  paper("t_p_home", ["home"]),
  paper("t_p_own", ["private"]),
  paper(
    "t_p_hard",
    ["foreign"],
    [
      {
        id: "refuse",
        tell: [],
        effects: [{ kind: "temp", delta: 1 }],
      },
      {
        id: "accept",
        tell: [],
        effects: [{ kind: "trust", tag: "GBR", delta: 1 }],
      },
    ],
  ),
];

const PERSONA: GwPersonaContent = {
  places: [
    { id: "t_potsdam", nation: ["DEU"] },
    {
      id: "t_charleville",
      nation: ["DEU"],
      from: "1914-09-25",
      until: "1915-04-20",
    },
  ],
  bearers: [
    { id: "t_ketterl", nation: ["DEU"], private: true },
    { id: "t_lyncker", nation: ["DEU"], tags: ["war"] },
    { id: "t_valentini", nation: ["DEU"], until: "1918-01-16" },
    { id: "t_berg", nation: ["DEU"] },
  ],
  grain: [{ id: "t_grain", nation: ["DEU"], ruler: "wilhelm", lean: "firm" }],
  diary: [
    { id: "t_d_front", nation: ["DEU"], moment: "front" },
    { id: "t_d_decision", nation: ["DEU"], moment: "decision" },
    { id: "t_d_filler", nation: ["DEU"], moment: "filler" },
  ],
};

afterEach(() => useGwContent(null));

async function deu(): Promise<{ gw: GreatWar; st: GwSeatState }> {
  useGwContent({
    ...GW_CONTENT,
    scenes: [...GW_CONTENT.scenes, ...SCENES],
    persona: PERSONA,
  });
  const { runner } = await gwRunner({ greatWar1914Calendar: "full" });
  const gw = runner.game.greatWar()!;
  const st = gw.s.seats[0];
  st.desk = [];
  return { gw, st };
}

function deal(gw: GreatWar, st: GwSeatState, id: string) {
  const card = makeCard(gw, st, sceneOf(id)!, "desk")!;
  placeCard(gw, st, card);
  return card;
}

const seatView = (gw: GreatWar) => gwView(gw).seats[0];
const on = (y: number, m: number, d: number) => daysFromCivil(y, m, d);

describe("the person (ww196 §0)", () => {
  test("the place and the bearer follow the date and the paper", async () => {
    const { gw, st } = await deu();
    gw.s.day = on(1914, 7, 20);
    deal(gw, st, "t_p_home");
    deal(gw, st, "t_p_war");
    deal(gw, st, "t_p_own");
    let v = seatView(gw);
    expect(v.head).toEqual({ place: "t_potsdam", bearer: "t_valentini" });
    expect(v.desk.map((c) => [c.scene, c.bearer, c.private])).toEqual([
      ["t_p_home", "t_valentini", undefined],
      ["t_p_war", "t_lyncker", undefined],
      ["t_p_own", "t_ketterl", true],
    ]);
    gw.s.day = on(1914, 10, 1);
    expect(seatView(gw).head?.place).toBe("t_charleville");
    gw.s.day = on(1918, 3, 1);
    v = seatView(gw);
    expect(v.head).toEqual({ place: "t_potsdam", bearer: "t_berg" });
  });

  test("at the bottom of his nerve a thing against his grain is locked, with its why", async () => {
    const { gw, st } = await deu();
    st.ruler.nerve = 3;
    let card = deal(gw, st, "t_p_hard");
    let opts = seatView(gw).desk[0].options;
    expect(opts.find((o) => o.id === "refuse")).toMatchObject({
      open: true,
      grain: "t_grain",
    });
    expect(opts.find((o) => o.id === "accept")?.grain).toBeUndefined();
    const choose = (option: string) =>
      applyGwOrder(gw, st, { kind: "choose", card: card.uid, option });
    expect(choose("refuse")).toBeNull();
    expect(st.ruler.nerve).toBe(2);
    expect(st.ruler.lines.slice(-1)[0]?.key).toBe("wilhelm_grain");

    st.ruler.nerve = 0;
    card = deal(gw, st, "t_p_hard");
    opts = seatView(gw).desk[0].options;
    expect(opts.find((o) => o.id === "refuse")).toMatchObject({
      open: false,
      grain: "t_grain",
    });
    expect(opts.find((o) => o.id === "accept")?.open).toBe(true);
    expect(choose("refuse")).toBe("closed");
    expect(choose("accept")).toBeNull();
    expect(st.ruler.nerve).toBe(0);
  });

  test("a chapter's diary line names its heaviest moment, else the filler", async () => {
    const { gw, st } = await deu();
    const quiet = () => {
      gw.s.news = [];
      st.choices = [];
      st.seen = {};
      st.ruler.lines = [];
      st.ruler.failing = null;
    };
    quiet();
    const now = gw.s.chapter;
    st.choices.push({
      scene: "t_p_hard",
      pick: "accept",
      chapter: now,
      proxy: false,
      cast: {},
    });
    gw.s.news.push({
      key: "front_break",
      chapter: now,
      a: "DEU",
      b: null,
      theatre: "west",
    });
    personaStep(gw);
    expect(st.persona?.diary).toEqual([
      {
        chapter: now,
        row: "t_d_front",
        who: null,
        scene: null,
        theatre: "west",
      },
      {
        chapter: now,
        row: "t_d_decision",
        who: null,
        scene: "t_p_hard",
        theatre: null,
      },
    ]);
    expect(seatView(gw).diary?.[0]).toMatchObject({
      row: "t_d_front",
      theatre: "west",
    });

    quiet();
    gw.s.chapter++;
    personaStep(gw);
    expect(st.persona?.diary.slice(-1)[0]?.row).toBe("t_d_filler");
  });
});
