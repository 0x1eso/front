// The stock table's "short" number (CountryLandDetail.equipShort): per need
// group, the sum over divisions and trainees of max(0, need - held).
import type { DepthOrder, WwOrder } from "@openfront/engine-api/Schemas";
import { WwTechId } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_STATIC_SLOTS,
  NEED_GROUP_COUNT,
  NEED_GROUPS,
  NG_HEAVY,
} from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  slotGroup,
  STATIC_KEY_STATS,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import { dailyTraining } from "@openfront/engine/ww1936/land/Training";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { HUMAN, placeArmy, stepTo, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const GBR = DEEP.tag.GBR;
const LONDON = DEEP.region.london;
type Def = Extract<DepthOrder, { kind: "design_save" }>["def"];
const HEAVY: Def = {
  kind: "tank",
  base: "heavy_1",
  modules: ["gun_cs", "turret_3", "bogie", "welded", "petrol", "radio", ""],
  armorLevel: 0,
  engineLevel: 0,
  name: "Heavy",
};
const TECHS: WwTechId[] = ["heavy_tank_1", "tank_radio"];
const GROUP = (name: (typeof NEED_GROUPS)[number]) => NEED_GROUPS.indexOf(name);

async function setup() {
  const runner = await wwRunner(
    {},
    [{ clientID: HUMAN, country: "GBR" }],
    DEEP.map,
  );
  stepTo(runner, WW_PREP_TICKS + 2);
  const ww = runner.game.worldWar()!;
  const l = ww.land;
  const ce = ww.economy.country(GBR)!;
  for (const t of TECHS) ce.addTech(t);
  ce.manpower = 10_000_000;
  const saveTemplate = (battalions: string[]) => {
    const id = l.country(GBR)!.nextTemplateId;
    expect(
      l.issue(
        GBR,
        {
          kind: "template_save",
          template: 0,
          base: 0,
          name: "T",
          battalions,
          support: [],
        } as WwOrder,
        "player",
      ),
    ).toBeNull();
    return id;
  };
  const detail = () => {
    const d = l.countryDetail(l.country(GBR)!);
    return { ...d, equipShort: d.equipShort! };
  };
  const needOf = (t: number) => l.templateStatsOf(GBR, t)!.need;
  /** Fields `n` divisions of `t` (stock-drawn), then sets each to hold `held` by slot. */
  const field = (t: number, held: Record<number, number>[]) => {
    const before = new Set(l.rowsOf(GBR));
    placeArmy(runner.game, "GBR", LONDON, held.length, t);
    const fresh = l.rowsOf(GBR).filter((r) => !before.has(r));
    fresh.forEach((r, i) => {
      const eq = l.divisions.equipOf(r);
      eq.fill(0);
      for (const [j, n] of Object.entries(held[i])) eq[Number(j)] = n;
    });
  };
  return { runner, ww, l, ce, saveTemplate, detail, needOf, field };
}

describe("equipShort: units missing to full template strength", () => {
  test("a detail is as long as the need groups and starts at the template's need", async () => {
    const { detail, saveTemplate, needOf, field } = await setup();
    expect(detail().equipShort).toHaveLength(NEED_GROUP_COUNT);
    const t = saveTemplate(["infantry", "artillery"]);
    field(t, [{}]);
    expect(detail().equipShort).toEqual(Array.from(needOf(t)));
  });

  test("full needs nothing, partial only the gap, a surplus does not cancel another division's gap", async () => {
    const { detail, saveTemplate, needOf, field } = await setup();
    const t = saveTemplate(["infantry", "artillery"]);
    const need = needOf(t);
    const inf = GROUP("infantry_equipment");
    const art = GROUP("artillery");
    const k = (g: number) => {
      for (let j = 0; j < GROUND_STATIC_SLOTS; j++) {
        if (slotGroup(STATIC_KEY_STATS, j) === g) return j;
      }
      throw new Error("no slot");
    };
    const jInf = k(inf);
    const jArt = k(art);
    const full = { [jInf]: need[inf], [jArt]: need[art] };
    field(t, [full]);
    expect(detail().equipShort.every((n) => n === 0)).toBe(true);
    // A second division holds half the guns; a third holds far more than it needs.
    field(t, [
      { [jInf]: need[inf], [jArt]: need[art] - 3 },
      { [jInf]: need[inf] * 5, [jArt]: need[art] * 5 },
    ]);
    const s = detail().equipShort;
    expect(s[art]).toBe(3);
    expect(s[inf]).toBe(0);
    // Every other group is untouched.
    expect(s.filter((_, g) => g !== art)).toEqual(
      new Array(NEED_GROUP_COUNT - 1).fill(0),
    );
  });

  test("a trainee counts with what it holds", async () => {
    const { l, ce, detail, saveTemplate, needOf } = await setup();
    const t = saveTemplate(["infantry"]);
    for (let i = 0; i < ce.stock.length; i++) ce.stock[i] = 0;
    expect(
      l.issue(
        GBR,
        { kind: "train", template: t, count: 1, army: 0, region: 0 },
        "player",
      ),
    ).toBeNull();
    dailyTraining(l, l.country(GBR)!, ce);
    const need = needOf(t);
    expect(l.country(GBR)!.trainees.length).toBeGreaterThan(0);
    const inf = GROUP("infantry_equipment");
    expect(detail().equipShort[inf]).toBe(
      need[inf] * l.country(GBR)!.trainees.length,
    );
  });

  test("a tank design counts in its design's group", async () => {
    const { runner, ww, l, detail, saveTemplate, needOf, field } =
      await setup();
    expect(
      ww.depth.issue(
        GBR,
        { kind: "design_save", def: HEAVY },
        runner.game.ticks(),
      ),
    ).toBeNull();
    const t = saveTemplate(["heavy_armor"]);
    const need = needOf(t);
    expect(need[NG_HEAVY]).toBeGreaterThan(0);
    // Holding two of the design slot 1 units: the gap is the need less two.
    field(t, [{ [GROUND_STATIC_SLOTS]: 2 }]);
    void l;
    expect(detail().equipShort[NG_HEAVY]).toBe(need[NG_HEAVY] - 2);
  });
});
