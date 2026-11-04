// Air groups (w50): templates, keep-N, forming and refilling, absorbing loose
// wings, what each type does in each kind of zone, several zones, the base,
// auto, disband, snapshot, the view. Wing model on, DEU human, ww1936sea.
import { WwOrderSchema, type WwOrder } from "@openfront/engine-api/Schemas";
import {
  AIR_MISSIONS,
  AIR_TYPES,
  WING_NO_MISSION,
  WP_FERRY,
  WW_MAX_AIR_TEMPLATES,
  WW_MAX_GROUP_PLANES,
  type Wing,
} from "@openfront/engine-api/ww1936/AirTypes";
import { equipKey, LEVEL_MAX } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  buildBlockOf,
  type BuildCheck,
} from "@openfront/engine-lib/ww1936/EconomyChecks";
import { groupWings } from "@openfront/engine/ww1936/air/Groups";
import { dailyWingCountry } from "@openfront/engine/ww1936/air/Wings";
import { WwAirStateSchema } from "@openfront/engine/ww1936/air/WwAir";
import { damageBuilding } from "@openfront/engine/ww1936/economy/Buildings";
import "./oldAirModel";
import { REGION, SEA, SR, TAG_ID } from "./seaFixture";
import { placeArmy, stepTo, withTestPolitics, wwRunner } from "./util";
import { giveWing, liveWings } from "./wingUtil";

withTestPolitics();

const HUMANS = [{ clientID: "HUMAN001", country: "DEU" as const }];
const DEU = TAG_ID.DEU;
const T = (n: (typeof AIR_TYPES)[number]) => AIR_TYPES.indexOf(n);
const M = (n: (typeof AIR_MISSIONS)[number]) => AIR_MISSIONS.indexOf(n);

const planes = (o: Partial<Record<(typeof AIR_TYPES)[number], number>>) =>
  AIR_TYPES.map((t) => o[t] ?? 0);

async function setup(war = false) {
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
  stepTo(runner, WW_PREP_TICKS + 1);
  if (war) ww.setWar(DEU, TAG_ID.FRA, runner.game.ticks());
  const stock = (t: (typeof AIR_TYPES)[number], n: number) => {
    ce.stock[equipKey(t, 1)] = n;
  };
  const issue = (o: WwOrder) => air.issue(DEU, o, runner.game.ticks());
  const day = () => air.ww.day(runner.game.ticks());
  const daily = (n = 1) => {
    for (let i = 0; i < n; i++) dailyWingCountry(air, DEU, day());
  };
  const save = (
    name: string,
    p: Partial<Record<(typeof AIR_TYPES)[number], number>>,
    keep: number,
    id = 0,
  ) => issue({ kind: "air_template", id, name, planes: planes(p), keep });
  const groups = () => [...air.groups.values()].filter((g) => g.owner === DEU);
  const total = () => {
    let n = 0;
    for (const t of AIR_TYPES) {
      for (let g = 1; g <= 3; g++) {
        const k = equipKey(t, g);
        if (k >= 0) n += ce.stock[k] + ce.planesDeployed[k];
      }
    }
    return n;
  };
  return { runner, ww, air, ce, stock, issue, day, daily, save, groups, total };
}
type Ctx = Awaited<ReturnType<typeof setup>>;

const orderZones = (
  c: Ctx,
  group: number,
  zones: number[],
  extra: Partial<Extract<WwOrder, { kind: "air_group_order" }>> = {},
) =>
  c.issue({
    kind: "air_group_order",
    group,
    zones,
    priority: 0,
    ...extra,
  });

const mission = (w: Wing) =>
  w.mission === WING_NO_MISSION ? "-" : AIR_MISSIONS[w.mission];

