// Air groups on auto and the AI's groups (w121): a group handed to the planner
// stays a group (template, zones, keep-N, base hold); the AI keeps its fighters
// and bombers in template groups. Wing model on, DEU human, ww1936sea.
import {
  AIR_TYPES,
  WP_GROUND,
  WP_REARM,
} from "@openfront/engine-api/ww1936/AirTypes";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { aiWings } from "@openfront/engine/ww1936/air/AiAir";
import { groupWings } from "@openfront/engine/ww1936/air/Groups";
import { dailyWingCountry } from "@openfront/engine/ww1936/air/Wings";
import "./noStartWings";
import { SEA, SR, TAG_ID } from "./seaFixture";
import { stepTo, withTestPolitics, wwRunner } from "./util";

withTestPolitics();

const HUMANS = [{ clientID: "HUMAN001", country: "DEU" as const }];
const DEU = TAG_ID.DEU;
const FRA = TAG_ID.FRA;
const planes = (o: Partial<Record<(typeof AIR_TYPES)[number], number>>) =>
  AIR_TYPES.map((t) => o[t] ?? 0);

async function setup() {
  const runner = await wwRunner({}, HUMANS, SEA.map);
  const ww = runner.game.worldWar()!;
  const air = ww.air;
  for (const id of [DEU, FRA]) {
    const ce = ww.economy.country(id)!;
    for (const t of AIR_TYPES) {
      for (let g = 1; g <= 3; g++) {
        const k = equipKey(t, g);
        if (k >= 0) {
          ce.stock[k] = 0;
          ce.planesDeployed[k] = 0;
        }
      }
    }
    for (const w of air.wingsOf(id)) air.removeWing(w.id, true);
  }
  stepTo(runner, WW_PREP_TICKS + 1);
  ww.setWar(DEU, FRA, runner.game.ticks());
  const stock = (id: number, t: (typeof AIR_TYPES)[number], n: number) => {
    ww.economy.country(id)!.stock[equipKey(t, 1)] = n;
  };
  const day = () => ww.day(runner.game.ticks());
  /** The next day on which the planner runs for `id` (at war: every 5th). */
  const dueDay = (id: number) => {
    let d = day();
    while ((d + id) % 5 !== 0) d++;
    return d;
  };
  return { runner, ww, air, stock, day, dueDay };
}

describe("a human's group on auto", () => {
  test("stays a group: its wings keep the group, the zones and the base; the planner disbands none", async () => {
    const c = await setup();
    c.stock(DEU, "fighter", 600);
    c.stock(DEU, "bomber", 300);
    const tick = c.runner.game.ticks();
    expect(
      c.air.issue(
        DEU,
        {
          kind: "air_template",
          id: 0,
          name: "Mix",
          planes: planes({ fighter: 300, bomber: 150 }),
          keep: 1,
        },
        tick,
      ),
    ).toBeNull();
    dailyWingCountry(c.air, DEU, c.day());
    const g = [...c.air.groups.values()].find((x) => x.owner === DEU)!;
    expect(
      c.air.issue(
        DEU,
        {
          kind: "air_group_order",
          group: g.id,
          zones: [SR.westLand],
          priority: 0,
          auto: true,
        },
        tick,
      ),
    ).toBeNull();
    const ids = groupWings(c.air, g).map((w) => w.id);
    expect(ids.length).toBeGreaterThan(1);
    const base = g.base;
    for (let k = 0; k < 4; k++) {
      aiWings(c.air, DEU, c.dueDay(DEU) + 5 * k);
    }
    expect(groupWings(c.air, g).map((w) => w.id)).toEqual(ids);
    expect(g.zones).toEqual([SR.westLand]);
    expect(g.base).toBe(base);
    for (const w of groupWings(c.air, g)) {
      expect(w.group).toBe(g.id);
      expect(w.auto).toBe(true);
      if (w.mission >= 0) expect(w.sr).toBe(SR.westLand);
      if (w.phase === WP_GROUND || w.phase === WP_REARM) {
        expect(w.base).toBe(base);
      }
    }
  });
});

describe("the AI's groups", () => {
  test("it saves one template, forms an auto group, absorbs its wings and forms no loose fighters or bombers", async () => {
    const c = await setup();
    c.stock(FRA, "fighter", 800);
    c.stock(FRA, "bomber", 400);
    const ca = c.air.country(FRA)!;
    expect(ca.templates).toHaveLength(0);
    aiWings(c.air, FRA, c.dueDay(FRA));
    expect(ca.templates).toHaveLength(1);
    const t = ca.templates[0];
    const total = t.planes.reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(600);
    expect(total).toBeGreaterThan(0);
    expect(t.keep).toBe(Math.ceil(1200 / 600));
    expect(t.planes[AIR_TYPES.indexOf("fighter")]).toBeGreaterThan(
      t.planes[AIR_TYPES.indexOf("bomber")],
    );
    dailyWingCountry(c.air, FRA, c.day());
    const gs = [...c.air.groups.values()].filter((g) => g.owner === FRA);
    expect(gs).toHaveLength(t.keep);
    for (const g of gs) {
      expect(g.auto).toBe(true);
      expect(g.tpl).toBe(t.id);
      expect(groupWings(c.air, g).length).toBeGreaterThan(0);
    }
    // No loose wing of a group type is formed beside the groups.
    for (let k = 1; k <= 3; k++) dailyWingCountry(c.air, FRA, c.day() + k);
    expect(
      c.air
        .wingsOf(FRA)
        .filter((w) => w.group === 0 && w.type < 8 && w.volunteerFor === 0)
        .filter((w) => ["fighter", "bomber"].includes(AIR_TYPES[w.type])),
    ).toHaveLength(0);
    // The planner runs over the groups and leaves their wings in them.
    const ids = gs.map((g) => groupWings(c.air, g).length);
    aiWings(c.air, FRA, c.dueDay(FRA) + 5);
    expect(
      [...c.air.groups.values()]
        .filter((g) => g.owner === FRA)
        .map((g) => groupWings(c.air, g).length),
    ).toEqual(ids);
  });
});
