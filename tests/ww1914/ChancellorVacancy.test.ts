// ww171: "독일 수상 사직 받으면 수상 계속 없음?" Germany's only men fit to be
// chancellor in 1914 (Delbrück, Tirpitz) hold other offices and the later
// ones arrive in 1915: a resignation taken in 1914 left the chancellery empty,
// with no name in the vacancy box, until January 1915. A dismissal put
// Bethmann himself back at the chapter's close.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { MapFiles } from "@openfront/engine-api/game/MapFiles";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { advanceChapter } from "@openfront/engine/ww1914/Chapters";
import { dealDesk } from "@openfront/engine/ww1914/Desk";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { applyGwOrder } from "@openfront/engine/ww1914/Orders";
import {
  dismissPerson,
  openLetter,
  standingOffices,
} from "@openfront/engine/ww1914/People";
import { holderOf } from "@openfront/engine/ww1914/SceneRun";
import { enter } from "@openfront/engine/ww1914/Wars";
import { worldView } from "@openfront/engine/ww1914/WorldView";
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
async function game(tag: GwTag, month: string): Promise<GreatWar> {
  const r = await newGame(map, startOf(`ch-${games++}`, "full", [], tag));
  const gw = r.game.greatWar()!;
  const [y, m] = month.split("-").map(Number);
  const list = gwChapters(gw.s.calendar);
  gw.s.chapter = list.findIndex((c) => c.day >= Date.UTC(y, m - 1, 1) / 864e5);
  gw.s.day = list[gw.s.chapter].day;
  // A later year is a year of war: the long peace would end the game.
  if (y > 1914) {
    for (const t of ["DEU", "AUH"] as const) enter(gw, t, "central", "test");
    for (const t of ["FRA", "RUS"] as const) enter(gw, t, "entente", "test");
    gw.s.warChapter ??= 6;
  }
  return gw;
}

/** Deals one scene now and returns its card. */
function deal(gw: GreatWar, scene: string) {
  const seat = gw.s.seats[0];
  seat.desk = [];
  seat.scheduled = [{ scene, chapter: gw.s.chapter }];
  dealDesk(gw, seat);
  const card = seat.desk.find((c) => c.scene === scene);
  expect(card, scene).toBeDefined();
  return card!;
}

/** The chancellor writes his letter and the seat takes it. */
function takeLetter(gw: GreatWar): string {
  const seat = gw.s.seats[0];
  const pm = holderOf(gw, seat, "chancellor")!;
  openLetter(gw, seat, pm);
  const card = deal(gw, "gw_letter");
  const o = { kind: "choose", card: card.uid, option: "accept" } as const;
  expect(applyGwOrder(gw, seat, o)).toBeNull();
  expect(pm.status).toBe("fallen");
  expect(holderOf(gw, seat, "chancellor")).toBeNull();
  return pm.id;
}

const MONTHS = ["1914-07", "1916-03", "1917-03"];

describe("a chancellor's resignation taken: a chancellor within a chapter", () => {
  for (const tag of ["DEU", "AUH", "RUS"] as const) {
    test(`${tag}: the box has names and the chapter's close names one`, async () => {
      for (const month of MONTHS) {
        const gw = await game(tag, month);
        const seat = gw.s.seats[0];
        const was = takeLetter(gw);
        const names = worldView(gw, seat).candidates.chancellor ?? [];
        expect(names.length, `${tag} ${month}`).toBeGreaterThan(0);
        seat.desk = [];
        advanceChapter(gw, 0, false);
        expect(gw.s.ended, `${tag} ${month}`).toBeNull();
        const now = holderOf(gw, seat, "chancellor");
        expect(now, `${tag} ${month}`).not.toBeNull();
        expect(now!.id).not.toBe(was);
      }
    });
  }

  test("DEU 1914: a name from the box takes the office, before his day", async () => {
    const gw = await game("DEU", "1914-07");
    const seat = gw.s.seats[0];
    takeLetter(gw);
    const names = worldView(gw, seat).candidates.chancellor!;
    const id = names[names.length - 1];
    expect(gw.person(id)!.status).toBe("waiting");
    const o = { kind: "appoint", person: id, office: "chancellor" } as const;
    expect(applyGwOrder(gw, seat, o)).toBeNull();
    expect(holderOf(gw, seat, "chancellor")?.id).toBe(id);
  });

  test("DEU 1914: Bethmann let go isn't put back at the chapter's close", async () => {
    const gw = await game("DEU", "1914-07");
    const seat = gw.s.seats[0];
    dismissPerson(gw, seat, gw.person("deu_bethmann")!);
    seat.desk = [];
    advanceChapter(gw, 0, false);
    const now = holderOf(gw, seat, "chancellor");
    expect(now).not.toBeNull();
    expect(now!.id).not.toBe("deu_bethmann");
  });

  test("GBR has no chancellery; FRA's consultations end in a premier", async () => {
    expect(standingOffices("GBR")).not.toContain("chancellor");
    for (const month of MONTHS) {
      const gw = await game("FRA", month);
      const seat = gw.s.seats[0];
      takeLetter(gw);
      seat.desk = [];
      advanceChapter(gw, 0, false);
      expect(gw.s.ended, month).toBeNull();
      const card = deal(gw, "gov_fra_consult");
      for (const reply of ["hear", "hear", "renew"]) {
        const o = { kind: "reply", card: card.uid, reply } as const;
        expect(applyGwOrder(gw, seat, o), `${month} ${reply}`).toBeNull();
      }
      seat.desk = [];
      advanceChapter(gw, 0, false);
      expect(gw.s.ended, month).toBeNull();
      expect(holderOf(gw, seat, "chancellor"), month).not.toBeNull();
    }
  });
});
