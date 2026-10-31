// Focus expansion step A: the start_project effect and the UI-only focus group.
import { SPECIAL_PROJECTS } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  type Effect,
  effectGroup,
  WwEffectSchema,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import {
  applyEffect,
  makeCtx,
} from "@openfront/engine/ww1936/politics/Dispatch";
import { focusDef } from "@openfront/engine/ww1936/politics/Focus";
import { DEEP, setInfra } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { HUMAN, stepTo, wwRunner } from "./util";

const FRA = DEEP.tag.FRA;
const LYON = DEEP.region.lyon;
const ATOMIC = SPECIAL_PROJECTS.indexOf("sp_atomic");
const E: Effect = { kind: "start_project", project: "sp_atomic" };

afterEach(() => usePoliticsContent(null));

async function france() {
  const fx = depthFixture();
  const first = fx.focuses[0];
  usePoliticsContent({
    ...fx,
    focuses: [{ ...first, group: "g1" }, ...fx.focuses.slice(1)],
  });
  const runner = await wwRunner(
    { ww1936Nukes: true },
    [{ clientID: HUMAN, country: "FRA" }],
    DEEP.map,
  );
  stepTo(runner, WW_PREP_TICKS + 2);
  const ww = runner.game.worldWar()!;
  setInfra(ww, LYON, 5);
  return { runner, ww, first };
}

function run(ww: WorldWar) {
  expect(() => WwEffectSchema.parse(E)).not.toThrow();
  expect(effectGroup(E.kind)).toBe("depth");
  applyEffect(makeCtx(ww.politics, FRA, FRA, 0, 0), E);
}

describe("start_project", () => {
  it("starts at a free facility without the techs, then is a no-op", async () => {
    const { ww } = await france();
    const c = ww.depth.country(FRA)!;
    run(ww); // no facility yet: nothing
    expect(c.proj.running).toHaveLength(0);
    ww.economy.buildingArray("facility_nuclear")[LYON] = 1;
    ww.depth.onFacilityBuilt(LYON);
    run(ww);
    expect(c.proj.running).toEqual([
      { project: ATOMIC, facility: LYON, progressMilli: 0, scientist: -1 },
    ]);
    c.proj.running[0].progressMilli = 5000;
    run(ww); // already running
    expect(c.proj.running).toHaveLength(1);
    expect(c.proj.running[0].progressMilli).toBe(5000);
    c.proj.running.length = 0;
    c.proj.done |= 1 << ATOMIC;
    run(ww); // done
    expect(c.proj.running).toHaveLength(0);
  });

  it("survives snapshot/restore", async () => {
    const { ww } = await france();
    ww.economy.buildingArray("facility_nuclear")[LYON] = 1;
    ww.depth.onFacilityBuilt(LYON);
    run(ww);
    const s = ww.snapshot();
    ww.depth.country(FRA)!.proj.running.length = 0;
    ww.restoreState(s);
    expect(ww.depth.country(FRA)!.proj.running[0]?.facility).toBe(LYON);
  });

  it("group reaches the focus def", async () => {
    const { ww, first } = await france();
    expect(focusDef(ww.politics, first.id)?.group).toBe("g1");
  });
});
