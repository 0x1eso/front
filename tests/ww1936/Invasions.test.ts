// World War 1936 P4 (plan Task 6 Step 8): naval invasions (P4 spec §11) on
// the test map ww1936sea, a human Britain against a human Italy at war.
// Lane C carries the voyages; where a test needs one at sea it builds the
// record as C's startVoyage does (convoys bound, divisions lifted) and
// calls landInvasion as C's stepSeaVoyages does on arrival, without
// stepping ticks while that hand-made voyage exists.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  type BattalionId,
  GROUND_EQUIPMENT,
  MOVE_NONE,
  MOVE_SEA,
  ROLE_ATTACK,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  CONVOY_USES,
  FLEET_MISSIONS,
  FLEET_STATES,
  INVASION_STATES,
  WW_BEACHHEAD_DAYS,
} from "@openfront/engine-api/ww1936/NavyTypes";
import type { ReadonlyScenarioData } from "@openfront/engine-api/ww1936/ScenarioTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { divisionConvoys } from "@openfront/engine-lib/ww1936/ConvoyRules";
import {
  invasionCapacity,
  shoreBombardBp,
} from "@openfront/engine-lib/ww1936/InvasionRules";
import { noStrikeRegions } from "@openfront/engine-lib/ww1936/NoStrike";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { ALL_EDGES, seaPath } from "@openfront/engine-lib/ww1936/SeaGraph";
import type { Game } from "@openfront/engine/game/Game";
import { snapshotGame } from "@openfront/engine/snapshot/GameSnapshot";
import { battleMods, leaveBattle } from "@openfront/engine/ww1936/land/Battles";
import {
  divisionWeightCenti,
  liftDivisions,
} from "@openfront/engine/ww1936/land/SeaLift";
import type { Army } from "@openfront/engine/ww1936/land/WwLand";
import { freeConvoysOf } from "@openfront/engine/ww1936/navy/Convoys";
import {
  amphibiousModsFor,
  beachheadCapacityMilli,
  beachheads,
  dailyInvasions,
  invasionLaunchBlock,
  landInvasion,
  launchInvasion,
  shoreBombardAt,
} from "@openfront/engine/ww1936/navy/Invasions";
import type { Voyage, WwNavy } from "@openfront/engine/ww1936/navy/WwNavy";
import fs from "fs";
import path from "path";
import { diffSnapshots } from "../util/Snapshot";
import { REGION, SEA, SR, TAG_ID, ZONE } from "./seaFixture";
import {
  byTag,
  clearLand,
  gameHash,
  HUMAN,
  land,
  placeArmy,
  stamped,
  step,
  warAfterPrep,
  withTestPolitics,
  wwRestore,
  wwRunner,
} from "./util";

withTestPolitics();

const HUMAN_ITA = "HUMAN002";
const GBR_ITA = [
  { clientID: HUMAN, country: "GBR" as const },
  { clientID: HUMAN_ITA, country: "ITA" as const },
];
const GBR = TAG_ID.GBR;
const ITA = TAG_ID.ITA;
const st = (s: (typeof INVASION_STATES)[number]) => INVASION_STATES.indexOf(s);

/** Men and every first-generation ground equipment, so placed divisions are full. */
function stockUp(g: Game, tag: CountryTag): void {
  const ce = land(g).econ.country(byTag(g, tag).smallID())!;
  for (const t of GROUND_EQUIPMENT) ce.stock[equipKey(t, 1)] += 100_000;
  ce.manpower += 1_000_000;
}

/** A template of the country's own (these battalions); its id. */
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

/** Britain and Italy at war after the preparation minute, nothing on the board. */
async function atWar(extra: CountryTag[] = []) {
  const runner = await wwRunner({}, GBR_ITA, SEA.map);
  const g = runner.game;
  warAfterPrep(runner, HUMAN, "ITA");
  for (const tag of extra) {
    step(runner, 2, [
      stamped(HUMAN, { type: "declare_war", target: byTag(g, tag).id() }),
    ]);
  }
  clearLand(g);
  stockUp(g, "GBR");
  stockUp(g, "ITA");
  const ww = g.worldWar()!;
  expect(ww.land.isEnemy(GBR, ITA)).toBe(true);
  return { runner, g, ww, navy: ww.navy, l: ww.land };
}

