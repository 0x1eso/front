import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import {
  GwPackSchema,
  gwPackProblems,
} from "@openfront/engine-api/ww1914/GwPack";
import {
  gwContentProblems,
  gwSceneConds,
  gwSceneEffects,
} from "@openfront/engine-api/ww1914/SceneCheck";
import { gwSceneProblems } from "@openfront/engine-api/ww1914/SceneDsl";
import { GW_CONTENT } from "@openfront/engine-lib/ww1914/content/Content";
import {
  FRA_PRIVATE_PEOPLE,
  FRA_PRIVATE_SCENES,
  FRA_PRIVATE_VOICE_NOTES,
} from "@openfront/engine-lib/ww1914/content/scenes/fra_private";
import { openTopics } from "@openfront/engine/ww1914/Orders";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import { loadGwPack } from "@openfront/shared/ww1914/GwPackLoader";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { newGame, startOf } from "./sim/GwSim";

const res = (p: string) => path.join(__dirname, "../../resources", p);
const json = (p: string): unknown =>
  JSON.parse(fs.readFileSync(res(p), "utf8"));
const own = GwPackSchema.parse(json("ww1914/ko/FRA.private.json"));
const cast = GwPackSchema.parse(json("ww1914/ko/FRA.people.json"));

describe("the President's private life", () => {
  test("every scene passes the scene check and shows no result first", () => {
    for (const s of FRA_PRIVATE_SCENES) {
      expect(gwSceneProblems(s), s.id).toEqual([]);
      for (const o of s.options ?? []) expect(o.tell, s.id).toEqual([]);
      for (const n of Object.values(s.nodes ?? {})) {
        for (const r of n.replies) expect(r.tell, s.id).toEqual([]);
      }
    }
  });

  test("every line has its text and brief, and no reference is lost", async () => {
    const pack = await loadGwPack("FRA", async (p) => json(p));
    expect(gwPackProblems(FRA_PRIVATE_SCENES, own)).toEqual([]);
    for (const s of FRA_PRIVATE_SCENES) {
      expect(own.scenes[s.id].brief, s.id).toBeTruthy();
    }
    const fra = GW_CONTENT.scenes.filter((s) => s.id.startsWith("fra_p_"));
    expect(gwPackProblems(fra, pack)).toEqual([]);
    const mine = new Set(FRA_PRIVATE_SCENES.map((s) => s.id));
    const problems = gwContentProblems(GW_CONTENT.scenes, GW_CONTENT.people);
    expect(problems.filter((x) => mine.has(x.split(":")[0]))).toEqual([]);
  });

  test("everything is tagged private, and the lines remember", () => {
    for (const s of FRA_PRIVATE_SCENES) {
      expect(s.tags, s.id).toContain("private");
      expect(s.nation).toEqual(["FRA"]);
    }
    const written = new Set(
      FRA_PRIVATE_SCENES.flatMap((s) => gwSceneEffects(s))
        .filter((e) => e.kind === "remember")
        .map((e) => (e.kind === "remember" ? e.key : "")),
    );
    const read = new Set(
      GW_CONTENT.scenes
        .flatMap((s) => gwSceneConds(s))
        .filter((c) => c.kind === "memory")
        .map((c) => (c.kind === "memory" ? c.key : "")),
    );
    expect([...written].filter((k) => read.has(k)).length).toBeGreaterThan(20);
  });

  test("the family has a source, a voice and a name", () => {
    for (const p of FRA_PRIVATE_PEOPLE) {
      expect(p.source.length).toBeGreaterThan(20);
      expect(p.office).toBeNull();
      expect(p.camps).toEqual([]);
      expect(FRA_PRIVATE_VOICE_NOTES[p.id], p.id).toBeTruthy();
      expect(cast.people[p.id]?.name, p.id).toBeTruthy();
    }
  });

  test("at the start nobody's private talk is open: each line opens with a visit", async () => {
    const map = await loadMapFiles(
      new NodeGameMapLoader(path.join(__dirname, "../../resources/maps")),
      GameMapType.World1936,
      GameMapSize.Normal,
    );
    const runner = await newGame(map, startOf("private", "full", [], "FRA"));
    const gw = runner.game.greatWar()!;
    const seat = gw.s.seats[0];
    expect(seat.tag).toBe("FRA");
    for (const who of ["fra_henriette", "fra_lucien", "fra_barthou"]) {
      const mine = openTopics(gw, seat, who, true).filter((t) =>
        t.startsWith("fra_p_"),
      );
      expect(mine, who).toEqual([]);
    }
  }, 60000);
});
