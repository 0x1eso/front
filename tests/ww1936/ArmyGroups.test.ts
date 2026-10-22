// World War 1936 P6 lane D (plan Task 2, spec §4.3): army groups — the
// deterministic front split, every army's plan at once, a group losing an
// army, a field marshal's battle experience. Human Germany on the deep map.
import { WW_DAY_SPLIT } from "@openfront/engine-api/ww1936/EconomyTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { splitFront } from "@openfront/engine-lib/ww1936/CommandRules";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { dailyArmyGroups } from "@openfront/engine/ww1936/depth/ArmyGroups";
import { makeMarshal } from "@openfront/engine/ww1936/depth/Command";
import { canServe } from "@openfront/engine/ww1936/land/GeneralsRun";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import {
  gameHash,
  order,
  placeArmy,
  step,
  stepTo,
  wwRestore,
  wwRunner,
} from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const H = "HUMANDEU";
const HUMANS = [{ clientID: H, country: "DEU" as const }];
const DEU = DEEP.tag.DEU;
const POL = DEEP.tag.POL;

async function germany() {
  const runner = await wwRunner(
    {},
    [{ clientID: H, country: "DEU" }],
    DEEP.map,
  );
  const ww = runner.game.worldWar()!;
  const land = ww.land;
  const ce = ww.economy.country(DEU)!;
  ce.manpower = 1_000_000;
  for (let k = 0; k < ce.stock.length; k++) ce.stock[k] += 100_000;
  const fm = land
    .country(DEU)!
    .generals.find((x) => x.army === 0 && canServe(land, x, 0))!;
  makeMarshal(ww.depth, DEU, fm, 0);
  return { runner, ww, d: ww.depth, land, fm };
}

function afterTurn(runner: GameRunner, day: number): number {
  const ww = runner.game.worldWar()!;
  return dayStartTick(day, ww.prepEndTick()) + (DEU % WW_DAY_SPLIT) + 1;
}

