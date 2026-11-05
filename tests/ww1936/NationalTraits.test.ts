// w69: the seven majors' permanent national traits on the real map. Each
// trait is switched off and on again on a live game and the numbers its
// consumers read are compared; the Soviet early weakness is timed.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { EQUIP_KEYS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { TPL_ARMOR_ANY } from "@openfront/engine-api/ww1936/LandTypes";
import type { WwStatKey } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import {
  divisionMods,
  entrenchMax,
  type ModInput,
} from "@openfront/engine-lib/ww1936/CombatRules";
import { SPIRITS_NATIONAL } from "@openfront/engine-lib/ww1936/content/spirits/national";
import { battalionStatPct } from "@openfront/engine-lib/ww1936/DoctrineRules";
import {
  effCapBp,
  efficiencyGrowth,
} from "@openfront/engine-lib/ww1936/EconomyRules";
import { fuelCap } from "@openfront/engine-lib/ww1936/FuelRules";
import { breakdownPpm } from "@openfront/engine-lib/ww1936/hist/Wear";
import { techTotals } from "@openfront/engine-lib/ww1936/WwTechs";
import { createGameRunner, GameRunner } from "@openfront/engine/GameRunner";
import { equipCostMilli } from "@openfront/engine/ww1936/depth/Designs";
import { designCtxOf } from "@openfront/engine/ww1936/depth/WwDepth";
import { stepProduction } from "@openfront/engine/ww1936/economy/Production";
import { trainDaysOf } from "@openfront/engine/ww1936/land/Training";
import * as Spirits from "@openfront/engine/ww1936/politics/Spirits";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { stepTo, wwGameStart } from "./util";
const { removeSpirit } = Spirits;

const NEUTRAL: ModInput = {
  attacking: false,
  genAtt: 0,
  genDef: 0,
  traits: 0,
  flags: 0,
  tech: techTotals(new Set()),
  exp: 0,
  planBp: 0,
  river: 0,
  strait: false,
  fort: 0,
  entrench: 0,
  excessBp: 0,
  supplyPm: 1000,
  encircled: false,
  airBp: 0,
  fuelBp: 0,
  landingBp: 0,
  coastalFortBp: 0,
  shoreBp: 0,
  fmAtt: 0,
  fmDef: 0,
  fmTraits: 0,
  cmdAttBp: 0,
  cmdDefBp: 0,
  enemyPlanCutBp: 0,
  fortCut: 0,
  halfSupply: false,
  designFlags: 0,
  artSoftPm: 0,
  fmPlanBp: 0,
};

const maps = new NodeGameMapLoader(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../resources/maps",
  ),
);

let runner: GameRunner;
beforeAll(async () => {
  runner = await createGameRunner(
    wwGameStart({}, []),
    undefined,
    await loadMapFiles(maps, GameMapType.World1936, GameMapSize.Normal),
    (gu) => {
      if ("errMsg" in gu) throw new Error(gu.errMsg);
    },
  );
  stepTo(runner, WW_PREP_TICKS + 10);
}, 120_000);

const ww = () => runner.game.worldWar()!;
const idOf = (t: CountryTag) => ww().land.scenario.smallIdOf(t);
const stats = (t: CountryTag) => ww().economy.country(idOf(t))!.stats;
const def = (id: string) => SPIRITS_NATIONAL.find((s) => s.id === id)!;
const key = (type: string, gen = 1) =>
  EQUIP_KEYS.findIndex(([t, g]) => t === type && g === gen);

/** [with, without]: `f()` with the spirit on and with it taken off (put back after). */
function toggled(
  tag: CountryTag,
  spirit: string,
  f: () => number,
): [number, number] {
  const pol = ww().politics;
  const id = idOf(tag);
  const on = f();
  const c = pol.country(id)!;
  const at = c.spirits.findIndex((x) => x.id === spirit);
  const rec = { ...c.spirits[at] };
  removeSpirit(pol, id, spirit);
  const off = f();
  c.spirits.splice(at, 0, rec);
  pol.recomputeStats(id);
  return [on, off];
}

