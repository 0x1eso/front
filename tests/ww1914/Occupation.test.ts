// ww172 phase 5 (design ww168 B5-B6, 7A, 9A): occupation beyond the fronts,
// the bilateral table of a peace of two, and the endings the state gives.
// On the real 1914 set, since the places are what move.
import type { GwSeatState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  GW_PLACE_KEYS,
  GW_PLACES,
} from "@openfront/engine-api/ww1914/GwPlaces";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { createGameRunner } from "@openfront/engine/GameRunner";
import { generalEnding } from "@openfront/engine/ww1914/Endings";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import {
  frontLandStep,
  holderOf,
  moveLand,
} from "@openfront/engine/ww1914/Land";
import {
  landGraph,
  landHolds,
  occupationStep,
} from "@openfront/engine/ww1914/Occupation";
import { pairPeace } from "@openfront/engine/ww1914/PairWar";
import { pairTableStep } from "@openfront/engine/ww1914/Table";
import {
  declareWar,
  leaveWar,
  openGeneral,
  warOf,
} from "@openfront/engine/ww1914/Wars";
import { describe, expect, test } from "vitest";
import { realMap } from "./realMap";
import { startOf } from "./sim/GwSim";

async function world(id: string): Promise<GreatWar> {
  const start = { ...startOf(id, "full", []), players: [] };
  const runner = await createGameRunner(start, undefined, realMap(), () => {});
  for (let t = 0; t < 2; t++) {
    runner.addTurn({ turnNumber: t, intents: [] });
    runner.executeNextTick();
  }
  const gw = runner.game.greatWar()!;
  gw.s.chain = null;
  gw.s.spark = null;
  return gw;
}

/** The first month-long chapter from `from` on: occupation runs only in those. */
function longChapter(gw: GreatWar, from: number): number {
  const rows = gwChapters(gw.s.calendar);
  return rows.findIndex((c, i) => i >= from && c.spanDays >= 28);
}

/** As the state would close for `tag` if it were played. */
const seatOf = (tag: GwTag) => ({ tag, flags: [] }) as unknown as GwSeatState;

const ownedBy = (tag: GwTag, group: string) =>
  GW_PLACE_KEYS.filter(
    (p) => GW_PLACES[p].owner === tag && GW_PLACES[p].group === group,
  );

describe("the map's land", () => {
  test("groups border by land from the region files; islands by none", async () => {
    const gw = await world("GWOCC0");
    const g = landGraph(gw);
    expect(g.near.get("belgium")).toContain("rhineland");
    expect(g.near.get("bessarabia")).toContain("bukovina");
    expect(g.near.get("britain") ?? []).toEqual([]);
    expect(g.sea.get("britain")?.length).toBeGreaterThan(0);
  });
});

describe("occupation", () => {
  test("a beaten country loses a group a chapter to the enemy next to it, never its far heart", async () => {
    const gw = await world("GWOCC1");
    openGeneral(gw, "DEU", "RUS", "test");
    if (warOf(gw, "AUH", "RUS") === null) declareWar(gw, "AUH", "RUS", "test");
    gw.s.chapter = longChapter(gw, 8);
    leaveWar(gw, "RUS", "nation_beaten");
    expect(gw.s.beaten).toEqual([{ tag: "RUS", chapter: gw.s.chapter }]);
    gw.s.landMoves = [];
    occupationStep(gw);
    // Bukovina is Austria's: Bessarabia is next to it, and goes first.
    for (const p of ownedBy("RUS", "bessarabia")) {
      expect(holderOf(gw, p)).toBe("AUH");
      expect(gw.s.heldSince?.[p]).toBe(gw.s.chapter);
    }
    expect(gw.s.landMoves.every((m) => m.how === "occupation")).toBe(true);
    expect(
      gw.s.news.some((x) => x.key === "land_occupied" && x.a === "AUH"),
    ).toBe(true);
    for (let i = 0; i < 6; i++) {
      gw.s.chapter = longChapter(gw, gw.s.chapter + 1);
      occupationStep(gw);
    }
    expect(holderOf(gw, "odessa")).toBe("AUH");
    // Moscow and Petrograd are no army's neighbours here, and no fleet's.
    expect(holderOf(gw, "moscow")).toBe("RUS");
    expect(holderOf(gw, "petrograd")).toBe("RUS");
    const auh = seatOf("AUH");
    expect(landHolds(gw, auh, { is: "land_taken", from: "RUS" })).toBe(true);
    expect(landHolds(gw, auh, { is: "beaten", tag: "RUS", max: 6 })).toBe(true);
  });

  test("the war goes on with a capital held: occupation held, and under occupation", async () => {
    const gw = await world("GWOCC2");
    openGeneral(gw, "DEU", "FRA", "test");
    gw.s.chapter = longChapter(gw, 8);
    moveLand(gw, "paris", "DEU", null);
    expect(generalEnding(gw, seatOf("FRA"))).toBe("under_occupation");
    expect(generalEnding(gw, seatOf("DEU"))).toBe("occupation_held");
    expect(
      landHolds(gw, seatOf("FRA"), { is: "land_lost", capital: true }),
    ).toBe(true);
  });
});

