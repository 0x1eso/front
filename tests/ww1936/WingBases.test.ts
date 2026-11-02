// The air overhaul's wings and bases (ww8, lane A): forming, refills,
// ferrying, field strips, a base lost, a disband. Wing model on, DEU human.
import {
  AIR_TYPES,
  WING_FERRY_REST,
  WING_REFORM_COOLDOWN_DAYS,
  WP_FERRY,
  WP_GROUND,
  WW_FIELD_STRIP_EFF_PM,
  WW_FIELD_STRIP_PLANES,
} from "@openfront/engine-api/ww1936/AirTypes";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  baseUsesOf,
  dailyWingCountry,
  formVolunteerWings,
  formWings,
  handOverWing,
  issueAirField,
  issueWingBase,
  issueWingDisband,
  rearmWing,
  wingBaseEffPm,
} from "@openfront/engine/ww1936/air/Wings";
import type { WwAir } from "@openfront/engine/ww1936/air/WwAir";
import "./oldAirModel";
import { REGION, SEA, TAG_ID } from "./seaFixture";
import {
  clearLand,
  placeArmy,
  stepTo,
  takeRegion,
  withTestPolitics,
  wwRunner,
} from "./util";
import { giveWing, liveWings } from "./wingUtil";

withTestPolitics();

const HUMANS = [{ clientID: "HUMAN001", country: "DEU" as const }];
const DEU = TAG_ID.DEU;
const FIGHTER = AIR_TYPES.indexOf("fighter");

async function setup() {
  const runner = await wwRunner({}, HUMANS, SEA.map);
  const ww = runner.game.worldWar()!;
  const air = ww.air;
  liveWings(air);
  const ce = ww.economy.country(DEU)!;
  for (const t of AIR_TYPES) {
    for (let g = 1; g <= 3; g++) {
      const k = equipKey(t, g);
      if (k >= 0) {
        ce.stock[k] = 0;
        ce.planesDeployed[k] = 0;
      }
    }
  }
  for (const w of air.wingsOf(DEU)) air.removeWing(w.id, true);
  return { runner, ww, air, ce, tick: runner.game.ticks() };
}

const fighters = (air: WwAir) =>
  air.wingsOf(DEU).filter((w) => w.type === FIGHTER);

describe("forming", () => {
  test("at war a new wing goes to the base near the front, not the capital's", async () => {
    const { air, ww, ce, runner } = await setup();
    // Munich borders Rome; Berlin, the capital, doesn't. Both have room.
    ww.economy.addBuilding(REGION.munich, "air_base", 2);
    stepTo(runner, WW_PREP_TICKS + 1);
    ww.setWar(DEU, TAG_ID.ITA, runner.game.ticks());
    ce.stock[equipKey("fighter", 1)] = 400;
    formWings(air, DEU, 5);
    expect(fighters(air).map((w) => w.base)).toEqual([
      REGION.munich,
      REGION.munich,
    ]);
  });

  test("full wings above a reserve, numbered, at a base with room", async () => {
    const { air, ce } = await setup();
    ce.stock[equipKey("fighter", 1)] = 400;
    formWings(air, DEU, 5);
    const ws = fighters(air);
    expect(ws.map((w) => w.counts[0])).toEqual([150, 150]);
    expect(ws.map((w) => w.nameNo)).toEqual([1, 2]);
    expect(ws.every((w) => w.base === REGION.berlin)).toBe(true);
    expect(ce.stock[equipKey("fighter", 1)]).toBe(100);
    expect(ce.planesDeployed[equipKey("fighter", 1)]).toBe(300);
    expect(air.country(DEU)!.nextWingNo[FIGHTER]).toBe(3);
  });

  test("a small stock forms one wing of the minimum; below it none", async () => {
    const { air, ce } = await setup();
    ce.stock[equipKey("fighter", 1)] = 60;
    formWings(air, DEU, 5);
    expect(fighters(air)).toHaveLength(0);
    ce.stock[equipKey("fighter", 1)] = 90;
    formWings(air, DEU, 5);
    expect(fighters(air).map((w) => w.counts[0])).toEqual([40]);
  });

  test("a base without room stops it", async () => {
    const { air, ce } = await setup();
    giveWing(air, {
      owner: DEU,
      type: FIGHTER,
      planes: 390,
      base: REGION.berlin,
    });
    ce.stock[equipKey("fighter", 1)] = 600;
    giveWing(air, {
      owner: TAG_ID.ITA,
      type: FIGHTER,
      planes: 200,
      base: REGION.rome,
    });
    const before = air.wings.size;
    formWings(air, DEU, 5);
    expect(air.wings.size).toBe(before);
  });

  test("a disband rests the type for the cooldown", async () => {
    const { air, ce, tick } = await setup();
    ce.stock[equipKey("fighter", 1)] = 400;
    formWings(air, DEU, 5);
    const w = fighters(air)[0];
    expect(issueWingDisband(air, DEU, w, tick)).toBeNull();
    expect(ce.stock[equipKey("fighter", 1)]).toBe(250);
    const day = air.ww.day(tick);
    const n = air.wings.size;
    formWings(air, DEU, day + WING_REFORM_COOLDOWN_DAYS - 1);
    expect(air.wings.size).toBe(n);
    formWings(air, DEU, day + WING_REFORM_COOLDOWN_DAYS);
    expect(air.wings.size).toBe(n + 1);
  });
});