function invade(
  navy: WwNavy,
  owner: number,
  a: Army,
  target: number,
): ReturnType<WwNavy["issue"]> {
  return navy.issue(
    owner,
    { kind: "army_invade", army: a.id, target },
    navy.mg.ticks(),
  );
}

/** The owner's days of preparation, called directly (the clock calls the same). */
function prepare(navy: WwNavy, owner: number, days: number): void {
  const day = navy.day(navy.mg.ticks());
  for (let i = 0; i < days; i++) {
    dailyInvasions(navy, owner, day, navy.mg.ticks());
  }
}

/**
 * The voyage lane C's startVoyage makes for the invasion of `army`: the
 * divisions lifted, the convoys they need bound, the route over the sea;
 * the voyage stands in zone `zoneIdx` of its route.
 */
function sail(navy: WwNavy, army: number, zoneIdx = 0): Voyage {
  const l = navy.land;
  const sc = navy.scenario;
  const inv = navy.invasions.get(army)!;
  const divs = [...l.armies.get(army)!.divisions];
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
    owner: inv.owner,
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
    owner: inv.owner,
    army,
    invasion: true,
    divisions: divs,
    from: inv.from,
    to: inv.target,
    route,
    zoneIdx,
    prog: 0,
    need: 100_000,
    bound: need,
    aborting: false,
    departTick: navy.mg.ticks(),
  };
  navy.voyages.set(id, v);
  inv.state = st("sailing");
  inv.voyage = id;
  return v;
}

/** An army of `n` in `from` invading `target`, prepared (60 days run directly). */
function ready(
  navy: WwNavy,
  g: Game,
  tag: CountryTag,
  from: number,
  target: number,
  n = 1,
  tpl = 1,
): Army {
  const a = placeArmy(g, tag, from, n, tpl);
  const owner = byTag(g, tag).smallID();
  expect(invade(navy, owner, a, target)).toBeNull();
  prepare(navy, owner, navy.invasions.get(a.id)!.prepDays);
  expect(navy.invasions.get(a.id)!.state).toBe(st("ready"));
  return a;
}

const sideOf = (navy: WwNavy, id: number) => navy.sideOf(id);
const vpOwner = (g: Game, region: number) => {
  const sc = g.worldWar()!.scenario;
  const o = g.owner(sc.vpTile(sc.region(region)!));
  return o.isPlayer() ? o.smallID() : 0;
};
const messages = (spy: { mock: { calls: unknown[][] } }, key: string) =>
  spy.mock.calls
    .filter((c) => c[0] === `events_display.${key}`)
    .map((c) => c[4]);