describe("templates", () => {
  test("saved with limits: steps of 25, 600 planes, no carrier or transport types, 20 of them", async () => {
    const c = await setup();
    expect(c.save("Mix", { fighter: 200, bomber: 100 }, 2)).toBeNull();
    const t = c.air.country(DEU)!.templates;
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ id: 1, name: "Mix", keep: 2 });
    expect(c.save("Mix2", { fighter: 100 }, 1, 1)).toBeNull();
    expect(c.air.country(DEU)!.templates[0].name).toBe("Mix2");
    expect(c.save("x", { fighter: 100 }, 1, 99)).toBe("bad_index");
    expect(c.save("x", { fighter: 110 }, 1)).toBe("bad_template");
    expect(c.save("x", { fighter: WW_MAX_GROUP_PLANES + 25 }, 1)).toBe(
      "bad_template",
    );
    expect(c.save("x", { fighter: 300, bomber: 325 }, 1)).toBe("bad_template");
    expect(c.save("x", { fighter: 300, bomber: 300 }, 1)).toBeNull();
    expect(c.save("x", { cv_fighter: 100 }, 1)).toBe("bad_template");
    expect(c.save("x", { transport_plane: 100 }, 1)).toBe("bad_template");
    expect(c.save("x", {}, 1)).toBe("bad_template");
    expect(c.save("  ", { fighter: 25 }, 1)).toBe("bad_template");
    while (c.air.country(DEU)!.templates.length < WW_MAX_AIR_TEMPLATES) {
      expect(c.save("t", { fighter: 25 }, 0)).toBeNull();
    }
    expect(c.save("t", { fighter: 25 }, 0)).toBe("too_many_templates");
    expect(c.issue({ kind: "air_template_drop", id: 1 })).toBeNull();
    expect(c.issue({ kind: "air_template_drop", id: 1 })).toBe("bad_index");
  });
});

describe("forming and refilling", () => {
  test("keep 2 forms two groups of wings split no larger than the type's full size", async () => {
    const c = await setup();
    c.stock("fighter", 1000);
    c.stock("bomber", 500);
    expect(c.save("Mix", { fighter: 200, bomber: 100 }, 2)).toBeNull();
    c.daily();
    const gs = c.groups();
    expect(gs).toHaveLength(2);
    for (const g of gs) {
      const ws = groupWings(c.air, g);
      expect(ws.map((w) => w.type).sort()).toEqual(
        [T("fighter"), T("fighter"), T("bomber")].sort(),
      );
      const f = ws.filter((w) => w.type === T("fighter"));
      // 200 fighters split in two of 100, below the type's full size 150.
      expect(f.map((w) => w.fullMax)).toEqual([100, 100]);
      expect(f.map((w) => w.counts[0])).toEqual([100, 100]);
      expect(ws.every((w) => w.base === g.base)).toBe(true);
      expect(ws.every((w) => w.group === g.id)).toBe(true);
    }
    expect(c.ce.stock[equipKey("fighter", 1)]).toBe(600);
  });

  test("a short stock makes a partial group; the rest fills as stock arrives", async () => {
    const c = await setup();
    c.stock("fighter", 130);
    expect(c.save("F", { fighter: 200 }, 1)).toBeNull();
    c.daily();
    const g = c.groups()[0];
    let ws = groupWings(c.air, g);
    // One wing of the two: the reserve (50) stays, and the wing's own refill
    // fills it to its 100 from what is left.
    expect(ws.map((w) => w.counts[0])).toEqual([100]);
    expect(c.ce.stock[equipKey("fighter", 1)]).toBe(30);
    c.stock("fighter", 400);
    c.daily();
    ws = groupWings(c.air, g);
    expect(ws.map((w) => w.counts[0])).toEqual([100, 100]);
  });

  test("keep dropped to 1 sends a group back to the stock, one a day", async () => {
    const c = await setup();
    c.stock("fighter", 1000);
    expect(c.save("F", { fighter: 100 }, 2)).toBeNull();
    c.daily();
    expect(c.groups()).toHaveLength(2);
    const before = c.total();
    expect(c.save("F", { fighter: 100 }, 1, 1)).toBeNull();
    c.daily();
    expect(c.groups()).toHaveLength(1);
    expect(c.total()).toBe(before);
  });

  test("a changed template reshapes at the refill pace; the surplus goes back", async () => {
    const c = await setup();
    c.stock("fighter", 1000);
    expect(c.save("F", { fighter: 150 }, 1)).toBeNull();
    c.daily(2);
    const g = c.groups()[0];
    expect(groupWings(c.air, g).map((w) => w.counts[0])).toEqual([150]);
    expect(c.save("F", { fighter: 50 }, 1, 1)).toBeNull();
    const stock = c.ce.stock[equipKey("fighter", 1)];
    c.daily();
    const w = groupWings(c.air, g)[0];
    // 25 % of the full size (38) a day, not at once.
    expect(w.counts[0]).toBe(112);
    expect(c.ce.stock[equipKey("fighter", 1)]).toBe(stock + 38);
    c.daily(3);
    expect(w.counts[0]).toBe(50);
    expect(w.fullMax).toBe(50);
  });
});

