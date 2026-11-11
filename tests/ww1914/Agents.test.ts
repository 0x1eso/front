// ww180 (6) and (8): named agents, and propaganda and censorship, on fixed
// states of a real game.
import { daysFromCivil } from "@openfront/engine-lib/ww1936/Calendar";
import type { GameRunner } from "@openfront/engine/GameRunner";
import {
  agentHolds,
  agentsStep,
  canHire,
  hire,
} from "@openfront/engine/ww1914/Agents";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import {
  propagandaStep,
  propEffect,
  propHolds,
  propOf,
} from "@openfront/engine/ww1914/Propaganda";
import { intelOf } from "@openfront/engine/ww1914/Spies";
import { declareWar, openWar } from "@openfront/engine/ww1914/Wars";
import { moveGauge } from "@openfront/engine/ww1914/World";
import { worldView } from "@openfront/engine/ww1914/WorldView";
import { beforeEach, describe, expect, test } from "vitest";
import { gwRunner } from "./util";

let runner: GameRunner;
let gw: GreatWar;
const st = () => gw.s.seats[0];

function war(): void {
  openWar(gw);
  declareWar(gw, "DEU", "RUS", "test");
  declareWar(gw, "DEU", "FRA", "test");
  declareWar(gw, "DEU", "GBR", "test");
}

/** The next chapters, with only the step under test run. */
function chapters(n: number, fn: () => void): void {
  for (let i = 0; i < n; i++) {
    gw.s.chapter++;
    gw.s.day += 30;
    fn();
  }
}

beforeEach(async () => {
  ({ runner } = await gwRunner({}, "GWAGENT1"));
  gw = runner.game.greatWar()!;
});

describe("named agents", () => {
  test("hired only where a net works and his time has come; the view is the seat's own", () => {
    war();
    gw.s.day = daysFromCivil(1914, 9, 1);
    intelOf(gw, "DEU").net = {};
    expect(canHire(gw, "DEU", "lody")).toBe(false);
    let pool = worldView(gw, st()).agents!.pool;
    expect(pool.find((p) => p.id === "lody")?.wait).toBe("no_net");
    expect(pool.find((p) => p.id === "rintelen")?.wait).toBe("date");
    intelOf(gw, "DEU").net = { GBR: 1 };
    expect(agentHolds(gw, st(), "hire", "lody")).toBe(true);
    expect(hire(gw, "DEU", "lody")).toBe(true);
    expect(canHire(gw, "DEU", "lody")).toBe(false);
    // Another service's man never shows in the seat's view.
    intelOf(gw, "GBR").net = { DEU: 1 };
    gw.s.day = daysFromCivil(1916, 8, 1);
    expect(hire(gw, "GBR", "dame_blanche")).toBe(true);
    const v = worldView(gw, st()).agents!;
    expect(v.mine.map((a) => a.id)).toEqual(["lody"]);
    expect(JSON.stringify(v)).not.toContain("dame_blanche");
    pool = v.pool;
    expect(pool.some((p) => p.id === "lody")).toBe(false);
  });

  test("he adds reports to his net until taken; tried by the state, he is lost for good", () => {
    war();
    gw.s.day = daysFromCivil(1914, 9, 1);
    intelOf(gw, "DEU").net = { GBR: 2 };
    hire(gw, "DEU", "lody");
    const before = gw.s.reports.filter(
      (r) => r.tag === "GBR" && r.source === "agents",
    ).length;
    intelOf(gw, "GBR").counter = 3;
    let n = 0;
    while (gw.s.agents![0].fate === null && n < 40) {
      n++;
      chapters(1, () => agentsStep(gw));
    }
    const lody = gw.s.agents!.find((a) => a.id === "lody")!;
    expect(lody.fate).toBe("executed");
    expect(lody.takenBy).toBe("GBR");
    expect(n).toBeGreaterThan(0);
    const after = gw.s.reports.filter(
      (r) => r.tag === "GBR" && r.source === "agents",
    ).length;
    expect(after).toBeGreaterThan(before);
    expect(intelOf(gw, "DEU").net.GBR).toBe(1);
    expect(gw.nation("GBR")!.trust.DEU).toBe(-1);
    expect(gw.s.news.some((x) => x.key === "agent_lody")).toBe(true);
    expect(gw.s.news.some((x) => x.key === "agent_fate_executed")).toBe(true);
    expect(agentHolds(gw, st(), "lost")).toBe(true);
    expect(canHire(gw, "DEU", "lody")).toBe(false);
  });
});

