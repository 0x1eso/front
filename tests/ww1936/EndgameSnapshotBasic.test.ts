// World War 1936 P5 (spec §21.5, plan decision 25): the endgame's state
// survives a snapshot; a restored game goes on tick for tick.
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { snapshotGame } from "@openfront/engine/snapshot/GameSnapshot";
import { addContract } from "@openfront/engine/ww1936/endgame/LendLease";
import type {
  Conference,
  StoredDemand,
} from "@openfront/engine/ww1936/endgame/WwEndgame";
import {
  transferArmyTo,
  transferDivisionsTo,
} from "@openfront/engine/ww1936/land/PoliticsBridge";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { diffGraphs, diffSnapshots } from "../util/Snapshot";
import { END, endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import { END_MAP, gameHash, step, stepTo, wwRestore, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(endgameFixture()));
afterEach(() => usePoliticsContent(null));

const HUMANS = [{ clientID: "HUMANPOL", country: "POL" as const }];

/** Every number, boolean and string under `o`, as a settable place. */
interface Leaf {
  path: string;
  get(): unknown;
  set(v: unknown): void;
}
function leavesOf(o: unknown, path: string, out: Leaf[] = []): Leaf[] {
  const at = (parent: Record<string | number, unknown>, k: string | number) => {
    const v = parent[k];
    const p = `${path}.${k}`;
    if (["number", "boolean", "string"].includes(typeof v)) {
      out.push({ path: p, get: () => parent[k], set: (x) => (parent[k] = x) });
    } else if (v !== null && typeof v === "object") leavesOf(v, p, out);
  };
  if (Array.isArray(o)) o.forEach((_, i) => at(o as never, i));
  else if (o !== null && typeof o === "object") {
    for (const k of Object.keys(o)) at(o as never, k);
  }
  return out;
}

function lockstep(a: GameRunner, b: GameRunner, ticks: number): void {
  expect(diffGraphs(a.game, b.game)).toEqual([]);
  for (let i = 0; i < ticks; i++) {
    step(a);
    step(b);
    if (gameHash(a) !== gameHash(b)) {
      throw new Error(`hash diverged ${i + 1} tick(s) after restore`);
    }
  }
  expect(diffSnapshots(snapshotGame(a.game), snapshotGame(b.game))).toEqual([]);
  expect(diffGraphs(a.game, b.game)).toEqual([]);
}

describe("World War 1936 P5: the endgame in a snapshot", () => {
  it("100 ticks, a snapshot, 100 more: the same as without", async () => {
    const a = await wwRunner({}, HUMANS, END_MAP);
    stepTo(a, WW_PREP_TICKS + 2);
    const ww = a.game.worldWar()!;
    const eg = ww.endgame;
    // Some of every kind of endgame state.
    ww.setWar(endId("DEU"), endId("CSK"), a.game.ticks(), { kind: "declare" });
    ww.setWar(endId("ITA"), endId("CSK"), a.game.ticks(), {
      kind: "into",
      warId: 0,
    });
    eg.addCore(endId("DEU"), 13);
    eg.setControl("HUMANPOL", endId("AUT"));
    eg.resBp[15] = 1200;
    eg.compBp[15] = 300;
    eg.occSince[15] = 3;
    eg.zones.push({ region: 7, holder: endId("SUN"), untilDay: 999 });
    eg.dmz.push([4, endId("DEU")]);
    eg.nameKey[endId("CW1")] = "ww1936.cw_name.communist";
    eg.nameArg[endId("CW1")] = "CSK";
    ww.land.setController(15, endId("DEU"), a.game.ticks());
    step(a, 100);
    const b = await wwRestore(a, HUMANS, END_MAP);
    expect(b.game.worldWar()!.endgame.wars).toHaveLength(1);
    expect(b.game.worldWar()!.endgame.isAdministered(15)).toBe(
      eg.isAdministered(15),
    );
    expect(b.game.worldWar()!.endgame.controlledBy("HUMANPOL")).toBe(
      endId("AUT"),
    );
    lockstep(a, b, 100);
  }, 60_000);

  it("divisions that change hands go on tick for tick after a restore", async () => {
    const a = await wwRunner({}, HUMANS, END_MAP);
    stepTo(a, WW_PREP_TICKS + 2);
    // The stats caches hold the old owner's numbers first.
    step(a, 20);
    const land = a.game.worldWar()!.land;
    expect(land.rowsOf(endId("POL")).length).toBeGreaterThan(2);
    const [first] = land.armiesOf(endId("POL")).sort((x, y) => x.id - y.id);
    const ids = [...first.divisions].sort((x, y) => x - y).slice(0, 2);
    expect(first.divisions.length).toBeGreaterThan(2);
    // Two divisions to one country, the rest of the army to another.
    expect(transferDivisionsTo(land, ids, endId("CSK"))).not.toBeNull();
    expect(transferArmyTo(land, first, endId("GBR"))).not.toBeNull();
    const rows = ids.map((id) => land.divisions.rowOf(id));
    for (const r of rows) expect(land.divisions.owner[r]).toBe(endId("CSK"));
    // The by-owner row lists (warm before the transfer) moved with them.
    expect(land.rowsOf(endId("POL"))).toEqual([]);
    expect(land.rowsOf(endId("CSK"))).toEqual(expect.arrayContaining(rows));
    step(a, 30);
    const b = await wwRestore(a, HUMANS, END_MAP);
    lockstep(a, b, 60);
  }, 60_000);

  it("lend-lease contracts keep the aid AI's flag through a snapshot; the hash reads it", async () => {
    const a = await wwRunner({}, HUMANS, END_MAP);
    stepTo(a, WW_PREP_TICKS + 2);
    const ww = a.game.worldWar()!;
    const eg = ww.endgame;
    const day = ww.day(a.game.ticks());
    // One contract the aid AI owns (lane A's optional `ai`), one it does not.
    const mine = addContract(
      eg,
      endId("GBR"),
      endId("FRA"),
      "infantry_equipment",
      0,
      100,
      day,
      null,
    );
    mine.ai = true;
    addContract(eg, endId("GBR"), endId("POL"), "artillery", 0, 50, day, null);
    const h = eg.hash();
    mine.ai = undefined;
    expect(eg.hash()).not.toBe(h);
    mine.ai = true;
    expect(eg.hash()).toBe(h);
    mine.perMonth = 101;
    expect(eg.hash()).not.toBe(h);
    mine.perMonth = 100;
    step(a, 1);
    const flags = (r: GameRunner) =>
      r.game
        .worldWar()!
        .endgame.lendLease.map((c) => [c.id, c.perMonth, c.ai ?? false]);
    expect(flags(a)).toEqual([
      [mine.id, 100, true],
      [mine.id + 1, 50, false],
    ]);
    const b = await wwRestore(a, HUMANS, END_MAP);
    expect(flags(b)).toEqual(flags(a));
    expect(b.game.worldWar()!.endgame.hash()).toBe(eg.hash());
    lockstep(a, b, 60);
  }, 60_000);

  // Batch 21 glue (lane W review, minor 13): a field left out of the hash
  // hides a desync; a field left out of the snapshot breaks a restore.
  it("every stored conference, zone, dmz, reparation, arms-limit and peace-log field moves the hash and survives a restore", async () => {
    const a = await wwRunner({}, HUMANS, END_MAP);
    stepTo(a, WW_PREP_TICKS + 2);
    const eg = a.game.worldWar()!.endgame;
    const [deu, pl, sun] = [endId("DEU"), endId("POL"), endId("SUN")];
    const demand = (slot: number): StoredDemand => ({
      kind: 1,
      slot,
      regions: [6, 7],
      target: pl,
      beneficiary: deu,
      k: 2,
      pct: 30,
    });
    // Every list holds a row, so every field of a row is a leaf below. A
    // closed conference far from its wars' end: the game leaves it be.
    const conf: Conference = {
      id: eg.nextConfId++,
      warIds: [77],
      losers: [pl],
      stake: [6, 7],
      base: [120, 40],
      parts: [
        { id: deu, wsMilli: 12_345, pts: 600, human: true },
        { id: sun, wsMilli: 2_000, pts: 400, human: false },
      ],
      claims: [[deu, 6]],
      conquer: [[deu, pl]],
      topple: [[sun, pl]],
      status: 2,
      doneDay: 10_000,
      round: 2,
      roundEndTick: 99_999,
      openTick: 5,
      subs: [{ id: deu, demands: [demand(0)], passed: false }],
      ai: [{ id: sun, demands: [demand(1)] }],
      settled: [
        {
          kind: 0,
          by: deu,
          regions: [6],
          target: pl,
          beneficiary: deu,
          k: 0,
          pct: 0,
          round: 1,
          cost: 300,
        },
      ],
      lastRound: [{ by: deu, kind: 0, regions: [6], target: pl, ok: true }],
    };
    eg.conferences.push(conf);
    eg.zones.push({ region: 7, holder: sun, untilDay: 4_000 });
    eg.dmz.push([4, deu]);
    eg.reparations.push({ from: pl, to: deu, k: 3, untilDay: 7_000 });
    eg.disarm.push([pl, 9_000]);
    eg.peaceLog.push({
      day: 3,
      losers: [pl],
      lines: [{ key: "ww1936.peace.line.take", params: { who: "DEU", n: 2 } }],
    });
    const stored = {
      conference: conf,
      zones: eg.zones,
      dmz: eg.dmz,
      reparations: eg.reparations,
      disarm: eg.disarm,
      peaceLog: eg.peaceLog,
    };
    const leaves = leavesOf(stored, "eg");
    expect(leaves.length).toBeGreaterThan(70);
    const h = eg.hash();
    for (const l of leaves) {
      const v = l.get();
      l.set(
        typeof v === "number" ? v + 1 : typeof v === "boolean" ? !v : `${v}x`,
      );
      expect(eg.hash(), l.path).not.toBe(h);
      l.set(v);
    }
    expect(eg.hash()).toBe(h);
    // The snapshot carries all of it: same rows, same hash, same game.
    const b = await wwRestore(a, HUMANS, END_MAP);
    const eb = b.game.worldWar()!.endgame;
    expect(eb.hash()).toBe(h);
    expect({
      conference: eb.conferences.find((c) => c.id === conf.id),
      zones: eb.zones,
      dmz: eb.dmz,
      reparations: eb.reparations,
      disarm: eb.disarm,
      peaceLog: eb.peaceLog,
    }).toEqual(stored);
    lockstep(a, b, 30);
  }, 60_000);

  it("the first update after a restore sends the cores, occupation and aid", async () => {
    const a = await wwRunner({}, HUMANS, END_MAP);
    stepTo(a, WW_PREP_TICKS + 2);
    const ww = a.game.worldWar()!;
    const pl = endId("POL");
    const warsaw = Number(
      Object.keys(END.owner).find(
        (r) => END.owner[Number(r)] === "POL" && END.core[Number(r)],
      ),
    );
    // A core of Germany's and a Polish core region Germany holds.
    ww.endgame.addCore(endId("DEU"), 13);
    ww.land.setController(warsaw, endId("DEU"), a.game.ticks());
    expect(ww.endgame.isAdministered(warsaw)).toBe(true);
    step(a, 2);
    const b = await wwRestore(a, HUMANS, END_MAP);
    const d = b.game.worldWar()!.endgame.takeData()!;
    expect(d.coreChanges).toEqual(
      expect.arrayContaining([
        { region: 13, holders: ww.endgame.coreHolders(13) },
        { region: warsaw, holders: [pl] },
      ]),
    );
    expect(d.occupation!.map((o) => o.region)).toEqual([warsaw]);
    expect(d.aid!.map((x) => x.smallID)).toEqual([pl]);
    // Later updates send only the changes again.
    expect(b.game.worldWar()!.endgame.takeData()?.coreChanges).toBeUndefined();
  }, 60_000);

  it("a snapshot without the endgame state is refused", async () => {
    const a = await wwRunner({}, [], END_MAP);
    step(a, 2);
    const ww = a.game.worldWar()!;
    const s = ww.snapshot();
    delete s.endgame;
    expect(() => ww.restoreState(s)).toThrow(/P5 endgame/);
  });
});