describe("existing wings and the old forming", () => {
  test("unassigned wings of the type join before new planes are drawn", async () => {
    const c = await setup();
    const a = giveWing(c.air, {
      owner: DEU,
      type: "fighter",
      planes: 150,
      base: REGION.berlin,
    });
    const b = giveWing(c.air, {
      owner: DEU,
      type: "fighter",
      planes: 150,
      base: REGION.berlin,
    });
    c.stock("fighter", 500);
    expect(c.save("F", { fighter: 300 }, 1)).toBeNull();
    c.daily();
    const g = c.groups()[0];
    expect(a.group).toBe(g.id);
    expect(b.group).toBe(g.id);
    expect(groupWings(c.air, g)).toHaveLength(2);
    expect(c.ce.stock[equipKey("fighter", 1)]).toBe(500);
  });

  test("formWings stops for a human with a template and runs again without", async () => {
    const c = await setup();
    c.stock("fighter", 1000);
    expect(c.save("B", { bomber: 100 }, 0)).toBeNull();
    c.daily();
    expect(c.air.wingsOf(DEU)).toHaveLength(0);
    expect(c.issue({ kind: "air_template_drop", id: 1 })).toBeNull();
    c.daily();
    expect(c.air.wingsOf(DEU).length).toBeGreaterThan(0);
  });
});

describe("what each type does", () => {
  async function mixed(war: boolean) {
    const c = await setup(war);
    c.stock("fighter", 800);
    c.stock("bomber", 400);
    c.stock("cas", 400);
    c.stock("naval_bomber", 400);
    expect(
      c.save(
        "All",
        { fighter: 300, bomber: 100, cas: 100, naval_bomber: 50 },
        1,
      ),
    ).toBeNull();
    c.daily();
    return { c, g: c.groups()[0] };
  }
  const by = (c: Ctx, id: number, t: (typeof AIR_TYPES)[number]) =>
    groupWings(c.air, c.air.groups.get(id)!)
      .filter((w) => w.type === T(t))
      .sort((a, b) => a.id - b.id);

  test("an enemy land zone: superiority, an escort for the bombers, bombs, close support; naval bombers wait", async () => {
    const { c, g } = await mixed(true);
    expect(orderZones(c, g.id, [SR.westLand])).toBeNull();
    const f = by(c, g.id, "fighter");
    expect(f.map(mission)).toEqual(["air_superiority", "escort"]);
    const bomber = by(c, g.id, "bomber")[0];
    expect(mission(bomber)).toBe("strategic_bombing");
    expect(f[1].escortOf).toBe(bomber.id);
    expect(mission(by(c, g.id, "cas")[0])).toBe("cas");
    expect(mission(by(c, g.id, "naval_bomber")[0])).toBe("-");
    expect(f.every((w) => w.sr === SR.westLand)).toBe(true);
  });

  test("my own land zone: fighters intercept, close support helps, the rest wait", async () => {
    const { c, g } = await mixed(false);
    expect(orderZones(c, g.id, [SR.westLand])).toBeNull();
    expect(by(c, g.id, "fighter").map(mission)).toEqual([
      "interception",
      "interception",
    ]);
    expect(mission(by(c, g.id, "cas")[0])).toBe("cas");
    expect(mission(by(c, g.id, "bomber")[0])).toBe("-");
    expect(mission(by(c, g.id, "naval_bomber")[0])).toBe("-");
  });

  test("a sea zone: fighters take superiority, naval bombers patrol, the rest wait", async () => {
    const { c, g } = await mixed(true);
    expect(orderZones(c, g.id, [SR.approaches])).toBeNull();
    expect(by(c, g.id, "fighter").map(mission)).toEqual([
      "air_superiority",
      "air_superiority",
    ]);
    expect(mission(by(c, g.id, "naval_bomber")[0])).toBe("naval_patrol");
    expect(mission(by(c, g.id, "bomber")[0])).toBe("-");
    expect(mission(by(c, g.id, "cas")[0])).toBe("-");
  });

  test("following an army: fighters take superiority, close support follows it", async () => {
    const { c, g } = await mixed(true);
    const army = placeArmy(c.runner.game, "DEU", REGION.munich, 2);
    expect(orderZones(c, g.id, [], { army: army.id })).toBeNull();
    const cas = by(c, g.id, "cas")[0];
    expect(mission(cas)).toBe("cas");
    expect(cas.follow).toBe(army.id);
    expect(mission(by(c, g.id, "fighter")[0])).toBe("air_superiority");
    expect(mission(by(c, g.id, "bomber")[0])).toBe("-");
    // Stand down: no zones and no army.
    expect(orderZones(c, g.id, [])).toBeNull();
    expect(by(c, g.id, "fighter").map(mission)).toEqual(["-", "-"]);
  });

  test("a class and a single target are kept for the bombers", async () => {
    const { c, g } = await mixed(true);
    expect(
      orderZones(c, g.id, [SR.westLand], {
        cls: "factories",
        target: REGION.paris,
      }),
    ).toBeNull();
    const b = by(c, g.id, "bomber")[0];
    expect(b.target).toBe(REGION.paris);
    expect(AIR_MISSIONS[b.mission]).toBe("strategic_bombing");
    expect(orderZones(c, g.id, [SR.eastLand], { target: REGION.paris })).toBe(
      "bad_zone",
    );
  });
});

