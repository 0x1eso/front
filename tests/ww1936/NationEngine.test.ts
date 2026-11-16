// ww229 (design ww227 §2, §6, §8): the engine side of the minors' national
// content: the `character` condition, old focus ids aliased to a national
// tree, rebels inheriting the tree (D6), start arms (D4) and the clamp of a
// minor's own equipment between the generic key and the majors' median (D2).
import { KS } from "@openfront/engine-api/ww1936/DepthTypes";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { FocusDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  tankStatsOfEntry,
  tankStatsRaw,
} from "@openfront/engine-lib/ww1936/hist/ConvertTank";
import { DEU_HIST } from "@openfront/engine-lib/ww1936/hist/deu";
import {
  clampGroupOf,
  majorCeiling,
} from "@openfront/engine-lib/ww1936/hist/MinorClamp";
import type { TankEntry } from "@openfront/engine-lib/ww1936/hist/Types";
import { weakGroundField } from "@openfront/engine-lib/ww1936/hist/WeakGeneric";
import { applyStartArms } from "@openfront/engine/ww1936/depth/StartArms";
import { startCivilWar } from "@openfront/engine/ww1936/endgame/CivilWar";
import { evalCondition } from "@openfront/engine/ww1936/politics/Conditions";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { makeCtx } from "@openfront/engine/ww1936/politics/Dispatch";
import { endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import { END_MAP, stepTo, wwRunner } from "./util";

const focus = (id: string, y: number): FocusDef => ({
  id,
  tree: "POL",
  x: 0,
  y,
  days: 35,
  branch: "politics",
  icon: "flag",
  effects: [{ kind: "pp", amount: 10 }],
  ai: { base: 1 },
});

beforeEach(() => {
  const base = endgameFixture();
  usePoliticsContent(
    endgameFixture({
      focuses: [...base.focuses, focus("pol_t_a", 0), focus("pol_t_b", 1)],
      characters: [{ tag: "POL", lean: "revisionist", patrons: ["FRA"] }],
      focusAliases: [{ tree: "POL", from: "gen_t_a", to: "pol_t_a" }],
    }),
  );
});
afterEach(() => usePoliticsContent(null));

describe("ww229: national trees in the engine", () => {
  it("character, aliases, rebels on the tree, start arms", async () => {
    const runner = await wwRunner({}, [], END_MAP);
    stepTo(runner, WW_PREP_TICKS + 2);
    const g = runner.game;
    const ww = g.worldWar()!;
    const pol = ww.politics;
    const id = endId("POL");
    const c = pol.country(id)!;
    c.tree = "POL";
    c.focusState = new Uint8Array([1, 0]);
    const ctx = makeCtx(pol, id, id, 0, g.ticks());
    expect(evalCondition(ctx, { kind: "character", is: "revisionist" })).toBe(
      true,
    );
    expect(evalCondition(ctx, { kind: "character", is: "client" })).toBe(false);
    // The old generic id answers through the alias; pol_t_b is not done.
    expect(evalCondition(ctx, { kind: "focus_done", id: "gen_t_a" })).toBe(
      true,
    );
    expect(evalCondition(ctx, { kind: "focus_done", id: "pol_t_b" })).toBe(
      false,
    );

    // Start arms: a licensed Pz 38(t) in a slot and in stock, no licence record.
    const tank = DEU_HIST.find((e) => e.id === "deu_pz38t_c")!;
    const licences = ww.depth.market.licences.length;
    const [slot] = applyStartArms(ww.depth, id, [
      { entry: tank.id, origin: "licensed", count: 7, source: "test row" },
    ]);
    expect(slot).toBeGreaterThan(0);
    const s = ww.depth.designSlot(id, "tank", slot)!;
    expect([s.origin, s.def.hist, s.from]).toEqual([
      "licensed",
      tank.id,
      endId("DEU"),
    ]);
    expect(ww.economy.country(id)!.stock[equipKey("tank_design", slot)]).toBe(
      7,
    );
    expect(ww.depth.market.licences.length).toBe(licences);

    // D6: the rebels play the national tree with its done focuses.
    expect(startCivilWar(ww.endgame, id, "communist", g.ticks())).toBe(true);
    const rebel = endId("CW1");
    const r = pol.country(rebel)!;
    expect(r.tree).toBe("POL");
    expect([...r.focusState]).toEqual([1, 0]);
    expect(r.focus).toBeNull();
  }, 60_000);
});

describe("ww229: a minor's own equipment is clamped (D2)", () => {
  it("between the generic key and the majors' median; majors untouched", () => {
    const mediums = DEU_HIST.filter(
      (e): e is TankEntry => e.family === "tank" && e.role === "medium",
    );
    const strong = mediums[mediums.length - 1];
    const raw = tankStatsOfEntry(strong);
    const minor: TankEntry = { ...strong, id: "pol_test", country: "POL" };
    const got = tankStatsOfEntry(minor);
    expect(clampGroupOf(minor)).toBe(clampGroupOf(strong));
    for (const f of ["soft", "hard", "brk", "pierce", "armor"] as const) {
      const ceil = majorCeiling(minor, f)!;
      expect(got[f], f).toBe(Math.min(raw[f], ceil));
    }
    // Costs and speed stay the real ones.
    expect([got.costMilli, got.speedCenti]).toEqual([
      raw.costMilli,
      raw.speedCenti,
    ]);
    // A weak minor tank is lifted to its generic key's number.
    const weak: TankEntry = {
      ...minor,
      spec: { ...minor.spec, hullFrontMm: 1, turretFrontMm: 1, penMm500: 1 },
    };
    const parts = strong.techs[0].split("_");
    const gen = Number(parts[parts.length - 1]);
    const w = tankStatsOfEntry(weak);
    for (const [f, ks] of [
      ["armor", KS.armor],
      ["pierce", KS.pierce],
    ] as const) {
      const floor = weakGroundField("medium_tank", gen, ks)!;
      expect(w[f], f).toBe(
        Math.min(
          Math.max(tankStatsRaw(weak)[f], floor),
          majorCeiling(weak, f)!,
        ),
      );
      expect(w[f], f).toBeGreaterThan(tankStatsRaw(weak)[f]);
    }
  });
});
