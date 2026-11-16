// ww218 lane T: bands moved by rail, the home reserve, the chief's paper
// "move" and the tokens' beliefs. Fixed states only: no long runs.
import type { GameRunner } from "@openfront/engine/GameRunner";
import { closeChain } from "@openfront/engine/ww1914/Crises";
import { proposalsFor } from "@openfront/engine/ww1914/Fronts";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { applyGwOrder } from "@openfront/engine/ww1914/Orders";
import { divsOf, tokensView } from "@openfront/engine/ww1914/Tokens";
import {
  arrivals,
  bandTenths,
  etaOf,
  reserveStep,
  startMove,
  toReserve,
} from "@openfront/engine/ww1914/Transfers";
import { memberEnd } from "@openfront/engine/ww1914/Wars";
import { describe, expect, test } from "vitest";
import { gwRunner } from "./util";

const gwOf = (r: GameRunner): GreatWar => r.game.greatWar()!;

/** A full-calendar game with the general war open, the seat on Germany. */
async function war(id = "GWMOVE1") {
  const { runner } = await gwRunner({ greatWar1914Calendar: "full" }, id);
  const gw = gwOf(runner);
  gw.s.chain = { topic: "balkan", step: 5, hold: 0, short: false };
  gw.s.temp = 9;
  closeChain(gw, "war");
  gw.s.chapter += 1;
  return { gw, seat: gw.s.seats[0] };
}

describe("moving bands", () => {
  test("a band arrives after 4 - rail chapters, and leaves at once", async () => {
    const { gw } = await war();
    const auh = gw.nation("AUH")!;
    expect(memberEnd(gw, "balkan", "AUH")).not.toBeNull();
    expect(memberEnd(gw, "east", "AUH")).not.toBeNull();
    // Rail at the start: Russia 0 (four chapters), Austria 1, Germany 3.
    expect(etaOf(gw, "RUS", "east")).toBe(4);
    expect(etaOf(gw, "AUH", "balkan")).toBe(3);
    expect(etaOf(gw, "DEU", "west")).toBe(1);
    auh.strength.balkan = 3;
    auh.base.balkan = 3;
    auh.strength.east = 3;
    auh.base.east = 3;
    const start = gw.s.chapter;
    expect(startMove(gw, "AUH", "balkan", "east")).toBe(true);
    expect(auh.strength.balkan).toBe(2);
    expect(auh.base.balkan).toBe(2);
    // One on the rails at once for rail below 3.
    expect(startMove(gw, "AUH", "balkan", "east")).toBe(false);
    for (let c = 1; c <= 3; c++) {
      gw.s.chapter = start + c;
      arrivals(gw);
      expect(auh.strength.east).toBe(c < 3 ? 3 : 4);
    }
    expect(auh.lift?.fly).toEqual([]);
  }, 60000);

  test("the ruler asks, the chief's paper carries it, signing sends it", async () => {
    const { gw, seat } = await war("GWMOVE2");
    const deu = gw.nation("DEU")!;
    deu.strength.west = 4;
    deu.base.west = 4;
    const east = deu.strength.east ?? 1;
    expect(
      applyGwOrder(gw, seat, { kind: "move_band", from: "west", to: "west" }),
    ).toBe("no_front");
    expect(
      applyGwOrder(gw, seat, { kind: "move_band", from: "west", to: "east" }),
    ).toBeNull();
    const paper = proposalsFor(gw, seat).find((p) => p.id === "move");
    expect(paper?.move).toMatchObject({ from: "west", to: "east", eta: 1 });
    expect(paper?.move?.asked).toBe(true);
    expect(
      applyGwOrder(gw, seat, {
        kind: "allocate",
        main: paper!.main,
        posture: paper!.posture,
        scale: paper!.scale,
        allyShare: paper!.allyShare,
        research: seat.alloc.research,
        paper: "move",
      }),
    ).toBeNull();
    expect(deu.strength.west).toBe(3);
    expect(seat.moveAsk).toBeUndefined();
    const moving = tokensView(gw, seat)!.filter((t) => t.kind === "moving");
    expect(moving).toHaveLength(1);
    expect(moving[0]).toMatchObject({ to: "east", eta: 1, rel: "own" });
    gw.s.chapter += 1;
    arrivals(gw);
    expect(deu.strength.east).toBe(Math.min(5, east + 1));
  }, 60000);

  test("new armies wait at home a chapter, then go where they were bound", async () => {
    const { gw, seat } = await war("GWMOVE3");
    const deu = gw.nation("DEU")!;
    deu.strength.east = 2;
    deu.base.east = 2;
    toReserve(gw, "DEU", "east", 1);
    reserveStep(gw);
    expect(deu.lift?.reserve[0]?.n).toBe(1);
    const reserve = tokensView(gw, seat)!.find((t) => t.kind === "reserve");
    expect(reserve?.divs).toBe(divsOf("DEU", 10));
    expect(proposalsFor(gw, seat).some((p) => p.move?.from === null)).toBe(
      true,
    );
    gw.s.chapter += 1;
    reserveStep(gw);
    expect(deu.lift?.reserve).toEqual([]);
    expect(deu.lift?.fly[0]).toMatchObject({ from: null, to: "east" });
  }, 60000);
});

describe("the tokens' beliefs", () => {
  test("ours exact; a foe's guess stays in its range and is never the count below sure 3", async () => {
    const { gw, seat } = await war("GWMOVE4");
    let seen = 0;
    for (let c = 0; c < 12; c++) {
      gw.s.chapter += 1;
      for (const t of tokensView(gw, seat)!) {
        if (t.kind !== "front") continue;
        const n = gw.nation(t.tag)!;
        const truth = divsOf(t.tag, bandTenths(n, t.theatre!));
        if (t.rel === "own") {
          expect(t.divs).toBe(truth);
          expect(t.sure).toBe(3);
          expect(t.order).not.toBeNull();
          continue;
        }
        expect(t.order).toBeNull();
        if (t.rel === "foe") expect(t.fill).toBeNull();
        if (t.sure === 0) {
          expect(t.divs).toBeNull();
          continue;
        }
        seen++;
        expect(t.lo).toBeLessThanOrEqual(t.divs!);
        expect(t.hi).toBeGreaterThanOrEqual(t.divs!);
        if (t.sure < 3) expect(t.divs).not.toBe(truth);
      }
    }
    expect(seen).toBeGreaterThan(10);
  }, 60000);
});
