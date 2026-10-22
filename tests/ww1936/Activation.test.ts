// World War 1936 P5 lane X (plan Task 5 Steps 1–2, spec §3.3–§3.4,
// §16.4): waking a dormant slot, reviving a gone country, the release /
// create_state effects.
import {
  EQUIP_KEYS,
  equipKey,
  EQUIPMENT_TYPES,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  CS_GONE,
  WW_WAKE_EQUIP_PCT,
  WW_WAKE_FUEL_PCT,
  WW_WAKE_MANPOWER_PCT,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import {
  GROUND_EQUIP_KEYS,
  GROUND_SLOTS,
} from "@openfront/engine-api/ww1936/LandTypes";
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import { IDEOLOGIES } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { recruitableMen } from "@openfront/engine-lib/ww1936/EconomyRules";
import { fuelCap } from "@openfront/engine-lib/ww1936/FuelRules";
import {
  genMixOf,
  templateStats,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import { WW_TECHS } from "@openfront/engine-lib/ww1936/WwTechs";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import {
  activateCountry,
  applyActivationEffect,
} from "@openfront/engine/ww1936/endgame/Activate";
import { transferRegionPeaceful } from "@openfront/engine/ww1936/land/PoliticsBridge";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { makeCtx } from "@openfront/engine/ww1936/politics/Dispatch";
import { setGovernment } from "@openfront/engine/ww1936/politics/Ideology";
import { endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import {
  clearLand,
  END_MAP,
  placeArmy,
  stepTo,
  stepToDate,
  wwRunner,
} from "./util";

afterEach(() => usePoliticsContent(null));

async function started() {
  const runner = await wwRunner({}, [], END_MAP);
  stepTo(runner, WW_PREP_TICKS + 2);
  return { runner, g: runner.game, ww: runner.game.worldWar()! };
}

/** A division's equipment by EQUIPMENT_TYPES index (every generation). */
function byType(ww: WorldWar, row: number): number[] {
  const out = new Array<number>(EQUIPMENT_TYPES.length).fill(0);
  for (let j = 0; j < GROUND_SLOTS; j++) {
    const [type] = EQUIP_KEYS[GROUND_EQUIP_KEYS[j]];
    out[EQUIPMENT_TYPES.indexOf(type)] +=
      ww.land.divisions.equip[row * GROUND_SLOTS + j];
  }
  return out;
}

/**
 * What `id`'s first template needs, by EQUIPMENT_TYPES index. P6's need is
 * by NEED_GROUPS (the equipment types, then four design-only groups): a
 * woken country's P2 template needs none of those.
 */
function needOf(ww: WorldWar, id: number): readonly number[] {
  const tpl = ww.land.country(id)!.templates[0];
  const stats = ww.economy.country(id)!.stats;
  const need = templateStats(
    tpl.def,
    stats,
    genMixOf(new Array(GROUND_SLOTS).fill(0)),
  ).need;
  expect(need.slice(EQUIPMENT_TYPES.length).every((n) => n === 0)).toBe(true);
  return need.slice(0, EQUIPMENT_TYPES.length);
}

/** A region's legal owner and control to `id` (a treaty's). */
function give(ww: WorldWar, region: number, id: number, tick: number) {
  ww.politics.setLegalOwner(region, id);
  transferRegionPeaceful(ww.land, region, id, tick);
}

describe("World War 1936 P5: waking and reviving countries", () => {
  beforeEach(() => usePoliticsContent(endgameFixture()));

  it("a woken country's victory-point tiles are its own on the tick it wakes", async () => {
    const { g, ww } = await started();
    const eg = ww.endgame;
    const [svk, csk] = [endId("SVK"), endId("CSK")];
    expect(eg.countryState(svk)).toBe("dormant");
    // A Czechoslovak division in Slovakia goes home.
    const ce = ww.economy.country(csk)!;
    for (const t of EQUIPMENT_TYPES) ce.stock[equipKey(t, 1)] += 10_000;
    ce.manpower += 100_000;
    const a = placeArmy(g, "CSK", 15, 1);
    const tick = g.ticks();
    expect(
      activateCountry(eg, "SVK", { regions: [20, 15], from: [csk] }, tick),
    ).toBe(svk);
    expect(g.ticks()).toBe(tick);
    const svkPlayer = g.playerBySmallID(svk);
    for (const r of [15, 20]) {
      expect(ww.politics.legalOwner[r]).toBe(svk);
      expect(ww.land.controller[r]).toBe(svk);
      expect(g.owner(ww.scenario.vpTile(ww.scenario.region(r)!))).toBe(
        svkPlayer,
      );
    }
    expect(eg.countryState(svk)).toBe("active");
    expect(eg.isActor(svk)).toBe(true);
    expect(eg.wakeQueue).toContain(svk);
    const row = ww.land.divisions.rowOf(a.divisions[0]);
    expect(ww.land.divisions.owner[row]).toBe(csk);
    expect([15, 20]).not.toContain(ww.land.divisions.region[row]);
    // Spec §3.3-4: half the recruitable men of its (core) regions; the
    // default laws.
    const sce = ww.economy.country(svk)!;
    expect(sce.laws).toEqual({
      economy: "civilian",
      trade: "export_focus",
      conscription: "volunteer",
    });
    let men = 0;
    for (const r of [15, 20]) {
      men += recruitableMen(
        ww.scenario.region(r)!.pop,
        100,
        sce.law().conscriptionPermille,
        sce.stats.recruitablePct,
      );
    }
    expect(sce.manpower).toBe(Math.floor((men * WW_WAKE_MANPOWER_PCT) / 100));
    expect(ww.politics.country(svk)!.ppMilli).toBe(100_000);
    expect(ww.politics.country(svk)!.tree).toBe("generic");
  });

  it("a woken country starts with a base fuel stock: half its capacity at waking", async () => {
    const { runner, g, ww } = await started();
    const eg = ww.endgame;
    const [svk, csk, deu] = [endId("SVK"), endId("CSK"), endId("DEU")];
    const sce = ww.economy.country(svk)!;
    // A dormant slot never started: no fuel before it wakes.
    expect(sce.fuelMilli).toBe(0);
    activateCountry(eg, "SVK", { regions: [20, 15], from: [csk] }, g.ticks());
    const want = (id: number) =>
      Math.floor(
        (fuelCap(
          0,
          ww.economy.countryBuildings(id, "fuel_silo"),
          ww.economy.country(id)!.stats,
        ) *
          WW_WAKE_FUEL_PCT) /
          100,
      );
    expect(sce.fuelMilli).toBe(want(svk));
    expect(sce.fuelMilli).toBeGreaterThan(0);
    expect(sce.fuelRatioPm).toBe(1000);
    // A revived country starts afresh too, whatever it had left.
    const tick = g.ticks();
    for (const r of [13, 14]) give(ww, r, deu, tick);
    ww.addCapitulation(csk, deu, tick);
    eg.setCountryState(csk, CS_GONE);
    const cce = ww.economy.country(csk)!;
    cce.fuelMilli = 0;
    cce.fuelRatioPm = 0;
    activateCountry(eg, "CSK", { regions: [14] }, tick);
    expect(cce.fuelMilli).toBe(want(csk));
    expect(cce.fuelRatioPm).toBe(1000);
    // The daily settlement takes over: a woken country keeps fuel to run on.
    stepToDate(runner, "1936-01-20");
    expect(sce.fuelMilli).toBeGreaterThan(0);
    expect(sce.fuelRatioPm).toBe(1000);
  });

  it("woken divisions follow the victory points and equipFrom", async () => {
    const { g, ww } = await started();
    const eg = ww.endgame;
    const [svk, hrv, deu, ita] = ["SVK", "HRV", "DEU", "ITA"].map((t) =>
      endId(t as "SVK"),
    );
    clearLand(g);
    const deuCe = ww.economy.country(deu)!;
    for (const t of EQUIPMENT_TYPES) deuCe.stock[equipKey(t, 1)] = 1_000_000;
    const deuBefore = deuCe.stock.reduce((s, q) => s + q, 0);
    // Vienna 15, Tyrol 2, Sudetenland 3, Prague 15, Slovakia 2, Kosice 3:
    // 40 points → 3 divisions, at Vienna (15 points; Prague's tie loses on id).
    const regions = [11, 12, 13, 14, 15, 20];
    activateCountry(eg, "SVK", { regions, equipFrom: deu }, g.ticks());
    const rows = ww.land.rowsOf(svk);
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((r) => ww.land.divisions.army[r])).size).toBe(1);
    const need = needOf(ww, svk);
    let drawn = 0;
    for (const r of rows) {
      expect(ww.land.divisions.region[r]).toBe(11);
      const have = byType(ww, r);
      need.forEach((n, i) => expect(have[i]).toBe(n));
      drawn += have.reduce((s, q) => s + q, 0);
    }
    expect(drawn).toBeGreaterThan(0);
    expect(deuCe.stock.reduce((s, q) => s + q, 0)).toBe(deuBefore - drawn);
    // Moscow alone (21 points → 1), but two asked; an empty stock gives
    // half of every need.
    ww.economy.country(ita)!.stock.fill(0);
    activateCountry(
      eg,
      "HRV",
      { regions: [8], divisions: 2, equipFrom: ita },
      g.ticks(),
    );
    const hrvRows = ww.land.rowsOf(hrv);
    expect(hrvRows).toHaveLength(2);
    const hrvNeed = needOf(ww, hrv);
    for (const r of hrvRows) {
      expect(ww.land.divisions.region[r]).toBe(8);
      const have = byType(ww, r);
      hrvNeed.forEach((n, i) =>
        expect(have[i]).toBe(Math.ceil((n * WW_WAKE_EQUIP_PCT) / 100)),
      );
    }
  });

  it("techAll gives a civil-war slot every tech of its parent; others lag two years", async () => {
    const { g, ww } = await started();
    const eg = ww.endgame;
    const [deu, cw1, hrv] = [endId("DEU"), endId("CW1"), endId("HRV")];
    const parent = [...ww.economy.country(deu)!.researched];
    activateCountry(
      eg,
      "CW1",
      { regions: [4], techFrom: deu, techAll: true },
      g.ticks(),
    );
    activateCountry(eg, "HRV", { regions: [9], techFrom: deu }, g.ticks());
    const cw = ww.economy.country(cw1)!.researched;
    for (const t of parent) expect(cw.has(t)).toBe(true);
    // 1936 − 2: Germany's 1935 and 1936 techs stay German (unless basic).
    const lag = ww.economy.country(hrv)!.researched;
    const late = parent.filter((t) => WW_TECHS[t].year > 1934);
    expect(late.length).toBeGreaterThan(0);
    expect(late.some((t) => !lag.has(t))).toBe(true);
    for (const t of parent) {
      if (WW_TECHS[t].year <= 1934) expect(lag.has(t)).toBe(true);
    }
  });

  it("a revived scenario country keeps its politics with stability 50", async () => {
    const { g, ww } = await started();
    const eg = ww.endgame;
    const pol = ww.politics;
    const [csk, deu] = [endId("CSK"), endId("DEU")];
    const tick = g.ticks();
    // Czechoslovakia changed government, then lost everything and went.
    setGovernment(pol, csk, IDEOLOGIES.indexOf("fascist"), tick);
    const c = pol.country(csk)!;
    c.ppMilli = 42_000;
    c.stabBaseBp = 1200;
    c.wsBaseBp = 900;
    const ruling = c.ruling;
    const leader = c.leader;
    const tree = c.tree;
    for (const r of [13, 14, 15, 20]) give(ww, r, deu, tick);
    ww.addCapitulation(csk, deu, tick);
    eg.setCountryState(csk, CS_GONE);
    expect(eg.isActor(csk)).toBe(false);
    activateCountry(eg, "CSK", { regions: [14] }, tick);
    expect(eg.countryState(csk)).toBe("active");
    expect(ww.isCapitulated(csk)).toBe(false);
    expect(ww.land.controller[14]).toBe(csk);
    expect(c.ruling).toBe(ruling);
    expect(c.ruling).toBe(IDEOLOGIES.indexOf("fascist"));
    expect(c.leader).toBe(leader);
    expect(c.tree).toBe(tree);
    expect(c.ppMilli).toBe(42_000);
    expect(c.stabBaseBp).toBe(5000);
    expect(c.wsBaseBp).toBe(4000);
  });

  it("release as puppet ties the new country to the overlord", async () => {
    const { g, ww } = await started();
    const eg = ww.endgame;
    const pol = ww.politics;
    const [svk, deu] = [endId("SVK"), endId("DEU")];
    const tick = g.ticks();
    // Germany holds Slovakia and Kosice (Slovak cores) by treaty, Prague too
    // (no Slovak core: it stays German).
    for (const r of [14, 15, 20]) give(ww, r, deu, tick);
    const e: Effect = { kind: "release", tag: "SVK", as: "puppet" };
    applyActivationEffect(makeCtx(pol, deu, 0, 0, tick), e, deu);
    expect(eg.countryState(svk)).toBe("active");
    expect(eg.subjectOf(svk)).toEqual({
      overlord: deu,
      level: "puppet",
      neutral: false,
    });
    expect(pol.factionIdx(svk)).toBe(pol.factionIdx(deu));
    expect(pol.factionIdx(deu)).toBeGreaterThanOrEqual(0);
    for (const r of [15, 20]) {
      expect(pol.legalOwner[r]).toBe(svk);
      expect(ww.land.controller[r]).toBe(svk);
    }
    expect(pol.legalOwner[14]).toBe(deu);
  });

  it("create_state keeps its own government under the overlord", async () => {
    const { g, ww } = await started();
    const eg = ww.endgame;
    const pol = ww.politics;
    const [svk, deu, csk] = [endId("SVK"), endId("DEU"), endId("CSK")];
    const tick = g.ticks();
    setGovernment(pol, deu, IDEOLOGIES.indexOf("fascist"), tick);
    // Germany fights Czechoslovakia and holds Slovakia; Kosice is still Czech.
    ww.setWar(deu, csk, tick, { kind: "declare" });
    transferRegionPeaceful(ww.land, 15, deu, tick);
    const e: Effect = {
      kind: "create_state",
      tag: "SVK",
      regions: ["slovakia"],
      from: { tag: "CSK" },
      overlord: "self",
      level: "puppet",
      ideology: "neutral",
    };
    applyActivationEffect(makeCtx(pol, deu, 0, 0, tick), e, deu);
    expect(eg.countryState(svk)).toBe("active");
    expect(eg.subjectOf(svk)?.overlord).toBe(deu);
    // Lane S gives a new subject its overlord's government; the effect's
    // own ideology comes after it.
    expect(pol.country(svk)!.ruling).toBe(IDEOLOGIES.indexOf("neutral"));
    // Slovakia (held by the overlord, at war with its legal owner) and
    // Kosice (held by its legal owner) both go.
    expect(pol.legalOwner[15]).toBe(svk);
    expect(pol.legalOwner[20]).toBe(svk);
  });
});
