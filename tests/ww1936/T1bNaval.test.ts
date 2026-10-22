// World War 1936 P6 T1b (navy/air half): the four P6 admiral traits (spec
// §4.2) and a ship design's hit % (plan Step 15) in P4's naval battles,
// convoy war and spotting, on ww1936sea — a human Britain against a human
// Italy, fleets put to sea by hand.
import {
  admiralTraitBit,
  CONVOY_USES,
  FLEET_STATES,
  type AdmiralTrait,
  type ShipClass,
} from "@openfront/engine-api/ww1936/NavyTypes";
import {
  aswDamageMilli,
  convoySinkMilli,
  escortPowerCenti,
  raidPowerCenti,
} from "@openfront/engine-lib/ww1936/ConvoyRules";
import { admiralPct } from "@openfront/engine/ww1936/navy/AdmiralTraits";
import { convoyWar } from "@openfront/engine/ww1936/navy/ConvoyWar";
import {
  startNavalBattle,
  stepNavalBattles,
} from "@openfront/engine/ww1936/navy/NavalBattles";
import { fleetVisOf } from "@openfront/engine/ww1936/navy/Spotting";
import type { Fleet, WwNavy } from "@openfront/engine/ww1936/navy/WwNavy";
import { fleetAtSea, seaGame, war } from "./convoyUtil";
import { REGION, SR, TAG_ID, ZONE } from "./seaFixture";
import { withTestPolitics } from "./util";

withTestPolitics();

const GBR = TAG_ID.GBR;
const ITA = TAG_ID.ITA;
const PORT: Record<number, number> = {
  [GBR]: REGION.london,
  [ITA]: REGION.rome,
};

function atSea(
  navy: WwNavy,
  owner: number,
  comp: readonly (readonly [ShipClass, number, number])[],
): Fleet {
  const f = navy.fleets.get(navy.createFleet(owner, PORT[owner], comp))!;
  f.docked = 0;
  f.state = FLEET_STATES.indexOf("on_station");
  navy.setFleetZone(f, ZONE.west);
  return f;
}

/** An admiral of every skill 0 with `traits` commanding `f`. */
function admiral(navy: WwNavy, f: Fleet, traits: AdmiralTrait[]): void {
  const id = 900_000 + f.id;
  let bits = 0;
  for (const t of traits) bits |= admiralTraitBit(t);
  navy.admirals.set(id, {
    id,
    owner: f.owner,
    xpMilli: 0,
    level: 1,
    skills: [0, 0, 0, 0],
    traits: bits,
    fleet: f.id,
    usage: [0, 0, 0, 0],
  });
  f.admiral = id;
}

const hpSum = (navy: WwNavy, f: Fleet) =>
  f.ships.reduce((n, id) => n + navy.ships.hp[navy.ships.rowOf(id)], 0);

/**
 * One round of a battle in the Western Approaches: Britain's `mine`
 * against Italy's `theirs`; the HP Italy lost. `prep` sets Britain up.
 */
async function oneRound(
  mine: readonly (readonly [ShipClass, number, number])[],
  theirs: readonly (readonly [ShipClass, number, number])[],
  prep: (navy: WwNavy, f: Fleet) => void,
  rounds = 1,
): Promise<number> {
  const g = await seaGame();
  war(g, "GBR", "ITA");
  const { navy } = g;
  const tick = g.runner.game.ticks();
  const f = atSea(navy, GBR, mine);
  const i = atSea(navy, ITA, theirs);
  prep(navy, f);
  const before = hpSum(navy, i);
  startNavalBattle(navy, ZONE.west, navy.sideOf(GBR), i.id, tick);
  for (let k = 0; k < rounds; k++) stepNavalBattles(navy, tick);
  return before - hpSum(navy, i);
}

/** Within the battle's integer floors of `expected`. */
function near(got: number, expected: number): void {
  expect(Math.abs(got - expected)).toBeLessThanOrEqual(
    Math.max(5, Math.floor(expected / 200)),
  );
}

