// ww220 §3 (lane A): camps that move. A signed alliance turns Britain's camp
// before the war, a pledge keeps it out of the war, a leak drops the road a
// step, and a losing country signs itself over to the other side.
import type {
  GwClause,
  GwTreaty,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { aiStep } from "@openfront/engine/ww1914/Ai";
import {
  alignStep,
  campOf,
  onTreatySigned,
  roadOf,
  roadStep,
} from "@openfront/engine/ww1914/Alignment";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { moveBond } from "@openfront/engine/ww1914/PeaceYears";
import {
  leak,
  offerTreatyFrom,
  treatyStep,
} from "@openfront/engine/ww1914/Treaties";
import { atWarWith, declareWar, openWar } from "@openfront/engine/ww1914/Wars";
import { beforeEach, describe, expect, test } from "vitest";
import { gwRunner } from "./util";

let gw: GreatWar;

const clause = (kind: GwClause["kind"], by: GwTag): GwClause => ({
  kind,
  by,
  theatre: null,
  value: 0,
});

/** A treaty both have signed (the AI's answer is not what is tested). */
function signed(from: GwTag, to: GwTag, clauses: GwClause[]): GwTreaty {
  expect(offerTreatyFrom(gw, from, to, clauses)).toBeNull();
  const t = gw.s.treaties[gw.s.treaties.length - 1];
  t.state = "signed";
  t.signed = gw.s.chapter;
  onTreatySigned(gw, t);
  return t;
}

/** London and Berlin at an understanding: a naval accord and a warm bond. */
function understanding(): void {
  (gw.s.accords ??= []).push({
    kind: "naval",
    a: "DEU",
    b: "GBR",
    chapter: gw.s.chapter,
    broken: null,
  });
  moveBond(gw, "DEU", "GBR", 2);
  expect(roadOf(gw, "GBR", "DEU")).toBe("understanding");
}

beforeEach(async () => {
  const { runner } = await gwRunner({}, "GWREALIGN1");
  gw = runner.game.greatWar()!;
  expect(gw.s.warChapter).toBeNull();
});

describe("camps that move", () => {
  test("a signed alliance before the war puts Britain with the Central Powers", () => {
    expect(roadOf(gw, "GBR", "DEU")).toBe("cold");
    understanding();
    moveBond(gw, "FRA", "GBR", -2);
    signed("DEU", "GBR", [clause("alliance", "DEU")]);
    alignStep(gw);
    expect(roadOf(gw, "GBR", "DEU")).toBe("alliance");
    expect(campOf(gw, "GBR")).toBe("central");
    // The war comes: Britain stands with Germany, against France.
    openWar(gw);
    declareWar(gw, "DEU", "FRA", "test");
    expect(gw.nation("FRA")!.side).toBe("entente");
    // The alliance calls Britain in (Treaties.checkAlliance).
    treatyStep(gw);
    expect(gw.nation("GBR")!.side).toBe("central");
    expect(atWarWith(gw, "GBR", "FRA")).toBe(true);
  });

  test("a pledge keeps Britain neutral when the war comes", () => {
    understanding();
    // Britain's neutrality, and Belgium spared for it.
    signed("GBR", "DEU", [clause("neutrality", "GBR"), clause("spare", "DEU")]);
    expect(roadOf(gw, "GBR", "DEU")).toBe("pledge");
    openWar(gw);
    declareWar(gw, "DEU", "FRA", "test");
    expect(atWarWith(gw, "DEU", "FRA")).toBe(true);
    expect(atWarWith(gw, "DEU", "BEL")).toBe(false);
    expect(campOf(gw, "GBR")).toBeNull();
    for (let i = 0; i < 6; i++) aiStep(gw);
    expect(gw.nation("GBR")!.side).toBeNull();
  });

  test("a leak drops the road a step", () => {
    understanding();
    const t = signed("GBR", "DEU", [clause("neutrality", "GBR")]);
    expect(roadStep(gw, "GBR", "DEU")).toBe(3);
    leak(gw, t);
    expect(roadStep(gw, "GBR", "DEU")).toBe(2);
    expect(gw.s.seats[0].log.some((l) => l.key === "road_fell_leak")).toBe(
      true,
    );
  });

  test("a losing country signs itself over to the other side, not beaten", () => {
    openWar(gw);
    declareWar(gw, "DEU", "FRA", "test");
    expect(gw.nation("AUH")!.side).toBe("central");
    gw.nation("AUH")!.unrest = 2;
    signed("AUH", "FRA", [clause("alliance", "AUH")]);
    const auh = gw.nation("AUH")!;
    expect(auh.side).toBe("entente");
    expect(auh.out).toBe(false);
    expect(atWarWith(gw, "AUH", "FRA")).toBe(false);
    expect(atWarWith(gw, "AUH", "DEU")).toBe(true);
    expect(gw.s.renounced).toContain("dual_alliance");
  });
});
