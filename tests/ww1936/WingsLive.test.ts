// The air overhaul's flip (ww8): the wing model running for real. The world1936
// map, 400 days: Germany and Britain are humans at war, France and Poland are
// AI, restored copies run beside the game. Every air order goes in as a
// player's intent; the test's hand only sets the stage. The AI's planes idle
// until lane E. WINGS_LIVE_LOG=<file> writes the numbers.
import type { StampedIntent, WwOrder } from "@openfront/engine-api/Schemas";
import {
  AIR_MISSIONS,
  AIR_TYPES,
  type AirMission,
  type AirType,
  type Wing,
  WING_NO_MISSION,
  WP_FERRY,
  WP_GROUND,
  WP_STATION,
  WW_BOMB_CLASSES,
  WW_FIELD_STRIP_DAYS,
  WW_FIELD_STRIP_EFF_PM,
  WW_WINGS_LIVE,
  type WwBombClass,
} from "@openfront/engine-api/ww1936/AirTypes";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_EQUIPMENT,
  MOVE_RAIL,
} from "@openfront/engine-api/ww1936/LandTypes";
import { railStep } from "@openfront/engine-lib/ww1936/MoveRules";
import { bombClassHits } from "@openfront/engine-lib/ww1936/WingRules";
import type { Game } from "@openfront/engine/game/Game";
import { wingStats } from "@openfront/engine/ww1936/air/Sorties";
import { wingBaseEffPm } from "@openfront/engine/ww1936/air/Wings";
import { wingPlanes } from "@openfront/engine/ww1936/air/WwAir";
import { damageBuilding } from "@openfront/engine/ww1936/economy/Buildings";
import { navalPort } from "@openfront/engine/ww1936/navy/Ports";
import { appendFileSync } from "node:fs";
import { fleetAtSea } from "./convoyUtil";
import { runLockstep, worldFiles } from "./lockstep";
import {
  byTag,
  HUMAN,
  order,
  placeArmy,
  takeRegion,
  wwGameStart,
} from "./util";

const GBR_PLAYER = "HUMAN002";
const START = 601;
/** The tick `d` days after the war starts. */
const T = (d: number) => START + Math.floor((d * 15) / 2);
const DAYS = 400;
const log = (line: string) => {
  const out = process.env.WINGS_LIVE_LOG;
  if (out !== undefined) appendFileSync(out, `${line}\n`);
};

const ty = (t: AirType) => AIR_TYPES.indexOf(t);
const mi = (m: AirMission) => AIR_MISSIONS.indexOf(m);
const idOf = (g: Game, t: CountryTag) => byTag(g, t).smallID();
const ATOMIC = equipKey("atomic_bomb", 1);

/** What the stage adds to the two humans' stock, on top of their own. */
const STOCK: readonly [AirType, number][] = [
  ["fighter", 1000],
  ["heavy_fighter", 200],
  ["cas", 500],
  ["bomber", 1300],
  ["strat_bomber", 1000],
  ["naval_bomber", 600],
  ["transport_plane", 400],
];

/** Our region touching `foe`'s, and that region: the first in id order. */
function borderOf(g: Game, me: number, foe: number): [number, number] {
  const ww = g.worldWar()!;
  for (const r of ww.scenario.landRegions) {
    if (ww.land.controller[r.id] !== me) continue;
    for (const e of ww.scenario.edgesOf(r.id)) {
      if (ww.land.controller[e.to] === foe) return [r.id, e.to];
    }
  }
  throw new Error(`no border ${me}-${foe}`);
}

/** Where the stage stands (found from the game, the same in every copy). */
let stage = {
  battleA: 0,
  battleB: 0,
  ourB: 0,
  pocket: 0,
  armyA: 0,
  armyB: 0,
  armyPocket: 0,
  armyPara: 0,
  zoneFleet: 0,
  port: 0,
};
let railRun = { army: 0, to: 0 };
const supply = [0, 0];
let captured = 0;
let capturedWings: { id: number; ground: boolean; planes: number }[] = [];

