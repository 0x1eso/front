// ww179: the 정보부 tab's view carries the seat's own service only: never
// another country's service, how near a foe is to changing its codes, or an
// operation's result before its card has come.
import type { GameRunner } from "@openfront/engine/GameRunner";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { learn } from "@openfront/engine/ww1914/Intel";
import { intelOf } from "@openfront/engine/ww1914/Spies";
import { declareWar, openWar } from "@openfront/engine/ww1914/Wars";
import { worldView } from "@openfront/engine/ww1914/WorldView";
import { beforeEach, describe, expect, test } from "vitest";
import { gwRunner } from "./util";

let runner: GameRunner;
let gw: GreatWar;

beforeEach(async () => {
  ({ runner } = await gwRunner({}, "GWINTEL1"));
  gw = runner.game.greatWar()!;
});

function war(): void {
  openWar(gw);
  declareWar(gw, "DEU", "RUS", "test");
}

describe("the 정보부 view", () => {
  test("a service never used shows no levels and nothing else", () => {
    war();
    delete gw.nation("DEU")!.intel;
    const before = JSON.stringify(gw.nation("DEU"));
    expect(worldView(gw, gw.s.seats[0]).service).toEqual({
      levels: null,
      rivals: expect.arrayContaining(["RUS"]),
      reads: [],
      nets: [],
      caught: [],
      turned: [],
      ops: [],
    });
    // Reading the view never fills the service.
    expect(JSON.stringify(gw.nation("DEU"))).toBe(before);
  });

  test("own service only; a foe's suspicion and a result not yet carded stay hidden", () => {
    war();
    const now = gw.s.chapter;
    const rus = intelOf(gw, "RUS");
    rus.suspect = { DEU: 3 };
    rus.turned = ["DEU"];
    rus.net = { DEU: 3 };
    rus.reads = ["DEU"];
    rus.caught = [{ tag: "DEU", chapter: now }];
    rus.ops = [
      { act: "sabotage", tag: "DEU", ok: true, out: false, chapter: now - 1 },
    ];
    const deu = intelOf(gw, "DEU");
    deu.crypt = 3;
    deu.reads = ["RUS"];
    deu.readOn = [{ tag: "RUS", theatre: "east", chapter: now }];
    deu.net = { RUS: 2, USA: 1 };
    deu.caught = [{ tag: "FRA", chapter: now }];
    deu.ops = [
      { act: "court", tag: "ITA", ok: true, out: false, chapter: now - 1 },
      // Planted the USA net this chapter: its card comes next chapter.
      { act: "net", tag: "USA", ok: true, out: true, chapter: now },
    ];
    const v = worldView(gw, gw.s.seats[0]).service!;
    expect(v.levels).toEqual({ read: 3, guard: deu.secure, hunt: deu.counter });
    expect(v.reads).toEqual([{ tag: "RUS", named: ["east"] }]);
    expect(v.nets).toEqual([{ tag: "RUS", size: 2 }]);
    expect(v.caught).toEqual([{ tag: "FRA", chapter: now }]);
    // Russia turned our agents: we don't know it.
    expect(v.turned).toEqual([]);
    expect(v.ops).toEqual([
      { act: "court", tag: "ITA", ok: true, out: false, chapter: now - 1 },
      { act: "net", tag: "USA", ok: null, out: null, chapter: now },
    ]);
    const text = JSON.stringify(worldView(gw, gw.s.seats[0]));
    for (const hidden of [
      '"suspect"',
      '"readOn"',
      '"heard"',
      '"truth"',
      '"intel"',
    ]) {
      expect(text).not.toContain(hidden);
    }
    // Nothing of Russia's service: its sabotage of us, its read of our codes.
    expect(text).not.toContain('"sabotage"');
  });

  test("in peace the service watches the other camp, and its reports show", () => {
    const v = worldView(gw, gw.s.seats[0]);
    expect(v.service!.rivals).toContain("FRA");
    expect(v.service!.rivals).toContain("RUS");
    // ww178: a peacetime net reports a rival's war plan.
    learn(gw, "DEU", "plan", "FRA", null, "agents");
    const r = worldView(gw, gw.s.seats[0]).reports.at(-1)!;
    expect(r).toMatchObject({ fact: "plan", tag: "FRA", source: "agents" });
    expect(JSON.stringify(r)).not.toContain('"truth"');
  });
});
