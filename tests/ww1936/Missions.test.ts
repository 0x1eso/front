// World War 1936 P4 (plan Task 3, lane N1): mission factors and the start
// of naval battles (spec §8.1, §8.2, §9.1) on ww1936sea: Britain against
// Italy, both human. startNavalBattle is lane N2's: this file wraps it so
// the battle record exists either way (N2's stub keeps none).
import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  ENGAGE_RULES,
  FLEET_MISSIONS,
  FLEET_STATES,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { GameRunner } from "@openfront/engine/GameRunner";
import {
  engageRegion,
  fleetMissionPm,
  fleetPowerOf,
  missionPm,
} from "@openfront/engine/ww1936/navy/Missions";
import { spotRegion } from "@openfront/engine/ww1936/navy/Spotting";
import type { WwNavy } from "@openfront/engine/ww1936/navy/WwNavy";
import { REGION, SEA, SR, TAG_ID, ZONE } from "./seaFixture";
import { HUMAN, step, stepTo, withTestPolitics, wwRunner } from "./util";

const started: [zone: number, side: number, target: number][] = [];

vi.mock("@openfront/engine/ww1936/navy/NavalBattles", async (original) => {
  const real =
    await original<
      typeof import("@openfront/engine/ww1936/navy/NavalBattles")
    >();
  return {
    ...real,
    startNavalBattle: vi.fn(
      (
        navy: WwNavy,
        zone: number,
        side: number,
        target: number,
        tick: number,
      ) => {
        started.push([zone, side, target]);
        real.startNavalBattle(navy, zone, side, target, tick);
        if (navy.battles.has(zone)) return;
        // N2's stub: only the battle's record.
        const owner = navy.fleets.get(target)!.owner;
        navy.addBattle({
          zone,
          sides: [side, navy.sideOf(owner)],
          fleets: [[], [target]],
          round: 0,
          startHp: [0, 0],
          startOrg: [0, 0],
          retreating: [false, false],
          sunk: [
            [0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0],
          ],
          sunkNamed: [],
          startTick: tick,
        });
      },
    ),
  };
});

withTestPolitics();
beforeEach(() => {
  started.length = 0;
});

const HUMANS = [
  { clientID: HUMAN, country: "GBR" as const },
  { clientID: "HUMAN002", country: "ITA" as const },
];
const GBR = TAG_ID.GBR;
const ITA = TAG_ID.ITA;

async function atWar(): Promise<GameRunner> {
  const runner = await wwRunner({}, HUMANS, SEA.map);
  stepTo(runner, WW_PREP_TICKS + 1);
  runner.game.worldWar()!.setWar(GBR, ITA, runner.game.ticks());
  return runner;
}

const navyOf = (r: GameRunner) => r.game.worldWar()!.navy;

function issue(runner: GameRunner, who: number, o: WwOrder) {
  return navyOf(runner).issue(who, o, runner.game.ticks());
}

type Comp = Parameters<WwNavy["createFleet"]>[2];

function onMission(
  runner: GameRunner,
  owner: number,
  port: number,
  comp: Comp,
  mission: "patrol" | "strike" | "raid" | "escort" | "training",
  sr: number,
): number {
  const id = navyOf(runner).createFleet(owner, port, comp);
  expect(
    issue(runner, owner, { kind: "fleet_mission", fleet: id, mission, sr }),
  ).toBeNull();
  return id;
}

function atSea(runner: GameRunner, owner: number, port: number, comp: Comp) {
  const navy = navyOf(runner);
  const id = navy.createFleet(owner, port, comp);
  const zone = navy.scenario.harborOf(port);
  expect(
    issue(runner, owner, { kind: "fleet_move", fleet: id, zone }),
  ).toBeNull();
  return id;
}

/** Spotting then engagements of `sr` now, as dailySeaRegion runs them. */
function regionDay(runner: GameRunner, sr: number): void {
  const navy = navyOf(runner);
  const tick = runner.game.ticks();
  spotRegion(navy, sr, navy.day(tick));
  engageRegion(navy, sr, tick);
}

