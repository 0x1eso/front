// ww220 N (R5, R6): the neutrals' reasons and America's mediation.
import type { GwSide } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { neutralChoice } from "@openfront/engine/ww1914/Ai";
import { warMonths } from "@openfront/engine/ww1914/Eras";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import {
  americaBar,
  americaSide,
  GW_US_MEDIATION,
  medHolder,
  neutralRoadsStep,
  US_MEDIATE_FROM,
} from "@openfront/engine/ww1914/NeutralRoads";
import { GW_ENTRIES, GW_START_TREATIES } from "@openfront/engine/ww1914/Tables";
import { honourPct } from "@openfront/engine/ww1914/Wars";
import { news } from "@openfront/engine/ww1914/World";
import { beforeEach, describe, expect, test } from "vitest";
import { gwRunner } from "./util";

let gw: GreatWar;
const ITA = () => GW_ENTRIES.find((e) => e.tag === "ITA")!;

/** The general war as July left it: the five on their sides. */
function generalWar(gbr: GwSide): void {
  const sides: [GwTag, GwSide][] = [
    ["DEU", "central"],
    ["AUH", "central"],
    ["FRA", "entente"],
    ["RUS", "entente"],
    ["GBR", gbr],
  ];
  for (const [tag, side] of sides) gw.nation(tag)!.side = side;
}

beforeEach(async () => {
  const { runner } = await gwRunner({ greatWar1914Calendar: "full" });
  gw = runner.game.greatWar()!;
  gw.s.seats[0].regent = true;
  gw.s.chain = null;
  gw.s.spark = null;
  gw.s.warChapter = gw.s.chapter;
});

describe("Italy and the Mediterranean", () => {
  test("Italy will not fight the side that holds the sea, and the Triple Alliance wants the Trentino", () => {
    const ita = gw.nation("ITA")!;
    ita.ai = "principled";
    ita.lean = 0;
    ita.offers = { central: 2, entente: 2 };
    generalWar("entente");
    expect(medHolder(gw)).toBe("entente");
    expect(neutralChoice(gw, ita, ITA())).toBe("entente");
    // Britain in the Central Powers takes the sea with it.
    generalWar("central");
    expect(medHolder(gw)).toBe("central");
    expect(neutralChoice(gw, ita, ITA())).toBe("central");
    // The Triple Alliance: worth less without Vienna's price.
    generalWar("entente");
    const row = GW_START_TREATIES.find(
      (r) => r.id === "triple_alliance" && r.for === "AUH",
    )!;
    const without = honourPct(gw, row);
    ita.offers = { central: 3, entente: 2 };
    expect(honourPct(gw, row)).toBeGreaterThan(without);
  });
});

describe("America's mediation", () => {
  /** A month-long chapter far enough into the war. */
  function lateChapters(): number[] {
    const rows = gwChapters(gw.s.calendar);
    gw.s.warChapter = rows.findIndex((c) => c.spanDays >= 28);
    return rows
      .map((c, i) => i)
      .filter(
        (i) => rows[i].spanDays >= 28 && warMonths(gw, i) >= US_MEDIATE_FROM,
      );
  }

  function spent(tag: GwTag): void {
    const n = gw.nation(tag)!;
    n.ai = "cautious";
    n.gauges.morale = 1;
    n.gauges.order = 1;
  }

  test("both leads would stop: America brokers a compromise", () => {
    generalWar("entente");
    const usa = gw.nation("USA")!;
    usa.ai = "principled";
    spent("DEU");
    spent("FRA");
    for (const c of lateChapters()) {
      gw.s.chapter = c;
      neutralRoadsStep(gw);
      if (gw.s.armistice !== null) break;
    }
    expect(gw.s.news.some((x) => x.key === "us_mediation_offer")).toBe(true);
    expect(gw.s.news.some((x) => x.key === "us_mediation_peace")).toBe(true);
    expect(gw.s.armistice?.kind).toBe("compromise");
  });

  test("a seat at war answers on its card, read as the next chapter closes", () => {
    generalWar("entente");
    gw.s.seats[0].regent = false;
    gw.nation("USA")!.ai = "cautious";
    spent("FRA");
    gw.nation("DEU")!.gauges.morale = 1;
    const seat = gw.s.seats[0];
    for (const c of lateChapters()) {
      gw.s.chapter = c;
      neutralRoadsStep(gw);
      if (seat.scheduled.some((q) => q.scene === GW_US_MEDIATION)) break;
    }
    expect(seat.scheduled.some((q) => q.scene === GW_US_MEDIATION)).toBe(true);
    // The seat takes it; France is spent too: the war stops.
    seat.flags.push("gw_us_mediation_yes");
    gw.s.chapter++;
    neutralRoadsStep(gw);
    expect(gw.s.armistice?.kind).toBe("compromise");
    expect(seat.flags).not.toContain("gw_us_mediation_yes");
  });
});

describe("America's road", () => {
  test("a liner sunk in a restricted war brings it in, by its patience", () => {
    generalWar("entente");
    const usa = gw.nation("USA")!;
    usa.ai = "principled";
    gw.s.uboat = 1;
    usa.readiness = americaBar(gw);
    // Boats out without a liner gone down: Washington waits.
    expect(americaSide(gw)).toBeNull();
    news(gw, "liner_sunk");
    expect(americaSide(gw)).toBe("entente");
    // Short of its patience it still waits.
    usa.readiness = americaBar(gw) - 1;
    expect(americaSide(gw)).toBeNull();
  });
});
