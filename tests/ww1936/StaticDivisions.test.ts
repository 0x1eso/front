// World War 1936 P6 (plan decisions 6, 7; Task 1 Step 23): divisions that
// hold only static equipment keep P2's numbers — through the country's
// KeyStatsTable, the 30-slot holding vector and the engine's caches.
import type { TemplateDef } from "@openfront/engine-api/ww1936/LandTypes";
import {
  divisionStats,
  GEN1,
  genMixOf,
  STATIC_KEY_STATS,
  templateStats,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import { techTotals } from "@openfront/engine-lib/ww1936/WwTechs";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { stepTo, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const ZERO = techTotals(new Set());
const def = (bns: [string, number][], support: string[] = []): TemplateDef =>
  ({
    name: "",
    battalions: bns.flatMap(([id, n]) => new Array<string>(n).fill(id)),
    support,
  }) as TemplateDef;

describe("static divisions keep their P2 numbers", () => {
  it("the 1936 templates through a country's slot table (P2's pinned numbers)", async () => {
    const runner = await wwRunner({}, [], DEEP.map);
    const ks = runner.game.worldWar()!.depth.keyStats(DEEP.tag.DEU);
    // A new object, never the shared static one (pre-flight §0-3a).
    expect(ks).not.toBe(STATIC_KEY_STATS);
    const inf = def(
      [
        ["infantry", 7],
        ["artillery", 2],
      ],
      ["engineer", "recon"],
    );
    expect(templateStats(inf, ZERO, GEN1, ks)).toMatchObject({
      width: 20,
      men: 8500,
      hpMilli: 176_200,
      orgMilli: 46_666,
      soft: 9200,
      hard: 1100,
      def: 17_400,
      brk: 3300,
      pierce: 453,
      speedCenti: 400,
    });
    const armour = def(
      [
        ["light_armor", 4],
        ["motorized", 2],
        ["mot_artillery", 1],
      ],
      ["recon"],
    );
    expect(templateStats(armour, ZERO, GEN1, ks)).toMatchObject({
      width: 15,
      soft: 8500,
      hard: 2000,
      def: 7000,
      brk: 10_200,
      armor: 700,
      pierce: 1225,
      hardnessPm: 500,
      speedCenti: 800,
    });
    // Medium tanks at generation 2, light and medium together.
    const mixed = def([
      ["light_armor", 2],
      ["medium_armor", 2],
    ]);
    const gen2 = GEN1.map((g, i) => (i === 7 ? 200 : g));
    expect(templateStats(mixed, ZERO, gen2, ks)).toEqual(
      templateStats(mixed, ZERO, gen2),
    );
  });

  it("every division of a human Germany reads P2's formula", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: "HUMANDEU", country: "DEU" }],
      DEEP.map,
    );
    stepTo(runner, 700);
    const ww = runner.game.worldWar()!;
    const land = ww.land;
    const ce = ww.economy.country(DEEP.tag.DEU)!;
    const t = land.divisions;
    let n = 0;
    for (const r of land.rowsOf(DEEP.tag.DEU)) {
      const tpl = land.country(DEEP.tag.DEU)!.template(t.template[r])!;
      const equip = Array.from(t.equipOf(r));
      const p2 = divisionStats(
        templateStats(tpl.def, ce.stats, genMixOf(equip)),
        equip,
        t.men[r],
      );
      expect(land.statsOf(r)).toEqual(p2);
      n++;
    }
    expect(n).toBeGreaterThan(0);
  });
});
