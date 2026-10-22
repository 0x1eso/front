// World War 1936 P6 lane W1 (plan Task 7 Step 4, spec §16.5): railway
// guns. Germany and Poland are humans at war on the deep map; the board is
// cleared and each test places its armies.
import {
  RAILGUN_HIT_CENTI,
  WW_MAX_RAILGUNS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  equipKey,
  EQUIPMENT_TYPES,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import type { Game } from "@openfront/engine/game/Game";
import { joinBattle } from "@openfront/engine/ww1936/land/Battles";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import {
  byTag,
  clearLand,
  HUMAN,
  land,
  placeArmy,
  step,
  takeRegion,
  warAfterPrep,
  wwRunner,
} from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const GUN = equipKey("railway_gun", 1);

function stockUp(g: Game, tag: "DEU" | "POL"): void {
  const ce = land(g).econ.country(byTag(g, tag).smallID())!;
  for (const t of EQUIPMENT_TYPES) ce.stock[equipKey(t, 1)] += 100_000;
  ce.manpower += 1_000_000;
}

/** Germany at war with Poland, the board cleared, both stocked; Germany has no railway gun. */
async function war() {
  const runner = await wwRunner(
    {},
    [
      { clientID: HUMAN, country: "DEU" },
      { clientID: "HUMAN002", country: "POL" },
    ],
    DEEP.map,
  );
  warAfterPrep(runner, HUMAN, "POL");
  const g = runner.game;
  clearLand(g);
  stockUp(g, "DEU");
  stockUp(g, "POL");
  const ww = g.worldWar()!;
  const deu = DEEP.tag.DEU;
  const ce = ww.economy.country(deu)!;
  ce.stock[GUN] = 0;
  expect(ww.land.isEnemy(deu, DEEP.tag.POL)).toBe(true);
  return { runner, g, ww, d: ww.depth, l: ww.land, deu, ce };
}

describe("World War 1936 P6: railway guns (spec §16.5)", () => {
  it("rail guns hit only from a region with rail 2 or more", async () => {
    const { runner, g, ww, d, l, deu, ce } = await war();
    const berlin = DEEP.region.berlin;
    const warsaw = DEEP.region.warsaw;
    const a = placeArmy(g, "DEU", berlin, 1);
    placeArmy(g, "POL", warsaw, 1);
    const tick = runner.game.ticks();
    const assign = (count: number) =>
      d.issue(deu, { kind: "railgun_assign", army: a.id, count }, tick);
    // From the stock only, two an army.
    expect(assign(1)).toBe("railgun_limit");
    ce.stock[GUN] = 3;
    expect(assign(2)).toBeNull();
    expect(a.railGuns).toBe(WW_MAX_RAILGUNS);
    expect(ce.stock[GUN]).toBe(1);
    expect(assign(1)).toBe("railgun_limit");
    expect(
      d.issue(DEEP.tag.POL, { kind: "railgun_return", army: a.id }, tick),
    ).toBe("no_army");
    expect(d.world.railGuns).toEqual([[a.id, deu, 2, berlin]]);
    const side = l.sideOf(deu);
    expect(d.railGunHits(warsaw, side)).toBe(0);
    for (const id of a.divisions) joinBattle(l, id, warsaw);
    expect(l.battles.has(warsaw)).toBe(true);
    // Berlin's railway is 3: two guns, 6 hits each a round, the fort −2.
    expect(ww.economy.rail[berlin]).toBeGreaterThanOrEqual(2);
    expect(d.railGunHits(warsaw, side)).toBe(2 * RAILGUN_HIT_CENTI);
    expect(d.fortCut(a.id, warsaw)).toBe(2);
    // The defender's side fires none.
    expect(d.railGunHits(warsaw, l.sideOf(DEEP.tag.POL))).toBe(0);
    // A railway below 2: the guns rest.
    ww.economy.addBuilding(berlin, "rail", 1 - ww.economy.rail[berlin]);
    expect(ww.economy.rail[berlin]).toBe(1);
    expect(d.railGunHits(warsaw, side)).toBe(0);
    expect(d.fortCut(a.id, warsaw)).toBe(0);
    // Back to the stock.
    expect(
      d.issue(deu, { kind: "railgun_return", army: a.id }, tick),
    ).toBeNull();
    expect([a.railGuns, ce.stock[GUN]]).toEqual([0, 3]);
    expect(d.world.railGuns).toEqual([]);
    step(runner);
  }, 60_000);

  it("rail guns of a destroyed army are lost", async () => {
    const { runner, g, d, l, deu, ce } = await war();
    const berlin = DEEP.region.berlin;
    const munich = DEEP.region.munich;
    ce.stock[GUN] = 3;
    const lost = placeArmy(g, "DEU", berlin, 1);
    const back = placeArmy(g, "DEU", munich, 1);
    const tick = runner.game.ticks();
    expect(
      d.issue(deu, { kind: "railgun_assign", army: lost.id, count: 2 }, tick),
    ).toBeNull();
    expect(
      d.issue(deu, { kind: "railgun_assign", army: back.id, count: 1 }, tick),
    ).toBeNull();
    expect(ce.stock[GUN]).toBe(0);
    // Berlin falls with its army in it; Munich's army goes at home.
    takeRegion(g, berlin, "POL");
    for (const a of [lost, back]) {
      for (const id of [...a.divisions]) {
        l.killDivision(l.divisions.rowOf(id), true);
      }
    }
    expect(l.armies.has(lost.id)).toBe(false);
    expect(l.armies.has(back.id)).toBe(false);
    const ww = g.worldWar()!;
    const day = ww.day(runner.game.ticks());
    while (ww.day(runner.game.ticks()) === day) step(runner);
    step(runner);
    expect(d.world.railGuns).toEqual([]);
    expect(ce.stock[GUN]).toBe(1);
  }, 60_000);
});
