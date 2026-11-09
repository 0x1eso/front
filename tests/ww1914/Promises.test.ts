import { gwSceneEffects } from "@openfront/engine-api/ww1914/SceneCheck";
import { GW_CONTENT } from "@openfront/engine-lib/ww1914/content/Content";
import { afterEach, describe, expect, test } from "vitest";
import { gwRunner, order, playChapter, seat, view } from "./util";

const scenes = GW_CONTENT.scenes;
const byId = new Map(scenes.map((s) => [s.id, s]));

function everyPromise() {
  return scenes.flatMap((s) =>
    gwSceneEffects(s).flatMap((e) =>
      e.kind === "promise" ? [{ scene: s, promise: e }] : [],
    ),
  );
}

describe("promises come back", () => {
  test("every promise keeps by itself, or has a person who returns", () => {
    for (const { scene, promise } of everyPromise()) {
      const where = `${scene.id}: ${promise.key}`;
      const kept = scenes.some((x) =>
        gwSceneEffects(x).some(
          (e) => e.kind === "keep_promise" && e.key === promise.key,
        ),
      );
      expect(kept || (promise.keep ?? promise.back) !== undefined, where).toBe(
        true,
      );
      if (promise.back !== undefined) {
        const back = byId.get(promise.back);
        expect(back, where).toBeDefined();
      }
    }
  });

  test("a promise with no return can't break: its keep ends in a date", () => {
    const dated = (c: unknown): boolean =>
      JSON.stringify(c).includes("chapter");
    for (const { scene, promise } of everyPromise()) {
      if (promise.back !== undefined) continue;
      // The other countries' keepers can lapse: the person comes back with
      // the common card, which every seat can be dealt.
      if (!/^deu_[cwptvb]_/.test(scene.id)) continue;
      expect(dated(promise.keep), `${scene.id}: ${promise.key}`).toBe(true);
    }
  });

  test("the common card a person comes back with reaches every seat", () => {
    const nation = byId.get("gw_promise_broken")?.nation;
    for (const tag of ["DEU", "GBR", "AUH", "RUS", "FRA"] as const) {
      expect(nation).toContain(tag);
    }
  });

  test("a reply that makes a promise says so", () => {
    for (const s of scenes) {
      for (const n of Object.values(s.nodes ?? {})) {
        for (const r of n.replies) {
          const makes = JSON.stringify(r).includes('"kind":"promise","who"');
          const asks = r.effects.some((e) => e.kind === "promise");
          if (asks && makes) {
            expect(r.tell, `${s.id}.${r.id}`).toContain("promise");
          }
        }
      }
    }
  });
});

describe("a promise in play", () => {
  afterEach(() => {});

  const promised = async () => {
    const { runner } = await gwRunner({}, "GWPROMISE");
    const gw = runner.game.greatWar()!;
    const s = gw.s.seats[0];
    s.promises.push({
      key: "tsch_home",
      who: "deu_tschirschky",
      due: 1,
      kept: false,
      broken: false,
      keep: null,
      back: "deu_b_tsch_home",
    });
    return { runner, gw, s };
  };

  test("called in time it is kept, and the person is told", async () => {
    const { runner, s } = await promised();
    gwTopicIsOpen(runner);
    order(runner, {
      kind: "summon",
      person: "deu_tschirschky",
      topic: "deu_b_tsch_home",
    });
    const card = seat(runner).desk.find((c) => c.scene === "deu_b_tsch_home")!;
    expect(card.says).toBe("base");
    order(runner, { kind: "reply", card: card.uid, reply: "pay" });
    expect(s.promises[0].kept).toBe(true);
  });

  test("left past its date the person comes back and says so", async () => {
    const { runner, s } = await promised();
    playChapter(runner);
    playChapter(runner);
    expect(s.promises[0].broken).toBe(true);
    const card = seat(runner).desk.find((c) => c.scene === "deu_b_tsch_home");
    expect(card?.says).toBe("broken");
    expect(view(runner).ended).toBeNull();
  });
});

function gwTopicIsOpen(runner: Parameters<typeof seat>[0]): void {
  const me = seat(runner).people.find((p) => p.id === "deu_tschirschky");
  expect(me?.topics).toContain("deu_b_tsch_home");
}
