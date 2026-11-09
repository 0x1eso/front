import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { MapFiles } from "@openfront/engine-api/game/MapFiles";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { advanceChapter } from "@openfront/engine/ww1914/Chapters";
import { dealDesk } from "@openfront/engine/ww1914/Desk";
import { govStep } from "@openfront/engine/ww1914/Government";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { applyGwOrder } from "@openfront/engine/ww1914/Orders";
import { rulerRow, rulerStep } from "@openfront/engine/ww1914/Ruler";
import { enter } from "@openfront/engine/ww1914/Wars";
import { seatPerson } from "@openfront/engine/ww1914/World";
import { worldView } from "@openfront/engine/ww1914/WorldView";
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

/** The first chapter of a month, "YYYY-MM". */
function at(gw: GreatWar, month: string): void {
  const [y, m] = month.split("-").map(Number);
  const list = gwChapters(gw.s.calendar);
  const first = Date.UTC(y, m - 1, 1) / 86400000;
  gw.s.chapter = list.findIndex((c) => c.day >= first);
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

  test("an empty premiership waits for the consultations: no list, no successor", async () => {
    const gw = await game();
    const seat = seatOf(gw);
    gw.nation("FRA")!.authority = 100;
    gw.person("fra_viviani")!.trust = -2;
    applyGwOrder(gw, seat, { kind: "dismiss", person: "fra_malvy" });
    expect(premier(gw)).toBeNull();
    expect(called(gw, "gov_fra_consult")).toBe(true);
    expect(worldView(gw, seat).candidates.chancellor).toBeUndefined();
    expect(
      applyGwOrder(gw, seat, {
        kind: "appoint",
        person: "fra_briand",
        office: "chancellor",
      }),
    ).toBe("premier_house");
    seat.desk = [];
    advanceChapter(gw, 0, false);
    expect(premier(gw)).toBeNull();
    expect(seat.desk.some((c) => c.scene === "gov_fra_consult")).toBe(true);
  });

  test("low reputation never puts him out: it feeds the Élysée row", async () => {
    const gw = await game();
    late(gw);
    const seat = seatOf(gw);
    expect(rulerRow(gw, seat)?.removable).toBe(false);
    const elysee = () => seat.gov.find((g) => g.id === "fra_elysee")!.heat;
    govStep(gw);
    const calm = elysee();
    const list = gwChapters(gw.s.calendar);
    for (let i = 0; i < 12; i++) {
      seat.ruler.reputation = 0;
      rulerStep(gw);
      gw.s.chapter++;
      gw.s.day = list[gw.s.chapter].day;
    }
    expect(seat.ruler.shaken).not.toBeNull();
    expect(gw.s.ended).toBeNull();
    expect(seat.memoir).toBeNull();
    expect(seatPerson(seat)).toBe("fra_poincare");
    seat.ruler.reputation = 0;
    govStep(gw);
    expect(elysee()).toBeGreaterThan(calm);
  });

  test("July 1914: a premier pressed out is asked back, and the vote has names", async () => {
    const gw = await game();
    const seat = seatOf(gw);
    gw.nation("FRA")!.authority = 100;
    gw.person("fra_viviani")!.trust = -2;
    applyGwOrder(gw, seat, { kind: "dismiss", person: "fra_malvy" });
    expect(premier(gw)).toBeNull();
    // Renewing an empty office asks the man who resigned to stay.
    consult(gw, "renew");
    expect(premier(gw)).toBe("fra_viviani");
    expect(gw.person("fra_viviani")!.trust).toBeGreaterThan(-3);

    const again = await game();
    again.nation("FRA")!.authority = 100;
    again.person("fra_viviani")!.trust = -2;
    applyGwOrder(again, seatOf(again), {
      kind: "dismiss",
      person: "fra_malvy",
    });
    consult(again, "call_viviani");
    expect(premier(again)).toBe("fra_viviani");
    expect(seatOf(again).flags).toContain("f_pm_viviani");
  });

  test("a premier gone by his own letter brings the consultations, not the list", async () => {
    const gw = await game();
    at(gw, "1915-07");
    const seat = seatOf(gw);
    const pm = gw.person("fra_viviani")!;
    pm.office = null;
    pm.status = "fallen";
    seat.desk = [];
    seat.scheduled = [];
    advanceChapter(gw, 0, false);
    expect(gw.s.ended).toBeNull();
    expect(premier(gw)).toBeNull();
    expect(
      called(gw, "gov_fra_consult") ||
        seat.desk.some((c) => c.scene === "gov_fra_consult"),
    ).toBe(true);
    // Nobody to ask back: renewing calls the first man the Chamber votes for.
    consult(gw, "renew");
    const now = premier(gw);
    expect(now).not.toBeNull();
    expect(seat.flags).toContain(`f_pm_${now!.replace("fra_", "")}`);
  });

  test("a minister put out is not offered back for his own office", async () => {
    const gw = await game();
    const seat = seatOf(gw);
    gw.nation("FRA")!.authority = 100;
    expect(
      applyGwOrder(gw, seat, { kind: "dismiss", person: "fra_malvy" }),
    ).toBeNull();
    expect(worldView(gw, seat).candidates.interior ?? []).not.toContain(
      "fra_malvy",
    );
    expect(
      applyGwOrder(gw, seat, {
        kind: "appoint",
        person: "fra_malvy",
        office: "interior",
      }),
    ).toBe("no_person");
  });

  test("a war that comes in 1915 still brings mobilisation, and no July funeral", async () => {
    const gw = await game();
    at(gw, "1915-03");
    enter(gw, "DEU", "central", "test");
    enter(gw, "FRA", "entente", "test");
    const seat = seatOf(gw);
    seat.desk = [];
    seat.scheduled = [];
    dealDesk(gw, seat);
    const mob = seat.desk.find((c) => c.scene === "fra_c_mobilise");
    expect(mob?.variant).toBe("declared");
    expect(
      applyGwOrder(gw, seat, {
        kind: "choose",
        card: mob!.uid,
        option: "wait_day",
      }),
    ).toBe("closed");
    // The union's message, dealt a little later, reads as a war of 1915.
    let union = seat.desk.find((c) => c.scene === "fra_c_union");
    for (let i = 0; i < 4 && union === undefined; i++) {
      seat.desk = [];
      dealDesk(gw, seat);
      union = seat.desk.find((c) => c.scene === "fra_c_union");
    }
    expect(union?.variant).toMatch(/^late/);
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
