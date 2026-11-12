import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { MapFiles } from "@openfront/engine-api/game/MapFiles";
import type { GwBattle } from "@openfront/engine-api/ww1914/GreatWarTypes";
import { gwSceneProblems } from "@openfront/engine-api/ww1914/SceneDsl";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import {
  AUH_ACT_SCENES,
  AUH_ACTS,
  AUH_AIMS,
} from "@openfront/engine-lib/ww1914/content/acts/auh";
import { GW_CONTENT } from "@openfront/engine-lib/ww1914/content/Content";
import { AUH_STORY_SCENES } from "@openfront/engine-lib/ww1914/content/scenes/auh_act";
import { GW_RIVAL_ROWS } from "@openfront/engine-lib/ww1914/StoryRows";
import { daysFromCivil } from "@openfront/engine-lib/ww1936/Calendar";
import { dealDesk, deskCandidates } from "@openfront/engine/ww1914/Desk";
import { holds } from "@openfront/engine/ww1914/SceneRun";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import { loadGwPack } from "@openfront/shared/ww1914/GwPackLoader";
import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { newGame, startOf } from "./sim/GwSim";

const ROOT = path.join(__dirname, "../../resources");
const json = async (p: string) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const count = (kind: string) => AUH_ACTS.filter((a) => a.kind === kind).length;
const story = (id: string) => {
  const s = AUH_STORY_SCENES.find((x) => x.id === id);
  if (s === undefined) throw new Error(id);
  return s;
};

