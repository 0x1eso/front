// ww221 lane F: fleets as light state. A battle costs both sides ships; the
// blockade loses its grip when the battle fleet leaves the North Sea; a foe's
// fleet is only believed, and one that put out unheard still lies in port.
import type { GameRunner } from "@openfront/engine/GameRunner";
import { closeChain } from "@openfront/engine/ww1914/Crises";
import {
  fleetBelief,
  fleetTokensView,
} from "@openfront/engine/ww1914/FleetTokens";
import {
  blockadeHolds,
  fleetOf,
  fleetStep,
  layFleets,
  orderSortie,
  seaJudge,
  sendFleet,
} from "@openfront/engine/ww1914/Fleets";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { enter } from "@openfront/engine/ww1914/Wars";
import { describe, expect, test } from "vitest";
import { gwRunner } from "./util";

const gwOf = (r: GameRunner): GreatWar => r.game.greatWar()!;

/** A full-calendar game with the general war open and Britain in it. */
async function war(id: string) {
  const { runner } = await gwRunner({ greatWar1914Calendar: "full" }, id);
  const gw = gwOf(runner);
  gw.s.chain = { topic: "balkan", step: 5, hold: 0, short: false };
  gw.s.temp = 9;
  closeChain(gw, "war");
  if (gw.nation("GBR")!.side !== "entente") {
    enter(gw, "GBR", "entente", "entered_gbr");
  }
  gw.s.chapter += 1;
  layFleets(gw);
  const sea = gw.s.theatres.find((t) => t.id === "sea")!;
  expect(sea.open).toBe(true);
  return { gw, seat: gw.s.seats[0], sea };
}

const ships = (gw: GreatWar, id: string) => fleetOf(gw, id)!.ships;

describe("fleets", () => {
  test("a sortie meets the foe's battle fleet: both sides lose ships", async () => {
    const { gw, sea } = await war("GWFLEET1");
    const deu0 =
      ships(gw, "deu_battle_north") + ships(gw, "deu_cruisers_north");
    const gbr0 =
      ships(gw, "gbr_battle_north") + ships(gw, "gbr_cruisers_north");
    expect(orderSortie(gw, "deu_battle_north", "full")).toBe(true);
    // The cruisers in the North Sea go with it.
    expect(orderSortie(gw, "deu_cruisers_north", "full")).toBe(true);
    seaJudge(gw, sea);
    const fight = gw.s.seaFights![gw.s.seaFights!.length - 1];
    expect(fight.area).toBe("north");
    expect(fight.size).toBe("big");
    expect(fight.lost[0]).toBeGreaterThan(0);
    expect(fight.lost[1]).toBeGreaterThan(0);
    const deu = ships(gw, "deu_battle_north") + ships(gw, "deu_cruisers_north");
    const gbr = ships(gw, "gbr_battle_north") + ships(gw, "gbr_cruisers_north");
    expect(deu0 - deu).toBe(fight.lost[0]);
    expect(gbr0 - gbr).toBe(fight.lost[1]);
    // Worn, and the battle is on the sea front's record.
    expect(fleetOf(gw, "deu_battle_north")!.wear).toBeGreaterThanOrEqual(2);
    const last = gw.s.battles[gw.s.battles.length - 1];
    expect(last.theatre).toBe("sea");
    expect(last.result).not.toBe("quiet");
    // Nobody truly knows the losses yet: the world's count lags.
    expect(fleetOf(gw, "deu_battle_north")!.known).toBe(15);
  }, 60000);

  test("the battle fleet leaves the North Sea: the blockade loses its hold", async () => {
    const { gw, sea } = await war("GWFLEET2");
    sea.line = 1;
    sea.progress = 0;
    expect(blockadeHolds(gw)).toEqual({ tighten: true, slips: false });
    expect(sendFleet(gw, "gbr_battle_north", "med")).toBe(true);
    expect(blockadeHolds(gw).tighten).toBe(false);
    // Two chapters on, raids and mines have pushed the sea line up a step.
    const line = sea.line;
    for (let i = 0; i < 2; i++) {
      gw.s.chapter += 1;
      fleetStep(gw);
    }
    expect(sea.line).toBe(line + 1);
    expect(fleetOf(gw, "gbr_battle_north")!.area).toBe("med");
    // The band at home falls with the ships away.
    expect(gw.nation("GBR")!.strength.sea).toBe(1);
    // With no cruisers on station it slips.
    for (const id of ["gbr_cruisers_north", "gbr_cruisers_atlantic"]) {
      orderSortie(gw, id, "stay");
    }
    expect(blockadeHolds(gw).slips).toBe(true);
  }, 60000);

  test("a foe is only believed, and one that left unheard still lies in port", async () => {
    const { gw, seat } = await war("GWFLEET3");
    const deu = fleetOf(gw, "deu_battle_north")!;
    for (let c = 0; c < 6; c++) {
      gw.s.chapter += 1;
      const b = fleetBelief(gw, "GBR", deu);
      expect(b.sure).toBeLessThan(3);
      expect(b.ships).not.toBe(deu.ships);
      expect(b.ships!).toBeGreaterThanOrEqual(b.lo);
      expect(b.ships!).toBeLessThanOrEqual(b.hi);
      // Within the roll's span of the public count.
      expect(Math.abs(b.ships! - deu.known)).toBeLessThanOrEqual(
        Math.ceil((deu.known * (4 - b.sure) * 10) / 100) + 1,
      );
    }
    // It puts out and nobody of Britain's hears it.
    expect(orderSortie(gw, "deu_battle_north", "full")).toBe(true);
    deu.heardBy = [];
    const gbrSeat = { ...seat, tag: "GBR" as const };
    const token = fleetTokensView(gw, gbrSeat)!.find(
      (t) => t.id === "deu_battle_north",
    )!;
    expect(deu.port).toBe(false);
    expect(token.port).toBe(true);
    expect(token.seen).toBe("last");
    expect(token.homePort).toBe("hamburg");
    expect(token.mission).toBeNull();
    expect(token.fill).toBeNull();
    // Our own side of it is exact.
    const own = fleetTokensView(gw, seat)!.find(
      (t) => t.id === "deu_battle_north",
    )!;
    expect(own.ships).toBe(deu.ships);
    expect(own.port).toBe(false);
    expect(own.moves!.length).toBe(6);
  }, 60000);
});
