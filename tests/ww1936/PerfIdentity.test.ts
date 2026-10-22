// World War 1936, the final perf lane: each speed-up answers exactly what
// the code it replaced answered. The old computations are written out here
// as references, and every case compares against them.
import { MIO_FAMILIES } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  EQUIP_KEYS,
  equipKey,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { traitBit } from "@openfront/engine-api/ww1936/LandTypes";
import type { WwStatKey } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  dayOfDate,
  daysFromCivil,
} from "@openfront/engine-lib/ww1936/Calendar";
import { unitCostMilli } from "@openfront/engine-lib/ww1936/Equipment";
import { GENERALS } from "@openfront/engine-lib/ww1936/Generals";
import { mioFamilyOf } from "@openfront/engine-lib/ww1936/MioRules";
import { skirmisherContact } from "@openfront/engine/ww1936/depth/Command";
import { equipCostMilli } from "@openfront/engine/ww1936/depth/Designs";
import { energyParts } from "@openfront/engine/ww1936/depth/Energy";
import { levelPartsOf } from "@openfront/engine/ww1936/depth/IntelLevels";
import { damageBuilding } from "@openfront/engine/ww1936/economy/Buildings";
import { lineCapBp } from "@openfront/engine/ww1936/economy/Production";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import type { WwPolitics } from "@openfront/engine/ww1936/politics/WwPolitics";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { placeArmy, stepTo, wwRunner } from "./util";

afterEach(() => usePoliticsContent(null));

