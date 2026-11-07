import { GameType } from "@openfront/engine-api/game/GameTypes";
import { GwPack, gwPackProblems } from "@openfront/engine-api/ww1914/GwPack";
import { gwSceneProblems } from "@openfront/engine-api/ww1914/SceneDsl";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import {
  GBR_ECHOES,
  GBR_PROLOGUE_SCENES,
} from "@openfront/engine-lib/ww1914/content/scenes/gbr_prologue";
import type { GameRunner } from "@openfront/engine/GameRunner";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { HUMAN, step, wwRunnerCapture } from "../ww1936/util";
import { order, seat, view } from "./util";

const pack = (): GwPack =>
  JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../../resources/ww1914/ko/GBR.prologue.json"),
      "utf8",
    ),
  );

async function britain(play: boolean, picks: string[] = []) {
  const { runner } = await wwRunnerCapture(
    {
      greatWar1914: true,
      gameType: GameType.Singleplayer,
      greatWar1914Prologue: { play, picks },
    },
    [{ clientID: HUMAN, country: "GBR" }],
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

describe("Britain, the prologue", () => {
  test("seven scenes, whole, each with its date", () => {
    const row = GBR_PROLOGUE_SCENES.filter((s) => s.prologue !== undefined);
    expect(row.map((s) => s.prologue)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const s of GBR_PROLOGUE_SCENES) {
      expect(gwSceneProblems(s), s.id).toEqual([]);
    }
    expect(GBR_ECHOES.length).toBeGreaterThanOrEqual(15);
  });

  test("every echo has its text in the pack, on a scene of Britain", () => {
    const { over } = pack();
    for (const e of GBR_ECHOES) {
      const scene = gwContent().scenes.find((s) => s.id === e.scene)!;
      expect(scene.nation, e.scene).toEqual(["GBR"]);
      const o = over![e.scene];
      const text =
        e.node === undefined ? o.text?.[e.id] : o.nodes?.[e.node]?.says?.[e.id];
      expect(text, `${e.scene}.${e.node}.${e.id}`).toBeTruthy();
    }
  });

  test("played to the end on either side, the telegram opens", async () => {
    for (const pick of [() => 0, (n: number) => n - 1]) {
      const r = await britain(true);
      expect(seat(r).desk[0].scene).toBe("gbr_pro_ledger");
      live(r, pick);
      expect(seat(r).prologue).toMatchObject({ done: true });
      expect(view(r).chapter).toBe(0);
      expect(seat(r).desk.length).toBeGreaterThan(0);
      expect(raw(r).prologue?.temper).not.toBeNull();
    }
  }, 60000);

  test("a skip with the same picks leaves the same man", async () => {
    const played = await britain(true);
    live(played, (n) => n - 1);
    const skipped = await britain(false, [...seat(played).prologue!.picks]);
    expect(raw(skipped).prologue).toEqual(raw(played).prologue);
    expect(raw(skipped).flags.filter((f) => f.startsWith("pro_gbr"))).toEqual(
      raw(played).flags.filter((f) => f.startsWith("pro_gbr")),
    );
  }, 60000);

  test("no text is missing for the prologue's own scenes", () => {
    const merged = pack();
    const people = Object.fromEntries(
      GBR_PROLOGUE_SCENES.flatMap((s) =>
        Object.values(s.cast).flatMap((c) =>
          "past" in c ? [[c.past, { name: "x", lean: "x" }]] : [],
        ),
      ),
    );
    expect(
      gwPackProblems(GBR_PROLOGUE_SCENES, {
        ...merged,
        people: { ...people, ...merged.people },
      }),
    ).toEqual([]);
  });
});