const TRAITS: Record<string, readonly string[]> = {
  DEU: ["nat_deu_panzer", "nat_deu_workshop", "nat_deu_strain", "nat_deu_army"],
  SUN: [
    "nat_sun_mass",
    "nat_sun_resilience",
    "nat_sun_purge_gap",
    "nat_sun_army",
  ],
  USA: [
    "nat_usa_arsenal",
    "nat_usa_logistics",
    "nat_usa_slow_mobilisation",
    "nat_usa_army",
  ],
  GBR: [
    "nat_gbr_lifeline",
    "nat_gbr_radar_net",
    "nat_gbr_commonwealth",
    "nat_gbr_army",
  ],
  FRA: [
    "nat_fra_citadel",
    "nat_fra_slow_heavy",
    "nat_fra_stripped_arsenal",
    "nat_fra_army",
  ],
  JPN: [
    "nat_jpn_kido_butai",
    "nat_jpn_assault",
    "nat_jpn_scarce",
    "nat_jpn_army",
  ],
  ITA: [
    "nat_ita_mare_nostrum",
    "nat_ita_light_forces",
    "nat_ita_thin_industry",
    "nat_ita_army",
  ],
};

describe("w69 national traits", () => {
  test("each major starts with its traits, and every stat moves by exactly the spirit's number", () => {
    for (const [tag, ids] of Object.entries(TRAITS)) {
      const c = ww().politics.country(idOf(tag as CountryTag))!;
      for (const id of ids) {
        expect(c.hasSpirit(id)).toBe(true);
        for (const [k, v] of Object.entries(def(id).stats)) {
          const [on, off] = toggled(
            tag as CountryTag,
            id,
            () =>
              (stats(tag as CountryTag) as unknown as Record<string, number>)[
                k
              ],
          );
          expect([id, k, on - off]).toEqual([id, k, v]);
        }
      }
    }
  });

  test("Germany: efficiency climbs faster, tanks cost more and break down, armour holds its org", () => {
    const [capOn, capOff] = toggled("DEU", "nat_deu_workshop", () =>
      effCapBp(stats("DEU")),
    );
    expect(capOn - capOff).toBe(800);
    const [gOn, gOff] = toggled(
      "DEU",
      "nat_deu_workshop",
      () => efficiencyGrowth(2000, effCapBp(stats("DEU"))) - 2000,
    );
    expect(gOn / gOff).toBeGreaterThan(1.25);
    const ctx = () =>
      designCtxOf(ww().depth!, idOf("DEU"), { kind: "tank", base: "light" });
    const [relOn, relOff] = toggled("DEU", "nat_deu_strain", () => ctx().relPp);
    expect(relOn - relOff).toBe(-5);
    const [costOn, costOff] = toggled("DEU", "nat_deu_strain", () =>
      equipCostMilli(ww().depth!, idOf("DEU"), key("light_tank")),
    );
    expect(costOn / costOff).toBeGreaterThan(1.14);
    expect(costOn / costOff).toBeLessThan(1.16);
    const land = ww().land;
    const tpl = land
      .country(idOf("DEU"))!
      .templates.find(
        (t) =>
          (land.templateStatsOf(idOf("DEU"), t.id)!.flags & TPL_ARMOR_ANY) !==
          0,
      );
    if (tpl !== undefined) {
      const [oOn, oOff] = toggled(
        "DEU",
        "nat_deu_panzer",
        () => land.templateStatsOf(idOf("DEU"), tpl.id)!.orgMilli,
      );
      expect(oOn - oOff).toBe(4000);
    }
    const [bOn, bOff] = toggled(
      "DEU",
      "nat_deu_panzer",
      () =>
        battalionStatPct(
          stats("DEU") as unknown as Partial<Record<WwStatKey, number>>,
          "medium_armor",
        ).brk,
    );
    expect(bOn - bOff).toBe(10);
  });

  test("Soviet Union: cheap gear, quick recovery, and an early command weakness that ends", () => {
    const [cOn, cOff] = toggled("SUN", "nat_sun_mass", () =>
      equipCostMilli(ww().depth!, idOf("SUN"), key("infantry_equipment")),
    );
    expect(cOn / cOff).toBeGreaterThan(0.94);
    expect(cOn / cOff).toBeLessThan(0.96);
    const land = ww().land;
    const row = land.rowsOf(idOf("SUN"))[0];
    const [mOn, mOff] = toggled("SUN", "nat_sun_purge_gap", () =>
      land.orgMaxOf(row),
    );
    expect(mOn / mOff).toBeGreaterThan(0.84);
    expect(mOn / mOff).toBeLessThan(0.86);
    const pol = ww().politics;
    const c = pol.country(idOf("SUN"))!;
    expect(c.spirits.find((s) => s.id === "nat_sun_purge_gap")!.untilDay).toBe(
      dayOfDate("1941-01-01"),
    );
    // The day it runs out it hands over to the milder one, which also ends.
    const expireSpirits = Spirits.expireSpirits;
    expireSpirits(pol, c, dayOfDate("1941-01-01"));
    expect(c.hasSpirit("nat_sun_purge_gap")).toBe(false);
    expect(c.hasSpirit("nat_sun_purge_scars")).toBe(true);
    expect(stats("SUN").orgPct).toBe(-7);
    expireSpirits(pol, c, dayOfDate("1942-01-01"));
    expect(c.hasSpirit("nat_sun_purge_scars")).toBe(false);
    expect(stats("SUN").orgPct).toBe(0);
  });

  test("United States: faster building, more fuel room, slower training", () => {
    const eco = ww().economy;
    void eco;
    const [fOn, fOff] = toggled("USA", "nat_usa_logistics", () =>
      fuelCap(10, 0, stats("USA")),
    );
    expect(fOn / fOff).toBeGreaterThan(1.19);
    const [tOn, tOff] = toggled("USA", "nat_usa_slow_mobilisation", () =>
      trainDaysOf(ww().economy.country(idOf("USA")), { trainDays: 100 }),
    );
    expect([tOn, tOff]).toEqual([125, 100]);
    const [pOn, pOff] = toggled(
      "USA",
      "nat_usa_arsenal",
      () => stats("USA").constructionPct,
    );
    expect(pOn - pOff).toBe(20);
    const [dOn, dOff] = toggled("USA", "nat_usa_arsenal", () =>
      equipCostMilli(ww().depth!, idOf("USA"), key("fighter")),
    );
    expect(dOn).toBeLessThanOrEqual(dOff);
  });

  test("France: forts and digging in count for more; the arsenal lock only bites in exile", () => {
    const ctxBase = { ...NEUTRAL, entrench: 5, fort: 3 };
    const tech = stats("FRA") as never;
    const [dOn, dOff] = toggled(
      "FRA",
      "nat_fra_citadel",
      () => divisionMods({ ...ctxBase, tech }).mods.defenseBp,
    );
    // Level 3 forts at 5 % a level: +15 % on the defence, the rest of the sum unchanged.
    expect(dOn - dOff).toBe(1500);
    const [eOn, eOff] = toggled("FRA", "nat_fra_citadel", () =>
      entrenchMax(0, stats("FRA")),
    );
    expect(eOn - eOff).toBe(1);
    const econ = ww().economy;
    const ce = econ.country(idOf("FRA"))!;
    const make = () => {
      stepProduction(econ, ce);
      return ce.lines.reduce((n, l) => n + l.lastOutput, 0);
    };
    expect(ce.lines.some((l) => l.active > 0)).toBe(true);
    expect(make()).toBeGreaterThan(0);
    const eg = ww().endgame;
    const real = eg.isExile.bind(eg);
    eg.isExile = (x: number) => x === idOf("FRA") || real(x);
    expect(make()).toBe(0);
    // Without the spirit an exile makes gear as any country.
    removeSpirit(ww().politics, idOf("FRA"), "nat_fra_stripped_arsenal");
    expect(make()).toBeGreaterThan(0);
    eg.isExile = real;
  });

  test("Germany's fragile tanks wear out a quarter faster; Italy's light gear is cheaper", () => {
    const rel = 700;
    const [wOn, wOff] = [breakdownPpm(rel - 50), breakdownPpm(rel)];
    expect(wOn / wOff).toBeCloseTo(1.25, 2);
    const [cOn, cOff] = toggled("ITA", "nat_ita_light_forces", () =>
      equipCostMilli(ww().depth!, idOf("ITA"), key("light_tank")),
    );
    expect(cOn / cOff).toBeGreaterThan(0.84);
    expect(cOn / cOff).toBeLessThan(0.86);
  });

  test("every trait and every major's style line has English and Korean text", () => {
    const read = (f: string) =>
      JSON.parse(
        fs.readFileSync(
          path.join(__dirname, "../../resources/lang", f),
          "utf8",
        ),
      ).ww1936;
    for (const lang of [read("en.json"), read("ko.json")]) {
      for (const sp of SPIRITS_NATIONAL) {
        expect(lang.spirit[sp.id]).toBeTruthy();
        expect(lang.spirit_desc[sp.id]).toBeTruthy();
      }
      for (const tag of Object.keys(TRAITS))
        expect(lang.style[tag]).toBeTruthy();
    }
  });
});
