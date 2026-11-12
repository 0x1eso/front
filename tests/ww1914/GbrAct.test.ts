import { GameType } from "@openfront/engine-api/game/GameTypes";
import {
  gwActPackProblems,
  gwActProblems,
} from "@openfront/engine-api/ww1914/GwActs";
import {
  gwPackProblems,
  GwPackSchema,
} from "@openfront/engine-api/ww1914/GwPack";
import { gwContentProblems } from "@openfront/engine-api/ww1914/SceneCheck";
import {
  gwSceneProblems,
  GwSceneSchema,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { GW_CONTENT } from "@openfront/engine-lib/ww1914/content/Content";
import {
  GBR_ACT_SCENES,
  GBR_ACTS,
  GBR_AIMS,
} from "@openfront/engine-lib/ww1914/content/acts/gbr";
import { loadGwPack } from "@openfront/shared/ww1914/GwPackLoader";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { HUMAN, step, wwRunnerCapture } from "../ww1936/util";
import { order, playChapter, seat, view } from "./util";

const read = async (f: string) =>
  JSON.parse(
    fs.readFileSync(path.join(__dirname, "../../resources", f), "utf8"),
  ) as unknown;

async function britain(played?: string[]) {
  const { runner } = await wwRunnerCapture(
    {
      greatWar1914: true,
      gameType: GameType.Singleplayer,
      ...(played === undefined ? {} : { greatWar1914Played: played }),
    },
    [{ clientID: HUMAN, country: "GBR" }],
  );
  step(runner, 2);
  return runner;
}

describe("Britain's own schedule and story", () => {
  test("the brief's counts", () => {
    const kind = (k: string) => GBR_ACTS.filter((a) => a.kind === k).length;
    expect(kind("visit")).toBe(14);
    expect(kind("letter")).toBe(6);
    expect(kind("order")).toBe(8); // ww196: inquiry and commission are back
    expect(kind("speech")).toBe(6);
    expect(kind("intrigue")).toBe(6);
    expect(GBR_AIMS.length).toBeGreaterThanOrEqual(6);
    const bigs = GBR_ACT_SCENES.filter((s) => s.big === true);
    expect(bigs.length).toBeGreaterThanOrEqual(7);
    for (const s of bigs) expect(s.after?.length, s.id).toBeGreaterThan(0);
  });

  test("scenes, entries and references hold", () => {
    const scenes = new Map(GW_CONTENT.scenes.map((s) => [s.id, s]));
    for (const s of GBR_ACT_SCENES) {
      expect(() => GwSceneSchema.parse(s), s.id).not.toThrow();
      expect(gwSceneProblems(s)).toEqual([]);
    }
    expect(GBR_ACTS.flatMap((a) => gwActProblems(a, scenes))).toEqual([]);
    // Entries call the scenes the schedule plays.
    const called = GBR_ACTS.flatMap((a) => [
      a.scene,
      ...(a.caught === undefined ? [] : [a.caught.scene]),
    ]);
    const mine = new Set(GBR_ACT_SCENES.map((s) => s.id));
    const problems = gwContentProblems(
      GW_CONTENT.scenes,
      GW_CONTENT.people,
      called,
    ).filter((p) => mine.has(p.split(/[:.]/)[0]));
    expect(problems).toEqual([]);
  });

  test("the pack has every line, and no scene but a silent card lacks a note", async () => {
    const pack = await loadGwPack("GBR", read);
    GwPackSchema.parse(await read("ww1914/ko/GBR.act.json"));
    expect(gwPackProblems([...GBR_ACT_SCENES], pack)).toEqual([]);
    expect(gwActPackProblems(GBR_ACTS, GBR_AIMS, pack)).toEqual([]);
    for (const s of GBR_ACT_SCENES) {
      if (s.silent === true) continue;
      expect(pack.scenes[s.id].brief, s.id).toBeTruthy();
    }
  });

  test("nothing before the memoir names the rival", async () => {
    const pack = await loadGwPack("GBR", read);
    for (const s of GBR_ACT_SCENES.filter((x) => x.id.startsWith("gbr_r_"))) {
      const t = pack.scenes[s.id];
      expect(`${t.title}${String(t.brief)}`, s.id).not.toMatch(
        /경쟁|정적|라이벌/,
      );
    }
  });

  test("a first game opens on the night in Downing Street", async () => {
    const r = await britain([]);
    const desk = seat(r).desk.map((c) => c.scene);
    expect(desk[0]).toBe("gbr_big_first");
    expect(view(r).chapter).toBe(0);
  });

  test("a first game's three chapters bring the three and one more", async () => {
    const r = await britain([]);
    const met = new Set<string>();
    for (let i = 0; i < 3; i++) {
      for (const c of seat(r).desk) {
        for (const id of Object.values(c.cast)) met.add(id);
      }
      playChapter(r);
    }
    expect(view(r).chapter).toBe(3);
    expect([...met].sort()).toEqual([
      "gbr_birrell",
      "gbr_churchill",
      "gbr_grey",
      "gbr_lloyd_george",
    ]);
  });

  test("a nation on the shelf doesn't", async () => {
    const r = await britain(["GBR"]);
    expect(seat(r).desk.map((c) => c.scene)).not.toContain("gbr_big_first");
  });

  test("a letter out comes back as the Tsar's answer, picked subject and all", async () => {
    const r = await britain();
    order(r, { kind: "act", act: "gbr_a_l_nicky", picks: ["family", "warm"] });
    playChapter(r);
    const card = seat(r).desk.find((c) => c.scene === "gbr_a_l_nicky_r");
    expect(card, "reply on the desk").toBeDefined();
    expect(["family_fit", "base"]).toContain(card!.variant);
  });

  test("two ministers set on each other show in the card", async () => {
    const r = await britain();
    const a = seat(r).acts!.find((x) => x.id === "gbr_a_i_set_on")!;
    const [one, two] = a.fields[0].people;
    order(r, { kind: "act", act: "gbr_a_i_set_on", picks: [one, two] });
    playChapter(r);
    const card = seat(r).desk.find((c) => c.scene === "gbr_a_i_set_on_r");
    expect(card!.cast.a).toBe(one);
    expect(card!.cast.b).toBe(two);
  });

  test("the schedule opens with entries a Prime Minister can take", async () => {
    const r = await britain();
    const ids = seat(r).acts!.map((a) => a.id);
    expect(ids).toContain("gbr_a_belfast");
    expect(ids).toContain("gbr_a_l_nicky");
    expect(ids).not.toContain("gbr_a_gq");
  });
});
