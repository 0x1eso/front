// The air overhaul's flip (ww8): the wing model running for real. The world1936
// map, 400 days: Germany and Britain are humans at war, France and Poland are
// AI and fly their own wings, restored copies run beside the game. Every air
// order goes in as a player's intent; the test's hand only sets the stage. The
// hand keeps the two humans in fuel, so the air war runs to the last day and
// is read in 50-day slices, and takes it from Germany for a spell to show what
// that does. WINGS_LIVE_LOG=<file> writes the numbers.
import type { StampedIntent, WwOrder } from "@openfront/engine-api/Schemas";
import {
  AIR_MISSIONS,
  AIR_TYPES,
  type AirMission,
  type AirType,
  type Wing,
  WING_NO_MISSION,
  WING_OVERRUN_LOSS_PCT,
  WP_FERRY,
  WP_GROUND,
  WP_STATION,
  WW_BOMB_CLASSES,
  WW_FIELD_STRIP_DAYS,
  WW_FIELD_STRIP_EFF_PM,
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
import { bombTableOf, tableWeight } from "@openfront/engine/ww1936/air/Bombing";
import { wingStats } from "@openfront/engine/ww1936/air/Sorties";
import { wingBaseEffPm } from "@openfront/engine/ww1936/air/Wings";
import { wingPlanes } from "@openfront/engine/ww1936/air/WwAir";
import { damageBuilding } from "@openfront/engine/ww1936/economy/Buildings";
import { navalPort } from "@openfront/engine/ww1936/navy/Ports";
import { removeSpirit } from "@openfront/engine/ww1936/politics/Spirits";
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
import { giveWing } from "./wingUtil";

const GBR_PLAYER = "HUMAN002";
const START = 601;
/** The tick `d` days after the war starts. */
const T = (d: number) => START + Math.floor((d * 15) / 2);
const DAYS = 400;
/** The days of a slice, and the tank the hand fills the two humans to. */
const SLICE_DAYS = 50;
const FUEL = 40_000_000;
/** Germany's dry spell, in days; the wet days before it are the measure. */
const DRY_FROM = 320;
const DRY_TO = 340;
const DRY_SETTLE = 2;
/** The first day of fresh German divisions on the front, one lot a slice. */
const FRESH_FROM = 115;
/** How often the players send their bombers on to what still works. */
const RETARGET_DAYS = 30;
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

/** Our first region touching an enemy of ours, in id order. */
function frontOf(g: Game, me: number): number {
  const { land, scenario: sc } = g.worldWar()!;
  for (const r of sc.landRegions) {
    if (land.controller[r.id] !== me) continue;
    for (const e of sc.edgesOf(r.id)) {
      if (land.isEnemy(me, land.controller[e.to] ?? 0)) return r.id;
    }
  }
  throw new Error(`no front for ${me}`);
}

/** Where the stage stands (found from the game, the same in every copy). */
let stage = {
  battleA: 0,
  battleB: 0,
  ourB: 0,
  pocket: 0,
  armyA: 0,
  armyB: 0,
  armyFight: 0,
  casWing: 0,
  armyPocket: 0,
  armyPara: 0,
  zoneFleet: 0,
  port: 0,
};
let railRun = { army: 0, to: 0 };
const supply = [0, 0];
/** The German base that falls: its two wings, the tick it fell, what the one on the ground should keep. */
let fall = { base: 0, up: 0, down: 0, taken: 0, keeps: 0 };

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
    // ww91 N3: Germany's shorter air range would leave the scripted fighter
    // meeting out of reach; this test is about wings, not the range key.
    removeSpirit(ww.politics, deu, "nat_deu_sea_air");
    for (const id of [deu, gbr]) {
      const ce = econ.country(id)!;
      for (const [type, n] of STOCK) ce.stock[equipKey(type, 1)] += n;
    }
    // Room for them near the front.
    econ.addBuilding(borderOf(g, deu, pol)[0], "air_base", 3);
    econ.addBuilding(borderOf(g, deu, fra)[0], "air_base", 20);
    econ.addBuilding(ww.capitalRegion(gbr), "air_base", 20);
  }
  // Fuel for the whole run, but for Germany's dry spell.
  if ((t - START) % (T(10) - START) === 0) {
    for (const id of [deu, gbr]) {
      const ce = econ.country(id)!;
      ce.fuelMilli = Math.max(ce.fuelMilli, FUEL);
    }
  }
  if (t >= T(DRY_FROM) && t < T(DRY_TO)) econ.country(deu)!.fuelMilli = 0;
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
      armyFight: armyB,
      casWing: 0,
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
  if (
    t >= T(FRESH_FROM) &&
    (t - T(FRESH_FROM)) % (T(SLICE_DAYS) - START) === 0
  ) {
    // Fresh divisions on the front, so close air support has work to the end.
    const ce = econ.country(deu)!;
    ce.manpower += 300_000;
    for (const e of GROUND_EQUIPMENT) ce.stock[equipKey(e, 1)] += 10_000;
    stage.armyFight = placeArmy(g, "DEU", frontOf(g, deu), 10).id;
  }
  if (t === T(75)) {
    // A new German base behind the line, and two wings of its own.
    const base = sc.landRegions
      .map((r) => r.id)
      .filter(
        (r) =>
          land.controller[r] === deu &&
          r !== ww.capitalRegion(deu) &&
          r !== stage.pocket &&
          econ.buildingArray("air_base")[r] === 0 &&
          !air.strips.has(r) &&
          land.rowsIn(r).length === 0,
      )[0];
    econ.addBuilding(base, "air_base", 3);
    const [up, down] = [0, 1].map(
      () => giveWing(air, { owner: deu, type: "fighter", planes: 60, base }).id,
    );
    fall = { base, up, down, taken: 0, keeps: 0 };
  }
  if (t >= T(90) && fall.base !== 0) {
    // It falls with one wing in the air and one on the ground.
    const up = air.wings.get(fall.up);
    const down = air.wings.get(fall.down);
    if (
      up?.base === fall.base &&
      up.phase === WP_STATION &&
      down?.base === fall.base &&
      down.phase === WP_GROUND
    ) {
      fall.keeps = 0;
      for (const n of [...down.counts, ...down.dcounts]) {
        fall.keeps += n - Math.floor((n * WING_OVERRUN_LOSS_PCT) / 100);
      }
      fall.taken = t;
      takeRegion(g, fall.base, "POL");
    }
  }
  if (t === T(116)) {
    // A base and a wing with the fresh army.
    const base = land.armyRegion(land.armies.get(stage.armyFight)!);
    econ.addBuilding(base, "air_base", 2);
    stage.casWing = giveWing(air, {
      owner: deu,
      type: "cas",
      planes: 100,
      base,
    }).id;
  }
  if (t === T(119)) {
    // A far base for the wing following the army.
    const from = land.armyRegion(land.armies.get(stage.armyFight)!);
    const far = sc.landRegions
      .map((r) => r.id)
      .filter((r) => land.controller[r] === deu)
      .sort((a, b) => sc.regionKm(b, from) - sc.regionKm(a, from))[0];
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
    slices: Array.from({ length: Math.ceil(DAYS / SLICE_DAYS) }, () => ({
      deu: 0,
      gbr: 0,
      ai: 0,
      battles: 0,
      planesLost: 0,
      points: 0,
    })),
    wet: { milli: 0, ticks: 0 },
    dry: { milli: 0, ticks: 0 },
    dryRatio: 1000,
    retargeted: 0,
    maxXp: 0,
    aces: new Set<number>(),
    paraDropped: false,
    nukeQueued: false,
    nukeFlown: false,
    raidsQueued: 0,
    raidOver: false,
    strip: 0,
    stripWing: 0,
    stripEff: 0,
    moved: { id: 0, to: 0, sawFerry: false, flewAfter: false },
    standDown: { id: 0, ok: false },
    disband: { id: 0, ok: false },
    moveUp: { id: 0, far: 0, landed: false, ok: false },
    groundAfter: 0,
    groundFerry: false,
    upRebased: false,
    followSupply: 0,
    refused: [] as string[],
  };
  let main: Game | null = null;
  const used = new Set<number>();
  const expected: { id: number; mission: number; what: string }[] = [];
  const sentOn: { id: number; target: number }[] = [];
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
    const { air, scenario: sc, land } = g.worldWar()!;
    const owner = idOf(g, tag);
    // No capacity limit (w50) forms few, full wings at one base: when none
    // of the type reaches, a new wing stands at the own base nearest the target.
    const reaches = (w: Wing) =>
      w.type === ty(type) &&
      w.base > 0 &&
      !used.has(w.id) &&
      targets.some((r) => sc.targetKm(w.base, r) <= wingStats(air, w).rangeKm);
    if (!air.wingsOf(owner).some(reaches)) {
      let base = 0;
      for (const r of sc.landRegions.map((x) => x.id)) {
        if (
          land.controller[r] === owner &&
          air.baseUsable(r) &&
          (base === 0 ||
            sc.targetKm(r, targets[0]) < sc.targetKm(base, targets[0]))
        ) {
          base = r;
        }
      }
      giveWing(air, { owner, type: ty(type), planes: 60, base });
    }
    for (const w of air.wingsOf(owner)) {
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
    if (t > T(3) && (t - T(3)) % (T(RETARGET_DAYS) - START) === 0) {
      // The front moves and what was bombed stops working: a player sends the
      // bombers with nothing left to hit on to the nearest thing that does.
      sentOn.length = 0;
      for (const [tag, client] of [
        ["DEU", HUMAN],
        ["GBR", GBR_PLAYER],
      ] as const) {
        const owner = idOf(g, tag);
        for (const w of air.wingsOf(owner)) {
          if (w.mission !== mi("strategic_bombing") || w.base <= 0) continue;
          const table = (r: number) =>
            bombTableOf(
              WW_BOMB_CLASSES[w.cls],
              (sc.region(r)?.res[0] ?? 0) > 0,
            );
          const works = (r: number) =>
            land.isEnemy(owner, land.controller[r] ?? 0) &&
            tableWeight(econ, r, table(r)) > 0;
          if (works(w.target)) continue;
          const range = wingStats(air, w).rangeKm;
          const next = lands
            .filter(
              (r) =>
                works(r) &&
                sc.targetKm(w.base, r) <= range &&
                bombClassHits(
                  WW_BOMB_CLASSES[w.cls],
                  (b) => econ.buildingArray(b)[r] ?? 0,
                  (sc.region(r)?.res[0] ?? 0) > 0,
                ),
            )
            .sort(
              (a, b) =>
                sc.targetKm(w.base, a) - sc.targetKm(w.base, b) || a - b,
            )[0];
          if (next === undefined) continue;
          sentOn.push({ id: w.id, target: next });
          out.push(
            order(client, {
              kind: "wing_mission",
              wings: [w.id],
              mission: "strategic_bombing",
              target: next,
              cls: WW_BOMB_CLASSES[w.cls],
            }),
          );
        }
      }
      seen.retargeted += sentOn.length;
      log(`day ${ww.day(t)}: ${sentOn.length} bomber wings sent on`);
    }
    if (t > T(3) + 2 && (t - T(3) - 2) % (T(RETARGET_DAYS) - START) === 0) {
      for (const e of sentOn) {
        const w = air.wings.get(e.id);
        // A region taken in the same days is rightly refused: no enemy there.
        if (
          w !== undefined &&
          w.target !== e.target &&
          land.isEnemy(w.owner, land.controller[e.target] ?? 0)
        ) {
          seen.refused.push(`sent on: wing ${e.id}`);
        }
      }
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
    if (t === T(76)) {
      out.push(
        order(HUMAN, {
          kind: "wing_mission",
          wings: [fall.up],
          mission: "air_superiority",
          target: fall.base,
        }),
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
    if (t === T(118)) {
      // A wing follows the fresh army.
      seen.moveUp.id = s.casWing;
      out.push(
        order(HUMAN, {
          kind: "wing_mission",
          wings: [s.casWing],
          mission: "cas",
          target: land.armyRegion(land.armies.get(s.armyFight)!),
          army: s.armyFight,
        }),
      );
    }
    if (t === T(120)) {
      // Sent far from it: out of reach, it moves up by itself.
      const w = air.wings.get(seen.moveUp.id)!;
      if (w.follow !== s.armyFight) seen.refused.push("cas: follow");
      const from = land.armyRegion(land.armies.get(s.armyFight)!);
      const far = lands
        .filter(
          (r) =>
            land.controller[r] === deu &&
            econ.buildingArray("air_base")[r] > 0 &&
            air.baseCapacity(r) - air.baseUse(r) >= wingPlanes(w),
        )
        .sort((a, b) => sc.regionKm(b, from) - sc.regionKm(a, from))[0];
      seen.moveUp.far = far;
      log(
        `move up: wing ${w.id} to ${far}, ${sc.targetKm(far, from)} km from the army, reach ${wingStats(air, w).rangeKm}`,
      );
      out.push(order(HUMAN, { kind: "wing_base", wings: [w.id], base: far }));
    }
    if (t > T(FRESH_FROM) && (t - T(FRESH_FROM) - 1) % 15 === 0) {
      // Keep the followed army and the one on the front fighting.
      for (const id of new Set([s.armyB, s.armyFight])) {
        const a = land.armies.get(id);
        const row = land.divisions.rowOf(a?.divisions[0] ?? 0);
        if (a !== undefined && row >= 0 && land.divisions.battle[row] === 0) {
          const region = sc.regionNeighbours(land.armyRegion(a)).find(enemy);
          if (region !== undefined) {
            out.push(order(HUMAN, { kind: "army_move", army: a.id, region }));
          }
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
    const slice =
      seen.slices[Math.floor((t - START) / (T(SLICE_DAYS) - START))];
    let deuUp = 0;
    for (const w of air.wings.values()) {
      if (w.phase === WP_STATION && w.flyMilli > 0) {
        const m = w.flyMission;
        if (w.owner === deu) {
          slice.deu += w.flyMilli;
          deuUp += w.flyMilli;
        } else if (w.owner === gbr) slice.gbr += w.flyMilli;
        else slice.ai += w.flyMilli;
        seen.stationed.set(m, (seen.stationed.get(m) ?? 0) + 1);
        if (m === mi("strategic_bombing") && w.night) seen.night++;
        if (m === mi("interception")) seen.interceptorsUp++;
        if (m === mi("cas") && w.follow !== 0) seen.casFollowTicks++;
      }
      seen.maxXp = Math.max(seen.maxXp, w.xpMilli);
      if (w.ace !== 0) seen.aces.add(w.ace);
    }
    if (land.battles.size > 0) slice.battles++;
    slice.planesLost = air.planesLostTotal;
    slice.points = air.bombPointsTotal;
    if (t >= T(DRY_FROM - 20) && t < T(DRY_FROM)) {
      seen.wet.milli += deuUp;
      seen.wet.ticks++;
    }
    if (t >= T(DRY_FROM + DRY_SETTLE) && t < T(DRY_TO)) {
      seen.dry.milli += deuUp;
      seen.dry.ticks++;
      seen.dryRatio = Math.min(seen.dryRatio, econ.country(deu)!.fuelRatioPm);
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
    const up = air.wings.get(seen.moveUp.id);
    if (up?.base === seen.moveUp.far) seen.moveUp.landed = true;
    else if (seen.moveUp.landed && (up?.follow ?? 0) > 0) seen.moveUp.ok = true;
    // ww107: it may land or be intercepted, by the seeded roll over the zone.
    if (ww.depth.nukeQueue.length > 0) seen.nukeQueued = true;
    else if (seen.nukeQueued) seen.nukeFlown = true;
    if (ww.depth.raids.length > 0) seen.raidsQueued++;
    else if (seen.raidsQueued > 0) seen.raidOver = true;
    if (fall.taken !== 0 && t === fall.taken + 2) {
      const down = air.wings.get(fall.down);
      seen.groundAfter = down === undefined ? 0 : wingPlanes(down);
      seen.groundFerry = down?.phase === WP_FERRY && down.base !== fall.base;
      const up = air.wings.get(fall.up);
      seen.upRebased = up !== undefined && up.base !== fall.base;
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
      {
        name: "base taken",
        when: (g) => fall.taken !== 0 && g.ticks() === fall.taken + 1,
      },
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
  // The air war runs to the end: in every slice both humans and the AI fly,
  // planes fall, bombs land and the ground war goes on under them.
  expect(seen.retargeted).toBeGreaterThan(0);
  seen.slices.forEach((s, i) => {
    const was = seen.slices[i - 1] ?? { planesLost: 0, points: 0 };
    expect(s.deu, `Germany, slice ${i}`).toBeGreaterThan(0);
    expect(s.gbr, `Britain, slice ${i}`).toBeGreaterThan(0);
    expect(s.ai, `the AI, slice ${i}`).toBeGreaterThan(0);
    expect(s.battles, `battles, slice ${i}`).toBeGreaterThan(0);
    expect(s.planesLost, `losses, slice ${i}`).toBeGreaterThan(was.planesLost);
    expect(s.points, `bombs, slice ${i}`).toBeGreaterThan(was.points);
  });
  // Without fuel fewer of Germany's planes get up.
  expect(seen.dryRatio).toBeLessThan(1000);
  expect(seen.dry.milli * 10 * seen.wet.ticks).toBeLessThan(
    seen.wet.milli * 9 * seen.dry.ticks,
  );
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
  expect(seen.nukeFlown).toBe(true);
  expect(seen.raidsQueued).toBeGreaterThan(0);
  expect(seen.raidOver).toBe(true);
  // Base moves: a ferry that flew on, a strip, a stand-down, a disband, a
  // followed army out of reach, a base taken.
  expect(seen.moved.flewAfter).toBe(true);
  expect(seen.stripEff).toBe(WW_FIELD_STRIP_EFF_PM);
  expect(seen.standDown.ok).toBe(true);
  expect(seen.disband.ok).toBe(true);
  expect(seen.moveUp.ok).toBe(true);
  expect(fall.taken).toBeGreaterThan(0);
  expect(seen.groundAfter).toBe(fall.keeps);
  expect(seen.groundFerry).toBe(true);
  expect(seen.upRebased).toBe(true);
  // A bombed railway runs lower, slows the train; without rail, less supply.
  expect(seen.railMin).toBeLessThan(seen.railBefore);
  expect(seen.railStep[0]).toBeGreaterThan(0);
  expect(seen.railStep[0]).toBeLessThan(seen.railStep[1]);
  expect(supply[1]).toBeLessThan(supply[0]);
  // The screens get the wing rows.
  air.markWing(air.wingArray()[0].id);
  expect(air.takeData()?.briefs?.length).toBeGreaterThan(0);
}, 900_000);
