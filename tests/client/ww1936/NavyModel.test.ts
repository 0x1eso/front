// World War 1936 P4 (plan Task 12 Step 6): the navy screens' model — the
// mission candidates, the preview and the shipyard cards say what the
// engine-lib rules say.
import { SHIP_CLASSES } from "@openfront/engine-api/ww1936/NavyTypes";
import {
  lineCostMilli,
  nextLaunchDays,
} from "@openfront/engine-lib/ww1936/NavalLineRules";
import {
  fleetMissionBlock,
  fleetPower,
} from "@openfront/engine-lib/ww1936/NavalRules";
import { seaPath } from "@openfront/engine-lib/ww1936/SeaGraph";
import { shipNameKey } from "@openfront/engine-lib/ww1936/ShipNames";
import { shipStats } from "@openfront/engine-lib/ww1936/ShipStats";
import { emptyStats } from "@openfront/engine-lib/ww1936/Stats";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, string | number>) =>
    params
      ? `[${key}] ${Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")}`
      : `[${key}]`,
}));

import { seaDistancesFrom } from "../../../src/client/hud/ww1936/LandSeaAir";
import {
  fleetCard,
  invasionPreview,
  lineCards,
  missionCandidates,
  missionPreview,
  missionTargets,
  navyCtx,
  navyDial,
  NavyGame,
  navyNoticeParams,
  regionSeaAirLines,
} from "../../../src/client/hud/ww1936/NavyModel";
import { sideKeyOf } from "../../../src/client/view/WwNavyView";
import { PATH_KM, REGION, SEA_KM, SR, ZONE } from "../../ww1936/seaFixture";
import { army, division, landDetail, mine } from "./LandFixture";
import {
  fleet,
  navyDetail,
  sea,
  seaGame,
  seaRegion,
  ship,
  SID,
} from "./SeaAirFixture";

const ctxOf = (g: ReturnType<typeof seaGame>) =>
  navyCtx(g.game as unknown as NavyGame)!;

const homeFleet = (over = {}) =>
  fleet({
    id: 7,
    zone: ZONE.west,
    docked: REGION.london,
    state: "docked",
    ships: [ship(1, "bb"), ship(2, "dd"), ship(3, "dd")],
    ...over,
  });

