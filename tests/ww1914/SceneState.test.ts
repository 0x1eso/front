// ww187: scenes that match the state. A dissolved house is shut till its
// election (no confidence paper, a bill waits), a Paris in German hands is
// no longer marched on, and a body whose tag is false falls to the next.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { MapFiles } from "@openfront/engine-api/game/MapFiles";
import type { GwLawState } from "@openfront/engine-api/ww1914/GwLaw";
import { flag, type GwVariant } from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld } from "@openfront/engine-api/ww1914/WorldDsl";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { GW_ELECTION_DAYS, sitsNow } from "@openfront/engine/ww1914/Assumes";
import { dealDesk } from "@openfront/engine/ww1914/Desk";
import { govLive } from "@openfront/engine/ww1914/Government";
import { GW_GOV } from "@openfront/engine/ww1914/GovTable";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { lawBookView } from "@openfront/engine/ww1914/Laws";
import {
  pickVariant,
  runEffects,
  SceneCtx,
  sceneHolds,
  sceneOf,
} from "@openfront/engine/ww1914/SceneRun";
import { declareWar } from "@openfront/engine/ww1914/Wars";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { newGame, startOf } from "./sim/GwSim";

let map: MapFiles;
beforeAll(async () => {
  map = await loadMapFiles(
    new NodeGameMapLoader(path.join(__dirname, "../../resources/maps")),
    GameMapType.World1936,
    GameMapSize.Normal,
  );
});

let games = 0;
async function germany(): Promise<GreatWar> {
  const r = await newGame(map, startOf(`state-${games++}`, "full", [], "DEU"));
  const gw = r.game.greatWar()!;
  // A month-long chapter of the war, past every threat's first date.
  const list = gwChapters(gw.s.calendar);
  gw.s.chapter = list.findIndex((c) => c.spanDays >= 28 && c.day > 0) + 34;
  gw.s.day = list[gw.s.chapter].day;
  return gw;
}

const ctxOf = (gw: GreatWar): SceneCtx => ({
  gw,
  seat: gw.s.seats[0],
  cast: {},
});

/** Germany holds Paris (as Land.moveLand records it; the test map has no 1914 cells). */
function takeParis(gw: GreatWar): void {
  gw.s.held.paris = "DEU";
}

/** A bill standing at its vote: Parliament's own peace resolution. */
function billAtVote(gw: GreatWar, id: string): void {
  const st: GwLawState = {
    id,
    stage: "vote",
    since: gw.s.chapter - 3,
    support: 0,
    how: "none",
    text: null,
    lost: 0,
    after: false,
    origin: "seat",
    by: null,
    sponsor: null,
    deals: [],
    whip: -1,
    delayTo: -1,
    warm: [],
    kept: null,
    lockTo: -1,
    paper: [],
    paperAt: -1,
    faces: -1,
  };
  gw.nation("DEU")!.laws.push(st);
}

describe("a dissolved house (ww187)", () => {
  test("the Reichstag is shut till its election: no confidence paper, the bill waits", async () => {
    const gw = await germany();
    const ctx = ctxOf(gw);
    const seat = ctx.seat;
    const chancellor = GW_GOV.find((r) => r.id === "deu_chancellor")!;
    expect(sitsNow(ctx, "reichstag")).toBe(true);
    expect(govLive(ctx, chancellor)).toBe(true);

    runEffects(ctx, [doWorld({ do: "dissolve" })]);
    expect(sitsNow(ctx, "reichstag")).toBe(false);
    // The threats made in the chamber rest.
    expect(govLive(ctx, chancellor)).toBe(false);
    // A no-confidence paper called before the dissolution doesn't come.
    seat.desk = [];
    seat.scheduled = [{ scene: "gov_deu_chancellor_2", chapter: gw.s.chapter }];
    dealDesk(gw, seat);
    expect(seat.desk.map((c) => c.scene)).not.toContain("gov_deu_chancellor_2");
    // A bill on the agenda can't be called: there is nobody to vote.
    billAtVote(gw, "deu_peace_res");
    const callWhy = () =>
      lawBookView(gw, seat)!.agenda.find((x) => x.law === "deu_peace_res")!
        .callWhy;
    expect(callWhy()).toBe("no_sitting");

    // The election: the house sits again and the call opens.
    gw.s.day += GW_ELECTION_DAYS;
    expect(sitsNow(ctx, "reichstag")).toBe(true);
    expect(govLive(ctx, chancellor)).toBe(true);
    expect(callWhy()).toBe(null);
  }, 120_000);
});

describe("Paris held (ww187)", () => {
  test("taken, Paris is no longer marched on: its own paper comes", async () => {
    const gw = await germany();
    const ctx = ctxOf(gw);
    declareWar(gw, "DEU", "FRA", "test");
    const inRange = sceneOf("deu_f_paris_in_range")!;
    const taken = sceneOf("deu_f_paris_held")!;
    expect(inRange.assumes?.held?.paris).toBe("foe");
    // French Paris ahead of the army: the march on it reads true.
    expect(sceneHolds(ctx, taken)).toBe(false);

    takeParis(gw);
    // "파리로 간다" would now be false: that paper can't come.
    expect(sceneHolds(ctx, inRange)).toBe(false);
    expect(sceneHolds(ctx, taken)).toBe(true);
  }, 120_000);

  test("a body whose tag is false falls to the next", async () => {
    const gw = await germany();
    const ctx = ctxOf(gw);
    declareWar(gw, "DEU", "FRA", "test");
    ctx.seat.flags.push("f_test_near");
    const variants: GwVariant[] = [
      {
        id: "near",
        when: flag("f_test_near"),
        assumes: { held: { paris: "foe" } },
      },
      { id: "base" },
    ];
    expect(pickVariant(ctx, variants)).toBe("near");
    takeParis(gw);
    expect(pickVariant(ctx, variants)).toBe("base");
  }, 120_000);
});