describe("refills and efficiency", () => {
  test("a rearm refills a quarter of full strength, from stock, to the room", async () => {
    const { air, ce, tick } = await setup();
    const w = giveWing(air, {
      owner: DEU,
      type: FIGHTER,
      planes: 50,
      base: REGION.berlin,
    });
    ce.stock[equipKey("fighter", 1)] = 500;
    rearmWing(air, w, tick);
    expect(w.counts[0]).toBe(50 + 37);
    expect(ce.stock[equipKey("fighter", 1)]).toBe(463);
  });

  test("a rearm swaps old planes for newer stock, five at most", async () => {
    const { air, ce, tick } = await setup();
    const w = giveWing(air, {
      owner: DEU,
      type: FIGHTER,
      counts: [150, 0, 0],
      base: REGION.berlin,
    });
    ce.planesDeployed[equipKey("fighter", 1)] = 150;
    ce.stock[equipKey("fighter", 2)] = 40;
    rearmWing(air, w, tick);
    expect(w.counts).toEqual([145, 5, 0]);
    expect(ce.stock[equipKey("fighter", 1)]).toBe(5);
  });

  test("the idle wing refills on the country's day", async () => {
    const { air, ce } = await setup();
    const w = giveWing(air, {
      owner: DEU,
      type: FIGHTER,
      planes: 20,
      base: REGION.berlin,
    });
    w.dayKills = 3;
    ce.stock[equipKey("fighter", 1)] = 500;
    dailyWingCountry(air, DEU, 4);
    expect(w.counts[0]).toBe(150);
    expect([w.prevKills, w.dayKills]).toEqual([3, 0]);
  });

  test("an overfull base cuts efficiency; a strip is 80 % and holds 100", async () => {
    const { air, tick } = await setup();
    const a = giveWing(air, {
      owner: DEU,
      type: FIGHTER,
      planes: 150,
      base: REGION.berlin,
    });
    giveWing(air, {
      owner: DEU,
      type: FIGHTER,
      planes: 150,
      base: REGION.berlin,
    });
    expect(wingBaseEffPm(air, a)).toBe(1000);
    giveWing(air, {
      owner: DEU,
      type: FIGHTER,
      planes: 300,
      base: REGION.berlin,
    });
    expect(wingBaseEffPm(air, a)).toBe(Math.floor((400 * 1000) / 600));
    air.setStrip(REGION.munich, tick + 10);
    const s = giveWing(air, {
      owner: DEU,
      type: FIGHTER,
      planes: 50,
      base: REGION.munich,
    });
    expect(air.baseCapacity(REGION.munich)).toBe(0);
    air.setStrip(REGION.munich, tick);
    expect(air.baseCapacity(REGION.munich)).toBe(WW_FIELD_STRIP_PLANES);
    expect(wingBaseEffPm(air, s)).toBe(WW_FIELD_STRIP_EFF_PM);
  });
});

