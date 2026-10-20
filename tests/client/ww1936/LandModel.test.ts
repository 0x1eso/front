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
import {
  combineMods,
  predictBattle,
} from "@openfront/engine-lib/ww1936/CombatRules";
import { titledGeneralId } from "@openfront/engine-lib/ww1936/Generals";
import { landOrderBlockOf } from "@openfront/engine-lib/ww1936/LandOrderChecks";
import { startTemplates } from "@openfront/engine-lib/ww1936/LandStart";
import {
  GEN1,
  templateStats,
  templateXpCost,
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
  battleCard,
  designer,
  enemySideAt,
  frontPreview,
  generalRows,
  levelBoxes,
  levelDots,
  movePreview,
  regionLandLines,
  rowGeneralName,
  shortTypes,
  tapKind,
  toggleTarget,
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
    expect(card.buttons.map((b) => b.id)).toEqual([
      "move",
      "attack",
      "front",
      "plan",
      "rail",
      "sea",
      "split",
      "merge",
      "auto",
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
    // The nearest enemy region for an attack: Warsaw (Munich–Warsaw edge).
    expect(asked).toContainEqual({ kind: "army_attack", army: 1, region: 6 });
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
    // At peace: nobody to attack.
    const peace = game({ armies: [army(1, "DEU", 4)] });
    expect(
      armyCard(peace.land, peace.view, DEU, 1, DAY)!.buttons.find(
        (b) => b.id === "attack",
      )!.block,
    ).toBe("not_at_war");
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
    // German infantry: recon +5% attack; recon and engineers +5% each on
    // its breakthrough. Poland's division: no modifier.
    const want = predictBattle(land.armies.get(1)!.sum, pol.sum, {
      land: "plains",
      directions: 1,
      attackerAttackBp: combineMods([500], []),
      attackerBlockBp: combineMods([500, 500], []),
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

  it("previews a move over my side's regions with that day's weather", () => {
    const { land, view } = game({
      armies: [army(1, "DEU", 3), army(2, "DEU", 2)],
      landDetails: [
        landDetail("DEU", {
          divisions: [division(1, 1, 3), division(2, 2, 2)],
        }),
      ],
    });
    // Berlin → Munich: 140 km into forest (+25%) = 175,000; infantry
    // 4 km/h at infrastructure 5 (+20%): 8,779 a tick → 20 ticks.
    expect(movePreview(land, view, DEU, 1, 4, "move", DAY)).toEqual({
      path: [3, 4],
      ticks: 20,
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
    // In mud the same walk takes longer.
    const mud = Array.from({ length: 400 }, (_, d) => d).find(
      (d) =>
        weatherAt(
          d,
          view.scenario.latC(4),
          "forest",
          view.scenario.wcell(4),
        ) === "mud",
    )!;
    expect(movePreview(land, view, DEU, 1, 4, "move", mud)!.ticks).toBe(40);
  });

  it("the designer's numbers are templateStats' and its cost templateXpCost's", () => {
    const before = startTemplates("DEU", 5)[0].def;
    const after: TemplateDef = {
      name: "Heavy",
      battalions: [...before.battalions.slice(1), "artillery"],
      support: before.support,
    };
    const all = new Set<WwTechId>(WW_TECH_IDS);
    const tech = techTotals(all);
    const d = designer(before, after, tech, all, 20_000);
    expect(d.stats).toEqual(templateStats(after, tech, GEN1));
    expect(d.xpCost).toBe(templateXpCost(before, after));
    expect(d.xpCost).toBe(5_000);
    expect(d.block).toBeNull();
    // Infantry equipment: 900 (8 battalions + support), 1 factory makes 4.5
    // units a day of a 500-milli unit → 100 days.
    expect(d.factoryDays[0]).toBe(Math.ceil((d.stats.need[0] * 500) / 4_500));
    // Not enough army experience; a battalion without its tech.
    expect(designer(before, after, tech, all, 4_000).block).toBe("no_xp");
    const noTanks = new Set(
      WW_TECH_IDS.filter((t) => t !== "medium_tank_1"),
    ) as Set<WwTechId>;
    expect(
      designer(
        null,
        { name: "T", battalions: ["medium_armor"], support: [] },
        tech,
        noTanks,
        100_000,
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
      land: "hills",
      weather: "clear",
      mine: true,
      leaveArmies: [1],
    });
    expect(c.attackLines).toEqual([
      { id: "general", bp: 2_000 },
      { id: "exp", bp: 500 },
      { id: "recon", bp: 500 },
      { id: "terrain", bp: -2_500 },
    ]);
    // Not in it: a plain division's lines (the terrain only).
    const other = game({ ...AT_WAR, battles: [b] });
    const o = battleCard(other.land, other.view, DEU, 7, DAY)!;
    expect(o.attackLines).toEqual([{ id: "terrain", bp: -2_500 }]);
    expect(o.mine).toBe(false);
    expect(battleCard(other.land, other.view, DEU, 6, DAY)).toBeNull();
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

  it("what a tap means: my side moves, an enemy is attacked, elsewhere cancels", () => {
    const atWar = game(AT_WAR);
    const kind = (mode: Parameters<typeof tapKind>[2], r: number) =>
      tapKind(atWar.land, DEU, mode, r);
    expect(kind("none", 4)).toBe("move");
    // Italy: the same faction, my side.
    expect(kind("none", 5)).toBe("move");
    expect(kind("none", 6)).toBe("attack");
    expect(kind("none", 10)).toBeNull();
    expect(kind("move", 6)).toBeNull();
    expect(kind("plan", 7)).toBe("plan");
    expect(kind("plan", 3)).toBeNull();
    expect(kind("none", 0)).toBeNull();
    // The preparation minute: nobody to fight yet.
    const prep = game({ ticks: 100, wars: [["DEU", "POL"]] });
    expect(tapKind(prep.land, DEU, "none", 6)).toBeNull();
    // Plan targets: add, drop, at most three.
    expect(toggleTarget([6, 7], 8)).toEqual([6, 7, 8]);
    expect(toggleTarget([6, 7, 8], 9)).toEqual([6, 7, 8]);
    expect(toggleTarget([6, 7, 8], 7)).toEqual([6, 8]);
  });

  it("Task 3's front: from the anchor along the border", () => {
    const { land } = game({
      ...AT_WAR,
      armies: [army(1, "DEU", 3, { divisions: 6 })],
    });
    expect(frontPreview(land, DEU, 1, 3)).toEqual([3, 4]);
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
    // Nothing in stock: every type German infantry needs is short.
    expect(shortTypes(land, view, DEU)).toEqual([
      "infantry_equipment",
      "support_equipment",
      "artillery",
    ]);
  });
});
