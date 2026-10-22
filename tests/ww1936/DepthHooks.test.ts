// World War 1936 P6 (plan Task 1 Steps 12–15; review E4/E5, L4): the
// foundation's hook bodies in P1–P5, each driven through its seam with a
// stand-in lane value, and neutral when the lanes give nothing.
import { KS, KS_FIELDS } from "@openfront/engine-api/ww1936/DepthTypes";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_STATIC_SLOTS,
  MOVE_ADVANCE,
  MOVE_NONE,
} from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { divisionMods } from "@openfront/engine-lib/ww1936/CombatRules";
import { reliabilityLossBp } from "@openfront/engine-lib/ww1936/DesignRules";
import { masteryGain } from "@openfront/engine-lib/ww1936/DoctrineRules";
import {
  capturePmMilli,
  cipherStrength,
  decryptPower,
  opSuccessPm,
} from "@openfront/engine-lib/ww1936/IntelRules";
import {
  HARBOR_COST_MILLI,
  HARBOR_LINE_CLS,
  lineCostMilli,
  navalLineClass,
} from "@openfront/engine-lib/ww1936/NavalLineRules";
import {
  PROJECT_DEFS,
  projectDayMilli,
  scientistPct,
} from "@openfront/engine-lib/ww1936/ProjectRules";
import { STATIC_KEY_STATS } from "@openfront/engine-lib/ww1936/TemplateStats";
import { designInUse } from "@openfront/engine/ww1936/depth/Designs";
import { setEmbargo } from "@openfront/engine/ww1936/depth/Embargo";
import { NEUTRAL_ARMY_MODS } from "@openfront/engine/ww1936/depth/WwDepth";
import { slotBuildings } from "@openfront/engine/ww1936/economy/Construction";
import { stepNavalLines } from "@openfront/engine/ww1936/economy/NavalLines";
import { partnerJudge } from "@openfront/engine/ww1936/economy/Trade";
import {
  dailyEntrench,
  designLossMilli,
  modInputOf,
} from "@openfront/engine/ww1936/land/Battles";
import { readinessDay } from "@openfront/engine/ww1936/land/Plans";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { vi } from "vitest";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { clearLand, HUMAN, placeArmy, step, stepTo, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

/** The game's depth hooks with some answers replaced (a lane's values stood in for). */
function withHooks<T extends object>(hooks: T, over: Partial<T>): T {
  return Object.assign(Object.create(hooks) as T, over);
}

async function deep(country: "GBR" | "DEU" | "ITA" = "GBR") {
  const runner = await wwRunner({}, [{ clientID: HUMAN, country }], DEEP.map);
  stepTo(runner, WW_PREP_TICKS + 2);
  const ww = runner.game.worldWar()!;
  return { runner, ww, id: DEEP.tag[country] };
}

describe("P6 hooks: economy and endgame", () => {
  it("a floating-harbour line is its own kind: its cost, its view, into the stock (E4)", async () => {
    expect(navalLineClass(HARBOR_LINE_CLS)).toBe("floating_harbor");
    expect(lineCostMilli({ cls: HARBOR_LINE_CLS, gen: 1, progress: 0 })).toBe(
      HARBOR_COST_MILLI,
    );
    const { runner, ww, id } = await deep("GBR");
    const ce = ww.economy.country(id)!;
    ce.addTech("floating_harbor_1");
    expect(
      ww.navy.issue(
        id,
        {
          kind: "naval_line_add",
          cls: "floating_harbor",
          gen: 1,
          docks: 1,
          count: 1,
          port: DEEP.region.london,
        },
        runner.game.ticks(),
      ),
    ).toBeNull();
    const line = ce.navalLines[ce.navalLines.length - 1];
    expect(line.cls).toBe(HARBOR_LINE_CLS);
    ww.navy.markCountry(id);
    const view = ww.navy
      .takeData()!
      .details.find((x) => x.smallID === id)!
      .lines.find((l) => l.id === line.id)!;
    expect(view.cls).toBe("floating_harbor");
    expect(view.costMilli).toBe(3_000_000);
    // Its launch goes into the stock (lane W1 deploys it).
    const key = equipKey("floating_harbor", 1);
    const before = ce.stock[key];
    line.progress = HARBOR_COST_MILLI - 1;
    line.activeDocks = 1;
    line.fill = 1000;
    stepNavalLines(ww.economy, ce, ww.day(runner.game.ticks()));
    expect(ce.stock[key]).toBe(before + 1);
  });

  it("a capitulation zeroes the loser's atomic stock", async () => {
    const { runner, ww } = await deep("GBR");
    const pol = ww.economy.country(DEEP.tag.POL)!;
    pol.stock[equipKey("atomic_bomb", 1)] = 3;
    ww.endgame.onCapitulated(DEEP.tag.POL, DEEP.tag.DEU, runner.game.ticks());
    expect(pol.stock[equipKey("atomic_bomb", 1)]).toBe(0);
  });

  it("an embargo closes the trade partner judge", async () => {
    const { ww } = await deep("GBR");
    const judge = () => partnerJudge(ww.economy, DEEP.tag.GBR)(DEEP.tag.FRA);
    const open = judge();
    setEmbargo(ww.depth, DEEP.tag.FRA, DEEP.tag.GBR, true);
    expect(ww.depth.embargoed(DEEP.tag.GBR, DEEP.tag.FRA)).toBe(true);
    expect(judge()).toBe("no_partner");
    setEmbargo(ww.depth, DEEP.tag.FRA, DEEP.tag.GBR, false);
    expect(judge()).toBe(open);
  });

  it("a dam's repair: level 1, its floods over", async () => {
    const { ww } = await deep("GBR");
    const dam = DEEP.dam.dam_mohne;
    const d = ww.depth;
    d.world.damLevel[dam.index] = 0;
    d.world.floodUntil = [
      [dam.downstream[0], 999],
      [DEEP.region.paris, 999],
    ];
    d.onDamRepaired(dam.region);
    expect(d.world.damLevel[dam.index]).toBe(1);
    expect(d.world.floodUntil).toEqual([[DEEP.region.paris, 999]]);
  });

  it("facilities and power plants take region slots", async () => {
    const { ww } = await deep("GBR");
    const r = DEEP.region.london;
    const before = slotBuildings(ww.economy, r);
    ww.economy.buildingArray("facility_science")[r] = 1;
    ww.economy.buildingArray("power_plant")[r] = 2;
    expect(slotBuildings(ww.economy, r)).toBe(before + 3);
  });

  it("the ship stats memo follows the design version", async () => {
    const { ww, id } = await deep("GBR");
    const a = ww.navy.statsFor(id, "bb", 1, 1);
    expect(ww.navy.statsFor(id, "bb", 1, 1)).toBe(a);
    // A static ship ignores the design version.
    const s = ww.navy.statsFor(id, "bb", 1);
    ww.depth.markDesign(id, "ship", 1);
    expect(ww.navy.statsFor(id, "bb", 1)).toBe(s);
    expect(ww.navy.statsFor(id, "bb", 1, 1)).not.toBe(a);
    expect(ww.navy.statsFor(id, "bb", 1, 1)).toEqual(a);
  });

  it("markNuked never takes a no-strike region; a design slot loses by reliability", async () => {
    const { ww } = await deep("GBR");
    const d = ww.depth;
    const spy = vi.spyOn(d, "noStrike").mockReturnValue(true);
    d.markNuked(DEEP.region.berlin, 999);
    expect(d.resistanceAdjPp(DEEP.region.berlin)).toBe(0);
    spy.mockRestore();
    d.markNuked(DEEP.region.berlin, 999);
    expect(d.resistanceAdjPp(DEEP.region.berlin)).toBe(10);
    // designLossMilli: static slots as P2's; a design slot by reliability.
    expect(designLossMilli(STATIC_KEY_STATS, 0, 1000)).toBe(1000);
    const stats = new Int32Array(STATIC_KEY_STATS.stats);
    const j = GROUND_STATIC_SLOTS;
    stats[j * KS_FIELDS + KS.relPm] = 700;
    const ks = { ...STATIC_KEY_STATS, stats };
    expect(designLossMilli(ks, j, 1000)).toBe(
      Math.floor((1000 * reliabilityLossBp(700)) / 10_000),
    );
    expect(designLossMilli(ks, j, 1000)).toBe(1100);
  });
});

describe("P6 hooks: the land war (stat keys and lane D's per-army values)", () => {
  async function army() {
    const { runner, ww, id } = await deep("DEU");
    clearLand(runner.game);
    const l = ww.land;
    const a = placeArmy(runner.game, "DEU", DEEP.region.berlin, 2);
    const r = l.divisions.rowOf(a.divisions[0]);
    return { runner, ww, l, a, r, id };
  }

  it("entrenchSpeedPct (country) and the army's field marshal speed entrenchment", async () => {
    const { ww, l, a, r, id } = await army();
    const t = l.divisions;
    const days = (every: number) => {
      t.stillDays[r] = 0;
      t.entrench[r] = 0;
      for (let i = 0; i < every; i++) dailyEntrench(l, id);
      return t.entrench[r];
    };
    expect(t.mode[r]).toBe(MOVE_NONE);
    expect(days(2)).toBe(0);
    expect(days(3)).toBe(1);
    ww.economy.country(id)!.stats.entrenchSpeedPct = 50;
    expect(days(2)).toBe(1);
    ww.economy.country(id)!.stats.entrenchSpeedPct = 0;
    const hooks = l.depthHooks;
    l.depthHooks = withHooks(hooks, {
      armyMods: (o: number, armyId: number) =>
        armyId === a.id
          ? { ...NEUTRAL_ARMY_MODS, entrenchSpeedPct: 50 }
          : NEUTRAL_ARMY_MODS,
    });
    expect(days(2)).toBe(1);
    l.depthHooks = hooks;
  });

  it("a field marshal's org, readiness cap (the fm_plan line) and speed (L4)", async () => {
    const { runner, ww, l, a, r } = await army();
    const orgMax = l.orgMaxOf(r);
    const hooks = l.depthHooks;
    const mods = {
      ...NEUTRAL_ARMY_MODS,
      orgAdd: 3,
      planMaxBp: 1000,
      planSpeedPct: 100,
      fmPlan: 1,
    };
    l.depthHooks = withHooks(hooks, {
      armyMods: (o: number, armyId: number) =>
        armyId === a.id ? mods : NEUTRAL_ARMY_MODS,
    });
    expect(l.orgMaxOf(r)).toBe(orgMax + 3000);
    // Readiness grows past the country's 30% cap to 40%.
    a.order = { ...a.order, kind: "front" };
    a.planBp = 2950;
    readinessDay(l, a);
    expect(a.planBp).toBeGreaterThan(3000);
    a.planBp = 4000;
    a.front = [l.divisions.region[r]];
    const input = modInputOf(l, r, DEEP.region.warsaw, true);
    expect(input.planBp).toBe(3000);
    expect(input.fmPlanBp).toBe(1000);
    const lines = divisionMods(input).attackLines;
    expect(lines.find((x) => x.id === "plan")?.bp).toBe(3000);
    expect(lines.find((x) => x.id === "fm_plan")?.bp).toBe(1000);
    l.depthHooks = hooks;
    // Neutral: P2's cap holds the readiness; no fm_plan line.
    a.planBp = 2950;
    readinessDay(l, a);
    expect(a.planBp).toBe(3000);
    const p2 = modInputOf(l, r, DEEP.region.warsaw, true);
    expect(p2.fmPlanBp).toBe(0);
    expect(
      divisionMods(p2).attackLines.find((x) => x.id === "fm_plan"),
    ).toBeUndefined();
    void runner;
    void ww;
  });

  it("moveCutPct slows the way in; advanceSpeedPct speeds an advance", async () => {
    const { runner, ww, l, a, r, id } = await army();
    const t = l.divisions;
    const go = () => {
      l.issue(id, {
        kind: "army_move",
        army: a.id,
        region: DEEP.region.munich,
      });
      step(runner);
      return t.step[r];
    };
    const base = go();
    expect(base).toBeGreaterThan(0);
    const hooks = l.depthHooks;
    l.depthHooks = withHooks(hooks, { moveCutPct: () => 50 });
    step(runner);
    expect(t.step[r]).toBe(Math.floor((base * 50) / 100));
    l.depthHooks = hooks;
    t.mode[r] = MOVE_ADVANCE;
    ww.economy.country(id)!.stats.advanceSpeedPct = 100;
    step(runner);
    expect(t.step[r]).toBe(base * 2);
  });
});

describe("P6: the screens' detail numbers come from the rules (review E6)", () => {
  it("capture risk, success, cipher, decrypt, days left, in use, mastery gain", async () => {
    const { runner, ww, id } = await deep("DEU");
    const d = ww.depth;
    const c = d.country(id)!;
    const ce = ww.economy.country(id)!;
    ce.addTech("cryptography_1");
    c.intel.agency = true;
    c.intel.operatives.push({
      uid: 7,
      codename: 3,
      skill: 2,
      abroadDays: 0,
      state: 3,
      target: DEEP.tag.FRA,
      mission: -1,
      op: 1,
      sinceDay: 0,
      travelLeft: 0,
      releaseDay: 0,
      recruitLeft: 0,
    });
    d.ops.push({
      uid: 1,
      kind: 0,
      owner: id,
      target: DEEP.tag.FRA,
      operatives: [7],
      startDay: 0,
      endDay: 30,
    });
    d.setNetMilli(id, DEEP.tag.FRA, 400_000);
    c.proj.scientists.push({
      id: 9,
      spec: 0,
      skill: 4,
      sinceDay: 0,
      project: 0,
    });
    c.proj.running.push({
      project: 0,
      facility: DEEP.region.berlin,
      progressMilli: 500_000,
      scientist: 9,
    });
    ce.stock[equipKey("tank_design", 1)] = 5;
    d.dayTally[id * 9] = 2_000_000;
    d.markCountry(id);
    const data = d.takeData()!;
    const det = data.details!.find((x) => x.smallID === id)!;
    const o = det.intel.operatives.find((x) => x.uid === 7)!;
    expect(o.capturePm).toBe(
      Math.floor(capturePmMilli(true, 2, 0, false) / 1000),
    );
    expect(o.capturePm).toBeGreaterThan(0);
    expect(det.intel.operations[0].successPm).toBe(
      opSuccessPm(400, 2000, false, 0),
    );
    expect(det.intel.cipher).toBe(cipherStrength(1, 0, false, 0));
    expect(det.intel.decrypt).toBe(decryptPower(true, false, false, 1, 0, 0));
    const run = det.projects.running[0];
    const day = projectDayMilli(
      PROJECT_DEFS.sp_atomic.days,
      scientistPct(4, true),
      1000,
      true,
    );
    expect(run.daysLeft).toBe(Math.ceil(500_000 / day));
    expect(run.inputPm).toBe(1000);
    expect(det.doctrine.gainMilli.slice(0, 3)).toEqual(
      masteryGain([2_000_000, 0, 0], 0),
    );
    // A tank design slot (in use counts stock and divisions) — none saved
    // here, so only the stock rule is checked through the helper.
    expect(designInUse(d, id, "tank", 1)).toBe(5);
    void runner;
  });
});
