import { GameType } from "@openfront/engine-api/game/GameTypes";
import { GwPack, gwPackProblems } from "@openfront/engine-api/ww1914/GwPack";
import { gwSceneProblems } from "@openfront/engine-api/ww1914/SceneDsl";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { GBR_PRIVATE_SCENES } from "@openfront/engine-lib/ww1914/content/scenes/gbr_private";
import { castOf, holds } from "@openfront/engine/ww1914/SceneRun";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { HUMAN, step, wwRunnerCapture } from "../ww1936/util";
import { order, seat } from "./util";

const read = (name: string): GwPack =>
  JSON.parse(
    fs.readFileSync(
      path.join(__dirname, `../../resources/ww1914/ko/${name}.json`),
      "utf8",
    ),
  );

async function britain() {
  const { runner } = await wwRunnerCapture(
    { greatWar1914: true, gameType: GameType.Singleplayer },
    [{ clientID: HUMAN, country: "GBR" }],
  );
  step(runner, 2);
  const gw = runner.game.greatWar()!;
  return { runner, gw, st: gw.s.seats[0] };
}

const inGame = (id: string) => gwContent().scenes.find((s) => s.id === id)!;

describe("Britain, private stories", () => {
  test("ten lines of four to six scenes, all in the pack", () => {
    const lines = new Map<string, number>();
    for (const s of GBR_PRIVATE_SCENES) {
      expect(gwSceneProblems(s), s.id).toEqual([]);
      expect(s.tags, s.id).toContain("private");
      const line = s.id.split("_")[2];
      lines.set(line, (lines.get(line) ?? 0) + 1);
    }
    expect(gwPackProblems(GBR_PRIVATE_SCENES, read("GBR.private"))).toEqual([]);
    // The King's scenes and Churchill's belong to lines named for others.
    const of = (x: string) => lines.get(x) ?? 0;
    expect(of("stam") + of("king")).toBe(6);
    expect(of("clem") + of("chu")).toBe(6);
    for (const x of [
      "grey",
      "hal",
      "bir",
      "louis",
      "law",
      "lg",
      "red",
      "hen",
    ]) {
      expect(of(x), x).toBeGreaterThanOrEqual(4);
      expect(of(x), x).toBeLessThanOrEqual(6);
    }
  });

  test("what a line remembers, work scenes have a line for", () => {
    const packs = ["GBR.crisis", "GBR.home", "GBR.world", "GBR.war"].map(read);
    const fresh = gwContent().scenes.filter(
      (s) => s.nation.includes("GBR") && !s.id.startsWith("gbr_p_"),
    );
    const scenes = Object.assign({}, ...packs.map((p) => p.scenes));
    let lines = 0;
    for (const s of fresh) {
      for (const v of s.variants.filter((x) => x.id.startsWith("p_"))) {
        expect(scenes[s.id].text[v.id], `${s.id}.${v.id}`).toBeDefined();
        lines++;
      }
      for (const [id, n] of Object.entries(s.nodes ?? {})) {
        for (const v of n.says.filter((x) => x.id.startsWith("p_"))) {
          const t = scenes[s.id].nodes[id].says[v.id];
          expect(t, `${s.id}.${id}.${v.id}`).toBeDefined();
          lines++;
        }
      }
    }
    expect(lines).toBeGreaterThanOrEqual(25);
  });

  test("a line opens and closes on what the player did", async () => {
    const { runner, gw, st } = await britain();
    const when = (id: string) => {
      const s = inGame(id);
      return holds({ gw, seat: st, cast: castOf(gw, st, s)! }, s.when!);
    };
    expect(when("gbr_p_grey_wagoner")).toBe(true);
    order(runner, {
      kind: "summon",
      person: "gbr_grey",
      topic: "gbr_p_grey_wagoner",
    });
    const card = seat(runner).desk.find(
      (c) => c.scene === "gbr_p_grey_wagoner",
    )!;
    order(runner, { kind: "reply", card: card.uid, reply: "ask" });
    expect(st.memory.some((m) => m.key === "m_p_grey_told")).toBe(true);
    // The chair goes elsewhere: Asquith's life stops with it.
    st.flags.push("f_pm_lg");
    expect(when("gbr_p_grey_wagoner")).toBe(false);
  });

  test("the sober answer comes to the man who went to the funeral", async () => {
    const { gw, st } = await britain();
    const s = inGame("gbr_v_birrell_warn");
    const ask = s.nodes!.open.replies.find((r) => r.id === "ask")!;
    const c = { gw, seat: st, cast: castOf(gw, st, s)! };
    expect(holds(c, ask.reacts![0].when)).toBe(false);
    st.memory.push({
      key: "m_p_bir_funeral",
      who: null,
      chapter: 0,
      weight: 1,
    });
    expect(holds(c, ask.reacts![0].when)).toBe(true);
    expect(ask.reacts![0].next).toBe("sober");
  });
});
