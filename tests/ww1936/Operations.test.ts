// World War 1936 P6 lane I (plan Task 5, spec §8.5): operations — their
// rolls (wwRoll, pre-flight §A13: milli‰), effects through P3, the
// captured operative's cancelled operation. Plan decision 30: a human
// country, the lane functions called directly, findRoll for the rolls.
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  P_INTEL_CAPTURE,
  P_INTEL_OP,
} from "@openfront/engine-lib/ww1936/DepthRules";
import { capturePmMilli } from "@openfront/engine-lib/ww1936/IntelRules";
import { wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { isRetiredTech, WW_TECHS } from "@openfront/engine-lib/ww1936/WwTechs";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { copyDesignTo } from "@openfront/engine/ww1936/depth/DesignCopy";
import {
  collabCutPp,
  dailyOperations,
  operationSuccessPm,
  startOperation,
} from "@openfront/engine/ww1936/depth/Operations";
import {
  dailyOperatives,
  ST_CAPTURED,
  ST_IDLE,
  ST_OPERATION,
} from "@openfront/engine/ww1936/depth/Operatives";
import type {
  DesignSlot,
  Operative,
  WwDepth,
} from "@openfront/engine/ww1936/depth/WwDepth";
import { effectiveBuildings } from "@openfront/engine/ww1936/economy/Buildings";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { vi } from "vitest";
import { DEEP, findRoll } from "./deepFixture";
import { depthFixture, TEST_TANK } from "./depthFixture";
import { stepTo, wwRunner } from "./util";

vi.mock("@openfront/engine/ww1936/depth/DesignCopy", async (orig) => {
  const m =
    await orig<typeof import("@openfront/engine/ww1936/depth/DesignCopy")>();
  return { ...m, copyDesignTo: vi.fn(m.copyDesignTo) };
});

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => {
  usePoliticsContent(null);
  vi.mocked(copyDesignTo).mockClear();
});

const { DEU, GBR, ITA } = DEEP.tag;
const HUMANS = [{ clientID: "HUMANGBR", country: "GBR" as const }];

async function game(): Promise<GameRunner> {
  const r = await wwRunner({}, HUMANS, DEEP.map);
  stepTo(r, WW_PREP_TICKS + 1);
  return r;
}

/** Britain's agency with `n` idle operatives (uids given), PP and rifles to spare. */
function agency(d: WwDepth, uids: number[]): Operative[] {
  const c = d.country(GBR)!;
  c.intel.agency = true;
  d.ww.politics.country(GBR)!.ppMilli = 500_000;
  d.ww.economy.country(GBR)!.stock[equipKey("infantry_equipment", 1)] += 5_000;
  return uids.map((uid) => {
    const o: Operative = {
      uid,
      codename: c.intel.nextCodename++,
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
    };
    c.intel.operatives.push(o);
    return o;
  });
}

/** The first op uid ≥ from whose success roll at `pm` is `pass`. */
function opUid(seed: number, pm: number, pass: boolean, from: number): number {
  for (let n = from; ; n++) {
    if (wwRoll(seed, P_INTEL_OP, n) % 1_000_000 < pm * 1000 === pass) return n;
  }
}

/** Starts the operation with the op uid chosen and runs its last day. */
function runOp(
  d: WwDepth,
  op: Parameters<typeof startOperation>[2],
  target: number,
  uids: number[],
  pass: boolean | null,
): number {
  if (pass !== null) {
    const pm = operationSuccessPm(d, GBR, { target, operatives: uids });
    d.nextUid = opUid(d.ww.politics.seed, pm, pass, d.nextUid);
  }
  expect(startOperation(d, GBR, op, target, uids, d.mg.ticks())).toBeNull();
  const row = d.ops[d.ops.length - 1];
  dailyOperations(d, GBR, row.endDay - 1);
  expect(d.ops).toContain(row);
  dailyOperations(d, GBR, row.endDay);
  return row.uid;
}

