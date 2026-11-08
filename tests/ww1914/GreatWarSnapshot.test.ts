import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { StampedIntent } from "@openfront/engine-api/Schemas";
import {
  createGameRunnerFromSnapshot,
  GameRunner,
} from "@openfront/engine/GameRunner";
import { snapshotGame } from "@openfront/engine/snapshot/GameSnapshot";
import { GreatWarSnapshot } from "@openfront/engine/ww1914/GreatWar";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { TestDataMapLoader } from "../util/ScriptedGame";
import { diffSnapshots } from "../util/Snapshot";
import { MINI, stamped, step, wwGameStart } from "../ww1936/util";
import { gwRunner, HUMAN, order, playChapter, seat, view } from "./util";

const hash = (r: GameRunner) =>
  (r.game as unknown as { hash(): number }).hash();

async function restore(r: GameRunner): Promise<GameRunner> {
  return createGameRunnerFromSnapshot(
    wwGameStart({ greatWar1914: true }, [{ clientID: HUMAN, country: "DEU" }]),
    r.snapshot(),
    undefined,
    await loadMapFiles(
      new TestDataMapLoader(MINI),
      GameMapType.World1936,
      GameMapSize.Normal,
    ),
    () => {},
  );
}

// The pin of a short game. It moves with every change to the mode's rules or
// content: re-pin it here when that is intended. Never WW1936_DIGEST for this.
const GW_DIGEST = "12b9a8e05504391d";

describe("snapshot and hash", () => {
  test("the state is a versioned record", () => {
    expect(GreatWarSnapshot.version).toBe(2);
  });

  test("a restored game is the same game, mid-talk and through the end", async () => {
    const { runner } = await gwRunner();
    playChapter(runner);
    // Whoever can be called: this test is about the talk, not the content.
    const person = seat(runner).people.find((p) => p.topics.length > 0)!;
    order(runner, {
      kind: "summon",
      person: person.id,
      topic: person.topics[0],
    });
    const copy = await restore(runner);
    expect(diffSnapshots(runner.snapshot(), copy.snapshot())).toEqual([]);
    expect(hash(copy)).toBe(hash(runner));
    const card = seat(runner).desk.find((c) => c.kind === "talk")!;
    const open = card.replies.filter((r) => r.open);
    const reply = (open.find((r) => r.kind === "leave") ?? open[0]).id;
    const turns: StampedIntent[][] = [
      [
        stamped(HUMAN, {
          type: "gw_order",
          order: { kind: "reply", card: card.uid, reply },
        }),
      ],
      [
        stamped(HUMAN, {
          type: "gw_order",
          order: { kind: "ready", chapter: view(runner).chapter, on: true },
        }),
      ],
      [],
      [],
    ];
    for (const t of turns) {
      step(runner, 1, t);
      step(copy, 1, t);
      expect(hash(copy)).toBe(hash(runner));
    }
    expect(view(copy)).toEqual(view(runner));
    expect(
      diffSnapshots(snapshotGame(runner.game), snapshotGame(copy.game)),
    ).toEqual([]);
  });

  test("a game restored in the middle of the war plays on the same", async () => {
    const { runner } = await gwRunner();
    const gw = runner.game.greatWar()!;
    gw.s.chain = null;
    gw.s.spark = null;
    while (gw.s.chapter < 5) playChapter(runner);
    gw.s.chain = { topic: "balkan", step: 5, hold: 0, short: false };
    gw.s.temp = 9;
    for (let i = 0; i < 3; i++) playChapter(runner);
    expect(gw.s.battles.length).toBeGreaterThan(0);
    const copy = await restore(runner);
    expect(hash(copy)).toBe(hash(runner));
    while (view(runner).ended === null) {
      playChapter(runner);
      playChapter(copy);
      expect(hash(copy)).toBe(hash(runner));
    }
    expect(view(copy)).toEqual(view(runner));
  }, 60000);

  test("the hash sees the state", async () => {
    const { runner } = await gwRunner();
    const before = hash(runner);
    runner.game.greatWar()!.s.temp++;
    expect(hash(runner)).not.toBe(before);
  });

  test("a short game's digest is pinned and repeats", async () => {
    const play = async () => {
      const { runner } = await gwRunner({}, "GWDIGEST");
      const h = createHash("sha256");
      while (view(runner).ended === null) {
        playChapter(runner);
        h.update(`${hash(runner)},`);
      }
      return h.digest("hex").slice(0, 16);
    };
    const first = await play();
    expect(await play()).toBe(first);
    expect(first).toBe(GW_DIGEST);
  }, 60000);
});
