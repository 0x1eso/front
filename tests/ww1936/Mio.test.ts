// World War 1936 P6 (plan Task 4, spec §6): military industrial
// organisations — funds from the family's line output, size and trait
// points, the trait tree's rows and the p3/q3 exclusion, archetype
// switches that keep each archetype's funds and traits, the invest and its
// cooldown. Numbers on a human country (plan decision 30) or by direct
// calls of the lane's functions.
import { MIO_FAMILIES } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  EQUIP_KEYS,
  equipKey,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { mioFamilyOf, mioSize } from "@openfront/engine-lib/ww1936/MioRules";
import {
  dailyMio,
  mioDetailOf,
  mioInvest,
  mioOutputMilli,
  mioPointsOf,
  mioStatsOf,
} from "@openfront/engine/ww1936/depth/Mio";
import type { Line } from "@openfront/engine/ww1936/economy/WwEconomy";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { vi } from "vitest";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { HUMAN, stepTo, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const DEU = DEEP.tag.DEU;
const INF = MIO_FAMILIES.indexOf("mio_infantry");
const ART = MIO_FAMILIES.indexOf("mio_artillery");
const ARM = MIO_FAMILIES.indexOf("mio_armor");
const NAV = MIO_FAMILIES.indexOf("mio_naval");

async function deepDeu() {
  const runner = await wwRunner(
    {},
    [{ clientID: HUMAN, country: "DEU" }],
    DEEP.map,
  );
  stepTo(runner, WW_PREP_TICKS + 2);
  const ww = runner.game.worldWar()!;
  const tick = runner.game.ticks();
  return { runner, ww, d: ww.depth, tick, day: ww.day(tick) };
}

/** A P1 line that made `out` industry (milli) yesterday. */
function line(id: number, key: number, out: number): Line {
  return {
    id,
    key,
    factories: 1,
    active: 1,
    effBp: 5_000,
    progress: 0,
    fill: 1000,
    lastOutput: out,
    convertFrom: -1,
  };
}

describe("World War 1936 P6: military industrial organisations", () => {
  it("the family table (spec §6.1)", () => {
    const fam = (t: string, p?: string) => mioFamilyOf(t, p);
    expect(fam("infantry_equipment")).toBe(INF);
    expect(fam("support_equipment")).toBe(INF);
    expect(fam("motorized")).toBe(INF);
    for (const t of [
      "artillery",
      "anti_tank",
      "anti_air",
      "railway_gun",
      "flying_bomb",
      "ballistic_rocket",
    ]) {
      expect(fam(t), t).toBe(ART);
    }
    for (const t of ["light_tank", "medium_tank", "tank_design"]) {
      expect(fam(t), t).toBe(ARM);
    }
    for (const t of [
      "fighter",
      "cas",
      "naval_bomber",
      "cv_fighter",
      "cv_cas",
      "cv_naval_bomber",
    ]) {
      expect(fam(t), t).toBe(MIO_FAMILIES.indexOf("mio_air_light"));
    }
    for (const t of [
      "bomber",
      "heavy_fighter",
      "strat_bomber",
      "transport_plane",
    ]) {
      expect(fam(t), t).toBe(MIO_FAMILIES.indexOf("mio_air_heavy"));
    }
    for (const t of ["dd", "bb", "cv", "ss", "convoy", "floating_harbor"]) {
      expect(fam(t), t).toBe(NAV);
    }
    // A plane design by its airframe (small and jet light).
    expect(fam("plane_design", "small_2")).toBe(3);
    expect(fam("plane_design", "jet_1")).toBe(3);
    expect(fam("plane_design", "medium_1")).toBe(4);
    expect(fam("plane_design", "large_3")).toBe(4);
    expect(fam("plane_design", "strat_bomber")).toBe(4);
    expect(fam("plane_design")).toBe(-1);
    expect(fam("atomic_bomb")).toBe(-1);
    // Every equipment type is placed (or deliberately none).
    for (const [t] of EQUIP_KEYS) {
      if (t === "atomic_bomb" || t === "plane_design") continue;
      expect(fam(t), t).toBeGreaterThanOrEqual(0);
    }
  });

  it("mio funds from line output raise size and trait points", async () => {
    const { ww, d, tick } = await deepDeu();
    const c = d.country(DEU)!;
    const ce = ww.economy.country(DEU)!;
    expect(
      d.issue(
        DEU,
        { kind: "mio_pick", family: "mio_armor", archetype: "design_bureau" },
        tick,
      ),
    ).toBeNull();
    // The design bureau's free trait (s1) from size 0, no point yet.
    expect(c.mio.traits[ARM * 3 + 2]).toBe(1 << 6);
    expect(mioPointsOf(c, ARM)).toBe(0);
    // Yesterday's output of the armour lines; the artillery line's family
    // has no archetype and gains nothing; the dockyards fund the navy.
    ce.lines = [
      line(901, equipKey("light_tank", 1), 400_000),
      line(902, equipKey("medium_tank", 1), 200_000),
      line(903, equipKey("artillery", 1), 900_000),
    ];
    for (const nl of ce.navalLines) nl.lastOutput = 0;
    expect(mioOutputMilli(d, DEU)).toEqual([0, 900_000, 600_000, 0, 0, 0]);
    const msg = vi.spyOn(d, "message");
    dailyMio(d, DEU, 1);
    expect(c.mio.fundsMilli[ARM * 3 + 2]).toBe(600_000);
    expect(c.mio.fundsMilli.filter((x) => x > 0)).toEqual([600_000]);
    expect(mioSize(600_000)).toBe(1);
    expect(c.mio.sizeSeen[ARM]).toBe(1);
    expect(msg).toHaveBeenCalledWith(DEU, "ww1936_mio_size", {
      mio: "mio_armor",
      size: 1,
    });
    expect(mioPointsOf(c, ARM)).toBe(1);
    // The point buys s2; nothing is left for s3.
    d.endTick();
    const armorBefore = ce.stats.armorArmorPct;
    expect(
      d.issue(
        DEU,
        { kind: "mio_trait", family: "mio_armor", trait: "s2" },
        tick,
      ),
    ).toBeNull();
    expect(
      d.issue(
        DEU,
        { kind: "mio_trait", family: "mio_armor", trait: "s3" },
        tick,
      ),
    ).toBe("no_slot");
    // Size 3 at 3,600 industry (300 × n × (n + 1)): two more points.
    ce.lines = [line(901, equipKey("light_tank", 1), 3_000_000)];
    dailyMio(d, DEU, 2);
    expect(c.mio.fundsMilli[ARM * 3 + 2]).toBe(3_600_000);
    expect(mioSize(3_600_000)).toBe(3);
    expect(mioPointsOf(c, ARM)).toBe(2);
    expect(msg).toHaveBeenLastCalledWith(DEU, "ww1936_mio_size", {
      mio: "mio_armor",
      size: 3,
    });
    // The traits are the country's stats (spec §6.3).
    expect(mioStatsOf(d, DEU)).toEqual({ armorBrkPct: 5, armorArmorPct: 5 });
    d.endTick();
    expect(ce.stats.armorArmorPct - armorBefore).toBe(5);
    // The screens' per-family view (merge glue for WwDepth.detailOf).
    const view = mioDetailOf(d, DEU, 2);
    expect(view.fundsMilli[ARM]).toBe(3_600_000);
    expect(view.size[ARM]).toBe(3);
    expect(view.points[ARM]).toBe(2);
    expect(view.traits[ARM]).toBe((1 << 6) | (1 << 7));
    expect(view.investReady[ARM]).toBe(1);
    expect(view.investReady[INF]).toBe(0);
    // The funds stop at size 10 (33,000 industry).
    ce.lines = [line(901, equipKey("light_tank", 1), 90_000_000)];
    dailyMio(d, DEU, 3);
    expect(c.mio.fundsMilli[ARM * 3 + 2]).toBe(33_000_000);
    expect(mioSize(33_000_000)).toBe(10);
  });

  it("row 3 production and precision exclude each other", async () => {
    const { d, tick } = await deepDeu();
    const c = d.country(DEU)!;
    const trait = (family: "mio_infantry" | "mio_artillery", t: string) =>
      d.issue(DEU, { kind: "mio_trait", family, trait: t as "p1" }, tick);
    // Without an archetype nothing can be bought.
    expect(trait("mio_infantry", "p1")).toBe("prereq");
    d.issue(
      DEU,
      { kind: "mio_pick", family: "mio_infantry", archetype: "state_arsenal" },
      tick,
    );
    d.issue(
      DEU,
      {
        kind: "mio_pick",
        family: "mio_artillery",
        archetype: "private_combine",
      },
      tick,
    );
    // Size 5 each: 5 points.
    c.mio.fundsMilli[INF * 3] = 9_000_000;
    c.mio.fundsMilli[ART * 3 + 1] = 9_000_000;
    // Rows need the row above.
    expect(trait("mio_infantry", "p3")).toBe("prereq");
    expect(trait("mio_infantry", "p1")).toBe("bad_index"); // the free trait
    expect(trait("mio_infantry", "p2")).toBeNull();
    expect(trait("mio_infantry", "p3")).toBeNull();
    expect(trait("mio_infantry", "q1")).toBeNull();
    expect(trait("mio_infantry", "q2")).toBeNull();
    // p3 held: q3 is closed, points or not.
    expect(mioPointsOf(c, INF)).toBe(1);
    expect(trait("mio_infantry", "q3")).toBe("prereq");
    // The other way round on the artillery (q1 free): q3 closes p3.
    expect(trait("mio_artillery", "q2")).toBeNull();
    expect(trait("mio_artillery", "q3")).toBeNull();
    expect(trait("mio_artillery", "p1")).toBeNull();
    expect(trait("mio_artillery", "p2")).toBeNull();
    expect(trait("mio_artillery", "p3")).toBe("prereq");
    // Infantry: p1 −5, p3 −10, q1 −3 (no reliability): cost −18, p3's
    // reliability −5pp. Artillery: q1 −3, q3 +5, p1 −5: cost −3.
    const s = mioStatsOf(d, DEU) as Record<string, number>;
    expect(s.mioCostPct_infantry).toBe(-18);
    expect(s.mioRelPp_infantry).toBe(-5);
    expect(s.mioStatPct_infantry).toBe(5);
    expect(s.mioEffCapBp_infantry).toBe(500);
    expect(s.mioCostPct_artillery).toBe(-3);
    expect(s.mioStatPct_artillery).toBe(13);
  });

  it("switching archetype keeps each archetype's funds and traits", async () => {
    const { ww, d, tick } = await deepDeu();
    const c = d.country(DEU)!;
    const pol = ww.politics.country(DEU)!;
    const pick = (archetype: "state_arsenal" | "design_bureau") =>
      d.issue(DEU, { kind: "mio_pick", family: "mio_armor", archetype }, tick);
    pol.ppMilli = 120_000;
    // The first archetype is free.
    expect(pick("state_arsenal")).toBeNull();
    expect(pol.ppMilli).toBe(120_000);
    expect(pick("state_arsenal")).toBe("bad_index");
    c.mio.fundsMilli[ARM * 3] = 600_000;
    expect(
      d.issue(
        DEU,
        { kind: "mio_trait", family: "mio_armor", trait: "p2" },
        tick,
      ),
    ).toBeNull();
    // A switch costs 50 political power; the bureau starts from nothing
    // but its own free trait.
    expect(pick("design_bureau")).toBeNull();
    expect(pol.ppMilli).toBe(70_000);
    expect(c.mio.arch[ARM]).toBe(2);
    expect(c.mio.fundsMilli[ARM * 3 + 2]).toBe(0);
    expect(c.mio.traits[ARM * 3 + 2]).toBe(1 << 6);
    expect(mioStatsOf(d, DEU)).toEqual({ armorBrkPct: 5 });
    c.mio.fundsMilli[ARM * 3 + 2] = 1_800_000;
    // Back again: the arsenal's funds and traits are where they were.
    expect(pick("state_arsenal")).toBeNull();
    expect(pol.ppMilli).toBe(20_000);
    expect(c.mio.fundsMilli[ARM * 3]).toBe(600_000);
    expect(c.mio.traits[ARM * 3]).toBe(0b11);
    expect(c.mio.fundsMilli[ARM * 3 + 2]).toBe(1_800_000);
    expect(mioSize(c.mio.fundsMilli[ARM * 3])).toBe(1);
    expect(mioStatsOf(d, DEU)).toEqual({
      mioCostPct_armor: -5,
      mioEffCapBp_armor: 500,
    });
    // Short of political power: refused, nothing changes.
    expect(pick("design_bureau")).toBe("no_pp");
    expect(c.mio.arch[ARM]).toBe(0);
  });

  it("invest adds 600 and has a 180-day cooldown", async () => {
    const { ww, d, tick, day } = await deepDeu();
    const c = d.country(DEU)!;
    const pol = ww.politics.country(DEU)!;
    const invest = () =>
      d.issue(DEU, { kind: "mio_invest", family: "mio_naval" }, tick);
    expect(invest()).toBe("prereq");
    d.issue(
      DEU,
      { kind: "mio_pick", family: "mio_naval", archetype: "state_arsenal" },
      tick,
    );
    pol.ppMilli = 150_000;
    expect(invest()).toBeNull();
    expect(pol.ppMilli).toBe(100_000);
    expect(c.mio.fundsMilli[NAV * 3]).toBe(600_000);
    expect(mioSize(600_000)).toBe(1);
    expect(c.mio.investReady[NAV]).toBe(day + 180);
    expect(invest()).toBe("decision_cooldown");
    expect(mioInvest(d, DEU, NAV, day + 179)).toBe("decision_cooldown");
    expect(mioInvest(d, DEU, NAV, day + 180)).toBeNull();
    expect(c.mio.fundsMilli[NAV * 3]).toBe(1_200_000);
    expect(pol.ppMilli).toBe(50_000);
    expect(c.mio.investReady[NAV]).toBe(day + 360);
    // Short of political power.
    pol.ppMilli = 49_000;
    expect(mioInvest(d, DEU, NAV, day + 400)).toBe("no_pp");
    expect(c.mio.fundsMilli[NAV * 3]).toBe(1_200_000);
  });
});
