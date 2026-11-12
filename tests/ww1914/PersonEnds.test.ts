import { GameType } from "@openfront/engine-api/game/GameTypes";
import {
  GwCard,
  gwPersonaStart,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GW_TAGS } from "@openfront/engine-api/ww1914/GwCountries";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import {
  GW_CONTENT,
  useGwContent,
} from "@openfront/engine-lib/ww1914/content/Content";
import { GW_RULERS } from "@openfront/engine-lib/ww1914/RulerRows";
import { daysFromCivil } from "@openfront/engine-lib/ww1936/Calendar";
import { closeChain } from "@openfront/engine/ww1914/Crises";
import {
  deptHead,
  layPaper,
  paperCard,
  paperView,
} from "@openfront/engine/ww1914/Departments";
import { closeGame } from "@openfront/engine/ww1914/Endings";
import { proposalsFor } from "@openfront/engine/ww1914/Fronts";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { applyGwOrder } from "@openfront/engine/ww1914/Orders";
import { changeRegime, GW_REGIMES } from "@openfront/engine/ww1914/Regimes";
import { rollRuler, rulerStep } from "@openfront/engine/ww1914/Ruler";
import { afterEach, describe, expect, test } from "vitest";
import { HUMAN, step, wwRunnerCapture } from "../ww1936/util";
import { gwRunner } from "./util";

// ww197 (owner's A, "그 사람이 끝나면 내 판도 끝"): a regime with no place for
// the person ends the seat with its own ending; and the ww196 leftovers: a
// front course marks the chief's war paper, a course against the grain costs
// nerve, the memoir keeps a few diary lines a year.

afterEach(() => useGwContent(null));

async function russia(): Promise<GreatWar> {
  const { runner } = await wwRunnerCapture(
    {
      greatWar1914: true,
      gameType: GameType.Singleplayer,
      greatWar1914Calendar: "full",
    },
    [{ clientID: HUMAN, gwCountry: "RUS" }],
  );
  step(runner, 2);
  return runner.game.greatWar()!;
}

/** An answer paper of the common front row, from the chief of staff. */
function frontAnswer(gw: GreatWar, st: GwSeatState, topic: string): GwCard {
  const head = deptHead(gw, st, "chief_of_staff")!;
  const course = (id: string) => ({
    row: "c_front",
    id,
    by: "chief_of_staff" as const,
    who: head.id,
    for: true,
    against: true,
  });
  const card = paperCard(
    gw,
    {
      form: "answer",
      office: "chief_of_staff",
      by: head.id,
      type: "front",
      topic,
      rows: ["c_front"],
      slots: {},
      findings: [],
      courses: [course("attack"), course("hold")],
      own: "attack",
      band: 2,
      called: false,
      ready: gw.s.chapter,
      row: null,
    },
    head.id,
  );
  layPaper(st, card);
  return card;
}

async function deuAtWar() {
  const { runner } = await gwRunner({ greatWar1914Calendar: "full" }, "GWOFF1");
  const gw = runner.game.greatWar()!;
  gw.s.chain = { topic: "balkan", step: 5, hold: 0, short: false };
  gw.s.temp = 9;
  closeChain(gw, "war");
  const st = gw.s.seats[0];
  st.desk = [];
  return { gw, st };
}

