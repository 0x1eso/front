// World War 1936 P4 (lane U review): the land cards' five P4 battle lines
// (client LandSeaAir, from the screens' views) equal the engine's
// modInputOf on the same state — enemy air control, fuel, a landing's two
// cuts, shore bombardment. Britain lands at Rome under its own fighters
// with battleships off the coast; Italy defends short of fuel.
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  type BattalionId,
  GROUND_EQUIPMENT,
  ROLE_ATTACK,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  CONVOY_USES,
  FLEET_MISSIONS,
  FLEET_STATES,
  INVASION_STATES,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { divisionConvoys } from "@openfront/engine-lib/ww1936/ConvoyRules";
import { ALL_EDGES, seaPath } from "@openfront/engine-lib/ww1936/SeaGraph";
import type { Game } from "@openfront/engine/game/Game";
import { modInputOf } from "@openfront/engine/ww1936/land/Battles";
import {
  divisionWeightCenti,
  liftDivisions,
} from "@openfront/engine/ww1936/land/SeaLift";
import type { Army } from "@openfront/engine/ww1936/land/WwLand";
import {
  dailyInvasions,
  landInvasion,
} from "@openfront/engine/ww1936/navy/Invasions";
import type { Voyage, WwNavy } from "@openfront/engine/ww1936/navy/WwNavy";
import { describe, expect, it } from "vitest";
import {
  airBpOf,
  fuelBpOf,
  landingBpsOf,
  LandSeaAir,
  shoreBpOf,
} from "../../src/client/hud/ww1936/LandSeaAir";
import { WwAirView } from "../../src/client/view/WwAirView";
import { WwEconomyView } from "../../src/client/view/WwEconomyView";
import { WwNavyView } from "../../src/client/view/WwNavyView";
import { REGION, SEA, SR, TAG_ID, ZONE } from "./seaFixture";
import {
  byTag,
  clearLand,
  HUMAN,
  land,
  placeArmy,
  step,
  stepTo,
  warAfterPrep,
  withTestPolitics,
  wwRunnerCapture,
} from "./util";

withTestPolitics();

const GBR = TAG_ID.GBR;
const ITA = TAG_ID.ITA;
const ROME = REGION.rome;

function stockUp(g: Game, tag: CountryTag): void {
  const ce = land(g).econ.country(byTag(g, tag).smallID())!;
  for (const t of GROUND_EQUIPMENT) ce.stock[equipKey(t, 1)] += 100_000;
  ce.manpower += 1_000_000;
}

function template(g: Game, tag: CountryTag, battalions: BattalionId[]): number {
  const cl = land(g).country(byTag(g, tag).smallID())!;
  const id = cl.nextTemplateId++;
  cl.templates.push({
    id,
    key: "",
    def: { name: "t", battalions, support: [] },
  });
  return id;
}

/** Invasion Task 6's own helpers: the army prepared, its voyage at the coast. */
function landAt(navy: WwNavy, g: Game, a: Army, target: number): void {
  const owner = a.owner;
  expect(
    navy.issue(owner, { kind: "army_invade", army: a.id, target }, g.ticks()),
  ).toBeNull();
  const inv = navy.invasions.get(a.id)!;
  const day = navy.day(g.ticks());
  for (let i = 0; i < inv.prepDays; i++) {
    dailyInvasions(navy, owner, day, g.ticks());
  }
  const l = navy.land;
  const sc = navy.scenario;
  const divs = [...a.divisions];
  const need = divs.reduce(
    (n, id) => n + divisionConvoys(divisionWeightCenti(l, id)),
    0,
  );
  liftDivisions(l, divs);
  const path = seaPath(
    sc,
    [sc.harborOf(inv.from)],
    [sc.harborOf(inv.target)],
    ALL_EDGES,
  )!;
  const id = navy.nextVoyageId++;
  const route = navy.nextRouteId++;
  navy.routes.set(route, {
    id: route,
    use: CONVOY_USES.indexOf("voyage"),
    owner,
    ref: id,
    zones: path.zones,
    km: path.km,
    srs: [...new Set(path.zones.map((z) => sc.zoneSr(z)))],
    need,
    got: 0,
    nextDay: 0,
  });
  const v: Voyage = {
    id,
    owner,
    army: a.id,
    invasion: true,
    divisions: divs,
    from: inv.from,
    to: inv.target,
    route,
    zoneIdx: 1,
    prog: 0,
    need: 100_000,
    bound: need,
    aborting: false,
    departTick: g.ticks(),
  };
  navy.voyages.set(id, v);
  inv.state = INVASION_STATES.indexOf("sailing");
  inv.voyage = id;
  landInvasion(navy, id, g.ticks());
}

