// ww190 §11: after a separate peace the seat may play on, out of the war,
// until the world's armistice; with no card in the pack it closes as before.
import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";
import {
  gwContent,
  useGwContent,
} from "@openfront/engine-lib/ww1914/content/Content";
import { aftermathStep, playingOn } from "@openfront/engine/ww1914/Aftermath";
import { endingStep } from "@openfront/engine/ww1914/Endings";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { armistice } from "@openfront/engine/ww1914/Peace";
import { courtSeats } from "@openfront/engine/ww1914/PeaceYears";
import { holds } from "@openfront/engine/ww1914/SceneRun";
import { openGeneral } from "@openfront/engine/ww1914/Wars";
import { worldEffect } from "@openfront/engine/ww1914/WorldDsl";
import { afterEach, describe, expect, test } from "vitest";
import { gwRunner } from "./util";

const SEP_ON = "deu_sep_on";

/** Germany at war, then out by its own peace. */
async function ownPeace(): Promise<GreatWar> {
  const { runner } = await gwRunner();
  const gw = runner.game.greatWar()!;
  gw.s.chain = null;
  gw.s.spark = null;
  openGeneral(gw, "DEU", "FRA", "test");
  gw.s.chapter += 2;
  const seat = gw.s.seats[0];
  worldEffect({ gw, seat, cast: {} }, { do: "separate_peace" });
  expect(gw.nation("DEU")!.out).toBe(true);
  return gw;
}

/** The pack has the card: any plain scene under its id. */
function withCard(): void {
  const base = gwContent();
  const any = base.scenes.find((x) => x.kind === "wire")!;
  const card: GwScene = { ...any, id: SEP_ON, scheduledOnly: true };
  useGwContent({ ...base, scenes: [...base.scenes, card] });
}

afterEach(() => useGwContent(null));

describe("after a separate peace", () => {
  test("with no card in the pack the seat closes as before", async () => {
    const gw = await ownPeace();
    endingStep(gw);
    expect(gw.s.seats[0].memoir).not.toBeNull();
  });

  test("the card is scheduled once; playing on keeps the seat, courted and out, until the world's armistice closes it with the same ending", async () => {
    withCard();
    const gw = await ownPeace();
    const seat = gw.s.seats[0];
    const ctx = { gw, seat, cast: {} };
    endingStep(gw);
    endingStep(gw);
    expect(seat.memoir).toBeNull();
    expect(seat.scheduled.filter((q) => q.scene === SEP_ON)).toHaveLength(1);
    // The card is dealt and taken up.
    seat.scheduled = seat.scheduled.filter((q) => q.scene !== SEP_ON);
    gw.s.chapter += 1;
    seat.seen[SEP_ON] = gw.s.chapter;
    worldEffect(ctx, { do: "play_on", on: true });
    expect(playingOn(seat)).toBe(true);
    expect(seat.leftAt).toBe(gw.s.chapter - 1);
    endingStep(gw);
    expect(seat.memoir).toBeNull();
    expect(holds(ctx, world({ is: "left_war", min: 0 }))).toBe(true);
    const now = gw.s.chapter;
    for (let i = 0; i < 30; i++) {
      gw.s.chapter = now + i;
      courtSeats(gw);
    }
    gw.s.chapter = now;
    expect(holds(ctx, world({ is: "courted", min: 1 }))).toBe(true);
    armistice(gw, "compromise", null);
    aftermathStep(gw);
    expect(seat.memoir).not.toBeNull();
    expect(seat.memoir!.ending).toMatch(/separate/);
  });

  test("the card dealt and not taken up: the seat closes", async () => {
    withCard();
    const gw = await ownPeace();
    const seat = gw.s.seats[0];
    endingStep(gw);
    expect(seat.memoir).toBeNull();
    seat.scheduled = seat.scheduled.filter((q) => q.scene !== SEP_ON);
    seat.seen[SEP_ON] = gw.s.chapter + 1;
    endingStep(gw);
    expect(seat.memoir).not.toBeNull();
  });
});
