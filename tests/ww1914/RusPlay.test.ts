import { GW_CONTENT } from "@openfront/engine-lib/ww1914/content/Content";
import { GW_NEUTRAL_SCENES } from "@openfront/engine-lib/ww1914/content/scenes/gw_neutral";
import { GW_LAWS } from "@openfront/engine-lib/ww1914/content/scenes/laws";
import { advanceChapter } from "@openfront/engine/ww1914/Chapters";
import { memoirOf } from "@openfront/engine/ww1914/Endings";
import {
  candidatesFor,
  personLeaves,
  standingOffices,
} from "@openfront/engine/ww1914/People";
import { describe, expect, test } from "vitest";
import { gwRunner } from "./util";

/** A game with the seat on Russia's chair. */
async function russia() {
  const { runner } = await gwRunner({ greatWar1914Calendar: "full" });
  const gw = runner.game.greatWar()!;
  const st = gw.s.seats[0];
  st.tag = "RUS";
  return { gw, st };
}

// What playing Russia on screen turned up (ww145).
describe("russia as played", () => {
  test("an office nobody held in June 1914 is no vacancy", () => {
    const offices = standingOffices("RUS");
    expect(offices).toContain("chancellor");
    expect(offices).not.toContain("supreme_commander");
  });

  test("the vodka bill and the desk's vodka paper don't both run", () => {
    const row = GW_LAWS.find((r) => r.id === "rus_dry")!;
    expect(row.replaces).toContain("rus_c_vodka");
    expect(JSON.stringify(row.settled)).toContain("rus_c_vodka");
  });

  test("the name a scene asked for comes first, and only once", async () => {
    const { gw, st } = await russia();
    const camps = (id: string) =>
      GW_CONTENT.people.find((p) => p.id === id)!.camps;
    st.flags.push("f_next_duma");
    expect(camps(candidatesFor(gw, st, "chancellor")[0])).toContain("duma");
    st.flags = st.flags.filter((f) => f !== "f_next_duma");
    st.flags.push("f_next_court");
    expect(camps(candidatesFor(gw, st, "chancellor")[0])).toContain("court");
    st.ready = true;
    advanceChapter(gw, 0, false);
    expect(st.flags).not.toContain("f_next_court");
  });

  test("a seat left empty on purpose stays empty for the chapter", async () => {
    const { gw, st } = await russia();
    gw.person("rus_goremykin")!.office = null;
    st.flags.push("f_next_none");
    st.ready = true;
    advanceChapter(gw, 0, false);
    expect(
      gw.s.people.some(
        (p) => p.office === "chancellor" && p.id.startsWith("rus_"),
      ),
    ).toBe(false);
    expect(st.flags).not.toContain("f_next_none");
  });

  test("a paper two causes call for the same day comes once", async () => {
    const { gw, st } = await russia();
    const scene = GW_CONTENT.scenes.find((s) => s.id === "gw_ailing")!;
    st.scheduled.push(
      { scene: scene.id, chapter: gw.s.chapter + 1 },
      { scene: scene.id, chapter: gw.s.chapter + 1 },
    );
    st.desk = [];
    st.ready = true;
    advanceChapter(gw, 0, false);
    expect(st.desk.filter((c) => c.scene === scene.id).length).toBeLessThan(2);
  });

  test("no neutral comes to bargain at the peace conference", () => {
    for (const s of GW_NEUTRAL_SCENES) {
      expect(s.stage, s.id).not.toContain("conference");
    }
  });

  test("whoever leaves is named in the why-log", async () => {
    const { gw, st } = await russia();
    personLeaves(gw, st, gw.person("rus_witte")!, "person_passed");
    personLeaves(gw, st, gw.person("rus_durnovo")!, "person_passed");
    const lines = st.log.filter((l) => l.key === "person_passed");
    expect(lines.map((l) => l.who)).toEqual(["rus_witte", "rus_durnovo"]);
  });

  test("the memoir's unknowns are this seat's sources and working people", async () => {
    const { gw, st } = await russia();
    const m = memoirOf(gw, st, "closing");
    for (const u of m.unknown) {
      if (u.kind === "source") {
        expect(gw.s.reports.some((r) => r.source === u.id)).toBe(true);
      }
      if (u.kind === "person") expect(u.id).not.toBe("rus_olga");
    }
  });
});