describe("several zones", () => {
  async function fighters() {
    const c = await setup(true);
    c.stock("fighter", 1000);
    expect(c.save("F", { fighter: 600 }, 1)).toBeNull();
    c.daily();
    return { c, g: c.groups()[0] };
  }
  const zoneOf = (c: Ctx, g: { id: number }) =>
    groupWings(c.air, c.air.groups.get(g.id)!)
      .sort((a, b) => a.id - b.id)
      .map((w) => w.sr);

  test("at most five zones, no repeats, a priority among them, an army or zones", async () => {
    const { c, g } = await fighters();
    const z = [SR.westLand, SR.eastLand, SR.approaches, SR.central, SR.eastern];
    expect(orderZones(c, g.id, z)).toBeNull();
    expect(orderZones(c, g.id, [...z, 9999])).toBe("bad_zone");
    expect(orderZones(c, g.id, [SR.westLand, SR.westLand])).toBe("bad_zone");
    expect(orderZones(c, g.id, [SR.westLand], { priority: SR.eastLand })).toBe(
      "bad_zone",
    );
    expect(orderZones(c, g.id, [SR.westLand], { army: 99999 })).toBe(
      "bad_index",
    );
    expect(orderZones(c, g.id, [9999])).toBe("bad_zone");
  });

  test("the priority zone counts double; the planes spread over the zones", async () => {
    const { c, g } = await fighters();
    expect(orderZones(c, g.id, [SR.westLand, SR.eastLand])).toBeNull();
    const plain = zoneOf(c, g);
    expect(new Set(plain).size).toBe(2);
    const first = plain[0];
    // The zone with enemy planes over it and a lost sky takes the first wing.
    const sc = c.air.ww.scenario;
    const i = sc.srIdxOf(SR.eastLand);
    const side = c.air.land.sideOf(DEU);
    c.air.zoneState[i].enemySup.set(side, 800);
    c.air.zoneState[i].sorties.set(side + 50, [10]);
    expect(orderZones(c, g.id, [SR.westLand, SR.eastLand])).toBeNull();
    expect(zoneOf(c, g)[0]).toBe(SR.eastLand);
    c.air.zoneState[i].enemySup.clear();
    c.air.zoneState[i].sorties.clear();
    // A priority on the other zone puts the first wing there.
    const other = first === SR.westLand ? SR.eastLand : SR.westLand;
    expect(
      orderZones(c, g.id, [SR.westLand, SR.eastLand], { priority: other }),
    ).toBeNull();
    expect(zoneOf(c, g)[0]).toBe(other);
    expect(new Set(zoneOf(c, g)).size).toBe(2);
  });

  test("a zone no type can reach from a usable base is refused", async () => {
    const { c, g } = await fighters();
    expect(orderZones(c, g.id, [SR.eastLand])).toBeNull();
    // Every base of the side bombed out: nothing reaches anything.
    for (const r of [REGION.berlin, REGION.rome]) {
      damageBuilding(c.ww.economy, r, "air_base", 100_000);
    }
    expect(orderZones(c, g.id, [SR.eastLand])).toBe("out_of_range");
  });
});