describe("naval invasions", () => {
  it("an invasion needs every division in one port and fits the capacity", async () => {
    const { g, navy, l } = await atWar();
    const ce = navy.econ.country(GBR)!;
    expect(invasionCapacity(ce.stats, ce.researched)).toBe(10);
    const big = placeArmy(g, "GBR", REGION.london, 11);
    expect(invade(navy, GBR, big, REGION.rome)).toBe("invasion_too_large");
    const a = placeArmy(g, "GBR", REGION.london, 10);
    // Not a coastal region, not an enemy's.
    expect(invade(navy, GBR, a, REGION.berlin)).toBe("not_coastal");
    expect(invade(navy, GBR, a, REGION.lyon)).toBe("not_at_war");
    expect(invade(navy, GBR, a, REGION.rome)).toBeNull();
    const inv = navy.invasions.get(a.id)!;
    expect([inv.state, inv.from, inv.target, inv.owner]).toEqual([
      st("preparing"),
      REGION.london,
      REGION.rome,
      GBR,
    ]);
    expect(l.armies.get(a.id)!.order.kind).toBe("invade");
    expect(l.armies.get(a.id)!.order.to).toBe(REGION.rome);
    // Every division in one port: one in Malta joins the army.
    const b = placeArmy(g, "GBR", REGION.london, 1);
    l.moveToArmy(placeArmy(g, "GBR", REGION.malta, 1).divisions[0], b);
    expect(invade(navy, GBR, b, REGION.rome)).toBe("not_in_port");
    // Italy's army may not sail from a British port.
    const ita = placeArmy(g, "ITA", REGION.rome, 1);
    expect(
      navy.issue(
        GBR,
        { kind: "army_invade", army: ita.id, target: REGION.rome },
        g.ticks(),
      ),
    ).toBe("no_army");
  });

  it("another order or a division leaving the port drops the invasion", async () => {
    const { g, navy, l } = await atWar();
    const a = placeArmy(g, "GBR", REGION.london, 2);
    expect(invade(navy, GBR, a, REGION.rome)).toBeNull();
    expect(l.issue(GBR, { kind: "army_halt", army: a.id })).toBeNull();
    expect(navy.invasions.has(a.id)).toBe(false);
    expect(invade(navy, GBR, a, REGION.rome)).toBeNull();
    l.setDivisionRegion(l.divisions.rowOf(a.divisions[1]), REGION.malta);
    prepare(navy, GBR, 1);
    expect(navy.invasions.has(a.id)).toBe(false);
    expect(l.armies.get(a.id)!.order.kind).toBe("idle");
  });

  it("preparation takes 60 days, 30 with marines", async () => {
    const { runner, g, navy } = await atWar();
    const spy = vi.spyOn(g, "displayMessage");
    const a = placeArmy(g, "GBR", REGION.london, 2);
    expect(invade(navy, GBR, a, REGION.rome)).toBeNull();
    const inv = navy.invasions.get(a.id)!;
    expect(inv.prepDays).toBe(60);
    prepare(navy, GBR, 59);
    expect(inv.state).toBe(st("preparing"));
    expect(messages(spy, "ww1936_invasion_ready")).toEqual([]);
    prepare(navy, GBR, 1);
    expect(inv.state).toBe(st("ready"));
    prepare(navy, GBR, 3);
    expect(messages(spy, "ww1936_invasion_ready")).toEqual([
      { region: REGION.rome },
    ]);
    // An army of marines only prepares in half the time.
    const marines = template(g, "GBR", new Array(6).fill("marine"));
    const m = placeArmy(g, "GBR", REGION.london, 2, marines);
    expect(invade(navy, GBR, m, REGION.rome)).toBeNull();
    expect(navy.invasions.get(m.id)!.prepDays).toBe(30);
    // The clock prepares it: one day a day, on the owner's day.
    const ww = g.worldWar()!;
    const day = ww.day(g.ticks());
    while (g.ticks() < dayStartTick(day + 10, ww.prepEndTick())) step(runner);
    expect(navy.invasions.get(m.id)!.prepDone).toBeGreaterThanOrEqual(9);
    expect(navy.invasions.get(m.id)!.prepDone).toBeLessThanOrEqual(10);
  }, 60_000);

  it("launch is refused below 50% supremacy on any route region", async () => {
    const { g, navy } = await atWar();
    const a = placeArmy(g, "GBR", REGION.london, 1);
    expect(invade(navy, GBR, a, REGION.rome)).toBeNull();
    expect(launchInvasion(navy, a.id, g.ticks())).toBe("invasion_not_ready");
    prepare(navy, GBR, 60);
    const gbr = sideOf(navy, GBR);
    const ita = sideOf(navy, ITA);
    // London → Rome: zones [40001, 40002], sea regions 1001 and 1002.
    // A British patrol holds 1001; nobody holds 1002 (each region's last value).
    navy.setSupremacy(SR.approaches, new Map([[gbr, 1000]]));
    expect(launchInvasion(navy, a.id, g.ticks())).toBe("naval_supremacy_low");
    navy.setSupremacy(
      SR.central,
      new Map([
        [gbr, 499],
        [ita, 501],
      ]),
    );
    expect(invasionLaunchBlock(navy, a.id)).toBe("naval_supremacy_low");
    // A British patrol in 1002 too: the launch is taken.
    navy.setSupremacy(SR.central, new Map([[gbr, 1000]]));
    expect(invasionLaunchBlock(navy, a.id)).toBeNull();
    // Idle convoys: the army needs its weight × 2, Britain has 35.
    const ce = navy.econ.country(GBR)!;
    const need = divisionConvoys(
      divisionWeightCenti(navy.land, a.divisions[0]),
    );
    expect(freeConvoysOf(navy, GBR)).toBe(35);
    ce.stock[equipKey("convoy", 1)] = need - 1;
    expect(invasionLaunchBlock(navy, a.id)).toBe("no_convoys");
    ce.stock[equipKey("convoy", 1)] = 35;
    expect(invasionLaunchBlock(navy, a.id)).toBeNull();
  });

  it("a voyage aborts when supremacy drops below 40%", async () => {
    const { g, navy, l } = await atWar();
    const spy = vi.spyOn(g, "displayMessage");
    const a = ready(navy, g, "GBR", REGION.london, REGION.rome, 2);
    const v = sail(navy, a.id, 1); // in 40002, sea region 1002
    const gbr = sideOf(navy, GBR);
    const ita = sideOf(navy, ITA);
    const day = navy.day(g.ticks());
    // 45%: under the 50% of an escort-free crossing (lane C's interception), not under 40%.
    navy.setSupremacy(
      SR.central,
      new Map([
        [gbr, 450],
        [ita, 550],
      ]),
    );
    dailyInvasions(navy, GBR, day, g.ticks());
    expect([v.aborting, navy.invasions.get(a.id)!.state]).toEqual([
      false,
      st("sailing"),
    ]);
    // An Italian fleet in 1002: Britain's supremacy there falls to 30%.
    navy.setSupremacy(
      SR.central,
      new Map([
        [gbr, 300],
        [ita, 700],
      ]),
    );
    dailyInvasions(navy, GBR, day, g.ticks());
    expect(v.aborting).toBe(true);
    expect(v.to).toBe(REGION.london);
    expect(navy.routes.get(v.route)!.zones).toEqual([ZONE.middle, ZONE.west]);
    expect(navy.routes.get(v.route)!.srs).toEqual([SR.central, SR.approaches]);
    expect(v.zoneIdx).toBe(0);
    expect(navy.invasions.get(a.id)!.state).toBe(st("returning"));
    expect(messages(spy, "ww1936_invasion_aborted")).toEqual([
      { region: REGION.rome },
    ]);
    // Back in London (lane C's arrival): a sea move's landing, the convoys free.
    landInvasion(navy, v.id, g.ticks());
    for (const id of a.divisions) {
      const r = l.divisions.rowOf(id);
      expect([l.divisions.region[r], l.divisions.mode[r]]).toEqual([
        REGION.london,
        MOVE_NONE,
      ]);
    }
    expect(navy.invasions.has(a.id)).toBe(false);
    expect(navy.voyages.has(v.id)).toBe(false);
    expect(freeConvoysOf(navy, GBR)).toBe(35);
    expect(l.controller[REGION.rome]).toBe(ITA);
  });

  it("landing on an empty region takes it and the victory-point tile in the same tick", async () => {
    const { g, navy, l } = await atWar();
    const spy = vi.spyOn(g, "displayMessage");
    const a = ready(navy, g, "GBR", REGION.london, REGION.rome, 2);
    const v = sail(navy, a.id, 1);
    expect(freeConvoysOf(navy, GBR)).toBe(35 - v.bound);
    expect(vpOwner(g, REGION.rome)).toBe(ITA);
    landInvasion(navy, v.id, g.ticks());
    expect(l.controller[REGION.rome]).toBe(GBR);
    expect(vpOwner(g, REGION.rome)).toBe(GBR);
    for (const id of a.divisions) {
      const r = l.divisions.rowOf(id);
      expect(l.divisions.region[r]).toBe(REGION.rome);
      expect(l.divisions.org[r]).toBe(Math.floor((l.orgMaxOf(r) * 70) / 100));
    }
    expect(navy.invasions.has(a.id)).toBe(false);
    expect(freeConvoysOf(navy, GBR)).toBe(35);
    expect(l.armies.get(a.id)!.order.kind).toBe("idle");
    expect(messages(spy, "ww1936_invasion_landed")).toEqual([
      { region: REGION.rome },
      { region: REGION.rome },
    ]);
    // Rome has a naval base (3): lane C's sea hub, no beachhead.
    expect(beachheads(navy).has(REGION.rome)).toBe(false);
  });

  it("the victory-point tile follows control after a landing", async () => {
    const { runner, g, navy, l } = await atWar();
    const it = placeArmy(g, "ITA", REGION.rome, 1);
    const a = ready(navy, g, "GBR", REGION.london, REGION.rome, 3);
    const v = sail(navy, a.id, 1);
    // A broken Italian division holds Rome.
    const ir = l.divisions.rowOf(it.divisions[0]);
    l.divisions.org[ir] = 1;
    landInvasion(navy, v.id, g.ticks());
    const inv = navy.invasions.get(a.id)!;
    expect(inv.state).toBe(st("landing"));
    expect(l.battles.has(REGION.rome)).toBe(true);
    for (const id of a.divisions) {
      const r = l.divisions.rowOf(id);
      expect([l.divisions.battle[r], l.divisions.role[r]]).toEqual([
        REGION.rome,
        ROLE_ATTACK,
      ]);
      expect(navy.landing.has(id)).toBe(true);
    }
    let won = -1;
    for (let i = 0; i < 120; i++) {
      step(runner);
      expect(vpOwner(g, REGION.rome)).toBe(l.controller[REGION.rome]);
      if (won < 0 && l.controller[REGION.rome] === GBR) won = i;
      if (won >= 0 && i > won + 30) break;
    }
    expect(won).toBeGreaterThanOrEqual(0);
    expect(l.controller[REGION.rome]).toBe(GBR);
    // The owner's day closed the landing: the marks are gone.
    expect(navy.invasions.has(a.id)).toBe(false);
    for (const id of a.divisions) expect(navy.landing.has(id)).toBe(false);
  }, 60_000);

  it("a defended landing fights at −70% (marines −35%, a coastal fort −15% a level)", async () => {
    const { g, navy, l } = await atWar();
    placeArmy(g, "ITA", REGION.rome, 4);
    // No engineers: they would take a quarter off the fort's cut.
    const infantry = template(g, "GBR", new Array(9).fill("infantry"));
    const marines = template(g, "GBR", new Array(6).fill("marine"));
    const inf = ready(navy, g, "GBR", REGION.london, REGION.rome, 1, infantry);
    const mar = ready(navy, g, "GBR", REGION.london, REGION.rome, 1, marines);
    const econ = navy.econ;
    econ.buildingArray("coastal_fort")[REGION.rome] = 1;
    econ.afterBuildingChange(REGION.rome, "coastal_fort");
    landInvasion(navy, sail(navy, inf.id, 1).id, g.ticks());
    landInvasion(navy, sail(navy, mar.id, 1).id, g.ticks());
    const b = l.battles.get(REGION.rome)!;
    const line = (a: Army) => {
      const r = l.divisions.rowOf(a.divisions[0]);
      const lines = battleMods(l, b, r).attackLines;
      return Object.fromEntries(
        lines
          .filter((x) => x.id === "landing" || x.id === "coastal_fort")
          .map((x) => [x.id, x.bp]),
      );
    };
    expect(line(inf)).toEqual({ landing: -7000, coastal_fort: -1500 });
    expect(line(mar)).toEqual({ landing: -3500, coastal_fort: -1500 });
    // Only a landing division attacking where it landed has the line.
    const r = l.divisions.rowOf(inf.divisions[0]);
    expect(amphibiousModsFor(navy, REGION.krakow, r)).toBeNull();
    // A landing battle that outlasts the mark's 30 days keeps it.
    const until = navy.landing.get(inf.divisions[0])!;
    dailyInvasions(navy, GBR, navy.day(g.ticks()), until + 1);
    expect(navy.landing.get(inf.divisions[0])).toBe(until);
    expect(amphibiousModsFor(navy, REGION.rome, r)?.attackBp).toBe(-7000);
    // Out of its battle, an expired mark goes.
    leaveBattle(l, l.divisions.rowOf(mar.divisions[0]));
    l.moveToArmy(mar.divisions[0], l.newArmy(GBR)!);
    dailyInvasions(navy, GBR, navy.day(g.ticks()), until + 1);
    expect(navy.landing.has(mar.divisions[0])).toBe(false);
    expect(navy.landing.has(inf.divisions[0])).toBe(true);
    navy.landing.delete(inf.divisions[0]);
    expect(amphibiousModsFor(navy, REGION.rome, r)).toBeNull();
  });

  it("no shore bombardment on a no-strike region (Korea, Taiwan)", () => {
    const dir = path.join(__dirname, "../../resources/maps/world1936");
    const world = ScenarioIndex.fromFiles(
      JSON.parse(
        fs.readFileSync(path.join(dir, "scenario.json"), "utf8"),
      ) as ReadonlyScenarioData,
      new Uint8Array(fs.readFileSync(path.join(dir, "regions.bin"))),
    );
    // A navy with only the scenario: the refusal comes before anything else is read.
    const navy = { scenario: world } as unknown as WwNavy;
    expect(noStrikeRegions(world).size).toBe(12);
    for (const r of noStrikeRegions(world)) {
      expect(shoreBombardAt(navy, r, 1)).toBe(0);
    }
  });

  it("shore bombardment cuts the defense", async () => {
    const { runner, g, navy, l } = await atWar();
    const it = placeArmy(g, "ITA", REGION.rome, 2);
    const a = ready(navy, g, "GBR", REGION.london, REGION.rome, 1);
    landInvasion(navy, sail(navy, a.id, 1).id, g.ticks());
    const lines = (id: number) =>
      battleMods(l, l.battles.get(REGION.rome)!, l.divisions.rowOf(id))
        .defenseLines;
    const shore = () =>
      lines(it.divisions[0]).find((x) => x.id === "shore_bombard")?.bp ?? 0;
    expect(shore()).toBe(0);
    // Four British battleships off Rome (40002, sea region 1002) on invasion support.
    const fid = navy.createFleet(GBR, REGION.london, [["bb", 1, 4]]);
    const f = navy.fleets.get(fid)!;
    f.docked = 0;
    navy.setFleetZone(f, ZONE.middle);
    f.mission = FLEET_MISSIONS.indexOf("invasion_support");
    f.missionSr = SR.central;
    f.state = FLEET_STATES.indexOf("on_station");
    const s = navy.statsFor(GBR, "bb", 1);
    const want = shoreBombardBp(
      4 * (s.heavy + Math.floor(s.light / 2)),
      navy.econ.country(GBR)!.stats,
    );
    expect(want).toBe(-2200);
    // The next round sees them (the cut is read once a tick: fleets move in
    // the navy's turn, after the land war's).
    step(runner);
    expect(l.battles.has(REGION.rome)).toBe(true);
    expect(shore()).toBe(-2200);
    // The attacker's own divisions get no such line.
    expect(lines(a.divisions[0]).some((x) => x.id === "shore_bombard")).toBe(
      false,
    );
  });

  it("a failed landing returns to port with 20% more losses", async () => {
    const { runner, g, navy, l } = await atWar();
    const spy = vi.spyOn(g, "displayMessage");
    placeArmy(g, "ITA", REGION.rome, 6);
    const a = ready(navy, g, "GBR", REGION.london, REGION.rome, 1);
    landInvasion(navy, sail(navy, a.id, 1).id, g.ticks());
    const id = a.divisions[0];
    const r = l.divisions.rowOf(id);
    // The battle takes the division's last org: it drops out of the attack.
    leaveBattle(l, r);
    l.divisions.org[r] = 0;
    const men = l.divisions.men[r];
    dailyInvasions(navy, GBR, navy.day(g.ticks()), g.ticks());
    const lost = men - l.divisions.men[l.divisions.rowOf(id)];
    expect(Math.abs(lost - men / 5)).toBeLessThanOrEqual(1);
    expect(navy.landing.has(id)).toBe(false);
    expect(messages(spy, "ww1936_invasion_failed")).toEqual([
      { region: REGION.rome },
      { region: REGION.rome },
    ]);
    expect(l.controller[REGION.rome]).toBe(ITA);
    // At sea with no org (lane C's voyage, or the landing's own convoys).
    const sea = l.divisions.rowOf(id);
    expect([l.divisions.mode[sea], l.divisions.org[sea]]).toEqual([
      MOVE_SEA,
      0,
    ]);
    expect(navy.invasions.get(a.id)!.state).toBe(st("returning"));
    // Home to London after the trip.
    for (let i = 0; i < 300; i++) {
      const row = l.divisions.rowOf(id);
      if (
        l.divisions.region[row] === REGION.london &&
        l.divisions.mode[row] === MOVE_NONE &&
        !navy.invasions.has(a.id)
      ) {
        break;
      }
      step(runner);
    }
    const row = l.divisions.rowOf(id);
    expect(row).toBeGreaterThanOrEqual(0);
    expect(l.divisions.region[row]).toBe(REGION.london);
    expect(l.divisions.mode[row]).toBe(MOVE_NONE);
    expect(navy.invasions.has(a.id)).toBe(false);
  }, 60_000);

  it("a landing the battle beats back goes home", async () => {
    const { runner, g, navy, l } = await atWar();
    const spy = vi.spyOn(g, "displayMessage");
    placeArmy(g, "ITA", REGION.rome, 6);
    const a = ready(navy, g, "GBR", REGION.london, REGION.rome, 1);
    landInvasion(navy, sail(navy, a.id, 1).id, g.ticks());
    const id = a.divisions[0];
    const men = l.divisions.men[l.divisions.rowOf(id)];
    for (let i = 0; i < 400 && navy.invasions.has(a.id); i++) step(runner);
    for (let i = 0; i < 300; i++) {
      const row = l.divisions.rowOf(id);
      if (row < 0 || l.divisions.region[row] === REGION.london) break;
      step(runner);
    }
    const row = l.divisions.rowOf(id);
    expect(row).toBeGreaterThanOrEqual(0);
    expect(l.divisions.region[row]).toBe(REGION.london);
    expect(l.divisions.men[row]).toBeLessThan(men);
    expect(l.controller[REGION.rome]).toBe(ITA);
    expect(messages(spy, "ww1936_invasion_failed")).toHaveLength(2);
  }, 60_000);

  it("a port taken becomes a sea hub; else a 30-day beachhead", async () => {
    const { g, navy, l } = await atWar(["SUN", "POL"]);
    expect(l.isEnemy(GBR, TAG_ID.SUN)).toBe(true);
    expect(l.isEnemy(GBR, TAG_ID.POL)).toBe(true);
    const side = sideOf(navy, GBR);
    // Krakow has no naval base: a beachhead for 30 days.
    const c = ready(navy, g, "GBR", REGION.london, REGION.krakow, 1);
    landInvasion(navy, sail(navy, c.id, 1).id, g.ticks());
    expect(l.controller[REGION.krakow]).toBe(GBR);
    const day = navy.day(g.ticks());
    expect(beachheads(navy).get(REGION.krakow)).toEqual({
      side,
      until: day + WW_BEACHHEAD_DAYS,
    });
    // Its supply hub: 6 a day at most, carried by lane C's supply route.
    expect(beachheadCapacityMilli(navy, REGION.krakow, side)).toBe(0);
    const route = navy.nextRouteId++;
    navy.routes.set(route, {
      id: route,
      use: CONVOY_USES.indexOf("supply"),
      owner: GBR,
      ref: REGION.krakow,
      zones: [ZONE.west, ZONE.middle],
      km: 300,
      srs: [SR.approaches, SR.central],
      need: 4,
      got: 4,
      nextDay: 0,
    });
    // min(6, 4 × 500 / 300 = 6.67) = 6.
    expect(beachheadCapacityMilli(navy, REGION.krakow, side)).toBe(6000);
    navy.routes.get(route)!.got = 3; // 3 × 500 / 300 = 5
    expect(beachheadCapacityMilli(navy, REGION.krakow, side)).toBe(5000);
    // Poland holds 60% of 1002: the route carries 70%.
    navy.setSupremacy(
      SR.central,
      new Map([
        [side, 400],
        [sideOf(navy, TAG_ID.POL), 600],
      ]),
    );
    expect(beachheadCapacityMilli(navy, REGION.krakow, side)).toBe(3500);
    expect(beachheadCapacityMilli(navy, REGION.krakow, sideOf(navy, ITA))).toBe(
      0,
    );
    // The 30 days end it.
    dailyInvasions(navy, GBR, day + WW_BEACHHEAD_DAYS, g.ticks());
    expect(beachheads(navy).has(REGION.krakow)).toBe(true);
    dailyInvasions(navy, GBR, day + WW_BEACHHEAD_DAYS + 1, g.ticks());
    expect(beachheads(navy).has(REGION.krakow)).toBe(false);
    // Kiev has a naval base of 2: a port taken is lane C's sea hub.
    const k = ready(navy, g, "GBR", REGION.london, REGION.kiev, 1);
    landInvasion(navy, sail(navy, k.id).id, g.ticks());
    expect(l.controller[REGION.kiev]).toBe(GBR);
    expect(beachheads(navy).has(REGION.kiev)).toBe(false);
  }, 60_000);

  it("a port taken next door ends the coastal supply", async () => {
    const { g, navy, l } = await atWar(["SUN", "POL"]);
    const c = ready(navy, g, "GBR", REGION.london, REGION.krakow, 1);
    landInvasion(navy, sail(navy, c.id, 1).id, g.ticks());
    const day = navy.day(g.ticks());
    dailyInvasions(navy, GBR, day, g.ticks());
    expect(beachheads(navy).has(REGION.krakow)).toBe(true);
    // Kiev (a port) next to Krakow: supply comes from there over land.
    const k = ready(navy, g, "GBR", REGION.london, REGION.kiev, 1);
    landInvasion(navy, sail(navy, k.id).id, g.ticks());
    expect(l.controller[REGION.kiev]).toBe(GBR);
    dailyInvasions(navy, GBR, day, g.ticks());
    expect(beachheads(navy).has(REGION.krakow)).toBe(false);
  }, 60_000);

  it("a port of naval base 5 or more taken is news to both sides", async () => {
    const { g, navy, l } = await atWar();
    const spy = vi.spyOn(g, "displayMessage");
    const a = ready(navy, g, "ITA", REGION.rome, REGION.london, 1);
    landInvasion(navy, sail(navy, a.id, 1).id, g.ticks());
    expect(l.controller[REGION.london]).toBe(ITA);
    expect(messages(spy, "ww1936_port_captured")).toEqual([
      { region: REGION.london },
      { region: REGION.london },
    ]);
  });

  it("the hash sees invasion targets and voyages, beachheads and landing marks", async () => {
    const { g, navy } = await atWar();
    const a = placeArmy(g, "GBR", REGION.london, 1);
    expect(invade(navy, GBR, a, REGION.rome)).toBeNull();
    const inv = navy.invasions.get(a.id)!;
    const h0 = navy.hash();
    inv.voyage = 5;
    const h1 = navy.hash();
    inv.target = REGION.malta;
    const h2 = navy.hash();
    navy.beachhead.set(REGION.krakow, { side: 3, until: 40 });
    const h3 = navy.hash();
    navy.landing.set(a.divisions[0], 900);
    const h4 = navy.hash();
    expect(new Set([h0, h1, h2, h3, h4]).size).toBe(5);
  });

  it("a game restored mid-preparation and mid-landing goes on the same", async () => {
    const { runner, g, navy } = await atWar();
    placeArmy(g, "ITA", REGION.rome, 2);
    const a = ready(navy, g, "GBR", REGION.london, REGION.rome, 2);
    landInvasion(navy, sail(navy, a.id, 1).id, g.ticks());
    const p = placeArmy(g, "GBR", REGION.london, 1);
    expect(invade(navy, GBR, p, REGION.rome)).toBeNull();
    expect(navy.landing.size).toBe(2);
    const b = await wwRestore(runner, GBR_ITA, SEA.map);
    const nb = b.game.worldWar()!.navy;
    expect(nb.invasions.get(a.id)!.state).toBe(st("landing"));
    expect(nb.invasions.get(p.id)!.state).toBe(st("preparing"));
    expect([...nb.landing]).toEqual([...navy.landing]);
    for (let i = 0; i < 40; i++) {
      step(runner);
      step(b);
      expect(gameHash(b)).toBe(gameHash(runner));
    }
    expect(
      diffSnapshots(snapshotGame(runner.game), snapshotGame(b.game)),
    ).toEqual([]);
  }, 120_000);
});