describe("Austria's own moves and story", () => {
  let map: MapFiles;
  beforeAll(async () => {
    map = await loadMapFiles(
      new NodeGameMapLoader(path.join(__dirname, "../../resources/maps")),
      GameMapType.World1936,
      GameMapSize.Normal,
    );
  });

  async function firstGame(id: string) {
    const start = startOf(id, "full", [], "AUH");
    start.config.greatWar1914Played = [];
    const runner = await newGame(map, start);
    const gw = runner.game.greatWar()!;
    return { gw, seat: gw.s.seats[0] };
  }

  test("the schedule has what the brief asks", () => {
    expect(count("visit")).toBe(14);
    expect(count("letter")).toBe(6);
    // ww193: the inquiry became the foreign office's task (content/depts).
    expect(count("order")).toBe(7);
    expect(count("ceremony")).toBe(4);
    expect(AUH_ACTS.filter((a) => a.trip === true)).toHaveLength(3);
    expect(count("speech")).toBe(6);
    expect(count("intrigue")).toBe(6);
    expect(AUH_AIMS).toHaveLength(6);
    for (const a of AUH_ACTS.filter((x) => x.kind === "intrigue")) {
      expect(a.caught, a.id).toBeDefined();
    }
  });

  test("every inspection shows at least two states", () => {
    for (const a of AUH_ACTS.filter((x) => x.kind === "visit")) {
      const s = AUH_ACT_SCENES.find((x) => x.id === a.scene)!;
      expect(s.variants.length, a.id).toBeGreaterThanOrEqual(2);
    }
  });

  test("every big scene ends on a silent card and decides something", () => {
    const bigs = AUH_STORY_SCENES.filter((s) => s.big === true);
    expect(bigs.length).toBeGreaterThanOrEqual(6);
    for (const s of bigs) {
      expect(gwSceneProblems(s)).toEqual([]);
      const last = s.after?.[s.after.length - 1];
      expect(last?.when, s.id).toBeUndefined();
      const replies = Object.values(s.nodes!).flatMap((n) => n.replies);
      expect(
        replies.some((r) => r.kind === "decide" && r.effects.length > 0),
        s.id,
      ).toBe(true);
    }
  });

  test("each rival has signs, a gathering and a clash with all three answers", () => {
    const rows = GW_RIVAL_ROWS.AUH!;
    expect(rows.length).toBeGreaterThanOrEqual(4);
    for (const who of rows.map((x) => x.replace("auh_", ""))) {
      expect(story(`auh_rv_${who}_sign1`).kind).toBe("wire");
      expect(story(`auh_rv_${who}_sign2`).kind).toBe("wire");
      for (const stage of ["gather", "clash"]) {
        const ids = story(`auh_rv_${who}_${stage}`).options!.map((o) => o.id);
        expect(ids).toEqual(["embrace", "push", "strike"]);
      }
    }
  });

  test("the rival is never named as one before the memoir", async () => {
    const pack = await loadGwPack("AUH", json);
    for (const s of AUH_STORY_SCENES.filter((x) =>
      x.id.startsWith("auh_rv_"),
    )) {
      const t = pack.scenes[s.id];
      expect(`${t.title} ${String(t.brief)}`).not.toMatch(/라이벌|맞수|적수/);
    }
    for (const id of GW_RIVAL_ROWS.AUH!) {
      expect(pack.rivals?.[id]?.broken, id).toBeTruthy();
      expect(pack.rivals?.[id]?.stage1, id).toBeTruthy();
    }
  });

  test("ten of the papers most often on the desk have a line of their own", async () => {
    const pack = await loadGwPack("AUH", json);
    const back = Object.values(pack.scenes).filter((t) => t.back !== undefined);
    expect(back.length).toBeGreaterThanOrEqual(10);
    for (const t of back) expect(t.back?.dug, t.title).toBeTruthy();
  });

  test("a first game opens on the three, inside the first chapter", async () => {
    const { gw, seat } = await firstGame("auh_first");
    const desk = seat.desk.map((c) => c.scene);
    expect(desk).toContain("auh_c_ischl_wire");
    expect(desk).toContain("auh_open_three");
    expect(desk.length).toBeLessThanOrEqual(2);
    expect(gw.s.chapter).toBe(0);
  });

  test("a later game does not", async () => {
    const start = startOf("auh_later", "full", [], "AUH");
    start.config.greatWar1914Played = ["AUH"];
    const runner = await newGame(map, start);
    const seat = runner.game.greatWar()!.s.seats[0];
    expect(seat.desk.map((c) => c.scene)).not.toContain("auh_open_three");
  });

  /** A game in `month`, at war with Russia, the last battle in the east as given. */
  async function inTheWar(month: [number, number], battle?: Partial<GwBattle>) {
    const { gw, seat } = await firstGame(`auh_war_${month.join("_")}`);
    // Since ww170 RA these cards ask the war's age, not the year: the war
    // began in August 1914, and this chapter is `month`.
    const rows = gwChapters(gw.s.calendar);
    const at = (y: number, m: number) =>
      rows.findIndex((c) => c.day >= daysFromCivil(y, m, 1));
    gw.s.chapter = at(month[0], month[1]);
    gw.s.day = daysFromCivil(month[0], month[1], 15);
    gw.s.warChapter = at(1914, 8);
    const n = gw.nation("AUH")!;
    n.side = "central";
    n.atWar = ["RUS"];
    n.entered = gw.s.warChapter;
    if (battle !== undefined) {
      gw.s.battles.push({
        theatre: "east",
        chapter: gw.s.chapter,
        result: "repelled",
        by: "entente",
        lost: [0, 0],
        line: 0,
        luck: 0,
        ...battle,
      });
    }
    return { gw, seat, ctx: { gw, seat, cast: {} } };
  }

  test("the birthday comes when a Russian attack broke the line in summer 1916", async () => {
    const when = story("auh_big_birthday").when!;
    const broke = await inTheWar([1916, 6], { result: "break" });
    expect(holds(broke.ctx, when)).toBe(true);
    const pushed = await inTheWar([1916, 6], { result: "advance" });
    expect(holds(pushed.ctx, when)).toBe(true);
  });

  test("an attack that broke nothing, our own, or one out of time does not bring it", async () => {
    const when = story("auh_big_birthday").when!;
    for (const result of ["repelled", "stalemate"] as const) {
      const held = await inTheWar([1916, 6], { result });
      expect(holds(held.ctx, when), result).toBe(false);
    }
    const ours = await inTheWar([1916, 6], {
      result: "break",
      by: "central",
    });
    expect(holds(ours.ctx, when)).toBe(false);
    const late = await inTheWar([1916, 9], { result: "break" });
    expect(holds(late.ctx, when)).toBe(false);
  });

  test("a letter written comes out in 1918, with or without the denial", async () => {
    const when = story("auh_big_honour").when!;
    const { seat, ctx } = await inTheWar([1918, 2]);
    seat.flags.push("w_auh_karl");
    expect(holds(ctx, when)).toBe(false);
    seat.flags.push("f_auh_letter_general");
    expect(holds(ctx, when)).toBe(true);
  });

  test("the Ischl night can be dealt and its signature stands for the card", async () => {
    const { gw, seat } = await firstGame("auh_ischl");
    seat.flags.push("f_auh_broke_off");
    gw.s.crisis = "balkan";
    const due = deskCandidates(gw, seat).map((c) => c.scene.id);
    expect(due).toContain("auh_big_ischl");
    const sign = story("auh_big_ischl").nodes!.n5.replies[0];
    const card = GW_CONTENT.scenes
      .find((s) => s.id === "auh_c_war_serbia")!
      .options!.find((o) => o.id === "sign")!;
    expect(sign.tell).toEqual(card.tell);
    expect(JSON.stringify(sign.effects)).toContain("f_auh_declared");
    expect(JSON.stringify(sign.effects)).toContain("auh_c_war_serbia");
    expect(() => dealDesk(gw, seat)).not.toThrow();
  });
});
