// World War 1936 P4 Task 16 (spec §23.2's last line, §19.5): the navy's
// restore oracle on ww1936sea (seaAirLockstep.ts's war of Britain and
// Italy). A copy restored at each moment — a naval battle in its fifth
// round, a fleet under way, an invasion in preparation, at sea and
// landing, convoys raided, a sea route found again the next day, the
// third tick of a day — runs 600 ticks beside the game with the same
// turns: the game hash every tick, the World War state every 25 ticks,
// the snapshot bytes and the object graphs at both ends. The turns then
// replay from turn 0 to the same hash every tick, and the navy's hash
// covers every field of its snapshot.
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { Game } from "@openfront/engine/game/Game";
import {
  type Moment,
  newRunner,
  replay,
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

/** The third tick of a day after the board is set (three sea regions done). */
const midDay: Moment = {
  name: "the third tick of a day",
  when: (g: Game) => {
    const ww = g.worldWar()!;
    const t = g.ticks();
    const day = ww.day(t);
    return t > SET_TICK + 40 && t - dayStartTick(day, WW_PREP_TICKS) === 3;
  },
};

describe("the navy restores exactly (spec §19.5)", () => {
  test("restoring mid-battle and mid-voyage continues exactly", async () => {
    const names = [
      "a naval battle in its fifth round",
      "a fleet under way",
      "an invasion in preparation",
      "an invasion at sea",
      "a landing battle",
      "convoys raided",
      "a sea route found again tomorrow",
    ];
    const start = seaAirStart();
    const files = await seaFiles();
    const hand = seaAirHand({ air: false });
    const rep = await runLockstep({
      start,
      files,
      until: SET_TICK + 700,
      window: 600,
      wwEvery: 25,
      graphs: true,
      moments: moments(names),
      intents: seaAirIntents,
      hand,
    });
    expect(rep.missed).toEqual([]);
    expect(rep.restores.map((r) => r.name)).toEqual(
      expect.arrayContaining(names),
    );
    // The turns again from turn 0 on a new game: the same hash every tick.
    const again = await replay(start, files, rep.turns, hand);
    expect(again).toEqual(rep.hashes);
  }, 600_000);

  test("restoring mid-day continues exactly", async () => {
    const rep = await runLockstep({
      start: seaAirStart(),
      files: await seaFiles(),
      until: SET_TICK + 700,
      window: 600,
      wwEvery: 25,
      graphs: true,
      moments: [midDay],
      intents: seaAirIntents,
      hand: seaAirHand({ air: true }),
    });
    expect(rep.missed).toEqual([]);
  }, 600_000);

  // Spec §19.5 (Task 16): a desync in any field the snapshot holds shows
  // in the navy's hash on the tick it happens.
  test("the navy hash covers its whole state", async () => {
    const r = await newRunner(seaAirStart(), await seaFiles());
    const hand = seaAirHand({ air: false });
    while (r.game.ticks() < SET_TICK + 20) {
      tick(r, { turnNumber: r.game.ticks(), intents: seaAirIntents(r.game) });
      hand(r.game);
    }
    const navy = r.game.worldWar()!.navy;
    const changes: [string, () => void][] = [
      ["a fleet's path", () => navy.fleets.values().next().value!.path.push(1)],
      [
        "a fleet's mission region",
        () => {
          navy.fleets.values().next().value!.missionSr += 1;
        },
      ],
      [
        "a ship's fleet",
        () => {
          navy.ships.fleet[0] += 1;
        },
      ],
      [
        "a ship's deck",
        () => {
          navy.ships.deck[0] += 1;
        },
      ],
      [
        "a route's zones",
        () => navy.routes.values().next().value!.zones.push(1),
      ],
      [
        "a route's next day",
        () => {
          navy.routes.values().next().value!.nextDay += 1;
        },
      ],
      [
        "an invasion's preparation",
        () => {
          navy.invasions.values().next().value!.prepDays += 1;
        },
      ],
      [
        "a raid remainder",
        () => {
          navy.srState[0].raidRest.set(99, 1);
        },
      ],
      [
        "a country's convoy losses",
        () => {
          navy.countries()[0].convoyLoss[0] += 1;
        },
      ],
      [
        "the next voyage id",
        () => {
          navy.nextVoyageId += 1;
        },
      ],
    ];
    for (const [what, change] of changes) {
      const h = navy.hash();
      change();
      expect(navy.hash(), what).not.toBe(h);
    }
  }, 120_000);
});