describe("World War 1936 P6: intelligence operations (lane I)", () => {
  it("coup operation succeeds or fails by wwRoll and applies P3 coup effects", async () => {
    for (const pass of [true, false]) {
      const r = await game();
      const ww = r.game.worldWar()!;
      const d = ww.depth;
      const pol = ww.politics;
      const [a, b] = agency(d, [11, 12]);
      d.setNetMilli(GBR, ITA, 900_000);
      const me = pol.country(GBR)!.ruling;
      const ita = pol.country(ITA)!;
      // My ideology well above 40% in Italy (stability above 50%).
      ita.pop = [1_000, 500, 3_000, 5_500];
      expect(ita.ruling).not.toBe(me);
      const queue = vi.spyOn(pol, "queueEvent");
      const msg = vi.spyOn(d, "message");
      const pp = pol.country(GBR)!.ppMilli;
      runOp(d, "op_coup", ITA, [a.uid, b.uid], pass);
      expect(pol.country(GBR)!.ppMilli).toBe(pp - 100_000);
      if (pass) {
        expect(ita.ruling).toBe(me);
        expect(queue).toHaveBeenCalledWith("gen_coup_done", ITA, GBR, ITA, 1);
        expect([a.state, b.state]).toEqual([ST_IDLE, ST_IDLE]);
      } else {
        expect(ita.ruling).not.toBe(me);
        expect(queue).not.toHaveBeenCalled();
        expect([a.state, b.state]).toEqual([ST_CAPTURED, ST_CAPTURED]);
        expect(a.target).toBe(ITA);
        expect(
          pol.opinions.some(
            (x) => x.a === ITA && x.b === GBR && x.value === -50,
          ),
        ).toBe(true);
      }
      const key = pass ? "ww1936_operation_done" : "ww1936_operation_failed";
      const told = msg.mock.calls.filter((c) => c[1] === key).map((c) => c[0]);
      expect(told).toEqual([GBR, ITA]);
      expect(d.ops).toEqual([]);
    }
  });

  it("collaboration lowers surrender threshold", async () => {
    const r = await game();
    const ww = r.game.worldWar()!;
    const d = ww.depth;
    const [a, b] = agency(d, [21, 22]);
    d.setNetMilli(GBR, DEU, 700_000);
    // Only against a country at war with us.
    expect(
      startOperation(d, GBR, "op_collaboration", DEU, [a.uid, b.uid], 0),
    ).toBe("op_unavailable");
    ww.setWar(GBR, DEU, r.game.ticks());
    const line = ww.politics.surrenderPct(DEU);
    // A failed one changes nothing.
    runOp(d, "op_collaboration", DEU, [a.uid, b.uid], false);
    expect(collabCutPp(d, DEU)).toBe(0);
    runOp(d, "op_collaboration", DEU, [a.uid, b.uid], true);
    expect(collabCutPp(d, DEU)).toBe(10);
    expect(d.surrenderCutPp(DEU)).toBe(10);
    expect(ww.politics.surrenderPct(DEU)).toBeLessThan(line);
    runOp(d, "op_collaboration", DEU, [a.uid, b.uid], true);
    runOp(d, "op_collaboration", DEU, [a.uid, b.uid], true);
    // At most −20 for a target, to the game's end.
    expect(collabCutPp(d, DEU)).toBe(20);
    expect(d.country(GBR)!.intel.collabPp).toEqual([[DEU, 20]]);
  });

  it("stealing blueprints gives a research bonus and a captured design", async () => {
    const r = await game();
    const ww = r.game.worldWar()!;
    const d = ww.depth;
    const [a] = agency(d, [31]);
    d.setNetMilli(GBR, DEU, 450_000);
    const mine = ww.economy.country(GBR)!.researched;
    const theirs = [...ww.economy.country(DEU)!.researched]
      .filter((t) => !mine.has(t) && !isRetiredTech(t))
      .sort((x, y) => WW_TECHS[x].year - WW_TECHS[y].year || (x < y ? -1 : 1));
    expect(theirs.length).toBeGreaterThan(0);
    const slot = (savedDay: number): DesignSlot => ({
      def: TEST_TANK as DesignSlot["def"],
      origin: "own",
      from: 0,
      fromSlot: 0,
      obsolete: false,
      savedDay,
    });
    const deu = d.country(DEU)!;
    deu.des.tank[0] = slot(5);
    deu.des.tank[1] = slot(9);
    deu.des.tank[2] = slot(9);
    runOp(d, "op_steal_blueprints", DEU, [a.uid], null);
    expect(ww.politics.country(GBR)!.researchBonuses).toContainEqual({
      key: theirs[0],
      pct: 100,
      uses: 1,
    });
    // The newest saved design (ties: the lower slot), copied by lane E.
    expect(vi.mocked(copyDesignTo)).toHaveBeenCalledWith(
      d,
      DEU,
      2,
      "tank",
      GBR,
      "captured",
    );
  });

  it("sabotage hits a running project, else the most military factories", async () => {
    const r = await game();
    const ww = r.game.worldWar()!;
    const d = ww.depth;
    const [a] = agency(d, [41]);
    d.setNetMilli(GBR, DEU, 300_000);
    const { berlin, munich } = DEEP.region;
    const before = effectiveBuildings(ww.economy, berlin, "mil");
    expect(effectiveBuildings(ww.economy, munich, "mil")).toBe(before);
    runOp(d, "op_sabotage", DEU, [a.uid], null);
    // Berlin and Munich tie: the lower region; two factories stop.
    expect(effectiveBuildings(ww.economy, berlin, "mil")).toBe(before - 2);
    expect(effectiveBuildings(ww.economy, munich, "mil")).toBe(before);
    d.country(DEU)!.proj.running.push({
      project: 0,
      facility: berlin,
      progressMilli: 300_000,
      scientist: -1,
    });
    runOp(d, "op_sabotage", DEU, [a.uid], null);
    expect(d.country(DEU)!.proj.running[0].progressMilli).toBe(200_000);
    expect(effectiveBuildings(ww.economy, berlin, "mil")).toBe(before - 2);
  });

  it("a captured operative cancels its operation", async () => {
    const r = await game();
    const ww = r.game.worldWar()!;
    const d = ww.depth;
    const seed = ww.politics.seed;
    const day = 50;
    const p = capturePmMilli(true, 1, 0, false);
    const caught = findRoll(
      seed,
      P_INTEL_CAPTURE,
      (n, roll) => n > 100 && roll % 1_000_000 < p,
      day,
      DEU,
    );
    const [a, b] = agency(d, [caught, caught + 1]);
    d.setNetMilli(GBR, DEU, 600_000);
    const pp = ww.politics.country(GBR)!.ppMilli;
    expect(
      startOperation(d, GBR, "op_capture_cipher", DEU, [a.uid, b.uid], 0),
    ).toBeNull();
    expect([a.state, b.state]).toEqual([ST_OPERATION, ST_OPERATION]);
    expect(ww.politics.country(GBR)!.ppMilli).toBe(pp - 50_000);
    dailyOperatives(d, GBR, day);
    expect(a.state).toBe(ST_CAPTURED);
    expect(b.state).toBe(ST_IDLE);
    expect(b.target).toBe(0);
    expect(d.ops).toEqual([]);
    // Its cost is not refunded; no progress on the cipher.
    expect(ww.politics.country(GBR)!.ppMilli).toBe(pp - 50_000);
    expect(d.decrypted).toEqual([]);
  });
});