describe("army groups (spec §4.3)", () => {
  it("field marshal army group front assignment splits the front deterministically", async () => {
    // Three armies of 10/20/30 divisions on a 12-region front: 2/4/6
    // regions, in ascending order, one stretch after the other.
    const front = [9, 3, 12, 1, 7, 5, 11, 2, 8, 4, 10, 6];
    const parts = splitFront(front, [10, 20, 30]);
    expect(parts).toEqual([
      [1, 2],
      [3, 4, 5, 6],
      [7, 8, 9, 10, 11, 12],
    ]);
    expect(splitFront([...front].reverse(), [10, 20, 30])).toEqual(parts);
    // The remainder goes one each from the first army.
    expect(splitFront([1, 2, 3, 4, 5], [1, 1, 1])).toEqual([
      [1, 2],
      [3, 4],
      [5],
    ]);
    // In a game: P2's front order per army, anchored on its stretch.
    const { runner, d, land, fm } = await germany();
    const a = placeArmy(runner.game, "DEU", DEEP.region.berlin, 2);
    const b = placeArmy(runner.game, "DEU", DEEP.region.munich, 2);
    const tick = runner.game.ticks();
    expect(
      d.issue(
        DEU,
        { kind: "ag_create", fm: fm.id, armies: [b.id, a.id] },
        tick,
      ),
    ).toBeNull();
    const g = d.groups.find((x) => x.owner === DEU)!;
    expect(g.armies).toEqual([a.id, b.id].sort((x, y) => x - y));
    const front2 = [DEEP.region.munich, DEEP.region.berlin];
    const run = () => {
      expect(
        d.issue(
          DEU,
          { kind: "ag_front", group: g.id, frontRegions: front2, enemy: POL },
          tick,
        ),
      ).toBeNull();
      return [a, b].map((x) => [x.order.kind, x.order.anchor, x.order.enemy]);
    };
    const first = run();
    // Two divisions each: one region each, ascending in army order.
    const want = splitFront(
      front2,
      g.armies.map((id) => land.armies.get(id)!.divisions.length),
    );
    g.armies.forEach((id, i) => {
      expect(land.armies.get(id)!.order.anchor).toBe(want[i][0]);
    });
    expect(run()).toEqual(first);
    expect(first.every((x) => x[0] === "front" && x[2] === POL)).toBe(true);
  });

  it("army group execute runs every army's plan on the same tick", async () => {
    const { runner, d, fm } = await germany();
    const a = placeArmy(runner.game, "DEU", DEEP.region.berlin, 2);
    const b = placeArmy(runner.game, "DEU", DEEP.region.munich, 2);
    step(runner, 1, [
      order(H, { kind: "ag_create", fm: fm.id, armies: [a.id, b.id] }),
      order(H, {
        kind: "army_front",
        army: a.id,
        anchor: DEEP.region.berlin,
        enemy: POL,
      }),
      order(H, {
        kind: "army_front",
        army: b.id,
        anchor: DEEP.region.munich,
        enemy: POL,
      }),
    ]);
    const g = d.groups.find((x) => x.owner === DEU)!;
    expect(a.order.kind).toBe("front");
    expect(b.order.kind).toBe("front");
    step(runner, 1, [order(H, { kind: "ag_execute", group: g.id })]);
    for (const x of [a, b]) {
      expect(x.order.kind).toBe("plan");
      expect(x.order.executing).toBe(true);
    }
  });

  it("a group loses an army that is disbanded", async () => {
    const { runner, ww, d, land, fm } = await germany();
    const a = placeArmy(runner.game, "DEU", DEEP.region.berlin, 1);
    const b = placeArmy(runner.game, "DEU", DEEP.region.berlin, 1);
    const tick = runner.game.ticks();
    expect(
      d.issue(
        DEU,
        { kind: "ag_create", fm: fm.id, armies: [a.id, b.id] },
        tick,
      ),
    ).toBeNull();
    const gid = a.group;
    expect(b.group).toBe(gid);
    // Another group may not take them, nor the marshal lead two.
    expect(
      d.issue(DEU, { kind: "ag_create", fm: fm.id, armies: [a.id] }, tick),
    ).toBe("general_unavailable");
    expect(land.issue(DEU, { kind: "army_disband", army: a.id })).toBeNull();
    expect(land.armies.has(a.id)).toBe(false);
    dailyArmyGroups(d, DEU, ww.day(tick));
    expect(d.groups.find((x) => x.id === gid)!.armies).toEqual([b.id]);
    expect(land.issue(DEU, { kind: "army_disband", army: b.id })).toBeNull();
    dailyArmyGroups(d, DEU, ww.day(tick));
    expect(d.groups.some((x) => x.id === gid)).toBe(false);
  });

  it("a field marshal gains experience on his group's battle days", async () => {
    const { runner, ww, d, land, fm } = await germany();
    stepTo(runner, afterTurn(runner, 0));
    const a = placeArmy(runner.game, "DEU", DEEP.region.berlin, 2);
    expect(
      d.issue(
        DEU,
        { kind: "ag_create", fm: fm.id, armies: [a.id] },
        runner.game.ticks(),
      ),
    ).toBeNull();
    const xp = fm.xp;
    const day = ww.day(runner.game.ticks()) + 1;
    // The group's division fought since Germany's last turn.
    const r = land.divisions.rowOf(a.divisions[0]);
    land.divisions.lastFight[r] = dayStartTick(day, ww.prepEndTick());
    dailyArmyGroups(d, DEU, day);
    expect(fm.xp).toBe(xp + 100);
    // No fight, no experience.
    dailyArmyGroups(d, DEU, day + 1);
    expect(fm.xp).toBe(xp + 100);
  });

  it("a group, a marshal, a medal and the notices told survive a snapshot", async () => {
    const { runner, ww, d, land, fm } = await germany();
    stepTo(runner, afterTurn(runner, 1));
    const a = placeArmy(runner.game, "DEU", DEEP.region.berlin, 2);
    const tick = runner.game.ticks();
    const c = d.country(DEU)!;
    c.cmd.cpMilli = 50_000;
    expect(
      d.issue(DEU, { kind: "ag_create", fm: fm.id, armies: [a.id] }, tick),
    ).toBeNull();
    expect(
      d.issue(
        DEU,
        { kind: "medal_award", army: a.id, medal: "medal_valor" },
        tick,
      ),
    ).toBeNull();
    expect(
      d.issue(DEU, { kind: "army_priority", army: a.id, value: 2 }, tick),
    ).toBeNull();
    c.cmd.traitsSeen.push([fm.id, 1 << 11]);
    step(runner, 3);
    const b = await wwRestore(runner, HUMANS, DEEP.map);
    expect(gameHash(b)).toBe(gameHash(runner));
    const ww2 = b.game.worldWar()!;
    const d2 = ww2.depth;
    expect(d2.groups).toEqual(d.groups);
    expect(d2.country(DEU)!.cmd).toEqual(c.cmd);
    expect(d2.country(DEU)!.doc).toEqual(c.doc);
    const a2 = ww2.land.armies.get(a.id)!;
    expect([a2.group, a2.priority, a2.medal, a2.medalUntil]).toEqual([
      a.group,
      a.priority,
      a.medal,
      a.medalUntil,
    ]);
    const fm2 = ww2.land.country(DEU)!.generals.find((x) => x.id === fm.id)!;
    expect([fm2.fm, fm2.fmTraits, fm2.army]).toEqual([
      fm.fm,
      fm.fmTraits,
      fm.army,
    ]);
    expect(d2.armyMods(DEU, a.id)).toEqual(d.armyMods(DEU, a.id));
    for (let i = 0; i < 30; i++) {
      step(runner);
      step(b);
      expect(gameHash(b), `tick ${i}`).toBe(gameHash(runner));
    }
    void land;
    void ww;
  });
});
