import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import {
  addLineBlockOf,
  buildBlockOf,
  BuildCheck,
  countryGraph,
  equipmentTechBlock,
  exportRoomOf,
  freeResearchSlot,
  lawBlockOf,
  openTradeBlockOf,
  payableCivs,
  queuedInRegion,
  regionShares,
  researchBlockOf,
  TradeCheck,
} from "@openfront/engine-lib/ww1936/EconomyChecks";
import {
  buildBlock,
  usedSlots,
} from "@openfront/engine/ww1936/economy/Construction";
import { lawBlock } from "@openfront/engine/ww1936/economy/LawsRun";
import {
  cancelResearch,
  researchBlock,
} from "@openfront/engine/ww1936/economy/ResearchRun";
import {
  exportRoom,
  tradePartnerBlock,
  tradePartners,
} from "@openfront/engine/ww1936/economy/Trade";
import { byTag, wwRunner } from "./util";

const LAWS = {
  economy: "civilian",
  trade: "export_focus",
  conscription: "limited",
} as const;
const NO_COOLDOWN = { economy: -1, trade: -1, conscription: -1 };

describe("shared judgements (plan decision 3)", () => {
  test("region shares: home, colony, occupied, annexed", () => {
    expect(regionShares(1, 1, true, true)).toEqual({
      occupied: false,
      controlPct: 100,
      manpowerPct: 100,
    });
    expect(regionShares(1, 1, false, true).manpowerPct).toBe(10);
    expect(regionShares(2, 1, true, true)).toEqual({
      occupied: true,
      controlPct: 50,
      manpowerPct: 0,
    });
    expect(regionShares(2, 1, true, false)).toEqual({
      occupied: false,
      controlPct: 100,
      manpowerPct: 10,
    });
  });

  test("construction: what blocks a project, in order", () => {
    const ok: BuildCheck = {
      building: "civ",
      count: 1,
      controlled: true,
      occupied: false,
      queueLength: 0,
      levelWithQueue: 0,
      usedSlots: 5,
      slots: 6,
    };
    expect(buildBlockOf(ok)).toBeNull();
    expect(buildBlockOf({ ...ok, building: "dock" })).toBe("not_buildable");
    expect(buildBlockOf({ ...ok, controlled: false })).toBe("not_controlled");
    expect(buildBlockOf({ ...ok, queueLength: 30 })).toBe("queue_full");
    expect(buildBlockOf({ ...ok, occupied: true })).toBe("occupied");
    expect(buildBlockOf({ ...ok, count: 2 })).toBe("no_slots");
    // Infrastructure: no slots, occupied or not, up to five with the queue.
    const infra = {
      ...ok,
      building: "infra" as const,
      occupied: true,
      levelWithQueue: 3,
    };
    expect(buildBlockOf({ ...infra, count: 2 })).toBeNull();
    expect(buildBlockOf({ ...infra, count: 3 })).toBe("infra_max");
    // P2 plan decision 10: forts and railways to five, a supply hub to one,
    // all level buildings, in occupied regions too.
    expect(buildBlockOf({ ...infra, building: "fort", count: 2 })).toBeNull();
    expect(buildBlockOf({ ...infra, building: "rail", count: 3 })).toBe(
      "infra_max",
    );
    const hub = { ...infra, building: "supply_hub" as const };
    expect(buildBlockOf({ ...hub, levelWithQueue: 0 })).toBeNull();
    expect(buildBlockOf({ ...hub, levelWithQueue: 1 })).toBe("infra_max");
    expect(
      queuedInRegion(
        [
          { region: 4, building: "civ", count: 2 },
          { region: 4, building: "infra", count: 1 },
          { region: 4, building: "fort", count: 2 },
          { region: 4, building: "supply_hub", count: 1 },
          { region: 3, building: "mil", count: 5 },
        ],
        4,
      ),
    ).toEqual({ factories: 2, infra: 1, fort: 2, rail: 0, supply_hub: 1 });
  });

  test("laws: ladder, same, cooldown, condition", () => {
    // P3 (plan decision 11): the conditions and the cost are lawBlock's
    // (PoliticsRules, spec §7.2); a neutral country at peace with 30% war
    // support and enough PP.
    const ctx = {
      wsBp: 3000,
      wtBp: 400,
      ruling: 3,
      atWar: false,
      ppMilli: 200_000,
      costMilli: 75_000,
    };
    expect(lawBlockOf(LAWS, NO_COOLDOWN, "economy", "free_trade", 0, ctx)).toBe(
      "law_kind",
    );
    expect(lawBlockOf(LAWS, NO_COOLDOWN, "economy", "civilian", 0, ctx)).toBe(
      "law_same",
    );
    expect(
      lawBlockOf(LAWS, NO_COOLDOWN, "economy", "early_mobilization", 0, ctx),
    ).toBeNull();
    expect(
      lawBlockOf(LAWS, NO_COOLDOWN, "economy", "war_economy", 0, ctx),
    ).toBe("law_ws");
    expect(
      lawBlockOf(LAWS, NO_COOLDOWN, "economy", "total_mobilization", 0, ctx),
    ).toBe("law_condition");
    const cool = { ...NO_COOLDOWN, economy: 30 };
    expect(
      lawBlockOf(LAWS, cool, "economy", "early_mobilization", 29, ctx),
    ).toBe("law_cooldown");
    expect(
      lawBlockOf(LAWS, cool, "economy", "early_mobilization", 30, ctx),
    ).toBeNull();
    expect(
      lawBlockOf(LAWS, cool, "economy", "early_mobilization", 30, {
        ...ctx,
        ppMilli: 74_999,
      }),
    ).toBe("no_pp");
  });

  test("production: line count and generation techs", () => {
    const r = new Set(["inf_eq_1", "artillery_1"] as const);
    expect(equipmentTechBlock(r, "infantry_equipment", 1)).toBeNull();
    expect(equipmentTechBlock(r, "infantry_equipment", 2)).toBe("no_tech");
    expect(equipmentTechBlock(r, "motorized", 2)).toBe("no_tech");
    expect(addLineBlockOf(r, 19, "artillery", 1)).toBeNull();
    expect(addLineBlockOf(r, 20, "artillery", 1)).toBe("lines_full");
  });

  test("research: done, running, prerequisites, one school, a free slot", () => {
    const state = {
      researched: new Set(["inf_eq_1", "tools_1", "mobile_1"] as const),
      slots: ["tools_2", null] as const,
      slotCount: 2,
    };
    expect(researchBlockOf(state, "inf_eq_1")).toBe("researched");
    expect(researchBlockOf(state, "tools_2")).toBe("in_progress");
    expect(researchBlockOf(state, "inf_eq_3")).toBe("prereq");
    expect(researchBlockOf(state, "mass_1")).toBe("doctrine");
    expect(researchBlockOf(state, "mobile_2")).toBeNull();
    expect(researchBlockOf(state, "inf_eq_2")).toBeNull();
    const full = { ...state, slots: ["tools_2", "inf_eq_2"] as const };
    expect(researchBlockOf(full, "support_eq_2")).toBe("prereq");
    expect(researchBlockOf(full, "electronics_1")).toBe("no_slot");
    // A slot past the count is no free slot.
    expect(freeResearchSlot(["tools_2"], 1)).toBe(-1);
    expect(freeResearchSlot(["tools_2"], 2)).toBe(1);
  });

  test("trade: partner, deal count, the seller's room, the buyer's factories", () => {
    const ok: TradeCheck = {
      partnerOk: true,
      buyerTrades: 0,
      grows: false,
      civs: 2,
      room: 16,
      payable: 5,
      paidCivs: 3,
    };
    expect(openTradeBlockOf(ok)).toBeNull();
    expect(openTradeBlockOf({ ...ok, partnerOk: false })).toBe("no_partner");
    expect(openTradeBlockOf({ ...ok, buyerTrades: 20 })).toBe("trades_full");
    expect(
      openTradeBlockOf({ ...ok, buyerTrades: 20, grows: true }),
    ).toBeNull();
    expect(openTradeBlockOf({ ...ok, room: 15 })).toBe("no_room");
    expect(openTradeBlockOf({ ...ok, paidCivs: 4 })).toBe("no_civs");
    expect(exportRoomOf(40, 25, 8)).toBe(2);
    expect(exportRoomOf(40, 25, 16)).toBe(-6);
    // 9 civ + 6 mil at 25%: 3.75 factories of consumer goods.
    expect(payableCivs(9, 3750)).toBe(5);
    expect(payableCivs(1, 3750)).toBe(0);
  });
});

