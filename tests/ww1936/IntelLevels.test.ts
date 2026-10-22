// World War 1936 P6 lane I (plan Task 5, spec §8.8, plan decision 16):
// the intelligence levels — deterministic across runs and a restore, the
// faction floor, infiltration, radar, and the lines the drawer shows.
import {
  ID_AIR,
  ID_ARMY,
  ID_CIVIL,
  ID_NAVY,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { hexOf } from "@openfront/engine-lib/ww1936/DepthRules";
import {
  IntelInput,
  intelLevel,
} from "@openfront/engine-lib/ww1936/IntelRules";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { snapshotGame } from "@openfront/engine/snapshot/GameSnapshot";
import {
  computeIntelRow,
  levelLines,
  radarSrOf,
} from "@openfront/engine/ww1936/depth/IntelLevels";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { diffGraphs, diffSnapshots } from "../util/Snapshot";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { gameHash, step, stepTo, wwRestore, wwRunner } from "./util";

// Two AI majors found early (K5's table, historical AI) so their AI works too.
beforeEach(() =>
  usePoliticsContent(
    depthFixture({
      agencyStarts: [
        { tag: "DEU", date: "1936-01-05" },
        { tag: "SUN", date: "1936-01-08" },
      ],
    }),
  ),
);
afterEach(() => usePoliticsContent(null));

const { DEU, GBR, FRA, ITA, TUR } = DEEP.tag;
const HUMANS = [{ clientID: "HUMANGBR", country: "GBR" as const }];

async function game(): Promise<GameRunner> {
  const r = await wwRunner({}, HUMANS, DEEP.map);
  stepTo(r, WW_PREP_TICKS + 1);
  return r;
}

/** Britain's orders of the determinism runs: an agency, an operative on Germany, codes. */
function britain(r: GameRunner): void {
  const d = r.game.worldWar()!.depth;
  const t = r.game.ticks();
  expect(d.issue(GBR, { kind: "intel_found" }, t)).toBeNull();
  expect(d.issue(GBR, { kind: "operative_recruit" }, t)).toBeNull();
  expect(d.issue(GBR, { kind: "crypto_target", target: DEU }, t)).toBeNull();
  d.infiltrations.push([GBR, ITA, ID_ARMY]);
}

function assign(r: GameRunner): void {
  const d = r.game.worldWar()!.depth;
  const o = d.country(GBR)!.intel.operatives[0];
  expect(
    d.issue(
      GBR,
      {
        kind: "operative_assign",
        operative: o.uid,
        target: DEU,
        mission: "build_network",
      },
      r.game.ticks(),
    ),
  ).toBeNull();
}

describe("World War 1936 P6: intelligence levels (lane I)", () => {
  it("intel levels are identical on two runs and after save and restore", async () => {
    const a = await game();
    const c = await game();
    for (const r of [a, c]) britain(r);
    step(a, 260);
    step(c, 260);
    for (const r of [a, c]) assign(r);
    step(a, 300);
    const b = await wwRestore(a, HUMANS, DEEP.map);
    step(c, 600);
    step(a, 300);
    step(b, 300);
    const da = a.game.worldWar()!.depth;
    const db = b.game.worldWar()!.depth;
    const dc = c.game.worldWar()!.depth;
    // Something happened: Germany's agency, Britain's network.
    expect(da.country(DEU)!.intel.agency).toBe(true);
    expect(da.netMilli(GBR, DEU)).toBeGreaterThan(0);
    expect(hexOf(db.intelLevels)).toBe(hexOf(da.intelLevels));
    expect(hexOf(dc.intelLevels)).toBe(hexOf(da.intelLevels));
    expect(JSON.stringify(db.snapshot())).toBe(JSON.stringify(da.snapshot()));
    expect(JSON.stringify(dc.snapshot())).toBe(JSON.stringify(da.snapshot()));
    expect(gameHash(b)).toBe(gameHash(a));
    expect(gameHash(c)).toBe(gameHash(a));
    // Not the stub's 100s any more.
    expect(da.intelOf(GBR, TUR, ID_ARMY)).toBeLessThan(80);
  }, 120_000);

  it("a game restored with operatives in the field continues identically", async () => {
    const a = await game();
    const ww = a.game.worldWar()!;
    const d = ww.depth;
    const tick = a.game.ticks();
    expect(d.issue(GBR, { kind: "intel_found" }, tick)).toBeNull();
    const c = d.country(GBR)!;
    // Three slots, three recruits ready.
    c.intel.upgrades |= 1 | 2;
    for (let n = 0; n < 3; n++) {
      expect(d.issue(GBR, { kind: "operative_recruit" }, tick)).toBeNull();
    }
    for (const o of c.intel.operatives) o.recruitLeft = 0;
    const [net, op, road] = c.intel.operatives;
    ww.politics.country(GBR)!.ppMilli = 200_000;
    d.setNetMilli(GBR, DEU, 400_000);
    // One builds the network in Germany, one infiltrates its army, one is
    // on the road to Italy; the codes are broken and exploited.
    for (const [o, target] of [
      [net, DEU],
      [road, ITA],
    ] as const) {
      expect(
        d.issue(
          GBR,
          {
            kind: "operative_assign",
            operative: o.uid,
            target,
            mission: "build_network",
          },
          tick,
        ),
      ).toBeNull();
    }
    expect(
      d.issue(
        GBR,
        {
          kind: "operation_start",
          op: "op_infiltrate_army",
          target: DEU,
          operatives: [op.uid],
        },
        tick,
      ),
    ).toBeNull();
    d.decrypted.push({
      o: GBR,
      t: DEU,
      progressMilli: 1_000_000,
      activeUntil: -1,
    });
    expect(
      d.issue(GBR, { kind: "crypto_activate", target: DEU }, tick),
    ).toBeNull();
    step(a, 150);
    expect(d.ops.length).toBe(1);
    const b = await wwRestore(a, HUMANS, DEEP.map);
    expect(gameHash(b)).toBe(gameHash(a));
    for (let i = 0; i < 300; i++) {
      step(a);
      step(b);
      expect(gameHash(b)).toBe(gameHash(a));
    }
    expect(diffSnapshots(snapshotGame(a.game), snapshotGame(b.game))).toEqual(
      [],
    );
    expect(diffGraphs(a.game, b.game)).toEqual([]);
    // The same field in both: operatives, operations, codes.
    const db = b.game.worldWar()!.depth;
    expect(db.country(GBR)!.intel).toEqual(c.intel);
    expect(db.ops).toEqual(d.ops);
    expect(db.infiltrations).toEqual(d.infiltrations);
    expect(db.decrypted).toEqual(d.decrypted);
  }, 120_000);

  it("a faction member sees at least 80", async () => {
    const r = await game();
    const ww = r.game.worldWar()!;
    const d = ww.depth;
    expect(ww.sameFaction(DEU, ITA)).toBe(true);
    expect(ww.sameFaction(DEU, TUR)).toBe(false);
    // An AI country at peace writes its row every 10 days (its own day).
    computeIntelRow(d, DEU, 10 + (DEU % 10) + 1);
    expect(d.intelOf(DEU, TUR, ID_ARMY)).toBe(100);
    computeIntelRow(d, DEU, 10 + (DEU % 10));
    for (const k of [ID_CIVIL, ID_ARMY, ID_NAVY, ID_AIR]) {
      expect(d.intelOf(DEU, ITA, k)).toBeGreaterThanOrEqual(80);
      expect(d.intelOf(DEU, TUR, k)).toBeLessThan(80);
      expect(d.intelOf(DEU, DEU, k)).toBe(100);
    }
  });

  it("infiltration adds 30 to army intel only", async () => {
    const r = await game();
    const ww = r.game.worldWar()!;
    const d = ww.depth;
    const day = ww.day(r.game.ticks());
    const row = () => [0, 1, 2, 3].map((k) => d.intelOf(GBR, DEU, k));
    computeIntelRow(d, GBR, day);
    const before = row();
    expect(before[ID_ARMY]).toBeLessThanOrEqual(70);
    d.infiltrations.push([GBR, DEU, ID_ARMY]);
    computeIntelRow(d, GBR, day);
    const after = row();
    expect(after[ID_ARMY]).toBe(before[ID_ARMY] + 30);
    expect([after[ID_CIVIL], after[ID_NAVY], after[ID_AIR]]).toEqual([
      before[ID_CIVIL],
      before[ID_NAVY],
      before[ID_AIR],
    ]);
  });

  it("a radar reaching a country's region adds 10 to air intel", async () => {
    const r = await game();
    const ww = r.game.worldWar()!;
    const d = ww.depth;
    const day = FRA % 10;
    computeIntelRow(d, FRA, day);
    const before = [0, 1, 2, 3].map((k) => d.intelOf(FRA, DEU, k));
    // A radar station in Paris: its own land zone holds Berlin and Munich.
    ww.economy.buildingArray("radar")[DEEP.region.paris] = 1;
    expect(radarSrOf(d, FRA)).toContain(DEEP.sr.westLand);
    computeIntelRow(d, FRA, day);
    const after = [0, 1, 2, 3].map((k) => d.intelOf(FRA, DEU, k));
    expect(after).toEqual(before.map((v, k) => (k === ID_AIR ? v + 10 : v)));
  });

  it("the level lines add up to the level", () => {
    let n = 0;
    for (let bits = 0; bits < 1 << 10; bits++) {
      for (const net of [0, 150_000, 1_000_000]) {
        for (const counter of [0, 1, 4]) {
          for (const domain of [ID_CIVIL, ID_ARMY, ID_NAVY, ID_AIR]) {
            const i: IntelInput = {
              domain,
              sameFaction: (bits & 1) !== 0,
              neighbour: (bits & 2) !== 0,
              atWar: (bits & 4) !== 0,
              networkMilliPm: net,
              department: (bits & 8) !== 0,
              infiltrated: (bits & 16) !== 0,
              decrypted: (bits & 32) !== 0,
              exploiting: (bits & 64) !== 0,
              recon: (bits & 128) !== 0,
              skirmisher: (bits & 256) !== 0,
              radar: (bits & 512) !== 0,
              targetCounterMissions: counter,
              intelPct: counter * 25,
            };
            const sum = levelLines(i).reduce((s, l) => s + l[1], 0);
            expect(sum).toBe(intelLevel(i));
            n++;
          }
        }
      }
    }
    expect(n).toBe(1024 * 36);
  });
});
