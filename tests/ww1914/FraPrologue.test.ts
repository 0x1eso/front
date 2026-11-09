import { GameType } from "@openfront/engine-api/game/GameTypes";
import { GwPack, gwPackProblems } from "@openfront/engine-api/ww1914/GwPack";
import { gwSceneProblems } from "@openfront/engine-api/ww1914/SceneDsl";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import {
  FRA_ECHOES,
  FRA_PROLOGUE_SCENES,
} from "@openfront/engine-lib/ww1914/content/scenes/fra_prologue";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { loadGwPack } from "@openfront/shared/ww1914/GwPackLoader";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { HUMAN, step, wwRunnerCapture } from "../ww1936/util";
import { order, seat, view } from "./util";

const read = (f: string): GwPack =>
  JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../../resources/ww1914/ko", f),
      "utf8",
    ),
  );
const pack = () => read("FRA.prologue.json");

async function france(play: boolean, picks: string[] = []) {
  const { runner } = await wwRunnerCapture(
    {
      greatWar1914: true,
      gameType: GameType.Singleplayer,
      greatWar1914Prologue: { play, picks },
    },
    [{ clientID: HUMAN, country: "FRA" }],
  );
  step(runner, 2);
  return runner;
}

/** To the end of the years, taking the reply `pick` chooses at each node. */
function live(r: GameRunner, pick: (n: number) => number): void {
  for (let guard = 0; guard < 200 && seat(r).prologue?.done !== true; guard++) {
    const card = seat(r).desk[0];
    if (card === undefined) {
      step(r, 2);
      continue;
    }
    if (card.silent === true) {
      order(r, { kind: "read", card: card.uid });
      continue;
    }
    const node = gwContent().scenes.find((s) => s.id === card.scene)!.nodes![
      card.node!
    ];
    const reply = node.replies[pick(node.replies.length)];
    order(r, { kind: "reply", card: card.uid, reply: reply.id });
  }
  step(r, 2);
}

const raw = (r: GameRunner) => r.game.greatWar()!.s.seats[0];

describe("France, the prologue", () => {
  test("seven scenes, whole, each with its date", () => {
    const row = FRA_PROLOGUE_SCENES.filter((s) => s.prologue !== undefined);
    expect(row.map((s) => s.prologue)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const s of FRA_PROLOGUE_SCENES) {
      expect(gwSceneProblems(s), s.id).toEqual([]);
    }
    expect(FRA_ECHOES.length).toBeGreaterThanOrEqual(15);
  });

  test("every echo has its text in the pack, on a scene of France", () => {
    const { over } = pack();
    for (const e of FRA_ECHOES) {
      const scene = gwContent().scenes.find((s) => s.id === e.scene)!;
      expect(scene.nation, e.scene).toEqual(["FRA"]);
      const o = over![e.scene];
      const text =
        e.node === undefined ? o.text?.[e.id] : o.nodes?.[e.node]?.says?.[e.id];
      expect(text, `${e.scene}.${e.node}.${e.id}`).toBeTruthy();
    }
  });

  test("no text is missing, and every brief is there", async () => {
    const res = (p: string) =>
      JSON.parse(
        fs.readFileSync(path.join(__dirname, "../../resources", p), "utf8"),
      );
    const merged = await loadGwPack("FRA", async (p) => res(p));
    expect(gwPackProblems(FRA_PROLOGUE_SCENES, merged)).toEqual([]);
    for (const s of FRA_PROLOGUE_SCENES) {
      if (s.prologue !== undefined) {
        expect(merged.scenes[s.id].brief, s.id).toBeTruthy();
      }
    }
  });

  test("played to the end on either side, the first card opens", async () => {
    for (const pick of [() => 0, (n: number) => n - 1]) {
      const r = await france(true);
      expect(seat(r).desk[0].scene).toBe("fra_pro_bismarck");
      live(r, pick);
      expect(seat(r).prologue).toMatchObject({ done: true });
      expect(view(r).chapter).toBe(0);
      expect(seat(r).desk.length).toBeGreaterThan(0);
      expect(raw(r).prologue?.temper).not.toBeNull();
    }
  }, 60000);

  test("a skip with the same picks leaves the same man", async () => {
    const played = await france(true);
    live(played, (n) => n - 1);
    const skipped = await france(false, [...seat(played).prologue!.picks]);
    expect(raw(skipped).prologue).toEqual(raw(played).prologue);
    expect(raw(skipped).flags.filter((f) => f.startsWith("pro_fra"))).toEqual(
      raw(played).flags.filter((f) => f.startsWith("pro_fra")),
    );
  }, 60000);
});