/** The stage, on the game and every copy alike: reads only the game it gets. */
function hand(g: Game): void {
  const t = g.ticks();
  if (t < START) return;
  const ww = g.worldWar()!;
  const { land, air, scenario: sc, economy: econ } = ww;
  const deu = idOf(g, "DEU");
  const gbr = idOf(g, "GBR");
  const fra = idOf(g, "FRA");
  const pol = idOf(g, "POL");
  if (t === START) {
    ww.politics.naps = ww.politics.naps.filter(
      (n) => n.a !== deu && n.b !== deu,
    );
    for (const foe of [pol, fra, gbr]) ww.setWar(deu, foe, t);
    for (const id of [deu, gbr]) {
      const ce = econ.country(id)!;
      for (const [type, n] of STOCK) ce.stock[equipKey(type, 1)] += n;
      ce.fuelMilli = Math.max(ce.fuelMilli, 40_000_000);
    }
    // Room for them near the front.
    econ.addBuilding(borderOf(g, deu, pol)[0], "air_base", 3);
    econ.addBuilding(borderOf(g, deu, fra)[0], "air_base", 20);
    econ.addBuilding(ww.capitalRegion(gbr), "air_base", 20);
  }
  if (t === T(2)) {
    for (const id of [deu, fra, pol]) {
      const ce = econ.country(id)!;
      ce.manpower += 3_000_000;
      for (const e of GROUND_EQUIPMENT) ce.stock[equipKey(e, 1)] += 50_000;
    }
    const [ourA, battleA] = borderOf(g, deu, fra);
    const [ourB, battleB] = borderOf(g, deu, pol);
    const armyA = placeArmy(g, "DEU", ourA, 10).id;
    placeArmy(g, "FRA", battleA, 30);
    const armyB = placeArmy(g, "DEU", ourB, 10).id;
    placeArmy(g, "POL", battleB, 30);
    // A pocket behind the French line, for the air supply.
    const pocket = sc.landRegions
      .map((r) => r.id)
      .filter(
        (r) =>
          land.controller[r] === fra &&
          r !== battleA &&
          sc.regionKm(r, battleA) < 300 &&
          !sc.regionNeighbours(r).some((n) => land.controller[n] === deu),
      )[0];
    takeRegion(g, pocket, "DEU");
    const armyPocket = placeArmy(g, "DEU", pocket, 6).id;
    // Guns where the bombs fall, a silo for the fuel class, radar over Britain.
    for (const r of sc.landRegions) {
      const c = land.controller[r.id];
      if (c === fra || c === deu || c === gbr) {
        econ.addBuilding(r.id, "anti_air", 2);
      }
    }
    econ.addBuilding(battleA, "fuel_silo", 2);
    econ.addBuilding(ww.capitalRegion(gbr), "radar", 1);
    // Paratroopers at the capital's air base.
    econ.country(deu)!.addTech("paratroopers");
    const lc = land.country(deu)!;
    const tpl = lc.nextTemplateId++;
    const battalions = Array(6).fill("paratrooper");
    lc.templates.push({
      id: tpl,
      key: "",
      def: { name: "Airborne", battalions, support: [] },
    });
    const armyPara = placeArmy(g, "DEU", ww.capitalRegion(deu), 1, tpl).id;
    // A British fleet in the sea zone nearest Germany's naval bombers, and a
    // French one docked in the nearest port.
    const nb = air.wingsOf(deu).find((w) => w.type === ty("naval_bomber"))!;
    const nearest = (rs: readonly number[]) =>
      rs.reduce((a, b) =>
        sc.targetKm(nb.base, b) < sc.targetKm(nb.base, a) ? b : a,
      );
    const zoneFleet = nearest(
      sc
        .strategicList()
        .filter((s) => s.kind === "sea")
        .flatMap((s) => [...s.members]),
    );
    const port = nearest(
      sc.landRegions
        .map((r) => r.id)
        .filter((r) => land.controller[r] === fra && navalPort(ww, r)),
    );
    const ships: ["bb" | "dd", number, number][] = [
      ["bb", 1, 2],
      ["dd", 1, 6],
    ];
    const sr = sc.zoneSr(zoneFleet);
    fleetAtSea(
      ww.navy,
      gbr,
      ww.capitalRegion(gbr),
      ships,
      zoneFleet,
      "patrol",
      sr,
    );
    ww.navy.createFleet(fra, port, ships);
    stage = {
      battleA,
      battleB,
      ourB,
      pocket,
      armyA,
      armyB,
      armyPocket,
      armyPara,
      zoneFleet,
      port,
    };
  }
  if (t === T(70)) econ.country(deu)!.stock[ATOMIC] = 1;
  if (t === T(79)) {
    // Something the precision raid may take, under a bomber's target.
    econ.addBuilding(raider(g).target, "radar", 1);
  }
  if (t === T(90)) {
    // A German base falls with wings on the ground and in the air.
    const at = new Map<number, Wing[]>();
    for (const w of air.wingsOf(deu)) {
      if (w.base <= 0 || w.base === ww.capitalRegion(deu)) continue;
      if (w.phase === WP_FERRY || land.controller[w.base] !== deu) continue;
      at.set(w.base, [...(at.get(w.base) ?? []), w]);
    }
    for (const b of [...at.keys()].sort((x, y) => x - y)) {
      const up = at.get(b)!.find((w) => w.phase === WP_STATION);
      const down = at
        .get(b)!
        .find((w) => w.phase === WP_GROUND && w.mission < 0);
      if (up === undefined || down === undefined) continue;
      captured = b;
      capturedWings = [up, down].map((w) => ({
        id: w.id,
        ground: w === down,
        planes: wingPlanes(w),
      }));
      takeRegion(g, b, "POL");
      break;
    }
  }
  if (t === T(119)) {
    // Room near the army, and a far base for the wing following it.
    econ.addBuilding(stage.ourB, "air_base", 2);
    const far = sc.landRegions
      .map((r) => r.id)
      .filter((r) => land.controller[r] === deu)
      .sort(
        (a, b) => sc.regionKm(b, stage.ourB) - sc.regionKm(a, stage.ourB),
      )[0];
    econ.addBuilding(far, "air_base", 2);
  }
  if (t === T(149)) {
    // The train: a damaged railway next to fresh divisions at the capital.
    const cap = ww.capitalRegion(deu);
    const to = sc
      .regionNeighbours(cap)
      .filter((r) => land.controller[r] === deu && econ.rail[r] >= 2)[0];
    damageBuilding(econ, to, "rail", 1000);
    railRun = { army: placeArmy(g, "DEU", cap, 1).id, to };
  }
  if (t === T(380) || t === T(385)) {
    // Every German railway bombed out: the supply has to come by road.
    let sum = 0;
    for (const r of sc.landRegions) {
      if (land.controller[r.id] !== deu) continue;
      sum += land.supplyMilli[r.id];
      if (t === T(380) && econ.rail[r.id] > 0) {
        damageBuilding(econ, r.id, "rail", econ.rail[r.id] * 1000);
      }
    }
    supply[t === T(380) ? 0 : 1] = sum;
  }
}

