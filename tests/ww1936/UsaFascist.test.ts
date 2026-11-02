// The US fascist path: the tree's shape and the congress_dissolve effect.
// The deep test map has no US: Britain stands in for it, as in Congress.test.
import { IDEO_DEM, IDEO_FAS } from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  USA_BRANCHES,
  USA_FOCUSES,
} from "@openfront/engine-lib/ww1936/content/focus/usa";
import { USA_FASCIST_FOCUSES } from "@openfront/engine-lib/ww1936/content/focus/usa_fascist";
import {
  addCongressPp,
  congressBlockFor,
  congressDay,
  dissolveCongress,
} from "@openfront/engine/ww1936/depth/Congress";
import { evalCondition } from "@openfront/engine/ww1936/politics/Conditions";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { makeCtx } from "@openfront/engine/ww1936/politics/Dispatch";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { pol, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const US = DEEP.tag.GBR;

describe("USA fascist path: the tree", () => {
  const byId = new Map(USA_FOCUSES.map((f) => [f.id, f]));
  it("adds about 27 focuses in four groups, with symmetric forks", () => {
    expect(USA_FASCIST_FOCUSES.length).toBeGreaterThanOrEqual(25);
    expect(new Set(USA_FASCIST_FOCUSES.map((f) => f.group))).toEqual(
      new Set([
        "usa_strongman",
        "usa_seizure",
        "usa_new_order",
        "usa_new_order_fate",
      ]),
    );
    for (const f of USA_FASCIST_FOCUSES) {
      for (const e of f.exclusive ?? []) {
        expect(byId.get(e)?.exclusive, f.id).toContain(f.id);
      }
      for (const g of f.prereq ?? []) {
        for (const p of g) expect(byId.has(p), `${f.id} needs ${p}`).toBe(true);
      }
    }
    expect(byId.get("usa_preparedness")?.exclusive).toContain(
      "usa_share_wealth",
    );
    expect(USA_BRANCHES.length).toBe(10);
  });

  it("the final focuses seize the regime and dissolve Congress, nothing more", () => {
    for (const id of ["usa_suspend_congress", "usa_seize_washington"]) {
      const kinds = byId.get(id)!.effects.map((e) => e.kind);
      expect(kinds.slice(0, 2)).toEqual([
        "set_government",
        "congress_dissolve",
      ]);
      expect(kinds).not.toContain("civil_war");
      expect(byId.get(id)!.effects).toContainEqual({
        kind: "set_flag",
        flag: "usa_regime_seized",
      });
    }
  });
});

describe("USA fascist path: congress_dissolve", () => {
  it("lifts every block, freezes the value and the effect, opens the gates", async () => {
    const runner = await wwRunner({}, [], DEEP.map);
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const c = pol(runner.game).country(US)!;
    c.spirits.push({ id: "usa_isolation", untilDay: -1, addedDay: 0 });
    const deu = DEEP.tag.DEU;
    expect(congressBlockFor(d, US, US, "declare", deu)).toBe(true);
    c.ruling = IDEO_FAS;
    dissolveCongress(d, US);
    expect(d.mech.congressDissolved).toBe(true);
    expect(c.hasSpirit("usa_isolation")).toBe(false);
    for (const a of ["declare", "lend_lease", "law", "faction"] as const) {
      expect(congressBlockFor(d, US, US, a, deu), a).toBe(false);
    }
    const bp = d.mech.congressBp;
    ww.politics.wtBp = 8_000;
    congressDay(d, US, 10, DEEP.tag.ITA);
    congressDay(d, US, 11, DEEP.tag.ITA);
    expect(d.mech.congressBp).toBe(bp);
    addCongressPp(d, US, 40);
    expect(d.mech.congressBp).toBe(bp);
    const ctx = makeCtx(pol(runner.game), US, US, 0, 0);
    expect(evalCondition(ctx, { kind: "congress_above", pct: 99 })).toBe(true);
  });

  it("comes back when the US is democratic again, from the frozen value", async () => {
    const runner = await wwRunner({}, [], DEEP.map);
    const d = runner.game.worldWar()!.depth;
    const c = pol(runner.game).country(US)!;
    c.ruling = IDEO_FAS;
    c.flags.set("usa_congress_gone", [0, -1]);
    dissolveCongress(d, US);
    const bp = d.mech.congressBp;
    congressDay(d, US, 20, DEEP.tag.ITA);
    expect(d.mech.congressDissolved).toBe(true);
    c.ruling = IDEO_DEM;
    congressDay(d, US, 21, DEEP.tag.ITA);
    expect(d.mech.congressDissolved).toBe(false);
    expect(c.flags.has("usa_congress_gone")).toBe(false);
    expect(Math.abs(d.mech.congressBp - bp)).toBeLessThanOrEqual(20);
  });

  it("moves the depth hash, and survives a snapshot round trip", async () => {
    const runner = await wwRunner({}, [], DEEP.map);
    const d = runner.game.worldWar()!.depth;
    const before = d.hash();
    dissolveCongress(d, US);
    const h = d.hash();
    expect(h).not.toBe(before);
    d.restoreState(d.snapshot());
    expect(d.mech.congressDissolved).toBe(true);
    expect(d.hash()).toBe(h);
  });
});
