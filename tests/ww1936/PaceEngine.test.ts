// World War 1936, the unlimited game at a slow pace (plan Task 2): the
// human decision windows keep their real seconds (a quarter of the ticks
// at 400 ms a tick), the historical AI plays as the free AI from V-J Day
// (1945-09-02, day 3,532), and the doctrine tally days hold any day.
import type { GameConfig } from "@openfront/engine-api/Schemas";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  equipKey,
  EQUIPMENT_TYPES,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  FLEET_STATES,
  ShipClass,
} from "@openfront/engine-api/ww1936/NavyTypes";
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { dayOfDate, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { WW_HISTORY_END_ISO } from "@openfront/engine-lib/ww1936/Pace";
import type { Game } from "@openfront/engine/game/Game";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { capitulate } from "@openfront/engine/ww1936/Capitulation";
import {
  AI_FOUND_FROM,
  AI_FOUND_TO,
  foundDay,
} from "@openfront/engine/ww1936/depth/AiIntel";
import type {
  DesignSlot,
  WwDepth,
} from "@openfront/engine/ww1936/depth/WwDepth";
import {
  stepConferences,
  submitDemands,
} from "@openfront/engine/ww1936/endgame/Conference";
import { offerTakeover } from "@openfront/engine/ww1936/endgame/Exile";
import { addWarScore } from "@openfront/engine/ww1936/endgame/Wars";
import type { Conference } from "@openfront/engine/ww1936/endgame/WwEndgame";
import { joinBattle, stepBattles } from "@openfront/engine/ww1936/land/Battles";
import { DivisionTable } from "@openfront/engine/ww1936/land/WwLand";
import {
  startNavalBattle,
  stepNavalBattles,
} from "@openfront/engine/ww1936/navy/NavalBattles";
import {
  dailySeaRegion,
  type Fleet,
  ShipTable,
  type WwNavy,
} from "@openfront/engine/ww1936/navy/WwNavy";
import { evalCondition } from "@openfront/engine/ww1936/politics/Conditions";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { makeCtx } from "@openfront/engine/ww1936/politics/Dispatch";
import { vi } from "vitest";
import { DEEP } from "./deepFixture";
import { depthFixture, TEST_TANK } from "./depthFixture";
import { END, endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import { politicsFixture } from "./politicsFixture";
import { REGION, SEA, TAG_ID, ZONE } from "./seaFixture";
import {
  byTag,
  clearLand,
  END_MAP,
  gameHash,
  HUMAN,
  land,
  placeArmy,
  POL,
  stepTo,
  warAfterPrep,
  type WwHuman,
  wwRestore,
  wwRunner,
} from "./util";

afterEach(() => {
  usePoliticsContent(null);
  vi.restoreAllMocks();
});

const TIMED: Partial<GameConfig> = {};
const UNLIMITED: Partial<GameConfig> = { ww1936Unlimited: true };

/** A game of `config` past its preparation minute (`extra` ticks after it). */
async function started(
  config: Partial<GameConfig>,
  humans: WwHuman[],
  map: string,
  extra = 2,
): Promise<GameRunner> {
  const runner = await wwRunner(config, humans, map);
  stepTo(runner, runner.game.worldWar()!.prepEndTick() + extra);
  return runner;
}

describe("the preparation minute keeps its real 60 seconds", () => {
  test.each([
    ["timed", 600, TIMED],
    ["unlimited", 150, UNLIMITED],
  ])("%s: it ends at tick %i", async (_name, ticks, config) => {
    const ww = (await wwRunner(config)).game.worldWar()!;
    expect(ww.prepEndTick()).toBe(ticks);
    expect(ww.data().prepEndTick).toBe(ticks);
  });

  test("an unlimited game's snapshot keeps 150", async () => {
    const runner = await wwRunner(UNLIMITED);
    stepTo(runner, 3);
    const back = await wwRestore(runner);
    expect(back.game.config().wwUnlimited()).toBe(true);
    expect(back.game.worldWar()!.prepEndTick()).toBe(150);
    expect(gameHash(back)).toBe(gameHash(runner));
  });
});

// ---- Event cards ----

const twoWay = (id: string, extra: Partial<EventDef> = {}): EventDef => ({
  id,
  kind: "country",
  options: [
    { id: "a", ai: { base: 1 }, effects: [] },
    { id: "b", ai: { base: 1 }, effects: [] },
  ],
  ...extra,
});

describe("decision windows: a quarter of the ticks in the unlimited game", () => {
  test.each([
    ["timed", 200, 300, TIMED],
    ["unlimited", 50, 75, UNLIMITED],
  ])(
    "%s: an event card waits %i ticks (30-second card: %i)",
    async (_name, short, long, config) => {
      usePoliticsContent(
        politicsFixture({
          events: [
            ...politicsFixture().events,
            twoWay("pace_card"),
            twoWay("pace_card_long", { timeoutSec: 30 }),
          ],
        }),
      );
      const runner = await started(
        config,
        [{ clientID: HUMAN, country: "DEU" }],
        POL,
        5,
      );
      const g = runner.game;
      const p = g.worldWar()!.politics;
      const deu = byTag(g, "DEU").smallID();
      const t0 = g.ticks();
      p.queueEvent("pace_card", deu, deu, 0, 0);
      p.queueEvent("pace_card_long", deu, deu, 0, 0);
      p.flushEvents(t0);
      expect(
        p
          .country(deu)!
          .pending.map((c) => [c.eventId, c.firedTick, c.deadlineTick]),
      ).toEqual([
        ["pace_card", t0, t0 + short],
        ["pace_card_long", t0, t0 + long],
      ]);
    },
  );

  // ---- The peace conference (on ww1936end, its fixture's conference setup) ----

  const R = END.region;

  /** `winner` beats `loser` alone (war score, the regions given): the conference it opened. */
  function beat(
    g: Game,
    loser: CountryTag,
    winners: [CountryTag, number, number[]][],
  ): Conference {
    const ww = g.worldWar()!;
    const eg = ww.endgame;
    expect(ww.setWar(endId(winners[0][0]), endId(loser), g.ticks())).toBe(true);
    const w = eg.war(eg.warOfPair(endId(winners[0][0]), endId(loser)))!;
    for (const [tag] of winners.slice(1)) {
      ww.setWar(endId(tag), endId(loser), g.ticks(), {
        kind: "into",
        warId: w.id,
      });
    }
    for (const [tag, ws, regions] of winners) {
      addWarScore(eg, w.id, endId(tag), ws);
      for (const r of regions) ww.land.setController(r, endId(tag), g.ticks());
    }
    const before = eg.conferences.length;
    const lp = g.playerBySmallID(endId(loser));
    if (!lp.isPlayer()) throw new Error(`no ${loser}`);
    capitulate(g, ww, lp, g.ticks());
    expect(eg.conferences).toHaveLength(before + 1);
    return eg.conferences[before];
  }

  const humansOf = (tags: CountryTag[]): WwHuman[] =>
    tags.map((t) => ({ clientID: `H${t}`, country: t }));

  test.each([
    ["timed", 300, TIMED],
    ["unlimited", 75, UNLIMITED],
  ])(
    "%s: a peace-conference round lasts %i ticks",
    async (_name, round, config) => {
      usePoliticsContent(endgameFixture());
      // Opening: round 1.
      const a = await started(config, humansOf(["DEU"]), END_MAP);
      const g = a.game;
      const c = beat(g, "POL", [["DEU", 1000, [R.warsaw]]]);
      expect(c.roundEndTick - c.openTick).toBe(round);
      // The queued conference opens when the first one ends.
      const q = beat(g, "LTU", [["DEU", 1000, [R.kaunas]]]);
      expect([c.status, q.status]).toEqual([1, 0]);
      const eg = g.worldWar()!.endgame;
      expect(submitDemands(eg, endId("DEU"), c.id, null, g.ticks())).toBeNull();
      const t1 = c.roundEndTick;
      stepConferences(eg, t1);
      expect([c.status, q.status, q.round]).toEqual([2, 1, 1]);
      expect(q.roundEndTick - t1).toBe(round);
      // The next round of the same conference.
      const b = await started(config, humansOf(["DEU", "ITA"]), END_MAP);
      const gb = b.game;
      const egb = gb.worldWar()!.endgame;
      const k = beat(gb, "CSK", [
        ["DEU", 6000, [R.prague]],
        ["ITA", 4000, []],
      ]);
      const t = gb.ticks();
      for (const [tag, region] of [
        ["DEU", R.sudetenland],
        ["ITA", R.slovakia],
      ] as const) {
        expect(
          submitDemands(egb, endId(tag), k.id, [{ kind: "take", region }], t),
        ).toBeNull();
      }
      const t2 = Math.max(t, k.roundEndTick);
      stepConferences(egb, t2);
      expect([k.status, k.round]).toEqual([1, 2]);
      expect(k.roundEndTick - t2).toBe(round);
    },
  );

  test.each([
    ["timed", 300, TIMED],
    ["unlimited", 75, UNLIMITED],
  ])("%s: a takeover card waits %i ticks", async (_name, ticks, config) => {
    usePoliticsContent(endgameFixture());
    const runner = await started(
      config,
      [{ clientID: HUMAN, country: "FRA" }],
      END_MAP,
    );
    const g = runner.game;
    const ww = g.worldWar()!;
    const [deu, fra, gbr] = [endId("DEU"), endId("FRA"), endId("GBR")];
    const tick = g.ticks();
    ww.setWar(deu, fra, tick, { kind: "declare" });
    ww.addCapitulation(fra, deu, tick);
    offerTakeover(ww.endgame, HUMAN, fra, tick);
    expect(ww.endgame.takeoverCards).toEqual([
      {
        client: HUMAN,
        from: fra,
        candidates: [gbr],
        deadlineTick: tick + ticks,
        pick: 0,
      },
    ]);
  });

  test.each([
    ["timed", 200, TIMED],
    ["unlimited", 50, UNLIMITED],
  ])("%s: a licence card waits %i ticks", async (_name, ticks, config) => {
    usePoliticsContent(depthFixture());
    const { DEU, FRA } = DEEP.tag;
    const runner = await started(
      config,
      (["DEU", "FRA", "ITA"] as const).map((country) => ({
        clientID: `HUMAN${country}`,
        country,
      })),
      DEEP.map,
    );
    const d: WwDepth = runner.game.worldWar()!.depth;
    d.country(DEU)!.des.tank[0] = {
      def: TEST_TANK as DesignSlot["def"],
      origin: "own",
      from: 0,
      fromSlot: 0,
      obsolete: false,
      savedDay: 0,
    };
    d.markDesign(DEU, "tank", 1);
    const tick = runner.game.ticks();
    const key = equipKey("tank_design", 1);
    expect(
      d.issue(FRA, { kind: "licence_request", from: DEU, key }, tick),
    ).toBeNull();
    expect(d.market.pending.map((x) => [x.from, x.to, x.deadlineTick])).toEqual(
      [[FRA, DEU, tick + ticks]],
    );
  });
});

// ---- History ends on V-J Day ----

describe("the historical AI plays free from 1945-09-02 (day 3,532)", () => {
  const END_DAY = dayOfDate(WW_HISTORY_END_ISO);

  test.each([true, false])(
    "historicalAiNow with historical AI %s",
    async (historical) => {
      const g = (await wwRunner({ historicalAi: historical })).game;
      const ww = g.worldWar()!;
      expect(END_DAY).toBe(3532);
      expect(ww.historicalAiNow()).toBe(historical);
      const ticks = vi.spyOn(g, "ticks");
      ticks.mockReturnValue(dayStartTick(END_DAY - 1, ww.prepEndTick()));
      expect(ww.day(g.ticks())).toBe(3531);
      expect(ww.historicalAiNow()).toBe(historical);
      ticks.mockReturnValue(dayStartTick(END_DAY, ww.prepEndTick()));
      expect(ww.day(g.ticks())).toBe(3532);
      expect(ww.historicalAiNow()).toBe(false);
    },
  );

  test("the historical_ai condition holds until V-J Day, then fails", async () => {
    for (const historical of [true, false]) {
      const g = (await wwRunner({ historicalAi: historical })).game;
      const ww = g.worldWar()!;
      const deu = byTag(g, "DEU").smallID();
      const on = (day: number) =>
        evalCondition(
          makeCtx(
            ww.politics,
            deu,
            deu,
            0,
            dayStartTick(day, ww.prepEndTick()),
          ),
          { kind: "historical_ai" },
        );
      expect([on(0), on(END_DAY - 1), on(END_DAY)]).toEqual([
        historical,
        historical,
        false,
      ]);
    }
  });

  test("a historical major founds its agency on the free AI's day after V-J Day", async () => {
    const starts = [{ tag: "DEU" as const, date: "1936-03-01" }];
    usePoliticsContent(depthFixture({ agencyStarts: starts }));
    const { DEU } = DEEP.tag;
    const hist = (await wwRunner({}, [], DEEP.map)).game;
    const free = (await wwRunner({ historicalAi: false }, [], DEEP.map)).game;
    const freeDay = foundDay(free.worldWar()!.depth, DEU);
    expect(freeDay).toBeGreaterThanOrEqual(dayOfDate(AI_FOUND_FROM));
    expect(freeDay).toBeLessThanOrEqual(dayOfDate(AI_FOUND_TO));
    expect(freeDay).not.toBe(dayOfDate("1936-03-01"));
    const ww = hist.worldWar()!;
    expect(foundDay(ww.depth, DEU)).toBe(dayOfDate("1936-03-01"));
    vi.spyOn(hist, "ticks").mockReturnValue(
      dayStartTick(END_DAY, ww.prepEndTick()),
    );
    expect(foundDay(ww.depth, DEU)).toBe(freeDay);
  });
});

// ---- Tally days past 32,767 ----

describe("the doctrine tally days are 32-bit", () => {
  const DAY = 40_000;
  const WARSAW = 6;

  test("a division's tally day holds day 40,000 and counts once that day", async () => {
    const runner = await wwRunner({}, [
      { clientID: HUMAN, country: "DEU" },
      { clientID: "HUMAN002", country: "POL" },
    ]);
    warAfterPrep(runner, HUMAN, "POL");
    const g = runner.game;
    clearLand(g);
    for (const tag of ["DEU", "POL"] as const) {
      const ce = land(g).econ.country(byTag(g, tag).smallID())!;
      for (const t of EQUIPMENT_TYPES) ce.stock[equipKey(t, 1)] += 100_000;
      ce.manpower += 1_000_000;
    }
    const l = land(g);
    const d = g.worldWar()!.depth;
    const deu = byTag(g, "DEU").smallID();
    const a = placeArmy(g, "DEU", 3, 2);
    placeArmy(g, "POL", WARSAW, 1);
    for (const id of a.divisions) joinBattle(l, id, WARSAW);
    vi.spyOn(l, "day").mockReturnValue(DAY);
    d.dayTally.fill(0);
    stepBattles(l, g.ticks());
    const r = l.divisions.rowOf(a.divisions[0]);
    expect(l.divisions.tallyDay[r]).toBe(DAY);
    expect(d.dayTally.slice(deu * 9, deu * 9 + 3).some((v) => v > 0)).toBe(
      true,
    );
    // The same day again: the guard skips it.
    expect(l.battles.has(WARSAW)).toBe(true);
    const once = [...d.dayTally];
    stepBattles(l, g.ticks());
    expect(d.dayTally).toEqual(once);
    // A snapshot restore keeps the day.
    const back = new DivisionTable();
    back.restore(l.divisions.snapshot());
    expect(back.tallyDay[r]).toBe(DAY);
  });

  test("a ship's tally day holds day 40,000 and counts once that day", async () => {
    usePoliticsContent(politicsFixture());
    const GBR_H = "HUMAN001";
    const runner = await wwRunner(
      {},
      [
        { clientID: GBR_H, country: "GBR" },
        { clientID: "HUMAN002", country: "ITA" },
      ],
      SEA.map,
    );
    warAfterPrep(runner, GBR_H, "ITA");
    const navy: WwNavy = runner.game.worldWar()!.navy;
    const tick = runner.game.ticks();
    const port: Record<number, number> = {
      [TAG_ID.GBR]: REGION.london,
      [TAG_ID.ITA]: REGION.rome,
    };
    const atSea = (
      owner: number,
      comp: readonly (readonly [ShipClass, number, number])[],
    ): Fleet => {
      const f = navy.fleets.get(navy.createFleet(owner, port[owner], comp))!;
      f.docked = 0;
      f.state = FLEET_STATES.indexOf("on_station");
      navy.setFleetZone(f, ZONE.west);
      return f;
    };
    const gb = atSea(TAG_ID.GBR, [["bb", 1, 1]]);
    const it = atSea(TAG_ID.ITA, [["bb", 1, 1]]);
    startNavalBattle(navy, ZONE.west, navy.sideOf(TAG_ID.GBR), it.id, tick);
    // The first round puts both fleets in the battle state.
    stepNavalBattles(navy, tick);
    const battle = FLEET_STATES.indexOf("battle");
    expect([gb.state, it.state]).toEqual([battle, battle]);
    const note = vi.spyOn(navy.ww.depth, "noteNavalCombat");
    const inBattle = () => note.mock.calls.filter((c) => c[2]).length;
    const sr = navy.scenario.zoneSr(ZONE.west);
    dailySeaRegion(navy, sr, DAY, tick);
    expect(inBattle()).toBe(2);
    const r = navy.ships.rowOf(gb.ships[0]);
    expect(navy.ships.tallyDay[r]).toBe(DAY);
    // The same day again: the guard skips it.
    dailySeaRegion(navy, sr, DAY, tick);
    expect(inBattle()).toBe(2);
    // A snapshot restore keeps the day.
    const back = new ShipTable();
    back.restore(navy.ships.snapshot());
    expect(back.tallyDay[r]).toBe(DAY);
  });
});