describe("the bilateral table", () => {
  test("a won war of two: the winner asks within reach, the rest goes home, the land is settled", async () => {
    const gw = await world("GWOCC3");
    expect(declareWar(gw, "DEU", "BEL", "test")).toBe(true);
    expect(gw.s.warChapter).toBeNull();
    moveLand(gw, "brussels", "DEU", null);
    moveLand(gw, "liege", "DEU", null);
    expect(pairPeace(gw, "DEU", "BEL")).toBe(true);
    expect(gw.s.wars[0].won).toBe("DEU");
    pairTableStep(gw);
    const row = gw.s.pairTables![0];
    expect(row).toMatchObject({ a: "DEU", b: "BEL", winner: "DEU" });
    expect(row.signed).toBe(gw.s.chapter);
    const t = gw.s.table!;
    expect(t.closed).toBe(true);
    expect(t.claims.length).toBeGreaterThan(0);
    for (const c of t.claims) {
      expect(c.by).toBe("DEU");
      expect(GW_PLACES[c.place].owner).toBe("BEL");
      // Each claim's end is in the world's news.
      expect(
        gw.s.news.some(
          (x) => x.key.startsWith("table_") && x.place === c.place,
        ),
      ).toBe(true);
    }
    // Belgian land Germany didn't get is Belgium's again.
    for (const p of GW_PLACE_KEYS) {
      if (GW_PLACES[p].owner !== "BEL" || holderOf(gw, p) === "BEL") continue;
      const got = t.claims.some(
        (c) => c.place === p && (c.state === "agreed" || c.state === "imposed"),
      );
      expect(got, p).toBe(true);
    }
    expect(gw.s.settled).toContain("brussels");
    expect(gw.s.news.some((x) => x.key === "pair_table_signed")).toBe(true);
    // The fronts leave what the table settled.
    const before = GW_PLACE_KEYS.map((p) => holderOf(gw, p));
    frontLandStep(gw);
    expect(GW_PLACE_KEYS.map((p) => holderOf(gw, p))).toEqual(before);
    expect(generalEnding(gw, seatOf("DEU"))).toBe("pair_war_won");
    expect(generalEnding(gw, seatOf("BEL"))).toBe("pair_war_lost");
    expect(
      landHolds(gw, seatOf("DEU"), {
        is: "pair_table",
        open: false,
        result: ["won"],
      }),
    ).toBe(true);
  });

  test("nobody beaten: each keeps what it stands on unless it is given back", async () => {
    const gw = await world("GWOCC4");
    declareWar(gw, "DEU", "BEL", "test");
    moveLand(gw, "liege", "DEU", null);
    expect(pairPeace(gw, "DEU", "BEL")).toBe(true);
    pairTableStep(gw);
    const t = gw.s.table!;
    expect(t.pair?.winner).toBeNull();
    // Germany stands on Liège: it has nothing to ask. Belgium asks it back.
    expect(t.claims.every((c) => c.by === "BEL")).toBe(true);
    const back = t.claims.some(
      (c) =>
        c.place === "liege" && (c.state === "agreed" || c.state === "imposed"),
    );
    expect(holderOf(gw, "liege")).toBe(back ? "BEL" : "DEU");
    expect(generalEnding(gw, seatOf("DEU"))).toBe("compromise_peace");
  });

  test("a coalition member's peace of two leaves it out, by its own peace", async () => {
    const gw = await world("GWOCC5");
    openGeneral(gw, "DEU", "RUS", "test");
    for (const foe of [...gw.nation("RUS")!.atWar]) pairPeace(gw, "RUS", foe);
    expect(gw.nation("RUS")!.out).toBe(true);
    expect(gw.s.beaten ?? []).toEqual([]);
    expect(generalEnding(gw, seatOf("RUS"))).toBe("separate_peace");
  });
});
