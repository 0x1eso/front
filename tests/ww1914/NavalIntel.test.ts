// ww180 (owner's pick 5): the secret war at sea on fixed states. A chain of
// direction-finding stations hears U-boats and fleets putting out; used, it
// saves ships and warns the fleet, and a read used raises suspicion.
import type { GameRunner } from "@openfront/engine/GameRunner";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import {
  buildChain,
  navalEffect,
  navalHolds,
  navalStep,
  sortieWarning,
  stationsOf,
  uboatSaves,
  WARN_COST,
  WARN_COST_READ,
  warnedLately,
} from "@openfront/engine/ww1914/NavalIntel";
import { intelOf } from "@openfront/engine/ww1914/Spies";
import { declareWar, membersOf, openWar } from "@openfront/engine/ww1914/Wars";
import { lastOf, monthsFrom } from "@openfront/engine/ww1914/World";
import { worldView } from "@openfront/engine/ww1914/WorldView";
import { beforeEach, describe, expect, test } from "vitest";
import { gwRunner } from "./util";

let runner: GameRunner;
let gw: GreatWar;
const st = () => gw.s.seats[0];
const sea = () => gw.s.theatres.find((t) => t.id === "sea")!;

/** The general war, Germany against Britain at sea, some months in. */
function war(months: number): void {
  openWar(gw);
  declareWar(gw, "DEU", "RUS", "test");
  declareWar(gw, "DEU", "FRA", "test");
  declareWar(gw, "DEU", "GBR", "test");
  sea().open = true;
  const from = gw.s.warChapter!;
  while (monthsFrom(gw, from) < months) gw.s.chapter++;
}

/** Chapters ahead until `f` holds once, at most 30; the chapter it held. */
function untilHeld(f: () => boolean): number {
  for (let k = 0; k < 30; k++) {
    if (f()) return gw.s.chapter;
    gw.s.chapter++;
  }
  throw new Error("never held");
}

beforeEach(async () => {
  ({ runner } = await gwRunner({ greatWar1914Calendar: "full" }, "GWSEA1"));
  gw = runner.game.greatWar()!;
});

describe("NavalIntel: the chain", () => {
  test("Britain builds its own; Germany's seat orders one; it grows", () => {
    war(1);
    expect(membersOf(gw, "sea", "entente")).toContain("GBR");
    navalStep(gw);
    expect(gw.nation("GBR")!.naval).toBeUndefined();
    while (gw.s.chapter - gw.s.warChapter! < 40) {
      gw.s.chapter++;
      navalStep(gw);
      if (gw.nation("GBR")!.naval !== undefined) break;
    }
    expect(stationsOf(gw, "GBR")).toBe(1);
    // The seat (Germany) is never built for: it orders.
    expect(gw.nation("DEU")!.naval).toBeUndefined();
    expect(navalHolds(gw, st(), "build")).toBe(true);
    navalEffect(gw, st(), "build");
    expect(navalHolds(gw, st(), "use")).toBe(true);
    expect(navalHolds(gw, st(), "fleet")).toBe(true);
    navalEffect(gw, st(), "all");
    expect(navalHolds(gw, st(), "all")).toBe(true);
    const since = gw.nation("DEU")!.naval!.since;
    while (monthsFrom(gw, since) < 12) gw.s.chapter++;
    expect(stationsOf(gw, "DEU")).toBe(3);
    // The seat's view: its own chain, never Britain's.
    const v = worldView(gw, st()).sea!;
    expect(v.stations).toBe(3);
    expect(v.use).toBe(2);
    expect(v.log).toEqual([]);
  });
});

describe("NavalIntel: U-boats and sorties", () => {
  test("steering ships off a U-boat saves one; a read used raises suspicion", () => {
    war(1);
    buildChain(gw, "GBR", 2);
    gw.nation("GBR")!.naval!.since = 0;
    intelOf(gw, "GBR").crypt = 3;
    intelOf(gw, "DEU").secure = 0;
    untilHeld(() => uboatSaves(gw, "DEU") === 1);
    const h = lastOf(gw.nation("GBR")!.naval!.heard)!;
    expect(h).toMatchObject({ kind: "uboat", tag: "DEU", used: true });
    expect(h.decoded).toBe(true);
    expect(intelOf(gw, "DEU").suspect.GBR).toBe(1);
    // Listening only: heard, written down, nothing saved, nothing told.
    navalChain("GBR").use = 0;
    const before = navalChain("GBR").heard.length;
    untilHeld(
      () =>
        uboatSaves(gw, "DEU") === 0 && navalChain("GBR").heard.length > before,
    );
    expect(lastOf(navalChain("GBR").heard)!.used).toBe(false);
    expect(intelOf(gw, "DEU").suspect.GBR).toBe(1);
  });

  test("a fleet heard putting out meets the enemy told; the scenes see it", () => {
    war(1);
    buildChain(gw, "GBR", 1);
    navalChain("GBR").since = 0;
    let cost = 0;
    untilHeld(() => (cost = sortieWarning(gw, sea(), "central")) > 0);
    const h = lastOf(navalChain("GBR").heard)!;
    expect(h).toMatchObject({ kind: "sortie", tag: "DEU", used: true });
    expect(cost).toBe(h.decoded ? WARN_COST_READ : WARN_COST);
    expect(warnedLately(gw, "entente")).toBe(true);
    expect(warnedLately(gw, "central")).toBe(false);
    // Germany's seat finds the British already at sea, and no more than that.
    expect(navalHolds(gw, st(), "met")).toBe(true);
    expect(navalHolds(gw, st(), "warned")).toBe(false);
    expect(worldView(gw, st()).sea!.log).toEqual([]);
    // Not on another front, and a chain that only listens tells nobody.
    const west = gw.s.theatres.find((t) => t.id === "west")!;
    expect(sortieWarning(gw, west, "central")).toBe(0);
    navalChain("GBR").use = 0;
    const before = navalChain("GBR").heard.length;
    let quiet = -1;
    untilHeld(() => {
      quiet = sortieWarning(gw, sea(), "central");
      return navalChain("GBR").heard.length > before;
    });
    expect(quiet).toBe(0);
  });
});

function navalChain(tag: "GBR" | "DEU") {
  return gw.nation(tag)!.naval!;
}