describe("wing_base and air_field", () => {
  test("a ferry breaks the sortie off and counts at the destination", async () => {
    const { air, tick } = await setup();
    air.setStrip(REGION.munich, tick);
    const w = giveWing(air, {
      owner: DEU,
      type: FIGHTER,
      planes: 100,
      base: REGION.berlin,
      flying: true,
      mission: 0,
    });
    expect(
      issueWingBase(
        air,
        DEU,
        [w],
        { kind: "wing_base", wings: [w.id], base: REGION.munich },
        tick,
      ),
    ).toBeNull();
    expect(w.base).toBe(REGION.munich);
    expect(w.phase).toBe(WP_FERRY);
    expect(w.hit).toBe(REGION.berlin);
    expect(w.until).toBeGreaterThanOrEqual(tick + 1 + WING_FERRY_REST);
    // The screens' row: the target is the base it left, as w.hit.
    const row = air.takeData()!.flights!.find((f) => f[0] === w.id)!;
    expect(row[1]).toBe(WP_FERRY);
    expect(row[5]).toBe(WING_FERRY_REST);
    expect(row[6]).toBe(REGION.berlin);
    expect(w.flyMilli).toBe(0);
    expect(air.baseUse(REGION.munich)).toBe(100);
    // 100 planes fill the strip; another wing no longer fits.
    const v = giveWing(air, {
      owner: DEU,
      type: FIGHTER,
      planes: 10,
      base: REGION.berlin,
    });
    expect(
      issueWingBase(
        air,
        DEU,
        [v],
        { kind: "wing_base", wings: [v.id], base: REGION.munich },
        tick,
      ),
    ).toBe("base_full");
  });

  test("an enemy base, a plain region and a carrier are refused", async () => {
    const { air, tick } = await setup();
    const w = giveWing(air, {
      owner: DEU,
      type: FIGHTER,
      planes: 10,
      base: REGION.berlin,
    });
    const ask = (base: number) =>
      issueWingBase(
        air,
        DEU,
        [w],
        { kind: "wing_base", wings: [w.id], base },
        tick,
      );
    expect(ask(REGION.london)).toBe("not_controlled");
    expect(ask(REGION.warsaw)).toBe("no_air_base");
  });

  test("a field strip needs own land and an army near, opens in five days, at most eight", async () => {
    const { runner, air, tick } = await setup();
    clearLand(runner.game);
    expect(issueAirField(air, DEU, 9999, tick)).toBe("bad_region");
    expect(issueAirField(air, DEU, REGION.london, tick)).toBe("not_controlled");
    expect(issueAirField(air, DEU, REGION.berlin, tick)).toBe("not_buildable");
    expect(issueAirField(air, DEU, REGION.munich, tick)).toBe("no_army");
    placeArmy(runner.game, "DEU", REGION.berlin, 1);
    expect(issueAirField(air, DEU, REGION.munich, tick)).toBeNull();
    expect(air.strips.get(REGION.munich)).toBe(tick + 37);
    expect(issueAirField(air, DEU, REGION.munich, tick)).toBe("occupied");
    expect(baseUsesOf(air, DEU).some((b) => b.region === REGION.munich)).toBe(
      false,
    );
  });
});

describe("a base lost", () => {
  test("a grounded wing loses a fifth and ferries to the nearest base with room", async () => {
    const { runner, air, tick } = await setup();
    air.setStrip(REGION.munich, tick);
    const w = giveWing(air, {
      owner: DEU,
      type: FIGHTER,
      planes: 80,
      base: REGION.berlin,
    });
    takeRegion(runner.game, REGION.berlin, "FRA");
    expect(air.wings.get(w.id)).toBeDefined();
    expect(w.counts[0]).toBe(64);
    expect(w.base).toBe(REGION.munich);
    expect(w.phase).toBe(WP_FERRY);
  });

  test("with no base left the wing goes back to the stock", async () => {
    const { runner, air, ce } = await setup();
    const w = giveWing(air, {
      owner: DEU,
      type: FIGHTER,
      planes: 100,
      base: REGION.berlin,
    });
    giveWing(air, {
      owner: TAG_ID.ITA,
      type: FIGHTER,
      planes: 200,
      base: REGION.rome,
    });
    takeRegion(runner.game, REGION.berlin, "FRA");
    expect(air.wings.has(w.id)).toBe(false);
    expect(ce.stock[equipKey("fighter", 1)]).toBe(80);
  });

  test("a captured air base starts damaged; its strip is gone", async () => {
    const { runner, air, tick } = await setup();
    air.setStrip(REGION.berlin, tick);
    takeRegion(runner.game, REGION.berlin, "FRA");
    expect(air.strips.has(REGION.berlin)).toBe(false);
    expect(air.baseDamagePm(REGION.berlin)).toBe(500);
    expect(WP_GROUND).toBe(0);
  });
});

describe("volunteers and a civil war", () => {
  test("volunteer wings form idle at the host side's bases, or are refused", async () => {
    const { air, ce } = await setup();
    ce.stock[equipKey("fighter", 1)] = 200;
    expect(formVolunteerWings(air, DEU, TAG_ID.GBR, 1, "fighter", 300)).toBe(
      "no_planes",
    );
    expect(
      formVolunteerWings(air, DEU, TAG_ID.ITA, 1, "fighter", 170),
    ).toBeNull();
    const ws = fighters(air);
    expect(ws.map((w) => [w.counts[0], w.volunteerFor, w.mission])).toEqual([
      [150, TAG_ID.ITA, -1],
      [20, TAG_ID.ITA, -1],
    ]);
    expect(ce.stock[equipKey("fighter", 1)]).toBe(30);
  });

  test("a wing handed to the rebels keeps its experience and lands without orders", async () => {
    const { air } = await setup();
    const w = giveWing(air, {
      owner: DEU,
      type: FIGHTER,
      planes: 100,
      base: REGION.berlin,
      sr: 1,
      mission: 0,
      target: REGION.paris,
      flying: true,
      xpMilli: 650,
      nameNo: 4,
    });
    handOverWing(air, w, TAG_ID.POL);
    expect([w.owner, w.xpMilli, w.mission, w.target, w.phase]).toEqual([
      TAG_ID.POL,
      650,
      -1,
      0,
      WP_GROUND,
    ]);
    expect(air.wingsOf(DEU)).not.toContain(w);
  });
});