describe("the engine's judgements use them", () => {
  test("Germany's projects: Munich has two free slots, Berlin full infrastructure", async () => {
    const runner = await wwRunner();
    const g = runner.game;
    const ww = g.worldWar()!;
    const econ = ww.economy;
    const deu = econ.country(byTag(g, "DEU").smallID())!;
    const id = (name: string) =>
      ww.scenario.landRegions.find((r) => r.name === name)!.id;
    expect(usedSlots(econ, id("Munich"))).toBe(7);
    expect(buildBlock(econ, deu, id("Munich"), "civ", 2)).toBeNull();
    expect(buildBlock(econ, deu, id("Munich"), "civ", 3)).toBe("no_slots");
    // The queue reserves its slots.
    deu.queue.push({
      region: id("Munich"),
      building: "mil",
      count: 1,
      progress: 0,
      lastAssigned: 0,
      lastSpeedPct: 0,
    });
    expect(usedSlots(econ, id("Munich"))).toBe(8);
    expect(buildBlock(econ, deu, id("Munich"), "civ", 2)).toBe("no_slots");
    expect(buildBlock(econ, deu, id("Berlin"), "infra", 1)).toBe("infra_max");
    expect(buildBlock(econ, deu, id("Berlin"), "dock", 1)).toBe(
      "not_buildable",
    );
    expect(buildBlock(econ, deu, id("Paris"), "civ", 1)).toBe("not_controlled");
    expect(buildBlock(econ, deu, 40_001, "infra", 1)).toBe("not_controlled");
  });

  test("laws and research read the country's state", async () => {
    const runner = await wwRunner();
    const g = runner.game;
    const econ = g.worldWar()!.economy;
    const deu = econ.country(byTag(g, "DEU").smallID())!;
    expect(lawBlock(econ, deu, "economy", "partial_mobilization", 0)).toBe(
      "law_same",
    );
    // P3: 50% war support (no politics row) passes the gates; 50 PP does
    // not pay a 150 or 100 PP law; total mobilization needs a war.
    expect(lawBlock(econ, deu, "economy", "war_economy", 0)).toBe("no_pp");
    expect(lawBlock(econ, deu, "economy", "total_mobilization", 0)).toBe(
      "law_condition",
    );
    expect(
      lawBlock(econ, deu, "conscription", "extensive", dayOfDate("1938-01-01")),
    ).toBe("no_pp");
    g.worldWar()!.politics.country(deu.smallID)!.ppMilli = 500_000;
    expect(
      lawBlock(econ, deu, "conscription", "extensive", dayOfDate("1938-01-01")),
    ).toBeNull();
    expect(researchBlock(econ, deu, "tools_1")).toBe("researched");
    // Every slot is at work from the start; a cancelled one takes it.
    expect(researchBlock(econ, deu, "tools_2")).toBe("no_slot");
    expect(cancelResearch(econ, deu, 2)).toBeNull();
    expect(researchBlock(econ, deu, "tools_2")).toBeNull();
    expect(researchBlock(econ, deu, "medium_tank_1")).toBe("prereq");
  });

  test("trade partners: faction, land at peace, shared sea; a war cuts it", async () => {
    const runner = await wwRunner();
    const g = runner.game;
    const ww = g.worldWar()!;
    const econ = ww.economy;
    const [deu, ita, gbr, fra, sun, pol] = (
      ["DEU", "ITA", "GBR", "FRA", "SUN", "POL"] as const
    ).map((t) => byTag(g, t).smallID());
    // Germany: Italy (faction), France and Poland (border), the Soviet
    // Union through Poland. Britain is an island and Germany has no coast.
    expect(tradePartners(econ, deu)).toEqual([ita, fra, sun, pol]);
    expect(tradePartnerBlock(econ, deu, gbr)).toBe("no_partner");
    expect(tradePartnerBlock(econ, gbr, fra)).toBeNull(); // North Sea
    expect(tradePartnerBlock(econ, deu, deu)).toBe("no_partner");
    // Room: Germany sells a quarter of Munich's 40 steel a day.
    expect(exportRoom(econ, deu, 4)).toBe(10);
    econ.addTrade(ita, deu, 4, 1);
    expect(exportRoom(econ, deu, 4)).toBe(2);
    // At war with Poland: no deal with it, and no road through it.
    ww.setWar(deu, pol, g.ticks());
    expect(tradePartnerBlock(econ, deu, pol)).toBe("no_partner");
    expect(tradePartnerBlock(econ, deu, sun)).toBe("no_partner");
    expect(tradePartnerBlock(econ, deu, fra)).toBeNull();
  });

  test("the screens build the engine's country graph from the controllers", async () => {
    const runner = await wwRunner();
    const g = runner.game;
    const ww = g.worldWar()!;
    const econ = ww.economy;
    const size = ww.scenario.countries.length + 1;
    const graph = countryGraph(ww.scenario, econ.controller, size);
    for (let id = 1; id < size; id++) {
      expect(graph.neighbours[id]).toEqual(econ.countryNeighbours(id));
      expect(graph.seaZones[id]).toEqual(econ.countrySeaZones(id));
      expect(graph.regionsByCountry[id]).toEqual(econ.regionsOf(id));
    }
  });
});