describe("final perf lane: same answers", () => {
  test("dayOfDate remembers valid dates and still throws on a bad one", () => {
    const epoch = daysFromCivil(1936, 1, 1);
    for (const iso of [
      "1936-01-01",
      "1939-09-01",
      "1945-08-21",
      "1900-02-28",
    ]) {
      const [y, m, d] = iso.split("-").map(Number);
      expect(dayOfDate(iso)).toBe(daysFromCivil(y, m, d) - epoch);
      // The second answer is the remembered one: the same.
      expect(dayOfDate(iso)).toBe(daysFromCivil(y, m, d) - epoch);
    }
    expect(() => dayOfDate("1939-9-1")).toThrow("not an ISO date");
    expect(() => dayOfDate("1939-9-1")).toThrow("not an ISO date");
  });

  test("advisorHolds: the persons index answers what the walk over every advisor did", async () => {
    usePoliticsContent(depthFixture());
    const runner = await wwRunner({}, [], DEEP.map);
    stepTo(runner, WW_PREP_TICKS + 2);
    const pol = runner.game.worldWar()!.politics;
    // The old walk (plan decision 19).
    const walk = (p: WwPolitics, generalId: string) =>
      p
        .list()
        .some((c) =>
          c.advisors.some(
            (a) =>
              a !== null &&
              p.content.personIdx.get(a)?.alsoGeneral === generalId,
          ),
        );
    const also = [...pol.content.personIdx.values()].filter(
      (p) => p.alsoGeneral !== undefined,
    );
    const ids = [
      ...new Set([
        ...GENERALS.map((g) => g.id),
        ...also.map((p) => p.alsoGeneral!),
        "no_such_general",
      ]),
    ];
    const check = () => {
      for (const id of ids)
        expect(pol.advisorHolds(id), id).toBe(walk(pol, id));
    };
    check();
    // Seat every person who is also a general somewhere, then a title.
    const c = pol.list()[0];
    for (const [i, p] of also.slice(0, c.advisors.length).entries()) {
      c.advisors[i] = p.id;
    }
    check();
    if (also.length > 0)
      expect(pol.advisorHolds(also[0].alsoGeneral!)).toBe(true);
    c.advisors[0] = "title:administrator";
    check();
    c.advisors.fill(null);
    check();
  });

  test("energyParts' one walk counts the working power plants and refineries countryBuildings counts", async () => {
    usePoliticsContent(depthFixture());
    const runner = await wwRunner({}, [], DEEP.map);
    stepTo(runner, WW_PREP_TICKS + 2);
    const ww = runner.game.worldWar()!;
    const econ = ww.economy;
    const d = ww.depth;
    const DEU = DEEP.tag.DEU;
    const check = () => {
      const p = energyParts(d, DEU, 0);
      expect(p.plants).toBe(econ.countryBuildings(DEU, "power_plant"));
      expect(p.refineries).toBe(
        econ.countryBuildings(DEU, "synthetic_refinery"),
      );
    };
    check();
    const regions = econ.regionsOf(DEU);
    expect(regions.length).toBeGreaterThan(1);
    const plants = econ.buildingArray("power_plant");
    const refs = econ.buildingArray("synthetic_refinery");
    plants[regions[0]] = 3;
    refs[regions[0]] = 1;
    plants[regions[1]] = 2;
    check();
    // Bombed: a stopped building does not work.
    damageBuilding(econ, regions[0], "power_plant", 2_500);
    damageBuilding(econ, regions[0], "synthetic_refinery", 1_000);
    check();
    expect(energyParts(d, DEU, 0).plants).toBe(3);
  });

  test("the MIO cost and cap keys read the same stats as the names built each time", async () => {
    usePoliticsContent(depthFixture());
    const runner = await wwRunner({}, [], DEEP.map);
    stepTo(runner, WW_PREP_TICKS + 2);
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const DEU = DEEP.tag.DEU;
    const ce = ww.economy.country(DEU)!;
    const stats = ce.stats as unknown as Record<string, number>;
    for (let f = 0; f < MIO_FAMILIES.length; f++) {
      const fam = MIO_FAMILIES[f].slice(4);
      stats[`mioCostPct_${fam}`] = -10 - f;
      stats[`mioEffCapBp_${fam}`] = -500 - 100 * f;
    }
    let seen = 0;
    for (let key = 0; key < EQUIP_KEYS.length; key++) {
      const [type, gen] = EQUIP_KEYS[key];
      const f = mioFamilyOf(type);
      if (f < 0 || type === "tank_design" || type === "plane_design") continue;
      seen++;
      const pct = stats[`mioCostPct_${MIO_FAMILIES[f].slice(4)}` as WwStatKey];
      const cost = unitCostMilli(type, gen);
      expect(equipCostMilli(d, DEU, key), type).toBe(
        Math.floor((cost * Math.max(10, 100 + pct)) / 100),
      );
      const add = stats[`mioEffCapBp_${MIO_FAMILIES[f].slice(4)}`];
      expect(lineCapBp(d, ce, 8_000, key), type).toBe(
        Math.max(1_000, Math.min(10_000, 8_000 + add)),
      );
    }
    expect(seen).toBeGreaterThan(5);
    expect(lineCapBp(d, ce, 8_000, equipKey("infantry_equipment", 1))).toBe(
      7_500,
    );
  });

  test("WwEndgame.war's index answers what find over the wars list did, through adds, removals and a new list", async () => {
    usePoliticsContent(depthFixture());
    const runner = await wwRunner({}, [], DEEP.map);
    stepTo(runner, WW_PREP_TICKS + 2);
    const g = runner.game;
    const ww = g.worldWar()!;
    const eg = ww.endgame;
    const ids = ww.land.countries().map((c) => c.smallID);
    const check = () => {
      const top = Math.max(0, ...eg.wars.map((w) => w.id)) + 3;
      for (let id = -1; id <= top; id++) {
        expect(eg.war(id), `war ${id}`).toBe(
          eg.wars.find((w) => w.id === id) ?? null,
        );
      }
    };
    check();
    for (const a of ids) {
      for (const b of ids) {
        if (a < b && !ww.land.sameSide(a, b)) ww.setWar(a, b, g.ticks());
      }
    }
    expect(eg.wars.length).toBeGreaterThan(2);
    check();
    // Taken out of the middle (positions shift), then a new list.
    eg.wars.splice(1, 1);
    check();
    eg.wars = eg.wars.filter((_, i) => i % 2 === 0);
    check();
    eg.wars.reverse();
    check();
  });

  test("intel rows: the skirmisher line is Command.skirmisherContact's answer for every target", async () => {
    usePoliticsContent(depthFixture());
    const DEU = DEEP.tag.DEU;
    const runner = await wwRunner(
      {},
      [{ clientID: "HUMANDEU", country: "DEU" }],
      DEEP.map,
    );
    stepTo(runner, WW_PREP_TICKS + 2);
    const g = runner.game;
    const ww = g.worldWar()!;
    const d = ww.depth;
    const land = ww.land;
    for (const tag of ["DEU", "POL"] as const) {
      const ce = ww.economy.country(DEEP.tag[tag])!;
      ce.manpower = 1_000_000;
      for (let k = 0; k < ce.stock.length; k++) ce.stock[k] += 100_000;
    }
    const deu = placeArmy(g, "DEU", DEEP.region.berlin, 2);
    placeArmy(g, "POL", DEEP.region.warsaw, 1);
    const cl = land.country(DEU)!;
    const gen = cl.generals.find((x) => x.army === 0)!;
    deu.general = gen.id;
    gen.army = deu.id;
    const lines = () => {
      const on = new Set<number>();
      for (const [t, dom, key] of levelPartsOf(d, DEU)) {
        if (key === "skirmisher" && dom === 1) on.add(t);
      }
      return on;
    };
    const check = () => {
      const on = lines();
      for (let t = 1; t < d.cap; t++) {
        if (t === DEU || !ww.isActor(t)) continue;
        const atWar = ww.isAtWar(DEU, t);
        const nb =
          ww.economy.countryNeighbours(DEU).includes(t) ||
          // Shared harbour zones count as neighbours too: take the row's own word.
          levelPartsOf(d, DEU).some(
            ([x, , key]) => x === t && key === "neighbour",
          );
        expect(on.has(t), `target ${t}`).toBe(
          (atWar || nb) && skirmisherContact(d, DEU, t),
        );
      }
      return on;
    };
    expect(check().size).toBe(0);
    gen.traits |= traitBit("skirmisher");
    expect(check().size).toBeGreaterThan(0);
    gen.traits &= ~traitBit("skirmisher");
    expect(check().size).toBe(0);
  });
});