describe("propaganda", () => {
  test("the censor holds bad news back, at a cost with the house; it may come out later", () => {
    war();
    const deu = gw.nation("DEU")!;
    deu.gauges.morale = 3;
    const house = deu.inst.reichstag ?? 0;
    expect(propHolds(gw, st(), "hush")).toBe(true);
    propEffect(gw, "DEU", "hush");
    expect(deu.inst.reichstag).toBe(house - 1);
    moveGauge(gw, "DEU", "morale", -1, "casualty_lists");
    moveGauge(gw, "DEU", "morale", -1, "front_collapsed");
    expect(deu.gauges.morale).toBe(3);
    expect(propOf(gw, "DEU").hidden).toBe(2);
    // Other blows still land.
    moveGauge(gw, "DEU", "morale", -1, "something_else");
    expect(deu.gauges.morale).toBe(2);
    chapters(4, () => propagandaStep(gw));
    expect(propOf(gw, "DEU").hidden).toBe(0);
    const out = propHolds(gw, st(), "out", undefined, "hush");
    expect(deu.gauges.morale).toBe(out ? 0 : 2);
    expect(propHolds(gw, st(), "ok", undefined, "hush")).toBe(true);
  });

  test("leaflets wear an enemy's order slowly, by its state; bought papers lean a neutral or turn it", () => {
    war();
    const rus = gw.nation("RUS")!;
    rus.gauges.order = 2;
    rus.gauges.bread = 0;
    rus.unrest = 2;
    propEffect(gw, "DEU", "leaflets", "RUS");
    expect(propHolds(gw, st(), "leaflets", "RUS")).toBe(false);
    chapters(6, () => propagandaStep(gw));
    // At most two hits a campaign.
    expect(rus.gauges.order).toBeGreaterThanOrEqual(0);
    expect(rus.gauges.order).toBeLessThan(2);
    const usa = gw.nation("USA")!;
    usa.lean = 0;
    propEffect(gw, "DEU", "papers", "USA");
    chapters(4, () => propagandaStep(gw));
    const op = propOf(gw, "DEU").ops.find((o) => o.act === "papers")!;
    expect(op.ok || op.out).toBe(true);
    if (op.out) {
      expect(usa.trust.DEU).toBe(-1);
      expect(gw.s.news.some((x) => x.key === "prop_papers_out")).toBe(true);
    } else {
      expect(usa.lean).toBe(-1);
    }
    const v = worldView(gw, st()).prop!;
    expect(v.ops.map((o) => o.act)).toEqual(["leaflets", "papers"]);
  });

  test("the AI uses both by character", () => {
    war();
    for (const tag of ["FRA", "GBR", "RUS"] as const) {
      gw.nation(tag)!.gauges.morale = 1;
      intelOf(gw, tag).net = { DEU: 1 };
    }
    gw.s.day = daysFromCivil(1916, 8, 1);
    chapters(24, () => {
      agentsStep(gw);
      propagandaStep(gw);
    });
    const used = ["FRA", "GBR", "RUS"].filter(
      (t) => (gw.nation(t as "FRA")!.prop?.ops.length ?? 0) > 0,
    );
    expect(used.length).toBeGreaterThan(0);
    expect(gw.s.agents?.some((a) => a.by === "GBR")).toBe(true);
  });
});