/** The first German wing bombing an enemy's named region with planes enough. */
function raider(g: Game): Wing {
  const { air, land } = g.worldWar()!;
  const deu = idOf(g, "DEU");
  return air
    .wingsOf(deu)
    .find(
      (w) =>
        w.mission === mi("strategic_bombing") &&
        w.target !== 0 &&
        wingPlanes(w) >= 50 &&
        land.isEnemy(deu, land.controller[w.target] ?? 0),
    )!;
}

test("a real game on wings: every mission, base moves, 400 days, in lockstep", async () => {
  expect(WW_WINGS_LIVE).toBe(true);
  const seen = {
    stationed: new Map<number, number>(),
    supMin: 1000,
    supMax: 0,
    lost: new Map<number, number>(),
    casPeak: 0,
    casFollowTicks: 0,
    navalSearch: 0,
    navalStrike: 0,
    navalDamage: 0,
    pocketSupplyPeak: 0,
    armyGone: false,
    reconRows: 0,
    railHit: 0,
    railBefore: 0,
    railMin: 99,
    railStep: [0, 0],
    classesHit: new Set<string>(),
    raidLost: 0,
    groundPlanes: 0,
    fuelBombed: 0,
    shipsHit: 0,
    night: 0,
    interceptorsUp: 0,
    fuelEmptyDay: 0,
    maxXp: 0,
    aces: new Set<number>(),
    paraDropped: false,
    nukes: 0,
    raidsQueued: 0,
    raidOver: false,
    strip: 0,
    stripWing: 0,
    stripEff: 0,
    moved: { id: 0, to: 0, sawFerry: false, flewAfter: false },
    standDown: { id: 0, ok: false },
    disband: { id: 0, ok: false },
    moveUp: { id: 0, far: 0, ok: false },
    groundAfter: 0,
    groundFerry: false,
    upRebased: false,
    followSupply: 0,
    refused: [] as string[],
  };
  let main: Game | null = null;
  const used = new Set<number>();
  const expected: { id: number; mission: number; what: string }[] = [];
  const out: StampedIntent[] = [];

  /** Orders the first free wing of the type that reaches one of `targets`, the nearest. */
  const give = (
    g: Game,
    tag: "DEU" | "GBR",
    type: AirType,
    mission: AirMission,
    targets: readonly number[],
    extra: Partial<Extract<WwOrder, { kind: "wing_mission" }>> = {},
  ): { w: Wing; target: number } => {
    const { air, scenario: sc } = g.worldWar()!;
    for (const w of air.wingsOf(idOf(g, tag))) {
      if (w.type !== ty(type) || w.base <= 0 || used.has(w.id)) continue;
      const range = wingStats(air, w).rangeKm;
      let target = 0;
      let bestKm = range + 1;
      for (const r of targets) {
        const km = sc.targetKm(w.base, r);
        if (km < bestKm) {
          target = r;
          bestKm = km;
        }
      }
      if (target === 0) continue;
      used.add(w.id);
      const client = tag === "DEU" ? HUMAN : GBR_PLAYER;
      out.push(
        order(client, {
          kind: "wing_mission",
          wings: [w.id],
          mission,
          target,
          ...extra,
        }),
      );
      expected.push({ id: w.id, mission: mi(mission), what: mission });
      log(`order ${mission}: ${tag} wing ${w.id} base ${w.base} -> ${target}`);
      return { w, target };
    }
    throw new Error(`no ${tag} ${type} for ${mission} in reach`);
  };

  /** Today's orders, read from the main game (every copy gets the same turn). */
  const script = (g: Game) => {
    const ww = g.worldWar()!;
    const t = g.ticks();
    const { air, land, scenario: sc, economy: econ } = ww;
    const deu = idOf(g, "DEU");
    const gbr = idOf(g, "GBR");
    const s = stage;
    const lands = sc.landRegions.map((r) => r.id);
    const enemy = (r: number) => land.isEnemy(deu, land.controller[r] ?? 0);
    const hits = (c: WwBombClass) =>
      lands.filter(
        (r) =>
          enemy(r) &&
          bombClassHits(
            c,
            (b) => econ.buildingArray(b)[r] ?? 0,
            (sc.region(r)?.res[0] ?? 0) > 0,
          ),
      );
    if (t === T(0.5)) {
      out.push(
        order(HUMAN, { kind: "army_auto_all", on: true }),
        order(GBR_PLAYER, { kind: "army_auto_all", on: true }),
        order(GBR_PLAYER, { kind: "auto_set", domain: "navy", on: true }),
      );
    }
    if (t === T(2) + 1) {
      for (const [army, region] of [
        [s.armyA, s.battleA],
        [s.armyB, s.battleB],
      ]) {
        out.push(order(HUMAN, { kind: "army_move", army, region }));
      }
    }
    if (t === T(3)) {
      // Fighters: both sides over one zone, others over the battles, recon.
      const gf = air.wingsOf(gbr).find((w) => w.type === ty("fighter"))!;
      const both = lands.filter(
        (r) =>
          enemy(r) && sc.targetKm(gf.base, r) <= wingStats(air, gf).rangeKm,
      );
      const { target: zone } = give(
        g,
        "DEU",
        "fighter",
        "air_superiority",
        both,
      );
      give(g, "DEU", "fighter", "air_superiority", [zone]);
      give(g, "GBR", "fighter", "air_superiority", [zone]);
      give(g, "GBR", "fighter", "air_superiority", [zone]);
      give(g, "DEU", "fighter", "air_superiority", [s.battleB]);
      give(g, "DEU", "fighter", "air_superiority", [s.battleA]);
      give(g, "DEU", "fighter", "recon", lands.filter(enemy));
      // Bombing: one wing a class, a night raid, an escorted raid.
      for (const c of WW_BOMB_CLASSES) {
        const targets =
          c === "fuel"
            ? [s.battleA]
            : c === "airfield"
              ? lands.filter((r) => enemy(r) && air.wingsAtBase(r).length > 0)
              : hits(c);
        const type = c === "airfield" ? "strat_bomber" : "bomber";
        give(g, "DEU", type, "strategic_bombing", targets, { cls: c });
      }
      const cls: WwBombClass = "factories";
      const night = give(
        g,
        "DEU",
        "strat_bomber",
        "strategic_bombing",
        hits(cls),
        {
          cls,
        },
      ).w;
      out.push(
        order(HUMAN, { kind: "air_night", deployment: night.id, on: true }),
      );
      const raid = give(g, "DEU", "bomber", "strategic_bombing", hits(cls), {
        cls,
      });
      give(g, "DEU", "fighter", "escort", [raid.target], {
        target: 0,
        escort: raid.w.id,
      });
      // Britain's raid on Germany's rail, and the interceptors on both sides.
      const rails = lands.filter(
        (r) =>
          land.controller[r] === deu &&
          econ.rail[r] >= 2 &&
          r !== s.pocket &&
          r !== ww.capitalRegion(deu),
      );
      const railRaid = give(
        g,
        "GBR",
        "strat_bomber",
        "strategic_bombing",
        rails,
        {
          cls: "rail",
        },
      );
      // A second raid on the same line: since the free-military change one
      // wing's load no longer takes a whole rail level here.
      give(g, "GBR", "strat_bomber", "strategic_bombing", [railRaid.target], {
        cls: "rail",
      });
      seen.railHit = railRaid.target;
      seen.railBefore = econ.rail[railRaid.target];
      give(g, "DEU", "fighter", "interception", [railRaid.target]);
      const home = ww.capitalRegion(gbr);
      give(g, "GBR", "fighter", "interception", [home]);
      give(
        g,
        "DEU",
        "strat_bomber",
        "strategic_bombing",
        hits(cls).filter((r) => land.controller[r] === gbr),
        { cls },
      );
      // Close air support: named, and following an army.
      give(g, "DEU", "cas", "cas", [s.battleA]);
      give(g, "DEU", "cas", "cas", [s.ourB], { target: s.ourB, army: s.armyB });
      // The sea: patrol, strike, a port.
      give(g, "DEU", "naval_bomber", "naval_patrol", [s.zoneFleet]);
      give(g, "DEU", "naval_bomber", "naval_strike", [s.zoneFleet]);
      give(g, "DEU", "naval_bomber", "port_strike", [s.port]);
      // Air supply: the pocket, and following the army in it.
      give(g, "DEU", "transport_plane", "air_supply", [s.pocket]);
      seen.followSupply = give(
        g,
        "DEU",
        "transport_plane",
        "air_supply",
        [s.pocket],
        {
          army: s.armyPocket,
        },
      ).w.id;
    }
    if (t === T(3) + 2) {
      for (const e of expected) {
        if (air.wings.get(e.id)!.mission !== e.mission) {
          seen.refused.push(`${e.what}: wing ${e.id}`);
        }
      }
    }
    if (t === T(20)) {
      // A stand-down in the air.
      const w = air
        .wingsOf(deu)
        .find(
          (x) => x.phase === WP_STATION && x.mission === mi("air_superiority"),
        )!;
      seen.standDown.id = w.id;
      out.push(
        order(HUMAN, {
          kind: "wing_mission",
          wings: [w.id],
          mission: "air_superiority",
          target: 0,
        }),
      );
    }
    if (t === T(20) + 2) {
      const w = air.wings.get(seen.standDown.id)!;
      seen.standDown.ok = w.mission === WING_NO_MISSION && w.flyMilli === 0;
    }
    if (t === T(30)) {
      // A base move for a wing with an order.
      const w = air
        .wingsOf(deu)
        .find(
          (x) =>
            x.base > 0 &&
            x.type === ty("fighter") &&
            x.mission === mi("air_superiority"),
        )!;
      const to = lands.find(
        (r) =>
          r !== w.base &&
          land.controller[r] === deu &&
          air.baseCapacity(r) - air.baseUse(r) >= wingPlanes(w) &&
          sc.targetKm(r, w.target) <= wingStats(air, w).rangeKm,
      )!;
      seen.moved = { id: w.id, to, sawFerry: false, flewAfter: false };
      out.push(order(HUMAN, { kind: "wing_base", wings: [w.id], base: to }));
    }
    if (t === T(40)) {
      // A field strip where an army stands, and a small wing moves in.
      // ww9: one away from the front (every neighbour is Germany's), so the
      // strip is not overrun before its wing has flown in and been measured.
      const strips = lands.filter(
        (x) =>
          land.controller[x] === deu &&
          econ.buildingArray("air_base")[x] === 0 &&
          land.rowsIn(x).some((row) => land.divisions.owner[row] === deu),
      );
      // (the one farthest from any region of the other side).
      const foes = lands.filter(
        (x) =>
          land.controller[x] !== 0 &&
          land.sideOf(land.controller[x]) !== land.sideOf(deu),
      );
      const away = (x: number) =>
        Math.min(...foes.map((f) => sc.regionKm(x, f)), 1e9);
      seen.strip = strips.reduce((best, x) =>
        away(x) > away(best) ? x : best,
      );
      out.push(order(HUMAN, { kind: "air_field", region: seen.strip }));
    }
    if (t === T(40 + WW_FIELD_STRIP_DAYS) + 2) {
      const w = air
        .wingsOf(deu)
        .find(
          (x) =>
            x.base > 0 &&
            x.mission < 0 &&
            wingPlanes(x) >= 40 &&
            wingPlanes(x) <= 100,
        )!;
      seen.stripWing = w.id;
      out.push(
        order(HUMAN, { kind: "wing_base", wings: [w.id], base: seen.strip }),
      );
    }
    if (t === T(50)) {
      seen.disband.id = air
        .wingsOf(gbr)
        .find((x) => x.base > 0 && x.mission < 0)!.id;
      out.push(
        order(GBR_PLAYER, { kind: "wing_disband", wing: seen.disband.id }),
      );
    }
    if (t === T(50) + 2) seen.disband.ok = !air.wings.has(seen.disband.id);
    if (t === T(60)) {
      // The paratroopers go for the zone German fighters hold.
      const region = lands.find(
        (r) =>
          enemy(r) &&
          air.airSup(land.sideOf(deu), sc.regionSr(r)) >= 700 &&
          sc.regionKm(ww.capitalRegion(deu), r) <= 600,
      )!;
      out.push(order(HUMAN, { kind: "paradrop", army: s.armyPara, region }));
    }
    if (t === T(71)) {
      // The bomb, carried by the strategic bombers over a zone.
      const c = air
        .wingsOf(deu)
        .find(
          (w) =>
            w.type === ty("strat_bomber") &&
            w.mission === mi("strategic_bombing") &&
            w.target !== 0 &&
            enemy(w.target),
        )!;
      out.push(
        order(HUMAN, { kind: "nuke_drop", region: c.target, rocket: false }),
      );
    }
    if (t === T(80)) {
      const w = raider(g);
      out.push(
        order(HUMAN, {
          kind: "raid",
          raid: "raid_bomb",
          unit: w.id,
          target: w.target,
          building: "radar",
        }),
      );
    }
    if (t === T(120)) {
      // A followed army out of reach: the wing moves up by itself.
      const w = air
        .wingsOf(deu)
        .find((x) => x.follow === s.armyB && x.type === ty("cas"))!;
      const far = lands
        .filter(
          (r) =>
            land.controller[r] === deu &&
            econ.buildingArray("air_base")[r] > 0 &&
            air.baseCapacity(r) - air.baseUse(r) >= wingPlanes(w),
        )
        .sort((a, b) => sc.regionKm(b, s.ourB) - sc.regionKm(a, s.ourB))[0];
      seen.moveUp = { id: w.id, far, ok: false };
      out.push(order(HUMAN, { kind: "wing_base", wings: [w.id], base: far }));
    }
    if (t >= T(120) && t < T(300) && (t - T(120)) % 15 === 0) {
      // Keep that army fighting.
      const a = land.armies.get(s.armyB);
      const row = land.divisions.rowOf(a?.divisions[0] ?? 0);
      if (a !== undefined && row >= 0 && land.divisions.battle[row] === 0) {
        const region = sc.regionNeighbours(land.armyRegion(a)).find(enemy);
        if (region !== undefined) {
          out.push(order(HUMAN, { kind: "army_move", army: a.id, region }));
        }
      }
    }
    if (t === T(149) + 1) {
      out.push(
        order(HUMAN, {
          kind: "army_rail",
          army: railRun.army,
          region: railRun.to,
        }),
      );
    }
  };

  /** Reads the main game after every tick. */
  const watch = (g: Game) => {
    const ww = g.worldWar()!;
    const { air, land, scenario: sc, economy: econ } = ww;
    const t = g.ticks();
    const deu = idOf(g, "DEU");
    const gbr = idOf(g, "GBR");
    const s = stage;
    for (const w of air.wings.values()) {
      if (w.phase === WP_STATION && w.flyMilli > 0) {
        const m = w.flyMission;
        seen.stationed.set(m, (seen.stationed.get(m) ?? 0) + 1);
        if (m === mi("strategic_bombing") && w.night) seen.night++;
        if (m === mi("interception")) seen.interceptorsUp++;
        if (m === mi("cas") && w.follow !== 0) seen.casFollowTicks++;
      }
      seen.maxXp = Math.max(seen.maxXp, w.xpMilli);
      if (w.ace !== 0) seen.aces.add(w.ace);
    }
    for (const z of air.zoneState) {
      for (const [, , h] of z.casNow) seen.casPeak = Math.max(seen.casPeak, h);
      for (const v of z.navalSearch.values()) seen.navalSearch += v;
      for (const v of z.navalStrike.values()) seen.navalStrike += v;
      seen.navalDamage += z.result.get(deu)?.[4] ?? 0;
      for (const [id, r] of z.result) {
        seen.lost.set(id, (seen.lost.get(id) ?? 0) + r[1]);
      }
    }
    if (t % 8 === 0) seen.reconRows += ww.depth.sea.reconBySide.length;
    const side = land.sideOf(deu);
    const zone = sc.regionSr(s.battleA);
    if (t > T(10)) {
      seen.supMin = Math.min(seen.supMin, air.airSup(side, zone));
      seen.supMax = Math.max(seen.supMax, air.airSup(side, zone));
    }
    seen.pocketSupplyPeak = Math.max(
      seen.pocketSupplyPeak,
      air.airSupplyMilli(s.pocket, side),
    );
    const fs = air.wings.get(seen.followSupply);
    if (fs?.mission === WING_NO_MISSION && !land.armies.has(s.armyPocket)) {
      seen.armyGone = true;
    }
    if (t < T(380) && seen.railHit !== 0) {
      seen.railMin = Math.min(seen.railMin, econ.railEff[seen.railHit]);
    }
    for (const id of [deu, gbr, idOf(g, "FRA")]) {
      for (const r of air.country(id)!.reports) {
        if (r.raids > 0) seen.classesHit.add(WW_BOMB_CLASSES[r.cls]);
        seen.raidLost = Math.max(seen.raidLost, r.lost);
        seen.groundPlanes = Math.max(seen.groundPlanes, r.groundPlanes);
        seen.fuelBombed = Math.max(seen.fuelBombed, r.fuelMilli);
        seen.shipsHit = Math.max(seen.shipsHit, r.shipsHit);
      }
    }
    const ce = econ.country(deu)!;
    if (ce.fuelMilli === 0 && seen.fuelEmptyDay === 0) {
      seen.fuelEmptyDay = ww.day(t) - ww.day(START);
    }
    const m = seen.moved;
    const mw = air.wings.get(m.id);
    if (mw?.base === m.to) {
      if (mw.phase === WP_FERRY) m.sawFerry = true;
      if (m.sawFerry && mw.phase === WP_STATION) m.flewAfter = true;
    }
    const sw = air.wings.get(seen.stripWing);
    // (ww9: only while it is still a strip; the economy builds a base there later.)
    if (
      sw?.base === seen.strip &&
      sw.phase !== WP_FERRY &&
      econ.buildingArray("air_base")[seen.strip] === 0
    ) {
      seen.stripEff = wingBaseEffPm(air, sw);
    }
    if (t > T(121) && air.wings.get(seen.moveUp.id)?.base !== seen.moveUp.far) {
      seen.moveUp.ok = seen.moveUp.id !== 0;
    }
    seen.nukes = 0;
    for (const c of ["FRA", "POL", "GBR"] as CountryTag[]) {
      seen.nukes += ww.depth.country(idOf(g, c))?.proj.nukedCount ?? 0;
    }
    if (ww.depth.raids.length > 0) seen.raidsQueued++;
    else if (seen.raidsQueued > 0) seen.raidOver = true;
    if (t === T(90) + 2 && captured !== 0) {
      for (const c of capturedWings) {
        const w = air.wings.get(c.id);
        if (w === undefined) continue;
        if (c.ground) {
          seen.groundAfter = wingPlanes(w);
          seen.groundFerry = w.phase === WP_FERRY && w.base !== captured;
        } else {
          seen.upRebased = w.base !== captured;
        }
      }
    }
    const para = land.armies.get(s.armyPara);
    if (para !== undefined && para.paraLastDay >= 0) seen.paraDropped = true;
    const div = land.divisions;
    for (const id of land.armies.get(railRun.army)?.divisions ?? []) {
      const row = div.rowOf(id);
      if (row >= 0 && div.mode[row] === MOVE_RAIL && div.step[row] > 0) {
        seen.railStep = [div.step[row], railStep(ce.stats.railSpeedPct)];
      }
    }
    if (t % 300 === 0) {
      log(
        `day ${ww.day(t)} wings ${air.wings.size} lost ${air.planesLostTotal} points ${air.bombPointsTotal} battles ${land.battles.size} sup ${air.airSup(side, zone)} fuel D ${ce.fuelMilli} G ${econ.country(gbr)!.fuelMilli}`,
      );
    }
  };

  const report = await runLockstep({
    start: wwGameStart({ ww1936Nukes: true }, [
      { clientID: HUMAN, country: "DEU" },
      { clientID: GBR_PLAYER, country: "GBR" },
    ]),
    files: await worldFiles(),
    until: T(DAYS),
    window: 60,
    wwEvery: 20,
    periodic: 1000,
    graphs: true,
    moments: [
      { name: "all flying", when: (g) => g.ticks() === T(12) },
      { name: "base taken", when: (g) => g.ticks() === T(90) + 1 },
    ],
    hand,
    intents: (g) => {
      main = g;
      out.length = 0;
      if (g.ticks() > START) {
        script(g);
        if (g.ticks() > T(2)) watch(g);
      }
      return [...out];
    },
    log,
  });
  const g = main!;
  const { air } = g.worldWar()!;
  const stations = [...seen.stationed].map(
    ([m, n]) => `${AIR_MISSIONS[m]}:${n}`,
  );
  log(`stationed ${stations.join(" ")}`);
  log(
    JSON.stringify({
      ...seen,
      stationed: undefined,
      classesHit: [...seen.classesHit],
      aces: seen.aces.size,
      lost: [...seen.lost],
      planesLost: air.planesLostTotal,
      bombPoints: air.bombPointsTotal,
      supply,
    }),
  );

  // Nothing refused, nothing thrown; runLockstep throws on any error and on
  // any difference between the copies (the hash every tick, the World War
  // state every 20, the whole snapshot and the object graphs at both ends).
  expect(report.missed).toEqual([]);
  expect(report.restores.length).toBeGreaterThanOrEqual(5);
  expect(seen.refused).toEqual([]);
  // Every mission flew.
  for (const m of AIR_MISSIONS) {
    if (m !== "paradrop") {
      expect(seen.stationed.get(mi(m)) ?? 0, m).toBeGreaterThan(0);
    }
  }
  // Planes fall on both sides; the sky over the contested zone changes hands.
  expect(air.planesLostTotal).toBeGreaterThan(500);
  expect(seen.lost.get(idOf(g, "DEU")) ?? 0).toBeGreaterThan(0);
  expect(seen.lost.get(idOf(g, "GBR")) ?? 0).toBeGreaterThan(0);
  expect(seen.supMin).toBeLessThan(600);
  expect(seen.supMax).toBeGreaterThan(800);
  // Every bomb class hit, and the reports say what it did and what it cost.
  expect(air.bombPointsTotal).toBeGreaterThan(50_000);
  expect([...seen.classesHit].sort()).toEqual([...WW_BOMB_CLASSES].sort());
  expect(seen.raidLost).toBeGreaterThan(0);
  expect(seen.groundPlanes).toBeGreaterThan(0);
  expect(seen.fuelBombed).toBeGreaterThan(0);
  expect(seen.shipsHit).toBeGreaterThan(0);
  // Close air support reached the battles, named and following an army.
  expect(seen.casPeak).toBeGreaterThan(0);
  expect(seen.casFollowTicks).toBeGreaterThan(0);
  // The sea: searched, struck, damaged.
  expect(seen.navalSearch).toBeGreaterThan(0);
  expect(seen.navalStrike).toBeGreaterThan(0);
  expect(seen.navalDamage).toBeGreaterThan(0);
  // Air supply fed the pocket; its army gone, the follower's order ends.
  expect(seen.pocketSupplyPeak).toBeGreaterThan(0);
  expect(seen.armyGone).toBe(true);
  // Recon reached the depth's table; the night raid and interceptors flew.
  expect(seen.reconRows).toBeGreaterThan(0);
  expect(seen.night).toBeGreaterThan(0);
  expect(seen.interceptorsUp).toBeGreaterThan(0);
  expect(seen.maxXp).toBeGreaterThan(300);
  // A paradrop, the bomb, a precision raid.
  expect(seen.paraDropped).toBe(true);
  expect(seen.nukes).toBeGreaterThan(0);
  expect(seen.raidsQueued).toBeGreaterThan(0);
  expect(seen.raidOver).toBe(true);
  // Base moves: a ferry that flew on, a strip, a stand-down, a disband, a
  // followed army out of reach, a base taken.
  expect(seen.moved.flewAfter).toBe(true);
  expect(seen.stripEff).toBe(WW_FIELD_STRIP_EFF_PM);
  expect(seen.standDown.ok).toBe(true);
  expect(seen.disband.ok).toBe(true);
  expect(seen.moveUp.ok).toBe(true);
  const down = capturedWings.find((w) => w.ground)!;
  expect(seen.groundAfter).toBe(down.planes - Math.floor(down.planes / 5));
  expect(seen.groundFerry).toBe(true);
  expect(seen.upRebased).toBe(true);
  // A bombed railway runs lower, slows the train; without rail, less supply.
  expect(seen.railMin).toBeLessThan(seen.railBefore);
  expect(seen.railStep[0]).toBeGreaterThan(0);
  expect(seen.railStep[0]).toBeLessThan(seen.railStep[1]);
  expect(supply[1]).toBeLessThan(supply[0]);
  // The screens get the wing rows.
  air.markWing(air.wingArray()[0].id);
  expect(air.takeData()?.live).toBe(true);
}, 900_000);
