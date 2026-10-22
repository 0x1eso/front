// World War 1936 P6 (plan Task 22 Step 3, spec §22.1–§22.2): the depth
// systems' cost under load. On ww1936deep every country fights every other
// side, and the depth state is filled by hand past what a game holds at
// once: 40 operatives, 20 operations, 200 designs and a minefield of each
// side in every sea zone. The P6 part of a tick — the depth clock (country
// turns and the common day), its end of tick, its update, and the hooks P4
// calls each sea region's and air zone's day — must average within three
// times its desktop budget (0.3 ms, CI jitter) over 1,000 ticks, on the
// best of several batches by this thread's CPU clock (like LandPerf). The
// intelligence level of one observer row, 93 targets × 4 domains (372
// intelLevel calls on made-up inputs), within three times 0.05 ms.
import {
  PLANE_BASES,
  TANK_BASES,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { WW_TECH_IDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  SHIP_CLASSES,
  SHIP_GENS,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  recommendedPlane,
  recommendedShip,
  recommendedTank,
} from "@openfront/engine-lib/ww1936/DesignRules";
import {
  type IntelInput,
  intelLevel,
} from "@openfront/engine-lib/ww1936/IntelRules";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { ST_OPERATION } from "@openfront/engine/ww1936/depth/Operatives";
import type {
  DesignSlot,
  Operative,
  WwDepth,
} from "@openfront/engine/ww1936/depth/WwDepth";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { step, stepTo, wwRunner } from "./util";

/** Every ship design base: class_generation. */
const SHIP_BASES = SHIP_CLASSES.flatMap((c) =>
  Array.from({ length: SHIP_GENS[c] }, (_, g) => `${c}_${g + 1}`),
);

/** Spec §22.1: the P6 sum's desktop mean, and the intel row's. */
const P6_MEAN_MS = 0.3;
const INTEL_ROW_MS = 0.05;
/** Controller ruling (CI jitter): three times the desktop budget. */
const JITTER = 3;
const WARMUP_TICKS = 100;
const BATCHES = 5;
const TICKS_PER_BATCH = 200;

type ThreadCpu = (prev?: NodeJS.CpuUsage) => NodeJS.CpuUsage;
const threadCpu = (
  process as { threadCpuUsage?: ThreadCpu }
).threadCpuUsage?.bind(process);

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

/** Every country of the deep map, at war with every other side, depth state filled. */
async function loadedGame(): Promise<{
  runner: GameRunner;
  d: WwDepth;
  counts: { operatives: number; ops: number; designs: number; mines: number };
}> {
  const runner = await wwRunner({}, [], DEEP.map);
  stepTo(runner, WW_PREP_TICKS + 2);
  const g = runner.game;
  const ww = g.worldWar()!;
  const d = ww.depth;
  const land = ww.land;
  const ids = land.countries().map((c) => c.smallID);
  for (const a of ids) {
    for (const b of ids) {
      if (a < b && !land.sameSide(a, b)) ww.setWar(a, b, g.ticks());
    }
  }
  const day = ww.day(g.ticks());
  const techs = new Set(WW_TECH_IDS);
  // 40 operatives (an agency each), 20 operations against the next country.
  let operatives = 0;
  let uid = 1_000;
  for (let i = 0; operatives < 40; i = (i + 1) % ids.length) {
    const id = ids[i];
    const c = d.country(id)!;
    c.intel.agency = true;
    const o: Operative = {
      uid: uid++,
      codename: c.intel.nextCodename++,
      skill: 1 + (operatives % 3),
      abroadDays: 0,
      state: 0,
      target: 0,
      mission: -1,
      op: 0,
      sinceDay: day,
      travelLeft: 0,
      releaseDay: -1,
      recruitLeft: 0,
    };
    c.intel.operatives.push(o);
    operatives++;
  }
  const busy = new Set<number>();
  for (let n = 0; d.ops.length < 20; n++) {
    const owner = ids[n % ids.length];
    const target = ids[(n + 1) % ids.length];
    const free = d
      .country(owner)!
      .intel.operatives.filter((o) => !busy.has(o.uid));
    if (free.length === 0) continue;
    const o = free[0];
    busy.add(o.uid);
    o.state = ST_OPERATION;
    o.target = target;
    const opUid = uid++;
    o.op = opUid;
    d.ops.push({
      uid: opUid,
      kind: n % 4,
      owner,
      target,
      operatives: [o.uid],
      startDay: day,
      // Longer than the run: every one is still going at the end.
      endDay: day + 10_000,
    });
  }
  // 200 designs: every slot of each kind, country by country.
  let designs = 0;
  const slot = (def: DesignSlot["def"]): DesignSlot => ({
    def,
    origin: "own",
    from: 0,
    fromSlot: 0,
    obsolete: false,
    savedDay: day,
  });
  for (const id of ids) {
    const des = d.country(id)!.des;
    for (const [kind, n] of [
      ["tank", des.tank.length],
      ["plane", des.plane.length],
      ["ship", des.ship.length],
    ] as const) {
      for (let s = 0; s < n && designs < 200; s++, designs++) {
        const def =
          kind === "tank"
            ? recommendedTank(TANK_BASES[s % TANK_BASES.length], techs, "tank")
            : kind === "plane"
              ? recommendedPlane(PLANE_BASES[s % PLANE_BASES.length], techs)
              : recommendedShip(SHIP_BASES[s % SHIP_BASES.length], techs);
        des[kind][s] = slot({ ...def, name: `D${designs}` } as never);
        d.markDesign(id, kind, s + 1);
      }
    }
    if (designs >= 200) break;
  }
  // A minefield of each side in every sea zone.
  const sides = [...new Set(ids.map((id) => land.sideOf(id)))].sort(
    (a, b) => a - b,
  );
  const rows: [number, number, number][] = [];
  for (const s of ww.scenario.strategicList()) {
    if (s.kind !== "sea") continue;
    for (const side of sides) rows.push([s.id, side, 150_000]);
  }
  d.sea.mines = rows;
  d.reindexSparse();
  return {
    runner,
    d,
    counts: { operatives, ops: d.ops.length, designs, mines: rows.length },
  };
}

describe("the depth systems' cost (spec §22.1, §22.2)", () => {
  test(`a loaded deep map: the P6 part of a tick within ${JITTER}× ${P6_MEAN_MS} ms`, async () => {
    const { runner, d, counts } = await loadedGame();
    expect(counts).toEqual({
      operatives: 40,
      ops: 20,
      designs: 200,
      mines: counts.mines,
    });
    expect(counts.mines).toBeGreaterThan(2);
    // The P6 part: WorldWarExecution's depth calls and P4's hooks into it.
    let cpu = 0;
    const timed = (obj: object, name: string) => {
      const rec = obj as Record<string, (...a: unknown[]) => unknown>;
      const f = rec[name].bind(obj);
      rec[name] = (...a: unknown[]) => {
        const c = threadCpu?.();
        const w = performance.now();
        const v = f(...a);
        const used = threadCpu?.(c);
        cpu +=
          used === undefined
            ? performance.now() - w
            : (used.user + used.system) / 1000;
        return v;
      };
    };
    for (const m of [
      "clock",
      "endTick",
      "takeData",
      "seaRegionDay",
      "airZoneDay",
    ]) {
      timed(d, m);
    }
    step(runner, WARMUP_TICKS);
    const means: number[] = [];
    for (let b = 0; b < BATCHES; b++) {
      cpu = 0;
      step(runner, TICKS_PER_BATCH);
      means.push(cpu / TICKS_PER_BATCH);
    }
    const best = Math.min(...means);
    console.log(
      `depth part, deep map, ${counts.operatives} operatives, ${counts.ops} operations, ` +
        `${counts.designs} designs, ${counts.mines} minefields: best batch ` +
        `${best.toFixed(3)} ms/tick cpu (batches ${means.map((m) => m.toFixed(3)).join(" / ")})`,
    );
    // Still loaded at the end: the operations and minefields stood.
    expect(d.ops.length).toBeGreaterThan(0);
    expect(d.sea.mines.length).toBeGreaterThan(0);
    expect(best).toBeLessThan(P6_MEAN_MS * JITTER);
  }, 120_000);

  test(`one observer's intelligence row (93 × 4): within ${JITTER}× ${INTEL_ROW_MS} ms`, () => {
    // Made-up inputs: every flag pattern the row can meet, by target.
    const inputs: IntelInput[] = [];
    for (let t = 0; t < 93; t++) {
      for (let domain = 0; domain < 4; domain++) {
        inputs.push({
          domain,
          sameFaction: t % 7 === 0,
          neighbour: t % 3 === 0,
          atWar: t % 5 === 0,
          networkMilliPm: (t * 37_000) % 1_000_000,
          department: t % 2 === 0,
          infiltrated: t % 11 === 0,
          decrypted: t % 13 === 0,
          exploiting: t % 17 === 0,
          recon: t % 4 === 0,
          skirmisher: t % 9 === 0,
          radar: t % 6 === 0,
          targetCounterMissions: t % 4,
          intelPct: (t * 13) % 100,
        });
      }
    }
    expect(inputs).toHaveLength(372);
    let sum = 0;
    const row = () => {
      for (const i of inputs) sum += intelLevel(i);
    };
    for (let i = 0; i < 200; i++) row();
    // Best of 8 batches of 100 rows (the CPU clock is coarse: the batch).
    let best = Infinity;
    for (let b = 0; b < 8; b++) {
      const c = threadCpu?.();
      const w = performance.now();
      for (let i = 0; i < 100; i++) row();
      const used = threadCpu?.(c);
      const ms =
        used === undefined
          ? performance.now() - w
          : (used.user + used.system) / 1000;
      best = Math.min(best, ms / 100);
    }
    console.log(
      `intelligence row, 372 intelLevel calls: ${best.toFixed(4)} ms (budget ${INTEL_ROW_MS} ms)`,
    );
    expect(sum).toBeGreaterThan(0);
    expect(best).toBeLessThan(INTEL_ROW_MS * JITTER);
  });
});
