// ww220 F (design ww220 §4): fronts that follow the camps. With Britain in
// the Central Powers it stands on the German end of the west front, the sea
// war starts where its fleet stands, and the blockade falls on the Entente;
// Britain and Russia meet on the Great Game, Britain and France on the Nile.
import type { GwTheatre } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { layFleets } from "@openfront/engine/ww1914/Fleets";
import { fleetTokensView } from "@openfront/engine/ww1914/FleetTokens";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { canFight } from "@openfront/engine/ww1914/Ladder";
import {
  blockaderOf,
  isBlockaded,
  shipperOf,
  uboatPrey,
} from "@openfront/engine/ww1914/Sea";
import { seaHold } from "@openfront/engine/ww1914/Seas";
import { tokensView } from "@openfront/engine/ww1914/Tokens";
import {
  declareWar,
  enter,
  memberEnd,
  membersOf,
  openWar,
} from "@openfront/engine/ww1914/Wars";
import { beforeEach, describe, expect, test } from "vitest";
import { gwRunner } from "./util";

let gw: GreatWar;
const theatre = (t: GwTheatre) => gw.s.theatres.find((x) => x.id === t)!;
const blockaded = (tag: GwTag) => isBlockaded(gw, gw.nation(tag)!);

/** July's war with Germany, Austria, France and Russia in, Britain not yet. */
function july(): void {
  openWar(gw);
  const want: [GwTag, "central" | "entente"][] = [
    ["DEU", "central"],
    ["RUS", "entente"],
    ["FRA", "entente"],
  ];
  for (const [tag, side] of want) {
    if (gw.nation(tag)!.side === null) enter(gw, tag, side, "test");
  }
  expect(gw.nation("GBR")!.side).toBeNull();
}

beforeEach(async () => {
  const { runner } = await gwRunner({}, "GWALT1");
  gw = runner.game.greatWar()!;
  gw.s.chain = null;
  gw.s.spark = null;
});

describe("Britain in the Central Powers", () => {
  test("it fights France on the west, Russia in Asia, and holds the sea", () => {
    july();
    // France's fleet waits for London while Britain makes up its mind.
    expect(theatre("sea").open).toBe(false);
    expect(declareWar(gw, "GBR", "FRA", "test")).toBe(true);
    expect(gw.nation("GBR")!.side).toBe("central");
    expect(membersOf(gw, "west", "central")).toEqual(["DEU", "GBR"]);
    expect(membersOf(gw, "west", "entente")).not.toContain("GBR");
    expect(memberEnd(gw, "colonies", "GBR")).toBe("central");
    // Salonika is the Entente's: a Britain against Serbia lands nobody there.
    expect(memberEnd(gw, "balkan", "GBR")).toBeNull();
    expect(theatre("great_game").open).toBe(true);
    expect(theatre("nile").open).toBe(true);
    // The French and Russian fleets fight the sea war without the Royal Navy.
    expect(memberEnd(gw, "sea", "GBR")).toBe("central");
    expect(memberEnd(gw, "sea", "FRA")).toBe("entente");
    expect(theatre("sea").open).toBe(true);
    expect(seaHold(gw, "north")).toBe("central");
    expect(blockaderOf(gw)).toBe("central");
    expect(blockaded("FRA")).toBe(true);
    expect(blockaded("DEU")).toBe(false);
  });
});

describe("the merge (ww222 HM)", () => {
  test("with Britain central the tokens are an ally's, and the U-boats hunt France", () => {
    layFleets(gw);
    july();
    expect(declareWar(gw, "GBR", "FRA", "test")).toBe(true);
    const seat = gw.s.seats[0];
    expect(seat.tag).toBe("DEU");
    const army = (tokensView(gw, seat) ?? []).filter((t) => t.tag === "GBR");
    expect(army.length).toBeGreaterThan(0);
    expect(army.every((t) => t.rel === "ally")).toBe(true);
    const fra = (tokensView(gw, seat) ?? []).filter((t) => t.tag === "FRA");
    expect(fra.every((t) => t.rel === "foe")).toBe(true);
    const fleets = fleetTokensView(gw, seat) ?? [];
    expect(fleets.find((f) => f.tag === "GBR")?.rel).toBe("ally");
    expect(fleets.find((f) => f.tag === "FRA")?.rel).toBe("foe");
    expect(uboatPrey(gw)).toBe("entente");
    expect(shipperOf(gw)).toBe("FRA");
  });
});

describe("history's camps", () => {
  test("the Royal Navy alone fights the Entente's sea war; Germany is blockaded", () => {
    july();
    expect(blockaderOf(gw)).toBe("entente");
    expect(declareWar(gw, "GBR", "DEU", "test")).toBe(true);
    expect(gw.nation("GBR")!.side).toBe("entente");
    expect(membersOf(gw, "sea", "entente")).toEqual(["GBR"]);
    expect(seaHold(gw, "north")).toBe("entente");
    expect(blockaded("DEU")).toBe(true);
    expect(blockaded("FRA")).toBe(false);
    expect(theatre("great_game").open).toBe(false);
    expect(theatre("nile").open).toBe(false);
  });

  test("with Britain out of it, the stronger fleet blockades", () => {
    gw.nation("GBR")!.out = true;
    july();
    expect(theatre("sea").open).toBe(true);
    expect(memberEnd(gw, "sea", "FRA")).toBe("entente");
    expect(blockaderOf(gw)).toBe("central");
    expect(blockaded("FRA")).toBe(true);
  });
});

describe("a war of the same camp", () => {
  test("Britain can go to war on Russia, and they meet in Central Asia", () => {
    expect(canFight(gw, "GBR", "RUS")).toBe(true);
    expect(canFight(gw, "GBR", "FRA")).toBe(true);
    expect(declareWar(gw, "GBR", "RUS", "test")).toBe(true);
    expect(gw.s.warChapter).toBeNull();
    expect(theatre("great_game").open).toBe(true);
    expect(theatre("persia").open).toBe(false);
    expect(theatre("east").open).toBe(false);
  });
});