describe("the land cards' P4 lines are the engine's (LandSeaAir parity)", () => {
  it("air, fuel, landing, coastal fort and shore bombardment", async () => {
    const { runner, updates } = await wwRunnerCapture(
      {},
      [
        { clientID: HUMAN, country: "GBR" },
        { clientID: "HUMAN002", country: "ITA" },
      ],
      SEA.map,
    );
    const g = runner.game;
    warAfterPrep(runner, HUMAN, "ITA");
    clearLand(g);
    stockUp(g, "GBR");
    stockUp(g, "ITA");
    const ww = g.worldWar()!;
    const navy = ww.navy;
    const l = ww.land;
    // British fighters over the West (Rome's land zone) for a day.
    const gb = ww.economy.country(GBR)!;
    gb.stock[equipKey("fighter", 1)] = 300;
    expect(
      ww.air.issue(
        GBR,
        {
          kind: "air_deploy",
          sr: SR.westLand,
          type: "fighter",
          mission: "air_superiority",
          count: 300,
        },
        g.ticks(),
      ),
    ).toBeNull();
    const day = ww.day(g.ticks()) + 1;
    stepTo(
      runner,
      dayStartTick(day, ww.prepEndTick()) +
        (ww.scenario.srIdxOf(SR.westLand) % 7) +
        1,
    );
    expect(ww.air.airSup(l.sideOf(GBR), SR.westLand)).toBeGreaterThan(500);
    // Italy holds Rome with infantry and a motorized division.
    placeArmy(g, "ITA", ROME, 1);
    const mot = template(g, "ITA", [
      ...new Array<BattalionId>(4).fill("infantry"),
      "motorized",
      "motorized",
    ]);
    placeArmy(g, "ITA", ROME, 1, mot);
    // Britain lands: infantry and marines, a coastal fort waits.
    const marines = template(g, "GBR", new Array(6).fill("marine"));
    navy.econ.buildingArray("coastal_fort")[ROME] = 1;
    navy.econ.afterBuildingChange(ROME, "coastal_fort");
    landAt(navy, g, placeArmy(g, "GBR", REGION.london, 1), ROME);
    landAt(navy, g, placeArmy(g, "GBR", REGION.london, 1, marines), ROME);
    // Four British battleships off Rome on invasion support.
    const fid = navy.createFleet(GBR, REGION.london, [["bb", 1, 4]]);
    const f = navy.fleets.get(fid)!;
    f.docked = 0;
    navy.setFleetZone(f, ZONE.middle);
    f.mission = FLEET_MISSIONS.indexOf("invasion_support");
    f.missionSr = SR.central;
    f.state = FLEET_STATES.indexOf("on_station");
    navy.markFleet(fid);
    navy.markCountry(GBR);
    step(runner);
    expect(l.battles.has(ROME)).toBe(true);
    // Italy runs short of fuel (yesterday's ratio, as both sides read it).
    const it = ww.economy.country(ITA)!;
    it.fuelRatioPm = 600;

    // The British client merges what the engine sent.
    const sc = ww.scenario;
    const econ = new WwEconomyView(sc);
    const navyView = new WwNavyView(
      sc,
      () => GBR,
      () => l.sideOf(GBR),
    );
    const air = new WwAirView(
      sc,
      () => GBR,
      () => l.sideOf(GBR),
    );
    for (const u of updates) {
      for (const x of u.updates[GameUpdateType.WwEconomy] ?? [])
        econ.apply(x.data);
      for (const x of u.updates[GameUpdateType.WwNavy] ?? []) {
        navyView.apply(x.data, u.tick);
      }
      for (const x of u.updates[GameUpdateType.WwAir] ?? []) air.apply(x.data);
    }
    const sum = econ.summary(ITA)!;
    econ.apply({
      countries: [{ ...sum, fuelRatioPm: it.fuelRatioPm }],
      details: [],
      regions: [],
    });
    const p4: LandSeaAir = {
      navy: navyView,
      air,
      sideOf: (id) => l.sideOf(id),
      membersOf: (s) => l.sideMembers(s),
      stats: () => gb.stats,
      atWarAny: (a) => ww.hasWar(a),
      neutralTurkey: () => false,
    };
    const techs = new Set(gb.researched);
    const b = l.battles.get(ROME)!;
    const t = l.divisions;
    const regionOf = (id: number) => t.region[t.rowOf(id)];
    const seen = { air: 0, fuel: 0, landing: 0, fort: 0, shore: 0 };
    for (let r = 0; r < t.rows; r++) {
      if (!t.alive(r) || t.battle[r] !== ROME) continue;
      const attacking = t.role[r] === ROLE_ATTACK;
      const owner = t.owner[r];
      const engine = modInputOf(l, r, ROME, attacking);
      const base = l.baseStatsOf(r);
      const flags = l.flagsOf(r);
      const client = {
        airBp: airBpOf(p4, sc, ROME, owner, base.airAtk),
        fuelBp: fuelBpOf(econ, owner, base.fuelWidthPm),
        ...(attacking && owner === GBR
          ? landingBpsOf(p4, econ, GBR, [t.id[r]], regionOf, ROME, flags, techs)
          : { landingBp: 0, coastalFortBp: 0 }),
        shoreBp: attacking
          ? 0
          : shoreBpOf(p4, sc, GBR, techs, ROME, b.attLead, owner),
      };
      expect(client).toEqual({
        airBp: engine.airBp,
        fuelBp: engine.fuelBp,
        landingBp: engine.landingBp,
        coastalFortBp: engine.coastalFortBp,
        shoreBp: engine.shoreBp,
      });
      if (engine.airBp !== 0) seen.air++;
      if (engine.fuelBp !== 0) seen.fuel++;
      if (engine.landingBp !== 0) seen.landing++;
      if (engine.coastalFortBp !== 0) seen.fort++;
      if (engine.shoreBp !== 0) seen.shore++;
    }
    // Each line was really there on some division.
    expect(seen.air).toBeGreaterThan(0);
    expect(seen.fuel).toBeGreaterThan(0);
    expect(seen.landing).toBe(2);
    expect(seen.fort).toBe(2);
    expect(seen.shore).toBeGreaterThan(0);
  }, 120_000);

  // Task 15 (the T15 carry list): the lead gunner is an ally — France's
  // second-generation battleships with its own bombardment bonus. The
  // client used neutral stats and generation 1 for it; the fleet's summary
  // now carries its guns and its owner's bonus.
  it("shore bombardment under an ally's guns", async () => {
    const { runner, updates } = await wwRunnerCapture(
      {},
      [
        { clientID: HUMAN, country: "GBR" },
        { clientID: "HUMAN002", country: "ITA" },
      ],
      SEA.map,
    );
    const g = runner.game;
    warAfterPrep(runner, HUMAN, "ITA");
    clearLand(g);
    stockUp(g, "GBR");
    stockUp(g, "ITA");
    const ww = g.worldWar()!;
    const navy = ww.navy;
    const l = ww.land;
    const FRA = TAG_ID.FRA;
    expect(l.sideOf(FRA)).toBe(l.sideOf(GBR));
    placeArmy(g, "ITA", ROME, 1);
    landAt(navy, g, placeArmy(g, "GBR", REGION.london, 1), ROME);
    const atSea = (owner: number, comp: [["bb" | "cl", number, number]]) => {
      const f = navy.fleets.get(
        navy.createFleet(
          owner,
          owner === FRA ? REGION.lyon : REGION.london,
          comp,
        ),
      )!;
      f.docked = 0;
      navy.setFleetZone(f, ZONE.middle);
      f.mission = FLEET_MISSIONS.indexOf("invasion_support");
      f.missionSr = SR.central;
      f.state = FLEET_STATES.indexOf("on_station");
      navy.markFleet(f.id);
    };
    // Under the 25% cap, so the numbers show.
    atSea(GBR, [["cl", 1, 1]]);
    atSea(FRA, [["bb", 2, 2]]);
    const fr = ww.economy.country(FRA)!;
    fr.stats.shoreBombardPct = 40;
    step(runner);
    expect(l.battles.has(ROME)).toBe(true);
    const sc = ww.scenario;
    const navyView = new WwNavyView(
      sc,
      () => GBR,
      () => l.sideOf(GBR),
    );
    const air = new WwAirView(
      sc,
      () => GBR,
      () => l.sideOf(GBR),
    );
    for (const u of updates) {
      for (const x of u.updates[GameUpdateType.WwNavy] ?? []) {
        navyView.apply(x.data, u.tick);
      }
    }
    const gb = ww.economy.country(GBR)!;
    const p4: LandSeaAir = {
      navy: navyView,
      air,
      sideOf: (id) => l.sideOf(id),
      membersOf: (x) => l.sideMembers(x),
      stats: () => gb.stats,
      atWarAny: (a) => ww.hasWar(a),
      neutralTurkey: () => false,
    };
    const b = l.battles.get(ROME)!;
    const t = l.divisions;
    let n = 0;
    for (let r = 0; r < t.rows; r++) {
      if (!t.alive(r) || t.battle[r] !== ROME || t.role[r] === ROLE_ATTACK) {
        continue;
      }
      const engine = modInputOf(l, r, ROME, false).shoreBp;
      expect(engine).toBeLessThan(0);
      expect(engine).toBeGreaterThan(-2500);
      expect(
        shoreBpOf(
          p4,
          sc,
          GBR,
          new Set(gb.researched),
          ROME,
          b.attLead,
          t.owner[r],
        ),
      ).toBe(engine);
      n++;
    }
    expect(n).toBeGreaterThan(0);
  }, 120_000);
});
