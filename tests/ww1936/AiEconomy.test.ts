import {
  COUNTRIES,
  type CountryTag,
} from "@openfront/engine-api/ww1936/Countries";
import {
  equipKey,
  RESOURCE_COUNT,
  RESOURCE_IDS,
  WW_AI_PERIOD_DAYS,
  WW_DAY_SPLIT,
  WW_MAX_QUEUE,
  WW_TECH_IDS,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayOfDate, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { navalStartTechs } from "@openfront/engine-lib/ww1936/EconomyStart";
import { techDays, WW_TECHS } from "@openfront/engine-lib/ww1936/WwTechs";
import type { GameRunner } from "@openfront/engine/GameRunner";
import {
  AI_FALLBACK_AHEAD_PCT,
  AI_FUEL_OIL_MAX,
  AI_SUPPORT_RESERVE,
  AI_SUPPORT_SHORT_PTS,
  AI_SWITCH_DAY,
  aiAirSchool,
  aiInput,
  AiInput,
  aiLineShares,
  AiOrder,
  aiPersonality,
  aiPlan,
  aiReactions,
  aiReactPlan,
  aiResearchCaps,
  aiResearchMix,
  aiResearchOrder,
  aiRetools,
  aiSchool,
  aiSeaSchool,
  aiTechDomain,
  isAiTurn,
  withFuelOil,
} from "@openfront/engine/ww1936/economy/AiEconomy";
import { exportRoom } from "@openfront/engine/ww1936/economy/Trade";
import { byTag, HUMAN, stamped, step, stepTo, wwRunner } from "./util";

// ---- The pure plan ----

const zeros = () => new Array<number>(RESOURCE_COUNT).fill(0);
const res = (r: Partial<Record<(typeof RESOURCE_IDS)[number], number>>) =>
  RESOURCE_IDS.map((id) => r[id] ?? 0);

/** A country with nothing to do; each test fills in what it looks at. */
function input(over: Partial<AiInput> = {}): AiInput {
  return {
    tag: "POL",
    personality: "minor",
    major: false,
    day: 0,
    warDays: -1,
    laws: {
      economy: "civilian",
      trade: "export_focus",
      conscription: "limited",
    },
    lawCooldownUntil: { economy: -1, trade: -1, conscription: -1 },
    // P3 (controller ruling R10): neutral, 50% war support, no tension.
    wsBp: 5000,
    wtBp: 0,
    ruling: 3,
    ppMilli: 1_000_000,
    manpower: 500_000,
    recruitable: 850_000,
    infStock: 0,
    freeCivMilli: 0,
    mil: 0,
    idleMil: 0,
    effCapBp: 5000,
    lines: [],
    queue: [],
    slots: [],
    slotCount: 0,
    researched: ["inf_eq_1", "support_eq_1", "artillery_1"],
    produced: zeros(),
    exported: zeros(),
    imported: zeros(),
    payableCivs: 0,
    paidCivs: 0,
    buying: [],
    partners: [],
    regions: [],
    ...over,
  };
}

function only<K extends AiOrder["kind"]>(
  orders: AiOrder[],
  kind: K,
): Extract<AiOrder, { kind: K }>[] {
  return orders.filter(
    (o): o is Extract<AiOrder, { kind: K }> => o.kind === kind,
  );
}

const builds = (orders: AiOrder[]) =>
  only(orders, "build").map((o) => `${o.region}:${o.building}x${o.count}`);

/** Two regions with room: Ruhr (id 3, infra 5) and Silesia (id 1, infra 4). */
const TWO_REGIONS = [
  {
    region: 1,
    infra: 4,
    free: 10,
    infraRoom: 1,
    occupied: false,
    res: zeros(),
  },
  { region: 3, infra: 5, free: 6, infraRoom: 0, occupied: false, res: zeros() },
];

const line = (
  id: number,
  type: Parameters<typeof equipKey>[0],
  gen: number,
  factories: number,
  more: { effBp?: number; fill?: number } = {},
) => ({
  id,
  key: equipKey(type, gen),
  factories,
  active: factories,
  effBp: more.effBp ?? 3000,
  fill: more.fill ?? 1000,
});

describe("the AI's plan (spec §12, pre-flight R6)", () => {
  test("personalities and switch days", () => {
    expect(aiPersonality("DEU")).toBe("aggressor");
    expect(aiPersonality("SUN")).toBe("aggressor");
    expect(aiPersonality("RAJ")).toBe("democracy");
    expect(aiPersonality("IRL")).toBe("minor");
    expect(aiPersonality("POL")).toBe("minor");
    // Task 9: the aggressors rearm from mid-1936 (spec §16 balance record).
    expect(AI_SWITCH_DAY).toEqual({
      aggressor: dayOfDate("1936-07-01"),
      democracy: dayOfDate("1939-01-01"),
      minor: dayOfDate("1938-01-01"),
    });
  });

  test("the switch date decides civ or mil", () => {
    // 20 free civilian factories: ceil(20/15) + 1 = 3 entries.
    const deu = (day: number, over: Partial<AiInput> = {}) =>
      aiPlan(
        input({
          tag: "DEU",
          personality: "aggressor",
          major: true,
          day,
          freeCivMilli: 20_000,
          regions: TWO_REGIONS,
          ...over,
        }),
      );
    const sw = AI_SWITCH_DAY.aggressor;
    // Infrastructure first, then free slots, then the id; three at most.
    expect(builds(deu(sw - 1))).toEqual(["3:civx3", "3:civx3", "1:civx3"]);
    expect(builds(deu(sw))).toEqual(["3:milx3", "3:milx3", "1:milx3"]);
    // Three military entries for each civilian one.
    const threeMil = Array.from({ length: 3 }, () => ({
      region: 9,
      building: "mil" as const,
      count: 1,
    }));
    expect(builds(deu(sw, { queue: threeMil, freeCivMilli: 60_000 }))).toEqual([
      "3:civx3",
      "3:milx3",
    ]);
    // At war: military only.
    expect(
      builds(deu(sw, { queue: threeMil, freeCivMilli: 60_000, warDays: 3 })),
    ).toEqual(["3:milx3", "3:milx3"]);
    // A full queue gets nothing more.
    expect(builds(deu(sw - 1, { queue: [...threeMil, ...threeMil] }))).toEqual(
      [],
    );
    // Democracies wait until 1939, minors until 1938 (no free factory:
    // one entry).
    const gbr = (day: number) =>
      builds(
        aiPlan(
          input({
            tag: "GBR",
            personality: "democracy",
            major: true,
            day,
            regions: TWO_REGIONS,
          }),
        ),
      );
    expect(gbr(sw)).toEqual(["3:civx3"]);
    expect(gbr(dayOfDate("1939-01-01"))).toEqual(["3:milx3"]);
    const pol = (day: number) =>
      builds(aiPlan(input({ day, regions: TWO_REGIONS })));
    expect(pol(dayOfDate("1937-12-31"))).toEqual(["3:civx3"]);
    expect(pol(dayOfDate("1938-01-01"))).toEqual(["3:milx3"]);
    // No slot anywhere: infrastructure where something is mined.
    expect(
      builds(
        aiPlan(
          input({
            freeCivMilli: 20_000,
            regions: [
              {
                ...TWO_REGIONS[0],
                free: 0,
                infraRoom: 2,
                res: res({ oil: 1 }),
              },
              {
                ...TWO_REGIONS[1],
                free: 0,
                infraRoom: 0,
                res: res({ oil: 9 }),
              },
              {
                region: 7,
                infra: 2,
                free: 0,
                infraRoom: 3,
                occupied: false,
                res: zeros(),
              },
            ],
          }),
        ),
      ),
    ).toEqual(["1:infrax1", "1:infrax1"]);
    // An occupied region takes no factories.
    expect(
      builds(
        aiPlan(
          input({
            regions: [{ ...TWO_REGIONS[1], occupied: true }, TWO_REGIONS[0]],
          }),
        ),
      ),
    ).toEqual(["1:civx3"]);
  });

  test("a lacking resource gets infrastructure where it is mined", () => {
    // Ten artillery factories want ten tungsten; a deposit of 40 at infra 3
    // gives 36, at infra 4 38: worth a level. A deposit of 4 gains nothing.
    const plan = aiPlan(
      input({
        freeCivMilli: 1_000,
        mil: 10,
        lines: [line(1, "artillery", 1, 10)],
        produced: res({ steel: 20 }),
        regions: [
          {
            region: 2,
            infra: 3,
            free: 2,
            infraRoom: 2,
            occupied: false,
            res: res({ tungsten: 4 }),
          },
          {
            region: 5,
            infra: 3,
            free: 0,
            infraRoom: 2,
            occupied: false,
            res: res({ tungsten: 40 }),
          },
        ],
      }),
    );
    expect(builds(plan)).toEqual(["5:infrax1", "2:civx2"]);
  });

  test("the biggest gap gets the idle factories", () => {
    const researched: WwTechId[] = [
      "inf_eq_1",
      "inf_eq_2",
      "support_eq_1",
      "artillery_1",
      "anti_tank_1",
    ];
    // A minor: infantry 60, artillery 20, support 10, anti-tank 10.
    expect(
      aiLineShares("POL", false, new Set(researched), false),
    ).toMatchObject({
      infantry_equipment: 60,
      support_equipment: 10,
      artillery: 20,
      anti_tank: 10,
      light_tank: 0,
    });
    // Ten factories: infantry 6 of 6, artillery 1 of 2, support 1 of 1,
    // anti-tank 0 of 1. Artillery and anti-tank tie, artillery comes first;
    // then anti-tank gets a new line.
    const lines = [
      line(1, "infantry_equipment", 1, 6),
      line(2, "artillery", 1, 1),
      line(3, "support_equipment", 1, 1),
    ];
    const plan = aiPlan(input({ researched, mil: 10, idleMil: 2, lines }));
    expect(
      plan.filter((o) => o.kind !== "research" && o.kind !== "build"),
    ).toEqual([
      { kind: "set_line_factories", line: 2, factories: 2 },
      { kind: "add_line", equipment: "anti_tank", gen: 1, factories: 1 },
    ]);
    // A new line takes the newest generation; extra factories go to the
    // type's most efficient line.
    const fresh = aiPlan(input({ researched, mil: 5, idleMil: 5 }));
    expect(only(fresh, "add_line")).toEqual([
      {
        kind: "add_line",
        equipment: "infantry_equipment",
        gen: 2,
        factories: 3,
      },
      {
        kind: "add_line",
        equipment: "support_equipment",
        gen: 1,
        factories: 1,
      },
      { kind: "add_line", equipment: "artillery", gen: 1, factories: 1 },
    ]);
    const two = aiPlan(
      input({
        researched,
        mil: 12,
        idleMil: 1,
        lines: [
          line(1, "infantry_equipment", 1, 3, { effBp: 4000 }),
          line(2, "infantry_equipment", 2, 3, { effBp: 4500 }),
          line(3, "artillery", 1, 3),
          line(4, "support_equipment", 1, 1),
          line(5, "anti_tank", 1, 1),
        ],
      }),
    );
    expect(only(two, "set_line_factories")).toEqual([
      { kind: "set_line_factories", line: 2, factories: 4 },
    ]);
    // Rifles piling up (stock > manpower / 10): five points go to the guns.
    expect(aiLineShares("POL", false, new Set(researched), true)).toMatchObject(
      { infantry_equipment: 55, artillery: 25 },
    );
    // A type whose lines got nothing at all yesterday gets no new factories.
    const starved = aiPlan(
      input({
        researched,
        mil: 10,
        idleMil: 2,
        lines: [
          line(1, "infantry_equipment", 1, 6),
          line(2, "artillery", 1, 1, { fill: 0 }),
          line(3, "support_equipment", 1, 1),
        ],
      }),
    );
    expect(only(starved, "add_line")).toEqual([
      { kind: "add_line", equipment: "anti_tank", gen: 1, factories: 1 },
    ]);
    expect(only(starved, "set_line_factories")).toEqual([
      { kind: "set_line_factories", line: 1, factories: 7 },
    ]);
    // Nearly capped (cap − 5 points) with a newer generation: one line moves up.
    const upgrade = aiPlan(
      input({
        researched,
        effCapBp: 5000,
        lines: [
          line(1, "artillery", 1, 2, { effBp: 5000 }),
          line(2, "infantry_equipment", 1, 2, { effBp: 4400 }),
          line(3, "infantry_equipment", 1, 2, { effBp: 4500 }),
          line(4, "infantry_equipment", 1, 2, { effBp: 4900 }),
        ],
      }),
    );
    expect(only(upgrade, "change_line")).toEqual([
      { kind: "change_line", line: 3, equipment: "infantry_equipment", gen: 2 },
    ]);
  });

  test("majors' lines lean to their doctrine; tanks are medium once researched", () => {
    const light = new Set<WwTechId>(["light_tank_1"]);
    const medium = new Set<WwTechId>(["light_tank_1", "medium_tank_1"]);
    // Spec §12.2 for a major, plus Germany's mobile-warfare lean (its
    // vehicles come out of guns and bombers, not rifles: Task 9).
    // (P2 Task 11: a major's support share is 10, out of the rifles.)
    // P4 lane AI (spec §17.5): the planes take 17 points (fighters 8,
    // heavy fighters 1, close support 5, naval bombers 2, transports 1;
    // the tactical bombers' 3 are the lean's), the ground lines share the
    // other 83 as they shared their 95 (largest remainders).
    expect(aiLineShares("DEU", true, light, false)).toEqual({
      infantry_equipment: 31,
      support_equipment: 9,
      artillery: 9,
      anti_tank: 4,
      anti_air: 4,
      motorized: 9,
      light_tank: 17,
      medium_tank: 0,
      fighter: 8,
      bomber: 0,
      heavy_fighter: 1,
      cas: 5,
      naval_bomber: 2,
      strat_bomber: 0,
      transport_plane: 1,
      cv_fighter: 0,
      cv_cas: 0,
      cv_naval_bomber: 0,
      convoy: 0,
    });
    expect(aiLineShares("SUN", true, medium, false)).toMatchObject({
      infantry_equipment: 39,
      artillery: 18,
      light_tank: 0,
      medium_tank: 9,
      motorized: 0,
      bomber: 0,
      cas: 5,
    });
    for (const tag of [
      "DEU",
      "ITA",
      "JPN",
      "GBR",
      "FRA",
      "USA",
      "SUN",
    ] as const) {
      const s = aiLineShares(tag, true, light, false);
      expect(Object.values(s).reduce((a, b) => a + b, 0)).toBe(100);
    }
  });

  test("a major short of support equipment moves rifle points to support (P2 Task 11)", () => {
    const light = new Set<WwTechId>(["light_tank_1"]);
    const base = aiLineShares("DEU", true, light, false);
    const short = aiLineShares("DEU", true, light, false, true);
    expect(short.support_equipment).toBe(
      base.support_equipment + AI_SUPPORT_SHORT_PTS,
    );
    expect(short.infantry_equipment).toBe(
      base.infantry_equipment - AI_SUPPORT_SHORT_PTS,
    );
    expect(Object.values(short).reduce((a, b) => a + b, 0)).toBe(100);
    // A minor's shares do not move.
    expect(aiLineShares("POL", false, light, false, true)).toEqual(
      aiLineShares("POL", false, light, false),
    );
    expect([AI_SUPPORT_RESERVE, AI_SUPPORT_SHORT_PTS]).toEqual([400, 5]);
  });

  test("P4 lane AI: the sea and air techs by role; none at sea for a landlocked country", () => {
    const last = WW_TECH_IDS.indexOf("rail_1");
    const p4 = (tag: CountryTag, coastal = true) =>
      aiResearchOrder(tag, coastal).filter(
        (t) => WW_TECH_IDS.indexOf(t) > last,
      );
    // The foundation's interim filter is gone: the naval powers order
    // their ship and plane techs in among the land ones.
    for (const tag of ["DEU", "GBR", "JPN", "USA", "ITA"] as const) {
      expect(p4(tag).length, tag).toBeGreaterThan(10);
    }
    // Germany submarines first, Britain sonar and radar, Japan and the
    // United States carriers; only the carrier navies research carriers.
    const firstSea = (tag: CountryTag) =>
      p4(tag).find((t) => aiTechDomain(t) === "sea");
    expect(firstSea("DEU")).toBe("trade_interdiction_1");
    expect(firstSea("GBR")).toBe("sonar_1");
    expect(firstSea("JPN")).toBe("base_strike_1");
    expect(p4("DEU").some((t) => t.startsWith("cv_"))).toBe(false);
    expect(p4("JPN").includes("cv_3")).toBe(true);
    // A landlocked country researches no sea tech; a minor no plane.
    for (const tag of ["DEU", "TUR", "HUN"] as const) {
      expect(p4(tag, false).some((t) => aiTechDomain(t) === "sea")).toBe(false);
    }
    expect(p4("TUR").every((t) => aiTechDomain(t) !== "air")).toBe(true);
    // (Synthetic oil is industry: the land's.)
    expect(p4("HUN", false)).toEqual(["synthetic_oil_1", "synthetic_oil_2"]);
    // Land techs are not starved: of 3 slots Britain keeps 2 for the
    // land, of 5 three; the Soviet Union keeps 3 of 3.
    expect(aiResearchCaps(aiResearchMix("GBR", true), 3)).toEqual({
      sea: 1,
      air: 0,
    });
    expect(aiResearchCaps(aiResearchMix("GBR", true), 5)).toEqual({
      sea: 1,
      air: 1,
    });
    expect(aiResearchCaps(aiResearchMix("SUN", true), 3)).toEqual({
      sea: 0,
      air: 0,
    });
    expect(aiResearchCaps(aiResearchMix("DEU", true), 5)).toEqual({
      sea: 1,
      air: 1,
    });
  });

  test("P4 lane AI: a sea or air slot over the cap waits for a land tech", () => {
    // Britain, 3 slots, every 1936 tech done but one land, one sea and
    // two air ones: the land and the sea take a slot each, air none (its
    // cap at 3 slots is 0), and the third slot stays with the land list.
    const done = WW_TECH_IDS.filter(
      (t) =>
        WW_TECHS[t].year === 1936 &&
        ![
          "construction_1",
          "electronics_1",
          "fleet_in_being_1",
          "strategic_destruction_1",
          "carrier_aviation",
        ].includes(t),
    );
    const picks = only(
      aiPlan(
        input({
          tag: "GBR",
          personality: "democracy",
          major: true,
          slotCount: 3,
          researched: done.filter((t) => {
            const s = WW_TECHS[t].school;
            return s === undefined;
          }),
        }),
      ),
      "research",
    ).map((o) => aiTechDomain(o.tech));
    expect(picks.filter((d) => d === "land").length).toBe(2);
    expect(picks.filter((d) => d !== "land").length).toBe(1);
  });

  test("doctrine by country", () => {
    const DONE_1936 = WW_TECH_IDS.filter(
      (t) => WW_TECHS[t].year === 1936 && WW_TECHS[t].school === undefined,
    );
    const school: Partial<Record<CountryTag, string>> = {
      DEU: "mobile",
      SUN: "mass",
      ITA: "firepower",
      JPN: "mass",
      GBR: "firepower",
      USA: "firepower",
      FRA: "battleplan",
      POL: "battleplan",
      IRL: "battleplan",
      CAN: "firepower",
    };
    for (const [tag, s] of Object.entries(school)) {
      const t = tag as CountryTag;
      expect(aiSchool(t)).toBe(s);
      const order = aiResearchOrder(t);
      // Every tech once; no other school's doctrine (P4 lane AI: the land
      // school, the sea school of a navy and the air school of a major).
      expect(new Set(order).size).toBe(order.length);
      const schools = new Set(
        order.map((id) => WW_TECHS[id].school).filter((x) => x !== undefined),
      );
      const own = [
        s,
        aiSeaSchool(t),
        COUNTRIES[t].major ? aiAirSchool(t) : null,
      ]
        .filter((x) => x !== null)
        .sort();
      expect([...schools].sort()).toEqual(own);
      // Every other 1936 tech done: on day 0 the free slot opens the school.
      const plan = aiPlan(
        input({
          tag: t,
          personality: aiPersonality(t),
          slotCount: 1,
          researched: DONE_1936,
        }),
      );
      expect(only(plan, "research").map((o) => o.tech)).toEqual([`${s}_1`]);
    }
    // France opens its battleplan first; Germany its tools and armour.
    const first = (tag: CountryTag) => aiResearchOrder(tag).slice(0, 2);
    expect(first("FRA")).toEqual(["battleplan_1", "battleplan_2"]);
    expect(first("DEU")).toEqual(["tools_1", "tools_2"]);
    expect(aiResearchOrder("SUN")[0]).toBe("inf_eq_1");
  });

  test("research stays within half a year of a tech's year, then nine months", () => {
    // Germany on day 0 (techs of spec §11.1): mobile_1, fortification_1
    // (P2 Task 6: the construction group) and electronics_1 are 1936 techs;
    // nothing else is within 50%, and a 1937 tech is a full year (100%)
    // ahead, past the 75% fallback: a fourth slot waits. From April 1936 a
    // 1937 tech is within the fallback. Nothing from 1938.
    const researched: WwTechId[] = [
      "inf_eq_1",
      "support_eq_1",
      "artillery_1",
      "motorized_1",
      "light_tank_1",
      "fighter_1",
      "bomber_1",
      "anti_tank_1",
      "anti_air_1",
      "construction_1",
      "tools_1",
      // P2: its land start techs (LandStart.landStartTechs).
      "engineer_company",
      "recon_company",
      "mountaineers",
      // P4: its sea and air start techs (EconomyStart.navalStartTechs).
      ...navalStartTechs("DEU", 5, true),
    ];
    const deu = (day: number, slotCount: number) =>
      only(
        aiPlan(
          input({
            tag: "DEU",
            personality: "aggressor",
            major: true,
            day,
            slotCount,
            researched,
          }),
        ),
        "research",
      ).map((o) => o.tech);
    expect(AI_FALLBACK_AHEAD_PCT).toBe(75);
    // P4 lane AI: of 3 slots the land keeps 2 (Germany's share 60%) and
    // its air doctrine takes the third; of 5 the land keeps 3 and the
    // sea (Commerce warfare) and the air take one each.
    expect(deu(0, 3)).toEqual([
      "battlefield_support_1",
      "mobile_1",
      "fortification_1",
    ]);
    expect(deu(0, 5)).toEqual([
      "battlefield_support_1",
      "trade_interdiction_1",
      "mobile_1",
      "fortification_1",
      "electronics_1",
    ]);
    // 1936-04-02: 1937 techs are 74% ahead (rail_1 leads them on
    // Germany's list, in its construction group) — but 4 slots keep 3
    // for the land (ceil 60%) and the air takes one: rail_1 waits.
    expect(deu(dayOfDate("1936-04-02"), 4)).toEqual([
      "battlefield_support_1",
      "mobile_1",
      "fortification_1",
      "electronics_1",
    ]);
    // Mid-1937: 1938 techs are 50% ahead; tools_2 leads Germany's list.
    expect(deu(dayOfDate("1937-07-04"), 1)).toEqual(["tools_2"]);
    // A busy slot is left alone.
    expect(
      only(
        aiPlan(
          input({
            tag: "DEU",
            personality: "aggressor",
            slots: ["mobile_1", null],
            slotCount: 2,
            researched,
          }),
        ),
        "research",
      ).map((o) => o.tech),
    ).toEqual(["fortification_1"]);
  });

  test("laws follow the personality, as far as P3's conditions allow", () => {
    const laws = (over: Partial<AiInput>) =>
      only(aiPlan(input(over)), "set_law").map((o) => `${o.law}:${o.value}`);
    const day1938 = dayOfDate("1938-01-01");
    const day1939 = dayOfDate("1939-01-01");
    const aggressor = {
      tag: "DEU" as const,
      personality: "aggressor" as const,
      laws: {
        economy: "early_mobilization" as const,
        trade: "limited_exports" as const,
        conscription: "limited" as const,
      },
    };
    // P3 spec §7.2: partial mobilisation needs 30% war support (or a war),
    // no longer 1937; war economy at war; total mobilisation after a year
    // of war only with 70% war support, else as high as allowed.
    expect(laws({ ...aggressor, wsBp: 2999 })).toEqual([]);
    expect(laws(aggressor)).toEqual(["economy:partial_mobilization"]);
    expect(laws({ ...aggressor, warDays: 0 })).toEqual([
      "economy:war_economy",
      "conscription:extensive",
    ]);
    expect(laws({ ...aggressor, warDays: 365 })).toEqual([
      "economy:war_economy",
      "conscription:extensive",
    ]);
    expect(laws({ ...aggressor, warDays: 365, wsBp: 7000 })).toEqual([
      "economy:total_mobilization",
      "conscription:extensive",
    ]);
    // In peace only aggressors draft more, from 1938.
    expect(laws({ ...aggressor, day: day1938 })).toEqual([
      "economy:partial_mobilization",
      "conscription:extensive",
    ]);
    expect(laws({ day: day1938 })).toEqual(["economy:early_mobilization"]);
    // Democracies: early in 1938, partial in 1939 (with 25% tension) or at
    // war, war economy after 180 days of war.
    const democracy = {
      tag: "GBR" as const,
      personality: "democracy" as const,
      ruling: 0,
    };
    expect(laws({ ...democracy, day: day1938 - 1 })).toEqual([]);
    expect(laws({ ...democracy, day: day1938 })).toEqual([
      "economy:early_mobilization",
    ]);
    expect(laws({ ...democracy, day: day1939 })).toEqual([
      "economy:early_mobilization",
    ]);
    expect(laws({ ...democracy, day: day1939, wtBp: 2500 })).toEqual([
      "economy:partial_mobilization",
    ]);
    expect(laws({ ...democracy, warDays: 179 })).toEqual([
      "economy:partial_mobilization",
      "conscription:extensive",
    ]);
    expect(laws({ ...democracy, warDays: 180 })).toEqual([
      "economy:war_economy",
      "conscription:extensive",
    ]);
    // Minors: partial at war, war economy after a year of it.
    expect(laws({ warDays: 364 })).toEqual([
      "economy:partial_mobilization",
      "conscription:extensive",
    ]);
    expect(laws({ warDays: 365 })).toEqual([
      "economy:war_economy",
      "conscription:extensive",
    ]);
    // Manpower under a fifth of the pool at war: one step up, if allowed
    // (all adults: at war and 70% war support).
    const dry = {
      warDays: 400,
      wsBp: 7000,
      laws: {
        economy: "war_economy" as const,
        trade: "export_focus" as const,
        conscription: "service" as const,
      },
      manpower: 100,
      recruitable: 1_000,
    };
    expect(laws(dry)).toEqual(["conscription:all_adults"]);
    expect(laws({ ...dry, wsBp: 6999 })).toEqual([]);
    expect(laws({ ...dry, manpower: 200 })).toEqual([]);
    // A law changed in the last 30 days stays.
    expect(
      laws({
        ...aggressor,
        warDays: 0,
        lawCooldownUntil: { economy: 5, trade: -1, conscription: -1 },
      }),
    ).toEqual(["conscription:extensive"]);
  });

  // Task 15: the fuel's oil is bought too (its stock under half the
  // capacity: aiInput's fuelOil); one unit serves the lines and the fuel.
  test("buy oil for fuel", () => {
    expect(withFuelOil(res({ oil: 4 }), 10)[RESOURCE_IDS.indexOf("oil")]).toBe(
      10,
    );
    expect(withFuelOil(res({ oil: 12 }), 10)[RESOURCE_IDS.indexOf("oil")]).toBe(
      12,
    );
    const partners = [
      { smallID: 7, sameFaction: false, room: res({ oil: 80 }) },
    ];
    const buy = (fuelOil: number, produced = res({ oil: 2 })) =>
      only(
        aiPlan(
          input({
            freeCivMilli: 20_000,
            payableCivs: 10,
            partners,
            produced,
            fuelOil,
          }),
        ),
        "open_trade",
      );
    // 12 oil wanted, 2 of its own: 10 to buy, two factories' worth (8 each).
    expect(buy(12)).toEqual([
      { kind: "open_trade", seller: 7, resource: "oil", civs: 2 },
    ]);
    expect(buy(0)).toEqual([]);
    expect(buy(10, res({ oil: 10 }))).toEqual([]);
    expect(AI_FUEL_OIL_MAX).toBe(30);
  });

  test("buy what lines lack, at most 30% of free civs", () => {
    // Ten artillery factories: steel 20 (all mined), tungsten 10 (none):
    // two factories' worth of tungsten to buy.
    const lines = [line(1, "artillery", 1, 10)];
    const partners = [
      { smallID: 4, sameFaction: false, room: res({ tungsten: 40 }) },
      { smallID: 5, sameFaction: true, room: res({ tungsten: 8 }) },
      { smallID: 2, sameFaction: false, room: res({ tungsten: 40 }) },
    ];
    const buy = (over: Partial<AiInput>) =>
      only(
        aiPlan(
          input({
            mil: 10,
            lines,
            produced: res({ steel: 20 }),
            payableCivs: 10,
            partners,
            ...over,
          }),
        ),
        "open_trade",
      );
    // 4 free civilian factories: 30% is one.
    expect(buy({ freeCivMilli: 4_000 })).toEqual([
      { kind: "open_trade", seller: 5, resource: "tungsten", civs: 1 },
    ]);
    // Enough money: the faction partner first, then the most room, then the
    // lower smallID.
    expect(buy({ freeCivMilli: 20_000 })).toEqual([
      { kind: "open_trade", seller: 5, resource: "tungsten", civs: 1 },
      { kind: "open_trade", seller: 2, resource: "tungsten", civs: 1 },
    ]);
    // Never past the factories it can pay with. Where 30% rounds to
    // nothing, a line that lacks something still gets one factory's worth
    // (Task 9: small economies traded never); not without a free factory.
    expect(buy({ freeCivMilli: 20_000, paidCivs: 9 })).toHaveLength(1);
    expect(buy({ freeCivMilli: 3_000 })).toEqual([
      { kind: "open_trade", seller: 5, resource: "tungsten", civs: 1 },
    ]);
    expect(buy({ freeCivMilli: 999 })).toEqual([]);
    // Nothing lacking, nothing bought.
    expect(
      buy({ freeCivMilli: 20_000, produced: res({ steel: 20, tungsten: 10 }) }),
    ).toEqual([]);
    // Imports 8 or more past the need: the newest deal that fits closes.
    const close = only(
      aiPlan(
        input({
          mil: 10,
          lines,
          produced: res({ steel: 20, tungsten: 10 }),
          imported: res({ steel: 24 }),
          buying: [
            { id: 3, seller: 2, res: RESOURCE_IDS.indexOf("steel"), civs: 1 },
            { id: 7, seller: 4, res: RESOURCE_IDS.indexOf("steel"), civs: 2 },
            { id: 9, seller: 5, res: RESOURCE_IDS.indexOf("steel"), civs: 5 },
          ],
        }),
      ),
      "close_trade",
    );
    expect(close).toEqual([{ kind: "close_trade", trade: 7 }]);
  });
});

describe("between its turns an AI takes up what fell free (Task 9)", () => {
  test("day 0 is every major's turn, then every ten days", () => {
    for (const id of [1, 2, 7]) expect(isAiTurn(id, 0, true)).toBe(true);
    expect(isAiTurn(41, 0, false)).toBe(false);
    expect(isAiTurn(41, 0, true)).toBe(true);
    expect(isAiTurn(10, 0, false)).toBe(true);
    expect(isAiTurn(1, 9, true)).toBe(true);
    expect(isAiTurn(1, 10, true)).toBe(false);
    expect(isAiTurn(4, 6, true)).toBe(true);
    expect(isAiTurn(4, 7, true)).toBe(false);
  });

  test("a reaction writes only the steps that fell free, as the turn would", () => {
    const researched: WwTechId[] = ["inf_eq_1", "support_eq_1", "artillery_1"];
    const busy = input({
      tag: "POL",
      day: 100,
      // A law it would raise, a deal it would make: not between turns.
      warDays: 0,
      researched,
      slots: [null, "construction_1"],
      slotCount: 2,
      mil: 4,
      idleMil: 2,
      lines: [line(1, "infantry_equipment", 1, 2, { effBp: 4900 })],
      freeCivMilli: 20_000,
      payableCivs: 10,
      partners: [
        { smallID: 3, sameFaction: false, room: res({ tungsten: 40 }) },
      ],
      regions: TWO_REGIONS,
    });
    const all = { research: true, lines: true, construction: true };
    const full = aiPlan(busy);
    const react = aiReactPlan(busy, all);
    expect(only(react, "set_law")).toEqual([]);
    expect(only(react, "open_trade")).toEqual([]);
    expect(only(react, "change_line")).toEqual([]);
    expect(only(full, "set_law").length).toBeGreaterThan(0);
    expect(only(full, "open_trade").length).toBeGreaterThan(0);
    // The rest as the turn writes it.
    for (const kind of [
      "research",
      "build",
      "set_line_factories",
      "add_line",
    ] as const) {
      expect(only(react, kind)).toEqual(only(full, kind));
    }
    // Only what is asked.
    expect(
      aiReactPlan(busy, { research: true, lines: false, construction: false }),
    ).toEqual(only(full, "research"));
    expect(
      aiReactPlan(busy, { research: false, lines: false, construction: true })
        .map((o) => o.kind)
        .every((k) => k === "build"),
    ).toBe(true);
  });

  test("every line near its cap may retool, in line order", () => {
    const researched = new Set<WwTechId>([
      "inf_eq_1",
      "inf_eq_2",
      "artillery_1",
      "artillery_2",
    ]);
    expect(
      aiRetools(
        [
          line(1, "infantry_equipment", 1, 4, { effBp: 4400 }),
          line(2, "artillery", 1, 2, { effBp: 4600 }),
          line(3, "infantry_equipment", 2, 2, { effBp: 5000 }),
          line(4, "infantry_equipment", 1, 2, { effBp: 4500 }),
        ],
        researched,
        5000,
      ),
    ).toEqual([
      { kind: "change_line", line: 2, equipment: "artillery", gen: 2 },
      { kind: "change_line", line: 4, equipment: "infantry_equipment", gen: 2 },
    ]);
  });

  test("light tank lines count against the tank share once mediums are researched", () => {
    const researched: WwTechId[] = [
      "inf_eq_1",
      "support_eq_1",
      "artillery_1",
      "motorized_1",
      "light_tank_1",
      "light_tank_2",
      "medium_tank_1",
      "fighter_1",
      "bomber_1",
      "anti_tank_1",
      "anti_air_1",
    ];
    // Germany, 20 factories, 4 of them on light tanks: the 20% tank share
    // is met, so the 4 idle ones go elsewhere and no medium line opens.
    const plan = aiPlan(
      input({
        tag: "DEU",
        personality: "aggressor",
        major: true,
        researched,
        mil: 20,
        idleMil: 4,
        lines: [
          line(1, "infantry_equipment", 1, 8),
          line(2, "light_tank", 2, 4),
          line(3, "motorized", 1, 2),
          line(4, "artillery", 1, 2),
        ],
      }),
    );
    expect(
      only(plan, "add_line").filter((o) => o.equipment === "medium_tank"),
    ).toEqual([]);
  });

  test("after the switch the queue puts military factories first", () => {
    const deu = (day: number) =>
      aiPlan(
        input({
          tag: "DEU",
          personality: "aggressor",
          major: true,
          day,
          freeCivMilli: 20_000,
          queue: [
            { region: 1, building: "civ", count: 3 },
            { region: 3, building: "infra", count: 1 },
          ],
          regions: TWO_REGIONS,
        }),
      );
    expect(only(deu(AI_SWITCH_DAY.aggressor - 1), "military_first")).toEqual(
      [],
    );
    expect(only(deu(AI_SWITCH_DAY.aggressor), "military_first")).toEqual([
      { kind: "military_first" },
    ]);
  });
});

// ---- In the game (test map: DEU 1, ITA 2, GBR 3, FRA 4, SUN 5, POL 6) ----

const dayStart = (d: number) => dayStartTick(d, WW_PREP_TICKS);
/** Through day `d`: every country has had that day's step. */
const throughDay = (runner: GameRunner, d: number) =>
  stepTo(runner, dayStart(d + 1));
/** The first day on or after `from` that is `smallID`'s AI day. */
const aiDay = (smallID: number, from = 0) => {
  let d = from;
  while ((d + smallID) % WW_AI_PERIOD_DAYS !== 0) d++;
  return d;
};

async function allAi() {
  const runner = await wwRunner();
  const g = runner.game;
  const ww = g.worldWar()!;
  const econ = ww.economy;
  const ce = (tag: CountryTag) => econ.country(byTag(g, tag).smallID())!;
  return { runner, g, ww, econ, ce };
}

describe("the AI economy in a game (spec §12)", () => {
  test("an AI fills its queue with civilian factories before its switch", async () => {
    const { runner, ce } = await allAi();
    const deu = ce("DEU");
    // Day 0 is every country's first turn (Task 9), on its own tick.
    stepTo(runner, dayStart(0) + (deu.smallID % WW_DAY_SPLIT));
    expect(deu.queue).toEqual([]);
    stepTo(runner, dayStart(0) + (deu.smallID % WW_DAY_SPLIT) + 1);
    // 5.25 free factories: two entries. Berlin (4 free slots) before
    // Munich (2), both infra 5.
    expect(
      deu.queue.map((q) => `${q.region}:${q.building}x${q.count}`),
    ).toEqual(["3:civx3", "4:civx2"]);
    // Rome has no free slot: Italy builds infrastructure there instead.
    throughDay(runner, 0);
    const ita = ce("ITA");
    expect(ita.queue.length).toBeGreaterThan(0);
    expect(
      ita.queue.every((q) => q.region === 5 && q.building === "infra"),
    ).toBe(true);
  });

  test("after the switch it builds military factories, ahead of the civilian ones", async () => {
    const { runner, ce } = await allAi();
    const deu = ce("DEU");
    const gbr = ce("GBR");
    const day = aiDay(deu.smallID, AI_SWITCH_DAY.aggressor);
    expect(day).toBe(189);
    stepTo(runner, dayStart(day));
    deu.queue = [];
    throughDay(runner, day);
    expect(deu.queue.length).toBeGreaterThan(0);
    expect(deu.queue.every((q) => q.building === "mil")).toBe(true);
    // Britain is a democracy: still civilian factories on its next turn.
    const gday = aiDay(gbr.smallID, day);
    stepTo(runner, dayStart(gday));
    gbr.queue = [];
    throughDay(runner, gday);
    expect(gbr.queue.some((q) => q.building === "civ")).toBe(true);
    expect(gbr.queue.some((q) => q.building === "mil")).toBe(false);
    // Civilian entries left from before the switch wait behind the
    // military ones (Task 9), their progress kept.
    const next = aiDay(deu.smallID, day + 1);
    stepTo(runner, dayStart(next));
    const civ = {
      region: 3,
      building: "civ" as const,
      count: 1,
      progress: 1234,
      lastAssigned: 0,
      lastSpeedPct: 0,
    };
    deu.queue = [civ, ...deu.queue.slice(0, 1)];
    throughDay(runner, next);
    const kinds = deu.queue.map((q) => q.building);
    expect(kinds[0]).toBe("mil");
    expect(kinds.indexOf("civ")).toBe(kinds.lastIndexOf("civ"));
    expect(kinds.slice(kinds.indexOf("civ") + 1)).toEqual([]);
    // (It was still in front for that day's building.)
    expect(
      deu.queue.find((q) => q.building === "civ")!.progress,
    ).toBeGreaterThan(1234);
  });

  test("idle factories get a line, and new ones the day they appear", async () => {
    const { runner, econ, ce } = await allAi();
    const deu = ce("DEU");
    // Every country starts with its military factories on lines (HOI4's
    // 1936 start, aiStartSetup): nothing idles on day 0.
    const factories = deu.lines.reduce((s, l) => s + l.factories, 0);
    expect(factories).toBe(6);
    expect(deu.totals.idleMil).toBe(0);
    const start = deu.lines.map((l) => ({ ...l }));
    throughDay(runner, 0);
    expect(deu.lines.map((l) => [l.id, l.key, l.factories])).toEqual(
      start.map((l) => [l.id, l.key, l.factories]),
    );
    // Infantry equipment heads the list and has the most.
    expect(deu.lines[0].key).toBe(equipKey("infantry_equipment", 1));
    expect(Math.max(...deu.lines.map((l) => l.factories))).toBe(
      deu.lines[0].factories,
    );
    throughDay(runner, 1);
    expect(deu.totals.idleMil).toBe(0);
    expect(deu.lines.every((l) => l.active === l.factories)).toBe(true);
    // Two military factories finish on day 4 (not a turn of Germany's):
    // on day 5 they work on a line already, not on day 9.
    expect(isAiTurn(deu.smallID, 5, true)).toBe(false);
    stepTo(runner, dayStart(5));
    econ.addBuilding(4, "mil", 2);
    throughDay(runner, 5);
    expect(deu.lines.reduce((s, l) => s + l.factories, 0)).toBe(8);
    throughDay(runner, 6);
    expect(deu.totals.idleMil).toBe(0);
  });

  test("research slots start filled, and get filled again the day a tech is done", async () => {
    const { runner, econ, ce } = await allAi();
    // Every slot at work from the start (aiStartSetup). A 1937 tech is a
    // year ahead on day 0, past the fallback: Germany's third slot takes
    // the least early one (a HOI4 player fills every slot). P2 Task 6:
    // fortification_1 (1936, its construction group) comes before
    // electronics_1 (the tail) and fills the third slot.
    for (const tag of ["DEU", "ITA", "GBR", "FRA", "SUN", "POL"] as const) {
      const c = ce(tag);
      expect(c.slots).toHaveLength(c.totals.slotCount);
      expect(c.slots.every((s) => s !== null)).toBe(true);
    }
    expect(ce("DEU").slots.map((s) => s!.tech)).toEqual([
      "mobile_1",
      "fortification_1",
      "electronics_1",
    ]);
    // Poland (a minor: construction first) takes the fort tech next.
    expect(ce("POL").slots.map((s) => s!.tech)).toEqual([
      "construction_1",
      "fortification_1",
    ]);
    throughDay(runner, 0);
    expect(ce("DEU").slots.map((s) => s!.tech)).toEqual([
      "mobile_1",
      "fortification_1",
      "electronics_1",
    ]);
    throughDay(runner, dayOfDate("1936-04-02"));
    for (const tag of ["DEU", "ITA", "GBR", "FRA", "SUN", "POL"] as const) {
      const c = ce(tag);
      expect(c.slots).toHaveLength(c.totals.slotCount);
      expect(c.slots.every((s) => s !== null)).toBe(true);
    }
    // mobile_1 is done on a day that is not a turn of Germany's (its last
    // day's worth left before it): a new tech starts that same day (not up
    // to ten days later), and any slot still empty has nothing within reach.
    const deu = ce("DEU");
    let day = dayOfDate("1936-04-02") + 1;
    while (isAiTurn(deu.smallID, day, true)) day++;
    stepTo(runner, dayStart(day));
    const mobile = deu.slots.find((s) => s?.tech === "mobile_1")!;
    mobile.progress = techDays(WW_TECHS.mobile_1.year) * 1000 - 1000;
    throughDay(runner, day);
    expect(deu.researched.has("mobile_1")).toBe(true);
    expect(deu.slots.some((s) => s !== null && s.progress === 0)).toBe(true);
    const react = aiReactions(deu);
    expect(
      only(
        aiReactPlan(aiInput(econ, deu, day, runner.game.ticks()), react),
        "research",
      ),
    ).toEqual([]);
  });

  test("an AI at war moves to war economy", async () => {
    const { runner, g, ww, ce } = await allAi();
    const ita = ce("ITA");
    const fra = ce("FRA");
    stepTo(runner, dayStart(1));
    expect(ww.setWar(ita.smallID, fra.smallID, g.ticks())).toBe(true);
    // P3 spec §7.1: laws cost political power (the foundation's stub day
    // gives none; plan Task 1 Step 20).
    for (const c of [ita, fra])
      ww.politics.country(c.smallID)!.ppMilli = 500_000;
    // France's turn (day 6): a democracy at war mobilises partially (and
    // already has extensive conscription); Italy's (day 8): war economy.
    throughDay(runner, aiDay(fra.smallID));
    expect(fra.laws).toMatchObject({
      economy: "partial_mobilization",
      conscription: "extensive",
    });
    expect(ita.laws.economy).toBe("partial_mobilization");
    throughDay(runner, aiDay(ita.smallID));
    expect(ita.laws).toMatchObject({
      economy: "war_economy",
      conscription: "extensive",
    });
  });

  test("an AI buys a resource its lines lack", async () => {
    const { runner, ww, econ, ce } = await allAi();
    const ita = ce("ITA");
    const fra = ce("FRA");
    const gbr = ce("GBR");
    // P4 spec §10.2 (lane C): the sea way is a route between naval bases;
    // Rome gets one, as P1's shared sea zone made Britain Italy's partner.
    econ.buildingArray("naval_base")[5] = 1;
    econ.afterBuildingChange(5, "naval_base");
    // Their first turns: day 0, each on its own tick (Italy's 2, France's 4).
    throughDay(runner, 0);
    // Italy's artillery line wants tungsten; Britain sells it across the
    // sea. France, later on the day, finds London's room taken: its guns
    // wait (first come, first served, as in a market).
    const deals = (buyer: number) =>
      econ.trades().filter((t) => t.buyer === buyer);
    expect(deals(ita.smallID)).toContainEqual(
      expect.objectContaining({
        seller: gbr.smallID,
        res: RESOURCE_IDS.indexOf("tungsten"),
        civs: 1,
      }),
    );
    expect(
      deals(fra.smallID).filter(
        (t) => t.res === RESOURCE_IDS.indexOf("tungsten"),
      ),
    ).toEqual([]);
    expect(
      exportRoom(econ, gbr.smallID, RESOURCE_IDS.indexOf("tungsten")),
    ).toBeLessThan(8);
    // The plan's export room is Trade.exportRoom, partner by partner.
    for (const c of econ.countries()) {
      const i = aiInput(econ, c, econ.day(), runner.game.ticks());
      for (const p of i.partners) {
        RESOURCE_IDS.forEach((_, r) =>
          expect(p.room[r]).toBe(exportRoom(econ, p.smallID, r)),
        );
        expect(p.sameFaction).toBe(ww.sameFaction(c.smallID, p.smallID));
      }
    }
  });

  test("humans pick first: the AIs buy only after the preparation minute", async () => {
    // France is a human's; Italy's starting artillery wants tungsten, and
    // London sells one deal of it (as above, Italy takes it on day 0).
    const runner = await wwRunner({}, [{ clientID: HUMAN, country: "FRA" }]);
    const g = runner.game;
    const econ = g.worldWar()!.economy;
    const [fra, ita, gbr] = (["FRA", "ITA", "GBR"] as const).map((t) =>
      byTag(g, t),
    );
    const TUNGSTEN = RESOURCE_IDS.indexOf("tungsten");
    const human = () => econ.trades().every((t) => t.buyer === fra.smallID());
    stepTo(runner, 10);
    step(runner, 1, [
      stamped(HUMAN, {
        type: "ww_order",
        order: {
          kind: "open_trade",
          seller: gbr.id(),
          resource: "tungsten",
          civs: 1,
        },
      }),
    ]);
    // No AI deal through the whole preparation minute.
    while (g.worldWar()!.inPrep(g.ticks())) {
      step(runner);
      expect(human()).toBe(true);
    }
    expect(
      econ.trades().map((t) => [t.buyer, t.seller, t.res, t.civs]),
    ).toEqual([[fra.smallID(), gbr.smallID(), TUNGSTEN, 1]]);
    // From day 0 the AIs trade; London's tungsten stays France's.
    throughDay(runner, 0);
    expect(human()).toBe(false);
    expect(
      econ
        .trades()
        .filter((t) => t.seller === gbr.smallID() && t.res === TUNGSTEN)
        .map((t) => t.buyer),
    ).toEqual([fra.smallID()]);
    expect(econ.country(ita.smallID())!.lines.length).toBeGreaterThan(0);
    expect(exportRoom(econ, gbr.smallID(), TUNGSTEN)).toBeLessThan(8);
  });

  test("humans get no AI", async () => {
    const runner = await wwRunner({}, [{ clientID: HUMAN, country: "DEU" }]);
    const g = runner.game;
    const econ = g.worldWar()!.economy;
    const deu = econ.country(byTag(g, "DEU").smallID())!;
    const ita = econ.country(byTag(g, "ITA").smallID())!;
    const laws = { ...deu.laws };
    // The starting lines and research are the player's from then on.
    const lines = () => deu.lines.map((l) => [l.id, l.key, l.factories]);
    const slots = () => deu.slots.map((s) => s?.tech ?? null);
    const [startLines, startSlots] = [lines(), slots()];
    expect(startLines.length).toBeGreaterThan(0);
    throughDay(runner, 29);
    expect(deu.queue).toEqual([]);
    expect(lines()).toEqual(startLines);
    expect(slots()).toEqual(startSlots);
    expect(deu.laws).toEqual(laws);
    expect(econ.trades().some((t) => t.buyer === deu.smallID)).toBe(false);
    // The AI next door did act.
    expect(ita.lines.length).toBeGreaterThan(0);
  });

  test("over 400 days the AIs keep their industry busy, the same way every time", async () => {
    const run = async () => {
      const { runner, g, econ } = await allAi();
      const start = econ.countries().map((c) => ({
        civ: c.totals.civ,
        researched: c.researched.size,
      }));
      const t0 = performance.now();
      throughDay(runner, 400);
      const ms = performance.now() - t0;
      return { g, econ, start, ms };
    };
    const a = await run();
    for (const c of a.econ.countries()) {
      const p = a.g.playerBySmallID(c.smallID);
      if (!p.isPlayer() || !p.isAlive()) continue;
      const before = a.start[c.smallID - 1];
      // Lines take every military factory, something is being built,
      // research went on.
      expect(c.lines.length).toBeGreaterThan(0);
      expect(c.totals.idleMil).toBe(0);
      expect(c.queue.length).toBeGreaterThan(0);
      expect(c.queue.length).toBeLessThanOrEqual(WW_MAX_QUEUE);
      expect(c.researched.size).toBeGreaterThan(before.researched);
    }
    // Germany and the Soviet Union built civilian factories.
    for (const tag of ["DEU", "SUN"] as const) {
      const c = a.econ.country(byTag(a.g, tag).smallID())!;
      expect(c.totals.civ).toBeGreaterThan(a.start[c.smallID - 1].civ);
    }
    // Deterministic: a second run ends in the same economy.
    const b = await run();
    expect(b.econ.hash()).toBe(a.econ.hash());
    console.log(
      `ww1936mini: 400 days with the AI economy in ${a.ms.toFixed(0)} ms (${(a.ms / 400).toFixed(2)} ms/day, whole game)`,
    );
    // Every country's AI turn, timed alone (a tenth of them run each day).
    const ces = a.econ.countries();
    const t0 = performance.now();
    for (let rep = 0; rep < 100; rep++) {
      for (const c of ces) aiPlan(aiInput(a.econ, c, 400, a.g.ticks()));
    }
    const perTurn = (performance.now() - t0) / (100 * ces.length);
    console.log(`ww1936mini: one AI turn ${(perTurn * 1000).toFixed(1)} µs`);
    expect(perTurn).toBeLessThan(2);
  }, 60_000);
});
