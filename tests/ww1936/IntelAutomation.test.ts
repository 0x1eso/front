// World War 1936: the intel switch (a human's agency run by the AI's own
// routine, aiIntelDay): founding as soon as 150 PP allow it, the agency's
// day after, never a coup, a direct intel order hands it back.
import type { GameUpdateViewData } from "@openfront/engine-api/game/GameUpdates";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { WW_DAY_SPLIT } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { GameRunner } from "@openfront/engine/GameRunner";
import {
  AI_MINOR_FOUND_PP,
  aiIntelDay,
} from "@openfront/engine/ww1936/depth/AiIntel";
import * as Operations from "@openfront/engine/ww1936/depth/Operations";
import { ST_IDLE } from "@openfront/engine/ww1936/depth/Operatives";
import { byTag, HUMAN, order, step, stepTo, wwRunnerCapture } from "./util";

async function human() {
  const { runner, updates } = await wwRunnerCapture({ historicalAi: false }, [
    { clientID: HUMAN, country: "DEU" },
  ]);
  stepTo(runner, WW_PREP_TICKS + 1);
  const g = runner.game;
  const ww = g.worldWar()!;
  return { runner, updates, g, ww, deu: byTag(g, "DEU").smallID() };
}

const finishDay = (runner: GameRunner, d: number) =>
  stepTo(runner, dayStartTick(d, WW_PREP_TICKS) + WW_DAY_SPLIT);
const notices = (updates: GameUpdateViewData[], key: string) =>
  updates
    .flatMap((u) => u.updates[GameUpdateType.DisplayEvent] ?? [])
    .filter((m) => m.message === `events_display.${key}`);
const auto = (runner: GameRunner, on: boolean) =>
  step(runner, 1, [order(HUMAN, { kind: "auto_set", domain: "intel", on })]);

vi.mock("@openfront/engine/ww1936/depth/Operations", async (orig) => {
  const m =
    await orig<typeof import("@openfront/engine/ww1936/depth/Operations")>();
  return { ...m, startOperation: vi.fn(m.startOperation) };
});

describe("World War 1936 automation: the intel switch", () => {
  it("on: a human founds once PP allow it, then recruits and assigns; the AI's own orders keep it on", async () => {
    const { runner, updates, g, ww, deu } = await human();
    const d = ww.depth;
    const pc = ww.politics.country(deu)!;
    pc.ppMilli = (AI_MINOR_FOUND_PP - 50) * 1000;
    auto(runner, true);
    const d0 = ww.day(g.ticks());
    finishDay(runner, d0 + 1);
    // Too little PP: nothing is founded (and nothing is spent or announced).
    expect(d.country(deu)!.intel.agency).toBe(false);
    pc.ppMilli = 200_000;
    finishDay(runner, d0 + 2);
    const c = d.country(deu)!;
    expect(c.intel.agency).toBe(true);
    expect(pc.ppMilli).toBeLessThan(200_000 - 40_000);
    expect(c.intel.operatives.length).toBe(1);
    // The recruit arrives; the next day on its rhythm sends it on a mission.
    c.intel.operatives[0].recruitLeft = 0;
    for (let k = 3; k <= 14; k++) finishDay(runner, d0 + k);
    expect(c.intel.operatives[0].state).not.toBe(ST_IDLE);
    expect(ww.autoOn(deu, "intel")).toBe(true);
    expect(notices(updates, "ww1936_auto_off_intel")).toHaveLength(0);
  }, 240_000);

  it("off (the default): no agency, however much PP", async () => {
    const { runner, g, ww, deu } = await human();
    ww.politics.country(deu)!.ppMilli = 300_000;
    const d0 = ww.day(g.ticks());
    for (let k = 1; k <= 12; k++) finishDay(runner, d0 + k);
    expect(ww.depth.country(deu)!.intel.agency).toBe(false);
  }, 240_000);

  it("a direct intel order switches it off with the standard notice, once", async () => {
    const { runner, updates, ww, deu } = await human();
    ww.depth.country(deu)!.intel.agency = true;
    auto(runner, true);
    step(runner, 1, [order(HUMAN, { kind: "operative_recruit" })]);
    expect(ww.autoOn(deu, "intel")).toBe(false);
    expect(notices(updates, "ww1936_auto_off_intel")).toHaveLength(1);
    step(runner, 1, [order(HUMAN, { kind: "operative_recruit" })]);
    expect(notices(updates, "ww1936_auto_off_intel")).toHaveLength(1);
  }, 120_000);

  it("never starts op_coup for a human, where the AI rule would", async () => {
    const { g, ww, deu } = await human();
    const d = ww.depth;
    const fra = byTag(g, "FRA").smallID();
    const me = ww.politics.country(deu)!;
    const them = ww.politics.country(fra)!;
    // A rival under another regime with my ideology at 60 %, the top threat.
    them.ruling = me.ruling === 0 ? 1 : 0;
    them.pop[me.ruling] = 6_000;
    ww.politics.threatBp[fra] = 9_000;
    me.ppMilli = 900_000;
    const c = d.country(deu)!;
    c.intel.agency = true;
    c.intel.upgrades = ~0;
    for (let i = 0; i < 4; i++) {
      c.intel.operatives.push({
        uid: d.uid(),
        codename: i,
        skill: 1,
        abroadDays: 0,
        state: ST_IDLE,
        target: 0,
        mission: -1,
        op: 0,
        sinceDay: 0,
        travelLeft: 0,
        releaseDay: -1,
        recruitLeft: 0,
      });
    }
    // Every attempt is refused, so the AI's whole list is tried in order.
    const start = vi.mocked(Operations.startOperation);
    start.mockReturnValue("no_pp");
    const tried = () => start.mock.calls.map((a) => a[2]);
    const day = ww.day(g.ticks());
    // Human with the switch on: operations are tried, never a coup.
    for (let k = 0; k < 10; k++) aiIntelDay(d, deu, day + k);
    expect(tried()).not.toContain("op_coup");
    // The same state for an AI country: the rule fires.
    start.mockClear();
    vi.spyOn(ww, "isHumanControlled").mockReturnValue(false);
    for (let k = 10; k < 20; k++) aiIntelDay(d, deu, day + k);
    expect(tried()).toContain("op_coup");
    vi.restoreAllMocks();
  }, 120_000);
});
