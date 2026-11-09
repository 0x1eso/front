import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { MapFiles } from "@openfront/engine-api/game/MapFiles";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { advanceChapter } from "@openfront/engine/ww1914/Chapters";
import { dealDesk } from "@openfront/engine/ww1914/Desk";
import { govStep } from "@openfront/engine/ww1914/Government";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { applyGwOrder } from "@openfront/engine/ww1914/Orders";
import { rulerRow } from "@openfront/engine/ww1914/Ruler";
import { seatPerson } from "@openfront/engine/ww1914/World";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { newGame, startOf } from "./sim/GwSim";

// France's seat (ww166 plan §1): the President stays whoever governs; a
// cabinet's fall ends in the consultations, only the Élysée row can lose.

let map: MapFiles;
beforeAll(async () => {
  map = await loadMapFiles(
    new NodeGameMapLoader(path.join(__dirname, "../../resources/maps")),
    GameMapType.World1936,
    GameMapSize.Normal,
  );
});

let games = 0;
async function game(): Promise<GreatWar> {
  const r = await newGame(map, startOf(`fra-${games++}`, "full", [], "FRA"));
  return r.game.greatWar()!;
}

/** A month-long chapter late in the war, past every row's first date. */
function late(gw: GreatWar): void {
  const list = gwChapters(gw.s.calendar);
  gw.s.chapter = list.findIndex((c) => c.spanDays >= 28 && c.day > 0) + 34;
  gw.s.day = list[gw.s.chapter].day;
}

const seatOf = (gw: GreatWar) => gw.s.seats[0];
const premier = (gw: GreatWar) =>
  gw.s.people.find((p) => p.office === "chancellor" && p.id.startsWith("fra_"))
    ?.id ?? null;
const called = (gw: GreatWar, scene: string) =>
  seatOf(gw).scheduled.some((q) => q.scene === scene);

function climbTo(gw: GreatWar, scene: string, months = 30): void {
  for (let i = 0; i < months && !called(gw, scene); i++) govStep(gw);
}

/** Opens a scene on the desk and walks a talk's replies through orders. */
function open(gw: GreatWar, scene: string) {
  const seat = seatOf(gw);
  seat.desk = [];
  seat.scheduled = [{ scene, chapter: gw.s.chapter }];
  dealDesk(gw, seat);
  const card = seat.desk.find((c) => c.scene === scene)!;
  expect(card, scene).toBeDefined();
  return card;
}

function consult(gw: GreatWar, pick: string): void {
  const card = open(gw, "gov_fra_consult");
  for (const reply of ["hear", "hear", pick]) {
    expect(
      applyGwOrder(gw, seatOf(gw), { kind: "reply", card: card.uid, reply }),
      reply,
    ).toBeNull();
  }
}

describe("France's President", () => {
  test("stays the seat through two cabinet falls", async () => {
    const gw = await game();
    late(gw);
    const seat = seatOf(gw);
    const n = gw.nation("FRA")!;
    expect(premier(gw)).toBe("fra_viviani");

    n.inst.chamber = -2;
    climbTo(gw, "gov_fra_consult");
    expect(called(gw, "gov_fra_consult")).toBe(true);
    consult(gw, "call_briand");
    expect(premier(gw)).toBe("fra_briand");
    expect(seat.flags).toContain("f_pm_briand");
    expect(seat.gov.find((g) => g.id === "fra_chamber")!.step).toBe(0);

    // The rest over, the Chamber turns again: the consultations come again,
    // though the talk was seen.
    for (const g of seat.gov) g.rest = -1;
    n.inst.chamber = -2;
    seat.scheduled = [];
    climbTo(gw, "gov_fra_consult");
    expect(called(gw, "gov_fra_consult")).toBe(true);
    consult(gw, "call_clemenceau");
    expect(premier(gw)).toBe("fra_clemenceau");
    expect(n.regime).toBe("fra_tiger");
    expect(seat.flags).toContain("f_pm_clemenceau");
    expect(seat.flags).not.toContain("f_pm_briand");

    expect(gw.s.ended).toBeNull();
    expect(seat.memoir).toBeNull();
    expect(seat.tag).toBe("FRA");
    expect(seatPerson(seat)).toBe("fra_poincare");
    expect(rulerRow(gw, seat)?.id).toBe("poincare");
  });

  test("can lose the game to the Élysée row", async () => {
    const gw = await game();
    late(gw);
    Object.assign(gw.nation("FRA")!.inst, { chamber: -3, senate: -3 });
    climbTo(gw, "gov_fra_elysee_3");
    expect(called(gw, "gov_fra_elysee_3")).toBe(true);
    const card = open(gw, "gov_fra_elysee_3");
    applyGwOrder(gw, seatOf(gw), {
      kind: "choose",
      card: card.uid,
      option: "face",
    });
    expect(gw.s.ended).toBe("fra_end_resigned");
  });

  test("a regent never reaches the Élysée row's last paper", async () => {
    const gw = await game();
    late(gw);
    const seat = seatOf(gw);
    seat.regent = true;
    Object.assign(gw.nation("FRA")!.inst, { chamber: -3, senate: -3 });
    climbTo(gw, "gov_fra_elysee_3", 40);
    expect(called(gw, "gov_fra_elysee_3")).toBe(false);
    expect(seat.gov.find((g) => g.id === "fra_elysee")!.step).toBe(2);
  });

  test("names the premier only: pressing over a minister costs his trust", async () => {
    const gw = await game();
    const seat = seatOf(gw);
    gw.nation("FRA")!.authority = 100;
    expect(
      applyGwOrder(gw, seat, { kind: "dismiss", person: "fra_viviani" }),
    ).toBe("premier_house");
    const pm = gw.person("fra_viviani")!;
    pm.trust = -2;
    expect(
      applyGwOrder(gw, seat, { kind: "dismiss", person: "fra_malvy" }),
    ).toBeNull();
    expect(pm.trust).toBe(-3);
    expect(pm.office).toBeNull();
    expect(pm.status).toBe("active");
    expect(called(gw, "gov_fra_consult")).toBe(true);
  });

  test("leaving the Tiger's cabinet, the sacred union comes back only if the SFIO stayed", async () => {
    for (const out of [false, true]) {
      const gw = await game();
      late(gw);
      const seat = seatOf(gw);
      const n = gw.nation("FRA")!;
      n.regime = "fra_tiger";
      seat.flags.push("f_pm_clemenceau");
      if (out) seat.flags.push("f_sfio_out");
      consult(gw, "call_briand");
      expect(premier(gw)).toBe("fra_briand");
      expect(n.regime, String(out)).toBe(out ? "fra_republic" : "fra_union");
    }
  });

  test("holds no summons at sea, one fewer under Clemenceau", async () => {
    const gw = await game();
    const seat = seatOf(gw);
    advanceChapter(gw, 0, false);
    const usual = seat.audiences;
    expect(usual).toBeGreaterThan(0);
    seat.flags.push("f_pm_clemenceau");
    advanceChapter(gw, 0, false);
    expect(seat.audiences).toBe(Math.max(0, usual - 1));
    seat.flags.push("f_at_sea");
    advanceChapter(gw, 0, false);
    expect(seat.audiences).toBe(0);
  });
});
