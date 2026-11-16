// ww221 lane A: the Admiralty's papers. A move the admiral is against,
// signed, overrules him; a sortie paper signed sends the fleet out, and the
// battle that follows is what the scenes and the diary read. Fixed states only.
import type { GwFleet } from "@openfront/engine-api/ww1914/GwFleets";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { closeChain } from "@openfront/engine/ww1914/Crises";
import { chapterMoments } from "@openfront/engine/ww1914/Diary";
import {
  fleetBattleHolds,
  fleetMoments,
  fleetPapersFor,
} from "@openfront/engine/ww1914/FleetPapers";
import { fleetOf } from "@openfront/engine/ww1914/Fleets";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { applyGwOrder } from "@openfront/engine/ww1914/Orders";
import { officeHolder } from "@openfront/engine/ww1914/People";
import { describe, expect, test } from "vitest";
import { gwRunner } from "./util";

const gwOf = (r: GameRunner): GreatWar => r.game.greatWar()!;

const fleet = (
  id: string,
  tag: GwFleet["tag"],
  ships: number,
  port: boolean,
): GwFleet => ({
  id,
  tag,
  kind: "battle",
  ships,
  wear: 0,
  area: "north",
  port,
  mission: "patrol",
  peak: ships,
  known: ships,
});

/** The general war open, the seat on Germany, two battle fleets in the north. */
async function war(id: string) {
  const { runner } = await gwRunner({ greatWar1914Calendar: "full" }, id);
  const gw = gwOf(runner);
  gw.s.chain = { topic: "balkan", step: 5, hold: 0, short: false };
  gw.s.temp = 9;
  closeChain(gw, "war");
  gw.s.chapter += 1;
  gw.s.fleets = [
    fleet("deu_battle_north", "DEU", 15, true),
    fleet("gbr_battle_north", "GBR", 22, false),
  ];
  const seat = gw.s.seats[0];
  expect(seat.tag).toBe("DEU");
  const admiral = officeHolder(gw, seat, "navy");
  expect(admiral).not.toBeNull();
  return { gw, seat, admiral: admiral! };
}

describe("the Admiralty's papers", () => {
  test("a move he objects to, signed, overrules him", async () => {
    const { gw, seat, admiral } = await war("GWFLEET1");
    admiral.temperament = "stubborn";
    expect(
      applyGwOrder(gw, seat, {
        kind: "move_fleet",
        fleet: "gbr_battle_north",
        to: "baltic",
      }),
    ).toBe("no_fleet");
    expect(
      applyGwOrder(gw, seat, {
        kind: "move_fleet",
        fleet: "deu_battle_north",
        to: "baltic",
      }),
    ).toBeNull();
    // Nothing moves by itself: the ask is only a paper.
    expect(fleetOf(gw, "deu_battle_north")!.to).toBeUndefined();
    const paper = fleetPapersFor(gw, seat).find(
      (p) => p.id === "move_deu_battle_north",
    )!;
    expect(paper).toMatchObject({
      kind: "move",
      to: "baltic",
      why: "asked",
      by: admiral.id,
      voice: "thin_home",
      objects: true,
      open: true,
    });
    expect(
      applyGwOrder(gw, seat, { kind: "fleet_paper", paper: paper.id }),
    ).toBeNull();
    expect(fleetOf(gw, "deu_battle_north")!.to).toBe("baltic");
    expect(
      seat.memory.some(
        (m) => m.key === "dept_overruled" && m.who === admiral.id,
      ),
    ).toBe(true);
    expect(seat.log.some((l) => l.key === "fleet_overruled")).toBe(true);
    // Signed once: the paper is gone, and a moving fleet can't be asked again.
    expect(fleetPapersFor(gw, seat).some((p) => p.id === paper.id)).toBe(false);
    expect(
      applyGwOrder(gw, seat, {
        kind: "move_fleet",
        fleet: "deu_battle_north",
        to: "north",
      }),
    ).toBe("fleet_moving");
  }, 60000);

  test("a sortie paper sends the fleet out; the battle after is read", async () => {
    const { gw, seat, admiral } = await war("GWFLEET2");
    admiral.temperament = "anxious";
    expect(
      applyGwOrder(gw, seat, {
        kind: "sortie_fleet",
        fleet: "deu_battle_north",
      }),
    ).toBeNull();
    const paper = fleetPapersFor(gw, seat).find(
      (p) => p.id === "sortie_deu_battle_north",
    )!;
    // Words only: the picks, and his word (an anxious man keeps it in port).
    expect(paper.picks).toEqual(["full", "part", "stay"]);
    expect(paper).toMatchObject({ voice: "keep_port", objects: true });
    expect(
      applyGwOrder(gw, seat, { kind: "fleet_paper", paper: paper.id }),
    ).toBe("bad_pick");
    expect(
      applyGwOrder(gw, seat, {
        kind: "fleet_paper",
        paper: paper.id,
        pick: "full",
      }),
    ).toBeNull();
    const f = fleetOf(gw, "deu_battle_north")!;
    expect(f).toMatchObject({ mission: "strike", sortie: "full", port: false });
    expect(seat.memory.some((m) => m.key === "dept_overruled")).toBe(true);
    // The chapter closes: Fleets.seaBattle (lane F) fights the strike and
    // records it; the next chapter's scenes and the diary read the record.
    const fought = gw.s.chapter;
    gw.s.seaFights = [
      {
        chapter: fought,
        area: "north",
        by: "DEU",
        foe: "GBR",
        size: "big",
        result: "even",
        part: false,
        warned: false,
        lost: [2, 3],
      },
    ];
    f.ships -= 2;
    expect(fleetMoments(gw, "DEU")).toEqual(["even"]);
    expect(chapterMoments(gw, seat, []).some((m) => m.moment === "fleet")).toBe(
      true,
    );
    gw.s.chapter = fought + 1;
    const big = { is: "fleet_battle", area: "north", min: "big" } as const;
    expect(fleetBattleHolds(gw, seat, big)).toBe(true);
    expect(fleetBattleHolds(gw, seat, { ...big, result: "won" })).toBe(false);
    expect(fleetBattleHolds(gw, seat, { ...big, area: "baltic" })).toBe(false);
    gw.s.chapter = fought + 3;
    expect(fleetBattleHolds(gw, seat, big)).toBe(false);
  }, 60000);
});
