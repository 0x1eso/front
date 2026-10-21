// World War 1936 P5 lane A (plan Task 6 Step 7; spec §14): captured
// equipment, by direct calls on the end map. France (human) and Britain
// are one side (the Allies), the Soviet Union the loser.
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_EQUIP_KEYS,
  GROUND_SLOTS,
  groundSlotOf,
} from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  captureOnBattleEnd,
  captureOnCapitulation,
  captureOnEncircled,
} from "@openfront/engine/ww1936/endgame/Capture";
import type { Battle } from "@openfront/engine/ww1936/land/WwLand";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { messages } from "./convoyUtil";
import { endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import { END_MAP, placeArmy, stepTo, wwRunnerCapture } from "./util";

beforeEach(() => usePoliticsContent(endgameFixture()));
afterEach(() => usePoliticsContent(null));

const KIEV = 9;
const INF1 = equipKey("infantry_equipment", 1);
const ART2 = equipKey("artillery", 2);

async function game() {
  const { runner, updates } = await wwRunnerCapture(
    {},
    [{ clientID: "HUMANFRA", country: "FRA" }],
    END_MAP,
  );
  stepTo(runner, WW_PREP_TICKS + 1);
  const g = runner.game;
  const ww = g.worldWar()!;
  const [gbr, fra, sun] = [endId("GBR"), endId("FRA"), endId("SUN")];
  expect(ww.land.sameSide(gbr, fra)).toBe(true);
  const stock = (id: number, key: number) => ww.economy.country(id)!.stock[key];
  return { runner, updates, g, ww, eg: ww.endgame, gbr, fra, sun, stock };
}

/** A battle at Kiev France led and won (side 0); the Soviet defenders lost 400 rifles and 100 guns of gen 2. */
function wonBattle(gbr: number, fra: number, sun: number): Battle {
  const capEq = new Array<number>(GROUND_SLOTS * 2).fill(0);
  capEq[GROUND_SLOTS + groundSlotOf(INF1)] = 400_000;
  capEq[GROUND_SLOTS + groundSlotOf(ART2)] = 100_000;
  // The winners' own losses are nobody's to take.
  capEq[groundSlotOf(INF1)] = 999_000;
  return {
    region: KIEV,
    sinceTick: 0,
    round: 3,
    attackers: [],
    defenders: [],
    attLine: [],
    defLine: [],
    startOrgMilli: 0,
    lostOrgMilli: 0,
    attLead: fra,
    defLead: sun,
    capEq,
    dmgBy: [
      [gbr, 300],
      [fra, 600],
      [sun, 900],
    ],
  };
}

describe("World War 1936 P5: captured equipment", () => {
  it("the battle winner captures 5% of the loser's lost equipment", async () => {
    const { runner, updates, ww, eg, gbr, fra, sun, stock } = await game();
    expect(ww.economy.country(fra)!.stats.capturePct).toBe(0);
    expect(ww.economy.country(gbr)!.stats.capturePct).toBe(0);
    const before = [INF1, ART2].map((k) =>
      [gbr, fra, sun].map((c) => stock(c, k)),
    );
    captureOnBattleEnd(eg, wonBattle(gbr, fra, sun), 0);
    // 5% of 400 is 20: France dealt 2/3 (266,667 milli with the
    // remainder) → 13, Britain 1/3 → 6 (each rounded down).
    expect(stock(fra, INF1) - before[0][1]).toBe(13);
    expect(stock(gbr, INF1) - before[0][0]).toBe(6);
    // Same equipment, same generation: 5 guns of gen 2 → 3 and 1.
    expect(stock(fra, ART2) - before[1][1]).toBe(3);
    expect(stock(gbr, ART2) - before[1][0]).toBe(1);
    expect(stock(sun, INF1)).toBe(before[0][2]);
    expect(stock(sun, ART2)).toBe(before[1][2]);
    // France's day: one line, at Kiev (lane T's {region}).
    const d = ww.day(runner.game.ticks());
    stepTo(runner, dayStartTick(d, ww.prepEndTick()) + (fra % 7) + 1);
    expect(
      messages(updates, "events_display.ww1936_captured").map((m) => m.params),
    ).toEqual([
      {
        region: KIEV,
        items: `${groundSlotOf(INF1)}:${KIEV}:13,${groundSlotOf(ART2)}:${KIEV}:3`,
      },
    ]);
  });

  it("an encircled division gives 20%", async () => {
    const { g, ww, eg, fra, sun, stock } = await game();
    const a = placeArmy(g, "SUN", KIEV, 1);
    const row = ww.land.divisions.rowOf(a.divisions[0]);
    const eq = Array.from(ww.land.divisions.equipOf(row));
    expect(eq.some((n) => n >= 5)).toBe(true);
    const before = GROUND_EQUIP_KEYS.map((k) => stock(fra, k));
    captureOnEncircled(eg, row, fra);
    for (let j = 0; j < GROUND_SLOTS; j++) {
      expect(stock(fra, GROUND_EQUIP_KEYS[j]) - before[j]).toBe(
        Math.floor(eq[j] / 5),
      );
    }
    void sun;
  });

  it("capturePct adds to the share", async () => {
    const { g, ww, eg, gbr, fra, sun, stock } = await game();
    ww.economy.country(fra)!.stats.capturePct = 10;
    const inf = stock(fra, INF1);
    const gb = stock(gbr, INF1);
    captureOnBattleEnd(eg, wonBattle(gbr, fra, sun), 0);
    // 15% for France: 266,667 milli × 15% → 40; Britain still 5% → 6.
    expect(stock(fra, INF1) - inf).toBe(40);
    expect(stock(gbr, INF1) - gb).toBe(6);
    // Encircled: 30%.
    const a = placeArmy(g, "SUN", KIEV, 1);
    const row = ww.land.divisions.rowOf(a.divisions[0]);
    const eq = Array.from(ww.land.divisions.equipOf(row));
    const before = GROUND_EQUIP_KEYS.map((k) => stock(fra, k));
    captureOnEncircled(eg, row, fra);
    for (let j = 0; j < GROUND_SLOTS; j++) {
      expect(stock(fra, GROUND_EQUIP_KEYS[j]) - before[j]).toBe(
        Math.floor((eq[j] * 3) / 10),
      );
    }
  });

  it("a capitulation gives the victor a quarter of the stock and half of the divisions' equipment", async () => {
    const { ww, eg, stock } = await game();
    const [pl, deu] = [endId("POL"), endId("DEU")];
    const l = ww.land;
    const div = new Array<number>(GROUND_SLOTS).fill(0);
    for (const r of l.rowsOf(pl)) {
      const eq = l.divisions.equipOf(r);
      for (let j = 0; j < GROUND_SLOTS; j++) div[j] += eq[j];
    }
    const keys = [INF1, ART2, equipKey("fighter", 1)];
    const lost = keys.map((k) => stock(pl, k));
    const had = keys.map((k) => stock(deu, k));
    captureOnCapitulation(eg, pl, deu);
    keys.forEach((k, i) => {
      const j = groundSlotOf(k);
      const fromDivs = j < 0 ? 0 : Math.floor(div[j] / 2);
      expect(stock(deu, k) - had[i]).toBe(Math.floor(lost[i] / 4) + fromDivs);
    });
    // The loser's own stock is the caller's (lane X): untouched here.
    expect(keys.map((k) => stock(pl, k))).toEqual(lost);
    // An exile's capitulation is lane X's: nothing here.
    eg.exiles.push({
      smallID: pl,
      host: endId("GBR"),
      legitBp: 5000,
      sinceDay: 0,
      zeroDays: 0,
      lastDelta: 0,
      faction: -1,
      capital: 6,
    });
    eg.rebuildDerived();
    const now = keys.map((k) => stock(deu, k));
    captureOnCapitulation(eg, pl, deu);
    expect(keys.map((k) => stock(deu, k))).toEqual(now);
  });
});
