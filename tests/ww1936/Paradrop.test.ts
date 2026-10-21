// World War 1936 P4 (plan Task 8 Step 7): paradrops (P4 spec §14.10, plan
// decision 35) on ww1936sea. Germany and Poland are humans at war from
// 1936-06-01; two German paratrooper divisions stand in Berlin (air base
// 2) and drop on Warsaw (163 km). The order is P2's (ten days of
// preparation, the drop); the air war adds its conditions and the
// transports' losses. The range test runs on world1936 (the test maps
// are smaller than a transport's 1,100 km).
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import {
  equipKey,
  EQUIPMENT_TYPES,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  aaLossPm,
  paradropBlockOf,
} from "@openfront/engine-lib/ww1936/AirRules";
import { dayOfDate, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { landOrderBlockOf } from "@openfront/engine-lib/ww1936/LandOrderChecks";
import type { Game } from "@openfront/engine/game/Game";
import { createGameRunner } from "@openfront/engine/GameRunner";
import {
  reservedTransports,
  transportsFor,
} from "@openfront/engine/ww1936/air/Paradrop";
import {
  damageBuilding,
  effectiveLevel,
  repairBuilding,
} from "@openfront/engine/ww1936/economy/Buildings";
import { paradropLossPm } from "@openfront/engine/ww1936/land/LandAirBridge";
import { orderCheckWorld } from "@openfront/engine/ww1936/land/Orders";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { REGION, SEA, SR } from "./seaFixture";
import {
  byTag,
  clearLand,
  dropPact,
  HUMAN,
  land,
  placeArmy,
  stamped,
  step,
  stepTo,
  warAfterPrep,
  withTestPolitics,
  wwGameStart,
  WwHuman,
  wwRunner,
} from "./util";

withTestPolitics();

const DEU_POL: WwHuman[] = [
  { clientID: HUMAN, country: "DEU" },
  { clientID: "HUMAN002", country: "POL" },
];
const JUNE_1 = dayOfDate("1936-06-01");
const TRANSPORT = equipKey("transport_plane", 1);

function stockUp(g: Game, tag: "DEU" | "POL"): void {
  const ce = land(g).econ.country(byTag(g, tag).smallID())!;
  for (const t of EQUIPMENT_TYPES) ce.stock[equipKey(t, 1)] += 100_000;
  ce.manpower += 1_000_000;
}

/** Germany at war with Poland from 1936-06-01, two paratrooper divisions in Berlin, no transports. */
async function paraWar() {
  const runner = await wwRunner({}, DEU_POL, SEA.map);
  const g = runner.game;
  dropPact(g, "DEU", "POL");
  stepTo(runner, dayStartTick(JUNE_1, WW_PREP_TICKS));
  step(runner, 2, [
    stamped(HUMAN, { type: "declare_war", target: byTag(g, "POL").id() }),
  ]);
  clearLand(g);
  stockUp(g, "DEU");
  const ww = g.worldWar()!;
  const l = ww.land;
  const deu = byTag(g, "DEU").smallID();
  const ce = ww.economy.country(deu)!;
  ce.addTech("paratroopers");
  ce.stock[TRANSPORT] = 0;
  const cl = l.country(deu)!;
  const tpl = cl.nextTemplateId++;
  cl.templates.push({
    id: tpl,
    key: "",
    def: {
      name: "Fallschirmjäger",
      battalions: Array(6).fill("paratrooper"),
      support: [],
    },
  });
  const a = placeArmy(g, "DEU", REGION.berlin, 2, tpl);
  return { runner, g, ww, l, air: ww.air, deu, ce, a, tpl };
}

describe("World War 1936 P4: paradrops (spec §14.10)", () => {
  test("a paradrop needs an air base, transports and 70% air superiority", async () => {
    const { g, ww, l, air, deu, ce, a } = await paraWar();
    const drop = {
      kind: "paradrop" as const,
      army: a.id,
      region: REGION.warsaw,
    };
    // The engine and the army card's shared check refuse alike.
    const card = () => landOrderBlockOf(orderCheckWorld(l, deu), drop);
    // Six paratrooper battalions a division, 10 transports each.
    expect(transportsFor(air, a)).toBe(120);
    expect(card()).toBe("no_transport_planes");
    // No working air base where the army stands.
    damageBuilding(ww.economy, REGION.berlin, "air_base", 2000);
    expect(card()).toBe("no_air_base");
    expect(l.issue(deu, drop)).toBe("no_air_base");
    repairBuilding(ww.economy, REGION.berlin, "air_base", 2000);
    ce.stock[TRANSPORT] = 119;
    expect(card()).toBe("no_transport_planes");
    ce.stock[TRANSPORT] = 120;
    expect(card()).toBe("air_superiority_low");
    // Our superiority over Warsaw's zone (its last day): 70%.
    const side = l.sideOf(deu);
    air.setAirSup(SR.eastLand, new Map([[side, 699]]));
    expect(l.issue(deu, drop)).toBe("air_superiority_low");
    air.setAirSup(SR.eastLand, new Map([[side, 700]]));
    expect(card()).toBe(null);
    expect(l.issue(deu, drop)).toBe(null);
    expect(a.order.kind).toBe("paradrop");
    // P2's refusals still come first.
    const b = placeArmy(g, "DEU", REGION.berlin, 1);
    expect(l.issue(deu, { ...drop, army: b.id })).toBe("bad_template");
    // The transports' range (the pure judge; P2's 600 km is shorter today).
    const ask = {
      fromAirBase: true,
      targetKm: 1100,
      transportRangeKm: 1100,
      transportsFree: 10,
      transportsNeed: 10,
      airSupPm: 700,
    };
    expect(paradropBlockOf(ask)).toBe(null);
    expect(paradropBlockOf({ ...ask, targetKm: 1101 })).toBe("out_of_range");
    expect(
      paradropBlockOf({ ...ask, fromAirBase: false, targetKm: 1101 }),
    ).toBe("no_air_base");
  }, 60_000);

  test("transport losses cost division strength", async () => {
    const { runner, ww, l, air, deu, ce, a } = await paraWar();
    ce.stock[TRANSPORT] = 120;
    air.setAirSup(SR.eastLand, new Map([[l.sideOf(deu), 1000]]));
    // Warsaw's five anti-air levels: 15‰ of the transports.
    ww.economy.addBuilding(REGION.warsaw, "anti_air", 5);
    const pol = ww.economy.country(l.controller[REGION.warsaw])!;
    const pm = aaLossPm(5, 0, pol.stats.aaPct, false);
    expect(pm).toBe(15);
    expect(paradropLossPm(l, a.id, REGION.warsaw)).toBe(15);
    expect(
      l.issue(deu, { kind: "paradrop", army: a.id, region: REGION.warsaw }),
    ).toBe(null);
    stepTo(runner, dayStartTick(a.order.readyDay, WW_PREP_TICKS));
    const rows = a.divisions.map((id) => l.divisions.rowOf(id));
    const men = rows.map((r) => l.divisions.men[r]);
    const hp = rows.map((r) => l.statsOf(r).hpMilli);
    step(runner);
    expect(a.order.kind).toBe("idle");
    // The divisions lost 15‰ of their strength with the planes.
    a.divisions.forEach((id, i) => {
      const r = l.divisions.rowOf(id);
      expect(l.divisions.region[r]).toBe(REGION.warsaw);
      const hpLoss = Math.max(1, Math.floor((hp[i] * pm) / 1000));
      const lost = Math.floor((men[i] * hpLoss) / hp[i]);
      expect(lost).toBeGreaterThan(0);
      expect(men[i] - l.divisions.men[r]).toBe(lost);
    });
    // 120 × 15‰ = 1.8 transports: one lost, the rest back in the stock.
    expect(ce.stock[TRANSPORT]).toBe(119);
    expect(air.planesLostTotal).toBe(1);
  }, 60_000);

  test("two prepared paradrops cannot share the same transports", async () => {
    const { runner, g, l, air, deu, ce, a, tpl } = await paraWar();
    air.setAirSup(SR.eastLand, new Map([[l.sideOf(deu), 1000]]));
    const b = placeArmy(g, "DEU", REGION.berlin, 1, tpl);
    expect(transportsFor(air, a)).toBe(120);
    expect(transportsFor(air, b)).toBe(60);
    ce.stock[TRANSPORT] = 150;
    const drop = (id: number) =>
      l.issue(deu, { kind: "paradrop", army: id, region: REGION.warsaw });
    expect(drop(a.id)).toBe(null);
    // The first drop holds 120 of the 150 until it lands.
    expect(reservedTransports(air, deu, b.id)).toBe(120);
    expect(drop(b.id)).toBe("no_transport_planes");
    // An army's own order does not count against itself (it may re-order).
    expect(drop(a.id)).toBe(null);
    ce.stock[TRANSPORT] = 180;
    expect(drop(b.id)).toBe(null);
    expect(reservedTransports(air, deu, 0)).toBe(180);
    // Both land the same day (army id order); then nothing is held.
    stepTo(runner, dayStartTick(a.order.readyDay, WW_PREP_TICKS));
    step(runner);
    expect([a.order.kind, b.order.kind]).toEqual(["idle", "idle"]);
    expect(reservedTransports(air, deu, 0)).toBe(0);
    expect(ce.stock[TRANSPORT]).toBe(180);
  }, 60_000);

  test("on world1936 the transports' range replaces P2's 600 km", async () => {
    // The test maps are too small for 1,100 km: Britain drops from London.
    const runner = await createGameRunner(
      wwGameStart({}, [{ clientID: HUMAN, country: "GBR" }]),
      undefined,
      await loadMapFiles(
        new NodeGameMapLoader(
          path.resolve(
            path.dirname(fileURLToPath(import.meta.url)),
            "../../resources/maps",
          ),
        ),
        GameMapType.World1936,
        GameMapSize.Normal,
      ),
      (gu) => {
        if ("errMsg" in gu) throw new Error(gu.errMsg);
      },
    );
    const g = runner.game;
    warAfterPrep(runner, HUMAN, "DEU");
    const ww = g.worldWar()!;
    const l = ww.land;
    const sc = l.scenario;
    const gbr = sc.smallIdOf("GBR");
    const deu = sc.smallIdOf("DEU");
    expect(l.isEnemy(gbr, deu)).toBe(true);
    const london = sc.regionAt(sc.capitalTile("GBR"));
    expect(effectiveLevel(ww.economy, london, "air_base")).toBeGreaterThan(0);
    const km = (r: number) =>
      sc.kmBetween(sc.centerTile(london), sc.centerTile(r));
    // German regions beyond P2's 600 km: one within the 1,100 km of a
    // 1937 transport, one beyond.
    const german = sc.landRegions
      .map((r) => r.id)
      .filter((r) => l.controller[r] === deu);
    const near = german.find((r) => km(r) > 600 && km(r) <= 1000)!;
    const far = german.find((r) => km(r) > 1200)!;
    expect(near).toBeDefined();
    expect(far).toBeDefined();
    const ce = ww.economy.country(gbr)!;
    for (const t of EQUIPMENT_TYPES) ce.stock[equipKey(t, 1)] += 100_000;
    ce.manpower += 1_000_000;
    ce.addTech("paratroopers");
    ce.stock[TRANSPORT] = 60;
    const cl = l.country(gbr)!;
    const tpl = cl.nextTemplateId++;
    cl.templates.push({
      id: tpl,
      key: "",
      def: {
        name: "Airborne",
        battalions: Array(6).fill("paratrooper"),
        support: [],
      },
    });
    const a = placeArmy(g, "GBR", london, 1, tpl);
    const side = l.sideOf(gbr);
    for (const r of [near, far]) {
      ww.air.setAirSup(sc.regionSr(r), new Map([[side, 1000]]));
    }
    const drop = (r: number) =>
      l.issue(gbr, { kind: "paradrop", army: a.id, region: r });
    expect(drop(far)).toBe("out_of_range");
    expect(drop(near)).toBe(null);
    expect(a.order.to).toBe(near);
  }, 300_000);
});
