// ww222 (lane W2): Russia's, France's and Austria's papers on the roads to
// the other camp (design ww220 §5). Russia's pledge row offers Berlin the
// treaty once the road reaches an understanding; the diary hears the first
// offer and the signature; aims against a new enemy count only across the
// camps.
import { GameType } from "@openfront/engine-api/game/GameTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { roadOf } from "@openfront/engine/ww1914/Alignment";
import { roadMoments } from "@openfront/engine/ww1914/Diary";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { moveBond } from "@openfront/engine/ww1914/PeaceYears";
import { powerViews, takePower } from "@openfront/engine/ww1914/Powers";
import { aimsOf } from "@openfront/engine/ww1914/TableAims";
import { describe, expect, test } from "vitest";
import { HUMAN, step, wwRunnerCapture } from "../ww1936/util";

async function seated(tag: GwTag): Promise<GreatWar> {
  const { runner }: { runner: GameRunner } = await wwRunnerCapture(
    { greatWar1914: true, gameType: GameType.Singleplayer },
    [{ clientID: HUMAN, gwCountry: tag }],
  );
  step(runner, 2);
  const gw = runner.game.greatWar()!;
  gw.s.seats[0].tag = tag;
  gw.nation(tag)!.authority = 100;
  return gw;
}

/** Russia and Germany at an understanding: the Potsdam accord and a warm bond. */
function understanding(gw: GreatWar): void {
  (gw.s.accords ??= []).push({
    kind: "colonial",
    a: "DEU",
    b: "RUS",
    chapter: gw.s.chapter,
    broken: null,
  });
  moveBond(gw, "DEU", "RUS", 1);
  expect(roadOf(gw, "RUS", "DEU")).toBe("understanding");
}

const pledge = { id: "rus_pw_pledge", picks: [], without: false, sound: false };

describe("Russia's road to Berlin (ww220 R3)", () => {
  test("the pledge row opens with the understanding and offers Berlin the treaty", async () => {
    const gw = await seated("RUS");
    const seat = gw.s.seats[0];
    expect(gw.s.warChapter).toBeNull();
    const view = () =>
      powerViews(gw, seat).find((v) => v.id === "rus_pw_pledge");
    expect(view()).toBeDefined();
    expect(takePower(gw, seat, { ...pledge, target: "DEU" })).not.toBeNull();

    understanding(gw);
    // The foreign minister signs under the Emperor (no refusal tested here).
    for (const p of gw.s.people) if (p.office === "foreign") p.trust = 3;
    expect(takePower(gw, seat, { ...pledge, target: "DEU" })).toBeNull();
    const t = gw.s.treaties[gw.s.treaties.length - 1];
    expect(t.from).toBe("RUS");
    expect(t.to).toBe("DEU");
    expect(t.state).toBe("offered");
    expect(
      t.clauses.some((c) => c.kind === "neutrality" && c.by === "RUS"),
    ).toBe(true);
  });

  test("the diary hears the offer and the signature, in the Tsar's own lines", async () => {
    const gw = await seated("RUS");
    const seat = gw.s.seats[0];
    expect(roadMoments(gw, "RUS")).toEqual([]);
    understanding(gw);
    for (const p of gw.s.people) if (p.office === "foreign") p.trust = 3;
    expect(takePower(gw, seat, { ...pledge, target: "DEU" })).toBeNull();
    expect(roadMoments(gw, "RUS")).toEqual(["road_feeler"]);
    const t = gw.s.treaties[gw.s.treaties.length - 1];
    t.state = "signed";
    t.signed = gw.s.chapter;
    expect(roadMoments(gw, "RUS")).toContain("road_signed");
    expect(roadOf(gw, "RUS", "DEU")).toBe("pledge");
    const rows = gwContent().persona?.diary ?? [];
    for (const m of ["road_feeler", "road_signed", "road_fell"] as const) {
      for (const tag of ["RUS", "FRA", "AUH"] as const) {
        expect(
          rows.some((r) => r.moment === m && r.nation.includes(tag)),
          `${tag} ${m}`,
        ).toBe(true);
      }
    }
  });

  test("aims against a new enemy count only while the two stand apart", async () => {
    const gw = await seated("RUS");
    expect(aimsOf(gw, "RUS")).not.toContain("lahore");
    expect(aimsOf(gw, "FRA")).not.toContain("khartoum");
    gw.nation("RUS")!.side = "central";
    gw.nation("GBR")!.side = "entente";
    gw.nation("FRA")!.side = "entente";
    expect(aimsOf(gw, "RUS")).toContain("lahore");
    expect(aimsOf(gw, "RUS")).toContain("constantinople");
    gw.nation("GBR")!.side = "central";
    expect(aimsOf(gw, "RUS")).not.toContain("lahore");
    expect(aimsOf(gw, "FRA")).toContain("khartoum");
  });
});
