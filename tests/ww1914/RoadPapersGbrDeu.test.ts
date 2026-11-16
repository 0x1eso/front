// ww220 W1: Britain's and Germany's papers on the roads. The Kaiser's pledge
// paper asks Britain's neutrality and may spare Belgium, only once the road
// stands at an understanding and the Foreign Office has a draft; the diary
// sees the feeler, the signature and the fall; Britain's aims grow a list
// against France once the two stand on opposite sides.
import { roadFall, roadOf } from "@openfront/engine/ww1914/Alignment";
import { roadMoments } from "@openfront/engine/ww1914/Diary";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { moveBond } from "@openfront/engine/ww1914/PeaceYears";
import { takePower } from "@openfront/engine/ww1914/Powers";
import { aimsOf } from "@openfront/engine/ww1914/TableAims";
import { beforeEach, describe, expect, test } from "vitest";
import { gwRunner } from "./util";

let gw: GreatWar;
const seat = () => gw.s.seats[0];
const pledge = (picks: string[]) =>
  takePower(gw, seat(), {
    id: "deu_pw_pledge_gbr",
    target: null,
    picks,
    without: false,
    sound: false,
  });

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
  expect(roadOf(gw, "DEU", "GBR")).toBe("understanding");
}

beforeEach(async () => {
  const { runner } = await gwRunner({}, "GWROADW1");
  gw = runner.game.greatWar()!;
  expect(seat().tag).toBe("DEU");
});

describe("the roads, Britain and Germany", () => {
  test("the pledge paper waits for the road and the draft, then asks London with Belgium spared", () => {
    expect(pledge(["spare"])).toBe("power_closed");
    understanding();
    expect(pledge(["spare"])).toBe("power_closed");
    seat().flags.push("f_deu_road_draft_gbr");
    // Bethmann countersigns readily (the signature is not what is tested).
    const bethmann = gw.person("deu_bethmann");
    if (bethmann !== null) bethmann.trust = 3;
    pledge(["spare"]);
    const t = gw.s.treaties.find(
      (x) => x.from === "DEU" && x.to === "GBR" && x.state === "offered",
    );
    expect(t).toBeDefined();
    expect(t!.clauses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "neutrality", by: "GBR" }),
        expect.objectContaining({ kind: "spare", by: "DEU" }),
      ]),
    );
    expect(roadMoments(gw, "DEU")).toContain("road_feeler");
    t!.state = "signed";
    t!.signed = gw.s.chapter;
    expect(roadMoments(gw, "DEU")).toContain("road_signed");
    roadFall(gw, "DEU", "GBR", "leak");
    expect(roadMoments(gw, "DEU")).toContain("road_fell");
  });

  test("Britain's aims grow a list against France only across the camps", () => {
    const gbr = gw.nation("GBR")!;
    const fra = gw.nation("FRA")!;
    gbr.side = "entente";
    fra.side = "entente";
    expect(aimsOf(gw, "GBR")).not.toContain("calais");
    gbr.side = "central";
    expect(aimsOf(gw, "GBR")).toContain("calais");
    expect(aimsOf(gw, "GBR")).not.toContain("tashkent");
  });
});
