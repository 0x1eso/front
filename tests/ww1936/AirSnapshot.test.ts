// World War 1936 P4 Task 16 (spec §23.2's last line, §19.5): the air
// war's restore oracle on ww1936sea (seaAirLockstep.ts with the air war:
// fighters of both sides over the central sea and London, Italian bombers
// on London's industry, a bombed factory under repair, Italy out of
// fuel). A copy restored mid-campaign, mid-repair and mid-shortage runs
// 600 ticks beside the game with the same turns (the game hash every
// tick, the World War state every 25 ticks, the snapshot bytes and object
// graphs at both ends); two runs give the same navy and air hashes every
// tick; the air hash covers every field of its snapshot.
import type { Game } from "@openfront/engine/game/Game";
import {
  type Moment,
  newRunner,
  runLockstep,
  seaAirMoments,
  tick,
} from "./lockstep";
import {
  seaAirHand,
  seaAirIntents,
  seaAirStart,
  seaFiles,
  SET_TICK,
} from "./seaAirLockstep";
import { withTestPolitics } from "./util";

withTestPolitics();

function moments(names: string[]): Moment[] {
  const all = seaAirMoments();
  return names.map((n) => {
    const m = all.find((x) => x.name === n);
    if (m === undefined) throw new Error(`no moment "${n}"`);
    return m;
  });
}

/** One run of the scenario: the navy's and the air war's hash every tick. */
async function hashes(until: number): Promise<[number, number][]> {
  const r = await newRunner(seaAirStart(), await seaFiles());
  const hand = seaAirHand({ air: true });
  const out: [number, number][] = [];
  while (r.game.ticks() < until) {
    tick(r, { turnNumber: r.game.ticks(), intents: seaAirIntents(r.game) });
    hand(r.game);
    const ww = r.game.worldWar()!;
    out.push([ww.navy.hash(), ww.air.hash()]);
  }
  return out;
}

describe("the air war restores exactly (spec §19.5)", () => {
  test("restoring mid-repair and mid-shortage continues exactly", async () => {
    const names = [
      "an air campaign",
      "a bombed building under repair",
      "a fuel shortage",
    ];
    const rep = await runLockstep({
      start: seaAirStart(),
      files: await seaFiles(),
      until: SET_TICK + 700,
      window: 600,
      wwEvery: 25,
      graphs: true,
      moments: moments(names),
      intents: seaAirIntents,
      hand: seaAirHand({ air: true }),
    });
    expect(rep.missed).toEqual([]);
    expect(rep.restores.map((r) => r.name)).toEqual(names);
  }, 600_000);

  test("the navy and air hashes match across two runs", async () => {
    const a = await hashes(SET_TICK + 400);
    const b = await hashes(SET_TICK + 400);
    expect(b).toEqual(a);
    // They move: the war is on in both.
    expect(new Set(a.map((x) => x[0])).size).toBeGreaterThan(50);
    expect(new Set(a.map((x) => x[1])).size).toBeGreaterThan(20);
  }, 300_000);

  // Spec §19.5 (Task 16): a desync in any field the snapshot holds shows
  // in the air war's hash on the tick it happens.
  test("the air hash covers its whole state", async () => {
    const r = await newRunner(seaAirStart(), await seaFiles());
    const hand = seaAirHand({ air: true });
    while (r.game.ticks() < SET_TICK + 30) {
      tick(r, { turnNumber: r.game.ticks(), intents: seaAirIntents(r.game) });
      hand(r.game);
    }
    const g: Game = r.game;
    const air = g.worldWar()!.air;
    const d = air.deployments.values().next().value!;
    const z = air.zoneState.find((x) => x.sorties.size > 0)!;
    expect(z).toBeDefined();
    const changes: [string, () => void][] = [
      ["a deployment's target", () => (d.target += 1)],
      ["a deployment's base", () => (d.base += 1)],
      ["a deployment's loss remainder", () => (d.lossRest += 1)],
      ["a deployment's counts", () => (d.counts[0] += 1)],
      ["a zone's sorties", () => z.sorties.set(999, [1])],
      ["a zone's enemy superiority", () => z.enemySup.set(999, 1)],
      ["a zone's naval search", () => z.navalSearch.set(999, 1)],
      ["a zone's day", () => (z.lastDay += 1)],
      [
        "a country's air experience",
        () => (air.countries()[0].airXpMilli += 1),
      ],
      ["a country's auto zones", () => air.countries()[0].autoZones.push(1)],
      ["the next deployment id", () => (air.nextDeploymentId += 1)],
    ];
    for (const [what, change] of changes) {
      const h = air.hash();
      change();
      expect(air.hash(), what).not.toBe(h);
    }
  }, 120_000);
});