describe("mission factors (spec §8.1)", () => {
  it("the table, moving fleets, a strike force in port and sortied, fuel", async () => {
    const runner = await atWar();
    const navy = navyOf(runner);
    const pm = (id: number) => {
      const f = navy.fleets.get(id)!;
      return [
        fleetMissionPm(navy, f, "search"),
        fleetMissionPm(navy, f, "sup"),
      ];
    };
    const central = (m: "patrol" | "raid" | "escort" | "training") =>
      onMission(runner, GBR, REGION.malta, [["dd", 1, 1]], m, SR.central);
    expect(pm(central("patrol"))).toEqual([1000, 1000]);
    expect(pm(central("raid"))).toEqual([400, 250]);
    expect(pm(central("escort"))).toEqual([500, 500]);
    expect(pm(central("training"))).toEqual([200, 0]);
    const support = navy.createFleet(GBR, REGION.malta, [["dd", 1, 1]]);
    issue(runner, GBR, {
      kind: "fleet_mission",
      fleet: support,
      mission: "invasion_support",
      sr: SR.central,
    });
    expect(pm(support)).toEqual([500, 1000]);
    // On its way from London to the Central Waters.
    const away = onMission(
      runner,
      GBR,
      REGION.london,
      [["dd", 1, 1]],
      "patrol",
      SR.central,
    );
    expect(FLEET_STATES[navy.fleets.get(away)!.state]).toBe("moving");
    step(runner);
    expect(pm(away)).toEqual([200, 250]);
    const strike = onMission(
      runner,
      GBR,
      REGION.malta,
      [["dd", 1, 1]],
      "strike",
      SR.central,
    );
    expect(pm(strike)).toEqual([300, 500]);
    const f = navy.fleets.get(strike)!;
    expect(missionPm(f, "search", true)).toBe(1000);
    // A holding fleet: nothing; fuel at 600‰ cuts the rest.
    const hold = navy.createFleet(GBR, REGION.malta, [["dd", 1, 1]]);
    expect(pm(hold)).toEqual([0, 0]);
    runner.game.worldWar()!.economy.country(GBR)!.fuelRatioPm = 600;
    expect(pm(strike)).toEqual([180, 300]);
  });
});