describe("the person ends, the game ends (ww197)", () => {
  test("RUS: the same tsar under the Duma goes on; the Provisional Government ends the seat, its memoir with a few diary lines a year", async () => {
    // No seat can live on without a person: every form a row has no place
    // in has an ending on each row of that country.
    for (const tag of GW_TAGS) {
      const rows = GW_RULERS[tag] ?? [];
      for (const r of GW_REGIMES[tag] ?? []) {
        if (rows.some((x) => x.regimes?.includes(r.id) ?? true)) continue;
        for (const x of rows) {
          expect(
            x.ends?.[r.id] ?? x.ends?.["*"],
            `${x.id} ${r.id}`,
          ).toBeTruthy();
        }
      }
    }
    const gw = await russia();
    const st = gw.s.seats[0];
    changeRegime(gw, "RUS", "crown");
    rulerStep(gw);
    expect(gw.s.ended).toBeNull();
    expect(st.ruler.id).toBe("nicholas");

    // Lines from March of each year on, one chapter apart.
    const at = (y: number) =>
      gwChapters(gw.s.calendar).findIndex(
        (c) => c.day + gw.s.dayShift >= daysFromCivil(y, 3, 1),
      );
    st.persona ??= gwPersonaStart();
    st.persona.diary = [1915, 1915, 1915, 1915, 1916].map((y, i) => ({
      chapter: at(y) + i,
      row: `t_${i}`,
      who: null,
      scene: null,
      theatre: null,
      w: [1, 7, 0, 4, 2][i],
    }));
    changeRegime(gw, "RUS", "provisional");
    rulerStep(gw);
    expect(gw.s.ended).toBe("rus_end_pskov");
    expect(gw.person("rus_nicholas")?.status).toBe("fallen");
    closeGame(gw);
    const m = st.memoir!;
    expect(m.ending).toBe("rus_end_pskov");
    // The three heaviest of the first year, in their order; the other year's one.
    expect(m.diary?.map((d) => d.row)).toEqual(["t_0", "t_1", "t_3", "t_4"]);
  });

  test("AUH: the federation ends the emperor's seat; a friend plays on and it watches", async () => {
    const { runner } = await wwRunnerCapture(
      {
        greatWar1914: true,
        gameType: GameType.Private,
        greatWar1914Calendar: "friends",
      },
      [
        { clientID: "AAAAAAA1", gwCountry: "DEU" },
        { clientID: "BBBBBBB2", gwCountry: "RUS" },
      ],
      undefined,
      undefined,
      "AAAAAAA1",
    );
    step(runner, 2);
    const gw = runner.game.greatWar()!;
    // The test map seats no Vienna: the second friend takes it over.
    const auh = gw.s.seats.find((x) => x.tag === "RUS")!;
    auh.tag = "AUH";
    rollRuler(gw, auh);
    const deu = gw.s.seats.find((x) => x.tag === "DEU")!;
    expect(auh.ruler.id).toBe("franz_joseph");
    changeRegime(gw, "AUH", "federation");
    rulerStep(gw);
    expect(auh.memoir?.ending).toBe("auh_e_fj_federation");
    expect(auh.desk).toEqual([]);
    expect(gw.s.ended).toBeNull();
    expect(deu.memoir).toBeNull();
  });

  test("a front course marks the chief's war paper and puts it first", async () => {
    const { gw, st } = await deuAtWar();
    const before = proposalsFor(gw, st);
    expect(before[0].id).not.toBe("hold_all");
    const card = frontAnswer(gw, st, "west");
    expect(
      applyGwOrder(gw, st, {
        kind: "answer",
        card: card.uid,
        course: "hold",
        redo: null,
      }),
    ).toBeNull();
    const after = proposalsFor(gw, st);
    expect(after[0]).toMatchObject({
      id: "hold_all",
      marked: { office: "chief_of_staff", course: "hold" },
    });
    expect(after.filter((p) => p.marked !== undefined)).toHaveLength(1);
    gw.s.chapter += 2;
    expect(proposalsFor(gw, st).some((p) => p.marked !== undefined)).toBe(
      false,
    );
  });

  test("a course against his grain costs a nerve, and with none left it is locked", async () => {
    useGwContent({
      ...GW_CONTENT,
      persona: {
        grain: [
          { id: "t_grain", nation: ["DEU"], ruler: "wilhelm", lean: "firm" },
        ],
      },
    });
    const { gw, st } = await deuAtWar();
    st.ruler.nerve = 3;
    let card = frontAnswer(gw, st, "west");
    const courses = () => {
      const v = paperView(gw, st, card);
      if (v?.form !== "answer") throw new Error("form");
      return v.courses;
    };
    expect(courses().find((c) => c.id === "attack")).toMatchObject({
      grain: "t_grain",
    });
    expect(courses().find((c) => c.id === "hold")?.grain).toBeUndefined();
    const answer = (course: string) =>
      applyGwOrder(gw, st, {
        kind: "answer",
        card: card.uid,
        course,
        redo: null,
      });
    expect(answer("attack")).toBeNull();
    expect(st.ruler.nerve).toBe(2);
    expect(st.ruler.lines.slice(-1)[0]?.key).toBe("wilhelm_grain");

    st.ruler.nerve = 0;
    card = frontAnswer(gw, st, "west");
    expect(courses().find((c) => c.id === "attack")?.locked).toBe(true);
    expect(answer("attack")).toBe("closed");
    expect(answer("hold")).toBeNull();
    expect(st.ruler.nerve).toBe(0);
  });
});
