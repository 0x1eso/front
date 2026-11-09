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
import { GW_ACT_SPOTS } from "@openfront/engine-lib/ww1914/ActSpots";
import { GW_CONTENT } from "@openfront/engine-lib/ww1914/content/Content";
import {
  FRA_ACT_SCENES,
  FRA_ACTS,
  FRA_AIMS,
} from "@openfront/engine-lib/ww1914/content/acts/fra";
import { FRA_STORY_SCENES } from "@openfront/engine-lib/ww1914/content/scenes/fra_act";
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

const MINE = [...FRA_ACT_SCENES, ...FRA_STORY_SCENES];

async function france(played?: string[]) {
  const { runner } = await wwRunnerCapture(
    {
      greatWar1914: true,
      gameType: GameType.Singleplayer,
      ...(played === undefined ? {} : { greatWar1914Played: played }),
    },
    [{ clientID: HUMAN, country: "FRA" }],
  );
  step(runner, 2);
  return runner;
}

describe("France's own schedule and story (W8)", () => {
  test("the plan's counts", () => {
    const kind = (k: string) => FRA_ACTS.filter((a) => a.kind === k).length;
    expect(kind("visit")).toBe(14);
    expect(kind("letter")).toBe(6);
    expect(kind("order")).toBe(8);
    expect(kind("speech")).toBe(6);
    expect(kind("intrigue")).toBe(6);
    expect(FRA_AIMS.length).toBe(6);
  });

  test("scenes, entries and references hold", () => {
    const scenes = new Map(GW_CONTENT.scenes.map((s) => [s.id, s]));
    for (const s of MINE) {
      expect(() => GwSceneSchema.parse(s), s.id).not.toThrow();
      expect(gwSceneProblems(s)).toEqual([]);
    }
    expect(FRA_ACTS.flatMap((a) => gwActProblems(a, scenes))).toEqual([]);
    const called = FRA_ACTS.flatMap((a) => [
      a.scene,
      ...(a.caught === undefined ? [] : [a.caught.scene]),
    ]);
    const mine = new Set(MINE.map((s) => s.id));
    const problems = gwContentProblems(
      GW_CONTENT.scenes,
      GW_CONTENT.people,
      called,
    ).filter((p) => mine.has(p.split(/[:.]/)[0]));
    expect(problems).toEqual([]);
  });

  test("the packs have every line, and every scene but a silent card a note", async () => {
    const pack = await loadGwPack("FRA", read);
    GwPackSchema.parse(await read("ww1914/ko/FRA.act.json"));
    GwPackSchema.parse(await read("ww1914/ko/FRA.acts.json"));
    expect(gwPackProblems(MINE, pack)).toEqual([]);
    expect(gwActPackProblems(FRA_ACTS, FRA_AIMS, pack)).toEqual([]);
    for (const s of MINE) {
      if (s.silent === true) continue;
      expect(pack.scenes[s.id].brief, s.id).toBeTruthy();
    }
    for (const id of ["fra_clemenceau", "fra_joffre", "fra_caillaux"]) {
      expect(pack.rivals?.[id]?.broken, id).toBeTruthy();
    }
  });

  test("no option shows a result before the pick", () => {
    for (const s of MINE) {
      for (const o of s.options ?? [])
        expect(o.tell, `${s.id}.${o.id}`).toEqual([]);
      for (const n of Object.values(s.nodes ?? {})) {
        for (const r of n.replies)
          expect(r.tell, `${s.id}.${r.id}`).toEqual([]);
      }
    }
    for (const a of FRA_ACTS) expect(a.tell, a.id).toBeUndefined();
  });

  test("nothing before the memoir names the rival", async () => {
    const pack = await loadGwPack("FRA", read);
    for (const s of MINE.filter((x) => x.id.startsWith("fra_r_"))) {
      const t = pack.scenes[s.id];
      expect(`${t.title}${String(t.brief)}`, s.id).not.toMatch(
        /경쟁|정적|라이벌/,
      );
    }
  });

  test("each seat secret has a way to be found", () => {
    const found = new Set<string>();
    const walk = (x: unknown) => {
      if (x !== null && typeof x === "object") {
        const o = x as Record<string, unknown>;
        if (o.do === "reveal" && typeof o.id === "string") found.add(o.id);
        Object.values(o).forEach(walk);
      }
    };
    walk(FRA_ACTS);
    expect([...found].sort()).toEqual([
      "fra_bolo_money",
      "fra_rubicon_papers",
      "fra_toul_verdun",
    ]);
  });

  test("the opening's picks open the plan's keys for the crisis papers", () => {
    const first = FRA_STORY_SCENES.find((s) => s.id === "fra_o_first")!;
    const keys = first.nodes!.n5.replies.flatMap((r) =>
      r.effects.flatMap((e) => (e.kind === "remember" ? [e.key] : [])),
    );
    for (const k of ["k_viv_bargain", "k_jof_cover", "k_berth_desk"]) {
      expect(keys, k).toContain(k);
    }
  });

  test("the places start France's visits, speeches and letters", () => {
    const spots = new Set(GW_ACT_SPOTS.map((s) => s.act));
    for (const a of FRA_ACTS) {
      if (a.kind === "visit") expect(spots.has(a.id), a.id).toBe(true);
    }
    expect(spots.has("fra_a_l_georgie")).toBe(true);
  });

  test("a first game opens on the Sunday evening at the Élysée", async () => {
    const r = await france([]);
    expect(seat(r).desk.map((c) => c.scene)[0]).toBe("fra_o_first");
    expect(view(r).chapter).toBe(0);
  });

  test("a nation on the shelf doesn't", async () => {
    const r = await france(["FRA"]);
    expect(seat(r).desk.map((c) => c.scene)).not.toContain("fra_o_first");
  });

  test("a letter to London comes back as the King's answer", async () => {
    const r = await france();
    order(r, {
      kind: "act",
      act: "fra_a_l_georgie",
      picks: ["visit", "warm"],
    });
    playChapter(r);
    const card = seat(r).desk.find((c) => c.scene === "fra_a_l_georgie_r");
    expect(card, "reply on the desk").toBeDefined();
    expect(["visit_fit", "base"]).toContain(card!.variant);
  });

  test("two ministers set on each other show in the card", async () => {
    const r = await france();
    const a = seat(r).acts!.find((x) => x.id === "fra_a_i_set_on")!;
    const [one, two] = a.fields[0].people;
    order(r, { kind: "act", act: "fra_a_i_set_on", picks: [one, two] });
    playChapter(r);
    const card = seat(r).desk.find((c) => c.scene === "fra_a_i_set_on_r");
    expect(card!.cast.a).toBe(one);
    expect(card!.cast.b).toBe(two);
  });

  test("the schedule opens with what a President can do in peace", async () => {
    const r = await france();
    const ids = seat(r).acts!.map((a) => a.id);
    expect(ids).toContain("fra_a_barleduc");
    expect(ids).toContain("fra_a_l_nicky");
    expect(ids).toContain("fra_a_o_council");
    expect(ids).not.toContain("fra_a_chantilly");
    expect(ids).not.toContain("fra_a_s_strasbourg");
  });
});