describe("engagements (spec §8.2, §9.1)", () => {
  it("a strike force sorties against a spotted enemy and a battle opens in that zone", async () => {
    const runner = await atWar();
    const navy = navyOf(runner);
    const ww = runner.game.worldWar()!;
    const sf = onMission(
      runner,
      GBR,
      REGION.london,
      [
        ["bb", 1, 2],
        ["dd", 1, 6],
      ],
      "strike",
      SR.approaches,
    );
    const pat = onMission(
      runner,
      GBR,
      REGION.london,
      [["dd", 1, 4]],
      "patrol",
      SR.approaches,
    );
    expect(navy.fleets.get(pat)!.zone).toBe(ZONE.west);
    // Italy's battle line sails into the Western Approaches.
    const ita = atSea(runner, ITA, REGION.rome, [
      ["bb", 1, 2],
      ["dd", 1, 4],
    ]);
    expect(
      issue(runner, ITA, { kind: "fleet_move", fleet: ita, zone: ZONE.west }),
    ).toBeNull();
    const fi = navy.fleets.get(ita)!;
    while (fi.zone !== ZONE.west) step(runner);
    // The region's next day: the patrol (search 100) and the strike force
    // in port (190 × 300‰ = 57) spot it (157 × 40 / 3 ≥ 1000) and engage.
    const i = navy.scenario.srIdxOf(SR.approaches);
    const last = navy.srState[i].lastDay;
    while (navy.srState[i].lastDay === last) step(runner);
    expect(navy.spotted(ww.land.sideOf(GBR), ita)).toBe(true);
    expect(started).toEqual([[ZONE.west, ww.land.sideOf(GBR), ita]]);
    expect(navy.battles.has(ZONE.west)).toBe(true);
    const s = navy.fleets.get(sf)!;
    // Out on its sortie, it joins lane N2's battle in that zone at once.
    expect(FLEET_STATES[s.state]).toBe("battle");
    expect(navy.battles.get(ZONE.west)!.fleets.flat()).toContain(sf);
    expect(s.sortieTarget).toBe(ita);
    // London's harbor zone is the enemy's: out at once.
    expect([s.docked, s.zone]).toEqual([0, ZONE.west]);
    // The battle over, Britain's next day sends it home to wait again.
    navy.endBattle(ZONE.west);
    let n = 0;
    while (s.docked !== REGION.london && n++ < 20) step(runner);
    expect([s.docked, FLEET_STATES[s.state], s.sortieTarget]).toEqual([
      REGION.london,
      "docked",
      0,
    ]);
    expect(FLEET_MISSIONS[s.mission]).toBe("strike");
  });

  it("two enemies spotted the same day: the strike force sorties once", async () => {
    const runner = await atWar();
    const navy = navyOf(runner);
    const side = navy.sideOf(GBR);
    const sf = onMission(
      runner,
      GBR,
      REGION.malta,
      [
        ["bb", 1, 2],
        ["dd", 1, 6],
      ],
      "strike",
      SR.central,
    );
    const pat = onMission(
      runner,
      GBR,
      REGION.malta,
      [
        ["dd", 1, 4],
        ["cl", 1, 2],
      ],
      "patrol",
      SR.central,
    );
    expect(
      issue(runner, GBR, { kind: "fleet_engage", fleet: pat, rule: "always" }),
    ).toBeNull();
    // Two Italian fleets at sea in the Narrows (Central Waters, not Malta's
    // zone), put there directly: sailing there would cross a region day.
    const comps: Comp[] = [
      [
        ["bb", 1, 2],
        ["dd", 1, 4],
      ],
      [
        ["dd", 1, 4],
        ["cl", 1, 2],
      ],
    ];
    const [one, two] = comps.map((c) => {
      const f = navy.fleets.get(navy.createFleet(ITA, REGION.rome, c))!;
      f.docked = 0;
      navy.setFleetZone(f, ZONE.narrows);
      f.state = FLEET_STATES.indexOf("on_station");
      return f.id;
    });
    // Search 160 + 190 × 300‰ in port = 217: both seen the same day.
    regionDay(runner, SR.central);
    expect(navy.spotted(side, one) && navy.spotted(side, two)).toBe(true);
    expect(started).toEqual([
      [ZONE.narrows, side, one],
      [ZONE.narrows, side, two],
    ]);
    const s = navy.fleets.get(sf)!;
    expect([FLEET_STATES[s.state], s.sortieTarget]).toEqual(["sortie", one]);
    expect(s.path).toEqual([ZONE.narrows]);
  });

  it("a strike force short of fuel stays in port", async () => {
    const runner = await atWar();
    const navy = navyOf(runner);
    const sf = onMission(
      runner,
      GBR,
      REGION.malta,
      [
        ["bb", 1, 2],
        ["dd", 1, 6],
      ],
      "strike",
      SR.central,
    );
    // 99‰ (spec §15.4: below 100‰ no sortie); its search in port still spots.
    runner.game.worldWar()!.economy.country(GBR)!.fuelRatioPm = 99;
    const ita = atSea(runner, ITA, REGION.rome, [["bb", 1, 4]]);
    // Search 190 × 29‰ = 5; vis 30 + 3 × 2 = 36: 60‰ a day.
    for (let d = 0; d < 30 && !navy.spotted(navy.sideOf(GBR), ita); d++) {
      regionDay(runner, SR.central);
    }
    expect(navy.spotted(navy.sideOf(GBR), ita)).toBe(true);
    expect(started).toEqual([]);
    expect(navy.fleets.get(sf)!.docked).toBe(REGION.malta);
  });

  it("avoid never starts a battle", async () => {
    const runner = await atWar();
    const navy = navyOf(runner);
    const pat = onMission(
      runner,
      GBR,
      REGION.malta,
      [
        ["dd", 1, 4],
        ["cl", 1, 2],
      ],
      "patrol",
      SR.central,
    );
    expect(
      issue(runner, GBR, { kind: "fleet_engage", fleet: pat, rule: "avoid" }),
    ).toBeNull();
    // A lone battleship (vis 30: 160 × 30 / 3 ≥ 1000), weaker than the patrol.
    const ita = atSea(runner, ITA, REGION.rome, [["bb", 1, 1]]);
    regionDay(runner, SR.central);
    expect(navy.spotted(navy.sideOf(GBR), ita)).toBe(true);
    expect(started).toEqual([]);
    expect(navy.battles.size).toBe(0);
  });

  it("if_stronger compares fleetPower", async () => {
    const runner = await atWar();
    const navy = navyOf(runner);
    const side = navy.sideOf(GBR);
    // Britain: 4 destroyers + 2 light cruisers on patrol (if_stronger).
    const pat = onMission(
      runner,
      GBR,
      REGION.malta,
      [
        ["dd", 1, 4],
        ["cl", 1, 2],
      ],
      "patrol",
      SR.central,
    );
    expect(ENGAGE_RULES[navy.fleets.get(pat)!.engage]).toBe("if_stronger");
    // Too strong: two battleships and four destroyers.
    const big = atSea(runner, ITA, REGION.rome, [
      ["bb", 1, 2],
      ["dd", 1, 4],
    ]);
    const ours = fleetPowerOf(navy, navy.fleets.get(pat)!);
    expect(fleetPowerOf(navy, navy.fleets.get(big)!)).toBeGreaterThan(ours);
    regionDay(runner, SR.central);
    expect(navy.spotted(side, big)).toBe(true);
    expect(started).toEqual([]);
    // Weak enough: two destroyers and a light cruiser (vis 16 + 2 × 2 = 20: 160 × 20 / 3).
    const small = atSea(runner, ITA, REGION.rome, [
      ["dd", 1, 2],
      ["cl", 1, 1],
    ]);
    expect(fleetPowerOf(navy, navy.fleets.get(small)!)).toBeLessThanOrEqual(
      ours,
    );
    regionDay(runner, SR.central);
    expect(started).toEqual([[ZONE.middle, side, small]]);
    expect(FLEET_MISSIONS[navy.fleets.get(pat)!.mission]).toBe("patrol");
  });
});
