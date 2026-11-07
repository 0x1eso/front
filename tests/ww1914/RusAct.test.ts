import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { MapFiles } from "@openfront/engine-api/game/MapFiles";
import {
  RUS_ACTS,
  RUS_AIMS,
} from "@openfront/engine-lib/ww1914/content/acts/rus";
import { GW_CONTENT } from "@openfront/engine-lib/ww1914/content/Content";
import { GW_RIVAL_ROWS } from "@openfront/engine-lib/ww1914/StoryRows";
import { actViews, takeAct } from "@openfront/engine/ww1914/Acts";
import { advanceChapter } from "@openfront/engine/ww1914/Chapters";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import { loadGwPack } from "@openfront/shared/ww1914/GwPackLoader";
import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { TestDataMapLoader } from "../util/ScriptedGame";
import { MINI } from "../ww1936/util";
import { newGame, startOf } from "./sim/GwSim";

const res = (f: string) => path.join(__dirname, "../../resources", f);
const pack = () =>
  loadGwPack("RUS", async (p) => JSON.parse(fs.readFileSync(res(p), "utf8")));

let map: MapFiles;
beforeAll(async () => {
  map = await loadMapFiles(
    new TestDataMapLoader(MINI),
    GameMapType.World1936,
    GameMapSize.Normal,
  );
});

const russia = async (id: string, played?: string[]) => {
  const start = startOf(id, "full", [], "RUS");
  if (played !== undefined) {
    start.config.greatWar1914Played = played as never;
  }
  const runner = await newGame(map, start);
  const gw = runner.game.greatWar()!;
  return { runner, gw, st: gw.s.seats[0] };
};

describe("russia's schedule", () => {
  test("the brief's counts", () => {
    const count = (k: string) => RUS_ACTS.filter((a) => a.kind === k).length;
    expect(count("visit")).toBe(14);
    expect(count("letter")).toBe(6);
    expect(count("order")).toBe(8);
    expect(count("speech")).toBe(6);
    expect(count("intrigue")).toBe(6);
    expect(RUS_AIMS).toHaveLength(6);
  });

  test("every intrigue can come out, and a visit has two states at least", () => {
    const scenes = new Map(GW_CONTENT.scenes.map((s) => [s.id, s]));
    for (const a of RUS_ACTS) {
      if (a.kind === "intrigue") expect(a.caught, a.id).toBeDefined();
      if (a.kind === "visit") {
        expect(scenes.get(a.scene)!.variants.length, a.id).toBeGreaterThan(1);
      }
    }
  });

  test("what is open can be taken, and what it plays reaches the desk", async () => {
    const { runner, gw, st } = await russia("rus-act-play");
    const taken = new Set<string>();
    for (let c = 0; c < 22 && gw.s.ended === null; c++) {
      if (c === 7) gw.nation("RUS")!.atWar.push("DEU");
      st.acts = 99;
      for (const a of actViews(gw, st)) {
        const flat = a.fields.flatMap((f) =>
          [...f.options, ...f.tones, ...f.people].slice(0, f.count),
        );
        expect(takeAct(gw, st, a.id, flat), a.id).toBeNull();
        taken.add(a.id);
      }
      advanceChapter(gw, runner.game.ticks(), false);
    }
    expect(taken.size).toBeGreaterThan(30);
  });
});

describe("the first game of russia", () => {
  test("opens on the telegram, with the circle, and the old desk waits", async () => {
    let got = false;
    for (let i = 0; i < 8 && !got; i++) {
      const { gw, st } = await russia(`rus-first-${i}`, []);
      if (
        !["sarajevo", "sarajevo_survived", "sarajevo_failed"].includes(
          gw.s.opening,
        )
      ) {
        continue;
      }
      got = true;
      expect(st.desk.map((c) => c.scene)).toContain("rus_o_first");
      expect(st.desk.map((c) => c.scene)).not.toContain("rus_c_door");
    }
    expect(got).toBe(true);
  });

  test("a nation on the shelf has the old opening", async () => {
    const { st } = await russia("rus-second", ["RUS"]);
    expect(st.desk.map((c) => c.scene)).not.toContain("rus_o_first");
  });
});

describe("the rival", () => {
  test("every person of the row has his line in every scene, and in the memoir", async () => {
    const p = await pack();
    const scenes = GW_CONTENT.scenes.filter(
      (s) => s.id.startsWith("rus_rv_") && s.nation.includes("RUS"),
    );
    expect(scenes.length).toBeGreaterThan(7);
    for (const id of GW_RIVAL_ROWS.RUS!) {
      for (const s of scenes) {
        expect(
          p.scenes[s.id].voice?.rival_man?.[id],
          `${s.id} ${id}`,
        ).toBeTruthy();
      }
      for (const k of [
        "reconciled",
        "broken",
        "prevailed",
        "stage1",
        "stage3",
      ]) {
        expect(p.rivals?.[id]?.[k], `${id} ${k}`).toBeTruthy();
      }
    }
  });

  test("no brief or title names him as what he is", async () => {
    const p = await pack();
    for (const [id, s] of Object.entries(p.scenes)) {
      if (!id.startsWith("rus_rv_")) continue;
      expect(`${s.title} ${JSON.stringify(s.brief)}`).not.toMatch(
        /경쟁|적수|정적|라이벌/,
      );
    }
  });
});
