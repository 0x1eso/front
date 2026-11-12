// ww190 §2: fewer repeats. A drawn scene comes at most `max` times a game
// (GW_REPEAT_MAX by default); the house's papers, the accounts and the
// schedule's acts are free; the plain broken-promise card is spaced out.
import {
  gwContent,
  useGwContent,
} from "@openfront/engine-lib/ww1914/content/Content";
import type { GameRunner } from "@openfront/engine/GameRunner";
import {
  bodyId,
  deskCandidates,
  GW_REPEAT_MAX,
  repeatCap,
  timesDealt,
} from "@openfront/engine/ww1914/Desk";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import {
  GW_PROMISE_SCENE,
  settlePromises,
} from "@openfront/engine/ww1914/Talk";
import { beforeEach, describe, expect, test } from "vitest";
import { gwRunner } from "./util";

let runner: GameRunner;
let gw: GreatWar;
const st = () => gw.s.seats[0];

beforeEach(async () => {
  ({ runner } = await gwRunner());
  gw = runner.game.greatWar()!;
});

describe("the repeat cap", () => {
  test("by default five for a drawn scene, none for the house's papers, the accounts and the acts, its own max first", () => {
    const scenes = gwContent().scenes;
    const one = (f: (x: (typeof scenes)[number]) => boolean) => scenes.find(f)!;
    expect(repeatCap(one((x) => x.id.startsWith("gw_law_")))).toBe(Infinity);
    expect(repeatCap(one((x) => x.id.startsWith("gw_bm_")))).toBe(Infinity);
    expect(repeatCap(one((x) => x.kind === "ledger"))).toBe(Infinity);
    expect(repeatCap(one((x) => x.byAct === true))).toBe(Infinity);
    const plain = one(
      (x) =>
        x.kind === "wire" &&
        x.byAct !== true &&
        x.quiet !== true &&
        !x.id.startsWith("gw_l"),
    );
    expect(repeatCap(plain)).toBe(GW_REPEAT_MAX);
    expect(repeatCap({ ...plain, max: 2 })).toBe(2);
  });

  test("a scene dealt five times is drawn no more; four, it still is", () => {
    const seat = st();
    gw.s.chapter += 5;
    const first = deskCandidates(gw, seat)[0];
    expect(first).toBeDefined();
    // The same scene without `once`, so only the cap can stop it.
    const scene = { ...first.scene, once: undefined, cooldown: 0 };
    const base = gwContent();
    useGwContent({
      ...base,
      scenes: base.scenes.map((x) => (x.id === scene.id ? scene : x)),
    });
    try {
      const deal = () =>
        seat.shown.push(bodyId(scene.id, scene.variants[0].id));
      for (let i = 0; i < GW_REPEAT_MAX - 1; i++) deal();
      seat.seen[scene.id] = 0;
      const ids = () => deskCandidates(gw, seat).map((c) => c.scene.id);
      expect(timesDealt(seat, scene.id)).toBe(GW_REPEAT_MAX - 1);
      expect(ids()).toContain(scene.id);
      deal();
      expect(ids()).not.toContain(scene.id);
    } finally {
      useGwContent(null);
    }
  });
});

describe("the broken promise", () => {
  test("two promises broken in one chapter bring the plain card once", () => {
    const seat = st();
    const who = gw.s.people[0].id;
    const promise = (key: string) => ({
      key,
      who,
      due: gw.s.chapter - 1,
      kept: false,
      broken: false,
      keep: null,
      back: null,
    });
    seat.promises.push(promise("first"), promise("second"));
    settlePromises(gw, seat);
    expect(seat.promises.every((p) => p.broken)).toBe(true);
    const plain = seat.scheduled.filter((q) => q.scene === GW_PROMISE_SCENE);
    expect(plain).toHaveLength(1);
  });
});
