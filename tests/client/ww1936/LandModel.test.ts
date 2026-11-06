// World War 1936 P2 (spec §15): the land screens' model — rows, the army
// card's state lines and greyed buttons, the previews, the designer's
// numbers, the battle card's and the region card's lines — on the test
// map with a fake land view.
import type { LandOrder } from "@openfront/engine-api/Schemas";
import {
  WW_TECH_IDS,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  ARMY_BATTLE,
  ARMY_ENCIRCLED,
  ARMY_MOVING,
  ARMY_RAIL,
  idleOrder,
  ROLE_ATTACK,
  TemplateDef,
} from "@openfront/engine-api/ww1936/LandTypes";
import { predictBattle } from "@openfront/engine-lib/ww1936/CombatRules";
import { titledGeneralId } from "@openfront/engine-lib/ww1936/Generals";
import { landOrderBlockOf } from "@openfront/engine-lib/ww1936/LandOrderChecks";
import { startTemplates } from "@openfront/engine-lib/ww1936/LandStart";
import {
  GEN1,
  templateStats,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import { weatherAt } from "@openfront/engine-lib/ww1936/Weather";
import { techTotals } from "@openfront/engine-lib/ww1936/WwTechs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, string | number>) =>
    params
      ? `[${key}] ${Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")}`
      : `[${key}]`,
}));

// The order checks are Task 3's: watch what the card asks them.
vi.mock("@openfront/engine-lib/ww1936/LandOrderChecks", async (orig) => {
  const real =
    await orig<typeof import("@openfront/engine-lib/ww1936/LandOrderChecks")>();
  return { ...real, landOrderBlockOf: vi.fn(real.landOrderBlockOf) };
});

import {
  armyCard,
  armyName,
  armyRows,
  attackPreview,
  autoLevelOf,
  battleCard,
  battleLuck,
  defendAnchor,
  designer,
  enemySideAt,
  generalRows,
  groupZone,
  groupZoneOf,
  landSidesOf,
  levelBoxes,
  levelDots,
  movePreview,
  oddsBadges,
  oddsLevel,
  planOrder,
  regionLandLines,
  rowGeneralName,
  shortTypes,
  tacticCountered,
  tapKind,
  tapOrder,
  toggleTarget,
  toggleZone,
  waitingForOdds,
  zoneOrder,
  zoneShown,
} from "../../../src/client/hud/ww1936/LandModel";
import { detail, region } from "./EconomyFixture";
import {
  army,
  battle,
  division,
  fakeLandGame,
  general,
  ID,
  landDetail,
  LandOptions,
  landRegion,
  mine,
  sideOf,
  startTemplate,
  training,
} from "./LandFixture";

const checks = vi.mocked(landOrderBlockOf);
const real = (
  await vi.importActual<
    typeof import("@openfront/engine-lib/ww1936/LandOrderChecks")
  >("@openfront/engine-lib/ww1936/LandOrderChecks")
).landOrderBlockOf;
const DEU = ID("DEU");
/** A summer day: clear weather in Berlin, Munich, Warsaw and Krakow (a pure roll). */
const DAY = 170;
/** After the preparation minute: a war can be fought. */
const AT_WAR: LandOptions = { ticks: 700, wars: [["DEU", "POL"]] };

function game(o: LandOptions = {}) {
  return fakeLandGame({
    details: [detail("DEU")],
    landDetails: [landDetail("DEU")],
    ...o,
  });
}