describe("T1b: admiral traits and design hit % at sea", () => {
  it("the trait table sums by mask", () => {
    const bits = (ts: AdmiralTrait[]) =>
      ts.reduce((n, t) => n | admiralTraitBit(t), 0);
    expect(admiralPct(bits(["night_fighter"]), "torpedoPct")).toBe(15);
    expect(admiralPct(bits(["convoy_master"]), "escortPct")).toBe(20);
    expect(admiralPct(bits(["fleet_tactician"]), "positioningPct")).toBe(10);
    expect(admiralPct(bits(["blockade_runner"]), "raidLossPct")).toBe(-15);
    expect(admiralPct(bits(["blockade_runner"]), "visibilityPct")).toBe(-10);
    expect(admiralPct(bits(["sea_wolf", "spotter"]), "torpedoPct")).toBe(0);
    expect(admiralPct(0, "escortPct")).toBe(0);
  });

  it("a ship design's hit % raises its guns' damage", async () => {
    const BB: [ShipClass, number, number][] = [["bb", 1, 1]];
    const plain = await oneRound(BB, BB, () => {});
    const design = await oneRound(BB, BB, (navy, f) => {
      const d = navy.ww.depth;
      d.country(GBR)!.des.ship[0] = {
        def: {
          kind: "ship",
          base: "bb_1",
          modules: ["", "", "fc_improved", "", "", ""],
          name: "FC",
        } as never,
        origin: "own",
        from: 0,
        fromSlot: 0,
        obsolete: false,
        savedDay: 0,
      };
      d.markDesign(GBR, "ship", 1);
      for (const id of f.ships) navy.ships.design[navy.ships.rowOf(id)] = 1;
      expect(d.designStatsOf(GBR, "ship", 1)).toMatchObject({ hitPct: 6 });
    });
    expect(plain).toBeGreaterThan(0);
    expect(design).toBeGreaterThan(plain);
    near(design, Math.floor((plain * 106) / 100));
  });

  it("night_fighter's submarines torpedo 15% harder", async () => {
    const SS: [ShipClass, number, number][] = [["ss", 2, 6]];
    const DD: [ShipClass, number, number][] = [["dd", 1, 4]];
    // Hidden submarines fire their torpedoes only, every second round.
    const plain = await oneRound(SS, DD, (navy, f) => admiral(navy, f, []), 2);
    const night = await oneRound(
      SS,
      DD,
      (navy, f) => admiral(navy, f, ["night_fighter"]),
      2,
    );
    expect(plain).toBeGreaterThan(0);
    near(night, Math.floor((plain * 115) / 100));
  });

  it("fleet_tactician's positioning", async () => {
    // Ten destroyers on one battleship: positioning 1000 − 90 − 100 = 810.
    const DD: [ShipClass, number, number][] = [["dd", 1, 10]];
    const BB: [ShipClass, number, number][] = [["bb", 1, 1]];
    const plain = await oneRound(DD, BB, (navy, f) => admiral(navy, f, []));
    const tac = await oneRound(DD, BB, (navy, f) =>
      admiral(navy, f, ["fleet_tactician"]),
    );
    // Damage × (500 + pos / 2): 905 → 955.
    near(tac, Math.floor((plain * 955) / 905));
  });

  it("convoy_master's escorts and blockade_runner's raiders in the convoy war", async () => {
    const run = async (escortTrait: boolean, raiderTrait: boolean) => {
      const g = await seaGame();
      const { navy, ww } = g;
      war(g, "ITA", "GBR");
      g.ce("ITA").fuelMilli = 1_000_000_000;
      const subs = fleetAtSea(
        navy,
        ITA,
        REGION.rome,
        [["ss", 2, 30]],
        ZONE.west,
        "raid",
        SR.approaches,
      );
      const esc = fleetAtSea(
        navy,
        GBR,
        REGION.london,
        [["dd", 1, 40]],
        ZONE.west,
        "escort",
        SR.approaches,
      );
      admiral(navy, esc, escortTrait ? ["convoy_master"] : []);
      admiral(navy, subs, raiderTrait ? ["blockade_runner"] : []);
      const day = ww.day(g.runner.game.ticks());
      navy.routes.set(navy.nextRouteId, {
        id: navy.nextRouteId++,
        use: CONVOY_USES.indexOf("trade"),
        owner: GBR,
        ref: 999,
        zones: [ZONE.west],
        km: 0,
        srs: [SR.approaches],
        need: 30,
        got: 30,
        nextDay: day + 7,
      });
      navy.setSpotPm(SR.approaches, ww.land.sideOf(GBR), subs.id, 1000);
      const vis = fleetVisOf(navy, subs).vis;
      const ids = [...subs.ships];
      const hp0 = ids.map((id) => navy.ships.hp[navy.ships.rowOf(id)]);
      convoyWar(navy, SR.approaches, day);
      const hurt = ids.reduce((n, id, k) => {
        const r = navy.ships.rowOf(id);
        return n + (r < 0 ? hp0[k] : hp0[k] - navy.ships.hp[r]);
      }, 0);
      const dd = navy.statsFor(GBR, "dd", 1);
      const ita = g.ce("ITA");
      return {
        loss:
          navy.srState[ww.scenario.srIdxOf(SR.approaches)].lossYesterday.get(
            GBR,
          ) ?? 0,
        hurt,
        ddSum: 40 * (dd.depth * 2 + dd.light),
        stats: g.ce("GBR").stats,
        raid: raidPowerCenti(
          30 * 2500,
          0,
          0,
          ita.stats,
          ita.researched,
          ita.fuelRatioPm,
        ),
        vis,
      };
    };
    const plain = await run(false, false);
    const master = await run(true, false);
    const runner = await run(false, true);
    const e0 = escortPowerCenti(plain.ddSum, 0, 0, 0, plain.stats);
    const e1 = escortPowerCenti(
      Math.floor((plain.ddSum * 120) / 100),
      0,
      0,
      0,
      plain.stats,
    );
    expect(plain.loss).toBe(convoySinkMilli(30, plain.raid, e0, 3));
    expect(master.loss).toBe(convoySinkMilli(30, plain.raid, e1, 3));
    expect(master.loss).toBeLessThan(plain.loss);
    // The escorts' depth charges: blockade_runner's submarines take 85%.
    expect(plain.hurt).toBe(aswDamageMilli(e0, 1000));
    expect(runner.hurt).toBe(Math.floor((aswDamageMilli(e0, 1000) * 85) / 100));
    // And they are 10% harder to find.
    expect(plain.vis).toBeGreaterThan(1);
    expect(runner.vis).toBe(Math.max(1, Math.floor((plain.vis * 90) / 100)));
  });
});