describe("the base", () => {
  test("it is the usable base nearest the first zone among those reaching most; members ferry there", async () => {
    const c = await setup(true);
    c.ww.economy.addBuilding(REGION.munich, "air_base", 1);
    c.stock("fighter", 600);
    expect(c.save("F", { fighter: 150 }, 1)).toBeNull();
    c.daily();
    const g = c.groups()[0];
    const sc = c.air.ww.scenario;
    expect(orderZones(c, g.id, [SR.eastLand])).toBeNull();
    const centre = sc.targetKm(REGION.berlin, sc.sr(SR.eastLand)!.members[0]);
    void centre;
    const near = [REGION.berlin, REGION.munich].sort(
      (a, b) =>
        sc.targetKm(a, sc.sr(SR.eastLand)!.members[0]) -
          sc.targetKm(b, sc.sr(SR.eastLand)!.members[0]) || a - b,
    )[0];
    expect(g.base).toBe(near);
    const w = groupWings(c.air, g)[0];
    expect(w.base).toBe(near);
    if (near !== REGION.berlin) expect(w.phase).toBe(WP_FERRY);
  });
});

describe("rule 8 and the rest", () => {
  test("construction caps an air base at level 1; the start clamps to 1", async () => {
    expect(LEVEL_MAX.air_base).toBe(1);
    const check = (levelWithQueue: number) =>
      buildBlockOf({
        building: "air_base",
        count: 1,
        controlled: true,
        occupied: false,
        queueLength: 0,
        levelWithQueue,
        usedSlots: 0,
        slots: 0,
        coastal: false,
        harbor: false,
        researched: new Set(),
      } as BuildCheck);
    expect(check(0)).toBeNull();
    expect(check(1)).toBe("infra_max");
  });

  test("AI countries get no groups; carrier types are no members; a country's gone, its groups with it", async () => {
    const c = await setup();
    c.stock("fighter", 1000);
    expect(c.save("F", { fighter: 100 }, 1)).toBeNull();
    c.daily();
    expect(c.groups()).toHaveLength(1);
    c.air.onCapitulation(DEU, TAG_ID.FRA);
    expect(c.groups()).toHaveLength(0);
    expect(c.air.country(DEU)!.templates).toHaveLength(0);
    const fra = c.air.country(TAG_ID.FRA)!;
    expect(fra.templates).toHaveLength(0);
    expect([...c.air.groups.values()].some((g) => g.owner === TAG_ID.FRA)).toBe(
      false,
    );
    expect(
      c.air.issue(
        TAG_ID.FRA,
        { kind: "air_group_order", group: 1, zones: [], priority: 0 },
        0,
      ),
    ).toBe("bad_index");
  });

  test("[auto]: the group's wings go to the planner and take its orders; a direct wing order is refused otherwise", async () => {
    const c = await setup(true);
    c.stock("fighter", 400);
    expect(c.save("F", { fighter: 100 }, 1)).toBeNull();
    c.daily();
    const g = c.groups()[0];
    const w = groupWings(c.air, g)[0];
    const direct = (): WwOrder => ({
      kind: "wing_mission",
      wings: [w.id],
      mission: "air_superiority",
      target: REGION.paris,
    });
    expect(c.issue(direct())).toBe("in_group");
    expect(orderZones(c, g.id, [SR.westLand], { auto: true })).toBeNull();
    expect(w.auto).toBe(true);
    expect(g.auto).toBe(true);
    expect(c.issue(direct())).toBeNull();
    expect(
      c.issue({
        kind: "wing_mission",
        wings: [w.id],
        mission: "recon",
        target: 0,
      }),
    ).toBeNull();
  });

  test("a disband returns every plane to the stock and keeps the total", async () => {
    const c = await setup();
    c.stock("fighter", 600);
    c.stock("bomber", 300);
    expect(c.save("M", { fighter: 200, bomber: 100 }, 1)).toBeNull();
    c.daily();
    const before = c.total();
    const g = c.groups()[0];
    expect(c.air.wingsOf(DEU).length).toBe(3);
    expect(c.issue({ kind: "air_group_disband", group: g.id })).toBeNull();
    expect(c.groups()).toHaveLength(0);
    expect(c.air.wingsOf(DEU)).toHaveLength(0);
    expect(c.total()).toBe(before);
    expect(c.ce.stock[equipKey("fighter", 1)]).toBe(600);
    expect(c.issue({ kind: "air_group_disband", group: g.id })).toBe(
      "bad_index",
    );
  });
});

