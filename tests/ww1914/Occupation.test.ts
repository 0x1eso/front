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
import { pairPeace, warStep } from "@openfront/engine/ww1914/PairWar";
import { pairTableStep, tableView } from "@openfront/engine/ww1914/Table";
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
  test("a beaten country loses a group a chapter to the enemy next to it, its heart last", async () => {
    const gw = await world("GWOCC1");
    openGeneral(gw, "DEU", "RUS", "test");
    if (warOf(gw, "AUH", "RUS") === null) declareWar(gw, "AUH", "RUS", "test");
    gw.s.chapter = longChapter(gw, 8);
    leaveWar(gw, "RUS", "nation_beaten");
    expect(gw.s.beaten).toEqual([{ tag: "RUS", chapter: gw.s.chapter }]);
    gw.s.landMoves = [];
    occupationStep(gw);
    // Bukovina is Austria's: Bessarabia is next to it, and goes first.
    expect(holderOf(gw, "moscow")).toBe("RUS");
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
    const auh = seatOf("AUH");
    expect(landHolds(gw, auh, { is: "land_taken", from: "RUS" })).toBe(true);
    expect(landHolds(gw, auh, { is: "beaten", tag: "RUS", max: 6 })).toBe(true);
    // ww179: no reach limit; the interior goes on, a group a chapter.
    for (let i = 0; i < 6; i++) {
      gw.s.chapter = longChapter(gw, gw.s.chapter + 1);
      occupationStep(gw);
    }
    expect(holderOf(gw, "moscow")).not.toBe("RUS");
    expect(holderOf(gw, "petrograd")).not.toBe("RUS");
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
    // While it sits, its screen counts one month, not the conference's three.
    t.closed = false;
    expect(tableView(gw, seatOf("DEU"))?.sessions).toBe(1);
    t.closed = true;
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

describe("asked for by the writers (ww172 merge 5)", () => {
  test("conditions name the group, the place, and who beat whom", async () => {
    const gw = await world("GWOCC6");
    openGeneral(gw, "DEU", "RUS", "test");
    moveLand(gw, "warsaw", "DEU", null);
    const deu = seatOf("DEU");
    const rus = seatOf("RUS");
    const taken = (c: object) =>
      landHolds(gw, deu, { is: "land_taken", ...c } as never);
    expect(taken({ group: ["russian_poland"] })).toBe(true);
    expect(taken({ group: ["baltic"] })).toBe(false);
    expect(taken({ place: ["warsaw"], max: 0 })).toBe(true);
    expect(taken({ place: ["riga"] })).toBe(false);
    expect(
      landHolds(gw, rus, {
        is: "land_lost",
        to: "DEU",
        group: ["russian_poland"],
      }),
    ).toBe(true);
    expect(
      landHolds(gw, rus, { is: "land_lost", group: ["east_prussia"] }),
    ).toBe(false);
    leaveWar(gw, "RUS", "nation_beaten");
    expect(landHolds(gw, deu, { is: "beaten", tag: "RUS", by: "DEU" })).toBe(
      true,
    );
    expect(landHolds(gw, deu, { is: "beaten", tag: "RUS", by: "GBR" })).toBe(
      false,
    );
  });

  test("a weary government nobody plays may sign a separate peace, and its table sits", async () => {
    const gw = await world("GWOCC7");
    openGeneral(gw, "DEU", "FRA", "test");
    moveLand(gw, "paris", "DEU", null);
    const fra = gw.nation("FRA")!;
    fra.ai = "cautious";
    let ch = 8;
    let signed = false;
    for (let i = 0; i < 40 && !signed; i++) {
      ch = longChapter(gw, ch + 1);
      if (ch < 0) break;
      gw.s.chapter = ch;
      fra.gauges.morale = 1;
      warStep(gw);
      signed = warOf(gw, "DEU", "FRA") === null;
    }
    expect(signed).toBe(true);
    const w = gw.s.wars.find(
      (x) =>
        (x.a === "DEU" && x.b === "FRA") || (x.a === "FRA" && x.b === "DEU"),
    )!;
    expect(w).toMatchObject({ how: "offer", offeredBy: "FRA", won: "DEU" });
    expect(gw.s.pairTables?.[0]).toMatchObject({ winner: "DEU" });
    pairTableStep(gw);
    expect(gw.s.pairTables![0].signed).toBe(gw.s.chapter);
  });

  test("a hardline loser never signs one", async () => {
    const gw = await world("GWOCC8");
    openGeneral(gw, "DEU", "FRA", "test");
    moveLand(gw, "paris", "DEU", null);
    const fra = gw.nation("FRA")!;
    fra.ai = "hardline";
    let ch = 8;
    for (let i = 0; i < 40; i++) {
      ch = longChapter(gw, ch + 1);
      if (ch < 0) break;
      gw.s.chapter = ch;
      fra.gauges.morale = 1;
      warStep(gw);
    }
    expect(warOf(gw, "DEU", "FRA")).not.toBeNull();
  });
});