describe("LandModel (spec §15)", () => {
  beforeEach(() => {
    checks.mockReset();
    checks.mockImplementation(real);
  });

  it("names armies in order and lists my armies with their generals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 111].map(armyName)).toEqual([
      "[ww1936.land.army_name_1] n=1",
      "[ww1936.land.army_name_2] n=2",
      "[ww1936.land.army_name_3] n=3",
      "[ww1936.land.army_name_n] n=4",
      "[ww1936.land.army_name_n] n=11",
      "[ww1936.land.army_name_n] n=12",
      "[ww1936.land.army_name_n] n=13",
      "[ww1936.land.army_name_1] n=21",
      "[ww1936.land.army_name_2] n=22",
      "[ww1936.land.army_name_3] n=23",
      "[ww1936.land.army_name_n] n=111",
    ]);
    const titled = titledGeneralId(DEU, 3);
    const { land } = game({
      armies: [
        army(2, "DEU", 4, { general: titled }),
        army(1, "DEU", 3, { general: 1 }),
        army(3, "POL", 6),
      ],
    });
    const rows = armyRows(land, DEU);
    expect(rows.map((r) => r.id)).toEqual([1, 2]);
    expect(rows[0].generalKey).toBe("rundstedt");
    expect(rowGeneralName(rows[0])).toBe("[ww1936.general.rundstedt]");
    expect(rows[1]).toMatchObject({ generalKey: "", titleNo: 3 });
    expect(rowGeneralName(rows[1])).toBe("[ww1936.land.titled_general] n=3");
  });

  it("an idle army of a country whose enemy is across the sea says so, not plain idle", () => {
    // Germany fights the Soviet Union, whose land touches Germany only
    // through Poland (neutral): nothing an army can walk to.
    const far = game({
      ticks: 700,
      wars: [["DEU", "SUN"]],
      armies: [army(1, "DEU", 3)],
    });
    expect(armyCard(far.land, far.view, DEU, 1, DAY)!.status).toEqual({
      key: "ww1936.land.state_idle_noreach",
      params: {},
    });
    // The enemy borders our land: plain idle. Peace: plain idle.
    const near = game({ ...AT_WAR, armies: [army(1, "DEU", 3)] });
    expect(armyCard(near.land, near.view, DEU, 1, DAY)!.status.key).toBe(
      "ww1936.land.state_idle",
    );
    const peace = game({ armies: [army(1, "DEU", 3)] });
    expect(armyCard(peace.land, peace.view, DEU, 1, DAY)!.status.key).toBe(
      "ww1936.land.state_idle",
    );
  });

  it("says what the army does: the most pressing state first", () => {
    const move = { ...idleOrder(), kind: "move" as const, to: 4 };
    const { land, view } = game({
      armies: [
        army(1, "DEU", 3),
        army(2, "DEU", 3, {
          state: ARMY_MOVING,
          mine: mine({ order: move, etaTicks: 23 }),
        }),
        army(3, "DEU", 3, { state: ARMY_RAIL, mine: mine({ etaTicks: 6 }) }),
        army(4, "DEU", 3, { state: ARMY_BATTLE }),
        army(5, "DEU", 3, { state: ARMY_BATTLE | ARMY_ENCIRCLED }),
        army(6, "POL", 6),
      ],
      landDetails: [
        landDetail("DEU", {
          divisions: [
            division(1, 4, 3, { battle: 6 }),
            division(2, 4, 4, { battle: 7 }),
            division(3, 4, 4, { battle: 7 }),
          ],
        }),
      ],
    });
    const status = (id: number) => armyCard(land, view, DEU, id, DAY)!.status;
    expect(status(1)).toEqual({ key: "ww1936.land.state_idle", params: {} });
    expect(status(2)).toEqual({
      key: "ww1936.land.state_moving",
      params: { region: "Munich", days: 3.1 },
    });
    expect(status(3)).toEqual({
      key: "ww1936.land.state_rail",
      params: { days: 0.8 },
    });
    expect(status(4)).toEqual({
      key: "ww1936.land.state_battle",
      params: { n: 2 },
    });
    expect(status(5).key).toBe("ww1936.land.state_encircled");
    // Not mine: no card.
    expect(armyCard(land, view, DEU, 6, DAY)).toBeNull();
  });

  it("greys a button with the order checks' reason (no railway, no port)", () => {
    // Task 3's rule for the two kinds, standing in for the stub.
    checks.mockImplementation((w, o: LandOrder) => {
      if (o.kind === "army_rail" && w.rail(o.region) < 1) return "no_rail";
      if (o.kind === "army_sea" && !w.isPort(o.region)) return "no_port";
      return null;
    });
    const { land, view } = game({
      ...AT_WAR,
      regions: [region(4, { rail: 0 })],
      armies: [army(1, "DEU", 4)],
      landDetails: [
        landDetail("DEU", {
          divisions: [division(1, 1, 4), division(2, 1, 4)],
        }),
      ],
    });
    const card = armyCard(land, view, DEU, 1, DAY)!;
    const block = (id: string) => card.buttons.find((b) => b.id === id)!.block;
    // ww7: the action row [공격] [방어] [이동] [자동], then the rest.
    expect(card.buttons.map((b) => b.id)).toEqual([
      "plan",
      "front",
      "move",
      "auto",
      "rail",
      "sea",
      "split",
      "merge",
      "more",
    ]);
    expect(block("rail")).toBe("no_rail");
    expect(block("sea")).toBe("no_port");
    expect(block("move")).toBeNull();
    // Each button asked the checks with the order it leads to, on the
    // screens' world: Munich (no railway now), at war with Poland. My side
    // has no port to sail to: the sea button is "no port" without asking.
    const asked = checks.mock.calls.map(([, o]) => o);
    expect(asked).toContainEqual({ kind: "army_rail", army: 1, region: 4 });
    expect(asked.some((o) => o.kind === "army_sea")).toBe(false);
    // [방어] asks for the border region around the army: Munich itself
    // (Munich–Warsaw edge); [자동] for a level.
    expect(asked).toContainEqual({
      kind: "army_front",
      army: 1,
      anchor: 4,
      enemy: 0,
    });
    expect(asked).toContainEqual({
      kind: "army_auto_level",
      army: 1,
      level: 2,
    });
    const w = checks.mock.calls[0][0];
    expect([
      w.me,
      w.day,
      w.rail(4),
      w.rail(3),
      w.isPort(2),
      w.isPort(4),
    ]).toEqual([DEU, DAY, 0, 3, true, false]);
    expect(w.isEnemy(DEU, ID("POL"))).toBe(true);
    expect(w.sameSide(DEU, ID("ITA"))).toBe(true);
    expect(w.army(1)).toMatchObject({
      owner: DEU,
      divisions: 3,
      regions: [4],
      fighting: false,
      allPara: false,
      // Task 3's optional fields: the divisions' templates, no front yet.
      templates: [1, 1],
      front: false,
    });
    // At peace: nobody to attack or defend against.
    const peace = game({ armies: [army(1, "DEU", 4)] });
    const buttons = armyCard(peace.land, peace.view, DEU, 1, DAY)!.buttons;
    expect(buttons.find((b) => b.id === "plan")!.block).toBe("not_at_war");
    expect(buttons.find((b) => b.id === "front")!.block).toBe("not_at_war");
  });

  it("the card's searches are reused until the views or the wars move on", () => {
    const g = game({
      ...AT_WAR,
      armies: [army(1, "DEU", 3), army(2, "DEU", 3)],
      landDetails: [
        landDetail("DEU", {
          divisions: [division(1, 1, 3), division(2, 2, 3)],
        }),
      ],
    });
    const merges = () =>
      checks.mock.calls.filter(([, o]) => o.kind === "army_merge").length;
    armyCard(g.land, g.view, DEU, 1, DAY);
    expect(merges()).toBe(1);
    armyCard(g.land, g.view, DEU, 1, DAY);
    expect(merges()).toBe(1);
    // A land update: asked again.
    g.land.apply(
      {
        armies: [],
        removedArmies: [],
        battles: [],
        endedBattles: [],
        regions: [],
        countries: [],
        details: [],
      },
      701,
    );
    armyCard(g.land, g.view, DEU, 1, DAY);
    expect(merges()).toBe(2);
    // One division: its split greyed in its own words.
    const one = game({ armies: [army(3, "DEU", 3, { divisions: 1 })] });
    expect(
      armyCard(one.land, one.view, DEU, 3, DAY)!.buttons.find(
        (b) => b.id === "split",
      )!.block,
    ).toBe("split_single");
  });

  it("Task 3's checks: no railway, no port", () => {
    const { land, view } = game({
      ...AT_WAR,
      regions: [region(4, { rail: 0 })],
      armies: [army(1, "DEU", 4)],
      landDetails: [landDetail("DEU", { divisions: [division(1, 1, 4)] })],
    });
    const card = armyCard(land, view, DEU, 1, DAY)!;
    const block = (id: string) => card.buttons.find((b) => b.id === id)!.block;
    expect(block("rail")).toBe("no_rail");
    expect(block("sea")).toBe("no_port");
  });

  it("ww8: the attack preview counts the wings over a battle already there", () => {
    const pol = army(5, "POL", 6, { divisions: 2 });
    const odds = (cas: Parameters<typeof battle>[3]) => {
      const { land, view } = game({
        ...AT_WAR,
        battles: [battle(6, "DEU", "POL", cas)],
        armies: [army(1, "DEU", 3), pol],
        landDetails: [
          landDetail("DEU", {
            divisions: [division(1, 1, 3), division(2, 1, 3)],
          }),
        ],
      });
      return attackPreview(land, view, DEU, 1, 6, DAY)!.ratioPm;
    };
    const none = odds({});
    expect(odds({ casAttCenti: 800 })).toBeGreaterThan(none);
    expect(odds({ casDefCenti: 800 })).toBeLessThan(none);
  });

  it("previews an attack with predictBattle on both sides' sums", () => {
    const pol = army(5, "POL", 6, { divisions: 2 });
    const { land, view } = game({
      ...AT_WAR,
      armies: [army(1, "DEU", 3), pol],
      landDetails: [
        landDetail("DEU", {
          divisions: [division(1, 1, 3), division(2, 1, 3), division(3, 1, 3)],
        }),
      ],
    });
    const p = attackPreview(land, view, DEU, 1, 6, DAY)!;
    // Berlin into Warsaw: one direction, plains, no river or fort, clear.
    expect(p).toMatchObject({
      land: "plains",
      river: 0,
      strait: false,
      fort: 0,
      directions: 1,
    });
    // Neither the German line nor Poland's division has a modifier here.
    const want = predictBattle(land.armies.get(1)!.sum, pol.sum, {
      land: "plains",
      directions: 1,
      attackerAttackBp: 10_000,
      attackerBlockBp: 10_000,
      defenderAttackBp: 10_000,
      defenderBlockBp: 10_000,
    });
    expect(p.ratioPm).toBe(want.ratioPm);
    expect(p.days).toBe(want.days);
    // No Polish army seen there: the region's count × Poland's first template.
    const counted = game({
      ...AT_WAR,
      armies: [army(1, "DEU", 3)],
      landRegions: [landRegion(6, { counts: [[ID("POL"), 2]] })],
    });
    expect(enemySideAt(counted.land, counted.view, DEU, 6)).toEqual(
      sideOf(startTemplate("POL"), 2),
    );
  });

  it("previews a move over my side's regions", () => {
    const { land, view } = game({
      armies: [army(1, "DEU", 3), army(2, "DEU", 2)],
      landDetails: [
        landDetail("DEU", {
          divisions: [division(1, 1, 3), division(2, 2, 2)],
        }),
      ],
    });
    // Berlin → Munich: 140 km = 140,000; infantry 4 km/h at infrastructure 5
    // (+20%): 8,779 a tick → 16 ticks.
    expect(movePreview(land, view, DEU, 1, 4, "move", DAY)).toEqual({
      path: [3, 4],
      ticks: 16,
    });
    // London only through France: no way on my side.
    expect(movePreview(land, view, DEU, 1, 10, "move", DAY)).toBeNull();
    // By rail: 50 km/h, no terrain: 2 ticks.
    expect(movePreview(land, view, DEU, 1, 4, "rail", DAY)).toEqual({
      path: [3, 4],
      ticks: 2,
    });
    // Lyon → London by sea: 156 km, 45 ticks (spec §7.5).
    expect(movePreview(land, view, DEU, 2, 10, "sea", DAY)).toEqual({
      path: [2, 10],
      ticks: 45,
    });
    // In snow the same walk takes as long (ww84; Munich's winter is
    // temperate since Task 11: snow, rain or clear by the week).
    const snow = Array.from({ length: 400 }, (_, d) => d).find(
      (d) =>
        weatherAt(
          d,
          view.scenario.latC(4),
          "forest",
          view.scenario.wcell(4),
        ) === "snow",
    )!;
    expect(movePreview(land, view, DEU, 1, 4, "move", snow)!.ticks).toBe(16);
  });

  it("the designer's numbers are templateStats' and a change costs nothing", () => {
    const before = startTemplates("DEU", 5)[0].def;
    const after: TemplateDef = {
      name: "Heavy",
      battalions: [...before.battalions.slice(1), "artillery"],
      support: before.support,
    };
    const all = new Set<WwTechId>(WW_TECH_IDS);
    const tech = techTotals(all);
    const d = designer(after, tech, all);
    expect(d.stats).toEqual(templateStats(after, tech, GEN1));
    expect(d.block).toBeNull();
    // Infantry equipment: 900 (8 battalions + support), 1 factory makes 4.5
    // units a day of a 500-milli unit → 100 days.
    expect(d.factoryDays[0]).toBe(Math.ceil((d.stats.need[0] * 500) / 4_500));
    // A battalion without its tech.
    const noTanks = new Set(
      WW_TECH_IDS.filter((t) => t !== "medium_tank_1"),
    ) as Set<WwTechId>;
    expect(
      designer(
        { name: "T", battalions: ["medium_armor"], support: [] },
        tech,
        noTanks,
      ).block,
    ).toBe("no_tech");
  });

  it("the battle card shows my division's lines on its side", () => {
    // Germany attacks Krakow (hills) from Munich.
    const b = battle(7, "DEU", "POL", { width: 80, attWidth: 48 });
    const { land, view } = game({
      ...AT_WAR,
      battles: [b],
      armies: [army(1, "DEU", 4, { general: 1 })],
      landDetails: [
        landDetail("DEU", {
          generals: [general(1, { att: 4, def: 4 })],
          divisions: [
            division(1, 1, 4, { battle: 7, role: ROLE_ATTACK, exp: 300 }),
          ],
        }),
      ],
    });
    const c = battleCard(land, view, DEU, 7, DAY)!;
    expect(c).toMatchObject({
      mine: true,
      leaveArmies: [1],
    });
    expect(c.attackLines).toEqual([
      { id: "general", bp: 2_000 },
      { id: "exp", bp: 500 },
    ]);
    // Not in it: a plain division's lines (none).
    const other = game({ ...AT_WAR, battles: [b] });
    const o = battleCard(other.land, other.view, DEU, 7, DAY)!;
    expect(o.attackLines).toEqual([]);
    expect(o.mine).toBe(false);
    expect(battleCard(other.land, other.view, DEU, 6, DAY)).toBeNull();
  });

  it("the battle card names the barrage, tank fear and what the defenders are", () => {
    const b = battle(7, "DEU", "POL", {
      fireBp: 2222,
      fearPct: 30,
      defOrgPct: 82,
    });
    const { land, view } = game({ ...AT_WAR, battles: [b] });
    const c = battleCard(land, view, DEU, 7, DAY)!;
    expect(c.attackLines).toEqual([{ id: "barrage", bp: 2222 }]);
    expect(c.defenseLines).toEqual([
      { id: "foot_line", bp: 1800 },
      { id: "tank_fear", bp: -3000 },
    ]);
    const bare = battle(7, "DEU", "POL", { defOrgPct: 125 });
    const on = game({ ...AT_WAR, battles: [bare] });
    expect(battleCard(on.land, on.view, DEU, 7, DAY)!.defenseLines).toEqual([
      { id: "bare_armor", bp: -2500 },
    ]);
  });

  it("the battle card names what engineers and recon take off the prepared ground", () => {
    const b = battle(7, "DEU", "POL", {
      engineerCutPm: 300,
      reconCutPm: 50,
    });
    const { land, view } = game({ ...AT_WAR, battles: [b] });
    expect(battleCard(land, view, DEU, 7, DAY)!.defenseLines).toEqual([
      { id: "engineer", bp: -3000 },
      { id: "recon_position", bp: -500 },
    ]);
  });

  it("the region card's land lines", () => {
    const { land, view } = game({
      regions: [region(7, { fort: 2 }), region(3, { fort: 0 })],
      landRegions: [
        landRegion(7, {
          counts: [
            [ID("POL"), 8],
            [DEU, 2],
          ],
        }),
        landRegion(3, { supplyMilli: 34_000, useMilli: 12_000 }),
      ],
    });
    // Krakow: hills, no railway, the big river to Kiev; Poland's, not mine.
    expect(regionLandLines(land, view, DEU, 7, DAY)).toEqual({
      land: "hills",
      weather: weatherAt(
        DAY,
        view.scenario.latC(7),
        "hills",
        view.scenario.wcell(7),
      ),
      fort: 2,
      rail: 0,
      supplyMilli: -1,
      useMilli: -1,
      riverEdges: 1,
      ours: 2,
      theirs: 8,
      encircled: false,
    });
    // Berlin: my supply there.
    expect(regionLandLines(land, view, DEU, 3, DAY)).toMatchObject({
      rail: 3,
      supplyMilli: 34_000,
      useMilli: 12_000,
    });
    expect(levelBoxes(3)).toBe("■■■□□");
    expect(levelDots(2)).toBe("●●○○○");
  });

  it("a bombed fort counts as the engine counts it (P4 plan decision 13)", () => {
    const damage = new Array<number>(14).fill(0);
    damage[4] = 1500; // BUILDING_IDS[4] = "fort": one of two stopped
    const { land, view } = game({
      regions: [region(7, { fort: 2, damage })],
      landRegions: [landRegion(7)],
    });
    expect(view.effectiveBuildings("fort", 7)).toBe(1);
    expect(regionLandLines(land, view, DEU, 7, DAY).fort).toBe(1);
  });

  it("what a tap means: my side moves, an enemy is attacked, elsewhere cancels", () => {
    const atWar = game(AT_WAR);
    const kind = (mode: Parameters<typeof tapKind>[2], r: number) =>
      tapKind(atWar.land, DEU, mode, r);
    expect(kind("none", 4)).toBe("move");
    // Italy: the same faction, my side.
    expect(kind("none", 5)).toBe("move");
    expect(kind("none", 6)).toBe("direct");
    expect(kind("none", 10)).toBeNull();
    expect(kind("move", 6)).toBeNull();
    expect(kind("plan", 7)).toBe("direct");
    expect(kind("attack", 7)).toBe("direct");
    expect(tapOrder("direct", 1, 7)).toBeNull();
    expect(kind("plan", 3)).toBeNull();
    // ww7: [방어] — a border region of ours joins or leaves the zone;
    // an inner or an enemy region does nothing (the mode stays).
    expect(kind("front", 3)).toBe("zone");
    expect(kind("front", 4)).toBe("zone");
    // Rome (Italy, our side) touches Krakow: a border region too.
    expect(kind("front", 5)).toBe("zone");
    expect(kind("front", 6)).toBeNull();
    expect(kind("front", 10)).toBeNull();
    expect(tapOrder("zone", 1, 3)).toBeNull();
    expect(kind("none", 0)).toBeNull();
    // The preparation minute: nobody to fight yet.
    const prep = game({ ticks: 100, wars: [["DEU", "POL"]] });
    expect(tapKind(prep.land, DEU, "none", 6)).toBeNull();
    // Plan targets: add, drop, at most three.
    expect(toggleTarget([6, 7], 8)).toEqual([6, 7, 8]);
    expect(toggleTarget([6, 7, 8], 9)).toEqual([6, 7, 8]);
    expect(toggleTarget([6, 7, 8], 7)).toEqual([6, 8]);
  });

  it("ww7: [방어] anchors at the border region nearest the army", () => {
    const g = game({
      ...AT_WAR,
      armies: [army(1, "DEU", 5, { divisions: 6 })],
    });
    // Berlin, Munich and Rome (Italy, ours) face Poland: a border region
    // anchors itself; elsewhere the nearest one over the land graph, the
    // smallest id of the nearest layer.
    expect(defendAnchor(g.land, DEU, 3)).toBe(3);
    expect(defendAnchor(g.land, DEU, 5)).toBe(5);
    expect([3, 4, 5]).toContain(defendAnchor(g.land, DEU, 1));
    // Nobody at war: no border, no anchor.
    const peace = game({ armies: [army(1, "DEU", 5)] });
    expect(defendAnchor(peace.land, DEU, 5)).toBeNull();
  });

  it("ww7: the zone toggles in and out, the shown zone is the draft or the engine's", () => {
    expect(toggleZone([3], 4)).toEqual([3, 4]);
    expect(toggleZone([3, 4], 3)).toEqual([4]);
    expect(toggleZone([4], 4)).toEqual([]);
    expect(
      toggleZone(
        Array.from({ length: 60 }, (_, i) => i + 1),
        99,
      ),
    ).toHaveLength(60);
    const { land } = game({
      ...AT_WAR,
      armies: [army(1, "DEU", 3, { mine: mine({ front: [3, 4] }) })],
    });
    const sel = { army: 1, zoneDraft: null as number[] | null };
    expect(zoneShown(land, sel, 1)).toEqual([3, 4]);
    sel.zoneDraft = [4];
    expect(zoneShown(land, sel, 1)).toEqual([4]);
    // The draft belongs to the chosen army only.
    expect(zoneShown(land, sel, 2)).toEqual([]);
    expect(zoneOrder(1, [3])).toEqual({
      kind: "army_zone",
      army: 1,
      regions: [3],
    });
    expect(planOrder(1, [6], "aggressive")).toEqual({
      kind: "army_plan",
      army: 1,
      targets: [6],
      stance: "aggressive",
    });
  });

  it("ww7: a running balanced attack whose odds are all Low is waiting; 과감 or a battle is not", () => {
    const order = (stance: "balanced" | "aggressive") => ({
      ...idleOrder(),
      kind: "plan" as const,
      targets: [6],
      stance,
      executing: true,
    });
    const low = [[5, 6, 10]] as [number, number, number][];
    const mk = (stance: "balanced" | "aggressive", odds = low, state = 0) =>
      army(1, "DEU", 5, {
        state,
        mine: mine({ order: order(stance), odds }),
      });
    expect(waitingForOdds(mk("balanced"))).toBe(true);
    expect(waitingForOdds(mk("aggressive"))).toBe(false);
    expect(
      waitingForOdds(
        mk("balanced", [
          [5, 6, 10],
          [4, 6, 80],
        ]),
      ),
    ).toBe(false);
    expect(waitingForOdds(mk("balanced", low, 2))).toBe(false);
    expect(waitingForOdds(mk("balanced", []))).toBe(false);
  });

  it("ww7: odds read low under 40, medium 40–64, high from 65", () => {
    expect([0, 39, 40, 64, 65, 100].map(oddsLevel)).toEqual([
      "low",
      "low",
      "mid",
      "mid",
      "high",
      "high",
    ]);
    expect(
      oddsBadges([
        [3, 6, 20],
        [4, 7, 72],
      ]),
    ).toEqual([
      { region: 3, target: 6, pct: 20, level: "low" },
      { region: 4, target: 7, pct: 72, level: "high" },
    ]);
    expect(oddsBadges(undefined)).toEqual([]);
  });

  it("ww7: the auto level, with the old flag read as full auto", () => {
    expect(autoLevelOf({ auto: false })).toBe(0);
    expect(autoLevelOf({ auto: true })).toBe(2);
    expect(autoLevelOf({ auto: true, autoLevel: 1 })).toBe(1);
    expect(autoLevelOf({ auto: false, autoLevel: 0 })).toBe(0);
    const { land, view } = game({
      ...AT_WAR,
      armies: [army(1, "DEU", 3, { mine: mine({ auto: true, autoLevel: 1 }) })],
    });
    expect(armyCard(land, view, DEU, 1, DAY)!.autoLevel).toBe(1);
  });

  it("ww7: a group's front walks the border from the tapped region; its zone is its armies' zones", () => {
    const g = game({
      ...AT_WAR,
      armies: [
        army(1, "DEU", 3, { mine: mine({ front: [3, 4] }) }),
        army(2, "DEU", 4, { mine: mine({ front: [4] }) }),
      ],
    });
    const sides = landSidesOf(g.game as never);
    // Berlin, Munich and Rome face Poland: a region per two divisions,
    // walked along the border from the tapped one; none from a region
    // that is no border.
    expect(groupZone(g.land, DEU, sides, 3, 2)).toEqual([3]);
    expect(groupZone(g.land, DEU, sides, 3, 4)).toEqual([3, 4]);
    expect(groupZone(g.land, DEU, sides, 3, 6)).toEqual([3, 4, 5]);
    expect(groupZone(g.land, DEU, sides, 3, 24)).toEqual([3, 4, 5]);
    expect(groupZone(g.land, DEU, sides, 1, 6)).toEqual([]);
    expect(groupZoneOf(g.land, [1, 2])).toEqual([3, 4]);
    expect(groupZoneOf(g.land, [2])).toEqual([4]);
  });

  it("ww7: the battle card's luck block shows what the engine sent, and only that", () => {
    const base = battle(7, "DEU", "POL");
    // An engine without the fields: nothing to show.
    expect(battleLuck(base)).toEqual({
      band: null,
      winPct: null,
      barPct: null,
      range: null,
      tactics: null,
      initiative: null,
      reinfPct: null,
    });
    const full = battle(7, "DEU", "POL", {
      band: 1,
      depth: 3,
      winPct: 72,
      lowPm: 1300,
      midPm: 1800,
      highPm: 2600,
      tacticAtt: 1,
      tacticDef: 1,
      initAtt: 61,
      initDef: 38,
      reinfPct: 40,
    });
    expect(battleLuck(full)).toEqual({
      band: { n: 2, of: 3 },
      winPct: 72,
      barPct: 72,
      range: { low: "1.30", mid: "1.80", high: "2.60" },
      tactics: { att: "assault", def: "ambush", countered: true },
      initiative: { att: 61, def: 38 },
      reinfPct: 40,
    });
    // A one-band region has no band to show; an uncancelled tactic pair.
    expect(battleLuck({ ...full, depth: 1, tacticDef: 0 })).toMatchObject({
      band: null,
      tactics: { att: "assault", def: "defend", countered: false },
    });
    // The fog's close band: the bar in steps of 20, no numbers; below: no bar.
    expect(battleLuck(full, 2)).toMatchObject({
      winPct: null,
      barPct: 80,
      range: null,
      initiative: null,
      reinfPct: null,
    });
    expect(battleLuck(full, 1)).toMatchObject({ barPct: null, winPct: null });
    // Design §2.2: every counter pair cancels, nothing else does.
    const pairs = [
      [1, 1],
      [2, 2],
      [3, 4],
      [5, 5],
      [6, 6],
    ];
    for (let a = 0; a < 7; a++) {
      for (let d = 0; d < 7; d++) {
        expect(tacticCountered(a, d)).toBe(
          pairs.some(([x, y]) => x === a && y === d),
        );
      }
    }
    expect(tacticCountered(9, 1)).toBe(false);
  });

  it("the generals tab: who serves, who comes later", () => {
    const { land } = game({
      landDetails: [
        landDetail("DEU", {
          generals: [
            general(1),
            general(2, { key: "bock", from: 400 }),
            general(3, { key: "", titleNo: 1, until: 100 }),
          ],
        }),
      ],
    });
    expect(
      generalRows(land, DEU, DAY).map((r) => [r.data.id, r.serving]),
    ).toEqual([
      [1, true],
      [2, false],
      [3, false],
    ]);
  });

  it("the training tab's shortage: what the waiting divisions lack", () => {
    const { land, view } = game({
      details: [detail("DEU")],
      landDetails: [
        landDetail("DEU", {
          training: [training(1, { waiting: "equipment" })],
        }),
      ],
    });
    // Nothing in stock: every type the German line needs is short.
    expect(shortTypes(land, view, DEU)).toEqual([
      "infantry_equipment",
      "artillery",
      "anti_tank",
    ]);
  });
});