describe("state and view", () => {
  test("snapshot and restore keep templates, groups and wing fields, and the hash", async () => {
    const c = await setup(true);
    c.stock("fighter", 800);
    c.stock("bomber", 300);
    expect(c.save("M", { fighter: 200, bomber: 100 }, 2)).toBeNull();
    c.daily();
    const g = c.groups()[0];
    expect(orderZones(c, g.id, [SR.westLand], { cls: "rail" })).toBeNull();
    const hash = c.air.hash();
    const snap = WwAirStateSchema.parse(
      JSON.parse(JSON.stringify(c.air.snapshot())),
    );
    c.air.groups.clear();
    c.air.country(DEU)!.templates = [];
    for (const w of c.air.wingArray()) {
      w.group = 0;
      w.fullMax = 0;
    }
    expect(c.air.hash()).not.toBe(hash);
    c.air.restoreState(snap);
    expect(c.air.hash()).toBe(hash);
    expect(c.air.groups.get(g.id)!.zones).toEqual([SR.westLand]);
    expect(c.air.country(DEU)!.templates).toHaveLength(1);
    expect(groupWings(c.air, c.air.groups.get(g.id)!).length).toBe(3);
  });

  test("a game with no templates keeps the optional fields out of its snapshot", async () => {
    const c = await setup();
    const snap = c.air.snapshot();
    expect(snap.groups).toBeUndefined();
    expect(snap.nextGroupId).toBeUndefined();
    expect(snap.countries.every((x) => x.templates === undefined)).toBe(true);
  });

  test("the view gives the owner templates, groups, members, zones and the base", async () => {
    const c = await setup(true);
    c.stock("fighter", 800);
    expect(c.save("F", { fighter: 200 }, 1)).toBeNull();
    c.daily();
    const g = c.groups()[0];
    expect(
      orderZones(c, g.id, [SR.westLand, SR.approaches], {
        priority: SR.westLand,
      }),
    ).toBeNull();
    const d = c.air.takeData()!;
    const mine = d.details.find((x) => x.smallID === DEU)!;
    expect(mine.templates).toHaveLength(1);
    const v = mine.groups![0];
    expect(v).toMatchObject({
      id: g.id,
      tpl: 1,
      name: "F",
      zones: [SR.westLand, SR.approaches],
      priority: SR.westLand,
      base: g.base,
    });
    expect(v.planes[T("fighter")]).toBe(200);
    expect(v.want[T("fighter")]).toBe(200);
    expect(v.members).toHaveLength(2);
    expect(v.zoneInfo.map((z) => z.sr)).toEqual([SR.westLand, SR.approaches]);
    expect(v.zoneInfo[0].planes + v.zoneInfo[1].planes).toBe(200);
    // Only the owner's details carry groups; briefs never do.
    expect(d.details.filter((x) => x.groups !== undefined)).toHaveLength(1);
  });

  test("the orders go over the wire and back", () => {
    const orders: WwOrder[] = [
      {
        kind: "air_template",
        id: 0,
        name: "Mix",
        planes: planes({ fighter: 100 }),
        keep: 2,
      },
      { kind: "air_template_drop", id: 3 },
      {
        kind: "air_group_order",
        group: 4,
        zones: [1, 1001],
        priority: 1,
        cls: "rail",
        target: 3,
        auto: false,
        night: true,
      },
      { kind: "air_group_order", group: 4, zones: [], priority: 0, army: 7 },
      { kind: "air_group_disband", group: 4 },
    ];
    for (const o of orders)
      expect(WwOrderSchema.safeParse(o).success).toBe(true);
    const bad = (o: object) => WwOrderSchema.safeParse(o).success;
    expect(
      bad({
        kind: "air_group_order",
        group: 1,
        zones: [1, 2, 3, 4, 5, 6],
        priority: 0,
      }),
    ).toBe(false);
    expect(
      bad({ kind: "air_template", id: 0, name: "", planes: [1], keep: 1 }),
    ).toBe(false);
    expect(bad({ kind: "air_group_disband", group: 0 })).toBe(false);
  });
});
