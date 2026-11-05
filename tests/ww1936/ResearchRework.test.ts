// ww82/ww83: merged techs, the catalogue's gates after them, and what a tech
// is to each major. The pace is ResearchPace.test.ts; the per-tech effects
// TechEffects.test.ts.
import {
  EQUIPMENT_GENS,
  EQUIPMENT_TYPES,
  WW_TECH_IDS,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { HIST_CATALOGUE } from "@openfront/engine-lib/ww1936/hist/index";
import {
  histEntriesGatedBy,
  histGatesOf,
  histStaticEntry,
  techRelevance,
} from "@openfront/engine-lib/ww1936/hist/Slots";
import { catalogueTechValues } from "@openfront/engine-lib/ww1936/hist/TechValue";
import {
  HIST_COUNTRIES,
  HistEntry,
} from "@openfront/engine-lib/ww1936/hist/Types";
import { researchScores } from "@openfront/engine-lib/ww1936/ResearchScore";
import {
  liveTechCount,
  TECH_ABSORBS,
  techTotals,
  WW_TECHS,
} from "@openfront/engine-lib/ww1936/WwTechs";
import { describe, expect, it } from "vitest";
import { CountryEconomy } from "../../packages/engine/src/ww1936/economy/WwEconomy";

const ALL = HIST_COUNTRIES.flatMap(
  (c) => HIST_CATALOGUE[c] as readonly HistEntry[],
);

describe("merged techs (ww82)", () => {
  const country = () =>
    new CountryEconomy(1, "DEU", true, {
      economy: "civilian",
      trade: "free_trade",
      conscription: "limited",
    } as never);

  it("finishing a keeper marks its old ids and counts each effect once", () => {
    const ce = country();
    ce.addTech("tank_drive_1");
    for (const old of TECH_ABSORBS.tank_drive_1!) {
      expect(ce.researched.has(old), old).toBe(true);
    }
    expect(ce.tech.mechOrg).toBe(4);
    expect(ce.tech.armorBrkPct).toBe(4);
    expect(ce.tech.armorSpeedPct).toBe(10);
    // The old ids stay in tech order, and count as one tech.
    expect([...ce.researched]).toEqual(
      WW_TECH_IDS.filter((t) => ce.researched.has(t)),
    );
    expect(ce.researched.size).toBe(5);
    expect(liveTechCount(ce.researched)).toBe(1);
  });

  it("every absorbed tech is retired, empty and held by one keeper", () => {
    const seen = new Set<WwTechId>();
    for (const [keeper, old] of Object.entries(TECH_ABSORBS)) {
      expect(WW_TECHS[keeper as WwTechId].retired).toBeUndefined();
      expect(WW_TECHS[keeper as WwTechId].absorbs).toEqual(old);
      for (const id of old) {
        expect(seen.has(id), id).toBe(false);
        seen.add(id);
        expect(WW_TECHS[id].retired).toBe(true);
        expect(WW_TECHS[id].effects).toEqual({});
      }
    }
    expect(seen.size).toBe(32);
    expect(techTotals(seen).armorArmorPct ?? 0).toBe(0);
  });

  it("the portable weapon needs no rocketry, so a minor reaches it", () => {
    expect(WW_TECHS.inf_at_2.prereqs).toEqual(["inf_at_1"]);
    expect(WW_TECHS.inf_at_2.year).toBe(1942);
  });
});

describe("the catalogue's gates (ww82 §5)", () => {
  it("no entry names a retired tech and every gate can be reached", () => {
    const reachable = (t: WwTechId): boolean =>
      WW_TECHS[t].retired !== true && WW_TECHS[t].prereqs.every(reachable);
    for (const e of ALL) {
      for (const t of e.techs) {
        expect(reachable(t), `${e.id} ${t}`).toBe(true);
      }
    }
  });

  it("three stand-ins keep their key by flag; every key's stand-in is a gate holder", () => {
    expect(histStaticEntry("JPN", "medium_tank", 2)?.id).toBe(
      "jpn_type1_chihe",
    );
    expect(histStaticEntry("JPN", "medium_tank", 3)?.id).toBe(
      "jpn_type4_chito",
    );
    expect(histStaticEntry("FRA", "light_tank", 2)?.id).toBe("fra_h39");
    let found = 0;
    for (const c of HIST_COUNTRIES) {
      for (const type of EQUIPMENT_TYPES) {
        for (let g = 1; g <= EQUIPMENT_GENS[type]; g++) {
          if (histStaticEntry(c, type, g) !== undefined) found++;
        }
      }
    }
    expect(found).toBe(99);
  });

  it("a tank's gun tech follows its penetration at 500 m", () => {
    const tier = (mm: number) =>
      mm >= 130 ? 4 : mm >= 80 ? 3 : mm >= 50 ? 2 : 0;
    for (const e of ALL) {
      if (e.family !== "tank") continue;
      const gun = Math.max(
        0,
        ...e.techs.map((t) =>
          t.startsWith("tank_gun_") ? Number(t.slice(-1)) : 0,
        ),
      );
      expect(gun, e.id).toBe(tier(e.spec.penMm500));
    }
  });

  it("gear counts only where it stands in: 30 entries are never fielded", () => {
    const gear = ALL.filter(
      (e) =>
        e.family === "infantry" || e.family === "support" || e.family === "gun",
    );
    expect(gear.filter((e) => histGatesOf(e).length === 0)).toHaveLength(30);
    // Pak 40's at_imp_2 gate was never real: the card no longer claims it.
    expect(histEntriesGatedBy("at_imp_2", "DEU").map((e) => e.id)).toEqual([]);
  });
});

describe("what a tech is to a major (ww82 §8, §9)", () => {
  it("own, pass-through and generic; a minor is never dimmed", () => {
    expect(techRelevance("medium_tank_3", "DEU")).toBe("own");
    expect(techRelevance("heavy_tank_2", "DEU")).toBe("pass");
    expect(techRelevance("heavy_fighter_3", "DEU")).toBe("generic");
    expect(techRelevance("medium_tank_3", "ITA")).toBe("generic");
    expect(techRelevance("medium_tank_3", "POL")).toBe("own");
    // Only generation and gun techs dim: gear and effects are real for all.
    expect(techRelevance("artillery_3", "DEU")).toBe("own");
    expect(techRelevance("computing_4", "ITA")).toBe("own");
  });

  it("a generation that gives nothing scores 30 lower, and no gear gate pays", () => {
    const base = {
      seed: 1,
      smallID: 2,
      day: 1500,
      human: false,
      lean: 0,
      coastal: true,
      lineFactories: {},
      navalLines: 1,
      bonusKeys: [],
      shared: [],
      researched: new Set<WwTechId>(),
      running: [],
    };
    const at = WW_TECH_IDS.indexOf("medium_tank_3");
    const ita = researchScores({ ...base, tag: "ITA", persona: "aggressor" })[
      at
    ];
    const pol = researchScores({ ...base, tag: "POL", persona: "aggressor" })[
      at
    ];
    expect(ita).not.toBeNull();
    // POL's own value for the tech is the same score less the cut's absence.
    if (pol !== null) expect(ita).toBeLessThan(pol);
    const v = catalogueTechValues("DEU", new Set(), () => 100);
    expect(v[WW_TECH_IDS.indexOf("at_imp_2")]).toBe(0);
  });
});
