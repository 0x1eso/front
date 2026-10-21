// World War 1936 P5 lane X (plan Task 5 Steps 3–4, spec §5.2, §10):
// governments in exile — the host, the forces that escape, legitimacy,
// liberated land, the return home and the collapse.
import { AIR_TYPES } from "@openfront/engine-api/ww1936/AirTypes";
import {
  EQUIP_KEYS,
  equipKey,
  EQUIPMENT_TYPES,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  WW_CAPITULATION_STOCK_TO_VICTOR_PCT,
  WW_DISBANDED_EQUIP_TO_VICTOR_PCT,
  WW_EXILE_LEGIT_START_BP,
  WW_EXILE_MANPOWER_KEEP_PCT,
  WW_EXILE_STOCK_KEEP_PCT,
  WW_EXILE_ZERO_DAYS,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import {
  GROUND_EQUIP_KEYS,
  GROUND_SLOTS,
} from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { GameRunner } from "@openfront/engine/GameRunner";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import {
  capitulationForces,
  formExile,
  pickHost,
  stepExile,
} from "@openfront/engine/ww1936/endgame/Exile";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { joinFaction } from "@openfront/engine/ww1936/politics/Factions";
import { endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import {
  clearLand,
  END_MAP,
  placeArmy,
  stepTo,
  takeRegion,
  wwRunner,
} from "./util";

afterEach(() => usePoliticsContent(null));

const AIR = new Set<string>(AIR_TYPES);

async function started() {
  const runner = await wwRunner({}, [], END_MAP);
  stepTo(runner, WW_PREP_TICKS + 2);
  return { runner, g: runner.game, ww: runner.game.worldWar()! };
}

/** Men and equipment for `tag`'s test divisions. */
function supply(ww: WorldWar, id: number): void {
  const ce = ww.economy.country(id)!;
  for (const t of EQUIPMENT_TYPES) ce.stock[equipKey(t, 1)] += 100_000;
  ce.manpower += 1_000_000;
}

/** Through the next day's common step (and every country's turn of it). */
function nextDay(runner: GameRunner): void {
  const ww = runner.game.worldWar()!;
  const day = ww.day(runner.game.ticks());
  stepTo(runner, dayStartTick(day + 1, WW_PREP_TICKS) + 8);
}

/**
 * Germany at war with Poland, Lithuania on Poland's side (a minor host);
 * Poland capitulated, Germany holding Warsaw and Krakow, Poland in exile.
 */
async function polandInExile() {
  const s = await started();
  const { g, ww } = s;
  const eg = ww.endgame;
  const [deu, pl, ltu] = [endId("DEU"), endId("POL"), endId("LTU")];
  clearLand(g);
  const tick = g.ticks();
  ww.setWar(deu, pl, tick, { kind: "declare" });
  ww.setWar(deu, ltu, tick, { kind: "into", warId: eg.warOfPair(deu, pl) });
  takeRegion(g, 6, "DEU");
  takeRegion(g, 7, "DEU");
  ww.addCapitulation(pl, deu, tick);
  expect(formExile(eg, pl, deu, tick)).toBe(true);
  expect(eg.exiles[eg.exileIdx.get(pl)!].host).toBe(ltu);
  return { ...s, eg, deu, pl, ltu };
}

describe("World War 1936 P5: governments in exile", () => {
  beforeEach(() => usePoliticsContent(endgameFixture()));

  it("exile divisions in allied land survive and move to the host", async () => {
    const { g, ww } = await started();
    const eg = ww.endgame;
    const t = ww.land.divisions;
    const [deu, pl, gbr] = [endId("DEU"), endId("POL"), endId("GBR")];
    clearLand(g);
    supply(ww, pl);
    const tick = g.ticks();
    ww.setWar(deu, pl, tick, { kind: "declare" });
    const war = eg.warOfPair(deu, pl);
    ww.setWar(deu, gbr, tick, { kind: "into", warId: war });
    // Two Polish divisions in London; seven at home: the first encircled,
    // the next four at half strength, the last two whole.
    const abroad = placeArmy(g, "POL", 10, 2).divisions.map((d) => t.rowOf(d));
    const home = placeArmy(g, "POL", 6, 7).divisions.map((d) => t.rowOf(d));
    t.encircled[home[0]] = 1;
    for (const r of home.slice(1, 5)) ww.land.setMen(r, t.men[r] >> 1);
    // Nothing in training or in the air (the stock below is all there is).
    const cl = ww.land.country(pl)!;
    cl.training = [];
    cl.trainees = [];
    for (const d of ww.air.deploymentsOf(pl)) {
      ww.air.removeDeployment(d.id, true);
    }
    const ceL = ww.economy.country(pl)!;
    const ceR = ww.economy.country(deu)!;
    const lostRows = home.slice(0, 5);
    const stockL = [...ceL.stock];
    const stockR = [...ceR.stock];
    const menL = ceL.manpower;
    const wantR = [...stockR];
    for (const r of lostRows) {
      for (let j = 0; j < GROUND_SLOTS; j++) {
        wantR[GROUND_EQUIP_KEYS[j]] += Math.floor(
          (t.equip[r * GROUND_SLOTS + j] * WW_DISBANDED_EQUIP_TO_VICTOR_PCT) /
            100,
        );
      }
    }
    EQUIP_KEYS.forEach(([type], k) => {
      if (AIR.has(type)) return;
      wantR[k] += Math.floor(
        (stockL[k] * WW_CAPITULATION_STOCK_TO_VICTOR_PCT) / 100,
      );
    });
    const ids = (rows: number[]) => rows.map((r) => t.id[r]);
    const saved = [...ids(abroad), ...ids(home.slice(5))];
    const lost = ids(lostRows);
    ww.addCapitulation(pl, deu, tick);
    expect(formExile(eg, pl, deu, tick)).toBe(true);
    expect(eg.exiles[eg.exileIdx.get(pl)!].host).toBe(gbr);
    expect(eg.member(eg.war(war)!, pl)!.state).toBe("exiled");
    capitulationForces(eg, pl, deu, gbr, tick);
    const alive = ww.land.rowsOf(pl).map((r) => t.id[r]);
    expect([...alive].sort((a, b) => a - b)).toEqual(
      [...saved].sort((a, b) => a - b),
    );
    for (const id of lost) expect(t.rowOf(id)).toBe(-1);
    for (const r of ww.land.rowsOf(pl)) {
      expect(t.region[r]).toBe(10); // London, Britain's capital
      expect(t.org[r]).toBe(0);
    }
    // Spec §5.2: half the stock stays, a quarter to Germany with half the
    // disbanded divisions' equipment; a quarter of the men.
    EQUIP_KEYS.forEach((_, k) => {
      expect(ceL.stock[k]).toBe(
        Math.floor((stockL[k] * WW_EXILE_STOCK_KEEP_PCT) / 100),
      );
    });
    expect([...ceR.stock]).toEqual(wantR);
    expect(ceL.manpower).toBe(
      Math.floor((menL * WW_EXILE_MANPOWER_KEEP_PCT) / 100),
    );
  });

  it("the host is chosen faction, guarantor, war side, factories in that order", async () => {
    const { g, ww } = await started();
    const eg = ww.endgame;
    const pol = ww.politics;
    const [deu, pl, gbr, sun, ltu, csk] = [
      "DEU",
      "POL",
      "GBR",
      "SUN",
      "LTU",
      "CSK",
    ].map((t) => endId(t as "DEU"));
    const tick = g.ticks();
    expect(pickHost(eg, pl, 0)).toBe(0);
    expect(pickHost(eg, pl, deu)).toBe(0); // nobody fights Germany
    ww.setWar(deu, pl, tick, { kind: "declare" });
    const war = eg.warOfPair(deu, pl);
    for (const e of [gbr, sun, ltu]) {
      ww.setWar(deu, e, tick, { kind: "declare" });
    }
    // (4) the most factories.
    const most = [gbr, sun, ltu].reduce((a, b) => {
      const d = eg.factoriesOf(b) - eg.factoriesOf(a);
      return d > 0 || (d === 0 && b < a) ? b : a;
    });
    expect(eg.factoriesOf(most)).toBeGreaterThan(eg.factoriesOf(csk));
    expect(pickHost(eg, pl, deu)).toBe(most);
    // (3) Czechoslovakia joins Poland's side of its war.
    ww.setWar(deu, csk, tick, { kind: "into", warId: war });
    expect(eg.sideIndex(eg.war(war)!, csk)).toBe(
      eg.sideIndex(eg.war(war)!, pl),
    );
    expect(pickHost(eg, pl, deu)).toBe(csk);
    // (2) Lithuania guarantees Poland.
    pol.guarantees.push({ by: ltu, to: pl, sinceDay: 0 });
    expect(pickHost(eg, pl, deu)).toBe(ltu);
    // (1) Poland joins the Allies: their leader, Britain.
    const allies = pol.factionIdx(gbr);
    expect(pol.faction(allies)!.leader).toBe(gbr);
    joinFaction(pol, pl, allies, tick);
    expect(pickHost(eg, pl, deu)).toBe(gbr);
    // A capitulated candidate is none.
    ww.addCapitulation(gbr, deu, tick);
    expect(pickHost(eg, pl, deu)).toBe(ltu);
  });

  it("legitimacy rises with liberated legal points and falls without", async () => {
    const { g, eg, pl } = await polandInExile();
    const ex = () => eg.exiles[eg.exileIdx.get(pl)!];
    expect(ex().legitBp).toBe(WW_EXILE_LEGIT_START_BP);
    let day = eg.ww.day(g.ticks());
    // Nothing held, a minor host, no battles: −2 a day.
    stepExile(eg, pl, day++);
    stepExile(eg, pl, day++);
    expect(ex().legitBp).toBe(WW_EXILE_LEGIT_START_BP - 4);
    expect(ex().lastDelta).toBe(-2);
    // Lithuania takes Krakow: 3 of Poland's 24 legal points on its side
    // (12%): +12 − 2.
    takeRegion(g, 7, "LTU");
    stepExile(eg, pl, day);
    expect(ex().lastDelta).toBe(10);
    expect(ex().legitBp).toBe(WW_EXILE_LEGIT_START_BP + 6);
    // Spec §10.4: political power and virtual factories follow it.
    expect(eg.ppFactorPct(pl)).toBe(
      50 + Math.floor((WW_EXILE_LEGIT_START_BP + 6) / 200),
    );
    expect(eg.econAdjust(pl).virtualMil).toBe(5);
  });

  it("liberated legal regions return to the exile", async () => {
    const { runner, g, ww, eg, pl, deu } = await polandInExile();
    nextDay(runner);
    // Germany fights Poland on: Krakow stays occupied.
    expect(ww.land.controller[7]).toBe(deu);
    takeRegion(g, 7, "LTU");
    nextDay(runner);
    expect(ww.land.controller[7]).toBe(pl);
    expect(g.owner(ww.scenario.vpTile(ww.scenario.region(7)!)).smallID()).toBe(
      pl,
    );
    expect(eg.countryState(pl)).toBe("active");
    expect(eg.isActor(pl)).toBe(true);
    // Warsaw (the capital) is still German: still an exile.
    expect(eg.isExile(pl)).toBe(true);
  });

  it("regaining the capital ends the exile", async () => {
    const { runner, g, ww, eg, pl, deu } = await polandInExile();
    const war = eg.warOfPair(deu, pl);
    expect(eg.member(eg.war(war)!, pl)!.state).toBe("exiled");
    const noElections = () =>
      ww.politics
        .country(pl)!
        .spirits.some((s) => s.id === "gen_exile_no_elections");
    expect(noElections()).toBe(true);
    takeRegion(g, 6, "LTU");
    // Day 1: Warsaw back to Poland; Poland's turn that day or the next: home.
    nextDay(runner);
    expect(ww.land.controller[6]).toBe(pl);
    nextDay(runner);
    expect(eg.isExile(pl)).toBe(false);
    expect(eg.countryState(pl)).toBe("active");
    expect(eg.member(eg.war(war)!, pl)!.state).toBe("active");
    expect(ww.isAtWar(pl, deu)).toBe(true);
    // Elections again.
    expect(noElections()).toBe(false);
  });

  it("legitimacy at zero for 30 days ends the exile", async () => {
    const { g, ww, eg, pl, deu, ltu } = await polandInExile();
    supply(ww, pl);
    const a = placeArmy(g, "POL", 17, 1); // in Kaunas, with the host
    const row = ww.land.divisions.rowOf(a.divisions[0]);
    const eq = ww.land.divisions.equip[row * GROUND_SLOTS];
    const key = GROUND_EQUIP_KEYS[0];
    const hostCe = ww.economy.country(ltu)!;
    const plCe = ww.economy.country(pl)!;
    const hostHad = hostCe.stock[key] + plCe.stock[key];
    const ex = () => eg.exiles[eg.exileIdx.get(pl)!];
    ex().legitBp = 0;
    let day = ww.day(g.ticks());
    for (let i = 1; i < WW_EXILE_ZERO_DAYS; i++) stepExile(eg, pl, day++);
    expect(eg.isExile(pl)).toBe(true);
    expect(ex().zeroDays).toBe(WW_EXILE_ZERO_DAYS - 1);
    stepExile(eg, pl, day);
    expect(eg.isExile(pl)).toBe(false);
    expect(eg.countryState(pl)).toBe("gone");
    expect(eg.isActor(pl)).toBe(false);
    expect(ww.land.rowsOf(pl)).toEqual([]);
    expect(ww.isAtWar(pl, deu)).toBe(false);
    // Spec §10.6: its equipment and stock to the host.
    expect(hostCe.stock[key]).toBe(hostHad + eq);
  });
});