describe("NavyModel (spec §18.3–§18.5)", () => {
  it("mission candidates are the sea regions fleetMissionBlock allows on seaPath's km", () => {
    const g = seaGame({ fleets: [homeFleet()] });
    const ctx = ctxOf(g);
    const f = g.navy.fleets.get(7)!;
    const range = Math.min(
      ...f.ships.map(
        (s) => shipStats(s.cls, s.gen, ctx.stats, ctx.techs).rangeKm,
      ),
    );
    for (const mission of ["patrol", "raid", "escort"] as const) {
      const want = sea
        .strategicList()
        .filter((s) => s.kind === "sea")
        .map((s) => {
          const km =
            seaPath(sea, [sea.harborOf(REGION.london)], s.members, () => true)
              ?.km ?? null;
          return {
            sr: s.id,
            km,
            block: fleetMissionBlock({
              mission,
              srKind: "sea",
              km,
              rangeKm: range,
              inBattle: false,
            }),
          };
        });
      expect(missionTargets(ctx, f, mission)).toEqual(want);
      expect(missionCandidates(ctx, f, mission)).toEqual(
        want.filter((t) => t.block === null && t.km !== null).map((t) => t.sr),
      );
    }
    // London's harbor is the West Sea: the date line is the short way east.
    const km = new Map(
      missionTargets(ctx, f, "patrol").map((t) => [t.sr, t.km]),
    );
    expect(km.get(SR.approaches)).toBe(0);
    expect(km.get(SR.central)).toBe(300);
    expect(km.get(SR.eastern)).toBe(240);
  });

  it("an enemy shore closes the strait: the way goes round (edgePassable)", () => {
    const narrows = (wars: [never, never][] | [["GBR", "POL"]]) => {
      const g = seaGame({ fleets: [homeFleet()], wars: wars as never });
      const ctx = ctxOf(g);
      return seaDistancesFrom(
        ctx.p4,
        sea,
        g.economy,
        ctx.sides,
        SID("GBR"),
        true,
        ZONE.middle,
      ).get(ZONE.narrows);
    };
    // Open: the strait, 160; Poland's shore at war: round by the West Sea,
    // the date line and the canal.
    expect(narrows([])).toBe(SEA_KM.middleNarrows);
    expect(narrows([["GBR", "POL"]])).toBe(PATH_KM.middleToNarrowsStraitClosed);
  });

  it("the preview: supremacy, the spotted enemy's fleetPower, distance, fuel a day", () => {
    const enemy = fleet({
      id: 9,
      owner: SID("ITA"),
      zone: ZONE.middle,
      counts: [2, 0, 0, 0, 1, 0, 0],
      ships: [],
      flags: 1 << 2, // FLEET_FLAG_SPOTTED
    });
    const g = seaGame({
      fleets: [homeFleet(), enemy],
      wars: [["GBR", "ITA"]],
      seaRegions: [
        {
          sr: SR.central,
          sup: [[sideKeyOf(SID("GBR"), -1), 640]],
          spotted: [],
          convoyLoss: [],
        },
      ],
    });
    const ctx = ctxOf(g);
    const f = g.navy.fleets.get(7)!;
    const p = missionPreview(ctx, f, "patrol", SR.central);
    expect(p.supPm).toBe(640);
    const plain = (cls: (typeof SHIP_CLASSES)[number]) => {
      const st = shipStats(cls, 1, emptyStats(), new Set());
      return { stats: st, hpMilli: st.hpMilli };
    };
    expect(p.enemyPower).toBe(
      fleetPower([plain("dd"), plain("dd"), plain("bb")]),
    );
    expect(p.ratioPm).not.toBeNull();
    expect(p.km).toBe(300);
    const fuel = f.ships.reduce(
      (s, x) =>
        s + shipStats(x.cls, x.gen, ctx.stats, ctx.techs).fuelPerDayMilli,
      0,
    );
    expect(p.fuelPerDayMilli).toBe(fuel);
    expect(p.days).toBeGreaterThanOrEqual(1);
    // No enemy known elsewhere: no odds.
    expect(missionPreview(ctx, f, "patrol", SR.eastern).ratioPm).toBeNull();
  });

  it("a line card's days to the next launch are nextLaunchDays'", () => {
    const g = seaGame({
      navy: navyDetail("GBR", {
        lines: [
          {
            id: 1,
            cls: "bb",
            gen: 2,
            docks: 8,
            activeDocks: 8,
            progressMilli: 5_000_000,
            costMilli: lineCostMilli({ cls: 4, gen: 2, progress: 0 }),
            left: 2,
            port: REGION.london,
            nextName: 1,
            outputMilli: 22_000,
            fill: 1000,
          },
          {
            id: 2,
            cls: "convoy",
            gen: 1,
            docks: 2,
            activeDocks: 0,
            progressMilli: 0,
            costMilli: 60_000,
            left: 0,
            port: REGION.london,
            nextName: 0,
            outputMilli: 0,
            fill: 400,
          },
        ],
      }),
    });
    const cards = lineCards(ctxOf(g));
    expect(cards[0].nextDays).toBe(
      nextLaunchDays(
        { cls: SHIP_CLASSES.indexOf("bb"), gen: 2, progress: 5_000_000 },
        22_000,
      ),
    );
    expect(cards[0].nextName).toBe(
      `[ww1936.ship.${shipNameKey("GBR", "bb", 1)}]`,
    );
    expect(cards[1].nextDays).toBe(-1);
    expect(cards[1].short).toBe(true);
  });

  it("the card greys what it can't do, with the judge's reason", () => {
    const g = seaGame({
      fleets: [homeFleet({ ships: [ship(1, "dd")], state: "battle" })],
    });
    const c = fleetCard(ctxOf(g), 7)!;
    const block = (id: string) => c.buttons.find((b) => b.id === id)?.block;
    expect(block("move")).toBe("fleet_busy");
    expect(block("split")).toBe("fleet_busy");
    expect(block("merge")).toBe("fleet_busy");
    // No carrier: no port strike button.
    expect(c.buttons.some((b) => b.id === "port_strike")).toBe(false);
    const calm = fleetCard(
      ctxOf(seaGame({ fleets: [homeFleet({ ships: [ship(1, "dd")] })] })),
      7,
    )!;
    expect(calm.buttons.find((b) => b.id === "split")?.block).toBe(
      "split_single",
    );
    expect(calm.buttons.find((b) => b.id === "merge")?.block).toBe("no_fleet");
  });

  it("a landing's chips: route supremacy, convoys, preparation, divisions", () => {
    const g = seaGame({
      wars: [["GBR", "ITA"]],
      seaRegions: [
        {
          sr: SR.approaches,
          sup: [[sideKeyOf(SID("GBR"), -1), 900]],
          spotted: [],
          convoyLoss: [],
        },
        {
          sr: SR.central,
          sup: [[sideKeyOf(SID("GBR"), -1), 300]],
          spotted: [],
          convoyLoss: [],
        },
      ],
      armies: [army(1, "GBR", REGION.london, { divisions: 2, mine: mine() })],
      landDetails: [
        landDetail("GBR", {
          divisions: [
            division(1, 1, REGION.london),
            division(2, 1, REGION.london),
          ],
        }),
      ],
    });
    const p = invasionPreview(ctxOf(g), 1, REGION.rome)!;
    expect(p.from).toBe(REGION.london);
    expect(p.routeKm).toBe(300);
    expect(p.route).toEqual([
      { sr: SR.approaches, supPm: 900, ok: true },
      { sr: SR.central, supPm: 300, ok: false },
    ]);
    expect(p.divisions).toBe(2);
    expect(p.capacity).toBe(10);
    expect(p.prepDays).toBe(60);
    expect(p.convoysIdle).toBe(35);
    expect(p.convoysNeed).toBeGreaterThan(0);
    expect(p.block).toBeNull();
    // Not at war with France: refused with the judge's reason.
    expect(invasionPreview(ctxOf(g), 1, REGION.lyon)!.block).toBe("not_at_war");
  });

  it("the region card: levels, bombed factories, the fleet in port, the zones", () => {
    const g = seaGame({
      fleets: [homeFleet()],
      regions: [seaRegion(REGION.london, { civ: 5, damage: [2_400] })],
    });
    const l = regionSeaAirLines(sea, g.economy, g.navy, REGION.london, false);
    expect(l.levels).toEqual([
      ["naval_base", 6],
      ["air_base", 2],
      ["anti_air", 1],
      ["coastal_fort", 1],
    ]);
    expect(l.bombed).toEqual({ stopped: 2, repairPct: 60 });
    expect(l.docked).toEqual([
      { name: "[ww1936.navy.fleet_name] n=1", ships: 3 },
    ]);
    expect(l.harbor).toBe("West Sea");
    expect(l.seaSr).toBe("Western Approaches");
    expect(l.airZone).toBe("West");
  });

  it("notices name the regions, the class, the ship and the direction", () => {
    const p = navyNoticeParams(
      "events_display.ww1936_air_superiority",
      { sr: SR.central, pct: 62, gained: 1 },
      sea,
      null,
      false,
    );
    expect(p).toMatchObject({
      sr: "Central Waters",
      zone: "Central Waters",
      dir: "up",
    });
    const c = navyNoticeParams(
      "events_display.ww1936_ship_commissioned",
      { n: 1, cls: "bb", ship: "gbr_king_george_v" },
      sea,
      null,
      false,
    );
    expect(c).toMatchObject({
      cls: "[ww1936.ship_class.bb]",
      ship: "[ww1936.ship.gbr_king_george_v]",
    });
    const d = navyNoticeParams(
      "events_display.ww1936_ship_commissioned",
      { n: 1, cls: "dd", ship: 23 },
      sea,
      null,
      false,
    );
    expect(d.ship).toBe("[ww1936.navy.ship_numbered] n=23");
  });

  it("ships lost today: my ships sunk in battle since the day began", () => {
    const g = seaGame({ fleets: [homeFleet()] });
    const battle = (sunk: [number, number, number, number][]) => ({
      zone: ZONE.middle,
      attacker: SID("GBR"),
      defender: SID("ITA"),
      round: 3,
      hpPm: [900, 800] as [number, number],
      orgPm: [900, 800] as [number, number],
      ships: [3, 3] as [number, number],
      sunk,
    });
    const upd = (tick: number, sunk: [number, number, number, number][]) =>
      g.navy.apply(
        {
          fleets: [],
          removedFleets: [],
          battles: [battle(sunk)],
          endedBattles: [],
          seaRegions: [],
          details: [],
        },
        tick,
      );
    // Mine (name owner GBR) twice, Italy's once.
    upd(700, [[0, 0, -3, SID("GBR")]]);
    upd(701, [
      [4, 0, 1, SID("GBR")],
      [0, 1, -2, SID("ITA")],
    ]);
    upd(720, [[0, 0, -4, SID("GBR")]]);
    const ctx = ctxOf(g);
    expect(navyDial(ctx, 650).lost).toBe(3);
    // A new day began at tick 710.
    expect(navyDial(ctx, 710).lost).toBe(1);
  });
});
